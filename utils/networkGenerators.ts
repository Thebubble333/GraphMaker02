import { v4 as uuidv4 } from 'uuid';
import { NetworkNode, NetworkEdge } from '../pages/NetworkGrapher';

export const generateRegularNetwork = (n: number, k: number, width: number, height: number) => {
    if (k >= n || n * k % 2 !== 0) {
        return { nodes: [], edges: [], error: 'Invalid parameters: n*k must be even, and k < n.' };
    }

    const newNodes: NetworkNode[] = [];
    const cx = width / 2;
    const cy = height / 2;
    const radius = Math.min(width, height) / 2 * 0.8;

    for (let i = 0; i < n; i++) {
        const angle = (i / n) * 2 * Math.PI - Math.PI / 2;
        newNodes.push({
            id: `n${i}`,
            x: cx + radius * Math.cos(angle),
            y: cy + radius * Math.sin(angle),
            label: String(i),
            radius: 15, labelStyle: 'inside', labelOffset: { x: 15, y: -15 }
        });
    }

    const newEdges: NetworkEdge[] = [];
    // Harary graph construction for k-regular graph
    for (let i = 0; i < n; i++) {
        for (let j = 1; j <= Math.floor(k / 2); j++) {
            const target = (i + j) % n;
            newEdges.push({
                id: uuidv4(),
                from: `n${i}`,
                to: `n${target}`,
                label: '',
                isDirected: false,
                isDummy: false,
                isCurve: false
            });
        }
    }
    if (k % 2 !== 0) {
        const half = n / 2;
        for (let i = 0; i < half; i++) {
            newEdges.push({
                id: uuidv4(),
                from: `n${i}`,
                to: `n${i + half}`,
                label: '',
                isDirected: false,
                isDummy: false,
                isCurve: false
            });
        }
    }

    return { nodes: newNodes, edges: newEdges };
};

