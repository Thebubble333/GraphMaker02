import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { GraphToolbar } from '../components/GraphToolbar';
import { GraphContextMenu, ContextMenuItem } from '../components/GraphContextMenu';
import { useGraphInteraction } from '../hooks/useGraphInteraction';
import { useDragSystem } from '../hooks/useDragSystem';
import { useHistory } from '../hooks/useHistory';
import { CircleDot, Palette, Sliders, List, Maximize, Edit3, Trash2, Eye, EyeOff, RefreshCcw } from 'lucide-react';
import { CM_TO_PX } from '../constants';
import { TexEngine } from '../utils/textRenderer';
import { ptToSvgUnits } from '../utils/imageExport';

// --- Logic ---

type QuartileType = 'exact' | 'split';

interface QuartileInfo {
    value: number;
    index: number; 
    type: QuartileType;
}

interface StatsData {
    sorted: number[];
    median: QuartileInfo;
    q1: QuartileInfo;
    q3: QuartileInfo;
}

interface QuartileContextMenuState {
    x: number;
    y: number;
    targetType: 'node' | 'feature' | 'legend' | 'canvas';
    nodeIndex?: number;
    nodeValue?: number;
    featureLabel?: string;
}

const INITIAL_RAW_DATA = "3, 4, 6, 8, 10, 12, 12, 15, 17";
const INITIAL_VQ_CONFIG = {
    circleRadius: 20,
    spacingFactor: 0.5, 
    fontSize: 11,
    highlightThickness: 3,
    highlightOffset: 4,
    arrowLength: 30,
    qArrowDrop: 0,
    legendYOffset: 10,
    showLegend: true,
    colMedian: '#FF0000', 
    colQ1: '#0000FF', 
    colQ3: '#0000FF'  
};

