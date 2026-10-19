import React, { useState, useMemo, useEffect } from 'react';
import { BaseGraphEngine } from '../utils/graphBase';
import { renderFunctionPlots, renderVerticalLines, renderFeatures, renderPoints, renderIntegrals, renderTangents } from '../utils/graphRenderers';
import { FunctionDef } from '../types';
import { calculateTangentEquation, findSnapPoint } from '../utils/mathAnalysis';
import { Settings, List, Sliders, Palette, PenTool, EyeOff, Trash2, Edit3, Tag, MoveUpRight, Plus } from 'lucide-react';

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

interface ContextMenuState {
    x: number;
    y: number;
    mathX: number;
    mathY: number;
    targetType: 'function' | 'feature' | 'tangent' | 'integral' | 'vline' | 'point' | 'axis' | 'axis-label' | 'grid' | 'canvas';
    targetId?: string;
}

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
      globalScope,
      
      undo, redo, canUndo, canRedo, exportToFile, importFromFile, handleResetDefaultSettings,

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

  const [activeTab, setActiveTab] = useState<'data' | 'tools' | 'window' | 'style'>('data');
  const [highlightedItemId, setHighlightedItemId] = useState<string | null>(null);
  const [pickingIntegralId, setPickingIntegralId] = useState<string | null>(null);
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null);
  const [cursorCoords, setCursorCoords] = useState<{ x: number; y: number } | null>(null);

  const engine = useMemo(() => new BaseGraphEngine(config), [config]);

  // Use Shared Interaction Hooks
  const {
      previewScale, setPreviewScale,
      exportDpi, setExportDpi,
      cropMode, setCropMode,
      selectionBox, customViewBox, hasInitialCrop,
      containerRef,
      handleAutoCrop, handleResetView, handleZoomOutCanvas, handleExportPNG, handleCopy, isCopied, handleExportSVG,
      handleCropMouseDown, handleCropMouseMove, handleCropMouseUp
  } = useGraphInteraction('graph-svg', engine.widthPixels, engine.heightPixels, dimCm.width, false, false, config.cropPadding);

  // Close context menu on outside click or Escape
  useEffect(() => {
      if (!contextMenu && !pickingIntegralId) return;
      const close = () => setContextMenu(null);
      const onKey = (e: KeyboardEvent) => {
          if (e.key === 'Escape') {
              setContextMenu(null);
              setPickingIntegralId(null);
          }
      };
      window.addEventListener('click', close);
      window.addEventListener('keydown', onKey);
      return () => {
          window.removeEventListener('click', close);
          window.removeEventListener('keydown', onKey);
      };
  }, [contextMenu, pickingIntegralId]);

  const focusSidebarItem = (tab: 'data' | 'tools' | 'window' | 'style', itemId: string) => {
      setActiveTab(tab);
      setHighlightedItemId(itemId);
      setTimeout(() => {
          const el = document.getElementById(`sidebar-${itemId}`) || document.getElementById(itemId);
          if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }, 60);
      setTimeout(() => setHighlightedItemId(null), 2200);
  };

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
      const t = tangents.find(tan => tan.id === id);
      if (!t) return;

      const startX = t.x;

      onMouseDown(e, { startX }, (dx, _dy, init, ev) => {
          if (!engine.scaleX) return;
          const mathDx = dx / engine.scaleX;
          let newX = init.startX + mathDx;
          if (!isFinite(newX)) return;

          if (ev.shiftKey) {
              const funcFeatures = features.filter(f => f.functionId === t.functionId);
              const threshold = 10 / engine.scaleX;
              const gridStep = config.piXAxis ? Math.PI / 2 : config.majorStep[0];
              const snapped = findSnapPoint(newX, funcFeatures, gridStep, threshold);
              if (isFinite(snapped)) newX = snapped;
          }

          setTangents(prev => prev.map(tan => tan.id === id ? { ...tan, x: newX } : tan));
          
          if (t.derivedFunctionId) {
              const sourceFunc = functions.find(f => f.id === t.functionId);
              const eqn = sourceFunc ? calculateTangentEquation(sourceFunc.expression, newX, t.mode, globalScope) : null;
              const nextExpr = eqn ?? '';
              setFunctions(prev => prev.map(f => (f.id === t.derivedFunctionId && f.expression !== nextExpr) ? { ...f, expression: nextExpr } : f));
          }
      }, undefined, 'tangent-drag');
  };

  // 5. Origin Label Drag Handler
  const handleOriginLabelDragStart = (e: React.MouseEvent) => {
      if (cropMode) return;
      const initOffset = config.originLabelOffset || { x: 0, y: 0 };
      
      onMouseDown(e, initOffset, (dx, dy, init) => {
          setConfig(prev => ({
              ...prev,
              originLabelOffset: { x: init.x + dx, y: init.y + dy }
          }));
      }, undefined, 'origin-label');
  };

  // Convert mouse event on SVG to math coordinates
  const getMathCoordsFromMouse = (e: React.MouseEvent): { x: number; y: number } | null => {
      const svgEl = document.getElementById('graph-svg') as SVGSVGElement | null;
      if (!svgEl) return null;
      const rect = svgEl.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) return null;
      const vb = svgEl.viewBox.baseVal;
      const vbX = vb && vb.width > 0 ? vb.x : 0;
      const vbY = vb && vb.height > 0 ? vb.y : 0;
      const vbW = vb && vb.width > 0 ? vb.width : engine.widthPixels;
      const vbH = vb && vb.height > 0 ? vb.height : engine.heightPixels;

      const svgX = vbX + ((e.clientX - rect.left) / rect.width) * vbW;
      const svgY = vbY + ((e.clientY - rect.top) / rect.height) * vbH;
      const [mathX, mathY] = engine.screenToMath(svgX, svgY);
      return { x: mathX, y: mathY };
  };

  const handleCanvasMouseDown = (e: React.MouseEvent) => {
      if (pickingIntegralId && e.button === 0) {
          e.stopPropagation();
          const coords = getMathCoordsFromMouse(e);
          if (coords && isFinite(coords.x) && isFinite(coords.y)) {
              updateIntegral(pickingIntegralId, {
                  seedPoint: { x: Number(coords.x.toFixed(4)), y: Number(coords.y.toFixed(4)) },
                  shadingMode: 'auto'
              });
          }
          setPickingIntegralId(null);
          return;
      }
      handleCropMouseDown(e);
  };

  // Right-click handler on SVG canvas
  const handleCanvasContextMenu = (e: React.MouseEvent) => {
      e.preventDefault();
      const coords = getMathCoordsFromMouse(e) || { x: 0, y: 0 };
      const targetEl = (e.target as HTMLElement).closest('[data-target-type]') as HTMLElement | null;
      const targetType = (targetEl?.getAttribute('data-target-type') as ContextMenuState['targetType']) || 'canvas';
      const targetId = targetEl?.getAttribute('data-target-id') || undefined;

      setContextMenu({
          x: e.clientX,
          y: e.clientY,
          mathX: Number(coords.x.toFixed(2)),
          mathY: Number(coords.y.toFixed(2)),
          targetType,
          targetId
      });
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

  // Helper to render background image (with rotation support)
  const renderBgImage = () => {
      if (!bgImage) return null;
      const [xPx, yPxTop] = engine.mathToScreen(bgImage.x, bgImage.y);
      const [_, yPxBottom] = engine.mathToScreen(bgImage.x, bgImage.y - bgImage.height);
      const widthPx = bgImage.width * engine.scaleX;
      const heightPx = Math.abs(yPxBottom - yPxTop);
      const cx = xPx + widthPx / 2;
      const cy = yPxTop + heightPx / 2;

      return (
          <image 
              href={bgImage.url}
              x={xPx}
              y={yPxTop}
              width={widthPx}
              height={heightPx}
              opacity={bgImage.opacity}
              transform={bgImage.rotation ? `rotate(${bgImage.rotation}, ${cx}, ${cy})` : undefined}
              preserveAspectRatio="none"
          />
      );
  };

  return (
    <div className="flex h-full flex-col bg-gray-50" onMouseMove={handleGlobalMouseMove} onMouseUp={handleGlobalMouseUp}>
      <header className="flex items-center justify-between px-6 py-3 bg-white border-b border-gray-200 shadow-sm z-10">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-blue-50 text-blue-600 rounded-lg"><Settings className="w-5 h-5" /></div>
          <div>
              <h1 className="text-xl font-semibold text-gray-800 leading-tight">Function Grapher</h1>
              <p className="text-[11px] text-gray-500">Right-click any curve, point, or region on the graph for quick actions</p>
          </div>
        </div>
        
        <GraphToolbar 
            previewScale={previewScale} setPreviewScale={setPreviewScale}
            exportDpi={exportDpi} onDpiChange={setExportDpi}
            cropMode={cropMode} setCropMode={setCropMode}
            onResetView={handleResetView} onZoomOutCanvas={handleZoomOutCanvas} onAutoCrop={handleAutoCrop}
            onExportPNG={handleExportPNG} onCopy={handleCopy} isCopied={isCopied} onExportSVG={handleExportSVG}
            onExportData={() => exportToFile('function_grapher.json')}
            onImportData={importFromFile}
            onUndo={undo} onRedo={redo} canUndo={canUndo} canRedo={canRedo}
            onDefaultSettings={handleResetDefaultSettings}
        />
      </header>

      <div className="flex flex-1 overflow-hidden">
        <aside className="w-96 bg-white border-r border-gray-200 flex flex-col h-full z-20 shrink-0">
          <div className="flex border-b border-gray-200 bg-white">
            <button onClick={() => setActiveTab('data')} className={`flex-1 py-3 text-sm font-medium flex justify-center items-center gap-1.5 transition-colors ${activeTab === 'data' ? 'text-blue-600 border-b-2 border-blue-600 bg-blue-50/50' : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'}`}><List size={15} /> Data</button>
            <button onClick={() => setActiveTab('tools')} className={`flex-1 py-3 text-sm font-medium flex justify-center items-center gap-1.5 transition-colors ${activeTab === 'tools' ? 'text-blue-600 border-b-2 border-blue-600 bg-blue-50/50' : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'}`}><PenTool size={15} /> Tools</button>
            <button onClick={() => setActiveTab('window')} className={`flex-1 py-3 text-sm font-medium flex justify-center items-center gap-1.5 transition-colors ${activeTab === 'window' ? 'text-blue-600 border-b-2 border-blue-600 bg-blue-50/50' : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'}`}><Sliders size={15} /> Window</button>
            <button onClick={() => setActiveTab('style')} className={`flex-1 py-3 text-sm font-medium flex justify-center items-center gap-1.5 transition-colors ${activeTab === 'style' ? 'text-blue-600 border-b-2 border-blue-600 bg-blue-50/50' : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'}`}><Palette size={15} /> Style</button>
          </div>

          <div className="flex-1 overflow-y-auto custom-scrollbar">
              {activeTab === 'data' && (
                  <FunctionList 
                      functions={functions} features={features} verticalLines={verticalLines} points={points}
                      showExactValues={showExactValues} onToggleExactValues={setShowExactValues}
                      onUpdateFunction={updateFunction} onRemoveFunction={removeFunction} onAddFunction={addFunction}
                      onUpdateFeatures={updateFeatures}
                      onUpdateDomain={updateFunctionDomain} 
                      onAddVLine={() => addVerticalLine()} onUpdateVLine={updateVerticalLine} onRemoveVLine={removeVerticalLine}
                      onAddPoint={() => addPoint()} onUpdatePoint={updatePoint} onRemovePoint={removePoint}
                      onToggleDomainInclusive={toggleDomainInclusive}
                      intersectionSelection={intersectionSelection}
                      onToggleIntersectionSelection={toggleIntersectionSelection}
                      highlightedId={highlightedItemId}
                  />
              )}
              {activeTab === 'tools' && (
                  <FunctionTools 
                      functions={functions}
                      verticalLines={verticalLines}
                      xRange={config.xRange}
                      yRange={config.yRange}
                      integrals={integrals} onAddIntegral={addIntegral} onUpdateIntegral={updateIntegral} onRemoveIntegral={removeIntegral}
                      pickingIntegralId={pickingIntegralId} onSetPickingIntegralId={setPickingIntegralId}
                      tangents={tangents} onAddTangent={() => addTangent()} onUpdateTangent={updateTangent} onRemoveTangent={removeTangent} onDecoupleTangent={decoupleTangent}
                      showExactValues={showExactValues} onToggleExactValues={setShowExactValues} onLoadPreset={handleLoadPreset}
                      bgImage={bgImage} onUpdateBgImage={setBgImage}
                      globalScope={globalScope}
                      highlightedId={highlightedItemId}
                  />
              )}
              {activeTab === 'window' && <WindowSettings dimCm={dimCm} setDimCm={setDimCm} isFixedSize={isFixedSize} setIsFixedSize={setIsFixedSize} windowSettings={windowSettings} onSettingChange={handleSettingChange} />}
              {activeTab === 'style' && <AppearanceSettings config={config} setConfig={setConfig} togglePiX={togglePiX} togglePiY={togglePiY} />}
          </div>
        </aside>

        <main className="flex-1 bg-gray-100 overflow-hidden relative flex flex-col">
          <div ref={containerRef} className="flex-1 overflow-auto flex items-center justify-center p-8 bg-neutral-100 cursor-crosshair">
            <div 
                className={`bg-white shadow-2xl transition-all duration-200 ease-in-out relative ${cropMode || pickingIntegralId ? 'cursor-crosshair' : 'cursor-default'}`} 
                style={{ 
                   transform: `scale(${previewScale})`, 
                   transformOrigin: 'top center',
                   opacity: hasInitialCrop ? 1 : 0 
                }}
                onMouseDown={handleCanvasMouseDown}
                onContextMenu={handleCanvasContextMenu}
                onMouseMove={(e) => {
                    const coords = getMathCoordsFromMouse(e);
                    if (coords && isFinite(coords.x) && isFinite(coords.y)) {
                        setCursorCoords(coords);
                    }
                }}
                onMouseLeave={() => setCursorCoords(null)}
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
                      <rect 
                        x={config.clipContentX === false ? -5000 : gridArea.xStart} 
                        y={config.clipContentY === false ? -5000 : gridArea.yStart} 
                        width={config.clipContentX === false ? 10000 + engine.widthPixels : gridArea.xEnd - gridArea.xStart} 
                        height={config.clipContentY === false ? 10000 + engine.heightPixels : gridArea.yEnd - gridArea.yStart} 
                      />
                   </clipPath>
                </defs>
                <rect x="0" y="0" width={engine.widthPixels} height={engine.heightPixels} fill="white" />
                <g className="image-layer">{renderBgImage()}</g>
                <g className="grid-layer">{engine.renderGrid()}</g>
                <g className="axis-labels-layer">
                    {engine.renderLabels(
                        (e) => handleAxisLabelDragStart('x', e),
                        (e) => handleAxisLabelDragStart('y', e),
                        handleOriginLabelDragStart
                    )}
                </g>
                <g className="axis-layer">
                  {engine.renderAxes(
                      (axis, side, e) => handleArrowDragStart(axis, side, e)
                  )}
                </g>
                <g className="clipped-math-content" clipPath="url(#master-grid-clip)">
                  {!config.studentMode && (
                      <>
                          {renderIntegrals(engine, integrals, functions, globalScope, verticalLines)}
                          {renderVerticalLines(engine, verticalLines, globalScope)}
                          {renderFunctionPlots(engine, functions, globalScope)}
                          {renderTangents(engine, tangents, functions, handleTangentDragStart, globalScope)}
                      </>
                  )}
                </g>
                <g className="features-layer">
                  {!config.studentMode && renderFeatures(
                    engine, 
                    features.filter(ft => {
                       const func = functions.find(f => f.id === ft.functionId);
                       return func ? func.visible : true; 
                    }), 
                    handleFeatureLabelDragStart
                  )}
                </g>
                <g className="points-layer">{!config.studentMode && renderPoints(engine, points, globalScope)}</g>

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

          {/* Live Cursor Coordinate Readout */}
          {cursorCoords && (
              <div className="absolute bottom-3 right-4 bg-white/90 backdrop-blur-sm border border-gray-200 px-2.5 py-1 rounded shadow-sm text-xs font-mono text-gray-600 pointer-events-none">
                  x: {cursorCoords.x.toFixed(2)}, y: {cursorCoords.y.toFixed(2)}
              </div>
          )}

          {pickingIntegralId && (
              <div className="absolute top-4 left-1/2 -translate-x-1/2 bg-blue-600 text-white px-4 py-2 rounded-full shadow-lg text-xs font-semibold flex items-center gap-2">
                  <span>Click inside any enclosed region on the graph to shade that pocket</span>
                  <button
                      onClick={() => setPickingIntegralId(null)}
                      className="px-2 py-0.5 bg-blue-700 hover:bg-blue-800 rounded-full text-[10px]"
                  >
                      Cancel
                  </button>
              </div>
          )}

          {cropMode && (
              <div className="absolute top-4 left-1/2 -translate-x-1/2 bg-blue-600 text-white px-4 py-2 rounded-full shadow-lg text-sm font-bold animate-pulse pointer-events-none">
                  Drag to Crop Graph
              </div>
          )}

          {/* Right-Click Context Menu */}
          {contextMenu && (
              <div
                  className="fixed bg-white border border-gray-200 rounded-lg shadow-xl py-1.5 w-60 z-50 text-xs text-gray-700"
                  style={{
                      left: Math.min(contextMenu.x, window.innerWidth - 250),
                      top: Math.min(contextMenu.y, window.innerHeight - 240)
                  }}
                  onClick={(e) => e.stopPropagation()}
              >
                  <div className="px-3 py-1 border-b border-gray-100 text-[10px] font-bold uppercase tracking-wider text-gray-400 flex justify-between items-center">
                      <span>{contextMenu.targetType === 'canvas' ? 'Graph Canvas' : `${contextMenu.targetType} Actions`}</span>
                      <span className="font-mono text-gray-500">({contextMenu.mathX}, {contextMenu.mathY})</span>
                  </div>

                  {contextMenu.targetType === 'function' && contextMenu.targetId && (() => {
                      const fn = functions.find(f => f.id === contextMenu.targetId);
                      if (!fn) return null;
                      return (
                          <>
                              <button
                                  onClick={() => { focusSidebarItem('data', `func-${fn.id}`); setContextMenu(null); }}
                                  className="w-full px-3 py-1.5 text-left hover:bg-blue-50 hover:text-blue-600 flex items-center gap-2"
                              >
                                  <Edit3 size={13} /> Edit Curve in Sidebar
                              </button>
                              {!fn.isParametric && !fn.locked && (
                                  <button
                                      onClick={() => {
                                          addTangent(fn.id, contextMenu.mathX, 'tangent');
                                          setActiveTab('tools');
                                          setContextMenu(null);
                                      }}
                                      className="w-full px-3 py-1.5 text-left hover:bg-blue-50 hover:text-blue-600 flex items-center gap-2"
                                  >
                                      <MoveUpRight size={13} /> Add Tangent at x = {contextMenu.mathX}
                                  </button>
                              )}
                              <button
                                  onClick={() => { updateFunction(fn.id, { visible: false }); setContextMenu(null); }}
                                  className="w-full px-3 py-1.5 text-left hover:bg-gray-100 flex items-center gap-2"
                              >
                                  <EyeOff size={13} /> Hide Curve
                              </button>
                              {!fn.locked && (
                                  <button
                                      onClick={() => { removeFunction(fn.id); setContextMenu(null); }}
                                      className="w-full px-3 py-1.5 text-left hover:bg-red-50 text-red-600 flex items-center gap-2"
                                  >
                                      <Trash2 size={13} /> Delete Function
                                  </button>
                              )}
                          </>
                      );
                  })()}

                  {contextMenu.targetType === 'feature' && contextMenu.targetId && (() => {
                      const ft = features.find(f => f.id === contextMenu.targetId);
                      if (!ft) return null;
                      return (
                          <>
                              <button
                                  onClick={() => {
                                      focusSidebarItem('data', `func-${ft.functionId}`);
                                      setContextMenu(null);
                                  }}
                                  className="w-full px-3 py-1.5 text-left hover:bg-blue-50 hover:text-blue-600 flex items-center gap-2"
                              >
                                  <Edit3 size={13} /> Locate in Sidebar
                              </button>
                              <button
                                  onClick={() => { updateFeatures([ft.id], { showLabel: !ft.showLabel }); setContextMenu(null); }}
                                  className="w-full px-3 py-1.5 text-left hover:bg-gray-100 flex items-center gap-2"
                              >
                                  <Tag size={13} /> {ft.showLabel ? 'Hide Coordinate Label' : 'Show Coordinate Label'}
                              </button>
                              <button
                                  onClick={() => { updateFeatures([ft.id], { visible: false }); setContextMenu(null); }}
                                  className="w-full px-3 py-1.5 text-left hover:bg-red-50 text-red-600 flex items-center gap-2"
                              >
                                  <EyeOff size={13} /> Hide Feature Point
                              </button>
                          </>
                      );
                  })()}

                  {contextMenu.targetType === 'tangent' && contextMenu.targetId && (
                      <>
                          <button
                              onClick={() => { focusSidebarItem('tools', `tangent-${contextMenu.targetId}`); setContextMenu(null); }}
                              className="w-full px-3 py-1.5 text-left hover:bg-blue-50 hover:text-blue-600 flex items-center gap-2"
                          >
                              <Edit3 size={13} /> Edit Tangent in Tools
                          </button>
                          <button
                              onClick={() => { removeTangent(contextMenu.targetId!); setContextMenu(null); }}
                              className="w-full px-3 py-1.5 text-left hover:bg-red-50 text-red-600 flex items-center gap-2"
                          >
                              <Trash2 size={13} /> Delete Tangent
                          </button>
                      </>
                  )}

                  {contextMenu.targetType === 'integral' && contextMenu.targetId && (
                      <>
                          <button
                              onClick={() => { focusSidebarItem('tools', `integral-${contextMenu.targetId}`); setContextMenu(null); }}
                              className="w-full px-3 py-1.5 text-left hover:bg-blue-50 hover:text-blue-600 flex items-center gap-2"
                          >
                              <Edit3 size={13} /> Edit Shaded Region in Tools
                          </button>
                          <button
                              onClick={() => {
                                  updateIntegral(contextMenu.targetId!, {
                                      seedPoint: { x: contextMenu.mathX, y: contextMenu.mathY },
                                      shadingMode: 'auto'
                                  });
                                  setContextMenu(null);
                              }}
                              className="w-full px-3 py-1.5 text-left hover:bg-blue-50 hover:text-blue-600 flex items-center gap-2"
                          >
                              <Plus size={13} /> Focus Pocket at ({contextMenu.mathX}, {contextMenu.mathY})
                          </button>
                          <button
                              onClick={() => { removeIntegral(contextMenu.targetId!); setContextMenu(null); }}
                              className="w-full px-3 py-1.5 text-left hover:bg-red-50 text-red-600 flex items-center gap-2"
                          >
                              <Trash2 size={13} /> Delete Shaded Region
                          </button>
                      </>
                  )}

                  {contextMenu.targetType === 'vline' && contextMenu.targetId && (
                      <>
                          <button
                              onClick={() => { focusSidebarItem('data', `vline-${contextMenu.targetId}`); setContextMenu(null); }}
                              className="w-full px-3 py-1.5 text-left hover:bg-blue-50 hover:text-blue-600 flex items-center gap-2"
                          >
                              <Edit3 size={13} /> Edit Vertical Line in Sidebar
                          </button>
                          <button
                              onClick={() => { removeVerticalLine(contextMenu.targetId!); setContextMenu(null); }}
                              className="w-full px-3 py-1.5 text-left hover:bg-red-50 text-red-600 flex items-center gap-2"
                          >
                              <Trash2 size={13} /> Delete Vertical Line
                          </button>
                      </>
                  )}

                  {contextMenu.targetType === 'point' && contextMenu.targetId && (
                      <>
                          <button
                              onClick={() => { focusSidebarItem('data', `point-${contextMenu.targetId}`); setContextMenu(null); }}
                              className="w-full px-3 py-1.5 text-left hover:bg-blue-50 hover:text-blue-600 flex items-center gap-2"
                          >
                              <Edit3 size={13} /> Edit Point in Sidebar
                          </button>
                          <button
                              onClick={() => { removePoint(contextMenu.targetId!); setContextMenu(null); }}
                              className="w-full px-3 py-1.5 text-left hover:bg-red-50 text-red-600 flex items-center gap-2"
                          >
                              <Trash2 size={13} /> Delete Point
                          </button>
                      </>
                  )}

                  {(contextMenu.targetType === 'axis' || contextMenu.targetType === 'axis-label' || contextMenu.targetType === 'grid') && (
                      <>
                          <button
                              onClick={() => { setActiveTab('window'); setContextMenu(null); }}
                              className="w-full px-3 py-1.5 text-left hover:bg-blue-50 hover:text-blue-600 flex items-center gap-2"
                          >
                              <Sliders size={13} /> Edit Axis Range & Steps (Window)
                          </button>
                          <button
                              onClick={() => { setActiveTab('style'); setContextMenu(null); }}
                              className="w-full px-3 py-1.5 text-left hover:bg-blue-50 hover:text-blue-600 flex items-center gap-2"
                          >
                              <Palette size={13} /> Edit Axis & Grid Appearance (Style)
                          </button>
                          {contextMenu.targetType === 'axis-label' && (
                              <button
                                  onClick={() => {
                                      if (contextMenu.targetId === 'x') {
                                          setConfig(prev => ({ ...prev, offsetXAxisLabelX: 0, offsetXAxisLabelY: 0 }));
                                      } else if (contextMenu.targetId === 'y') {
                                          setConfig(prev => ({ ...prev, offsetYAxisLabelX: 0, offsetYAxisLabelY: 0 }));
                                      } else if (contextMenu.targetId === 'origin') {
                                          setConfig(prev => ({ ...prev, originLabelOffset: { x: 0, y: 0 } }));
                                      }
                                      setContextMenu(null);
                                  }}
                                  className="w-full px-3 py-1.5 text-left hover:bg-gray-100 flex items-center gap-2"
                              >
                                  <RefreshCcw size={13} /> Reset Label Position
                              </button>
                          )}
                          <button
                              onClick={() => {
                                  const newId = Date.now().toString();
                                  setPoints(prev => [...prev, {
                                      id: newId,
                                      x: String(contextMenu.mathX),
                                      y: String(contextMenu.mathY),
                                      color: '#000000',
                                      size: 4,
                                      style: 'filled',
                                      label: `(${contextMenu.mathX}, ${contextMenu.mathY})`,
                                      visible: true
                                  }]);
                                  focusSidebarItem('data', `point-${newId}`);
                                  setContextMenu(null);
                              }}
                              className="w-full px-3 py-1.5 text-left hover:bg-blue-50 hover:text-blue-600 flex items-center gap-2 border-t border-gray-100 mt-1 pt-1.5"
                          >
                              <Plus size={13} /> Add Point at ({contextMenu.mathX}, {contextMenu.mathY})
                          </button>
                      </>
                  )}

                  {contextMenu.targetType === 'canvas' && (
                      <>
                          <button
                              onClick={() => {
                                  const newId = Date.now().toString();
                                  setPoints(prev => [...prev, {
                                      id: newId,
                                      x: String(contextMenu.mathX),
                                      y: String(contextMenu.mathY),
                                      color: '#000000',
                                      size: 4,
                                      style: 'filled',
                                      label: `(${contextMenu.mathX}, ${contextMenu.mathY})`,
                                      visible: true
                                  }]);
                                  focusSidebarItem('data', `point-${newId}`);
                                  setContextMenu(null);
                              }}
                              className="w-full px-3 py-1.5 text-left hover:bg-blue-50 hover:text-blue-600 flex items-center gap-2"
                          >
                              <Plus size={13} /> Add Point at ({contextMenu.mathX}, {contextMenu.mathY})
                          </button>
                          <button
                              onClick={() => {
                                  addFunction('function');
                                  setActiveTab('data');
                                  setContextMenu(null);
                              }}
                              className="w-full px-3 py-1.5 text-left hover:bg-blue-50 hover:text-blue-600 flex items-center gap-2"
                          >
                              <Plus size={13} /> Add New Function f(x)
                          </button>
                          <button
                              onClick={() => {
                                  setActiveTab('window');
                                  setContextMenu(null);
                              }}
                              className="w-full px-3 py-1.5 text-left hover:bg-gray-100 flex items-center gap-2"
                          >
                              <Sliders size={13} /> Edit Window & Axes Range
                          </button>
                          <button
                              onClick={() => {
                                  setActiveTab('style');
                                  setContextMenu(null);
                              }}
                              className="w-full px-3 py-1.5 text-left hover:bg-gray-100 flex items-center gap-2"
                          >
                              <Palette size={13} /> Edit Grid & Style Settings
                          </button>
                      </>
                  )}
              </div>
          )}
        </main>
      </div>
    </div>
  );
};

export default FunctionGrapher;

