import React from 'react';
import * as math from 'mathjs';
import { BaseGraphEngine } from '../graphBase';
import { FunctionDef, IntegralDef, TangentDef, FeaturePoint } from '../../types';
import { findAllRoots } from '../mathAnalysis';

// Helper for parsing domain strings
const parseDomainBound = (val: any, fallback: number, scope: Record<string, number> = {}): number => {
    if (typeof val !== 'string' || !val.trim()) return fallback;
    try {
        const result = math.evaluate(val, scope);
        return typeof result === 'number' && isFinite(result) ? result : fallback;
    } catch { return fallback; }
};

/**
 * Render Integral Areas (Shading under curve OR between curves OR to Y-Axis)
 * Renders BEFORE function plots.
 */
export const renderIntegrals = (engine: BaseGraphEngine, integrals: IntegralDef[], functions: FunctionDef[], globalScope: Record<string, number> = {}): React.ReactNode[] => {
    return integrals.filter(int => int.visible).map(int => {
        // Find main function
        const f1 = functions.find(f => f.id === int.functionId1);
        if (!f1 || !f1.visible || !f1.expression || f1.isParametric || f1.type === 'parameter') return null;

        // Find secondary function (if exists and not special axis)
        const f2 = (int.functionId2 && int.functionId2 !== 'axis-y') ? functions.find(f => f.id === int.functionId2) : null;
        if (int.functionId2 && int.functionId2 !== 'axis-y' && (!f2 || !f2.visible || !f2.expression || f2.isParametric || f2.type === 'parameter')) return null;

        let compiled1: math.EvalFunction, compiled2: math.EvalFunction;
        try { 
            compiled1 = math.compile(f1.expression); 
            if (f2) compiled2 = math.compile(f2.expression);
        } catch { return null; }

        // Parse start/end bounds
        let startX = -Infinity;
        let endX = Infinity;
        
        if (int.start.trim()) {
            try { startX = math.evaluate(int.start, globalScope); } catch {}
        }
        if (int.end.trim()) {
            try { endX = math.evaluate(int.end, globalScope); } catch {}
        }

        // Determine effective rendering range based on View, Domain(s), and Integral Bounds
        const viewMin = engine.cfg.xRange[0];
        const viewMax = engine.cfg.xRange[1];
        
        const d1Min = parseDomainBound(f1.domain[0], -Infinity, globalScope);
        const d1Max = parseDomainBound(f1.domain[1], Infinity, globalScope);
        const d2Min = f2 ? parseDomainBound(f2.domain[0], -Infinity, globalScope) : -Infinity;
        const d2Max = f2 ? parseDomainBound(f2.domain[1], Infinity, globalScope) : Infinity;

        const effectiveMin = Math.max(viewMin, d1Min, d2Min, startX);
        const effectiveMax = Math.min(viewMax, d1Max, d2Max, endX);

        if (effectiveMax <= effectiveMin) return null;

        const steps = 200; // Base resolution for smooth curves
        
        // --- Special Handling for Y-Axis Shading ---
        if (int.functionId2 === 'axis-y') {
            const axisX_screen = engine.mathToScreen(0, 0)[0];
            const segments: { start: number, end: number }[] = [];
            
            // 1. Find turning points (roots of derivative)
            let turningPoints: number[] = [];
            try {
                const deriv = math.derivative(f1.expression, 'x');
                const derivCompiled = deriv.compile();
                const fnPrime = (x: number) => { try { return derivCompiled.evaluate({ ...globalScope, x }); } catch { return NaN; } };
                // Find all turning points in the range
                turningPoints = findAllRoots(fnPrime, effectiveMin, effectiveMax, 300);
            } catch {
                // Fallback: if derivative fails, treat as one segment
            }

            // 2. Create intervals: [min, t1, t2, ..., max]
            const points = [effectiveMin, ...turningPoints, effectiveMax]
                .sort((a,b) => a-b)
                .filter((v, i, a) => i===0 || v > a[i-1] + 1e-6); // Unique sorted

            for (let i = 0; i < points.length - 1; i++) {
                segments.push({ start: points[i], end: points[i+1] });
            }

            // 3. Generate a path for each segment
            const paths = segments.map((seg, i) => {
                const subSteps = 50; 
                const subDx = (seg.end - seg.start) / subSteps;
                const pathData: string[] = [];
                
                let startY = 0;
                let endY = 0;

                for (let j = 0; j <= subSteps; j++) {
                    const x = seg.start + j * subDx;
                    try {
                        const y = compiled1.evaluate({ ...globalScope, x });
                        if (typeof y === 'number' && isFinite(y)) {
                            const [px, py] = engine.mathToScreen(x, y);
                            if (j === 0) {
                                pathData.push(`M ${px} ${py}`);
                                startY = py;
                            } else {
                                pathData.push(`L ${px} ${py}`);
                            }
                            if (j === subSteps) endY = py;
                        }
                    } catch {}
                }
                
                if (pathData.length === 0) return null;

                pathData.push(`L ${axisX_screen} ${endY}`);
                pathData.push(`L ${axisX_screen} ${startY}`);
                pathData.push('Z');

                return React.createElement('path', {
                    key: `seg-${i}`,
                    d: pathData.join(' '),
                    fill: int.color,
                    fillOpacity: 1,
                    stroke: "none"
                });
            });

            return React.createElement('g', {
                key: `integral-group-${int.id}`,
                opacity: int.opacity
            }, paths);
        }

        // --- Standard X-Axis or Between-Curves Shading ---
        let pathCommands: string[] = [];
        const dx = (effectiveMax - effectiveMin) / steps;

        // 1. Trace F1 (Forward: Min -> Max)
        const f1Points: [number, number][] = [];
        for (let i = 0; i <= steps; i++) {
            const x = effectiveMin + i * dx;
            try {
                const y = compiled1.evaluate({ ...globalScope, x });
                if (typeof y === 'number' && isFinite(y)) {
                    f1Points.push(engine.mathToScreen(x, y));
                }
            } catch {}
        }

        if (f1Points.length === 0) return null;

        pathCommands.push(`M ${f1Points[0][0]} ${f1Points[0][1]}`);
        for (let i = 1; i < f1Points.length; i++) {
            pathCommands.push(`L ${f1Points[i][0]} ${f1Points[i][1]}`);
        }

        // 2. Trace Back logic
        if (f2 && compiled2) {
            // Between two functions
            const f2Points: [number, number][] = [];
            for (let i = steps; i >= 0; i--) {
                const x = effectiveMin + i * dx;
                try {
                    const y = compiled2.evaluate({ ...globalScope, x });
                    if (typeof y === 'number' && isFinite(y)) {
                        f2Points.push(engine.mathToScreen(x, y));
                    }
                } catch {}
            }
            f2Points.forEach(pt => pathCommands.push(`L ${pt[0]} ${pt[1]}`));
        } else {
            // Area to Axis (y=0)
            const [endPx, endAxisY] = engine.mathToScreen(effectiveMax, 0);
            const [startPx, startAxisY] = engine.mathToScreen(effectiveMin, 0);
            
            pathCommands.push(`L ${endPx} ${endAxisY}`);
            pathCommands.push(`L ${startPx} ${startAxisY}`);
        }

        pathCommands.push('Z');

        return React.createElement('path', {
            key: `integral-${int.id}`,
            d: pathCommands.join(' '),
            fill: int.color,
            fillOpacity: int.opacity,
            stroke: "none"
        });
    });
};

