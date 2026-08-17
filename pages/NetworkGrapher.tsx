import React, { useState, useRef, useEffect, MouseEvent as ReactMouseEvent } from 'react';
import { Download, Plus, Minus, Trash2, Settings, Move, Circle, MoveUpRight, Type, Pointer, GripHorizontal, RotateCw, RefreshCw, Grid, Table as TableIcon, Sparkles } from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';
import { 
    generateRegularNetwork, 
    generateActivityNetwork,
    parseAdjacencyMatrix,
    generateFromAdjacencyMatrix,
    generateAdjacencyMatrixFromGraph,
    generatePrecedenceTableFromGraph
} from '../utils/networkGenerators';
import { downloadSVG, generateGraphImage, copyImageToClipboard } from '../utils/imageExport';
import { GraphToolbar } from '../components/GraphToolbar';

export interface NetworkNode {
    id: string;
    x: number;
    y: number;
    label: string;
    radius: number;
    labelStyle: 'none' | 'inside' | 'outside';
    labelOffset: { x: number, y: number };
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
    cp1?: { x: number, y: number }; 
    labelOffset?: { x: number, y: number };
    isLoop?: boolean;
    loopRadiusY?: number; 
}

export type NetworkMode = 'select' | 'addNode' | 'addEdge' | 'addDirectedEdge' | 'addDummyEdge' | 'addLoop';
export type VertexDisplayStyle = 'none' | 'outside' | 'inside';

export const computeSmartOutsideLabelOffset = (
    node: { x: number; y: number; id: string },
    allNodes: { x: number; y: number; id: string }[],
    allEdges: { from: string; to: string }[],
    _canvasCenter: { x: number; y: number } = { x: 400, y: 300 }
): { x: number; y: number } => {
    const offsetDist = 18;

    // 1. Gather all incident edges and neighbor angles
    const incidentEdges = allEdges.filter(e => e.from === node.id || e.to === node.id);
    const neighborAngles: number[] = [];

    incidentEdges.forEach(e => {
        const neighborId = e.from === node.id ? e.to : e.from;
        if (neighborId === node.id) return; // ignore self-loops
        const neighbor = allNodes.find(n => n.id === neighborId);
        if (neighbor) {
            const dx = neighbor.x - node.x;
            const dy = neighbor.y - node.y;
            if (Math.hypot(dx, dy) > 1) {
                let ang = Math.atan2(dy, dx);
                if (ang < 0) ang += 2 * Math.PI;
                neighborAngles.push(ang);
            }
        }
    });

    // If no neighbors, default to Priority 1: Above
    if (neighborAngles.length === 0) {
        return { x: 0, y: -offsetDist };
    }

    // If 1 neighbor, place label directly opposite
    if (neighborAngles.length === 1) {
        const oppAngle = (neighborAngles[0] + Math.PI) % (2 * Math.PI);
        return {
            x: Math.round(Math.cos(oppAngle) * offsetDist),
            y: Math.round(Math.sin(oppAngle) * offsetDist)
        };
    }

    // Sort incident edge angles in circular order [0, 2π)
    neighborAngles.sort((a, b) => a - b);
    const m = neighborAngles.length;

    // Compute angular sectors (spaces between consecutive edges)
    interface Sector {
        start: number;
        end: number;
        gap: number;
        bisector: number;
    }

    const sectors: Sector[] = [];
    for (let i = 0; i < m; i++) {
        const start = neighborAngles[i];
        let end = neighborAngles[(i + 1) % m];
        if (end <= start) end += 2 * Math.PI;
        const gap = end - start;
        const bisector = (start + gap / 2) % (2 * Math.PI);
        sectors.push({ start, end, gap, bisector });
    }

    // Find the biggest space between edges (with a tolerance for ties / equal spacing)
    const maxGap = Math.max(...sectors.map(s => s.gap));
    const candidateSectors = sectors.filter(s => s.gap >= maxGap - 0.15); // within ~8.5 degrees

    // Helper: calculate minimum angular distance from a test angle to ANY incident edge
    const minAngleDiff = (angle: number): number => {
        let minDiff = Infinity;
        for (const edgeAng of neighborAngles) {
            let diff = Math.abs(angle - edgeAng);
            if (diff > Math.PI) diff = 2 * Math.PI - diff;
            if (diff < minDiff) minDiff = diff;
        }
        return minDiff;
    };

    // Helper: check if an angle falls strictly inside a sector [start, end]
    const isAngleInSector = (angle: number, sector: Sector): boolean => {
        let normAngle = angle;
        while (normAngle < sector.start) normAngle += 2 * Math.PI;
        return normAngle >= sector.start && normAngle <= sector.end;
    };

    // 4 Cardinal Priority Directions: Above, Below, Left, Right
    const priorityDirections = [
        { name: 'Above', x: 0, y: -1, angle: (3 * Math.PI) / 2 },
        { name: 'Below', x: 0, y: 1,  angle: Math.PI / 2 },
        { name: 'Left',  x: -1, y: 0, angle: Math.PI },
        { name: 'Right', x: 1, y: 0,  angle: 0 }
    ];

    // Priority Check: Find if any priority direction fits in a biggest space without colliding with an edge
    const minEdgeClearance = 0.26; // ~15 degrees minimum clearance to not be "on top of an edge"
    
    for (const p of priorityDirections) {
        // Must have sufficient clearance from all incident edges
        if (minAngleDiff(p.angle) >= minEdgeClearance) {
            // Check if this direction lies inside one of the candidate biggest-space sectors
            const inCandidateSector = candidateSectors.find(s => isAngleInSector(p.angle, s));
            if (inCandidateSector) {
                // If it's a very wide open space (gap >= 160 deg), snap cleanly to the cardinal direction
                if (inCandidateSector.gap >= Math.PI * 0.9) {
                    return {
                        x: Math.round(p.x * offsetDist),
                        y: Math.round(p.y * offsetDist)
                    };
                }
                // Otherwise use the exact bisector of that candidate sector
                return {
                    x: Math.round(Math.cos(inCandidateSector.bisector) * offsetDist),
                    y: Math.round(Math.sin(inCandidateSector.bisector) * offsetDist)
                };
            }
        }
    }

    // Fallback if none of the exact cardinal directions fit:
    // Rank candidate sector bisectors by priority components:
    // 1. Above (highest negative Y / -sin(beta))
    // 2. Below (highest positive Y / sin(beta))
    // 3. Left (highest negative X / -cos(beta))
    // 4. Right (highest positive X / cos(beta))
    let bestSector = candidateSectors[0];
    let bestScore = -Infinity;

    for (const s of candidateSectors) {
        const bx = Math.cos(s.bisector);
        const by = Math.sin(s.bisector);

        let score = 0;
        if (by < -0.3) {
            score = 1000 + (-by * 100) + (-bx > 0 ? 10 : 0); // Above priority
        } else if (by > 0.3) {
            score = 500 + (by * 100) + (-bx > 0 ? 10 : 0);  // Below priority
        } else if (bx < -0.3) {
            score = 100 + (-bx * 50);                       // Left priority
        } else {
            score = 50 + (bx * 50);                         // Right priority
        }

        if (score > bestScore) {
            bestScore = score;
            bestSector = s;
        }
    }

    return {
        x: Math.round(Math.cos(bestSector.bisector) * offsetDist),
        y: Math.round(Math.sin(bestSector.bisector) * offsetDist)
    };
};

const generateRegularPolygon = (n: number, cx: number, cy: number, vertexStyle: VertexDisplayStyle = 'inside'): NetworkNode[] => {
    const radius = 200;
    const rawNodes = Array.from({ length: n }).map((_, i) => {
        const angle = (i / n) * 2 * Math.PI - Math.PI / 2;
        const x = cx + radius * Math.cos(angle);
        const y = cy + radius * Math.sin(angle);
        const nodeRadius = vertexStyle === 'inside' ? 15 : 6;
        return {
            id: uuidv4(),
            x,
            y,
            label: String.fromCharCode(65 + (i % 26)) + (i >= 26 ? Math.floor(i/26) : ''),
            radius: nodeRadius,
            labelStyle: vertexStyle,
            labelOffset: { x: Math.round(Math.cos(angle) * 18), y: Math.round(Math.sin(angle) * 18) }
        };
    });
    return rawNodes;
};

