const fs = require('fs');
let code = fs.readFileSync('pages/NetworkGrapher.tsx', 'utf8');

const physicsLogic = `
export const optimizeLabelPlacements = (
    currentNodes: NetworkNode[],
    currentEdges: NetworkEdge[],
    globalEdgeLabelProximity: number,
    globalVertexStyle: string
): { nodes: NetworkNode[], edges: NetworkEdge[] } => {
    // We'll create an array of label objects to simulate
    
    // Nodes (only if they have labels and style is outside, or just always optimize the offset)
    let simNodes = currentNodes.map(n => ({
        type: 'node',
        id: n.id,
        attachX: n.x,
        attachY: n.y,
        x: n.x + (n.labelOffset?.x || 18),
        y: n.y + (n.labelOffset?.y || -18),
        idealDist: 22,
        active: globalVertexStyle === 'outside' && n.label
    }));
    
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
        
        return {
            type: 'edge',
            id: e.id,
            attachX: midX,
            attachY: midY,
            x: midX + (e.labelOffset?.x || 0),
            y: midY + (e.labelOffset?.y || 0),
            idealDist: globalEdgeLabelProximity,
            active: !!e.label
        };
    });
    
    let labels = [...simNodes, ...simEdges].filter(l => l.active);
    
    // Physics parameters
    const ITERATIONS = 150;
    const K_REPULSE_MASS = 15000;
    const K_REPULSE_LABEL = 40000;
    const K_SPRING = 0.2;
    const MAX_STEP = 15;
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
                
                // Repel slightly from edge components to avoid line overlap
                const masses = [
                    {x: fn.x, y: fn.y},
                    {x: tn.x, y: tn.y},
                    {x: midX, y: midY}
                ];
                
                masses.forEach(m => {
                    let dx = l.x - m.x;
                    let dy = l.y - m.y;
                    let dist = Math.hypot(dx, dy) || 1;
                    // slightly weaker repulsion from edge midpoints than pure nodes to balance
                    let force = (K_REPULSE_MASS * 0.8) / (dist * dist);
                    fx += (dx / dist) * force;
                    fy += (dy / dist) * force;
                });
            });
            
            // Repulsion from other labels (extreme if overlapping)
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
            
            // Spring force towards attachment point
            let adx = l.attachX - l.x;
            let ady = l.attachY - l.y;
            let adist = Math.hypot(adx, ady) || 1;
            let stretch = adist - l.idealDist;
            let sforce = stretch * K_SPRING;
            fx += (adx / adist) * sforce;
            fy += (ady / adist) * sforce;
            
            forces[idx] = {x: fx, y: fy};
        });
        
        // Apply forces
        labels.forEach((l, idx) => {
            let fx = forces[idx].x;
            let fy = forces[idx].y;
            let fmag = Math.hypot(fx, fy);
            if (fmag > MAX_STEP) {
                fx = (fx / fmag) * MAX_STEP;
                fy = (fy / fmag) * MAX_STEP;
            }
            l.x += fx;
            l.y += fy;
        });
    }
    
    // Map back
    const resNodes = currentNodes.map(n => {
        let sim = labels.find(s => s.type === 'node' && s.id === n.id);
        if (sim) {
            return { ...n, labelOffset: { x: sim.x - n.x, y: sim.y - n.y } };
        }
        return n;
    });
    
    const resEdges = currentEdges.map(e => {
        let sim = labels.find(s => s.type === 'edge' && s.id === e.id);
        if (sim) {
            return { ...e, labelOffset: { x: sim.x - sim.attachX, y: sim.y - sim.attachY } };
        }
        return e;
    });
    
    return { nodes: resNodes, edges: resEdges };
};
`;

code = code.replace(/export const computeSmartOutsideLabelOffset[^\}]+\};/, physicsLogic);

fs.writeFileSync('pages/NetworkGrapher.tsx', code);
console.log('Done replacement part 1');
