
import React from 'react';
import { GraphConfig } from '../types';
import { TexEngine } from './textRenderer';
import { LAYOUT_DEFAULTS } from '../constants';
import * as math from 'mathjs';

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
    this.cfg = config;
    this.texEngine = new TexEngine();
    
    // Base margins from constants
    this.marginTop = LAYOUT_DEFAULTS.MARGIN_TOP;
    this.marginBottom = LAYOUT_DEFAULTS.MARGIN_BOTTOM;
    this.marginLeft = LAYOUT_DEFAULTS.MARGIN_LEFT;
    this.marginRight = LAYOUT_DEFAULTS.MARGIN_RIGHT;

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

    const xDist = this.cfg.xRange[1] - this.cfg.xRange[0];
    const yDist = this.cfg.yRange[1] - this.cfg.yRange[0];

    if (this.cfg.layoutMode === 'fixed') {
        this.widthPixels = this.cfg.targetWidth;
        this.heightPixels = this.cfg.targetHeight;
        const gridW = Math.max(1, this.widthPixels - this.marginLeft - this.marginRight);
        const gridH = Math.max(1, this.heightPixels - this.marginTop - this.marginBottom);
        this.scaleX = gridW / xDist;
        this.scaleY = gridH / yDist;
    } else {
        this.scaleX = this.cfg.basePixelSize / this.cfg.majorStep[0];
        this.scaleY = this.cfg.basePixelSize / this.cfg.majorStep[1];
        this.widthPixels = this.marginLeft + (xDist * this.scaleX) + this.marginRight;
        this.heightPixels = this.marginTop + (yDist * this.scaleY) + this.marginBottom;
    }
    
    this.originX = this.marginLeft + (0 - this.cfg.xRange[0]) * this.scaleX;
    this.originY = this.marginTop + (this.cfg.yRange[1] - 0) * this.scaleY;
  }
  
  // Convert math coordinates to screen pixels
  mathToScreen(x: number, y: number): [number, number] {
    return [this.originX + x * this.scaleX, this.originY - y * this.scaleY];
  }

  // Convert screen pixels to math coordinates
  screenToMath(px: number, py: number): [number, number] {
    return [(px - this.originX) / this.scaleX, (this.originY - py) / this.scaleY];
  }
  
  public getGridBoundaries() {
     return { 
       xStart: this.marginLeft, 
       xEnd: this.widthPixels - this.marginRight, 
       yStart: this.marginTop, 
       yEnd: this.heightPixels - this.marginBottom 
     };
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

    if (c.showBorder) els.push(React.createElement('rect', { key: "border", x: xStart, y: yStart, width: xEnd - xStart, height: yEnd - yStart, fill: "none", stroke: "black", strokeWidth: c.gridThicknessMajor }));
    
    if (c.showVerticalGrid) {
        if (c.showMinorGrid) {
            const minorStep = c.majorStep[0] / c.subdivisions[0];
            this.generateSteps(c.xRange[0], c.xRange[1], minorStep).forEach(x => {
                const [px] = this.mathToScreen(x, 0);
                els.push(React.createElement('line', { key: `v-minor-${x}`, x1: px, y1: vStart, x2: px, y2: vEnd, stroke: "black", strokeWidth: c.gridThicknessMinor }));
            });
        }
        this.generateSteps(c.xRange[0], c.xRange[1], c.majorStep[0]).forEach(x => {
            const [px] = this.mathToScreen(x, 0);
            els.push(React.createElement('line', { key: `v-major-${x}`, x1: px, y1: vStart, x2: px, y2: vEnd, stroke: "black", strokeWidth: c.gridThicknessMajor }));
        });
    }
    
    if (c.showHorizontalGrid) {
        if (c.showMinorGrid) {
            const minorStep = c.majorStep[1] / c.subdivisions[1];
            this.generateSteps(c.yRange[0], c.yRange[1], minorStep).forEach(y => {
                const [_, py] = this.mathToScreen(0, y);
                els.push(React.createElement('line', { key: `h-minor-${y}`, x1: xStart, y1: py, x2: xEnd, y2: py, stroke: "black", strokeWidth: c.gridThicknessMinor }));
            });
        }
        this.generateSteps(c.yRange[0], c.yRange[1], c.majorStep[1]).forEach(y => {
            const [_, py] = this.mathToScreen(0, y);
            els.push(React.createElement('line', { key: `h-major-${y}`, x1: xStart, y1: py, x2: xEnd, y2: py, stroke: "black", strokeWidth: c.gridThicknessMajor }));
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
    const xZ = c.xRange[0] <= 0 && c.xRange[1] >= 0;
    const yZ = c.yRange[0] <= 0 && c.yRange[1] >= 0;

    // Determine Axis Positions
    let yAxisX: number | null = null;
    if (c.yAxisAt === 'left') yAxisX = xStart;
    else if (c.yAxisAt === 'right') yAxisX = xEnd;
    else if (xZ) yAxisX = this.mathToScreen(0, 0)[0];

    let xAxisY: number | null = null;
    if (c.xAxisAt === 'bottom') xAxisY = yEnd;
    else if (c.xAxisAt === 'top') xAxisY = yStart;
    else if (yZ) xAxisY = this.mathToScreen(0, 0)[1];

    // Tick Calculation Logic
    const getTickCoords = (axis: 'x' | 'y', pos: number): [number, number] => {
        if (axis === 'x') {
            const style = c.xTickStyle || 'crossing';
            if (style === 'top') return [pos - this.tickH, pos];
            if (style === 'bottom') return [pos, pos + this.tickH];
            return [pos - this.tickH, pos + this.tickH]; // Crossing
        } else {
            const style = c.yTickStyle || 'crossing';
            if (style === 'left') return [pos - this.tickH, pos];
            if (style === 'right') return [pos, pos + this.tickH];
            return [pos - this.tickH, pos + this.tickH]; // Crossing
        }
    };

    const tickThick = c.tickThickness || c.axisThickness;

    if (c.showXTicks && xAxisY !== null) {
        const [t1, t2] = getTickCoords('x', xAxisY);
        this.generateSteps(c.xRange[0], c.xRange[1], c.majorStep[0]).forEach(x => {
            if (x === 0 && c.xAxisAt === 'zero') return;
            const [px] = this.mathToScreen(x, 0);
            els.push(React.createElement('line', { key: `xt-${x}`, x1: px, y1: t1, x2: px, y2: t2, stroke: "black", strokeWidth: tickThick }));
        });
    }
    
    if (c.showYTicks && yAxisX !== null) {
        const [t1, t2] = getTickCoords('y', yAxisX);
        this.generateSteps(c.yRange[0], c.yRange[1], c.majorStep[1]).forEach(y => {
            if (y === 0 && c.yAxisAt === 'zero') return;
            const [_, py] = this.mathToScreen(0, y);
            els.push(React.createElement('line', { key: `yt-${y}`, x1: t1, y1: py, x2: t2, y2: py, stroke: "black", strokeWidth: tickThick }));
        });
    }

    if (c.showYAxis && yAxisX !== null) {
        els.push(React.createElement('line', { key: "ya", x1: yAxisX, y1: yStart - 10, x2: yAxisX, y2: yEnd, stroke: "black", strokeWidth: c.axisThickness }));
        
        // Positive End (Top) Arrow
        if (c.showYArrow) {
             const arrowGroup = React.createElement('g', {
                 key: 'yarr-group',
                 onMouseDown: onResizeMouseDown ? (e: React.MouseEvent) => onResizeMouseDown('y', 'positive', e) : undefined,
                 style: { cursor: onResizeMouseDown ? 'ns-resize' : 'default' }
             }, [
                 React.createElement('circle', { key: 'yarr-hit', cx: yAxisX, cy: yStart - 17, r: 15, fill: 'transparent' }),
                 React.createElement('polygon', { key: "yarr", points: `${yAxisX},${yStart - 25} ${yAxisX-LAYOUT_DEFAULTS.AXIS_ARROW_SIZE},${yStart-10} ${yAxisX+LAYOUT_DEFAULTS.AXIS_ARROW_SIZE},${yStart-10}`, fill: "black" })
             ]);
             els.push(arrowGroup);
        } else if (onResizeMouseDown) {
             els.push(React.createElement('circle', { 
                 key: 'yarr-hit-only', cx: yAxisX, cy: yStart, r: 15, fill: 'transparent', 
                 style: { cursor: 'ns-resize' },
                 onMouseDown: (e) => onResizeMouseDown('y', 'positive', e)
             }));
        }

        if (onResizeMouseDown) {
            els.push(React.createElement('circle', {
                key: 'y-neg-hit',
                cx: yAxisX, cy: yEnd + 10, r: 15, 
                fill: 'transparent',
                style: { cursor: 'ns-resize' },
                onMouseDown: (e) => onResizeMouseDown('y', 'negative', e)
            }));
        }
    }
    
    if (c.showXAxis && xAxisY !== null) {
        els.push(React.createElement('line', { key: "xa", x1: xStart - 10, y1: xAxisY, x2: xEnd + 10, y2: xAxisY, stroke: "black", strokeWidth: c.axisThickness }));
        
        if (c.showXArrow) {
            const arrowGroup = React.createElement('g', {
                 key: 'xarr-group',
                 onMouseDown: onResizeMouseDown ? (e: React.MouseEvent) => onResizeMouseDown('x', 'positive', e) : undefined,
                 style: { cursor: onResizeMouseDown ? 'ew-resize' : 'default' }
             }, [
                 React.createElement('circle', { key: 'xarr-hit', cx: xEnd + 17, cy: xAxisY, r: 15, fill: 'transparent' }),
                 React.createElement('polygon', { key: "xarr", points: `${xEnd + 25},${xAxisY} ${xEnd+10},${xAxisY-LAYOUT_DEFAULTS.AXIS_ARROW_SIZE} ${xEnd+10},${xAxisY+LAYOUT_DEFAULTS.AXIS_ARROW_SIZE}`, fill: "black" })
             ]);
             els.push(arrowGroup);
        } else if (onResizeMouseDown) {
             els.push(React.createElement('circle', { 
                 key: 'xarr-hit-only', cx: xEnd, cy: xAxisY, r: 15, fill: 'transparent', 
                 style: { cursor: 'ew-resize' },
                 onMouseDown: (e) => onResizeMouseDown('x', 'positive', e)
             }));
        }

        if (onResizeMouseDown) {
             els.push(React.createElement('circle', {
                 key: 'x-neg-hit',
                 cx: xStart - 10, cy: xAxisY, r: 15,
                 fill: 'transparent',
                 style: { cursor: 'ew-resize' },
                 onMouseDown: (e) => onResizeMouseDown('x', 'negative', e)
             }));
        }
    }
    return els;
  }

  // Render numeric labels for axes and titles
  renderLabels(onXLabelMouseDown?: (e: any) => void, onYLabelMouseDown?: (e: any) => void): React.ReactNode[] {
    const els: React.ReactNode[] = [];
    const c = this.cfg;
    const { xStart, xEnd, yStart, yEnd } = this.getGridBoundaries();
    const xZ = c.xRange[0] <= 0 && c.xRange[1] >= 0;
    
    // Determine Axis Positions
    let yAxisX: number | null = null;
    if (c.yAxisAt === 'left') yAxisX = xStart;
    else if (c.yAxisAt === 'right') yAxisX = xEnd;
    else if (xZ) yAxisX = this.mathToScreen(0, 0)[0];

    let xAxisY: number | null = null;
    if (c.xAxisAt === 'bottom') xAxisY = yEnd;
    else if (c.xAxisAt === 'top') xAxisY = yStart;
    else if (c.yRange[0] <= 0 && c.yRange[1] >= 0) xAxisY = this.mathToScreen(0, 0)[1];

    // --- Numeric Ticks ---
    if (c.showXNumbers && xAxisY !== null) {
        this.generateSteps(c.xRange[0], c.xRange[1], c.majorStep[0]).forEach(x => {
            if (Math.abs(x) < 1e-9 && !c.showZeroLabel) return;
            const [px] = this.mathToScreen(x, 0);
            const lbl = c.piXAxis ? this.formatPi(x) : this.formatNumber(x, c.tickRounding[0]);
            // Adjust label position if using exterior ticks (e.g. at bottom)
            const yOffset = c.xAxisAt === 'bottom' ? 22 : c.xAxisAt === 'top' ? -22 : 22;
            els.push(...this.texEngine.renderToSVG(lbl, px, xAxisY! + yOffset + c.offsetXAxisNumY, c.fontSize, 'black', 'middle', true));
        });
    }
    
    if (c.showYNumbers && yAxisX !== null) {
        this.generateSteps(c.yRange[0], c.yRange[1], c.majorStep[1]).forEach(y => {
            if (Math.abs(y) < 1e-9 && c.yAxisAt !== 'left') return; 
            const [_, py] = this.mathToScreen(0, y);
            const lbl = c.piYAxis ? this.formatPi(y) : this.formatNumber(y, c.tickRounding[1]);
            // Adjust label position if using exterior ticks
            const xOffset = c.yAxisAt === 'left' ? -10 : c.yAxisAt === 'right' ? 10 : -10;
            const align = c.yAxisAt === 'right' ? 'start' : 'end';
            els.push(...this.texEngine.renderToSVG(lbl, yAxisX! + xOffset, py + 4, c.fontSize, 'black', align, true));
        });
    }

    // --- Axis Titles ---
    // Note: Passed 'text' as the type argument to enable Mixed Mode (upright text default, $...$ for math)
    
    // X-Axis Title
    if (c.axisLabels[0]) {
        let xPos = 0, yPos = 0, align: 'start'|'middle'|'end' = 'middle';
        
        if (c.xLabelStyle === 'arrow-end') {
            const arrowEnd = (c.showXAxis && xAxisY !== null) ? Math.min(this.widthPixels, xEnd + 25) : xEnd;
            xPos = arrowEnd + 10 + (c.offsetXAxisLabelX || 0);
            yPos = (c.showXAxis && xAxisY !== null) ? xAxisY + 5 + c.offsetXAxisLabelY : yEnd + 5 + c.offsetXAxisLabelY;
            align = 'start';
        } else if (c.xLabelStyle === 'below-center') {
            xPos = (xStart + xEnd) / 2 + (c.offsetXAxisLabelX || 0);
            yPos = this.heightPixels - 15 + c.offsetXAxisLabelY;
            align = 'middle';
        }

        const nodes = this.texEngine.renderToSVG(c.axisLabels[0], xPos, yPos, c.fontSize, 'black', align, false, 'text');
        els.push(
            React.createElement('g', {
                key: 'xlabel-group',
                onMouseDown: onXLabelMouseDown,
                style: { cursor: onXLabelMouseDown ? 'move' : 'default' }
            }, ...nodes)
        );
    }

    // Y-Axis Title
    if (c.axisLabels[1]) {
        let xPos = 0, yPos = 0, align: 'start'|'middle'|'end' = 'middle';
        const isVert = c.yLabelRotation === 'vertical';

        if (c.yLabelStyle === 'arrow-end') {
            const arrowTop = (c.showYAxis && yAxisX !== null) ? Math.max(0, yStart - 25) : yStart;
            xPos = (yAxisX !== null && c.showYAxis) ? yAxisX : xStart;
            yPos = arrowTop - 15 + c.offsetYAxisLabelY;
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

    return els;
  }
}
