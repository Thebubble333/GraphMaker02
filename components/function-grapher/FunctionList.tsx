
import React from 'react';
import * as math from 'mathjs';
import { FunctionDef, FeaturePoint, VerticalLineDef, PointDef } from '../../types';
import { preprocessMathExpression } from '../../utils/mathAnalysis';
import { Plus, Trash2, Eye, EyeOff, ChevronDown, ChevronRight, Crosshair, Lock, AlertCircle } from 'lucide-react';
import { FeatureSet } from './FeatureSet';

interface FunctionListProps {
  functions: FunctionDef[];
  features: FeaturePoint[];
  verticalLines: VerticalLineDef[];
  points: PointDef[];
  
  // Exact Values
  showExactValues?: boolean;
  onToggleExactValues?: (val: boolean) => void;

  onUpdateFunction: (id: string, updates: Partial<FunctionDef>) => void;
  onRemoveFunction: (id: string) => void;
  onAddFunction: (type?: 'function' | 'parameter' | 'parametric') => void;
  
  onUpdateFeatures: (ids: string[], updates: Partial<FeaturePoint>) => void;
  
  onUpdateDomain: (id: string, index: 0 | 1, val: string) => void;
  onToggleDomainInclusive?: (id: string, index: 0 | 1) => void;
  
  // V-Line & Point Props
  onAddVLine: () => void;
  onUpdateVLine: (id: string, updates: Partial<VerticalLineDef>) => void;
  onRemoveVLine: (id: string) => void;
  onAddPoint: () => void;
  onUpdatePoint: (id: string, updates: Partial<PointDef>) => void;
  onRemovePoint: (id: string) => void;

  // Intersection Selection
  intersectionSelection: string[];
  onToggleIntersectionSelection: (id: string) => void;

  // Optional highlight for context-menu jump
  highlightedId?: string | null;
}

const isExpressionValid = (expr: string): boolean => {
    if (!expr || !expr.trim()) return true;
    try {
        const { plotExpression } = preprocessMathExpression(expr);
        if (!plotExpression.trim()) return false;
        math.compile(plotExpression);
        return true;
    } catch {
        return false;
    }
};

