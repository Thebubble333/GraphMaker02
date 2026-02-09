
export interface Point2D {
    x: number;
    y: number;
}

export interface BezierControlNode {
    index: number;
    inHandle: Point2D;
    anchor: Point2D;
    outHandle: Point2D;
    // Helper booleans to know if handles are collapsed
    hasInHandle: boolean;
    hasOutHandle: boolean;
}

/**
 * Parses the raw Float32Array from SurdGenerator into structured objects.
 * Useful for debugging overlays, canvas rendering of controls, or regression testing.
 */
export class SurdDiagnostics {
    static getControlNodes(points: Float32Array, numNodes: number = 16): BezierControlNode[] {
        const nodes: BezierControlNode[] = [];
        
        for (let i = 0; i < numNodes; i++) {
            // Data Structure: [InX, InY, AncX, AncY, OutX, OutY] per node
            const baseIdx = i * 3;
            
            const inX = points[(baseIdx + 0) * 2];
            const inY = points[(baseIdx + 0) * 2 + 1];
            
            const ancX = points[(baseIdx + 1) * 2];
            const ancY = points[(baseIdx + 1) * 2 + 1];
            
            const outX = points[(baseIdx + 2) * 2];
            const outY = points[(baseIdx + 2) * 2 + 1];

            nodes.push({
                index: i,
                inHandle: { x: inX, y: inY },
                anchor: { x: ancX, y: ancY },
                outHandle: { x: outX, y: outY },
                hasInHandle: inX !== ancX || inY !== ancY,
                hasOutHandle: outX !== ancX || outY !== ancY
            });
        }

        return nodes;
    }
}
