
import { GraphConfig } from '../types';

/**
 * Strategy for Moving Axis Labels
 * Implements "Context-Aware Restricted Movement" with optional symmetric linking.
 */
export const calculateAxisLabelDrag = (
    currentConfig: GraphConfig,
    dx: number, dy: number,
    axis: 'x' | 'y',
    initialOffsets: { xx: number, xy: number, yx: number, yy: number },
    modifiers: { alt: boolean, ctrl: boolean }
): Partial<GraphConfig> => {
    const next: Partial<GraphConfig> = {};
    const { xx, xy, yx, yy } = initialOffsets;

    // Default linkAxisLabels to true if undefined
    // Allow linking if Alt (Free move) is NOT pressed. 
    // Ctrl (Constrained) NOW allows linking.
    const isLinked = currentConfig.linkAxisLabels !== false && !modifiers.alt;

    if (modifiers.alt) {
        // Alt: Free move single label (Unlinked)
        if (axis === 'x') {
            next.offsetXAxisLabelX = xx + dx;
            next.offsetXAxisLabelY = xy + dy;
        } else {
            next.offsetYAxisLabelX = yx + dx;
            next.offsetYAxisLabelY = yy + dy;
        }
    } else if (modifiers.ctrl) {
        // Ctrl: Constrained move perpendicular (Margin Only)
        // Now supports Linking if enabled
        if (axis === 'x') {
            next.offsetXAxisLabelY = xy + dy;

            if (isLinked) {
                 const yIsRight = currentConfig.yLabelStyle === 'right-center';
                 const factor = yIsRight ? 1 : -1;
                 next.offsetYAxisLabelX = yx + (dy * factor);
            }
        } else {
            next.offsetYAxisLabelX = yx + dx;

            if (isLinked) {
                 const yIsRight = currentConfig.yLabelStyle === 'right-center';
                 const change = yIsRight ? dx : -dx;
                 next.offsetXAxisLabelY = xy + change;
            }
        }
    } else {
        // Default: Context-Aware Restricted Movement + Optional Linking
        
        if (axis === 'x') {
            const xIsArrowEnd = currentConfig.xLabelStyle === 'arrow-end';
            
            if (xIsArrowEnd) {
                // PARALLEL MOVE (Along Axis)
                next.offsetXAxisLabelX = xx + dx;
                
                // Link Logic: If Y is also parallel (arrow-end), move it symmetrically.
                if (isLinked && currentConfig.yLabelStyle === 'arrow-end') {
                    // X moves Right (dx > 0) -> Y moves Up (dy < 0)
                    // Up decreases Y offset (towards top of screen). 
                    // So we subtract dx from Y offset.
                    next.offsetYAxisLabelY = yy - dx;
                }
            } else {
                // PERPENDICULAR MOVE (Margin)
                next.offsetXAxisLabelY = xy + dy;
                
                // Link Logic: If Y is also margin-based, move it symmetrically.
                if (isLinked && currentConfig.yLabelStyle !== 'arrow-end') {
                     // X moves Down (dy > 0, Outwards) -> Y moves Left/Right (Outwards)
                     const yIsRight = currentConfig.yLabelStyle === 'right-center';
                     // If Left: Outwards is Left (dx < 0). dy > 0 -> dx < 0. (yx - dy)
                     // If Right: Outwards is Right (dx > 0). dy > 0 -> dx > 0. (yx + dy)
                     const factor = yIsRight ? 1 : -1;
                     next.offsetYAxisLabelX = yx + (dy * factor);
                }
            }
        } else {
            // axis === 'y'
            const yIsArrowEnd = currentConfig.yLabelStyle === 'arrow-end';
            const yIsRight = currentConfig.yLabelStyle === 'right-center';

            if (yIsArrowEnd) {
                // PARALLEL MOVE (Along Axis)
                next.offsetYAxisLabelY = yy + dy;

                // Link Logic: If X is also parallel (arrow-end), move it symmetrically.
                if (isLinked && currentConfig.xLabelStyle === 'arrow-end') {
                    // Y moves Up (dy < 0) -> X moves Right (dx > 0)
                    // Right increases X offset.
                    // So we subtract dy (because dy is negative)
                    next.offsetXAxisLabelX = xx - dy;
                }
            } else {
                // PERPENDICULAR MOVE (Margin)
                next.offsetYAxisLabelX = yx + dx;
                
                // Link Logic: If X is also margin-based, move it symmetrically.
                if (isLinked && currentConfig.xLabelStyle !== 'arrow-end') {
                    // Y moves Outwards (dx) -> X moves Outwards (dy)
                    // Left-Center: Outwards is Left (dx < 0). We want X Down (dy > 0).
                    // Right-Center: Outwards is Right (dx > 0). We want X Down (dy > 0).
                    
                    const change = yIsRight ? dx : -dx;
                    next.offsetXAxisLabelY = xy + change;
                }
            }
        }
    }
    return next;
};

/**
 * Strategy for Resizing Axes via Arrows
 */
export const calculateAxisResize = (
    axis: 'x' | 'y',
    dx: number, dy: number,
    scaleX: number, scaleY: number,
    currentRange: { x: [number, number], y: [number, number] },
    side: 'positive' | 'negative',
    isShift: boolean
): { xMin?: string, xMax?: string, yMin?: string, yMax?: string } => {
    const changes: any = {};
    const minSpan = 0.1; // Prevent full collapse
    
    if (axis === 'x') {
        const mathDelta = dx / scaleX;
        
        if (isShift) {
            // Pan Mode: Shift both min and max
            // Drag Right (positive delta) -> Shift Window Left (values decrease) to match mouse movement
            const shift = -mathDelta;
            changes.xMin = (currentRange.x[0] + shift).toFixed(2);
            changes.xMax = (currentRange.x[1] + shift).toFixed(2);
        } else {
            // Resize Mode
            if (side === 'positive') {
                // Dragging Right End
                const newMax = currentRange.x[1] + mathDelta;
                if (newMax > currentRange.x[0] + minSpan) changes.xMax = newMax.toFixed(2);
            } else {
                // Dragging Left End
                const newMin = currentRange.x[0] + mathDelta;
                if (newMin < currentRange.x[1] - minSpan) changes.xMin = newMin.toFixed(2);
            }
        }
    } else {
        // Y Axis (Screen Y is inverted)
        const mathDelta = -dy / scaleY; 
        
        if (isShift) {
             // Pan Mode
             // Drag Up (dy < 0, delta > 0) -> Shift Window Down (values decrease)
             const shift = -mathDelta;
             changes.yMin = (currentRange.y[0] + shift).toFixed(2);
             changes.yMax = (currentRange.y[1] + shift).toFixed(2);
        } else {
            // Resize Mode
            if (side === 'positive') { 
                // Top End (Max Y)
                const newMax = currentRange.y[1] + mathDelta;
                if (newMax > currentRange.y[0] + minSpan) changes.yMax = newMax.toFixed(2);
            } else { 
                // Bottom End (Min Y)
                const newMin = currentRange.y[0] + mathDelta;
                if (newMin < currentRange.y[1] - minSpan) changes.yMin = newMin.toFixed(2);
            }
        }
    }
    return changes;
};
