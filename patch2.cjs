const fs = require('fs');
let code = fs.readFileSync('pages/NetworkGrapher.tsx', 'utf8');

const handlers = `
    const handleClearAll = () => {
        forceSnapshot();
        setNodes([]);
        setEdges([]);
        setCuts([]);
        setSelectedNodes([]);
        setSelectedEdges([]);
        setSelectedCuts([]);
    };

    const handleDefaultSettings = () => {
        forceSnapshot();
        setCanvasWidth(378);
        setCanvasHeight(302);
        setGlobalEdgeThickness(1.5);
        setGlobalFontSize(11);
        setGlobalNodeRadius(5);
        setGlobalEdgeLabelProximity(8);
        setGlobalVertexLabelProximity(15);
        setEdgeLabelClearanceRatio(1.5);
        setGlobalVertexStyle('inside');
    };

    const handleAutoFitCanvas`;

code = code.replace(/const handleAutoFitCanvas/, handlers);

// Update GraphToolbar props
const toolbarRegex = /onImportData=\{importFromFile\}\n\s*\/>/;
code = code.replace(toolbarRegex, `onImportData={importFromFile}\n                        onClearAll={handleClearAll}\n                        onDefaultSettings={handleDefaultSettings}\n                    />`);

// Remove old buttons:
// <div className="flex gap-2">
// <button className="flex-1 bg-white border border-gray-300 text-gray-700 py-2 rounded flex items-center justify-center gap-2 text-sm font-medium hover:bg-gray-50 transition-colors" onClick={() => { forceSnapshot(); setNodes([]); setEdges([]); setCuts([]); setSelectedNodes([]); setSelectedEdges([]); setSelectedCuts([]); }}>
// Clear Canvas
// </button>
// <button className="flex-1 bg-indigo-50 border border-indigo-200 text-indigo-700 py-2 rounded flex items-center justify-center gap-2 text-sm font-medium hover:bg-indigo-100 transition-colors" onClick={() => { setNodes([]); setEdges([]); setCuts([]); setSelectedNodes([]); setSelectedEdges([]); setSelectedCuts([]); forceSnapshot(); }}>
// New Network
// </button>
// </div>

const oldButtonsRegex = /<div className="flex gap-2">\s*<button className="flex-1 bg-white border border-gray-300 text-gray-700 py-2 rounded flex items-center justify-center gap-2 text-sm font-medium hover:bg-gray-50 transition-colors" onClick=\{\(\) => \{ forceSnapshot\(\); setNodes\(\[\]\); setEdges\(\[\]\); setCuts\(\[\]\); setSelectedNodes\(\[\]\); setSelectedEdges\(\[\]\); setSelectedCuts\(\[\]\); \}\}>\s*Clear Canvas\s*<\/button>\s*<button className="flex-1 bg-indigo-50 border border-indigo-200 text-indigo-700 py-2 rounded flex items-center justify-center gap-2 text-sm font-medium hover:bg-indigo-100 transition-colors" onClick=\{\(\) => \{ setNodes\(\[\]\); setEdges\(\[\]\); setCuts\(\[\]\); setSelectedNodes\(\[\]\); setSelectedEdges\(\[\]\); setSelectedCuts\(\[\]\); forceSnapshot\(\); \}\}>\s*New Network\s*<\/button>\s*<\/div>/;

if (!oldButtonsRegex.test(code)) {
    console.log("Could not find old buttons block to remove.");
}

code = code.replace(oldButtonsRegex, '');

fs.writeFileSync('pages/NetworkGrapher.tsx', code);
console.log('App patched.');
