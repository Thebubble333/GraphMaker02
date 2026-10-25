import React, { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import { GraphToolbar } from '../components/GraphToolbar';
import { GraphContextMenu, ContextMenuItem } from '../components/GraphContextMenu';
import { useGraphInteraction } from '../hooks/useGraphInteraction';
import { useDragSystem } from '../hooks/useDragSystem';
import { useHistory } from '../hooks/useHistory';
import {
    renderShape,
    computePolyGeometry,
    getShapeStraightEdges,
    resolveStraightEdgeForLabel
} from '../utils/shape/renderer';
import {
    ShapeDef,
    ShapeType,
    ShapeCategory,
    DecorationType,
    AngleType,
    ShapeLabel,
    SubElementSelection,
    RearCurveMode,
    TriangleDef,
    PrismDef
} from '../utils/shape/types';
import {
    SHAPE_CATALOG,
    SHAPE_PRESETS,
    ESSENTIAL_2D_GROUPS,
    Essential2DGroup,
    getEssential2DPresetsByGroup,
    ShapePreset,
    createDefaultShape,
    getPresetsForShapeType,
    SHAPE_BUILDER_CHECKLIST
} from '../utils/shape/presets';
import { snapValue, snapAngle, radToDeg, getPositiveAngleSpan } from '../utils/shape/math';
import { CM_TO_PX } from '../constants';
import {
    Shapes,
    RotateCw,
    Maximize,
    PaintBucket,
    Hash,
    Type,
    Plus,
    Trash2,
    RotateCcw,
    Eye,
    EyeOff,
    CheckSquare,
    Square,
    Layers,
    Compass,
    Box,
    Sliders,
    Copy,
    Sparkles,
    X,
    Play
} from 'lucide-react';
import { ptToSvgUnits } from '../utils/imageExport';

interface ShapeBuilderState {
    shapes: ShapeDef[];
    dimCm: { width: number; height: number };
    fontSize: number;
    snapToGrid: boolean;
    checkedItems: string[];
}

const INITIAL_SHAPE = createDefaultShape('triangle', 283, 283, 11);

const DEFAULT_SHAPE_BUILDER_STATE: ShapeBuilderState = {
    shapes: [INITIAL_SHAPE],
    dimCm: { width: 15, height: 15 },
    fontSize: 11,
    snapToGrid: true,
    checkedItems: SHAPE_BUILDER_CHECKLIST.map(item => item.id)
};

const EDGE_DEC_CYCLE: DecorationType[] = [
    'none',
    'tick',
    'double-tick',
    'triple-tick',
    'arrow',
    'double-arrow'
];

const VERTEX_DEC_CYCLE: AngleType[] = [
    'none',
    'arc',
    'double-arc',
    'triple-arc',
    'right',
    'label'
];

const ShapeBuilder: React.FC = () => {
    // --- STATE ---
    const [shapes, setShapes] = useState<ShapeDef[]>(DEFAULT_SHAPE_BUILDER_STATE.shapes);
    const [selectedShapeId, setSelectedShapeId] = useState<string | null>(INITIAL_SHAPE.id);
    const [selectedLabelId, setSelectedLabelId] = useState<string | null>(null);
    const [subSelection, setSubSelection] = useState<SubElementSelection | null>(null);

    const [activeCategory, setActiveCategory] = useState<'essential-20' | ShapeCategory>('essential-20');
    const [activeEssentialGroup, setActiveEssentialGroup] = useState<Essential2DGroup>(
        'The Foundation: Triangles'
    );
    const [replaceOnSelect, setReplaceOnSelect] = useState<boolean>(true);
    const [showHandles, setShowHandles] = useState<boolean>(true);
    const [dimCm, setDimCm] = useState(DEFAULT_SHAPE_BUILDER_STATE.dimCm);
    const [fontSize, setFontSize] = useState(DEFAULT_SHAPE_BUILDER_STATE.fontSize);
    const [snapToGrid, setSnapToGrid] = useState(DEFAULT_SHAPE_BUILDER_STATE.snapToGrid);

    // Checklist Drawer State
    const [showChecklist, setShowChecklist] = useState<boolean>(false);
    const [checkedItems, setCheckedItems] = useState<string[]>(
        DEFAULT_SHAPE_BUILDER_STATE.checkedItems
    );

    // Global Keyboard Modifiers State
    const [modifiers, setModifiers] = useState({
        shift: false,
        alt: false,
        ctrl: false
    });

    const [contextMenu, setContextMenu] = useState<{
        x: number;
        y: number;
        title: string;
        items: ContextMenuItem[];
    } | null>(null);

    // Track modifiers globally for visual HUD & click handlers
    useEffect(() => {
        const updateMods = (e: KeyboardEvent) => {
            setModifiers({
                shift: e.shiftKey,
                alt: e.altKey,
                ctrl: e.ctrlKey || e.metaKey
            });
        };
        const resetMods = () => setModifiers({ shift: false, alt: false, ctrl: false });
        window.addEventListener('keydown', updateMods);
        window.addEventListener('keyup', updateMods);
        window.addEventListener('blur', resetMods);
        return () => {
            window.removeEventListener('keydown', updateMods);
            window.removeEventListener('keyup', updateMods);
            window.removeEventListener('blur', resetMods);
        };
    }, []);

    const currentState = useMemo<ShapeBuilderState>(
        () => ({
            shapes,
            dimCm,
            fontSize,
            snapToGrid,
            checkedItems
        }),
        [shapes, dimCm, fontSize, snapToGrid, checkedItems]
    );

    const applyRestoredState = useCallback((s: ShapeBuilderState) => {
        const nextShapes = s.shapes ?? DEFAULT_SHAPE_BUILDER_STATE.shapes;
        setShapes(nextShapes);
        setDimCm(s.dimCm ?? DEFAULT_SHAPE_BUILDER_STATE.dimCm);
        setFontSize(s.fontSize ?? DEFAULT_SHAPE_BUILDER_STATE.fontSize);
        setSnapToGrid(s.snapToGrid ?? true);
        setCheckedItems(s.checkedItems ?? DEFAULT_SHAPE_BUILDER_STATE.checkedItems);
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
        appId: 'ShapeBuilderV2',
        version: 4,
        currentState,
        onRestore: applyRestoredState
    });

    const handleDefaultSettings = () => {
        forceSnapshot();
        applyRestoredState(DEFAULT_SHAPE_BUILDER_STATE);
    };

    const widthPixels = Math.round(dimCm.width * CM_TO_PX);
    const heightPixels = Math.round(dimCm.height * CM_TO_PX);

    const labelInputRefs = useRef<Record<string, HTMLInputElement | null>>({});

    // --- INTERACTION HOOKS ---
    const {
        previewScale,
        setPreviewScale,
        exportDpi,
        setExportDpi,
        cropMode,
        setCropMode,
        selectionBox,
        customViewBox,
        hasInitialCrop,
        containerRef,
        handleAutoCrop,
        handleResetView,
        handleZoomOutCanvas,
        handleExportPNG,
        handleExportSVG: rawHandleExportSVG,
        handleCopy,
        isCopied,
        handleCropMouseDown,
        handleCropMouseMove,
        handleCropMouseUp
    } = useGraphInteraction('shape-svg', widthPixels, heightPixels, dimCm.width, false, true);

    // Strip any .shape-ui-overlay nodes temporarily during SVG export so handles/selection boxes never appear in exported SVGs
    const handleExportSVG = useCallback(() => {
        const svgEl = document.getElementById('shape-svg');
        if (!svgEl) {
            rawHandleExportSVG();
            return;
        }
        const overlays = Array.from(svgEl.querySelectorAll('.shape-ui-overlay'));
        const parents = overlays.map(el => ({ el, parent: el.parentNode, next: el.nextSibling }));
        parents.forEach(({ el, parent }) => parent?.removeChild(el));
        try {
            rawHandleExportSVG();
        } finally {
            parents.forEach(({ el, parent, next }) => {
                if (parent) parent.insertBefore(el, next);
            });
        }
    }, [rawHandleExportSVG]);

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
        if (selectedLabelId && labelInputRefs.current[selectedLabelId]) {
            labelInputRefs.current[selectedLabelId]?.focus();
        }
    }, [selectedLabelId]);

    const selectedShape = useMemo(
        () => shapes.find(s => s.id === selectedShapeId),
        [shapes, selectedShapeId]
    );

    const updateSelected = useCallback(
        (updates: Partial<ShapeDef>) => {
            if (!selectedShapeId) return;
            setShapes(prev =>
                prev.map(s => (s.id === selectedShapeId ? ({ ...s, ...updates } as ShapeDef) : s))
            );
        },
        [selectedShapeId]
    );

    const updateShapeById = useCallback((id: string, updater: (s: ShapeDef) => ShapeDef) => {
        setShapes(prev => prev.map(s => (s.id === id ? updater(s) : s)));
    }, []);

    // --- ADD / SWITCH SHAPE OR PRESET ---
    const handleSelectPreset = (preset: ShapePreset, forceReplace: boolean = false) => {
        forceSnapshot();
        if (preset.essentialGroup) {
            setActiveEssentialGroup(preset.essentialGroup);
        }
        const newShape = preset.create(widthPixels / 2, heightPixels / 2, fontSize);
        if (replaceOnSelect || forceReplace || shapes.length === 0) {
            setShapes([newShape]);
        } else {
            newShape.x += (shapes.length % 3) * 28;
            newShape.y += (shapes.length % 3) * 28;
            setShapes(prev => [...prev, newShape]);
        }
        setSelectedShapeId(newShape.id);
        setSelectedLabelId(null);
        setSubSelection(null);
    };

    const handleSelectShapeType = (type: ShapeType, forceReplace: boolean = false) => {
        forceSnapshot();
        const catalogEntry = SHAPE_CATALOG.find(c => c.type === type);
        if (catalogEntry && activeCategory !== 'essential-20') {
            setActiveCategory(catalogEntry.category);
        }

        const newShape = createDefaultShape(
            type,
            widthPixels / 2,
            heightPixels / 2,
            fontSize
        );
        if (replaceOnSelect || forceReplace || shapes.length === 0) {
            setShapes([newShape]);
        } else {
            // Offset slightly so it doesn't stack directly on top
            newShape.x += (shapes.length % 3) * 28;
            newShape.y += (shapes.length % 3) * 28;
            setShapes(prev => [...prev, newShape]);
        }
        setSelectedShapeId(newShape.id);
        setSelectedLabelId(null);
        setSubSelection(null);
    };

    const handleDuplicateShape = (shape: ShapeDef) => {
        forceSnapshot();
        const copyId = `shape-${Date.now()}`;
        const cloned: ShapeDef = JSON.parse(JSON.stringify(shape));
        cloned.id = copyId;
        cloned.x += 30;
        cloned.y += 30;
        cloned.labels = cloned.labels.map((l, idx) => ({ ...l, id: `${copyId}-lbl-${idx}` }));
        setShapes(prev => [...prev, cloned]);
        setSelectedShapeId(copyId);
    };

    const handleDeleteSelected = () => {
        if (!selectedShapeId) return;
        forceSnapshot();
        setShapes(prev => {
            const next = prev.filter(s => s.id !== selectedShapeId);
            setSelectedShapeId(next.length > 0 ? next[0].id : null);
            return next;
        });
        setSubSelection(null);
    };

    // --- DRAG HANDLERS (WITH SHIFT, ALT, CTRL MODIFIERS) ---
    const handleShapeDragStart = (id: string, e: React.MouseEvent) => {
        if (cropMode) return;
        e.stopPropagation();
        const shape = shapes.find(s => s.id === id);
        if (!shape) return;

        forceSnapshot();

        // Alt + Drag duplicates the shape!
        let targetId = id;
        let startX = shape.x;
        let startY = shape.y;

        if (e.altKey) {
            const copyId = `shape-${Date.now()}`;
            const cloned: ShapeDef = JSON.parse(JSON.stringify(shape));
            cloned.id = copyId;
            cloned.labels = cloned.labels.map((l, idx) => ({ ...l, id: `${copyId}-lbl-${idx}` }));
            setShapes(prev => [...prev, cloned]);
            targetId = copyId;
        }

        setSelectedShapeId(targetId);
        setSelectedLabelId(null);

        onMouseDown(
            e,
            { x: startX, y: startY },
            (dx, dy, init, nativeEvent) => {
                let svgDx = dx * viewBoxScale;
                let svgDy = dy * viewBoxScale;

                // Shift constrains movement to horizontal or vertical axis
                if (nativeEvent.shiftKey) {
                    if (Math.abs(svgDx) > Math.abs(svgDy)) svgDy = 0;
                    else svgDx = 0;
                }

                const useSnap = snapToGrid && !nativeEvent.ctrlKey && !nativeEvent.metaKey;
                const nx = useSnap ? snapValue(init.x + svgDx, 5) : Math.round(init.x + svgDx);
                const ny = useSnap ? snapValue(init.y + svgDy, 5) : Math.round(init.y + svgDy);

                setShapes(prev =>
                    prev.map(s => (s.id === targetId ? { ...s, x: nx, y: ny } : s))
                );
            },
            undefined,
            'move-shape'
        );
    };

    const handleResizeHandleDrag = (shapeId: string, handleId: string, e: React.MouseEvent) => {
        if (cropMode) return;
        e.stopPropagation();
        const shape = shapes.find(s => s.id === shapeId);
        if (!shape) return;
        forceSnapshot();

        const initShape: ShapeDef = JSON.parse(JSON.stringify(shape));
        const rad = -shape.rotation * (Math.PI / 180);

        onMouseDown(
            e,
            initShape,
            (dx, dy, init: ShapeDef, nativeEvent) => {
                const svgDx = dx * viewBoxScale;
                const svgDy = dy * viewBoxScale;
                const localDx = svgDx * Math.cos(rad) - svgDy * Math.sin(rad);
                const localDy = svgDx * Math.sin(rad) + svgDy * Math.cos(rad);

                const isShift = nativeEvent.shiftKey;
                const isAlt = nativeEvent.altKey;
                const isCtrl = nativeEvent.ctrlKey || nativeEvent.metaKey;
                const step = snapToGrid && !isCtrl ? 5 : 1;

                setShapes(prev =>
                    prev.map(s => {
                        if (s.id !== shapeId) return s;

                        // 1. RECTANGLE / SQUARE
                        if (s.type === 'rectangle' && init.type === 'rectangle') {
                            let newW = init.width;
                            let newH = init.height;
                            let newX = init.x;
                            let newY = init.y;

                            const fromCenter = isAlt || init.sideLinkMode === 'square';
                            const factor = fromCenter ? 2 : 1;

                            if (handleId === 'h-right') {
                                newW = Math.max(20, snapValue(init.width + localDx * factor, step));
                                if (!fromCenter) newX = init.x + (newW - init.width) / 2;
                            } else if (handleId === 'h-left') {
                                newW = Math.max(20, snapValue(init.width - localDx * factor, step));
                                if (!fromCenter) newX = init.x - (newW - init.width) / 2;
                            } else if (handleId === 'h-bottom') {
                                newH = Math.max(20, snapValue(init.height + localDy * factor, step));
                                if (!fromCenter) newY = init.y + (newH - init.height) / 2;
                            } else if (handleId === 'h-top') {
                                newH = Math.max(20, snapValue(init.height - localDy * factor, step));
                                if (!fromCenter) newY = init.y - (newH - init.height) / 2;
                            }

                            if (isShift || s.sideLinkMode === 'square') {
                                const side =
                                    handleId === 'h-left' || handleId === 'h-right' ? newW : newH;
                                newW = side;
                                newH = side;
                            }
                            return { ...s, width: newW, height: newH, x: newX, y: newY };
                        }

                        // 2. TRIANGLE (Draggable 3 Vertices)
                        if (s.type === 'triangle' && init.type === 'triangle') {
                            const vMatch = handleId.match(/^v-(\d)$/);
                            if (vMatch) {
                                const vIdx = parseInt(vMatch[1], 10);
                                const nextVerts = [...init.vertices] as TriangleDef['vertices'];
                                let vx = snapValue(init.vertices[vIdx].x + localDx, step);
                                let vy = snapValue(init.vertices[vIdx].y + localDy, step);

                                // Shift snaps vertex to align horizontally/vertically with other vertices or center (isosceles/right triangle)
                                if (isShift) {
                                    const other1 = init.vertices[(vIdx + 1) % 3];
                                    const other2 = init.vertices[(vIdx + 2) % 3];
                                    const midX = (other1.x + other2.x) / 2;
                                    if (Math.abs(vx - midX) < 18) vx = midX; // Isosceles snap
                                    else if (Math.abs(vx - other1.x) < 18) vx = other1.x; // Right-angle vertical leg
                                    else if (Math.abs(vx - other2.x) < 18) vx = other2.x;
                                    if (Math.abs(vy - other1.y) < 18) vy = other1.y;
                                    else if (Math.abs(vy - other2.y) < 18) vy = other2.y;
                                }

                                nextVerts[vIdx] = { x: vx, y: vy };
                                return { ...s, vertices: nextVerts };
                            }
                        }

                        // 3. POLYGON (Custom Quadrilateral vertices, Regular radius, or Irregular vertex offset)
                        if (s.type === 'polygon' && init.type === 'polygon') {
                            const pMatch = handleId.match(/^poly-v-(\d+)$/);
                            if (pMatch) {
                                const vIdx = parseInt(pMatch[1], 10);
                                if (init.customVertices && init.customVertices.length > vIdx) {
                                    const nextCustom = init.customVertices.map((pt, idx) =>
                                        idx === vIdx
                                            ? {
                                                  x: snapValue(pt.x + localDx, step),
                                                  y: snapValue(pt.y + localDy, step)
                                              }
                                            : { ...pt }
                                    );
                                    return { ...s, customVertices: nextCustom };
                                } else if (vIdx === 0 && !isAlt) {
                                    // Scale regular radius
                                    const dist = Math.sqrt(
                                        Math.pow(localDx, 2) + Math.pow(localDy, 2)
                                    );
                                    const sign = localDy < 0 ? 1 : -1;
                                    const newR = Math.max(
                                        30,
                                        snapValue(init.radius + sign * dist, step)
                                    );
                                    return { ...s, radius: newR };
                                } else {
                                    // Move individual vertex (irregular polygon)
                                    const offsets = [...(init.irregularOffsets || [])];
                                    while (offsets.length < s.sides) {
                                        offsets.push({ dx: 0, dy: 0 });
                                    }
                                    offsets[vIdx] = {
                                        dx: snapValue(offsets[vIdx].dx + localDx, step),
                                        dy: snapValue(offsets[vIdx].dy + localDy, step)
                                    };
                                    return { ...s, irregularOffsets: offsets };
                                }
                            }
                        }

                        // 4. CIRCLE, SECTOR & CHORD
                        if (s.type === 'circle' && init.type === 'circle') {
                            const startRad = init.radiusAngle * (Math.PI / 180);
                            if (handleId === 'h-radius') {
                                const curX = init.radius * Math.cos(startRad) + localDx;
                                const curY = init.radius * Math.sin(startRad) + localDy;
                                const newR = Math.max(
                                    25,
                                    snapValue(Math.sqrt(curX * curX + curY * curY), step)
                                );
                                let newAngle = Math.round(radToDeg(Math.atan2(curY, curX)));
                                if (isShift) newAngle = snapAngle(newAngle, 15);
                                return { ...s, radius: newR, radiusAngle: newAngle };
                            }
                            if (handleId === 'h-diameter') {
                                const dRad = init.diameterAngle * (Math.PI / 180);
                                const curX = init.radius * Math.cos(dRad) + localDx;
                                const curY = init.radius * Math.sin(dRad) + localDy;
                                let deg = Math.round(radToDeg(Math.atan2(curY, curX)));
                                if (isShift) deg = snapAngle(deg, 15);
                                return { ...s, diameterAngle: deg };
                            }
                            if (handleId === 'h-sector-start' || handleId === 'h-sector-end') {
                                const baseDeg =
                                    handleId === 'h-sector-start'
                                        ? init.sectorStartAngle
                                        : init.sectorEndAngle;
                                const bRad = baseDeg * (Math.PI / 180);
                                const curX = init.radius * Math.cos(bRad) + localDx;
                                const curY = init.radius * Math.sin(bRad) + localDy;
                                let deg = Math.round(radToDeg(Math.atan2(curY, curX)));
                                if (isShift) deg = snapAngle(deg, 15);
                                const nextStart =
                                    handleId === 'h-sector-start' ? deg : s.sectorStartAngle;
                                const nextEnd =
                                    handleId === 'h-sector-end' ? deg : s.sectorEndAngle;
                                const newSpan = Math.round(
                                    getPositiveAngleSpan(nextStart, nextEnd)
                                );
                                const shouldAutoUpdateLbl =
                                    !s.sectorAngleLabel || /^\d+°$/.test(s.sectorAngleLabel.trim());
                                return {
                                    ...s,
                                    sectorStartAngle: nextStart,
                                    sectorEndAngle: nextEnd,
                                    sectorAngleLabel: shouldAutoUpdateLbl
                                        ? `${newSpan}°`
                                        : s.sectorAngleLabel
                                };
                            }
                            if (handleId === 'h-chord-start' || handleId === 'h-chord-end') {
                                const baseDeg =
                                    handleId === 'h-chord-start'
                                        ? init.chordStartAngle
                                        : init.chordEndAngle;
                                const bRad = baseDeg * (Math.PI / 180);
                                const curX = init.radius * Math.cos(bRad) + localDx;
                                const curY = init.radius * Math.sin(bRad) + localDy;
                                let deg = Math.round(radToDeg(Math.atan2(curY, curX)));
                                if (isShift) deg = snapAngle(deg, 15);
                                return handleId === 'h-chord-start'
                                    ? { ...s, chordStartAngle: deg }
                                    : { ...s, chordEndAngle: deg };
                            }
                        }

                        // 5. L-SHAPE
                        if (s.type === 'l-shape' && init.type === 'l-shape') {
                            if (handleId === 'l-inner') {
                                const newCutW = Math.max(
                                    25,
                                    Math.min(
                                        s.outerWidth - 25,
                                        snapValue(init.cutWidth - localDx, step)
                                    )
                                );
                                const newCutH = Math.max(
                                    25,
                                    Math.min(
                                        s.outerHeight - 25,
                                        snapValue(init.cutHeight + localDy, step)
                                    )
                                );
                                return { ...s, cutWidth: newCutW, cutHeight: newCutH };
                            }
                            if (handleId === 'l-outer') {
                                const newW = Math.max(
                                    60,
                                    snapValue(init.outerWidth + localDx * 2, step)
                                );
                                const newH = Math.max(
                                    60,
                                    snapValue(init.outerHeight + localDy * 2, step)
                                );
                                return {
                                    ...s,
                                    outerWidth: newW,
                                    outerHeight: isShift ? newW : newH
                                };
                            }
                        }

                        // 6. STADIUM / TRACK
                        if (s.type === 'stadium' && init.type === 'stadium') {
                            if (handleId === 'stad-width') {
                                return {
                                    ...s,
                                    rectWidth: Math.max(
                                        30,
                                        snapValue(init.rectWidth + localDx * 2, step)
                                    )
                                };
                            }
                            if (handleId === 'stad-height') {
                                return {
                                    ...s,
                                    rectHeight: Math.max(
                                        30,
                                        snapValue(init.rectHeight + localDy * 2, step)
                                    )
                                };
                            }
                        }

                        // 7. ANNULUS
                        if (s.type === 'annulus' && init.type === 'annulus') {
                            if (handleId === 'ann-outer') {
                                const bRad = init.outerRadiusAngle * (Math.PI / 180);
                                const curX = init.outerRadius * Math.cos(bRad) + localDx;
                                const curY = init.outerRadius * Math.sin(bRad) + localDy;
                                const newR = Math.max(
                                    s.innerRadius + 15,
                                    snapValue(Math.sqrt(curX * curX + curY * curY), step)
                                );
                                let deg = Math.round(radToDeg(Math.atan2(curY, curX)));
                                if (isShift) deg = snapAngle(deg, 15);
                                return { ...s, outerRadius: newR, outerRadiusAngle: deg };
                            }
                            if (handleId === 'ann-inner') {
                                const bRad = init.innerRadiusAngle * (Math.PI / 180);
                                const curX = init.innerRadius * Math.cos(bRad) + localDx;
                                const curY = init.innerRadius * Math.sin(bRad) + localDy;
                                const newR = Math.max(
                                    15,
                                    Math.min(
                                        s.outerRadius - 15,
                                        snapValue(Math.sqrt(curX * curX + curY * curY), step)
                                    )
                                );
                                let deg = Math.round(radToDeg(Math.atan2(curY, curX)));
                                if (isShift) deg = snapAngle(deg, 15);
                                return { ...s, innerRadius: newR, innerRadiusAngle: deg };
                            }
                        }

                        // 8. HOUSE SHAPE
                        if (s.type === 'house' && init.type === 'house') {
                            if (handleId === 'house-apex') {
                                return {
                                    ...s,
                                    roofHeight: Math.max(
                                        20,
                                        snapValue(init.roofHeight - localDy, step)
                                    )
                                };
                            }
                            if (handleId === 'house-eave') {
                                return {
                                    ...s,
                                    roofOverhang: Math.max(
                                        0,
                                        snapValue(init.roofOverhang + localDx, step)
                                    )
                                };
                            }
                            if (handleId === 'house-base') {
                                return {
                                    ...s,
                                    baseWidth: Math.max(
                                        40,
                                        snapValue(init.baseWidth + localDx * 2, step)
                                    ),
                                    baseHeight: Math.max(
                                        30,
                                        snapValue(init.baseHeight + localDy, step)
                                    )
                                };
                            }
                        }

                        // 8B. NORMAN WINDOW (ARCH)
                        if (s.type === 'norman-window' && init.type === 'norman-window') {
                            if (handleId === 'nw-width') {
                                return {
                                    ...s,
                                    rectWidth: Math.max(
                                        40,
                                        snapValue(init.rectWidth + localDx * 2, step)
                                    )
                                };
                            }
                            if (handleId === 'nw-height') {
                                return {
                                    ...s,
                                    rectHeight: Math.max(
                                        30,
                                        snapValue(init.rectHeight + localDy * 2, step)
                                    )
                                };
                            }
                        }

                        // 8C. INSCRIBED TARGET (CIRCLE IN SQUARE)
                        if (s.type === 'inscribed-circle' && init.type === 'inscribed-circle') {
                            if (handleId === 'insc-size') {
                                return {
                                    ...s,
                                    squareSize: Math.max(
                                        50,
                                        snapValue(init.squareSize + localDx * 2, step)
                                    )
                                };
                            }
                            if (handleId === 'insc-radius') {
                                const r = init.squareSize / 2;
                                const bRad = init.radiusAngle * (Math.PI / 180);
                                const curX = r * Math.cos(bRad) + localDx;
                                const curY = r * Math.sin(bRad) + localDy;
                                let deg = Math.round(radToDeg(Math.atan2(curY, curX)));
                                if (isShift) deg = snapAngle(deg, 15);
                                return { ...s, radiusAngle: deg };
                            }
                        }

                        // 9. PRISM / CUBE
                        if (s.type === 'prism' && init.type === 'prism') {
                            if (handleId === 'prism-size') {
                                const nw = Math.max(40, snapValue(init.width + localDx * 2, step));
                                const nh = Math.max(40, snapValue(init.height + localDy * 2, step));
                                if (isShift || s.isCube) {
                                    return {
                                        ...s,
                                        width: nw,
                                        height: nw,
                                        depthX: Math.round(nw * 0.4),
                                        depthY: -Math.round(nw * 0.3)
                                    };
                                }
                                return { ...s, width: nw, height: nh };
                            }
                            if (handleId === 'prism-depth') {
                                return {
                                    ...s,
                                    depthX: snapValue(init.depthX + localDx, step),
                                    depthY: snapValue(init.depthY + localDy, step)
                                };
                            }
                        }

                        // 10. CYLINDER
                        if (s.type === 'cylinder' && init.type === 'cylinder') {
                            if (handleId === 'cyl-radius') {
                                return {
                                    ...s,
                                    radius: Math.max(25, snapValue(init.radius + localDx, step))
                                };
                            }
                            if (handleId === 'cyl-height') {
                                return {
                                    ...s,
                                    height: Math.max(40, snapValue(init.height + localDy * 2, step))
                                };
                            }
                            if (handleId === 'cyl-ry') {
                                return {
                                    ...s,
                                    ellipseRy: Math.max(
                                        8,
                                        Math.min(
                                            s.radius,
                                            snapValue(init.ellipseRy - localDy, step)
                                        )
                                    )
                                };
                            }
                        }

                        // 11. CONE
                        if (s.type === 'cone' && init.type === 'cone') {
                            if (handleId === 'cone-apex') {
                                return {
                                    ...s,
                                    height: Math.max(40, snapValue(init.height - localDy * 2, step)),
                                    apexOffsetX: isShift
                                        ? 0
                                        : snapValue(init.apexOffsetX + localDx, step)
                                };
                            }
                            if (handleId === 'cone-radius') {
                                return {
                                    ...s,
                                    radius: Math.max(25, snapValue(init.radius + localDx, step))
                                };
                            }
                            if (handleId === 'cone-ry') {
                                return {
                                    ...s,
                                    ellipseRy: Math.max(
                                        8,
                                        Math.min(
                                            s.radius,
                                            snapValue(init.ellipseRy + localDy, step)
                                        )
                                    )
                                };
                            }
                        }

                        // 12. SPHERE
                        if (s.type === 'sphere' && init.type === 'sphere') {
                            if (handleId === 'sph-radius') {
                                const bRad = init.radiusAngle * (Math.PI / 180);
                                const curX = init.radius * Math.cos(bRad) + localDx;
                                const curY = init.radius * Math.sin(bRad) + localDy;
                                const newR = Math.max(
                                    30,
                                    snapValue(Math.sqrt(curX * curX + curY * curY), step)
                                );
                                let deg = Math.round(radToDeg(Math.atan2(curY, curX)));
                                if (isShift) deg = snapAngle(deg, 15);
                                return { ...s, radius: newR, radiusAngle: deg };
                            }
                            if (handleId === 'sph-ry') {
                                return {
                                    ...s,
                                    equatorRy: Math.max(
                                        8,
                                        Math.min(
                                            s.radius,
                                            snapValue(init.equatorRy + localDy, step)
                                        )
                                    )
                                };
                            }
                        }

                        // 13. PYRAMID
                        if (s.type === 'pyramid' && init.type === 'pyramid') {
                            if (handleId === 'pyr-apex') {
                                return {
                                    ...s,
                                    height: Math.max(45, snapValue(init.height - localDy * 1.5, step)),
                                    apexOffsetX: isShift
                                        ? 0
                                        : snapValue(init.apexOffsetX + localDx, step)
                                };
                            }
                            if (handleId === 'pyr-base') {
                                return {
                                    ...s,
                                    baseWidth: Math.max(
                                        40,
                                        snapValue(init.baseWidth + localDx * 2, step)
                                    )
                                };
                            }
                            if (handleId === 'pyr-depth') {
                                return {
                                    ...s,
                                    baseDepthX: snapValue(init.baseDepthX + localDx, step),
                                    baseDepthY: snapValue(init.baseDepthY + localDy, step)
                                };
                            }
                        }

                        return s;
                    })
                );
            },
            undefined,
            'resize-handle'
        );
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

        onMouseDown(
            e,
            { offsetX: label.offsetX, offsetY: label.offsetY },
            (dx, dy, init) => {
                const svgDx = dx * viewBoxScale;
                const svgDy = dy * viewBoxScale;
                updateShapeById(shapeId, s => ({
                    ...s,
                    labels: s.labels.map(l =>
                        l.id === labelId
                            ? { ...l, offsetX: Math.round(init.offsetX + svgDx), offsetY: Math.round(init.offsetY + svgDy) }
                            : l
                    )
                }));
            },
            undefined,
            'move-label'
        );
    };

    // --- ON-CANVAS SUB-ELEMENT CLICK HANDLERS (EDGES, VERTICES, SECTORS, FACES, SEGMENTS) ---
    const handleEdgeClick = (shapeId: string, edgeIndex: number, e: React.MouseEvent) => {
        const shape = shapes.find(s => s.id === shapeId);
        if (!shape) return;
        forceSnapshot();

        // Ctrl/Cmd + Click multi-selects edges so user can apply parallel arrows or ticks to multiple sides at once
        if (e.ctrlKey || e.metaKey) {
            setSubSelection(prev => {
                if (!prev || prev.shapeId !== shapeId) {
                    return { shapeId, edges: [edgeIndex], vertices: [] };
                }
                const exists = prev.edges.includes(edgeIndex);
                return {
                    ...prev,
                    edges: exists
                        ? prev.edges.filter(i => i !== edgeIndex)
                        : [...prev.edges, edgeIndex]
                };
            });
            return;
        }

        // Standard Click cycles through: none -> tick -> double-tick -> triple-tick -> arrow -> double-arrow
        const existing = shape.edgeDecorations.find(d => d.edgeIndex === edgeIndex);
        const curType: DecorationType = existing?.type || 'none';
        const nextType =
            EDGE_DEC_CYCLE[(EDGE_DEC_CYCLE.indexOf(curType) + 1) % EDGE_DEC_CYCLE.length];

        updateShapeById(shapeId, s => {
            const filtered = s.edgeDecorations.filter(d => d.edgeIndex !== edgeIndex);
            if (nextType !== 'none') {
                filtered.push({ edgeIndex, type: nextType });
            }
            return { ...s, edgeDecorations: filtered };
        });
    };

    const handleVertexClick = (shapeId: string, vertexIndex: number, e: React.MouseEvent) => {
        const shape = shapes.find(s => s.id === shapeId);
        if (!shape) return;
        forceSnapshot();

        if (e.ctrlKey || e.metaKey) {
            setSubSelection(prev => {
                if (!prev || prev.shapeId !== shapeId) {
                    return { shapeId, edges: [], vertices: [vertexIndex] };
                }
                const exists = prev.vertices.includes(vertexIndex);
                return {
                    ...prev,
                    vertices: exists
                        ? prev.vertices.filter(i => i !== vertexIndex)
                        : [...prev.vertices, vertexIndex]
                };
            });
            return;
        }

        // For Rectangle, clicking a corner toggles right-angle square directly
        const existing = shape.vertexDecorations.find(d => d.vertexIndex === vertexIndex);
        const curType: AngleType = existing?.type || 'none';
        const nextType =
            shape.type === 'rectangle'
                ? curType === 'right'
                    ? 'none'
                    : 'right'
                : VERTEX_DEC_CYCLE[
                      (VERTEX_DEC_CYCLE.indexOf(curType) + 1) % VERTEX_DEC_CYCLE.length
                  ];

        updateShapeById(shapeId, s => {
            const filtered = s.vertexDecorations.filter(d => d.vertexIndex !== vertexIndex);
            if (nextType !== 'none') {
                filtered.push({
                    vertexIndex,
                    type: nextType,
                    label: nextType === 'label' ? '$\\theta$' : existing?.label
                });
            }
            return { ...s, vertexDecorations: filtered };
        });
    };

    const handleSectorClick = (shapeId: string, sectorIndex: number) => {
        forceSnapshot();
        updateShapeById(shapeId, s => {
            if (s.type !== 'polygon') return s;
            const cur = s.shadedSectors || [];
            const next = cur.includes(sectorIndex)
                ? cur.filter(i => i !== sectorIndex)
                : [...cur, sectorIndex];
            return { ...s, shadedSectors: next };
        });
    };

    const handleFaceClick = (shapeId: string, faceId: string) => {
        forceSnapshot();
        updateShapeById(shapeId, s => {
            if (s.type === 'prism') {
                const fid = faceId as PrismDef['shadedFaces'][number];
                const exists = s.shadedFaces.includes(fid);
                const next = exists
                    ? s.shadedFaces.filter(f => f !== fid)
                    : [...s.shadedFaces, fid];
                return { ...s, shadedFaces: next };
            }
            if (s.type === 'pyramid') {
                const idx = parseInt(faceId, 10);
                if (isNaN(idx)) return s;
                const cur = s.shadedFaces || [];
                const exists = cur.includes(idx);
                const next = exists ? cur.filter(i => i !== idx) : [...cur, idx];
                return { ...s, shadedFaces: next };
            }
            return s;
        });
    };

    const handleSegmentClick = (shapeId: string) => {
        forceSnapshot();
        updateShapeById(shapeId, s => {
            if (s.type !== 'circle') return s;
            return {
                ...s,
                shadeMode: s.shadeMode === 'segment' ? 'none' : 'segment'
            };
        });
    };

    // Batch apply to multi-selected sub-elements
    const applyBatchEdgeDecoration = (type: DecorationType) => {
        if (!subSelection || subSelection.edges.length === 0) return;
        forceSnapshot();
        updateShapeById(subSelection.shapeId, s => {
            const filtered = s.edgeDecorations.filter(
                d => !subSelection.edges.includes(d.edgeIndex)
            );
            if (type !== 'none') {
                subSelection.edges.forEach(edgeIndex => {
                    filtered.push({ edgeIndex, type });
                });
            }
            return { ...s, edgeDecorations: filtered };
        });
    };

    const applyBatchVertexDecoration = (type: AngleType) => {
        if (!subSelection || subSelection.vertices.length === 0) return;
        forceSnapshot();
        updateShapeById(subSelection.shapeId, s => {
            const filtered = s.vertexDecorations.filter(
                d => !subSelection.vertices.includes(d.vertexIndex)
            );
            if (type !== 'none') {
                subSelection.vertices.forEach(vertexIndex => {
                    filtered.push({
                        vertexIndex,
                        type,
                        label: type === 'label' ? '$\\theta$' : undefined
                    });
                });
            }
            return { ...s, vertexDecorations: filtered };
        });
    };

    // --- LABEL HELPERS ---
    const updateLabel = (labelId: string, updates: Partial<ShapeLabel>) => {
        if (!selectedShapeId) return;
        updateShapeById(selectedShapeId, s => ({
            ...s,
            labels: s.labels.map(l => (l.id === labelId ? { ...l, ...updates } : l))
        }));
    };

    const addCustomLabel = (text: string = '$x$') => {
        if (!selectedShape) return;
        forceSnapshot();
        const newLbl: ShapeLabel = {
            id: `lbl-${Date.now()}`,
            text,
            type: 'center',
            offsetX: 0,
            offsetY: 0,
            color: '#0f172a',
            fontSize: ptToSvgUnits(fontSize)
        };
        updateSelected({ labels: [...selectedShape.labels, newLbl] });
        setSelectedLabelId(newLbl.id);
    };

    const addEdgeDimensionLabel = (edgeKey: string, edgeIndex?: number, defaultText: string = '$10\\text{ cm}$') => {
        if (!selectedShape) return;
        forceSnapshot();
        const newLbl: ShapeLabel = {
            id: `lbl-${Date.now()}`,
            text: defaultText,
            type: edgeIndex !== undefined ? 'edge' : 'custom',
            index: edgeIndex,
            customKey: edgeKey,
            offsetX: 0,
            offsetY: 0,
            color: '#0f172a',
            fontSize: ptToSvgUnits(fontSize),
            showDimensionLine: true
        };
        updateSelected({ labels: [...selectedShape.labels, newLbl] });
        setSelectedLabelId(newLbl.id);
    };

    const removeLabel = (labelId: string) => {
        if (!selectedShape) return;
        forceSnapshot();
        updateSelected({ labels: selectedShape.labels.filter(l => l.id !== labelId) });
        if (selectedLabelId === labelId) setSelectedLabelId(null);
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
            setSelectedLabelId(null);
            setSubSelection(null);
        }
    };

    const toggleChecklistItem = (id: string) => {
        setCheckedItems(prev =>
            prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
        );
    };

    // Poly info for inspector (number of edges/vertices)
    const activePolyInfo = useMemo(
        () => (selectedShape ? computePolyGeometry(selectedShape) : null),
        [selectedShape]
    );

    const activeShapePresets = useMemo(
        () => (selectedShape ? getPresetsForShapeType(selectedShape.type) : []),
        [selectedShape?.type]
    );

    const activeStraightEdges = useMemo(
        () => (selectedShape ? getShapeStraightEdges(selectedShape) : []),
        [selectedShape]
    );

    return (
        <div
            className="flex h-full flex-col bg-slate-50 select-none"
            onMouseMove={handleGlobalMouseMove}
            onMouseUp={handleGlobalMouseUp}
        >
            {/* TOP HEADER */}
            <header className="flex items-center justify-between px-4 py-2 bg-white border-b border-slate-200 shadow-xs z-20">
                <div className="flex items-center gap-3">
                    <div className="p-1.5 bg-pink-50 text-pink-600 rounded-md border border-pink-100">
                        <Shapes className="w-4 h-4" />
                    </div>
                    <div>
                        <h1 className="text-sm font-semibold text-slate-900 leading-tight">
                            Geometry &amp; Shape Builder
                        </h1>
                        <p className="text-[11px] text-slate-500">
                            2D Polygons · Composite Figures · 3D Perspective Diagrams
                        </p>
                    </div>
                    <button
                        onClick={() => setShowChecklist(!showChecklist)}
                        className={`ml-2 px-2.5 py-1 rounded-md text-xs font-medium flex items-center gap-1.5 border transition-colors ${
                            showChecklist
                                ? 'bg-pink-600 text-white border-pink-600'
                                : 'bg-pink-50/70 text-pink-700 border-pink-200 hover:bg-pink-100'
                        }`}
                    >
                        <CheckSquare size={13} />
                        <span>
                            Feature Checklist ({checkedItems.length}/{SHAPE_BUILDER_CHECKLIST.length})
                        </span>
                    </button>
                </div>

                <GraphToolbar
                    previewScale={previewScale}
                    setPreviewScale={setPreviewScale}
                    exportDpi={exportDpi}
                    onDpiChange={setExportDpi}
                    cropMode={cropMode}
                    setCropMode={setCropMode}
                    onResetView={handleResetView}
                    onZoomOutCanvas={handleZoomOutCanvas}
                    onAutoCrop={handleAutoCrop}
                    onExportPNG={handleExportPNG}
                    onCopy={handleCopy}
                    isCopied={isCopied}
                    onExportSVG={handleExportSVG}
                    onUndo={undo}
                    onRedo={redo}
                    canUndo={canUndo}
                    canRedo={canRedo}
                    onExportData={() => exportToFile('shape-builder-project.json')}
                    onImportData={importFromFile}
                    onDefaultSettings={handleDefaultSettings}
                />
            </header>

            {/* SHAPE PALETTE BAR (★ 20 Essential 2D | 1. Basic 2D | 2. Composite 2D | 3. 3D Perspective) */}
            <div className="bg-white border-b border-slate-200 px-4 py-2 flex flex-col gap-2 z-10">
                <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="flex items-center gap-2 flex-wrap">
                        {/* Category Tabs */}
                        <div className="flex items-center bg-slate-100 p-0.5 rounded-lg border border-slate-200/80">
                            <button
                                onClick={() => setActiveCategory('essential-20')}
                                className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors flex items-center gap-1.5 ${
                                    activeCategory === 'essential-20'
                                        ? 'bg-pink-600 text-white shadow-xs'
                                        : 'text-slate-600 hover:text-slate-900'
                                }`}
                            >
                                <Sparkles size={13} className={activeCategory === 'essential-20' ? 'text-white' : 'text-pink-600'} />
                                ★ 20 Essential 2D Presets
                            </button>
                            <button
                                onClick={() => setActiveCategory('2d-basic')}
                                className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors flex items-center gap-1.5 ${
                                    activeCategory === '2d-basic'
                                        ? 'bg-white text-slate-900 shadow-xs'
                                        : 'text-slate-600 hover:text-slate-900'
                                }`}
                            >
                                <Compass size={13} className="text-pink-600" />
                                1. Basic 2D
                            </button>
                            <button
                                onClick={() => setActiveCategory('2d-composite')}
                                className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors flex items-center gap-1.5 ${
                                    activeCategory === '2d-composite'
                                        ? 'bg-white text-slate-900 shadow-xs'
                                        : 'text-slate-600 hover:text-slate-900'
                                }`}
                            >
                                <Layers size={13} className="text-sky-600" />
                                2. Composite 2D
                            </button>
                            <button
                                onClick={() => setActiveCategory('3d')}
                                className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors flex items-center gap-1.5 ${
                                    activeCategory === '3d'
                                        ? 'bg-white text-slate-900 shadow-xs'
                                        : 'text-slate-600 hover:text-slate-900'
                                }`}
                            >
                                <Box size={13} className="text-amber-600" />
                                3. 3D Shapes
                            </button>
                        </div>

                        {activeCategory !== 'essential-20' && (
                            <>
                                <div className="h-4 w-px bg-slate-200 mx-1" />
                                {/* Shape Buttons in Active Category */}
                                <div className="flex items-center gap-1.5 flex-wrap">
                                    {SHAPE_CATALOG.filter(c => c.category === activeCategory).map(entry => {
                                        const isCurrent = selectedShape?.type === entry.type;
                                        return (
                                            <button
                                                key={entry.type}
                                                onClick={() => handleSelectShapeType(entry.type)}
                                                title={entry.shortDesc}
                                                className={`px-3 py-1 rounded-md text-xs font-medium transition-all border ${
                                                    isCurrent
                                                        ? 'bg-pink-600 text-white border-pink-600 shadow-xs'
                                                        : 'bg-white text-slate-700 border-slate-200 hover:border-pink-300 hover:bg-pink-50/40'
                                                }`}
                                            >
                                                {entry.label}
                                            </button>
                                        );
                                    })}
                                </div>
                            </>
                        )}
                    </div>

                    {/* Right side palette mode controls */}
                    <div className="flex items-center gap-3 text-xs">
                        <button
                            onClick={() => setShowHandles(prev => !prev)}
                            title="Toggle interactive handles and selection outlines to preview the final exported diagram"
                            className={`px-2.5 py-1 rounded-md text-xs font-medium flex items-center gap-1.5 border transition-colors ${
                                showHandles
                                    ? 'bg-slate-100 text-slate-700 border-slate-300 hover:bg-slate-200'
                                    : 'bg-emerald-600 text-white border-emerald-600 shadow-xs'
                            }`}
                        >
                            {showHandles ? <EyeOff size={13} /> : <Eye size={13} />}
                            <span>{showHandles ? 'Hide Handles (Preview)' : 'Handles Hidden (Clean View)'}</span>
                        </button>
                        <label className="flex items-center gap-1.5 text-slate-600 cursor-pointer">
                            <input
                                type="checkbox"
                                checked={!replaceOnSelect}
                                onChange={e => setReplaceOnSelect(!e.target.checked)}
                                className="rounded text-pink-600 focus:ring-pink-500"
                            />
                            <span>Multi-Shape Mode</span>
                        </label>
                        <label className="flex items-center gap-1.5 text-slate-600 cursor-pointer">
                            <input
                                type="checkbox"
                                checked={snapToGrid}
                                onChange={e => setSnapToGrid(e.target.checked)}
                                className="rounded text-pink-600 focus:ring-pink-500"
                            />
                            <span>Grid Snap</span>
                        </label>
                    </div>
                </div>

                {/* 20 ESSENTIAL 2D PRESETS CURRICULUM SUB-BAR */}
                {activeCategory === 'essential-20' && (
                    <div className="flex flex-wrap items-center gap-2 pt-1.5 border-t border-slate-100">
                        {/* 4 Curriculum Group Pills */}
                        <div className="flex items-center gap-1 bg-slate-100/80 p-0.5 rounded-md border border-slate-200">
                            {ESSENTIAL_2D_GROUPS.map(grp => (
                                <button
                                    key={grp}
                                    onClick={() => setActiveEssentialGroup(grp)}
                                    className={`px-2 py-0.5 rounded text-[11px] font-semibold transition-colors ${
                                        activeEssentialGroup === grp
                                            ? 'bg-white text-pink-700 shadow-2xs border border-pink-200'
                                            : 'text-slate-600 hover:text-slate-900'
                                    }`}
                                >
                                    {grp}
                                </button>
                            ))}
                        </div>

                        <div className="h-3.5 w-px bg-slate-200" />

                        {/* Preset Buttons in Active Curriculum Group */}
                        <div className="flex items-center gap-1.5 flex-wrap">
                            {getEssential2DPresetsByGroup(activeEssentialGroup).map(preset => (
                                <button
                                    key={preset.id}
                                    onClick={() => handleSelectPreset(preset)}
                                    title={preset.description}
                                    className="px-2.5 py-1 rounded-md text-xs font-medium bg-white hover:bg-pink-50 text-slate-700 hover:text-pink-700 border border-slate-200 hover:border-pink-300 transition-colors flex items-center gap-1.5 shadow-2xs"
                                >
                                    <span>{preset.name}</span>
                                    {preset.badge && (
                                        <span className="text-[10px] px-1.5 py-0.2 bg-slate-100 text-slate-600 rounded font-normal">
                                            {preset.badge}
                                        </span>
                                    )}
                                </button>
                            ))}
                        </div>
                    </div>
                )}
            </div>

            {/* MAIN WORKSPACE */}
            <div className="flex flex-1 overflow-hidden relative">
                {/* LEFT INSPECTOR SIDEBAR */}
                <aside className="w-88 bg-white border-r border-slate-200 flex flex-col h-full z-10 tool-sidebar">
                    <div className="flex-1 overflow-y-auto custom-scrollbar p-4 space-y-5">
                        {!selectedShape ? (
                            <div className="text-center py-12 px-4 text-slate-500 space-y-2">
                                <Shapes className="w-8 h-8 mx-auto text-slate-400 stroke-1" />
                                <p className="text-xs font-medium text-slate-700">
                                    No shape selected
                                </p>
                                <p className="text-[11px] text-slate-400">
                                    Click a shape on the canvas or choose one from the top Shape Bar.
                                </p>
                            </div>
                        ) : (
                            <>
                                {/* Shape Header & Quick Actions */}
                                <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                                    <div>
                                        <span className="text-[10px] font-semibold uppercase tracking-wider text-pink-600">
                                            Active Figure
                                        </span>
                                        <h2 className="text-sm font-bold text-slate-900">
                                            {SHAPE_CATALOG.find(c => c.type === selectedShape.type)
                                                ?.label || selectedShape.type}
                                        </h2>
                                    </div>
                                    <div className="flex items-center gap-1">
                                        <button
                                            onClick={() => handleDuplicateShape(selectedShape)}
                                            title="Duplicate Shape (or Alt+Drag)"
                                            className="p-1.5 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded border border-slate-200"
                                        >
                                            <Copy size={13} />
                                        </button>
                                        {shapes.length > 1 && (
                                            <button
                                                onClick={handleDeleteSelected}
                                                title="Delete Shape"
                                                className="p-1.5 text-red-600 hover:bg-red-50 rounded border border-red-200"
                                            >
                                                <Trash2 size={13} />
                                            </button>
                                        )}
                                    </div>
                                </div>

                                {/* UNIVERSAL DATA-DRIVEN QUICK PRESETS BAR */}
                                {activeShapePresets.length > 0 && (
                                    <div className="space-y-1.5">
                                        <span className="text-[11px] font-bold text-slate-600 uppercase tracking-wide flex items-center gap-1">
                                            <Sparkles size={12} className="text-pink-600" />
                                            Quick Presets
                                        </span>
                                        <div className="grid grid-cols-2 gap-1.5">
                                            {activeShapePresets.map(preset => (
                                                <button
                                                    key={preset.id}
                                                    onClick={() => {
                                                        forceSnapshot();
                                                        const built = preset.create(
                                                            selectedShape.x,
                                                            selectedShape.y,
                                                            fontSize
                                                        );
                                                        built.id = selectedShape.id;
                                                        setShapes(prev =>
                                                            prev.map(s =>
                                                                s.id === selectedShape.id ? built : s
                                                            )
                                                        );
                                                    }}
                                                    title={preset.description}
                                                    className="px-2.5 py-1.5 text-xs font-medium bg-slate-50 hover:bg-pink-50 hover:border-pink-300 border border-slate-200 rounded text-slate-700 text-left truncate transition-colors"
                                                >
                                                    {preset.name}
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                {/* MULTI-SELECT SUB-ELEMENT BATCH BAR (When Ctrl+Click used) */}
                                {subSelection &&
                                    subSelection.shapeId === selectedShape.id &&
                                    (subSelection.edges.length > 0 ||
                                        subSelection.vertices.length > 0) && (
                                        <div className="p-3 rounded-lg bg-pink-50 border border-pink-200 space-y-2.5">
                                            <div className="flex items-center justify-between">
                                                <span className="text-xs font-bold text-pink-900">
                                                    Ctrl Multi-Selection (
                                                    {subSelection.edges.length} sides,{' '}
                                                    {subSelection.vertices.length} corners)
                                                </span>
                                                <button
                                                    onClick={() => setSubSelection(null)}
                                                    className="text-[11px] text-pink-700 hover:underline"
                                                >
                                                    Clear
                                                </button>
                                            </div>
                                            {subSelection.edges.length > 0 && (
                                                <div className="space-y-1">
                                                    <span className="text-[11px] text-pink-800 block">
                                                        Apply to selected sides:
                                                    </span>
                                                    <div className="grid grid-cols-3 gap-1">
                                                        {(
                                                            [
                                                                ['tick', '1 Tick'],
                                                                ['double-tick', '2 Ticks'],
                                                                ['triple-tick', '3 Ticks'],
                                                                ['arrow', '1 Arrow'],
                                                                ['double-arrow', '2 Arrows'],
                                                                ['none', 'Clear']
                                                            ] as [DecorationType, string][]
                                                        ).map(([t, lbl]) => (
                                                            <button
                                                                key={t}
                                                                onClick={() =>
                                                                    applyBatchEdgeDecoration(t)
                                                                }
                                                                className="px-2 py-1 text-[11px] bg-white border border-pink-200 rounded hover:bg-pink-100 text-slate-800 font-medium"
                                                            >
                                                                {lbl}
                                                            </button>
                                                        ))}
                                                    </div>
                                                </div>
                                            )}
                                            {subSelection.vertices.length > 0 && (
                                                <div className="space-y-1">
                                                    <span className="text-[11px] text-pink-800 block">
                                                        Apply to selected angles:
                                                    </span>
                                                    <div className="grid grid-cols-3 gap-1">
                                                        {(
                                                            [
                                                                ['arc', '1 Arc'],
                                                                ['double-arc', '2 Arcs'],
                                                                ['right', 'Right 90°'],
                                                                ['label', 'Label θ'],
                                                                ['none', 'Clear']
                                                            ] as [AngleType, string][]
                                                        ).map(([t, lbl]) => (
                                                            <button
                                                                key={t}
                                                                onClick={() =>
                                                                    applyBatchVertexDecoration(t)
                                                                }
                                                                className="px-2 py-1 text-[11px] bg-white border border-pink-200 rounded hover:bg-pink-100 text-slate-800 font-medium"
                                                            >
                                                                {lbl}
                                                            </button>
                                                        ))}
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    )}

                                {/* =========================================================
                                    SHAPE-SPECIFIC GEOMETRY & PEDAGOGICAL CONTROLS
                                   ========================================================= */}

                                {/* 1A. TRIANGLE CONTROLS */}
                                {selectedShape.type === 'triangle' && (
                                    <div className="space-y-4">
                                        <div className="flex items-center justify-between">
                                            <span className="text-xs font-bold text-slate-700 uppercase tracking-wide">
                                                Triangle Presets
                                            </span>
                                        </div>
                                        <div className="grid grid-cols-2 gap-1.5">
                                            <button
                                                onClick={() => {
                                                    forceSnapshot();
                                                    updateSelected({
                                                        vertices: [
                                                            { x: 0, y: -80 },
                                                            { x: 90, y: 70 },
                                                            { x: -90, y: 70 }
                                                        ],
                                                        edgeDecorations: [
                                                            { edgeIndex: 0, type: 'tick' },
                                                            { edgeIndex: 2, type: 'tick' }
                                                        ],
                                                        vertexDecorations: [
                                                            { vertexIndex: 1, type: 'arc' },
                                                            { vertexIndex: 2, type: 'arc' }
                                                        ]
                                                    });
                                                }}
                                                className="px-2.5 py-1.5 text-xs font-medium bg-slate-50 hover:bg-pink-50 border border-slate-200 rounded text-slate-700"
                                            >
                                                Isosceles
                                            </button>
                                            <button
                                                onClick={() => {
                                                    forceSnapshot();
                                                    const r = 95;
                                                    updateSelected({
                                                        vertices: [
                                                            { x: 0, y: -r },
                                                            {
                                                                x: r * Math.cos(Math.PI / 6),
                                                                y: r * Math.sin(Math.PI / 6)
                                                            },
                                                            {
                                                                x: -r * Math.cos(Math.PI / 6),
                                                                y: r * Math.sin(Math.PI / 6)
                                                            }
                                                        ],
                                                        edgeDecorations: [
                                                            { edgeIndex: 0, type: 'tick' },
                                                            { edgeIndex: 1, type: 'tick' },
                                                            { edgeIndex: 2, type: 'tick' }
                                                        ],
                                                        vertexDecorations: [
                                                            { vertexIndex: 0, type: 'arc' },
                                                            { vertexIndex: 1, type: 'arc' },
                                                            { vertexIndex: 2, type: 'arc' }
                                                        ]
                                                    });
                                                }}
                                                className="px-2.5 py-1.5 text-xs font-medium bg-slate-50 hover:bg-pink-50 border border-slate-200 rounded text-slate-700"
                                            >
                                                Equilateral
                                            </button>
                                            <button
                                                onClick={() => {
                                                    forceSnapshot();
                                                    updateSelected({
                                                        vertices: [
                                                            { x: -85, y: -75 },
                                                            { x: 95, y: 75 },
                                                            { x: -85, y: 75 }
                                                        ],
                                                        showAltitude: false,
                                                        edgeDecorations: [],
                                                        vertexDecorations: [
                                                            { vertexIndex: 2, type: 'right' },
                                                            {
                                                                vertexIndex: 1,
                                                                type: 'label',
                                                                label: '$\\theta$'
                                                            }
                                                        ]
                                                    });
                                                }}
                                                className="px-2.5 py-1.5 text-xs font-medium bg-slate-50 hover:bg-pink-50 border border-slate-200 rounded text-slate-700"
                                            >
                                                Right (SOHCAHTOA)
                                            </button>
                                            <button
                                                onClick={() => {
                                                    forceSnapshot();
                                                    updateSelected({
                                                        vertices: [
                                                            { x: -115, y: -70 },
                                                            { x: 105, y: 70 },
                                                            { x: -35, y: 70 }
                                                        ],
                                                        showAltitude: true,
                                                        edgeDecorations: [],
                                                        vertexDecorations: []
                                                    });
                                                }}
                                                className="px-2.5 py-1.5 text-xs font-medium bg-slate-50 hover:bg-pink-50 border border-slate-200 rounded text-slate-700"
                                            >
                                                Obtuse + Altitude
                                            </button>
                                        </div>

                                        {/* Altitude / Height Line Controls */}
                                        <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 space-y-2.5">
                                            <label className="flex items-center justify-between cursor-pointer">
                                                <span className="text-xs font-semibold text-slate-700">
                                                    Altitude / Height Line (Dashed + 90°)
                                                </span>
                                                <input
                                                    type="checkbox"
                                                    checked={!!selectedShape.showAltitude}
                                                    onChange={e => {
                                                        forceSnapshot();
                                                        updateSelected({
                                                            showAltitude: e.target.checked
                                                        });
                                                    }}
                                                    className="rounded text-pink-600"
                                                />
                                            </label>
                                            {selectedShape.showAltitude && (
                                                <div className="flex items-center justify-between text-xs pt-1">
                                                    <span className="text-slate-500">
                                                        Drop from Vertex:
                                                    </span>
                                                    <div className="flex gap-1">
                                                        {[0, 1, 2].map(vIdx => (
                                                            <button
                                                                key={vIdx}
                                                                onClick={() =>
                                                                    updateSelected({
                                                                        altitudeVertexIndex: vIdx
                                                                    })
                                                                }
                                                                className={`px-2 py-0.5 rounded border text-xs ${
                                                                    (selectedShape.altitudeVertexIndex ??
                                                                        0) === vIdx
                                                                        ? 'bg-pink-600 text-white border-pink-600'
                                                                        : 'bg-white text-slate-600 border-slate-200'
                                                                }`}
                                                            >
                                                                V{vIdx + 1}
                                                            </button>
                                                        ))}
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                )}

                                {/* 1B. RECTANGLE & SQUARE CONTROLS */}
                                {selectedShape.type === 'rectangle' && (
                                    <div className="space-y-4">
                                        <div className="grid grid-cols-2 gap-3">
                                            <div>
                                                <label className="block text-xs font-medium text-slate-600 mb-1">
                                                    Width (px)
                                                </label>
                                                <input
                                                    type="number"
                                                    value={selectedShape.width}
                                                    onChange={e => {
                                                        const w = Math.max(
                                                            20,
                                                            parseFloat(e.target.value) || 20
                                                        );
                                                        updateSelected(
                                                            selectedShape.sideLinkMode === 'square'
                                                                ? { width: w, height: w }
                                                                : { width: w }
                                                        );
                                                    }}
                                                    className="w-full border border-slate-300 rounded px-2 py-1.5 text-xs tabular-nums"
                                                />
                                            </div>
                                            <div>
                                                <label className="block text-xs font-medium text-slate-600 mb-1">
                                                    Height (px)
                                                </label>
                                                <input
                                                    type="number"
                                                    value={selectedShape.height}
                                                    onChange={e => {
                                                        const h = Math.max(
                                                            20,
                                                            parseFloat(e.target.value) || 20
                                                        );
                                                        updateSelected(
                                                            selectedShape.sideLinkMode === 'square'
                                                                ? { width: h, height: h }
                                                                : { height: h }
                                                        );
                                                    }}
                                                    className="w-full border border-slate-300 rounded px-2 py-1.5 text-xs tabular-nums"
                                                />
                                            </div>
                                        </div>

                                        {/* Side Linking */}
                                        <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 space-y-2">
                                            <span className="text-xs font-semibold text-slate-700 block">
                                                Side Linking Mode
                                            </span>
                                            <div className="grid grid-cols-2 gap-1.5">
                                                <button
                                                    onClick={() =>
                                                        updateSelected({
                                                            sideLinkMode: 'rectangle'
                                                        })
                                                    }
                                                    className={`py-1.5 text-xs font-medium rounded border ${
                                                        selectedShape.sideLinkMode !== 'square'
                                                            ? 'bg-pink-600 text-white border-pink-600'
                                                            : 'bg-white text-slate-600 border-slate-200'
                                                    }`}
                                                >
                                                    Opposite Sides
                                                </button>
                                                <button
                                                    onClick={() =>
                                                        updateSelected({
                                                            sideLinkMode: 'square',
                                                            height: selectedShape.width
                                                        })
                                                    }
                                                    className={`py-1.5 text-xs font-medium rounded border ${
                                                        selectedShape.sideLinkMode === 'square'
                                                            ? 'bg-pink-600 text-white border-pink-600'
                                                            : 'bg-white text-slate-600 border-slate-200'
                                                    }`}
                                                >
                                                    Lock Square (All 4)
                                                </button>
                                            </div>
                                        </div>

                                        {/* Diagonals & Center Intersection */}
                                        <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 space-y-2.5">
                                            <span className="text-xs font-semibold text-slate-700 block">
                                                Diagonals &amp; Center Intersection
                                            </span>
                                            <div className="grid grid-cols-3 gap-1">
                                                {(['none', 'one', 'both'] as const).map(mode => (
                                                    <button
                                                        key={mode}
                                                        onClick={() =>
                                                            updateSelected({ showDiagonals: mode })
                                                        }
                                                        className={`py-1 text-xs font-medium rounded border capitalize ${
                                                            (selectedShape.showDiagonals ||
                                                                'none') === mode
                                                                ? 'bg-pink-600 text-white border-pink-600'
                                                                : 'bg-white text-slate-600 border-slate-200'
                                                        }`}
                                                    >
                                                        {mode}
                                                    </button>
                                                ))}
                                            </div>
                                            <div className="flex items-center justify-between pt-1">
                                                <label className="flex items-center gap-1.5 text-xs text-slate-600 cursor-pointer">
                                                    <input
                                                        type="checkbox"
                                                        checked={
                                                            selectedShape.diagonalStyle === 'dashed'
                                                        }
                                                        onChange={e =>
                                                            updateSelected({
                                                                diagonalStyle: e.target.checked
                                                                    ? 'dashed'
                                                                    : 'solid'
                                                            })
                                                        }
                                                        className="rounded text-pink-600"
                                                    />
                                                    <span>Dashed Diagonals</span>
                                                </label>
                                                <label className="flex items-center gap-1.5 text-xs text-slate-600 cursor-pointer">
                                                    <input
                                                        type="checkbox"
                                                        checked={!!selectedShape.showCenterDot}
                                                        onChange={e =>
                                                            updateSelected({
                                                                showCenterDot: e.target.checked
                                                            })
                                                        }
                                                        className="rounded text-pink-600"
                                                    />
                                                    <span>Center Dot</span>
                                                </label>
                                            </div>
                                        </div>

                                        {/* Pre-configured Tick & Parallel Presets */}
                                        <div className="space-y-1.5">
                                            <span className="text-xs font-semibold text-slate-700 block">
                                                Quick Tick &amp; Parallel Presets
                                            </span>
                                            <div className="grid grid-cols-2 gap-1.5">
                                                <button
                                                    onClick={() => {
                                                        forceSnapshot();
                                                        updateSelected({
                                                            edgeDecorations: [
                                                                { edgeIndex: 0, type: 'tick' },
                                                                { edgeIndex: 2, type: 'tick' },
                                                                {
                                                                    edgeIndex: 1,
                                                                    type: 'double-tick'
                                                                },
                                                                {
                                                                    edgeIndex: 3,
                                                                    type: 'double-tick'
                                                                }
                                                            ]
                                                        });
                                                    }}
                                                    className="px-2 py-1.5 text-xs bg-slate-50 hover:bg-pink-50 border border-slate-200 rounded text-slate-700 font-medium"
                                                >
                                                    Opposite Equal Ticks
                                                </button>
                                                <button
                                                    onClick={() => {
                                                        forceSnapshot();
                                                        updateSelected({
                                                            edgeDecorations: [
                                                                { edgeIndex: 0, type: 'arrow' },
                                                                {
                                                                    edgeIndex: 2,
                                                                    type: 'arrow-reverse'
                                                                },
                                                                {
                                                                    edgeIndex: 1,
                                                                    type: 'double-arrow'
                                                                },
                                                                {
                                                                    edgeIndex: 3,
                                                                    type: 'double-arrow'
                                                                }
                                                            ]
                                                        });
                                                    }}
                                                    className="px-2 py-1.5 text-xs bg-slate-50 hover:bg-pink-50 border border-slate-200 rounded text-slate-700 font-medium"
                                                >
                                                    Opposite Parallel
                                                </button>
                                                <button
                                                    onClick={() => {
                                                        forceSnapshot();
                                                        updateSelected({
                                                            vertexDecorations:
                                                                selectedShape.vertexDecorations
                                                                    .length === 4
                                                                    ? []
                                                                    : [0, 1, 2, 3].map(i => ({
                                                                          vertexIndex: i,
                                                                          type: 'right'
                                                                      }))
                                                        });
                                                    }}
                                                    className="px-2 py-1.5 text-xs bg-slate-50 hover:bg-pink-50 border border-slate-200 rounded text-slate-700 font-medium"
                                                >
                                                    Toggle 4 Right Angles
                                                </button>
                                                <button
                                                    onClick={() => {
                                                        forceSnapshot();
                                                        updateSelected({
                                                            edgeDecorations: [],
                                                            vertexDecorations: []
                                                        });
                                                    }}
                                                    className="px-2 py-1.5 text-xs bg-slate-50 hover:bg-red-50 border border-slate-200 rounded text-slate-600 font-medium"
                                                >
                                                    Clear All Marks
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {/* 1C. POLYGON (REGULAR & IRREGULAR) CONTROLS */}
                                {selectedShape.type === 'polygon' && (
                                    <div className="space-y-4">
                                        <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 space-y-3">
                                            <div className="flex items-center justify-between">
                                                <span className="text-xs font-semibold text-slate-700">
                                                    Number of Sides: {selectedShape.sides}
                                                </span>
                                                <span className="text-[11px] font-mono text-pink-600">
                                                    {selectedShape.sides === 3
                                                        ? 'Triangle'
                                                        : selectedShape.sides === 4
                                                        ? 'Quadrilateral'
                                                        : selectedShape.sides === 5
                                                        ? 'Pentagon'
                                                        : selectedShape.sides === 6
                                                        ? 'Hexagon'
                                                        : selectedShape.sides === 8
                                                        ? 'Octagon'
                                                        : selectedShape.sides === 10
                                                        ? 'Decagon'
                                                        : `${selectedShape.sides}-gon`}
                                                </span>
                                            </div>
                                            <input
                                                type="range"
                                                min="3"
                                                max="12"
                                                step="1"
                                                value={selectedShape.sides}
                                                onChange={e =>
                                                    updateSelected({
                                                        sides: parseInt(e.target.value, 10),
                                                        customVertices: undefined,
                                                        showAltitude: false,
                                                        showDiagonals: false
                                                    })
                                                }
                                                className="w-full accent-pink-600 cursor-pointer"
                                            />
                                            {!selectedShape.customVertices && (
                                                <div>
                                                    <div className="flex justify-between text-xs text-slate-600 mb-1">
                                                        <span>Circumradius</span>
                                                        <span className="tabular-nums">
                                                            {selectedShape.radius}px
                                                        </span>
                                                    </div>
                                                    <input
                                                        type="range"
                                                        min="40"
                                                        max="200"
                                                        value={selectedShape.radius}
                                                        onChange={e =>
                                                            updateSelected({
                                                                radius: parseInt(e.target.value, 10)
                                                            })
                                                        }
                                                        className="w-full accent-pink-600 cursor-pointer"
                                                    />
                                                </div>
                                            )}
                                            {(selectedShape.irregularOffsets ||
                                                selectedShape.customVertices) && (
                                                <button
                                                    onClick={() =>
                                                        updateSelected({
                                                            irregularOffsets: undefined,
                                                            customVertices: undefined,
                                                            showAltitude: false,
                                                            showDiagonals: false
                                                        })
                                                    }
                                                    className="w-full py-1 text-xs bg-white border border-slate-200 rounded text-slate-700 hover:bg-slate-100"
                                                >
                                                    Reset to Regular {selectedShape.sides}-gon
                                                </button>
                                            )}
                                        </div>

                                        {/* Quadrilateral Altitude & Diagonals (Parallelogram, Trapezium, Rhombus, Kite) */}
                                        {selectedShape.sides === 4 && (
                                            <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 space-y-2">
                                                <span className="text-xs font-semibold text-slate-700 block">
                                                    Quadrilateral Features (Parallelogram / Trapezium / Rhombus / Kite)
                                                </span>
                                                <label className="flex items-center justify-between text-xs text-slate-700 cursor-pointer">
                                                    <span>Internal Dashed Altitude ($h$ + 90°)</span>
                                                    <input
                                                        type="checkbox"
                                                        checked={!!selectedShape.showAltitude}
                                                        onChange={e =>
                                                            updateSelected({
                                                                showAltitude: e.target.checked,
                                                                altitudeVertexIndex:
                                                                    selectedShape.altitudeVertexIndex ?? 0,
                                                                altitudeBaseEdgeIndex:
                                                                    selectedShape.altitudeBaseEdgeIndex ?? 2
                                                            })
                                                        }
                                                        className="rounded text-pink-600"
                                                    />
                                                </label>
                                                <label className="flex items-center justify-between text-xs text-slate-700 cursor-pointer">
                                                    <span>Internal Dashed Diagonals ($d_1, d_2$)</span>
                                                    <input
                                                        type="checkbox"
                                                        checked={!!selectedShape.showDiagonals}
                                                        onChange={e =>
                                                            updateSelected({
                                                                showDiagonals: e.target.checked
                                                            })
                                                        }
                                                        className="rounded text-pink-600"
                                                    />
                                                </label>
                                                {selectedShape.showDiagonals && (
                                                    <label className="flex items-center justify-between text-xs text-slate-700 cursor-pointer">
                                                        <span>Right Angle (90°) at Diagonal Intersection</span>
                                                        <input
                                                            type="checkbox"
                                                            checked={!!selectedShape.showDiagonalRightAngle}
                                                            onChange={e =>
                                                                updateSelected({
                                                                    showDiagonalRightAngle: e.target.checked
                                                                })
                                                            }
                                                            className="rounded text-pink-600"
                                                        />
                                                    </label>
                                                )}
                                            </div>
                                        )}

                                        {/* Center, Radius, Apothem & Exterior Angles */}
                                        <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 space-y-2">
                                            <label className="flex items-center justify-between text-xs text-slate-700 cursor-pointer">
                                                <span>Center Point Dot</span>
                                                <input
                                                    type="checkbox"
                                                    checked={!!selectedShape.showCenterDot}
                                                    onChange={e =>
                                                        updateSelected({
                                                            showCenterDot: e.target.checked
                                                        })
                                                    }
                                                    className="rounded text-pink-600"
                                                />
                                            </label>
                                            <label className="flex items-center justify-between text-xs text-slate-700 cursor-pointer">
                                                <span>Apothem Line (Perpendicular + 90°)</span>
                                                <input
                                                    type="checkbox"
                                                    checked={!!selectedShape.showApothem}
                                                    onChange={e =>
                                                        updateSelected({
                                                            showApothem: e.target.checked
                                                        })
                                                    }
                                                    className="rounded text-pink-600"
                                                />
                                            </label>
                                            <label className="flex items-center justify-between text-xs text-slate-700 cursor-pointer">
                                                <span>Vertex Radius Line (Dashed)</span>
                                                <input
                                                    type="checkbox"
                                                    checked={!!selectedShape.showRadiusLine}
                                                    onChange={e =>
                                                        updateSelected({
                                                            showRadiusLine: e.target.checked
                                                        })
                                                    }
                                                    className="rounded text-pink-600"
                                                />
                                            </label>
                                            <label className="flex items-center justify-between text-xs text-slate-700 cursor-pointer">
                                                <span>Extend Sides for Exterior Angles</span>
                                                <input
                                                    type="checkbox"
                                                    checked={
                                                        (selectedShape.exteriorExtensionLength ||
                                                            0) > 0
                                                    }
                                                    onChange={e =>
                                                        updateSelected({
                                                            exteriorExtensionLength: e.target
                                                                .checked
                                                                ? 45
                                                                : 0
                                                        })
                                                    }
                                                    className="rounded text-pink-600"
                                                />
                                            </label>
                                            {(selectedShape.exteriorExtensionLength || 0) > 0 && (
                                                <div className="pt-1">
                                                    <div className="flex justify-between text-xs text-slate-600 mb-1">
                                                        <span>Exterior Extension Length</span>
                                                        <span className="tabular-nums">
                                                            {selectedShape.exteriorExtensionLength}px
                                                        </span>
                                                    </div>
                                                    <input
                                                        type="range"
                                                        min="20"
                                                        max="90"
                                                        value={
                                                            selectedShape.exteriorExtensionLength ||
                                                            45
                                                        }
                                                        onChange={e =>
                                                            updateSelected({
                                                                exteriorExtensionLength: parseInt(
                                                                    e.target.value,
                                                                    10
                                                                )
                                                            })
                                                        }
                                                        className="w-full accent-pink-600 cursor-pointer"
                                                    />
                                                </div>
                                            )}
                                        </div>

                                        <div className="p-2.5 bg-blue-50/60 border border-blue-200 rounded-lg text-[11px] text-blue-900 flex items-center justify-between gap-2">
                                            <span>
                                                <strong>Tip:</strong> Click any triangular sector
                                                inside the polygon on the canvas to shade it!
                                            </span>
                                            {(selectedShape.shadedSectors?.length || 0) > 0 && (
                                                <button
                                                    onClick={() =>
                                                        updateSelected({ shadedSectors: [] })
                                                    }
                                                    className="px-2 py-1 text-[10px] font-semibold bg-white border border-blue-200 rounded text-blue-700 shrink-0 hover:bg-blue-100"
                                                >
                                                    Clear ({selectedShape.shadedSectors?.length})
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                )}

                                {/* 1D. CIRCLE, SECTOR, ARC, CHORD & SEGMENT CONTROLS */}
                                {selectedShape.type === 'circle' && (
                                    <div className="space-y-4">
                                        <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 space-y-2.5">
                                            <div>
                                                <div className="flex justify-between text-xs text-slate-600 mb-1">
                                                    <span>Circle Radius</span>
                                                    <span className="tabular-nums">
                                                        {selectedShape.radius}px
                                                    </span>
                                                </div>
                                                <input
                                                    type="range"
                                                    min="30"
                                                    max="200"
                                                    value={selectedShape.radius}
                                                    onChange={e =>
                                                        updateSelected({
                                                            radius: parseInt(e.target.value, 10)
                                                        })
                                                    }
                                                    className="w-full accent-pink-600 cursor-pointer"
                                                />
                                            </div>
                                            <label className="flex items-center justify-between text-xs text-slate-700 cursor-pointer pt-1">
                                                <span>Center Dot</span>
                                                <input
                                                    type="checkbox"
                                                    checked={selectedShape.showCenter}
                                                    onChange={e =>
                                                        updateSelected({
                                                            showCenter: e.target.checked
                                                        })
                                                    }
                                                    className="rounded text-pink-600"
                                                />
                                            </label>
                                            <label className="flex items-center justify-between text-xs text-slate-700 cursor-pointer">
                                                <span>Radius Line</span>
                                                <input
                                                    type="checkbox"
                                                    checked={selectedShape.showRadiusLine}
                                                    onChange={e =>
                                                        updateSelected({
                                                            showRadiusLine: e.target.checked
                                                        })
                                                    }
                                                    className="rounded text-pink-600"
                                                />
                                            </label>
                                            <label className="flex items-center justify-between text-xs text-slate-700 cursor-pointer">
                                                <span>Diameter Line</span>
                                                <input
                                                    type="checkbox"
                                                    checked={selectedShape.showDiameterLine}
                                                    onChange={e =>
                                                        updateSelected({
                                                            showDiameterLine: e.target.checked
                                                        })
                                                    }
                                                    className="rounded text-pink-600"
                                                />
                                            </label>
                                            <label className="flex items-center justify-between text-xs text-slate-700 cursor-pointer">
                                                <span>Pac-Man Sector Only (Cut Out)</span>
                                                <input
                                                    type="checkbox"
                                                    checked={!!selectedShape.isSector}
                                                    onChange={e =>
                                                        updateSelected({
                                                            isSector: e.target.checked
                                                        })
                                                    }
                                                    className="rounded text-pink-600"
                                                />
                                            </label>
                                        </div>

                                        {/* Sector & Segment Shading */}
                                        <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 space-y-2.5">
                                            <span className="text-xs font-semibold text-slate-700 block">
                                                Sector / Segment Shading
                                            </span>
                                            <div className="grid grid-cols-2 gap-1.5">
                                                {(
                                                    [
                                                        ['none', 'None'],
                                                        ['minor-sector', 'Minor Sector'],
                                                        ['major-sector', 'Major Sector'],
                                                        ['segment', 'Chord Segment']
                                                    ] as const
                                                ).map(([mode, lbl]) => (
                                                    <button
                                                        key={mode}
                                                        onClick={() =>
                                                            updateSelected({
                                                                shadeMode: mode,
                                                                showChord:
                                                                    mode === 'segment'
                                                                        ? true
                                                                        : selectedShape.showChord
                                                            })
                                                        }
                                                        className={`py-1.5 text-xs font-medium rounded border ${
                                                            (selectedShape.shadeMode || 'none') ===
                                                            mode
                                                                ? 'bg-pink-600 text-white border-pink-600'
                                                                : 'bg-white text-slate-600 border-slate-200'
                                                        }`}
                                                    >
                                                        {lbl}
                                                    </button>
                                                ))}
                                            </div>

                                            {/* Sector Span Slider */}
                                            <div className="pt-1">
                                                <div className="flex justify-between text-xs text-slate-600 mb-1">
                                                    <span>Sector Angle Span</span>
                                                    <span className="tabular-nums font-mono">
                                                        {Math.round(
                                                            getPositiveAngleSpan(
                                                                selectedShape.sectorStartAngle ?? 0,
                                                                selectedShape.sectorEndAngle ?? 110
                                                            )
                                                        )}
                                                        °
                                                    </span>
                                                </div>
                                                <input
                                                    type="range"
                                                    min="15"
                                                    max="345"
                                                    step="5"
                                                    value={Math.round(
                                                        getPositiveAngleSpan(
                                                            selectedShape.sectorStartAngle ?? 0,
                                                            selectedShape.sectorEndAngle ?? 110
                                                        )
                                                    )}
                                                    onChange={e => {
                                                        const span = parseInt(e.target.value, 10);
                                                        const start =
                                                            selectedShape.sectorStartAngle ?? 0;
                                                        const nextEnd = (start + span) % 360;
                                                        const curLabel =
                                                            selectedShape.sectorAngleLabel || '';
                                                        const isNumericDegree =
                                                            /^\$?\d+(\.\d+)?\^?\{?\\circ\}?\$?$|^\d+°?$/.test(
                                                                curLabel.trim()
                                                            );
                                                        updateSelected({
                                                            sectorEndAngle: nextEnd,
                                                            ...(isNumericDegree
                                                                ? {
                                                                      sectorAngleLabel: `${span}°`
                                                                  }
                                                                : {})
                                                        });
                                                    }}
                                                    className="w-full accent-pink-600 cursor-pointer"
                                                />
                                            </div>

                                            <label className="flex items-center justify-between text-xs text-slate-700 cursor-pointer pt-1">
                                                <span>Highlight Arc Length in Bold</span>
                                                <input
                                                    type="checkbox"
                                                    checked={!!selectedShape.highlightArc}
                                                    onChange={e =>
                                                        updateSelected({
                                                            highlightArc: e.target.checked
                                                        })
                                                    }
                                                    className="rounded text-pink-600"
                                                />
                                            </label>
                                            <label className="flex items-center justify-between text-xs text-slate-700 cursor-pointer">
                                                <span>Show Chord Line (Click segment to shade)</span>
                                                <input
                                                    type="checkbox"
                                                    checked={!!selectedShape.showChord}
                                                    onChange={e =>
                                                        updateSelected({
                                                            showChord: e.target.checked
                                                        })
                                                    }
                                                    className="rounded text-pink-600"
                                                />
                                            </label>
                                            <label className="flex items-center justify-between text-xs text-slate-700 cursor-pointer">
                                                <span>Show Center Angle Arc</span>
                                                <input
                                                    type="checkbox"
                                                    checked={!!selectedShape.showSectorAngleArc}
                                                    onChange={e =>
                                                        updateSelected({
                                                            showSectorAngleArc: e.target.checked
                                                        })
                                                    }
                                                    className="rounded text-pink-600"
                                                />
                                            </label>
                                            <div className="flex items-center gap-2 pt-1">
                                                <span className="text-xs text-slate-600">
                                                    Center Angle Label:
                                                </span>
                                                <input
                                                    type="text"
                                                    value={selectedShape.sectorAngleLabel || ''}
                                                    onChange={e =>
                                                        updateSelected({
                                                            sectorAngleLabel: e.target.value,
                                                            showSectorAngleArc: true
                                                        })
                                                    }
                                                    placeholder="e.g. $\theta$ or 110°"
                                                    className="flex-1 border border-slate-300 rounded px-2 py-1 text-xs"
                                                />
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {/* 2A. L-SHAPE CONTROLS */}
                                {selectedShape.type === 'l-shape' && (
                                    <div className="space-y-4">
                                        <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 space-y-2.5">
                                            <div className="grid grid-cols-2 gap-2">
                                                <div>
                                                    <div className="flex justify-between text-[11px] text-slate-600 mb-0.5">
                                                        <span>Total Width</span>
                                                        <span className="tabular-nums">
                                                            {selectedShape.outerWidth}px
                                                        </span>
                                                    </div>
                                                    <input
                                                        type="range"
                                                        min="80"
                                                        max="320"
                                                        value={selectedShape.outerWidth}
                                                        onChange={e => {
                                                            const outerWidth = parseInt(
                                                                e.target.value,
                                                                10
                                                            );
                                                            updateSelected({
                                                                outerWidth,
                                                                cutWidth: Math.min(
                                                                    selectedShape.cutWidth,
                                                                    outerWidth - 25
                                                                )
                                                            });
                                                        }}
                                                        className="w-full accent-pink-600 cursor-pointer"
                                                    />
                                                </div>
                                                <div>
                                                    <div className="flex justify-between text-[11px] text-slate-600 mb-0.5">
                                                        <span>Total Height</span>
                                                        <span className="tabular-nums">
                                                            {selectedShape.outerHeight}px
                                                        </span>
                                                    </div>
                                                    <input
                                                        type="range"
                                                        min="80"
                                                        max="320"
                                                        value={selectedShape.outerHeight}
                                                        onChange={e => {
                                                            const outerHeight = parseInt(
                                                                e.target.value,
                                                                10
                                                            );
                                                            updateSelected({
                                                                outerHeight,
                                                                cutHeight: Math.min(
                                                                    selectedShape.cutHeight,
                                                                    outerHeight - 25
                                                                )
                                                            });
                                                        }}
                                                        className="w-full accent-pink-600 cursor-pointer"
                                                    />
                                                </div>
                                                <div>
                                                    <div className="flex justify-between text-[11px] text-slate-600 mb-0.5">
                                                        <span>Cutout Width</span>
                                                        <span className="tabular-nums">
                                                            {selectedShape.cutWidth}px
                                                        </span>
                                                    </div>
                                                    <input
                                                        type="range"
                                                        min="25"
                                                        max={Math.max(
                                                            30,
                                                            selectedShape.outerWidth - 25
                                                        )}
                                                        value={selectedShape.cutWidth}
                                                        onChange={e =>
                                                            updateSelected({
                                                                cutWidth: parseInt(
                                                                    e.target.value,
                                                                    10
                                                                )
                                                            })
                                                        }
                                                        className="w-full accent-pink-600 cursor-pointer"
                                                    />
                                                </div>
                                                <div>
                                                    <div className="flex justify-between text-[11px] text-slate-600 mb-0.5">
                                                        <span>Cutout Height</span>
                                                        <span className="tabular-nums">
                                                            {selectedShape.cutHeight}px
                                                        </span>
                                                    </div>
                                                    <input
                                                        type="range"
                                                        min="25"
                                                        max={Math.max(
                                                            30,
                                                            selectedShape.outerHeight - 25
                                                        )}
                                                        value={selectedShape.cutHeight}
                                                        onChange={e =>
                                                            updateSelected({
                                                                cutHeight: parseInt(
                                                                    e.target.value,
                                                                    10
                                                                )
                                                            })
                                                        }
                                                        className="w-full accent-pink-600 cursor-pointer"
                                                    />
                                                </div>
                                            </div>
                                        </div>

                                        <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 space-y-2.5">
                                            <span className="text-xs font-semibold text-slate-700 block">
                                                Scaffolding Split Lines (Dashed)
                                            </span>
                                            <div className="grid grid-cols-2 gap-1.5">
                                                {(
                                                    [
                                                        ['none', 'None'],
                                                        ['vertical', 'Vertical Split'],
                                                        ['horizontal', 'Horizontal Split'],
                                                        ['both', 'Both Splits']
                                                    ] as const
                                                ).map(([mode, lbl]) => (
                                                    <button
                                                        key={mode}
                                                        onClick={() =>
                                                            updateSelected({
                                                                scaffoldingMode: mode
                                                            })
                                                        }
                                                        className={`py-1.5 text-xs font-medium rounded border ${
                                                            selectedShape.scaffoldingMode === mode
                                                                ? 'bg-pink-600 text-white border-pink-600'
                                                                : 'bg-white text-slate-600 border-slate-200'
                                                        }`}
                                                    >
                                                        {lbl}
                                                    </button>
                                                ))}
                                            </div>
                                        </div>

                                        {/* Missing Dimensions Toggles */}
                                        <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 space-y-2">
                                            <span className="text-xs font-semibold text-slate-700 block">
                                                Missing Dimensions (Hide Side Labels)
                                            </span>
                                            <div className="grid grid-cols-3 gap-1.5">
                                                {[
                                                    'Top Leg',
                                                    'Inner Vert',
                                                    'Inner Horiz',
                                                    'Right Leg',
                                                    'Bottom',
                                                    'Left'
                                                ].map((sideName, idx) => {
                                                    const isHidden =
                                                        selectedShape.hiddenDimensions?.includes(
                                                            idx
                                                        );
                                                    return (
                                                        <button
                                                            key={idx}
                                                            onClick={() => {
                                                                const cur =
                                                                    selectedShape.hiddenDimensions ||
                                                                    [];
                                                                const next = isHidden
                                                                    ? cur.filter(i => i !== idx)
                                                                    : [...cur, idx];
                                                                updateSelected({
                                                                    hiddenDimensions: next
                                                                });
                                                            }}
                                                            className={`px-2 py-1 text-[11px] rounded border flex items-center justify-between ${
                                                                isHidden
                                                                    ? 'bg-red-50 text-red-700 border-red-200'
                                                                    : 'bg-white text-slate-700 border-slate-200'
                                                            }`}
                                                        >
                                                            <span>{sideName}</span>
                                                            {isHidden ? (
                                                                <EyeOff size={11} />
                                                            ) : (
                                                                <Eye size={11} />
                                                            )}
                                                        </button>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {/* 2B. STADIUM / TRACK CONTROLS */}
                                {selectedShape.type === 'stadium' && (
                                    <div className="space-y-4">
                                        <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 space-y-2.5">
                                            <div className="grid grid-cols-2 gap-2">
                                                <div>
                                                    <div className="flex justify-between text-[11px] text-slate-600 mb-0.5">
                                                        <span>Straight Width</span>
                                                        <span className="tabular-nums">
                                                            {selectedShape.rectWidth}px
                                                        </span>
                                                    </div>
                                                    <input
                                                        type="range"
                                                        min="30"
                                                        max="260"
                                                        value={selectedShape.rectWidth}
                                                        onChange={e =>
                                                            updateSelected({
                                                                rectWidth: parseInt(
                                                                    e.target.value,
                                                                    10
                                                                )
                                                            })
                                                        }
                                                        className="w-full accent-pink-600 cursor-pointer"
                                                    />
                                                </div>
                                                <div>
                                                    <div className="flex justify-between text-[11px] text-slate-600 mb-0.5">
                                                        <span>Height (2r)</span>
                                                        <span className="tabular-nums">
                                                            {selectedShape.rectHeight}px
                                                        </span>
                                                    </div>
                                                    <input
                                                        type="range"
                                                        min="40"
                                                        max="220"
                                                        value={selectedShape.rectHeight}
                                                        onChange={e =>
                                                            updateSelected({
                                                                rectHeight: parseInt(
                                                                    e.target.value,
                                                                    10
                                                                )
                                                            })
                                                        }
                                                        className="w-full accent-pink-600 cursor-pointer"
                                                    />
                                                </div>
                                            </div>
                                            <label className="flex items-center justify-between text-xs text-slate-700 cursor-pointer pt-1">
                                                <span>Internal Semicircle Dividers</span>
                                                <input
                                                    type="checkbox"
                                                    checked={selectedShape.showInternalDividers}
                                                    onChange={e =>
                                                        updateSelected({
                                                            showInternalDividers: e.target.checked
                                                        })
                                                    }
                                                    className="rounded text-pink-600"
                                                />
                                            </label>
                                            <label className="flex items-center justify-between text-xs text-slate-700 cursor-pointer">
                                                <span>Show Semicircle Radius ($r = h/2$)</span>
                                                <input
                                                    type="checkbox"
                                                    checked={selectedShape.showRadiusLine}
                                                    onChange={e =>
                                                        updateSelected({
                                                            showRadiusLine: e.target.checked
                                                        })
                                                    }
                                                    className="rounded text-pink-600"
                                                />
                                            </label>
                                            <label className="flex items-center justify-between text-xs text-slate-700 cursor-pointer">
                                                <span>Shade Outer Track Ring</span>
                                                <input
                                                    type="checkbox"
                                                    checked={selectedShape.shadeTrackRing}
                                                    onChange={e =>
                                                        updateSelected({
                                                            shadeTrackRing: e.target.checked
                                                        })
                                                    }
                                                    className="rounded text-pink-600"
                                                />
                                            </label>
                                        </div>

                                        <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 space-y-2.5">
                                            <div>
                                                <div className="flex justify-between text-xs font-semibold text-slate-700 mb-1">
                                                    <span>Concentric Track Lanes</span>
                                                    <span className="tabular-nums text-pink-600">
                                                        {selectedShape.concentricLanes}
                                                    </span>
                                                </div>
                                                <input
                                                    type="range"
                                                    min="0"
                                                    max="4"
                                                    step="1"
                                                    value={selectedShape.concentricLanes}
                                                    onChange={e =>
                                                        updateSelected({
                                                            concentricLanes: parseInt(
                                                                e.target.value,
                                                                10
                                                            )
                                                        })
                                                    }
                                                    className="w-full accent-pink-600 cursor-pointer"
                                                />
                                            </div>
                                            {(selectedShape.concentricLanes > 0 ||
                                                selectedShape.shadeTrackRing) && (
                                                <div>
                                                    <div className="flex justify-between text-xs text-slate-600 mb-1">
                                                        <span>Lane Width</span>
                                                        <span className="tabular-nums">
                                                            {selectedShape.laneWidth}px
                                                        </span>
                                                    </div>
                                                    <input
                                                        type="range"
                                                        min="8"
                                                        max="35"
                                                        value={selectedShape.laneWidth}
                                                        onChange={e =>
                                                            updateSelected({
                                                                laneWidth: parseInt(
                                                                    e.target.value,
                                                                    10
                                                                )
                                                            })
                                                        }
                                                        className="w-full accent-pink-600 cursor-pointer"
                                                    />
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                )}

                                {/* 2C. ANNULUS CONTROLS */}
                                {selectedShape.type === 'annulus' && (
                                    <div className="space-y-4">
                                        <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 space-y-2.5">
                                            <div className="grid grid-cols-2 gap-2">
                                                <div>
                                                    <div className="flex justify-between text-[11px] text-slate-600 mb-0.5">
                                                        <span>Outer Radius (R)</span>
                                                        <span className="tabular-nums">
                                                            {selectedShape.outerRadius}px
                                                        </span>
                                                    </div>
                                                    <input
                                                        type="range"
                                                        min="45"
                                                        max="200"
                                                        value={selectedShape.outerRadius}
                                                        onChange={e => {
                                                            const outerRadius = parseInt(
                                                                e.target.value,
                                                                10
                                                            );
                                                            updateSelected({
                                                                outerRadius,
                                                                innerRadius: Math.min(
                                                                    selectedShape.innerRadius,
                                                                    outerRadius - 10
                                                                )
                                                            });
                                                        }}
                                                        className="w-full accent-pink-600 cursor-pointer"
                                                    />
                                                </div>
                                                <div>
                                                    <div className="flex justify-between text-[11px] text-slate-600 mb-0.5">
                                                        <span>Inner Radius (r)</span>
                                                        <span className="tabular-nums">
                                                            {selectedShape.innerRadius}px
                                                        </span>
                                                    </div>
                                                    <input
                                                        type="range"
                                                        min="15"
                                                        max={Math.max(
                                                            20,
                                                            selectedShape.outerRadius - 10
                                                        )}
                                                        value={selectedShape.innerRadius}
                                                        onChange={e =>
                                                            updateSelected({
                                                                innerRadius: parseInt(
                                                                    e.target.value,
                                                                    10
                                                                )
                                                            })
                                                        }
                                                        className="w-full accent-pink-600 cursor-pointer"
                                                    />
                                                </div>
                                            </div>
                                            <label className="flex items-center justify-between text-xs text-slate-700 cursor-pointer pt-1">
                                                <span>Shade Donut Region ($R^2 - r^2$)</span>
                                                <input
                                                    type="checkbox"
                                                    checked={selectedShape.shadeRing}
                                                    onChange={e =>
                                                        updateSelected({
                                                            shadeRing: e.target.checked
                                                        })
                                                    }
                                                    className="rounded text-pink-600"
                                                />
                                            </label>
                                            <label className="flex items-center justify-between text-xs text-slate-700 cursor-pointer">
                                                <span>Show Outer Radius ($R$)</span>
                                                <input
                                                    type="checkbox"
                                                    checked={selectedShape.showOuterRadiusLine}
                                                    onChange={e =>
                                                        updateSelected({
                                                            showOuterRadiusLine: e.target.checked
                                                        })
                                                    }
                                                    className="rounded text-pink-600"
                                                />
                                            </label>
                                            <label className="flex items-center justify-between text-xs text-slate-700 cursor-pointer">
                                                <span>Show Inner Radius ($r$)</span>
                                                <input
                                                    type="checkbox"
                                                    checked={selectedShape.showInnerRadiusLine}
                                                    onChange={e =>
                                                        updateSelected({
                                                            showInnerRadiusLine: e.target.checked
                                                        })
                                                    }
                                                    className="rounded text-pink-600"
                                                />
                                            </label>
                                        </div>
                                    </div>
                                )}

                                {/* 2D. HOUSE SHAPE CONTROLS */}
                                {selectedShape.type === 'house' && (
                                    <div className="space-y-4">
                                        <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 space-y-2.5">
                                            <div className="grid grid-cols-2 gap-2">
                                                <div>
                                                    <div className="flex justify-between text-[11px] text-slate-600 mb-0.5">
                                                        <span>Base Width</span>
                                                        <span className="tabular-nums">
                                                            {selectedShape.baseWidth}px
                                                        </span>
                                                    </div>
                                                    <input
                                                        type="range"
                                                        min="60"
                                                        max="260"
                                                        value={selectedShape.baseWidth}
                                                        onChange={e =>
                                                            updateSelected({
                                                                baseWidth: parseInt(
                                                                    e.target.value,
                                                                    10
                                                                )
                                                            })
                                                        }
                                                        className="w-full accent-pink-600 cursor-pointer"
                                                    />
                                                </div>
                                                <div>
                                                    <div className="flex justify-between text-[11px] text-slate-600 mb-0.5">
                                                        <span>Wall Height</span>
                                                        <span className="tabular-nums">
                                                            {selectedShape.baseHeight}px
                                                        </span>
                                                    </div>
                                                    <input
                                                        type="range"
                                                        min="40"
                                                        max="220"
                                                        value={selectedShape.baseHeight}
                                                        onChange={e =>
                                                            updateSelected({
                                                                baseHeight: parseInt(
                                                                    e.target.value,
                                                                    10
                                                                )
                                                            })
                                                        }
                                                        className="w-full accent-pink-600 cursor-pointer"
                                                    />
                                                </div>
                                                <div>
                                                    <div className="flex justify-between text-[11px] text-slate-600 mb-0.5">
                                                        <span>Roof Height</span>
                                                        <span className="tabular-nums">
                                                            {selectedShape.roofHeight}px
                                                        </span>
                                                    </div>
                                                    <input
                                                        type="range"
                                                        min="25"
                                                        max="180"
                                                        value={selectedShape.roofHeight}
                                                        onChange={e =>
                                                            updateSelected({
                                                                roofHeight: parseInt(
                                                                    e.target.value,
                                                                    10
                                                                )
                                                            })
                                                        }
                                                        className="w-full accent-pink-600 cursor-pointer"
                                                    />
                                                </div>
                                                <div>
                                                    <div className="flex justify-between text-[11px] text-slate-600 mb-0.5">
                                                        <span>Roof Overhang</span>
                                                        <span className="tabular-nums">
                                                            {selectedShape.roofOverhang}px
                                                        </span>
                                                    </div>
                                                    <input
                                                        type="range"
                                                        min="0"
                                                        max="60"
                                                        value={selectedShape.roofOverhang}
                                                        onChange={e =>
                                                            updateSelected({
                                                                roofOverhang: parseInt(
                                                                    e.target.value,
                                                                    10
                                                                )
                                                            })
                                                        }
                                                        className="w-full accent-pink-600 cursor-pointer"
                                                    />
                                                </div>
                                            </div>
                                            <label className="flex items-center justify-between text-xs text-slate-700 cursor-pointer pt-1">
                                                <span>External Total Height Dimension</span>
                                                <input
                                                    type="checkbox"
                                                    checked={selectedShape.showTotalHeightDimension}
                                                    onChange={e =>
                                                        updateSelected({
                                                            showTotalHeightDimension:
                                                                e.target.checked
                                                        })
                                                    }
                                                    className="rounded text-pink-600"
                                                />
                                            </label>
                                            <label className="flex items-center justify-between text-xs text-slate-700 cursor-pointer">
                                                <span>Dashed Ceiling Divider Line</span>
                                                <input
                                                    type="checkbox"
                                                    checked={selectedShape.showCeilingLine}
                                                    onChange={e =>
                                                        updateSelected({
                                                            showCeilingLine: e.target.checked
                                                        })
                                                    }
                                                    className="rounded text-pink-600"
                                                />
                                            </label>
                                            <label className="flex items-center justify-between text-xs text-slate-700 cursor-pointer">
                                                <span>Roof Perpendicular Altitude</span>
                                                <input
                                                    type="checkbox"
                                                    checked={selectedShape.showRoofAltitude}
                                                    onChange={e =>
                                                        updateSelected({
                                                            showRoofAltitude: e.target.checked
                                                        })
                                                    }
                                                    className="rounded text-pink-600"
                                                />
                                            </label>
                                        </div>
                                    </div>
                                )}

                                {/* 2E. NORMAN WINDOW (ARCH) CONTROLS */}
                                {selectedShape.type === 'norman-window' && (
                                    <div className="space-y-4">
                                        <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 space-y-2.5">
                                            <div className="grid grid-cols-2 gap-2">
                                                <div>
                                                    <div className="flex justify-between text-[11px] text-slate-600 mb-0.5">
                                                        <span>Base Width (2r)</span>
                                                        <span className="tabular-nums">
                                                            {selectedShape.rectWidth}px
                                                        </span>
                                                    </div>
                                                    <input
                                                        type="range"
                                                        min="50"
                                                        max="260"
                                                        value={selectedShape.rectWidth}
                                                        onChange={e =>
                                                            updateSelected({
                                                                rectWidth: parseInt(
                                                                    e.target.value,
                                                                    10
                                                                )
                                                            })
                                                        }
                                                        className="w-full accent-pink-600 cursor-pointer"
                                                    />
                                                </div>
                                                <div>
                                                    <div className="flex justify-between text-[11px] text-slate-600 mb-0.5">
                                                        <span>Wall Height</span>
                                                        <span className="tabular-nums">
                                                            {selectedShape.rectHeight}px
                                                        </span>
                                                    </div>
                                                    <input
                                                        type="range"
                                                        min="40"
                                                        max="220"
                                                        value={selectedShape.rectHeight}
                                                        onChange={e =>
                                                            updateSelected({
                                                                rectHeight: parseInt(
                                                                    e.target.value,
                                                                    10
                                                                )
                                                            })
                                                        }
                                                        className="w-full accent-pink-600 cursor-pointer"
                                                    />
                                                </div>
                                            </div>
                                            <label className="flex items-center justify-between text-xs text-slate-700 cursor-pointer pt-1">
                                                <span>Dashed Springing Line Divider</span>
                                                <input
                                                    type="checkbox"
                                                    checked={selectedShape.showSpringingLine}
                                                    onChange={e =>
                                                        updateSelected({
                                                            showSpringingLine: e.target.checked
                                                        })
                                                    }
                                                    className="rounded text-pink-600"
                                                />
                                            </label>
                                            <label className="flex items-center justify-between text-xs text-slate-700 cursor-pointer">
                                                <span>Show Semicircle Radius ($r = w/2$)</span>
                                                <input
                                                    type="checkbox"
                                                    checked={selectedShape.showRadiusLine}
                                                    onChange={e =>
                                                        updateSelected({
                                                            showRadiusLine: e.target.checked
                                                        })
                                                    }
                                                    className="rounded text-pink-600"
                                                />
                                            </label>
                                            <label className="flex items-center justify-between text-xs text-slate-700 cursor-pointer">
                                                <span>External Total Height Dimension</span>
                                                <input
                                                    type="checkbox"
                                                    checked={selectedShape.showTotalHeightDimension}
                                                    onChange={e =>
                                                        updateSelected({
                                                            showTotalHeightDimension:
                                                                e.target.checked
                                                        })
                                                    }
                                                    className="rounded text-pink-600"
                                                />
                                            </label>
                                        </div>
                                    </div>
                                )}

                                {/* 2F. INSCRIBED TARGET (CIRCLE INSIDE A SQUARE) CONTROLS */}
                                {selectedShape.type === 'inscribed-circle' && (
                                    <div className="space-y-4">
                                        <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 space-y-2.5">
                                            <div>
                                                <div className="flex justify-between text-[11px] text-slate-600 mb-0.5">
                                                    <span>Square Side Length ($s = 2r$)</span>
                                                    <span className="tabular-nums">
                                                        {selectedShape.squareSize}px
                                                    </span>
                                                </div>
                                                <input
                                                    type="range"
                                                    min="60"
                                                    max="260"
                                                    value={selectedShape.squareSize}
                                                    onChange={e =>
                                                        updateSelected({
                                                            squareSize: parseInt(e.target.value, 10)
                                                        })
                                                    }
                                                    className="w-full accent-pink-600 cursor-pointer"
                                                />
                                            </div>

                                            <div className="space-y-1.5 pt-1">
                                                <span className="text-xs font-semibold text-slate-700 block">
                                                    Shaded Region Mode
                                                </span>
                                                <div className="grid grid-cols-3 gap-1">
                                                    {(
                                                        [
                                                            ['corners', 'Corners (s²−πr²)'],
                                                            ['circle', 'Circle (πr²)'],
                                                            ['none', 'None']
                                                        ] as const
                                                    ).map(([mode, lbl]) => (
                                                        <button
                                                            key={mode}
                                                            onClick={() =>
                                                                updateSelected({ shadeMode: mode })
                                                            }
                                                            className={`py-1.5 px-1 text-[11px] font-medium rounded border ${
                                                                selectedShape.shadeMode === mode
                                                                    ? 'bg-pink-600 text-white border-pink-600'
                                                                    : 'bg-white text-slate-600 border-slate-200'
                                                            }`}
                                                        >
                                                            {lbl}
                                                        </button>
                                                    ))}
                                                </div>
                                            </div>

                                            <label className="flex items-center justify-between text-xs text-slate-700 cursor-pointer pt-1">
                                                <span>Show Circle Radius ($r$)</span>
                                                <input
                                                    type="checkbox"
                                                    checked={selectedShape.showRadiusLine}
                                                    onChange={e =>
                                                        updateSelected({
                                                            showRadiusLine: e.target.checked
                                                        })
                                                    }
                                                    className="rounded text-pink-600"
                                                />
                                            </label>
                                            <label className="flex items-center justify-between text-xs text-slate-700 cursor-pointer">
                                                <span>Show Full Diameter ($d = s$)</span>
                                                <input
                                                    type="checkbox"
                                                    checked={selectedShape.showDiameterLine}
                                                    onChange={e =>
                                                        updateSelected({
                                                            showDiameterLine: e.target.checked
                                                        })
                                                    }
                                                    className="rounded text-pink-600"
                                                />
                                            </label>
                                            <label className="flex items-center justify-between text-xs text-slate-700 cursor-pointer">
                                                <span>Show 4 Square Corner Right Angles</span>
                                                <input
                                                    type="checkbox"
                                                    checked={selectedShape.showRightAngles}
                                                    onChange={e =>
                                                        updateSelected({
                                                            showRightAngles: e.target.checked
                                                        })
                                                    }
                                                    className="rounded text-pink-600"
                                                />
                                            </label>
                                        </div>
                                    </div>
                                )}

                                {/* 3A. PRISM & CUBE CONTROLS */}
                                {selectedShape.type === 'prism' && (
                                    <div className="space-y-4">
                                        <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 space-y-2.5">
                                            <div className="grid grid-cols-2 gap-1.5 pb-1">
                                                <button
                                                    onClick={() =>
                                                        updateSelected({
                                                            width: 140,
                                                            height: 100,
                                                            depthX: 55,
                                                            depthY: -40
                                                        })
                                                    }
                                                    className="py-1 text-xs font-medium bg-white border border-slate-200 rounded text-slate-700 hover:bg-pink-50"
                                                >
                                                    Cuboid Preset
                                                </button>
                                                <button
                                                    onClick={() =>
                                                        updateSelected({
                                                            width: 120,
                                                            height: 120,
                                                            depthX: 50,
                                                            depthY: -40
                                                        })
                                                    }
                                                    className="py-1 text-xs font-medium bg-white border border-slate-200 rounded text-slate-700 hover:bg-pink-50"
                                                >
                                                    Cube Preset
                                                </button>
                                            </div>
                                            <div className="grid grid-cols-2 gap-2">
                                                <div>
                                                    <div className="flex justify-between text-[11px] text-slate-600 mb-0.5">
                                                        <span>Width</span>
                                                        <span className="tabular-nums">
                                                            {selectedShape.width}px
                                                        </span>
                                                    </div>
                                                    <input
                                                        type="range"
                                                        min="40"
                                                        max="240"
                                                        value={selectedShape.width}
                                                        onChange={e =>
                                                            updateSelected({
                                                                width: parseInt(e.target.value, 10)
                                                            })
                                                        }
                                                        className="w-full accent-pink-600 cursor-pointer"
                                                    />
                                                </div>
                                                <div>
                                                    <div className="flex justify-between text-[11px] text-slate-600 mb-0.5">
                                                        <span>Height</span>
                                                        <span className="tabular-nums">
                                                            {selectedShape.height}px
                                                        </span>
                                                    </div>
                                                    <input
                                                        type="range"
                                                        min="40"
                                                        max="240"
                                                        value={selectedShape.height}
                                                        onChange={e =>
                                                            updateSelected({
                                                                height: parseInt(e.target.value, 10)
                                                            })
                                                        }
                                                        className="w-full accent-pink-600 cursor-pointer"
                                                    />
                                                </div>
                                                <div>
                                                    <div className="flex justify-between text-[11px] text-slate-600 mb-0.5">
                                                        <span>Depth X</span>
                                                        <span className="tabular-nums">
                                                            {selectedShape.depthX}px
                                                        </span>
                                                    </div>
                                                    <input
                                                        type="range"
                                                        min="-100"
                                                        max="120"
                                                        value={selectedShape.depthX}
                                                        onChange={e =>
                                                            updateSelected({
                                                                depthX: parseInt(e.target.value, 10)
                                                            })
                                                        }
                                                        className="w-full accent-pink-600 cursor-pointer"
                                                    />
                                                </div>
                                                <div>
                                                    <div className="flex justify-between text-[11px] text-slate-600 mb-0.5">
                                                        <span>Depth Y</span>
                                                        <span className="tabular-nums">
                                                            {selectedShape.depthY}px
                                                        </span>
                                                    </div>
                                                    <input
                                                        type="range"
                                                        min="-100"
                                                        max="80"
                                                        value={selectedShape.depthY}
                                                        onChange={e =>
                                                            updateSelected({
                                                                depthY: parseInt(e.target.value, 10)
                                                            })
                                                        }
                                                        className="w-full accent-pink-600 cursor-pointer"
                                                    />
                                                </div>
                                            </div>
                                            <label className="flex items-center justify-between text-xs text-slate-700 cursor-pointer pt-1">
                                                <span>Hidden Rear Edges (Dashed)</span>
                                                <input
                                                    type="checkbox"
                                                    checked={selectedShape.showHiddenLines}
                                                    onChange={e =>
                                                        updateSelected({
                                                            showHiddenLines: e.target.checked
                                                        })
                                                    }
                                                    className="rounded text-pink-600"
                                                />
                                            </label>
                                            <label className="flex items-center justify-between text-xs text-slate-700 cursor-pointer">
                                                <span>Base Diagonal Line</span>
                                                <input
                                                    type="checkbox"
                                                    checked={selectedShape.showBaseDiagonal}
                                                    onChange={e =>
                                                        updateSelected({
                                                            showBaseDiagonal: e.target.checked
                                                        })
                                                    }
                                                    className="rounded text-pink-600"
                                                />
                                            </label>
                                            <label className="flex items-center justify-between text-xs text-slate-700 cursor-pointer">
                                                <span>3D Space Diagonal (Red Dashed)</span>
                                                <input
                                                    type="checkbox"
                                                    checked={selectedShape.showSpaceDiagonal}
                                                    onChange={e =>
                                                        updateSelected({
                                                            showSpaceDiagonal: e.target.checked
                                                        })
                                                    }
                                                    className="rounded text-pink-600"
                                                />
                                            </label>
                                            <label className="flex items-center justify-between text-xs text-slate-700 cursor-pointer">
                                                <span>Full 3D Pythagoras Triangle + 90°</span>
                                                <input
                                                    type="checkbox"
                                                    checked={selectedShape.showPythagorasTriangle}
                                                    onChange={e =>
                                                        updateSelected({
                                                            showPythagorasTriangle:
                                                                e.target.checked,
                                                            showBaseDiagonal: e.target.checked,
                                                            showSpaceDiagonal: e.target.checked
                                                        })
                                                    }
                                                    className="rounded text-pink-600"
                                                />
                                            </label>
                                        </div>

                                        <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 space-y-2">
                                            <div className="flex items-center justify-between">
                                                <span className="text-xs font-semibold text-slate-700">
                                                    Shade Faces (or click on canvas)
                                                </span>
                                                {selectedShape.shadedFaces.length > 0 && (
                                                    <button
                                                        onClick={() =>
                                                            updateSelected({ shadedFaces: [] })
                                                        }
                                                        className="text-[10px] text-pink-600 hover:underline font-medium"
                                                    >
                                                        Clear
                                                    </button>
                                                )}
                                            </div>
                                            <div className="grid grid-cols-3 gap-1.5">
                                                {(
                                                    [
                                                        'front',
                                                        'top',
                                                        'right',
                                                        'bottom',
                                                        'left',
                                                        'back'
                                                    ] as const
                                                ).map(face => {
                                                    const active =
                                                        selectedShape.shadedFaces.includes(face);
                                                    return (
                                                        <button
                                                            key={face}
                                                            onClick={() =>
                                                                handleFaceClick(
                                                                    selectedShape.id,
                                                                    face
                                                                )
                                                            }
                                                            className={`py-1 text-xs font-medium rounded border capitalize ${
                                                                active
                                                                    ? 'bg-pink-600 text-white border-pink-600'
                                                                    : 'bg-white text-slate-600 border-slate-200'
                                                            }`}
                                                        >
                                                            {face}
                                                        </button>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {/* 3B. CYLINDER CONTROLS */}
                                {selectedShape.type === 'cylinder' && (
                                    <div className="space-y-4">
                                        <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 space-y-2.5">
                                            <div className="grid grid-cols-3 gap-2">
                                                <div>
                                                    <div className="flex justify-between text-[11px] text-slate-600 mb-0.5">
                                                        <span>Radius</span>
                                                        <span className="tabular-nums">
                                                            {selectedShape.radius}
                                                        </span>
                                                    </div>
                                                    <input
                                                        type="range"
                                                        min="25"
                                                        max="160"
                                                        value={selectedShape.radius}
                                                        onChange={e =>
                                                            updateSelected({
                                                                radius: parseInt(e.target.value, 10)
                                                            })
                                                        }
                                                        className="w-full accent-pink-600 cursor-pointer"
                                                    />
                                                </div>
                                                <div>
                                                    <div className="flex justify-between text-[11px] text-slate-600 mb-0.5">
                                                        <span>Height</span>
                                                        <span className="tabular-nums">
                                                            {selectedShape.height}
                                                        </span>
                                                    </div>
                                                    <input
                                                        type="range"
                                                        min="40"
                                                        max="260"
                                                        value={selectedShape.height}
                                                        onChange={e =>
                                                            updateSelected({
                                                                height: parseInt(e.target.value, 10)
                                                            })
                                                        }
                                                        className="w-full accent-pink-600 cursor-pointer"
                                                    />
                                                </div>
                                                <div>
                                                    <div className="flex justify-between text-[11px] text-slate-600 mb-0.5">
                                                        <span>Tilt</span>
                                                        <span className="tabular-nums">
                                                            {selectedShape.ellipseRy}
                                                        </span>
                                                    </div>
                                                    <input
                                                        type="range"
                                                        min="8"
                                                        max="70"
                                                        value={selectedShape.ellipseRy}
                                                        onChange={e =>
                                                            updateSelected({
                                                                ellipseRy: parseInt(
                                                                    e.target.value,
                                                                    10
                                                                )
                                                            })
                                                        }
                                                        className="w-full accent-pink-600 cursor-pointer"
                                                    />
                                                </div>
                                            </div>
                                            <span className="text-xs font-semibold text-slate-700 block pt-1">
                                                Rear Bottom Curve Visibility
                                            </span>
                                            <div className="grid grid-cols-3 gap-1">
                                                {(
                                                    [
                                                        ['dashed', 'Dashed'],
                                                        ['solid', 'Solid'],
                                                        ['hidden', 'Opaque']
                                                    ] as [RearCurveMode, string][]
                                                ).map(([mode, lbl]) => (
                                                    <button
                                                        key={mode}
                                                        onClick={() =>
                                                            updateSelected({ rearCurveMode: mode })
                                                        }
                                                        className={`py-1 text-xs font-medium rounded border ${
                                                            selectedShape.rearCurveMode === mode
                                                                ? 'bg-pink-600 text-white border-pink-600'
                                                                : 'bg-white text-slate-600 border-slate-200'
                                                        }`}
                                                    >
                                                        {lbl}
                                                    </button>
                                                ))}
                                            </div>
                                            <label className="flex items-center justify-between text-xs text-slate-700 cursor-pointer pt-1">
                                                <span>Top Radius Line ($r$)</span>
                                                <input
                                                    type="checkbox"
                                                    checked={selectedShape.showTopRadius}
                                                    onChange={e =>
                                                        updateSelected({
                                                            showTopRadius: e.target.checked,
                                                            showTopDiameter: e.target.checked
                                                                ? false
                                                                : selectedShape.showTopDiameter
                                                        })
                                                    }
                                                    className="rounded text-pink-600"
                                                />
                                            </label>
                                            <label className="flex items-center justify-between text-xs text-slate-700 cursor-pointer">
                                                <span>Top Full Diameter ($d$)</span>
                                                <input
                                                    type="checkbox"
                                                    checked={selectedShape.showTopDiameter}
                                                    onChange={e =>
                                                        updateSelected({
                                                            showTopDiameter: e.target.checked,
                                                            showTopRadius: e.target.checked
                                                                ? false
                                                                : selectedShape.showTopRadius
                                                        })
                                                    }
                                                    className="rounded text-pink-600"
                                                />
                                            </label>
                                            <label className="flex items-center justify-between text-xs text-slate-700 cursor-pointer">
                                                <span>Vertical Height Bracket ($h$)</span>
                                                <input
                                                    type="checkbox"
                                                    checked={selectedShape.showHeightDimension}
                                                    onChange={e =>
                                                        updateSelected({
                                                            showHeightDimension: e.target.checked
                                                        })
                                                    }
                                                    className="rounded text-pink-600"
                                                />
                                            </label>
                                        </div>
                                    </div>
                                )}

                                {/* 3C. CONE CONTROLS */}
                                {selectedShape.type === 'cone' && (
                                    <div className="space-y-4">
                                        <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 space-y-2.5">
                                            <div className="grid grid-cols-3 gap-2">
                                                <div>
                                                    <div className="flex justify-between text-[11px] text-slate-600 mb-0.5">
                                                        <span>Radius</span>
                                                        <span className="tabular-nums">
                                                            {selectedShape.radius}
                                                        </span>
                                                    </div>
                                                    <input
                                                        type="range"
                                                        min="25"
                                                        max="160"
                                                        value={selectedShape.radius}
                                                        onChange={e =>
                                                            updateSelected({
                                                                radius: parseInt(e.target.value, 10)
                                                            })
                                                        }
                                                        className="w-full accent-pink-600 cursor-pointer"
                                                    />
                                                </div>
                                                <div>
                                                    <div className="flex justify-between text-[11px] text-slate-600 mb-0.5">
                                                        <span>Height</span>
                                                        <span className="tabular-nums">
                                                            {selectedShape.height}
                                                        </span>
                                                    </div>
                                                    <input
                                                        type="range"
                                                        min="40"
                                                        max="260"
                                                        value={selectedShape.height}
                                                        onChange={e =>
                                                            updateSelected({
                                                                height: parseInt(e.target.value, 10)
                                                            })
                                                        }
                                                        className="w-full accent-pink-600 cursor-pointer"
                                                    />
                                                </div>
                                                <div>
                                                    <div className="flex justify-between text-[11px] text-slate-600 mb-0.5">
                                                        <span>Tilt</span>
                                                        <span className="tabular-nums">
                                                            {selectedShape.ellipseRy}
                                                        </span>
                                                    </div>
                                                    <input
                                                        type="range"
                                                        min="8"
                                                        max="70"
                                                        value={selectedShape.ellipseRy}
                                                        onChange={e =>
                                                            updateSelected({
                                                                ellipseRy: parseInt(
                                                                    e.target.value,
                                                                    10
                                                                )
                                                            })
                                                        }
                                                        className="w-full accent-pink-600 cursor-pointer"
                                                    />
                                                </div>
                                            </div>
                                            <div>
                                                <div className="flex justify-between text-[11px] text-slate-600 mb-0.5">
                                                    <span>Apex Offset (Right vs Oblique)</span>
                                                    <span className="tabular-nums">
                                                        {selectedShape.apexOffsetX}px
                                                    </span>
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    <input
                                                        type="range"
                                                        min="-120"
                                                        max="120"
                                                        value={selectedShape.apexOffsetX}
                                                        onChange={e =>
                                                            updateSelected({
                                                                apexOffsetX: parseInt(
                                                                    e.target.value,
                                                                    10
                                                                )
                                                            })
                                                        }
                                                        className="flex-1 accent-pink-600 cursor-pointer"
                                                    />
                                                    {selectedShape.apexOffsetX !== 0 && (
                                                        <button
                                                            onClick={() =>
                                                                updateSelected({ apexOffsetX: 0 })
                                                            }
                                                            className="px-2 py-0.5 text-[10px] bg-white border border-slate-200 rounded text-slate-600 hover:bg-slate-100"
                                                        >
                                                            Center
                                                        </button>
                                                    )}
                                                </div>
                                            </div>
                                            <label className="flex items-center justify-between text-xs text-slate-700 cursor-pointer pt-1">
                                                <span>Perpendicular Height ($h$ + 90°)</span>
                                                <input
                                                    type="checkbox"
                                                    checked={selectedShape.showPerpendicularHeight}
                                                    onChange={e =>
                                                        updateSelected({
                                                            showPerpendicularHeight:
                                                                e.target.checked
                                                        })
                                                    }
                                                    className="rounded text-pink-600"
                                                />
                                            </label>
                                            <label className="flex items-center justify-between text-xs text-slate-700 cursor-pointer">
                                                <span>External Slant Height ($l$)</span>
                                                <input
                                                    type="checkbox"
                                                    checked={selectedShape.showSlantHeightDimension}
                                                    onChange={e =>
                                                        updateSelected({
                                                            showSlantHeightDimension:
                                                                e.target.checked
                                                        })
                                                    }
                                                    className="rounded text-pink-600"
                                                />
                                            </label>
                                            <label className="flex items-center justify-between text-xs text-slate-700 cursor-pointer">
                                                <span>Base Radius ($r$)</span>
                                                <input
                                                    type="checkbox"
                                                    checked={selectedShape.showBaseRadius}
                                                    onChange={e =>
                                                        updateSelected({
                                                            showBaseRadius: e.target.checked
                                                        })
                                                    }
                                                    className="rounded text-pink-600"
                                                />
                                            </label>
                                            <label className="flex items-center justify-between text-xs text-slate-700 cursor-pointer">
                                                <span>Shade Internal Right Triangle</span>
                                                <input
                                                    type="checkbox"
                                                    checked={selectedShape.shadeInternalTriangle}
                                                    onChange={e =>
                                                        updateSelected({
                                                            shadeInternalTriangle: e.target.checked
                                                        })
                                                    }
                                                    className="rounded text-pink-600"
                                                />
                                            </label>
                                        </div>
                                    </div>
                                )}

                                {/* 3D. SPHERE & HEMISPHERE CONTROLS */}
                                {selectedShape.type === 'sphere' && (
                                    <div className="space-y-4">
                                        <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 space-y-2.5">
                                            <div className="grid grid-cols-2 gap-2">
                                                <div>
                                                    <div className="flex justify-between text-[11px] text-slate-600 mb-0.5">
                                                        <span>Sphere Radius</span>
                                                        <span className="tabular-nums">
                                                            {selectedShape.radius}px
                                                        </span>
                                                    </div>
                                                    <input
                                                        type="range"
                                                        min="30"
                                                        max="180"
                                                        value={selectedShape.radius}
                                                        onChange={e =>
                                                            updateSelected({
                                                                radius: parseInt(e.target.value, 10)
                                                            })
                                                        }
                                                        className="w-full accent-pink-600 cursor-pointer"
                                                    />
                                                </div>
                                                <div>
                                                    <div className="flex justify-between text-[11px] text-slate-600 mb-0.5">
                                                        <span>Equator Tilt</span>
                                                        <span className="tabular-nums">
                                                            {selectedShape.equatorRy}px
                                                        </span>
                                                    </div>
                                                    <input
                                                        type="range"
                                                        min="8"
                                                        max="85"
                                                        value={selectedShape.equatorRy}
                                                        onChange={e =>
                                                            updateSelected({
                                                                equatorRy: parseInt(
                                                                    e.target.value,
                                                                    10
                                                                )
                                                            })
                                                        }
                                                        className="w-full accent-pink-600 cursor-pointer"
                                                    />
                                                </div>
                                            </div>
                                            <span className="text-xs font-semibold text-slate-700 block pt-1">
                                                Sphere / Hemisphere Slice
                                            </span>
                                            <div className="grid grid-cols-3 gap-1">
                                                {(
                                                    [
                                                        ['full', 'Full Sphere'],
                                                        ['bottom-hemisphere', 'Bowl (Bot)'],
                                                        ['top-hemisphere', 'Dome (Top)']
                                                    ] as const
                                                ).map(([mode, lbl]) => (
                                                    <button
                                                        key={mode}
                                                        onClick={() =>
                                                            updateSelected({ hemisphereMode: mode })
                                                        }
                                                        className={`py-1.5 text-xs font-medium rounded border ${
                                                            selectedShape.hemisphereMode === mode
                                                                ? 'bg-pink-600 text-white border-pink-600'
                                                                : 'bg-white text-slate-600 border-slate-200'
                                                        }`}
                                                    >
                                                        {lbl}
                                                    </button>
                                                ))}
                                            </div>
                                            <label className="flex items-center justify-between text-xs text-slate-700 cursor-pointer pt-1">
                                                <span>Dashed Rear Equator Curve</span>
                                                <input
                                                    type="checkbox"
                                                    checked={
                                                        selectedShape.rearCurveMode === 'dashed'
                                                    }
                                                    onChange={e =>
                                                        updateSelected({
                                                            rearCurveMode: e.target.checked
                                                                ? 'dashed'
                                                                : 'hidden'
                                                        })
                                                    }
                                                    className="rounded text-pink-600"
                                                />
                                            </label>
                                            <label className="flex items-center justify-between text-xs text-slate-700 cursor-pointer">
                                                <span>Show Radius Line ($r$)</span>
                                                <input
                                                    type="checkbox"
                                                    checked={selectedShape.showRadiusLine}
                                                    onChange={e =>
                                                        updateSelected({
                                                            showRadiusLine: e.target.checked
                                                        })
                                                    }
                                                    className="rounded text-pink-600"
                                                />
                                            </label>
                                        </div>
                                    </div>
                                )}

                                {/* 3E. PYRAMID CONTROLS */}
                                {selectedShape.type === 'pyramid' && (
                                    <div className="space-y-4">
                                        <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 space-y-2.5">
                                            <span className="text-xs font-semibold text-slate-700 block">
                                                Pyramid Base Type
                                            </span>
                                            <div className="grid grid-cols-2 gap-1.5">
                                                <button
                                                    onClick={() =>
                                                        updateSelected({ baseType: 'square' })
                                                    }
                                                    className={`py-1.5 text-xs font-medium rounded border ${
                                                        selectedShape.baseType === 'square'
                                                            ? 'bg-pink-600 text-white border-pink-600'
                                                            : 'bg-white text-slate-600 border-slate-200'
                                                    }`}
                                                >
                                                    Square-Based
                                                </button>
                                                <button
                                                    onClick={() =>
                                                        updateSelected({ baseType: 'triangular' })
                                                    }
                                                    className={`py-1.5 text-xs font-medium rounded border ${
                                                        selectedShape.baseType === 'triangular'
                                                            ? 'bg-pink-600 text-white border-pink-600'
                                                            : 'bg-white text-slate-600 border-slate-200'
                                                    }`}
                                                >
                                                    Triangular-Based
                                                </button>
                                            </div>

                                            <div className="grid grid-cols-2 gap-2 pt-1">
                                                <div>
                                                    <div className="flex justify-between text-[11px] text-slate-600 mb-0.5">
                                                        <span>Base Width</span>
                                                        <span className="tabular-nums">
                                                            {selectedShape.baseWidth}px
                                                        </span>
                                                    </div>
                                                    <input
                                                        type="range"
                                                        min="50"
                                                        max="260"
                                                        value={selectedShape.baseWidth}
                                                        onChange={e =>
                                                            updateSelected({
                                                                baseWidth: parseInt(
                                                                    e.target.value,
                                                                    10
                                                                )
                                                            })
                                                        }
                                                        className="w-full accent-pink-600 cursor-pointer"
                                                    />
                                                </div>
                                                <div>
                                                    <div className="flex justify-between text-[11px] text-slate-600 mb-0.5">
                                                        <span>Height (h)</span>
                                                        <span className="tabular-nums">
                                                            {selectedShape.height}px
                                                        </span>
                                                    </div>
                                                    <input
                                                        type="range"
                                                        min="40"
                                                        max="260"
                                                        value={selectedShape.height}
                                                        onChange={e =>
                                                            updateSelected({
                                                                height: parseInt(e.target.value, 10)
                                                            })
                                                        }
                                                        className="w-full accent-pink-600 cursor-pointer"
                                                    />
                                                </div>
                                                <div>
                                                    <div className="flex justify-between text-[11px] text-slate-600 mb-0.5">
                                                        <span>Depth X</span>
                                                        <span className="tabular-nums">
                                                            {selectedShape.baseDepthX}px
                                                        </span>
                                                    </div>
                                                    <input
                                                        type="range"
                                                        min="-100"
                                                        max="120"
                                                        value={selectedShape.baseDepthX}
                                                        onChange={e =>
                                                            updateSelected({
                                                                baseDepthX: parseInt(
                                                                    e.target.value,
                                                                    10
                                                                )
                                                            })
                                                        }
                                                        className="w-full accent-pink-600 cursor-pointer"
                                                    />
                                                </div>
                                                <div>
                                                    <div className="flex justify-between text-[11px] text-slate-600 mb-0.5">
                                                        <span>Depth Y</span>
                                                        <span className="tabular-nums">
                                                            {selectedShape.baseDepthY}px
                                                        </span>
                                                    </div>
                                                    <input
                                                        type="range"
                                                        min="-100"
                                                        max="80"
                                                        value={selectedShape.baseDepthY}
                                                        onChange={e =>
                                                            updateSelected({
                                                                baseDepthY: parseInt(
                                                                    e.target.value,
                                                                    10
                                                                )
                                                            })
                                                        }
                                                        className="w-full accent-pink-600 cursor-pointer"
                                                    />
                                                </div>
                                            </div>

                                            <div>
                                                <div className="flex justify-between text-[11px] text-slate-600 mb-0.5">
                                                    <span>Apex Offset (Right vs Oblique)</span>
                                                    <span className="tabular-nums">
                                                        {selectedShape.apexOffsetX}px
                                                    </span>
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    <input
                                                        type="range"
                                                        min="-120"
                                                        max="120"
                                                        value={selectedShape.apexOffsetX}
                                                        onChange={e =>
                                                            updateSelected({
                                                                apexOffsetX: parseInt(
                                                                    e.target.value,
                                                                    10
                                                                )
                                                            })
                                                        }
                                                        className="flex-1 accent-pink-600 cursor-pointer"
                                                    />
                                                    {selectedShape.apexOffsetX !== 0 && (
                                                        <button
                                                            onClick={() =>
                                                                updateSelected({ apexOffsetX: 0 })
                                                            }
                                                            className="px-2 py-0.5 text-[10px] bg-white border border-slate-200 rounded text-slate-600 hover:bg-slate-100"
                                                        >
                                                            Center
                                                        </button>
                                                    )}
                                                </div>
                                            </div>

                                            <label className="flex items-center justify-between text-xs text-slate-700 cursor-pointer pt-1">
                                                <span>Hidden Rear Edges (Dashed)</span>
                                                <input
                                                    type="checkbox"
                                                    checked={selectedShape.showHiddenLines}
                                                    onChange={e =>
                                                        updateSelected({
                                                            showHiddenLines: e.target.checked
                                                        })
                                                    }
                                                    className="rounded text-pink-600"
                                                />
                                            </label>
                                            <label className="flex items-center justify-between text-xs text-slate-700 cursor-pointer">
                                                <span>Perpendicular Height ($h$)</span>
                                                <input
                                                    type="checkbox"
                                                    checked={selectedShape.showPerpendicularHeight}
                                                    onChange={e =>
                                                        updateSelected({
                                                            showPerpendicularHeight:
                                                                e.target.checked
                                                        })
                                                    }
                                                    className="rounded text-pink-600"
                                                />
                                            </label>
                                            <label className="flex items-center justify-between text-xs text-slate-700 cursor-pointer">
                                                <span>Base Apothem Line ($a$)</span>
                                                <input
                                                    type="checkbox"
                                                    checked={selectedShape.showApothemLine}
                                                    onChange={e =>
                                                        updateSelected({
                                                            showApothemLine: e.target.checked
                                                        })
                                                    }
                                                    className="rounded text-pink-600"
                                                />
                                            </label>
                                            <label className="flex items-center justify-between text-xs text-slate-700 cursor-pointer">
                                                <span>Slant Height ($l$) + 3D Right Angle</span>
                                                <input
                                                    type="checkbox"
                                                    checked={selectedShape.showSlantHeight}
                                                    onChange={e =>
                                                        updateSelected({
                                                            showSlantHeight: e.target.checked
                                                        })
                                                    }
                                                    className="rounded text-pink-600"
                                                />
                                            </label>
                                            <label className="flex items-center justify-between text-xs text-slate-700 cursor-pointer">
                                                <span>Shade Internal Pythagoras Triangle</span>
                                                <input
                                                    type="checkbox"
                                                    checked={selectedShape.shadeInternalTriangle}
                                                    onChange={e =>
                                                        updateSelected({
                                                            shadeInternalTriangle: e.target.checked
                                                        })
                                                    }
                                                    className="rounded text-pink-600"
                                                />
                                            </label>
                                        </div>

                                        {/* Pyramid Face Shading Controls */}
                                        <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 space-y-2">
                                            <div className="flex items-center justify-between">
                                                <span className="text-xs font-semibold text-slate-700">
                                                    Shade Faces (or click on canvas)
                                                </span>
                                                {(selectedShape.shadedFaces?.length || 0) > 0 && (
                                                    <button
                                                        onClick={() =>
                                                            updateSelected({ shadedFaces: [] })
                                                        }
                                                        className="text-[10px] text-pink-600 hover:underline font-medium"
                                                    >
                                                        Clear
                                                    </button>
                                                )}
                                            </div>
                                            <div className="grid grid-cols-3 gap-1.5">
                                                {(
                                                    [
                                                        [0, 'Front Face'],
                                                        [1, 'Right Face'],
                                                        [2, 'Base']
                                                    ] as [number, string][]
                                                ).map(([faceIdx, faceLabel]) => {
                                                    const active = (
                                                        selectedShape.shadedFaces || []
                                                    ).includes(faceIdx);
                                                    return (
                                                        <button
                                                            key={faceIdx}
                                                            onClick={() =>
                                                                handleFaceClick(
                                                                    selectedShape.id,
                                                                    String(faceIdx)
                                                                )
                                                            }
                                                            className={`py-1 text-xs font-medium rounded border ${
                                                                active
                                                                    ? 'bg-pink-600 text-white border-pink-600'
                                                                    : 'bg-white text-slate-600 border-slate-200'
                                                            }`}
                                                        >
                                                            {faceLabel}
                                                        </button>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {/* =========================================================
                                    SHARED CONTROLS (ROTATION, DIMENSIONS, SHADING, LABELS)
                                   ========================================================= */}
                                <div className="h-px bg-slate-100" />

                                {/* Orientation & Style (Works for all 2D & 3D shapes) */}
                                <div className="space-y-3">
                                    <div className="flex items-center justify-between">
                                        <span className="text-xs font-bold text-slate-700 uppercase tracking-wide flex items-center gap-1.5">
                                            <Sliders size={13} className="text-pink-600" />
                                            Orientation &amp; Style
                                        </span>
                                    </div>

                                    {/* Rotation Slider + Quick Angle Presets */}
                                    <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-200 space-y-2">
                                        <div className="flex items-center gap-2">
                                            <RotateCw size={14} className="text-slate-400" />
                                            <input
                                                type="range"
                                                min="0"
                                                max="360"
                                                step={modifiers.shift ? 15 : 5}
                                                value={selectedShape.rotation}
                                                onChange={e =>
                                                    updateSelected({
                                                        rotation: parseFloat(e.target.value)
                                                    })
                                                }
                                                className="flex-1 accent-pink-600 cursor-pointer"
                                            />
                                            <span className="text-xs font-mono tabular-nums text-slate-600 w-10 text-right">
                                                {selectedShape.rotation}°
                                            </span>
                                        </div>
                                        <div className="grid grid-cols-5 gap-1">
                                            {[0, 45, 90, 180, 270].map(deg => (
                                                <button
                                                    key={deg}
                                                    onClick={() =>
                                                        updateSelected({ rotation: deg })
                                                    }
                                                    className={`py-1 text-[11px] font-mono rounded border ${
                                                        selectedShape.rotation === deg
                                                            ? 'bg-pink-600 text-white border-pink-600'
                                                            : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-100'
                                                    }`}
                                                >
                                                    {deg}°
                                                </button>
                                            ))}
                                        </div>
                                    </div>

                                    {activePolyInfo && (
                                        <label className="flex items-center justify-between text-xs text-slate-700 cursor-pointer bg-slate-50 p-2.5 rounded-lg border border-slate-200">
                                            <span>External Dimension Arrows</span>
                                            <input
                                                type="checkbox"
                                                checked={!!selectedShape.showDimensions}
                                                onChange={e => {
                                                    forceSnapshot();
                                                    updateSelected({
                                                        showDimensions: e.target.checked,
                                                        dimensionPlacement: 'outside'
                                                    });
                                                }}
                                                className="rounded text-pink-600"
                                            />
                                        </label>
                                    )}

                                    {/* Stroke Color & Line Width */}
                                    <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-200 space-y-2">
                                        <div className="flex items-center justify-between">
                                            <span className="text-xs font-medium text-slate-700">
                                                Outline Color &amp; Thickness
                                            </span>
                                            <div className="flex items-center gap-2">
                                                <span className="text-[11px] font-mono text-slate-500">
                                                    {selectedShape.strokeWidth}px
                                                </span>
                                                <input
                                                    type="color"
                                                    value={selectedShape.stroke || '#0f172a'}
                                                    onChange={e =>
                                                        updateSelected({ stroke: e.target.value })
                                                    }
                                                    className="w-6 h-6 rounded border-0 cursor-pointer"
                                                />
                                            </div>
                                        </div>
                                        <input
                                            type="range"
                                            min="1"
                                            max="6"
                                            step="0.5"
                                            value={selectedShape.strokeWidth}
                                            onChange={e =>
                                                updateSelected({
                                                    strokeWidth: parseFloat(e.target.value)
                                                })
                                            }
                                            className="w-full accent-pink-600 cursor-pointer"
                                        />
                                    </div>

                                    {/* Fill / Interior Shading + Opacity */}
                                    <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-200 space-y-2">
                                        <div className="flex items-center justify-between">
                                            <div className="flex items-center gap-2">
                                                <PaintBucket size={14} className="text-pink-600" />
                                                <span className="text-xs font-medium text-slate-700">
                                                    Interior Fill
                                                </span>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                {selectedShape.fill !== 'transparent' && (
                                                    <input
                                                        type="color"
                                                        value={selectedShape.fill}
                                                        onChange={e =>
                                                            updateSelected({ fill: e.target.value })
                                                        }
                                                        className="w-6 h-6 rounded border-0 cursor-pointer"
                                                    />
                                                )}
                                                <input
                                                    type="checkbox"
                                                    checked={selectedShape.fill !== 'transparent'}
                                                    onChange={e => {
                                                        forceSnapshot();
                                                        updateSelected({
                                                            fill: e.target.checked
                                                                ? '#e2e8f0'
                                                                : 'transparent'
                                                        });
                                                    }}
                                                    className="rounded text-pink-600"
                                                />
                                            </div>
                                        </div>
                                        {selectedShape.fill !== 'transparent' && (
                                            <div>
                                                <div className="flex justify-between text-[11px] text-slate-600 mb-0.5">
                                                    <span>Fill Opacity</span>
                                                    <span className="tabular-nums">
                                                        {Math.round(
                                                            (selectedShape.opacity ?? 0.35) * 100
                                                        )}
                                                        %
                                                    </span>
                                                </div>
                                                <input
                                                    type="range"
                                                    min="0.05"
                                                    max="1"
                                                    step="0.05"
                                                    value={selectedShape.opacity ?? 0.35}
                                                    onChange={e =>
                                                        updateSelected({
                                                            opacity: parseFloat(e.target.value)
                                                        })
                                                    }
                                                    className="w-full accent-pink-600 cursor-pointer"
                                                />
                                            </div>
                                        )}
                                    </div>

                                    {/* Region / Face / Sector Highlight Shade Color */}
                                    {([
                                        'polygon',
                                        'circle',
                                        'stadium',
                                        'annulus',
                                        'inscribed-circle',
                                        'prism',
                                        'cone',
                                        'pyramid'
                                    ] as const).includes(selectedShape.type as any) && (
                                        <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-200 flex items-center justify-between">
                                            <span className="text-xs font-medium text-slate-700">
                                                Shaded Region / Face Color
                                            </span>
                                            <input
                                                type="color"
                                                value={
                                                    (selectedShape as any).shadeColor || '#bae6fd'
                                                }
                                                onChange={e =>
                                                    updateSelected({
                                                        shadeColor: e.target.value
                                                    } as any)
                                                }
                                                className="w-6 h-6 rounded border-0 cursor-pointer"
                                            />
                                        </div>
                                    )}
                                </div>

                                <div className="h-px bg-slate-100" />

                                {/* LABELS & MEASUREMENTS EDITOR */}
                                <div className="space-y-3">
                                    <div className="flex items-center justify-between">
                                        <span className="text-xs font-bold text-slate-700 uppercase tracking-wide flex items-center gap-1.5">
                                            <Type size={13} className="text-pink-600" />
                                            Labels (LaTeX Supported)
                                        </span>
                                        <button
                                            onClick={() => addCustomLabel('$x$')}
                                            className="px-2 py-0.5 text-[11px] font-medium bg-pink-50 text-pink-700 border border-pink-200 rounded hover:bg-pink-100 flex items-center gap-1"
                                        >
                                            <Plus size={11} /> Free Label
                                        </button>
                                    </div>

                                    {/* Quick Add Straight-Edge Label with External Dimension Line (<--->) */}
                                    {activeStraightEdges.length > 0 && (
                                        <div className="p-2 bg-slate-50 rounded-lg border border-slate-200 space-y-1.5">
                                            <div className="flex items-center justify-between">
                                                <span className="text-[11px] font-medium text-slate-600">
                                                    Add Straight-Edge Dimension Label (&lt;---&gt;):
                                                </span>
                                            </div>
                                            <div className="flex flex-wrap gap-1">
                                                {activeStraightEdges.map(edge => (
                                                    <button
                                                        key={edge.key}
                                                        onClick={() =>
                                                            addEdgeDimensionLabel(
                                                                edge.key,
                                                                edge.edgeIndex,
                                                                '$10\\text{ cm}$'
                                                            )
                                                        }
                                                        title={`Add external dimension line (<--->) on ${edge.name}`}
                                                        className="px-2 py-0.5 text-[10px] font-medium bg-white hover:bg-pink-50 text-slate-700 hover:text-pink-700 border border-slate-200 hover:border-pink-300 rounded flex items-center gap-1 transition-colors"
                                                    >
                                                        <Plus size={9} />
                                                        <span>{edge.name}</span>
                                                    </button>
                                                ))}
                                            </div>
                                        </div>
                                    )}

                                    {selectedShape.labels.length === 0 ? (
                                        <p className="text-[11px] text-slate-400 italic">
                                            No labels attached. Click &ldquo;Free Label&rdquo; or an
                                            edge button above to place one.
                                        </p>
                                    ) : (
                                        <div className="space-y-1.5">
                                            {selectedShape.labels.map((lbl, idx) => {
                                                const resolvedEdge = resolveStraightEdgeForLabel(
                                                    selectedShape,
                                                    lbl
                                                );
                                                return (
                                                    <div
                                                        key={lbl.id}
                                                        className={`flex items-center gap-1.5 p-1.5 rounded border transition-colors ${
                                                            selectedLabelId === lbl.id
                                                                ? 'bg-pink-50/60 border-pink-300'
                                                                : 'bg-slate-50 border-slate-200'
                                                        }`}
                                                        onClick={() => setSelectedLabelId(lbl.id)}
                                                    >
                                                        <span className="text-[10px] font-mono text-slate-400 w-4 text-center">
                                                            {idx + 1}
                                                        </span>
                                                        <input
                                                            ref={el => {
                                                                labelInputRefs.current[lbl.id] = el;
                                                            }}
                                                            type="text"
                                                            value={lbl.text}
                                                            onChange={e =>
                                                                updateLabel(lbl.id, {
                                                                    text: e.target.value
                                                                })
                                                            }
                                                            className="flex-1 min-w-0 bg-white border border-slate-200 rounded px-2 py-1 text-xs focus:border-pink-500 outline-none"
                                                        />
                                                        {resolvedEdge && (
                                                            <button
                                                                onClick={e => {
                                                                    e.stopPropagation();
                                                                    forceSnapshot();
                                                                    updateLabel(lbl.id, {
                                                                        showDimensionLine:
                                                                            !lbl.showDimensionLine
                                                                    });
                                                                }}
                                                                title={`Toggle external dimension line (<--->) with witness lines for ${resolvedEdge.name}`}
                                                                className={`px-1.5 py-0.5 text-[10px] font-mono font-bold rounded border transition-colors shrink-0 ${
                                                                    lbl.showDimensionLine
                                                                        ? 'bg-pink-600 text-white border-pink-600'
                                                                        : 'bg-white text-slate-500 border-slate-200 hover:border-pink-300 hover:text-pink-700'
                                                                }`}
                                                            >
                                                                &lt;-&gt;
                                                            </button>
                                                        )}
                                                        <button
                                                            onClick={e => {
                                                                e.stopPropagation();
                                                                updateLabel(lbl.id, {
                                                                    hidden: !lbl.hidden
                                                                });
                                                            }}
                                                            title={
                                                                lbl.hidden
                                                                    ? 'Show Label'
                                                                    : 'Hide Label'
                                                            }
                                                            className="p-1 text-slate-400 hover:text-slate-700"
                                                        >
                                                            {lbl.hidden ? (
                                                                <EyeOff size={12} />
                                                            ) : (
                                                                <Eye size={12} />
                                                            )}
                                                        </button>
                                                        <button
                                                            onClick={e => {
                                                                e.stopPropagation();
                                                                removeLabel(lbl.id);
                                                            }}
                                                            title="Delete Label"
                                                            className="p-1 text-slate-400 hover:text-red-600"
                                                        >
                                                            <Trash2 size={12} />
                                                        </button>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    )}
                                </div>
                            </>
                        )}
                    </div>
                </aside>

                {/* CENTER SVG CANVAS VIEWPORT */}
                <main className="flex-1 bg-slate-100 overflow-hidden flex flex-col relative">
                    <div
                        ref={containerRef}
                        className="flex-1 overflow-auto flex p-4 bg-slate-100 cursor-crosshair canvas-viewport"
                    >
                        <div
                            className="m-auto shrink-0"
                            style={{
                                width: widthPixels * previewScale,
                                height: heightPixels * previewScale
                            }}
                        >
                            <div
                                className={`bg-white shadow-sm border border-slate-200 transition-opacity duration-200 ease-in-out relative ${
                                    cropMode ? 'cursor-crosshair' : 'cursor-default'
                                }`}
                                style={{
                                    width: widthPixels,
                                    height: heightPixels,
                                    transform: `scale(${previewScale})`,
                                    transformOrigin: 'top left',
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
                                        x="0"
                                        y="0"
                                        width={widthPixels}
                                        height={heightPixels}
                                        fill="white"
                                        onClick={handleCanvasClick}
                                    />

                                    <g className="data-layer">
                                        {shapes.map(shape => (
                                            <g key={shape.id}>
                                                {renderShape(
                                                    shape,
                                                    selectedShapeId === shape.id,
                                                    {
                                                        onShapeMouseDown: e =>
                                                            handleShapeDragStart(shape.id, e),
                                                        onLabelDrag: (lblId, e) =>
                                                            handleLabelDragStart(
                                                                shape.id,
                                                                lblId,
                                                                e
                                                            ),
                                                        onHandleDrag: (hId, e) =>
                                                            handleResizeHandleDrag(
                                                                shape.id,
                                                                hId,
                                                                e
                                                            ),
                                                        onEdgeClick: (edgeIdx, e) =>
                                                            handleEdgeClick(shape.id, edgeIdx, e),
                                                        onVertexClick: (vertIdx, e) =>
                                                            handleVertexClick(shape.id, vertIdx, e),
                                                        onSectorClick: secIdx =>
                                                            handleSectorClick(shape.id, secIdx),
                                                        onFaceClick: faceId =>
                                                            handleFaceClick(shape.id, faceId),
                                                        onSegmentClick: () =>
                                                            handleSegmentClick(shape.id),
                                                        onShapeContextMenu: e => {
                                                            e.preventDefault();
                                                            e.stopPropagation();
                                                            setSelectedShapeId(shape.id);
                                                            setContextMenu({
                                                                x: e.clientX,
                                                                y: e.clientY,
                                                                title: 'Shape Actions',
                                                                items: [
                                                                    {
                                                                        label: 'Duplicate Shape (Alt+Drag)',
                                                                        icon: <Copy size={13} />,
                                                                        primary: true,
                                                                        onClick: () =>
                                                                            handleDuplicateShape(
                                                                                shape
                                                                            )
                                                                    },
                                                                    {
                                                                        label:
                                                                            shape.fill ===
                                                                            'transparent'
                                                                                ? 'Shade Interior'
                                                                                : 'Remove Interior Shading',
                                                                        icon: (
                                                                            <PaintBucket
                                                                                size={13}
                                                                            />
                                                                        ),
                                                                        onClick: () => {
                                                                            forceSnapshot();
                                                                            updateShapeById(
                                                                                shape.id,
                                                                                s => ({
                                                                                    ...s,
                                                                                    fill:
                                                                                        s.fill ===
                                                                                        'transparent'
                                                                                            ? '#e2e8f0'
                                                                                            : 'transparent'
                                                                                })
                                                                            );
                                                                        }
                                                                    },
                                                                    {
                                                                        label: 'Reset Rotation to 0°',
                                                                        icon: (
                                                                            <RotateCcw size={13} />
                                                                        ),
                                                                        onClick: () => {
                                                                            forceSnapshot();
                                                                            updateShapeById(
                                                                                shape.id,
                                                                                s => ({
                                                                                    ...s,
                                                                                    rotation: 0
                                                                                })
                                                                            );
                                                                        }
                                                                    }
                                                                ]
                                                            });
                                                        }
                                                    },
                                                    subSelection,
                                                    showHandles
                                                )}
                                            </g>
                                        ))}
                                    </g>

                                    {cropMode && selectionBox && (
                                        <rect
                                            x={selectionBox.x}
                                            y={selectionBox.y}
                                            width={selectionBox.w}
                                            height={selectionBox.h}
                                            fill="rgba(59, 130, 246, 0.2)"
                                            stroke="#2563eb"
                                            strokeWidth={2 / previewScale}
                                            strokeDasharray={`${5 / previewScale},${
                                                5 / previewScale
                                            }`}
                                            pointerEvents="none"
                                        />
                                    )}
                                </svg>
                            </div>
                        </div>
                    </div>

                    {/* BOTTOM ON-CANVAS MODIFIER KEYS & INTERACTION GUIDE BAR */}
                    <div className="bg-white/95 border-t border-slate-200 px-4 py-1.5 flex flex-wrap items-center justify-between gap-4 text-[11px] text-slate-600 z-10">
                        <div className="flex items-center gap-3">
                            <span className="font-semibold text-slate-700">Modifiers:</span>
                            <span
                                className={`px-1.5 py-0.5 rounded border transition-colors ${
                                    modifiers.shift
                                        ? 'bg-pink-600 text-white border-pink-600 font-semibold'
                                        : 'bg-slate-100 text-slate-600 border-slate-200'
                                }`}
                            >
                                Shift: Lock Proportions / Snap 15°
                            </span>
                            <span
                                className={`px-1.5 py-0.5 rounded border transition-colors ${
                                    modifiers.alt
                                        ? 'bg-pink-600 text-white border-pink-600 font-semibold'
                                        : 'bg-slate-100 text-slate-600 border-slate-200'
                                }`}
                            >
                                Alt: Center Resize / Duplicate
                            </span>
                            <span
                                className={`px-1.5 py-0.5 rounded border transition-colors ${
                                    modifiers.ctrl
                                        ? 'bg-pink-600 text-white border-pink-600 font-semibold'
                                        : 'bg-slate-100 text-slate-600 border-slate-200'
                                }`}
                            >
                                Ctrl/Cmd: Freeform / Multi-Select Sides
                            </span>
                        </div>
                        <div className="text-slate-500">
                            Click any <strong>Side</strong> for ticks/arrows · Click any{' '}
                            <strong>Vertex</strong> for angle arcs · Click{' '}
                            <strong>Sectors/Faces</strong> to shade
                        </div>
                    </div>
                </main>

                {/* INTERACTIVE FEATURE CHECKLIST DRAWER */}
                {showChecklist && (
                    <div className="w-96 bg-white border-l border-slate-200 flex flex-col h-full z-20 shadow-lg">
                        <div className="p-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
                            <div>
                                <h3 className="text-sm font-bold text-slate-900">
                                    Shape Builder Redesign Checklist
                                </h3>
                                <p className="text-[11px] text-slate-500">
                                    Tick off features or click &ldquo;Demo&rdquo; to test on canvas
                                </p>
                            </div>
                            <button
                                onClick={() => setShowChecklist(false)}
                                className="p-1 text-slate-400 hover:text-slate-700 rounded"
                            >
                                <X size={16} />
                            </button>
                        </div>

                        <div className="flex-1 overflow-y-auto p-4 space-y-5 custom-scrollbar">
                            {Array.from(new Set(SHAPE_BUILDER_CHECKLIST.map(i => i.category))).map(
                                category => (
                                    <div key={category} className="space-y-2">
                                        <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500">
                                            {category}
                                        </h4>
                                        <div className="space-y-2">
                                            {SHAPE_BUILDER_CHECKLIST.filter(
                                                item => item.category === category
                                            ).map(item => {
                                                const checked = checkedItems.includes(item.id);
                                                return (
                                                    <div
                                                        key={item.id}
                                                        className={`p-2.5 rounded-lg border transition-colors ${
                                                            checked
                                                                ? 'bg-emerald-50/40 border-emerald-200'
                                                                : 'bg-white border-slate-200'
                                                        }`}
                                                    >
                                                        <div className="flex items-start gap-2">
                                                            <button
                                                                onClick={() =>
                                                                    toggleChecklistItem(item.id)
                                                                }
                                                                className="mt-0.5 text-emerald-600 shrink-0"
                                                            >
                                                                {checked ? (
                                                                    <CheckSquare size={15} />
                                                                ) : (
                                                                    <Square
                                                                        size={15}
                                                                        className="text-slate-400"
                                                                    />
                                                                )}
                                                            </button>
                                                            <div className="flex-1 min-w-0">
                                                                <div className="flex items-center justify-between gap-2">
                                                                    <span
                                                                        className={`text-xs font-semibold ${
                                                                            checked
                                                                                ? 'text-slate-900'
                                                                                : 'text-slate-700'
                                                                        }`}
                                                                    >
                                                                        {item.title}
                                                                    </span>
                                                                </div>
                                                                <p className="text-[11px] text-slate-500 mt-0.5 leading-relaxed">
                                                                    {item.description}
                                                                </p>
                                                                {(item.presetId || item.shapeType) && (
                                                                    <button
                                                                        onClick={() => {
                                                                            const foundPreset = item.presetId
                                                                                ? SHAPE_PRESETS.find(
                                                                                      p =>
                                                                                          p.id ===
                                                                                          item.presetId
                                                                                  )
                                                                                : undefined;
                                                                            if (foundPreset) {
                                                                                handleSelectPreset(
                                                                                    foundPreset,
                                                                                    true
                                                                                );
                                                                            } else if (
                                                                                item.shapeType
                                                                            ) {
                                                                                handleSelectShapeType(
                                                                                    item.shapeType,
                                                                                    true
                                                                                );
                                                                            }
                                                                        }}
                                                                        className="mt-2 px-2 py-0.5 bg-white hover:bg-pink-50 text-pink-700 border border-pink-200 rounded text-[11px] font-medium inline-flex items-center gap-1"
                                                                    >
                                                                        <Play size={10} /> Demo on
                                                                        Canvas
                                                                    </button>
                                                                )}
                                                            </div>
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>
                                )
                            )}
                        </div>
                    </div>
                )}
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
