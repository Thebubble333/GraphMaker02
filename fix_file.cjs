const fs = require('fs');
let code = fs.readFileSync('pages/NetworkGrapher.tsx', 'utf8');

// I'll manually replace the bad blocks with the correct ones.

// Block 1: The radius input at 2194
code = code.replace(
    /<div>\s*<label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Label<\/label>\s*<SmartNumberInput[\s\S]*?min=\{1\} max=\{100\}\s*\/>/,
    `<div>
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
                                    />`
);

// Block 2: The Edge Properties
code = code.replace(
    /<div>\s*<label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Label \/ Weight<\/label>\s*<SmartNumberInput[\s\S]*?min=\{0.1\} max=\{10\}\s*\/>/,
    `<div>
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
                                    <>
                                        <div className="mt-4">
                                            <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Loop Height</label>
                                            <SmartNumberInput 
                                                step="0.1"
                                                className="w-full border rounded p-1.5 focus:ring-2 focus:ring-indigo-500 focus:outline-none text-sm"
                                                value={edges.find(e => e.id === singleSelectedEdge)?.loopRadiusY ?? 1.0}
                                                onChange={(val) => setEdges(edges.map(e2 => e2.id === singleSelectedEdge ? { ...e2, loopRadiusY: val } : e2))}
                                                min={0.1} max={10}
                                            />`
);

// Block 3: Edge curve checkbox missing before canvas width... wait, what was in between?
// Let's check my grep output from earlier!
fs.writeFileSync('pages/NetworkGrapher.tsx', code);
