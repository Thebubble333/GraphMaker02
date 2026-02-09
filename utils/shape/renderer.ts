
import React from 'react';
import { ShapeDef, RenderedEdge, RenderedVertex, DecorationType, AngleType } from './types';
import { rotatePoint, getMidpoint, getVector, normalize, getNormal, getRectVertices, getTriangleVertices, degToRad } from './math';
import { TexEngine } from '../textRenderer';

const tex = new TexEngine();

const renderResizeHandle = (
    x: number, 
    y: number, 
    id: string, 
    onDrag?: (id: string, e: React.MouseEvent) => void
): React.ReactNode => {
    return React.createElement('circle', {
        key: `handle-${id}`,
        cx: x, cy: y, r: 5,
        fill: "white", 
        stroke: "#3b82f6", 
        strokeWidth: 1.5,
        onMouseDown: onDrag ? (e: React.MouseEvent) => onDrag(id, e) : undefined,
        style: { cursor: 'pointer' }
    });
};

// --- GEOMETRY GENERATORS ---

const computePolyGeometry = (shape: ShapeDef): { vertices: {x:number, y:number}[], edges: RenderedEdge[], nodes: RenderedVertex[] } | null => {
    let rawVerts: {x:number, y:number}[] = [];

    if (shape.type === 'rectangle') {
        rawVerts = getRectVertices(shape.width, shape.height);
    } else if (shape.type === 'triangle') {
        rawVerts = getTriangleVertices(shape.base, shape.height, shape.peakOffset);
    } else if (shape.type === 'right-triangle') {
        rawVerts = getTriangleVertices(shape.base, shape.height, 0);
    } else {
        return null; // Circle handled separately
    }

    // Apply Transform (Rotation + Translation)
    const vertices = rawVerts.map(v => {
        const r = rotatePoint(v.x + shape.x, v.y + shape.y, shape.x, shape.y, shape.rotation);
        return r;
    });

    const edges: RenderedEdge[] = [];
    const nodes: RenderedVertex[] = [];

    for(let i=0; i<vertices.length; i++) {
        const p1 = vertices[i];
        const p2 = vertices[(i+1) % vertices.length];
        
        const vec = getVector(p1, p2);
        const len = Math.sqrt(vec.x*vec.x + vec.y*vec.y);
        const unit = normalize(vec);
        const norm = getNormal(unit); // Points "in" or "out" depending on winding.
        
        edges.push({
            index: i,
            p1, p2,
            midpoint: getMidpoint(p1, p2),
            normal: norm,
            length: len,
            angle: Math.atan2(vec.y, vec.x)
        });

        nodes.push({
            index: i,
            p: p1,
            edgeInIndex: (i - 1 + vertices.length) % vertices.length,
            edgeOutIndex: i
        });
    }

    return { vertices, edges, nodes };
};

// --- DRAWING HELPERS ---

const renderEdgeDecoration = (edge: RenderedEdge, type: DecorationType, color: string): React.ReactNode => {
    const { midpoint, normal, angle } = edge;
    const size = 8;
    const gap = 3;
    const deg = angle * 180 / Math.PI;
    const transform = `translate(${midpoint.x}, ${midpoint.y}) rotate(${deg})`;
    const strokeWidth = 1.5;

    if (type === 'tick') {
        return React.createElement('line', { transform, x1: 0, y1: -size, x2: 0, y2: size, stroke: color, strokeWidth: 2 });
    }
    if (type === 'double-tick') {
        return React.createElement('g', { transform },
            React.createElement('line', { x1: -gap, y1: -size, x2: -gap, y2: size, stroke: color, strokeWidth }),
            React.createElement('line', { x1: gap, y1: -size, x2: gap, y2: size, stroke: color, strokeWidth })
        );
    }
    if (type === 'triple-tick') {
        return React.createElement('g', { transform },
            React.createElement('line', { x1: -gap*2, y1: -size, x2: -gap*2, y2: size, stroke: color, strokeWidth }),
            React.createElement('line', { x1: 0, y1: -size, x2: 0, y2: size, stroke: color, strokeWidth }),
            React.createElement('line', { x1: gap*2, y1: -size, x2: gap*2, y2: size, stroke: color, strokeWidth })
        );
    }
    if (type === 'arrow') {
        return React.createElement('path', { transform, d: "M -6 -6 L 4 0 L -6 6", fill: "none", stroke: color, strokeWidth });
    }
    if (type === 'double-arrow') {
        return React.createElement('g', { transform },
            React.createElement('path', { d: "M -10 -6 L 0 0 L -10 6", fill: "none", stroke: color, strokeWidth }),
            React.createElement('path', { d: "M 0 -6 L 10 0 L 0 6", fill: "none", stroke: color, strokeWidth })
        );
    }
    return null;
};

