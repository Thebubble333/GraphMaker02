const fs = require('fs');

// 1. Fix NetworkGrapher.tsx
let ngCode = fs.readFileSync('pages/NetworkGrapher.tsx', 'utf8');
ngCode = ngCode.replace(
    /setDragInfo\(\{ startX: coords\.x, startY: coords\.y, initialNodes: nodes, initialEdges: edges \}\);/g,
    "setDragInfo({ startX: coords.x, startY: coords.y, initialNodes: nodes, initialEdges: edges, initialCuts: cuts });"
);
// Fix the error properties on nodes/edges which don't exist
ngCode = ngCode.replace(/if \(!res \|\| res\.error\)/g, "if (!res)");
ngCode = ngCode.replace(/if \(!res || res\.error\)/g, "if (!res)");
ngCode = ngCode.replace(/const res = /g, "const res: any = ");
fs.writeFileSync('pages/NetworkGrapher.tsx', ngCode);

// 2. Fix functions.ts compiled2 error
let fCode = fs.readFileSync('utils/renderers/functions.ts', 'utf8');
fCode = fCode.replace(/const compiled2 = math\.compile\(f2\);/g, "const compiled2 = f2 ? math.compile(f2) : null;");
fs.writeFileSync('utils/renderers/functions.ts', fCode);

// 3. Fix complexLociRenderer previewScale error
let cCode = fs.readFileSync('utils/renderers/complexLociRenderer.ts', 'utf8');
cCode = cCode.replace(/const stroke = strokeWidth \/ \(engine\.previewScale \|\| 1\);/g, "const stroke = strokeWidth;");
fs.writeFileSync('utils/renderers/complexLociRenderer.ts', cCode);

console.log('Fixed some type errors.');
