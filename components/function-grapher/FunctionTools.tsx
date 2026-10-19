import React from 'react';
import * as math from 'mathjs';
import { FunctionDef, IntegralDef, IntegralCustomLine, TangentDef, VerticalLineDef } from '../../types';
import { BackgroundImage } from '../../hooks/useFunctionGrapherState';
import { calculateIntegralStats } from '../../utils/renderers/functions';
import { calculateTangentEquation, preprocessMathExpression } from '../../utils/mathAnalysis';
import { formatDecimal } from '../../utils/mathFormatting';
import { Settings2, Grid, Waves, TrendingUp, MoveUpRight, Calculator, Plus, Trash2, Eye, EyeOff, AreaChart, GitCommit, Link2Off, Image as ImageIcon, Upload, Maximize2, MousePointerClick, X } from 'lucide-react';

interface FunctionToolsProps {
  functions: FunctionDef[];
  verticalLines?: VerticalLineDef[];
  xRange?: [number, number];
  yRange?: [number, number];
  globalScope?: Record<string, number>;
  
  integrals: IntegralDef[];
  onAddIntegral: () => void;
  onUpdateIntegral: (id: string, updates: Partial<IntegralDef>) => void;
  onRemoveIntegral: (id: string) => void;
  pickingIntegralId?: string | null;
  onSetPickingIntegralId?: (id: string | null) => void;

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
  highlightedId?: string | null;
}

