
/*
 * -----------------------------------------------------------------------------
 * AI_READ_ONLY_FILE: DO NOT EDIT WITHOUT EXPRESS PERMISSION
 * Core Math Layout Engine (TeX-like Box Model)
 * -----------------------------------------------------------------------------
 */

import React from 'react';
import { 
    CHAR_WIDTHS_NORMAL, CHAR_WIDTHS_ITALIC, CHAR_WIDTHS_BOLD, CHAR_WIDTHS_BOLD_ITALIC, 
    KERNING_NORMAL, KERNING_ITALIC, KERNING_BOLD, KERNING_BOLD_ITALIC 
} from './fontMetrics';
import { 
    DELIMITER_PATHS, 
    DELIMITER_MAP, 
    MATH_CONSTANTS, 
    DEFAULT_MATH_METRICS 
} from './mathDefaults';
import type { MathLayoutMetrics } from './mathDefaults'; // Explicit type import
import { SurdGenerator, SurdResult } from './surd/SurdGenerator';
import { BOX_DEFAULTS } from '../config/boxDefaults';
import { calculateTableLayout, renderTableGridLines, TableLayoutResult } from './tableLogic';

// Re-export for compatibility
export { DEFAULT_MATH_METRICS };
export type { MathLayoutMetrics };

// --- TYPES ---

export type AtomType = 'ORD' | 'BIN' | 'REL' | 'OPEN' | 'CLOSE' | 'PUNCT' | 'INNER' | 'OP' | 'BOX' | 'SEP';

export const SYMBOL_MAP: Record<string, { char: string, type: AtomType }> = {
    '=': { char: '=', type: 'REL' },
    '<': { char: '<', type: 'REL' },
    '>': { char: '>', type: 'REL' },
    'leq': { char: '≤', type: 'REL' },
    'geq': { char: '≥', type: 'REL' },
    'neq': { char: '≠', type: 'REL' },
    'approx': { char: '≈', type: 'REL' },
    'rightarrow': { char: '→', type: 'REL' },
    '+': { char: '+', type: 'BIN' },
    '-': { char: '\u2212', type: 'BIN' },
    'pm': { char: '±', type: 'BIN' },
    'mp': { char: '∓', type: 'BIN' },
    'times': { char: '×', type: 'BIN' },
    'div': { char: '÷', type: 'BIN' },
    'cdot': { char: '·', type: 'BIN' },
    'pi': { char: 'π', type: 'ORD' },
    'theta': { char: 'θ', type: 'ORD' },
    'alpha': { char: 'α', type: 'ORD' },
    'beta': { char: 'β', type: 'ORD' },
    'gamma': { char: 'γ', type: 'ORD' },
    'sigma': { char: 'σ', type: 'ORD' },
    'mu': { char: 'μ', type: 'ORD' },
    'lambda': { char: 'λ', type: 'ORD' },
    'omega': { char: 'ω', type: 'ORD' },
    'phi': { char: 'φ', type: 'ORD' },
    'Delta': { char: 'Δ', type: 'ORD' },
    'infty': { char: '∞', type: 'ORD' },
    'sqrt': { char: '√', type: 'ORD' },
    'in': { char: '∈', type: 'REL' },
    'quad': { char: '\u2003', type: 'ORD' },
    'qquad': { char: '\u2003\u2003', type: 'ORD' },
    '~': { char: '\u00A0', type: 'ORD' } // Tilde as Non-Breaking Space
};

export interface ParseNode {
    type: 'char' | 'group' | 'frac' | 'sqrt' | 'sup' | 'sub' | 'supsub' | 'delim' | 'box' | 'matrix' | 'textstyle';
    val?: string;
    children?: ParseNode[];
    // For style nodes
    style?: 'textbf' | 'textit' | 'underline';
    num?: ParseNode;
    den?: ParseNode;
    base?: ParseNode;
    sup?: ParseNode;
    sub?: ParseNode;
    atomType?: AtomType;
    widthFactor?: number; // Used for boxes
    renderMode?: 'box' | 'underline'; // New: Style of the box
    rows?: ParseNode[][][]; // For matrix: rows -> cols -> nodes
    isTable?: boolean; // New: Distinguish between matrix (brackets) and table (grid)
}

export interface BoxStyleOptions {
    widthScale?: number;
    heightScale?: number;
    thickness?: number;
    // New Positioning Options (in pixels/absolute units)
    paddingLeft?: number;
    paddingRight?: number;
    shiftX?: number;
    shiftY?: number;
}

export interface BoxInteractionContext {
    boxIndexRef: { current: number };
    onBoxClick?: (index: number, e: any) => void;
    isBoxSelected?: (index: number) => boolean;
    getBoxSettings?: (index: number) => BoxStyleOptions | undefined;
}

export interface StyleContext {
    fontSize: number;
    isMath: boolean;
    isBold: boolean;
    color: string;
    debug?: boolean; // Show bounding boxes
    depth: number; // Nesting level for scripts (0 = base, 1 = script, 2 = scriptscript)
    fracDepth?: number; // Nesting level for fractions (0 = top-level, 1+ = nested)
    cramped?: boolean; // TeX cramped style (inside radicals and fraction denominators)
    boxOptions?: BoxStyleOptions; // Global/Block-level overrides
    boxInteraction?: BoxInteractionContext; // Individual box interaction
    layoutBoxIndexRef?: { current: number }; // New: Track index during layout for dimension overrides
}

const DELIMITER_PAIRS: Record<string, string> = { 
    '(': ')', 
    '[': ']', 
    '\\{': '\\}' 
};

// Singleton generator for standard use
const SHARED_SURD_GENERATOR = new SurdGenerator();

// --- BOX MODEL ---

export abstract class Box {
    width: number;
    ascent: number;
    descent: number;
    atomType: AtomType;
    italicCorrection: number = 0; // Added for italic handling

    constructor(width: number, ascent: number, descent: number, type: AtomType = 'ORD') {
        this.width = width;
        this.ascent = ascent;
        this.descent = descent;
        this.atomType = type;
    }

    get height() { return this.ascent + this.descent; }
    abstract render(x: number, y: number, ctx: StyleContext, els: React.ReactNode[]): void;

    // Helper for debug rendering
    protected renderDebugBox(x: number, y: number, ctx: StyleContext, els: React.ReactNode[], expandBy: number = 0) {
        if (ctx.debug) {
            els.push(
                React.createElement('rect', {
                    key: `debug-box-${x}-${y}-${Math.random()}`,
                    x: x - expandBy, 
                    y: y - this.ascent - expandBy,
                    width: this.width + (expandBy * 2),
                    height: this.ascent + this.descent + (expandBy * 2),
                    fill: 'none',
                    stroke: 'red',
                    strokeWidth: 0.25, // Updated to 0.25px per request
                    opacity: 0.8
                })
            );
        }
    }
}

