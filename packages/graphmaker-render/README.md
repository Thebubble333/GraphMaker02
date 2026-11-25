# graphmaker-render

Standalone headless CLI renderer for **GraphMaker Suite** (all 18 mathematical graphing, statistics, and discrete diagram tools).
Uses `@resvg/resvg-wasm` (pure WebAssembly + bundled Liberation fonts), so it runs anywhere Node.js 18+ runs with **zero browser and zero native binaries**.

## Quick Start

```bash
# Render a 300-DPI PNG from a JSON payload file
npx graphmaker-render --tool function-grapher --config payload.json --out graph.png --dpi 300

# Render a clean MS-Word-safe SVG
npx graphmaker-render --tool function-grapher --config payload.json --out graph.svg

# Pipe JSON via stdin
cat payload.json | npx graphmaker-render --tool function-grapher --out graph.png

# Generate an editable GitHub Pages deep link
npx graphmaker-render --tool function-grapher --config payload.json --format url

# List all 18 tool slugs
npx graphmaker-render --list
```

Payloads are strictly validated against each tool's schema; any unknown field or math syntax error is printed to `stderr` with exit code `2`.

Full schemas and examples: https://thebubble333.github.io/GraphMaker02/llms.txt
