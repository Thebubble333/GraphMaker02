import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { BaseGraphEngine } from '../utils/graphBase';
import { NUMBER_LINE_CONFIG } from '../config/graphDefaults';
import { IntervalDef, GraphConfig } from '../types';
import { parseIntervalExpression } from '../utils/mathAnalysis';
import { Settings, List, Sliders, Palette, Plus, Trash2, Eye, EyeOff, Layers, Edit3, ArrowUp, ArrowDown, Copy, RefreshCcw, Type } from 'lucide-react';
import * as math from 'mathjs';
import { CM_TO_PX } from '../constants';

import { GraphToolbar } from '../components/GraphToolbar';
import { GraphContextMenu, ContextMenuItem } from '../components/GraphContextMenu';
import { useGraphInteraction } from '../hooks/useGraphInteraction';
import { useDragSystem } from '../hooks/useDragSystem';
import { useHistory } from '../hooks/useHistory';
import { calculateAxisLabelDrag, calculateAxisResize } from '../utils/dragStrategies';

import { WindowSettings } from '../components/settings/WindowSettings';
import { AppearanceSettings } from '../components/settings/AppearanceSettings';
import { RichInput } from '../components/ui/RichInput';

const INITIAL_INTERVALS: IntervalDef[] = [
  { id: '1', expression: '[-2, 3]', color: '#000000', visible: true, heightOffset: 1, label: '', showLabel: false, strokeWidth: 3 },
  { id: '2', expression: 'x > 1', color: '#000000', visible: true, heightOffset: 2, label: '', showLabel: false, strokeWidth: 3 }
];

const INITIAL_NUMBER_LINE_CONFIG: GraphConfig = {
  ...NUMBER_LINE_CONFIG,
  yRange: [-1, 3], 
  majorStep: [1, 1],
  fontSize: 11
};

const INITIAL_WINDOW = {
  xMin: "-5", xMax: "5", yMin: "-1", yMax: "3",
  xStep: "1", yStep: "1", xSubdivisions: 2, ySubdivisions: 2
};

interface NumberLineContextMenuState {
  x: number;
  y: number;
  mathX: number;
  targetType: 'interval' | 'axis' | 'axis-label' | 'grid' | 'canvas';
  targetId?: string;
}

