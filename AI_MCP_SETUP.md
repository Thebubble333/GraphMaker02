# Using GraphMaker Suite with AI & Local MCP (Zero Server Cost)

GraphMaker Suite stays **100% free and static on GitHub Pages** with **zero visible changes to the website UI**, while offering three invisible ways for AI assistants to create editable graphs, clean MS-Word SVGs, and 300-DPI PNGs across all 18 tools.

---

## 1. Web Chatbots (ChatGPT, Claude Web, Gemini) via Deep-Links & `/llms.txt`

Once deployed to GitHub Pages, your site automatically publishes:
- `https://<username>.github.io/<repo>/llms.txt` — compact AI instructions & examples for all 18 tools
- `https://<username>.github.io/<repo>/ai-schema.json` — machine-readable JSON Schema

Tell any web AI to read your `/llms.txt` URL (or paste its contents into a Custom GPT / Claude Project / Gemini Gem). The AI can then generate clickable links like:

```text
https://<username>.github.io/<repo>/?tool=function-grapher&config=%7B%22functions%22%3A%5B%7B%22expression%22%3A%22x%5E2-4%22%7D%5D%7D
```

Opening that link navigates straight to the tool pre-populated with the exact graph, ready to tweak or export.

---

## 2. Local Serverless MCP Server (Claude Desktop, Cursor, VS Code)

Because GitHub Pages cannot run a backend server, the repository includes a **local `stdio` MCP server** (`mcp/server.ts`) that runs on your own machine with zero hosting cost.

### Exposed MCP Tools
- `list_math_tools` — Lists all 18 Cartesian, statistical, and discrete diagram tools.
- `get_tool_schema` — Returns the exact JSON Schema and example for any tool.
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

## 3. Browser Automation Agents (`window.GraphMakerAI`)

When an AI browser agent visits the live GitHub Pages site, it can interact with the silent global controller:

```js
window.GraphMakerAI.getTools();
window.GraphMakerAI.openTool('box-plots', {
  boxPlots: [{ label: 'Sample A', min: 10, q1: 15, median: 22, q3: 28, max: 35 }]
});
const svg = window.GraphMakerAI.exportSVG({ widthCm: 14 });
const png = await window.GraphMakerAI.exportPNG({ widthCm: 14, dpi: 300 });
```
