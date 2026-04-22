import React, { useState, useMemo, useEffect, useRef } from 'react';
import { BaseGraphEngine } from '../utils/graphBase';
import { STATISTICS_CONFIG } from '../config/graphDefaults';
import { GraphConfig } from '../types';
import { Settings, List, Sliders, Palette, Plus, Trash2, FileText, Table as TableIcon } from 'lucide-react';
import * as math from 'mathjs';
import { CM_TO_PX } from '../constants';

import { GraphToolbar } from '../components/GraphToolbar';
import { useGraphInteraction } from '../hooks/useGraphInteraction';
import { useDragSystem } from '../hooks/useDragSystem';
import { calculateAxisLabelDrag } from '../utils/dragStrategies';

import { WindowSettings } from '../components/settings/WindowSettings';
import { AppearanceSettings } from '../components/settings/AppearanceSettings';
import { RichInput } from '../components/ui/RichInput';

interface DataRow {
  id: string;
  value: number;
  frequency: number;
}

const INITIAL_DATA: DataRow[] = [
  { id: '1', value: 134, frequency: 3 },
  { id: '2', value: 135, frequency: 7 },
  { id: '3', value: 136, frequency: 10 },
  { id: '4', value: 137, frequency: 6 },
  { id: '5', value: 138, frequency: 4 },
  { id: '6', value: 139, frequency: 2 },
  { id: '7', value: 140, frequency: 2 },
  { id: '8', value: 141, frequency: 1 },
  { id: '9', value: 142, frequency: 1 },
  { id: '10', value: 143, frequency: 1 },
  { id: '11', value: 146, frequency: 1 },
];

