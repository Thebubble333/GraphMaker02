import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { BaseGraphEngine } from '../utils/graphBase';
import { renderInequalities, renderFeatures } from '../utils/graphRenderers';
import { CARTESIAN_CONFIG } from '../config/graphDefaults';
import { InequalityDef, FeaturePoint, GraphConfig } from '../types';
import { analyzeInequalityIntersections, preprocessMathExpression } from '../utils/mathAnalysis';
import { Settings, List, Sliders, Palette, Edit3, Plus, Trash2, EyeOff, RefreshCcw, Type, FlipHorizontal, Layers } from 'lucide-react';
import * as math from 'mathjs';
import { CM_TO_PX } from '../constants';

import { GraphToolbar } from '../components/GraphToolbar';
import { GraphContextMenu, ContextMenuItem } from '../components/GraphContextMenu';
import { useGraphInteraction } from '../hooks/useGraphInteraction';
import { useDragSystem } from '../hooks/useDragSystem';
import { useHistory } from '../hooks/useHistory';
import { calculateAxisLabelDrag, calculateAxisResize } from '../utils/dragStrategies';

import { InequalityList } from '../components/inequality-grapher/InequalityList';
import { WindowSettings } from '../components/settings/WindowSettings';
import { AppearanceSettings } from '../components/settings/AppearanceSettings';

const INITIAL_INEQS: InequalityDef[] = [
  { id: '1', type: 'y', expression: 'sin(x)', operator: '<', color: '#000000', visible: true },
  { id: '2', type: 'y', expression: 'cos(x)', operator: '>=', color: '#000000', visible: true }
];

const INITIAL_WINDOW = {
  xMin: "-4", xMax: "4", yMin: "-4", yMax: "4",
  xStep: "1", yStep: "1", xSubdivisions: 2, ySubdivisions: 2
};

interface InequalityContextMenuState {
  x: number;
  y: number;
  mathX: number;
  mathY: number;
  targetType: 'inequality' | 'feature' | 'axis' | 'axis-label' | 'grid' | 'canvas';
  targetId?: string;
}

