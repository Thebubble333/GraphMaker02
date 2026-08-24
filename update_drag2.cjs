const fs = require('fs');
let code = fs.readFileSync('pages/NetworkGrapher.tsx', 'utf8');

// I will just use projection so that it literally snaps to the line:
// The line vector is (cos(ang), sin(ang)).
// Projection of (newOffX, newOffY) onto line vector is dot * line vector.

code = code.replace(
/let bestAngle = currentAngle;[\s\S]*?newOffY = Math\.sin\(bestAngle\) \* currentDist;/g,
`let bestLine = { x: Math.cos(currentAngle), y: Math.sin(currentAngle) };
                                let minDistance = Infinity;
                                let bestProj = 0;
                                
                                incidentAngles.forEach(ang => {
                                    let ux = Math.cos(ang);
                                    let uy = Math.sin(ang);
                                    
                                    // distance from point (newOffX, newOffY) to line defined by (ux, uy)
                                    // line equation: -uy * x + ux * y = 0
                                    let dist = Math.abs(-uy * newOffX + ux * newOffY);
                                    let proj = newOffX * ux + newOffY * uy;
                                    
                                    if (dist < minDistance) {
                                        minDistance = dist;
                                        bestLine = { x: ux, y: uy };
                                        bestProj = proj;
                                    }
                                });
                                
                                newOffX = bestLine.x * bestProj;
                                newOffY = bestLine.y * bestProj;`
);

fs.writeFileSync('pages/NetworkGrapher.tsx', code);
console.log('Updated draggingLabel projection');
