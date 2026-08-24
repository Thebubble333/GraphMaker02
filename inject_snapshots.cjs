const fs = require('fs');
let code = fs.readFileSync('pages/NetworkGrapher.tsx', 'utf8');

// Inject forceSnapshot into handleSvgPointerDown
code = code.replace(
    /const handleSvgPointerDown = \(e: ReactMouseEvent\) => \{/,
    "const handleSvgPointerDown = (e: ReactMouseEvent) => {\n        forceSnapshot();"
);

// Inject forceSnapshot into handleNodePointerDown
code = code.replace(
    /const handleNodePointerDown = \(e: ReactMouseEvent, nodeId: string\) => \{/,
    "const handleNodePointerDown = (e: ReactMouseEvent, nodeId: string) => {\n        forceSnapshot();"
);

// Inject forceSnapshot into handleEdgePointerDown
code = code.replace(
    /const handleEdgePointerDown = \(e: ReactMouseEvent, edgeId: string\) => \{/,
    "const handleEdgePointerDown = (e: ReactMouseEvent, edgeId: string) => {\n        forceSnapshot();"
);

// Inject forceSnapshot into handleCutPointerDown
code = code.replace(
    /const handleCutPointerDown = \(e: ReactMouseEvent, cutId: string\) => \{/,
    "const handleCutPointerDown = (e: ReactMouseEvent, cutId: string) => {\n        forceSnapshot();"
);

// Inject forceSnapshot into handleCutElementPointerDown
code = code.replace(
    /const handleCutElementPointerDown = \(e: ReactMouseEvent, cutId: string, nodeId: string, type: 'node' \| 'cp1' \| 'cp2'\) => \{/,
    "const handleCutElementPointerDown = (e: ReactMouseEvent, cutId: string, nodeId: string, type: 'node' | 'cp1' | 'cp2') => {\n        forceSnapshot();"
);

// Inject forceSnapshot into handleKeyDown
code = code.replace(
    /const handleKeyDown = \(e: KeyboardEvent\) => \{\n\s*if \(e\.key === 'Backspace' \|\| e\.key === 'Delete'\) \{/,
    "const handleKeyDown = (e: KeyboardEvent) => {\n            if (e.key === 'Backspace' || e.key === 'Delete') {\n                forceSnapshot();"
);

fs.writeFileSync('pages/NetworkGrapher.tsx', code);
console.log('Injected forceSnapshot');