const NetworkGrapher: React.FC = () => {
    const [nodes, setNodes] = useState<NetworkNode[]>([]);
    const [edges, setEdges] = useState<NetworkEdge[]>([]);
    const [mode, setMode] = useState<NetworkMode>('select');
    const [globalVertexStyle, setGlobalVertexStyle] = useState<VertexDisplayStyle>('inside');
    
    // Selection state
    const [selectedNodes, setSelectedNodes] = useState<string[]>([]);
    const [selectedEdges, setSelectedEdges] = useState<string[]>([]);
    const [edgeStartNode, setEdgeStartNode] = useState<string | null>(null);

    // Hover state
    const [hoveredNode, setHoveredNode] = useState<string | null>(null);
    const [mousePos, setMousePos] = useState<{x: number, y: number} | null>(null);

    // Dragging state
    const [draggingNodes, setDraggingNodes] = useState<string[]>([]);
    const [selectionBox, setSelectionBox] = useState<{startX: number, startY: number, currentX: number, currentY: number} | null>(null);
    const [draggingCP, setDraggingCP] = useState<string | null>(null); 
    const [draggingLabel, setDraggingLabel] = useState<string | null>(null);
    const [draggingEdgeLabel, setDraggingEdgeLabel] = useState<string | null>(null);
    
    const [dragInfo, setDragInfo] = useState<{
        startX: number, startY: number, 
        initialNodes: NetworkNode[], initialEdges: NetworkEdge[]
    } | null>(null);
    
    // Export state
    const [exportDpi, setExportDpi] = useState(300);
    const [isCopied, setIsCopied] = useState(false);

    // Canvas ref
    const svgRef = useRef<SVGSVGElement>(null);
    
    // View state
    const [inputType, setInputType] = useState<'manual' | 'matrix' | 'precedence' | 'regular'>('manual');
    const [isDirectedGeneral, setIsDirectedGeneral] = useState(false);
    const [showMatrixWeights, setShowMatrixWeights] = useState(true);

    const MATRIX_PRESETS: {
        name: string;
        directed: boolean;
        value: string;
        positions: { x: number; y: number }[];
    }[] = [
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

    // Input States
    const [matrixInput, setMatrixInput] = useState(MATRIX_PRESETS[0].value);
    const [precedenceInput, setPrecedenceInput] = useState("A, -, 5\nB, A, 2\nC, A, 3\nD, B;C, 4");
    const [initialVerticesCount, setInitialVerticesCount] = useState(6);

    const PRECEDENCE_PRESETS = [
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

    const handleExportSVG = () => {
        downloadSVG('network-canvas-svg', 'network-graph.svg');
    };

    const handleExportPNG = async () => {
        const result = await generateGraphImage('network-canvas-svg', 800, 600, 15, false, 20, exportDpi);
        if (result && result.blob) {
            const url = URL.createObjectURL(result.blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = 'network-graph.png';
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            URL.revokeObjectURL(url);
        }
    };

    const handleCopy = async () => {
        const result = await generateGraphImage('network-canvas-svg', 800, 600, 15, false, 20, exportDpi);
        if (result && result.blob) {
            try {
                await copyImageToClipboard(result.blob, result.widthCm, result.heightCm);
                setIsCopied(true);
                setTimeout(() => setIsCopied(false), 2000);
            } catch (err) {
                console.error("Failed to copy image", err);
            }
        }
    };

    const applyVertexStyle = (style: VertexDisplayStyle, targetNodeIds?: string[]) => {
        const isTargeted = Boolean(targetNodeIds && targetNodeIds.length > 0);
        if (!isTargeted) {
            setGlobalVertexStyle(style);
        }

        const targetSet = new Set(targetNodeIds || []);
        
        setNodes(prevNodes => {
            return prevNodes.map(node => {
                if (isTargeted && !targetSet.has(node.id)) {
                    return node;
                }

                if (style === 'none') {
                    return {
                        ...node,
                        labelStyle: 'none',
                        radius: 6
                    };
                } else if (style === 'outside') {
                    const offset = computeSmartOutsideLabelOffset(node, prevNodes, edges);
                    return {
                        ...node,
                        labelStyle: 'outside',
                        radius: 6,
                        labelOffset: offset
                    };
                } else { // 'inside'
                    return {
                        ...node,
                        labelStyle: 'inside',
                        radius: 15
                    };
                }
            });
        });
    };

    const applyMatrixToGraph = (
        matrixStr: string,
        isDirected: boolean,
        showWeights: boolean,
        preserveNodePositions: boolean = true,
        customPositions?: { x: number, y: number }[]
    ) => {
        const { matrix, labels } = parseAdjacencyMatrix(matrixStr);
        if (matrix.length === 0) return;
        const n = matrix.length;

        // If customPositions not explicitly provided, check if matrix matches any planar preset
        let positions = customPositions;
        if (!positions) {
            const normalizedInput = matrixStr.trim().replace(/\r\n/g, '\n');
            const matchedPreset = MATRIX_PRESETS.find(p => p.value === normalizedInput);
            if (matchedPreset && matchedPreset.positions) {
                positions = matchedPreset.positions;
            }
        }

        const nodeRadius = globalVertexStyle === 'inside' ? 15 : 6;
        let currentNodes: NetworkNode[] = [];

        if (positions && positions.length >= n && !preserveNodePositions) {
            currentNodes = positions.slice(0, n).map((pos, idx) => ({
                id: `node_${idx}`,
                x: pos.x,
                y: pos.y,
                label: labels[idx] || String.fromCharCode(65 + idx),
                radius: nodeRadius,
                labelStyle: globalVertexStyle,
                labelOffset: { x: 15, y: -15 }
            }));
        } else if (preserveNodePositions && nodes.length > 0) {
            currentNodes = nodes.slice(0, n).map((nd, idx) => ({
                ...nd,
                label: labels[idx] || nd.label || String.fromCharCode(65 + idx)
            }));

            if (currentNodes.length < n) {
                const cx = 400;
                const cy = 300;
                const radius = Math.min(800, 600) / 2 * 0.72;
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
                        labelOffset: { x: 15, y: -15 }
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
                labelOffset: { x: 15, y: -15 }
            }));
        } else {
            const cx = 400;
            const cy = 300;
            const radius = Math.min(800, 600) / 2 * 0.72;
            for (let i = 0; i < n; i++) {
                const angle = (i / n) * 2 * Math.PI - Math.PI / 2;
                currentNodes.push({
                    id: `node_${i}`,
                    x: cx + radius * Math.cos(angle),
                    y: cy + radius * Math.sin(angle),
                    label: labels[i] || String.fromCharCode(65 + i),
                    radius: nodeRadius,
                    labelStyle: globalVertexStyle,
                    labelOffset: { x: 15, y: -15 }
                });
            }
        }

        const newEdges: NetworkEdge[] = [];

        for (let i = 0; i < n; i++) {
            const fromNode = currentNodes[i];
            for (let j = 0; j < (isDirected ? n : i + 1); j++) {
                const toNode = currentNodes[j];
                const weight = matrix[i][j];

                if (weight <= 0) continue;

                const edgeLabel = showWeights ? String(weight) : (weight !== 1 ? String(weight) : '');

                // Self-loop
                if (i === j) {
                    const angle = Math.atan2(fromNode.y - 300, fromNode.x - 400);
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

        // If in outside mode, auto-compute smart label offsets away from incident edges
        if (globalVertexStyle === 'outside') {
            currentNodes = currentNodes.map(node => ({
                ...node,
                labelOffset: computeSmartOutsideLabelOffset(node, currentNodes, newEdges)
            }));
        }

        setNodes(currentNodes);
        setEdges(newEdges);
    };

    useEffect(() => {
        // Populate initial graph on mount with first planar preset
        const defaultPreset = MATRIX_PRESETS[0];
        applyMatrixToGraph(defaultPreset.value, defaultPreset.directed, showMatrixWeights, false, defaultPreset.positions);
    }, []);

    const handleGenerateFromMatrix = () => {
        const { matrix, labels } = parseAdjacencyMatrix(matrixInput);
        if (matrix.length === 0) return;
        const normalizedInput = matrixInput.trim().replace(/\r\n/g, '\n');
        const matchedPreset = MATRIX_PRESETS.find(p => p.value === normalizedInput);
        const res = generateFromAdjacencyMatrix(matrix, labels, isDirectedGeneral, 800, 600, showMatrixWeights, matchedPreset?.positions);
        
        let adjustedNodes = res.nodes.map(n => ({
            ...n,
            labelStyle: globalVertexStyle,
            radius: globalVertexStyle === 'inside' ? 15 : 6
        }));

        if (globalVertexStyle === 'outside') {
            adjustedNodes = adjustedNodes.map(n => ({
                ...n,
                labelOffset: computeSmartOutsideLabelOffset(n, adjustedNodes, res.edges)
            }));
        }

        setNodes(adjustedNodes);
        setEdges(res.edges);
        setSelectedNodes([]);
        setSelectedEdges([]);
    };

    const handleSyncMatrixFromGraph = () => {
        if (nodes.length === 0) return;
        const { matrix, labels } = generateAdjacencyMatrixFromGraph(nodes, edges, isDirectedGeneral);
        const rows = matrix.map((row) => row.join(' ')).join('\n');
        setMatrixInput(rows);
    };

    const handleMatrixCellEdit = (rIdx: number, cIdx: number, rawVal: string) => {
        const { matrix } = parseAdjacencyMatrix(matrixInput);
        if (matrix.length === 0) return;

        const clean = rawVal.trim();
        const val = clean === '' ? 0 : parseFloat(clean);
        const nextVal = isNaN(val) ? 0 : val;

        const nextMatrix = matrix.map((row, i) =>
            row.map((cell, j) => {
                if (i === rIdx && j === cIdx) return nextVal;
                if (!isDirectedGeneral && i === cIdx && j === rIdx) return nextVal;
                return cell;
            })
        );

        const nextStr = nextMatrix.map(row => row.join(' ')).join('\n');
        setMatrixInput(nextStr);
        applyMatrixToGraph(nextStr, isDirectedGeneral, showMatrixWeights, true);
    };

    const handleAddMatrixNode = () => {
        const { matrix } = parseAdjacencyMatrix(matrixInput);
        const n = matrix.length;
        if (n >= 12) return;
        const nextMatrix = matrix.map(row => [...row, 0]);
        nextMatrix.push(Array(n + 1).fill(0));
        const nextStr = nextMatrix.map(row => row.join(' ')).join('\n');
        setMatrixInput(nextStr);
        applyMatrixToGraph(nextStr, isDirectedGeneral, showMatrixWeights, true);
    };

    const handleRemoveMatrixNode = () => {
        const { matrix } = parseAdjacencyMatrix(matrixInput);
        const n = matrix.length;
        if (n <= 2) return;
        const nextMatrix = matrix.slice(0, n - 1).map(row => row.slice(0, n - 1));
        const nextStr = nextMatrix.map(row => row.join(' ')).join('\n');
        setMatrixInput(nextStr);
        applyMatrixToGraph(nextStr, isDirectedGeneral, showMatrixWeights, true);
    };

    const handleClearMatrixEdges = () => {
        const { matrix } = parseAdjacencyMatrix(matrixInput);
        const nextMatrix = matrix.map(row => row.map(() => 0));
        const nextStr = nextMatrix.map(row => row.join(' ')).join('\n');
        setMatrixInput(nextStr);
        applyMatrixToGraph(nextStr, isDirectedGeneral, showMatrixWeights, true);
    };

    const handleGenerateFromPrecedence = () => {
        setGlobalVertexStyle('none');
        const res = generateActivityNetwork(precedenceInput, 800, 600);
        const adjustedNodes = res.nodes.map(n => ({
            ...n,
            labelStyle: 'none' as const,
            radius: 6
        }));

        setNodes(adjustedNodes);
        setEdges(res.edges);
        setSelectedNodes([]);
        setSelectedEdges([]);
    };

    const handleExtractPrecedenceFromGraph = () => {
        const table = generatePrecedenceTableFromGraph(nodes, edges);
        if (table.length === 0) return;
        const formatted = table.map(t => `${t.activity}, ${t.predecessors.join(';')}, ${t.duration}`).join('\n');
        setPrecedenceInput(formatted);
    };

    const getMouseCoords = (e: ReactMouseEvent | MouseEvent) => {
        if (!svgRef.current) return { x: 0, y: 0 };
        const CTM = svgRef.current.getScreenCTM();
        if (!CTM) return { x: 0, y: 0 };
        return {
            x: (e.clientX - CTM.e) / CTM.a,
            y: (e.clientY - CTM.f) / CTM.d
        };
    };

    const handleSvgPointerDown = (e: ReactMouseEvent) => {
        const { x, y } = getMouseCoords(e);
        if (mode === 'addNode') {
            const nodeRadius = globalVertexStyle === 'inside' ? 15 : 6;
            const newNode: NetworkNode = {
                id: uuidv4(),
                x,
                y,
                label: String.fromCharCode(65 + nodes.length), 
                radius: nodeRadius,
                labelStyle: globalVertexStyle,
                labelOffset: { x: 15, y: -15 }
            };
            const allNodes = [...nodes, newNode];
            if (globalVertexStyle === 'outside') {
                newNode.labelOffset = computeSmartOutsideLabelOffset(newNode, allNodes, edges);
            }
            setNodes(allNodes);
        } else if (mode === 'select') {
            setSelectedNodes([]);
            setSelectedEdges([]);
            setSelectionBox({ startX: x, startY: y, currentX: x, currentY: y });
        }
    };

    const handleNodePointerDown = (e: ReactMouseEvent, nodeId: string) => {
        e.stopPropagation();
        const coords = getMouseCoords(e);
        
        if (mode === 'addNode') {
            setMode('select');
            setSelectedNodes([nodeId]);
            setSelectedEdges([]);
            setDraggingNodes([nodeId]);
            setDragInfo({ startX: coords.x, startY: coords.y, initialNodes: nodes, initialEdges: edges });
        } else if (mode === 'select') {
            let newSelected = selectedNodes;
            if (!selectedNodes.includes(nodeId)) {
                newSelected = [nodeId];
                setSelectedNodes(newSelected);
                setSelectedEdges([]);
            }
            setDraggingNodes(newSelected);
            setDragInfo({ startX: coords.x, startY: coords.y, initialNodes: nodes, initialEdges: edges });
        } else if (mode === 'addLoop') {
            const node = nodes.find(n => n.id === nodeId);
            if (node) {
                const newEdge: NetworkEdge = {
                    id: uuidv4(),
                    from: nodeId,
                    to: nodeId,
                    label: '',
                    isDirected: isDirectedGeneral,
                    isDummy: false,
                    isCurve: false,
                    isLoop: true,
                    loopRadiusY: 1.0, // Default circle (1.0)
                    cp1: { x: node.x, y: node.y - 60 }
                };
                setEdges([...edges, newEdge]);
            }
        } else if (mode === 'addEdge' || mode === 'addDummyEdge' || mode === 'addDirectedEdge') {
            if (!edgeStartNode) {
                setEdgeStartNode(nodeId);
            } else {
                if (edgeStartNode !== nodeId) {
                    const newEdge: NetworkEdge = {
                        id: uuidv4(),
                        from: edgeStartNode,
                        to: nodeId,
                        label: '',
                        isDirected: mode === 'addDirectedEdge' || mode === 'addDummyEdge' || isDirectedGeneral,
                        isDummy: mode === 'addDummyEdge',
                        isCurve: false
                    };
                    
                    let allEdges = [...edges, newEdge];
                    const group = allEdges.filter(e => !e.isLoop && ((e.from === edgeStartNode && e.to === nodeId) || (e.from === nodeId && e.to === edgeStartNode)));
                    if (group.length > 1) {
                        const cFrom = nodes.find(n => n.id === (edgeStartNode < nodeId ? edgeStartNode : nodeId))!;
                        const cTo = nodes.find(n => n.id === (edgeStartNode < nodeId ? nodeId : edgeStartNode))!;
                        const dx = cTo.x - cFrom.x;
                        const dy = cTo.y - cFrom.y;
                        const dist = Math.hypot(dx, dy);
                        const nx = -dy / dist;
                        const ny = dx / dist;
                        const mx = (cFrom.x + cTo.x) / 2;
                        const my = (cFrom.y + cTo.y) / 2;
                        
                        const N = group.length;
                        const spread = 40;
                        const slots = Array.from({length: N}).map((_, j) => (j - (N - 1) / 2) * spread);
                        // Sort so outer curves are assigned to earlier edges, straight/inner to newest
                        slots.sort((a, b) => {
                            const absDiff = Math.abs(b) - Math.abs(a);
                            return absDiff !== 0 ? absDiff : a - b;
                        });

                        group.forEach((e, i) => {
                            const offset = slots[i];
                            e.isCurve = offset !== 0;
                            if (e.isCurve) {
                                e.cp1 = { x: mx + nx * offset, y: my + ny * offset };
                            } else {
                                e.cp1 = undefined;
                            }
                        });
                    }
                    setEdges(allEdges);
                }
                setEdgeStartNode(null);
            }
        }
    };

    const handleEdgePointerDown = (e: ReactMouseEvent, edgeId: string) => {
        e.stopPropagation();
        if (mode === 'select') {
            setSelectedEdges([edgeId]);
            setSelectedNodes([]);
        }
    };

    const handlePointerMove = (e: ReactMouseEvent | MouseEvent) => {
        const coords = getMouseCoords(e);
        setMousePos(coords);
        
        if (selectionBox) {
            setSelectionBox({ ...selectionBox, currentX: coords.x, currentY: coords.y });
            const minX = Math.min(selectionBox.startX, coords.x);
            const maxX = Math.max(selectionBox.startX, coords.x);
            const minY = Math.min(selectionBox.startY, coords.y);
            const maxY = Math.max(selectionBox.startY, coords.y);
            
            setSelectedNodes(nodes.filter(n => n.x >= minX && n.x <= maxX && n.y >= minY && n.y <= maxY).map(n => n.id));
            setSelectedEdges(edges.filter(edge => {
                const fn = nodes.find(n => n.id === edge.from);
                const tn = nodes.find(n => n.id === edge.to);
                if (!fn || !tn) return false;
                const mx = edge.isLoop ? (edge.cp1?.x ?? fn.x) : (fn.x + tn.x) / 2;
                const my = edge.isLoop ? (edge.cp1?.y ?? (fn.y - 60)) : (fn.y + tn.y) / 2;
                return mx >= minX && mx <= maxX && my >= minY && my <= maxY;
            }).map(e => e.id));
        } else if (dragInfo) {
            const dx = coords.x - dragInfo.startX;
            const dy = coords.y - dragInfo.startY;

            if (draggingNodes.length > 0) {
                const nextNodes = dragInfo.initialNodes.map(n => 
                    draggingNodes.includes(n.id) ? { ...n, x: n.x + dx, y: n.y + dy } : n
                );
                setNodes(nextNodes);

                setEdges(dragInfo.initialEdges.map(edge => {
                    if (edge.isLoop) {
                        if (draggingNodes.includes(edge.from)) {
                            const initialCp = edge.cp1 || {
                                x: (dragInfo.initialNodes.find(n => n.id === edge.from)?.x ?? 0),
                                y: (dragInfo.initialNodes.find(n => n.id === edge.from)?.y ?? 0) - 60
                            };
                            return { ...edge, cp1: { x: initialCp.x + dx, y: initialCp.y + dy } };
                        }
                        return edge;
                    }

                    const fn0 = dragInfo.initialNodes.find(n => n.id === edge.from);
                    const tn0 = dragInfo.initialNodes.find(n => n.id === edge.to);
                    const fn1 = nextNodes.find(n => n.id === edge.from);
                    const tn1 = nextNodes.find(n => n.id === edge.to);

                    if (!fn0 || !tn0 || !fn1 || !tn1) return edge;

                    const fromDragging = draggingNodes.includes(edge.from);
                    const toDragging = draggingNodes.includes(edge.to);

                    if (!fromDragging && !toDragging) {
                        return edge;
                    }

                    if (fromDragging && toDragging) {
                        if (edge.cp1) {
                            return { ...edge, cp1: { x: edge.cp1.x + dx, y: edge.cp1.y + dy } };
                        }
                        return edge;
                    }

                    // Only one node moved: preserve relative chord projection and perpendicular spacing
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
                                x: m1x + (tProj * L1) * u1x + hPerp * n1x,
                                y: m1y + (tProj * L1) * u1y + hPerp * n1y
                            }
                        };
                    }

                    return edge;
                }));
            } else if (draggingCP) {
                setEdges(dragInfo.initialEdges.map(edge => {
                    if (edge.id === draggingCP) {
                        let initialCp = edge.cp1;
                        if (!initialCp) {
                            if (edge.isLoop) {
                                const fn = dragInfo.initialNodes.find(n => n.id === edge.from);
                                initialCp = { x: fn?.x ?? 0, y: (fn?.y ?? 0) - 60 };
                            } else {
                                const fn = dragInfo.initialNodes.find(n => n.id === edge.from);
                                const tn = dragInfo.initialNodes.find(n => n.id === edge.to);
                                initialCp = { x: ((fn?.x ?? 0) + (tn?.x ?? 0)) / 2, y: ((fn?.y ?? 0) + (tn?.y ?? 0)) / 2 - 30 };
                            }
                        }
                        return { ...edge, cp1: { x: initialCp.x + dx, y: initialCp.y + dy } };
                    }
                    return edge;
                }));
            } else if (draggingLabel) {
                setNodes(dragInfo.initialNodes.map(n => {
                    if (n.id === draggingLabel) {
                        return { ...n, labelOffset: { x: n.labelOffset.x + dx, y: n.labelOffset.y + dy } };
                    }
                    return n;
                }));
            } else if (draggingEdgeLabel) {
                setEdges(dragInfo.initialEdges.map(ed => {
                    if (ed.id === draggingEdgeLabel) {
                        return { ...ed, labelOffset: { x: (ed.labelOffset?.x || 0) + dx, y: (ed.labelOffset?.y || -15) + dy } };
                    }
                    return ed;
                }));
            }
        }
    };

    const handlePointerUp = () => {
        setDraggingNodes([]);
        setDraggingCP(null);
        setDraggingLabel(null);
        setDraggingEdgeLabel(null);
        setSelectionBox(null);
        setDragInfo(null);
    };

    useEffect(() => {
        window.addEventListener('mouseup', handlePointerUp);
        window.addEventListener('mousemove', handlePointerMove);
        return () => {
            window.removeEventListener('mouseup', handlePointerUp);
            window.removeEventListener('mousemove', handlePointerMove);
        };
    }, [draggingNodes, draggingCP, draggingLabel, draggingEdgeLabel, selectionBox, dragInfo, nodes, edges]);

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Backspace' || e.key === 'Delete') {
                if (document.activeElement?.tagName === 'INPUT' || document.activeElement?.tagName === 'TEXTAREA' || document.activeElement?.tagName === 'SELECT') return;
                
                setEdges(prev => prev.filter(edge => !selectedEdges.includes(edge.id) && !selectedNodes.includes(edge.from) && !selectedNodes.includes(edge.to)));
                setNodes(prev => prev.filter(node => !selectedNodes.includes(node.id)));
                setSelectedNodes([]);
                setSelectedEdges([]);
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [selectedNodes, selectedEdges]);

    const renderEdge = (edge: NetworkEdge) => {
        const fromNode = nodes.find(n => n.id === edge.from);
        const toNode = nodes.find(n => n.id === edge.to);
        if (!fromNode || !toNode) return null;

        const isSelected = selectedEdges.includes(edge.id);
        let path = '';
        let midX = 0;
        let midY = 0;
        let arrowAngle = 0;

        if (edge.isLoop) {
            let peakX = 0, peakY = 0;
            if (edge.cp1) {
                peakX = edge.cp1.x;
                peakY = edge.cp1.y;
            } else {
                peakX = fromNode.x;
                peakY = fromNode.y - 60; // Default peak 60px above
            }
            
            const dx = peakX - fromNode.x;
            const dy = peakY - fromNode.y;
            let dist = Math.hypot(dx, dy);
            if (dist < 5) dist = 60;
            
            const ux = dx / dist;
            const uy = dy / dist;
            const vx = -uy;
            const vy = ux;
            
            const ra = dist / 2;
            const rb = ra * (edge.loopRadiusY !== undefined ? edge.loopRadiusY : 1.0);
            
            const cx = fromNode.x + ra * ux;
            const cy = fromNode.y + ra * uy;
            
            // 64-segment parametric ellipse/circle for mathematical accuracy
            const numSegments = 64;
            const pathPoints: string[] = [];
            for (let i = 0; i <= numSegments; i++) {
                const t = -Math.PI / 2 + (i / numSegments) * (2 * Math.PI);
                const px = cx + rb * Math.cos(t) * vx + ra * Math.sin(t) * ux;
                const py = cy + rb * Math.cos(t) * vy + ra * Math.sin(t) * uy;
                pathPoints.push(`${i === 0 ? 'M' : 'L'} ${px.toFixed(2)} ${py.toFixed(2)}`);
            }
            path = pathPoints.join(' ') + ' Z';
            
            // Arrow tangent calculation: angle entering fromNode
            arrowAngle = Math.atan2(ux, -uy) * 180 / Math.PI;
            midX = peakX;
            midY = peakY;

            const ldist = Math.hypot(dx, dy) || 1;
            const defOffX = (dx / ldist) * 16;
            const defOffY = (dy / ldist) * 16;
            const labelOff = {
                x: defOffX + (edge.labelOffset?.x || 0),
                y: defOffY + (edge.labelOffset?.y || 0)
            };

            return (
                <g key={edge.id} onPointerDown={(e) => handleEdgePointerDown(e, edge.id)}>
                    <path d={path} fill="none" stroke="transparent" strokeWidth="20" />
                    <path 
                        d={path} 
                        fill="none" 
                        stroke={isSelected ? "#4f46e5" : "black"} 
                        strokeWidth="2" 
                        strokeDasharray={edge.isDummy ? "6,6" : "none"}
                    />
                    
                    {edge.isDirected && (
                        <polygon 
                            points="-6,-6 6,0 -6,6" 
                            fill={isSelected ? "#4f46e5" : "black"}
                            transform={`translate(${fromNode.x}, ${fromNode.y}) rotate(${arrowAngle}) translate(${fromNode.radius + 6}, 0)`}
                            style={{ pointerEvents: 'none' }}
                        />
                    )}

                    {isSelected && (
                        <g
                            transform={`translate(${peakX}, ${peakY})`}
                            onPointerDown={(e) => { 
                                e.stopPropagation(); 
                                const coords = getMouseCoords(e);
                                setDraggingCP(edge.id); 
                                setDragInfo({ startX: coords.x, startY: coords.y, initialNodes: nodes, initialEdges: edges });
                            }}
                            style={{ cursor: 'grab' }}
                        >
                            <circle r={10} fill="white" stroke="#4f46e5" strokeWidth="1.5" />
                            <RotateCw size={12} color="#4f46e5" style={{ transform: 'translate(-6px, -6px)' }} />
                        </g>
                    )}

                    {edge.label && (
                        <g 
                            transform={`translate(${midX + labelOff.x}, ${midY + labelOff.y})`}
                            onPointerDown={(e) => {
                                if (mode === 'select') {
                                    e.stopPropagation();
                                    const coords = getMouseCoords(e);
                                    setDraggingEdgeLabel(edge.id);
                                    setDragInfo({ startX: coords.x, startY: coords.y, initialNodes: nodes, initialEdges: edges });
                                }
                            }}
                            style={{ cursor: mode === 'select' ? 'move' : 'default' }}
                        >
                            <text textAnchor="middle" dominantBaseline="central" fontSize="15" fontFamily="Times New Roman, serif" fill="black" fontWeight="bold" style={{ userSelect: 'none' }}>
                                {edge.label}
                            </text>
                        </g>
                    )}
                </g>
            );

        } else if (edge.isCurve && edge.cp1) {
            path = `M ${fromNode.x} ${fromNode.y} Q ${edge.cp1.x} ${edge.cp1.y} ${toNode.x} ${toNode.y}`;
            midX = 0.25 * fromNode.x + 0.5 * edge.cp1.x + 0.25 * toNode.x;
            midY = 0.25 * fromNode.y + 0.5 * edge.cp1.y + 0.25 * toNode.y;
            // The tangent derivative B'(0.5) of a quadratic Bezier is strictly parallel to (toNode - fromNode)
            const dx = toNode.x - fromNode.x;
            const dy = toNode.y - fromNode.y;
            arrowAngle = Math.atan2(dy, dx) * 180 / Math.PI;
        } else {
            path = `M ${fromNode.x} ${fromNode.y} L ${toNode.x} ${toNode.y}`;
            midX = (fromNode.x + toNode.x) / 2;
            midY = (fromNode.y + toNode.y) / 2;
            const dx = toNode.x - fromNode.x;
            const dy = toNode.y - fromNode.y;
            arrowAngle = Math.atan2(dy, dx) * 180 / Math.PI;
        }

        const graphCenterX = nodes.length > 0 ? nodes.reduce((sum, n) => sum + n.x, 0) / nodes.length : 400;
        const graphCenterY = nodes.length > 0 ? nodes.reduce((sum, n) => sum + n.y, 0) / nodes.length : 300;

        const edx = toNode.x - fromNode.x;
        const edy = toNode.y - fromNode.y;
        const eDist = Math.hypot(edx, edy) || 1;
        const ux = edx / eDist;
        const uy = edy / eDist;

        // Normal candidate
        const normX = -uy;
        const normY = ux;

        // Vector from graph center to midpoint
        const vcx = midX - graphCenterX;
        const vcy = midY - graphCenterY;

        // Push outwards from graph center
        const dot = normX * vcx + normY * vcy;
        const outX = dot >= 0 ? normX : -normX;
        const outY = dot >= 0 ? normY : -normY;

        const defOffX = outX * 15;
        const defOffY = outY * 15;
        const labelOff = {
            x: defOffX + (edge.labelOffset?.x || 0),
            y: defOffY + (edge.labelOffset?.y || 0)
        };

        return (
            <g key={edge.id} onPointerDown={(e) => handleEdgePointerDown(e, edge.id)}>
                <path d={path} fill="none" stroke="transparent" strokeWidth="20" />
                <path 
                    d={path} 
                    fill="none" 
                    stroke={isSelected ? "#4f46e5" : "black"} 
                    strokeWidth="2" 
                    strokeDasharray={edge.isDummy ? "6,6" : "none"}
                />
                
                {edge.isDirected && (
                    <polygon 
                        points="-6,-6 6,0 -6,6" 
                        fill={isSelected ? "#4f46e5" : "black"}
                        transform={`translate(${midX}, ${midY}) rotate(${arrowAngle})`}
                        style={{ pointerEvents: 'none' }}
                    />
                )}

                {isSelected && edge.isCurve && edge.cp1 && (
                    <>
                        <line x1={fromNode.x} y1={fromNode.y} x2={edge.cp1.x} y2={edge.cp1.y} stroke="gray" strokeDasharray="3,3" />
                        <line x1={toNode.x} y1={toNode.y} x2={edge.cp1.x} y2={edge.cp1.y} stroke="gray" strokeDasharray="3,3" />
                        <circle 
                            cx={edge.cp1.x} 
                            cy={edge.cp1.y} 
                            r={6} 
                            fill="#4f46e5" 
                            onPointerDown={(e) => { 
                                e.stopPropagation(); 
                                const coords = getMouseCoords(e);
                                setDraggingCP(edge.id); 
                                setDragInfo({ startX: coords.x, startY: coords.y, initialNodes: nodes, initialEdges: edges });
                            }}
                            style={{ cursor: 'move' }}
                        />
                    </>
                )}
                
                {edge.label && (
                    <g 
                        transform={`translate(${midX + labelOff.x}, ${midY + labelOff.y})`}
                        onPointerDown={(e) => {
                            if (mode === 'select') {
                                e.stopPropagation();
                                const coords = getMouseCoords(e);
                                setDraggingEdgeLabel(edge.id);
                                setDragInfo({ startX: coords.x, startY: coords.y, initialNodes: nodes, initialEdges: edges });
                            }
                        }}
                        style={{ cursor: mode === 'select' ? 'move' : 'default' }}
                    >
                        <text textAnchor="middle" dominantBaseline="central" fontSize="15" fontFamily="Times New Roman, serif" fill="black" fontWeight="bold" style={{ userSelect: 'none' }}>
                            {edge.label}
                        </text>
                    </g>
                )}
            </g>
        );
    };

    const singleSelectedNode = selectedNodes.length === 1 && selectedEdges.length === 0 ? selectedNodes[0] : null;
    const singleSelectedEdge = selectedEdges.length === 1 && selectedNodes.length === 0 ? selectedEdges[0] : null;
    const multiSelected = selectedNodes.length > 1 || selectedEdges.length > 1 || (selectedNodes.length > 0 && selectedEdges.length > 0);

    return (
        <div className="flex flex-col h-full bg-white">
            <div className="flex border-b bg-white items-center flex-wrap">
                <div className="p-3 flex gap-2 border-r">
                    <button onClick={() => setInputType('manual')} className={`px-3 py-1.5 rounded font-medium text-sm transition-colors ${inputType === 'manual' ? 'bg-indigo-600 text-white shadow-xs' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}>Manual Draw</button>
                    <button onClick={() => setInputType('matrix')} className={`px-3 py-1.5 rounded font-medium text-sm transition-colors ${inputType === 'matrix' ? 'bg-indigo-600 text-white shadow-xs' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}>Adjacency Matrix</button>
                    <button onClick={() => setInputType('precedence')} className={`px-3 py-1.5 rounded font-medium text-sm transition-colors ${inputType === 'precedence' ? 'bg-indigo-600 text-white shadow-xs' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}>Precedence Table</button>
                </div>
                {inputType === 'manual' && (
                    <div className="p-3 flex flex-wrap gap-2 items-center">
                        <div className="flex bg-gray-100 rounded-md p-1">
                            <button onClick={() => setMode('select')} className={`px-2.5 py-1 rounded-md text-xs font-medium flex items-center gap-1.5 ${mode === 'select' ? 'bg-white shadow-sm text-indigo-600' : 'text-gray-600 hover:text-gray-900'}`}>
                                <Pointer size={14} /> Select
                            </button>
                            <button onClick={() => setMode('addNode')} className={`px-2.5 py-1 rounded-md text-xs font-medium flex items-center gap-1.5 ${mode === 'addNode' ? 'bg-white shadow-sm text-indigo-600' : 'text-gray-600 hover:text-gray-900'}`}>
                                <Circle size={14} /> Add Vertices
                            </button>
                            <button onClick={() => setMode('addEdge')} className={`px-2.5 py-1 rounded-md text-xs font-medium flex items-center gap-1.5 ${mode === 'addEdge' ? 'bg-white shadow-sm text-indigo-600' : 'text-gray-600 hover:text-gray-900'}`}>
                                <MoveUpRight size={14} /> Add Edges
                            </button>
                            <button onClick={() => setMode('addDirectedEdge')} className={`px-2.5 py-1 rounded-md text-xs font-medium flex items-center gap-1.5 ${mode === 'addDirectedEdge' ? 'bg-white shadow-sm text-indigo-600' : 'text-gray-600 hover:text-gray-900'}`}>
                                → Directed
                            </button>
                            <button onClick={() => setMode('addLoop')} className={`px-2.5 py-1 rounded-md text-xs font-medium flex items-center gap-1.5 ${mode === 'addLoop' ? 'bg-white shadow-sm text-indigo-600' : 'text-gray-600 hover:text-gray-900'}`}>
                                ⟲ Loop
                            </button>
                            <button onClick={() => setMode('addDummyEdge')} className={`px-2.5 py-1 rounded-md text-xs font-medium flex items-center gap-1.5 ${mode === 'addDummyEdge' ? 'bg-white shadow-sm text-indigo-600' : 'text-gray-600 hover:text-gray-900'}`}>
                                ⇢ Dummy
                            </button>
                        </div>
                    </div>
                )}

                {/* Easy Vertex Style Selector in Top Bar */}
                <div className="p-3 flex items-center gap-1 border-l">
                    <div className="flex items-center bg-gray-100 rounded-md p-1 border border-gray-200">
                        <span className="text-[11px] font-semibold text-gray-500 px-2 select-none whitespace-nowrap">
                            Vertex Style:
                        </span>
                        <button 
                            onClick={() => applyVertexStyle('none')} 
                            className={`px-2.5 py-1 rounded text-xs font-medium flex items-center gap-1.5 transition-all whitespace-nowrap ${
                                globalVertexStyle === 'none' 
                                    ? 'bg-white shadow-sm text-indigo-700 font-semibold' 
                                    : 'text-gray-600 hover:text-gray-900 hover:bg-gray-200/50'
                            }`}
                            title="Just dots with no labels"
                        >
                            <span className="w-2.5 h-2.5 rounded-full bg-current inline-block" />
                            <span>Dots (No Labels)</span>
                        </button>
                        <button 
                            onClick={() => applyVertexStyle('outside')} 
                            className={`px-2.5 py-1 rounded text-xs font-medium flex items-center gap-1.5 transition-all whitespace-nowrap ${
                                globalVertexStyle === 'outside' 
                                    ? 'bg-white shadow-sm text-indigo-700 font-semibold' 
                                    : 'text-gray-600 hover:text-gray-900 hover:bg-gray-200/50'
                            }`}
                            title="Dots with labels outside (pushed outwards away from center and connecting edges)"
                        >
                            <div className="relative flex items-center justify-center w-3 h-3">
                                <span className="w-2 h-2 rounded-full bg-current inline-block" />
                                <span className="text-[8px] font-bold absolute -top-1 -right-1">a</span>
                            </div>
                            <span>Dots + Labels Outside</span>
                        </button>
                        <button 
                            onClick={() => applyVertexStyle('inside')} 
                            className={`px-2.5 py-1 rounded text-xs font-medium flex items-center gap-1.5 transition-all whitespace-nowrap ${
                                globalVertexStyle === 'inside' 
                                    ? 'bg-white shadow-sm text-indigo-700 font-semibold' 
                                    : 'text-gray-600 hover:text-gray-900 hover:bg-gray-200/50'
                            }`}
                            title="Circles with labels inside"
                        >
                            <span className="w-3.5 h-3.5 rounded-full border border-current inline-flex items-center justify-center text-[8px] font-bold">A</span>
                            <span>Circles + Labels Inside</span>
                        </button>
                    </div>
                </div>

                <div className="p-3 flex justify-end flex-1 ml-auto">
                    <GraphToolbar 
                        onExportPNG={handleExportPNG}
                        onExportSVG={handleExportSVG}
                        onCopy={handleCopy}
                        isCopied={isCopied}
                        exportDpi={exportDpi}
                        onDpiChange={setExportDpi}
                    />
                </div>
            </div>

            <div className="flex-1 flex overflow-hidden">
                <div className="w-80 border-r bg-gray-50 flex flex-col">
                    <div className="p-4 border-b font-semibold text-gray-700 flex items-center justify-between">
                        <span>
                            {inputType === 'manual' && 'Properties'}
                            {inputType === 'matrix' && 'Adjacency Matrix'}
                            {inputType === 'precedence' && 'Precedence Table'}
                        </span>
                        {inputType !== 'manual' && (
                            <button
                                onClick={() => setInputType('manual')}
                                className="text-xs text-indigo-600 hover:text-indigo-800 font-normal underline"
                            >
                                Edit on Canvas
                            </button>
                        )}
                    </div>
                    <div className="p-4 flex-1 overflow-y-auto">
                        {inputType === 'matrix' && (
                            <div className="space-y-4">
                                <div>
                                    <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Load Preset</label>
                                    <select 
                                        className="w-full border rounded p-2 focus:ring-2 focus:ring-indigo-500 focus:outline-none text-sm bg-white"
                                        onChange={(e) => {
                                            const preset = MATRIX_PRESETS.find(p => p.name === e.target.value);
                                            if (preset) {
                                                setMatrixInput(preset.value);
                                                setIsDirectedGeneral(preset.directed);
                                                applyMatrixToGraph(preset.value, preset.directed, showMatrixWeights, false, preset.positions);
                                            }
                                        }}
                                        defaultValue=""
                                    >
                                        <option value="" disabled>Select a preset...</option>
                                        {MATRIX_PRESETS.map(p => (
                                            <option key={p.name} value={p.name}>{p.name}</option>
                                        ))}
                                    </select>
                                </div>

                                <div className="space-y-2 bg-white p-2.5 rounded border">
                                    <div className="flex items-center gap-2">
                                        <input 
                                            type="checkbox" 
                                            id="directed-matrix-toggle"
                                            checked={isDirectedGeneral} 
                                            onChange={e => {
                                                const checked = e.target.checked;
                                                setIsDirectedGeneral(checked);
                                                applyMatrixToGraph(matrixInput, checked, showMatrixWeights, true);
                                            }}
                                            className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                                        />
                                        <label htmlFor="directed-matrix-toggle" className="text-sm font-medium text-gray-700 cursor-pointer">
                                            Directed Graph
                                        </label>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <input 
                                            type="checkbox" 
                                            id="show-weights-toggle"
                                            checked={showMatrixWeights} 
                                            onChange={e => {
                                                const checked = e.target.checked;
                                                setShowMatrixWeights(checked);
                                                applyMatrixToGraph(matrixInput, isDirectedGeneral, checked, true);
                                            }}
                                            className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                                        />
                                        <label htmlFor="show-weights-toggle" className="text-sm font-medium text-gray-700 cursor-pointer">
                                            Show Edge Weights
                                        </label>
                                    </div>
                                </div>

                                <div>
                                    <div className="flex justify-between items-center mb-1">
                                        <label className="block text-xs font-semibold text-gray-500 uppercase">Matrix Input (Weights)</label>
                                        <span className="text-[11px] text-gray-400">0 = no edge</span>
                                    </div>
                                    <textarea 
                                        className="w-full border rounded p-2.5 font-mono text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none bg-white h-32"
                                        value={matrixInput}
                                        onChange={e => {
                                            const val = e.target.value;
                                            setMatrixInput(val);
                                            applyMatrixToGraph(val, isDirectedGeneral, showMatrixWeights, true);
                                        }}
                                        placeholder={"0 4 2 0\n4 0 1 5\n2 1 0 8\n0 5 8 0"}
                                    />
                                </div>

                                <div className="space-y-2">
                                    <button 
                                        onClick={handleGenerateFromMatrix}
                                        className="w-full bg-indigo-600 text-white py-2 rounded text-sm font-medium hover:bg-indigo-700 transition-colors flex items-center justify-center gap-2 shadow-sm"
                                    >
                                        <Sparkles size={16} /> Generate Graph
                                    </button>
                                    <button 
                                        onClick={handleSyncMatrixFromGraph}
                                        disabled={nodes.length === 0}
                                        className="w-full bg-white border border-gray-300 text-gray-700 py-2 rounded text-sm font-medium hover:bg-gray-50 transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
                                    >
                                        <RefreshCw size={14} /> Read from Canvas
                                    </button>
                                </div>

                                {(() => {
                                    const { matrix, labels } = parseAdjacencyMatrix(matrixInput);
                                    if (matrix.length === 0) return null;
                                    return (
                                        <div className="mt-4 pt-4 border-t">
                                            <div className="flex items-center justify-between mb-2">
                                                <div className="text-xs font-semibold text-gray-700 uppercase">Table & Weight Editor</div>
                                                <div className="flex items-center gap-1">
                                                    <button
                                                        onClick={handleAddMatrixNode}
                                                        title="Add Vertex"
                                                        className="p-1 rounded bg-white border text-gray-600 hover:text-indigo-600 hover:border-indigo-300 text-xs flex items-center gap-0.5"
                                                    >
                                                        <Plus size={12} /> Vertex
                                                    </button>
                                                    <button
                                                        onClick={handleRemoveMatrixNode}
                                                        disabled={matrix.length <= 2}
                                                        title="Remove Vertex"
                                                        className="p-1 rounded bg-white border text-gray-600 hover:text-red-600 hover:border-red-300 disabled:opacity-40 text-xs flex items-center gap-0.5"
                                                    >
                                                        <Minus size={12} />
                                                    </button>
                                                    <button
                                                        onClick={handleClearMatrixEdges}
                                                        title="Clear All Edges"
                                                        className="p-1 rounded bg-white border text-gray-600 hover:text-red-600 hover:border-red-300 text-xs"
                                                    >
                                                        <Trash2 size={12} />
                                                    </button>
                                                </div>
                                            </div>
                                            <div className="text-[11px] text-gray-500 mb-2">
                                                Edit cell weights directly (0 = no edge):
                                            </div>
                                            <div className="overflow-x-auto bg-white border rounded shadow-xs max-h-72">
                                                <table className="min-w-full text-xs text-center border-collapse">
                                                    <thead>
                                                        <tr className="bg-gray-100 border-b sticky top-0 z-10">
                                                            <th className="p-1 font-semibold text-gray-500 border-r w-8 bg-gray-100"></th>
                                                            {labels.slice(0, matrix.length).map((l, i) => (
                                                                <th key={i} className="p-1 font-bold text-gray-700 bg-gray-100 min-w-[38px]">{l}</th>
                                                            ))}
                                                        </tr>
                                                    </thead>
                                                    <tbody>
                                                        {matrix.map((row, i) => (
                                                            <tr key={i} className="border-b last:border-b-0 hover:bg-gray-50/50">
                                                                <td className="p-1 font-bold text-gray-700 bg-gray-50 border-r">{labels[i] || i}</td>
                                                                {row.map((val, j) => {
                                                                    const isLoop = i === j;
                                                                    const hasEdge = val > 0;
                                                                    return (
                                                                        <td key={j} className={`p-0.5 border-r last:border-r-0 ${isLoop ? 'bg-amber-50/30' : ''}`}>
                                                                            <input 
                                                                                type="text"
                                                                                className={`w-9 h-7 text-center font-mono text-xs rounded border transition-colors focus:outline-none focus:ring-1 focus:ring-indigo-500 ${
                                                                                    hasEdge 
                                                                                        ? 'bg-indigo-50 text-indigo-800 font-bold border-indigo-200 focus:bg-white' 
                                                                                        : 'bg-transparent text-gray-400 border-transparent hover:border-gray-200 focus:bg-white focus:text-gray-800 focus:border-gray-300'
                                                                                }`}
                                                                                value={val === 0 ? '0' : val}
                                                                                onChange={(e) => handleMatrixCellEdit(i, j, e.target.value)}
                                                                                title={isLoop ? `Loop on ${labels[i]}` : `${labels[i]} → ${labels[j]}`}
                                                                            />
                                                                        </td>
                                                                    );
                                                                })}
                                                            </tr>
                                                        ))}
                                                    </tbody>
                                                </table>
                                            </div>
                                        </div>
                                    );
                                })()}
                            </div>
                        )}

                        {inputType === 'precedence' && (
                            <div className="space-y-4">
                                <div>
                                    <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Load Preset</label>
                                    <select 
                                        className="w-full border rounded p-2 focus:ring-2 focus:ring-indigo-500 focus:outline-none text-sm bg-white"
                                        onChange={(e) => {
                                            const preset = PRECEDENCE_PRESETS.find(p => p.name === e.target.value);
                                            if (preset) {
                                                setPrecedenceInput(preset.value);
                                                setGlobalVertexStyle('none');
                                                const res = generateActivityNetwork(preset.value, 800, 600);
                                                const adjustedNodes = res.nodes.map(n => ({
                                                    ...n,
                                                    labelStyle: 'none' as const,
                                                    radius: 6
                                                }));

                                                setNodes(adjustedNodes);
                                                setEdges(res.edges);
                                                setSelectedNodes([]);
                                                setSelectedEdges([]);
                                            }
                                        }}
                                        defaultValue=""
                                    >
                                        <option value="" disabled>Select project preset...</option>
                                        {Array.from(new Set(PRECEDENCE_PRESETS.map(p => p.category))).map(cat => (
                                            <optgroup key={cat} label={cat}>
                                                {PRECEDENCE_PRESETS.filter(p => p.category === cat).map(p => (
                                                    <option key={p.name} value={p.name}>{p.name}</option>
                                                ))}
                                            </optgroup>
                                        ))}
                                    </select>
                                </div>

                                <div>
                                    <div className="flex justify-between items-center mb-1">
                                        <label className="block text-xs font-semibold text-gray-500 uppercase">Precedence Input</label>
                                        <span className="text-[11px] text-gray-400">Activity, Preds, Duration</span>
                                    </div>
                                    <textarea 
                                        className="w-full border rounded p-2.5 font-mono text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none bg-white h-36"
                                        value={precedenceInput}
                                        onChange={e => setPrecedenceInput(e.target.value)}
                                        placeholder={"A, -, 5\nB, A, 2\nC, A, 3\nD, B;C, 4"}
                                    />
                                    <div className="text-[11px] text-gray-500 mt-1">
                                        Format: <code className="bg-gray-200 px-1 py-0.5 rounded text-gray-800">Act, Pred1;Pred2, Dur</code>
                                    </div>
                                </div>

                                <div className="space-y-2">
                                    <button 
                                        onClick={handleGenerateFromPrecedence}
                                        className="w-full bg-indigo-600 text-white py-2 rounded text-sm font-medium hover:bg-indigo-700 transition-colors flex items-center justify-center gap-2 shadow-sm"
                                    >
                                        <Sparkles size={16} /> Generate Activity Network
                                    </button>
                                    <button 
                                        onClick={handleExtractPrecedenceFromGraph}
                                        disabled={nodes.length === 0}
                                        className="w-full bg-white border border-gray-300 text-gray-700 py-2 rounded text-sm font-medium hover:bg-gray-50 transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
                                    >
                                        <RefreshCw size={14} /> Extract from Canvas
                                    </button>
                                </div>

                                {(() => {
                                    const rows = precedenceInput.trim().split('\n').map(r => r.split(',').map(s => s.trim())).filter(r => r[0]);
                                    if (rows.length === 0) return null;
                                    return (
                                        <div className="mt-4 pt-4 border-t">
                                            <div className="text-xs font-semibold text-gray-500 uppercase mb-2">Precedence Table</div>
                                            <div className="overflow-x-auto bg-white border rounded">
                                                <table className="min-w-full text-xs text-left border-collapse">
                                                    <thead>
                                                        <tr className="bg-gray-100 border-b text-gray-600 font-semibold">
                                                            <th className="p-2">Activity</th>
                                                            <th className="p-2">Predecessors</th>
                                                            <th className="p-2">Duration</th>
                                                        </tr>
                                                    </thead>
                                                    <tbody>
                                                        {rows.map((row, idx) => (
                                                            <tr key={idx} className="border-b last:border-b-0 hover:bg-gray-50">
                                                                <td className="p-2 font-bold text-indigo-700">{row[0]}</td>
                                                                <td className="p-2 text-gray-700">{row[1] || '-'}</td>
                                                                <td className="p-2 font-mono text-gray-700">{row[2] || '-'}</td>
                                                            </tr>
                                                        ))}
                                                    </tbody>
                                                </table>
                                            </div>
                                        </div>
                                    );
                                })()}
                            </div>
                        )}
                        {inputType === 'manual' && nodes.length === 0 && (
                            <div className="space-y-4 mb-6 pb-6 border-b border-gray-200">
                                <h3 className="font-medium text-sm">Quick Start</h3>
                                <div className="flex gap-2 items-center">
                                    <input 
                                        type="number" 
                                        value={initialVerticesCount} 
                                        onChange={e => setInitialVerticesCount(Number(e.target.value))}
                                        className="w-16 border rounded p-1.5 text-sm"
                                        min={1} max={50}
                                    />
                                    <span className="text-sm text-gray-600">Vertices</span>
                                </div>
                                <button 
                                    className="w-full bg-indigo-600 text-white py-2 rounded text-sm font-medium hover:bg-indigo-700 transition-colors"
                                    onClick={() => {
                                        const newNodes = generateRegularPolygon(initialVerticesCount, 400, 300);
                                        setNodes(newNodes);
                                    }}
                                >
                                    Generate Initial Layout
                                </button>
                            </div>
                        )}

                        {inputType === 'manual' && singleSelectedNode && (
                            <div className="space-y-4 bg-white p-4 rounded-lg border shadow-sm">
                                <h3 className="font-medium text-indigo-900">Vertex Properties</h3>
                                <div>
                                    <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Label</label>
                                    <input 
                                        type="text" 
                                        className="w-full border rounded p-2 focus:ring-2 focus:ring-indigo-500 focus:outline-none text-sm"
                                        value={nodes.find(n => n.id === singleSelectedNode)?.label || ''}
                                        onChange={(e) => setNodes(nodes.map(n => n.id === singleSelectedNode ? { ...n, label: e.target.value } : n))}
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-semibold text-gray-500 uppercase mb-1.5">Vertex Style</label>
                                    <div className="grid grid-cols-3 gap-1 bg-gray-100 p-1 rounded-md mb-2">
                                        <button
                                            onClick={() => applyVertexStyle('none', [singleSelectedNode])}
                                            className={`p-2 rounded text-xs font-medium flex flex-col items-center gap-1 transition-all ${
                                                nodes.find(n => n.id === singleSelectedNode)?.labelStyle === 'none'
                                                    ? 'bg-white shadow-xs text-indigo-700 font-semibold'
                                                    : 'text-gray-600 hover:text-gray-900'
                                            }`}
                                            title="Just dots with no labels"
                                        >
                                            <span className="w-2.5 h-2.5 rounded-full bg-current" />
                                            <span>No Label</span>
                                        </button>
                                        <button
                                            onClick={() => applyVertexStyle('outside', [singleSelectedNode])}
                                            className={`p-2 rounded text-xs font-medium flex flex-col items-center gap-1 transition-all ${
                                                nodes.find(n => n.id === singleSelectedNode)?.labelStyle === 'outside'
                                                    ? 'bg-white shadow-xs text-indigo-700 font-semibold'
                                                    : 'text-gray-600 hover:text-gray-900'
                                            }`}
                                            title="Dots with labels outside (pushed outwards away from edges)"
                                        >
                                            <div className="relative flex items-center justify-center w-3 h-3">
                                                <span className="w-2 h-2 rounded-full bg-current" />
                                                <span className="text-[8px] font-bold absolute -top-1 -right-1">a</span>
                                            </div>
                                            <span>Outside</span>
                                        </button>
                                        <button
                                            onClick={() => applyVertexStyle('inside', [singleSelectedNode])}
                                            className={`p-2 rounded text-xs font-medium flex flex-col items-center gap-1 transition-all ${
                                                nodes.find(n => n.id === singleSelectedNode)?.labelStyle === 'inside'
                                                    ? 'bg-white shadow-xs text-indigo-700 font-semibold'
                                                    : 'text-gray-600 hover:text-gray-900'
                                            }`}
                                            title="Circles with labels inside"
                                        >
                                            <span className="w-3.5 h-3.5 rounded-full border border-current flex items-center justify-center text-[8px] font-bold">A</span>
                                            <span>Inside</span>
                                        </button>
                                    </div>
                                    <div className="flex flex-col gap-1.5 mt-1">
                                        <button
                                            onClick={() => applyVertexStyle(nodes.find(n => n.id === singleSelectedNode)?.labelStyle || 'inside')}
                                            className="text-left text-xs text-indigo-600 hover:text-indigo-800 font-medium"
                                        >
                                            ↳ Apply this style to all vertices
                                        </button>
                                        {nodes.find(n => n.id === singleSelectedNode)?.labelStyle === 'outside' && (
                                            <button
                                                onClick={() => {
                                                    const target = nodes.find(n => n.id === singleSelectedNode);
                                                    if (target) {
                                                        const offset = computeSmartOutsideLabelOffset(target, nodes, edges);
                                                        setNodes(nodes.map(n => n.id === singleSelectedNode ? { ...n, labelOffset: offset } : n));
                                                    }
                                                }}
                                                className="text-left text-xs text-gray-500 hover:text-gray-700 flex items-center gap-1"
                                            >
                                                <RotateCw size={11} /> Auto-align label away from edges
                                            </button>
                                        )}
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Radius</label>
                                    <input 
                                        type="number" 
                                        className="w-full border rounded p-2 focus:ring-2 focus:ring-indigo-500 focus:outline-none text-sm"
                                        value={nodes.find(n => n.id === singleSelectedNode)?.radius || 6}
                                        onChange={(e) => setNodes(nodes.map(n => n.id === singleSelectedNode ? { ...n, radius: Number(e.target.value) } : n))}
                                    />
                                </div>
                                <button 
                                    className="w-full bg-red-50 text-red-600 border border-red-200 py-2 rounded text-sm font-medium flex items-center justify-center gap-2 hover:bg-red-100 transition-colors mt-4"
                                    onClick={() => {
                                        setEdges(edges.filter(e => e.from !== singleSelectedNode && e.to !== singleSelectedNode));
                                        setNodes(nodes.filter(n => n.id !== singleSelectedNode));
                                        setSelectedNodes([]);
                                    }}
                                >
                                    <Trash2 size={16} /> Delete Vertex
                                </button>
                            </div>
                        )}

                        {inputType === 'manual' && singleSelectedEdge && (
                            <div className="space-y-4 bg-white p-4 rounded-lg border shadow-sm">
                                <h3 className="font-medium text-indigo-900">Edge Properties</h3>
                                <div>
                                    <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Label / Weight</label>
                                    <input 
                                        type="text" 
                                        className="w-full border rounded p-2 focus:ring-2 focus:ring-indigo-500 focus:outline-none text-sm"
                                        value={edges.find(e => e.id === singleSelectedEdge)?.label || ''}
                                        onChange={(e) => setEdges(edges.map(e2 => e2.id === singleSelectedEdge ? { ...e2, label: e.target.value } : e2))}
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label className="flex items-center gap-2 text-sm text-gray-700">
                                        <input 
                                            type="checkbox" 
                                            checked={edges.find(e => e.id === singleSelectedEdge)?.isDirected || false}
                                            onChange={(e) => setEdges(edges.map(e2 => e2.id === singleSelectedEdge ? { ...e2, isDirected: e.target.checked } : e2))}
                                            className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                                        />
                                        Directed
                                    </label>
                                    <label className="flex items-center gap-2 text-sm text-gray-700">
                                        <input 
                                            type="checkbox" 
                                            checked={edges.find(e => e.id === singleSelectedEdge)?.isDummy || false}
                                            onChange={(e) => setEdges(edges.map(e2 => e2.id === singleSelectedEdge ? { ...e2, isDummy: e.target.checked } : e2))}
                                            className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                                        />
                                        Dummy (Dashed)
                                    </label>
                                </div>
                                
                                {edges.find(e => e.id === singleSelectedEdge)?.isLoop ? (
                                    <>
                                        <div className="text-xs text-gray-500 mt-2">
                                            Tip: Drag the blue anchor point on the canvas to rotate and resize the loop.
                                        </div>
                                        <div>
                                            <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Eccentricity (Width)</label>
                                            <input 
                                                type="number" 
                                                step="0.1"
                                                className="w-full border rounded p-1.5 focus:ring-2 focus:ring-indigo-500 focus:outline-none text-sm"
                                                value={edges.find(e => e.id === singleSelectedEdge)?.loopRadiusY ?? 1.0}
                                                onChange={(e) => setEdges(edges.map(e2 => e2.id === singleSelectedEdge ? { ...e2, loopRadiusY: Number(e.target.value) } : e2))}
                                            />
                                        </div>
                                    </>
                                ) : (
                                    <label className="flex items-center gap-2 text-sm text-gray-700 mt-2">
                                        <input 
                                            type="checkbox" 
                                            checked={edges.find(e => e.id === singleSelectedEdge)?.isCurve || false}
                                            onChange={(e) => {
                                                const checked = e.target.checked;
                                                setEdges(edges.map(e2 => {
                                                    if (e2.id === singleSelectedEdge) {
                                                        if (checked && !e2.cp1) {
                                                            const fromNode = nodes.find(n => n.id === e2.from);
                                                            const toNode = nodes.find(n => n.id === e2.to);
                                                            if (fromNode && toNode) {
                                                                const midX = (fromNode.x + toNode.x) / 2;
                                                                const midY = (fromNode.y + toNode.y) / 2;
                                                                const dx = toNode.x - fromNode.x;
                                                                const dy = toNode.y - fromNode.y;
                                                                const dist = Math.hypot(dx, dy) || 1;
                                                                const ux = dx / dist;
                                                                const uy = dy / dist;
                                                                const n1 = { x: -uy, y: ux };
                                                                const n2 = { x: uy, y: -ux };
                                                                const gcx = nodes.length > 0 ? nodes.reduce((s, n) => s + n.x, 0) / nodes.length : 400;
                                                                const gcy = nodes.length > 0 ? nodes.reduce((s, n) => s + n.y, 0) / nodes.length : 300;
                                                                const vcx = midX - gcx;
                                                                const vcy = midY - gcy;
                                                                const outN = (n1.x * vcx + n1.y * vcy >= 0) ? n1 : n2;
                                                                const arc = Math.max(35, Math.min(80, dist * 0.25));
                                                                return { ...e2, isCurve: true, cp1: { x: midX + outN.x * arc, y: midY + outN.y * arc } };
                                                            }
                                                        }
                                                        return { ...e2, isCurve: checked };
                                                    }
                                                    return e2;
                                                }));
                                            }}
                                            className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                                        />
                                        Curve Edge
                                    </label>
                                )}
                                
                                <button 
                                    className="w-full bg-red-50 text-red-600 border border-red-200 py-2 rounded flex items-center justify-center gap-2 hover:bg-red-100 transition-colors mt-4 text-sm font-medium"
                                    onClick={() => {
                                        setEdges(edges.filter(e => e.id !== singleSelectedEdge));
                                        setSelectedEdges([]);
                                    }}
                                >
                                    <Trash2 size={16} /> Delete Edge
                                </button>
                            </div>
                        )}

                        {inputType === 'manual' && multiSelected && (
                            <div className="space-y-4 bg-white p-4 rounded-lg border shadow-sm">
                                <h3 className="font-medium text-indigo-900">Multiple Items Selected</h3>
                                <div className="text-sm text-gray-600">
                                    {selectedNodes.length} vertices and {selectedEdges.length} edges selected.
                                </div>

                                {selectedNodes.length > 0 && (
                                    <div className="space-y-2 pt-3 border-t border-gray-100">
                                        <label className="block text-xs font-semibold text-gray-500 uppercase">Style Selected Vertices</label>
                                        <div className="grid grid-cols-3 gap-1 bg-gray-100 p-1 rounded-md">
                                            <button
                                                onClick={() => applyVertexStyle('none', selectedNodes)}
                                                className="p-2 rounded text-xs font-medium flex flex-col items-center gap-1 text-gray-700 hover:bg-white hover:shadow-xs transition-all"
                                                title="Just dots with no labels"
                                            >
                                                <span className="w-2.5 h-2.5 rounded-full bg-current" />
                                                <span>No Label</span>
                                            </button>
                                            <button
                                                onClick={() => applyVertexStyle('outside', selectedNodes)}
                                                className="p-2 rounded text-xs font-medium flex flex-col items-center gap-1 text-gray-700 hover:bg-white hover:shadow-xs transition-all"
                                                title="Dots with labels outside"
                                            >
                                                <div className="relative flex items-center justify-center w-3 h-3">
                                                    <span className="w-2 h-2 rounded-full bg-current" />
                                                    <span className="text-[8px] font-bold absolute -top-1 -right-1">a</span>
                                                </div>
                                                <span>Outside</span>
                                            </button>
                                            <button
                                                onClick={() => applyVertexStyle('inside', selectedNodes)}
                                                className="p-2 rounded text-xs font-medium flex flex-col items-center gap-1 text-gray-700 hover:bg-white hover:shadow-xs transition-all"
                                                title="Circles with labels inside"
                                            >
                                                <span className="w-3.5 h-3.5 rounded-full border border-current flex items-center justify-center text-[8px] font-bold">A</span>
                                                <span>Inside</span>
                                            </button>
                                        </div>
                                    </div>
                                )}

                                {selectedNodes.length > 0 && selectedEdges.length > 0 && (
                                    <div className="space-y-2 mt-4 pt-4 border-t border-gray-100">
                                        <button 
                                            className="w-full bg-indigo-50 text-indigo-700 border border-indigo-200 py-1.5 rounded flex items-center justify-center gap-2 hover:bg-indigo-100 transition-colors text-sm font-medium"
                                            onClick={() => setSelectedEdges([])}
                                        >
                                            Select Vertices Only
                                        </button>
                                        <button 
                                            className="w-full bg-indigo-50 text-indigo-700 border border-indigo-200 py-1.5 rounded flex items-center justify-center gap-2 hover:bg-indigo-100 transition-colors text-sm font-medium"
                                            onClick={() => setSelectedNodes([])}
                                        >
                                            Select Edges Only
                                        </button>
                                    </div>
                                )}
                                <button 
                                    className="w-full bg-red-50 text-red-600 border border-red-200 py-2 rounded flex items-center justify-center gap-2 hover:bg-red-100 transition-colors mt-4 text-sm font-medium"
                                    onClick={() => {
                                        setEdges(prev => prev.filter(edge => !selectedEdges.includes(edge.id) && !selectedNodes.includes(edge.from) && !selectedNodes.includes(edge.to)));
                                        setNodes(prev => prev.filter(node => !selectedNodes.includes(node.id)));
                                        setSelectedNodes([]);
                                        setSelectedEdges([]);
                                    }}
                                >
                                    <Trash2 size={16} /> Delete Selected
                                </button>
                            </div>
                        )}

                        {inputType === 'manual' && !singleSelectedNode && !singleSelectedEdge && !multiSelected && nodes.length > 0 && (
                            <div className="space-y-4 bg-white p-4 rounded-lg border shadow-sm">
                                <h3 className="font-medium text-indigo-900">Vertex Style</h3>
                                <p className="text-xs text-gray-500">
                                    Quickly switch presentation style for all {nodes.length} vertices:
                                </p>
                                <div className="space-y-2">
                                    <button
                                        onClick={() => applyVertexStyle('none')}
                                        className={`w-full p-2.5 rounded-md border text-left flex items-center gap-3 transition-all ${
                                            globalVertexStyle === 'none'
                                                ? 'border-indigo-600 bg-indigo-50/50 text-indigo-950 ring-1 ring-indigo-600'
                                                : 'border-gray-200 hover:border-gray-300 text-gray-700'
                                        }`}
                                    >
                                        <span className="w-3.5 h-3.5 rounded-full bg-gray-900 shrink-0" />
                                        <div>
                                            <div className="text-xs font-semibold">Dots with no labels</div>
                                            <div className="text-[11px] text-gray-500">Compact solid dots without labels</div>
                                        </div>
                                    </button>

                                    <button
                                        onClick={() => applyVertexStyle('outside')}
                                        className={`w-full p-2.5 rounded-md border text-left flex items-center gap-3 transition-all ${
                                            globalVertexStyle === 'outside'
                                                ? 'border-indigo-600 bg-indigo-50/50 text-indigo-950 ring-1 ring-indigo-600'
                                                : 'border-gray-200 hover:border-gray-300 text-gray-700'
                                        }`}
                                    >
                                        <div className="relative w-4 h-4 shrink-0 flex items-center justify-center">
                                            <span className="w-2.5 h-2.5 rounded-full bg-gray-900 inline-block" />
                                            <span className="absolute -top-1 -right-1 text-[8px] font-bold text-gray-800">A</span>
                                        </div>
                                        <div>
                                            <div className="text-xs font-semibold">Dots with labels outside</div>
                                            <div className="text-[11px] text-gray-500">Pushed outward away from connecting edges</div>
                                        </div>
                                    </button>

                                    <button
                                        onClick={() => applyVertexStyle('inside')}
                                        className={`w-full p-2.5 rounded-md border text-left flex items-center gap-3 transition-all ${
                                            globalVertexStyle === 'inside'
                                                ? 'border-indigo-600 bg-indigo-50/50 text-indigo-950 ring-1 ring-indigo-600'
                                                : 'border-gray-200 hover:border-gray-300 text-gray-700'
                                        }`}
                                    >
                                        <span className="w-4 h-4 rounded-full border-2 border-gray-900 flex items-center justify-center text-[8px] font-bold shrink-0">A</span>
                                        <div>
                                            <div className="text-xs font-semibold">Circles with labels inside</div>
                                            <div className="text-[11px] text-gray-500">Circled nodes with centered text</div>
                                        </div>
                                    </button>
                                </div>

                                {globalVertexStyle === 'outside' && (
                                    <button
                                        onClick={() => applyVertexStyle('outside')}
                                        className="w-full bg-indigo-50 text-indigo-700 border border-indigo-200 py-1.5 rounded text-xs font-medium hover:bg-indigo-100 transition-colors flex items-center justify-center gap-1.5 mt-2"
                                        title="Recalculate label positions away from edges"
                                    >
                                        <RotateCw size={13} /> Re-align Outside Labels
                                    </button>
                                )}
                            </div>
                        )}
                        
                        <div className="mt-8 border-t pt-4">
                            <button className="w-full bg-white border border-gray-300 text-gray-700 py-2 rounded flex items-center justify-center gap-2 text-sm font-medium hover:bg-gray-50 transition-colors" onClick={() => { setNodes([]); setEdges([]); setSelectedNodes([]); setSelectedEdges([]); }}>
                                Clear Canvas
                            </button>
                        </div>
                    </div>
                </div>

                <div className="flex-1 relative bg-gray-200 overflow-hidden flex items-center justify-center p-8">
                    <div className="w-full h-full max-w-5xl max-h-[800px] bg-white shadow-sm border border-gray-300 rounded-sm relative overflow-hidden" id="network-canvas">
                        <svg 
                            id="network-canvas-svg"
                            ref={svgRef}
                            width={800}
                            height={600}
                            viewBox="0 0 800 600"
                            xmlns="http://www.w3.org/2000/svg"
                            className="w-full h-full" 
                            style={{ cursor: mode === 'addNode' ? 'crosshair' : mode === 'select' ? 'default' : 'crosshair', background: '#ffffff' }}
                            onPointerDown={handleSvgPointerDown}
                        >
                            {/* Canvas Background for clean export */}
                            <rect width="800" height="600" fill="#ffffff" />
                            {/* Preview edge when adding */}
                            {edgeStartNode && ['addEdge', 'addDirectedEdge', 'addDummyEdge'].includes(mode) && mousePos && (() => {
                                const startNode = nodes.find(n => n.id === edgeStartNode);
                                if (!startNode) return null;
                                const endX = hoveredNode ? nodes.find(n => n.id === hoveredNode)?.x ?? mousePos.x : mousePos.x;
                                const endY = hoveredNode ? nodes.find(n => n.id === hoveredNode)?.y ?? mousePos.y : mousePos.y;
                                return (
                                    <line x1={startNode.x} y1={startNode.y} x2={endX} y2={endY} stroke="#4f46e5" strokeWidth="2" strokeDasharray="5,5" opacity="0.5" pointerEvents="none" />
                                );
                            })()}

                            {/* Render edges */}
                            {edges.map(renderEdge)}

                            {/* Render nodes */}
                            {nodes.map(node => {
                                const isStartNode = edgeStartNode === node.id;
                                const isHovered = hoveredNode === node.id && ['addEdge', 'addDirectedEdge', 'addDummyEdge'].includes(mode);
                                const isSelected = selectedNodes.includes(node.id);
                                const isHighlighted = isStartNode || isHovered || isSelected;
                                
                                return (
                                <g 
                                    key={node.id} 
                                    transform={`translate(${node.x}, ${node.y})`}
                                    onPointerEnter={() => setHoveredNode(node.id)}
                                    onPointerLeave={() => setHoveredNode(null)}
                                >
                                    <circle 
                                        cx={0} 
                                        cy={0} 
                                        r={node.radius} 
                                        fill={node.labelStyle === 'inside' ? "white" : "black"} 
                                        stroke={isHighlighted ? "#4f46e5" : "black"} 
                                        strokeWidth={isHighlighted ? "3" : "2"} 
                                        onPointerDown={(e) => handleNodePointerDown(e, node.id)}
                                        style={{ cursor: mode === 'select' ? 'move' : 'crosshair' }}
                                    />
                                    
                                    {node.labelStyle === 'inside' && node.label && (
                                        <text 
                                            textAnchor="middle" 
                                            dominantBaseline="central" 
                                            fontSize="15" fontFamily="Times New Roman, serif" 
                                            fill="black"
                                            fontWeight="bold"
                                            pointerEvents="none"
                                        >
                                            {node.label}
                                        </text>
                                    )}

                                    {node.labelStyle === 'outside' && node.label && (
                                        <g 
                                            transform={`translate(${node.labelOffset.x}, ${node.labelOffset.y})`}
                                            style={{ cursor: mode === 'select' ? 'move' : 'default' }}
                                            onPointerDown={(e) => {
                                                if (mode === 'select') {
                                                    e.stopPropagation();
                                                    const coords = getMouseCoords(e);
                                                    setDraggingLabel(node.id);
                                                    setDragInfo({ startX: coords.x, startY: coords.y, initialNodes: nodes, initialEdges: edges });
                                                }
                                            }}
                                        >
                                            <rect x="-15" y="-15" width="30" height="30" fill="white" fillOpacity="0" />
                                            <text 
                                                textAnchor="middle" 
                                                dominantBaseline="central" 
                                                fontSize="15" fontFamily="Times New Roman, serif" 
                                                fill="black"
                                                fontWeight="bold"
                                                style={{ userSelect: 'none' }}
                                            >
                                                {node.label}
                                            </text>
                                        </g>
                                    )}
                                </g>
                            )})}
                            
                            {/* Render Selection Box */}
                            {selectionBox && (
                                <rect 
                                    x={Math.min(selectionBox.startX, selectionBox.currentX)}
                                    y={Math.min(selectionBox.startY, selectionBox.currentY)}
                                    width={Math.abs(selectionBox.currentX - selectionBox.startX)}
                                    height={Math.abs(selectionBox.currentY - selectionBox.startY)}
                                    fill="#4f46e5"
                                    fillOpacity="0.1"
                                    stroke="#4f46e5"
                                    strokeWidth="1"
                                    pointerEvents="none"
                                />
                            )}
                        </svg>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default NetworkGrapher;
