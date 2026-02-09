
import React, { useState, useMemo, useEffect } from 'react';
import { BaseGraphEngine } from '../utils/graphBase';
import { renderInequalities, renderFeatures } from '../utils/graphRenderers';
import { CARTESIAN_CONFIG } from '../config/graphDefaults';
import { InequalityDef, FeaturePoint, GraphConfig } from '../types';
import { analyzeInequalityIntersections } from '../utils/mathAnalysis';
import { Settings, List, Sliders, Palette } from 'lucide-react';
import * as math from 'mathjs';
import { CM_TO_PX } from '../constants';

import { GraphToolbar } from '../components/GraphToolbar';
import { useGraphInteraction } from '../hooks/useGraphInteraction';
import { useDragSystem } from '../hooks/useDragSystem';
import { calculateAxisLabelDrag, calculateAxisResize } from '../utils/dragStrategies';

import { InequalityList } from '../components/inequality-grapher/InequalityList';
import { WindowSettings } from '../components/settings/WindowSettings';
import { AppearanceSettings } from '../components/settings/AppearanceSettings';

const INITIAL_INEQS: InequalityDef[] = [
  { id: '1', type: 'y', expression: 'sin(x)', operator: '<', color: '#000000', visible: true },
  { id: '2', type: 'y', expression: 'cos(x)', operator: '>=', color: '#000000', visible: true }
];