export const FunctionList: React.FC<FunctionListProps> = ({
  functions, features, verticalLines, points,
  showExactValues, onToggleExactValues,
  onUpdateFunction, onRemoveFunction, onAddFunction,
  onUpdateFeatures,
  onUpdateDomain, onToggleDomainInclusive,
  onAddVLine, onUpdateVLine, onRemoveVLine,
  onAddPoint, onUpdatePoint, onRemovePoint,
  intersectionSelection, onToggleIntersectionSelection,
  highlightedId
}) => {
  
  const intersectionFeatures = features.filter(f => f.type === 'intersection');

  const parameters = functions.filter(f => {
      const paramMatch = f.expression.match(/^([a-zA-Z_][a-zA-Z0-9_]*)\s*=\s*(-?\d*\.?\d*)$/);
      return f.type === 'parameter' || (!!paramMatch && paramMatch[1] !== 'y' && paramMatch[1] !== 'x' && paramMatch[1] !== 'f' && paramMatch[1] !== 'g');
  });
  const parametricCurves = functions.filter(f => f.isParametric && !parameters.includes(f));
  const regularFunctions = functions.filter(f => !parameters.includes(f) && !parametricCurves.includes(f));

  const renderFunctionCard = (f: FunctionDef, index: number) => {
      const funcFeatures = features.filter(ft => ft.functionId === f.id);
      const isSelectedForIntersection = intersectionSelection.includes(f.id);
      const isCollapsed = f.isCollapsed;
      const isHighlighted = highlightedId === `func-${f.id}`;
      
      const paramMatch = f.expression.match(/^([a-zA-Z_][a-zA-Z0-9_]*)\s*=\s*(-?\d*\.?\d*)$/);
      const isParameter = f.type === 'parameter' || (!!paramMatch && paramMatch[1] !== 'y' && paramMatch[1] !== 'x' && paramMatch[1] !== 'f' && paramMatch[1] !== 'g');

      const exprValid = isParameter ? true : isExpressionValid(f.expression) && (!f.isParametric || isExpressionValid(f.yExpression || '0'));
      const funcLabel = f.locked ? 'y =' : (index === 0 ? 'f(x)=' : index === 1 ? 'g(x)=' : index === 2 ? 'h(x)=' : `f${index+1}(x)=`);

      return (
      <div
          key={f.id}
          id={`sidebar-func-${f.id}`}
          className={`bg-white border rounded-md p-3 shadow-sm transition-all ${
              isHighlighted
                  ? 'border-amber-500 ring-2 ring-amber-200 bg-amber-50/20'
                  : isSelectedForIntersection
                      ? 'border-blue-400 ring-1 ring-blue-100'
                      : 'border-gray-200 hover:border-blue-300'
          }`}
      >
          <div className="flex items-center gap-1.5">
              {!isParameter && (
                  <button 
                      onClick={() => onUpdateFunction(f.id, { isCollapsed: !isCollapsed })}
                      className="text-gray-400 hover:text-gray-700 p-0.5 shrink-0"
                      title={isCollapsed ? "Expand style & features" : "Collapse details"}
                  >
                      {isCollapsed ? <ChevronRight size={14} /> : <ChevronDown size={14} />}
                  </button>
              )}
              <div className="flex-1 min-w-0 flex flex-col gap-1">
                  {f.isParametric ? (
                      <>
                          <div className="flex items-center gap-1.5">
                              <span className="font-serif italic text-gray-500 text-xs w-9 shrink-0">x(t)=</span>
                              <input 
                                  type="text" 
                                  value={f.expression}
                                  onChange={(e) => onUpdateFunction(f.id, { expression: e.target.value })}
                                  placeholder="e.g. cos(t)"
                                  className="w-full min-w-0 border border-gray-300 rounded px-2 py-1 text-sm font-mono focus:border-blue-500 focus:outline-none"
                              />
                          </div>
                          <div className="flex items-center gap-1.5">
                              <span className="font-serif italic text-gray-500 text-xs w-9 shrink-0">y(t)=</span>
                              <input 
                                  type="text" 
                                  value={f.yExpression || ''}
                                  onChange={(e) => onUpdateFunction(f.id, { yExpression: e.target.value })}
                                  placeholder="e.g. sin(t)"
                                  className="w-full min-w-0 border border-gray-300 rounded px-2 py-1 text-sm font-mono focus:border-blue-500 focus:outline-none"
                              />
                          </div>
                      </>
                  ) : (
                      (() => {
                          if (isParameter) {
                              const paramName = paramMatch ? paramMatch[1] : f.expression.split('=')[0].trim();
                              const rawVal = paramMatch ? parseFloat(paramMatch[2]) : parseFloat(f.expression.split('=')[1] || '0');
                              const paramValue = isNaN(rawVal) ? 0 : rawVal;
                              const min = f.sliderMin ?? -10;
                              const max = f.sliderMax ?? 10;
                              const step = f.sliderStep ?? 0.1;

                              return (
                                  <div className="flex flex-col gap-2">
                                      <div className="flex items-center justify-between gap-2">
                                          <div className="flex items-center gap-1.5">
                                              <span className="font-serif italic font-semibold text-gray-700 text-sm">{paramName} =</span>
                                              <input 
                                                  type="number" 
                                                  step={step}
                                                  value={paramValue}
                                                  onChange={(e) => onUpdateFunction(f.id, { type: 'parameter', expression: `${paramName} = ${e.target.value}` })}
                                                  className="w-20 border border-gray-300 rounded px-2 py-0.5 text-sm font-mono tabular-nums focus:border-blue-500 focus:outline-none"
                                              />
                                          </div>
                                          <div className="flex items-center gap-1 text-[10px] text-gray-400">
                                              <span>Step:</span>
                                              <input
                                                  type="number"
                                                  step="0.05"
                                                  min="0.01"
                                                  value={step}
                                                  onChange={(e) => onUpdateFunction(f.id, { type: 'parameter', sliderStep: parseFloat(e.target.value) || 0.1 })}
                                                  className="w-12 border border-gray-200 rounded px-1 py-0.5 text-[10px] text-center text-gray-600"
                                              />
                                          </div>
                                      </div>
                                      <div className="flex items-center gap-2">
                                          <input 
                                              type="number" 
                                              value={min}
                                              onChange={(e) => onUpdateFunction(f.id, { type: 'parameter', sliderMin: parseFloat(e.target.value) })}
                                              className="w-11 border border-gray-300 rounded px-1 py-0.5 text-[11px] text-center tabular-nums"
                                              title="Slider Min"
                                          />
                                          <input 
                                              type="range" 
                                              min={min} 
                                              max={max} 
                                              step={step}
                                              value={paramValue}
                                              onChange={(e) => onUpdateFunction(f.id, { type: 'parameter', expression: `${paramName} = ${e.target.value}` })}
                                              className="flex-1 accent-blue-600 cursor-pointer"
                                          />
                                          <input 
                                              type="number" 
                                              value={max}
                                              onChange={(e) => onUpdateFunction(f.id, { type: 'parameter', sliderMax: parseFloat(e.target.value) })}
                                              className="w-11 border border-gray-300 rounded px-1 py-0.5 text-[11px] text-center tabular-nums"
                                              title="Slider Max"
                                          />
                                      </div>
                                  </div>
                              );
                          }

                          return (
                              <div className="flex items-center gap-1.5">
                                  <span className="font-serif italic text-gray-500 text-xs shrink-0">{funcLabel}</span>
                                  <div className="relative flex-1 min-w-0">
                                      <input 
                                          type="text" 
                                          value={f.expression}
                                          onChange={(e) => onUpdateFunction(f.id, { expression: e.target.value })}
                                          placeholder="e.g. sin(x), |x^2-4|, ln(x)"
                                          disabled={f.locked}
                                          className={`w-full min-w-0 border rounded px-2 py-1 text-sm font-mono focus:outline-none ${
                                              !exprValid
                                                  ? 'border-red-300 bg-red-50/30 focus:border-red-500'
                                                  : f.locked
                                                      ? 'bg-gray-50 text-gray-500 border-gray-200 cursor-not-allowed pr-6'
                                                      : 'border-gray-300 focus:border-blue-500'
                                          }`}
                                      />
                                      {f.locked && (
                                          <Lock size={12} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400" title="Locked to Tangent/Normal tool" />
                                      )}
                                  </div>
                              </div>
                          );
                      })()
                  )}
                  {!exprValid && (
                      <div className="flex items-center gap-1 text-[10px] text-red-600 mt-0.5">
                          <AlertCircle size={11} />
                          <span>Check expression syntax (e.g. matching parentheses)</span>
                      </div>
                  )}
              </div>
              {!isParameter && !f.isParametric && (
                  <button 
                      onClick={() => onToggleIntersectionSelection(f.id)} 
                      className={`p-1 rounded shrink-0 transition-colors ${isSelectedForIntersection ? 'bg-blue-100 text-blue-600 ring-1 ring-blue-300' : 'text-gray-300 hover:text-blue-500 hover:bg-gray-50'}`}
                      title={isSelectedForIntersection ? "Selected for Intersection (Select 2 functions)" : "Select to find intersections with another function"}
                  >
                      <Crosshair size={15} />
                  </button>
              )}
              {!isParameter && (
                  <button
                      onClick={() => onUpdateFunction(f.id, { visible: !f.visible })}
                      className={`p-1 rounded shrink-0 ${f.visible ? 'text-gray-600 hover:text-gray-900' : 'text-gray-300 hover:text-gray-500'}`}
                      title={f.visible ? "Hide curve" : "Show curve"}
                  >
                      {f.visible ? <Eye size={15} /> : <EyeOff size={15} />}
                  </button>
              )}
              <button
                  onClick={() => onRemoveFunction(f.id)}
                  className="text-gray-400 hover:text-red-500 p-1 rounded shrink-0"
                  title="Delete"
              >
                  <Trash2 size={15} />
              </button>
          </div>
          
          {!isCollapsed && !isParameter && (
              <div className="mt-3 pl-5 space-y-2.5 border-t border-gray-100 pt-2.5">
                  {/* Row 1: Color, Line Type, Stroke Width */}
                  <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                          <input 
                              type="color" 
                              value={f.color}
                              onChange={(e) => onUpdateFunction(f.id, { color: e.target.value })}
                              className="w-6 h-6 p-0 border border-gray-200 rounded cursor-pointer shrink-0"
                              title="Curve Color"
                          />
                          <select
                              value={f.lineType || 'solid'}
                              onChange={(e) => onUpdateFunction(f.id, { lineType: e.target.value as any })}
                              className="border border-gray-300 rounded px-1.5 py-0.5 text-xs bg-white text-gray-700"
                              title="Line Style"
                          >
                              <option value="solid">Solid</option>
                              <option value="dashed">Dashed</option>
                              <option value="dotted">Dotted</option>
                          </select>
                      </div>
                      <div className="flex items-center gap-1">
                          <span className="text-[11px] text-gray-500">Width</span>
                          <input 
                              type="number" 
                              min="0.5" max="10" step="0.5" 
                              value={f.strokeWidth}
                              onChange={(e) => onUpdateFunction(f.id, { strokeWidth: parseFloat(e.target.value) || 2 })}
                              className="w-12 border border-gray-300 rounded px-1 py-0.5 text-xs text-center tabular-nums"
                          />
                      </div>
                  </div>

                  {/* Row 2: Domain / Parameter Range & Plotter Mode */}
                  <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-1 text-xs text-gray-600 flex-1">
                          <span className="text-[11px] font-serif italic text-gray-500 shrink-0 mr-0.5">
                              {f.isParametric ? 't ∈' : 'x ∈'}
                          </span>
                          {!f.isParametric && onToggleDomainInclusive ? (
                              <button 
                                  onClick={() => onToggleDomainInclusive(f.id, 0)} 
                                  className="w-4 h-6 flex items-center justify-center bg-gray-100 hover:bg-gray-200 rounded text-gray-700 font-mono font-bold text-xs shrink-0"
                                  title={f.domainInclusive?.[0] ? "Inclusive lower bound [ (Filled endpoint)" : "Exclusive lower bound ( (Hollow endpoint)"}
                              >
                                  {f.domainInclusive?.[0] ? '[' : '('}
                              </button>
                          ) : (
                              <span className="text-gray-400 font-mono">[</span>
                          )}
                          <input 
                              type="text"
                              placeholder={f.isParametric ? "0" : "-∞"}
                              value={f.domain[0]}
                              onChange={(e) => onUpdateDomain(f.id, 0, e.target.value)}
                              className="w-full min-w-0 border border-gray-300 rounded px-1 py-0.5 text-center font-mono text-xs"
                              title={f.isParametric ? "Start t value (default: 0)" : "Minimum x domain (e.g. -pi, 0)"}
                          />
                          <span className="text-gray-400">,</span>
                          <input 
                              type="text"
                              placeholder={f.isParametric ? "2pi" : "∞"}
                              value={f.domain[1]}
                              onChange={(e) => onUpdateDomain(f.id, 1, e.target.value)}
                              className="w-full min-w-0 border border-gray-300 rounded px-1 py-0.5 text-center font-mono text-xs"
                              title={f.isParametric ? "End t value (default: 2pi)" : "Maximum x domain (e.g. pi, 5)"}
                          />
                          {!f.isParametric && onToggleDomainInclusive ? (
                              <button 
                                  onClick={() => onToggleDomainInclusive(f.id, 1)} 
                                  className="w-4 h-6 flex items-center justify-center bg-gray-100 hover:bg-gray-200 rounded text-gray-700 font-mono font-bold text-xs shrink-0"
                                  title={f.domainInclusive?.[1] ? "Inclusive upper bound ] (Filled endpoint)" : "Exclusive upper bound ) (Hollow endpoint)"}
                              >
                                  {f.domainInclusive?.[1] ? ']' : ')'}
                              </button>
                          ) : (
                              <span className="text-gray-400 font-mono">]</span>
                          )}
                      </div>

                      {!f.isParametric && (
                          <select
                              value={f.plotterType || 'experimental'}
                              onChange={(e) => onUpdateFunction(f.id, { plotterType: e.target.value as any })}
                              className="border border-gray-200 rounded px-1 py-0.5 text-[10px] text-gray-500 bg-gray-50 shrink-0"
                              title="Curve rendering engine: Smooth Bezier splines or dense Polyline"
                          >
                              <option value="experimental">Spline</option>
                              <option value="standard">Linear</option>
                          </select>
                      )}
                  </div>

                  <FeatureSet 
                      features={funcFeatures} 
                      onUpdate={onUpdateFeatures}
                  />
              </div>
          )}
      </div>
      );
  };

  return (
    <>
      {/* Global Data Options */}
      {onToggleExactValues && (
          <div className="px-4 py-2.5 bg-gray-50 border-b border-gray-200 flex items-center justify-between">
             <label className="flex items-center gap-2 text-xs font-medium text-gray-700 cursor-pointer select-none">
                <input 
                    type="checkbox" 
                    checked={showExactValues}
                    onChange={(e) => onToggleExactValues(e.target.checked)}
                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                <span>Show Exact Values (π, √, fractions)</span>
             </label>
          </div>
      )}

      {/* Functions Section (Primary workflow first) */}
      <div className="border-b border-gray-200">
        <div className="px-4 py-3 bg-gray-50 border-b border-gray-100 flex justify-between items-center">
            <div>
                <h2 className="text-xs font-bold text-gray-600 uppercase tracking-wider">Functions y = f(x)</h2>
                {regularFunctions.length >= 2 && (
                    <span className="text-[10px] text-gray-400 block mt-0.5">
                        Click <Crosshair size={10} className="inline text-blue-500" /> on any 2 functions to find intersections
                    </span>
                )}
            </div>
            <button
                onClick={() => onAddFunction('function')}
                className="flex items-center gap-1 px-2 py-1 bg-blue-50 hover:bg-blue-100 text-blue-600 rounded text-xs font-medium transition-colors"
            >
                <Plus size={14} /> Add
            </button>
        </div>
        
        <div className="p-2.5 space-y-2">
            {regularFunctions.map((f, idx) => renderFunctionCard(f, idx))}
            {regularFunctions.length === 0 && (
                <div className="text-xs text-gray-400 text-center p-3 italic">No functions added</div>
            )}
        </div>

        {/* Intersection Results Section */}
        {intersectionSelection.length === 2 && (
            <div className="p-3 bg-blue-50/70 border-t border-blue-100">
                {intersectionFeatures.length > 0 ? (
                    <FeatureSet 
                        title={`Intersections (${intersectionFeatures.length})`}
                        features={intersectionFeatures} 
                        onUpdate={onUpdateFeatures}
                    />
                ) : (
                    <div className="text-xs text-blue-600 text-center py-1 italic">
                        No intersections found in current window
                    </div>
                )}
            </div>
        )}
      </div>

      {/* Parameters Section */}
      <div className="border-b border-gray-200">
        <div className="px-4 py-3 bg-gray-50 border-b border-gray-100 flex justify-between items-center">
            <div>
                <h2 className="text-xs font-bold text-gray-600 uppercase tracking-wider">Parameters</h2>
                <span className="text-[10px] text-gray-400 block">Interactive constants (e.g. a, b, k)</span>
            </div>
            <button
                onClick={() => onAddFunction('parameter')}
                className="flex items-center gap-1 px-2 py-1 hover:bg-gray-200 text-blue-600 rounded text-xs font-medium transition-colors"
            >
                <Plus size={14} /> Add
            </button>
        </div>
        <div className="p-2.5 space-y-2">
            {parameters.map((p, idx) => renderFunctionCard(p, idx))}
            {parameters.length === 0 && (
                <div className="text-xs text-gray-400 text-center p-2 italic">No parameters added</div>
            )}
        </div>
      </div>

      {/* Parametric Curves Section */}
      <div className="border-b border-gray-200">
        <div className="px-4 py-3 bg-gray-50 border-b border-gray-100 flex justify-between items-center">
            <div>
                <h2 className="text-xs font-bold text-gray-600 uppercase tracking-wider">Parametric Curves</h2>
                <span className="text-[10px] text-gray-400 block">x(t), y(t) curves</span>
            </div>
            <button
                onClick={() => onAddFunction('parametric')}
                className="flex items-center gap-1 px-2 py-1 hover:bg-gray-200 text-blue-600 rounded text-xs font-medium transition-colors"
            >
                <Plus size={14} /> Add
            </button>
        </div>
        <div className="p-2.5 space-y-2">
            {parametricCurves.map((c, idx) => renderFunctionCard(c, idx))}
            {parametricCurves.length === 0 && (
                <div className="text-xs text-gray-400 text-center p-2 italic">No parametric curves added</div>
            )}
        </div>
      </div>

      {/* Vertical Lines Section */}
      <div className="border-b border-gray-200">
        <div className="px-4 py-3 bg-gray-50 border-b border-gray-100 flex justify-between items-center">
            <h2 className="text-xs font-bold text-gray-600 uppercase tracking-wider">Vertical Lines (x = c)</h2>
            <button
                onClick={onAddVLine}
                className="flex items-center gap-1 px-2 py-1 hover:bg-gray-200 text-blue-600 rounded text-xs font-medium transition-colors"
            >
                <Plus size={14} /> Add
            </button>
        </div>
        <div className="p-2.5 space-y-2">
            {verticalLines.map(line => (
                <div
                    key={line.id}
                    id={`sidebar-vline-${line.id}`}
                    className={`bg-white border rounded-md p-3 shadow-sm transition-all ${highlightedId === `vline-${line.id}` ? 'border-amber-500 ring-2 ring-amber-200' : 'border-gray-200'}`}
                >
                    <div className="flex items-center gap-2 mb-2">
                        <span className="font-serif italic text-gray-500 text-sm">x =</span>
                        <input 
                            type="text" 
                            value={line.x}
                            onChange={(e) => onUpdateVLine(line.id, { x: e.target.value })}
                            placeholder="e.g. 2 or pi/2"
                            className="flex-1 border border-gray-300 rounded px-2 py-1 text-sm font-mono"
                        />
                        <button
                            onClick={() => onUpdateVLine(line.id, { visible: !line.visible })}
                            className={`p-1 rounded ${line.visible ? 'text-gray-600 hover:text-gray-900' : 'text-gray-300 hover:text-gray-500'}`}
                            title={line.visible ? "Hide line" : "Show line"}
                        >
                            {line.visible ? <Eye size={15} /> : <EyeOff size={15} />}
                        </button>
                        <button onClick={() => onRemoveVLine(line.id)} className="text-gray-400 hover:text-red-500 p-1">
                            <Trash2 size={15} />
                        </button>
                    </div>
                    <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                            <input 
                                type="color" 
                                value={line.color}
                                onChange={(e) => onUpdateVLine(line.id, { color: e.target.value })}
                                className="w-6 h-6 p-0 border border-gray-200 rounded cursor-pointer shrink-0"
                            />
                            <select 
                                value={line.lineType} 
                                onChange={(e) => onUpdateVLine(line.id, { lineType: e.target.value as any })}
                                className="text-xs border border-gray-300 rounded px-1.5 py-0.5 bg-white"
                            >
                                <option value="solid">Solid</option>
                                <option value="dashed">Dashed</option>
                                <option value="dotted">Dotted</option>
                            </select>
                        </div>
                        <div className="flex items-center gap-1">
                            <span className="text-[11px] text-gray-500">Width</span>
                            <input
                                type="number"
                                min="0.5" max="8" step="0.5"
                                value={line.strokeWidth}
                                onChange={(e) => onUpdateVLine(line.id, { strokeWidth: parseFloat(e.target.value) || 1.5 })}
                                className="w-12 border border-gray-300 rounded px-1 py-0.5 text-xs text-center tabular-nums"
                            />
                        </div>
                    </div>
                </div>
            ))}
            {verticalLines.length === 0 && (
                <div className="text-xs text-gray-400 text-center p-2 italic">No vertical lines added</div>
            )}
        </div>
      </div>

      {/* Points Section */}
      <div className="border-b border-gray-200 pb-20">
        <div className="px-4 py-3 bg-gray-50 border-b border-gray-100 flex justify-between items-center">
            <h2 className="text-xs font-bold text-gray-600 uppercase tracking-wider">Custom Points (x, y)</h2>
            <button
                onClick={onAddPoint}
                className="flex items-center gap-1 px-2 py-1 hover:bg-gray-200 text-blue-600 rounded text-xs font-medium transition-colors"
            >
                <Plus size={14} /> Add
            </button>
        </div>
        <div className="p-2.5 space-y-2">
            {points.map(pt => (
                <div
                    key={pt.id}
                    id={`sidebar-point-${pt.id}`}
                    className={`bg-white border rounded-md p-3 shadow-sm transition-all ${highlightedId === `point-${pt.id}` ? 'border-amber-500 ring-2 ring-amber-200' : 'border-gray-200'}`}
                >
                    <div className="flex items-center gap-1.5 mb-2">
                        <span className="text-gray-500 font-serif italic text-xs">x:</span>
                        <input 
                            type="text" value={pt.x}
                            onChange={(e) => onUpdatePoint(pt.id, { x: e.target.value })}
                            className="w-16 border border-gray-300 rounded px-1.5 py-1 text-xs font-mono"
                        />
                        <span className="text-gray-500 font-serif italic text-xs ml-1">y:</span>
                        <input 
                            type="text" value={pt.y}
                            onChange={(e) => onUpdatePoint(pt.id, { y: e.target.value })}
                            className="w-16 border border-gray-300 rounded px-1.5 py-1 text-xs font-mono"
                        />
                        <button
                            onClick={() => onUpdatePoint(pt.id, { visible: !pt.visible })}
                            className={`ml-auto p-1 rounded ${pt.visible ? 'text-gray-600 hover:text-gray-900' : 'text-gray-300 hover:text-gray-500'}`}
                            title={pt.visible ? "Hide point" : "Show point"}
                        >
                            {pt.visible ? <Eye size={15} /> : <EyeOff size={15} />}
                        </button>
                        <button onClick={() => onRemovePoint(pt.id)} className="text-gray-400 hover:text-red-500 p-1">
                            <Trash2 size={15} />
                        </button>
                    </div>
                    <div className="mb-2">
                        <input 
                            type="text" placeholder="Label (e.g. A(2, 3) or P)"
                            value={pt.label}
                            onChange={(e) => onUpdatePoint(pt.id, { label: e.target.value })}
                            className="w-full border border-gray-300 rounded px-2 py-1 text-xs"
                        />
                    </div>
                    <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                            <input 
                                type="color" 
                                value={pt.color}
                                onChange={(e) => onUpdatePoint(pt.id, { color: e.target.value })}
                                className="w-6 h-6 p-0 border border-gray-200 rounded cursor-pointer shrink-0"
                            />
                            <select 
                                value={pt.style} 
                                onChange={(e) => onUpdatePoint(pt.id, { style: e.target.value as any })}
                                className="text-xs border border-gray-300 rounded px-1.5 py-0.5 bg-white"
                            >
                                <option value="filled">Filled (●)</option>
                                <option value="hollow">Hollow (○)</option>
                            </select>
                        </div>
                        <div className="flex items-center gap-1">
                            <span className="text-[11px] text-gray-500">Radius</span>
                            <input
                                type="number"
                                min="1.5" max="10" step="0.5"
                                value={pt.size}
                                onChange={(e) => onUpdatePoint(pt.id, { size: parseFloat(e.target.value) || 4 })}
                                className="w-12 border border-gray-300 rounded px-1 py-0.5 text-xs text-center tabular-nums"
                            />
                        </div>
                    </div>
                </div>
            ))}
            {points.length === 0 && (
                <div className="text-xs text-gray-400 text-center p-2 italic">No custom points added</div>
            )}
        </div>
      </div>
    </>
  );
};
