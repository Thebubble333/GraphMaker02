const fs = require('fs');
let code = fs.readFileSync('pages/NetworkGrapher.tsx', 'utf8');

// I need to replace from the end of loopRadiusY to the start of canvasWidth.
const badRegex = /<SmartNumberInput[\s\S]*?value=\{Math.round\(canvasWidth \/ 37.7952755906 \* 10\) \/ 10\}[\s\S]*?className="w-full border rounded p-1.5 focus:ring-2 focus:ring-indigo-500 focus:outline-none text-sm"\s*step="0.1" min=\{1\} max=\{50\}\s*\/>/

const replacement = `<SmartNumberInput 
                                                step="0.1"
                                                className="w-full border rounded p-1.5 focus:ring-2 focus:ring-indigo-500 focus:outline-none text-sm"
                                                value={edges.find(e => e.id === singleSelectedEdge)?.loopRadiusY ?? 1.0}
                                                onChange={(val) => setEdges(edges.map(e2 => e2.id === singleSelectedEdge ? { ...e2, loopRadiusY: val } : e2))}
                                                min={0.1} max={10}
                                            />
                                        </div>
                                    </>
                                ) : (
                                    <label className="flex items-center gap-2 text-sm text-gray-700 mt-2">
                                        <input 
                                            type="checkbox" 
                                            checked={edges.find(e => e.id === singleSelectedEdge)?.isCurve || false}
                                            onChange={(e) => {
                                                const checked = e.target.checked;
                                                setEdges(edges.map(e2 => {
                                                    if (e2.id === singleSelectedEdge) {
                                                        if (checked && !e2.cp1) {
                                                            const fromNode = nodes.find(n => n.id === e2.from);
                                                            const toNode = nodes.find(n => n.id === e2.to);
                                                            if (fromNode && toNode) {
                                                                const mx = (fromNode.x + toNode.x) / 2;
                                                                const my = (fromNode.y + toNode.y) / 2;
                                                                const dx = toNode.x - fromNode.x;
                                                                const dy = toNode.y - fromNode.y;
                                                                const dist = Math.hypot(dx, dy) || 1;
                                                                const nx = -dy / dist;
                                                                const ny = dx / dist;
                                                                return { ...e2, isCurve: true, cp1: { x: mx + 35 * nx, y: my + 35 * ny } };
                                                            }
                                                        } else if (!checked) {
                                                            const { cp1, ...rest } = e2;
                                                            return { ...rest, isCurve: false };
                                                        }
                                                        return { ...e2, isCurve: checked };
                                                    }
                                                    return e2;
                                                }));
                                            }}
                                            className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                                        />
                                        Curved Edge
                                    </label>
                                )}
                                <button 
                                    className="w-full bg-red-50 text-red-600 border border-red-200 py-2 rounded text-sm font-medium flex items-center justify-center gap-2 hover:bg-red-100 transition-colors mt-4"
                                    onClick={() => {
                                        setEdges(edges.filter(e => e.id !== singleSelectedEdge));
                                        setSelectedEdges([]);
                                    }}
                                >
                                    <Trash2 size={16} /> Delete Edge
                                </button>
                            </div>
                        )}

                        {inputType === 'manual' && singleSelectedCut && (
                            <div className="space-y-4 bg-white p-4 rounded-lg border shadow-sm">
                                <h3 className="font-medium text-indigo-900">Cut Properties</h3>
                                <div>
                                    <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Label</label>
                                    <input 
                                        type="text" 
                                        className="w-full border rounded p-2 focus:ring-2 focus:ring-indigo-500 focus:outline-none text-sm"
                                        value={cuts.find(c => c.id === singleSelectedCut)?.label || ''}
                                        onChange={(e) => setCuts(cuts.map(c => c.id === singleSelectedCut ? { ...c, label: e.target.value } : c))}
                                    />
                                </div>
                                <button 
                                    className="w-full bg-red-50 text-red-600 border border-red-200 py-2 rounded text-sm font-medium flex items-center justify-center gap-2 hover:bg-red-100 transition-colors mt-4"
                                    onClick={() => {
                                        setCuts(cuts.filter(c => c.id !== singleSelectedCut));
                                        setSelectedCuts([]);
                                    }}
                                >
                                    <Trash2 size={16} /> Delete Cut
                                </button>
                            </div>
                        )}

                        <div className="space-y-4 bg-white p-4 rounded-lg border shadow-sm">
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
                                            />`;

code = code.replace(badRegex, replacement);
fs.writeFileSync('pages/NetworkGrapher.tsx', code);
