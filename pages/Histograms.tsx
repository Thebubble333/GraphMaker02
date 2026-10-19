import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { BaseGraphEngine } from '../utils/graphBase';
import { renderHistograms } from '../utils/graphRenderers';
import { STATISTICS_CONFIG } from '../config/graphDefaults';
import { HistogramBarDef, GraphConfig } from '../types';
import { List, Sliders, Palette, Trash2, Plus, BarChart2, Crosshair, ArrowUp, ArrowDown, Maximize2, RotateCcw, Eye, EyeOff } from 'lucide-react';
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

interface TableRow { id: string; min: number; max: number; freq: number; }

const INITIAL_CONFIG: GraphConfig = {
  ...STATISTICS_CONFIG,
  xRange: [48, 70],
  yRange: [0, 12],
  majorStep: [2, 1],
  subdivisions: [1, 1],
  axisLabels: ["skull width (mm)", "frequency"],
  showHorizontalGrid: true,
  showVerticalGrid: true,
  showMinorGrid: true,
  showXAxis: false,
  showYAxis: false,
  fontSize: 11
};

const INITIAL_WINDOW = {
  xMin: "48", xMax: "70", yMin: "0", yMax: "12",
  xStep: "2", yStep: "1", xSubdivisions: 1, ySubdivisions: 1
};

const INITIAL_RAW = "49, 52, 53, 54, 55, 55, 55, 56, 56, 56, 57, 57, 57, 57, 57, 58, 58, 58, 59, 59, 59, 60, 68";

const INITIAL_TABLE: TableRow[] = [
  { id: '1', min: 10, max: 20, freq: 5 },
  { id: '2', min: 20, max: 30, freq: 8 },
  { id: '3', min: 30, max: 50, freq: 3 }
];

const INITIAL_BAR_STYLE = {
  fillColor: '#d1d5db',
  strokeColor: '#000000',
  strokeWidth: 1.5,
  opacity: 1.0
};

interface ContextMenuState {
    x: number;
    y: number;
    targetType: 'hist-bar' | 'axis' | 'axis-label' | 'grid' | 'canvas';
    targetId?: string;
}

