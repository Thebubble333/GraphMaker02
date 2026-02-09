
/*
 * -----------------------------------------------------------------------------
 * AI_READ_ONLY_FILE: DO NOT EDIT WITHOUT EXPRESS PERMISSION
 * This file contains the stable type definitions for the graph engine.
 * -----------------------------------------------------------------------------
 */

export enum Page {
  Home = 'Home',
  FunctionGrapher = 'Function Grapher',
  InequalityGrapher = 'Inequality Grapher',
  BoxPlots = 'Box Plots',
  Histograms = 'Histograms',
  ScatterPlots = 'Scatter Plots',
  NumberLine = 'Number Line',
  VisualQuartiles = 'Visual Quartiles',
  StemAndLeaf = 'Stem & Leaf',
  TrigSpiral = 'Trig Spiral',
  ShapeBuilder = 'Shape Builder',
  PieCharts = 'Pie Charts',
  SegmentedBars = 'Segmented Bars',
  BoxBuilder = 'Box Builder',
  DeveloperCalibration = 'Global Calibration',
  TextCalibration = 'Text Renderer Tuning',
  SurdTuning = 'Surd Generator Tuning'
}

export interface GraphConfig {
  layoutMode: 'auto' | 'fixed';
  targetWidth: number;
  targetHeight: number;
  xRange: [number, number];
  yRange: [number, number];
  majorStep: [number, number];
  subdivisions: [number, number];
  basePixelSize: number;
  fontFamily: string;
  fontSize: number;
  gridThicknessMajor: number;
  gridThicknessMinor: number;
  axisThickness: number;
  tickThickness: number; // New: Separate tick thickness
  showMinorGrid: boolean;
  showMajorGrid: boolean;
  showVerticalGrid: boolean;
  showHorizontalGrid: boolean;
  showXAxis: boolean;
  showYAxis: boolean;
  showXNumbers: boolean;
  showYNumbers: boolean;
  showXTicks: boolean;
  showYTicks: boolean;
  showXArrow: boolean;
  showYArrow: boolean;
  showLabelBackground: boolean;
  labelBackgroundOpacity: number;
  showBorder: boolean;
  showWhiskerCaps: boolean;
  forceExternalMargins: boolean;
  
  // Axis Label Configuration
  xLabelStyle: 'arrow-end' | 'below-center';
  yLabelStyle: 'arrow-end' | 'left-center' | 'right-center';
  yLabelRotation: 'horizontal' | 'vertical';
  linkAxisLabels: boolean; // New property
  
  // Axis Position Configuration
  yAxisAt?: 'zero' | 'left' | 'right';
  xAxisAt?: 'zero' | 'bottom' | 'top';

  // Tick Style Configuration
  xTickStyle: 'crossing' | 'top' | 'bottom';
  yTickStyle: 'crossing' | 'left' | 'right';

  axisLabels: [string, string];
  tickRounding: [number, number]; // -1 for Auto, >=0 for fixed decimals
  offsetXAxisNumY: number;
  offsetXAxisLabelX: number; 
  offsetXAxisLabelY: number;
  offsetYAxisLabelX: number;
  offsetYAxisLabelY: number;
  piXAxis: boolean;
  piYAxis: boolean;
  showZeroLabel: boolean;
  verticalGridMode?: 'full' | 'upward';

  // Asymptote Configuration
  asymptoteThickness: number;
  asymptoteDashArray: string;
}

// NOTE: DEFAULT_GRAPH_CONFIG has been moved to ../config/graphDefaults.ts
// to support hierarchical configuration (Global -> Family -> Page).

export interface BoxPlotDef {
  id: string;
  label: string;
  min: number;
  q1: number;
  median: number;
  q3: number;
  max: number;
  heightOffset: number; // Vertical stacking
  boxHeight: number;   // Visual thickness
  color: string;
  visible: boolean;
  labelPos: 'top' | 'left' | 'none';
}

export interface FunctionDef {
  id: string;
  expression: string;
  color: string;
  strokeWidth: number;
  visible: boolean;
  lineType?: 'solid' | 'dashed' | 'dotted';
  domain: [number | null, number | null];
  domainInclusive: [boolean, boolean];
  isCollapsed?: boolean;
  locked?: boolean; // If true, expression is read-only (for derived functions like tangents)
}

export interface IntegralDef {
  id: string;
  functionId1: string; // The "Upper" or "Main" function
  functionId2?: string; // The "Lower" function (optional). If undefined, assumes X-axis (y=0)
  start: string; // Math string
  end: string;   // Math string
  color: string;
  opacity: number;
  visible: boolean;
}

export interface TangentDef {
  id: string;
  functionId: string;
  derivedFunctionId?: string; // ID of the function entry representing this line
  x: number; // The x-coordinate of tangency
  mode: 'tangent' | 'normal';
  color: string;
  visible: boolean;
  showPoint: boolean;
  lineType: 'solid' | 'dashed' | 'dotted';
  strokeWidth: number;
}

export type InequalityType = 'y' | 'x' | 'linear';

export interface InequalityDef {
    id: string;
    type: InequalityType;
    expression: string;
    operator: '<' | '<=' | '>' | '>=';
    color: string;
    visible: boolean;
}

export interface IntervalDef {
  id: string;
  expression: string; // Supports x > 2, [2, 5), etc.
  color: string;
  visible: boolean;
  heightOffset: number; // Vertical stacking
  label: string;
  showLabel: boolean;
  strokeWidth: number;
}

export type FeatureType = 'root' | 'y-intercept' | 'extremum' | 'inflection' | 'endpoint' | 'intersection' | 'vertical-asymptote' | 'horizontal-asymptote';

export interface FeaturePoint {
  id: string;
  functionId: string;
  type: FeatureType;
  x: number;
  y: number;
  label: string;
  visible: boolean;
  showLabel: boolean;
  useExactLabel?: boolean; // Override global setting
  customLabelOffset: { x: number; y: number };
  color: string;
  style: 'filled' | 'hollow';
  size: number;
}

export interface PointDef {
  id: string;
  x: number;
  y: number;
  color: string;
  size: number;
  style: 'filled' | 'hollow';
  label: string;
  visible: boolean;
}

export interface VerticalLineDef {
  id: string;
  x: number;
  color: string;
  lineType: 'solid' | 'dashed' | 'dotted';
  strokeWidth: number;
  visible: boolean;
}

export interface HistogramBarDef {
  xMin: number;
  xMax: number;
  frequency: number;
}

export interface PieSliceDef {
  id: string;
  label: string;
  value: number;
  color: string;
  explodeOffset: number; // Pixels from center
  visible: boolean;
}

// --- Segmented Bar Chart Types ---

export type PatternType = 'none' | 'solid' | 'stripes-right' | 'stripes-left' | 'grid' | 'dots' | 'crosshatch' | 'vertical' | 'horizontal';

export interface BarSegmentDef {
    id: string;
    value: number;
    label: string; // For legend
    color: string;
    pattern: PatternType;
    patternColor: string;
}

export interface BarGroupDef {
    id: string;
    label: string; // X-Axis Label
    segments: BarSegmentDef[];
    width: number; // visual width units
}
