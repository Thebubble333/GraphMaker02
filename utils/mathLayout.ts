
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
    'times': { char: '×', type: 'BIN' },
    'cdot': { char: '·', type: 'BIN' },
    'pi': { char: 'π', type: 'ORD' },
    'theta': { char: 'θ', type: 'ORD' },
    'alpha': { char: 'α', type: 'ORD' },
    'beta': { char: 'β', type: 'ORD' },
    'Delta': { char: 'Δ', type: 'ORD' },
    'infty': { char: '∞', type: 'ORD' },
    'sqrt': { char: '√', type: 'ORD' },
    'in': { char: '∈', type: 'REL' },
    '~': { char: '\u00A0', type: 'ORD' } // Tilde as Non-Breaking Space
};

export interface ParseNode {
    type: 'char' | 'group' | 'frac' | 'sqrt' | 'sup' | 'sub' | 'supsub' | 'delim' | 'box' | 'matrix';
    val?: string;
    children?: ParseNode[];
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
    yOffset: number = 0; // Vertical shift (positive = UP, negative = DOWN)
    
    constructor(char: string, width: number, ascent: number, descent: number, type: AtomType, isMath: boolean = false) {
        super(width, ascent, descent, type);
        this.char = char;
        this.isMath = isMath;
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
                fontSize: ctx.fontSize,
                fontFamily: "Times New Roman",
                fontStyle: style,
                fontWeight: ctx.isBold ? 'bold' : 'normal',
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
    verticalShift: number; // Added vertical shift
    surdResult: SurdResult;
    paddingLeft: number;
    paddingRight: number;
    scale: number;

    constructor(content: Box, gap: number, extraH: number, verticalShift: number, fontSize: number) {
        const DEFAULT_FONT_SIZE = 11.0;
        const scale = fontSize / DEFAULT_FONT_SIZE;

        const contentHeight = content.ascent + content.descent;
        
        const paddingBottom = 0; 
        const paddingTop = 0; 
        
        const desiredHeight = contentHeight + gap + extraH;

        const baseW = content.width / scale;
        const baseH = desiredHeight / scale;

        const result = SHARED_SURD_GENERATOR.generatePath(
            baseW,
            baseH,
            0, 0, paddingTop, paddingBottom
        );

        const TARGET_SLANT_WIDTH_LEFT = 3.0; // Base unit constant
        
        const currentSlantBase = result.metrics.slantWidth;
        const dynamicPaddingLeftBase = Math.max(0, TARGET_SLANT_WIDTH_LEFT - currentSlantBase);
        
        const dynamicPaddingLeft = dynamicPaddingLeftBase * scale;
        const dynamicPaddingRight = 0;

        const tickWidth = result.metrics.advanceWidth * scale; // Scale tick width
        const totalWidth = tickWidth + content.width + dynamicPaddingLeft + dynamicPaddingRight;
        
        const vinculumHeight = result.vinculum.height * scale; // Scale height
        const totalAscent = content.ascent + gap + vinculumHeight;
        
        const totalDescent = content.descent + extraH;

        super(totalWidth, totalAscent, totalDescent, 'ORD');
        
        this.content = content;
        this.gap = gap;
        this.extraH = extraH;
        this.verticalShift = verticalShift;
        this.surdResult = result; // Stores base result
        this.paddingLeft = dynamicPaddingLeft;
        this.paddingRight = dynamicPaddingRight;
        this.scale = scale;
    }

    render(x: number, y: number, ctx: StyleContext, els: React.ReactNode[]) {
        this.renderDebugBox(x, y, ctx, els);

        const targetVinculumY = y - this.content.ascent - this.gap;
        const currentVinculumY = this.surdResult.vinculum.y * this.scale;
        const offsetY = targetVinculumY - currentVinculumY;
        
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
        els.push(
            React.createElement('rect', {
                key: `surd-vinc-${x}-${y}`,
                x: v.x * this.scale + offsetX,
                y: v.y * this.scale + offsetY,
                width: v.width * this.scale + this.paddingLeft + this.paddingRight,
                height: v.height * this.scale,
                fill: ctx.color,
                className: 'graph-content'
            })
        );

        this.content.render(v.x * this.scale + offsetX + this.paddingLeft, y, ctx, els);
    }
}

export class DelimiterBox extends Box {
    content: Box;
    leftChar: string;
    rightChar: string;
    factor: number;
    maxShortfall: number;
    leftWidth: number;
    rightWidth: number;

