import { v4 as uuidv4 } from 'uuid';

export interface NetworkNode {
    id: string;
    x: number;
    y: number;
    label: string;
    radius: number;
    labelStyle: 'none' | 'inside' | 'outside';
    labelOffset: { x: number; y: number };
}

export interface NetworkEdge {
    id: string;
    from: string;
    to: string;
    label: string;
    weight?: number;
    isDirected: boolean;
    isDummy: boolean;
    isCurve: boolean;
    cp1?: { x: number; y: number };
    labelOffset?: { x: number; y: number };
    isLoop?: boolean;
    loopRadiusY?: number;
}

export interface NetworkCutNode {
    id: string;
    x: number;
    y: number;
    cp1x: number;
    cp1y: number;
    cp2x: number;
    cp2y: number;
}

export interface NetworkCut {
    id: string;
    label: string;
    nodes: NetworkCutNode[];
    labelOffset?: { x: number; y: number };
}

export type NetworkMode =
    | 'select'
    | 'addNode'
    | 'addEdge'
    | 'addDirectedEdge'
    | 'addDummyEdge'
    | 'addLoop'
    | 'addCut';

export type VertexDisplayStyle = 'none' | 'outside' | 'inside';

export interface MatrixPreset {
    name: string;
    directed: boolean;
    value: string;
    positions: { x: number; y: number }[];
}

export interface PrecedencePreset {
    category: string;
    name: string;
    value: string;
}

