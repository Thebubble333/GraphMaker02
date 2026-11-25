# Using GraphMaker Suite with AI (Zero Server Cost)

GraphMaker Suite stays **100% free and static on GitHub Pages** with **zero visible changes to the website UI**, while giving AI assistants five ways to create, validate, and render editable graphs, clean MS-Word SVGs, and 300-DPI PNGs across all 18 tools.

---

## 1. Prebuilt Standalone CLI Renderer (Best for AI Sandboxes — Zero Browser, Pure WebAssembly)

The repository ships a prebuilt, single-file Node.js CLI (`bin/graphmaker-render.cjs`) powered by `@resvg/resvg-wasm` and bundled Liberation fonts. There are **no native binaries to compile** and **no browser required**.

### Run Directly from GitHub (Works Immediately — No npm Release Needed)
```bash
npx -y github:thebubble333/GraphMaker02 --tool function-grapher --config payload.json --out graph.png --dpi 300
npx -y github:thebubble333/GraphMaker02 --tool function-grapher --config payload.json --out graph.svg
cat payload.json | npx -y github:thebubble333/GraphMaker02 --tool function-grapher --out graph.png
```

### Optional: Publish `graphmaker-render` to npm (Free)
A ready-to-publish, zero-dependency npm package is automatically generated in `packages/graphmaker-render/` whenever you run `npm run build:cli`:
```bash
cd packages/graphmaker-render
npm login
npm publish --access public
```
Once published, any AI with package installs enabled can run:
```bash
npx graphmaker-render --tool function-grapher --config payload.json --out graph.png --dpi 300
```

Payloads are strictly validated against each tool's schema by default — any unknown field, broken integral ID, or math syntax error prints clearly to `stderr` and exits with code `2` so the AI can immediately self-correct.

---

## 2. Web Chatbots via `/llms.txt`, `/ai/<tool>.json` & Pre-Rendered Gallery

Every push to `main` automatically runs `npm run generate:ai` and publishes:
- `https://thebubble333.github.io/GraphMaker02/llms.txt` — Compact guide with the live site URL, CLI commands, expression syntax, area-between-curves example, and gallery index.
- `https://thebubble333.github.io/GraphMaker02/ai/<tool-slug>.json` — 18 small, strict (`additionalProperties: false`) per-tool schemas.
- `https://thebubble333.github.io/GraphMaker02/examples/index.json` + `.json`, `.svg`, `.svg.txt` (plain-text copy for text-only fetchers), and 300-DPI `.png` previews.

If an AI-generated deep link ever contains a typo or invalid expression, the page displays a discreet warning banner with a **"Copy report for AI"** button. Normal visitors and valid deep links see nothing extra.

---

## 3. On-Demand Rendering via GitHub Actions (For AIs with GitHub Access Only)

If an AI can access GitHub but cannot run `npx`, use `.github/workflows/render-on-demand.yml`:
- **Manual run**: Go to **Actions → Render Graph On Demand → Run workflow**, paste the tool slug and JSON payload.
- **Issue trigger**: Open an issue containing a JSON code block (`{"tool": "function-grapher", "payload": {...}}`) and apply the `render` label (restricted to repository collaborators so strangers cannot spam renders).

The workflow validates the payload, renders `.png` (300 DPI), `.svg`, and `.svg.txt` to `public/renders/<tool>-<hash>.*`, commits them, and comments back the permanent links.

---

## 4. Local Serverless MCP Server (Claude Desktop, Cursor, VS Code)

Clone the repo locally, run `npm install`, and add to `claude_desktop_config.json` or `.cursor/mcp.json`:

```json
{
  "mcpServers": {
    "graph-maker-suite": {
      "command": "npx",
      "args": ["tsx", "/ABSOLUTE/PATH/TO/GraphMaker02/mcp/server.ts"],
      "env": {
        "GRAPH_MAKER_BASE_URL": "https://thebubble333.github.io/GraphMaker02/"
      }
    }
  }
}
```

---

## 5. Browser Automation Agents (`window.GraphMakerAI`)

```js
window.GraphMakerAI.getTools();
window.GraphMakerAI.openTool('box-plots', {
  boxPlots: [{ label: 'Sample A', min: 10, q1: 15, median: 22, q3: 28, max: 35 }]
});
const svg = window.GraphMakerAI.exportSVG({ widthCm: 14 });
const png = await window.GraphMakerAI.exportPNG({ widthCm: 14, dpi: 300 });
```
