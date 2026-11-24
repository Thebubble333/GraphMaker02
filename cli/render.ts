#!/usr/bin/env tsx
import fs from 'node:fs/promises';
import path from 'node:path';
import { AI_TOOLS, resolveToolSpec } from '../utils/ai/toolRegistry';
import { encodeDeepLinkUrl } from '../utils/ai/urlState';
import { validateToolPayload } from '../utils/ai/validator';
import { renderToolHeadlessSVG } from '../utils/ai/headlessRenderer';
import { renderSvgToPngBuffer } from '../mcp/pngRender';

const DEFAULT_BASE_URL =
  process.env.GRAPH_MAKER_BASE_URL || 'https://mccombe.github.io/GraphMaker02/';

function printUsage() {
  console.log(`GraphMaker Suite — Headless Node.js CLI Renderer (Zero Browser Required)

Usage:
  npx tsx cli/render.ts <payload.json> [options]
  echo '{"tool":"function-grapher","payload":{...}}' | npx tsx cli/render.ts [options]

Options:
  --tool <slug>       Tool slug (optional if payload JSON has top-level "tool")
  --json <string>     Inline JSON payload string
  --format <fmt>      Output format: svg (default), png, or url
  --out <path>        Write output to file instead of stdout (required for binary png unless piping)
  --width-cm <num>    Physical export width in centimeters
  --height-cm <num>   Physical export height in centimeters (svg only)
  --dpi <num>         Target DPI for PNG export (default 300)
  --base-url <url>    GitHub Pages base URL for --format url
  --validate          Strictly validate payload and exit non-zero on any warning/error
  --list              List all 18 available tool slugs
  -h, --help          Show this help message
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
  let inlineJson: string | undefined;
  let format: 'svg' | 'png' | 'url' = 'svg';
  let outPath: string | undefined;
  let widthCm: number | undefined;
  let heightCm: number | undefined;
  let dpi = 300;
  let baseUrl = DEFAULT_BASE_URL;
  let strictValidate = false;

  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a === '--tool') toolArg = args[++i];
    else if (a === '--json') inlineJson = args[++i];
    else if (a === '--format') format = (args[++i] as any) || 'svg';
    else if (a === '--out' || a === '-o') outPath = args[++i];
    else if (a === '--width-cm') widthCm = Number(args[++i]);
    else if (a === '--height-cm') heightCm = Number(args[++i]);
    else if (a === '--dpi') dpi = Number(args[++i]) || 300;
    else if (a === '--base-url') baseUrl = args[++i];
    else if (a === '--validate') strictValidate = true;
    else if (!a.startsWith('-') && !inputFile) inputFile = a;
  }

  let rawText = inlineJson;
  if (!rawText && inputFile) {
    rawText = await fs.readFile(path.resolve(inputFile), 'utf8');
  }
  if (!rawText) {
    rawText = await readStdin();
  }
  if (!rawText || !rawText.trim()) {
    console.error('Error: Provide a payload JSON file, --json string, or stdin. Run with --help for usage.');
    process.exit(1);
  }

  let parsed: Record<string, any>;
  try {
    parsed = JSON.parse(rawText);
  } catch (err: any) {
    console.error(`Error: Invalid JSON input — ${err?.message || err}`);
    process.exit(1);
  }

  // Support both `{ tool, payload }` wrapper files (like examples/*.json) and raw payloads with --tool
  const resolvedToolArg = toolArg || parsed.tool;
  const payload =
    parsed.tool && parsed.payload && typeof parsed.payload === 'object'
      ? parsed.payload
      : parsed;

  if (!resolvedToolArg) {
    console.error('Error: Missing tool slug. Pass --tool <slug> or include "tool" in the JSON file.');
    process.exit(1);
  }

  const spec = resolveToolSpec(resolvedToolArg);
  if (!spec) {
    console.error(`Error: Unknown tool "${resolvedToolArg}". Run with --list to see valid slugs.`);
    process.exit(1);
  }

  const validation = validateToolPayload(spec.slug, payload);
  if (!validation.valid) {
    for (const iss of validation.issues) {
      console.error(`[${iss.severity.toUpperCase()}] ${iss.message}`);
    }
    if (strictValidate) {
      process.exit(2);
    }
  }

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
    const pngResult = renderSvgToPngBuffer(svgResult.svg, {
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

  console.error(`Error: Unsupported --format "${format}". Use svg, png, or url.`);
  process.exit(1);
}

main().catch((err) => {
  console.error(err?.message || err);
  process.exit(1);
});
