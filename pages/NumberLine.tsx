
import React, { useState, useMemo, useEffect } from 'react';
import { BaseGraphEngine } from '../utils/graphBase';
import { NUMBER_LINE_CONFIG } from '../config/graphDefaults';
import { IntervalDef, GraphConfig } from '../types';
import { parseIntervalExpression } from '../utils/mathAnalysis';
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

const INITIAL_INTERVALS: IntervalDef[] = [
  { id: '1', expression: '[-2, 3]', color: '#000000', visible: true, heightOffset: 1, label: '', showLabel: false, strokeWidth: 3 },
  { id: '2', expression: 'x > 1', color: '#000000', visible: true, heightOffset: 2, label: '', showLabel: false, strokeWidth: 3 }
];

const NumberLine: React.FC = () => {
  const [config, setConfig] = useState<GraphConfig>({
      ...NUMBER_LINE_CONFIG,
      // Page specific overrides
      yRange: [-1, 3], 
      majorStep: [1, 1],
      fontSize: 16
  });
  const [intervals, setIntervals] = useState<IntervalDef[]>(INITIAL_INTERVALS);
  const [isCopied, setIsCopied] = useState(false);
  const [activeTab, setActiveTab] = useState<'data' | 'window' | 'style'>('data');
  const [dimCm, setDimCm] = useState({ width: 15, height: 6 });
  const [isFixedSize, setIsFixedSize] = useState(true);
  
  const [windowSettings, setWindowSettings] = useState({
    xMin: "-5", xMax: "5", yMin: "-1", yMax: "3",
    xStep: "1", yStep: "1", xSubdivisions: 2, ySubdivisions: 2
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
    let xStep = Math.abs(parseMath(windowSettings.xStep));
    if (xStep < 1e-9) xStep = 1;
    const xSub = Math.max(1, Math.round(Number(windowSettings.xSubdivisions) || 1));
    setConfig(prev => ({ ...prev, xRange: [xMin, xMax], majorStep: [xStep, 1], subdivisions: [xSub, 1] }));
  }, [windowSettings]);

  const engine = useMemo(() => new BaseGraphEngine(config), [config]);

  // Use Shared Interaction Hook
  const {
      previewScale, setPreviewScale,
      cropMode, setCropMode,
      selectionBox, customViewBox, hasInitialCrop,
      containerRef,
      handleAutoCrop, handleResetView, handleExportPNG, handleExportSVG,
      handleCropMouseDown, handleCropMouseMove, handleCropMouseUp
  } = useGraphInteraction('graph-svg', engine.widthPixels, engine.heightPixels, dimCm.width);

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

  const renderIntervals = () => {
    const els: React.ReactNode[] = [];
    const { xStart, xEnd } = engine.getGridBoundaries();
    const arrowW = 12;

    intervals.forEach(int => {
        if (!int.visible || !int.expression) return;
        const segments = parseIntervalExpression(int.expression);
        const baselineY = engine.mathToScreen(0, int.heightOffset)[1];

        segments.forEach((parsed, segIdx) => {
            const mathStartX = parsed.start === null ? xStart : engine.mathToScreen(parsed.start, 0)[0];
            const mathEndX = parsed.end === null ? xEnd : engine.mathToScreen(parsed.end, 0)[0];
            const lineStartX = parsed.start === null ? mathStartX + arrowW : mathStartX;
            const lineEndX = parsed.end === null ? mathEndX - arrowW : mathEndX;

            els.push(<line key={`${int.id}-${segIdx}-line`} x1={lineStartX} y1={baselineY} x2={lineEndX} y2={baselineY} stroke={int.color} strokeWidth={int.strokeWidth} />);

            if (parsed.start === null) {
                els.push(<path key={`${int.id}-${segIdx}-as`} d={`M ${mathStartX} ${baselineY} L ${mathStartX+arrowW} ${baselineY-5} L ${mathStartX+arrowW} ${baselineY+5} Z`} fill={int.color} />);
            }
            if (parsed.end === null) {
                els.push(<path key={`${int.id}-${segIdx}-ae`} d={`M ${mathEndX} ${baselineY} L ${mathEndX-arrowW} ${baselineY-5} L ${mathEndX-arrowW} ${baselineY+5} Z`} fill={int.color} />);
            }

            if (parsed.start !== null) {
                els.push(<circle key={`${int.id}-${segIdx}-cs`} cx={mathStartX} cy={baselineY} r={5} fill={parsed.startInclusive ? int.color : 'white'} stroke={int.color} strokeWidth={2} />);
            }
            if (parsed.end !== null) {
                els.push(<circle key={`${int.id}-${segIdx}-ce`} cx={mathEndX} cy={baselineY} r={5} fill={parsed.endInclusive ? int.color : 'white'} stroke={int.color} strokeWidth={2} />);
            }
        });

        if (int.showLabel && int.label && segments.length > 0) {
            const first = segments[0]; const last = segments[segments.length-1];
            const sx = first.start === null ? xStart : engine.mathToScreen(first.start, 0)[0];
            const ex = last.end === null ? xEnd : engine.mathToScreen(last.end, 0)[0];
            els.push(...engine.texEngine.renderToSVG(int.label, (sx+ex)/2, baselineY - 15, config.fontSize, int.color, 'middle', true));
        }
    });
    return els;
  };

  const addInterval = () => setIntervals([...intervals, { id: Date.now().toString(), expression: '', color: '#000000', visible: true, heightOffset: intervals.length + 1, label: '', showLabel: false, strokeWidth: 3 }]);
  const updateInterval = (id: string, u: Partial<IntervalDef>) => setIntervals(prev => prev.map(i => i.id === id ? { ...i, ...u } : i));
  const removeInterval = (id: string) => setIntervals(prev => prev.filter(i => i.id !== id));

  return (
    <div className="flex h-full flex-col bg-gray-50" onMouseMove={handleGlobalMouseMove} onMouseUp={handleGlobalMouseUp}>
      <header className="flex items-center justify-between px-6 py-3 bg-white border-b border-gray-200 shadow-sm z-10">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-green-50 text-green-600 rounded-lg"><Settings className="w-5 h-5" /></div>
          <h1 className="text-xl font-semibold text-gray-800">Number Line</h1>
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
            <button onClick={() => setActiveTab('data')} className={`flex-1 py-3 text-sm font-medium flex justify-center items-center gap-2 ${activeTab === 'data' ? 'text-green-600 border-b-2 border-green-600 bg-green-50/50' : 'text-gray-500'}`}><List size={16} /> Intervals</button>
            <button onClick={() => setActiveTab('window')} className={`flex-1 py-3 text-sm font-medium flex justify-center items-center gap-2 ${activeTab === 'window' ? 'text-green-600 border-b-2 border-green-600 bg-green-50/50' : 'text-gray-500'}`}><Sliders size={16} /> Window</button>
            <button onClick={() => setActiveTab('style')} className={`flex-1 py-3 text-sm font-medium flex justify-center items-center gap-2 ${activeTab === 'style' ? 'text-green-600 border-b-2 border-green-600 bg-green-50/50' : 'text-gray-500'}`}><Palette size={16} /> Style</button>
          </div>

          <div className="flex-1 overflow-y-auto custom-scrollbar">
              {activeTab === 'data' && (
                  <div className="flex flex-col">
                      <div className="p-4 bg-gray-50 border-b border-gray-100 flex justify-between items-center">
                          <h2 className="text-xs font-bold text-gray-500 uppercase tracking-wider">Intervals</h2>
                          <button onClick={addInterval} className="p-1 hover:bg-gray-200 rounded text-green-600"><Plus size={16} /></button>
                      </div>
                      <div className="p-2 space-y-2">
                          {intervals.map(int => (
                              <div key={int.id} className="bg-white border border-gray-200 rounded-md p-3 shadow-sm hover:border-green-300 transition-colors">
                                  <div className="flex items-center gap-2 mb-2">
                                      <input type="text" value={int.expression} onChange={(e) => updateInterval(int.id, { expression: e.target.value })} placeholder="e.g. [-2, 5] or x > 3" className="flex-1 border border-gray-300 rounded px-2 py-1 text-sm focus:border-green-500 focus:outline-none" />
                                      <button onClick={() => updateInterval(int.id, { visible: !int.visible })} className="text-gray-400">{int.visible ? <Eye size={16} /> : <EyeOff size={16} />}</button>
                                      <button onClick={() => removeInterval(int.id)} className="text-gray-400 hover:text-red-500"><Trash2 size={16} /></button>
                                  </div>
                                  <div className="mb-2">
                                     <RichInput 
                                        value={int.label} 
                                        onChange={(e) => updateInterval(int.id, { label: e.target.value })} 
                                        className="w-full border border-gray-300 rounded px-2 py-1 text-sm focus:border-green-500 focus:outline-none"
                                        placeholder="Label (optional)"
                                     />
                                     <label className="flex items-center gap-2 mt-1 text-xs text-gray-500">
                                        <input type="checkbox" checked={int.showLabel} onChange={(e) => updateInterval(int.id, { showLabel: e.target.checked })} />
                                        Show Label
                                     </label>
                                  </div>
                                  <div className="grid grid-cols-2 gap-2">
                                      <div className="flex items-center gap-2">
                                          <input type="color" value={int.color} onChange={(e) => updateInterval(int.id, { color: e.target.value })} className="w-8 h-8 p-0 border-0 rounded cursor-pointer" />
                                          <div className="flex items-center gap-1">
                                              <Layers size={14} className="text-gray-400" />
                                              <input type="number" step="0.5" value={int.heightOffset} onChange={(e) => updateInterval(int.id, { heightOffset: parseFloat(e.target.value) })} className="w-12 border rounded px-1 text-xs" />
                                          </div>
                                      </div>
                                      <div className="flex items-center justify-end gap-1">
                                          <span className="text-[10px] text-gray-400">Width</span>
                                          <input type="number" step="0.5" value={int.strokeWidth} onChange={(e) => updateInterval(int.id, { strokeWidth: parseFloat(e.target.value) })} className="w-12 border rounded px-1 text-xs" />
                                      </div>
                                  </div>
                              </div>
                          ))}
                      </div>
                  </div>
              )}
              {activeTab === 'window' && <WindowSettings dimCm={dimCm} setDimCm={setDimCm} isFixedSize={isFixedSize} setIsFixedSize={setIsFixedSize} windowSettings={windowSettings} onSettingChange={(f,v) => setWindowSettings(p=>({...p,[f]:v}))} />}
              {activeTab === 'style' && <AppearanceSettings config={config} setConfig={setConfig} togglePiX={()=>{}} togglePiY={()=>{}} />}
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
                <g className="data-layer">{renderIntervals()}</g>

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

export default NumberLine;
