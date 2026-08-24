const fs = require('fs');
let code = fs.readFileSync('pages/NetworkGrapher.tsx', 'utf8');

const regex = /export const optimizeLabelPlacements = \([\s\S]*?\n\};\n/g;

const newOptimizeLogic = `
export const optimizeLabelPlacements = (
    currentNodes: NetworkNode[],
    currentEdges: NetworkEdge[],
    globalEdgeLabelProximity: number,
    globalVertexStyle: string
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

    // 1. Edge Labels: Physics simulation
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
        
        let startPos = c1;
        if (e.labelOffset && (e.labelOffset.x !== 0 || e.labelOffset.y !== 0)) {
            let dot = e.labelOffset.x * nx + e.labelOffset.y * ny;
            startPos = dot >= 0 ? c1 : c2;
        } else {
            const evaluatePotential = (candX: number, candY: number) => {
                let score = 0;
                let px = midX + candX;
                let py = midY + candY;
                currentNodes.forEach(n => {
                    let d = Math.hypot(px - n.x, py - n.y);
                    score += 1000 / (d * d + 1);
                });
                currentEdges.forEach(oe => {
                    if (oe.id === e.id) return;
                    const ofn = currentNodes.find(n => n.id === oe.from);
                    const otn = currentNodes.find(n => n.id === oe.to);
                    if (ofn && otn) {
                        let omx = (ofn.x + otn.x)/2;
                        let omy = (ofn.y + otn.y)/2;
                        let d = Math.hypot(px - omx, py - omy);
                        score += 500 / (d * d + 1);
                    }
                });
                score += py * 0.001; 
                return score;
            };
            startPos = evaluatePotential(c1.x, c1.y) < evaluatePotential(c2.x, c2.y) ? c1 : c2;
        }
        
        let simX = midX + startPos.x;
        let simY = midY + startPos.y;
        
        const ITERATIONS = 150;
        const DT = 0.2;
        for (let i=0; i<ITERATIONS; i++) {
            let fx = 0, fy = 0;
            
            let signedDist = (simX - midX) * nx + (simY - midY) * ny;
            let d_owner = Math.abs(signedDist);
            
            // 1. Spring to maintain globalEdgeLabelProximity
            let err = d_owner - globalEdgeLabelProximity;
            let sign = signedDist >= 0 ? 1 : -1;
            fx += -err * sign * nx * 1.5;
            fy += -err * sign * ny * 1.5;
            
            // 2. Spring to midpoint along tangent (sliding friction/anchor)
            let slide = (simX - midX) * tx + (simY - midY) * ty;
            fx += -slide * tx * 0.5;
            fy += -slide * ty * 0.5;
            
            // 3. Repulsion from other edges
            currentEdges.forEach(oe => {
                if (oe.id === e.id) return;
                const ofn = currentNodes.find(n => n.id === oe.from);
                const otn = currentNodes.find(n => n.id === oe.to);
                if (ofn && otn) {
                    let otherInfo = distToSegment(simX, simY, ofn.x, ofn.y, otn.x, otn.y);
                    let d_other = otherInfo.dist;
                    
                    if (d_other < 1.5 * d_owner && d_other < 60) {
                        let ratio = d_other / Math.max(d_owner, 0.001);
                        if (ratio < 1.5) {
                            let intensity = (1.5 - ratio) / 1.5;
                            let forceMag = intensity * 200 / (d_other * d_other + 1);
                            if (d_other > 0.01) {
                                fx += ((simX - otherInfo.projX) / d_other) * forceMag;
                                fy += ((simY - otherInfo.projY) / d_other) * forceMag;
                            }
                        }
                    }
                }
            });
            
            let fMag = Math.hypot(fx, fy);
            if (fMag > 20) {
                fx = (fx / fMag) * 20;
                fy = (fy / fMag) * 20;
            }
            
            simX += fx * DT;
            simY += fy * DT;
        }
        
        return {
            ...e,
            labelOffset: {
                x: Math.round(simX - midX),
                y: Math.round(simY - midY)
            }
        };
    });

    // 2. Vertex Labels: Simulate 1D angular forces around the vertex circle
    const normalizeAngle = (a: number) => {
        while (a > Math.PI) a -= 2 * Math.PI;
        while (a <= -Math.PI) a += 2 * Math.PI;
        return a;
    };

    let simNodes = currentNodes.map(n => {
        let baseDx = n.labelOffset?.x;
        let baseDy = n.labelOffset?.y;
        if (baseDx === undefined || baseDy === undefined) {
            baseDx = 15; baseDy = -15;
        }
        if (baseDx === 0 && baseDy === 0) baseDy = -1;
        
        let r = Math.hypot(baseDx, baseDy);
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
    
    const ITERATIONS_NODE = 150;
    const DT_NODE = 0.05;
    for (let i = 0; i < ITERATIONS_NODE; i++) {
        simNodes.forEach(l => {
            if (!l.active) return;
            
            let force = 0;
            
            l.incidentAngles.forEach(phi => {
                let diff = normalizeAngle(l.theta - phi);
                let dist = Math.abs(diff);
                if (dist < 0.05) dist = 0.05; 
                let sign = diff > 0 ? 1 : -1;
                force += sign * (1.0 / (dist * dist));
            });
            
            currentNodes.forEach(otherN => {
                if (otherN.id === l.id) return;
                let phi = Math.atan2(otherN.y - currentNodes.find(n => n.id === l.id)!.y, otherN.x - currentNodes.find(n => n.id === l.id)!.x);
                let diff = normalizeAngle(l.theta - phi);
                let dist = Math.abs(diff);
                if (dist < 0.1) dist = 0.1;
                let sign = diff > 0 ? 1 : -1;
                force += sign * (0.2 / (dist * dist));
            });
            
            if (force > 5) force = 5;
            if (force < -5) force = -5;
            
            l.theta += force * DT_NODE;
            l.theta = normalizeAngle(l.theta);
        });
    }
    
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

    return { nodes: resNodes, edges: resEdges };
};
`;

code = code.replace(regex, newOptimizeLogic);
fs.writeFileSync('pages/NetworkGrapher.tsx', code);
console.log('Replaced function');
