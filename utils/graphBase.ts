
import React from 'react';
import { GraphConfig } from '../types';
import { TexEngine } from './textRenderer';
import { LAYOUT_DEFAULTS } from '../constants';
import * as math from 'mathjs';
import { ptToSvgUnits } from './imageExport';

/**
 * BaseGraphEngine: The "Set in Stone" Infrastructure.
 * Focuses ONLY on Layout, Coordinate Transforms, and the Background Frame (Grid/Axes).
 */
export class BaseGraphEngine {
  cfg: GraphConfig;
  texEngine: TexEngine;
  marginTop: number; marginBottom: number; marginLeft: number; marginRight: number;
  widthPixels: number; heightPixels: number;
  originX: number; originY: number;
  scaleX: number; scaleY: number; 
  tickH: number = LAYOUT_DEFAULTS.TICK_SIZE;

  constructor(config: GraphConfig) {
    this.cfg = { ...config, fontSize: ptToSvgUnits(config.fontSize || 12) };
    this.texEngine = new TexEngine();
    
    // Base margins from constants
    this.marginTop = LAYOUT_DEFAULTS.MARGIN_TOP;
    this.marginBottom = LAYOUT_DEFAULTS.MARGIN_BOTTOM;
    this.marginLeft = LAYOUT_DEFAULTS.MARGIN_LEFT;
    this.marginRight = this.cfg.marginRight ?? LAYOUT_DEFAULTS.MARGIN_RIGHT;

    // Adjust margins based on axis label requirements
    const xLbl = this.cfg.axisLabels[0];
    const yLbl = this.cfg.axisLabels[1];
    
    // Y-Axis Label Margin Adjustments
    if (yLbl) {
        // Measure in text mode
        const yMetrics = this.texEngine.measure(yLbl, this.cfg.fontSize);
        if (this.cfg.yLabelStyle === 'arrow-end') {
            this.marginTop += Math.max(0, yMetrics.height + LAYOUT_DEFAULTS.LABEL_PADDING - LAYOUT_DEFAULTS.MARGIN_TOP); // Ensure enough top space
        } else if (this.cfg.yLabelStyle === 'left-center') {
            const w = (this.cfg.yLabelRotation === 'vertical') ? yMetrics.height : yMetrics.width;
            this.marginLeft += w + 20;
        } else if (this.cfg.yLabelStyle === 'right-center') {
            const w = (this.cfg.yLabelRotation === 'vertical') ? yMetrics.height : yMetrics.width;
            this.marginRight += w + 20;
        }
    }

    // X-Axis Label Margin Adjustments
    if (xLbl) {
        // Measure in text mode
        const xMetrics = this.texEngine.measure(xLbl, this.cfg.fontSize);
        if (this.cfg.xLabelStyle === 'arrow-end') {
            this.marginRight += Math.max(0, xMetrics.width + LAYOUT_DEFAULTS.LABEL_PADDING - LAYOUT_DEFAULTS.MARGIN_RIGHT); // Ensure enough right space
        } else if (this.cfg.xLabelStyle === 'below-center') {
            this.marginBottom += xMetrics.height + 25;
        }
    }

    // Reserve break band inside the grid when Y-axis is broken so X-axis stays at the base
    const yZInit = this.cfg.yRange[0] <= 0 && this.cfg.yRange[1] >= 0;
    const breakBand = 26;
    const isYBrokenBottom = !yZInit && this.cfg.yRange[0] > 0 && !!this.cfg.breakYAxis && this.cfg.xAxisAt !== 'top';
    const isYBrokenTop = !yZInit && this.cfg.yRange[1] < 0 && !!this.cfg.breakYAxis && this.cfg.xAxisAt !== 'bottom';
    const activeBreakBand = (isYBrokenBottom || isYBrokenTop) ? breakBand : 0;

    const xDist = Math.max(1e-9, this.cfg.xRange[1] - this.cfg.xRange[0] || 1);
    const yDist = Math.max(1e-9, this.cfg.yRange[1] - this.cfg.yRange[0] || 1);

    if (this.cfg.layoutMode === 'fixed') {
        this.widthPixels = this.cfg.targetWidth || 500;
        this.heightPixels = this.cfg.targetHeight || 500;
        const gridW = Math.max(1, this.widthPixels - this.marginLeft - this.marginRight);
        const gridH = Math.max(1, this.heightPixels - this.marginTop - this.marginBottom - activeBreakBand);
        this.scaleX = gridW / xDist;
        this.scaleY = gridH / yDist;
    } else {
        const stepX = Math.max(1e-9, this.cfg.majorStep[0] || 1);
        const stepY = Math.max(1e-9, this.cfg.majorStep[1] || 1);
        this.scaleX = (this.cfg.basePixelSize || 50) / stepX;
        this.scaleY = (this.cfg.basePixelSize || 50) / stepY;
        this.widthPixels = this.marginLeft + (xDist * this.scaleX) + this.marginRight;
        this.heightPixels = this.marginTop + (yDist * this.scaleY) + activeBreakBand + this.marginBottom;
    }
    
    this.originX = this.marginLeft + (0 - (this.cfg.xRange[0] || 0)) * this.scaleX;
    this.originY = this.marginTop + (isYBrokenTop ? activeBreakBand : 0) + ((this.cfg.yRange[1] || 0) - 0) * this.scaleY;
  }
  
