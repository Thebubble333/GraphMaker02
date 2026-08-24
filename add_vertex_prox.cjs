const fs = require('fs');
let code = fs.readFileSync('pages/NetworkGrapher.tsx', 'utf8');

// 1. Add to optimizeLabelPlacements signature
code = code.replace(
/    globalEdgeLabelProximity: number,\n    globalVertexStyle: string/g,
"    globalEdgeLabelProximity: number,\n    globalVertexLabelProximity: number,\n    globalVertexStyle: string"
);

// 2. Add state
code = code.replace(
/const \[globalEdgeLabelProximity, setGlobalEdgeLabelProximity\] = useState\(8\);/g,
"const [globalEdgeLabelProximity, setGlobalEdgeLabelProximity] = useState(8);\n    const [globalVertexLabelProximity, setGlobalVertexLabelProximity] = useState(15);"
);

// 3. Add to load URL params
code = code.replace(
/globalNodeRadius, globalEdgeLabelProximity, inputType/g,
"globalNodeRadius, globalEdgeLabelProximity, globalVertexLabelProximity, inputType"
);

code = code.replace(
/if \(state\.globalEdgeLabelProximity\) setGlobalEdgeLabelProximity\(state\.globalEdgeLabelProximity\);/g,
"if (state.globalEdgeLabelProximity) setGlobalEdgeLabelProximity(state.globalEdgeLabelProximity);\n        if (state.globalVertexLabelProximity) setGlobalVertexLabelProximity(state.globalVertexLabelProximity);"
);

// 4. Update all calls to optimizeLabelPlacements
code = code.replace(
/optimizeLabelPlacements\(newNodes, edges, globalEdgeLabelProximity, style\)/g,
"optimizeLabelPlacements(newNodes, edges, globalEdgeLabelProximity, globalVertexLabelProximity, style)"
);
code = code.replace(
/optimizeLabelPlacements\(currentNodes, newEdges, globalEdgeLabelProximity, globalVertexStyle\)/g,
"optimizeLabelPlacements(currentNodes, newEdges, globalEdgeLabelProximity, globalVertexLabelProximity, globalVertexStyle)"
);
code = code.replace(
/optimizeLabelPlacements\(adjustedNodes, adjustedEdges, globalEdgeLabelProximity, globalVertexStyle\)/g,
"optimizeLabelPlacements(adjustedNodes, adjustedEdges, globalEdgeLabelProximity, globalVertexLabelProximity, globalVertexStyle)"
);
code = code.replace(
/optimizeLabelPlacements\(allNodes, edges, globalEdgeLabelProximity, globalVertexStyle\)/g,
"optimizeLabelPlacements(allNodes, edges, globalEdgeLabelProximity, globalVertexLabelProximity, globalVertexStyle)"
);
code = code.replace(
/optimizeLabelPlacements\(nodes, edges, globalEdgeLabelProximity, globalVertexStyle\)/g,
"optimizeLabelPlacements(nodes, edges, globalEdgeLabelProximity, globalVertexLabelProximity, globalVertexStyle)"
);

// 5. Add to UI
code = code.replace(
/<label className="block text-xs font-semibold text-gray-500 mb-1">Label Proximity<\/label>[\s\S]*?onChange=\{\(val\) => setGlobalEdgeLabelProximity\(Math.max\(-50, Math.min\(100, val\)\)\)\}[\s\S]*?className="w-full border rounded p-1.5 focus:ring-2 focus:ring-indigo-500 focus:outline-none text-sm"[\s\S]*?\/>/g,
`<label className="block text-xs font-semibold text-gray-500 mb-1">Edge Label Prox.</label>
                                        <SmartNumberInput 
                                            value={globalEdgeLabelProximity}
                                            onChange={(val) => setGlobalEdgeLabelProximity(Math.max(-50, Math.min(100, val)))}
                                            className="w-full border rounded p-1.5 focus:ring-2 focus:ring-indigo-500 focus:outline-none text-sm"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-semibold text-gray-500 mb-1">Vertex Label Prox.</label>
                                        <SmartNumberInput 
                                            value={globalVertexLabelProximity}
                                            onChange={(val) => setGlobalVertexLabelProximity(Math.max(-50, Math.min(100, val)))}
                                            className="w-full border rounded p-1.5 focus:ring-2 focus:ring-indigo-500 focus:outline-none text-sm"
                                        />`
);

// 6. Fix `simNodes` in optimizeLabelPlacements to use `globalVertexLabelProximity`
// "let r = Math.hypot(baseDx, baseDy);" => "let r = globalVertexLabelProximity;"
code = code.replace(
/let r = Math\.hypot\(baseDx, baseDy\);[\s\S]*?let theta = Math\.atan2\(baseDy, baseDx\);/g,
"let r = globalVertexLabelProximity;\n        let theta = Math.atan2(baseDy, baseDx);"
);

fs.writeFileSync('pages/NetworkGrapher.tsx', code);
console.log('Added globalVertexLabelProximity');
