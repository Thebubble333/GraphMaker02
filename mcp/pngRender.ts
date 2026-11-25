import fs from 'node:fs';
import path from 'node:path';
import { initWasm, Resvg } from '@resvg/resvg-wasm';
import { extractSvgDimensions } from '../utils/ai/svgSanitizer';

// Precomputed CRC32 table for PNG pHYs chunk injection
const crcTable: number[] = [];
for (let n = 0; n < 256; n++) {
  let c = n;
  for (let k = 0; k < 8; k++) {
    c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  }
  crcTable[n] = c;
}

function crc32(buf: Uint8Array): number {
  let crc = -1;
  for (let i = 0; i < buf.length; i++) {
    crc = (crc >>> 8) ^ crcTable[(crc ^ buf[i]) & 0xff];
  }
  return (crc ^ -1) >>> 0;
}

/**
 * Injects a pHYs (Physical Pixel Dimensions) chunk into a PNG Buffer so MS Word,
 * Google Docs, and print tools render the exact physical centimeter dimensions at 300 DPI.
 */
export function injectDpiIntoPngBuffer(pngBuffer: Buffer, dpi: number): Buffer {
  const u8 = new Uint8Array(pngBuffer.buffer, pngBuffer.byteOffset, pngBuffer.byteLength);
  if (
    u8.length < 8 ||
    u8[0] !== 0x89 ||
    u8[1] !== 0x50 ||
    u8[2] !== 0x4e ||
    u8[3] !== 0x47
  ) {
    return pngBuffer;
  }

  const dpm = Math.round(dpi / 0.0254);
  const physChunk = new Uint8Array(21);
  const physView = new DataView(physChunk.buffer);
  physView.setUint32(0, 9);
  physChunk.set([112, 72, 89, 115], 4); // "pHYs"
  physView.setUint32(8, dpm);
  physView.setUint32(12, dpm);
  physChunk[16] = 1; // meters
  physView.setUint32(17, crc32(physChunk.slice(4, 17)));

  const view = new DataView(u8.buffer, u8.byteOffset, u8.byteLength);
  const chunks: Uint8Array[] = [u8.slice(0, 8)];
  let offset = 8;

  while (offset + 8 <= u8.length) {
    const length = view.getUint32(offset);
    const type = String.fromCharCode(u8[offset + 4], u8[offset + 5], u8[offset + 6], u8[offset + 7]);
    const totalLen = length + 12;
    if (offset + totalLen > u8.length) break;

    if (type !== 'pHYs') {
      chunks.push(u8.slice(offset, offset + totalLen));
      if (type === 'IHDR') {
        chunks.push(physChunk);
      }
    }
    offset += totalLen;
  }

  return Buffer.concat(chunks);
}

let wasmInitPromise: Promise<void> | null = null;
let cachedFontBuffers: Uint8Array[] | null = null;

function getRuntimeBaseDir(): string {
  // Works both in bundled CJS (bin/graphmaker-render.cjs) and ESM/tsx runs
  if (typeof __dirname === 'string' && __dirname) {
    return __dirname;
  }
  if (process.argv[1]) {
    return path.dirname(path.resolve(process.argv[1]));
  }
  return process.cwd();
}

function findFirstExisting(candidates: string[]): string | null {
  for (const c of candidates) {
    try {
      if (fs.existsSync(c)) return c;
    } catch {
      // ignore
    }
  }
  return null;
}

function loadBundledFontBuffers(): Uint8Array[] {
  if (cachedFontBuffers) return cachedFontBuffers;

  const baseDir = getRuntimeBaseDir();
  const fontDir = findFirstExisting([
    path.join(baseDir, 'fonts'),
    path.join(baseDir, '..', 'bin', 'fonts'),
    path.join(process.cwd(), 'bin', 'fonts'),
    '/usr/share/fonts/truetype/liberation'
  ]);

  const buffers: Uint8Array[] = [];
  if (fontDir) {
    try {
      const files = fs
        .readdirSync(fontDir)
        .filter((f) => /\.(ttf|otf)$/i.test(f))
        .sort();
      for (const file of files) {
        const data = fs.readFileSync(path.join(fontDir, file));
        buffers.push(new Uint8Array(data.buffer, data.byteOffset, data.byteLength));
      }
    } catch {
      // fall through
    }
  }

  cachedFontBuffers = buffers;
  return buffers;
}

