
import React from 'react';
import { FunctionDef, IntegralDef, TangentDef } from '../../types';
import { BackgroundImage } from '../../hooks/useFunctionGrapherState';
import { Settings2, Grid, Waves, TrendingUp, MoveUpRight, Calculator, Plus, Trash2, Eye, EyeOff, AreaChart, GitCommit, Link2Off, Image as ImageIcon, Upload } from 'lucide-react';

interface FunctionToolsProps {
  functions: FunctionDef[];
  
  integrals: IntegralDef[];
  onAddIntegral: () => void;
  onUpdateIntegral: (id: string, updates: Partial<IntegralDef>) => void;
  onRemoveIntegral: (id: string) => void;

  tangents: TangentDef[];
  onAddTangent: () => void;
  onUpdateTangent: (id: string, updates: Partial<TangentDef>) => void;
  onRemoveTangent: (id: string) => void;
  onDecoupleTangent: (id: string) => void;
  
  // From FunctionOptions
  showExactValues: boolean;
  onToggleExactValues: (val: boolean) => void;
  onLoadPreset: (presetKey: string) => void;

  bgImage: BackgroundImage | null;
  onUpdateBgImage: (img: BackgroundImage | null) => void;
}

export const FunctionTools: React.FC<FunctionToolsProps> = ({
  functions, 
  integrals, onAddIntegral, onUpdateIntegral, onRemoveIntegral,
  tangents, onAddTangent, onUpdateTangent, onRemoveTangent, onDecoupleTangent,
  showExactValues, onToggleExactValues, onLoadPreset,
  bgImage, onUpdateBgImage
}) => {
  const presets = [
    { key: 'standard', label: 'Standard', icon: <Grid size={18} className="text-gray-500" />, desc: '10x10 Grid, Empty' },
    { key: 'trig', label: 'Trigonometry', icon: <Waves size={18} className="text-blue-500" />, desc: 'Sin/Cos, π-axis steps' },
    { key: 'polynomials', label: 'Polynomials', icon: <TrendingUp size={18} className="text-purple-500" />, desc: 'Quadratic & Cubic' },
    { key: 'quadrant1', label: 'Quadrant 1', icon: <MoveUpRight size={18} className="text-green-500" />, desc: 'Positive x, y only' },
    { key: 'kinematics', label: 'Kinematics', icon: <Calculator size={18} className="text-orange-500" />, desc: 'Velocity vs Time' }
  ];

  const renderFuncOption = (f: FunctionDef) => (
      <option key={f.id} value={f.id}>
          {f.expression || `Func ${f.id}`} {f.locked ? '(Derived)' : ''}
      </option>
  );

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      
      const reader = new FileReader();
      reader.onload = (ev) => {
          if (ev.target?.result) {
              onUpdateBgImage({
                  url: ev.target.result as string,
                  opacity: 0.5,
                  x: -5, y: 5,
                  width: 10, height: 10,
                  rotation: 0
              });
          }
      };
      reader.readAsDataURL(file);
  };

  return (
    <div className="flex flex-col h-full">
      <div className="p-4 bg-gray-50 border-b border-gray-100">
        <h2 className="text-xs font-bold text-gray-500 uppercase tracking-wider flex items-center gap-2">
            <Settings2 size={14} /> 
            Tools & Options
        </h2>
      </div>

      <div className="flex-1 overflow-y-auto custom-scrollbar p-4 space-y-6">
        
        {/* Background Image Tool */}
        <div className="space-y-3">
            <div className="flex justify-between items-center">
                <h3 className="text-xs font-semibold text-gray-800 flex items-center gap-2">
                    <ImageIcon size={14} className="text-gray-600"/>
                    Background Image
                </h3>
            </div>
            
            {!bgImage ? (
                <label className="flex flex-col items-center justify-center p-3 border-2 border-dashed border-gray-200 rounded-md cursor-pointer hover:bg-gray-50 transition-colors">
                    <Upload size={20} className="text-gray-400 mb-1" />
                    <span className="text-xs text-gray-500">Click to Upload Image</span>
                    <input type="file" accept="image/*" className="hidden" onChange={handleImageUpload} />
                </label>
            ) : (
                <div className="bg-white border border-gray-200 rounded-md p-3 shadow-sm text-sm space-y-2">
                    <div className="flex items-center justify-between mb-2">
                        <span className="text-[10px] font-bold text-gray-400 uppercase">Image Settings</span>
                        <button onClick={() => onUpdateBgImage(null)} className="text-red-500 hover:text-red-700">
                            <Trash2 size={14} />
                        </button>
                    </div>
                    
                    <div className="grid grid-cols-2 gap-2">
                        <div>
                            <label className="text-[10px] text-gray-500">X (Left)</label>
                            <input 
                                type="number" step="0.5" value={bgImage.x}
                                onChange={(e) => onUpdateBgImage({...bgImage, x: parseFloat(e.target.value)})}
                                className="w-full border rounded px-1 text-xs"
                            />
                        </div>
                        <div>
                            <label className="text-[10px] text-gray-500">Y (Top)</label>
                            <input 
                                type="number" step="0.5" value={bgImage.y}
                                onChange={(e) => onUpdateBgImage({...bgImage, y: parseFloat(e.target.value)})}
                                className="w-full border rounded px-1 text-xs"
                            />
                        </div>
                        <div>
                            <label className="text-[10px] text-gray-500">Width</label>
                            <input 
                                type="number" step="0.5" value={bgImage.width}
                                onChange={(e) => onUpdateBgImage({...bgImage, width: parseFloat(e.target.value)})}
                                className="w-full border rounded px-1 text-xs"
                            />
                        </div>
                        <div>
                            <label className="text-[10px] text-gray-500">Height</label>
                            <input 
                                type="number" step="0.5" value={bgImage.height}
                                onChange={(e) => onUpdateBgImage({...bgImage, height: parseFloat(e.target.value)})}
                                className="w-full border rounded px-1 text-xs"
                            />
                        </div>
                    </div>

                    <div>
                        <label className="text-[10px] text-gray-500 flex justify-between">
                            Opacity <span>{Math.round(bgImage.opacity * 100)}%</span>
                        </label>
                        <input 
                            type="range" min="0" max="1" step="0.05"
                            value={bgImage.opacity}
                            onChange={(e) => onUpdateBgImage({...bgImage, opacity: parseFloat(e.target.value)})}
                            className="w-full h-1 bg-gray-200 rounded-lg appearance-none cursor-pointer"
                        />
                    </div>
                </div>
            )}
        </div>

        <div className="w-full h-px bg-gray-200"></div>

        {/* Integrals / Area Tool */}
        <div className="space-y-3">
            <div className="flex justify-between items-center">
                <h3 className="text-xs font-semibold text-gray-800 flex items-center gap-2">
                    <AreaChart size={14} className="text-blue-600"/>
                    Integrals / Area
                </h3>
                <button onClick={onAddIntegral} className="text-blue-600 hover:bg-blue-50 p-1 rounded">
                    <Plus size={16} />
                </button>
            </div>
            
            {integrals.length === 0 && (
                <div className="text-xs text-gray-400 italic bg-gray-50 p-3 rounded border border-gray-100 text-center">
                    No integrals defined. Click + to add area shading.
                </div>
            )}

            <div className="space-y-2">
                {integrals.map(int => (
                    <div key={int.id} className="bg-white border border-gray-200 rounded-md p-3 shadow-sm text-sm">
                        <div className="flex items-center gap-2 mb-2">
                            <span className="text-xs font-serif italic text-gray-500">Between</span>
                            <select 
                                value={int.functionId1} 
                                onChange={(e) => onUpdateIntegral(int.id, { functionId1: e.target.value })}
                                className="flex-1 w-0 border border-gray-300 rounded px-1 py-1 text-xs"
                            >
                                <option value="">Select Func</option>
                                {functions.map(renderFuncOption)}
                            </select>
                            <span className="text-xs font-serif italic text-gray-500">&</span>
                            <select 
                                value={int.functionId2 || ''} 
                                onChange={(e) => onUpdateIntegral(int.id, { functionId2: e.target.value || undefined })}
                                className="flex-1 w-0 border border-gray-300 rounded px-1 py-1 text-xs"
                            >
                                <option value="">X-Axis (y=0)</option>
                                <option value="axis-y">Y-Axis (x=0)</option>
                                {functions.filter(f => f.id !== int.functionId1).map(renderFuncOption)}
                            </select>
                            <button onClick={() => onRemoveIntegral(int.id)} className="text-gray-400 hover:text-red-500">
                                <Trash2 size={14} />
                            </button>
                        </div>

                        <div className="grid grid-cols-2 gap-2 mb-2">
                            <div className="flex items-center gap-1">
                                <span className="text-[10px] text-gray-400">from</span>
                                <input 
                                    type="text" placeholder="-∞" value={int.start}
                                    onChange={(e) => onUpdateIntegral(int.id, { start: e.target.value })}
                                    className="w-full border rounded px-1 py-0.5 text-xs text-center"
                                />
                            </div>
                            <div className="flex items-center gap-1">
                                <span className="text-[10px] text-gray-400">to</span>
                                <input 
                                    type="text" placeholder="∞" value={int.end}
                                    onChange={(e) => onUpdateIntegral(int.id, { end: e.target.value })}
                                    className="w-full border rounded px-1 py-0.5 text-xs text-center"
                                />
                            </div>
                        </div>

                        <div className="flex items-center justify-between gap-2">
                            <div className="flex items-center gap-2">
                                <input 
                                    type="color" value={int.color}
                                    onChange={(e) => onUpdateIntegral(int.id, { color: e.target.value })}
                                    className="w-5 h-5 p-0 border-0 rounded cursor-pointer"
                                />
                                <div className="flex items-center gap-1">
                                    <span className="text-[10px] text-gray-400">Opacity</span>
                                    <input 
                                        type="range" min="0" max="1" step="0.1" value={int.opacity}
                                        onChange={(e) => onUpdateIntegral(int.id, { opacity: parseFloat(e.target.value) })}
                                        className="w-12 h-1 accent-blue-600"
                                    />
                                </div>
                            </div>
                            <button onClick={() => onUpdateIntegral(int.id, { visible: !int.visible })} className="text-gray-400 hover:text-gray-600">
                                {int.visible ? <Eye size={14} /> : <EyeOff size={14} />}
                            </button>
                        </div>
                    </div>
                ))}
            </div>
        </div>

        <div className="w-full h-px bg-gray-200"></div>

        {/* Tangents & Normals Tool */}
        <div className="space-y-3">
            <div className="flex justify-between items-center">
                <h3 className="text-xs font-semibold text-gray-800 flex items-center gap-2">
                    <GitCommit size={14} className="text-purple-600 rotate-90"/>
                    Tangents & Normals
                </h3>
                <button onClick={onAddTangent} className="text-purple-600 hover:bg-purple-50 p-1 rounded">
                    <Plus size={16} />
                </button>
            </div>
            
            {tangents.length === 0 && (
                <div className="text-xs text-gray-400 italic bg-gray-50 p-3 rounded border border-gray-100 text-center">
                    No tangents defined. Click + to add.
                </div>
            )}

            <div className="space-y-2">
                {tangents.map(t => (
                    <div key={t.id} className="bg-white border border-gray-200 rounded-md p-3 shadow-sm text-sm">
                        <div className="flex items-center gap-2 mb-2">
                            <select 
                                value={t.mode}
                                onChange={(e) => onUpdateTangent(t.id, { mode: e.target.value as any })}
                                className="text-[10px] font-bold uppercase border border-gray-300 rounded px-1 py-1"
                            >
                                <option value="tangent">Tan</option>
                                <option value="normal">Norm</option>
                            </select>
                            <span className="text-[10px] text-gray-400">to</span>
                            <select 
                                value={t.functionId} 
                                onChange={(e) => onUpdateTangent(t.id, { functionId: e.target.value })}
                                className="flex-1 w-0 border border-gray-300 rounded px-1 py-1 text-xs"
                            >
                                {functions.map(renderFuncOption)}
                            </select>
                            <button onClick={() => onRemoveTangent(t.id)} className="text-gray-400 hover:text-red-500">
                                <Trash2 size={14} />
                            </button>
                        </div>

                        <div className="flex items-center gap-2 mb-2">
                            <span className="text-xs font-serif italic text-gray-500">x =</span>
                            <input 
                                type="number" step="0.5" 
                                value={parseFloat(t.x.toFixed(4))}
                                onChange={(e) => onUpdateTangent(t.id, { x: parseFloat(e.target.value) })}
                                className="flex-1 border border-gray-300 rounded px-2 py-1 text-xs"
                            />
                        </div>

                        <div className="flex items-center justify-between gap-2">
                            <div className="flex items-center gap-2">
                                <input 
                                    type="color" value={t.color}
                                    onChange={(e) => onUpdateTangent(t.id, { color: e.target.value })}
                                    className="w-5 h-5 p-0 border-0 rounded cursor-pointer"
                                    title="Line Color"
                                />
                                <div className="h-4 w-px bg-gray-200 mx-1"></div>
                                <select 
                                    value={t.lineType} 
                                    onChange={(e) => onUpdateTangent(t.id, { lineType: e.target.value as any })}
                                    className="text-[10px] border border-gray-300 rounded px-1 py-0.5"
                                >
                                    <option value="solid">Solid</option>
                                    <option value="dashed">Dashed</option>
                                    <option value="dotted">Dotted</option>
                                </select>
                                <input 
                                    type="number" min="0.5" max="5" step="0.5"
                                    value={t.strokeWidth}
                                    onChange={(e) => onUpdateTangent(t.id, { strokeWidth: parseFloat(e.target.value) })}
                                    className="w-10 border border-gray-300 rounded px-1 py-0.5 text-[10px]"
                                    title="Line Thickness"
                                />
                            </div>
                            <div className="flex items-center gap-1">
                                <button onClick={() => onUpdateTangent(t.id, { visible: !t.visible })} className="text-gray-400 hover:text-gray-600 p-1">
                                    {t.visible ? <Eye size={14} /> : <EyeOff size={14} />}
                                </button>
                            </div>
                        </div>
                        
                        <div className="mt-2 pt-2 border-t border-gray-100 flex justify-between items-center">
                            <label className="flex items-center gap-1 text-[10px] text-gray-500 cursor-pointer">
                                <input 
                                    type="checkbox" 
                                    checked={t.showPoint} 
                                    onChange={(e) => onUpdateTangent(t.id, { showPoint: e.target.checked })} 
                                />
                                Show Handle Point
                            </label>
                            <button 
                                onClick={() => onDecoupleTangent(t.id)} 
                                className="text-[10px] text-purple-500 hover:text-purple-700 flex items-center gap-1"
                                title="Unlink equation from this tool (becomes editable function)"
                            >
                                <Link2Off size={10} /> Decouple Eq
                            </button>
                        </div>
                    </div>
                ))}
            </div>
        </div>

        <div className="w-full h-px bg-gray-200"></div>

        {/* Calculation Settings */}
        <div className="space-y-3">
            <h3 className="text-xs font-semibold text-gray-800">Display</h3>
            <div className="bg-white border border-gray-200 rounded-md p-3">
                <label className="flex items-center gap-3 text-sm text-gray-700 cursor-pointer select-none">
                    <div className={`w-4 h-4 rounded border flex items-center justify-center transition-colors ${showExactValues ? 'bg-blue-600 border-blue-600 text-white' : 'bg-white border-gray-300'}`}>
                        {showExactValues && <span className="text-[10px]">✓</span>}
                    </div>
                    <input 
                        type="checkbox" 
                        checked={showExactValues}
                        onChange={(e) => onToggleExactValues(e.target.checked)}
                        className="hidden"
                    />
                    <span className="text-xs font-medium">Show Exact Values (π, √)</span>
                </label>
            </div>
        </div>

        {/* Presets Grid */}
        <div className="space-y-3">
            <h3 className="text-xs font-semibold text-gray-800">Page Presets</h3>
            <div className="grid grid-cols-1 gap-2">
                {presets.map(p => (
                    <button
                        key={p.key}
                        onClick={() => onLoadPreset(p.key)}
                        className="flex items-center gap-3 p-2 bg-white border border-gray-200 rounded hover:border-blue-300 hover:bg-blue-50/30 transition-all text-left group"
                    >
                        <div className="text-gray-400 group-hover:text-blue-500">
                            {p.icon}
                        </div>
                        <div>
                            <span className="block text-xs font-medium text-gray-700 group-hover:text-blue-700">{p.label}</span>
                            <span className="block text-[10px] text-gray-400">{p.desc}</span>
                        </div>
                    </button>
                ))}
            </div>
        </div>

      </div>
    </div>
  );
};