const NumberLine: React.FC = () => {
  const [config, setConfig] = useState<GraphConfig>(INITIAL_NUMBER_LINE_CONFIG);
  const [intervals, setIntervals] = useState<IntervalDef[]>(INITIAL_INTERVALS);
  
  const [activeTab, setActiveTab] = useState<'data' | 'window' | 'style'>('data');
  const [dimCm, setDimCm] = useState({ width: 15, height: 6 });
  const [isFixedSize, setIsFixedSize] = useState(true);
  
  const [windowSettings, setWindowSettings] = useState(INITIAL_WINDOW);

  const [highlightedItemId, setHighlightedItemId] = useState<string | null>(null);
  const [contextMenu, setContextMenu] = useState<NumberLineContextMenuState | null>(null);
  const [cursorX, setCursorX] = useState<number | null>(null);

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
    
    setConfig(prev => ({ 
        ...prev, 
        xRange: [xMin, xMax], 
        majorStep: [xStep, 1], 
        subdivisions: [xSub, 1]
    }));
  }, [windowSettings]);

  const historyState = useMemo(() => ({
      config,
      intervals,
      dimCm,
      isFixedSize,
      windowSettings
  }), [config, intervals, dimCm, isFixedSize, windowSettings]);

  const {
      forceSnapshot,
      undo,
      redo,
      canUndo,
      canRedo,
      exportToFile,
      importFromFile
  } = useHistory({
      appId: 'NumberLine',
      version: 1,
      currentState: historyState,
      onRestore: (restored) => {
          if (!restored) return;
          if (restored.config) setConfig({ ...INITIAL_NUMBER_LINE_CONFIG, ...restored.config });
          if (restored.intervals) setIntervals(restored.intervals);
          if (restored.dimCm) setDimCm(restored.dimCm);
          if (restored.isFixedSize !== undefined) setIsFixedSize(restored.isFixedSize);
          if (restored.windowSettings) setWindowSettings(restored.windowSettings);
      }
  });

  const handleResetDefaultSettings = () => {
      setConfig(INITIAL_NUMBER_LINE_CONFIG);
      setIntervals(INITIAL_INTERVALS);
      setDimCm({ width: 15, height: 6 });
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
        const intChildren: React.ReactNode[] = [];

        segments.forEach((parsed, segIdx) => {
            const mathStartX = parsed.start === null ? xStart : engine.mathToScreen(parsed.start, 0)[0];
            const mathEndX = parsed.end === null ? xEnd : engine.mathToScreen(parsed.end, 0)[0];
            const lineStartX = parsed.start === null ? mathStartX + arrowW : mathStartX;
            const lineEndX = parsed.end === null ? mathEndX - arrowW : mathEndX;

            // Wide transparent hit line for effortless right-click
            intChildren.push(<line key={`${int.id}-${segIdx}-hit`} x1={mathStartX} y1={baselineY} x2={mathEndX} y2={baselineY} stroke="transparent" strokeWidth={Math.max(14, int.strokeWidth + 10)} />);
            intChildren.push(<line key={`${int.id}-${segIdx}-line`} x1={lineStartX} y1={baselineY} x2={lineEndX} y2={baselineY} stroke={int.color} strokeWidth={int.strokeWidth} />);

            if (parsed.start === null) {
                intChildren.push(<path key={`${int.id}-${segIdx}-as`} d={`M ${mathStartX} ${baselineY} L ${mathStartX+arrowW} ${baselineY-5} L ${mathStartX+arrowW} ${baselineY+5} Z`} fill={int.color} />);
            }
            if (parsed.end === null) {
                intChildren.push(<path key={`${int.id}-${segIdx}-ae`} d={`M ${mathEndX} ${baselineY} L ${mathEndX-arrowW} ${baselineY-5} L ${mathEndX-arrowW} ${baselineY+5} Z`} fill={int.color} />);
            }

            if (parsed.start !== null) {
                intChildren.push(<circle key={`${int.id}-${segIdx}-cs`} cx={mathStartX} cy={baselineY} r={5} fill={parsed.startInclusive ? int.color : 'white'} stroke={int.color} strokeWidth={2} />);
            }
            if (parsed.end !== null) {
                intChildren.push(<circle key={`${int.id}-${segIdx}-ce`} cx={mathEndX} cy={baselineY} r={5} fill={parsed.endInclusive ? int.color : 'white'} stroke={int.color} strokeWidth={2} />);
            }
        });

        if (int.showLabel && int.label && segments.length > 0) {
            const first = segments[0]; const last = segments[segments.length-1];
            const sx = first.start === null ? xStart : engine.mathToScreen(first.start, 0)[0];
            const ex = last.end === null ? xEnd : engine.mathToScreen(last.end, 0)[0];
            intChildren.push(...engine.texEngine.renderToSVG(int.label, (sx+ex)/2, baselineY - 15, engine.cfg.fontSize, int.color, 'middle', true));
        }

        els.push(
            <g
                key={`int-grp-${int.id}`}
                data-target-type="interval"
                data-target-id={int.id}
                style={{ cursor: 'context-menu' }}
            >
                {intChildren}
            </g>
        );
    });
    return els;
  };

  const addInterval = (defaultExpr: string = '') => {
      const newId = Date.now().toString();
      setIntervals(prev => [...prev, {
          id: newId,
          expression: defaultExpr,
          color: '#000000',
          visible: true,
          heightOffset: prev.length + 1,
          label: '',
          showLabel: false,
          strokeWidth: 3
      }]);
      return newId;
  };
  const updateInterval = (id: string, u: Partial<IntervalDef>) => setIntervals(prev => prev.map(i => i.id === id ? { ...i, ...u } : i));
  const removeInterval = (id: string) => setIntervals(prev => prev.filter(i => i.id !== id));

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

  const getMathXFromMouse = (e: React.MouseEvent): number => {
      const svgEl = document.getElementById('graph-svg') as SVGSVGElement | null;
      if (!svgEl) return 0;
      const rect = svgEl.getBoundingClientRect();
      const scaleX = engine.widthPixels / rect.width;
      const svgX = (e.clientX - rect.left) * scaleX;
      const [mx] = engine.screenToMath(svgX, 0);
      return mx;
  };

  const handleSvgMouseMove = (e: React.MouseEvent) => {
      setCursorX(getMathXFromMouse(e));
  };

  const handleSvgContextMenu = (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();

      const mx = getMathXFromMouse(e);
      const targetEl = (e.target as Element).closest('[data-target-type]');
      const targetType = (targetEl?.getAttribute('data-target-type') as NumberLineContextMenuState['targetType']) || 'canvas';
      const targetId = targetEl?.getAttribute('data-target-id') || undefined;

      setContextMenu({
          x: e.clientX,
          y: e.clientY,
          mathX: Number(mx.toFixed(2)),
          targetType,
          targetId
      });
  };

  const buildContextMenuItems = (): { title: string; subtitle?: string; items: ContextMenuItem[] } | null => {
      if (!contextMenu) return null;
      const subtitle = `x = ${contextMenu.mathX}`;

      if (contextMenu.targetType === 'interval' && contextMenu.targetId) {
          const int = intervals.find(i => i.id === contextMenu.targetId);
          if (int) {
              return {
                  title: `Interval: ${int.expression || 'Untitled'}`,
                  subtitle,
                  items: [
                      {
                          label: 'Locate & Edit in Sidebar',
                          icon: <Edit3 size={13} />,
                          accent: true,
                          onClick: () => focusSidebarItem('data', `interval-${int.id}`)
                      },
                      {
                          label: int.showLabel ? 'Hide Interval Label' : 'Show Interval Label',
                          icon: <Type size={13} />,
                          onClick: () => updateInterval(int.id, {
                              showLabel: !int.showLabel,
                              label: !int.showLabel && !int.label ? int.expression : int.label
                          })
                      },
                      {
                          label: 'Move Higher (+0.5)',
                          icon: <ArrowUp size={13} />,
                          onClick: () => updateInterval(int.id, { heightOffset: Number((int.heightOffset + 0.5).toFixed(2)) })
                      },
                      {
                          label: 'Move Lower (-0.5)',
                          icon: <ArrowDown size={13} />,
                          onClick: () => updateInterval(int.id, { heightOffset: Number((int.heightOffset - 0.5).toFixed(2)) })
                      },
                      {
                          label: 'Duplicate Interval',
                          icon: <Copy size={13} />,
                          onClick: () => {
                              const newId = Date.now().toString();
                              setIntervals(prev => [...prev, { ...int, id: newId, heightOffset: int.heightOffset + 0.75 }]);
                              focusSidebarItem('data', `interval-${newId}`);
                          }
                      },
                      {
                          label: 'Hide Interval',
                          icon: <EyeOff size={13} />,
                          dividerBefore: true,
                          onClick: () => updateInterval(int.id, { visible: false })
                      },
                      {
                          label: 'Delete Interval',
                          icon: <Trash2 size={13} />,
                          danger: true,
                          onClick: () => removeInterval(int.id)
                      }
                  ]
              };
          }
      }

      if (contextMenu.targetType === 'axis' || contextMenu.targetType === 'axis-label' || contextMenu.targetType === 'grid') {
          const items: ContextMenuItem[] = [
              {
                  label: 'Edit Number Line Range & Step',
                  icon: <Sliders size={13} />,
                  accent: true,
                  onClick: () => setActiveTab('window')
              },
              {
                  label: 'Edit Axis & Tick Style',
                  icon: <Palette size={13} />,
                  onClick: () => setActiveTab('style')
              }
          ];
          if (contextMenu.targetType === 'axis-label') {
              items.push({
                  label: 'Reset Label Position',
                  icon: <RefreshCcw size={13} />,
                  onClick: () => setConfig(prev => ({ ...prev, offsetXAxisLabelX: 0, offsetXAxisLabelY: 0 }))
              });
          }
          items.push({
              label: `Add Interval Starting at x = ${Math.round(contextMenu.mathX)}`,
              icon: <Plus size={13} />,
              dividerBefore: true,
              onClick: () => {
                  const startVal = Math.round(contextMenu.mathX);
                  const newId = addInterval(`[${startVal}, ${startVal + 2}]`);
                  focusSidebarItem('data', `interval-${newId}`);
              }
          });
          return {
              title: 'Number Line Axis Actions',
              subtitle,
              items
          };
      }

      const roundedX = Math.round(contextMenu.mathX);
      return {
          title: 'Number Line Canvas',
          subtitle,
          items: [
              {
                  label: `Add Closed Interval [${roundedX}, ${roundedX + 2}]`,
                  icon: <Plus size={13} />,
                  accent: true,
                  onClick: () => {
                      const newId = addInterval(`[${roundedX}, ${roundedX + 2}]`);
                      focusSidebarItem('data', `interval-${newId}`);
                  }
              },
              {
                  label: `Add Ray x ≥ ${roundedX}`,
                  icon: <Plus size={13} />,
                  onClick: () => {
                      const newId = addInterval(`x >= ${roundedX}`);
                      focusSidebarItem('data', `interval-${newId}`);
                  }
              },
              {
                  label: 'Edit Number Line Range (Window)',
                  icon: <Sliders size={13} />,
                  dividerBefore: true,
                  onClick: () => setActiveTab('window')
              },
              {
                  label: 'Edit Style Settings',
                  icon: <Palette size={13} />,
                  onClick: () => setActiveTab('style')
              }
          ]
      };
  };

  const menuConfig = buildContextMenuItems();

  return (
    <div className="flex h-full flex-col bg-gray-50" onMouseMove={handleGlobalMouseMove} onMouseUp={handleGlobalMouseUp}>
      <header className="flex items-center justify-between px-6 py-3 bg-white border-b border-gray-200 shadow-sm z-10">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-green-50 text-green-600 rounded-lg"><Settings className="w-5 h-5" /></div>
          <div>
              <h1 className="text-xl font-semibold text-gray-800 leading-tight">Number Line</h1>
              <p className="text-[11px] text-gray-500">Right-click any interval or the axis for quick actions</p>
          </div>
        </div>
        <GraphToolbar 
            previewScale={previewScale} setPreviewScale={setPreviewScale}
            exportDpi={exportDpi} onDpiChange={setExportDpi}
            cropMode={cropMode} setCropMode={setCropMode}
            onResetView={handleResetView} onZoomOutCanvas={handleZoomOutCanvas} onAutoCrop={handleAutoCrop}
            onExportPNG={handleExportPNG} onCopy={handleCopy} isCopied={isCopied} onExportSVG={handleExportSVG}
            onExportData={() => exportToFile('number_line.json')}
            onImportData={importFromFile}
            onUndo={undo} onRedo={redo} canUndo={canUndo} canRedo={canRedo}
            onDefaultSettings={handleResetDefaultSettings}
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
                          <button onClick={() => addInterval()} className="p-1 hover:bg-gray-200 rounded text-green-600" title="Add Interval"><Plus size={16} /></button>
                      </div>
                      <div className="p-2 space-y-2">
                          {intervals.map(int => {
                              const isHighlighted = highlightedItemId === `interval-${int.id}`;
                              return (
                                  <div
                                      key={int.id}
                                      id={`sidebar-interval-${int.id}`}
                                      className={`bg-white border rounded-md p-3 shadow-sm transition-all duration-300 ${
                                          isHighlighted
                                              ? 'border-green-500 ring-2 ring-green-400 bg-green-50/40'
                                              : 'border-gray-200 hover:border-green-300'
                                      }`}
                                  >
                                      <div className="flex items-center gap-2 mb-2">
                                          <input type="text" value={int.expression} onChange={(e) => updateInterval(int.id, { expression: e.target.value })} placeholder="e.g. [-2, 5] or x > 3" className="flex-1 border border-gray-300 rounded px-2 py-1 text-sm focus:border-green-500 focus:outline-none" />
                                          <button onClick={() => updateInterval(int.id, { visible: !int.visible })} className="text-gray-400" title={int.visible ? 'Hide' : 'Show'}>{int.visible ? <Eye size={16} /> : <EyeOff size={16} />}</button>
                                          <button onClick={() => removeInterval(int.id)} className="text-gray-400 hover:text-red-500" title="Delete"><Trash2 size={16} /></button>
                                      </div>
                                      <div className="mb-2">
                                         <RichInput 
                                            value={int.label} 
                                            onChange={(e) => updateInterval(int.id, { label: e.target.value })} 
                                            className="w-full border border-gray-300 rounded px-2 py-1 text-sm focus:border-green-500 focus:outline-none"
                                            placeholder="Label (optional)"
                                         />
                                         <label className="flex items-center gap-2 mt-1 text-xs text-gray-500 cursor-pointer">
                                            <input type="checkbox" checked={int.showLabel} onChange={(e) => updateInterval(int.id, { showLabel: e.target.checked })} />
                                            Show Label
                                         </label>
                                      </div>
                                      <div className="grid grid-cols-2 gap-2">
                                          <div className="flex items-center gap-2">
                                              <input type="color" value={int.color} onChange={(e) => updateInterval(int.id, { color: e.target.value })} className="w-8 h-8 p-0 border-0 rounded cursor-pointer" />
                                              <div className="flex items-center gap-1" title="Height Offset above Number Line">
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
                              );
                          })}
                      </div>
                  </div>
              )}
              {activeTab === 'window' && <WindowSettings dimCm={dimCm} setDimCm={setDimCm} isFixedSize={isFixedSize} setIsFixedSize={setIsFixedSize} windowSettings={windowSettings} onSettingChange={(f,v) => setWindowSettings(p=>({...p,[f]:v}))} />}
              {activeTab === 'style' && <AppearanceSettings config={config} setConfig={setConfig} togglePiX={()=>{}} togglePiY={()=>{}} />}
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
                onMouseMove={handleSvgMouseMove}
                onMouseLeave={() => setCursorX(null)}
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
                {!config.studentMode && <g className="data-layer">{renderIntervals()}</g>}

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

          {cursorX !== null && (
              <div className="absolute bottom-3 right-4 bg-white/90 backdrop-blur-sm border border-gray-200 px-2.5 py-1 rounded shadow-sm text-xs font-mono text-gray-600 pointer-events-none">
                  x: {cursorX.toFixed(2)}
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

export default NumberLine;