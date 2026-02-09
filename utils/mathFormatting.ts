
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

    // 3. Common Trigonometric / Radical Values (e.g., sin(pi/4), cos(pi/6))
    // This handles the specific user request for sin(x)=cos(x) producing exact Y values.
    const trigValues = [
        { v: Math.sqrt(2)/2, s: "\\frac{\\sqrt{2}}{2}" },
        { v: Math.sqrt(3)/2, s: "\\frac{\\sqrt{3}}{2}" },
        { v: Math.sqrt(3),   s: "\\sqrt{3}" },
        { v: 1/Math.sqrt(3), s: "\\frac{\\sqrt{3}}{3}" },
        { v: Math.sqrt(2),   s: "\\sqrt{2}" },
        { v: 1/2,           s: "\\frac{1}{2}" },
        { v: 1/3,           s: "\\frac{1}{3}" },
        { v: 2/3,           s: "\\frac{2}{3}" },
    ];
    
    for (const tv of trigValues) {
        if (Math.abs(absVal - tv.v) < 1e-5) return sign + tv.s;
    }

    // 4. Square Roots general
    const sq = absVal * absVal;
    if (Math.abs(sq - Math.round(sq)) < 1e-5) {
        const n = Math.round(sq);
        if (n < 100 && Math.sqrt(n) % 1 !== 0) {
            return `${sign}\\sqrt{${n}}`;
        }
    }
    
    // 5. Common Fractions
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
