const fs = require('fs');
let code = fs.readFileSync('pages/NetworkGrapher.tsx', 'utf8');

code = code.replace(
    /onClick=\{\(\) => \{\n\s*setEdges\(edges\.filter\(e => e\.from !== singleSelectedNode && e\.to !== singleSelectedNode\)\);/g,
    "onClick={() => {\n                                        forceSnapshot();\n                                        setEdges(edges.filter(e => e.from !== singleSelectedNode && e.to !== singleSelectedNode));"
);

code = code.replace(
    /onClick=\{\(\) => \{\n\s*setEdges\(edges\.filter\(e => e\.id !== singleSelectedEdge\)\);/g,
    "onClick={() => {\n                                        forceSnapshot();\n                                        setEdges(edges.filter(e => e.id !== singleSelectedEdge));"
);

code = code.replace(
    /onClick=\{\(\) => \{\n\s*setCuts\(cuts\.filter\(c => c\.id !== singleSelectedCut\)\);/g,
    "onClick={() => {\n                                        forceSnapshot();\n                                        setCuts(cuts.filter(c => c.id !== singleSelectedCut));"
);

fs.writeFileSync('pages/NetworkGrapher.tsx', code);
console.log('Injected sidebar snapshots');
