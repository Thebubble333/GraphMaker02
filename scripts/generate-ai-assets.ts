import fs from 'node:fs/promises';
import path from 'node:path';
import { AI_TOOLS } from '../utils/ai/toolRegistry';
import { encodeDeepLinkUrl } from '../utils/ai/urlState';
import { makeStrictSchema, validateToolPayload } from '../utils/ai/validator';
import { renderToolHeadlessSVG } from '../utils/ai/headlessRenderer';
import { renderSvgToPngBuffer } from '../mcp/pngRender';

interface ExampleFileInput {
  tool: string;
  title: string;
  description: string;
  payload: Record<string, any>;
}

interface GalleryEntry {
  id: string;
  tool: string;
  title: string;
  description: string;
  payloadPath: string;
  svgPath: string;
  pngPath: string;
  payloadUrl: string;
  svgUrl: string;
  pngUrl: string;
  deepLink: string;
  widthCm: number;
  heightCm: number;
}

const EXPRESSION_SYNTAX_GUIDE = {
  parser: 'mathjs (with GraphMaker preprocessing)',
  impliedMultiplication: 'Supported (e.g. "2x", "3(x+1)", "2sin(x)"); explicit "*" is safest when ambiguous (e.g. "x*sin(x)").',
  leadingYPrefix: 'Optional ("y = x^2" and "x^2" are both accepted).',
  constants: ['pi (or π)', 'e'],
  operators: ['+', '-', '*', '/', '^ (exponent)', '|x| (converted to abs(x))'],
  functions: {
    rootsAndAbs: ['sqrt(x)', 'cbrt(x)', 'nthRoot(x, n)', 'abs(x)'],
    logarithmsAndExp: [
      'ln(x) -> natural log base e',
      'log(x) -> natural log base e (mathjs default)',
      'log10(x) or log(x, 10) -> base-10 log',
      'log(x, b) -> log base b',
      'exp(x) or e^x'
    ],
    trigonometric: ['sin(x)', 'cos(x)', 'tan(x)', 'sec(x)', 'csc(x) / cosec(x)', 'cot(x)'],
    inverseTrig: ['asin(x) / arcsin(x)', 'acos(x) / arccos(x)', 'atan(x) / arctan(x)'],
    rounding: ['floor(x)', 'ceil(x)', 'round(x)']
  },
  boundsSyntax: 'Domain bounds (domain: [min, max]) and integral bounds (start, end) accept plain numbers OR math expressions such as -2, "0", "-pi/2", "pi", "sqrt(2)".',
  integralFunctionIds: 'integrals[].functionId1 and integrals[].functionId2 match functions[].id. If you omit "id" on a function, GraphMaker auto-assigns 1-based string IDs "1", "2", "3", ... in array order.'
};

function resolveSiteBaseUrl(): string {
  const fromEnv = process.env.GRAPH_MAKER_BASE_URL?.trim();
  if (fromEnv) {
    return fromEnv.endsWith('/') ? fromEnv : `${fromEnv}/`;
  }
  const ghRepo = process.env.GITHUB_REPOSITORY?.trim();
  if (ghRepo && ghRepo.includes('/')) {
    const [owner, repo] = ghRepo.split('/');
    return `https://${owner.toLowerCase()}.github.io/${repo}/`;
  }
  return 'https://mccombe.github.io/GraphMaker02/';
}