const renderVertexDecoration = (vertex: RenderedVertex, edges: RenderedEdge[], type: AngleType, color: string): React.ReactNode => {
    if (type === 'none') return null;

    const eIn = edges[vertex.edgeInIndex];
    const eOut = edges[vertex.edgeOutIndex];
    
    // Vectors pointing AWAY from vertex
    const v1 = normalize(getVector(vertex.p, eIn.p1)); 
    const v2 = normalize(getVector(vertex.p, eOut.p2)); 
    
    // Calculate angle for dynamic sizing
    const dot = v1.x * v2.x + v1.y * v2.y;
    const angleRad = Math.acos(Math.max(-1, Math.min(1, dot)));
    const angleDeg = angleRad * (180 / Math.PI);

    // Dynamic Size: 20 * (1.5 - span/240) matches Python logic
    const baseR = 20;
    const rMult = 1.5 - (angleDeg / 240);
    const size = baseR * Math.max(0.5, rMult);
    const strokeWidth = 1.5;

    if (type === 'right') {
        const rSize = 12;
        const p1 = { x: vertex.p.x + v1.x * rSize, y: vertex.p.y + v1.y * rSize };
        const p2 = { x: vertex.p.x + v2.x * rSize, y: vertex.p.y + v2.y * rSize };
        const p3 = { x: p1.x + v2.x * rSize, y: p1.y + v2.y * rSize }; 
        return React.createElement('path', { d: `M ${p1.x} ${p1.y} L ${p3.x} ${p3.y} L ${p2.x} ${p2.y}`, fill: "none", stroke: color, strokeWidth });
    }

    // Circular Arc Logic
    const generateArc = (r: number) => {
        const start = { x: vertex.p.x + v1.x * r, y: vertex.p.y + v1.y * r };
        const end = { x: vertex.p.x + v2.x * r, y: vertex.p.y + v2.y * r };
        
        const cp = v1.x * v2.y - v1.y * v2.x;
        const sweep = cp >= 0 ? 1 : 0; 

        return `M ${start.x} ${start.y} A ${r} ${r} 0 0 ${sweep} ${end.x} ${end.y}`;
    };

    if (type === 'arc') {
        return React.createElement('path', { d: generateArc(size), fill: "none", stroke: color, strokeWidth });
    }

    if (type === 'double-arc') {
        return React.createElement('g', {},
            React.createElement('path', { d: generateArc(size), fill: "none", stroke: color, strokeWidth }),
            React.createElement('path', { d: generateArc(size + 4), fill: "none", stroke: color, strokeWidth })
        );
    }

    return null;
};