export default function DotPlots() {
  const [config, setConfig] = useState<GraphConfig>({
      ...STATISTICS_CONFIG,
      xRange: [133, 147], 
      yRange: [0, 12],
      majorStep: [1, 1],
      subdivisions: [1, 1],
      showYAxis: false,
      showYNumbers: false,
      showYTicks: false,
      showHorizontalGrid: false,
      showVerticalGrid: false,
      showMinorGrid: true,
      showXTicks: true,
      showBorder: false,
      axisLabels: ["time (seconds)", ""],
      fontSize: 18,
      verticalGridMode: 'upward',
      offsetXAxisLabelY: 0 
  });
  
  const [data, setData] = useState<DataRow[]>(INITIAL_DATA);
  const [activeTab, setActiveTab] = useState<'data' | 'raw' | 'window' | 'style'>('data');
  const [dimCm, setDimCm] = useState({ width: 20, height: 10 });
  const [isFixedSize, setIsFixedSize] = useState(true);
  
  const [windowSettings, setWindowSettings] = useState({
    xMin: "133", xMax: "147", yMin: "0", yMax: "12",
    xStep: "1", yStep: "1", xSubdivisions: 1, ySubdivisions: 1
  });

  const [dotRadius, setDotRadius] = useState(6);
  const [dotColor, setDotColor] = useState('#222222');
  const [dotSpacing, setDotSpacing] = useState(16);
  const [yOffset, setYOffset] = useState(15);

  const [showQuartiles, setShowQuartiles] = useState(false);
  const [showDotNumbers, setShowDotNumbers] = useState(false);
  const [showColumnTotals, setShowColumnTotals] = useState<'none' | 'individual' | 'cumulative'>('none');
  const [studentMode, setStudentMode] = useState(false);

  const [quartileColorExact, setQuartileColorExact] = useState('#3b82f6');
  const [quartileColorSplit, setQuartileColorSplit] = useState('#ef4444');
  const [quartileOffsetX, setQuartileOffsetX] = useState(0);
  const [quartileOffsetY, setQuartileOffsetY] = useState(0);

  const [rawDataInput, setRawDataInput] = useState('');
  const [rawInputMode, setRawInputMode] = useState<'values' | 'pairs'>('values');

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
    
    setConfig(prev => ({ 
        ...prev, 
        xRange: [xMin, xMax], 
        yRange: [0, yMax], 
        majorStep: [xStep, 1], 
        subdivisions: [xSub, ySub]
    }));
  }, [windowSettings]);

  const engine = useMemo(() => new BaseGraphEngine(config), [config]);

  type StatPoint = { type: 'single', index: number, value: number } | { type: 'average', index1: number, index2: number, value: number };

  const quartiles = useMemo(() => {
    if (!showQuartiles || data.length === 0) return null;
    
    const rawValues: number[] = [];
    data.forEach(row => {
      for (let i = 0; i < row.frequency; i++) {
        rawValues.push(row.value);
      }
    });
    
    if (rawValues.length === 0) return null;
    
    rawValues.sort((a, b) => a - b);
    
    const getMedianInfo = (arr: number[], globalOffset: number): StatPoint => {
      const len = arr.length;
      const mid = Math.floor(len / 2);
      if (len % 2 !== 0) {
        return { type: 'single', index: globalOffset + mid + 1, value: arr[mid] };
      } else {
        return { type: 'average', index1: globalOffset + mid, index2: globalOffset + mid + 1, value: (arr[mid - 1] + arr[mid]) / 2 };
      }
    };
    
    const medianInfo = getMedianInfo(rawValues, 0);
    const lowerHalf = rawValues.slice(0, Math.floor(rawValues.length / 2));
    const upperHalf = rawValues.slice(Math.ceil(rawValues.length / 2));
    
    const q1Info = lowerHalf.length > 0 ? getMedianInfo(lowerHalf, 0) : medianInfo;
    const q3Info = upperHalf.length > 0 ? getMedianInfo(upperHalf, Math.ceil(rawValues.length / 2)) : medianInfo;
    
    return { q1: q1Info, median: medianInfo, q3: q3Info };
  }, [data, showQuartiles]);

  const dotLayout = useMemo(() => {
    const coords = new Map<number, {x: number, y: number, value: number}>();
    let currentIndex = 1;
    const sortedData = [...data].sort((a, b) => a.value - b.value);
    const { yEnd } = engine.getGridBoundaries();
    
    sortedData.forEach(row => {
      const [xPos] = engine.mathToScreen(row.value, 0);
      for (let i = 0; i < row.frequency; i++) {
        const yPos = yEnd - yOffset - (i * dotSpacing);
        coords.set(currentIndex, { x: xPos, y: yPos, value: row.value });
        currentIndex++;
      }
    });
    return { coords, sortedData };
  }, [data, engine, yOffset, dotSpacing]);

  const renderQuartiles = () => {
    if (studentMode) return null;
    if (!showQuartiles || !quartiles) return null;
    
    const { yEnd } = engine.getGridBoundaries();
    const labelY = yEnd + 35 + quartileOffsetY;
    
    const renderStatHighlight = (stat: StatPoint, colorExact: string, colorSplit: string, label: string) => {
      if (stat.type === 'single') {
        const coord = dotLayout.coords.get(stat.index);
        if (!coord) return null;
        const x = coord.x + quartileOffsetX;
        return (
          <g key={label}>
            <circle cx={x} cy={coord.y} r={dotRadius + 4} fill="none" stroke={colorExact} strokeWidth="2" />
            <text x={x} y={labelY} textAnchor="middle" fill={colorExact} fontSize="12" fontWeight="bold">{label}</text>
          </g>
        );
      } else {
        const coord1 = dotLayout.coords.get(stat.index1);
        const coord2 = dotLayout.coords.get(stat.index2);
        if (!coord1 || !coord2) return null;
        
        const midX = (coord1.x + coord2.x) / 2 + quartileOffsetX;
        const midY = (coord1.y + coord2.y) / 2;
        
        const isSameColumn = coord1.x === coord2.x;
        const lineX1 = isSameColumn ? midX - dotRadius * 1.5 : coord1.x + quartileOffsetX;
        const lineX2 = isSameColumn ? midX + dotRadius * 1.5 : coord2.x + quartileOffsetX;
        
        return (
          <g key={label}>
            <line x1={lineX1} y1={midY} x2={lineX2} y2={midY} stroke={colorSplit} strokeWidth="2" />
            <text x={midX} y={labelY} textAnchor="middle" fill={colorSplit} fontSize="12" fontWeight="bold">{label}</text>
          </g>
        );
      }
    };
    
    return (
      <g className="quartiles-layer" onMouseDown={handleQuartileDragStart} style={{ cursor: cropMode ? 'crosshair' : 'move' }}>
        {renderStatHighlight(quartiles.q1, quartileColorExact, quartileColorSplit, 'Q1')}
        {renderStatHighlight(quartiles.median, quartileColorExact, quartileColorSplit, 'Med')}
        {renderStatHighlight(quartiles.q3, quartileColorExact, quartileColorSplit, 'Q3')}
      </g>
    );
  };

  const {
      previewScale, setPreviewScale,
      exportDpi, setExportDpi,
      cropMode, setCropMode,
      selectionBox, customViewBox, hasInitialCrop,
      containerRef,
      handleAutoCrop, handleResetView, handleExportPNG, handleExportSVG, handleCopy, isCopied,
      handleCropMouseDown, handleCropMouseMove, handleCropMouseUp
  } = useGraphInteraction('graph-svg', engine.widthPixels, engine.heightPixels, dimCm.width, false, false, config.cropPadding);

  const { onMouseDown, onMouseMove, onMouseUp } = useDragSystem(previewScale);

  const handleQuartileDragStart = (e: React.MouseEvent) => {
      onMouseDown(e, { x: quartileOffsetX, y: quartileOffsetY }, (dx, dy, init) => {
          setQuartileOffsetX(init.x + dx);
          setQuartileOffsetY(init.y + dy);
      }, undefined, 'quartile-drag');
  };

  const handleAxisLabelDragStart = (axis: 'x' | 'y', e: React.MouseEvent) => {
      const initialOffsets = {
          xx: config.offsetXAxisLabelX, xy: config.offsetXAxisLabelY,
          yx: config.offsetYAxisLabelX, yy: config.offsetYAxisLabelY
      };
      onMouseDown(e, initialOffsets, (dx, dy, initial) => {
          setConfig(prev => calculateAxisLabelDrag(prev, axis, dx, dy, initial));
      }, undefined, 'axisLabel');
  };

  const handleAddRow = () => {
    const lastVal = data.length > 0 ? data[data.length - 1].value + 1 : 0;
    setData([...data, { id: Date.now().toString(), value: lastVal, frequency: 1 }]);
  };

  const handleUpdateRow = (id: string, updates: Partial<DataRow>) => {
    setData(data.map(row => row.id === id ? { ...row, ...updates } : row));
  };

  const handleRemoveRow = (id: string) => {
    setData(data.filter(row => row.id !== id));
  };

  const handleGenerateFromRaw = () => {
    if (!rawDataInput.trim()) return;
    
    if (rawInputMode === 'values') {
      const items = rawDataInput.split(/[\s,\t,\n]+/).map(s => s.trim()).filter(Boolean);
      const numbers = items.map(Number).filter(n => !isNaN(n));
      
      if (numbers.length === 0) {
        alert("No valid numbers found in raw data.");
        return;
      }

      const counts: Record<number, number> = {};
      numbers.forEach(num => {
        counts[num] = (counts[num] || 0) + 1;
      });
      
      const sortedUnique = Array.from(new Set(numbers)).sort((a, b) => a - b);
      const newData: DataRow[] = sortedUnique.map((num, index) => ({
        id: Date.now().toString() + index,
        value: num,
        frequency: counts[num]
      }));
      
      setData(newData);
    } else {
      let tokens = rawDataInput.split(/[\n,]+/).map(s => s.trim()).filter(Boolean);
      if (tokens.length <= 1) {
        tokens = rawDataInput.split(/\s+/).map(s => s.trim()).filter(Boolean);
      }

      const newData: DataRow[] = [];
      for (let i = 0; i < tokens.length; i += 2) {
        const valStr = tokens[i];
        const freqStr = tokens[i + 1];
        if (valStr && freqStr !== undefined) {
          const value = parseFloat(valStr);
          const frequency = parseInt(freqStr, 10);
          if (!isNaN(value) && !isNaN(frequency)) {
            newData.push({
              id: Date.now().toString() + i,
              value,
              frequency
            });
          }
        }
      }
      
      if (newData.length > 0) {
        setData(newData.sort((a, b) => a.value - b.value));
      } else {
        alert("Could not parse pairs. Ensure format is 'Value, Frequency, Value, Frequency...'");
        return;
      }
    }
    
    setActiveTab('data');
  };

  const renderDots = () => {
    if (studentMode) return [];
    const { yEnd } = engine.getGridBoundaries();
    
    let cumulative = 0;
    let dotIndex = 1;
    
    return dotLayout.sortedData.map((row) => {
      const [xPos] = engine.mathToScreen(row.value, 0);
      const dots = [];
      
      cumulative += row.frequency;
      
      for (let i = 0; i < row.frequency; i++) {
        const currentDotIndex = dotIndex++;
        const yPos = yEnd - yOffset - (i * dotSpacing);
        dots.push(
          <g key={`${row.id}-${i}`}>
            <circle 
              cx={xPos}
              cy={yPos}
              r={dotRadius}
              fill={dotColor}
            />
            {showDotNumbers && (
              <text 
                x={xPos} 
                y={yPos} 
                textAnchor="middle" 
                dy="0.35em"
                fill="white" 
                fontSize={Math.max(8, dotRadius)} 
                fontWeight="bold"
                style={{ pointerEvents: 'none' }}
              >
                {currentDotIndex}
              </text>
            )}
          </g>
        );
      }
      
      let totalLabel = null;
      if (row.frequency > 0 && showColumnTotals !== 'none') {
        const topYPos = yEnd - yOffset - ((row.frequency - 1) * dotSpacing) - dotRadius - 8;
        const labelValue = showColumnTotals === 'cumulative' ? cumulative : row.frequency;
        totalLabel = (
          <text
            key={`total-${row.id}`}
            x={xPos}
            y={topYPos}
            textAnchor="middle"
            fill="#4b5563"
            fontSize={12}
            fontWeight="bold"
          >
            {labelValue}
          </text>
        );
      }
      
      return (
        <g key={row.id}>
          {dots}
          {totalLabel}
        </g>
      );
    });
  };

  return (
    <div className="flex flex-col h-full bg-gray-50">
      <div className="bg-white border-b border-gray-200 p-4 flex justify-between items-center shrink-0">
        <h1 className="text-xl font-bold text-gray-800">Dot Plots</h1>
        <GraphToolbar 
          onExportPNG={handleExportPNG} onCopy={handleCopy} isCopied={isCopied}
          onExportSVG={handleExportSVG}
          onResetView={handleResetView}
          onAutoCrop={handleAutoCrop}
          cropMode={cropMode}
          setCropMode={setCropMode}
          exportDpi={exportDpi}
          onDpiChange={setExportDpi}
          previewScale={previewScale}
          setPreviewScale={setPreviewScale}
        />
      </div>

      <div className="flex flex-1 overflow-hidden">
        <aside className="w-80 bg-white border-r border-gray-200 flex flex-col z-10 shadow-sm">
          <div className="flex border-b border-gray-200 bg-gray-50">
            <button
              className={`flex-1 py-3 text-xs font-bold uppercase tracking-wider border-b-2 transition-colors ${activeTab === 'data' ? 'border-blue-600 text-blue-600 bg-white' : 'border-transparent text-gray-500 hover:text-gray-700 hover:bg-gray-100'}`}
              onClick={() => setActiveTab('data')}
            >
              <List size={14} className="inline mr-1.5 mb-0.5" /> Data
            </button>
            <button
              className={`flex-1 py-3 text-xs font-bold uppercase tracking-wider border-b-2 transition-colors ${activeTab === 'raw' ? 'border-blue-600 text-blue-600 bg-white' : 'border-transparent text-gray-500 hover:text-gray-700 hover:bg-gray-100'}`}
              onClick={() => setActiveTab('raw')}
            >
              <FileText size={14} className="inline mr-1.5 mb-0.5" /> Raw
            </button>
            <button
              className={`flex-1 py-3 text-xs font-bold uppercase tracking-wider border-b-2 transition-colors ${activeTab === 'window' ? 'border-blue-600 text-blue-600 bg-white' : 'border-transparent text-gray-500 hover:text-gray-700 hover:bg-gray-100'}`}
              onClick={() => setActiveTab('window')}
            >
              <Sliders size={14} className="inline mr-1.5 mb-0.5" /> Axes
            </button>
            <button
              className={`flex-1 py-3 text-xs font-bold uppercase tracking-wider border-b-2 transition-colors ${activeTab === 'style' ? 'border-blue-600 text-blue-600 bg-white' : 'border-transparent text-gray-500 hover:text-gray-700 hover:bg-gray-100'}`}
              onClick={() => setActiveTab('style')}
            >
              <Palette size={14} className="inline mr-1.5 mb-0.5" /> Style
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
            {activeTab === 'data' && (
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider">Data Points</h3>
                  <button onClick={handleAddRow} className="text-blue-600 hover:text-blue-800 p-1 bg-blue-50 rounded hover:bg-blue-100 transition-colors"><Plus size={16} /></button>
                </div>
                
                <div className="grid grid-cols-[1fr_1fr_auto] gap-2 mb-2 px-2">
                  <span className="text-xs font-semibold text-gray-500">Value</span>
                  <span className="text-xs font-semibold text-gray-500">Frequency</span>
                  <span className="w-6"></span>
                </div>

                <div className="space-y-2">
                  {data.map((row) => (
                    <div key={row.id} className="grid grid-cols-[1fr_1fr_auto] gap-2 items-center bg-gray-50 p-2 rounded border border-gray-200 hover:border-blue-300 transition-colors">
                      <input 
                        type="number" value={row.value} 
                        onChange={e => handleUpdateRow(row.id, { value: parseFloat(e.target.value) || 0 })}
                        className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm focus:ring-1 focus:ring-blue-500 focus:border-blue-500 outline-none"
                      />
                      <input 
                        type="number" value={row.frequency} min="0"
                        onChange={e => handleUpdateRow(row.id, { frequency: parseInt(e.target.value) || 0 })}
                        className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm focus:ring-1 focus:ring-blue-500 focus:border-blue-500 outline-none"
                      />
                      <button onClick={() => handleRemoveRow(row.id)} className="text-gray-400 hover:text-red-500 p-1.5 hover:bg-red-50 rounded transition-colors"><Trash2 size={14} /></button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {activeTab === 'raw' && (
              <div className="space-y-4 h-full flex flex-col">
                <div className="flex gap-2 p-1 bg-gray-100 rounded-lg">
                  <button
                    className={`flex-1 py-1.5 text-xs font-medium rounded-md transition-colors ${rawInputMode === 'values' ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500 hover:text-gray-700'}`}
                    onClick={() => setRawInputMode('values')}
                  >
                    Raw Values
                  </button>
                  <button
                    className={`flex-1 py-1.5 text-xs font-medium rounded-md transition-colors ${rawInputMode === 'pairs' ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500 hover:text-gray-700'}`}
                    onClick={() => setRawInputMode('pairs')}
                  >
                    Value & Freq
                  </button>
                </div>

                <div className="space-y-2 flex-1 flex flex-col">
                  <label className="block text-sm font-medium text-gray-700">Paste Data</label>
                  <p className="text-xs text-gray-500">
                    {rawInputMode === 'values' 
                      ? "Paste individual values (e.g., 134 135 135 136)" 
                      : "Paste pairs (e.g., 134, 3, 135, 7 or 134 3 135 7)"}
                  </p>
                  <textarea 
                    value={rawDataInput} 
                    onChange={(e) => setRawDataInput(e.target.value)}
                    className="flex-1 w-full border border-gray-300 rounded-md p-2 text-sm font-mono resize-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 outline-none"
                    placeholder={rawInputMode === 'values' ? "134 135 135 136 136 136" : "134, 3\n135, 7\n136, 10"}
                  />
                </div>
                <button 
                  onClick={handleGenerateFromRaw}
                  className="w-full py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-md text-sm font-medium transition-colors shadow-sm"
                >
                  Generate Dot Plot
                </button>
              </div>
            )}

            {activeTab === 'window' && (
              <WindowSettings
                windowSettings={windowSettings}
                onSettingChange={(field, val) => setWindowSettings(prev => ({ ...prev, [field]: val }))}
                dimCm={dimCm}
                setDimCm={setDimCm}
                isFixedSize={isFixedSize}
                setIsFixedSize={setIsFixedSize}
              />
            )}

            {activeTab === 'style' && (
              <div className="space-y-6">
                <AppearanceSettings config={config} setConfig={setConfig} hideGridOptions={true} />
                
                <div className="pt-4 border-t border-gray-200">
                  <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-4">Dot Style</h3>
                  
                  <div className="space-y-4">
                    <div>
                      <label className="flex justify-between text-xs text-gray-600 mb-1">
                        <span>Dot Radius</span>
                        <span className="font-mono">{dotRadius}px</span>
                      </label>
                      <input 
                        type="range" min="2" max="20" step="1"
                        value={dotRadius}
                        onChange={(e) => setDotRadius(Number(e.target.value))}
                        className="w-full h-1.5 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
                      />
                    </div>
                    
                    <div>
                      <label className="flex justify-between text-xs text-gray-600 mb-1">
                        <span>Vertical Spacing</span>
                        <span className="font-mono">{dotSpacing}px</span>
                      </label>
                      <input 
                        type="range" min="4" max="40" step="1"
                        value={dotSpacing}
                        onChange={(e) => setDotSpacing(Number(e.target.value))}
                        className="w-full h-1.5 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
                      />
                    </div>

                    <div>
                      <label className="flex justify-between text-xs text-gray-600 mb-1">
                        <span>Bottom Offset</span>
                        <span className="font-mono">{yOffset}px</span>
                      </label>
                      <input 
                        type="range" min="0" max="50" step="1"
                        value={yOffset}
                        onChange={(e) => setYOffset(Number(e.target.value))}
                        className="w-full h-1.5 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
                      />
                    </div>

                    <div>
                      <label className="block text-xs text-gray-600 mb-1">Dot Color</label>
                      <div className="flex gap-2">
                        <input 
                          type="color" 
                          value={dotColor}
                          onChange={(e) => setDotColor(e.target.value)}
                          className="w-8 h-8 rounded cursor-pointer border border-gray-300"
                        />
                        <input 
                          type="text" 
                          value={dotColor}
                          onChange={(e) => setDotColor(e.target.value)}
                          className="flex-1 border border-gray-300 rounded px-2 text-sm font-mono"
                        />
                      </div>
                    </div>
                  </div>
                </div>

                <div className="pt-4 border-t border-gray-200">
                  <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-4">Statistics & Labels</h3>
                  
                  <div className="space-y-4">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input 
                        type="checkbox" 
                        checked={showQuartiles} 
                        onChange={(e) => setShowQuartiles(e.target.checked)}
                        className="rounded text-blue-600 focus:ring-blue-500"
                      />
                      <span className="text-sm text-gray-700">Show Quartiles (Q1, Med, Q3)</span>
                    </label>

                    <label className="flex items-center gap-2 cursor-pointer">
                      <input 
                        type="checkbox" 
                        checked={showDotNumbers} 
                        onChange={(e) => setShowDotNumbers(e.target.checked)}
                        className="rounded text-blue-600 focus:ring-blue-500"
                      />
                      <span className="text-sm text-gray-700">Show Numbers Inside Dots</span>
                    </label>

                    <div>
                      <label className="block text-xs text-gray-600 mb-1">Column Totals</label>
                      <select 
                        value={showColumnTotals}
                        onChange={(e) => setShowColumnTotals(e.target.value as any)}
                        className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm focus:ring-1 focus:ring-blue-500 outline-none"
                      >
                        <option value="none">None</option>
                        <option value="individual">Individual Column Totals</option>
                        <option value="cumulative">Cumulative Totals</option>
                      </select>
                    </div>

                    {showQuartiles && (
                      <div className="pt-2 border-t border-gray-100 space-y-3">
                        <h4 className="text-xs font-semibold text-gray-500">Quartile Customization</h4>
                        <div className="grid grid-cols-2 gap-3">
                            <div><label className="block text-xs text-gray-500 mb-1">Exact Color</label><input type="color" value={quartileColorExact} onChange={(e) => setQuartileColorExact(e.target.value)} className="w-full h-6 border rounded cursor-pointer" /></div>
                            <div><label className="block text-xs text-gray-500 mb-1">Split Color</label><input type="color" value={quartileColorSplit} onChange={(e) => setQuartileColorSplit(e.target.value)} className="w-full h-6 border rounded cursor-pointer" /></div>
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                            <div><label className="block text-xs text-gray-500 mb-1">Offset X</label><input type="number" value={quartileOffsetX} onChange={(e) => setQuartileOffsetX(parseFloat(e.target.value) || 0)} className="w-full border rounded p-1 text-xs" /></div>
                            <div><label className="block text-xs text-gray-500 mb-1">Offset Y</label><input type="number" value={quartileOffsetY} onChange={(e) => setQuartileOffsetY(parseFloat(e.target.value) || 0)} className="w-full border rounded p-1 text-xs" /></div>
                        </div>
                      </div>
                    )}
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
                            <span className="block text-xs text-gray-500 mt-0.5">Hide dots to create a worksheet</span>
                        </div>
                    </label>
                </div>
              </div>
            )}
          </div>
        </aside>

        <div 
          className="flex-1 overflow-auto bg-gray-100 flex items-center justify-center p-8 relative"
          ref={containerRef}
          onMouseMove={onMouseMove}
          onMouseUp={onMouseUp}
          onMouseLeave={onMouseUp}
        >
          <div 
            className="bg-white shadow-sm border border-gray-200 relative"
            style={{
              width: config.layoutMode === 'fixed' ? config.targetWidth : '100%',
              height: config.layoutMode === 'fixed' ? config.targetHeight : '100%',
              transform: `scale(${previewScale})`,
              transformOrigin: 'center center',
              transition: 'transform 0.2s ease-out'
            }}
          >
            <svg
              id="graph-svg"
              width="100%"
              height="100%"
              viewBox={customViewBox || `0 0 ${engine.widthPixels} ${engine.heightPixels}`}
              className="block"
              onMouseDown={handleCropMouseDown}
              onMouseMove={handleCropMouseMove}
              onMouseUp={handleCropMouseUp}
              onMouseLeave={handleCropMouseUp}
              style={{ cursor: cropMode ? 'crosshair' : 'default', fontFamily: 'sans-serif' }}
            >
              <defs>
                <clipPath id="graph-clip">
                  <rect 
                    x={engine.getGridBoundaries().xStart - dotRadius - 2} 
                    y={engine.getGridBoundaries().yStart - dotRadius - 2} 
                    width={(engine.getGridBoundaries().xEnd - engine.getGridBoundaries().xStart) + (dotRadius * 2) + 4} 
                    height={(engine.getGridBoundaries().yEnd - engine.getGridBoundaries().yStart) + (dotRadius * 2) + 4} 
                  />
                </clipPath>
              </defs>

              <rect x="0" y="0" width={engine.widthPixels} height={engine.heightPixels} fill="white" />
              {engine.renderGrid()}
              {engine.renderAxes()}
              {engine.renderLabels(
                (e) => handleAxisLabelDragStart('x', e),
                (e) => handleAxisLabelDragStart('y', e)
              )}

              <g clipPath="url(#graph-clip)">
                {renderQuartiles()}
                {renderDots()}
              </g>

              {cropMode && selectionBox && (
                <rect
                  x={Math.min(selectionBox.startX, selectionBox.currentX)}
                  y={Math.min(selectionBox.startY, selectionBox.currentY)}
                  width={Math.abs(selectionBox.currentX - selectionBox.startX)}
                  height={Math.abs(selectionBox.currentY - selectionBox.startY)}
                  fill="rgba(59, 130, 246, 0.2)"
                  stroke="#3b82f6"
                  strokeWidth="2"
                  strokeDasharray="4 4"
                />
              )}
            </svg>
          </div>
        </div>
      </div>
    </div>
  );
}
