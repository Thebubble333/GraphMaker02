
/*
 * Vector Math Helpers for Shape Builder
 */

export const degToRad = (deg: number) => deg * (Math.PI / 180);
export const radToDeg = (rad: number) => rad * (180 / Math.PI);

export const rotatePoint = (x: number, y: number, cx: number, cy: number, angleDeg: number) => {
    const rad = degToRad(angleDeg);
    const cos = Math.cos(rad);
    const sin = Math.sin(rad);
    const nx = (cos * (x - cx)) - (sin * (y - cy)) + cx;
    const ny = (sin * (x - cx)) + (cos * (y - cy)) + cy;
    return { x: nx, y: ny };
};

export const getDistance = (p1: {x:number, y:number}, p2: {x:number, y:number}) => {
    return Math.sqrt(Math.pow(p2.x - p1.x, 2) + Math.pow(p2.y - p1.y, 2));
};

export const getMidpoint = (p1: {x:number, y:number}, p2: {x:number, y:number}) => {
    return { x: (p1.x + p2.x) / 2, y: (p1.y + p2.y) / 2 };
};

export const getVector = (p1: {x:number, y:number}, p2: {x:number, y:number}) => {
    return { x: p2.x - p1.x, y: p2.y - p1.y };
};

export const normalize = (v: {x:number, y:number}) => {
    const len = Math.sqrt(v.x * v.x + v.y * v.y);
    if (len === 0) return { x: 0, y: 0 };
    return { x: v.x / len, y: v.y / len };
};

export const getNormal = (v: {x:number, y:number}) => {
    // Rotates 90 degrees clockwise (for typical screen coords where Y is down)
    // Actually standard normal is (-y, x). 
    return { x: -v.y, y: v.x }; 
};

// Calculates vertices for a standard polygon centered at 0,0 unrotated
export const getRectVertices = (w: number, h: number) => {
    return [
        { x: -w/2, y: -h/2 }, // TL
        { x: w/2, y: -h/2 },  // TR
        { x: w/2, y: h/2 },   // BR
        { x: -w/2, y: h/2 }   // BL
    ];
};

export const getTriangleVertices = (base: number, height: number, peakOffset: number) => {
    // Base centered on X axis? Or shape centroid centered?
    // Let's center the bounding box for easier rotation
    const minX = Math.min(0, peakOffset, base);
    const maxX = Math.max(0, peakOffset, base);
    const width = maxX - minX;
    
    // Centering offsets
    const offsetX = -width / 2;
    const offsetY = -height / 2;

    return [
        { x: peakOffset + offsetX, y: offsetY }, // Peak
        { x: base + offsetX, y: height + offsetY }, // Bottom Right
        { x: 0 + offsetX, y: height + offsetY }  // Bottom Left
    ];
};