const InequalityGrapher: React.FC = () => {
  const [config, setConfig] = useState<GraphConfig>(CARTESIAN_CONFIG);
  const [inequalities, setInequalities] = useState<InequalityDef[]>(INITIAL_INEQS);
  const [showIntersection, setShowIntersection] = useState(false);
  const [showFullBoundary, setShowFullBoundary] = useState(false);
  const [vertices, setVertices] = useState<FeaturePoint[]>([]);
  
  const [activeTab, setActiveTab] = useState<'data' | 'window' | 'style'>('data');
  const [showExactValues, setShowExactValues] = useState(true);
  const [globalStrokeWidth, setGlobalStrokeWidth] = useState(2);
  
  const [dimCm, setDimCm] = useState({ width: 12, height: 12 });
  const [isFixedSize, setIsFixedSize] = useState(true);
  
  const [windowSettings, setWindowSettings] = useState(INITIAL_WINDOW);

  const [highlightedItemId, setHighlightedItemId] = useState<string | null>(null);
  const [contextMenu, setContextMenu] = useState<InequalityContextMenuState | null>(null);
  const [cursorCoords, setCursorCoords] = useState<{ x: number; y: number } | null>(null);

  const parseMath = (input: string | number): number => {
      try {
          const val = math.evaluate(preprocessMathExpression(String(input)).parsed);
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

    setConfig(prev => {
        let updatedShowZero = prev.showZeroLabel;
        if (prev.autoZeroLabel) {
            updatedShowZero = yMin >= 0;
        }
        return {
          ...prev, xRange: [xMin, xMax], yRange: [yMin, yMax], majorStep: [xStep, yStep], subdivisions: [xSub, ySub],
          showZeroLabel: updatedShowZero
        };
    });
  }, [windowSettings]);

  const historyState = useMemo(() => ({
      config,
      inequalities,
      showIntersection,
      showFullBoundary,
      vertices,
      showExactValues,
      globalStrokeWidth,
      dimCm,
      isFixedSize,
      windowSettings
  }), [
      config, inequalities, showIntersection, showFullBoundary,
      vertices, showExactValues, globalStrokeWidth, dimCm, isFixedSize, windowSettings
  ]);

  const {
      forceSnapshot,
      undo,
      redo,
      canUndo,
      canRedo,
      exportToFile,
      importFromFile
  } = useHistory({
      appId: 'InequalityGrapher',
      version: 1,
      currentState: historyState,
      onRestore: (restored) => {
          if (!restored) return;
          if (restored.config) setConfig({ ...CARTESIAN_CONFIG, ...restored.config });
          if (restored.inequalities) setInequalities(restored.inequalities);
          if (restored.showIntersection !== undefined) setShowIntersection(restored.showIntersection);
          if (restored.showFullBoundary !== undefined) setShowFullBoundary(restored.showFullBoundary);
          if (restored.vertices) setVertices(restored.vertices);
          if (restored.showExactValues !== undefined) setShowExactValues(restored.showExactValues);
          if (restored.globalStrokeWidth !== undefined) setGlobalStrokeWidth(restored.globalStrokeWidth);
          if (restored.dimCm) setDimCm(restored.dimCm);
          if (restored.isFixedSize !== undefined) setIsFixedSize(restored.isFixedSize);
          if (restored.windowSettings) setWindowSettings(restored.windowSettings);
      }
  });

  const handleResetDefaultSettings = () => {
      setConfig(CARTESIAN_CONFIG);
      setInequalities(INITIAL_INEQS);
      setShowIntersection(false);
      setShowFullBoundary(false);
      setShowExactValues(true);
      setGlobalStrokeWidth(2);
      setDimCm({ width: 12, height: 12 });
      setIsFixedSize(true);
      setWindowSettings(INITIAL_WINDOW);
      setTimeout(() => forceSnapshot(), 50);
  };

  const engine = useMemo(() => new BaseGraphEngine(config), [config]);

  // Use Shared Interaction Hook
  const {
      previewScale, setPreviewScale,
      exportDpi, setExportDpi,
      cropMode, setCropMode,
      selectionBox, customViewBox, hasInitialCrop,
      containerRef,
      handleAutoCrop, handleResetView, handleZoomOutCanvas, handleExportPNG, handleExportSVG, handleCopy, isCopied,
      handleCropMouseDown, handleCropMouseMove, handleCropMouseUp
  } = useGraphInteraction('graph-svg', engine.widthPixels, engine.heightPixels, dimCm.width, false, false, config.cropPadding);

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

  // 3. Vertex Label Drag
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
      const newVertices = analyzeInequalityIntersections(inequalities, config.xRange, config.yRange, showExactValues);
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
  }, [inequalities, config.xRange, config.yRange, showExactValues]);

  const addInequality = () => {
      const newId = Date.now().toString();
      setInequalities(prev => [...prev, { id: newId, type: 'y', expression: '', color: '#000000', operator: '<', visible: true }]);
      return newId;
  };
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

  // Focus & scroll to sidebar item
  const focusSidebarItem = useCallback((tab: 'data' | 'window' | 'style', itemId: string) => {
      setActiveTab(tab);
      setHighlightedItemId(itemId);
      setTimeout(() => {
          const el = document.getElementById(`sidebar-${itemId}`);
          if (el) {
              el.scrollIntoView({ behavior: 'smooth', block: 'center' });
              const input = el.querySelector('input[type="text"]') as HTMLInputElement | null;
              if (input) input.focus();
          }
      }, 80);
      setTimeout(() => setHighlightedItemId(null), 2400);
  }, []);

  const getMathCoordsFromMouse = (e: React.MouseEvent): { x: number; y: number } => {
      const svgEl = document.getElementById('graph-svg') as SVGSVGElement | null;
      if (!svgEl) return { x: 0, y: 0 };
      const rect = svgEl.getBoundingClientRect();
      const scaleX = engine.widthPixels / rect.width;
      const scaleY = engine.heightPixels / rect.height;
      const svgX = (e.clientX - rect.left) * scaleX;
      const svgY = (e.clientY - rect.top) * scaleY;
      const [mx, my] = engine.screenToMath(svgX, svgY);
      return { x: mx, y: my };
  };

  const handleSvgMouseMove = (e: React.MouseEvent) => {
      const coords = getMathCoordsFromMouse(e);
      setCursorCoords(coords);
  };

  const handleSvgContextMenu = (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();

      const coords = getMathCoordsFromMouse(e);
      const targetEl = (e.target as Element).closest('[data-target-type]');
      const targetType = (targetEl?.getAttribute('data-target-type') as InequalityContextMenuState['targetType']) || 'canvas';
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

  const buildContextMenuItems = (): { title: string; subtitle?: string; items: ContextMenuItem[] } | null => {
      if (!contextMenu) return null;
      const subtitle = `(${contextMenu.mathX}, ${contextMenu.mathY})`;

      if (contextMenu.targetType === 'inequality' && contextMenu.targetId) {
          const ineq = inequalities.find(i => i.id === contextMenu.targetId);
          if (ineq) {
              const flipMap: Record<string, '<' | '<=' | '>' | '>='> = { '<': '>', '>': '<', '<=': '>=', '>=': '<=' };
              const strictMap: Record<string, '<' | '<=' | '>' | '>='> = { '<': '<=', '<=': '<', '>': '>=', '>=': '>' };
              const isStrict = ['<', '>'].includes(ineq.operator);
              const items: ContextMenuItem[] = [
                  {
                      label: 'Locate & Edit in Sidebar',
                      icon: <Edit3 size={13} />,
                      accent: true,
                      onClick: () => focusSidebarItem('data', `ineq-${ineq.id}`)
                  }
              ];

              if (ineq.type !== 'linear' && ineq.type !== 'complex') {
                  items.push(
                      {
                          label: `Flip Direction (${ineq.operator} → ${flipMap[ineq.operator]})`,
                          icon: <FlipHorizontal size={13} />,
                          onClick: () => updateInequality(ineq.id, { operator: flipMap[ineq.operator] })
                      },
                      {
                          label: `Make Boundary ${isStrict ? 'Solid (≤ / ≥)' : 'Dashed (< / >)'}`,
                          icon: <Layers size={13} />,
                          onClick: () => updateInequality(ineq.id, { operator: strictMap[ineq.operator] })
                      }
                  );
              }

              items.push(
                  {
                      label: showIntersection ? 'Show All Individual Regions' : 'Show Intersection Region Only',
                      icon: <Layers size={13} />,
                      onClick: () => setShowIntersection(!showIntersection)
                  },
                  {
                      label: 'Hide Inequality',
                      icon: <EyeOff size={13} />,
                      dividerBefore: true,
                      onClick: () => updateInequality(ineq.id, { visible: false })
                  },
                  {
                      label: 'Delete Inequality',
                      icon: <Trash2 size={13} />,
                      danger: true,
                      onClick: () => removeInequality(ineq.id)
                  }
              );

              const exprTitle = ineq.type === 'linear' || ineq.type === 'complex'
                  ? ineq.expression
                  : `${ineq.type} ${ineq.operator} ${ineq.expression}`;

              return {
                  title: `Inequality: ${exprTitle}`,
                  subtitle,
                  items
              };
          }
      }

      if (contextMenu.targetType === 'feature' && contextMenu.targetId) {
          const v = vertices.find(pt => pt.id === contextMenu.targetId);
          if (v) {
              return {
                  title: `Region Corner ${v.label}`,
                  subtitle,
                  items: [
                      {
                          label: 'Locate Corner in Sidebar',
                          icon: <Edit3 size={13} />,
                          accent: true,
                          onClick: () => focusSidebarItem('data', `vertex-${v.id}`)
                      },
                      {
                          label: v.showLabel ? 'Hide Coordinate Label' : 'Show Coordinate Label',
                          icon: <Type size={13} />,
                          onClick: () => toggleVertexLabel(v.id)
                      },
                      {
                          label: 'Reset Label Offset',
                          icon: <RefreshCcw size={13} />,
                          onClick: () => resetVertex(v.id)
                      },
                      {
                          label: 'Hide Corner Point',
                          icon: <EyeOff size={13} />,
                          danger: true,
                          dividerBefore: true,
                          onClick: () => toggleVertex(v.id)
                      }
                  ]
              };
          }
      }

      if (contextMenu.targetType === 'axis' || contextMenu.targetType === 'axis-label' || contextMenu.targetType === 'grid') {
          const items: ContextMenuItem[] = [
              {
                  label: 'Edit Axis Range & Steps (Window)',
                  icon: <Sliders size={13} />,
                  accent: true,
                  onClick: () => setActiveTab('window')
              },
              {
                  label: 'Edit Axis & Grid Style',
                  icon: <Palette size={13} />,
                  onClick: () => setActiveTab('style')
              }
          ];
          if (contextMenu.targetType === 'axis-label') {
              items.push({
                  label: 'Reset Label Position',
                  icon: <RefreshCcw size={13} />,
                  onClick: () => {
                      if (contextMenu.targetId === 'x') setConfig(prev => ({ ...prev, offsetXAxisLabelX: 0, offsetXAxisLabelY: 0 }));
                      else if (contextMenu.targetId === 'y') setConfig(prev => ({ ...prev, offsetYAxisLabelX: 0, offsetYAxisLabelY: 0 }));
                      else if (contextMenu.targetId === 'origin') setConfig(prev => ({ ...prev, originLabelOffset: { x: 0, y: 0 } }));
                  }
              });
          }
          return {
              title: contextMenu.targetType === 'axis-label' ? 'Axis Label Actions' : 'Axes & Grid Actions',
              subtitle,
              items
          };
      }

      return {
          title: 'Inequality Graph Canvas',
          subtitle,
          items: [
              {
                  label: 'Add New Inequality',
                  icon: <Plus size={13} />,
                  accent: true,
                  onClick: () => {
                      const newId = addInequality();
                      focusSidebarItem('data', `ineq-${newId}`);
                  }
              },
              {
                  label: showIntersection ? 'Show Individual Regions' : 'Show Intersection Region Only',
                  icon: <Layers size={13} />,
                  onClick: () => setShowIntersection(!showIntersection)
              },
              {
                  label: 'Edit Window & Axes Range',
                  icon: <Sliders size={13} />,
                  dividerBefore: true,
                  onClick: () => setActiveTab('window')
              },
              {
                  label: 'Edit Grid & Style Settings',
                  icon: <Palette size={13} />,
                  onClick: () => setActiveTab('style')
              }
          ]
      };
  };

  const gridArea = engine.getGridBoundaries();
  const menuConfig = buildContextMenuItems();

  return (
    <div className="flex h-full flex-col bg-gray-50" onMouseMove={handleGlobalMouseMove} onMouseUp={handleGlobalMouseUp}>
      <header className="flex items-center justify-between px-4 py-2 bg-white border-b border-gray-200 shadow-xs z-10">
        <div className="flex items-center gap-2.5">
          <div className="p-1.5 bg-purple-50 text-purple-600 rounded-md"><Settings className="w-4 h-4" /></div>
          <div>
              <h1 className="text-base font-semibold text-gray-800 leading-tight">Inequality Grapher</h1>
              <p className="text-[11px] text-gray-500 right-click-hint">Right-click any region, boundary, or corner on the graph for quick actions</p>
          </div>
        </div>
        <GraphToolbar 
            previewScale={previewScale} setPreviewScale={setPreviewScale}
            exportDpi={exportDpi} onDpiChange={setExportDpi}
            cropMode={cropMode} setCropMode={setCropMode}
            onResetView={handleResetView} onZoomOutCanvas={handleZoomOutCanvas} onAutoCrop={handleAutoCrop}
            onExportPNG={handleExportPNG} onCopy={handleCopy} isCopied={isCopied} onExportSVG={handleExportSVG}
            onExportData={() => exportToFile('inequality_grapher.json')}
            onImportData={importFromFile}
            onUndo={undo} onRedo={redo} canUndo={canUndo} canRedo={canRedo}
            onDefaultSettings={handleResetDefaultSettings}
        />
      </header>

      <div className="flex flex-1 overflow-hidden">
        <aside className="w-80 bg-white border-r border-gray-200 flex flex-col h-full z-20">
          <div className="flex border-b border-gray-200 bg-white">
            <button onClick={() => setActiveTab('data')} className={`flex-1 py-2.5 text-xs font-medium flex justify-center items-center gap-1.5 ${activeTab === 'data' ? 'text-purple-600 border-b-2 border-purple-600 bg-purple-50/50' : 'text-gray-500'}`}><List size={14} /> Data</button>
            <button onClick={() => setActiveTab('window')} className={`flex-1 py-2.5 text-xs font-medium flex justify-center items-center gap-1.5 ${activeTab === 'window' ? 'text-purple-600 border-b-2 border-purple-600 bg-purple-50/50' : 'text-gray-500'}`}><Sliders size={14} /> Window</button>
            <button onClick={() => setActiveTab('style')} className={`flex-1 py-2.5 text-xs font-medium flex justify-center items-center gap-1.5 ${activeTab === 'style' ? 'text-purple-600 border-b-2 border-purple-600 bg-purple-50/50' : 'text-gray-500'}`}><Palette size={14} /> Style</button>
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
                          inequalities={inequalities} onUpdate={updateInequality} onRemove={removeInequality} onAdd={() => { addInequality(); }}
                          showIntersection={showIntersection} onToggleIntersection={setShowIntersection}
                          showFullBoundary={showFullBoundary} onToggleFullBoundary={setShowFullBoundary}
                          vertices={vertices} 
                          onToggleVertex={toggleVertex} 
                          onToggleVertexLabel={toggleVertexLabel}
                          onResetVertex={resetVertex}
                          highlightedId={highlightedItemId}
                      />
                  </div>
              )}
              {activeTab === 'window' && <WindowSettings dimCm={dimCm} setDimCm={setDimCm} isFixedSize={isFixedSize} setIsFixedSize={setIsFixedSize} windowSettings={windowSettings} onSettingChange={handleSettingChange} />}
              {activeTab === 'style' && <AppearanceSettings config={config} setConfig={setConfig} togglePiX={togglePiX} togglePiY={togglePiY} />}
          </div>
        </aside>
        <main className="flex-1 bg-neutral-100 overflow-hidden relative flex flex-col">
          <div ref={containerRef} className="flex-1 overflow-auto flex p-4 bg-neutral-100 cursor-crosshair canvas-viewport">
            <div
              className="m-auto shrink-0"
              style={{
                width: engine.widthPixels * previewScale,
                height: engine.heightPixels * previewScale
              }}
            >
              <div 
                  className={`bg-white shadow-xl transition-opacity duration-150 ease-in-out relative ${cropMode ? 'cursor-crosshair' : 'cursor-default'}`}
                  style={{ 
                     width: engine.widthPixels,
                     height: engine.heightPixels,
                     transform: `scale(${previewScale})`, 
                     transformOrigin: 'top left',
                     opacity: hasInitialCrop ? 1 : 0
                  }}
                  onMouseDown={handleCropMouseDown}
                  onMouseMove={handleSvgMouseMove}
                  onMouseLeave={() => setCursorCoords(null)}
                  onContextMenu={handleSvgContextMenu}
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
                    {!config.studentMode && (
                        <>
                            <g className="inequality-fill-layer">
                                {renderInequalities(engine, inequalities, 'fill', showIntersection)}
                            </g>
                            <g className="inequality-stroke-layer">
                                {renderInequalities(engine, inequalities, 'stroke', showIntersection, showFullBoundary, globalStrokeWidth)}
                            </g>
                        </>
                    )}
                  </g>
                  {!config.studentMode && showIntersection && <g className="vertices-layer">{renderFeatures(engine, vertices, handleVertexLabelMouseDown)}</g>}
                  
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
          </div>

          {cursorCoords && (
              <div className="absolute bottom-3 right-4 bg-white/90 backdrop-blur-sm border border-gray-200 px-2.5 py-1 rounded shadow-sm text-xs font-mono text-gray-600 pointer-events-none">
                  x: {cursorCoords.x.toFixed(2)}, y: {cursorCoords.y.toFixed(2)}
              </div>
          )}

          {cropMode && (
              <div className="absolute top-4 left-1/2 -translate-x-1/2 bg-blue-600 text-white px-4 py-2 rounded-full shadow-lg text-sm font-bold animate-pulse pointer-events-none">
                  Drag to Crop Graph
              </div>
          )}

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

export default InequalityGrapher;