    constructor(content: Box, leftChar: string, rightChar: string, factor: number, maxShortfall: number, fontSize: number) {
        const leftKey = DELIMITER_MAP[leftChar] || '(';
        const rightKey = DELIMITER_MAP[rightChar] || ')';
        
        const capHeightPx = fontSize * MATH_CONSTANTS.DELIMITER_CAP_SCALE;
        const s = capHeightPx / MATH_CONSTANTS.PATH_UNIT_HEIGHT;
        
        const leftData = DELIMITER_PATHS[leftKey as keyof typeof DELIMITER_PATHS];
        const rightData = DELIMITER_PATHS[rightKey as keyof typeof DELIMITER_PATHS];
        
        const leftW = leftData ? leftData.width * s : fontSize * 0.4;
        const rightW = rightData ? rightData.width * s : fontSize * 0.4;
        
        const targetH = Math.max(content.height * factor, content.height - maxShortfall);
        const extra = Math.max(0, targetH - content.height);
        
        const padding = 2; 
        
        super(content.width + leftW + rightW + (padding * 2), content.ascent + extra/2, content.descent + extra/2, 'INNER');
        this.content = content;
        this.leftChar = leftKey;
        this.rightChar = rightKey;
        this.factor = factor;
        this.maxShortfall = maxShortfall;
        this.leftWidth = leftW;
        this.rightWidth = rightW;
    }

    render(x: number, y: number, ctx: StyleContext, els: React.ReactNode[]) {
        const padding = 2;
        this.renderDebugBox(x, y, ctx, els);
        
        this.renderDelimiter(this.leftChar, x, y, ctx, els);
        this.content.render(x + this.leftWidth + padding, y, ctx, els);
        this.renderDelimiter(this.rightChar, x + this.width - this.rightWidth, y, ctx, els);
    }

    private renderDelimiter(char: string, drawX: number, y: number, ctx: StyleContext, els: React.ReactNode[]) {
        const topY = y - this.ascent;
        const bottomY = y + this.descent;
        const totalH = this.ascent + this.descent;

        // If char is too small, render as text (text has graph-content by default in CharBox)
        if (totalH < MATH_CONSTANTS.DELIMITER_ASSEMBLY_THRESHOLD) {
            const scale = totalH / (ctx.fontSize * 0.8);
            els.push(
                React.createElement('text', {
                    key: `delim-char-${drawX}-${Math.random()}`,
                    x: drawX,
                    y: y + (this.descent - this.ascent) * 0.1, 
                    fontSize: ctx.fontSize * scale,
                    fontFamily: "Times New Roman",
                    fill: ctx.color,
                    className: 'graph-content',
                    transform: `scale(1, ${Math.min(1.5, scale)})`, 
                    style: { transformBox: 'fill-box', transformOrigin: 'center' }
                }, char)
            );
            return;
        }

        const glyph = DELIMITER_PATHS[char as keyof typeof DELIMITER_PATHS];
        if (!glyph) return;

        const capHeightPx = ctx.fontSize * MATH_CONSTANTS.DELIMITER_CAP_SCALE;
        const s = capHeightPx / MATH_CONSTANTS.PATH_UNIT_HEIGHT;
        
        const parts: React.ReactNode[] = [];
        parts.push(React.createElement('path', {
            key: `d-top-${drawX}`, d: glyph.top, fill: ctx.color, stroke: "none",
            transform: `translate(${drawX}, ${topY}) scale(${s})`
        }));

        parts.push(React.createElement('path', {
            key: `d-bot-${drawX}`, d: glyph.bot, fill: ctx.color, stroke: "none",
            transform: `translate(${drawX}, ${bottomY - (1000 * s)}) scale(${s})`
        }));

        const topH = 1000 * s;
        const botH = 1000 * s;
        const gap = totalH - topH - botH + (MATH_CONSTANTS.SEAM_OVERLAP * 2); 
        
        if (gap > 0) {
            const extScaleY = gap / 1000;
            parts.push(React.createElement('path', {
                key: `d-ext-${drawX}`, d: glyph.ext, fill: ctx.color, stroke: "none",
                transform: `translate(${drawX}, ${topY + topH - MATH_CONSTANTS.SEAM_OVERLAP}) scale(${s}, ${extScaleY})`
            }));
        }
        
        els.push(...parts);

        // Explicit Crop Bound
        const w = (glyph.width || 600) * s;
        els.push(
            React.createElement('rect', {
                key: `delim-crop-${drawX}`,
                x: drawX, y: topY,
                width: w, height: totalH,
                fill: 'transparent',
                stroke: 'none',
                className: 'graph-content',
                pointerEvents: 'none'
            })
        );
    }
}

export class MathLayoutEngine {
    public metrics: MathLayoutMetrics;

