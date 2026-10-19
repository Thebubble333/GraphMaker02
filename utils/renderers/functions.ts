import React from 'react';
import * as math from 'mathjs';
import { BaseGraphEngine } from '../graphBase';
import { FunctionDef, IntegralDef, TangentDef, FeaturePoint, VerticalLineDef } from '../../types';
import { findAllRoots, preprocessMathExpression } from '../mathAnalysis';

// Helper for parsing domain strings
const parseDomainBound = (val: any, fallback: number, scope: Record<string, number> = {}): number => {
    if (typeof val !== 'string' || !val.trim()) return fallback;
    try {
        const result = math.evaluate(preprocessMathExpression(val).parsed, scope);
        return typeof result === 'number' && isFinite(result) ? result : fallback;
    } catch { return fallback; }
};

export interface IntegralStats {
    signedIntegral: number;
    totalArea: number;
    effectiveMin: number;
    effectiveMax: number;
    chamberCount: number;
}

interface CompiledBoundaryCurve {
    id: string;
    fn: (x: number) => number;
    dMin: number;
    dMax: number;
}

interface VerticalWall {
    id: string;
    x: number;
}

export interface SlabStrip {
    id: string;
    slabIndex: number;
    xLeft: number;
    xRight: number;
    lowerCurve: CompiledBoundaryCurve;
    upperCurve: CompiledBoundaryCurve;
    yLeftLow: number;
    yLeftHigh: number;
    yRightLow: number;
    yRightHigh: number;
    leftClosed: boolean;
    rightClosed: boolean;
    leftWallId?: string;
    rightWallId?: string;
}

/**
 * Resolves the elementary vertical slab strips that make up the region bounded by
 * any number of selected functions, axes, vertical lines, and custom horizontal/vertical lines.
 */
