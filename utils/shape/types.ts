
/*
 * Shape Builder Type Definitions
 */

export type ShapeType = 'rectangle' | 'circle' | 'triangle' | 'right-triangle';

export type DecorationType = 'none' | 'tick' | 'double-tick' | 'triple-tick' | 'arrow' | 'double-arrow' | 'arrow-reverse';
export type AngleType = 'none' | 'right' | 'arc' | 'double-arc';

// A single label attached to a shape
export interface ShapeLabel {
    id: string;
    text: string; // LaTeX supported
    
    // Attachment Logic
    type: 'center' | 'edge' | 'vertex' | 'radius'; 
    index?: number; // Which edge/vertex (0, 1, 2...)
    
    // Manual Offset (dragged by user)
    offsetX: number; 
    offsetY: number;
    
    // Styling
    color: string;
    fontSize: number;
}

// Decorations on edges (ticks, arrows)
export interface EdgeDecoration {
    edgeIndex: number;
    type: DecorationType;
}

// Decorations on vertices (angles)
export interface VertexDecoration {
    vertexIndex: number;
    type: AngleType;
    label?: string; // e.g. "30°"
}

// Base Shape Interface
export interface BaseShape {
    id: string;
    type: ShapeType;
    x: number; // Center X
    y: number; // Center Y
    rotation: number; // Degrees
    
    // Style
    stroke: string;
    fill: string;
    strokeWidth: number;
    opacity: number;

    // Attachments
    labels: ShapeLabel[];
    edgeDecorations: EdgeDecoration[];
    vertexDecorations: VertexDecoration[];
}

export interface RectangleDef extends BaseShape {
    type: 'rectangle';
    width: number;
    height: number;
    showDimensions?: boolean;
    dimensionPlacement?: 'inside' | 'outside'; // New property
}

export interface CircleDef extends BaseShape {
    type: 'circle';
    radius: number;
    showCenter: boolean;
    showRadiusLine: boolean;
    showDiameterLine: boolean;
}

export interface TriangleDef extends BaseShape {
    type: 'triangle';
    base: number;
    height: number;
    peakOffset: number; // How far right the peak is from the left base
    showAltitude?: boolean;
}

export interface RightTriangleDef extends BaseShape {
    type: 'right-triangle';
    base: number;
    height: number;
}

export type ShapeDef = RectangleDef | CircleDef | TriangleDef | RightTriangleDef;

// For the renderer to consume
export interface RenderedEdge {
    p1: { x: number, y: number };
    p2: { x: number, y: number };
    index: number;
    normal: { x: number, y: number }; // Pointing outwards
    midpoint: { x: number, y: number };
    length: number;
    angle: number; // Radians
}

export interface RenderedVertex {
    p: { x: number, y: number };
    index: number;
    // Pointers to adjacent edges for angle calculation
    edgeInIndex: number; 
    edgeOutIndex: number; 
}
