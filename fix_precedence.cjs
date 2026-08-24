const fs = require('fs');
let code = fs.readFileSync('pages/NetworkGrapher.tsx', 'utf8');
const lines = code.split('\n');

const startIndex = lines.findIndex(l => l.includes('Generate Initial Layout'));
if (startIndex !== -1) {
    const manualIndex = lines.findIndex((l, i) => i > startIndex && l.includes("inputType === 'manual' && singleSelectedNode && ("));
    if (manualIndex !== -1) {
        const precedenceBlock = `                        )}

                        {inputType === 'precedence' && (
                            <div className="space-y-4">
                                <div>
                                    <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Load Preset</label>
                                    <select 
                                        className="w-full border rounded p-2 focus:ring-2 focus:ring-indigo-500 focus:outline-none text-sm bg-white"
                                        onChange={(e) => {
                                            const preset = PRECEDENCE_PRESETS.find(p => p.name === e.target.value);
                                            if (preset) {
                                                setPrecedenceInput(preset.value);
                                                const res = generateActivityNetwork(preset.value, canvasWidth, canvasHeight);
                                                if (!res.error) {
                                                    setNodes(res.nodes);
                                                    setEdges(res.edges);
                                                    forceSnapshot();
                                                }
                                            }
                                        }}
                                        defaultValue=""
                                    >
                                        <option value="" disabled>Select a preset...</option>
                                        {PRECEDENCE_PRESETS.map(p => (
                                            <option key={p.name} value={p.name}>{p.name}</option>
                                        ))}
                                    </select>
                                </div>
                                <div className="space-y-1">
                                    <label className="block text-xs font-semibold text-gray-500 uppercase">Precedence Table</label>
                                    <p className="text-xs text-gray-500">Format: Name, Dependencies, Duration (e.g. A, -, 5 or D, A;B, 4)</p>
                                </div>
                                <textarea
                                    className="w-full h-48 border rounded p-2 focus:ring-2 focus:ring-indigo-500 focus:outline-none font-mono text-sm whitespace-pre font-medium"
                                    value={precedenceInput}
                                    onChange={(e) => setPrecedenceInput(e.target.value)}
                                    placeholder="A, -, 5\\nB, A, 2..."
                                />
                                <button
                                    onClick={() => {
                                        const res = generateActivityNetwork(precedenceInput, canvasWidth, canvasHeight);
                                        if (res.error) alert(res.error);
                                        else { setNodes(res.nodes); setEdges(res.edges); setInputType('manual'); forceSnapshot(); }
                                    }}
                                    className="w-full bg-indigo-600 text-white py-2 rounded text-sm font-medium hover:bg-indigo-700 transition-colors shadow-sm"
                                >
                                    Generate Activity Network
                                </button>
                            </div>
                        `;
        
        lines.splice(manualIndex - 1, 1, precedenceBlock);
        fs.writeFileSync('pages/NetworkGrapher.tsx', lines.join('\n'));
        console.log('Fixed precedence table via array index');
    }
}
