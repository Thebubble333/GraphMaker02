import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { BaseGraphEngine } from '../utils/graphBase';
import { renderSegmentedBars } from '../utils/graphRenderers';
import { STATISTICS_CONFIG } from '../config/graphDefaults';
import { BarGroupDef, BarSegmentDef, PatternType, GraphConfig } from '../types';
import { List, Sliders, Palette, Plus, Trash2, Layers, CheckSquare, Grid, Type, Crosshair, RotateCcw, Eye, EyeOff } from 'lucide-react';
import { CM_TO_PX } from '../constants';
import * as math from 'mathjs';

import { GraphToolbar } from '../components/GraphToolbar';
import { GraphContextMenu, ContextMenuItem } from '../components/GraphContextMenu';
import { useGraphInteraction } from '../hooks/useGraphInteraction';
import { useDragSystem } from '../hooks/useDragSystem';
import { useHistory } from '../hooks/useHistory';
import { calculateAxisLabelDrag, calculateAxisResize } from '../utils/dragStrategies';
import { RichInput } from '../components/ui/RichInput';

import { WindowSettings } from '../components/settings/WindowSettings';
import { AppearanceSettings } from '../components/settings/AppearanceSettings';

const INITIAL_BARS: BarGroupDef[] = [
    {
        id: '1', label: '2021', width: 0.6,
        segments: [
            { id: 's1', value: 45, label: 'Netflix', color: '#1f2937', pattern: 'none', patternColor: 'black' },
            { id: 's2', value: 15, label: 'Disney', color: '#ffffff', pattern: 'stripes-right', patternColor: 'black' },
            { id: 's3', value: 15, label: 'Foxtel', color: '#9ca3af', pattern: 'dots', patternColor: 'black' },
            { id: 's4', value: 25, label: 'Other', color: '#ffffff', pattern: 'crosshatch', patternColor: 'black' }
        ]
    },
    {
        id: '2', label: '2023', width: 0.6,
        segments: [
            { id: 's5', value: 32, label: 'Netflix', color: '#1f2937', pattern: 'none', patternColor: 'black' },
            { id: 's6', value: 18, label: 'Disney', color: '#ffffff', pattern: 'stripes-right', patternColor: 'black' },
            { id: 's7', value: 12, label: 'Foxtel', color: '#9ca3af', pattern: 'dots', patternColor: 'black' },
            { id: 's8', value: 38, label: 'Other', color: '#ffffff', pattern: 'crosshatch', patternColor: 'black' }
        ]
    }
];

const INITIAL_CONFIG: GraphConfig = {
    ...STATISTICS_CONFIG,
    showMinorGrid: true,
    xRange: [0, 2],
    yRange: [0, 100],
    majorStep: [1, 10],
    subdivisions: [1, 2],
    showVerticalGrid: false,
    showXNumbers: false,
    showXArrow: false,
    showYArrow: false,
    xAxisExtendLeft: false,
    xAxisExtendRight: false,
    hideLastXTick: true,
    axisLabels: ["", "Percentage of Market Share"],
    fontSize: 11,
    xLabelStyle: 'below-center',
    yLabelStyle: 'left-center',
    yLabelRotation: 'horizontal',
    offsetYAxisLabelX: 10
};

const INITIAL_WINDOW = {
    xMin: "0", xMax: "2", yMin: "0", yMax: "100",
    xStep: "1", yStep: "10", xSubdivisions: 1, ySubdivisions: 2
};

interface ContextMenuState {
    x: number;
    y: number;
    targetType: 'seg-bar' | 'group-label' | 'legend' | 'title' | 'axis' | 'axis-label' | 'grid' | 'canvas';
    targetId?: string;
}

