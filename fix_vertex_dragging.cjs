const fs = require('fs');
let code = fs.readFileSync('pages/NetworkGrapher.tsx', 'utf8');

const regex = /const isCtrl = e\.ctrlKey \|\| e\.metaKey;\n\s*const isShift = e\.shiftKey;[\s\S]*?newOffY = \(newOffY \/ dist\) \* globalVertexLabelProximity;\n\s*\}/;

const replacement = `const isCtrl = e.ctrlKey || e.metaKey;
                        const isShift = e.shiftKey;

                        if (isShift && isCtrl) {
                            let incidentAngles: number[] = [0, Math.PI/2, Math.PI, -Math.PI/2];
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
                            
                            let currentAngle = Math.atan2(newOffY, newOffX);
                            let bestAngle = incidentAngles[0];
                            let minDiff = Infinity;
                            
                            const getAngleDiff = (a1: number, a2: number) => {
                                let diff = Math.abs(a1 - a2);
                                while (diff > Math.PI * 2) diff -= Math.PI * 2;
                                if (diff > Math.PI) diff = Math.PI * 2 - diff;
                                return diff;
                            };
                            
                            incidentAngles.forEach(ang => {
                                let diff = getAngleDiff(currentAngle, ang);
                                if (diff < minDiff) {
                                    minDiff = diff;
                                    bestAngle = ang;
                                }
                            });
                            
                            newOffX = Math.cos(bestAngle) * globalVertexLabelProximity;
                            newOffY = Math.sin(bestAngle) * globalVertexLabelProximity;
                            
                        } else if (isShift) {
                            let incidentAngles: number[] = [0, Math.PI/2, Math.PI, -Math.PI/2];
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
                            
                            let currentAngle = Math.atan2(newOffY, newOffX);
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
                        } else if (isCtrl) {
                             let dist = Math.hypot(newOffX, newOffY) || 1;
                             newOffX = (newOffX / dist) * globalVertexLabelProximity;
                             newOffY = (newOffY / dist) * globalVertexLabelProximity;
                        }`;
code = code.replace(regex, replacement);
fs.writeFileSync('pages/NetworkGrapher.tsx', code);