  // Convert math coordinates to screen pixels
  mathToScreen(x: number, y: number): [number, number] {
    const px = this.originX + (x || 0) * this.scaleX;
    const py = this.originY - (y || 0) * this.scaleY;
    return [isNaN(px) ? 0 : px, isNaN(py) ? 0 : py];
  }

  // Convert screen pixels to math coordinates
  screenToMath(px: number, py: number): [number, number] {
    const mx = (px - this.originX) / this.scaleX;
    const my = (this.originY - py) / this.scaleY;
    return [isNaN(mx) ? 0 : mx, isNaN(my) ? 0 : my];
  }
  
  public getGridBoundaries() {
     return { 
       xStart: this.marginLeft, 
       xEnd: this.widthPixels - this.marginRight, 
       yStart: this.marginTop, 
       yEnd: this.heightPixels - this.marginBottom 
     };
  }

  public getAxisPositions(): {
      xAxisY: number | null;
      yAxisX: number | null;
      xZ: boolean;
      yZ: boolean;
      isYBrokenBottom: boolean;
      isYBrokenTop: boolean;
      breakGap: number;
  } {
      const c = this.cfg;
      const { xStart, xEnd, yStart, yEnd } = this.getGridBoundaries();
      const xZ = c.xRange[0] <= 0 && c.xRange[1] >= 0;
      const yZ = c.yRange[0] <= 0 && c.yRange[1] >= 0;
      const breakGap = 26;

      const isYBrokenBottom = !yZ && c.yRange[0] > 0 && !!c.breakYAxis && c.xAxisAt !== 'top';
      const isYBrokenTop = !yZ && c.yRange[1] < 0 && !!c.breakYAxis && c.xAxisAt !== 'bottom';

      let yAxisX: number | null = null;
      if (c.yAxisAt === 'left') yAxisX = xStart;
      else if (c.yAxisAt === 'right') yAxisX = xEnd;
      else if (xZ) yAxisX = this.mathToScreen(0, 0)[0];
      else yAxisX = c.xRange[0] > 0 ? xStart : xEnd;

      // X-axis remains at the base (yEnd) or top (yStart) of the grid
      let xAxisY: number | null = null;
      if (c.xAxisAt === 'bottom') {
          xAxisY = yEnd;
      } else if (c.xAxisAt === 'top') {
          xAxisY = yStart;
      } else if (yZ) {
          xAxisY = this.mathToScreen(0, 0)[1];
      } else if (c.yRange[0] > 0) {
          xAxisY = yEnd;
      } else {
          xAxisY = yStart;
      }

      return { xAxisY, yAxisX, xZ, yZ, isYBrokenBottom, isYBrokenTop, breakGap };
  }

  formatNumber(val: number, decimals: number): string {
    if (Math.abs(val) < 1e-10) val = 0.0;
    
    // Auto formatting (Default -1)
    if (decimals < 0) {
        if (Math.abs(val - Math.round(val)) < 1e-9) return Math.round(val).toString();
        return parseFloat(val.toFixed(4)).toString();
    }
    
    // Fixed decimals
    return val.toFixed(decimals);
  }

  formatPi(val: number): string {
    const coeff = val / Math.PI;
    if (Math.abs(coeff) < 1e-5) return "0";
    if (Math.abs(Math.abs(coeff) - 1) < 1e-5) return coeff < 0 ? "-\\pi" : "\\pi";
    try {
        const f = math.fraction(coeff) as any;
        if (Number(f.d) > 12) return (Math.round(coeff * 100)/100) + "\\pi";
        const n = Number(f.n) * Number(f.s);
        const d = Number(f.d);
        if (d === 1) return n === 1 ? "\\pi" : n === -1 ? "-\\pi" : `${n}\\pi`;
        const numStr = Math.abs(n) === 1 ? "" : Math.abs(n).toString();
        return `${n < 0 ? "-" : ""}\\frac{${numStr}\\pi}{${d}}`;
    } catch { return (Math.round(coeff * 100)/100) + "\\pi"; }
  }

