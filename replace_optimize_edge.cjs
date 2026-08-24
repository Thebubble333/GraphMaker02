const fs = require('fs');
let code = fs.readFileSync('pages/NetworkGrapher.tsx', 'utf8');

// 1. Signature
code = code.replace(
/globalEdgeLabelProximity: number,\n    globalVertexLabelProximity: number,\n    globalVertexStyle: string/,
"globalEdgeLabelProximity: number,\n    globalVertexLabelProximity: number,\n    edgeLabelClearanceRatio: number,\n    globalVertexStyle: string"
);

// 2. State
code = code.replace(
/const \[globalVertexLabelProximity, setGlobalVertexLabelProximity\] = useState\(15\);/,
"const [globalVertexLabelProximity, setGlobalVertexLabelProximity] = useState(15);\n    const [edgeLabelClearanceRatio, setEdgeLabelClearanceRatio] = useState(1.5);"
);

// 3. Destructure & Load Snapshot
code = code.replace(
/globalNodeRadius, globalEdgeLabelProximity, globalVertexLabelProximity, inputType,/,
"globalNodeRadius, globalEdgeLabelProximity, globalVertexLabelProximity, edgeLabelClearanceRatio, inputType,"
);
code = code.replace(
/if \(state\.globalVertexLabelProximity\) setGlobalVertexLabelProximity\(state\.globalVertexLabelProximity\);/,
"if (state.globalVertexLabelProximity) setGlobalVertexLabelProximity(state.globalVertexLabelProximity);\n        if (state.edgeLabelClearanceRatio !== undefined) setEdgeLabelClearanceRatio(state.edgeLabelClearanceRatio);"
);

// 4. Calls
code = code.replace(
/optimizeLabelPlacements\(newNodes, edges, globalEdgeLabelProximity, globalVertexLabelProximity, style\)/g,
"optimizeLabelPlacements(newNodes, edges, globalEdgeLabelProximity, globalVertexLabelProximity, edgeLabelClearanceRatio, style)"
);
code = code.replace(
/optimizeLabelPlacements\(currentNodes, newEdges, globalEdgeLabelProximity, globalVertexLabelProximity, globalVertexStyle\)/g,
"optimizeLabelPlacements(currentNodes, newEdges, globalEdgeLabelProximity, globalVertexLabelProximity, edgeLabelClearanceRatio, globalVertexStyle)"
);
code = code.replace(
/optimizeLabelPlacements\(adjustedNodes, adjustedEdges, globalEdgeLabelProximity, globalVertexLabelProximity, globalVertexStyle\)/g,
"optimizeLabelPlacements(adjustedNodes, adjustedEdges, globalEdgeLabelProximity, globalVertexLabelProximity, edgeLabelClearanceRatio, globalVertexStyle)"
);
code = code.replace(
/optimizeLabelPlacements\(allNodes, edges, globalEdgeLabelProximity, globalVertexLabelProximity, globalVertexStyle\)/g,
"optimizeLabelPlacements(allNodes, edges, globalEdgeLabelProximity, globalVertexLabelProximity, edgeLabelClearanceRatio, globalVertexStyle)"
);
code = code.replace(
/optimizeLabelPlacements\(nodes, edges, globalEdgeLabelProximity, globalVertexLabelProximity, globalVertexStyle\)/g,
"optimizeLabelPlacements(nodes, edges, globalEdgeLabelProximity, globalVertexLabelProximity, edgeLabelClearanceRatio, globalVertexStyle)"
);

// 5. Add to UI (Settings)
code = code.replace(
/<label className="block text-xs font-semibold text-gray-500 mb-1">Vertex Label Prox\.<\/label>[\s\S]*?<SmartNumberInput[\s\S]*?className="w-full border rounded p-1\.5 focus:ring-2 focus:ring-indigo-500 focus:outline-none text-sm"[\s\S]*?\/>/,
`<label className="block text-xs font-semibold text-gray-500 mb-1">Vertex Label Prox.</label>
                                        <SmartNumberInput 
                                            value={globalVertexLabelProximity}
                                            onChange={(val) => setGlobalVertexLabelProximity(Math.max(-50, Math.min(100, val)))}
                                            className="w-full border rounded p-1.5 focus:ring-2 focus:ring-indigo-500 focus:outline-none text-sm"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-semibold text-gray-500 mb-1">Edge Clearance Ratio</label>
                                        <div className="flex items-center">
                                            <input
                                                type="number"
                                                step="0.1"
                                                value={edgeLabelClearanceRatio}
                                                onChange={(e) => setEdgeLabelClearanceRatio(Math.max(0, Math.min(5, parseFloat(e.target.value) || 0)))}
                                                className="w-full border rounded p-1.5 focus:ring-2 focus:ring-indigo-500 focus:outline-none text-sm"
                                            />
                                        </div>`
);


