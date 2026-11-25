import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import {
  GraphConfig,
  FunctionDef,
  PointDef,
  VerticalLineDef,
  IntegralDef,
  InequalityDef,
  IntervalDef,
  BoxPlotDef,
  HistogramBarDef,
  PieSliceDef,
  BarGroupDef,
  GroupedBarSeriesDef,
  GroupedBarCategoryDef
} from '../../types';
import {
  CARTESIAN_CONFIG,
  STATISTICS_CONFIG,
  NUMBER_LINE_CONFIG,
  GLOBAL_CONFIG
} from '../../config/graphDefaults';
import { CM_TO_PX } from '../../constants';
import { BaseGraphEngine } from '../graphBase';
import { TexEngine } from '../textRenderer';
import {
  renderFunctionPlots,
  renderPoints,
  renderVerticalLines,
  renderIntegrals,
  renderInequalities,
  renderHistograms,
  renderPieChart,
  renderBarChart,
  renderSegmentedBars,
  PieChartConfig
} from '../graphRenderers';
import { calculateLinearRegression, parseIntervalExpression } from '../mathAnalysis';
import { ptToSvgUnits } from '../imageExport';
import { NetworkCanvas } from '../../components/network/NetworkCanvas';
import { VennCanvas } from '../../components/venn/VennCanvas';
import {
  DEFAULT_STATE as DEFAULT_VENN_STATE,
  VennState,
  getBoxGeometryForCm,
  computeRegionCenters,
  computeSetLabelAnchors,
  computeVennTotals,
  getRegionMetaForSets,
  formatAsSimplifiedFraction
} from '../vennLogic';
import { renderShape } from '../shape/renderer';
import { createDefaultShape } from '../shape/presets';
import { BOX_DEFAULTS } from '../../config/boxDefaults';
import { resolveToolSpec, normalizeToolPayload } from './toolRegistry';
import { sanitizeSvgMarkup } from './svgSanitizer';

export interface HeadlessRenderResult {
  svg: string;
  toolSlug: string;
  widthPx: number;
  heightPx: number;
  widthCm: number;
  heightCm: number;
}

const noop = () => {};

function buildGlobalScope(functions: FunctionDef[]): Record<string, number> {
  return {};
}

function wrapSvg(
  id: string,
  width: number,
  height: number,
  children: React.ReactNode,
  viewBox?: string
): React.ReactElement {
  let bgX = 0;
  let bgY = 0;
  let bgW = width;
  let bgH = height;
  if (viewBox) {
    const parts = viewBox.split(/\s+/).map(Number);
    if (parts.length === 4 && parts.every((n) => isFinite(n))) {
      [bgX, bgY, bgW, bgH] = parts;
    }
  }
  return React.createElement(
    'svg',
    {
      id,
      width: bgW,
      height: bgH,
      viewBox: viewBox || `0 0 ${width} ${height}`,
      xmlns: 'http://www.w3.org/2000/svg',
      style: { display: 'block', background: '#ffffff' }
    },
    React.createElement('rect', { x: bgX, y: bgY, width: bgW, height: bgH, fill: 'white' }),
    children
  );
}

/**
 * Expands the SVG viewBox slightly when arrow-end axis labels ("x", "y") extend
 * past [0, widthPixels] / [0, heightPixels], preventing edge clipping in headless SVG/PNG exports.
 */
function computeCartesianViewBox(engine: BaseGraphEngine): {
  viewBox: string;
  widthPx: number;
  heightPx: number;
} {
  let minX = 0;
  let minY = 0;
  let maxX = engine.widthPixels;
  let maxY = engine.heightPixels;
  const cfg = engine.cfg;
  const b = engine.getGridBoundaries();

  if (cfg.axisLabels?.[0] && cfg.xLabelStyle === 'arrow-end') {
    const m = engine.texEngine.measure(cfg.axisLabels[0], cfg.fontSize);
    const arrowEnd = Math.min(engine.widthPixels, b.xEnd + 25);
    const rightEdge = arrowEnd + 6 + (cfg.offsetXAxisLabelX || 0) + m.width + 8;
    maxX = Math.max(maxX, Math.ceil(rightEdge));
  }
  if (cfg.axisLabels?.[1] && cfg.yLabelStyle === 'arrow-end') {
    const m = engine.texEngine.measure(cfg.axisLabels[1], cfg.fontSize);
    const arrowTop = Math.max(0, b.yStart - 25);
    const topEdge = arrowTop - 8 + (cfg.offsetYAxisLabelY || 0) - m.height - 6;
    minY = Math.min(minY, Math.floor(topEdge));
  }

  const vbW = maxX - minX;
  const vbH = maxY - minY;
  return {
    viewBox: `${minX} ${minY} ${vbW} ${vbH}`,
    widthPx: vbW,
    heightPx: vbH
  };
}

/**
 * Renders any of the 18 Graph Maker Suite tools headlessly to clean, MS-Word-safe SVG markup.
 */
