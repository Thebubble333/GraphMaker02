export interface BracketMetrics {
    bearingX: number;
    minX: number;
    maxX: number;
    minY: number;
    maxY: number;
    advanceWidth: number;
    ascent: number;
    descent: number;
}

export interface BracketResult {
    pathData: string;
    metrics: BracketMetrics;
    rawPoints: Float32Array; 
}

export class BracketGenerator {
    // =========================================================================
    // 1. CONSTANTS & CALIBRATION
    // =========================================================================
    private readonly BASE_HEIGHT: number = 25.0;

    constructor() {}

    // =========================================================================
    // 2. PARENTHESIS GENERATOR FUNCTION (Optically Calibrated Crescent Bezier)
    // =========================================================================
    public generatePath(targetHeight: number, isLeft: boolean = true): BracketResult {
        // 26 base units = 1em.
        // Up to maxPureArchHeight (~2.6em), parentheses scale as a pure continuous
        // crescent Bezier arch. Above that, a straight vertical spine extends in the middle.
        const clampedH = Math.max(16.0, targetHeight);
        const maxPureArchHeight = 68.0;

        const archH = Math.min(clampedH, maxPureArchHeight);
        const halfCapH = archH / 2.0;
        const halfSpine = Math.max(0.0, (clampedH - maxPureArchHeight) / 2.0);

        // Normalized optical size factor: 0 at inline text size (~0.92em = 24u), 1 at tall size (~2.6em = 68u)
        const tSize = Math.min(1.0, Math.max(0.0, (clampedH - 24.0) / 44.0));

        // Standard Times New Roman / OpenType MATH optical stroke weights (in base units where 26u = 1em):
        // - Belly thickness at y = 0: ~2.02u (0.078em) at 1em, growing gently to ~2.44u (0.094em) when tall
        // - Total horizontal bow width: ~6.05u (0.233em) at 1em, growing to ~9.10u (0.350em) when tall
        // - Rounded tip thickness: ~0.46u (0.018em) at 1em, growing to ~0.58u (0.022em) when tall
        const bellyThick = 2.02 + tSize * 0.42;
        const bowWidth = 6.05 + Math.pow(tSize, 0.75) * 3.05;
        const tipThick = 0.46 + tSize * 0.12;

        const outerSpineX = -bowWidth * 0.5;
        const innerSpineX = outerSpineX + bellyThick;
        const tipOuterX = bowWidth * 0.5;

        const topTipY = halfSpine + halfCapH;

        // Top half of left parenthesis (4 nodes: Inner Spine -> Inner Tip -> Outer Tip -> Outer Spine).
        // Using a single cubic Bezier span for the inner arch and a single span for the outer arch
        // with vertical tangents at x = innerSpineX and x = outerSpineX guarantees a kink-free,
        // monotonically tapering crescent from belly to tip.
        const topNodes: number[][] = [
            // Node 0: Inner Spine (at y = +halfSpine)
            [
                innerSpineX, 0.0,
                innerSpineX, halfSpine,
                innerSpineX, halfSpine + halfCapH * 0.52
            ],
            // Node 1: Inner Tip (top-right inner edge of tip)
            [
                innerSpineX + (tipOuterX - innerSpineX) * 0.36, halfSpine + halfCapH * 0.86,
                tipOuterX, topTipY - tipThick * 0.26,
                tipOuterX + tipThick * 0.06, topTipY - tipThick * 0.04
            ],
            // Node 2: Outer Tip (top-right outer edge of tip)
            [
                tipOuterX - tipThick * 0.14, topTipY,
                tipOuterX - tipThick * 0.54, topTipY,
                outerSpineX + (tipOuterX - outerSpineX) * 0.32, halfSpine + halfCapH * 0.90
            ],
            // Node 3: Outer Spine (at y = +halfSpine)
            [
                outerSpineX, halfSpine + halfCapH * 0.57,
                outerSpineX, halfSpine,
                outerSpineX, 0.0
            ]
        ];

        // Reflect Top Half across y = 0 for Bottom Half while preserving winding order
        const bottomNodes: number[][] = [];
        for (let i = topNodes.length - 1; i >= 0; i--) {
            const node = topNodes[i];
            bottomNodes.push([
                node[4], -node[5], // Swapped h_in and h_out
                node[2], -node[3], // Anchor
                node[0], -node[1]
            ]);
        }

        const fullNodes = [...topNodes, ...bottomNodes];
        const numNodes = fullNodes.length;
        const points = new Float32Array(numNodes * 6);
        const xMultiplier = isLeft ? 1 : -1;

        let minX = Infinity, maxX = -Infinity;
        let minY = Infinity, maxY = -Infinity;

        for (let idx = 0; idx < numNodes; idx++) {
            const node = fullNodes[idx];
            for (let k = 0; k < 3; k++) {
                const pIdx = idx * 6 + k * 2;
                const newX = node[k * 2] * xMultiplier;
                const newY = node[k * 2 + 1];

                points[pIdx] = newX;
                points[pIdx + 1] = newY;

                if (newX < minX) minX = newX;
                if (newX > maxX) maxX = newX;
                if (newY < minY) minY = newY;
                if (newY > maxY) maxY = newY;
            }
        }

        // --- SVG STRING GENERATION ---
        let d = "";
        for (let i = 0; i < numNodes; i++) {
            const currAncIdx = (i * 6) + 2;
            const ancX = points[currAncIdx];
            const ancY = points[currAncIdx + 1];

            if (i === 0) {
                d += `M ${ancX.toFixed(2)} ${ancY.toFixed(2)} `;
            } else {
                const prevOutIdx = ((i - 1) * 6) + 4;
                const currInIdx = (i * 6) + 0;

                const cp1x = points[prevOutIdx];
                const cp1y = points[prevOutIdx + 1];
                const cp2x = points[currInIdx];
                const cp2y = points[currInIdx + 1];

                d += `C ${cp1x.toFixed(2)} ${cp1y.toFixed(2)}, ${cp2x.toFixed(2)} ${cp2y.toFixed(2)}, ${ancX.toFixed(2)} ${ancY.toFixed(2)} `;
            }
        }
        
        // Close the loop back to Node 0
        const lastOutIdx = ((numNodes - 1) * 6) + 4;
        const firstInIdx = 0;
        const firstAncIdx = 2;

        const cp1x = points[lastOutIdx];
        const cp1y = points[lastOutIdx + 1];
        const cp2x = points[firstInIdx];
        const cp2y = points[firstInIdx + 1];
        const finalAncX = points[firstAncIdx];
        const finalAncY = points[firstAncIdx + 1];

        d += `C ${cp1x.toFixed(2)} ${cp1y.toFixed(2)}, ${cp2x.toFixed(2)} ${cp2y.toFixed(2)}, ${finalAncX.toFixed(2)} ${finalAncY.toFixed(2)} Z`;

        return {
            pathData: d,
            rawPoints: points,
            metrics: {
                bearingX: minX,
                minX,
                maxX,
                minY,
                maxY,
                advanceWidth: maxX - minX,
                ascent: maxY,
                descent: minY
            }
        };
    }

