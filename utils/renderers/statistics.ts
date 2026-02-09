
import React from 'react';
import { BaseGraphEngine } from '../graphBase';
import { HistogramBarDef, PieSliceDef, BarGroupDef, PatternType } from '../../types';

/**
 * Render Histogram Bars
 */
export const renderHistograms = (
    engine: BaseGraphEngine,
    bars: HistogramBarDef[],
    config: {
        fillColor: string;
        strokeColor: string;
        strokeWidth: number;
        opacity: number;
    }
): React.ReactNode[] => {
    return bars.map((bar, idx) => {
        const [xLeft, yTop] = engine.mathToScreen(bar.xMin, bar.frequency);
        const [xRight, yBottom] = engine.mathToScreen(bar.xMax, 0);
        
        const width = Math.max(0, xRight - xLeft);
        const height = Math.max(0, yBottom - yTop);
        
        return React.createElement('rect', {
            key: `hist-bar-${idx}`,
            x: xLeft,
            y: yTop,
            width: width,
            height: height,
            fill: config.fillColor,
            fillOpacity: config.opacity,
            stroke: config.strokeColor,
            strokeWidth: config.strokeWidth
        });
    });
};

/**
 * Render Pie Chart
 */
export interface PieChartConfig {
    cx: number;
    cy: number;
    radius: number;
    innerRadius: number; // For donut, 0 for pie
    startAngle: number; // Degrees
    strokeColor: string;
    strokeColor2: string; // Gap/Fill color for dashed borders
    strokeWidth: number;
    borderStyle: 'solid' | 'dashed';
    dashLength: number;
    dashSpace: number;
    labelType: 'name' | 'value' | 'percent' | 'combined' | 'none';
    labelPosition: 'inside' | 'outside' | 'legend';
    labelRadiusOffset: number;
    fontSize: number;
    fontColor: string;
}

