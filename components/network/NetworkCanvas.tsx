import React, { MouseEvent as ReactMouseEvent } from 'react';
import { RotateCw } from 'lucide-react';
import {
    NetworkNode,
    NetworkEdge,
    NetworkCut,
    NetworkMode
} from '../../utils/networkLogic';

interface NetworkCanvasProps {
    svgRef: React.RefObject<SVGSVGElement | null>;
    canvasWidth: number;
    canvasHeight: number;
    previewScale: number;
    customViewBox: string | null;
    mode: NetworkMode;
    nodes: NetworkNode[];
    edges: NetworkEdge[];
    cuts: NetworkCut[];
    selectedNodes: string[];
    selectedEdges: string[];
    selectedCuts: string[];
    singleSelectedCut: string | null;
    edgeStartNode: string | null;
    hoveredNode: string | null;
    setHoveredNode: (nodeId: string | null) => void;
    mousePos: { x: number; y: number } | null;
    selectionBox: { startX: number; startY: number; currentX: number; currentY: number } | null;
    cropMode: boolean;
    cropSelectionBox: { x: number; y: number; w: number; h: number } | null;
    globalEdgeThickness: number;
    globalNodeRadius: number;
    globalEdgeLabelProximity: number;
    scaledFontSize: number;
    debugEdgeLabels: boolean;
    onSvgPointerDown: (e: ReactMouseEvent) => void;
    onCanvasContextMenu: (e: ReactMouseEvent) => void;
    onNodePointerDown: (e: ReactMouseEvent, nodeId: string) => void;
    onNodeContextMenu: (e: ReactMouseEvent, nodeId: string) => void;
    onNodeLabelPointerDown: (e: ReactMouseEvent, nodeId: string) => void;
    onEdgePointerDown: (e: ReactMouseEvent, edgeId: string) => void;
    onEdgeContextMenu: (e: ReactMouseEvent, edgeId: string) => void;
    onEdgeCPPointerDown: (e: ReactMouseEvent, edgeId: string) => void;
    onEdgeLabelPointerDown: (e: ReactMouseEvent, edgeId: string) => void;
    onCutPointerDown: (e: ReactMouseEvent, cutId: string) => void;
    onCutContextMenu: (e: ReactMouseEvent, cutId: string) => void;
    onCutLabelPointerDown: (e: ReactMouseEvent, cutId: string) => void;
    onCutElementPointerDown: (
        e: ReactMouseEvent,
        cutId: string,
        nodeId: string,
        type: 'node' | 'cp1' | 'cp2'
    ) => void;
}

