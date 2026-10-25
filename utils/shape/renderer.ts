import React from 'react';
import {
    ShapeDef,
    ShapeLabel,
    RenderedEdge,
    RenderedVertex,
    DecorationType,
    AngleType,
    SubElementSelection,
    StraightEdgeDescriptor
} from './types';
import {
    rotatePoint,
    getMidpoint,
    getVector,
    normalize,
    getOutwardNormal,
    getPolygonCentroid,
    getRectVertices,
    getRegularPolygonVertices,
    getLShapeVertices,
    getHouseGeometry,
    polarToCartesian,
    getPositiveAngleSpan,
    describeArcOrSector,
    describeCircleSegment
} from './math';
import { TexEngine } from '../textRenderer';

const tex = new TexEngine();

export const normalizeLabelForTex = (raw: string): string => {
    if (!raw) return '';
    // 1. Convert degree LaTeX notations to Unicode degree symbol °
    let s = raw
        .replace(/\^\{\\circ\}/g, '°')
        .replace(/\^\\circ/g, '°')
        .replace(/\^\{\\degree\}/g, '°')
        .replace(/\^\\degree/g, '°')
        .replace(/\\circ/g, '°')
        .replace(/\\degree/g, '°');

    // 2. If string contains $...$ blocks, extract \text{...}, \mathrm{...}, and ° out of math mode into text mode
    if (s.includes('$')) {
        const parts = s.split('$');
        const out: string[] = [];
        parts.forEach((part, idx) => {
            if (idx % 2 === 0) {
                out.push(part.replace(/\\(?:text|mathrm)\{([^}]*)\}/g, '$1'));
            } else {
                const tokens = part.split(/(\\(?:text|mathrm)\{[^}]*\}|°)/g);
                tokens.forEach(tok => {
                    if (!tok) return;
                    const textMatch = tok.match(/^\\(?:text|mathrm)\{([^}]*)\}$/);
                    if (textMatch) {
                        out.push(textMatch[1]);
                    } else if (tok === '°') {
                        out.push('°');
                    } else {
                        out.push(`$${tok}$`);
                    }
                });
            }
        });
        return out.join('');
    }

    // 3. No $ in string: strip \text{...} if present
    s = s.replace(/\\(?:text|mathrm)\{([^}]*)\}/g, '$1');

    // Single variable letter (e.g. "a", "b", "h", "r", "x") -> math italic
    if (/^[a-zA-Z]$/.test(s.trim())) {
        return `$${s.trim()}$`;
    }

    // Contains LaTeX commands (\theta, \pi, \frac, \sqrt) or math operators (=, ^, _)
    if (/\\[a-zA-Z]+|[=^_]/.test(s)) {
        const unitMatch = s.match(/^(.*?)(\s*(?:cm|mm|km|m|in|ft|°)+)$/);
        if (unitMatch && unitMatch[1].trim()) {
            return `$${unitMatch[1].trim()}$${unitMatch[2]}`;
        }
        if (s.endsWith('°')) {
            return `$${s.slice(0, -1)}$°`;
        }
        return `$${s}$`;
    }

    return s;
};

const renderShapeText = (
    text: string,
    x: number,
    y: number,
    fontSize: number,
    color: string,
    align: 'start' | 'middle' | 'end' = 'middle',
    hasBackground: boolean = true
): React.ReactNode[] => {
    const normalized = normalizeLabelForTex(text);
    return tex.renderToSVG(normalized, x, y, fontSize, color, align, hasBackground, 'text');
};

export interface ShapeInteractionCallbacks {
    onShapeMouseDown?: (e: React.MouseEvent) => void;
    onLabelDrag?: (labelId: string, e: React.MouseEvent) => void;
    onHandleDrag?: (handleId: string, e: React.MouseEvent) => void;
    onEdgeClick?: (edgeIndex: number, e: React.MouseEvent) => void;
    onVertexClick?: (vertexIndex: number, e: React.MouseEvent) => void;
    onSectorClick?: (sectorIndex: number, e: React.MouseEvent) => void;
    onFaceClick?: (faceId: string, e: React.MouseEvent) => void;
    onSegmentClick?: (e: React.MouseEvent) => void;
    onShapeContextMenu?: (e: React.MouseEvent) => void;
    onLabelContextMenu?: (labelId: string, e: React.MouseEvent) => void;
    onDimensionContextMenu?: (e: React.MouseEvent) => void;
    onEdgeDecorationContextMenu?: (edgeIndex: number, e: React.MouseEvent) => void;
    onVertexDecorationContextMenu?: (vertexIndex: number, e: React.MouseEvent) => void;
}

/**
 * Wraps any interactive UI overlay (handles, selection outlines, sub-selection highlights)
 * in a group with `stroke="transparent"` so `/utils/imageExport.ts` automatically strips it
 * during PNG and Clipboard exports.
 */
const wrapUIOverlay = (key: string, child: React.ReactNode): React.ReactNode =>
    React.createElement(
        'g',
        {
            key: `ui-wrap-${key}`,
            className: 'shape-ui-overlay',
            stroke: 'transparent'
        },
        child
    );

const renderResizeHandle = (
    x: number,
    y: number,
    id: string,
    onDrag?: (id: string, e: React.MouseEvent) => void,
    color: string = '#2563eb',
    shape: 'circle' | 'diamond' | 'square' = 'circle',
    title?: string
): React.ReactNode => {
    let handleNode: React.ReactNode;
    if (shape === 'diamond') {
        const s = 5.5;
        handleNode = React.createElement(
            'polygon',
            {
                points: `${x},${y - s} ${x + s},${y} ${x},${y + s} ${x - s},${y}`,
                fill: '#ffffff',
                stroke: color,
                strokeWidth: 1.75,
                onMouseDown: onDrag ? (e: React.MouseEvent) => onDrag(id, e) : undefined,
                style: { cursor: 'pointer' }
            },
            title ? React.createElement('title', {}, title) : null
        );
    } else if (shape === 'square') {
        const s = 4.5;
        handleNode = React.createElement(
            'rect',
            {
                x: x - s,
                y: y - s,
                width: s * 2,
                height: s * 2,
                fill: '#ffffff',
                stroke: color,
                strokeWidth: 1.75,
                onMouseDown: onDrag ? (e: React.MouseEvent) => onDrag(id, e) : undefined,
                style: { cursor: 'pointer' }
            },
            title ? React.createElement('title', {}, title) : null
        );
    } else {
        handleNode = React.createElement(
            'circle',
            {
                cx: x,
                cy: y,
                r: 5,
                fill: '#ffffff',
                stroke: color,
                strokeWidth: 1.75,
                onMouseDown: onDrag ? (e: React.MouseEvent) => onDrag(id, e) : undefined,
                style: { cursor: 'pointer' }
            },
            title ? React.createElement('title', {}, title) : null
        );
    }
    return wrapUIOverlay(`handle-${id}`, handleNode);
};

// --- POLYGON / VERTEX GEOMETRY COMPUTATION ---