export class EmptyBox extends Box {
    render() {}
}

export class TableGridBox extends Box {
    rows: { box: Box, x: number, y: number }[]; // x,y are relative to center
    layout: TableLayoutResult;

    constructor(
        layout: TableLayoutResult,
        rows: { box: Box, x: number, y: number }[]
    ) {
        super(layout.totalWidth, layout.totalAscent, layout.totalDescent, 'ORD');
        this.layout = layout;
        this.rows = rows;
    }

    render(x: number, y: number, ctx: StyleContext, els: React.ReactNode[]) {
        this.renderDebugBox(x, y, ctx, els);
        
        // Draw Grid Lines (Delegate to tableLogic)
        renderTableGridLines(x, y, this.layout, ctx, els);

        // Draw Content
        const centerX = x + this.width / 2;
        const centerY = y + (this.descent - this.ascent) / 2;

        this.rows.forEach(child => {
            child.box.render(centerX + child.x, centerY + child.y, ctx, els);
        });

        // Explicit Crop Bound (Transparent, used for auto-crop detection of the full table area)
        els.push(
            React.createElement('rect', {
                key: `tbl-crop-${x}-${y}`,
                x: x, y: y - this.ascent, width: this.width, height: this.height,
                fill: 'transparent', stroke: 'none',
                className: 'graph-content',
                pointerEvents: 'none'
            })
        );
    }
}

/**
 * Renders a visual rectangle (Exam Fill-in Box) or Line
 */
export class RectBox extends Box {
    visualWidth: number;
    baseHeight: number;
    thickness: number;
    mode: 'box' | 'underline';
    
    // Positioning
    shiftX: number;
    shiftY: number;

    constructor(layoutWidth: number, visualWidth: number, height: number, depth: number, thickness: number = 1.5, shiftX: number = 0, shiftY: number = 0, mode: 'box' | 'underline' = 'box') {
        super(layoutWidth, height, depth, 'BOX');
        this.visualWidth = visualWidth;
        this.baseHeight = height + depth; // Total height
        this.thickness = thickness;
        this.shiftX = shiftX;
        this.shiftY = shiftY;
        this.mode = mode;
    }

    render(x: number, y: number, ctx: StyleContext, els: React.ReactNode[]) {
        let strokeW = ctx.boxOptions?.thickness ?? this.thickness;
        let width = this.visualWidth;
        
        // Handle visual shift
        const drawX = x + this.shiftX;
        const drawY = y + this.shiftY;

        let height = this.baseHeight;
        
        const interaction = ctx.boxInteraction;
        let isSelected = false;
        let index = -1;

        if (interaction) {
            index = interaction.boxIndexRef.current++;
            if (interaction.isBoxSelected && interaction.isBoxSelected(index)) {
                isSelected = true;
            }
            if (interaction.getBoxSettings) {
                const overrides = interaction.getBoxSettings(index);
                if (overrides) {
                    if (overrides.thickness !== undefined) strokeW = overrides.thickness;
                }
            }
        }

        // Draw selection halo
        if (isSelected) {
             els.push(
                React.createElement('rect', {
                    key: `box-sel-${index}`,
                    x: drawX - 4,
                    y: drawY - this.ascent - 4,
                    width: width + 8,
                    height: height + 8,
                    fill: 'rgba(37, 99, 235, 0.1)',
                    stroke: '#2563eb',
                    strokeWidth: 1
                })
            );
        }

        const color = isSelected ? '#2563eb' : ctx.color;

        if (this.mode === 'underline') {
            // Draw Line
            const lineY = drawY + this.descent - strokeW / 2;
            els.push(
                React.createElement('line', {
                    key: `box-line-${drawX}-${drawY}`,
                    x1: drawX,
                    y1: lineY,
                    x2: drawX + width,
                    y2: lineY,
                    stroke: color, 
                    strokeWidth: strokeW,
                    style: { pointerEvents: 'none' } 
                })
            );
        } else {
            // Draw Box
            els.push(
                React.createElement('rect', {
                    key: `box-rect-${drawX}-${drawY}`,
                    x: drawX,
                    y: drawY - this.ascent,
                    width: width,
                    height: height,
                    fill: 'none',
                    stroke: color,
                    strokeWidth: strokeW,
                    style: { pointerEvents: 'none' }
                })
            );
        }
        
        // Explicit Graph Content Bounding Box (Transparent) - includes stroke
        // Used for auto-crop detection
        const expand = strokeW / 2;
        els.push(
            React.createElement('rect', {
                key: `box-crop-${drawX}-${drawY}`,
                x: drawX - expand,
                y: drawY - this.ascent - expand,
                width: width + strokeW,
                height: height + strokeW,
                fill: 'transparent',
                stroke: 'none',
                className: 'graph-content',
                pointerEvents: 'none'
            })
        );
        
        // Add invisible hit rect for clicking (Covers the full area regardless of mode)
        els.push(
            React.createElement('rect', {
                key: `box-hit-${drawX}-${drawY}-${Math.random()}`,
                x: drawX,
                y: drawY - this.ascent,
                width: width,
                height: height,
                fill: 'transparent',
                stroke: 'none',
                style: { cursor: 'pointer', pointerEvents: 'all' },
                onClick: (e: any) => {
                    if (interaction && interaction.onBoxClick) {
                        e.stopPropagation();
                        interaction.onBoxClick(index, e);
                    }
                }
            })
        );

        // Debug box (Moved to end)
        this.renderDebugBox(x, y, ctx, els, 0);
    }
}

export class CharBox extends Box {
    char: string;
    isMath: boolean;
    fontSize: number;
    isBold: boolean;
    yOffset: number = 0; // Vertical shift (positive = UP, negative = DOWN)
    
    constructor(
        char: string,
        width: number,
        ascent: number,
        descent: number,
        type: AtomType,
        isMath: boolean = false,
        fontSize: number = 16,
        isBold: boolean = false
    ) {
        super(width, ascent, descent, type);
        this.char = char;
        this.isMath = isMath;
        this.fontSize = fontSize;
        this.isBold = isBold;
    }

    render(x: number, y: number, ctx: StyleContext, els: React.ReactNode[]) {
        const isLetter = /[a-zA-Z]/.test(this.char);
        const style = (this.isMath && isLetter && this.atomType !== 'OP') ? 'italic' : 'normal';
        const drawY = y - this.yOffset;

        // Render debug behind text is fine, text is usually thin
        this.renderDebugBox(x, y, ctx, els);

        els.push(
            React.createElement('text', {
                key: `t-${x}-${y}-${this.char}-${Math.random()}`,
                x: x,
                y: drawY, 
                fontSize: this.fontSize,
                fontFamily: "Times New Roman",
                fontStyle: style,
                fontWeight: this.isBold ? 'bold' : 'normal',
                fill: ctx.color,
                className: 'graph-content',
                style: { whiteSpace: 'pre' }
            }, this.char)
        );
    }
}

