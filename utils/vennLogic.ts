import { CM_TO_PX } from '../constants';
import { PatternType } from '../types';

export type VennShapeType = 'circle' | 'ellipse' | 'rectangle';
export type VennTopologyPreset =
  | 'standard'
  | 'disjoint'
  | 'subset-b-in-a'
  | 'subset-a-in-b'
  | 'chain'
  | 'nested-all'
  | 'subsets-in-a'
  | 'ab-overlap-c-disjoint';

export type InputMethod = 'regions' | 'totals' | 'elements' | 'twoway';

export interface VennSetDef {
  id: number; // 0 = A, 1 = B, 2 = C
  label: string;
  cx: number; // Relative to universal box center (or SVG coords)
  cy: number;
  rx: number; // Radius X (for circle/ellipse) or half-width (for rectangle)
  ry: number; // Radius Y (for circle/ellipse) or half-height (for rectangle)
  strokeStyle: 'solid' | 'dashed' | 'dotted';
  strokeWidth: number;
  labelOffset: { x: number; y: number };
  setFillShade: string; // 'none' or greyscale hex for whole-set overlay
  setFillPattern: PatternType;
  setFillOpacity: number;
}

export interface VennRegionDef {
  mask: number; // 0 to 7: bit 0 = A, bit 1 = B, bit 2 = C
  value: string;
  shaded: boolean;
  customShadeColor?: string;
  customPattern?: PatternType;
  isBlankBox: boolean;
  hidden: boolean;
  labelOffset: { x: number; y: number };
}

export type ValueDisplayMode = 'counts' | 'probabilities-decimal' | 'probabilities-fraction';
export type VennSizePreset = 'small' | 'medium' | 'large';

export interface VennState {
  numSets: 1 | 2 | 3;
  shapeType: VennShapeType;
  topology: VennTopologyPreset;
  valueDisplayMode: ValueDisplayMode;
  rectCornerRadius: number;
  sets: VennSetDef[];
  regions: Record<number, VennRegionDef>;
  // Universal set config
  showUniversalBox: boolean;
  universalSymbol: string;
  universalTotal: string;
  showUniversalTotal: boolean;
  universalLabelPos: 'inside-top-left' | 'outside-top-left' | 'outside-top-right' | 'none';
  universalLabelOffset: { x: number; y: number };
  // Title
  chartTitle: string;
  titleOffset: { x: number; y: number };
  // Global Shading Style
  globalShadeColor: string;
  globalShadePattern: PatternType;
  patternSpacing: number;
  patternStrokeWidth: number;
  // Typography & Display
  fontSize: number;
  setLabelFontSize: number;
  setLabelPosition: 'outside' | 'inside';
  showSetTotalsInLabels: boolean;
  showRegionNotationOnCanvas: boolean;
  outsideValueCorner: 'bottom-right' | 'bottom-left' | 'top-right';
  // Stroke
  universalBoxStrokeWidth: number;
  // Student / Exam Mode
  studentMode: boolean;
  studentModeAsBoxes: boolean;
  blankBoxWidth: number;
  blankBoxHeight: number;
  // Elements input state
  elementLists: {
    universal: string;
    setA: string;
    setB: string;
    setC: string;
    displayMode: 'elements' | 'counts';
    bulletPoints: boolean;
  };
  // Totals solver state
  totalsInput: {
    totalU: string;
    nA: string;
    nB: string;
    nC: string;
    nAB: string;
    nAC: string;
    nBC: string;
    nABC: string;
    nOutside: string;
    useOutsideInsteadOfU: boolean;
  };
  // Show companion 2-way table on canvas (for 2 sets)
  showCompanionTable: boolean;
  dimCm: { width: number; height: number };
}

export interface VennContextMenuState {
  x: number;
  y: number;
  targetType: 'title' | 'universal-label' | 'set-label' | 'set-shape' | 'region' | 'border';
  setId?: number;
  regionMask?: number;
}

export const VENN_SIZE_PRESETS: Record<
  VennSizePreset,
  {
    label: string;
    shortLabel: string;
    desc: string;
    widthCm: number;
    heightCm: number;
    fontSize: number;
    setLabelFontSize: number;
    blankBoxWidth: number;
    blankBoxHeight: number;
  }
