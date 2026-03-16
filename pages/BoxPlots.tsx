import React, { useState, useMemo, useEffect } from 'react';
import { BaseGraphEngine } from '../utils/graphBase';
import { STATISTICS_CONFIG } from '../config/graphDefaults';
import { BoxPlotDef, GraphConfig } from '../types';
import { Settings, List, Sliders, Palette, Plus, Trash2, Eye, EyeOff, Layers } from 'lucide-react';
import * as math from 'mathjs';
import { CM_TO_PX } from '../constants';

import { GraphToolbar } from '../components/GraphToolbar';
import { useGraphInteraction } from '../hooks/useGraphInteraction';
import { useDragSystem } from '../hooks/useDragSystem';
import { calculateAxisLabelDrag, calculateAxisResize } from '../utils/dragStrategies';

import { WindowSettings } from '../components/settings/WindowSettings';
import { AppearanceSettings } from '../components/settings/AppearanceSettings';
import { RichInput } from '../components/ui/RichInput';

const INITIAL_BOXES: BoxPlotDef[] = [
  { id: '1', label: 'Sample H', min: 63, q1: 67, median: 71, q3: 75, max: 81, heightOffset: 2, boxHeight: 35, color: '#f8fafc', visible: true, labelPos: 'top' },
  { id: '2', label: 'Sample T', min: 68, q1: 74, median: 76.5, q3: 79, max: 83, heightOffset: 1, boxHeight: 35, color: '#f8fafc', visible: true, labelPos: 'top' }
];

const getMedian = (arr: number[]): number => {
    const n = arr.length;
    if (n === 0) return 0;
    if (n % 2 === 1) return arr[(n - 1) / 2];
    return (arr[n / 2 - 1] + arr[n / 2]) / 2;
};

const calculateBoxPlotStats = (raw: string, showOutliers: boolean) => {
    const nums = raw.split(/[\s,]+/).map(s => parseFloat(s)).filter(n => isFinite(n));
    if (nums.length < 2) return null;
    
    const sorted = [...nums].sort((a, b) => a - b);
    const n = sorted.length;
    const median = getMedian(sorted);
    
    let lowerHalf: number[] = [];
    let upperHalf: number[] = [];

    if (n % 2 === 1) {
        const midIdx = (n - 1) / 2;
        lowerHalf = sorted.slice(0, midIdx);
        upperHalf = sorted.slice(midIdx + 1);
    } else {
        const midIdx = n / 2;
        lowerHalf = sorted.slice(0, midIdx);
        upperHalf = sorted.slice(midIdx);
    }

    const q1 = getMedian(lowerHalf);
    const q3 = getMedian(upperHalf);
    const iqr = q3 - q1;
    
    let min = sorted[0];
    let max = sorted[n - 1];
    let outliers: number[] = [];
    
    if (showOutliers) {
        const lowerBound = q1 - 1.5 * iqr;
        const upperBound = q3 + 1.5 * iqr;
        outliers = sorted.filter(x => x < lowerBound || x > upperBound);
        const nonOutliers = sorted.filter(x => x >= lowerBound && x <= upperBound);
        if (nonOutliers.length > 0) {
            min = nonOutliers[0];
            max = nonOutliers[nonOutliers.length - 1];
        } else {
            min = q1;
            max = q3;
        }
    }

    return { min, q1, median, q3, max, outliers };
};