  private generateSteps(min: number, max: number, step: number) {
      const start = Math.ceil(min / step);
      const end = Math.floor(max / step);
      const res = [];
      for (let i = start; i <= end; i++) {
          let v = i * step;
          if (Math.abs(v) < 1e-10) v = 0;
          res.push(v);
      }
      return res;
  }

  // Render the background grid
  renderGrid(): React.ReactNode[] {
    const els: React.ReactNode[] = [];
    const c = this.cfg;
    const { xStart, xEnd, yStart, yEnd } = this.getGridBoundaries();
    const vStart = c.verticalGridMode === 'upward' ? this.originY : yStart;
    const vEnd = c.verticalGridMode === 'upward' ? yStart : yEnd;

    if (c.showBorder) els.push(React.createElement('rect', { key: "border", 'data-target-type': 'grid', 'data-target-id': 'border', x: xStart, y: yStart, width: xEnd - xStart, height: yEnd - yStart, fill: "none", stroke: "black", strokeWidth: c.gridThicknessMajor }));
    
    if (c.showVerticalGrid) {
        if (c.showMinorGrid) {
            const minorStep = c.majorStep[0] / c.subdivisions[0];
            this.generateSteps(c.xRange[0], c.xRange[1], minorStep).forEach(x => {
                const [px] = this.mathToScreen(x, 0);
                els.push(React.createElement('line', { key: `v-minor-${x}`, 'data-target-type': 'grid', 'data-target-id': 'vertical', x1: px, y1: vStart, x2: px, y2: vEnd, stroke: "black", strokeWidth: c.gridThicknessMinor }));
            });
        }
        this.generateSteps(c.xRange[0], c.xRange[1], c.majorStep[0]).forEach(x => {
            const [px] = this.mathToScreen(x, 0);
            els.push(React.createElement('line', { key: `v-major-${x}`, 'data-target-type': 'grid', 'data-target-id': 'vertical', x1: px, y1: vStart, x2: px, y2: vEnd, stroke: "black", strokeWidth: c.gridThicknessMajor }));
        });
    }
    
    if (c.showHorizontalGrid) {
        if (c.showMinorGrid) {
            const minorStep = c.majorStep[1] / c.subdivisions[1];
            this.generateSteps(c.yRange[0], c.yRange[1], minorStep).forEach(y => {
                const [_, py] = this.mathToScreen(0, y);
                els.push(React.createElement('line', { key: `h-minor-${y}`, 'data-target-type': 'grid', 'data-target-id': 'horizontal', x1: xStart, y1: py, x2: xEnd, y2: py, stroke: "black", strokeWidth: c.gridThicknessMinor }));
            });
        }
        this.generateSteps(c.yRange[0], c.yRange[1], c.majorStep[1]).forEach(y => {
            const [_, py] = this.mathToScreen(0, y);
            els.push(React.createElement('line', { key: `h-major-${y}`, 'data-target-type': 'grid', 'data-target-id': 'horizontal', x1: xStart, y1: py, x2: xEnd, y2: py, stroke: "black", strokeWidth: c.gridThicknessMajor }));
        });
    }
    return els;
  }

