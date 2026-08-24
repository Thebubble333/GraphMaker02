const fs = require('fs');
let code = fs.readFileSync('pages/NetworkGrapher.tsx', 'utf8');

// The corrupted block starts at line 2170: `<SmartNumberInput` 
// and goes to line 2315: `)}`
// Let's just find the exact text we need to replace.
// Looking at my previous logs, the start of the corruption is right after:
// <div className="space-y-2 bg-white p-2.5 rounded border">
// <div className="flex items-center gap-2">

let beforeStr = `<div className="space-y-2 bg-white p-2.5 rounded border">
                                    <div className="flex items-center gap-2">`;
let afterStr = `<div className="mt-8 border-t pt-4">`;

let startIdx = code.indexOf(beforeStr);
let endIdx = code.indexOf(afterStr);

if (startIdx === -1 || endIdx === -1) {
    console.log("Could not find boundaries.");
    process.exit(1);
}

const newJSX = beforeStr + `
                                        <SmartNumberInput 
                                            value={initialVerticesCount}
                                            onChange={setInitialVerticesCount}
                                            className="w-16 border rounded p-1.5 text-sm"
                                            min={1} max={50}
                                        />
                                        <label className="text-sm font-medium text-gray-700">Initial Vertices</label>
                                    </div>
                                    <button 
                                        className="w-full bg-indigo-50 text-indigo-700 border border-indigo-200 py-1.5 rounded text-sm font-medium hover:bg-indigo-100 transition-colors"
                                        onClick={() => {
                                            const newNodes = generateRegularPolygon(initialVerticesCount, canvasWidth / 2, canvasHeight / 2);
                                            setNodes(newNodes);
                                        }}
                                    >
                                        Generate Initial Layout
                                    </button>
                                </div>
                            </div>
                        )}

                        {inputType === 'manual' && singleSelectedNode && (
                            <div className="space-y-4 bg-white p-4 rounded-lg border shadow-sm">
                                <h3 className="font-medium text-indigo-900">Vertex Properties</h3>
                                <div>
                                    <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Label</label>
                                    <input 
                                        type="text" 
                                        className="w-full border rounded p-2 focus:ring-2 focus:ring-indigo-500 focus:outline-none text-sm"
                                        value={nodes.find(n => n.id === singleSelectedNode)?.label || ''}
                                        onChange={(e) => setNodes(nodes.map(n => n.id === singleSelectedNode ? { ...n, label: e.target.value } : n))}
                                    />
                                </div>
                                <div className="mt-4">
                                    <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Radius</label>
                                    <SmartNumberInput 
                                        className="w-full border rounded p-2 focus:ring-2 focus:ring-indigo-500 focus:outline-none text-sm"
                                        value={nodes.find(n => n.id === singleSelectedNode)?.radius || 6}
                                        onChange={(val) => setNodes(nodes.map(n => n.id === singleSelectedNode ? { ...n, radius: val } : n))}
                                        min={1} max={100}
                                    />
                                </div>
                                <button 
                                    className="w-full bg-red-50 text-red-600 border border-red-200 py-2 rounded text-sm font-medium flex items-center justify-center gap-2 hover:bg-red-100 transition-colors mt-4"
                                    onClick={() => {
                                        setEdges(edges.filter(e => e.from !== singleSelectedNode && e.to !== singleSelectedNode));
                                        setNodes(nodes.filter(n => n.id !== singleSelectedNode));
                                        setSelectedNodes([]);
                                    }}
                                >
                                    <Trash2 size={16} /> Delete Vertex
                                </button>
                            </div>
                        )}

                        {inputType === 'manual' && singleSelectedEdge && (
                            <div className="space-y-4 bg-white p-4 rounded-lg border shadow-sm">
                                <h3 className="font-medium text-indigo-900">Edge Properties</h3>
                                <div>
                                    <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Label / Weight</label>
                                    <input 
                                        type="text" 
                                        className="w-full border rounded p-2 focus:ring-2 focus:ring-indigo-500 focus:outline-none text-sm"
                                        value={edges.find(e => e.id === singleSelectedEdge)?.label || ''}
                                        onChange={(e) => setEdges(edges.map(e2 => e2.id === singleSelectedEdge ? { ...e2, label: e.target.value } : e2))}
                                    />
                                </div>
                                <div className="mt-2 space-y-2">
                                    <label className="flex items-center gap-2 text-sm text-gray-700">
                                        <input 
                                            type="checkbox" 
                                            checked={edges.find(e => e.id === singleSelectedEdge)?.isDirected || false}
                                            onChange={(e) => setEdges(edges.map(e2 => e2.id === singleSelectedEdge ? { ...e2, isDirected: e.target.checked } : e2))}
                                            className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                                        />
                                        Directed Edge
                                    </label>
                                    <label className="flex items-center gap-2 text-sm text-gray-700">
                                        <input 
                                            type="checkbox" 
                                            checked={edges.find(e => e.id === singleSelectedEdge)?.isDummy || false}
                                            onChange={(e) => setEdges(edges.map(e2 => e2.id === singleSelectedEdge ? { ...e2, isDummy: e.target.checked } : e2))}
                                            className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                                        />
                                        Dummy (Dashed)
                                    </label>
                                </div>

                                {edges.find(e => e.id === singleSelectedEdge)?.isLoop ? (
                                    <div className="mt-4">
                                        <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Loop Height</label>
                                        <SmartNumberInput 
                                            step="0.1"
                                            className="w-full border rounded p-1.5 focus:ring-2 focus:ring-indigo-500 focus:outline-none text-sm"
                                            value={edges.find(e => e.id === singleSelectedEdge)?.loopRadiusY ?? 1.0}
                                            onChange={(val) => setEdges(edges.map(e2 => e2.id === singleSelectedEdge ? { ...e2, loopRadiusY: val } : e2))}
                                            min={0.1} max={10}
                                        />
                                    </div>
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
                        \n` + afterStr;

let newCode = code.substring(0, startIdx) + newJSX + code.substring(endIdx + afterStr.length);
fs.writeFileSync('pages/NetworkGrapher.tsx', newCode);
