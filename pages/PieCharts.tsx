
import React, { useState, useMemo } from 'react';
import { BaseGraphEngine } from '../utils/graphBase';
import { renderPieChart, PieChartConfig } from '../utils/graphRenderers';
import { PieSliceDef } from '../types';
import { GLOBAL_CONFIG } from '../config/graphDefaults';
import { Settings, List, Sliders, Palette, Plus, Trash2, Eye, EyeOff, RotateCw, PieChart, Circle, GripHorizontal, MoveHorizontal, MoveDiagonal } from 'lucide-react';
import { CM_TO_PX } from '../constants';

import { GraphToolbar } from '../components/GraphToolbar';
import { useGraphInteraction } from '../hooks/useGraphInteraction';
import { useDragSystem } from '../hooks/useDragSystem';
import { RichInput } from '../components/ui/RichInput';

const INITIAL_SLICES: PieSliceDef[] = [
  { id: '1', label: 'Walk', value: 15, color: '#3b82f6', explodeOffset: 0, visible: true },
  { id: '2', label: 'Car', value: 8, color: '#ef4444', explodeOffset: 0, visible: true },
  { id: '3', label: 'Bus', value: 12, color: '#10b981', explodeOffset: 20, visible: true },
  { id: '4', label: 'Bike', value: 5, color: '#f59e0b', explodeOffset: 0, visible: true }
];

