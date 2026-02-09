
import React from 'react';
import * as math from 'mathjs';
import { BaseGraphEngine } from '../graphBase';
import { FunctionDef, IntegralDef, TangentDef, FeaturePoint } from '../../types';
import { findAllRoots } from '../mathAnalysis';

/**
 * Render Integral Areas (Shading under curve OR between curves OR to Y-Axis)
 * Renders BEFORE function plots.
 */
export const renderIntegrals = (engine: BaseGraphEngine, integrals: IntegralDef[], functions: FunctionDef[]): React.ReactNode[] => {
    return integrals.filter(int => int.visible).map(int => {
        // Find main function
        const f1 = functions.find(f => f.id === int.functionId1);
        if (!f1 || !f1.visible || !f1.expression) return null;

        // Find secondary function (if exists and not special axis)
        const f2 = (int.functionId2 && int.functionId2 !== 'axis-y') ? functions.find(f => f.id === int.functionId2) : null;
        if (int.functionId2 && int.functionId2 !== 'axis-y' && (!f2 || !f2.visible || !f2.expression)) return null;

        let compiled1: math.EvalFunction, compiled2: math.EvalFunction;
        try { 
            compiled1 = math.compile(f1.expression); 
            if (f2) compiled2 = math.compile(f2.expression);
        } catch { return null; }

        // Parse start/end bounds
        let startX = -Infinity;
        let endX = Infinity;
        
        if (int.start.trim()) {
            try { startX = math.evaluate(int.start); } catch {}
        }
        if (int.end.trim()) {
            try { endX = math.evaluate(int.end); } catch {}
        }

        // Determine effective rendering range based on View, Domain(s), and Integral Bounds
        const viewMin = engine.cfg.xRange[0];
        const viewMax = engine.cfg.xRange[1];
        
        const d1Min = f1.domain[0] !== null ? f1.domain[0] : -Infinity;
        const d1Max = f1.domain[1] !== null ? f1.domain[1] : Infinity;
        const d2Min = f2 && f2.domain[0] !== null ? f2.domain[0] : -Infinity;
        const d2Max = f2 && f2.domain[1] !== null ? f2.domain[1] : Infinity;

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
                const fnPrime = (x: number) => { try { return derivCompiled.evaluate({x}); } catch { return NaN; } };
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
                        const y = compiled1.evaluate({ x });
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
                const y = compiled1.evaluate({ x });
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
                    const y = compiled2.evaluate({ x });
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

/**
 * Render function plots (e.g., y = sin(x))
 */
export const renderFunctionPlots = (engine: BaseGraphEngine, functions: FunctionDef[]): React.ReactNode[] => {
    return functions.filter(f => f.visible && f.expression).map(f => {
      let points: string[] = [];
      const steps = 400;
      const xMin = f.domain[0] !== null ? Math.max(f.domain[0], engine.cfg.xRange[0]) : engine.cfg.xRange[0];
      const xMax = f.domain[1] !== null ? Math.min(f.domain[1], engine.cfg.xRange[1]) : engine.cfg.xRange[1];
      const dx = (xMax - xMin) / steps;
      
      let compiled;
      try { compiled = math.compile(f.expression); } catch { return null; }

      for (let i = 0; i <= steps; i++) {
        const x = xMin + i * dx;
        try {
          const y = compiled.evaluate({ x });
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
    onMouseDown?: (id: string, e: React.MouseEvent) => void
): React.ReactNode[] => {
    return tangents.filter(t => t.visible).map(t => {
        const func = functions.find(f => f.id === t.functionId);
        if (!func || !func.expression) return null;

        // Calculate geometry to place point
        let pointY: number, slope: number;
        try {
            const compiledFn = math.compile(func.expression);
            pointY = compiledFn.evaluate({ x: t.x });
            const d1 = math.derivative(func.expression, 'x');
            slope = d1.evaluate({ x: t.x });
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