> = {
  small: {
    label: 'Small (5.5 × 4.2 cm — MCQ)',
    shortLabel: 'Small (MCQ)',
    desc: 'Compact size ideal for multiple-choice options',
    widthCm: 5.5,
    heightCm: 4.2,
    fontSize: 10,
    setLabelFontSize: 11,
    blankBoxWidth: 26,
    blankBoxHeight: 18
  },
  medium: {
    label: 'Medium (8 × 6 cm — Default)',
    shortLabel: 'Medium (8×6)',
    desc: 'Standard exam and worksheet diagram size',
    widthCm: 8,
    heightCm: 6,
    fontSize: 11,
    setLabelFontSize: 12,
    blankBoxWidth: 30,
    blankBoxHeight: 20
  },
  large: {
    label: 'Large (12 × 8.5 cm)',
    shortLabel: 'Large (12×8.5)',
    desc: 'Spacious diagram for long element lists or board display',
    widthCm: 12,
    heightCm: 8.5,
    fontSize: 12,
    setLabelFontSize: 13,
    blankBoxWidth: 36,
    blankBoxHeight: 24
  }
};

export const GREYSCALE_SWATCHES = [
  { label: 'White', value: '#ffffff' },
  { label: 'Very Light Grey', value: '#f3f4f6' },
  { label: 'Light Grey', value: '#e5e7eb' },
  { label: 'Silver Grey', value: '#d1d5db' },
  { label: 'Medium Grey', value: '#9ca3af' },
  { label: 'Dark Grey', value: '#6b7280' },
  { label: 'Charcoal', value: '#374151' }
];

export const PATTERN_OPTIONS: { label: string; value: PatternType }[] = [
  { label: 'Solid Tone (No Hatch)', value: 'none' },
  { label: 'Diagonal Right (///)', value: 'stripes-right' },
  { label: 'Diagonal Left (\\\\\\)', value: 'stripes-left' },
  { label: 'Crosshatch (XXX)', value: 'crosshatch' },
  { label: 'Dots (...)', value: 'dots' },
  { label: 'Vertical Lines (|||)', value: 'vertical' },
  { label: 'Horizontal Lines (===)', value: 'horizontal' },
  { label: 'Grid (+++)', value: 'grid' }
];

export const INITIAL_REGIONS: Record<number, VennRegionDef> = {
  0: { mask: 0, value: '4', shaded: false, isBlankBox: false, hidden: false, labelOffset: { x: 0, y: 0 } },
  1: { mask: 1, value: '12', shaded: false, isBlankBox: false, hidden: false, labelOffset: { x: 0, y: 0 } },
  2: { mask: 2, value: '9', shaded: false, isBlankBox: false, hidden: false, labelOffset: { x: 0, y: 0 } },
  3: { mask: 3, value: '5', shaded: false, isBlankBox: false, hidden: false, labelOffset: { x: 0, y: 0 } },
  4: { mask: 4, value: '7', shaded: false, isBlankBox: false, hidden: false, labelOffset: { x: 0, y: 0 } },
  5: { mask: 5, value: '3', shaded: false, isBlankBox: false, hidden: false, labelOffset: { x: 0, y: 0 } },
  6: { mask: 6, value: '2', shaded: false, isBlankBox: false, hidden: false, labelOffset: { x: 0, y: 0 } },
  7: { mask: 7, value: '6', shaded: false, isBlankBox: false, hidden: false, labelOffset: { x: 0, y: 0 } }
};

export function getBoxGeometryForCm(
  widthCm: number,
  heightCm: number,
  hasTitle: boolean
) {
  const baseWidthPx = Math.round(widthCm * CM_TO_PX);
  const heightPixels = Math.round(heightCm * CM_TO_PX);
  const topPad = hasTitle ? 32 : 14;
  const bottomPad = 14;
  const leftPad = 18;
  const rightPad = 18;
  const w = Math.max(100, baseWidthPx - leftPad - rightPad);
  const h = Math.max(75, heightPixels - topPad - bottomPad);
  const x = leftPad;
  const y = topPad;
  const cx = x + w / 2;
  const cy = y + h / 2;
  return { x, y, w, h, cx, cy, baseWidthPx, heightPixels, topPad, bottomPad, leftPad, rightPad };
}