export interface BezierSegment {
    p0: [number, number];
    cp1: [number, number];
    cp2: [number, number];
    p1: [number, number];
}

export interface BezierPathData {
    pathString: string;
    segments: BezierSegment[];
}

export const generateBezierSegments = (engine: BaseGraphEngine, f: FunctionDef, steps = 100, globalScope: Record<string, number> = {}): BezierPathData[] => {
    const dMin = parseDomainBound(f.domain[0], f.isParametric ? 0 : -Infinity, globalScope);
    const dMax = parseDomainBound(f.domain[1], f.isParametric ? 2 * Math.PI : Infinity, globalScope);
    const tMin = f.isParametric ? dMin : Math.max(dMin, engine.cfg.xRange[0]);
    const tMax = f.isParametric ? dMax : Math.min(dMax, engine.cfg.xRange[1]);
    const dt = (tMax - tMin) / steps;

    const yMinView = engine.cfg.yRange[0];
    const yMaxView = engine.cfg.yRange[1];
    const yMargin = (yMaxView - yMinView) * 2;
    const yMinLimit = yMinView - yMargin;
    const yMaxLimit = yMaxView + yMargin;
    
    const xMinView = engine.cfg.xRange[0];
    const xMaxView = engine.cfg.xRange[1];
    const xMargin = (xMaxView - xMinView) * 2;
    const xMinLimit = xMinView - xMargin;
    const xMaxLimit = xMaxView + xMargin;

    let compiledFnX: math.EvalFunction | null = null;
    let compiledFnY: math.EvalFunction | null = null;
    let compiledDerivX: math.EvalFunction | null = null;
    let compiledDerivY: math.EvalFunction | null = null;

    try {
        if (f.isParametric) {
            compiledFnX = math.compile(f.expression);
            compiledFnY = math.compile(f.yExpression || '0');
            try { compiledDerivX = math.derivative(f.expression, 't').compile(); } catch {}
            try { compiledDerivY = math.derivative(f.yExpression || '0', 't').compile(); } catch {}
        } else {
            compiledFnY = math.compile(f.expression);
            try { compiledDerivY = math.derivative(f.expression, 'x').compile(); } catch {}
        }
    } catch { return []; }

    const evaluate = (t: number): { x: number, y: number, m: number, dx_dt: number, dy_dt: number } | null => {
        try {
            let x = t;
            let y = NaN;
            let dx_dt = 1;
            let dy_dt = NaN;

            if (f.isParametric) {
                if (!compiledFnX || !compiledFnY) return null;
                const xVal = compiledFnX.evaluate({ ...globalScope, t });
                const yVal = compiledFnY.evaluate({ ...globalScope, t });
                if (typeof xVal !== 'number' || !isFinite(xVal)) return null;
                if (typeof yVal !== 'number' || !isFinite(yVal)) return null;
                x = xVal;
                y = yVal;
                
                if (compiledDerivX) {
                    try { dx_dt = compiledDerivX.evaluate({ ...globalScope, t }); } catch {}
                } else {
                    const h = 1e-7;
                    try { dx_dt = (compiledFnX.evaluate({ ...globalScope, t: t + h }) - compiledFnX.evaluate({ ...globalScope, t: t - h })) / (2 * h); } catch {}
                }
                
                if (compiledDerivY) {
                    try { dy_dt = compiledDerivY.evaluate({ ...globalScope, t }); } catch {}
                } else {
                    const h = 1e-7;
                    try { dy_dt = (compiledFnY.evaluate({ ...globalScope, t: t + h }) - compiledFnY.evaluate({ ...globalScope, t: t - h })) / (2 * h); } catch {}
                }
            } else {
                if (!compiledFnY) return null;
                const yVal = compiledFnY.evaluate({ ...globalScope, x: t });
                if (typeof yVal !== 'number' || !isFinite(yVal)) return null;
                y = yVal;
                
                if (compiledDerivY) {
                    try { dy_dt = compiledDerivY.evaluate({ ...globalScope, x: t }); } catch {}
                } else {
                    const h = 1e-7;
                    try { dy_dt = (compiledFnY.evaluate({ ...globalScope, x: t + h }) - compiledFnY.evaluate({ ...globalScope, x: t - h })) / (2 * h); } catch {}
                }
            }

            if (y > yMaxLimit || y < yMinLimit || x > xMaxLimit || x < xMinLimit) return null;
            
            let m = dy_dt / dx_dt;
            if (isNaN(m) || !isFinite(m)) {
                // If dx_dt is 0, slope is infinity, which is fine, we handle it later
                if (Math.abs(dx_dt) < 1e-10 && Math.abs(dy_dt) > 1e-10) {
                    m = dy_dt > 0 ? Infinity : -Infinity;
                } else {
                    m = 0;
                }
            }
            
            return { x, y, m, dx_dt, dy_dt };
        } catch {
            return null;
        }
    };

    type PointData = { t: number, x: number, y: number, m: number, dx_dt: number, dy_dt: number };
    const points: PointData[] = [];
    let lastValid: PointData | null = null;

    let t = tMin;
    let lastStep = dt;
    
    while (t <= tMax + 1e-9) {
        let pt = evaluate(t);
        
        if (!lastValid && pt) {
            if (t > tMin + 1e-9) {
                let left = t - lastStep, right = t;
                let bestBoundary = pt;
                let bestT = t;
                for (let j = 0; j < 20; j++) {
                    const mid = (left + right) / 2;
                    const midPt = evaluate(mid);
                    if (midPt) {
                        bestBoundary = midPt;
                        bestT = mid;
                        right = mid;
                    } else {
                        left = mid;
                    }
                }
                pt = bestBoundary;
                t = bestT;
            }
        }
        
        if (pt) {
            points.push({ t, x: pt.x, y: pt.y, m: pt.m, dx_dt: pt.dx_dt, dy_dt: pt.dy_dt });
            lastValid = { t, ...pt };
            
            const D = dt * Math.max(engine.scaleX, engine.scaleY); // Target visual distance
            
            let idealStep = dt;
            if (isFinite(pt.dx_dt) && isFinite(pt.dy_dt) && (Math.abs(pt.dx_dt) > 1e-9 || Math.abs(pt.dy_dt) > 1e-9)) {
                const speed = Math.sqrt(Math.pow(pt.dx_dt * engine.scaleX, 2) + Math.pow(pt.dy_dt * engine.scaleY, 2));
                if (speed > 1e-9) {
                    idealStep = D / speed;
                }
            }
            
            let step = Math.min(dt, idealStep);
            if (step < dt / 10000) step = dt / 10000;
            
            let nextT_candidate = t + step;
            let nextPt = evaluate(nextT_candidate);
            
            if (!nextPt) {
                // Hit a boundary
                let left = t;
                let right = nextT_candidate;
                let bestBoundary = pt;
                let bestT = t;
                
                for (let j = 0; j < 20; j++) {
                    const mid = (left + right) / 2;
                    const midPt = evaluate(mid);
                    if (midPt) {
                        bestBoundary = midPt;
                        bestT = mid;
                        left = mid;
                    } else {
                        right = mid;
                    }
                }
                
                if (bestT > t) {
                    points.push({ t: bestT, x: bestBoundary.x, y: bestBoundary.y, m: bestBoundary.m, dx_dt: bestBoundary.dx_dt, dy_dt: bestBoundary.dy_dt });
                }
                points.push({ t: NaN, x: NaN, y: NaN, m: NaN, dx_dt: NaN, dy_dt: NaN });
                lastValid = null;
                
                lastStep = step;
                t = nextT_candidate;
                continue;
            } else {
                // Check if distance is too large due to changing derivative
                const distSq = Math.pow((nextPt.x - pt.x) * engine.scaleX, 2) + Math.pow((nextPt.y - pt.y) * engine.scaleY, 2);
                if (distSq > D * D * 1.5) {
                    let left = t;
                    let right = nextT_candidate;
                    let bestT = t;
                    for (let j = 0; j < 15; j++) {
                        const mid = (left + right) / 2;
                        const midPt = evaluate(mid);
                        if (midPt) {
                            const dSq = Math.pow((midPt.x - pt.x) * engine.scaleX, 2) + Math.pow((midPt.y - pt.y) * engine.scaleY, 2);
                            if (dSq > D * D) {
                                right = mid;
                            } else {
                                left = mid;
                                bestT = mid;
                            }
                        } else {
                            right = mid;
                        }
                    }
                    if (bestT > t) {
                        step = bestT - t;
                    }
                }
            }
            
            if (t + step > tMax && t < tMax - 1e-9) {
                step = tMax - t;
            }
            lastStep = step;
            t += step;
        } else {
            lastStep = dt;
            t += dt;
        }
    }

    const segments: PointData[][] = [];
    let currentSegment: PointData[] = [];
    for (const p of points) {
        if (isNaN(p.t)) {
            if (currentSegment.length > 0) segments.push(currentSegment);
            currentSegment = [];
        } else {
            if (currentSegment.length === 0 || Math.abs(currentSegment[currentSegment.length - 1].t - p.t) > 1e-9) {
                currentSegment.push(p);
            }
        }
    }
    if (currentSegment.length > 0) segments.push(currentSegment);

    const paths: BezierPathData[] = [];
    
    for (const seg of segments) {
        if (seg.length < 2) continue;
        
        const bezierSegs: BezierSegment[] = [];
        let pathString = '';
        
        const [startX, startY] = engine.mathToScreen(seg[0].x, seg[0].y);
        pathString += `M ${startX.toFixed(2)} ${startY.toFixed(2)} `;
        
        for (let i = 0; i < seg.length - 1; i++) {
            const p0 = seg[i];
            const p1 = seg[i+1];
            
            const dx_math = p1.x - p0.x;
            const dy_math = p1.y - p0.y;
            
            let dx0, dy0, dx1, dy1;
            
            if (f.isParametric) {
                const dt_seg = p1.t - p0.t;
                dx0 = p0.dx_dt * dt_seg / 3;
                dy0 = p0.dy_dt * dt_seg / 3;
                dx1 = p1.dx_dt * dt_seg / 3;
                dy1 = p1.dy_dt * dt_seg / 3;
            } else {
                dx0 = (1/3) * Math.min(dx_math, Math.abs(dy_math / p0.m));
                if (isNaN(dx0) || !isFinite(dx0)) dx0 = (1/3) * dx_math;
                dy0 = p0.m * dx0;
                if (isNaN(dy0) || !isFinite(dy0)) dy0 = (1/3) * dy_math;
                
                dx1 = (1/3) * Math.min(dx_math, Math.abs(dy_math / p1.m));
                if (isNaN(dx1) || !isFinite(dx1)) dx1 = (1/3) * dx_math;
                dy1 = p1.m * dx1;
                if (isNaN(dy1) || !isFinite(dy1)) dy1 = (1/3) * dy_math;
            }
            
            const cp1_math = { x: p0.x + dx0, y: p0.y + dy0 };
            const cp2_math = { x: p1.x - dx1, y: p1.y - dy1 };
            
            const [p0x, p0y] = engine.mathToScreen(p0.x, p0.y);
            const [p1x, p1y] = engine.mathToScreen(p1.x, p1.y);
            const [cp1x, cp1y] = engine.mathToScreen(cp1_math.x, cp1_math.y);
            const [cp2x, cp2y] = engine.mathToScreen(cp2_math.x, cp2_math.y);
            
            pathString += `C ${cp1x.toFixed(2)} ${cp1y.toFixed(2)}, ${cp2x.toFixed(2)} ${cp2y.toFixed(2)}, ${p1x.toFixed(2)} ${p1y.toFixed(2)} `;
            
            bezierSegs.push({
                p0: [p0x, p0y],
                cp1: [cp1x, cp1y],
                cp2: [cp2x, cp2y],
                p1: [p1x, p1y]
            });
        }
        
        paths.push({ pathString, segments: bezierSegs });
    }
    
    return paths;
};