const PieCharts: React.FC = () => {
  // Dimensions
  const [dimCm, setDimCm] = useState({ width: 14, height: 12 });
  
  // Graph Engine Config (Mostly dummy for Pie, but needed for TextEngine)
  const engineConfig = useMemo(() => ({
      ...GLOBAL_CONFIG,
      targetWidth: Math.round(dimCm.width * CM_TO_PX),
      targetHeight: Math.round(dimCm.height * CM_TO_PX),
      layoutMode: 'fixed',
      showBorder: false,
      showVerticalGrid: false,
      showHorizontalGrid: false,
      showXAxis: false,
      showYAxis: false
  }), [dimCm]);

  const engine = useMemo(() => new BaseGraphEngine(engineConfig as any), [engineConfig]);

  // Interaction Hooks
  const {
      previewScale, setPreviewScale,
      cropMode, setCropMode,
      selectionBox, customViewBox, hasInitialCrop,
      containerRef,
      handleAutoCrop, handleResetView, handleExportPNG, handleExportSVG,
      handleCropMouseDown, handleCropMouseMove, handleCropMouseUp
  } = useGraphInteraction('pie-svg', engine.widthPixels, engine.heightPixels, dimCm.width);

  const { onMouseDown, onMouseMove, onMouseUp } = useDragSystem(previewScale);

  // --- Pie State ---
  const [slices, setSlices] = useState<PieSliceDef[]>(INITIAL_SLICES);
  const [pieConfig, setPieConfig] = useState<PieChartConfig>({
      cx: engine.widthPixels / 2,
      cy: engine.heightPixels / 2,
      radius: Math.min(engine.widthPixels, engine.heightPixels) * 0.35,
      innerRadius: 0,
      startAngle: 0,
      strokeColor: '#ffffff', // Primary (Dash)
      strokeColor2: '#ffffff', // Secondary (Gap) - Default white/transparent look
      strokeWidth: 2,
      borderStyle: 'solid',
      dashLength: 5,
      dashSpace: 5,
      labelType: 'combined',
      labelPosition: 'outside',
      labelRadiusOffset: 0,
      fontSize: 14,
      fontColor: '#000000'
  });

  const [activeTab, setActiveTab] = useState<'data' | 'style'>('data');
  const [chartTitle, setChartTitle] = useState("Transport to School");
  const [donutRatio, setDonutRatio] = useState(0); // 0 to 0.9

  // --- Derived State updates ---
  useMemo(() => {
      setPieConfig(prev => ({
          ...prev,
          cx: engine.widthPixels / 2,
          cy: engine.heightPixels / 2,
          radius: Math.min(engine.widthPixels, engine.heightPixels) * 0.35,
          innerRadius: Math.min(engine.widthPixels, engine.heightPixels) * 0.35 * donutRatio
      }));
  }, [engine.widthPixels, engine.heightPixels, donutRatio]);

  // --- Drag & Interaction Logic ---
  
  const handleGlobalMouseMove = (e: React.MouseEvent) => {
      if (handleCropMouseMove(e)) return;
      onMouseMove(e);
  };

  const handleGlobalMouseUp = () => {
      handleCropMouseUp();
      onMouseUp();
  };

  // Rotation Handle
  const handleRotationDragStart = (e: React.MouseEvent) => {
      if (cropMode) return;
      e.stopPropagation();

      const svg = document.getElementById('pie-svg');
      if (!svg) return;
      const rect = svg.getBoundingClientRect();
      const clickX = (e.clientX - rect.left) / previewScale;
      const clickY = (e.clientY - rect.top) / previewScale;

      onMouseDown(e, { clickX, clickY }, (dx, dy, init) => {
          const curX = init.clickX + dx;
          const curY = init.clickY + dy;
          const cx = pieConfig.cx;
          const cy = pieConfig.cy;
          
          const angleRad = Math.atan2(curY - cy, curX - cx);
          let angleDeg = angleRad * (180 / Math.PI);
          
          angleDeg += 90;
          if (angleDeg < 0) angleDeg += 360;
          if (angleDeg >= 360) angleDeg -= 360;
          
          setPieConfig(prev => ({ ...prev, startAngle: Math.round(angleDeg) }));
      }, undefined, 'rotate');
  };

  // Slice Explode Drag
  const handleSliceDragStart = (id: string, e: React.MouseEvent) => {
      if (cropMode) return;
      e.stopPropagation();

      // Shift-Click to Reset
      if (e.shiftKey) {
          setSlices(prev => prev.map(s => s.id === id ? { ...s, explodeOffset: 0 } : s));
          return;
      }

      // Calculate the specific slice's mid-angle to constrain movement
      const total = slices.reduce((sum, s) => sum + (s.visible ? s.value : 0), 0);
      let currentAngle = pieConfig.startAngle;
      let midAngle = 0;
      
      for (const s of slices) {
          if (!s.visible) continue;
          const sliceAngle = (s.value / total) * 360;
          if (s.id === id) {
              midAngle = currentAngle + sliceAngle / 2;
              break;
          }
          currentAngle += sliceAngle;
      }

      // Unit vector for this slice
      const rad = (midAngle - 90) * (Math.PI / 180);
      const ux = Math.cos(rad);
      const uy = Math.sin(rad);

      const targetSlice = slices.find(s => s.id === id);
      const initialOffset = targetSlice ? targetSlice.explodeOffset : 0;

      onMouseDown(e, { initialOffset, ux, uy }, (dx, dy, init) => {
          // Project drag vector onto slice vector
          // projection = (dx*ux + dy*uy)
          const dot = dx * init.ux + dy * init.uy;
          const newOffset = Math.max(0, init.initialOffset + dot);
          
          setSlices(prev => prev.map(s => s.id === id ? { ...s, explodeOffset: newOffset } : s));
      }, undefined, 'slice-drag');
  };

  // Label Radial Drag
  const handleLabelDragStart = (id: string, e: React.MouseEvent) => {
      if (cropMode) return;
      e.stopPropagation();

      // Shift-Click to Reset
      if (e.shiftKey) {
          setPieConfig(prev => ({ ...prev, labelRadiusOffset: 0 }));
          return;
      }

      const svg = document.getElementById('pie-svg');
      if (!svg) return;
      const rect = svg.getBoundingClientRect();
      const startX = (e.clientX - rect.left) / previewScale;
      const startY = (e.clientY - rect.top) / previewScale;
      
      // Calculate initial radius of mouse
      const startR = Math.sqrt(Math.pow(startX - pieConfig.cx, 2) + Math.pow(startY - pieConfig.cy, 2));
      const initialOffset = pieConfig.labelRadiusOffset;

      onMouseDown(e, { startR, initialOffset }, (dx, dy, init) => {
          const curX = startX + dx;
          const curY = startY + dy;
          const curR = Math.sqrt(Math.pow(curX - pieConfig.cx, 2) + Math.pow(curY - pieConfig.cy, 2));
          
          const deltaR = curR - init.startR;
          const newOffset = init.initialOffset + deltaR;
          
          setPieConfig(prev => ({ ...prev, labelRadiusOffset: newOffset }));
      }, undefined, 'label-drag');
  };

  // Helper for rendering handle
  const getCoordinates = (r: number, angleDeg: number, cx: number, cy: number) => {
      const angleRad = (angleDeg - 90) * (Math.PI / 180);
      return {
          x: cx + r * Math.cos(angleRad),
          y: cy + r * Math.sin(angleRad)
      };
  };

  // --- Actions ---
  const addSlice = () => {
      const colors = ['#3b82f6', '#ef4444', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899', '#6366f1'];
      const nextColor = colors[slices.length % colors.length];
      setSlices([...slices, { 
          id: Date.now().toString(), 
          label: 'New', 
          value: 10, 
          color: nextColor, 
          explodeOffset: 0, 
          visible: true 
      }]);
  };

  const updateSlice = (id: string, updates: Partial<PieSliceDef>) => {
      setSlices(prev => prev.map(s => s.id === id ? { ...s, ...updates } : s));
  };

  const removeSlice = (id: string) => {
      setSlices(prev => prev.filter(s => s.id !== id));
  };

  const totalValue = slices.reduce((sum, s) => sum + (s.visible ? s.value : 0), 0);
  const rotationHandlePos = getCoordinates(pieConfig.radius + 35, pieConfig.startAngle, pieConfig.cx, pieConfig.cy);
  const rotationLineStart = getCoordinates(pieConfig.radius + 5, pieConfig.startAngle, pieConfig.cx, pieConfig.cy);

  return (
    <div className="flex h-full flex-col bg-gray-50" onMouseMove={handleGlobalMouseMove} onMouseUp={handleGlobalMouseUp}>
      <header className="flex items-center justify-between px-6 py-3 bg-white border-b border-gray-200 shadow-sm z-10">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-amber-50 text-amber-600 rounded-lg"><PieChart className="w-5 h-5" /></div>
          <h1 className="text-xl font-semibold text-gray-800">Pie Chart Creator</h1>
        </div>
        <GraphToolbar 
            previewScale={previewScale} setPreviewScale={setPreviewScale}
            cropMode={cropMode} setCropMode={setCropMode}
            onResetView={handleResetView} onAutoCrop={handleAutoCrop}
            onExportPNG={handleExportPNG} onExportSVG={handleExportSVG}
            onCopy={() => {}} 
        />
      </header>

      <div className="flex flex-1 overflow-hidden">
        <aside className="w-80 bg-white border-r border-gray-200 flex flex-col h-full z-20">
            <div className="flex border-b border-gray-200 bg-white">
                <button onClick={() => setActiveTab('data')} className={`flex-1 py-3 text-sm font-medium flex justify-center items-center gap-2 ${activeTab === 'data' ? 'text-amber-600 border-b-2 border-amber-600 bg-amber-50/50' : 'text-gray-500'}`}><List size={16} /> Data</button>
                <button onClick={() => setActiveTab('style')} className={`flex-1 py-3 text-sm font-medium flex justify-center items-center gap-2 ${activeTab === 'style' ? 'text-amber-600 border-b-2 border-amber-600 bg-amber-50/50' : 'text-gray-500'}`}><Palette size={16} /> Style</button>
            </div>

            <div className="flex-1 overflow-y-auto custom-scrollbar p-4 space-y-6">
                {activeTab === 'data' && (
                    <div className="space-y-4">
                        <div>
                            <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Chart Title</label>
                            <RichInput 
                                value={chartTitle}
                                onChange={(e) => setChartTitle(e.target.value)}
                                className="w-full border rounded px-2 py-1 text-sm"
                                placeholder="Enter title..."
                            />
                        </div>

                        <div className="flex justify-between items-center border-b pb-2">
                            <span className="text-xs font-bold text-gray-500 uppercase">Slices</span>
                            <button onClick={addSlice} className="text-amber-600 hover:bg-amber-50 p-1 rounded"><Plus size={16}/></button>
                        </div>

                        <div className="space-y-2">
                            {slices.map(slice => (
                                <div key={slice.id} className="bg-white border border-gray-200 rounded-md p-3 shadow-sm hover:border-amber-300 transition-colors">
                                    <div className="flex items-center gap-2 mb-2">
                                        <input type="color" value={slice.color} onChange={(e) => updateSlice(slice.id, { color: e.target.value })} className="w-6 h-6 border rounded cursor-pointer" />
                                        <RichInput 
                                            value={slice.label}
                                            onChange={(e) => updateSlice(slice.id, { label: e.target.value })}
                                            className="flex-1 border rounded px-2 py-1 text-sm font-medium"
                                            placeholder="Label"
                                        />
                                        <button onClick={() => updateSlice(slice.id, { visible: !slice.visible })} className="text-gray-400 hover:text-gray-600">
                                            {slice.visible ? <Eye size={16} /> : <EyeOff size={16} />}
                                        </button>
                                        <button onClick={() => removeSlice(slice.id)} className="text-gray-400 hover:text-red-500">
                                            <Trash2 size={16} />
                                        </button>
                                    </div>
                                    <div className="flex items-center justify-between gap-3">
                                        <div className="flex items-center gap-2">
                                            <span className="text-xs text-gray-500">Value:</span>
                                            <input 
                                                type="number" value={slice.value} 
                                                onChange={(e) => updateSlice(slice.id, { value: parseFloat(e.target.value) || 0 })}
                                                className="w-20 border rounded px-2 py-1 text-sm"
                                            />
                                        </div>
                                        <div className="flex items-center gap-1">
                                            <span className="text-[10px] text-gray-400">Exp</span>
                                            <input 
                                                type="range" min="0" max="100" 
                                                value={slice.explodeOffset}
                                                onChange={(e) => updateSlice(slice.id, { explodeOffset: parseFloat(e.target.value) })}
                                                className="w-16 h-1 accent-amber-600"
                                                title="Explode Offset"
                                            />
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>

                        <div className="bg-gray-100 p-2 rounded text-xs text-center text-gray-600 font-medium">
                            Total Value: {totalValue}
                        </div>
                    </div>
                )}

                {activeTab === 'style' && (
                    <div className="space-y-5">
                        <div className="space-y-3">
                            <h3 className="text-xs font-bold text-gray-500 uppercase flex items-center gap-2">
                                <Circle size={14}/> Geometry
                            </h3>
                            
                            <div>
                                <label className="flex justify-between text-xs text-gray-600 mb-1">
                                    <span>Donut Hole</span>
                                    <span>{Math.round(donutRatio * 100)}%</span>
                                </label>
                                <input 
                                    type="range" min="0" max="0.9" step="0.05"
                                    value={donutRatio}
                                    onChange={(e) => setDonutRatio(parseFloat(e.target.value))}
                                    className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-amber-600"
                                />
                            </div>

                            <div>
                                <label className="flex justify-between text-xs text-gray-600 mb-1">
                                    <span>Rotation</span>
                                    <span>{pieConfig.startAngle}°</span>
                                </label>
                                <div className="flex items-center gap-2">
                                    <RotateCw size={14} className="text-gray-400" />
                                    <input 
                                        type="range" min="0" max="360" step="5"
                                        value={pieConfig.startAngle}
                                        onChange={(e) => setPieConfig({...pieConfig, startAngle: parseFloat(e.target.value)})}
                                        className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-amber-600"
                                    />
                                </div>
                            </div>
                        </div>

                        <div className="space-y-3 border-t border-gray-100 pt-3">
                            <h3 className="text-xs font-bold text-gray-500 uppercase flex items-center gap-2">
                                <List size={14}/> Labels
                            </h3>
                            
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="block text-xs text-gray-500 mb-1">Content</label>
                                    <select 
                                        value={pieConfig.labelType}
                                        onChange={(e) => setPieConfig({...pieConfig, labelType: e.target.value as any})}
                                        className="w-full border rounded p-1 text-xs"
                                    >
                                        <option value="none">None</option>
                                        <option value="name">Name</option>
                                        <option value="value">Value</option>
                                        <option value="percent">Percentage</option>
                                        <option value="combined">Name + %</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-xs text-gray-500 mb-1">Position</label>
                                    <select 
                                        value={pieConfig.labelPosition}
                                        onChange={(e) => setPieConfig({...pieConfig, labelPosition: e.target.value as any})}
                                        className="w-full border rounded p-1 text-xs"
                                    >
                                        <option value="inside">Inside</option>
                                        <option value="outside">Outside</option>
                                    </select>
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="block text-xs text-gray-500 mb-1">Font Size</label>
                                    <input 
                                        type="number" min="8" max="32"
                                        value={pieConfig.fontSize}
                                        onChange={(e) => setPieConfig({...pieConfig, fontSize: parseFloat(e.target.value)})}
                                        className="w-full border rounded p-1 text-xs"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs text-gray-500 mb-1">Text Color</label>
                                    <input 
                                        type="color" value={pieConfig.fontColor}
                                        onChange={(e) => setPieConfig({...pieConfig, fontColor: e.target.value})}
                                        className="w-full h-7 border rounded cursor-pointer"
                                    />
                                </div>
                            </div>
                            
                            <div>
                                <label className="flex justify-between text-xs text-gray-600 mb-1">
                                    <span>Label Offset (All)</span>
                                    <span>{Math.round(pieConfig.labelRadiusOffset)}px</span>
                                </label>
                                <input 
                                    type="range" min="-50" max="100" 
                                    value={pieConfig.labelRadiusOffset}
                                    onChange={(e) => setPieConfig({...pieConfig, labelRadiusOffset: parseFloat(e.target.value)})}
                                    className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-amber-600"
                                />
                                <p className="text-[10px] text-gray-400 italic">Drag labels directly to adjust</p>
                            </div>
                        </div>

                        <div className="space-y-3 border-t border-gray-100 pt-3">
                            <h3 className="text-xs font-bold text-gray-500 uppercase flex items-center gap-2">
                                <Sliders size={14}/> Borders & Dimensions
                            </h3>
                            
                            <div>
                                <label className="block text-xs text-gray-500 mb-1">Border Style</label>
                                <select 
                                    value={pieConfig.borderStyle}
                                    onChange={(e) => setPieConfig({...pieConfig, borderStyle: e.target.value as any})}
                                    className="w-full border rounded p-1 text-xs mb-2"
                                >
                                    <option value="solid">Solid</option>
                                    <option value="dashed">Dashed</option>
                                </select>
                            </div>

                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="block text-xs text-gray-500 mb-1">Dash Color</label>
                                    <input 
                                        type="color" value={pieConfig.strokeColor}
                                        onChange={(e) => setPieConfig({...pieConfig, strokeColor: e.target.value})}
                                        className="w-full h-7 border rounded cursor-pointer"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs text-gray-500 mb-1">Gap Color</label>
                                    <input 
                                        type="color" value={pieConfig.strokeColor2}
                                        onChange={(e) => setPieConfig({...pieConfig, strokeColor2: e.target.value})}
                                        className="w-full h-7 border rounded cursor-pointer"
                                    />
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="block text-xs text-gray-500 mb-1">Border Width</label>
                                    <input 
                                        type="number" min="0" max="10" step="0.5"
                                        value={pieConfig.strokeWidth}
                                        onChange={(e) => setPieConfig({...pieConfig, strokeWidth: parseFloat(e.target.value)})}
                                        className="w-full border rounded p-1 text-xs"
                                    />
                                </div>
                            </div>

                            {pieConfig.borderStyle === 'dashed' && (
                                <div className="grid grid-cols-2 gap-3 mt-1">
                                    <div>
                                        <label className="block text-xs text-gray-500 mb-1">Dash Len</label>
                                        <input 
                                            type="number" min="1" max="50"
                                            value={pieConfig.dashLength}
                                            onChange={(e) => setPieConfig({...pieConfig, dashLength: parseFloat(e.target.value)})}
                                            className="w-full border rounded p-1 text-xs"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs text-gray-500 mb-1">Gap Len</label>
                                        <input 
                                            type="number" min="1" max="50"
                                            value={pieConfig.dashSpace}
                                            onChange={(e) => setPieConfig({...pieConfig, dashSpace: parseFloat(e.target.value)})}
                                            className="w-full border rounded p-1 text-xs"
                                        />
                                    </div>
                                </div>
                            )}

                            <div className="mt-4">
                                <label className="block text-xs font-bold text-gray-500 uppercase mb-2">Image Dimensions (cm)</label>
                                <div className="grid grid-cols-2 gap-3">
                                    <input type="number" value={dimCm.width} onChange={(e) => setDimCm({...dimCm, width: parseFloat(e.target.value)})} className="border rounded p-1 text-xs" placeholder="W" />
                                    <input type="number" value={dimCm.height} onChange={(e) => setDimCm({...dimCm, height: parseFloat(e.target.value)})} className="border rounded p-1 text-xs" placeholder="H" />
                                </div>
                            </div>
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
                  id="pie-svg" 
                  width={engine.widthPixels} 
                  height={engine.heightPixels} 
                  viewBox={customViewBox || `0 0 ${engine.widthPixels} ${engine.heightPixels}`} 
                  xmlns="http://www.w3.org/2000/svg" 
                  style={{ display: 'block' }}
              >
                <rect x="0" y="0" width={engine.widthPixels} height={engine.heightPixels} fill="white" />
                
                {/* Title */}
                <g className="data-layer">
                    {chartTitle && engine.texEngine.renderToSVG(
                        chartTitle, engine.widthPixels/2, 35, 20, 'black', 'middle', false, 'text'
                    )}
                </g>

                {/* Pie Chart */}
                <g className="data-layer">
                    {renderPieChart(
                        engine, 
                        slices, 
                        pieConfig,
                        handleSliceDragStart,
                        handleLabelDragStart
                    )}
                </g>

                {/* Rotation Handle (Draggable) */}
                {!cropMode && (
                    <g 
                        className="ui-layer" 
                        onMouseDown={handleRotationDragStart}
                        style={{ cursor: 'grab' }}
                    >
                        <line 
                            x1={rotationLineStart.x} y1={rotationLineStart.y} 
                            x2={rotationHandlePos.x} y2={rotationHandlePos.y} 
                            stroke="#cbd5e1" strokeWidth={1.5} strokeDasharray="4,4" 
                        />
                        <circle 
                            cx={rotationHandlePos.x} cy={rotationHandlePos.y} 
                            r={14} fill="white" stroke="#2563eb" strokeWidth={2}
                        />
                        <RotateCw 
                            x={rotationHandlePos.x - 8} y={rotationHandlePos.y - 8} 
                            size={16} className="text-blue-600" 
                        />
                    </g>
                )}

                {/* Crop Overlay */}
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

export default PieCharts;
