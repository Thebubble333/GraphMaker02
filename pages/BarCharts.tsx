import React, { useState, useMemo, useEffect } from 'react';
import { BaseGraphEngine } from '../utils/graphBase';
import { renderBarChart } from '../utils/graphRenderers';
import { STATISTICS_CONFIG } from '../config/graphDefaults';
import { GroupedBarSeriesDef, GroupedBarCategoryDef, PatternType, GraphConfig } from '../types';
import { Settings, List, Sliders, Palette, Plus, Trash2, BarChart2, CheckSquare, Grid, FileText, Type } from 'lucide-react';
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
const INITIAL_SERIES: GroupedBarSeriesDef[] = [
    { id: 's1', label: 'Series 1', color: '#9ca3af', pattern: 'none' }
];

const INITIAL_CATEGORIES: GroupedBarCategoryDef[] = [
    { id: 'c1', label: 'A', values: { 's1': 15 } },
    { id: 'c2', label: 'B', values: { 's1': 25 } },
    { id: 'c3', label: 'C', values: { 's1': 10 } },
    { id: 'c4', label: 'D', values: { 's1': 5 } }
];

const BarCharts: React.FC = () => {
    // --- State ---
    const [config, setConfig] = useState<GraphConfig>({
        ...STATISTICS_CONFIG,
        xRange: [0, 4],
        yRange: [0, 30],
        majorStep: [1, 5],
        subdivisions: [1, 1],
        showVerticalGrid: false,
        showMinorGrid: true,
        showXNumbers: false, // We use custom labels
        showXArrow: false,
        showYArrow: true,
        xAxisAt: 'zero', // Ensure x-axis is at y=0 even if yMin < 0
        xAxisExtendLeft: false,
        xAxisExtendRight: false,
        hideLastXTick: true,
        axisLabels: ["Category", "Frequency"],
        fontSize: 11,
        xLabelStyle: 'below-center',
        yLabelStyle: 'left-center',
        yLabelRotation: 'horizontal',
        offsetYAxisLabelX: 10
    });

    const [chartTitle, setChartTitle] = useState("");
    const [series, setSeries] = useState<GroupedBarSeriesDef[]>(INITIAL_SERIES);
    const [categories, setCategories] = useState<GroupedBarCategoryDef[]>(INITIAL_CATEGORIES);
    
    // View Options
    const [worksheetMode, setWorksheetMode] = useState(false);
    const [studentMode, setStudentMode] = useState(false);
    const [barStrokeWidth, setBarStrokeWidth] = useState(2);
    const [barWidth, setBarWidth] = useState(0.6); // Width of bars (0 to 1)
    const [showValues, setShowValues] = useState(false);
    const [showLegend, setShowLegend] = useState(true);
    const [legendPos, setLegendPos] = useState({ x: 0, y: 0 });
    
    // Label Configuration
    const [labelAngle, setLabelAngle] = useState(0);
    const [labelVerticalShift, setLabelVerticalShift] = useState(0);
    const [labelHorizontalShift, setLabelHorizontalShift] = useState(0);
    
    // Layout
    const [dimCm, setDimCm] = useState({ width: 14, height: 10 });
    const [isFixedSize, setIsFixedSize] = useState(true);
    
    // Window Settings (Sync with config)
    const [windowSettings, setWindowSettings] = useState({
        xMin: "0", xMax: "4", yMin: "0", yMax: "30",
        xStep: "1", yStep: "5", xSubdivisions: 1, ySubdivisions: 1
    });

    const [activeTab, setActiveTab] = useState<'data' | 'window' | 'style'>('data');
    
    
    const [csvInput, setCsvInput] = useState("");

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
            targetHeight: Math.round(dimCm.height * CM_TO_PX),
            marginRight: showLegend && series.length > 1 ? 160 : undefined
        }));
    }, [dimCm, isFixedSize, showLegend, series.length]);

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
        handleAutoCrop, handleResetView, handleExportPNG, handleExportSVG, handleCopy, isCopied,
        handleCropMouseDown, handleCropMouseMove, handleCropMouseUp
    } = useGraphInteraction('barchart-svg', engine.widthPixels, engine.heightPixels, dimCm.width, false, false, config.cropPadding);

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
    const addSeries = () => {
        const newId = 's' + Date.now().toString();
        const colors = ['#ef4444', '#3b82f6', '#10b981', '#f59e0b', '#8b5cf6'];
        const newColor = colors[series.length % colors.length];
        setSeries([...series, { 
            id: newId, 
            label: `Series ${series.length + 1}`, 
            color: newColor, 
            pattern: 'none' 
        }]);
    };

    const updateSeries = (id: string, u: Partial<GroupedBarSeriesDef>) => {
        setSeries(prev => prev.map(s => s.id === id ? { ...s, ...u } : s));
    };

    const removeSeries = (id: string) => {
        if (series.length <= 1) return; // Keep at least one series
        setSeries(prev => prev.filter(s => s.id !== id));
        // Clean up values
        setCategories(prev => prev.map(c => {
            const newValues = { ...c.values };
            delete newValues[id];
            return { ...c, values: newValues };
        }));
    };

    const addCategory = () => {
        const newId = 'c' + Date.now().toString();
        const newValues: Record<string, number> = {};
        series.forEach(s => newValues[s.id] = 10);
        
        setCategories([...categories, { 
            id: newId, 
            label: `Cat ${categories.length + 1}`, 
            values: newValues
        }]);
        
        // Update xMax to fit new category
        setWindowSettings(prev => ({
            ...prev,
            xMax: String(categories.length + 1)
        }));
    };

    const updateCategory = (id: string, u: Partial<GroupedBarCategoryDef>) => {
        setCategories(prev => prev.map(c => c.id === id ? { ...c, ...u } : c));
    };

    const updateCategoryValue = (catId: string, seriesId: string, val: number) => {
        setCategories(prev => prev.map(c => {
            if (c.id !== catId) return c;
            return { ...c, values: { ...c.values, [seriesId]: val } };
        }));
    };

    const removeCategory = (id: string) => {
        setCategories(prev => prev.filter(c => c.id !== id));
        setWindowSettings(prev => ({ ...prev, xMax: String(Math.max(1, categories.length - 1)) }));
    };

    const handleImportCSV = () => {
        if (!csvInput.trim()) return;
        
        // Parse CSV like "black, 5, red, 2, green 7" or "black, 5\nred, 2"
        // Split by commas or newlines, then pair them up
        const tokens = csvInput.split(/[\n,]+/).map(t => t.trim()).filter(t => t.length > 0);
        
        const newCategories: GroupedBarCategoryDef[] = [];
        let maxVal = 0;
        
        // Use the first series for import
        const sId = series[0]?.id || 's1';
        
        // Try to parse as pairs
        for (let i = 0; i < tokens.length; i += 2) {
            const label = tokens[i];
            let value = 0;
            if (i + 1 < tokens.length) {
                const parsed = parseFloat(tokens[i + 1]);
                if (!isNaN(parsed)) {
                    value = parsed;
                } else {
                    const parts = label.split(' ');
                    if (parts.length >= 2) {
                        const lastPart = parts[parts.length - 1];
                        const parsedLast = parseFloat(lastPart);
                        if (!isNaN(parsedLast)) {
                            value = parsedLast;
                            newCategories.push({
                                id: Date.now().toString() + i,
                                label: parts.slice(0, -1).join(' '),
                                values: { [sId]: value }
                            });
                            maxVal = Math.max(maxVal, value);
                            i--; // Adjust index since we consumed only one token
                            continue;
                        }
                    }
                }
            } else {
                const parts = label.split(' ');
                if (parts.length >= 2) {
                    const lastPart = parts[parts.length - 1];
                    const parsedLast = parseFloat(lastPart);
                    if (!isNaN(parsedLast)) {
                        value = parsedLast;
                        newCategories.push({
                            id: Date.now().toString() + i,
                            label: parts.slice(0, -1).join(' '),
                            values: { [sId]: value }
                        });
                        maxVal = Math.max(maxVal, value);
                        continue;
                    }
                }
            }
            
            newCategories.push({
                id: Date.now().toString() + i,
                label: label,
                values: { [sId]: value }
            });
            maxVal = Math.max(maxVal, value);
        }
        
        if (newCategories.length > 0) {
            setCategories(newCategories);
            
            // Auto-adjust window
            let yStep = 5;
            if (maxVal > 50) yStep = 10;
            if (maxVal > 100) yStep = 20;
            if (maxVal > 500) yStep = 100;
            if (maxVal <= 10) yStep = 2;
            if (maxVal <= 5) yStep = 1;
            
            const newYMax = Math.ceil(maxVal / yStep) * yStep + yStep;
            
            setWindowSettings(prev => ({
                ...prev,
                xMax: String(newCategories.length),
                yMax: String(newYMax),
                yStep: String(yStep)
            }));
            
            setCsvInput("");
        }
    };

    const renderLegend = () => {
        if (!showLegend || series.length <= 1) return null;
        const { xEnd, yStart } = engine.getGridBoundaries();
        const legX = xEnd + 20 + legendPos.x;
        const legY = yStart + 20 + legendPos.y;
        
        return (
            <g 
                transform={`translate(${legX}, ${legY})`}
                onMouseDown={(e) => {
                    onMouseDown(e, legendPos, (dx, dy, init) => {
                        setLegendPos({ x: init.x + dx, y: init.y + dy });
                    });
                }}
                style={{ cursor: 'move' }}
            >
                <rect x="-10" y="-10" width="120" height={series.length * 25 + 35} fill="white" stroke="black" strokeWidth="1"/>
                <text x="0" y="5" fontSize="12" fontWeight="bold" fontFamily="Times New Roman">Key</text>
                {series.map((item, idx) => (
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

    const gridArea = engine.getGridBoundaries();

    return (
        <div className="flex h-full flex-col bg-gray-50" onMouseMove={handleGlobalMouseMove} onMouseUp={handleGlobalMouseUp}>
            <header className="flex items-center justify-between px-6 py-3 bg-white border-b border-gray-200 shadow-sm z-10">
                <div className="flex items-center gap-3">
                    <div className="p-2 bg-cyan-50 text-cyan-600 rounded-lg"><BarChart2 className="w-5 h-5" /></div>
                    <h1 className="text-xl font-semibold text-gray-800">Bar Charts</h1>
                </div>
                <GraphToolbar 
                    previewScale={previewScale} setPreviewScale={setPreviewScale}
                    exportDpi={exportDpi} onDpiChange={setExportDpi}
                    cropMode={cropMode} setCropMode={setCropMode}
                    onResetView={handleResetView} onAutoCrop={handleAutoCrop}
                    onExportPNG={handleExportPNG} onCopy={handleCopy} isCopied={isCopied} onExportSVG={handleExportSVG}
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
                                
                                <div className="bg-gray-50 p-3 rounded-lg border border-gray-200 space-y-2">
                                    <label className="block text-xs font-bold text-gray-500 uppercase flex items-center gap-1">
                                        <FileText size={14} /> Import CSV Data
                                    </label>
                                    <textarea 
                                        value={csvInput}
                                        onChange={(e) => setCsvInput(e.target.value)}
                                        placeholder="e.g. black, 5, red, 2, green 7"
                                        className="w-full h-20 border rounded p-2 text-xs font-mono resize-none"
                                    />
                                    <button 
                                        onClick={handleImportCSV}
                                        className="w-full py-1.5 bg-cyan-600 text-white rounded text-xs font-bold hover:bg-cyan-700 transition-colors"
                                    >
                                        Import Data
                                    </button>
                                </div>

                                <div className="space-y-2">
                                    <div className="flex justify-between items-center">
                                        <h3 className="text-xs font-bold text-gray-500 uppercase">Series (Groups)</h3>
                                        <button onClick={addSeries} className="text-cyan-600 hover:bg-cyan-50 p-1 rounded"><Plus size={16}/></button>
                                    </div>
                                    <div className="space-y-2">
                                        {series.map((s, idx) => (
                                            <div key={s.id} className="bg-white border rounded p-2 flex flex-col gap-2">
                                                <div className="flex items-center gap-2">
                                                    <span className="text-[10px] text-gray-400 font-mono w-4">{idx+1}</span>
                                                    <input type="text" value={s.label} onChange={(e) => updateSeries(s.id, { label: e.target.value })} className="flex-1 border rounded px-1 py-0.5 text-xs" placeholder="Series Name" />
                                                    {series.length > 1 && (
                                                        <button onClick={() => removeSeries(s.id)} className="text-gray-300 hover:text-red-500"><Trash2 size={14}/></button>
                                                    )}
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    <input type="color" value={s.color} onChange={(e) => updateSeries(s.id, { color: e.target.value })} className="w-6 h-6 border rounded cursor-pointer" />
                                                    <select value={s.pattern} onChange={(e) => updateSeries(s.id, { pattern: e.target.value as PatternType })} className="flex-1 border rounded p-1 text-xs">
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

                                <div className="space-y-2 pt-2 border-t border-gray-200">
                                    <div className="flex justify-between items-center">
                                        <h3 className="text-xs font-bold text-gray-500 uppercase">Categories</h3>
                                        <button onClick={addCategory} className="text-cyan-600 hover:bg-cyan-50 p-1 rounded"><Plus size={16}/></button>
                                    </div>
                                    <div className="space-y-2">
                                        {categories.map((cat, idx) => (
                                            <div key={cat.id} className="bg-white border rounded p-2 flex flex-col gap-2">
                                                <div className="flex items-center gap-2">
                                                    <span className="text-[10px] text-gray-400 font-mono w-4">{idx+1}</span>
                                                    <input type="text" value={cat.label} onChange={(e) => updateCategory(cat.id, { label: e.target.value })} className="flex-1 border rounded px-1 py-0.5 text-xs font-bold" placeholder="Category" />
                                                    <button onClick={() => removeCategory(cat.id)} className="text-gray-300 hover:text-red-500"><Trash2 size={14}/></button>
                                                </div>
                                                <div className="pl-6 space-y-1">
                                                    {series.map(s => (
                                                        <div key={s.id} className="flex items-center gap-2">
                                                            <div className="w-3 h-3 rounded-full" style={{ backgroundColor: s.color }}></div>
                                                            <span className="text-[10px] text-gray-500 w-16 truncate">{s.label}</span>
                                                            <input 
                                                                type="number" 
                                                                value={cat.values[s.id] ?? 0} 
                                                                onChange={(e) => updateCategoryValue(cat.id, s.id, parseFloat(e.target.value))} 
                                                                className="w-16 border rounded px-1 py-0.5 text-xs" 
                                                                placeholder="Val" 
                                                            />
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        )}
                        {activeTab === 'window' && <WindowSettings dimCm={dimCm} setDimCm={setDimCm} isFixedSize={isFixedSize} setIsFixedSize={setIsFixedSize} windowSettings={windowSettings} onSettingChange={(f, v) => setWindowSettings(p => ({...p, [f]: v}))} />}
                        {activeTab === 'style' && (
                            <div className="flex flex-col">
                                <AppearanceSettings 
                                    config={config} 
                                    setConfig={setConfig} 
                                    hideGridOptions={false}
                                    hidePiSteps={true}
                                    hideWhiskerCaps={true}
                                    hideZeroLabel={true}
                                    hideAsymptotes={true}
                                />
                                <div className="p-4 border-t border-gray-200 space-y-4">
                                    <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider flex items-center gap-2"><Grid size={14}/> Graph Options</h3>
                                    
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

                                    <label className={`flex items-center gap-3 p-3 rounded border cursor-pointer transition-colors ${studentMode ? 'bg-cyan-50 border-cyan-300' : 'bg-white border-gray-200'}`}>
                                        <div className={`w-5 h-5 rounded border flex items-center justify-center ${studentMode ? 'bg-cyan-600 border-cyan-600 text-white' : 'bg-white border-gray-300'}`}>
                                            {studentMode && <CheckSquare size={12} />}
                                        </div>
                                        <input 
                                            type="checkbox" 
                                            checked={studentMode} 
                                            onChange={(e) => setStudentMode(e.target.checked)} 
                                            className="hidden"
                                        />
                                        <div className="flex-1">
                                            <span className="block text-xs font-bold text-gray-700 uppercase">Student Mode</span>
                                            <span className="text-[10px] text-gray-400">Hides bars and labels for student completion</span>
                                        </div>
                                    </label>

                                    <label className={`flex items-center gap-3 p-3 rounded border cursor-pointer transition-colors ${showValues ? 'bg-cyan-50 border-cyan-300' : 'bg-white border-gray-200'}`}>
                                        <div className={`w-5 h-5 rounded border flex items-center justify-center ${showValues ? 'bg-cyan-600 border-cyan-600 text-white' : 'bg-white border-gray-300'}`}>
                                            {showValues && <CheckSquare size={12} />}
                                        </div>
                                        <input 
                                            type="checkbox" 
                                            checked={showValues} 
                                            onChange={(e) => setShowValues(e.target.checked)} 
                                            className="hidden"
                                        />
                                        <div className="flex-1">
                                            <span className="block text-xs font-bold text-gray-700 uppercase">Show Values</span>
                                            <span className="text-[10px] text-gray-400">Display value above each bar</span>
                                        </div>
                                    </label>

                                    {series.length > 1 && (
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
                                                    <span className="text-[10px] text-gray-400">Display key for grouped series</span>
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
                                            <span>Bar Width / Spacing</span>
                                            <span className="font-mono">{Math.round(barWidth * 100)}%</span>
                                        </label>
                                        <input 
                                            type="range" min="0.1" max="1" step="0.05"
                                            value={barWidth}
                                            onChange={(e) => setBarWidth(parseFloat(e.target.value))}
                                            className="w-full h-1.5 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-cyan-600"
                                        />
                                        <div className="flex justify-between text-[10px] text-gray-400 mt-1">
                                            <span>Thin</span>
                                            <span>No Gap</span>
                                        </div>
                                    </div>

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
                          id="barchart-svg" 
                          width={engine.widthPixels} 
                          height={engine.heightPixels} 
                          viewBox={customViewBox || `0 0 ${engine.widthPixels} ${engine.heightPixels}`} 
                          xmlns="http://www.w3.org/2000/svg" 
                          style={{ display: 'block' }}
                      >
                        {(() => {
                            const { bars, labels } = renderBarChart(engine, categories, series, {
                                barWidth,
                                worksheetMode,
                                studentMode,
                                strokeWidth: barStrokeWidth,
                                showValues,
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
                                        {bars}
                                    </g>
                                    <g className="title-layer">
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
                </main>
            </div>
        </div>
    );
};

export default BarCharts;