export const computePolyGeometry = (
    shape: ShapeDef
): {
    vertices: { x: number; y: number }[];
    edges: RenderedEdge[];
    nodes: RenderedVertex[];
    centroid: { x: number; y: number };
} | null => {
    let rawVerts: { x: number; y: number }[] = [];

    if (shape.type === 'rectangle') {
        rawVerts = getRectVertices(shape.width, shape.height);
    } else if (shape.type === 'triangle') {
        rawVerts = shape.vertices.map(v => ({ x: v.x, y: v.y }));
    } else if (shape.type === 'polygon') {
        if (shape.customVertices && shape.customVertices.length === shape.sides) {
            rawVerts = shape.customVertices.map((v, i) => {
                const off =
                    shape.irregularOffsets && shape.irregularOffsets[i]
                        ? shape.irregularOffsets[i]
                        : { dx: 0, dy: 0 };
                return { x: v.x + off.dx, y: v.y + off.dy };
            });
        } else {
            rawVerts = getRegularPolygonVertices(
                shape.sides,
                shape.radius,
                shape.irregularOffsets
            );
        }
    } else if (shape.type === 'l-shape') {
        rawVerts = getLShapeVertices(
            shape.outerWidth,
            shape.outerHeight,
            shape.cutWidth,
            shape.cutHeight
        );
    } else if (shape.type === 'house') {
        const g = getHouseGeometry(
            shape.baseWidth,
            shape.baseHeight,
            shape.roofHeight,
            shape.roofOverhang
        );
        if (shape.roofOverhang > 0) {
            rawVerts = [
                g.apex,
                g.eaveRight,
                g.ceilRight,
                g.bottomRight,
                g.bottomLeft,
                g.ceilLeft,
                g.eaveLeft
            ];
        } else {
            rawVerts = [g.apex, g.ceilRight, g.bottomRight, g.bottomLeft, g.ceilLeft];
        }
    } else {
        return null;
    }

    const vertices = rawVerts.map(v =>
        rotatePoint(v.x + shape.x, v.y + shape.y, shape.x, shape.y, shape.rotation)
    );
    const centroid = getPolygonCentroid(vertices);

    const edges: RenderedEdge[] = [];
    const nodes: RenderedVertex[] = [];

    for (let i = 0; i < vertices.length; i++) {
        const p1 = vertices[i];
        const p2 = vertices[(i + 1) % vertices.length];
        const vec = getVector(p1, p2);
        const len = Math.sqrt(vec.x * vec.x + vec.y * vec.y);
        const norm = getOutwardNormal(p1, p2, centroid);

        edges.push({
            index: i,
            p1,
            p2,
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

    return { vertices, edges, nodes, centroid };
};

// --- DECORATION RENDERERS ---

const renderEdgeDecoration = (
    edge: RenderedEdge,
    type: DecorationType,
    color: string
): React.ReactNode => {
    if (type === 'none') return null;
    const { midpoint, angle } = edge;
    const size = 7;
    const gap = 3.2;
    const deg = (angle * 180) / Math.PI;
    const transform = `translate(${midpoint.x}, ${midpoint.y}) rotate(${deg})`;
    const strokeWidth = 1.6;

    if (type === 'tick') {
        return React.createElement('line', {
            transform,
            x1: 0,
            y1: -size,
            x2: 0,
            y2: size,
            stroke: color,
            strokeWidth: 1.8
        });
    }
    if (type === 'double-tick') {
        return React.createElement(
            'g',
            { transform },
            React.createElement('line', {
                x1: -gap,
                y1: -size,
                x2: -gap,
                y2: size,
                stroke: color,
                strokeWidth
            }),
            React.createElement('line', {
                x1: gap,
                y1: -size,
                x2: gap,
                y2: size,
                stroke: color,
                strokeWidth
            })
        );
    }
    if (type === 'triple-tick') {
        return React.createElement(
            'g',
            { transform },
            React.createElement('line', {
                x1: -gap * 2,
                y1: -size,
                x2: -gap * 2,
                y2: size,
                stroke: color,
                strokeWidth
            }),
            React.createElement('line', {
                x1: 0,
                y1: -size,
                x2: 0,
                y2: size,
                stroke: color,
                strokeWidth
            }),
            React.createElement('line', {
                x1: gap * 2,
                y1: -size,
                x2: gap * 2,
                y2: size,
                stroke: color,
                strokeWidth
            })
        );
    }
    if (type === 'arrow') {
        return React.createElement('path', {
            transform,
            d: 'M -5 -5.5 L 4.5 0 L -5 5.5',
            fill: 'none',
            stroke: color,
            strokeWidth
        });
    }
    if (type === 'double-arrow') {
        return React.createElement(
            'g',
            { transform },
            React.createElement('path', {
                d: 'M -8 -5.5 L 0.5 0 L -8 5.5',
                fill: 'none',
                stroke: color,
                strokeWidth
            }),
            React.createElement('path', {
                d: 'M -1.5 -5.5 L 7 0 L -1.5 5.5',
                fill: 'none',
                stroke: color,
                strokeWidth
            })
        );
    }
    if (type === 'arrow-reverse') {
        return React.createElement('path', {
            transform,
            d: 'M 5 -5.5 L -4.5 0 L 5 5.5',
            fill: 'none',
            stroke: color,
            strokeWidth
        });
    }
    return null;
};

const renderVertexDecoration = (
    vertex: RenderedVertex,
    edges: RenderedEdge[],
    type: AngleType,
    color: string,
    customLabel?: string,
    fontSize: number = 14
): React.ReactNode => {
    if (type === 'none') return null;

    const eIn = edges[vertex.edgeInIndex];
    const eOut = edges[vertex.edgeOutIndex];
    if (!eIn || !eOut) return null;

    // Vectors pointing AWAY from vertex along the two incident edges
    const v1 = normalize(getVector(vertex.p, eIn.p1));
    const v2 = normalize(getVector(vertex.p, eOut.p2));

    const dot = v1.x * v2.x + v1.y * v2.y;
    const angleRad = Math.acos(Math.max(-1, Math.min(1, dot)));
    const angleDeg = Math.round(angleRad * (180 / Math.PI));

    const baseR = 20;
    const rMult = 1.5 - angleDeg / 240;
    const size = baseR * Math.max(0.55, rMult);
    const strokeWidth = 1.5;

    if (type === 'right') {
        const rSize = 12;
        const p1 = { x: vertex.p.x + v1.x * rSize, y: vertex.p.y + v1.y * rSize };
        const p2 = { x: vertex.p.x + v2.x * rSize, y: vertex.p.y + v2.y * rSize };
        const p3 = { x: p1.x + v2.x * rSize, y: p1.y + v2.y * rSize };
        return React.createElement('path', {
            d: `M ${p1.x} ${p1.y} L ${p3.x} ${p3.y} L ${p2.x} ${p2.y}`,
            fill: 'none',
            stroke: color,
            strokeWidth
        });
    }

    const generateArc = (r: number) => {
        const start = { x: vertex.p.x + v1.x * r, y: vertex.p.y + v1.y * r };
        const end = { x: vertex.p.x + v2.x * r, y: vertex.p.y + v2.y * r };
        const cp = v1.x * v2.y - v1.y * v2.x;
        const sweep = cp >= 0 ? 1 : 0;
        return `M ${start.x} ${start.y} A ${r} ${r} 0 0 ${sweep} ${end.x} ${end.y}`;
    };

    const bisector = normalize({ x: v1.x + v2.x, y: v1.y + v2.y });
    const labelPos = {
        x: vertex.p.x + bisector.x * (size + 15),
        y: vertex.p.y + bisector.y * (size + 15)
    };
    const labelText = customLabel || `${angleDeg}°`;

    if (type === 'arc') {
        return React.createElement(
            'g',
            {},
            React.createElement('path', {
                d: generateArc(size),
                fill: 'none',
                stroke: color,
                strokeWidth
            }),
            customLabel
                ? React.createElement(
                      'g',
                      {},
                      ...renderShapeText(labelText, labelPos.x, labelPos.y, fontSize, color, 'middle', true)
                  )
                : null
        );
    }

    if (type === 'double-arc') {
        return React.createElement(
            'g',
            {},
            React.createElement('path', {
                d: generateArc(size),
                fill: 'none',
                stroke: color,
                strokeWidth
            }),
            React.createElement('path', {
                d: generateArc(size + 4),
                fill: 'none',
                stroke: color,
                strokeWidth
            })
        );
    }

    if (type === 'triple-arc') {
        return React.createElement(
            'g',
            {},
            React.createElement('path', {
                d: generateArc(size - 3),
                fill: 'none',
                stroke: color,
                strokeWidth
            }),
            React.createElement('path', {
                d: generateArc(size + 1),
                fill: 'none',
                stroke: color,
                strokeWidth
            }),
            React.createElement('path', {
                d: generateArc(size + 5),
                fill: 'none',
                stroke: color,
                strokeWidth
            })
        );
    }

    if (type === 'label') {
        return React.createElement(
            'g',
            {},
            React.createElement('path', {
                d: generateArc(size),
                fill: 'none',
                stroke: color,
                strokeWidth
            }),
            ...renderShapeText(labelText, labelPos.x, labelPos.y, fontSize, color, 'middle', true)
        );
    }

    return null;
};

export const renderDimensionLine = (
    start: { x: number; y: number },
    end: { x: number; y: number },
    normal: { x: number; y: number },
    offsetDist: number,
    color: string,
    keyPrefix: string = 'dim',
    labelText?: string,
    fontSize: number = 14
): React.ReactNode => {
    const vec = getVector(start, end);
    const len = Math.sqrt(vec.x * vec.x + vec.y * vec.y);
    if (len < 1) return null;
    const unit = { x: vec.x / len, y: vec.y / len };

    const offX = normal.x * offsetDist;
    const offY = normal.y * offsetDist;

    const p1 = { x: start.x + offX, y: start.y + offY };
    const p2 = { x: end.x + offX, y: end.y + offY };

    const arrowSz = 5.5;
    const angle = Math.atan2(unit.y, unit.x);
    const a1 = angle - Math.PI / 6;
    const a2 = angle + Math.PI / 6;

    const angleRev = angle + Math.PI;
    const ar1 = angleRev - Math.PI / 6;
    const ar2 = angleRev + Math.PI / 6;

    const head1 = `M ${p2.x} ${p2.y} L ${p2.x - Math.cos(a1) * arrowSz} ${p2.y - Math.sin(a1) * arrowSz} L ${p2.x - Math.cos(a2) * arrowSz} ${p2.y - Math.sin(a2) * arrowSz} Z`;
    const head2 = `M ${p1.x} ${p1.y} L ${p1.x - Math.cos(ar1) * arrowSz} ${p1.y - Math.sin(ar1) * arrowSz} L ${p1.x - Math.cos(ar2) * arrowSz} ${p1.y - Math.sin(ar2) * arrowSz} Z`;

    const strokeWidth = 1.25;
    const mid = getMidpoint(p1, p2);
    const lblPos = {
        x: mid.x + normal.x * 14,
        y: mid.y + normal.y * 14
    };

    const sign = offsetDist >= 0 ? 1 : -1;

    return React.createElement(
        'g',
        { key: keyPrefix },
        React.createElement('line', {
            x1: p1.x,
            y1: p1.y,
            x2: p2.x,
            y2: p2.y,
            stroke: color,
            strokeWidth
        }),
        React.createElement('path', { d: head1, fill: color }),
        React.createElement('path', { d: head2, fill: color }),
        Math.abs(offsetDist) > 8 &&
            React.createElement('line', {
                x1: start.x + normal.x * 4 * sign,
                y1: start.y + normal.y * 4 * sign,
                x2: p1.x + normal.x * 4 * sign,
                y2: p1.y + normal.y * 4 * sign,
                stroke: color,
                strokeWidth: 0.9,
                strokeDasharray: '2,2'
            }),
        Math.abs(offsetDist) > 8 &&
            React.createElement('line', {
                x1: end.x + normal.x * 4 * sign,
                y1: end.y + normal.y * 4 * sign,
                x2: p2.x + normal.x * 4 * sign,
                y2: p2.y + normal.y * 4 * sign,
                stroke: color,
                strokeWidth: 0.9,
                strokeDasharray: '2,2'
            }),
        labelText
            ? React.createElement(
                  'g',
                  {},
                  ...renderShapeText(labelText, lblPos.x, lblPos.y, fontSize, color, 'middle', true)
              )
            : null
    );
};

const renderRightAngleMarker3D = (
    corner: { x: number; y: number },
    dir1: { x: number; y: number },
    dir2: { x: number; y: number },
    size: number,
    color: string
) => {
    const u1 = normalize(dir1);
    const u2 = normalize(dir2);
    const p1 = { x: corner.x + u1.x * size, y: corner.y + u1.y * size };
    const p2 = { x: corner.x + u2.x * size, y: corner.y + u2.y * size };
    const p3 = { x: p1.x + u2.x * size, y: p1.y + u2.y * size };
    return React.createElement('path', {
        d: `M ${p1.x} ${p1.y} L ${p3.x} ${p3.y} L ${p2.x} ${p2.y}`,
        fill: 'none',
        stroke: color,
        strokeWidth: 1.35
    });
};

const renderAltitude = (
    peak: { x: number; y: number },
    baseP1: { x: number; y: number },
    baseP2: { x: number; y: number },
    color: string,
    showRightAngle: boolean = true
): { node: React.ReactNode; mid: { x: number; y: number }; foot: { x: number; y: number } } | null => {
    const baseVec = getVector(baseP1, baseP2);
    const lenSq = baseVec.x * baseVec.x + baseVec.y * baseVec.y;
    if (lenSq === 0) return null;

    const peakVec = getVector(baseP1, peak);
    const t = (peakVec.x * baseVec.x + peakVec.y * baseVec.y) / lenSq;

    const foot = {
        x: baseP1.x + t * baseVec.x,
        y: baseP1.y + t * baseVec.y
    };

    const strokeWidth = 1.5;

    // Extension line if foot falls outside base segment [0, 1]
    let extensionLine: React.ReactNode = null;
    if (t < 0) {
        extensionLine = React.createElement('line', {
            x1: foot.x,
            y1: foot.y,
            x2: baseP1.x,
            y2: baseP1.y,
            stroke: color,
            strokeWidth: 1.1,
            strokeDasharray: '3,3'
        });
    } else if (t > 1) {
        extensionLine = React.createElement('line', {
            x1: baseP2.x,
            y1: baseP2.y,
            x2: foot.x,
            y2: foot.y,
            stroke: color,
            strokeWidth: 1.1,
            strokeDasharray: '3,3'
        });
    }

    const line = React.createElement('line', {
        x1: peak.x,
        y1: peak.y,
        x2: foot.x,
        y2: foot.y,
        stroke: color,
        strokeWidth,
        strokeDasharray: '5,4'
    });

    const vUp = normalize(getVector(foot, peak));
    const vBase = normalize(getVector(foot, t > 0.5 ? baseP1 : baseP2));
    const angleMark = showRightAngle
        ? renderRightAngleMarker3D(foot, vUp, vBase, 10, color)
        : null;

    return {
        node: React.createElement('g', { key: 'altitude-group' }, extensionLine, line, angleMark),
        mid: getMidpoint(peak, foot),
        foot
    };
};

// --- UNIFIED STRAIGHT EDGE DESCRIPTOR REGISTRY (2D, COMPOSITE & 3D SHAPES) ---

export const getShapeStraightEdges = (shape: ShapeDef): StraightEdgeDescriptor[] => {
    const poly = computePolyGeometry(shape);
    if (poly) {
        const edgeNames: Record<string, string[]> = {
            triangle: ['Right Side (Edge 1)', 'Bottom Base (Edge 2)', 'Left Side (Edge 3)'],
            rectangle: ['Top Side', 'Right Side', 'Bottom Side', 'Left Side'],
            'l-shape': [
                'Top Horizontal Leg',
                'Inner Vertical Drop',
                'Inner Horizontal Step',
                'Right Vertical End',
                'Bottom Full Base',
                'Left Full Wall'
            ],
            house:
                shape.type === 'house' && shape.roofOverhang > 0
                    ? [
                          'Right Roof Slope',
                          'Right Eave Overhang',
                          'Right Wall',
                          'Bottom Base',
                          'Left Wall',
                          'Left Eave Overhang',
                          'Left Roof Slope'
                      ]
                    : ['Right Roof Slope', 'Right Wall', 'Bottom Base', 'Left Wall', 'Left Roof Slope']
        };

        const descriptors: StraightEdgeDescriptor[] = poly.edges.map((e, idx) => ({
            key: `edge-${idx}`,
            name: edgeNames[shape.type]?.[idx] || `Side ${idx + 1}`,
            p1: e.p1,
            p2: e.p2,
            normal: e.normal,
            edgeIndex: idx
        }));

        if (shape.type === 'triangle' && shape.showAltitude) {
            const vIdx = shape.altitudeVertexIndex ?? 0;
            const alt = renderAltitude(
                poly.vertices[vIdx],
                poly.vertices[(vIdx + 1) % 3],
                poly.vertices[(vIdx + 2) % 3],
                '#000'
            );
            if (alt) {
                const vec = getVector(poly.vertices[vIdx], alt.foot);
                const len = Math.sqrt(vec.x * vec.x + vec.y * vec.y) || 1;
                descriptors.push({
                    key: 'altitude',
                    name: 'Altitude (h)',
                    p1: poly.vertices[vIdx],
                    p2: alt.foot,
                    normal: { x: -vec.y / len, y: vec.x / len },
                    customKey: 'altitude'
                });
            }
        }

        if (shape.type === 'polygon' && shape.showApothem && poly.edges.length > 0) {
            const e = poly.edges[Math.floor(poly.edges.length / 2)];
            if (e) {
                const vec = getVector({ x: shape.x, y: shape.y }, e.midpoint);
                const len = Math.sqrt(vec.x * vec.x + vec.y * vec.y) || 1;
                descriptors.push({
                    key: 'apothem',
                    name: 'Apothem (a)',
                    p1: { x: shape.x, y: shape.y },
                    p2: e.midpoint,
                    normal: { x: -vec.y / len, y: vec.x / len },
                    customKey: 'apothem'
                });
            }
        }

        if (shape.type === 'polygon' && shape.showAltitude && poly.vertices.length >= 3) {
            const vIdx = (shape.altitudeVertexIndex ?? 0) % poly.vertices.length;
            const baseEdgeIdx = (shape.altitudeBaseEdgeIndex ?? 2) % poly.edges.length;
            const baseEdge = poly.edges[baseEdgeIdx];
            if (baseEdge) {
                const alt = renderAltitude(
                    poly.vertices[vIdx],
                    baseEdge.p1,
                    baseEdge.p2,
                    '#000'
                );
                if (alt) {
                    const vec = getVector(poly.vertices[vIdx], alt.foot);
                    const len = Math.sqrt(vec.x * vec.x + vec.y * vec.y) || 1;
                    descriptors.push({
                        key: 'altitude',
                        name: 'Perpendicular Height (h)',
                        p1: poly.vertices[vIdx],
                        p2: alt.foot,
                        normal: { x: -vec.y / len, y: vec.x / len },
                        customKey: 'altitude'
                    });
                }
            }
        }

        if (shape.type === 'polygon' && shape.showDiagonals && poly.vertices.length === 4) {
            const [v0, v1, v2, v3] = poly.vertices;
            const vec1 = getVector(v0, v2);
            const len1 = Math.sqrt(vec1.x * vec1.x + vec1.y * vec1.y) || 1;
            const vec2 = getVector(v3, v1);
            const len2 = Math.sqrt(vec2.x * vec2.x + vec2.y * vec2.y) || 1;
            descriptors.push(
                {
                    key: 'diagonal-1',
                    name: 'Vertical Diagonal (d₁ / y)',
                    p1: v0,
                    p2: v2,
                    normal: { x: -vec1.y / len1, y: vec1.x / len1 },
                    customKey: 'diagonal-1'
                },
                {
                    key: 'diagonal-2',
                    name: 'Horizontal Diagonal (d₂ / x)',
                    p1: v3,
                    p2: v1,
                    normal: { x: -vec2.y / len2, y: vec2.x / len2 },
                    customKey: 'diagonal-2'
                }
            );
        }

        if (shape.type === 'house') {
            const g = getHouseGeometry(
                shape.baseWidth,
                shape.baseHeight,
                shape.roofHeight,
                shape.roofOverhang
            );
            const rot = (pt: { x: number; y: number }) =>
                rotatePoint(pt.x + shape.x, pt.y + shape.y, shape.x, shape.y, shape.rotation);
            const nDown = rotatePoint(0, 1, 0, 0, shape.rotation);
            const nLeft = rotatePoint(-1, 0, 0, 0, shape.rotation);
            const nRight = rotatePoint(1, 0, 0, 0, shape.rotation);

            descriptors.push(
                {
                    key: 'base-width',
                    name: 'Base Width',
                    p1: rot(g.bottomLeft),
                    p2: rot(g.bottomRight),
                    normal: nDown,
                    customKey: 'base-width'
                },
                {
                    key: 'base-height',
                    name: 'Wall Height',
                    p1: rot(g.ceilLeft),
                    p2: rot(g.bottomLeft),
                    normal: nLeft,
                    customKey: 'base-height'
                },
                {
                    key: 'total-height',
                    name: 'Total Height',
                    p1: rot({
                        x: Math.max(shape.baseWidth / 2, shape.baseWidth / 2 + shape.roofOverhang),
                        y: g.apex.y
                    }),
                    p2: rot({
                        x: Math.max(shape.baseWidth / 2, shape.baseWidth / 2 + shape.roofOverhang),
                        y: g.bottomRight.y
                    }),
                    normal: nRight,
                    customKey: 'total-height'
                }
            );
        }

        return descriptors;
    }

    if (shape.type === 'circle') {
        const { x: cx, y: cy, radius: r } = shape;
        const list: StraightEdgeDescriptor[] = [];
        const radAngle = shape.radiusAngle + shape.rotation;
        const pRad = polarToCartesian(cx, cy, r, radAngle);
        const nRad = polarToCartesian(0, 0, 1, radAngle - 90);
        list.push({
            key: 'radius',
            name: 'Radius Line (r)',
            p1: { x: cx, y: cy },
            p2: pRad,
            normal: nRad,
            customKey: 'radius'
        });

        if (shape.showDiameterLine || shape.isSector) {
            const dAng = (shape.showDiameterLine ? shape.diameterAngle : shape.sectorEndAngle) + shape.rotation;
            const p1 = polarToCartesian(cx, cy, r, dAng + 180);
            const p2 = polarToCartesian(cx, cy, r, dAng);
            const nDia = polarToCartesian(0, 0, 1, dAng + 90);
            list.push({
                key: 'diameter',
                name: 'Diameter Line (d)',
                p1,
                p2,
                normal: nDia,
                customKey: 'diameter'
            });
        }

        if (shape.showChord) {
            const c1 = polarToCartesian(cx, cy, r, shape.chordStartAngle + shape.rotation);
            const c2 = polarToCartesian(cx, cy, r, shape.chordEndAngle + shape.rotation);
            const nChord = getOutwardNormal(c1, c2, { x: cx, y: cy });
            list.push({
                key: 'chord',
                name: 'Chord Segment',
                p1: c1,
                p2: c2,
                normal: nChord,
                customKey: 'chord'
            });
        }
        return list;
    }

    if (shape.type === 'norman-window') {
        const w = shape.width;
        const r = w / 2;
        const rh = shape.rectHeight;
        const totalH = rh + r;
        const topY = -totalH / 2;
        const springY = topY + r;
        const botY = totalH / 2;
        const rot = (lx: number, ly: number) =>
            rotatePoint(shape.x + lx, shape.y + ly, shape.x, shape.y, shape.rotation);
        const nBot = rotatePoint(0, 1, 0, 0, shape.rotation);
        const nLeft = rotatePoint(-1, 0, 0, 0, shape.rotation);
        const nRight = rotatePoint(1, 0, 0, 0, shape.rotation);

        return [
            {
                key: 'width',
                name: 'Base Width (w)',
                p1: rot(-r, botY),
                p2: rot(r, botY),
                normal: nBot,
                customKey: 'width'
            },
            {
                key: 'rect-height',
                name: 'Left Wall Height (h)',
                p1: rot(-r, springY),
                p2: rot(-r, botY),
                normal: nLeft,
                customKey: 'rect-height'
            },
            {
                key: 'right-height',
                name: 'Right Wall Height',
                p1: rot(r, springY),
                p2: rot(r, botY),
                normal: nRight,
                customKey: 'right-height'
            },
            {
                key: 'total-height',
                name: 'Total Window Height',
                p1: rot(r, topY),
                p2: rot(r, botY),
                normal: nRight,
                customKey: 'total-height'
            }
        ];
    }

    if (shape.type === 'inscribed-circle') {
        const hs = shape.size / 2;
        const rot = (lx: number, ly: number) =>
            rotatePoint(shape.x + lx, shape.y + ly, shape.x, shape.y, shape.rotation);
        const nTop = rotatePoint(0, -1, 0, 0, shape.rotation);
        const nRight = rotatePoint(1, 0, 0, 0, shape.rotation);
        const nBot = rotatePoint(0, 1, 0, 0, shape.rotation);
        const nLeft = rotatePoint(-1, 0, 0, 0, shape.rotation);

        return [
            {
                key: 'top-side',
                name: 'Top Square Side (s)',
                p1: rot(-hs, -hs),
                p2: rot(hs, -hs),
                normal: nTop,
                customKey: 'top-side'
            },
            {
                key: 'right-side',
                name: 'Right Square Side',
                p1: rot(hs, -hs),
                p2: rot(hs, hs),
                normal: nRight,
                customKey: 'right-side'
            },
            {
                key: 'bottom-side',
                name: 'Bottom Square Side',
                p1: rot(-hs, hs),
                p2: rot(hs, hs),
                normal: nBot,
                customKey: 'bottom-side'
            },
            {
                key: 'left-side',
                name: 'Left Square Side',
                p1: rot(-hs, -hs),
                p2: rot(-hs, hs),
                normal: nLeft,
                customKey: 'left-side'
            }
        ];
    }

    if (shape.type === 'stadium') {
        const w = shape.rectWidth;
        const r = shape.rectHeight / 2;
        const rot = (lx: number, ly: number) =>
            rotatePoint(shape.x + lx, shape.y + ly, shape.x, shape.y, shape.rotation);
        const nTop = rotatePoint(0, -1, 0, 0, shape.rotation);
        const nBot = rotatePoint(0, 1, 0, 0, shape.rotation);
        const nLeft = rotatePoint(-1, 0, 0, 0, shape.rotation);

        return [
            {
                key: 'rect-width',
                name: 'Straight Top Length',
                p1: rot(-w / 2, -r),
                p2: rot(w / 2, -r),
                normal: nTop,
                customKey: 'rect-width'
            },
            {
                key: 'rect-height',
                name: 'Track Height (2r)',
                p1: rot(-w / 2, -r),
                p2: rot(-w / 2, r),
                normal: nLeft,
                customKey: 'rect-height'
            },
            {
                key: 'bottom-width',
                name: 'Straight Bottom Length',
                p1: rot(-w / 2, r),
                p2: rot(w / 2, r),
                normal: nBot,
                customKey: 'bottom-width'
            },
            {
                key: 'radius',
                name: 'Semicircle Radius (r)',
                p1: rot(w / 2, 0),
                p2: rot(w / 2 + r, 0),
                normal: nTop,
                customKey: 'radius'
            }
        ];
    }

    if (shape.type === 'annulus') {
        const { x: cx, y: cy, outerRadius: R, innerRadius: r } = shape;
        const oAng = shape.outerRadiusAngle + shape.rotation;
        const iAng = shape.innerRadiusAngle + shape.rotation;
        return [
            {
                key: 'outer-radius',
                name: 'Outer Radius (R)',
                p1: { x: cx, y: cy },
                p2: polarToCartesian(cx, cy, R, oAng),
                normal: polarToCartesian(0, 0, 1, oAng - 90),
                customKey: 'outer-radius'
            },
            {
                key: 'inner-radius',
                name: 'Inner Radius (r)',
                p1: { x: cx, y: cy },
                p2: polarToCartesian(cx, cy, r, iAng),
                normal: polarToCartesian(0, 0, 1, iAng + 90),
                customKey: 'inner-radius'
            }
        ];
    }

    const rot3D = (pt: { x: number; y: number }) =>
        rotatePoint(pt.x, pt.y, shape.x, shape.y, shape.rotation);

    if (shape.type === 'prism') {
        const hw = shape.width / 2;
        const hh = shape.height / 2;
        const dx = shape.depthX;
        const dy = shape.depthY;
        const cx = shape.x - dx / 2;
        const cy = shape.y - dy / 2;

        const F0 = rot3D({ x: cx - hw, y: cy - hh });
        const F1 = rot3D({ x: cx + hw, y: cy - hh });
        const F2 = rot3D({ x: cx + hw, y: cy + hh });
        const F3 = rot3D({ x: cx - hw, y: cy + hh });
        const B1 = rot3D({ x: cx + hw + dx, y: cy - hh + dy });
        const B2 = rot3D({ x: cx + hw + dx, y: cy + hh + dy });
        const center = { x: shape.x, y: shape.y };

        return [
            {
                key: 'width',
                name: 'Front Width (l)',
                p1: F3,
                p2: F2,
                normal: getOutwardNormal(F3, F2, center),
                customKey: 'width'
            },
            {
                key: 'height',
                name: 'Front Height (h)',
                p1: F0,
                p2: F3,
                normal: getOutwardNormal(F0, F3, center),
                customKey: 'height'
            },
            {
                key: 'depth',
                name: 'Receding Depth (w)',
                p1: F2,
                p2: B2,
                normal: getOutwardNormal(F2, B2, center),
                customKey: 'depth'
            },
            {
                key: 'right-height',
                name: 'Back Right Vertical Edge',
                p1: B1,
                p2: B2,
                normal: getOutwardNormal(B1, B2, center),
                customKey: 'right-height'
            },
            {
                key: 'diagonal',
                name: '3D Space Diagonal (d)',
                p1: F3,
                p2: B1,
                normal: getOutwardNormal(F3, B1, F2),
                customKey: 'diagonal'
            }
        ];
    }

    if (shape.type === 'cylinder') {
        const { x: cx, y: cy, radius: r, height: h } = shape;
        const topY = cy - h / 2;
        const botY = cy + h / 2;
        const nRight = rotatePoint(1, 0, 0, 0, shape.rotation);
        const nLeft = rotatePoint(-1, 0, 0, 0, shape.rotation);
        const nTop = rotatePoint(0, -1, 0, 0, shape.rotation);

        return [
            {
                key: 'height',
                name: 'Right Vertical Height (h)',
                p1: rot3D({ x: cx + r, y: topY }),
                p2: rot3D({ x: cx + r, y: botY }),
                normal: nRight,
                customKey: 'height'
            },
            {
                key: 'left-height',
                name: 'Left Vertical Height',
                p1: rot3D({ x: cx - r, y: topY }),
                p2: rot3D({ x: cx - r, y: botY }),
                normal: nLeft,
                customKey: 'left-height'
            },
            {
                key: 'radius',
                name: 'Top Radius (r)',
                p1: rot3D({ x: cx, y: topY }),
                p2: rot3D({ x: cx + r, y: topY }),
                normal: nTop,
                customKey: 'radius'
            }
        ];
    }

    if (shape.type === 'cone') {
        const { x: cx, y: cy, radius: r, height: h, apexOffsetX } = shape;
        const apex = rot3D({ x: cx + apexOffsetX, y: cy - h / 2 });
        const botY = cy + h / 2;
        const baseCenter = rot3D({ x: cx, y: botY });
        const baseRight = rot3D({ x: cx + r, y: botY });
        const baseLeft = rot3D({ x: cx - r, y: botY });
        const nDown = rotatePoint(0, 1, 0, 0, shape.rotation);
        const nLeft = rotatePoint(-1, 0, 0, 0, shape.rotation);

        return [
            {
                key: 'slant-height',
                name: 'Right Slant Edge (l)',
                p1: apex,
                p2: baseRight,
                normal: getOutwardNormal(apex, baseRight, baseCenter),
                customKey: 'slant-height'
            },
            {
                key: 'left-slant',
                name: 'Left Slant Edge',
                p1: apex,
                p2: baseLeft,
                normal: getOutwardNormal(apex, baseLeft, baseCenter),
                customKey: 'left-slant'
            },
            {
                key: 'height',
                name: 'Perpendicular Height (h)',
                p1: apex,
                p2: baseCenter,
                normal: nLeft,
                customKey: 'height'
            },
            {
                key: 'radius',
                name: 'Base Radius (r)',
                p1: baseCenter,
                p2: baseRight,
                normal: nDown,
                customKey: 'radius'
            }
        ];
    }

    if (shape.type === 'sphere') {
        const { x: cx, y: cy, radius: r } = shape;
        const pRad = rot3D(polarToCartesian(cx, cy, r, shape.radiusAngle));
        const nRad = polarToCartesian(0, 0, 1, shape.radiusAngle + shape.rotation - 90);
        return [
            {
                key: 'radius',
                name: 'Sphere Radius (r)',
                p1: { x: cx, y: cy },
                p2: pRad,
                normal: nRad,
                customKey: 'radius'
            }
        ];
    }

    if (shape.type === 'pyramid') {
        const {
            x: cx,
            y: cy,
            baseWidth: bw,
            baseDepthX: dx,
            baseDepthY: dy,
            height: h,
            apexOffsetX
        } = shape;
        const baseCenterRaw = { x: cx, y: cy + h * 0.35 };
        const apex = rot3D({ x: cx + apexOffsetX, y: cy - h * 0.65 });
        const baseCenter = rot3D(baseCenterRaw);
        const hw = bw / 2;

        if (shape.baseType === 'square') {
            const hdx = dx / 2;
            const hdy = dy / 2;
            const B0 = rot3D({ x: baseCenterRaw.x - hw - hdx, y: baseCenterRaw.y - hdy });
            const B1 = rot3D({ x: baseCenterRaw.x + hw - hdx, y: baseCenterRaw.y - hdy });
            const B2 = rot3D({ x: baseCenterRaw.x + hw + hdx, y: baseCenterRaw.y + hdy });
            const rightMid = getMidpoint(B1, B2);

            return [
                {
                    key: 'base-width',
                    name: 'Front Base Edge (b)',
                    p1: B0,
                    p2: B1,
                    normal: getOutwardNormal(B0, B1, baseCenter),
                    customKey: 'base-width'
                },
                {
                    key: 'base-depth',
                    name: 'Right Base Edge (w)',
                    p1: B1,
                    p2: B2,
                    normal: getOutwardNormal(B1, B2, baseCenter),
                    customKey: 'base-depth'
                },
                {
                    key: 'slant-height',
                    name: 'Slant Height (l)',
                    p1: apex,
                    p2: rightMid,
                    normal: getOutwardNormal(apex, rightMid, baseCenter),
                    customKey: 'slant-height'
                },
                {
                    key: 'right-slant-edge',
                    name: 'Right Lateral Edge',
                    p1: apex,
                    p2: B2,
                    normal: getOutwardNormal(apex, B2, baseCenter),
                    customKey: 'right-slant-edge'
                },
                {
                    key: 'left-slant-edge',
                    name: 'Left Lateral Edge',
                    p1: apex,
                    p2: B0,
                    normal: getOutwardNormal(apex, B0, baseCenter),
                    customKey: 'left-slant-edge'
                },
                {
                    key: 'height',
                    name: 'Perpendicular Height (h)',
                    p1: apex,
                    p2: baseCenter,
                    normal: rotatePoint(-1, 0, 0, 0, shape.rotation),
                    customKey: 'height'
                }
            ];
        } else {
            const T0 = rot3D({ x: baseCenterRaw.x - hw, y: baseCenterRaw.y + 12 });
            const T1 = rot3D({ x: baseCenterRaw.x + hw, y: baseCenterRaw.y + 12 });
            const T2 = rot3D({ x: baseCenterRaw.x + dx * 0.6, y: baseCenterRaw.y + dy * 0.9 });
            const rightMid = getMidpoint(T1, T2);

            return [
                {
                    key: 'base-width',
                    name: 'Front Base Edge (b)',
                    p1: T0,
                    p2: T1,
                    normal: getOutwardNormal(T0, T1, baseCenter),
                    customKey: 'base-width'
                },
                {
                    key: 'base-depth',
                    name: 'Right Base Edge',
                    p1: T1,
                    p2: T2,
                    normal: getOutwardNormal(T1, T2, baseCenter),
                    customKey: 'base-depth'
                },
                {
                    key: 'slant-height',
                    name: 'Slant Height (l)',
                    p1: apex,
                    p2: rightMid,
                    normal: getOutwardNormal(apex, rightMid, baseCenter),
                    customKey: 'slant-height'
                },
                {
                    key: 'right-slant-edge',
                    name: 'Right Lateral Edge',
                    p1: apex,
                    p2: T2,
                    normal: getOutwardNormal(apex, T2, baseCenter),
                    customKey: 'right-slant-edge'
                },
                {
                    key: 'height',
                    name: 'Perpendicular Height (h)',
                    p1: apex,
                    p2: baseCenter,
                    normal: rotatePoint(-1, 0, 0, 0, shape.rotation),
                    customKey: 'height'
                }
            ];
        }
    }

    return [];
};

export const resolveStraightEdgeForLabel = (
    shape: ShapeDef,
    lbl: ShapeLabel
): StraightEdgeDescriptor | null => {
    const edges = getShapeStraightEdges(shape);
    if (lbl.type === 'edge' && lbl.index !== undefined) {
        let edgeIdx = lbl.index;
        if (shape.type === 'house' && shape.roofOverhang === 0 && edgeIdx >= 2) {
            edgeIdx = Math.max(0, edgeIdx - 1);
        }
        return edges.find(e => e.edgeIndex === edgeIdx) || null;
    }
    if (lbl.type === 'radius') {
        return edges.find(e => e.customKey === 'radius') || null;
    }
    if (lbl.customKey) {
        return edges.find(e => e.customKey === lbl.customKey || e.key === lbl.customKey) || null;
    }
    return null;
};

// --- MAIN SHAPE RENDERER ---

export const renderShape = (
    shape: ShapeDef,
    isSelected: boolean,
    callbacks: ShapeInteractionCallbacks = {},
    subSelection?: SubElementSelection | null,
    showHandles: boolean = true
): React.ReactNode[] => {
    const els: React.ReactNode[] = [];
    const color = shape.stroke || '#000000';
    const strokeWidth = shape.strokeWidth || 1.75;
    const shadeColor = shape.shadeColor || '#cbd5e1';
    const shouldRenderHandles = isSelected && showHandles;

    // Helper to render any per-label external dimension line + label text
    const renderLabelWithOptionalDimension = (
        lbl: ShapeLabel,
        defaultPos: { x: number; y: number },
        suppressDimLine: boolean = false
    ) => {
        let pos = defaultPos;
        const straightEdge = resolveStraightEdgeForLabel(shape, lbl);

        if (lbl.showDimensionLine && straightEdge) {
            const dimOffset = lbl.dimensionOffset ?? 24;
            if (!suppressDimLine) {
                els.push(
                    renderDimensionLine(
                        straightEdge.p1,
                        straightEdge.p2,
                        straightEdge.normal,
                        dimOffset,
                        color,
                        `lbl-dim-${shape.id}-${lbl.id}`
                    )
                );
            }
            const mid = getMidpoint(straightEdge.p1, straightEdge.p2);
            const sign = dimOffset >= 0 ? 1 : -1;
            pos = {
                x: mid.x + straightEdge.normal.x * (dimOffset + 16 * sign),
                y: mid.y + straightEdge.normal.y * (dimOffset + 16 * sign)
            };
        }

        const finalX = pos.x + lbl.offsetX;
        const finalY = pos.y + lbl.offsetY;
        els.push(
            React.createElement(
                'g',
                {
                    key: `lbl-${lbl.id}`,
                    onMouseDown: callbacks.onLabelDrag
                        ? (e: React.MouseEvent) => callbacks.onLabelDrag!(lbl.id, e)
                        : undefined,
                    onContextMenu: callbacks.onLabelContextMenu
                        ? (e: React.MouseEvent) => callbacks.onLabelContextMenu!(lbl.id, e)
                        : undefined,
                    style: { cursor: 'grab' }
                },
                ...renderShapeText(lbl.text, finalX, finalY, lbl.fontSize, lbl.color, 'middle', true)
            )
        );
    };

    // -------------------------------------------------------------------------
    // A. POLYGON-BASED 2D & COMPOSITE SHAPES (Triangle, Rectangle, Polygon, L-Shape, House)
    // -------------------------------------------------------------------------
    const poly = computePolyGeometry(shape);
    if (poly) {
        // 1. Polygon Sector Shading (for Regular/Irregular Polygons)
        if (shape.type === 'polygon') {
            for (let i = 0; i < poly.vertices.length; i++) {
                const v1 = poly.vertices[i];
                const v2 = poly.vertices[(i + 1) % poly.vertices.length];
                const isShaded = shape.shadedSectors?.includes(i);
                const sectorPath = `M ${shape.x} ${shape.y} L ${v1.x} ${v1.y} L ${v2.x} ${v2.y} Z`;
                els.push(
                    React.createElement('path', {
                        key: `sector-${shape.id}-${i}`,
                        d: sectorPath,
                        fill: isShaded ? shadeColor : 'rgba(255,255,255,0.001)',
                        fillOpacity: isShaded ? 0.75 : 0.01,
                        stroke: isShaded ? '#94a3b8' : 'none',
                        strokeWidth: isShaded ? 0.75 : 0,
                        strokeDasharray: isShaded ? '3,3' : undefined,
                        onClick: callbacks.onSectorClick
                            ? (e: React.MouseEvent) => {
                                  e.stopPropagation();
                                  callbacks.onSectorClick!(i, e);
                              }
                            : undefined,
                        onMouseDown: callbacks.onShapeMouseDown,
                        style: { cursor: 'pointer' }
                    })
                );
            }
        }

        // 2. Main Polygon Fill & Stroke
        const d =
            poly.vertices.map((v, i) => `${i === 0 ? 'M' : 'L'} ${v.x} ${v.y}`).join(' ') + ' Z';
        els.push(
            React.createElement('path', {
                key: `shape-${shape.id}`,
                d,
                fill:
                    shape.fill === 'transparent'
                        ? shape.type === 'polygon' && (shape.shadedSectors?.length || 0) > 0
                            ? 'none'
                            : 'rgba(255,255,255,0.01)'
                        : shape.fill,
                stroke: color,
                strokeWidth,
                fillOpacity: shape.opacity,
                onMouseDown: callbacks.onShapeMouseDown,
                onContextMenu: callbacks.onShapeContextMenu,
                style: { cursor: 'move' },
                vectorEffect: 'non-scaling-stroke'
            })
        );

        // 3. Shape-specific internal scaffolding & lines
        // Rectangle Diagonals & Center Dot
        if (shape.type === 'rectangle') {
            const [v0, v1, v2, v3] = poly.vertices;
            const dash = shape.diagonalStyle === 'dashed' ? '5,4' : undefined;
            if (shape.showDiagonals === 'one' || shape.showDiagonals === 'both') {
                els.push(
                    React.createElement('line', {
                        key: `diag1-${shape.id}`,
                        x1: v0.x,
                        y1: v0.y,
                        x2: v2.x,
                        y2: v2.y,
                        stroke: color,
                        strokeWidth: 1.25,
                        strokeDasharray: dash,
                        pointerEvents: 'none'
                    })
                );
            }
            if (shape.showDiagonals === 'both') {
                els.push(
                    React.createElement('line', {
                        key: `diag2-${shape.id}`,
                        x1: v1.x,
                        y1: v1.y,
                        x2: v3.x,
                        y2: v3.y,
                        stroke: color,
                        strokeWidth: 1.25,
                        strokeDasharray: dash,
                        pointerEvents: 'none'
                    })
                );
            }
            if (shape.showCenterDot) {
                els.push(
                    React.createElement('circle', {
                        key: `center-${shape.id}`,
                        cx: shape.x,
                        cy: shape.y,
                        r: 3.5,
                        fill: color
                    })
                );
            }
        }

        // Triangle Altitude
        if (shape.type === 'triangle' && shape.showAltitude) {
            const vIdx = shape.altitudeVertexIndex ?? 0;
            const peak = poly.vertices[vIdx];
            const b1 = poly.vertices[(vIdx + 1) % 3];
            const b2 = poly.vertices[(vIdx + 2) % 3];
            const alt = renderAltitude(
                peak,
                b1,
                b2,
                color,
                shape.showAltitudeRightAngle !== false
            );
            if (alt) els.push(alt.node);
        }

        // Polygon Center Dot, Radius, Apothem, and Exterior Angle Extensions
        if (shape.type === 'polygon') {
            if (shape.showCenterDot) {
                els.push(
                    React.createElement('circle', {
                        key: `poly-center-${shape.id}`,
                        cx: shape.x,
                        cy: shape.y,
                        r: 3.5,
                        fill: color
                    })
                );
            }
            if (shape.showRadiusLine && poly.vertices.length > 0) {
                const v0 = poly.vertices[0];
                els.push(
                    React.createElement('line', {
                        key: `poly-rad-${shape.id}`,
                        x1: shape.x,
                        y1: shape.y,
                        x2: v0.x,
                        y2: v0.y,
                        stroke: color,
                        strokeWidth: 1.35,
                        strokeDasharray: '4,4'
                    })
                );
            }
            if (shape.showApothem && poly.edges.length > 0) {
                const edgeIdx = Math.floor(poly.edges.length / 2);
                const e = poly.edges[edgeIdx];
                const vUp = normalize(getVector(e.midpoint, { x: shape.x, y: shape.y }));
                const vEdge = normalize(getVector(e.midpoint, e.p2));
                els.push(
                    React.createElement(
                        'g',
                        { key: `poly-apothem-${shape.id}` },
                        React.createElement('line', {
                            x1: shape.x,
                            y1: shape.y,
                            x2: e.midpoint.x,
                            y2: e.midpoint.y,
                            stroke: color,
                            strokeWidth: 1.35,
                            strokeDasharray: '4,4'
                        }),
                        renderRightAngleMarker3D(e.midpoint, vUp, vEdge, 9, color)
                    )
                );
            }
            if (shape.showAltitude && poly.vertices.length >= 3) {
                const vIdx = (shape.altitudeVertexIndex ?? 0) % poly.vertices.length;
                const baseEdgeIdx = (shape.altitudeBaseEdgeIndex ?? 2) % poly.edges.length;
                const baseEdge = poly.edges[baseEdgeIdx];
                if (baseEdge) {
                    const alt = renderAltitude(
                        poly.vertices[vIdx],
                        baseEdge.p1,
                        baseEdge.p2,
                        color,
                        true
                    );
                    if (alt) els.push(alt.node);
                }
            }
            if (shape.showDiagonals && poly.vertices.length >= 4) {
                const [v0, v1, v2, v3] = poly.vertices;
                els.push(
                    React.createElement('line', {
                        key: `poly-diag1-${shape.id}`,
                        x1: v0.x,
                        y1: v0.y,
                        x2: v2.x,
                        y2: v2.y,
                        stroke: color,
                        strokeWidth: 1.35,
                        strokeDasharray: '5,4',
                        pointerEvents: 'none'
                    }),
                    React.createElement('line', {
                        key: `poly-diag2-${shape.id}`,
                        x1: v1.x,
                        y1: v1.y,
                        x2: v3.x,
                        y2: v3.y,
                        stroke: color,
                        strokeWidth: 1.35,
                        strokeDasharray: '5,4',
                        pointerEvents: 'none'
                    })
                );
                if (shape.showDiagonalRightAngle) {
                    const denom =
                        (v0.x - v2.x) * (v1.y - v3.y) - (v0.y - v2.y) * (v1.x - v3.x);
                    const intersect =
                        Math.abs(denom) > 1e-6
                            ? (() => {
                                  const t =
                                      ((v0.x - v1.x) * (v1.y - v3.y) -
                                          (v0.y - v1.y) * (v1.x - v3.x)) /
                                      denom;
                                  return {
                                      x: v0.x + t * (v2.x - v0.x),
                                      y: v0.y + t * (v2.y - v0.y)
                                  };
                              })()
                            : getMidpoint(v0, v2);
                    const u1 = normalize(getVector(intersect, v0));
                    const u2 = normalize(getVector(intersect, v1));
                    els.push(renderRightAngleMarker3D(intersect, u1, u2, 10, color));
                }
            }
            if ((shape.exteriorExtensionLength || 0) > 0) {
                const extLen = shape.exteriorExtensionLength || 45;
                poly.edges.forEach((edge, i) => {
                    if (
                        shape.exteriorAngles &&
                        shape.exteriorAngles.length > 0 &&
                        !shape.exteriorAngles.includes(i)
                    ) {
                        return;
                    }
                    const unit = normalize(getVector(edge.p1, edge.p2));
                    const extEnd = {
                        x: edge.p2.x + unit.x * extLen,
                        y: edge.p2.y + unit.y * extLen
                    };
                    const nextEdge = poly.edges[(i + 1) % poly.edges.length];
                    const nextUnit = normalize(getVector(nextEdge.p1, nextEdge.p2));
                    const r = 18;
                    const arcStart = { x: edge.p2.x + unit.x * r, y: edge.p2.y + unit.y * r };
                    const arcEnd = {
                        x: edge.p2.x + nextUnit.x * r,
                        y: edge.p2.y + nextUnit.y * r
                    };
                    const cp = unit.x * nextUnit.y - unit.y * nextUnit.x;
                    const sweep = cp >= 0 ? 1 : 0;

                    els.push(
                        React.createElement(
                            'g',
                            { key: `ext-${shape.id}-${i}` },
                            React.createElement('line', {
                                x1: edge.p2.x,
                                y1: edge.p2.y,
                                x2: extEnd.x,
                                y2: extEnd.y,
                                stroke: color,
                                strokeWidth: 1.3,
                                strokeDasharray: '4,3'
                            }),
                            React.createElement('path', {
                                d: `M ${arcStart.x} ${arcStart.y} A ${r} ${r} 0 0 ${sweep} ${arcEnd.x} ${arcEnd.y}`,
                                fill: 'none',
                                stroke: '#dc2626',
                                strokeWidth: 1.4
                            })
                        )
                    );
                });
            }
        }

        // L-Shape Scaffolding Lines
        if (shape.type === 'l-shape' && shape.scaffoldingMode !== 'none') {
            const hw = shape.outerWidth / 2;
            const hh = shape.outerHeight / 2;
            const innerX = hw - shape.cutWidth;
            const innerY = -hh + shape.cutHeight;

            if (shape.scaffoldingMode === 'vertical' || shape.scaffoldingMode === 'both') {
                const p1 = rotatePoint(
                    innerX + shape.x,
                    innerY + shape.y,
                    shape.x,
                    shape.y,
                    shape.rotation
                );
                const p2 = rotatePoint(
                    innerX + shape.x,
                    hh + shape.y,
                    shape.x,
                    shape.y,
                    shape.rotation
                );
                els.push(
                    React.createElement('line', {
                        key: `l-scaff-v-${shape.id}`,
                        x1: p1.x,
                        y1: p1.y,
                        x2: p2.x,
                        y2: p2.y,
                        stroke: '#dc2626',
                        strokeWidth: 1.5,
                        strokeDasharray: '5,4'
                    })
                );
            }
            if (shape.scaffoldingMode === 'horizontal' || shape.scaffoldingMode === 'both') {
                const p1 = rotatePoint(
                    -hw + shape.x,
                    innerY + shape.y,
                    shape.x,
                    shape.y,
                    shape.rotation
                );
                const p2 = rotatePoint(
                    innerX + shape.x,
                    innerY + shape.y,
                    shape.x,
                    shape.y,
                    shape.rotation
                );
                els.push(
                    React.createElement('line', {
                        key: `l-scaff-h-${shape.id}`,
                        x1: p1.x,
                        y1: p1.y,
                        x2: p2.x,
                        y2: p2.y,
                        stroke: '#0284c7',
                        strokeWidth: 1.5,
                        strokeDasharray: '5,4'
                    })
                );
            }
        }

        // House Shape Ceiling Line, Roof Altitude & Total Height Bracket
        if (shape.type === 'house') {
            const g = getHouseGeometry(
                shape.baseWidth,
                shape.baseHeight,
                shape.roofHeight,
                shape.roofOverhang
            );
            const rot = (pt: { x: number; y: number }) =>
                rotatePoint(pt.x + shape.x, pt.y + shape.y, shape.x, shape.y, shape.rotation);

            if (shape.showCeilingLine) {
                const cL = rot(g.ceilLeft);
                const cR = rot(g.ceilRight);
                els.push(
                    React.createElement('line', {
                        key: `house-ceil-${shape.id}`,
                        x1: cL.x,
                        y1: cL.y,
                        x2: cR.x,
                        y2: cR.y,
                        stroke: color,
                        strokeWidth: 1.35,
                        strokeDasharray: '5,4'
                    })
                );
            }
            if (shape.showRoofAltitude) {
                const ap = rot(g.apex);
                const cMid = rot({ x: 0, y: g.ceilLeft.y });
                const cR = rot(g.ceilRight);
                els.push(
                    React.createElement(
                        'g',
                        { key: `house-alt-${shape.id}` },
                        React.createElement('line', {
                            x1: ap.x,
                            y1: ap.y,
                            x2: cMid.x,
                            y2: cMid.y,
                            stroke: color,
                            strokeWidth: 1.35,
                            strokeDasharray: '4,4'
                        }),
                        renderRightAngleMarker3D(
                            cMid,
                            getVector(cMid, ap),
                            getVector(cMid, cR),
                            9,
                            color
                        )
                    )
                );
            }
            if (shape.showTotalHeightDimension) {
                const rightmostX =
                    Math.max(shape.baseWidth / 2, shape.baseWidth / 2 + shape.roofOverhang);
                const topPt = rot({ x: rightmostX, y: g.apex.y });
                const botPt = rot({ x: rightmostX, y: g.bottomRight.y });
                const nOut = rotatePoint(1, 0, 0, 0, shape.rotation);
                els.push(
                    renderDimensionLine(
                        topPt,
                        botPt,
                        nOut,
                        28,
                        color,
                        `house-total-h-${shape.id}`
                    )
                );
            }
        }

        // 4. Shape-wide External / Internal Dimension Lines
        if (shape.showDimensions) {
            const placement = shape.dimensionPlacement || 'outside';
            const offsetDist = placement === 'inside' ? -20 : 28;
            poly.edges.forEach((edge, idx) => {
                if (shape.hiddenDimensions?.includes(idx)) return;
                if (shape.type === 'rectangle' && idx >= 2) return;
                els.push(
                    renderDimensionLine(
                        edge.p1,
                        edge.p2,
                        edge.normal,
                        offsetDist,
                        color,
                        `dim-${shape.id}-${idx}`
                    )
                );
            });
        }

        // 5. Edge Decorations & Interactive Edge Hit Targets
        poly.edges.forEach((edge, idx) => {
            const dec = shape.edgeDecorations.find(d => d.edgeIndex === idx);
            const isSubSelected =
                subSelection?.shapeId === shape.id && subSelection.edges.includes(idx);

            if (isSubSelected && shouldRenderHandles) {
                els.push(
                    wrapUIOverlay(
                        `edge-subsel-${shape.id}-${idx}`,
                        React.createElement('line', {
                            x1: edge.p1.x,
                            y1: edge.p1.y,
                            x2: edge.p2.x,
                            y2: edge.p2.y,
                            stroke: '#ec4899',
                            strokeWidth: strokeWidth + 3.5,
                            strokeLinecap: 'round',
                            opacity: 0.45,
                            pointerEvents: 'none'
                        })
                    )
                );
            }

            if (dec && dec.type !== 'none') {
                els.push(
                    React.createElement(
                        'g',
                        {
                            key: `edec-${shape.id}-${idx}`,
                            onContextMenu: callbacks.onEdgeDecorationContextMenu
                                ? (e: React.MouseEvent) => callbacks.onEdgeDecorationContextMenu!(idx, e)
                                : undefined
                        },
                        renderEdgeDecoration(edge, dec.type, color)
                    )
                );
            }

            // Invisible thicker hit line for clicking edges to toggle ticks/arrows
            if (isSelected && callbacks.onEdgeClick) {
                els.push(
                    React.createElement('line', {
                        key: `edge-hit-${shape.id}-${idx}`,
                        x1: edge.p1.x,
                        y1: edge.p1.y,
                        x2: edge.p2.x,
                        y2: edge.p2.y,
                        stroke: 'transparent',
                        strokeWidth: 14,
                        onClick: (e: React.MouseEvent) => {
                            e.stopPropagation();
                            callbacks.onEdgeClick!(idx, e);
                        },
                        style: { cursor: 'pointer' }
                    })
                );
            }
        });

        // 6. Vertex Decorations & Interactive Vertex Hit Targets
        poly.nodes.forEach((vert, idx) => {
            const dec = shape.vertexDecorations.find(d => d.vertexIndex === idx);
            const isSubSelected =
                subSelection?.shapeId === shape.id && subSelection.vertices.includes(idx);

            if (isSubSelected && shouldRenderHandles) {
                els.push(
                    wrapUIOverlay(
                        `vert-subsel-${shape.id}-${idx}`,
                        React.createElement('circle', {
                            cx: vert.p.x,
                            cy: vert.p.y,
                            r: 10,
                            fill: 'rgba(236, 72, 153, 0.2)',
                            stroke: '#ec4899',
                            strokeWidth: 1.5,
                            pointerEvents: 'none'
                        })
                    )
                );
            }

            if (dec && dec.type !== 'none') {
                els.push(
                    React.createElement(
                        'g',
                        {
                            key: `vdec-${shape.id}-${idx}`,
                            onContextMenu: callbacks.onVertexDecorationContextMenu
                                ? (e: React.MouseEvent) =>
                                      callbacks.onVertexDecorationContextMenu!(idx, e)
                                : undefined
                        },
                        renderVertexDecoration(
                            vert,
                            poly.edges,
                            dec.type,
                            color,
                            dec.label
                        )
                    )
                );
            }

            if (isSelected && callbacks.onVertexClick) {
                els.push(
                    React.createElement('circle', {
                        key: `vert-hit-${shape.id}-${idx}`,
                        cx: vert.p.x,
                        cy: vert.p.y,
                        r: 11,
                        fill: 'transparent',
                        onClick: (e: React.MouseEvent) => {
                            e.stopPropagation();
                            callbacks.onVertexClick!(idx, e);
                        },
                        style: { cursor: 'pointer' }
                    })
                );
            }
        });

        // 7. Selection Outline & Drag Handles (Wrapped in stroke="transparent" for export & gated by shouldRenderHandles)
        if (shouldRenderHandles) {
            els.push(
                wrapUIOverlay(
                    `sel-${shape.id}`,
                    React.createElement('path', {
                        d,
                        fill: 'none',
                        stroke: '#3b82f6',
                        strokeWidth: 1.25,
                        strokeDasharray: '4,4',
                        opacity: 0.7,
                        pointerEvents: 'none'
                    })
                )
            );

            if (shape.type === 'rectangle') {
                poly.edges.forEach((edge, i) => {
                    const ids = ['h-top', 'h-right', 'h-bottom', 'h-left'];
                    // Shift handle along the edge to t=0.22 when the edge has a midpoint tick/arrow decoration
                    // so the handle never obscures the tick mark or parallel arrow!
                    const hasDec = shape.edgeDecorations.some(
                        dec => dec.edgeIndex === i && dec.type !== 'none'
                    );
                    const t = hasDec ? 0.22 : 0.5;
                    const hx = edge.p1.x + (edge.p2.x - edge.p1.x) * t;
                    const hy = edge.p1.y + (edge.p2.y - edge.p1.y) * t;

                    els.push(
                        renderResizeHandle(
                            hx,
                            hy,
                            ids[i],
                            callbacks.onHandleDrag,
                            '#2563eb',
                            'circle',
                            'Drag to resize (Shift: lock square, Alt: from center)'
                        )
                    );
                });
            } else if (shape.type === 'triangle') {
                poly.vertices.forEach((v, i) => {
                    els.push(
                        renderResizeHandle(
                            v.x,
                            v.y,
                            `v-${i}`,
                            callbacks.onHandleDrag,
                            '#2563eb',
                            'circle',
                            `Drag Vertex ${i + 1} (Shift: snap 15°/90°)`
                        )
                    );
                });
            } else if (shape.type === 'polygon') {
                poly.vertices.forEach((v, i) => {
                    els.push(
                        renderResizeHandle(
                            v.x,
                            v.y,
                            `poly-v-${i}`,
                            callbacks.onHandleDrag,
                            i === 0 ? '#2563eb' : '#0284c7',
                            i === 0 ? 'diamond' : 'circle',
                            i === 0
                                ? 'Drag to scale radius (Alt: freeform vertex)'
                                : 'Drag vertex to make irregular (Shift: snap)'
                        )
                    );
                });
            } else if (shape.type === 'l-shape') {
                const innerCorner = poly.vertices[2];
                const bottomRight = poly.vertices[4];
                els.push(
                    renderResizeHandle(
                        innerCorner.x,
                        innerCorner.y,
                        'l-inner',
                        callbacks.onHandleDrag,
                        '#dc2626',
                        'diamond',
                        'Drag inner concave corner to adjust legs'
                    )
                );
                els.push(
                    renderResizeHandle(
                        bottomRight.x,
                        bottomRight.y,
                        'l-outer',
                        callbacks.onHandleDrag,
                        '#2563eb',
                        'square',
                        'Drag outer corner to resize overall L-shape'
                    )
                );
            } else if (shape.type === 'house') {
                const g = getHouseGeometry(
                    shape.baseWidth,
                    shape.baseHeight,
                    shape.roofHeight,
                    shape.roofOverhang
                );
                const rot = (pt: { x: number; y: number }) =>
                    rotatePoint(pt.x + shape.x, pt.y + shape.y, shape.x, shape.y, shape.rotation);
                const apexPt = rot(g.apex);
                const eaveRPt = rot(g.eaveRight);
                const botRPt = rot(g.bottomRight);

                els.push(
                    renderResizeHandle(
                        apexPt.x,
                        apexPt.y,
                        'house-apex',
                        callbacks.onHandleDrag,
                        '#dc2626',
                        'diamond',
                        'Drag roof apex height'
                    )
                );
                els.push(
                    renderResizeHandle(
                        eaveRPt.x,
                        eaveRPt.y,
                        'house-eave',
                        callbacks.onHandleDrag,
                        '#d97706',
                        'circle',
                        'Drag roof overhang (eaves)'
                    )
                );
                els.push(
                    renderResizeHandle(
                        botRPt.x,
                        botRPt.y,
                        'house-base',
                        callbacks.onHandleDrag,
                        '#2563eb',
                        'square',
                        'Drag rectangle width & height'
                    )
                );
            }
        }

        // 8. Labels for Polygon Shapes (with Per-Label External Dimension Line Support)
        shape.labels.forEach(lbl => {
            if (lbl.hidden) return;
            if (lbl.type === 'edge' && lbl.index !== undefined && shape.hiddenDimensions?.includes(lbl.index)) {
                return;
            }
            if (lbl.customKey === 'altitude' && shape.type === 'triangle' && !shape.showAltitude) {
                return;
            }
            if (lbl.customKey === 'altitude' && shape.type === 'polygon' && !shape.showAltitude) {
                return;
            }
            if (lbl.customKey === 'apothem' && shape.type === 'polygon' && !shape.showApothem) {
                return;
            }
            if (
                (lbl.customKey === 'diagonal-1' || lbl.customKey === 'diagonal-2') &&
                shape.type === 'polygon' &&
                !shape.showDiagonals
            ) {
                return;
            }
            if (lbl.customKey === 'total-height' && shape.type === 'house' && !shape.showTotalHeightDimension && !lbl.showDimensionLine) {
                return;
            }

            let x = shape.x;
            let y = shape.y;
            let suppressDimLine = false;

            if (lbl.type === 'center') {
                x = shape.x;
                y = shape.y;
            } else if (lbl.type === 'edge' && lbl.index !== undefined) {
                let edgeIdx = lbl.index;
                if (shape.type === 'house' && shape.roofOverhang === 0 && edgeIdx >= 2) {
                    edgeIdx = Math.max(0, edgeIdx - 1);
                }
                const edge = poly.edges[edgeIdx];
                if (edge) {
                    const alreadyHasGlobalDim =
                        !!shape.showDimensions && !(shape.type === 'rectangle' && edgeIdx >= 2);
                    if (alreadyHasGlobalDim) suppressDimLine = true;
                    const dist = alreadyHasGlobalDim && shape.dimensionPlacement === 'outside' ? 42 : 22;
                    x = edge.midpoint.x + edge.normal.x * dist;
                    y = edge.midpoint.y + edge.normal.y * dist;
                }
            } else if (lbl.type === 'vertex' && lbl.index !== undefined) {
                const vert = poly.vertices[lbl.index];
                if (vert) {
                    const vec = normalize({ x: vert.x - poly.centroid.x, y: vert.y - poly.centroid.y });
                    x = vert.x + vec.x * 22;
                    y = vert.y + vec.y * 22;
                }
            } else if (lbl.type === 'custom') {
                if (lbl.customKey === 'altitude' && shape.type === 'triangle') {
                    const vIdx = shape.altitudeVertexIndex ?? 0;
                    const alt = renderAltitude(
                        poly.vertices[vIdx],
                        poly.vertices[(vIdx + 1) % 3],
                        poly.vertices[(vIdx + 2) % 3],
                        color
                    );
                    if (alt) {
                        x = alt.mid.x + 16;
                        y = alt.mid.y;
                    }
                } else if (lbl.customKey === 'altitude' && shape.type === 'polygon') {
                    const vIdx = (shape.altitudeVertexIndex ?? 0) % poly.vertices.length;
                    const baseEdgeIdx = (shape.altitudeBaseEdgeIndex ?? 2) % poly.edges.length;
                    const baseEdge = poly.edges[baseEdgeIdx];
                    if (baseEdge) {
                        const alt = renderAltitude(
                            poly.vertices[vIdx],
                            baseEdge.p1,
                            baseEdge.p2,
                            color
                        );
                        if (alt) {
                            x = alt.mid.x + 18;
                            y = alt.mid.y;
                        }
                    }
                } else if (
                    (lbl.customKey === 'diagonal-1' || lbl.customKey === 'diagonal-2') &&
                    shape.type === 'polygon' &&
                    poly.vertices.length >= 4
                ) {
                    const [v0, v1, v2, v3] = poly.vertices;
                    if (lbl.customKey === 'diagonal-1') {
                        const mid = getMidpoint(v0, v2);
                        x = mid.x + 22;
                        y = mid.y + 18;
                    } else {
                        const mid = getMidpoint(v1, v3);
                        x = mid.x - 24;
                        y = mid.y - 14;
                    }
                } else if (lbl.customKey === 'apothem' && shape.type === 'polygon') {
                    const e = poly.edges[Math.floor(poly.edges.length / 2)];
                    if (e) {
                        const mid = getMidpoint({ x: shape.x, y: shape.y }, e.midpoint);
                        x = mid.x + 16;
                        y = mid.y;
                    }
                } else if (shape.type === 'house') {
                    const g = getHouseGeometry(
                        shape.baseWidth,
                        shape.baseHeight,
                        shape.roofHeight,
                        shape.roofOverhang
                    );
                    if (lbl.customKey === 'base-width') {
                        const pt = rotatePoint(
                            shape.x,
                            g.bottomLeft.y + 22 + shape.y,
                            shape.x,
                            shape.y,
                            shape.rotation
                        );
                        x = pt.x;
                        y = pt.y;
                    } else if (lbl.customKey === 'base-height') {
                        const pt = rotatePoint(
                            -shape.baseWidth / 2 - 24 + shape.x,
                            (g.ceilLeft.y + g.bottomLeft.y) / 2 + shape.y,
                            shape.x,
                            shape.y,
                            shape.rotation
                        );
                        x = pt.x;
                        y = pt.y;
                    } else if (lbl.customKey === 'total-height') {
                        if (shape.showTotalHeightDimension) suppressDimLine = true;
                        const rightmostX =
                            Math.max(shape.baseWidth / 2, shape.baseWidth / 2 + shape.roofOverhang) + 46;
                        const pt = rotatePoint(rightmostX + shape.x, shape.y, shape.x, shape.y, shape.rotation);
                        x = pt.x;
                        y = pt.y;
                    }
                }
            }

            renderLabelWithOptionalDimension(lbl, { x, y }, suppressDimLine);
        });

        return els;
    }

    // -------------------------------------------------------------------------
    // B. CIRCLES, SECTORS, ARCS, CHORDS & SEGMENTS
    // -------------------------------------------------------------------------
    if (shape.type === 'circle') {
        const { x: cx, y: cy, radius: r } = shape;
        const startDeg = shape.sectorStartAngle + shape.rotation;
        const endDeg = shape.sectorEndAngle + shape.rotation;

        // 1. Shading (Minor Sector, Major Sector, or Segment)
        if (shape.shadeMode === 'minor-sector') {
            els.push(
                React.createElement('path', {
                    key: `circ-shade-minor-${shape.id}`,
                    d: describeArcOrSector(cx, cy, r, startDeg, endDeg, true),
                    fill: shadeColor,
                    fillOpacity: 0.75,
                    stroke: 'none',
                    pointerEvents: 'none'
                })
            );
        } else if (shape.shadeMode === 'major-sector') {
            els.push(
                React.createElement('path', {
                    key: `circ-shade-major-${shape.id}`,
                    d: describeArcOrSector(cx, cy, r, endDeg, startDeg, true),
                    fill: shadeColor,
                    fillOpacity: 0.75,
                    stroke: 'none',
                    pointerEvents: 'none'
                })
            );
        } else if (shape.shadeMode === 'segment') {
            const cStart = (shape.showChord ? shape.chordStartAngle : shape.sectorStartAngle) + shape.rotation;
            const cEnd = (shape.showChord ? shape.chordEndAngle : shape.sectorEndAngle) + shape.rotation;
            els.push(
                React.createElement('path', {
                    key: `circ-shade-seg-${shape.id}`,
                    d: describeCircleSegment(cx, cy, r, cStart, cEnd),
                    fill: shadeColor,
                    fillOpacity: 0.8,
                    stroke: 'none',
                    onClick: callbacks.onSegmentClick,
                    style: { cursor: 'pointer' }
                })
            );
        }

        // 2. Main Circle or Pac-Man Sector Outline
        if (shape.isSector) {
            els.push(
                React.createElement('path', {
                    key: `circ-sector-${shape.id}`,
                    d: describeArcOrSector(cx, cy, r, startDeg, endDeg, true),
                    fill: shape.fill === 'transparent' ? 'rgba(255,255,255,0.01)' : shape.fill,
                    fillOpacity: shape.opacity,
                    stroke: color,
                    strokeWidth,
                    onMouseDown: callbacks.onShapeMouseDown,
                    onContextMenu: callbacks.onShapeContextMenu,
                    style: { cursor: 'move' }
                })
            );
        } else {
            els.push(
                React.createElement('circle', {
                    key: `circ-full-${shape.id}`,
                    cx,
                    cy,
                    r,
                    fill: shape.fill === 'transparent' ? 'rgba(255,255,255,0.01)' : shape.fill,
                    fillOpacity: shape.opacity,
                    stroke: color,
                    strokeWidth,
                    onMouseDown: callbacks.onShapeMouseDown,
                    onContextMenu: callbacks.onShapeContextMenu,
                    style: { cursor: 'move' }
                })
            );

            if (shape.shadeMode === 'minor-sector' || shape.shadeMode === 'major-sector' || shape.showSectorAngleArc) {
                const pStart = polarToCartesian(cx, cy, r, startDeg);
                const pEnd = polarToCartesian(cx, cy, r, endDeg);
                els.push(
                    React.createElement('line', {
                        key: `sec-r1-${shape.id}`,
                        x1: cx,
                        y1: cy,
                        x2: pStart.x,
                        y2: pStart.y,
                        stroke: color,
                        strokeWidth: 1.4
                    }),
                    React.createElement('line', {
                        key: `sec-r2-${shape.id}`,
                        x1: cx,
                        y1: cy,
                        x2: pEnd.x,
                        y2: pEnd.y,
                        stroke: color,
                        strokeWidth: 1.4
                    })
                );
            }
        }

        // 3. Highlighted Arc
        if (shape.highlightArc) {
            els.push(
                React.createElement('path', {
                    key: `circ-hi-arc-${shape.id}`,
                    d: describeArcOrSector(cx, cy, r, startDeg, endDeg, false),
                    fill: 'none',
                    stroke: shape.arcHighlightColor || '#dc2626',
                    strokeWidth: strokeWidth + 2.5,
                    strokeLinecap: 'round',
                    pointerEvents: 'none'
                })
            );
        }

        // 4. Chord & Clickable Segment
        if (shape.showChord) {
            const cStart = shape.chordStartAngle + shape.rotation;
            const cEnd = shape.chordEndAngle + shape.rotation;
            const p1 = polarToCartesian(cx, cy, r, cStart);
            const p2 = polarToCartesian(cx, cy, r, cEnd);
            els.push(
                React.createElement('path', {
                    key: `chord-seg-hit-${shape.id}`,
                    d: describeCircleSegment(cx, cy, r, cStart, cEnd),
                    fill: 'rgba(255,255,255,0.001)',
                    stroke: 'none',
                    onClick: callbacks.onSegmentClick
                        ? (e: React.MouseEvent) => {
                              e.stopPropagation();
                              callbacks.onSegmentClick!(e);
                          }
                        : undefined,
                    style: { cursor: 'pointer' }
                }),
                React.createElement('line', {
                    key: `chord-line-${shape.id}`,
                    x1: p1.x,
                    y1: p1.y,
                    x2: p2.x,
                    y2: p2.y,
                    stroke: color,
                    strokeWidth: 1.65
                })
            );
        }

        // 5. Sector Angle Arc & Label at Center
        if (shape.showSectorAngleArc || shape.isSector) {
            const span = Math.round(getPositiveAngleSpan(startDeg, endDeg));
            const arcR = Math.min(26, r * 0.35);
            if (span === 90) {
                const u1 = polarToCartesian(0, 0, 1, startDeg);
                const u2 = polarToCartesian(0, 0, 1, endDeg);
                els.push(renderRightAngleMarker3D({ x: cx, y: cy }, u1, u2, 12, color));
            } else {
                els.push(
                    React.createElement('path', {
                        key: `sec-angle-arc-${shape.id}`,
                        d: describeArcOrSector(cx, cy, arcR, startDeg, endDeg, false),
                        fill: 'none',
                        stroke: color,
                        strokeWidth: 1.35
                    })
                );
            }
            if (shape.sectorAngleLabel) {
                const midDeg = startDeg + getPositiveAngleSpan(startDeg, endDeg) / 2;
                const lblPos = polarToCartesian(cx, cy, arcR + 18, midDeg);
                els.push(
                    React.createElement(
                        'g',
                        { key: `sec-angle-lbl-${shape.id}` },
                        ...renderShapeText(
                            shape.sectorAngleLabel,
                            lblPos.x,
                            lblPos.y,
                            14,
                            color,
                            'middle',
                            true
                        )
                    )
                );
            }
        }

        // 6. Radius, Diameter & Center Dot
        if (shape.showRadiusLine) {
            const pRad = polarToCartesian(cx, cy, r, shape.radiusAngle + shape.rotation);
            els.push(
                React.createElement('line', {
                    key: `rad-${shape.id}`,
                    x1: cx,
                    y1: cy,
                    x2: pRad.x,
                    y2: pRad.y,
                    stroke: color,
                    strokeWidth: 1.5
                })
            );
        }
        if (shape.showDiameterLine) {
            const p1 = polarToCartesian(cx, cy, r, shape.diameterAngle + shape.rotation);
            const p2 = polarToCartesian(cx, cy, r, shape.diameterAngle + 180 + shape.rotation);
            els.push(
                React.createElement('line', {
                    key: `dia-${shape.id}`,
                    x1: p1.x,
                    y1: p1.y,
                    x2: p2.x,
                    y2: p2.y,
                    stroke: color,
                    strokeWidth: 1.5,
                    strokeDasharray: '5,4'
                })
            );
        }
        if (shape.showCenter) {
            els.push(
                React.createElement('circle', {
                    key: `center-${shape.id}`,
                    cx,
                    cy,
                    r: 3.5,
                    fill: color
                })
            );
        }

        // 7. Selection & Handles
        if (shouldRenderHandles) {
            els.push(
                wrapUIOverlay(
                    `sel-${shape.id}`,
                    React.createElement('circle', {
                        cx,
                        cy,
                        r: r + 4,
                        fill: 'none',
                        stroke: '#3b82f6',
                        strokeWidth: 1.25,
                        strokeDasharray: '4,4',
                        opacity: 0.65,
                        pointerEvents: 'none'
                    })
                )
            );
            const rPt = polarToCartesian(cx, cy, r, shape.radiusAngle + shape.rotation);
            els.push(
                renderResizeHandle(
                    rPt.x,
                    rPt.y,
                    'h-radius',
                    callbacks.onHandleDrag,
                    '#2563eb',
                    'circle',
                    'Drag to change radius & angle (Shift: snap angle)'
                )
            );

            if (shape.showDiameterLine) {
                const dPt = polarToCartesian(cx, cy, r, shape.diameterAngle + shape.rotation);
                els.push(
                    renderResizeHandle(
                        dPt.x,
                        dPt.y,
                        'h-diameter',
                        callbacks.onHandleDrag,
                        '#d97706',
                        'circle',
                        'Drag to rotate diameter angle (Shift: snap 15°)'
                    )
                );
            }

            if (shape.isSector || shape.showSectorAngleArc || shape.highlightArc || shape.shadeMode === 'minor-sector' || shape.shadeMode === 'major-sector') {
                const sPt = polarToCartesian(cx, cy, r, startDeg);
                const ePt = polarToCartesian(cx, cy, r, endDeg);
                els.push(
                    renderResizeHandle(
                        sPt.x,
                        sPt.y,
                        'h-sector-start',
                        callbacks.onHandleDrag,
                        '#dc2626',
                        'diamond',
                        'Drag sector start angle (Shift: snap 15°)'
                    ),
                    renderResizeHandle(
                        ePt.x,
                        ePt.y,
                        'h-sector-end',
                        callbacks.onHandleDrag,
                        '#dc2626',
                        'diamond',
                        'Drag sector end angle (Shift: snap 15°)'
                    )
                );
            }

            if (shape.showChord) {
                const c1 = polarToCartesian(cx, cy, r, shape.chordStartAngle + shape.rotation);
                const c2 = polarToCartesian(cx, cy, r, shape.chordEndAngle + shape.rotation);
                els.push(
                    renderResizeHandle(
                        c1.x,
                        c1.y,
                        'h-chord-start',
                        callbacks.onHandleDrag,
                        '#059669',
                        'square',
                        'Drag chord endpoint 1'
                    ),
                    renderResizeHandle(
                        c2.x,
                        c2.y,
                        'h-chord-end',
                        callbacks.onHandleDrag,
                        '#059669',
                        'square',
                        'Drag chord endpoint 2'
                    )
                );
            }
        }

        // 8. Circle Labels
        shape.labels.forEach(lbl => {
            if (lbl.hidden) return;
            if (lbl.type === 'radius' && !shape.showRadiusLine && !shape.isSector) return;
            let pos = { x: cx, y: cy };
            if (lbl.type === 'radius' || lbl.customKey === 'radius') {
                const radAngle = shape.radiusAngle + shape.rotation;
                const mid = polarToCartesian(cx, cy, r * 0.52, radAngle);
                const perp = polarToCartesian(0, 0, 18, radAngle + 90);
                pos = { x: mid.x + perp.x, y: mid.y + perp.y };
            }
            renderLabelWithOptionalDimension(lbl, pos);
        });

        return els;
    }

    // -------------------------------------------------------------------------
    // C. STADIUM / TRACK (Rectangle + Semicircles)
    // -------------------------------------------------------------------------
    if (shape.type === 'stadium') {
        const w = shape.rectWidth;
        const h = shape.rectHeight;
        const r = h / 2;
        const buildStadiumPath = (rw: number, rad: number) => {
            const hw = rw / 2;
            return `M ${-hw} ${-rad} L ${hw} ${-rad} A ${rad} ${rad} 0 0 1 ${hw} ${rad} L ${-hw} ${rad} A ${rad} ${rad} 0 0 1 ${-hw} ${-rad} Z`;
        };

        const groupChildren: React.ReactNode[] = [];

        // Concentric Outer Lanes
        if (shape.concentricLanes > 0) {
            const outerR = r + shape.concentricLanes * shape.laneWidth;
            const outerPath = buildStadiumPath(w, outerR);
            const innerPath = buildStadiumPath(w, r);

            if (shape.shadeTrackRing) {
                groupChildren.push(
                    React.createElement('path', {
                        key: 'stadium-track-shade',
                        d: `${outerPath} ${innerPath}`,
                        fillRule: 'evenodd',
                        fill: shadeColor,
                        fillOpacity: 0.7,
                        stroke: 'none'
                    })
                );
            }

            for (let lane = 1; lane <= shape.concentricLanes; lane++) {
                const lr = r + lane * shape.laneWidth;
                groupChildren.push(
                    React.createElement('path', {
                        key: `stadium-lane-${lane}`,
                        d: buildStadiumPath(w, lr),
                        fill: 'none',
                        stroke: color,
                        strokeWidth: lane === shape.concentricLanes ? strokeWidth : 1.1,
                        strokeDasharray: lane === shape.concentricLanes ? undefined : '5,4'
                    })
                );
            }
        }

        // Main Stadium Body
        groupChildren.push(
            React.createElement('path', {
                key: 'stadium-main',
                d: buildStadiumPath(w, r),
                fill: shape.fill === 'transparent' ? 'rgba(255,255,255,0.01)' : shape.fill,
                fillOpacity: shape.opacity,
                stroke: color,
                strokeWidth,
                onMouseDown: callbacks.onShapeMouseDown,
                onContextMenu: callbacks.onShapeContextMenu,
                style: { cursor: 'move' }
            })
        );

        // Internal Dashed Dividers
        if (shape.showInternalDividers) {
            groupChildren.push(
                React.createElement('line', {
                    key: 'stad-div-l',
                    x1: -w / 2,
                    y1: -r,
                    x2: -w / 2,
                    y2: r,
                    stroke: color,
                    strokeWidth: 1.35,
                    strokeDasharray: '5,4'
                }),
                React.createElement('line', {
                    key: 'stad-div-r',
                    x1: w / 2,
                    y1: -r,
                    x2: w / 2,
                    y2: r,
                    stroke: color,
                    strokeWidth: 1.35,
                    strokeDasharray: '5,4'
                })
            );
        }

        // Semicircle Radius Line
        if (shape.showRadiusLine) {
            groupChildren.push(
                React.createElement('circle', {
                    key: 'stad-rcenter',
                    cx: w / 2,
                    cy: 0,
                    r: 3,
                    fill: color
                }),
                React.createElement('line', {
                    key: 'stad-rline',
                    x1: w / 2,
                    y1: 0,
                    x2: w / 2 + r,
                    y2: 0,
                    stroke: color,
                    strokeWidth: 1.4,
                    strokeDasharray: '4,3'
                })
            );
        }

        els.push(
            React.createElement(
                'g',
                {
                    key: `stadium-grp-${shape.id}`,
                    transform: `translate(${shape.x}, ${shape.y}) rotate(${shape.rotation})`
                },
                ...groupChildren
            )
        );

        if (shouldRenderHandles) {
            const rightHandle = rotatePoint(
                shape.x + w / 2 + r,
                shape.y,
                shape.x,
                shape.y,
                shape.rotation
            );
            const bottomHandle = rotatePoint(
                shape.x,
                shape.y + r,
                shape.x,
                shape.y,
                shape.rotation
            );
            els.push(
                renderResizeHandle(
                    rightHandle.x,
                    rightHandle.y,
                    'stad-width',
                    callbacks.onHandleDrag,
                    '#2563eb',
                    'circle',
                    'Drag straight section length'
                ),
                renderResizeHandle(
                    bottomHandle.x,
                    bottomHandle.y,
                    'stad-height',
                    callbacks.onHandleDrag,
                    '#dc2626',
                    'diamond',
                    'Drag height (linked to semicircle radius r = h/2)'
                )
            );
        }

        shape.labels.forEach(lbl => {
            if (lbl.hidden) return;
            if (lbl.customKey === 'radius' && !shape.showRadiusLine) return;
            let local = { x: 0, y: 0 };
            if (lbl.customKey === 'rect-width') local = { x: 0, y: -r - 20 };
            else if (lbl.customKey === 'rect-height') local = { x: -w / 2 - 22, y: 0 };
            else if (lbl.customKey === 'bottom-width') local = { x: 0, y: r + 20 };
            else if (lbl.customKey === 'radius') local = { x: w / 2 + r / 2, y: -14 };
            const world = rotatePoint(
                shape.x + local.x,
                shape.y + local.y,
                shape.x,
                shape.y,
                shape.rotation
            );
            renderLabelWithOptionalDimension(lbl, world);
        });

        return els;
    }

    // -------------------------------------------------------------------------
    // D. THE ANNULUS (Concentric Donut / Washer)
    // -------------------------------------------------------------------------
    if (shape.type === 'annulus') {
        const { x: cx, y: cy, outerRadius: R, innerRadius: r } = shape;
        const outerCircle = `M ${cx - R} ${cy} A ${R} ${R} 0 1 0 ${cx + R} ${cy} A ${R} ${R} 0 1 0 ${cx - R} ${cy} Z`;
        const innerCircle = `M ${cx - r} ${cy} A ${r} ${r} 0 1 0 ${cx + r} ${cy} A ${r} ${r} 0 1 0 ${cx - r} ${cy} Z`;

        els.push(
            React.createElement('path', {
                key: `annulus-ring-${shape.id}`,
                d: `${outerCircle} ${innerCircle}`,
                fillRule: 'evenodd',
                fill: shape.shadeRing ? shadeColor : shape.fill === 'transparent' ? 'rgba(255,255,255,0.01)' : shape.fill,
                fillOpacity: shape.shadeRing ? 0.75 : shape.opacity,
                stroke: color,
                strokeWidth,
                onMouseDown: callbacks.onShapeMouseDown,
                onContextMenu: callbacks.onShapeContextMenu,
                style: { cursor: 'move' }
            })
        );

        const pOuter = polarToCartesian(cx, cy, R, shape.outerRadiusAngle + shape.rotation);
        const pInner = polarToCartesian(cx, cy, r, shape.innerRadiusAngle + shape.rotation);

        if (shape.showOuterRadiusLine) {
            els.push(
                React.createElement('line', {
                    key: `ann-R-${shape.id}`,
                    x1: cx,
                    y1: cy,
                    x2: pOuter.x,
                    y2: pOuter.y,
                    stroke: color,
                    strokeWidth: 1.5
                })
            );
        }
        if (shape.showInnerRadiusLine) {
            els.push(
                React.createElement('line', {
                    key: `ann-r-${shape.id}`,
                    x1: cx,
                    y1: cy,
                    x2: pInner.x,
                    y2: pInner.y,
                    stroke: '#dc2626',
                    strokeWidth: 1.5,
                    strokeDasharray: '4,3'
                })
            );
        }
        if (shape.showCenterDot) {
            els.push(
                React.createElement('circle', {
                    key: `ann-c-${shape.id}`,
                    cx,
                    cy,
                    r: 3.5,
                    fill: color
                })
            );
        }

        if (shouldRenderHandles) {
            els.push(
                renderResizeHandle(
                    pOuter.x,
                    pOuter.y,
                    'ann-outer',
                    callbacks.onHandleDrag,
                    '#2563eb',
                    'circle',
                    'Drag Outer Radius R'
                ),
                renderResizeHandle(
                    pInner.x,
                    pInner.y,
                    'ann-inner',
                    callbacks.onHandleDrag,
                    '#dc2626',
                    'diamond',
                    'Drag Inner Radius r'
                )
            );
        }

        shape.labels.forEach(lbl => {
            if (lbl.hidden) return;
            if (lbl.customKey === 'outer-radius' && !shape.showOuterRadiusLine) return;
            if (lbl.customKey === 'inner-radius' && !shape.showInnerRadiusLine) return;
            let pos = { x: cx, y: cy };
            if (lbl.customKey === 'outer-radius') {
                pos = polarToCartesian(cx, cy, R * 0.65, shape.outerRadiusAngle + shape.rotation - 12);
            } else if (lbl.customKey === 'inner-radius') {
                pos = polarToCartesian(cx, cy, r * 0.55, shape.innerRadiusAngle + shape.rotation + 18);
            }
            renderLabelWithOptionalDimension(lbl, pos);
        });

        return els;
    }

    // -------------------------------------------------------------------------
    // D2. THE NORMAN WINDOW (Arch: Rectangle + Flush Top Semicircle)
    // -------------------------------------------------------------------------
    if (shape.type === 'norman-window') {
        const w = shape.width;
        const r = w / 2;
        const rh = shape.rectHeight;
        const totalH = rh + r;
        const topY = -totalH / 2;
        const springY = topY + r;
        const botY = totalH / 2;

        // Outer arch path: bottom-left -> top-left springing -> semicircle arch to top-right springing -> bottom-right -> close
        const archPath = `M ${-r} ${botY} L ${-r} ${springY} A ${r} ${r} 0 0 1 ${r} ${springY} L ${r} ${botY} Z`;

        const groupChildren: React.ReactNode[] = [
            React.createElement('path', {
                key: 'norman-main',
                d: archPath,
                fill: shape.fill === 'transparent' ? 'rgba(255,255,255,0.01)' : shape.fill,
                fillOpacity: shape.opacity,
                stroke: color,
                strokeWidth,
                onMouseDown: callbacks.onShapeMouseDown,
                onContextMenu: callbacks.onShapeContextMenu,
                style: { cursor: 'move' }
            })
        ];

        if (shape.showSpringingLine) {
            groupChildren.push(
                React.createElement('line', {
                    key: 'norman-spring',
                    x1: -r,
                    y1: springY,
                    x2: r,
                    y2: springY,
                    stroke: color,
                    strokeWidth: 1.35,
                    strokeDasharray: '5,4'
                })
            );
        }

        if (shape.showRadiusLine) {
            const radEnd = polarToCartesian(0, springY, r, -45);
            groupChildren.push(
                React.createElement('circle', {
                    key: 'norman-rcenter',
                    cx: 0,
                    cy: springY,
                    r: 3,
                    fill: color
                }),
                React.createElement('line', {
                    key: 'norman-rline',
                    x1: 0,
                    y1: springY,
                    x2: radEnd.x,
                    y2: radEnd.y,
                    stroke: color,
                    strokeWidth: 1.4,
                    strokeDasharray: '4,3'
                })
            );
        }

        els.push(
            React.createElement(
                'g',
                {
                    key: `norman-grp-${shape.id}`,
                    transform: `translate(${shape.x}, ${shape.y}) rotate(${shape.rotation})`
                },
                ...groupChildren
            )
        );

        const rot = (lx: number, ly: number) =>
            rotatePoint(shape.x + lx, shape.y + ly, shape.x, shape.y, shape.rotation);

        if (shape.showTotalHeightDimension) {
            const pTop = rot(r, topY);
            const pBot = rot(r, botY);
            const nRight = rotatePoint(1, 0, 0, 0, shape.rotation);
            els.push(
                renderDimensionLine(
                    pTop,
                    pBot,
                    nRight,
                    28,
                    color,
                    `norman-total-h-${shape.id}`
                )
            );
        }

        if (shouldRenderHandles) {
            const wHandle = rot(r, (springY + botY) / 2);
            const hHandle = rot(0, botY);
            els.push(
                renderResizeHandle(
                    wHandle.x,
                    wHandle.y,
                    'nw-width',
                    callbacks.onHandleDrag,
                    '#2563eb',
                    'circle',
                    'Drag window width (linked to semicircle arch radius r = w/2)'
                ),
                renderResizeHandle(
                    hHandle.x,
                    hHandle.y,
                    'nw-height',
                    callbacks.onHandleDrag,
                    '#dc2626',
                    'diamond',
                    'Drag rectangular wall height'
                )
            );
        }

        shape.labels.forEach(lbl => {
            if (lbl.hidden) return;
            if (lbl.customKey === 'radius' && !shape.showRadiusLine) return;
            if (lbl.customKey === 'total-height' && !shape.showTotalHeightDimension && !lbl.showDimensionLine) return;

            let local = { x: 0, y: 0 };
            let suppressDimLine = false;
            if (lbl.customKey === 'width') local = { x: 0, y: botY + 22 };
            else if (lbl.customKey === 'rect-height') local = { x: -r - 24, y: (springY + botY) / 2 };
            else if (lbl.customKey === 'right-height') local = { x: r + 24, y: (springY + botY) / 2 };
            else if (lbl.customKey === 'radius') local = { x: r * 0.35, y: springY - r * 0.45 };
            else if (lbl.customKey === 'total-height') {
                if (shape.showTotalHeightDimension) suppressDimLine = true;
                local = { x: r + 46, y: 0 };
            }
            renderLabelWithOptionalDimension(lbl, rot(local.x, local.y), suppressDimLine);
        });

        return els;
    }

    // -------------------------------------------------------------------------
    // D3. INSCRIBED TARGET (Circle Inside a Square)
    // -------------------------------------------------------------------------
    if (shape.type === 'inscribed-circle') {
        const s = shape.size;
        const r = s / 2;
        const squarePath = `M ${-r} ${-r} L ${r} ${-r} L ${r} ${r} L ${-r} ${r} Z`;
        const circlePath = `M ${-r} 0 A ${r} ${r} 0 1 0 ${r} 0 A ${r} ${r} 0 1 0 ${-r} 0 Z`;

        const groupChildren: React.ReactNode[] = [];

        if (shape.shadeRegion === 'corners') {
            groupChildren.push(
                React.createElement('path', {
                    key: 'insc-shade-corners',
                    d: `${squarePath} ${circlePath}`,
                    fillRule: 'evenodd',
                    fill: shadeColor,
                    fillOpacity: 0.78,
                    stroke: 'none'
                })
            );
        } else if (shape.shadeRegion === 'circle') {
            groupChildren.push(
                React.createElement('circle', {
                    key: 'insc-shade-circle',
                    cx: 0,
                    cy: 0,
                    r,
                    fill: shadeColor,
                    fillOpacity: 0.78,
                    stroke: 'none'
                })
            );
        }

        // Bounding Square
        groupChildren.push(
            React.createElement('rect', {
                key: 'insc-square',
                x: -r,
                y: -r,
                width: s,
                height: s,
                fill: shape.fill === 'transparent' ? 'rgba(255,255,255,0.01)' : shape.fill,
                fillOpacity: shape.opacity,
                stroke: color,
                strokeWidth,
                onMouseDown: callbacks.onShapeMouseDown,
                onContextMenu: callbacks.onShapeContextMenu,
                style: { cursor: 'move' }
            }),
            // Inscribed Circle
            React.createElement('circle', {
                key: 'insc-circle',
                cx: 0,
                cy: 0,
                r,
                fill: 'none',
                stroke: color,
                strokeWidth,
                pointerEvents: 'none'
            })
        );

        if (shape.showCornerRightAngles) {
            const rSz = 11;
            const corners = [
                `M ${-r + rSz} ${-r} L ${-r + rSz} ${-r + rSz} L ${-r} ${-r + rSz}`,
                `M ${r - rSz} ${-r} L ${r - rSz} ${-r + rSz} L ${r} ${-r + rSz}`,
                `M ${r - rSz} ${r} L ${r - rSz} ${r - rSz} L ${r} ${r - rSz}`,
                `M ${-r + rSz} ${r} L ${-r + rSz} ${r - rSz} L ${-r} ${r - rSz}`
            ];
            corners.forEach((cd, i) => {
                groupChildren.push(
                    React.createElement('path', {
                        key: `insc-corner-ra-${i}`,
                        d: cd,
                        fill: 'none',
                        stroke: color,
                        strokeWidth: 1.35
                    })
                );
            });
        }

        if (shape.showRadiusLine) {
            const pRad = polarToCartesian(0, 0, r, shape.radiusAngle);
            groupChildren.push(
                React.createElement('line', {
                    key: 'insc-rline',
                    x1: 0,
                    y1: 0,
                    x2: pRad.x,
                    y2: pRad.y,
                    stroke: color,
                    strokeWidth: 1.45,
                    strokeDasharray: '4,3'
                })
            );
        }

        if (shape.showDiameterLine) {
            const p1 = polarToCartesian(0, 0, r, shape.diameterAngle);
            const p2 = polarToCartesian(0, 0, r, shape.diameterAngle + 180);
            groupChildren.push(
                React.createElement('line', {
                    key: 'insc-dline',
                    x1: p1.x,
                    y1: p1.y,
                    x2: p2.x,
                    y2: p2.y,
                    stroke: color,
                    strokeWidth: 1.45,
                    strokeDasharray: '5,4'
                })
            );
        }

        if (shape.showCenterDot) {
            groupChildren.push(
                React.createElement('circle', {
                    key: 'insc-center',
                    cx: 0,
                    cy: 0,
                    r: 3.5,
                    fill: color
                })
            );
        }

        els.push(
            React.createElement(
                'g',
                {
                    key: `insc-grp-${shape.id}`,
                    transform: `translate(${shape.x}, ${shape.y}) rotate(${shape.rotation})`
                },
                ...groupChildren
            )
        );

        const rot = (lx: number, ly: number) =>
            rotatePoint(shape.x + lx, shape.y + ly, shape.x, shape.y, shape.rotation);

        if (shouldRenderHandles) {
            const sizeHandle = rot(r, 0);
            els.push(
                renderResizeHandle(
                    sizeHandle.x,
                    sizeHandle.y,
                    'insc-size',
                    callbacks.onHandleDrag,
                    '#2563eb',
                    'square',
                    'Drag to resize square and inscribed circle together'
                )
            );
            if (shape.showRadiusLine) {
                const radPt = polarToCartesian(0, 0, r, shape.radiusAngle);
                const radHandle = rot(radPt.x, radPt.y);
                els.push(
                    renderResizeHandle(
                        radHandle.x,
                        radHandle.y,
                        'insc-radius',
                        callbacks.onHandleDrag,
                        '#dc2626',
                        'circle',
                        'Drag to rotate radius angle'
                    )
                );
            }
        }

        shape.labels.forEach(lbl => {
            if (lbl.hidden) return;
            if (lbl.customKey === 'radius' && !shape.showRadiusLine) return;
            let local = { x: 0, y: 0 };
            if (lbl.customKey === 'top-side') local = { x: 0, y: -r - 20 };
            else if (lbl.customKey === 'bottom-side') local = { x: 0, y: r + 20 };
            else if (lbl.customKey === 'right-side') local = { x: r + 24, y: 0 };
            else if (lbl.customKey === 'left-side') local = { x: -r - 24, y: 0 };
            else if (lbl.customKey === 'radius') {
                const mid = polarToCartesian(0, 0, r * 0.5, shape.radiusAngle);
                const perp = polarToCartesian(0, 0, 15, shape.radiusAngle - 90);
                local = { x: mid.x + perp.x, y: mid.y + perp.y };
            }
            renderLabelWithOptionalDimension(lbl, rot(local.x, local.y));
        });

        return els;
    }

    // -------------------------------------------------------------------------
    // E. 3D SHAPES IN 2D PERSPECTIVE (All support Rotation, Fill, Opacity & ShadeColor)
    // -------------------------------------------------------------------------
    const rot3D = (pt: { x: number; y: number }) =>
        rotatePoint(pt.x, pt.y, shape.x, shape.y, shape.rotation);
    const groupTransform3D = shape.rotation
        ? `rotate(${shape.rotation} ${shape.x} ${shape.y})`
        : undefined;

    // 1. RECTANGULAR PRISM & CUBE
    if (shape.type === 'prism') {
        const hw = shape.width / 2;
        const hh = shape.height / 2;
        const dx = shape.depthX;
        const dy = shape.depthY;

        const cx = shape.x - dx / 2;
        const cy = shape.y - dy / 2;

        const F0 = { x: cx - hw, y: cy - hh };
        const F1 = { x: cx + hw, y: cy - hh };
        const F2 = { x: cx + hw, y: cy + hh };
        const F3 = { x: cx - hw, y: cy + hh };

        const B0 = { x: F0.x + dx, y: F0.y + dy };
        const B1 = { x: F1.x + dx, y: F1.y + dy };
        const B2 = { x: F2.x + dx, y: F2.y + dy };
        const B3 = { x: F3.x + dx, y: F3.y + dy };

        const faces: { id: 'back' | 'left' | 'bottom' | 'top' | 'right' | 'front'; pts: { x: number; y: number }[] }[] = [
            { id: 'back', pts: [B0, B1, B2, B3] },
            { id: 'left', pts: [B0, F0, F3, B3] },
            { id: 'bottom', pts: [F3, F2, B2, B3] },
            { id: 'top', pts: [B0, B1, F1, F0] },
            { id: 'right', pts: [F1, B1, B2, F2] },
            { id: 'front', pts: [F0, F1, F2, F3] }
        ];

        const grp: React.ReactNode[] = [];

        faces.forEach(f => {
            const isShaded = shape.shadedFaces.includes(f.id);
            const isVisibleFace = f.id === 'front' || f.id === 'top' || f.id === 'right';
            if (!isShaded && !isVisibleFace) return;
            const pathD = f.pts.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ') + ' Z';
            const faceFill = isShaded
                ? shadeColor
                : shape.fill !== 'transparent'
                ? shape.fill
                : 'rgba(255,255,255,0.01)';
            const faceOpacity = isShaded
                ? 0.65
                : shape.fill !== 'transparent'
                ? shape.opacity
                : 0.01;

            grp.push(
                React.createElement('path', {
                    key: `prism-face-${shape.id}-${f.id}`,
                    d: pathD,
                    fill: faceFill,
                    fillOpacity: faceOpacity,
                    stroke: 'none',
                    onClick: callbacks.onFaceClick
                        ? (e: React.MouseEvent) => {
                              e.stopPropagation();
                              callbacks.onFaceClick!(f.id, e);
                          }
                        : undefined,
                    onMouseDown: callbacks.onShapeMouseDown,
                    onContextMenu: callbacks.onShapeContextMenu,
                    style: { cursor: 'pointer' }
                })
            );
        });

        if (shape.showHiddenLines) {
            const hiddenEdges = [
                [B3, B0],
                [B3, B2],
                [F3, B3]
            ];
            hiddenEdges.forEach(([p1, p2], idx) => {
                grp.push(
                    React.createElement('line', {
                        key: `prism-hid-${shape.id}-${idx}`,
                        x1: p1.x,
                        y1: p1.y,
                        x2: p2.x,
                        y2: p2.y,
                        stroke: color,
                        strokeWidth: strokeWidth * 0.85,
                        strokeDasharray: '5,4',
                        pointerEvents: 'none'
                    })
                );
            });
        }

        if (shape.showPythagorasTriangle) {
            grp.push(
                React.createElement('polygon', {
                    key: `prism-pyth-fill-${shape.id}`,
                    points: `${F3.x},${F3.y} ${B2.x},${B2.y} ${B1.x},${B1.y}`,
                    fill: '#fde68a',
                    fillOpacity: 0.45,
                    stroke: 'none',
                    pointerEvents: 'none'
                })
            );
        }
        if (shape.showBaseDiagonal || shape.showPythagorasTriangle) {
            grp.push(
                React.createElement('line', {
                    key: `prism-basediag-${shape.id}`,
                    x1: F3.x,
                    y1: F3.y,
                    x2: B2.x,
                    y2: B2.y,
                    stroke: '#0284c7',
                    strokeWidth: 1.5,
                    strokeDasharray: '4,3',
                    pointerEvents: 'none'
                })
            );
        }
        if (shape.showSpaceDiagonal || shape.showPythagorasTriangle) {
            grp.push(
                React.createElement('line', {
                    key: `prism-spacediag-${shape.id}`,
                    x1: F3.x,
                    y1: F3.y,
                    x2: B1.x,
                    y2: B1.y,
                    stroke: '#dc2626',
                    strokeWidth: 1.75,
                    strokeDasharray: '5,3',
                    pointerEvents: 'none'
                }),
                renderRightAngleMarker3D(
                    B2,
                    getVector(B2, F3),
                    getVector(B2, B1),
                    11,
                    '#dc2626'
                )
            );
        }

        const visibleEdges = [
            [F0, F1],
            [F1, F2],
            [F2, F3],
            [F3, F0],
            [B0, B1],
            [B1, B2],
            [F0, B0],
            [F1, B1],
            [F2, B2]
        ];
        visibleEdges.forEach(([p1, p2], idx) => {
            grp.push(
                React.createElement('line', {
                    key: `prism-vis-${shape.id}-${idx}`,
                    x1: p1.x,
                    y1: p1.y,
                    x2: p2.x,
                    y2: p2.y,
                    stroke: color,
                    strokeWidth,
                    strokeLinecap: 'round',
                    pointerEvents: 'none'
                })
            );
        });

        els.push(
            React.createElement('g', { key: `prism-grp-${shape.id}`, transform: groupTransform3D }, ...grp)
        );

        if (shouldRenderHandles) {
            const hSize = rot3D(F2);
            const hDepth = rot3D(B1);
            els.push(
                renderResizeHandle(
                    hSize.x,
                    hSize.y,
                    'prism-size',
                    callbacks.onHandleDrag,
                    '#2563eb',
                    'square',
                    'Drag front width & height (Shift: lock cube)'
                ),
                renderResizeHandle(
                    hDepth.x,
                    hDepth.y,
                    'prism-depth',
                    callbacks.onHandleDrag,
                    '#dc2626',
                    'diamond',
                    'Drag 3D perspective skew & depth'
                )
            );
        }

        shape.labels.forEach(lbl => {
            if (lbl.hidden) return;
            if (lbl.customKey === 'diagonal' && !shape.showSpaceDiagonal && !shape.showPythagorasTriangle) return;
            let pos = { x: shape.x, y: shape.y };
            if (lbl.customKey === 'width') pos = { x: (F3.x + F2.x) / 2, y: F3.y + 20 };
            else if (lbl.customKey === 'height') pos = { x: F0.x - 22, y: (F0.y + F3.y) / 2 };
            else if (lbl.customKey === 'depth') pos = { x: (F2.x + B2.x) / 2 + 18, y: (F2.y + B2.y) / 2 + 10 };
            else if (lbl.customKey === 'right-height') pos = { x: B1.x + 22, y: (B1.y + B2.y) / 2 };
            else if (lbl.customKey === 'diagonal') pos = { x: (F3.x + B1.x) / 2 - 10, y: (F3.y + B1.y) / 2 - 12 };
            const rPos = rot3D(pos);
            renderLabelWithOptionalDimension(lbl, rPos);
        });

        return els;
    }

    // 2. CYLINDER
    if (shape.type === 'cylinder') {
        const { x: cx, y: cy, radius: r, height: h, ellipseRy: ry } = shape;
        const topY = cy - h / 2;
        const botY = cy + h / 2;
        const grp: React.ReactNode[] = [];

        const bodyPath = `M ${cx - r} ${topY} A ${r} ${ry} 0 0 1 ${cx + r} ${topY} L ${cx + r} ${botY} A ${r} ${ry} 0 0 1 ${cx - r} ${botY} Z`;
        grp.push(
            React.createElement('path', {
                key: `cyl-body-${shape.id}`,
                d: bodyPath,
                fill: shape.fill === 'transparent' ? 'rgba(255,255,255,0.01)' : shape.fill,
                fillOpacity: shape.opacity,
                stroke: 'none',
                onMouseDown: callbacks.onShapeMouseDown,
                onContextMenu: callbacks.onShapeContextMenu,
                style: { cursor: 'move' }
            })
        );

        grp.push(
            React.createElement('ellipse', {
                key: `cyl-top-${shape.id}`,
                cx,
                cy: topY,
                rx: r,
                ry,
                fill: shape.fill === 'transparent' ? 'none' : shape.fill,
                fillOpacity: shape.opacity,
                stroke: color,
                strokeWidth,
                pointerEvents: 'none'
            })
        );

        grp.push(
            React.createElement('path', {
                key: `cyl-bot-front-${shape.id}`,
                d: `M ${cx - r} ${botY} A ${r} ${ry} 0 0 0 ${cx + r} ${botY}`,
                fill: 'none',
                stroke: color,
                strokeWidth,
                pointerEvents: 'none'
            })
        );

        if (shape.rearCurveMode !== 'hidden') {
            grp.push(
                React.createElement('path', {
                    key: `cyl-bot-rear-${shape.id}`,
                    d: `M ${cx - r} ${botY} A ${r} ${ry} 0 0 1 ${cx + r} ${botY}`,
                    fill: 'none',
                    stroke: color,
                    strokeWidth: shape.rearCurveMode === 'dashed' ? strokeWidth * 0.85 : strokeWidth,
                    strokeDasharray: shape.rearCurveMode === 'dashed' ? '5,4' : undefined,
                    pointerEvents: 'none'
                })
            );
        }

        grp.push(
            React.createElement('line', {
                key: `cyl-left-${shape.id}`,
                x1: cx - r,
                y1: topY,
                x2: cx - r,
                y2: botY,
                stroke: color,
                strokeWidth
            }),
            React.createElement('line', {
                key: `cyl-right-${shape.id}`,
                x1: cx + r,
                y1: topY,
                x2: cx + r,
                y2: botY,
                stroke: color,
                strokeWidth
            })
        );

        if (shape.showTopRadius) {
            grp.push(
                React.createElement('circle', { key: 'cyl-tc', cx, cy: topY, r: 3, fill: color }),
                React.createElement('line', {
                    key: 'cyl-tr',
                    x1: cx,
                    y1: topY,
                    x2: cx + r,
                    y2: topY,
                    stroke: color,
                    strokeWidth: 1.4
                })
            );
        }
        if (shape.showTopDiameter) {
            grp.push(
                React.createElement('circle', { key: 'cyl-tdc', cx, cy: topY, r: 3, fill: color }),
                React.createElement('line', {
                    key: 'cyl-td',
                    x1: cx - r,
                    y1: topY,
                    x2: cx + r,
                    y2: topY,
                    stroke: color,
                    strokeWidth: 1.4
                })
            );
        }
        if (shape.showBottomRadius) {
            grp.push(
                React.createElement('circle', { key: 'cyl-bc', cx, cy: botY, r: 3, fill: color }),
                React.createElement('line', {
                    key: 'cyl-br',
                    x1: cx,
                    y1: botY,
                    x2: cx + r,
                    y2: botY,
                    stroke: color,
                    strokeWidth: 1.4,
                    strokeDasharray: '4,3'
                })
            );
        }
        if (shape.showAxisLine) {
            grp.push(
                React.createElement('line', {
                    key: 'cyl-axis',
                    x1: cx,
                    y1: topY,
                    x2: cx,
                    y2: botY,
                    stroke: color,
                    strokeWidth: 1.3,
                    strokeDasharray: '4,4'
                })
            );
        }
        if (shape.showHeightDimension) {
            grp.push(
                renderDimensionLine(
                    { x: cx + r, y: topY },
                    { x: cx + r, y: botY },
                    { x: 1, y: 0 },
                    26,
                    color,
                    `cyl-hdim-${shape.id}`
                )
            );
        }

        els.push(
            React.createElement('g', { key: `cyl-grp-${shape.id}`, transform: groupTransform3D }, ...grp)
        );

        if (shouldRenderHandles) {
            const hRad = rot3D({ x: cx + r, y: cy });
            const hBot = rot3D({ x: cx, y: botY });
            const hRy = rot3D({ x: cx, y: topY - ry });
            els.push(
                renderResizeHandle(
                    hRad.x,
                    hRad.y,
                    'cyl-radius',
                    callbacks.onHandleDrag,
                    '#2563eb',
                    'circle',
                    'Drag Cylinder Radius'
                ),
                renderResizeHandle(
                    hBot.x,
                    hBot.y,
                    'cyl-height',
                    callbacks.onHandleDrag,
                    '#2563eb',
                    'square',
                    'Drag Cylinder Height'
                ),
                renderResizeHandle(
                    hRy.x,
                    hRy.y,
                    'cyl-ry',
                    callbacks.onHandleDrag,
                    '#dc2626',
                    'diamond',
                    'Drag Ellipse Perspective Squash'
                )
            );
        }

        shape.labels.forEach(lbl => {
            if (lbl.hidden) return;
            if (lbl.customKey === 'radius' && !shape.showTopRadius && !shape.showTopDiameter && !shape.showBottomRadius) return;
            let pos = { x: cx, y: cy };
            let suppressDimLine = false;
            if (lbl.customKey === 'radius') pos = { x: cx + r / 2, y: topY - 12 };
            else if (lbl.customKey === 'height') {
                if (shape.showHeightDimension) suppressDimLine = true;
                pos = { x: cx + r + (shape.showHeightDimension ? 42 : 20), y: cy };
            } else if (lbl.customKey === 'left-height') {
                pos = { x: cx - r - 22, y: cy };
            }
            const rPos = rot3D(pos);
            renderLabelWithOptionalDimension(lbl, rPos, suppressDimLine);
        });

        return els;
    }

    // 3. CONE
    if (shape.type === 'cone') {
        const { x: cx, y: cy, radius: r, height: h, ellipseRy: ry, apexOffsetX } = shape;
        const apex = { x: cx + apexOffsetX, y: cy - h / 2 };
        const botY = cy + h / 2;
        const baseCenter = { x: cx, y: botY };
        const baseRight = { x: cx + r, y: botY };
        const baseLeft = { x: cx - r, y: botY };
        const grp: React.ReactNode[] = [];

        const bodyPath = `M ${apex.x} ${apex.y} L ${baseRight.x} ${baseRight.y} A ${r} ${ry} 0 0 1 ${baseLeft.x} ${baseLeft.y} Z`;
        grp.push(
            React.createElement('path', {
                key: `cone-body-${shape.id}`,
                d: bodyPath,
                fill: shape.fill === 'transparent' ? 'rgba(255,255,255,0.01)' : shape.fill,
                fillOpacity: shape.opacity,
                stroke: 'none',
                onMouseDown: callbacks.onShapeMouseDown,
                onContextMenu: callbacks.onShapeContextMenu,
                style: { cursor: 'move' }
            })
        );

        if (shape.shadeInternalTriangle) {
            grp.push(
                React.createElement('polygon', {
                    key: `cone-int-tri-${shape.id}`,
                    points: `${apex.x},${apex.y} ${baseCenter.x},${baseCenter.y} ${baseRight.x},${baseRight.y}`,
                    fill: shadeColor,
                    fillOpacity: 0.65,
                    stroke: 'none'
                })
            );
        }

        // Base curves
        grp.push(
            React.createElement('path', {
                key: `cone-front-${shape.id}`,
                d: `M ${baseLeft.x} ${botY} A ${r} ${ry} 0 0 0 ${baseRight.x} ${botY}`,
                fill: 'none',
                stroke: color,
                strokeWidth
            })
        );
        if (shape.rearCurveMode !== 'hidden') {
            grp.push(
                React.createElement('path', {
                    key: `cone-rear-${shape.id}`,
                    d: `M ${baseLeft.x} ${botY} A ${r} ${ry} 0 0 1 ${baseRight.x} ${botY}`,
                    fill: 'none',
                    stroke: color,
                    strokeWidth: shape.rearCurveMode === 'dashed' ? strokeWidth * 0.85 : strokeWidth,
                    strokeDasharray: shape.rearCurveMode === 'dashed' ? '5,4' : undefined
                })
            );
        }

        // Slant edges
        grp.push(
            React.createElement('line', {
                key: `cone-sl-l-${shape.id}`,
                x1: apex.x,
                y1: apex.y,
                x2: baseLeft.x,
                y2: baseLeft.y,
                stroke: color,
                strokeWidth
            }),
            React.createElement('line', {
                key: `cone-sl-r-${shape.id}`,
                x1: apex.x,
                y1: apex.y,
                x2: baseRight.x,
                y2: baseRight.y,
                stroke: color,
                strokeWidth
            })
        );

        // Perpendicular height & Base radius
        if (shape.showPerpendicularHeight) {
            grp.push(
                React.createElement('line', {
                    key: `cone-ph-${shape.id}`,
                    x1: apex.x,
                    y1: apex.y,
                    x2: baseCenter.x,
                    y2: baseCenter.y,
                    stroke: color,
                    strokeWidth: 1.4,
                    strokeDasharray: '5,4'
                }),
                renderRightAngleMarker3D(
                    baseCenter,
                    getVector(baseCenter, apex),
                    getVector(baseCenter, baseRight),
                    10,
                    color
                )
            );
        }
        if (shape.showBaseRadius) {
            grp.push(
                React.createElement('circle', {
                    key: `cone-bc-${shape.id}`,
                    cx: baseCenter.x,
                    cy: baseCenter.y,
                    r: 3,
                    fill: color
                }),
                React.createElement('line', {
                    key: `cone-br-${shape.id}`,
                    x1: baseCenter.x,
                    y1: baseCenter.y,
                    x2: baseRight.x,
                    y2: baseRight.y,
                    stroke: color,
                    strokeWidth: 1.4,
                    strokeDasharray: '4,3'
                })
            );
        }
        if (shape.showSlantHeightDimension) {
            const nOut = getOutwardNormal(apex, baseRight, baseCenter);
            grp.push(
                renderDimensionLine(
                    apex,
                    baseRight,
                    nOut,
                    22,
                    color,
                    `cone-slantdim-${shape.id}`
                )
            );
        }

        els.push(
            React.createElement('g', { key: `cone-grp-${shape.id}`, transform: groupTransform3D }, ...grp)
        );

        if (shouldRenderHandles) {
            const hApex = rot3D(apex);
            const hRad = rot3D(baseRight);
            const hRy = rot3D({ x: cx, y: botY + ry });
            els.push(
                renderResizeHandle(
                    hApex.x,
                    hApex.y,
                    'cone-apex',
                    callbacks.onHandleDrag,
                    '#dc2626',
                    'diamond',
                    'Drag Cone Apex (Shift: keep centered right cone)'
                ),
                renderResizeHandle(
                    hRad.x,
                    hRad.y,
                    'cone-radius',
                    callbacks.onHandleDrag,
                    '#2563eb',
                    'circle',
                    'Drag Base Radius'
                ),
                renderResizeHandle(
                    hRy.x,
                    hRy.y,
                    'cone-ry',
                    callbacks.onHandleDrag,
                    '#d97706',
                    'square',
                    'Drag Base Ellipse Squash'
                )
            );
        }

        shape.labels.forEach(lbl => {
            if (lbl.hidden) return;
            if (lbl.customKey === 'height' && !shape.showPerpendicularHeight) return;
            if (lbl.customKey === 'radius' && !shape.showBaseRadius) return;
            if (lbl.customKey === 'slant-height' && !shape.showSlantHeightDimension && !lbl.showDimensionLine) return;
            let pos = { x: cx, y: cy };
            let suppressDimLine = false;
            if (lbl.customKey === 'height') pos = { x: (apex.x + baseCenter.x) / 2 - 16, y: cy + 10 };
            else if (lbl.customKey === 'radius') pos = { x: cx + r / 2, y: botY + 16 };
            else if (lbl.customKey === 'slant-height') {
                if (shape.showSlantHeightDimension) suppressDimLine = true;
                pos = { x: (apex.x + baseRight.x) / 2 + 34, y: (apex.y + baseRight.y) / 2 - 6 };
            } else if (lbl.customKey === 'left-slant') {
                pos = { x: (apex.x + baseLeft.x) / 2 - 26, y: (apex.y + baseLeft.y) / 2 - 6 };
            }
            const rPos = rot3D(pos);
            renderLabelWithOptionalDimension(lbl, rPos, suppressDimLine);
        });

        return els;
    }

    // 4. SPHERE & HEMISPHERE
    if (shape.type === 'sphere') {
        const { x: cx, y: cy, radius: r, equatorRy: ry, hemisphereMode } = shape;
        const grp: React.ReactNode[] = [];

        if (hemisphereMode === 'full') {
            grp.push(
                React.createElement('circle', {
                    key: `sph-main-${shape.id}`,
                    cx,
                    cy,
                    r,
                    fill: shape.fill === 'transparent' ? 'rgba(255,255,255,0.01)' : shape.fill,
                    fillOpacity: shape.opacity,
                    stroke: color,
                    strokeWidth,
                    onMouseDown: callbacks.onShapeMouseDown,
                    onContextMenu: callbacks.onShapeContextMenu,
                    style: { cursor: 'move' }
                })
            );
        } else if (hemisphereMode === 'bottom-hemisphere') {
            const domePath = `M ${cx - r} ${cy} A ${r} ${r} 0 0 0 ${cx + r} ${cy} A ${r} ${ry} 0 0 1 ${cx - r} ${cy} Z`;
            grp.push(
                React.createElement('path', {
                    key: `sph-bot-dome-${shape.id}`,
                    d: domePath,
                    fill: shape.fill === 'transparent' ? 'rgba(255,255,255,0.01)' : shape.fill,
                    fillOpacity: shape.opacity,
                    stroke: color,
                    strokeWidth,
                    onMouseDown: callbacks.onShapeMouseDown,
                    onContextMenu: callbacks.onShapeContextMenu,
                    style: { cursor: 'move' }
                }),
                React.createElement('ellipse', {
                    key: `sph-bot-cap-${shape.id}`,
                    cx,
                    cy,
                    rx: r,
                    ry,
                    fill: shadeColor,
                    fillOpacity: 0.35,
                    stroke: color,
                    strokeWidth
                })
            );
        } else if (hemisphereMode === 'top-hemisphere') {
            const domePath = `M ${cx - r} ${cy} A ${r} ${r} 0 0 1 ${cx + r} ${cy} A ${r} ${ry} 0 0 1 ${cx - r} ${cy} Z`;
            grp.push(
                React.createElement('path', {
                    key: `sph-top-dome-${shape.id}`,
                    d: domePath,
                    fill: shape.fill === 'transparent' ? 'rgba(255,255,255,0.01)' : shape.fill,
                    fillOpacity: shape.opacity,
                    stroke: color,
                    strokeWidth,
                    onMouseDown: callbacks.onShapeMouseDown,
                    onContextMenu: callbacks.onShapeContextMenu,
                    style: { cursor: 'move' }
                })
            );
        }

        grp.push(
            React.createElement('path', {
                key: `sph-eq-front-${shape.id}`,
                d: `M ${cx - r} ${cy} A ${r} ${ry} 0 0 0 ${cx + r} ${cy}`,
                fill: 'none',
                stroke: color,
                strokeWidth: 1.45
            })
        );
        if (shape.rearCurveMode !== 'hidden' && hemisphereMode !== 'bottom-hemisphere') {
            grp.push(
                React.createElement('path', {
                    key: `sph-eq-rear-${shape.id}`,
                    d: `M ${cx - r} ${cy} A ${r} ${ry} 0 0 1 ${cx + r} ${cy}`,
                    fill: 'none',
                    stroke: color,
                    strokeWidth: 1.25,
                    strokeDasharray: shape.rearCurveMode === 'dashed' ? '5,4' : undefined
                })
            );
        }

        if (shape.showRadiusLine) {
            const radPt = polarToCartesian(cx, cy, r, shape.radiusAngle);
            grp.push(
                React.createElement('line', {
                    key: `sph-rad-${shape.id}`,
                    x1: cx,
                    y1: cy,
                    x2: radPt.x,
                    y2: radPt.y,
                    stroke: color,
                    strokeWidth: 1.5,
                    strokeDasharray: '4,3'
                })
            );
        }
        if (shape.showCenterDot) {
            grp.push(
                React.createElement('circle', {
                    key: `sph-c-${shape.id}`,
                    cx,
                    cy,
                    r: 3.5,
                    fill: color
                })
            );
        }

        els.push(
            React.createElement('g', { key: `sph-grp-${shape.id}`, transform: groupTransform3D }, ...grp)
        );

        if (shouldRenderHandles) {
            const radPt = rot3D(polarToCartesian(cx, cy, r, shape.radiusAngle));
            const ryPt = rot3D({ x: cx, y: cy + ry });
            els.push(
                renderResizeHandle(
                    radPt.x,
                    radPt.y,
                    'sph-radius',
                    callbacks.onHandleDrag,
                    '#2563eb',
                    'circle',
                    'Drag Sphere Radius'
                ),
                renderResizeHandle(
                    ryPt.x,
                    ryPt.y,
                    'sph-ry',
                    callbacks.onHandleDrag,
                    '#dc2626',
                    'diamond',
                    'Drag Equator Ellipse Squash'
                )
            );
        }

        shape.labels.forEach(lbl => {
            if (lbl.hidden) return;
            if (lbl.customKey === 'radius' && !shape.showRadiusLine) return;
            const radPt = polarToCartesian(cx, cy, r * 0.5, shape.radiusAngle);
            const pos = lbl.customKey === 'radius' ? { x: radPt.x, y: radPt.y - 14 } : { x: cx, y: cy };
            const rPos = rot3D(pos);
            renderLabelWithOptionalDimension(lbl, rPos);
        });

        return els;
    }

    // 5. PYRAMID (Square-Based & Triangular-Based)
    if (shape.type === 'pyramid') {
        const {
            x: cx,
            y: cy,
            baseWidth: bw,
            baseDepthX: dx,
            baseDepthY: dy,
            height: h,
            apexOffsetX
        } = shape;

        const baseCenter = { x: cx, y: cy + h * 0.35 };
        const apex = { x: cx + apexOffsetX, y: cy - h * 0.65 };
        const grp: React.ReactNode[] = [];

        if (shape.baseType === 'square') {
            const hw = bw / 2;
            const hdx = dx / 2;
            const hdy = dy / 2;

            const B0 = { x: baseCenter.x - hw - hdx, y: baseCenter.y - hdy };
            const B1 = { x: baseCenter.x + hw - hdx, y: baseCenter.y - hdy };
            const B2 = { x: baseCenter.x + hw + hdx, y: baseCenter.y + hdy };
            const B3 = { x: baseCenter.x - hw + hdx, y: baseCenter.y + hdy };

            const rightMid = getMidpoint(B1, B2);

            const pyrFaces = [
                { idx: 2, pts: [B0, B1, B2, B3], isVisible: false },
                { idx: 1, pts: [apex, B1, B2], isVisible: true },
                { idx: 0, pts: [apex, B0, B1], isVisible: true }
            ];

            pyrFaces.forEach(f => {
                const isShaded = (shape.shadedFaces || []).includes(f.idx);
                if (!isShaded && !f.isVisible) return;
                const pathD = f.pts.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ') + ' Z';
                const faceFill = isShaded
                    ? shadeColor
                    : shape.fill !== 'transparent'
                    ? shape.fill
                    : 'rgba(255,255,255,0.01)';
                const faceOpacity = isShaded
                    ? 0.65
                    : shape.fill !== 'transparent'
                    ? shape.opacity
                    : 0.01;
                grp.push(
                    React.createElement('path', {
                        key: `pyr-face-${shape.id}-${f.idx}`,
                        d: pathD,
                        fill: faceFill,
                        fillOpacity: faceOpacity,
                        stroke: 'none',
                        onClick: callbacks.onFaceClick
                            ? (e: React.MouseEvent) => {
                                  e.stopPropagation();
                                  callbacks.onFaceClick!(String(f.idx), e);
                              }
                            : undefined,
                        onMouseDown: callbacks.onShapeMouseDown,
                        onContextMenu: callbacks.onShapeContextMenu,
                        style: { cursor: 'pointer' }
                    })
                );
            });

            if (shape.shadeInternalTriangle) {
                grp.push(
                    React.createElement('polygon', {
                        key: `pyr-int-tri-${shape.id}`,
                        points: `${apex.x},${apex.y} ${baseCenter.x},${baseCenter.y} ${rightMid.x},${rightMid.y}`,
                        fill: '#fde68a',
                        fillOpacity: 0.55,
                        stroke: 'none',
                        pointerEvents: 'none'
                    })
                );
            }

            if (shape.showHiddenLines) {
                grp.push(
                    React.createElement('line', {
                        key: 'pyr-h1',
                        x1: B3.x,
                        y1: B3.y,
                        x2: B0.x,
                        y2: B0.y,
                        stroke: color,
                        strokeWidth: strokeWidth * 0.85,
                        strokeDasharray: '5,4'
                    }),
                    React.createElement('line', {
                        key: 'pyr-h2',
                        x1: B3.x,
                        y1: B3.y,
                        x2: B2.x,
                        y2: B2.y,
                        stroke: color,
                        strokeWidth: strokeWidth * 0.85,
                        strokeDasharray: '5,4'
                    }),
                    React.createElement('line', {
                        key: 'pyr-h3',
                        x1: apex.x,
                        y1: apex.y,
                        x2: B3.x,
                        y2: B3.y,
                        stroke: color,
                        strokeWidth: strokeWidth * 0.85,
                        strokeDasharray: '5,4'
                    })
                );
            }

            if (shape.showPerpendicularHeight) {
                grp.push(
                    React.createElement('circle', {
                        key: 'pyr-bc',
                        cx: baseCenter.x,
                        cy: baseCenter.y,
                        r: 3,
                        fill: color
                    }),
                    React.createElement('line', {
                        key: 'pyr-ph',
                        x1: apex.x,
                        y1: apex.y,
                        x2: baseCenter.x,
                        y2: baseCenter.y,
                        stroke: '#dc2626',
                        strokeWidth: 1.5,
                        strokeDasharray: '5,4'
                    })
                );
            }
            if (shape.showApothemLine || shape.showSlantHeight) {
                grp.push(
                    React.createElement('line', {
                        key: 'pyr-apo',
                        x1: baseCenter.x,
                        y1: baseCenter.y,
                        x2: rightMid.x,
                        y2: rightMid.y,
                        stroke: '#0284c7',
                        strokeWidth: 1.4,
                        strokeDasharray: '4,3'
                    })
                );
            }
            if (shape.showPerpendicularHeight && (shape.showApothemLine || shape.showSlantHeight)) {
                grp.push(
                    renderRightAngleMarker3D(
                        baseCenter,
                        getVector(baseCenter, apex),
                        getVector(baseCenter, rightMid),
                        10,
                        '#dc2626'
                    )
                );
            }
            if (shape.showSlantHeight) {
                grp.push(
                    React.createElement('line', {
                        key: 'pyr-slant',
                        x1: apex.x,
                        y1: apex.y,
                        x2: rightMid.x,
                        y2: rightMid.y,
                        stroke: '#059669',
                        strokeWidth: 1.65,
                        strokeDasharray: '5,3'
                    }),
                    renderRightAngleMarker3D(
                        rightMid,
                        getVector(rightMid, apex),
                        getVector(rightMid, B1),
                        9,
                        '#059669'
                    )
                );
            }

            const visEdges = [
                [B0, B1],
                [B1, B2],
                [apex, B0],
                [apex, B1],
                [apex, B2]
            ];
            visEdges.forEach(([p1, p2], idx) => {
                grp.push(
                    React.createElement('line', {
                        key: `pyr-vis-${idx}`,
                        x1: p1.x,
                        y1: p1.y,
                        x2: p2.x,
                        y2: p2.y,
                        stroke: color,
                        strokeWidth,
                        strokeLinecap: 'round',
                        pointerEvents: 'none'
                    })
                );
            });

            els.push(
                React.createElement('g', { key: `pyr-grp-${shape.id}`, transform: groupTransform3D }, ...grp)
            );

            if (shouldRenderHandles) {
                const hApex = rot3D(apex);
                const hBase = rot3D(B1);
                const hDepth = rot3D(B2);
                els.push(
                    renderResizeHandle(
                        hApex.x,
                        hApex.y,
                        'pyr-apex',
                        callbacks.onHandleDrag,
                        '#dc2626',
                        'diamond',
                        'Drag Pyramid Apex (Right vs Oblique)'
                    ),
                    renderResizeHandle(
                        hBase.x,
                        hBase.y,
                        'pyr-base',
                        callbacks.onHandleDrag,
                        '#2563eb',
                        'square',
                        'Drag Base Width'
                    ),
                    renderResizeHandle(
                        hDepth.x,
                        hDepth.y,
                        'pyr-depth',
                        callbacks.onHandleDrag,
                        '#d97706',
                        'circle',
                        'Drag Base Perspective Skew'
                    )
                );
            }

            shape.labels.forEach(lbl => {
                if (lbl.hidden) return;
                if (lbl.customKey === 'height' && !shape.showPerpendicularHeight) return;
                if (lbl.customKey === 'slant-height' && !shape.showSlantHeight && !lbl.showDimensionLine) return;
                let pos = { x: cx, y: cy };
                if (lbl.customKey === 'base-width') pos = { x: (B0.x + B1.x) / 2, y: B0.y + 20 };
                else if (lbl.customKey === 'base-depth') pos = { x: (B1.x + B2.x) / 2 + 20, y: (B1.y + B2.y) / 2 + 10 };
                else if (lbl.customKey === 'height') pos = { x: (apex.x + baseCenter.x) / 2 - 16, y: (apex.y + baseCenter.y) / 2 };
                else if (lbl.customKey === 'slant-height') pos = { x: (apex.x + rightMid.x) / 2 + 18, y: (apex.y + rightMid.y) / 2 };
                else if (lbl.customKey === 'right-slant-edge') pos = { x: (apex.x + B2.x) / 2 + 20, y: (apex.y + B2.y) / 2 };
                else if (lbl.customKey === 'left-slant-edge') pos = { x: (apex.x + B0.x) / 2 - 20, y: (apex.y + B0.y) / 2 };
                const rPos = rot3D(pos);
                renderLabelWithOptionalDimension(lbl, rPos);
            });
        } else {
            const hw = bw / 2;
            const T0 = { x: baseCenter.x - hw, y: baseCenter.y + 12 };
            const T1 = { x: baseCenter.x + hw, y: baseCenter.y + 12 };
            const T2 = { x: baseCenter.x + dx * 0.6, y: baseCenter.y + dy * 0.9 };
            const rightMid = getMidpoint(T1, T2);

            const pyrFaces = [
                { idx: 2, pts: [T0, T1, T2], isVisible: false },
                { idx: 1, pts: [apex, T1, T2], isVisible: true },
                { idx: 0, pts: [apex, T0, T1], isVisible: true }
            ];

            pyrFaces.forEach(f => {
                const isShaded = (shape.shadedFaces || []).includes(f.idx);
                if (!isShaded && !f.isVisible) return;
                const pathD = f.pts.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ') + ' Z';
                const faceFill = isShaded
                    ? shadeColor
                    : shape.fill !== 'transparent'
                    ? shape.fill
                    : 'rgba(255,255,255,0.01)';
                const faceOpacity = isShaded
                    ? 0.65
                    : shape.fill !== 'transparent'
                    ? shape.opacity
                    : 0.01;
                grp.push(
                    React.createElement('path', {
                        key: `pyr3-face-${shape.id}-${f.idx}`,
                        d: pathD,
                        fill: faceFill,
                        fillOpacity: faceOpacity,
                        stroke: 'none',
                        onClick: callbacks.onFaceClick
                            ? (e: React.MouseEvent) => {
                                  e.stopPropagation();
                                  callbacks.onFaceClick!(String(f.idx), e);
                              }
                            : undefined,
                        onMouseDown: callbacks.onShapeMouseDown,
                        onContextMenu: callbacks.onShapeContextMenu,
                        style: { cursor: 'pointer' }
                    })
                );
            });

            if (shape.shadeInternalTriangle) {
                grp.push(
                    React.createElement('polygon', {
                        key: `pyr3-int-tri-${shape.id}`,
                        points: `${apex.x},${apex.y} ${baseCenter.x},${baseCenter.y} ${rightMid.x},${rightMid.y}`,
                        fill: '#fde68a',
                        fillOpacity: 0.55,
                        stroke: 'none',
                        pointerEvents: 'none'
                    })
                );
            }

            if (shape.showHiddenLines) {
                grp.push(
                    React.createElement('line', {
                        key: 'pyr3-hid',
                        x1: T0.x,
                        y1: T0.y,
                        x2: T2.x,
                        y2: T2.y,
                        stroke: color,
                        strokeWidth: strokeWidth * 0.85,
                        strokeDasharray: '5,4'
                    })
                );
            }
            if (shape.showPerpendicularHeight) {
                grp.push(
                    React.createElement('circle', {
                        key: 'pyr3-bc',
                        cx: baseCenter.x,
                        cy: baseCenter.y,
                        r: 3,
                        fill: color
                    }),
                    React.createElement('line', {
                        key: 'pyr3-ph',
                        x1: apex.x,
                        y1: apex.y,
                        x2: baseCenter.x,
                        y2: baseCenter.y,
                        stroke: '#dc2626',
                        strokeWidth: 1.5,
                        strokeDasharray: '5,4'
                    })
                );
            }
            if (shape.showApothemLine || shape.showSlantHeight) {
                grp.push(
                    React.createElement('line', {
                        key: 'pyr3-apo',
                        x1: baseCenter.x,
                        y1: baseCenter.y,
                        x2: rightMid.x,
                        y2: rightMid.y,
                        stroke: '#0284c7',
                        strokeWidth: 1.4,
                        strokeDasharray: '4,3'
                    })
                );
            }
            if (shape.showPerpendicularHeight && (shape.showApothemLine || shape.showSlantHeight)) {
                grp.push(
                    renderRightAngleMarker3D(
                        baseCenter,
                        getVector(baseCenter, apex),
                        getVector(baseCenter, rightMid),
                        9,
                        '#dc2626'
                    )
                );
            }
            if (shape.showSlantHeight) {
                grp.push(
                    React.createElement('line', {
                        key: 'pyr3-slant',
                        x1: apex.x,
                        y1: apex.y,
                        x2: rightMid.x,
                        y2: rightMid.y,
                        stroke: '#059669',
                        strokeWidth: 1.6,
                        strokeDasharray: '5,3'
                    }),
                    renderRightAngleMarker3D(
                        rightMid,
                        getVector(rightMid, apex),
                        getVector(rightMid, T1),
                        9,
                        '#059669'
                    )
                );
            }

            const vis = [
                [T0, T1],
                [T1, T2],
                [apex, T0],
                [apex, T1],
                [apex, T2]
            ];
            vis.forEach(([p1, p2], idx) => {
                grp.push(
                    React.createElement('line', {
                        key: `pyr3-vis-${idx}`,
                        x1: p1.x,
                        y1: p1.y,
                        x2: p2.x,
                        y2: p2.y,
                        stroke: color,
                        strokeWidth,
                        strokeLinecap: 'round',
                        pointerEvents: 'none'
                    })
                );
            });

            els.push(
                React.createElement('g', { key: `pyr3-grp-${shape.id}`, transform: groupTransform3D }, ...grp)
            );

            if (shouldRenderHandles) {
                const hApex = rot3D(apex);
                const hBase = rot3D(T1);
                const hDepth = rot3D(T2);
                els.push(
                    renderResizeHandle(
                        hApex.x,
                        hApex.y,
                        'pyr-apex',
                        callbacks.onHandleDrag,
                        '#dc2626',
                        'diamond',
                        'Drag Pyramid Apex'
                    ),
                    renderResizeHandle(
                        hBase.x,
                        hBase.y,
                        'pyr-base',
                        callbacks.onHandleDrag,
                        '#2563eb',
                        'square',
                        'Drag Base Width'
                    ),
                    renderResizeHandle(
                        hDepth.x,
                        hDepth.y,
                        'pyr-depth',
                        callbacks.onHandleDrag,
                        '#d97706',
                        'circle',
                        'Drag Base Perspective Skew'
                    )
                );
            }

            shape.labels.forEach(lbl => {
                if (lbl.hidden) return;
                if (lbl.customKey === 'height' && !shape.showPerpendicularHeight) return;
                if (lbl.customKey === 'slant-height' && !shape.showSlantHeight && !lbl.showDimensionLine) return;
                let pos = { x: cx, y: cy };
                if (lbl.customKey === 'base-width') pos = { x: (T0.x + T1.x) / 2, y: T0.y + 20 };
                else if (lbl.customKey === 'base-depth') pos = { x: (T1.x + T2.x) / 2 + 20, y: (T1.y + T2.y) / 2 + 10 };
                else if (lbl.customKey === 'height') pos = { x: (apex.x + baseCenter.x) / 2 - 16, y: (apex.y + baseCenter.y) / 2 };
                else if (lbl.customKey === 'slant-height') pos = { x: (apex.x + rightMid.x) / 2 + 18, y: (apex.y + rightMid.y) / 2 };
                else if (lbl.customKey === 'right-slant-edge') pos = { x: (apex.x + T2.x) / 2 + 20, y: (apex.y + T2.y) / 2 };
                const rPos = rot3D(pos);
                renderLabelWithOptionalDimension(lbl, rPos);
            });
        }

        return els;
    }

    return els;
};

