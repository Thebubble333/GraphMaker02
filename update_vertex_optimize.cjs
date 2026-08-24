const fs = require('fs');
let code = fs.readFileSync('pages/NetworkGrapher.tsx', 'utf8');

// We need to replace the vertex optimization part
const regex = /\/\/ 2\. Vertex Labels: Simulate 1D angular forces[\s\S]*?    return \{ nodes: resNodes, edges: resEdges \};\n\};\n/g;

const newVertexLogic = `// 2. Vertex Labels: Sample angles to find global minimum of repulsive potential
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
            return cost;
        };

        // Sample 36 angles (every 10 degrees)
        let bestTheta = l.theta;
        let minCost = Infinity;
        
        for (let i = 0; i < 36; i++) {
            let candTheta = (i / 36) * 2 * Math.PI - Math.PI;
            let cost = evaluateCost(candTheta);
            if (cost < minCost) {
                minCost = cost;
                bestTheta = candTheta;
            }
        }
        
        // Bisection/fine search around the best angle
        let searchRange = Math.PI / 18; // 10 degrees
        for (let step = 0; step < 3; step++) {
            let stepBestTheta = bestTheta;
            let stepMinCost = minCost;
            
            // Sample 10 points in the range
            for (let i = 0; i <= 10; i++) {
                let candTheta = bestTheta - searchRange + (i / 10) * 2 * searchRange;
                let cost = evaluateCost(candTheta);
                if (cost < stepMinCost) {
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

    return { nodes: resNodes, edges: resEdges };
};
`;

code = code.replace(regex, newVertexLogic);
fs.writeFileSync('pages/NetworkGrapher.tsx', code);