export class HorizontalBox extends Box {
    children: { box: Box, offset: number }[]; 

    constructor(width: number, ascent: number, descent: number, children: { box: Box, offset: number }[]) {
        super(width, ascent, descent, 'ORD');
        this.children = children;
    }

    render(x: number, y: number, ctx: StyleContext, els: React.ReactNode[]) {
        this.renderDebugBox(x, y, ctx, els);
        this.children.forEach(child => {
            child.box.render(x + child.offset, y, ctx, els);
        });
    }
}

export class VerticalBox extends Box {
    children: { box: Box, x: number, y: number }[]; 

    constructor(width: number, ascent: number, descent: number, children: { box: Box, x: number, y: number }[]) {
        super(width, ascent, descent, 'ORD');
        this.children = children;
    }

    render(x: number, y: number, ctx: StyleContext, els: React.ReactNode[]) {
        this.renderDebugBox(x, y, ctx, els);
        this.children.forEach(child => {
            child.box.render(x + child.x, y + child.y, ctx, els);
        });
    }
}

export class RuleBox extends Box {
    thickness: number;
    
    constructor(width: number, thickness: number, yOffset: number) {
        super(width, -yOffset + thickness/2, yOffset + thickness/2, 'ORD');
        this.thickness = thickness;
    }

    render(x: number, y: number, ctx: StyleContext, els: React.ReactNode[]) {
        els.push(
            React.createElement('line', {
                key: `r-${x}-${y}-${Math.random()}`,
                x1: x, y1: y, x2: x + this.width, y2: y,
                stroke: ctx.color,
                strokeWidth: this.thickness,
                // Removed graph-content, added explicit rect below
            })
        );
        // Explicit Bound
        const expand = this.thickness / 2;
        els.push(
            React.createElement('rect', {
                key: `rule-crop-${x}-${y}`,
                x: x, y: y - expand,
                width: this.width, height: this.thickness,
                fill: 'transparent',
                stroke: 'none',
                className: 'graph-content',
                pointerEvents: 'none'
            })
        );
    }
}

export class RadicalBox extends Box {
    content: Box;
    gap: number;
    extraH: number;
    verticalShift: number;
    surdResult: SurdResult;
    paddingLeft: number;
    paddingRight: number;
    scale: number;

    constructor(content: Box, gap: number, extraH: number, verticalShift: number, fontSize: number) {
        const DEFAULT_FONT_SIZE = 13.0;
        const scale = fontSize / DEFAULT_FONT_SIZE;

        // TeX Rule 11:
        // Clearance between radicand top (content.ascent) and bottom of vinculum
        const effectiveGap = Math.max(fontSize * 0.04, gap - verticalShift);
        // Valley of the surd cradles the radicand descent plus extraH cushion
        const targetValleyDescent = Math.max(content.descent + extraH * 0.6, fontSize * 0.05);

        // Total vertical rise from bottom vertex of surd to bottom of vinculum
        const desiredRisePx = Math.max(fontSize * 0.72, content.ascent + effectiveGap + targetValleyDescent);

        // Horizontal breathing room inside the radical
        const padLeftPx = fontSize * 0.06;
        const padRightPx = fontSize * 0.08;

        const baseW = content.width / scale;
        const baseH = desiredRisePx / scale;
        const basePadL = padLeftPx / scale;
        const basePadR = padRightPx / scale;

        const result = SHARED_SURD_GENERATOR.generatePath(
            baseW,
            baseH,
            basePadL,
            basePadR,
            0,
            0
        );

        const tickWidth = (result.vinculum.x - result.metrics.minX) * scale;
        const vinculumWidth = result.vinculum.width * scale;
        const vinculumHeight = result.vinculum.height * scale;

        // True vertical span of generated surd below the bottom of the vinculum
        const actualSurdSpanPx = (result.metrics.maxY - (result.vinculum.y + result.vinculum.height)) * scale;

        const totalWidth = tickWidth + vinculumWidth;
        // TeX Rule 11 adds rule thickness (extra ascender) above vinculum top
        const totalAscent = content.ascent + effectiveGap + vinculumHeight + fontSize * 0.03;
        const totalDescent = Math.max(content.descent, actualSurdSpanPx - content.ascent - effectiveGap);

        super(totalWidth, Math.max(0, totalAscent), Math.max(0, totalDescent), 'ORD');
        
        this.content = content;
        this.gap = effectiveGap;
        this.extraH = extraH;
        this.verticalShift = verticalShift;
        this.surdResult = result;
        this.paddingLeft = padLeftPx;
        this.paddingRight = padRightPx;
        this.scale = scale;
    }

    render(x: number, y: number, ctx: StyleContext, els: React.ReactNode[]) {
        this.renderDebugBox(x, y, ctx, els);

        // Align the bottom of the vinculum to (y - content.ascent - gap)
        const targetVinculumBottomY = y - this.content.ascent - this.gap;
        const currentVinculumBottomY = (this.surdResult.vinculum.y + this.surdResult.vinculum.height) * this.scale;
        const offsetY = targetVinculumBottomY - currentVinculumBottomY;
        
        const currentMinX = this.surdResult.metrics.minX * this.scale;
        const offsetX = x - currentMinX;

        els.push(
            React.createElement('path', {
                key: `surd-tick-${x}-${y}`,
                d: this.surdResult.pathData,
                fill: ctx.color,
                stroke: "none",
                className: 'graph-content',
                transform: `translate(${offsetX}, ${offsetY}) scale(${this.scale})`
            })
        );

        const v = this.surdResult.vinculum;
        const vincX = v.x * this.scale + offsetX;
        const vincY = v.y * this.scale + offsetY;
        const vincW = v.width * this.scale;
        const vincH = v.height * this.scale;

        els.push(
            React.createElement('rect', {
                key: `surd-vinc-${x}-${y}`,
                x: vincX - 0.3,
                y: vincY,
                width: vincW + 0.3,
                height: vincH,
                fill: ctx.color,
                className: 'graph-content'
            })
        );

        this.content.render(vincX + this.paddingLeft, y, ctx, els);
    }
}

import { BracketGenerator, BracketResult } from './bracket/BracketGenerator';

const BRACKET_GEN = new BracketGenerator();

function buildDelimiterResult(char: string, targetHeightBase: number): BracketResult {
    const isLeft = char === '(' || char === '[' || char === '\\{';
    if (char === '[' || char === ']') {
        return BRACKET_GEN.generateSquareBracketPath(targetHeightBase, isLeft);
    }
    if (char === '\\{' || char === '\\}') {
        return BRACKET_GEN.generateCurlyBracePath(targetHeightBase, isLeft);
    }
    return BRACKET_GEN.generatePath(targetHeightBase, isLeft);
}

