const fs = require('fs');
let code = fs.readFileSync('pages/NetworkGrapher.tsx', 'utf8');

// We are going to replace from `// 1. Edge Labels` to `// 2. Vertex Labels`

const regex = /\/\/ 1\. Edge Labels[\s\S]*?\/\/ 2\. Vertex Labels/g;

const newLogic = `// 1. Edge Labels
    const resEdges = currentEdges.map(e => {
        if (!e.label) return e;
        
        const fn = currentNodes.find(n => n.id === e.from);
        const tn = currentNodes.find(n => n.id === e.to);
        if (!fn || !tn) return e;
        
        let midX = 0, midY = 0;
        let dx = 0, dy = 0;
        
        if (e.isLoop) {
            midX = e.cp1 ? e.cp1.x : fn.x;
            midY = e.cp1 ? e.cp1.y : fn.y - 60;
            dx = 1; dy = 0;
        } else if (e.isCurve && e.cp1) {
            midX = 0.25 * fn.x + 0.5 * e.cp1.x + 0.25 * tn.x;
            midY = 0.25 * fn.y + 0.5 * e.cp1.y + 0.25 * tn.y;
            dx = tn.x - fn.x;
            dy = tn.y - fn.y;
        } else {
            midX = (fn.x + tn.x) / 2;
            midY = (fn.y + tn.y) / 2;
            dx = tn.x - fn.x;
            dy = tn.y - fn.y;
        }
        
        let len = Math.hypot(dx, dy) || 1;
        let tx = dx / len;
        let ty = dy / len;
        let nx = -ty;
        let ny = tx;
        
        let dist = globalEdgeLabelProximity;
        let c1 = { x: nx * dist, y: ny * dist };
        let c2 = { x: -nx * dist, y: -ny * dist };
        
        // Primary preference based on Center of Mass
        let d1 = Math.hypot(midX + c1.x - cmX, midY + c1.y - cmY);
        let d2 = Math.hypot(midX + c2.x - cmX, midY + c2.y - cmY);
        let pref_N_dir = d1 > d2 ? 1 : -1;
        
        // Preserve user's existing side choice if they dragged it previously
        if (e.labelOffset && (e.labelOffset.x !== 0 || e.labelOffset.y !== 0)) {
            let dot = e.labelOffset.x * nx + e.labelOffset.y * ny;
            pref_N_dir = dot >= 0 ? 1 : -1;
        }
        
        // Approximate bounding box width/height based on text length
        let lw = Math.max(20, e.label.length * 8);
        let lh = 16;
        
        let maxT = len * 0.25;
        let best_t = 0;
        let best_n = 0;
        let best_dir = pref_N_dir;
        let best_score = -Infinity;
        
        const checkClearance = (candT: number, candN: number, dir: number) => {
            let px = midX + candT * tx + candN * dir * nx;
            let py = midY + candT * ty + candN * dir * ny;
            
            let minOtherDist = Infinity;
            currentEdges.forEach(oe => {
                if (oe.id === e.id) return;
                const ofn = currentNodes.find(n => n.id === oe.from);
                const otn = currentNodes.find(n => n.id === oe.to);
                if (ofn && otn) {
                    let d = distRectToSegment(px, py, lw, lh, ofn.x, ofn.y, otn.x, otn.y);
                    if (d < minOtherDist) minOtherDist = d;
                }
            });
            currentNodes.forEach(on => {
                let d = distPointToRect(on.x, on.y, px, py, lw, lh);
                // Node radius approx 15
                if (d - 15 < minOtherDist) minOtherDist = Math.max(0, d - 15);
            });
            
            return minOtherDist >= edgeLabelClearanceRatio * candN;
        };
        
        // Test both sides: preferred side first, then opposite side
        let dirs = [pref_N_dir, -pref_N_dir];
        for (let dir_idx = 0; dir_idx < 2; dir_idx++) {
            let cur_dir = dirs[dir_idx];
            
            for (let t_idx = -10; t_idx <= 10; t_idx++) {
                let candT = (t_idx / 10) * maxT;
                let lowN = 0;
                let highN = dist;
                let maxValidN = 0;
                
                if (checkClearance(candT, dist, cur_dir)) {
                    maxValidN = dist;
                } else {
                    for (let i = 0; i < 6; i++) {
                        let midN = (lowN + highN) / 2;
                        if (checkClearance(candT, midN, cur_dir)) {
                            lowN = midN;
                            maxValidN = midN;
                        } else {
                            highN = midN;
                        }
                    }
                }
                
                // Score function: 
                // heavily penalize maxValidN < dist
                // penalize shifting parallel (Math.abs(candT))
                // penalize flipping to opposite side (dir_idx > 0)
                let side_penalty = dir_idx === 0 ? 0 : 50;
                let score = maxValidN * 1000 - Math.abs(candT) * 10 - side_penalty;
                
                if (score > best_score) {
                    best_score = score;
                    best_t = candT;
                    best_n = maxValidN;
                    best_dir = cur_dir;
                }
            }
        }
        
        return {
            ...e,
            labelOffset: {
                x: Math.round(best_t * tx + best_n * best_dir * nx),
                y: Math.round(best_t * ty + best_n * best_dir * ny)
            }
        };
    });

    // 2. Vertex Labels`;

code = code.replace(regex, newLogic);
fs.writeFileSync('pages/NetworkGrapher.tsx', code);
