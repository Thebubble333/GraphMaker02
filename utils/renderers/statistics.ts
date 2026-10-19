
import React from 'react';
import { BaseGraphEngine } from '../graphBase';
import { HistogramBarDef, PieSliceDef, BarGroupDef, GroupedBarSeriesDef, GroupedBarCategoryDef, PatternType } from '../../types';
import { ptToSvgUnits } from '../imageExport';

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
        studentMode?: boolean;
    }
): React.ReactNode[] => {
    if (config.studentMode) return [];
    
    return bars.map((bar, idx) => {
        const [xLeft, yTop] = engine.mathToScreen(bar.xMin, bar.frequency);
        const [xRight, yBottom] = engine.mathToScreen(bar.xMax, 0);
        
        const width = Math.max(0, xRight - xLeft);
        const height = Math.max(0, yBottom - yTop);
        
        return React.createElement('rect', {
            key: `hist-bar-${idx}`,
            'data-target-type': 'hist-bar',
            'data-target-id': String(idx),
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
    studentMode?: boolean;
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
    
    const activeFontSize = ptToSvgUnits(config.fontSize);

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
    if (config.studentMode) {
        // Just draw the empty circle(s)
        els.push(React.createElement('circle', {
            key: 'student-outer',
            cx, cy, r: radius,
            fill: 'none',
            stroke: config.strokeColor === '#ffffff' ? '#000000' : config.strokeColor,
            strokeWidth: config.strokeWidth
        }));
        if (innerRadius > 0) {
            els.push(React.createElement('circle', {
                key: 'student-inner',
                cx, cy, r: innerRadius,
                fill: 'none',
                stroke: config.strokeColor === '#ffffff' ? '#000000' : config.strokeColor,
                strokeWidth: config.strokeWidth
            }));
        }
        return els;
    }

    const defs = React.createElement('defs', { key: 'patterns-pie' }, [
        React.createElement('pattern', { key: 'p-sr', id: 'pat-pie-stripes-right', width: 10, height: 10, patternUnits: 'userSpaceOnUse', patternTransform: 'rotate(45)' }, 
            React.createElement('line', { x1: 0, y1: 0, x2: 0, y2: 10, stroke: 'black', strokeWidth: 2 })
        ),
        React.createElement('pattern', { key: 'p-sl', id: 'pat-pie-stripes-left', width: 10, height: 10, patternUnits: 'userSpaceOnUse', patternTransform: 'rotate(-45)' }, 
            React.createElement('line', { x1: 0, y1: 0, x2: 0, y2: 10, stroke: 'black', strokeWidth: 2 })
        ),
        React.createElement('pattern', { key: 'p-v', id: 'pat-pie-vertical', width: 10, height: 10, patternUnits: 'userSpaceOnUse' }, 
            React.createElement('line', { x1: 5, y1: 0, x2: 5, y2: 10, stroke: 'black', strokeWidth: 2 })
        ),
        React.createElement('pattern', { key: 'p-h', id: 'pat-pie-horizontal', width: 10, height: 10, patternUnits: 'userSpaceOnUse' }, 
            React.createElement('line', { x1: 0, y1: 5, x2: 10, y2: 5, stroke: 'black', strokeWidth: 2 })
        ),
        React.createElement('pattern', { key: 'p-g', id: 'pat-pie-grid', width: 8, height: 8, patternUnits: 'userSpaceOnUse' }, [
            React.createElement('line', { key: 'g1', x1: 0, y1: 4, x2: 8, y2: 4, stroke: 'black', strokeWidth: 1.5 }),
            React.createElement('line', { key: 'g2', x1: 4, y1: 0, x2: 4, y2: 8, stroke: 'black', strokeWidth: 1.5 })
        ]),
        React.createElement('pattern', { key: 'p-d', id: 'pat-pie-dots', width: 8, height: 8, patternUnits: 'userSpaceOnUse' }, [
            React.createElement('circle', { key: 'd1', cx: 2, cy: 2, r: 1.5, fill: 'black' }),
            React.createElement('circle', { key: 'd2', cx: 6, cy: 6, r: 1.5, fill: 'black' })
        ]),
        React.createElement('pattern', { key: 'p-c', id: 'pat-pie-crosshatch', width: 8, height: 8, patternUnits: 'userSpaceOnUse', patternTransform: 'rotate(45)' }, [
            React.createElement('line', { key: 'c1', x1: 0, y1: 0, x2: 0, y2: 8, stroke: 'black', strokeWidth: 1.5 }),
            React.createElement('line', { key: 'c2', x1: 0, y1: 4, x2: 8, y2: 4, stroke: 'black', strokeWidth: 1.5 })
        ])
    ]);
    els.push(defs);

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
            'data-target-type': 'pie-slice',
            'data-target-id': slice.id,
            d: pathData,
            fill: slice.color,
            stroke: config.borderStyle === 'dashed' ? config.strokeColor2 : config.strokeColor,
            strokeWidth: config.strokeWidth,
            transform: `translate(${offsetX}, ${offsetY})`,
            style: { cursor: onSliceMouseDown ? 'move' : 'default' },
            onMouseDown: onSliceMouseDown ? (e: any) => onSliceMouseDown(slice.id, e) : undefined
        }));

        // Pattern Overlay
        if (slice.pattern && slice.pattern !== 'none') {
            els.push(React.createElement('path', {
                key: `slice-pat-${slice.id}`,
                'data-target-type': 'pie-slice',
                'data-target-id': slice.id,
                d: pathData,
                fill: slice.pattern === 'solid' ? 'black' : `url(#pat-pie-${slice.pattern})`,
                stroke: 'none',
                transform: `translate(${offsetX}, ${offsetY})`,
                style: { mixBlendMode: 'multiply', pointerEvents: 'none' }
            }));
        }

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
                    'data-target-type': 'pie-label',
                    'data-target-id': slice.id,
                    onMouseDown: onLabelMouseDown ? (e: any) => onLabelMouseDown(slice.id, e) : undefined,
                    style: { cursor: onLabelMouseDown ? 'move' : 'default' }
                }, ...engine.texEngine.renderToSVG(
                    labelText, pos.x, pos.y + activeFontSize*0.3, activeFontSize, config.fontColor, 'middle', false, 'text'
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
                    'data-target-type': 'pie-label',
                    'data-target-id': slice.id,
                    onMouseDown: onLabelMouseDown ? (e: any) => onLabelMouseDown(slice.id, e) : undefined,
                    style: { cursor: onLabelMouseDown ? 'move' : 'default' }
                }, ...engine.texEngine.renderToSVG(
                    labelText, pos.x, pos.y + activeFontSize*0.3, activeFontSize, config.fontColor, align, false, 'text'
                ));
                els.push(labelGroup);
            }
        }

        currentAngle = endAngle;
    });

    return els;
};