// 6. Replace optimizeLabelPlacements
const regex = /export const optimizeLabelPlacements = \([\s\S]*?\n\};\n/g;
const newFunction = `export const optimizeLabelPlacements = (
    currentNodes: NetworkNode[],
    currentEdges: NetworkEdge[],
    globalEdgeLabelProximity: number,
    globalVertexLabelProximity: number,
    edgeLabelClearanceRatio: number,
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

    let sumX = 0, sumY = 0, count = 0;
    currentNodes.forEach(n => { sumX += n.x; sumY += n.y; count++; });
    let cmX = count > 0 ? sumX / count : 0;
    let cmY = count > 0 ? sumY / count : 0;

    // 1. Edge Labels
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
        
        // Pick side based on center of mass (pick the one furthest from CM to point outward)
        let d1 = Math.hypot(midX + c1.x - cmX, midY + c1.y - cmY);
        let d2 = Math.hypot(midX + c2.x - cmX, midY + c2.y - cmY);
        let N_dir = d1 > d2 ? 1 : -1;
        
        // Preserve user's existing side choice if they dragged it previously
        if (e.labelOffset && (e.labelOffset.x !== 0 || e.labelOffset.y !== 0)) {
            let dot = e.labelOffset.x * nx + e.labelOffset.y * ny;
            N_dir = dot >= 0 ? 1 : -1;
        }

        let maxT = len * 0.25;
        let best_t = 0;
        let best_n = 0;
        let best_score = -Infinity;
        
        const checkClearance = (candT: number, candN: number) => {
            let px = midX + candT * tx + candN * N_dir * nx;
            let py = midY + candT * ty + candN * N_dir * ny;
            
            let minOtherDist = Infinity;
            currentEdges.forEach(oe => {
                if (oe.id === e.id) return;
                const ofn = currentNodes.find(n => n.id === oe.from);
                const otn = currentNodes.find(n => n.id === oe.to);
                if (ofn && otn) {
                    let d = distToSegment(px, py, ofn.x, ofn.y, otn.x, otn.y).dist;
                    if (d < minOtherDist) minOtherDist = d;
                }
            });
            currentNodes.forEach(on => {
                let d = Math.hypot(px - on.x, py - on.y);
                if (d - 15 < minOtherDist) minOtherDist = Math.max(0, d - 15);
            });
            
            return minOtherDist >= edgeLabelClearanceRatio * candN;
        };
        
        for (let t_idx = -10; t_idx <= 10; t_idx++) {
            let candT = (t_idx / 10) * maxT;
            let lowN = 0;
            let highN = dist;
            let maxValidN = 0;
            
            if (checkClearance(candT, dist)) {
                maxValidN = dist;
            } else {
                for (let i = 0; i < 6; i++) {
                    let midN = (lowN + highN) / 2;
                    if (checkClearance(candT, midN)) {
                        lowN = midN;
                        maxValidN = midN;
                    } else {
                        highN = midN;
                    }
                }
            }
            
            let score = maxValidN * 1000 - Math.abs(candT);
            if (score > best_score) {
                best_score = score;
                best_t = candT;
                best_n = maxValidN;
            }
        }
        
        return {
            ...e,
            labelOffset: {
                x: Math.round(best_t * tx + best_n * N_dir * nx),
                y: Math.round(best_t * ty + best_n * N_dir * ny)
            }
        };
    });

    // 2. Vertex Labels: Sample angles to find global minimum of repulsive potential
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

code = code.replace(regex, newFunction);
fs.writeFileSync('pages/NetworkGrapher.tsx', code);