    // =========================================================================
    // 5. SQUARE BRACKET GENERATOR (`[` and `]`)
    // =========================================================================
    public generateSquareBracketPath(targetHeight: number, isLeft: boolean = true): BracketResult {
        const H = Math.max(12.0, targetHeight);
        const halfH = H / 2.0;
        const stemThick = 1.25;
        const serifThick = 1.00;
        const width = Math.min(7.2, 5.4 + Math.max(0, H - 24) * 0.025);

        let d = "";
        if (isLeft) {
            d = `M 0 ${(-halfH).toFixed(2)} H ${width.toFixed(2)} V ${(-halfH + serifThick).toFixed(2)} H ${stemThick.toFixed(2)} V ${(halfH - serifThick).toFixed(2)} H ${width.toFixed(2)} V ${halfH.toFixed(2)} H 0 Z`;
        } else {
            const innerX = width - stemThick;
            d = `M 0 ${(-halfH).toFixed(2)} H ${width.toFixed(2)} V ${halfH.toFixed(2)} H 0 V ${(halfH - serifThick).toFixed(2)} H ${innerX.toFixed(2)} V ${(-halfH + serifThick).toFixed(2)} H 0 Z`;
        }

        return {
            pathData: d,
            rawPoints: new Float32Array(0),
            metrics: {
                bearingX: 0,
                minX: 0,
                maxX: width,
                minY: -halfH,
                maxY: halfH,
                advanceWidth: width,
                ascent: halfH,
                descent: -halfH
            }
        };
    }

