/**
 * Isomorphic SVG Sanitizer for MS Word & Publication Compatibility.
 * Works identically in browser and Node.js (MCP server) without requiring DOM APIs.
 */

export interface SvgSanitizeOptions {
  widthCm?: number;
  heightCm?: number;
  svgId?: string;
}

const ZERO_LEN_PATH_RE =
  /^[Mm]\s*([\d.-]+)[,\s]+([\d.-]+)\s*(?:[Ll]\s*\1[,\s]+\2\s*)?[Zz]?\s*$/;

function extractBalancedSvg(raw: string, svgId?: string): string {
  let startIdx = -1;
  if (svgId) {
    const idRe = new RegExp(`<svg\\b[^>]*\\bid=["']${svgId}["']`, 'i');
    const m = idRe.exec(raw);
    if (m) startIdx = m.index;
  }
  if (startIdx === -1) {
    startIdx = raw.indexOf('<svg');
  }
  if (startIdx === -1) return raw.trim();

  const tagRe = /<\/?svg\b[^>]*>/gi;
  tagRe.lastIndex = startIdx;
  let depth = 0;
  let match: RegExpExecArray | null;
  while ((match = tagRe.exec(raw)) !== null) {
    const tag = match[0];
    if (tag.startsWith('</')) {
      depth--;
      if (depth === 0) {
        return raw.slice(startIdx, match.index + tag.length);
      }
    } else if (!tag.endsWith('/>')) {
      depth++;
    }
  }
  return raw.slice(startIdx).trim();
}

/**
 * Cleans serialized SVG markup:
 * - Extracts the single target <svg> element (ignoring any sibling interactive overlay SVGs)
 * - Ensures standard XML namespaces
 * - Strips zero-length <path> elements that render as stray dots in MS Word
 * - Strips transparent interactive hit-area primitives (<rect>/<circle>/<line>/<path> with fill/stroke="transparent")
 * - Applies explicit physical centimeter dimensions when requested
 */
export function sanitizeSvgMarkup(rawSvg: string, options: SvgSanitizeOptions = {}): string {
  let svg = extractBalancedSvg(rawSvg, options.svgId);

  // Ensure standard SVG namespaces
  if (!/^<svg[^>]+xmlns="http:\/\/www\.w3\.org\/2000\/svg"/.test(svg)) {
    svg = svg.replace(/^<svg/, '<svg xmlns="http://www.w3.org/2000/svg"');
  }
  if (!/^<svg[^>]+xmlns:xlink=/.test(svg)) {
    svg = svg.replace(/^<svg/, '<svg xmlns:xlink="http://www.w3.org/1999/xlink"');
  }

  // Remove interactive transparent hit-area elements (which MS Word renders as opaque black)
  svg = svg.replace(
    /<(rect|circle|line|path|ellipse|polygon)\b[^>]*\b(?:fill|stroke)=["']transparent["'][^>]*\/?>(?:<\/\1>)?/gi,
    ''
  );

  // Remove React's rgba(255,255,255,0.001) invisible click hitboxes
  svg = svg.replace(
    /<rect\b[^>]*fill=["']rgba\(255,\s*255,\s*255,\s*0\.001\)["'][^>]*\/?>(?:<\/rect>)?/gi,
    ''
  );

  // Remove empty or zero-length <path> elements
  svg = svg.replace(/<path\b([^>]*)\/?>(?:<\/path>)?/gi, (match, attrs: string) => {
    const dMatch = attrs.match(/\bd=["']([^"']*)["']/i);
    if (!dMatch) return '';
    const d = dMatch[1].trim();
    if (!d || ZERO_LEN_PATH_RE.test(d)) {
      return '';
    }
    return match;
  });

  // Apply explicit physical centimeter dimensions on the root <svg> if requested
  if (options.widthCm && options.widthCm > 0) {
    svg = svg.replace(/^<svg\b([^>]*)>/, (full, attrs: string) => {
      if (/\bwidth=["'][^"']*["']/.test(attrs)) {
        return `<svg${attrs.replace(/\bwidth=["'][^"']*["']/, `width="${options.widthCm}cm"`)}>`;
      }
      return `<svg${attrs} width="${options.widthCm}cm">`;
    });
  }

  if (options.heightCm && options.heightCm > 0) {
    svg = svg.replace(/^<svg\b([^>]*)>/, (full, attrs: string) => {
      if (/\bheight=["'][^"']*["']/.test(attrs)) {
        return `<svg${attrs.replace(/\bheight=["'][^"']*["']/, `height="${options.heightCm}cm"`)}>`;
      }
      return `<svg${attrs} height="${options.heightCm}cm">`;
    });
  }

  return svg;
}

/**
 * Extracts numeric viewBox dimensions from an SVG string.
 */
export function extractSvgDimensions(svg: string): {
  x: number;
  y: number;
  width: number;
  height: number;
} {
  const vbMatch = svg.match(/\bviewBox=["']\s*([\d.-]+)\s+([\d.-]+)\s+([\d.-]+)\s+([\d.-]+)\s*["']/i);
  if (vbMatch) {
    const x = parseFloat(vbMatch[1]);
    const y = parseFloat(vbMatch[2]);
    const width = parseFloat(vbMatch[3]);
    const height = parseFloat(vbMatch[4]);
    if (isFinite(width) && isFinite(height) && width > 0 && height > 0) {
      return { x, y, width, height };
    }
  }
  const wMatch = svg.match(/\bwidth=["']([\d.]+)/i);
  const hMatch = svg.match(/\bheight=["']([\d.]+)/i);
  return {
    x: 0,
    y: 0,
    width: wMatch ? parseFloat(wMatch[1]) || 500 : 500,
    height: hMatch ? parseFloat(hMatch[1]) || 400 : 400
  };
}
