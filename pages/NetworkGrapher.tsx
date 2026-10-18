import React, { useState, useRef, useEffect, MouseEvent as ReactMouseEvent } from 'react';
import { Download, Plus, Minus, Trash2, Settings, Move, Circle, MoveUpRight, Type, Pointer, GripHorizontal, RotateCw, RefreshCw, Grid, Table as TableIcon, Sparkles, Scan } from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';
import { 
    generateRegularNetwork, 
    generateActivityNetwork,
    parseAdjacencyMatrix,
    generateFromAdjacencyMatrix,
    generateAdjacencyMatrixFromGraph,
    generatePrecedenceTableFromGraph
} from '../utils/networkGenerators';
import { downloadSVG, generateGraphImage, copyImageToClipboard, ptToSvgUnits } from '../utils/imageExport';
import { GraphToolbar } from '../components/GraphToolbar';
import { SmartNumberInput } from '../components/SmartNumberInput';
import { useHistory } from '../hooks/useHistory';
import { useGraphInteraction } from '../hooks/useGraphInteraction';

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
    labelOffset?: { x: number, y: number };
}

export type NetworkMode = 'select' | 'addNode' | 'addEdge' | 'addDirectedEdge' | 'addDummyEdge' | 'addLoop' | 'addCut';

export type VertexDisplayStyle = 'none' | 'outside' | 'inside';