async function generatePerToolSchemas(baseUrl: string, publicDir: string) {
  const aiDir = path.join(publicDir, 'ai');
  await fs.mkdir(aiDir, { recursive: true });

  const combinedTools: Record<string, any> = {};

  for (const tool of AI_TOOLS) {
    const strictSchema = makeStrictSchema(tool.schema as Record<string, any>);
    const deepLinkExample = encodeDeepLinkUrl(baseUrl, tool.slug, tool.example as Record<string, any>);

    // Validate built-in example against strict schema
    const check = validateToolPayload(tool.slug, tool.example as Record<string, any>);
    if (!check.valid) {
      throw new Error(
        `Built-in example for "${tool.slug}" failed strict validation:\n` +
          check.issues.map((i) => `  - [${i.severity}] ${i.message}`).join('\n')
      );
    }

    const perToolDoc: Record<string, any> = {
      $schema: 'https://json-schema.org/draft/2020-12/schema',
      $id: `${baseUrl}ai/${tool.slug}.json`,
      slug: tool.slug,
      name: tool.name,
      category: tool.category,
      description: tool.description,
      defaultWidthCm: tool.defaultWidthCm,
      defaultHeightCm: tool.defaultHeightCm,
      deepLinkFormat: `${baseUrl}?tool=${tool.slug}&config=<URL_ENCODED_JSON>`,
      schema: strictSchema,
      example: tool.example,
      deepLinkExample
    };

    if (tool.slug === 'function-grapher' || tool.slug === 'inequality-grapher') {
      perToolDoc.expressionSyntax = EXPRESSION_SYNTAX_GUIDE;
    }

    await fs.writeFile(
      path.join(aiDir, `${tool.slug}.json`),
      JSON.stringify(perToolDoc, null, 2) + '\n',
      'utf8'
    );

    combinedTools[tool.slug] = {
      name: tool.name,
      category: tool.category,
      description: tool.description,
      schemaUrl: `${baseUrl}ai/${tool.slug}.json`,
      defaultWidthCm: tool.defaultWidthCm,
      defaultHeightCm: tool.defaultHeightCm,
      schema: strictSchema,
      example: tool.example
    };
  }

  const combinedDoc = {
    $schema: 'https://json-schema.org/draft/2020-12/schema',
    title: 'GraphMaker Suite AI Payload Schema',
    description: 'Strict JSON schemas (additionalProperties: false) for all 18 GraphMaker Suite tools. Individual small per-tool schemas are published at ai/<slug>.json.',
    siteUrl: baseUrl,
    deepLinkFormat: `${baseUrl}?tool=<slug>&config=<URL_ENCODED_JSON>`,
    expressionSyntax: EXPRESSION_SYNTAX_GUIDE,
    tools: combinedTools
  };

  await fs.writeFile(
    path.join(publicDir, 'ai-schema.json'),
    JSON.stringify(combinedDoc, null, 2) + '\n',
    'utf8'
  );
}

async function generateExampleGallery(baseUrl: string, rootDir: string, publicDir: string): Promise<GalleryEntry[]> {
  const examplesSrcDir = path.join(rootDir, 'examples');
  const examplesOutDir = path.join(publicDir, 'examples');
  await fs.mkdir(examplesOutDir, { recursive: true });

  const entries = (await fs.readdir(examplesSrcDir))
    .filter((f) => f.endsWith('.json'))
    .sort();

  const gallery: GalleryEntry[] = [];

  for (const filename of entries) {
    const id = filename.replace(/\.json$/, '');
    const raw = await fs.readFile(path.join(examplesSrcDir, filename), 'utf8');
    const item = JSON.parse(raw) as ExampleFileInput;

    const validation = validateToolPayload(item.tool, item.payload);
    if (!validation.valid) {
      throw new Error(
        `Example "${filename}" failed strict validation:\n` +
          validation.issues.map((i) => `  - [${i.severity}] ${i.message}`).join('\n')
      );
    }

    const svgResult = renderToolHeadlessSVG(item.tool, item.payload);
    const pngResult = renderSvgToPngBuffer(svgResult.svg, {
      widthCm: svgResult.widthCm,
      dpi: 300
    });
    const deepLink = encodeDeepLinkUrl(baseUrl, item.tool, item.payload);

    const payloadPath = `examples/${id}.json`;
    const svgPath = `examples/${id}.svg`;
    const pngPath = `examples/${id}.png`;

    await fs.writeFile(
      path.join(examplesOutDir, `${id}.json`),
      JSON.stringify(
        {
          tool: item.tool,
          title: item.title,
          description: item.description,
          deepLink,
          payload: item.payload
        },
        null,
        2
      ) + '\n',
      'utf8'
    );
    await fs.writeFile(path.join(examplesOutDir, `${id}.svg`), svgResult.svg, 'utf8');
    await fs.writeFile(path.join(examplesOutDir, `${id}.png`), pngResult.buffer);

    gallery.push({
      id,
      tool: item.tool,
      title: item.title,
      description: item.description,
      payloadPath,
      svgPath,
      pngPath,
      payloadUrl: `${baseUrl}${payloadPath}`,
      svgUrl: `${baseUrl}${svgPath}`,
      pngUrl: `${baseUrl}${pngPath}`,
      deepLink,
      widthCm: svgResult.widthCm,
      heightCm: svgResult.heightCm
    });
  }

  await fs.writeFile(
    path.join(examplesOutDir, 'index.json'),
    JSON.stringify(
      {
        siteUrl: baseUrl,
        count: gallery.length,
        examples: gallery
      },
      null,
      2
    ) + '\n',
    'utf8'
  );

  return gallery;
}