export function generatePresetSets(
  numSets: 1 | 2 | 3,
  shapeType: VennShapeType,
  topology: VennTopologyPreset,
  existingSets?: VennSetDef[],
  dimCm: { width: number; height: number } = { width: 8, height: 6 },
  hasTitle: boolean = true
): VennSetDef[] {
  const baseDefaults = (id: number, defaultLabel: string): VennSetDef => {
    const prev = existingSets?.find(s => s.id === id);
    return {
      id,
      label: prev?.label || defaultLabel,
      cx: 0,
      cy: 0,
      rx: 85,
      ry: 85,
      strokeStyle: prev?.strokeStyle || 'solid',
      strokeWidth: prev?.strokeWidth || 1.75,
      labelOffset: { x: 0, y: 0 },
      setFillShade: prev?.setFillShade || 'none',
      setFillPattern: prev?.setFillPattern || 'none',
      setFillOpacity: prev?.setFillOpacity ?? 0.35
    };
  };

  const sA = baseDefaults(0, 'A');
  const sB = baseDefaults(1, 'B');
  const sC = baseDefaults(2, 'C');

  const isRect = shapeType === 'rectangle';
  const isEllipse = shapeType === 'ellipse';

  if (numSets === 1) {
    sA.cx = 0;
    sA.cy = 0;
    sA.rx = isRect ? 115 : isEllipse ? 115 : 95;
    sA.ry = isRect ? 80 : isEllipse ? 75 : 95;
  } else if (numSets === 2) {
    if (topology === 'disjoint') {
      sA.cx = -95;
      sA.cy = isRect ? -14 : 0;
      sB.cx = 95;
      sB.cy = isRect ? 14 : 0;
      sA.rx = sB.rx = isRect ? 78 : isEllipse ? 82 : 76;
      sA.ry = sB.ry = isRect ? 66 : isEllipse ? 64 : 76;
    } else if (topology === 'subset-b-in-a') {
      sA.cx = -10;
      sA.cy = 0;
      sA.rx = isRect ? 135 : isEllipse ? 135 : 108;
      sA.ry = isRect ? 92 : isEllipse ? 88 : 108;
      sB.cx = 22;
      sB.cy = 12;
      sB.rx = isRect ? 65 : isEllipse ? 68 : 54;
      sB.ry = isRect ? 48 : isEllipse ? 46 : 54;
    } else if (topology === 'subset-a-in-b') {
      sB.cx = 10;
      sB.cy = 0;
      sB.rx = isRect ? 135 : isEllipse ? 135 : 108;
      sB.ry = isRect ? 92 : isEllipse ? 88 : 108;
      sA.cx = -22;
      sA.cy = 12;
      sA.rx = isRect ? 65 : isEllipse ? 68 : 54;
      sA.ry = isRect ? 48 : isEllipse ? 46 : 54;
    } else {
      sA.cx = -48;
      sA.cy = isRect ? -20 : 0;
      sB.cx = 48;
      sB.cy = isRect ? 20 : 0;
      sA.rx = sB.rx = isRect ? 96 : isEllipse ? 102 : 90;
      sA.ry = sB.ry = isRect ? 68 : isEllipse ? 74 : 90;
    }
  } else {
    if (topology === 'disjoint') {
      sA.cx = -115;
      sA.cy = -35;
      sB.cx = 115;
      sB.cy = -20;
      sC.cx = 0;
      sC.cy = 55;
      sA.rx = sB.rx = sC.rx = isRect ? 66 : 62;
      sA.ry = sB.ry = sC.ry = isRect ? 52 : 62;
    } else if (topology === 'chain') {
      sA.cx = -90;
      sA.cy = isRect ? -22 : 0;
      sB.cx = 0;
      sB.cy = 0;
      sC.cx = 90;
      sC.cy = isRect ? 22 : 0;
      sA.rx = sB.rx = sC.rx = isRect ? 72 : 68;
      sA.ry = sB.ry = sC.ry = isRect ? 58 : 68;
    } else if (topology === 'nested-all') {
      sA.cx = -15;
      sA.cy = 0;
      sA.rx = isRect ? 145 : 115;
      sA.ry = isRect ? 102 : 115;

      sB.cx = 5;
      sB.cy = 8;
      sB.rx = isRect ? 98 : 78;
      sB.ry = isRect ? 68 : 78;

      sC.cx = 22;
      sC.cy = 16;
      sC.rx = isRect ? 52 : 42;
      sC.ry = isRect ? 36 : 42;
    } else if (topology === 'subsets-in-a') {
      sA.cx = 0;
      sA.cy = 0;
      sA.rx = isRect ? 150 : 122;
      sA.ry = isRect ? 102 : 115;

      sB.cx = -36;
      sB.cy = isRect ? 2 : 10;
      sB.rx = isRect ? 64 : 56;
      sB.ry = isRect ? 50 : 56;

      sC.cx = 36;
      sC.cy = isRect ? 18 : 10;
      sC.rx = isRect ? 64 : 56;
      sC.ry = isRect ? 50 : 56;
    } else if (topology === 'ab-overlap-c-disjoint') {
      sA.cx = -82;
      sA.cy = isRect ? -18 : 0;
      sB.cx = -8;
      sB.cy = isRect ? 18 : 0;
      sC.cx = 108;
      sC.cy = 0;
      sA.rx = sB.rx = isRect ? 68 : 66;
      sA.ry = sB.ry = isRect ? 60 : 66;
      sC.rx = isRect ? 62 : 60;
      sC.ry = isRect ? 64 : 60;
    } else {
      if (isRect) {
        sA.cx = -48;
        sA.cy = -32;
        sA.rx = 88;
        sA.ry = 58;

        sB.cx = 46;
        sB.cy = -12;
        sB.rx = 88;
        sB.ry = 58;

        sC.cx = -6;
        sC.cy = 34;
        sC.rx = 88;
        sC.ry = 58;
      } else {
        sA.cx = -46;
        sA.cy = -30;
        sB.cx = 46;
        sB.cy = -30;
        sC.cx = 0;
        sC.cy = 44;
        sA.rx = sB.rx = sC.rx = isEllipse ? 86 : 78;
        sA.ry = sB.ry = sC.ry = isEllipse ? 72 : 78;
      }
    }
  }

  const rawSets = [sA, sB, sC];
  const box = getBoxGeometryForCm(dimCm.width, dimCm.height, hasTitle);
  const scaleFactor = Math.max(0.32, Math.min(1.8, Math.min(box.w / 380, box.h / 255)));

  return rawSets.map(s => ({
    ...s,
    cx: Math.round(s.cx * scaleFactor),
    cy: Math.round(s.cy * scaleFactor),
    rx: Math.max(14, Math.round(s.rx * scaleFactor)),
    ry: Math.max(14, Math.round((shapeType === 'circle' ? s.rx : s.ry) * scaleFactor))
  }));
}

