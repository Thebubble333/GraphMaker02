
import React, { useState, useMemo } from 'react';
import { BaseGraphEngine } from '../utils/graphBase';
import { renderFunctionPlots, renderVerticalLines, renderFeatures, renderPoints, renderIntegrals, renderTangents } from '../utils/graphRenderers';
import { FunctionDef, TangentDef } from '../types';
import { calculateTangentEquation, findSnapPoint } from '../utils/mathAnalysis';
import { Settings, List, Sliders, Palette, PenTool } from 'lucide-react';

// Shared Components & Hooks
import { GraphToolbar } from '../components/GraphToolbar';
import { useGraphInteraction } from '../hooks/useGraphInteraction';
import { useDragSystem } from '../hooks/useDragSystem';
import { calculateAxisLabelDrag, calculateAxisResize } from '../utils/dragStrategies';
import { useFunctionGrapherState } from '../hooks/useFunctionGrapherState';

import { FunctionList } from '../components/function-grapher/FunctionList';
import { FunctionTools } from '../components/function-grapher/FunctionTools';
import { WindowSettings } from '../components/settings/WindowSettings';
import { AppearanceSettings } from '../components/settings/AppearanceSettings';

const FunctionGrapher: React.FC = () => {
  // Use the extracted state hook
  const {
      config, setConfig,
      functions, setFunctions,
      points, setPoints,
      verticalLines,
      integrals,
      tangents, setTangents,
      features, setFeatures,
      intersectionSelection,
      dimCm, setDimCm,
      isFixedSize, setIsFixedSize,
      showExactValues, setShowExactValues,
      windowSettings, setWindowSettings,
      bgImage, setBgImage,
      
      handleLoadPreset,
      addFunction, updateFunction, removeFunction, updateFunctionDomain, toggleDomainInclusive,
      addTangent, updateTangent, removeTangent, decoupleTangent,
      addIntegral, updateIntegral, removeIntegral,
      addVerticalLine, updateVerticalLine, removeVerticalLine,
      addPoint, updatePoint, removePoint,
      updateFeatures,
      handleSettingChange,
      togglePiX, togglePiY,
      toggleIntersectionSelection
  } = useFunctionGrapherState();

  const [isCopied, setIsCopied] = useState(false);
  const [activeTab, setActiveTab] = useState<'data' | 'tools' | 'window' | 'style'>('data');

  const engine = useMemo(() => new BaseGraphEngine(config), [config]);

  // Use Shared Interaction Hooks
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

  // 1. Axis Label Drag Handler
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

  // 2. Axis Resize (Arrow) Drag Handler
  const handleArrowDragStart = (axis: 'x' | 'y', side: 'positive' | 'negative', e: React.MouseEvent) => {
      const initRange = { x: config.xRange, y: config.yRange };
      
      onMouseDown(e, initRange, (dx, dy, init, ev) => {
          const updates = calculateAxisResize(axis, dx, dy, engine.scaleX, engine.scaleY, init, side, ev.shiftKey);
          if (Object.keys(updates).length > 0) {
              setWindowSettings(prev => ({ ...prev, ...updates }));
          }
      }, undefined, 'axis-resize');
  };

  // 3. Feature Label Drag Handler
  const handleFeatureLabelDragStart = (id: string, e: React.MouseEvent) => {
      if (cropMode) return;
      const feat = features.find(f => f.id === id);
      if (!feat) return;

      onMouseDown(e, { ...feat.customLabelOffset }, (dx, dy, init) => {
          setFeatures(prev => prev.map(f => {
              if (f.id === id) {
                  return { ...f, customLabelOffset: { x: init.x + dx, y: init.y + dy } };
              }
              return f;
          }));
      }, undefined, 'feature-label');
  };

  // 4. Tangent Drag Handler (Updates Position + Recalculates Derived Function)
  const handleTangentDragStart = (id: string, e: React.MouseEvent) => {
      if (cropMode) return;
      const t = tangents.find(t => t.id === id);
      if (!t) return;

      const startX = t.x;

      onMouseDown(e, { startX }, (dx, dy, init, ev) => {
          const mathDx = dx / engine.scaleX;
          let newX = init.startX + mathDx;

          if (ev.shiftKey) {
              const funcFeatures = features.filter(f => f.functionId === t.functionId);
              const threshold = 10 / engine.scaleX;
              const gridStep = config.piXAxis ? Math.PI / 2 : config.majorStep[0];
              newX = findSnapPoint(newX, funcFeatures, gridStep, threshold);
          }

          // Update tangent position
          const updatedTangent = { ...t, x: newX };
          
          // Recalculate linked function
          const sourceFunc = functions.find(f => f.id === t.functionId);
          let derivedUpdate: Partial<FunctionDef> = {};
          if (sourceFunc && t.derivedFunctionId) {
              const eqn = calculateTangentEquation(sourceFunc.expression, newX, t.mode);
              if (eqn) derivedUpdate = { expression: eqn };
          }

          setTangents(prev => prev.map(tan => tan.id === id ? updatedTangent : tan));
          
          if (t.derivedFunctionId && derivedUpdate.expression) {
              setFunctions(prev => prev.map(f => f.id === t.derivedFunctionId ? { ...f, ...derivedUpdate } : f));
          }

      }, undefined, 'tangent-drag');
  };

  // Global Mouse Handlers
  const handleGlobalMouseMove = (e: React.MouseEvent) => {
      if (handleCropMouseMove(e)) return;
      onMouseMove(e);
  };

  const handleGlobalMouseUp = () => {
      handleCropMouseUp();
      onMouseUp();
  };

  const gridArea = engine.getGridBoundaries();

  // Helper to render background image
  const renderBgImage = () => {
      if (!bgImage) return null;
      // Get math coords
      const [xPx, yPxTop] = engine.mathToScreen(bgImage.x, bgImage.y);
      const [_, yPxBottom] = engine.mathToScreen(bgImage.x, bgImage.y - bgImage.height);
      const widthPx = bgImage.width * engine.scaleX;
      const heightPx = Math.abs(yPxBottom - yPxTop);

      return (
          <image 
              href={bgImage.url}
              x={xPx}
              y={yPxTop}
              width={widthPx}
              height={heightPx}
              opacity={bgImage.opacity}
              preserveAspectRatio="none"
          />
      );
  };

  return (
    <div className="flex h-full flex-col bg-gray-50" onMouseMove={handleGlobalMouseMove} onMouseUp={handleGlobalMouseUp}>
      <header className="flex items-center justify-between px-6 py-3 bg-white border-b border-gray-200 shadow-sm z-10">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-blue-50 text-blue-600 rounded-lg"><Settings className="w-5 h-5" /></div>
          <h1 className="text-xl font-semibold text-gray-800">Function Grapher</h1>
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
            <button onClick={() => setActiveTab('data')} className={`flex-1 py-3 text-sm font-medium flex justify-center items-center gap-2 transition-colors ${activeTab === 'data' ? 'text-blue-600 border-b-2 border-blue-600 bg-blue-50/50' : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'}`}><List size={16} /> Data</button>
            <button onClick={() => setActiveTab('tools')} className={`flex-1 py-3 text-sm font-medium flex justify-center items-center gap-2 transition-colors ${activeTab === 'tools' ? 'text-blue-600 border-b-2 border-blue-600 bg-blue-50/50' : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'}`}><PenTool size={16} /> Tools</button>
            <button onClick={() => setActiveTab('window')} className={`flex-1 py-3 text-sm font-medium flex justify-center items-center gap-2 transition-colors ${activeTab === 'window' ? 'text-blue-600 border-b-2 border-blue-600 bg-blue-50/50' : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'}`}><Sliders size={16} /> Window</button>
            <button onClick={() => setActiveTab('style')} className={`flex-1 py-3 text-sm font-medium flex justify-center items-center gap-2 transition-colors ${activeTab === 'style' ? 'text-blue-600 border-b-2 border-blue-600 bg-blue-50/50' : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'}`}><Palette size={16} /> Style</button>
          </div>

          <div className="flex-1 overflow-y-auto custom-scrollbar">
              {activeTab === 'data' && (
                  <FunctionList 
                      functions={functions} features={features} verticalLines={verticalLines} points={points}
                      showExactValues={showExactValues} onToggleExactValues={setShowExactValues}
                      onUpdateFunction={updateFunction} onRemoveFunction={removeFunction} onAddFunction={addFunction}
                      onUpdateFeatures={updateFeatures}
                      onUpdateDomain={updateFunctionDomain} 
                      onAddVLine={addVerticalLine} onUpdateVLine={updateVerticalLine} onRemoveVLine={removeVerticalLine}
                      onAddPoint={addPoint} onUpdatePoint={updatePoint} onRemovePoint={removePoint}
                      onToggleDomainInclusive={toggleDomainInclusive}
                      intersectionSelection={intersectionSelection}
                      onToggleIntersectionSelection={toggleIntersectionSelection}
                  />
              )}
              {activeTab === 'tools' && (
                  <FunctionTools 
                      functions={functions}
                      integrals={integrals} onAddIntegral={addIntegral} onUpdateIntegral={updateIntegral} onRemoveIntegral={removeIntegral}
                      tangents={tangents} onAddTangent={addTangent} onUpdateTangent={updateTangent} onRemoveTangent={removeTangent} onDecoupleTangent={decoupleTangent}
                      showExactValues={showExactValues} onToggleExactValues={setShowExactValues} onLoadPreset={handleLoadPreset}
                      bgImage={bgImage} onUpdateBgImage={setBgImage}
                  />
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
                <g className="image-layer">{renderBgImage()}</g>
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
                  {renderIntegrals(engine, integrals, functions)}
                  {renderVerticalLines(engine, verticalLines)}
                  {renderFunctionPlots(engine, functions)}
                  {renderTangents(engine, tangents, functions, handleTangentDragStart)}
                </g>
                <g className="features-layer">
                  {renderFeatures(
                    engine, 
                    features.filter(ft => {
                       // Show features if parent visible
                       const func = functions.find(f => f.id === ft.functionId);
                       return func ? func.visible : true; 
                    }), 
                    handleFeatureLabelDragStart
                  )}
                </g>
                <g className="points-layer">{renderPoints(engine, points)}</g>

                {/* Crop Overlay inside SVG to match coordinates visually */}
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

export default FunctionGrapher;
