
import React from 'react';
import { InequalityDef, FeaturePoint, InequalityType } from '../../types';
import { Plus, Trash2, Eye, EyeOff, RefreshCcw, Type } from 'lucide-react';

interface InequalityListProps {
  inequalities: InequalityDef[];
  vertices: FeaturePoint[];
  onUpdate: (id: string, updates: Partial<InequalityDef>) => void;
  onRemove: (id: string) => void;
  onAdd: () => void;
  showIntersection: boolean;
  onToggleIntersection: (val: boolean) => void;
  showFullBoundary: boolean;
  onToggleFullBoundary: (val: boolean) => void;
  onToggleVertex: (id: string) => void;
  onToggleVertexLabel: (id: string) => void;
  onResetVertex: (id: string) => void;
}

export const InequalityList: React.FC<InequalityListProps> = ({
  inequalities, vertices, onUpdate, onRemove, onAdd, showIntersection, onToggleIntersection,
  showFullBoundary, onToggleFullBoundary, onToggleVertex, onToggleVertexLabel, onResetVertex
}) => {
  return (
    <div className="border-b border-gray-200">
        <div className="p-4 bg-gray-50 border-b border-gray-100 flex justify-between items-center">
            <h2 className="text-xs font-bold text-gray-500 uppercase tracking-wider">Inequalities</h2>
            <button onClick={onAdd} className="p-1 hover:bg-gray-200 rounded text-purple-600">
                <Plus size={16} />
            </button>
        </div>
        
        <div className="px-4 py-3 bg-gray-50 border-b border-gray-100 space-y-3">
             <label className="flex items-center gap-2 text-xs text-gray-700 cursor-pointer">
                <input 
                    type="checkbox" checked={showIntersection}
                    onChange={(e) => onToggleIntersection(e.target.checked)}
                    className="rounded border-gray-300 text-purple-600 focus:ring-purple-500"
                />
                Show Intersection Region Only
            </label>
            {showIntersection && (
                <label className="flex items-center gap-2 text-xs text-gray-700 cursor-pointer">
                    <input 
                        type="checkbox" checked={!showFullBoundary}
                        onChange={(e) => onToggleFullBoundary(!e.target.checked)}
                        className="rounded border-gray-300 text-purple-600 focus:ring-purple-500"
                    />
                    Clip Boundaries to Perimeter
                </label>
            )}
        </div>
        
        <div className="p-2 space-y-2">
            {inequalities.map(ineq => (
                <div key={ineq.id} className="bg-white border border-gray-200 rounded-md p-3 shadow-sm hover:border-purple-300 transition-colors">
                    <div className="flex items-center gap-2 mb-2">
                        <select 
                            value={ineq.type}
                            onChange={(e) => onUpdate(ineq.id, { type: e.target.value as InequalityType })}
                            className="bg-gray-50 border border-gray-300 rounded text-[10px] font-bold px-1 py-1 shrink-0 uppercase tracking-tight"
                        >
                            <option value="y">y</option>
                            <option value="x">x</option>
                            <option value="linear">ADV</option>
                        </select>
                        {ineq.type !== 'linear' && (
                            <select 
                                value={ineq.operator}
                                onChange={(e) => onUpdate(ineq.id, { operator: e.target.value as any })}
                                className="bg-gray-50 border border-gray-300 rounded text-sm font-mono px-1 py-1 shrink-0"
                            >
                                <option value="<">&lt;</option>
                                <option value="<=">≤</option>
                                <option value=">">&gt;</option>
                                <option value=">=">≥</option>
                            </select>
                        )}
                        <input 
                            type="text" 
                            value={ineq.expression}
                            onChange={(e) => onUpdate(ineq.id, { expression: e.target.value })}
                            placeholder={ineq.type === 'linear' ? 'm < ax+by < n' : ineq.type === 'x' ? 'constant' : 'f(x)'}
                            className="flex-1 min-w-0 border border-gray-300 rounded px-2 py-1 text-sm focus:border-purple-500 focus:outline-none"
                        />
                        <button onClick={() => onUpdate(ineq.id, { visible: !ineq.visible })} className="text-gray-400 hover:text-gray-600 shrink-0">
                            {ineq.visible ? <Eye size={16} /> : <EyeOff size={16} />}
                        </button>
                        <button onClick={() => onRemove(ineq.id)} className="text-gray-400 hover:text-red-500 shrink-0">
                            <Trash2 size={16} />
                        </button>
                    </div>
                    <div className="flex items-center gap-3">
                        <input 
                            type="color" value={ineq.color}
                            onChange={(e) => onUpdate(ineq.id, { color: e.target.value })}
                            className="w-8 h-8 p-0 border-0 rounded cursor-pointer shrink-0"
                            disabled={showIntersection}
                            style={{ opacity: showIntersection ? 0.3 : 1 }}
                        />
                        <span className="text-[10px] text-gray-400 italic">
                            {ineq.type === 'linear' ? 'Sandwich / Linear Mode' : ['<', '>'].includes(ineq.operator) ? 'Dashed Boundary' : 'Solid Boundary'}
                        </span>
                    </div>
                </div>
            ))}
        </div>

        {showIntersection && vertices.length > 0 && (
            <div className="p-4 bg-gray-50 border-t border-gray-200">
                <h3 className="text-[10px] font-bold text-gray-400 uppercase mb-2">Region Corners</h3>
                <div className="space-y-1">
                    {vertices.map(v => (
                        <div key={v.id} className="flex items-center justify-between text-xs bg-white border border-gray-100 p-1 rounded group">
                            <span className="font-mono text-gray-600 truncate flex-1">{v.label}</span>
                            <div className="flex items-center gap-1.5 opacity-40 group-hover:opacity-100 transition-opacity">
                                <button onClick={() => onResetVertex(v.id)} className="text-gray-400 hover:text-blue-500">
                                    <RefreshCcw size={10} />
                                </button>
                                <button onClick={() => onToggleVertexLabel(v.id)} className={`${v.showLabel ? 'text-purple-500' : 'text-gray-300'} hover:text-purple-700`}>
                                    <Type size={12} />
                                </button>
                                <button onClick={() => onToggleVertex(v.id)} className={`${v.visible ? 'text-blue-500' : 'text-gray-300'} hover:text-blue-700`}>
                                    {v.visible ? <Eye size={12} /> : <EyeOff size={12} />}
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        )}
    </div>
  );
};
