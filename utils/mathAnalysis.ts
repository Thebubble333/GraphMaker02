
import * as math from 'mathjs';
import { FunctionDef, FeaturePoint, FeatureType, InequalityDef } from '../types';
import { formatCoordinate, formatDecimal, formatExact } from './mathFormatting';

export const getDefaultOffset = (type: FeatureType): { x: number, y: number } => {
    switch (type) {
        case 'root': return { x: 10, y: 15 };
        case 'y-intercept': return { x: 10, y: -10 };
        case 'endpoint': return { x: 10, y: -10 };
        case 'extremum': return { x: 0, y: -20 }; 
        case 'inflection': return { x: 15, y: -15 };
        case 'intersection': return { x: 10, y: -15 };
        case 'vertical-asymptote': return { x: 5, y: 15 };
        case 'horizontal-asymptote': return { x: 5, y: -5 };
        default: return { x: 10, y: 10 };
    }
};

export const findSnapPoint = (
    currentX: number, 
    features: FeaturePoint[], 
    gridStep: number, 
    threshold: number
): number => {
    // 1. Check Function Features (Roots, Extrema, etc)
    let bestSnap = currentX;
    let minDist = threshold;

    for (const f of features) {
        const dist = Math.abs(currentX - f.x);
        if (dist < minDist) {
            minDist = dist;
            bestSnap = f.x;
        }
    }

    if (minDist < threshold) return bestSnap;

    // 2. Check Grid Lines (Major Steps)
    // Snap to nearest multiple of gridStep
    const gridSnap = Math.round(currentX / gridStep) * gridStep;
    if (Math.abs(currentX - gridSnap) < threshold) {
        return gridSnap;
    }

    return currentX;
};

export const calculateTangentEquation = (
    expression: string, 
    x: number, 
    mode: 'tangent' | 'normal'
): string | null => {
    try {
        const compiled = math.compile(expression);
        const y1 = compiled.evaluate({ x });
        const deriv = math.derivative(expression, 'x');
        const m = deriv.evaluate({ x });

        if (!isFinite(y1) || !isFinite(m)) return null;

        let slope = m;
        if (mode === 'normal') {
            if (Math.abs(m) < 1e-9) return null; // Vertical normal (x = c), handled by UI logic typically but here we return null as it's not a function y=...
            slope = -1 / m;
        }

        // y - y1 = m(x - x1)  ->  y = m*x - m*x1 + y1
        const c = y1 - slope * x;
        
        // Format nicely
        // If c is negative, we want " - 5", if positive " + 5"
        const mStr = Math.abs(slope) < 1e-9 ? '0' : formatDecimal(slope);
        const cStr = Math.abs(c) < 1e-9 ? '0' : formatDecimal(Math.abs(c));
        const sign = c < 0 ? '-' : '+';

        if (mStr === '0') return formatDecimal(y1); // Horizontal line
        if (cStr === '0') return `${mStr}x`;
        return `${mStr}x ${sign} ${cStr}`;
    } catch {
        return null;
    }
};

export const findRoot = (fn: (n: number) => number, x1: number, x2: number): number | null => {
    try {
        let a = x1, b = x2;
        const fa = fn(a);
        const fb = fn(b);
        // Standard root finding requires sign change.
        // However, for 1/f(x) where f(x) -> infinity, 1/f(x) crosses 0 if f(x) changes sign (e.g. tan(x))
        // If f(x) -> +infinity on both sides (e.g. 1/x^2), 1/f(x) -> 0 from positive side but touches 0.
        // It might not change sign.
        // Robust method: Check if min(|fn(x)|) in interval is ~0.
        
        if (!isFinite(fa) || !isFinite(fb)) return null;
        
        // Sign check approach first
        if (Math.sign(fa) !== Math.sign(fb)) {
            for (let i = 0; i < 60; i++) {
                const mid = (a + b) / 2;
                const fmid = fn(mid);
                if (!isFinite(fmid)) return null;
                if (Math.abs(fmid) < 1e-14) return mid;
                if (Math.sign(fmid) === Math.sign(fa)) a = mid;
                else b = mid;
            }
            return (a + b) / 2;
        }
        
        return null;
    } catch { return null; }
};

