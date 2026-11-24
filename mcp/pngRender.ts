import { Resvg } from '@resvg/resvg-js';
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

/**
 * Rasterizes an SVG string into a crisp high-DPI PNG buffer with embedded pHYs metadata.
 */
export function renderSvgToPngBuffer(
  svg: string,
  options: { widthCm?: number; dpi?: number } = {}
): { buffer: Buffer; widthPx: number; heightPx: number; widthCm: number; heightCm: number; dpi: number } {
  const dpi = options.dpi && options.dpi > 0 ? Math.min(600, Math.max(72, options.dpi)) : 300;
  const dims = extractSvgDimensions(svg);
  const widthCm = options.widthCm && options.widthCm > 0 ? options.widthCm : 14;
  const heightCm = Number(((dims.height / dims.width) * widthCm).toFixed(2));
  const targetWidthPx = Math.max(100, Math.round((widthCm / 2.54) * dpi));

  // Ensure numeric viewBox width/height for Resvg (remove cm unit strings on root attributes)
  const resvgSvg = svg
    .replace(/^<svg\b([^>]*)>/, (full, attrs: string) => {
      let updated = attrs
        .replace(/\bwidth=["'][^"']*["']/, `width="${dims.width}"`)
        .replace(/\bheight=["'][^"']*["']/, `height="${dims.height}"`);
      if (!/\bwidth=/.test(updated)) updated += ` width="${dims.width}"`;
      if (!/\bheight=/.test(updated)) updated += ` height="${dims.height}"`;
      return `<svg${updated}>`;
    });

  const resvg = new Resvg(resvgSvg, {
    background: '#ffffff',
    fitTo: {
      mode: 'width',
      value: targetWidthPx
    },
    font: {
      loadSystemFonts: true,
      defaultFontFamily: 'Times New Roman'
    }
  });

  const rendered = resvg.render();
  const rawPng = Buffer.from(rendered.asPng());
  const enrichedPng = injectDpiIntoPngBuffer(rawPng, dpi);

  return {
    buffer: enrichedPng,
    widthPx: rendered.width,
    heightPx: rendered.height,
    widthCm,
    heightCm,
    dpi
  };
}
