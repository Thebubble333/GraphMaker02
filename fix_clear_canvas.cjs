const fs = require('fs');
let code = fs.readFileSync('pages/NetworkGrapher.tsx', 'utf8');

code = code.replace(
    /onClick=\{\(\) => \{ setNodes\(\[\]\); setEdges\(\[\]\); setCuts\(\[\]\); setSelectedNodes\(\[\]\); setSelectedEdges\(\[\]\); setSelectedCuts\(\[\]\); \}\}>\s*Clear Canvas/g,
    "onClick={() => { forceSnapshot(); setNodes([]); setEdges([]); setCuts([]); setSelectedNodes([]); setSelectedEdges([]); setSelectedCuts([]); }}>\n                                    Clear Canvas"
);

fs.writeFileSync('pages/NetworkGrapher.tsx', code);
console.log('Fixed Clear Canvas snapshot');
