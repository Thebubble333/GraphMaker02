import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { BaseGraphEngine } from '../utils/graphBase';
import { renderPoints, renderFunctionPlots, renderVerticalLines } from '../utils/graphRenderers';
import { GraphConfig, PointDef, FunctionDef, VerticalLineDef } from '../types';
import { CARTESIAN_CONFIG } from '../config/graphDefaults';
import { calculateLinearRegression, RegressionResult } from '../utils/mathAnalysis';
import { Settings, List, Sliders, Palette, ScatterChart, TrendingUp, RefreshCw } from 'lucide-react';
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

const INITIAL_DATA = `1\t2
2\t3.5
3\t3.8
4\t5.5
5\t6.2
6\t8.1
7\t8.5
8\t10`;

interface ViewState {
    windowSettings: {
        xMin: string; xMax: string; yMin: string; yMax: string;
        xStep: string; yStep: string; xSubdivisions: number; ySubdivisions: number;
    };
    config: GraphConfig; // Save full config
    dimCm: { width: number, height: number };
    isFixedSize: boolean;
    customViewBox: string | null;
    hasInitialCrop: boolean;
}

const PAGE_KEY = 'scatter-plots';

interface ScatterPlotsSavedState {
  config: GraphConfig;
  dimCm: { width: number; height: number };
  isFixedSize: boolean;
  windowSettings: {
    xMin: string; xMax: string; yMin: string; yMax: string;
    xStep: string; yStep: string; xSubdivisions: number; ySubdivisions: number;
  };
  rawData: string;
  showRegression: boolean;
  viewMode: 'scatter' | 'residual';
  studentMode: boolean;
}

const INITIAL_CONFIG: GraphConfig = {
    ...CARTESIAN_CONFIG,
    xRange: [0, 10], 
    yRange: [0, 12],
    majorStep: [1, 1],
    subdivisions: [2, 2],
    axisLabels: ["distance (km)", "price (USD)"],
    showXAxis: false,
    showYAxis: false,
    xAxisAt: 'bottom',
    yAxisAt: 'left',
    showMinorGrid: true,
    xLabelStyle: 'below-center',
    yLabelStyle: 'left-center',
    yLabelRotation: 'horizontal',
    showZeroLabel: false,
    autoZeroLabel: false,
    showYZeroLabel: false,
    offsetXAxisNumY: 6
};

const INITIAL_WINDOW = {
    xMin: "0", xMax: "10", yMin: "0", yMax: "12",
    xStep: "1", yStep: "1", xSubdivisions: 2, ySubdivisions: 2
};