export const resolveIntegralSlabs = (
    int: IntegralDef,
    functions: FunctionDef[],
    xRange: [number, number],
    globalScope: Record<string, number> = {},
    verticalLines: VerticalLineDef[] = []
): { strips: SlabStrip[]; isYAxisSingleCurve: boolean; singleCurve?: CompiledBoundaryCurve; vWallX?: number } => {
    // 1. Gather selected function IDs (backward compatible with functionId1 / functionId2)
    const rawFuncIds = (int.functionIds && int.functionIds.length > 0)
        ? int.functionIds
        : [
            int.functionId1,
            ...(int.functionId2 && int.functionId2 !== 'axis-y' ? [int.functionId2] : [])
        ].filter((id): id is string => Boolean(id));

    const uniqueFuncIds = Array.from(new Set(rawFuncIds));
    const curves: CompiledBoundaryCurve[] = [];

    uniqueFuncIds.forEach(fid => {
        const f = functions.find(fn => fn.id === fid);
        if (!f || !f.expression || f.isParametric || f.type === 'parameter') return;
        try {
            const { plotExpression } = preprocessMathExpression(f.expression);
            if (!plotExpression.trim()) return;
            const compiled = math.compile(plotExpression);
            const dMin = parseDomainBound(f.domain[0], -Infinity, globalScope);
            const dMax = parseDomainBound(f.domain[1], Infinity, globalScope);
            curves.push({
                id: `func-${f.id}`,
                dMin,
                dMax,
                fn: (x: number) => {
                    if (x < dMin - 1e-7 || x > dMax + 1e-7) return NaN;
                    try {
                        const val = compiled.evaluate({ ...globalScope, x });
                        return typeof val === 'number' && isFinite(val) ? val : NaN;
                    } catch { return NaN; }
                }
            });
        } catch {}
    });

    // 2. Gather custom horizontal lines (y = c or y = expr(x))
    const customLines = int.customLines || [];
    customLines.filter(l => l.type === 'horizontal' && l.value.trim() !== '').forEach(l => {
        try {
            const { plotExpression } = preprocessMathExpression(l.value);
            if (!plotExpression.trim()) return;
            const compiled = math.compile(plotExpression);
            curves.push({
                id: `custom-h-${l.id}`,
                dMin: -Infinity,
                dMax: Infinity,
                fn: (x: number) => {
                    try {
                        const val = compiled.evaluate({ ...globalScope, x });
                        return typeof val === 'number' && isFinite(val) ? val : NaN;
                    } catch { return NaN; }
                }
            });
        } catch {}
    });

    // 3. Gather Vertical Boundary Walls
    const vWalls: VerticalWall[] = [];
    const wantYAxis = Boolean(int.includeYAxis || int.functionId2 === 'axis-y');
    if (wantYAxis) {
        vWalls.push({ id: '__yaxis__', x: 0 });
    }

    (int.verticalLineIds || []).forEach(vlId => {
        const vl = verticalLines.find(v => v.id === vlId);
        if (!vl) return;
        const xVal = parseDomainBound(String(vl.x), NaN, globalScope);
        if (isFinite(xVal)) {
            vWalls.push({ id: `vline-${vl.id}`, x: xVal });
        }
    });

    customLines.filter(l => l.type === 'vertical' && l.value.trim() !== '').forEach(l => {
        const xVal = parseDomainBound(l.value, NaN, globalScope);
        if (isFinite(xVal)) {
            vWalls.push({ id: `custom-v-${l.id}`, x: xVal });
        }
    });

    const startX = int.start && int.start.trim() ? parseDomainBound(int.start, NaN, globalScope) : NaN;
    const endX = int.end && int.end.trim() ? parseDomainBound(int.end, NaN, globalScope) : NaN;
    if (isFinite(startX)) vWalls.push({ id: '__start__', x: startX });
    if (isFinite(endX)) vWalls.push({ id: '__end__', x: endX });

    // 4. Include X-Axis (y = 0) if explicitly requested OR if only 1 y-curve is present and not doing pure y-axis shading
    const implicitXAxis = curves.length === 1 && !wantYAxis && (int.includeXAxis !== false);
    if (int.includeXAxis || implicitXAxis) {
        curves.push({
            id: '__xaxis__',
            dMin: -Infinity,
            dMax: Infinity,
            fn: () => 0
        });
    }

    // Special case: Single curve shaded horizontally to Y-Axis (or a single vertical line)
    if (curves.length === 1 && (wantYAxis || vWalls.length > 0)) {
        const wallX = wantYAxis ? 0 : vWalls[0].x;
        return { strips: [], isYAxisSingleCurve: true, singleCurve: curves[0], vWallX: wallX };
    }

    if (curves.length < 2) {
        return { strips: [], isYAxisSingleCurve: false };
    }

    // 5. Determine overall X search interval
    let searchMin = xRange[0];
    let searchMax = xRange[1];
    if (isFinite(startX) && isFinite(endX)) {
        searchMin = Math.max(searchMin, Math.min(startX, endX));
        searchMax = Math.min(searchMax, Math.max(startX, endX));
    } else if (isFinite(startX)) {
        searchMin = Math.max(searchMin, startX);
    } else if (isFinite(endX)) {
        searchMax = Math.min(searchMax, endX);
    }

    if (!isFinite(searchMin) || !isFinite(searchMax) || searchMax <= searchMin + 1e-6) {
        return { strips: [], isYAxisSingleCurve: false };
    }

    // 6. Collect all critical X coordinates (intersections, vertical walls, domain endpoints)
    const criticalX: number[] = [searchMin, searchMax];

    vWalls.forEach(w => {
        if (w.x >= searchMin - 1e-6 && w.x <= searchMax + 1e-6) {
            criticalX.push(Math.max(searchMin, Math.min(searchMax, w.x)));
        }
    });

    curves.forEach(c => {
        if (isFinite(c.dMin) && c.dMin > searchMin && c.dMin < searchMax) criticalX.push(c.dMin);
        if (isFinite(c.dMax) && c.dMax > searchMin && c.dMax < searchMax) criticalX.push(c.dMax);
    });

    // Pairwise intersections between all boundary curves
    for (let i = 0; i < curves.length; i++) {
        for (let j = i + 1; j < curves.length; j++) {
            const c1 = curves[i];
            const c2 = curves[j];
            const pairMin = Math.max(searchMin, c1.dMin, c2.dMin);
            const pairMax = Math.min(searchMax, c1.dMax, c2.dMax);
            if (pairMax <= pairMin + 1e-6) continue;

            const diffFn = (x: number) => c1.fn(x) - c2.fn(x);
            const roots = findAllRoots(diffFn, pairMin, pairMax, 250).filter(r => Math.abs(diffFn(r)) < 1e-2);

            // Also check tangential intersections where diffFn(x) = 0 and diffFn'(x) = 0
            const diffPrime = (x: number) => {
                const h = 1e-5;
                return (diffFn(x + h) - diffFn(x - h)) / (2 * h);
            };
            const tangCandidates = findAllRoots(diffPrime, pairMin, pairMax, 150);
            tangCandidates.forEach(tc => {
                if (Math.abs(diffFn(tc)) < 1e-4 && !roots.some(r => Math.abs(r - tc) < 1e-3)) {
                    roots.push(tc);
                }
            });

            roots.forEach(r => {
                if (r >= searchMin && r <= searchMax) criticalX.push(r);
            });
        }
    }

    criticalX.sort((a, b) => a - b);
    const slabsX: number[] = [];
    criticalX.forEach(x => {
        if (slabsX.length === 0 || Math.abs(x - slabsX[slabsX.length - 1]) > 1e-4) {
            slabsX.push(x);
        }
    });

    if (slabsX.length < 2) {
        return { strips: [], isYAxisSingleCurve: false };
    }

    const findWallAt = (x: number): VerticalWall | undefined =>
        vWalls.find(w => Math.abs(w.x - x) < 5e-4);

    // 7. Build Elementary SlabStrips in each slab [x_r, x_{r+1}]
    const stripsBySlab: SlabStrip[][] = [];
    const allStrips: SlabStrip[] = [];

    for (let r = 0; r < slabsX.length - 1; r++) {
        const xL = slabsX[r];
        const xR = slabsX[r + 1];
        const width = xR - xL;
        if (width <= 1e-5) {
            stripsBySlab.push([]);
            continue;
        }

        const xMid = 0.5 * (xL + xR);
        const eps = Math.min(1e-5, width * 0.05);

        const active = curves
            .map(c => ({
                curve: c,
                yMid: c.fn(xMid),
                yL: c.fn(xL + eps),
                yR: c.fn(xR - eps)
            }))
            .filter(item => isFinite(item.yMid) && isFinite(item.yL) && isFinite(item.yR));

        active.sort((a, b) => a.yMid - b.yMid);

        const slabStrips: SlabStrip[] = [];
        const leftWall = findWallAt(xL);
        const rightWall = findWallAt(xR);

        if (int.shadingMode === 'between' && active.length >= 2) {
            // Outer envelope between minimum and maximum curves in this slab
            const bot = active[0];
            const top = active[active.length - 1];
            if (top.yMid - bot.yMid > 1e-5) {
                const strip: SlabStrip = {
                    id: `strip-${r}-env`,
                    slabIndex: r,
                    xLeft: xL,
                    xRight: xR,
                    lowerCurve: bot.curve,
                    upperCurve: top.curve,
                    yLeftLow: bot.yL,
                    yLeftHigh: top.yL,
                    yRightLow: bot.yR,
                    yRightHigh: top.yR,
                    leftClosed: Boolean(leftWall) || Math.abs(top.yL - bot.yL) < 2e-3,
                    rightClosed: Boolean(rightWall) || Math.abs(top.yR - bot.yR) < 2e-3,
                    leftWallId: leftWall?.id,
                    rightWallId: rightWall?.id
                };
                slabStrips.push(strip);
                allStrips.push(strip);
            }
        } else {
            for (let j = 0; j < active.length - 1; j++) {
                const bot = active[j];
                const top = active[j + 1];
                if (top.yMid - bot.yMid <= 1e-5) continue;

                const strip: SlabStrip = {
                    id: `strip-${r}-${j}`,
                    slabIndex: r,
                    xLeft: xL,
                    xRight: xR,
                    lowerCurve: bot.curve,
                    upperCurve: top.curve,
                    yLeftLow: bot.yL,
                    yLeftHigh: top.yL,
                    yRightLow: bot.yR,
                    yRightHigh: top.yR,
                    leftClosed: Boolean(leftWall) || Math.abs(top.yL - bot.yL) < 2e-3,
                    rightClosed: Boolean(rightWall) || Math.abs(top.yR - bot.yR) < 2e-3,
                    leftWallId: leftWall?.id,
                    rightWallId: rightWall?.id
                };
                slabStrips.push(strip);
                allStrips.push(strip);
            }
        }
        stripsBySlab.push(slabStrips);
    }

    if (allStrips.length === 0) {
        return { strips: [], isYAxisSingleCurve: false };
    }

    // If 'between' mode is explicitly chosen, filter by explicit vertical walls if >= 2 exist
    if (int.shadingMode === 'between') {
        if (vWalls.length >= 2) {
            const minW = Math.min(...vWalls.map(w => w.x));
            const maxW = Math.max(...vWalls.map(w => w.x));
            return {
                strips: allStrips.filter(s => s.xLeft >= minW - 1e-3 && s.xRight <= maxW + 1e-3),
                isYAxisSingleCurve: false
            };
        }
        return { strips: allStrips, isYAxisSingleCurve: false };
    }

    // 8. Connect adjacent SlabStrips across non-wall slab boundaries into 2D Chambers (Cells)
    const adj = new Map<string, Set<string>>();
    const hasLeftNeighbor = new Set<string>();
    const hasRightNeighbor = new Set<string>();
    allStrips.forEach(s => adj.set(s.id, new Set()));

    for (let r = 0; r < stripsBySlab.length - 1; r++) {
        const boundaryX = slabsX[r + 1];
        const wall = findWallAt(boundaryX);
        if (wall) continue; // Do not merge across an explicit vertical boundary line

        const leftList = stripsBySlab[r];
        const rightList = stripsBySlab[r + 1];

        for (const sL of leftList) {
            if (sL.rightClosed) continue;
            for (const sR of rightList) {
                if (sR.leftClosed) continue;
                const overlapLow = Math.max(sL.yRightLow, sR.yLeftLow);
                const overlapHigh = Math.min(sL.yRightHigh, sR.yLeftHigh);
                if (overlapHigh - overlapLow > 1e-3) {
                    adj.get(sL.id)!.add(sR.id);
                    adj.get(sR.id)!.add(sL.id);
                    hasRightNeighbor.add(sL.id);
                    hasLeftNeighbor.add(sR.id);
                }
            }
        }
    }

    interface Chamber {
        strips: SlabStrip[];
        isBounded: boolean;
        touchedBoundaries: Set<string>;
        minX: number;
        maxX: number;
    }

    const visited = new Set<string>();
    const chambers: Chamber[] = [];
    const stripMap = new Map<string, SlabStrip>();
    allStrips.forEach(s => stripMap.set(s.id, s));

    for (const s of allStrips) {
        if (visited.has(s.id)) continue;
        const queue: SlabStrip[] = [s];
        visited.add(s.id);
        const comp: SlabStrip[] = [];
        let isBounded = true;
        const touched = new Set<string>();
        let minX = Infinity;
        let maxX = -Infinity;

        while (queue.length > 0) {
            const curr = queue.shift()!;
            comp.push(curr);
            minX = Math.min(minX, curr.xLeft);
            maxX = Math.max(maxX, curr.xRight);

            touched.add(curr.lowerCurve.id);
            touched.add(curr.upperCurve.id);
            if (curr.leftWallId) touched.add(curr.leftWallId);
            if (curr.rightWallId) touched.add(curr.rightWallId);

            if (!curr.leftClosed && !hasLeftNeighbor.has(curr.id)) {
                isBounded = false;
            }
            if (!curr.rightClosed && !hasRightNeighbor.has(curr.id)) {
                isBounded = false;
            }

            adj.get(curr.id)!.forEach(nbrId => {
                if (!visited.has(nbrId)) {
                    visited.add(nbrId);
                    queue.push(stripMap.get(nbrId)!);
                }
            });
        }

        chambers.push({
            strips: comp,
            isBounded,
            touchedBoundaries: touched,
            minX,
            maxX
        });
    }

    // 9. If user clicked a Seed Point on the canvas, pick the chamber containing that point
    if (int.seedPoint && isFinite(int.seedPoint.x) && isFinite(int.seedPoint.y)) {
        const sx = int.seedPoint.x;
        const sy = int.seedPoint.y;
        const containingChamber = chambers.find(ch =>
            ch.strips.some(st => {
                if (sx < st.xLeft - 1e-4 || sx > st.xRight + 1e-4) return false;
                const yLow = st.lowerCurve.fn(sx);
                const yHigh = st.upperCurve.fn(sx);
                return isFinite(yLow) && isFinite(yHigh) && sy >= yLow - 1e-3 && sy <= yHigh + 1e-3;
            })
        );
        if (containingChamber) {
            return { strips: containingChamber.strips, isYAxisSingleCurve: false };
        }
    }

    // 10. Automatic Bounded Chamber Selection
    let candidateChambers = chambers.filter(ch => ch.isBounded);

    // If user specified >= 2 vertical walls, prefer chambers inside [minWall, maxWall]
    if (vWalls.length >= 2) {
        const minW = Math.min(...vWalls.map(w => w.x));
        const maxW = Math.max(...vWalls.map(w => w.x));
        const wallFiltered = candidateChambers.filter(ch => ch.minX >= minW - 1e-3 && ch.maxX <= maxW + 1e-3);
        if (wallFiltered.length > 0) {
            candidateChambers = wallFiltered;
        }
    }

    if (candidateChambers.length > 0) {
        let maxTouched = 0;
        candidateChambers.forEach(ch => {
            if (ch.touchedBoundaries.size > maxTouched) {
                maxTouched = ch.touchedBoundaries.size;
            }
        });
        const bestChambers = candidateChambers.filter(ch => ch.touchedBoundaries.size === maxTouched);
        return {
            strips: bestChambers.flatMap(ch => ch.strips),
            isYAxisSingleCurve: false
        };
    }

    // Fallback: if curves don't enclose a closed pocket inside the window (e.g. sin(x) and y=0 with no bounds, or 2 non-intersecting curves),
    // shade all strips (or strips between vertical walls if >= 2 walls exist)
    if (vWalls.length >= 2) {
        const minW = Math.min(...vWalls.map(w => w.x));
        const maxW = Math.max(...vWalls.map(w => w.x));
        return {
            strips: allStrips.filter(s => s.xLeft >= minW - 1e-3 && s.xRight <= maxW + 1e-3),
            isYAxisSingleCurve: false
        };
    }

    return { strips: allStrips, isYAxisSingleCurve: false };
};

