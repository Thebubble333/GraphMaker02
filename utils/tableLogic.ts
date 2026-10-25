
/*
 * -----------------------------------------------------------------------------
 * Table Layout Logic
 * Handles measurement and rendering calculations for TableGridBox.
 * -----------------------------------------------------------------------------
 */

import React from 'react';
import type { Box, StyleContext } from './mathLayout';
import { TABLE_DEFAULTS } from '../config/tableDefaults';

export interface TableLayoutResult {
    colWidths: number[];
    rowHeights: { ascent: number, descent: number }[];
    totalWidth: number;
    totalAscent: number;
    totalDescent: number;
    colGap: number;
    rowGap: number;
    gridWidth: number;
    gridHeight: number;
    // Positioning data for children
    childPositions: { row: number, col: number, x: number, y: number }[];
}

/**
 * calculates dimensions for a table/matrix based on its cells.
 */
export const calculateTableLayout = (
    matrixRows: Box[][], 
    fontSize: number,
    isTable: boolean = true,
    axisHeightRatio: number = 0.25
): TableLayoutResult => {
    
    if (matrixRows.length === 0) {
        return { 
            colWidths: [], rowHeights: [], 
            totalWidth: 0, totalAscent: 0, totalDescent: 0, 
            colGap: 0, rowGap: 0, gridWidth: 0, gridHeight: 0,
            childPositions: []
        };
    }

    // 1. Calculate Max Col Widths
    const numCols = Math.max(...matrixRows.map(r => r.length));
    const colWidths = new Array(numCols).fill(0);
    matrixRows.forEach(row => {
        row.forEach((box, c) => {
            colWidths[c] = Math.max(colWidths[c], box.width);
        });
    });

    // 2. Calculate Max Row Heights
    const minAscRatio = isTable ? TABLE_DEFAULTS.minRowAscentRatio : 0.54;
    const minDescRatio = isTable ? TABLE_DEFAULTS.minRowDescentRatio : 0.18;
    const rowHeights = matrixRows.map(row => {
        let asc = 0, desc = 0;
        row.forEach(box => {
            asc = Math.max(asc, box.ascent);
            desc = Math.max(desc, box.descent);
        });
        // Ensure minimum height
        asc = Math.max(asc, fontSize * minAscRatio);
        desc = Math.max(desc, fontSize * minDescRatio);
        return { ascent: asc, descent: desc };
    });

    // 3. Assemble Grid Dimensions
    const colGap = fontSize * (isTable ? TABLE_DEFAULTS.colGapRatio : 0.55);
    const rowGap = fontSize * (isTable ? TABLE_DEFAULTS.rowGapRatio : 0.26);
    
    // Total Width
    const sumColWidths = colWidths.reduce((a, b) => a + b, 0);
    const totalGapWidth = Math.max(0, colWidths.length - 1) * colGap;
    const paddingX = fontSize * (isTable ? 0.5 : 0.08);
    const totalWidth = sumColWidths + totalGapWidth + (paddingX * 2);

    // Calculate Y positions
    const childPositions: { row: number, col: number, x: number, y: number }[] = [];
    
    // First pass: Calculate total height
    let totalGridHeight = 0;
    rowHeights.forEach((h, i) => {
        totalGridHeight += h.ascent + h.descent;
        if (i < rowHeights.length - 1) totalGridHeight += rowGap;
    });
    const paddingY = fontSize * (isTable ? 0.5 : 0.05);
    totalGridHeight += (paddingY * 2);

    // Coordinates inside childPositions are relative to the array's visual center (0, 0)
    const topY = -totalGridHeight / 2;
    let currentY = topY + paddingY;

    matrixRows.forEach((row, r) => {
        const h = rowHeights[r];
        const rowBaseline = currentY + h.ascent;
        
        let currentX = -totalWidth / 2 + paddingX; // Start X (centered around 0)

        row.forEach((box, c) => {
            const w = colWidths[c];
            // Center horizontally in column
            const xOffset = currentX + (w - box.width) / 2;
            
            childPositions.push({ row: r, col: c, x: xOffset, y: rowBaseline });
            currentX += w + colGap;
        });
        
        currentY += h.ascent + h.descent + rowGap;
    });

    // Center the matrix/table vertically on the Math Axis (y - axisOffset)
    const axisOffset = fontSize * axisHeightRatio;
    const totalAscent = totalGridHeight / 2 + axisOffset;
    const totalDescent = Math.max(0, totalGridHeight / 2 - axisOffset);

    return {
        colWidths,
        rowHeights,
        totalWidth,
        totalAscent,
        totalDescent,
        colGap,
        rowGap,
        gridWidth: totalWidth,
        gridHeight: totalGridHeight,
        childPositions
    };
};

/**
 * Helper to render grid lines for a TableGridBox
 */
export const renderTableGridLines = (
    x: number, y: number,
    layout: TableLayoutResult,
    ctx: StyleContext,
    els: React.ReactNode[]
) => {
    const { gridWidth, gridHeight, totalAscent, totalDescent, colWidths, rowHeights, colGap, rowGap } = layout;
    
    const topY = y - totalAscent;
    const bottomY = y + totalDescent;
    const leftX = x; 
    
    // Outer Border
    els.push(
        React.createElement('rect', {
            key: `tbl-border-${x}-${y}`,
            x: leftX, y: topY, width: gridWidth, height: gridHeight,
            fill: 'none', stroke: ctx.color, strokeWidth: TABLE_DEFAULTS.borderWidth,
            className: 'graph-content' // ADDED for auto-crop
        })
    );

    const paddingX = (gridWidth - (colWidths.reduce((a,b)=>a+b,0) + (colWidths.length-1)*colGap)) / 2;
    const paddingY = (gridHeight - (rowHeights.reduce((acc, row) => acc + row.ascent + row.descent, 0) + (rowHeights.length-1)*rowGap)) / 2;

    // Vertical Lines (Columns)
    let currentX = leftX + paddingX;
    for (let i = 0; i < colWidths.length - 1; i++) {
        currentX += colWidths[i] + colGap;
        // Draw line in the middle of the gap
        const lineX = currentX - (colGap / 2);
        els.push(
            React.createElement('line', {
                key: `tbl-v-${i}-${x}`,
                x1: lineX, y1: topY, x2: lineX, y2: bottomY,
                stroke: ctx.color, strokeWidth: TABLE_DEFAULTS.gridWidth,
                className: 'graph-content' // ADDED for auto-crop
            })
        );
    }

    // Horizontal Lines (Rows)
    let currentY = topY + paddingY;
    for (let i = 0; i < rowHeights.length - 1; i++) {
        const h = rowHeights[i];
        currentY += h.ascent + h.descent + rowGap;
        const lineY = currentY - (rowGap / 2);
        els.push(
            React.createElement('line', {
                key: `tbl-h-${i}-${y}`,
                x1: leftX, y1: lineY, x2: leftX + gridWidth, y2: lineY,
                stroke: ctx.color, strokeWidth: TABLE_DEFAULTS.gridWidth,
                className: 'graph-content' // ADDED for auto-crop
            })
        );
    }
};
