import { Page } from '../../types';
import {
  DEFAULT_STATE as DEFAULT_VENN_STATE,
  generatePresetSets,
  getBoxGeometryForCm,
  VennState
} from '../vennLogic';
import { parseAdjacencyMatrix } from '../networkGenerators';
import { buildGraphFromMatrix, optimizeLabelPlacements, NetworkNode, NetworkEdge } from '../networkLogic';
import { SHAPE_PRESETS, createDefaultShape } from '../shape/presets';
import { CM_TO_PX } from '../../constants';

export type AIToolCategory = 'cartesian' | 'statistics' | 'diagrams';

export interface AIToolSpec {
  slug: string;
  aliases: string[];
  page: Page;
  appId: string;
  svgId: string;
  name: string;
  category: AIToolCategory;
  description: string;
  defaultWidthCm: number;
  defaultHeightCm: number;
  schema: Record<string, unknown>;
  example: Record<string, unknown>;
}

const PALETTE = ['#000000', '#2563eb', '#dc2626', '#16a34a', '#9333ea', '#ea580c', '#0891b2'];
const BAR_PALETTE = ['#3b82f6', '#ef4444', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899', '#14b8a6'];

const GRAPH_CONFIG_SCHEMA = {
  type: 'object',
  description: 'Optional partial GraphConfig overrides for axes, grid, labels, and styling.',
  properties: {
    xRange: { type: 'array', items: { type: 'number' }, minItems: 2, maxItems: 2 },
    yRange: { type: 'array', items: { type: 'number' }, minItems: 2, maxItems: 2 },
    majorStep: { type: 'array', items: { type: 'number' }, minItems: 2, maxItems: 2 },
    subdivisions: { type: 'array', items: { type: 'integer' }, minItems: 2, maxItems: 2 },
    axisLabels: { type: 'array', items: { type: 'string' }, minItems: 2, maxItems: 2 },
    fontSize: { type: 'number', description: 'Font size in pt (default 11)' },
    showMajorGrid: { type: 'boolean' },
    showMinorGrid: { type: 'boolean' },
    showBorder: { type: 'boolean' },
    piXAxis: { type: 'boolean' },
    piYAxis: { type: 'boolean' },
    studentMode: { type: 'boolean' }
  }
};

export const AI_TOOLS: AIToolSpec[] = [
  {
    slug: 'function-grapher',
    aliases: ['functions', 'function', 'graph', 'cartesian', 'FunctionGrapher', 'Function Grapher'],
    page: Page.FunctionGrapher,
    appId: 'FunctionGrapher',
    svgId: 'graph-svg',
    name: 'Function Grapher',
    category: 'cartesian',
    description: 'Plot algebraic/trig/parametric functions, points, vertical asymptotes/lines, tangents, and shaded integrals on a Cartesian plane.',
    defaultWidthCm: 12,
    defaultHeightCm: 12,
    schema: {
      type: 'object',
      properties: {
        functions: {
          type: 'array',
          items: {
            type: 'object',
            required: ['expression'],
            properties: {
              expression: { type: 'string', description: 'Math expression e.g. "x^2 - 4", "sin(x)", "2*x + 1"' },
              color: { type: 'string' },
              strokeWidth: { type: 'number' },
              lineType: { type: 'string', enum: ['solid', 'dashed', 'dotted'] },
              domain: { type: 'array', items: { type: 'string' }, minItems: 2, maxItems: 2 },
              domainInclusive: { type: 'array', items: { type: 'boolean' }, minItems: 2, maxItems: 2 },
              isParametric: { type: 'boolean' },
              yExpression: { type: 'string' }
            }
          }
        },
        points: {
          type: 'array',
          items: {
            type: 'object',
            required: ['x', 'y'],
            properties: {
              x: { type: ['number', 'string'] },
              y: { type: ['number', 'string'] },
              label: { type: 'string' },
              color: { type: 'string' },
              style: { type: 'string', enum: ['filled', 'hollow'] },
              size: { type: 'number' }
            }
          }
        },
        verticalLines: {
          type: 'array',
          items: {
            type: 'object',
            required: ['x'],
            properties: {
              x: { type: ['number', 'string'] },
              color: { type: 'string' },
              lineType: { type: 'string', enum: ['solid', 'dashed', 'dotted'] }
            }
          }
        },
        integrals: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              functionId1: { type: 'string' },
              functionId2: { type: 'string' },
              start: { type: 'string' },
              end: { type: 'string' },
              color: { type: 'string' },
              opacity: { type: 'number' }
            }
          }
        },
        config: GRAPH_CONFIG_SCHEMA,
        dimCm: { type: 'object', properties: { width: { type: 'number' }, height: { type: 'number' } } }
      }
    },
    example: {
      functions: [
        { expression: 'x^2 - 2', color: '#000000' },
        { expression: 'x', color: '#2563eb', lineType: 'dashed' }
      ],
      points: [{ x: 2, y: 2, label: '$(2,2)$' }],
      config: { xRange: [-4, 4], yRange: [-4, 6], majorStep: [1, 1], axisLabels: ['$x$', '$y$'] }
    }
  },
  {
    slug: 'inequality-grapher',
    aliases: ['inequalities', 'inequality', 'InequalityGrapher', 'Inequality Grapher'],
    page: Page.InequalityGrapher,
    appId: 'InequalityGrapher',
    svgId: 'graph-svg',
    name: 'Inequality Grapher',
    category: 'cartesian',
    description: 'Shade 2D linear, nonlinear, or complex loci inequalities and feasible regions.',
    defaultWidthCm: 12,
    defaultHeightCm: 12,
    schema: {
      type: 'object',
      properties: {
        inequalities: {
          type: 'array',
          items: {
            type: 'object',
            required: ['expression', 'operator'],
            properties: {
              type: { type: 'string', enum: ['y', 'x', 'linear', 'complex'], default: 'y' },
              expression: { type: 'string', description: 'RHS expression e.g. "2x + 1" for y <= 2x + 1' },
              operator: { type: 'string', enum: ['<', '<=', '>', '>=', '='] },
              color: { type: 'string' }
            }
          }
        },
        showIntersection: { type: 'boolean' },
        config: GRAPH_CONFIG_SCHEMA,
        dimCm: { type: 'object', properties: { width: { type: 'number' }, height: { type: 'number' } } }
      }
    },
    example: {
      inequalities: [
        { type: 'y', expression: '2x + 1', operator: '<=', color: '#2563eb' },
        { type: 'y', expression: '-x + 4', operator: '<', color: '#dc2626' }
      ],
      showIntersection: true,
      config: { xRange: [-4, 6], yRange: [-4, 6] }
    }
  },
  {
    slug: 'number-line',
    aliases: ['numberline', 'intervals', 'NumberLine', 'Number Line'],
    page: Page.NumberLine,
    appId: 'NumberLine',
    svgId: 'graph-svg',
    name: 'Number Line',
    category: 'cartesian',
    description: 'Plot 1D intervals and inequalities with open/closed endpoints and arrows on a number line.',
    defaultWidthCm: 15,
    defaultHeightCm: 6,
    schema: {
      type: 'object',
      properties: {
        intervals: {
          type: 'array',
          items: {
            type: 'object',
            required: ['expression'],
            properties: {
              expression: { type: 'string', description: 'Interval or inequality e.g. "x > 2", "[-1, 4)", "-2 <= x < 3"' },
              color: { type: 'string' },
              heightOffset: { type: 'number' },
              label: { type: 'string' },
              showLabel: { type: 'boolean' }
            }
          }
        },
        config: GRAPH_CONFIG_SCHEMA,
        dimCm: { type: 'object', properties: { width: { type: 'number' }, height: { type: 'number' } } }
      }
    },
    example: {
      intervals: [
        { expression: '[-2, 3)', color: '#000000', heightOffset: 1 },
        { expression: 'x >= 1', color: '#2563eb', heightOffset: 2 }
      ],
      config: { xRange: [-5, 6], majorStep: [1, 1] }
    }
  },
  {
    slug: 'box-plots',
    aliases: ['boxplot', 'box-plot', 'boxplots', 'BoxPlots', 'Box Plots'],
    page: Page.BoxPlots,
    appId: 'box-plots',
    svgId: 'graph-svg',
    name: 'Box Plots',
    category: 'statistics',
    description: 'Create single or parallel comparative box-and-whisker plots from 5-number summaries or raw data with optional Tukey outliers.',
    defaultWidthCm: 15,
    defaultHeightCm: 10,
    schema: {
      type: 'object',
      properties: {
        boxPlots: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              label: { type: 'string' },
              min: { type: 'number' },
              q1: { type: 'number' },
              median: { type: 'number' },
              q3: { type: 'number' },
              max: { type: 'number' },
              rawData: { type: 'string', description: 'Optional comma-separated numbers; auto-computes 5-number summary & outliers' },
              showOutliers: { type: 'boolean' },
              outliers: { type: 'array', items: { type: 'number' } },
              color: { type: 'string' },
              labelPos: { type: 'string', enum: ['top', 'left', 'none'] }
            }
          }
        },
        studentMode: { type: 'boolean' },
        config: GRAPH_CONFIG_SCHEMA,
        dimCm: { type: 'object', properties: { width: { type: 'number' }, height: { type: 'number' } } }
      }
    },
    example: {
      boxPlots: [
        { label: 'Class A', min: 45, q1: 62, median: 74, q3: 83, max: 95 },
        { label: 'Class B', min: 52, q1: 68, median: 79, q3: 88, max: 98 }
      ],
      config: { xRange: [40, 100], majorStep: [10, 1], axisLabels: ['Test Score (%)', ''] }
    }
  },
  {
    slug: 'histograms',
    aliases: ['histogram', 'Histograms'],
    page: Page.Histograms,
    appId: 'histograms',
    svgId: 'graph-svg',
    name: 'Histograms',
    category: 'statistics',
    description: 'Generate frequency histograms from raw numerical data or grouped bin intervals.',
    defaultWidthCm: 14,
    defaultHeightCm: 10,
    schema: {
      type: 'object',
      properties: {
        inputMode: { type: 'string', enum: ['raw', 'table'] },
        rawData: { type: ['string', 'array'], description: 'Comma-separated string or array of numbers' },
        binWidth: { type: 'number' },
        binStart: { type: 'number' },
        tableData: {
          type: 'array',
          items: {
            type: 'object',
            required: ['xMin', 'xMax', 'frequency'],
            properties: { xMin: { type: 'number' }, xMax: { type: 'number' }, frequency: { type: 'number' } }
          }
        },
        barStyle: {
          type: 'object',
          properties: { fillColor: { type: 'string' }, strokeColor: { type: 'string' }, opacity: { type: 'number' } }
        },
        studentMode: { type: 'boolean' },
        config: GRAPH_CONFIG_SCHEMA
      }
    },
    example: {
      inputMode: 'table',
      tableData: [
        { xMin: 0, xMax: 10, frequency: 4 },
        { xMin: 10, xMax: 20, frequency: 9 },
        { xMin: 20, xMax: 30, frequency: 6 },
        { xMin: 30, xMax: 40, frequency: 3 }
      ],
      config: { xRange: [0, 40], yRange: [0, 10], majorStep: [10, 2], axisLabels: ['Score', 'Frequency'] }
    }
  },
  {
    slug: 'scatter-plots',
    aliases: ['scatterplot', 'scatter', 'ScatterPlots', 'Scatter Plots'],
    page: Page.ScatterPlots,
    appId: 'scatter-plots',
    svgId: 'graph-svg',
    name: 'Scatter Plots',
    category: 'statistics',
    description: 'Plot bivariate (x, y) scatter data with optional linear regression line of best fit and residual views.',
    defaultWidthCm: 14,
    defaultHeightCm: 10,
    schema: {
      type: 'object',
      properties: {
        points: { type: 'array', items: { type: 'array', items: { type: 'number' }, minItems: 2, maxItems: 2 } },
        rawData: { type: 'string', description: 'Tab/comma-separated x y rows' },
        showRegression: { type: 'boolean' },
        viewMode: { type: 'string', enum: ['scatter', 'residual', 'squared-residual'] },
        studentMode: { type: 'boolean' },
        config: GRAPH_CONFIG_SCHEMA
      }
    },
    example: {
      points: [[1, 2.1], [2, 3.8], [3, 5.2], [4, 6.9], [5, 8.4], [6, 9.7]],
      showRegression: true,
      config: { xRange: [0, 7], yRange: [0, 12], majorStep: [1, 2], axisLabels: ['Hours Studied', 'Score'] }
    }
  },
  {
    slug: 'stem-and-leaf',
    aliases: ['stemleaf', 'stem-leaf', 'StemAndLeaf', 'Stem & Leaf'],
    page: Page.StemAndLeaf,
    appId: 'stem-and-leaf',
    svgId: 'stem-svg',
    name: 'Stem & Leaf Plot',
    category: 'statistics',
    description: 'Create ordered single or back-to-back stem-and-leaf plots with split stems, keys, counts, and quartile highlights.',
    defaultWidthCm: 15,
    defaultHeightCm: 7,
    schema: {
      type: 'object',
      properties: {
        data1: { type: ['string', 'array'], description: 'Right-hand (or primary) dataset' },
        data2: { type: ['string', 'array'], description: 'Optional left-hand dataset for back-to-back plot' },
        config: {
          type: 'object',
          properties: {
            title: { type: 'string' },
            labelLeft: { type: 'string' },
            labelRight: { type: 'string' },
            splitFactor: { type: 'integer', enum: [1, 2, 5] },
            showKey: { type: 'boolean' },
            showCounts: { type: 'boolean' },
            showQuartiles: { type: 'boolean' },
            studentMode: { type: 'boolean' }
          }
        }
      }
    },
    example: {
      data1: [21, 24, 27, 32, 35, 35, 38, 41, 44, 52],
      data2: [18, 22, 25, 29, 31, 33, 37, 40, 45],
      config: { title: 'Test Scores', labelLeft: 'Class A', labelRight: 'Class B', showKey: true }
    }
  },
  {
    slug: 'visual-quartiles',
    aliases: ['quartiles', 'VisualQuartiles', 'Visual Quartiles'],
    page: Page.VisualQuartiles,
    appId: 'visual-quartiles',
    svgId: 'quartile-svg',
    name: 'Visual Quartiles',
    category: 'statistics',
    description: 'Display an ordered list of numbers with visual circle/split annotations showing Q1, Median, and Q3.',
    defaultWidthCm: 15,
    defaultHeightCm: 8,
    schema: {
      type: 'object',
      properties: {
        rawData: { type: ['string', 'array'], description: 'Dataset as comma-separated string or number array' },
        studentMode: { type: 'boolean' },
        config: {
          type: 'object',
          properties: {
            showLegend: { type: 'boolean' },
            fontSize: { type: 'number' },
            colMedian: { type: 'string' },
            colQ1: { type: 'string' },
            colQ3: { type: 'string' }
          }
        }
      }
    },
    example: {
      rawData: [3, 4, 6, 8, 10, 12, 12, 15, 17],
      config: { showLegend: true }
    }
  },
  {
    slug: 'pie-charts',
    aliases: ['pie', 'piechart', 'donut', 'PieCharts', 'Pie Charts'],
    page: Page.PieCharts,
    appId: 'pie-charts',
    svgId: 'pie-svg',
    name: 'Pie Charts',
    category: 'statistics',
    description: 'Create pie or donut charts with percentage/value/combined labels, exploded slices, and legends.',
    defaultWidthCm: 14,
    defaultHeightCm: 12,
    schema: {
      type: 'object',
      properties: {
        chartTitle: { type: 'string' },
        donutRatio: { type: 'number', minimum: 0, maximum: 0.8 },
        slices: {
          type: 'array',
          items: {
            type: 'object',
            required: ['label', 'value'],
            properties: {
              label: { type: 'string' },
              value: { type: 'number' },
              color: { type: 'string' },
              explodeOffset: { type: 'number' }
            }
          }
        },
        pieConfig: {
          type: 'object',
          properties: {
            labelType: { type: 'string', enum: ['name', 'value', 'percent', 'combined', 'none'] },
            labelPosition: { type: 'string', enum: ['inside', 'outside', 'legend'] }
          }
        },
        studentMode: { type: 'boolean' }
      }
    },
    example: {
      chartTitle: 'Transport to School',
      slices: [
        { label: 'Walk', value: 15, color: '#3b82f6' },
        { label: 'Bus', value: 12, color: '#10b981', explodeOffset: 14 },
        { label: 'Car', value: 8, color: '#ef4444' },
        { label: 'Bike', value: 5, color: '#f59e0b' }
      ]
    }
  },
  {
    slug: 'segmented-bar-charts',
    aliases: ['segmented-bars', 'stacked-bar', 'SegmentedBarCharts', 'Segmented Bars'],
    page: Page.SegmentedBars,
    appId: 'segmented-bar-charts',
    svgId: 'segbar-svg',
    name: 'Segmented Bar Charts',
    category: 'statistics',
    description: 'Create stacked / percentage segmented bar charts with patterns and legends.',
    defaultWidthCm: 14,
    defaultHeightCm: 10,
    schema: {
      type: 'object',
      properties: {
        chartTitle: { type: 'string' },
        bars: {
          type: 'array',
          items: {
            type: 'object',
            required: ['label', 'segments'],
            properties: {
              label: { type: 'string' },
              segments: {
                type: 'array',
                items: {
                  type: 'object',
                  required: ['label', 'value'],
                  properties: {
                    label: { type: 'string' },
                    value: { type: 'number' },
                    color: { type: 'string' },
                    pattern: { type: 'string' }
                  }
                }
              }
            }
          }
        },
        showLegend: { type: 'boolean' },
        studentMode: { type: 'boolean' },
        config: GRAPH_CONFIG_SCHEMA
      }
    },
    example: {
      chartTitle: 'Survey Results (%)',
      bars: [
        { label: 'Year 9', segments: [{ label: 'Yes', value: 60, color: '#3b82f6' }, { label: 'No', value: 40, color: '#e2e8f0' }] },
        { label: 'Year 10', segments: [{ label: 'Yes', value: 45, color: '#3b82f6' }, { label: 'No', value: 55, color: '#e2e8f0' }] }
      ],
      config: { yRange: [0, 100], majorStep: [1, 20], axisLabels: ['Cohort', 'Percentage (%)'] }
    }
  },
  {
    slug: 'bar-charts',
    aliases: ['barchart', 'bar', 'column-chart', 'BarCharts', 'Bar Charts'],
    page: Page.BarCharts,
    appId: 'bar-charts',
    svgId: 'barchart-svg',
    name: 'Bar Charts',
    category: 'statistics',
    description: 'Create single-series or grouped column/bar charts with optional value labels and legends.',
    defaultWidthCm: 14,
    defaultHeightCm: 10,
    schema: {
      type: 'object',
      properties: {
        chartTitle: { type: 'string' },
        series: {
          type: 'array',
          items: {
            type: 'object',
            required: ['label'],
            properties: { id: { type: 'string' }, label: { type: 'string' }, color: { type: 'string' }, pattern: { type: 'string' } }
          }
        },
        categories: {
          type: 'array',
          items: {
            type: 'object',
            required: ['label', 'values'],
            properties: { label: { type: 'string' }, values: { type: 'object', additionalProperties: { type: 'number' } } }
          }
        },
        labels: { type: 'array', items: { type: 'string' }, description: 'Shorthand for single-series categories' },
        values: { type: 'array', items: { type: 'number' }, description: 'Shorthand for single-series values' },
        showValues: { type: 'boolean' },
        showLegend: { type: 'boolean' },
        config: GRAPH_CONFIG_SCHEMA
      }
    },
    example: {
      chartTitle: 'Favourite Sport',
      labels: ['Soccer', 'Tennis', 'Swimming', 'Basketball'],
      values: [14, 9, 11, 6],
      showValues: true,
      config: { yRange: [0, 16], majorStep: [1, 2], axisLabels: ['Sport', 'Students'] }
    }
  },
  {
    slug: 'dot-plots',
    aliases: ['dotplot', 'dots', 'DotPlots', 'Dot Plots'],
    page: Page.DotPlots,
    appId: 'dot-plots',
    svgId: 'graph-svg',
    name: 'Dot Plots',
    category: 'statistics',
    description: 'Create statistical dot plots from frequency rows or raw numbers, with optional quartile markers and column totals.',
    defaultWidthCm: 15,
    defaultHeightCm: 10,
    schema: {
      type: 'object',
      properties: {
        rawData: { type: ['string', 'array'], description: 'Optional raw numbers; auto-tallied into dots' },
        data: {
          type: 'array',
          items: {
            type: 'object',
            required: ['value', 'frequency'],
            properties: { value: { type: 'number' }, frequency: { type: 'integer' } }
          }
        },
        showQuartiles: { type: 'boolean' },
        showColumnTotals: { type: 'string', enum: ['none', 'individual', 'cumulative'] },
        studentMode: { type: 'boolean' },
        config: GRAPH_CONFIG_SCHEMA
      }
    },
    example: {
      rawData: [1, 2, 2, 3, 3, 3, 4, 4, 5, 6],
      showQuartiles: false,
      config: { xRange: [0, 7], majorStep: [1, 1], axisLabels: ['Goals Scored', ''] }
    }
  },
  {
    slug: 'frequency-tables',
    aliases: ['freq-table', 'tally-table', 'FrequencyTables', 'Frequency Tables'],
    page: Page.FrequencyTables,
    appId: 'frequency-tables',
    svgId: 'frequency-table-svg',
    name: 'Frequency Tables',
    category: 'statistics',
    description: 'Generate clean publication-ready frequency and tally mark tables with optional total row and student worksheet mode.',
    defaultWidthCm: 12,
    defaultHeightCm: 9,
    schema: {
      type: 'object',
      properties: {
        categoryLabel: { type: 'string' },
        data: {
          type: 'array',
          items: {
            type: 'object',
            required: ['category', 'frequency'],
            properties: { category: { type: 'string' }, frequency: { type: 'integer' } }
          }
        },
        rawData: { type: 'array', items: { type: ['string', 'number'] }, description: 'Optional raw values auto-counted into rows' },
        showTally: { type: 'boolean' },
        showTotal: { type: 'boolean' },
        studentMode: { type: 'boolean' },
        fontSize: { type: 'number' }
      }
    },
    example: {
      categoryLabel: 'Colour',
      data: [
        { category: 'Red', frequency: 7 },
        { category: 'Blue', frequency: 11 },
        { category: 'Green', frequency: 4 }
      ],
      showTally: true,
      showTotal: true
    }
  },
  {
    slug: 'network-grapher',
    aliases: ['network', 'graph-theory', 'networks', 'NetworkGrapher', 'Network Grapher'],
    page: Page.NetworkGrapher,
    appId: 'NetworkGrapher',
    svgId: 'network-canvas-svg',
    name: 'Network Grapher',
    category: 'diagrams',
    description: 'Create weighted/unweighted, directed/undirected graphs & networks from node/edge lists or adjacency matrices with automatic label optimization.',
    defaultWidthCm: 10,
    defaultHeightCm: 8,
    schema: {
      type: 'object',
      properties: {
        nodes: {
          type: 'array',
          items: {
            type: 'object',
            required: ['label'],
            properties: {
              id: { type: 'string' },
              label: { type: 'string' },
              x: { type: 'number' },
              y: { type: 'number' }
            }
          }
        },
        edges: {
          type: 'array',
          items: {
            type: 'object',
            required: ['source', 'target'],
            properties: {
              source: { type: 'string', description: 'Node id or label' },
              target: { type: 'string', description: 'Node id or label' },
              weight: { type: ['string', 'number'] },
              isDirected: { type: 'boolean' }
            }
          }
        },
        matrix: { type: 'string', description: 'Optional adjacency matrix string (overrides nodes/edges)' },
        isDirectedGeneral: { type: 'boolean' },
        globalVertexStyle: { type: 'string', enum: ['inside', 'outside', 'none'] },
        canvasWidth: { type: 'number' },
        canvasHeight: { type: 'number' }
      }
    },
    example: {
      nodes: [{ label: 'A' }, { label: 'B' }, { label: 'C' }, { label: 'D' }],
      edges: [
        { source: 'A', target: 'B', weight: '5' },
        { source: 'B', target: 'C', weight: '3' },
        { source: 'C', target: 'D', weight: '4' },
        { source: 'D', target: 'A', weight: '7' },
        { source: 'A', target: 'C', weight: '6' }
      ],
      globalVertexStyle: 'inside'
    }
  },
  {
    slug: 'venn-diagrams',
    aliases: ['venn', 'sets', 'VennDiagrams', 'Venn Diagrams'],
    page: Page.VennDiagrams,
    appId: 'VennDiagrams',
    svgId: 'venn-svg',
    name: 'Venn Diagrams',
    category: 'diagrams',
    description: 'Create 1-, 2-, or 3-set Venn diagrams with region counts/probabilities, shading, custom set labels, and optional 2-way companion table.',
    defaultWidthCm: 12,
    defaultHeightCm: 8.5,
    schema: {
      type: 'object',
      properties: {
        numSets: { type: 'integer', enum: [1, 2, 3] },
        labels: { type: 'array', items: { type: 'string' }, description: 'Set labels e.g. ["A", "B"] or ["Math", "Science", "Art"]' },
        regions: {
          type: 'object',
          description: 'Map of bitmask (0=outside, 1=A only, 2=B only, 3=A∩B, 4=C only, 5=A∩C, 6=B∩C, 7=A∩B∩C) to string value or region object'
        },
        shadedMasks: { type: 'array', items: { type: 'integer' }, description: 'Bitmasks of regions to shade' },
        chartTitle: { type: 'string' },
        universalSymbol: { type: 'string' },
        showUniversalBox: { type: 'boolean' },
        showCompanionTable: { type: 'boolean' },
        studentMode: { type: 'boolean' },
        topology: { type: 'string' },
        shapeType: { type: 'string', enum: ['circle', 'ellipse', 'rectangle'] }
      }
    },
    example: {
      numSets: 2,
      labels: ['Sports', 'Music'],
      regions: { '0': '4', '1': '12', '2': '9', '3': '5' },
      shadedMasks: [3],
      chartTitle: 'Year 8 Activities'
    }
  },
  {
    slug: 'tree-diagrams',
    aliases: ['tree', 'probability-tree', 'TreeDiagrams', 'Tree Diagrams'],
    page: Page.TreeDiagrams,
    appId: 'TreeDiagrams',
    svgId: 'tree-diagram-svg',
    name: 'Tree Diagrams',
    category: 'diagrams',
    description: 'Generate multi-stage probability tree diagrams in bag-draw (with/without replacement) or custom-branch mode.',
    defaultWidthCm: 16,
    defaultHeightCm: 10,
    schema: {
      type: 'object',
      properties: {
        mode: { type: 'string', enum: ['bag', 'custom'] },
        bagItems: {
          type: 'array',
          items: { type: 'object', required: ['label', 'count'], properties: { label: { type: 'string' }, count: { type: 'integer' } } }
        },
        numDraws: { type: 'integer', minimum: 1, maximum: 4 },
        withReplacement: { type: 'boolean' },
        bagStepNames: { type: 'array', items: { type: 'string' } },
        customSteps: {
          type: 'array',
          items: {
            type: 'object',
            required: ['name', 'outcomes'],
            properties: {
              name: { type: 'string' },
              outcomes: {
                type: 'array',
                items: {
                  type: 'object',
                  required: ['label', 'num', 'den'],
                  properties: { label: { type: 'string' }, num: { type: 'number' }, den: { type: 'number' } }
                }
              }
            }
          }
        },
        showProbabilities: { type: 'boolean' },
        showOutcomes: { type: 'boolean' },
        showCalculations: { type: 'boolean' },
        studentMode: { type: 'boolean' }
      }
    },
    example: {
      mode: 'bag',
      bagItems: [{ label: 'Red', count: 5 }, { label: 'Blue', count: 3 }],
      numDraws: 2,
      withReplacement: false,
      showProbabilities: true,
      showOutcomes: true,
      showCalculations: true
    }
  },
  {
    slug: 'shape-builder',
    aliases: ['shapes', 'geometry', 'ShapeBuilder', 'ShapeBuilderV2', 'Shape Builder'],
    page: Page.ShapeBuilder,
    appId: 'ShapeBuilderV2',
    svgId: 'shape-svg',
    name: 'Shape Builder',
    category: 'diagrams',
    description: 'Render 2D, composite, and 3D geometric figures (triangles, quadrilaterals, circles/sectors, L-shapes, prisms, cylinders, cones, spheres, pyramids) with dimension & angle labels.',
    defaultWidthCm: 15,
    defaultHeightCm: 15,
    schema: {
      type: 'object',
      properties: {
        preset: { type: 'string', description: 'Preset ID or name search e.g. "right-triangle", "isosceles", "cylinder", "cone", "prism", "l-shape", "sector"' },
        shapeType: {
          type: 'string',
          enum: ['triangle', 'rectangle', 'polygon', 'circle', 'l-shape', 'norman-window', 'stadium', 'house', 'inscribed-circle', 'annulus', 'prism', 'cylinder', 'cone', 'sphere', 'pyramid']
        },
        labels: {
          type: 'array',
          items: { type: 'string' },
          description: 'Optional replacement label strings mapped in order onto the preset/default shape labels'
        },
        shapes: { type: 'array', description: 'Full ShapeDef array for advanced customization' },
        dimCm: { type: 'object', properties: { width: { type: 'number' }, height: { type: 'number' } } },
        fontSize: { type: 'number' }
      }
    },
    example: {
      preset: 'right-triangle',
      labels: ['3 cm', '4 cm', '$x$']
    }
  },
  {
    slug: 'box-builder',
    aliases: ['boxes', 'fill-in-blanks', 'equation-boxes', 'BoxBuilder', 'Box Builder'],
    page: Page.BoxBuilder,
    appId: 'BoxBuilder',
    svgId: 'box-svg',
    name: 'Box Builder',
    category: 'diagrams',
    description: 'Render worksheet equations, fractions, and matrices containing fillable answer boxes (\\box, \\mat).',
    defaultWidthCm: 15,
    defaultHeightCm: 10,
    schema: {
      type: 'object',
      properties: {
        equations: { type: 'array', items: { type: 'string' }, description: 'Array of LaTeX strings with \\box placeholders e.g. "$y = \\box x + \\box$"' },
        blocks: {
          type: 'array',
          items: { type: 'object', required: ['latex'], properties: { latex: { type: 'string' } } }
        },
        fontSizePt: { type: 'number' },
        blockGap: { type: 'number' },
        dimCm: { type: 'object', properties: { width: { type: 'number' }, height: { type: 'number' } } }
      }
    },
    example: {
      equations: ['$y = \\box x + \\box$', '$\\frac{\\box}{5} = \\frac{12}{15}$'],
      fontSizePt: 12
    }
  }
];