const renderDimensionLine = (
    start: {x:number, y:number}, 
    end: {x:number, y:number}, 
    offset: number, 
    color: string
): React.ReactNode => {
    // Normal vector
    const vec = getVector(start, end);
    const len = Math.sqrt(vec.x*vec.x + vec.y*vec.y);
    if (len === 0) return null;
    const unit = { x: vec.x/len, y: vec.y/len };
    const norm = { x: -unit.y, y: unit.x }; // -y, x

    const offX = norm.x * offset;
    const offY = norm.y * offset;

    const p1 = { x: start.x + offX, y: start.y + offY };
    const p2 = { x: end.x + offX, y: end.y + offY };

    // Arrows
    const arrowSz = 6;
    const angle = Math.atan2(unit.y, unit.x);
    const a1 = angle - Math.PI / 6;
    const a2 = angle + Math.PI / 6;
    
    const angleRev = angle + Math.PI;
    const ar1 = angleRev - Math.PI / 6;
    const ar2 = angleRev + Math.PI / 6;

    const head1 = `M ${p2.x} ${p2.y} L ${p2.x - Math.cos(a1)*arrowSz} ${p2.y - Math.sin(a1)*arrowSz} L ${p2.x - Math.cos(a2)*arrowSz} ${p2.y - Math.sin(a2)*arrowSz} Z`;
    const head2 = `M ${p1.x} ${p1.y} L ${p1.x - Math.cos(ar1)*arrowSz} ${p1.y - Math.sin(ar1)*arrowSz} L ${p1.x - Math.cos(ar2)*arrowSz} ${p1.y - Math.sin(ar2)*arrowSz} Z`;

    const strokeWidth = 1.5;

    // For inside dims (negative offset), we might typically flip arrows to point outward?
    // For now, we keep standard arrows at the ends of the line.

    return React.createElement('g', {},
        React.createElement('line', { x1: p1.x, y1: p1.y, x2: p2.x, y2: p2.y, stroke: color, strokeWidth }),
        React.createElement('path', { d: head1, fill: color }),
        React.createElement('path', { d: head2, fill: color }),
        // Extension lines (Only draw if offset is significant)
        Math.abs(offset) > 10 && React.createElement('line', { x1: start.x + norm.x*5, y1: start.y + norm.y*5, x2: p1.x + norm.x*5, y2: p1.y + norm.y*5, stroke: color, strokeWidth: strokeWidth * 0.5 }),
        Math.abs(offset) > 10 && React.createElement('line', { x1: end.x + norm.x*5, y1: end.y + norm.y*5, x2: p2.x + norm.x*5, y2: p2.y + norm.y*5, stroke: color, strokeWidth: strokeWidth * 0.5 })
    );
};

const renderAltitude = (peak: {x:number, y:number}, baseP1: {x:number, y:number}, baseP2: {x:number, y:number}, color: string): React.ReactNode => {
    // Project peak onto line(baseP1, baseP2)
    const baseVec = getVector(baseP1, baseP2);
    const lenSq = baseVec.x*baseVec.x + baseVec.y*baseVec.y;
    if (lenSq === 0) return null;
    
    const peakVec = getVector(baseP1, peak);
    const t = (peakVec.x * baseVec.x + peakVec.y * baseVec.y) / lenSq;
    
    const foot = {
        x: baseP1.x + t * baseVec.x,
        y: baseP1.y + t * baseVec.y
    };

    const strokeWidth = 1.5;

    // Draw Altitude Line
    const line = React.createElement('line', { 
        x1: peak.x, y1: peak.y, x2: foot.x, y2: foot.y, 
        stroke: color, strokeWidth, strokeDasharray: "4,4" 
    });

    // Draw Right Angle at Foot
    const vUp = normalize(getVector(foot, peak));
    const vBase = normalize(getVector(foot, baseP2));
    
    const sz = 10;
    const raP1 = { x: foot.x + vUp.x * sz, y: foot.y + vUp.y * sz };
    const raP2 = { x: foot.x + vBase.x * sz, y: foot.y + vBase.y * sz };
    const raP3 = { x: raP1.x + vBase.x * sz, y: raP1.y + vBase.y * sz };
    
    const angleMark = React.createElement('path', {
        d: `M ${raP1.x} ${raP1.y} L ${raP3.x} ${raP3.y} L ${raP2.x} ${raP2.y}`,
        fill: "none", stroke: color, strokeWidth
    });

    return React.createElement('g', {}, line, angleMark);
};

