const fs = require('fs');
let code = fs.readFileSync('pages/NetworkGrapher.tsx', 'utf8');

// Undo the setNodes inside setEdges nested hack and use closure values directly
const badDropRegex = /const handlePointerUp = \(\) => \{\n\s*if \(\(draggingNodes\.length > 0 \|\| draggingCP !== null\) && updateOnDrop && !livePhysicsUpdate\) \{\n\s*\/\/ Let's ensure it runs after the state settles using setTimeout\n\s*setTimeout\(\(\) => \{\n\s*setNodes\(currentNodes => \{\n\s*setEdges\(currentEdges => \{\n\s*const opt = optimizeLabelPlacements\(currentNodes, currentEdges, globalEdgeLabelProximity, globalVertexLabelProximity, edgeLabelClearanceRatio, globalVertexStyle, globalNodeRadius, 'all'\);\n\s*setNodes\(opt\.nodes\);\n\s*return opt\.edges;\n\s*\}\);\n\s*return currentNodes; \/\/ Temporary, setNodes inside will override anyway, though React batched updates makes this a bit iffy\. Let's do it safely\.\n\s*\}\);\n\s*\}, 0\);\n\s*\}\n\s*setDraggingNodes\(\[\]\);\n\s*setDraggingCP\(null\);/;

const goodDropReplacement = `const handlePointerUp = () => {
        if ((draggingNodes.length > 0 || draggingCP !== null) && updateOnDrop && !livePhysicsUpdate) {
            // We use the local closure of nodes and edges which represent the final drag state!
            // Wait, the closure holds the state BEFORE the final setNodes(nextNodes) completes?
            // Actually, handlePointerMove already updated nodes and edges on the last frame of the drag!
            // So 'nodes' and 'edges' in this closure ARE the fully dragged final positions.
            const opt = optimizeLabelPlacements(nodes, edges, globalEdgeLabelProximity, globalVertexLabelProximity, edgeLabelClearanceRatio, globalVertexStyle, globalNodeRadius, 'all');
            setNodes(opt.nodes);
            setEdges(opt.edges);
        }
        setDraggingNodes([]);
        setDraggingCP(null);`;

code = code.replace(badDropRegex, goodDropReplacement);
fs.writeFileSync('pages/NetworkGrapher.tsx', code);