export const MATRIX_PRESETS: MatrixPreset[] = [
    // --- 4 NODES ---
    {
        name: '4 Nodes: Complete Graph K4 (Planar)',
        directed: false,
        value: '0 4 6 2\n4 0 5 3\n6 5 0 7\n2 3 7 0',
        positions: [
            { x: 400, y: 140 },
            { x: 220, y: 460 },
            { x: 580, y: 460 },
            { x: 400, y: 330 }
        ]
    },
    {
        name: '4 Nodes: Directed Cycle & Cross (Diamond)',
        directed: true,
        value: '0 4 0 0\n0 0 7 0\n0 0 0 3\n6 0 0 0',
        positions: [
            { x: 400, y: 160 },
            { x: 570, y: 300 },
            { x: 400, y: 440 },
            { x: 230, y: 300 }
        ]
    },

    // --- 5 NODES ---
    {
        name: '5 Nodes: Wheel Graph W5 (Planar)',
        directed: false,
        value: '0 3 0 5 4\n3 0 6 0 7\n0 6 0 2 8\n5 0 2 0 3\n4 7 8 3 0',
        positions: [
            { x: 260, y: 170 },
            { x: 540, y: 170 },
            { x: 540, y: 430 },
            { x: 260, y: 430 },
            { x: 400, y: 300 }
        ]
    },
    {
        name: '5 Nodes: Planar Bipartite K2,3',
        directed: false,
        value: '0 0 3 4 2\n0 0 5 1 6\n3 5 0 0 0\n4 1 0 0 0\n2 6 0 0 0',
        positions: [
            { x: 400, y: 150 },
            { x: 400, y: 450 },
            { x: 240, y: 300 },
            { x: 400, y: 300 },
            { x: 560, y: 300 }
        ]
    },
    {
        name: '5 Nodes: House Graph (Planar)',
        directed: false,
        value: '0 5 4 0 0\n5 0 3 6 0\n4 3 0 0 7\n0 6 0 0 2\n0 0 7 2 0',
        positions: [
            { x: 400, y: 140 },
            { x: 280, y: 260 },
            { x: 520, y: 260 },
            { x: 280, y: 440 },
            { x: 520, y: 440 }
        ]
    },

    // --- 6 NODES ---
    {
        name: '6 Nodes: Weighted Grid Graph 2×3',
        directed: false,
        value: '0 4 0 5 0 0\n4 0 3 0 7 0\n0 3 0 0 0 6\n5 0 0 0 2 0\n0 7 0 2 0 8\n0 0 6 0 8 0',
        positions: [
            { x: 260, y: 190 },
            { x: 400, y: 190 },
            { x: 540, y: 190 },
            { x: 260, y: 410 },
            { x: 400, y: 410 },
            { x: 540, y: 410 }
        ]
    },
    {
        name: '6 Nodes: Wheel Graph W6 (Planar)',
        directed: false,
        value: '0 3 0 0 4 6\n3 0 4 0 0 8\n0 4 0 2 0 7\n0 0 2 0 5 5\n4 0 0 5 0 9\n6 8 7 5 9 0',
        positions: [
            { x: 400, y: 125 },
            { x: 566, y: 246 },
            { x: 503, y: 440 },
            { x: 297, y: 440 },
            { x: 234, y: 246 },
            { x: 400, y: 300 }
        ]
    },
    {
        name: '6 Nodes: Triangular Prism Y3 (Planar)',
        directed: false,
        value: '0 5 4 8 0 0\n5 0 6 0 5 0\n4 6 0 0 0 6\n8 0 0 0 3 7\n0 5 0 3 0 2\n0 0 6 7 2 0',
        positions: [
            { x: 400, y: 110 },
            { x: 190, y: 470 },
            { x: 610, y: 470 },
            { x: 400, y: 240 },
            { x: 290, y: 410 },
            { x: 510, y: 410 }
        ]
    },
    {
        name: '6 Nodes: Directed Flow Network (DAG)',
        directed: true,
        value: '0 10 6 0 0 0\n0 0 0 8 3 0\n0 0 0 0 7 0\n0 0 0 0 0 9\n0 0 0 0 0 5\n0 0 0 0 0 0',
        positions: [
            { x: 170, y: 300 },
            { x: 320, y: 190 },
            { x: 320, y: 410 },
            { x: 480, y: 190 },
            { x: 480, y: 410 },
            { x: 630, y: 300 }
        ]
    },

    // --- 7 NODES ---
    {
        name: '7 Nodes: Weighted Binary Tree',
        directed: false,
        value: '0 8 12 0 0 0 0\n8 0 0 4 6 0 0\n12 0 0 0 0 5 9\n0 4 0 0 0 0 0\n0 6 0 0 0 0 0\n0 0 5 0 0 0 0\n0 0 9 0 0 0 0',
        positions: [
            { x: 400, y: 130 },
            { x: 270, y: 270 },
            { x: 530, y: 270 },
            { x: 200, y: 430 },
            { x: 340, y: 430 },
            { x: 460, y: 430 },
            { x: 600, y: 430 }
        ]
    },
    {
        name: '7 Nodes: Wheel Graph W7 (Planar)',
        directed: false,
        value: '0 3 0 0 0 5 6\n3 0 4 0 0 0 7\n0 4 0 2 0 0 8\n0 0 2 0 6 0 5\n0 0 0 6 0 4 9\n5 0 0 0 4 0 7\n6 7 8 5 9 7 0',
        positions: [
            { x: 400, y: 120 },
            { x: 556, y: 210 },
            { x: 556, y: 390 },
            { x: 400, y: 480 },
            { x: 244, y: 390 },
            { x: 244, y: 210 },
            { x: 400, y: 300 }
        ]
    },

    // --- 8 NODES ---
    {
        name: '8 Nodes: Planar Cube Graph Q3 (Concentric)',
        directed: false,
        value: '0 4 0 7 3 0 0 0\n4 0 5 0 0 6 0 0\n0 5 0 2 0 0 8 0\n7 0 2 0 0 0 0 5\n3 0 0 0 0 4 0 6\n0 6 0 0 4 0 5 0\n0 0 8 0 0 5 0 3\n0 0 0 5 6 0 3 0',
        positions: [
            { x: 200, y: 130 },
            { x: 600, y: 130 },
            { x: 600, y: 470 },
            { x: 200, y: 470 },
            { x: 320, y: 220 },
            { x: 480, y: 220 },
            { x: 480, y: 380 },
            { x: 320, y: 380 }
        ]
    },
    {
        name: '8 Nodes: Grid Graph 2×4',
        directed: false,
        value: '0 3 0 0 5 0 0 0\n3 0 4 0 0 6 0 0\n0 4 0 2 0 0 7 0\n0 0 2 0 0 0 0 4\n5 0 0 0 0 3 0 0\n0 6 0 0 3 0 5 0\n0 0 7 0 0 5 0 2\n0 0 0 4 0 0 2 0',
        positions: [
            { x: 190, y: 190 },
            { x: 330, y: 190 },
            { x: 470, y: 190 },
            { x: 610, y: 190 },
            { x: 190, y: 410 },
            { x: 330, y: 410 },
            { x: 470, y: 410 },
            { x: 610, y: 410 }
        ]
    },

    // --- 9 NODES ---
    {
        name: '9 Nodes: Square Grid Graph 3×3',
        directed: false,
        value: '0 4 0 5 0 0 0 0 0\n4 0 3 0 6 0 0 0 0\n0 3 0 0 0 7 0 0 0\n5 0 0 0 2 0 8 0 0\n0 6 0 2 0 4 0 5 0\n0 0 7 0 4 0 0 0 9\n0 0 0 8 0 0 0 3 0\n0 0 0 0 5 0 3 0 6\n0 0 0 0 0 9 0 6 0',
        positions: [
            { x: 240, y: 160 },
            { x: 400, y: 160 },
            { x: 560, y: 160 },
            { x: 240, y: 300 },
            { x: 400, y: 300 },
            { x: 560, y: 300 },
            { x: 240, y: 440 },
            { x: 400, y: 440 },
            { x: 560, y: 440 }
        ]
    },

    // --- 10 NODES ---
    {
        name: '10 Nodes: Pentagonal Prism Graph (Planar)',
        directed: false,
        value: '0 4 0 0 6 5 0 0 0 0\n4 0 5 0 0 0 7 0 0 0\n0 5 0 3 0 0 0 4 0 0\n0 0 3 0 8 0 0 0 6 0\n6 0 0 8 0 0 0 0 0 3\n5 0 0 0 0 0 2 0 0 5\n0 7 0 0 0 2 0 4 0 0\n0 0 4 0 0 0 4 0 3 0\n0 0 0 6 0 0 0 3 0 7\n0 0 0 0 3 5 0 0 7 0',
        positions: [
            { x: 400, y: 90 },
            { x: 600, y: 235 },
            { x: 524, y: 470 },
            { x: 276, y: 470 },
            { x: 200, y: 235 },
            { x: 400, y: 195 },
            { x: 500, y: 268 },
            { x: 462, y: 385 },
            { x: 338, y: 385 },
            { x: 300, y: 268 }
        ]
    },
    {
        name: '10 Nodes: Grid Graph 2×5',
        directed: false,
        value: '0 3 0 0 0 6 0 0 0 0\n3 0 4 0 0 0 5 0 0 0\n0 4 0 2 0 0 0 7 0 0\n0 0 2 0 5 0 0 0 4 0\n0 0 0 5 0 0 0 0 0 8\n6 0 0 0 0 0 3 0 0 0\n0 5 0 0 0 3 0 6 0 0\n0 0 7 0 0 0 6 0 2 0\n0 0 0 4 0 0 0 2 0 5\n0 0 0 0 8 0 0 0 5 0',
        positions: [
            { x: 160, y: 190 },
            { x: 280, y: 190 },
            { x: 400, y: 190 },
            { x: 520, y: 190 },
            { x: 640, y: 190 },
            { x: 160, y: 410 },
            { x: 280, y: 410 },
            { x: 400, y: 410 },
            { x: 520, y: 410 },
            { x: 640, y: 410 }
        ]
    },
    {
        name: '10 Nodes: Multi-Stage Directed Flow Network (DAG)',
        directed: true,
        value: '0 8 10 0 0 0 0 0 0 0\n0 0 0 6 4 0 0 0 0 0\n0 0 0 0 5 7 0 0 0 0\n0 0 0 0 0 0 0 9 0 0\n0 0 0 0 0 0 0 3 6 0\n0 0 0 0 0 0 0 0 5 0\n0 0 0 0 0 0 0 0 4 0\n0 0 0 0 0 0 0 0 0 11\n0 0 0 0 0 0 0 0 0 12\n0 0 0 0 0 0 0 0 0 0',
        positions: [
            { x: 140, y: 300 },
            { x: 270, y: 200 },
            { x: 270, y: 400 },
            { x: 400, y: 130 },
            { x: 400, y: 245 },
            { x: 400, y: 355 },
            { x: 400, y: 470 },
            { x: 530, y: 200 },
            { x: 530, y: 400 },
            { x: 660, y: 300 }
        ]
    },

    // --- 12 NODES ---
    {
        name: '12 Nodes: Hexagonal Prism Graph (Concentric Planar)',
        directed: false,
        value: '0 4 0 0 0 5 6 0 0 0 0 0\n4 0 3 0 0 0 0 7 0 0 0 0\n0 3 0 6 0 0 0 0 5 0 0 0\n0 0 6 0 4 0 0 0 0 8 0 0\n0 0 0 4 0 2 0 0 0 0 6 0\n5 0 0 0 2 0 0 0 0 0 0 4\n6 0 0 0 0 0 0 3 0 0 0 5\n0 7 0 0 0 0 3 0 4 0 0 0\n0 0 5 0 0 0 0 4 0 2 0 0\n0 0 0 8 0 0 0 0 2 0 6 0\n0 0 0 0 6 0 0 0 0 6 0 3\n0 0 0 0 0 4 5 0 0 0 3 0',
        positions: [
            { x: 400, y: 90 },
            { x: 582, y: 195 },
            { x: 582, y: 405 },
            { x: 400, y: 510 },
            { x: 218, y: 405 },
            { x: 218, y: 195 },
            { x: 400, y: 195 },
            { x: 491, y: 248 },
            { x: 491, y: 353 },
            { x: 400, y: 405 },
            { x: 309, y: 353 },
            { x: 309, y: 248 }
        ]
    },
    {
        name: '12 Nodes: Planar Grid Graph 3×4',
        directed: false,
        value: '0 3 0 0 5 0 0 0 0 0 0 0\n3 0 4 0 0 6 0 0 0 0 0 0\n0 4 0 2 0 0 7 0 0 0 0 0\n0 0 2 0 0 0 0 4 0 0 0 0\n5 0 0 0 0 3 0 0 6 0 0 0\n0 6 0 0 3 0 5 0 0 4 0 0\n0 0 7 0 0 5 0 2 0 0 5 0\n0 0 0 4 0 0 2 0 0 0 0 3\n0 0 0 0 6 0 0 0 0 2 0 0\n0 0 0 0 0 4 0 0 2 0 6 0\n0 0 0 0 0 0 5 0 0 6 0 4\n0 0 0 0 0 0 0 3 0 0 4 0',
        positions: [
            { x: 190, y: 160 },
            { x: 330, y: 160 },
            { x: 470, y: 160 },
            { x: 610, y: 160 },
            { x: 190, y: 300 },
            { x: 330, y: 300 },
            { x: 470, y: 300 },
            { x: 610, y: 300 },
            { x: 190, y: 440 },
            { x: 330, y: 440 },
            { x: 470, y: 440 },
            { x: 610, y: 440 }
        ]
    },
    {
        name: '12 Nodes: Double-Hexagon Honeycomb (Fused Rings)',
        directed: false,
        value: '0 4 0 0 5 6 0 0 0 0 0 0\n4 0 3 0 0 0 0 0 0 0 0 0\n0 3 0 6 0 0 7 0 0 0 0 0\n0 0 6 0 0 0 0 0 0 0 0 4\n5 0 0 0 0 0 0 5 0 0 0 0\n6 0 0 0 0 0 8 0 0 0 0 0\n0 0 7 0 0 8 0 0 0 0 6 0\n0 0 0 0 5 0 0 0 4 0 0 0\n0 0 0 0 0 0 0 4 0 3 0 0\n0 0 0 0 0 0 0 0 3 0 5 0\n0 0 0 0 0 0 6 0 0 5 0 4\n0 0 0 4 0 0 0 0 0 0 4 0',
        positions: [
            { x: 260, y: 160 },
            { x: 160, y: 230 },
            { x: 160, y: 370 },
            { x: 260, y: 440 },
            { x: 400, y: 110 },
            { x: 400, y: 230 },
            { x: 400, y: 370 },
            { x: 540, y: 160 },
            { x: 640, y: 230 },
            { x: 640, y: 370 },
            { x: 540, y: 440 },
            { x: 400, y: 490 }
        ]
    },
    {
        name: '12 Nodes: Complex Directed Pipeline Network (DAG)',
        directed: true,
        value: '0 6 9 7 0 0 0 0 0 0 0 0\n0 0 0 0 4 5 0 0 0 0 0 0\n0 0 0 0 0 6 7 0 0 0 0 0\n0 0 0 0 0 0 5 8 0 0 0 0\n0 0 0 0 0 0 0 0 6 0 0 0\n0 0 0 0 0 0 0 0 5 4 0 0\n0 0 0 0 0 0 0 0 0 7 5 0\n0 0 0 0 0 0 0 0 0 0 6 0\n0 0 0 0 0 0 0 0 0 0 0 10\n0 0 0 0 0 0 0 0 0 0 0 8\n0 0 0 0 0 0 0 0 0 0 0 12\n0 0 0 0 0 0 0 0 0 0 0 0',
        positions: [
            { x: 120, y: 300 },
            { x: 250, y: 180 },
            { x: 250, y: 300 },
            { x: 250, y: 420 },
            { x: 390, y: 120 },
            { x: 390, y: 240 },
            { x: 390, y: 360 },
            { x: 390, y: 480 },
            { x: 530, y: 180 },
            { x: 530, y: 300 },
            { x: 530, y: 420 },
            { x: 660, y: 300 }
        ]
    }
];