export const generateActivityNetwork = (precedenceText: string, width: number, height: number) => {
    const rows = precedenceText.trim().split('\n').map(r => r.split(',').map(s => s.trim()));
    if (rows.length === 0) return { nodes: [], edges: [] };

    type Activity = { id: string, name: string, dur: string, preds: string[], startNode: string, endNode: string };
    const activities: Activity[] = [];
    
    rows.forEach(row => {
        if (!row[0]) return;
        const name = row[0];
        const predsStr = row[1] || '-';
        const dur = row[2] || '';
        const preds = (predsStr === '-' || predsStr === '') ? [] : predsStr.split(/;|\|/).map(s => s.trim());
        activities.push({ id: uuidv4(), name, dur, preds, startNode: uuidv4(), endNode: uuidv4() });
    });

    let nodesData: { id: string, name: string }[] = [];
    let edgesData: { from: string, to: string, label: string, dummy: boolean }[] = [];

    activities.forEach(a => {
        nodesData.push({ id: a.startNode, name: `${a.name}_S` });
        nodesData.push({ id: a.endNode, name: `${a.name}_E` });
        edgesData.push({ from: a.startNode, to: a.endNode, label: `${a.name}${a.dur ? ','+a.dur : ''}`, dummy: false });
    });

    activities.forEach(a => {
        a.preds.forEach(pName => {
            const p = activities.find(act => act.name === pName);
            if (p) {
                edgesData.push({ from: p.endNode, to: a.startNode, label: '', dummy: true });
            }
        });
    });

    // Merge nodes logic:
    // If a node A has only one dummy outgoing to B, and B has only one dummy incoming from A, merge them.
    let changed = true;
    while (changed) {
        changed = false;
        for (let i = 0; i < edgesData.length; i++) {
            const e = edgesData[i];
            if (e.dummy) {
                const outFromA = edgesData.filter(ed => ed.from === e.from);
                const inToB = edgesData.filter(ed => ed.to === e.to);
                if (outFromA.length === 1 && outFromA[0].dummy) {
                    const nodeToRemove = e.from;
                    const nodeToKeep = e.to;
                    edgesData = edgesData.filter(ed => ed !== e);
                    edgesData.forEach(ed => { if (ed.from === nodeToRemove) ed.from = nodeToKeep; if (ed.to === nodeToRemove) ed.to = nodeToKeep; });
                    nodesData = nodesData.filter(nd => nd.id !== nodeToRemove);
                    changed = true;
                    break;
                } else if (inToB.length === 1 && inToB[0].dummy) {
                    const nodeToRemove = e.to;
                    const nodeToKeep = e.from;
                    edgesData = edgesData.filter(ed => ed !== e);
                    edgesData.forEach(ed => { if (ed.from === nodeToRemove) ed.from = nodeToKeep; if (ed.to === nodeToRemove) ed.to = nodeToKeep; });
                    nodesData = nodesData.filter(nd => nd.id !== nodeToRemove);
                    changed = true;
                    break;
                }
            }
        }
    }

    // Merge all nodes with no incoming edges into a single Start node
    const inDegrees: Record<string, number> = {};
    nodesData.forEach(n => inDegrees[n.id] = 0);
    edgesData.forEach(e => { inDegrees[e.to] = (inDegrees[e.to] || 0) + 1; });
    const startNodes = nodesData.filter(n => inDegrees[n.id] === 0);
    if (startNodes.length > 1) {
        const globalStart = startNodes[0].id;
        for (let i = 1; i < startNodes.length; i++) {
            const nodeToRemove = startNodes[i].id;
            edgesData.forEach(ed => { if (ed.from === nodeToRemove) ed.from = globalStart; });
            nodesData = nodesData.filter(nd => nd.id !== nodeToRemove);
        }
    }

    // Merge all nodes with no outgoing edges into a single End node
    const outDegrees: Record<string, number> = {};
    nodesData.forEach(n => outDegrees[n.id] = 0);
    edgesData.forEach(e => { outDegrees[e.from] = (outDegrees[e.from] || 0) + 1; });
    const endNodes = nodesData.filter(n => outDegrees[n.id] === 0);
    if (endNodes.length > 1) {
        const globalEnd = endNodes[0].id;
        for (let i = 1; i < endNodes.length; i++) {
            const nodeToRemove = endNodes[i].id;
            edgesData.forEach(ed => { if (ed.to === nodeToRemove) ed.to = globalEnd; });
            nodesData = nodesData.filter(nd => nd.id !== nodeToRemove);
        }
    }

    // Topological sort
    const adj: Record<string, string[]> = {};
    const revAdj: Record<string, string[]> = {};
    nodesData.forEach(n => { adj[n.id] = []; revAdj[n.id] = []; });
    edgesData.forEach(e => {
        adj[e.from].push(e.to);
        revAdj[e.to].push(e.from);
    });

    const visited: Record<string, boolean> = {};
    const stack: string[] = [];
    const visit = (node: string) => {
        if (visited[node]) return;
        visited[node] = true;
        adj[node].forEach(visit);
        stack.push(node);
    };
    nodesData.forEach(n => visit(n.id));
    const orderedIds = stack.reverse();

    // 1. Calculate ASAP (Earliest) Layer
    const asap: Record<string, number> = {};
    orderedIds.forEach(id => asap[id] = 0);
    orderedIds.forEach(u => {
        edgesData.filter(e => e.from === u).forEach(e => {
            if (asap[u] + 1 > asap[e.to]) {
                asap[e.to] = asap[u] + 1;
            }
        });
    });

    const maxLayer = Math.max(...Object.values(asap), 1);

    // 2. Calculate ALAP (Latest) Layer
    const alap: Record<string, number> = {};
    orderedIds.forEach(id => alap[id] = maxLayer);
    [...orderedIds].reverse().forEach(u => {
        edgesData.filter(e => e.to === u).forEach(e => {
            if (alap[u] - 1 < alap[e.from]) {
                alap[e.from] = alap[u] - 1;
            }
        });
    });

    // 3. Assign Balanced Layers (keep single start at 0, single end at maxLayer)
    const layers: Record<string, number> = {};
    orderedIds.forEach(id => {
        if (inDegrees[id] === 0) {
            layers[id] = 0;
        } else if (outDegrees[id] === 0) {
            layers[id] = maxLayer;
        } else {
            // Favor ALAP for sink-feeding activities to keep layouts compact and clean
            layers[id] = Math.max(asap[id], Math.min(alap[id], Math.round((asap[id] + alap[id]) / 2)));
        }
    });

    // Ensure edge monotonicity: layers[to] > layers[from]
    let layerAdjusted = true;
    while (layerAdjusted) {
        layerAdjusted = false;
        edgesData.forEach(e => {
            if (layers[e.to] <= layers[e.from]) {
                layers[e.to] = layers[e.from] + 1;
                layerAdjusted = true;
            }
        });
    }

    const effectiveMaxLayer = Math.max(...Object.values(layers), 1);
    const startX = 100;
    const endX = width - 100;
    const layerWidth = (endX - startX) / effectiveMaxLayer;

    // Group nodes by layer
    const layerNodes: Record<number, string[]> = {};
    for (let l = 0; l <= effectiveMaxLayer; l++) layerNodes[l] = [];
    orderedIds.forEach(id => {
        const l = layers[id];
        if (!layerNodes[l]) layerNodes[l] = [];
        layerNodes[l].push(id);
    });

    // 4. Barycentric Ordering across layers to minimize crossings
    const nodeYOrder: Record<string, number> = {};
    // Initial order based on topology
    orderedIds.forEach((id, idx) => { nodeYOrder[id] = idx; });

    // Multi-pass forward and backward barycentric relaxation
    for (let pass = 0; pass < 6; pass++) {
        // Forward pass
        for (let l = 1; l <= effectiveMaxLayer; l++) {
            const current = layerNodes[l];
            current.forEach(u => {
                const preds = revAdj[u];
                if (preds.length > 0) {
                    const avgY = preds.reduce((acc, p) => acc + (nodeYOrder[p] ?? 0), 0) / preds.length;
                    nodeYOrder[u] = avgY;
                }
            });
            current.sort((a, b) => (nodeYOrder[a] ?? 0) - (nodeYOrder[b] ?? 0));
            current.forEach((u, idx) => { nodeYOrder[u] = idx; });
        }

        // Backward pass
        for (let l = effectiveMaxLayer - 1; l >= 0; l--) {
            const current = layerNodes[l];
            current.forEach(u => {
                const succs = adj[u];
                if (succs.length > 0) {
                    const avgY = succs.reduce((acc, s) => acc + (nodeYOrder[s] ?? 0), 0) / succs.length;
                    nodeYOrder[u] = avgY;
                }
            });
            current.sort((a, b) => (nodeYOrder[a] ?? 0) - (nodeYOrder[b] ?? 0));
            current.forEach((u, idx) => { nodeYOrder[u] = idx; });
        }
    }

    // 5. Position Final Nodes
    let labelCounter = 1;
    const finalNodes: NetworkNode[] = [];
    const centerY = height / 2;

    for (let l = 0; l <= effectiveMaxLayer; l++) {
        const current = layerNodes[l];
        const count = current.length;
        const spacing = Math.min(130, (height - 160) / Math.max(count, 1));
        const totalHeight = (count - 1) * spacing;
        const topY = centerY - totalHeight / 2;

        current.forEach((id, idx) => {
            finalNodes.push({
                id,
                x: startX + l * layerWidth,
                y: count === 1 ? centerY : topY + idx * spacing,
                label: String(labelCounter++),
                radius: 6,
                labelStyle: 'none',
                labelOffset: { x: 15, y: -15 }
            });
        });
    }

    const finalEdges: NetworkEdge[] = edgesData.map(e => ({
        id: uuidv4(),
        from: e.from,
        to: e.to,
        label: e.label,
        isDirected: true,
        isDummy: e.dummy,
        isCurve: false
    }));

    // 6. Symmetrical Outward Curve Calculation for Multi-Edges
    const edgePairGroups: Record<string, NetworkEdge[]> = {};
    finalEdges.forEach(e => {
        const key = [e.from, e.to].sort().join('___');
        if (!edgePairGroups[key]) edgePairGroups[key] = [];
        edgePairGroups[key].push(e);
    });

    Object.values(edgePairGroups).forEach(group => {
        if (group.length > 1) {
            const u = finalNodes.find(n => n.id === group[0].from);
            const v = finalNodes.find(n => n.id === group[0].to);
            if (!u || !v) return;
            const mx = (u.x + v.x) / 2;
            const my = (u.y + v.y) / 2;
            const dx = v.x - u.x;
            const dy = v.y - u.y;
            const dist = Math.hypot(dx, dy) || 1;
            const nx = -dy / dist;
            const ny = dx / dist;

            const spread = 45;
            const offsets = group.map((_, idx) => (idx - (group.length - 1) / 2) * spread);
            group.forEach((edge, idx) => {
                const offset = offsets[idx];
                if (offset !== 0) {
                    edge.isCurve = true;
                    edge.cp1 = { x: mx + nx * offset, y: my + ny * offset };
                }
            });
        }
    });

    // 7. Intelligent Outward Obstacle Avoidance for Long-Span and Crossing Edges
    const diagramCenterX = width / 2;
    const diagramCenterY = height / 2;
    let curveStackCount = 0;

    finalEdges.forEach(edge => {
        if (edge.isCurve) return; // already handled by multi-edge

        const u = finalNodes.find(n => n.id === edge.from);
        const v = finalNodes.find(n => n.id === edge.to);
        if (!u || !v) return;

        const layerSpan = Math.abs((layers[edge.to] || 0) - (layers[edge.from] || 0));
        const dx = v.x - u.x;
        const dy = v.y - u.y;
        const dist = Math.hypot(dx, dy) || 1;
        const ux = dx / dist;
        const uy = dy / dist;

        // Two normal unit vectors perpendicular to the edge
        const norm1 = { x: -uy, y: ux };
        const norm2 = { x: uy, y: -ux };

        const mx = (u.x + v.x) / 2;
        const my = (u.y + v.y) / 2;

        // Outward vector from diagram center to the edge midpoint
        const vcx = mx - diagramCenterX;
        const vcy = my - diagramCenterY;

        // Select the normal pointing strictly OUTWARDS away from the center of the diagram
        let outNorm = (norm1.x * vcx + norm1.y * vcy >= 0) ? norm1 : norm2;
        // If midpoint is on the horizontal center line, push up or down based on y
        if (Math.abs(vcy) < 10) {
            outNorm = (my <= diagramCenterY) ? { x: 0, y: -1 } : { x: 0, y: 1 };
        }

        // Obstacle detection along the segment
        let obstacleFound = false;
        let maxObstacleDist = 0;

        for (const w of finalNodes) {
            if (w.id === edge.from || w.id === edge.to) continue;

            const wx = w.x - u.x;
            const wy = w.y - u.y;
            const tProj = (wx * ux + wy * uy) / dist;

            // Intermediate range along the segment
            if (tProj > 0.08 && tProj < 0.92) {
                // Perpendicular distance to line
                const perpDist = (wx * outNorm.x + wy * outNorm.y);
                const absPerp = Math.abs(wx * norm1.x + wy * norm1.y);

                if (absPerp < 30) {
                    obstacleFound = true;
                    if (perpDist > maxObstacleDist) {
                        maxObstacleDist = perpDist;
                    }
                }
            }
        }

        // Also check if edge spans 2+ layers and is not on the direct boundary
        if (obstacleFound || (layerSpan >= 2 && Math.abs(my - diagramCenterY) > 40)) {
            edge.isCurve = true;
            curveStackCount++;

            // Arc outward with sufficient clearance over obstacles
            const clearance = obstacleFound ? Math.max(50, maxObstacleDist + 40) : (35 + layerSpan * 15);
            const stackOffset = (curveStackCount % 2) * 12;
            const arcRadius = clearance + stackOffset;

            edge.cp1 = {
                x: mx + outNorm.x * arcRadius,
                y: my + outNorm.y * arcRadius
            };
        }
    });

    return { nodes: finalNodes, edges: finalEdges };
};

