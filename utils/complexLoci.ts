import * as math from 'mathjs';

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

function parseComplexVal(s: string): { x: number, y: number } | null {
    if (!s) return { x: 0, y: 0 };
    try {
        let clean = s.replace(/i/g, 'i').replace(/I/g, 'i');
        const c = math.evaluate(clean);
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
    let s = expr.replace(/\s+/g, '').replace(/pi/g, 'PI');
    
    // Check for Arg(...) sector: a < Arg(z - c) < b
    let sectorMatch = s.match(/(.*?)(<|<=)Arg\((z(?:-(.*?))?)\)(<|<=)(.*)/i);
    if (sectorMatch) {
        let t1 = parseRealVal(sectorMatch[1].replace(/PI/g, 'pi'));
        let t2 = parseRealVal(sectorMatch[6].replace(/PI/g, 'pi'));
        let center = parseComplexVal(sectorMatch[4] || '0');
        if (t1 !== null && t2 !== null && center) {
            return { type: 'sector', operator: '<', theta1: t1, theta2: t2, center };
        }
    }

    // Check for Arg(z - c) <=> theta
    let argMatch = s.match(/Arg\((z(?:-(.*?))?)\)(<=|>=|<|>|=)(.*)/i);
    if (argMatch) {
        let center = parseComplexVal(argMatch[2] || '0');
        let op = argMatch[3] as '<' | '<=' | '>' | '>=' | '=';
        let theta = parseRealVal(argMatch[4].replace(/PI/g, 'pi'));
        if (center && theta !== null) {
            return { type: 'ray', operator: op, center, theta };
        }
    }

    // Check for |z - a| <=> |z - b|
    let lineMatch = s.match(/\|z(?:-(.*?))?\|(<=|>=|<|>|=)\|z(?:-(.*?))?\|/);
    if (lineMatch) {
        let pointA = parseComplexVal(lineMatch[1] || '0');
        let op = lineMatch[2] as '<' | '<=' | '>' | '>=' | '=';
        let pointB = parseComplexVal(lineMatch[3] || '0');
        if (pointA && pointB) {
            return { type: 'line', operator: op, pointA, pointB };
        }
    }

    // Check for |z - c| <=> r
    let circleMatch = s.match(/\|z(?:-(.*?))?\|(<=|>=|<|>|=)(.*)/);
    if (circleMatch && !circleMatch[3].includes('|')) {
        let center = parseComplexVal(circleMatch[1] || '0');
        let op = circleMatch[2] as '<' | '<=' | '>' | '>=' | '=';
        let radius = parseRealVal(circleMatch[3].replace(/PI/g, 'pi'));
        if (center && radius !== null) {
            return { type: 'circle', operator: op, center, radius };
        }
    }

    return null;
}
