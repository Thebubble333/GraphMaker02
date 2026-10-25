import { ShapeDef, ShapeType, ShapeCategory, ShapeLabel } from './types';
import { ptToSvgUnits } from '../imageExport';

export interface ShapeCatalogEntry {
    type: ShapeType;
    label: string;
    category: ShapeCategory;
    shortDesc: string;
}

export const SHAPE_CATALOG: ShapeCatalogEntry[] = [
    // 1. Basic 2D Shapes
    { type: 'triangle', label: 'Triangles', category: '2d-basic', shortDesc: 'Right-angled, Isosceles, Equilateral, Acute Scalene & Obtuse with external altitude' },
    { type: 'rectangle', label: 'Rectangle / Square', category: '2d-basic', shortDesc: 'Corner right angles, algebra labels, side linking, diagonals & ticks' },
    { type: 'polygon', label: 'Quadrilaterals & Polygons', category: '2d-basic', shortDesc: 'Parallelogram, Trapezium, Rhombus, Kite & Regular Polygons (3–12)' },
    { type: 'circle', label: 'Circles, Sectors & Arcs', category: '2d-basic', shortDesc: 'Circle, Semicircle, Quadrant, Circular Sector, Chords & Segments' },

    // 2. Composite 2D Shapes (The Assessment Classics)
    { type: 'l-shape', label: 'L-Shape', category: '2d-composite', shortDesc: 'Compound rectangle with 4 given sides & 2 hidden missing sides' },
    { type: 'norman-window', label: 'Norman Window (Arch)', category: '2d-composite', shortDesc: 'Rectangle topped with a flush semicircle & springing line' },
    { type: 'stadium', label: 'Stadium (Running Track)', category: '2d-composite', shortDesc: 'Central rectangle flanked by two semicircles & track lanes' },
    { type: 'house', label: 'Gable (House Shape)', category: '2d-composite', shortDesc: 'Triangle mounted on a rectangle with ceiling split & total height' },
    { type: 'inscribed-circle', label: 'Inscribed Target', category: '2d-composite', shortDesc: 'Circle bounded inside a square with shaded corner regions' },
    { type: 'annulus', label: 'Annulus (Ring)', category: '2d-composite', shortDesc: 'Two concentric circles with shaded ring (R² − r²)' },

    // 3. 3D Shapes (2D Perspective)
    { type: 'prism', label: 'Prism / Cube', category: '3d', shortDesc: 'Hidden rear lines, perspective skew, face shading & 3D diagonal' },
    { type: 'cylinder', label: 'Cylinder', category: '3d', shortDesc: 'Linked elliptical bases, rear curve modes & height/radius' },
    { type: 'cone', label: 'Cone', category: '3d', shortDesc: 'Perpendicular vs slant height, 3D right angle & apex drag' },
    { type: 'sphere', label: 'Sphere / Hemisphere', category: '3d', shortDesc: 'Equatorial great circle, dashed rear curve & hemisphere slice' },
    { type: 'pyramid', label: 'Pyramid (Square/Tri)', category: '3d', shortDesc: 'Right/oblique apex, internal Pythagoras triangle & slant height' }
];

export const ESSENTIAL_2D_GROUPS = [
    'The Foundation: Triangles',
    'The Core Quadrilaterals',
    'Polygons & Circles',
    'The Assessment Classics'
] as const;

export type Essential2DGroup = (typeof ESSENTIAL_2D_GROUPS)[number];

// Declarative label input (omits auto-generated id, offsetX, offsetY, fontSize, color when default)
export type PresetLabelSpec = {
    text: string;
    type: ShapeLabel['type'];
    index?: number;
    customKey?: string;
    offsetX?: number;
    offsetY?: number;
    color?: string;
    showDimensionLine?: boolean;
    dimensionOffset?: number;
    hidden?: boolean;
};

export interface ShapePreset {
    id: string;
    name: string;
    shapeType: ShapeType;
    category: ShapeCategory;
    essentialGroup?: Essential2DGroup;
    essentialNumber?: number;
    badge?: string;
    description?: string;
    create: (x?: number, y?: number, fontSizePt?: number) => ShapeDef;
    build: (x?: number, y?: number, fontSizePt?: number) => ShapeDef;
}

const createBaseProps = (id: string, x: number, y: number) => ({
    id,
    x,
    y,
    rotation: 0,
    stroke: '#0f172a',
    fill: 'transparent',
    shadeColor: '#cbd5e1',
    strokeWidth: 1.75,
    opacity: 0.35,
    showDimensions: false,
    dimensionPlacement: 'outside' as const,
    hiddenDimensions: [] as number[],
    edgeDecorations: [],
    vertexDecorations: []
});

const hydrateLabels = (id: string, fs: number, specs: PresetLabelSpec[]): ShapeLabel[] =>
    specs.map((spec, idx) => ({
        id: `${id}-lbl-${idx}`,
        text: spec.text,
        type: spec.type,
        index: spec.index,
        customKey: spec.customKey,
        offsetX: spec.offsetX ?? 0,
        offsetY: spec.offsetY ?? 0,
        color: spec.color ?? '#0f172a',
        fontSize: fs,
        showDimensionLine: spec.showDimensionLine,
        dimensionOffset: spec.dimensionOffset,
        hidden: spec.hidden
    }));

/**
 * Helper to declaratively define a shape preset with minimal boilerplate.
 * Adding new presets or new shape templates only requires adding an entry to SHAPE_PRESETS below.
 */
export function defineShapePreset<T extends ShapeDef['type']>(config: {
    id: string;
    name: string;
    shapeType: T;
    category: ShapeCategory;
    essentialGroup?: Essential2DGroup;
    essentialNumber?: number;
    badge?: string;
    description?: string;
    props: Omit<Extract<ShapeDef, { type: T }>, keyof ReturnType<typeof createBaseProps> | 'type' | 'labels'> &
        Partial<Omit<ReturnType<typeof createBaseProps>, 'id' | 'x' | 'y'>>;
    labels: PresetLabelSpec[];
}): ShapePreset {
    const factory = (x: number = 283, y: number = 283, fontSizePt: number = 11): ShapeDef => {
        const uid = `shape-${Date.now()}-${Math.floor(Math.random() * 10000)}`;
        const fs = ptToSvgUnits(fontSizePt);
        const base = createBaseProps(uid, x, y);
        const clonedProps = JSON.parse(JSON.stringify(config.props));
        return {
            ...base,
            ...clonedProps,
            id: uid,
            type: config.shapeType,
            x,
            y,
            labels: hydrateLabels(uid, fs, config.labels)
        } as ShapeDef;
    };

    return {
        id: config.id,
        name: config.name,
        shapeType: config.shapeType,
        category: config.category,
        essentialGroup: config.essentialGroup,
        essentialNumber: config.essentialNumber,
        badge: config.badge,
        description: config.description,
        create: factory,
        build: factory
    };
}

/**
 * Master Declarative Preset Registry
 * Includes all 20 Essential 2D Shapes (grouped by curriculum assessment purpose) + 3D Solids.
 */
