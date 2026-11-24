
import React from 'react';
import { GraphConfig } from '../../types';

interface WindowSettingsProps {
    dimCm: { width: number; height: number };
    setDimCm: (dim: { width: number; height: number }) => void;
    isFixedSize: boolean;
    setIsFixedSize: (val: boolean) => void;
    windowSettings: {
        xMin: string; xMax: string; yMin: string; yMax: string;
        xStep: string; yStep: string; xSubdivisions: number; ySubdivisions: number;
    };
    onSettingChange: (field: any, val: string) => void;
    config?: GraphConfig;
    setConfig?: React.Dispatch<React.SetStateAction<GraphConfig>> | ((cfg: GraphConfig) => void);
}

export const WindowSettings: React.FC<WindowSettingsProps> = ({
    dimCm, setDimCm, isFixedSize, setIsFixedSize, windowSettings, onSettingChange, config, setConfig
}) => {
    const yExcludesZero = config ? (config.yRange[0] > 0 || config.yRange[1] < 0) : false;

    const updateConfig = (updates: Partial<GraphConfig>) => {
        if (!config || !setConfig) return;
        setConfig({ ...config, ...updates });
    };

    return (
        <>
            {/* Image Dimensions */}
            <div className="border-b border-gray-200">
                <div className="p-4 bg-gray-50 border-b border-gray-100 flex justify-between items-center">
                    <h2 className="text-xs font-bold text-gray-500 uppercase tracking-wider">Image Dimensions</h2>
                    <div className="flex items-center gap-1">
                    <button 
                        onClick={() => setIsFixedSize(false)} 
                        className={`px-2 py-1 text-xs rounded ${!isFixedSize ? 'bg-blue-100 text-blue-700 font-medium' : 'text-gray-500 hover:bg-gray-100'}`}
                    >
                        Auto
                    </button>
                    <button 
                        onClick={() => setIsFixedSize(true)} 
                        className={`px-2 py-1 text-xs rounded ${isFixedSize ? 'bg-blue-100 text-blue-700 font-medium' : 'text-gray-500 hover:bg-gray-100'}`}
                    >
                        Fixed (cm)
                    </button>
                    </div>
                </div>
                {isFixedSize ? (
                <div className="p-4 grid grid-cols-2 gap-4">
                    <div>
                        <label className="block text-xs text-gray-500 mb-1">Width (cm)</label>
                        <input 
                            type="number" 
                            value={dimCm.width} 
                            onChange={(e) => setDimCm({...dimCm, width: parseFloat(e.target.value) || 0})}
                            className="w-full border rounded px-2 py-1 text-sm text-gray-800" 
                        />
                    </div>
                    <div>
                        <label className="block text-xs text-gray-500 mb-1">Height (cm)</label>
                        <input 
                            type="number" 
                            value={dimCm.height} 
                            onChange={(e) => setDimCm({...dimCm, height: parseFloat(e.target.value) || 0})}
                            className="w-full border rounded px-2 py-1 text-sm text-gray-800" 
                        />
                    </div>
                    <div className="col-span-2 text-xs text-gray-400 italic text-center">
                        Output scales to 12cm @ 300DPI
                    </div>
                </div>
                ) : (
                    <div className="p-4 text-xs text-gray-400 text-center italic">
                    Size determined by zoom level & content.
                    </div>
                )}
            </div>

            {/* Window Config */}
            <div className="border-b border-gray-200 pb-20">
                <div className="p-4 bg-gray-50 border-b border-gray-100">
                    <h2 className="text-xs font-bold text-gray-500 uppercase tracking-wider">Window Settings</h2>
                </div>
                <div className="p-4 grid grid-cols-2 gap-4">
                    <div>
                        <label className="block text-xs text-gray-500 mb-1">X Min</label>
                        <input type="text" value={windowSettings.xMin} onChange={(e) => onSettingChange('xMin', e.target.value)} className="w-full border rounded px-2 py-1 text-sm text-gray-800" />
                    </div>
                    <div>
                        <label className="block text-xs text-gray-500 mb-1">X Max</label>
                        <input type="text" value={windowSettings.xMax} onChange={(e) => onSettingChange('xMax', e.target.value)} className="w-full border rounded px-2 py-1 text-sm text-gray-800" />
                    </div>
                    <div>
                        <label className="block text-xs text-gray-500 mb-1">Y Min</label>
                        <input type="text" value={windowSettings.yMin} onChange={(e) => onSettingChange('yMin', e.target.value)} className="w-full border rounded px-2 py-1 text-sm text-gray-800" />
                    </div>
                    <div>
                        <label className="block text-xs text-gray-500 mb-1">Y Max</label>
                        <input type="text" value={windowSettings.yMax} onChange={(e) => onSettingChange('yMax', e.target.value)} className="w-full border rounded px-2 py-1 text-sm text-gray-800" />
                    </div>
                    <div>
                        <label className="block text-xs text-gray-500 mb-1">X Step</label>
                        <input type="text" value={windowSettings.xStep} onChange={(e) => onSettingChange('xStep', e.target.value)} className="w-full border rounded px-2 py-1 text-sm text-gray-800" />
                    </div>
                    <div>
                        <label className="block text-xs text-gray-500 mb-1">Y Step</label>
                        <input type="text" value={windowSettings.yStep} onChange={(e) => onSettingChange('yStep', e.target.value)} className="w-full border rounded px-2 py-1 text-sm text-gray-800" />
                    </div>
                    <div>
                        <label className="block text-xs text-gray-500 mb-1">X Subdivs</label>
                        <input type="number" min="1" value={windowSettings.xSubdivisions} onChange={(e) => onSettingChange('xSubdivisions', e.target.value)} className="w-full border rounded px-2 py-1 text-sm text-gray-800" />
                    </div>
                    <div>
                        <label className="block text-xs text-gray-500 mb-1">Y Subdivs</label>
                        <input type="number" min="1" value={windowSettings.ySubdivisions} onChange={(e) => onSettingChange('ySubdivisions', e.target.value)} className="w-full border rounded px-2 py-1 text-sm text-gray-800" />
                    </div>

                    {config && setConfig && (
                        <div className="col-span-2 pt-3 mt-1 border-t border-gray-100 space-y-2">
                            <label className="flex items-center gap-2 text-xs font-medium text-gray-700 cursor-pointer">
                                <input
                                    type="checkbox"
                                    checked={!!config.breakYAxis}
                                    onChange={(e) => updateConfig({ breakYAxis: e.target.checked })}
                                />
                                Show Broken Y-Axis Symbol
                            </label>
                            {config.breakYAxis && (
                                <div className="flex items-center justify-between gap-2 pl-5">
                                    <span className="text-xs text-gray-500">Break Symbol</span>
                                    <select
                                        value={config.yAxisBreakStyle === 'slashes' ? 'slashes' : 'zigzag'}
                                        onChange={(e) => updateConfig({ yAxisBreakStyle: e.target.value as any })}
                                        className="border border-gray-300 rounded px-2 py-1 text-xs bg-white text-gray-700"
                                    >
                                        <option value="zigzag">Zigzag Break</option>
                                        <option value="slashes">Parallel Slashes (//)</option>
                                    </select>
                                </div>
                            )}
                            {!yExcludesZero && config.breakYAxis && (
                                <p className="text-[11px] text-amber-600 pl-5">
                                    Active when y = 0 is outside [Y Min, Y Max].
                                </p>
                            )}
                        </div>
                    )}
                </div>
            </div>
        </>
    );
};
