const fs = require('fs');
let code = fs.readFileSync('pages/NetworkGrapher.tsx', 'utf8');

const debugBtnRegex = /<button className="w-full bg-white border border-gray-300 text-gray-700 py-2 rounded flex items-center justify-center gap-2 text-sm font-medium hover:bg-gray-50 transition-colors" onClick=\{\(\) => setDebugEdgeLabels\(!debugEdgeLabels\)\}>\n\s*\{debugEdgeLabels \? 'Hide Physics Debug' : 'Show Physics Debug'\}\n\s*<\/button>/;

const match = code.match(debugBtnRegex);
if (match) {
    code = code.replace(match[0], '');
    
    // Add it to the settings block which I just inserted
    const settingsTabRegex = /(\{inputType === 'settings' && \(\n\s*<div className="space-y-4">\n\s*<div className="space-y-4 bg-white p-4 rounded-lg border shadow-sm">)/;
    code = code.replace(settingsTabRegex, (m, p1) => {
        return p1 + `\n<div className="mb-4">\n${match[0]}\n</div>\n`;
    });
    
    fs.writeFileSync('pages/NetworkGrapher.tsx', code);
    console.log("Moved debug button to Settings tab");
}