// Helper to scan for all roots in a range
export const findAllRoots = (fn: (x:number)=>number, xMin: number, xMax: number, steps: number = 200): number[] => {
    const roots: number[] = [];
    const dx = (xMax - xMin) / steps;
    for(let i = 0; i < steps; i++) {
        const r = findRoot(fn, xMin + i * dx, xMin + (i+1) * dx);
        if(r !== null) {
            // Avoid duplicates
            if (roots.length === 0 || Math.abs(r - roots[roots.length - 1]) > 1e-6) {
                roots.push(r);
            }
        }
    }
    return roots;
};

export const analyzeFunction = (f: FunctionDef, xRange: [number, number], yRange: [number, number], useExactValues: boolean = false): FeaturePoint[] => {
    if (!f.expression) return [];
    
    const features: FeaturePoint[] = [];
    
    // Compile Main Function
    let compiled: math.EvalFunction;
    try { compiled = math.compile(f.expression); } catch { return []; }
    const fn = (x: number) => { try { const val = compiled.evaluate({ x }); return typeof val === 'number' ? val : NaN; } catch { return NaN; } };

    // Compile Derivatives
    let fnPrime: ((x: number) => number) | null = null;
    let fnDoublePrime: ((x: number) => number) | null = null;
    try {
        const d1 = math.derivative(f.expression, 'x');
        const d1C = d1.compile();
        fnPrime = (x: number) => { try { return d1C.evaluate({x}); } catch { return NaN; } };

        const d2 = math.derivative(d1, 'x');
        const d2C = d2.compile();
        fnDoublePrime = (x: number) => { try { return d2C.evaluate({x}); } catch { return NaN; } };
    } catch { }

    const xMin = f.domain[0] !== null ? Math.max(f.domain[0], xRange[0]) : xRange[0];
    const xMax = f.domain[1] !== null ? Math.min(f.domain[1], xRange[1]) : xRange[1];

    // 1. Y-Intercept
    if (xMin <= 0 && xMax >= 0) {
        const y0 = fn(0);
        if (isFinite(y0)) {
            features.push({
                id: `${f.id}-y-int`, functionId: f.id, type: 'y-intercept', x: 0, y: y0,
                label: formatCoordinate(0, y0, useExactValues), 
                visible: true, showLabel: false, customLabelOffset: getDefaultOffset('y-intercept'),
                color: f.color, style: 'filled', size: 4
            });
        }
    }

    // 2. Roots (x-intercepts)
    const roots = findAllRoots(fn, xMin, xMax);
    roots.forEach(r => {
        features.push({
            id: `${f.id}-root-${r.toFixed(4)}`, functionId: f.id, type: 'root', x: r, y: 0,
            label: formatCoordinate(r, 0, useExactValues), 
            visible: true, showLabel: false, customLabelOffset: getDefaultOffset('root'),
            color: f.color, style: 'filled', size: 4
        });
    });

    // 3. Extrema (Turning Points) f'(x) = 0
    if (fnPrime) {
        const stationaryPoints = findAllRoots(fnPrime, xMin, xMax);
        stationaryPoints.forEach(x => {
            const y = fn(x);
            if (isFinite(y)) {
                if (Math.abs(x - xMin) > 1e-5 && Math.abs(x - xMax) > 1e-5) {
                    features.push({
                        id: `${f.id}-ext-${x.toFixed(4)}`, functionId: f.id, type: 'extremum', x: x, y: y,
                        label: formatCoordinate(x, y, useExactValues),
                        visible: true, showLabel: false, customLabelOffset: getDefaultOffset('extremum'),
                        color: f.color, style: 'filled', size: 4
                    });
                }
            }
        });
    }

    // 4. Inflection Points f''(x) = 0
    if (fnDoublePrime) {
        const inflections = findAllRoots(fnDoublePrime, xMin, xMax);
        inflections.forEach(x => {
            const y = fn(x);
            if (isFinite(y)) {
                if (Math.abs(x - xMin) > 1e-5 && Math.abs(x - xMax) > 1e-5) {
                    features.push({
                        id: `${f.id}-inf-${x.toFixed(4)}`, functionId: f.id, type: 'inflection', x: x, y: y,
                        label: formatCoordinate(x, y, useExactValues),
                        visible: true, showLabel: false, customLabelOffset: getDefaultOffset('inflection'),
                        color: f.color, style: 'filled', size: 4 
                    });
                }
            }
        });
    }

    // 5. Vertical Asymptotes
    // Strategy: Find roots of 1/f(x)
    const invFn = (x: number) => {
        try {
            const y = fn(x);
            if (!isFinite(y)) return 0; // Already infinite -> 1/inf = 0
            if (Math.abs(y) < 1e-12) return 1e12; // Avoid 1/0 error in JS? No, JS handles Infinity.
            return 1 / y;
        } catch { return NaN; }
    };
    
    // We scan slightly wider than view to catch asymptotes on edge
    const poles = findAllRoots(invFn, xMin, xMax, 300);
    poles.forEach(p => {
        // Double check magnitude
        const near = fn(p + 1e-6);
        if (Math.abs(near) > 100) { // Arbitrary large threshold
             features.push({
                id: `${f.id}-vasy-${p.toFixed(4)}`, functionId: f.id, type: 'vertical-asymptote', x: p, y: 0,
                // Italicized variable for math convention
                label: `\\textit{x} = ${useExactValues ? formatExact(p) : formatDecimal(p)}`, 
                visible: true, showLabel: true, customLabelOffset: getDefaultOffset('vertical-asymptote'),
                color: f.color, style: 'hollow', size: 0 // Size irrelevant for line
            });
        }
    });

    // 6. Horizontal Asymptotes
    // Strategy: Check limits at large X values
    const limitCheckX = 1e5;
    const checkLimit = (xVal: number) => {
        try {
            const yVal = fn(xVal);
            const slope = fnPrime ? fnPrime(xVal) : (fn(xVal+1) - fn(xVal));
            if (isFinite(yVal) && Math.abs(slope) < 1e-6) {
                // It's flattening out.
                // Check if we already have this asymptote (e.g. from the other side)
                const exists = features.some(f => f.type === 'horizontal-asymptote' && Math.abs(f.y - yVal) < 1e-3);
                if (!exists) {
                    // Only add if it's within sensible view range (e.g. not y=1000 when view is -10 to 10)
                    if (yVal >= yRange[0] - (yRange[1]-yRange[0]) && yVal <= yRange[1] + (yRange[1]-yRange[0])) {
                        features.push({
                            id: `${f.id}-hasy-${yVal.toFixed(4)}`, functionId: f.id, type: 'horizontal-asymptote', x: 0, y: yVal,
                            // Italicized variable for math convention
                            label: `\\textit{y} = ${formatDecimal(yVal)}`,
                            visible: true, showLabel: true, customLabelOffset: getDefaultOffset('horizontal-asymptote'),
                            color: f.color, style: 'hollow', size: 0
                        });
                    }
                }
            }
        } catch {}
    };
    
    checkLimit(limitCheckX);
    checkLimit(-limitCheckX);

    // 7. Endpoints
    [f.domain[0], f.domain[1]].forEach((ex, idx) => {
        if (ex !== null && ex >= xRange[0] && ex <= xRange[1]) {
            const ey = fn(ex);
            if (isFinite(ey)) {
                features.push({
                    id: `${f.id}-end-${idx}`, functionId: f.id, type: 'endpoint', x: ex, y: ey,
                    label: formatCoordinate(ex, ey, useExactValues), 
                    visible: true, showLabel: false, customLabelOffset: getDefaultOffset('endpoint'),
                    color: f.color, style: f.domainInclusive[idx] ? 'filled' : 'hollow', size: 4
                });
            }
        }
    });

    return features;
};

