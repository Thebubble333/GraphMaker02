
import React, { useState, useMemo, useEffect } from 'react';
import { BaseGraphEngine } from '../../utils/graphBase';
import { renderFunctionPlots } from '../../utils/graphRenderers';
import { GLOBAL_CONFIG } from '../../config/graphDefaults';
import { GraphConfig, FunctionDef } from '../../types';
import { Scan, Copy, RefreshCw, Ruler, Grid, Maximize, Settings2, Link2, Link2Off, LayoutTemplate, Palette, List, Plus, Trash2 } from 'lucide-react';
import { CM_TO_PX } from '../../constants';
import * as math from 'mathjs';

import { GraphToolbar } from '../../components/GraphToolbar';
import { useGraphInteraction } from '../../hooks/useGraphInteraction';

// --- Extracted Components (Prevents Remounting/Scroll Reset) ---

const InputGroup = ({ label, children, icon }: { label: string, children?: React.ReactNode, icon?: React.ReactNode }) => (
    <div className="mb-4 border-b border-gray-700 pb-4 last:border-0 last:pb-0">
        <h3 className="text-xs font-bold text-gray-400 uppercase mb-3 flex items-center gap-2">
            {icon} {label}
        </h3>
        <div className="space-y-2">
            {children}
        </div>
    </div>
);

const ConfigNumberInput = ({ 
    label, 
    value, 
    onChange, 
    step = 0.1, 
    min = 0 
}: { 
    label: string, 
    value: number, 
    onChange: (val: number) => void, 
    step?: number, 
    min?: number 
}) => (
    <div className="grid grid-cols-2 items-center gap-2">
        <label className="text-[10px] text-gray-500 font-mono">{label}</label>
        <input 
            type="number" step={step} min={min}
            value={value}
            onChange={(e) => onChange(parseFloat(e.target.value))}
            className="w-full bg-gray-800 border border-gray-700 rounded px-2 py-1 text-xs text-white focus:border-blue-500 outline-none"
        />
    </div>
);

