/*
 * Comprehensive Shape Builder Type Definitions
 * Supports Basic 2D, Composite 2D, and 3D Perspective Shapes
 */

export type ShapeCategory = '2d-basic' | '2d-composite' | '3d';

export type ShapeType =
    // 1. Basic 2D Shapes
    | 'triangle'
    | 'rectangle'
    | 'polygon'
    | 'circle'
    // 2. Composite 2D Shapes
    | 'l-shape'
    | 'norman-window'
    | 'stadium'
    | 'annulus'
    | 'house'
    | 'inscribed-circle'
    // 3. 3D Shapes (Rendered in 2D Perspective)
    | 'prism'
    | 'cylinder'
    | 'cone'
    | 'sphere'
    | 'pyramid';

export type DecorationType =
    | 'none'
    | 'tick'
    | 'double-tick'
    | 'triple-tick'
    | 'arrow'
    | 'double-arrow'
    | 'arrow-reverse';

export type AngleType =
    | 'none'
    | 'arc'
    | 'double-arc'
    | 'triple-arc'
    | 'right'
    | 'label';

export type RearCurveMode = 'dashed' | 'solid' | 'hidden';

// A single label attached to a shape
export interface ShapeLabel {
    id: string;
    text: string; // LaTeX supported e.g. "$30^\circ$", "$h$", "$12\text{ cm}$"
    type: 'center' | 'edge' | 'vertex' | 'radius' | 'custom';
    index?: number; // Which edge/vertex (0, 1, 2...)
    customKey?: string; // e.g. 'altitude', 'apothem', 'total-height', 'slant-height', 'inner-radius', 'outer-radius', 'sector-angle', 'diagonal-1', 'diagonal-2'
    offsetX: number;
    offsetY: number;
    color: string;
    fontSize: number;
    hidden?: boolean;
    showDimensionLine?: boolean; // Renders external extension/witness lines + double-arrow dimension line (<--->)
    dimensionOffset?: number; // Custom perpendicular distance for the dimension line (default 24)
}

export interface StraightEdgeDescriptor {
    key: string; // e.g. 'edge-0' or 'width' or 'slant-height'
    name: string; // Human-readable name e.g. 'Top Side', 'Slant Height (l)', 'Base Width'
    labelType?: 'edge' | 'custom';
    edgeIndex?: number;
    customKey?: string;
    p1: { x: number; y: number };
    p2: { x: number; y: number };
    normal: { x: number; y: number };
    defaultOffset?: number;
}

// Decorations on edges (ticks, parallel arrows)
export interface EdgeDecoration {
    edgeIndex: number;
    type: DecorationType;
}

// Decorations on vertices (angle arcs, right-angle squares, labels)
export interface VertexDecoration {
    vertexIndex: number;
    type: AngleType;
    label?: string; // e.g. "$30^\circ$" or "$\theta$"
    showExterior?: boolean;
}

// Base Shape Interface
export interface BaseShape {
    id: string;
    type: ShapeType;
    x: number; // Center X in SVG canvas coords
    y: number; // Center Y in SVG canvas coords
    rotation: number; // Degrees

    // Style
    stroke: string;
    fill: string;
    shadeColor: string; // For sub-region shading (sectors, faces, segments)
    strokeWidth: number;
    opacity: number;

    // Dimensions & Notations
    showDimensions?: boolean;
    dimensionPlacement?: 'inside' | 'outside';
    hiddenDimensions?: number[]; // Edge indices whose dimension/label is hidden (missing dimensions)

    // Attachments
    labels: ShapeLabel[];
    edgeDecorations: EdgeDecoration[];
    vertexDecorations: VertexDecoration[];
}

// --- 1. BASIC 2D SHAPES ---

export interface TriangleDef extends BaseShape {
    type: 'triangle';
    // 3 vertices relative to (x, y) unrotated
    vertices: [
        { x: number; y: number },
        { x: number; y: number },
        { x: number; y: number }
    ];
    showAltitude?: boolean;
    altitudeVertexIndex?: number; // 0, 1, or 2 (defaults to 0 = top apex)
    showAltitudeRightAngle?: boolean;
}