export const analyzeGraphIntersection = (f1: FunctionDef, f2: FunctionDef, xRange: [number, number], useExactValues: boolean = false): FeaturePoint[] => {
    if (!f1.expression || !f2.expression) return [];
    
    let compiled1: math.EvalFunction, compiled2: math.EvalFunction;
    try {
        compiled1 = math.compile(f1.expression);
        compiled2 = math.compile(f2.expression);
    } catch { return []; }

    const fn1 = (x: number) => { try { return compiled1.evaluate({ x }); } catch { return NaN; } };
    const fn2 = (x: number) => { try { return compiled2.evaluate({ x }); } catch { return NaN; } };
    
    const diffFn = (x: number) => fn1(x) - fn2(x);

    // Constrain to intersection of domains and view window
    const xMin = Math.max(xRange[0], f1.domain[0] ?? -Infinity, f2.domain[0] ?? -Infinity);
    const xMax = Math.min(xRange[1], f1.domain[1] ?? Infinity, f2.domain[1] ?? Infinity);

    if (xMax <= xMin) return [];

    const roots = findAllRoots(diffFn, xMin, xMax);
    
    return roots.map(r => {
        const y = fn1(r);
        return {
            id: `intersect-${f1.id}-${f2.id}-${r.toFixed(4)}`,
            functionId: `intersect-${f1.id}-${f2.id}`, // Special ID
            type: 'intersection',
            x: r,
            y: y,
            label: formatCoordinate(r, y, useExactValues),
            visible: true,
            showLabel: false,
            customLabelOffset: getDefaultOffset('intersection'),
            color: '#000000', // Pure black
            style: 'filled',
            size: 4 // Standard size
        };
    });
};

