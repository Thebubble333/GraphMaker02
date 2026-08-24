const fs = require('fs');
let code = fs.readFileSync('pages/NetworkGrapher.tsx', 'utf8');

// Replace vertex label dragging
const vertexDragRegex = /if \(e\.shiftKey\) \{\n\s*let incidentAngles: number\[\] = \[\];\n\s*dragInfo\.initialEdges\.forEach\(ed => \{[\s\S]*?newOffY = bestLine\.y \* bestProj;\n\s*\}\n\s*\}/;

const vertexDragReplacement = `const isCtrl = e.ctrlKey || e.metaKey;
                        const isShift = e.shiftKey;

                        if (isShift && isCtrl) {
                            let angle = Math.atan2(newOffY, newOffX);
                            angle = Math.round(angle / (Math.PI / 4)) * (Math.PI / 4);
                            newOffX = Math.cos(angle) * globalVertexLabelProximity;
                            newOffY = Math.sin(angle) * globalVertexLabelProximity;
                        } else if (isShift) {
                            let incidentAngles: number[] = [];
                            dragInfo.initialEdges.forEach(ed => {
                                if (ed.from === n.id && ed.to === n.id) {
                                    let cpY = ed.cp1 ? ed.cp1.y : n.y - 60;
                                    let cpX = ed.cp1 ? ed.cp1.x : n.x;
                                    incidentAngles.push(Math.atan2(cpY - n.y, cpX - n.x));
                                } else if (ed.from === n.id) {
                                    let tn = dragInfo.initialNodes.find(t => t.id === ed.to);
                                    if (tn) incidentAngles.push(Math.atan2(tn.y - n.y, tn.x - n.x));
                                } else if (ed.to === n.id) {
                                    let fn = dragInfo.initialNodes.find(f => f.id === ed.from);
                                    if (fn) incidentAngles.push(Math.atan2(fn.y - n.y, fn.x - n.x));
                                }
                            });
                            
                            if (incidentAngles.length > 0) {
                                let currentAngle = Math.atan2(newOffY, newOffX);
                                let currentDist = Math.hypot(newOffX, newOffY);
                                
                                let bestLine = { x: Math.cos(currentAngle), y: Math.sin(currentAngle) };
                                let minDistance = Infinity;
                                let bestProj = 0;
                                
                                incidentAngles.forEach(ang => {
                                    let ux = Math.cos(ang);
                                    let uy = Math.sin(ang);
                                    
                                    let dist = Math.abs(-uy * newOffX + ux * newOffY);
                                    let proj = newOffX * ux + newOffY * uy;
                                    
                                    if (dist < minDistance) {
                                        minDistance = dist;
                                        bestLine = { x: ux, y: uy };
                                        bestProj = proj;
                                    }
                                });
                                
                                newOffX = bestLine.x * bestProj;
                                newOffY = bestLine.y * bestProj;
                            }
                        } else if (isCtrl) {
                             let dist = Math.hypot(newOffX, newOffY) || 1;
                             newOffX = (newOffX / dist) * globalVertexLabelProximity;
                             newOffY = (newOffY / dist) * globalVertexLabelProximity;
                        }`;

code = code.replace(vertexDragRegex, vertexDragReplacement);

// Replace edge label dragging
const edgeDragRegex = /if \(e\.shiftKey\) \{\n\s*const proj = targetVecX \* outX \+ targetVecY \* outY;\n\s*targetVecX = proj \* outX;\n\s*targetVecY = proj \* outY;\n\s*\} else if \(e\.ctrlKey \|\| e\.metaKey\) \{\n\s*const initialVecX = defOffX \+ baseOffX;\n\s*const initialVecY = defOffY \+ baseOffY;\n\s*const radius = Math\.hypot\(initialVecX, initialVecY\);\n\s*const targetDist = Math\.hypot\(targetVecX, targetVecY\) \|\| 1;\n\s*targetVecX = \(targetVecX \/ targetDist\) \* radius;\n\s*targetVecY = \(targetVecY \/ targetDist\) \* radius;\n\s*\}/;

const edgeDragReplacement = `const isCtrl = e.ctrlKey || e.metaKey;
                            const isShift = e.shiftKey;

                            if (isShift && isCtrl) {
                                const projN = targetVecX * outX + targetVecY * outY;
                                const sign = projN >= 0 ? 1 : -1;
                                targetVecX = sign * outX * globalEdgeLabelProximity;
                                targetVecY = sign * outY * globalEdgeLabelProximity;
                            } else if (isShift) {
                                const proj = targetVecX * outX + targetVecY * outY;
                                targetVecX = proj * outX;
                                targetVecY = proj * outY;
                            } else if (isCtrl) {
                                const initialVecX = defOffX + baseOffX;
                                const initialVecY = defOffY + baseOffY;
                                const radius = Math.hypot(initialVecX, initialVecY);
                                
                                const targetDist = Math.hypot(targetVecX, targetVecY) || 1;
                                targetVecX = (targetVecX / targetDist) * radius;
                                targetVecY = (targetVecY / targetDist) * radius;
                            }`;

code = code.replace(edgeDragRegex, edgeDragReplacement);

fs.writeFileSync('pages/NetworkGrapher.tsx', code);