/**
 * Render Bar Chart
 */
export const renderBarChart = (
    engine: BaseGraphEngine,
    categories: GroupedBarCategoryDef[],
    series: GroupedBarSeriesDef[],
    config: {
        barWidth: number; // visual width units
        worksheetMode: boolean; // If true, hide fills/patterns
        studentMode?: boolean; // If true, hide bars and labels
        strokeWidth: number;
        showValues: boolean;
        labelAngle?: number;
        labelVerticalShift?: number;
        labelHorizontalShift?: number;
    }
): { bars: React.ReactNode[], labels: React.ReactNode[] } => {
    const els: React.ReactNode[] = [];
    const labels: React.ReactNode[] = [];
    const { yStart, yEnd } = engine.getGridBoundaries();
    
    // Create Pattern Definitions
    const defs = React.createElement('defs', { key: 'patterns-bar' }, [
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
        // Dots
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

    const numSeries = series.length;

    categories.forEach((cat, cIdx) => {
        const xCenterVal = cIdx + 0.5;
        const [xCenterPx, bottomY] = engine.mathToScreen(xCenterVal, 0);
        
        const groupWidthPx = config.barWidth * engine.scaleX;
        const singleBarWidthPx = groupWidthPx / Math.max(1, numSeries);
        const startXPx = xCenterPx - groupWidthPx / 2;

        if (!config.studentMode) {
            series.forEach((s, sIdx) => {
                const val = cat.values[s.id] || 0;
                const [_, yTopPx] = engine.mathToScreen(0, val);
                const [__, yBasePx] = engine.mathToScreen(0, 0);
                
                const hPx = Math.abs(yBasePx - yTopPx);
                const xLeft = startXPx + sIdx * singleBarWidthPx;
                const rectY = Math.min(yTopPx, yBasePx);
                
                const fillColor = config.worksheetMode ? 'white' : s.color;
                const targetId = `${cat.id}:::${s.id}`;
                
                els.push(React.createElement('rect', {
                    key: `c-${cat.id}-s-${s.id}-fill`,
                    'data-target-type': 'bar',
                    'data-target-id': targetId,
                    x: xLeft, y: rectY, width: singleBarWidthPx, height: hPx,
                    fill: fillColor,
                    stroke: 'none'
                }));

                if (!config.worksheetMode && s.pattern && s.pattern !== 'none') {
                    if (s.pattern === 'solid') {
                        els.push(React.createElement('rect', {
                            key: `c-${cat.id}-s-${s.id}-pat`,
                            'data-target-type': 'bar',
                            'data-target-id': targetId,
                            x: xLeft, y: rectY, width: singleBarWidthPx, height: hPx,
                            fill: 'black',
                            stroke: 'none',
                            style: { mixBlendMode: 'multiply' }
                        }));
                    } else {
                        const patId = `pat-${s.pattern}`;
                        els.push(React.createElement('rect', {
                            key: `c-${cat.id}-s-${s.id}-pat`,
                            'data-target-type': 'bar',
                            'data-target-id': targetId,
                            x: xLeft, y: rectY, width: singleBarWidthPx, height: hPx,
                            fill: `url(#${patId})`,
                            stroke: 'none',
                            style: { mixBlendMode: 'multiply' }
                        }));
                    }
                }

                els.push(React.createElement('rect', {
                    key: `c-${cat.id}-s-${s.id}-stroke`,
                    'data-target-type': 'bar',
                    'data-target-id': targetId,
                    x: xLeft, y: rectY, width: singleBarWidthPx, height: hPx,
                    fill: 'none',
                    stroke: 'black',
                    strokeWidth: config.strokeWidth
                }));

                if (config.showValues) {
                    const valY = val >= 0 ? yTopPx - 10 : yTopPx + 20;
                    const barCenterPx = xLeft + singleBarWidthPx / 2;
                    els.push(...engine.texEngine.renderToSVG(
                        String(val), barCenterPx, valY, engine.cfg.fontSize, 'black', 'middle', false, 'text'
                    ));
                }
            });
        }

        if (cat.label && !config.studentMode) {
            const labelY = engine.getGridBoundaries().yEnd + 26 + (config.labelVerticalShift || 0);
            const labelX = xCenterPx + (config.labelHorizontalShift || 0);
            const angle = config.labelAngle || 0;
            
            const labelGroup = React.createElement('g', {
                key: `c-label-${cat.id}`,
                'data-target-type': 'cat-label',
                'data-target-id': cat.id,
                transform: angle !== 0 ? `rotate(${angle}, ${labelX}, ${labelY})` : undefined
            }, ...engine.texEngine.renderToSVG(
                cat.label, labelX, labelY, engine.cfg.fontSize, 'black', 'middle', false, 'text'
            ));
            labels.push(labelGroup);
        }
    });

    return { bars: els, labels };
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
        studentMode?: boolean; // If true, hide bars and labels
        strokeWidth: number;
        labelAngle?: number;
        labelVerticalShift?: number;
        labelHorizontalShift?: number;
    }
): { bars: React.ReactNode[], labels: React.ReactNode[] } => {
    if (config.studentMode) return { bars: [], labels: [] };
    const bars: React.ReactNode[] = [];
    const labels: React.ReactNode[] = [];
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
    bars.push(defs);

    // Iterate Groups (Bars)
    groups.forEach((group, gIdx) => {
        const xCenterVal = gIdx + 0.5;
        const [xCenterPx, bottomY] = engine.mathToScreen(xCenterVal, 0);
        
        const barWidthPx = group.width * engine.scaleX;
        const xLeft = xCenterPx - barWidthPx / 2;

        let currentY = 0; // Value accumulator

        // Draw Segments Bottom-Up
        group.segments.forEach((seg, sIdx) => {
            const segHeightVal = seg.value;
            const [_, yTopPx] = engine.mathToScreen(0, currentY + segHeightVal);
            const [__, yBasePx] = engine.mathToScreen(0, currentY);
            
            const hPx = Math.abs(yBasePx - yTopPx);
            const fillColor = config.worksheetMode ? 'white' : seg.color;
            const targetId = `${group.id}:::${seg.id}`;
            
            bars.push(React.createElement('rect', {
                key: `b-${group.id}-s-${seg.id}-fill`,
                'data-target-type': 'seg-bar',
                'data-target-id': targetId,
                x: xLeft, y: yTopPx, width: barWidthPx, height: hPx,
                fill: fillColor,
                stroke: 'none'
            }));

            // 2. Pattern Overlay
            if (!config.worksheetMode && seg.pattern && seg.pattern !== 'none') {
                if (seg.pattern === 'solid') {
                    bars.push(React.createElement('rect', {
                        key: `b-${group.id}-s-${seg.id}-pat`,
                        'data-target-type': 'seg-bar',
                        'data-target-id': targetId,
                        x: xLeft, y: yTopPx, width: barWidthPx, height: hPx,
                        fill: 'black',
                        stroke: 'none',
                        style: { mixBlendMode: 'multiply' }
                    }));
                } else {
                    const patId = `pat-${seg.pattern}`;
                    bars.push(React.createElement('rect', {
                        key: `b-${group.id}-s-${seg.id}-pat`,
                        'data-target-type': 'seg-bar',
                        'data-target-id': targetId,
                        x: xLeft, y: yTopPx, width: barWidthPx, height: hPx,
                        fill: `url(#${patId})`,
                        stroke: 'none',
                        style: { mixBlendMode: 'multiply' }
                    }));
                }
            }

            // 3. Outline
            bars.push(React.createElement('rect', {
                key: `b-${group.id}-s-${seg.id}-stroke`,
                'data-target-type': 'seg-bar',
                'data-target-id': targetId,
                x: xLeft, y: yTopPx, width: barWidthPx, height: hPx,
                fill: 'none',
                stroke: 'black',
                strokeWidth: config.strokeWidth
            }));

            currentY += segHeightVal;
        });

        // X-Axis Label for the Bar
        if (group.label) {
            const labelY = engine.getGridBoundaries().yEnd + 26 + (config.labelVerticalShift || 0);
            const labelX = xCenterPx + (config.labelHorizontalShift || 0);
            const angle = config.labelAngle || 0;
            
            const labelGroup = React.createElement('g', {
                key: `g-label-${group.id}`,
                'data-target-type': 'group-label',
                'data-target-id': group.id,
                transform: angle !== 0 ? `rotate(${angle}, ${labelX}, ${labelY})` : undefined
            }, ...engine.texEngine.renderToSVG(
                group.label, labelX, labelY, engine.cfg.fontSize, 'black', 'middle', false, 'text'
            ));
            labels.push(labelGroup);
        }
    });

    return { bars, labels };
};