  // Render X and Y axes
  renderAxes(
      onResizeMouseDown?: (axis: 'x' | 'y', side: 'positive' | 'negative', e: React.MouseEvent) => void
  ): React.ReactNode[] {
    const els: React.ReactNode[] = [];
    const c = this.cfg;
    const { xStart, xEnd, yStart, yEnd } = this.getGridBoundaries();
    const { xAxisY, yAxisX, isYBrokenBottom, isYBrokenTop, breakGap } = this.getAxisPositions();

    // Tick Calculation Logic
    const getTickCoords = (axis: 'x' | 'y', pos: number): [number, number] => {
        const tickLen = c.tickLength ?? LAYOUT_DEFAULTS.TICK_SIZE;
        
        if (axis === 'x') {
            const style = c.xTickStyle || 'auto';
            if (style === 'top') return [pos - tickLen, pos];
            if (style === 'bottom') return [pos, pos + tickLen];
            if (style === 'crossing') return [pos - tickLen, pos + tickLen];
            
            // Auto: stick outwards if on edge
            if (Math.abs(pos - yEnd) < 2) return [pos, pos + tickLen]; // Axis at bottom -> ticks down
            if (Math.abs(pos - yStart) < 2) return [pos - tickLen, pos]; // Axis at top -> ticks up
            return [pos - tickLen, pos + tickLen]; // Crossing default
        } else {
            const style = c.yTickStyle || 'auto';
            if (style === 'left') return [pos - tickLen, pos];
            if (style === 'right') return [pos, pos + tickLen];
            if (style === 'crossing') return [pos - tickLen, pos + tickLen];
            
            // Auto: stick outwards if on edge
            if (Math.abs(pos - xStart) < 2) return [pos - tickLen, pos]; // Axis at left -> ticks left
            if (Math.abs(pos - xEnd) < 2) return [pos, pos + tickLen]; // Axis at right -> ticks right
            return [pos - tickLen, pos + tickLen]; // Crossing default
        }
    };

    const tickThick = c.tickThickness || c.axisThickness;

    if (c.showXTicks && xAxisY !== null) {
        const [t1, t2] = getTickCoords('x', xAxisY);
        this.generateSteps(c.xRange[0], c.xRange[1], c.majorStep[0]).forEach(x => {
            if (c.hideLastXTick && Math.abs(x - c.xRange[1]) < 1e-9) return;
            const [px] = this.mathToScreen(x, 0);
            els.push(React.createElement('line', { key: `xt-${x}`, x1: px, y1: t1, x2: px, y2: t2, stroke: "black", strokeWidth: tickThick }));
        });
    }
    
    if (c.showYTicks && yAxisX !== null) {
        const [t1, t2] = getTickCoords('y', yAxisX);
        this.generateSteps(c.yRange[0], c.yRange[1], c.majorStep[1]).forEach(y => {
            const [_, py] = this.mathToScreen(0, y);
            els.push(React.createElement('line', { key: `yt-${y}`, x1: t1, y1: py, x2: t2, y2: py, stroke: "black", strokeWidth: tickThick }));
        });
    }

    if (c.showYAxis && yAxisX !== null) {
        const breakStyle = c.yAxisBreakStyle === 'slashes' ? 'slashes' : 'zigzag';
        let y2 = yEnd;
        if (c.showXAxis && xAxisY !== null && Math.abs(xAxisY - yEnd) < 1e-9) {
            y2 = xAxisY;
        }

        els.push(React.createElement('line', { key: "ya-hit", 'data-target-type': 'axis', 'data-target-id': 'y', x1: yAxisX, y1: yStart - 10, x2: yAxisX, y2: y2, stroke: "transparent", strokeWidth: 12 }));

        if (isYBrokenBottom) {
            const yPlotEnd = yEnd - breakGap;
            // Upper main Y-axis from top arrow down to yMin (yPlotEnd)
            els.push(React.createElement('line', { key: "ya", 'data-target-type': 'axis', 'data-target-id': 'y', x1: yAxisX, y1: yStart - 10, x2: yAxisX, y2: yPlotEnd, stroke: "black", strokeWidth: c.axisThickness }));
            // Mask underlying x=0 vertical grid line behind the break symbol
            els.push(React.createElement('line', { key: 'ya-brk-mask', x1: yAxisX, y1: yPlotEnd + 5, x2: yAxisX, y2: yEnd - 5, stroke: 'white', strokeWidth: c.axisThickness + 3 }));

            if (breakStyle === 'slashes') {
                const s1Y = yPlotEnd + 10;
                const s2Y = yPlotEnd + 16;
                els.push(React.createElement('line', { key: 'ya-brk-top-stub', 'data-target-type': 'axis', 'data-target-id': 'y', x1: yAxisX, y1: yPlotEnd, x2: yAxisX, y2: s1Y, stroke: 'black', strokeWidth: c.axisThickness }));
                els.push(React.createElement('line', { key: 'ya-brk-slash1', 'data-target-type': 'axis', 'data-target-id': 'y', x1: yAxisX - 5, y1: s1Y + 3, x2: yAxisX + 5, y2: s1Y - 3, stroke: 'black', strokeWidth: c.axisThickness }));
                els.push(React.createElement('line', { key: 'ya-brk-slash2', 'data-target-type': 'axis', 'data-target-id': 'y', x1: yAxisX - 5, y1: s2Y + 3, x2: yAxisX + 5, y2: s2Y - 3, stroke: 'black', strokeWidth: c.axisThickness }));
                els.push(React.createElement('line', { key: 'ya-brk-bot-stub', 'data-target-type': 'axis', 'data-target-id': 'y', x1: yAxisX, y1: s2Y, x2: yAxisX, y2: y2, stroke: 'black', strokeWidth: c.axisThickness }));
            } else {
                const pts = [
                    `${yAxisX},${yPlotEnd}`,
                    `${yAxisX},${yPlotEnd + 6}`,
                    `${yAxisX - 5},${yPlotEnd + 10}`,
                    `${yAxisX + 5},${yPlotEnd + 16}`,
                    `${yAxisX},${yPlotEnd + 20}`,
                    `${yAxisX},${y2}`
                ].join(' ');
                els.push(React.createElement('polyline', { key: 'ya-brk-zigzag', 'data-target-type': 'axis', 'data-target-id': 'y', points: pts, fill: 'none', stroke: 'black', strokeWidth: c.axisThickness, strokeLinejoin: 'round' }));
            }
        } else if (isYBrokenTop) {
            const yPlotStart = yStart + breakGap;
            // Top stem above X-axis at yStart
            els.push(React.createElement('line', { key: 'ya-top-stem', 'data-target-type': 'axis', 'data-target-id': 'y', x1: yAxisX, y1: yStart - 10, x2: yAxisX, y2: yStart, stroke: 'black', strokeWidth: c.axisThickness }));
            // Mask underlying x=0 vertical grid line behind the break symbol
            els.push(React.createElement('line', { key: 'ya-brk-mask', x1: yAxisX, y1: yStart + 5, x2: yAxisX, y2: yPlotStart - 5, stroke: 'white', strokeWidth: c.axisThickness + 3 }));

            if (breakStyle === 'slashes') {
                const s1Y = yStart + 10;
                const s2Y = yStart + 16;
                els.push(React.createElement('line', { key: 'ya-brk-top-stub', 'data-target-type': 'axis', 'data-target-id': 'y', x1: yAxisX, y1: yStart, x2: yAxisX, y2: s1Y, stroke: 'black', strokeWidth: c.axisThickness }));
                els.push(React.createElement('line', { key: 'ya-brk-slash1', 'data-target-type': 'axis', 'data-target-id': 'y', x1: yAxisX - 5, y1: s1Y + 3, x2: yAxisX + 5, y2: s1Y - 3, stroke: 'black', strokeWidth: c.axisThickness }));
                els.push(React.createElement('line', { key: 'ya-brk-slash2', 'data-target-type': 'axis', 'data-target-id': 'y', x1: yAxisX - 5, y1: s2Y + 3, x2: yAxisX + 5, y2: s2Y - 3, stroke: 'black', strokeWidth: c.axisThickness }));
                els.push(React.createElement('line', { key: 'ya-brk-bot-stub', 'data-target-type': 'axis', 'data-target-id': 'y', x1: yAxisX, y1: s2Y, x2: yAxisX, y2: yPlotStart, stroke: 'black', strokeWidth: c.axisThickness }));
            } else {
                const pts = [
                    `${yAxisX},${yStart}`,
                    `${yAxisX},${yStart + 6}`,
                    `${yAxisX - 5},${yStart + 10}`,
                    `${yAxisX + 5},${yStart + 16}`,
                    `${yAxisX},${yStart + 20}`,
                    `${yAxisX},${yPlotStart}`
                ].join(' ');
                els.push(React.createElement('polyline', { key: 'ya-brk-zigzag', 'data-target-type': 'axis', 'data-target-id': 'y', points: pts, fill: 'none', stroke: 'black', strokeWidth: c.axisThickness, strokeLinejoin: 'round' }));
            }
            // Lower main Y-axis from yMax (yPlotStart) down to yEnd
            els.push(React.createElement('line', { key: "ya", 'data-target-type': 'axis', 'data-target-id': 'y', x1: yAxisX, y1: yPlotStart, x2: yAxisX, y2: y2, stroke: "black", strokeWidth: c.axisThickness }));
        } else {
            els.push(React.createElement('line', { key: "ya", 'data-target-type': 'axis', 'data-target-id': 'y', x1: yAxisX, y1: yStart - 10, x2: yAxisX, y2: y2, stroke: "black", strokeWidth: c.axisThickness }));
        }
        
        // Positive End (Top) Arrow
        if (c.showYArrow) {
             const arrowGroup = React.createElement('g', {
                 key: 'yarr-group',
                 'data-target-type': 'axis',
                 'data-target-id': 'y',
                 onMouseDown: onResizeMouseDown ? (e: React.MouseEvent) => onResizeMouseDown('y', 'positive', e) : undefined,
                 style: { cursor: onResizeMouseDown ? 'ns-resize' : 'default' }
             }, [
                 React.createElement('circle', { key: 'yarr-hit', cx: yAxisX, cy: yStart - 17, r: 15, fill: 'transparent' }),
                 // Arrowhead scaled down for VCAA
                 React.createElement('polygon', { key: "yarr", points: `${yAxisX},${yStart - 18} ${yAxisX-LAYOUT_DEFAULTS.AXIS_ARROW_SIZE},${yStart-10} ${yAxisX+LAYOUT_DEFAULTS.AXIS_ARROW_SIZE},${yStart-10}`, fill: "black" })
             ]);
             els.push(arrowGroup);
        } else if (onResizeMouseDown) {
             els.push(React.createElement('circle', { 
                 key: 'yarr-hit-only', 'data-target-type': 'axis', 'data-target-id': 'y', cx: yAxisX, cy: yStart, r: 15, fill: 'transparent', 
                 style: { cursor: 'ns-resize' },
                 onMouseDown: (e) => onResizeMouseDown('y', 'positive', e)
             }));
        }

        if (onResizeMouseDown) {
            els.push(React.createElement('circle', {
                key: 'y-neg-hit',
                'data-target-type': 'axis',
                'data-target-id': 'y',
                cx: yAxisX, cy: yEnd + 10, r: 15, 
                fill: 'transparent',
                style: { cursor: 'ns-resize' },
                onMouseDown: (e) => onResizeMouseDown('y', 'negative', e)
            }));
        }
    }
    
    if (c.showXAxis && xAxisY !== null) {
        let x1 = c.xAxisExtendLeft === false ? xStart : xStart - 10;
        
        // If Y-axis is at the very left edge (strictly non-negative x range), clamp X to start exactly at Y
        if (c.showYAxis && yAxisX !== null && Math.abs(yAxisX - xStart) < 1e-9) {
            x1 = yAxisX; // Clamp precisely to the vertical axis line to avoid overlapping the outer tick
        }

        const x2 = c.xAxisExtendRight === false ? xEnd : xEnd + 10;
        els.push(React.createElement('line', { key: "xa-hit", 'data-target-type': 'axis', 'data-target-id': 'x', x1: x1, y1: xAxisY, x2: x2, y2: xAxisY, stroke: "transparent", strokeWidth: 12 }));
        els.push(React.createElement('line', { key: "xa", 'data-target-type': 'axis', 'data-target-id': 'x', x1: x1, y1: xAxisY, x2: x2, y2: xAxisY, stroke: "black", strokeWidth: c.axisThickness }));
        
        if (c.showXArrow) {
            const arrowGroup = React.createElement('g', {
                 key: 'xarr-group',
                 'data-target-type': 'axis',
                 'data-target-id': 'x',
                 onMouseDown: onResizeMouseDown ? (e: React.MouseEvent) => onResizeMouseDown('x', 'positive', e) : undefined,
                 style: { cursor: onResizeMouseDown ? 'ew-resize' : 'default' }
             }, [
                 React.createElement('circle', { key: 'xarr-hit', cx: xEnd + 17, cy: xAxisY, r: 15, fill: 'transparent' }),
                 // Arrowhead scaled down for VCAA
                 React.createElement('polygon', { key: "xarr", points: `${xEnd + 18},${xAxisY} ${xEnd+10},${xAxisY-LAYOUT_DEFAULTS.AXIS_ARROW_SIZE} ${xEnd+10},${xAxisY+LAYOUT_DEFAULTS.AXIS_ARROW_SIZE}`, fill: "black" })
             ]);
             els.push(arrowGroup);
        } else if (onResizeMouseDown) {
             els.push(React.createElement('circle', { 
                 key: 'xarr-hit-only', 'data-target-type': 'axis', 'data-target-id': 'x', cx: xEnd, cy: xAxisY, r: 15, fill: 'transparent', 
                 style: { cursor: 'ew-resize' },
                 onMouseDown: (e) => onResizeMouseDown('x', 'positive', e)
             }));
        }

        if (onResizeMouseDown) {
             els.push(React.createElement('circle', {
                 key: 'x-neg-hit',
                 'data-target-type': 'axis',
                 'data-target-id': 'x',
                 cx: xStart - 10, cy: xAxisY, r: 15,
                 fill: 'transparent',
                 style: { cursor: 'ew-resize' },
                 onMouseDown: (e) => onResizeMouseDown('x', 'negative', e)
             }));
        }
    }
    return els;
  }

