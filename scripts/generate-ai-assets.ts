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
  svgTxtPath: string;
  pngPath: string;
  payloadUrl: string;
  svgUrl: string;
  svgTxtUrl: string;
  pngUrl: string;
  deepLink: string;
  widthCm: number;
  heightCm: number;
}

const DEFAULT_GH_REPO = 'Thebubble333/GraphMaker02';

const EXPRESSION_SYNTAX_GUIDE = {
  parser: 'mathjs (with GraphMaker preprocessing)',
  impliedMultiplication:
    'Supported (e.g. "2x", "3(x+1)", "2sin(x)"); explicit "*" is safest when ambiguous (e.g. "x*sin(x)").',
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
  boundsSyntax:
    'Domain bounds (domain: [min, max]) and integral bounds (start, end) accept plain numbers OR math expressions such as -2, "0", "-pi/2", "pi", "sqrt(2)".',
  integralFunctionIds:
    'integrals[].functionId1 and integrals[].functionId2 match functions[].id. If you omit "id" on a function, GraphMaker auto-assigns 1-based string IDs "1", "2", "3", ... in array order.'
};

function resolveGitHubRepo(): string {
  const ghRepo = process.env.GITHUB_REPOSITORY?.trim();
  if (ghRepo && ghRepo.includes('/')) {
    return ghRepo;
  }
  return DEFAULT_GH_REPO;
}

function resolveSiteBaseUrl(): string {
  const fromEnv = process.env.GRAPH_MAKER_BASE_URL?.trim();
  if (fromEnv) {
    try {
      const u = new URL(fromEnv);
      u.hostname = u.hostname.toLowerCase();
      const s = u.toString();
      return s.endsWith('/') ? s : `${s}/`;
    } catch {
      return fromEnv.endsWith('/') ? fromEnv : `${fromEnv}/`;
    }
  }
  const [owner, repo] = resolveGitHubRepo().split('/');
  return `https://${owner.toLowerCase()}.github.io/${repo}/`;
}