// ... (Rest of file: getLinearCoeffs, parseAdvancedInequality, etc. remain unchanged) ...
export const getLinearCoeffs = (expr: string): {a: number, b: number, c: number} | null => {
    try {
        const node = math.parse(expr);
        const c = node.evaluate({x: 0, y: 0});
        const ax = node.evaluate({x: 1, y: 0}) - c;
        const by = node.evaluate({x: 0, y: 1}) - c;
        const test = node.evaluate({x: 1, y: 1});
        if (Math.abs(test - (ax + by + c)) > 1e-9) return null;
        return {a: ax, b: by, c: c};
    } catch { return null; }
};

export const parseAdvancedInequality = (text: string): { type: 'y' | 'x', expression: string, operator: string }[] => {
    const ops = ['<=', '>=', '<', '>'];
    let parts: string[] = [];
    let foundOps: string[] = [];
    
    let current = text;
    while (true) {
        let firstIdx = Infinity;
        let firstOp = '';
        for (const op of ops) {
            const idx = current.indexOf(op);
            if (idx !== -1 && idx < firstIdx) {
                firstIdx = idx;
                firstOp = op;
            }
        }
        if (firstIdx === Infinity) {
            parts.push(current.trim());
            break;
        }
        parts.push(current.substring(0, firstIdx).trim());
        foundOps.push(firstOp);
        current = current.substring(firstIdx + firstOp.length);
    }

    if (parts.length < 2) return [];

    const results: { type: 'y' | 'x', expression: string, operator: string }[] = [];

    const handlePair = (left: string, op: string, right: string, reverse: boolean) => {
        const coeffs = getLinearCoeffs(left);
        const k = parseFloat(right);
        if (coeffs && !isNaN(k)) {
            let {a, b, c} = coeffs;
            let currentOp = op;
            if (reverse) {
                if (currentOp === '<') currentOp = '>';
                else if (currentOp === '>') currentOp = '<';
                else if (currentOp === '<=') currentOp = '>=';
                else if (currentOp === '>=') currentOp = '<=';
            }
            
            if (Math.abs(b) > 1e-9) {
                const finalOp = b > 0 ? currentOp : (currentOp === '<' ? '>' : currentOp === '>' ? '<' : currentOp === '<=' ? '>=' : '<=');
                results.push({ type: 'y', expression: `(${k} - ${c} - (${a}) * x) / (${b})`, operator: finalOp });
            } else if (Math.abs(a) > 1e-9) {
                const finalOp = a > 0 ? currentOp : (currentOp === '<' ? '>' : currentOp === '>' ? '<' : currentOp === '<=' ? '>=' : '<=');
                results.push({ type: 'x', expression: `(${k} - ${c}) / (${a})`, operator: finalOp });
            }
        }
    };

    if (parts.length === 2) {
        if (!isNaN(parseFloat(parts[1]))) handlePair(parts[0], foundOps[0], parts[1], false);
        else if (!isNaN(parseFloat(parts[0]))) handlePair(parts[1], foundOps[0], parts[0], true);
    } else if (parts.length === 3) {
        const m = parseFloat(parts[0]);
        const n = parseFloat(parts[2]);
        if (!isNaN(m)) handlePair(parts[1], foundOps[0], parts[0], true);
        if (!isNaN(n)) handlePair(parts[1], foundOps[1], parts[2], false);
    }

    return results;
};

