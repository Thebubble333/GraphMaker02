import React, { useState, useMemo } from 'react';
import { BaseGraphEngine } from '../../utils/graphBase';
import { CARTESIAN_CONFIG } from '../../config/graphDefaults';
import { GraphConfig, FunctionDef } from '../../types';
import * as math from 'mathjs';
import { Settings, Copy, Check, Database } from 'lucide-react';
import { renderFunctionPlots, generateBezierSegments } from '../../utils/renderers/functions';

const PlotterTuningPage: React.FC = () => {
    const [expression, setExpression] = useState('asin(x)');
    const [yExpression, setYExpression] = useState('sin(t)');
    const [isParametric, setIsParametric] = useState(false);
    const [domainMin, setDomainMin] = useState('-1');
    const [domainMax, setDomainMax] = useState('1');
    const [plotterType, setPlotterType] = useState<'standard' | 'experimental'>('experimental');
    const [hSpacing, setHSpacing] = useState('0.1');
    const [showDots, setShowDots] = useState(true);
    const [showCurve, setShowCurve] = useState(true);
    const [showControlPoints, setShowControlPoints] = useState(false);
    
    // Zoom/Pan state
    const [xRange, setXRange] = useState<[number, number]>([-2, 2]);
    const [yRange, setYRange] = useState<[number, number]>([-2, 2]);
    const [isCopied, setIsCopied] = useState(false);
    const [isDataCopied, setIsDataCopied] = useState(false);

    const config: GraphConfig = useMemo(() => ({
        ...CARTESIAN_CONFIG,
        layoutMode: 'fixed',
        targetWidth: 800,
        targetHeight: 600,
        xRange,
        yRange,
        showMinorGrid: true,
        showZeroLabel: true,
        axisLabels: ["x", "y"]
    }), [xRange, yRange]);

    const engine = useMemo(() => new BaseGraphEngine(config), [config]);

    const funcDef: FunctionDef = useMemo(() => ({
        id: 'test-func',
        expression,
        yExpression,
        isParametric,
        color: '#2563eb',
        strokeWidth: 2,
        visible: showCurve,
        domain: [domainMin, domainMax],
        domainInclusive: [true, true],
        plotterType
    }), [expression, yExpression, isParametric, domainMin, domainMax, plotterType, showCurve]);

    // Generate basic dots
    const dots = useMemo(() => {
        if (!showDots) return [];
        let compiledX: math.EvalFunction | null = null;
        let compiledY: math.EvalFunction | null = null;
        
        try {
            if (isParametric) {
                compiledX = math.compile(expression);
                compiledY = math.compile(yExpression);
            } else {
                compiledY = math.compile(expression);
            }
        } catch { return []; }

        let dMin = -10, dMax = 10, h = 0.1;
        try { dMin = math.evaluate(domainMin); } catch {}
        try { dMax = math.evaluate(domainMax); } catch {}
        try { h = math.evaluate(hSpacing); } catch {}
        if (h <= 0) h = 0.1;

        const pts: {x: number, y: number}[] = [];
        for (let t = dMin; t <= dMax + 1e-9; t += h) {
            try {
                if (isParametric) {
                    if (compiledX && compiledY) {
                        const x = compiledX.evaluate({ t });
                        const y = compiledY.evaluate({ t });
                        if (typeof x === 'number' && isFinite(x) && typeof y === 'number' && isFinite(y)) {
                            pts.push({ x, y });
                        }
                    }
                } else {
                    if (compiledY) {
                        const y = compiledY.evaluate({ x: t });
                        if (typeof y === 'number' && isFinite(y)) {
                            pts.push({ x: t, y });
                        }
                    }
                }
            } catch {}
        }
        return pts;
    }, [expression, yExpression, isParametric, domainMin, domainMax, hSpacing, showDots]);

    const handleZoomIn = () => {
        const dx = (xRange[1] - xRange[0]) * 0.25;
        const dy = (yRange[1] - yRange[0]) * 0.25;
        setXRange([xRange[0] + dx, xRange[1] - dx]);
        setYRange([yRange[0] + dy, yRange[1] - dy]);
    };

    const handleZoomOut = () => {
        const dx = (xRange[1] - xRange[0]) * 0.5;
        const dy = (yRange[1] - yRange[0]) * 0.5;
        setXRange([xRange[0] - dx, xRange[1] + dx]);
        setYRange([yRange[0] - dy, yRange[1] + dy]);
    };

    const handlePan = (dx: number, dy: number) => {
        setXRange([xRange[0] + dx, xRange[1] + dx]);
        setYRange([yRange[0] + dy, yRange[1] + dy]);
    };

    const handleCopySVG = () => {
        const svg = document.getElementById('plotter-tuning-svg');
        if (svg) {
            navigator.clipboard.writeText(svg.outerHTML);
            setIsCopied(true);
            setTimeout(() => setIsCopied(false), 2000);
        }
    };

    const handleCopyData = () => {
        if (plotterType === 'experimental') {
            const data = generateBezierSegments(engine, funcDef, 100);
            navigator.clipboard.writeText(JSON.stringify(data, null, 2));
            setIsDataCopied(true);
            setTimeout(() => setIsDataCopied(false), 2000);
        }
    };

    return (
        <div className="flex h-full flex-col bg-gray-50">
            <header className="flex items-center justify-between px-6 py-3 bg-white border-b border-gray-200 shadow-sm z-10">
                <div className="flex items-center gap-3">
                    <div className="p-2 bg-gray-800 text-white rounded-lg"><Settings className="w-5 h-5" /></div>
                    <h1 className="text-xl font-semibold text-gray-800">Plotter Engine Tuning</h1>
                </div>
                <div className="flex items-center gap-2">
                    {plotterType === 'experimental' && (
                        <button 
                            onClick={handleCopyData}
                            className="flex items-center gap-2 px-3 py-2 bg-white border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50 transition-colors shadow-sm text-sm font-medium"
                        >
                            {isDataCopied ? <Check className="w-4 h-4 text-green-600" /> : <Database className="w-4 h-4" />} Export Data
                        </button>
                    )}
                    <button 
                        onClick={handleCopySVG}
                        className="flex items-center gap-2 px-3 py-2 bg-white border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50 transition-colors shadow-sm text-sm font-medium"
                    >
                        {isCopied ? <Check className="w-4 h-4 text-green-600" /> : <Copy className="w-4 h-4" />} Copy SVG
                    </button>
                </div>
            </header>

            <div className="flex flex-1 overflow-hidden">
                <aside className="w-80 bg-white border-r border-gray-200 flex flex-col h-full z-20 overflow-y-auto p-4 space-y-6">
                    <div>
                        <h3 className="text-sm font-semibold text-gray-700 mb-2">Function</h3>
                        <label className="flex items-center gap-2 text-sm text-gray-700 mb-2">
                            <input 
                                type="checkbox" 
                                checked={isParametric}
                                onChange={(e) => setIsParametric(e.target.checked)}
                                className="rounded border-gray-300"
                            />
                            Parametric Curve
                        </label>
                        {!isParametric ? (
                            <input 
                                type="text" 
                                value={expression}
                                onChange={e => setExpression(e.target.value)}
                                className="w-full border border-gray-300 rounded px-3 py-2 text-sm font-mono"
                            />
                        ) : (
                            <div className="flex flex-col gap-2">
                                <div className="flex items-center gap-2">
                                    <span className="text-sm text-gray-500 font-mono">x(t)=</span>
                                    <input 
                                        type="text" 
                                        value={expression}
                                        onChange={e => setExpression(e.target.value)}
                                        className="flex-1 border border-gray-300 rounded px-3 py-2 text-sm font-mono"
                                    />
                                </div>
                                <div className="flex items-center gap-2">
                                    <span className="text-sm text-gray-500 font-mono">y(t)=</span>
                                    <input 
                                        type="text" 
                                        value={yExpression}
                                        onChange={e => setYExpression(e.target.value)}
                                        className="flex-1 border border-gray-300 rounded px-3 py-2 text-sm font-mono"
                                    />
                                </div>
                            </div>
                        )}
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                        <div>
                            <label className="block text-xs text-gray-500 mb-1">Domain Min {isParametric ? '(t)' : '(x)'}</label>
                            <input 
                                type="text" 
                                value={domainMin}
                                onChange={e => setDomainMin(e.target.value)}
                                className="w-full border border-gray-300 rounded px-2 py-1 text-sm font-mono"
                            />
                        </div>
                        <div>
                            <label className="block text-xs text-gray-500 mb-1">Domain Max {isParametric ? '(t)' : '(x)'}</label>
                            <input 
                                type="text" 
                                value={domainMax}
                                onChange={e => setDomainMax(e.target.value)}
                                className="w-full border border-gray-300 rounded px-2 py-1 text-sm font-mono"
                            />
                        </div>
                    </div>

                    {!isParametric && (
                        <div>
                            <h3 className="text-sm font-semibold text-gray-700 mb-2">Plotter Engine</h3>
                            <select 
                                value={plotterType}
                                onChange={e => setPlotterType(e.target.value as any)}
                                className="w-full border border-gray-300 rounded px-3 py-2 text-sm"
                            >
                                <option value="standard">Standard</option>
                                <option value="experimental">Experimental (Inverse/Vertical)</option>
                            </select>
                        </div>
                    )}

                    <div>
                        <h3 className="text-sm font-semibold text-gray-700 mb-2">Basic Dots (h-spacing)</h3>
                        <div className="flex items-center gap-2 mb-2">
                            <input 
                                type="checkbox" 
                                checked={showDots}
                                onChange={e => setShowDots(e.target.checked)}
                            />
                            <span className="text-sm text-gray-600">Show Dots</span>
                        </div>
                        <input 
                            type="text" 
                            value={hSpacing}
                            onChange={e => setHSpacing(e.target.value)}
                            className="w-full border border-gray-300 rounded px-3 py-2 text-sm font-mono"
                            placeholder="e.g. 0.1"
                        />
                    </div>

                    <div>
                        <h3 className="text-sm font-semibold text-gray-700 mb-2">Curve</h3>
                        <div className="flex items-center gap-2 mb-2">
                            <input 
                                type="checkbox" 
                                checked={showCurve}
                                onChange={e => setShowCurve(e.target.checked)}
                            />
                            <span className="text-sm text-gray-600">Show Curve</span>
                        </div>
                        {plotterType === 'experimental' && (
                            <div className="flex items-center gap-2">
                                <input 
                                    type="checkbox" 
                                    checked={showControlPoints}
                                    onChange={e => setShowControlPoints(e.target.checked)}
                                />
                                <span className="text-sm text-gray-600">Show Control Points</span>
                            </div>
                        )}
                    </div>

                    <div className="pt-4 border-t border-gray-200">
                        <h3 className="text-sm font-semibold text-gray-700 mb-2">Navigation</h3>
                        <div className="grid grid-cols-2 gap-2 mb-2">
                            <button onClick={handleZoomIn} className="px-2 py-1 bg-gray-100 hover:bg-gray-200 rounded text-sm">Zoom In</button>
                            <button onClick={handleZoomOut} className="px-2 py-1 bg-gray-100 hover:bg-gray-200 rounded text-sm">Zoom Out</button>
                        </div>
                        <div className="grid grid-cols-3 gap-1 text-center">
                            <div></div>
                            <button onClick={() => handlePan(0, 1)} className="px-2 py-1 bg-gray-100 hover:bg-gray-200 rounded text-sm">↑</button>
                            <div></div>
                            <button onClick={() => handlePan(-1, 0)} className="px-2 py-1 bg-gray-100 hover:bg-gray-200 rounded text-sm">←</button>
                            <button onClick={() => handlePan(0, -1)} className="px-2 py-1 bg-gray-100 hover:bg-gray-200 rounded text-sm">↓</button>
                            <button onClick={() => handlePan(1, 0)} className="px-2 py-1 bg-gray-100 hover:bg-gray-200 rounded text-sm">→</button>
                        </div>
                    </div>
                </aside>

                <main className="flex-1 bg-gray-100 overflow-hidden relative flex items-center justify-center p-8">
                    <div className="bg-white shadow-2xl">
                        <svg 
                            id="plotter-tuning-svg"
                            width={engine.widthPixels} 
                            height={engine.heightPixels} 
                            viewBox={`0 0 ${engine.widthPixels} ${engine.heightPixels}`} 
                            xmlns="http://www.w3.org/2000/svg" 
                            style={{ display: 'block' }}
                        >
                            <rect x="0" y="0" width={engine.widthPixels} height={engine.heightPixels} fill="white" />
                            <g className="grid-layer">{engine.renderGrid()}</g>
                            <g className="axis-layer">{engine.renderAxes()}</g>
                            
                            <g className="curve-layer">
                                {renderFunctionPlots(engine, [funcDef])}
                            </g>

                            {showControlPoints && plotterType === 'experimental' && (
                                <g className="control-points-layer">
                                    {generateBezierSegments(engine, funcDef, 100).map((path, pathIdx) => (
                                        <g key={`cp-path-${pathIdx}`}>
                                            {path.segments.map((seg, segIdx) => (
                                                <g key={`cp-seg-${segIdx}`}>
                                                    <line x1={seg.p0[0]} y1={seg.p0[1]} x2={seg.cp1[0]} y2={seg.cp1[1]} stroke="#9ca3af" strokeWidth="1" strokeDasharray="2,2" />
                                                    <line x1={seg.p1[0]} y1={seg.p1[1]} x2={seg.cp2[0]} y2={seg.cp2[1]} stroke="#9ca3af" strokeWidth="1" strokeDasharray="2,2" />
                                                    <circle cx={seg.cp1[0]} cy={seg.cp1[1]} r="3" fill="#3b82f6" />
                                                    <circle cx={seg.cp2[0]} cy={seg.cp2[1]} r="3" fill="#3b82f6" />
                                                    <circle cx={seg.p0[0]} cy={seg.p0[1]} r="4" fill="white" stroke="#1f2937" strokeWidth="1.5" />
                                                    <circle cx={seg.p1[0]} cy={seg.p1[1]} r="4" fill="white" stroke="#1f2937" strokeWidth="1.5" />
                                                </g>
                                            ))}
                                        </g>
                                    ))}
                                </g>
                            )}

                            <g className="dots-layer">
                                {dots.map((pt, i) => {
                                    const [px, py] = engine.mathToScreen(pt.x, pt.y);
                                    return (
                                        <circle 
                                            key={i} 
                                            cx={px} 
                                            cy={py} 
                                            r={3} 
                                            fill="#ef4444" 
                                            stroke="white" 
                                            strokeWidth={1} 
                                        />
                                    );
                                })}
                            </g>
                        </svg>
                    </div>
                </main>
            </div>
        </div>
    );
};

export default PlotterTuningPage;
