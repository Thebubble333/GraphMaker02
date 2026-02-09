
import React, { useState, useEffect } from 'react';
import { FeaturePoint, FeatureType } from '../../types';
import { formatDecimal } from '../../utils/mathFormatting';
import { getDefaultOffset } from '../../utils/mathAnalysis';
import { Eye, EyeOff, RefreshCcw, Type, Square, CheckSquare, Pi } from 'lucide-react';

interface FeatureSetProps {
  features: FeaturePoint[];
  onUpdate: (ids: string[], updates: Partial<FeaturePoint>) => void;
  title?: string;
}

const FEATURE_ORDER: { type: FeatureType; label: string }[] = [
    { type: 'endpoint', label: 'Endpoints' },
    { type: 'root', label: 'Roots (X-Int)' },
    { type: 'y-intercept', label: 'Y-Intercept' },
    { type: 'extremum', label: 'Turning Points' },
    { type: 'inflection', label: 'Inflection Pts' },
    { type: 'intersection', label: 'Intersections' },
    { type: 'vertical-asymptote', label: 'Vert. Asymptotes' },
    { type: 'horizontal-asymptote', label: 'Horiz. Asymptotes' }
];

export const FeatureSet: React.FC<FeatureSetProps> = ({ features, onUpdate, title }) => {
  const [selection, setSelection] = useState<Set<string>>(new Set());

  // If features change (e.g. func changed), clear selection of non-existent items
  useEffect(() => {
    setSelection(prev => {
        const next = new Set<string>();
        prev.forEach(id => {
            if (features.some(f => f.id === id)) next.add(id);
        });
        return next;
    });
  }, [features]);

  const toggleSelect = (id: string, multi: boolean) => {
    setSelection(prev => {
        const next = new Set(multi ? prev : []);
        if (next.has(id)) next.delete(id);
        else next.add(id);
        return next;
    });
  };

  const selectGroup = (ids: string[], select: boolean) => {
      setSelection(prev => {
          const next = new Set(prev);
          ids.forEach(id => select ? next.add(id) : next.delete(id));
          return next;
      });
  };

  const handleBulkUpdate = (updates: Partial<FeaturePoint>) => {
      if (selection.size === 0) return;
      onUpdate(Array.from(selection), updates);
  };

  const grouped: Record<string, FeaturePoint[]> = {};
  FEATURE_ORDER.forEach(g => grouped[g.type] = []);
  features.forEach(f => {
      if (grouped[f.type]) grouped[f.type].push(f);
  });

  if (features.length === 0) return null;

  return (
    <div className="mt-2 pt-2 border-t border-gray-100">
        {title && <h4 className="text-[10px] font-bold text-gray-500 uppercase mb-2">{title}</h4>}
        
        {/* Bulk Editing Toolbar */}
        {selection.size > 0 && (
            <div className="bg-blue-50 border border-blue-100 rounded mb-2 p-2 sticky top-0 z-10 shadow-sm">
                <div className="flex items-center justify-between mb-2">
                    <span className="text-[10px] font-bold text-blue-700 uppercase">{selection.size} Selected</span>
                    <button 
                        onClick={() => setSelection(new Set())} 
                        className="text-[10px] text-blue-500 hover:text-blue-700"
                    >
                        Deselect All
                    </button>
                </div>
                <div className="flex flex-wrap gap-2 items-center">
                    <input 
                        type="color" 
                        onChange={(e) => handleBulkUpdate({ color: e.target.value })}
                        className="w-5 h-5 p-0 border-0 rounded cursor-pointer"
                        title="Set Color"
                    />
                    <div className="flex items-center gap-1 bg-white rounded border border-blue-200 px-1">
                        <span className="text-[8px] text-gray-500">Size</span>
                        <input 
                            type="number" min="1" max="10" step="0.5"
                            onChange={(e) => handleBulkUpdate({ size: parseFloat(e.target.value) })}
                            className="w-8 text-xs border-0 focus:ring-0 p-0"
                            placeholder="4"
                        />
                    </div>
                    <div className="w-px h-4 bg-blue-200 mx-1"></div>
                    <button onClick={() => handleBulkUpdate({ visible: true })} className="p-1 hover:bg-white rounded text-blue-600" title="Show Points"><Eye size={12}/></button>
                    <button onClick={() => handleBulkUpdate({ visible: false })} className="p-1 hover:bg-white rounded text-gray-400" title="Hide Points"><EyeOff size={12}/></button>
                    <div className="w-px h-4 bg-blue-200 mx-1"></div>
                    <button onClick={() => handleBulkUpdate({ showLabel: true })} className="p-1 hover:bg-white rounded text-purple-600" title="Show Labels"><Type size={12}/></button>
                    <button onClick={() => handleBulkUpdate({ showLabel: false })} className="p-1 hover:bg-white rounded text-gray-400" title="Hide Labels"><Type size={12} className="opacity-50"/></button>
                </div>
            </div>
        )}

        {/* Groups */}
        {FEATURE_ORDER.map(group => {
            const items = grouped[group.type];
            if (items.length === 0) return null;
            
            const allSelected = items.every(i => selection.has(i.id));
            const someSelected = items.some(i => selection.has(i.id));

            return (
                <div key={group.type} className="mb-2 last:mb-0">
                    <div className="flex items-center gap-2 mb-1 group/header">
                         <button 
                            onClick={() => selectGroup(items.map(i => i.id), !allSelected)}
                            className="text-gray-300 hover:text-blue-500"
                         >
                            {allSelected ? <CheckSquare size={12} className="text-blue-600"/> : someSelected ? <div className="w-3 h-3 bg-blue-200 rounded-sm"/> : <Square size={12}/>}
                         </button>
                         <span className="text-[10px] uppercase font-bold text-gray-400">{group.label}</span>
                    </div>

                    <div className="space-y-1 pl-1">
                        {items.map(ft => {
                            const isSel = selection.has(ft.id);
                            const isAsy = ft.type.includes('asymptote');
                            return (
                                <div 
                                    key={ft.id} 
                                    className={`flex items-center justify-between text-xs p-1 rounded cursor-pointer group/item ${isSel ? 'bg-blue-50 ring-1 ring-blue-200' : 'bg-gray-50 hover:bg-gray-100'}`}
                                    onClick={(e) => toggleSelect(ft.id, e.ctrlKey || e.metaKey)}
                                >
                                    <div className="flex items-center gap-2 truncate flex-1" title={ft.label}>
                                        <div className={`w-1.5 h-1.5 rounded-full shrink-0 ${ft.style === 'filled' ? 'bg-current' : 'border border-current bg-transparent'}`} style={{ color: ft.color }}></div>
                                        <span className={`truncate font-mono ${isSel ? 'text-blue-700 font-medium' : 'text-gray-600'}`}>
                                            {isAsy ? ft.label : `(${formatDecimal(ft.x)}, ${formatDecimal(ft.y)})`}
                                        </span>
                                    </div>
                                    <div className="flex items-center gap-1 opacity-0 group-hover/item:opacity-100 transition-opacity">
                                         {!isAsy && (
                                             <button 
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    onUpdate([ft.id], { useExactLabel: !ft.useExactLabel });
                                                }}
                                                className={`p-1 ${ft.useExactLabel ? 'text-orange-500 font-bold' : 'text-gray-300'} hover:text-orange-600`}
                                                title="Toggle Exact Value (π)"
                                             >
                                                <Pi size={12} />
                                             </button>
                                         )}
                                         <button 
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                onUpdate([ft.id], { customLabelOffset: getDefaultOffset(ft.type) });
                                            }}
                                            className="text-gray-400 hover:text-blue-500 p-1"
                                            title="Reset Label Position"
                                         >
                                            <RefreshCcw size={10} />
                                         </button>
                                         <button 
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                onUpdate([ft.id], { showLabel: !ft.showLabel });
                                            }}
                                            className={`p-1 ${ft.showLabel ? 'text-purple-600' : 'text-gray-300'} hover:text-purple-700`}
                                            title={ft.showLabel ? "Hide Label" : "Show Label"}
                                         >
                                            <Type size={12} />
                                         </button>
                                         <button 
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                onUpdate([ft.id], { visible: !ft.visible });
                                            }}
                                            className={`p-1 ${ft.visible ? 'text-blue-600' : 'text-gray-300'} hover:text-blue-700`}
                                            title={ft.visible ? (isAsy ? "Hide Line" : "Hide Point") : (isAsy ? "Show Line" : "Show Point")}
                                         >
                                            {ft.visible ? <Eye size={12}/> : <EyeOff size={12}/>}
                                         </button>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            );
        })}
    </div>
  );
};