export const NetworkCanvas: React.FC<NetworkCanvasProps> = ({
    svgRef,
    canvasWidth,
    canvasHeight,
    previewScale,
    customViewBox,
    mode,
    nodes,
    edges,
    cuts,
    selectedNodes,
    selectedEdges,
    selectedCuts,
    singleSelectedCut,
    edgeStartNode,
    hoveredNode,
    setHoveredNode,
    mousePos,
    selectionBox,
    cropMode,
    cropSelectionBox,
    globalEdgeThickness,
    globalNodeRadius,
    globalEdgeLabelProximity,
    scaledFontSize,
    debugEdgeLabels,
    onSvgPointerDown,
    onCanvasContextMenu,
    onNodePointerDown,
    onNodeContextMenu,
    onNodeLabelPointerDown,
    onEdgePointerDown,
    onEdgeContextMenu,
    onEdgeCPPointerDown,
    onEdgeLabelPointerDown,
    onCutPointerDown,
    onCutContextMenu,
    onCutLabelPointerDown,
    onCutElementPointerDown
}) => {
    const renderCut = (cut: NetworkCut) => {
        const isSelected = selectedCuts.includes(cut.id) || singleSelectedCut === cut.id;
        const pathParts: string[] = [];
        if (cut.nodes.length > 0) {
            pathParts.push(`M ${cut.nodes[0].x} ${cut.nodes[0].y}`);
            for (let i = 0; i < cut.nodes.length - 1; i++) {
                const n1 = cut.nodes[i];
                const n2 = cut.nodes[i + 1];
                const cp1x = n1.x + n1.cp2x;
                const cp1y = n1.y + n1.cp2y;
                const cp2x = n2.x + n2.cp1x;
                const cp2y = n2.y + n2.cp1y;
                pathParts.push(`C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${n2.x} ${n2.y}`);
            }
        }
        const pathD = pathParts.join(' ');

        let labelX = 0;
        let labelY = 0;
        if (cut.nodes.length > 0) {
            const lastNode = cut.nodes[cut.nodes.length - 1];
            labelX = lastNode.x;
            labelY = lastNode.y - 15;
        }

        const labelOffsetX = cut.labelOffset?.x || 0;
        const labelOffsetY = cut.labelOffset?.y || 0;

        return (
            <g key={cut.id} onContextMenu={e => onCutContextMenu(e, cut.id)}>
                <path
                    d={pathD}
                    fill="none"
                    stroke="transparent"
                    strokeWidth="15"
                    style={{ cursor: 'pointer' }}
                    onPointerDown={e => onCutPointerDown(e, cut.id)}
                />
                <path
                    d={pathD}
                    fill="none"
                    stroke={isSelected ? '#4f46e5' : 'black'}
                    strokeWidth={globalEdgeThickness + 0.5}
                    strokeDasharray="8,6"
                    style={{ pointerEvents: 'none' }}
                />

                {cut.label && (
                    <text
                        x={labelX + labelOffsetX}
                        y={labelY - 10 + labelOffsetY}
                        textAnchor="middle"
                        fill={isSelected ? '#4f46e5' : 'black'}
                        fontSize={scaledFontSize}
                        style={{ cursor: 'move', userSelect: 'none', fontFamily: 'Times New Roman' }}
                        onPointerDown={e => onCutLabelPointerDown(e, cut.id)}
                    >
                        {cut.label}
                    </text>
                )}
            </g>
        );
    };

    const renderCutHandles = (cut: NetworkCut) => {
        const isSelected = selectedCuts.includes(cut.id) || singleSelectedCut === cut.id;
        if (!isSelected) return null;

        return (
            <g key={`handles-${cut.id}`}>
                {cut.nodes.map((n, i) => (
                    <g key={n.id}>
                        <circle
                            cx={n.x}
                            cy={n.y}
                            r={globalNodeRadius}
                            fill="#4f46e5"
                            stroke="white"
                            strokeWidth={globalEdgeThickness}
                            style={{ cursor: 'move' }}
                            onPointerDown={e => onCutElementPointerDown(e, cut.id, n.id, 'node')}
                        />

                        {i > 0 && (
                            <>
                                <line
                                    x1={n.x}
                                    y1={n.y}
                                    x2={n.x + n.cp1x}
                                    y2={n.y + n.cp1y}
                                    stroke="#a5b4fc"
                                    strokeWidth="1.5"
                                    strokeDasharray="3,3"
                                />
                                <circle
                                    cx={n.x + n.cp1x}
                                    cy={n.y + n.cp1y}
                                    r="5"
                                    fill="#c7d2fe"
                                    stroke="#4f46e5"
                                    strokeWidth="1.5"
                                    style={{ cursor: 'pointer' }}
                                    onPointerDown={e => onCutElementPointerDown(e, cut.id, n.id, 'cp1')}
                                />
                            </>
                        )}

                        {i < cut.nodes.length - 1 && (
                            <>
                                <line
                                    x1={n.x}
                                    y1={n.y}
                                    x2={n.x + n.cp2x}
                                    y2={n.y + n.cp2y}
                                    stroke="#a5b4fc"
                                    strokeWidth="1.5"
                                    strokeDasharray="3,3"
                                />
                                <circle
                                    cx={n.x + n.cp2x}
                                    cy={n.y + n.cp2y}
                                    r="5"
                                    fill="#c7d2fe"
                                    stroke="#4f46e5"
                                    strokeWidth="1.5"
                                    style={{ cursor: 'pointer' }}
                                    onPointerDown={e => onCutElementPointerDown(e, cut.id, n.id, 'cp2')}
                                />
                            </>
                        )}
                    </g>
                ))}
            </g>
        );
    };

    const renderEdge = (edge: NetworkEdge) => {
        const fromNode = nodes.find(n => n.id === edge.from);
        const toNode = nodes.find(n => n.id === edge.to);
        if (!fromNode || !toNode) return null;

        const isSelected = selectedEdges.includes(edge.id);
        let path = '';
        let midX = 0;
        let midY = 0;
        let arrowAngle = 0;

        if (edge.isLoop) {
            const peakX = edge.cp1 ? edge.cp1.x : fromNode.x;
            const peakY = edge.cp1 ? edge.cp1.y : fromNode.y - 60;

            const dx = peakX - fromNode.x;
            const dy = peakY - fromNode.y;
            let dist = Math.hypot(dx, dy);
            if (dist < 5) dist = 60;

            const ux = dx / dist;
            const uy = dy / dist;
            const vx = -uy;
            const vy = ux;

            const ra = dist / 2;
            const rb = ra * (edge.loopRadiusY !== undefined ? edge.loopRadiusY : 1.0);

            const cx = fromNode.x + ra * ux;
            const cy = fromNode.y + ra * uy;

            const numSegments = 64;
            const pathPoints: string[] = [];
            for (let i = 0; i <= numSegments; i++) {
                const t = -Math.PI / 2 + (i / numSegments) * (2 * Math.PI);
                const px = cx + rb * Math.cos(t) * vx + ra * Math.sin(t) * ux;
                const py = cy + rb * Math.cos(t) * vy + ra * Math.sin(t) * uy;
                pathPoints.push(`${i === 0 ? 'M' : 'L'} ${px.toFixed(2)} ${py.toFixed(2)}`);
            }
            path = pathPoints.join(' ') + ' Z';

            arrowAngle = (Math.atan2(ux, -uy) * 180) / Math.PI;
            midX = peakX;
            midY = peakY;

            const ldist = Math.hypot(dx, dy) || 1;
            const defOffX = (dx / ldist) * globalEdgeLabelProximity;
            const defOffY = (dy / ldist) * globalEdgeLabelProximity;
            const labelOff = {
                x: defOffX + (edge.labelOffset?.x || 0),
                y: defOffY + (edge.labelOffset?.y || 0)
            };

            return (
                <g
                    key={edge.id}
                    onPointerDown={e => onEdgePointerDown(e, edge.id)}
                    onContextMenu={e => onEdgeContextMenu(e, edge.id)}
                >
                    <path d={path} fill="none" stroke="transparent" strokeWidth="20" />
                    <path
                        d={path}
                        fill="none"
                        stroke={isSelected ? '#4f46e5' : 'black'}
                        strokeWidth={globalEdgeThickness}
                        strokeDasharray={edge.isDummy ? '6,6' : 'none'}
                    />

                    {edge.isDirected && (
                        <polygon
                            points="-6,-6 6,0 -6,6"
                            fill={isSelected ? '#4f46e5' : 'black'}
                            transform={`translate(${fromNode.x}, ${fromNode.y}) rotate(${arrowAngle}) translate(${fromNode.radius + 6}, 0)`}
                            style={{ pointerEvents: 'none' }}
                        />
                    )}

                    {isSelected && (
                        <g
                            transform={`translate(${peakX}, ${peakY})`}
                            onPointerDown={e => onEdgeCPPointerDown(e, edge.id)}
                            style={{ cursor: 'grab' }}
                        >
                            <circle r={10} fill="white" stroke="#4f46e5" strokeWidth="1.5" />
                            <RotateCw size={12} color="#4f46e5" style={{ transform: 'translate(-6px, -6px)' }} />
                        </g>
                    )}

                    {edge.label && (
                        <g
                            transform={`translate(${midX + labelOff.x}, ${midY + labelOff.y})`}
                            onPointerDown={e => onEdgeLabelPointerDown(e, edge.id)}
                            style={{ cursor: mode === 'select' ? 'move' : 'default' }}
                        >
                            <text
                                textAnchor="middle"
                                dominantBaseline="central"
                                fontSize={scaledFontSize}
                                fontFamily="Times New Roman, serif"
                                fill="black"
                                stroke="white"
                                strokeWidth="4"
                                strokeLinejoin="round"
                                paintOrder="stroke fill"
                                style={{ userSelect: 'none' }}
                            >
                                {edge.label}
                            </text>
                        </g>
                    )}
                </g>
            );
        } else if (edge.isCurve && edge.cp1) {
            path = `M ${fromNode.x} ${fromNode.y} Q ${edge.cp1.x} ${edge.cp1.y} ${toNode.x} ${toNode.y}`;
            midX = 0.25 * fromNode.x + 0.5 * edge.cp1.x + 0.25 * toNode.x;
            midY = 0.25 * fromNode.y + 0.5 * edge.cp1.y + 0.25 * toNode.y;
            const dx = toNode.x - fromNode.x;
            const dy = toNode.y - fromNode.y;
            arrowAngle = (Math.atan2(dy, dx) * 180) / Math.PI;
        } else {
            path = `M ${fromNode.x} ${fromNode.y} L ${toNode.x} ${toNode.y}`;
            midX = (fromNode.x + toNode.x) / 2;
            midY = (fromNode.y + toNode.y) / 2;
            const dx = toNode.x - fromNode.x;
            const dy = toNode.y - fromNode.y;
            arrowAngle = (Math.atan2(dy, dx) * 180) / Math.PI;
        }

        const graphCenterX =
            nodes.length > 0 ? nodes.reduce((sum, n) => sum + n.x, 0) / nodes.length : canvasWidth / 2;
        const graphCenterY =
            nodes.length > 0 ? nodes.reduce((sum, n) => sum + n.y, 0) / nodes.length : canvasHeight / 2;

        const edx = toNode.x - fromNode.x;
        const edy = toNode.y - fromNode.y;
        const eDist = Math.hypot(edx, edy) || 1;
        const ux = edx / eDist;
        const uy = edy / eDist;

        const normX = -uy;
        const normY = ux;

        const vcx = midX - graphCenterX;
        const vcy = midY - graphCenterY;

        const dot = normX * vcx + normY * vcy;
        const outX = dot >= 0 ? normX : -normX;
        const outY = dot >= 0 ? normY : -normY;

        const defOffX = outX * globalEdgeLabelProximity;
        const defOffY = outY * globalEdgeLabelProximity;
        const labelOff = {
            x: defOffX + (edge.labelOffset?.x || 0),
            y: defOffY + (edge.labelOffset?.y || 0)
        };

        return (
            <g
                key={edge.id}
                onPointerDown={e => onEdgePointerDown(e, edge.id)}
                onContextMenu={e => onEdgeContextMenu(e, edge.id)}
            >
                <path d={path} fill="none" stroke="transparent" strokeWidth="20" />
                <path
                    d={path}
                    fill="none"
                    stroke={isSelected ? '#4f46e5' : 'black'}
                    strokeWidth={globalEdgeThickness}
                    strokeDasharray={edge.isDummy ? '6,6' : 'none'}
                />

                {edge.isDirected && (
                    <polygon
                        points="-6,-6 6,0 -6,6"
                        fill={isSelected ? '#4f46e5' : 'black'}
                        transform={`translate(${midX}, ${midY}) rotate(${arrowAngle})`}
                        style={{ pointerEvents: 'none' }}
                    />
                )}

                {isSelected && edge.isCurve && edge.cp1 && (
                    <>
                        <line
                            x1={fromNode.x}
                            y1={fromNode.y}
                            x2={edge.cp1.x}
                            y2={edge.cp1.y}
                            stroke="gray"
                            strokeDasharray="3,3"
                        />
                        <line
                            x1={toNode.x}
                            y1={toNode.y}
                            x2={edge.cp1.x}
                            y2={edge.cp1.y}
                            stroke="gray"
                            strokeDasharray="3,3"
                        />
                        <circle
                            cx={edge.cp1.x}
                            cy={edge.cp1.y}
                            r={6}
                            fill="#4f46e5"
                            onPointerDown={e => onEdgeCPPointerDown(e, edge.id)}
                            style={{ cursor: 'move' }}
                        />
                    </>
                )}

                {edge.label && (
                    <g
                        transform={`translate(${midX + labelOff.x}, ${midY + labelOff.y})`}
                        onPointerDown={e => onEdgeLabelPointerDown(e, edge.id)}
                        style={{ cursor: mode === 'select' ? 'move' : 'default' }}
                    >
                        <text
                            textAnchor="middle"
                            dominantBaseline="central"
                            fontSize={scaledFontSize}
                            fontFamily="Times New Roman, serif"
                            fill="black"
                            stroke="white"
                            strokeWidth="4"
                            strokeLinejoin="round"
                            paintOrder="stroke fill"
                            style={{ userSelect: 'none' }}
                        >
                            {edge.label}
                        </text>
                    </g>
                )}
            </g>
        );
    };

    return (
        <div
            style={{
                width: canvasWidth * previewScale,
                height: canvasHeight * previewScale,
                margin: 'auto'
            }}
            className="relative shrink-0"
        >
            <div
                style={{
                    width: canvasWidth,
                    height: canvasHeight,
                    transform: `scale(${previewScale})`,
                    transformOrigin: 'top left'
                }}
                className="bg-white shadow-sm border border-gray-300 rounded-sm absolute top-0 left-0 overflow-hidden"
                id="network-canvas"
            >
                <svg
                    id="network-canvas-svg"
                    ref={svgRef}
                    width={canvasWidth}
                    height={canvasHeight}
                    viewBox={customViewBox || `0 0 ${canvasWidth} ${canvasHeight}`}
                    xmlns="http://www.w3.org/2000/svg"
                    className="w-full h-full"
                    style={{
                        cursor: mode === 'addNode' ? 'crosshair' : mode === 'select' ? 'default' : 'crosshair',
                        background: '#ffffff'
                    }}
                    onPointerDown={onSvgPointerDown}
                    onContextMenu={onCanvasContextMenu}
                >
                    {/* Canvas Background for clean export */}
                    <rect width={canvasWidth} height={canvasHeight} fill="#ffffff" />

                    {/* Preview edge when adding */}
                    {edgeStartNode &&
                        ['addEdge', 'addDirectedEdge', 'addDummyEdge'].includes(mode) &&
                        mousePos &&
                        (() => {
                            const startNode = nodes.find(n => n.id === edgeStartNode);
                            if (!startNode) return null;
                            const endX = hoveredNode
                                ? nodes.find(n => n.id === hoveredNode)?.x ?? mousePos.x
                                : mousePos.x;
                            const endY = hoveredNode
                                ? nodes.find(n => n.id === hoveredNode)?.y ?? mousePos.y
                                : mousePos.y;
                            return (
                                <line
                                    x1={startNode.x}
                                    y1={startNode.y}
                                    x2={endX}
                                    y2={endY}
                                    stroke="#4f46e5"
                                    strokeWidth={globalEdgeThickness}
                                    strokeDasharray="5,5"
                                    opacity="0.5"
                                    pointerEvents="none"
                                />
                            );
                        })()}

                    {/* Render cuts */}
                    {cuts.map(renderCut)}

                    {/* Render edges */}
                    {edges.map(renderEdge)}

                    {/* Render nodes */}
                    {nodes.map(node => {
                        const isStartNode = edgeStartNode === node.id;
                        const isHovered =
                            hoveredNode === node.id &&
                            ['addEdge', 'addDirectedEdge', 'addDummyEdge'].includes(mode);
                        const isSelected = selectedNodes.includes(node.id);
                        const isHighlighted = isStartNode || isHovered || isSelected;

                        return (
                            <g
                                key={node.id}
                                transform={`translate(${node.x}, ${node.y})`}
                                onPointerEnter={() => setHoveredNode(node.id)}
                                onPointerLeave={() => setHoveredNode(null)}
                                onContextMenu={e => onNodeContextMenu(e, node.id)}
                            >
                                <circle
                                    cx={0}
                                    cy={0}
                                    r={node.radius}
                                    fill={node.labelStyle === 'inside' ? 'white' : 'black'}
                                    stroke={isHighlighted ? '#4f46e5' : 'black'}
                                    strokeWidth={
                                        isHighlighted
                                            ? Math.max(3, globalEdgeThickness + 1)
                                            : globalEdgeThickness
                                    }
                                    onPointerDown={e => onNodePointerDown(e, node.id)}
                                    style={{ cursor: mode === 'select' ? 'move' : 'crosshair' }}
                                />

                                {node.labelStyle === 'inside' && node.label && (
                                    <text
                                        textAnchor="middle"
                                        dominantBaseline="central"
                                        fontSize={scaledFontSize}
                                        fontFamily="Times New Roman, serif"
                                        fill="black"
                                        pointerEvents="none"
                                    >
                                        {node.label}
                                    </text>
                                )}

                                {node.labelStyle === 'outside' && node.label && (
                                    <g
                                        transform={`translate(${node.labelOffset.x}, ${node.labelOffset.y})`}
                                        style={{ cursor: mode === 'select' ? 'move' : 'default' }}
                                        onPointerDown={e => onNodeLabelPointerDown(e, node.id)}
                                    >
                                        <rect x="-15" y="-15" width="30" height="30" fill="white" fillOpacity="0" />
                                        <text
                                            textAnchor="middle"
                                            dominantBaseline="central"
                                            fontSize={scaledFontSize}
                                            fontFamily="Times New Roman, serif"
                                            fill="black"
                                            style={{ userSelect: 'none' }}
                                        >
                                            {node.label}
                                        </text>
                                    </g>
                                )}
                            </g>
                        );
                    })}

                    {/* Render Cut Handles Topmost */}
                    {cuts.map(renderCutHandles)}

                    {/* Render Selection Box */}
                    {selectionBox && (
                        <rect
                            x={Math.min(selectionBox.startX, selectionBox.currentX)}
                            y={Math.min(selectionBox.startY, selectionBox.currentY)}
                            width={Math.abs(selectionBox.currentX - selectionBox.startX)}
                            height={Math.abs(selectionBox.currentY - selectionBox.startY)}
                            fill="#4f46e5"
                            fillOpacity="0.1"
                            stroke="#4f46e5"
                            strokeWidth="1"
                            pointerEvents="none"
                        />
                    )}

                    {/* Physics Debug Overlay */}
                    {debugEdgeLabels &&
                        edges.map(e => {
                            if (!e.label) return null;
                            const fn = nodes.find(n => n.id === e.from);
                            const tn = nodes.find(n => n.id === e.to);
                            if (!fn || !tn) return null;
                            let midX = 0;
                            let midY = 0;
                            let dx = 0;
                            let dy = 0;
                            if (e.isLoop) {
                                midX = e.cp1 ? e.cp1.x : fn.x;
                                midY = e.cp1 ? e.cp1.y : fn.y - 60;
                                dx = 1;
                                dy = 0;
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

                            const len = Math.hypot(dx, dy) || 1;
                            const tx = dx / len;
                            const ty = dy / len;
                            const nx = -ty;
                            const ny = tx;

                            const graphCenterX =
                                nodes.length > 0
                                    ? nodes.reduce((sum, n) => sum + n.x, 0) / nodes.length
                                    : canvasWidth / 2;
                            const graphCenterY =
                                nodes.length > 0
                                    ? nodes.reduce((sum, n) => sum + n.y, 0) / nodes.length
                                    : canvasHeight / 2;
                            const edx = tn.x - fn.x;
                            const edy = tn.y - fn.y;
                            const eDist = Math.hypot(edx, edy) || 1;
                            const ux = edx / eDist;
                            const uy = edy / eDist;
                            const normX = -uy;
                            const normY = ux;
                            const vcx = midX - graphCenterX;
                            const vcy = midY - graphCenterY;
                            const dot = normX * vcx + normY * vcy;
                            const outX = dot >= 0 ? normX : -normX;
                            const outY = dot >= 0 ? normY : -normY;
                            const defOffX = e.isLoop
                                ? (dx / len) * globalEdgeLabelProximity
                                : outX * globalEdgeLabelProximity;
                            const defOffY = e.isLoop
                                ? (dy / len) * globalEdgeLabelProximity
                                : outY * globalEdgeLabelProximity;

                            const lx = midX + defOffX + (e.labelOffset?.x || 0);
                            const ly = midY + defOffY + (e.labelOffset?.y || 0);

                            const lw = Math.max(20, e.label.length * 8);
                            const lh = 16;

                            const px1 = midX - nx * 100;
                            const py1 = midY - ny * 100;
                            const px2 = midX + nx * 100;
                            const py2 = midY + ny * 100;

                            return (
                                <g key={`debug-${e.id}`} pointerEvents="none">
                                    <line
                                        x1={px1}
                                        y1={py1}
                                        x2={px2}
                                        y2={py2}
                                        stroke="red"
                                        strokeWidth="1"
                                        strokeDasharray="4 4"
                                        opacity={0.5}
                                    />
                                    <circle cx={lx} cy={ly} r="3" fill="blue" />
                                    <rect
                                        x={lx - lw / 2}
                                        y={ly - lh / 2}
                                        width={lw}
                                        height={lh}
                                        fill="none"
                                        stroke="blue"
                                        strokeWidth="1"
                                        strokeDasharray="2 2"
                                        opacity={0.5}
                                    />
                                </g>
                            );
                        })}

                    {/* Crop Overlay inside SVG */}
                    {cropMode && cropSelectionBox && (
                        <rect
                            x={cropSelectionBox.x}
                            y={cropSelectionBox.y}
                            width={cropSelectionBox.w}
                            height={cropSelectionBox.h}
                            fill="rgba(59, 130, 246, 0.2)"
                            stroke="#2563eb"
                            strokeWidth={2 / previewScale}
                            strokeDasharray={`${5 / previewScale},${5 / previewScale}`}
                            pointerEvents="none"
                        />
                    )}
                </svg>
            </div>
        </div>
    );
};