export const PRECEDENCE_PRESETS: PrecedencePreset[] = [
    // --- 1. 3–4 ACTIVITIES ---
    {
        category: '1. 3–4 Activities',
        name: '3 Activities: Linear Chain (A → B → C)',
        value: 'A, -, 4\nB, A, 3\nC, B, 5'
    },
    {
        category: '1. 3–4 Activities',
        name: '3 Activities: 1 to 2 Split (A → B, C)',
        value: 'A, -, 3\nB, A, 5\nC, A, 4'
    },
    {
        category: '1. 3–4 Activities',
        name: '3 Activities: 2 to 1 Join (A, B → C)',
        value: 'A, -, 5\nB, -, 4\nC, A;B, 6'
    },
    {
        category: '1. 3–4 Activities',
        name: '4 Activities: Diamond (Split & Join)',
        value: 'A, -, 4\nB, A, 5\nC, A, 3\nD, B;C, 6'
    },
    {
        category: '1. 3–4 Activities',
        name: '4 Activities: Dual Start Converging (A → C; B, C → D)',
        value: 'A, -, 6\nB, -, 4\nC, A, 5\nD, B;C, 3'
    },
    {
        category: '1. 3–4 Activities',
        name: '4 Activities: Single Dummy Arc (A → C, D; B → D)',
        value: 'A, -, 4\nB, -, 5\nC, A, 3\nD, A;B, 6'
    },
    {
        category: '1. 3–4 Activities',
        name: '4 Activities: Chain with Bypass (A → B, C; B → C; C → D)',
        value: 'A, -, 3\nB, A, 4\nC, A;B, 5\nD, C, 2'
    },

    // --- 2. 5–6 ACTIVITIES ---
    {
        category: '2. 5–6 Activities',
        name: '5 Activities: Standard Dummy Arc (A, B → D; A → C)',
        value: 'A, -, 4\nB, -, 6\nC, A, 3\nD, A;B, 5\nE, C;D, 4'
    },
    {
        category: '2. 5–6 Activities',
        name: '5 Activities: 1 to 3 Branch & Merge (A → B, C, D → E)',
        value: 'A, -, 3\nB, A, 4\nC, A, 6\nD, A, 2\nE, B;C;D, 5'
    },
    {
        category: '2. 5–6 Activities',
        name: '5 Activities: Two-Stage Ladder (A, B → C, D → E)',
        value: 'A, -, 5\nB, -, 3\nC, A, 4\nD, B, 6\nE, C;D, 5'
    },
    {
        category: '2. 5–6 Activities',
        name: '5 Activities: Parallel Disambiguation (A, B → C, D → E)',
        value: 'A, -, 5\nB, -, 7\nC, A;B, 4\nD, A;B, 6\nE, C;D, 3'
    },
    {
        category: '2. 5–6 Activities',
        name: '6 Activities: Symmetric Double Dummy (A, B → C, D, E → F)',
        value: 'A, -, 4\nB, -, 5\nC, A, 3\nD, A;B, 6\nE, B, 2\nF, C;D;E, 4'
    },
    {
        category: '2. 5–6 Activities',
        name: '6 Activities: Double Diamond Cascade (A → B, C → D → E, F)',
        value: 'A, -, 3\nB, A, 4\nC, A, 5\nD, B;C, 6\nE, D, 3\nF, D, 4'
    },
    {
        category: '2. 5–6 Activities',
        name: '6 Activities: 3 Starts Converging (A, B, C → D, E → F)',
        value: 'A, -, 3\nB, -, 4\nC, -, 2\nD, A;B, 5\nE, B;C, 6\nF, D;E, 4'
    },
    {
        category: '2. 5–6 Activities',
        name: '6 Activities: Staggered Cross-Dependencies',
        value: 'A, -, 4\nB, -, 5\nC, A, 6\nD, A;B, 3\nE, C, 4\nF, D;E, 5'
    },

    // --- 3. 7–8 ACTIVITIES ---
    {
        category: '3. 7–8 Activities',
        name: '7 Activities: Tripartite Staggered Feed',
        value: 'A, -, 3\nB, -, 5\nC, -, 4\nD, A;B, 6\nE, B;C, 4\nF, D, 5\nG, E;F, 3'
    },
    {
        category: '3. 7–8 Activities',
        name: '7 Activities: Multi-Tier Branching',
        value: 'A, -, 4\nB, A, 3\nC, A, 6\nD, B, 5\nE, B, 2\nF, C;D;E, 7\nG, F, 4'
    },
    {
        category: '3. 7–8 Activities',
        name: '7 Activities: Dual Dummy Cross-Feed',
        value: 'A, -, 5\nB, -, 4\nC, A, 3\nD, A;B, 6\nE, B, 5\nF, C;D, 4\nG, D;E, 6'
    },
    {
        category: '3. 7–8 Activities',
        name: '8 Activities: Double Dummy Multi-Merge',
        value: 'A, -, 4\nB, -, 3\nC, A, 6\nD, A;B, 2\nE, B, 5\nF, C;D, 4\nG, D;E, 7\nH, F;G, 3'
    },
    {
        category: '3. 7–8 Activities',
        name: '8 Activities: 4-Layer Staggered Network',
        value: 'A, -, 5\nB, -, 7\nC, A, 3\nD, A, 6\nE, B;C, 4\nF, D;E, 8\nG, E, 5\nH, F;G, 2'
    },
    {
        category: '3. 7–8 Activities',
        name: '8 Activities: Triple Start with Cross-Paths',
        value: 'A, -, 3\nB, -, 4\nC, -, 5\nD, A, 6\nE, A;B, 4\nF, B;C, 5\nG, C, 3\nH, D;E;F;G, 7'
    },

    // --- 4. 9–10 ACTIVITIES ---
    {
        category: '4. 9–10 Activities',
        name: '9 Activities: 4-Stage Multi-Branch Network',
        value: 'A, -, 3\nB, -, 4\nC, A, 5\nD, B, 6\nE, A;B, 2\nF, C;E, 7\nG, D;E, 4\nH, F, 3\nI, G;H, 5'
    },
    {
        category: '4. 9–10 Activities',
        name: '9 Activities: Dual Parallel Paths with Mid-Bridges',
        value: 'A, -, 4\nB, -, 5\nC, A, 3\nD, A, 6\nE, B, 4\nF, C;E, 5\nG, D, 7\nH, E, 3\nI, F;G;H, 6'
    },
    {
        category: '4. 9–10 Activities',
        name: '10 Activities: 5-Stage Interleaved Dependencies',
        value: 'A, -, 4\nB, -, 3\nC, A, 5\nD, A;B, 6\nE, B, 4\nF, C;D, 3\nG, D;E, 5\nH, F, 6\nI, F;G, 4\nJ, H;I, 2'
    },
    {
        category: '4. 9–10 Activities',
        name: '10 Activities: Triple Split with Hierarchical Merge',
        value: 'A, -, 5\nB, A, 4\nC, A, 6\nD, A, 3\nE, B;C, 7\nF, C;D, 5\nG, E, 4\nH, E;F, 6\nI, F, 3\nJ, G;H;I, 5'
    },

    // --- 5. 11–12 ACTIVITIES ---
    {
        category: '5. 11–12 Activities',
        name: '11 Activities: Multi-Stage Staggered Network',
        value: 'A, -, 2\nB, -, 4\nC, -, 3\nD, A, 5\nE, A;B, 4\nF, B;C, 6\nG, D;E, 3\nH, E;F, 5\nI, G, 4\nJ, H, 2\nK, I;J, 3'
    },
    {
        category: '5. 11–12 Activities',
        name: '12 Activities: Comprehensive 5-Layer Network',
        value: 'A, -, 3\nB, -, 4\nC, -, 5\nD, A, 6\nE, A;B, 3\nF, B;C, 5\nG, C, 4\nH, D;E, 7\nI, E;F, 4\nJ, F;G, 6\nK, H;I, 3\nL, I;J;K, 5'
    }
];