const renderExperimentalPlot = (engine: BaseGraphEngine, f: FunctionDef, globalScope: Record<string, number> = {}): React.ReactNode | null => {
    const paths = generateBezierSegments(engine, f, 100, globalScope);
    if (paths.length === 0) return null;

    return React.createElement('g', { key: f.id }, 
        paths.map((p, i) => React.createElement('path', {
            key: `${f.id}-path-${i}`,
            d: p.pathString,
            fill: "none",
            stroke: f.color,
            strokeWidth: f.strokeWidth,
            strokeDasharray: f.lineType === 'dashed' ? '5,5' : f.lineType === 'dotted' ? '2,2' : undefined
        }))
    );
};

/**
 * Render function plots (e.g., y = sin(x))
 */
export const renderFunctionPlots = (engine: BaseGraphEngine, functions: FunctionDef[], globalScope: Record<string, number> = {}): React.ReactNode[] => {
    return functions.filter(f => f.visible && f.expression && f.type !== 'parameter').map(f => {
      if (f.plotterType === 'experimental' || f.isParametric) {
          return renderExperimentalPlot(engine, f, globalScope);
      }

      let points: string[] = [];
      const steps = 400;
      
      const dMin = parseDomainBound(f.domain[0], -Infinity, globalScope);
      const dMax = parseDomainBound(f.domain[1], Infinity, globalScope);

      const xMin = Math.max(dMin, engine.cfg.xRange[0]);
      const xMax = Math.min(dMax, engine.cfg.xRange[1]);
      const dx = (xMax - xMin) / steps;
      
      let compiled;
      try { compiled = math.compile(f.expression); } catch { return null; }

      for (let i = 0; i <= steps; i++) {
        const x = xMin + i * dx;
        try {
          const y = compiled.evaluate({ ...globalScope, x });
          if (typeof y === 'number' && isFinite(y)) {
            const [px, py] = engine.mathToScreen(x, y);
            points.push(`${px},${py}`);
          }
        } catch {}
      }

      if (points.length < 2) return null;
      return React.createElement('polyline', {
        key: f.id, points: points.join(' '), fill: "none", stroke: f.color, strokeWidth: f.strokeWidth,
        strokeDasharray: f.lineType === 'dashed' ? '5,5' : f.lineType === 'dotted' ? '2,2' : undefined
      });
    }).filter(x => x !== null) as React.ReactNode[];
};

