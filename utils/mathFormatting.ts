
import * as math from 'mathjs';

export const formatDecimal = (n: number) => {
    if (Math.abs(n) < 1e-10) return "0";
    if (Math.abs(n - Math.round(n)) < 1e-9) return Math.round(n).toString();
    return n.toFixed(2).replace(/\.00$/, '');
};

export const formatExact = (val: number): string => {
    if (Math.abs(val) < 1e-9) return "0";
    
    // 1. Integer check
    if (Math.abs(val - Math.round(val)) < 1e-9) return Math.round(val).toString();

    const sign = val < 0 ? "-" : "";
    const absVal = Math.abs(val);

    // 2. Pi multiples
    const piRatio = absVal / Math.PI;
    if (Math.abs(piRatio - Math.round(piRatio)) < 1e-5) {
        const n = Math.round(piRatio);
        if (n === 0) return "0";
        if (n === 1) return `${sign}\\pi`;
        return `${sign}${n}\\pi`;
    }
    
    // Simple Pi fractions
    for (const dem of [2, 3, 4, 6]) {
        const num = piRatio * dem;
        if (Math.abs(num - Math.round(num)) < 1e-5) {
            const n = Math.round(num);
            if (n % dem === 0) return `${sign}${n/dem}\\pi`;
            const numStr = (n === 1) ? "" : n.toString();
            return `${sign}\\frac{${numStr}\\pi}{${dem}}`;
        }
    }

    // 3. Brute force specific forms for generic radicals: (a * sqrt(b)) / c
    // b is square-free up to some threshold
    const squareFree = [2, 3, 5, 6, 7, 10, 11, 13, 14, 15, 17, 19, 21, 22, 23, 26, 29, 30, 31, 33, 34, 35, 37, 38, 39, 41, 42, 43, 46, 47];
    
    for (let c = 1; c <= 15; c++) {
        for (let b of squareFree) {
            const sqrtB = Math.sqrt(b);
            const aRaw = (absVal * c) / sqrtB;
            if (Math.abs(aRaw - Math.round(aRaw)) < 1e-5) {
                const a = Math.round(aRaw);
                const gcd = (x: number, y: number): number => y === 0 ? x : gcd(y, x % y);
                if (gcd(a, c) === 1) {
                    if (c === 1) {
                        return a === 1 ? `${sign}\\sqrt{${b}}` : `${sign}${a}\\sqrt{${b}}`;
                    } else {
                        const numStr = a === 1 ? `\\sqrt{${b}}` : `${a}\\sqrt{${b}}`;
                        return `${sign}\\frac{${numStr}}{${c}}`;
                    }
                }
            }
        }
    }
    
    // 4. Common Fractions
    try {
        const f = math.fraction(absVal) as any;
        const d = Number(f.d);
        const n = Number(f.n);
        if (d < 100) {
            if (d === 1) return `${sign}${n}`;
            return `${sign}\\frac{${n}}{${d}}`;
        }
    } catch {}

    return formatDecimal(val);
};

export const formatCoordinate = (x: number, y: number, useExact: boolean): string => {
    const f = useExact ? formatExact : formatDecimal;
    return `(${f(x)}, ${f(y)})`;
};
