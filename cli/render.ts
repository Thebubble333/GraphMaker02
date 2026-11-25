import fs from 'node:fs/promises';
import path from 'node:path';
import { AI_TOOLS, resolveToolSpec } from '../utils/ai/toolRegistry';
import { encodeDeepLinkUrl } from '../utils/ai/urlState';
import { validateToolPayload } from '../utils/ai/validator';
import { renderToolHeadlessSVG } from '../utils/ai/headlessRenderer';
import { renderSvgToPngBuffer } from '../mcp/pngRender';

const DEFAULT_BASE_URL =
  process.env.GRAPH_MAKER_BASE_URL || 'https://thebubble333.github.io/GraphMaker02/';

function printUsage() {
  console.log(`GraphMaker Suite — Standalone Headless CLI Renderer (Zero Browser / Pure WASM)

Usage:
  npx graphmaker-render --tool <slug> --config <payload.json> --out graph.png --dpi 300
  npx github:thebubble333/GraphMaker02 --tool <slug> --config <payload.json> --out graph.png
  cat payload.json | npx graphmaker-render --tool <slug> --format svg > graph.svg

Options:
  --tool <slug>         Tool slug (optional if JSON file has top-level "tool" field)
  --config <path|json>  Path to JSON payload file OR inline JSON string
  --json <string>       Inline JSON payload string (alias for --config)
  --out, -o <path>      Output file path (infers format from .png / .svg extension if --format omitted)
  --format <fmt>        Output format: svg, png, or url (auto-inferred from --out, else svg)
  --width-cm <num>      Physical export width in centimeters
  --height-cm <num>     Physical export height in centimeters (svg only)
  --dpi <num>           Target DPI for PNG export (default 300)
  --base-url <url>      GitHub Pages base URL for --format url
  --validate            Strict validation (enabled by default; exits code 2 on any warning/error)
  --validate-only       Validate payload and exit 0 (valid) or 2 (invalid) without rendering
  --no-strict           Warn to stderr on unknown fields but still attempt to render
  --list                List all 18 available tool slugs
  -h, --help            Show this help message
`);
}

async function readStdin(): Promise<string> {
  if (process.stdin.isTTY) return '';
  const chunks: Buffer[] = [];
  for await (const chunk of process.stdin) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  return Buffer.concat(chunks).toString('utf8');
}

async function resolveConfigInput(configArg?: string, inputFile?: string): Promise<string> {
  if (configArg) {
    const trimmed = configArg.trim();
    if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
      return trimmed;
    }
    return fs.readFile(path.resolve(trimmed), 'utf8');
  }
  if (inputFile) {
    return fs.readFile(path.resolve(inputFile), 'utf8');
  }
  return readStdin();
}

function inferFormat(explicitFormat: string | undefined, outPath: string | undefined): 'svg' | 'png' | 'url' {
  if (explicitFormat) {
    const lower = explicitFormat.toLowerCase();
    if (lower === 'svg' || lower === 'png' || lower === 'url') return lower;
    throw new Error(`Unsupported --format "${explicitFormat}". Use svg, png, or url.`);
  }
  if (outPath) {
    const lowerOut = outPath.toLowerCase();
    if (lowerOut.endsWith('.png')) return 'png';
    if (lowerOut.endsWith('.svg') || lowerOut.endsWith('.svg.txt')) return 'svg';
  }
  return 'svg';
}

