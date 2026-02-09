
import React, { useState, useMemo, useEffect } from 'react';
import { GraphToolbar } from '../components/GraphToolbar';
import { useGraphInteraction } from '../hooks/useGraphInteraction';
import { useDragSystem } from '../hooks/useDragSystem';
import { CircleDot, Palette, Sliders, List, Maximize, Circle, Minus } from 'lucide-react';
import { CM_TO_PX } from '../constants';
import { TexEngine } from '../utils/textRenderer';
import { generateGraphImage } from '../utils/imageExport';

// --- Logic ---

type QuartileType = 'exact' | 'split';

interface QuartileInfo {
    value: number;
    index: number; // 0-based index. If split, ends in .5
    type: QuartileType;
}

interface StatsData {
    sorted: number[];
    median: QuartileInfo;
    q1: QuartileInfo;
    q3: QuartileInfo;
}

const getMedian = (arr: number[], offset: number): QuartileInfo => {
    const n = arr.length;
    if (n === 0) return { value: 0, index: 0, type: 'exact' };
    
    if (n % 2 === 1) {
        // Odd: Exact middle
        const idx = (n - 1) / 2;
        return { value: arr[idx], index: offset + idx, type: 'exact' };
    } else {
        // Even: Average of two middle
        const idx1 = n / 2 - 1;
        const idx2 = n / 2;
        const val = (arr[idx1] + arr[idx2]) / 2;
        return { value: val, index: offset + idx1 + 0.5, type: 'split' };
    }
};

const calculateStats = (raw: string): StatsData | null => {
    const nums = raw.split(/[\s,]+/).map(s => parseFloat(s)).filter(n => isFinite(n));
    if (nums.length < 2) return null;
    
    const sorted = [...nums].sort((a, b) => a - b);
    const n = sorted.length;
    
    // Median
    const median = getMedian(sorted, 0);
    
    // Split for Quartiles
    let lowerHalf: number[] = [];
    let upperHalf: number[] = [];
    let upperOffset = 0;

    if (n % 2 === 1) {
        // Odd: Exclude median
        const midIdx = (n - 1) / 2;
        lowerHalf = sorted.slice(0, midIdx);
        upperHalf = sorted.slice(midIdx + 1);
        upperOffset = midIdx + 1;
    } else {
        // Even: Split down middle
        const midIdx = n / 2;
        lowerHalf = sorted.slice(0, midIdx);
        upperHalf = sorted.slice(midIdx);
        upperOffset = midIdx;
    }

    const q1 = getMedian(lowerHalf, 0);
    const q3 = getMedian(upperHalf, upperOffset);

    return { sorted, median, q1, q3 };
};