export function gcd(a: number, b: number): number {
  let x = Math.abs(Math.round(a));
  let y = Math.abs(Math.round(b));
  while (y !== 0) {
    const t = y;
    y = x % y;
    x = t;
  }
  return x || 1;
}

export function formatAsSimplifiedFraction(numerator: number, denominator: number): string {
  if (denominator === 0) return '0';
  if (numerator === 0) return '0';
  if (numerator === denominator) return '1';
  if (Number.isInteger(numerator) && Number.isInteger(denominator)) {
    const d = gcd(numerator, denominator);
    const n = Math.round(numerator / d);
    const den = Math.round(denominator / d);
    return den === 1 ? `${n}` : `${n}/${den}`;
  }
  return String(Number((numerator / denominator).toFixed(2)));
}

export function signedDistToSet(
  px: number,
  py: number,
  set: VennSetDef,
  shapeType: VennShapeType
): number {
  const dx = px - set.cx;
  const dy = py - set.cy;
  if (shapeType === 'rectangle') {
    const inX = set.rx - Math.abs(dx);
    const inY = set.ry - Math.abs(dy);
    if (inX >= 0 && inY >= 0) {
      return Math.min(inX, inY);
    }
    const outX = Math.max(0, Math.abs(dx) - set.rx);
    const outY = Math.max(0, Math.abs(dy) - set.ry);
    return -Math.hypot(outX, outY);
  } else {
    const rx = Math.max(1, set.rx);
    const ry = shapeType === 'circle' ? rx : Math.max(1, set.ry);
    if (rx === ry) {
      return rx - Math.hypot(dx, dy);
    }
    const norm = Math.hypot(dx / rx, dy / ry);
    return (1 - norm) * Math.min(rx, ry);
  }
}

