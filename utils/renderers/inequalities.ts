
import React from 'react';
import * as math from 'mathjs';
import { BaseGraphEngine } from '../graphBase';
import { InequalityDef } from '../../types';

/**
 * Render inequality regions and boundaries
 */
export const renderInequalities = (
    engine: BaseGraphEngine, 
    ineqs: InequalityDef[], 
    mode: 'fill' | 'stroke', 
    showIntersection: boolean, 
    showFullBoundary: boolean = false,
    strokeWidth: number = 2
): React.ReactNode[] => {
    const { xStart, xEnd, yStart, yEnd } = engine.getGridBoundaries();
    const visibleIneqs = ineqs.filter(i => i.visible && i.expression);
    if (visibleIneqs.length === 0) return [];

    const calculated = visibleIneqs.map(ineq => {
        let compiled;
        try { compiled = math.compile(ineq.expression); } catch { return null; }

        const steps = 300; 
        const dx = (engine.cfg.xRange[1] - engine.cfg.xRange[0]) / steps;
        let points: [number, number][] = [];

        for (let i = 0; i <= steps; i++) {
            const x = engine.cfg.xRange[0] + i * dx;
            try {
                const val = compiled.evaluate({ x });
                if (typeof val === 'number' && isFinite(val)) {
                    points.push(engine.mathToScreen(x, val));
                }
            } catch {}
        }

        if (points.length < 2) return null;

        const curvePath = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p[0]} ${p[1]}`).join(' ');
        const fillY = (ineq.operator === '<' || ineq.operator === '<=') ? yEnd : yStart;
        const firstPt = points[0];
        const lastPt = points[points.length - 1];
        const regionPath = `${curvePath} L ${lastPt[0]} ${fillY} L ${firstPt[0]} ${fillY} Z`;

        return { ineq, curvePath, regionPath };
    }).filter(x => x !== null) as { ineq: InequalityDef, curvePath: string, regionPath: string }[];

    if (calculated.length === 0) return [];

    if (mode === 'fill') {
        if (showIntersection) {
            const defs = React.createElement('defs', { key: 'defs-fill-clips' }, 
                calculated.map((item) => 
                    React.createElement('clipPath', { key: `cp-fill-${item.ineq.id}`, id: `clip-fill-${item.ineq.id}` },
                        React.createElement('path', { d: item.regionPath })
                    )
                )
            );

            let content: React.ReactNode = React.createElement('rect', {
                x: xStart, y: yStart, width: xEnd - xStart, height: yEnd - yStart,
                fill: "#808080", 
                opacity: 0.4,
                stroke: "none"
            });

            calculated.forEach(item => {
                content = React.createElement('g', { clipPath: `url(#clip-fill-${item.ineq.id})` }, content);
            });

            return [defs, content];
        } else {
            return calculated.map(({ ineq, regionPath }) => (
                React.createElement('path', {
                    key: `fill-${ineq.id}`,
                    d: regionPath,
                    fill: ineq.color || "#808080",
                    opacity: 0.2,
                    stroke: "none"
                })
            ));
        }
    } else {
        const defs = React.createElement('defs', { key: 'defs-stroke-clips' }, 
            calculated.map((item) => 
                React.createElement('clipPath', { key: `cp-st-${item.ineq.id}`, id: `clip-stroke-${item.ineq.id}` },
                    React.createElement('path', { d: item.regionPath })
                )
            )
        );

        const renderLine = (item: typeof calculated[0]) => React.createElement('path', {
            key: `stroke-${item.ineq.id}`,
            d: item.curvePath,
            fill: "none",
            stroke: item.ineq.color || "black",
            strokeWidth: strokeWidth,
            strokeDasharray: ['<', '>'].includes(item.ineq.operator) ? '5,5' : undefined,
        });

        if (showIntersection && !showFullBoundary) {
            const lines = calculated.map((item, idx) => {
                let node = renderLine(item);
                const others = calculated.filter((_, i) => i !== idx);
                others.forEach(other => {
                    node = React.createElement('g', { clipPath: `url(#clip-stroke-${other.ineq.id})` }, node);
                });
                return React.createElement('g', { key: `grp-${item.ineq.id}` }, node);
            });
            return [defs, ...lines];
        } else {
            return calculated.map(renderLine);
        }
    }
};
