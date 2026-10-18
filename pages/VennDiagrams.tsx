import React, { useState, useMemo, useCallback } from 'react';
import {
  CircleDot,
  Square,
  List,
  Sliders,
  Palette,
  MousePointer,
  PaintBucket,
  Calculator,
  Grid,
  Check,
  AlertCircle,
  RotateCcw,
  Eye,
  EyeOff,
  HelpCircle,
  Sparkles,
  Layers,
  MoveHorizontal,
  MoveVertical,
  Maximize2,
  Minimize2,
  Plus,
  Minus
} from 'lucide-react';
import { CM_TO_PX } from '../constants';
import { PatternType } from '../types';
import { TexEngine } from '../utils/textRenderer';
import { ptToSvgUnits } from '../utils/imageExport';
import { GraphToolbar } from '../components/GraphToolbar';
import { useGraphInteraction } from '../hooks/useGraphInteraction';
import { useDragSystem } from '../hooks/useDragSystem';
import { useHistory } from '../hooks/useHistory';

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

interface VennState {
  numSets: 1 | 2 | 3;
  shapeType: VennShapeType;
  topology: VennTopologyPreset;
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

const GREYSCALE_SWATCHES = [
  { label: 'White', value: '#ffffff' },
  { label: 'Very Light Grey', value: '#f3f4f6' },
  { label: 'Light Grey', value: '#e5e7eb' },
  { label: 'Silver Grey', value: '#d1d5db' },
  { label: 'Medium Grey', value: '#9ca3af' },
  { label: 'Dark Grey', value: '#6b7280' },
  { label: 'Charcoal', value: '#374151' }
];

const PATTERN_OPTIONS: { label: string; value: PatternType }[] = [
  { label: 'Solid Tone (No Hatch)', value: 'none' },
  { label: 'Diagonal Right (///)', value: 'stripes-right' },
  { label: 'Diagonal Left (\\\\\\)', value: 'stripes-left' },
  { label: 'Crosshatch (XXX)', value: 'crosshatch' },
  { label: 'Dots (...)', value: 'dots' },
  { label: 'Vertical Lines (|||)', value: 'vertical' },
  { label: 'Horizontal Lines (===)', value: 'horizontal' },
  { label: 'Grid (+++)', value: 'grid' }
];

// Generate default geometry for sets inside a universal box centered at (0, 0) with half-dims (uRx, uRy)
function generatePresetSets(
  numSets: 1 | 2 | 3,
  shapeType: VennShapeType,
  topology: VennTopologyPreset,
  existingSets?: VennSetDef[]
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
    return [sA, sB, sC];
  }

  if (numSets === 2) {
    if (topology === 'disjoint') {
      sA.cx = -95;
      sA.cy = 0;
      sB.cx = 95;
      sB.cy = 0;
      sA.rx = sB.rx = isRect ? 78 : isEllipse ? 82 : 76;
      sA.ry = sB.ry = isRect ? 72 : isEllipse ? 64 : 76;
    } else if (topology === 'subset-b-in-a') {
      sA.cx = -10;
      sA.cy = 0;
      sA.rx = isRect ? 135 : isEllipse ? 135 : 108;
      sA.ry = isRect ? 92 : isEllipse ? 88 : 108;
      sB.cx = 22;
      sB.cy = 8;
      sB.rx = isRect ? 65 : isEllipse ? 68 : 54;
      sB.ry = isRect ? 48 : isEllipse ? 46 : 54;
    } else if (topology === 'subset-a-in-b') {
      sB.cx = 10;
      sB.cy = 0;
      sB.rx = isRect ? 135 : isEllipse ? 135 : 108;
      sB.ry = isRect ? 92 : isEllipse ? 88 : 108;
      sA.cx = -22;
      sA.cy = 8;
      sA.rx = isRect ? 65 : isEllipse ? 68 : 54;
      sA.ry = isRect ? 48 : isEllipse ? 46 : 54;
    } else {
      // Standard overlapping 2 sets
      sA.cx = -52;
      sA.cy = 0;
      sB.cx = 52;
      sB.cy = 0;
      sA.rx = sB.rx = isRect ? 96 : isEllipse ? 102 : 90;
      sA.ry = sB.ry = isRect ? 76 : isEllipse ? 74 : 90;
    }
    return [sA, sB, sC];
  }

