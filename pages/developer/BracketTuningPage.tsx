import React, { useState, useMemo } from 'react';
import { BracketGenerator } from '../../utils/bracket/BracketGenerator';
import { SurdDiagnostics } from '../../utils/surd/SurdDiagnostics';
import { Type, RefreshCcw } from 'lucide-react';

const BracketTuningPage: React.FC = () => {
    const [testHeight, setTestHeight] = useState(50);
    const [showControls, setShowControls] = useState(true);
    const [showPoints, setShowPoints] = useState(true);
    
    // Zoom/Pan for canvas
    const [scale, setScale] = useState(8);
    const canvasSize = 800;
    
    const generator = useMemo(() => new BracketGenerator(), []);
    
    // Generate Path
    const result = useMemo(() => {
        return generator.generatePath(testHeight);
    }, [testHeight, generator]);

    // Diagnostics
    const controlNodes = useMemo(() => {
        return SurdDiagnostics.getControlNodes(result.rawPoints, result.rawPoints.length / 6);
    }, [result]);

    // Calculate center for visualization
    const centerX = canvasSize / 2; // roughly center
    const centerY = canvasSize / 2;

    return (
        <div className="flex h-full bg-gray-900 text-white overflow-hidden">
            {/* Sidebar */}
            <aside className="w-80 bg-gray-950 border-r border-gray-800 flex flex-col h-full z-10">
                <div className="p-4 border-b border-gray-800 flex justify-between items-center">
                    <h1 className="text-sm font-bold flex items-center gap-2">
                        <Type size={16} className="text-blue-500"/> Bracket Tester
                    </h1>
                    <div className="flex gap-2">
                        <button onClick={() => setTestHeight(50)} className="text-gray-500 hover:text-red-500"><RefreshCcw size={14}/></button>
                    </div>
                </div>
                
                <div className="flex-1 overflow-y-auto custom-scrollbar p-4">
                    {/* Add any parameters here if the bracket generator supports tuning in the future */}
                    <div className="text-xs text-gray-400">
                        The bracket generator is currently using fixed Bézier coefficients and scales the spine linearly.
                    </div>
                </div>
                
                <div className="p-4 border-t border-gray-800 bg-gray-900 space-y-4">
                    <div>
                        <label className="block text-[10px] font-bold text-gray-500 uppercase mb-2">Test Box Size</label>
                        <div className="grid grid-cols-1 gap-2">
                            <div>
                                <label className="text-[10px] text-gray-500">Height: {testHeight}</label>
                                <input type="range" min="10" max="400" value={testHeight} onChange={(e) => setTestHeight(parseFloat(e.target.value))} className="w-full h-1 bg-gray-700 rounded appearance-none cursor-pointer accent-blue-500"/>
                            </div>
                        </div>
                    </div>
                    <label className="flex items-center gap-2 text-xs text-gray-400 cursor-pointer">
                        <input type="checkbox" checked={showControls} onChange={(e) => setShowControls(e.target.checked)} className="rounded bg-gray-800 border-gray-600"/>
                        Show Bezier Controls
                    </label>
                    <label className="flex items-center gap-2 text-xs text-gray-400 cursor-pointer">
                        <input type="checkbox" checked={showPoints} onChange={(e) => setShowPoints(e.target.checked)} className="rounded bg-gray-800 border-gray-600"/>
                        Show Point Indices
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

                            {/* Reference Box */}
                            <rect 
                                x={result.metrics.minX} 
                                y={-testHeight/2} 
                                width={result.metrics.advanceWidth} 
                                height={testHeight} 
                                fill="rgba(0, 0, 255, 0.1)" 
                                stroke="none" 
                            />
                            
                            {/* The Bracket Path */}
                            <path 
                                d={result.pathData} 
                                fill="white" 
                                stroke="none"
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
                                                <text x={node.anchor.x} y={node.anchor.y - 2/scale} fontSize={4/scale} fill="gray" textAnchor="middle">{i}</text>
                                            )}
                                        </g>
                                    ))}
                                </g>
                            )}
                        </g>
                    </svg>
                    
                    <div className="absolute bottom-4 left-4 bg-black/50 p-2 rounded text-xs text-white pointer-events-none">
                        Scale: {scale}x <br/>
                        Advance Width: {result.metrics.advanceWidth.toFixed(2)} <br/>
                        Total Ascent: {result.metrics.ascent.toFixed(2)} <br/>
                        Total Descent: {result.metrics.descent.toFixed(2)} <br/>
                        Target Height: {testHeight.toFixed(2)}
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

export default BracketTuningPage;