export const calculateIntegralStats = (
    int: IntegralDef,
    functions: FunctionDef[],
    xRange: [number, number],
    globalScope: Record<string, number> = {},
    verticalLines: VerticalLineDef[] = []
): IntegralStats | null => {
    const resolved = resolveIntegralSlabs(int, functions, xRange, globalScope, verticalLines);

    if (resolved.isYAxisSingleCurve && resolved.singleCurve) {
        const wallX = resolved.vWallX ?? 0;
        const startX = int.start && int.start.trim() ? parseDomainBound(int.start, -Infinity, globalScope) : -Infinity;
        const endX = int.end && int.end.trim() ? parseDomainBound(int.end, Infinity, globalScope) : Infinity;
        const effectiveMin = Math.max(xRange[0], resolved.singleCurve.dMin, isFinite(startX) ? startX : -Infinity);
        const effectiveMax = Math.min(xRange[1], resolved.singleCurve.dMax, isFinite(endX) ? endX : Infinity);
        if (!isFinite(effectiveMin) || !isFinite(effectiveMax) || effectiveMax <= effectiveMin) return null;

        const N = 300;
        const h = (effectiveMax - effectiveMin) / N;
        let signedIntegral = 0;
        let totalArea = 0;
        for (let i = 0; i < N; i++) {
            const xm = effectiveMin + (i + 0.5) * h;
            const y = resolved.singleCurve.fn(xm);
            if (isFinite(y)) {
                signedIntegral += (xm - wallX) * h;
                totalArea += Math.abs(xm - wallX) * h;
            }
        }
        return { signedIntegral, totalArea, effectiveMin, effectiveMax, chamberCount: 1 };
    }

    if (resolved.strips.length === 0) return null;

    let signedIntegral = 0;
    let totalArea = 0;
    let effectiveMin = Infinity;
    let effectiveMax = -Infinity;

    for (const strip of resolved.strips) {
        effectiveMin = Math.min(effectiveMin, strip.xLeft);
        effectiveMax = Math.max(effectiveMax, strip.xRight);
        const N = 80;
        const h = (strip.xRight - strip.xLeft) / N;
        for (let i = 0; i < N; i++) {
            const xm = strip.xLeft + (i + 0.5) * h;
            const yLow = strip.lowerCurve.fn(xm);
            const yHigh = strip.upperCurve.fn(xm);
            if (isFinite(yLow) && isFinite(yHigh)) {
                const diff = yHigh - yLow;
                signedIntegral += diff * h;
                totalArea += Math.abs(diff) * h;
            }
        }
    }

    if (!isFinite(effectiveMin) || !isFinite(effectiveMax)) return null;
    return {
        signedIntegral,
        totalArea,
        effectiveMin,
        effectiveMax,
        chamberCount: resolved.strips.length
    };
};