export class DelimiterBox extends Box {
    content: Box;
    leftChar: string;
    rightChar: string;
    factor: number;
    maxShortfall: number;
    leftWidth: number;
    rightWidth: number;
    leftBracketResult: BracketResult;
    rightBracketResult: BracketResult;
    bracketScale: number;
    axisHeightPx: number;
    innerPadding: number;
    outerPadding: number;

    constructor(
        content: Box,
        leftChar: string,
        rightChar: string,
        factor: number,
        maxShortfall: number,
        fontSize: number,
        axisHeightRatio: number = DEFAULT_MATH_METRICS.axisHeight
    ) {
        const leftKey = DELIMITER_MAP[leftChar] || '(';
        const rightKey = DELIMITER_MAP[rightChar] || ')';
        
        // TeX Rule 19: Delimiters are strictly symmetric around the math axis (y - axisH)
        const axisH = fontSize * axisHeightRatio;
        const extentAboveAxis = Math.max(0, content.ascent - axisH);
        const extentBelowAxis = Math.max(0, content.descent + axisH);
        const maxAxisExtent = Math.max(extentAboveAxis, extentBelowAxis);

        const halfH = Math.max(
            maxAxisExtent * factor,
            maxAxisExtent - maxShortfall / 2,
            fontSize * 0.48
        );
        const targetH = halfH * 2;

        // Scale base units so 26 base units = 1em (fontSize)
        const bScale = fontSize / 26.0;
        const bTargetH = targetH / bScale;

        const leftRes = buildDelimiterResult(leftKey, bTargetH);
        const rightRes = buildDelimiterResult(rightKey, bTargetH);

        const leftW = leftRes.metrics.advanceWidth * bScale;
        const rightW = rightRes.metrics.advanceWidth * bScale;
        const isSmallDelim = targetH <= fontSize * 1.15;
        const innerPad = fontSize * (isSmallDelim ? 0.032 : 0.045);
        const outerPad = fontSize * (isSmallDelim ? 0.020 : 0.025);

        const ascent = halfH + axisH;
        const descent = Math.max(fontSize * 0.18, halfH - axisH);
        
        super(content.width + leftW + rightW + (innerPad * 2) + (outerPad * 2), ascent, descent, 'INNER');
        this.content = content;
        this.leftChar = leftKey;
        this.rightChar = rightKey;
        this.factor = factor;
        this.maxShortfall = maxShortfall;
        this.leftWidth = leftW;
        this.rightWidth = rightW;
        this.leftBracketResult = leftRes;
        this.rightBracketResult = rightRes;
        this.bracketScale = bScale;
        this.axisHeightPx = axisH;
        this.innerPadding = innerPad;
        this.outerPadding = outerPad;
    }

    render(x: number, y: number, ctx: StyleContext, els: React.ReactNode[]) {
        this.renderDebugBox(x, y, ctx, els);
        
        this.renderDelimiter(x + this.outerPadding, y, ctx, els, this.leftBracketResult);
        this.content.render(x + this.outerPadding + this.leftWidth + this.innerPadding, y, ctx, els);
        this.renderDelimiter(x + this.width - this.outerPadding - this.rightWidth, y, ctx, els, this.rightBracketResult);
    }

    private renderDelimiter(drawX: number, y: number, ctx: StyleContext, els: React.ReactNode[], bracketRes: BracketResult) {
        // Center strictly on the math axis (y - axisHeightPx)
        const centerY = y - this.axisHeightPx;
        const bScale = this.bracketScale;
        const shiftX = drawX - (bracketRes.metrics.bearingX * bScale);

        els.push(React.createElement('path', {
            key: `d-bracket-${drawX}-${Math.random()}`,
            d: bracketRes.pathData,
            fill: ctx.color,
            stroke: "none",
            className: 'graph-content',
            transform: `translate(${shiftX}, ${centerY}) scale(${bScale})`
        }));
    }
}

export class MathLayoutEngine {
    public metrics: MathLayoutMetrics;

    constructor(metrics: Partial<MathLayoutMetrics> = {}) {
        this.metrics = { ...DEFAULT_MATH_METRICS, ...metrics };
    }

