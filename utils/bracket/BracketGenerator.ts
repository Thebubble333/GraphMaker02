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
    private readonly BASE_HEIGHT: number;
    
    // The flat data array: [ h_in_x, h_in_y, anchor_x, anchor_y, h_out_x, h_out_y, ... ]
    private readonly basePoints: Float32Array;

    constructor() {
        // -----------------------------------------------------------------------
        // 2. DATA INITIALIZATION (Top Cap Only)
        // -----------------------------------------------------------------------
        // This is the absolute minimum size bracket with a spine length of 0.
        const rawTopNodes = [
            // h_in_x, h_in_y, anchor_x, anchor_y, h_out_x, h_out_y
            [-1.64, 0.00,  -1.64, 0.00,  -1.62, 7.05],  // Node 0: Inner Spine
            [-0.82, 12.87,  2.68, 17.77,  2.75, 17.85], // Node 1: Inner Curve
            [2.75, 17.87,   2.75, 17.90,  2.75, 17.99], // Node 2: Tip
            [2.68, 17.99,   2.52, 17.99,  2.36, 17.99], // Node 3: Tip
            [2.34, 17.99,   2.32, 17.97,  2.28, 17.94], // Node 4: Tip
            [1.02, 16.48,   0.00, 14.47, -1.31, 11.84], // Node 5: Outer Curve
            [-2.14, 8.80,  -2.50, 5.17,  -2.54, 4.85],  // Node 6: Outer Curve
            [-2.75, 2.77,  -2.75, 0.00,  -2.75, 0.00]   // Node 7: Outer Spine
        ];

        const targetWidthScale = 1.3;
        const spineCenterX = -2.2;
        
        // 1. Apply Width Scaling
        const scaledTop: number[][] = [];
        for (const node of rawTopNodes) {
            const scaledNode: number[] = [];
            for (let i = 0; i < 3; i++) {
                const x = node[i * 2];
                const y = node[i * 2 + 1];
                const newX = spineCenterX + (x - spineCenterX) * targetWidthScale;
                scaledNode.push(newX, y);
            }
            scaledTop.push(scaledNode);
        }

        // 2. Mathematical Reflection for Bottom Half
        const bottomCap: number[][] = [];
        for (let i = scaledTop.length - 1; i >= 0; i--) {
            const node = scaledTop[i];
            bottomCap.push([
                node[4], -node[5], // Swapped h_in and h_out to maintain drawing direction
                node[2], -node[3], // Anchor
                node[0], -node[1]  
            ]);
        }

        const fullNodes = [...scaledTop, ...bottomCap];
        
        // 3. Flatten to Float32Array for V8 Engine optimization
        const flatArray: number[] = [];
        for (const node of fullNodes) {
            flatArray.push(...node);
        }
        
        this.basePoints = new Float32Array(flatArray);
        
        // Node 2/3 have the highest Y value (17.99). Total base height is roughly 36.
        this.BASE_HEIGHT = 17.99 * 2; 
    }

    // =========================================================================
    // 4. MAIN GENERATOR FUNCTION
    // =========================================================================
    public generatePath(targetHeight: number, isLeft: boolean = true): BracketResult {
        const points = new Float32Array(this.basePoints);
        const numNodes = points.length / 6;

        // --- A. SOLVER LOGIC ---
        // Calculate how much "spine" we need to inject. 
        // If targetHeight is smaller than BASE_HEIGHT, we default to 0 spine.
        let spineLength = targetHeight - this.BASE_HEIGHT;
        if (spineLength < 0) {
            spineLength = 0;
        }

        const halfSpine = spineLength / 2.0;
        const xMultiplier = isLeft ? -1 : 1; // Flip X if it's a left bracket (since base is right-pointing '}')

        // --- B. GEOMETRY TRANSFORMATION ---
        let minX = Infinity, maxX = -Infinity;
        let minY = Infinity, maxY = -Infinity;

        for (let idx = 0; idx < numNodes; idx++) {
            // First 8 nodes move UP, last 8 nodes move DOWN
            const isTopHalf = idx < (numNodes / 2);
            const offsetY = isTopHalf ? halfSpine : -halfSpine;

            for (let k = 0; k < 3; k++) {
                const pIdx = (idx * 6) + (k * 2);
                
                // Read
                const x = points[pIdx];
                const y = points[pIdx + 1];
                
                // Write Transformed
                const newX = x * xMultiplier;
                const newY = y + offsetY;
                points[pIdx] = newX;
                points[pIdx + 1] = newY;

                // Update Metrics
                if (newX < minX) minX = newX;
                if (newX > maxX) maxX = newX;
                if (newY < minY) minY = newY;
                if (newY > maxY) maxY = newY;
            }
        }

        // --- C. SVG STRING GENERATION ---
        let d = "";
        for (let i = 0; i < numNodes; i++) {
            const currAncIdx = (i * 6) + 2;
            const ancX = points[currAncIdx];
            const ancY = points[currAncIdx + 1];

            if (i === 0) {
                // Initial MoveTo
                d += `M ${ancX.toFixed(2)} ${ancY.toFixed(2)} `;
            } else {
                // Bezier CurveTo
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
}
