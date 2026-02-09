
import React, { useState, useMemo, useRef, useEffect } from 'react';
import { SurdGenerator } from '../../utils/surd/SurdGenerator';
import { SurdTuning, DEFAULT_TUNING, InterpolationParam } from '../../utils/surd/SurdTuning';
import { SurdDiagnostics } from '../../utils/surd/SurdDiagnostics';
import { Radical, RefreshCcw, Copy } from 'lucide-react';

const SurdTuningPage: React.FC = () => {
    const [tuning, setTuning] = useState<SurdTuning>(DEFAULT_TUNING);
    const [testHeight, setTestHeight] = useState(50);
    const [testWidth, setTestWidth] = useState(40);
    const [showControls, setShowControls] = useState(true);
    const [showPoints, setShowPoints] = useState(true);
    
    // Zoom/Pan for canvas
    const [scale, setScale] = useState(4);
    const canvasSize = 800;
    
    const generator = useMemo(() => new SurdGenerator(), []);
    
    // Generate Path
    const result = useMemo(() => {
        return generator.generatePath(testWidth, testHeight, 0, 0, 0, 0, tuning);
    }, [tuning, testWidth, testHeight]);

    // Diagnostics
    const controlNodes = useMemo(() => {
        return SurdDiagnostics.getControlNodes(result.rawPoints);
    }, [result]);

    // Helper to update a nested param
    const updateParam = (
        key: keyof SurdTuning, 
        field: keyof InterpolationParam, 
        value: number | string
    ) => {
        setTuning(prev => ({
            ...prev,
            [key]: {
                ...prev[key],
                [field]: value
            }
        }));
    };

    const handleCopy = () => {
        navigator.clipboard.writeText(JSON.stringify(tuning, null, 2));
        alert("Configuration copied to clipboard!");
    };

    // Render Param Control Group
    const renderParamGroup = (key: keyof SurdTuning, label: string) => {
        const p = tuning[key];
        return (
            <div className="mb-4 border-b border-gray-700 pb-4">
                <div className="flex justify-between items-center mb-2">
                    <span className="text-[10px] font-bold text-green-400 uppercase">{label}</span>
                </div>
                <div className="space-y-3">
                    <div className="grid grid-cols-2 gap-2">
                        <div>
                            <label className="text-[10px] text-gray-500">Start</label>
                            <input 
                                type="number" step="0.1" 
                                value={p.start} 
                                onChange={(e) => updateParam(key, 'start', parseFloat(e.target.value))}
                                className="w-full bg-gray-800 border border-gray-700 rounded px-1 text-xs text-white"
                            />
                        </div>
                        <div>
                            <label className="text-[10px] text-gray-500">End</label>
                            <input 
                                type="number" step="0.1" 
                                value={p.end} 
                                onChange={(e) => updateParam(key, 'end', parseFloat(e.target.value))}
                                className="w-full bg-gray-800 border border-gray-700 rounded px-1 text-xs text-white"
                            />
                        </div>
                    </div>
                    <div>
                        <label className="flex justify-between text-[10px] text-gray-500">
                            <span>Lock Height</span>
                            <span>{p.lockHeight}px</span>
                        </label>
                        <input 
                            type="range" min="10" max="200"
                            value={p.lockHeight} 
                            onChange={(e) => updateParam(key, 'lockHeight', parseFloat(e.target.value))}
                            className="w-full h-1 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-blue-500"
                        />
                    </div>
                    <div className="flex gap-2">
                        <select 
                            value={p.easing || 'linear'}
                            onChange={(e) => updateParam(key, 'easing', e.target.value)}
                            className="flex-1 bg-gray-800 border border-gray-700 rounded text-[10px] text-white p-1"
                        >
                            <option value="linear">Linear</option>
                            <option value="quadratic">Quadratic</option>
                        </select>
                        {p.easing === 'quadratic' && (
                            <input 
                                type="number" placeholder="Pow" step="0.1"
                                value={p.easingPower || 2}
                                onChange={(e) => updateParam(key, 'easingPower', parseFloat(e.target.value))}
                                className="w-12 bg-gray-800 border border-gray-700 rounded text-[10px] text-white p-1"
                            />
                        )}
                    </div>
                </div>
            </div>
        );
    };

    // Calculate center for visualization
    const centerX = canvasSize / 2 - (testWidth * scale / 2); // roughly center
    const centerY = canvasSize / 2;

    return (
        <div className="flex h-full bg-gray-900 text-white overflow-hidden">
            {/* Sidebar */}
            <aside className="w-80 bg-gray-950 border-r border-gray-800 flex flex-col h-full z-10">
                <div className="p-4 border-b border-gray-800 flex justify-between items-center">
                    <h1 className="text-sm font-bold flex items-center gap-2">
                        <Radical size={16} className="text-green-500"/> Surd Tuner
                    </h1>
                    <div className="flex gap-2">
                        <button onClick={() => setTuning(DEFAULT_TUNING)} className="text-gray-500 hover:text-red-500"><RefreshCcw size={14}/></button>
                        <button onClick={handleCopy} className="text-gray-500 hover:text-blue-500"><Copy size={14}/></button>
                    </div>
                </div>
                
                <div className="flex-1 overflow-y-auto custom-scrollbar p-4">
                    {renderParamGroup('upstrokeAngle', 'Right Arm Angle')}
                    {renderParamGroup('downstrokeAngle', 'Left Arm Angle')}
                    {renderParamGroup('downstrokeHeightRatio', 'Left Arm Height Ratio')}
                    {renderParamGroup('hookRotation', 'Hook Rotation')}
                    {renderParamGroup('hookLengthScale', 'Hook Length Scale')}
                </div>
                
                <div className="p-4 border-t border-gray-800 bg-gray-900 space-y-4">
                    <div>
                        <label className="block text-[10px] font-bold text-gray-500 uppercase mb-2">Test Box Size</label>
                        <div className="grid grid-cols-2 gap-2">
                            <div>
                                <label className="text-[10px] text-gray-500">Height: {testHeight}</label>
                                <input type="range" min="10" max="200" value={testHeight} onChange={(e) => setTestHeight(parseFloat(e.target.value))} className="w-full h-1 bg-gray-700 rounded appearance-none cursor-pointer accent-green-500"/>
                            </div>
                            <div>
                                <label className="text-[10px] text-gray-500">Width: {testWidth}</label>
                                <input type="range" min="10" max="200" value={testWidth} onChange={(e) => setTestWidth(parseFloat(e.target.value))} className="w-full h-1 bg-gray-700 rounded appearance-none cursor-pointer accent-green-500"/>
                            </div>
                        </div>
                    </div>
                    <label className="flex items-center gap-2 text-xs text-gray-400 cursor-pointer">
                        <input type="checkbox" checked={showControls} onChange={(e) => setShowControls(e.target.checked)} className="rounded bg-gray-800 border-gray-600"/>
                        Show Bezier Controls
                    </label>
                </div>
            </aside>

            {/* Canvas */}
            <main className="flex-1 bg-gray-900 flex items-center justify-center relative overflow-hidden">
                <div className="relative border border-gray-800 shadow-2xl bg-gray-950" style={{ width: canvasSize, height: canvasSize }}>
                    {/* Grid */}
                    <div className="absolute inset-0 opacity-10 pointer-events-none" 
                        style={{ 
                            backgroundImage: `linear-gradient(#333 1px, transparent 1px), linear-gradient(90deg, #333 1px, transparent 1px)`, 
                            backgroundSize: `${20*scale}px ${20*scale}px` 
                        }} 
                    />
                    
                    <svg width={canvasSize} height={canvasSize} viewBox={`0 0 ${canvasSize} ${canvasSize}`}>
                        <g transform={`translate(${centerX}, ${centerY}) scale(${scale})`}>
                            {/* Origin Marker */}
                            <circle cx="0" cy="0" r="2" fill="red" opacity="0.5"/>

                            {/* Reference Box (The content area) */}
                            {/* 
                                The generator creates a shape that wraps the content width. 
                                The vinculum starts at `result.vinculum.x`. 
                                Content sits under `vinculum` rect.
                            */}
                            <rect 
                                x={result.vinculum.x} 
                                y={result.vinculum.y + result.vinculum.height} 
                                width={result.vinculum.width} 
                                height={testHeight} 
                                fill="rgba(0, 255, 0, 0.1)" 
                                stroke="none" 
                            />
                            
                            {/* The Surd Path */}
                            <path 
                                d={result.pathData} 
                                fill="white" 
                                stroke="none"
                                opacity="0.9"
                            />
                            
                            {/* The Vinculum Rect */}
                            <rect 
                                x={result.vinculum.x} 
                                y={result.vinculum.y} 
                                width={result.vinculum.width} 
                                height={result.vinculum.height} 
                                fill="white"
                                opacity="0.9"
                            />

                            {/* Diagnostics */}
                            {showControls && (
                                <g pointerEvents="none">
                                    {controlNodes.map((node, i) => (
                                        <g key={i}>
                                            {/* Anchor */}
                                            <circle cx={node.anchor.x} cy={node.anchor.y} r={1.5/scale} fill="yellow" stroke="none" />
                                            {/* Handles */}
                                            {node.hasInHandle && (
                                                <>
                                                    <line x1={node.anchor.x} y1={node.anchor.y} x2={node.inHandle.x} y2={node.inHandle.y} stroke="rgba(255,255,0,0.3)" strokeWidth={0.5/scale} />
                                                    <circle cx={node.inHandle.x} cy={node.inHandle.y} r={1/scale} fill="cyan" />
                                                </>
                                            )}
                                            {node.hasOutHandle && (
                                                <>
                                                    <line x1={node.anchor.x} y1={node.anchor.y} x2={node.outHandle.x} y2={node.outHandle.y} stroke="rgba(255,255,0,0.3)" strokeWidth={0.5/scale} />
                                                    <circle cx={node.outHandle.x} cy={node.outHandle.y} r={1/scale} fill="magenta" />
                                                </>
                                            )}
                                            {showPoints && (
                                                <text x={node.anchor.x} y={node.anchor.y - 2} fontSize={3} fill="gray" textAnchor="middle">{i}</text>
                                            )}
                                        </g>
                                    ))}
                                </g>
                            )}
                        </g>
                    </svg>
                    
                    <div className="absolute bottom-4 left-4 bg-black/50 p-2 rounded text-xs text-white pointer-events-none">
                        Scale: {scale}x <br/>
                        Tick Width: {result.metrics.advanceWidth.toFixed(2)} <br/>
                        Total Ascent: {result.metrics.ascent.toFixed(2)}
                    </div>
                </div>
                
                {/* Zoom Controls */}
                <div className="absolute top-4 right-4 flex flex-col gap-2">
                    <button onClick={() => setScale(s => s + 0.5)} className="p-2 bg-gray-800 rounded hover:bg-gray-700">+</button>
                    <button onClick={() => setScale(s => Math.max(0.5, s - 0.5))} className="p-2 bg-gray-800 rounded hover:bg-gray-700">-</button>
                </div>
            </main>
        </div>
    );
};

export default SurdTuningPage;