export const FunctionTools: React.FC<FunctionToolsProps> = ({
  functions,
  verticalLines = [],
  xRange = [-4, 4],
  yRange = [-4, 4],
  globalScope = {},
  integrals, onAddIntegral, onUpdateIntegral, onRemoveIntegral,
  pickingIntegralId, onSetPickingIntegralId,
  tangents, onAddTangent, onUpdateTangent, onRemoveTangent, onDecoupleTangent,
  showExactValues, onToggleExactValues, onLoadPreset,
  bgImage, onUpdateBgImage,
  highlightedId
}) => {
  const presets = [
    { key: 'standard', label: 'Standard Blank', icon: <Grid size={18} className="text-gray-500" />, desc: '[-5, 5] Grid, Empty' },
    { key: 'trig', label: 'Trigonometry', icon: <Waves size={18} className="text-blue-500" />, desc: 'sin(x) & cos(x), π-axis steps' },
    { key: 'polynomials', label: 'Polynomials', icon: <TrendingUp size={18} className="text-purple-500" />, desc: 'Quadratic & Cubic curves' },
    { key: 'quadrant1', label: 'Quadrant 1', icon: <MoveUpRight size={18} className="text-green-500" />, desc: 'First quadrant (x ≥ 0, y ≥ 0)' },
    { key: 'kinematics', label: 'Kinematics', icon: <Calculator size={18} className="text-orange-500" />, desc: 'Displacement vs Time' }
  ];

  const eligibleFunctions = functions.filter(f => f.type !== 'parameter' && !f.isParametric);
  const nonDerivedFunctions = eligibleFunctions.filter(f => !f.locked);

  const renderFuncOption = (f: FunctionDef) => (
      <option key={f.id} value={f.id}>
          {f.expression || `Func ${f.id}`} {f.locked ? '(Tangent/Normal)' : ''}
      </option>
  );

  // Normalize selected function IDs for backward compatibility with functionId1 / functionId2
  const getSelectedFunctionIds = (int: IntegralDef): string[] => {
      if (int.functionIds) return int.functionIds;
      const ids: string[] = [];
      if (int.functionId1) ids.push(int.functionId1);
      if (int.functionId2 && int.functionId2 !== 'axis-y') ids.push(int.functionId2);
      return ids;
  };

  const getIncludeXAxis = (int: IntegralDef, selectedIds: string[]): boolean => {
      if (int.includeXAxis !== undefined) return int.includeXAxis;
      const hasLegacyYAxis = int.functionId2 === 'axis-y';
      return !hasLegacyYAxis && selectedIds.length === 1 && !int.functionId2;
  };

  const getIncludeYAxis = (int: IntegralDef): boolean => {
      if (int.includeYAxis !== undefined) return int.includeYAxis;
      return int.functionId2 === 'axis-y';
  };

  const toggleFunctionForIntegral = (int: IntegralDef, funcId: string) => {
      const current = getSelectedFunctionIds(int);
      const exists = current.includes(funcId);
      const next = exists ? current.filter(id => id !== funcId) : [...current, funcId];
      onUpdateIntegral(int.id, {
          functionIds: next,
          functionId1: next[0] || '',
          functionId2: next[1] || undefined,
          includeXAxis: getIncludeXAxis(int, current)
      });
  };

  const toggleVLineForIntegral = (int: IntegralDef, vlineId: string) => {
      const current = int.verticalLineIds || [];
      const exists = current.includes(vlineId);
      const next = exists ? current.filter(id => id !== vlineId) : [...current, vlineId];
      onUpdateIntegral(int.id, { verticalLineIds: next });
  };

  const addCustomLineToIntegral = (int: IntegralDef, type: 'vertical' | 'horizontal') => {
      const current = int.customLines || [];
      const newLine: IntegralCustomLine = {
          id: Date.now().toString() + Math.random().toString(36).slice(2, 6),
          type,
          value: type === 'vertical' ? '1' : '1',
          showLine: false
      };
      onUpdateIntegral(int.id, { customLines: [...current, newLine] });
  };

  const updateCustomLineOnIntegral = (int: IntegralDef, lineId: string, updates: Partial<IntegralCustomLine>) => {
      const current = int.customLines || [];
      onUpdateIntegral(int.id, {
          customLines: current.map(l => l.id === lineId ? { ...l, ...updates } : l)
      });
  };

  const removeCustomLineFromIntegral = (int: IntegralDef, lineId: string) => {
      const current = int.customLines || [];
      onUpdateIntegral(int.id, {
          customLines: current.filter(l => l.id !== lineId)
      });
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      
      const reader = new FileReader();
      reader.onload = (ev) => {
          if (ev.target?.result) {
              onUpdateBgImage({
                  url: ev.target.result as string,
                  opacity: 0.5,
                  x: xRange[0],
                  y: yRange[1],
                  width: xRange[1] - xRange[0],
                  height: yRange[1] - yRange[0],
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
            Calculus & Overlay Tools
        </h2>
      </div>

      <div className="flex-1 overflow-y-auto custom-scrollbar p-4 space-y-6">
        
        {/* Integrals / Area Tool */}
        <div className="space-y-3" id="integral-section">
            <div className="flex justify-between items-center">
                <h3 className="text-xs font-semibold text-gray-800 flex items-center gap-2">
                    <AreaChart size={14} className="text-blue-600"/>
                    Integrals & Area Shading
                </h3>
                <button
                    onClick={onAddIntegral}
                    className="flex items-center gap-1 px-2 py-1 text-xs font-medium text-blue-600 bg-blue-50 hover:bg-blue-100 rounded transition-colors"
                >
                    <Plus size={14} /> Add Region
                </button>
            </div>
            
            {integrals.length === 0 && (
                <div className="text-xs text-gray-400 italic bg-gray-50 p-3 rounded border border-gray-100 text-center">
                    No shaded regions defined. Click + Add Region to shade areas bounded by any number of curves and lines.
                </div>
            )}

            <div className="space-y-3">
                {integrals.map((int, regionIdx) => {
                    const selectedFuncIds = getSelectedFunctionIds(int);
                    const includeXAxis = getIncludeXAxis(int, selectedFuncIds);
                    const includeYAxis = getIncludeYAxis(int);
                    const selectedVLineIds = int.verticalLineIds || [];
                    const customLines = int.customLines || [];
                    const shadingMode = int.shadingMode || 'auto';
                    const isPicking = pickingIntegralId === int.id;
                    const stats = calculateIntegralStats(int, functions, xRange, globalScope, verticalLines);
                    const isHighlighted = highlightedId === `integral-${int.id}` || highlightedId === `sidebar-integral-${int.id}`;

                    return (
                        <div
                            key={int.id}
                            id={`sidebar-integral-${int.id}`}
                            className={`bg-white border rounded-md p-3 shadow-sm text-sm transition-all space-y-2.5 ${
                                isHighlighted
                                    ? 'border-amber-500 ring-2 ring-amber-200'
                                    : isPicking
                                        ? 'border-blue-500 ring-2 ring-blue-100'
                                        : 'border-gray-200'
                            }`}
                        >
                            {/* Header */}
                            <div className="flex items-center justify-between border-b border-gray-100 pb-1.5">
                                <div className="flex items-center gap-2">
                                    <span
                                        className="w-3 h-3 rounded-sm border border-gray-300 inline-block"
                                        style={{ backgroundColor: int.color, opacity: Math.max(0.35, int.opacity) }}
                                    />
                                    <span className="text-xs font-semibold text-gray-700">
                                        Shaded Region {regionIdx + 1}
                                    </span>
                                </div>
                                <div className="flex items-center gap-1">
                                    <button
                                        onClick={() => onUpdateIntegral(int.id, { visible: !int.visible })}
                                        className="text-gray-400 hover:text-gray-700 p-1"
                                        title={int.visible ? 'Hide Region' : 'Show Region'}
                                    >
                                        {int.visible ? <Eye size={14} /> : <EyeOff size={14} />}
                                    </button>
                                    <button
                                        onClick={() => {
                                            if (isPicking && onSetPickingIntegralId) onSetPickingIntegralId(null);
                                            onRemoveIntegral(int.id);
                                        }}
                                        className="text-gray-400 hover:text-red-500 p-1"
                                        title="Remove Region"
                                    >
                                        <Trash2 size={14} />
                                    </button>
                                </div>
                            </div>

                            {/* 1. Multi-Curve & Axis Selection */}
                            <div className="space-y-1.5">
                                <div className="flex items-center justify-between">
                                    <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400">
                                        Bounding Curves & Axes
                                    </span>
                                    <span className="text-[10px] text-gray-400">
                                        Select any number
                                    </span>
                                </div>

                                <div className="flex flex-wrap gap-1.5">
                                    {eligibleFunctions.map((f, idx) => {
                                        const isSelected = selectedFuncIds.includes(f.id);
                                        const labelPrefix = f.locked
                                            ? 'Tangent:'
                                            : idx === 0 ? 'f(x):' : idx === 1 ? 'g(x):' : idx === 2 ? 'h(x):' : `f${idx + 1}:`;
                                        return (
                                            <button
                                                key={f.id}
                                                type="button"
                                                onClick={() => toggleFunctionForIntegral(int, f.id)}
                                                className={`px-2 py-1 rounded text-[11px] font-mono border transition-all flex items-center gap-1.5 ${
                                                    isSelected
                                                        ? 'bg-blue-50 border-blue-400 text-blue-800 font-medium shadow-2xs'
                                                        : 'bg-gray-50 border-gray-200 text-gray-600 hover:bg-gray-100'
                                                }`}
                                                title={`Toggle ${labelPrefix} ${f.expression || 'empty'}`}
                                            >
                                                <span
                                                    className="w-2 h-2 rounded-full shrink-0"
                                                    style={{ backgroundColor: f.color }}
                                                />
                                                <span className="truncate max-w-[130px]">
                                                    {labelPrefix} {f.expression || '...'}
                                                </span>
                                            </button>
                                        );
                                    })}

                                    {/* X-Axis (y = 0) */}
                                    <button
                                        type="button"
                                        onClick={() => onUpdateIntegral(int.id, {
                                            functionIds: selectedFuncIds,
                                            includeXAxis: !includeXAxis
                                        })}
                                        className={`px-2 py-1 rounded text-[11px] font-mono border transition-all ${
                                            includeXAxis
                                                ? 'bg-blue-50 border-blue-400 text-blue-800 font-medium shadow-2xs'
                                                : 'bg-gray-50 border-gray-200 text-gray-600 hover:bg-gray-100'
                                        }`}
                                    >
                                        X-Axis (y=0)
                                    </button>

                                    {/* Y-Axis (x = 0) */}
                                    <button
                                        type="button"
                                        onClick={() => onUpdateIntegral(int.id, {
                                            functionIds: selectedFuncIds,
                                            includeYAxis: !includeYAxis
                                        })}
                                        className={`px-2 py-1 rounded text-[11px] font-mono border transition-all ${
                                            includeYAxis
                                                ? 'bg-blue-50 border-blue-400 text-blue-800 font-medium shadow-2xs'
                                                : 'bg-gray-50 border-gray-200 text-gray-600 hover:bg-gray-100'
                                        }`}
                                    >
                                        Y-Axis (x=0)
                                    </button>

                                    {/* Graphed Vertical Lines from Data tab */}
                                    {verticalLines.map(vl => {
                                        const isSelected = selectedVLineIds.includes(vl.id);
                                        return (
                                            <button
                                                key={vl.id}
                                                type="button"
                                                onClick={() => toggleVLineForIntegral(int, vl.id)}
                                                className={`px-2 py-1 rounded text-[11px] font-mono border transition-all ${
                                                    isSelected
                                                        ? 'bg-blue-50 border-blue-400 text-blue-800 font-medium shadow-2xs'
                                                        : 'bg-gray-50 border-gray-200 text-gray-600 hover:bg-gray-100'
                                                }`}
                                                title="Graphed Vertical Line"
                                            >
                                                x = {vl.x}
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>

                            {/* 2. Custom Un-graphed Vertical & Horizontal Boundary Lines */}
                            <div className="space-y-1.5 pt-1 border-t border-gray-100">
                                <div className="flex items-center justify-between">
                                    <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400">
                                        Custom Boundary Lines
                                    </span>
                                    <div className="flex items-center gap-1">
                                        <button
                                            type="button"
                                            onClick={() => addCustomLineToIntegral(int, 'vertical')}
                                            className="px-1.5 py-0.5 text-[10px] font-medium bg-gray-100 hover:bg-gray-200 text-gray-700 rounded transition-colors"
                                            title="Add a custom vertical boundary line x = c (not graphed unless toggled)"
                                        >
                                            + Vertical (x=)
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => addCustomLineToIntegral(int, 'horizontal')}
                                            className="px-1.5 py-0.5 text-[10px] font-medium bg-gray-100 hover:bg-gray-200 text-gray-700 rounded transition-colors"
                                            title="Add a custom horizontal boundary line y = c (not graphed unless toggled)"
                                        >
                                            + Horizontal (y=)
                                        </button>
                                    </div>
                                </div>

                                {customLines.length > 0 && (
                                    <div className="space-y-1.5">
                                        {customLines.map(cl => (
                                            <div key={cl.id} className="flex items-center gap-1.5 bg-gray-50 px-2 py-1 rounded border border-gray-200">
                                                <select
                                                    value={cl.type}
                                                    onChange={(e) => updateCustomLineOnIntegral(int, cl.id, { type: e.target.value as 'vertical' | 'horizontal' })}
                                                    className="text-[11px] font-mono bg-white border border-gray-300 rounded px-1 py-0.5 text-gray-700"
                                                >
                                                    <option value="vertical">x =</option>
                                                    <option value="horizontal">y =</option>
                                                </select>
                                                <input
                                                    type="text"
                                                    value={cl.value}
                                                    onChange={(e) => updateCustomLineOnIntegral(int, cl.id, { value: e.target.value })}
                                                    placeholder={cl.type === 'vertical' ? 'e.g. 2, pi/2' : 'e.g. 3, -1'}
                                                    className="flex-1 min-w-0 bg-white border border-gray-300 rounded px-1.5 py-0.5 text-xs font-mono"
                                                />
                                                <button
                                                    type="button"
                                                    onClick={() => updateCustomLineOnIntegral(int, cl.id, { showLine: !cl.showLine })}
                                                    className={`p-1 rounded text-[10px] transition-colors ${
                                                        cl.showLine
                                                            ? 'text-blue-600 bg-blue-50'
                                                            : 'text-gray-400 hover:text-gray-600'
                                                    }`}
                                                    title={cl.showLine ? 'Dashed guide line shown on graph (click to keep un-graphed)' : 'Line is un-graphed (invisible boundary only — click to show dashed line)'}
                                                >
                                                    {cl.showLine ? <Eye size={12} /> : <EyeOff size={12} />}
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => removeCustomLineFromIntegral(int, cl.id)}
                                                    className="text-gray-400 hover:text-red-500 p-0.5"
                                                    title="Remove custom boundary line"
                                                >
                                                    <X size={13} />
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>

                            {/* 3. Optional Domain Cutoffs [a, b] & Region Mode */}
                            <div className="grid grid-cols-2 gap-2 pt-1 border-t border-gray-100">
                                <div className="flex items-center gap-1">
                                    <span className="text-[10px] text-gray-500 font-serif italic shrink-0">x min (a)=</span>
                                    <input 
                                        type="text" placeholder="Auto" value={int.start}
                                        onChange={(e) => onUpdateIntegral(int.id, { start: e.target.value })}
                                        className="w-full border border-gray-300 rounded px-1.5 py-0.5 text-xs font-mono text-center"
                                        title="Optional lower x cutoff (leave blank for automatic intersection bounds)"
                                    />
                                </div>
                                <div className="flex items-center gap-1">
                                    <span className="text-[10px] text-gray-500 font-serif italic shrink-0">x max (b)=</span>
                                    <input 
                                        type="text" placeholder="Auto" value={int.end}
                                        onChange={(e) => onUpdateIntegral(int.id, { end: e.target.value })}
                                        className="w-full border border-gray-300 rounded px-1.5 py-0.5 text-xs font-mono text-center"
                                        title="Optional upper x cutoff (leave blank for automatic intersection bounds)"
                                    />
                                </div>
                            </div>

                            {/* 4. Enclosure Strategy & Interactive Pocket Picker */}
                            <div className="flex items-center justify-between gap-1.5 pt-1">
                                <div className="flex items-center bg-gray-100 p-0.5 rounded text-[10px] font-medium">
                                    <button
                                        type="button"
                                        onClick={() => onUpdateIntegral(int.id, { shadingMode: 'auto' })}
                                        className={`px-2 py-0.5 rounded transition-colors ${
                                            shadingMode === 'auto' ? 'bg-white text-gray-800 shadow-2xs' : 'text-gray-500 hover:text-gray-700'
                                        }`}
                                        title="Automatically shade the enclosed region(s) bounded by the selected curves & lines"
                                    >
                                        Enclosed
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => onUpdateIntegral(int.id, { shadingMode: 'between', seedPoint: null })}
                                        className={`px-2 py-0.5 rounded transition-colors ${
                                            shadingMode === 'between' ? 'bg-white text-gray-800 shadow-2xs' : 'text-gray-500 hover:text-gray-700'
                                        }`}
                                        title="Shade the full outer envelope between the lowest and highest curves"
                                    >
                                        Outer Envelope
                                    </button>
                                </div>

                                {onSetPickingIntegralId && (
                                    <div className="flex items-center gap-1">
                                        <button
                                            type="button"
                                            onClick={() => onSetPickingIntegralId(isPicking ? null : int.id)}
                                            className={`px-2 py-1 rounded text-[10px] font-medium flex items-center gap-1 border transition-colors ${
                                                isPicking
                                                    ? 'bg-blue-600 text-white border-blue-600 animate-pulse'
                                                    : int.seedPoint
                                                        ? 'bg-blue-50 text-blue-700 border-blue-300 hover:bg-blue-100'
                                                        : 'bg-white text-gray-600 border-gray-300 hover:bg-gray-50'
                                            }`}
                                            title="Click inside any enclosed pocket on the graph to shade that specific bounded region"
                                        >
                                            <MousePointerClick size={12} />
                                            {isPicking ? 'Click Graph...' : int.seedPoint ? 'Picked Pocket' : 'Pick Pocket'}
                                        </button>
                                        {int.seedPoint && (
                                            <button
                                                type="button"
                                                onClick={() => onUpdateIntegral(int.id, { seedPoint: null })}
                                                className="text-gray-400 hover:text-gray-700 p-0.5"
                                                title="Reset to automatic enclosed region detection"
                                            >
                                                <X size={12} />
                                            </button>
                                        )}
                                    </div>
                                )}
                            </div>

                            {stats && (
                                <div className="px-2 py-1.5 bg-gray-50 border border-gray-100 rounded flex items-center justify-between text-[11px] font-mono tabular-nums text-gray-700">
                                    <span title="Signed definite integral">
                                        ∫ = <strong>{Number(stats.signedIntegral.toFixed(4))}</strong>
                                    </span>
                                    <span className="text-gray-300">|</span>
                                    <span title="Unsigned total geometric area of shaded region">
                                        Area = <strong>{Number(stats.totalArea.toFixed(4))}</strong>
                                    </span>
                                </div>
                            )}

                            <div className="flex items-center justify-between gap-2 pt-1 border-t border-gray-100">
                                <div className="flex items-center gap-2">
                                    <input 
                                        type="color" value={int.color}
                                        onChange={(e) => onUpdateIntegral(int.id, { color: e.target.value })}
                                        className="w-5 h-5 p-0 border border-gray-200 rounded cursor-pointer"
                                    />
                                    <div className="flex items-center gap-1.5">
                                        <span className="text-[10px] text-gray-500">Opacity ({Math.round(int.opacity * 100)}%)</span>
                                        <input 
                                            type="range" min="0.05" max="1" step="0.05" value={int.opacity}
                                            onChange={(e) => onUpdateIntegral(int.id, { opacity: parseFloat(e.target.value) })}
                                            className="w-20 h-1 accent-blue-600 cursor-pointer"
                                        />
                                    </div>
                                </div>
                            </div>
                        </div>
                    );
                })}
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
                <button
                    onClick={() => onAddTangent()}
                    className="flex items-center gap-1 px-2 py-1 text-xs font-medium text-purple-600 bg-purple-50 hover:bg-purple-100 rounded transition-colors"
                >
                    <Plus size={14} /> Add
                </button>
            </div>
            
            {tangents.length === 0 && (
                <div className="text-xs text-gray-400 italic bg-gray-50 p-3 rounded border border-gray-100 text-center">
                    No tangents defined. Click + Add (or drag handle on graph, hold Shift to snap).
                </div>
            )}

            <div className="space-y-2.5">
                {tangents.map(t => {
                    const sourceFunc = functions.find(f => f.id === t.functionId);
                    let eqnDisplay = '';
                    let ptDisplay = '';
                    if (sourceFunc && sourceFunc.expression) {
                        const eqn = calculateTangentEquation(sourceFunc.expression, t.x, t.mode, globalScope);
                        try {
                            const { plotExpression } = preprocessMathExpression(sourceFunc.expression);
                            const yVal = math.compile(plotExpression).evaluate({ ...globalScope, x: t.x });
                            if (typeof yVal === 'number' && isFinite(yVal)) {
                                ptDisplay = `(${formatDecimal(t.x)}, ${formatDecimal(yVal)})`;
                            }
                        } catch {}
                        if (eqn) {
                            eqnDisplay = `y = ${eqn}`;
                        } else if (t.mode === 'normal') {
                            eqnDisplay = `x = ${formatDecimal(t.x)}`;
                        }
                    }
                    const isHighlighted = highlightedId === `tangent-${t.id}`;

                    return (
                        <div
                            key={t.id}
                            id={`sidebar-tangent-${t.id}`}
                            className={`bg-white border rounded-md p-3 shadow-sm text-sm transition-all ${isHighlighted ? 'border-amber-500 ring-2 ring-amber-200' : 'border-gray-200'}`}
                        >
                            <div className="flex items-center gap-1.5 mb-2">
                                <select 
                                    value={t.mode}
                                    onChange={(e) => onUpdateTangent(t.id, { mode: e.target.value as any })}
                                    className="text-[10px] font-bold uppercase border border-gray-300 rounded px-1.5 py-1 bg-white"
                                >
                                    <option value="tangent">Tangent</option>
                                    <option value="normal">Normal</option>
                                </select>
                                <span className="text-[10px] text-gray-400">to</span>
                                <select 
                                    value={t.functionId} 
                                    onChange={(e) => onUpdateTangent(t.id, { functionId: e.target.value })}
                                    className="flex-1 w-0 border border-gray-300 rounded px-1 py-1 text-xs font-mono"
                                >
                                    {(nonDerivedFunctions.length > 0 ? nonDerivedFunctions : eligibleFunctions).map(renderFuncOption)}
                                </select>
                                <button onClick={() => onRemoveTangent(t.id)} className="text-gray-400 hover:text-red-500 p-0.5">
                                    <Trash2 size={14} />
                                </button>
                            </div>

                            <div className="flex items-center gap-2 mb-2">
                                <span className="text-xs font-serif italic text-gray-500">at x =</span>
                                <input 
                                    type="number" step="0.25" 
                                    value={parseFloat(t.x.toFixed(4))}
                                    onChange={(e) => onUpdateTangent(t.id, { x: parseFloat(e.target.value) || 0 })}
                                    className="flex-1 border border-gray-300 rounded px-2 py-1 text-xs font-mono tabular-nums"
                                />
                                {ptDisplay && (
                                    <span className="text-[11px] font-mono text-gray-500 tabular-nums" title="Point of tangency">
                                        {ptDisplay}
                                    </span>
                                )}
                            </div>

                            {eqnDisplay && (
                                <div className="mb-2 px-2 py-1 bg-purple-50/60 border border-purple-100 rounded text-[11px] font-mono text-purple-900 flex items-center justify-between">
                                    <span>Eq: <strong>{eqnDisplay}</strong></span>
                                </div>
                            )}

                            <div className="flex items-center justify-between gap-2">
                                <div className="flex items-center gap-2">
                                    <input 
                                        type="color" value={t.color}
                                        onChange={(e) => onUpdateTangent(t.id, { color: e.target.value })}
                                        className="w-5 h-5 p-0 border border-gray-200 rounded cursor-pointer"
                                        title="Line Color"
                                    />
                                    <select 
                                        value={t.lineType} 
                                        onChange={(e) => onUpdateTangent(t.id, { lineType: e.target.value as any })}
                                        className="text-xs border border-gray-300 rounded px-1.5 py-0.5 bg-white"
                                    >
                                        <option value="solid">Solid</option>
                                        <option value="dashed">Dashed</option>
                                        <option value="dotted">Dotted</option>
                                    </select>
                                    <div className="flex items-center gap-1">
                                        <span className="text-[10px] text-gray-400">W:</span>
                                        <input 
                                            type="number" min="0.5" max="5" step="0.5"
                                            value={t.strokeWidth}
                                            onChange={(e) => onUpdateTangent(t.id, { strokeWidth: parseFloat(e.target.value) || 1.5 })}
                                            className="w-11 border border-gray-300 rounded px-1 py-0.5 text-xs text-center tabular-nums"
                                            title="Line Thickness"
                                        />
                                    </div>
                                </div>
                                <button onClick={() => onUpdateTangent(t.id, { visible: !t.visible })} className="text-gray-500 hover:text-gray-800 p-1">
                                    {t.visible ? <Eye size={14} /> : <EyeOff size={14} />}
                                </button>
                            </div>
                            
                            <div className="mt-2 pt-2 border-t border-gray-100 flex justify-between items-center">
                                <label className="flex items-center gap-1.5 text-[11px] text-gray-600 cursor-pointer">
                                    <input 
                                        type="checkbox" 
                                        checked={t.showPoint} 
                                        onChange={(e) => onUpdateTangent(t.id, { showPoint: e.target.checked })} 
                                    />
                                    Show Tangency Point
                                </label>
                                <button 
                                    onClick={() => onDecoupleTangent(t.id)} 
                                    className="text-[10px] text-purple-600 hover:text-purple-800 flex items-center gap-1 font-medium"
                                    title="Unlink equation from this tool so it becomes an independent editable function"
                                >
                                    <Link2Off size={11} /> Decouple Line
                                </button>
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>

        <div className="w-full h-px bg-gray-200"></div>

        {/* Background Image Tool */}
        <div className="space-y-3">
            <div className="flex justify-between items-center">
                <h3 className="text-xs font-semibold text-gray-800 flex items-center gap-2">
                    <ImageIcon size={14} className="text-gray-600"/>
                    Background Reference Image
                </h3>
            </div>
            
            {!bgImage ? (
                <label className="flex flex-col items-center justify-center p-3 border-2 border-dashed border-gray-200 rounded-md cursor-pointer hover:bg-gray-50 transition-colors">
                    <Upload size={18} className="text-gray-400 mb-1" />
                    <span className="text-xs text-gray-500">Click to Upload Reference Image</span>
                    <input type="file" accept="image/*" className="hidden" onChange={handleImageUpload} />
                </label>
            ) : (
                <div className="bg-white border border-gray-200 rounded-md p-3 shadow-sm text-sm space-y-2.5">
                    <div className="flex items-center justify-between">
                        <span className="text-[10px] font-bold text-gray-500 uppercase">Image Geometry (Math Units)</span>
                        <div className="flex items-center gap-1.5">
                            <button
                                onClick={() => onUpdateBgImage({
                                    ...bgImage,
                                    x: xRange[0],
                                    y: yRange[1],
                                    width: xRange[1] - xRange[0],
                                    height: yRange[1] - yRange[0]
                                })}
                                className="text-[10px] px-1.5 py-0.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded flex items-center gap-1"
                                title="Fit image to current graph window bounds"
                            >
                                <Maximize2 size={10} /> Fit Window
                            </button>
                            <button onClick={() => onUpdateBgImage(null)} className="text-red-500 hover:text-red-700 p-0.5" title="Remove Image">
                                <Trash2 size={14} />
                            </button>
                        </div>
                    </div>
                    
                    <div className="grid grid-cols-2 gap-2">
                        <div>
                            <label className="text-[10px] text-gray-500">X (Left)</label>
                            <input 
                                type="number" step="0.5" value={bgImage.x}
                                onChange={(e) => onUpdateBgImage({...bgImage, x: parseFloat(e.target.value) || 0})}
                                className="w-full border border-gray-300 rounded px-1.5 py-0.5 text-xs tabular-nums"
                            />
                        </div>
                        <div>
                            <label className="text-[10px] text-gray-500">Y (Top)</label>
                            <input 
                                type="number" step="0.5" value={bgImage.y}
                                onChange={(e) => onUpdateBgImage({...bgImage, y: parseFloat(e.target.value) || 0})}
                                className="w-full border border-gray-300 rounded px-1.5 py-0.5 text-xs tabular-nums"
                            />
                        </div>
                        <div>
                            <label className="text-[10px] text-gray-500">Width</label>
                            <input 
                                type="number" step="0.5" min="0.1" value={bgImage.width}
                                onChange={(e) => onUpdateBgImage({...bgImage, width: Math.max(0.1, parseFloat(e.target.value) || 1)})}
                                className="w-full border border-gray-300 rounded px-1.5 py-0.5 text-xs tabular-nums"
                            />
                        </div>
                        <div>
                            <label className="text-[10px] text-gray-500">Height</label>
                            <input 
                                type="number" step="0.5" min="0.1" value={bgImage.height}
                                onChange={(e) => onUpdateBgImage({...bgImage, height: Math.max(0.1, parseFloat(e.target.value) || 1)})}
                                className="w-full border border-gray-300 rounded px-1.5 py-0.5 text-xs tabular-nums"
                            />
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2 items-center pt-1">
                        <div>
                            <label className="text-[10px] text-gray-500 flex justify-between">
                                <span>Opacity</span>
                                <span>{Math.round(bgImage.opacity * 100)}%</span>
                            </label>
                            <input 
                                type="range" min="0.05" max="1" step="0.05"
                                value={bgImage.opacity}
                                onChange={(e) => onUpdateBgImage({...bgImage, opacity: parseFloat(e.target.value)})}
                                className="w-full h-1 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
                            />
                        </div>
                        <div>
                            <label className="text-[10px] text-gray-500 block">Rotation (°)</label>
                            <input 
                                type="number" step="5" value={bgImage.rotation || 0}
                                onChange={(e) => onUpdateBgImage({...bgImage, rotation: parseFloat(e.target.value) || 0})}
                                className="w-full border border-gray-300 rounded px-1.5 py-0.5 text-xs tabular-nums"
                            />
                        </div>
                    </div>
                </div>
            )}
        </div>

        <div className="w-full h-px bg-gray-200"></div>

        {/* Presets Grid */}
        <div className="space-y-3 pb-10">
            <h3 className="text-xs font-semibold text-gray-800">Quick Start Presets</h3>
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