    // =========================================================================
    // 6. CURLY BRACE GENERATOR (`\{` and `\}`)
    // =========================================================================
    public generateCurlyBracePath(targetHeight: number, isLeft: boolean = true): BracketResult {
        const H = Math.max(16.0, targetHeight);
        const halfH = H / 2.0;

        // Computer Modern extensible curly brace parameters in base units
        const W = Math.min(9.0, 6.8 + Math.max(0, H - 24) * 0.025);
        const stemThick = 1.20;
        const tipThick = 0.65;
        const hookH = Math.min(halfH * 0.42, 5.2);
        const cuspH = Math.min(halfH * 0.42, 4.8);

        // Stem center X sits halfway between cusp tip (0) and hook tip (W)
        const stemOuterX = W * 0.42;
        const stemInnerX = stemOuterX + stemThick;

        const mapX = (x: number) => (isLeft ? x : W - x);

        // Build left-brace coordinates (oriented with cusp at x=0, tips at x=W) and mirror via mapX if right brace
        const topY = -halfH;
        const botY = halfH;

        const d = [
            // Start at top outer tip
            `M ${mapX(W).toFixed(2)} ${topY.toFixed(2)}`,
            // Top outer curve down into upper outer stem
            `C ${mapX(stemOuterX + (W - stemOuterX) * 0.35).toFixed(2)} ${topY.toFixed(2)}, ${mapX(stemOuterX).toFixed(2)} ${(topY + hookH * 0.35).toFixed(2)}, ${mapX(stemOuterX).toFixed(2)} ${(topY + hookH).toFixed(2)}`,
            // Upper outer stem down to center cusp start
            `L ${mapX(stemOuterX).toFixed(2)} ${(-cuspH).toFixed(2)}`,
            // Upper outer cusp curve to center tip at (0, 0)
            `C ${mapX(stemOuterX).toFixed(2)} ${(-cuspH * 0.38).toFixed(2)}, ${mapX(stemOuterX * 0.45).toFixed(2)} ${(-tipThick * 0.4).toFixed(2)}, ${mapX(0).toFixed(2)} ${(-tipThick * 0.35).toFixed(2)}`,
            `L ${mapX(0).toFixed(2)} ${(tipThick * 0.35).toFixed(2)}`,
            // Lower outer cusp curve from center tip (0, 0) to lower outer stem
            `C ${mapX(stemOuterX * 0.45).toFixed(2)} ${(tipThick * 0.4).toFixed(2)}, ${mapX(stemOuterX).toFixed(2)} ${(cuspH * 0.38).toFixed(2)}, ${mapX(stemOuterX).toFixed(2)} ${cuspH.toFixed(2)}`,
            // Lower outer stem down to bottom hook start
            `L ${mapX(stemOuterX).toFixed(2)} ${(botY - hookH).toFixed(2)}`,
            // Bottom outer hook curve to bottom tip
            `C ${mapX(stemOuterX).toFixed(2)} ${(botY - hookH * 0.35).toFixed(2)}, ${mapX(stemOuterX + (W - stemOuterX) * 0.35).toFixed(2)} ${botY.toFixed(2)}, ${mapX(W).toFixed(2)} ${botY.toFixed(2)}`,
            // Bottom tip thickness
            `L ${mapX(W).toFixed(2)} ${(botY - tipThick).toFixed(2)}`,
            // Bottom inner hook curve up to lower inner stem
            `C ${mapX(stemInnerX + (W - stemInnerX) * 0.35).toFixed(2)} ${(botY - tipThick * 1.1).toFixed(2)}, ${mapX(stemInnerX).toFixed(2)} ${(botY - hookH * 0.45).toFixed(2)}, ${mapX(stemInnerX).toFixed(2)} ${(botY - hookH).toFixed(2)}`,
            // Lower inner stem up to center inner cusp
            `L ${mapX(stemInnerX).toFixed(2)} ${(cuspH * 0.92).toFixed(2)}`,
            // Center inner cusp curve
            `C ${mapX(stemInnerX).toFixed(2)} ${(cuspH * 0.32).toFixed(2)}, ${mapX(stemOuterX * 0.72).toFixed(2)} 0.00, ${mapX(stemOuterX * 0.42).toFixed(2)} 0.00`,
            `C ${mapX(stemOuterX * 0.72).toFixed(2)} 0.00, ${mapX(stemInnerX).toFixed(2)} ${(-cuspH * 0.32).toFixed(2)}, ${mapX(stemInnerX).toFixed(2)} ${(-cuspH * 0.92).toFixed(2)}`,
            // Upper inner stem up to top inner hook
            `L ${mapX(stemInnerX).toFixed(2)} ${(topY + hookH).toFixed(2)}`,
            // Top inner hook curve out to top tip
            `C ${mapX(stemInnerX).toFixed(2)} ${(topY + hookH * 0.45).toFixed(2)}, ${mapX(stemInnerX + (W - stemInnerX) * 0.35).toFixed(2)} ${(topY + tipThick * 1.1).toFixed(2)}, ${mapX(W).toFixed(2)} ${(topY + tipThick).toFixed(2)}`,
            `Z`
        ].join(' ');

        return {
            pathData: d,
            rawPoints: new Float32Array(0),
            metrics: {
                bearingX: 0,
                minX: 0,
                maxX: W,
                minY: -halfH,
                maxY: halfH,
                advanceWidth: W,
                ascent: halfH,
                descent: -halfH
            }
        };
    }
}
