const fs = require('fs');
let code = fs.readFileSync('pages/NetworkGrapher.tsx', 'utf8');

const regex = /            \} else if \(draggingEdgeLabel\) \{\n                setEdges\(dragInfo\.initialEdges\.map\(ed => \{\n                    if \(ed\.id === draggingEdgeLabel\) \{\n                        return \{ \.\.\.ed, labelOffset: \{ x: \(ed\.labelOffset\?\.x \|\| 0\) \+ dx, y: \(ed\.labelOffset\?\.y \|\| -15\) \+ dy \} \};\n                    \}\n                    return ed;\n                \}\)\);/;

const replacement = `            } else if (draggingEdgeLabel) {
                setEdges(dragInfo.initialEdges.map(ed => {
                    if (ed.id === draggingEdgeLabel) {
                        const fromNode = dragInfo.initialNodes.find(n => n.id === ed.from);
                        const toNode = dragInfo.initialNodes.find(n => n.id === ed.to);
                        
                        let baseOffX = ed.labelOffset?.x || 0;
                        let baseOffY = ed.labelOffset?.y || -15;
                        
                        let newOffX = baseOffX + dx;
                        let newOffY = baseOffY + dy;

                        if (fromNode && toNode && (e.shiftKey || e.ctrlKey || e.metaKey)) {
                            let outX = 0, outY = -1;
                            let midX, midY;
                            
                            if (ed.isLoop) {
                                midX = ed.cp1 ? ed.cp1.x : fromNode.x;
                                midY = ed.cp1 ? ed.cp1.y : fromNode.y - 60;
                                const ldx = midX - fromNode.x;
                                const ldy = midY - fromNode.y;
                                const ldist = Math.hypot(ldx, ldy) || 1;
                                outX = ldx / ldist;
                                outY = ldy / ldist;
                            } else {
                                if (ed.isCurve && ed.cp1) {
                                    midX = 0.25 * fromNode.x + 0.5 * ed.cp1.x + 0.25 * toNode.x;
                                    midY = 0.25 * fromNode.y + 0.5 * ed.cp1.y + 0.25 * toNode.y;
                                } else {
                                    midX = (fromNode.x + toNode.x) / 2;
                                    midY = (fromNode.y + toNode.y) / 2;
                                }
                                
                                const edx = toNode.x - fromNode.x;
                                const edy = toNode.y - fromNode.y;
                                const eDist = Math.hypot(edx, edy) || 1;
                                const normX = -edy / eDist;
                                const normY = edx / eDist;

                                const graphCenterX = dragInfo.initialNodes.length > 0 ? dragInfo.initialNodes.reduce((sum, n) => sum + n.x, 0) / dragInfo.initialNodes.length : canvasWidth / 2;
                                const graphCenterY = dragInfo.initialNodes.length > 0 ? dragInfo.initialNodes.reduce((sum, n) => sum + n.y, 0) / dragInfo.initialNodes.length : canvasHeight / 2;
                                const vcx = midX - graphCenterX;
                                const vcy = midY - graphCenterY;
                                const dot = normX * vcx + normY * vcy;
                                outX = dot >= 0 ? normX : -normX;
                                outY = dot >= 0 ? normY : -normY;
                            }
                            
                            const defOffX = outX * globalEdgeLabelProximity;
                            const defOffY = outY * globalEdgeLabelProximity;
                            
                            let targetVecX = defOffX + newOffX;
                            let targetVecY = defOffY + newOffY;
                            
                            if (e.shiftKey) {
                                const proj = targetVecX * outX + targetVecY * outY;
                                targetVecX = proj * outX;
                                targetVecY = proj * outY;
                            } else if (e.ctrlKey || e.metaKey) {
                                const initialVecX = defOffX + baseOffX;
                                const initialVecY = defOffY + baseOffY;
                                const radius = Math.hypot(initialVecX, initialVecY);
                                
                                const targetDist = Math.hypot(targetVecX, targetVecY) || 1;
                                targetVecX = (targetVecX / targetDist) * radius;
                                targetVecY = (targetVecY / targetDist) * radius;
                            }
                            
                            newOffX = targetVecX - defOffX;
                            newOffY = targetVecY - defOffY;
                        }

                        return { ...ed, labelOffset: { x: newOffX, y: newOffY } };
                    }
                    return ed;
                }));`;

if (regex.test(code)) {
    code = code.replace(regex, replacement);
    fs.writeFileSync('pages/NetworkGrapher.tsx', code);
    console.log('Successfully applied label drag snapping');
} else {
    console.log('Failed to find label drag logic');
}
