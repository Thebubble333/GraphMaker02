const fs = require('fs');
let code = fs.readFileSync('pages/NetworkGrapher.tsx', 'utf8');

// 963: applyVertexStyle
code = code.replace(/    const applyVertexStyle = \(style: VertexDisplayStyle, targetNodeIds\?: string\[\]\) => \{[\s\S]*?\} else \{ \/\/ 'inside'[\s\S]*?\}[\s\S]*?\}\);[\s\S]*?setNodes\(prevNodes => \{/, `
    const applyVertexStyle = (style: VertexDisplayStyle, targetNodeIds?: string[]) => {
        const isTargeted = Boolean(targetNodeIds && targetNodeIds.length > 0);
        if (!isTargeted) {
            setGlobalVertexStyle(style);
        }
        const targetSet = new Set(targetNodeIds || []);
        
        let newNodes = nodes.map(node => {
            if (isTargeted && !targetSet.has(node.id)) {
                return node;
            }
            if (style === 'none') {
                return { ...node, labelStyle: 'none', radius: 6 };
            } else if (style === 'outside') {
                return { ...node, labelStyle: 'outside', radius: 6, labelOffset: node.labelOffset || {x: 15, y: -15} };
            } else { // 'inside'
                return { ...node, labelStyle: 'inside', radius: 15 };
            }
        });
        
        if (style === 'outside') {
            const opt = optimizeLabelPlacements(newNodes, edges, globalEdgeLabelProximity, style);
            newNodes = opt.nodes;
            setEdges(opt.edges);
        }
        
        setNodes(newNodes);
    };
    
    // a small comment to break the old setNodes(prevNodes => { ... })
    const obsoleteSetNodes = (x) => {
`);
// Wait, the regex might be brittle.