export const renderPieChart = (
    engine: BaseGraphEngine,
    slices: PieSliceDef[],
    config: PieChartConfig,
    onSliceMouseDown?: (id: string, e: any) => void,
    onLabelMouseDown?: (id: string, e: any) => void
): React.ReactNode[] => {
    const els: React.ReactNode[] = [];
    
    // Calculate total for percentages/angles
    const total = slices.reduce((sum, s) => sum + (s.visible ? s.value : 0), 0);
    if (total <= 0) return [];

    let currentAngle = config.startAngle;
    const { cx, cy, radius, innerRadius } = config;

    // Helper to get coordinates
    const getCoords = (r: number, angleDeg: number, centerX: number = cx, centerY: number = cy) => {
        const angleRad = (angleDeg - 90) * (Math.PI / 180);
        return {
            x: centerX + r * Math.cos(angleRad),
            y: centerY + r * Math.sin(angleRad)
        };
    };

    // Helper to generate Label text
    const getLabelText = (s: PieSliceDef) => {
        const percent = ((s.value / total) * 100).toFixed(1) + "%";
        switch (config.labelType) {
            case 'name': return s.label;
            case 'value': return s.value.toString();
            case 'percent': return percent;
            case 'combined': return `${s.label}: ${percent}`;
            default: return '';
        }
    };

    // Render Slices
    slices.forEach((slice) => {
        if (!slice.visible || slice.value <= 0) return;

        const sliceAngle = (slice.value / total) * 360;
        const endAngle = currentAngle + sliceAngle;
        const midAngle = currentAngle + sliceAngle / 2;

        // Calculate Explosion Translation using numeric offset
        let offsetX = 0;
        let offsetY = 0;
        if (slice.explodeOffset > 0) {
            const coords = getCoords(slice.explodeOffset, midAngle, 0, 0);
            offsetX = coords.x;
            offsetY = coords.y;
        }

        // Generate Path
        const p1 = getCoords(radius, currentAngle);
        const p2 = getCoords(radius, endAngle);
        
        let pathData = "";
        const largeArc = sliceAngle > 180 ? 1 : 0;

        if (innerRadius > 0) {
            // Donut Path
            const p3 = getCoords(innerRadius, endAngle);
            const p4 = getCoords(innerRadius, currentAngle);
            
            pathData = [
                `M ${p1.x} ${p1.y}`,
                `A ${radius} ${radius} 0 ${largeArc} 1 ${p2.x} ${p2.y}`,
                `L ${p3.x} ${p3.y}`,
                `A ${innerRadius} ${innerRadius} 0 ${largeArc} 0 ${p4.x} ${p4.y}`,
                `Z`
            ].join(' ');
        } else {
            // Standard Pie Path
            pathData = [
                `M ${cx} ${cy}`,
                `L ${p1.x} ${p1.y}`,
                `A ${radius} ${radius} 0 ${largeArc} 1 ${p2.x} ${p2.y}`,
                `Z`
            ].join(' ');
        }

        // Draw Slice (Base Layer)
        // If dashed, this renders the slice color + the "gap" border color (strokeColor2)
        els.push(React.createElement('path', {
            key: `slice-base-${slice.id}`,
            d: pathData,
            fill: slice.color,
            stroke: config.borderStyle === 'dashed' ? config.strokeColor2 : config.strokeColor,
            strokeWidth: config.strokeWidth,
            transform: `translate(${offsetX}, ${offsetY})`,
            style: { cursor: onSliceMouseDown ? 'move' : 'default' },
            onMouseDown: onSliceMouseDown ? (e: any) => onSliceMouseDown(slice.id, e) : undefined
        }));

        // Draw Dash Overlay
        if (config.borderStyle === 'dashed') {
            els.push(React.createElement('path', {
                key: `slice-dash-${slice.id}`,
                d: pathData,
                fill: "none",
                stroke: config.strokeColor,
                strokeWidth: config.strokeWidth,
                strokeDasharray: `${config.dashLength},${config.dashSpace}`,
                transform: `translate(${offsetX}, ${offsetY})`,
                pointerEvents: "none"
            }));
        }

        // Draw Label
        if (config.labelType !== 'none' && config.labelPosition !== 'legend') {
            const labelText = getLabelText(slice);
            
            if (config.labelPosition === 'inside') {
                // Midpoint placement
                const baseR = innerRadius + (radius - innerRadius) * 0.5;
                const labelR = Math.max(0, baseR + config.labelRadiusOffset); // Add global offset
                const pos = getCoords(labelR, midAngle, cx + offsetX, cy + offsetY);
                
                const labelGroup = React.createElement('g', {
                    key: `label-g-${slice.id}`,
                    onMouseDown: onLabelMouseDown ? (e: any) => onLabelMouseDown(slice.id, e) : undefined,
                    style: { cursor: onLabelMouseDown ? 'move' : 'default' }
                }, ...engine.texEngine.renderToSVG(
                    labelText, pos.x, pos.y + config.fontSize*0.3, config.fontSize, config.fontColor, 'middle', false, 'text'
                ));
                els.push(labelGroup);

            } else if (config.labelPosition === 'outside') {
                const baseR = radius + 20; 
                const labelR = Math.max(radius + 5, baseR + config.labelRadiusOffset); // Ensure outside labels don't clip inside
                const pos = getCoords(labelR, midAngle, cx + offsetX, cy + offsetY);
                
                // Draw Leader Line
                const lineStart = getCoords(radius, midAngle, cx + offsetX, cy + offsetY);
                // Leader line ends slightly before text
                const lineEndR = labelR - 5;
                const lineEnd = getCoords(lineEndR, midAngle, cx + offsetX, cy + offsetY);
                
                els.push(React.createElement('line', {
                    key: `leader-${slice.id}`,
                    x1: lineStart.x, y1: lineStart.y,
                    x2: lineEnd.x, y2: lineEnd.y,
                    stroke: "black", strokeWidth: 1
                }));

                const align = (midAngle % 360) > 180 ? 'end' : 'start';
                
                const labelGroup = React.createElement('g', {
                    key: `label-g-${slice.id}`,
                    onMouseDown: onLabelMouseDown ? (e: any) => onLabelMouseDown(slice.id, e) : undefined,
                    style: { cursor: onLabelMouseDown ? 'move' : 'default' }
                }, ...engine.texEngine.renderToSVG(
                    labelText, pos.x, pos.y + config.fontSize*0.3, config.fontSize, config.fontColor, align, false, 'text'
                ));
                els.push(labelGroup);
            }
        }

        currentAngle = endAngle;
    });

    return els;
};

/**
 * Render Segmented Bar Chart
 */