const Calibration: React.FC = () => {
    // 1. Working Copy of Config
    const [config, setConfig] = useState<GraphConfig>({
        ...GLOBAL_CONFIG,
        layoutMode: 'fixed', // Force fixed for calibration to respect dimensions
        targetWidth: 12 * CM_TO_PX,
        targetHeight: 12 * CM_TO_PX
    });
    
    // 2. View State
    const [showDebug, setShowDebug] = useState(true);
    const [activeTab, setActiveTab] = useState<'canvas' | 'style' | 'axis' | 'content'>('canvas');
    
    // 3. Canvas State (Synced with Config)
    const [dimCm, setDimCm] = useState({ width: 12, height: 12 });
    
    // 4. Window State
    const [windowSettings, setWindowSettings] = useState({
        xMin: "-10", xMax: "10", yMin: "-10", yMax: "10",
        xStep: "1", yStep: "1", xSubdivisions: 2, ySubdivisions: 2
    });

    // Test Data
    const [testFunctions, setTestFunctions] = useState<FunctionDef[]>([
        { id: '1', expression: 'sin(x)', color: '#2563eb', strokeWidth: 2, visible: true, domain: [null,null], domainInclusive: [false,false] },
        { id: '2', expression: 'x^2/10 - 2', color: '#dc2626', strokeWidth: 2, visible: true, domain: [null,null], domainInclusive: [false,false] }
    ]);

    // --- Helpers ---
    const parseMath = (input: string | number): number => {
        try {
            const val = math.evaluate(String(input));
            return typeof val === 'number' && isFinite(val) ? val : 0;
        } catch { return 0; }
    };

    // --- Sync Effects ---

    // Sync Dimensions -> Config
    useEffect(() => {
        setConfig(prev => ({
            ...prev,
            targetWidth: Math.round(dimCm.width * CM_TO_PX),
            targetHeight: Math.round(dimCm.height * CM_TO_PX)
        }));
    }, [dimCm]);

    // Sync Window Settings -> Config
    useEffect(() => {
        const xMin = parseMath(windowSettings.xMin);
        const xMax = parseMath(windowSettings.xMax);
        const yMin = parseMath(windowSettings.yMin);
        const yMax = parseMath(windowSettings.yMax);
        let xStep = Math.abs(parseMath(windowSettings.xStep));
        if (xStep < 1e-9) xStep = 1;
        let yStep = Math.abs(parseMath(windowSettings.yStep));
        if (yStep < 1e-9) yStep = 1;
        
        const xSub = Math.max(1, Math.round(Number(windowSettings.xSubdivisions) || 1));
        const ySub = Math.max(1, Math.round(Number(windowSettings.ySubdivisions) || 1));

        setConfig(prev => ({
            ...prev,
            xRange: [xMin, xMax],
            yRange: [yMin, yMax],
            majorStep: [xStep, yStep],
            subdivisions: [xSub, ySub]
        }));
    }, [windowSettings]);

    // Engine
    const engine = useMemo(() => new BaseGraphEngine(config), [config]);

    // Use Shared Interaction Hooks
    const {
        previewScale, setPreviewScale,
        cropMode, setCropMode,
        selectionBox, customViewBox, hasInitialCrop,
        containerRef,
        handleAutoCrop, handleResetView, handleExportPNG, handleExportSVG,
        handleCropMouseDown, handleCropMouseMove, handleCropMouseUp
    } = useGraphInteraction('calib-svg', engine.widthPixels, engine.heightPixels, dimCm.width);

    // Helpers
    const diff = useMemo(() => {
        const d: Partial<GraphConfig> = {};
        (Object.keys(config) as Array<keyof GraphConfig>).forEach(key => {
            if (key === 'layoutMode' || key === 'targetWidth' || key === 'targetHeight') return; // Ignore layout changes for diff
            if (JSON.stringify(config[key]) !== JSON.stringify(GLOBAL_CONFIG[key])) {
                (d as any)[key] = config[key];
            }
        });
        return d;
    }, [config]);

    const handleCopy = () => {
        const text = JSON.stringify(diff, null, 2);
        navigator.clipboard.writeText(text);
        alert(`Copied changes to clipboard:\n${text}`);
    };

    const handleReset = () => {
        if(confirm("Reset all changes to original Global Defaults?")) {
            setConfig({
                ...GLOBAL_CONFIG,
                layoutMode: 'fixed',
                targetWidth: Math.round(dimCm.width * CM_TO_PX),
                targetHeight: Math.round(dimCm.height * CM_TO_PX)
            });
        }
    };

    // Render Debug Overlay
    const renderDebugOverlay = () => {
        if (!showDebug) return null;
        const { xStart, xEnd, yStart, yEnd } = engine.getGridBoundaries();
        
        return (
            <g className="debug-layer" pointerEvents="none">
                {/* Margins */}
                <rect x="0" y="0" width={engine.widthPixels} height={engine.marginTop} fill="rgba(255,0,0,0.1)" stroke="none" />
                <rect x="0" y={engine.heightPixels - engine.marginBottom} width={engine.widthPixels} height={engine.marginBottom} fill="rgba(255,0,0,0.1)" stroke="none" />
                <rect x="0" y="0" width={engine.marginLeft} height={engine.heightPixels} fill="rgba(255,0,0,0.1)" stroke="none" />
                <rect x={engine.widthPixels - engine.marginRight} y="0" width={engine.marginRight} height={engine.heightPixels} fill="rgba(255,0,0,0.1)" stroke="none" />
                
                {/* Content Box */}
                <rect x={xStart} y={yStart} width={xEnd - xStart} height={yEnd - yStart} fill="none" stroke="blue" strokeWidth="1" strokeDasharray="5,5" />
                
                {/* Labels */}
                <text x="5" y="15" fontSize="10" fill="red">Margin Top: {engine.marginTop}px</text>
                <text x="5" y={engine.heightPixels - 5} fontSize="10" fill="red">Margin Bottom: {engine.marginBottom}px</text>
            </g>
        );
    };

    const updateTestFunc = (id: string, updates: Partial<FunctionDef>) => {
        setTestFunctions(prev => prev.map(f => f.id === id ? { ...f, ...updates } : f));
    };

    return (
        <div className="flex h-full bg-gray-900 text-white">
            {/* Sidebar Controls */}
            <aside className="w-96 border-r border-gray-800 flex flex-col h-full bg-gray-950">
                <div className="p-4 border-b border-gray-800 flex justify-between items-center">
                    <h1 className="text-sm font-bold flex items-center gap-2">
                        <Ruler size={16} className="text-blue-500"/> Global Calibration
                    </h1>
                    <button onClick={handleReset} className="text-gray-500 hover:text-red-500" title="Reset to Defaults">
                        <RefreshCw size={14}/>
                    </button>
                </div>

                {/* Tabs */}
                <div className="flex border-b border-gray-800 bg-gray-900/50">
                    <button onClick={() => setActiveTab('canvas')} className={`flex-1 py-3 text-xs font-medium flex justify-center items-center gap-2 transition-colors border-b-2 ${activeTab === 'canvas' ? 'text-blue-400 border-blue-500 bg-blue-500/10' : 'text-gray-500 border-transparent hover:text-gray-300'}`}>
                        <Maximize size={14}/> Canvas
                    </button>
                    <button onClick={() => setActiveTab('style')} className={`flex-1 py-3 text-xs font-medium flex justify-center items-center gap-2 transition-colors border-b-2 ${activeTab === 'style' ? 'text-blue-400 border-blue-500 bg-blue-500/10' : 'text-gray-500 border-transparent hover:text-gray-300'}`}>
                        <Palette size={14}/> Style
                    </button>
                    <button onClick={() => setActiveTab('axis')} className={`flex-1 py-3 text-xs font-medium flex justify-center items-center gap-2 transition-colors border-b-2 ${activeTab === 'axis' ? 'text-blue-400 border-blue-500 bg-blue-500/10' : 'text-gray-500 border-transparent hover:text-gray-300'}`}>
                        <LayoutTemplate size={14}/> Axis
                    </button>
                    <button onClick={() => setActiveTab('content')} className={`flex-1 py-3 text-xs font-medium flex justify-center items-center gap-2 transition-colors border-b-2 ${activeTab === 'content' ? 'text-blue-400 border-blue-500 bg-blue-500/10' : 'text-gray-500 border-transparent hover:text-gray-300'}`}>
                        <List size={14}/> Content
                    </button>
                </div>
                
                <div className="flex-1 overflow-y-auto custom-scrollbar p-4">
                    
                    {activeTab === 'canvas' && (
                        <>
                            <InputGroup label="Canvas Size" icon={<Maximize size={14} />}>
                                <div className="grid grid-cols-2 gap-2 mb-2">
                                    <div>
                                        <label className="block text-[10px] text-gray-500 mb-1">Width (cm)</label>
                                        <input 
                                            type="number" value={dimCm.width} 
                                            onChange={(e) => setDimCm({...dimCm, width: parseFloat(e.target.value)})} 
                                            className="w-full bg-gray-800 border border-gray-700 rounded px-2 py-1 text-xs text-white" 
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-[10px] text-gray-500 mb-1">Height (cm)</label>
                                        <input 
                                            type="number" value={dimCm.height} 
                                            onChange={(e) => setDimCm({...dimCm, height: parseFloat(e.target.value)})} 
                                            className="w-full bg-gray-800 border border-gray-700 rounded px-2 py-1 text-xs text-white" 
                                        />
                                    </div>
                                </div>
                                <div className="text-[10px] text-gray-500 font-mono text-center bg-gray-900 p-1 rounded">
                                    {config.targetWidth}px × {config.targetHeight}px (Scale: {CM_TO_PX.toFixed(2)} px/cm)
                                </div>
                            </InputGroup>

                            <InputGroup label="Window Range" icon={<Grid size={14} />}>
                                <div className="grid grid-cols-2 gap-2">
                                    <div><label className="text-[10px] text-gray-500">X Min</label><input type="text" value={windowSettings.xMin} onChange={(e) => setWindowSettings({...windowSettings, xMin: e.target.value})} className="w-full bg-gray-800 border border-gray-700 rounded px-2 py-1 text-xs text-white"/></div>
                                    <div><label className="text-[10px] text-gray-500">X Max</label><input type="text" value={windowSettings.xMax} onChange={(e) => setWindowSettings({...windowSettings, xMax: e.target.value})} className="w-full bg-gray-800 border border-gray-700 rounded px-2 py-1 text-xs text-white"/></div>
                                    <div><label className="text-[10px] text-gray-500">Y Min</label><input type="text" value={windowSettings.yMin} onChange={(e) => setWindowSettings({...windowSettings, yMin: e.target.value})} className="w-full bg-gray-800 border border-gray-700 rounded px-2 py-1 text-xs text-white"/></div>
                                    <div><label className="text-[10px] text-gray-500">Y Max</label><input type="text" value={windowSettings.yMax} onChange={(e) => setWindowSettings({...windowSettings, yMax: e.target.value})} className="w-full bg-gray-800 border border-gray-700 rounded px-2 py-1 text-xs text-white"/></div>
                                    <div><label className="text-[10px] text-gray-500">X Step</label><input type="text" value={windowSettings.xStep} onChange={(e) => setWindowSettings({...windowSettings, xStep: e.target.value})} className="w-full bg-gray-800 border border-gray-700 rounded px-2 py-1 text-xs text-white"/></div>
                                    <div><label className="text-[10px] text-gray-500">Y Step</label><input type="text" value={windowSettings.yStep} onChange={(e) => setWindowSettings({...windowSettings, yStep: e.target.value})} className="w-full bg-gray-800 border border-gray-700 rounded px-2 py-1 text-xs text-white"/></div>
                                </div>
                            </InputGroup>
                        </>
                    )}

                    {activeTab === 'style' && (
                        <InputGroup label="Rendering Defaults" icon={<Settings2 size={14} />}>
                            <ConfigNumberInput label="fontSize" value={config.fontSize} onChange={v => setConfig({...config, fontSize: v})} step={1} />
                            <ConfigNumberInput label="axisThickness" value={config.axisThickness} onChange={v => setConfig({...config, axisThickness: v})} />
                            <ConfigNumberInput label="tickThickness" value={config.tickThickness} onChange={v => setConfig({...config, tickThickness: v})} />
                            <ConfigNumberInput label="gridThicknessMajor" value={config.gridThicknessMajor} onChange={v => setConfig({...config, gridThicknessMajor: v})} />
                            <ConfigNumberInput label="gridThicknessMinor" value={config.gridThicknessMinor} onChange={v => setConfig({...config, gridThicknessMinor: v})} />
                            <ConfigNumberInput label="asymptoteThickness" value={config.asymptoteThickness} onChange={v => setConfig({...config, asymptoteThickness: v})} />
                            <div className="grid grid-cols-2 items-center gap-2">
                                <label className="text-[10px] text-gray-500 font-mono">asympDash</label>
                                <input type="text" value={config.asymptoteDashArray} onChange={(e) => setConfig({...config, asymptoteDashArray: e.target.value})} className="w-full bg-gray-800 border border-gray-700 rounded px-2 py-1 text-xs text-white"/>
                            </div>
                            <ConfigNumberInput label="offsetXAxisLabelY" value={config.offsetXAxisLabelY} onChange={v => setConfig({...config, offsetXAxisLabelY: v})} step={1} />
                            <ConfigNumberInput label="offsetYAxisLabelX" value={config.offsetYAxisLabelX} onChange={v => setConfig({...config, offsetYAxisLabelX: v})} step={1} />
                            <ConfigNumberInput label="offsetXAxisNumY" value={config.offsetXAxisNumY} onChange={v => setConfig({...config, offsetXAxisNumY: v})} step={1} />
                            <ConfigNumberInput label="basePixelSize" value={config.basePixelSize} onChange={v => setConfig({...config, basePixelSize: v})} step={5} />
                        </InputGroup>
                    )}

                    {activeTab === 'axis' && (
                        <InputGroup label="Axis Configuration" icon={<Settings2 size={14} />}>
                            <div className="grid grid-cols-2 gap-2 mb-3">
                                <label className="flex items-center gap-2 text-xs text-gray-400"><input type="checkbox" checked={config.showXAxis} onChange={(e) => setConfig({...config, showXAxis: e.target.checked})} /> Show X-Axis</label>
                                <label className="flex items-center gap-2 text-xs text-gray-400"><input type="checkbox" checked={config.showYAxis} onChange={(e) => setConfig({...config, showYAxis: e.target.checked})} /> Show Y-Axis</label>
                                <label className="flex items-center gap-2 text-xs text-gray-400"><input type="checkbox" checked={config.showXArrow} onChange={(e) => setConfig({...config, showXArrow: e.target.checked})} /> X Arrow</label>
                                <label className="flex items-center gap-2 text-xs text-gray-400"><input type="checkbox" checked={config.showYArrow} onChange={(e) => setConfig({...config, showYArrow: e.target.checked})} /> Y Arrow</label>
                                <label className="flex items-center gap-2 text-xs text-gray-400"><input type="checkbox" checked={config.showXNumbers} onChange={(e) => setConfig({...config, showXNumbers: e.target.checked})} /> X Numbers</label>
                                <label className="flex items-center gap-2 text-xs text-gray-400"><input type="checkbox" checked={config.showYNumbers} onChange={(e) => setConfig({...config, showYNumbers: e.target.checked})} /> Y Numbers</label>
                                <label className="flex items-center gap-2 text-xs text-gray-400"><input type="checkbox" checked={config.showMinorGrid} onChange={(e) => setConfig({...config, showMinorGrid: e.target.checked})} /> Minor Grid</label>
                                <label className="flex items-center gap-2 text-xs text-gray-400"><input type="checkbox" checked={config.showBorder} onChange={(e) => setConfig({...config, showBorder: e.target.checked})} /> Border Box</label>
                            </div>
                            
                            <div className="space-y-3">
                                <div>
                                    <div className="flex justify-between mb-1"><label className="text-[10px] text-gray-500">X Tick Style</label></div>
                                    <select value={config.xTickStyle} onChange={(e) => setConfig({...config, xTickStyle: e.target.value as any})} className="w-full bg-gray-800 border border-gray-700 rounded text-xs text-white p-1">
                                        <option value="crossing">Crossing</option>
                                        <option value="top">Top</option>
                                        <option value="bottom">Bottom</option>
                                    </select>
                                </div>
                                <div>
                                    <div className="flex justify-between mb-1"><label className="text-[10px] text-gray-500">Y Tick Style</label></div>
                                    <select value={config.yTickStyle} onChange={(e) => setConfig({...config, yTickStyle: e.target.value as any})} className="w-full bg-gray-800 border border-gray-700 rounded text-xs text-white p-1">
                                        <option value="crossing">Crossing</option>
                                        <option value="left">Left</option>
                                        <option value="right">Right</option>
                                    </select>
                                </div>
                                <div>
                                    <div className="flex justify-between mb-1"><label className="text-[10px] text-gray-500">X Label Style</label></div>
                                    <select value={config.xLabelStyle} onChange={(e) => setConfig({...config, xLabelStyle: e.target.value as any})} className="w-full bg-gray-800 border border-gray-700 rounded text-xs text-white p-1">
                                        <option value="arrow-end">Arrow End</option>
                                        <option value="below-center">Below Center</option>
                                    </select>
                                </div>
                                <div>
                                    <div className="flex justify-between mb-1"><label className="text-[10px] text-gray-500">Y Label Style</label></div>
                                    <select value={config.yLabelStyle} onChange={(e) => setConfig({...config, yLabelStyle: e.target.value as any})} className="w-full bg-gray-800 border border-gray-700 rounded text-xs text-white p-1">
                                        <option value="arrow-end">Arrow End</option>
                                        <option value="left-center">Left Center</option>
                                        <option value="right-center">Right Center</option>
                                    </select>
                                </div>
                                <div>
                                    <div className="flex justify-between mb-1"><label className="text-[10px] text-gray-500">Y Rotation</label></div>
                                    <select value={config.yLabelRotation} onChange={(e) => setConfig({...config, yLabelRotation: e.target.value as any})} className="w-full bg-gray-800 border border-gray-700 rounded text-xs text-white p-1">
                                        <option value="horizontal">Horizontal</option>
                                        <option value="vertical">Vertical</option>
                                    </select>
                                </div>
                                <div className="pt-2">
                                    <button 
                                        onClick={() => setConfig({...config, linkAxisLabels: !config.linkAxisLabels})}
                                        className={`w-full py-1 text-xs border rounded flex items-center justify-center gap-2 ${config.linkAxisLabels ? 'bg-blue-900/30 border-blue-800 text-blue-300' : 'bg-gray-800 border-gray-700 text-gray-400'}`}
                                    >
                                        {config.linkAxisLabels ? <Link2 size={12}/> : <Link2Off size={12}/>}
                                        {config.linkAxisLabels ? 'Axis Labels Linked' : 'Axis Labels Unlinked'}
                                    </button>
                                </div>
                            </div>
                        </InputGroup>
                    )}

                    {activeTab === 'content' && (
                        <div className="space-y-4">
                            <div className="flex justify-between items-center mb-2">
                                <h3 className="text-xs font-bold text-gray-400 uppercase">Test Graphs</h3>
                                <button 
                                    onClick={() => setTestFunctions([...testFunctions, { id: Date.now().toString(), expression: '', color: '#ffffff', strokeWidth: 2, visible: true, domain: [null,null], domainInclusive: [false,false] }])}
                                    className="p-1 hover:bg-gray-800 rounded text-blue-400"
                                >
                                    <Plus size={16}/>
                                </button>
                            </div>
                            
                            <div className="space-y-2">
                                {testFunctions.map((f, idx) => (
                                    <div key={f.id} className="bg-gray-900 border border-gray-800 p-2 rounded">
                                        <div className="flex gap-2 mb-2">
                                            <input 
                                                type="text" value={f.expression} 
                                                onChange={(e) => updateTestFunc(f.id, { expression: e.target.value })}
                                                className="flex-1 bg-gray-800 border border-gray-700 rounded px-2 py-1 text-xs text-white"
                                                placeholder="e.g. sin(x)"
                                            />
                                            <button onClick={() => setTestFunctions(prev => prev.filter(funcs => funcs.id !== f.id))} className="text-gray-500 hover:text-red-500">
                                                <Trash2 size={14} />
                                            </button>
                                        </div>
                                        <div className="flex gap-3 items-center">
                                            <input 
                                                type="color" value={f.color} 
                                                onChange={(e) => updateTestFunc(f.id, { color: e.target.value })}
                                                className="w-6 h-6 border-0 rounded cursor-pointer bg-transparent"
                                            />
                                            <div className="flex items-center gap-1">
                                                <span className="text-[10px] text-gray-500">Width</span>
                                                <input 
                                                    type="number" step="0.5" value={f.strokeWidth}
                                                    onChange={(e) => updateTestFunc(f.id, { strokeWidth: parseFloat(e.target.value) })}
                                                    className="w-10 bg-gray-800 border border-gray-700 rounded px-1 text-xs text-white"
                                                />
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>

                <div className="p-4 border-t border-gray-800 bg-gray-900">
                    <div className="flex justify-between items-center mb-2">
                        <span className="text-[10px] uppercase font-bold text-gray-500">Changes: {Object.keys(diff).length}</span>
                    </div>
                    <button 
                        onClick={handleCopy}
                        disabled={Object.keys(diff).length === 0}
                        className="w-full py-2 bg-blue-600 hover:bg-blue-50 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded text-xs font-bold flex items-center justify-center gap-2"
                    >
                        <Copy size={14} /> Copy JSON Diff
                    </button>
                </div>
            </aside>

            {/* Main Preview */}
            <main className="flex-1 flex flex-col overflow-hidden relative" onMouseMove={(e) => handleCropMouseMove(e)} onMouseUp={handleCropMouseUp}>
                <header className="absolute top-0 left-0 w-full z-10 p-4 pointer-events-none flex justify-between">
                    <div className="flex gap-2 pointer-events-auto">
                        <button 
                            onClick={() => setShowDebug(!showDebug)}
                            className={`p-2 rounded text-xs font-medium flex items-center gap-2 transition-colors ${showDebug ? 'bg-red-900/50 text-red-200 border border-red-800' : 'bg-gray-800 text-gray-400 border border-gray-700'}`}
                        >
                            <Scan size={14}/> {showDebug ? 'Hide' : 'Show'} Debug Overlay
                        </button>
                    </div>
                    <div className="pointer-events-auto bg-gray-800 border border-gray-700 rounded-lg p-1 shadow-lg">
                        <GraphToolbar 
                            previewScale={previewScale} setPreviewScale={setPreviewScale}
                            cropMode={cropMode} setCropMode={setCropMode}
                            onResetView={handleResetView} onAutoCrop={handleAutoCrop}
                            onExportPNG={handleExportPNG} onExportSVG={handleExportSVG}
                            onCopy={() => {}}
                        />
                    </div>
                </header>

                <div ref={containerRef} className="flex-1 overflow-auto flex items-center justify-center p-8 bg-gray-800 cursor-crosshair">
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
                            id="calib-svg"
                            width={engine.widthPixels} 
                            height={engine.heightPixels} 
                            viewBox={customViewBox || `0 0 ${engine.widthPixels} ${engine.heightPixels}`}
                            xmlns="http://www.w3.org/2000/svg" 
                            style={{ display: 'block' }}
                        >
                            <defs>
                                <clipPath id="calib-clip">
                                    <rect x={engine.marginLeft} y={engine.marginTop} width={engine.widthPixels - engine.marginLeft - engine.marginRight} height={engine.heightPixels - engine.marginTop - engine.marginBottom} />
                                </clipPath>
                            </defs>
                            <rect x="0" y="0" width={engine.widthPixels} height={engine.heightPixels} fill="white" />
                            
                            {/* Standard Graph Layers */}
                            <g className="grid-layer">{engine.renderGrid()}</g>
                            <g className="axis-labels-layer">{engine.renderLabels()}</g>
                            <g className="axis-layer">{engine.renderAxes()}</g>
                            <g className="data-layer" clipPath="url(#calib-clip)">
                                {renderFunctionPlots(engine, testFunctions)}
                            </g>

                            {/* Debug Overlays */}
                            {renderDebugOverlay()}

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
                    <div className="absolute top-20 left-1/2 -translate-x-1/2 bg-blue-600 text-white px-4 py-2 rounded-full shadow-lg text-sm font-bold animate-pulse pointer-events-none z-20">
                        Drag to Crop Graph
                    </div>
                )}
            </main>
        </div>
    );
};

export default Calibration;
