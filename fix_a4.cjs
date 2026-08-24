const fs = require('fs');
let code = fs.readFileSync('pages/NetworkGrapher.tsx', 'utf8');

// Replace A4 buttons
const a4Regex = /<button className="text-xs bg-gray-100 hover:bg-gray-200 p\.1\.5 rounded" onClick=\{\(\) => \{setCanvasWidth\(1123\); setCanvasHeight\(794\);\}\}>A4 Land<\/button>\s*<button className="text-xs bg-gray-100 hover:bg-gray-200 p\.1\.5 rounded" onClick=\{\(\) => \{setCanvasWidth\(794\); setCanvasHeight\(1123\);\}\}>A4 Port<\/button>\s*/;
code = code.replace(a4Regex, '');

// The actual code might use p-1.5
const a4Regex2 = /<button className="text-xs bg-gray-100 hover:bg-gray-200 p-1\.5 rounded" onClick=\{\(\) => \{setCanvasWidth\(1123\); setCanvasHeight\(794\);\}\}>A4 Land<\/button>\s*<button className="text-xs bg-gray-100 hover:bg-gray-200 p-1\.5 rounded" onClick=\{\(\) => \{setCanvasWidth\(794\); setCanvasHeight\(1123\);\}\}>A4 Port<\/button>\s*/;
code = code.replace(a4Regex2, '');

// Also add a "New Network" button next to "Clear Canvas"
const clearRegex = /<button className="w-full bg-white border border-gray-300 text-gray-700 py-2 rounded flex items-center justify-center gap-2 text-sm font-medium hover:bg-gray-50 transition-colors" onClick=\{\(\) => \{ setNodes\(\[\]\); setEdges\(\[\]\); setCuts\(\[\]\); setSelectedNodes\(\[\]\); setSelectedEdges\(\[\]\); setSelectedCuts\(\[\]\); \}\}>\s*Clear Canvas\s*<\/button>/;
const newButtons = `<div className="flex gap-2">
                                <button className="flex-1 bg-white border border-gray-300 text-gray-700 py-2 rounded flex items-center justify-center gap-2 text-sm font-medium hover:bg-gray-50 transition-colors" onClick={() => { setNodes([]); setEdges([]); setCuts([]); setSelectedNodes([]); setSelectedEdges([]); setSelectedCuts([]); }}>
                                    Clear Canvas
                                </button>
                                <button className="flex-1 bg-indigo-50 border border-indigo-200 text-indigo-700 py-2 rounded flex items-center justify-center gap-2 text-sm font-medium hover:bg-indigo-100 transition-colors" onClick={() => { setNodes([]); setEdges([]); setCuts([]); setSelectedNodes([]); setSelectedEdges([]); setSelectedCuts([]); forceSnapshot(); }}>
                                    New Network
                                </button>
                            </div>`;
code = code.replace(clearRegex, newButtons);

fs.writeFileSync('pages/NetworkGrapher.tsx', code);
console.log('Fixed A4 and New Network');