// --- Number Line Interval Parsing ---
export interface ParsedInterval {
    start: number | null; // null means -Infinity
    end: number | null;   // null means Infinity
    startInclusive: boolean;
    endInclusive: boolean;
}

const parseSingleInterval = (text: string): ParsedInterval | null => {
    const clean = text.trim();
    if (!clean) return null;

    // 1. Bracket notation: [2, 5), (-inf, 3], etc. 
    // Relaxed comma check to allow spaces like [-2, 3]
    const bracketRegex = /^([(\[])([-+]?\d*\.?\d+|(-?inf))\s*,\s*([-+]?\d*\.?\d+|(inf))([)\]])$/i;
    const bracketMatch = clean.match(bracketRegex);
    if (bracketMatch) {
        const startRaw = bracketMatch[2].toLowerCase();
        const endRaw = bracketMatch[4].toLowerCase();
        const start = startRaw.includes('inf') ? null : parseFloat(startRaw);
        const end = endRaw.includes('inf') ? null : parseFloat(endRaw);
        return {
            start,
            end,
            startInclusive: bracketMatch[1] === '[',
            endInclusive: bracketMatch[6] === ']'
        };
    }

    // 2. Simple inequalities: x > 5, x <= -2
    const simpleRegex = /^x\s*([<>]=?)\s*([-+]?\d*\.?\d+)$/i;
    const simpleMatch = clean.match(simpleRegex);
    if (simpleMatch) {
        const op = simpleMatch[1];
        const val = parseFloat(simpleMatch[2]);
        if (op === '>') return { start: val, end: null, startInclusive: false, endInclusive: false };
        if (op === '>=') return { start: val, end: null, startInclusive: true, endInclusive: false };
        if (op === '<') return { start: null, end: val, startInclusive: false, endInclusive: false };
        if (op === '<=') return { start: null, end: val, startInclusive: false, endInclusive: true };
    }

    // 3. Double inequalities: -2 < x <= 5
    const doubleRegex = /^([-+]?\d*\.?\d+)\s*([<>]=?)\s*x\s*([<>]=?)\s*([-+]?\d*\.?\d+)$/i;
    const doubleMatch = clean.match(doubleRegex);
    if (doubleMatch) {
        const v1 = parseFloat(doubleMatch[1]);
        const op1 = doubleMatch[2];
        const op2 = doubleMatch[3];
        const v2 = parseFloat(doubleMatch[4]);
        const startInclusive = op1.includes('=');
        const endInclusive = op2.includes('=');
        if (op1.startsWith('<') && op2.startsWith('<')) {
            return { start: v1, end: v2, startInclusive, endInclusive };
        }
        if (op1.startsWith('>') && op2.startsWith('>')) {
            return { start: v2, end: v1, startInclusive: endInclusive, endInclusive: startInclusive };
        }
    }

    return null;
};