export const renderSegmentedBars = (
    engine: BaseGraphEngine,
    groups: BarGroupDef[],
    config: {
        barSpacing: number; // Fraction of step 0-1
        worksheetMode: boolean; // If true, hide fills/patterns
        strokeWidth: number;
    }
): React.ReactNode[] => {
    const els: React.ReactNode[] = [];
    const { yStart, yEnd } = engine.getGridBoundaries();
    
    // Create Pattern Definitions
    const defs = React.createElement('defs', { key: 'patterns' }, [
        // Stripes Right
        React.createElement('pattern', { key: 'p-sr', id: 'pat-stripes-right', width: 10, height: 10, patternUnits: 'userSpaceOnUse', patternTransform: 'rotate(45)' }, 
            React.createElement('line', { x1: 0, y1: 0, x2: 0, y2: 10, stroke: 'black', strokeWidth: 2 })
        ),
        // Stripes Left
        React.createElement('pattern', { key: 'p-sl', id: 'pat-stripes-left', width: 10, height: 10, patternUnits: 'userSpaceOnUse', patternTransform: 'rotate(-45)' }, 
            React.createElement('line', { x1: 0, y1: 0, x2: 0, y2: 10, stroke: 'black', strokeWidth: 2 })
        ),
        // Vertical
        React.createElement('pattern', { key: 'p-v', id: 'pat-vertical', width: 10, height: 10, patternUnits: 'userSpaceOnUse' }, 
            React.createElement('line', { x1: 5, y1: 0, x2: 5, y2: 10, stroke: 'black', strokeWidth: 2 })
        ),
        // Horizontal
        React.createElement('pattern', { key: 'p-h', id: 'pat-horizontal', width: 10, height: 10, patternUnits: 'userSpaceOnUse' }, 
            React.createElement('line', { x1: 0, y1: 5, x2: 10, y2: 5, stroke: 'black', strokeWidth: 2 })
        ),
        // Grid
        React.createElement('pattern', { key: 'p-g', id: 'pat-grid', width: 8, height: 8, patternUnits: 'userSpaceOnUse' }, [
            React.createElement('line', { key: 'g1', x1: 0, y1: 4, x2: 8, y2: 4, stroke: 'black', strokeWidth: 1.5 }),
            React.createElement('line', { key: 'g2', x1: 4, y1: 0, x2: 4, y2: 8, stroke: 'black', strokeWidth: 1.5 })
        ]),
        // Dots - Staggered look for better fill
        React.createElement('pattern', { key: 'p-d', id: 'pat-dots', width: 8, height: 8, patternUnits: 'userSpaceOnUse' }, [
            React.createElement('circle', { key: 'd1', cx: 2, cy: 2, r: 1.5, fill: 'black' }),
            React.createElement('circle', { key: 'd2', cx: 6, cy: 6, r: 1.5, fill: 'black' })
        ]),
        // Crosshatch
        React.createElement('pattern', { key: 'p-c', id: 'pat-crosshatch', width: 8, height: 8, patternUnits: 'userSpaceOnUse', patternTransform: 'rotate(45)' }, [
            React.createElement('line', { key: 'c1', x1: 0, y1: 0, x2: 0, y2: 8, stroke: 'black', strokeWidth: 1.5 }),
            React.createElement('line', { key: 'c2', x1: 0, y1: 4, x2: 8, y2: 4, stroke: 'black', strokeWidth: 1.5 })
        ])
    ]);
    els.push(defs);

    // Calculate Bar Positions
    // We treat groups as indices 0, 1, 2... on the X axis if they are discrete.
    // However, the GraphEngine maps numerical X. 
    // We assume the user configures the X range to [0, n] and steps to 1.
    // Each bar is centered at X = index + 0.5 (or user defined).
    
    // Iterate Groups (Bars)
    groups.forEach((group, gIdx) => {
        // Assume X axis is 1-based or 0-based integers. 
        // Let's place bar centered at integer x = gIdx + 1 (standard 1, 2, 3...)
        const xCenterVal = gIdx + 1;
        const [xCenterPx, bottomY] = engine.mathToScreen(xCenterVal, 0);
        
        // Convert width from relative units to pixels. 
        // engine.scaleX is pixels per unit. 
        const barWidthPx = group.width * engine.scaleX;
        const xLeft = xCenterPx - barWidthPx / 2;

        let currentY = 0; // Value accumulator

        // Draw Segments Bottom-Up
        group.segments.forEach((seg, sIdx) => {
            const segHeightVal = seg.value;
            const [_, yTopPx] = engine.mathToScreen(0, currentY + segHeightVal);
            const [__, yBasePx] = engine.mathToScreen(0, currentY);
            
            const hPx = Math.abs(yBasePx - yTopPx);
            
            // 1. Base Fill (Color)
            // In Worksheet mode, this is white.
            const fillColor = config.worksheetMode ? 'white' : seg.color;
            
            els.push(React.createElement('rect', {
                key: `b-${group.id}-s-${seg.id}-fill`,
                x: xLeft, y: yTopPx, width: barWidthPx, height: hPx,
                fill: fillColor,
                stroke: 'none'
            }));

            // 2. Pattern Overlay
            // Only if not in worksheet mode and pattern is defined
            if (!config.worksheetMode && seg.pattern && seg.pattern !== 'none') {
                const patId = `pat-${seg.pattern}`;
                els.push(React.createElement('rect', {
                    key: `b-${group.id}-s-${seg.id}-pat`,
                    x: xLeft, y: yTopPx, width: barWidthPx, height: hPx,
                    fill: `url(#${patId})`,
                    stroke: 'none',
                    style: { mixBlendMode: 'multiply' } // Ensure pattern blends nicely
                }));
            }

            // 3. Outline
            els.push(React.createElement('rect', {
                key: `b-${group.id}-s-${seg.id}-stroke`,
                x: xLeft, y: yTopPx, width: barWidthPx, height: hPx,
                fill: 'none',
                stroke: 'black',
                strokeWidth: config.strokeWidth
            }));

            currentY += segHeightVal;
        });

        // X-Axis Label for the Bar
        if (group.label) {
            const labelY = engine.getGridBoundaries().yEnd + 20;
            els.push(...engine.texEngine.renderToSVG(
                group.label, xCenterPx, labelY, engine.cfg.fontSize, 'black', 'middle', false, 'text'
            ));
        }
    });

    return els;
};