export const optimizeLabelPlacements = (
    currentNodes: NetworkNode[],
    currentEdges: NetworkEdge[],
    globalEdgeLabelProximity: number,
    globalVertexLabelProximity: number,
    edgeLabelClearanceRatio: number,
    globalVertexStyle: string,
    globalNodeRadius: number,
    mode: 'all' | 'vertex' | 'edge' = 'all'
): { nodes: NetworkNode[], edges: NetworkEdge[] } => {
    
    const distToSegment = (px: number, py: number, x1: number, y1: number, x2: number, y2: number) => {
        let l2 = (x2 - x1)**2 + (y2 - y1)**2;
        if (l2 === 0) return { dist: Math.hypot(px - x1, py - y1), projX: x1, projY: y1 };
        let t = ((px - x1)*(x2 - x1) + (py - y1)*(y2 - y1)) / l2;
        t = Math.max(0, Math.min(1, t));
        let projX = x1 + t * (x2 - x1);
        let projY = y1 + t * (y2 - y1);
        return { dist: Math.hypot(px - projX, py - projY), projX, projY };
    };
    
    const distPointToRect = (px: number, py: number, cx: number, cy: number, w: number, h: number) => {
        let dx = Math.max(Math.abs(px - cx) - w/2, 0);
        let dy = Math.max(Math.abs(py - cy) - h/2, 0);
        return Math.hypot(dx, dy);
    };
    
    const distRectToSegment = (cx: number, cy: number, w: number, h: number, x1: number, y1: number, x2: number, y2: number) => {
        let minDist = Infinity;
        let corners = [
            {x: cx - w/2, y: cy - h/2},
            {x: cx + w/2, y: cy - h/2},
            {x: cx + w/2, y: cy + h/2},
            {x: cx - w/2, y: cy + h/2}
        ];
        for (let c of corners) {
            minDist = Math.min(minDist, distToSegment(c.x, c.y, x1, y1, x2, y2).dist);
        }
        minDist = Math.min(minDist, distPointToRect(x1, y1, cx, cy, w, h));
        minDist = Math.min(minDist, distPointToRect(x2, y2, cx, cy, w, h));
        for (let i = 1; i < 5; i++) {
            let px = x1 + (x2 - x1) * (i / 5);
            let py = y1 + (y2 - y1) * (i / 5);
            minDist = Math.min(minDist, distPointToRect(px, py, cx, cy, w, h));
        }
        return minDist;
    };
    
    const distRectToRect = (cx1: number, cy1: number, w1: number, h1: number, cx2: number, cy2: number, w2: number, h2: number) => {
        let dx = Math.max(0, Math.abs(cx1 - cx2) - (w1 + w2)/2);
        let dy = Math.max(0, Math.abs(cy1 - cy2) - (h1 + h2)/2);
        return Math.hypot(dx, dy);
    };

    let sumX = 0, sumY = 0, count = 0;
    currentNodes.forEach(n => { sumX += n.x; sumY += n.y; count++; });
    let cmX = count > 0 ? sumX / count : 0;
    let cmY = count > 0 ? sumY / count : 0;

    // 1. Vertex Labels FIRST (so edge labels can avoid them)
    const getAngleDiff = (t1: number, t2: number) => {
        let diff = Math.abs(t1 - t2);
        while (diff > Math.PI * 2) diff -= Math.PI * 2;
        if (diff > Math.PI) diff = Math.PI * 2 - diff;
        return diff;
    };

    let resNodes = [...currentNodes];
    if (mode === 'all' || mode === 'vertex') {
        let simNodes = currentNodes.map(n => {
            let baseDx = n.labelOffset?.x;
            let baseDy = n.labelOffset?.y;
            if (baseDx === undefined || baseDy === undefined) {
                baseDx = globalVertexLabelProximity * 0.707; baseDy = -globalVertexLabelProximity * 0.707;
            }
            if (baseDx === 0 && baseDy === 0) baseDy = -1;
            
            let r = globalVertexLabelProximity;
            let theta = Math.atan2(baseDy, baseDx);
            
            let incidentAngles: number[] = [];
            currentEdges.forEach(e => {
                if (e.from === n.id && e.to === n.id) {
                    let cpY = e.cp1 ? e.cp1.y : n.y - 60;
                    let cpX = e.cp1 ? e.cp1.x : n.x;
                    incidentAngles.push(Math.atan2(cpY - n.y, cpX - n.x));
                } else if (e.from === n.id) {
                    let tn = currentNodes.find(t => t.id === e.to);
                    if (tn) incidentAngles.push(Math.atan2(tn.y - n.y, tn.x - n.x));
                } else if (e.to === n.id) {
                    let fn = currentNodes.find(f => f.id === e.from);
                    if (fn) incidentAngles.push(Math.atan2(fn.y - n.y, fn.x - n.x));
                }
            });
            
            return {
                id: n.id,
                r,
                theta,
                incidentAngles,
                active: globalVertexStyle === 'outside' && n.label
            };
        });
        
        simNodes.forEach(l => {
            if (!l.active) return;
            
            const evaluateCost = (candTheta: number) => {
                let cost = 0;
                l.incidentAngles.forEach(phi => {
                    let diff = getAngleDiff(candTheta, phi);
                    cost += 1.0 / (diff + 0.1);
                });
                currentNodes.forEach(otherN => {
                    if (otherN.id === l.id) return;
                    let phi = Math.atan2(otherN.y - currentNodes.find(n => n.id === l.id)!.y, otherN.x - currentNodes.find(n => n.id === l.id)!.x);
                    let diff = getAngleDiff(candTheta, phi);
                    cost += 0.2 / (diff + 0.1);
                });
                cost -= (Math.sin(candTheta) < 0 ? 0.05 : 0) + (Math.cos(candTheta) > 0 ? 0.02 : 0);
                return cost;
            };

            let bestTheta = l.theta;
            let minCost = Infinity;
            
            for (let i = 0; i < 36; i++) {
                let candTheta = (i / 36) * 2 * Math.PI - Math.PI;
                let cost = evaluateCost(candTheta);
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
                    let candTheta = bestTheta - searchRange + (i / 10) * 2 * searchRange;
                    let cost = evaluateCost(candTheta);
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
            let sim = simNodes.find(s => s.id === n.id);
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
    const resEdges = currentEdges.map(e => {
        if (!e.label) return e;
        
        // Use resNodes to get the finalized vertex label positions
        const fn = resNodes.find(n => n.id === e.from);
        const tn = resNodes.find(n => n.id === e.to);
        if (!fn || !tn) return e;
        
        let midX = 0, midY = 0;
        let dx = 0, dy = 0;
        
        if (e.isLoop) {
            midX = e.cp1 ? e.cp1.x : fn.x;
            midY = e.cp1 ? e.cp1.y : fn.y - 60;
            dx = midX - fn.x; dy = midY - fn.y;
            let temp = dx; dx = dy; dy = -temp;
            if (dx === 0 && dy === 0) { dx = 1; dy = 0; }
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
        
        let len = Math.hypot(dx, dy) || 1;
        let tx = dx / len;
        let ty = dy / len;
        let nx = -ty;
        let ny = tx;
        
        let dist = globalEdgeLabelProximity;
        let c1 = { x: nx * dist, y: ny * dist };
        let c2 = { x: -nx * dist, y: -ny * dist };
        
        // Primary preference based on Center of Mass
        let d1 = Math.hypot(midX + c1.x - cmX, midY + c1.y - cmY);
        let d2 = Math.hypot(midX + c2.x - cmX, midY + c2.y - cmY);
        let pref_N_dir = d1 > d2 ? 1 : -1;
        
        // NOTE: We specifically removed the old labelOffset check here
        // to prevent flip-flopping hysteresis on symmetric graphs.
        
        let lw = Math.max(20, e.label.length * 8);
        let lh = 16;
        
        let maxT = len * 0.25;
        let best_t = 0;
        let best_n = 0;
        let best_dir = pref_N_dir;
        let best_score = -Infinity;
        
        const checkClearance = (candT: number, candN: number, dir: number, debug = false) => {
            let px = midX + candT * tx + candN * dir * nx;
            let py = midY + candT * ty + candN * dir * ny;
            
            let minOtherDist = Infinity;
            let closestObj = '';
            
            currentEdges.forEach(oe => {
                if (oe.id === e.id) return;
                const ofn = resNodes.find(n => n.id === oe.from);
                const otn = resNodes.find(n => n.id === oe.to);
                if (ofn && otn) {
                    let d = distToSegment(px, py, ofn.x, ofn.y, otn.x, otn.y).dist;
                    if (d < minOtherDist) { minOtherDist = d; closestObj = 'edge ' + oe.label; }
                }
            });
            
            resNodes.forEach(on => {
                if (on.id !== e.from && on.id !== e.to) {
                    let d = Math.hypot(on.x - px, on.y - py);
                    let actualRadius = globalNodeRadius || 15;
                    if (d - actualRadius < minOtherDist) { minOtherDist = Math.max(0, d - actualRadius); closestObj = 'node ' + on.label; }
                }
                
                // CRITICAL: Avoid Vertex Labels
                if (on.label && on.labelOffset) {
                    let vlx = on.x + on.labelOffset.x;
                    let vly = on.y + on.labelOffset.y;
                    let vlw = Math.max(20, on.label.length * 8);
                    let vlh = 16;
                    let d = distPointToRect(px, py, vlx, vly, vlw, vlh);
                    if (d < minOtherDist) { minOtherDist = d; closestObj = 'vlabel ' + on.label; }
                }
            });
            
            if (debug) console.log('Edge ' + e.label + ' at T=' + candT + ' N=' + candN + ' minDist=' + minOtherDist + ' closest=' + closestObj + ' required=' + (edgeLabelClearanceRatio * candN));
            return minOtherDist >= edgeLabelClearanceRatio * candN;
        };
        
        let dirs = [pref_N_dir, -pref_N_dir];
        for (let dir_idx = 0; dir_idx < 2; dir_idx++) {
            let cur_dir = dirs[dir_idx];
            
            for (let t_idx = -10; t_idx <= 10; t_idx++) {
                let candT = (t_idx / 10) * maxT;
                let lowN = 0;
                let highN = dist;
                let maxValidN = 0;
                
                if (checkClearance(candT, dist, cur_dir, candT === 0 && dir_idx === 0)) {
                    maxValidN = dist;
                } else {
                    for (let i = 0; i < 6; i++) {
                        let midN = (lowN + highN) / 2;
                        if (checkClearance(candT, midN, cur_dir, false)) {
                            lowN = midN;
                            maxValidN = midN;
                        } else {
                            highN = midN;
                        }
                    }
                }
                
                // Tiebreakers: North > South > East > West
                let dir_nx = cur_dir * nx;
                let dir_ny = cur_dir * ny;
                let tie_breaker = 0;
                if (dir_ny < -0.1) tie_breaker += 4; // North
                else if (dir_ny > 0.1) tie_breaker += 3; // South
                if (dir_nx > 0.1) tie_breaker += 2; // East
                else if (dir_nx < -0.1) tie_breaker += 1; // West
                
                let side_penalty = dir_idx === 0 ? 0 : 50;
                let score = maxValidN * 1000 - Math.abs(candT) * 10 - side_penalty + tie_breaker;
                
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

const generateRegularPolygon = (n: number, cx: number, cy: number, vertexStyle: VertexDisplayStyle = 'inside', width: number = 378, height: number = 302, baseRadius: number = 6): NetworkNode[] => {
    const radius = Math.min(width, height) / 2 * 0.72;
    const rawNodes = Array.from({ length: n }).map((_, i) => {
        const angle = (i / n) * 2 * Math.PI - Math.PI / 2;
        const x = cx + radius * Math.cos(angle);
        const y = cy + radius * Math.sin(angle);
        const nodeRadius = vertexStyle === 'inside' ? baseRadius * 2.5 : baseRadius;
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
    const [cuts, setCuts] = useState<NetworkCut[]>([]);
    const [mode, setMode] = useState<NetworkMode>('select');
    const [globalVertexStyle, setGlobalVertexStyle] = useState<VertexDisplayStyle>('inside');
    
    // Selection state
    const [selectedNodes, setSelectedNodes] = useState<string[]>([]);
    const [selectedEdges, setSelectedEdges] = useState<string[]>([]);
    const [selectedCuts, setSelectedCuts] = useState<string[]>([]);
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
    const [draggingCutLabel, setDraggingCutLabel] = useState<string | null>(null);
    const [draggingCutElement, setDraggingCutElement] = useState<{ cutId: string, nodeId: string | null, type: 'node' | 'cp1' | 'cp2' | 'all' } | null>(null);
    
    // Global Styles
    const [canvasWidth, setCanvasWidth] = useState(378);
    const [canvasHeight, setCanvasHeight] = useState(302);
    const [globalEdgeThickness, setGlobalEdgeThickness] = useState(1.5);
    const [globalFontSize, setGlobalFontSize] = useState(11);
    const scaledFontSize = ptToSvgUnits(globalFontSize, 37.7952755906);
    const [globalNodeRadius, setGlobalNodeRadius] = useState(5);
    const [globalEdgeLabelProximity, setGlobalEdgeLabelProximity] = useState(8);
    const [globalVertexLabelProximity, setGlobalVertexLabelProximity] = useState(15);
    const [edgeLabelClearanceRatio, setEdgeLabelClearanceRatio] = useState(1.5);
    const [debugEdgeLabels, setDebugEdgeLabels] = useState(false);
    const [livePhysicsUpdate, setLivePhysicsUpdate] = useState(false);
    const [updateOnDrop, setUpdateOnDrop] = useState(false);

    const [dragInfo, setDragInfo] = useState<{
        startX: number, startY: number, 
        initialNodes: NetworkNode[], initialEdges: NetworkEdge[], initialCuts: NetworkCut[]
    } | null>(null);
    
    // Export state

    // Canvas ref
    const {
        previewScale, setPreviewScale,
        exportDpi, setExportDpi,
        cropMode, setCropMode,
        selectionBox: cropSelectionBox, customViewBox, hasInitialCrop,
        containerRef,
        handleAutoCrop, handleResetView, handleZoomOutCanvas, handleFitToScreen, handleExportPNG, handleExportSVG, handleCopy, isCopied,
        handleCropMouseDown, handleCropMouseMove, handleCropMouseUp
    } = useGraphInteraction('network-canvas-svg', canvasWidth, canvasHeight, canvasWidth / 37.7952755906, false, true, 20);

    const svgRef = useRef<SVGSVGElement>(null);


    
    const handleClearAll = () => {
        forceSnapshot();
        setNodes([]);
        setEdges([]);
        setCuts([]);
        setSelectedNodes([]);
        setSelectedEdges([]);
        setSelectedCuts([]);
    };

    const handleDefaultSettings = () => {
        forceSnapshot();
        setCanvasWidth(378);
        setCanvasHeight(302);
        setGlobalEdgeThickness(1.5);
        setGlobalFontSize(11);
        setGlobalNodeRadius(6); 
        setGlobalEdgeLabelProximity(8);
        setGlobalVertexLabelProximity(15);
        setEdgeLabelClearanceRatio(1.5);
        applyVertexStyle('inside', undefined, 6);
    };

    const handleAutoFitCanvas = () => {
        let minX = Infinity, minY = Infinity;
        let maxX = -Infinity, maxY = -Infinity;

        const points: {x: number, y: number}[] = [];
        
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
                points.push({ x: lastNode.x + (c.labelOffset?.x || 0), y: lastNode.y - 15 + (c.labelOffset?.y || 0) });
            }
        });

        if (points.length === 0) return;

        points.forEach(p => {
            if (p.x < minX) minX = p.x;
            if (p.x > maxX) maxX = p.x;
            if (p.y < minY) minY = p.y;
            if (p.y > maxY) maxY = p.y;
        });

        const PADDING = 40;
        const newWidth = (maxX - minX) + (PADDING * 2);
        const newHeight = (maxY - minY) + (PADDING * 2);

        const boundedWidth = Math.max(100, Math.min(2000, Math.round(newWidth)));
        const boundedHeight = Math.max(100, Math.min(2000, Math.round(newHeight)));
        
        const shiftX = PADDING - minX;
        const shiftY = PADDING - minY;

        setCanvasWidth(boundedWidth);
        setCanvasHeight(boundedHeight);

        setNodes(nodes.map(n => ({ ...n, x: n.x + shiftX, y: n.y + shiftY })));
        setEdges(edges.map(e => e.cp1 ? { ...e, cp1: { x: e.cp1.x + shiftX, y: e.cp1.y + shiftY } } : e));
        setCuts(cuts.map(c => ({
            ...c,
            nodes: c.nodes.map(cn => ({ ...cn, x: cn.x + shiftX, y: cn.y + shiftY }))
        })));
    };

    // View state
    const [inputType, setInputType] = useState<'manual' | 'matrix' | 'precedence' | 'regular' | 'settings'>('manual');
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

    const getCurrentState = () => ({
        nodes, edges, cuts, globalVertexStyle,
        canvasWidth, canvasHeight, globalEdgeThickness, globalFontSize,
        globalNodeRadius, globalEdgeLabelProximity, globalVertexLabelProximity, edgeLabelClearanceRatio, inputType,
        isDirectedGeneral, showMatrixWeights, matrixInput, precedenceInput,
        initialVerticesCount
    });

    const onRestore = (state: any) => {
        if (state.nodes) setNodes(state.nodes);
        if (state.edges) setEdges(state.edges);
        if (state.cuts) setCuts(state.cuts);
        if (state.globalVertexStyle) setGlobalVertexStyle(state.globalVertexStyle);
        if (state.canvasWidth) setCanvasWidth(state.canvasWidth);
        if (state.canvasHeight) setCanvasHeight(state.canvasHeight);
        if (state.globalEdgeThickness) setGlobalEdgeThickness(state.globalEdgeThickness);
        if (state.globalFontSize) setGlobalFontSize(state.globalFontSize);
        if (state.globalNodeRadius) setGlobalNodeRadius(state.globalNodeRadius);
        if (state.globalEdgeLabelProximity) setGlobalEdgeLabelProximity(state.globalEdgeLabelProximity);
        if (state.globalVertexLabelProximity) setGlobalVertexLabelProximity(state.globalVertexLabelProximity);
        if (state.edgeLabelClearanceRatio !== undefined) setEdgeLabelClearanceRatio(state.edgeLabelClearanceRatio);
        if (state.inputType) setInputType(state.inputType);
        if (state.isDirectedGeneral !== undefined) setIsDirectedGeneral(state.isDirectedGeneral);
        if (state.showMatrixWeights !== undefined) setShowMatrixWeights(state.showMatrixWeights);
        if (state.matrixInput) setMatrixInput(state.matrixInput);
        if (state.precedenceInput) setPrecedenceInput(state.precedenceInput);
        if (state.initialVerticesCount) setInitialVerticesCount(state.initialVerticesCount);
    };

    const { 
        forceSnapshot,
        undo, 
        redo, 
        canUndo, 
        canRedo, 
        exportToFile, 
        importFromFile 
    } = useHistory({
        appId: 'NetworkGrapher',
        version: 1,
        currentState: getCurrentState(),
        onRestore
    });




    const applyVertexStyle = (style: VertexDisplayStyle, targetNodeIds?: string[], overrideBaseRadius?: number) => {
        const baseRadius = overrideBaseRadius || globalNodeRadius;
        const isTargeted = Boolean(targetNodeIds && targetNodeIds.length > 0);
        if (!isTargeted) {
            setGlobalVertexStyle(style);
        }

        const targetSet = new Set(targetNodeIds || []);
        
        let newNodes = nodes.map(node => {
            if (isTargeted && !targetSet.has(node.id)) {
                return node;
            }

            if (style === 'none') {
                return {
                    ...node,
                    labelStyle: 'none',
                    radius: baseRadius
                };
            } else if (style === 'outside') {
                return {
                    ...node,
                    labelStyle: 'outside',
                    radius: baseRadius,
                    labelOffset: node.labelOffset || { x: globalVertexLabelProximity * 0.707, y: -globalVertexLabelProximity * 0.707 }
                };
            } else { // 'inside'
                return {
                    ...node,
                    labelStyle: 'inside',
                    radius: baseRadius * 2.5
                };
            }
        });

        if (style === 'outside') {
            const opt = optimizeLabelPlacements(newNodes, edges, globalEdgeLabelProximity, globalVertexLabelProximity, edgeLabelClearanceRatio, style, globalNodeRadius);
            newNodes = opt.nodes;
            setEdges(opt.edges);
        }

        setNodes(newNodes);
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
                labelOffset: { x: globalVertexLabelProximity * 0.707, y: -globalVertexLabelProximity * 0.707 }
            }));
        } else if (preserveNodePositions && nodes.length > 0) {
            currentNodes = nodes.slice(0, n).map((nd, idx) => ({
                ...nd,
                label: labels[idx] || nd.label || String.fromCharCode(65 + idx)
            }));

            if (currentNodes.length < n) {
                const cx = canvasWidth / 2;
                const cy = canvasHeight / 2;
                const radius = Math.min(canvasWidth, canvasHeight) / 2 * 0.72;
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
                        labelOffset: { x: globalVertexLabelProximity * 0.707, y: -globalVertexLabelProximity * 0.707 }
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
                labelOffset: { x: globalVertexLabelProximity * 0.707, y: -globalVertexLabelProximity * 0.707 }
            }));
        } else {
            const cx = canvasWidth / 2;
            const cy = canvasHeight / 2;
            const radius = Math.min(canvasWidth, canvasHeight) / 2 * 0.72;
            for (let i = 0; i < n; i++) {
                const angle = (i / n) * 2 * Math.PI - Math.PI / 2;
                currentNodes.push({
                    id: `node_${i}`,
                    x: cx + radius * Math.cos(angle),
                    y: cy + radius * Math.sin(angle),
                    label: labels[i] || String.fromCharCode(65 + i),
                    radius: nodeRadius,
                    labelStyle: globalVertexStyle,
                    labelOffset: { x: globalVertexLabelProximity * 0.707, y: -globalVertexLabelProximity * 0.707 }
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

                const edgeLabel = showWeights ? String(weight) : (weight !== 1 ? String(weight) : '');

                // Self-loop
                if (i === j) {
                    const angle = Math.atan2(fromNode.y - (canvasHeight / 2), fromNode.x - (canvasWidth / 2));
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
            const opt = optimizeLabelPlacements(currentNodes, newEdges, globalEdgeLabelProximity, globalVertexLabelProximity, edgeLabelClearanceRatio, globalVertexStyle, globalNodeRadius);
            currentNodes = opt.nodes;
            newEdges = opt.edges;
        }

        setNodes(currentNodes);
        setEdges(newEdges);
    };

    useEffect(() => {
        // Populate initial graph on mount with first planar preset
        // ONLY if no previous state exists in localStorage
        const saved = localStorage.getItem('ais_state_NetworkGrapher');
        if (!saved) {
            const defaultPreset = MATRIX_PRESETS[0];
            applyMatrixToGraph(defaultPreset.value, defaultPreset.directed, showMatrixWeights, false, defaultPreset.positions);
        }
    }, []);

    const handleGenerateFromMatrix = () => {
        const { matrix, labels } = parseAdjacencyMatrix(matrixInput);
        if (matrix.length === 0) return;
        const normalizedInput = matrixInput.trim().replace(/\r\n/g, '\n');
        const matchedPreset = MATRIX_PRESETS.find(p => p.value === normalizedInput);
        
        const scaledPositions = matchedPreset?.positions?.map(p => ({
            x: p.x * (canvasWidth / 800),
            y: p.y * (canvasHeight / 600)
        }));

        const res = generateFromAdjacencyMatrix(matrix, labels, isDirectedGeneral, canvasWidth, canvasHeight, showMatrixWeights, scaledPositions);
        
        let adjustedNodes = res.nodes.map(n => ({
            ...n,
            labelStyle: globalVertexStyle,
            radius: globalVertexStyle === 'inside' ? 15 : 6
        }));

        let adjustedEdges = res.edges;
        if (globalVertexStyle === 'outside') {
            const opt = optimizeLabelPlacements(adjustedNodes, adjustedEdges, globalEdgeLabelProximity, globalVertexLabelProximity, edgeLabelClearanceRatio, globalVertexStyle, globalNodeRadius);
            adjustedNodes = opt.nodes;
            adjustedEdges = opt.edges;
        }

        setNodes(adjustedNodes);
        setEdges(adjustedEdges);
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
        const res = generateActivityNetwork(precedenceInput, canvasWidth, canvasHeight);
        const adjustedNodes = res.nodes.map(n => ({
            ...n,
            labelStyle: 'none' as const,
            radius: globalNodeRadius
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
        if (cropMode) {
            handleCropMouseDown(e);
            return;
        }
        forceSnapshot();
        const { x, y } = getMouseCoords(e);
        if (mode === 'addNode') {
            const nodeRadius = globalVertexStyle === 'inside' ? globalNodeRadius * 2.5 : globalNodeRadius;
            const newNode: NetworkNode = {
                id: uuidv4(),
                x,
                y,
                label: String.fromCharCode(65 + nodes.length), 
                radius: nodeRadius,
                labelStyle: globalVertexStyle,
                labelOffset: { x: globalVertexLabelProximity * 0.707, y: -globalVertexLabelProximity * 0.707 }
            };
            let allNodes = [...nodes, newNode];
            if (globalVertexStyle === 'outside') {
                const opt = optimizeLabelPlacements(allNodes, edges, globalEdgeLabelProximity, globalVertexLabelProximity, edgeLabelClearanceRatio, globalVertexStyle, globalNodeRadius);
                allNodes = opt.nodes;
                setEdges(opt.edges);
            }
            setNodes(allNodes);
        } else if (mode === 'select') {
            setSelectedNodes([]);
            setSelectedEdges([]);
            setSelectedCuts([]);
            setSelectionBox({ startX: x, startY: y, currentX: x, currentY: y });
        }
    };

    const handleNodePointerDown = (e: ReactMouseEvent, nodeId: string) => {
        forceSnapshot();
        e.stopPropagation();
        const coords = getMouseCoords(e);
        
        if (mode === 'addNode') {
            setMode('select');
            setSelectedNodes([nodeId]);
            setSelectedEdges([]);
            setDraggingNodes([nodeId]);
            setDragInfo({ startX: coords.x, startY: coords.y, initialNodes: nodes, initialEdges: edges, initialCuts: cuts });
        } else if (mode === 'select') {
            let newSelected = selectedNodes;
            if (!selectedNodes.includes(nodeId)) {
                newSelected = [nodeId];
                setSelectedNodes(newSelected);
                setSelectedEdges([]);
            }
            setDraggingNodes(newSelected);
            setDragInfo({ startX: coords.x, startY: coords.y, initialNodes: nodes, initialEdges: edges, initialCuts: cuts });
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
        forceSnapshot();
        e.stopPropagation();
        if (mode === 'select') {
            setSelectedEdges([edgeId]);
            setSelectedNodes([]);
            setSelectedCuts([]);
        }
    };

    const handleCutPointerDown = (e: ReactMouseEvent, cutId: string) => {
        forceSnapshot();
        e.preventDefault();
        e.stopPropagation();
        if (mode === 'select') {
            setSelectedCuts([cutId]);
            setSelectedNodes([]);
            setSelectedEdges([]);
            setDraggingCutElement({ cutId, nodeId: null, type: 'all' });
            const coords = getMouseCoords(e);
            setDragInfo({ startX: coords.x, startY: coords.y, initialNodes: nodes, initialEdges: edges, initialCuts: cuts });
        }
    };

    const handleCutElementPointerDown = (e: ReactMouseEvent, cutId: string, nodeId: string, type: 'node' | 'cp1' | 'cp2') => {
        forceSnapshot();
        e.preventDefault();
        e.stopPropagation();
        if (mode === 'select') {
            setSelectedCuts([cutId]);
            setSelectedNodes([]);
            setSelectedEdges([]);
            setDraggingCutElement({ cutId, nodeId, type });
            const coords = getMouseCoords(e);
            setDragInfo({ startX: coords.x, startY: coords.y, initialNodes: nodes, initialEdges: edges, initialCuts: cuts });
        }
    };

    const handlePointerMove = (e: ReactMouseEvent | MouseEvent) => {
        if (handleCropMouseMove(e as any)) return;
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
                let nextNodes = dragInfo.initialNodes.map(n => 
                    draggingNodes.includes(n.id) ? { ...n, x: n.x + dx, y: n.y + dy } : n
                );
                
                let nextEdges = dragInfo.initialEdges.map(edge => {
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
                });
                
                if (livePhysicsUpdate) {
                    const opt = optimizeLabelPlacements(nextNodes, nextEdges, globalEdgeLabelProximity, globalVertexLabelProximity, edgeLabelClearanceRatio, globalVertexStyle, globalNodeRadius, 'all');
                    nextNodes = opt.nodes;
                    nextEdges = opt.edges;
                }
                
                setNodes(nextNodes);
                setEdges(nextEdges);
            } else if (draggingCP) {
                let nextEdges = dragInfo.initialEdges.map(edge => {
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
                });
                if (livePhysicsUpdate) {
                    const opt = optimizeLabelPlacements(nodes, nextEdges, globalEdgeLabelProximity, globalVertexLabelProximity, edgeLabelClearanceRatio, globalVertexStyle, globalNodeRadius, 'all');
                    setNodes(opt.nodes);
                    setEdges(opt.edges);
                } else {
                    setEdges(nextEdges);
                }
            } else if (draggingLabel) {
                setNodes(dragInfo.initialNodes.map(n => {
                    if (n.id === draggingLabel) {
                        let baseOffX = n.labelOffset?.x;
                        let baseOffY = n.labelOffset?.y;
                        if (baseOffX === undefined || baseOffY === undefined) { baseOffX = globalVertexLabelProximity * 0.707; baseOffY = -globalVertexLabelProximity * 0.707; }
                        let newOffX = baseOffX + dx;
                        let newOffY = baseOffY + dy;
                        
                        const isCtrl = e.ctrlKey || e.metaKey;
                        const isShift = e.shiftKey;

                        if (isShift && isCtrl) {
                            let incidentAngles: number[] = [0, Math.PI/2, Math.PI, -Math.PI/2];
                            dragInfo.initialEdges.forEach(ed => {
                                if (ed.from === n.id && ed.to === n.id) {
                                    let cpY = ed.cp1 ? ed.cp1.y : n.y - 60;
                                    let cpX = ed.cp1 ? ed.cp1.x : n.x;
                                    incidentAngles.push(Math.atan2(cpY - n.y, cpX - n.x));
                                } else if (ed.from === n.id) {
                                    let tn = dragInfo.initialNodes.find(t => t.id === ed.to);
                                    if (tn) incidentAngles.push(Math.atan2(tn.y - n.y, tn.x - n.x));
                                } else if (ed.to === n.id) {
                                    let fn = dragInfo.initialNodes.find(f => f.id === ed.from);
                                    if (fn) incidentAngles.push(Math.atan2(fn.y - n.y, fn.x - n.x));
                                }
                            });
                            
                            let currentAngle = Math.atan2(newOffY, newOffX);
                            let bestAngle = incidentAngles[0];
                            let minDiff = Infinity;
                            
                            const getAngleDiff = (a1: number, a2: number) => {
                                let diff = Math.abs(a1 - a2);
                                while (diff > Math.PI * 2) diff -= Math.PI * 2;
                                if (diff > Math.PI) diff = Math.PI * 2 - diff;
                                return diff;
                            };
                            
                            incidentAngles.forEach(ang => {
                                let diff = getAngleDiff(currentAngle, ang);
                                if (diff < minDiff) {
                                    minDiff = diff;
                                    bestAngle = ang;
                                }
                            });
                            
                            newOffX = Math.cos(bestAngle) * globalVertexLabelProximity;
                            newOffY = Math.sin(bestAngle) * globalVertexLabelProximity;
                            
                        } else if (isShift) {
                            let incidentAngles: number[] = [0, Math.PI/2, Math.PI, -Math.PI/2];
                            dragInfo.initialEdges.forEach(ed => {
                                if (ed.from === n.id && ed.to === n.id) {
                                    let cpY = ed.cp1 ? ed.cp1.y : n.y - 60;
                                    let cpX = ed.cp1 ? ed.cp1.x : n.x;
                                    incidentAngles.push(Math.atan2(cpY - n.y, cpX - n.x));
                                } else if (ed.from === n.id) {
                                    let tn = dragInfo.initialNodes.find(t => t.id === ed.to);
                                    if (tn) incidentAngles.push(Math.atan2(tn.y - n.y, tn.x - n.x));
                                } else if (ed.to === n.id) {
                                    let fn = dragInfo.initialNodes.find(f => f.id === ed.from);
                                    if (fn) incidentAngles.push(Math.atan2(fn.y - n.y, fn.x - n.x));
                                }
                            });
                            
                            let currentAngle = Math.atan2(newOffY, newOffX);
                            let bestLine = { x: Math.cos(currentAngle), y: Math.sin(currentAngle) };
                            let minDistance = Infinity;
                            let bestProj = 0;
                            
                            incidentAngles.forEach(ang => {
                                let ux = Math.cos(ang);
                                let uy = Math.sin(ang);
                                
                                let dist = Math.abs(-uy * newOffX + ux * newOffY);
                                let proj = newOffX * ux + newOffY * uy;
                                
                                if (dist < minDistance) {
                                    minDistance = dist;
                                    bestLine = { x: ux, y: uy };
                                    bestProj = proj;
                                }
                            });
                            
                            newOffX = bestLine.x * bestProj;
                            newOffY = bestLine.y * bestProj;
                        } else if (isCtrl) {
                             let dist = Math.hypot(newOffX, newOffY) || 1;
                             newOffX = (newOffX / dist) * globalVertexLabelProximity;
                             newOffY = (newOffY / dist) * globalVertexLabelProximity;
                        }

                        return { ...n, labelOffset: { x: newOffX, y: newOffY } };
                    }
                    return n;
                }));
            } else if (draggingEdgeLabel) {
                setEdges(dragInfo.initialEdges.map(ed => {
                    if (ed.id === draggingEdgeLabel) {
                        const fromNode = dragInfo.initialNodes.find(n => n.id === ed.from);
                        const toNode = dragInfo.initialNodes.find(n => n.id === ed.to);
                        
                        let baseOffX = ed.labelOffset?.x || 0;
                        let baseOffY = ed.labelOffset?.y || 0;
                        
                        let newOffX = baseOffX + dx;
                        let newOffY = baseOffY + dy;

                        if (fromNode && toNode && (e.shiftKey || e.ctrlKey || e.metaKey)) {
                            let outX = 0, outY = -1;
                            let midX, midY;
                            
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

                                const graphCenterX = dragInfo.initialNodes.length > 0 ? dragInfo.initialNodes.reduce((sum, n) => sum + n.x, 0) / dragInfo.initialNodes.length : canvasWidth / 2;
                                const graphCenterY = dragInfo.initialNodes.length > 0 ? dragInfo.initialNodes.reduce((sum, n) => sum + n.y, 0) / dragInfo.initialNodes.length : canvasHeight / 2;
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
                            
                            const isCtrl = e.ctrlKey || e.metaKey;
                            const isShift = e.shiftKey;

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

                        return { ...ed, labelOffset: { x: newOffX, y: newOffY } };
                    }
                    return ed;
                }));
            } else if (draggingCutLabel) {
                setCuts(dragInfo.initialCuts.map(cut => {
                    if (cut.id === draggingCutLabel) {
                        return { ...cut, labelOffset: { x: (cut.labelOffset?.x || 0) + dx, y: (cut.labelOffset?.y || 0) + dy } };
                    }
                    return cut;
                }));
            } else if (draggingCutElement) {
                setCuts(dragInfo.initialCuts.map(cut => {
                    if (cut.id === draggingCutElement.cutId) {
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
                                if (n.id === draggingCutElement.nodeId) {
                                    if (draggingCutElement.type === 'node') {
                                        return { ...n, x: n.x + dx, y: n.y + dy }; // Handles will move with the node since they are relative
                                    } else if (draggingCutElement.type === 'cp1') {
                                        const newCp1x = n.cp1x + dx;
                                        const newCp1y = n.cp1y + dy;
                                        const isInterior = idx > 0 && idx < cut.nodes.length - 1;
                                        if (isInterior) {
                                            const cp2Len = Math.hypot(n.cp2x, n.cp2y);
                                            const newCp1Len = Math.hypot(newCp1x, newCp1y);
                                            if (newCp1Len > 0.001) {
                                                const factor = cp2Len / newCp1Len;
                                                return { ...n, cp1x: newCp1x, cp1y: newCp1y, cp2x: -newCp1x * factor, cp2y: -newCp1y * factor };
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
                                                return { ...n, cp2x: newCp2x, cp2y: newCp2y, cp1x: -newCp2x * factor, cp1y: -newCp2y * factor };
                                            }
                                        }
                                        return { ...n, cp2x: newCp2x, cp2y: newCp2y };
                                    }
                                }
                                return n;
                            })
                        };
                    }
                    return cut;
                }));
            }
        }
    };

    const handlePointerUp = () => {
        if ((draggingNodes.length > 0 || draggingCP !== null) && updateOnDrop && !livePhysicsUpdate) {
            // We use the local closure of nodes and edges which represent the final drag state!
            // Wait, the closure holds the state BEFORE the final setNodes(nextNodes) completes?
            // Actually, handlePointerMove already updated nodes and edges on the last frame of the drag!
            // So 'nodes' and 'edges' in this closure ARE the fully dragged final positions.
            const opt = optimizeLabelPlacements(nodes, edges, globalEdgeLabelProximity, globalVertexLabelProximity, edgeLabelClearanceRatio, globalVertexStyle, globalNodeRadius, 'all');
            setNodes(opt.nodes);
            setEdges(opt.edges);
        }
        setDraggingNodes([]);
        setDraggingCP(null);
        setDraggingLabel(null);
        setDraggingEdgeLabel(null);
        setDraggingCutLabel(null);
        setDraggingCutElement(null);
        setSelectionBox(null);
        setDragInfo(null);
    };

    useEffect(() => {
        window.addEventListener('pointerup', handlePointerUp);
        window.addEventListener('pointermove', handlePointerMove);
        return () => {
            window.removeEventListener('pointerup', handlePointerUp);
            window.removeEventListener('pointermove', handlePointerMove);
        };
    }, [draggingNodes, draggingCP, draggingLabel, draggingEdgeLabel, draggingCutLabel, draggingCutElement, selectionBox, dragInfo, nodes, edges, cuts, cropMode]);

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
            const cmdOrCtrl = isMac ? e.metaKey : e.ctrlKey;
            
            if (cmdOrCtrl && !e.shiftKey && e.key.toLowerCase() === 'z') {
                e.preventDefault();
                undo();
                return;
            } else if (cmdOrCtrl && (e.key.toLowerCase() === 'y' || (e.shiftKey && e.key.toLowerCase() === 'z'))) {
                e.preventDefault();
                redo();
                return;
            } else if (e.key === 'Backspace' || e.key === 'Delete') {
                if (document.activeElement?.tagName === 'INPUT' || document.activeElement?.tagName === 'TEXTAREA' || document.activeElement?.tagName === 'SELECT') return;
                
                forceSnapshot();
                setEdges(prev => prev.filter(edge => !selectedEdges.includes(edge.id) && !selectedNodes.includes(edge.from) && !selectedNodes.includes(edge.to)));
                setNodes(prev => prev.filter(node => !selectedNodes.includes(node.id)));
                setCuts(prev => prev.filter(cut => !selectedCuts.includes(cut.id)));
                setSelectedNodes([]);
                setSelectedEdges([]);
                setSelectedCuts([]);
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [selectedNodes, selectedEdges, selectedCuts, undo, redo, forceSnapshot]);

    const renderCut = (cut: NetworkCut) => {
        const isSelected = selectedCuts.includes(cut.id) || (singleSelectedCut === cut.id);
        const pathParts = [];
        pathParts.push(`M ${cut.nodes[0].x} ${cut.nodes[0].y}`);
        for (let i = 0; i < cut.nodes.length - 1; i++) {
            const n1 = cut.nodes[i];
            const n2 = cut.nodes[i+1];
            const cp1x = n1.x + n1.cp2x;
            const cp1y = n1.y + n1.cp2y;
            const cp2x = n2.x + n2.cp1x;
            const cp2y = n2.y + n2.cp1y;
            pathParts.push(`C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${n2.x} ${n2.y}`);
        }
        const pathD = pathParts.join(' ');
        
        let labelX = 0;
        let labelY = 0;
        if (cut.nodes.length > 0) {
            const lastNode = cut.nodes[cut.nodes.length - 1];
            labelX = lastNode.x;
            labelY = lastNode.y - 15;
        }

        const labelOffsetX = cut.labelOffset?.x || 0;
        const labelOffsetY = cut.labelOffset?.y || 0;

        return (
            <g key={cut.id}>
                <path 
                    d={pathD} 
                    fill="none" 
                    stroke="transparent" 
                    strokeWidth="15" 
                    style={{ cursor: 'pointer' }}
                    onPointerDown={(e) => handleCutPointerDown(e, cut.id)}
                />
                <path 
                    d={pathD} 
                    fill="none" 
                    stroke={isSelected ? '#4f46e5' : 'black'} 
                    strokeWidth={globalEdgeThickness + 0.5} 
                    strokeDasharray="8,6" 
                    style={{ pointerEvents: 'none' }}
                />
                
                {cut.label && (
                    <text 
                        x={labelX + labelOffsetX} 
                        y={labelY - 10 + labelOffsetY} 
                        textAnchor="middle" 
                        fill={isSelected ? '#4f46e5' : 'black'} 
                        fontSize={scaledFontSize} 
                        style={{ cursor: 'move', userSelect: 'none', fontFamily: 'Times New Roman' }}
                        onPointerDown={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            if (mode === 'select') {
                                setSelectedCuts([cut.id]);
                                setSelectedNodes([]);
                                setSelectedEdges([]);
                                setDraggingCutLabel(cut.id);
                                const coords = getMouseCoords(e);
                                setDragInfo({ startX: coords.x, startY: coords.y, initialNodes: nodes, initialEdges: edges, initialCuts: cuts });
                            }
                        }}
                    >
                        {cut.label}
                    </text>
                )}
            </g>
        );
    };

    const renderCutHandles = (cut: NetworkCut) => {
        const isSelected = selectedCuts.includes(cut.id) || (singleSelectedCut === cut.id);
        if (!isSelected) return null;
        
        return (
            <g key={`handles-${cut.id}`}>
                {cut.nodes.map((n, i) => (
                    <g key={n.id}>
                        <circle 
                            cx={n.x} cy={n.y} r={globalNodeRadius} fill="#4f46e5" stroke="white" strokeWidth={globalEdgeThickness}
                            style={{ cursor: 'move' }}
                            onPointerDown={(e) => handleCutElementPointerDown(e, cut.id, n.id, 'node')}
                        />
                        
                        {i > 0 && (
                            <>
                                <line x1={n.x} y1={n.y} x2={n.x + n.cp1x} y2={n.y + n.cp1y} stroke="#a5b4fc" strokeWidth="1.5" strokeDasharray="3,3" />
                                <circle 
                                    cx={n.x + n.cp1x} cy={n.y + n.cp1y} r="5" fill="#c7d2fe" stroke="#4f46e5" strokeWidth="1.5"
                                    style={{ cursor: 'pointer' }}
                                    onPointerDown={(e) => handleCutElementPointerDown(e, cut.id, n.id, 'cp1')}
                                />
                            </>
                        )}
                        
                        {i < cut.nodes.length - 1 && (
                            <>
                                <line x1={n.x} y1={n.y} x2={n.x + n.cp2x} y2={n.y + n.cp2y} stroke="#a5b4fc" strokeWidth="1.5" strokeDasharray="3,3" />
                                <circle 
                                    cx={n.x + n.cp2x} cy={n.y + n.cp2y} r="5" fill="#c7d2fe" stroke="#4f46e5" strokeWidth="1.5"
                                    style={{ cursor: 'pointer' }}
                                    onPointerDown={(e) => handleCutElementPointerDown(e, cut.id, n.id, 'cp2')}
                                />
                            </>
                        )}
                    </g>
                ))}
            </g>
        );
    };

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
            const defOffX = (dx / ldist) * globalEdgeLabelProximity;
            const defOffY = (dy / ldist) * globalEdgeLabelProximity;
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
                        strokeWidth={globalEdgeThickness} 
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
                                setDragInfo({ startX: coords.x, startY: coords.y, initialNodes: nodes, initialEdges: edges, initialCuts: cuts });
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
                                    setDragInfo({ startX: coords.x, startY: coords.y, initialNodes: nodes, initialEdges: edges, initialCuts: cuts });
                                }
                            }}
                            style={{ cursor: mode === 'select' ? 'move' : 'default' }}
                        >
                            <text 
                                textAnchor="middle" 
                                dominantBaseline="central" 
                                fontSize={scaledFontSize} 
                                fontFamily="Times New Roman, serif" 
                                fill="black" 
                                stroke="white"
                                strokeWidth="4"
                                strokeLinejoin="round"
                                paintOrder="stroke fill"
                                style={{ userSelect: 'none' }}
                            >
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

        const graphCenterX = nodes.length > 0 ? nodes.reduce((sum, n) => sum + n.x, 0) / nodes.length : canvasWidth / 2;
        const graphCenterY = nodes.length > 0 ? nodes.reduce((sum, n) => sum + n.y, 0) / nodes.length : canvasHeight / 2;

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

        const defOffX = outX * globalEdgeLabelProximity;
        const defOffY = outY * globalEdgeLabelProximity;
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
                    strokeWidth={globalEdgeThickness} 
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
                                setDragInfo({ startX: coords.x, startY: coords.y, initialNodes: nodes, initialEdges: edges, initialCuts: cuts });
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
                                setDragInfo({ startX: coords.x, startY: coords.y, initialNodes: nodes, initialEdges: edges, initialCuts: cuts });
                            }
                        }}
                        style={{ cursor: mode === 'select' ? 'move' : 'default' }}
                    >
                        <text 
                            textAnchor="middle" 
                            dominantBaseline="central" 
                            fontSize={scaledFontSize} 
                            fontFamily="Times New Roman, serif" 
                            fill="black" 
                            stroke="white"
                            strokeWidth="4"
                            strokeLinejoin="round"
                            paintOrder="stroke fill"
                            style={{ userSelect: 'none' }}
                        >
                            {edge.label}
                        </text>
                    </g>
                )}
            </g>
        );
    };

    const singleSelectedNode = selectedNodes.length === 1 && selectedEdges.length === 0 && selectedCuts.length === 0 ? selectedNodes[0] : null;
    const singleSelectedEdge = selectedEdges.length === 1 && selectedNodes.length === 0 && selectedCuts.length === 0 ? selectedEdges[0] : null;
    const singleSelectedCut = selectedCuts.length === 1 && selectedNodes.length === 0 && selectedEdges.length === 0 ? selectedCuts[0] : null;
    const multiSelected = selectedNodes.length + selectedEdges.length + selectedCuts.length > 1;

    return (
        <div className="flex flex-col h-full bg-white">
            <div className="flex border-b bg-white items-center flex-wrap">
                <div className="p-3 flex gap-2 border-r">
                    <button onClick={() => setInputType('manual')} className={`px-3 py-1.5 rounded font-medium text-sm transition-colors ${inputType === 'manual' ? 'bg-indigo-600 text-white shadow-xs' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}>Manual Draw</button>
                    <button onClick={() => setInputType('matrix')} className={`px-3 py-1.5 rounded font-medium text-sm transition-colors ${inputType === 'matrix' ? 'bg-indigo-600 text-white shadow-xs' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}>Adjacency Matrix</button>
                    <button onClick={() => setInputType('precedence')} className={`px-3 py-1.5 rounded font-medium text-sm transition-colors ${inputType === 'precedence' ? 'bg-indigo-600 text-white shadow-xs' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}>Precedence Table</button>
                    <button onClick={() => setInputType('settings')} className={`px-3 py-1.5 rounded font-medium text-sm transition-colors ${inputType === 'settings' ? 'bg-indigo-600 text-white shadow-xs' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}>Global Settings</button>
                </div>
                <div className="p-3 flex flex-wrap gap-2 items-center">
                        <div className="flex flex-wrap items-center bg-gray-100 rounded-md p-1">
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
                            <div className="w-px h-4 bg-gray-300 mx-1"></div>
                            <button onClick={() => {
                                const newCut: NetworkCut = {
                                    id: uuidv4(),
                                    label: 'Cut',
                                    nodes: [
                                        { id: uuidv4(), x: canvasWidth / 2 - (canvasWidth * 0.125), y: canvasHeight / 2 - (canvasHeight * 0.15), cp1x: -50, cp1y: -50, cp2x: 50, cp2y: 50 },
                                        { id: uuidv4(), x: canvasWidth / 2 + (canvasWidth * 0.125), y: canvasHeight / 2 + (canvasHeight * 0.15), cp1x: -50, cp1y: -50, cp2x: 50, cp2y: 50 }
                                    ]
                                };
                                setCuts([...cuts, newCut]);
                                setSelectedCuts([newCut.id]);
                                setSelectedNodes([]);
                                setSelectedEdges([]);
                                setMode('select');
                            }} className={`px-2.5 py-1 rounded-md text-xs font-medium flex items-center gap-1.5 text-gray-600 hover:text-gray-900 hover:bg-gray-200/50`}>
                                <Sparkles size={14} /> Add Cut Curve
                            </button>
                        </div>
                    </div>
                {/* Easy Vertex Style Selector in Top Bar */}
                <div className="p-3 flex items-center gap-1 border-l">
                    <div className="flex items-center bg-gray-100 rounded-md p-1 border border-gray-200">
                        <span className="text-[11px] font-semibold text-gray-500 px-2 select-none whitespace-nowrap">
                            Vertex Style:
                        </span>
                        <button 
                            onClick={() => { forceSnapshot(); applyVertexStyle('none'); }} 
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
                            onClick={() => { forceSnapshot(); applyVertexStyle('outside'); }} 
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
                            onClick={() => { forceSnapshot(); applyVertexStyle('inside'); }} 
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
                        previewScale={previewScale}
                        setPreviewScale={setPreviewScale}
                        onFitToScreen={handleFitToScreen}
                        onExportPNG={handleExportPNG}
                        onExportSVG={handleExportSVG}
                        onCopy={handleCopy}
                        isCopied={isCopied}
                        exportDpi={exportDpi}
                        onDpiChange={setExportDpi}
                        onUndo={undo}
                        onRedo={redo}
                        canUndo={canUndo}
                        canRedo={canRedo}
                        onExportData={() => exportToFile('network-grapher-project.json')}
                        onImportData={importFromFile}
                        onClearAll={handleClearAll}
                        onDefaultSettings={handleDefaultSettings}
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
                                        <SmartNumberInput 
                                            value={initialVerticesCount}
                                            onChange={setInitialVerticesCount}
                                            className="w-16 border rounded p-1.5 text-sm"
                                            min={1} max={50}
                                        />
                                        <label className="text-sm font-medium text-gray-700">Initial Vertices</label>
                                    </div>
                                    <button 
                                        className="w-full bg-indigo-50 text-indigo-700 border border-indigo-200 py-1.5 rounded text-sm font-medium hover:bg-indigo-100 transition-colors"
                                        onClick={() => {
                                            forceSnapshot();
                                            const newNodes = generateRegularPolygon(initialVerticesCount, canvasWidth / 2, canvasHeight / 2, globalVertexStyle, canvasWidth, canvasHeight, globalNodeRadius);
                                            setNodes(newNodes);
                                        }}
                                    >
                                        Generate Initial Layout
                                    </button>
                                </div>
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
                                                const res = generateActivityNetwork(preset.value, canvasWidth, canvasHeight);
                                                if (!res.error) {
                                                    setNodes(res.nodes);
                                                    setEdges(res.edges);
                                                    forceSnapshot();
                                                }
                                            }
                                        }}
                                        defaultValue=""
                                    >
                                        <option value="" disabled>Select a preset...</option>
                                        {PRECEDENCE_PRESETS.map(p => (
                                            <option key={p.name} value={p.name}>{p.name}</option>
                                        ))}
                                    </select>
                                </div>
                                <div className="space-y-1">
                                    <label className="block text-xs font-semibold text-gray-500 uppercase">Precedence Table</label>
                                    <p className="text-xs text-gray-500">Format: Name, Dependencies, Duration (e.g. A, -, 5 or D, A;B, 4)</p>
                                </div>
                                <textarea
                                    className="w-full h-48 border rounded p-2 focus:ring-2 focus:ring-indigo-500 focus:outline-none font-mono text-sm whitespace-pre font-medium"
                                    value={precedenceInput}
                                    onChange={(e) => setPrecedenceInput(e.target.value)}
                                    placeholder="A, -, 5\nB, A, 2..."
                                />
                                <button
                                    onClick={() => {
                                        const res = generateActivityNetwork(precedenceInput, canvasWidth, canvasHeight);
                                        if (res.error) alert(res.error);
                                        else { setNodes(res.nodes); setEdges(res.edges); setInputType('manual'); forceSnapshot(); }
                                    }}
                                    className="w-full bg-indigo-600 text-white py-2 rounded text-sm font-medium hover:bg-indigo-700 transition-colors shadow-sm"
                                >
                                    Generate Activity Network
                                </button>
                            </div>
                        )}
                        {inputType === 'settings' && (
                            <div className="space-y-4">
                                
<div className="space-y-4 bg-white p-4 rounded-lg border shadow-sm">
<div className="mb-4">
<button className="w-full bg-white border border-gray-300 text-gray-700 py-2 rounded flex items-center justify-center gap-2 text-sm font-medium hover:bg-gray-50 transition-colors" onClick={() => setDebugEdgeLabels(!debugEdgeLabels)}>
                                {debugEdgeLabels ? 'Hide Physics Debug' : 'Show Physics Debug'}
                            </button>
</div>

                            <h3 className="font-medium text-indigo-900">Global Styles</h3>
                            
                            <div className="space-y-3">
                                <div>
                                    <label className="block text-xs font-semibold text-gray-500 uppercase mb-2">Canvas Size (Printing)</label>
                                    <div className="flex items-center gap-2">
                                        <div>
                                            <label className="block text-xs font-semibold text-gray-500 mb-1">Width (cm)</label>
                                            <SmartNumberInput 
                                                value={Math.round(canvasWidth / 37.7952755906 * 10) / 10}
                                                onChange={(val) => setCanvasWidth(Math.max(100, Math.min(2000, Math.round(val * 37.7952755906))))}
                                                className="w-full border rounded p-1.5 focus:ring-2 focus:ring-indigo-500 focus:outline-none text-sm"
                                                step="0.1" min={1} max={50}
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-xs font-semibold text-gray-500 mb-1">Height (cm)</label>
                                            <SmartNumberInput 
                                                value={Math.round(canvasHeight / 37.7952755906 * 10) / 10}
                                                onChange={(val) => setCanvasHeight(Math.max(100, Math.min(2000, Math.round(val * 37.7952755906))))}
                                                className="w-full border rounded p-1.5 focus:ring-2 focus:ring-indigo-500 focus:outline-none text-sm"
                                                step="0.1" min={1} max={50}
                                            />
                                        </div>
                                    </div>
                                    <div className="grid grid-cols-2 gap-2 mt-2">
                                        <button className="text-xs bg-gray-100 hover:bg-gray-200 p-1.5 rounded" onClick={() => {setCanvasWidth(378); setCanvasHeight(302);}}>Small</button>
                                        <button className="text-xs bg-gray-100 hover:bg-gray-200 p-1.5 rounded text-indigo-700 font-medium" onClick={handleAutoFitCanvas}>Auto Fit</button>
                                    </div>
                                </div>

                                <div className="pt-2 border-t">
                                    <div>
                                        <label className="block text-xs font-semibold text-gray-500 mb-1">Font Size</label>
                                        <SmartNumberInput 
                                            value={globalFontSize}
                                            onChange={(val) => setGlobalFontSize(Math.max(8, Math.min(48, val)))}
                                            className="w-full border rounded p-1.5 focus:ring-2 focus:ring-indigo-500 focus:outline-none text-sm"
                                            min={8} max={48}
                                        />
                                    </div>
                                    <div className="mt-2">
                                        <label className="block text-xs font-semibold text-gray-500 mb-1">Edge Thickness</label>
                                        <SmartNumberInput 
                                            value={globalEdgeThickness}
                                            onChange={(val) => setGlobalEdgeThickness(Math.max(1, Math.min(10, val)))}
                                            className="w-full border rounded p-1.5 focus:ring-2 focus:ring-indigo-500 focus:outline-none text-sm"
                                            min={0.1} max={10} step="0.1"
                                        />
                                    </div>
                                    <div className="mt-2">
                                        <label className="block text-xs font-semibold text-gray-500 mb-1">Node/Handle Radius</label>
                                        <SmartNumberInput 
                                            value={globalNodeRadius}
                                            onChange={(val) => {
                                            forceSnapshot();
                                            const newRadius = Math.max(2, Math.min(30, val));
                                            setGlobalNodeRadius(newRadius);
                                            applyVertexStyle(globalVertexStyle, undefined, newRadius);
                                        }}
                                            className="w-full border rounded p-1.5 focus:ring-2 focus:ring-indigo-500 focus:outline-none text-sm"
                                            min={2} max={30}
                                        />
                                    </div>
                                    <div className="mt-2">
                                        <label className="block text-xs font-semibold text-gray-500 mb-1">Edge Label Prox.</label>
                                        <SmartNumberInput 
                                            value={globalEdgeLabelProximity}
                                            onChange={(val) => setGlobalEdgeLabelProximity(Math.max(-50, Math.min(100, val)))}
                                            className="w-full border rounded p-1.5 focus:ring-2 focus:ring-indigo-500 focus:outline-none text-sm"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-semibold text-gray-500 mb-1">Vertex Label Prox.</label>
                                        <SmartNumberInput 
                                            value={globalVertexLabelProximity}
                                            onChange={(val) => setGlobalVertexLabelProximity(Math.max(-50, Math.min(100, val)))}
                                            className="w-full border rounded p-1.5 focus:ring-2 focus:ring-indigo-500 focus:outline-none text-sm"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-semibold text-gray-500 mb-1">Edge Clearance Ratio</label>
                                        <div className="flex items-center">
                                            <input
                                                type="number"
                                                step="0.1"
                                                value={edgeLabelClearanceRatio}
                                                onChange={(e) => setEdgeLabelClearanceRatio(Math.max(0, Math.min(5, parseFloat(e.target.value) || 0)))}
                                                className="w-full border rounded p-1.5 focus:ring-2 focus:ring-indigo-500 focus:outline-none text-sm"
                                            />
                                        </div>
                                    </div>
                                    <div className="mt-2">
                                        <label className="block text-xs font-semibold text-gray-500 mb-1">Vertex Label Style</label>
                                        <select
                                            value={globalVertexStyle}
                                            onChange={(e) => {
                                            forceSnapshot();
                                            applyVertexStyle(e.target.value as 'inside' | 'outside' | 'none');
                                        }}
                                            className="w-full border rounded p-1.5 focus:ring-2 focus:ring-indigo-500 focus:outline-none text-sm bg-white"
                                        >
                                            <option value="inside">Inside Circle</option>
                                            <option value="outside">Outside Floating</option>
                                            <option value="none">Hidden</option>
                                        </select>
                                    </div>
                                </div>
                            </div>
                        </div>

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
                                <div className="mt-4">
                                    <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Radius</label>
                                    <SmartNumberInput 
                                        className="w-full border rounded p-2 focus:ring-2 focus:ring-indigo-500 focus:outline-none text-sm"
                                        value={nodes.find(n => n.id === singleSelectedNode)?.radius || 6}
                                        onChange={(val) => setNodes(nodes.map(n => n.id === singleSelectedNode ? { ...n, radius: val } : n))}
                                        min={1} max={100}
                                    />
                                </div>
                                <button 
                                    className="w-full bg-red-50 text-red-600 border border-red-200 py-2 rounded text-sm font-medium flex items-center justify-center gap-2 hover:bg-red-100 transition-colors mt-4"
                                    onClick={() => {
                                        forceSnapshot();
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
                                <div className="mt-2 space-y-2">
                                    <label className="flex items-center gap-2 text-sm text-gray-700">
                                        <input 
                                            type="checkbox" 
                                            checked={edges.find(e => e.id === singleSelectedEdge)?.isDirected || false}
                                            onChange={(e) => setEdges(edges.map(e2 => e2.id === singleSelectedEdge ? { ...e2, isDirected: e.target.checked } : e2))}
                                            className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                                        />
                                        Directed Edge
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
                                    <div className="mt-4">
                                        <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Loop Height</label>
                                        <SmartNumberInput 
                                            step="0.1"
                                            className="w-full border rounded p-1.5 focus:ring-2 focus:ring-indigo-500 focus:outline-none text-sm"
                                            value={edges.find(e => e.id === singleSelectedEdge)?.loopRadiusY ?? 1.0}
                                            onChange={(val) => setEdges(edges.map(e2 => e2.id === singleSelectedEdge ? { ...e2, loopRadiusY: val } : e2))}
                                            min={0.1} max={10}
                                        />
                                    </div>
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
                                                                const mx = (fromNode.x + toNode.x) / 2;
                                                                const my = (fromNode.y + toNode.y) / 2;
                                                                const dx = toNode.x - fromNode.x;
                                                                const dy = toNode.y - fromNode.y;
                                                                const dist = Math.hypot(dx, dy) || 1;
                                                                const nx = -dy / dist;
                                                                const ny = dx / dist;
                                                                return { ...e2, isCurve: true, cp1: { x: mx + 35 * nx, y: my + 35 * ny } };
                                                            }
                                                        } else if (!checked) {
                                                            const { cp1, ...rest } = e2;
                                                            return { ...rest, isCurve: false };
                                                        }
                                                        return { ...e2, isCurve: checked };
                                                    }
                                                    return e2;
                                                }));
                                            }}
                                            className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                                        />
                                        Curved Edge
                                    </label>
                                )}
                                <button 
                                    className="w-full bg-red-50 text-red-600 border border-red-200 py-2 rounded text-sm font-medium flex items-center justify-center gap-2 hover:bg-red-100 transition-colors mt-4"
                                    onClick={() => {
                                        forceSnapshot();
                                        setEdges(edges.filter(e => e.id !== singleSelectedEdge));
                                        setSelectedEdges([]);
                                    }}
                                >
                                    <Trash2 size={16} /> Delete Edge
                                </button>
                            </div>
                        )}

                        {inputType === 'manual' && singleSelectedCut && (
                            <div className="space-y-4 bg-white p-4 rounded-lg border shadow-sm">
                                <h3 className="font-medium text-indigo-900">Cut Properties</h3>
                                <div>
                                    <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Label</label>
                                    <input 
                                        type="text" 
                                        className="w-full border rounded p-2 focus:ring-2 focus:ring-indigo-500 focus:outline-none text-sm"
                                        value={cuts.find(c => c.id === singleSelectedCut)?.label || ''}
                                        onChange={(e) => setCuts(cuts.map(c => c.id === singleSelectedCut ? { ...c, label: e.target.value } : c))}
                                    />
                                </div>
                                <button 
                                    className="w-full bg-red-50 text-red-600 border border-red-200 py-2 rounded text-sm font-medium flex items-center justify-center gap-2 hover:bg-red-100 transition-colors mt-4"
                                    onClick={() => {
                                        forceSnapshot();
                                        setCuts(cuts.filter(c => c.id !== singleSelectedCut));
                                        setSelectedCuts([]);
                                    }}
                                >
                                    <Trash2 size={16} /> Delete Cut
                                </button>
                            </div>
                        )}

                        
                        
                        <div className="mt-8 border-t pt-4 space-y-2">
                            <div className="flex flex-col gap-2">
                                <button className="w-full bg-white border border-gray-300 text-gray-700 py-2 rounded flex items-center justify-center gap-2 text-sm font-medium hover:bg-gray-50 transition-colors shadow-sm" onClick={() => {
                                    const opt = optimizeLabelPlacements(nodes, edges, globalEdgeLabelProximity, globalVertexLabelProximity, edgeLabelClearanceRatio, globalVertexStyle, globalNodeRadius, 'all');
                                    forceSnapshot();
                                    setNodes(opt.nodes);
                                    setEdges(opt.edges);
                                }}>
                                    Auto-Place All Labels
                                </button>
                                <div className="flex gap-2">
                                    <button className="flex-1 bg-gray-50 text-gray-600 border border-gray-200 py-1.5 rounded flex items-center justify-center text-xs font-medium hover:bg-gray-100 transition-colors" onClick={() => {
                                        const opt = optimizeLabelPlacements(nodes, edges, globalEdgeLabelProximity, globalVertexLabelProximity, edgeLabelClearanceRatio, globalVertexStyle, globalNodeRadius, 'vertex');
                                        forceSnapshot();
                                        setNodes(opt.nodes);
                                    }}>
                                        Vertices Only
                                    </button>
                                    <button className="flex-1 bg-gray-50 text-gray-600 border border-gray-200 py-1.5 rounded flex items-center justify-center text-xs font-medium hover:bg-gray-100 transition-colors" onClick={() => {
                                        const opt = optimizeLabelPlacements(nodes, edges, globalEdgeLabelProximity, globalVertexLabelProximity, edgeLabelClearanceRatio, globalVertexStyle, globalNodeRadius, 'edge');
                                        forceSnapshot();
                                        setEdges(opt.edges);
                                    }}>
                                        Edges Only
                                    </button>
                                </div>
                                <div className="flex flex-col gap-1 mt-1">
                                    <label className="flex items-center gap-2 text-xs text-gray-600 cursor-pointer">
                                        <input type="checkbox" checked={livePhysicsUpdate} onChange={(e) => setLivePhysicsUpdate(e.target.checked)} className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500" />
                                        Live update during drag
                                    </label>
                                    <label className="flex items-center gap-2 text-xs text-gray-600 cursor-pointer">
                                        <input type="checkbox" checked={updateOnDrop} onChange={(e) => setUpdateOnDrop(e.target.checked)} className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500" />
                                        Auto-update after drag drop
                                    </label>
                                </div>
                            </div>
                            
                            
                        </div>
                    </div>
                </div>

                <div ref={containerRef} className="flex-1 relative bg-gray-200 overflow-auto p-8 flex">
                    <div style={{ width: canvasWidth * previewScale, height: canvasHeight * previewScale, margin: 'auto' }} className="relative shrink-0">
                        <div 
                            style={{ 
                                width: canvasWidth, 
                                height: canvasHeight,
                                transform: `scale(${previewScale})`,
                                transformOrigin: 'top left'
                            }}
                            className="bg-white shadow-sm border border-gray-300 rounded-sm absolute top-0 left-0 overflow-hidden" 
                            id="network-canvas"
                        >
                            <svg 
                            id="network-canvas-svg"
                            ref={svgRef}
                            width={canvasWidth}
                            height={canvasHeight}
                            viewBox={customViewBox || `0 0 ${canvasWidth} ${canvasHeight}`}
                            xmlns="http://www.w3.org/2000/svg"
                            className="w-full h-full" 
                            style={{ cursor: mode === 'addNode' ? 'crosshair' : mode === 'select' ? 'default' : 'crosshair', background: '#ffffff' }}
                            onPointerDown={handleSvgPointerDown}
                        >
                            {/* Canvas Background for clean export */}
                            <rect width={canvasWidth} height={canvasHeight} fill="#ffffff" />

                            {/* Preview edge when adding */}
                            {edgeStartNode && ['addEdge', 'addDirectedEdge', 'addDummyEdge'].includes(mode) && mousePos && (() => {
                                const startNode = nodes.find(n => n.id === edgeStartNode);
                                if (!startNode) return null;
                                const endX = hoveredNode ? nodes.find(n => n.id === hoveredNode)?.x ?? mousePos.x : mousePos.x;
                                const endY = hoveredNode ? nodes.find(n => n.id === hoveredNode)?.y ?? mousePos.y : mousePos.y;
                                return (
                                    <line x1={startNode.x} y1={startNode.y} x2={endX} y2={endY} stroke="#4f46e5" strokeWidth={globalEdgeThickness} strokeDasharray="5,5" opacity="0.5" pointerEvents="none" />
                                );
                            })()}

                            {/* Render cuts */}
                            {cuts.map(renderCut)}

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
                                        strokeWidth={isHighlighted ? Math.max(3, globalEdgeThickness + 1) : globalEdgeThickness} 
                                        onPointerDown={(e) => handleNodePointerDown(e, node.id)}
                                        style={{ cursor: mode === 'select' ? 'move' : 'crosshair' }}
                                    />
                                    
                                    {node.labelStyle === 'inside' && node.label && (
                                        <text 
                                            textAnchor="middle" 
                                            dominantBaseline="central" 
                                            fontSize={scaledFontSize} fontFamily="Times New Roman, serif" 
                                            fill="black"
                                            
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
                                                    setDragInfo({ startX: coords.x, startY: coords.y, initialNodes: nodes, initialEdges: edges, initialCuts: cuts });
                                                }
                                            }}
                                        >
                                            <rect x="-15" y="-15" width="30" height="30" fill="white" fillOpacity="0" />
                                            <text 
                                                textAnchor="middle" 
                                                dominantBaseline="central" 
                                                fontSize={scaledFontSize} fontFamily="Times New Roman, serif" 
                                                fill="black"
                                                
                                                style={{ userSelect: 'none' }}
                                            >
                                                {node.label}
                                            </text>
                                        </g>
                                    )}
                                </g>
                            )})}
                            
                            {/* Render Cut Handles Topmost */}
                            {cuts.map(renderCutHandles)}

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
                        {debugEdgeLabels && edges.map(e => {
                                        if (!e.label) return null;
                                        const fn = nodes.find(n => n.id === e.from);
                                        const tn = nodes.find(n => n.id === e.to);
                                        if (!fn || !tn) return null;
                                        let midX = 0, midY = 0, dx = 0, dy = 0;
                                        if (e.isLoop) { midX = e.cp1 ? e.cp1.x : fn.x; midY = e.cp1 ? e.cp1.y : fn.y - 60; dx = 1; dy = 0; }
                                        else if (e.isCurve && e.cp1) { midX = 0.25 * fn.x + 0.5 * e.cp1.x + 0.25 * tn.x; midY = 0.25 * fn.y + 0.5 * e.cp1.y + 0.25 * tn.y; dx = tn.x - fn.x; dy = tn.y - fn.y; }
                                        else { midX = (fn.x + tn.x) / 2; midY = (fn.y + tn.y) / 2; dx = tn.x - fn.x; dy = tn.y - fn.y; }
                                        
                                        let len = Math.hypot(dx, dy) || 1;
                                        let tx = dx / len; let ty = dy / len;
                                        let nx = -ty; let ny = tx;
                                        
                                        const graphCenterX = nodes.length > 0 ? nodes.reduce((sum, n) => sum + n.x, 0) / nodes.length : canvasWidth / 2;
                                        const graphCenterY = nodes.length > 0 ? nodes.reduce((sum, n) => sum + n.y, 0) / nodes.length : canvasHeight / 2;
                                        const edx = tn.x - fn.x;
                                        const edy = tn.y - fn.y;
                                        const eDist = Math.hypot(edx, edy) || 1;
                                        const ux = edx / eDist;
                                        const uy = edy / eDist;
                                        const normX = -uy;
                                        const normY = ux;
                                        const vcx = midX - graphCenterX;
                                        const vcy = midY - graphCenterY;
                                        const dot = normX * vcx + normY * vcy;
                                        const outX = dot >= 0 ? normX : -normX;
                                        const outY = dot >= 0 ? normY : -normY;
                                        const defOffX = e.isLoop ? (dx/len) * globalEdgeLabelProximity : outX * globalEdgeLabelProximity;
                                        const defOffY = e.isLoop ? (dy/len) * globalEdgeLabelProximity : outY * globalEdgeLabelProximity;
                                        
                                        let lx = midX + defOffX + (e.labelOffset?.x || 0);
                                        let ly = midY + defOffY + (e.labelOffset?.y || 0);
                                        
                                        let lw = Math.max(20, e.label.length * 8);
                                        let lh = 16;
                                        
                                        let px1 = midX - nx * 100;
                                        let py1 = midY - ny * 100;
                                        let px2 = midX + nx * 100;
                                        let py2 = midY + ny * 100;

                                        return (
                                            <g key={`debug-${e.id}`} pointerEvents="none">
                                                <line x1={px1} y1={py1} x2={px2} y2={py2} stroke="red" strokeWidth="1" strokeDasharray="4 4" opacity={0.5} />
                                                <circle cx={lx} cy={ly} r="3" fill="blue" />
                                                <rect x={lx - lw/2} y={ly - lh/2} width={lw} height={lh} fill="none" stroke="blue" strokeWidth="1" strokeDasharray="2 2" opacity={0.5} />
                                            </g>
                                        );
                                    })}
                                    
                            {/* Crop Overlay inside SVG */}
                            {cropMode && cropSelectionBox && (
                                <rect 
                                    x={cropSelectionBox.x} y={cropSelectionBox.y} 
                                    width={cropSelectionBox.w} height={cropSelectionBox.h}
                                    fill="rgba(59, 130, 246, 0.2)"
                                    stroke="#2563eb"
                                    strokeWidth={2 / previewScale} 
                                    strokeDasharray={`${5/previewScale},${5/previewScale}`}
                                    pointerEvents="none"
                                />
                            )}
                        </svg>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default NetworkGrapher;