export function resolveToolSpec(identifier: string): AIToolSpec | undefined {
  const norm = identifier.trim().toLowerCase();
  return AI_TOOLS.find(
    (t) =>
      t.slug === norm ||
      t.appId.toLowerCase() === norm ||
      t.page.toLowerCase() === norm ||
      t.name.toLowerCase() === norm ||
      t.aliases.some((a) => a.toLowerCase() === norm)
  );
}

export function resolveToolByPage(page: Page): AIToolSpec | undefined {
  return AI_TOOLS.find((t) => t.page === page);
}

export function resolveToolByAppId(appId: string): AIToolSpec | undefined {
  return AI_TOOLS.find((t) => t.appId === appId);
}

// --- Statistical helper for BoxPlots auto-computation ---
function computeMedian(arr: number[]): number {
  const n = arr.length;
  if (n === 0) return 0;
  if (n % 2 === 1) return arr[(n - 1) / 2];
  return (arr[n / 2 - 1] + arr[n / 2]) / 2;
}

export function computeFiveNumberSummary(raw: string | number[], showOutliers = true) {
  const nums = (Array.isArray(raw) ? raw : String(raw).split(/[\s,]+/).map(Number))
    .filter((n) => typeof n === 'number' && isFinite(n))
    .sort((a, b) => a - b);
  if (nums.length < 2) return null;
  const n = nums.length;
  const median = computeMedian(nums);
  const mid = Math.floor(n / 2);
  const lower = nums.slice(0, mid);
  const upper = n % 2 === 1 ? nums.slice(mid + 1) : nums.slice(mid);
  const q1 = computeMedian(lower);
  const q3 = computeMedian(upper);
  const iqr = q3 - q1;
  let min = nums[0];
  let max = nums[n - 1];
  let outliers: number[] = [];
  if (showOutliers) {
    const lo = q1 - 1.5 * iqr;
    const hi = q3 + 1.5 * iqr;
    outliers = nums.filter((x) => x < lo || x > hi);
    const nonOut = nums.filter((x) => x >= lo && x <= hi);
    if (nonOut.length > 0) {
      min = nonOut[0];
      max = nonOut[nonOut.length - 1];
    } else {
      min = q1;
      max = q3;
    }
  }
  return { min, q1, median, q3, max, outliers };
}

