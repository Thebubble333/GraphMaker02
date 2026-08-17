import React from 'react';
import * as math from 'mathjs';
import { BaseGraphEngine } from '../graphBase';
import { InequalityDef } from '../../types';
import { preprocessMathExpression, findAllRoots, parseAdvancedInequality } from '../mathAnalysis';
import { parseComplexLocus } from './complexLoci';

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

    const flattenedIneqs: InequalityDef[] = [];
    visibleIneqs.forEach(iq => {
        if (iq.type === 'linear') {
            parseAdvancedInequality(iq.expression).forEach((res, idx) => {
                flattenedIneqs.push({
                    ...iq,
                    type: res.type as 'x' | 'y',
                    expression: res.expression,
                    operator: res.operator as '<' | '<=' | '>' | '>=',
                    id: `${iq.id}_sub_${idx}`
                });
            });
        } else {
            flattenedIneqs.push(iq);
        }
    });

    const calculated = flattenedIneqs.map(ineq => {
        if (ineq.type === 'complex') {
            const parsed = parseComplexLocus(ineq.expression);
            if (!parsed) return null;
            
            let curvePath = '';
            let regionPath = '';
            
            const pt = (x: number, y: number) => engine.mathToScreen(x, y);

            if (parsed.type === 'circle' && parsed.center && parsed.radius !== undefined) {
                const { x: cx, y: cy } = parsed.center;
                const r = parsed.radius;
                
                const cSc = pt(cx, cy);
                const p2 = pt(cx + r, cy);
                const rPx = Math.abs(p2[0] - cSc[0]);
                
                curvePath = `M ${cSc[0] - rPx} ${cSc[1]} A ${rPx} ${rPx} 0 1 1 ${cSc[0] + rPx} ${cSc[1]} A ${rPx} ${rPx} 0 1 1 ${cSc[0] - rPx} ${cSc[1]}`;
                
                if (parsed.operator === '<' || parsed.operator === '<=') {
                    regionPath = curvePath;
                } else if (parsed.operator === '>' || parsed.operator === '>=') {
                    regionPath = `M ${xStart} ${yStart} L ${xEnd} ${yStart} L ${xEnd} ${yEnd} L ${xStart} ${yEnd} Z ${curvePath}`;
                }
            }
            else if (parsed.type === 'line' && parsed.pointA && parsed.pointB) {
                const { x: ax, y: ay } = parsed.pointA;
                const { x: bx, y: by } = parsed.pointB;
                const mx = (ax + bx) / 2;
                const my = (ay + by) / 2;
                const dx = bx - ax;
                const dy = by - ay;
                const m = engine.cfg;
                const minX = m.xRange[0] - 10, maxX = m.xRange[1] + 10;
                const minY = m.yRange[0] - 10, maxY = m.yRange[1] + 10;
                
                let pts: [number, number][] = [];
                
                if (Math.abs(dy) > 1e-9) {
                    let y1 = my - (minX - mx) * dx / dy;
                    let y2 = my - (maxX - mx) * dx / dy;
                    pts.push([minX, y1], [maxX, y2]);
                }
                if (Math.abs(dx) > 1e-9) {
                    let x1 = mx - (minY - my) * dy / dx;
                    let x2 = mx - (maxY - my) * dy / dx;
                    pts.push([x1, minY], [x2, maxY]);
                }
                
                pts = pts.filter(p => p[0] >= minX-1 && p[0] <= maxX+1 && p[1] >= minY-1 && p[1] <= maxY+1);
                if (pts.length >= 2) {
                    const sc1 = pt(pts[0][0], pts[0][1]);
                    const sc2 = pt(pts[1][0], pts[1][1]);
                    curvePath = `M ${sc1[0]} ${sc1[1]} L ${sc2[0]} ${sc2[1]}`;
                    
                    const shiftX = ax - mx;
                    const shiftY = ay - my;
                    
                    const far1X = pts[0][0] + shiftX * 1000;
                    const far1Y = pts[0][1] + shiftY * 1000;
                    const far2X = pts[1][0] + shiftX * 1000;
                    const far2Y = pts[1][1] + shiftY * 1000;
                    
                    const fSc1 = pt(far1X, far1Y);
                    const fSc2 = pt(far2X, far2Y);
                    
                    if (parsed.operator === '<' || parsed.operator === '<=') {
                        regionPath = `M ${sc1[0]} ${sc1[1]} L ${sc2[0]} ${sc2[1]} L ${fSc2[0]} ${fSc2[1]} L ${fSc1[0]} ${fSc1[1]} Z`;
                    } else if (parsed.operator === '>' || parsed.operator === '>=') {
                        const far3X = pts[0][0] - shiftX * 1000;
                        const far3Y = pts[0][1] - shiftY * 1000;
                        const far4X = pts[1][0] - shiftX * 1000;
                        const far4Y = pts[1][1] - shiftY * 1000;
                        const fSc3 = pt(far3X, far3Y);
                        const fSc4 = pt(far4X, far4Y);
                        regionPath = `M ${sc1[0]} ${sc1[1]} L ${sc2[0]} ${sc2[1]} L ${fSc4[0]} ${fSc4[1]} L ${fSc3[0]} ${fSc3[1]} Z`;
                    }
                }
            }
            else if (parsed.type === 'ray' && parsed.center && parsed.theta !== undefined) {
                const { x: cx, y: cy } = parsed.center;
                let th = parsed.theta;
                const cSc = pt(cx, cy);
                const farX = cx + Math.cos(th) * 1000;
                const farY = cy + Math.sin(th) * 1000;
                const farSc = pt(farX, farY);
                
                curvePath = `M ${cSc[0]} ${cSc[1]} L ${farSc[0]} ${farSc[1]}`;
                
                if (parsed.operator !== '=') {
                    const startTh = -Math.PI;
                    const endTh = th;
                    const R = 10000; 
                    const p1 = pt(cx + R * Math.cos(startTh), cy + R * Math.sin(startTh));
                    const p2 = pt(cx + R * Math.cos(endTh), cy + R * Math.sin(endTh));
                    regionPath = `M ${cSc[0]} ${cSc[1]} L ${p1[0]} ${p1[1]} A ${R} ${R} 0 0 0 ${p2[0]} ${p2[1]} Z`;
                    if (parsed.operator === '>' || parsed.operator === '>=') {
                        const p3 = pt(cx + R * Math.cos(Math.PI), cy + R * Math.sin(Math.PI));
                        regionPath = `M ${cSc[0]} ${cSc[1]} L ${p2[0]} ${p2[1]} A ${R} ${R} 0 0 0 ${p3[0]} ${p3[1]} Z`;
                    }
                }
            }
            else if (parsed.type === 'sector' && parsed.center && parsed.theta1 !== undefined && parsed.theta2 !== undefined) {
                const { x: cx, y: cy } = parsed.center;
                const t1 = parsed.theta1;
                const t2 = parsed.theta2;
                const cSc = pt(cx, cy);
                
                const p1 = pt(cx + Math.cos(t1)*100, cy + Math.sin(t1)*100);
                const p2 = pt(cx + Math.cos(t2)*100, cy + Math.sin(t2)*100);
                curvePath = `M ${cSc[0]} ${cSc[1]} L ${p1[0]} ${p1[1]} M ${cSc[0]} ${cSc[1]} L ${p2[0]} ${p2[1]}`;
                
                const R = 20000; 
                const far1 = pt(cx + Math.cos(t1)*1000, cy + Math.sin(t1)*1000);
                const far2 = pt(cx + Math.cos(t2)*1000, cy + Math.sin(t2)*1000);
                
                let diff = (t2 - t1) % (2*Math.PI);
                if (diff < 0) diff += 2*Math.PI;
                const largeArc = diff > Math.PI ? 1 : 0;
                regionPath = `M ${cSc[0]} ${cSc[1]} L ${far1[0]} ${far1[1]} A ${R} ${R} 0 ${largeArc} 0 ${far2[0]} ${far2[1]} Z`;
            }

            return { ineq, curvePath, regionPath };
        }

        // Standard x/y inequalities
        let compiled;
        const { plotExpression, absExpressions } = preprocessMathExpression(ineq.expression);
        try { compiled = math.compile(plotExpression); } catch { return null; }

        const isX = ineq.type === 'x';
        const steps = 300; 
        const min = isX ? engine.cfg.yRange[0] : engine.cfg.xRange[0];
        const max = isX ? engine.cfg.yRange[1] : engine.cfg.xRange[1];
        const d = (max - min) / steps;
        
        const vals: number[] = [];
        for (let i = 0; i <= steps; i++) {
            vals.push(min + i * d);
        }

        absExpressions.forEach(absExpr => {
            try {
                const absCompiled = math.compile(absExpr);
                const absFn = (val: number) => {
                    try {
                        const res = absCompiled.evaluate(isX ? { y: val } : { x: val });
                        return typeof res === 'number' ? res : NaN;
                    } catch { return NaN; }
                };
                const roots = findAllRoots(absFn, min, max, 200);
                roots.forEach(r => {
                    if (r >= min && r <= max) {
                        vals.push(r);
                    }
                });
            } catch {}
        });

        vals.sort((a, b) => a - b);

        let points: [number, number][] = [];
        for (let i = 0; i < vals.length; i++) {
            const val = vals[i];
            if (i > 0 && Math.abs(val - vals[i-1]) < 1e-9) continue;
            try {
                const res = compiled.evaluate(isX ? { y: val } : { x: val });
                if (typeof res === 'number' && isFinite(res)) {
                    points.push(isX ? engine.mathToScreen(res, val) : engine.mathToScreen(val, res));
                }
            } catch {}
        }

        if (points.length < 2) return null;

        const curvePath = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p[0]} ${p[1]}`).join(' ');
        
        const firstPt = points[0];
        const lastPt = points[points.length - 1];
        
        let regionPath = "";
        if (isX) {
            const fillX = (ineq.operator === '<' || ineq.operator === '<=') ? xStart : xEnd;
            regionPath = `${curvePath} L ${fillX} ${lastPt[1]} L ${fillX} ${firstPt[1]} Z`;
        } else {
            const fillY = (ineq.operator === '<' || ineq.operator === '<=') ? yEnd : yStart;
            regionPath = `${curvePath} L ${lastPt[0]} ${fillY} L ${firstPt[0]} ${fillY} Z`;
        }

        return { ineq, curvePath, regionPath };
    }).filter(x => x !== null) as { ineq: InequalityDef, curvePath: string, regionPath: string }[];

    if (calculated.length === 0) return [];

    if (mode === 'fill') {
        if (showIntersection) {
            const defs = React.createElement('defs', { key: 'defs-fill-clips' }, 
                calculated.map((item) => 
                    React.createElement('clipPath', { key: `cp-fill-${item.ineq.id}`, id: `clip-fill-${item.ineq.id}` },
                        item.regionPath ? React.createElement('path', { d: item.regionPath }) : null
                    )
                )
            );

            let content: React.ReactNode = React.createElement('rect', {
                key: 'fill-rect-base',
                x: xStart, y: yStart, width: xEnd - xStart, height: yEnd - yStart,
                fill: "#808080", 
                opacity: 0.4,
                stroke: "none"
            });

            calculated.forEach(item => {
                if (item.regionPath) {
                    content = React.createElement('g', { 
                        key: `g-fill-${item.ineq.id}`, 
                        clipPath: `url(#clip-fill-${item.ineq.id})` 
                    }, content);
                }
            });

            return [defs, content];
        } else {
            return calculated.map(({ ineq, regionPath }) => (
                regionPath ? React.createElement('path', {
                    key: `fill-${ineq.id}`,
                    d: regionPath,
                    fill: ineq.color || "#808080",
                    opacity: 0.2,
                    stroke: "none"
                }) : null
            ));
        }
    } else {
        const defs = React.createElement('defs', { key: 'defs-stroke-clips' }, 
            calculated.map((item) => 
                React.createElement('clipPath', { key: `cp-st-${item.ineq.id}`, id: `clip-stroke-${item.ineq.id}` },
                    item.regionPath ? React.createElement('path', { d: item.regionPath }) : null
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
                    if (other.regionPath) {
                        node = React.createElement('g', { clipPath: `url(#clip-stroke-${other.ineq.id})` }, node);
                    }
                });
                return React.createElement('g', { key: `grp-${item.ineq.id}` }, node);
            });
            return [defs, ...lines];
        } else {
            return calculated.map(renderLine);
        }
    }
};
