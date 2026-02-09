
import React from 'react';
import { BaseGraphEngine } from '../graphBase';
import { VerticalLineDef, PointDef } from '../../types';

/**
 * Render vertical lines (e.g., x = 2)
 */
export const renderVerticalLines = (engine: BaseGraphEngine, lines: VerticalLineDef[]): React.ReactNode[] => {
    const { yStart, yEnd } = engine.getGridBoundaries();
    return lines.filter(l => l.visible).map(line => {
      const [px] = engine.mathToScreen(line.x, 0);
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
export const renderPoints = (engine: BaseGraphEngine, points: PointDef[]): React.ReactNode[] => {
    return points.filter(p => p.visible).map(p => {
      const [px, py] = engine.mathToScreen(p.x, p.y);
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
