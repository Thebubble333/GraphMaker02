
/*
 * -----------------------------------------------------------------------------
 * AI_READ_ONLY_FILE: DO NOT EDIT WITHOUT EXPRESS PERMISSION
 * This file contains the main Text Engine facade which handles mixed Mode (Text + Math).
 * It delegates actual math layout to utils/mathLayout.ts.
 * -----------------------------------------------------------------------------
 */

import React from 'react';
import { 
    DEFAULT_MATH_METRICS, MathLayoutEngine, 
    Box, CharBox, HorizontalBox, StyleContext, BoxStyleOptions, BoxInteractionContext
} from './mathLayout';
import type { MathLayoutMetrics } from './mathLayout';

// Value Exports
export { DEFAULT_MATH_METRICS as DEFAULT_TEXT_METRICS, Box, MathLayoutEngine, CharBox, HorizontalBox };
// Type Exports
export type { MathLayoutMetrics as TextLayoutMetrics, StyleContext, BoxStyleOptions, BoxInteractionContext };

export class TexEngine {
    private mathEngine: MathLayoutEngine;

    constructor(metrics: Partial<MathLayoutMetrics> = {}) {
        this.mathEngine = new MathLayoutEngine(metrics);
    }

    public measure(text: string, fontSize: number): { width: number, height: number, box: Box } {
        // Measure assumes pure text or pure math based on context, but here we assume Mixed Mode for measurement?
        // Since measure is used for labels which are typically mixed:
        const box = this.layoutMixed(text, { fontSize, isMath: false, isBold: false, color: 'black', depth: 0 });
        return { width: box.width, height: box.height, box };
    }

    public renderToSVG(
        text: string, 
        x: number, y: number, 
        fontSize: number, 
        color: string, 
        align: 'start'|'middle'|'end' = 'start', 
        hasBackground: boolean = false, 
        type: 'math'|'text' = 'math',
        debug: boolean = false, // Added debug flag
        boxOptions?: BoxStyleOptions, // Global box style overrides
        boxInteraction?: Omit<BoxInteractionContext, 'boxIndexRef'> // Handlers for individual boxes
    ): React.ReactNode[] {
        
        let box: Box;
        // Initialize mutable counter for this render pass
        const boxIndexRef = { current: 0 };
        // Initialize mutable counter for layout pass (dimensions)
        const layoutBoxIndexRef = { current: 0 };
        
        const interactionCtx = boxInteraction ? { ...boxInteraction, boxIndexRef } : undefined;

        const ctx: StyleContext = { 
            fontSize, isMath: false, isBold: false, color, debug, depth: 0, 
            boxOptions, boxInteraction: interactionCtx,
            layoutBoxIndexRef 
        };

        if (type === 'math') {
            // Strict Math Mode (Full LaTeX parser)
            const tokens = this.mathEngine.tokenize(text);
            const nodes = this.mathEngine.parse(tokens);
            // Math context forces isMath=true
            box = this.mathEngine.layoutRow(nodes, { ...ctx, isMath: true });
        } else {
            // Mixed Mode (Dollar Sign parsing)
            box = this.layoutMixed(text, ctx);
        }

        let startX = x;
        if (align === 'middle') startX -= box.width / 2;
        if (align === 'end') startX -= box.width;

        const els: React.ReactNode[] = [];
        
        if (hasBackground) {
            els.push(
                React.createElement('rect', {
                    key: `bg-${x}-${y}`,
                    x: startX - 2, y: y - box.ascent - 2,
                    width: box.width + 4, height: box.height + 4,
                    fill: 'white', opacity: 0.8
                })
            );
        }

        box.render(startX, y, ctx, els);
        return els;
    }

    private layoutMixed(text: string, ctx: StyleContext): Box {
        const parts = text.split('$');
        const boxes: { box: Box, offset: number }[] = [];
        let currentX = 0;
        let maxAsc = 0;
        let maxDesc = 0;

        parts.forEach((part, index) => {
            if (part.length === 0) return;

            const isMath = index % 2 === 1; // Odd indices are inside $...$
            let partBox: Box;

            if (isMath) {
                const tokens = this.mathEngine.tokenize(part);
                const nodes = this.mathEngine.parse(tokens);
                partBox = this.mathEngine.layoutRow(nodes, { ...ctx, isMath: true });
            } else {
                // Text Layout (Simple char sequence)
                // We handle text as a row of CharBoxes with standard metrics
                const charBoxes: { box: Box, offset: number }[] = [];
                let cx = 0;
                let cAsc = 0; 
                let cDesc = 0;
                
                // Using MathEngine's makeBox/charNode logic but forced to Text context
                // Or simply create CharBoxes manually
                for (const char of part) {
                    // Create a pseudo-node
                    const nodeBox = this.mathEngine.makeBox({ type: 'char', val: char }, { ...ctx, isMath: false });
                    charBoxes.push({ box: nodeBox, offset: cx });
                    cx += nodeBox.width;
                    cAsc = Math.max(cAsc, nodeBox.ascent);
                    cDesc = Math.max(cDesc, nodeBox.descent);
                }
                partBox = new HorizontalBox(cx, cAsc, cDesc, charBoxes);
            }

            boxes.push({ box: partBox, offset: currentX });
            currentX += partBox.width;
            maxAsc = Math.max(maxAsc, partBox.ascent);
            maxDesc = Math.max(maxDesc, partBox.descent);
        });

        return new HorizontalBox(currentX, maxAsc, maxDesc, boxes);
    }
}
