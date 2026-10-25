/*
 * Vector & Geometry Math Helpers for Shape Builder
 */

export const degToRad = (deg: number) => deg * (Math.PI / 180);
export const radToDeg = (rad: number) => rad * (180 / Math.PI);

export const snapValue = (val: number, step: number = 10) => {
    if (step <= 0) return val;
    return Math.round(val / step) * step;
};

export const snapAngle = (angleDeg: number, increment: number = 15) => {
    const normalized = ((angleDeg % 360) + 360) % 360;
    return Math.round(normalized / increment) * increment;
};

export const rotatePoint = (x: number, y: number, cx: number, cy: number, angleDeg: number) => {
    const rad = degToRad(angleDeg);
    const cos = Math.cos(rad);
    const sin = Math.sin(rad);
    const nx = cos * (x - cx) - sin * (y - cy) + cx;
    const ny = sin * (x - cx) + cos * (y - cy) + cy;
    return { x: nx, y: ny };
};

export const getDistance = (p1: { x: number; y: number }, p2: { x: number; y: number }) => {
    return Math.sqrt(Math.pow(p2.x - p1.x, 2) + Math.pow(p2.y - p1.y, 2));
};

export const getMidpoint = (p1: { x: number; y: number }, p2: { x: number; y: number }) => {
    return { x: (p1.x + p2.x) / 2, y: (p1.y + p2.y) / 2 };
};

export const getVector = (p1: { x: number; y: number }, p2: { x: number; y: number }) => {
    return { x: p2.x - p1.x, y: p2.y - p1.y };
};

export const normalize = (v: { x: number; y: number }) => {
    const len = Math.sqrt(v.x * v.x + v.y * v.y);
    if (len === 0) return { x: 0, y: 0 };
    return { x: v.x / len, y: v.y / len };
};

export const getNormal = (v: { x: number; y: number }) => {
    return { x: -v.y, y: v.x };
};

// Ensures normal points outward from polygon centroid
export const getOutwardNormal = (
    p1: { x: number; y: number },
    p2: { x: number; y: number },
    centroid: { x: number; y: number }
) => {
    const mid = getMidpoint(p1, p2);
    const unit = normalize(getVector(p1, p2));
    const n1 = { x: unit.y, y: -unit.x };
    const toMid = { x: mid.x - centroid.x, y: mid.y - centroid.y };
    const dot = n1.x * toMid.x + n1.y * toMid.y;
    return dot >= 0 ? n1 : { x: -n1.x, y: -n1.y };
};

export const getPolygonCentroid = (pts: { x: number; y: number }[]) => {
    if (pts.length === 0) return { x: 0, y: 0 };
    const sum = pts.reduce((acc, p) => ({ x: acc.x + p.x, y: acc.y + p.y }), { x: 0, y: 0 });
    return { x: sum.x / pts.length, y: sum.y / pts.length };
};

// Calculates vertices for a standard rectangle centered at 0,0 unrotated
export const getRectVertices = (w: number, h: number) => {
    return [
        { x: -w / 2, y: -h / 2 }, // 0: TL
        { x: w / 2, y: -h / 2 },  // 1: TR
        { x: w / 2, y: h / 2 },   // 2: BR
        { x: -w / 2, y: h / 2 }   // 3: BL
    ];
};

// Regular / Irregular Polygon vertices centered at 0,0
export const getRegularPolygonVertices = (
    sides: number,
    radius: number,
    irregularOffsets?: { dx: number; dy: number }[]
) => {
    const pts: { x: number; y: number }[] = [];
    const n = Math.max(3, Math.min(16, Math.round(sides)));
    // Start with flat bottom or top apex
    const startAngle = -Math.PI / 2;
    for (let i = 0; i < n; i++) {
        const theta = startAngle + (i * 2 * Math.PI) / n;
        const off = irregularOffsets && irregularOffsets[i] ? irregularOffsets[i] : { dx: 0, dy: 0 };
        pts.push({
            x: radius * Math.cos(theta) + off.dx,
            y: radius * Math.sin(theta) + off.dy
        });
    }
    return pts;
};