const Histograms: React.FC = () => {
  const [config, setConfig] = useState<GraphConfig>(INITIAL_CONFIG);
  const [dimCm, setDimCm] = useState({ width: 14, height: 10 });
  const [isFixedSize, setIsFixedSize] = useState(true);
  const [windowSettings, setWindowSettings] = useState(INITIAL_WINDOW);

  type InputMode = 'raw' | 'table';
  const [inputMode, setInputMode] = useState<InputMode>('raw');
  const [rawData, setRawData] = useState(INITIAL_RAW);
  const [binWidth, setBinWidth] = useState(2);
  const [binStart, setBinStart] = useState(48);
  const [tableData, setTableData] = useState<TableRow[]>(INITIAL_TABLE);
  const [barStyle, setBarStyle] = useState(INITIAL_BAR_STYLE);
  const [studentMode, setStudentMode] = useState(false);

  const [activeTab, setActiveTab] = useState<'data' | 'window' | 'style'>('data');
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null);
  const [highlightedId, setHighlightedId] = useState<string | null>(null);

  const triggerHighlight = (id: string) => {
      setHighlightedId(id);
      setTimeout(() => setHighlightedId(null), 2200);
  };

  const currentState = useMemo(() => ({
      config, dimCm, isFixedSize, windowSettings, inputMode, rawData, binWidth, binStart, tableData, barStyle, studentMode
  }), [config, dimCm, isFixedSize, windowSettings, inputMode, rawData, binWidth, binStart, tableData, barStyle, studentMode]);

  const restoreState = useCallback((state: any) => {
      if (!state) return;
      if (state.config) setConfig(state.config);
      if (state.dimCm) setDimCm(state.dimCm);
      if (state.isFixedSize !== undefined) setIsFixedSize(state.isFixedSize);
      if (state.windowSettings) setWindowSettings(state.windowSettings);
      if (state.inputMode) setInputMode(state.inputMode);
      if (state.rawData !== undefined) setRawData(state.rawData);
      if (state.binWidth !== undefined) setBinWidth(state.binWidth);
      if (state.binStart !== undefined) setBinStart(state.binStart);
      if (state.tableData) setTableData(state.tableData);
      if (state.barStyle) setBarStyle(state.barStyle);
      if (state.studentMode !== undefined) setStudentMode(state.studentMode);
  }, []);

  const { undo, redo, canUndo, canRedo, exportState, importState, resetToDefaultSettings } = useHistory(
      'histograms',
      currentState,
      restoreState
  );

  const handleResetDefaultSettings = useCallback(() => {
      setConfig(INITIAL_CONFIG);
      setDimCm({ width: 14, height: 10 });
      setIsFixedSize(true);
      setWindowSettings(INITIAL_WINDOW);
      setInputMode('raw');
      setRawData(INITIAL_RAW);
      setBinWidth(2);
      setBinStart(48);
      setTableData(INITIAL_TABLE);
      setBarStyle(INITIAL_BAR_STYLE);
      setStudentMode(false);
      resetToDefaultSettings();
  }, [resetToDefaultSettings]);

  const parseMath = (input: string | number): number => {
      try {
          const val = math.evaluate(String(input));
          return typeof val === 'number' && isFinite(val) ? val : 0;
      } catch { return 0; }
  };

  // Sync Window Config
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
    let yStep = Math.abs(parseMath(windowSettings.yStep));
    if (yStep < 1e-9) yStep = 1;
    
    // Ensure subdivisions sync
    const xSub = Math.max(1, Math.round(Number(windowSettings.xSubdivisions) || 1));
    const ySub = Math.max(1, Math.round(Number(windowSettings.ySubdivisions) || 1));

    setConfig(prev => ({ 
        ...prev, 
        xRange: [xMin, xMax], 
        yRange: [0, yMax], 
        majorStep: [xStep, yStep],
        subdivisions: [xSub, ySub]
    }));
  }, [windowSettings]);

  // Create a derived config for the engine that suppresses default X-axis grid/ticks
  // so we can render them manually starting from xMin
  const engineConfig = useMemo(() => ({
      ...config,
      showVerticalGrid: false,
      showXTicks: false,
      showXNumbers: false,
  }), [config]);

  const engine = useMemo(() => new BaseGraphEngine(engineConfig), [engineConfig]);

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
      });
  };

  // Axis Resize Drag
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

  // Custom Renderer for X-Axis to ensure ticks align with Start + N * Step
  const renderCustomXAxis = () => {
      const els: React.ReactNode[] = [];
      const xMin = parseMath(windowSettings.xMin);
      const xMax = parseMath(windowSettings.xMax);
      const xStep = parseMath(windowSettings.xStep);
      const { yStart, yEnd } = engine.getGridBoundaries();
      
      if (xStep <= 0 || xMax <= xMin) return null;

      const axisY = engine.mathToScreen(0, 0)[1]; 
      
      let curr = xMin;
      // Loop with slight buffer for floating point issues
      while (curr <= xMax + 1e-9) {
          const [px] = engine.mathToScreen(curr, 0);
          
          // 1. Grid Line
          if (config.showVerticalGrid) {
               els.push(
                   <line key={`v-cust-${curr}`} data-target-type="grid" data-target-id="grid-v-major" x1={px} y1={yStart} x2={px} y2={yEnd} stroke="black" strokeWidth={config.gridThicknessMajor} />
               );
          }

          // 2. Tick
          if (config.showXTicks) {
              const tickThick = config.tickThickness || config.axisThickness;
              let y1 = axisY;
              let y2 = axisY + 7;
              if (config.xTickStyle === 'crossing') {
                  y1 = axisY - 7;
                  y2 = axisY + 7;
              } else if (config.xTickStyle === 'top') {
                  y1 = axisY - 7;
                  y2 = axisY;
              }
              els.push(
                  <line key={`t-cust-${curr}`} data-target-type="axis" data-target-id="x-axis" x1={px} y1={y1} x2={px} y2={y2} stroke="black" strokeWidth={tickThick} />
              );
          }

          // 3. Number
          if (config.showXNumbers) {
              if (Math.abs(curr) < 1e-9 && !config.showZeroLabel) {
                   // Skip rendering 0 if showZeroLabel is false
              } else {
                  const label = engine.formatNumber(curr, config.tickRounding[0]);
                  els.push(
                       <g key={`l-cust-${curr}`} data-target-type="axis" data-target-id="x-axis">
                          {engine.texEngine.renderToSVG(label, px, axisY + 22 + (config.offsetXAxisNumY || 0), engine.cfg.fontSize, 'black', 'middle', true, 'text')}
                       </g>
                  );
              }
          }
          
          curr += xStep;
      }
      return els;
  };


  // Calculate Bars
  const bars: HistogramBarDef[] = useMemo(() => {
      if (inputMode === 'raw') {
          // Parse CSV/Space separated
          const nums = rawData.split(/[\s,]+/).map(s => parseFloat(s)).filter(n => isFinite(n));
          if (nums.length === 0) return [];
          
          // Determine bins
          const width = binWidth > 0 ? binWidth : 1;
          const buckets: Record<number, number> = {};
          
          nums.forEach(n => {
              if (n < binStart) return; 
              const binIndex = Math.floor((n - binStart) / width);
              buckets[binIndex] = (buckets[binIndex] || 0) + 1;
          });

          return Object.entries(buckets).map(([idxStr, freq]) => {
              const idx = parseInt(idxStr);
              return {
                  xMin: binStart + idx * width,
                  xMax: binStart + (idx + 1) * width,
                  frequency: freq
              };
          });
      } else {
          // Table Mode
          return tableData.map(row => ({
              xMin: row.min,
              xMax: row.max,
              frequency: row.freq
          }));
      }
  }, [inputMode, rawData, binWidth, binStart, tableData]);

  // Auto Scale Logic
  const handleAutoScale = () => {
      if (bars.length === 0) return;
      
      let minX = Infinity;
      let maxX = -Infinity;
      let maxFreq = 0;
      let detectedWidth = 0;

      bars.forEach(b => {
          if (b.xMin < minX) minX = b.xMin;
          if (b.xMax > maxX) maxX = b.xMax;
          if (b.frequency > maxFreq) maxFreq = b.frequency;
          if (detectedWidth === 0) detectedWidth = Math.abs(b.xMax - b.xMin);
      });

      // Add slight padding to Y (top only)
      const yMax = Math.ceil(maxFreq * 1.1);
      
      // Determine logical steps
      // For histograms, the step should typically match the bin width exactly so the grid lines bracket the bars.
      let xStep = 1;
      if (inputMode === 'raw') {
         xStep = binWidth > 0 ? binWidth : 1;
      } else {
         xStep = detectedWidth > 0 ? detectedWidth : 1;
      }
      
      // Expand max to fit full steps from min
      const fullSteps = Math.ceil((maxX - minX) / xStep);
      const alignedMax = minX + fullSteps * xStep;

      setWindowSettings({
          xMin: minX.toString(),
          xMax: alignedMax.toString(),
          yMin: "0",
          yMax: yMax.toString(),
          xStep: xStep.toString(),
          yStep: Math.max(1, Math.ceil(yMax / 10)).toString(),
          xSubdivisions: 1,
          ySubdivisions: 1
      });
      
      // Force minor grid off on autoscale
      setConfig(prev => ({ ...prev, showMinorGrid: false }));
  };

  const handleTableUpdate = (id: string, field: keyof TableRow, val: number) => {
      setTableData(prev => prev.map(r => r.id === id ? { ...r, [field]: val } : r));
  };
  const addTableRow = () => {
      const last = tableData[tableData.length - 1];
      const newMin = last ? last.max : 0;
      const newMax = last ? last.max + 10 : 10;
      const newId = Date.now().toString();
      setTableData([...tableData, { id: newId, min: newMin, max: newMax, freq: 1 }]);
      return newId;
  };

  const handleContextMenu = (e: React.MouseEvent<SVGSVGElement>) => {
      e.preventDefault();
      if (cropMode) return;

      let el = e.target as Element | null;
      while (el && el !== e.currentTarget) {
          const targetType = el.getAttribute('data-target-type') as ContextMenuState['targetType'] | null;
          const targetId = el.getAttribute('data-target-id') || undefined;
          if (targetType) {
              setContextMenu({
                  x: e.clientX,
                  y: e.clientY,
                  targetType,
                  targetId
              });
              return;
          }
          el = el.parentElement;
      }

      setContextMenu({
          x: e.clientX,
          y: e.clientY,
          targetType: 'canvas'
      });
  };

  const getContextMenuData = (): { header: string; items: ContextMenuItem[] } => {
      if (!contextMenu) return { header: '', items: [] };

      if (contextMenu.targetType === 'hist-bar' && contextMenu.targetId !== undefined) {
          const idx = parseInt(contextMenu.targetId, 10);
          const bar = bars[idx];
          if (bar) {
              const items: ContextMenuItem[] = [
                  {
                      label: inputMode === 'table' ? 'Locate Bin in Sidebar' : 'Locate Raw Data in Sidebar',
                      icon: <Crosshair size={14} />,
                      accent: true,
                      onClick: () => {
                          setActiveTab('data');
                          const rowId = inputMode === 'table' && tableData[idx] ? tableData[idx].id : 'raw';
                          triggerHighlight(rowId);
                          setTimeout(() => {
                              const el = document.getElementById(rowId === 'raw' ? 'sidebar-hist-raw' : `sidebar-hist-row-${rowId}`);
                              if (el) {
                                  el.scrollIntoView({ behavior: 'smooth', block: 'center' });
                                  const inputs = el.querySelectorAll('input, textarea');
                                  const focusTarget = inputs[inputs.length - 1] as HTMLElement | undefined;
                                  if (focusTarget) focusTarget.focus();
                              }
                          }, 60);
                      }
                  },
                  {
                      label: 'Edit Bar Color & Style',
                      icon: <Palette size={14} />,
                      onClick: () => {
                          setActiveTab('style');
                          triggerHighlight('bar-style');
                      }
                  }
              ];

              if (inputMode === 'table' && tableData[idx]) {
                  const row = tableData[idx];
                  items.push(
                      {
                          label: 'Increase Frequency (+1)',
                          icon: <ArrowUp size={14} />,
                          dividerBefore: true,
                          onClick: () => handleTableUpdate(row.id, 'freq', row.freq + 1)
                      },
                      {
                          label: 'Decrease Frequency (-1)',
                          icon: <ArrowDown size={14} />,
                          onClick: () => handleTableUpdate(row.id, 'freq', Math.max(0, row.freq - 1))
                      },
                      {
                          label: 'Delete Bin',
                          icon: <Trash2 size={14} />,
                          danger: true,
                          dividerBefore: true,
                          onClick: () => setTableData(d => d.filter(r => r.id !== row.id))
                      }
                  );
              }

              return {
                  header: `Bin [${bar.xMin}, ${bar.xMax}) — Freq: ${bar.frequency}`,
                  items
              };
          }
      }

      if (contextMenu.targetType === 'axis-label') {
          const isX = contextMenu.targetId === 'x-axis-label';
          return {
              header: isX ? 'X-Axis Label' : 'Y-Axis Label',
              items: [
                  {
                      label: 'Edit Label Text in Style Tab',
                      icon: <Palette size={14} />,
                      accent: true,
                      onClick: () => setActiveTab('style')
                  },
                  {
                      label: 'Reset Label Position',
                      icon: <RotateCcw size={14} />,
                      onClick: () => {
                          if (isX) setConfig(prev => ({ ...prev, offsetXAxisLabelX: 0, offsetXAxisLabelY: 0 }));
                          else setConfig(prev => ({ ...prev, offsetYAxisLabelX: 0, offsetYAxisLabelY: 0 }));
                      }
                  }
              ]
          };
      }

      return {
          header: contextMenu.targetType === 'axis' ? 'Axes' : contextMenu.targetType === 'grid' ? 'Grid & Border' : 'Histogram Canvas',
          items: [
              {
                  label: 'Auto Scale Axis to Data',
                  icon: <Maximize2 size={14} />,
                  accent: true,
                  onClick: handleAutoScale
              },
              ...(inputMode === 'table' ? [{
                  label: 'Add Frequency Bin',
                  icon: <Plus size={14} />,
                  onClick: () => {
                      const newId = addTableRow();
                      setActiveTab('data');
                      triggerHighlight(newId);
                  }
              }] : []),
              {
                  label: studentMode ? 'Disable Student Mode' : 'Enable Student Mode (Worksheet)',
                  icon: studentMode ? <Eye size={14} /> : <EyeOff size={14} />,
                  dividerBefore: true,
                  onClick: () => setStudentMode(!studentMode)
              },
              {
                  label: 'Edit Window Settings',
                  icon: <Sliders size={14} />,
                  dividerBefore: true,
                  onClick: () => setActiveTab('window')
              },
              {
                  label: 'Edit Style & Bar Settings',
                  icon: <Palette size={14} />,
                  onClick: () => setActiveTab('style')
              }
          ]
      };
  };

  const gridArea = engine.getGridBoundaries();
  const menuData = getContextMenuData();

  return (
    <div className="flex h-full flex-col bg-gray-50" onMouseMove={handleGlobalMouseMove} onMouseUp={handleGlobalMouseUp}>
      <header className="flex items-center justify-between px-6 py-3 bg-white border-b border-gray-200 shadow-sm z-10">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-red-50 text-red-600 rounded-lg"><BarChart2 className="w-5 h-5" /></div>
          <h1 className="text-xl font-semibold text-gray-800">Histograms</h1>
        </div>
        <GraphToolbar 
            previewScale={previewScale} setPreviewScale={setPreviewScale}
            exportDpi={exportDpi} onDpiChange={setExportDpi}
            cropMode={cropMode} setCropMode={setCropMode}
            onResetView={handleResetView} onZoomOutCanvas={handleZoomOutCanvas} onAutoCrop={handleAutoCrop}
            onExportPNG={handleExportPNG} onCopy={handleCopy} isCopied={isCopied} onExportSVG={handleExportSVG}
            onUndo={undo} onRedo={redo} canUndo={canUndo} canRedo={canRedo}
            onExportState={exportState} onImportState={importState}
            onResetDefaultSettings={handleResetDefaultSettings}
        />
      </header>

      <div className="flex flex-1 overflow-hidden">
        <aside className="w-80 bg-white border-r border-gray-200 flex flex-col h-full z-20">
            <div className="flex border-b border-gray-200 bg-white">
                <button onClick={() => setActiveTab('data')} className={`flex-1 py-3 text-sm font-medium flex justify-center items-center gap-2 ${activeTab === 'data' ? 'text-red-600 border-b-2 border-red-600 bg-red-50/50' : 'text-gray-500'}`}><List size={16} /> Data</button>
                <button onClick={() => setActiveTab('window')} className={`flex-1 py-3 text-sm font-medium flex justify-center items-center gap-2 ${activeTab === 'window' ? 'text-red-600 border-b-2 border-red-600 bg-red-50/50' : 'text-gray-500'}`}><Sliders size={16} /> Window</button>
                <button onClick={() => setActiveTab('style')} className={`flex-1 py-3 text-sm font-medium flex justify-center items-center gap-2 ${activeTab === 'style' ? 'text-red-600 border-b-2 border-red-600 bg-red-50/50' : 'text-gray-500'}`}><Palette size={16} /> Style</button>
            </div>

            <div className="flex-1 overflow-y-auto custom-scrollbar">
                {activeTab === 'data' && (
                    <div className="p-4 space-y-4">
                        <div className="flex bg-gray-100 p-1 rounded-md">
                            <button 
                                onClick={() => setInputMode('raw')}
                                className={`flex-1 py-1 text-xs font-medium rounded ${inputMode === 'raw' ? 'bg-white shadow text-gray-800' : 'text-gray-500'}`}
                            >
                                Raw Data
                            </button>
                            <button 
                                onClick={() => setInputMode('table')}
                                className={`flex-1 py-1 text-xs font-medium rounded ${inputMode === 'table' ? 'bg-white shadow text-gray-800' : 'text-gray-500'}`}
                            >
                                Frequency Table
                            </button>
                        </div>

                        {inputMode === 'raw' ? (
                            <div
                                id="sidebar-hist-raw"
                                className={`space-y-3 p-2 rounded-md transition-all duration-300 ${
                                    highlightedId === 'raw' ? 'ring-2 ring-red-400 bg-red-50/30' : ''
                                }`}
                            >
                                <div>
                                    <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Raw Numbers</label>
                                    <textarea 
                                        value={rawData}
                                        onChange={(e) => setRawData(e.target.value)}
                                        className="w-full h-32 border border-gray-300 rounded p-2 text-xs font-mono"
                                        placeholder="12, 15, 13..."
                                    />
                                    <div className="text-[10px] text-gray-400 mt-1">Comma or space separated</div>
                                </div>
                                <div className="grid grid-cols-2 gap-2">
                                    <div>
                                        <label className="block text-xs text-gray-500 mb-1">Bin Width</label>
                                        <input 
                                            type="number" value={binWidth} onChange={(e) => setBinWidth(parseFloat(e.target.value) || 1)}
                                            className="w-full border rounded px-2 py-1 text-sm"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs text-gray-500 mb-1">Start Value</label>
                                        <input 
                                            type="number" value={binStart} onChange={(e) => setBinStart(parseFloat(e.target.value) || 0)}
                                            className="w-full border rounded px-2 py-1 text-sm"
                                        />
                                    </div>
                                </div>
                            </div>
                        ) : (
                            <div className="space-y-2">
                                <div className="flex justify-between items-center">
                                    <label className="block text-xs font-bold text-gray-500 uppercase">Bins</label>
                                    <button onClick={() => addTableRow()} className="text-blue-600 hover:bg-blue-50 p-1 rounded"><Plus size={14}/></button>
                                </div>
                                <div className="space-y-1">
                                    {tableData.map(row => (
                                        <div
                                            key={row.id}
                                            id={`sidebar-hist-row-${row.id}`}
                                            className={`flex items-center gap-1 p-1 rounded transition-all duration-300 ${
                                                highlightedId === row.id ? 'ring-2 ring-red-400 bg-red-50/40' : ''
                                            }`}
                                        >
                                            <input 
                                                type="number" value={row.min} 
                                                onChange={(e) => handleTableUpdate(row.id, 'min', parseFloat(e.target.value))}
                                                className="w-16 border rounded px-1 text-sm" placeholder="Min"
                                            />
                                            <span className="text-gray-400 text-xs">-</span>
                                            <input 
                                                type="number" value={row.max} 
                                                onChange={(e) => handleTableUpdate(row.id, 'max', parseFloat(e.target.value))}
                                                className="w-16 border rounded px-1 text-sm" placeholder="Max"
                                            />
                                            <span className="text-gray-400 text-xs">:</span>
                                            <input 
                                                type="number" value={row.freq} 
                                                onChange={(e) => handleTableUpdate(row.id, 'freq', parseFloat(e.target.value))}
                                                className="flex-1 border rounded px-1 text-sm" placeholder="Freq"
                                            />
                                            <button onClick={() => setTableData(d => d.filter(r => r.id !== row.id))} className="text-gray-400 hover:text-red-500">
                                                <Trash2 size={14} />
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        <div className="pt-4 border-t border-gray-100">
                            <button 
                                onClick={handleAutoScale}
                                className="w-full py-2 bg-red-50 text-red-600 border border-red-100 rounded-md text-sm font-semibold hover:bg-red-100 transition-colors"
                            >
                                Auto Scale Axis to Data
                            </button>
                        </div>
                    </div>
                )}

                {activeTab === 'window' && <WindowSettings dimCm={dimCm} setDimCm={setDimCm} isFixedSize={isFixedSize} setIsFixedSize={setIsFixedSize} windowSettings={windowSettings} onSettingChange={(f, v) => setWindowSettings(p => ({...p, [f]: v}))} />}
                
                {activeTab === 'style' && (
                    <div className="flex flex-col">
                        <AppearanceSettings config={config} setConfig={setConfig} togglePiX={()=>{}} togglePiY={()=>{}} />
                        <div
                            id="sidebar-bar-style"
                            className={`p-4 border-t border-gray-200 transition-all duration-300 ${
                                highlightedId === 'bar-style' ? 'ring-2 ring-red-400 bg-red-50/30' : ''
                            }`}
                        >
                             <h2 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Bar Style</h2>
                             <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs text-gray-500 mb-1">Fill Color</label>
                                    <input type="color" value={barStyle.fillColor} onChange={(e) => setBarStyle({...barStyle, fillColor: e.target.value})} className="w-full h-8 p-0 border rounded cursor-pointer" />
                                </div>
                                <div>
                                    <label className="block text-xs text-gray-500 mb-1">Border Color</label>
                                    <input type="color" value={barStyle.strokeColor} onChange={(e) => setBarStyle({...barStyle, strokeColor: e.target.value})} className="w-full h-8 p-0 border rounded cursor-pointer" />
                                </div>
                                <div>
                                    <label className="block text-xs text-gray-500 mb-1">Opacity</label>
                                    <input type="number" step="0.1" min="0" max="1" value={barStyle.opacity} onChange={(e) => setBarStyle({...barStyle, opacity: parseFloat(e.target.value)})} className="w-full border rounded px-2 py-1 text-sm" />
                                </div>
                                <div>
                                    <label className="block text-xs text-gray-500 mb-1">Border Width</label>
                                    <input type="number" step="0.5" value={barStyle.strokeWidth} onChange={(e) => setBarStyle({...barStyle, strokeWidth: parseFloat(e.target.value)})} className="w-full border rounded px-2 py-1 text-sm" />
                                </div>
                             </div>
                        </div>
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
                                    <span className="block text-xs text-gray-500 mt-0.5">Hide bars to create a worksheet</span>
                                </div>
                            </label>
                        </div>
                    </div>
                )}
            </div>
        </aside>

        <main className="flex-1 bg-gray-100 overflow-hidden flex flex-col relative">
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
                  onContextMenu={handleContextMenu}
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
                <g className="custom-x-axis-layer">{renderCustomXAxis()}</g>
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
                    {renderHistograms(engine, bars, { ...barStyle, studentMode })}
                </g>

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
          <div className="absolute bottom-3 right-4 bg-white/90 backdrop-blur-sm border border-gray-200 rounded-lg px-2.5 py-1 text-[10px] text-gray-500 shadow-sm pointer-events-none">
              Right-click any bar or axis for quick actions
          </div>
          {contextMenu && (
              <GraphContextMenu
                  x={contextMenu.x}
                  y={contextMenu.y}
                  header={menuData.header}
                  items={menuData.items}
                  onClose={() => setContextMenu(null)}
              />
          )}
        </main>
      </div>
    </div>
  );
};

export default Histograms;