async function generateLlmsTxt(baseUrl: string, publicDir: string, gallery: GalleryEntry[]) {
  const areaExample = gallery.find((g) => g.id === 'area-between-curves');

  const lines: string[] = [
    '# GraphMaker Suite — AI Integration Guide',
    '',
    '> Publication-ready mathematical graphing, statistics, and discrete diagram generator (SVG & 300-DPI PNG) hosted statically on GitHub Pages.',
    `> Live site: ${baseUrl}`,
    '',
    '## 1. Deep-Link URL Format (Works in Any Web AI)',
    '',
    'Construct a clickable URL that opens any tool pre-populated with your JSON configuration:',
    '',
    `${baseUrl}?tool=<SLUG>&config=<URL_ENCODED_JSON>`,
    '',
    '- `tool`: one of the 18 slugs listed below (e.g. `function-grapher`, `inequality-grapher`, `box-plots`).',
    '- `config`: URL-encoded JSON matching the strict per-tool schema at `ai/<SLUG>.json` (or `b64:<base64url-json>` for large payloads).',
    '- Validation feedback: If a generated link contains unknown fields, broken integral IDs, or unparseable math syntax, the page displays an on-screen diagnostic banner with a "Copy report for AI" button so the user can paste the exact error back to you.',
    '',
    '## 2. Expression Syntax (`function-grapher` & `inequality-grapher`)',
    '',
    '- Engine: `mathjs` with GraphMaker preprocessing.',
    '- Implied multiplication: `2x`, `3(x+1)`, `2sin(x)` all work. Explicit `*` (e.g. `2*x`, `x*sin(x)`) is safest when ambiguous.',
    '- Leading `y =` is optional (`"x^2 - 4"` and `"y = x^2 - 4"` both work).',
    '- Constants: `pi` (or `π`), `e`.',
    '- Operators: `+`, `-`, `*`, `/`, `^` (power), `|x|` (auto-converted to `abs(x)`).',
    '- Functions:',
    '  - Roots & absolute value: `sqrt(x)`, `cbrt(x)`, `nthRoot(x, n)`, `abs(x)`',
    '  - Logs & exponentials: `ln(x)` and `log(x)` are BOTH natural log (base e); use `log10(x)` or `log(x, 10)` for base-10; `exp(x)` or `e^x`.',
    '  - Trig: `sin(x)`, `cos(x)`, `tan(x)`, `sec(x)`, `csc(x)` (or `cosec(x)`), `cot(x)`.',
    '  - Inverse trig: `asin(x)`/`arcsin(x)`, `acos(x)`/`arccos(x)`, `atan(x)`/`arctan(x)`.',
    '- Bounds (`integrals[].start`, `integrals[].end`, `functions[].domain`): accept plain numbers OR mathjs expressions as strings (e.g. `-2`, `"0"`, `"-pi/2"`, `"pi"`, `"sqrt(2)"`).',
    '- Function IDs for integrals: Give each function an explicit `"id"` (e.g. `"f1"`, `"f2"`) and reference those IDs in `integrals[].functionId1` / `integrals[].functionId2`. If `"id"` is omitted on functions, GraphMaker auto-assigns 1-based string IDs `"1"`, `"2"`, `"3"`, ... in array order.',
    '',
    '## 3. Complete Area-Between-Curves Example (`function-grapher`)',
    '',
    'Shading the area enclosed between $y = 4 - x^2$ and $y = x + 2$ from $x = -2$ to $x = 1$:',
    '',
    '```json',
    JSON.stringify(
      {
        functions: [
          { id: 'f1', expression: '4 - x^2', color: '#000000' },
          { id: 'f2', expression: 'x + 2', color: '#2563eb' }
        ],
        integrals: [
          {
            functionId1: 'f1',
            functionId2: 'f2',
            start: '-2',
            end: '1',
            color: '#3b82f6',
            opacity: 0.28
          }
        ],
        points: [
          { x: -2, y: 0, label: '$(-2, 0)$' },
          { x: 1, y: 3, label: '$(1, 3)$' }
        ],
        config: {
          xRange: [-3, 3],
          yRange: [-1, 5],
          majorStep: [1, 1],
          axisLabels: ['$x$', '$y$']
        }
      },
      null,
      2
    ),
    '```',
    ''
  ];

  if (areaExample) {
    lines.push(`- Working deep link: ${areaExample.deepLink}`);
    lines.push(`- Pre-rendered preview: ${areaExample.pngUrl} (SVG: ${areaExample.svgUrl})`);
    lines.push('');
  }

  lines.push(
    '## 4. Per-Tool Strict Schemas (Small Files — Safe for Web Fetchers)',
    '',
    'Every schema below sets `"additionalProperties": false` and includes one complete verified example and deep link:',
    ''
  );

  for (const tool of AI_TOOLS) {
    lines.push(`- **${tool.slug}** (${tool.name}): ${baseUrl}ai/${tool.slug}.json — ${tool.description}`);
  }

  lines.push(
    '',
    `- Combined strict schema (all 18 tools): ${baseUrl}ai-schema.json`,
    '',
    '## 5. Pre-Rendered Example Gallery',
    '',
    'Copy the closest verified payload below or inspect its pre-rendered PNG/SVG before generating a new link:',
    `- Machine-readable gallery index: ${baseUrl}examples/index.json`,
    ''
  );

  for (const g of gallery) {
    lines.push(
      `- **${g.title}** (\`${g.tool}\`): payload \`${g.payloadPath}\` (${g.payloadUrl}) | PNG \`${g.pngPath}\` (${g.pngUrl}) | SVG \`${g.svgPath}\` (${g.svgUrl})`
    );
  }

  lines.push(
    '',
    '## 6. Standalone Headless CLI Renderer (Zero Browser Needed)',
    '',
    'If you have terminal/code execution access (e.g. a sandbox or local repo clone), validate and render SVGs or 300-DPI PNGs directly in Node.js without a browser:',
    '',
    '```bash',
    '# Validate payload (exits 2 on schema/syntax errors) and render SVG',
    'npx tsx cli/render.ts examples/area-between-curves.json --validate --format svg > graph.svg',
    '',
    '# Render 300-DPI PNG via @resvg/resvg-js',
    'npx tsx cli/render.ts examples/area-between-curves.json --validate --format png --out graph.png',
    '',
    '# Generate clickable GitHub Pages deep link',
    'npx tsx cli/render.ts examples/area-between-curves.json --format url',
    '```',
    '',
    '## 7. Other Integration Options',
    '',
    '- **Local Desktop MCP Server** (Claude Desktop, Cursor, VS Code): Run `npx tsx mcp/server.ts` locally (`stdio` transport) for `list_math_tools`, `get_tool_schema`, `generate_graph_url`, `render_graph_svg`, and `render_graph_png`. See `AI_MCP_SETUP.md` in the repository.',
    '- **Browser Automation API**: On the live page, `window.GraphMakerAI` exposes `getTools()`, `openTool(slug, payload)`, `exportSVG({ widthCm })`, and `exportPNG({ widthCm, dpi })`.',
    ''
  );

  await fs.writeFile(path.join(publicDir, 'llms.txt'), lines.join('\n'), 'utf8');
}

async function main() {
  const rootDir = process.cwd();
  const publicDir = path.join(rootDir, 'public');
  const baseUrl = resolveSiteBaseUrl();

  console.log(`Generating AI assets for base URL: ${baseUrl}`);
  await generatePerToolSchemas(baseUrl, publicDir);
  console.log(`  - Wrote ${AI_TOOLS.length} strict per-tool schemas to public/ai/<slug>.json`);
  console.log('  - Wrote combined strict schema to public/ai-schema.json');

  const gallery = await generateExampleGallery(baseUrl, rootDir, publicDir);
  console.log(`  - Pre-rendered ${gallery.length} gallery examples (json + svg + 300-DPI png) to public/examples/`);

  await generateLlmsTxt(baseUrl, publicDir, gallery);
  console.log('  - Wrote public/llms.txt');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
