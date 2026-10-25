import React, { useState, useRef, useEffect, useCallback, MouseEvent as ReactMouseEvent } from 'react';
import {
    Plus,
    Trash2,
    Settings,
    Circle,
    MoveUpRight,
    Pointer,
    GripHorizontal,
    RotateCw,
    RefreshCw,
    Sparkles,
    Edit3
} from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';
import {
    parseAdjacencyMatrix,
    generateAdjacencyMatrixFromGraph,
    generatePrecedenceTableFromGraph
} from '../utils/networkGenerators';
import { ptToSvgUnits } from '../utils/imageExport';
import { GraphToolbar } from '../components/GraphToolbar';
import { GraphContextMenu, ContextMenuItem } from '../components/GraphContextMenu';
import { useHistory } from '../hooks/useHistory';
import { useGraphInteraction } from '../hooks/useGraphInteraction';
import {
    NetworkNode,
    NetworkEdge,
    NetworkCutNode,
    NetworkCut,
    NetworkMode,
    VertexDisplayStyle,
    MATRIX_PRESETS,
    optimizeLabelPlacements,
    computeNetworkAutoFit,
    buildGraphFromMatrix,
    computeDraggedNodesAndEdges,
    computeDraggedVertexLabelOffset,
    computeDraggedEdgeLabelOffset,
    computeDraggedCut
} from '../utils/networkLogic';
import { NetworkCanvas } from '../components/network/NetworkCanvas';
import { NetworkSidebar } from '../components/network/NetworkSidebar';