/**
 * Render Tangent and Normal Lines (Drag Point Only)
 */
export const renderTangents = (
    engine: BaseGraphEngine, 
    tangents: TangentDef[], 
    functions: FunctionDef[],
    onMouseDown?: (id: string, e: React.MouseEvent) => void,
    globalScope: Record<string, number> = {}
): React.ReactNode[] => {
    return tangents.filter(t => t.visible).map(t => {
        const func = functions.find(f => f.id === t.functionId);
        if (!func || !func.expression || func.isParametric || func.type === 'parameter') return null;

        // Calculate geometry to place point
        let pointY: number, slope: number;
        try {
            const compiledFn = math.compile(func.expression);
            pointY = compiledFn.evaluate({ ...globalScope, x: t.x });
            const d1 = math.derivative(func.expression, 'x');
            slope = d1.evaluate({ ...globalScope, x: t.x });
        } catch { return null; }

        if (!isFinite(pointY) || !isFinite(slope)) return null;

        const [px, py] = engine.mathToScreen(t.x, pointY);
        const els: React.ReactNode[] = [];

        // Calculate infinite line points based on view box for HIT AREA only
        const xMin = engine.cfg.xRange[0];
        const xMax = engine.cfg.xRange[1];
        
        let p1: [number, number], p2: [number, number];
        let lineSlope = slope;
        if (t.mode === 'normal') {
            if (Math.abs(slope) < 1e-9) lineSlope = Infinity; // Vertical normal
            else lineSlope = -1 / slope;
        }

        if (!isFinite(lineSlope)) {
            const [vx] = engine.mathToScreen(t.x, 0);
            p1 = [vx, engine.getGridBoundaries().yStart];
            p2 = [vx, engine.getGridBoundaries().yEnd];
        } else {
            const yMin = lineSlope * (xMin - t.x) + pointY;
            const yMax = lineSlope * (xMax - t.x) + pointY;
            p1 = engine.mathToScreen(xMin, yMin);
            p2 = engine.mathToScreen(xMax, yMax);
        }

        // 1. Invisible Hit Area for Dragging
        els.push(React.createElement('line', {
            key: `tan-hit-line-${t.id}`,
            x1: p1[0], y1: p1[1], x2: p2[0], y2: p2[1],
            stroke: "transparent", strokeWidth: 15,
            style: { cursor: 'move' },
            onMouseDown: onMouseDown ? (e) => onMouseDown(t.id, e) : undefined
        }));

        // 2. The Drag Point (Visible)
        if (t.showPoint) {
            els.push(React.createElement('circle', {
                key: `tan-pt-${t.id}`,
                cx: px, cy: py, r: 4,
                fill: t.color, stroke: "white", strokeWidth: 1
            }));
            
            // Hit area for point specifically (larger)
            els.push(React.createElement('circle', {
                key: `tan-hit-pt-${t.id}`,
                cx: px, cy: py, r: 10,
                fill: "transparent",
                style: { cursor: 'move' },
                onMouseDown: onMouseDown ? (e) => onMouseDown(t.id, e) : undefined
            }));
        }

        return React.createElement('g', { key: t.id }, els);
    });
};

