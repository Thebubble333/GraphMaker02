const fs = require('fs');
let code = fs.readFileSync('pages/NetworkGrapher.tsx', 'utf8');

const regex = /\}\)\s*\{\s*inputType === 'manual' && singleSelectedNode && \(/;

const newBlock = `)}
                        {inputType === 'manual' && !singleSelectedNode && !singleSelectedEdge && !singleSelectedCut && (
                            <div className="space-y-4">
                                <div className="space-y-2 bg-white p-4 rounded-lg border shadow-sm">
                                    <h3 className="font-medium text-indigo-900 text-sm">Initial Layout Generator</h3>
                                    <p className="text-xs text-gray-500 mb-2">Generate a circular arrangement of vertices to start your drawing.</p>
                                    <div className="flex items-center gap-2">
                                        <SmartNumberInput 
                                            value={initialVerticesCount}
                                            onChange={setInitialVerticesCount}
                                            className="w-16 border rounded p-1.5 text-sm"
                                            min={1} max={50}
                                        />
                                        <label className="text-sm font-medium text-gray-700">Vertices</label>
                                    </div>
                                    <button 
                                        className="w-full bg-indigo-50 text-indigo-700 border border-indigo-200 py-1.5 rounded text-sm font-medium hover:bg-indigo-100 transition-colors"
                                        onClick={() => {
                                            forceSnapshot();
                                            const newNodes = generateRegularPolygon(initialVerticesCount, canvasWidth / 2, canvasHeight / 2, globalVertexStyle, canvasWidth, canvasHeight);
                                            setNodes(newNodes);
                                        }}
                                    >
                                        Generate Circle Layout
                                    </button>
                                </div>
                            </div>
                        )}
                        {inputType === 'manual' && singleSelectedNode && (`

code = code.replace(regex, newBlock);

fs.writeFileSync('pages/NetworkGrapher.tsx', code);
console.log('Added Initial Layout Generator block');