  /**
   * Renders the Origin Label ('0' or 'O') based on quadrant visibility.
   */
  renderOriginLabel(onMouseDown?: (e: React.MouseEvent) => void): React.ReactNode {
      const c = this.cfg;
      if (!c.showZeroLabel) return null;
      if (!c.showXAxis || !c.showYAxis) return null; // Let the individual axis handle '0' if it's a 1D graph

      const [originPx] = this.mathToScreen(0, 0);
      const { xStart, xEnd } = this.getGridBoundaries();
      const { xAxisY, yZ, isYBrokenTop } = this.getAxisPositions();

      if (xAxisY === null) return null;

      // Check if x=0 is horizontally within the visible grid bounds
      if (originPx < xStart - 5 || originPx > xEnd + 5) {
          return null;
      }

      const xMin = c.xRange[0];
      const yMin = c.yRange[0];

      // Logic for Label Content and Position
      let labelText = '0';
      
      if (c.originLabelContent === '0') labelText = '0';
      else if (c.originLabelContent === 'O') labelText = 'O';
      else if (c.originLabelContent === 'auto' || !c.originLabelContent) {
          // Use 'O' only when the true origin (0,0) is at the Quadrant 1 corner
          if (yZ && xMin >= -1e-9 && yMin >= -1e-9) labelText = 'O';
          else labelText = '0';
      }

      let defaultX = originPx;
      let defaultY = xAxisY;
      let align: 'start'|'middle'|'end' = 'middle';

      if (labelText === 'O') {
          // 'O' is typically placed diagonally below-left of the origin
          defaultX = originPx - 6;
          defaultY = xAxisY + 13;
          align = 'end';
      } else {
          const isTop = c.xAxisAt === 'top' || isYBrokenTop || (!yZ && c.yRange[1] < 0 && c.xAxisAt !== 'bottom');
          const yOffset = !yZ ? (isTop ? -12 : 16) : (isTop ? -22 : 22);
          defaultY = xAxisY + yOffset + (c.offsetXAxisNumY || 0);
          defaultX = originPx;
          align = 'middle';
      }

      // Apply User Offset
      if (c.originLabelOffset) {
          defaultX += c.originLabelOffset.x;
          defaultY += c.originLabelOffset.y;
      }

      const nodes = this.texEngine.renderToSVG(
          labelText, defaultX, defaultY, c.fontSize, 'black', align, true, 'math'
      );

      return React.createElement('g', {
          key: 'origin-lbl-group',
          'data-target-type': 'axis-label',
          'data-target-id': 'origin',
          onMouseDown,
          style: { cursor: onMouseDown ? 'move' : 'default' }
      }, ...nodes);
  }

