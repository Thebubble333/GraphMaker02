
import React from 'react';
import { FunctionDef, FeaturePoint, VerticalLineDef, PointDef, FeatureType } from '../../types';
import { Plus, Trash2, Eye, EyeOff, ChevronDown, ChevronRight, Crosshair, Lock } from 'lucide-react';
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
  onAddFunction: () => void;
  
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
}

export const FunctionList: React.FC<FunctionListProps> = ({
  functions, features, verticalLines, points,
  showExactValues, onToggleExactValues,
  onUpdateFunction, onRemoveFunction, onAddFunction,
  onUpdateFeatures,
  onUpdateDomain, onToggleDomainInclusive,
  onAddVLine, onUpdateVLine, onRemoveVLine,
  onAddPoint, onUpdatePoint, onRemovePoint,
  intersectionSelection, onToggleIntersectionSelection
}) => {
  
  const intersectionFeatures = features.filter(f => f.type === 'intersection');

  return (
    <>
      {/* Global Data Options */}
      {onToggleExactValues && (
          <div className="px-4 py-2 bg-gray-50 border-b border-gray-100">
             <label className="flex items-center gap-2 text-xs font-medium text-gray-700 cursor-pointer">
                <input 
                    type="checkbox" 
                    checked={showExactValues}
                    onChange={(e) => onToggleExactValues(e.target.checked)}
                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                Show Exact Values (π, √)
             </label>
          </div>
      )}

      {/* Functions Section */}
      <div className="border-b border-gray-200">
        <div className="p-4 bg-gray-50 border-b border-gray-100 flex justify-between items-center">
            <h2 className="text-xs font-bold text-gray-500 uppercase tracking-wider">Functions</h2>
            <button onClick={onAddFunction} className="p-1 hover:bg-gray-200 rounded text-blue-600">
                <Plus size={16} />
            </button>
        </div>
        
        <div className="p-2 space-y-2">
            {functions.map(f => {
                const funcFeatures = features.filter(ft => ft.functionId === f.id);
                const isSelectedForIntersection = intersectionSelection.includes(f.id);
                const isCollapsed = f.isCollapsed;

                return (
                <div key={f.id} className={`bg-white border rounded-md p-3 shadow-sm transition-colors ${isSelectedForIntersection ? 'border-blue-400 ring-1 ring-blue-100' : 'border-gray-200 hover:border-blue-300'}`}>
                    <div className="flex items-center gap-2">
                        <button 
                            onClick={() => onUpdateFunction(f.id, { isCollapsed: !isCollapsed })}
                            className="text-gray-400 hover:text-gray-700 p-0.5"
                        >
                            {isCollapsed ? <ChevronRight size={14} /> : <ChevronDown size={14} />}
                        </button>
                        <span className="font-serif italic text-gray-500 text-sm">f(x)=</span>
                        <div className="relative flex-1">
                            <input 
                                type="text" 
                                value={f.expression}
                                onChange={(e) => onUpdateFunction(f.id, { expression: e.target.value })}
                                placeholder="e.g. sin(x)"
                                disabled={f.locked}
                                className={`w-full min-w-0 border rounded px-2 py-1 text-sm focus:border-blue-500 focus:outline-none ${f.locked ? 'bg-gray-50 text-gray-500 border-gray-200 cursor-not-allowed' : 'border-gray-300'}`}
                            />
                            {f.locked && (
                                <Lock size={12} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400" />
                            )}
                        </div>
                        <button 
                            onClick={() => onToggleIntersectionSelection(f.id)} 
                            className={`p-1 rounded ${isSelectedForIntersection ? 'bg-blue-100 text-blue-600' : 'text-gray-300 hover:text-blue-400'}`}
                            title="Select for Intersection"
                        >
                            <Crosshair size={16} />
                        </button>
                        <button onClick={() => onUpdateFunction(f.id, { visible: !f.visible })} className="text-gray-400 hover:text-gray-600">
                            {f.visible ? <Eye size={16} /> : <EyeOff size={16} />}
                        </button>
                        <button onClick={() => onRemoveFunction(f.id)} className="text-gray-400 hover:text-red-500">
                            <Trash2 size={16} />
                        </button>
                    </div>
                    
                    {!isCollapsed && (
                        <div className="mt-3 pl-6 space-y-3">
                            {/* Standard Appearance & Domain */}
                            <div className="grid grid-cols-2 gap-2">
                                <div className="flex items-center gap-2">
                                    <input 
                                        type="color" 
                                        value={f.color}
                                        onChange={(e) => onUpdateFunction(f.id, { color: e.target.value })}
                                        className="w-8 h-8 p-0 border-0 rounded cursor-pointer shrink-0"
                                    />
                                    <div className="flex items-center gap-1">
                                        <span className="text-xs text-gray-400">Width</span>
                                        <input 
                                            type="number" 
                                            min="0.1" max="10" step="0.1" 
                                            value={f.strokeWidth}
                                            onChange={(e) => onUpdateFunction(f.id, { strokeWidth: parseFloat(e.target.value) })}
                                            className="w-12 border border-gray-300 rounded px-1 text-sm"
                                        />
                                    </div>
                                </div>
                                <div className="flex items-center gap-1 text-xs text-gray-500">
                                    {onToggleDomainInclusive && (
                                        <button 
                                            onClick={() => onToggleDomainInclusive(f.id, 0)} 
                                            className="w-4 hover:bg-gray-200 rounded text-gray-700 font-bold"
                                        >
                                            {f.domainInclusive?.[0] ? '[' : '('}
                                        </button>
                                    )}
                                    <input 
                                        type="number" placeholder="-∞"
                                        value={f.domain[0] ?? ''}
                                        onChange={(e) => onUpdateDomain(f.id, 0, e.target.value)}
                                        className="w-full border rounded px-1 py-0.5 text-center"
                                    />
                                    <span>:</span>
                                    <input 
                                        type="number" placeholder="∞"
                                        value={f.domain[1] ?? ''}
                                        onChange={(e) => onUpdateDomain(f.id, 1, e.target.value)}
                                        className="w-full border rounded px-1 py-0.5 text-center"
                                    />
                                    {onToggleDomainInclusive && (
                                        <button 
                                            onClick={() => onToggleDomainInclusive(f.id, 1)} 
                                            className="w-4 hover:bg-gray-200 rounded text-gray-700 font-bold"
                                        >
                                            {f.domainInclusive?.[1] ? ']' : ')'}
                                        </button>
                                    )}
                                </div>
                            </div>

                            <FeatureSet 
                                features={funcFeatures} 
                                onUpdate={onUpdateFeatures}
                            />
                        </div>
                    )}
                </div>
                );
            })}
        </div>

        {/* Intersection Results Section */}
        {intersectionFeatures.length > 0 && (
            <div className="p-3 bg-blue-50 border-t border-b border-blue-100">
                <FeatureSet 
                    title="Calculated Intersections"
                    features={intersectionFeatures} 
                    onUpdate={onUpdateFeatures}
                />
            </div>
        )}
      </div>

      {/* Vertical Lines Section */}
      <div className="border-b border-gray-200">
        <div className="p-4 bg-gray-50 border-b border-gray-100 flex justify-between items-center">
            <h2 className="text-xs font-bold text-gray-500 uppercase tracking-wider">Vertical Lines</h2>
            <button onClick={onAddVLine} className="p-1 hover:bg-gray-200 rounded text-blue-600">
                <Plus size={16} />
            </button>
        </div>
        <div className="p-2 space-y-2">
            {verticalLines.map(line => (
                <div key={line.id} className="bg-white border border-gray-200 rounded-md p-3 shadow-sm">
                    <div className="flex items-center gap-2 mb-2">
                        <span className="font-serif italic text-gray-500">x =</span>
                        <input 
                            type="number" 
                            value={line.x}
                            onChange={(e) => onUpdateVLine(line.id, { x: parseFloat(e.target.value) })}
                            className="flex-1 border border-gray-300 rounded px-2 py-1 text-sm"
                        />
                        <button onClick={() => onRemoveVLine(line.id)} className="text-gray-400 hover:text-red-500">
                            <Trash2 size={16} />
                        </button>
                    </div>
                    <div className="flex items-center gap-3">
                        <input 
                            type="color" 
                            value={line.color}
                            onChange={(e) => onUpdateVLine(line.id, { color: e.target.value })}
                            className="w-6 h-6 p-0 border-0 rounded cursor-pointer"
                        />
                        <select 
                            value={line.lineType} 
                            onChange={(e) => onUpdateVLine(line.id, { lineType: e.target.value as any })}
                            className="flex-1 text-xs border border-gray-300 rounded p-1"
                        >
                            <option value="solid">Solid</option>
                            <option value="dashed">Dashed</option>
                            <option value="dotted">Dotted</option>
                        </select>
                    </div>
                </div>
            ))}
        </div>
      </div>

      {/* Points Section */}
      <div className="border-b border-gray-200 pb-20">
        <div className="p-4 bg-gray-50 border-b border-gray-100 flex justify-between items-center">
            <h2 className="text-xs font-bold text-gray-500 uppercase tracking-wider">Points</h2>
            <button onClick={onAddPoint} className="p-1 hover:bg-gray-200 rounded text-blue-600">
                <Plus size={16} />
            </button>
        </div>
        <div className="p-2 space-y-2">
            {points.map(pt => (
                <div key={pt.id} className="bg-white border border-gray-200 rounded-md p-3 shadow-sm">
                    <div className="flex items-center gap-2 mb-2">
                        <span className="text-gray-500 text-xs">x:</span>
                        <input 
                            type="number" value={pt.x}
                            onChange={(e) => onUpdatePoint(pt.id, { x: parseFloat(e.target.value) })}
                            className="w-16 border border-gray-300 rounded px-1 py-1 text-sm"
                        />
                        <span className="text-gray-500 text-xs">y:</span>
                        <input 
                            type="number" value={pt.y}
                            onChange={(e) => onUpdatePoint(pt.id, { y: parseFloat(e.target.value) })}
                            className="w-16 border border-gray-300 rounded px-1 py-1 text-sm"
                        />
                        <button onClick={() => onRemovePoint(pt.id)} className="ml-auto text-gray-400 hover:text-red-500">
                            <Trash2 size={16} />
                        </button>
                    </div>
                    <div className="mb-2">
                        <input 
                            type="text" placeholder="Label (optional)"
                            value={pt.label}
                            onChange={(e) => onUpdatePoint(pt.id, { label: e.target.value })}
                            className="w-full border border-gray-300 rounded px-2 py-1 text-sm"
                        />
                    </div>
                    <div className="flex items-center gap-3">
                        <input 
                            type="color" 
                            value={pt.color}
                            onChange={(e) => onUpdatePoint(pt.id, { color: e.target.value })}
                            className="w-6 h-6 p-0 border-0 rounded cursor-pointer"
                        />
                        <select 
                            value={pt.style} 
                            onChange={(e) => onUpdatePoint(pt.id, { style: e.target.value as any })}
                            className="flex-1 text-xs border border-gray-300 rounded p-1"
                        >
                            <option value="filled">Filled</option>
                            <option value="hollow">Hollow</option>
                        </select>
                    </div>
                </div>
            ))}
        </div>
      </div>
    </>
  );
};
