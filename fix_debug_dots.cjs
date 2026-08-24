const fs = require('fs');
let code = fs.readFileSync('pages/NetworkGrapher.tsx', 'utf8');

const regex = /let lx = midX \+ \(e\.labelOffset\?\.x \|\| 0\);\n\s*let ly = midY \+ \(e\.labelOffset\?\.y \|\| 0\);/;

const replacement = `const graphCenterX = nodes.length > 0 ? nodes.reduce((sum, n) => sum + n.x, 0) / nodes.length : canvasWidth / 2;
                                        const graphCenterY = nodes.length > 0 ? nodes.reduce((sum, n) => sum + n.y, 0) / nodes.length : canvasHeight / 2;
                                        const edx = tn.x - fn.x;
                                        const edy = tn.y - fn.y;
                                        const eDist = Math.hypot(edx, edy) || 1;
                                        const ux = edx / eDist;
                                        const uy = edy / eDist;
                                        const normX = -uy;
                                        const normY = ux;
                                        const vcx = midX - graphCenterX;
                                        const vcy = midY - graphCenterY;
                                        const dot = normX * vcx + normY * vcy;
                                        const outX = dot >= 0 ? normX : -normX;
                                        const outY = dot >= 0 ? normY : -normY;
                                        const defOffX = e.isLoop ? (dx/len) * globalEdgeLabelProximity : outX * globalEdgeLabelProximity;
                                        const defOffY = e.isLoop ? (dy/len) * globalEdgeLabelProximity : outY * globalEdgeLabelProximity;
                                        
                                        let lx = midX + defOffX + (e.labelOffset?.x || 0);
                                        let ly = midY + defOffY + (e.labelOffset?.y || 0);`;

code = code.replace(regex, replacement);

fs.writeFileSync('pages/NetworkGrapher.tsx', code);
