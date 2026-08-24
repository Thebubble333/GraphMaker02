const fs = require('fs');
let code = fs.readFileSync('pages/NetworkGrapher.tsx', 'utf8');

const regex = /export const optimizeLabelPlacements = \([\s\S]*?return \{ nodes: resNodes, edges: resEdges \};\n\};\n/g;

const newLogic = `export const optimizeLabelPlacements = (
    currentNodes: NetworkNode[],
    currentEdges: NetworkEdge[],
    globalEdgeLabelProximity: number,
    globalVertexLabelProximity: number,
    edgeLabelClearanceRatio: number,
    globalVertexStyle: string,
    globalNodeRadius: number
): { nodes: NetworkNode[], edges: NetworkEdge[] } => {
    
    const distToSegment = (px: number, py: number, x1: number, y1: number, x2: number, y2: number) => {
        let l2 = (x2 - x1)**2 + (y2 - y1)**2;
        if (l2 === 0) return { dist: Math.hypot(px - x1, py - y1), projX: x1, projY: y1 };
        let t = ((px - x1)*(x2 - x1) + (py - y1)*(y2 - y1)) / l2;
        t = Math.max(0, Math.min(1, t));
        let projX = x1 + t * (x2 - x1);
        let projY = y1 + t * (y2 - y1);
        return { dist: Math.hypot(px - projX, py - projY), projX, projY };
    };
    
    const distPointToRect = (px: number, py: number, cx: number, cy: number, w: number, h: number) => {
        let dx = Math.max(Math.abs(px - cx) - w/2, 0);
        let dy = Math.max(Math.abs(py - cy) - h/2, 0);
        return Math.hypot(dx, dy);
    };
    
    const distRectToSegment = (cx: number, cy: number, w: number, h: number, x1: number, y1: number, x2: number, y2: number) => {
        let minDist = Infinity;
        let corners = [
            {x: cx - w/2, y: cy - h/2},
            {x: cx + w/2, y: cy - h/2},
            {x: cx + w/2, y: cy + h/2},
            {x: cx - w/2, y: cy + h/2}
        ];
        for (let c of corners) {
            minDist = Math.min(minDist, distToSegment(c.x, c.y, x1, y1, x2, y2).dist);
        }
        minDist = Math.min(minDist, distPointToRect(x1, y1, cx, cy, w, h));
        minDist = Math.min(minDist, distPointToRect(x2, y2, cx, cy, w, h));
        for (let i = 1; i < 5; i++) {
            let px = x1 + (x2 - x1) * (i / 5);
            let py = y1 + (y2 - y1) * (i / 5);
            minDist = Math.min(minDist, distPointToRect(px, py, cx, cy, w, h));
        }
        return minDist;
    };
    
    const distRectToRect = (cx1: number, cy1: number, w1: number, h1: number, cx2: number, cy2: number, w2: number, h2: number) => {
        let dx = Math.max(0, Math.abs(cx1 - cx2) - (w1 + w2)/2);
        let dy = Math.max(0, Math.abs(cy1 - cy2) - (h1 + h2)/2);
        return Math.hypot(dx, dy);
    };

    let sumX = 0, sumY = 0, count = 0;
    currentNodes.forEach(n => { sumX += n.x; sumY += n.y; count++; });
    let cmX = count > 0 ? sumX / count : 0;
    let cmY = count > 0 ? sumY / count : 0;

    // 1. Vertex Labels FIRST (so edge labels can avoid them)
    const getAngleDiff = (t1: number, t2: number) => {
        let diff = Math.abs(t1 - t2);
        while (diff > Math.PI * 2) diff -= Math.PI * 2;
        if (diff > Math.PI) diff = Math.PI * 2 - diff;
        return diff;
    };

    let simNodes = currentNodes.map(n => {
        let baseDx = n.labelOffset?.x;
        let baseDy = n.labelOffset?.y;
        if (baseDx === undefined || baseDy === undefined) {
            baseDx = globalVertexLabelProximity * 0.707; baseDy = -globalVertexLabelProximity * 0.707;
        }
        if (baseDx === 0 && baseDy === 0) baseDy = -1;
        
        let r = globalVertexLabelProximity;
        let theta = Math.atan2(baseDy, baseDx);
        
        let incidentAngles: number[] = [];
        currentEdges.forEach(e => {
            if (e.from === n.id && e.to === n.id) {
                let cpY = e.cp1 ? e.cp1.y : n.y - 60;
                let cpX = e.cp1 ? e.cp1.x : n.x;
                incidentAngles.push(Math.atan2(cpY - n.y, cpX - n.x));
            } else if (e.from === n.id) {
                let tn = currentNodes.find(t => t.id === e.to);
                if (tn) incidentAngles.push(Math.atan2(tn.y - n.y, tn.x - n.x));
            } else if (e.to === n.id) {
                let fn = currentNodes.find(f => f.id === e.from);
                if (fn) incidentAngles.push(Math.atan2(fn.y - n.y, fn.x - n.x));
            }
        });
        
        return {
            id: n.id,
            r,
            theta,
            incidentAngles,
            active: globalVertexStyle === 'outside' && n.label
        };
    });
    
    simNodes.forEach(l => {
        if (!l.active) return;
        
        const evaluateCost = (candTheta: number) => {
            let cost = 0;
            l.incidentAngles.forEach(phi => {
                let diff = getAngleDiff(candTheta, phi);
                cost += 1.0 / (diff + 0.1);
            });
            currentNodes.forEach(otherN => {
                if (otherN.id === l.id) return;
                let phi = Math.atan2(otherN.y - currentNodes.find(n => n.id === l.id)!.y, otherN.x - currentNodes.find(n => n.id === l.id)!.x);
                let diff = getAngleDiff(candTheta, phi);
                cost += 0.2 / (diff + 0.1);
            });
            // Geographic tiebreaker to prevent flip-flops on perfectly symmetric vertex layouts
            cost -= (Math.sin(candTheta) < 0 ? 0.05 : 0) + (Math.cos(candTheta) > 0 ? 0.02 : 0);
            return cost;
        };

        let bestTheta = l.theta;
        let minCost = Infinity;
        
        for (let i = 0; i < 36; i++) {
            let candTheta = (i / 36) * 2 * Math.PI - Math.PI;
            let cost = evaluateCost(candTheta);
            if (cost < minCost - 0.0001) {
                minCost = cost;
                bestTheta = candTheta;
            }
        }
        
        let searchRange = Math.PI / 18;
        for (let step = 0; step < 3; step++) {
            let stepBestTheta = bestTheta;
            let stepMinCost = minCost;
            
            for (let i = 0; i <= 10; i++) {
                let candTheta = bestTheta - searchRange + (i / 10) * 2 * searchRange;
                let cost = evaluateCost(candTheta);
                if (cost < stepMinCost - 0.0001) {
                    stepMinCost = cost;
                    stepBestTheta = candTheta;
                }
            }
            bestTheta = stepBestTheta;
            minCost = stepMinCost;
            searchRange /= 5;
        }
        
        l.theta = bestTheta;
    });
    
    const resNodes = currentNodes.map(n => {
        let sim = simNodes.find(s => s.id === n.id);
        if (sim && sim.active) {
            return {
                ...n,
                labelOffset: {
                    x: Math.round(Math.cos(sim.theta) * sim.r),
                    y: Math.round(Math.sin(sim.theta) * sim.r)
                }
            };
        }
        return n;
    });


    // 2. Edge Labels
    const resEdges = currentEdges.map(e => {
        if (!e.label) return e;
        
        // Use resNodes to get the finalized vertex label positions
        const fn = resNodes.find(n => n.id === e.from);
        const tn = resNodes.find(n => n.id === e.to);
        if (!fn || !tn) return e;
        
        let midX = 0, midY = 0;
        let dx = 0, dy = 0;
        
        if (e.isLoop) {
            midX = e.cp1 ? e.cp1.x : fn.x;
            midY = e.cp1 ? e.cp1.y : fn.y - 60;
            dx = midX - fn.x; dy = midY - fn.y;
            let temp = dx; dx = dy; dy = -temp;
            if (dx === 0 && dy === 0) { dx = 1; dy = 0; }
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
        
        // NOTE: We specifically removed the old labelOffset check here
        // to prevent flip-flopping hysteresis on symmetric graphs.
        
        let lw = Math.max(20, e.label.length * 8);
        let lh = 16;
        
        let maxT = len * 0.25;
        let best_t = 0;
        let best_n = 0;
        let best_dir = pref_N_dir;
        let best_score = -Infinity;
        
        const checkClearance = (candT: number, candN: number, dir: number, debug = false) => {
            let px = midX + candT * tx + candN * dir * nx;
            let py = midY + candT * ty + candN * dir * ny;
            
            let minOtherDist = Infinity;
            let closestObj = '';
            
            currentEdges.forEach(oe => {
                if (oe.id === e.id) return;
                const ofn = resNodes.find(n => n.id === oe.from);
                const otn = resNodes.find(n => n.id === oe.to);
                if (ofn && otn) {
                    let d = distRectToSegment(px, py, lw, lh, ofn.x, ofn.y, otn.x, otn.y);
                    if (d < minOtherDist) { minOtherDist = d; closestObj = 'edge ' + oe.label; }
                }
            });
            
            resNodes.forEach(on => {
                if (on.id !== e.from && on.id !== e.to) {
                    let d = distPointToRect(on.x, on.y, px, py, lw, lh);
                    let actualRadius = globalNodeRadius || 15;
                    if (d - actualRadius < minOtherDist) { minOtherDist = Math.max(0, d - actualRadius); closestObj = 'node ' + on.label; }
                }
                
                // CRITICAL: Avoid Vertex Labels
                if (on.label && on.labelOffset) {
                    let vlx = on.x + on.labelOffset.x;
                    let vly = on.y + on.labelOffset.y;
                    let vlw = Math.max(20, on.label.length * 8);
                    let vlh = 16;
                    let d = distRectToRect(px, py, lw, lh, vlx, vly, vlw, vlh);
                    if (d < minOtherDist) { minOtherDist = d; closestObj = 'vlabel ' + on.label; }
                }
            });
            
            if (debug) console.log('Edge ' + e.label + ' at T=' + candT + ' N=' + candN + ' minDist=' + minOtherDist + ' closest=' + closestObj + ' required=' + (edgeLabelClearanceRatio * candN));
            return minOtherDist >= edgeLabelClearanceRatio * candN;
        };
        
        let dirs = [pref_N_dir, -pref_N_dir];
        for (let dir_idx = 0; dir_idx < 2; dir_idx++) {
            let cur_dir = dirs[dir_idx];
            
            for (let t_idx = -10; t_idx <= 10; t_idx++) {
                let candT = (t_idx / 10) * maxT;
                let lowN = 0;
                let highN = dist;
                let maxValidN = 0;
                
                if (checkClearance(candT, dist, cur_dir, candT === 0 && dir_idx === 0)) {
                    maxValidN = dist;
                } else {
                    for (let i = 0; i < 6; i++) {
                        let midN = (lowN + highN) / 2;
                        if (checkClearance(candT, midN, cur_dir, false)) {
                            lowN = midN;
                            maxValidN = midN;
                        } else {
                            highN = midN;
                        }
                    }
                }
                
                // Tiebreakers: North > South > East > West
                let dir_nx = cur_dir * nx;
                let dir_ny = cur_dir * ny;
                let tie_breaker = 0;
                if (dir_ny < -0.1) tie_breaker += 4; // North
                else if (dir_ny > 0.1) tie_breaker += 3; // South
                if (dir_nx > 0.1) tie_breaker += 2; // East
                else if (dir_nx < -0.1) tie_breaker += 1; // West
                
                let side_penalty = dir_idx === 0 ? 0 : 50;
                let score = maxValidN * 1000 - Math.abs(candT) * 10 - side_penalty + tie_breaker;
                
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
                x: Math.round(best_t * tx + best_n * best_dir * nx - (e.isLoop ? nx * dist : pref_N_dir * nx * dist)),
                y: Math.round(best_t * ty + best_n * best_dir * ny - (e.isLoop ? ny * dist : pref_N_dir * ny * dist))
            }
        };
    });

    return { nodes: resNodes, edges: resEdges };
};
`;

code = code.replace(regex, newLogic);
fs.writeFileSync('pages/NetworkGrapher.tsx', code);