function niceStep(span: number): number {
  if (!isFinite(span) || span <= 0) return 1;
  const rough = span / 6;
  const pow = Math.pow(10, Math.floor(Math.log10(rough)));
  const norm = rough / pow;
  if (norm <= 1.5) return 1 * pow;
  if (norm <= 3) return 2 * pow;
  if (norm <= 7) return 5 * pow;
  return 10 * pow;
}

/**
 * Syncs windowSettings <-> config ranges so pages whose useEffect reads windowSettings
 * respect AI-provided config.xRange / config.yRange / majorStep / subdivisions.
 */
function syncWindowAndConfig(merged: Record<string, any>, rawPayload: Record<string, any>) {
  const cfg = merged.config ? { ...merged.config } : undefined;
  const ws = merged.windowSettings ? { ...merged.windowSettings } : undefined;

  if (cfg && ws) {
    const rawCfg = rawPayload.config || {};
    const rawWs = rawPayload.windowSettings || {};

    if (rawCfg.xRange && !rawWs.xMin && !rawWs.xMax) {
      ws.xMin = String(rawCfg.xRange[0]);
      ws.xMax = String(rawCfg.xRange[1]);
    } else if (rawWs.xMin !== undefined || rawWs.xMax !== undefined) {
      const x0 = Number(ws.xMin);
      const x1 = Number(ws.xMax);
      if (isFinite(x0) && isFinite(x1) && x1 > x0) cfg.xRange = [x0, x1];
    }

    if (rawCfg.yRange && !rawWs.yMin && !rawWs.yMax) {
      ws.yMin = String(rawCfg.yRange[0]);
      ws.yMax = String(rawCfg.yRange[1]);
    } else if (rawWs.yMin !== undefined || rawWs.yMax !== undefined) {
      const y0 = Number(ws.yMin);
      const y1 = Number(ws.yMax);
      if (isFinite(y0) && isFinite(y1) && y1 > y0) cfg.yRange = [y0, y1];
    }

    if (rawCfg.majorStep && !rawWs.xStep && !rawWs.yStep) {
      ws.xStep = String(rawCfg.majorStep[0]);
      ws.yStep = String(rawCfg.majorStep[1]);
    } else if (rawWs.xStep !== undefined || rawWs.yStep !== undefined) {
      const sx = Number(ws.xStep);
      const sy = Number(ws.yStep);
      if (isFinite(sx) && sx > 0 && isFinite(sy) && sy > 0) cfg.majorStep = [sx, sy];
    }

    if (rawCfg.subdivisions && !rawWs.xSubdivisions && !rawWs.ySubdivisions) {
      ws.xSubdivisions = Number(rawCfg.subdivisions[0]) || 1;
      ws.ySubdivisions = Number(rawCfg.subdivisions[1]) || 1;
    }

    if (merged.dimCm) {
      cfg.targetWidth = Math.round(merged.dimCm.width * CM_TO_PX);
      cfg.targetHeight = Math.round(merged.dimCm.height * CM_TO_PX);
    }

    merged.config = cfg;
    merged.windowSettings = ws;
  }
}

