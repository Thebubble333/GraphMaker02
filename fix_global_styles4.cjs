const fs = require('fs');
let code = fs.readFileSync('pages/NetworkGrapher.tsx', 'utf8');

const targetStr = '                        <div className="mt-8 border-t pt-4">';

const replacement = `                        <div className="space-y-4 bg-white p-4 rounded-lg border shadow-sm">
                            <h3 className="font-medium text-indigo-900">Global Styles</h3>
                            
                            <div className="space-y-3">
                                <div>
                                    <label className="block text-xs font-semibold text-gray-500 uppercase mb-2">Canvas Size (Printing)</label>
                                    <div className="flex items-center gap-2">
                                        <div>
                                            <label className="block text-xs font-semibold text-gray-500 mb-1">Width (cm)</label>
                                            <SmartNumberInput 
                                                value={Math.round(canvasWidth / 37.7952755906 * 10) / 10}
                                                onChange={(val) => setCanvasWidth(Math.max(100, Math.min(2000, Math.round(val * 37.7952755906))))}
                                                className="w-full border rounded p-1.5 focus:ring-2 focus:ring-indigo-500 focus:outline-none text-sm"
                                                step="0.1" min={1} max={50}
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-xs font-semibold text-gray-500 mb-1">Height (cm)</label>
                                            <SmartNumberInput 
                                                value={Math.round(canvasHeight / 37.7952755906 * 10) / 10}
                                                onChange={(val) => setCanvasHeight(Math.max(100, Math.min(2000, Math.round(val * 37.7952755906))))}
                                                className="w-full border rounded p-1.5 focus:ring-2 focus:ring-indigo-500 focus:outline-none text-sm"
                                                step="0.1" min={1} max={50}
                                            />
                                        </div>
                                    </div>
                                    <div className="grid grid-cols-2 gap-2 mt-2">
                                        <button className="text-xs bg-gray-100 hover:bg-gray-200 p-1.5 rounded" onClick={() => {setCanvasWidth(1123); setCanvasHeight(794);}}>A4 Land</button>
                                        <button className="text-xs bg-gray-100 hover:bg-gray-200 p-1.5 rounded" onClick={() => {setCanvasWidth(794); setCanvasHeight(1123);}}>A4 Port</button>
                                        <button className="text-xs bg-gray-100 hover:bg-gray-200 p-1.5 rounded" onClick={() => {setCanvasWidth(454); setCanvasHeight(302);}}>Small</button>
                                        <button className="text-xs bg-gray-100 hover:bg-gray-200 p-1.5 rounded text-indigo-700 font-medium" onClick={handleAutoFitCanvas}>Auto Fit</button>
                                    </div>
                                </div>

                                <div className="pt-2 border-t">
                                    <div>
                                        <label className="block text-xs font-semibold text-gray-500 mb-1">Font Size</label>
                                        <SmartNumberInput 
                                            value={globalFontSize}
                                            onChange={(val) => setGlobalFontSize(Math.max(8, Math.min(48, val)))}
                                            className="w-full border rounded p-1.5 focus:ring-2 focus:ring-indigo-500 focus:outline-none text-sm"
                                            min={8} max={48}
                                        />
                                    </div>
                                    <div className="mt-2">
                                        <label className="block text-xs font-semibold text-gray-500 mb-1">Edge Thickness</label>
                                        <SmartNumberInput 
                                            value={globalEdgeThickness}
                                            onChange={(val) => setGlobalEdgeThickness(Math.max(1, Math.min(10, val)))}
                                            className="w-full border rounded p-1.5 focus:ring-2 focus:ring-indigo-500 focus:outline-none text-sm"
                                            min={0.1} max={10} step="0.1"
                                        />
                                    </div>
                                    <div className="mt-2">
                                        <label className="block text-xs font-semibold text-gray-500 mb-1">Node/Handle Radius</label>
                                        <SmartNumberInput 
                                            value={globalNodeRadius}
                                            onChange={(val) => setGlobalNodeRadius(Math.max(2, Math.min(30, val)))}
                                            className="w-full border rounded p-1.5 focus:ring-2 focus:ring-indigo-500 focus:outline-none text-sm"
                                            min={2} max={30}
                                        />
                                    </div>
                                    <div className="mt-2">
                                        <label className="block text-xs font-semibold text-gray-500 mb-1">Label Proximity</label>
                                        <SmartNumberInput 
                                            value={globalEdgeLabelProximity}
                                            onChange={(val) => setGlobalEdgeLabelProximity(Math.max(-50, Math.min(100, val)))}
                                            className="w-full border rounded p-1.5 focus:ring-2 focus:ring-indigo-500 focus:outline-none text-sm"
                                            min={-50} max={100}
                                        />
                                    </div>
                                    <div className="mt-2">
                                        <label className="block text-xs font-semibold text-gray-500 mb-1">Vertex Label Style</label>
                                        <select
                                            value={globalVertexStyle}
                                            onChange={(e) => setGlobalVertexStyle(e.target.value as 'inside' | 'outside' | 'none')}
                                            className="w-full border rounded p-1.5 focus:ring-2 focus:ring-indigo-500 focus:outline-none text-sm bg-white"
                                        >
                                            <option value="inside">Inside Circle</option>
                                            <option value="outside">Outside Floating</option>
                                            <option value="none">Hidden</option>
                                        </select>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="mt-8 border-t pt-4">`;

if (code.includes(targetStr) && !code.includes('Global Styles')) {
    code = code.replace(targetStr, replacement);
    fs.writeFileSync('pages/NetworkGrapher.tsx', code);
    console.log('Fixed successfully');
} else {
    console.log('Target string not found or already fixed');
}