export const parseAdjacencyMatrix = (text: string): { matrix: number[][], labels: string[] } => {
    const rawLines = text.trim().split('\n').map(l => l.trim()).filter(l => l.length > 0);
    if (rawLines.length === 0) return { matrix: [], labels: [] };

    let labels: string[] = [];
    let matrixLines = rawLines;

    // Check if the first line is header labels (e.g. A B C D or A,B,C,D)
    const firstTokens = rawLines[0].split(/[\s,;\t]+/).filter(Boolean);
    const hasHeader = firstTokens.length > 0 && firstTokens.every(t => isNaN(Number(t)));

    if (hasHeader) {
        labels = firstTokens;
        matrixLines = rawLines.slice(1);
    }

    const matrix: number[][] = [];
    for (let i = 0; i < matrixLines.length; i++) {
        let tokens = matrixLines[i].split(/[\s,;\t]+/).filter(Boolean);
        // If line starts with a non-numeric label (row label)
        if (tokens.length > 0 && isNaN(Number(tokens[0])) && (tokens.length === matrixLines.length + 1 || hasHeader)) {
            if (!hasHeader && labels.length < matrixLines.length) {
                labels.push(tokens[0]);
            }
            tokens = tokens.slice(1);
        }
        const row = tokens.map(t => {
            const val = parseFloat(t);
            return isNaN(val) ? 0 : val;
        });
        matrix.push(row);
    }

    // Default labels if not provided or incomplete
    const n = matrix.length;
    if (labels.length < n) {
        labels = Array.from({ length: n }, (_, i) => String.fromCharCode(65 + i));
    }

    return { matrix, labels };
};

