const fs = require('fs');
let code = fs.readFileSync('pages/NetworkGrapher.tsx', 'utf8');

// Update signature
const sigRegex = /export const optimizeLabelPlacements = \(\n    currentNodes: NetworkNode\[\],\n    currentEdges: NetworkEdge\[\],\n    globalEdgeLabelProximity: number,\n    globalVertexLabelProximity: number,\n    edgeLabelClearanceRatio: number,\n    globalVertexStyle: string\n\)/;

const newSig = `export const optimizeLabelPlacements = (
    currentNodes: NetworkNode[],
    currentEdges: NetworkEdge[],
    globalEdgeLabelProximity: number,
    globalVertexLabelProximity: number,
    edgeLabelClearanceRatio: number,
    globalVertexStyle: string,
    globalNodeRadius: number
)`;

code = code.replace(sigRegex, newSig);

// Update calls
// The calls are like: optimizeLabelPlacements(nodes, edges, globalEdgeLabelProximity, globalVertexLabelProximity, edgeLabelClearanceRatio, globalVertexStyle)
// Let's just do a regex replace for the calls.

const callRegex = /optimizeLabelPlacements\(([^,]+), ([^,]+), globalEdgeLabelProximity, globalVertexLabelProximity, edgeLabelClearanceRatio, ([a-zA-Z]+)\)/g;

code = code.replace(callRegex, (match, p1, p2, p3) => {
    return `optimizeLabelPlacements(${p1}, ${p2}, globalEdgeLabelProximity, globalVertexLabelProximity, edgeLabelClearanceRatio, ${p3}, globalNodeRadius)`;
});

fs.writeFileSync('pages/NetworkGrapher.tsx', code);