export function evaluateSetExpression(
  expr: string,
  mask: number,
  numSets: number,
  customLabels: string[]
): boolean | null {
  let s = expr.trim();
  if (!s) return null;

  const labelA = customLabels[0]?.trim() || 'A';
  const labelB = customLabels[1]?.trim() || 'B';
  const labelC = customLabels[2]?.trim() || 'C';

  s = s
    .replace(/\\cup/gi, '∪')
    .replace(/\\cap/gi, '∩')
    .replace(/\\setminus/gi, '\\')
    .replace(/\\triangle/gi, 'Δ')
    .replace(/\\oplus/gi, 'Δ')
    .replace(/\\xi|\\mathcal\{E\}|\\Omega/gi, 'U')
    .replace(/\\emptyset|\\varnothing/gi, '∅')
    .replace(/\bcup\b|\bor\b|\bunion\b/gi, '∪')
    .replace(/\bcap\b|\band\b|\bintersect\b/gi, '∩')
    .replace(/\bxor\b/gi, 'Δ')
    .replace(/\bnot\s+/gi, '~')
    .replace(/\^c\b|\^C\b/g, "'")
    .replace(/′|’|`/g, "'");

  type Tok =
    | { type: 'VAR'; val: boolean }
    | { type: 'LPAREN' }
    | { type: 'RPAREN' }
    | { type: 'NOT_PRE' }
    | { type: 'NOT_POST' }
    | { type: 'OP'; op: 'AND' | 'OR' | 'DIFF' | 'XOR' };

  const tokens: Tok[] = [];
  let i = 0;
  const inA = (mask & 1) !== 0;
  const inB = numSets >= 2 ? (mask & 2) !== 0 : false;
  const inC = numSets >= 3 ? (mask & 4) !== 0 : false;

  while (i < s.length) {
    const ch = s[i];
    if (/\s/.test(ch)) {
      i++;
      continue;
    }
    if (ch === '(' || ch === '[' || ch === '{') {
      tokens.push({ type: 'LPAREN' });
      i++;
    } else if (ch === ')' || ch === ']' || ch === '}') {
      tokens.push({ type: 'RPAREN' });
      i++;
    } else if (ch === "'") {
      tokens.push({ type: 'NOT_POST' });
      i++;
    } else if (ch === '~' || ch === '!' || ch === '¬') {
      tokens.push({ type: 'NOT_PRE' });
      i++;
    } else if (ch === '∪' || ch === '|' || ch === '+') {
      tokens.push({ type: 'OP', op: 'OR' });
      i++;
    } else if (ch === '∩' || ch === '&' || ch === '*' || ch === '·') {
      tokens.push({ type: 'OP', op: 'AND' });
      i++;
    } else if (ch === '\\' || ch === '-') {
      tokens.push({ type: 'OP', op: 'DIFF' });
      i++;
    } else if (ch === 'Δ' || ch === '⊕' || ch === '^') {
      tokens.push({ type: 'OP', op: 'XOR' });
      i++;
    } else if (ch === '∅' || ch === '0') {
      tokens.push({ type: 'VAR', val: false });
      i++;
    } else if (ch === 'U' || ch === 'ξ' || ch === 'ℰ' || ch === '1') {
      tokens.push({ type: 'VAR', val: true });
      i++;
    } else if (labelA.length === 1 && ch.toUpperCase() === labelA.toUpperCase()) {
      tokens.push({ type: 'VAR', val: inA });
      i++;
    } else if (labelB.length === 1 && ch.toUpperCase() === labelB.toUpperCase()) {
      tokens.push({ type: 'VAR', val: inB });
      i++;
    } else if (labelC.length === 1 && ch.toUpperCase() === labelC.toUpperCase()) {
      tokens.push({ type: 'VAR', val: inC });
      i++;
    } else if (ch.toUpperCase() === 'A') {
      tokens.push({ type: 'VAR', val: inA });
      i++;
    } else if (ch.toUpperCase() === 'B') {
      tokens.push({ type: 'VAR', val: inB });
      i++;
    } else if (ch.toUpperCase() === 'C') {
      tokens.push({ type: 'VAR', val: inC });
      i++;
    } else {
      return null;
    }
  }

  if (tokens.length === 0) return null;

  const expanded: Tok[] = [];
  for (let idx = 0; idx < tokens.length; idx++) {
    const curr = tokens[idx];
    expanded.push(curr);
    if (idx + 1 < tokens.length) {
      const next = tokens[idx + 1];
      const currEndsTerm =
        curr.type === 'VAR' || curr.type === 'RPAREN' || curr.type === 'NOT_POST';
      const nextStartsTerm =
        next.type === 'VAR' || next.type === 'LPAREN' || next.type === 'NOT_PRE';
      if (currEndsTerm && nextStartsTerm) {
        expanded.push({ type: 'OP', op: 'AND' });
      }
    }
  }

  let pos = 0;
  function parseExpr(): boolean | null {
    let left = parseTerm();
    if (left === null) return null;
    while (pos < expanded.length) {
      const tok = expanded[pos];
      if (tok.type === 'OP' && (tok.op === 'OR' || tok.op === 'DIFF' || tok.op === 'XOR')) {
        pos++;
        const right = parseTerm();
        if (right === null) return null;
        if (tok.op === 'OR') left = left || right;
        else if (tok.op === 'DIFF') left = left && !right;
        else if (tok.op === 'XOR') left = left !== right;
      } else {
        break;
      }
    }
    return left;
  }

  function parseTerm(): boolean | null {
    let left = parseUnary();
    if (left === null) return null;
    while (pos < expanded.length) {
      const tok = expanded[pos];
      if (tok.type === 'OP' && tok.op === 'AND') {
        pos++;
        const right = parseUnary();
        if (right === null) return null;
        left = left && right;
      } else {
        break;
      }
    }
    return left;
  }

  function parseUnary(): boolean | null {
    if (pos >= expanded.length) return null;
    if (expanded[pos].type === 'NOT_PRE') {
      pos++;
      const operand = parseUnary();
      if (operand === null) return null;
      return !operand;
    }
    let val = parsePrimary();
    if (val === null) return null;
    while (pos < expanded.length && expanded[pos].type === 'NOT_POST') {
      pos++;
      val = !val;
    }
    return val;
  }

  function parsePrimary(): boolean | null {
    if (pos >= expanded.length) return null;
    const tok = expanded[pos];
    if (tok.type === 'VAR') {
      pos++;
      return tok.val;
    }
    if (tok.type === 'LPAREN') {
      pos++;
      const inside = parseExpr();
      if (inside === null) return null;
      if (pos >= expanded.length || expanded[pos].type !== 'RPAREN') return null;
      pos++;
      return inside;
    }
    return null;
  }

  const res = parseExpr();
  if (pos !== expanded.length) return null;
  return res;
}

export function getRegionMetaForSets(numSets: 1 | 2 | 3, sets: VennSetDef[], mask: number) {
  const lA = sets[0]?.label || 'A';
  const lB = sets[1]?.label || 'B';
  const lC = sets[2]?.label || 'C';

  if (numSets === 1) {
    if (mask === 1) return { notation: `${lA}`, math: `${lA}`, desc: `Inside ${lA}` };
    return { notation: `${lA}'`, math: `${lA}'`, desc: `Outside ${lA}` };
  }

  if (numSets === 2) {
    switch (mask) {
      case 1:
        return { notation: `${lA} ∩ ${lB}'`, math: `${lA} \\cap ${lB}'`, desc: `Only ${lA}` };
      case 2:
        return { notation: `${lA}' ∩ ${lB}`, math: `${lA}' \\cap ${lB}`, desc: `Only ${lB}` };
      case 3:
        return { notation: `${lA} ∩ ${lB}`, math: `${lA} \\cap ${lB}`, desc: `Both ${lA} and ${lB}` };
      case 0:
      default:
        return {
          notation: `(${lA} ∪ ${lB})'`,
          math: `(${lA} \\cup ${lB})'`,
          desc: `Neither ${lA} nor ${lB}`
        };
    }
  }

  switch (mask) {
    case 1:
      return {
        notation: `${lA} ∩ ${lB}' ∩ ${lC}'`,
        math: `${lA} \\cap ${lB}' \\cap ${lC}'`,
        desc: `Only ${lA}`
      };
    case 2:
      return {
        notation: `${lA}' ∩ ${lB} ∩ ${lC}'`,
        math: `${lA}' \\cap ${lB} \\cap ${lC}'`,
        desc: `Only ${lB}`
      };
    case 4:
      return {
        notation: `${lA}' ∩ ${lB}' ∩ ${lC}`,
        math: `${lA}' \\cap ${lB}' \\cap ${lC}`,
        desc: `Only ${lC}`
      };
    case 3:
      return {
        notation: `${lA} ∩ ${lB} ∩ ${lC}'`,
        math: `${lA} \\cap ${lB} \\cap ${lC}'`,
        desc: `${lA} and ${lB} only`
      };
    case 5:
      return {
        notation: `${lA} ∩ ${lB}' ∩ ${lC}`,
        math: `${lA} \\cap ${lB}' \\cap ${lC}`,
        desc: `${lA} and ${lC} only`
      };
    case 6:
      return {
        notation: `${lA}' ∩ ${lB} ∩ ${lC}`,
        math: `${lA}' \\cap ${lB} \\cap ${lC}`,
        desc: `${lB} and ${lC} only`
      };
    case 7:
      return {
        notation: `${lA} ∩ ${lB} ∩ ${lC}`,
        math: `${lA} \\cap ${lB} \\cap ${lC}`,
        desc: `All three (${lA}, ${lB}, ${lC})`
      };
    case 0:
    default:
      return {
        notation: `(${lA} ∪ ${lB} ∪ ${lC})'`,
        math: `(${lA} \\cup ${lB} \\cup ${lC})'`,
        desc: `Outside all sets`
      };
  }
}