export const optimizeLabelPlacements = (
    currentNodes: NetworkNode[],
    currentEdges: NetworkEdge[],
    globalEdgeLabelProximity: number,
    globalVertexLabelProximity: number,
    edgeLabelClearanceRatio: number,
    globalVertexStyle: string,
    globalNodeRadius: number,
    mode: 'all' | 'vertex' | 'edge' = 'all'
): { nodes: NetworkNode[]; edges: NetworkEdge[] } => {
    const distToSegment = (px: number, py: number, x1: number, y1: number, x2: number, y2: number) => {
        const l2 = (x2 - x1) ** 2 + (y2 - y1) ** 2;
        if (l2 === 0) return { dist: Math.hypot(px - x1, py - y1), projX: x1, projY: y1 };
        let t = ((px - x1) * (x2 - x1) + (py - y1) * (y2 - y1)) / l2;
        t = Math.max(0, Math.min(1, t));
        const projX = x1 + t * (x2 - x1);
        const projY = y1 + t * (y2 - y1);
        return { dist: Math.hypot(px - projX, py - projY), projX, projY };
    };

    const distPointToRect = (px: number, py: number, cx: number, cy: number, w: number, h: number) => {
        const dx = Math.max(Math.abs(px - cx) - w / 2, 0);
        const dy = Math.max(Math.abs(py - cy) - h / 2, 0);
        return Math.hypot(dx, dy);
    };

    let sumX = 0;
    let sumY = 0;
    let count = 0;
    currentNodes.forEach(n => {
        sumX += n.x;
        sumY += n.y;
        count++;
    });
    const cmX = count > 0 ? sumX / count : 0;
    const cmY = count > 0 ? sumY / count : 0;

    // 1. Vertex Labels FIRST (so edge labels can avoid them)
    const getAngleDiff = (t1: number, t2: number) => {
        let diff = Math.abs(t1 - t2);
        while (diff > Math.PI * 2) diff -= Math.PI * 2;
        if (diff > Math.PI) diff = Math.PI * 2 - diff;
        return diff;
    };

    let resNodes = [...currentNodes];
    if (mode === 'all' || mode === 'vertex') {
        const simNodes = currentNodes.map(n => {
            let baseDx = n.labelOffset?.x;
            let baseDy = n.labelOffset?.y;
            if (baseDx === undefined || baseDy === undefined) {
                baseDx = globalVertexLabelProximity * 0.707;
                baseDy = -globalVertexLabelProximity * 0.707;
            }
            if (baseDx === 0 && baseDy === 0) baseDy = -1;

            const r = globalVertexLabelProximity;
            const theta = Math.atan2(baseDy, baseDx);

            const incidentAngles: number[] = [];
            currentEdges.forEach(e => {
                if (e.from === n.id && e.to === n.id) {
                    const cpY = e.cp1 ? e.cp1.y : n.y - 60;
                    const cpX = e.cp1 ? e.cp1.x : n.x;
                    incidentAngles.push(Math.atan2(cpY - n.y, cpX - n.x));
                } else if (e.from === n.id) {
                    const tn = currentNodes.find(t => t.id === e.to);
                    if (tn) incidentAngles.push(Math.atan2(tn.y - n.y, tn.x - n.x));
                } else if (e.to === n.id) {
                    const fn = currentNodes.find(f => f.id === e.from);
                    if (fn) incidentAngles.push(Math.atan2(fn.y - n.y, fn.x - n.x));
                }
            });

            return {
                id: n.id,
                r,
                theta,
                incidentAngles,
                active: globalVertexStyle === 'outside' && Boolean(n.label)
            };
        });

        simNodes.forEach(l => {
            if (!l.active) return;

            const evaluateCost = (candTheta: number) => {
                let cost = 0;
                l.incidentAngles.forEach(phi => {
                    const diff = getAngleDiff(candTheta, phi);
                    cost += 1.0 / (diff + 0.1);
                });
                const selfNode = currentNodes.find(n => n.id === l.id)!;
                currentNodes.forEach(otherN => {
                    if (otherN.id === l.id) return;
                    const phi = Math.atan2(otherN.y - selfNode.y, otherN.x - selfNode.x);
                    const diff = getAngleDiff(candTheta, phi);
                    cost += 0.2 / (diff + 0.1);
                });
                cost -= (Math.sin(candTheta) < 0 ? 0.05 : 0) + (Math.cos(candTheta) > 0 ? 0.02 : 0);
                return cost;
            };

            let bestTheta = l.theta;
            let minCost = Infinity;

            for (let i = 0; i < 36; i++) {
                const candTheta = (i / 36) * 2 * Math.PI - Math.PI;
                const cost = evaluateCost(candTheta);
                if (cost < minCost - 0.0001) {
                    minCost = cost;
                    bestTheta = candTheta;
                }
            }

            let searchRange = Math.PI / 18;
            for (let step = 0; step < 3; step++) {
                let stepBestTheta = bestTheta;
                let stepMinCost = minCost;

                for (let i = 0; i <= 10; i++) {
                    const candTheta = bestTheta - searchRange + (i / 10) * 2 * searchRange;
                    const cost = evaluateCost(candTheta);
                    if (cost < stepMinCost - 0.0001) {
                        stepMinCost = cost;
                        stepBestTheta = candTheta;
                    }
                }
                bestTheta = stepBestTheta;
                minCost = stepMinCost;
                searchRange /= 5;
            }

            l.theta = bestTheta;
        });

        resNodes = currentNodes.map(n => {
            const sim = simNodes.find(s => s.id === n.id);
            if (sim && sim.active) {
                return {
                    ...n,
                    labelOffset: {
                        x: Math.round(Math.cos(sim.theta) * sim.r),
                        y: Math.round(Math.sin(sim.theta) * sim.r)
                    }
                };
            }
            return n;
        });
    }

    // 2. Edge Labels
    const resEdges =
        mode === 'vertex'
            ? currentEdges
            : currentEdges.map(e => {
                  if (!e.label) return e;

                  const fn = resNodes.find(n => n.id === e.from);
                  const tn = resNodes.find(n => n.id === e.to);
                  if (!fn || !tn) return e;

                  let midX = 0;
                  let midY = 0;
                  let dx = 0;
                  let dy = 0;

                  if (e.isLoop) {
                      midX = e.cp1 ? e.cp1.x : fn.x;
                      midY = e.cp1 ? e.cp1.y : fn.y - 60;
                      dx = midX - fn.x;
                      dy = midY - fn.y;
                      const temp = dx;
                      dx = dy;
                      dy = -temp;
                      if (dx === 0 && dy === 0) {
                          dx = 1;
                          dy = 0;
                      }
                  } else if (e.isCurve && e.cp1) {
                      midX = 0.25 * fn.x + 0.5 * e.cp1.x + 0.25 * tn.x;
                      midY = 0.25 * fn.y + 0.5 * e.cp1.y + 0.25 * tn.y;
                      dx = tn.x - fn.x;
                      dy = tn.y - fn.y;
                  } else {
                      midX = (fn.x + tn.x) / 2;
                      midY = (fn.y + tn.y) / 2;
                      dx = tn.x - fn.x;
                      dy = tn.y - fn.y;
                  }

                  const len = Math.hypot(dx, dy) || 1;
                  const tx = dx / len;
                  const ty = dy / len;
                  const nx = -ty;
                  const ny = tx;

                  const dist = globalEdgeLabelProximity;
                  const c1 = { x: nx * dist, y: ny * dist };
                  const c2 = { x: -nx * dist, y: -ny * dist };

                  const d1 = Math.hypot(midX + c1.x - cmX, midY + c1.y - cmY);
                  const d2 = Math.hypot(midX + c2.x - cmX, midY + c2.y - cmY);
                  const pref_N_dir = d1 > d2 ? 1 : -1;

                  const maxT = len * 0.25;
                  let best_t = 0;
                  let best_n = 0;
                  let best_dir = pref_N_dir;
                  let best_score = -Infinity;

                  const checkClearance = (candT: number, candN: number, dir: number) => {
                      const px = midX + candT * tx + candN * dir * nx;
                      const py = midY + candT * ty + candN * dir * ny;

                      let minOtherDist = Infinity;

                      currentEdges.forEach(oe => {
                          if (oe.id === e.id) return;
                          const ofn = resNodes.find(n => n.id === oe.from);
                          const otn = resNodes.find(n => n.id === oe.to);
                          if (ofn && otn) {
                              const d = distToSegment(px, py, ofn.x, ofn.y, otn.x, otn.y).dist;
                              if (d < minOtherDist) minOtherDist = d;
                          }
                      });

                      resNodes.forEach(on => {
                          if (on.id !== e.from && on.id !== e.to) {
                              const d = Math.hypot(on.x - px, on.y - py);
                              const actualRadius = globalNodeRadius || 15;
                              if (d - actualRadius < minOtherDist) {
                                  minOtherDist = Math.max(0, d - actualRadius);
                              }
                          }

                          if (on.label && on.labelOffset) {
                              const vlx = on.x + on.labelOffset.x;
                              const vly = on.y + on.labelOffset.y;
                              const vlw = Math.max(20, on.label.length * 8);
                              const vlh = 16;
                              const d = distPointToRect(px, py, vlx, vly, vlw, vlh);
                              if (d < minOtherDist) minOtherDist = d;
                          }
                      });

                      return minOtherDist >= edgeLabelClearanceRatio * candN;
                  };

                  const dirs = [pref_N_dir, -pref_N_dir];
                  for (let dir_idx = 0; dir_idx < 2; dir_idx++) {
                      const cur_dir = dirs[dir_idx];

                      for (let t_idx = -10; t_idx <= 10; t_idx++) {
                          const candT = (t_idx / 10) * maxT;
                          let lowN = 0;
                          let highN = dist;
                          let maxValidN = 0;

                          if (checkClearance(candT, dist, cur_dir)) {
                              maxValidN = dist;
                          } else {
                              for (let i = 0; i < 6; i++) {
                                  const midN = (lowN + highN) / 2;
                                  if (checkClearance(candT, midN, cur_dir)) {
                                      lowN = midN;
                                      maxValidN = midN;
                                  } else {
                                      highN = midN;
                                  }
                              }
                          }

                          const dir_nx = cur_dir * nx;
                          const dir_ny = cur_dir * ny;
                          let tie_breaker = 0;
                          if (dir_ny < -0.1) tie_breaker += 4;
                          else if (dir_ny > 0.1) tie_breaker += 3;
                          if (dir_nx > 0.1) tie_breaker += 2;
                          else if (dir_nx < -0.1) tie_breaker += 1;

                          const side_penalty = dir_idx === 0 ? 0 : 50;
                          const score = maxValidN * 1000 - Math.abs(candT) * 10 - side_penalty + tie_breaker;

                          if (score > best_score) {
                              best_score = score;
                              best_t = candT;
                              best_n = maxValidN;
                              best_dir = cur_dir;
                          }
                      }
                  }

                  return {
                      ...e,
                      labelOffset: {
                          x: Math.round(best_t * tx + best_n * best_dir * nx - (e.isLoop ? nx * dist : pref_N_dir * nx * dist)),
                          y: Math.round(best_t * ty + best_n * best_dir * ny - (e.isLoop ? ny * dist : pref_N_dir * ny * dist))
                      }
                  };
              });

    return { nodes: resNodes, edges: resEdges };
};