const intersectIntervals = (a: ParsedInterval, b: ParsedInterval): ParsedInterval | null => {
    const startA = a.start ?? -Infinity;
    const startB = b.start ?? -Infinity;
    const endA = a.end ?? Infinity;
    const endB = b.end ?? Infinity;

    const start = Math.max(startA, startB);
    const end = Math.min(endA, endB);

    if (start > end) return null;
    if (start === end) {
        // Only valid if both inclusive
        const startInc = (start === startA ? a.startInclusive : true) && (start === startB ? b.startInclusive : true);
        const endInc = (end === endA ? a.endInclusive : true) && (end === endB ? b.endInclusive : true);
        if (startInc && endInc) return { start, end, startInclusive: true, endInclusive: true };
        return null;
    }

    let startInclusive = true;
    if (start === startA && !a.startInclusive) startInclusive = false;
    if (start === startB && !b.startInclusive) startInclusive = false;
    if (start === -Infinity) startInclusive = false;

    let endInclusive = true;
    if (end === endA && !a.endInclusive) endInclusive = false;
    if (end === endB && !b.endInclusive) endInclusive = false;
    if (end === Infinity) endInclusive = false;

    return { 
        start: start === -Infinity ? null : start, 
        end: end === Infinity ? null : end, 
        startInclusive, 
        endInclusive 
    };
};

export const parseIntervalExpression = (text: string): ParsedInterval[] => {
    // 1. Handle Union (U, ∪, |, OR)
    const unionParts = text.split(/\s*(?:U|∪|\||OR)\s*/i);
    const results: ParsedInterval[] = [];

    for (const part of unionParts) {
        // 2. Handle Intersection (^, ∩, &, AND)
        const intersectionParts = part.split(/\s*(?:\^|∩|&|AND)\s*/i);
        let current: ParsedInterval | null = null;
        let valid = true;

        for (const sub of intersectionParts) {
            const parsed = parseSingleInterval(sub);
            if (!parsed) { valid = false; break; }
            if (current === null) {
                current = parsed;
            } else {
                current = intersectIntervals(current, parsed);
                if (!current) { valid = false; break; }
            }
        }
        if (valid && current) results.push(current);
    }
    return results;
};

interface FlattenedIntersectionItem {
    ineq: {
        id: string;
        type: 'x' | 'y';
        expression: string;
        operator: '<' | '<=' | '>' | '>=';
        color: string;
        visible: boolean;
    };
    node: math.EvalFunction;
}

