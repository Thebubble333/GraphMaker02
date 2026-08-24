const fs = require('fs');
let code = fs.readFileSync('pages/NetworkGrapher.tsx', 'utf8');

code = code.replace(/            \} else if \(draggingLabel\) \{[\s\S]*?            \} else if \(draggingEdgeLabel\) \{/,
`            } else if (draggingLabel) {
                setNodes(dragInfo.initialNodes.map(n => {
                    if (n.id === draggingLabel) {
                        let baseOffX = n.labelOffset?.x;
                        let baseOffY = n.labelOffset?.y;
                        if (baseOffX === undefined || baseOffY === undefined) { baseOffX = 15; baseOffY = -15; }
                        let newOffX = baseOffX + dx;
                        let newOffY = baseOffY + dy;
                        
                        if (e.shiftKey) {
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
                                
                                let bestAngle = currentAngle;
                                let minDiff = Infinity;
                                
                                incidentAngles.forEach(ang => {
                                    let diff1 = Math.abs(Math.atan2(Math.sin(currentAngle - ang), Math.cos(currentAngle - ang)));
                                    let diff2 = Math.abs(Math.atan2(Math.sin(currentAngle - (ang + Math.PI)), Math.cos(currentAngle - (ang + Math.PI))));
                                    
                                    if (diff1 < minDiff) { minDiff = diff1; bestAngle = ang; }
                                    if (diff2 < minDiff) { minDiff = diff2; bestAngle = ang + Math.PI; }
                                });
                                
                                newOffX = Math.cos(bestAngle) * currentDist;
                                newOffY = Math.sin(bestAngle) * currentDist;
                            }
                        }

                        return { ...n, labelOffset: { x: newOffX, y: newOffY } };
                    }
                    return n;
                }));
            } else if (draggingEdgeLabel) {`);

fs.writeFileSync('pages/NetworkGrapher.tsx', code);
console.log('Replaced draggingLabel');
