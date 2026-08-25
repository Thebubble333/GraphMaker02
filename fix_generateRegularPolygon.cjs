const fs = require('fs');
let code = fs.readFileSync('pages/NetworkGrapher.tsx', 'utf8');

const oldFunc = /const generateRegularPolygon = \(n: number, cx: number, cy: number, vertexStyle: VertexDisplayStyle = 'inside'\): NetworkNode\[\] => \{\n\s*const radius = 200;\n\s*const rawNodes = Array\.from\(\{ length: n \}\)\.map\(\(\_, i\) => \{/;
const newFunc = `const generateRegularPolygon = (n: number, cx: number, cy: number, vertexStyle: VertexDisplayStyle = 'inside', width: number = 378, height: number = 302): NetworkNode[] => {
    const radius = Math.min(width, height) / 2 * 0.72;
    const rawNodes = Array.from({ length: n }).map((_, i) => {`;

code = code.replace(oldFunc, newFunc);

// Update calls to generateRegularPolygon
code = code.replace(/generateRegularPolygon\(initialVerticesCount, canvasWidth \/ 2, canvasHeight \/ 2\)/g, 'generateRegularPolygon(initialVerticesCount, canvasWidth / 2, canvasHeight / 2, globalVertexStyle, canvasWidth, canvasHeight)');

fs.writeFileSync('pages/NetworkGrapher.tsx', code);
console.log('Fixed generateRegularPolygon');