const BoxPlots: React.FC = () => {
  const [config, setConfig] = useState<GraphConfig>({
      ...STATISTICS_CONFIG,
      // Page Specific Overrides
      xRange: [60, 84], 
      yRange: [0, 3],
      majorStep: [2, 1],
      subdivisions: [2, 1],
      showYAxis: false,
      showYNumbers: false,
      showYTicks: false,
      showHorizontalGrid: false,
      showMinorGrid: true,
      showBorder: true,
      axisLabels: ["life expectancy (years)", ""], // Updated to plain text
      fontSize: 18,
      verticalGridMode: 'upward',
      showWhiskerCaps: false,
      offsetXAxisLabelY: 0 
  });
  
  const [boxPlots, setBoxPlots] = useState<BoxPlotDef[]>(INITIAL_BOXES);
  const [studentMode, setStudentMode] = useState(false);
  
  const [activeTab, setActiveTab] = useState<'data' | 'window' | 'style'>('data');
  const [dimCm, setDimCm] = useState({ width: 20, height: 10 });
  const [isFixedSize, setIsFixedSize] = useState(true);
  
  const [windowSettings, setWindowSettings] = useState({
    xMin: "60", xMax: "84", yMin: "0", yMax: "3",
    xStep: "2", yStep: "1", xSubdivisions: 2, ySubdivisions: 2
  });

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
    const yMax = parseMath(windowSettings.yMax);
    let xStep = Math.abs(parseMath(windowSettings.xStep));
    if (xStep < 1e-9) xStep = 1;
    const xSub = Math.max(1, Math.round(Number(windowSettings.xSubdivisions) || 1));
    const ySub = Math.max(1, Math.round(Number(windowSettings.ySubdivisions) || 1));
    setConfig(prev => ({ ...prev, xRange: [xMin, xMax], yRange: [0, yMax], majorStep: [xStep, 1], subdivisions: [xSub, ySub] }));
  }, [windowSettings]);

  const engine = useMemo(() => new BaseGraphEngine(config), [config]);

  // Use Shared Interaction Hook
  const {
      previewScale, setPreviewScale,
      exportDpi, setExportDpi,
      cropMode, setCropMode,
      selectionBox, customViewBox, hasInitialCrop,
      containerRef,
      handleAutoCrop, handleResetView, handleExportPNG, handleExportSVG, handleCopy, isCopied,
      handleCropMouseDown, handleCropMouseMove, handleCropMouseUp
  } = useGraphInteraction('graph-svg', engine.widthPixels, engine.heightPixels, dimCm.width, false, false, config.cropPadding);

  // --- DRAG SYSTEM INTEGRATION ---
  const { onMouseDown, onMouseMove, onMouseUp } = useDragSystem(previewScale);

  const handleAxisLabelDragStart = (axis: 'x' | 'y', e: React.MouseEvent) => {
      const initialOffsets = {
          xx: config.offsetXAxisLabelX, xy: config.offsetXAxisLabelY,
          yx: config.offsetYAxisLabelX, yy: config.offsetYAxisLabelY
      };
      
      onMouseDown(e, initialOffsets, (dx, dy, init, ev) => {
          const updates = calculateAxisLabelDrag(config, dx, dy, axis, init, { alt: ev.altKey, ctrl: ev.ctrlKey || ev.metaKey });
          setConfig(prev => ({ ...prev, ...updates }));
      }, undefined, 'axis-label');
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


  const renderBoxes = () => {
    if (studentMode) return [];
    const els: React.ReactNode[] = [];
    const stroke = 1.8;
    
    boxPlots.forEach(b => {
        if (!b.visible) return;
        
        const min = b.min;
        const q1 = b.q1;
        const median = b.median;
        const q3 = b.q3;
        const max = b.max;
        const outliers: number[] = b.outliers || [];

        const baselineY = engine.mathToScreen(0, b.heightOffset)[1];
        const [minX] = engine.mathToScreen(min, 0);
        const [q1X] = engine.mathToScreen(q1, 0);
        const [medX] = engine.mathToScreen(median, 0);
        const [q3X] = engine.mathToScreen(q3, 0);
        const [maxX] = engine.mathToScreen(max, 0);
        const boxHalfH = b.boxHeight / 2;

        // Whiskers
        els.push(<line key={`${b.id}-w1`} x1={minX} y1={baselineY} x2={q1X} y2={baselineY} stroke="black" strokeWidth={stroke} />);
        els.push(<line key={`${b.id}-w2`} x1={q3X} y1={baselineY} x2={maxX} y2={baselineY} stroke="black" strokeWidth={stroke} />);
        
        if (config.showWhiskerCaps) {
            const capH = 10;
            els.push(<line key={`${b.id}-c1`} x1={minX} y1={baselineY - capH} x2={minX} y2={baselineY + capH} stroke="black" strokeWidth={stroke} />);
            els.push(<line key={`${b.id}-c2`} x1={maxX} y1={baselineY - capH} x2={maxX} y2={baselineY + capH} stroke="black" strokeWidth={stroke} />);
        }

        // Box
        els.push(<rect key={`${b.id}-rect`} x={q1X} y={baselineY - boxHalfH} width={q3X - q1X} height={b.boxHeight} fill={b.color || "white"} stroke="black" strokeWidth={stroke} />);
        els.push(<line key={`${b.id}-med`} x1={medX} y1={baselineY - boxHalfH} x2={medX} y2={baselineY + boxHalfH} stroke="black" strokeWidth={stroke} />);

        // Outliers
        if (b.showOutliers) {
            outliers.forEach((outlier, idx) => {
                const [outlierX] = engine.mathToScreen(outlier, 0);
                els.push(<circle key={`${b.id}-outlier-${idx}`} cx={outlierX} cy={baselineY} r={3} fill="none" stroke="black" strokeWidth={stroke} />);
            });
        }

        // Label
        if (b.label && b.labelPos !== 'none') {
            if (b.labelPos === 'top') {
                els.push(...engine.texEngine.renderToSVG(b.label, medX, baselineY - boxHalfH - 15, config.fontSize, 'black', 'middle', true, 'text'));
            } else if (b.labelPos === 'left') {
                let leftmostX = minX;
                if (b.showOutliers && outliers.length > 0) {
                    const minOutlierX = Math.min(...outliers.map(o => engine.mathToScreen(o, 0)[0]));
                    leftmostX = Math.min(minX, minOutlierX);
                }
                els.push(...engine.texEngine.renderToSVG(b.label, leftmostX - 15, baselineY + 4, config.fontSize, 'black', 'end', true, 'text'));
            }
        }
    });
    return els;
  };

  const addBoxPlot = () => setBoxPlots([...boxPlots, { id: Date.now().toString(), label: `Sample ${boxPlots.length + 1}`, min: 0, q1: 1, median: 2, q3: 3, max: 4, heightOffset: boxPlots.length + 1, boxHeight: 35, color: '#f8fafc', visible: true, labelPos: 'top' }]);
  const updateBoxPlot = (id: string, u: Partial<BoxPlotDef>) => {
      setBoxPlots(prev => prev.map(b => {
          if (b.id !== id) return b;
          const newB = { ...b, ...u };
          
          if ('rawData' in u || 'showOutliers' in u) {
              if (newB.rawData) {
                  const stats = calculateBoxPlotStats(newB.rawData, newB.showOutliers || false);
                  if (stats) {
                      newB.min = stats.min;
                      newB.q1 = stats.q1;
                      newB.median = stats.median;
                      newB.q3 = stats.q3;
                      newB.max = stats.max;
                      newB.outliers = stats.outliers;
                  }
              }
          }
          
          if ('min' in u || 'q1' in u || 'median' in u || 'q3' in u || 'max' in u) {
              newB.rawData = '';
              newB.outliers = [];
          }
          
          return newB;
      }));
  };
  const removeBoxPlot = (id: string) => setBoxPlots(prev => prev.filter(b => b.id !== id));

  return (
    <div className="flex h-full flex-col bg-gray-50" onMouseMove={handleGlobalMouseMove} onMouseUp={handleGlobalMouseUp}>
      <header className="flex items-center justify-between px-6 py-3 bg-white border-b border-gray-200 shadow-sm z-10">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-orange-50 text-orange-600 rounded-lg"><Settings className="w-5 h-5" /></div>
          <h1 className="text-xl font-semibold text-gray-800">Box Plot Maker</h1>
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
            <button onClick={() => setActiveTab('data')} className={`flex-1 py-3 text-sm font-medium flex justify-center items-center gap-2 ${activeTab === 'data' ? 'text-orange-600 border-b-2 border-orange-600 bg-orange-50/50' : 'text-gray-500'}`}><List size={16} /> Data</button>
            <button onClick={() => setActiveTab('window')} className={`flex-1 py-3 text-sm font-medium flex justify-center items-center gap-2 ${activeTab === 'window' ? 'text-orange-600 border-b-2 border-orange-600 bg-orange-50/50' : 'text-gray-500'}`}><Sliders size={16} /> Window</button>
            <button onClick={() => setActiveTab('style')} className={`flex-1 py-3 text-sm font-medium flex justify-center items-center gap-2 ${activeTab === 'style' ? 'text-orange-600 border-b-2 border-orange-600 bg-orange-50/50' : 'text-gray-500'}`}><Palette size={16} /> Style</button>
          </div>

          <div className="flex-1 overflow-y-auto custom-scrollbar">
              {activeTab === 'data' && (
                  <div className="flex flex-col">
                      <div className="p-4 bg-gray-50 border-b border-gray-100 flex justify-between items-center">
                          <h2 className="text-xs font-bold text-gray-500 uppercase tracking-wider">Series</h2>
                          <button onClick={addBoxPlot} className="p-1 hover:bg-gray-200 rounded text-orange-600"><Plus size={16} /></button>
                      </div>
                      <div className="p-2 space-y-2">
                          {boxPlots.map(b => (
                              <div key={b.id} className="bg-white border border-gray-200 rounded-md p-3 shadow-sm hover:border-orange-300 transition-colors">
                                  <div className="flex items-center gap-3 mb-3">
                                      <RichInput 
                                        value={b.label} 
                                        onChange={(e) => updateBoxPlot(b.id, { label: e.target.value })} 
                                        className="flex-1 border border-gray-300 rounded px-2 py-1 text-sm font-bold" 
                                      />
                                      <button onClick={() => updateBoxPlot(b.id, { visible: !b.visible })} className="text-gray-400">{b.visible ? <Eye size={16} /> : <EyeOff size={16} />}</button>
                                      <button onClick={() => removeBoxPlot(b.id)} className="text-gray-400 hover:text-red-500"><Trash2 size={16} /></button>
                                  </div>
                                  
                                  <div className="flex border border-gray-200 rounded overflow-hidden mb-3">
                                      <button 
                                          onClick={() => updateBoxPlot(b.id, { useRawData: false })} 
                                          className={`flex-1 py-1 text-[10px] font-bold uppercase ${!b.useRawData ? 'bg-orange-100 text-orange-700' : 'bg-gray-50 text-gray-500 hover:bg-gray-100'}`}
                                      >
                                          5-Number
                                      </button>
                                      <button 
                                          onClick={() => updateBoxPlot(b.id, { useRawData: true })} 
                                          className={`flex-1 py-1 text-[10px] font-bold uppercase ${b.useRawData ? 'bg-orange-100 text-orange-700' : 'bg-gray-50 text-gray-500 hover:bg-gray-100'}`}
                                      >
                                          Raw Data
                                      </button>
                                  </div>

                                  {!b.useRawData ? (
                                      <div className="grid grid-cols-5 gap-1 mb-3">
                                          {['min', 'q1', 'median', 'q3', 'max'].map((key) => (
                                              <div key={key}>
                                                  <label className="block text-[8px] uppercase font-bold text-gray-400 mb-0.5">{key}</label>
                                                  <input type="number" step="0.1" value={b[key as keyof BoxPlotDef] as number} onChange={(e) => updateBoxPlot(b.id, { [key]: parseFloat(e.target.value) || 0 })} className="w-full border border-gray-300 rounded px-1 py-0.5 text-[10px]" />
                                              </div>
                                          ))}
                                      </div>
                                  ) : (
                                      <div className="mb-3 space-y-2">
                                          <textarea 
                                              value={b.rawData || ''} 
                                              onChange={(e) => updateBoxPlot(b.id, { rawData: e.target.value })} 
                                              placeholder="e.g. 1, 2, 3, 4, 5"
                                              className="w-full h-16 border border-gray-300 rounded p-1.5 text-xs font-mono resize-none"
                                          />
                                          <label className="flex items-center gap-2 text-xs text-gray-600 cursor-pointer">
                                              <input 
                                                  type="checkbox" 
                                                  checked={b.showOutliers || false} 
                                                  onChange={(e) => updateBoxPlot(b.id, { showOutliers: e.target.checked })} 
                                                  className="rounded text-orange-600 focus:ring-orange-500"
                                              />
                                              Show Outliers
                                          </label>
                                      </div>
                                  )}

                                  <div className="flex items-center justify-between gap-2">
                                      <div className="flex items-center gap-2">
                                          <input type="color" value={b.color} onChange={(e) => updateBoxPlot(b.id, { color: e.target.value })} className="w-8 h-8 p-0 border-0 rounded cursor-pointer" />
                                          <select value={b.labelPos} onChange={(e) => updateBoxPlot(b.id, { labelPos: e.target.value as any })} className="text-[10px] border rounded p-1">
                                              <option value="top">Top</option>
                                              <option value="left">Left</option>
                                              <option value="none">None</option>
                                          </select>
                                      </div>
                                      <div className="flex items-center gap-2">
                                          <Layers size={14} className="text-gray-400" />
                                          <input type="number" step="0.1" value={b.heightOffset} onChange={(e) => updateBoxPlot(b.id, { heightOffset: parseFloat(e.target.value) || 0 })} className="w-10 border rounded px-1 text-xs" />
                                      </div>
                                  </div>
                              </div>
                          ))}
                      </div>
                  </div>
              )}
              {activeTab === 'window' && <WindowSettings dimCm={dimCm} setDimCm={setDimCm} isFixedSize={isFixedSize} setIsFixedSize={setIsFixedSize} windowSettings={windowSettings} onSettingChange={(f,v) => setWindowSettings(p=>({...p,[f]:v}))} />}
              {activeTab === 'style' && (
                  <div className="flex flex-col">
                      <AppearanceSettings config={config} setConfig={setConfig} togglePiX={()=>{}} togglePiY={()=>{}} />
                      <div className="p-4 border-t border-gray-200">
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
                                  <span className="block text-xs text-gray-500 mt-0.5">Hide boxes to create a worksheet</span>
                              </div>
                          </label>
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
                  id="graph-svg" 
                  width={engine.widthPixels} 
                  height={engine.heightPixels} 
                  viewBox={customViewBox || `0 0 ${engine.widthPixels} ${engine.heightPixels}`} 
                  xmlns="http://www.w3.org/2000/svg" 
                  style={{ display: 'block' }}
              >
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
                <g className="data-layer">{renderBoxes()}</g>

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

export default BoxPlots;