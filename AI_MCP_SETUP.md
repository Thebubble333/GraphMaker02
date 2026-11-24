# Using GraphMaker Suite with AI (Zero Server Cost)

GraphMaker Suite stays **100% free and static on GitHub Pages** with **zero visible changes to the website UI**, while giving AI assistants four complementary ways to create, validate, and render editable graphs, clean MS-Word SVGs, and 300-DPI PNGs across all 18 tools.

---

## 1. Web Chatbots (ChatGPT, Claude Web, Gemini) via `/llms.txt`, `/ai/<tool>.json` & Pre-Rendered Gallery

Every push to `main` runs a free GitHub Action (`npm run generate:ai`) that publishes:
- `/llms.txt` — Compact guide with the real site URL, expression syntax, area-between-curves example, and gallery index.
- `/ai/<tool-slug>.json` — 18 small, strict (`additionalProperties: false`) per-tool schemas so web summarizers never truncate them.
- `/ai-schema.json` — Combined strict JSON Schema for all 18 tools.
- `/examples/index.json` + `/examples/<name>.{json,svg,png}` — Pre-rendered gallery of verified payloads, SVGs, 300-DPI PNGs, and clickable deep links.

Tell any web AI to read your `/llms.txt` URL. It can copy the closest verified example from `/examples/`, adjust the payload, and return a clickable deep link like:

```text
https://mccombe.github.io/GraphMaker02/?tool=function-grapher&config=%7B...%7D
```

If an AI-generated link ever contains a typo, unknown field, or unparseable math expression, the page shows a discreet warning banner with a **"Copy report for AI"** button so you can paste the exact error and axis config straight back into chat. (Normal visitors and valid deep links see nothing extra.)

---

## 2. Standalone Headless CLI Renderer (Zero Browser Required — Great for AI Code Sandboxes)

An AI with terminal/code execution (or you locally) can validate and render SVGs or 300-DPI PNGs directly in plain Node.js using `@resvg/resvg-js` — no browser or hosted server needed:

```bash
# Validate and render an SVG to stdout
npx tsx cli/render.ts examples/area-between-curves.json --validate --format svg > graph.svg

# Render a 300-DPI PNG to disk
npx tsx cli/render.ts examples/area-between-curves.json --validate --format png --out graph.png

# Generate a clickable GitHub Pages deep link
npx tsx cli/render.ts examples/area-between-curves.json --format url

# Or pipe inline JSON via stdin
echo '{"functions":[{"expression":"sin(x)"}],"config":{"piXAxis":true,"xRange":[-6.283,6.283]}}' \
  | npm run render -- --tool function-grapher --validate --format svg > sine.svg
```

Exit code `2` is returned when `--validate` detects unknown fields, missing required keys, broken integral function IDs, or math syntax errors.

---

## 3. Local Serverless MCP Server (Claude Desktop, Cursor, VS Code)

For desktop AI clients that support Model Context Protocol, the repository includes a local `stdio` MCP server (`mcp/server.ts`) with zero hosting cost.

### Exposed MCP Tools
- `list_math_tools` — Lists all 18 Cartesian, statistical, and discrete diagram tools.
- `get_tool_schema` — Returns the exact strict JSON Schema and example for any tool.
- `generate_graph_url` — Returns a clickable, pre-populated GitHub Pages URL.
- `render_graph_svg` — Renders a publication-ready, MS-Word-safe `.svg` headlessly (and optionally saves it to disk).
- `render_graph_png` — Renders a crisp **300-DPI `.png`** with embedded physical centimeter dimensions (`pHYs`), returns it inline in chat, and optionally saves it to disk.

### Setup for Claude Desktop (`claude_desktop_config.json`) or Cursor (`.cursor/mcp.json`)

1. Clone this repository locally and install dependencies once:
   ```bash
   git clone https://github.com/<your-username>/<your-repo>.git
   cd <your-repo>
   npm install
   ```
2. Add the MCP server to your AI client configuration:
   ```json
   {
     "mcpServers": {
       "graph-maker-suite": {
         "command": "npx",
         "args": ["tsx", "/ABSOLUTE/PATH/TO/YOUR/REPO/mcp/server.ts"],
         "env": {
           "GRAPH_MAKER_BASE_URL": "https://<your-username>.github.io/<your-repo>/"
         }
       }
     }
   }
   ```
   *(You can also test it directly from your terminal with `npm run mcp`.)*

---

## 4. Browser Automation Agents (`window.GraphMakerAI`)

When an AI browser agent visits the live GitHub Pages site, it can interact with the silent global controller:

```js
window.GraphMakerAI.getTools();
window.GraphMakerAI.openTool('box-plots', {
  boxPlots: [{ label: 'Sample A', min: 10, q1: 15, median: 22, q3: 28, max: 35 }]
});
const svg = window.GraphMakerAI.exportSVG({ widthCm: 14 });
const png = await window.GraphMakerAI.exportPNG({ widthCm: 14, dpi: 300 });
```