export const generateRegularPolygon = (
    n: number,
    cx: number,
    cy: number,
    vertexStyle: VertexDisplayStyle = 'inside',
    width: number = 378,
    height: number = 302,
    baseRadius: number = 6
): NetworkNode[] => {
    const radius = (Math.min(width, height) / 2) * 0.72;
    return Array.from({ length: n }).map((_, i) => {
        const angle = (i / n) * 2 * Math.PI - Math.PI / 2;
        const x = cx + radius * Math.cos(angle);
        const y = cy + radius * Math.sin(angle);
        const nodeRadius = vertexStyle === 'inside' ? baseRadius * 2.5 : baseRadius;
        return {
            id: uuidv4(),
            x,
            y,
            label: String.fromCharCode(65 + (i % 26)) + (i >= 26 ? Math.floor(i / 26) : ''),
            radius: nodeRadius,
            labelStyle: vertexStyle,
            labelOffset: { x: Math.round(Math.cos(angle) * 18), y: Math.round(Math.sin(angle) * 18) }
        };
    });
};

export const computeNetworkAutoFit = (
    nodes: NetworkNode[],
    edges: NetworkEdge[],
    cuts: NetworkCut[]
): {
    boundedWidth: number;
    boundedHeight: number;
    nodes: NetworkNode[];
    edges: NetworkEdge[];
    cuts: NetworkCut[];
} | null => {
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;

    const points: { x: number; y: number }[] = [];

    nodes.forEach(n => {
        points.push({ x: n.x - n.radius, y: n.y - n.radius });
        points.push({ x: n.x + n.radius, y: n.y + n.radius });
        if (n.labelStyle === 'outside') {
            points.push({ x: n.x + n.labelOffset.x, y: n.y + n.labelOffset.y });
        }
    });

    edges.forEach(e => {
        if (e.cp1) {
            points.push({ x: e.cp1.x, y: e.cp1.y });
        }
    });

    cuts.forEach(c => {
        c.nodes.forEach(cn => {
            points.push({ x: cn.x, y: cn.y });
            points.push({ x: cn.x + cn.cp1x, y: cn.y + cn.cp1y });
            points.push({ x: cn.x + cn.cp2x, y: cn.y + cn.cp2y });
        });
        if (c.nodes.length > 0) {
            const lastNode = c.nodes[c.nodes.length - 1];
            points.push({
                x: lastNode.x + (c.labelOffset?.x || 0),
                y: lastNode.y - 15 + (c.labelOffset?.y || 0)
            });
        }
    });

    if (points.length === 0) return null;

    points.forEach(p => {
        if (p.x < minX) minX = p.x;
        if (p.x > maxX) maxX = p.x;
        if (p.y < minY) minY = p.y;
        if (p.y > maxY) maxY = p.y;
    });

    const PADDING = 40;
    const newWidth = maxX - minX + PADDING * 2;
    const newHeight = maxY - minY + PADDING * 2;

    const boundedWidth = Math.max(100, Math.min(2000, Math.round(newWidth)));
    const boundedHeight = Math.max(100, Math.min(2000, Math.round(newHeight)));

    const shiftX = PADDING - minX;
    const shiftY = PADDING - minY;

    return {
        boundedWidth,
        boundedHeight,
        nodes: nodes.map(n => ({ ...n, x: n.x + shiftX, y: n.y + shiftY })),
        edges: edges.map(e => (e.cp1 ? { ...e, cp1: { x: e.cp1.x + shiftX, y: e.cp1.y + shiftY } } : e)),
        cuts: cuts.map(c => ({
            ...c,
            nodes: c.nodes.map(cn => ({ ...cn, x: cn.x + shiftX, y: cn.y + shiftY }))
        }))
    };
};

