const fs = require('fs');
let code = fs.readFileSync('pages/NetworkGrapher.tsx', 'utf8');

code = code.replace(
/const \[edgeLabelClearanceRatio, setEdgeLabelClearanceRatio\] = useState\(1\.5\);/,
"const [edgeLabelClearanceRatio, setEdgeLabelClearanceRatio] = useState(1.5);\n    const [debugEdgeLabels, setDebugEdgeLabels] = useState(false);"
);

// We need to add the button in the UI. Let's find the controls area.
// There is a <div className="mt-8 border-t pt-4 space-y-2"> where the optimize button is.
const buttonRegex = /<button className="w-full bg-white border border-gray-300 text-gray-700 py-2 rounded flex items-center justify-center gap-2 text-sm font-medium hover:bg-gray-50 transition-colors" onClick=\{\(\) => \{\n\s*const opt = optimizeLabelPlacements\([\s\S]*?\n\s*\}\}>\n\s*Auto-Place Labels\n\s*<\/button>/;

code = code.replace(buttonRegex, (match) => {
    return match + `\n                            <button className="w-full bg-white border border-gray-300 text-gray-700 py-2 rounded flex items-center justify-center gap-2 text-sm font-medium hover:bg-gray-50 transition-colors" onClick={() => setDebugEdgeLabels(!debugEdgeLabels)}>
                                {debugEdgeLabels ? 'Hide Physics Debug' : 'Show Physics Debug'}
                            </button>`;
});

fs.writeFileSync('pages/NetworkGrapher.tsx', code);
