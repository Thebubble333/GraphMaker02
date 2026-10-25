import React from 'react';
import { Trash2, Plus, Minus, RefreshCw } from 'lucide-react';
import { SmartNumberInput } from '../SmartNumberInput';
import {
    NetworkNode,
    NetworkEdge,
    NetworkCut,
    VertexDisplayStyle,
    MATRIX_PRESETS,
    PRECEDENCE_PRESETS,
    generateRegularPolygon,
    optimizeLabelPlacements
} from '../../utils/networkLogic';
import {
    parseAdjacencyMatrix,
    generateActivityNetwork
} from '../../utils/networkGenerators';

interface NetworkSidebarProps {
    inputType: 'manual' | 'matrix' | 'precedence' | 'regular' | 'settings';
    setInputType: (type: 'manual' | 'matrix' | 'precedence' | 'regular' | 'settings') => void;
    nodes: NetworkNode[];
    setNodes: React.Dispatch<React.SetStateAction<NetworkNode[]>>;
    edges: NetworkEdge[];
    setEdges: React.Dispatch<React.SetStateAction<NetworkEdge[]>>;
    cuts: NetworkCut[];
    setCuts: React.Dispatch<React.SetStateAction<NetworkCut[]>>;
    selectedNodes: string[];
    setSelectedNodes: React.Dispatch<React.SetStateAction<string[]>>;
    selectedEdges: string[];
    setSelectedEdges: React.Dispatch<React.SetStateAction<string[]>>;
    selectedCuts: string[];
    setSelectedCuts: React.Dispatch<React.SetStateAction<string[]>>;
    singleSelectedNode: string | null;
    singleSelectedEdge: string | null;
    singleSelectedCut: string | null;
    multiSelected: boolean;
    matrixInput: string;
    setMatrixInput: (val: string) => void;
    isDirectedGeneral: boolean;
    setIsDirectedGeneral: (val: boolean) => void;
    showMatrixWeights: boolean;
    setShowMatrixWeights: (val: boolean) => void;
    initialVerticesCount: number;
    setInitialVerticesCount: (val: number) => void;
    precedenceInput: string;
    setPrecedenceInput: (val: string) => void;
    canvasWidth: number;
    setCanvasWidth: (val: number) => void;
    canvasHeight: number;
    setCanvasHeight: (val: number) => void;
    globalFontSize: number;
    setGlobalFontSize: (val: number) => void;
    globalEdgeThickness: number;
    setGlobalEdgeThickness: (val: number) => void;
    globalNodeRadius: number;
    setGlobalNodeRadius: (val: number) => void;
    globalEdgeLabelProximity: number;
    setGlobalEdgeLabelProximity: (val: number) => void;
    globalVertexLabelProximity: number;
    setGlobalVertexLabelProximity: (val: number) => void;
    edgeLabelClearanceRatio: number;
    setEdgeLabelClearanceRatio: (val: number) => void;
    globalVertexStyle: VertexDisplayStyle;
    debugEdgeLabels: boolean;
    setDebugEdgeLabels: (val: boolean) => void;
    livePhysicsUpdate: boolean;
    setLivePhysicsUpdate: (val: boolean) => void;
    updateOnDrop: boolean;
    setUpdateOnDrop: (val: boolean) => void;
    forceSnapshot: () => void;
    applyVertexStyle: (
        style: VertexDisplayStyle,
        targetNodeIds?: string[],
        overrideBaseRadius?: number
    ) => void;
    applyMatrixToGraph: (
        matrixStr: string,
        isDirected: boolean,
        showWeights: boolean,
        preserveNodePositions?: boolean,
        customPositions?: { x: number; y: number }[]
    ) => void;
    handleMatrixCellEdit: (rIdx: number, cIdx: number, rawVal: string) => void;
    handleAddMatrixNode: () => void;
    handleRemoveMatrixNode: () => void;
    handleClearMatrixEdges: () => void;
    handleSyncMatrixFromGraph: () => void;
    handleExtractPrecedenceFromGraph: () => void;
    handleAutoFitCanvas: () => void;
}