  // Render numeric labels for axes and titles
  renderLabels(onXLabelMouseDown?: (e: any) => void, onYLabelMouseDown?: (e: any) => void, onOriginLabelMouseDown?: (e: any) => void): React.ReactNode[] {
    const els: React.ReactNode[] = [];
    const c = this.cfg;
    const { xStart, xEnd, yStart, yEnd } = this.getGridBoundaries();
    const { xAxisY, yAxisX, yZ, isYBrokenTop } = this.getAxisPositions();

    // --- Numeric Ticks ---
    if (c.showXNumbers && xAxisY !== null) {
        const isTop = c.xAxisAt === 'top' || isYBrokenTop || (!yZ && c.yRange[1] < 0 && c.xAxisAt !== 'bottom');
        const yOffset = isTop ? -12 : 16;
        this.generateSteps(c.xRange[0], c.xRange[1], c.majorStep[0]).forEach(x => {
            if (Math.abs(x) < 1e-9) {
                if (!c.showZeroLabel) return;
                if (c.showYAxis && c.showXAxis) return; // Handled by origin label if both axes are shown
            }

            const [px] = this.mathToScreen(x, 0);
            const lbl = c.piXAxis ? this.formatPi(x) : this.formatNumber(x, c.tickRounding[0]);
            els.push(...this.texEngine.renderToSVG(lbl, px, xAxisY! + yOffset + c.offsetXAxisNumY, c.fontSize, 'black', 'middle', true));
        });
    }
    
    if (c.showYNumbers && yAxisX !== null) {
        this.generateSteps(c.yRange[0], c.yRange[1], c.majorStep[1]).forEach(y => {
            if (Math.abs(y) < 1e-9) {
                // Determine if we should show the 0 on the y-axis
                if (c.showYZeroLabel === undefined || !c.showYZeroLabel) return;
                
                // If origin label O/0 is shown and handles it, hide this one
                if (c.showZeroLabel && c.showXAxis && c.showYAxis && yZ) {
                    const [originPx, originPy] = this.mathToScreen(0, 0);
                    // only skip if origin label is truly close and rendered
                    if (!(originPx < xStart - 5 || originPx > xEnd + 5 || originPy < yStart - 5 || originPy > yEnd + 5)) {
                        return;
                    }
                }
            }

            const [_, py] = this.mathToScreen(0, y);
            const lbl = c.piYAxis ? this.formatPi(y) : this.formatNumber(y, c.tickRounding[1]);
            // Adjust label position if using exterior ticks
            const xOffset = c.yAxisAt === 'left' ? -8 : c.yAxisAt === 'right' ? 8 : -8;
            const align = c.yAxisAt === 'right' ? 'start' : 'end';

            // If X-axis is directly at this Y tick (connected mode when y=0 is out of range) and crosses the Y-axis,
            // shift the label slightly off the X-axis line so the X-axis doesn't strike through the digits.
            let labelY = py + (c.fontSize * 0.3);
            if (!yZ && !c.breakYAxis && c.showXAxis && xAxisY !== null && Math.abs(py - xAxisY) < 2) {
                const xCrossesLabelSide = align === 'end' ? (xStart < yAxisX - 2) : (xEnd > yAxisX + 2);
                if (xCrossesLabelSide) {
                    labelY = c.yRange[0] > 0 ? py - 6 : py + c.fontSize;
                }
            }

            els.push(...this.texEngine.renderToSVG(lbl, yAxisX! + xOffset + (c.offsetYAxisNumX || 0), labelY, c.fontSize, 'black', align, true));
        });
    }

    // --- Axis Titles ---
    // Note: Passed 'text' as the type argument to enable Mixed Mode (upright text default, $...$ for math)
    
    // X-Axis Title
    if (c.axisLabels[0]) {
        let xPos = 0, yPos = 0, align: 'start'|'middle'|'end' = 'middle';
        
        if (c.xLabelStyle === 'arrow-end') {
            const arrowEnd = (c.showXAxis && xAxisY !== null) ? Math.min(this.widthPixels, xEnd + 18) : xEnd;
            xPos = arrowEnd + 6 + (c.offsetXAxisLabelX || 0); // Clean 6px clearance past arrow tip
            // Vertically align the label exactly with the axis line using font height centering
            yPos = (c.showXAxis && xAxisY !== null) ? xAxisY + (c.fontSize * 0.3) + c.offsetXAxisLabelY : yEnd + (c.fontSize * 0.3) + c.offsetXAxisLabelY;
            align = 'start';
        } else if (c.xLabelStyle === 'below-center') {
            xPos = (xStart + xEnd) / 2 + (c.offsetXAxisLabelX || 0);
            yPos = this.heightPixels - 12 + c.offsetXAxisLabelY;
            align = 'middle';
        }

        const nodes = this.texEngine.renderToSVG(c.axisLabels[0], xPos, yPos, c.fontSize, 'black', align, false, 'text');
        els.push(
            React.createElement('g', {
                key: 'xlabel-group',
                'data-target-type': 'axis-label',
                'data-target-id': 'x',
                onMouseDown: onXLabelMouseDown,
                style: { cursor: onXLabelMouseDown ? 'move' : 'default' }
            }, ...nodes)
        );
    }

    // Y-Axis Title
    if (c.axisLabels[1]) {
        let xPos = 0, yPos = 0, align: 'start'|'middle'|'end' = 'middle';
        const isVert = c.yLabelRotation === 'vertical';
        const yArrowAnchor = isYBrokenTop && xAxisY !== null ? xAxisY : yStart;

        if (c.yLabelStyle === 'arrow-end') {
            const arrowTop = (c.showYAxis && yAxisX !== null) ? Math.max(0, yArrowAnchor - 18) : yArrowAnchor;
            xPos = (yAxisX !== null && c.showYAxis) ? yAxisX : xStart;
            yPos = arrowTop - 7 + c.offsetYAxisLabelY; // Clean clearance above the arrow tip
            align = 'middle';
        } else if (c.yLabelStyle === 'left-center') {
            xPos = 20 + c.offsetYAxisLabelX;
            yPos = (yStart + yEnd) / 2 + c.offsetYAxisLabelY;
            align = 'middle';
        } else if (c.yLabelStyle === 'right-center') {
            xPos = this.widthPixels - 20 + c.offsetYAxisLabelX;
            yPos = (yStart + yEnd) / 2 + c.offsetYAxisLabelY;
            align = 'middle';
        }
        
        if (c.yLabelStyle === 'arrow-end') xPos += c.offsetYAxisLabelX;

        const labelNodes = this.texEngine.renderToSVG(c.axisLabels[1], isVert ? 0 : xPos, isVert ? 0 : yPos, c.fontSize, 'black', align, false, 'text');
        
        const groupProps = {
            key: 'ylabel-group',
            'data-target-type': 'axis-label',
            'data-target-id': 'y',
            onMouseDown: onYLabelMouseDown,
            style: { cursor: onYLabelMouseDown ? 'move' : 'default' } as React.CSSProperties
        };

        if (isVert) {
             els.push(React.createElement('g', {
                 ...groupProps,
                 transform: `translate(${xPos}, ${yPos}) rotate(-90)`
             }, ...labelNodes));
        } else {
             els.push(React.createElement('g', groupProps, ...labelNodes));
        }
    }

    const originLabel = this.renderOriginLabel(onOriginLabelMouseDown);
    if (originLabel) els.push(originLabel);

    return els;
  }
}
