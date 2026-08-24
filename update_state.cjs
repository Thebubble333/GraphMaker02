const fs = require('fs');
let code = fs.readFileSync('pages/NetworkGrapher.tsx', 'utf8');

const stateRegex = /const \[debugEdgeLabels, setDebugEdgeLabels\] = useState\(false\);/;
code = code.replace(stateRegex, `const [debugEdgeLabels, setDebugEdgeLabels] = useState(false);\n    const [livePhysicsUpdate, setLivePhysicsUpdate] = useState(false);\n    const [updateOnDrop, setUpdateOnDrop] = useState(false);`);

const btnRegex = /<button className="w-full bg-white border border-gray-300 text-gray-700 py-2 rounded flex items-center justify-center gap-2 text-sm font-medium hover:bg-gray-50 transition-colors" onClick=\{\(\) => \{\n\s*const opt = optimizeLabelPlacements\(nodes, edges, globalEdgeLabelProximity, globalVertexLabelProximity, edgeLabelClearanceRatio, globalVertexStyle, globalNodeRadius\);\n\s*forceSnapshot\(\);\n\s*setNodes\(opt\.nodes\);\n\s*setEdges\(opt\.edges\);\n\s*\}\}>\n\s*Auto-Place Labels \(Physics\)\n\s*<\/button>/;

const btnReplacement = `<div className="flex flex-col gap-2">
                                <button className="w-full bg-white border border-gray-300 text-gray-700 py-2 rounded flex items-center justify-center gap-2 text-sm font-medium hover:bg-gray-50 transition-colors shadow-sm" onClick={() => {
                                    const opt = optimizeLabelPlacements(nodes, edges, globalEdgeLabelProximity, globalVertexLabelProximity, edgeLabelClearanceRatio, globalVertexStyle, globalNodeRadius, 'all');
                                    forceSnapshot();
                                    setNodes(opt.nodes);
                                    setEdges(opt.edges);
                                }}>
                                    Auto-Place All Labels
                                </button>
                                <div className="flex gap-2">
                                    <button className="flex-1 bg-gray-50 text-gray-600 border border-gray-200 py-1.5 rounded flex items-center justify-center text-xs font-medium hover:bg-gray-100 transition-colors" onClick={() => {
                                        const opt = optimizeLabelPlacements(nodes, edges, globalEdgeLabelProximity, globalVertexLabelProximity, edgeLabelClearanceRatio, globalVertexStyle, globalNodeRadius, 'vertex');
                                        forceSnapshot();
                                        setNodes(opt.nodes);
                                    }}>
                                        Vertices Only
                                    </button>
                                    <button className="flex-1 bg-gray-50 text-gray-600 border border-gray-200 py-1.5 rounded flex items-center justify-center text-xs font-medium hover:bg-gray-100 transition-colors" onClick={() => {
                                        const opt = optimizeLabelPlacements(nodes, edges, globalEdgeLabelProximity, globalVertexLabelProximity, edgeLabelClearanceRatio, globalVertexStyle, globalNodeRadius, 'edge');
                                        forceSnapshot();
                                        setEdges(opt.edges);
                                    }}>
                                        Edges Only
                                    </button>
                                </div>
                                <div className="flex flex-col gap-1 mt-1">
                                    <label className="flex items-center gap-2 text-xs text-gray-600 cursor-pointer">
                                        <input type="checkbox" checked={livePhysicsUpdate} onChange={(e) => setLivePhysicsUpdate(e.target.checked)} className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500" />
                                        Live update during drag
                                    </label>
                                    <label className="flex items-center gap-2 text-xs text-gray-600 cursor-pointer">
                                        <input type="checkbox" checked={updateOnDrop} onChange={(e) => setUpdateOnDrop(e.target.checked)} className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500" />
                                        Auto-update after drag drop
                                    </label>
                                </div>
                            </div>`;
                            
code = code.replace(btnRegex, btnReplacement);
fs.writeFileSync('pages/NetworkGrapher.tsx', code);