async function main() {
  const args = process.argv.slice(2);
  if (args.includes('-h') || args.includes('--help')) {
    printUsage();
    process.exit(0);
  }
  if (args.includes('--list')) {
    console.log(AI_TOOLS.map((t) => `${t.slug}\t(${t.category})\t${t.name}`).join('\n'));
    process.exit(0);
  }

  let inputFile: string | undefined;
  let toolArg: string | undefined;
  let configArg: string | undefined;
  let explicitFormat: string | undefined;
  let outPath: string | undefined;
  let widthCm: number | undefined;
  let heightCm: number | undefined;
  let dpi = 300;
  let baseUrl = DEFAULT_BASE_URL;
  let strict = true;
  let validateOnly = false;

  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a === '--tool' || a === '-t') toolArg = args[++i];
    else if (a === '--config' || a === '-c' || a === '--json') configArg = args[++i];
    else if (a === '--format' || a === '-f') explicitFormat = args[++i];
    else if (a === '--out' || a === '-o') outPath = args[++i];
    else if (a === '--width-cm') widthCm = Number(args[++i]);
    else if (a === '--height-cm') heightCm = Number(args[++i]);
    else if (a === '--dpi') dpi = Number(args[++i]) || 300;
    else if (a === '--base-url') baseUrl = args[++i];
    else if (a === '--validate' || a === '--strict') strict = true;
    else if (a === '--no-strict' || a === '--allow-warnings') strict = false;
    else if (a === '--validate-only') validateOnly = true;
    else if (!a.startsWith('-') && !inputFile) inputFile = a;
  }

  let rawText = '';
  try {
    rawText = await resolveConfigInput(configArg, inputFile);
  } catch (err: any) {
    console.error(`Error: Could not read config input — ${err?.message || err}`);
    process.exit(1);
  }

  if (!rawText || !rawText.trim()) {
    console.error(
      'Error: Provide a payload via --config <file.json>, positional <file.json>, or stdin. Run with --help for usage.'
    );
    process.exit(1);
  }

  let parsed: Record<string, any>;
  try {
    parsed = JSON.parse(rawText);
  } catch (err: any) {
    console.error(`Error: Invalid JSON input — ${err?.message || err}`);
    process.exit(2);
  }

  // Support both `{ tool, payload }` wrapper files (like examples/*.json) and raw payloads with --tool
  const resolvedToolArg = toolArg || parsed.tool;
  const payload =
    parsed.tool && parsed.payload && typeof parsed.payload === 'object'
      ? parsed.payload
      : parsed;

  if (!resolvedToolArg) {
    console.error('Error: Missing tool slug. Pass --tool <slug> or include "tool" in the JSON file.');
    process.exit(2);
  }

  const spec = resolveToolSpec(resolvedToolArg);
  if (!spec) {
    console.error(`Error: Unknown tool "${resolvedToolArg}". Run with --list to see valid slugs.`);
    process.exit(2);
  }

  const validation = validateToolPayload(spec.slug, payload);
  if (!validation.valid) {
    for (const iss of validation.issues) {
      console.error(`[${iss.severity.toUpperCase()}] ${iss.message}`);
    }
    const hasErrors = validation.issues.some((i) => i.severity === 'error');
    if (strict || hasErrors || validateOnly) {
      process.exit(2);
    }
    console.error(
      '[INFO] Continuing because --no-strict was specified (fields outside the strict schema may still be passed through or ignored by the renderer).'
    );
  }

  if (validateOnly) {
    console.log(`OK: Valid "${spec.slug}" payload.`);
    process.exit(0);
  }

  const format = inferFormat(explicitFormat, outPath);

  if (format === 'url') {
    const url = encodeDeepLinkUrl(baseUrl, spec.slug, payload);
    if (outPath) {
      await fs.mkdir(path.dirname(path.resolve(outPath)), { recursive: true });
      await fs.writeFile(path.resolve(outPath), url + '\n', 'utf8');
    } else {
      process.stdout.write(url + '\n');
    }
    return;
  }

  const svgResult = renderToolHeadlessSVG(spec.slug, payload, { widthCm, heightCm });

  if (format === 'svg') {
    if (outPath) {
      await fs.mkdir(path.dirname(path.resolve(outPath)), { recursive: true });
      await fs.writeFile(path.resolve(outPath), svgResult.svg, 'utf8');
    } else {
      process.stdout.write(svgResult.svg);
    }
    return;
  }

  if (format === 'png') {
    const pngResult = await renderSvgToPngBuffer(svgResult.svg, {
      widthCm: widthCm || svgResult.widthCm,
      dpi
    });
    if (outPath) {
      await fs.mkdir(path.dirname(path.resolve(outPath)), { recursive: true });
      await fs.writeFile(path.resolve(outPath), pngResult.buffer);
    } else {
      process.stdout.write(pngResult.buffer);
    }
    return;
  }
}

main().catch((err) => {
  console.error(err?.message || err);
  process.exit(1);
});