export function computeRegionCenters(
  boxGeometry: { w: number; h: number; cx: number; cy: number },
  activeSets: VennSetDef[],
  numSets: 1 | 2 | 3,
  shapeType: VennShapeType,
  outsideValueCorner: 'bottom-right' | 'bottom-left' | 'top-right',
  totalRegions: number
): Record<number, { x: number; y: number; exists: boolean }> {
  const centers: Record<number, { x: number; y: number; exists: boolean }> = {};
  const halfW = boxGeometry.w / 2;
  const halfH = boxGeometry.h / 2;

  const padX = Math.max(14, Math.min(24, Math.round(boxGeometry.w * 0.08)));
  const padY = Math.max(12, Math.min(20, Math.round(boxGeometry.h * 0.09)));
  let outX = halfW - padX;
  let outY = halfH - padY;
  if (outsideValueCorner === 'bottom-left') {
    outX = -halfW + padX;
    outY = halfH - padY;
  } else if (outsideValueCorner === 'top-right') {
    outX = halfW - padX;
    outY = -halfH + padY;
  }
  centers[0] = {
    x: boxGeometry.cx + outX,
    y: boxGeometry.cy + outY,
    exists: true
  };

  const steps = 68;
  const stepX = (halfW * 2) / steps;
  const stepY = (halfH * 2) / steps;

  for (let m = 1; m < totalRegions; m++) {
    let maxClearance = -Infinity;
    let bestX = 0;
    let bestY = 0;
    const samples: { x: number; y: number; c: number }[] = [];

    for (let ix = 1; ix < steps; ix++) {
      const px = -halfW + ix * stepX;
      const wallDistX = halfW - Math.abs(px);
      for (let iy = 1; iy < steps; iy++) {
        const py = -halfH + iy * stepY;
        const wallDistY = halfH - Math.abs(py);
        let minD = Math.min(wallDistX, wallDistY);

        for (let sIdx = 0; sIdx < numSets; sIdx++) {
          const set = activeSets[sIdx];
          const d = signedDistToSet(px, py, set, shapeType);
          const inSet = (m & (1 << sIdx)) !== 0;
          const signed = inSet ? d : -d;
          if (signed < minD) minD = signed;
          if (minD <= 0) break;
        }

        if (minD > 0) {
          samples.push({ x: px, y: py, c: minD });
          if (minD > maxClearance) {
            maxClearance = minD;
            bestX = px;
            bestY = py;
          }
        }
      }
    }

    if (maxClearance > 1.5 && samples.length > 0) {
      const threshold = maxClearance * 0.78;
      const maxDistSq = Math.pow(maxClearance * 1.6 + 15, 2);
      let sumX = 0;
      let sumY = 0;
      let weightSum = 0;

      for (const pt of samples) {
        if (pt.c >= threshold) {
          const dSq = (pt.x - bestX) * (pt.x - bestX) + (pt.y - bestY) * (pt.y - bestY);
          if (dSq <= maxDistSq) {
            const w = pt.c * pt.c;
            sumX += pt.x * w;
            sumY += pt.y * w;
            weightSum += w;
          }
        }
      }

      const avgX = weightSum > 0 ? sumX / weightSum : bestX;
      const avgY = weightSum > 0 ? sumY / weightSum : bestY;

      centers[m] = {
        x: boxGeometry.cx + avgX,
        y: boxGeometry.cy + avgY,
        exists: true
      };
    } else {
      centers[m] = {
        x: boxGeometry.cx,
        y: boxGeometry.cy,
        exists: false
      };
    }
  }

  return centers;
}

