import * as math from 'mathjs';
import { FunctionDef, FeaturePoint, FeatureType, InequalityDef } from '../types';
import { formatCoordinate, formatDecimal, formatExact } from './mathFormatting';

export const preprocessMathExpression = (expr: string): { parsed: string, plotExpression: string, absExpressions: string[] } => {
    if (!expr) return { parsed: '', plotExpression: '', absExpressions: [] };
    
    // Normalize common mathematical unicode characters and function aliases
    const normalized = expr
        .replace(/\u2212/g, '-')
        .replace(/\u00d7/g, '*')
        .replace(/\u00f7/g, '/')
        .replace(/π/g, 'pi')
        .replace(/√\s*\(/g, 'sqrt(')
        .replace(/\barcsin\s*\(/gi, 'asin(')
        .replace(/\barccos\s*\(/gi, 'acos(')
        .replace(/\barctan\s*\(/gi, 'atan(')
        .replace(/\bcosec\s*\(/gi, 'csc(')
        .replace(/\bln\s*\(/gi, 'log(');

    let res = "";
    const absExpressions: string[] = [];
    const stack: number[] = [];
    
    let i = 0;
    while (i < normalized.length) {
        const char = normalized[i];
        if (char === '|') {
            let isOpening = false;
            
            if (stack.length === 0) {
                isOpening = true;
            } else {
                let prevChar = '';
                for (let j = i - 1; j >= 0; j--) {
                    if (normalized[j] !== ' ') {
                        prevChar = normalized[j];
                        break;
                    }
                }
                
                if (prevChar === '' || '+-*/^=<>,([{'.includes(prevChar)) {
                    isOpening = true;
                } else if ('0123456789xyz)'.includes(prevChar.toLowerCase())) {
                    isOpening = false;
                } else if (prevChar === '|') {
                    let nextChar = '';
                    for (let j = i + 1; j < normalized.length; j++) {
                        if (normalized[j] !== ' ') {
                            nextChar = normalized[j];
                            break;
                        }
                    }
                    if (nextChar === '' || '+-*/^=<>,)]}'.includes(nextChar)) {
                        isOpening = false;
                    } else {
                        isOpening = true;
                    }
                } else {
                    isOpening = false;
                }
            }
            
            if (isOpening) {
                stack.push(res.length);
                res += "abs(";
            } else {
                const openIdx = stack.pop()!;
                res += ")";
                const innerExpr = res.substring(openIdx + 4, res.length - 1);
                absExpressions.push(innerExpr);
            }
        } else {
            res += char;
        }
        i++;
    }
    while (stack.length > 0) {
        const openIdx = stack.pop()!;
        res += ")";
        const innerExpr = res.substring(openIdx + 4, res.length - 1);
        absExpressions.push(innerExpr);
    }
    
    let plotExpression = res;
    const eqIndex = res.indexOf('=');
    if (eqIndex !== -1) {
        const prevChar = res[eqIndex - 1];
        const nextChar = res[eqIndex + 1];
        if (prevChar !== '<' && prevChar !== '>' && prevChar !== '=' && prevChar !== '!' && nextChar !== '=') {
            plotExpression = res.substring(eqIndex + 1).trim();
        }
    }
    
    return { parsed: res, plotExpression, absExpressions };
};

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

const formatEquationNumber = (n: number): string => {
    if (typeof n !== 'number' || !isFinite(n)) return '0';
    if (Math.abs(n) < 1e-6) return '0';
    if (Math.abs(n - Math.round(n)) < 1e-9) return Math.round(n).toString();
    return n.toFixed(6).replace(/\.?0+$/, '');
};

export const calculateTangentEquation = (
    expression: string, 
    x: number, 
    mode: 'tangent' | 'normal',
    globalScope: Record<string, number> = {}
): string | null => {
    if (typeof x !== 'number' || !isFinite(x) || !expression) return null;
    try {
        const { plotExpression } = preprocessMathExpression(expression);
        if (!plotExpression.trim()) return null;
        const compiled = math.compile(plotExpression);
        const y1Raw = compiled.evaluate({ ...globalScope, x });
        const y1 = typeof y1Raw === 'number' ? y1Raw : NaN;
        if (!isFinite(y1)) return null;

        let m = NaN;
        try {
            const derivCompiled = math.derivative(plotExpression, 'x').compile();
            const mRaw = derivCompiled.evaluate({ ...globalScope, x });
            m = typeof mRaw === 'number' ? mRaw : NaN;
        } catch {}

        if (!isFinite(m)) {
            const h = 1e-6;
            const yPlus = compiled.evaluate({ ...globalScope, x: x + h });
            const yMinus = compiled.evaluate({ ...globalScope, x: x - h });
            if (typeof yPlus === 'number' && typeof yMinus === 'number' && isFinite(yPlus) && isFinite(yMinus)) {
                m = (yPlus - yMinus) / (2 * h);
            }
        }

        if (!isFinite(m)) return null;

        let slope = m;
        if (mode === 'normal') {
            if (Math.abs(m) < 1e-7) return null; // Vertical normal (x = c), rendered directly by renderTangents
            slope = -1 / m;
        }

        // y - y1 = m(x - x1)  ->  y = m*x - m*x1 + y1
        const c = y1 - slope * x;
        if (!isFinite(c)) return null;
        
        const mStr = Math.abs(slope) < 1e-6 ? '0' : formatEquationNumber(slope);
        const cStr = Math.abs(c) < 1e-6 ? '0' : formatEquationNumber(Math.abs(c));
        const sign = c < 0 ? '-' : '+';

        if (mStr === '0') return formatEquationNumber(y1); // Horizontal line
        const xTerm = mStr === '1' ? 'x' : mStr === '-1' ? '-x' : `${mStr}x`;
        if (cStr === '0') return xTerm;
        return `${xTerm} ${sign} ${cStr}`;
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
        
        if (!isFinite(fa) || !isFinite(fb)) {
            // Function is undefined on one side, it could be a domain boundary.
            // If the finite side is extremely close to 0, it might be the root itself.
            if (isFinite(fa) && Math.abs(fa) < 0.5) {
                for (let i = 0; i < 40; i++) {
                    const mid = (a + b) / 2;
                    const fmid = fn(mid);
                    if (isFinite(fmid)) a = mid;
                    else b = mid;
                }
                if (Math.abs(fn(a)) < 1e-2) return a;
            }
            if (isFinite(fb) && Math.abs(fb) < 0.5) {
                for (let i = 0; i < 40; i++) {
                    const mid = (a + b) / 2;
                    const fmid = fn(mid);
                    if (isFinite(fmid)) b = mid;
                    else a = mid;
                }
                if (Math.abs(fn(b)) < 1e-2) return b;
            }
            return null;
        }
        
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

// Helper for parsing domain strings
const parseDomainBound = (val: any, fallback: number, scope: Record<string, number> = {}): number => {
    if (typeof val !== 'string' || !val.trim()) return fallback;
    try {
        const result = math.evaluate(preprocessMathExpression(val).parsed, scope);
        return typeof result === 'number' && isFinite(result) ? result : fallback;
    } catch { return fallback; }
};

export const analyzeFunction = (f: FunctionDef, xRange: [number, number], yRange: [number, number], useExactValues: boolean = false, globalScope: Record<string, number> = {}): FeaturePoint[] => {
    if (!f.expression || f.isParametric || f.type === 'parameter') return [];
    // Skip locked & collapsed derived tangent lines during analysis so dragging tangents is instantaneous and doesn't spawn spurious horizontal asymptotes
    if (f.locked && f.isCollapsed) return [];
    
    const features: FeaturePoint[] = [];
    
    const { plotExpression, absExpressions } = preprocessMathExpression(f.expression);

    // Compile Main Function
    let compiled: math.EvalFunction;
    try { compiled = math.compile(plotExpression); } catch { return []; }
    const fn = (x: number) => { try { const val = compiled.evaluate({ ...globalScope, x }); return typeof val === 'number' && isFinite(val) ? val : NaN; } catch { return NaN; } };

    // Compile Derivatives (with numerical fallback when symbolic differentiation fails, e.g. abs/floor)
    let fnPrime: ((x: number) => number) | null = null;
    let fnDoublePrime: ((x: number) => number) | null = null;
    try {
        const d1 = math.derivative(plotExpression, 'x');
        const d1C = d1.compile();
        fnPrime = (x: number) => { try { const val = d1C.evaluate({ ...globalScope, x }); return typeof val === 'number' && isFinite(val) ? val : NaN; } catch { return NaN; } };

        const d2 = math.derivative(d1, 'x');
        const d2C = d2.compile();
        fnDoublePrime = (x: number) => { try { const val = d2C.evaluate({ ...globalScope, x }); return typeof val === 'number' && isFinite(val) ? val : NaN; } catch { return NaN; } };
    } catch {
        fnPrime = (x: number) => {
            const h = 1e-6;
            return (fn(x + h) - fn(x - h)) / (2 * h);
        };
    }

    const xMinParsed = parseDomainBound(f.domain[0], -Infinity, globalScope);
    const xMaxParsed = parseDomainBound(f.domain[1], Infinity, globalScope);

    const xMin = Math.max(xMinParsed, xRange[0]);
    const xMax = Math.min(xMaxParsed, xRange[1]);
    if (xMax <= xMin) return [];

    const ySpan = Math.max(1, yRange[1] - yRange[0]);
    const isContinuousAt = (x: number): boolean => {
        const y = fn(x);
        if (!isFinite(y)) return false;
        const h = 1e-5;
        const yLeft = fn(x - h);
        const yRight = fn(x + h);
        if (!isFinite(yLeft) || !isFinite(yRight)) return false;
        return Math.abs(yRight - yLeft) < ySpan * 0.25;
    };

    // Detect Vertical Asymptotes first so poles are excluded from roots/extrema/inflections
    const invFn = (x: number) => {
        try {
            const y = fn(x);
            if (!isFinite(y)) return 0;
            if (Math.abs(y) < 1e-12) return 1e12;
            return 1 / y;
        } catch { return NaN; }
    };
    const rawPoles = findAllRoots(invFn, xMin, xMax, 300);
    const validPoles: number[] = [];
    rawPoles.forEach(p => {
        const nearLeft = fn(p - 1e-5);
        const nearRight = fn(p + 1e-5);
        if (Math.abs(nearLeft) > Math.max(50, ySpan * 3) || Math.abs(nearRight) > Math.max(50, ySpan * 3) || !isFinite(nearLeft) || !isFinite(nearRight)) {
            if (!validPoles.some(vp => Math.abs(vp - p) < 1e-3)) {
                validPoles.push(p);
            }
        }
    });

    const isNearPole = (x: number) => validPoles.some(p => Math.abs(x - p) < 1e-3);

    // 1. Y-Intercept
    if (xMin <= 0 && xMax >= 0 && !isNearPole(0)) {
        const y0 = fn(0);
        if (isFinite(y0) && y0 >= yRange[0] && y0 <= yRange[1]) {
            features.push({
                id: `${f.id}-y-int`, functionId: f.id, type: 'y-intercept', x: 0, y: y0,
                label: formatCoordinate(0, y0, useExactValues), 
                visible: true, showLabel: false, customLabelOffset: getDefaultOffset('y-intercept'),
                color: f.color, style: 'filled', size: 4
            });
        }
    }

    // 2. Extrema (Turning Points) f'(x) = 0
    const stationaryPoints: number[] = [];
    if (fnPrime) {
        const rawStationary = findAllRoots(fnPrime, xMin, xMax, 300);
        rawStationary.forEach(r => {
            if (!isNearPole(r) && isContinuousAt(r)) {
                const sLeft = fnPrime!(r - 1e-4);
                const sRight = fnPrime!(r + 1e-4);
                if (isFinite(sLeft) && isFinite(sRight) && Math.sign(sLeft) !== Math.sign(sRight)) {
                    stationaryPoints.push(r);
                }
            }
        });

        // Add roots of absolute value expressions as sharp turning points
        absExpressions.forEach(absExpr => {
            try {
                const absCompiled = math.compile(absExpr);
                const absFn = (x: number) => {
                    try {
                        const val = absCompiled.evaluate({ ...globalScope, x });
                        return typeof val === 'number' ? val : NaN;
                    } catch { return NaN; }
                };
                const absRoots = findAllRoots(absFn, xMin, xMax);
                absRoots.forEach(r => {
                    if (!isNearPole(r) && !stationaryPoints.some(existingPt => Math.abs(existingPt - r) < 1e-4)) {
                        stationaryPoints.push(r);
                    }
                });
            } catch {}
        });
        stationaryPoints.sort((a, b) => a - b);
    }

    // 3. Roots (x-intercepts), including touching roots where f(x) = 0 and f'(x) = 0
    const roots = findAllRoots(fn, xMin, xMax, 300).filter(r => !isNearPole(r) && Math.abs(fn(r)) < 1e-3);
    
    // Check stationary points and absExpression roots for touching roots (even multiplicity)
    stationaryPoints.forEach(sp => {
        const yVal = fn(sp);
        if (isFinite(yVal) && Math.abs(yVal) < 1e-5) {
            if (!roots.some(existingRoot => Math.abs(existingRoot - sp) < 1e-4)) {
                roots.push(sp);
            }
        }
    });

    absExpressions.forEach(absExpr => {
        try {
            const absCompiled = math.compile(absExpr);
            const absFn = (x: number) => {
                try {
                    const val = absCompiled.evaluate({ ...globalScope, x });
                    return typeof val === 'number' ? val : NaN;
                } catch { return NaN; }
            };
            const absRoots = findAllRoots(absFn, xMin, xMax);
            absRoots.forEach(r => {
                if (!isNearPole(r) && Math.abs(fn(r)) < 1e-5 && !roots.some(existingRoot => Math.abs(existingRoot - r) < 1e-4)) {
                    roots.push(r);
                }
            });
        } catch {}
    });

    roots.sort((a, b) => a - b);
    roots.forEach(r => {
        const cleanR = Math.abs(r) < 1e-9 ? 0 : r;
        features.push({
            id: `${f.id}-root-${cleanR.toFixed(4)}`, functionId: f.id, type: 'root', x: cleanR, y: 0,
            label: formatCoordinate(cleanR, 0, useExactValues), 
            visible: true, showLabel: false, customLabelOffset: getDefaultOffset('root'),
            color: f.color, style: 'filled', size: 4
        });
    });

    // Add Extrema features
    stationaryPoints.forEach(x => {
        const cleanX = Math.abs(x) < 1e-9 ? 0 : x;
        const y = fn(cleanX);
        if (isFinite(y) && y >= yRange[0] && y <= yRange[1]) {
            if (Math.abs(cleanX - xMin) > 1e-5 && Math.abs(cleanX - xMax) > 1e-5) {
                features.push({
                    id: `${f.id}-ext-${cleanX.toFixed(4)}`, functionId: f.id, type: 'extremum', x: cleanX, y: y,
                    label: formatCoordinate(cleanX, y, useExactValues),
                    visible: true, showLabel: false, customLabelOffset: getDefaultOffset('extremum'),
                    color: f.color, style: 'filled', size: 4
                });
            }
        }
    });

    // 4. Inflection Points f''(x) = 0
    if (fnDoublePrime) {
        const inflections = findAllRoots(fnDoublePrime, xMin, xMax, 300);
        inflections.forEach(x => {
            if (isNearPole(x) || !isContinuousAt(x)) return;
            const d2Left = fnDoublePrime!(x - 1e-4);
            const d2Right = fnDoublePrime!(x + 1e-4);
            if (!isFinite(d2Left) || !isFinite(d2Right) || Math.sign(d2Left) === Math.sign(d2Right)) return;
            if (Math.abs(fnDoublePrime!(x)) > 1e-2) return;

            const cleanX = Math.abs(x) < 1e-9 ? 0 : x;
            const y = fn(cleanX);
            if (isFinite(y) && y >= yRange[0] && y <= yRange[1]) {
                if (Math.abs(cleanX - xMin) > 1e-5 && Math.abs(cleanX - xMax) > 1e-5) {
                    features.push({
                        id: `${f.id}-inf-${cleanX.toFixed(4)}`, functionId: f.id, type: 'inflection', x: cleanX, y: y,
                        label: formatCoordinate(cleanX, y, useExactValues),
                        visible: true, showLabel: false, customLabelOffset: getDefaultOffset('inflection'),
                        color: f.color, style: 'filled', size: 4 
                    });
                }
            }
        });
    }

    // 5. Vertical Asymptotes
    validPoles.forEach(p => {
        const cleanP = Math.abs(p) < 1e-9 ? 0 : p;
        features.push({
            id: `${f.id}-vasy-${cleanP.toFixed(4)}`, functionId: f.id, type: 'vertical-asymptote', x: cleanP, y: 0,
            label: `x = ${useExactValues ? formatExact(cleanP) : formatDecimal(cleanP)}`, 
            visible: true, showLabel: true, customLabelOffset: getDefaultOffset('vertical-asymptote'),
            color: f.color, style: 'hollow', size: 0
        });
    });

    // 6. Horizontal Asymptotes
    const limitCheckX = 1e5;
    const checkLimit = (xVal: number) => {
        try {
            const yVal = fn(xVal);
            const slope = fnPrime ? fnPrime(xVal) : (fn(xVal+1) - fn(xVal));
            if (isFinite(yVal) && Math.abs(slope) < 1e-6) {
                const cleanY = Math.abs(yVal) < 1e-9 ? 0 : yVal;
                const exists = features.some(ft => ft.type === 'horizontal-asymptote' && Math.abs(ft.y - cleanY) < 1e-3);
                if (!exists) {
                    if (cleanY >= yRange[0] - (yRange[1]-yRange[0]) && cleanY <= yRange[1] + (yRange[1]-yRange[0])) {
                        features.push({
                            id: `${f.id}-hasy-${cleanY.toFixed(4)}`, functionId: f.id, type: 'horizontal-asymptote', x: 0, y: cleanY,
                            label: `y = ${useExactValues ? formatExact(cleanY) : formatDecimal(cleanY)}`,
                            visible: true, showLabel: true, customLabelOffset: getDefaultOffset('horizontal-asymptote'),
                            color: f.color, style: 'hollow', size: 0
                        });
                    }
                }
            }
        } catch {}
    };
    
    if (!isFinite(xMaxParsed)) checkLimit(limitCheckX);
    if (!isFinite(xMinParsed)) checkLimit(-limitCheckX);

    // 7. Endpoints
    const startXNum = parseDomainBound(f.domain[0], NaN, globalScope);
    const endXNum = parseDomainBound(f.domain[1], NaN, globalScope);

    [startXNum, endXNum].forEach((ex, idx) => {
        if (!isNaN(ex) && ex >= xRange[0] && ex <= xRange[1] && !isNearPole(ex)) {
            const ey = fn(ex);
            if (isFinite(ey) && ey >= yRange[0] && ey <= yRange[1]) {
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

export const analyzeGraphIntersection = (f1: FunctionDef, f2: FunctionDef, xRange: [number, number], useExactValues: boolean = false, globalScope: Record<string, number> = {}): FeaturePoint[] => {
    if (!f1.expression || !f2.expression || f1.isParametric || f2.isParametric || f1.type === 'parameter' || f2.type === 'parameter') return [];
    
    let compiled1: math.EvalFunction, compiled2: math.EvalFunction;
    try {
        const { plotExpression: px1 } = preprocessMathExpression(f1.expression);
        const { plotExpression: px2 } = preprocessMathExpression(f2.expression);
        compiled1 = math.compile(px1);
        compiled2 = math.compile(px2);
    } catch { return []; }

    const fn1 = (x: number) => { try { const val = compiled1.evaluate({ ...globalScope, x }); return typeof val === 'number' && isFinite(val) ? val : NaN; } catch { return NaN; } };
    const fn2 = (x: number) => { try { const val = compiled2.evaluate({ ...globalScope, x }); return typeof val === 'number' && isFinite(val) ? val : NaN; } catch { return NaN; } };
    
    const diffFn = (x: number) => fn1(x) - fn2(x);
    const diffPrime = (x: number) => {
        const h = 1e-6;
        return (diffFn(x + h) - diffFn(x - h)) / (2 * h);
    };

    // Constrain to intersection of domains and view window
    const d1Min = parseDomainBound(f1.domain[0], -Infinity, globalScope);
    const d1Max = parseDomainBound(f1.domain[1], Infinity, globalScope);
    const d2Min = parseDomainBound(f2.domain[0], -Infinity, globalScope);
    const d2Max = parseDomainBound(f2.domain[1], Infinity, globalScope);

    const xMin = Math.max(xRange[0], d1Min, d2Min);
    const xMax = Math.min(xRange[1], d1Max, d2Max);

    if (xMax <= xMin) return [];

    const roots = findAllRoots(diffFn, xMin, xMax, 300).filter(r => Math.abs(diffFn(r)) < 1e-3);
    // Also detect tangential intersections where diffFn(x) = 0 and diffPrime(x) = 0
    const tangentCandidates = findAllRoots(diffPrime, xMin, xMax, 300);
    tangentCandidates.forEach(tc => {
        if (Math.abs(diffFn(tc)) < 1e-5 && !roots.some(r => Math.abs(r - tc) < 1e-4)) {
            roots.push(tc);
        }
    });
    roots.sort((a, b) => a - b);
    
    const intersectFeatures: FeaturePoint[] = [];
    roots.forEach(r => {
        const cleanR = Math.abs(r) < 1e-9 ? 0 : r;
        const y = fn1(cleanR);
        if (typeof y === 'number' && isFinite(y)) {
            intersectFeatures.push({
                id: `intersect-${f1.id}-${f2.id}-${cleanR.toFixed(4)}`,
                functionId: `intersect-${f1.id}-${f2.id}`,
                type: 'intersection',
                x: cleanR,
                y: y,
                label: formatCoordinate(cleanR, y, useExactValues),
                visible: true,
                showLabel: false,
                customLabelOffset: getDefaultOffset('intersection'),
                color: '#000000',
                style: 'filled',
                size: 4
            });
        }
    });
    return intersectFeatures;
};

// ... (Rest of file remains unchanged)
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
    if (end === window.Infinity && !b.endInclusive) endInclusive = false;
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

export const analyzeInequalityIntersections = (ineqs: InequalityDef[], xRange: [number, number], yRange: [number, number], useExactValues: boolean = false): FeaturePoint[] => {
    const visibleIneqs = ineqs.filter(i => i.visible && i.expression && i.type !== 'complex');
    if (visibleIneqs.length < 1) return [];
    const features: FeaturePoint[] = [];
    const fmt = (x:number, y:number) => formatCoordinate(x, y, useExactValues);
    const eps = 1e-5;

    const flattened = visibleIneqs.flatMap(iq => {
        let actualType = iq.type;
        let actualOp = iq.operator;
        let actualExpr = iq.expression;
        
        if (iq.type !== 'linear') {
            const m = iq.expression.match(/^\s*(x|y)\s*([<>=!]+)\s*(.+)$/i);
            if (m) {
                actualType = m[1].toLowerCase() as 'x' | 'y';
                actualOp = m[2] as '<' | '<=' | '>' | '>=';
                if (actualOp as string === '=') actualOp = '<=';
                actualExpr = m[3];
            }
        }

        if (actualType === 'linear') {
            return parseAdvancedInequality(actualExpr).map((res, idx) => {
                const { plotExpression } = preprocessMathExpression(res.expression);
                return { 
                    ineq: { 
                        ...iq, 
                        type: res.type as 'x' | 'y', 
                        expression: res.expression, 
                        operator: res.operator as '<' | '<=' | '>' | '>=', 
                        id: `${iq.id}_sub_${idx}` 
                    },
                    node: math.compile(plotExpression)
                };
            });
        } else {
            try { 
                const { plotExpression } = preprocessMathExpression(actualExpr);
                return [{ 
                    ineq: { ...iq, type: actualType as 'x' | 'y', operator: actualOp, expression: actualExpr }, 
                    node: math.compile(plotExpression) 
                }]; 
            } catch { return []; }
        }
    }) as FlattenedIntersectionItem[];

    const satisfies = (x: number, y: number): boolean => {
        for (const item of flattened) {
            try {
                const boundVal = item.node.evaluate(item.ineq.type === 'x' ? { y } : { x });
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
            } else if (it1.ineq.type === 'x' && it2.ineq.type === 'x') {
                const diffFn = (y: number) => it1.node.evaluate({ y }) - it2.node.evaluate({ y });
                const roots = findAllRoots(diffFn, yRange[0], yRange[1]);
                roots.forEach(ry => {
                    const rx = it1.node.evaluate({ y: ry });
                    if (isFinite(rx) && satisfies(rx, ry)) addVertex(features, rx, ry, it1.ineq.operator, it2.ineq.operator, fmt);
                });
            } else if (it1.ineq.type !== it2.ineq.type) {
                const xIt = it1.ineq.type === 'x' ? it1 : it2;
                const yIt = it1.ineq.type === 'y' ? it1 : it2;
                const diffFn = (x: number) => x - xIt.node.evaluate({ y: yIt.node.evaluate({ x }) });
                const roots = findAllRoots(diffFn, xRange[0], xRange[1]);
                roots.forEach(rx => {
                    const ry = yIt.node.evaluate({ x: rx });
                    if (isFinite(ry) && satisfies(rx, ry)) addVertex(features, rx, ry, it1.ineq.operator, it2.ineq.operator, fmt);
                });
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