/**
 * Render feature points like roots, intercepts, stationary points AND Asymptotes
 */
export const renderFeatures = (engine: BaseGraphEngine, features: FeaturePoint[], onMouseDown?: (id: string, e: any) => void): React.ReactNode[] => {
    return features.filter(ft => ft.visible).map(ft => {
      const [px, py] = engine.mathToScreen(ft.x, ft.y);
      const els: React.ReactNode[] = [];
      const { yStart, yEnd, xStart, xEnd } = engine.getGridBoundaries();

      if (ft.type === 'vertical-asymptote') {
          // Vertical Dashed Line
          els.push(React.createElement('line', {
              key: `${ft.id}-vasy`, 
              x1: px, y1: yStart, x2: px, y2: yEnd,
              stroke: ft.color, 
              strokeWidth: engine.cfg.asymptoteThickness, // Use global config
              strokeDasharray: engine.cfg.asymptoteDashArray // Use global config
          }));
      } else if (ft.type === 'horizontal-asymptote') {
          // Horizontal Dashed Line
          els.push(React.createElement('line', {
              key: `${ft.id}-hasy`, 
              x1: xStart, y1: py, x2: xEnd, y2: py,
              stroke: ft.color, 
              strokeWidth: engine.cfg.asymptoteThickness, // Use global config
              strokeDasharray: engine.cfg.asymptoteDashArray // Use global config
          }));
      } else {
          // Standard Point
          els.push(React.createElement('circle', {
            key: `${ft.id}-pt`, cx: px, cy: py, r: ft.size || 4,
            fill: ft.style === 'filled' ? ft.color : 'white',
            stroke: ft.color, strokeWidth: 1.5
          }));
      }

      if (ft.showLabel) {
          const lx = px + ft.customLabelOffset.x;
          let anchorX = lx;
          let anchorY = py + ft.customLabelOffset.y;
          
          els.push(React.createElement('g', {
              key: `${ft.id}-lbl`,
              onMouseDown: onMouseDown ? (e: any) => onMouseDown(ft.id, e) : undefined,
              style: { cursor: 'move' }
          }, ...engine.texEngine.renderToSVG(ft.label, anchorX, anchorY, engine.cfg.fontSize - 2, ft.color, 'middle', true)));
      }
      return React.createElement('g', { key: ft.id }, ...els);
    });
};