export interface RectangleDef extends BaseShape {
    type: 'rectangle';
    width: number;
    height: number;
    sideLinkMode?: 'rectangle' | 'square'; // Keep opposite equal vs lock all 4 for square
    showDiagonals?: 'none' | 'one' | 'both';
    diagonalStyle?: 'dashed' | 'solid';
    showCenterDot?: boolean;
}

export interface PolygonDef extends BaseShape {
    type: 'polygon';
    sides: number; // 3 to 12
    radius: number;
    irregularOffsets?: { dx: number; dy: number }[]; // Optional per-vertex offset for irregular polygons
    customVertices?: { x: number; y: number }[]; // Explicit vertex coordinates (e.g. Parallelogram, Trapezium, Rhombus, Kite)
    showCenterDot?: boolean;
    showRadiusLine?: boolean;
    showApothem?: boolean;
    showAltitude?: boolean; // Perpendicular height line (e.g. Parallelogram, Trapezium)
    altitudeVertexIndex?: number; // Vertex index from which to drop altitude (default 0)
    altitudeBaseEdgeIndex?: number; // Edge index onto which altitude drops (default 2)
    showDiagonals?: boolean; // Connect opposite vertices (e.g. Rhombus, Kite)
    showDiagonalRightAngle?: boolean; // Right-angle square at diagonal intersection (Rhombus, Kite)
    shadedSectors?: number[]; // Indices of triangular sectors shaded (0 .. sides-1)
    exteriorExtensionLength?: number; // If > 0, extends edges outward to show exterior angles
    exteriorAngles?: number[]; // Indices of vertices showing exterior angle arc
}

export interface CircleDef extends BaseShape {
    type: 'circle';
    radius: number;
    showCenter: boolean;
    showRadiusLine: boolean;
    radiusAngle: number; // Degrees
    showDiameterLine: boolean;
    diameterAngle: number; // Degrees
    // Sector / Arc controls
    isSector?: boolean;
    sectorStartAngle: number; // Degrees (e.g. -30)
    sectorEndAngle: number; // Degrees (e.g. 60)
    showSectorAngleArc?: boolean;
    sectorAngleLabel?: string; // e.g. "$\theta$"
    shadeMode?: 'none' | 'minor-sector' | 'major-sector' | 'segment';
    highlightArc?: boolean;
    arcHighlightColor?: string;
    // Chord & Segment controls
    showChord?: boolean;
    chordStartAngle: number;
    chordEndAngle: number;
}

// --- 2. COMPOSITE 2D SHAPES ---

export interface LShapeDef extends BaseShape {
    type: 'l-shape';
    outerWidth: number;
    outerHeight: number;
    cutWidth: number; // Inner step width from right
    cutHeight: number; // Inner step height from top
    scaffoldingMode: 'none' | 'vertical' | 'horizontal' | 'both';
}

export interface NormanWindowDef extends BaseShape {
    type: 'norman-window';
    width: number; // Width of rectangle and diameter of flush top semicircle (r = width / 2)
    rectHeight: number; // Height of rectangular base
    showSpringingLine: boolean; // Dashed horizontal divider between rectangle and semicircle
    showRadiusLine: boolean; // Radius line inside top semicircle
    showTotalHeightDimension: boolean; // External total height bracket
}

export interface StadiumDef extends BaseShape {
    type: 'stadium';
    rectWidth: number;
    rectHeight: number; // Semicircle radius is locked to rectHeight / 2
    showInternalDividers: boolean;
    showRadiusLine: boolean;
    concentricLanes: number; // 0 to 4 outer lanes
    laneWidth: number;
    shadeTrackRing: boolean;
}

export interface AnnulusDef extends BaseShape {
    type: 'annulus';
    outerRadius: number;
    innerRadius: number;
    outerRadiusAngle: number;
    innerRadiusAngle: number;
    showCenterDot: boolean;
    showOuterRadiusLine: boolean;
    showInnerRadiusLine: boolean;
    shadeRing: boolean;
}