export const generateFromAdjacencyMatrix = (
    matrix: number[][],
    labels: string[],
    isDirected: boolean,
    width: number,
    height: number,
    showWeights: boolean = true,
    customPositions?: { x: number, y: number }[]
): { nodes: NetworkNode[], edges: NetworkEdge[] } => {
    const n = matrix.length;
    if (n === 0) return { nodes: [], edges: [] };

    const nodes: NetworkNode[] = [];
    const cx = width / 2;
    const cy = height / 2;
    const radius = Math.min(width, height) / 2 * 0.72;

    for (let i = 0; i < n; i++) {
        let x = cx + radius * Math.cos((i / n) * 2 * Math.PI - Math.PI / 2);
        let y = cy + radius * Math.sin((i / n) * 2 * Math.PI - Math.PI / 2);
        if (customPositions && customPositions[i]) {
            x = customPositions[i].x;
            y = customPositions[i].y;
        }

        nodes.push({
            id: `node_${i}`,
            x,
            y,
            label: labels[i] || String.fromCharCode(65 + i),
            radius: 15,
            labelStyle: 'inside',
            labelOffset: { x: 15, y: -15 }
        });
    }

    const edges: NetworkEdge[] = [];

    for (let i = 0; i < n; i++) {
        const fromNode = nodes[i];
        for (let j = 0; j < (isDirected ? n : i + 1); j++) {
            const toNode = nodes[j];
            const weight = matrix[i][j];

            if (weight <= 0) continue;

            const edgeLabel = showWeights ? String(weight) : (weight !== 1 ? String(weight) : '');

            // Self-loop
            if (i === j) {
                const angle = (i / n) * 2 * Math.PI - Math.PI / 2;
                const peakDist = 60;
                edges.push({
                    id: uuidv4(),
                    from: fromNode.id,
                    to: fromNode.id,
                    label: edgeLabel,
                    isDirected,
                    isDummy: false,
                    isCurve: false,
                    isLoop: true,
                    loopRadiusY: 1.0,
                    cp1: {
                        x: fromNode.x + peakDist * Math.cos(angle),
                        y: fromNode.y + peakDist * Math.sin(angle)
                    }
                });
            } else {
                // Check if reverse edge exists in directed graph (two opposing directed edges)
                const hasOpposite = isDirected && matrix[j] && matrix[j][i] > 0;
                const isCurved = hasOpposite;
                let cp1 = undefined;
                if (isCurved) {
                    const mx = (fromNode.x + toNode.x) / 2;
                    const my = (fromNode.y + toNode.y) / 2;
                    const dx = toNode.x - fromNode.x;
                    const dy = toNode.y - fromNode.y;
                    const dist = Math.hypot(dx, dy) || 1;
                    const nx = -dy / dist;
                    const ny = dx / dist;
                    cp1 = { x: mx + 35 * nx, y: my + 35 * ny };
                }

                edges.push({
                    id: uuidv4(),
                    from: fromNode.id,
                    to: toNode.id,
                    label: edgeLabel,
                    isDirected,
                    isDummy: false,
                    isCurve: isCurved,
                    cp1
                });
            }
        }
    }

    return { nodes, edges };
};