    constructor(metrics: Partial<MathLayoutMetrics> = {}) {
        this.metrics = { ...DEFAULT_MATH_METRICS, ...metrics };
    }

    // Tokenizer
    public tokenize(text: string): string[] {
        // Updated regex to include `&` and `\\` AND punctuation like `~` and `.`
        const re = /(\\\\|\\([a-zA-Z]+)|([a-zA-Z0-9+\-=<>!(),/[\]|.&~":;])|(\s+)|([{}^_]))/g;
        const tokens: string[] = [];
        let match;
        while ((match = re.exec(text)) !== null) {
            if (match[1] === '\\\\') tokens.push('\\\\');
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
            if (tok.startsWith('\\')) {
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
                else nodes.push(this.createCharNode(tok, tok === '(' || tok === '[' ? 'OPEN' : 'CLOSE'));
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
        }
        return { type: 'char', val: char, atomType: type };
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

            const ratio = widthMap[char] !== undefined ? widthMap[char] : 0.6;
            const width = ratio * fontSize;
            
            // Standard Times New Roman approx
            const ascent = fontSize * 0.72; // Cap height ish
            const descent = fontSize * 0.28;

            return new CharBox(char, width, ascent, descent, node.atomType || 'ORD', ctx.isMath);
        }

        // GROUP (Row)
        if (node.type === 'group') {
            if (!node.children || node.children.length === 0) return new EmptyBox(0, 0, 0);
            
            const boxes: { box: Box, offset: number }[] = [];
            let currentX = 0;
            let maxAsc = 0;
            let maxDesc = 0;
            let prevType: AtomType | null = null;

            node.children.forEach(child => {
                const box = this.makeBox(child, ctx);
                
                // Add Glue
                let glue = 0;
                if (ctx.isMath && prevType && box.atomType) {
                    // Logic from TeX
                    if (prevType === 'ORD' && box.atomType === 'BIN') glue = this.metrics.glueOrdBin;
                    else if (prevType === 'BIN' && box.atomType === 'ORD') glue = this.metrics.glueBinOrd;
                    else if (prevType === 'ORD' && box.atomType === 'REL') glue = this.metrics.glueOrdRel;
                    else if (prevType === 'REL' && box.atomType === 'ORD') glue = this.metrics.glueRelOrd;
                    else if (prevType === 'ORD' && box.atomType === 'PUNCT') glue = this.metrics.glueOrdPunct;
                    else if (prevType === 'PUNCT' && box.atomType === 'ORD') glue = this.metrics.glueOrdPunct;
                }
                
                currentX += glue * fontSize;
                boxes.push({ box, offset: currentX });
                currentX += box.width;
                
                maxAsc = Math.max(maxAsc, box.ascent);
                maxDesc = Math.max(maxDesc, box.descent);
                prevType = box.atomType;
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
            const layout = calculateTableLayout(matrixRows, fontSize);
            
            // 3. Construct Box
            // TABLE MODE: Use TableGridBox which draws grid lines
            if (node.isTable) {
                // TableGridBox now imports logic from tableLogic internally for rendering grid lines
                // But we construct it with the calculated layout and child positions mapped
                const children = layout.childPositions.map(pos => {
                    const box = matrixRows[pos.row][pos.col];
                    return { box, x: pos.x, y: pos.y };
                });
                
                return new TableGridBox(layout, children);
            }

            // MATRIX MODE: Wrap content in VerticalBox (standard math) then delimiters
            // Use same layout logic but wrap in simple box
            // Re-map children to VerticalBox format if possible, or just use a custom ContentBox
            const children = layout.childPositions.map(pos => {
                const box = matrixRows[pos.row][pos.col];
                // In VerticalBox, children are usually placed relative to top-left or baseline.
                // Here we have explicit x,y from center.
                // We'll create a custom container box for matrix content that places children explicitly.
                return { box, x: pos.x + layout.totalWidth/2, y: pos.y }; // Shift X to be relative to left edge for consistency?
                // Actually, DelimiterBox expects a Box. We can return a TableGridBox without grid lines?
                // Or a simple box that renders children.
            });
            
            // Quick fix: Use TableGridBox but suppress grid lines by not setting isTable flag?
            // Actually TableGridBox implementation above draws grid lines unconditionally.
            // Let's create a content box.
            const contentBox = new class extends Box {
                children: { box: Box, x: number, y: number }[];
                constructor() {
                    super(layout.totalWidth, layout.totalAscent, layout.totalDescent, 'ORD');
                    this.children = children;
                }
                render(x: number, y: number, ctx: StyleContext, els: React.ReactNode[]) {
                    // Similar to TableGridBox logic for content placement
                    const centerY = y + (this.descent - this.ascent) / 2;
                    // Children X in `children` array above was shifted to be from Left.
                    // But TableGridBox logic returns X from Center.
                    // Let's stick to X from center for consistency with TableGridBox.
                    const centerX = x + this.width / 2;
                    
                    layout.childPositions.forEach(pos => {
                        const box = matrixRows[pos.row][pos.col];
                        box.render(centerX + pos.x, centerY + pos.y, ctx, els);
                    });
                }
            }();
            
            // Wrap in delimiters (Force Square Brackets per User Request)
            return new DelimiterBox(contentBox, '[', ']', this.metrics.delimFactor, fontSize * this.metrics.delimMaxShortfall, fontSize);
        }

        // BOX (Exam Box) or GAP (Underline)
        if (node.type === 'box') {
            let settings = ctx.boxOptions || {};
            
            // Apply Layout-Time Overrides from interaction context
            if (ctx.layoutBoxIndexRef) {
                const currentIndex = ctx.layoutBoxIndexRef.current++;
                if (ctx.boxInteraction && ctx.boxInteraction.getBoxSettings) {
                    const overrides = ctx.boxInteraction.getBoxSettings(currentIndex);
                    if (overrides) {
                        settings = { ...settings, ...overrides };
                    }
                }
            }

            // Default metrics from config
            const wRatio = BOX_DEFAULTS.equationBox.widthRatio; 
            const hRatio = BOX_DEFAULTS.equationBox.heightRatio;
            const xHeight = fontSize * BOX_DEFAULTS.xHeightRatio;
            
            // Dimensions
            const rawW = xHeight * wRatio * (settings.widthScale || (node.widthFactor || 1.0));
            const rawH = xHeight * hRatio * (settings.heightScale || 1.0);
            
            // Positioning overrides
            const padL = settings.paddingLeft ?? BOX_DEFAULTS.equationBox.paddingLeft ?? 0;
            const padR = settings.paddingRight ?? BOX_DEFAULTS.equationBox.paddingRight ?? 0;
            const shiftX = settings.shiftX ?? BOX_DEFAULTS.equationBox.shiftX ?? 0;
            const shiftY = settings.shiftY ?? BOX_DEFAULTS.equationBox.shiftY ?? 0;
            const thickness = settings.thickness ?? BOX_DEFAULTS.equationBox.strokeWidth;

            // Total Layout Width = box width + padding
            const w = rawW + padL + padR;
            
            // Align to math axis
            const axisH = fontSize * this.metrics.axisHeight;
            const ascent = axisH + rawH/2;
            const descent = rawH/2 - axisH;

            // Decide Mode: Default to 'box' unless 'underline' specified
            const mode = node.renderMode || 'box';

            return new RectBox(w, rawW, ascent, descent, thickness, shiftX + padL, shiftY, mode); 
        }

        // FRACTION
        if (node.type === 'frac') {
             const numCtx = { ...ctx, fontSize: fontSize * 0.9 };
             const denCtx = { ...ctx, fontSize: fontSize * 0.9 };
             
             const num = this.makeBox(node.num || { type: 'char', val: '' }, numCtx);
             const den = this.makeBox(node.den || { type: 'char', val: '' }, denCtx);
             
             const ruleThick = fontSize * this.metrics.fracRuleThickness;
             const axisH = fontSize * this.metrics.axisHeight;
             const padding = fontSize * this.metrics.fracPadding;
             const gap = fontSize * this.metrics.fracGap;
 
             const maxWidth = Math.max(num.width, den.width) + padding * 2;
             const numX = (maxWidth - num.width) / 2;
             const denX = (maxWidth - den.width) / 2;
             
             const numY = -axisH - ruleThick/2 - gap - num.descent; 
             const denY = -axisH + ruleThick/2 + gap + den.ascent;
             
             const ascent = Math.max(fontSize, -numY + num.ascent);
             const descent = Math.max(fontSize, denY + den.descent);
             
             return new VerticalBox(maxWidth, ascent, descent, [
                 { box: num, x: numX, y: numY },
                 { box: den, x: denX, y: denY },
                 { box: new RuleBox(maxWidth, ruleThick, axisH), x: 0, y: -axisH }
             ]);
        }

        // RADICAL (Sqrt)
        if (node.type === 'sqrt') {
            const content = this.makeBox(node.children?.[0] || { type: 'group', children: [] }, ctx);
            const gap = fontSize * this.metrics.sqrtGap;
            const extraH = fontSize * this.metrics.sqrtExtraHeight;
            const shift = fontSize * this.metrics.sqrtVerticalShift;
            return new RadicalBox(content, gap, extraH, shift, fontSize);
        }

        // DELIMITER
        if (node.type === 'delim') {
            const content = this.makeBox({ type: 'group', children: node.children }, ctx);
            const char = node.val || '(';
            const rightChar = DELIMITER_PAIRS[char] || ')';
            const maxShortfall = fontSize * this.metrics.delimMaxShortfall;
            return new DelimiterBox(content, char, rightChar, this.metrics.delimFactor, maxShortfall, fontSize);
        }

        // SCRIPTS
        if (node.type === 'sup' || node.type === 'sub' || node.type === 'supsub') {
            const base = this.makeBox(node.base || { type: 'char', val: '' }, ctx);
            const scriptCtx = { ...ctx, fontSize: fontSize * this.metrics.scriptScale, depth: ctx.depth + 1 };
            
            const supBox = node.sup ? this.makeBox(node.sup, scriptCtx) : null;
            const subBox = node.sub ? this.makeBox(node.sub, scriptCtx) : null;
            
            const gap = fontSize * this.metrics.scriptHorizontalGap;
            const children: { box: Box, x: number, y: number }[] = [{ box: base, x: 0, y: 0 }];
            
            let width = base.width + gap;
            let asc = base.ascent;
            let desc = base.descent;

            if (supBox) {
                const shiftUp = Math.max(base.ascent * 0.5, fontSize * this.metrics.supShift);
                const supY = -shiftUp;
                children.push({ box: supBox, x: width, y: supY });
                width = Math.max(width, base.width + gap + supBox.width);
                asc = Math.max(asc, -supY + supBox.ascent);
            }

            if (subBox) {
                let subY = fontSize * this.metrics.subShift;
                if (supBox) {
                    // Collision check logic
                    const supBottom = -Math.max(base.ascent * 0.5, fontSize * this.metrics.supShift) + supBox.descent;
                    const subTop = subY - subBox.ascent;
                    const minGap = fontSize * this.metrics.supSubGapMin;
                    if (subTop - supBottom < minGap) {
                        subY = supBottom + minGap + subBox.ascent;
                    }
                }
                children.push({ box: subBox, x: base.width + gap, y: subY });
                width = Math.max(width, base.width + gap + subBox.width);
                desc = Math.max(desc, subY + subBox.descent);
            }

            return new VerticalBox(width, asc, desc, children);
        }

        return new EmptyBox(0, 0, 0);
    }

    public layoutRow(nodes: ParseNode[], ctx: StyleContext): Box {
        return this.makeBox({ type: 'group', children: nodes }, ctx);
    }
}