export function computeSetLabelAnchors(
  activeSets: VennSetDef[],
  boxCx: number,
  boxCy: number,
  numSets: 1 | 2 | 3,
  setLabelPosition: 'inside' | 'outside',
  shapeType: VennShapeType
): { x: number; y: number }[] {
  const avgCx = activeSets.reduce((acc, s) => acc + s.cx, 0) / activeSets.length;
  const avgCy = activeSets.reduce((acc, s) => acc + s.cy, 0) / activeSets.length;

  return activeSets.map((set, idx) => {
    const rx = set.rx;
    const ry = shapeType === 'circle' ? set.rx : set.ry;

    if (shapeType === 'rectangle') {
      if (setLabelPosition === 'inside') {
        const insetX = Math.max(11, Math.min(18, Math.round(rx * 0.25)));
        const insetY = Math.max(11, Math.min(18, Math.round(ry * 0.28)));
        const cornerX = idx === 1 ? set.cx + rx - insetX : set.cx - rx + insetX;
        const cornerY = idx === 2 && numSets === 3 ? set.cy + ry - insetY : set.cy - ry + insetY;
        return {
          x: boxCx + cornerX,
          y: boxCy + cornerY
        };
      } else {
        const cornerX = idx === 1 ? set.cx + rx - 10 : set.cx - rx + 10;
        const cornerY = idx === 2 && numSets === 3 ? set.cy + ry + 14 : set.cy - ry - 9;
        return {
          x: boxCx + cornerX,
          y: boxCy + cornerY
        };
      }
    }

    let angle = -Math.PI / 2;
    if (numSets === 2) {
      if (Math.abs(set.cx - avgCx) > 5) {
        angle = set.cx < avgCx ? -Math.PI * 0.72 : -Math.PI * 0.28;
      } else {
        angle = idx === 0 ? -Math.PI * 0.65 : -Math.PI * 0.35;
      }
    } else if (numSets === 3) {
      const dx = set.cx - avgCx;
      const dy = set.cy - avgCy;
      if (Math.hypot(dx, dy) > 8) {
        angle = Math.atan2(dy, dx);
      } else {
        angle = idx === 0 ? -Math.PI * 0.75 : idx === 1 ? -Math.PI * 0.25 : Math.PI * 0.5;
      }
    }

    const distFactor = setLabelPosition === 'inside' ? 0.74 : 1.16;
    const lx = set.cx + Math.cos(angle) * rx * distFactor;
    const ly = set.cy + Math.sin(angle) * ry * distFactor;

    return {
      x: boxCx + lx,
      y: boxCy + ly
    };
  });
}

