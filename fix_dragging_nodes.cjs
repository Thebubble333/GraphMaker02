const fs = require('fs');
let code = fs.readFileSync('pages/NetworkGrapher.tsx', 'utf8');

const regex = /if \(draggingNodes\.length > 0\) \{\n\s*const nextNodes = dragInfo\.initialNodes\.map\(n => \n\s*draggingNodes\.includes\(n\.id\) \? \{ \.\.\.n, x: n\.x \+ dx, y: n\.y \+ dy \} : n\n\s*\);\n\s*setNodes\(nextNodes\);\n\s*setEdges\(dragInfo\.initialEdges\.map\(edge => \{([\s\S]*?)return edge;\n\s*\}\)\);\n\s*\}/;

const replacement = `if (draggingNodes.length > 0) {
                let nextNodes = dragInfo.initialNodes.map(n => 
                    draggingNodes.includes(n.id) ? { ...n, x: n.x + dx, y: n.y + dy } : n
                );
                
                let nextEdges = dragInfo.initialEdges.map(edge => {$1return edge;
                });
                
                if (livePhysicsUpdate) {
                    const opt = optimizeLabelPlacements(nextNodes, nextEdges, globalEdgeLabelProximity, globalVertexLabelProximity, edgeLabelClearanceRatio, globalVertexStyle, globalNodeRadius, 'all');
                    nextNodes = opt.nodes;
                    nextEdges = opt.edges;
                }
                
                setNodes(nextNodes);
                setEdges(nextEdges);
            }`;

code = code.replace(regex, replacement);

const cpRegex = /\} else if \(draggingCP\) \{\n\s*setEdges\(dragInfo\.initialEdges\.map\(edge => \{([\s\S]*?)return edge;\n\s*\}\)\);\n\s*\}/;
const cpReplacement = `} else if (draggingCP) {
                let nextEdges = dragInfo.initialEdges.map(edge => {$1return edge;
                });
                if (livePhysicsUpdate) {
                    const opt = optimizeLabelPlacements(nodes, nextEdges, globalEdgeLabelProximity, globalVertexLabelProximity, edgeLabelClearanceRatio, globalVertexStyle, globalNodeRadius, 'all');
                    setNodes(opt.nodes);
                    setEdges(opt.edges);
                } else {
                    setEdges(nextEdges);
                }
            }`;
code = code.replace(cpRegex, cpReplacement);

const dropRegex = /const handlePointerUp = \(\) => \{\n\s*setDraggingNodes\(\[\]\);\n\s*setDraggingCP\(null\);/;
const dropReplacement = `const handlePointerUp = () => {
        if ((draggingNodes.length > 0 || draggingCP !== null) && updateOnDrop && !livePhysicsUpdate) {
             // Let's ensure it runs after the state settles using setTimeout
             setTimeout(() => {
                 setNodes(currentNodes => {
                     setEdges(currentEdges => {
                          const opt = optimizeLabelPlacements(currentNodes, currentEdges, globalEdgeLabelProximity, globalVertexLabelProximity, edgeLabelClearanceRatio, globalVertexStyle, globalNodeRadius, 'all');
                          setNodes(opt.nodes);
                          return opt.edges;
                     });
                     return currentNodes; // Temporary, setNodes inside will override anyway, though React batched updates makes this a bit iffy. Let's do it safely.
                 });
             }, 0);
        }
        setDraggingNodes([]);
        setDraggingCP(null);`;
code = code.replace(dropRegex, dropReplacement);

fs.writeFileSync('pages/NetworkGrapher.tsx', code);