const SegmentedBarCharts: React.FC = () => {
    const [config, setConfig] = useState<GraphConfig>(INITIAL_CONFIG);
    const [chartTitle, setChartTitle] = useState("");
    const [bars, setBars] = useState<BarGroupDef[]>(INITIAL_BARS);
    const [selectedBarId, setSelectedBarId] = useState<string | null>(INITIAL_BARS[0].id);
    
    const [worksheetMode, setWorksheetMode] = useState(false);
    const [studentMode, setStudentMode] = useState(false);
    const [barStrokeWidth, setBarStrokeWidth] = useState(2);
    const [showLegend, setShowLegend] = useState(true);
    const [legendPos, setLegendPos] = useState({ x: 0, y: 0 });
    
    const [labelAngle, setLabelAngle] = useState(0);
    const [labelVerticalShift, setLabelVerticalShift] = useState(0);
    const [labelHorizontalShift, setLabelHorizontalShift] = useState(0);
    
    const [dimCm, setDimCm] = useState({ width: 14, height: 10 });
    const [isFixedSize, setIsFixedSize] = useState(true);
    const [windowSettings, setWindowSettings] = useState(INITIAL_WINDOW);

    const [activeTab, setActiveTab] = useState<'data' | 'window' | 'style'>('data');
    const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null);
    const [highlightedId, setHighlightedId] = useState<string | null>(null);

    const triggerHighlight = (id: string) => {
        setHighlightedId(id);
        setTimeout(() => setHighlightedId(null), 2200);
    };

    const currentState = useMemo(() => ({
        config, chartTitle, bars, selectedBarId, worksheetMode, studentMode,
        barStrokeWidth, showLegend, legendPos, labelAngle, labelVerticalShift,
        labelHorizontalShift, dimCm, isFixedSize, windowSettings
    }), [
        config, chartTitle, bars, selectedBarId, worksheetMode, studentMode,
        barStrokeWidth, showLegend, legendPos, labelAngle, labelVerticalShift,
        labelHorizontalShift, dimCm, isFixedSize, windowSettings
    ]);

    const restoreState = useCallback((state: any) => {
        if (!state) return;
        if (state.config) setConfig(state.config);
        if (state.chartTitle !== undefined) setChartTitle(state.chartTitle);
        if (state.bars) setBars(state.bars);
        if (state.selectedBarId !== undefined) setSelectedBarId(state.selectedBarId);
        if (state.worksheetMode !== undefined) setWorksheetMode(state.worksheetMode);
        if (state.studentMode !== undefined) setStudentMode(state.studentMode);
        if (state.barStrokeWidth !== undefined) setBarStrokeWidth(state.barStrokeWidth);
        if (state.showLegend !== undefined) setShowLegend(state.showLegend);
        if (state.legendPos) setLegendPos(state.legendPos);
        if (state.labelAngle !== undefined) setLabelAngle(state.labelAngle);
        if (state.labelVerticalShift !== undefined) setLabelVerticalShift(state.labelVerticalShift);
        if (state.labelHorizontalShift !== undefined) setLabelHorizontalShift(state.labelHorizontalShift);
        if (state.dimCm) setDimCm(state.dimCm);
        if (state.isFixedSize !== undefined) setIsFixedSize(state.isFixedSize);
        if (state.windowSettings) setWindowSettings(state.windowSettings);
    }, []);

    const { undo, redo, canUndo, canRedo, exportState, importState, resetToDefaultSettings } = useHistory(
        'segmented-bar-charts',
        currentState,
        restoreState
    );

    const handleResetDefaultSettings = useCallback(() => {
        setConfig(INITIAL_CONFIG);
        setChartTitle("");
        setBars(INITIAL_BARS);
        setSelectedBarId(INITIAL_BARS[0].id);
        setWorksheetMode(false);
        setStudentMode(false);
        setBarStrokeWidth(2);
        setShowLegend(true);
        setLegendPos({ x: 0, y: 0 });
        setLabelAngle(0);
        setLabelVerticalShift(0);
        setLabelHorizontalShift(0);
        setDimCm({ width: 14, height: 10 });
        setIsFixedSize(true);
        setWindowSettings(INITIAL_WINDOW);
        resetToDefaultSettings();
    }, [resetToDefaultSettings]);

    // Auto-Legend Generation
    const legendItems = useMemo(() => {
        const map = new Map<string, BarSegmentDef>();
        bars.forEach(b => b.segments.forEach(s => {
            if (!map.has(s.label)) map.set(s.label, s);
        }));
        return Array.from(map.values());
    }, [bars]);
    
    const parseMath = (input: string | number): number => {
      try {
          const val = math.evaluate(String(input));
          return typeof val === 'number' && isFinite(val) ? val : 0;
      } catch { return 0; }
    };

    useEffect(() => {
        setConfig(prev => ({
            ...prev,
            layoutMode: isFixedSize ? 'fixed' : 'auto',
            targetWidth: Math.round(dimCm.width * CM_TO_PX),
            targetHeight: Math.round(dimCm.height * CM_TO_PX),
            marginRight: showLegend && legendItems.length > 0 ? 160 : undefined
        }));
    }, [dimCm, isFixedSize, showLegend, legendItems.length]);

    useEffect(() => {
        const xMin = parseMath(windowSettings.xMin);
        const xMax = parseMath(windowSettings.xMax);
        const yMin = parseMath(windowSettings.yMin);
        const yMax = parseMath(windowSettings.yMax);
        let yStep = Math.abs(parseMath(windowSettings.yStep));
        if (yStep < 1e-9) yStep = 10;
        
        setConfig(prev => ({
            ...prev, xRange: [xMin, xMax], yRange: [yMin, yMax], majorStep: [1, yStep], subdivisions: [1, Number(windowSettings.ySubdivisions)||1]
        }));
    }, [windowSettings]);

    // Graph Engine
    const engine = useMemo(() => new BaseGraphEngine(config), [config]);

    // Interaction
    const {
        previewScale, setPreviewScale,
        exportDpi, setExportDpi,
        cropMode, setCropMode,
        selectionBox, customViewBox, hasInitialCrop,
        containerRef,
        handleAutoCrop, handleResetView, handleZoomOutCanvas, handleExportPNG, handleExportSVG, handleCopy, isCopied,
        handleCropMouseDown, handleCropMouseMove, handleCropMouseUp
    } = useGraphInteraction('segbar-svg', engine.widthPixels, engine.heightPixels, dimCm.width, false, false, config.cropPadding);

    const { onMouseDown, onMouseMove, onMouseUp } = useDragSystem(previewScale);

    const handleAxisLabelDragStart = (axis: 'x' | 'y', e: React.MouseEvent) => {
        const initialOffsets = {
            xx: config.offsetXAxisLabelX, xy: config.offsetXAxisLabelY,
            yx: config.offsetYAxisLabelX, yy: config.offsetYAxisLabelY
        };
        onMouseDown(e, initialOffsets, (dx, dy, init, ev) => {
            const updates = calculateAxisLabelDrag(config, dx, dy, axis, init, { alt: ev.altKey, ctrl: ev.ctrlKey || ev.metaKey });
            setConfig(prev => ({ ...prev, ...updates }));
        });
    };

    const handleArrowDragStart = (axis: 'x' | 'y', side: 'positive' | 'negative', e: React.MouseEvent) => {
        const initRange = { x: config.xRange, y: config.yRange };
        onMouseDown(e, initRange, (dx, dy, init, ev) => {
            const updates = calculateAxisResize(axis, dx, dy, engine.scaleX, engine.scaleY, init, side, ev.shiftKey);
            if (Object.keys(updates).length > 0) {
                setWindowSettings(prev => ({ ...prev, ...updates }));
            }
        }, undefined, 'axis-resize');
    };

    const handleGlobalMouseMove = (e: React.MouseEvent) => {
        if (handleCropMouseMove(e)) return;
        onMouseMove(e);
    };

    const handleGlobalMouseUp = () => {
        handleCropMouseUp();
        onMouseUp();
    };

    // --- CRUD ---
    const addBar = () => {
        const newId = Date.now().toString();
        setBars([...bars, { 
            id: newId, 
            label: `New ${bars.length + 1}`, 
            width: 0.6, 
            segments: [{ id: 's1', value: 50, label: 'A', color: '#e5e7eb', pattern: 'none', patternColor: 'black' }] 
        }]);
        setSelectedBarId(newId);
        setWindowSettings(prev => ({ ...prev, xMax: String(bars.length + 1) }));
    };

    const updateBar = (id: string, u: Partial<BarGroupDef>) => {
        setBars(prev => prev.map(b => b.id === id ? { ...b, ...u } : b));
    };

    const removeBar = (id: string) => {
        setBars(prev => prev.filter(b => b.id !== id));
        if (selectedBarId === id) setSelectedBarId(null);
        setWindowSettings(prev => ({ ...prev, xMax: String(Math.max(1, bars.length - 1)) }));
    };

    const addSegment = (barId: string) => {
        setBars(prev => prev.map(b => {
            if (b.id !== barId) return b;
            return {
                ...b,
                segments: [...b.segments, { 
                    id: Date.now().toString(), 
                    value: 10, 
                    label: 'New', 
                    color: '#ffffff', 
                    pattern: 'solid', 
                    patternColor: 'black' 
                }]
            };
        }));
    };

    const updateSegment = (barId: string, segId: string, u: Partial<BarSegmentDef>) => {
        setBars(prev => prev.map(b => {
            if (b.id !== barId) return b;
            return {
                ...b,
                segments: b.segments.map(s => s.id === segId ? { ...s, ...u } : s)
            };
        }));
    };

    const removeSegment = (barId: string, segId: string) => {
        setBars(prev => prev.map(b => {
            if (b.id !== barId) return b;
            return { ...b, segments: b.segments.filter(s => s.id !== segId) };
        }));
    };

    const selectedBar = bars.find(b => b.id === selectedBarId);

    const renderLegend = () => {
        if (!showLegend || legendItems.length === 0) return null;
        const { xEnd, yStart } = engine.getGridBoundaries();
        const legX = xEnd + 20 + legendPos.x;
        const legY = yStart + 20 + legendPos.y;
        
        return (
            <g 
                data-target-type="legend"
                data-target-id="legend"
                transform={`translate(${legX}, ${legY})`}
                onMouseDown={(e) => {
                    onMouseDown(e, legendPos, (dx, dy, init) => {
                        setLegendPos({ x: init.x + dx, y: init.y + dy });
                    });
                }}
                style={{ cursor: 'move' }}
            >
                <rect x="-10" y="-10" width="120" height={legendItems.length * 25 + 35} fill="white" stroke="black" strokeWidth="1"/>
                <text x="0" y="5" fontSize="12" fontWeight="bold" fontFamily="Times New Roman">Key</text>
                {legendItems.map((item, idx) => (
                    <g key={item.id} transform={`translate(0, ${25 + idx * 25})`}>
                        <rect x="0" y="0" width="15" height="15" fill={worksheetMode ? 'white' : item.color} stroke="black" strokeWidth="1"/>
                        {!worksheetMode && item.pattern !== 'none' && (
                            <rect x="0" y="0" width="15" height="15" fill={item.pattern === 'solid' ? 'black' : `url(#pat-${item.pattern})`} stroke="none" style={{mixBlendMode:'multiply'}}/>
                        )}
                        <text x="25" y="12" fontSize="12" fontFamily="Times New Roman">{item.label}</text>
                    </g>
                ))}
            </g>
        );
    };

    const handleContextMenu = (e: React.MouseEvent<SVGSVGElement>) => {
        e.preventDefault();
        if (cropMode) return;

        let el = e.target as Element | null;
        while (el && el !== e.currentTarget) {
            const targetType = el.getAttribute('data-target-type') as ContextMenuState['targetType'] | null;
            const targetId = el.getAttribute('data-target-id') || undefined;
            if (targetType) {
                setContextMenu({
                    x: e.clientX,
                    y: e.clientY,
                    targetType,
                    targetId
                });
                return;
            }
            el = el.parentElement;
        }

        setContextMenu({
            x: e.clientX,
            y: e.clientY,
            targetType: 'canvas'
        });
    };

    const getContextMenuData = (): { header: string; items: ContextMenuItem[] } => {
        if (!contextMenu) return { header: '', items: [] };

        if (contextMenu.targetType === 'seg-bar' && contextMenu.targetId) {
            const [groupId, segId] = contextMenu.targetId.split(':::');
            const bar = bars.find(b => b.id === groupId);
            const seg = bar?.segments.find(s => s.id === segId);
            if (bar && seg) {
                return {
                    header: `${bar.label} — ${seg.label} (${seg.value})`,
                    items: [
                        {
                            label: 'Edit Segment in Sidebar',
                            icon: <Crosshair size={14} />,
                            accent: true,
                            onClick: () => {
                                setActiveTab('data');
                                setSelectedBarId(bar.id);
                                triggerHighlight(seg.id);
                                setTimeout(() => {
                                    const el = document.getElementById(`sidebar-seg-${seg.id}`);
                                    if (el) {
                                        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
                                        const input = el.querySelector('input');
                                        if (input) input.focus();
                                    }
                                }, 80);
                            }
                        },
                        {
                            label: 'Add New Segment to Column',
                            icon: <Plus size={14} />,
                            onClick: () => {
                                setSelectedBarId(bar.id);
                                addSegment(bar.id);
                            }
                        },
                        {
                            label: 'Delete Segment',
                            icon: <Trash2 size={14} />,
                            danger: true,
                            dividerBefore: true,
                            onClick: () => removeSegment(bar.id, seg.id)
                        },
                        {
                            label: 'Delete Entire Bar Column',
                            icon: <Trash2 size={14} />,
                            danger: true,
                            onClick: () => removeBar(bar.id)
                        }
                    ]
                };
            }
        }

        if (contextMenu.targetType === 'group-label' && contextMenu.targetId) {
            const bar = bars.find(b => b.id === contextMenu.targetId);
            if (bar) {
                return {
                    header: `Column: ${bar.label}`,
                    items: [
                        {
                            label: 'Select & Edit Column in Sidebar',
                            icon: <Crosshair size={14} />,
                            accent: true,
                            onClick: () => {
                                setActiveTab('data');
                                setSelectedBarId(bar.id);
                                triggerHighlight(bar.id);
                                setTimeout(() => {
                                    const el = document.getElementById('sidebar-bar-editor');
                                    if (el) {
                                        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
                                        const input = el.querySelector('input');
                                        if (input) input.focus();
                                    }
                                }, 80);
                            }
                        },
                        {
                            label: 'Adjust Label Angle & Shift',
                            icon: <Type size={14} />,
                            onClick: () => setActiveTab('style')
                        },
                        {
                            label: 'Delete Bar Column',
                            icon: <Trash2 size={14} />,
                            danger: true,
                            dividerBefore: true,
                            onClick: () => removeBar(bar.id)
                        }
                    ]
                };
            }
        }

        if (contextMenu.targetType === 'legend') {
            return {
                header: 'Chart Key / Legend',
                items: [
                    {
                        label: 'Reset Legend Position',
                        icon: <RotateCcw size={14} />,
                        accent: true,
                        onClick: () => setLegendPos({ x: 0, y: 0 })
                    },
                    {
                        label: 'Hide Legend',
                        icon: <EyeOff size={14} />,
                        onClick: () => setShowLegend(false)
                    }
                ]
            };
        }

        if (contextMenu.targetType === 'title') {
            return {
                header: 'Chart Title',
                items: [
                    {
                        label: 'Edit Title in Sidebar',
                        icon: <Crosshair size={14} />,
                        accent: true,
                        onClick: () => {
                            setActiveTab('data');
                            triggerHighlight('title');
                        }
                    }
                ]
            };
        }

        if (contextMenu.targetType === 'axis-label') {
            const isX = contextMenu.targetId === 'x-axis-label';
            return {
                header: isX ? 'X-Axis Label' : 'Y-Axis Label',
                items: [
                    {
                        label: 'Edit Label Text in Style Tab',
                        icon: <Palette size={14} />,
                        accent: true,
                        onClick: () => setActiveTab('style')
                    },
                    {
                        label: 'Reset Label Position',
                        icon: <RotateCcw size={14} />,
                        onClick: () => {
                            if (isX) setConfig(prev => ({ ...prev, offsetXAxisLabelX: 0, offsetXAxisLabelY: 0 }));
                            else setConfig(prev => ({ ...prev, offsetYAxisLabelX: 0, offsetYAxisLabelY: 0 }));
                        }
                    }
                ]
            };
        }

        return {
            header: contextMenu.targetType === 'axis' ? 'Axes' : contextMenu.targetType === 'grid' ? 'Grid & Border' : 'Segmented Bar Canvas',
            items: [
                {
                    label: 'Add Bar Column',
                    icon: <Plus size={14} />,
                    accent: true,
                    onClick: addBar
                },
                {
                    label: worksheetMode ? 'Disable Worksheet Mode' : 'Enable Worksheet Mode (Coloring)',
                    icon: <CheckSquare size={14} />,
                    dividerBefore: true,
                    onClick: () => setWorksheetMode(!worksheetMode)
                },
                {
                    label: studentMode ? 'Disable Student Mode' : 'Enable Student Mode',
                    icon: studentMode ? <Eye size={14} /> : <EyeOff size={14} />,
                    onClick: () => setStudentMode(!studentMode)
                },
                {
                    label: 'Edit Window Settings',
                    icon: <Sliders size={14} />,
                    dividerBefore: true,
                    onClick: () => setActiveTab('window')
                },
                {
                    label: 'Edit Style Settings',
                    icon: <Palette size={14} />,
                    onClick: () => setActiveTab('style')
                }
            ]
        };
    };

    const gridArea = engine.getGridBoundaries();
    const menuData = getContextMenuData();

    return (
        <div className="flex h-full flex-col bg-gray-50" onMouseMove={handleGlobalMouseMove} onMouseUp={handleGlobalMouseUp}>
            <header className="flex items-center justify-between px-6 py-3 bg-white border-b border-gray-200 shadow-sm z-10">
                <div className="flex items-center gap-3">
                    <div className="p-2 bg-cyan-50 text-cyan-600 rounded-lg"><Layers className="w-5 h-5" /></div>
                    <h1 className="text-xl font-semibold text-gray-800">Segmented Bar Charts</h1>
                </div>
                <GraphToolbar 
                    previewScale={previewScale} setPreviewScale={setPreviewScale}
                    exportDpi={exportDpi} onDpiChange={setExportDpi}
                    cropMode={cropMode} setCropMode={setCropMode}
                    onResetView={handleResetView} onZoomOutCanvas={handleZoomOutCanvas} onAutoCrop={handleAutoCrop}
                    onExportPNG={handleExportPNG} onCopy={handleCopy} isCopied={isCopied} onExportSVG={handleExportSVG}
                    onUndo={undo} onRedo={redo} canUndo={canUndo} canRedo={canRedo}
                    onExportState={exportState} onImportState={importState}
                    onResetDefaultSettings={handleResetDefaultSettings}
                />
            </header>

            <div className="flex flex-1 overflow-hidden">
                <aside className="w-80 bg-white border-r border-gray-200 flex flex-col h-full z-20">
                    <div className="flex border-b border-gray-200 bg-white">
                        <button onClick={() => setActiveTab('data')} className={`flex-1 py-3 text-sm font-medium flex justify-center items-center gap-2 ${activeTab === 'data' ? 'text-cyan-600 border-b-2 border-cyan-600 bg-cyan-50/50' : 'text-gray-500'}`}><List size={16} /> Data</button>
                        <button onClick={() => setActiveTab('window')} className={`flex-1 py-3 text-sm font-medium flex justify-center items-center gap-2 ${activeTab === 'window' ? 'text-cyan-600 border-b-2 border-cyan-600 bg-cyan-50/50' : 'text-gray-500'}`}><Sliders size={16} /> Window</button>
                        <button onClick={() => setActiveTab('style')} className={`flex-1 py-3 text-sm font-medium flex justify-center items-center gap-2 ${activeTab === 'style' ? 'text-cyan-600 border-b-2 border-cyan-600 bg-cyan-50/50' : 'text-gray-500'}`}><Palette size={16} /> Style</button>
                    </div>

                    <div className="flex-1 overflow-y-auto custom-scrollbar">
                        {activeTab === 'data' && (
                            <div className="p-4 space-y-4">
                                <div className={`p-1 rounded transition-all duration-300 ${highlightedId === 'title' ? 'ring-2 ring-cyan-400 bg-cyan-50/30' : ''}`}>
                                    <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Chart Title</label>
                                    <RichInput 
                                        value={chartTitle}
                                        onChange={(e) => setChartTitle(e.target.value)}
                                        className="w-full border rounded px-2 py-1 text-sm"
                                        placeholder="Optional Title..."
                                    />
                                </div>
                                <div className="space-y-2">
                                    <div className="flex justify-between items-center">
                                        <h3 className="text-xs font-bold text-gray-500 uppercase">Bar Columns</h3>
                                        <button onClick={addBar} className="text-cyan-600 hover:bg-cyan-50 p-1 rounded"><Plus size={16}/></button>
                                    </div>
                                    <div className="flex gap-2 overflow-x-auto pb-2 custom-scrollbar">
                                        {bars.map(bar => (
                                            <button 
                                                key={bar.id}
                                                onClick={() => setSelectedBarId(bar.id)}
                                                className={`px-3 py-1.5 rounded text-xs font-medium whitespace-nowrap border ${selectedBarId === bar.id ? 'bg-cyan-100 text-cyan-800 border-cyan-300' : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'}`}
                                            >
                                                {bar.label || 'Untitled'}
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                {selectedBar && (
                                    <div
                                        id="sidebar-bar-editor"
                                        className={`bg-gray-50 rounded-lg border p-3 space-y-3 transition-all duration-300 ${
                                            highlightedId === selectedBar.id ? 'border-cyan-500 ring-2 ring-cyan-400' : 'border-gray-200'
                                        }`}
                                    >
                                        <div className="flex items-center gap-2">
                                            <RichInput 
                                                value={selectedBar.label}
                                                onChange={(e) => updateBar(selectedBar.id, { label: e.target.value })}
                                                className="flex-1 border rounded px-2 py-1 text-sm font-bold"
                                                placeholder="Bar Label"
                                            />
                                            <button onClick={() => removeBar(selectedBar.id)} className="text-gray-400 hover:text-red-500"><Trash2 size={16}/></button>
                                        </div>
                                        <div className="space-y-2">
                                            <div className="flex justify-between items-center">
                                                <span className="text-[10px] font-bold text-gray-400 uppercase">Segments (Bottom-Up)</span>
                                                <button onClick={() => addSegment(selectedBar.id)} className="text-cyan-600 hover:bg-white p-1 rounded"><Plus size={14}/></button>
                                            </div>
                                            {selectedBar.segments.map((seg, idx) => (
                                                <div
                                                    key={seg.id}
                                                    id={`sidebar-seg-${seg.id}`}
                                                    className={`bg-white border rounded p-2 flex flex-col gap-2 transition-all duration-300 ${
                                                        highlightedId === seg.id ? 'border-cyan-500 ring-2 ring-cyan-400 bg-cyan-50/30' : ''
                                                    }`}
                                                >
                                                    <div className="flex items-center gap-2">
                                                        <span className="text-[10px] text-gray-400 font-mono w-4">{idx+1}</span>
                                                        <input type="text" value={seg.label} onChange={(e) => updateSegment(selectedBar.id, seg.id, { label: e.target.value })} className="flex-1 border rounded px-1 py-0.5 text-xs" placeholder="Category" />
                                                        <input type="number" value={seg.value} onChange={(e) => updateSegment(selectedBar.id, seg.id, { value: parseFloat(e.target.value) })} className="w-12 border rounded px-1 py-0.5 text-xs" placeholder="Val" />
                                                        <button onClick={() => removeSegment(selectedBar.id, seg.id)} className="text-gray-300 hover:text-red-500"><Trash2 size={12}/></button>
                                                    </div>
                                                    <div className="flex items-center gap-2">
                                                        <input type="color" value={seg.color} onChange={(e) => updateSegment(selectedBar.id, seg.id, { color: e.target.value })} className="w-5 h-5 border rounded cursor-pointer" />
                                                        <select value={seg.pattern} onChange={(e) => updateSegment(selectedBar.id, seg.id, { pattern: e.target.value as PatternType })} className="flex-1 border rounded p-0.5 text-[10px]">
                                                            <option value="none">No Pattern</option>
                                                            <option value="solid">Solid Black</option>
                                                            <option value="stripes-right">Stripes //</option>
                                                            <option value="stripes-left">Stripes \\</option>
                                                            <option value="dots">Dots</option>
                                                            <option value="crosshatch">Crosshatch</option>
                                                            <option value="grid">Grid</option>
                                                            <option value="vertical">Vertical</option>
                                                            <option value="horizontal">Horizontal</option>
                                                        </select>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}
                        {activeTab === 'window' && <WindowSettings dimCm={dimCm} setDimCm={setDimCm} isFixedSize={isFixedSize} setIsFixedSize={setIsFixedSize} windowSettings={windowSettings} onSettingChange={(f, v) => setWindowSettings(p => ({...p, [f]: v}))} />}
                        {activeTab === 'style' && (
                            <div className="flex flex-col">
                                <AppearanceSettings 
                                    config={config} 
                                    setConfig={setConfig} 
                                    hideGridOptions={true}
                                    hidePiSteps={true}
                                    hideWhiskerCaps={true}
                                    hideZeroLabel={true}
                                    hideAsymptotes={true}
                                />
                                <div className="p-4 border-t border-gray-200 space-y-4">
                                    <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider flex items-center gap-2"><Grid size={14}/> Graph Options</h3>
                                    {/* Fix: Resolved 'works' variable error and completed worksheetMode UI */}
                                    <label className={`flex items-center gap-3 p-3 rounded border cursor-pointer transition-colors ${worksheetMode ? 'bg-cyan-50 border-cyan-300' : 'bg-white border-gray-200'}`}>
                                        <div className={`w-5 h-5 rounded border flex items-center justify-center ${worksheetMode ? 'bg-cyan-600 border-cyan-600 text-white' : 'bg-white border-gray-300'}`}>
                                            {worksheetMode && <CheckSquare size={12} />}
                                        </div>
                                        <input 
                                            type="checkbox" 
                                            checked={worksheetMode} 
                                            onChange={(e) => setWorksheetMode(e.target.checked)} 
                                            className="hidden"
                                        />
                                        <div className="flex-1">
                                            <span className="block text-xs font-bold text-gray-700 uppercase">Worksheet Mode</span>
                                            <span className="text-[10px] text-gray-400">Hides fills/patterns for student coloring</span>
                                        </div>
                                    </label>

                                    {legendItems.length > 0 && (
                                        <>
                                            <label className={`flex items-center gap-3 p-3 rounded border cursor-pointer transition-colors ${showLegend ? 'bg-cyan-50 border-cyan-300' : 'bg-white border-gray-200'}`}>
                                                <div className={`w-5 h-5 rounded border flex items-center justify-center ${showLegend ? 'bg-cyan-600 border-cyan-600 text-white' : 'bg-white border-gray-300'}`}>
                                                    {showLegend && <CheckSquare size={12} />}
                                                </div>
                                                <input 
                                                    type="checkbox" 
                                                    checked={showLegend} 
                                                    onChange={(e) => setShowLegend(e.target.checked)} 
                                                    className="hidden"
                                                />
                                                <div className="flex-1">
                                                    <span className="block text-xs font-bold text-gray-700 uppercase">Show Legend</span>
                                                    <span className="text-[10px] text-gray-400">Display key for segments</span>
                                                </div>
                                            </label>
                                            
                                            {showLegend && (
                                                <div className="grid grid-cols-2 gap-2">
                                                    <div>
                                                        <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">Legend X Offset</label>
                                                        <input 
                                                            type="number" 
                                                            value={Math.round(legendPos.x)}
                                                            onChange={(e) => setLegendPos(prev => ({ ...prev, x: Number(e.target.value) }))}
                                                            className="w-full p-2 border rounded text-sm"
                                                        />
                                                    </div>
                                                    <div>
                                                        <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">Legend Y Offset</label>
                                                        <input 
                                                            type="number" 
                                                            value={Math.round(legendPos.y)}
                                                            onChange={(e) => setLegendPos(prev => ({ ...prev, y: Number(e.target.value) }))}
                                                            className="w-full p-2 border rounded text-sm"
                                                        />
                                                    </div>
                                                </div>
                                            )}
                                        </>
                                    )}

                                    <div>
                                        <label className="flex justify-between text-xs text-gray-600 mb-1">
                                            <span>Bar Stroke Width</span>
                                            <span className="font-mono">{barStrokeWidth}px</span>
                                        </label>
                                        <input 
                                            type="range" min="0.5" max="5" step="0.5"
                                            value={barStrokeWidth}
                                            onChange={(e) => setBarStrokeWidth(parseFloat(e.target.value))}
                                            className="w-full h-1.5 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-cyan-600"
                                        />
                                    </div>
                                    
                                    <div className="pt-4 border-t border-gray-200">
                                        <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-4">Graph Options</h3>
                                        <label className={`flex items-center gap-3 p-3 rounded border cursor-pointer transition-colors ${studentMode ? 'bg-indigo-50 border-indigo-300' : 'bg-white border-gray-200'}`}>
                                            <div className={`w-5 h-5 rounded border flex items-center justify-center ${studentMode ? 'bg-indigo-600 border-indigo-600 text-white' : 'bg-white border-gray-300'}`}>
                                                {studentMode && <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>}
                                            </div>
                                            <input 
                                                type="checkbox" 
                                                checked={studentMode} 
                                                onChange={(e) => setStudentMode(e.target.checked)} 
                                                className="hidden"
                                            />
                                            <div className="flex-1">
                                                <span className="block text-xs font-bold text-gray-700 uppercase">Student Mode</span>
                                                <span className="block text-xs text-gray-500 mt-0.5">Hide bars to create a worksheet</span>
                                            </div>
                                        </label>
                                    </div>

                                    <div className="pt-4 border-t border-gray-200">
                                        <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-4 flex items-center gap-2"><Type size={14}/> Category Labels</h3>
                                        
                                        <div className="space-y-4">
                                            <div>
                                                <label className="flex justify-between text-xs text-gray-600 mb-1">
                                                    <span>Label Angle</span>
                                                    <span className="font-mono">{labelAngle}°</span>
                                                </label>
                                                <input 
                                                    type="range" min="-90" max="90" step="15"
                                                    value={labelAngle}
                                                    onChange={(e) => setLabelAngle(parseFloat(e.target.value))}
                                                    className="w-full h-1.5 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-cyan-600"
                                                />
                                                <div className="flex justify-between text-[10px] text-gray-400 mt-1">
                                                    <span>-90°</span>
                                                    <span>0°</span>
                                                    <span>90°</span>
                                                </div>
                                            </div>

                                            <div>
                                                <label className="flex justify-between text-xs text-gray-600 mb-1">
                                                    <span>Vertical Shift</span>
                                                    <span className="font-mono">{labelVerticalShift}px</span>
                                                </label>
                                                <input 
                                                    type="range" min="-50" max="50" step="1"
                                                    value={labelVerticalShift}
                                                    onChange={(e) => setLabelVerticalShift(parseFloat(e.target.value))}
                                                    className="w-full h-1.5 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-cyan-600"
                                                />
                                            </div>

                                            <div>
                                                <label className="flex justify-between text-xs text-gray-600 mb-1">
                                                    <span>Horizontal Shift</span>
                                                    <span className="font-mono">{labelHorizontalShift}px</span>
                                                </label>
                                                <input 
                                                    type="range" min="-50" max="50" step="1"
                                                    value={labelHorizontalShift}
                                                    onChange={(e) => setLabelHorizontalShift(parseFloat(e.target.value))}
                                                    className="w-full h-1.5 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-cyan-600"
                                                />
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                </aside>

                <main className="flex-1 bg-gray-100 overflow-hidden flex flex-col relative">
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
                          id="segbar-svg" 
                          width={engine.widthPixels} 
                          height={engine.heightPixels} 
                          viewBox={customViewBox || `0 0 ${engine.widthPixels} ${engine.heightPixels}`} 
                          xmlns="http://www.w3.org/2000/svg" 
                          style={{ display: 'block' }}
                          onContextMenu={handleContextMenu}
                      >
                        {(() => {
                            const { bars: renderedBars, labels } = renderSegmentedBars(engine, bars, {
                                barSpacing: 0.2,
                                worksheetMode,
                                studentMode,
                                strokeWidth: barStrokeWidth,
                                labelAngle,
                                labelVerticalShift,
                                labelHorizontalShift
                            });
                            return (
                                <>
                                    <defs>
                                       <clipPath id="master-grid-clip">
                                          <rect 
                                            x={config.clipContentX === false ? -5000 : gridArea.xStart} 
                                            y={config.clipContentY === false ? -5000 : gridArea.yStart} 
                                            width={config.clipContentX === false ? 10000 + engine.widthPixels : gridArea.xEnd - gridArea.xStart} 
                                            height={config.clipContentY === false ? 10000 + engine.heightPixels : gridArea.yEnd - gridArea.yStart} 
                                          />
                                       </clipPath>
                                    </defs>
                                    <rect x="0" y="0" width={engine.widthPixels} height={engine.heightPixels} fill="white" />
                                    <g className="grid-layer">{engine.renderGrid()}</g>
                                    <g className="axis-labels-layer">
                                        {engine.renderLabels(
                                            (e) => handleAxisLabelDragStart('x', e),
                                            (e) => handleAxisLabelDragStart('y', e)
                                        )}
                                    </g>
                                    <g className="axis-layer">
                                        {engine.renderAxes(
                                            (axis, side, e) => handleArrowDragStart(axis, side, e)
                                        )}
                                    </g>
                                    <g className="data-layer" clipPath="url(#master-grid-clip)">
                                        {renderedBars}
                                    </g>
                                    <g className="title-layer" data-target-type="title" data-target-id="title">
                                        {chartTitle && engine.texEngine.renderToSVG(
                                            chartTitle, engine.widthPixels/2, 30, engine.cfg.fontSize + 4, 'black', 'middle', false, 'text'
                                        )}
                                    </g>
                                    <g className="category-labels-layer">
                                        {labels}
                                    </g>
                                    <g className="legend-layer">
                                        {renderLegend()}
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
                                </>
                            );
                        })()}
                      </svg>
                    </div>
                  </div>
                  {cropMode && (
                      <div className="absolute top-4 left-1/2 -translate-x-1/2 bg-blue-600 text-white px-4 py-2 rounded-full shadow-lg text-sm font-bold animate-pulse pointer-events-none">
                          Drag to Crop Graph
                      </div>
                  )}
                  <div className="absolute bottom-3 right-4 bg-white/90 backdrop-blur-sm border border-gray-200 rounded-lg px-2.5 py-1 text-[10px] text-gray-500 shadow-sm pointer-events-none">
                      Right-click any segment, column label, or axis for quick actions
                  </div>
                  {contextMenu && (
                      <GraphContextMenu
                          x={contextMenu.x}
                          y={contextMenu.y}
                          header={menuData.header}
                          items={menuData.items}
                          onClose={() => setContextMenu(null)}
                      />
                  )}
                </main>
            </div>
        </div>
    );
};

// Fix: Added missing default export
export default SegmentedBarCharts;