const getMedian = (arr: number[], offset: number): QuartileInfo => {
    const n = arr.length;
    if (n === 0) return { value: 0, index: 0, type: 'exact' };
    
    if (n % 2 === 1) {
        const idx = (n - 1) / 2;
        return { value: arr[idx], index: offset + idx, type: 'exact' };
    } else {
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
    const median = getMedian(sorted, 0);
    
    let lowerHalf: number[] = [];
    let upperHalf: number[] = [];
    let upperOffset = 0;

    if (n % 2 === 1) {
        const midIdx = (n - 1) / 2;
        lowerHalf = sorted.slice(0, midIdx);
        upperHalf = sorted.slice(midIdx + 1);
        upperOffset = midIdx + 1;
    } else {
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
    const [rawData, setRawData] = useState(INITIAL_RAW_DATA);
    const [config, setConfig] = useState(INITIAL_VQ_CONFIG);
    
    const [dimCm, setDimCm] = useState({ width: 15, height: 8 });
    const [activeTab, setActiveTab] = useState<'data' | 'style'>('data');
    const [studentMode, setStudentMode] = useState(false);
    const [legendOffset, setLegendOffset] = useState({ x: 0, y: 0 });

    const [highlightedId, setHighlightedId] = useState<string | null>(null);
    const [contextMenu, setContextMenu] = useState<QuartileContextMenuState | null>(null);

    const stats = useMemo(() => calculateStats(rawData), [rawData]);

    const historyState = useMemo(() => ({
        rawData, config, dimCm, studentMode, legendOffset
    }), [rawData, config, dimCm, studentMode, legendOffset]);

    const {
        undo, redo, canUndo, canRedo,
        exportToFile, importFromFile, resetToDefaultSettings
    } = useHistory({
        appId: 'visual-quartiles',
        version: 1,
        currentState: historyState,
        onRestore: (s) => {
            if (!s) return;
            if (s.rawData !== undefined) setRawData(s.rawData);
            if (s.config) setConfig({ ...INITIAL_VQ_CONFIG, ...s.config });
            if (s.dimCm) setDimCm(s.dimCm);
            if (s.studentMode !== undefined) setStudentMode(s.studentMode);
            if (s.legendOffset) setLegendOffset(s.legendOffset);
        }
    });

    const handleDefaultSettings = () => {
        resetToDefaultSettings({
            rawData: INITIAL_RAW_DATA,
            config: INITIAL_VQ_CONFIG,
            dimCm: { width: 15, height: 8 },
            studentMode: false,
            legendOffset: { x: 0, y: 0 }
        });
    };

    const focusSidebarSection = useCallback((tab: 'data' | 'style', sectionId: string) => {
        setActiveTab(tab);
        setHighlightedId(sectionId);
        setTimeout(() => {
            const el = document.getElementById(`sidebar-${sectionId}`);
            if (el) {
                el.scrollIntoView({ behavior: 'smooth', block: 'center' });
                const input = el.querySelector('input, textarea') as HTMLElement | null;
                if (input) input.focus();
            }
        }, 80);
        setTimeout(() => setHighlightedId(null), 2400);
    }, []);

    useEffect(() => {
        if (!stats) return;
        setConfig(prev => ({
            ...prev,
            colMedian: stats.median.type === 'exact' ? '#FF0000' : '#0000FF',
            colQ1: stats.q1.type === 'exact' ? '#FF0000' : '#0000FF',
            colQ3: stats.q3.type === 'exact' ? '#FF0000' : '#0000FF'
        }));
    }, [stats?.median.type, stats?.q1.type, stats?.q3.type]);

    const widthPixels = Math.round(dimCm.width * CM_TO_PX);
    const heightPixels = Math.round(dimCm.height * CM_TO_PX);
    const centerX = widthPixels / 2;
    const centerY = heightPixels / 2;

    const {
        previewScale, setPreviewScale,
        exportDpi, setExportDpi,
        cropMode, setCropMode,
        selectionBox, customViewBox, hasInitialCrop,
        containerRef,
        handleAutoCrop, handleResetView, handleZoomOutCanvas, handleExportPNG, handleExportSVG, handleCopy, isCopied,
        handleCropMouseDown, handleCropMouseMove, handleCropMouseUp
    } = useGraphInteraction('quartile-svg', widthPixels, heightPixels, dimCm.width, true);

    const { onMouseDown, onMouseMove, onMouseUp } = useDragSystem(previewScale);

    const handleFitCanvas = () => {
        if (!stats) return;
        const n = stats.sorted.length;
        const diam = config.circleRadius * 2;
        const gap = diam * 0.5 * config.spacingFactor;
        const contentW = n * diam + (n - 1) * gap;
        const contentH = diam + config.arrowLength * 3 + 60; 
        const wCm = (contentW + 80) / CM_TO_PX;
        const hCm = (contentH + 80) / CM_TO_PX;
        setDimCm({ width: parseFloat(wCm.toFixed(1)), height: parseFloat(hCm.toFixed(1)) });
    };

    const handleLegendDragStart = (e: React.MouseEvent) => {
        if (e.button === 2) return;
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

    const handleSvgContextMenu = (e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        const targetEl = (e.target as Element).closest('[data-target-type]');
        const targetType = (targetEl?.getAttribute('data-target-type') as QuartileContextMenuState['targetType']) || 'canvas';
        const nodeIdxAttr = targetEl?.getAttribute('data-node-index');
        const nodeValAttr = targetEl?.getAttribute('data-node-value');
        const featAttr = targetEl?.getAttribute('data-feature-label') || undefined;

        setContextMenu({
            x: e.clientX,
            y: e.clientY,
            targetType,
            nodeIndex: nodeIdxAttr !== null && nodeIdxAttr !== undefined ? Number(nodeIdxAttr) : undefined,
            nodeValue: nodeValAttr !== null && nodeValAttr !== undefined ? Number(nodeValAttr) : undefined,
            featureLabel: featAttr
        });
    };

    const buildContextMenu = (): { title: string; subtitle?: string; items: ContextMenuItem[] } | null => {
        if (!contextMenu) return null;

        if (contextMenu.targetType === 'node' && contextMenu.nodeValue !== undefined) {
            const val = contextMenu.nodeValue;
            return {
                title: `Data Value: ${val}`,
                subtitle: contextMenu.nodeIndex !== undefined ? `Sorted Position #${contextMenu.nodeIndex + 1}` : undefined,
                items: [
                    { label: 'Edit Dataset in Sidebar', icon: <Edit3 size={13} />, accent: true, onClick: () => focusSidebarSection('data', 'dataset') },
                    { label: 'Edit Circle Size & Spacing', icon: <Palette size={13} />, onClick: () => focusSidebarSection('style', 'layout') },
                    {
                        label: `Remove Value (${val})`,
                        icon: <Trash2 size={13} />,
                        danger: true,
                        dividerBefore: true,
                        onClick: () => {
                            const nums = rawData.split(/[\s,]+/).map(s => parseFloat(s)).filter(n => isFinite(n));
                            const idx = nums.findIndex(n => Math.abs(n - val) < 1e-9);
                            if (idx !== -1) nums.splice(idx, 1);
                            setRawData(nums.join(', '));
                        }
                    }
                ]
            };
        }

        if (contextMenu.targetType === 'feature' && contextMenu.featureLabel) {
            return {
                title: `Quartile Marker: ${contextMenu.featureLabel}`,
                items: [
                    { label: 'Edit Feature Colors in Sidebar', icon: <Palette size={13} />, accent: true, onClick: () => focusSidebarSection('data', 'colors') },
                    { label: 'Edit Arrow Length & Layout', icon: <Sliders size={13} />, onClick: () => focusSidebarSection('style', 'layout') },
                    { label: 'Hide Quartiles (Student Mode)', icon: <EyeOff size={13} />, danger: true, dividerBefore: true, onClick: () => setStudentMode(true) }
                ]
            };
        }

        if (contextMenu.targetType === 'legend') {
            return {
                title: 'Legend Actions',
                items: [
                    { label: 'Reset Legend Position', icon: <RefreshCcw size={13} />, accent: true, onClick: () => setLegendOffset({ x: 0, y: 0 }) },
                    { label: 'Hide Legend', icon: <EyeOff size={13} />, danger: true, dividerBefore: true, onClick: () => setConfig(p => ({ ...p, showLegend: false })) }
                ]
            };
        }

        return {
            title: 'Visual Quartiles Canvas',
            items: [
                { label: 'Edit Dataset in Sidebar', icon: <List size={13} />, accent: true, onClick: () => focusSidebarSection('data', 'dataset') },
                { label: studentMode ? 'Disable Student Mode (Show Quartiles)' : 'Enable Student Mode (Hide Quartiles)', icon: <Eye size={13} />, onClick: () => setStudentMode(!studentMode) },
                { label: config.showLegend ? 'Hide Legend' : 'Show Legend', icon: <Eye size={13} />, onClick: () => setConfig(p => ({ ...p, showLegend: !p.showLegend })) },
                { label: 'Fit Canvas to Content', icon: <Maximize size={13} />, dividerBefore: true, onClick: handleFitCanvas },
                { label: 'Edit Layout & Style', icon: <Palette size={13} />, onClick: () => focusSidebarSection('style', 'layout') }
            ]
        };
    };

    const tex = useMemo(() => new TexEngine(), []);

    const renderVisualization = () => {
        if (!stats) return null;
        const activeFontSize = ptToSvgUnits(config.fontSize);
        const { sorted, median, q1, q3 } = stats;
        const n = sorted.length;
        const r = config.circleRadius;
        const diam = r * 2;
        const gap = diam * 0.5 * config.spacingFactor;
        const totalContentWidth = n * diam + (n - 1) * gap;
        const startX = centerX - totalContentWidth / 2 + r; 
        const circleY = centerY - 10; 
        const els: React.ReactNode[] = [];
        sorted.forEach((val, i) => {
            const cx = startX + i * (diam + gap);
            els.push(
                <g key={`node-${i}`} data-target-type="node" data-node-index={i} data-node-value={val} style={{ cursor: 'context-menu' }}>
                    <circle cx={cx} cy={circleY} r={r} fill="#f3f4f6" stroke="black" strokeWidth={2} />
                    {tex.renderToSVG(val.toString(), cx, circleY + activeFontSize * 0.35, activeFontSize, 'black', 'middle', false, 'text')}
                </g>
            );
        });
        const drawFeature = (info: QuartileInfo, label: string, position: 'top' | 'bottom', color: string) => {
            const xPos = startX + info.index * (diam + gap);
            const arrowLen = config.arrowLength + (position === 'bottom' ? config.qArrowDrop : 0);
            const featChildren: React.ReactNode[] = [];
            if (info.type === 'exact') featChildren.push(<circle key={`${label}-ring`} cx={xPos} cy={circleY} r={r + config.highlightOffset} fill="none" stroke={color} strokeWidth={config.highlightThickness} />);
            else {
                const lineH = r * 2.5;
                featChildren.push(<line key={`${label}-line`} x1={xPos} y1={circleY - lineH/2} x2={xPos} y2={circleY + lineH/2} stroke={color} strokeWidth={config.highlightThickness} />);
            }
            const textGap = 5;
            const headSz = 8;
            const yBase = position === 'top' ? circleY - r - config.highlightOffset - 5 : circleY + r + config.highlightOffset + 5;
            const yTip = yBase; 
            const yEnd = position === 'top' ? yBase - arrowLen : yBase + arrowLen;
            const yShaftStart = position === 'top' ? yTip - headSz : yTip + headSz;
            featChildren.push(<line key={`${label}-arrow`} x1={xPos} y1={yShaftStart} x2={xPos} y2={yEnd} stroke={color} strokeWidth={2.5} />);
            if (position === 'top') {
                featChildren.push(<path key={`${label}-head`} d={`M ${xPos} ${yTip} L ${xPos-headSz/2} ${yTip-headSz} L ${xPos+headSz/2} ${yTip-headSz} Z`} fill={color} />);
                featChildren.push(...tex.renderToSVG(`$${label}$`, xPos, yEnd - textGap, activeFontSize + 2, color, 'middle', true, 'text'));
            } else {
                featChildren.push(<path key={`${label}-head`} d={`M ${xPos} ${yTip} L ${xPos-headSz/2} ${yTip+headSz} L ${xPos+headSz/2} ${yTip+headSz} Z`} fill={color} />);
                featChildren.push(...tex.renderToSVG(`$${label}$`, xPos, yEnd + textGap + activeFontSize, activeFontSize + 2, color, 'middle', true, 'text'));
            }
            els.push(
                <g key={`feat-grp-${label}`} data-target-type="feature" data-feature-label={label} style={{ cursor: 'context-menu' }}>
                    {featChildren}
                </g>
            );
        };
        if (!studentMode) {
            drawFeature(median, 'Median', 'top', config.colMedian);
            drawFeature(q1, 'Q1', 'bottom', config.colQ1);
            drawFeature(q3, 'Q3', 'bottom', config.colQ3);
        }
        if (config.showLegend && !studentMode) {
            const baseLegX = startX - r - 5;
            const baseLegY = heightPixels - 30 - config.legendYOffset;
            const legX = baseLegX + legendOffset.x;
            const legY = baseLegY + legendOffset.y;
            const legGap = 200;
            els.push(
                <g key="legend-group" data-target-type="legend" onMouseDown={handleLegendDragStart} style={{ cursor: cropMode ? 'crosshair' : 'move' }}>
                    <rect x={legX} y={legY - 15} width={400} height={30} fill="transparent" />
                    <g key="leg-circle"><circle cx={legX + 15} cy={legY} r={10} fill="none" stroke="#FF0000" strokeWidth={3} />{tex.renderToSVG("$Value$ $used$ $directly$", legX + 35, legY + 5, 12, 'black', 'start', false, 'text')}</g>
                    <g key="leg-line"><line x1={legX + legGap} y1={legY - 10} x2={legX + legGap} y2={legY + 10} stroke="#0000FF" strokeWidth={3} />{tex.renderToSVG("$Average$ $taken$", legX + legGap + 10, legY + 5, 12, 'black', 'start', false, 'text')}</g>
                </g>
            );
        }
        return els;
    };

    const menuConfig = buildContextMenu();

    return (
        <div className="flex h-full flex-col bg-gray-50" onMouseMove={handleGlobalMouseMove} onMouseUp={handleGlobalMouseUp}>
            <header className="flex items-center justify-between px-4 py-2 bg-white border-b border-gray-200 shadow-xs z-10">
                <div className="flex items-center gap-2.5">
                    <div className="p-1.5 bg-rose-50 text-rose-600 rounded-md"><CircleDot className="w-4 h-4" /></div>
                    <div>
                        <h1 className="text-base font-semibold text-gray-800 leading-tight">Visual Quartiles</h1>
                        <p className="text-[11px] text-gray-500 right-click-hint">Right-click any data circle or quartile marker for quick actions</p>
                    </div>
                </div>
                <GraphToolbar 
                    previewScale={previewScale} setPreviewScale={setPreviewScale}
                    exportDpi={exportDpi} onDpiChange={setExportDpi}
                    cropMode={cropMode} setCropMode={setCropMode}
                    onResetView={handleResetView} onZoomOutCanvas={handleZoomOutCanvas} onAutoCrop={handleAutoCrop}
                    onExportPNG={handleExportPNG} onCopy={handleCopy} isCopied={isCopied} onExportSVG={handleExportSVG}
                    onUndo={undo} onRedo={redo} canUndo={canUndo} canRedo={canRedo}
                    onExportData={() => exportToFile('visual_quartiles.json')}
                    onImportData={importFromFile}
                    onDefaultSettings={handleDefaultSettings}
                />
            </header>
            <div className="flex flex-1 overflow-hidden">
                <aside className="w-80 bg-white border-r border-gray-200 flex flex-col h-full z-20">
                    <div className="flex border-b border-gray-200 bg-white">
                        <button onClick={() => setActiveTab('data')} className={`flex-1 py-2.5 text-xs font-medium flex justify-center items-center gap-1.5 ${activeTab === 'data' ? 'text-rose-600 border-b-2 border-rose-600 bg-rose-50/50' : 'text-gray-500'}`}><List size={14} /> Data</button>
                        <button onClick={() => setActiveTab('style')} className={`flex-1 py-2.5 text-xs font-medium flex justify-center items-center gap-1.5 ${activeTab === 'style' ? 'text-rose-600 border-b-2 border-rose-600 bg-rose-50/50' : 'text-gray-500'}`}><Palette size={14} /> Style</button>
                    </div>
                    <div className="flex-1 overflow-y-auto custom-scrollbar p-4 space-y-6">
                        {activeTab === 'data' && (
                            <div className="space-y-4">
                                <div id="sidebar-dataset" className={`p-2 rounded transition-all ${highlightedId === 'dataset' ? 'ring-2 ring-rose-500 bg-rose-50/40' : ''}`}>
                                    <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Data Set</label>
                                    <textarea value={rawData} onChange={(e) => setRawData(e.target.value)} className="w-full h-32 border border-gray-300 rounded p-2 text-xs font-mono" placeholder="3, 4, 6, 8, 10..." />
                                </div>
                                {stats && (
                                    <div className="bg-rose-50 border border-rose-100 rounded-md p-3">
                                        <h3 className="text-xs font-bold text-rose-800 uppercase mb-2">Calculated Stats</h3>
                                        <div className="text-xs space-y-1 text-rose-900">
                                            <div className="flex justify-between"><span>Median:</span> <span>{stats.median.value} ({stats.median.type})</span></div>
                                            <div className="flex justify-between"><span>Q1:</span> <span>{stats.q1.value} ({stats.q1.type})</span></div>
                                            <div className="flex justify-between"><span>Q3:</span> <span>{stats.q3.value} ({stats.q3.type})</span></div>
                                        </div>
                                    </div>
                                )}
                                <div id="sidebar-colors" className={`pt-4 border-t border-gray-100 p-2 rounded transition-all ${highlightedId === 'colors' ? 'ring-2 ring-rose-500 bg-rose-50/40' : ''}`}>
                                    <h3 className="text-xs font-bold text-gray-500 uppercase mb-2">Feature Colors</h3>
                                    <div className="grid grid-cols-3 gap-2">
                                        <div><label className="block text-[10px] text-gray-400 mb-1">Q1</label><input type="color" value={config.colQ1} onChange={(e) => setConfig({...config, colQ1: e.target.value})} className="w-full h-8 border rounded cursor-pointer"/></div>
                                        <div><label className="block text-[10px] text-gray-400 mb-1">Median</label><input type="color" value={config.colMedian} onChange={(e) => setConfig({...config, colMedian: e.target.value})} className="w-full h-8 border rounded cursor-pointer"/></div>
                                        <div><label className="block text-[10px] text-gray-400 mb-1">Q3</label><input type="color" value={config.colQ3} onChange={(e) => setConfig({...config, colQ3: e.target.value})} className="w-full h-8 border rounded cursor-pointer"/></div>
                                    </div>
                                </div>
                                <div className="pt-4 border-t border-gray-100">
                                    <label className={`flex items-center gap-3 p-3 rounded border cursor-pointer transition-colors ${studentMode ? 'bg-rose-50 border-rose-300' : 'bg-white border-gray-200'}`}>
                                        <div className={`w-5 h-5 rounded border flex items-center justify-center ${studentMode ? 'bg-rose-600 border-rose-600 text-white' : 'bg-white border-gray-300'}`}>
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
                                            <span className="block text-xs text-gray-500 mt-0.5">Hide quartiles and median</span>
                                        </div>
                                    </label>
                                </div>
                            </div>
                        )}
                        {activeTab === 'style' && (
                            <div className="space-y-4">
                                <div id="sidebar-layout" className={`space-y-3 p-2 rounded transition-all ${highlightedId === 'layout' ? 'ring-2 ring-rose-500 bg-rose-50/40' : ''}`}>
                                    <h3 className="text-xs font-bold text-gray-500 uppercase">Layout</h3>
                                    <div className="grid grid-cols-2 gap-3">
                                        <div><label className="block text-xs text-gray-500 mb-1">Circle Radius</label><input type="number" value={config.circleRadius} onChange={(e) => setConfig({...config, circleRadius: parseFloat(e.target.value)})} className="w-full border rounded p-1 text-xs" /></div>
                                        <div><label className="block text-xs text-gray-500 mb-1">Spacing Factor</label><input type="number" step="0.1" value={config.spacingFactor} onChange={(e) => setConfig({...config, spacingFactor: parseFloat(e.target.value)})} className="w-full border rounded p-1 text-xs" /></div>
                                        <div className="col-span-2"><label className="block text-xs text-gray-500 mb-1">Font Size (pt)</label><input type="number" value={config.fontSize} onChange={(e) => setConfig({...config, fontSize: parseFloat(e.target.value) || 11})} className="w-full border rounded p-1 text-xs" /></div>
                                    </div>
                                    <div><label className="block text-xs text-gray-500 mb-1">Arrow Length</label><input type="range" min="10" max="100" value={config.arrowLength} onChange={(e) => setConfig({...config, arrowLength: parseFloat(e.target.value)})} className="w-full h-1 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-rose-600" /></div>
                                </div>
                                <div className="pt-4 border-t border-gray-100"><label className="flex items-center gap-2 text-xs text-gray-700 cursor-pointer"><input type="checkbox" checked={config.showLegend} onChange={(e) => setConfig({...config, showLegend: e.target.checked})} className="rounded text-rose-600"/>Show Legend</label></div>
                                <div className="pt-4 border-t border-gray-100">
                                    <label className="block text-xs font-bold text-gray-500 uppercase mb-2">Image Dimensions (cm)</label>
                                    <div className="grid grid-cols-2 gap-3 mb-3"><input type="number" value={dimCm.width} onChange={(e) => setDimCm({...dimCm, width: parseFloat(e.target.value)})} className="border rounded p-1 text-xs" placeholder="W" /><input type="number" value={dimCm.height} onChange={(e) => setDimCm({...dimCm, height: parseFloat(e.target.value)})} className="border rounded p-1 text-xs" placeholder="H" /></div>
                                    <button onClick={handleFitCanvas} className="w-full py-1.5 flex items-center justify-center gap-2 bg-rose-50 text-rose-700 border border-rose-100 rounded text-xs font-medium hover:bg-rose-100 transition-colors"><Maximize size={12} /> Fit Canvas to Content</button>
                                </div>
                            </div>
                        )}
                    </div>
                </aside>
                <main className="flex-1 bg-neutral-100 overflow-hidden flex flex-col relative">
                    <div ref={containerRef} className="flex-1 overflow-auto flex p-4 bg-neutral-100 cursor-crosshair canvas-viewport">
                        <div
                            className="m-auto shrink-0"
                            style={{
                                width: widthPixels * previewScale,
                                height: heightPixels * previewScale
                            }}
                        >
                            <div 
                                className={`bg-white shadow-xl transition-opacity duration-150 ease-in-out relative ${cropMode ? 'cursor-crosshair' : 'cursor-default'}`} 
                                style={{ width: widthPixels, height: heightPixels, transform: `scale(${previewScale})`, transformOrigin: 'top left', opacity: hasInitialCrop ? 1 : 0 }} 
                                onMouseDown={handleCropMouseDown}
                                onContextMenu={handleSvgContextMenu}
                            >
                                <svg id="quartile-svg" width={widthPixels} height={heightPixels} viewBox={customViewBox || `0 0 ${widthPixels} ${heightPixels}`} xmlns="http://www.w3.org/2000/svg" style={{ display: 'block', fontFamily: 'Times New Roman' }}>
                                    <rect x="0" y="0" width={widthPixels} height={heightPixels} fill="white" />
                                    <g className="data-layer">{renderVisualization()}</g>
                                    {cropMode && selectionBox && (<rect x={selectionBox.x} y={selectionBox.y} width={selectionBox.w} height={selectionBox.h} fill="rgba(244, 63, 94, 0.2)" stroke="#e11d48" strokeWidth={2 / previewScale} strokeDasharray={`${5/previewScale},${5/previewScale}`} pointerEvents="none" />)}
                                </svg>
                            </div>
                        </div>
                    </div>
                    {contextMenu && menuConfig && (
                        <GraphContextMenu
                            x={contextMenu.x}
                            y={contextMenu.y}
                            title={menuConfig.title}
                            subtitle={menuConfig.subtitle}
                            items={menuConfig.items}
                            onClose={() => setContextMenu(null)}
                        />
                    )}
                </main>
            </div>
        </div>
    );
};

export default VisualQuartiles;