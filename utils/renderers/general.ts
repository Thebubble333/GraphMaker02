
import React from 'react';
import { BaseGraphEngine } from '../graphBase';
import { VerticalLineDef, PointDef } from '../../types';
import * as math from 'mathjs';
import { preprocessMathExpression } from '../mathAnalysis';

const evaluateCoord = (expr: string | number, scope: Record<string, number> = {}): number => {
    if (typeof expr === 'number') return expr;
    try {
        const val = math.evaluate(preprocessMathExpression(expr).parsed, scope);
        return typeof val === 'number' && isFinite(val) ? val : 0;
    } catch {
        return 0;
    }
};

/**
 * Render vertical lines (e.g., x = 2)
 */
export const renderVerticalLines = (engine: BaseGraphEngine, lines: VerticalLineDef[], globalScope: Record<string, number> = {}): React.ReactNode[] => {
    const { yStart, yEnd } = engine.getGridBoundaries();
    return lines.filter(l => l.visible).map(line => {
      const xVal = evaluateCoord(line.x, globalScope);
      const [px] = engine.mathToScreen(xVal, 0);
      return React.createElement('line', {
        key: line.id, x1: px, y1: yStart, x2: px, y2: yEnd,
        stroke: line.color, strokeWidth: line.strokeWidth,
        strokeDasharray: line.lineType === 'dashed' ? '5,5' : line.lineType === 'dotted' ? '2,2' : undefined
      });
    });
};

/**
 * Render custom coordinate points
 */
export const renderPoints = (engine: BaseGraphEngine, points: PointDef[], globalScope: Record<string, number> = {}): React.ReactNode[] => {
    return points.filter(p => p.visible).map(p => {
      const xVal = evaluateCoord(p.x, globalScope);
      const yVal = evaluateCoord(p.y, globalScope);
      const [px, py] = engine.mathToScreen(xVal, yVal);
      const els: React.ReactNode[] = [];
      els.push(React.createElement('circle', {
        key: `${p.id}-pt`, cx: px, cy: py, r: p.size,
        fill: p.style === 'filled' ? p.color : 'white',
        stroke: p.color, strokeWidth: 1.5
      }));
      if (p.label) {
          els.push(...engine.texEngine.renderToSVG(p.label, px, py - p.size - 5, engine.cfg.fontSize, p.color, 'middle', true));
      }
      return React.createElement('g', { key: p.id }, ...els);
    });
};