async function generatePerToolSchemas(baseUrl: string, publicDir: string) {
  const aiDir = path.join(publicDir, 'ai');
  await fs.mkdir(aiDir, { recursive: true });

  const combinedTools: Record<string, any> = {};

  for (const tool of AI_TOOLS) {
    const strictSchema = makeStrictSchema(tool.schema as Record<string, any>);
    const deepLinkExample = encodeDeepLinkUrl(baseUrl, tool.slug, tool.example as Record<string, any>);

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
    description:
      'Strict JSON schemas (additionalProperties: false) for all 18 GraphMaker Suite tools. Individual small per-tool schemas are published at ai/<slug>.json.',
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

async function generateExampleGallery(
  baseUrl: string,
  rootDir: string,
  publicDir: string
): Promise<GalleryEntry[]> {
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
    const pngResult = await renderSvgToPngBuffer(svgResult.svg, {
      widthCm: svgResult.widthCm,
      dpi: 300
    });
    const deepLink = encodeDeepLinkUrl(baseUrl, item.tool, item.payload);

    const payloadPath = `examples/${id}.json`;
    const svgPath = `examples/${id}.svg`;
    const svgTxtPath = `examples/${id}.svg.txt`;
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
    await fs.writeFile(path.join(examplesOutDir, `${id}.svg.txt`), svgResult.svg, 'utf8');
    await fs.writeFile(path.join(examplesOutDir, `${id}.png`), pngResult.buffer);

    gallery.push({
      id,
      tool: item.tool,
      title: item.title,
      description: item.description,
      payloadPath,
      svgPath,
      svgTxtPath,
      pngPath,
      payloadUrl: `${baseUrl}${payloadPath}`,
      svgUrl: `${baseUrl}${svgPath}`,
      svgTxtUrl: `${baseUrl}${svgTxtPath}`,
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

async function generateLlmsTxt(
  baseUrl: string,
  ghRepo: string,
  publicDir: string,
  gallery: GalleryEntry[]
) {
  const areaExample = gallery.find((g) => g.id === 'area-between-curves');

  const lines: string[] = [
    '# GraphMaker Suite — AI Integration Guide',
    '',
    '> Publication-ready mathematical graphing, statistics, and discrete diagram generator (SVG & 300-DPI PNG) hosted statically on GitHub Pages.',
    `> Live site: ${baseUrl}`,
    `> Repository: https://github.com/${ghRepo}`,
    '',
    '## 1. Rendering Files Without a Browser (npx CLI — Zero Browser, Pure WebAssembly)',
    '',
    'GraphMaker Suite ships a prebuilt, zero-browser, pure-WebAssembly `npx` command-line renderer (`@resvg/resvg-wasm` + bundled Liberation fonts, zero native binaries to compile). Run it directly from GitHub with `npx -y` to render 300-DPI PNGs or MS-Word-safe SVGs right inside your workspace, inspect them, fix any issues, and hand the finished files to the user:',
    '',
    '```bash',
    '# Render a 300-DPI PNG directly from GitHub (non-interactive, works immediately):',
    `npx -y github:${ghRepo} --tool function-grapher --config payload.json --out graph.png --dpi 300`,
    '',
    '# Render an MS-Word-safe SVG (format is auto-inferred from --out extension):',
    `npx -y github:${ghRepo} --tool function-grapher --config payload.json --out graph.svg`,
    '',
    '# Pipe JSON from stdin:',
    `cat payload.json | npx -y github:${ghRepo} --tool function-grapher --out graph.png --dpi 300`,
    '',
    '# Generate an editable GitHub Pages deep link:',
    `npx -y github:${ghRepo} --tool function-grapher --config payload.json --format url`,
    '',
    '# List all 18 supported tool slugs:',
    `npx -y github:${ghRepo} --list`,
    '```',
    '',
    '- Accepts the exact same JSON payload as the deep-link URLs (via `--config <file-or-json>`, positional `<file.json>`, or `stdin`).',
    '- Validates strictly against the tool schema by default: prints clear warnings/errors to `stderr` and exits with code `2` on unknown fields, invalid integral IDs, or math syntax errors so you can self-correct.',
    '- **PNG font vs. SVG master copy**: Headless PNGs are rasterized with bundled **Liberation Serif** (metric-compatible open-source substitute for Times New Roman) and **Liberation Sans**, so PNGs work identically on Linux sandboxes without system fonts. The **SVG** specifies `Times New Roman` and is the master copy for Microsoft Word / print on Windows and macOS.',
    '- **`npx github:` cache & casing note**: `npx` caches GitHub packages by exact repository casing (`Thebubble333/GraphMaker02` vs `thebubble333/GraphMaker02`). Always use the canonical casing `npx -y github:Thebubble333/GraphMaker02`, and re-run with `-y` (or `--prefer-online` / clearing the npx cache if needed) after a new push to pick up CLI updates.',
    '',
    '## 2. Deep-Link URL Format (Works in Any Web AI Without Code Execution)',
    '',
    'Construct a clickable URL that opens any tool pre-populated with your JSON configuration:',
    '',
    `${baseUrl}?tool=<SLUG>&config=<URL_ENCODED_JSON>`,
    '',
    '- `tool`: one of the 18 slugs listed below (e.g. `function-grapher`, `inequality-grapher`, `box-plots`).',
    '- `config`: URL-encoded JSON matching the strict per-tool schema at `ai/<SLUG>.json` (or `b64:<base64url-json>` for large payloads).',
    '- Validation feedback: If a generated link contains unknown fields, broken integral IDs, or unparseable math syntax, the page displays an on-screen diagnostic banner with a "Copy report for AI" button so the user can paste the exact error back to you.',
    '',
    '## 3. Expression Syntax & Label Gotchas (`function-grapher` & `inequality-grapher`)',
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
    '- **Label & LaTeX gotchas**:',
    '  - `\\text{...}`, `\\ln`, and `\\mathrm{...}` are **not supported** by the custom math layout engine. Use `~` for spaces in point labels (e.g. `"y~=~x^2"`, `"(-2,~0)"`) and plain `ln(x)` instead of `\\ln(x)`. In axis titles (`config.axisLabels`), plain words outside `$...$` render upright and math inside `$...$` renders in math mode (e.g. `"Time ($t$)"`).',
    '  - **Point label placement**: `points[].label` always renders centered directly above `(x, y)` and does not accept a custom offset. To place a free-floating label anywhere on the graph, add a point with `"size": 0` and `"label": "..."` at the desired coordinates.',
    '  - **Origin "0" label**: `autoZeroLabel` is applied automatically in both browser and CLI (hiding `0` when the x-axis crosses strictly inside `yRange`, showing it when `yMin >= 0` or `yMax <= 0`). Override explicitly with `config.showZeroLabel`, `config.originLabelContent` (`"auto"`, `"0"`, `"O"`), and `config.originLabelOffset` (`{ "x": 0, "y": 0 }`).',
    '  - **Axis labels (`$x$`, `$y$`)**: The CLI automatically expands the SVG viewBox around `arrow-end` axis labels so `"x"` and `"y"` do not clip at the edges. You can also fine-tune their positions with `offsetXAxisLabelX`, `offsetXAxisLabelY`, `offsetYAxisLabelX`, and `offsetYAxisLabelY` in `config`.',
    '',
    '## 4. Complete Area-Between-Curves Example (`function-grapher`)',
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
    lines.push(
      `- Pre-rendered preview: PNG ${areaExample.pngUrl} | SVG ${areaExample.svgUrl} | Plain-text SVG ${areaExample.svgTxtUrl}`
    );
    lines.push('');
  }

  lines.push(
    '## 5. Per-Tool Strict Schemas (Small Files — Safe for Web Fetchers)',
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
    '## 6. Pre-Rendered Example Gallery (Includes `.svg.txt` for Text-Only Fetchers)',
    '',
    'Copy the closest verified payload below or inspect its `.png`, `.svg`, or plain-text `.svg.txt` copy:',
    `- Machine-readable gallery index: ${baseUrl}examples/index.json`,
    ''
  );

  for (const g of gallery) {
    lines.push(
      `- **${g.title}** (\`${g.tool}\`): payload ${g.payloadUrl} | PNG ${g.pngUrl} | SVG ${g.svgUrl} | Text SVG ${g.svgTxtUrl}`
    );
  }

  lines.push(
    '',
    '## 7. On-Demand Rendering via GitHub Actions (For AIs with GitHub Access Only)',
    '',
    'Repo collaborators (or issues labeled `render` by a collaborator) can trigger `.github/workflows/render-on-demand.yml` via `workflow_dispatch` or by labeling an issue containing a JSON code block `{ "tool": "<slug>", "payload": { ... } }`.',
    'The workflow validates the payload, renders `.png` (300 DPI), `.svg`, and `.svg.txt`, commits them to `public/renders/<tool>-<hash>.*`, and comments back permanent GitHub Pages URLs.',
    '',
    '## 8. Other Integration Options',
    '',
    '- **Local Desktop MCP Server** (Claude Desktop, Cursor, VS Code): Run `npx tsx mcp/server.ts` locally (`stdio` transport) for `list_math_tools`, `get_tool_schema`, `generate_graph_url`, `render_graph_svg`, and `render_graph_png`. See `AI_MCP_SETUP.md` in the repository.',
    '- **Browser Automation API**: On the live page, `window.GraphMakerAI` exposes `getTools()`, `openTool(slug, payload)`, `exportSVG({ widthCm })`, and `exportPNG({ widthCm, dpi })`.',
    ''
  );

  const output = lines.join('\n');
  if (output.includes('<SITE_URL>')) {
    throw new Error('Generated llms.txt still contains <SITE_URL> placeholder!');
  }

  await fs.writeFile(path.join(publicDir, 'llms.txt'), output, 'utf8');
}

async function main() {
  const rootDir = process.cwd();
  const publicDir = path.join(rootDir, 'public');
  const ghRepo = resolveGitHubRepo();
  const baseUrl = resolveSiteBaseUrl();

  console.log(`Generating AI assets for base URL: ${baseUrl} (repo: ${ghRepo})`);
  await generatePerToolSchemas(baseUrl, publicDir);
  console.log(`  - Wrote ${AI_TOOLS.length} strict per-tool schemas to public/ai/<slug>.json`);
  console.log('  - Wrote combined strict schema to public/ai-schema.json');

  const gallery = await generateExampleGallery(baseUrl, rootDir, publicDir);
  console.log(
    `  - Pre-rendered ${gallery.length} gallery examples (json + svg + svg.txt + 300-DPI png) to public/examples/`
  );

  await generateLlmsTxt(baseUrl, ghRepo, publicDir, gallery);
  console.log('  - Wrote public/llms.txt');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