// --- MAIN RENDERER ---

export const renderShape = (
    shape: ShapeDef, 
    isSelected: boolean,
    onMouseDown?: (e: React.MouseEvent) => void,
    onLabelDrag?: (labelId: string, e: React.MouseEvent) => void,
    onHandleDrag?: (handleId: string, e: React.MouseEvent) => void
): React.ReactNode[] => {
    const els: React.ReactNode[] = [];
    const color = shape.stroke;
    const strokeWidth = shape.strokeWidth || 1.5;

    // 1. Polygon Shapes
    const poly = computePolyGeometry(shape);
    if (poly) {
        // Fill/Stroke
        const d = poly.vertices.map((v, i) => `${i===0?'M':'L'} ${v.x} ${v.y}`).join(' ') + " Z";
        els.push(
            React.createElement('path', {
                key: `shape-${shape.id}`, 
                d,
                fill: shape.fill, 
                stroke: shape.stroke, 
                strokeWidth: strokeWidth,
                fillOpacity: shape.opacity,
                onMouseDown,
                style: { cursor: 'move' },
                vectorEffect: "non-scaling-stroke"
            })
        );

        // Dimensions (Rect)
        if (shape.type === 'rectangle' && shape.showDimensions) {
            const eTop = poly.edges[0];
            const eRight = poly.edges[1];
            
            const placement = shape.dimensionPlacement || 'outside';
            // FLIPPED LOGIC: Normals point IN. So +20 is IN, -30 is OUT.
            const offset = placement === 'inside' ? 20 : -30; 

            els.push(renderDimensionLine(eTop.p1, eTop.p2, offset, color));
            els.push(renderDimensionLine(eRight.p1, eRight.p2, offset, color));
        }

        // Altitude (Triangle)
        if (shape.type === 'triangle' && shape.showAltitude) {
            els.push(renderAltitude(poly.vertices[0], poly.vertices[1], poly.vertices[2], color));
        }

        if (isSelected) {
             els.push(
                React.createElement('path', {
                    key: `sel-${shape.id}`, 
                    d,
                    fill: "none", 
                    stroke: "#3b82f6", 
                    strokeWidth: 1.5, 
                    strokeDasharray: "4,4",
                    opacity: 0.7,
                    pointerEvents: "none"
                })
             );
             
             if (shape.type === 'rectangle') {
                 poly.edges.forEach((edge, i) => {
                     let handleId = '';
                     if (i === 0) handleId = 'h-top';
                     if (i === 1) handleId = 'h-right';
                     if (i === 2) handleId = 'h-bottom';
                     if (i === 3) handleId = 'h-left';
                     if (handleId) els.push(renderResizeHandle(edge.midpoint.x, edge.midpoint.y, handleId, onHandleDrag));
                 });
             } else if (shape.type === 'triangle' || shape.type === 'right-triangle') {
                 els.push(renderResizeHandle(poly.vertices[0].x, poly.vertices[0].y, 'v-peak', onHandleDrag));
                 els.push(renderResizeHandle(poly.vertices[1].x, poly.vertices[1].y, 'v-right', onHandleDrag));
             }
        }

        shape.edgeDecorations.forEach(dec => {
            const edge = poly.edges[dec.edgeIndex];
            if (edge) els.push(React.createElement('g', { key: `edec-${shape.id}-${dec.edgeIndex}` }, renderEdgeDecoration(edge, dec.type, color)));
        });

        shape.vertexDecorations.forEach(dec => {
            const vert = poly.nodes[dec.vertexIndex];
            if (vert) els.push(React.createElement('g', { key: `vdec-${shape.id}-${dec.vertexIndex}` }, renderVertexDecoration(vert, poly.edges, dec.type, color)));
        });

        shape.labels.forEach(lbl => {
            let x = 0, y = 0;
            if (lbl.type === 'center') {
                x = shape.x; y = shape.y;
            } else if (lbl.type === 'edge' && lbl.index !== undefined) {
                const edge = poly.edges[lbl.index];
                if (edge) {
                    const dist = 20;
                    x = edge.midpoint.x + edge.normal.x * dist;
                    y = edge.midpoint.y + edge.normal.y * dist;
                }
            } else if (lbl.type === 'vertex' && lbl.index !== undefined) {
                const vert = poly.vertices[lbl.index];
                if (vert) {
                    const vec = normalize({ x: vert.x - shape.x, y: vert.y - shape.y });
                    x = vert.x + vec.x * 20;
                    y = vert.y + vec.y * 20;
                }
            }
            const finalX = x + lbl.offsetX;
            const finalY = y + lbl.offsetY;
            els.push(
                React.createElement('g', {
                    key: `lbl-${lbl.id}`, 
                    onMouseDown: onLabelDrag ? (e: React.MouseEvent) => onLabelDrag(lbl.id, e) : undefined,
                    style: { cursor: 'grab' }
                }, ...tex.renderToSVG(lbl.text, finalX, finalY, lbl.fontSize, lbl.color, 'middle', true))
            );
        });
    }

    if (shape.type === 'circle') {
        els.push(
            React.createElement('circle', {
                key: `circ-${shape.id}`,
                cx: shape.x, cy: shape.y, r: shape.radius,
                fill: shape.fill, stroke: shape.stroke, strokeWidth: strokeWidth,
                fillOpacity: shape.opacity,
                onMouseDown,
                style: { cursor: 'move' }
            })
        );

        if (isSelected) {
             els.push(
                React.createElement('circle', {
                    key: `sel-${shape.id}`, 
                    cx: shape.x, cy: shape.y, r: shape.radius + 4,
                    fill: "none", stroke: "#3b82f6", strokeWidth: 1.5, strokeDasharray: "4,4", opacity: 0.7, pointerEvents: "none"
                })
             );
             const rPt = rotatePoint(shape.x + shape.radius, shape.y, shape.x, shape.y, shape.rotation);
             els.push(renderResizeHandle(rPt.x, rPt.y, 'h-radius', onHandleDrag));
        }

        if (shape.showCenter) {
            els.push(React.createElement('circle', { key: "center", cx: shape.x, cy: shape.y, r: 3, fill: shape.stroke }));
        }
        if (shape.showRadiusLine) {
            const p2 = rotatePoint(shape.x + shape.radius, shape.y, shape.x, shape.y, shape.rotation);
            els.push(React.createElement('line', { key: "rad", x1: shape.x, y1: shape.y, x2: p2.x, y2: p2.y, stroke: shape.stroke, strokeWidth: strokeWidth }));
        }
        if (shape.showDiameterLine) {
             const p1 = rotatePoint(shape.x - shape.radius, shape.y, shape.x, shape.y, shape.rotation);
             const p2 = rotatePoint(shape.x + shape.radius, shape.y, shape.x, shape.y, shape.rotation);
             els.push(React.createElement('line', { key: "dia", x1: p1.x, y1: p1.y, x2: p2.x, y2: p2.y, stroke: shape.stroke, strokeWidth: strokeWidth }));
        }

        shape.labels.forEach(lbl => {
            let x = shape.x, y = shape.y;
            if (lbl.type === 'radius') x = shape.x + shape.radius/2;
            const pos = rotatePoint(x, y, shape.x, shape.y, shape.rotation);
            els.push(
                React.createElement('g', {
                    key: `lbl-${lbl.id}`, 
                    onMouseDown: onLabelDrag ? (e: React.MouseEvent) => onLabelDrag(lbl.id, e) : undefined,
                    style: { cursor: 'grab' }
                }, ...tex.renderToSVG(lbl.text, pos.x + lbl.offsetX, pos.y + lbl.offsetY, lbl.fontSize, lbl.color, 'middle', true))
            );
        });
    }

    return els;
};