/**
 * Smart Default Merger:
 * Accepts a concise AI payload (or full exported snapshot) and merges it cleanly onto
 * the tool's base default state so every required field is populated with valid defaults.
 */
export function normalizeToolPayload(
  toolIdentifier: string,
  rawInput: Record<string, any>,
  baseState?: Record<string, any>
): Record<string, any> {
  const spec = resolveToolSpec(toolIdentifier);
  if (!spec) return rawInput;

  // Unwrap `{ data: {...}, config: {...} }` envelope if caller used the envelope style
  const rawPayload: Record<string, any> =
    rawInput && typeof rawInput.data === 'object' && !Array.isArray(rawInput.data) && spec.slug !== 'dot-plots' && spec.slug !== 'frequency-tables'
      ? { ...rawInput.data, ...(rawInput.config ? { config: { ...(rawInput.data.config || {}), ...rawInput.config } } : {}), ...(rawInput.dimCm ? { dimCm: rawInput.dimCm } : {}) }
      : { ...rawInput };

  const merged: Record<string, any> = baseState ? JSON.parse(JSON.stringify(baseState)) : {};

  // Deep-merge top-level scalar/object overrides first
  for (const [key, val] of Object.entries(rawPayload)) {
    if (key === 'config' && merged.config && typeof val === 'object' && val !== null) {
      merged.config = { ...merged.config, ...val };
    } else if (key === 'windowSettings' && merged.windowSettings && typeof val === 'object' && val !== null) {
      merged.windowSettings = { ...merged.windowSettings, ...val };
    } else if (key === 'dimCm' && merged.dimCm && typeof val === 'object' && val !== null) {
      merged.dimCm = { ...merged.dimCm, ...val };
    } else if (key === 'pieConfig' && merged.pieConfig && typeof val === 'object' && val !== null) {
      merged.pieConfig = { ...merged.pieConfig, ...val };
    } else if (key === 'barStyle' && merged.barStyle && typeof val === 'object' && val !== null) {
      merged.barStyle = { ...merged.barStyle, ...val };
    } else {
      merged[key] = val;
    }
  }

  switch (spec.slug) {
    case 'function-grapher': {
      if (Array.isArray(rawPayload.functions)) {
        merged.functions = rawPayload.functions.map((f: any, idx: number) => {
          const expr = typeof f === 'string' ? f : f.expression ?? 'x';
          return {
            id: f.id || String(idx + 1),
            type: f.type || 'function',
            expression: expr,
            yExpression: f.yExpression,
            isParametric: Boolean(f.isParametric || f.yExpression),
            color: f.color || PALETTE[idx % PALETTE.length],
            strokeWidth: f.strokeWidth ?? 2.0,
            visible: f.visible ?? true,
            lineType: f.lineType || 'solid',
            domain: Array.isArray(f.domain) && f.domain.length === 2 ? [String(f.domain[0]), String(f.domain[1])] : ['', ''],
            domainInclusive: Array.isArray(f.domainInclusive) && f.domainInclusive.length === 2 ? f.domainInclusive : [true, true],
            isCollapsed: false,
            plotterType: f.plotterType || 'experimental'
          };
        });
      }
      if (Array.isArray(rawPayload.points)) {
        merged.points = rawPayload.points.map((p: any, idx: number) => ({
          id: p.id || `pt-${idx + 1}`,
          x: p.x ?? 0,
          y: p.y ?? 0,
          color: p.color || '#000000',
          size: p.size ?? 4,
          style: p.style || 'filled',
          label: p.label ?? '',
          visible: p.visible ?? true
        }));
      }
      if (Array.isArray(rawPayload.verticalLines)) {
        merged.verticalLines = rawPayload.verticalLines.map((l: any, idx: number) => ({
          id: l.id || `vl-${idx + 1}`,
          x: l.x ?? 0,
          color: l.color || '#dc2626',
          lineType: l.lineType || 'dashed',
          strokeWidth: l.strokeWidth ?? 1.5,
          visible: l.visible ?? true
        }));
      }
      if (Array.isArray(rawPayload.integrals)) {
        merged.integrals = rawPayload.integrals.map((ig: any, idx: number) => ({
          id: ig.id || `int-${idx + 1}`,
          functionId1: ig.functionId1 || '1',
          functionId2: ig.functionId2,
          functionIds: ig.functionIds,
          includeXAxis: ig.includeXAxis ?? (!ig.functionId2),
          shadingMode: ig.shadingMode || 'between',
          start: ig.start !== undefined ? String(ig.start) : '0',
          end: ig.end !== undefined ? String(ig.end) : '2',
          color: ig.color || '#3b82f6',
          opacity: ig.opacity ?? 0.25,
          visible: ig.visible ?? true
        }));
      }
      break;
    }

    case 'inequality-grapher': {
      if (Array.isArray(rawPayload.inequalities)) {
        merged.inequalities = rawPayload.inequalities.map((inq: any, idx: number) => ({
          id: inq.id || String(idx + 1),
          type: inq.type || 'y',
          expression: inq.expression ?? 'x',
          operator: inq.operator || '<=',
          color: inq.color || PALETTE[(idx + 1) % PALETTE.length],
          visible: inq.visible ?? true
        }));
      }
      break;
    }

    case 'number-line': {
      if (Array.isArray(rawPayload.intervals)) {
        merged.intervals = rawPayload.intervals.map((iv: any, idx: number) => ({
          id: iv.id || String(idx + 1),
          expression: typeof iv === 'string' ? iv : iv.expression ?? 'x > 0',
          color: iv.color || PALETTE[idx % PALETTE.length],
          visible: iv.visible ?? true,
          heightOffset: iv.heightOffset ?? idx + 1,
          label: iv.label ?? '',
          showLabel: iv.showLabel ?? Boolean(iv.label),
          strokeWidth: iv.strokeWidth ?? 2.5
        }));
      }
      break;
    }

    case 'box-plots': {
      const rawBoxes = rawPayload.boxPlots || rawPayload.boxes;
      if (Array.isArray(rawBoxes)) {
        const count = rawBoxes.length;
        const normalized = rawBoxes.map((b: any, idx: number) => {
          let stats = { min: b.min, q1: b.q1, median: b.median, q3: b.q3, max: b.max, outliers: b.outliers || [] };
          if (b.rawData !== undefined && (b.min === undefined || b.median === undefined)) {
            const computed = computeFiveNumberSummary(b.rawData, b.showOutliers ?? true);
            if (computed) stats = computed;
          }
          return {
            id: b.id || String(idx + 1),
            label: b.label ?? `Dataset ${idx + 1}`,
            min: Number(stats.min ?? 0),
            q1: Number(stats.q1 ?? 2),
            median: Number(stats.median ?? 5),
            q3: Number(stats.q3 ?? 8),
            max: Number(stats.max ?? 10),
            heightOffset: b.heightOffset ?? (count - idx),
            boxHeight: b.boxHeight ?? 35,
            color: b.color || '#f8fafc',
            visible: b.visible ?? true,
            labelPos: b.labelPos || 'top',
            labelOffset: b.labelOffset,
            useRawData: Boolean(b.rawData),
            rawData: Array.isArray(b.rawData) ? b.rawData.join(', ') : b.rawData,
            showOutliers: b.showOutliers ?? (stats.outliers.length > 0),
            outliers: stats.outliers
          };
        });
        merged.boxPlots = normalized;

        // Auto-fit xRange and yRange if AI didn't explicitly provide them
        if (!rawPayload.config?.xRange && !rawPayload.windowSettings?.xMin && normalized.length > 0) {
          const allVals = normalized.flatMap((b: any) => [b.min, b.max, ...(b.outliers || [])]);
          const minV = Math.min(...allVals);
          const maxV = Math.max(...allVals);
          const span = Math.max(1, maxV - minV);
          const step = niceStep(span);
          const xMin = Math.floor((minV - step * 0.5) / step) * step;
          const xMax = Math.ceil((maxV + step * 0.5) / step) * step;
          merged.config = { ...(merged.config || {}), xRange: [xMin, xMax], majorStep: [step, 1], yRange: [0, count + 1] };
          rawPayload.config = { ...(rawPayload.config || {}), xRange: [xMin, xMax], majorStep: [step, 1], yRange: [0, count + 1] };
        }
      }
      break;
    }

    case 'histograms': {
      if (Array.isArray(rawPayload.rawData)) {
        merged.rawData = rawPayload.rawData.join(', ');
        if (!rawPayload.inputMode) merged.inputMode = 'raw';
      } else if (typeof rawPayload.rawData === 'string' && !rawPayload.inputMode) {
        merged.inputMode = 'raw';
      }
      if (Array.isArray(rawPayload.tableData)) {
        merged.tableData = rawPayload.tableData.map((row: any, idx: number) => ({
          id: row.id || String(idx + 1),
          xMin: String(row.xMin),
          xMax: String(row.xMax),
          frequency: String(row.frequency)
        }));
        if (!rawPayload.inputMode) merged.inputMode = 'table';
      }
      break;
    }

    case 'scatter-plots': {
      if (Array.isArray(rawPayload.points)) {
        merged.rawData = rawPayload.points
          .map((pt: any) => (Array.isArray(pt) ? `${pt[0]}\t${pt[1]}` : `${pt.x}\t${pt.y}`))
          .join('\n');
      }
      break;
    }

    case 'stem-and-leaf': {
      if (Array.isArray(rawPayload.data1)) {
        merged.data1 = rawPayload.data1.join(', ');
      }
      if (Array.isArray(rawPayload.data2)) {
        merged.data2 = rawPayload.data2.join(', ');
      } else if (rawPayload.data1 !== undefined && rawPayload.data2 === undefined) {
        merged.data2 = '';
      }
      break;
    }

    case 'visual-quartiles': {
      if (Array.isArray(rawPayload.rawData)) {
        merged.rawData = rawPayload.rawData.join(', ');
      }
      break;
    }

    case 'pie-charts': {
      if (Array.isArray(rawPayload.slices)) {
        merged.slices = rawPayload.slices.map((s: any, idx: number) => ({
          id: s.id || String(idx + 1),
          label: s.label ?? `Slice ${idx + 1}`,
          value: Number(s.value ?? 1),
          color: s.color || BAR_PALETTE[idx % BAR_PALETTE.length],
          pattern: s.pattern || 'none',
          explodeOffset: Number(s.explodeOffset ?? 0),
          visible: s.visible ?? true
        }));
      }
      break;
    }

    case 'segmented-bar-charts': {
      if (Array.isArray(rawPayload.bars)) {
        merged.bars = rawPayload.bars.map((bar: any, bIdx: number) => ({
          id: bar.id || `bar-${bIdx + 1}`,
          label: bar.label ?? `Bar ${bIdx + 1}`,
          width: bar.width ?? 0.6,
          segments: (bar.segments || []).map((seg: any, sIdx: number) => ({
            id: seg.id || `seg-${bIdx + 1}-${sIdx + 1}`,
            label: seg.label ?? `Group ${sIdx + 1}`,
            value: Number(seg.value ?? 0),
            color: seg.color || BAR_PALETTE[sIdx % BAR_PALETTE.length],
            pattern: seg.pattern || 'none',
            patternColor: seg.patternColor || '#000000'
          }))
        }));
      }
      break;
    }

    case 'bar-charts': {
      if (Array.isArray(rawPayload.labels) && Array.isArray(rawPayload.values) && !rawPayload.categories) {
        const seriesId = 's1';
        merged.series = [
          {
            id: seriesId,
            label: rawPayload.seriesLabel || 'Value',
            color: rawPayload.color || '#3b82f6',
            pattern: 'none'
          }
        ];
        merged.categories = rawPayload.labels.map((lbl: string, idx: number) => ({
          id: `c-${idx + 1}`,
          label: String(lbl),
          values: { [seriesId]: Number(rawPayload.values[idx] ?? 0) }
        }));
        if (rawPayload.showLegend === undefined) merged.showLegend = false;
      } else {
        if (Array.isArray(rawPayload.series)) {
          merged.series = rawPayload.series.map((s: any, idx: number) => ({
            id: s.id || `s${idx + 1}`,
            label: s.label ?? `Series ${idx + 1}`,
            color: s.color || BAR_PALETTE[idx % BAR_PALETTE.length],
            pattern: s.pattern || 'none'
          }));
        }
        if (Array.isArray(rawPayload.categories)) {
          const seriesList = merged.series || [];
          merged.categories = rawPayload.categories.map((c: any, idx: number) => {
            const vals: Record<string, number> = {};
            if (Array.isArray(c.values)) {
              c.values.forEach((v: number, sIdx: number) => {
                const sid = seriesList[sIdx]?.id || `s${sIdx + 1}`;
                vals[sid] = Number(v);
              });
            } else if (c.values && typeof c.values === 'object') {
              for (const [k, v] of Object.entries(c.values)) {
                const matchedSeries = seriesList.find((s: any) => s.id === k || s.label === k);
                vals[matchedSeries ? matchedSeries.id : k] = Number(v);
              }
            }
            return {
              id: c.id || `c-${idx + 1}`,
              label: c.label ?? `Cat ${idx + 1}`,
              values: vals
            };
          });
        }
      }
      break;
    }

    case 'dot-plots': {
      if (rawPayload.rawData !== undefined && !rawPayload.data) {
        const nums = (Array.isArray(rawPayload.rawData)
          ? rawPayload.rawData
          : String(rawPayload.rawData).split(/[\s,]+/).map(Number)
        ).filter((n) => typeof n === 'number' && isFinite(n));
        const counts = new Map<number, number>();
        nums.forEach((n) => counts.set(n, (counts.get(n) || 0) + 1));
        merged.data = Array.from(counts.entries())
          .sort((a, b) => a[0] - b[0])
          .map(([value, frequency], idx) => ({ id: String(idx + 1), value, frequency }));
      } else if (Array.isArray(rawPayload.data)) {
        merged.data = rawPayload.data.map((d: any, idx: number) => ({
          id: d.id || String(idx + 1),
          value: Number(d.value),
          frequency: Number(d.frequency)
        }));
      }
      if (Array.isArray(merged.data) && merged.data.length > 0 && !rawPayload.config?.xRange && !rawPayload.windowSettings?.xMin) {
        const vals = merged.data.map((d: any) => d.value);
        const freqs = merged.data.map((d: any) => d.frequency);
        const minV = Math.min(...vals);
        const maxV = Math.max(...vals);
        const maxF = Math.max(...freqs, 5);
        const step = niceStep(Math.max(1, maxV - minV));
        merged.config = {
          ...(merged.config || {}),
          xRange: [minV - step, maxV + step],
          yRange: [0, maxF + 2],
          majorStep: [step, 1]
        };
        rawPayload.config = {
          ...(rawPayload.config || {}),
          xRange: [minV - step, maxV + step],
          yRange: [0, maxF + 2],
          majorStep: [step, 1]
        };
      }
      break;
    }

    case 'frequency-tables': {
      if (Array.isArray(rawPayload.rawData) && !rawPayload.data) {
        const counts = new Map<string, number>();
        rawPayload.rawData.forEach((item: any) => {
          const k = String(item);
          counts.set(k, (counts.get(k) || 0) + 1);
        });
        merged.data = Array.from(counts.entries()).map(([category, frequency], idx) => ({
          id: String(idx + 1),
          category,
          frequency
        }));
      } else if (Array.isArray(rawPayload.data)) {
        merged.data = rawPayload.data.map((r: any, idx: number) => ({
          id: r.id || String(idx + 1),
          category: String(r.category ?? `Item ${idx + 1}`),
          frequency: Number(r.frequency ?? 0)
        }));
      }
      break;
    }

    case 'network-grapher': {
      const cw = Number(merged.canvasWidth || 378);
      const ch = Number(merged.canvasHeight || 302);
      const vertexStyle = merged.globalVertexStyle || 'inside';
      const nodeRadius = Number(merged.globalNodeRadius || 5);
      const edgeProx = Number(merged.globalEdgeLabelProximity || 8);
      const vertProx = Number(merged.globalVertexLabelProximity || 15);
      const clearance = Number(merged.edgeLabelClearanceRatio || 1.5);

      if (typeof rawPayload.matrix === 'string' && rawPayload.matrix.trim()) {
        const parsed = parseAdjacencyMatrix(rawPayload.matrix);
        if (parsed && parsed.labels.length > 0) {
          const built = buildGraphFromMatrix({
            matrix: parsed.matrix,
            labels: parsed.labels,
            matrixStr: rawPayload.matrix,
            isDirected: Boolean(rawPayload.isDirectedGeneral),
            showWeights: rawPayload.showMatrixWeights ?? true,
            preserveNodePositions: false,
            existingNodes: [],
            canvasWidth: cw,
            canvasHeight: ch,
            globalVertexStyle: vertexStyle,
            globalNodeRadius: nodeRadius,
            globalEdgeLabelProximity: edgeProx,
            globalVertexLabelProximity: vertProx,
            edgeLabelClearanceRatio: clearance
          });
          merged.nodes = built.nodes;
          merged.edges = built.edges;
          merged.matrixInput = rawPayload.matrix;
        }
      } else if (Array.isArray(rawPayload.nodes)) {
        const count = rawPayload.nodes.length;
        const cx = cw / 2;
        const cy = ch / 2;
        const layoutR = Math.min(cw, ch) * 0.34;
        const displayRadius = vertexStyle === 'inside' ? nodeRadius * 2.5 : nodeRadius;

        const builtNodes: NetworkNode[] = rawPayload.nodes.map((n: any, idx: number) => {
          const angle = (idx / Math.max(1, count)) * Math.PI * 2 - Math.PI / 2;
          return {
            id: n.id || n.label || `n-${idx + 1}`,
            label: n.label ?? String.fromCharCode(65 + (idx % 26)),
            x: typeof n.x === 'number' ? n.x : Math.round(cx + layoutR * Math.cos(angle)),
            y: typeof n.y === 'number' ? n.y : Math.round(cy + layoutR * Math.sin(angle)),
            radius: n.radius ?? displayRadius,
            labelStyle: n.labelStyle || vertexStyle,
            labelOffset: n.labelOffset || { x: 0, y: 0 }
          };
        });

        const findNodeId = (ref: string) => {
          const found = builtNodes.find((n) => n.id === ref || n.label === ref);
          return found ? found.id : ref;
        };

        const builtEdges: NetworkEdge[] = Array.isArray(rawPayload.edges)
          ? rawPayload.edges.map((e: any, idx: number) => {
              const fromId = findNodeId(String(e.from ?? e.source));
              const toId = findNodeId(String(e.to ?? e.target));
              const rawLbl = e.label ?? e.weight ?? '';
              const numWeight = rawLbl !== '' && isFinite(Number(rawLbl)) ? Number(rawLbl) : undefined;
              return {
                id: e.id || `e-${idx + 1}`,
                from: fromId,
                to: toId,
                label: String(rawLbl),
                weight: numWeight,
                isDirected: e.isDirected ?? Boolean(rawPayload.isDirectedGeneral),
                isDummy: Boolean(e.isDummy),
                isCurve: Boolean(e.isCurve || e.cp1),
                cp1: e.cp1,
                labelOffset: e.labelOffset,
                isLoop: e.isLoop ?? fromId === toId
              };
            })
          : [];

        const optimized = optimizeLabelPlacements(
          builtNodes,
          builtEdges,
          edgeProx,
          vertProx,
          clearance,
          vertexStyle,
          nodeRadius,
          'all'
        );
        merged.nodes = optimized.nodes;
        merged.edges = optimized.edges;
      }
      break;
    }

    case 'venn-diagrams': {
      const baseVenn: VennState = { ...DEFAULT_VENN_STATE, ...(merged as Partial<VennState>) };
      const numSets = (rawPayload.numSets === 1 || rawPayload.numSets === 2 || rawPayload.numSets === 3
        ? rawPayload.numSets
        : baseVenn.numSets) as 1 | 2 | 3;
      const shapeType = rawPayload.shapeType || baseVenn.shapeType || 'circle';
      const topology = rawPayload.topology || baseVenn.topology || 'standard';
      const dimCm = rawPayload.dimCm || baseVenn.dimCm || DEFAULT_VENN_STATE.dimCm;

      let sets = baseVenn.sets;
      if (rawPayload.numSets || rawPayload.shapeType || rawPayload.topology || !sets || sets.length < numSets) {
        sets = generatePresetSets(
          numSets,
          shapeType,
          topology,
          baseVenn.sets,
          dimCm,
          Boolean(baseVenn.chartTitle)
        );
      }

      if (Array.isArray(rawPayload.labels)) {
        sets = sets.map((s, idx) => ({
          ...s,
          label: rawPayload.labels[idx] !== undefined ? String(rawPayload.labels[idx]) : s.label
        }));
      }

      const baseRegionsSource =
        (baseState as Partial<VennState> | undefined)?.regions || DEFAULT_VENN_STATE.regions;
      const regions: Record<number, any> = JSON.parse(JSON.stringify(baseRegionsSource));
      if (rawPayload.regions && typeof rawPayload.regions === 'object') {
        for (const [maskKey, val] of Object.entries(rawPayload.regions)) {
          const m = Number(maskKey);
          if (!isNaN(m) && regions[m]) {
            if (typeof val === 'string' || typeof val === 'number') {
              regions[m] = { ...regions[m], value: String(val) };
            } else if (val && typeof val === 'object') {
              regions[m] = { ...regions[m], ...(val as Record<string, any>) };
            }
          }
        }
      }

      if (Array.isArray(rawPayload.shadedMasks)) {
        const shadedSet = new Set(rawPayload.shadedMasks.map(Number));
        Object.keys(regions).forEach((k) => {
          const m = Number(k);
          regions[m] = { ...regions[m], shaded: shadedSet.has(m) };
        });
      }

      merged.numSets = numSets;
      merged.shapeType = shapeType;
      merged.topology = topology;
      merged.dimCm = dimCm;
      merged.sets = sets;
      merged.regions = regions;
      break;
    }

    case 'tree-diagrams': {
      if (Array.isArray(rawPayload.bagItems)) {
        merged.bagItems = rawPayload.bagItems.map((item: any, idx: number) => ({
          id: item.id || String(idx + 1),
          label: String(item.label ?? `Item ${idx + 1}`),
          count: Number(item.count ?? 1)
        }));
        if (!rawPayload.mode) merged.mode = 'bag';
      }
      if (Array.isArray(rawPayload.customSteps)) {
        merged.customSteps = rawPayload.customSteps.map((step: any, sIdx: number) => ({
          id: step.id || `s${sIdx + 1}`,
          name: String(step.name ?? `Step ${sIdx + 1}`),
          outcomes: (step.outcomes || []).map((o: any, oIdx: number) => ({
            id: o.id || `o-${sIdx + 1}-${oIdx + 1}`,
            label: String(o.label ?? `O${oIdx + 1}`),
            num: Number(o.num ?? 1),
            den: Number(o.den ?? 2)
          }))
        }));
        if (!rawPayload.mode) merged.mode = 'custom';
      }
      break;
    }

    case 'shape-builder': {
      const dim = merged.dimCm || { width: 15, height: 15 };
      const cx = Math.round((dim.width * CM_TO_PX) / 2);
      const cy = Math.round((dim.height * CM_TO_PX) / 2);
      const fs = Number(merged.fontSize || 11);

      if (!Array.isArray(rawPayload.shapes) && (rawPayload.preset || rawPayload.shapeType)) {
        let shape;
        if (rawPayload.preset) {
          const q = String(rawPayload.preset).toLowerCase();
          const found =
            SHAPE_PRESETS.find((p) => p.id.toLowerCase() === q) ||
            SHAPE_PRESETS.find((p) => p.id.toLowerCase().includes(q) || p.name.toLowerCase().includes(q));
          if (found) {
            shape = found.create(cx, cy, fs);
          }
        }
        if (!shape && rawPayload.shapeType) {
          shape = createDefaultShape(rawPayload.shapeType, cx, cy, fs);
        }
        if (shape) {
          if (Array.isArray(rawPayload.labels)) {
            shape = {
              ...shape,
              labels: shape.labels.map((lbl, idx) =>
                rawPayload.labels[idx] !== undefined ? { ...lbl, text: String(rawPayload.labels[idx]) } : lbl
              )
            };
          }
          merged.shapes = [shape];
        }
      }
      break;
    }

    case 'box-builder': {
      if (Array.isArray(rawPayload.equations) && !rawPayload.blocks) {
        merged.blocks = rawPayload.equations.map((latex: string, idx: number) => ({
          id: String(idx + 1),
          type: 'equation',
          latex: String(latex)
        }));
      } else if (Array.isArray(rawPayload.blocks)) {
        merged.blocks = rawPayload.blocks.map((b: any, idx: number) => ({
          id: b.id || String(idx + 1),
          type: 'equation',
          latex: String(b.latex ?? ''),
          boxSettings: b.boxSettings,
          boxOverrides: b.boxOverrides
        }));
      }
      break;
    }
  }

  syncWindowAndConfig(merged, rawPayload);
  return merged;
}