/**
 * Render Integral Areas (Shading under curve, between any number of curves, or with custom lines)
 * Renders BEFORE function plots.
 */
export const renderIntegrals = (
    engine: BaseGraphEngine,
    integrals: IntegralDef[],
    functions: FunctionDef[],
    globalScope: Record<string, number> = {},
    verticalLines: VerticalLineDef[] = []
): React.ReactNode[] => {
    const { xStart, xEnd, yStart, yEnd } = engine.getGridBoundaries();

    return integrals.filter(int => int.visible).map(int => {
        const resolved = resolveIntegralSlabs(int, functions, engine.cfg.xRange, globalScope, verticalLines);
        const groupEls: React.ReactNode[] = [];

        // Render optional visible custom boundary lines (dashed) if toggled on
        (int.customLines || []).filter(l => l.showLine && l.value.trim() !== '').forEach(l => {
            if (l.type === 'vertical') {
                const xVal = parseDomainBound(l.value, NaN, globalScope);
                if (isFinite(xVal)) {
                    const [px] = engine.mathToScreen(xVal, 0);
                    groupEls.push(React.createElement('line', {
                        key: `custom-vline-${l.id}`,
                        x1: px, y1: yStart, x2: px, y2: yEnd,
                        stroke: int.color,
                        strokeWidth: 1.5,
                        strokeDasharray: '4,4',
                        strokeOpacity: Math.min(1, int.opacity + 0.4)
                    }));
                }
            } else {
                try {
                    const { plotExpression } = preprocessMathExpression(l.value);
                    const compiled = math.compile(plotExpression);
                    const pts: string[] = [];
                    const steps = 150;
                    const xMin = engine.cfg.xRange[0];
                    const xMax = engine.cfg.xRange[1];
                    const dx = (xMax - xMin) / steps;
                    for (let i = 0; i <= steps; i++) {
                        const x = xMin + i * dx;
                        const y = compiled.evaluate({ ...globalScope, x });
                        if (typeof y === 'number' && isFinite(y)) {
                            const [px, py] = engine.mathToScreen(x, y);
                            pts.push(`${px},${py}`);
                        }
                    }
                    if (pts.length >= 2) {
                        groupEls.push(React.createElement('polyline', {
                            key: `custom-hline-${l.id}`,
                            points: pts.join(' '),
                            fill: 'none',
                            stroke: int.color,
                            strokeWidth: 1.5,
                            strokeDasharray: '4,4',
                            strokeOpacity: Math.min(1, int.opacity + 0.4)
                        }));
                    }
                } catch {}
            }
        });

        // Case 1: Single curve shaded horizontally to a vertical line / Y-axis
        if (resolved.isYAxisSingleCurve && resolved.singleCurve) {
            const wallX = resolved.vWallX ?? 0;
            const axisX_screen = engine.mathToScreen(wallX, 0)[0];
            const startX = int.start && int.start.trim() ? parseDomainBound(int.start, -Infinity, globalScope) : -Infinity;
            const endX = int.end && int.end.trim() ? parseDomainBound(int.end, Infinity, globalScope) : Infinity;
            const effectiveMin = Math.max(engine.cfg.xRange[0], resolved.singleCurve.dMin, isFinite(startX) ? startX : -Infinity);
            const effectiveMax = Math.min(engine.cfg.xRange[1], resolved.singleCurve.dMax, isFinite(endX) ? endX : Infinity);

            if (effectiveMax > effectiveMin) {
                const subSteps = 150;
                const subDx = (effectiveMax - effectiveMin) / subSteps;
                const pathData: string[] = [];
                let startY = 0;
                let endY = 0;

                for (let j = 0; j <= subSteps; j++) {
                    const x = effectiveMin + j * subDx;
                    const y = resolved.singleCurve.fn(x);
                    if (isFinite(y)) {
                        const [px, py] = engine.mathToScreen(x, y);
                        if (pathData.length === 0) {
                            pathData.push(`M ${px} ${py}`);
                            startY = py;
                        } else {
                            pathData.push(`L ${px} ${py}`);
                        }
                        endY = py;
                    }
                }

                if (pathData.length > 0) {
                    pathData.push(`L ${axisX_screen} ${endY}`);
                    pathData.push(`L ${axisX_screen} ${startY}`);
                    pathData.push('Z');
                    groupEls.push(React.createElement('path', {
                        key: `integral-yaxis-${int.id}`,
                        d: pathData.join(' '),
                        fill: int.color,
                        fillOpacity: int.opacity,
                        stroke: 'none'
                    }));
                }
            }
        } else if (resolved.strips.length > 0) {
            // Case 2: Multi-curve / SlabStrip shading
            const stripPaths = resolved.strips.map((strip, idx) => {
                const steps = 60;
                const dx = (strip.xRight - strip.xLeft) / steps;
                const upperPts: [number, number][] = [];
                const lowerPts: [number, number][] = [];

                for (let i = 0; i <= steps; i++) {
                    const x = strip.xLeft + i * dx;
                    const yHigh = strip.upperCurve.fn(x);
                    const yLow = strip.lowerCurve.fn(x);
                    if (isFinite(yHigh) && isFinite(yLow)) {
                        upperPts.push(engine.mathToScreen(x, yHigh));
                        lowerPts.push(engine.mathToScreen(x, yLow));
                    }
                }

                if (upperPts.length < 2) return null;

                const cmds: string[] = [];
                cmds.push(`M ${upperPts[0][0].toFixed(2)} ${upperPts[0][1].toFixed(2)}`);
                for (let i = 1; i < upperPts.length; i++) {
                    cmds.push(`L ${upperPts[i][0].toFixed(2)} ${upperPts[i][1].toFixed(2)}`);
                }
                for (let i = lowerPts.length - 1; i >= 0; i--) {
                    cmds.push(`L ${lowerPts[i][0].toFixed(2)} ${lowerPts[i][1].toFixed(2)}`);
                }
                cmds.push('Z');

                return React.createElement('path', {
                    key: `strip-${int.id}-${idx}`,
                    d: cmds.join(' '),
                    fill: int.color,
                    stroke: int.color,
                    strokeWidth: 0.4,
                    strokeLinejoin: 'round'
                });
            }).filter(Boolean);

            groupEls.push(React.createElement('g', {
                key: `strips-fill-${int.id}`,
                opacity: int.opacity
            }, ...stripPaths));
        }

        // Render subtle seedPoint indicator if user picked a specific chamber on the canvas
        if (int.seedPoint && isFinite(int.seedPoint.x) && isFinite(int.seedPoint.y)) {
            const [spx, spy] = engine.mathToScreen(int.seedPoint.x, int.seedPoint.y);
            if (spx >= xStart && spx <= xEnd && spy >= yStart && spy <= yEnd) {
                groupEls.push(React.createElement('circle', {
                    key: `seed-${int.id}`,
                    cx: spx,
                    cy: spy,
                    r: 3,
                    fill: int.color,
                    stroke: 'white',
                    strokeWidth: 1,
                    opacity: 0.85
                }));
            }
        }

        if (groupEls.length === 0) return null;

        return React.createElement('g', {
            key: `integral-${int.id}`,
            'data-target-type': 'integral',
            'data-target-id': int.id,
            style: { cursor: 'context-menu' }
        }, ...groupEls);
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
    if (!isFinite(tMin) || !isFinite(tMax) || tMax <= tMin) return [];
    const dt = (tMax - tMin) / steps;
    const minAllowedStep = Math.max(1e-7, (tMax - tMin) / 4000);

    const yMinView = engine.cfg.yRange[0];
    const yMaxView = engine.cfg.yRange[1];
    const ySpan = Math.max(1, yMaxView - yMinView);
    const yMargin = ySpan * 2;
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
    let cuspPoints: number[] = [];

    try {
        if (f.isParametric) {
            const { plotExpression: px } = preprocessMathExpression(f.expression);
            const { plotExpression: py } = preprocessMathExpression(f.yExpression || '0');
            if (!px.trim() || !py.trim()) return [];
            compiledFnX = math.compile(px);
            compiledFnY = math.compile(py);
            try { compiledDerivX = math.derivative(px, 't').compile(); } catch {}
            try { compiledDerivY = math.derivative(py, 't').compile(); } catch {}
        } else {
            const { plotExpression: py, absExpressions } = preprocessMathExpression(f.expression);
            if (!py.trim()) return [];
            compiledFnY = math.compile(py);
            try { compiledDerivY = math.derivative(py, 'x').compile(); } catch {}
            // Detect cusps from |...| inner expressions so sharp corners aren't skipped or rounded
            absExpressions.forEach(absExpr => {
                try {
                    const absCompiled = math.compile(absExpr);
                    const absFn = (x: number) => {
                        try {
                            const val = absCompiled.evaluate({ ...globalScope, x });
                            return typeof val === 'number' && isFinite(val) ? val : NaN;
                        } catch { return NaN; }
                    };
                    const rts = findAllRoots(absFn, tMin, tMax, 200);
                    rts.forEach(r => {
                        if (r > tMin + 1e-7 && r < tMax - 1e-7 && !cuspPoints.some(cp => Math.abs(cp - r) < 1e-5)) {
                            cuspPoints.push(r);
                        }
                    });
                } catch {}
            });
            cuspPoints.sort((a, b) => a - b);
        }
    } catch { return []; }

    const evaluate = (t: number, side: 'center' | 'left' | 'right' = 'center'): { x: number, y: number, m: number, dx_dt: number, dy_dt: number } | null => {
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
                    try {
                        const dVal = compiledDerivX.evaluate({ ...globalScope, t });
                        dx_dt = typeof dVal === 'number' ? dVal : NaN;
                    } catch {}
                }
                if (!isFinite(dx_dt)) {
                    const h = 1e-7;
                    try {
                        const xP = compiledFnX.evaluate({ ...globalScope, t: t + h });
                        const xM = compiledFnX.evaluate({ ...globalScope, t: t - h });
                        if (typeof xP === 'number' && typeof xM === 'number') dx_dt = (xP - xM) / (2 * h);
                    } catch {}
                }
                
                if (compiledDerivY) {
                    try {
                        const dVal = compiledDerivY.evaluate({ ...globalScope, t });
                        dy_dt = typeof dVal === 'number' ? dVal : NaN;
                    } catch {}
                }
                if (!isFinite(dy_dt)) {
                    const h = 1e-7;
                    try {
                        const yP = compiledFnY.evaluate({ ...globalScope, t: t + h });
                        const yM = compiledFnY.evaluate({ ...globalScope, t: t - h });
                        if (typeof yP === 'number' && typeof yM === 'number') dy_dt = (yP - yM) / (2 * h);
                    } catch {}
                }
            } else {
                if (!compiledFnY) return null;
                const yVal = compiledFnY.evaluate({ ...globalScope, x: t });
                if (typeof yVal !== 'number' || !isFinite(yVal)) return null;
                y = yVal;
                
                const h = 1e-7;
                if (side === 'left') {
                    try {
                        const yM = compiledFnY.evaluate({ ...globalScope, x: t - h });
                        if (typeof yM === 'number') dy_dt = (y - yM) / h;
                    } catch {}
                } else if (side === 'right') {
                    try {
                        const yP = compiledFnY.evaluate({ ...globalScope, x: t + h });
                        if (typeof yP === 'number') dy_dt = (yP - y) / h;
                    } catch {}
                } else if (compiledDerivY) {
                    try {
                        const dVal = compiledDerivY.evaluate({ ...globalScope, x: t });
                        dy_dt = typeof dVal === 'number' ? dVal : NaN;
                    } catch {}
                }
                if (!isFinite(dy_dt)) {
                    try {
                        const yP = compiledFnY.evaluate({ ...globalScope, x: t + h });
                        const yM = compiledFnY.evaluate({ ...globalScope, x: t - h });
                        if (typeof yP === 'number' && typeof yM === 'number') dy_dt = (yP - yM) / (2 * h);
                    } catch {}
                }
            }

            if (y > yMaxLimit || y < yMinLimit || x > xMaxLimit || x < xMinLimit) return null;
            
            let m = dy_dt / dx_dt;
            if (isNaN(m) || !isFinite(m)) {
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
    let prevSampleWasOut = false;

    let t = tMin;
    let lastStep = dt;
    let iterCount = 0;
    const maxIterations = 2500;
    
    while (t <= tMax + 1e-9 && iterCount < maxIterations) {
        iterCount++;
        let pt = evaluate(t);
        
        // Only bisect entry boundary if the previous step was genuinely out of bounds (evaluate(left) === null)
        if (!lastValid && pt && prevSampleWasOut && t > tMin + 1e-9) {
            let left = Math.max(tMin, t - lastStep);
            let right = t;
            if (!evaluate(left)) {
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
                // Do not move t backwards to avoid any possibility of re-evaluating the same interval
                points.push({ t: bestT, x: pt.x, y: pt.y, m: pt.m, dx_dt: pt.dx_dt, dy_dt: pt.dy_dt });
                lastValid = { t: bestT, ...pt };
                prevSampleWasOut = false;
                if (t >= tMax - 1e-9) break;
                pt = evaluate(t);
                if (!pt) {
                    lastValid = null;
                    prevSampleWasOut = true;
                    t += dt;
                    continue;
                }
            }
        }
        
        if (pt) {
            prevSampleWasOut = false;
            points.push({ t, x: pt.x, y: pt.y, m: pt.m, dx_dt: pt.dx_dt, dy_dt: pt.dy_dt });
            lastValid = { t, ...pt };
            if (t >= tMax - 1e-9) break;
            
            const D = dt * Math.max(engine.scaleX, engine.scaleY);
            
            let idealStep = dt;
            if (isFinite(pt.dx_dt) && isFinite(pt.dy_dt) && (Math.abs(pt.dx_dt) > 1e-9 || Math.abs(pt.dy_dt) > 1e-9)) {
                const speed = Math.sqrt(Math.pow(pt.dx_dt * engine.scaleX, 2) + Math.pow(pt.dy_dt * engine.scaleY, 2));
                if (speed > 1e-9) {
                    idealStep = D / speed;
                }
            }
            
            let step = Math.max(minAllowedStep, Math.min(dt, idealStep));
            let nextT_candidate = t + step;

            // Check if a known cusp point lies strictly inside (t, nextT_candidate]
            const upcomingCusp = cuspPoints.find(cp => cp > t + 1e-8 && cp <= nextT_candidate + 1e-8);
            if (upcomingCusp !== undefined) {
                const cuspLeft = evaluate(upcomingCusp, 'left');
                const cuspRight = evaluate(upcomingCusp, 'right');
                if (cuspLeft && cuspRight) {
                    points.push({ t: upcomingCusp, x: cuspLeft.x, y: cuspLeft.y, m: cuspLeft.m, dx_dt: cuspLeft.dx_dt, dy_dt: cuspLeft.dy_dt });
                    points.push({ t: NaN, x: NaN, y: NaN, m: NaN, dx_dt: NaN, dy_dt: NaN });
                    points.push({ t: upcomingCusp, x: cuspRight.x, y: cuspRight.y, m: cuspRight.m, dx_dt: cuspRight.dx_dt, dy_dt: cuspRight.dy_dt });
                    lastValid = { t: upcomingCusp, ...cuspRight };
                    t = Math.max(t + minAllowedStep, upcomingCusp + 1e-6);
                    lastStep = step;
                    continue;
                }
            }

            let nextPt = evaluate(nextT_candidate);
            let jumpedAcrossPole = false;

            // Check if (t, nextT_candidate) straddles a vertical asymptote or jump discontinuity
            if (nextPt && !f.isParametric) {
                const midT = (t + nextT_candidate) / 2;
                const midPt = evaluate(midT);
                const dyJump = nextPt.y - pt.y;
                const crossesPole = !midPt || (
                    Math.abs(dyJump) > ySpan * 1.2 &&
                    Math.abs(pt.m) > 5 &&
                    Math.abs(nextPt.m) > 5 &&
                    Math.sign(dyJump) !== Math.sign(pt.m) &&
                    Math.sign(dyJump) !== Math.sign(nextPt.m)
                );
                if (crossesPole) {
                    jumpedAcrossPole = true;
                    nextPt = null;
                }
            }
            
            if (!nextPt) {
                // Hit a boundary or pole
                let left = t;
                let right = nextT_candidate;
                let bestBoundary = pt;
                let bestT = t;
                
                for (let j = 0; j < 20; j++) {
                    const mid = (left + right) / 2;
                    const midPt = evaluate(mid);
                    if (midPt && (f.isParametric || Math.abs(midPt.y - bestBoundary.y) < ySpan * 1.5)) {
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
                prevSampleWasOut = !jumpedAcrossPole;
                
                lastStep = step;
                t = Math.max(t + minAllowedStep, nextT_candidate);
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
                    if (bestT > t + minAllowedStep) {
                        step = bestT - t;
                    }
                }
            }
            
            if (t + step > tMax && t < tMax - 1e-9) {
                step = Math.max(minAllowedStep, tMax - t);
            }
            lastStep = step;
            t += step;
        } else {
            prevSampleWasOut = true;
            lastValid = null;
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
                const ratio0 = Math.abs(p0.m) > 1e-9 ? Math.abs(dy_math / p0.m) : dx_math;
                dx0 = (1/3) * Math.min(dx_math, ratio0);
                if (isNaN(dx0) || !isFinite(dx0)) dx0 = (1/3) * dx_math;
                dy0 = p0.m * dx0;
                if (isNaN(dy0) || !isFinite(dy0)) dy0 = (1/3) * dy_math;
                
                const ratio1 = Math.abs(p1.m) > 1e-9 ? Math.abs(dy_math / p1.m) : dx_math;
                dx1 = (1/3) * Math.min(dx_math, ratio1);
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

    return React.createElement('g', {
        key: f.id,
        'data-target-type': 'function',
        'data-target-id': f.id,
        style: { cursor: 'context-menu' }
    }, 
        paths.map((p, i) => React.createElement('path', {
            key: `${f.id}-hit-${i}`,
            d: p.pathString,
            fill: "none",
            stroke: "transparent",
            strokeWidth: Math.max(10, f.strokeWidth + 6)
        })),
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
    const ySpan = Math.max(1, engine.cfg.yRange[1] - engine.cfg.yRange[0]);
    const yMinLimit = engine.cfg.yRange[0] - ySpan * 2;
    const yMaxLimit = engine.cfg.yRange[1] + ySpan * 2;

    return functions.filter(f => f.visible && f.expression && f.type !== 'parameter').map(f => {
      if (f.plotterType === 'experimental' || f.isParametric) {
          return renderExperimentalPlot(engine, f, globalScope);
      }

      const segments: string[][] = [];
      let currentPoints: string[] = [];
      const steps = 500;
      
      const dMin = parseDomainBound(f.domain[0], -Infinity, globalScope);
      const dMax = parseDomainBound(f.domain[1], Infinity, globalScope);

      const xMin = Math.max(dMin, engine.cfg.xRange[0]);
      const xMax = Math.min(dMax, engine.cfg.xRange[1]);
      if (!isFinite(xMin) || !isFinite(xMax) || xMax <= xMin) return null;
      const dx = (xMax - xMin) / steps;
      
      const { plotExpression, absExpressions } = preprocessMathExpression(f.expression);
      let compiled;
      try { compiled = math.compile(plotExpression); } catch { return null; }

      const xVals: number[] = [];
      for (let i = 0; i <= steps; i++) {
        xVals.push(xMin + i * dx);
      }

      absExpressions.forEach(absExpr => {
          try {
              const absCompiled = math.compile(absExpr);
              const absFn = (x: number) => {
                  try {
                      const val = absCompiled.evaluate({ ...globalScope, x });
                      return typeof val === 'number' && isFinite(val) ? val : NaN;
                  } catch { return NaN; }
              };
              const roots = findAllRoots(absFn, xMin, xMax, 200);
              roots.forEach(r => {
                  if (r >= xMin && r <= xMax) {
                      xVals.push(r);
                  }
              });
          } catch {}
      });

      xVals.sort((a, b) => a - b);

      let prevY: number | null = null;
      for (let i = 0; i < xVals.length; i++) {
        const x = xVals[i];
        if (i > 0 && Math.abs(x - xVals[i-1]) < 1e-9) continue;
        try {
          const y = compiled.evaluate({ ...globalScope, x });
          if (typeof y === 'number' && isFinite(y) && y >= yMinLimit && y <= yMaxLimit) {
            if (prevY !== null && Math.abs(y - prevY) > ySpan * 1.2) {
                if (currentPoints.length >= 2) segments.push(currentPoints);
                currentPoints = [];
            }
            const [px, py] = engine.mathToScreen(x, y);
            currentPoints.push(`${px},${py}`);
            prevY = y;
          } else {
            if (currentPoints.length >= 2) segments.push(currentPoints);
            currentPoints = [];
            prevY = null;
          }
        } catch {
          if (currentPoints.length >= 2) segments.push(currentPoints);
          currentPoints = [];
          prevY = null;
        }
      }
      if (currentPoints.length >= 2) segments.push(currentPoints);

      if (segments.length === 0) return null;
      return React.createElement('g', {
        key: f.id,
        'data-target-type': 'function',
        'data-target-id': f.id,
        style: { cursor: 'context-menu' }
      },
        segments.map((pts, idx) => React.createElement('polyline', {
          key: `${f.id}-hit-${idx}`, points: pts.join(' '), fill: "none", stroke: "transparent", strokeWidth: Math.max(10, f.strokeWidth + 6)
        })),
        segments.map((pts, idx) => React.createElement('polyline', {
          key: `${f.id}-seg-${idx}`, points: pts.join(' '), fill: "none", stroke: f.color, strokeWidth: f.strokeWidth,
          strokeDasharray: f.lineType === 'dashed' ? '5,5' : f.lineType === 'dotted' ? '2,2' : undefined
        }))
      );
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
        let pointY = NaN, slope = NaN;
        try {
            const { plotExpression } = preprocessMathExpression(func.expression);
            if (!plotExpression.trim()) return null;
            const compiledFn = math.compile(plotExpression);
            const yRaw = compiledFn.evaluate({ ...globalScope, x: t.x });
            pointY = typeof yRaw === 'number' ? yRaw : NaN;
            try {
                const d1C = math.derivative(plotExpression, 'x').compile();
                const sRaw = d1C.evaluate({ ...globalScope, x: t.x });
                slope = typeof sRaw === 'number' ? sRaw : NaN;
            } catch {}
            if (!isFinite(slope)) {
                const h = 1e-6;
                const yP = compiledFn.evaluate({ ...globalScope, x: t.x + h });
                const yM = compiledFn.evaluate({ ...globalScope, x: t.x - h });
                if (typeof yP === 'number' && typeof yM === 'number') {
                    slope = (yP - yM) / (2 * h);
                }
            }
        } catch { return null; }

        if (!isFinite(pointY) || !isFinite(slope)) return null;

        const [px, py] = engine.mathToScreen(t.x, pointY);
        const els: React.ReactNode[] = [];

        // Calculate infinite line points based on view box for HIT AREA (and vertical normal rendering)
        const xMin = engine.cfg.xRange[0];
        const xMax = engine.cfg.xRange[1];
        
        let p1: [number, number], p2: [number, number];
        let lineSlope = slope;
        if (t.mode === 'normal') {
            if (Math.abs(slope) < 1e-7) lineSlope = Infinity; // Vertical normal
            else lineSlope = -1 / slope;
        }

        if (!isFinite(lineSlope)) {
            const [vx] = engine.mathToScreen(t.x, 0);
            p1 = [vx, engine.getGridBoundaries().yStart];
            p2 = [vx, engine.getGridBoundaries().yEnd];
            // Render visible vertical normal line since it cannot be represented as y = f(x)
            els.push(React.createElement('line', {
                key: `tan-vert-line-${t.id}`,
                x1: p1[0], y1: p1[1], x2: p2[0], y2: p2[1],
                stroke: t.color,
                strokeWidth: t.strokeWidth,
                strokeDasharray: t.lineType === 'dashed' ? '5,5' : t.lineType === 'dotted' ? '2,2' : undefined
            }));
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

        return React.createElement('g', {
            key: t.id,
            'data-target-type': 'tangent',
            'data-target-id': t.id
        }, ...els);
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
          els.push(React.createElement('line', {
              key: `${ft.id}-vasy-hit`,
              x1: px, y1: yStart, x2: px, y2: yEnd,
              stroke: 'transparent', strokeWidth: 10
          }));
          // Vertical Dashed Line
          els.push(React.createElement('line', {
              key: `${ft.id}-vasy`, 
              x1: px, y1: yStart, x2: px, y2: yEnd,
              stroke: ft.color, 
              strokeWidth: engine.cfg.asymptoteThickness, // Use global config
              strokeDasharray: engine.cfg.asymptoteDashArray // Use global config
          }));
      } else if (ft.type === 'horizontal-asymptote') {
          els.push(React.createElement('line', {
              key: `${ft.id}-hasy-hit`,
              x1: xStart, y1: py, x2: xEnd, y2: py,
              stroke: 'transparent', strokeWidth: 10
          }));
          // Horizontal Dashed Line
          els.push(React.createElement('line', {
              key: `${ft.id}-hasy`, 
              x1: xStart, y1: py, x2: xEnd, y2: py,
              stroke: ft.color, 
              strokeWidth: engine.cfg.asymptoteThickness, // Use global config
              strokeDasharray: engine.cfg.asymptoteDashArray // Use global config
          }));
      } else {
          els.push(React.createElement('circle', {
            key: `${ft.id}-hit`, cx: px, cy: py, r: Math.max(10, (ft.size || 4) + 5),
            fill: 'transparent', stroke: 'none'
          }));
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
      return React.createElement('g', {
          key: ft.id,
          'data-target-type': 'feature',
          'data-target-id': ft.id,
          style: { cursor: 'context-menu' }
      }, ...els);
    });
};