// L-Shape (Compound Rectangle) 6 vertices clockwise starting top-left
export const getLShapeVertices = (
    outerW: number,
    outerH: number,
    cutW: number,
    cutH: number
) => {
    const hw = outerW / 2;
    const hh = outerH / 2;
    const cw = Math.max(20, Math.min(outerW - 20, cutW));
    const ch = Math.max(20, Math.min(outerH - 20, cutH));
    const innerX = hw - cw;
    const innerY = -hh + ch;

    return [
        { x: -hw, y: -hh },      // 0: Top-Left
        { x: innerX, y: -hh },   // 1: Top-Inner
        { x: innerX, y: innerY },// 2: Concave Inner Corner
        { x: hw, y: innerY },    // 3: Right-Inner
        { x: hw, y: hh },        // 4: Bottom-Right
        { x: -hw, y: hh }        // 5: Bottom-Left
    ];
};

// House Shape (Triangle roof on Rectangle base)
export const getHouseGeometry = (
    baseW: number,
    baseH: number,
    roofH: number,
    overhang: number
) => {
    const totalH = baseH + roofH;
    const topY = -totalH / 2;
    const ceilingY = topY + roofH;
    const bottomY = totalH / 2;
    const hw = baseW / 2;
    const roofHw = hw + Math.max(0, overhang);

    return {
        apex: { x: 0, y: topY },
        eaveRight: { x: roofHw, y: ceilingY },
        eaveLeft: { x: -roofHw, y: ceilingY },
        ceilRight: { x: hw, y: ceilingY },
        ceilLeft: { x: -hw, y: ceilingY },
        bottomRight: { x: hw, y: bottomY },
        bottomLeft: { x: -hw, y: bottomY },
        totalH
    };
};

// Polar to Cartesian (0 deg = right, 90 deg = down in SVG)
export const polarToCartesian = (cx: number, cy: number, r: number, angleDeg: number) => {
    const rad = degToRad(angleDeg);
    return {
        x: cx + r * Math.cos(rad),
        y: cy + r * Math.sin(rad)
    };
};

// Positive angular span from startDeg to endDeg in [0, 360)
export const getPositiveAngleSpan = (startDeg: number, endDeg: number) => {
    let span = (endDeg - startDeg) % 360;
    if (span < 0) span += 360;
    return span;
};

// Build SVG path for circular arc or sector
export const describeArcOrSector = (
    cx: number,
    cy: number,
    r: number,
    startDeg: number,
    endDeg: number,
    includeCenter: boolean = false
) => {
    const span = getPositiveAngleSpan(startDeg, endDeg);
    if (span <= 0.1 || span >= 359.9) {
        return `M ${cx - r} ${cy} A ${r} ${r} 0 1 1 ${cx + r} ${cy} A ${r} ${r} 0 1 1 ${cx - r} ${cy} Z`;
    }
    const start = polarToCartesian(cx, cy, r, startDeg);
    const end = polarToCartesian(cx, cy, r, endDeg);
    const largeArcFlag = span > 180 ? 1 : 0;
    if (includeCenter) {
        return `M ${cx} ${cy} L ${start.x} ${start.y} A ${r} ${r} 0 ${largeArcFlag} 1 ${end.x} ${end.y} Z`;
    }
    return `M ${start.x} ${start.y} A ${r} ${r} 0 ${largeArcFlag} 1 ${end.x} ${end.y}`;
};

// Build SVG path for circular segment (between chord and arc)
export const describeCircleSegment = (
    cx: number,
    cy: number,
    r: number,
    startDeg: number,
    endDeg: number
) => {
    const span = getPositiveAngleSpan(startDeg, endDeg);
    const start = polarToCartesian(cx, cy, r, startDeg);
    const end = polarToCartesian(cx, cy, r, endDeg);
    const largeArcFlag = span > 180 ? 1 : 0;
    return `M ${start.x} ${start.y} A ${r} ${r} 0 ${largeArcFlag} 1 ${end.x} ${end.y} L ${start.x} ${start.y} Z`;
};
