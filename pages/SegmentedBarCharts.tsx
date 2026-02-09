
import React, { useState, useMemo, useEffect } from 'react';
import { BaseGraphEngine } from '../utils/graphBase';
import { renderSegmentedBars } from '../utils/graphRenderers';
import { STATISTICS_CONFIG } from '../config/graphDefaults';
import { BarGroupDef, BarSegmentDef, PatternType, GraphConfig } from '../types';
import { Settings, List, Sliders, Palette, Plus, Trash2, Layers, CheckSquare, Grid } from 'lucide-react';
import { CM_TO_PX } from '../constants';
import * as math from 'mathjs';

import { GraphToolbar } from '../components/GraphToolbar';
import { useGraphInteraction } from '../hooks/useGraphInteraction';
import { useDragSystem } from '../hooks/useDragSystem';
import { calculateAxisLabelDrag, calculateAxisResize } from '../utils/dragStrategies';
import { RichInput } from '../components/ui/RichInput';

import { WindowSettings } from '../components/settings/WindowSettings';
import { AppearanceSettings } from '../components/settings/AppearanceSettings';

// Default Data
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

const SegmentedBarCharts: React.FC = () => {
    // --- State ---
    const [config, setConfig] = useState<GraphConfig>({
        ...STATISTICS_CONFIG,
        // Segmented Bar Specific Overrides
        xRange: [0, 3], // 2 bars -> indices 1, 2. Space around 0 and 3.
        yRange: [0, 100],
        majorStep: [1, 10],
        subdivisions: [1, 2],
        showVerticalGrid: false,
        showXNumbers: false, // We use custom labels
        showXArrow: false, // OFF by default
        showYArrow: false, // OFF by default
        axisLabels: ["", "Percentage of Market Share"],
        fontSize: 16,
        xLabelStyle: 'below-center',
        yLabelStyle: 'left-center',
        yLabelRotation: 'horizontal',
        offsetYAxisLabelX: 10 // Push right slightly closer to axis
    });

    const [chartTitle, setChartTitle] = useState("");
    const [bars, setBars] = useState<BarGroupDef[]>(INITIAL_BARS);
    const [selectedBarId, setSelectedBarId] = useState<string | null>(INITIAL_BARS[0].id);
    
    // View Options
    const [worksheetMode, setWorksheetMode] = useState(false);
    const [barStrokeWidth, setBarStrokeWidth] = useState(2);
    
    // Layout
    const [dimCm, setDimCm] = useState({ width: 14, height: 10 });
    const [isFixedSize, setIsFixedSize] = useState(true);
    
    // Window Settings (Sync with config)
    const [windowSettings, setWindowSettings] = useState({
        xMin: "0", xMax: "3", yMin: "0", yMax: "100",
        xStep: "1", yStep: "10", xSubdivisions: 1, ySubdivisions: 2
    });

    const [activeTab, setActiveTab] = useState<'data' | 'window' | 'style'>('data');
    const [isCopied, setIsCopied] = useState(false);

    // --- Effects & Sync ---
    
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
            targetHeight: Math.round(dimCm.height * CM_TO_PX)
        }));
    }, [dimCm, isFixedSize]);

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
        cropMode, setCropMode,
        selectionBox, customViewBox, hasInitialCrop,
        containerRef,
        handleAutoCrop, handleResetView, handleExportPNG, handleExportSVG,
        handleCropMouseDown, handleCropMouseMove, handleCropMouseUp
    } = useGraphInteraction('segbar-svg', engine.widthPixels, engine.heightPixels, dimCm.width);

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
    };

    const updateBar = (id: string, u: Partial<BarGroupDef>) => {
        setBars(prev => prev.map(b => b.id === id ? { ...b, ...u } : b));
    };

    const removeBar = (id: string) => {
        setBars(prev => prev.filter(b => b.id !== id));
        if (selectedBarId === id) setSelectedBarId(null);
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

    // Auto-Legend Generation
    const legendItems = useMemo(() => {
        const map = new Map<string, BarSegmentDef>();
        bars.forEach(b => b.segments.forEach(s => {
            // Key by label to consolidate
            if (!map.has(s.label)) map.set(s.label, s);
        }));
        return Array.from(map.values());
    }, [bars]);

    const renderLegend = () => {
        if (legendItems.length === 0) return null;
        // Position Legend on right side or floating? 
        // For standard graph paper, typically on the right outside margin.
        // We'll calculate a position relative to the grid.
        const { xEnd, yStart } = engine.getGridBoundaries();
        const legX = xEnd + 40;
        const legY = yStart + 20;
        
        return (
            <g transform={`translate(${legX}, ${legY})`}>
                <rect x="-10" y="-10" width="120" height={legendItems.length * 25 + 35} fill="white" stroke="black" strokeWidth="1"/>
                <text x="0" y="5" fontSize="12" fontWeight="bold" fontFamily="Times New Roman">Key</text>
                {legendItems.map((item, idx) => (
                    <g key={item.id} transform={`translate(0, ${25 + idx * 25})`}>
                        {/* Sample Box */}
                        <rect x="0" y="0" width="15" height="15" fill={worksheetMode ? 'white' : item.color} stroke="black" strokeWidth="1"/>
                        {!worksheetMode && item.pattern !== 'none' && (
                            <rect x="0" y="0" width="15" height="15" fill={`url(#pat-${item.pattern})`} stroke="none" style={{mixBlendMode:'multiply'}}/>
                        )}
                        <text x="25" y="12" fontSize="12" fontFamily="Times New Roman">{item.label}</text>
                    </g>
                ))}
            </g>
        );
    };

    const gridArea = engine.getGridBoundaries();

    return (
        <div className="flex h-full flex-col bg-gray-50" onMouseMove={handleGlobalMouseMove} onMouseUp={handleGlobalMouseUp}>
            <header className="flex items-center justify-between px-6 py-3 bg-white border-b border-gray-200 shadow-sm z-10">
                <div className="flex items-center gap-3">
                    <div className="p-2 bg-cyan-50 text-cyan-600 rounded-lg"><Layers className="w-5 h-5" /></div>
                    <h1 className="text-xl font-semibold text-gray-800">Segmented Bar Charts</h1>
                </div>
                <GraphToolbar 
                    previewScale={previewScale} setPreviewScale={setPreviewScale}
                    cropMode={cropMode} setCropMode={setCropMode}
                    onResetView={handleResetView} onAutoCrop={handleAutoCrop}
                    onExportPNG={handleExportPNG} onExportSVG={handleExportSVG}
                    onCopy={() => {}} isCopied={isCopied}
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
                                <div>
                                    <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Chart Title</label>
                                    <RichInput 
                                        value={chartTitle}
                                        onChange={(e) => setChartTitle(e.target.value)}
                                        className="w-full border rounded px-2 py-1 text-sm"
                                        placeholder="Optional Title..."
                                    />
                                </div>

                                {/* Bar Selector */}
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
                                    <div className="bg-gray-50 rounded-lg border border-gray-200 p-3 space-y-3">
                                        <div className="flex items-center gap-2">
                                            <RichInput 
                                                value={selectedBar.label}
                                                onChange={(e) => updateBar(selectedBar.id, { label: e.target.value })}
                                                className="flex-1 border rounded px-2 py-1 text-sm font-bold"
                                                placeholder="Bar Label"
                                            />
                                            <div className="flex items-center gap-1 bg-white border rounded px-1">
                                                <span className="text-[10px] text-gray-400">W</span>
                                                <input 
                                                    type="number" step="0.1" 
                                                    value={selectedBar.width} 
                                                    onChange={(e) => updateBar(selectedBar.id, { width: parseFloat(e.target.value) })}
                                                    className="w-10 border-0 p-1 text-xs focus:ring-0"
                                                />
                                            </div>
                                            <button onClick={() => removeBar(selectedBar.id)} className="text-gray-400 hover:text-red-500"><Trash2 size={16}/></button>
                                        </div>

                                        <div className="space-y-2">
                                            <div className="flex justify-between items-center">
                                                <span className="text-[10px] font-bold text-gray-400 uppercase">Segments (Bottom-Up)</span>
                                                <button onClick={() => addSegment(selectedBar.id)} className="text-cyan-600 hover:bg-white p-1 rounded"><Plus size={14}/></button>
                                            </div>
                                            
                                            {selectedBar.segments.map((seg, idx) => (
                                                <div key={seg.id} className="bg-white border rounded p-2 flex flex-col gap-2">
                                                    <div className="flex items-center gap-2">
                                                        <span className="text-[10px] text-gray-400 font-mono w-4">{idx+1}</span>
                                                        <input 
                                                            type="text" value={seg.label}
                                                            onChange={(e) => updateSegment(selectedBar.id, seg.id, { label: e.target.value })}
                                                            className="flex-1 border rounded px-1 py-0.5 text-xs"
                                                            placeholder="Category"
                                                        />
                                                        <input 
                                                            type="number" value={seg.value}
                                                            onChange={(e) => updateSegment(selectedBar.id, seg.id, { value: parseFloat(e.target.value) })}
                                                            className="w-12 border rounded px-1 py-0.5 text-xs"
                                                            placeholder="Val"
                                                        />
                                                        <button onClick={() => removeSegment(selectedBar.id, seg.id)} className="text-gray-300 hover:text-red-500"><Trash2 size={12}/></button>
                                                    </div>
                                                    <div className="flex items-center gap-2">
                                                        <input 
                                                            type="color" value={seg.color}
                                                            onChange={(e) => updateSegment(selectedBar.id, seg.id, { color: e.target.value })}
                                                            className="w-5 h-5 border rounded cursor-pointer"
                                                            title="Fill Color"
                                                        />
                                                        <select 
                                                            value={seg.pattern}
                                                            onChange={(e) => updateSegment(selectedBar.id, seg.id, { pattern: e.target.value as PatternType })}
                                                            className="flex-1 border rounded p-0.5 text-[10px]"
                                                        >
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
                                <AppearanceSettings config={config} setConfig={setConfig} togglePiX={()=>{}} togglePiY={()=>{}} />
                                
                                <div className="p-4 border-t border-gray-200 space-y-4">
                                    <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider flex items-center gap-2">
                                        <Grid size={14}/> Graph Options
                                    </h3>
                                    
                                    <label className={`flex items-center gap-3 p-3 rounded border cursor-pointer transition-colors ${worksheetMode ? 'bg-cyan-50 border-cyan-300' : 'bg-white border-gray-200'}`}>
                                        <div className={`w-5 h-5 rounded border flex items-center justify-center ${worksheetMode ? 'bg-cyan-600 border-cyan-600 text-white' : 'bg-white border-gray-300'}`}>
                                            {worksheetMode && <CheckSquare size={12}/>}
                                        </div>
                                        <input 
                                            type="checkbox" 
                                            checked={worksheetMode}
                                            onChange={(e) => setWorksheetMode(e.target.checked)}
                                            className="hidden"
                                        />
                                        <div>
                                            <span className="block text-sm font-medium text-gray-800">Worksheet Mode</span>
                                            <span className="block text-[10px] text-gray-500">Hide fills & patterns (Outlines only)</span>
                                        </div>
                                    </label>

                                    <div>
                                        <label className="block text-xs text-gray-500 mb-1">Bar Outline Thickness</label>
                                        <input 
                                            type="range" min="1" max="5" step="0.5" 
                                            value={barStrokeWidth}
                                            onChange={(e) => setBarStrokeWidth(parseFloat(e.target.value))}
                                            className="w-full accent-cyan-600"
                                        />
                                    </div>
                                </div>
                            </div>
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
                                id="segbar-svg" 
                                width={engine.widthPixels} 
                                height={engine.heightPixels} 
                                viewBox={customViewBox || `0 0 ${engine.widthPixels} ${engine.heightPixels}`} 
                                xmlns="http://www.w3.org/2000/svg" 
                                style={{ display: 'block' }}
                            >
                                <defs>
                                   <clipPath id="master-grid-clip">
                                      <rect x={gridArea.xStart} y={gridArea.yStart} width={gridArea.xEnd - gridArea.xStart} height={gridArea.yEnd - gridArea.yStart} />
                                   </clipPath>
                                </defs>
                                <rect x="0" y="0" width={engine.widthPixels} height={engine.heightPixels} fill="white" />
                                
                                <g className="grid-layer">{engine.renderGrid()}</g>
                                <g className="axis-labels-layer">
                                    {/* Chart Title */}
                                    {chartTitle && engine.texEngine.renderToSVG(
                                        chartTitle, engine.widthPixels/2, engine.marginTop - 20, config.fontSize + 4, 'black', 'middle', false, 'text'
                                    )}
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
                                
                                {/* Bars */}
                                <g className="data-layer">
                                    {renderSegmentedBars(engine, bars, {
                                        barSpacing: 0, 
                                        worksheetMode,
                                        strokeWidth: barStrokeWidth
                                    })}
                                    {renderLegend()}
                                </g>

                                {/* Crop Overlay inside SVG */}
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
                        <div className="absolute top-4 left-1/2 -translate-x-1/2 bg-blue-600 text-white px-4 py-2 rounded-full shadow-lg text-sm font-bold animate-pulse pointer-events-none">
                            Drag to Crop Graph
                        </div>
                    )}
                </main>
            </div>
        </div>
    );
};

export default SegmentedBarCharts;