export const NetworkSidebar: React.FC<NetworkSidebarProps> = ({
    inputType,
    setInputType,
    nodes,
    setNodes,
    edges,
    setEdges,
    cuts,
    setCuts,
    selectedNodes,
    setSelectedNodes,
    selectedEdges,
    setSelectedEdges,
    selectedCuts,
    setSelectedCuts,
    singleSelectedNode,
    singleSelectedEdge,
    singleSelectedCut,
    multiSelected,
    matrixInput,
    setMatrixInput,
    isDirectedGeneral,
    setIsDirectedGeneral,
    showMatrixWeights,
    setShowMatrixWeights,
    initialVerticesCount,
    setInitialVerticesCount,
    precedenceInput,
    setPrecedenceInput,
    canvasWidth,
    setCanvasWidth,
    canvasHeight,
    setCanvasHeight,
    globalFontSize,
    setGlobalFontSize,
    globalEdgeThickness,
    setGlobalEdgeThickness,
    globalNodeRadius,
    setGlobalNodeRadius,
    globalEdgeLabelProximity,
    setGlobalEdgeLabelProximity,
    globalVertexLabelProximity,
    setGlobalVertexLabelProximity,
    edgeLabelClearanceRatio,
    setEdgeLabelClearanceRatio,
    globalVertexStyle,
    debugEdgeLabels,
    setDebugEdgeLabels,
    livePhysicsUpdate,
    setLivePhysicsUpdate,
    updateOnDrop,
    setUpdateOnDrop,
    forceSnapshot,
    applyVertexStyle,
    applyMatrixToGraph,
    handleMatrixCellEdit,
    handleAddMatrixNode,
    handleRemoveMatrixNode,
    handleClearMatrixEdges,
    handleSyncMatrixFromGraph,
    handleExtractPrecedenceFromGraph,
    handleAutoFitCanvas
}) => {
    const parsedMatrix = parseAdjacencyMatrix(matrixInput);

    return (
        <aside className="w-80 border-r bg-gray-50 flex flex-col tool-sidebar">
            <div className="px-4 py-2.5 border-b font-semibold text-xs uppercase tracking-wider text-gray-700 flex items-center justify-between">
                <span>
                    {inputType === 'manual' && 'Properties'}
                    {inputType === 'matrix' && 'Adjacency Matrix'}
                    {inputType === 'precedence' && 'Precedence Table'}
                    {inputType === 'settings' && 'Global Settings'}
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
                            <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">
                                Load Preset
                            </label>
                            <select
                                className="w-full border rounded p-2 focus:ring-2 focus:ring-indigo-500 focus:outline-none text-sm bg-white"
                                onChange={e => {
                                    const preset = MATRIX_PRESETS.find(p => p.name === e.target.value);
                                    if (preset) {
                                        forceSnapshot();
                                        setMatrixInput(preset.value);
                                        setIsDirectedGeneral(preset.directed);
                                        applyMatrixToGraph(
                                            preset.value,
                                            preset.directed,
                                            showMatrixWeights,
                                            false,
                                            preset.positions
                                        );
                                    }
                                }}
                                defaultValue=""
                            >
                                <option value="" disabled>
                                    Select a preset...
                                </option>
                                {MATRIX_PRESETS.map(p => (
                                    <option key={p.name} value={p.name}>
                                        {p.name}
                                    </option>
                                ))}
                            </select>
                        </div>

                        <div className="bg-white p-3 rounded border space-y-3">
                            <div className="flex items-center justify-between">
                                <span className="text-xs font-semibold text-gray-500 uppercase">
                                    Matrix Grid ({parsedMatrix.matrix.length}×{parsedMatrix.matrix.length})
                                </span>
                                <div className="flex items-center gap-1">
                                    <button
                                        onClick={() => {
                                            forceSnapshot();
                                            handleRemoveMatrixNode();
                                        }}
                                        disabled={parsedMatrix.matrix.length <= 2}
                                        className="p-1 rounded border text-gray-600 hover:bg-gray-100 disabled:opacity-40"
                                        title="Remove Vertex"
                                    >
                                        <Minus size={12} />
                                    </button>
                                    <button
                                        onClick={() => {
                                            forceSnapshot();
                                            handleAddMatrixNode();
                                        }}
                                        disabled={parsedMatrix.matrix.length >= 12}
                                        className="p-1 rounded border text-gray-600 hover:bg-gray-100 disabled:opacity-40"
                                        title="Add Vertex"
                                    >
                                        <Plus size={12} />
                                    </button>
                                    <button
                                        onClick={() => {
                                            forceSnapshot();
                                            handleSyncMatrixFromGraph();
                                        }}
                                        className="px-2 py-0.5 rounded border text-xs text-indigo-600 hover:bg-indigo-50 flex items-center gap-1"
                                        title="Sync matrix from current canvas graph"
                                    >
                                        <RefreshCw size={11} /> Sync
                                    </button>
                                </div>
                            </div>

                            <div className="flex items-center gap-4 text-xs text-gray-700">
                                <label className="flex items-center gap-1.5 cursor-pointer">
                                    <input
                                        type="checkbox"
                                        checked={isDirectedGeneral}
                                        onChange={e => {
                                            forceSnapshot();
                                            const nextDir = e.target.checked;
                                            setIsDirectedGeneral(nextDir);
                                            applyMatrixToGraph(matrixInput, nextDir, showMatrixWeights, true);
                                        }}
                                        className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                                    />
                                    Directed
                                </label>
                                <label className="flex items-center gap-1.5 cursor-pointer">
                                    <input
                                        type="checkbox"
                                        checked={showMatrixWeights}
                                        onChange={e => {
                                            forceSnapshot();
                                            const nextWeights = e.target.checked;
                                            setShowMatrixWeights(nextWeights);
                                            applyMatrixToGraph(matrixInput, isDirectedGeneral, nextWeights, true);
                                        }}
                                        className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                                    />
                                    Show Weights
                                </label>
                            </div>

                            {parsedMatrix.matrix.length > 0 && (
                                <div className="overflow-x-auto">
                                    <table className="border-collapse text-center text-xs mx-auto">
                                        <thead>
                                            <tr>
                                                <th className="p-1 text-gray-400 font-semibold"></th>
                                                {parsedMatrix.labels.map((lbl, cIdx) => (
                                                    <th
                                                        key={cIdx}
                                                        className="p-1 text-indigo-700 font-bold min-w-[26px]"
                                                    >
                                                        {lbl}
                                                    </th>
                                                ))}
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {parsedMatrix.matrix.map((row, rIdx) => (
                                                <tr key={rIdx}>
                                                    <th className="p-1 text-indigo-700 font-bold pr-1.5">
                                                        {parsedMatrix.labels[rIdx]}
                                                    </th>
                                                    {row.map((val, cIdx) => (
                                                        <td key={cIdx} className="p-0.5">
                                                            <input
                                                                type="text"
                                                                value={val}
                                                                onChange={e => {
                                                                    forceSnapshot();
                                                                    handleMatrixCellEdit(
                                                                        rIdx,
                                                                        cIdx,
                                                                        e.target.value
                                                                    );
                                                                }}
                                                                className={`w-7 h-7 text-center border rounded text-xs focus:ring-1 focus:ring-indigo-500 focus:outline-none ${
                                                                    val > 0
                                                                        ? 'bg-indigo-50 font-semibold text-indigo-900 border-indigo-200'
                                                                        : 'bg-white text-gray-500 border-gray-200'
                                                                }`}
                                                            />
                                                        </td>
                                                    ))}
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            )}

                            <div className="flex gap-2">
                                <button
                                    onClick={() => {
                                        forceSnapshot();
                                        handleClearMatrixEdges();
                                    }}
                                    className="flex-1 text-xs bg-gray-100 hover:bg-gray-200 text-gray-700 py-1.5 rounded font-medium transition-colors"
                                >
                                    Clear Edges
                                </button>
                                <button
                                    onClick={() => {
                                        forceSnapshot();
                                        applyMatrixToGraph(
                                            matrixInput,
                                            isDirectedGeneral,
                                            showMatrixWeights,
                                            false
                                        );
                                    }}
                                    className="flex-1 text-xs bg-indigo-600 hover:bg-indigo-700 text-white py-1.5 rounded font-medium transition-colors"
                                >
                                    Reset Layout
                                </button>
                            </div>
                        </div>

                        <div className="space-y-2 bg-white p-2.5 rounded border">
                            <div className="flex items-center gap-2">
                                <SmartNumberInput
                                    value={initialVerticesCount}
                                    onChange={setInitialVerticesCount}
                                    className="w-16 border rounded p-1.5 text-sm"
                                    min={1}
                                    max={50}
                                />
                                <label className="text-sm font-medium text-gray-700">Initial Vertices</label>
                            </div>
                            <button
                                className="w-full bg-indigo-50 text-indigo-700 border border-indigo-200 py-1.5 rounded text-sm font-medium hover:bg-indigo-100 transition-colors"
                                onClick={() => {
                                    forceSnapshot();
                                    const newNodes = generateRegularPolygon(
                                        initialVerticesCount,
                                        canvasWidth / 2,
                                        canvasHeight / 2,
                                        globalVertexStyle,
                                        canvasWidth,
                                        canvasHeight,
                                        globalNodeRadius
                                    );
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
                            <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">
                                Load Preset
                            </label>
                            <select
                                className="w-full border rounded p-2 focus:ring-2 focus:ring-indigo-500 focus:outline-none text-sm bg-white"
                                onChange={e => {
                                    const preset = PRECEDENCE_PRESETS.find(p => p.name === e.target.value);
                                    if (preset) {
                                        setPrecedenceInput(preset.value);
                                        const res = generateActivityNetwork(
                                            preset.value,
                                            canvasWidth,
                                            canvasHeight
                                        );
                                        if (!res.error) {
                                            forceSnapshot();
                                            setNodes(res.nodes);
                                            setEdges(res.edges);
                                        }
                                    }
                                }}
                                defaultValue=""
                            >
                                <option value="" disabled>
                                    Select a preset...
                                </option>
                                {PRECEDENCE_PRESETS.map(p => (
                                    <option key={p.name} value={p.name}>
                                        {p.name}
                                    </option>
                                ))}
                            </select>
                        </div>
                        <div className="space-y-1">
                            <div className="flex items-center justify-between">
                                <label className="block text-xs font-semibold text-gray-500 uppercase">
                                    Precedence Table
                                </label>
                                <button
                                    onClick={handleExtractPrecedenceFromGraph}
                                    className="text-xs text-indigo-600 hover:text-indigo-800 flex items-center gap-1"
                                    title="Extract activity table from current graph"
                                >
                                    <RefreshCw size={11} /> Extract from Graph
                                </button>
                            </div>
                            <p className="text-xs text-gray-500">
                                Format: Name, Dependencies, Duration (e.g. A, -, 5 or D, A;B, 4)
                            </p>
                        </div>
                        <textarea
                            className="w-full h-48 border rounded p-2 focus:ring-2 focus:ring-indigo-500 focus:outline-none font-mono text-sm whitespace-pre font-medium"
                            value={precedenceInput}
                            onChange={e => setPrecedenceInput(e.target.value)}
                            placeholder="A, -, 5\nB, A, 2..."
                        />
                        <button
                            onClick={() => {
                                const res = generateActivityNetwork(
                                    precedenceInput,
                                    canvasWidth,
                                    canvasHeight
                                );
                                if (!res.error) {
                                    forceSnapshot();
                                    setNodes(res.nodes);
                                    setEdges(res.edges);
                                    setInputType('manual');
                                }
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
                                <button
                                    className="w-full bg-white border border-gray-300 text-gray-700 py-2 rounded flex items-center justify-center gap-2 text-sm font-medium hover:bg-gray-50 transition-colors"
                                    onClick={() => setDebugEdgeLabels(!debugEdgeLabels)}
                                >
                                    {debugEdgeLabels ? 'Hide Physics Debug' : 'Show Physics Debug'}
                                </button>
                            </div>

                            <h3 className="font-medium text-indigo-900">Global Styles</h3>

                            <div className="space-y-3">
                                <div>
                                    <label className="block text-xs font-semibold text-gray-500 uppercase mb-2">
                                        Canvas Size (Printing)
                                    </label>
                                    <div className="flex items-center gap-2">
                                        <div>
                                            <label className="block text-xs font-semibold text-gray-500 mb-1">
                                                Width (cm)
                                            </label>
                                            <SmartNumberInput
                                                value={Math.round((canvasWidth / 37.7952755906) * 10) / 10}
                                                onChange={val =>
                                                    setCanvasWidth(
                                                        Math.max(100, Math.min(2000, Math.round(val * 37.7952755906)))
                                                    )
                                                }
                                                className="w-full border rounded p-1.5 focus:ring-2 focus:ring-indigo-500 focus:outline-none text-sm"
                                                step="0.1"
                                                min={1}
                                                max={50}
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-xs font-semibold text-gray-500 mb-1">
                                                Height (cm)
                                            </label>
                                            <SmartNumberInput
                                                value={Math.round((canvasHeight / 37.7952755906) * 10) / 10}
                                                onChange={val =>
                                                    setCanvasHeight(
                                                        Math.max(100, Math.min(2000, Math.round(val * 37.7952755906)))
                                                    )
                                                }
                                                className="w-full border rounded p-1.5 focus:ring-2 focus:ring-indigo-500 focus:outline-none text-sm"
                                                step="0.1"
                                                min={1}
                                                max={50}
                                            />
                                        </div>
                                    </div>
                                    <div className="grid grid-cols-2 gap-2 mt-2">
                                        <button
                                            className="text-xs bg-gray-100 hover:bg-gray-200 p-1.5 rounded"
                                            onClick={() => {
                                                setCanvasWidth(378);
                                                setCanvasHeight(302);
                                            }}
                                        >
                                            Small
                                        </button>
                                        <button
                                            className="text-xs bg-gray-100 hover:bg-gray-200 p-1.5 rounded text-indigo-700 font-medium"
                                            onClick={handleAutoFitCanvas}
                                        >
                                            Auto Fit
                                        </button>
                                    </div>
                                </div>

                                <div className="pt-2 border-t">
                                    <div>
                                        <label className="block text-xs font-semibold text-gray-500 mb-1">
                                            Font Size
                                        </label>
                                        <SmartNumberInput
                                            value={globalFontSize}
                                            onChange={val => setGlobalFontSize(Math.max(8, Math.min(48, val)))}
                                            className="w-full border rounded p-1.5 focus:ring-2 focus:ring-indigo-500 focus:outline-none text-sm"
                                            min={8}
                                            max={48}
                                        />
                                    </div>
                                    <div className="mt-2">
                                        <label className="block text-xs font-semibold text-gray-500 mb-1">
                                            Edge Thickness
                                        </label>
                                        <SmartNumberInput
                                            value={globalEdgeThickness}
                                            onChange={val => setGlobalEdgeThickness(Math.max(1, Math.min(10, val)))}
                                            className="w-full border rounded p-1.5 focus:ring-2 focus:ring-indigo-500 focus:outline-none text-sm"
                                            min={0.1}
                                            max={10}
                                            step="0.1"
                                        />
                                    </div>
                                    <div className="mt-2">
                                        <label className="block text-xs font-semibold text-gray-500 mb-1">
                                            Node/Handle Radius
                                        </label>
                                        <SmartNumberInput
                                            value={globalNodeRadius}
                                            onChange={val => {
                                                forceSnapshot();
                                                const newRadius = Math.max(2, Math.min(30, val));
                                                setGlobalNodeRadius(newRadius);
                                                applyVertexStyle(globalVertexStyle, undefined, newRadius);
                                            }}
                                            className="w-full border rounded p-1.5 focus:ring-2 focus:ring-indigo-500 focus:outline-none text-sm"
                                            min={2}
                                            max={30}
                                        />
                                    </div>
                                    <div className="mt-2">
                                        <label className="block text-xs font-semibold text-gray-500 mb-1">
                                            Edge Label Prox.
                                        </label>
                                        <SmartNumberInput
                                            value={globalEdgeLabelProximity}
                                            onChange={val =>
                                                setGlobalEdgeLabelProximity(Math.max(-50, Math.min(100, val)))
                                            }
                                            className="w-full border rounded p-1.5 focus:ring-2 focus:ring-indigo-500 focus:outline-none text-sm"
                                        />
                                    </div>
                                    <div className="mt-2">
                                        <label className="block text-xs font-semibold text-gray-500 mb-1">
                                            Vertex Label Prox.
                                        </label>
                                        <SmartNumberInput
                                            value={globalVertexLabelProximity}
                                            onChange={val =>
                                                setGlobalVertexLabelProximity(Math.max(-50, Math.min(100, val)))
                                            }
                                            className="w-full border rounded p-1.5 focus:ring-2 focus:ring-indigo-500 focus:outline-none text-sm"
                                        />
                                    </div>
                                    <div className="mt-2">
                                        <label className="block text-xs font-semibold text-gray-500 mb-1">
                                            Edge Clearance Ratio
                                        </label>
                                        <div className="flex items-center">
                                            <input
                                                type="number"
                                                step="0.1"
                                                value={edgeLabelClearanceRatio}
                                                onChange={e =>
                                                    setEdgeLabelClearanceRatio(
                                                        Math.max(0, Math.min(5, parseFloat(e.target.value) || 0))
                                                    )
                                                }
                                                className="w-full border rounded p-1.5 focus:ring-2 focus:ring-indigo-500 focus:outline-none text-sm"
                                            />
                                        </div>
                                    </div>
                                    <div className="mt-2">
                                        <label className="block text-xs font-semibold text-gray-500 mb-1">
                                            Vertex Label Style
                                        </label>
                                        <select
                                            value={globalVertexStyle}
                                            onChange={e => {
                                                forceSnapshot();
                                                applyVertexStyle(
                                                    e.target.value as 'inside' | 'outside' | 'none'
                                                );
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
                            <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">
                                Label
                            </label>
                            <input
                                id="network-vertex-label-input"
                                type="text"
                                className="w-full border rounded p-2 focus:ring-2 focus:ring-indigo-500 focus:outline-none text-sm"
                                value={nodes.find(n => n.id === singleSelectedNode)?.label || ''}
                                onChange={e =>
                                    setNodes(
                                        nodes.map(n =>
                                            n.id === singleSelectedNode ? { ...n, label: e.target.value } : n
                                        )
                                    )
                                }
                            />
                        </div>
                        <div id="network-vertex-radius-input" className="mt-4">
                            <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">
                                Radius
                            </label>
                            <SmartNumberInput
                                className="w-full border rounded p-2 focus:ring-2 focus:ring-indigo-500 focus:outline-none text-sm"
                                value={nodes.find(n => n.id === singleSelectedNode)?.radius || 6}
                                onChange={val =>
                                    setNodes(
                                        nodes.map(n =>
                                            n.id === singleSelectedNode ? { ...n, radius: val } : n
                                        )
                                    )
                                }
                                min={1}
                                max={100}
                            />
                        </div>
                        <button
                            className="w-full bg-red-50 text-red-600 border border-red-200 py-2 rounded text-sm font-medium flex items-center justify-center gap-2 hover:bg-red-100 transition-colors mt-4"
                            onClick={() => {
                                forceSnapshot();
                                setEdges(
                                    edges.filter(
                                        e => e.from !== singleSelectedNode && e.to !== singleSelectedNode
                                    )
                                );
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
                            <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">
                                Label / Weight
                            </label>
                            <input
                                id="network-edge-label-input"
                                type="text"
                                className="w-full border rounded p-2 focus:ring-2 focus:ring-indigo-500 focus:outline-none text-sm"
                                value={edges.find(e => e.id === singleSelectedEdge)?.label || ''}
                                onChange={e =>
                                    setEdges(
                                        edges.map(e2 =>
                                            e2.id === singleSelectedEdge
                                                ? { ...e2, label: e.target.value }
                                                : e2
                                        )
                                    )
                                }
                            />
                        </div>
                        <div className="mt-2 space-y-2">
                            <label className="flex items-center gap-2 text-sm text-gray-700">
                                <input
                                    type="checkbox"
                                    checked={edges.find(e => e.id === singleSelectedEdge)?.isDirected || false}
                                    onChange={e =>
                                        setEdges(
                                            edges.map(e2 =>
                                                e2.id === singleSelectedEdge
                                                    ? { ...e2, isDirected: e.target.checked }
                                                    : e2
                                            )
                                        )
                                    }
                                    className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                                />
                                Directed Edge
                            </label>
                            <label className="flex items-center gap-2 text-sm text-gray-700">
                                <input
                                    type="checkbox"
                                    checked={edges.find(e => e.id === singleSelectedEdge)?.isDummy || false}
                                    onChange={e =>
                                        setEdges(
                                            edges.map(e2 =>
                                                e2.id === singleSelectedEdge
                                                    ? { ...e2, isDummy: e.target.checked }
                                                    : e2
                                            )
                                        )
                                    }
                                    className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                                />
                                Dummy (Dashed)
                            </label>
                        </div>

                        {edges.find(e => e.id === singleSelectedEdge)?.isLoop ? (
                            <div className="mt-4">
                                <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">
                                    Loop Height
                                </label>
                                <SmartNumberInput
                                    step="0.1"
                                    className="w-full border rounded p-1.5 focus:ring-2 focus:ring-indigo-500 focus:outline-none text-sm"
                                    value={edges.find(e => e.id === singleSelectedEdge)?.loopRadiusY ?? 1.0}
                                    onChange={val =>
                                        setEdges(
                                            edges.map(e2 =>
                                                e2.id === singleSelectedEdge
                                                    ? { ...e2, loopRadiusY: val }
                                                    : e2
                                            )
                                        )
                                    }
                                    min={0.1}
                                    max={10}
                                />
                            </div>
                        ) : (
                            <label className="flex items-center gap-2 text-sm text-gray-700 mt-2">
                                <input
                                    type="checkbox"
                                    checked={edges.find(e => e.id === singleSelectedEdge)?.isCurve || false}
                                    onChange={e => {
                                        const checked = e.target.checked;
                                        setEdges(
                                            edges.map(e2 => {
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
                                                            return {
                                                                ...e2,
                                                                isCurve: true,
                                                                cp1: { x: mx + 35 * nx, y: my + 35 * ny }
                                                            };
                                                        }
                                                    } else if (!checked) {
                                                        const { cp1, ...rest } = e2;
                                                        return { ...rest, isCurve: false };
                                                    }
                                                    return { ...e2, isCurve: checked };
                                                }
                                                return e2;
                                            })
                                        );
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
                            <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">
                                Label
                            </label>
                            <input
                                id="network-cut-label-input"
                                type="text"
                                className="w-full border rounded p-2 focus:ring-2 focus:ring-indigo-500 focus:outline-none text-sm"
                                value={cuts.find(c => c.id === singleSelectedCut)?.label || ''}
                                onChange={e =>
                                    setCuts(
                                        cuts.map(c =>
                                            c.id === singleSelectedCut
                                                ? { ...c, label: e.target.value }
                                                : c
                                        )
                                    )
                                }
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

                {inputType === 'manual' && multiSelected && (
                    <div className="space-y-3 bg-white p-4 rounded-lg border shadow-sm">
                        <h3 className="font-medium text-indigo-900">Multiple Items Selected</h3>
                        <p className="text-xs text-gray-500">
                            {selectedNodes.length} vertices, {selectedEdges.length} edges,{' '}
                            {selectedCuts.length} cuts selected.
                        </p>
                        <button
                            className="w-full bg-red-50 text-red-600 border border-red-200 py-2 rounded text-sm font-medium flex items-center justify-center gap-2 hover:bg-red-100 transition-colors"
                            onClick={() => {
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
                            }}
                        >
                            <Trash2 size={16} /> Delete Selected
                        </button>
                    </div>
                )}

                <div className="mt-8 border-t pt-4 space-y-2">
                    <div className="flex flex-col gap-2">
                        <button
                            className="w-full bg-white border border-gray-300 text-gray-700 py-2 rounded flex items-center justify-center gap-2 text-sm font-medium hover:bg-gray-50 transition-colors shadow-sm"
                            onClick={() => {
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
                            }}
                        >
                            Auto-Place All Labels
                        </button>
                        <div className="flex gap-2">
                            <button
                                className="flex-1 bg-gray-50 text-gray-600 border border-gray-200 py-1.5 rounded flex items-center justify-center text-xs font-medium hover:bg-gray-100 transition-colors"
                                onClick={() => {
                                    const opt = optimizeLabelPlacements(
                                        nodes,
                                        edges,
                                        globalEdgeLabelProximity,
                                        globalVertexLabelProximity,
                                        edgeLabelClearanceRatio,
                                        globalVertexStyle,
                                        globalNodeRadius,
                                        'vertex'
                                    );
                                    forceSnapshot();
                                    setNodes(opt.nodes);
                                }}
                            >
                                Vertices Only
                            </button>
                            <button
                                className="flex-1 bg-gray-50 text-gray-600 border border-gray-200 py-1.5 rounded flex items-center justify-center text-xs font-medium hover:bg-gray-100 transition-colors"
                                onClick={() => {
                                    const opt = optimizeLabelPlacements(
                                        nodes,
                                        edges,
                                        globalEdgeLabelProximity,
                                        globalVertexLabelProximity,
                                        edgeLabelClearanceRatio,
                                        globalVertexStyle,
                                        globalNodeRadius,
                                        'edge'
                                    );
                                    forceSnapshot();
                                    setEdges(opt.edges);
                                }}
                            >
                                Edges Only
                            </button>
                        </div>
                        <div className="flex flex-col gap-1 mt-1">
                            <label className="flex items-center gap-2 text-xs text-gray-600 cursor-pointer">
                                <input
                                    type="checkbox"
                                    checked={livePhysicsUpdate}
                                    onChange={e => setLivePhysicsUpdate(e.target.checked)}
                                    className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                                />
                                Live update during drag
                            </label>
                            <label className="flex items-center gap-2 text-xs text-gray-600 cursor-pointer">
                                <input
                                    type="checkbox"
                                    checked={updateOnDrop}
                                    onChange={e => setUpdateOnDrop(e.target.checked)}
                                    className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                                />
                                Auto-update after drag drop
                            </label>
                        </div>
                    </div>
                </div>
            </div>
        </aside>
    );
};
