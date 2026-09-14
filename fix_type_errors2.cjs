const fs = require('fs');

// We need to put the real `if (!res)` back.
// The regex was: ngCode.replace(/if \(!res || res\.error\)/g, "if (!res)");
let ngCode = fs.readFileSync('pages/NetworkGrapher.tsx', 'utf8');

// I should just use `res == null` since there was a problem.
ngCode = ngCode.replace(/const res: any = generateRegularNetwork\(/g, "const res: any = generateRegularNetwork(");
// wait, the problem is that `if (!res)` was removed globally.
// Let's find where it's supposed to be.
ngCode = ngCode.replace(/            const res: any = generateFromAdjacencyMatrix\(matrixInput, canvasWidth, canvasHeight, isDirectedGeneral, showMatrixWeights, layout\);\n            setNodes\(res\.nodes\);\n            setEdges\(res\.edges\);/g, "            const res: any = generateFromAdjacencyMatrix(matrixInput, canvasWidth, canvasHeight, isDirectedGeneral, showMatrixWeights, layout);\n            if (!res) return;\n            setNodes(res.nodes);\n            setEdges(res.edges);");
ngCode = ngCode.replace(/        const res: any = generateActivityNetwork\(precedenceInput, canvasWidth, canvasHeight\);\n        const adjustedNodes = res\.nodes\.map/g, "        const res: any = generateActivityNetwork(precedenceInput, canvasWidth, canvasHeight);\n        if (!res) return;\n        const adjustedNodes = res.nodes.map");

fs.writeFileSync('pages/NetworkGrapher.tsx', ngCode);
console.log('Fixed NetworkGrapher missing ifs.');
