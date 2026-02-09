import React, { useState, useMemo, useEffect, useRef } from 'react';
import { GraphToolbar } from '../components/GraphToolbar';
import { useGraphInteraction } from '../hooks/useGraphInteraction';
import { useDragSystem } from '../hooks/useDragSystem';
import { renderShape } from '../utils/shape/renderer';
import { ShapeDef, RectangleDef, EdgeDecoration, ShapeLabel } from '../utils/shape/types';
import { CM_TO_PX } from '../constants';
import { RotateCw, BoxSelect, Maximize, ArrowLeftRight, PaintBucket, MoveHorizontal, Hash, Type, MousePointer2, RefreshCcw } from 'lucide-react';
import { RichInput } from '../components/ui/RichInput';

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

const ShapeBuilder: React.FC = () => {
    // --- STATE ---
    const [shapes, setShapes] = useState<ShapeDef[]>(INITIAL_SHAPES);
    const [selectedShapeId, setSelectedShapeId] = useState<string | null>(INITIAL_SHAPES[0].id);
    const [selectedLabelId, setSelectedLabelId] = useState<string | null>(null);
    const [dimCm, setDimCm] = useState({ width: 20, height: 15 });
    
    // UI Helpers
    const [labelSwap, setLabelSwap] = useState(false); // False = Top/Right, True = Bottom/Left
    const [tickSwap, setTickSwap] = useState(false); // False = Single Horizontal, True = Single Vertical

    const widthPixels = Math.round(dimCm.width * CM_TO_PX);
    const heightPixels = Math.round(dimCm.height * CM_TO_PX);

    // Refs for auto-focus
    const labelInputRefs = useRef<Record<string, HTMLInputElement | null>>({});

    // --- INTERACTION HOOKS ---
    const {
        previewScale, setPreviewScale,
        cropMode, setCropMode,
        selectionBox, customViewBox, hasInitialCrop,
        containerRef,
        handleAutoCrop, handleResetView, handleExportPNG, handleExportSVG,
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
        setSelectedLabelId(null); // Deselect label when clicking shape body
        const shape = shapes.find(s => s.id === id);
        if (!shape) return;
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
        e.stopPropagation(); // Critical to prevent deselection
        
        setSelectedShapeId(shapeId);
        setSelectedLabelId(labelId);

        const shape = shapes.find(s => s.id === shapeId);
        const label = shape?.labels.find(l => l.id === labelId);
        if (!shape || !label) return;

        // --- 1. Identify Context (Are we dragging an edge label?) ---
        const isEdgeLabel = label.type === 'edge' && label.index !== undefined;
        
        // Capture initial offsets of ALL labels to allow group movement
        const initialOffsets: Record<string, {x: number, y: number}> = {};
        shape.labels.forEach(l => {
            initialOffsets[l.id] = { x: l.offsetX, y: l.offsetY };
        });

        // Determine Geometry for Locking
        let dragNormal = { x: 0, y: 0 };
        
        if (isEdgeLabel && shape.type === 'rectangle') {
            // Rectangle Edge Normals (Unrotated): 0=Top(0,-1), 1=Right(1,0), 2=Bottom(0,1), 3=Left(-1,0)
            const baseNormals = [{x:0, y:-1}, {x:1, y:0}, {x:0, y:1}, {x:-1, y:0}];
            const baseN = baseNormals[label.index || 0];
            
            // Rotate normal by shape rotation
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

                // --- 2. Calculate New Positions ---
                const newLabels = s.labels.map(l => {
                    const initOff = init.initialOffsets[l.id];
                    if (!initOff) return l;

                    // Logic:
                    // If we are dragging an edge label, we want "Locked Perpendicular" movement.
                    // AND we want all other edge labels to move by the same *distance* away/towards the shape.
                    
                    if (isEdgeLabel && dragNormal.x !== 0 || dragNormal.y !== 0) {
                        // A. Calculate projection of mouse delta onto the dragged label's normal
                        // This gives us the scalar "distance change"
                        const distChange = svgDx * dragNormal.x + svgDy * dragNormal.y;

                        // B. Apply this distance change to ALL edge labels based on THEIR normals
                        if (l.type === 'edge' && l.index !== undefined) {
                            // Re-calculate normal for *this* label
                            const baseNormals = [{x:0, y:-1}, {x:1, y:0}, {x:0, y:1}, {x:-1, y:0}];
                            const ln = baseNormals[l.index];
                            const rad = s.rotation * (Math.PI / 180);
                            const currentNormal = {
                                x: ln.x * Math.cos(rad) - ln.y * Math.sin(rad),
                                y: ln.x * Math.sin(rad) + ln.y * Math.cos(rad)
                            };

                            // Update position: Old Pos + (DistChange * MyNormal)
                            return {
                                ...l,
                                offsetX: initOff.x + (distChange * currentNormal.x),
                                offsetY: initOff.y + (distChange * currentNormal.y)
                            };
                        }
                    } 
                    
                    // Fallback / Non-Edge Labels: Just move the one we are dragging freely
                    if (l.id === labelId && !isEdgeLabel) {
                        return {
                            ...l,
                            offsetX: initOff.x + svgDx,
                            offsetY: initOff.y + svgDy
                        };
                    }

                    return l; // Return others unchanged if not grouped
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
    
    // Helper to generate labels based on mode
    const applyLabelMode = (mode: 'none' | '2' | '4') => {
        if (!selectedShapeId) return;
        
        // Preserve existing offsets if possible, or reset?
        // Let's reset to keep it clean, or users can drag again.
        
        let newLabels: ShapeLabel[] = [];
        const common = { type: 'edge' as const, offsetX: 0, offsetY: 0, color: 'black', fontSize: 16 };

        if (mode === '2') {
            // Edges 0 (Top) and 1 (Right) by default. Swap makes it 2 (Bottom) and 3 (Left)
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
        setSelectedLabelId(null); // Reset selection
    };

    // Helper to apply ticks based on swap state
    const applyTickMode = (active: boolean) => {
        if (!selectedShapeId) return;
        if (!active) {
            updateSelected({ edgeDecorations: [] });
            return;
        }

        // Standard: Horizontal = Single, Vertical = Double
        // Edges: 0=Top, 1=Right, 2=Bottom, 3=Left
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

    // Effects to re-apply logic when swap states change
    useEffect(() => {
        const s = shapes.find(sh => sh.id === selectedShapeId);
        if (s && s.edgeDecorations.length > 0) applyTickMode(true);
    }, [tickSwap]); // Re-run when tickSwap changes

    useEffect(() => {
        const s = shapes.find(sh => sh.id === selectedShapeId);
        if (s && s.labels.length === 2) applyLabelMode('2');
    }, [labelSwap]); // Re-run when labelSwap changes

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
                    cropMode={cropMode} setCropMode={setCropMode}
                    onResetView={handleResetView} onAutoCrop={handleAutoCrop}
                    onExportPNG={handleExportPNG} onExportSVG={handleExportSVG}
                    onCopy={() => {}} 
                />
            </header>

            <div className="flex flex-1 overflow-hidden">
                <aside className="w-96 bg-white border-r border-gray-200 flex flex-col h-full z-20">
                    <div className="flex-1 overflow-y-auto custom-scrollbar p-6 space-y-8">
                        
                        {selectedShape && (
                            <>
                                {/* Geometry Section */}
                                <div className="space-y-4">
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
                                    
                                    {/* Dimensions Toggle */}
                                    <div className="bg-gray-50 p-3 rounded-lg border border-gray-100 space-y-3">
                                        <span className="text-xs font-bold text-gray-500 uppercase">Dimensions (Arrows)</span>
                                        <div className="flex bg-white rounded border border-gray-200 p-1">
                                            <button 
                                                onClick={() => updateSelected({ showDimensions: false })}
                                                className={`flex-1 py-1.5 text-xs font-medium rounded ${!selectedShape.showDimensions ? 'bg-gray-100 text-gray-800' : 'text-gray-500 hover:bg-gray-50'}`}
                                            >
                                                None
                                            </button>
                                            <button 
                                                onClick={() => updateSelected({ showDimensions: true, dimensionPlacement: 'inside' })}
                                                className={`flex-1 py-1.5 text-xs font-medium rounded ${selectedShape.showDimensions && selectedShape.dimensionPlacement === 'inside' ? 'bg-pink-100 text-pink-700' : 'text-gray-500 hover:bg-gray-50'}`}
                                            >
                                                Inside
                                            </button>
                                            <button 
                                                onClick={() => updateSelected({ showDimensions: true, dimensionPlacement: 'outside' })}
                                                className={`flex-1 py-1.5 text-xs font-medium rounded ${selectedShape.showDimensions && selectedShape.dimensionPlacement === 'outside' ? 'bg-pink-100 text-pink-700' : 'text-gray-500 hover:bg-gray-50'}`}
                                            >
                                                Outside
                                            </button>
                                        </div>
                                    </div>

                                    {/* Labels Toggle */}
                                    <div className="bg-gray-50 p-3 rounded-lg border border-gray-100 space-y-3">
                                        <div className="flex justify-between items-center">
                                            <span className="text-xs font-bold text-gray-500 uppercase">Variable Labels</span>
                                            {selectedShape.labels.length === 2 && (
                                                <button onClick={() => setLabelSwap(!labelSwap)} className="text-[10px] flex items-center gap-1 text-blue-600 hover:text-blue-800 bg-white px-2 py-0.5 rounded border border-blue-100">
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
                                                        className={`flex items-center gap-2 p-1 rounded ${selectedLabelId === lbl.id ? 'bg-blue-50 ring-1 ring-blue-300' : ''}`}
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
                                                    Click label on canvas to select & drag
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
                                        <div className={`p-3 rounded-lg border cursor-pointer transition-colors ${selectedShape.edgeDecorations.length > 0 ? 'bg-pink-50 border-pink-200' : 'bg-white border-gray-200 hover:border-pink-300'}`}>
                                            <div className="flex justify-between items-start mb-2">
                                                <label className="flex items-center gap-2 cursor-pointer">
                                                    <input 
                                                        type="checkbox" 
                                                        checked={selectedShape.edgeDecorations.length > 0} 
                                                        onChange={(e) => applyTickMode(e.target.checked)}
                                                        className="rounded text-pink-600 focus:ring-pink-500"
                                                    />
                                                    <span className="text-xs font-bold text-gray-700">Equal Ticks</span>
                                                </label>
                                            </div>
                                            {selectedShape.edgeDecorations.length > 0 && (
                                                <button 
                                                    onClick={() => setTickSwap(!tickSwap)}
                                                    className="w-full text-[10px] py-1 bg-white border border-gray-200 rounded text-gray-600 hover:text-pink-600 flex items-center justify-center gap-1"
                                                >
                                                    <ArrowLeftRight size={10} /> Swap Style
                                                </button>
                                            )}
                                        </div>

                                        <div className={`p-3 rounded-lg border cursor-pointer transition-colors ${selectedShape.vertexDecorations.length > 0 ? 'bg-pink-50 border-pink-200' : 'bg-white border-gray-200 hover:border-pink-300'}`}>
                                            <label className="flex items-center gap-2 cursor-pointer h-full">
                                                <input 
                                                    type="checkbox" 
                                                    checked={selectedShape.vertexDecorations.length > 0}
                                                    onChange={(e) => updateSelected({ vertexDecorations: e.target.checked ? [0,1,2,3].map(i => ({ vertexIndex: i, type: 'right' })) : [] })}
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
                                    <div className={`p-3 rounded-lg border transition-colors ${selectedShape.fill !== 'transparent' ? 'bg-pink-50 border-pink-200' : 'bg-white border-gray-200 hover:border-pink-300'}`}>
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
                                                    onChange={(e) => updateSelected({ fill: e.target.checked ? '#e5e7eb' : 'transparent' })}
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
                                                (handleId, e) => handleResizeHandleDrag(shape.id, handleId, e)
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
        </div>
    );
};

export default ShapeBuilder;
