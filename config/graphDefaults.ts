
import { GraphConfig } from '../types';

/*
 * -----------------------------------------------------------------------------
 * GRAPH CONFIGURATION HIERARCHY
 * 
 * 1. GLOBAL_CONFIG: The absolute baseline. Defines fonts, stroke widths, and behaviors 
 *    that should be consistent across the entire application (e.g. Times New Roman).
 * 
 * 2. FAMILY CONFIGS (Cartesian, Statistics, etc.): Overrides the global defaults 
 *    for broad categories of graphs.
 * 
 * 3. PAGE STATE: The specific page (e.g. BoxPlots) merges a Family Config with 
 *    its own specific initial state.
 * -----------------------------------------------------------------------------
 */

export const GLOBAL_CONFIG: GraphConfig = {
  layoutMode: 'auto',
  targetWidth: 454,
  targetHeight: 454,
  xRange: [-10, 10],
  yRange: [-10, 10],
  majorStep: [1, 1],
  subdivisions: [2, 2],
  
  // -- Styling Defaults --
  basePixelSize: 50,
  fontFamily: "Times New Roman",
  fontSize: 11,
  gridThicknessMajor: 0.5, // Updated to 0.5
  gridThicknessMinor: 0.25, 
  axisThickness: 1.5,
  tickThickness: 1.5,
  
  // -- Visibility Defaults --
  showMinorGrid: true,
  showMajorGrid: true,
  showVerticalGrid: true,
  showHorizontalGrid: true,
  showXAxis: true,
  showYAxis: true,
  showXNumbers: true,
  showYNumbers: true,
  showXTicks: true,
  showYTicks: true,
  showXArrow: true,
  showYArrow: true,
  showLabelBackground: true,
  labelBackgroundOpacity: 1.0,
  showBorder: true,
  showWhiskerCaps: true,
  forceExternalMargins: false,
  
  // -- Labeling Defaults --
  axisLabels: ["$x$", "$y$"], // Updated to use $...$ for Math Mode italics
  xLabelStyle: 'arrow-end',
  yLabelStyle: 'arrow-end',
  yLabelRotation: 'horizontal',
  linkAxisLabels: true,
  
  // -- Positioning Defaults --
  yAxisAt: 'zero',
  xAxisAt: 'zero',
  xTickStyle: 'crossing',
  yTickStyle: 'crossing',
  offsetXAxisNumY: 0.0,
  offsetXAxisLabelX: 0.0,
  offsetXAxisLabelY: 0.0,
  offsetYAxisLabelX: 0.0,
  offsetYAxisLabelY: 0.0,
  
  // -- Math Defaults --
  tickRounding: [-1, -1],
  piXAxis: false,
  piYAxis: false,
  showZeroLabel: false,
  verticalGridMode: 'full',

  // -- Asymptotes --
  asymptoteThickness: 1.5,
  asymptoteDashArray: "8,4"
};

/**
 * Standard XY Plane (Functions, Scatter, Inequalities)
 * - Arrows ON
 * - Axis centered at zero (usually)
 * - Full Grids
 */
export const CARTESIAN_CONFIG: GraphConfig = {
    ...GLOBAL_CONFIG,
    // Inherits everything from Global
};

/**
 * Statistics Charts (Histograms, Box Plots, Bar Charts)
 * - Arrows usually OFF
 * - Axis often at edges (Left/Bottom) rather than zero
 * - Minor grids often OFF
 */
export const STATISTICS_CONFIG: GraphConfig = {
    ...GLOBAL_CONFIG,
    showXArrow: false,
    showYArrow: false,
    showMinorGrid: false,
    xAxisAt: 'bottom',
    yAxisAt: 'left',
    xTickStyle: 'bottom',
    yTickStyle: 'left',
    xLabelStyle: 'below-center',
    yLabelStyle: 'left-center',
    yLabelRotation: 'vertical',
    axisLabels: ["Category", "Frequency"]
};

/**
 * Number Lines
 * - Y Axis OFF
 * - Grid OFF
 * - Border OFF
 */
export const NUMBER_LINE_CONFIG: GraphConfig = {
    ...GLOBAL_CONFIG,
    yRange: [-1, 1], // Flat vertical range
    showYAxis: false,
    showYNumbers: false,
    showYTicks: false,
    showHorizontalGrid: false,
    showVerticalGrid: true, // Show ticks as grid lines
    verticalGridMode: 'upward', // Ticks go up only
    showMinorGrid: false,
    showBorder: false,
    axisLabels: ["", ""],
    yLabelStyle: 'left-center'
};

/**
 * Blank / Freeform (Shape Builder, Pie Charts)
 * - All grids/axes OFF
 */
export const BLANK_CONFIG: GraphConfig = {
    ...GLOBAL_CONFIG,
    showXAxis: false,
    showYAxis: false,
    showXNumbers: false,
    showYNumbers: false,
    showXTicks: false,
    showYTicks: false,
    showMajorGrid: false,
    showMinorGrid: false,
    showBorder: false
};