export interface HouseDef extends BaseShape {
    type: 'house';
    baseWidth: number;
    baseHeight: number;
    roofHeight: number;
    roofOverhang: number; // Extends triangle base past rectangle on both sides
    showCeilingLine: boolean;
    showRoofAltitude: boolean;
    showTotalHeightDimension: boolean;
}

export interface InscribedCircleDef extends BaseShape {
    type: 'inscribed-circle';
    size: number; // Side length of bounding square (circle diameter = size, radius = size / 2)
    shadeRegion: 'corners' | 'circle' | 'none'; // 'corners' shades Square minus Circle
    showCenterDot: boolean;
    showRadiusLine: boolean;
    radiusAngle: number;
    showDiameterLine: boolean;
    diameterAngle: number;
    showCornerRightAngles: boolean;
}

// --- 3. 3D SHAPES (2D PERSPECTIVE) ---

export interface PrismDef extends BaseShape {
    type: 'prism';
    width: number;
    height: number;
    depthX: number; // Perspective offset X
    depthY: number; // Perspective offset Y (usually negative for up-right)
    isCube?: boolean;
    showHiddenLines: boolean;
    shadedFaces: ('front' | 'top' | 'right' | 'left' | 'bottom' | 'back')[];
    showSpaceDiagonal: boolean;
    showBaseDiagonal: boolean;
    showPythagorasTriangle: boolean;
}

export interface CylinderDef extends BaseShape {
    type: 'cylinder';
    radius: number;
    height: number;
    ellipseRy: number; // Vertical squash of top/bottom ellipses
    rearCurveMode: RearCurveMode;
    showTopRadius: boolean;
    showTopDiameter: boolean;
    showBottomRadius: boolean;
    showAxisLine: boolean;
    showHeightDimension: boolean;
}

export interface ConeDef extends BaseShape {
    type: 'cone';
    radius: number;
    height: number;
    apexOffsetX: number; // 0 for right cone, non-zero for oblique
    ellipseRy: number;
    rearCurveMode: RearCurveMode;
    showPerpendicularHeight: boolean;
    showSlantHeightDimension: boolean;
    showBaseRadius: boolean;
    shadeInternalTriangle: boolean;
}

export interface SphereDef extends BaseShape {
    type: 'sphere';
    radius: number;
    equatorRy: number;
    rearCurveMode: RearCurveMode;
    showCenterDot: boolean;
    showRadiusLine: boolean;
    radiusAngle: number; // Degrees on equator or outer circle
    hemisphereMode: 'full' | 'bottom-hemisphere' | 'top-hemisphere';
}

export interface PyramidDef extends BaseShape {
    type: 'pyramid';
    baseType: 'square' | 'triangular';
    baseWidth: number;
    baseDepthX: number;
    baseDepthY: number;
    height: number;
    apexOffsetX: number; // Relative to base center
    showHiddenLines: boolean;
    showPerpendicularHeight: boolean;
    showSlantHeight: boolean;
    showApothemLine: boolean;
    shadeInternalTriangle: boolean;
    shadedFaces: number[];
}

export type ShapeDef =
    | TriangleDef
    | RectangleDef
    | PolygonDef
    | CircleDef
    | LShapeDef
    | NormanWindowDef
    | StadiumDef
    | AnnulusDef
    | HouseDef
    | InscribedCircleDef
    | PrismDef
    | CylinderDef
    | ConeDef
    | SphereDef
    | PyramidDef;

// For the renderer to consume
export interface RenderedEdge {
    p1: { x: number; y: number };
    p2: { x: number; y: number };
    index: number;
    normal: { x: number; y: number }; // Pointing outwards
    midpoint: { x: number; y: number };
    length: number;
    angle: number; // Radians
}

export interface RenderedVertex {
    p: { x: number; y: number };
    index: number;
    edgeInIndex: number;
    edgeOutIndex: number;
}

export interface SubElementSelection {
    shapeId: string;
    edges: number[];
    vertices: number[];
}
