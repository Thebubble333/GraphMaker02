
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
  BarCharts = 'Bar Charts',
  BoxBuilder = 'Box Builder',
  TreeDiagrams = 'Tree Diagrams',
  FrequencyTables = 'Frequency Tables',
  DotPlots = 'Dot Plots',
  DeveloperCalibration = 'Global Calibration',
  TextCalibration = 'Text Renderer Tuning',
  SurdTuning = 'Surd Generator Tuning',
  PlotterTuning = 'Plotter Engine Tuning',
  BracketTuning = 'Bracket Tester',
  ExportTest = 'Image Export Test',
  NetworkGrapher = 'Network Grapher'
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
  tickLength: number; // New: Configurable tick length
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
  hideLastXTick?: boolean; // New property
  xAxisExtendLeft?: boolean; // New property
  xAxisExtendRight?: boolean; // New property
  showXArrow: boolean;
  showYArrow: boolean;
  showLabelBackground: boolean;
  labelBackgroundOpacity: number;
  showBorder: boolean;
  showWhiskerCaps: boolean;
  forceExternalMargins: boolean;
  marginRight?: number;
  
  // Axis Label Configuration
  xLabelStyle: 'arrow-end' | 'below-center';
  yLabelStyle: 'arrow-end' | 'left-center' | 'right-center';
  yLabelRotation: 'horizontal' | 'vertical';
  linkAxisLabels: boolean; // New property
  
  // Axis Position Configuration
  yAxisAt?: 'zero' | 'left' | 'right';
  xAxisAt?: 'zero' | 'bottom' | 'top';

  // Tick Style Configuration
  xTickStyle?: 'crossing' | 'top' | 'bottom' | 'auto';
  yTickStyle?: 'crossing' | 'left' | 'right' | 'auto';

  axisLabels: [string, string];
  tickRounding: [number, number]; // -1 for Auto, >=0 for fixed decimals
  offsetXAxisNumY: number;
  offsetYAxisNumX?: number; // New optional offset for Y-axis numbers
  clipContentX?: boolean;
  clipContentY?: boolean;
  offsetXAxisLabelX: number; 
  offsetXAxisLabelY: number;
  offsetYAxisLabelX: number;
  offsetYAxisLabelY: number;
  piXAxis: boolean;
  piYAxis: boolean;
  showZeroLabel: boolean;
  showYZeroLabel?: boolean; // New: separate toggle for Y-axis zero
  autoZeroLabel?: boolean;
  verticalGridMode?: 'full' | 'upward';

  // Origin Label Specifics
  originLabelContent?: 'auto' | '0' | 'O';
  originLabelOffset?: { x: number; y: number };

  // Asymptote Configuration
  asymptoteThickness: number;
  asymptoteDashArray: string;
  
  // Export Settings
  cropPadding: number;
  
  // Global Student Mode
  studentMode?: boolean;
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
  useRawData?: boolean;
  rawData?: string;
  showOutliers?: boolean;
  outliers?: number[];
}

export interface FunctionDef {
  id: string;
  type?: 'function' | 'parameter'; // New: distinguish between functions and parameters
  expression: string; // For standard: y=f(x). For parametric: x=f(t). For parameter: a=5
  yExpression?: string; // For parametric: y=g(t)
  isParametric?: boolean;
  color: string;
  strokeWidth: number;
  visible: boolean;
  lineType?: 'solid' | 'dashed' | 'dotted';
  domain: [string, string]; // Stores math strings like 'pi/2'. For parametric, this is the t-domain.
  domainInclusive: [boolean, boolean];
  isCollapsed?: boolean;
  locked?: boolean; // If true, expression is read-only (for derived functions like tangents)
  plotterType?: 'standard' | 'experimental';
  sliderMin?: number; // For parameters
  sliderMax?: number; // For parameters
  sliderStep?: number; // For parameters
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

export type InequalityType = 'y' | 'x' | 'linear' | 'complex';

export interface InequalityDef {
    id: string;
    type: InequalityType;
    expression: string;
    operator: '<' | '<=' | '>' | '>=' | '=';
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
  x: number | string;
  y: number | string;
  color: string;
  size: number;
  style: 'filled' | 'hollow';
  label: string;
  visible: boolean;
}

export interface VerticalLineDef {
  id: string;
  x: number | string;
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

export interface GroupedBarSeriesDef {
    id: string;
    label: string;
    color: string;
    pattern: PatternType;
}

export interface GroupedBarCategoryDef {
    id: string;
    label: string;
    values: Record<string, number>;
}