export const analyzeInequalityIntersections = (ineqs: InequalityDef[], xRange: [number, number], useExactValues: boolean = false): FeaturePoint[] => {
    const visibleIneqs = ineqs.filter(i => i.visible && i.expression);
    if (visibleIneqs.length < 1) return [];
    const features: FeaturePoint[] = [];
    const fmt = (x:number, y:number) => formatCoordinate(x, y, useExactValues);
    const eps = 1e-5;

    const flattened = visibleIneqs.flatMap(iq => {
        if (iq.type === 'linear') {
            return parseAdvancedInequality(iq.expression).map((res, idx) => ({ 
                ineq: { 
                    ...iq, 
                    type: res.type as 'x' | 'y', 
                    expression: res.expression, 
                    operator: res.operator as '<' | '<=' | '>' | '>=', 
                    id: `${iq.id}_sub_${idx}` 
                },
                node: math.compile(res.expression)
            }));
        } else {
            try { 
                return [{ 
                    ineq: iq as (InequalityDef & { type: 'x' | 'y' }), 
                    node: math.compile(iq.expression) 
                }]; 
            } catch { return []; }
        }
    }) as FlattenedIntersectionItem[];

    const satisfies = (x: number, y: number): boolean => {
        for (const item of flattened) {
            try {
                const boundVal = item.node.evaluate({ x });
                if (!isFinite(boundVal)) continue;
                if (item.ineq.type === 'x') {
                    if (item.ineq.operator === '<' || item.ineq.operator === '<=') { if (x > boundVal + eps) return false; }
                    else if (item.ineq.operator === '>' || item.ineq.operator === '>=') { if (x < boundVal - eps) return false; }
                } else {
                    if (item.ineq.operator === '<' || item.ineq.operator === '<=') { if (y > boundVal + eps) return false; }
                    else if (item.ineq.operator === '>' || item.ineq.operator === '>=') { if (y < boundVal - eps) return false; }
                }
            } catch { continue; }
        }
        return true;
    };

    for (let i = 0; i < flattened.length; i++) {
        for (let j = i + 1; j < flattened.length; j++) {
            const it1 = flattened[i], it2 = flattened[j];
            if (it1.ineq.type === 'y' && it2.ineq.type === 'y') {
                const diffFn = (x: number) => it1.node.evaluate({ x }) - it2.node.evaluate({ x });
                const roots = findAllRoots(diffFn, xRange[0], xRange[1]);
                roots.forEach(rx => {
                    const ry = it1.node.evaluate({ x: rx });
                    if (isFinite(ry) && satisfies(rx, ry)) addVertex(features, rx, ry, it1.ineq.operator, it2.ineq.operator, fmt);
                });
            } else if (it1.ineq.type !== it2.ineq.type) {
                const xIt = it1.ineq.type === 'x' ? it1 : it2;
                const yIt = it1.ineq.type === 'y' ? it1 : it2;
                try {
                    const rx = xIt.node.evaluate({});
                    if (rx >= xRange[0] && rx <= xRange[1]) {
                        const ry = yIt.node.evaluate({ x: rx });
                        if (isFinite(ry) && satisfies(rx, ry)) addVertex(features, rx, ry, it1.ineq.operator, it2.ineq.operator, fmt);
                    }
                } catch {}
            }
        }
    }
    return features;
};

const addVertex = (list: FeaturePoint[], x: number, y: number, op1: string, op2: string, fmt: (x:number, y:number) => string) => {
    if (list.some(f => Math.abs(f.x - x) < 1e-4 && Math.abs(f.y - y) < 1e-4)) return;
    const isStrict = [op1, op2].some(op => op === '<' || op === '>');
    list.push({
        id: `vertex-${x.toFixed(4)}-${y.toFixed(4)}`, functionId: 'intersection', type: 'root', x, y,
        label: fmt(x, y), visible: true, showLabel: false, customLabelOffset: { x: 10, y: -10 }, color: '#000000',
        style: isStrict ? 'hollow' : 'filled', size: 4
    });
};

export interface RegressionResult {
    slope: number;
    intercept: number;
    r2: number;
    correlation: number;
    predict: (x: number) => number;
}

export const calculateLinearRegression = (points: {x: number, y: number}[]): RegressionResult | null => {
    const n = points.length;
    if (n < 2) return null;

    let sumX = 0, sumY = 0, sumXY = 0, sumX2 = 0, sumY2 = 0;
    for (const p of points) {
        sumX += p.x;
        sumY += p.y;
        sumXY += p.x * p.y;
        sumX2 += p.x * p.x;
        sumY2 += p.y * p.y;
    }

    const denominator = n * sumX2 - sumX * sumX;
    if (Math.abs(denominator) < 1e-10) return null; // Vertical line

    const slope = (n * sumXY - sumX * sumY) / denominator;
    const intercept = (sumY - slope * sumX) / n;

    const ssTot = sumY2 - (sumY * sumY) / n;
    const ssRes = points.reduce((acc, p) => {
        const pred = slope * p.x + intercept;
        return acc + (p.y - pred) ** 2;
    }, 0);

    const r2 = 1 - (ssRes / ssTot);
    const correlation = Math.sign(slope) * Math.sqrt(Math.max(0, r2));

    return {
        slope,
        intercept,
        r2,
        correlation,
        predict: (x) => slope * x + intercept
    };
};