export const SHAPE_PRESETS: ShapePreset[] = [
    // =========================================================================
    // GROUP 1: THE FOUNDATION — TRIANGLES (#1 – #4)
    // =========================================================================

    // #1. Right-Angled Triangle
    defineShapePreset({
        id: 'tri-right',
        name: '1. Right-Angled Triangle',
        shapeType: 'triangle',
        category: '2d-basic',
        essentialGroup: 'The Foundation: Triangles',
        essentialNumber: 1,
        badge: 'Pythagoras / Trig',
        description: 'Standard textbook staple with base/height labels, right-angle square, and angle θ',
        props: {
            vertices: [
                { x: -90, y: -75 },
                { x: 100, y: 65 },
                { x: -90, y: 65 }
            ],
            showAltitude: false,
            vertexDecorations: [
                { vertexIndex: 2, type: 'right' },
                { vertexIndex: 1, type: 'label', label: '$\\theta$' }
            ]
        },
        labels: [
            { text: '13 cm', type: 'edge', index: 0, showDimensionLine: true },
            { text: '12 cm', type: 'edge', index: 1 },
            { text: '5 cm', type: 'edge', index: 2 }
        ]
    }),

    // #2a. Isosceles Triangle
    defineShapePreset({
        id: 'tri-isosceles',
        name: '2a. Isosceles Triangle',
        shapeType: 'triangle',
        category: '2d-basic',
        essentialGroup: 'The Foundation: Triangles',
        essentialNumber: 2,
        badge: 'Symmetry',
        description: 'Symmetrical default with single tick marks on equal sides and equal base angle arcs',
        props: {
            vertices: [
                { x: 0, y: -88 },
                { x: 90, y: 68 },
                { x: -90, y: 68 }
            ],
            showAltitude: false,
            edgeDecorations: [
                { edgeIndex: 0, type: 'tick' },
                { edgeIndex: 2, type: 'tick' }
            ],
            vertexDecorations: [
                { vertexIndex: 1, type: 'arc' },
                { vertexIndex: 2, type: 'arc' }
            ]
        },
        labels: [
            { text: '10 cm', type: 'edge', index: 0 },
            { text: '12 cm', type: 'edge', index: 1 }
        ]
    }),

    // #2b. Equilateral Triangle
    defineShapePreset({
        id: 'tri-equilateral',
        name: '2b. Equilateral Triangle',
        shapeType: 'triangle',
        category: '2d-basic',
        essentialGroup: 'The Foundation: Triangles',
        essentialNumber: 2,
        badge: '60° Equal',
        description: 'All 3 sides marked with single ticks and all 3 interior angles marked equal',
        props: {
            vertices: [
                { x: 0, y: -88 },
                { x: 95, y: 76 },
                { x: -95, y: 76 }
            ],
            showAltitude: false,
            edgeDecorations: [
                { edgeIndex: 0, type: 'tick' },
                { edgeIndex: 1, type: 'tick' },
                { edgeIndex: 2, type: 'tick' }
            ],
            vertexDecorations: [
                { vertexIndex: 0, type: 'arc' },
                { vertexIndex: 1, type: 'arc' },
                { vertexIndex: 2, type: 'arc' }
            ]
        },
        labels: [{ text: '$x$', type: 'edge', index: 1 }]
    }),

    // #3. Acute Scalene Triangle
    defineShapePreset({
        id: 'tri-acute-scalene',
        name: '3. Acute Scalene Triangle',
        shapeType: 'triangle',
        category: '2d-basic',
        essentialGroup: 'The Foundation: Triangles',
        essentialNumber: 3,
        badge: 'Sine / Cosine Rule',
        description: 'No angle is 90° and all sides differ — ideal for Sine and Cosine rules',
        props: {
            vertices: [
                { x: -20, y: -80 },
                { x: 110, y: 65 },
                { x: -105, y: 65 }
            ],
            showAltitude: false,
            vertexDecorations: [
                { vertexIndex: 2, type: 'label', label: '$58^\\circ$' },
                { vertexIndex: 1, type: 'double-arc' }
            ]
        },
        labels: [
            { text: '11 cm', type: 'edge', index: 0 },
            { text: '15 cm', type: 'edge', index: 1 },
            { text: '9 cm', type: 'edge', index: 2 }
        ]
    }),

    // #4. Obtuse Triangle (External Altitude)
    defineShapePreset({
        id: 'tri-obtuse',
        name: '4. Obtuse Triangle (External Altitude)',
        shapeType: 'triangle',
        category: '2d-basic',
        essentialGroup: 'The Foundation: Triangles',
        essentialNumber: 4,
        badge: 'External Height',
        description: 'Obtuse triangle dropping a dashed perpendicular height line outside the base with 90° square',
        props: {
            vertices: [
                { x: -115, y: -70 },
                { x: 105, y: 70 },
                { x: -35, y: 70 }
            ],
            showAltitude: true,
            altitudeVertexIndex: 0,
            showAltitudeRightAngle: true
        },
        labels: [
            { text: '$b = 14$ cm', type: 'edge', index: 1 },
            { text: '$h = 9$ cm', type: 'custom', customKey: 'altitude' }
        ]
    }),

    // Additional Triangle Preset: Internal Altitude
    defineShapePreset({
        id: 'tri-altitude',
        name: 'Acute Triangle + Internal Altitude',
        shapeType: 'triangle',
        category: '2d-basic',
        description: 'Scalene triangle with dashed internal perpendicular altitude and right-angle square',
        props: {
            vertices: [
                { x: -15, y: -75 },
                { x: 105, y: 65 },
                { x: -105, y: 65 }
            ],
            showAltitude: true,
            altitudeVertexIndex: 0,
            showAltitudeRightAngle: true
        },
        labels: [
            { text: '$b$', type: 'edge', index: 1 },
            { text: '$h$', type: 'custom', customKey: 'altitude' }
        ]
    }),

    // =========================================================================
    // GROUP 2: THE CORE QUADRILATERALS (#5 – #10)
    // =========================================================================

    // #5. Rectangle
    defineShapePreset({
        id: 'rect-algebra',
        name: '5. Rectangle (Algebra / Area)',
        shapeType: 'rectangle',
        category: '2d-basic',
        essentialGroup: 'The Core Quadrilaterals',
        essentialNumber: 5,
        badge: 'x and x+2',
        description: 'Standard rectangle with right-angle corners, equal opposite ticks, and algebraic side labels',
        props: {
            width: 210,
            height: 125,
            sideLinkMode: 'rectangle',
            showDiagonals: 'none',
            diagonalStyle: 'dashed',
            showCenterDot: false,
            vertexDecorations: [
                { vertexIndex: 0, type: 'right' },
                { vertexIndex: 1, type: 'right' },
                { vertexIndex: 2, type: 'right' },
                { vertexIndex: 3, type: 'right' }
            ],
            edgeDecorations: [
                { edgeIndex: 0, type: 'tick' },
                { edgeIndex: 2, type: 'tick' },
                { edgeIndex: 1, type: 'double-tick' },
                { edgeIndex: 3, type: 'double-tick' }
            ]
        },
        labels: [
            { text: '$x + 2$', type: 'edge', index: 0 },
            { text: '$x$', type: 'edge', index: 1 }
        ]
    }),

    defineShapePreset({
        id: 'rect-standard',
        name: 'Rectangle (Numeric 12 cm × 7 cm)',
        shapeType: 'rectangle',
        category: '2d-basic',
        description: 'Standard rectangle with numeric side measurements and right angles',
        props: {
            width: 210,
            height: 125,
            sideLinkMode: 'rectangle',
            showDiagonals: 'none',
            diagonalStyle: 'dashed',
            showCenterDot: false,
            vertexDecorations: [
                { vertexIndex: 0, type: 'right' },
                { vertexIndex: 1, type: 'right' },
                { vertexIndex: 2, type: 'right' },
                { vertexIndex: 3, type: 'right' }
            ],
            edgeDecorations: [
                { edgeIndex: 0, type: 'tick' },
                { edgeIndex: 2, type: 'tick' },
                { edgeIndex: 1, type: 'double-tick' },
                { edgeIndex: 3, type: 'double-tick' }
            ]
        },
        labels: [
            { text: '12 cm', type: 'edge', index: 0 },
            { text: '7 cm', type: 'edge', index: 1 }
        ]
    }),

    // #6. Square
    defineShapePreset({
        id: 'rect-square',
        name: '6. Square (Locked Proportions)',
        shapeType: 'rectangle',
        category: '2d-basic',
        essentialGroup: 'The Core Quadrilaterals',
        essentialNumber: 6,
        badge: 'Exact Geometry',
        description: 'Locked equal proportions with 4 right-angle corners and single tick marks on all 4 sides',
        props: {
            width: 160,
            height: 160,
            sideLinkMode: 'square',
            showDiagonals: 'none',
            diagonalStyle: 'dashed',
            showCenterDot: false,
            vertexDecorations: [
                { vertexIndex: 0, type: 'right' },
                { vertexIndex: 1, type: 'right' },
                { vertexIndex: 2, type: 'right' },
                { vertexIndex: 3, type: 'right' }
            ],
            edgeDecorations: [
                { edgeIndex: 0, type: 'tick' },
                { edgeIndex: 1, type: 'tick' },
                { edgeIndex: 2, type: 'tick' },
                { edgeIndex: 3, type: 'tick' }
            ]
        },
        labels: [{ text: '$s = 8$ cm', type: 'edge', index: 0 }]
    }),

    defineShapePreset({
        id: 'rect-diagonal',
        name: 'Rectangle + Diagonal',
        shapeType: 'rectangle',
        category: '2d-basic',
        description: 'Rectangle with dashed diagonal and external dimension brackets',
        props: {
            width: 210,
            height: 130,
            sideLinkMode: 'rectangle',
            showDiagonals: 'one',
            diagonalStyle: 'dashed',
            showCenterDot: true,
            vertexDecorations: [{ vertexIndex: 2, type: 'right' }]
        },
        labels: [
            { text: '16 cm', type: 'edge', index: 0, showDimensionLine: true },
            { text: '12 cm', type: 'edge', index: 1, showDimensionLine: true }
        ]
    }),

    // #7. Parallelogram
    defineShapePreset({
        id: 'quad-parallelogram',
        name: '7. Parallelogram',
        shapeType: 'polygon',
        category: '2d-basic',
        essentialGroup: 'The Core Quadrilaterals',
        essentialNumber: 7,
        badge: 'Base × Perp Height',
        description: 'Parallelogram with toggleable internal dashed altitude line, 90° square, and parallel arrows',
        props: {
            sides: 4,
            radius: 110,
            customVertices: [
                { x: -65, y: -60 },
                { x: 115, y: -60 },
                { x: 65, y: 60 },
                { x: -115, y: 60 }
            ],
            showCenterDot: false,
            showRadiusLine: false,
            showApothem: false,
            showAltitude: true,
            altitudeVertexIndex: 0,
            altitudeBaseEdgeIndex: 2,
            showDiagonals: false,
            shadedSectors: [],
            exteriorExtensionLength: 0,
            edgeDecorations: [
                { edgeIndex: 0, type: 'arrow' },
                { edgeIndex: 2, type: 'arrow-reverse' },
                { edgeIndex: 1, type: 'double-arrow' },
                { edgeIndex: 3, type: 'double-arrow-reverse' }
            ]
        },
        labels: [
            { text: '$b = 14$ cm', type: 'edge', index: 2 },
            { text: '$h = 8$ cm', type: 'custom', customKey: 'altitude' },
            { text: '10 cm', type: 'edge', index: 1 }
        ]
    }),

    // #8. Trapezium (Asymmetrical default)
    defineShapePreset({
        id: 'quad-trapezium',
        name: '8. Trapezium (Asymmetrical)',
        shapeType: 'polygon',
        category: '2d-basic',
        essentialGroup: 'The Core Quadrilaterals',
        essentialNumber: 8,
        badge: '½(a + b)h',
        description: 'Asymmetrical trapezium with parallel top/bottom arrows and internal perpendicular height h',
        props: {
            sides: 4,
            radius: 110,
            customVertices: [
                { x: -55, y: -65 },
                { x: 45, y: -65 },
                { x: 115, y: 65 },
                { x: -105, y: 65 }
            ],
            showCenterDot: false,
            showRadiusLine: false,
            showApothem: false,
            showAltitude: true,
            altitudeVertexIndex: 0,
            altitudeBaseEdgeIndex: 2,
            showDiagonals: false,
            shadedSectors: [],
            exteriorExtensionLength: 0,
            edgeDecorations: [
                { edgeIndex: 0, type: 'arrow' },
                { edgeIndex: 2, type: 'arrow-reverse' }
            ]
        },
        labels: [
            { text: '$a = 7$ cm', type: 'edge', index: 0 },
            { text: '$b = 15$ cm', type: 'edge', index: 2 },
            { text: '$h = 9$ cm', type: 'custom', customKey: 'altitude' }
        ]
    }),

    // #9. Rhombus
    defineShapePreset({
        id: 'quad-rhombus',
        name: '9. Rhombus',
        shapeType: 'polygon',
        category: '2d-basic',
        essentialGroup: 'The Core Quadrilaterals',
        essentialNumber: 9,
        badge: '⊥ Bisecting Diagonals',
        description: 'All 4 sides equal with dashed diagonals bisecting each other at right angles (90°)',
        props: {
            sides: 4,
            radius: 110,
            customVertices: [
                { x: 0, y: -75 },
                { x: 115, y: 0 },
                { x: 0, y: 75 },
                { x: -115, y: 0 }
            ],
            showCenterDot: false,
            showRadiusLine: false,
            showApothem: false,
            showAltitude: false,
            showDiagonals: true,
            showDiagonalRightAngle: true,
            shadedSectors: [],
            exteriorExtensionLength: 0,
            edgeDecorations: [
                { edgeIndex: 0, type: 'tick' },
                { edgeIndex: 1, type: 'tick' },
                { edgeIndex: 2, type: 'tick' },
                { edgeIndex: 3, type: 'tick' }
            ]
        },
        labels: [
            { text: '$d_1 = 16$ cm', type: 'custom', customKey: 'diagonal-2', offsetX: 36, offsetY: -12 },
            { text: '$d_2 = 10$ cm', type: 'custom', customKey: 'diagonal-1', offsetX: -34, offsetY: -22 }
        ]
    }),

    // #10. Kite
    defineShapePreset({
        id: 'quad-kite',
        name: '10. Kite',
        shapeType: 'polygon',
        category: '2d-basic',
        essentialGroup: 'The Core Quadrilaterals',
        essentialNumber: 10,
        badge: 'Area = ½xy',
        description: 'Symmetrical kite with adjacent equal side ticks and perpendicular diagonals x and y',
        props: {
            sides: 4,
            radius: 110,
            customVertices: [
                { x: 0, y: -95 },
                { x: 75, y: -20 },
                { x: 0, y: 95 },
                { x: -75, y: -20 }
            ],
            showCenterDot: false,
            showRadiusLine: false,
            showApothem: false,
            showAltitude: false,
            showDiagonals: true,
            showDiagonalRightAngle: true,
            shadedSectors: [],
            exteriorExtensionLength: 0,
            edgeDecorations: [
                { edgeIndex: 0, type: 'tick' },
                { edgeIndex: 3, type: 'tick' },
                { edgeIndex: 1, type: 'double-tick' },
                { edgeIndex: 2, type: 'double-tick' }
            ]
        },
        labels: [
            { text: '$x = 12$ cm', type: 'custom', customKey: 'diagonal-2', offsetX: 30, offsetY: -10 },
            { text: '$y = 18$ cm', type: 'custom', customKey: 'diagonal-1', offsetX: 28, offsetY: 28 }
        ]
    }),

    // =========================================================================
    // GROUP 3: POLYGONS & CIRCLES (#11 – #15)
    // =========================================================================

    // #11a. Regular Polygon (Default: Hexagon)
    defineShapePreset({
        id: 'poly-hexagon',
        name: '11a. Regular Hexagon (n = 6)',
        shapeType: 'polygon',
        category: '2d-basic',
        essentialGroup: 'Polygons & Circles',
        essentialNumber: 11,
        badge: 'Interior Angle / Apothem',
        description: 'Scalable regular hexagon with equal side ticks, apothem, and interior angle θ',
        props: {
            sides: 6,
            radius: 105,
            showCenterDot: true,
            showRadiusLine: false,
            showApothem: true,
            shadedSectors: [],
            exteriorExtensionLength: 0,
            edgeDecorations: [
                { edgeIndex: 0, type: 'tick' },
                { edgeIndex: 1, type: 'tick' },
                { edgeIndex: 2, type: 'tick' },
                { edgeIndex: 3, type: 'tick' },
                { edgeIndex: 4, type: 'tick' },
                { edgeIndex: 5, type: 'tick' }
            ],
            vertexDecorations: [
                { vertexIndex: 0, type: 'label', label: '$\\theta$' }
            ]
        },
        labels: [
            { text: '$a$', type: 'custom', customKey: 'apothem' },
            { text: '8 cm', type: 'edge', index: 2 }
        ]
    }),

    // #11b. Regular Octagon (Exterior Angles)
    defineShapePreset({
        id: 'poly-octagon-ext',
        name: '11b. Regular Octagon (n = 8)',
        shapeType: 'polygon',
        category: '2d-basic',
        essentialGroup: 'Polygons & Circles',
        essentialNumber: 11,
        badge: 'Exterior Angles',
        description: 'Regular octagon with extended sides showing exterior angle arcs',
        props: {
            sides: 8,
            radius: 100,
            showCenterDot: true,
            showRadiusLine: false,
            showApothem: false,
            shadedSectors: [],
            exteriorExtensionLength: 45
        },
        labels: [{ text: '6 cm', type: 'edge', index: 0 }]
    }),

    // #12. Circle
    defineShapePreset({
        id: 'circ-standard',
        name: '12. Circle (Circumference & Area)',
        shapeType: 'circle',
        category: '2d-basic',
        essentialGroup: 'Polygons & Circles',
        essentialNumber: 12,
        badge: 'C = 2πr, A = πr²',
        description: 'Standard circle with center point and radius line r',
        props: {
            radius: 100,
            showCenter: true,
            showRadiusLine: true,
            radiusAngle: -25,
            showDiameterLine: false,
            diameterAngle: 0,
            isSector: false,
            sectorStartAngle: 0,
            sectorEndAngle: 90,
            showSectorAngleArc: false,
            sectorAngleLabel: '',
            shadeMode: 'none',
            highlightArc: false,
            arcHighlightColor: '#dc2626',
            showChord: false,
            chordStartAngle: 120,
            chordEndAngle: 240
        },
        labels: [{ text: '$r = 7$ cm', type: 'radius' }]
    }),

    // #13a. Semicircle (180°)
    defineShapePreset({
        id: 'circ-semicircle',
        name: '13a. Semicircle (180°)',
        shapeType: 'circle',
        category: '2d-basic',
        essentialGroup: 'Polygons & Circles',
        essentialNumber: 13,
        badge: 'Half Circle + Base',
        description: 'Standalone semicircle with straight diameter edge included for perimeter & area questions',
        props: {
            radius: 105,
            showCenter: true,
            showRadiusLine: false,
            radiusAngle: 0,
            showDiameterLine: false,
            diameterAngle: 0,
            isSector: true,
            sectorStartAngle: 180,
            sectorEndAngle: 0,
            showSectorAngleArc: false,
            sectorAngleLabel: '180°',
            shadeMode: 'minor-sector',
            highlightArc: false,
            arcHighlightColor: '#dc2626',
            showChord: false,
            chordStartAngle: 120,
            chordEndAngle: 240
        },
        labels: [{ text: '$d = 14$ cm', type: 'radius', offsetY: 18 }]
    }),

    // #13b. Quadrant (90°)
    defineShapePreset({
        id: 'circ-quadrant',
        name: '13b. Quadrant (90° Quarter Circle)',
        shapeType: 'circle',
        category: '2d-basic',
        essentialGroup: 'Polygons & Circles',
        essentialNumber: 13,
        badge: 'Quarter Circle',
        description: '90° quarter-circle sector with straight perpendicular radii for perimeter & area questions',
        props: {
            radius: 115,
            showCenter: true,
            showRadiusLine: false,
            radiusAngle: 0,
            showDiameterLine: false,
            diameterAngle: 0,
            isSector: true,
            sectorStartAngle: -90,
            sectorEndAngle: 0,
            showSectorAngleArc: true,
            sectorAngleLabel: '90°',
            shadeMode: 'minor-sector',
            highlightArc: false,
            arcHighlightColor: '#dc2626',
            showChord: false,
            chordStartAngle: 120,
            chordEndAngle: 240
        },
        labels: [{ text: '$r = 8$ cm', type: 'radius', offsetX: 8, offsetY: 18 }]
    }),

    // #14. Circular Sector (Pie Slice)
    defineShapePreset({
        id: 'circ-cutout-sector',
        name: '14. Circular Sector (Pie Slice)',
        shapeType: 'circle',
        category: '2d-basic',
        essentialGroup: 'Polygons & Circles',
        essentialNumber: 14,
        badge: 'Arc Length & Sector Area',
        description: 'Standalone circular sector slice with prominent central angle θ and highlighted arc',
        props: {
            radius: 115,
            showCenter: true,
            showRadiusLine: false,
            radiusAngle: 0,
            showDiameterLine: false,
            diameterAngle: 0,
            isSector: true,
            sectorStartAngle: -45,
            sectorEndAngle: 75,
            showSectorAngleArc: true,
            sectorAngleLabel: '$\\theta = 120^\\circ$',
            shadeMode: 'minor-sector',
            highlightArc: true,
            arcHighlightColor: '#dc2626',
            showChord: false,
            chordStartAngle: 120,
            chordEndAngle: 240
        },
        labels: [{ text: '$r = 9$ cm', type: 'radius', offsetX: 10, offsetY: 22 }]
    }),

    // Additional Circle Presets
    defineShapePreset({
        id: 'circ-sector',
        name: 'Full Circle + Shaded Minor Sector',
        shapeType: 'circle',
        category: '2d-basic',
        description: 'Full circle with shaded minor sector and center angle',
        props: {
            radius: 100,
            showCenter: true,
            showRadiusLine: true,
            radiusAngle: 0,
            showDiameterLine: false,
            diameterAngle: 90,
            isSector: false,
            sectorStartAngle: -65,
            sectorEndAngle: 35,
            showSectorAngleArc: true,
            sectorAngleLabel: '100°',
            shadeMode: 'minor-sector',
            highlightArc: false,
            arcHighlightColor: '#dc2626',
            showChord: false,
            chordStartAngle: 120,
            chordEndAngle: 240
        },
        labels: [{ text: '$r = 8$ cm', type: 'radius' }]
    }),

    defineShapePreset({
        id: 'circ-segment',
        name: 'Circle + Chord & Shaded Segment',
        shapeType: 'circle',
        category: '2d-basic',
        description: 'Circle with chord line and shaded minor segment',
        props: {
            radius: 100,
            showCenter: true,
            showRadiusLine: true,
            radiusAngle: -50,
            showDiameterLine: false,
            diameterAngle: 90,
            isSector: false,
            sectorStartAngle: -50,
            sectorEndAngle: 50,
            showSectorAngleArc: true,
            sectorAngleLabel: '$\\theta$',
            shadeMode: 'segment',
            highlightArc: false,
            arcHighlightColor: '#dc2626',
            showChord: true,
            chordStartAngle: -50,
            chordEndAngle: 50
        },
        labels: [{ text: '$r = 10$ cm', type: 'radius' }]
    }),

    // #15. The Annulus (Ring)
    defineShapePreset({
        id: 'annulus-donut',
        name: '15. The Annulus (Concentric Ring)',
        shapeType: 'annulus',
        category: '2d-composite',
        essentialGroup: 'Polygons & Circles',
        essentialNumber: 15,
        badge: 'π(R² − r²)',
        description: 'Two concentric circles with shaded outer ring and independent radii R and r',
        props: {
            outerRadius: 105,
            innerRadius: 55,
            outerRadiusAngle: -25,
            innerRadiusAngle: 145,
            showCenterDot: true,
            showOuterRadiusLine: true,
            showInnerRadiusLine: true,
            shadeRing: true
        },
        labels: [
            { text: '$R = 10$ cm', type: 'custom', customKey: 'outer-radius' },
            { text: '$r = 5$ cm', type: 'custom', customKey: 'inner-radius', color: '#dc2626' }
        ]
    }),

    // =========================================================================
    // GROUP 4: THE ASSESSMENT CLASSICS — COMPOSITE SHAPES (#16 – #20)
    // =========================================================================

    // #16. The "L-Shape" (Compound Rectangle — 4 dimensions shown, 2 hidden)
    defineShapePreset({
        id: 'lshape-standard',
        name: '16. The "L-Shape" (Compound Rectangle)',
        shapeType: 'l-shape',
        category: '2d-composite',
        essentialGroup: 'The Assessment Classics',
        essentialNumber: 16,
        badge: '4 Given / 2 Missing',
        description: '6-sided compound rectangle with 4 dimensions provided and 2 hidden so students calculate the missing sides',
        props: {
            outerWidth: 210,
            outerHeight: 170,
            cutWidth: 115,
            cutHeight: 85,
            scaffoldingMode: 'vertical',
            hiddenDimensions: [2, 3]
        },
        labels: [
            { text: '9 m', type: 'edge', index: 0 },
            { text: '8 m', type: 'edge', index: 1 },
            { text: '11 m', type: 'edge', index: 2, hidden: true },
            { text: '8 m', type: 'edge', index: 3, hidden: true },
            { text: '20 m', type: 'edge', index: 4, showDimensionLine: true },
            { text: '16 m', type: 'edge', index: 5, showDimensionLine: true }
        ]
    }),

    defineShapePreset({
        id: 'lshape-horizontal',
        name: 'L-Shape (Horizontal Split)',
        shapeType: 'l-shape',
        category: '2d-composite',
        description: 'Compound L-shape with horizontal dashed scaffolding line',
        props: {
            outerWidth: 220,
            outerHeight: 160,
            cutWidth: 130,
            cutHeight: 90,
            scaffoldingMode: 'horizontal',
            hiddenDimensions: []
        },
        labels: [
            { text: '7 cm', type: 'edge', index: 0 },
            { text: '9 cm', type: 'edge', index: 1 },
            { text: '11 cm', type: 'edge', index: 2 },
            { text: '7 cm', type: 'edge', index: 3 },
            { text: '18 cm', type: 'edge', index: 4 },
            { text: '16 cm', type: 'edge', index: 5 }
        ]
    }),

    // #17. The Norman Window (Arch — Rectangle topped with a Semicircle)
    defineShapePreset({
        id: 'norman-window-standard',
        name: '17. The Norman Window (Arch)',
        shapeType: 'norman-window',
        category: '2d-composite',
        essentialGroup: 'The Assessment Classics',
        essentialNumber: 17,
        badge: 'Rect + Semicircle',
        description: 'Rectangle topped with a flush semicircle, dashed springing line divider, and radius r',
        props: {
            rectWidth: 150,
            rectHeight: 115,
            showSpringingLine: true,
            showRadiusLine: true,
            showTotalHeightDimension: false
        },
        labels: [
            { text: '1.6 m', type: 'custom', customKey: 'rect-width', showDimensionLine: true },
            { text: '1.4 m', type: 'custom', customKey: 'rect-height', showDimensionLine: true },
            { text: '$r = 0.8$ m', type: 'custom', customKey: 'radius' }
        ]
    }),

    defineShapePreset({
        id: 'norman-window-total',
        name: 'Norman Window (Total Height Given)',
        shapeType: 'norman-window',
        category: '2d-composite',
        description: 'Norman window where total height and base width are given so students deduce wall height',
        props: {
            rectWidth: 150,
            rectHeight: 115,
            showSpringingLine: true,
            showRadiusLine: false,
            showTotalHeightDimension: true
        },
        labels: [
            { text: '2.0 m', type: 'custom', customKey: 'rect-width', showDimensionLine: true },
            { text: '2.5 m', type: 'custom', customKey: 'total-height' }
        ]
    }),

    // #18. The Stadium (Running Track)
    defineShapePreset({
        id: 'stadium-simple',
        name: '18. The Stadium (Running Track)',
        shapeType: 'stadium',
        category: '2d-composite',
        essentialGroup: 'The Assessment Classics',
        essentialNumber: 18,
        badge: 'Rect + 2 Semicircles',
        description: 'Central rectangle flanked by two semicircles with internal dashed vertical dividers',
        props: {
            rectWidth: 155,
            rectHeight: 105,
            showInternalDividers: true,
            showRadiusLine: false,
            concentricLanes: 0,
            laneWidth: 20,
            shadeTrackRing: false
        },
        labels: [
            { text: '100 m', type: 'custom', customKey: 'rect-width', showDimensionLine: true },
            { text: '64 m', type: 'custom', customKey: 'rect-height', showDimensionLine: true }
        ]
    }),

    defineShapePreset({
        id: 'stadium-track',
        name: 'Running Track + Shaded Outer Lane',
        shapeType: 'stadium',
        category: '2d-composite',
        description: 'Stadium with concentric outer lane and shaded track ring',
        props: {
            rectWidth: 150,
            rectHeight: 100,
            showInternalDividers: true,
            showRadiusLine: true,
            concentricLanes: 1,
            laneWidth: 22,
            shadeTrackRing: true
        },
        labels: [
            { text: '100 m', type: 'custom', customKey: 'rect-width', showDimensionLine: true },
            { text: '$r = 32$ m', type: 'custom', customKey: 'radius' }
        ]
    }),

    // #19. The Gable (House Shape — Triangle mounted on top of a Rectangle)
    defineShapePreset({
        id: 'house-flush',
        name: '19. The Gable (House Shape)',
        shapeType: 'house',
        category: '2d-composite',
        essentialGroup: 'The Assessment Classics',
        essentialNumber: 19,
        badge: 'Triangle + Rectangle',
        description: 'Triangle mounted flush on top of a rectangle with dashed ceiling split and total height bracket',
        props: {
            baseWidth: 160,
            baseHeight: 105,
            roofHeight: 70,
            roofOverhang: 0,
            showCeilingLine: true,
            showRoofAltitude: true,
            showTotalHeightDimension: true
        },
        labels: [
            { text: '10 m', type: 'custom', customKey: 'base-width', showDimensionLine: true },
            { text: '6 m', type: 'custom', customKey: 'base-height' },
            { text: '10.5 m', type: 'custom', customKey: 'total-height' }
        ]
    }),

    defineShapePreset({
        id: 'house-overhang',
        name: 'House with Roof Overhang',
        shapeType: 'house',
        category: '2d-composite',
        description: 'Triangle roof with eaves overhang, ceiling divider, and total height bracket',
        props: {
            baseWidth: 160,
            baseHeight: 110,
            roofHeight: 75,
            roofOverhang: 20,
            showCeilingLine: true,
            showRoofAltitude: true,
            showTotalHeightDimension: true
        },
        labels: [
            { text: '12 m', type: 'custom', customKey: 'base-width', showDimensionLine: true },
            { text: '8 m', type: 'custom', customKey: 'base-height' },
            { text: '13 m', type: 'custom', customKey: 'total-height' }
        ]
    }),

    // #20. Inscribed Target (Circle inside a Square)
    defineShapePreset({
        id: 'inscribed-circle-corners',
        name: '20. Inscribed Target (Circle in Square)',
        shapeType: 'inscribed-circle',
        category: '2d-composite',
        essentialGroup: 'The Assessment Classics',
        essentialNumber: 20,
        badge: 'Shaded Corners',
        description: 'Circle perfectly bounded by a square with the 4 corner regions shaded (Area = s² − πr²)',
        props: {
            squareSize: 170,
            showCenterDot: true,
            showRadiusLine: true,
            showDiameterLine: false,
            radiusAngle: -30,
            shadeMode: 'corners',
            showRightAngles: true
        },
        labels: [
            { text: '14 cm', type: 'custom', customKey: 'square-bottom', showDimensionLine: true },
            { text: '$r = 7$ cm', type: 'custom', customKey: 'radius' }
        ]
    }),

    defineShapePreset({
        id: 'inscribed-circle-disc',
        name: 'Inscribed Circle (Shaded Circle)',
        shapeType: 'inscribed-circle',
        category: '2d-composite',
        description: 'Circle inscribed inside a square with the circular disc shaded',
        props: {
            squareSize: 170,
            showCenterDot: true,
            showRadiusLine: false,
            showDiameterLine: true,
            radiusAngle: 0,
            shadeMode: 'circle',
            showRightAngles: true
        },
        labels: [
            { text: '12 cm', type: 'custom', customKey: 'square-bottom', showDimensionLine: true }
        ]
    }),

    // =========================================================================
    // 3. 3D SHAPES (2D PERSPECTIVE)
    // =========================================================================

    // --- PRISM & CUBE ---
    defineShapePreset({
        id: 'prism-pythagoras',
        name: 'Cuboid + 3D Space Diagonal',
        shapeType: 'prism',
        category: '3d',
        description: 'Rectangular prism with 3D Pythagoras triangle and shaded front face',
        props: {
            width: 170,
            height: 110,
            depthX: 65,
            depthY: -45,
            isCube: false,
            showHiddenLines: true,
            shadedFaces: ['front'],
            showSpaceDiagonal: true,
            showBaseDiagonal: true,
            showPythagorasTriangle: true
        },
        labels: [
            { text: '8 cm', type: 'custom', customKey: 'width', showDimensionLine: true },
            { text: '5 cm', type: 'custom', customKey: 'height', showDimensionLine: true },
            { text: '4 cm', type: 'custom', customKey: 'depth', showDimensionLine: true },
            { text: '$d$', type: 'custom', customKey: 'diagonal', color: '#dc2626' }
        ]
    }),
    defineShapePreset({
        id: 'prism-cube',
        name: 'Cube (Equal Edges)',
        shapeType: 'prism',
        category: '3d',
        description: 'Isometric-style cube with hidden dashed rear lines',
        props: {
            width: 130,
            height: 130,
            depthX: 55,
            depthY: -42,
            isCube: true,
            showHiddenLines: true,
            shadedFaces: [],
            showSpaceDiagonal: false,
            showBaseDiagonal: false,
            showPythagorasTriangle: false
        },
        labels: [
            { text: '$a = 6$ cm', type: 'custom', customKey: 'width', showDimensionLine: true }
        ]
    }),

    // --- CYLINDER ---
    defineShapePreset({
        id: 'cyl-standard',
        name: 'Vertical Cylinder',
        shapeType: 'cylinder',
        category: '3d',
        description: 'Cylinder with dashed rear curve, top radius, and vertical height dimension line',
        props: {
            radius: 80,
            height: 150,
            ellipseRy: 26,
            rearCurveMode: 'dashed',
            showTopRadius: true,
            showTopDiameter: false,
            showBottomRadius: false,
            showAxisLine: false,
            showHeightDimension: true
        },
        labels: [
            { text: '$r = 5$ cm', type: 'custom', customKey: 'radius' },
            { text: '$h = 12$ cm', type: 'custom', customKey: 'height' }
        ]
    }),
    defineShapePreset({
        id: 'cyl-diameter',
        name: 'Wide Drum (Full Diameter)',
        shapeType: 'cylinder',
        category: '3d',
        description: 'Wide cylinder showing full top diameter d and vertical height h',
        props: {
            radius: 105,
            height: 110,
            ellipseRy: 30,
            rearCurveMode: 'dashed',
            showTopRadius: false,
            showTopDiameter: true,
            showBottomRadius: false,
            showAxisLine: false,
            showHeightDimension: true
        },
        labels: [
            { text: '$d = 18$ cm', type: 'custom', customKey: 'radius' },
            { text: '$h = 8$ cm', type: 'custom', customKey: 'height' }
        ]
    }),

    // --- CONE ---
    defineShapePreset({
        id: 'cone-right',
        name: 'Right Cone (r, h, l)',
        shapeType: 'cone',
        category: '3d',
        description: 'Right circular cone with internal Pythagoras triangle and external slant height dimension',
        props: {
            radius: 85,
            height: 165,
            apexOffsetX: 0,
            ellipseRy: 26,
            rearCurveMode: 'dashed',
            showPerpendicularHeight: true,
            showSlantHeightDimension: true,
            showBaseRadius: true,
            shadeInternalTriangle: true
        },
        labels: [
            { text: '$h = 12$', type: 'custom', customKey: 'height' },
            { text: '$r = 5$', type: 'custom', customKey: 'radius' },
            { text: '$l = 13$', type: 'custom', customKey: 'slant-height' }
        ]
    }),
    defineShapePreset({
        id: 'cone-oblique',
        name: 'Oblique Cone',
        shapeType: 'cone',
        category: '3d',
        description: 'Cone with offset apex and perpendicular height line',
        props: {
            radius: 85,
            height: 155,
            apexOffsetX: 60,
            ellipseRy: 26,
            rearCurveMode: 'dashed',
            showPerpendicularHeight: true,
            showSlantHeightDimension: false,
            showBaseRadius: true,
            shadeInternalTriangle: false
        },
        labels: [
            { text: '$h = 10$ cm', type: 'custom', customKey: 'height' },
            { text: '$r = 6$ cm', type: 'custom', customKey: 'radius' }
        ]
    }),

    // --- SPHERE ---
    defineShapePreset({
        id: 'sphere-full',
        name: 'Full Sphere',
        shapeType: 'sphere',
        category: '3d',
        description: 'Sphere with equatorial great circle and dashed rear curve',
        props: {
            radius: 95,
            equatorRy: 28,
            rearCurveMode: 'dashed',
            showCenterDot: true,
            showRadiusLine: true,
            radiusAngle: -20,
            hemisphereMode: 'full'
        },
        labels: [{ text: '$r = 6$ cm', type: 'custom', customKey: 'radius' }]
    }),
    defineShapePreset({
        id: 'sphere-bowl',
        name: 'Bowl Hemisphere (Bottom)',
        shapeType: 'sphere',
        category: '3d',
        description: 'Bottom hemisphere slice with flat circular top rim',
        props: {
            radius: 95,
            equatorRy: 28,
            rearCurveMode: 'dashed',
            showCenterDot: true,
            showRadiusLine: true,
            radiusAngle: 0,
            hemisphereMode: 'bottom-hemisphere'
        },
        labels: [{ text: '$r = 6$ cm', type: 'custom', customKey: 'radius' }]
    }),
    defineShapePreset({
        id: 'sphere-dome',
        name: 'Dome Hemisphere (Top)',
        shapeType: 'sphere',
        category: '3d',
        description: 'Top hemisphere dome with dashed rear base rim',
        props: {
            radius: 95,
            equatorRy: 28,
            rearCurveMode: 'dashed',
            showCenterDot: true,
            showRadiusLine: true,
            radiusAngle: 0,
            hemisphereMode: 'top-hemisphere'
        },
        labels: [{ text: '$r = 6$ cm', type: 'custom', customKey: 'radius' }]
    }),

    // --- PYRAMID ---
    defineShapePreset({
        id: 'pyr-square',
        name: 'Square-Based Pyramid',
        shapeType: 'pyramid',
        category: '3d',
        description: 'Right square pyramid with height h, apothem a, and slant height l',
        props: {
            baseType: 'square',
            baseWidth: 165,
            baseDepthX: 65,
            baseDepthY: -45,
            height: 165,
            apexOffsetX: 0,
            showHiddenLines: true,
            showPerpendicularHeight: true,
            showSlantHeight: true,
            showApothemLine: true,
            shadeInternalTriangle: true,
            shadedFaces: []
        },
        labels: [
            { text: '10 cm', type: 'custom', customKey: 'base-width', showDimensionLine: true },
            { text: '$h = 12$', type: 'custom', customKey: 'height', color: '#dc2626' },
            { text: '$l = 13$', type: 'custom', customKey: 'slant-height', color: '#059669' }
        ]
    }),
    defineShapePreset({
        id: 'pyr-triangular',
        name: 'Triangular Pyramid (Tetrahedron)',
        shapeType: 'pyramid',
        category: '3d',
        description: 'Triangular-based pyramid with height and slant height',
        props: {
            baseType: 'triangular',
            baseWidth: 170,
            baseDepthX: 65,
            baseDepthY: -55,
            height: 165,
            apexOffsetX: 0,
            showHiddenLines: true,
            showPerpendicularHeight: true,
            showSlantHeight: true,
            showApothemLine: true,
            shadeInternalTriangle: true,
            shadedFaces: []
        },
        labels: [
            { text: '8 cm', type: 'custom', customKey: 'base-width', showDimensionLine: true },
            { text: '$h = 10$', type: 'custom', customKey: 'height', color: '#dc2626' },
            { text: '$l = 11$', type: 'custom', customKey: 'slant-height', color: '#059669' }
        ]
    }),
    defineShapePreset({
        id: 'pyr-oblique',
        name: 'Oblique Square Pyramid',
        shapeType: 'pyramid',
        category: '3d',
        description: 'Square-based pyramid with off-center apex',
        props: {
            baseType: 'square',
            baseWidth: 160,
            baseDepthX: 60,
            baseDepthY: -42,
            height: 160,
            apexOffsetX: -55,
            showHiddenLines: true,
            showPerpendicularHeight: true,
            showSlantHeight: false,
            showApothemLine: false,
            shadeInternalTriangle: false,
            shadedFaces: [0]
        },
        labels: [
            { text: '9 cm', type: 'custom', customKey: 'base-width', showDimensionLine: true },
            { text: '$h = 11$', type: 'custom', customKey: 'height', color: '#dc2626' }
        ]
    })
];