const VisualQuartiles: React.FC = () => {
    // --- State ---
    const [rawData, setRawData] = useState("3, 4, 6, 8, 10, 12, 12, 15, 17");
    const [config, setConfig] = useState({
        circleRadius: 20,
        spacingFactor: 0.5, // Reduced from 1.0
        fontSize: 14,
        highlightThickness: 3,
        highlightOffset: 4,
        arrowLength: 30,
        qArrowDrop: 0,
        legendYOffset: 10,
        showLegend: true,
        colMedian: '#FF0000', // Default Pure Red
        colQ1: '#0000FF', // Default Pure Blue
        colQ3: '#0000FF'  // Default Pure Blue
    });
    
    const [dimCm, setDimCm] = useState({ width: 18, height: 8 });
    const [activeTab, setActiveTab] = useState<'data' | 'style'>('data');
    const [isCopied, setIsCopied] = useState(false);
    
    // Legend Draggable State
    const [legendOffset, setLegendOffset] = useState({ x: 0, y: 0 });

    const stats = useMemo(() => calculateStats(rawData), [rawData]);

    // Update colors based on data type (Exact=Red, Split=Blue)
    useEffect(() => {
        if (!stats) return;
        setConfig(prev => ({
            ...prev,
            colMedian: stats.median.type === 'exact' ? '#FF0000' : '#0000FF',
            colQ1: stats.q1.type === 'exact' ? '#FF0000' : '#0000FF',
            colQ3: stats.q3.type === 'exact' ? '#FF0000' : '#0000FF'
        }));
    }, [stats?.median.type, stats?.q1.type, stats?.q3.type]);

    // Graph Engine Props
    const widthPixels = Math.round(dimCm.width * CM_TO_PX);
    const heightPixels = Math.round(dimCm.height * CM_TO_PX);
    const centerX = widthPixels / 2;
    const centerY = heightPixels / 2;

    const {
        previewScale, setPreviewScale,
        cropMode, setCropMode,
        selectionBox, customViewBox, hasInitialCrop,
        containerRef,
        handleAutoCrop, handleResetView, handleExportPNG, handleExportSVG,
        handleCropMouseDown, handleCropMouseMove, handleCropMouseUp
    } = useGraphInteraction('quartile-svg', widthPixels, heightPixels, dimCm.width, true); // strictMode true

    // Use drag system for generic if needed, but simple controls here
    const { onMouseDown, onMouseMove, onMouseUp } = useDragSystem(previewScale);

    // Auto-Fit Logic
    useEffect(() => {
        if (!stats) return;
        // Estimate width needed
        const n = stats.sorted.length;
        const diam = config.circleRadius * 2;
        const gap = diam * 0.5 * config.spacingFactor;
        const totalW = n * diam + (n - 1) * gap + 100; // padding
        const totalH = diam * 4 + config.arrowLength * 2 + 100; // rough height estimate
        
        // Only update on mount or manual trigger (optional), 
        // but here we just set initial sensible dims if it's way off? 
        // For now, let user control via inputs or "Fit" button
    }, [stats]);

    const handleFitCanvas = () => {
        if (!stats) return;
        const n = stats.sorted.length;
        const diam = config.circleRadius * 2;
        const gap = diam * 0.5 * config.spacingFactor;
        const contentW = n * diam + (n - 1) * gap;
        const contentH = diam + config.arrowLength * 3 + 60; // Arrows up/down + text

        const wCm = (contentW + 80) / CM_TO_PX;
        const hCm = (contentH + 80) / CM_TO_PX;
        
        setDimCm({
            width: parseFloat(wCm.toFixed(1)),
            height: parseFloat(hCm.toFixed(1))
        });
    };

    const handleCopy = async () => {
        const blob = await generateGraphImage('quartile-svg', widthPixels, heightPixels, dimCm.width, true);
        if (blob) {
            try {
                const item = new ClipboardItem({ [blob.type]: blob });
                await navigator.clipboard.write([item]);
                setIsCopied(true);
                setTimeout(() => setIsCopied(false), 2000);
            } catch (e) {
                alert("Copy failed.");
            }
        }
    };

    // Handle Legend Drag
    const handleLegendDragStart = (e: React.MouseEvent) => {
        if (cropMode) return;
        onMouseDown(e, { ...legendOffset }, (dx, dy, init) => {
            setLegendOffset({ x: init.x + dx, y: init.y + dy });
        });
    };

    const handleGlobalMouseMove = (e: React.MouseEvent) => {
        if (handleCropMouseMove(e)) return;
        onMouseMove(e);
    };

    const handleGlobalMouseUp = () => {
        handleCropMouseUp();
        onMouseUp();
    };

    // --- Rendering ---
    const tex = new TexEngine();

    const renderVisualization = () => {
        if (!stats) return null;
        const { sorted, median, q1, q3 } = stats;
        const n = sorted.length;
        const r = config.circleRadius;
        const diam = r * 2;
        const gap = diam * 0.5 * config.spacingFactor;
        
        const totalContentWidth = n * diam + (n - 1) * gap;
        const startX = centerX - totalContentWidth / 2 + r; // Start at center of first circle
        const circleY = centerY - 10; // Shift up slightly

        const els: React.ReactNode[] = [];

        // 1. Draw Circles & Numbers
        sorted.forEach((val, i) => {
            const cx = startX + i * (diam + gap);
            els.push(
                <g key={`node-${i}`}>
                    <circle cx={cx} cy={circleY} r={r} fill="#f3f4f6" stroke="black" strokeWidth={2} />
                    {tex.renderToSVG(val.toString(), cx, circleY + config.fontSize * 0.35, config.fontSize, 'black', 'middle', false, 'text')}
                </g>
            );
        });

        // 2. Draw Highlights & Arrows
        const drawFeature = (info: QuartileInfo, label: string, position: 'top' | 'bottom', color: string) => {
            const xPos = startX + info.index * (diam + gap);
            const arrowLen = config.arrowLength + (position === 'bottom' ? config.qArrowDrop : 0);
            
            if (info.type === 'exact') {
                // Ring highlight
                els.push(
                    <circle 
                        key={`${label}-ring`} 
                        cx={xPos} cy={circleY} 
                        r={r + config.highlightOffset} 
                        fill="none" stroke={color} strokeWidth={config.highlightThickness} 
                    />
                );
            } else {
                // Vertical Line Highlight
                const lineH = r * 2.5;
                els.push(
                    <line 
                        key={`${label}-line`} 
                        x1={xPos} y1={circleY - lineH/2} 
                        x2={xPos} y2={circleY + lineH/2} 
                        stroke={color} strokeWidth={config.highlightThickness} 
                    />
                );
            }

            // Arrow Geometry
            const textGap = 5;
            const headSz = 8;
            
            // yTip is the point closest to the data circle
            const yBase = position === 'top' 
                ? circleY - r - config.highlightOffset - 5 
                : circleY + r + config.highlightOffset + 5;
            
            const yTip = yBase; // Start of arrow head
            const yEnd = position === 'top' 
                ? yBase - arrowLen 
                : yBase + arrowLen;
                
            // yShaftStart is adjusted so the line stops at the base of the arrowhead
            const yShaftStart = position === 'top'
                ? yTip - headSz
                : yTip + headSz;
            
            // Arrow Shaft
            els.push(<line key={`${label}-arrow`} x1={xPos} y1={yShaftStart} x2={xPos} y2={yEnd} stroke={color} strokeWidth={2.5} />);
            
            // Arrow Head
            if (position === 'top') {
                // Pointing Down
                els.push(<path key={`${label}-head`} d={`M ${xPos} ${yTip} L ${xPos-headSz/2} ${yTip-headSz} L ${xPos+headSz/2} ${yTip-headSz} Z`} fill={color} />);
                // Use Mixed Mode ('text') but wrap in $...$ for math italic font style matching the image
                els.push(...tex.renderToSVG(`$${label}$`, xPos, yEnd - textGap, config.fontSize + 2, color, 'middle', true, 'text'));
            } else {
                // Pointing Up
                els.push(<path key={`${label}-head`} d={`M ${xPos} ${yTip} L ${xPos-headSz/2} ${yTip+headSz} L ${xPos+headSz/2} ${yTip+headSz} Z`} fill={color} />);
                els.push(...tex.renderToSVG(`$${label}$`, xPos, yEnd + textGap + config.fontSize, config.fontSize + 2, color, 'middle', true, 'text'));
            }
        };

        drawFeature(median, 'Median', 'top', config.colMedian);
        drawFeature(q1, 'Q1', 'bottom', config.colQ1);
        drawFeature(q3, 'Q3', 'bottom', config.colQ3);

        // 3. Legend
        if (config.showLegend) {
            // Align leftmost legend circle edge with leftmost data circle edge
            const baseLegX = startX - r - 5;
            const baseLegY = heightPixels - 30 - config.legendYOffset;
            
            const legX = baseLegX + legendOffset.x;
            const legY = baseLegY + legendOffset.y;
            const legGap = 200;

            els.push(
                <g key="legend-group" onMouseDown={handleLegendDragStart} style={{ cursor: cropMode ? 'crosshair' : 'move' }}>
                    {/* Invisible Hit Area for easier dragging */}
                    <rect x={legX} y={legY - 15} width={400} height={30} fill="transparent" />
                    
                    {/* Circle Legend */}
                    <g key="leg-circle">
                        <circle cx={legX + 15} cy={legY} r={10} fill="none" stroke="#FF0000" strokeWidth={3} />
                        {/* Use mixed mode with $Word$ $Word$ to handle spaces and italics correctly */}
                        {tex.renderToSVG("$Value$ $used$ $directly$", legX + 35, legY + 5, 12, 'black', 'start', false, 'text')}
                    </g>

                    {/* Line Legend */}
                    <g key="leg-line">
                        <line x1={legX + legGap} y1={legY - 10} x2={legX + legGap} y2={legY + 10} stroke="#0000FF" strokeWidth={3} />
                        {/* Use mixed mode with $Word$ $Word$ to handle spaces and italics correctly */}
                        {tex.renderToSVG("$Average$ $taken$", legX + legGap + 10, legY + 5, 12, 'black', 'start', false, 'text')}
                    </g>
                </g>
            );
        }

        return els;
    };

    return (
        <div className="flex h-full flex-col bg-gray-50" onMouseMove={handleGlobalMouseMove} onMouseUp={handleGlobalMouseUp}>
            <header className="flex items-center justify-between px-6 py-3 bg-white border-b border-gray-200 shadow-sm z-10">
                <div className="flex items-center gap-3">
                    <div className="p-2 bg-rose-50 text-rose-600 rounded-lg"><CircleDot className="w-5 h-5" /></div>
                    <h1 className="text-xl font-semibold text-gray-800">Visual Quartiles</h1>
                </div>
                <GraphToolbar 
                    previewScale={previewScale} setPreviewScale={setPreviewScale}
                    cropMode={cropMode} setCropMode={setCropMode}
                    onResetView={handleResetView} onAutoCrop={handleAutoCrop}
                    onExportPNG={handleExportPNG} onExportSVG={handleExportSVG}
                    onCopy={handleCopy} isCopied={isCopied}
                />
            </header>

            <div className="flex flex-1 overflow-hidden">
                <aside className="w-80 bg-white border-r border-gray-200 flex flex-col h-full z-20">
                    <div className="flex border-b border-gray-200 bg-white">
                        <button onClick={() => setActiveTab('data')} className={`flex-1 py-3 text-sm font-medium flex justify-center items-center gap-2 ${activeTab === 'data' ? 'text-rose-600 border-b-2 border-rose-600 bg-rose-50/50' : 'text-gray-500'}`}><List size={16} /> Data</button>
                        <button onClick={() => setActiveTab('style')} className={`flex-1 py-3 text-sm font-medium flex justify-center items-center gap-2 ${activeTab === 'style' ? 'text-rose-600 border-b-2 border-rose-600 bg-rose-50/50' : 'text-gray-500'}`}><Palette size={16} /> Style</button>
                    </div>

                    <div className="flex-1 overflow-y-auto custom-scrollbar p-4 space-y-6">
                        {activeTab === 'data' && (
                            <div className="space-y-4">
                                <div>
                                    <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Data Set</label>
                                    <textarea 
                                        value={rawData}
                                        onChange={(e) => setRawData(e.target.value)}
                                        className="w-full h-32 border border-gray-300 rounded p-2 text-xs font-mono"
                                        placeholder="3, 4, 6, 8, 10..."
                                    />
                                </div>
                                
                                {stats && (
                                    <div className="bg-rose-50 border border-rose-100 rounded-md p-3">
                                        <h3 className="text-xs font-bold text-rose-800 uppercase mb-2">Calculated Stats</h3>
                                        <div className="text-xs space-y-1 text-rose-900">
                                            <div className="flex justify-between"><span>Median:</span> <span>{stats.median.value} ({stats.median.type})</span></div>
                                            <div className="flex justify-between"><span>Q1:</span> <span>{stats.q1.value} ({stats.q1.type})</span></div>
                                            <div className="flex justify-between"><span>Q3:</span> <span>{stats.q3.value} ({stats.q3.type})</span></div>
                                            <div className="flex justify-between pt-1 border-t border-rose-200"><span>Count (n):</span> <span>{stats.sorted.length}</span></div>
                                        </div>
                                    </div>
                                )}

                                <div className="pt-4 border-t border-gray-100">
                                    <h3 className="text-xs font-bold text-gray-500 uppercase mb-2">Feature Colors</h3>
                                    <div className="grid grid-cols-3 gap-2">
                                        <div>
                                            <label className="block text-[10px] text-gray-400 mb-1">Q1</label>
                                            <input type="color" value={config.colQ1} onChange={(e) => setConfig({...config, colQ1: e.target.value})} className="w-full h-8 border rounded cursor-pointer"/>
                                        </div>
                                        <div>
                                            <label className="block text-[10px] text-gray-400 mb-1">Median</label>
                                            <input type="color" value={config.colMedian} onChange={(e) => setConfig({...config, colMedian: e.target.value})} className="w-full h-8 border rounded cursor-pointer"/>
                                        </div>
                                        <div>
                                            <label className="block text-[10px] text-gray-400 mb-1">Q3</label>
                                            <input type="color" value={config.colQ3} onChange={(e) => setConfig({...config, colQ3: e.target.value})} className="w-full h-8 border rounded cursor-pointer"/>
                                        </div>
                                    </div>
                                    <div className="mt-2 text-[10px] text-gray-400 italic">
                                        Colors auto-update based on Exact (Red) vs Split (Blue) logic.
                                    </div>
                                </div>
                            </div>
                        )}

                        {activeTab === 'style' && (
                            <div className="space-y-4">
                                <div className="space-y-3">
                                    <h3 className="text-xs font-bold text-gray-500 uppercase">Layout</h3>
                                    
                                    <div className="grid grid-cols-2 gap-3">
                                        <div>
                                            <label className="block text-xs text-gray-500 mb-1">Circle Radius</label>
                                            <input type="number" value={config.circleRadius} onChange={(e) => setConfig({...config, circleRadius: parseFloat(e.target.value)})} className="w-full border rounded p-1 text-xs" />
                                        </div>
                                        <div>
                                            <label className="block text-xs text-gray-500 mb-1">Spacing Factor</label>
                                            <input type="number" step="0.1" value={config.spacingFactor} onChange={(e) => setConfig({...config, spacingFactor: parseFloat(e.target.value)})} className="w-full border rounded p-1 text-xs" />
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-2 gap-3">
                                        <div>
                                            <label className="block text-xs text-gray-500 mb-1">Highlight Offset</label>
                                            <input type="number" value={config.highlightOffset} onChange={(e) => setConfig({...config, highlightOffset: parseFloat(e.target.value)})} className="w-full border rounded p-1 text-xs" />
                                        </div>
                                        <div>
                                            <label className="block text-xs text-gray-500 mb-1">Highlight Thick</label>
                                            <input type="number" value={config.highlightThickness} onChange={(e) => setConfig({...config, highlightThickness: parseFloat(e.target.value)})} className="w-full border rounded p-1 text-xs" />
                                        </div>
                                    </div>

                                    <div>
                                        <label className="block text-xs text-gray-500 mb-1">Arrow Length</label>
                                        <input type="range" min="10" max="100" value={config.arrowLength} onChange={(e) => setConfig({...config, arrowLength: parseFloat(e.target.value)})} className="w-full h-1 bg-gray-200 rounded-lg appearance-none cursor-pointer" />
                                    </div>
                                    <div>
                                        <label className="block text-xs text-gray-500 mb-1">Q1/Q3 Extra Drop</label>
                                        <input type="range" min="0" max="100" value={config.qArrowDrop} onChange={(e) => setConfig({...config, qArrowDrop: parseFloat(e.target.value)})} className="w-full h-1 bg-gray-200 rounded-lg appearance-none cursor-pointer" />
                                    </div>
                                    <div>
                                        <label className="block text-xs text-gray-500 mb-1">Legend Base Y</label>
                                        <input type="range" min="-50" max="50" value={config.legendYOffset} onChange={(e) => setConfig({...config, legendYOffset: parseFloat(e.target.value)})} className="w-full h-1 bg-gray-200 rounded-lg appearance-none cursor-pointer" />
                                    </div>
                                </div>

                                <div className="pt-4 border-t border-gray-100">
                                    <label className="flex items-center gap-2 text-xs text-gray-700 cursor-pointer">
                                        <input type="checkbox" checked={config.showLegend} onChange={(e) => setConfig({...config, showLegend: e.target.checked})} className="rounded text-rose-600"/>
                                        Show Legend
                                    </label>
                                </div>

                                <div className="pt-4 border-t border-gray-100">
                                    <label className="block text-xs font-bold text-gray-500 uppercase mb-2">Image Dimensions (cm)</label>
                                    <div className="grid grid-cols-2 gap-3 mb-3">
                                        <input type="number" value={dimCm.width} onChange={(e) => setDimCm({...dimCm, width: parseFloat(e.target.value)})} className="border rounded p-1 text-xs" placeholder="W" />
                                        <input type="number" value={dimCm.height} onChange={(e) => setDimCm({...dimCm, height: parseFloat(e.target.value)})} className="border rounded p-1 text-xs" placeholder="H" />
                                    </div>
                                    <button 
                                        onClick={handleFitCanvas}
                                        className="w-full py-1.5 flex items-center justify-center gap-2 bg-rose-50 text-rose-700 border border-rose-100 rounded text-xs font-medium hover:bg-rose-100 transition-colors"
                                    >
                                        <Maximize size={12} /> Fit Canvas to Content
                                    </button>
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
                                id="quartile-svg" 
                                width={widthPixels} 
                                height={heightPixels} 
                                viewBox={customViewBox || `0 0 ${widthPixels} ${heightPixels}`} 
                                xmlns="http://www.w3.org/2000/svg" 
                                style={{ display: 'block', fontFamily: 'Times New Roman' }}
                            >
                                <rect x="0" y="0" width={widthPixels} height={heightPixels} fill="white" />
                                <g className="data-layer">
                                    {renderVisualization()}
                                </g>
                                
                                {cropMode && selectionBox && (
                                    <rect 
                                        x={selectionBox.x} y={selectionBox.y} 
                                        width={selectionBox.w} height={selectionBox.h}
                                        fill="rgba(244, 63, 94, 0.2)"
                                        stroke="#e11d48"
                                        strokeWidth={2 / previewScale} 
                                        strokeDasharray={`${5/previewScale},${5/previewScale}`}
                                        pointerEvents="none"
                                    />
                                )}
                            </svg>
                        </div>
                    </div>
                    {cropMode && (
                        <div className="absolute top-4 left-1/2 -translate-x-1/2 bg-rose-600 text-white px-4 py-2 rounded-full shadow-lg text-sm font-bold animate-pulse pointer-events-none">
                            Drag to Crop Graph
                        </div>
                    )}
                </main>
            </div>
        </div>
    );
};

export default VisualQuartiles;
