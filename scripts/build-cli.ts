import fs from 'node:fs/promises';
import path from 'node:path';
import { build } from 'esbuild';

async function copyFonts(destFontsDir: string, rootDir: string) {
  await fs.mkdir(destFontsDir, { recursive: true });
  const srcFontsDir = path.join(rootDir, 'bin', 'fonts');
  const fontFiles = (await fs.readdir(srcFontsDir)).filter((f) => /\.(ttf|otf)$/i.test(f));
  for (const file of fontFiles) {
    await fs.copyFile(path.join(srcFontsDir, file), path.join(destFontsDir, file));
  }
}

async function main() {
  const rootDir = process.cwd();
  const binDir = path.join(rootDir, 'bin');
  const outBundle = path.join(binDir, 'graphmaker-render.cjs');
  const wasmSrc = path.join(rootDir, 'node_modules', '@resvg', 'resvg-wasm', 'index_bg.wasm');
  const wasmDest = path.join(binDir, 'resvg.wasm');

  await fs.mkdir(binDir, { recursive: true });

  await build({
    entryPoints: [path.join(rootDir, 'cli', 'render.ts')],
    outfile: outBundle,
    bundle: true,
    platform: 'node',
    target: 'node18',
    format: 'cjs',
    minify: true,
    banner: {
      js: '#!/usr/bin/env node'
    },
    define: {
      'process.env.NODE_ENV': '"production"'
    },
    logLevel: 'info'
  });

  await fs.chmod(outBundle, 0o755);
  await fs.copyFile(wasmSrc, wasmDest);

  // Also sync standalone zero-dependency npm package in packages/graphmaker-render/
  const pkgDir = path.join(rootDir, 'packages', 'graphmaker-render');
  const pkgBinDir = path.join(pkgDir, 'bin');
  await fs.mkdir(pkgBinDir, { recursive: true });
  await fs.copyFile(outBundle, path.join(pkgBinDir, 'graphmaker-render.cjs'));
  await fs.chmod(path.join(pkgBinDir, 'graphmaker-render.cjs'), 0o755);
  await fs.copyFile(wasmDest, path.join(pkgBinDir, 'resvg.wasm'));
  await copyFonts(path.join(pkgBinDir, 'fonts'), rootDir);

  const pkgJson = {
    name: 'graphmaker-render',
    version: '1.0.0',
    description:
      'Standalone headless CLI renderer for GraphMaker Suite (SVG, 300-DPI PNG via WebAssembly, and deep-link URLs). Zero browser or native binaries required.',
    license: 'MIT',
    bin: {
      'graphmaker-render': './bin/graphmaker-render.cjs'
    },
    files: ['bin', 'README.md'],
    engines: {
      node: '>=18'
    },
    keywords: ['math', 'graph', 'svg', 'png', 'latex', 'education', 'cli', 'mcp'],
    repository: {
      type: 'git',
      url: 'https://github.com/thebubble333/GraphMaker02.git'
    },
    homepage: 'https://thebubble333.github.io/GraphMaker02/'
  };

  await fs.writeFile(
    path.join(pkgDir, 'package.json'),
    JSON.stringify(pkgJson, null, 2) + '\n',
    'utf8'
  );

  const readme = `# graphmaker-render

Standalone headless CLI renderer for **GraphMaker Suite** (all 18 mathematical graphing, statistics, and discrete diagram tools).
Uses \`@resvg/resvg-wasm\` (pure WebAssembly + bundled Liberation fonts), so it runs anywhere Node.js 18+ runs with **zero browser and zero native binaries**.

## Quick Start

\`\`\`bash
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
\`\`\`

Payloads are strictly validated against each tool's schema; any unknown field or math syntax error is printed to \`stderr\` with exit code \`2\`.

Full schemas and examples: https://thebubble333.github.io/GraphMaker02/llms.txt
`;

  await fs.writeFile(path.join(pkgDir, 'README.md'), readme, 'utf8');

  const stat = await fs.stat(outBundle);
  console.log(
    `Built prebuilt CLI bundle: bin/graphmaker-render.cjs (${(stat.size / 1024).toFixed(0)} KB) + resvg.wasm + fonts`
  );
  console.log('Synced standalone publishable npm package: packages/graphmaker-render/');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
