const fs = require('fs');
let code = fs.readFileSync('pages/NetworkGrapher.tsx', 'utf8');

// 1. generateRegularPolygon
const regex1 = /const generateRegularPolygon = \(n: number, cx: number, cy: number, vertexStyle: VertexDisplayStyle = 'inside', width: number = 378, height: number = 302\): NetworkNode\[\] => \{/;
const replace1 = "const generateRegularPolygon = (n: number, cx: number, cy: number, vertexStyle: VertexDisplayStyle = 'inside', width: number = 378, height: number = 302, baseRadius: number = 6): NetworkNode[] => {";
code = code.replace(regex1, replace1);

code = code.replace(
    /const nodeRadius = vertexStyle === 'inside' \? 15 : 6; \/\/ To be replaced/,
    "const nodeRadius = vertexStyle === 'inside' ? baseRadius * 2.5 : baseRadius;"
);

// We need to update the calls to generateRegularPolygon
code = code.replace(
    /generateRegularPolygon\(initialVerticesCount, canvasWidth \/ 2, canvasHeight \/ 2, globalVertexStyle, canvasWidth, canvasHeight\)/g,
    "generateRegularPolygon(initialVerticesCount, canvasWidth / 2, canvasHeight / 2, globalVertexStyle, canvasWidth, canvasHeight, globalNodeRadius)"
);


// 2. applyMatrixToGraph
code = code.replace(
    /const nodeRadius = globalVertexStyle === 'inside' \? 15 : 6;/g,
    "const nodeRadius = globalVertexStyle === 'inside' ? globalNodeRadius * 2.5 : globalNodeRadius;"
);

fs.writeFileSync('pages/NetworkGrapher.tsx', code);
console.log('Fixed hardcoded radii.');
