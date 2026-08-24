const fs = require('fs');
let code = fs.readFileSync('pages/NetworkGrapher.tsx', 'utf8');

const regex = /export const optimizeLabelPlacements = \([\s\S]*?\n\};\n/g;

const optimizeLogic = `
export const optimizeLabelPlacements = (
    currentNodes: NetworkNode[],
    currentEdges: NetworkEdge[],
    globalEdgeLabelProximity: number,
    globalVertexStyle: string
): { nodes: NetworkNode[], edges: NetworkEdge[] } => {
    // Nodes
    let simNodes = currentNodes.map(n => {
        let baseDx = n.labelOffset?.x;
        let baseDy = n.labelOffset?.y;
        if (baseDx === undefined || baseDy === undefined) {
            baseDx = 15;
            baseDy = -15;
        }
        if (baseDx === 0 && baseDy === 0) baseDy = -1;
        let currentDist = Math.hypot(baseDx, baseDy);
        
        return {
            type: 'node',
            id: n.id,
            attachX: n.x,
            attachY: n.y,
            x: n.x + baseDx,
            y: n.y + baseDy,
            idealDist: currentDist,
            active: globalVertexStyle === 'outside' && n.label
        };
    });
    
    // Edges
    let simEdges = currentEdges.map(e => {
        const fn = currentNodes.find(n => n.id === e.from);
        const tn = currentNodes.find(n => n.id === e.to);
        let midX = 0, midY = 0;
        if (fn && tn) {
            if (e.isLoop) {
                midX = e.cp1 ? e.cp1.x : fn.x;
                midY = e.cp1 ? e.cp1.y : fn.y - 60;
            } else if (e.isCurve && e.cp1) {
                midX = 0.25 * fn.x + 0.5 * e.cp1.x + 0.25 * tn.x;
                midY = 0.25 * fn.y + 0.5 * e.cp1.y + 0.25 * tn.y;
            } else {
                midX = (fn.x + tn.x) / 2;
                midY = (fn.y + tn.y) / 2;
            }
        }
        
        let baseDx = e.labelOffset?.x;
        let baseDy = e.labelOffset?.y;
        let currentDist = globalEdgeLabelProximity;
        
        if (baseDx !== undefined && baseDy !== undefined) {
            currentDist = Math.hypot(baseDx, baseDy);
            if (currentDist === 0) {
                baseDy = -1;
                currentDist = 1;
            }
        } else {
            // Default offset if none exists
            baseDx = 0;
            baseDy = -globalEdgeLabelProximity;
        }
        
        return {
            type: 'edge',
            id: e.id,
            attachX: midX,
            attachY: midY,
            x: midX + baseDx,
            y: midY + baseDy,
            idealDist: currentDist,
            active: !!e.label
        };
    });
    
    let labels = [...simNodes, ...simEdges].filter(l => l.active);
    
    // Physics parameters
    const ITERATIONS = 150;
    const K_REPULSE_MASS = 15000;
    const K_REPULSE_LABEL = 40000;
    const MAX_STEP = 10;
    const LABEL_OVERLAP_DIST = 35;
    
    for (let i = 0; i < ITERATIONS; i++) {
        let forces = labels.map(() => ({x: 0, y: 0}));
        
        labels.forEach((l, idx) => {
            let fx = 0, fy = 0;
            
            // Repulsion from nodes
            currentNodes.forEach(n => {
                let dx = l.x - n.x;
                let dy = l.y - n.y;
                let dist = Math.hypot(dx, dy) || 1;
                let force = K_REPULSE_MASS / (dist * dist);
                fx += (dx / dist) * force;
                fy += (dy / dist) * force;
            });
            
            // Repulsion from edges (endpoints and midpoint)
            currentEdges.forEach(e => {
                const fn = currentNodes.find(n => n.id === e.from);
                const tn = currentNodes.find(n => n.id === e.to);
                if (!fn || !tn) return;
                
                let midX = 0, midY = 0;
                if (e.isLoop) {
                    midX = e.cp1 ? e.cp1.x : fn.x;
                    midY = e.cp1 ? e.cp1.y : fn.y - 60;
                } else if (e.isCurve && e.cp1) {
                    midX = 0.25 * fn.x + 0.5 * e.cp1.x + 0.25 * tn.x;
                    midY = 0.25 * fn.y + 0.5 * e.cp1.y + 0.25 * tn.y;
                } else {
                    midX = (fn.x + tn.x) / 2;
                    midY = (fn.y + tn.y) / 2;
                }
                
                const masses = [
                    {x: fn.x, y: fn.y},
                    {x: tn.x, y: tn.y},
                    {x: midX, y: midY}
                ];
                
                masses.forEach(m => {
                    let dx = l.x - m.x;
                    let dy = l.y - m.y;
                    let dist = Math.hypot(dx, dy) || 1;
                    let force = (K_REPULSE_MASS * 0.8) / (dist * dist);
                    fx += (dx / dist) * force;
                    fy += (dy / dist) * force;
                });
            });
            
            // Repulsion from other labels
            labels.forEach((otherL, otherIdx) => {
                if (idx === otherIdx) return;
                let dx = l.x - otherL.x;
                let dy = l.y - otherL.y;
                let dist = Math.hypot(dx, dy);
                if (dist < LABEL_OVERLAP_DIST) {
                    if (dist === 0) {
                        dx = (Math.random() - 0.5) * 2;
                        dy = (Math.random() - 0.5) * 2;
                        dist = Math.hypot(dx, dy) || 1;
                    }
                    let force = K_REPULSE_LABEL / (dist * dist);
                    fx += (dx / dist) * force;
                    fy += (dy / dist) * force;
                }
            });
            
            forces[idx] = {x: fx, y: fy};
        });
        
        // Apply forces & strictly constrain to radius
        labels.forEach((l, idx) => {
            let fx = forces[idx].x;
            let fy = forces[idx].y;
            let fmag = Math.hypot(fx, fy);
            if (fmag > MAX_STEP) {
                fx = (fx / fmag) * MAX_STEP;
                fy = (fy / fmag) * MAX_STEP;
            }
            
            // Add force to current pos
            let nextX = l.x + fx;
            let nextY = l.y + fy;
            
            // Project back to ideal distance circle
            let rdx = nextX - l.attachX;
            let rdy = nextY - l.attachY;
            let rdist = Math.hypot(rdx, rdy) || 1;
            
            l.x = l.attachX + (rdx / rdist) * l.idealDist;
            l.y = l.attachY + (rdy / rdist) * l.idealDist;
        });
    }
    
    const resNodes = currentNodes.map(n => {
        let sim = labels.find(s => s.type === 'node' && s.id === n.id);
        if (sim) {
            return { ...n, labelOffset: { x: Math.round(sim.x - n.x), y: Math.round(sim.y - n.y) } };
        }
        return n;
    });
    
    const resEdges = currentEdges.map(e => {
        let sim = labels.find(s => s.type === 'edge' && s.id === e.id);
        if (sim) {
            return { ...e, labelOffset: { x: Math.round(sim.x - sim.attachX), y: Math.round(sim.y - sim.attachY) } };
        }
        return e;
    });
    
    return { nodes: resNodes, edges: resEdges };
};
`;

code = code.replace(regex, optimizeLogic);

fs.writeFileSync('pages/NetworkGrapher.tsx', code);
console.log('Replaced function with fixed radius constraint physics');