export function renderToolHeadlessSVG(
  toolIdentifier: string,
  rawPayload: Record<string, any> = {},
  options: { widthCm?: number; heightCm?: number } = {}
): HeadlessRenderResult {
  const spec = resolveToolSpec(toolIdentifier);
  if (!spec) {
    throw new Error(`Unknown GraphMaker tool: "${toolIdentifier}"`);
  }

  let svgElement: React.ReactElement;
  let widthPx = Math.round(spec.defaultWidthCm * CM_TO_PX);
  let heightPx = Math.round(spec.defaultHeightCm * CM_TO_PX);
  let widthCm = options.widthCm || rawPayload.dimCm?.width || spec.defaultWidthCm;
  let heightCm = options.heightCm || rawPayload.dimCm?.height || spec.defaultHeightCm;

  switch (spec.slug) {
    case 'function-grapher': {
      const base = {
        config: { ...CARTESIAN_CONFIG, layoutMode: 'fixed' as const, xRange: [-4, 4] as [number, number], yRange: [-4, 4] as [number, number], majorStep: [1, 1] as [number, number], subdivisions: [2, 2] as [number, number], axisLabels: ['$x$', '$y$'] as [string, string], offsetXAxisNumY: 3 },
        functions: [{ id: '1', expression: 'sin(x)', color: '#000000', strokeWidth: 2, visible: true, lineType: 'solid', domain: ['', ''], domainInclusive: [true, true], plotterType: 'experimental' }],
        points: [] as PointDef[],
        verticalLines: [] as VerticalLineDef[],
        integrals: [] as IntegralDef[],
        dimCm: { width: 12, height: 12 },
        windowSettings: { xMin: '-4', xMax: '4', yMin: '-4', yMax: '4', xStep: '1', yStep: '1', xSubdivisions: 2, ySubdivisions: 2 }
      };
      const st = normalizeToolPayload(spec.slug, rawPayload, base);
      widthCm = options.widthCm || st.dimCm.width;
      heightCm = options.heightCm || st.dimCm.height;
      const cfg: GraphConfig = {
        ...st.config,
        layoutMode: 'fixed',
        targetWidth: Math.round(st.dimCm.width * CM_TO_PX),
        targetHeight: Math.round(st.dimCm.height * CM_TO_PX)
      };
      const engine = new BaseGraphEngine(cfg);
      const vb = computeCartesianViewBox(engine);
      widthPx = vb.widthPx;
      heightPx = vb.heightPx;
      const scope = buildGlobalScope(st.functions);
      const b = engine.getGridBoundaries();

      svgElement = wrapSvg(
        spec.svgId,
        widthPx,
        heightPx,
        React.createElement(
          React.Fragment,
          null,
          React.createElement(
            'defs',
            null,
            React.createElement(
              'clipPath',
              { id: 'graph-clip' },
              React.createElement('rect', { x: b.xStart, y: b.yStart, width: b.xEnd - b.xStart, height: b.yEnd - b.yStart })
            )
          ),
          React.createElement('g', { className: 'grid-layer' }, engine.renderGrid()),
          React.createElement('g', { className: 'integrals-layer', clipPath: 'url(#graph-clip)' }, renderIntegrals(engine, st.integrals || [], st.functions || [], scope, st.verticalLines || [])),
          React.createElement('g', { className: 'axis-labels-layer' }, engine.renderLabels()),
          React.createElement('g', { className: 'axis-layer' }, engine.renderAxes()),
          React.createElement('g', { className: 'vlines-layer', clipPath: 'url(#graph-clip)' }, renderVerticalLines(engine, st.verticalLines || [], scope)),
          React.createElement('g', { className: 'functions-layer', clipPath: 'url(#graph-clip)' }, renderFunctionPlots(engine, st.functions || [], scope)),
          React.createElement('g', { className: 'points-layer' }, renderPoints(engine, st.points || [], scope))
        ),
        vb.viewBox
      );
      break;
    }

    case 'inequality-grapher': {
      const base = {
        config: { ...CARTESIAN_CONFIG, layoutMode: 'fixed' as const, xRange: [-5, 5] as [number, number], yRange: [-5, 5] as [number, number], majorStep: [1, 1] as [number, number], subdivisions: [2, 2] as [number, number] },
        inequalities: [{ id: '1', type: 'y', expression: '2x + 1', operator: '<=', color: '#2563eb', visible: true }] as InequalityDef[],
        showIntersection: false,
        showFullBoundary: false,
        globalStrokeWidth: 2,
        dimCm: { width: 12, height: 12 },
        windowSettings: { xMin: '-5', xMax: '5', yMin: '-5', yMax: '5', xStep: '1', yStep: '1', xSubdivisions: 2, ySubdivisions: 2 }
      };
      const st = normalizeToolPayload(spec.slug, rawPayload, base);
      widthCm = options.widthCm || st.dimCm.width;
      heightCm = options.heightCm || st.dimCm.height;
      const engine = new BaseGraphEngine({
        ...st.config,
        layoutMode: 'fixed',
        targetWidth: Math.round(st.dimCm.width * CM_TO_PX),
        targetHeight: Math.round(st.dimCm.height * CM_TO_PX)
      });
      const vb = computeCartesianViewBox(engine);
      widthPx = vb.widthPx;
      heightPx = vb.heightPx;
      const b = engine.getGridBoundaries();

      svgElement = wrapSvg(
        spec.svgId,
        widthPx,
        heightPx,
        React.createElement(
          React.Fragment,
          null,
          React.createElement(
            'defs',
            null,
            React.createElement(
              'clipPath',
              { id: 'ineq-clip' },
              React.createElement('rect', { x: b.xStart, y: b.yStart, width: b.xEnd - b.xStart, height: b.yEnd - b.yStart })
            )
          ),
          React.createElement('g', { className: 'grid-layer' }, engine.renderGrid()),
          React.createElement('g', { clipPath: 'url(#ineq-clip)' }, renderInequalities(engine, st.inequalities, 'fill', Boolean(st.showIntersection), Boolean(st.showFullBoundary), st.globalStrokeWidth)),
          React.createElement('g', { className: 'axis-labels-layer' }, engine.renderLabels()),
          React.createElement('g', { className: 'axis-layer' }, engine.renderAxes()),
          React.createElement('g', { clipPath: 'url(#ineq-clip)' }, renderInequalities(engine, st.inequalities, 'stroke', Boolean(st.showIntersection), Boolean(st.showFullBoundary), st.globalStrokeWidth))
        ),
        vb.viewBox
      );
      break;
    }

    case 'number-line': {
      const base = {
        config: { ...NUMBER_LINE_CONFIG, layoutMode: 'fixed' as const, xRange: [-5, 5] as [number, number], yRange: [0, 3] as [number, number], majorStep: [1, 1] as [number, number], subdivisions: [1, 1] as [number, number] },
        intervals: [{ id: '1', expression: '[-2, 3)', color: '#000000', visible: true, heightOffset: 1, label: '', showLabel: false, strokeWidth: 2.5 }] as IntervalDef[],
        dimCm: { width: 15, height: 6 },
        windowSettings: { xMin: '-5', xMax: '5', yMin: '0', yMax: '3', xStep: '1', yStep: '1', xSubdivisions: 1, ySubdivisions: 1 }
      };
      const st = normalizeToolPayload(spec.slug, rawPayload, base);
      const maxH = Math.max(2, ...(st.intervals || []).map((iv: IntervalDef) => (iv.heightOffset || 1) + 1));
      if (!rawPayload.config?.yRange) st.config.yRange = [0, maxH];
      widthCm = options.widthCm || st.dimCm.width;
      heightCm = options.heightCm || st.dimCm.height;
      const engine = new BaseGraphEngine({
        ...st.config,
        layoutMode: 'fixed',
        targetWidth: Math.round(st.dimCm.width * CM_TO_PX),
        targetHeight: Math.round(st.dimCm.height * CM_TO_PX)
      });
      widthPx = engine.widthPixels;
      heightPx = engine.heightPixels;
      const { xStart, xEnd } = engine.getGridBoundaries();
      const arrowW = 12;

      const intervalNodes = (st.intervals || [])
        .filter((iv: IntervalDef) => iv.visible && iv.expression)
        .map((iv: IntervalDef) => {
          const segments = parseIntervalExpression(iv.expression);
          const baselineY = engine.mathToScreen(0, iv.heightOffset)[1];
          const children: React.ReactNode[] = [];
          segments.forEach((seg, segIdx) => {
            const sx = seg.start === null ? xStart : engine.mathToScreen(seg.start, 0)[0];
            const ex = seg.end === null ? xEnd : engine.mathToScreen(seg.end, 0)[0];
            const lx1 = seg.start === null ? sx + arrowW : sx;
            const lx2 = seg.end === null ? ex - arrowW : ex;
            children.push(React.createElement('line', { key: `l-${segIdx}`, x1: lx1, y1: baselineY, x2: lx2, y2: baselineY, stroke: iv.color, strokeWidth: iv.strokeWidth }));
            if (seg.start === null) children.push(React.createElement('path', { key: `as-${segIdx}`, d: `M ${sx} ${baselineY} L ${sx + arrowW} ${baselineY - 5} L ${sx + arrowW} ${baselineY + 5} Z`, fill: iv.color }));
            if (seg.end === null) children.push(React.createElement('path', { key: `ae-${segIdx}`, d: `M ${ex} ${baselineY} L ${ex - arrowW} ${baselineY - 5} L ${ex - arrowW} ${baselineY + 5} Z`, fill: iv.color }));
            if (seg.start !== null) children.push(React.createElement('circle', { key: `cs-${segIdx}`, cx: sx, cy: baselineY, r: 5, fill: seg.startInclusive ? iv.color : 'white', stroke: iv.color, strokeWidth: 2 }));
            if (seg.end !== null) children.push(React.createElement('circle', { key: `ce-${segIdx}`, cx: ex, cy: baselineY, r: 5, fill: seg.endInclusive ? iv.color : 'white', stroke: iv.color, strokeWidth: 2 }));
          });
          if (iv.showLabel && iv.label && segments.length > 0) {
            const sx = segments[0].start === null ? xStart : engine.mathToScreen(segments[0].start, 0)[0];
            const ex = segments[segments.length - 1].end === null ? xEnd : engine.mathToScreen(segments[segments.length - 1].end, 0)[0];
            children.push(...engine.texEngine.renderToSVG(iv.label, (sx + ex) / 2, baselineY - 15, engine.cfg.fontSize, iv.color, 'middle', true));
          }
          return React.createElement('g', { key: iv.id }, children);
        });

      svgElement = wrapSvg(
        spec.svgId,
        widthPx,
        heightPx,
        React.createElement(
          React.Fragment,
          null,
          React.createElement('g', { className: 'grid-layer' }, engine.renderGrid()),
          React.createElement('g', { className: 'axis-labels-layer' }, engine.renderLabels()),
          React.createElement('g', { className: 'axis-layer' }, engine.renderAxes()),
          React.createElement('g', { className: 'intervals-layer' }, intervalNodes)
        )
      );
      break;
    }

    case 'box-plots': {
      const base = {
        config: {
          ...STATISTICS_CONFIG,
          layoutMode: 'fixed' as const,
          xRange: [60, 84] as [number, number],
          yRange: [0, 3] as [number, number],
          majorStep: [2, 1] as [number, number],
          subdivisions: [2, 1] as [number, number],
          showYAxis: false,
          showYNumbers: false,
          showYTicks: false,
          showHorizontalGrid: false,
          showMinorGrid: true,
          showBorder: true,
          axisLabels: ['Value', ''] as [string, string],
          verticalGridMode: 'upward' as const,
          showWhiskerCaps: false
        },
        boxPlots: [
          { id: '1', label: 'Sample A', min: 63, q1: 67, median: 71, q3: 75, max: 81, heightOffset: 2, boxHeight: 35, color: '#f8fafc', visible: true, labelPos: 'top' }
        ] as BoxPlotDef[],
        studentMode: false,
        dimCm: { width: 15, height: 10 },
        windowSettings: { xMin: '60', xMax: '84', yMin: '0', yMax: '3', xStep: '2', yStep: '1', xSubdivisions: 2, ySubdivisions: 1 }
      };
      const st = normalizeToolPayload(spec.slug, rawPayload, base);
      widthCm = options.widthCm || st.dimCm.width;
      heightCm = options.heightCm || st.dimCm.height;
      const engine = new BaseGraphEngine({
        ...st.config,
        layoutMode: 'fixed',
        targetWidth: Math.round(st.dimCm.width * CM_TO_PX),
        targetHeight: Math.round(st.dimCm.height * CM_TO_PX)
      });
      widthPx = engine.widthPixels;
      heightPx = engine.heightPixels;

      const boxNodes = st.studentMode
        ? []
        : (st.boxPlots || [])
            .filter((b: BoxPlotDef) => b.visible)
            .map((b: BoxPlotDef) => {
              const [, yC] = engine.mathToScreen(0, b.heightOffset);
              const [xMin] = engine.mathToScreen(b.min, 0);
              const [xQ1] = engine.mathToScreen(b.q1, 0);
              const [xMed] = engine.mathToScreen(b.median, 0);
              const [xQ3] = engine.mathToScreen(b.q3, 0);
              const [xMax] = engine.mathToScreen(b.max, 0);
              const halfH = (b.boxHeight || 35) / 2;
              const capH = halfH * 0.6;
              const parts: React.ReactNode[] = [
                React.createElement('line', { key: 'w1', x1: xMin, y1: yC, x2: xQ1, y2: yC, stroke: 'black', strokeWidth: 1.5 }),
                React.createElement('line', { key: 'w2', x1: xQ3, y1: yC, x2: xMax, y2: yC, stroke: 'black', strokeWidth: 1.5 }),
                React.createElement('line', { key: 'c1', x1: xMin, y1: yC - capH, x2: xMin, y2: yC + capH, stroke: 'black', strokeWidth: 1.5 }),
                React.createElement('line', { key: 'c2', x1: xMax, y1: yC - capH, x2: xMax, y2: yC + capH, stroke: 'black', strokeWidth: 1.5 }),
                React.createElement('rect', { key: 'box', x: xQ1, y: yC - halfH, width: Math.max(0, xQ3 - xQ1), height: halfH * 2, fill: b.color || '#f8fafc', stroke: 'black', strokeWidth: 1.5 }),
                React.createElement('line', { key: 'med', x1: xMed, y1: yC - halfH, x2: xMed, y2: yC + halfH, stroke: 'black', strokeWidth: 2 })
              ];
              if (b.showOutliers && Array.isArray(b.outliers)) {
                b.outliers.forEach((ov, oIdx) => {
                  const [ox] = engine.mathToScreen(ov, 0);
                  parts.push(React.createElement('circle', { key: `out-${oIdx}`, cx: ox, cy: yC, r: 3.5, fill: 'white', stroke: 'black', strokeWidth: 1.5 }));
                });
              }
              if (b.label && b.labelPos !== 'none') {
                const lx = b.labelPos === 'left' ? xMin - 12 + (b.labelOffset?.x || 0) : (xQ1 + xQ3) / 2 + (b.labelOffset?.x || 0);
                const ly = b.labelPos === 'left' ? yC + (b.labelOffset?.y || 0) : yC - halfH - 12 + (b.labelOffset?.y || 0);
                const align = b.labelPos === 'left' ? 'end' : 'middle';
                parts.push(...engine.texEngine.renderToSVG(b.label, lx, ly, engine.cfg.fontSize, 'black', align, true, 'text'));
              }
              return React.createElement('g', { key: b.id }, parts);
            });

      svgElement = wrapSvg(
        spec.svgId,
        widthPx,
        heightPx,
        React.createElement(
          React.Fragment,
          null,
          React.createElement('g', { className: 'grid-layer' }, engine.renderGrid()),
          React.createElement('g', { className: 'axis-labels-layer' }, engine.renderLabels()),
          React.createElement('g', { className: 'axis-layer' }, engine.renderAxes()),
          React.createElement('g', { className: 'data-layer' }, boxNodes)
        )
      );
      break;
    }

    case 'histograms': {
      const base = {
        config: { ...STATISTICS_CONFIG, layoutMode: 'fixed' as const, xRange: [0, 40] as [number, number], yRange: [0, 10] as [number, number], majorStep: [10, 2] as [number, number], subdivisions: [1, 1] as [number, number], axisLabels: ['Value', 'Frequency'] as [string, string] },
        inputMode: 'table',
        rawData: '',
        binWidth: 5,
        binStart: 0,
        tableData: [{ id: '1', xMin: '0', xMax: '10', frequency: '4' }, { id: '2', xMin: '10', xMax: '20', frequency: '9' }],
        barStyle: { fillColor: '#94a3b8', strokeColor: '#000000', strokeWidth: 1.5, opacity: 0.7 },
        studentMode: false,
        dimCm: { width: 14, height: 10 },
        windowSettings: { xMin: '0', xMax: '40', yMin: '0', yMax: '10', xStep: '10', yStep: '2', xSubdivisions: 1, ySubdivisions: 1 }
      };
      const st = normalizeToolPayload(spec.slug, rawPayload, base);
      let bars: HistogramBarDef[] = [];
      if (st.inputMode === 'raw' && st.rawData) {
        const nums = String(st.rawData).split(/[\s,]+/).map(Number).filter(isFinite);
        if (nums.length > 0) {
          const bw = Number(st.binWidth) > 0 ? Number(st.binWidth) : 5;
          const bStart = isFinite(Number(st.binStart)) ? Number(st.binStart) : Math.floor(Math.min(...nums) / bw) * bw;
          const maxN = Math.max(...nums);
          for (let x = bStart; x <= maxN + bw * 0.001; x += bw) {
            const freq = nums.filter((n) => n >= x && n < x + bw).length;
            bars.push({ xMin: x, xMax: x + bw, frequency: freq });
          }
        }
      } else {
        bars = (st.tableData || []).map((r: any) => ({
          xMin: Number(r.xMin),
          xMax: Number(r.xMax),
          frequency: Number(r.frequency)
        }));
      }
      if (bars.length > 0 && !rawPayload.config?.xRange && !rawPayload.windowSettings?.xMin) {
        st.config.xRange = [Math.min(...bars.map((b) => b.xMin)), Math.max(...bars.map((b) => b.xMax))];
        st.config.yRange = [0, Math.ceil(Math.max(...bars.map((b) => b.frequency), 5) * 1.15)];
      }
      widthCm = options.widthCm || st.dimCm.width;
      heightCm = options.heightCm || st.dimCm.height;
      const engine = new BaseGraphEngine({
        ...st.config,
        layoutMode: 'fixed',
        targetWidth: Math.round(st.dimCm.width * CM_TO_PX),
        targetHeight: Math.round(st.dimCm.height * CM_TO_PX)
      });
      widthPx = engine.widthPixels;
      heightPx = engine.heightPixels;

      svgElement = wrapSvg(
        spec.svgId,
        widthPx,
        heightPx,
        React.createElement(
          React.Fragment,
          null,
          React.createElement('g', { className: 'grid-layer' }, engine.renderGrid()),
          React.createElement('g', { className: 'bars-layer' }, renderHistograms(engine, bars, { ...st.barStyle, studentMode: st.studentMode })),
          React.createElement('g', { className: 'axis-labels-layer' }, engine.renderLabels()),
          React.createElement('g', { className: 'axis-layer' }, engine.renderAxes())
        )
      );
      break;
    }

    case 'scatter-plots': {
      const base = {
        config: { ...CARTESIAN_CONFIG, layoutMode: 'fixed' as const, xRange: [0, 10] as [number, number], yRange: [0, 12] as [number, number], majorStep: [1, 2] as [number, number], subdivisions: [1, 1] as [number, number], xAxisAt: 'bottom' as const, yAxisAt: 'left' as const, axisLabels: ['$x$', '$y$'] as [string, string] },
        rawData: '1\t2\n2\t3.5\n3\t5.1\n4\t6.8\n5\t8.2',
        showRegression: true,
        studentMode: false,
        dimCm: { width: 14, height: 10 },
        windowSettings: { xMin: '0', xMax: '10', yMin: '0', yMax: '12', xStep: '1', yStep: '2', xSubdivisions: 1, ySubdivisions: 1 }
      };
      const st = normalizeToolPayload(spec.slug, rawPayload, base);
      const pts: { x: number; y: number }[] = String(st.rawData || '')
        .split('\n')
        .map((line) => line.trim().split(/[\t,\s]+/).map(Number))
        .filter((pair) => pair.length >= 2 && isFinite(pair[0]) && isFinite(pair[1]))
        .map(([x, y]) => ({ x, y }));

      if (pts.length > 0 && !rawPayload.config?.xRange && !rawPayload.windowSettings?.xMin) {
        const xs = pts.map((p) => p.x);
        const ys = pts.map((p) => p.y);
        st.config.xRange = [Math.min(0, Math.floor(Math.min(...xs))), Math.ceil(Math.max(...xs) * 1.15)];
        st.config.yRange = [Math.min(0, Math.floor(Math.min(...ys))), Math.ceil(Math.max(...ys) * 1.15)];
      }

      widthCm = options.widthCm || st.dimCm.width;
      heightCm = options.heightCm || st.dimCm.height;
      const engine = new BaseGraphEngine({
        ...st.config,
        layoutMode: 'fixed',
        targetWidth: Math.round(st.dimCm.width * CM_TO_PX),
        targetHeight: Math.round(st.dimCm.height * CM_TO_PX)
      });
      widthPx = engine.widthPixels;
      heightPx = engine.heightPixels;

      const pointDefs: PointDef[] = st.studentMode
        ? []
        : pts.map((p, idx) => ({ id: `sp-${idx}`, x: p.x, y: p.y, color: '#000000', size: 3.5, style: 'filled', label: '', visible: true }));
      const reg = !st.studentMode && st.showRegression && pts.length >= 2 ? calculateLinearRegression(pts) : null;
      const regFuncs: FunctionDef[] = reg
        ? [{ id: 'reg', expression: `${reg.slope} * x + (${reg.intercept})`, color: '#2563eb', strokeWidth: 1.75, visible: true, lineType: 'solid', domain: ['', ''], domainInclusive: [true, true] }]
        : [];
      const b = engine.getGridBoundaries();

      svgElement = wrapSvg(
        spec.svgId,
        widthPx,
        heightPx,
        React.createElement(
          React.Fragment,
          null,
          React.createElement('defs', null, React.createElement('clipPath', { id: 'scatter-clip' }, React.createElement('rect', { x: b.xStart, y: b.yStart, width: b.xEnd - b.xStart, height: b.yEnd - b.yStart }))),
          React.createElement('g', { className: 'grid-layer' }, engine.renderGrid()),
          React.createElement('g', { className: 'axis-labels-layer' }, engine.renderLabels()),
          React.createElement('g', { className: 'axis-layer' }, engine.renderAxes()),
          React.createElement('g', { clipPath: 'url(#scatter-clip)' }, renderFunctionPlots(engine, regFuncs)),
          React.createElement('g', { className: 'points-layer' }, renderPoints(engine, pointDefs))
        )
      );
      break;
    }

    case 'pie-charts': {
      const base = {
        dimCm: { width: 14, height: 12 },
        chartTitle: 'Pie Chart',
        donutRatio: 0,
        studentMode: false,
        slices: [
          { id: '1', label: 'A', value: 15, color: '#3b82f6', explodeOffset: 0, visible: true },
          { id: '2', label: 'B', value: 10, color: '#ef4444', explodeOffset: 0, visible: true }
        ] as PieSliceDef[],
        pieConfig: {
          cx: 264, cy: 227, radius: 150, innerRadius: 0, startAngle: 0,
          strokeColor: '#ffffff', strokeColor2: '#ffffff', strokeWidth: 2,
          borderStyle: 'solid' as const, dashLength: 5, dashSpace: 5,
          labelType: 'combined' as const, labelPosition: 'outside' as const,
          labelRadiusOffset: 0, fontSize: 11, fontColor: '#000000'
        } as PieChartConfig
      };
      const st = normalizeToolPayload(spec.slug, rawPayload, base);
      widthCm = options.widthCm || st.dimCm.width;
      heightCm = options.heightCm || st.dimCm.height;
      widthPx = Math.round(st.dimCm.width * CM_TO_PX);
      heightPx = Math.round(st.dimCm.height * CM_TO_PX);
      const engine = new BaseGraphEngine({ ...GLOBAL_CONFIG, layoutMode: 'fixed', targetWidth: widthPx, targetHeight: heightPx, showBorder: false, showXAxis: false, showYAxis: false, showMajorGrid: false, showMinorGrid: false });
      const radius = Math.min(widthPx, heightPx) * 0.34;
      const pieCfg: PieChartConfig = {
        ...st.pieConfig,
        cx: widthPx / 2,
        cy: heightPx / 2 + (st.chartTitle ? 14 : 0),
        radius,
        innerRadius: radius * Math.max(0, Math.min(0.8, Number(st.donutRatio || 0))),
        studentMode: st.studentMode
      };
      const titleEls = st.chartTitle
        ? engine.texEngine.renderToSVG(st.chartTitle, widthPx / 2, 26, ptToSvgUnits(13), '#000000', 'middle', false, 'text')
        : [];

      svgElement = wrapSvg(
        spec.svgId,
        widthPx,
        heightPx,
        React.createElement(
          React.Fragment,
          null,
          ...titleEls,
          React.createElement('g', { className: 'pie-layer' }, renderPieChart(engine, st.slices, pieCfg))
        )
      );
      break;
    }

    case 'bar-charts': {
      const base = {
        config: {
          ...STATISTICS_CONFIG,
          layoutMode: 'fixed' as const,
          xRange: [0, 4] as [number, number],
          yRange: [0, 20] as [number, number],
          majorStep: [1, 5] as [number, number],
          subdivisions: [1, 1] as [number, number],
          showXNumbers: false,
          showXTicks: false,
          showVerticalGrid: false,
          axisLabels: ['Category', 'Frequency'] as [string, string]
        },
        chartTitle: '',
        series: [{ id: 's1', label: 'Series 1', color: '#3b82f6', pattern: 'none' }] as GroupedBarSeriesDef[],
        categories: [
          { id: 'c1', label: 'A', values: { s1: 12 } },
          { id: 'c2', label: 'B', values: { s1: 18 } }
        ] as GroupedBarCategoryDef[],
        worksheetMode: false,
        studentMode: false,
        barStrokeWidth: 1.5,
        barWidth: 0.6,
        showValues: false,
        showLegend: true,
        dimCm: { width: 14, height: 10 },
        windowSettings: { xMin: '0', xMax: '4', yMin: '0', yMax: '20', xStep: '1', yStep: '5', xSubdivisions: 1, ySubdivisions: 1 }
      };
      const st = normalizeToolPayload(spec.slug, rawPayload, base);
      const cats: GroupedBarCategoryDef[] = st.categories || [];
      const sers: GroupedBarSeriesDef[] = st.series || [];
      if (cats.length > 0) {
        st.config.xRange = [0, cats.length];
        if (!rawPayload.config?.yRange) {
          const maxV = Math.max(1, ...cats.flatMap((c) => Object.values(c.values || {})));
          st.config.yRange = [0, Math.ceil(maxV * 1.15)];
        }
      }
      widthCm = options.widthCm || st.dimCm.width;
      heightCm = options.heightCm || st.dimCm.height;
      const engine = new BaseGraphEngine({
        ...st.config,
        layoutMode: 'fixed',
        targetWidth: Math.round(st.dimCm.width * CM_TO_PX),
        targetHeight: Math.round(st.dimCm.height * CM_TO_PX)
      });
      widthPx = engine.widthPixels;
      heightPx = engine.heightPixels;
      const rendered = renderBarChart(engine, cats, sers, {
        barWidth: st.barWidth,
        worksheetMode: st.worksheetMode,
        studentMode: st.studentMode,
        strokeWidth: st.barStrokeWidth,
        showValues: st.showValues
      });
      const titleEls = st.chartTitle
        ? engine.texEngine.renderToSVG(st.chartTitle, widthPx / 2, 20, ptToSvgUnits(12), 'black', 'middle', false, 'text')
        : [];

      svgElement = wrapSvg(
        spec.svgId,
        widthPx,
        heightPx,
        React.createElement(
          React.Fragment,
          null,
          React.createElement('g', { className: 'grid-layer' }, engine.renderGrid()),
          React.createElement('g', { className: 'bars-layer' }, rendered.bars),
          React.createElement('g', { className: 'axis-labels-layer' }, engine.renderLabels()),
          React.createElement('g', { className: 'cat-labels-layer' }, rendered.labels),
          React.createElement('g', { className: 'axis-layer' }, engine.renderAxes()),
          ...titleEls
        )
      );
      break;
    }

    case 'segmented-bar-charts': {
      const base = {
        config: {
          ...STATISTICS_CONFIG,
          layoutMode: 'fixed' as const,
          xRange: [0, 2] as [number, number],
          yRange: [0, 100] as [number, number],
          majorStep: [1, 20] as [number, number],
          subdivisions: [1, 1] as [number, number],
          showXNumbers: false,
          showXTicks: false,
          showVerticalGrid: false,
          axisLabels: ['Group', 'Percentage (%)'] as [string, string]
        },
        chartTitle: '',
        bars: [] as BarGroupDef[],
        worksheetMode: false,
        studentMode: false,
        barStrokeWidth: 1.5,
        dimCm: { width: 14, height: 10 },
        windowSettings: { xMin: '0', xMax: '2', yMin: '0', yMax: '100', xStep: '1', yStep: '20', xSubdivisions: 1, ySubdivisions: 1 }
      };
      const st = normalizeToolPayload(spec.slug, rawPayload, base);
      const bars: BarGroupDef[] = st.bars || [];
      if (bars.length > 0) {
        st.config.xRange = [0, bars.length];
        if (!rawPayload.config?.yRange) {
          const maxSum = Math.max(10, ...bars.map((b) => b.segments.reduce((a, s) => a + s.value, 0)));
          st.config.yRange = [0, Math.ceil(maxSum * 1.05)];
        }
      }
      widthCm = options.widthCm || st.dimCm.width;
      heightCm = options.heightCm || st.dimCm.height;
      const engine = new BaseGraphEngine({
        ...st.config,
        layoutMode: 'fixed',
        targetWidth: Math.round(st.dimCm.width * CM_TO_PX),
        targetHeight: Math.round(st.dimCm.height * CM_TO_PX)
      });
      widthPx = engine.widthPixels;
      heightPx = engine.heightPixels;
      const rendered = renderSegmentedBars(engine, bars, {
        barSpacing: 0.4,
        worksheetMode: st.worksheetMode,
        studentMode: st.studentMode,
        strokeWidth: st.barStrokeWidth
      });

      svgElement = wrapSvg(
        spec.svgId,
        widthPx,
        heightPx,
        React.createElement(
          React.Fragment,
          null,
          React.createElement('g', { className: 'grid-layer' }, engine.renderGrid()),
          React.createElement('g', { className: 'bars-layer' }, rendered.bars),
          React.createElement('g', { className: 'axis-labels-layer' }, engine.renderLabels()),
          React.createElement('g', { className: 'cat-labels-layer' }, rendered.labels),
          React.createElement('g', { className: 'axis-layer' }, engine.renderAxes())
        )
      );
      break;
    }

    case 'dot-plots': {
      const base = {
        config: {
          ...STATISTICS_CONFIG,
          layoutMode: 'fixed' as const,
          xRange: [0, 10] as [number, number],
          yRange: [0, 10] as [number, number],
          majorStep: [1, 1] as [number, number],
          subdivisions: [1, 1] as [number, number],
          showYAxis: false,
          showYNumbers: false,
          showYTicks: false,
          showHorizontalGrid: false,
          showVerticalGrid: false,
          showBorder: false,
          axisLabels: ['Value', ''] as [string, string]
        },
        data: [{ id: '1', value: 2, frequency: 3 }, { id: '2', value: 3, frequency: 5 }],
        dotRadius: 6,
        dotColor: '#222222',
        dotSpacing: 16,
        yOffset: 15,
        studentMode: false,
        dimCm: { width: 15, height: 10 },
        windowSettings: { xMin: '0', xMax: '10', yMin: '0', yMax: '10', xStep: '1', yStep: '1', xSubdivisions: 1, ySubdivisions: 1 }
      };
      const st = normalizeToolPayload(spec.slug, rawPayload, base);
      widthCm = options.widthCm || st.dimCm.width;
      heightCm = options.heightCm || st.dimCm.height;
      const engine = new BaseGraphEngine({
        ...st.config,
        layoutMode: 'fixed',
        targetWidth: Math.round(st.dimCm.width * CM_TO_PX),
        targetHeight: Math.round(st.dimCm.height * CM_TO_PX)
      });
      widthPx = engine.widthPixels;
      heightPx = engine.heightPixels;
      const axisPos = engine.getAxisPositions();
      const baseLineY = axisPos.xAxisY ?? engine.getGridBoundaries().yEnd;

      const dots: React.ReactNode[] = [];
      if (!st.studentMode) {
        (st.data || []).forEach((row: { value: number; frequency: number }, rIdx: number) => {
          const [px] = engine.mathToScreen(row.value, 0);
          for (let k = 0; k < row.frequency; k++) {
            const py = baseLineY - st.yOffset - k * st.dotSpacing;
            dots.push(React.createElement('circle', { key: `dot-${rIdx}-${k}`, cx: px, cy: py, r: st.dotRadius, fill: st.dotColor }));
          }
        });
      }

      svgElement = wrapSvg(
        spec.svgId,
        widthPx,
        heightPx,
        React.createElement(
          React.Fragment,
          null,
          React.createElement('g', { className: 'grid-layer' }, engine.renderGrid()),
          React.createElement('g', { className: 'axis-labels-layer' }, engine.renderLabels()),
          React.createElement('g', { className: 'axis-layer' }, engine.renderAxes()),
          React.createElement('g', { className: 'dots-layer' }, dots)
        )
      );
      break;
    }

    case 'stem-and-leaf': {
      const base = {
        data1: '21, 24, 27, 32, 35, 38, 41',
        data2: '',
        config: { title: 'Stem and Leaf Plot', labelLeft: 'Group A', labelRight: 'Group B', showKey: true, splitFactor: 1, fontSize: 11, rowHeight: 20, columnWidth: 16, stemWidth: 32, studentMode: false },
        dimCm: { width: 15, height: 7 }
      };
      const st = normalizeToolPayload(spec.slug, rawPayload, base);
      const parseNums = (s: string) => String(s || '').split(/[\s,]+/).map(Number).filter(isFinite).sort((a, b) => a - b);
      const rightNums = parseNums(st.data1);
      const leftNums = parseNums(st.data2);
      const isBackToBack = leftNums.length > 0;
      const all = [...rightNums, ...leftNums];
      const minStem = all.length ? Math.floor(Math.min(...all) / 10) : 0;
      const maxStem = all.length ? Math.floor(Math.max(...all) / 10) : 5;
      const fs = ptToSvgUnits(st.config.fontSize || 11);
      const rowH = st.config.rowHeight || 22;
      const colW = st.config.columnWidth || 16;
      const stemW = st.config.stemWidth || 34;

      const rows: { stem: number; left: number[]; right: number[] }[] = [];
      for (let s = minStem; s <= maxStem; s++) {
        rows.push({
          stem: s,
          left: leftNums.filter((n) => Math.floor(n / 10) === s).map((n) => Math.abs(Math.floor(n)) % 10),
          right: rightNums.filter((n) => Math.floor(n / 10) === s).map((n) => Math.abs(Math.floor(n)) % 10)
        });
      }
      const maxLeft = Math.max(2, ...rows.map((r) => r.left.length));
      const maxRight = Math.max(3, ...rows.map((r) => r.right.length));
      const leftW = isBackToBack ? maxLeft * colW + 40 : 24;
      const rightW = maxRight * colW + 40;
      widthPx = Math.max(320, leftW + stemW + rightW + 40);
      const headerY = 46;
      heightPx = Math.max(180, headerY + rows.length * rowH + 54);
      widthCm = options.widthCm || st.dimCm.width;
      heightCm = options.heightCm || Number(((heightPx / widthPx) * widthCm).toFixed(2));
      const stemX = leftW + stemW / 2;
      const lineRightX = stemX + stemW / 2;
      const lineLeftX = stemX - stemW / 2;

      const els: React.ReactNode[] = [];
      if (st.config.title) {
        els.push(React.createElement('text', { key: 't', x: widthPx / 2, y: 22, textAnchor: 'middle', fontWeight: 'bold', fontSize: fs * 1.05, fontFamily: 'Times New Roman' }, st.config.title));
      }
      if (isBackToBack) {
        els.push(React.createElement('text', { key: 'll', x: lineLeftX - 10, y: headerY - 8, textAnchor: 'end', fontWeight: 'bold', fontSize: fs, fontFamily: 'Times New Roman' }, st.config.labelLeft || 'Left'));
        els.push(React.createElement('text', { key: 'lr', x: lineRightX + 10, y: headerY - 8, textAnchor: 'start', fontWeight: 'bold', fontSize: fs, fontFamily: 'Times New Roman' }, st.config.labelRight || 'Right'));
        els.push(React.createElement('line', { key: 'vl', x1: lineLeftX, y1: headerY, x2: lineLeftX, y2: headerY + rows.length * rowH + 6, stroke: 'black', strokeWidth: 1.5 }));
      }
      els.push(React.createElement('line', { key: 'vr', x1: lineRightX, y1: headerY, x2: lineRightX, y2: headerY + rows.length * rowH + 6, stroke: 'black', strokeWidth: 1.5 }));
      els.push(React.createElement('line', { key: 'hl', x1: isBackToBack ? 20 : lineLeftX, y1: headerY, x2: widthPx - 20, y2: headerY, stroke: 'black', strokeWidth: 1.5 }));

      rows.forEach((r, idx) => {
        const y = headerY + (idx + 1) * rowH;
        els.push(React.createElement('text', { key: `s-${idx}`, x: stemX, y, textAnchor: 'middle', fontWeight: 'bold', fontSize: fs, fontFamily: 'Times New Roman' }, String(r.stem)));
        if (!st.config.studentMode) {
          r.right.forEach((d, dIdx) => {
            els.push(React.createElement('text', { key: `r-${idx}-${dIdx}`, x: lineRightX + 14 + dIdx * colW, y, textAnchor: 'middle', fontSize: fs, fontFamily: 'Times New Roman' }, String(d)));
          });
          r.left.forEach((d, dIdx) => {
            els.push(React.createElement('text', { key: `l-${idx}-${dIdx}`, x: lineLeftX - 14 - dIdx * colW, y, textAnchor: 'middle', fontSize: fs, fontFamily: 'Times New Roman' }, String(d)));
          });
        }
      });

      if (st.config.showKey && all.length > 0) {
        const sample = all[0];
        const sVal = Math.floor(sample / 10);
        const lVal = Math.abs(Math.floor(sample)) % 10;
        els.push(React.createElement('text', { key: 'key', x: 24, y: heightPx - 14, fontSize: fs * 0.9, fontFamily: 'Times New Roman' }, `Key: ${sVal} | ${lVal} = ${sample}`));
      }

      svgElement = wrapSvg(spec.svgId, widthPx, heightPx, els);
      break;
    }

    case 'visual-quartiles': {
      const base = {
        rawData: '3, 4, 6, 8, 10, 12, 12, 15, 17',
        studentMode: false,
        config: { fontSize: 11, colMedian: '#FF0000', colQ1: '#0000FF', colQ3: '#0000FF', showLegend: true },
        dimCm: { width: 15, height: 8 }
      };
      const st = normalizeToolPayload(spec.slug, rawPayload, base);
      const sorted = String(st.rawData || '').split(/[\s,]+/).map(Number).filter(isFinite).sort((a, b) => a - b);
      const fs = ptToSvgUnits(st.config.fontSize || 11);
      const stepX = 44;
      widthPx = Math.max(360, sorted.length * stepX + 80);
      heightPx = 220;
      widthCm = options.widthCm || st.dimCm.width;
      heightCm = options.heightCm || Number(((heightPx / widthPx) * widthCm).toFixed(2));
      const baseY = 95;
      const startX = (widthPx - (sorted.length - 1) * stepX) / 2;

      const getMed = (arr: number[], off: number) => {
        const n = arr.length;
        if (n % 2 === 1) return { val: arr[(n - 1) / 2], idx: off + (n - 1) / 2, exact: true };
        return { val: (arr[n / 2 - 1] + arr[n / 2]) / 2, idx: off + n / 2 - 0.5, exact: false };
      };

      const els: React.ReactNode[] = sorted.map((val, i) =>
        React.createElement('text', { key: `n-${i}`, x: startX + i * stepX, y: baseY + fs * 0.35, textAnchor: 'middle', fontSize: fs * 1.15, fontFamily: 'Times New Roman' }, String(val))
      );

      if (!st.studentMode && sorted.length >= 2) {
        const n = sorted.length;
        const med = getMed(sorted, 0);
        const mid = Math.floor(n / 2);
        const q1 = getMed(sorted.slice(0, mid), 0);
        const q3 = getMed(n % 2 === 1 ? sorted.slice(mid + 1) : sorted.slice(mid), n % 2 === 1 ? mid + 1 : mid);

        const drawMark = (m: { val: number; idx: number; exact: boolean }, label: string, color: string, key: string) => {
          const x = startX + m.idx * stepX;
          if (m.exact) {
            els.push(React.createElement('circle', { key: `${key}-c`, cx: x, cy: baseY, r: 17, fill: 'none', stroke: color, strokeWidth: 2.5 }));
          } else {
            els.push(React.createElement('line', { key: `${key}-l`, x1: x, y1: baseY - 22, x2: x, y2: baseY + 22, stroke: color, strokeWidth: 2.5 }));
          }
          els.push(React.createElement('line', { key: `${key}-a`, x1: x, y1: baseY + 24, x2: x, y2: baseY + 52, stroke: color, strokeWidth: 1.5 }));
          els.push(React.createElement('text', { key: `${key}-t`, x, y: baseY + 70, textAnchor: 'middle', fill: color, fontWeight: 'bold', fontSize: fs, fontFamily: 'Times New Roman' }, `${label} = ${m.val}`));
        };

        drawMark(q1, 'Q1', st.config.colQ1 || '#0000FF', 'q1');
        drawMark(med, 'Median', st.config.colMedian || '#FF0000', 'med');
        drawMark(q3, 'Q3', st.config.colQ3 || '#0000FF', 'q3');
      }

      svgElement = wrapSvg(spec.svgId, widthPx, heightPx, els);
      break;
    }

    case 'frequency-tables': {
      const base = {
        categoryLabel: 'Category',
        data: [{ id: '1', category: 'Red', frequency: 7 }, { id: '2', category: 'Blue', frequency: 11 }],
        showTally: true,
        showTotal: true,
        studentMode: false,
        fontSize: 11
      };
      const st = normalizeToolPayload(spec.slug, rawPayload, base);
      const rows = st.data || [];
      const fs = ptToSvgUnits(st.fontSize || 11);
      const col1W = 140;
      const col2W = st.showTally ? 170 : 0;
      const col3W = 110;
      const tableW = col1W + col2W + col3W;
      const headerH = 42;
      const rowH = 36;
      const totalRows = rows.length + (st.showTotal ? 1 : 0);
      const tableH = headerH + totalRows * rowH;
      widthPx = tableW + 8;
      heightPx = tableH + 8;
      widthCm = options.widthCm || Number((widthPx / CM_TO_PX).toFixed(2));
      heightCm = options.heightCm || Number((heightPx / CM_TO_PX).toFixed(2));
      const totalFreq = rows.reduce((acc: number, r: any) => acc + Number(r.frequency || 0), 0);

      const renderTallyMarks = (count: number) => {
        const groups = Math.floor(count / 5);
        const rem = count % 5;
        const nodes: React.ReactNode[] = [];
        for (let g = 0; g < groups; g++) {
          const gx = g * 28;
          for (let i = 0; i < 4; i++) {
            nodes.push(React.createElement('line', { key: `g-${g}-${i}`, x1: gx + i * 5, y1: 0, x2: gx + i * 5, y2: 18, stroke: 'black', strokeWidth: 1.5 }));
          }
          nodes.push(React.createElement('line', { key: `g-${g}-s`, x1: gx - 2, y1: 16, x2: gx + 17, y2: 2, stroke: 'black', strokeWidth: 1.5 }));
        }
        const rx = groups * 28;
        for (let i = 0; i < rem; i++) {
          nodes.push(React.createElement('line', { key: `r-${i}`, x1: rx + i * 5, y1: 0, x2: rx + i * 5, y2: 18, stroke: 'black', strokeWidth: 1.5 }));
        }
        return nodes;
      };

      const content = React.createElement(
        'g',
        { transform: 'translate(4,4)', style: { fontFamily: 'sans-serif' } },
        React.createElement('rect', { x: 0, y: 0, width: tableW, height: tableH, fill: 'none', stroke: 'black', strokeWidth: 2 }),
        React.createElement('text', { x: col1W / 2, y: headerH / 2 + 5, textAnchor: 'middle', fontWeight: 'bold', fontSize: fs }, st.categoryLabel),
        st.showTally && React.createElement('text', { x: col1W + col2W / 2, y: headerH / 2 + 5, textAnchor: 'middle', fontWeight: 'bold', fontSize: fs }, 'Tally marks'),
        React.createElement('text', { x: col1W + col2W + col3W / 2, y: headerH / 2 + 5, textAnchor: 'middle', fontWeight: 'bold', fontSize: fs }, 'Frequency'),
        React.createElement('line', { x1: 0, y1: headerH, x2: tableW, y2: headerH, stroke: 'black', strokeWidth: 2 }),
        React.createElement('line', { x1: col1W, y1: 0, x2: col1W, y2: tableH, stroke: 'black', strokeWidth: 2 }),
        st.showTally && React.createElement('line', { x1: col1W + col2W, y1: 0, x2: col1W + col2W, y2: tableH, stroke: 'black', strokeWidth: 2 }),
        ...rows.map((row: any, i: number) => {
          const yTop = headerH + i * rowH;
          const yC = yTop + rowH / 2;
          return React.createElement(
            'g',
            { key: row.id || i },
            React.createElement('line', { x1: 0, y1: yTop + rowH, x2: tableW, y2: yTop + rowH, stroke: 'black', strokeWidth: 1 }),
            React.createElement('text', { x: col1W / 2, y: yC + 5, textAnchor: 'middle', fontSize: fs }, row.category),
            st.showTally && !st.studentMode && React.createElement('g', { transform: `translate(${col1W + 18}, ${yC - 9})` }, renderTallyMarks(row.frequency)),
            !st.studentMode && React.createElement('text', { x: col1W + col2W + col3W / 2, y: yC + 5, textAnchor: 'middle', fontSize: fs }, String(row.frequency))
          );
        }),
        st.showTotal &&
          React.createElement(
            'g',
            null,
            React.createElement('text', { x: col1W / 2, y: tableH - rowH / 2 + 5, textAnchor: 'middle', fontWeight: 'bold', fontSize: fs }, 'Total'),
            !st.studentMode && React.createElement('text', { x: col1W + col2W + col3W / 2, y: tableH - rowH / 2 + 5, textAnchor: 'middle', fontWeight: 'bold', fontSize: fs }, String(totalFreq))
          )
      );

      svgElement = wrapSvg(spec.svgId, widthPx, heightPx, content);
      break;
    }

    case 'network-grapher': {
      const base = {
        nodes: [],
        edges: [],
        cuts: [],
        globalVertexStyle: 'inside',
        canvasWidth: 378,
        canvasHeight: 302,
        globalEdgeThickness: 1.5,
        globalFontSize: 11,
        globalNodeRadius: 5,
        globalEdgeLabelProximity: 8,
        globalVertexLabelProximity: 15,
        edgeLabelClearanceRatio: 1.5
      };
      const st = normalizeToolPayload(spec.slug, rawPayload, base);
      widthPx = st.canvasWidth || 378;
      heightPx = st.canvasHeight || 302;
      widthCm = options.widthCm || Number((widthPx / CM_TO_PX).toFixed(2));
      heightCm = options.heightCm || Number((heightPx / CM_TO_PX).toFixed(2));

      svgElement = React.createElement(NetworkCanvas, {
        svgRef: { current: null },
        canvasWidth: widthPx,
        canvasHeight: heightPx,
        previewScale: 1,
        customViewBox: null,
        mode: 'select',
        nodes: st.nodes || [],
        edges: st.edges || [],
        cuts: st.cuts || [],
        selectedNodes: [],
        selectedEdges: [],
        selectedCuts: [],
        singleSelectedCut: null,
        edgeStartNode: null,
        hoveredNode: null,
        setHoveredNode: noop,
        mousePos: null,
        selectionBox: null,
        cropMode: false,
        cropSelectionBox: null,
        globalEdgeThickness: st.globalEdgeThickness,
        globalNodeRadius: st.globalNodeRadius,
        globalEdgeLabelProximity: st.globalEdgeLabelProximity,
        scaledFontSize: ptToSvgUnits(st.globalFontSize || 11, CM_TO_PX),
        debugEdgeLabels: false,
        onSvgPointerDown: noop,
        onCanvasContextMenu: noop,
        onNodePointerDown: noop,
        onNodeContextMenu: noop,
        onNodeLabelPointerDown: noop,
        onEdgePointerDown: noop,
        onEdgeContextMenu: noop,
        onEdgeCPPointerDown: noop,
        onEdgeLabelPointerDown: noop,
        onCutPointerDown: noop,
        onCutContextMenu: noop,
        onCutLabelPointerDown: noop,
        onCutElementPointerDown: noop
      });
      break;
    }

    case 'venn-diagrams': {
      const st = normalizeToolPayload(spec.slug, rawPayload, DEFAULT_VENN_STATE) as VennState;
      const companionW = st.numSets === 2 && st.showCompanionTable ? 210 : 0;
      const baseWidthPx = Math.round(st.dimCm.width * CM_TO_PX);
      widthPx = baseWidthPx + companionW;
      heightPx = Math.round(st.dimCm.height * CM_TO_PX);
      widthCm = options.widthCm || Number((widthPx / CM_TO_PX).toFixed(2));
      heightCm = options.heightCm || st.dimCm.height;
      const activeSets = st.sets.slice(0, st.numSets);
      const totalRegions = 1 << st.numSets;
      const boxGeometry = getBoxGeometryForCm(st.dimCm.width, st.dimCm.height, Boolean(st.chartTitle));
      const regionCenters = computeRegionCenters(
        boxGeometry,
        activeSets,
        st.numSets,
        st.shapeType,
        st.outsideValueCorner,
        totalRegions
      );
      const setLabelAnchors = computeSetLabelAnchors(
        activeSets,
        boxGeometry.cx,
        boxGeometry.cy,
        st.numSets,
        st.setLabelPosition,
        st.shapeType
      );
      const computedTotals = computeVennTotals(st.regions, st.numSets, totalRegions);
      const grandTotal = computedTotals.grandTotal;

      svgElement = React.createElement(VennCanvas, {
        state: st,
        activeSets,
        totalRegions,
        widthPixels: widthPx,
        heightPixels: heightPx,
        baseWidthPx,
        boxGeometry,
        regionCenters,
        setLabelAnchors,
        computedTotals,
        previewScale: 1,
        cropMode: false,
        selectionBox: null,
        customViewBox: null,
        canvasTool: 'manipulate',
        selectedSetId: 'all',
        setSelectedSetId: noop,
        getRegionMeta: (mask: number) => getRegionMetaForSets(st.numSets, activeSets, mask),
        formatDisplayValue: (rawVal: string | number | null) => {
          if (rawVal === null || rawVal === '') return '';
          if (st.valueDisplayMode === 'counts' || !grandTotal) return String(rawVal);
          const num = typeof rawVal === 'number' ? rawVal : parseFloat(rawVal);
          if (isNaN(num)) return String(rawVal);
          if (st.valueDisplayMode === 'probabilities-fraction') return formatAsSimplifiedFraction(num, grandTotal);
          return (num / grandTotal).toFixed(2);
        },
        handleSvgMouseDown: noop,
        handleSvgContextMenu: noop,
        openElementContextMenu: noop,
        navigateToGuiControl: noop,
        handleSetDragStart: noop,
        handleSetResizeStart: noop,
        handleBoxResizeStart: noop,
        handleRegionLabelDragStart: noop,
        handleSetLabelDragStart: noop,
        handleUniversalLabelDragStart: noop
      });
      break;
    }

    case 'tree-diagrams': {
      const base = {
        mode: 'custom',
        bagItems: [{ id: '1', label: 'Red', count: 5 }, { id: '2', label: 'Blue', count: 3 }],
        numDraws: 2,
        withReplacement: false,
        bagStepNames: ['First draw', 'Second draw', 'Third draw'],
        customSteps: [
          { id: 's1', name: 'Coin 1', outcomes: [{ id: 'o1', label: 'H', num: 1, den: 2 }, { id: 'o2', label: 'T', num: 1, den: 2 }] },
          { id: 's2', name: 'Coin 2', outcomes: [{ id: 'o3', label: 'H', num: 1, den: 2 }, { id: 'o4', label: 'T', num: 1, den: 2 }] }
        ],
        showProbabilities: true,
        showOutcomes: true,
        showCalculations: true,
        studentMode: false,
        fontSize: 11
      };
      const st = normalizeToolPayload(spec.slug, rawPayload, base);
      const tex = new TexEngine();
      const fs = ptToSvgUnits(st.fontSize || 11);

      interface TNode {
        label: string;
        num: number;
        den: number;
        pathLabels: string[];
        pathProbs: { num: number; den: number }[];
        children: TNode[];
      }

      const buildTree = (): TNode[] => {
        if (st.mode === 'bag') {
          const rec = (d: number, pl: string[], pp: { num: number; den: number }[], counts: Record<string, number>): TNode[] => {
            if (d >= st.numDraws) return [];
            const tot = Object.values(counts).reduce((a, b) => a + b, 0);
            if (tot <= 0) return [];
            return (st.bagItems || [])
              .filter((it: any) => (counts[it.id] || 0) > 0)
              .map((it: any) => {
                const c = counts[it.id] || 0;
                const next = { ...counts };
                if (!st.withReplacement) next[it.id] = Math.max(0, c - 1);
                const npl = [...pl, it.label];
                const npp = [...pp, { num: c, den: tot }];
                return { label: it.label, num: c, den: tot, pathLabels: npl, pathProbs: npp, children: rec(d + 1, npl, npp, next) };
              });
          };
          const initCounts = (st.bagItems || []).reduce((acc: Record<string, number>, it: any) => ({ ...acc, [it.id]: it.count }), {});
          return rec(0, [], [], initCounts);
        }
        const recC = (idx: number, pl: string[], pp: { num: number; den: number }[]): TNode[] => {
          if (idx >= (st.customSteps || []).length) return [];
          return st.customSteps[idx].outcomes.map((o: any) => {
            const npl = [...pl, o.label];
            const npp = [...pp, { num: o.num, den: o.den }];
            return { label: o.label, num: o.num, den: o.den, pathLabels: npl, pathProbs: npp, children: recC(idx + 1, npl, npp) };
          });
        };
        return recC(0, [], []);
      };

      const roots = buildTree();
      const countLeaves = (nodes: TNode[]): number =>
        nodes.reduce((sum, n) => sum + (n.children.length === 0 ? 1 : countLeaves(n.children)), 0);
      const totalLeaves = Math.max(1, countLeaves(roots));
      const numStages = st.mode === 'bag' ? st.numDraws : (st.customSteps || []).length;
      const stageW = 145;
      const leafH = 44;
      const topPad = 48;
      const leftPad = 30;
      const outcomeW = st.showOutcomes ? 110 : 0;
      const calcW = st.showCalculations ? 150 : 0;
      widthPx = leftPad + numStages * stageW + outcomeW + calcW + 30;
      heightPx = topPad + totalLeaves * leafH + 30;
      widthCm = options.widthCm || Number((widthPx / CM_TO_PX).toFixed(2));
      heightCm = options.heightCm || Number((heightPx / CM_TO_PX).toFixed(2));

      const els: React.ReactNode[] = [];
      for (let i = 0; i < numStages; i++) {
        const hdr = st.mode === 'custom' ? st.customSteps[i]?.name : st.bagStepNames?.[i] || `Draw ${i + 1}`;
        els.push(React.createElement('text', { key: `h-${i}`, x: leftPad + (i + 0.65) * stageW, y: 24, textAnchor: 'middle', fontWeight: 'bold', fontSize: fs, fontFamily: 'Times New Roman' }, hdr));
      }
      if (st.showOutcomes) {
        els.push(React.createElement('text', { key: 'ho', x: leftPad + numStages * stageW + 20, y: 24, fontWeight: 'bold', fontSize: fs, fontFamily: 'Times New Roman' }, 'Outcome'));
      }
      if (st.showCalculations) {
        els.push(React.createElement('text', { key: 'hc', x: leftPad + numStages * stageW + outcomeW + 20, y: 24, fontWeight: 'bold', fontSize: fs, fontFamily: 'Times New Roman' }, 'Probability'));
      }

      let leafCursor = 0;
      const layoutNode = (node: TNode, depth: number): number => {
        if (node.children.length === 0) {
          const y = topPad + leafCursor * leafH + leafH / 2;
          leafCursor++;
          return y;
        }
        const childYs = node.children.map((c) => layoutNode(c, depth + 1));
        return (childYs[0] + childYs[childYs.length - 1]) / 2;
      };

      const drawBranch = (parentX: number, parentY: number, nodes: TNode[], depth: number, yList: number[]) => {
        nodes.forEach((n, idx) => {
          const cy = yList[idx];
          const nx = leftPad + (depth + 1) * stageW;
          const lineEndX = nx - 28;
          els.push(React.createElement('line', { key: `br-${depth}-${idx}-${cy}`, x1: parentX, y1: parentY, x2: lineEndX, y2: cy, stroke: 'black', strokeWidth: 1.4 }));
          if (st.showProbabilities && !st.studentMode) {
            const mx = (parentX + lineEndX) / 2;
            const my = (parentY + cy) / 2 - 12;
            els.push(...tex.renderToSVG(`$\\frac{${n.num}}{${n.den}}$`, mx, my, fs * 0.85, '#1e293b', 'middle', true));
          }
          els.push(React.createElement('text', { key: `lbl-${depth}-${idx}-${cy}`, x: nx - 20, y: cy + fs * 0.35, fontSize: fs, fontFamily: 'Times New Roman' }, n.label));
          if (n.children.length > 0) {
            const cYs = n.children.map((c) => {
              // Find midpoint of child subtree
              const subLeaves = countLeaves([c]);
              return { c, subLeaves };
            });
            // Recompute exact child y positions deterministically
            let startY = cy - ((countLeaves([n]) - 1) * leafH) / 2;
            const exactChildYs = cYs.map(({ subLeaves }) => {
              const midY = startY + ((subLeaves - 1) * leafH) / 2;
              startY += subLeaves * leafH;
              return midY;
            });
            drawBranch(nx + 12, cy, n.children, depth + 1, exactChildYs);
          } else {
            if (st.showOutcomes && !st.studentMode) {
              els.push(React.createElement('text', { key: `out-${cy}`, x: leftPad + numStages * stageW + 20, y: cy + fs * 0.35, fontSize: fs, fontFamily: 'Times New Roman' }, n.pathLabels.join(', ')));
            }
            if (st.showCalculations && !st.studentMode) {
              const prodNum = n.pathProbs.reduce((a, p) => a * p.num, 1);
              const prodDen = n.pathProbs.reduce((a, p) => a * p.den, 1);
              const expr = `$${n.pathProbs.map((p) => `\\frac{${p.num}}{${p.den}}`).join('\\times')} = \\frac{${prodNum}}{${prodDen}}$`;
              els.push(...tex.renderToSVG(expr, leftPad + numStages * stageW + outcomeW + 20, cy, fs * 0.85, '#000000', 'start', false));
            }
          }
        });
      };

      const rootYs = roots.map((r) => layoutNode(r, 0));
      const rootOriginY = rootYs.length ? (rootYs[0] + rootYs[rootYs.length - 1]) / 2 : heightPx / 2;
      drawBranch(leftPad, rootOriginY, roots, 0, rootYs);

      svgElement = wrapSvg(spec.svgId, widthPx, heightPx, els);
      break;
    }

    case 'shape-builder': {
      const dim = rawPayload.dimCm || { width: 15, height: 15 };
      const fs = Number(rawPayload.fontSize || 11);
      const base = {
        shapes: [createDefaultShape('triangle', Math.round((dim.width * CM_TO_PX) / 2), Math.round((dim.height * CM_TO_PX) / 2), fs)],
        dimCm: dim,
        fontSize: fs
      };
      const st = normalizeToolPayload(spec.slug, rawPayload, base);
      widthCm = options.widthCm || st.dimCm.width;
      heightCm = options.heightCm || st.dimCm.height;
      widthPx = Math.round(st.dimCm.width * CM_TO_PX);
      heightPx = Math.round(st.dimCm.height * CM_TO_PX);

      const shapeNodes = (st.shapes || []).flatMap((sh: any) =>
        renderShape(sh, false, {}, null, false)
      );
      svgElement = wrapSvg(spec.svgId, widthPx, heightPx, shapeNodes);
      break;
    }

    case 'box-builder': {
      const base = {
        blocks: [{ id: '1', type: 'equation', latex: '$y = \\box + \\box x$' }],
        fontSizePt: 11,
        dimCm: { width: 15, height: 10 },
        blockGap: 40
      };
      const st = normalizeToolPayload(spec.slug, rawPayload, base);
      const tex = new TexEngine();
      const fs = ptToSvgUnits(st.fontSizePt || 11);
      widthCm = options.widthCm || st.dimCm.width;
      heightCm = options.heightCm || st.dimCm.height;
      widthPx = Math.round(st.dimCm.width * CM_TO_PX);
      const blocks = st.blocks || [];
      heightPx = Math.max(120, blocks.length * (st.blockGap + 48) + 60);
      const els: React.ReactNode[] = [];
      let curY = 55;
      blocks.forEach((b: any, idx: number) => {
        const nodes = tex.renderToSVG(
          b.latex || '',
          36,
          curY,
          fs,
          '#000000',
          'start',
          false,
          'text',
          false,
          { ...BOX_DEFAULTS, ...(b.boxSettings || {}) },
          b.boxOverrides ? { boxOverrides: b.boxOverrides } : undefined
        );
        els.push(React.createElement('g', { key: b.id || idx }, nodes));
        curY += st.blockGap + 44;
      });
      svgElement = wrapSvg(spec.svgId, widthPx, heightPx, els);
      break;
    }

    default:
      throw new Error(`Unsupported tool slug: ${spec.slug}`);
  }

  const rawMarkup = renderToStaticMarkup(svgElement);
  const svg = sanitizeSvgMarkup(rawMarkup, {
    widthCm: options.widthCm || widthCm,
    heightCm: options.heightCm || heightCm,
    svgId: spec.svgId
  });

  return {
    svg,
    toolSlug: spec.slug,
    widthPx,
    heightPx,
    widthCm,
    heightCm
  };
}
