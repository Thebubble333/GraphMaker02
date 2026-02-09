
import React, { useState, useMemo, useEffect } from 'react';
import { BaseGraphEngine } from '../utils/graphBase';
import { renderPoints, renderFunctionPlots, renderVerticalLines } from '../utils/graphRenderers';
import { GraphConfig, PointDef, FunctionDef, VerticalLineDef } from '../types';
import { CARTESIAN_CONFIG } from '../config/graphDefaults';
import { calculateLinearRegression, RegressionResult } from '../utils/mathAnalysis';
import { Settings, List, Sliders, Palette, ScatterChart, TrendingUp, RefreshCw } from 'lucide-react';
import * as math from 'mathjs';
import { CM_TO_PX } from '../constants';

import { GraphToolbar } from '../components/GraphToolbar';
import { useGraphInteraction } from '../hooks/useGraphInteraction';
import { useDragSystem } from '../hooks/useDragSystem';
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

const ScatterPlots: React.FC = () => {
  const [config, setConfig] = useState<GraphConfig>({
      ...CARTESIAN_CONFIG,
      xRange: [0, 10], 
      yRange: [0, 12],
      majorStep: [1, 1],
      subdivisions: [2, 2],
      axisLabels: ["distance (km)", "price (USD)"], // Updated to plain text
      // Scatter Specific Overrides
      showXAxis: false,
      showYAxis: false,
      xAxisAt: 'bottom',
      yAxisAt: 'left',
      showMinorGrid: false,
      xLabelStyle: 'below-center',
      yLabelStyle: 'left-center',
      yLabelRotation: 'horizontal'
  });

  const [dimCm, setDimCm] = useState({ width: 14, height: 10 });
  const [isFixedSize, setIsFixedSize] = useState(true);
  
  const [windowSettings, setWindowSettings] = useState({
    xMin: "0", xMax: "10", yMin: "0", yMax: "12",
    xStep: "1", yStep: "1", xSubdivisions: 2, ySubdivisions: 2
  });

  // Data State
  const [rawData, setRawData] = useState(INITIAL_DATA);
  const [points, setPoints] = useState<PointDef[]>([]);
  const [showRegression, setShowRegression] = useState(true);
  const [viewMode, setViewMode] = useState<'scatter' | 'residual'>('scatter');
  const [regressionStats, setRegressionStats] = useState<RegressionResult | null>(null);

  // State to persist view configurations
  const [viewStates, setViewStates] = useState<Record<string, ViewState>>({});

  const [activeTab, setActiveTab] = useState<'data' | 'window' | 'style'>('data');
  const [isCopied, setIsCopied] = useState(false);

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

    setConfig(prev => ({
      ...prev, xRange: [xMin, xMax], yRange: [yMin, yMax], majorStep: [xStep, yStep], subdivisions: [xSub, ySub]
    }));
  }, [windowSettings]);

  const engine = useMemo(() => new BaseGraphEngine(config), [config]);

  // Interaction
  const {
      previewScale, setPreviewScale,
      cropMode, setCropMode,
      selectionBox, customViewBox, setCustomViewBox, hasInitialCrop, setHasInitialCrop,
      containerRef,
      handleAutoCrop, handleResetView, handleExportPNG, handleExportSVG,
      handleCropMouseDown, handleCropMouseMove, handleCropMouseUp
  } = useGraphInteraction('graph-svg', engine.widthPixels, engine.heightPixels, dimCm.width);

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
              visible: true, lineType: 'solid', domain: [null, null], domainInclusive: [false, false]
          }];
      } else if (showRegression) {
          // Scatter plot: y = mx + c
          return [{
              id: 'reg-line', 
              expression: `${regressionStats.slope} * x + ${regressionStats.intercept}`,
              color: 'black', strokeWidth: 1.5, visible: true, lineType: 'solid',
              domain: [null, null], domainInclusive: [false, false]
          }];
      }
      return [];
  }, [regressionStats, showRegression, viewMode]);

  const gridArea = engine.getGridBoundaries();

  return (
    <div className="flex h-full flex-col bg-gray-50" onMouseMove={(e) => { if(handleCropMouseMove(e)) return; onMouseMove(e); }} onMouseUp={() => { handleCropMouseUp(); onMouseUp(); }}>
      <header className="flex items-center justify-between px-6 py-3 bg-white border-b border-gray-200 shadow-sm z-10">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-teal-50 text-teal-600 rounded-lg"><ScatterChart className="w-5 h-5" /></div>
          <h1 className="text-xl font-semibold text-gray-800">Scatter Plots</h1>
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
                <button onClick={() => setActiveTab('data')} className={`flex-1 py-3 text-sm font-medium flex justify-center items-center gap-2 ${activeTab === 'data' ? 'text-teal-600 border-b-2 border-teal-600 bg-teal-50/50' : 'text-gray-500'}`}><List size={16} /> Data</button>
                <button onClick={() => setActiveTab('window')} className={`flex-1 py-3 text-sm font-medium flex justify-center items-center gap-2 ${activeTab === 'window' ? 'text-teal-600 border-b-2 border-teal-600 bg-teal-50/50' : 'text-gray-500'}`}><Sliders size={16} /> Window</button>
                <button onClick={() => setActiveTab('style')} className={`flex-1 py-3 text-sm font-medium flex justify-center items-center gap-2 ${activeTab === 'style' ? 'text-teal-600 border-b-2 border-teal-600 bg-teal-50/50' : 'text-gray-500'}`}><Palette size={16} /> Style</button>
            </div>

            <div className="flex-1 overflow-y-auto custom-scrollbar">
                {activeTab === 'data' && (
                    <div className="p-4 space-y-4">
                        <div>
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

                        <div className="pt-2 space-y-2">
                             <button 
                                onClick={() => handleViewSwitch(viewMode === 'scatter' ? 'residual' : 'scatter')}
                                className="w-full py-2 bg-white border border-gray-300 rounded shadow-sm text-sm flex items-center justify-center gap-2 hover:bg-gray-50"
                             >
                                <RefreshCw size={14} />
                                {viewMode === 'scatter' ? 'Switch to Residual Plot' : 'Switch to Scatter Plot'}
                             </button>

                             {viewMode === 'scatter' && (
                                <label className="flex items-center gap-2 text-sm text-gray-700 p-2 border rounded bg-white">
                                    <input type="checkbox" checked={showRegression} onChange={(e) => setShowRegression(e.target.checked)} />
                                    Show Line of Best Fit
                                </label>
                             )}
                        </div>
                    </div>
                )}
                {activeTab === 'window' && <WindowSettings dimCm={dimCm} setDimCm={setDimCm} isFixedSize={isFixedSize} setIsFixedSize={setIsFixedSize} windowSettings={windowSettings} onSettingChange={(f, v) => setWindowSettings(p => ({...p, [f]: v}))} />}
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
                <g className="data-layer" clipPath="url(#master-grid-clip)">
                    {renderFunctionPlots(engine, regressionLine)}
                    {renderPoints(engine, points)}
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
        </main>
      </div>
    </div>
  );
};

export default ScatterPlots;