export type {
    NetworkNode,
    NetworkEdge,
    NetworkCutNode,
    NetworkCut,
    NetworkMode,
    VertexDisplayStyle
};
export { optimizeLabelPlacements };

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
    const [mousePos, setMousePos] = useState<{ x: number; y: number } | null>(null);

    // Dragging state
    const [draggingNodes, setDraggingNodes] = useState<string[]>([]);
    const [selectionBox, setSelectionBox] = useState<{
        startX: number;
        startY: number;
        currentX: number;
        currentY: number;
    } | null>(null);
    const [draggingCP, setDraggingCP] = useState<string | null>(null);
    const [draggingLabel, setDraggingLabel] = useState<string | null>(null);
    const [draggingEdgeLabel, setDraggingEdgeLabel] = useState<string | null>(null);
    const [draggingCutLabel, setDraggingCutLabel] = useState<string | null>(null);
    const [draggingCutElement, setDraggingCutElement] = useState<{
        cutId: string;
        nodeId: string | null;
        type: 'node' | 'cp1' | 'cp2' | 'all';
    } | null>(null);

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
        startX: number;
        startY: number;
        initialNodes: NetworkNode[];
        initialEdges: NetworkEdge[];
        initialCuts: NetworkCut[];
    } | null>(null);

    const {
        previewScale,
        setPreviewScale,
        exportDpi,
        setExportDpi,
        cropMode,
        selectionBox: cropSelectionBox,
        customViewBox,
        containerRef,
        handleFitToScreen,
        handleExportPNG,
        handleExportSVG,
        handleCopy,
        isCopied,
        handleCropMouseDown,
        handleCropMouseMove
    } = useGraphInteraction(
        'network-canvas-svg',
        canvasWidth,
        canvasHeight,
        canvasWidth / 37.7952755906,
        false,
        true,
        20
    );

    const svgRef = useRef<SVGSVGElement>(null);

    // View & Input states
    const [inputType, setInputType] = useState<
        'manual' | 'matrix' | 'precedence' | 'regular' | 'settings'
    >('manual');
    const [isDirectedGeneral, setIsDirectedGeneral] = useState(false);
    const [showMatrixWeights, setShowMatrixWeights] = useState(true);
    const [matrixInput, setMatrixInput] = useState(MATRIX_PRESETS[0].value);
    const [precedenceInput, setPrecedenceInput] = useState('A, -, 5\nB, A, 2\nC, A, 3\nD, B;C, 4');
    const [initialVerticesCount, setInitialVerticesCount] = useState(6);

    const getCurrentState = () => ({
        nodes,
        edges,
        cuts,
        globalVertexStyle,
        canvasWidth,
        canvasHeight,
        globalEdgeThickness,
        globalFontSize,
        globalNodeRadius,
        globalEdgeLabelProximity,
        globalVertexLabelProximity,
        edgeLabelClearanceRatio,
        inputType,
        isDirectedGeneral,
        showMatrixWeights,
        matrixInput,
        precedenceInput,
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
        if (state.globalEdgeLabelProximity)
            setGlobalEdgeLabelProximity(state.globalEdgeLabelProximity);
        if (state.globalVertexLabelProximity)
            setGlobalVertexLabelProximity(state.globalVertexLabelProximity);
        if (state.edgeLabelClearanceRatio !== undefined)
            setEdgeLabelClearanceRatio(state.edgeLabelClearanceRatio);
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

    const applyVertexStyle = (
        style: VertexDisplayStyle,
        targetNodeIds?: string[],
        overrideBaseRadius?: number
    ) => {
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
                return { ...node, labelStyle: 'none' as const, radius: baseRadius };
            } else if (style === 'outside') {
                return {
                    ...node,
                    labelStyle: 'outside' as const,
                    radius: baseRadius,
                    labelOffset: node.labelOffset || {
                        x: globalVertexLabelProximity * 0.707,
                        y: -globalVertexLabelProximity * 0.707
                    }
                };
            } else {
                return { ...node, labelStyle: 'inside' as const, radius: baseRadius * 2.5 };
            }
        });

        if (style === 'outside') {
            const opt = optimizeLabelPlacements(
                newNodes,
                edges,
                globalEdgeLabelProximity,
                globalVertexLabelProximity,
                edgeLabelClearanceRatio,
                style,
                globalNodeRadius
            );
            newNodes = opt.nodes;
            setEdges(opt.edges);
        }

        setNodes(newNodes);
    };

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
        const fit = computeNetworkAutoFit(nodes, edges, cuts);
        if (!fit) return;
        setCanvasWidth(fit.boundedWidth);
        setCanvasHeight(fit.boundedHeight);
        setNodes(fit.nodes);
        setEdges(fit.edges);
        setCuts(fit.cuts);
    };

    const applyMatrixToGraph = (
        matrixStr: string,
        isDirected: boolean,
        showWeights: boolean,
        preserveNodePositions: boolean = true,
        customPositions?: { x: number; y: number }[]
    ) => {
        const { matrix, labels } = parseAdjacencyMatrix(matrixStr);
        if (matrix.length === 0) return;

        const built = buildGraphFromMatrix({
            matrix,
            labels,
            matrixStr,
            isDirected,
            showWeights,
            preserveNodePositions,
            customPositions,
            existingNodes: nodes,
            canvasWidth,
            canvasHeight,
            globalVertexStyle,
            globalNodeRadius,
            globalEdgeLabelProximity,
            globalVertexLabelProximity,
            edgeLabelClearanceRatio
        });

        setNodes(built.nodes);
        setEdges(built.edges);
    };

    useEffect(() => {
        const saved = localStorage.getItem('ais_state_NetworkGrapher');
        if (!saved) {
            const defaultPreset = MATRIX_PRESETS[0];
            applyMatrixToGraph(
                defaultPreset.value,
                defaultPreset.directed,
                showMatrixWeights,
                false,
                defaultPreset.positions
            );
        }
    }, []);

    const handleSyncMatrixFromGraph = () => {
        if (nodes.length === 0) return;
        const { matrix } = generateAdjacencyMatrixFromGraph(nodes, edges, isDirectedGeneral);
        const rows = matrix.map(row => row.join(' ')).join('\n');
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

    const handleExtractPrecedenceFromGraph = () => {
        const table = generatePrecedenceTableFromGraph(nodes, edges);
        if (table.length === 0) return;
        const formatted = table
            .map(t => `${t.activity}, ${t.predecessors.join(';')}, ${t.duration}`)
            .join('\n');
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

    const [contextMenu, setContextMenu] = useState<{
        x: number;
        y: number;
        title?: string;
        items: ContextMenuItem[];
    } | null>(null);

    const focusSidebarControl = useCallback((selector: string) => {
        setInputType('manual');
        setMode('select');
        setTimeout(() => {
            const el = document.querySelector(selector) as HTMLElement | null;
            if (el) {
                el.scrollIntoView({ behavior: 'smooth', block: 'center' });
                el.focus();
                if (el instanceof HTMLInputElement) el.select();
                el.classList.add('ring-2', 'ring-indigo-500');
                setTimeout(() => el.classList.remove('ring-2', 'ring-indigo-500'), 1400);
            }
        }, 60);
    }, []);

    const handleNodeContextMenu = (e: ReactMouseEvent, nodeId: string) => {
        e.preventDefault();
        e.stopPropagation();
        const node = nodes.find(n => n.id === nodeId);
        if (!node) return;

        setSelectedNodes([nodeId]);
        setSelectedEdges([]);
        setSelectedCuts([]);
        setInputType('manual');

        const items: ContextMenuItem[] = [
            {
                label: 'Edit Vertex Label in Sidebar',
                icon: <Edit3 className="w-3.5 h-3.5" />,
                onClick: () => focusSidebarControl('#network-vertex-label-input')
            },
            {
                label: 'Edit Vertex Radius in Sidebar',
                icon: <Circle className="w-3.5 h-3.5" />,
                onClick: () => focusSidebarControl('#network-vertex-radius-input')
            },
            {
                label: 'Add Self-Loop on Vertex',
                icon: <RotateCw className="w-3.5 h-3.5" />,
                dividerBefore: true,
                onClick: () => {
                    forceSnapshot();
                    const newEdge: NetworkEdge = {
                        id: uuidv4(),
                        from: nodeId,
                        to: nodeId,
                        label: '',
                        isDirected: isDirectedGeneral,
                        isDummy: false,
                        isCurve: false,
                        isLoop: true,
                        loopRadiusY: 1.0,
                        cp1: { x: node.x, y: node.y - 60 }
                    };
                    setEdges(prev => [...prev, newEdge]);
                }
            }
        ];

        if (node.labelStyle === 'outside') {
            items.push({
                label: 'Reset Label Position',
                icon: <RefreshCw className="w-3.5 h-3.5" />,
                onClick: () => {
                    forceSnapshot();
                    setNodes(prev =>
                        prev.map(n =>
                            n.id === nodeId
                                ? {
                                      ...n,
                                      labelOffset: {
                                          x: globalVertexLabelProximity * 0.707,
                                          y: -globalVertexLabelProximity * 0.707
                                      }
                                  }
                                : n
                        )
                    );
                }
            });
        }

        items.push({
            label: 'Delete Vertex',
            icon: <Trash2 className="w-3.5 h-3.5" />,
            danger: true,
            dividerBefore: true,
            onClick: () => {
                forceSnapshot();
                setEdges(prev => prev.filter(ed => ed.from !== nodeId && ed.to !== nodeId));
                setNodes(prev => prev.filter(n => n.id !== nodeId));
                setSelectedNodes([]);
            }
        });

        setContextMenu({
            x: e.clientX,
            y: e.clientY,
            title: `Vertex ${node.label || ''}`.trim(),
            items
        });
    };

    const handleEdgeContextMenu = (e: ReactMouseEvent, edgeId: string) => {
        e.preventDefault();
        e.stopPropagation();
        const edge = edges.find(ed => ed.id === edgeId);
        if (!edge) return;

        setSelectedEdges([edgeId]);
        setSelectedNodes([]);
        setSelectedCuts([]);
        setInputType('manual');

        const fromNode = nodes.find(n => n.id === edge.from);
        const toNode = nodes.find(n => n.id === edge.to);
        const edgeTitle =
            fromNode && toNode
                ? `Edge ${fromNode.label || '?'}${edge.isDirected ? ' → ' : ' — '}${toNode.label || '?'}`
                : 'Edge';

        const items: ContextMenuItem[] = [
            {
                label: 'Edit Weight / Label in Sidebar',
                icon: <Edit3 className="w-3.5 h-3.5" />,
                onClick: () => focusSidebarControl('#network-edge-label-input')
            },
            {
                label: edge.isDirected ? 'Make Undirected' : 'Make Directed (→)',
                icon: <MoveUpRight className="w-3.5 h-3.5" />,
                dividerBefore: true,
                onClick: () => {
                    forceSnapshot();
                    setEdges(prev =>
                        prev.map(ed =>
                            ed.id === edgeId ? { ...ed, isDirected: !ed.isDirected } : ed
                        )
                    );
                }
            }
        ];

        if (edge.isDirected && !edge.isLoop) {
            items.push({
                label: 'Reverse Arrow Direction',
                icon: <RefreshCw className="w-3.5 h-3.5" />,
                onClick: () => {
                    forceSnapshot();
                    setEdges(prev =>
                        prev.map(ed =>
                            ed.id === edgeId ? { ...ed, from: ed.to, to: ed.from } : ed
                        )
                    );
                }
            });
        }

        if (!edge.isLoop) {
            items.push({
                label: edge.isCurve ? 'Make Straight Edge' : 'Make Curved Edge',
                icon: <Sparkles className="w-3.5 h-3.5" />,
                onClick: () => {
                    forceSnapshot();
                    setEdges(prev =>
                        prev.map(ed => {
                            if (ed.id !== edgeId) return ed;
                            const nextCurve = !ed.isCurve;
                            if (nextCurve && !ed.cp1 && fromNode && toNode) {
                                const mx = (fromNode.x + toNode.x) / 2;
                                const my = (fromNode.y + toNode.y) / 2;
                                const dx = toNode.x - fromNode.x;
                                const dy = toNode.y - fromNode.y;
                                const dist = Math.hypot(dx, dy) || 1;
                                const nx = -dy / dist;
                                const ny = dx / dist;
                                return {
                                    ...ed,
                                    isCurve: true,
                                    cp1: { x: mx + 35 * nx, y: my + 35 * ny }
                                };
                            } else if (!nextCurve) {
                                const { cp1, ...rest } = ed;
                                return { ...rest, isCurve: false };
                            }
                            return { ...ed, isCurve: nextCurve };
                        })
                    );
                }
            });
        }

        items.push({
            label: edge.isDummy ? 'Make Solid Edge' : 'Make Dummy (Dashed) Edge',
            icon: <GripHorizontal className="w-3.5 h-3.5" />,
            onClick: () => {
                forceSnapshot();
                setEdges(prev =>
                    prev.map(ed => (ed.id === edgeId ? { ...ed, isDummy: !ed.isDummy } : ed))
                );
            }
        });

        if (edge.labelOffset && (edge.labelOffset.x !== 0 || edge.labelOffset.y !== 0)) {
            items.push({
                label: 'Reset Label Offset',
                icon: <RefreshCw className="w-3.5 h-3.5" />,
                onClick: () => {
                    forceSnapshot();
                    setEdges(prev =>
                        prev.map(ed =>
                            ed.id === edgeId ? { ...ed, labelOffset: { x: 0, y: 0 } } : ed
                        )
                    );
                }
            });
        }

        items.push({
            label: 'Delete Edge',
            icon: <Trash2 className="w-3.5 h-3.5" />,
            danger: true,
            dividerBefore: true,
            onClick: () => {
                forceSnapshot();
                setEdges(prev => prev.filter(ed => ed.id !== edgeId));
                setSelectedEdges([]);
            }
        });

        setContextMenu({
            x: e.clientX,
            y: e.clientY,
            title: edgeTitle,
            items
        });
    };

    const handleCutContextMenu = (e: ReactMouseEvent, cutId: string) => {
        e.preventDefault();
        e.stopPropagation();
        const cut = cuts.find(c => c.id === cutId);
        if (!cut) return;

        setSelectedCuts([cutId]);
        setSelectedNodes([]);
        setSelectedEdges([]);
        setInputType('manual');

        const items: ContextMenuItem[] = [
            {
                label: 'Edit Cut Label in Sidebar',
                icon: <Edit3 className="w-3.5 h-3.5" />,
                onClick: () => focusSidebarControl('#network-cut-label-input')
            },
            {
                label: 'Delete Cut Curve',
                icon: <Trash2 className="w-3.5 h-3.5" />,
                danger: true,
                dividerBefore: true,
                onClick: () => {
                    forceSnapshot();
                    setCuts(prev => prev.filter(c => c.id !== cutId));
                    setSelectedCuts([]);
                }
            }
        ];

        setContextMenu({
            x: e.clientX,
            y: e.clientY,
            title: `Cut Curve (${cut.label || 'Unlabeled'})`,
            items
        });
    };

    const handleCanvasContextMenu = (e: ReactMouseEvent) => {
        e.preventDefault();
        const { x, y } = getMouseCoords(e);
        setContextMenu({
            x: e.clientX,
            y: e.clientY,
            title: 'Network Canvas',
            items: [
                {
                    label: 'Add Vertex Here',
                    icon: <Plus className="w-3.5 h-3.5" />,
                    onClick: () => {
                        forceSnapshot();
                        const nodeRadius =
                            globalVertexStyle === 'inside'
                                ? globalNodeRadius * 2.5
                                : globalNodeRadius;
                        const newNode: NetworkNode = {
                            id: uuidv4(),
                            x,
                            y,
                            label: String.fromCharCode(65 + nodes.length),
                            radius: nodeRadius,
                            labelStyle: globalVertexStyle,
                            labelOffset: {
                                x: globalVertexLabelProximity * 0.707,
                                y: -globalVertexLabelProximity * 0.707
                            }
                        };
                        setNodes(prev => [...prev, newNode]);
                        setSelectedNodes([newNode.id]);
                        setSelectedEdges([]);
                        setSelectedCuts([]);
                    }
                },
                {
                    label: 'Add Cut Curve Here',
                    icon: <Sparkles className="w-3.5 h-3.5" />,
                    onClick: () => {
                        forceSnapshot();
                        const newCut: NetworkCut = {
                            id: uuidv4(),
                            label: 'Cut',
                            nodes: [
                                {
                                    id: uuidv4(),
                                    x: x - 50,
                                    y: y - 50,
                                    cp1x: -40,
                                    cp1y: -40,
                                    cp2x: 40,
                                    cp2y: 40
                                },
                                {
                                    id: uuidv4(),
                                    x: x + 50,
                                    y: y + 50,
                                    cp1x: -40,
                                    cp1y: -40,
                                    cp2x: 40,
                                    cp2y: 40
                                }
                            ]
                        };
                        setCuts(prev => [...prev, newCut]);
                        setSelectedCuts([newCut.id]);
                        setSelectedNodes([]);
                        setSelectedEdges([]);
                        setMode('select');
                    }
                },
                {
                    label: 'Auto-Place All Labels',
                    icon: <RefreshCw className="w-3.5 h-3.5" />,
                    dividerBefore: true,
                    onClick: () => {
                        const opt = optimizeLabelPlacements(
                            nodes,
                            edges,
                            globalEdgeLabelProximity,
                            globalVertexLabelProximity,
                            edgeLabelClearanceRatio,
                            globalVertexStyle,
                            globalNodeRadius,
                            'all'
                        );
                        forceSnapshot();
                        setNodes(opt.nodes);
                        setEdges(opt.edges);
                    }
                },
                {
                    label: 'Open Global Settings',
                    icon: <Settings className="w-3.5 h-3.5" />,
                    onClick: () => setInputType('settings')
                }
            ]
        });
    };

    const handleSvgPointerDown = (e: ReactMouseEvent) => {
        if (e.button === 2) return;
        if (cropMode) {
            handleCropMouseDown(e);
            return;
        }
        forceSnapshot();
        const { x, y } = getMouseCoords(e);
        if (mode === 'addNode') {
            const nodeRadius =
                globalVertexStyle === 'inside' ? globalNodeRadius * 2.5 : globalNodeRadius;
            const newNode: NetworkNode = {
                id: uuidv4(),
                x,
                y,
                label: String.fromCharCode(65 + nodes.length),
                radius: nodeRadius,
                labelStyle: globalVertexStyle,
                labelOffset: {
                    x: globalVertexLabelProximity * 0.707,
                    y: -globalVertexLabelProximity * 0.707
                }
            };
            let allNodes = [...nodes, newNode];
            if (globalVertexStyle === 'outside') {
                const opt = optimizeLabelPlacements(
                    allNodes,
                    edges,
                    globalEdgeLabelProximity,
                    globalVertexLabelProximity,
                    edgeLabelClearanceRatio,
                    globalVertexStyle,
                    globalNodeRadius
                );
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
        if (e.button === 2) return;
        forceSnapshot();
        e.stopPropagation();
        const coords = getMouseCoords(e);

        if (mode === 'addNode') {
            setMode('select');
            setSelectedNodes([nodeId]);
            setSelectedEdges([]);
            setDraggingNodes([nodeId]);
            setDragInfo({
                startX: coords.x,
                startY: coords.y,
                initialNodes: nodes,
                initialEdges: edges,
                initialCuts: cuts
            });
        } else if (mode === 'select') {
            let newSelected = selectedNodes;
            if (!selectedNodes.includes(nodeId)) {
                newSelected = [nodeId];
                setSelectedNodes(newSelected);
                setSelectedEdges([]);
            }
            setDraggingNodes(newSelected);
            setDragInfo({
                startX: coords.x,
                startY: coords.y,
                initialNodes: nodes,
                initialEdges: edges,
                initialCuts: cuts
            });
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
                    loopRadiusY: 1.0,
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
                        isDirected:
                            mode === 'addDirectedEdge' ||
                            mode === 'addDummyEdge' ||
                            isDirectedGeneral,
                        isDummy: mode === 'addDummyEdge',
                        isCurve: false
                    };

                    const allEdges = [...edges, newEdge];
                    const group = allEdges.filter(
                        e =>
                            !e.isLoop &&
                            ((e.from === edgeStartNode && e.to === nodeId) ||
                                (e.from === nodeId && e.to === edgeStartNode))
                    );
                    if (group.length > 1) {
                        const cFrom = nodes.find(
                            n => n.id === (edgeStartNode < nodeId ? edgeStartNode : nodeId)
                        )!;
                        const cTo = nodes.find(
                            n => n.id === (edgeStartNode < nodeId ? nodeId : edgeStartNode)
                        )!;
                        const dx = cTo.x - cFrom.x;
                        const dy = cTo.y - cFrom.y;
                        const dist = Math.hypot(dx, dy);
                        const nx = -dy / dist;
                        const ny = dx / dist;
                        const mx = (cFrom.x + cTo.x) / 2;
                        const my = (cFrom.y + cTo.y) / 2;

                        const N = group.length;
                        const spread = 40;
                        const slots = Array.from({ length: N }).map(
                            (_, j) => (j - (N - 1) / 2) * spread
                        );
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

    const handleNodeLabelPointerDown = (e: ReactMouseEvent, nodeId: string) => {
        if (e.button === 2) return;
        if (mode === 'select') {
            forceSnapshot();
            e.stopPropagation();
            const coords = getMouseCoords(e);
            setDraggingLabel(nodeId);
            setDragInfo({
                startX: coords.x,
                startY: coords.y,
                initialNodes: nodes,
                initialEdges: edges,
                initialCuts: cuts
            });
        }
    };

    const handleEdgePointerDown = (e: ReactMouseEvent, edgeId: string) => {
        if (e.button === 2) return;
        forceSnapshot();
        e.stopPropagation();
        if (mode === 'select') {
            setSelectedEdges([edgeId]);
            setSelectedNodes([]);
            setSelectedCuts([]);
        }
    };

    const handleEdgeCPPointerDown = (e: ReactMouseEvent, edgeId: string) => {
        if (e.button === 2) return;
        forceSnapshot();
        e.stopPropagation();
        const coords = getMouseCoords(e);
        setDraggingCP(edgeId);
        setDragInfo({
            startX: coords.x,
            startY: coords.y,
            initialNodes: nodes,
            initialEdges: edges,
            initialCuts: cuts
        });
    };

    const handleEdgeLabelPointerDown = (e: ReactMouseEvent, edgeId: string) => {
        if (e.button === 2) return;
        if (mode === 'select') {
            forceSnapshot();
            e.stopPropagation();
            const coords = getMouseCoords(e);
            setDraggingEdgeLabel(edgeId);
            setDragInfo({
                startX: coords.x,
                startY: coords.y,
                initialNodes: nodes,
                initialEdges: edges,
                initialCuts: cuts
            });
        }
    };

    const handleCutPointerDown = (e: ReactMouseEvent, cutId: string) => {
        if (e.button === 2) return;
        forceSnapshot();
        e.preventDefault();
        e.stopPropagation();
        if (mode === 'select') {
            setSelectedCuts([cutId]);
            setSelectedNodes([]);
            setSelectedEdges([]);
            setDraggingCutElement({ cutId, nodeId: null, type: 'all' });
            const coords = getMouseCoords(e);
            setDragInfo({
                startX: coords.x,
                startY: coords.y,
                initialNodes: nodes,
                initialEdges: edges,
                initialCuts: cuts
            });
        }
    };

    const handleCutLabelPointerDown = (e: ReactMouseEvent, cutId: string) => {
        if (e.button === 2) return;
        forceSnapshot();
        e.preventDefault();
        e.stopPropagation();
        if (mode === 'select') {
            setSelectedCuts([cutId]);
            setSelectedNodes([]);
            setSelectedEdges([]);
            setDraggingCutLabel(cutId);
            const coords = getMouseCoords(e);
            setDragInfo({
                startX: coords.x,
                startY: coords.y,
                initialNodes: nodes,
                initialEdges: edges,
                initialCuts: cuts
            });
        }
    };

    const handleCutElementPointerDown = (
        e: ReactMouseEvent,
        cutId: string,
        nodeId: string,
        type: 'node' | 'cp1' | 'cp2'
    ) => {
        if (e.button === 2) return;
        forceSnapshot();
        e.preventDefault();
        e.stopPropagation();
        if (mode === 'select') {
            setSelectedCuts([cutId]);
            setSelectedNodes([]);
            setSelectedEdges([]);
            setDraggingCutElement({ cutId, nodeId, type });
            const coords = getMouseCoords(e);
            setDragInfo({
                startX: coords.x,
                startY: coords.y,
                initialNodes: nodes,
                initialEdges: edges,
                initialCuts: cuts
            });
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

            setSelectedNodes(
                nodes
                    .filter(n => n.x >= minX && n.x <= maxX && n.y >= minY && n.y <= maxY)
                    .map(n => n.id)
            );
            setSelectedEdges(
                edges
                    .filter(edge => {
                        const fn = nodes.find(n => n.id === edge.from);
                        const tn = nodes.find(n => n.id === edge.to);
                        if (!fn || !tn) return false;
                        const mx = edge.isLoop ? edge.cp1?.x ?? fn.x : (fn.x + tn.x) / 2;
                        const my = edge.isLoop ? edge.cp1?.y ?? fn.y - 60 : (fn.y + tn.y) / 2;
                        return mx >= minX && mx <= maxX && my >= minY && my <= maxY;
                    })
                    .map(e => e.id)
            );
        } else if (dragInfo) {
            const dx = coords.x - dragInfo.startX;
            const dy = coords.y - dragInfo.startY;
            const isCtrl = e.ctrlKey || e.metaKey;
            const isShift = e.shiftKey;

            if (draggingNodes.length > 0) {
                let { nodes: nextNodes, edges: nextEdges } = computeDraggedNodesAndEdges(
                    dragInfo.initialNodes,
                    dragInfo.initialEdges,
                    draggingNodes,
                    dx,
                    dy
                );

                if (livePhysicsUpdate) {
                    const opt = optimizeLabelPlacements(
                        nextNodes,
                        nextEdges,
                        globalEdgeLabelProximity,
                        globalVertexLabelProximity,
                        edgeLabelClearanceRatio,
                        globalVertexStyle,
                        globalNodeRadius,
                        'all'
                    );
                    nextNodes = opt.nodes;
                    nextEdges = opt.edges;
                }

                setNodes(nextNodes);
                setEdges(nextEdges);
            } else if (draggingCP) {
                const nextEdges = dragInfo.initialEdges.map(edge => {
                    if (edge.id === draggingCP) {
                        let initialCp = edge.cp1;
                        if (!initialCp) {
                            if (edge.isLoop) {
                                const fn = dragInfo.initialNodes.find(n => n.id === edge.from);
                                initialCp = { x: fn?.x ?? 0, y: (fn?.y ?? 0) - 60 };
                            } else {
                                const fn = dragInfo.initialNodes.find(n => n.id === edge.from);
                                const tn = dragInfo.initialNodes.find(n => n.id === edge.to);
                                initialCp = {
                                    x: ((fn?.x ?? 0) + (tn?.x ?? 0)) / 2,
                                    y: ((fn?.y ?? 0) + (tn?.y ?? 0)) / 2 - 30
                                };
                            }
                        }
                        return { ...edge, cp1: { x: initialCp.x + dx, y: initialCp.y + dy } };
                    }
                    return edge;
                });
                if (livePhysicsUpdate) {
                    const opt = optimizeLabelPlacements(
                        nodes,
                        nextEdges,
                        globalEdgeLabelProximity,
                        globalVertexLabelProximity,
                        edgeLabelClearanceRatio,
                        globalVertexStyle,
                        globalNodeRadius,
                        'all'
                    );
                    setNodes(opt.nodes);
                    setEdges(opt.edges);
                } else {
                    setEdges(nextEdges);
                }
            } else if (draggingLabel) {
                setNodes(
                    dragInfo.initialNodes.map(n =>
                        n.id === draggingLabel
                            ? {
                                  ...n,
                                  labelOffset: computeDraggedVertexLabelOffset(
                                      n,
                                      dragInfo.initialNodes,
                                      dragInfo.initialEdges,
                                      dx,
                                      dy,
                                      globalVertexLabelProximity,
                                      isShift,
                                      isCtrl
                                  )
                              }
                            : n
                    )
                );
            } else if (draggingEdgeLabel) {
                setEdges(
                    dragInfo.initialEdges.map(ed =>
                        ed.id === draggingEdgeLabel
                            ? {
                                  ...ed,
                                  labelOffset: computeDraggedEdgeLabelOffset(
                                      ed,
                                      dragInfo.initialNodes,
                                      dx,
                                      dy,
                                      globalEdgeLabelProximity,
                                      canvasWidth,
                                      canvasHeight,
                                      isShift,
                                      isCtrl
                                  )
                              }
                            : ed
                    )
                );
            } else if (draggingCutLabel) {
                setCuts(
                    dragInfo.initialCuts.map(cut =>
                        cut.id === draggingCutLabel
                            ? {
                                  ...cut,
                                  labelOffset: {
                                      x: (cut.labelOffset?.x || 0) + dx,
                                      y: (cut.labelOffset?.y || 0) + dy
                                  }
                              }
                            : cut
                    )
                );
            } else if (draggingCutElement) {
                setCuts(
                    dragInfo.initialCuts.map(cut =>
                        cut.id === draggingCutElement.cutId
                            ? computeDraggedCut(cut, draggingCutElement, dx, dy)
                            : cut
                    )
                );
            }
        }
    };

    const handlePointerUp = () => {
        if (
            (draggingNodes.length > 0 || draggingCP !== null) &&
            updateOnDrop &&
            !livePhysicsUpdate
        ) {
            const opt = optimizeLabelPlacements(
                nodes,
                edges,
                globalEdgeLabelProximity,
                globalVertexLabelProximity,
                edgeLabelClearanceRatio,
                globalVertexStyle,
                globalNodeRadius,
                'all'
            );
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
    }, [
        draggingNodes,
        draggingCP,
        draggingLabel,
        draggingEdgeLabel,
        draggingCutLabel,
        draggingCutElement,
        selectionBox,
        dragInfo,
        nodes,
        edges,
        cuts,
        cropMode
    ]);

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
            const cmdOrCtrl = isMac ? e.metaKey : e.ctrlKey;

            if (cmdOrCtrl && !e.shiftKey && e.key.toLowerCase() === 'z') {
                e.preventDefault();
                undo();
                return;
            } else if (
                cmdOrCtrl &&
                (e.key.toLowerCase() === 'y' || (e.shiftKey && e.key.toLowerCase() === 'z'))
            ) {
                e.preventDefault();
                redo();
                return;
            } else if (e.key === 'Backspace' || e.key === 'Delete') {
                if (
                    document.activeElement?.tagName === 'INPUT' ||
                    document.activeElement?.tagName === 'TEXTAREA' ||
                    document.activeElement?.tagName === 'SELECT'
                )
                    return;

                forceSnapshot();
                setEdges(prev =>
                    prev.filter(
                        edge =>
                            !selectedEdges.includes(edge.id) &&
                            !selectedNodes.includes(edge.from) &&
                            !selectedNodes.includes(edge.to)
                    )
                );
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

    const singleSelectedNode =
        selectedNodes.length === 1 && selectedEdges.length === 0 && selectedCuts.length === 0
            ? selectedNodes[0]
            : null;
    const singleSelectedEdge =
        selectedEdges.length === 1 && selectedNodes.length === 0 && selectedCuts.length === 0
            ? selectedEdges[0]
            : null;
    const singleSelectedCut =
        selectedCuts.length === 1 && selectedNodes.length === 0 && selectedEdges.length === 0
            ? selectedCuts[0]
            : null;
    const multiSelected =
        selectedNodes.length + selectedEdges.length + selectedCuts.length > 1;

    return (
        <div className="flex flex-col h-full bg-white">
            <header className="flex border-b bg-white items-center flex-wrap px-3 py-1.5 gap-2">
                <div className="flex gap-1 pr-2 border-r">
                    <button
                        onClick={() => setInputType('manual')}
                        className={`px-2.5 py-1 rounded font-medium text-xs transition-colors ${
                            inputType === 'manual'
                                ? 'bg-indigo-600 text-white shadow-xs'
                                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                        }`}
                    >
                        Manual Draw
                    </button>
                    <button
                        onClick={() => setInputType('matrix')}
                        className={`px-2.5 py-1 rounded font-medium text-xs transition-colors ${
                            inputType === 'matrix'
                                ? 'bg-indigo-600 text-white shadow-xs'
                                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                        }`}
                    >
                        Adjacency Matrix
                    </button>
                    <button
                        onClick={() => setInputType('precedence')}
                        className={`px-2.5 py-1 rounded font-medium text-xs transition-colors ${
                            inputType === 'precedence'
                                ? 'bg-indigo-600 text-white shadow-xs'
                                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                        }`}
                    >
                        Precedence Table
                    </button>
                    <button
                        onClick={() => setInputType('settings')}
                        className={`px-2.5 py-1 rounded font-medium text-xs transition-colors ${
                            inputType === 'settings'
                                ? 'bg-indigo-600 text-white shadow-xs'
                                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                        }`}
                    >
                        Global Settings
                    </button>
                </div>
                <div className="flex flex-wrap gap-1.5 items-center">
                    <div className="flex flex-wrap items-center bg-gray-100 rounded-md p-0.5">
                        <button
                            onClick={() => setMode('select')}
                            className={`px-2 py-1 rounded text-xs font-medium flex items-center gap-1 ${
                                mode === 'select'
                                    ? 'bg-white shadow-sm text-indigo-600'
                                    : 'text-gray-600 hover:text-gray-900'
                            }`}
                        >
                            <Pointer size={13} /> Select
                        </button>
                        <button
                            onClick={() => setMode('addNode')}
                            className={`px-2 py-1 rounded text-xs font-medium flex items-center gap-1 ${
                                mode === 'addNode'
                                    ? 'bg-white shadow-sm text-indigo-600'
                                    : 'text-gray-600 hover:text-gray-900'
                            }`}
                        >
                            <Circle size={13} /> Vertices
                        </button>
                        <button
                            onClick={() => setMode('addEdge')}
                            className={`px-2.5 py-1 rounded-md text-xs font-medium flex items-center gap-1.5 ${
                                mode === 'addEdge'
                                    ? 'bg-white shadow-sm text-indigo-600'
                                    : 'text-gray-600 hover:text-gray-900'
                            }`}
                        >
                            <MoveUpRight size={14} /> Add Edges
                        </button>
                        <button
                            onClick={() => setMode('addDirectedEdge')}
                            className={`px-2.5 py-1 rounded-md text-xs font-medium flex items-center gap-1.5 ${
                                mode === 'addDirectedEdge'
                                    ? 'bg-white shadow-sm text-indigo-600'
                                    : 'text-gray-600 hover:text-gray-900'
                            }`}
                        >
                            → Directed
                        </button>
                        <button
                            onClick={() => setMode('addLoop')}
                            className={`px-2.5 py-1 rounded-md text-xs font-medium flex items-center gap-1.5 ${
                                mode === 'addLoop'
                                    ? 'bg-white shadow-sm text-indigo-600'
                                    : 'text-gray-600 hover:text-gray-900'
                            }`}
                        >
                            ⟲ Loop
                        </button>
                        <button
                            onClick={() => setMode('addDummyEdge')}
                            className={`px-2.5 py-1 rounded-md text-xs font-medium flex items-center gap-1.5 ${
                                mode === 'addDummyEdge'
                                    ? 'bg-white shadow-sm text-indigo-600'
                                    : 'text-gray-600 hover:text-gray-900'
                            }`}
                        >
                            ⇢ Dummy
                        </button>
                        <div className="w-px h-4 bg-gray-300 mx-1"></div>
                        <button
                            onClick={() => {
                                const newCut: NetworkCut = {
                                    id: uuidv4(),
                                    label: 'Cut',
                                    nodes: [
                                        {
                                            id: uuidv4(),
                                            x: canvasWidth / 2 - canvasWidth * 0.125,
                                            y: canvasHeight / 2 - canvasHeight * 0.15,
                                            cp1x: -50,
                                            cp1y: -50,
                                            cp2x: 50,
                                            cp2y: 50
                                        },
                                        {
                                            id: uuidv4(),
                                            x: canvasWidth / 2 + canvasWidth * 0.125,
                                            y: canvasHeight / 2 + canvasHeight * 0.15,
                                            cp1x: -50,
                                            cp1y: -50,
                                            cp2x: 50,
                                            cp2y: 50
                                        }
                                    ]
                                };
                                setCuts([...cuts, newCut]);
                                setSelectedCuts([newCut.id]);
                                setSelectedNodes([]);
                                setSelectedEdges([]);
                                setMode('select');
                            }}
                            className="px-2.5 py-1 rounded-md text-xs font-medium flex items-center gap-1.5 text-gray-600 hover:text-gray-900 hover:bg-gray-200/50"
                        >
                            <Sparkles size={14} /> Add Cut Curve
                        </button>
                    </div>
                </div>

                {/* Easy Vertex Style Selector in Top Bar */}
                <div className="flex items-center gap-1 border-l pl-2">
                    <div className="flex items-center bg-gray-100 rounded-md p-0.5 border border-gray-200">
                        <span className="text-[11px] font-semibold text-gray-500 px-1.5 select-none whitespace-nowrap">
                            Vertex:
                        </span>
                        <button
                            onClick={() => {
                                forceSnapshot();
                                applyVertexStyle('none');
                            }}
                            className={`px-2 py-1 rounded text-xs font-medium flex items-center gap-1 transition-all whitespace-nowrap ${
                                globalVertexStyle === 'none'
                                    ? 'bg-white shadow-sm text-indigo-700 font-semibold'
                                    : 'text-gray-600 hover:text-gray-900 hover:bg-gray-200/50'
                            }`}
                            title="Just dots with no labels"
                        >
                            <span className="w-2 h-2 rounded-full bg-current inline-block" />
                            <span>Dots</span>
                        </button>
                        <button
                            onClick={() => {
                                forceSnapshot();
                                applyVertexStyle('outside');
                            }}
                            className={`px-2 py-1 rounded text-xs font-medium flex items-center gap-1 transition-all whitespace-nowrap ${
                                globalVertexStyle === 'outside'
                                    ? 'bg-white shadow-sm text-indigo-700 font-semibold'
                                    : 'text-gray-600 hover:text-gray-900 hover:bg-gray-200/50'
                            }`}
                            title="Dots with labels outside (pushed outwards away from center and connecting edges)"
                        >
                            <div className="relative flex items-center justify-center w-3 h-3">
                                <span className="w-2 h-2 rounded-full bg-current inline-block" />
                                <span className="text-[8px] font-bold absolute -top-1 -right-1">
                                    a
                                </span>
                            </div>
                            <span>Outside</span>
                        </button>
                        <button
                            onClick={() => {
                                forceSnapshot();
                                applyVertexStyle('inside');
                            }}
                            className={`px-2 py-1 rounded text-xs font-medium flex items-center gap-1 transition-all whitespace-nowrap ${
                                globalVertexStyle === 'inside'
                                    ? 'bg-white shadow-sm text-indigo-700 font-semibold'
                                    : 'text-gray-600 hover:text-gray-900 hover:bg-gray-200/50'
                            }`}
                            title="Circles with labels inside"
                        >
                            <span className="w-3.5 h-3.5 rounded-full border border-current inline-flex items-center justify-center text-[8px] font-bold">
                                A
                            </span>
                            <span>Inside</span>
                        </button>
                    </div>
                </div>

                <div className="flex justify-end flex-1 ml-auto">
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
            </header>

            <div className="flex-1 flex overflow-hidden">
                <NetworkSidebar
                    inputType={inputType}
                    setInputType={setInputType}
                    nodes={nodes}
                    setNodes={setNodes}
                    edges={edges}
                    setEdges={setEdges}
                    cuts={cuts}
                    setCuts={setCuts}
                    selectedNodes={selectedNodes}
                    setSelectedNodes={setSelectedNodes}
                    selectedEdges={selectedEdges}
                    setSelectedEdges={setSelectedEdges}
                    selectedCuts={selectedCuts}
                    setSelectedCuts={setSelectedCuts}
                    singleSelectedNode={singleSelectedNode}
                    singleSelectedEdge={singleSelectedEdge}
                    singleSelectedCut={singleSelectedCut}
                    multiSelected={multiSelected}
                    matrixInput={matrixInput}
                    setMatrixInput={setMatrixInput}
                    isDirectedGeneral={isDirectedGeneral}
                    setIsDirectedGeneral={setIsDirectedGeneral}
                    showMatrixWeights={showMatrixWeights}
                    setShowMatrixWeights={setShowMatrixWeights}
                    initialVerticesCount={initialVerticesCount}
                    setInitialVerticesCount={setInitialVerticesCount}
                    precedenceInput={precedenceInput}
                    setPrecedenceInput={setPrecedenceInput}
                    canvasWidth={canvasWidth}
                    setCanvasWidth={setCanvasWidth}
                    canvasHeight={canvasHeight}
                    setCanvasHeight={setCanvasHeight}
                    globalFontSize={globalFontSize}
                    setGlobalFontSize={setGlobalFontSize}
                    globalEdgeThickness={globalEdgeThickness}
                    setGlobalEdgeThickness={setGlobalEdgeThickness}
                    globalNodeRadius={globalNodeRadius}
                    setGlobalNodeRadius={setGlobalNodeRadius}
                    globalEdgeLabelProximity={globalEdgeLabelProximity}
                    setGlobalEdgeLabelProximity={setGlobalEdgeLabelProximity}
                    globalVertexLabelProximity={globalVertexLabelProximity}
                    setGlobalVertexLabelProximity={setGlobalVertexLabelProximity}
                    edgeLabelClearanceRatio={edgeLabelClearanceRatio}
                    setEdgeLabelClearanceRatio={setEdgeLabelClearanceRatio}
                    globalVertexStyle={globalVertexStyle}
                    debugEdgeLabels={debugEdgeLabels}
                    setDebugEdgeLabels={setDebugEdgeLabels}
                    livePhysicsUpdate={livePhysicsUpdate}
                    setLivePhysicsUpdate={setLivePhysicsUpdate}
                    updateOnDrop={updateOnDrop}
                    setUpdateOnDrop={setUpdateOnDrop}
                    forceSnapshot={forceSnapshot}
                    applyVertexStyle={applyVertexStyle}
                    applyMatrixToGraph={applyMatrixToGraph}
                    handleMatrixCellEdit={handleMatrixCellEdit}
                    handleAddMatrixNode={handleAddMatrixNode}
                    handleRemoveMatrixNode={handleRemoveMatrixNode}
                    handleClearMatrixEdges={handleClearMatrixEdges}
                    handleSyncMatrixFromGraph={handleSyncMatrixFromGraph}
                    handleExtractPrecedenceFromGraph={handleExtractPrecedenceFromGraph}
                    handleAutoFitCanvas={handleAutoFitCanvas}
                />

                <div ref={containerRef} className="flex-1 relative bg-neutral-100 overflow-auto p-4 flex canvas-viewport">
                    <NetworkCanvas
                        svgRef={svgRef}
                        canvasWidth={canvasWidth}
                        canvasHeight={canvasHeight}
                        previewScale={previewScale}
                        customViewBox={customViewBox}
                        mode={mode}
                        nodes={nodes}
                        edges={edges}
                        cuts={cuts}
                        selectedNodes={selectedNodes}
                        selectedEdges={selectedEdges}
                        selectedCuts={selectedCuts}
                        singleSelectedCut={singleSelectedCut}
                        edgeStartNode={edgeStartNode}
                        hoveredNode={hoveredNode}
                        setHoveredNode={setHoveredNode}
                        mousePos={mousePos}
                        selectionBox={selectionBox}
                        cropMode={cropMode}
                        cropSelectionBox={cropSelectionBox}
                        globalEdgeThickness={globalEdgeThickness}
                        globalNodeRadius={globalNodeRadius}
                        globalEdgeLabelProximity={globalEdgeLabelProximity}
                        scaledFontSize={scaledFontSize}
                        debugEdgeLabels={debugEdgeLabels}
                        onSvgPointerDown={handleSvgPointerDown}
                        onCanvasContextMenu={handleCanvasContextMenu}
                        onNodePointerDown={handleNodePointerDown}
                        onNodeContextMenu={handleNodeContextMenu}
                        onNodeLabelPointerDown={handleNodeLabelPointerDown}
                        onEdgePointerDown={handleEdgePointerDown}
                        onEdgeContextMenu={handleEdgeContextMenu}
                        onEdgeCPPointerDown={handleEdgeCPPointerDown}
                        onEdgeLabelPointerDown={handleEdgeLabelPointerDown}
                        onCutPointerDown={handleCutPointerDown}
                        onCutContextMenu={handleCutContextMenu}
                        onCutLabelPointerDown={handleCutLabelPointerDown}
                        onCutElementPointerDown={handleCutElementPointerDown}
                    />
                </div>
            </div>
            {contextMenu && (
                <GraphContextMenu
                    x={contextMenu.x}
                    y={contextMenu.y}
                    title={contextMenu.title}
                    items={contextMenu.items}
                    onClose={() => setContextMenu(null)}
                />
            )}
        </div>
    );
};

export default NetworkGrapher;