export const buildGraphFromMatrix = (params: {
    matrix: number[][];
    labels: string[];
    matrixStr: string;
    isDirected: boolean;
    showWeights: boolean;
    preserveNodePositions: boolean;
    customPositions?: { x: number; y: number }[];
    existingNodes: NetworkNode[];
    canvasWidth: number;
    canvasHeight: number;
    globalVertexStyle: VertexDisplayStyle;
    globalNodeRadius: number;
    globalEdgeLabelProximity: number;
    globalVertexLabelProximity: number;
    edgeLabelClearanceRatio: number;
}): { nodes: NetworkNode[]; edges: NetworkEdge[] } => {
    const {
        matrix,
        labels,
        matrixStr,
        isDirected,
        showWeights,
        preserveNodePositions,
        customPositions,
        existingNodes,
        canvasWidth,
        canvasHeight,
        globalVertexStyle,
        globalNodeRadius,
        globalEdgeLabelProximity,
        globalVertexLabelProximity,
        edgeLabelClearanceRatio
    } = params;

    const n = matrix.length;
    let positions = customPositions;
    if (!positions) {
        const normalizedInput = matrixStr.trim().replace(/\r\n/g, '\n');
        const matchedPreset = MATRIX_PRESETS.find(p => p.value === normalizedInput);
        if (matchedPreset && matchedPreset.positions) {
            positions = matchedPreset.positions;
        }
    }

    if (positions) {
        positions = positions.map(p => ({
            x: p.x * (canvasWidth / 800),
            y: p.y * (canvasHeight / 600)
        }));
    }

    const nodeRadius = globalVertexStyle === 'inside' ? globalNodeRadius * 2.5 : globalNodeRadius;
    let currentNodes: NetworkNode[] = [];

    if (positions && positions.length >= n && !preserveNodePositions) {
        currentNodes = positions.slice(0, n).map((pos, idx) => ({
            id: `node_${idx}`,
            x: pos.x,
            y: pos.y,
            label: labels[idx] || String.fromCharCode(65 + idx),
            radius: nodeRadius,
            labelStyle: globalVertexStyle,
            labelOffset: {
                x: globalVertexLabelProximity * 0.707,
                y: -globalVertexLabelProximity * 0.707
            }
        }));
    } else if (preserveNodePositions && existingNodes.length > 0) {
        currentNodes = existingNodes.slice(0, n).map((nd, idx) => ({
            ...nd,
            label: labels[idx] || nd.label || String.fromCharCode(65 + idx)
        }));

        if (currentNodes.length < n) {
            const cx = canvasWidth / 2;
            const cy = canvasHeight / 2;
            const radius = (Math.min(canvasWidth, canvasHeight) / 2) * 0.72;
            for (let i = currentNodes.length; i < n; i++) {
                const defaultPos = positions && positions[i] ? positions[i] : null;
                const angle = (i / n) * 2 * Math.PI - Math.PI / 2;
                currentNodes.push({
                    id: `node_${i}_${Date.now()}`,
                    x: defaultPos ? defaultPos.x : cx + radius * Math.cos(angle),
                    y: defaultPos ? defaultPos.y : cy + radius * Math.sin(angle),
                    label: labels[i] || String.fromCharCode(65 + i),
                    radius: nodeRadius,
                    labelStyle: globalVertexStyle,
                    labelOffset: {
                        x: globalVertexLabelProximity * 0.707,
                        y: -globalVertexLabelProximity * 0.707
                    }
                });
            }
        }
    } else if (positions && positions.length >= n) {
        currentNodes = positions.slice(0, n).map((pos, idx) => ({
            id: `node_${idx}`,
            x: pos.x,
            y: pos.y,
            label: labels[idx] || String.fromCharCode(65 + idx),
            radius: nodeRadius,
            labelStyle: globalVertexStyle,
            labelOffset: {
                x: globalVertexLabelProximity * 0.707,
                y: -globalVertexLabelProximity * 0.707
            }
        }));
    } else {
        const cx = canvasWidth / 2;
        const cy = canvasHeight / 2;
        const radius = (Math.min(canvasWidth, canvasHeight) / 2) * 0.72;
        for (let i = 0; i < n; i++) {
            const angle = (i / n) * 2 * Math.PI - Math.PI / 2;
            currentNodes.push({
                id: `node_${i}`,
                x: cx + radius * Math.cos(angle),
                y: cy + radius * Math.sin(angle),
                label: labels[i] || String.fromCharCode(65 + i),
                radius: nodeRadius,
                labelStyle: globalVertexStyle,
                labelOffset: {
                    x: globalVertexLabelProximity * 0.707,
                    y: -globalVertexLabelProximity * 0.707
                }
            });
        }
    }

    let newEdges: NetworkEdge[] = [];

    for (let i = 0; i < n; i++) {
        const fromNode = currentNodes[i];
        for (let j = 0; j < (isDirected ? n : i + 1); j++) {
            const toNode = currentNodes[j];
            const weight = matrix[i][j];

            if (weight <= 0) continue;

            const edgeLabel = showWeights ? String(weight) : weight !== 1 ? String(weight) : '';

            if (i === j) {
                const angle = Math.atan2(fromNode.y - canvasHeight / 2, fromNode.x - canvasWidth / 2);
                const peakDist = 60;
                newEdges.push({
                    id: `edge_${fromNode.id}_loop_${i}`,
                    from: fromNode.id,
                    to: fromNode.id,
                    label: edgeLabel,
                    isDirected,
                    isDummy: false,
                    isCurve: false,
                    isLoop: true,
                    loopRadiusY: 1.0,
                    cp1: {
                        x: fromNode.x + peakDist * Math.cos(angle),
                        y: fromNode.y + peakDist * Math.sin(angle)
                    }
                });
            } else {
                const hasOpposite = isDirected && matrix[j] && matrix[j][i] > 0;
                const isCurved = hasOpposite;
                let cp1 = undefined;
                if (isCurved) {
                    const mx = (fromNode.x + toNode.x) / 2;
                    const my = (fromNode.y + toNode.y) / 2;
                    const dx = toNode.x - fromNode.x;
                    const dy = toNode.y - fromNode.y;
                    const dist = Math.hypot(dx, dy) || 1;
                    const nx = -dy / dist;
                    const ny = dx / dist;
                    cp1 = { x: mx + 35 * nx, y: my + 35 * ny };
                }

                newEdges.push({
                    id: `edge_${fromNode.id}_${toNode.id}`,
                    from: fromNode.id,
                    to: toNode.id,
                    label: edgeLabel,
                    isDirected,
                    isDummy: false,
                    isCurve: isCurved,
                    cp1
                });
            }
        }
    }

    if (globalVertexStyle === 'outside') {
        const opt = optimizeLabelPlacements(
            currentNodes,
            newEdges,
            globalEdgeLabelProximity,
            globalVertexLabelProximity,
            edgeLabelClearanceRatio,
            globalVertexStyle,
            globalNodeRadius
        );
        currentNodes = opt.nodes;
        newEdges = opt.edges;
    }

    return { nodes: currentNodes, edges: newEdges };
};