export const generateAdjacencyMatrixFromGraph = (
    nodes: NetworkNode[],
    edges: NetworkEdge[],
    isDirected: boolean
): { matrix: number[][], labels: string[] } => {
    const labels = nodes.map(n => n.label || n.id);
    const n = nodes.length;
    const matrix: number[][] = Array.from({ length: n }, () => Array(n).fill(0));

    const nodeIndexMap: Record<string, number> = {};
    nodes.forEach((node, idx) => {
        nodeIndexMap[node.id] = idx;
    });

    edges.forEach(edge => {
        const u = nodeIndexMap[edge.from];
        const v = nodeIndexMap[edge.to];
        if (u !== undefined && v !== undefined) {
            const parsed = parseFloat(edge.label);
            const weight = isNaN(parsed) ? 1 : parsed;
            matrix[u][v] = weight;
            if (!isDirected && !edge.isDirected && u !== v) {
                matrix[v][u] = weight;
            }
        }
    });

    return { matrix, labels };
};

export const generatePrecedenceTableFromGraph = (
    nodes: NetworkNode[],
    edges: NetworkEdge[]
): { activity: string, predecessors: string[], duration: string }[] => {
    const nonDummyEdges = edges.filter(e => !e.isDummy);
    const nodeIncoming: Record<string, NetworkEdge[]> = {};
    const nodeOutgoing: Record<string, NetworkEdge[]> = {};

    nodes.forEach(n => {
        nodeIncoming[n.id] = [];
        nodeOutgoing[n.id] = [];
    });

    edges.forEach(e => {
        if (nodeIncoming[e.to]) nodeIncoming[e.to].push(e);
        if (nodeOutgoing[e.from]) nodeOutgoing[e.from].push(e);
    });

    const result: { activity: string, predecessors: string[], duration: string }[] = [];

    nonDummyEdges.forEach(edge => {
        const rawLabel = edge.label || 'Act';
        const parts = rawLabel.split(',').map(s => s.trim());
        const actName = parts[0] || 'Act';
        const duration = parts[1] || '';

        // Predecessors are all activities that feed into edge.from directly or via dummy chains
        const findPredecessors = (nodeId: string, visited: Set<string> = new Set()): string[] => {
            if (visited.has(nodeId)) return [];
            visited.add(nodeId);
            const preds: string[] = [];
            const inEdges = nodeIncoming[nodeId] || [];

            inEdges.forEach(inE => {
                if (inE.isDummy) {
                    preds.push(...findPredecessors(inE.from, visited));
                } else {
                    const pName = (inE.label || '').split(',')[0].trim();
                    if (pName) preds.push(pName);
                }
            });
            return preds;
        };

        const predecessors = Array.from(new Set(findPredecessors(edge.from)));
        result.push({
            activity: actName,
            predecessors: predecessors.length > 0 ? predecessors : ['-'],
            duration
        });
    });

    return result;
};