    // Tokenizer
    public tokenize(text: string): string[] {
        // Support escaped delimiters \{ \}, \\ row breaks, \commands, operators/chars, and grouping braces
        const re = /(\\\\|\\\{|\\\}|\\([a-zA-Z]+)|([a-zA-Z0-9+\-=<>!(),/[\]|.&~":;])|(\s+)|([{}^_]))/g;
        const tokens: string[] = [];
        let match;
        while ((match = re.exec(text)) !== null) {
            if (match[1] === '\\\\' || match[1] === '\\{' || match[1] === '\\}') tokens.push(match[1]);
            else if (match[2]) tokens.push('\\' + match[2]); 
            else if (match[3]) tokens.push(match[3]); 
            else if (match[5]) tokens.push(match[5]); 
        }
        return tokens;
    }

    // Parser
    public parse(tokens: string[]): ParseNode[] {
        const nodes: ParseNode[] = [];
        while (tokens.length > 0) {
            const tok = tokens.shift()!;
            if (tok === '}') return nodes;
            
            if (tok === '\\left' || tok === '\\right') continue;

            if (tok === '{') {
                const children = this.parse(tokens);
                nodes.push({ type: 'group', children });
                continue;
            }
            if (tok === '^' || tok === '_') {
                const prev = nodes.pop();
                if (!prev) continue;
                const nextTok = tokens[0];
                let scriptContent: ParseNode;
                if (nextTok === '{') {
                    tokens.shift();
                    scriptContent = { type: 'group', children: this.parse(tokens) };
                } else {
                    tokens.shift();
                    scriptContent = this.createCharNode(nextTok);
                }
                if (tok === '^') {
                    if (prev.type === 'sub') nodes.push({ type: 'supsub', base: prev.base, sub: prev.sub, sup: scriptContent });
                    else nodes.push({ type: 'sup', base: prev, sup: scriptContent });
                } else {
                    if (prev.type === 'sup') nodes.push({ type: 'supsub', base: prev.base, sup: prev.sup, sub: scriptContent });
                    else nodes.push({ type: 'sub', base: prev, sub: scriptContent });
                }
                continue;
            }
            if (tok.startsWith('\\') && tok !== '\\{' && tok !== '\\}') {
                const cmd = tok.substring(1);
                if (cmd === 'frac') {
                    const num = this.parseArg(tokens);
                    const den = this.parseArg(tokens);
                    nodes.push({ type: 'frac', num, den });
                } else if (cmd === 'sqrt') {
                    const content = this.parseArg(tokens);
                    nodes.push({ type: 'sqrt', children: [content] });
                } else if (cmd === 'box' || cmd === 'widebox') {
                    const isWide = cmd === 'widebox';
                    nodes.push({ type: 'box', widthFactor: isWide ? 1.5 : 1.0, renderMode: 'box' });
                } else if (cmd === 'gap') {
                    nodes.push({ type: 'box', widthFactor: 1.0, renderMode: 'underline' });
                } else if (cmd === 'pmatrix' || cmd === 'bmatrix' || (cmd === 'table' && tokens.length > 0 && tokens[0] === '{')) {
                    const group = this.parseArg(tokens); // Reads {...} content
                    const children = group.children || [];
                    
                    // Split children by '&' and '\\'
                    const rows: ParseNode[][][] = [];
                    let currentRow: ParseNode[][] = [];
                    let currentCell: ParseNode[] = [];
                    
                    children.forEach(n => {
                        if (n.type === 'char' && n.val === '\\\\') {
                            currentRow.push(currentCell);
                            rows.push(currentRow);
                            currentRow = [];
                            currentCell = [];
                        } else if (n.type === 'char' && n.val === '&') {
                            currentRow.push(currentCell);
                            currentCell = [];
                        } else {
                            currentCell.push(n);
                        }
                    });
                    if (currentCell.length > 0) currentRow.push(currentCell);
                    if (currentRow.length > 0) rows.push(currentRow);
                    
                    nodes.push({ type: 'matrix', rows, isTable: cmd === 'table' });
                } else if (cmd === 'mat') {
                    // Default 2x2 placeholder matrix
                    const boxNode: ParseNode = { type: 'box', renderMode: 'underline' }; // Use underline by default for \mat
                    nodes.push({ 
                        type: 'matrix', 
                        rows: [
                            [[boxNode], [boxNode]],
                            [[boxNode], [boxNode]]
                        ]
                    });
                } else if (cmd === 'table') {
                    // Default 3x3 table with headers A, B, C and content 1-6
                    const createTxt = (str: string) => ({ type: 'char', val: str, atomType: 'ORD' } as ParseNode);
                    
                    const r1 = [ [createTxt('A')], [createTxt('B')], [createTxt('C')] ];
                    const r2 = [ [createTxt('1')], [createTxt('2')], [createTxt('3')] ];
                    const r3 = [ [createTxt('4')], [createTxt('5')], [createTxt('6')] ];

                    nodes.push({ 
                        type: 'matrix', 
                        rows: [r1, r2, r3],
                        isTable: true 
                    });
                } else if (cmd === 'textbf' || cmd === 'textit' || cmd === 'underline') {
                    const arg = this.parseArg(tokens);
                    nodes.push({ type: 'textstyle', style: cmd, children: arg.type === 'group' ? arg.children : [arg] });
                } else if (SYMBOL_MAP[cmd]) {
                    nodes.push(this.createCharNode(SYMBOL_MAP[cmd].char, SYMBOL_MAP[cmd].type));
                } else if (cmd === '\\') { // Handle \\ if it appeared as a command
                    nodes.push({ type: 'char', val: '\\\\' });
                } else {
                    nodes.push(this.createCharNode(cmd));
                }
                continue;
            }
            if (DELIMITER_MAP[tok]) {
                const group = this.extractParenGroup(tokens, tok);
                if (group) nodes.push({ type: 'delim', children: group, val: tok });
                else nodes.push(this.createCharNode(tok, tok === '(' || tok === '[' || tok === '\\{' ? 'OPEN' : 'CLOSE'));
                continue;
            }
            if (tok === '&') {
                nodes.push({ type: 'char', val: '&' });
                continue;
            }
            const symb = SYMBOL_MAP[tok];
            if (symb) nodes.push(this.createCharNode(symb.char, symb.type));
            else nodes.push(this.createCharNode(tok, /[0-9]/.test(tok) ? 'ORD' : 'ORD'));
        }
        return nodes;
    }

    private extractParenGroup(tokens: string[], openChar: string): ParseNode[] | null {
        const closeChar = DELIMITER_PAIRS[openChar];
        if (!closeChar) return null;

        let balance = 1;
        for (let i = 0; i < tokens.length; i++) {
            const t = tokens[i];
            if (t === openChar) balance++;
            if (t === closeChar) balance--;
            
            if (balance === 0) {
                const groupTokens = tokens.splice(0, i + 1); 
                groupTokens.pop(); 
                return this.parse(groupTokens);
            }
        }
        return null;
    }

    private parseArg(tokens: string[]): ParseNode {
        if (tokens.length === 0) return { type: 'char', val: '?' };
        const next = tokens[0];
        if (next === '{') {
            tokens.shift();
            return { type: 'group', children: this.parse(tokens) };
        }
        tokens.shift();
        if (next.startsWith('\\')) {
             const cmd = next.substring(1);
             if (SYMBOL_MAP[cmd]) return this.createCharNode(SYMBOL_MAP[cmd].char, SYMBOL_MAP[cmd].type);
             return { type: 'char', val: '?' };
        }
        return this.createCharNode(next);
    }

    private createCharNode(char: string, type: AtomType = 'ORD'): ParseNode {
        if (['+', '-', '=', '<', '>'].includes(char) && type === 'ORD') {
            const map = SYMBOL_MAP[char];
            if (map) type = map.type;
        } else if ((char === ',' || char === ';') && type === 'ORD') {
            type = 'PUNCT';
        }
        return { type: 'char', val: char, atomType: type };
    }

    /**
     * TeX Appendix G Rule 5 & Chapter 18 Inter-Atom Spacing Table
     */
    private resolveEffectiveAtomType(box: Box, prevType: AtomType | null): AtomType {
        // TeX Rule 5: A BIN atom (+, -, \pm) at the start of a formula or immediately following
        // BIN, OP, REL, OPEN, or PUNCT acts as a unary ORD atom (e.g. -b, (-x), x = -5).
        if (
            box.atomType === 'BIN' &&
            (prevType === null ||
                prevType === 'BIN' ||
                prevType === 'OP' ||
                prevType === 'REL' ||
                prevType === 'OPEN' ||
                prevType === 'PUNCT')
        ) {
            return 'ORD';
        }
        return box.atomType || 'ORD';
    }

    private getInterAtomGlue(prevType: AtomType | null, currType: AtomType, depth: number): number {
        if (!prevType) return 0;

        const isPrevOrdLike = prevType === 'ORD' || prevType === 'INNER' || prevType === 'CLOSE' || prevType === 'BOX';
        const isCurrOrdLike = currType === 'ORD' || currType === 'INNER' || currType === 'OPEN' || currType === 'OP' || currType === 'BOX';

        const binLeft = this.metrics.autoCenterOperators
            ? (this.metrics.glueOrdBin + this.metrics.glueBinOrd) / 2
            : this.metrics.glueOrdBin;
        const binRight = this.metrics.autoCenterOperators
            ? (this.metrics.glueOrdBin + this.metrics.glueBinOrd) / 2
            : this.metrics.glueBinOrd;

        const relLeft = this.metrics.autoCenterOperators
            ? (this.metrics.glueOrdRel + this.metrics.glueRelOrd) / 2
            : this.metrics.glueOrdRel;
        const relRight = this.metrics.autoCenterOperators
            ? (this.metrics.glueOrdRel + this.metrics.glueRelOrd) / 2
            : this.metrics.glueRelOrd;

        // In script styles (depth > 0), TeX tightens binary/relational spacing so exponents stay compact
        const scriptFactor = depth > 0 ? 0.35 : 1.0;

        if (isPrevOrdLike && currType === 'BIN') return binLeft * scriptFactor;
        if (prevType === 'BIN' && isCurrOrdLike) return binRight * scriptFactor;
        if (isPrevOrdLike && currType === 'REL') return relLeft * scriptFactor;
        if (prevType === 'REL' && isCurrOrdLike) return relRight * scriptFactor;
        if (prevType === 'PUNCT' && (isCurrOrdLike || currType === 'REL' || currType === 'BIN')) {
            return this.metrics.glueOrdPunct * (depth > 0 ? 0.5 : 1.0);
        }
        // Small breathing space when an ordinary atom (such as unary minus) precedes an INNER atom (such as \frac)
        if (prevType === 'ORD' && currType === 'INNER') {
            return 0.04 * (depth > 0 ? 0.75 : 1.0);
        }
        return 0;
    }

    public makeBox(node: ParseNode, ctx: StyleContext): Box {
        const { fontSize } = ctx;

        // CHAR
        if (node.type === 'char') {
            const char = node.val || '?';
            
            // Select metrics
            let widthMap = CHAR_WIDTHS_NORMAL;
            if (ctx.isBold) {
                widthMap = ctx.isMath ? CHAR_WIDTHS_BOLD_ITALIC : CHAR_WIDTHS_BOLD;
            } else if (ctx.isMath && /[a-zA-Z]/.test(char) && node.atomType !== 'OP') {
                widthMap = CHAR_WIDTHS_ITALIC;
            }

            const EXTRA_CHAR_WIDTHS: Record<string, number> = {
                '±': 0.549, '∓': 0.549, '÷': 0.549,
                '≤': 0.549, '≥': 0.549, '≠': 0.549, '≈': 0.549, '→': 0.750, '∈': 0.580,
                'σ': 0.520, 'μ': 0.530, 'λ': 0.490, 'ω': 0.660, 'φ': 0.580,
                '\u2003': 0.850, '\u2003\u2003': 1.700
            };

            const ratio = widthMap[char] !== undefined
                ? widthMap[char]
                : (EXTRA_CHAR_WIDTHS[char] !== undefined ? EXTRA_CHAR_WIDTHS[char] : 0.55);
            const width = ratio * fontSize;
            
            // Accurate Times New Roman glyph vertical ink bounds
            const hasDescender = /[gjpqyQ/,;\(\)\[\]\{\}μγφ]/.test(char);
            const isOperator = /^[\+\-\=\u2212\±\∓\×\÷\·\<\>\≤\≥\≠\≈\→\∈]$/.test(char);
            const isTall = /[A-Z0-9bdfhklt\(\)\[\]\{\}\\\/\|\?\!\%\&\^\*\@\`\~θλΔ]/.test(char);
            const isMid = /^[acegimnorsuvwxzπαβγωσμφ]$/.test(char);

            let ascent = fontSize * 0.68; // Cap/numeral height (~0.676em in Times New Roman)
            if (isOperator) {
                ascent = fontSize * 0.50;
            } else if (!isTall && isMid) {
                ascent = fontSize * 0.46; // x-height (~0.45em in Times New Roman)
            }
            const descent = hasDescender ? fontSize * 0.22 : 0;

            const charBox = new CharBox(
                char,
                width,
                ascent,
                descent,
                node.atomType || 'ORD',
                ctx.isMath,
                fontSize,
                ctx.isBold
            );
            if (isOperator) {
                // Shift operator vertically so its visual center sits on the math axis (axisHeight = 0.25).
                // In Times New Roman, Unicode minus (\u2212) and hyphen (-) sit ~0.062em higher in the
                // glyph em-square than '+' and '=', so we apply a -0.062em compensation for minus.
                const minusCompensation = (char === '\u2212' || char === '-') ? -0.062 : 0;
                charBox.yOffset = fontSize * (this.metrics.operatorShift + minusCompensation);
            }
            if (ctx.isMath && /[a-zA-Z]/.test(char) && node.atomType !== 'OP') {
                if (char === 'f') {
                    charBox.italicCorrection = fontSize * 0.11;
                } else if (/[VjJWYTMN]/.test(char)) {
                    charBox.italicCorrection = fontSize * 0.06;
                } else {
                    charBox.italicCorrection = fontSize * this.metrics.italicCorrectionDefault;
                }
            }
            return charBox;
        }

        // TEXTSTYLE (textbf, textit, underline)
        if (node.type === 'textstyle') {
            const children = node.children || [];
            if (children.length === 0) return new EmptyBox(0, 0, 0);

            const styleCtx = { ...ctx };
            if (node.style === 'textbf') styleCtx.isBold = true;
            if (node.style === 'textit') styleCtx.isMath = true;
            
            const boxes: { box: Box, offset: number }[] = [];
            let currentX = 0;
            let maxAsc = 0;
            let maxDesc = 0;
            let prevType: AtomType | null = null;
            let prevBox: Box | null = null;

            children.forEach(child => {
                const box = this.makeBox(child, styleCtx);
                const currType = styleCtx.isMath ? this.resolveEffectiveAtomType(box, prevType) : (box.atomType || 'ORD');
                const glue = styleCtx.isMath ? this.getInterAtomGlue(prevType, currType, styleCtx.depth) : 0;
                const italicPad = (styleCtx.isMath && prevBox && prevBox.italicCorrection > fontSize * 0.04 && (currType === 'INNER' || currType === 'OPEN' || currType === 'CLOSE'))
                    ? prevBox.italicCorrection * 0.85
                    : 0;
                
                currentX += glue * fontSize + italicPad;
                boxes.push({ box, offset: currentX });
                currentX += box.width;
                
                maxAsc = Math.max(maxAsc, box.ascent);
                maxDesc = Math.max(maxDesc, box.descent);
                prevType = currType;
                prevBox = box;
            });

            let resultBox: Box = new HorizontalBox(currentX, maxAsc, maxDesc, boxes);
            
            if (node.style === 'underline') {
                return new class extends Box {
                    constructor() { super(resultBox.width, resultBox.ascent, resultBox.descent, 'ORD'); }
                    render(x: number, y: number, c: StyleContext, els: React.ReactNode[]) {
                        resultBox.render(x, y, c, els);
                        const lineY = y + resultBox.descent + 1;
                        els.push(
                            React.createElement('line', {
                                key: `underline-${x}-${y}-${Math.random()}`,
                                x1: x, y1: lineY, x2: x + resultBox.width, y2: lineY,
                                stroke: c.color, strokeWidth: 1.5
                            })
                        );
                    }
                }();
            }

            return resultBox;
        }

        // GROUP (Row)
        if (node.type === 'group') {
            if (!node.children || node.children.length === 0) return new EmptyBox(0, 0, 0);
            
            const boxes: { box: Box, offset: number }[] = [];
            let currentX = 0;
            let maxAsc = 0;
            let maxDesc = 0;
            let prevType: AtomType | null = null;
            let prevBox: Box | null = null;

            node.children.forEach(child => {
                const box = this.makeBox(child, ctx);
                const currType = ctx.isMath ? this.resolveEffectiveAtomType(box, prevType) : (box.atomType || 'ORD');
                const glue = ctx.isMath ? this.getInterAtomGlue(prevType, currType, ctx.depth) : 0;
                // Add italic overhang clearance when an overhanging italic char like 'f' precedes a delimiter '('
                const italicPad = (ctx.isMath && prevBox && prevBox.italicCorrection > fontSize * 0.04 && (currType === 'INNER' || currType === 'OPEN' || currType === 'CLOSE'))
                    ? prevBox.italicCorrection * 0.85
                    : 0;
                
                currentX += glue * fontSize + italicPad;
                boxes.push({ box, offset: currentX });
                currentX += box.width;
                
                maxAsc = Math.max(maxAsc, box.ascent);
                maxDesc = Math.max(maxDesc, box.descent);
                prevType = currType;
                prevBox = box;
            });

            return new HorizontalBox(currentX, maxAsc, maxDesc, boxes);
        }

        // MATRIX / TABLE
        if (node.type === 'matrix' && node.rows) {
            const rawRows = node.rows;
            const matrixRows: Box[][] = [];
            
            // 1. Layout all cells
            rawRows.forEach(row => {
                const rowBoxes = row.map(cellNodes => this.layoutRow(cellNodes, ctx));
                matrixRows.push(rowBoxes);
            });

            // 2. Use Layout Logic from tableLogic.ts
            const isTable = Boolean(node.isTable);
            const layout = calculateTableLayout(matrixRows, fontSize, isTable, this.metrics.axisHeight);
            
            // 3. Construct Box
            if (isTable) {
                const children = layout.childPositions.map(pos => {
                    const box = matrixRows[pos.row][pos.col];
                    return { box, x: pos.x, y: pos.y };
                });
                
                return new TableGridBox(layout, children);
            }

            const axisH = fontSize * this.metrics.axisHeight;
            const children = layout.childPositions.map(pos => {
                const box = matrixRows[pos.row][pos.col];
                return { box, x: pos.x + layout.totalWidth/2, y: pos.y };
            });
            
            const contentBox = new class extends Box {
                children: { box: Box, x: number, y: number }[];
                constructor() {
                    super(layout.totalWidth, layout.totalAscent, layout.totalDescent, 'ORD');
                    this.children = children;
                }
                render(x: number, y: number, ctx: StyleContext, els: React.ReactNode[]) {
                    const centerY = y - axisH;
                    const centerX = x + this.width / 2;
                    
                    layout.childPositions.forEach(pos => {
                        const box = matrixRows[pos.row][pos.col];
                        box.render(centerX + pos.x, centerY + pos.y, ctx, els);
                    });
                }
            }();
            
            // Wrap in delimiters (Square Brackets with full matrix height coverage)
            return new DelimiterBox(contentBox, '[', ']', 1.0, 0, fontSize, this.metrics.axisHeight);
        }

        // BOX (Exam Box) or GAP (Underline)
        if (node.type === 'box') {
            let settings = ctx.boxOptions || {};
            
            if (ctx.layoutBoxIndexRef) {
                const currentIndex = ctx.layoutBoxIndexRef.current++;
                if (ctx.boxInteraction && ctx.boxInteraction.getBoxSettings) {
                    const overrides = ctx.boxInteraction.getBoxSettings(currentIndex);
                    if (overrides) {
                        settings = { ...settings, ...overrides };
                    }
                }
            }

            const wRatio = BOX_DEFAULTS.equationBox.widthRatio; 
            const hRatio = BOX_DEFAULTS.equationBox.heightRatio;
            const xHeight = fontSize * BOX_DEFAULTS.xHeightRatio;
            
            const rawW = xHeight * wRatio * (settings.widthScale || (node.widthFactor || 1.0));
            const rawH = xHeight * hRatio * (settings.heightScale || 1.0);
            
            const padL = settings.paddingLeft ?? BOX_DEFAULTS.equationBox.paddingLeft ?? 0;
            const padR = settings.paddingRight ?? BOX_DEFAULTS.equationBox.paddingRight ?? 0;
            const shiftX = settings.shiftX ?? BOX_DEFAULTS.equationBox.shiftX ?? 0;
            const shiftY = settings.shiftY ?? BOX_DEFAULTS.equationBox.shiftY ?? 0;
            const thickness = settings.thickness ?? BOX_DEFAULTS.equationBox.strokeWidth;

            const w = rawW + padL + padR;
            
            const axisH = fontSize * this.metrics.axisHeight;
            const ascent = axisH + rawH/2;
            const descent = rawH/2 - axisH;

            const mode = node.renderMode || 'box';

            return new RectBox(w, rawW, ascent, descent, thickness, shiftX + padL, shiftY, mode); 
        }

        // FRACTION (TeX Appendix G, Rule 15b-e)
        if (node.type === 'frac') {
             const currentFracDepth = ctx.fracDepth || 0;
             const fracScale = (currentFracDepth === 0 && ctx.depth === 0) ? 0.86 : 0.78;
             const numCtx: StyleContext = { ...ctx, fontSize: fontSize * fracScale, fracDepth: currentFracDepth + 1 };
             const denCtx: StyleContext = { ...ctx, fontSize: fontSize * fracScale, fracDepth: currentFracDepth + 1, cramped: true };
             
             const num = this.makeBox(node.num || { type: 'char', val: '' }, numCtx);
             const den = this.makeBox(node.den || { type: 'char', val: '' }, denCtx);
             
             const ruleThick = fontSize * this.metrics.fracRuleThickness;
             const axisH = fontSize * this.metrics.axisHeight;
             const padding = fontSize * this.metrics.fracPadding;
             const outerMargin = fontSize * 0.045; // TeX \nulldelimiterspace outside fraction rule
             const minGap = fontSize * this.metrics.fracGap;
 
             const barWidth = Math.max(num.width, den.width) + padding * 2;
             const totalWidth = barWidth + outerMargin * 2;
             const numX = outerMargin + (barWidth - num.width) / 2;
             const denX = outerMargin + (barWidth - den.width) / 2;
             
             // TeX Rule 15b & 15d:
             // u = numerator baseline shift UP from main baseline
             // v = denominator baseline shift DOWN from main baseline
             const u = Math.max(
                 fontSize * this.metrics.fracNumShift,
                 axisH + ruleThick / 2 + minGap + num.descent
             );
             const v = Math.max(
                 fontSize * this.metrics.fracDenShift,
                 -axisH + ruleThick / 2 + minGap + den.ascent
             );
             
             const numY = -u; 
             const denY = v;
             
             const ascent = u + num.ascent;
             const descent = Math.max(0, v + den.descent);
             
             const fracBox = new VerticalBox(totalWidth, ascent, descent, [
                 { box: num, x: numX, y: numY },
                 { box: den, x: denX, y: denY },
                 { box: new RuleBox(barWidth, ruleThick, axisH), x: outerMargin, y: -axisH }
             ]);
             fracBox.atomType = 'INNER';
             return fracBox;
        }

        // RADICAL (Sqrt - TeX Appendix G, Rule 11)
        if (node.type === 'sqrt') {
            const radicandCtx: StyleContext = { ...ctx, cramped: true };
            const content = this.makeBox(node.children?.[0] || { type: 'group', children: [] }, radicandCtx);
            const gap = fontSize * this.metrics.sqrtGap;
            const extraH = fontSize * this.metrics.sqrtExtraHeight;
            const shift = fontSize * this.metrics.sqrtVerticalShift;
            return new RadicalBox(content, gap, extraH, shift, fontSize);
        }

        // DELIMITER (TeX Appendix G, Rule 19)
        if (node.type === 'delim') {
            const content = this.makeBox({ type: 'group', children: node.children }, ctx);
            const char = node.val || '(';
            const rightChar = DELIMITER_PAIRS[char] || ')';
            const maxShortfall = fontSize * this.metrics.delimMaxShortfall;
            return new DelimiterBox(content, char, rightChar, this.metrics.delimFactor, maxShortfall, fontSize, this.metrics.axisHeight);
        }

        // SCRIPTS (TeX Appendix G, Rule 18a-f)
        if (node.type === 'sup' || node.type === 'sub' || node.type === 'supsub') {
            const base = this.makeBox(node.base || { type: 'char', val: '' }, ctx);
            const scaleRatio = ctx.depth === 0
                ? this.metrics.scriptScale
                : (this.metrics.scriptScriptScale / this.metrics.scriptScale);
            const scriptFontSize = fontSize * scaleRatio;
            const scriptCtx: StyleContext = { ...ctx, fontSize: scriptFontSize, depth: ctx.depth + 1 };
            
            const supBox = node.sup ? this.makeBox(node.sup, scriptCtx) : null;
            const subBox = node.sub ? this.makeBox(node.sub, scriptCtx) : null;
            
            const xHeight = fontSize * 0.45;
            const baseGap = fontSize * this.metrics.scriptHorizontalGap;
            const italicCorr = base.italicCorrection || 0;

            // Rule 18a: Tall/complex bases (delimiters, fractions, radicals) or tall ascender/cap chars
            // lift the superscript baseline so it sits cleanly at the top-right shoulder of the base.
            const isSimpleCharBase = node.base?.type === 'char';
            const isTallCharBase = isSimpleCharBase && base.ascent > fontSize * 0.52;
            const supDrop = scriptFontSize * (isSimpleCharBase ? 0.36 : 0.42);
            const subDrop = fontSize * this.metrics.subDrop;

            let u = (!isSimpleCharBase || isTallCharBase) ? Math.max(0, base.ascent - supDrop) : 0;
            let v = !isSimpleCharBase ? Math.max(0, base.descent + subDrop) : 0;

            // Rule 18c/d: Superscript shift UP
            const isCramped = Boolean(ctx.cramped) || ctx.depth > 0;
            const minSupShift = fontSize * (isCramped ? this.metrics.supShift * 0.90 : this.metrics.supShift);
            if (supBox) {
                u = Math.max(
                    u,
                    minSupShift,
                    supBox.descent + Math.max(0.25 * xHeight, fontSize * this.metrics.supMinHeight)
                );
            }

            // Rule 18b/e: Subscript shift DOWN
            if (subBox) {
                if (!supBox) {
                    v = Math.max(
                        v,
                        fontSize * this.metrics.subShift,
                        subBox.ascent - 0.80 * xHeight
                    );
                } else {
                    v = Math.max(v, fontSize * (this.metrics.subShift * 1.25));
                    const minClearance = fontSize * this.metrics.supSubGapMin;
                    const currentClearance = (u - supBox.descent) - (subBox.ascent - v);
                    if (currentClearance < minClearance) {
                        const needed = minClearance - currentClearance;
                        const maxSupLift = Math.max(0, 0.80 * xHeight - (u - supBox.descent));
                        const liftSup = Math.min(needed, maxSupLift);
                        u += liftSup;
                        v += (needed - liftSup);
                    }
                }
            }

            const children: { box: Box, x: number, y: number }[] = [{ box: base, x: 0, y: 0 }];
            let width = base.width;
            let asc = base.ascent;
            let desc = base.descent;

            if (supBox) {
                const supX = base.width + italicCorr + baseGap;
                const supY = -u;
                children.push({ box: supBox, x: supX, y: supY });
                width = Math.max(width, supX + supBox.width + fontSize * 0.025);
                asc = Math.max(asc, u + supBox.ascent);
            }

            if (subBox) {
                const subX = base.width + baseGap;
                const subY = v;
                children.push({ box: subBox, x: subX, y: subY });
                width = Math.max(width, subX + subBox.width + fontSize * 0.025);
                desc = Math.max(desc, v + subBox.descent);
            }

            const scriptRes = new VerticalBox(width, asc, desc, children);
            scriptRes.atomType = base.atomType === 'CLOSE' || base.atomType === 'INNER' ? base.atomType : 'ORD';
            return scriptRes;
        }

        return new EmptyBox(0, 0, 0);
    }

    public layoutRow(nodes: ParseNode[], ctx: StyleContext): Box {
        return this.makeBox({ type: 'group', children: nodes }, ctx);
    }
}
