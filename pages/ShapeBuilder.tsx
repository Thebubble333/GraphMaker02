import React, { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import { GraphToolbar } from '../components/GraphToolbar';
import { GraphContextMenu, ContextMenuItem } from '../components/GraphContextMenu';
import { useGraphInteraction } from '../hooks/useGraphInteraction';
import { useDragSystem } from '../hooks/useDragSystem';
import { useHistory } from '../hooks/useHistory';
import { renderShape } from '../utils/shape/renderer';
import { ShapeDef, RectangleDef, EdgeDecoration, ShapeLabel } from '../utils/shape/types';
import { CM_TO_PX } from '../constants';
import { RotateCw, BoxSelect, Maximize, ArrowLeftRight, PaintBucket, MoveHorizontal, Hash, Type, RefreshCcw, Edit3, Trash2, RotateCcw, EyeOff } from 'lucide-react';
import { ptToSvgUnits } from '../utils/imageExport';

// Start with just a nice rectangle
const INITIAL_SHAPES: ShapeDef[] = [
    {
        id: '1',
        type: 'rectangle',
        x: 378, y: 283, rotation: 0,
        width: 200, height: 120,
        stroke: '#000000', fill: 'transparent', strokeWidth: 1.5, opacity: 1,
        showDimensions: false,
        dimensionPlacement: 'outside',
        labels: [],
        edgeDecorations: [],
        vertexDecorations: []
    }
];

interface ShapeBuilderState {
    shapes: ShapeDef[];
    dimCm: { width: number; height: number };
    labelSwap: boolean;
    tickSwap: boolean;
    fontSize: number;
}

const DEFAULT_SHAPE_BUILDER_STATE: ShapeBuilderState = {
    shapes: INITIAL_SHAPES,
    dimCm: { width: 15, height: 15 },
    labelSwap: false,
    tickSwap: false,
    fontSize: 11
};

const ShapeBuilder: React.FC = () => {
    // --- STATE ---
    const [shapes, setShapes] = useState<ShapeDef[]>(DEFAULT_SHAPE_BUILDER_STATE.shapes);
    const [selectedShapeId, setSelectedShapeId] = useState<string | null>(INITIAL_SHAPES[0].id);
    const [selectedLabelId, setSelectedLabelId] = useState<string | null>(null);
    const [dimCm, setDimCm] = useState(DEFAULT_SHAPE_BUILDER_STATE.dimCm);
    
    // UI Helpers
    const [labelSwap, setLabelSwap] = useState(DEFAULT_SHAPE_BUILDER_STATE.labelSwap);
    const [tickSwap, setTickSwap] = useState(DEFAULT_SHAPE_BUILDER_STATE.tickSwap);
    const [fontSize, setFontSize] = useState(DEFAULT_SHAPE_BUILDER_STATE.fontSize);

    const [highlightedControlId, setHighlightedControlId] = useState<string | null>(null);
    const [contextMenu, setContextMenu] = useState<{
        x: number;
        y: number;
        title: string;
        items: ContextMenuItem[];
    } | null>(null);

    const currentState = useMemo<ShapeBuilderState>(() => ({
        shapes,
        dimCm,
        labelSwap,
        tickSwap,
        fontSize
    }), [shapes, dimCm, labelSwap, tickSwap, fontSize]);

    const applyRestoredState = useCallback((s: ShapeBuilderState) => {
        const nextShapes = s.shapes ?? DEFAULT_SHAPE_BUILDER_STATE.shapes;
        setShapes(nextShapes);
        setDimCm(s.dimCm ?? DEFAULT_SHAPE_BUILDER_STATE.dimCm);
        setLabelSwap(s.labelSwap ?? DEFAULT_SHAPE_BUILDER_STATE.labelSwap);
        setTickSwap(s.tickSwap ?? DEFAULT_SHAPE_BUILDER_STATE.tickSwap);
        setFontSize(s.fontSize ?? DEFAULT_SHAPE_BUILDER_STATE.fontSize);
        if (nextShapes.length > 0) {
            setSelectedShapeId(nextShapes[0].id);
        }
    }, []);

    const {
        forceSnapshot,
        undo,
        redo,
        canUndo,
        canRedo,
        exportToFile,
        importFromFile
    } = useHistory<ShapeBuilderState>({
        appId: 'ShapeBuilder',
        version: 1,
        currentState,
        onRestore: applyRestoredState
    });

    const handleDefaultSettings = () => {
        forceSnapshot();
        applyRestoredState(DEFAULT_SHAPE_BUILDER_STATE);
    };

    const navigateToGuiControl = useCallback((controlId: string, focusSelector?: string) => {
        setHighlightedControlId(controlId);
        setTimeout(() => {
            const el = document.getElementById(controlId);
            if (el) {
                el.scrollIntoView({ behavior: 'smooth', block: 'center' });
                if (focusSelector) {
                    const input = el.querySelector(focusSelector) as HTMLElement | null;
                    if (input) {
                        input.focus();
                        if (input instanceof HTMLInputElement) input.select();
                    }
                }
            }
        }, 60);
        setTimeout(() => setHighlightedControlId(null), 2200);
    }, []);

    const widthPixels = Math.round(dimCm.width * CM_TO_PX);
    const heightPixels = Math.round(dimCm.height * CM_TO_PX);

    // Refs for auto-focus
    const labelInputRefs = useRef<Record<string, HTMLInputElement | null>>({});

    // --- INTERACTION HOOKS ---
    const {
        previewScale, setPreviewScale,
        exportDpi, setExportDpi,
        cropMode, setCropMode,
        selectionBox, customViewBox, hasInitialCrop,
        containerRef,
        handleAutoCrop, handleResetView, handleZoomOutCanvas, handleExportPNG, handleExportSVG, handleCopy, isCopied,
        handleCropMouseDown, handleCropMouseMove, handleCropMouseUp
    } = useGraphInteraction('shape-svg', widthPixels, heightPixels, dimCm.width, false, true);

    const { onMouseDown, onMouseMove, onMouseUp } = useDragSystem(previewScale);

    const viewBoxScale = useMemo(() => {
        if (!customViewBox) return 1;
        const parts = customViewBox.split(' ').map(Number);
        if (parts.length === 4 && widthPixels > 0) {
            return parts[2] / widthPixels;
        }
        return 1;
    }, [customViewBox, widthPixels]);

    useEffect(() => {
        if (shapes.length > 0 && !selectedShapeId) {
            setSelectedShapeId(shapes[0].id);
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []); 

    // Focus label input when selected
    useEffect(() => {
        if (selectedLabelId && labelInputRefs.current[selectedLabelId]) {
            labelInputRefs.current[selectedLabelId]?.focus();
        }
    }, [selectedLabelId]);

    // --- DRAG HANDLERS ---
    const handleShapeDragStart = (id: string, e: React.MouseEvent) => {
        if (cropMode) return;
        e.stopPropagation();
        setSelectedShapeId(id);
        setSelectedLabelId(null);
        const shape = shapes.find(s => s.id === id);
        if (!shape) return;
        forceSnapshot();
        onMouseDown(e, { x: shape.x, y: shape.y }, (dx, dy, init) => {
            const svgDx = dx * viewBoxScale;
            const svgDy = dy * viewBoxScale;
            setShapes(prev => prev.map(s => s.id === id ? { ...s, x: init.x + svgDx, y: init.y + svgDy } : s));
        }, undefined, 'move-shape');
    };

    const handleResizeHandleDrag = (shapeId: string, handleId: string, e: React.MouseEvent) => {
        if (cropMode) return;
        e.stopPropagation();
        const shape = shapes.find(s => s.id === shapeId);
        if (!shape) return;
        forceSnapshot();

        const initDims = {
            w: 'width' in shape ? shape.width : 0,
            h: 'height' in shape ? shape.height : 0,
            r: 'radius' in shape ? shape.radius : 0,
            b: 'base' in shape ? shape.base : 0,
            peak: 'peakOffset' in shape ? shape.peakOffset : 0
        };
        const rad = -shape.rotation * (Math.PI / 180);
        
        onMouseDown(e, initDims, (dx, dy, init) => {
            const svgDx = dx * viewBoxScale;
            const svgDy = dy * viewBoxScale;
            const localDx = svgDx * Math.cos(rad) - svgDy * Math.sin(rad);
            const localDy = svgDx * Math.sin(rad) + svgDy * Math.cos(rad);

            const updates: any = {};
            if (shape.type === 'rectangle') {
                if (handleId === 'h-right') updates.width = Math.max(10, init.w + localDx * 2);
                if (handleId === 'h-left') updates.width = Math.max(10, init.w - localDx * 2);
                if (handleId === 'h-bottom') updates.height = Math.max(10, init.h + localDy * 2);
                if (handleId === 'h-top') updates.height = Math.max(10, init.h - localDy * 2);
            }
            setShapes(prev => prev.map(s => s.id === shapeId ? { ...s, ...updates } as ShapeDef : s));
        }, undefined, 'resize-handle');
    };

    const handleLabelDragStart = (shapeId: string, labelId: string, e: React.MouseEvent) => {
        if (cropMode) return;
        e.stopPropagation();
        
        setSelectedShapeId(shapeId);
        setSelectedLabelId(labelId);

        const shape = shapes.find(s => s.id === shapeId);
        const label = shape?.labels.find(l => l.id === labelId);
        if (!shape || !label) return;
        forceSnapshot();

        const isEdgeLabel = label.type === 'edge' && label.index !== undefined;
        
        const initialOffsets: Record<string, {x: number, y: number}> = {};
        shape.labels.forEach(l => {
            initialOffsets[l.id] = { x: l.offsetX, y: l.offsetY };
        });

        let dragNormal = { x: 0, y: 0 };
        
        if (isEdgeLabel && shape.type === 'rectangle') {
            const baseNormals = [{x:0, y:-1}, {x:1, y:0}, {x:0, y:1}, {x:-1, y:0}];
            const baseN = baseNormals[label.index || 0];
            
            const rad = shape.rotation * (Math.PI / 180);
            dragNormal = {
                x: baseN.x * Math.cos(rad) - baseN.y * Math.sin(rad),
                y: baseN.x * Math.sin(rad) + baseN.y * Math.cos(rad)
            };
        }

        onMouseDown(e, { initialOffsets }, (dx, dy, init) => {
            const svgDx = dx * viewBoxScale;
            const svgDy = dy * viewBoxScale;

            setShapes(prev => prev.map(s => {
                if (s.id !== shapeId) return s;

                const newLabels = s.labels.map(l => {
                    const initOff = init.initialOffsets[l.id];
                    if (!initOff) return l;

                    if (isEdgeLabel && (dragNormal.x !== 0 || dragNormal.y !== 0)) {
                        const distChange = svgDx * dragNormal.x + svgDy * dragNormal.y;

                        if (l.type === 'edge' && l.index !== undefined) {
                            const baseNormals = [{x:0, y:-1}, {x:1, y:0}, {x:0, y:1}, {x:-1, y:0}];
                            const ln = baseNormals[l.index];
                            const rad = s.rotation * (Math.PI / 180);
                            const currentNormal = {
                                x: ln.x * Math.cos(rad) - ln.y * Math.sin(rad),
                                y: ln.x * Math.sin(rad) + ln.y * Math.cos(rad)
                            };

                            return {
                                ...l,
                                offsetX: initOff.x + (distChange * currentNormal.x),
                                offsetY: initOff.y + (distChange * currentNormal.y)
                            };
                        }
                    } 
                    
                    if (l.id === labelId && !isEdgeLabel) {
                        return {
                            ...l,
                            offsetX: initOff.x + svgDx,
                            offsetY: initOff.y + svgDy
                        };
                    }

                    return l;
                });

                return { ...s, labels: newLabels };
            }));
        }, undefined, 'move-label');
    };

    const handleGlobalMouseMove = (e: React.MouseEvent) => {
        if (handleCropMouseMove(e)) return;
        onMouseMove(e);
    };

    const handleGlobalMouseUp = () => {
        handleCropMouseUp();
        onMouseUp();
    };

    const handleCanvasClick = () => {
        if (!cropMode) {
            setSelectedShapeId(null);
            setSelectedLabelId(null);
        }
    };

    const updateSelected = (updates: Partial<ShapeDef>) => {
        if (!selectedShapeId) return;
        setShapes(prev => prev.map(s => s.id === selectedShapeId ? { ...s, ...updates } as ShapeDef : s));
    };

    const updateLabel = (labelId: string, updates: Partial<ShapeLabel>) => {
        setShapes(prev => prev.map(s => {
            if (s.id !== selectedShapeId) return s;
            return {
                ...s,
                labels: s.labels.map(l => l.id === labelId ? { ...l, ...updates } : l)
            };
        }));
    };

    // --- RECTANGLE LOGIC HELPERS ---
    const applyLabelMode = (mode: 'none' | '2' | '4') => {
        if (!selectedShapeId) return;
        forceSnapshot();
        
        const newLabels: ShapeLabel[] = [];
        const common = { type: 'edge' as const, offsetX: 0, offsetY: 0, color: 'black', fontSize: ptToSvgUnits(fontSize) };

        if (mode === '2') {
            const idx1 = labelSwap ? 2 : 0; // w
            const idx2 = labelSwap ? 3 : 1; // h
            
            newLabels.push({ id: Date.now() + '1', text: '$w$', index: idx1, ...common });
            newLabels.push({ id: Date.now() + '2', text: '$h$', index: idx2, ...common });
        } else if (mode === '4') {
            newLabels.push({ id: Date.now() + '1', text: '$a$', index: 0, ...common });
            newLabels.push({ id: Date.now() + '2', text: '$b$', index: 1, ...common });
            newLabels.push({ id: Date.now() + '3', text: '$c$', index: 2, ...common });
            newLabels.push({ id: Date.now() + '4', text: '$d$', index: 3, ...common });
        }
        
        updateSelected({ labels: newLabels });
        setSelectedLabelId(null);
    };

    const applyTickMode = (active: boolean) => {
        if (!selectedShapeId) return;
        if (!active) {
            updateSelected({ edgeDecorations: [] });
            return;
        }

        const horizType = tickSwap ? 'double-tick' : 'tick';
        const vertType = tickSwap ? 'tick' : 'double-tick';
        
        const decs: EdgeDecoration[] = [
            { edgeIndex: 0, type: horizType },
            { edgeIndex: 2, type: horizType },
            { edgeIndex: 1, type: vertType },
            { edgeIndex: 3, type: vertType },
        ];
        updateSelected({ edgeDecorations: decs });
    };

    useEffect(() => {
        const s = shapes.find(sh => sh.id === selectedShapeId);
        if (s && s.edgeDecorations.length > 0) applyTickMode(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [tickSwap]);

    useEffect(() => {
        const s = shapes.find(sh => sh.id === selectedShapeId);
        if (s && s.labels.length === 2) applyLabelMode('2');
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [labelSwap]);

    const selectedShape = shapes.find(s => s.id === selectedShapeId) as RectangleDef | undefined;

    return (
        <div className="flex h-full flex-col bg-gray-50" onMouseMove={handleGlobalMouseMove} onMouseUp={handleGlobalMouseUp}>
            <header className="flex items-center justify-between px-6 py-3 bg-white border-b border-gray-200 shadow-sm z-10">
                <div className="flex items-center gap-3">
                    <div className="p-2 bg-pink-50 text-pink-600 rounded-lg"><BoxSelect className="w-5 h-5" /></div>
                    <h1 className="text-xl font-semibold text-gray-800">Rectangle Builder</h1>
                </div>
                <GraphToolbar 
                    previewScale={previewScale} setPreviewScale={setPreviewScale}
                    exportDpi={exportDpi} onDpiChange={setExportDpi}
                    cropMode={cropMode} setCropMode={setCropMode}
                    onResetView={handleResetView} onZoomOutCanvas={handleZoomOutCanvas} onAutoCrop={handleAutoCrop}
                    onExportPNG={handleExportPNG} onCopy={handleCopy} isCopied={isCopied} onExportSVG={handleExportSVG}
                    onUndo={undo} onRedo={redo} canUndo={canUndo} canRedo={canRedo}
                    onExportData={() => exportToFile('rectangle-builder-project.json')}
                    onImportData={importFromFile}
                    onDefaultSettings={handleDefaultSettings}
                />
            </header>

            <div className="flex flex-1 overflow-hidden">
                <aside className="w-96 bg-white border-r border-gray-200 flex flex-col h-full z-20">
                    <div className="flex-1 overflow-y-auto custom-scrollbar p-6 space-y-8">
                        
                        {selectedShape && (
                            <>
                                {/* Geometry Section */}
                                <div
                                    id="gui-geometry-section"
                                    className={`space-y-4 p-2 rounded-lg transition-all ${
                                        highlightedControlId === 'gui-geometry-section' ? 'ring-2 ring-pink-500 bg-pink-50/40' : ''
                                    }`}
                                >
                                    <div className="flex items-center gap-2 mb-2">
                                        <Maximize size={16} className="text-pink-600"/>
                                        <h3 className="text-sm font-bold text-gray-800 uppercase tracking-wide">Geometry</h3>
                                    </div>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <label className="block text-xs font-semibold text-gray-500 mb-1">Width</label>
                                            <input 
                                                type="number" className="w-full border border-gray-300 rounded p-2 text-sm"
                                                value={selectedShape.width}
                                                onChange={(e) => updateSelected({ width: parseFloat(e.target.value) })}
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-xs font-semibold text-gray-500 mb-1">Height</label>
                                            <input 
                                                type="number" className="w-full border border-gray-300 rounded p-2 text-sm"
                                                value={selectedShape.height}
                                                onChange={(e) => updateSelected({ height: parseFloat(e.target.value) })}
                                            />
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-3">
                                        <RotateCw size={16} className="text-gray-400"/>
                                        <input 
                                            type="range" min="0" max="360" step="5"
                                            value={selectedShape.rotation}
                                            onChange={(e) => updateSelected({ rotation: parseFloat(e.target.value) })}
                                            className="flex-1 h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-pink-600"
                                        />
                                        <span className="text-xs font-mono text-gray-600 w-8">{selectedShape.rotation}°</span>
                                    </div>
                                </div>

                                <div className="h-px bg-gray-100"></div>

                                {/* Measurements Section */}
                                <div className="space-y-4">
                                    <div className="flex items-center gap-2 mb-2">
                                        <MoveHorizontal size={16} className="text-pink-600"/>
                                        <h3 className="text-sm font-bold text-gray-800 uppercase tracking-wide">Measurements</h3>
                                    </div>
                                    
                                    {/* Settings */}
                                    <div className="bg-gray-50 p-3 rounded-lg border border-gray-100 space-y-3">
                                        <div className="space-y-1">
                                            <label className="block text-xs font-semibold text-gray-500 mb-1">Font Size (pt)</label>
                                            <input 
                                                type="number" 
                                                value={fontSize} 
                                                onChange={(e) => setFontSize(parseFloat(e.target.value) || 11)}
                                                className="w-full bg-white border border-gray-200 rounded p-1.5 text-xs focus:ring-1 focus:ring-pink-500 focus:border-pink-500 outline-none"
                                            />
                                        </div>
                                    </div>

                                    {/* Dimensions Toggle */}
                                    <div
                                        id="gui-dimensions-section"
                                        className={`bg-gray-50 p-3 rounded-lg border space-y-3 transition-all ${
                                            highlightedControlId === 'gui-dimensions-section' ? 'ring-2 ring-pink-500 border-pink-400 bg-pink-50/40' : 'border-gray-100'
                                        }`}
                                    >
                                        <span className="text-xs font-bold text-gray-500 uppercase">Dimensions (Arrows)</span>
                                        <div className="flex bg-white rounded border border-gray-200 p-1">
                                            <button 
                                                onClick={() => { forceSnapshot(); updateSelected({ showDimensions: false }); }}
                                                className={`flex-1 py-1.5 text-xs font-medium rounded ${!selectedShape.showDimensions ? 'bg-gray-100 text-gray-800' : 'text-gray-500 hover:bg-gray-50'}`}
                                            >
                                                None
                                            </button>
                                            <button 
                                                onClick={() => { forceSnapshot(); updateSelected({ showDimensions: true, dimensionPlacement: 'inside' }); }}
                                                className={`flex-1 py-1.5 text-xs font-medium rounded ${selectedShape.showDimensions && selectedShape.dimensionPlacement === 'inside' ? 'bg-pink-100 text-pink-700' : 'text-gray-500 hover:bg-gray-50'}`}
                                            >
                                                Inside
                                            </button>
                                            <button 
                                                onClick={() => { forceSnapshot(); updateSelected({ showDimensions: true, dimensionPlacement: 'outside' }); }}
                                                className={`flex-1 py-1.5 text-xs font-medium rounded ${selectedShape.showDimensions && selectedShape.dimensionPlacement === 'outside' ? 'bg-pink-100 text-pink-700' : 'text-gray-500 hover:bg-gray-50'}`}
                                            >
                                                Outside
                                            </button>
                                        </div>
                                    </div>

                                    {/* Labels Toggle */}
                                    <div
                                        id="gui-labels-section"
                                        className={`bg-gray-50 p-3 rounded-lg border space-y-3 transition-all ${
                                            highlightedControlId === 'gui-labels-section' ? 'ring-2 ring-pink-500 border-pink-400 bg-pink-50/40' : 'border-gray-100'
                                        }`}
                                    >
                                        <div className="flex justify-between items-center">
                                            <span className="text-xs font-bold text-gray-500 uppercase">Variable Labels</span>
                                            {selectedShape.labels.length === 2 && (
                                                <button onClick={() => { forceSnapshot(); setLabelSwap(!labelSwap); }} className="text-[10px] flex items-center gap-1 text-blue-600 hover:text-blue-800 bg-white px-2 py-0.5 rounded border border-blue-100">
                                                    <RefreshCcw size={10}/> Swap Position
                                                </button>
                                            )}
                                        </div>
                                        <div className="flex bg-white rounded border border-gray-200 p-1">
                                            <button 
                                                onClick={() => applyLabelMode('none')}
                                                className={`flex-1 py-1.5 text-xs font-medium rounded ${selectedShape.labels.length === 0 ? 'bg-gray-100 text-gray-800' : 'text-gray-500 hover:bg-gray-50'}`}
                                            >
                                                None
                                            </button>
                                            <button 
                                                onClick={() => applyLabelMode('2')}
                                                className={`flex-1 py-1.5 text-xs font-medium rounded ${selectedShape.labels.length === 2 ? 'bg-pink-100 text-pink-700' : 'text-gray-500 hover:bg-gray-50'}`}
                                            >
                                                2 Sides
                                            </button>
                                            <button 
                                                onClick={() => applyLabelMode('4')}
                                                className={`flex-1 py-1.5 text-xs font-medium rounded ${selectedShape.labels.length === 4 ? 'bg-pink-100 text-pink-700' : 'text-gray-500 hover:bg-gray-50'}`}
                                            >
                                                4 Sides
                                            </button>
                                        </div>

                                        {/* Label Editors */}
                                        {selectedShape.labels.length > 0 && (
                                            <div className="space-y-2 mt-2 pt-2 border-t border-gray-200">
                                                {selectedShape.labels.map((lbl, idx) => (
                                                    <div 
                                                        key={lbl.id} 
                                                        id={`gui-label-${lbl.id}`}
                                                        className={`flex items-center gap-2 p-1 rounded transition-all ${
                                                            selectedLabelId === lbl.id || highlightedControlId === `gui-label-${lbl.id}`
                                                                ? 'bg-blue-50 ring-1 ring-blue-300'
                                                                : ''
                                                        }`}
                                                        onClick={() => setSelectedLabelId(lbl.id)}
                                                    >
                                                        <span className="text-[10px] font-mono text-gray-400 w-4 text-center">{idx+1}</span>
                                                        <input
                                                            ref={(el) => { labelInputRefs.current[lbl.id] = el; }}
                                                            type="text"
                                                            value={lbl.text}
                                                            onChange={(e) => updateLabel(lbl.id, { text: e.target.value })}
                                                            className="flex-1 border border-gray-300 rounded px-1 py-0.5 text-xs focus:ring-blue-500 focus:border-blue-500 outline-none"
                                                        />
                                                        <Type size={12} className="text-gray-400"/>
                                                    </div>
                                                ))}
                                                <p className="text-[10px] text-gray-400 italic text-center mt-1">
                                                    Click label on canvas to select &amp; drag
                                                </p>
                                            </div>
                                        )}
                                    </div>
                                </div>

                                <div className="h-px bg-gray-100"></div>

                                {/* Geometry Marks */}
                                <div className="space-y-4">
                                    <div className="flex items-center gap-2 mb-2">
                                        <Hash size={16} className="text-pink-600"/>
                                        <h3 className="text-sm font-bold text-gray-800 uppercase tracking-wide">Decorations</h3>
                                    </div>
                                    
                                    <div className="grid grid-cols-2 gap-3">
                                        <div
                                            id="gui-ticks-section"
                                            className={`p-3 rounded-lg border cursor-pointer transition-all ${
                                                highlightedControlId === 'gui-ticks-section'
                                                    ? 'ring-2 ring-pink-500 bg-pink-50'
                                                    : selectedShape.edgeDecorations.length > 0
                                                    ? 'bg-pink-50 border-pink-200'
                                                    : 'bg-white border-gray-200 hover:border-pink-300'
                                            }`}
                                        >
                                            <div className="flex justify-between items-start mb-2">
                                                <label className="flex items-center gap-2 cursor-pointer">
                                                    <input 
                                                        type="checkbox" 
                                                        checked={selectedShape.edgeDecorations.length > 0} 
                                                        onChange={(e) => { forceSnapshot(); applyTickMode(e.target.checked); }}
                                                        className="rounded text-pink-600 focus:ring-pink-500"
                                                    />
                                                    <span className="text-xs font-bold text-gray-700">Equal Ticks</span>
                                                </label>
                                            </div>
                                            {selectedShape.edgeDecorations.length > 0 && (
                                                <button 
                                                    onClick={() => { forceSnapshot(); setTickSwap(!tickSwap); }}
                                                    className="w-full text-[10px] py-1 bg-white border border-gray-200 rounded text-gray-600 hover:text-pink-600 flex items-center justify-center gap-1"
                                                >
                                                    <ArrowLeftRight size={10} /> Swap Style
                                                </button>
                                            )}
                                        </div>

                                        <div
                                            id="gui-right-angles-section"
                                            className={`p-3 rounded-lg border cursor-pointer transition-all ${
                                                highlightedControlId === 'gui-right-angles-section'
                                                    ? 'ring-2 ring-pink-500 bg-pink-50'
                                                    : selectedShape.vertexDecorations.length > 0
                                                    ? 'bg-pink-50 border-pink-200'
                                                    : 'bg-white border-gray-200 hover:border-pink-300'
                                            }`}
                                        >
                                            <label className="flex items-center gap-2 cursor-pointer h-full">
                                                <input 
                                                    type="checkbox" 
                                                    checked={selectedShape.vertexDecorations.length > 0}
                                                    onChange={(e) => {
                                                        forceSnapshot();
                                                        updateSelected({ vertexDecorations: e.target.checked ? [0,1,2,3].map(i => ({ vertexIndex: i, type: 'right' })) : [] });
                                                    }}
                                                    className="rounded text-pink-600 focus:ring-pink-500"
                                                />
                                                <div className="flex flex-col">
                                                    <span className="text-xs font-bold text-gray-700">Right Angles</span>
                                                    <span className="text-[10px] text-gray-400">Show corners</span>
                                                </div>
                                            </label>
                                        </div>
                                    </div>

                                    {/* Shading Control */}
                                    <div
                                        id="gui-shading-section"
                                        className={`p-3 rounded-lg border transition-all ${
                                            highlightedControlId === 'gui-shading-section'
                                                ? 'ring-2 ring-pink-500 bg-pink-50'
                                                : selectedShape.fill !== 'transparent'
                                                ? 'bg-pink-50 border-pink-200'
                                                : 'bg-white border-gray-200 hover:border-pink-300'
                                        }`}
                                    >
                                        <div className="flex items-center justify-between mb-2">
                                            <div className="flex items-center gap-2">
                                                <div className={`p-1.5 rounded-md ${selectedShape.fill !== 'transparent' ? 'bg-pink-200 text-pink-700' : 'bg-gray-100 text-gray-400'}`}>
                                                    <PaintBucket size={14} />
                                                </div>
                                                <span className="text-xs font-bold text-gray-700">Shade Interior</span>
                                            </div>
                                            <label className="flex items-center gap-2 cursor-pointer">
                                                <span className="text-[10px] text-gray-400 uppercase">{selectedShape.fill !== 'transparent' ? 'On' : 'Off'}</span>
                                                <input 
                                                    type="checkbox" 
                                                    checked={selectedShape.fill !== 'transparent'}
                                                    onChange={(e) => {
                                                        forceSnapshot();
                                                        updateSelected({ fill: e.target.checked ? '#e5e7eb' : 'transparent' });
                                                    }}
                                                    className="rounded text-pink-600 focus:ring-pink-500"
                                                />
                                            </label>
                                        </div>
                                        
                                        {selectedShape.fill !== 'transparent' && (
                                            <div className="flex items-center gap-2 bg-white rounded border border-pink-200 p-1">
                                                <input 
                                                    type="color" 
                                                    value={selectedShape.fill}
                                                    onChange={(e) => updateSelected({ fill: e.target.value })}
                                                    className="w-8 h-8 p-0 border-0 rounded cursor-pointer"
                                                />
                                                <span className="text-xs font-mono text-gray-500 uppercase">{selectedShape.fill}</span>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </>
                        )}
                    </div>
                </aside>

                <main className="flex-1 bg-gray-100 overflow-hidden flex flex-col">
                    <div ref={containerRef} className="flex-1 overflow-auto flex items-center justify-center p-8 bg-neutral-100 cursor-crosshair">
                        <div 
                            className={`bg-white shadow-2xl transition-all duration-200 ease-in-out relative ${cropMode ? 'cursor-crosshair' : 'cursor-default'}`}
                            style={{ 
                                transform: `scale(${previewScale})`, 
                                transformOrigin: 'top center',
                                opacity: hasInitialCrop ? 1 : 0
                            }}
                            onMouseDown={handleCropMouseDown}
                        >
                            <svg 
                                id="shape-svg" 
                                width={widthPixels} 
                                height={heightPixels} 
                                viewBox={customViewBox || `0 0 ${widthPixels} ${heightPixels}`} 
                                xmlns="http://www.w3.org/2000/svg" 
                                style={{ display: 'block' }}
                            >
                                <rect 
                                    x="0" y="0" width={widthPixels} height={heightPixels} 
                                    fill="white" 
                                    onClick={handleCanvasClick} 
                                />
                                
                                <g className="data-layer">
                                    {shapes.map(shape => (
                                        <g key={shape.id}>
                                            {renderShape(
                                                shape, 
                                                selectedShapeId === shape.id,
                                                (e) => handleShapeDragStart(shape.id, e),
                                                (lblId, e) => handleLabelDragStart(shape.id, lblId, e),
                                                (handleId, e) => handleResizeHandleDrag(shape.id, handleId, e),
                                                {
                                                    onShapeContextMenu: (e) => {
                                                        e.preventDefault();
                                                        e.stopPropagation();
                                                        setSelectedShapeId(shape.id);
                                                        setContextMenu({
                                                            x: e.clientX,
                                                            y: e.clientY,
                                                            title: 'Rectangle Shape',
                                                            items: [
                                                                {
                                                                    label: 'Edit Width, Height & Rotation in Sidebar...',
                                                                    icon: <Edit3 size={13} />,
                                                                    primary: true,
                                                                    onClick: () => navigateToGuiControl('gui-geometry-section', 'input[type="number"]')
                                                                },
                                                                {
                                                                    label: shape.fill === 'transparent' ? 'Shade Interior' : 'Remove Interior Shading',
                                                                    icon: <PaintBucket size={13} />,
                                                                    onClick: () => {
                                                                        forceSnapshot();
                                                                        setShapes(prev => prev.map(s => s.id === shape.id ? { ...s, fill: s.fill === 'transparent' ? '#e5e7eb' : 'transparent' } : s));
                                                                    }
                                                                },
                                                                {
                                                                    label: shape.edgeDecorations.length > 0 ? 'Hide Equal Ticks' : 'Show Equal Ticks',
                                                                    icon: <Hash size={13} />,
                                                                    onClick: () => {
                                                                        forceSnapshot();
                                                                        applyTickMode(shape.edgeDecorations.length === 0);
                                                                    }
                                                                },
                                                                {
                                                                    label: shape.vertexDecorations.length > 0 ? 'Hide Right Angles' : 'Show Right Angles',
                                                                    icon: <Maximize size={13} />,
                                                                    onClick: () => {
                                                                        forceSnapshot();
                                                                        setShapes(prev => prev.map(s => s.id === shape.id ? { ...s, vertexDecorations: s.vertexDecorations.length > 0 ? [] : [0,1,2,3].map(i => ({ vertexIndex: i, type: 'right' })) } : s));
                                                                    }
                                                                }
                                                            ]
                                                        });
                                                    },
                                                    onLabelContextMenu: (lblId, e) => {
                                                        e.preventDefault();
                                                        e.stopPropagation();
                                                        setSelectedShapeId(shape.id);
                                                        setSelectedLabelId(lblId);
                                                        const lbl = shape.labels.find(l => l.id === lblId);
                                                        const items: ContextMenuItem[] = [
                                                            {
                                                                label: `Edit Label "${lbl?.text || ''}" in Sidebar...`,
                                                                icon: <Edit3 size={13} />,
                                                                primary: true,
                                                                onClick: () => navigateToGuiControl(`gui-label-${lblId}`, 'input')
                                                            }
                                                        ];
                                                        if (shape.labels.length === 2) {
                                                            items.push({
                                                                label: 'Swap Label Positions (Top/Right ↔ Bottom/Left)',
                                                                icon: <RefreshCcw size={13} />,
                                                                onClick: () => {
                                                                    forceSnapshot();
                                                                    setLabelSwap(!labelSwap);
                                                                }
                                                            });
                                                        }
                                                        if (lbl && (lbl.offsetX !== 0 || lbl.offsetY !== 0)) {
                                                            items.push({
                                                                label: 'Reset Label Offset',
                                                                icon: <RotateCcw size={13} />,
                                                                onClick: () => {
                                                                    forceSnapshot();
                                                                    updateLabel(lblId, { offsetX: 0, offsetY: 0 });
                                                                }
                                                            });
                                                        }
                                                        items.push({
                                                            label: 'Remove All Variable Labels',
                                                            icon: <Trash2 size={13} />,
                                                            danger: true,
                                                            onClick: () => applyLabelMode('none')
                                                        });
                                                        setContextMenu({
                                                            x: e.clientX,
                                                            y: e.clientY,
                                                            title: `Side Label (${lbl?.text || ''})`,
                                                            items
                                                        });
                                                    },
                                                    onDimensionContextMenu: (e) => {
                                                        e.preventDefault();
                                                        e.stopPropagation();
                                                        setSelectedShapeId(shape.id);
                                                        const rectShape = shape as RectangleDef;
                                                        setContextMenu({
                                                            x: e.clientX,
                                                            y: e.clientY,
                                                            title: 'Dimension Arrows',
                                                            items: [
                                                                {
                                                                    label: 'Edit Dimensions Placement in Sidebar...',
                                                                    icon: <Edit3 size={13} />,
                                                                    primary: true,
                                                                    onClick: () => navigateToGuiControl('gui-dimensions-section')
                                                                },
                                                                {
                                                                    label: rectShape.dimensionPlacement === 'inside' ? 'Move Dimensions Outside' : 'Move Dimensions Inside',
                                                                    icon: <ArrowLeftRight size={13} />,
                                                                    onClick: () => {
                                                                        forceSnapshot();
                                                                        updateSelected({ dimensionPlacement: rectShape.dimensionPlacement === 'inside' ? 'outside' : 'inside' });
                                                                    }
                                                                },
                                                                {
                                                                    label: 'Hide Dimension Arrows',
                                                                    icon: <EyeOff size={13} />,
                                                                    danger: true,
                                                                    onClick: () => {
                                                                        forceSnapshot();
                                                                        updateSelected({ showDimensions: false });
                                                                    }
                                                                }
                                                            ]
                                                        });
                                                    },
                                                    onEdgeDecorationContextMenu: (e) => {
                                                        e.preventDefault();
                                                        e.stopPropagation();
                                                        setSelectedShapeId(shape.id);
                                                        setContextMenu({
                                                            x: e.clientX,
                                                            y: e.clientY,
                                                            title: 'Equal Ticks Decoration',
                                                            items: [
                                                                {
                                                                    label: 'Edit Equal Ticks in Sidebar...',
                                                                    icon: <Edit3 size={13} />,
                                                                    primary: true,
                                                                    onClick: () => navigateToGuiControl('gui-ticks-section')
                                                                },
                                                                {
                                                                    label: 'Swap Single / Double Tick Sides',
                                                                    icon: <ArrowLeftRight size={13} />,
                                                                    onClick: () => {
                                                                        forceSnapshot();
                                                                        setTickSwap(!tickSwap);
                                                                    }
                                                                },
                                                                {
                                                                    label: 'Remove Equal Ticks',
                                                                    icon: <Trash2 size={13} />,
                                                                    danger: true,
                                                                    onClick: () => {
                                                                        forceSnapshot();
                                                                        applyTickMode(false);
                                                                    }
                                                                }
                                                            ]
                                                        });
                                                    },
                                                    onVertexDecorationContextMenu: (e) => {
                                                        e.preventDefault();
                                                        e.stopPropagation();
                                                        setSelectedShapeId(shape.id);
                                                        setContextMenu({
                                                            x: e.clientX,
                                                            y: e.clientY,
                                                            title: 'Right Angle Marks',
                                                            items: [
                                                                {
                                                                    label: 'Edit Right Angles in Sidebar...',
                                                                    icon: <Edit3 size={13} />,
                                                                    primary: true,
                                                                    onClick: () => navigateToGuiControl('gui-right-angles-section')
                                                                },
                                                                {
                                                                    label: 'Remove Right Angle Marks',
                                                                    icon: <Trash2 size={13} />,
                                                                    danger: true,
                                                                    onClick: () => {
                                                                        forceSnapshot();
                                                                        updateSelected({ vertexDecorations: [] });
                                                                    }
                                                                }
                                                            ]
                                                        });
                                                    }
                                                }
                                            )}
                                        </g>
                                    ))}
                                </g>

                                {cropMode && selectionBox && (
                                    <rect 
                                        x={selectionBox.x} y={selectionBox.y} 
                                        width={selectionBox.w} height={selectionBox.h}
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
                    {cropMode && (
                        <div className="absolute top-4 left-1/2 -translate-x-1/2 bg-pink-600 text-white px-4 py-2 rounded-full shadow-lg text-sm font-bold animate-pulse pointer-events-none">
                            Drag to Crop Graph
                        </div>
                    )}
                </main>
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

export default ShapeBuilder;