export const computeDraggedNodesAndEdges = (
    initialNodes: NetworkNode[],
    initialEdges: NetworkEdge[],
    draggingNodes: string[],
    dx: number,
    dy: number
): { nodes: NetworkNode[]; edges: NetworkEdge[] } => {
    const nextNodes = initialNodes.map(n =>
        draggingNodes.includes(n.id) ? { ...n, x: n.x + dx, y: n.y + dy } : n
    );

    const nextEdges = initialEdges.map(edge => {
        if (edge.isLoop) {
            if (draggingNodes.includes(edge.from)) {
                const initialCp = edge.cp1 || {
                    x: initialNodes.find(n => n.id === edge.from)?.x ?? 0,
                    y: (initialNodes.find(n => n.id === edge.from)?.y ?? 0) - 60
                };
                return { ...edge, cp1: { x: initialCp.x + dx, y: initialCp.y + dy } };
            }
            return edge;
        }

        const fn0 = initialNodes.find(n => n.id === edge.from);
        const tn0 = initialNodes.find(n => n.id === edge.to);
        const fn1 = nextNodes.find(n => n.id === edge.from);
        const tn1 = nextNodes.find(n => n.id === edge.to);

        if (!fn0 || !tn0 || !fn1 || !tn1) return edge;

        const fromDragging = draggingNodes.includes(edge.from);
        const toDragging = draggingNodes.includes(edge.to);

        if (!fromDragging && !toDragging) return edge;

        if (fromDragging && toDragging) {
            if (edge.cp1) {
                return { ...edge, cp1: { x: edge.cp1.x + dx, y: edge.cp1.y + dy } };
            }
            return edge;
        }

        if (edge.isCurve && edge.cp1) {
            const dx0 = tn0.x - fn0.x;
            const dy0 = tn0.y - fn0.y;
            const L0 = Math.hypot(dx0, dy0) || 1;
            const u0x = dx0 / L0;
            const u0y = dy0 / L0;
            const n0x = -u0y;
            const n0y = u0x;
            const m0x = (fn0.x + tn0.x) / 2;
            const m0y = (fn0.y + tn0.y) / 2;

            const dCpX = edge.cp1.x - m0x;
            const dCpY = edge.cp1.y - m0y;
            const tProj = (dCpX * u0x + dCpY * u0y) / L0;
            const hPerp = dCpX * n0x + dCpY * n0y;

            const dx1 = tn1.x - fn1.x;
            const dy1 = tn1.y - fn1.y;
            const L1 = Math.hypot(dx1, dy1) || 1;
            const u1x = dx1 / L1;
            const u1y = dy1 / L1;
            const n1x = -u1y;
            const n1y = u1x;
            const m1x = (fn1.x + tn1.x) / 2;
            const m1y = (fn1.y + tn1.y) / 2;

            return {
                ...edge,
                cp1: {
                    x: m1x + tProj * L1 * u1x + hPerp * n1x,
                    y: m1y + tProj * L1 * u1y + hPerp * n1y
                }
            };
        }

        return edge;
    });

    return { nodes: nextNodes, edges: nextEdges };
};

export const computeDraggedVertexLabelOffset = (
    node: NetworkNode,
    initialNodes: NetworkNode[],
    initialEdges: NetworkEdge[],
    dx: number,
    dy: number,
    globalVertexLabelProximity: number,
    isShift: boolean,
    isCtrl: boolean
): { x: number; y: number } => {
    let baseOffX = node.labelOffset?.x;
    let baseOffY = node.labelOffset?.y;
    if (baseOffX === undefined || baseOffY === undefined) {
        baseOffX = globalVertexLabelProximity * 0.707;
        baseOffY = -globalVertexLabelProximity * 0.707;
    }
    let newOffX = baseOffX + dx;
    let newOffY = baseOffY + dy;

    const getIncidentAngles = () => {
        const incidentAngles: number[] = [0, Math.PI / 2, Math.PI, -Math.PI / 2];
        initialEdges.forEach(ed => {
            if (ed.from === node.id && ed.to === node.id) {
                const cpY = ed.cp1 ? ed.cp1.y : node.y - 60;
                const cpX = ed.cp1 ? ed.cp1.x : node.x;
                incidentAngles.push(Math.atan2(cpY - node.y, cpX - node.x));
            } else if (ed.from === node.id) {
                const tn = initialNodes.find(t => t.id === ed.to);
                if (tn) incidentAngles.push(Math.atan2(tn.y - node.y, tn.x - node.x));
            } else if (ed.to === node.id) {
                const fn = initialNodes.find(f => f.id === ed.from);
                if (fn) incidentAngles.push(Math.atan2(fn.y - node.y, fn.x - node.x));
            }
        });
        return incidentAngles;
    };

    if (isShift && isCtrl) {
        const incidentAngles = getIncidentAngles();
        const currentAngle = Math.atan2(newOffY, newOffX);
        let bestAngle = incidentAngles[0];
        let minDiff = Infinity;

        incidentAngles.forEach(ang => {
            let diff = Math.abs(currentAngle - ang);
            while (diff > Math.PI * 2) diff -= Math.PI * 2;
            if (diff > Math.PI) diff = Math.PI * 2 - diff;
            if (diff < minDiff) {
                minDiff = diff;
                bestAngle = ang;
            }
        });

        newOffX = Math.cos(bestAngle) * globalVertexLabelProximity;
        newOffY = Math.sin(bestAngle) * globalVertexLabelProximity;
    } else if (isShift) {
        const incidentAngles = getIncidentAngles();
        const currentAngle = Math.atan2(newOffY, newOffX);
        let bestLine = { x: Math.cos(currentAngle), y: Math.sin(currentAngle) };
        let minDistance = Infinity;
        let bestProj = 0;

        incidentAngles.forEach(ang => {
            const ux = Math.cos(ang);
            const uy = Math.sin(ang);
            const dist = Math.abs(-uy * newOffX + ux * newOffY);
            const proj = newOffX * ux + newOffY * uy;

            if (dist < minDistance) {
                minDistance = dist;
                bestLine = { x: ux, y: uy };
                bestProj = proj;
            }
        });

        newOffX = bestLine.x * bestProj;
        newOffY = bestLine.y * bestProj;
    } else if (isCtrl) {
        const dist = Math.hypot(newOffX, newOffY) || 1;
        newOffX = (newOffX / dist) * globalVertexLabelProximity;
        newOffY = (newOffY / dist) * globalVertexLabelProximity;
    }

    return { x: newOffX, y: newOffY };
};

