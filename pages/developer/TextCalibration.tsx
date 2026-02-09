
import React, { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import { TexEngine, DEFAULT_TEXT_METRICS, TextLayoutMetrics } from '../../utils/textRenderer';
import { useDragSystem } from '../../hooks/useDragSystem';
import { useGraphInteraction } from '../../hooks/useGraphInteraction';
import { GraphToolbar } from '../../components/GraphToolbar';
import { Type, RotateCcw, RefreshCw, Upload, Trash2, Copy, Move, Maximize, Scan } from 'lucide-react';

interface MetricControlProps {
    label: string;
    field: keyof TextLayoutMetrics;
    value: number;
    onChange: (field: keyof TextLayoutMetrics, val: number) => void;
    onReset: (field: keyof TextLayoutMetrics) => void;
    min: number;
    max: number;
    step?: number;
}

// Defined outside to prevent re-creation on render (fixes input focus loss)
const MetricControl: React.FC<MetricControlProps> = React.memo(({ label, field, value, onChange, onReset, min, max, step = 0.005 }) => {
    const isDefault = value === DEFAULT_TEXT_METRICS[field];
    return (
        <div className="mb-3">
            <div className="flex justify-between items-center mb-1">
                <label className={`text-[10px] font-mono uppercase ${!isDefault ? 'text-blue-400 font-bold' : 'text-gray-400'}`}>
                    {label}
                </label>
                <div className="flex items-center gap-1">
                    <input 
                        type="number" step={step}
                        value={value}
                        onChange={(e) => onChange(field, parseFloat(e.target.value))}
                        className={`w-16 border rounded px-1 text-[10px] text-right focus:outline-none ${!isDefault ? 'bg-blue-900/30 border-blue-500 text-blue-200' : 'bg-gray-800 border-gray-700 text-white'}`}
                    />
                    <button 
                        onClick={() => onReset(field)} 
                        title="Reset"
                        className="text-gray-600 hover:text-white"
                    >
                        <RefreshCw size={8} />
                    </button>
                </div>
            </div>
            <input 
                type="range" min={min} max={max} step={step}
                value={value}
                onChange={(e) => onChange(field, parseFloat(e.target.value))}
                className="w-full h-1 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-green-500"
            />
        </div>
    );
});

interface BgImage {
    url: string;
    x: number;
    y: number;
    width: number;
    height: number;
    opacity: number;
    originalWidth: number;
    originalHeight: number;
}

const TextCalibration: React.FC = () => {
    // Canvas Constants
    const widthPixels = 2000;
    const heightPixels = 1200;

    // Configuration State
    const [metrics, setMetrics] = useState<TextLayoutMetrics>(DEFAULT_TEXT_METRICS);
    const [showBoundingBoxes, setShowBoundingBoxes] = useState(false);
    
    // Updated test string to show mixed mode capabilities
    const [testLatex, setTestLatex] = useState("$a+b-c \\times d = \\frac{1}{2}$");
    const [compFunc, setCompFunc] = useState("$y = \\sqrt{\\frac{x^2 + 1}{2x}}$");
    const [fontSize, setFontSize] = useState(40); 
    
    // Reference Image State
    const [bgImage, setBgImage] = useState<BgImage | null>(null);

    // Viewport State - Centered by default
    const [textPos, setTextPos] = useState({ x: widthPixels / 2, y: heightPixels / 2 });
    const [activeTab, setActiveTab] = useState<'global' | 'spacing' | 'frac' | 'surd' | 'script' | 'delim' | 'ref'>('global');

    // Engine
    const tex = useMemo(() => new TexEngine(metrics), [metrics]);

    // Interaction Hooks
    const {
        previewScale, setPreviewScale,
        cropMode, setCropMode,
        containerRef,
        handleResetView, handleAutoCrop, handleExportPNG, handleExportSVG,
        handleCropMouseDown, handleCropMouseMove, handleCropMouseUp
    } = useGraphInteraction('text-calib-svg', widthPixels, heightPixels, 30, false, true); // skipAutoFit = true

    // Center Viewport on Mount
    useEffect(() => {
        if (containerRef.current) {
            // Scroll to center of the 2000x1200 canvas
            const { scrollWidth, clientWidth, scrollHeight, clientHeight } = containerRef.current;
            containerRef.current.scrollLeft = (scrollWidth - clientWidth) / 2;
            containerRef.current.scrollTop = (scrollHeight - clientHeight) / 2;
        }
    }, []);

    // Drag Logic (Text & Image)
    const { onMouseDown, onMouseMove, onMouseUp } = useDragSystem(previewScale);

    // Panning Logic
    const [isPanning, setIsPanning] = useState(false);
    const panStartRef = useRef<{ x: number, y: number, scrollX: number, scrollY: number } | null>(null);

    const updateBgImage = (updates: Partial<BgImage>) => {
        setBgImage(prev => prev ? { ...prev, ...updates } : null);
    };

    const handleTextDrag = (e: React.MouseEvent) => {
        // Prevent element drag if we are panning (Shift key down)
        if (e.shiftKey || e.button === 1) return;
        
        onMouseDown(e, { ...textPos }, (dx, dy, init) => {
            setTextPos({ x: init.x + dx, y: init.y + dy });
        }, undefined, 'text');
    };

    const handleImageDrag = (e: React.MouseEvent) => {
        if (!bgImage || e.shiftKey || e.button === 1) return;
        onMouseDown(e, { x: bgImage.x, y: bgImage.y }, (dx, dy, init) => {
            updateBgImage({ x: init.x + dx, y: init.y + dy });
        }, undefined, 'image');
    };

    // Main Canvas Mouse Handlers (Delegation)
    const handleCanvasMouseDown = (e: React.MouseEvent) => {
        if (e.shiftKey || e.button === 1) { // Shift+Left or Middle Click -> Pan
            e.preventDefault();
            if (containerRef.current) {
                setIsPanning(true);
                panStartRef.current = {
                    x: e.clientX,
                    y: e.clientY,
                    scrollX: containerRef.current.scrollLeft,
                    scrollY: containerRef.current.scrollTop
                };
            }
        } else {
            // Otherwise, delegate to crop tool
            handleCropMouseDown(e);
        }
    };

    const handleCanvasMouseMove = (e: React.MouseEvent) => {
        if (isPanning && panStartRef.current && containerRef.current) {
            e.preventDefault();
            const dx = e.clientX - panStartRef.current.x;
            const dy = e.clientY - panStartRef.current.y;
            containerRef.current.scrollLeft = panStartRef.current.scrollX - dx;
            containerRef.current.scrollTop = panStartRef.current.scrollY - dy;
        } else {
            onMouseMove(e); // Handle Element Drag
            handleCropMouseMove(e); // Handle Crop Selection
        }
    };

    const handleCanvasMouseUp = () => {
        setIsPanning(false);
        panStartRef.current = null;
        onMouseUp();
        handleCropMouseUp();
    };

    const handleReset = () => {
        if (confirm("Reset to defaults?")) setMetrics(DEFAULT_TEXT_METRICS);
    };

    const handleMetricChange = useCallback((field: keyof TextLayoutMetrics, val: number | boolean) => {
        setMetrics(prev => ({ ...prev, [field]: val }));
    }, []);

    const handleMetricReset = useCallback((field: keyof TextLayoutMetrics) => {
        setMetrics(prev => ({ ...prev, [field]: DEFAULT_TEXT_METRICS[field] }));
    }, []);

    const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (ev) => {
            if (ev.target?.result) {
                const img = new Image();
                img.onload = () => {
                    setBgImage({
                        url: ev.target!.result as string,
                        x: 50, y: 50,
                        width: img.width, 
                        height: img.height,
                        opacity: 0.5,
                        originalWidth: img.width,
                        originalHeight: img.height
                    });
                };
                img.src = ev.target!.result as string;
            }
        };
        reader.readAsDataURL(file);
    };

    const handleScaleChange = (scale: number) => {
        if (!bgImage) return;
        updateBgImage({
            width: bgImage.originalWidth * scale,
            height: bgImage.originalHeight * scale
        });
    };

    const handleExportDiff = () => {
        const diff: Partial<TextLayoutMetrics> = {};
        let hasChanges = false;
        (Object.keys(metrics) as Array<keyof TextLayoutMetrics>).forEach(key => {
            if (metrics[key] !== DEFAULT_TEXT_METRICS[key]) {
                // @ts-ignore
                diff[key] = metrics[key];
                hasChanges = true;
            }
        });
        
        if (!hasChanges) {
            alert("No changes from defaults to export.");
            return;
        }

        const json = JSON.stringify(diff, null, 2);
        navigator.clipboard.writeText(json);
        alert(`Exported changes to clipboard:\n${json}`);
    };

    const currentImageScale = bgImage ? bgImage.width / bgImage.originalWidth : 1;

    // Helper for rendering tabs
    const TabButton = ({ id, label }: { id: typeof activeTab, label: string }) => (
        <button 
            onClick={() => setActiveTab(id)} 
            className={`flex-1 py-2 text-[10px] uppercase font-bold border-b-2 transition-colors ${activeTab === id ? 'border-green-500 text-green-400 bg-green-500/10' : 'border-transparent text-gray-500 hover:text-gray-300'}`}
        >
            {label}
        </button>
    );

    return (
        <div 
            className="flex h-full bg-gray-900 text-white overflow-hidden" 
            onMouseMove={handleCanvasMouseMove} 
            onMouseUp={handleCanvasMouseUp}
        >
            {/* Sidebar Controls */}
            <aside className="w-80 border-r border-gray-800 flex flex-col h-full bg-gray-950 z-20">
                <div className="p-4 border-b border-gray-800 flex justify-between items-center">
                    <h1 className="text-sm font-bold flex items-center gap-2">
                        <Type size={16} className="text-green-500"/> TeX Calibration
                    </h1>
                    <button onClick={handleReset} className="text-gray-500 hover:text-red-500"><RotateCcw size={14}/></button>
                </div>

                <div className="flex flex-wrap border-b border-gray-800 bg-gray-900/50">
                    <TabButton id="global" label="Glob" />
                    <TabButton id="spacing" label="Space" />
                    <TabButton id="frac" label="Frac" />
                    <TabButton id="surd" label="Surd" />
                    <TabButton id="script" label="Script" />
                    <TabButton id="delim" label="Delim" />
                    <TabButton id="ref" label="Ref" />
                </div>

                <div className="flex-1 overflow-y-auto custom-scrollbar p-4 space-y-6">
                    
                    {/* Metrics Sections */}
                    <div className="space-y-1">
                        {activeTab === 'ref' && (
                            <div className="space-y-4">
                                <label className="block text-xs font-bold text-gray-500 uppercase">Reference Image</label>
                                {!bgImage ? (
                                    <label className="flex flex-col items-center justify-center p-6 border-2 border-dashed border-gray-700 rounded-lg cursor-pointer hover:bg-gray-800 transition-colors">
                                        <Upload size={24} className="text-gray-500 mb-2" />
                                        <span className="text-xs text-gray-400">Upload Screenshot</span>
                                        <input type="file" accept="image/*" className="hidden" onChange={handleImageUpload} />
                                    </label>
                                ) : (
                                    <div className="bg-gray-900 border border-gray-800 rounded p-3 space-y-3">
                                        <div className="flex justify-between items-center">
                                            <span className="text-[10px] text-green-400 font-bold uppercase">Image Loaded</span>
                                            <button onClick={() => setBgImage(null)} className="text-red-500 hover:text-red-400"><Trash2 size={14}/></button>
                                        </div>
                                        
                                        <div>
                                            <label className="block text-[10px] text-gray-500 mb-1">Opacity: {Math.round(bgImage.opacity * 100)}%</label>
                                            <input 
                                                type="range" min="0" max="1" step="0.05"
                                                value={bgImage.opacity}
                                                onChange={(e) => updateBgImage({ opacity: parseFloat(e.target.value) })}
                                                className="w-full h-1 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-green-500"
                                            />
                                        </div>

                                        <div>
                                            <label className="flex justify-between text-[10px] text-gray-500 mb-1">
                                                <span>Scale</span>
                                                <span className="text-blue-400">{currentImageScale.toFixed(2)}x</span>
                                            </label>
                                            <div className="flex items-center gap-2">
                                                <Move size={12} className="text-gray-500"/>
                                                <input 
                                                    type="range" min="0.1" max="3" step="0.01"
                                                    value={currentImageScale}
                                                    onChange={(e) => handleScaleChange(parseFloat(e.target.value))}
                                                    className="w-full h-1 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-blue-500"
                                                />
                                                <Maximize size={12} className="text-gray-500"/>
                                            </div>
                                        </div>

                                        <div className="grid grid-cols-2 gap-2 pt-2 border-t border-gray-800">
                                            <div>
                                                <label className="block text-[10px] text-gray-500">X Pos</label>
                                                <input type="number" value={Math.round(bgImage.x)} onChange={(e) => updateBgImage({ x: parseFloat(e.target.value) })} className="w-full bg-gray-800 border border-gray-700 rounded px-1 py-0.5 text-xs text-white"/>
                                            </div>
                                            <div>
                                                <label className="block text-[10px] text-gray-500">Y Pos</label>
                                                <input type="number" value={Math.round(bgImage.y)} onChange={(e) => updateBgImage({ y: parseFloat(e.target.value) })} className="w-full bg-gray-800 border border-gray-700 rounded px-1 py-0.5 text-xs text-white"/>
                                            </div>
                                        </div>
                                        <div className="text-[10px] text-gray-500 italic text-center pt-1">
                                            Drag image on canvas to move.
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}

                        {activeTab === 'global' && (
                            <>
                                <h4 className="text-[10px] font-bold text-gray-500 uppercase mb-2">Basic Metrics</h4>
                                <MetricControl label="Axis Height" field="axisHeight" value={metrics.axisHeight} onChange={handleMetricChange} onReset={handleMetricReset} min={0} max={0.8} />
                                <MetricControl label="Rule Thickness" field="ruleThickness" value={metrics.ruleThickness} onChange={handleMetricChange} onReset={handleMetricReset} min={0.01} max={0.2} step={0.005} />
                                <MetricControl label="Italic Correction" field="italicCorrectionDefault" value={metrics.italicCorrectionDefault} onChange={handleMetricChange} onReset={handleMetricReset} min={0} max={0.3} />
                                <div className="my-3 border-t border-gray-800"></div>
                                <h4 className="text-[10px] font-bold text-blue-400 mb-2">Operator Adjustment</h4>
                                <MetricControl label="Op Vertical Shift" field="operatorShift" value={metrics.operatorShift} onChange={handleMetricChange} onReset={handleMetricReset} min={-0.5} max={0.5} />
                                <div className="mt-3">
                                    <label className="flex items-center gap-2 text-xs text-gray-300 cursor-pointer">
                                        <input 
                                            type="checkbox" 
                                            checked={metrics.autoCenterOperators} 
                                            onChange={(e) => handleMetricChange('autoCenterOperators', e.target.checked)}
                                            className="rounded border-gray-600 bg-gray-800 text-blue-500 focus:ring-offset-gray-900"
                                        />
                                        Auto-Center Operators (Symmetric Glue)
                                    </label>
                                </div>
                            </>
                        )}

                        {activeTab === 'spacing' && (
                            <>
                                <h4 className="text-[10px] font-bold text-blue-400 mb-2">HORIZONTAL GLUE</h4>
                                <MetricControl label="Ord - Bin (a +)" field="glueOrdBin" value={metrics.glueOrdBin} onChange={handleMetricChange} onReset={handleMetricReset} min={0} max={1.0} />
                                <MetricControl label="Bin - Ord (+ b)" field="glueBinOrd" value={metrics.glueBinOrd} onChange={handleMetricChange} onReset={handleMetricReset} min={0} max={1.0} />
                                <MetricControl label="Ord - Rel (x =)" field="glueOrdRel" value={metrics.glueOrdRel} onChange={handleMetricChange} onReset={handleMetricReset} min={0} max={1.0} />
                                <MetricControl label="Rel - Ord (= 5)" field="glueRelOrd" value={metrics.glueRelOrd} onChange={handleMetricChange} onReset={handleMetricReset} min={0} max={1.0} />
                                <MetricControl label="Ord - Punct (x, )" field="glueOrdPunct" value={metrics.glueOrdPunct} onChange={handleMetricChange} onReset={handleMetricReset} min={0} max={1.0} />
                                <div className="my-3 border-t border-gray-800"></div>
                                <MetricControl label="Script H-Gap" field="scriptHorizontalGap" value={metrics.scriptHorizontalGap} onChange={handleMetricChange} onReset={handleMetricReset} min={0} max={0.2} />
                            </>
                        )}

                        {activeTab === 'frac' && (
                            <>
                                <h4 className="text-[10px] font-bold text-blue-400 mb-2">FRACTIONS</h4>
                                <MetricControl label="Axis Height (Bar V-Offset)" field="axisHeight" value={metrics.axisHeight} onChange={handleMetricChange} onReset={handleMetricReset} min={0} max={0.8} />
                                <div className="my-3 border-t border-gray-800"></div>
                                <MetricControl label="Numerator Shift Up" field="fracNumShift" value={metrics.fracNumShift} onChange={handleMetricChange} onReset={handleMetricReset} min={0} max={1.0} />
                                <MetricControl label="Denominator Shift Down" field="fracDenShift" value={metrics.fracDenShift} onChange={handleMetricChange} onReset={handleMetricReset} min={0} max={1.5} />
                                <MetricControl label="Vertical Gap (Min)" field="fracGap" value={metrics.fracGap} onChange={handleMetricChange} onReset={handleMetricReset} min={0} max={0.5} />
                                <MetricControl label="Bar Thickness" field="fracRuleThickness" value={metrics.fracRuleThickness} onChange={handleMetricChange} onReset={handleMetricReset} min={0.01} max={0.2} />
                                <MetricControl label="Horiz. Padding" field="fracPadding" value={metrics.fracPadding} onChange={handleMetricChange} onReset={handleMetricReset} min={0} max={0.5} />
                            </>
                        )}

                        {activeTab === 'surd' && (
                            <>
                                <h4 className="text-[10px] font-bold text-blue-400 mb-2">RADICALS (SURDS)</h4>
                                <MetricControl label="Vertical Gap (Inside)" field="sqrtGap" value={metrics.sqrtGap} onChange={handleMetricChange} onReset={handleMetricReset} min={0} max={0.5} />
                                <MetricControl label="Line Thickness" field="sqrtRuleThickness" value={metrics.sqrtRuleThickness} onChange={handleMetricChange} onReset={handleMetricReset} min={0.01} max={0.2} />
                                <MetricControl label="Hook Height Extra" field="sqrtExtraHeight" value={metrics.sqrtExtraHeight} onChange={handleMetricChange} onReset={handleMetricReset} min={0} max={0.5} />
                                <MetricControl label="Symbol Drop (Shift)" field="sqrtVerticalShift" value={metrics.sqrtVerticalShift} onChange={handleMetricChange} onReset={handleMetricReset} min={0} max={0.5} />
                            </>
                        )}

                        {activeTab === 'script' && (
                            <>
                                <h4 className="text-[10px] font-bold text-blue-400 mb-2">SUBSCRIPTS / SUPERSCRIPTS</h4>
                                <MetricControl label="Size Scale" field="scriptScale" value={metrics.scriptScale} onChange={handleMetricChange} onReset={handleMetricReset} min={0.3} max={1.0} />
                                <MetricControl label="Superscript Scale" field="scriptScriptScale" value={metrics.scriptScriptScale} onChange={handleMetricChange} onReset={handleMetricReset} min={0.3} max={1.0} />
                                <div className="my-3 border-t border-gray-800"></div>
                                <MetricControl label="Sup Shift Up" field="supShift" value={metrics.supShift} onChange={handleMetricChange} onReset={handleMetricReset} min={0} max={1.0} />
                                <MetricControl label="Sub Shift Down" field="subShift" value={metrics.subShift} onChange={handleMetricChange} onReset={handleMetricReset} min={0} max={1.0} />
                                <MetricControl label="Sup Min Height" field="supMinHeight" value={metrics.supMinHeight} onChange={handleMetricChange} onReset={handleMetricReset} min={0} max={1.0} />
                                <MetricControl label="Sub Max Drop" field="subDrop" value={metrics.subDrop} onChange={handleMetricChange} onReset={handleMetricReset} min={0} max={1.0} />
                                <MetricControl label="Sup-Sub Vertical Gap" field="supSubGapMin" value={metrics.supSubGapMin} onChange={handleMetricChange} onReset={handleMetricReset} min={0} max={0.5} />
                            </>
                        )}

                        {activeTab === 'delim' && (
                            <>
                                <h4 className="text-[10px] font-bold text-blue-400 mb-2">DELIMITERS</h4>
                                <MetricControl label="Min Coverage" field="delimFactor" value={metrics.delimFactor} onChange={handleMetricChange} onReset={handleMetricReset} min={0.5} max={1.0} />
                                <MetricControl label="Max Shortfall" field="delimMaxShortfall" value={metrics.delimMaxShortfall} onChange={handleMetricChange} onReset={handleMetricReset} min={0} max={0.5} />
                            </>
                        )}
                    </div>

                    <div className="pt-4 border-t border-gray-800 mt-4">
                        <label className="block text-xs font-bold text-gray-500 uppercase mb-2">Test Content</label>
                        <div className="space-y-3">
                            <textarea 
                                value={testLatex} 
                                onChange={(e) => setTestLatex(e.target.value)}
                                className="w-full h-20 bg-gray-800 border border-gray-700 rounded p-2 text-xs text-white font-mono"
                            />
                            <textarea 
                                value={compFunc} 
                                onChange={(e) => setCompFunc(e.target.value)}
                                className="w-full h-12 bg-gray-800 border border-gray-700 rounded p-2 text-xs text-white font-mono"
                            />
                            <div>
                                <div className="flex justify-between text-[10px] text-gray-400 mb-1">
                                    <span>Font Size</span>
                                    <span>{fontSize}px</span>
                                </div>
                                <input 
                                    type="range" min="10" max="200" step="1"
                                    value={fontSize}
                                    onChange={(e) => setFontSize(parseFloat(e.target.value))}
                                    className="w-full h-1 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-green-500"
                                />
                            </div>
                        </div>
                    </div>
                </div>

                {/* Export Button Area */}
                <div className="p-4 border-t border-gray-800 bg-gray-900">
                    <button 
                        onClick={handleExportDiff}
                        className="w-full py-2 bg-blue-600 hover:bg-blue-500 text-white rounded text-xs font-bold flex items-center justify-center gap-2"
                    >
                        <Copy size={14} /> Copy Config Diff
                    </button>
                </div>
            </aside>

            {/* Main Canvas */}
            <main className="flex-1 flex flex-col relative bg-gray-800 overflow-hidden">
                <header className="absolute top-0 left-0 w-full z-10 p-4 pointer-events-none flex justify-between">
                    <div className="pointer-events-auto">
                        <button 
                            onClick={() => setShowBoundingBoxes(!showBoundingBoxes)}
                            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border text-xs font-medium transition-colors ${showBoundingBoxes ? 'bg-red-900/50 border-red-500 text-red-200' : 'bg-gray-800 border-gray-700 text-gray-400 hover:bg-gray-700'}`}
                        >
                            <Scan size={14}/> {showBoundingBoxes ? 'Hide' : 'Show'} Bounding Boxes
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
                        className={`bg-gray-900 shadow-2xl transition-all duration-200 ease-in-out relative ${cropMode ? 'cursor-crosshair' : 'cursor-default'}`}
                        style={{ 
                            transform: `scale(${previewScale})`, 
                            transformOrigin: 'top center'
                        }}
                        onMouseDown={handleCanvasMouseDown}
                    >
                        <svg 
                            id="text-calib-svg"
                            width={widthPixels} 
                            height={heightPixels} 
                            viewBox={`0 0 ${widthPixels} ${heightPixels}`}
                            xmlns="http://www.w3.org/2000/svg"
                            style={{ display: 'block' }}
                        >
                            {/* Grid Background */}
                            <pattern id="calib-grid" width="50" height="50" patternUnits="userSpaceOnUse">
                                <path d="M 50 0 L 0 0 0 50" fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="1"/>
                            </pattern>
                            <rect width="100%" height="100%" fill="url(#calib-grid)" />

                            {/* Reference Image Layer (Bottom) */}
                            {bgImage && (
                                <image 
                                    href={bgImage.url} 
                                    x={bgImage.x} y={bgImage.y} 
                                    width={bgImage.width} height={bgImage.height} 
                                    opacity={bgImage.opacity}
                                    style={{ cursor: 'move' }}
                                    onMouseDown={handleImageDrag}
                                />
                            )}

                            {/* Center Line for reference */}
                            <line x1="0" y1={textPos.y} x2={widthPixels} y2={textPos.y} stroke="rgba(0,255,0,0.2)" strokeWidth="1" />
                            <line x1={textPos.x} y1="0" x2={textPos.x} y2={heightPixels} stroke="rgba(0,255,0,0.2)" strokeWidth="1" />

                            {/* Text Group */}
                            <g 
                                transform={`translate(${textPos.x}, ${textPos.y})`}
                                style={{ cursor: 'move' }}
                                onMouseDown={handleTextDrag}
                            >
                                <circle cx="0" cy="0" r="4" fill="lime" opacity="0.5" />
                                
                                {tex.renderToSVG(testLatex, 0, 0, fontSize, 'white', 'start', false, 'text', showBoundingBoxes)}
                                
                                {tex.renderToSVG(compFunc, 0, fontSize * 3, fontSize, 'white', 'start', false, 'text', showBoundingBoxes)}
                            </g>
                        </svg>
                    </div>
                </div>
                
                {/* Floating Hint */}
                <div className="absolute bottom-4 right-4 bg-black/50 text-white p-2 rounded text-xs pointer-events-none text-right">
                    Drag text or image to align.<br/>
                    <span className="text-gray-400">Shift+Drag to Pan View</span>
                </div>
            </main>
        </div>
    );
};

export default TextCalibration;