  // 3 Sets
  if (topology === 'disjoint') {
    sA.cx = -115;
    sA.cy = -35;
    sB.cx = 115;
    sB.cy = -35;
    sC.cx = 0;
    sC.cy = 55;
    sA.rx = sB.rx = sC.rx = isRect ? 66 : 62;
    sA.ry = sB.ry = sC.ry = isRect ? 54 : 62;
  } else if (topology === 'chain') {
    sA.cx = -92;
    sA.cy = 0;
    sB.cx = 0;
    sB.cy = 0;
    sC.cx = 92;
    sC.cy = 0;
    sA.rx = sB.rx = sC.rx = isRect ? 72 : 68;
    sA.ry = sB.ry = sC.ry = isRect ? 68 : 68;
  } else if (topology === 'nested-all') {
    sA.cx = -15;
    sA.cy = 0;
    sA.rx = isRect ? 145 : 115;
    sA.ry = isRect ? 102 : 115;

    sB.cx = 5;
    sB.cy = 5;
    sB.rx = isRect ? 98 : 78;
    sB.ry = isRect ? 68 : 78;

    sC.cx = 22;
    sC.cy = 10;
    sC.rx = isRect ? 52 : 42;
    sC.ry = isRect ? 36 : 42;
  } else if (topology === 'subsets-in-a') {
    sA.cx = 0;
    sA.cy = 0;
    sA.rx = isRect ? 150 : 122;
    sA.ry = isRect ? 102 : 115;

    sB.cx = -36;
    sB.cy = 10;
    sB.rx = isRect ? 64 : 56;
    sB.ry = isRect ? 52 : 56;

    sC.cx = 36;
    sC.cy = 10;
    sC.rx = isRect ? 64 : 56;
    sC.ry = isRect ? 52 : 56;
  } else if (topology === 'ab-overlap-c-disjoint') {
    sA.cx = -82;
    sA.cy = 0;
    sB.cx = -8;
    sB.cy = 0;
    sC.cx = 108;
    sC.cy = 0;
    sA.rx = sB.rx = isRect ? 68 : 66;
    sA.ry = sB.ry = isRect ? 68 : 66;
    sC.rx = isRect ? 62 : 60;
    sC.ry = isRect ? 68 : 60;
  } else {
    // Standard 3-way overlapping
    if (isRect) {
      // Clean rectangular 3-set arrangement where all 8 regions are clearly open and legible
      sA.cx = -46;
      sA.cy = -28;
      sA.rx = 88;
      sA.ry = 64;

      sB.cx = 46;
      sB.cy = -28;
      sB.rx = 88;
      sB.ry = 64;

      sC.cx = 0;
      sC.cy = 34;
      sC.rx = 88;
      sC.ry = 64;
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

  return [sA, sB, sC];
}

const INITIAL_REGIONS: Record<number, VennRegionDef> = {
  0: { mask: 0, value: '4', shaded: false, isBlankBox: false, hidden: false, labelOffset: { x: 0, y: 0 } },
  1: { mask: 1, value: '12', shaded: false, isBlankBox: false, hidden: false, labelOffset: { x: 0, y: 0 } },
  2: { mask: 2, value: '9', shaded: false, isBlankBox: false, hidden: false, labelOffset: { x: 0, y: 0 } },
  3: { mask: 3, value: '5', shaded: false, isBlankBox: false, hidden: false, labelOffset: { x: 0, y: 0 } },
  4: { mask: 4, value: '7', shaded: false, isBlankBox: false, hidden: false, labelOffset: { x: 0, y: 0 } },
  5: { mask: 5, value: '3', shaded: false, isBlankBox: false, hidden: false, labelOffset: { x: 0, y: 0 } },
  6: { mask: 6, value: '2', shaded: false, isBlankBox: false, hidden: false, labelOffset: { x: 0, y: 0 } },
  7: { mask: 7, value: '6', shaded: false, isBlankBox: false, hidden: false, labelOffset: { x: 0, y: 0 } }
};

// Signed distance from point (px, py) (in box-centered coords) to a set boundary.
// Positive = strictly inside, Negative = strictly outside.
function signedDistToSet(px: number, py: number, set: VennSetDef, shapeType: VennShapeType): number {
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

// Evaluate a set notation expression for a given region mask (bit 0 = A, bit 1 = B, bit 2 = C)
function evaluateSetExpression(
  expr: string,
  mask: number,
  numSets: number,
  customLabels: string[]
): boolean | null {
  let s = expr.trim();
  if (!s) return null;

  // Normalize custom single-letter labels or standard A, B, C
  const labelA = customLabels[0]?.trim() || 'A';
  const labelB = customLabels[1]?.trim() || 'B';
  const labelC = customLabels[2]?.trim() || 'C';

  // Normalize LaTeX and unicode operators
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

  // Tokenize
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
      return null; // Unrecognized character
    }
  }

  if (tokens.length === 0) return null;

  // Insert implicit AND between adjacent operands, e.g., AB, A'B, (A∪B)(B∪C), A(B∪C)
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

const DEFAULT_STATE: VennState = {
  numSets: 2,
  shapeType: 'circle',
  topology: 'standard',
  rectCornerRadius: 0,
  sets: generatePresetSets(2, 'circle', 'standard'),
  regions: INITIAL_REGIONS,
  showUniversalBox: true,
  universalSymbol: 'U',
  universalTotal: '',
  showUniversalTotal: false,
  universalLabelPos: 'none',
  universalLabelOffset: { x: 0, y: 0 },
  chartTitle: '',
  titleOffset: { x: 0, y: 0 },
  globalShadeColor: '#d1d5db',
  globalShadePattern: 'none',
  patternSpacing: 8,
  patternStrokeWidth: 1.4,
  fontSize: 12,
  setLabelFontSize: 13,
  setLabelPosition: 'inside',
  showSetTotalsInLabels: false,
  showRegionNotationOnCanvas: false,
  outsideValueCorner: 'bottom-right',
  universalBoxStrokeWidth: 1.75,
  studentMode: false,
  studentModeAsBoxes: false,
  blankBoxWidth: 34,
  blankBoxHeight: 24,
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
  dimCm: { width: 14, height: 10 }
};

const VennDiagrams: React.FC = () => {
  const [state, setState] = useState<VennState>(DEFAULT_STATE);
  const [activeTab, setActiveTab] = useState<'data' | 'shading' | 'style'>('data');
  const [inputMethod, setInputMethod] = useState<InputMethod>('regions');
  const [canvasTool, setCanvasTool] = useState<'manipulate' | 'shade'>('manipulate');
  const [setExpressionInput, setSetExpressionInput] = useState<string>('A ∩ B');
  const [expressionError, setExpressionError] = useState<string | null>(null);
  const [solverMessage, setSolverMessage] = useState<{ type: 'ok' | 'warn'; text: string } | null>(null);
  const [selectedSetId, setSelectedSetId] = useState<number | 'all'>('all');

  const texEngine = useMemo(() => new TexEngine(), []);

  // History & Persistence
  const {
    forceSnapshot,
    undo,
    redo,
    canUndo,
    canRedo,
    exportToFile,
    importFromFile
  } = useHistory<VennState>({
    appId: 'VennDiagrams',
    version: 2,
    currentState: state,
    onRestore: (restored) => {
      const normalizedSym =
        restored.universalSymbol === '\\xi'
          ? 'ξ'
          : restored.universalSymbol === '\\mathcal{E}'
          ? 'ℰ'
          : restored.universalSymbol === '\\Omega'
          ? 'Ω'
          : restored.universalSymbol || 'U';
      setState({ ...DEFAULT_STATE, ...restored, universalSymbol: normalizedSym });
    }
  });

  const updateState = useCallback((updater: (prev: VennState) => VennState) => {
    setState(prev => updater(prev));
  }, []);

  // Canvas dimensions in pixels
  const companionTableWidth = state.numSets === 2 && state.showCompanionTable ? 230 : 0;
  const baseWidthPx = Math.round(state.dimCm.width * CM_TO_PX);
  const widthPixels = baseWidthPx + companionTableWidth;
  const heightPixels = Math.round(state.dimCm.height * CM_TO_PX);

  // Universal box bounds in SVG coordinates
  const boxGeometry = useMemo(() => {
    const topPad = state.chartTitle ? 54 : 36;
    const bottomPad = 28;
    const leftPad = 42;
    const rightPad = 28;
    const w = Math.max(160, baseWidthPx - leftPad - rightPad);
    const h = Math.max(120, heightPixels - topPad - bottomPad);
    const x = leftPad;
    const y = topPad;
    const cx = x + w / 2;
    const cy = y + h / 2;
    return { x, y, w, h, cx, cy };
  }, [baseWidthPx, heightPixels, state.chartTitle]);

  // Unified Zoom / Crop / Export Hook
  const {
    previewScale,
    setPreviewScale,
    exportDpi,
    setExportDpi,
    cropMode,
    setCropMode,
    selectionBox,
    customViewBox,
    containerRef,
    handleAutoCrop,
    handleResetView,
    handleZoomOutCanvas,
    handleFitToScreen,
    handleExportPNG,
    handleExportSVG,
    handleCopy,
    isCopied,
    handleCropMouseDown,
    handleCropMouseMove,
    handleCropMouseUp
  } = useGraphInteraction(
    'venn-svg',
    widthPixels,
    heightPixels,
    state.dimCm.width + (companionTableWidth / CM_TO_PX),
    false,
    false,
    18
  );

  const { onMouseDown, onMouseMove, onMouseUp } = useDragSystem(previewScale);

  const handleGlobalMouseMove = (e: React.MouseEvent) => {
    if (handleCropMouseMove(e)) return;
    onMouseMove(e);
  };

  const handleGlobalMouseUp = () => {
    handleCropMouseUp();
    onMouseUp();
  };

  // Active sets slice
  const activeSets = useMemo(() => state.sets.slice(0, state.numSets), [state.sets, state.numSets]);
  const totalRegions = 1 << state.numSets; // 2, 4, or 8

  // Region metadata helper (Notation & Human Description)
  const getRegionMeta = useCallback(
    (mask: number) => {
      const lA = state.sets[0]?.label || 'A';
      const lB = state.sets[1]?.label || 'B';
      const lC = state.sets[2]?.label || 'C';

      if (state.numSets === 1) {
        if (mask === 1) return { notation: `${lA}`, math: `${lA}`, desc: `Inside ${lA}` };
        return { notation: `${lA}'`, math: `${lA}'`, desc: `Outside ${lA}` };
      }

      if (state.numSets === 2) {
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

      // 3 Sets
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
    },
    [state.numSets, state.sets]
  );

  // Compute Pole of Inaccessibility (Visual Center) for every exclusive region
  const regionCenters = useMemo(() => {
    const centers: Record<number, { x: number; y: number; exists: boolean }> = {};
    const halfW = boxGeometry.w / 2;
    const halfH = boxGeometry.h / 2;

    // Region 0: Outside all sets (placed in chosen corner of Universal Box)
    const padX = 26;
    const padY = 22;
    let outX = halfW - padX;
    let outY = halfH - padY;
    if (state.outsideValueCorner === 'bottom-left') {
      outX = -halfW + padX;
      outY = halfH - padY;
    } else if (state.outsideValueCorner === 'top-right') {
      outX = halfW - padX;
      outY = -halfH + padY;
    }
    centers[0] = {
      x: boxGeometry.cx + outX,
      y: boxGeometry.cy + outY,
      exists: true
    };

    // Grid search for interior regions m = 1 .. (2^numSets - 1)
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

          for (let sIdx = 0; sIdx < state.numSets; sIdx++) {
            const set = activeSets[sIdx];
            const d = signedDistToSet(px, py, set, state.shapeType);
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
        // Average high-clearance points near best point for symmetric centering
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
  }, [boxGeometry, activeSets, state.numSets, state.shapeType, state.outsideValueCorner, totalRegions]);

  // Compute automatic Set Label anchor positions (before user drag offset)
  const setLabelAnchors = useMemo(() => {
    // Centroid of all active sets
    const avgCx = activeSets.reduce((acc, s) => acc + s.cx, 0) / activeSets.length;
    const avgCy = activeSets.reduce((acc, s) => acc + s.cy, 0) / activeSets.length;

    return activeSets.map((set, idx) => {
      const rx = set.rx;
      const ry = state.shapeType === 'circle' ? set.rx : set.ry;

      if (state.shapeType === 'rectangle') {
        if (state.setLabelPosition === 'inside') {
          // Place inside top corner (left for Set A, right for Set B, bottom-left/top-left for C)
          const cornerX = idx === 1 ? set.cx + rx - 18 : set.cx - rx + 18;
          const cornerY = idx === 2 && state.numSets === 3 ? set.cy + ry - 16 : set.cy - ry + 20;
          return {
            x: boxGeometry.cx + cornerX,
            y: boxGeometry.cy + cornerY
          };
        } else {
          // Outside rectangle corner
          const cornerX = idx === 1 ? set.cx + rx - 12 : set.cx - rx + 12;
          const cornerY = idx === 2 && state.numSets === 3 ? set.cy + ry + 18 : set.cy - ry - 10;
          return {
            x: boxGeometry.cx + cornerX,
            y: boxGeometry.cy + cornerY
          };
        }
      }

      // Circle / Ellipse
      let angle = -Math.PI / 2; // Default top
      if (state.numSets === 2) {
        if (Math.abs(set.cx - avgCx) > 5) {
          angle = set.cx < avgCx ? -Math.PI * 0.72 : -Math.PI * 0.28;
        } else {
          angle = idx === 0 ? -Math.PI * 0.65 : -Math.PI * 0.35;
        }
      } else if (state.numSets === 3) {
        const dx = set.cx - avgCx;
        const dy = set.cy - avgCy;
        if (Math.hypot(dx, dy) > 8) {
          angle = Math.atan2(dy, dx);
        } else {
          angle = idx === 0 ? -Math.PI * 0.75 : idx === 1 ? -Math.PI * 0.25 : Math.PI * 0.5;
        }
      }

      const distFactor = state.setLabelPosition === 'inside' ? 0.74 : 1.16;
      const lx = set.cx + Math.cos(angle) * rx * distFactor;
      const ly = set.cy + Math.sin(angle) * ry * distFactor;

      return {
        x: boxGeometry.cx + lx,
        y: boxGeometry.cy + ly
      };
    });
  }, [activeSets, boxGeometry.cx, boxGeometry.cy, state.numSets, state.setLabelPosition, state.shapeType]);

  // Calculate numeric totals for each set and universal set (when region values are numeric)
  const computedTotals = useMemo(() => {
    const setSums = [0, 0, 0];
    const setAllNumeric = [true, true, true];
    let grandTotal = 0;
    let grandAllNumeric = true;

    for (let m = 0; m < totalRegions; m++) {
      const reg = state.regions[m];
      const raw = reg?.value?.trim() || '0';
      const num = Number(raw);
      const isNum = raw !== '' && !isNaN(num) && isFinite(num);

      if (isNum) {
        grandTotal += num;
      } else if (raw !== '') {
        grandAllNumeric = false;
      }

      for (let sIdx = 0; sIdx < state.numSets; sIdx++) {
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
  }, [state.regions, state.numSets, totalRegions]);

  // --- Handlers for Topology & Shape Changes ---
  const handleSelectNumSets = (n: 1 | 2 | 3) => {
    forceSnapshot();
    updateState(prev => {
      const validTopology =
        n === 1
          ? 'standard'
          : n === 2
          ? ['standard', 'disjoint', 'subset-b-in-a', 'subset-a-in-b'].includes(prev.topology)
            ? prev.topology
            : 'standard'
          : ['standard', 'disjoint', 'chain', 'nested-all', 'subsets-in-a', 'ab-overlap-c-disjoint'].includes(
              prev.topology
            )
          ? prev.topology
          : 'standard';

      return {
        ...prev,
        numSets: n,
        topology: validTopology as VennTopologyPreset,
        sets: generatePresetSets(n, prev.shapeType, validTopology as VennTopologyPreset, prev.sets),
        regions: Object.fromEntries(
          Object.entries(prev.regions).map(([k, v]) => [k, { ...v, labelOffset: { x: 0, y: 0 } }])
        )
      };
    });
    if (n !== 2 && inputMethod === 'twoway') {
      setInputMethod('regions');
    }
  };

  const handleSelectShapeType = (shapeType: VennShapeType) => {
    forceSnapshot();
    updateState(prev => ({
      ...prev,
      shapeType,
      sets: generatePresetSets(prev.numSets, shapeType, prev.topology, prev.sets),
      regions: Object.fromEntries(
        Object.entries(prev.regions).map(([k, v]) => [k, { ...v, labelOffset: { x: 0, y: 0 } }])
      )
    }));
  };

  const handleSelectTopology = (topology: VennTopologyPreset) => {
    forceSnapshot();
    updateState(prev => ({
      ...prev,
      topology,
      sets: generatePresetSets(prev.numSets, prev.shapeType, topology, prev.sets),
      regions: Object.fromEntries(
        Object.entries(prev.regions).map(([k, v]) => [k, { ...v, labelOffset: { x: 0, y: 0 } }])
      )
    }));
  };

  const updateRegion = (mask: number, updates: Partial<VennRegionDef>) => {
    updateState(prev => ({
      ...prev,
      regions: {
        ...prev.regions,
        [mask]: { ...prev.regions[mask], ...updates }
      }
    }));
  };

  const updateSet = (id: number, updates: Partial<VennSetDef>) => {
    updateState(prev => ({
      ...prev,
      sets: prev.sets.map(s => (s.id === id ? { ...s, ...updates } : s))
    }));
  };

  // --- Inclusion-Exclusion Solver ---
  const handleSolveTotals = () => {
    forceSnapshot();
    const t = state.totalsInput;
    const parseVal = (s: string) => {
      const n = parseFloat(s);
      return isNaN(n) ? 0 : n;
    };

    const fmt = (n: number) => String(Number(n.toFixed(4)));

    if (state.numSets === 1) {
      const nA = parseVal(t.nA);
      const out = t.useOutsideInsteadOfU ? parseVal(t.nOutside) : parseVal(t.totalU) - nA;
      const hasNeg = nA < 0 || out < 0;
      updateState(prev => ({
        ...prev,
        regions: {
          ...prev.regions,
          1: { ...prev.regions[1], value: fmt(nA) },
          0: { ...prev.regions[0], value: fmt(out) }
        }
      }));
      setSolverMessage(
        hasNeg
          ? { type: 'warn', text: 'Warning: One or more regions evaluated to a negative value.' }
          : { type: 'ok', text: 'Regions updated from Set Totals.' }
      );
      return;
    }

    if (state.numSets === 2) {
      const nA = parseVal(t.nA);
      const nB = parseVal(t.nB);
      const nAB = parseVal(t.nAB);
      const onlyA = nA - nAB;
      const onlyB = nB - nAB;
      const unionAB = onlyA + onlyB + nAB;
      const out = t.useOutsideInsteadOfU ? parseVal(t.nOutside) : parseVal(t.totalU) - unionAB;
      const hasNeg = onlyA < 0 || onlyB < 0 || nAB < 0 || out < 0;

      updateState(prev => ({
        ...prev,
        regions: {
          ...prev.regions,
          1: { ...prev.regions[1], value: fmt(onlyA) },
          2: { ...prev.regions[2], value: fmt(onlyB) },
          3: { ...prev.regions[3], value: fmt(nAB) },
          0: { ...prev.regions[0], value: fmt(out) }
        }
      }));
      setSolverMessage(
        hasNeg
          ? {
              type: 'warn',
              text: 'Inconsistent totals: one or more exclusive regions are negative.'
            }
          : {
              type: 'ok',
              text: `Solved: n(A only)=${fmt(onlyA)}, n(A∩B)=${fmt(nAB)}, n(B only)=${fmt(onlyB)}, Outside=${fmt(out)}.`
            }
      );
      return;
    }

    // 3 Sets Inclusion-Exclusion
    const nA = parseVal(t.nA);
    const nB = parseVal(t.nB);
    const nC = parseVal(t.nC);
    const nAB = parseVal(t.nAB);
    const nAC = parseVal(t.nAC);
    const nBC = parseVal(t.nBC);
    const nABC = parseVal(t.nABC);

    const onlyAB = nAB - nABC;
    const onlyAC = nAC - nABC;
    const onlyBC = nBC - nABC;
    const onlyA = nA - onlyAB - onlyAC - nABC;
    const onlyB = nB - onlyAB - onlyBC - nABC;
    const onlyC = nC - onlyAC - onlyBC - nABC;
    const unionABC = onlyA + onlyB + onlyC + onlyAB + onlyAC + onlyBC + nABC;
    const out = t.useOutsideInsteadOfU ? parseVal(t.nOutside) : parseVal(t.totalU) - unionABC;

    const vals = [out, onlyA, onlyB, onlyAB, onlyC, onlyAC, onlyBC, nABC];
    const hasNeg = vals.some(v => v < 0);

    updateState(prev => ({
      ...prev,
      regions: {
        0: { ...prev.regions[0], value: fmt(out) },
        1: { ...prev.regions[1], value: fmt(onlyA) },
        2: { ...prev.regions[2], value: fmt(onlyB) },
        3: { ...prev.regions[3], value: fmt(onlyAB) },
        4: { ...prev.regions[4], value: fmt(onlyC) },
        5: { ...prev.regions[5], value: fmt(onlyAC) },
        6: { ...prev.regions[6], value: fmt(onlyBC) },
        7: { ...prev.regions[7], value: fmt(nABC) }
      }
    }));

    setSolverMessage(
      hasNeg
        ? {
            type: 'warn',
            text: 'Inconsistent totals: one or more exclusive regions are negative.'
          }
        : {
            type: 'ok',
            text: `Solved all 8 regions! n(A∪B∪C) = ${fmt(unionABC)}, Outside = ${fmt(out)}.`
          }
    );
  };

  // --- Element Lists Classifier ---
  const applyElementLists = useCallback(
    (listsOverride?: VennState['elementLists']) => {
      forceSnapshot();
      const elConfig = listsOverride || state.elementLists;
      const parseItems = (raw: string): string[] =>
        Array.from(
          new Set(
            raw
              .split(/[,;\n\t]+/)
              .map(s => s.trim())
              .filter(Boolean)
          )
        );

      const listU = parseItems(elConfig.universal);
      const listA = parseItems(elConfig.setA);
      const listB = state.numSets >= 2 ? parseItems(elConfig.setB) : [];
      const listC = state.numSets >= 3 ? parseItems(elConfig.setC) : [];

      const setASet = new Set(listA);
      const setBSet = new Set(listB);
      const setCSet = new Set(listC);

      // Union of all mentioned items so no item in A, B, C is lost if omitted from ξ
      const allElements = Array.from(new Set([...listU, ...listA, ...listB, ...listC]));

      const buckets: Record<number, string[]> = {
        0: [],
        1: [],
        2: [],
        3: [],
        4: [],
        5: [],
        6: [],
        7: []
      };

      allElements.forEach(item => {
        const m =
          (setASet.has(item) ? 1 : 0) |
          (setBSet.has(item) ? 2 : 0) |
          (setCSet.has(item) ? 4 : 0);
        buckets[m].push(item);
      });

      updateState(prev => {
        const nextRegions = { ...prev.regions };
        for (let m = 0; m < 8; m++) {
          const items = buckets[m] || [];
          let val = '';
          if (elConfig.displayMode === 'counts') {
            val = String(items.length);
          } else {
            val = elConfig.bulletPoints
              ? items.map(x => `• ${x}`).join(', ')
              : items.join(', ');
          }
          nextRegions[m] = {
            ...nextRegions[m],
            value: val
          };
        }
        return {
          ...prev,
          elementLists: elConfig,
          regions: nextRegions
        };
      });
    },
    [forceSnapshot, state.elementLists, state.numSets, updateState]
  );

  // --- Apply Set Expression Shading ---
  const handleApplySetExpression = (exprOverride?: string) => {
    const expr = exprOverride !== undefined ? exprOverride : setExpressionInput;
    if (exprOverride !== undefined) setSetExpressionInput(exprOverride);

    const customLabels = state.sets.map(s => s.label);
    const nextShaded: Record<number, boolean> = {};
    for (let m = 0; m < totalRegions; m++) {
      const res = evaluateSetExpression(expr, m, state.numSets, customLabels);
      if (res === null) {
        setExpressionError(
          `Could not parse "${expr}". Use sets A, B, C and operators ∪ (or |), ∩ (or &), ' (complement), \\ (difference).`
        );
        return;
      }
      nextShaded[m] = res;
    }

    setExpressionError(null);
    forceSnapshot();
    updateState(prev => {
      const updated = { ...prev.regions };
      for (let m = 0; m < totalRegions; m++) {
        updated[m] = { ...updated[m], shaded: !!nextShaded[m] };
      }
      return { ...prev, regions: updated };
    });
  };

  // --- Canvas Interaction: Click to Shade or Drag ---
  const getSvgCoords = (e: React.MouseEvent): { x: number; y: number } | null => {
    const svg = document.getElementById('venn-svg') as unknown as SVGSVGElement;
    if (!svg) return null;
    const ctm = svg.getScreenCTM();
    if (!ctm) return null;
    return {
      x: (e.clientX - ctm.e) / ctm.a,
      y: (e.clientY - ctm.f) / ctm.d
    };
  };

  // --- Quick Resize Helpers for Rectangle Border & Circles/Shapes ---
  const handleResizeBoxCm = (dWidthCm: number, dHeightCm: number) => {
    forceSnapshot();
    updateState(prev => ({
      ...prev,
      dimCm: {
        width: Math.max(6, Math.min(32, Number((prev.dimCm.width + dWidthCm).toFixed(2)))),
        height: Math.max(5, Math.min(26, Number((prev.dimCm.height + dHeightCm).toFixed(2))))
      }
    }));
  };

  const handleFitBorderToShapes = () => {
    forceSnapshot();
    let maxExtentX = 80;
    let maxExtentY = 60;
    activeSets.forEach(s => {
      const rx = s.rx;
      const ry = state.shapeType === 'circle' ? s.rx : s.ry;
      maxExtentX = Math.max(maxExtentX, Math.abs(s.cx) + rx);
      maxExtentY = Math.max(maxExtentY, Math.abs(s.cy) + ry);
    });
    const desiredBoxW = maxExtentX * 2 + 84;
    const desiredBoxH = maxExtentY * 2 + 72;
    const topPad = state.chartTitle ? 54 : 36;
    const totalW = desiredBoxW + 42 + 28;
    const totalH = desiredBoxH + topPad + 28;
    updateState(prev => ({
      ...prev,
      dimCm: {
        width: Math.max(7, Math.min(30, Number((totalW / CM_TO_PX).toFixed(1)))),
        height: Math.max(5.5, Math.min(25, Number((totalH / CM_TO_PX).toFixed(1))))
      }
    }));
  };

  const handleResizeShapes = (dRx: number, dRy: number, target: number | 'all' = selectedSetId) => {
    forceSnapshot();
    updateState(prev => ({
      ...prev,
      sets: prev.sets.map((s, idx) => {
        if (idx >= prev.numSets) return s;
        if (target !== 'all' && s.id !== target) return s;
        const nextRx = Math.max(20, Math.min(260, Math.round(s.rx + dRx)));
        const nextRy =
          prev.shapeType === 'circle'
            ? nextRx
            : Math.max(20, Math.min(220, Math.round(s.ry + dRy)));
        return { ...s, rx: nextRx, ry: nextRy };
      })
    }));
  };

  const handleAdjustSetSpacing = (delta: number) => {
    if (state.numSets < 2) return;
    forceSnapshot();
    updateState(prev => ({
      ...prev,
      sets: prev.sets.map((s, idx) => {
        if (idx >= prev.numSets) return s;
        const dist = Math.hypot(s.cx, s.cy);
        if (dist < 2) {
          if (prev.numSets === 2) {
            return { ...s, cx: idx === 0 ? -delta : delta };
          }
          const angle = idx === 0 ? -Math.PI * 0.75 : idx === 1 ? -Math.PI * 0.25 : Math.PI * 0.5;
          return {
            ...s,
            cx: Math.round(Math.cos(angle) * delta),
            cy: Math.round(Math.sin(angle) * delta)
          };
        }
        const scale = Math.max(0.15, (dist + delta) / dist);
        return {
          ...s,
          cx: Math.round(s.cx * scale),
          cy: Math.round(s.cy * scale)
        };
      })
    }));
  };

  const handleSvgMouseDown = (e: React.MouseEvent) => {
    if (cropMode) {
      handleCropMouseDown(e);
      return;
    }

    const pt = getSvgCoords(e);
    if (!pt) return;

    // Check if click is inside Universal Box
    const relX = pt.x - boxGeometry.cx;
    const relY = pt.y - boxGeometry.cy;
    const insideU =
      Math.abs(relX) <= boxGeometry.w / 2 && Math.abs(relY) <= boxGeometry.h / 2;

    if (canvasTool === 'shade' && insideU) {
      let mask = 0;
      for (let sIdx = 0; sIdx < state.numSets; sIdx++) {
        const d = signedDistToSet(relX, relY, activeSets[sIdx], state.shapeType);
        if (d >= 0) {
          mask |= 1 << sIdx;
        }
      }
      forceSnapshot();
      updateRegion(mask, { shaded: !state.regions[mask]?.shaded });
      return;
    }

    // In manipulate mode, allow clicking anywhere inside a set shape to select and drag it!
    if (canvasTool === 'manipulate') {
      const hitSets = activeSets
        .map(s => ({
          set: s,
          d: signedDistToSet(relX, relY, s, state.shapeType),
          area: s.rx * (state.shapeType === 'circle' ? s.rx : s.ry)
        }))
        .filter(item => item.d >= -5);

      if (hitSets.length > 0) {
        // Prefer a set whose perimeter was clicked, otherwise prefer the smallest set containing the point
        const borderHit = hitSets.find(item => Math.abs(item.d) <= 7);
        const chosen = borderHit || hitSets.sort((a, b) => a.area - b.area)[0];
        handleSetDragStart(chosen.set.id, e);
        return;
      }
    }

    setSelectedSetId('all');
  };

  // Dragging a Set Shape (Circle / Ellipse / Rectangle)
  const handleSetDragStart = (setId: number, e: React.MouseEvent) => {
    if (cropMode) return;
    if (canvasTool === 'shade') return; // Let click pass through to shade handler
    e.stopPropagation();
    setSelectedSetId(setId);
    forceSnapshot();

    const target = state.sets.find(s => s.id === setId);
    if (!target) return;

    onMouseDown(
      e,
      { cx: target.cx, cy: target.cy },
      (dx, dy, init) => {
        updateSet(setId, {
          cx: Math.round(init.cx + dx),
          cy: Math.round(init.cy + dy)
        });
      },
      undefined,
      'move-set'
    );
  };

  // Resizing a Set Shape via Handle (Supports E, W, S, N, and Corners)
  const handleSetResizeStart = (
    setId: number,
    handleType: 'e' | 'w' | 's' | 'n' | 'se' | 'sw' | 'ne' | 'nw',
    e: React.MouseEvent
  ) => {
    if (cropMode) return;
    e.stopPropagation();
    setSelectedSetId(setId);
    forceSnapshot();

    const target = state.sets.find(s => s.id === setId);
    if (!target) return;

    const signX = handleType.includes('e') ? 1 : handleType.includes('w') ? -1 : 0;
    const signY = handleType.includes('s') ? 1 : handleType.includes('n') ? -1 : 0;

    onMouseDown(
      e,
      { rx: target.rx, ry: target.ry },
      (dx, dy, init, ev) => {
        if (state.shapeType === 'circle' || ev.shiftKey) {
          const delta =
            signX !== 0 && signY !== 0
              ? (dx * signX + dy * signY) / 2
              : signX !== 0
              ? dx * signX
              : dy * signY;
          const nextR = Math.max(20, Math.min(260, Math.round(init.rx + delta)));
          updateSet(setId, { rx: nextR, ry: nextR });
        } else {
          const nextRx =
            signX !== 0
              ? Math.max(20, Math.min(260, Math.round(init.rx + dx * signX)))
              : init.rx;
          const nextRy =
            signY !== 0
              ? Math.max(20, Math.min(220, Math.round(init.ry + dy * signY)))
              : init.ry;
          updateSet(setId, { rx: nextRx, ry: nextRy });
        }
      },
      undefined,
      'resize-set'
    );
  };

  // Resizing the Outer Universal Rectangle Border directly via Canvas Handles
  const handleBoxResizeStart = (
    handleType: 'e' | 'w' | 's' | 'n' | 'se',
    e: React.MouseEvent
  ) => {
    if (cropMode) return;
    e.stopPropagation();
    forceSnapshot();

    const signX = handleType.includes('e') ? 1 : handleType.includes('w') ? -1 : 0;
    const signY = handleType.includes('s') ? 1 : handleType.includes('n') ? -1 : 0;

    onMouseDown(
      e,
      { widthCm: state.dimCm.width, heightCm: state.dimCm.height },
      (dx, dy, init) => {
        const dW = signX !== 0 ? (dx * signX * 2) / CM_TO_PX : 0;
        const dH = signY !== 0 ? (dy * signY * 2) / CM_TO_PX : 0;
        updateState(prev => ({
          ...prev,
          dimCm: {
            width: Math.max(6, Math.min(32, Number((init.widthCm + dW).toFixed(2)))),
            height: Math.max(5, Math.min(26, Number((init.heightCm + dH).toFixed(2))))
          }
        }));
      },
      undefined,
      'resize-box'
    );
  };

  // Dragging a Region Value Label
  const handleRegionLabelDragStart = (mask: number, e: React.MouseEvent) => {
    if (cropMode || canvasTool === 'shade') return;
    e.stopPropagation();
    forceSnapshot();

    if (e.shiftKey) {
      updateRegion(mask, { labelOffset: { x: 0, y: 0 } });
      return;
    }

    const currentOffset = state.regions[mask]?.labelOffset || { x: 0, y: 0 };
    onMouseDown(
      e,
      { ...currentOffset },
      (dx, dy, init) => {
        updateRegion(mask, {
          labelOffset: {
            x: Math.round(init.x + dx),
            y: Math.round(init.y + dy)
          }
        });
      },
      undefined,
      'drag-region-label'
    );
  };

  // Dragging a Set Title Label (A, B, C)
  const handleSetLabelDragStart = (setId: number, e: React.MouseEvent) => {
    if (cropMode || canvasTool === 'shade') return;
    e.stopPropagation();
    forceSnapshot();

    if (e.shiftKey) {
      updateSet(setId, { labelOffset: { x: 0, y: 0 } });
      return;
    }

    const target = state.sets.find(s => s.id === setId);
    if (!target) return;

    onMouseDown(
      e,
      { ...target.labelOffset },
      (dx, dy, init) => {
        updateSet(setId, {
          labelOffset: {
            x: Math.round(init.x + dx),
            y: Math.round(init.y + dy)
          }
        });
      },
      undefined,
      'drag-set-label'
    );
  };

  // Dragging Universal Set Label (ξ)
  const handleUniversalLabelDragStart = (e: React.MouseEvent) => {
    if (cropMode || canvasTool === 'shade') return;
    e.stopPropagation();
    forceSnapshot();

    if (e.shiftKey) {
      updateState(prev => ({ ...prev, universalLabelOffset: { x: 0, y: 0 } }));
      return;
    }

    const initOffset = state.universalLabelOffset;
    onMouseDown(
      e,
      { ...initOffset },
      (dx, dy, init) => {
        updateState(prev => ({
          ...prev,
          universalLabelOffset: {
            x: Math.round(init.x + dx),
            y: Math.round(init.y + dy)
          }
        }));
      },
      undefined,
      'drag-u-label'
    );
  };

  // Helper to render SVG shape element for a given set
  const renderSetShapeElement = (
    set: VennSetDef,
    key: string,
    extraProps: React.SVGProps<SVGGElement & SVGCircleElement & SVGEllipseElement & SVGRectElement> = {}
  ) => {
    const cx = boxGeometry.cx + set.cx;
    const cy = boxGeometry.cy + set.cy;
    if (state.shapeType === 'rectangle') {
      return (
        <rect
          key={key}
          x={cx - set.rx}
          y={cy - set.ry}
          width={set.rx * 2}
          height={set.ry * 2}
          rx={state.rectCornerRadius}
          ry={state.rectCornerRadius}
          {...extraProps}
        />
      );
    }
    const rx = set.rx;
    const ry = state.shapeType === 'circle' ? set.rx : set.ry;
    return <ellipse key={key} cx={cx} cy={cy} rx={rx} ry={ry} {...extraProps} />;
  };

  // Helper to render Pattern Definitions
  const renderPatternDefs = () => {
    const sp = Math.max(4, state.patternSpacing);
    const sw = Math.max(0.5, state.patternStrokeWidth);
    return (
      <>
        <pattern
          id="venn-pat-stripes-right"
          width={sp}
          height={sp}
          patternUnits="userSpaceOnUse"
          patternTransform="rotate(45)"
        >
          <line x1={0} y1={0} x2={0} y2={sp} stroke="#000000" strokeWidth={sw} />
        </pattern>
        <pattern
          id="venn-pat-stripes-left"
          width={sp}
          height={sp}
          patternUnits="userSpaceOnUse"
          patternTransform="rotate(-45)"
        >
          <line x1={0} y1={0} x2={0} y2={sp} stroke="#000000" strokeWidth={sw} />
        </pattern>
        <pattern
          id="venn-pat-vertical"
          width={sp}
          height={sp}
          patternUnits="userSpaceOnUse"
        >
          <line x1={sp / 2} y1={0} x2={sp / 2} y2={sp} stroke="#000000" strokeWidth={sw} />
        </pattern>
        <pattern
          id="venn-pat-horizontal"
          width={sp}
          height={sp}
          patternUnits="userSpaceOnUse"
        >
          <line x1={0} y1={sp / 2} x2={sp} y2={sp / 2} stroke="#000000" strokeWidth={sw} />
        </pattern>
        <pattern id="venn-pat-grid" width={sp} height={sp} patternUnits="userSpaceOnUse">
          <line x1={0} y1={sp / 2} x2={sp} y2={sp / 2} stroke="#000000" strokeWidth={sw * 0.85} />
          <line x1={sp / 2} y1={0} x2={sp / 2} y2={sp} stroke="#000000" strokeWidth={sw * 0.85} />
        </pattern>
        <pattern
          id="venn-pat-crosshatch"
          width={sp}
          height={sp}
          patternUnits="userSpaceOnUse"
          patternTransform="rotate(45)"
        >
          <line x1={0} y1={0} x2={0} y2={sp} stroke="#000000" strokeWidth={sw * 0.85} />
          <line x1={0} y1={sp / 2} x2={sp} y2={sp / 2} stroke="#000000" strokeWidth={sw * 0.85} />
        </pattern>
        <pattern id="venn-pat-dots" width={sp} height={sp} patternUnits="userSpaceOnUse">
          <circle cx={sp * 0.25} cy={sp * 0.25} r={Math.max(1, sw * 0.8)} fill="#000000" />
          <circle cx={sp * 0.75} cy={sp * 0.75} r={Math.max(1, sw * 0.8)} fill="#000000" />
        </pattern>
      </>
    );
  };

  // Render Shaded Exclusive Regions using nested clipPaths (for included sets) and masks (for excluded sets)
  const renderShadedRegions = () => {
    const els: React.ReactNode[] = [];

    for (let m = 0; m < totalRegions; m++) {
      const reg = state.regions[m];
      if (!reg || !reg.shaded) continue;

      const shadeColor = reg.customShadeColor || state.globalShadeColor;
      const pattern = reg.customPattern || state.globalShadePattern;

      const includedSets: number[] = [];
      for (let sIdx = 0; sIdx < state.numSets; sIdx++) {
        if ((m & (1 << sIdx)) !== 0) {
          includedSets.push(sIdx);
        }
      }

      // Base rectangles to fill the universal box
      let content: React.ReactNode = (
        <g mask={`url(#venn-exclude-mask-${m})`}>
          {shadeColor !== 'none' && (
            <rect
              x={boxGeometry.x}
              y={boxGeometry.y}
              width={boxGeometry.w}
              height={boxGeometry.h}
              fill={shadeColor}
            />
          )}
          {pattern !== 'none' && (
            <rect
              x={boxGeometry.x}
              y={boxGeometry.y}
              width={boxGeometry.w}
              height={boxGeometry.h}
              fill={`url(#venn-pat-${pattern})`}
            />
          )}
        </g>
      );

      // Wrap in clipPath for each included set
      includedSets.forEach(sIdx => {
        content = <g clipPath={`url(#venn-clip-set-${sIdx})`}>{content}</g>;
      });

      // Clip to Universal Box
      els.push(
        <g key={`shaded-region-${m}`} clipPath="url(#venn-clip-universal)">
          {content}
        </g>
      );
    }

    // Optional whole-set overlay shading/hatching
    activeSets.forEach(set => {
      if (set.setFillShade !== 'none' || set.setFillPattern !== 'none') {
        els.push(
          <g key={`set-overlay-${set.id}`} clipPath="url(#venn-clip-universal)">
            {set.setFillShade !== 'none' &&
              renderSetShapeElement(set, `set-fill-${set.id}`, {
                fill: set.setFillShade,
                fillOpacity: set.setFillOpacity,
                stroke: 'none'
              })}
            {set.setFillPattern !== 'none' &&
              renderSetShapeElement(set, `set-pat-${set.id}`, {
                fill: `url(#venn-pat-${set.setFillPattern})`,
                fillOpacity: 0.85,
                stroke: 'none'
              })}
          </g>
        );
      }
    });

    return els;
  };

  // Render Text or Math via TexEngine (Times New Roman)
  const renderMathOrText = (
    text: string,
    x: number,
    y: number,
    ptSize: number,
    hasBg: boolean = false,
    forceMath: boolean = false
  ) => {
    const svgFontSize = ptToSvgUnits(ptSize);
    const trimmed = text.trim();
    if (!trimmed) return null;

    // Detect if string uses math syntax or if we should render as mixed text
    const isPureMath =
      forceMath ||
      trimmed.startsWith('\\') ||
      trimmed.includes('\\frac') ||
      trimmed.includes('\\cap') ||
      trimmed.includes('\\cup') ||
      trimmed.includes('\\xi') ||
      trimmed.includes('\\mathcal');

    if (isPureMath && !trimmed.includes('$')) {
      return texEngine.renderToSVG(
        trimmed,
        x,
        y,
        svgFontSize,
        '#000000',
        'middle',
        hasBg,
        'math'
      );
    }

    // Multi-line or long comma-separated element list wrapping
    if (!trimmed.includes('$') && !trimmed.includes('\\') && trimmed.length > 14 && trimmed.includes(',')) {
      const parts = trimmed.split(',').map(s => s.trim());
      const lines: string[] = [];
      let currentLine = '';
      parts.forEach(part => {
        const candidate = currentLine ? `${currentLine}, ${part}` : part;
        if (candidate.length > 14 && currentLine) {
          lines.push(currentLine);
          currentLine = part;
        } else {
          currentLine = candidate;
        }
      });
      if (currentLine) lines.push(currentLine);

      const lineHeight = svgFontSize * 1.22;
      const startY = y - ((lines.length - 1) * lineHeight) / 2;

      return lines.map((line, idx) => (
        <text
          key={`line-${idx}`}
          x={x}
          y={startY + idx * lineHeight}
          textAnchor="middle"
          dominantBaseline="central"
          fontFamily="'Times New Roman', Times, serif"
          fontSize={svgFontSize}
          fill="#000000"
        >
          {line}
        </text>
      ));
    }

    return texEngine.renderToSVG(
      trimmed,
      x,
      y + svgFontSize * 0.3,
      svgFontSize,
      '#000000',
      'middle',
      hasBg,
      'text'
    );
  };

  // Render Companion 2-Way Table on SVG (when 2 sets & enabled)
  const renderCompanionTwoWayTable = () => {
    if (state.numSets !== 2 || !state.showCompanionTable) return null;

    const lA = state.sets[0]?.label || 'A';
    const lB = state.sets[1]?.label || 'B';
    const vAB = state.regions[3]?.value || '0';
    const vAOnly = state.regions[1]?.value || '0';
    const vBOnly = state.regions[2]?.value || '0';
    const vOut = state.regions[0]?.value || '0';

    const nAB = parseFloat(vAB);
    const nAOnly = parseFloat(vAOnly);
    const nBOnly = parseFloat(vBOnly);
    const nOut = parseFloat(vOut);

    const rowA = !isNaN(nAB) && !isNaN(nAOnly) ? String(Number((nAB + nAOnly).toFixed(4))) : '';
    const rowNotA = !isNaN(nBOnly) && !isNaN(nOut) ? String(Number((nBOnly + nOut).toFixed(4))) : '';
    const colB = !isNaN(nAB) && !isNaN(nBOnly) ? String(Number((nAB + nBOnly).toFixed(4))) : '';
    const colNotB = !isNaN(nAOnly) && !isNaN(nOut) ? String(Number((nAOnly + nOut).toFixed(4))) : '';
    const grand =
      !isNaN(nAB) && !isNaN(nAOnly) && !isNaN(nBOnly) && !isNaN(nOut)
        ? String(Number((nAB + nAOnly + nBOnly + nOut).toFixed(4)))
        : '';

    const tableX = baseWidthPx + 10;
    const cellW = 50;
    const cellH = 34;
    const tableW = cellW * 4;
    const tableH = cellH * 4;
    const tableY = boxGeometry.cy - tableH / 2;
    const svgFs = ptToSvgUnits(state.fontSize);

    const cells = [
      ['', lB, `${lB}'`, 'Total'],
      [lA, state.studentMode ? '' : vAB, state.studentMode ? '' : vAOnly, state.studentMode ? '' : rowA],
      [`${lA}'`, state.studentMode ? '' : vBOnly, state.studentMode ? '' : vOut, state.studentMode ? '' : rowNotA],
      ['Total', state.studentMode ? '' : colB, state.studentMode ? '' : colNotB, state.studentMode ? '' : grand]
    ];

    return (
      <g className="companion-table-layer">
        <rect
          x={tableX}
          y={tableY}
          width={tableW}
          height={tableH}
          fill="#ffffff"
          stroke="#000000"
          strokeWidth={1.5}
        />
        {/* Header shading */}
        <rect x={tableX} y={tableY} width={tableW} height={cellH} fill="#f3f4f6" />
        <rect x={tableX} y={tableY} width={cellW} height={tableH} fill="#f3f4f6" />
        {/* Grid lines */}
        {[1, 2, 3].map(i => (
          <React.Fragment key={`tgrid-${i}`}>
            <line
              x1={tableX + i * cellW}
              y1={tableY}
              x2={tableX + i * cellW}
              y2={tableY + tableH}
              stroke="#000000"
              strokeWidth={i === 1 || i === 3 ? 1.5 : 1}
            />
            <line
              x1={tableX}
              y1={tableY + i * cellH}
              x2={tableX + tableW}
              y2={tableY + i * cellH}
              stroke="#000000"
              strokeWidth={i === 1 || i === 3 ? 1.5 : 1}
            />
          </React.Fragment>
        ))}
        {/* Cell Text */}
        {cells.map((row, rIdx) =>
          row.map((val, cIdx) => {
            if (!val) return null;
            const cx = tableX + cIdx * cellW + cellW / 2;
            const cy = tableY + rIdx * cellH + cellH / 2;
            const isHeader = rIdx === 0 || cIdx === 0;
            return (
              <text
                key={`tcell-${rIdx}-${cIdx}`}
                x={cx}
                y={cy}
                textAnchor="middle"
                dominantBaseline="central"
                fontFamily="'Times New Roman', Times, serif"
                fontSize={svgFs * 0.92}
                fontWeight={isHeader ? 'bold' : 'normal'}
                fontStyle={isHeader && val.length <= 2 ? 'italic' : 'normal'}
                fill="#000000"
              >
                {val}
              </text>
            );
          })
        )}
      </g>
    );
  };

  // Preset Set Notation Chips
  const shadingPresets = useMemo(() => {
    if (state.numSets === 1) {
      return [
        { label: 'A', expr: 'A' },
        { label: "A'", expr: "A'" }
      ];
    }
    if (state.numSets === 2) {
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
      { label: '(A ∪ B) ∩ C\'', expr: "(A ∪ B) ∩ C'" }
    ];
  }, [state.numSets]);

  return (
    <div
      className="flex h-full flex-col bg-gray-50 select-none"
      onMouseMove={handleGlobalMouseMove}
      onMouseUp={handleGlobalMouseUp}
    >
      {/* Top Header & Unified GraphToolbar */}
      <header className="flex items-center justify-between px-6 py-3 bg-white border-b border-gray-200 shadow-sm z-10">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-gray-100 text-gray-800 rounded-lg border border-gray-200">
            <CircleDot className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-xl font-semibold text-gray-800 leading-tight">
              Venn Diagram Creator
            </h1>
            <p className="text-xs text-gray-500">
              Circular &amp; rectangular Venn diagrams with set solver and notation shading
            </p>
          </div>
        </div>

        {/* Quick Mode Bar + Standard GraphToolbar */}
        <div className="flex items-center gap-3">
          <div className="flex items-center bg-gray-100 p-1 rounded-lg border border-gray-200">
            <button
              onClick={() => setCanvasTool('manipulate')}
              className={`px-2.5 py-1 text-xs font-medium rounded-md flex items-center gap-1.5 transition-colors ${
                canvasTool === 'manipulate'
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
              title="Move & resize sets or drag labels on canvas"
            >
              <MousePointer size={13} /> Move / Resize
            </button>
            <button
              onClick={() => setCanvasTool('shade')}
              className={`px-2.5 py-1 text-xs font-medium rounded-md flex items-center gap-1.5 transition-colors ${
                canvasTool === 'shade'
                  ? 'bg-gray-800 text-white shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
              title="Click any region inside the Venn diagram to toggle shading"
            >
              <PaintBucket size={13} /> Click to Shade
            </button>
          </div>

          <GraphToolbar
            previewScale={previewScale}
            setPreviewScale={setPreviewScale}
            cropMode={cropMode}
            setCropMode={setCropMode}
            onResetView={handleResetView}
            onZoomOutCanvas={handleZoomOutCanvas}
            onAutoCrop={handleAutoCrop}
            onFitToScreen={handleFitToScreen}
            onExportPNG={handleExportPNG}
            onExportSVG={handleExportSVG}
            onCopy={handleCopy}
            isCopied={isCopied}
            exportDpi={exportDpi}
            onDpiChange={setExportDpi}
            onUndo={undo}
            onRedo={redo}
            canUndo={canUndo}
            canRedo={canRedo}
            onExportData={() => exportToFile('venn-diagram-project.json')}
            onImportData={importFromFile}
            onDefaultSettings={() => {
              forceSnapshot();
              setState(DEFAULT_STATE);
            }}
            onClearAll={() => {
              forceSnapshot();
              updateState(prev => ({
                ...prev,
                regions: Object.fromEntries(
                  Object.entries(prev.regions).map(([k, v]) => [
                    k,
                    { ...v, value: '', shaded: false, isBlankBox: false }
                  ])
                )
              }));
            }}
          />
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        {/* Left Configuration Sidebar */}
        <aside className="w-96 bg-white border-r border-gray-200 flex flex-col h-full z-20 shadow-sm">
          {/* Top Structure Bar (Number of Sets & Shape Type) */}
          <div className="p-3.5 bg-gray-50 border-b border-gray-200 space-y-3">
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-[11px] font-bold text-gray-500 uppercase tracking-wider mb-1">
                  Number of Sets
                </label>
                <div className="grid grid-cols-3 bg-white rounded-md border border-gray-300 p-0.5">
                  {([1, 2, 3] as const).map(n => (
                    <button
                      key={n}
                      onClick={() => handleSelectNumSets(n)}
                      className={`py-1 text-xs font-semibold rounded transition-colors ${
                        state.numSets === n
                          ? 'bg-gray-800 text-white'
                          : 'text-gray-600 hover:bg-gray-100'
                      }`}
                    >
                      {n} {n === 1 ? 'Set' : 'Sets'}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-gray-500 uppercase tracking-wider mb-1">
                  Set Shape Style
                </label>
                <div className="grid grid-cols-3 bg-white rounded-md border border-gray-300 p-0.5">
                  <button
                    onClick={() => handleSelectShapeType('circle')}
                    className={`py-1 text-xs font-semibold rounded flex items-center justify-center gap-1 transition-colors ${
                      state.shapeType === 'circle'
                        ? 'bg-gray-800 text-white'
                        : 'text-gray-600 hover:bg-gray-100'
                    }`}
                  >
                    Circles
                  </button>
                  <button
                    onClick={() => handleSelectShapeType('ellipse')}
                    className={`py-1 text-xs font-semibold rounded flex items-center justify-center gap-1 transition-colors ${
                      state.shapeType === 'ellipse'
                        ? 'bg-gray-800 text-white'
                        : 'text-gray-600 hover:bg-gray-100'
                    }`}
                  >
                    Ellipses
                  </button>
                  <button
                    onClick={() => handleSelectShapeType('rectangle')}
                    className={`py-1 text-xs font-semibold rounded flex items-center justify-center gap-1 transition-colors ${
                      state.shapeType === 'rectangle'
                        ? 'bg-gray-800 text-white'
                        : 'text-gray-600 hover:bg-gray-100'
                    }`}
                  >
                    Rects
                  </button>
                </div>
              </div>
            </div>

            {/* Topology / Relationship Presets */}
            {state.numSets >= 2 && (
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-[11px] font-bold text-gray-500 uppercase tracking-wider">
                    Set Relationship / Layout Preset
                  </label>
                  <button
                    onClick={() => handleSelectTopology(state.topology)}
                    className="text-[11px] text-gray-600 hover:text-black flex items-center gap-1"
                    title="Reset positions to preset"
                  >
                    <RotateCcw size={11} /> Reset Positions
                  </button>
                </div>
                {state.numSets === 2 ? (
                  <div className="grid grid-cols-2 gap-1.5">
                    {[
                      { id: 'standard', label: 'Overlapping (A ∩ B)' },
                      { id: 'disjoint', label: 'Disjoint (A ∩ B = ∅)' },
                      { id: 'subset-b-in-a', label: 'Subset (B ⊂ A)' },
                      { id: 'subset-a-in-b', label: 'Subset (A ⊂ B)' }
                    ].map(p => (
                      <button
                        key={p.id}
                        onClick={() => handleSelectTopology(p.id as VennTopologyPreset)}
                        className={`px-2 py-1.5 text-xs font-medium rounded border text-left transition-colors ${
                          state.topology === p.id
                            ? 'bg-gray-800 text-white border-gray-800'
                            : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-100'
                        }`}
                      >
                        {p.label}
                      </button>
                    ))}
                  </div>
                ) : (
                  <div className="grid grid-cols-2 gap-1.5">
                    {[
                      { id: 'standard', label: 'Standard 3-Way' },
                      { id: 'disjoint', label: 'All Disjoint' },
                      { id: 'chain', label: 'Chain (A–B–C)' },
                      { id: 'nested-all', label: 'Nested (C ⊂ B ⊂ A)' },
                      { id: 'subsets-in-a', label: 'Subsets (B, C ⊂ A)' },
                      { id: 'ab-overlap-c-disjoint', label: 'A ∩ B, C Separate' }
                    ].map(p => (
                      <button
                        key={p.id}
                        onClick={() => handleSelectTopology(p.id as VennTopologyPreset)}
                        className={`px-2 py-1.5 text-xs font-medium rounded border text-left transition-colors ${
                          state.topology === p.id
                            ? 'bg-gray-800 text-white border-gray-800'
                            : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-100'
                        }`}
                      >
                        {p.label}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Main Sidebar Navigation Tabs */}
          <div className="flex border-b border-gray-200 bg-white">
            <button
              onClick={() => setActiveTab('data')}
              className={`flex-1 py-2.5 text-xs font-semibold uppercase tracking-wider flex justify-center items-center gap-1.5 transition-colors ${
                activeTab === 'data'
                  ? 'text-gray-900 border-b-2 border-gray-900 bg-gray-50'
                  : 'text-gray-500 hover:text-gray-800'
              }`}
            >
              <List size={14} /> Data &amp; Input
            </button>
            <button
              onClick={() => setActiveTab('shading')}
              className={`flex-1 py-2.5 text-xs font-semibold uppercase tracking-wider flex justify-center items-center gap-1.5 transition-colors ${
                activeTab === 'shading'
                  ? 'text-gray-900 border-b-2 border-gray-900 bg-gray-50'
                  : 'text-gray-500 hover:text-gray-800'
              }`}
            >
              <Palette size={14} /> Shading
            </button>
            <button
              onClick={() => setActiveTab('style')}
              className={`flex-1 py-2.5 text-xs font-semibold uppercase tracking-wider flex justify-center items-center gap-1.5 transition-colors ${
                activeTab === 'style'
                  ? 'text-gray-900 border-b-2 border-gray-900 bg-gray-50'
                  : 'text-gray-500 hover:text-gray-800'
              }`}
            >
              <Sliders size={14} /> Appearance
            </button>
          </div>

          {/* Tab Content Area */}
          <div className="flex-1 overflow-y-auto p-4 space-y-5 select-text">
            {/* ==================== TAB 1: DATA & INPUT ==================== */}
            {activeTab === 'data' && (
              <>
                {/* Set Names Row */}
                <div className="space-y-2">
                  <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider">
                    Set Labels
                  </label>
                  <div className="grid grid-cols-3 gap-2">
                    {activeSets.map((set, idx) => (
                      <div key={set.id} className="flex items-center gap-1.5">
                        <span className="text-xs font-semibold text-gray-400">
                          S{idx + 1}:
                        </span>
                        <input
                          type="text"
                          value={set.label}
                          onChange={e => updateSet(set.id, { label: e.target.value })}
                          className="w-full border border-gray-300 rounded px-2 py-1 text-sm font-serif font-semibold text-gray-800"
                          placeholder={`Set ${idx + 1}`}
                        />
                      </div>
                    ))}
                  </div>
                </div>

                {/* Input Method Selector */}
                <div className="space-y-2">
                  <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider">
                    Data Input Method
                  </label>
                  <div className="grid grid-cols-2 gap-1.5 bg-gray-100 p-1 rounded-lg border border-gray-200">
                    <button
                      onClick={() => setInputMethod('regions')}
                      className={`py-1.5 px-2 text-xs font-medium rounded flex items-center justify-center gap-1.5 transition-colors ${
                        inputMethod === 'regions'
                          ? 'bg-white text-gray-900 shadow-sm'
                          : 'text-gray-600 hover:text-gray-900'
                      }`}
                    >
                      <Layers size={13} /> Direct Regions
                    </button>
                    <button
                      onClick={() => setInputMethod('totals')}
                      className={`py-1.5 px-2 text-xs font-medium rounded flex items-center justify-center gap-1.5 transition-colors ${
                        inputMethod === 'totals'
                          ? 'bg-white text-gray-900 shadow-sm'
                          : 'text-gray-600 hover:text-gray-900'
                      }`}
                    >
                      <Calculator size={13} /> Set Totals Solver
                    </button>
                    <button
                      onClick={() => setInputMethod('elements')}
                      className={`py-1.5 px-2 text-xs font-medium rounded flex items-center justify-center gap-1.5 transition-colors ${
                        inputMethod === 'elements'
                          ? 'bg-white text-gray-900 shadow-sm'
                          : 'text-gray-600 hover:text-gray-900'
                      }`}
                    >
                      <Sparkles size={13} /> Element Lists
                    </button>
                    {state.numSets === 2 && (
                      <button
                        onClick={() => setInputMethod('twoway')}
                        className={`py-1.5 px-2 text-xs font-medium rounded flex items-center justify-center gap-1.5 transition-colors ${
                          inputMethod === 'twoway'
                            ? 'bg-white text-gray-900 shadow-sm'
                            : 'text-gray-600 hover:text-gray-900'
                        }`}
                      >
                        <Grid size={13} /> 2-Way Table
                      </button>
                    )}
                  </div>
                </div>

                {/* METHOD 1: DIRECT EXCLUSIVE REGIONS */}
                {inputMethod === 'regions' && (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">
                        Exclusive Regions
                      </span>
                      <span className="text-[11px] text-gray-400">
                        Supports numbers, $2x+1$, or $\frac{'{1}{4}'}$
                      </span>
                    </div>

                    <div className="space-y-2">
                      {Array.from({ length: totalRegions }).map((_, i) => {
                        // Order nicely: single sets first, then intersections, then outside (0) last
                        const order2 = [1, 3, 2, 0];
                        const order3 = [1, 2, 4, 3, 5, 6, 7, 0];
                        const mask =
                          state.numSets === 2
                            ? order2[i]
                            : state.numSets === 3
                            ? order3[i]
                            : i === 0
                            ? 1
                            : 0;
                        const reg = state.regions[mask];
                        const meta = getRegionMeta(mask);
                        const centerInfo = regionCenters[mask];

                        return (
                          <div
                            key={mask}
                            className={`p-2.5 rounded-lg border transition-colors ${
                              reg.shaded
                                ? 'bg-gray-100 border-gray-400'
                                : 'bg-white border-gray-200'
                            }`}
                          >
                            <div className="flex items-center justify-between mb-1.5">
                              <div className="flex items-center gap-2">
                                <span className="font-serif font-bold text-sm text-gray-900 bg-gray-100 px-1.5 py-0.5 rounded border border-gray-300">
                                  {meta.notation}
                                </span>
                                <span className="text-xs text-gray-500">{meta.desc}</span>
                              </div>
                              {!centerInfo?.exists && mask !== 0 && (
                                <span
                                  className="text-[10px] bg-amber-50 text-amber-700 px-1.5 py-0.5 rounded border border-amber-200"
                                  title="This intersection does not visually exist in the current set layout"
                                >
                                  Empty in layout
                                </span>
                              )}
                            </div>

                            <div className="flex items-center gap-1.5">
                              <input
                                type="text"
                                value={reg.value}
                                onChange={e => updateRegion(mask, { value: e.target.value })}
                                placeholder="Value or expression..."
                                className="flex-1 border border-gray-300 rounded px-2.5 py-1 text-sm font-serif bg-white"
                              />
                              <button
                                onClick={() => {
                                  forceSnapshot();
                                  updateRegion(mask, { shaded: !reg.shaded });
                                }}
                                className={`p-1.5 rounded border text-xs transition-colors ${
                                  reg.shaded
                                    ? 'bg-gray-800 text-white border-gray-800'
                                    : 'bg-white text-gray-500 border-gray-300 hover:bg-gray-100'
                                }`}
                                title="Toggle region shading"
                              >
                                <PaintBucket size={14} />
                              </button>
                              <button
                                onClick={() => {
                                  forceSnapshot();
                                  updateRegion(mask, { isBlankBox: !reg.isBlankBox });
                                }}
                                className={`p-1.5 rounded border text-xs transition-colors ${
                                  reg.isBlankBox
                                    ? 'bg-gray-800 text-white border-gray-800'
                                    : 'bg-white text-gray-500 border-gray-300 hover:bg-gray-100'
                                }`}
                                title="Render as blank answer box [ ] for worksheets"
                              >
                                <Square size={14} />
                              </button>
                              <button
                                onClick={() => {
                                  forceSnapshot();
                                  updateRegion(mask, { hidden: !reg.hidden });
                                }}
                                className={`p-1.5 rounded border text-xs transition-colors ${
                                  reg.hidden
                                    ? 'bg-gray-800 text-white border-gray-800'
                                    : 'bg-white text-gray-500 border-gray-300 hover:bg-gray-100'
                                }`}
                                title={reg.hidden ? 'Show region value' : 'Hide region value'}
                              >
                                {reg.hidden ? <EyeOff size={14} /> : <Eye size={14} />}
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    {/* Live Calculated Summary Card */}
                    {computedTotals.grandTotal !== null && (
                      <div className="p-3 bg-gray-50 rounded-lg border border-gray-200 text-xs space-y-1">
                        <div className="font-bold text-gray-700 uppercase tracking-wider mb-1">
                          Calculated Set Totals
                        </div>
                        <div className="flex flex-wrap gap-x-4 gap-y-1 font-serif text-sm text-gray-800">
                          {activeSets.map((s, idx) => (
                            <span key={s.id}>
                              <i>n</i>({s.label}) = <b>{computedTotals.setSums[idx] ?? '—'}</b>
                            </span>
                          ))}
                          <span>
                            <i>n</i>(&xi;) = <b>{computedTotals.grandTotal}</b>
                          </span>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* METHOD 2: SET TOTALS SOLVER (INCLUSION-EXCLUSION) */}
                {inputMethod === 'totals' && (
                  <div className="space-y-3 bg-gray-50 p-3 rounded-lg border border-gray-200">
                    <div className="text-xs text-gray-600 leading-relaxed">
                      Enter total set cardinalities or probabilities below. The Inclusion-Exclusion solver will automatically compute each exclusive region.
                    </div>

                    <div className="grid grid-cols-2 gap-2.5">
                      <div>
                        <label className="block text-xs font-serif font-bold text-gray-700 mb-1">
                          n({state.sets[0]?.label || 'A'}) Total
                        </label>
                        <input
                          type="number"
                          step="any"
                          value={state.totalsInput.nA}
                          onChange={e =>
                            updateState(prev => ({
                              ...prev,
                              totalsInput: { ...prev.totalsInput, nA: e.target.value }
                            }))
                          }
                          className="w-full border border-gray-300 rounded px-2.5 py-1.5 text-sm bg-white"
                        />
                      </div>

                      {state.numSets >= 2 && (
                        <div>
                          <label className="block text-xs font-serif font-bold text-gray-700 mb-1">
                            n({state.sets[1]?.label || 'B'}) Total
                          </label>
                          <input
                            type="number"
                            step="any"
                            value={state.totalsInput.nB}
                            onChange={e =>
                              updateState(prev => ({
                                ...prev,
                                totalsInput: { ...prev.totalsInput, nB: e.target.value }
                              }))
                            }
                            className="w-full border border-gray-300 rounded px-2.5 py-1.5 text-sm bg-white"
                          />
                        </div>
                      )}

                      {state.numSets >= 3 && (
                        <div>
                          <label className="block text-xs font-serif font-bold text-gray-700 mb-1">
                            n({state.sets[2]?.label || 'C'}) Total
                          </label>
                          <input
                            type="number"
                            step="any"
                            value={state.totalsInput.nC}
                            onChange={e =>
                              updateState(prev => ({
                                ...prev,
                                totalsInput: { ...prev.totalsInput, nC: e.target.value }
                              }))
                            }
                            className="w-full border border-gray-300 rounded px-2.5 py-1.5 text-sm bg-white"
                          />
                        </div>
                      )}

                      {state.numSets >= 2 && (
                        <div>
                          <label className="block text-xs font-serif font-bold text-gray-700 mb-1">
                            n({state.sets[0]?.label || 'A'} ∩ {state.sets[1]?.label || 'B'})
                          </label>
                          <input
                            type="number"
                            step="any"
                            value={state.totalsInput.nAB}
                            onChange={e =>
                              updateState(prev => ({
                                ...prev,
                                totalsInput: { ...prev.totalsInput, nAB: e.target.value }
                              }))
                            }
                            className="w-full border border-gray-300 rounded px-2.5 py-1.5 text-sm bg-white"
                          />
                        </div>
                      )}

                      {state.numSets >= 3 && (
                        <>
                          <div>
                            <label className="block text-xs font-serif font-bold text-gray-700 mb-1">
                              n({state.sets[0]?.label || 'A'} ∩ {state.sets[2]?.label || 'C'})
                            </label>
                            <input
                              type="number"
                              step="any"
                              value={state.totalsInput.nAC}
                              onChange={e =>
                                updateState(prev => ({
                                  ...prev,
                                  totalsInput: { ...prev.totalsInput, nAC: e.target.value }
                                }))
                              }
                              className="w-full border border-gray-300 rounded px-2.5 py-1.5 text-sm bg-white"
                            />
                          </div>
                          <div>
                            <label className="block text-xs font-serif font-bold text-gray-700 mb-1">
                              n({state.sets[1]?.label || 'B'} ∩ {state.sets[2]?.label || 'C'})
                            </label>
                            <input
                              type="number"
                              step="any"
                              value={state.totalsInput.nBC}
                              onChange={e =>
                                updateState(prev => ({
                                  ...prev,
                                  totalsInput: { ...prev.totalsInput, nBC: e.target.value }
                                }))
                              }
                              className="w-full border border-gray-300 rounded px-2.5 py-1.5 text-sm bg-white"
                            />
                          </div>
                          <div className="col-span-2">
                            <label className="block text-xs font-serif font-bold text-gray-700 mb-1">
                              n({state.sets[0]?.label || 'A'} ∩ {state.sets[1]?.label || 'B'} ∩{' '}
                              {state.sets[2]?.label || 'C'}) (Center All 3)
                            </label>
                            <input
                              type="number"
                              step="any"
                              value={state.totalsInput.nABC}
                              onChange={e =>
                                updateState(prev => ({
                                  ...prev,
                                  totalsInput: { ...prev.totalsInput, nABC: e.target.value }
                                }))
                              }
                              className="w-full border border-gray-300 rounded px-2.5 py-1.5 text-sm bg-white"
                            />
                          </div>
                        </>
                      )}
                    </div>

                    <div className="pt-2 border-t border-gray-200 space-y-2">
                      <div className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          id="useOutsideToggle"
                          checked={state.totalsInput.useOutsideInsteadOfU}
                          onChange={e =>
                            updateState(prev => ({
                              ...prev,
                              totalsInput: {
                                ...prev.totalsInput,
                                useOutsideInsteadOfU: e.target.checked
                              }
                            }))
                          }
                          className="rounded border-gray-300 text-gray-900"
                        />
                        <label htmlFor="useOutsideToggle" className="text-xs text-gray-700">
                          Specify Outside region directly instead of Universal Total n(&xi;)
                        </label>
                      </div>

                      {state.totalsInput.useOutsideInsteadOfU ? (
                        <div>
                          <label className="block text-xs font-serif font-bold text-gray-700 mb-1">
                            n(Outside / Neither)
                          </label>
                          <input
                            type="number"
                            step="any"
                            value={state.totalsInput.nOutside}
                            onChange={e =>
                              updateState(prev => ({
                                ...prev,
                                totalsInput: { ...prev.totalsInput, nOutside: e.target.value }
                              }))
                            }
                            className="w-full border border-gray-300 rounded px-2.5 py-1.5 text-sm bg-white"
                          />
                        </div>
                      ) : (
                        <div>
                          <label className="block text-xs font-serif font-bold text-gray-700 mb-1">
                            n(&xi;) Universal Set Total
                          </label>
                          <input
                            type="number"
                            step="any"
                            value={state.totalsInput.totalU}
                            onChange={e =>
                              updateState(prev => ({
                                ...prev,
                                totalsInput: { ...prev.totalsInput, totalU: e.target.value }
                              }))
                            }
                            className="w-full border border-gray-300 rounded px-2.5 py-1.5 text-sm bg-white"
                          />
                        </div>
                      )}
                    </div>

                    <button
                      onClick={handleSolveTotals}
                      className="w-full py-2 bg-gray-900 hover:bg-black text-white text-xs font-semibold rounded-md shadow-sm flex items-center justify-center gap-1.5 transition-colors"
                    >
                      <Calculator size={14} /> Solve &amp; Populate Regions
                    </button>

                    {solverMessage && (
                      <div
                        className={`p-2.5 rounded border text-xs flex items-start gap-2 ${
                          solverMessage.type === 'warn'
                            ? 'bg-amber-50 border-amber-300 text-amber-800'
                            : 'bg-white border-gray-300 text-gray-800'
                        }`}
                      >
                        {solverMessage.type === 'warn' ? (
                          <AlertCircle size={14} className="shrink-0 mt-0.5 text-amber-600" />
                        ) : (
                          <Check size={14} className="shrink-0 mt-0.5 text-gray-700" />
                        )}
                        <span>{solverMessage.text}</span>
                      </div>
                    )}
                  </div>
                )}

                {/* METHOD 3: ELEMENT / MEMBERSHIP LISTS */}
                {inputMethod === 'elements' && (
                  <div className="space-y-3 bg-gray-50 p-3 rounded-lg border border-gray-200">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-gray-700 uppercase">
                        Set Elements (Comma-Separated)
                      </span>
                      <button
                        onClick={() => {
                          const nums = Array.from({ length: 12 }, (_, i) => i + 1).join(', ');
                          const next = { ...state.elementLists, universal: nums };
                          applyElementLists(next);
                        }}
                        className="text-[11px] text-gray-600 underline hover:text-black"
                      >
                        Fill ξ = 1..12
                      </button>
                    </div>

                    <div>
                      <label className="block text-xs font-serif font-semibold text-gray-700 mb-1">
                        Universal Set &xi;
                      </label>
                      <textarea
                        rows={2}
                        value={state.elementLists.universal}
                        onChange={e =>
                          updateState(prev => ({
                            ...prev,
                            elementLists: { ...prev.elementLists, universal: e.target.value }
                          }))
                        }
                        className="w-full border border-gray-300 rounded px-2 py-1 text-xs font-serif bg-white"
                        placeholder="e.g. 1, 2, 3, 4, 5, 6, 7, 8, 9, 10"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-serif font-semibold text-gray-700 mb-1">
                        Set {state.sets[0]?.label || 'A'} Elements
                      </label>
                      <input
                        type="text"
                        value={state.elementLists.setA}
                        onChange={e =>
                          updateState(prev => ({
                            ...prev,
                            elementLists: { ...prev.elementLists, setA: e.target.value }
                          }))
                        }
                        className="w-full border border-gray-300 rounded px-2 py-1.5 text-xs font-serif bg-white"
                        placeholder="e.g. 2, 4, 6, 8, 10"
                      />
                    </div>

                    {state.numSets >= 2 && (
                      <div>
                        <label className="block text-xs font-serif font-semibold text-gray-700 mb-1">
                          Set {state.sets[1]?.label || 'B'} Elements
                        </label>
                        <input
                          type="text"
                          value={state.elementLists.setB}
                          onChange={e =>
                            updateState(prev => ({
                              ...prev,
                              elementLists: { ...prev.elementLists, setB: e.target.value }
                            }))
                          }
                          className="w-full border border-gray-300 rounded px-2 py-1.5 text-xs font-serif bg-white"
                          placeholder="e.g. 3, 6, 9, 12"
                        />
                      </div>
                    )}

                    {state.numSets >= 3 && (
                      <div>
                        <label className="block text-xs font-serif font-semibold text-gray-700 mb-1">
                          Set {state.sets[2]?.label || 'C'} Elements
                        </label>
                        <input
                          type="text"
                          value={state.elementLists.setC}
                          onChange={e =>
                            updateState(prev => ({
                              ...prev,
                              elementLists: { ...prev.elementLists, setC: e.target.value }
                            }))
                          }
                          className="w-full border border-gray-300 rounded px-2 py-1.5 text-xs font-serif bg-white"
                          placeholder="e.g. 1, 2, 3, 4"
                        />
                      </div>
                    )}

                    <div className="flex items-center justify-between pt-1">
                      <span className="text-xs font-medium text-gray-700">Display in Regions:</span>
                      <div className="flex bg-white rounded border border-gray-300 p-0.5">
                        <button
                          onClick={() => {
                            const next = {
                              ...state.elementLists,
                              displayMode: 'elements' as const
                            };
                            applyElementLists(next);
                          }}
                          className={`px-2 py-1 text-xs rounded ${
                            state.elementLists.displayMode === 'elements'
                              ? 'bg-gray-800 text-white'
                              : 'text-gray-600'
                          }`}
                        >
                          Elements
                        </button>
                        <button
                          onClick={() => {
                            const next = {
                              ...state.elementLists,
                              displayMode: 'counts' as const
                            };
                            applyElementLists(next);
                          }}
                          className={`px-2 py-1 text-xs rounded ${
                            state.elementLists.displayMode === 'counts'
                              ? 'bg-gray-800 text-white'
                              : 'text-gray-600'
                          }`}
                        >
                          Counts n(...)
                        </button>
                      </div>
                    </div>

                    <button
                      onClick={() => applyElementLists()}
                      className="w-full py-2 bg-gray-900 hover:bg-black text-white text-xs font-semibold rounded-md shadow-sm flex items-center justify-center gap-1.5 transition-colors"
                    >
                      <Sparkles size={14} /> Sort Elements into Venn Regions
                    </button>
                  </div>
                )}

                {/* METHOD 4: TWO-WAY TABLE / KARNAUGH MAP (2 SETS) */}
                {inputMethod === 'twoway' && state.numSets === 2 && (
                  <div className="space-y-3 bg-gray-50 p-3 rounded-lg border border-gray-200">
                    <div className="text-xs text-gray-600">
                      Edit the 4 interior cells of the Two-Way Table to directly update the Venn diagram regions:
                    </div>

                    {(() => {
                      const lA = state.sets[0]?.label || 'A';
                      const lB = state.sets[1]?.label || 'B';
                      const vAB = state.regions[3]?.value || '';
                      const vAOnly = state.regions[1]?.value || '';
                      const vBOnly = state.regions[2]?.value || '';
                      const vOut = state.regions[0]?.value || '';

                      const nAB = parseFloat(vAB) || 0;
                      const nAOnly = parseFloat(vAOnly) || 0;
                      const nBOnly = parseFloat(vBOnly) || 0;
                      const nOut = parseFloat(vOut) || 0;

                      return (
                        <div className="overflow-x-auto">
                          <table className="w-full border-collapse bg-white text-center font-serif text-sm border border-gray-300">
                            <thead>
                              <tr className="bg-gray-100">
                                <th className="border border-gray-300 p-1.5"></th>
                                <th className="border border-gray-300 p-1.5 font-bold italic">{lB}</th>
                                <th className="border border-gray-300 p-1.5 font-bold italic">{lB}&apos;</th>
                                <th className="border border-gray-300 p-1.5 font-sans text-xs font-bold text-gray-600">
                                  Total
                                </th>
                              </tr>
                            </thead>
                            <tbody>
                              <tr>
                                <td className="border border-gray-300 p-1.5 bg-gray-100 font-bold italic">
                                  {lA}
                                </td>
                                <td className="border border-gray-300 p-1">
                                  <input
                                    type="text"
                                    value={vAB}
                                    onChange={e => updateRegion(3, { value: e.target.value })}
                                    className="w-16 text-center border border-gray-200 rounded py-1 text-sm"
                                  />
                                </td>
                                <td className="border border-gray-300 p-1">
                                  <input
                                    type="text"
                                    value={vAOnly}
                                    onChange={e => updateRegion(1, { value: e.target.value })}
                                    className="w-16 text-center border border-gray-200 rounded py-1 text-sm"
                                  />
                                </td>
                                <td className="border border-gray-300 p-1.5 bg-gray-50 font-bold text-gray-700">
                                  {Number((nAB + nAOnly).toFixed(4))}
                                </td>
                              </tr>
                              <tr>
                                <td className="border border-gray-300 p-1.5 bg-gray-100 font-bold italic">
                                  {lA}&apos;
                                </td>
                                <td className="border border-gray-300 p-1">
                                  <input
                                    type="text"
                                    value={vBOnly}
                                    onChange={e => updateRegion(2, { value: e.target.value })}
                                    className="w-16 text-center border border-gray-200 rounded py-1 text-sm"
                                  />
                                </td>
                                <td className="border border-gray-300 p-1">
                                  <input
                                    type="text"
                                    value={vOut}
                                    onChange={e => updateRegion(0, { value: e.target.value })}
                                    className="w-16 text-center border border-gray-200 rounded py-1 text-sm"
                                  />
                                </td>
                                <td className="border border-gray-300 p-1.5 bg-gray-50 font-bold text-gray-700">
                                  {Number((nBOnly + nOut).toFixed(4))}
                                </td>
                              </tr>
                              <tr className="bg-gray-50 font-bold text-gray-700">
                                <td className="border border-gray-300 p-1.5 font-sans text-xs">
                                  Total
                                </td>
                                <td className="border border-gray-300 p-1.5">
                                  {Number((nAB + nBOnly).toFixed(4))}
                                </td>
                                <td className="border border-gray-300 p-1.5">
                                  {Number((nAOnly + nOut).toFixed(4))}
                                </td>
                                <td className="border border-gray-300 p-1.5 bg-gray-200 text-gray-900">
                                  {Number((nAB + nAOnly + nBOnly + nOut).toFixed(4))}
                                </td>
                              </tr>
                            </tbody>
                          </table>
                        </div>
                      );
                    })()}

                    <label className="flex items-center gap-2 pt-1 text-xs text-gray-700 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={state.showCompanionTable}
                        onChange={e =>
                          updateState(prev => ({
                            ...prev,
                            showCompanionTable: e.target.checked
                          }))
                        }
                        className="rounded border-gray-300 text-gray-900"
                      />
                      Render Two-Way Table alongside Venn Diagram on Canvas
                    </label>
                  </div>
                )}
              </>
            )}

            {/* ==================== TAB 2: SHADING & SET NOTATION ==================== */}
            {activeTab === 'shading' && (
              <div className="space-y-5">
                {/* Set Notation Expression Shader */}
                <div className="space-y-2.5 bg-gray-50 p-3 rounded-lg border border-gray-200">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold text-gray-700 uppercase tracking-wider">
                      Shade by Set Notation
                    </label>
                    <button
                      onClick={() => {
                        forceSnapshot();
                        updateState(prev => ({
                          ...prev,
                          regions: Object.fromEntries(
                            Object.entries(prev.regions).map(([k, v]) => [
                              k,
                              { ...v, shaded: false }
                            ])
                          )
                        }));
                      }}
                      className="text-[11px] text-gray-500 hover:text-black underline"
                    >
                      Clear All Shading
                    </button>
                  </div>

                  <div className="flex gap-1.5">
                    <input
                      type="text"
                      value={setExpressionInput}
                      onChange={e => setSetExpressionInput(e.target.value)}
                      onKeyDown={e => {
                        if (e.key === 'Enter') handleApplySetExpression();
                      }}
                      placeholder="e.g. (A ∪ B)' or A ∩ B'"
                      className="flex-1 border border-gray-300 rounded px-2.5 py-1.5 text-sm font-serif bg-white"
                    />
                    <button
                      onClick={() => handleApplySetExpression()}
                      className="px-3 py-1.5 bg-gray-900 text-white text-xs font-semibold rounded hover:bg-black transition-colors"
                    >
                      Shade
                    </button>
                  </div>

                  {/* Quick Operator Insert Bar */}
                  <div className="flex flex-wrap gap-1">
                    {[
                      { sym: '∪', title: 'Union' },
                      { sym: '∩', title: 'Intersection' },
                      { sym: "'", title: 'Complement' },
                      { sym: '\\', title: 'Set Difference' },
                      { sym: 'Δ', title: 'Symmetric Difference' },
                      { sym: '(', title: 'Left Parenthesis' },
                      { sym: ')', title: 'Right Parenthesis' }
                    ].map(op => (
                      <button
                        key={op.sym}
                        onClick={() => setSetExpressionInput(prev => prev + op.sym)}
                        className="px-2 py-1 bg-white border border-gray-300 rounded text-xs font-serif font-bold hover:bg-gray-100"
                        title={op.title}
                      >
                        {op.sym}
                      </button>
                    ))}
                  </div>

                  {expressionError && (
                    <div className="text-xs text-red-600 bg-red-50 p-2 rounded border border-red-200">
                      {expressionError}
                    </div>
                  )}

                  {/* Preset Set Notation Chips */}
                  <div className="pt-1">
                    <span className="block text-[11px] font-semibold text-gray-400 uppercase mb-1.5">
                      One-Click Presets
                    </span>
                    <div className="flex flex-wrap gap-1.5">
                      {shadingPresets.map(p => (
                        <button
                          key={p.expr}
                          onClick={() => handleApplySetExpression(p.expr)}
                          className="px-2 py-1 text-xs font-serif bg-white border border-gray-300 rounded hover:bg-gray-800 hover:text-white hover:border-gray-800 transition-colors"
                        >
                          {p.label}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Greyscale Fill & Hatching Pattern Style */}
                <div className="space-y-3">
                  <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider">
                    Shaded Region Fill Tone (Greyscale)
                  </label>
                  <div className="grid grid-cols-7 gap-1.5">
                    {GREYSCALE_SWATCHES.map(sw => (
                      <button
                        key={sw.value}
                        onClick={() => {
                          forceSnapshot();
                          updateState(prev => ({ ...prev, globalShadeColor: sw.value }));
                        }}
                        className={`h-8 rounded border flex items-center justify-center transition-all ${
                          state.globalShadeColor === sw.value
                            ? 'ring-2 ring-gray-900 border-gray-900 scale-105'
                            : 'border-gray-300'
                        }`}
                        style={{ backgroundColor: sw.value }}
                        title={sw.label}
                      >
                        {state.globalShadeColor === sw.value && (
                          <Check
                            size={14}
                            className={
                              sw.value === '#374151' || sw.value === '#6b7280'
                                ? 'text-white'
                                : 'text-gray-900'
                            }
                          />
                        )}
                      </button>
                    ))}
                  </div>

                  <div className="pt-2">
                    <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5">
                      Hatching / Pattern Overlay
                    </label>
                    <select
                      value={state.globalShadePattern}
                      onChange={e => {
                        forceSnapshot();
                        updateState(prev => ({
                          ...prev,
                          globalShadePattern: e.target.value as PatternType
                        }));
                      }}
                      className="w-full border border-gray-300 rounded-md p-2 text-sm bg-white"
                    >
                      {PATTERN_OPTIONS.map(opt => (
                        <option key={opt.value} value={opt.value}>
                          {opt.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  {state.globalShadePattern !== 'none' && (
                    <div className="grid grid-cols-2 gap-3 pt-1">
                      <div>
                        <label className="block text-xs text-gray-600 mb-1">
                          Pattern Spacing ({state.patternSpacing}px)
                        </label>
                        <input
                          type="range"
                          min={5}
                          max={18}
                          step={1}
                          value={state.patternSpacing}
                          onChange={e =>
                            updateState(prev => ({
                              ...prev,
                              patternSpacing: Number(e.target.value)
                            }))
                          }
                          className="w-full accent-gray-800"
                        />
                      </div>
                      <div>
                        <label className="block text-xs text-gray-600 mb-1">
                          Line Weight ({state.patternStrokeWidth}px)
                        </label>
                        <input
                          type="range"
                          min={0.6}
                          max={3}
                          step={0.2}
                          value={state.patternStrokeWidth}
                          onChange={e =>
                            updateState(prev => ({
                              ...prev,
                              patternStrokeWidth: Number(e.target.value)
                            }))
                          }
                          className="w-full accent-gray-800"
                        />
                      </div>
                    </div>
                  )}
                </div>

                {/* Whole-Set Hatching (for visual overlap demonstrations) */}
                <div className="space-y-2.5 pt-3 border-t border-gray-200">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">
                      Whole-Set Hatching (Overlap Demo)
                    </label>
                  </div>
                  <p className="text-[11px] text-gray-500">
                    Optionally assign a pattern to an entire set (e.g. Set A = /// and Set B = \\\) so their intersection naturally crosshatches.
                  </p>
                  <div className="space-y-2">
                    {activeSets.map(set => (
                      <div
                        key={set.id}
                        className="flex items-center justify-between gap-2 bg-gray-50 p-2 rounded border border-gray-200"
                      >
                        <span className="font-serif font-bold text-sm text-gray-800 w-12">
                          Set {set.label}
                        </span>
                        <select
                          value={set.setFillPattern}
                          onChange={e =>
                            updateSet(set.id, { setFillPattern: e.target.value as PatternType })
                          }
                          className="flex-1 border border-gray-300 rounded px-2 py-1 text-xs bg-white"
                        >
                          {PATTERN_OPTIONS.map(opt => (
                            <option key={opt.value} value={opt.value}>
                              {opt.label}
                            </option>
                          ))}
                        </select>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* ==================== TAB 3: APPEARANCE & LAYOUT ==================== */}
            {activeTab === 'style' && (
              <div className="space-y-5">
                {/* Student / Exam Worksheet Mode */}
                <div className="p-3 rounded-lg border border-gray-200 bg-gray-50 space-y-2.5">
                  <label className="flex items-center justify-between cursor-pointer">
                    <div>
                      <span className="block text-xs font-bold text-gray-800 uppercase">
                        Student / Exam Mode
                      </span>
                      <span className="block text-[11px] text-gray-500">
                        Hide all region values for blank student worksheets
                      </span>
                    </div>
                    <input
                      type="checkbox"
                      checked={state.studentMode}
                      onChange={e =>
                        updateState(prev => ({ ...prev, studentMode: e.target.checked }))
                      }
                      className="w-4 h-4 rounded border-gray-300 text-gray-900"
                    />
                  </label>

                  {state.studentMode && (
                    <label className="flex items-center gap-2 text-xs text-gray-700 pt-1 border-t border-gray-200 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={state.studentModeAsBoxes}
                        onChange={e =>
                          updateState(prev => ({
                            ...prev,
                            studentModeAsBoxes: e.target.checked
                          }))
                        }
                        className="rounded border-gray-300 text-gray-900"
                      />
                      Show empty answer boxes [ ] in each region
                    </label>
                  )}

                  <div className="grid grid-cols-2 gap-2 pt-1">
                    <div>
                      <label className="block text-[11px] text-gray-500 mb-0.5">
                        Answer Box Width (px)
                      </label>
                      <input
                        type="number"
                        value={state.blankBoxWidth}
                        onChange={e =>
                          updateState(prev => ({
                            ...prev,
                            blankBoxWidth: Math.max(16, Number(e.target.value) || 34)
                          }))
                        }
                        className="w-full border border-gray-300 rounded px-2 py-1 text-xs bg-white"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] text-gray-500 mb-0.5">
                        Answer Box Height (px)
                      </label>
                      <input
                        type="number"
                        value={state.blankBoxHeight}
                        onChange={e =>
                          updateState(prev => ({
                            ...prev,
                            blankBoxHeight: Math.max(14, Number(e.target.value) || 24)
                          }))
                        }
                        className="w-full border border-gray-300 rounded px-2 py-1 text-xs bg-white"
                      />
                    </div>
                  </div>
                </div>

                {/* Canvas Dimensions (cm) & Title */}
                {/* Canvas Dimensions (cm) & Title */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider">
                      Rectangle Border Dimensions
                    </label>
                    <button
                      onClick={handleFitBorderToShapes}
                      className="text-[11px] text-gray-700 hover:text-black font-medium underline"
                    >
                      Auto-Fit to Shapes
                    </button>
                  </div>

                  {/* Quick Narrower / Wider & Shorter / Taller Buttons */}
                  <div className="grid grid-cols-2 gap-2">
                    <div className="bg-gray-50 p-2 rounded border border-gray-200 space-y-1.5">
                      <div className="flex items-center justify-between text-xs text-gray-600">
                        <span className="font-medium">Width</span>
                        <span className="font-mono font-semibold text-gray-800">
                          {state.dimCm.width} cm
                        </span>
                      </div>
                      <div className="grid grid-cols-2 gap-1">
                        <button
                          onClick={() => handleResizeBoxCm(-1, 0)}
                          className="px-2 py-1 bg-white hover:bg-gray-100 border border-gray-300 rounded text-[11px] font-medium text-gray-700 flex items-center justify-center gap-1"
                        >
                          <Minimize2 size={11} /> Narrower
                        </button>
                        <button
                          onClick={() => handleResizeBoxCm(1, 0)}
                          className="px-2 py-1 bg-white hover:bg-gray-100 border border-gray-300 rounded text-[11px] font-medium text-gray-700 flex items-center justify-center gap-1"
                        >
                          <Maximize2 size={11} /> Wider
                        </button>
                      </div>
                    </div>

                    <div className="bg-gray-50 p-2 rounded border border-gray-200 space-y-1.5">
                      <div className="flex items-center justify-between text-xs text-gray-600">
                        <span className="font-medium">Height</span>
                        <span className="font-mono font-semibold text-gray-800">
                          {state.dimCm.height} cm
                        </span>
                      </div>
                      <div className="grid grid-cols-2 gap-1">
                        <button
                          onClick={() => handleResizeBoxCm(0, -0.8)}
                          className="px-2 py-1 bg-white hover:bg-gray-100 border border-gray-300 rounded text-[11px] font-medium text-gray-700 flex items-center justify-center gap-1"
                        >
                          <Minimize2 size={11} /> Shorter
                        </button>
                        <button
                          onClick={() => handleResizeBoxCm(0, 0.8)}
                          className="px-2 py-1 bg-white hover:bg-gray-100 border border-gray-300 rounded text-[11px] font-medium text-gray-700 flex items-center justify-center gap-1"
                        >
                          <Maximize2 size={11} /> Taller
                        </button>
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2.5">
                    <div>
                      <label className="block text-xs text-gray-600 mb-1">Exact Width (cm)</label>
                      <input
                        type="number"
                        step="0.5"
                        min="6"
                        max="32"
                        value={state.dimCm.width}
                        onChange={e =>
                          updateState(prev => ({
                            ...prev,
                            dimCm: {
                              ...prev.dimCm,
                              width: Math.max(6, parseFloat(e.target.value) || 14)
                            }
                          }))
                        }
                        className="w-full border border-gray-300 rounded px-2.5 py-1.5 text-sm"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-gray-600 mb-1">Exact Height (cm)</label>
                      <input
                        type="number"
                        step="0.5"
                        min="5"
                        max="26"
                        value={state.dimCm.height}
                        onChange={e =>
                          updateState(prev => ({
                            ...prev,
                            dimCm: {
                              ...prev.dimCm,
                              height: Math.max(5, parseFloat(e.target.value) || 10)
                            }
                          }))
                        }
                        className="w-full border border-gray-300 rounded px-2.5 py-1.5 text-sm"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs text-gray-600 mb-1">
                      Diagram Title (Optional)
                    </label>
                    <input
                      type="text"
                      value={state.chartTitle}
                      onChange={e =>
                        updateState(prev => ({ ...prev, chartTitle: e.target.value }))
                      }
                      placeholder="e.g. Year 10 Subject Selection"
                      className="w-full border border-gray-300 rounded px-2.5 py-1.5 text-sm font-serif"
                    />
                  </div>
                </div>

                {/* Universal Set Configuration */}
                <div className="space-y-3 pt-3 border-t border-gray-200">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">
                      Universal Set Corner Label
                    </label>
                    <label className="flex items-center gap-1.5 text-xs text-gray-700 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={state.showUniversalBox}
                        onChange={e =>
                          updateState(prev => ({
                            ...prev,
                            showUniversalBox: e.target.checked
                          }))
                        }
                        className="rounded border-gray-300 text-gray-900"
                      />
                      Show Outer Box
                    </label>
                  </div>

                  <div className="grid grid-cols-2 gap-2.5">
                    <div>
                      <label className="block text-xs text-gray-600 mb-1">Corner Label Position</label>
                      <select
                        value={state.universalLabelPos}
                        onChange={e =>
                          updateState(prev => ({
                            ...prev,
                            universalLabelPos: e.target.value as VennState['universalLabelPos']
                          }))
                        }
                        className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm bg-white"
                      >
                        <option value="none">None (Hidden)</option>
                        <option value="outside-top-left">Outside Top-Left</option>
                        <option value="inside-top-left">Inside Top-Left</option>
                        <option value="outside-top-right">Outside Top-Right</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs text-gray-600 mb-1">Symbol</label>
                      <select
                        value={state.universalSymbol}
                        onChange={e =>
                          updateState(prev => ({ ...prev, universalSymbol: e.target.value }))
                        }
                        disabled={state.universalLabelPos === 'none'}
                        className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm font-serif bg-white disabled:opacity-50"
                      >
                        <option value="U">U (Universal)</option>
                        <option value="ξ">ξ (Xi)</option>
                        <option value="ℰ">ℰ (Curly E)</option>
                        <option value="S">S (Sample Space)</option>
                        <option value="Ω">Ω (Omega)</option>
                      </select>
                    </div>
                  </div>

                  {state.universalLabelPos !== 'none' && (
                    <div className="flex items-center justify-between gap-2">
                      <label className="flex items-center gap-2 text-xs text-gray-700 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={state.showUniversalTotal}
                          onChange={e =>
                            updateState(prev => ({
                              ...prev,
                              showUniversalTotal: e.target.checked
                            }))
                          }
                          className="rounded border-gray-300 text-gray-900"
                        />
                        Show Total next to Symbol
                      </label>
                      {state.showUniversalTotal && (
                        <input
                          type="text"
                          value={state.universalTotal}
                          onChange={e =>
                            updateState(prev => ({ ...prev, universalTotal: e.target.value }))
                          }
                          placeholder={
                            computedTotals.grandTotal !== null
                              ? `Auto (${computedTotals.grandTotal})`
                              : 'Total...'
                          }
                          className="w-28 border border-gray-300 rounded px-2 py-1 text-xs font-serif"
                        />
                      )}
                    </div>
                  )}
                </div>

                {/* Typography & Labels */}
                <div className="space-y-3 pt-3 border-t border-gray-200">
                  <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider">
                    Typography (Times New Roman)
                  </label>
                  <div className="grid grid-cols-2 gap-2.5">
                    <div>
                      <label className="block text-xs text-gray-600 mb-1">
                        Region Font Size (pt)
                      </label>
                      <input
                        type="number"
                        min={8}
                        max={28}
                        value={state.fontSize}
                        onChange={e =>
                          updateState(prev => ({
                            ...prev,
                            fontSize: Math.max(8, Number(e.target.value) || 12)
                          }))
                        }
                        className="w-full border border-gray-300 rounded px-2.5 py-1.5 text-sm"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-gray-600 mb-1">
                        Set Label Size (pt)
                      </label>
                      <input
                        type="number"
                        min={8}
                        max={32}
                        value={state.setLabelFontSize}
                        onChange={e =>
                          updateState(prev => ({
                            ...prev,
                            setLabelFontSize: Math.max(8, Number(e.target.value) || 13)
                          }))
                        }
                        className="w-full border border-gray-300 rounded px-2.5 py-1.5 text-sm"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2.5">
                    <div>
                      <label className="block text-xs text-gray-600 mb-1">
                        Set Label Placement
                      </label>
                      <select
                        value={state.setLabelPosition}
                        onChange={e =>
                          updateState(prev => ({
                            ...prev,
                            setLabelPosition: e.target.value as 'inside' | 'outside'
                          }))
                        }
                        className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm bg-white"
                      >
                        <option value="inside">Inside Set Perimeter</option>
                        <option value="outside">Outside Set Perimeter</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs text-gray-600 mb-1">
                        Outside Region Corner
                      </label>
                      <select
                        value={state.outsideValueCorner}
                        onChange={e =>
                          updateState(prev => ({
                            ...prev,
                            outsideValueCorner: e.target.value as VennState['outsideValueCorner']
                          }))
                        }
                        className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm bg-white"
                      >
                        <option value="bottom-right">Bottom-Right</option>
                        <option value="bottom-left">Bottom-Left</option>
                        <option value="top-right">Top-Right</option>
                      </select>
                    </div>
                  </div>

                  <label className="flex items-center gap-2 text-xs text-gray-700 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={state.showSetTotalsInLabels}
                      onChange={e =>
                        updateState(prev => ({
                          ...prev,
                          showSetTotalsInLabels: e.target.checked
                        }))
                      }
                      className="rounded border-gray-300 text-gray-900"
                    />
                    Show Set Total in Set Label (e.g. A (17))
                  </label>

                  <label className="flex items-center gap-2 text-xs text-gray-700 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={state.showRegionNotationOnCanvas}
                      onChange={e =>
                        updateState(prev => ({
                          ...prev,
                          showRegionNotationOnCanvas: e.target.checked
                        }))
                      }
                      className="rounded border-gray-300 text-gray-900"
                    />
                    Display Set Notation in Regions (e.g. A &cap; B)
                  </label>
                </div>

                {/* Outlines & Individual Set Geometry */}
                <div className="space-y-3 pt-3 border-t border-gray-200">
                  <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider">
                    Set Borders &amp; Geometry
                  </label>

                  {state.shapeType === 'rectangle' && (
                    <div>
                      <label className="block text-xs text-gray-600 mb-1">
                        Rectangle Corner Radius ({state.rectCornerRadius}px)
                      </label>
                      <input
                        type="range"
                        min={0}
                        max={24}
                        step={1}
                        value={state.rectCornerRadius}
                        onChange={e =>
                          updateState(prev => ({
                            ...prev,
                            rectCornerRadius: Number(e.target.value)
                          }))
                        }
                        className="w-full accent-gray-800"
                      />
                    </div>
                  )}

                  {activeSets.map(set => (
                    <div
                      key={set.id}
                      className="p-2.5 bg-gray-50 rounded-lg border border-gray-200 space-y-2"
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-serif font-bold text-xs text-gray-800">
                          Set {set.label}
                        </span>
                        <div className="flex items-center gap-1.5">
                          <select
                            value={set.strokeStyle}
                            onChange={e =>
                              updateSet(set.id, {
                                strokeStyle: e.target.value as VennSetDef['strokeStyle']
                              })
                            }
                            className="border border-gray-300 rounded px-1.5 py-0.5 text-xs bg-white"
                          >
                            <option value="solid">Solid</option>
                            <option value="dashed">Dashed</option>
                            <option value="dotted">Dotted</option>
                          </select>
                        </div>
                      </div>
                      <div className="grid grid-cols-4 gap-1.5 text-[11px]">
                        <div>
                          <span className="text-gray-400 block">X</span>
                          <input
                            type="number"
                            value={set.cx}
                            onChange={e => updateSet(set.id, { cx: Number(e.target.value) || 0 })}
                            className="w-full border border-gray-300 rounded px-1.5 py-0.5 bg-white"
                          />
                        </div>
                        <div>
                          <span className="text-gray-400 block">Y</span>
                          <input
                            type="number"
                            value={set.cy}
                            onChange={e => updateSet(set.id, { cy: Number(e.target.value) || 0 })}
                            className="w-full border border-gray-300 rounded px-1.5 py-0.5 bg-white"
                          />
                        </div>
                        <div>
                          <span className="text-gray-400 block">
                            {state.shapeType === 'rectangle' ? 'W/2' : 'Rx'}
                          </span>
                          <input
                            type="number"
                            min={15}
                            value={set.rx}
                            onChange={e => {
                              const val = Math.max(15, Number(e.target.value) || 50);
                              updateSet(
                                set.id,
                                state.shapeType === 'circle' ? { rx: val, ry: val } : { rx: val }
                              );
                            }}
                            className="w-full border border-gray-300 rounded px-1.5 py-0.5 bg-white"
                          />
                        </div>
                        {state.shapeType !== 'circle' && (
                          <div>
                            <span className="text-gray-400 block">
                              {state.shapeType === 'rectangle' ? 'H/2' : 'Ry'}
                            </span>
                            <input
                              type="number"
                              min={15}
                              value={set.ry}
                              onChange={e =>
                                updateSet(set.id, {
                                  ry: Math.max(15, Number(e.target.value) || 50)
                                })
                              }
                              className="w-full border border-gray-300 rounded px-1.5 py-0.5 bg-white"
                            />
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Interactive Tips Footer */}
          <div className="p-3 bg-gray-50 border-t border-gray-200 text-[11px] text-gray-500 flex items-start gap-2">
            <HelpCircle size={14} className="shrink-0 mt-0.5 text-gray-400" />
            <span>
              <b>Tip:</b> Use the <b>Quick Resize Bar</b> above the canvas or drag the square handles on any shape or outer rectangle border to resize.
            </span>
          </div>
        </aside>

        {/* Main SVG Canvas Area + Top Quick Resize Toolbar */}
        <div className="flex-1 flex flex-col overflow-hidden bg-gray-200">
          {/* Quick Resize & Manipulation Bar */}
          <div className="bg-white border-b border-gray-200 px-4 py-2 flex flex-wrap items-center justify-between gap-3 text-xs shadow-xs z-10">
            {/* Rectangle Border Quick Resize Buttons */}
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="font-bold text-gray-600 uppercase tracking-wider text-[11px] mr-1 flex items-center gap-1">
                <Square size={12} className="text-gray-500" /> Rectangle Border:
              </span>
              <div className="inline-flex rounded-md border border-gray-300 bg-gray-50 p-0.5 gap-0.5">
                <button
                  onClick={() => handleResizeBoxCm(-1, 0)}
                  className="px-2 py-1 rounded bg-white hover:bg-gray-100 text-gray-700 font-medium flex items-center gap-1 border border-gray-200 transition-colors"
                  title="Make outer rectangle border narrower"
                >
                  <MoveHorizontal size={12} /> Narrower
                </button>
                <button
                  onClick={() => handleResizeBoxCm(1, 0)}
                  className="px-2 py-1 rounded bg-white hover:bg-gray-100 text-gray-700 font-medium flex items-center gap-1 border border-gray-200 transition-colors"
                  title="Make outer rectangle border wider"
                >
                  <MoveHorizontal size={12} /> Wider
                </button>
              </div>

              <div className="inline-flex rounded-md border border-gray-300 bg-gray-50 p-0.5 gap-0.5">
                <button
                  onClick={() => handleResizeBoxCm(0, -0.8)}
                  className="px-2 py-1 rounded bg-white hover:bg-gray-100 text-gray-700 font-medium flex items-center gap-1 border border-gray-200 transition-colors"
                  title="Make outer rectangle border shorter"
                >
                  <MoveVertical size={12} /> Shorter
                </button>
                <button
                  onClick={() => handleResizeBoxCm(0, 0.8)}
                  className="px-2 py-1 rounded bg-white hover:bg-gray-100 text-gray-700 font-medium flex items-center gap-1 border border-gray-200 transition-colors"
                  title="Make outer rectangle border taller"
                >
                  <MoveVertical size={12} /> Taller
                </button>
              </div>

              <button
                onClick={handleFitBorderToShapes}
                className="px-2 py-1 rounded border border-gray-300 bg-white hover:bg-gray-100 text-gray-700 font-medium transition-colors"
                title="Automatically fit the rectangle border around the Venn shapes"
              >
                Fit Border
              </button>
            </div>

            {/* Circles / Shapes Quick Resize Buttons */}
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="font-bold text-gray-600 uppercase tracking-wider text-[11px] mr-0.5 flex items-center gap-1">
                <CircleDot size={12} className="text-gray-500" /> Resize Shapes:
              </span>

              {/* Target selector: All vs individual Set A / B / C */}
              <div className="inline-flex rounded-md border border-gray-300 bg-gray-100 p-0.5">
                <button
                  onClick={() => setSelectedSetId('all')}
                  className={`px-2 py-0.5 rounded text-[11px] font-semibold transition-colors ${
                    selectedSetId === 'all'
                      ? 'bg-gray-800 text-white'
                      : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  All
                </button>
                {activeSets.map(s => (
                  <button
                    key={s.id}
                    onClick={() => setSelectedSetId(s.id)}
                    className={`px-2 py-0.5 rounded text-[11px] font-serif font-bold transition-colors ${
                      selectedSetId === s.id
                        ? 'bg-gray-800 text-white'
                        : 'text-gray-700 hover:text-gray-900'
                    }`}
                  >
                    Set {s.label}
                  </button>
                ))}
              </div>

              {/* Smaller / Larger */}
              <div className="inline-flex rounded-md border border-gray-300 bg-gray-50 p-0.5 gap-0.5">
                <button
                  onClick={() => handleResizeShapes(-8, -8)}
                  className="px-2 py-1 rounded bg-white hover:bg-gray-100 text-gray-700 font-medium flex items-center gap-1 border border-gray-200 transition-colors"
                  title="Make selected circle(s)/shape(s) smaller"
                >
                  <Minus size={12} /> Smaller
                </button>
                <button
                  onClick={() => handleResizeShapes(8, 8)}
                  className="px-2 py-1 rounded bg-white hover:bg-gray-100 text-gray-700 font-medium flex items-center gap-1 border border-gray-200 transition-colors"
                  title="Make selected circle(s)/shape(s) larger"
                >
                  <Plus size={12} /> Larger
                </button>
              </div>

              {/* Independent Width/Height buttons when using Ellipses or Rectangles */}
              {state.shapeType !== 'circle' && (
                <div className="inline-flex rounded-md border border-gray-300 bg-gray-50 p-0.5 gap-0.5">
                  <button
                    onClick={() => handleResizeShapes(-8, 0)}
                    className="px-1.5 py-1 rounded bg-white hover:bg-gray-100 text-gray-700 font-medium border border-gray-200"
                    title="Make shape(s) narrower"
                  >
                    Narrower
                  </button>
                  <button
                    onClick={() => handleResizeShapes(8, 0)}
                    className="px-1.5 py-1 rounded bg-white hover:bg-gray-100 text-gray-700 font-medium border border-gray-200"
                    title="Make shape(s) wider"
                  >
                    Wider
                  </button>
                  <button
                    onClick={() => handleResizeShapes(0, -8)}
                    className="px-1.5 py-1 rounded bg-white hover:bg-gray-100 text-gray-700 font-medium border border-gray-200"
                    title="Make shape(s) shorter"
                  >
                    Shorter
                  </button>
                  <button
                    onClick={() => handleResizeShapes(0, 8)}
                    className="px-1.5 py-1 rounded bg-white hover:bg-gray-100 text-gray-700 font-medium border border-gray-200"
                    title="Make shape(s) taller"
                  >
                    Taller
                  </button>
                </div>
              )}

              {/* Overlap / Spacing buttons when 2 or 3 sets */}
              {state.numSets >= 2 && (
                <div className="inline-flex rounded-md border border-gray-300 bg-gray-50 p-0.5 gap-0.5">
                  <button
                    onClick={() => handleAdjustSetSpacing(-8)}
                    className="px-2 py-1 rounded bg-white hover:bg-gray-100 text-gray-700 font-medium border border-gray-200 transition-colors"
                    title="Move sets closer together (increase overlap)"
                  >
                    Closer
                  </button>
                  <button
                    onClick={() => handleAdjustSetSpacing(8)}
                    className="px-2 py-1 rounded bg-white hover:bg-gray-100 text-gray-700 font-medium border border-gray-200 transition-colors"
                    title="Move sets further apart (decrease overlap)"
                  >
                    Apart
                  </button>
                </div>
              )}
            </div>
          </div>

          <main
            ref={containerRef}
            className="flex-1 bg-gray-200 overflow-auto p-8 flex items-center justify-center relative"
          >
            <div
              style={{
                width: widthPixels * previewScale,
                height: heightPixels * previewScale,
                margin: 'auto'
              }}
              className="relative shrink-0 shadow-lg bg-white border border-gray-300"
            >
              <div
                style={{
                  width: widthPixels,
                  height: heightPixels,
                  transform: `scale(${previewScale})`,
                  transformOrigin: 'top left'
                }}
                className="relative"
              >
                <svg
                  id="venn-svg"
                  width={widthPixels}
                  height={heightPixels}
                  viewBox={customViewBox || `0 0 ${widthPixels} ${heightPixels}`}
                  xmlns="http://www.w3.org/2000/svg"
                  className="w-full h-full block"
                  style={{
                    background: '#ffffff',
                    cursor: cropMode
                      ? 'crosshair'
                      : canvasTool === 'shade'
                      ? 'pointer'
                      : 'default'
                  }}
                  onMouseDown={handleSvgMouseDown}
                >
                  {/* Definitions: Patterns, ClipPaths, Exclusion Masks */}
                  <defs>
                    {renderPatternDefs()}

                    {/* Universal Box ClipPath */}
                    <clipPath id="venn-clip-universal">
                      <rect
                        x={boxGeometry.x}
                        y={boxGeometry.y}
                        width={boxGeometry.w}
                        height={boxGeometry.h}
                      />
                    </clipPath>

                    {/* Individual Set ClipPaths */}
                    {activeSets.map(set => (
                      <clipPath key={`clip-${set.id}`} id={`venn-clip-set-${set.id}`}>
                        {renderSetShapeElement(set, `clip-shape-${set.id}`)}
                      </clipPath>
                    ))}

                    {/* Exclusion Masks for each exclusive region m */}
                    {Array.from({ length: totalRegions }).map((_, m) => (
                      <mask key={`mask-${m}`} id={`venn-exclude-mask-${m}`}>
                        <rect
                          x={0}
                          y={0}
                          width={widthPixels}
                          height={heightPixels}
                          fill="#ffffff"
                        />
                        {activeSets.map((set, sIdx) => {
                          const isIncluded = (m & (1 << sIdx)) !== 0;
                          if (isIncluded) return null;
                          return renderSetShapeElement(set, `mask-ex-${m}-${sIdx}`, {
                            fill: '#000000',
                            stroke: 'none'
                          });
                        })}
                      </mask>
                    ))}
                  </defs>

                  {/* White Background */}
                  <rect x={0} y={0} width={widthPixels} height={heightPixels} fill="#ffffff" />

                  {/* Optional Chart Title */}
                  {state.chartTitle && (
                    <g className="title-layer">
                      <text
                        x={boxGeometry.cx + state.titleOffset.x}
                        y={28 + state.titleOffset.y}
                        textAnchor="middle"
                        dominantBaseline="central"
                        fontFamily="'Times New Roman', Times, serif"
                        fontSize={ptToSvgUnits(state.setLabelFontSize + 1)}
                        fontWeight="bold"
                        fill="#000000"
                      >
                        {state.chartTitle}
                      </text>
                    </g>
                  )}

                  {/* Main Data Layer (measured by AutoCrop) */}
                  <g className="data-layer">
                    {/* Universal Box Background */}
                    {state.showUniversalBox && (
                      <rect
                        x={boxGeometry.x}
                        y={boxGeometry.y}
                        width={boxGeometry.w}
                        height={boxGeometry.h}
                        fill="#ffffff"
                        stroke="none"
                      />
                    )}

                    {/* Shaded Regions & Whole-Set Patterns */}
                    {renderShadedRegions()}

                    {/* Set Outlines */}
                    {activeSets.map(set => {
                      const dashArray =
                        set.strokeStyle === 'dashed'
                          ? '7,5'
                          : set.strokeStyle === 'dotted'
                          ? '2.5,3.5'
                          : undefined;

                      return renderSetShapeElement(set, `outline-${set.id}`, {
                        fill: 'none',
                        stroke: '#000000',
                        strokeWidth: set.strokeWidth,
                        strokeDasharray: dashArray,
                        onMouseDown: e => handleSetDragStart(set.id, e),
                        style: {
                          cursor:
                            cropMode
                              ? 'crosshair'
                              : canvasTool === 'shade'
                              ? 'pointer'
                              : 'move'
                        }
                      });
                    })}

                    {/* Universal Set Border Outline (drawn on top of shaded regions) */}
                    {state.showUniversalBox && (
                      <rect
                        x={boxGeometry.x}
                        y={boxGeometry.y}
                        width={boxGeometry.w}
                        height={boxGeometry.h}
                        fill="none"
                        stroke="#000000"
                        strokeWidth={state.universalBoxStrokeWidth}
                        pointerEvents="none"
                      />
                    )}

                    {/* Universal Set Symbol Label (U / ξ / ℰ / S / Ω) — Hidden by default */}
                    {state.universalLabelPos !== 'none' && (
                      <g
                        onMouseDown={handleUniversalLabelDragStart}
                        style={{ cursor: canvasTool === 'manipulate' ? 'move' : 'pointer' }}
                      >
                        {(() => {
                          let ux = boxGeometry.x - 16;
                          let uy = boxGeometry.y + 8;
                          if (state.universalLabelPos === 'inside-top-left') {
                            ux = boxGeometry.x + 20;
                            uy = boxGeometry.y + 18;
                          } else if (state.universalLabelPos === 'outside-top-right') {
                            ux = boxGeometry.x + boxGeometry.w + 18;
                            uy = boxGeometry.y + 8;
                          }
                          ux += state.universalLabelOffset.x;
                          uy += state.universalLabelOffset.y;

                          const cleanSym =
                            state.universalSymbol === '\\xi'
                              ? 'ξ'
                              : state.universalSymbol === '\\mathcal{E}'
                              ? 'ℰ'
                              : state.universalSymbol === '\\Omega'
                              ? 'Ω'
                              : state.universalSymbol;

                          const totalVal =
                            state.universalTotal.trim() !== ''
                              ? state.universalTotal.trim()
                              : computedTotals.grandTotal !== null
                              ? String(computedTotals.grandTotal)
                              : '';

                          const uText =
                            state.showUniversalTotal && totalVal
                              ? `${cleanSym} = ${totalVal}`
                              : cleanSym;

                          const svgFs = ptToSvgUnits(state.setLabelFontSize);

                          return (
                            <>
                              {state.universalLabelPos === 'inside-top-left' && (
                                <rect
                                  x={ux - (uText.length * svgFs * 0.35 + 4)}
                                  y={uy - svgFs * 0.65}
                                  width={uText.length * svgFs * 0.7 + 8}
                                  height={svgFs * 1.3}
                                  fill="#ffffff"
                                  opacity={0.85}
                                />
                              )}
                              <text
                                x={ux}
                                y={uy}
                                textAnchor="middle"
                                dominantBaseline="central"
                                fontFamily="'Times New Roman', Times, serif"
                                fontSize={svgFs}
                                fontStyle="italic"
                                fontWeight="bold"
                                fill="#000000"
                              >
                                {uText}
                              </text>
                            </>
                          );
                        })()}
                      </g>
                    )}

                    {/* Set Labels (A, B, C) */}
                    {activeSets.map((set, idx) => {
                      const anchor = setLabelAnchors[idx];
                      if (!anchor) return null;
                      const lx = anchor.x + set.labelOffset.x;
                      const ly = anchor.y + set.labelOffset.y;

                      const setSum = computedTotals.setSums[idx];
                      const displayLabel =
                        state.showSetTotalsInLabels && setSum !== null
                          ? `${set.label} (${setSum})`
                          : set.label;

                      return (
                        <g
                          key={`set-label-${set.id}`}
                          onMouseDown={e => handleSetLabelDragStart(set.id, e)}
                          style={{ cursor: canvasTool === 'manipulate' ? 'move' : 'pointer' }}
                        >
                          <text
                            x={lx}
                            y={ly}
                            textAnchor="middle"
                            dominantBaseline="central"
                            fontFamily="'Times New Roman', Times, serif"
                            fontSize={ptToSvgUnits(state.setLabelFontSize)}
                            fontWeight="bold"
                            fontStyle={displayLabel.length <= 2 ? 'italic' : 'normal'}
                            fill="#000000"
                          >
                            {displayLabel}
                          </text>
                        </g>
                      );
                    })}

                    {/* Exclusive Region Values / Blank Answer Boxes / Set Notation */}
                    {Array.from({ length: totalRegions }).map((_, m) => {
                      const reg = state.regions[m];
                      if (!reg || reg.hidden) return null;
                      const center = regionCenters[m];
                      if (!center || !center.exists) return null;

                      const rx = center.x + reg.labelOffset.x;
                      const ry = center.y + reg.labelOffset.y;

                      // Check if region should render as a Blank Answer Box
                      const showBox =
                        reg.isBlankBox || (state.studentMode && state.studentModeAsBoxes);

                      if (showBox) {
                        const bw = state.blankBoxWidth;
                        const bh = state.blankBoxHeight;
                        return (
                          <g
                            key={`reg-box-${m}`}
                            onMouseDown={e => handleRegionLabelDragStart(m, e)}
                            style={{ cursor: canvasTool === 'manipulate' ? 'move' : 'pointer' }}
                          >
                            <rect
                              x={rx - bw / 2}
                              y={ry - bh / 2}
                              width={bw}
                              height={bh}
                              rx={2}
                              ry={2}
                              fill="#ffffff"
                              stroke="#000000"
                              strokeWidth={1.3}
                            />
                          </g>
                        );
                      }

                      if (state.studentMode && !state.showRegionNotationOnCanvas) {
                        return null;
                      }

                      const meta = getRegionMeta(m);
                      const textToRender = state.showRegionNotationOnCanvas
                        ? `$${meta.math}$`
                        : reg.value;

                      if (!textToRender || textToRender.trim() === '') return null;

                      return (
                        <g
                          key={`reg-val-${m}`}
                          onMouseDown={e => handleRegionLabelDragStart(m, e)}
                          style={{ cursor: canvasTool === 'manipulate' ? 'move' : 'pointer' }}
                        >
                          {renderMathOrText(textToRender, rx, ry, state.fontSize, false, false)}
                        </g>
                      );
                    })}

                    {/* Optional Companion Two-Way Table */}
                    {renderCompanionTwoWayTable()}
                  </g>

                  {/* Crop Overlay inside SVG */}
                  {cropMode && selectionBox && (
                    <rect
                      x={selectionBox.x}
                      y={selectionBox.y}
                      width={selectionBox.w}
                      height={selectionBox.h}
                      fill="rgba(59, 130, 246, 0.2)"
                      stroke="#2563eb"
                      strokeWidth={2 / previewScale}
                      strokeDasharray={`${5 / previewScale},${5 / previewScale}`}
                      pointerEvents="none"
                    />
                  )}
                </svg>

                {/* Interactive Resize Handles Overlay SVG (Screen-only, never exported to PNG/SVG) */}
                {!cropMode && canvasTool === 'manipulate' && (
                  <svg
                    width={widthPixels}
                    height={heightPixels}
                    viewBox={customViewBox || `0 0 ${widthPixels} ${heightPixels}`}
                    className="absolute inset-0 w-full h-full pointer-events-none overflow-visible"
                  >
                    {/* 1. Outer Rectangle Border (Universal Box) Resize Grips */}
                    {state.showUniversalBox && (
                      <g className="box-resize-handles">
                        {/* Right Edge Grip (Wider / Narrower) */}
                        <g
                          onMouseDown={e => handleBoxResizeStart('e', e)}
                          style={{ cursor: 'ew-resize', pointerEvents: 'all' }}
                        >
                          <title>Drag left/right to make rectangle border narrower or wider</title>
                          <rect
                            x={boxGeometry.x + boxGeometry.w - 4}
                            y={boxGeometry.cy - 16}
                            width={8}
                            height={32}
                            rx={3}
                            fill="#ffffff"
                            stroke="#374151"
                            strokeWidth={1.25}
                          />
                          <line
                            x1={boxGeometry.x + boxGeometry.w}
                            y1={boxGeometry.cy - 8}
                            x2={boxGeometry.x + boxGeometry.w}
                            y2={boxGeometry.cy + 8}
                            stroke="#6b7280"
                            strokeWidth={1.2}
                          />
                        </g>

                        {/* Left Edge Grip (Wider / Narrower) */}
                        <g
                          onMouseDown={e => handleBoxResizeStart('w', e)}
                          style={{ cursor: 'ew-resize', pointerEvents: 'all' }}
                        >
                          <title>Drag left/right to make rectangle border narrower or wider</title>
                          <rect
                            x={boxGeometry.x - 4}
                            y={boxGeometry.cy - 16}
                            width={8}
                            height={32}
                            rx={3}
                            fill="#ffffff"
                            stroke="#374151"
                            strokeWidth={1.25}
                          />
                          <line
                            x1={boxGeometry.x}
                            y1={boxGeometry.cy - 8}
                            x2={boxGeometry.x}
                            y2={boxGeometry.cy + 8}
                            stroke="#6b7280"
                            strokeWidth={1.2}
                          />
                        </g>

                        {/* Bottom Edge Grip (Shorter / Taller) */}
                        <g
                          onMouseDown={e => handleBoxResizeStart('s', e)}
                          style={{ cursor: 'ns-resize', pointerEvents: 'all' }}
                        >
                          <title>Drag up/down to make rectangle border shorter or taller</title>
                          <rect
                            x={boxGeometry.cx - 16}
                            y={boxGeometry.y + boxGeometry.h - 4}
                            width={32}
                            height={8}
                            rx={3}
                            fill="#ffffff"
                            stroke="#374151"
                            strokeWidth={1.25}
                          />
                          <line
                            x1={boxGeometry.cx - 8}
                            y1={boxGeometry.y + boxGeometry.h}
                            x2={boxGeometry.cx + 8}
                            y2={boxGeometry.y + boxGeometry.h}
                            stroke="#6b7280"
                            strokeWidth={1.2}
                          />
                        </g>

                        {/* Bottom-Right Corner Grip */}
                        <rect
                          x={boxGeometry.x + boxGeometry.w - 5}
                          y={boxGeometry.y + boxGeometry.h - 5}
                          width={10}
                          height={10}
                          rx={2}
                          fill="#374151"
                          stroke="#ffffff"
                          strokeWidth={1.2}
                          onMouseDown={e => handleBoxResizeStart('se', e)}
                          style={{ cursor: 'nwse-resize', pointerEvents: 'all' }}
                        >
                          <title>Drag corner to resize rectangle border</title>
                        </rect>
                      </g>
                    )}

                    {/* 2. Set Shape Resize Handles (Circles / Ellipses / Rectangles) */}
                    {activeSets.map((set, idx) => {
                      const scx = boxGeometry.cx + set.cx;
                      const scy = boxGeometry.cy + set.cy;
                      const srx = set.rx;
                      const sry = state.shapeType === 'circle' ? set.rx : set.ry;
                      const isIndividuallySelected = selectedSetId === set.id;

                      // For unselected sets when 'all' is active, place a clear outer-edge resize handle on each set
                      // (Left edge for Set A, Right edge for Set B, Bottom edge for Set C)
                      const quickHandleSide: 'w' | 'e' | 's' =
                        state.numSets === 1
                          ? 'e'
                          : idx === 0
                          ? 'w'
                          : idx === 1
                          ? 'e'
                          : 's';
                      const qx =
                        quickHandleSide === 'w'
                          ? scx - srx
                          : quickHandleSide === 'e'
                          ? scx + srx
                          : scx;
                      const qy =
                        quickHandleSide === 's' ? scy + sry : scy;

                      if (!isIndividuallySelected) {
                        return (
                          <g key={`quick-handle-${set.id}`}>
                            <rect
                              x={qx - 4.5}
                              y={qy - 4.5}
                              width={9}
                              height={9}
                              rx={2}
                              fill="#ffffff"
                              stroke="#1f2937"
                              strokeWidth={1.5}
                              onMouseDown={e => handleSetResizeStart(set.id, quickHandleSide, e)}
                              style={{
                                cursor: quickHandleSide === 's' ? 'ns-resize' : 'ew-resize',
                                pointerEvents: 'all'
                              }}
                            >
                              <title>{`Drag to resize Set ${set.label} (or click Set ${set.label} for full handles)`}</title>
                            </rect>
                          </g>
                        );
                      }

                      // Full bounding box & 8 handles when a specific set is selected
                      const handles: {
                        id: 'e' | 'w' | 's' | 'n' | 'se' | 'sw' | 'ne' | 'nw';
                        x: number;
                        y: number;
                        cursor: string;
                      }[] = [
                        { id: 'e', x: scx + srx, y: scy, cursor: 'ew-resize' },
                        { id: 'w', x: scx - srx, y: scy, cursor: 'ew-resize' },
                        { id: 's', x: scx, y: scy + sry, cursor: 'ns-resize' },
                        { id: 'n', x: scx, y: scy - sry, cursor: 'ns-resize' },
                        { id: 'se', x: scx + srx, y: scy + sry, cursor: 'nwse-resize' },
                        { id: 'nw', x: scx - srx, y: scy - sry, cursor: 'nwse-resize' },
                        { id: 'ne', x: scx + srx, y: scy - sry, cursor: 'nesw-resize' },
                        { id: 'sw', x: scx - srx, y: scy + sry, cursor: 'nesw-resize' }
                      ];

                      return (
                        <g key={`selected-handles-${set.id}`}>
                          <rect
                            x={scx - srx}
                            y={scy - sry}
                            width={srx * 2}
                            height={sry * 2}
                            fill="none"
                            stroke="#374151"
                            strokeWidth={1.2}
                            strokeDasharray="4,4"
                          />
                          {handles.map(h => (
                            <rect
                              key={h.id}
                              x={h.x - 4.5}
                              y={h.y - 4.5}
                              width={9}
                              height={9}
                              rx={1.5}
                              fill="#ffffff"
                              stroke="#111827"
                              strokeWidth={1.6}
                              onMouseDown={e => handleSetResizeStart(set.id, h.id, e)}
                              style={{ cursor: h.cursor, pointerEvents: 'all' }}
                            >
                              <title>{`Drag to resize Set ${set.label}`}</title>
                            </rect>
                          ))}
                        </g>
                      );
                    })}
                  </svg>
                )}
              </div>
            </div>
          </main>
        </div>
      </div>
    </div>
  );
};

export default VennDiagrams;