export function computeVennTotals(
  regions: Record<number, VennRegionDef>,
  numSets: 1 | 2 | 3,
  totalRegions: number
) {
  const setSums = [0, 0, 0];
  const setAllNumeric = [true, true, true];
  let grandTotal = 0;
  let grandAllNumeric = true;

  for (let m = 0; m < totalRegions; m++) {
    const reg = regions[m];
    const raw = reg?.value?.trim() || '0';
    const num = Number(raw);
    const isNum = raw !== '' && !isNaN(num) && isFinite(num);

    if (isNum) {
      grandTotal += num;
    } else if (raw !== '') {
      grandAllNumeric = false;
    }

    for (let sIdx = 0; sIdx < numSets; sIdx++) {
      if ((m & (1 << sIdx)) !== 0) {
        if (isNum) {
          setSums[sIdx] += num;
        } else if (raw !== '') {
          setAllNumeric[sIdx] = false;
        }
      }
    }
  }

  return {
    setSums: setSums.map((sum, i) => (setAllNumeric[i] ? Number(sum.toFixed(4)) : null)),
    grandTotal: grandAllNumeric ? Number(grandTotal.toFixed(4)) : null
  };
}

export function getShadingPresets(numSets: 1 | 2 | 3): { label: string; expr: string }[] {
  if (numSets === 1) {
    return [
      { label: 'A', expr: 'A' },
      { label: "A'", expr: "A'" }
    ];
  }
  if (numSets === 2) {
    return [
      { label: 'A ∩ B', expr: 'A ∩ B' },
      { label: 'A ∪ B', expr: 'A ∪ B' },
      { label: "A ∩ B' (Only A)", expr: "A ∩ B'" },
      { label: "A' ∩ B (Only B)", expr: "A' ∩ B" },
      { label: "(A ∪ B)' (Neither)", expr: "(A ∪ B)'" },
      { label: "(A ∩ B)' (Not Both)", expr: "(A ∩ B)'" },
      { label: 'A Δ B (Exactly One)', expr: 'A Δ B' },
      { label: "A' (Not A)", expr: "A'" },
      { label: "A' ∪ B", expr: "A' ∪ B" }
    ];
  }
  return [
    { label: 'A ∩ B ∩ C', expr: 'A ∩ B ∩ C' },
    { label: 'A ∪ B ∪ C', expr: 'A ∪ B ∪ C' },
    { label: "(A ∪ B ∪ C)'", expr: "(A ∪ B ∪ C)'" },
    { label: 'A ∩ B', expr: 'A ∩ B' },
    { label: "A ∩ B ∩ C'", expr: "A ∩ B ∩ C'" },
    { label: "A ∩ (B ∪ C)' (Only A)", expr: "A ∩ (B ∪ C)'" },
    { label: '(A ∩ B) ∪ C', expr: '(A ∩ B) ∪ C' },
    { label: 'A ∩ (B ∪ C)', expr: 'A ∩ (B ∪ C)' },
    { label: "(A ∪ B) ∩ C'", expr: "(A ∪ B) ∩ C'" }
  ];
}

export const DEFAULT_STATE: VennState = {
  numSets: 2,
  shapeType: 'circle',
  topology: 'standard',
  valueDisplayMode: 'counts',
  rectCornerRadius: 0,
  sets: generatePresetSets(2, 'circle', 'standard', undefined, { width: 8, height: 6 }, true),
  regions: INITIAL_REGIONS,
  showUniversalBox: true,
  universalSymbol: 'U',
  universalTotal: '',
  showUniversalTotal: false,
  universalLabelPos: 'none',
  universalLabelOffset: { x: 0, y: 0 },
  chartTitle: 'Venn Diagram',
  titleOffset: { x: 0, y: 0 },
  globalShadeColor: '#d1d5db',
  globalShadePattern: 'none',
  patternSpacing: 8,
  patternStrokeWidth: 1.4,
  fontSize: 11,
  setLabelFontSize: 12,
  setLabelPosition: 'inside',
  showSetTotalsInLabels: false,
  showRegionNotationOnCanvas: false,
  outsideValueCorner: 'bottom-right',
  universalBoxStrokeWidth: 1.6,
  studentMode: false,
  studentModeAsBoxes: false,
  blankBoxWidth: 30,
  blankBoxHeight: 20,
  elementLists: {
    universal: '1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12',
    setA: '2, 4, 6, 8, 10, 12',
    setB: '3, 6, 9, 12',
    setC: '1, 2, 3, 4',
    displayMode: 'elements',
    bulletPoints: false
  },
  totalsInput: {
    totalU: '30',
    nA: '17',
    nB: '14',
    nC: '12',
    nAB: '5',
    nAC: '4',
    nBC: '3',
    nABC: '2',
    nOutside: '4',
    useOutsideInsteadOfU: false
  },
  showCompanionTable: false,
  dimCm: { width: 8, height: 6 }
};