/**
 * Returns all presets registered for a given ShapeType.
 */
export const getPresetsForShapeType = (type: ShapeType): ShapePreset[] =>
    SHAPE_PRESETS.filter(p => p.shapeType === type);

/**
 * Returns the 20 Essential 2D Presets grouped by curriculum category.
 */
export const getEssential2DPresetsByGroup = (group: Essential2DGroup): ShapePreset[] =>
    SHAPE_PRESETS.filter(p => p.essentialGroup === group);

/**
 * Creates the default shape for a given ShapeType using the first preset in SHAPE_PRESETS.
 */
export const createDefaultShape = (
    type: ShapeType,
    x: number = 283,
    y: number = 283,
    fontSizePt: number = 11
): ShapeDef => {
    const preset = SHAPE_PRESETS.find(p => p.shapeType === type);
    if (preset) {
        return preset.create(x, y, fontSizePt);
    }
    return SHAPE_PRESETS[0].create(x, y, fontSizePt);
};

export interface ChecklistItem {
    id: string;
    category: string;
    title: string;
    description: string;
    shapeType?: ShapeType;
    presetId?: string;
}

export const SHAPE_BUILDER_CHECKLIST: ChecklistItem[] = [
    // Global Modifiers
    {
        id: 'mod-shift',
        category: 'Core Interactions & Modifiers',
        title: 'Shift: Constrain Proportions & Snap Angles',
        description: 'Hold Shift while dragging handles to lock rectangle to square, prism to cube, or snap vertex/sector/rotation angles to 15°/45°/90°.'
    },
    {
        id: 'mod-alt',
        category: 'Core Interactions & Modifiers',
        title: 'Alt / Option: Resize from Center or Duplicate',
        description: 'Hold Alt while dragging a shape to duplicate it, or hold Alt while resizing to scale symmetrically from center.'
    },
    {
        id: 'mod-ctrl',
        category: 'Core Interactions & Modifiers',
        title: 'Ctrl / Cmd: Disable Grid Snap & Multi-Select Sub-Elements',
        description: 'Hold Ctrl/Cmd while clicking multiple edges or vertices on the canvas to batch-apply parallel arrows, equal ticks, or angle arcs.'
    },
    {
        id: 'mod-shift-alt',
        category: 'Core Interactions & Modifiers',
        title: 'Shift + Alt: Symmetric Constrained Resize',
        description: 'Resize from the center while constraining aspect ratio.'
    },

    // 20 Essential 2D Shapes
    {
        id: 'ess-1-right-tri',
        category: 'The Foundation: Triangles (1–4)',
        title: '1. Right-Angled Triangle',
        description: 'Standard textbook staple with toggleable base/height labels and right-angle square.',
        shapeType: 'triangle',
        presetId: 'tri-right'
    },
    {
        id: 'ess-2-iso-equi',
        category: 'The Foundation: Triangles (1–4)',
        title: '2. Isosceles / Equilateral Triangle',
        description: 'Symmetry defaults with single and double tick marks and equal angle arcs.',
        shapeType: 'triangle',
        presetId: 'tri-isosceles'
    },
    {
        id: 'ess-3-acute-scalene',
        category: 'The Foundation: Triangles (1–4)',
        title: '3. Acute Scalene Triangle',
        description: 'Default for Sine and Cosine rules where no angle is 90° and all sides differ.',
        shapeType: 'triangle',
        presetId: 'tri-acute-scalene'
    },
    {
        id: 'ess-4-obtuse-tri',
        category: 'The Foundation: Triangles (1–4)',
        title: '4. Obtuse Triangle (External Altitude)',
        description: 'Drops a perpendicular height line outside the triangle base with 90° square.',
        shapeType: 'triangle',
        presetId: 'tri-obtuse'
    },
    {
        id: 'ess-5-rectangle',
        category: 'The Core Quadrilaterals (5–10)',
        title: '5. Rectangle (Basic Area & Algebra)',
        description: 'Sides labeled x and x+2 with 4 right angles and opposite equal ticks.',
        shapeType: 'rectangle',
        presetId: 'rect-algebra'
    },
    {
        id: 'ess-6-square',
        category: 'The Core Quadrilaterals (5–10)',
        title: '6. Square (Locked Proportions)',
        description: 'Locked equal sides with 4 right-angle corners and equal tick marks.',
        shapeType: 'rectangle',
        presetId: 'rect-square'
    },
    {
        id: 'ess-7-parallelogram',
        category: 'The Core Quadrilaterals (5–10)',
        title: '7. Parallelogram (Internal Dashed Altitude)',
        description: 'Demonstrates Area = base × perpendicular height with toggleable internal dashed altitude.',
        shapeType: 'polygon',
        presetId: 'quad-parallelogram'
    },
    {
        id: 'ess-8-trapezium',
        category: 'The Core Quadrilaterals (5–10)',
        title: '8. Trapezium (Asymmetrical Default)',
        description: 'Asymmetrical trapezium with parallel arrows and internal perpendicular height h.',
        shapeType: 'polygon',
        presetId: 'quad-trapezium'
    },
    {
        id: 'ess-9-rhombus',
        category: 'The Core Quadrilaterals (5–10)',
        title: '9. Rhombus (Perpendicular Bisecting Diagonals)',
        description: 'Equal sides with dashed diagonals bisecting each other at right angles.',
        shapeType: 'polygon',
        presetId: 'quad-rhombus'
    },
    {
        id: 'ess-10-kite',
        category: 'The Core Quadrilaterals (5–10)',
        title: '10. Kite (Diagonals Area = ½xy)',
        description: 'Adjacent equal sides and perpendicular diagonals x and y.',
        shapeType: 'polygon',
        presetId: 'quad-kite'
    },
    {
        id: 'ess-11-reg-poly',
        category: 'Polygons & Circles (11–15)',
        title: '11. Regular Polygon (Hexagon / Octagon)',
        description: 'Scalable n-sided regular polygon for interior/exterior angle sums and apothem area.',
        shapeType: 'polygon',
        presetId: 'poly-hexagon'
    },
    {
        id: 'ess-12-circle',
        category: 'Polygons & Circles (11–15)',
        title: '12. Circle',
        description: 'Standard starting point for circumference, area, and chord theorems.',
        shapeType: 'circle',
        presetId: 'circ-standard'
    },
    {
        id: 'ess-13-semi-quad',
        category: 'Polygons & Circles (11–15)',
        title: '13. Semicircle & Quadrant',
        description: '180° semicircle and 90° quadrant with straight edges included for perimeter.',
        shapeType: 'circle',
        presetId: 'circ-semicircle'
    },
    {
        id: 'ess-14-sector',
        category: 'Polygons & Circles (11–15)',
        title: '14. Circular Sector (Pie Slice)',
        description: 'Arc length and sector area slice with prominent central angle label θ.',
        shapeType: 'circle',
        presetId: 'circ-cutout-sector'
    },
    {
        id: 'ess-15-annulus',
        category: 'Polygons & Circles (11–15)',
        title: '15. The Annulus (Ring)',
        description: 'Two concentric circles with shaded outer ring (R² − r²).',
        shapeType: 'annulus',
        presetId: 'annulus-donut'
    },
    {
        id: 'ess-16-lshape',
        category: 'The Assessment Classics (16–20)',
        title: '16. The "L-Shape" (Compound Rectangle)',
        description: '6 sides with 4 dimensions provided by default and 2 hidden for student calculation.',
        shapeType: 'l-shape',
        presetId: 'lshape-standard'
    },
    {
        id: 'ess-17-norman',
        category: 'The Assessment Classics (16–20)',
        title: '17. The Norman Window (Arch)',
        description: 'Rectangle topped with a flush semicircle and dashed springing line.',
        shapeType: 'norman-window',
        presetId: 'norman-window-standard'
    },
    {
        id: 'ess-18-stadium',
        category: 'The Assessment Classics (16–20)',
        title: '18. The Stadium (Running Track)',
        description: 'Central rectangle flanked by two semicircles with internal dashed dividers.',
        shapeType: 'stadium',
        presetId: 'stadium-simple'
    },
    {
        id: 'ess-19-gable',
        category: 'The Assessment Classics (16–20)',
        title: '19. The Gable (House Shape)',
        description: 'Triangle mounted on top of a rectangle with ceiling divider and total height.',
        shapeType: 'house',
        presetId: 'house-flush'
    },
    {
        id: 'ess-20-inscribed',
        category: 'The Assessment Classics (16–20)',
        title: '20. Inscribed Target (Circle inside a Square)',
        description: 'Circle bounded inside a square with shaded corner regions.',
        shapeType: 'inscribed-circle',
        presetId: 'inscribed-circle-corners'
    },

    // 3D Shapes
    {
        id: '3d-prism',
        category: '3D Shapes (2D Perspective)',
        title: 'Rectangular Prisms & Cubes',
        description: 'Toggle dashed rear edges, drag perspective skew handle, click faces to shade, and toggle 3D space diagonal.',
        shapeType: 'prism',
        presetId: 'prism-pythagoras'
    },
    {
        id: '3d-cylinder',
        category: '3D Shapes (2D Perspective)',
        title: 'Cylinders',
        description: 'Drag top ellipse squash, toggle rear bottom curve (dashed/solid/hidden), and show top radius/diameter & vertical height.',
        shapeType: 'cylinder',
        presetId: 'cyl-standard'
    },
    {
        id: '3d-cone',
        category: '3D Shapes (2D Perspective)',
        title: 'Cones',
        description: 'Toggle dashed perpendicular height with 3D right angle to base radius, external slant height dimension, and draggable apex.',
        shapeType: 'cone',
        presetId: 'cone-right'
    },
    {
        id: '3d-sphere',
        category: '3D Shapes (2D Perspective)',
        title: 'Spheres & Hemispheres',
        description: 'Equatorial ellipse with dashed rear curve toggle, center radius line, and Full / Bowl / Dome Hemisphere slices.',
        shapeType: 'sphere',
        presetId: 'sphere-full'
    },
    {
        id: '3d-pyramid',
        category: '3D Shapes (2D Perspective)',
        title: 'Pyramids (Square & Triangular)',
        description: 'Move apex for right or oblique pyramids, toggle perpendicular height, base apothem, and slant height with 3D right-angle symbol.',
        shapeType: 'pyramid',
        presetId: 'pyr-square'
    }
];