const InequalityGrapher: React.FC = () => {
  const [config, setConfig] = useState<GraphConfig>(CARTESIAN_CONFIG);
  const [inequalities, setInequalities] = useState<InequalityDef[]>(INITIAL_INEQS);
  const [showIntersection, setShowIntersection] = useState(false);
  const [showFullBoundary, setShowFullBoundary] = useState(false);
  const [vertices, setVertices] = useState<FeaturePoint[]>([]);
  
  const [isCopied, setIsCopied] = useState(false);
  const [activeTab, setActiveTab] = useState<'data' | 'window' | 'style'>('data');
  const [showExactValues, setShowExactValues] = useState(true);
  const [globalStrokeWidth, setGlobalStrokeWidth] = useState(2);
  
  const [dimCm, setDimCm] = useState({ width: 12, height: 12 });
  const [isFixedSize, setIsFixedSize] = useState(true);
  
  const [windowSettings, setWindowSettings] = useState({
    xMin: "-4", xMax: "4", yMin: "-4", yMax: "4",
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
    const yMin = parseMath(windowSettings.yMin);
    const yMax = parseMath(windowSettings.yMax);
    let xStep = Math.abs(parseMath(windowSettings.xStep));
    if (xStep < 1e-9) xStep = 1;
    let yStep = Math.abs(parseMath(windowSettings.yStep));
    if (yStep < 1e-9) yStep = 1;
    const xSub = Math.max(1, Math.round(Number(windowSettings.xSubdivisions) || 1));
    const ySub = Math.max(1, Math.round(Number(windowSettings.ySubdivisions) || 1));

    setConfig(prev => ({
      ...prev, xRange: [xMin, xMax], yRange: [yMin, yMax], majorStep: [xStep, yStep], subdivisions: [xSub, ySub]
    }));
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

  // 1. Axis Label Drag
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

  // 2. Axis Resize Drag
  const handleArrowDragStart = (axis: 'x' | 'y', side: 'positive' | 'negative', e: React.MouseEvent) => {
      const initRange = { x: config.xRange, y: config.yRange };
      
      onMouseDown(e, initRange, (dx, dy, init, ev) => {
          const updates = calculateAxisResize(axis, dx, dy, engine.scaleX, engine.scaleY, init, side, ev.shiftKey);
          if (Object.keys(updates).length > 0) {
              setWindowSettings(prev => ({ ...prev, ...updates }));
          }
      }, undefined, 'axis-resize');
  };

  // 3. Vertex Label Drag (Replaces old local logic)
  const handleVertexLabelMouseDown = (id: string, e: React.MouseEvent) => {
      if (cropMode) return;
      const v = vertices.find(v => v.id === id);
      if (v) {
          onMouseDown(e, { ...v.customLabelOffset }, (dx, dy, init) => {
            setVertices(prev => prev.map(pt => pt.id === id ? { ...pt, customLabelOffset: { x: init.x + dx, y: init.y + dy } } : pt));
          }, undefined, 'vertex-label');
      }
  };

  const handleGlobalMouseMove = (e: React.MouseEvent) => {
      if (handleCropMouseMove(e)) return;
      onMouseMove(e);
  };

  const handleGlobalMouseUp = () => {
      handleCropMouseUp();
      onMouseUp();
  };

  // Handle Vertex Intersections
  useEffect(() => {
      const newVertices = analyzeInequalityIntersections(inequalities, config.xRange, showExactValues);
      setVertices(prev => {
          return newVertices.map(nv => {
              const existing = prev.find(p => p.id === nv.id);
              if (existing) return { 
                ...nv, 
                visible: existing.visible, 
                showLabel: existing.showLabel,
                customLabelOffset: existing.customLabelOffset 
              };
              return nv;
          });
      });
  }, [inequalities, config.xRange, showExactValues]);

  const addInequality = () => setInequalities([...inequalities, { id: Date.now().toString(), type: 'y', expression: '', color: '#000000', operator: '<', visible: true }]);
  const updateInequality = (id: string, updates: Partial<InequalityDef>) => setInequalities(prev => prev.map(i => i.id === id ? { ...i, ...updates } : i));
  const removeInequality = (id: string) => setInequalities(prev => prev.filter(i => i.id !== id));
  
  const toggleVertex = (id: string) => setVertices(prev => prev.map(v => v.id === id ? { ...v, visible: !v.visible } : v));
  const toggleVertexLabel = (id: string) => setVertices(prev => prev.map(v => v.id === id ? { ...v, showLabel: !v.showLabel } : v));
  const resetVertex = (id: string) => setVertices(prev => prev.map(v => v.id === id ? { ...v, customLabelOffset: { x: 10, y: -10 } } : v));

  const handleSettingChange = (field: keyof typeof windowSettings, value: string) => setWindowSettings(prev => ({ ...prev, [field]: value }));
  const togglePiX = (checked: boolean) => {
      setConfig(prev => ({...prev, piXAxis: checked}));
      if (checked) setWindowSettings(prev => ({ ...prev, xMin: "-2pi", xMax: "2pi", xStep: "pi/2" }));
      else setWindowSettings(prev => ({ ...prev, xMin: "-4", xMax: "4", xStep: "1" }));
  };
  const togglePiY = (checked: boolean) => {
      setConfig(prev => ({...prev, piYAxis: checked}));
      if (checked) setWindowSettings(prev => ({ ...prev, yMin: "-2pi", yMax: "2pi", yStep: "pi/2" }));
      else setWindowSettings(prev => ({ ...prev, yMin: "-4", yMax: "4", yStep: "1" }));
  };

  const gridArea = engine.getGridBoundaries();

  return (
    <div className="flex h-full flex-col bg-gray-50" onMouseMove={handleGlobalMouseMove} onMouseUp={handleGlobalMouseUp}>
      <header className="flex items-center justify-between px-6 py-3 bg-white border-b border-gray-200 shadow-sm z-10">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-purple-50 text-purple-600 rounded-lg"><Settings className="w-5 h-5" /></div>
          <h1 className="text-xl font-semibold text-gray-800">Inequality Grapher</h1>
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
            <button onClick={() => setActiveTab('data')} className={`flex-1 py-3 text-sm font-medium flex justify-center items-center gap-2 ${activeTab === 'data' ? 'text-purple-600 border-b-2 border-purple-600 bg-purple-50/50' : 'text-gray-500'}`}><List size={16} /> Data</button>
            <button onClick={() => setActiveTab('window')} className={`flex-1 py-3 text-sm font-medium flex justify-center items-center gap-2 ${activeTab === 'window' ? 'text-purple-600 border-b-2 border-purple-600 bg-purple-50/50' : 'text-gray-500'}`}><Sliders size={16} /> Window</button>
            <button onClick={() => setActiveTab('style')} className={`flex-1 py-3 text-sm font-medium flex justify-center items-center gap-2 ${activeTab === 'style' ? 'text-purple-600 border-b-2 border-purple-600 bg-purple-50/50' : 'text-gray-500'}`}><Palette size={16} /> Style</button>
          </div>
          <div className="flex-1 overflow-y-auto custom-scrollbar">
              {activeTab === 'data' && (
                  <div className="flex flex-col">
                      <div className="px-4 py-2 bg-gray-50 border-b border-gray-100 space-y-2">
                           <label className="flex items-center gap-2 text-xs text-gray-600 cursor-pointer">
                              <input type="checkbox" checked={showExactValues} onChange={(e) => setShowExactValues(e.target.checked)} className="rounded border-gray-300" />
                              Show Exact Values (π, √)
                          </label>
                          <div className="flex items-center gap-2">
                             <span className="text-xs text-gray-600">Line Thickness:</span>
                             <input 
                                type="range" min="0.5" max="5" step="0.5" 
                                value={globalStrokeWidth} 
                                onChange={(e) => setGlobalStrokeWidth(parseFloat(e.target.value))}
                                className="w-24 accent-purple-600"
                             />
                             <span className="text-xs text-gray-400 w-4">{globalStrokeWidth}</span>
                          </div>
                      </div>
                      <InequalityList 
                          inequalities={inequalities} onUpdate={updateInequality} onRemove={removeInequality} onAdd={addInequality}
                          showIntersection={showIntersection} onToggleIntersection={setShowIntersection}
                          showFullBoundary={showFullBoundary} onToggleFullBoundary={setShowFullBoundary}
                          vertices={vertices} 
                          onToggleVertex={toggleVertex} 
                          onToggleVertexLabel={toggleVertexLabel}
                          onResetVertex={resetVertex}
                      />
                  </div>
              )}
              {activeTab === 'window' && <WindowSettings dimCm={dimCm} setDimCm={setDimCm} isFixedSize={isFixedSize} setIsFixedSize={setIsFixedSize} windowSettings={windowSettings} onSettingChange={handleSettingChange} />}
              {activeTab === 'style' && <AppearanceSettings config={config} setConfig={setConfig} togglePiX={togglePiX} togglePiY={togglePiY} />}
          </div>
        </aside>
        <main className="flex-1 bg-gray-100 overflow-hidden relative flex flex-col">
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
                <defs>
                   <clipPath id="master-grid-clip">
                      <rect x={gridArea.xStart} y={gridArea.yStart} width={gridArea.xEnd - gridArea.xStart} height={gridArea.yEnd - gridArea.yStart} />
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
                <g className="clipped-math-content" clipPath="url(#master-grid-clip)">
                  <g className="inequality-fill-layer">{renderInequalities(engine, inequalities, 'fill', showIntersection)}</g>
                  <g className="inequality-stroke-layer">{renderInequalities(engine, inequalities, 'stroke', showIntersection, showFullBoundary, globalStrokeWidth)}</g>
                </g>
                {showIntersection && <g className="vertices-layer">{renderFeatures(engine, vertices, handleVertexLabelMouseDown)}</g>}
                
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

export default InequalityGrapher;