const ScatterPlots: React.FC = () => {
  const [config, setConfig] = useState<GraphConfig>(INITIAL_CONFIG);
  const [dimCm, setDimCm] = useState({ width: 14, height: 10 });
  const [isFixedSize, setIsFixedSize] = useState(true);
  const [windowSettings, setWindowSettings] = useState(INITIAL_WINDOW);

  // Data State
  const [rawData, setRawData] = useState(INITIAL_DATA);
  const [points, setPoints] = useState<PointDef[]>([]);
  const [showRegression, setShowRegression] = useState(true);
  const [viewMode, setViewMode] = useState<'scatter' | 'residual'>('scatter');
  const [regressionStats, setRegressionStats] = useState<RegressionResult | null>(null);
  const [studentMode, setStudentMode] = useState(false);

  // State to persist view configurations
  const [viewStates, setViewStates] = useState<Record<string, ViewState>>({});

  const [activeTab, setActiveTab] = useState<'data' | 'window' | 'style'>('data');
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; items: ContextMenuItem[] } | null>(null);

  const currentSnapshot = useMemo<ScatterPlotsSavedState>(() => ({
      config, dimCm, isFixedSize, windowSettings, rawData, showRegression, viewMode, studentMode
  }), [config, dimCm, isFixedSize, windowSettings, rawData, showRegression, viewMode, studentMode]);

  const applySnapshot = useCallback((s: ScatterPlotsSavedState) => {
      if (!s) return;
      if (s.config) setConfig(s.config);
      if (s.dimCm) setDimCm(s.dimCm);
      if (s.isFixedSize !== undefined) setIsFixedSize(s.isFixedSize);
      if (s.windowSettings) setWindowSettings(s.windowSettings);
      if (s.rawData !== undefined) setRawData(s.rawData);
      if (s.showRegression !== undefined) setShowRegression(s.showRegression);
      if (s.viewMode) setViewMode(s.viewMode);
      if (s.studentMode !== undefined) setStudentMode(s.studentMode);
  }, []);

  const { undo, redo, canUndo, canRedo, recordNow, exportState, importState, resetToDefaultSettings } = useHistory<ScatterPlotsSavedState>(PAGE_KEY, currentSnapshot, applySnapshot);

  const handleResetDefaults = useCallback(() => {
      setConfig(INITIAL_CONFIG);
      setDimCm({ width: 14, height: 10 });
      setIsFixedSize(true);
      setWindowSettings(INITIAL_WINDOW);
      setRawData(INITIAL_DATA);
      setShowRegression(true);
      setViewMode('scatter');
      setStudentMode(false);
      resetToDefaultSettings();
  }, [resetToDefaultSettings]);

  const focusSidebarElement = (tab: 'data' | 'window' | 'style', elementId?: string) => {
      setActiveTab(tab);
      if (elementId) {
          setTimeout(() => {
              const el = document.getElementById(elementId);
              if (el) {
                  el.scrollIntoView({ behavior: 'smooth', block: 'center' });
                  el.classList.add('ring-2', 'ring-teal-500', 'ring-offset-1');
                  setTimeout(() => el.classList.remove('ring-2', 'ring-teal-500', 'ring-offset-1'), 1800);
                  const input = el.querySelector('textarea, input, select') as HTMLElement | null;
                  if (input) input.focus();
              }
          }, 60);
      }
  };
  

  // Parse Raw Data
  useEffect(() => {
      const lines = rawData.trim().split('\n');
      const newPoints: PointDef[] = [];
      const dataPoints: {x: number, y: number}[] = [];

      lines.forEach((line, idx) => {
          const parts = line.trim().split(/[\t, ]+/);
          if (parts.length >= 2) {
              const x = parseFloat(parts[0]);
              const y = parseFloat(parts[1]);
              if (isFinite(x) && isFinite(y)) {
                  dataPoints.push({ x, y });
                  newPoints.push({
                      id: `pt-${idx}`,
                      x, y,
                      color: 'black',
                      size: 4,
                      style: 'filled',
                      label: '',
                      visible: true
                  });
              }
          }
      });

      // Calculate Regression
      const reg = calculateLinearRegression(dataPoints);
      setRegressionStats(reg);

      // Transform points if in Residual mode
      if (viewMode === 'residual' && reg) {
          const residPoints = dataPoints.map((p, i) => ({
              ...newPoints[i],
              y: p.y - reg.predict(p.x)
          }));
          setPoints(residPoints);
      } else {
          setPoints(newPoints);
      }
      
  }, [rawData, viewMode]);

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

  const engine = useMemo(() => new BaseGraphEngine(config), [config]);

  // Interaction
  const {
      previewScale, setPreviewScale,
      exportDpi, setExportDpi,
      cropMode, setCropMode,
      selectionBox, customViewBox, setCustomViewBox, hasInitialCrop, setHasInitialCrop,
      containerRef,
      handleAutoCrop, handleResetView, handleZoomOutCanvas, handleExportPNG, handleExportSVG, handleCopy, isCopied,
      handleCropMouseDown, handleCropMouseMove, handleCropMouseUp
  } = useGraphInteraction('graph-svg', engine.widthPixels, engine.heightPixels, dimCm.width, false, false, config.cropPadding);

  // Handle Mode Switching with State Persistence
  const handleViewSwitch = (newMode: 'scatter' | 'residual') => {
      // 1. Save Current State
      const currentState: ViewState = {
          windowSettings,
          config, // Save entire config to preserve arrow settings etc
          dimCm,
          isFixedSize,
          customViewBox,
          hasInitialCrop
      };

      setViewStates(prev => ({
          ...prev,
          [viewMode]: currentState
      }));

      // 2. Prepare for New Mode
      const savedState = viewStates[newMode];

      if (savedState) {
          // Restore saved state
          setWindowSettings(savedState.windowSettings);
          setDimCm(savedState.dimCm);
          setIsFixedSize(savedState.isFixedSize);
          setConfig(savedState.config);
          setCustomViewBox(savedState.customViewBox);
          setHasInitialCrop(savedState.hasInitialCrop);
      } else {
          // Defaults if no saved state
          setCustomViewBox(null);
          setHasInitialCrop(false);

          if (newMode === 'residual') {
              if (regressionStats) {
                // Default residual window
                setWindowSettings(prev => ({
                    ...prev,
                    yMin: "-2", yMax: "2", yStep: "0.5",
                }));
                setConfig(prev => ({ 
                    ...prev, 
                    axisLabels: [prev.axisLabels[0], "residual"],
                    xAxisAt: 'bottom',
                    yAxisAt: 'left',
                    showXAxis: false, // Ensure these are off
                    showYAxis: false,
                    showXArrow: false,
                    showYArrow: false,
                    showMinorGrid: false, // Ensure off
                    yLabelStyle: 'left-center',
                    xLabelStyle: 'below-center',
                    yLabelRotation: 'horizontal',
                    offsetXAxisLabelX: 0, offsetXAxisLabelY: 0,
                    offsetYAxisLabelX: 0, offsetYAxisLabelY: 0,
                    tickRounding: [-1, -1] 
                }));
              }
          } else {
              // Default scatter
              setConfig(prev => ({ 
                  ...prev, 
                  axisLabels: [prev.axisLabels[0], "price (USD)"],
                  xAxisAt: 'bottom', // Scatter also needs this style per prompt "for both the scatter plot and residual"
                  yAxisAt: 'left',
                  showXAxis: false,
                  showYAxis: false,
                  showXArrow: false,
                  showYArrow: false,
                  showMinorGrid: false,
                  yLabelStyle: 'left-center',
                  xLabelStyle: 'below-center',
                  yLabelRotation: 'horizontal'
              }));
          }
      }

      setViewMode(newMode);
  };

  const { onMouseDown, onMouseMove, onMouseUp } = useDragSystem(previewScale);

  const handleAxisLabelDragStart = (axis: 'x' | 'y', e: React.MouseEvent) => {
      const initialOffsets = {
          xx: config.offsetXAxisLabelX, xy: config.offsetXAxisLabelY,
          yx: config.offsetYAxisLabelX, yy: config.offsetYAxisLabelY
      };
      
      onMouseDown(e, initialOffsets, (dx, dy, init, ev) => {
          const updates = calculateAxisLabelDrag(config, dx, dy, axis, init, { alt: ev.altKey, ctrl: ev.ctrlKey || ev.metaKey });
          setConfig(prev => ({ ...prev, ...updates }));
      });
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

  // Render Elements
  const regressionLine: FunctionDef[] = useMemo(() => {
      if (!regressionStats) return [];
      
      if (viewMode === 'residual') {
          // Residual plot always has y=0 line
          return [{
              id: 'resid-line', expression: '0', color: 'black', strokeWidth: 1.5,
              visible: true, lineType: 'solid', domain: ['', ''], domainInclusive: [false, false]
          }];
      } else if (showRegression) {
          // Scatter plot: y = mx + c
          return [{
              id: 'reg-line', 
              expression: `${regressionStats.slope} * x + ${regressionStats.intercept}`,
              color: 'black', strokeWidth: 1.5, visible: true, lineType: 'solid',
              domain: ['', ''], domainInclusive: [false, false]
          }];
      }
      return [];
  }, [regressionStats, showRegression, viewMode]);

  const gridArea = engine.getGridBoundaries();

  const handleSvgContextMenu = (e: React.MouseEvent<SVGSVGElement>) => {
      e.preventDefault();
      setContextMenu(null);

      let target: Element | null = e.target as Element;
      let targetType: string | null = null;
      let targetId: string | null = null;

      while (target && target.tagName !== 'svg') {
          const t = target.getAttribute('data-target-type');
          if (t) {
              targetType = t;
              targetId = target.getAttribute('data-target-id');
              break;
          }
          target = target.parentElement;
      }

      const items: ContextMenuItem[] = [];

      if (targetType === 'point' && targetId) {
          const ptIdx = parseInt(targetId.replace('pt-', ''), 10);
          const pt = points.find(p => p.id === targetId);
          items.push(
              { label: `Edit Data Point (${pt ? `${pt.x}, ${pt.y.toFixed(2)}` : `#${ptIdx + 1}`})`, onClick: () => focusSidebarElement('data', 'raw-data-card') },
              {
                  label: 'Delete Point from Data',
                  danger: true,
                  dividerAbove: true,
                  onClick: () => {
                      recordNow();
                      const lines = rawData.trim().split('\n');
                      const filtered = lines.filter((_, idx) => idx !== ptIdx);
                      setRawData(filtered.join('\n'));
                  }
              }
          );
      } else if (targetType === 'function') {
          items.push(
              { label: 'Locate Regression / Analysis Options', onClick: () => focusSidebarElement('data', 'regression-options-card') },
              ...(viewMode === 'scatter' ? [{
                  label: showRegression ? 'Hide Line of Best Fit' : 'Show Line of Best Fit',
                  onClick: () => { recordNow(); setShowRegression(p => !p); }
              }] : []),
              {
                  label: viewMode === 'scatter' ? 'Switch to Residual Plot' : 'Switch to Scatter Plot',
                  onClick: () => { recordNow(); handleViewSwitch(viewMode === 'scatter' ? 'residual' : 'scatter'); }
              }
          );
      } else if (targetType === 'axis-label') {
          const axis = (targetId || 'x').toUpperCase();
          items.push(
              { label: `Edit ${axis}-Axis Label`, onClick: () => focusSidebarElement('style') },
              {
                  label: `Reset ${axis}-Axis Label Offset`,
                  onClick: () => {
                      recordNow();
                      if (targetId === 'x') setConfig(p => ({ ...p, offsetXAxisLabelX: 0, offsetXAxisLabelY: 0 }));
                      else setConfig(p => ({ ...p, offsetYAxisLabelX: 0, offsetYAxisLabelY: 0 }));
                  }
              }
          );
      } else if (targetType === 'axis') {
          items.push(
              { label: 'Configure Axis Window & Steps', onClick: () => focusSidebarElement('window') },
              { label: 'Configure Axis Appearance', onClick: () => focusSidebarElement('style') }
          );
      } else {
          items.push(
              { label: 'Edit Data Points', onClick: () => focusSidebarElement('data', 'raw-data-card') },
              {
                  label: viewMode === 'scatter' ? 'Switch to Residual Plot' : 'Switch to Scatter Plot',
                  onClick: () => { recordNow(); handleViewSwitch(viewMode === 'scatter' ? 'residual' : 'scatter'); }
              },
              ...(viewMode === 'scatter' ? [{
                  label: showRegression ? 'Hide Line of Best Fit' : 'Show Line of Best Fit',
                  onClick: () => { recordNow(); setShowRegression(p => !p); }
              }] : []),
              { label: 'Configure Window & Axes', dividerAbove: true, onClick: () => focusSidebarElement('window') },
              { label: studentMode ? 'Disable Student Mode' : 'Enable Student Mode', onClick: () => { recordNow(); setStudentMode(p => !p); } },
              { label: 'Auto-Crop Graph', onClick: handleAutoCrop },
              { label: 'Reset View', onClick: handleResetView }
          );
      }

      setContextMenu({ x: e.clientX, y: e.clientY, items });
  };

  return (
    <div className="flex h-full flex-col bg-gray-50" onMouseMove={(e) => { if(handleCropMouseMove(e)) return; onMouseMove(e); }} onMouseUp={() => { handleCropMouseUp(); onMouseUp(); }}>
      <header className="flex items-center justify-between px-6 py-3 bg-white border-b border-gray-200 shadow-sm z-10">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-teal-50 text-teal-600 rounded-lg"><ScatterChart className="w-5 h-5" /></div>
          <h1 className="text-xl font-semibold text-gray-800">Scatter Plots</h1>
        </div>
        <GraphToolbar 
            previewScale={previewScale} setPreviewScale={setPreviewScale}
            exportDpi={exportDpi} onDpiChange={setExportDpi}
            cropMode={cropMode} setCropMode={setCropMode}
            onResetView={handleResetView} onZoomOutCanvas={handleZoomOutCanvas} onAutoCrop={handleAutoCrop}
            onExportPNG={handleExportPNG} onCopy={handleCopy} isCopied={isCopied} onExportSVG={handleExportSVG}
            canUndo={canUndo} canRedo={canRedo} onUndo={undo} onRedo={redo}
            onExportState={exportState} onImportState={importState}
            onResetDefaultSettings={handleResetDefaults}
        />
      </header>

      <div className="flex flex-1 overflow-hidden">
        <aside className="w-80 bg-white border-r border-gray-200 flex flex-col h-full z-20">
            <div className="flex border-b border-gray-200 bg-white">
                <button onClick={() => setActiveTab('data')} className={`flex-1 py-3 text-sm font-medium flex justify-center items-center gap-2 ${activeTab === 'data' ? 'text-teal-600 border-b-2 border-teal-600 bg-teal-50/50' : 'text-gray-500'}`}><List size={16} /> Data</button>
                <button onClick={() => setActiveTab('window')} className={`flex-1 py-3 text-sm font-medium flex justify-center items-center gap-2 ${activeTab === 'window' ? 'text-teal-600 border-b-2 border-teal-600 bg-teal-50/50' : 'text-gray-500'}`}><Sliders size={16} /> Window</button>
                <button onClick={() => setActiveTab('style')} className={`flex-1 py-3 text-sm font-medium flex justify-center items-center gap-2 ${activeTab === 'style' ? 'text-teal-600 border-b-2 border-teal-600 bg-teal-50/50' : 'text-gray-500'}`}><Palette size={16} /> Style</button>
            </div>

            <div className="flex-1 overflow-y-auto custom-scrollbar">
                {activeTab === 'data' && (
                    <div className="p-4 space-y-4">
                        <div id="raw-data-card" className="rounded transition-all">
                            <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Data Points (X Y)</label>
                            <textarea 
                                value={rawData}
                                onChange={(e) => setRawData(e.target.value)}
                                className="w-full h-40 border border-gray-300 rounded p-2 text-xs font-mono"
                                placeholder={`1  2\n2  3.5`}
                            />
                            <div className="text-[10px] text-gray-400 mt-1">Paste tabular data (Excel/CSV)</div>
                        </div>

                        {regressionStats && (
                            <div className="bg-teal-50 border border-teal-100 rounded-md p-3">
                                <h3 className="text-xs font-bold text-teal-800 uppercase mb-2 flex items-center gap-2">
                                    <TrendingUp size={12} /> Analysis
                                </h3>
                                <div className="text-xs space-y-1 text-teal-900 font-mono">
                                    <div>y = {regressionStats.slope.toFixed(4)}x + {regressionStats.intercept.toFixed(4)}</div>
                                    <div>R² = {regressionStats.r2.toFixed(4)}</div>
                                </div>
                            </div>
                        )}

                        <div id="regression-options-card" className="pt-2 space-y-2 rounded transition-all">
                             <button 
                                onClick={() => { recordNow(); handleViewSwitch(viewMode === 'scatter' ? 'residual' : 'scatter'); }}
                                className="w-full py-2 bg-white border border-gray-300 rounded shadow-sm text-sm flex items-center justify-center gap-2 hover:bg-gray-50"
                             >
                                <RefreshCw size={14} />
                                {viewMode === 'scatter' ? 'Switch to Residual Plot' : 'Switch to Scatter Plot'}
                             </button>

                             {viewMode === 'scatter' && (
                                <label className="flex items-center gap-2 text-sm text-gray-700 p-2 border rounded bg-white">
                                    <input type="checkbox" checked={showRegression} onChange={(e) => { recordNow(); setShowRegression(e.target.checked); }} />
                                    Show Line of Best Fit
                                </label>
                             )}
                        </div>
                    </div>
                )}
                {activeTab === 'window' && <WindowSettings dimCm={dimCm} setDimCm={setDimCm} isFixedSize={isFixedSize} setIsFixedSize={setIsFixedSize} windowSettings={windowSettings} onSettingChange={(f, v) => setWindowSettings(p => ({...p, [f]: v}))} />}
                {activeTab === 'style' && (
                    <div className="flex flex-col h-full">
                        <AppearanceSettings config={config} setConfig={setConfig} togglePiX={()=>{}} togglePiY={()=>{}} />
                        <div className="p-4 border-t border-gray-200 bg-white">
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
                                    <span className="block text-xs text-gray-500 mt-0.5">Hide points to create a worksheet</span>
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
                  onContextMenu={handleSvgContextMenu}
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
                <g className="data-layer" clipPath="url(#master-grid-clip)">
                    {!studentMode && renderFunctionPlots(engine, regressionLine)}
                    {!studentMode && renderPoints(engine, points)}
                </g>

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
          {contextMenu && (
              <GraphContextMenu
                  x={contextMenu.x}
                  y={contextMenu.y}
                  items={contextMenu.items}
                  onClose={() => setContextMenu(null)}
              />
          )}
        </main>
      </div>
    </div>
  );
};

export default ScatterPlots;