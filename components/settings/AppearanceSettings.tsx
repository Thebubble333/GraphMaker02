
import React from 'react';
import { GraphConfig } from '../../types';
import { RichInput } from '../ui/RichInput';
import { Link2, Link2Off, RefreshCw } from 'lucide-react';

interface AppearanceSettingsProps {
    config: GraphConfig;
    setConfig: (cfg: GraphConfig) => void;
    togglePiX?: (val: boolean) => void;
    togglePiY?: (val: boolean) => void;
    hideGridOptions?: boolean;
    hidePiSteps?: boolean;
    hideWhiskerCaps?: boolean;
    hideZeroLabel?: boolean;
    hideAsymptotes?: boolean;
}

export const AppearanceSettings: React.FC<AppearanceSettingsProps> = ({
    config, setConfig, togglePiX, togglePiY,
    hideGridOptions = false,
    hidePiSteps = false,
    hideWhiskerCaps = false,
    hideZeroLabel = false,
    hideAsymptotes = false
}) => {
    return (
        <div className="border-b border-gray-200 pb-20">
            <div className="p-4 bg-gray-50 border-b border-gray-100">
                <h2 className="text-xs font-bold text-gray-500 uppercase tracking-wider">Appearance</h2>
            </div>
            <div className="p-4 space-y-4">
                {!hideGridOptions && (
                    <div className="space-y-1">
                        <label className="flex items-center gap-2 text-sm text-gray-600">
                            <input type="checkbox" checked={config.showVerticalGrid} onChange={(e) => setConfig({...config, showVerticalGrid: e.target.checked})} />
                            Show Vertical Ticks/Grid
                        </label>
                        <label className="flex items-center gap-2 text-sm text-gray-600">
                            <input type="checkbox" checked={config.showHorizontalGrid} onChange={(e) => setConfig({...config, showHorizontalGrid: e.target.checked})} />
                            Show Horizontal Grid
                        </label>
                        <label className="flex items-center gap-2 text-sm text-gray-600">
                            <input type="checkbox" checked={config.showMinorGrid} onChange={(e) => setConfig({...config, showMinorGrid: e.target.checked})} />
                            Show Minor Grid
                        </label>
                    </div>
                )}
                
                <div className="space-y-1">
                    {/* Origin Label Configuration */}
                    {!hideZeroLabel && (
                        <div className="flex items-center justify-between">
                            <label className="flex items-center gap-2 text-sm text-gray-600">
                                <input type="checkbox" checked={config.showZeroLabel} onChange={(e) => setConfig({...config, showZeroLabel: e.target.checked, autoZeroLabel: false})} />
                                Show 0 at Origin
                            </label>
                            
                            {config.showZeroLabel && (
                                <div className="flex items-center gap-1">
                                    <select 
                                        value={config.originLabelContent || 'auto'}
                                        onChange={(e) => setConfig({...config, originLabelContent: e.target.value as any})}
                                        className="text-xs border border-gray-300 rounded p-0.5 bg-white"
                                        title="Origin Label Content"
                                    >
                                        <option value="auto">Auto</option>
                                        <option value="0">0</option>
                                        <option value="O">O</option>
                                    </select>
                                    {(config.originLabelOffset?.x !== 0 || config.originLabelOffset?.y !== 0) && (
                                        <button 
                                            onClick={() => setConfig({...config, originLabelOffset: {x:0, y:0}})}
                                            className="text-gray-400 hover:text-blue-500 p-0.5"
                                            title="Reset Position"
                                        >
                                            <RefreshCw size={12} />
                                        </button>
                                    )}
                                </div>
                            )}
                        </div>
                    )}

                    <label className="flex items-center gap-2 text-sm text-gray-600">
                        <input type="checkbox" checked={config.showBorder} onChange={(e) => setConfig({...config, showBorder: e.target.checked})} />
                        Show Border Box
                    </label>
                    <div className="flex items-center gap-4">
                        <label className="flex items-center gap-2 text-sm text-gray-600">
                            <input type="checkbox" checked={config.clipContentX !== false} onChange={(e) => setConfig({...config, clipContentX: e.target.checked})} />
                            Clip X Overflow
                        </label>
                        <label className="flex items-center gap-2 text-sm text-gray-600">
                            <input type="checkbox" checked={config.clipContentY !== false} onChange={(e) => setConfig({...config, clipContentY: e.target.checked})} />
                            Clip Y Overflow
                        </label>
                    </div>
                    {!hideWhiskerCaps && (
                        <label className="flex items-center gap-2 text-sm text-gray-600">
                            <input type="checkbox" checked={config.showWhiskerCaps} onChange={(e) => setConfig({...config, showWhiskerCaps: e.target.checked})} />
                            Show Whisker Caps
                        </label>
                    )}
                </div>
                
                <div className="pt-2 border-t border-gray-100">
                    <div className="flex justify-between items-center mb-2">
                        <span className="block text-xs font-semibold text-gray-400">Axes Labels</span>
                        <button 
                            onClick={() => setConfig({...config, linkAxisLabels: !config.linkAxisLabels})}
                            className={`flex items-center gap-1 text-[10px] px-2 py-1 rounded border ${config.linkAxisLabels ? 'bg-blue-50 text-blue-600 border-blue-200' : 'bg-gray-50 text-gray-500 border-gray-200'}`}
                            title={config.linkAxisLabels ? "Dragging one label moves the other symmetrically" : "Labels move independently"}
                        >
                            {config.linkAxisLabels ? <Link2 size={12}/> : <Link2Off size={12}/>}
                            {config.linkAxisLabels ? 'Linked' : 'Unlinked'}
                        </button>
                    </div>

                    <div className="mb-4 bg-gray-50 p-3 rounded border border-gray-100 flex gap-2">
                        <div className="w-1/3">
                            <label className="block text-xs text-gray-500 mb-1" title="Thickness of the ticks">Tick Width</label>
                            <input 
                                type="number" step="0.5" min="0.5" max="10"
                                value={config.tickThickness} 
                                onChange={(e) => setConfig({...config, tickThickness: parseFloat(e.target.value) || 1})}
                                className="w-full border border-gray-300 rounded p-1 text-xs"
                            />
                        </div>
                        <div className="w-1/3">
                            <label className="block text-xs text-gray-500 mb-1" title="Length of the ticks">Tick Length</label>
                            <input 
                                type="number" step="1" min="1" max="20"
                                value={config.tickLength ?? 6} 
                                onChange={(e) => setConfig({...config, tickLength: parseFloat(e.target.value) || 6})}
                                className="w-full border border-gray-300 rounded p-1 text-xs"
                            />
                        </div>
                        <div className="w-1/3">
                            <label className="block text-xs text-gray-500 mb-1">Font Size (pt)</label>
                            <input 
                                type="number" step="0.5" min="6" max="36"
                                value={config.fontSize || 11} 
                                onChange={(e) => setConfig({...config, fontSize: parseFloat(e.target.value) || 11})}
                                className="w-full border border-gray-300 rounded p-1 text-xs"
                            />
                        </div>
                    </div>

                    <div className="space-y-4">
                        {/* X Axis Section */}
                        <div className="bg-gray-50 p-3 rounded border border-gray-100">
                             <span className="block text-[10px] font-bold text-gray-400 uppercase mb-2">X Axis</span>
                             <RichInput 
                                value={config.axisLabels[0]} 
                                onChange={(e) => setConfig({...config, axisLabels: [e.target.value, config.axisLabels[1]]})}
                                className="border border-gray-300 rounded px-2 py-1 text-sm mb-2"
                                placeholder="X Axis Label"
                            />
                            <div className="space-y-1 mb-2">
                                <label className="flex items-center gap-2 text-xs text-gray-600">
                                    <input type="checkbox" checked={config.showXAxis} onChange={(e) => setConfig({...config, showXAxis: e.target.checked})} />
                                    Show Line
                                </label>
                                <label className="flex items-center gap-2 text-xs text-gray-600">
                                    <input type="checkbox" checked={config.showXNumbers} onChange={(e) => setConfig({...config, showXNumbers: e.target.checked})} />
                                    Show Numbers
                                </label>
                                <label className="flex items-center gap-2 text-xs text-gray-600">
                                    <input type="checkbox" checked={config.showXTicks} onChange={(e) => setConfig({...config, showXTicks: e.target.checked})} />
                                    Show Ticks
                                </label>
                                <label className="flex items-center gap-2 text-xs text-gray-600 pt-1">
                                    <input type="checkbox" checked={config.autoZeroLabel ? false : config.showZeroLabel} onChange={(e) => setConfig({...config, showZeroLabel: e.target.checked, autoZeroLabel: false})} />
                                    Show Zero (Origin)
                                </label>
                                {!hidePiSteps && togglePiX && (
                                    <label className="flex items-center gap-2 text-xs text-gray-600">
                                        <input type="checkbox" checked={config.piXAxis} onChange={(e) => togglePiX(e.target.checked)} />
                                        Use π Steps
                                    </label>
                                )}
                            </div>
                            <div className="grid grid-cols-2 gap-2 mb-2">
                                <div className="text-xs">
                                    <span className="block text-gray-500 mb-1">Position Style</span>
                                    <select 
                                        value={config.xLabelStyle}
                                        onChange={(e) => setConfig({...config, xLabelStyle: e.target.value as any})}
                                        className="w-full border border-gray-300 rounded p-1 text-xs bg-white"
                                    >
                                        <option value="arrow-end">At Arrow End</option>
                                        <option value="below-center">Bottom Center</option>
                                    </select>
                                </div>
                                <div className="text-xs">
                                    <span className="block text-gray-500 mb-1">Tick Style</span>
                                    <select 
                                        value={config.xTickStyle || 'auto'}
                                        onChange={(e) => setConfig({...config, xTickStyle: e.target.value as any})}
                                        className="w-full border border-gray-300 rounded p-1 text-xs bg-white"
                                    >
                                        <option value="auto">Auto (Smart Bounds)</option>
                                        <option value="crossing">Crossing</option>
                                        <option value="top">Inside (Top)</option>
                                        <option value="bottom">Outside (Bottom)</option>
                                    </select>
                                </div>
                                <div className="text-xs col-span-2">
                                    <span className="block text-gray-500 mb-1">Number Spacing Offset</span>
                                    <input 
                                        type="number" step="1"
                                        value={config.offsetXAxisNumY || 0}
                                        onChange={(e) => setConfig({...config, offsetXAxisNumY: parseFloat(e.target.value) || 0})}
                                        className="w-full border border-gray-300 rounded p-1 text-xs"
                                    />
                                </div>
                                <div className="text-xs col-span-2">
                                    <span className="block text-gray-500 mb-1">Decimals (-1 Auto)</span>
                                    <input 
                                        type="number" min="-1" max="10"
                                        value={config.tickRounding[0]}
                                        onChange={(e) => setConfig({...config, tickRounding: [parseInt(e.target.value), config.tickRounding[1]]})}
                                        className="w-full border border-gray-300 rounded p-1 text-xs"
                                    />
                                </div>
                            </div>
                        </div>

                        {/* Y Axis Section */}
                        <div className="bg-gray-50 p-3 rounded border border-gray-100">
                             <span className="block text-[10px] font-bold text-gray-400 uppercase mb-2">Y Axis</span>
                             <RichInput 
                                value={config.axisLabels[1]} 
                                onChange={(e) => setConfig({...config, axisLabels: [config.axisLabels[0], e.target.value]})}
                                className="border border-gray-300 rounded px-2 py-1 text-sm mb-2"
                                placeholder="Y Axis Label"
                            />
                            <div className="space-y-1 mb-2">
                                <label className="flex items-center gap-2 text-xs text-gray-600">
                                    <input type="checkbox" checked={config.showYAxis} onChange={(e) => setConfig({...config, showYAxis: e.target.checked})} />
                                    Show Line
                                </label>
                                <label className="flex items-center gap-2 text-xs text-gray-600">
                                    <input type="checkbox" checked={config.showYNumbers} onChange={(e) => setConfig({...config, showYNumbers: e.target.checked})} />
                                    Show Numbers
                                </label>
                                <label className="flex items-center gap-2 text-xs text-gray-600">
                                    <input type="checkbox" checked={config.showYTicks} onChange={(e) => setConfig({...config, showYTicks: e.target.checked})} />
                                    Show Ticks
                                </label>
                                <label className="flex items-center gap-2 text-xs text-gray-600 pt-1">
                                    <input type="checkbox" checked={config.showYZeroLabel || false} onChange={(e) => setConfig({...config, showYZeroLabel: e.target.checked})} />
                                    Show Zero (0)
                                </label>
                                {!hidePiSteps && togglePiY && (
                                    <label className="flex items-center gap-2 text-xs text-gray-600">
                                        <input type="checkbox" checked={config.piYAxis} onChange={(e) => togglePiY(e.target.checked)} />
                                        Use π Steps
                                    </label>
                                )}
                            </div>
                            <div className="grid grid-cols-2 gap-2 mb-2">
                                <div className="text-xs">
                                    <span className="block text-gray-500 mb-1">Position Style</span>
                                    <select 
                                        value={config.yLabelStyle}
                                        onChange={(e) => setConfig({...config, yLabelStyle: e.target.value as any})}
                                        className="w-full border border-gray-300 rounded p-1 text-xs bg-white"
                                    >
                                        <option value="arrow-end">Arrow End</option>
                                        <option value="left-center">Left Margin</option>
                                        <option value="right-center">Right Margin</option>
                                    </select>
                                </div>
                                <div className="text-xs">
                                    <span className="block text-gray-500 mb-1">Orientation</span>
                                    <select 
                                        value={config.yLabelRotation}
                                        onChange={(e) => setConfig({...config, yLabelRotation: e.target.value as any})}
                                        className="w-full border border-gray-300 rounded p-1 text-xs bg-white"
                                    >
                                        <option value="horizontal">Horizontal</option>
                                        <option value="vertical">Vertical</option>
                                    </select>
                                </div>
                                <div className="text-xs">
                                    <span className="block text-gray-500 mb-1">Tick Style</span>
                                    <select 
                                        value={config.yTickStyle || 'auto'}
                                        onChange={(e) => setConfig({...config, yTickStyle: e.target.value as any})}
                                        className="w-full border border-gray-300 rounded p-1 text-xs bg-white"
                                    >
                                        <option value="auto">Auto (Smart Bounds)</option>
                                        <option value="crossing">Crossing</option>
                                        <option value="right">Inside (Right)</option>
                                        <option value="left">Outside (Left)</option>
                                    </select>
                                </div>
                                <div className="text-xs">
                                    <span className="block text-gray-500 mb-1">Decimals (-1 Auto)</span>
                                    <input 
                                        type="number" min="-1" max="10"
                                        value={config.tickRounding[1]}
                                        onChange={(e) => setConfig({...config, tickRounding: [config.tickRounding[0], parseInt(e.target.value)]})}
                                        className="w-full border border-gray-300 rounded p-1 text-xs"
                                    />
                                </div>
                                <div className="text-xs col-span-2">
                                    <span className="block text-gray-500 mb-1">Number Spacing Offset</span>
                                    <input 
                                        type="number" step="1"
                                        value={config.offsetYAxisNumX || 0}
                                        onChange={(e) => setConfig({...config, offsetYAxisNumX: parseFloat(e.target.value) || 0})}
                                        className="w-full border border-gray-300 rounded p-1 text-xs"
                                    />
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {!hideAsymptotes && (
                    <div className="pt-2 border-t border-gray-100">
                        <span className="block text-xs font-semibold text-gray-400 mb-2">Asymptote Styling</span>
                        <div className="grid grid-cols-2 gap-3 bg-gray-50 p-3 rounded border border-gray-100">
                            <div>
                                <label className="block text-xs text-gray-500 mb-1">Thickness</label>
                                <input 
                                    type="number" step="0.5" min="0.5" max="5"
                                    value={config.asymptoteThickness} 
                                    onChange={(e) => setConfig({...config, asymptoteThickness: parseFloat(e.target.value) || 1})}
                                    className="w-full border border-gray-300 rounded p-1 text-xs"
                                />
                            </div>
                            <div>
                                <label className="block text-xs text-gray-500 mb-1">Dash Pattern</label>
                                <input 
                                    type="text" 
                                    value={config.asymptoteDashArray} 
                                    onChange={(e) => setConfig({...config, asymptoteDashArray: e.target.value})}
                                    className="w-full border border-gray-300 rounded p-1 text-xs"
                                    placeholder="e.g. 6,4"
                                />
                            </div>
                        </div>
                    </div>
                )}

                <div className="pt-2 border-t border-gray-100">
                    <span className="block text-xs font-semibold text-gray-400 mb-2">Export / Crop</span>
                    <div className="bg-gray-50 p-3 rounded border border-gray-100">
                        <label className="block text-xs text-gray-500 mb-1">Auto-Crop Padding (px)</label>
                        <input 
                            type="number" min="0" max="100"
                            value={config.cropPadding ?? 20} 
                            onChange={(e) => setConfig({...config, cropPadding: parseInt(e.target.value) || 0})}
                            className="w-full border border-gray-300 rounded p-1 text-xs"
                        />
                    </div>
                </div>

                <div className="pt-2 border-t border-gray-100">
                    <span className="block text-xs font-semibold text-gray-400 mb-2">Worksheet Mode</span>
                    <label className={`flex items-center gap-3 p-3 rounded border cursor-pointer transition-colors ${config.studentMode ? 'bg-indigo-50 border-indigo-300' : 'bg-white border-gray-200'}`}>
                        <div className={`w-5 h-5 rounded border flex items-center justify-center ${config.studentMode ? 'bg-indigo-600 border-indigo-600 text-white' : 'bg-white border-gray-300'}`}>
                            {config.studentMode && <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>}
                        </div>
                        <input 
                            type="checkbox" 
                            checked={!!config.studentMode} 
                            onChange={(e) => setConfig({...config, studentMode: e.target.checked})} 
                            className="hidden"
                        />
                        <div className="flex-1">
                            <span className="block text-xs font-bold text-gray-700 uppercase">Student Mode</span>
                            <span className="block text-xs text-gray-500 mt-0.5">Hide data elements to create a worksheet</span>
                        </div>
                    </label>
                </div>
            </div>
        </div>
    );
};