export const computeDraggedEdgeLabelOffset = (
    ed: NetworkEdge,
    initialNodes: NetworkNode[],
    dx: number,
    dy: number,
    globalEdgeLabelProximity: number,
    canvasWidth: number,
    canvasHeight: number,
    isShift: boolean,
    isCtrl: boolean
): { x: number; y: number } => {
    const fromNode = initialNodes.find(n => n.id === ed.from);
    const toNode = initialNodes.find(n => n.id === ed.to);

    const baseOffX = ed.labelOffset?.x || 0;
    const baseOffY = ed.labelOffset?.y || 0;

    let newOffX = baseOffX + dx;
    let newOffY = baseOffY + dy;

    if (fromNode && toNode && (isShift || isCtrl)) {
        let outX = 0;
        let outY = -1;
        let midX = 0;
        let midY = 0;

        if (ed.isLoop) {
            midX = ed.cp1 ? ed.cp1.x : fromNode.x;
            midY = ed.cp1 ? ed.cp1.y : fromNode.y - 60;
            const ldx = midX - fromNode.x;
            const ldy = midY - fromNode.y;
            const ldist = Math.hypot(ldx, ldy) || 1;
            outX = ldx / ldist;
            outY = ldy / ldist;
        } else {
            if (ed.isCurve && ed.cp1) {
                midX = 0.25 * fromNode.x + 0.5 * ed.cp1.x + 0.25 * toNode.x;
                midY = 0.25 * fromNode.y + 0.5 * ed.cp1.y + 0.25 * toNode.y;
            } else {
                midX = (fromNode.x + toNode.x) / 2;
                midY = (fromNode.y + toNode.y) / 2;
            }

            const edx = toNode.x - fromNode.x;
            const edy = toNode.y - fromNode.y;
            const eDist = Math.hypot(edx, edy) || 1;
            const normX = -edy / eDist;
            const normY = edx / eDist;

            const graphCenterX =
                initialNodes.length > 0
                    ? initialNodes.reduce((sum, n) => sum + n.x, 0) / initialNodes.length
                    : canvasWidth / 2;
            const graphCenterY =
                initialNodes.length > 0
                    ? initialNodes.reduce((sum, n) => sum + n.y, 0) / initialNodes.length
                    : canvasHeight / 2;
            const vcx = midX - graphCenterX;
            const vcy = midY - graphCenterY;
            const dot = normX * vcx + normY * vcy;
            outX = dot >= 0 ? normX : -normX;
            outY = dot >= 0 ? normY : -normY;
        }

        const defOffX = outX * globalEdgeLabelProximity;
        const defOffY = outY * globalEdgeLabelProximity;

        let targetVecX = defOffX + newOffX;
        let targetVecY = defOffY + newOffY;

        if (isShift && isCtrl) {
            const projN = targetVecX * outX + targetVecY * outY;
            const sign = projN >= 0 ? 1 : -1;
            targetVecX = sign * outX * globalEdgeLabelProximity;
            targetVecY = sign * outY * globalEdgeLabelProximity;
        } else if (isShift) {
            const proj = targetVecX * outX + targetVecY * outY;
            targetVecX = proj * outX;
            targetVecY = proj * outY;
        } else if (isCtrl) {
            const initialVecX = defOffX + baseOffX;
            const initialVecY = defOffY + baseOffY;
            const radius = Math.hypot(initialVecX, initialVecY);
            const targetDist = Math.hypot(targetVecX, targetVecY) || 1;
            targetVecX = (targetVecX / targetDist) * radius;
            targetVecY = (targetVecY / targetDist) * radius;
        }

        newOffX = targetVecX - defOffX;
        newOffY = targetVecY - defOffY;
    }

    return { x: newOffX, y: newOffY };
};

export const computeDraggedCut = (
    cut: NetworkCut,
    draggingCutElement: {
        cutId: string;
        nodeId: string | null;
        type: 'node' | 'cp1' | 'cp2' | 'all';
    },
    dx: number,
    dy: number
): NetworkCut => {
    if (draggingCutElement.type === 'all') {
        return {
            ...cut,
            nodes: cut.nodes.map(n => ({
                ...n,
                x: n.x + dx,
                y: n.y + dy
            }))
        };
    }

    return {
        ...cut,
        nodes: cut.nodes.map((n, idx) => {
            if (n.id !== draggingCutElement.nodeId) return n;

            if (draggingCutElement.type === 'node') {
                return { ...n, x: n.x + dx, y: n.y + dy };
            } else if (draggingCutElement.type === 'cp1') {
                const newCp1x = n.cp1x + dx;
                const newCp1y = n.cp1y + dy;
                const isInterior = idx > 0 && idx < cut.nodes.length - 1;
                if (isInterior) {
                    const cp2Len = Math.hypot(n.cp2x, n.cp2y);
                    const newCp1Len = Math.hypot(newCp1x, newCp1y);
                    if (newCp1Len > 0.001) {
                        const factor = cp2Len / newCp1Len;
                        return {
                            ...n,
                            cp1x: newCp1x,
                            cp1y: newCp1y,
                            cp2x: -newCp1x * factor,
                            cp2y: -newCp1y * factor
                        };
                    }
                }
                return { ...n, cp1x: newCp1x, cp1y: newCp1y };
            } else if (draggingCutElement.type === 'cp2') {
                const newCp2x = n.cp2x + dx;
                const newCp2y = n.cp2y + dy;
                const isInterior = idx > 0 && idx < cut.nodes.length - 1;
                if (isInterior) {
                    const cp1Len = Math.hypot(n.cp1x, n.cp1y);
                    const newCp2Len = Math.hypot(newCp2x, newCp2y);
                    if (newCp2Len > 0.001) {
                        const factor = cp1Len / newCp2Len;
                        return {
                            ...n,
                            cp2x: newCp2x,
                            cp2y: newCp2y,
                            cp1x: -newCp2x * factor,
                            cp1y: -newCp2y * factor
                        };
                    }
                }
                return { ...n, cp2x: newCp2x, cp2y: newCp2y };
            }
            return n;
        })
    };
};