async function ensureResvgWasmInitialized(): Promise<void> {
  if (!wasmInitPromise) {
    wasmInitPromise = (async () => {
      const baseDir = getRuntimeBaseDir();
      const wasmPath = findFirstExisting([
        path.join(baseDir, 'resvg.wasm'),
        path.join(baseDir, '..', 'bin', 'resvg.wasm'),
        path.join(process.cwd(), 'bin', 'resvg.wasm'),
        path.join(baseDir, '..', 'node_modules', '@resvg', 'resvg-wasm', 'index_bg.wasm'),
        path.join(process.cwd(), 'node_modules', '@resvg', 'resvg-wasm', 'index_bg.wasm')
      ]);

      if (!wasmPath) {
        throw new Error(
          'Could not locate resvg.wasm. Run "npm run build:cli" or ensure @resvg/resvg-wasm is installed.'
        );
      }

      const wasmBytes = fs.readFileSync(wasmPath);
      await initWasm(wasmBytes);
    })();
  }
  return wasmInitPromise;
}

/**
 * Rasterizes an SVG string into a crisp high-DPI PNG buffer using pure WebAssembly
 * (@resvg/resvg-wasm) with embedded physical centimeter pHYs metadata.
 * Runs anywhere Node.js runs with zero native binaries to compile.
 */
export async function renderSvgToPngBuffer(
  svg: string,
  options: { widthCm?: number; dpi?: number } = {}
): Promise<{
  buffer: Buffer;
  widthPx: number;
  heightPx: number;
  widthCm: number;
  heightCm: number;
  dpi: number;
}> {
  await ensureResvgWasmInitialized();

  const dpi = options.dpi && options.dpi > 0 ? Math.min(600, Math.max(72, options.dpi)) : 300;
  const dims = extractSvgDimensions(svg);
  const widthCm = options.widthCm && options.widthCm > 0 ? options.widthCm : 14;
  const heightCm = Number(((dims.height / dims.width) * widthCm).toFixed(2));
  const targetWidthPx = Math.max(100, Math.round((widthCm / 2.54) * dpi));

  // Ensure numeric viewBox width/height for Resvg (remove cm unit strings on root attributes)
  // Also map Times New Roman / Arial font families to bundled Liberation equivalents for guaranteed crisp rendering
  const resvgSvg = svg
    .replace(/^<svg\b([^>]*)>/, (_full, attrs: string) => {
      let updated = attrs
        .replace(/\bwidth=["'][^"']*["']/, `width="${dims.width}"`)
        .replace(/\bheight=["'][^"']*["']/, `height="${dims.height}"`);
      if (!/\bwidth=/.test(updated)) updated += ` width="${dims.width}"`;
      if (!/\bheight=/.test(updated)) updated += ` height="${dims.height}"`;
      return `<svg${updated}>`;
    })
    .replace(/Times New Roman/g, 'Liberation Serif')
    .replace(/\bArial\b/g, 'Liberation Sans');

  const fontBuffers = loadBundledFontBuffers();

  const resvg = new Resvg(resvgSvg, {
    background: '#ffffff',
    fitTo: {
      mode: 'width',
      value: targetWidthPx
    },
    font: {
      fontBuffers,
      defaultFontFamily: 'Liberation Serif',
      serifFamily: 'Liberation Serif',
      sansSerifFamily: 'Liberation Sans',
      monospaceFamily: 'Liberation Serif'
    }
  });

  const rendered = resvg.render();
  const widthPx = rendered.width;
  const heightPx = rendered.height;
  const rawPng = Buffer.from(rendered.asPng());
  rendered.free();
  resvg.free();

  const enrichedPng = injectDpiIntoPngBuffer(rawPng, dpi);

  return {
    buffer: enrichedPng,
    widthPx,
    heightPx,
    widthCm,
    heightCm,
    dpi
  };
}
