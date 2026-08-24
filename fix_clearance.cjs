const fs = require('fs');
let code = fs.readFileSync('pages/NetworkGrapher.tsx', 'utf8');

const regex = /const checkClearance = \([\s\S]*?return minOtherDist >= edgeLabelClearanceRatio \* candN;\n\s*\};/;

const replacement = `const checkClearance = (candT: number, candN: number, dir: number, debug = false) => {
            let px = midX + candT * tx + candN * dir * nx;
            let py = midY + candT * ty + candN * dir * ny;
            
            let minOtherDist = Infinity;
            let closestObj = '';
            
            currentEdges.forEach(oe => {
                if (oe.id === e.id) return;
                const ofn = resNodes.find(n => n.id === oe.from);
                const otn = resNodes.find(n => n.id === oe.to);
                if (ofn && otn) {
                    let d = distToSegment(px, py, ofn.x, ofn.y, otn.x, otn.y).dist;
                    if (d < minOtherDist) { minOtherDist = d; closestObj = 'edge ' + oe.label; }
                }
            });
            
            resNodes.forEach(on => {
                if (on.id !== e.from && on.id !== e.to) {
                    let d = Math.hypot(on.x - px, on.y - py);
                    let actualRadius = globalNodeRadius || 15;
                    if (d - actualRadius < minOtherDist) { minOtherDist = Math.max(0, d - actualRadius); closestObj = 'node ' + on.label; }
                }
                
                // CRITICAL: Avoid Vertex Labels
                if (on.label && on.labelOffset) {
                    let vlx = on.x + on.labelOffset.x;
                    let vly = on.y + on.labelOffset.y;
                    let vlw = Math.max(20, on.label.length * 8);
                    let vlh = 16;
                    let d = distPointToRect(px, py, vlx, vly, vlw, vlh);
                    if (d < minOtherDist) { minOtherDist = d; closestObj = 'vlabel ' + on.label; }
                }
            });
            
            if (debug) console.log('Edge ' + e.label + ' at T=' + candT + ' N=' + candN + ' minDist=' + minOtherDist + ' closest=' + closestObj + ' required=' + (edgeLabelClearanceRatio * candN));
            return minOtherDist >= edgeLabelClearanceRatio * candN;
        };`;

code = code.replace(regex, replacement);
fs.writeFileSync('pages/NetworkGrapher.tsx', code);
