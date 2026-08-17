import React from 'react';
import * as math from 'mathjs';
import { BaseGraphEngine } from '../graphBase';
import { InequalityDef } from '../../types';

export type ComplexLocusType = 'circle' | 'line' | 'ray' | 'sector';

export interface ComplexLocus {
    type: ComplexLocusType;
    operator: '<' | '<=' | '>' | '>=' | '=';
    center?: { x: number, y: number };
    radius?: number;
    theta?: number;
    theta1?: number;
    theta2?: number;
    pointA?: { x: number, y: number };
    pointB?: { x: number, y: number };
}

function parseComplexOffset(s: string): { x: number, y: number } | null {
    if (!s || s.trim() === '') return { x: 0, y: 0 };
    try {
        let clean = s.replace(/i/g, 'i').replace(/I/g, 'i');
        // s is what comes after z, e.g. "-1-i" or "-(1+i)". We want to find c such that z + s = z - c
        // Thus c = -s
        const c = math.evaluate(`-(${clean})`);
        if (c && typeof c.re === 'number' && typeof c.im === 'number') return { x: c.re, y: c.im };
        if (typeof c === 'number') return { x: c, y: 0 };
        return null;
    } catch {
        return null;
    }
}

function parseRealVal(s: string): number | null {
    try {
        return math.evaluate(s);
    } catch {
        return null;
    }
}

export function parseComplexLocus(expr: string): ComplexLocus | null {
    let s = expr.replace(/\s+/g, '').replace(/pi/gi, 'PI');
    
    // a < Arg(z + offset) < b
    let sectorMatch = s.match(/(.*?)(<|<=)Arg\((z(.*?))\)(<|<=)(.*)/i);
    if (sectorMatch) {
        let t1 = parseRealVal(sectorMatch[1].replace(/PI/g, 'pi'));
        let t2 = parseRealVal(sectorMatch[6].replace(/PI/g, 'pi'));
        let center = parseComplexOffset(sectorMatch[4]);
        if (t1 !== null && t2 !== null && center) {
            return { type: 'sector', operator: '<', theta1: t1, theta2: t2, center };
        }
    }

    // Arg(z + offset) <=> theta
    let argMatch = s.match(/Arg\((z(.*?))\)(<=|>=|<|>|=)(.*)/i);
    if (argMatch) {
        let center = parseComplexOffset(argMatch[2]);
        let op = argMatch[3] as '<' | '<=' | '>' | '>=' | '=';
        let theta = parseRealVal(argMatch[4].replace(/PI/g, 'pi'));
        if (center && theta !== null) {
            return { type: 'ray', operator: op, center, theta };
        }
    }

    // |z + offset1| <=> |z + offset2|
    let lineMatch = s.match(/\|z(.*?)\|(<=|>=|<|>|=)\|z(.*?)\|/i);
    if (lineMatch) {
        let pointA = parseComplexOffset(lineMatch[1]);
        let op = lineMatch[2] as '<' | '<=' | '>' | '>=' | '=';
        let pointB = parseComplexOffset(lineMatch[3]);
        if (pointA && pointB) {
            return { type: 'line', operator: op, pointA, pointB };
        }
    }

    // |z + offset| <=> r
    let circleMatch = s.match(/\|z(.*?)\|(<=|>=|<|>|=)(.*)/i);
    if (circleMatch && !circleMatch[3].includes('|')) {
        let center = parseComplexOffset(circleMatch[1]);
        let op = circleMatch[2] as '<' | '<=' | '>' | '>=' | '=';
        let radius = parseRealVal(circleMatch[3].replace(/PI/g, 'pi'));
        if (center && radius !== null) {
            return { type: 'circle', operator: op, center, radius };
        }
    }

    return null;
}

export const renderComplexLoci = (
    engine: BaseGraphEngine,
    ineqs: InequalityDef[],
    mode: 'fill' | 'stroke',
    showIntersection: boolean,
    showFullBoundary: boolean = false,
    strokeWidth: number = 2
): React.ReactNode[] => {
    const { xStart, xEnd, yStart, yEnd } = engine.getGridBoundaries();
    const visibleIneqs = ineqs.filter(i => i.visible && i.type === 'complex' && i.expression);
    if (visibleIneqs.length === 0) return [];

    const calculated = visibleIneqs.map(ineq => {
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
            } else {
                regionPath = '';
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

        return { ineq, curvePath, regionPath, parsed };
    }).filter(x => x !== null) as { ineq: InequalityDef, curvePath: string, regionPath: string, parsed: ComplexLocus }[];

    if (calculated.length === 0) return [];

    if (mode === 'fill') {
        if (showIntersection) {
            const defs = React.createElement('defs', { key: 'defs-complex-fill-clips' }, 
                calculated.map((item) => 
                    React.createElement('clipPath', { key: `cp-fill-${item.ineq.id}`, id: `clip-fill-${item.ineq.id}` },
                        React.createElement('path', { d: item.regionPath })
                    )
                )
            );

            let content: React.ReactNode = React.createElement('rect', {
                key: 'complex-fill-rect-base',
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
                    key: `complex-fill-${ineq.id}`,
                    d: regionPath,
                    fill: ineq.color || "#808080",
                    opacity: 0.2,
                    stroke: "none"
                }) : null
            ));
        }
    } else {
        const defs = React.createElement('defs', { key: 'defs-complex-stroke-clips' }, 
            calculated.map((item) => 
                React.createElement('clipPath', { key: `cp-st-${item.ineq.id}`, id: `clip-stroke-${item.ineq.id}` },
                    React.createElement('path', { d: item.regionPath })
                )
            )
        );

        const renderLine = (item: typeof calculated[0]) => React.createElement('path', {
            key: `complex-stroke-${item.ineq.id}`,
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
