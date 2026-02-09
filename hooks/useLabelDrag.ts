
import React, { useState, useCallback } from 'react';
import { GraphConfig } from '../types';

export const useLabelDrag = (
    setConfig: (cb: (prev: GraphConfig) => GraphConfig) => void,
    previewScale: number
) => {
    const [dragState, setDragState] = useState<{
        axis: 'x' | 'y';
        startX: number;
        startY: number;
        initial: {
            offXX: number; offXY: number;
            offYX: number; offYY: number;
        }
    } | null>(null);

    const onLabelMouseDown = useCallback((axis: 'x' | 'y', e: React.MouseEvent, config: GraphConfig) => {
        e.preventDefault();
        e.stopPropagation();
        setDragState({
            axis,
            startX: e.clientX,
            startY: e.clientY,
            initial: {
                offXX: config.offsetXAxisLabelX || 0,
                offXY: config.offsetXAxisLabelY || 0,
                offYX: config.offsetYAxisLabelX || 0,
                offYY: config.offsetYAxisLabelY || 0
            }
        });
    }, []);

    const onLabelDragMove = useCallback((e: React.MouseEvent) => {
        if (!dragState) return false;

        const dx = (e.clientX - dragState.startX) / previewScale;
        const dy = (e.clientY - dragState.startY) / previewScale;

        const isAlt = e.altKey;
        const isCtrl = e.ctrlKey || e.metaKey;

        setConfig(prev => {
            const next = { ...prev };
            const { offXX, offXY, offYX, offYY } = dragState.initial;

            if (isAlt) {
                 // Alt: Free move single label (Both axes, no linking)
                 if (dragState.axis === 'x') {
                     next.offsetXAxisLabelX = offXX + dx;
                     next.offsetXAxisLabelY = offXY + dy;
                 } else {
                     next.offsetYAxisLabelX = offYX + dx;
                     next.offsetYAxisLabelY = offYY + dy;
                 }
            } else if (isCtrl) {
                // Ctrl: Constrained move single label (Perpendicular only, no linking)
                // Useful for pure margin adjustment of one label
                if (dragState.axis === 'x') {
                     next.offsetXAxisLabelY = offXY + dy;
                } else {
                     next.offsetYAxisLabelX = offYX + dx;
                }
            } else {
                // Default: Linked Perpendicular + Self Parallel
                // Allows moving the label along the axis (parallel) AND adjusting margins (perpendicular)
                
                if (dragState.axis === 'x') {
                    // Parallel: Move X label left/right
                    next.offsetXAxisLabelX = offXX + dx;

                    // Perpendicular: Move X label up/down
                    next.offsetXAxisLabelY = offXY + dy;
                    
                    // Linked: Move Y label left/right to match X's margin change
                    // If X moves down (dy > 0), margin increases. Y should move left (dx < 0) to increase its margin.
                    next.offsetYAxisLabelX = offYX - dy; 
                } else {
                    // Parallel: Move Y label up/down
                    next.offsetYAxisLabelY = offYY + dy;

                    // Perpendicular: Move Y label left/right
                    next.offsetYAxisLabelX = offYX + dx;

                    // Linked: Move X label up/down to match Y's margin change
                    // If Y moves left (dx < 0), margin increases. X should move down (dy > 0).
                    next.offsetXAxisLabelY = offXY - dx;
                }
            }
            return next;
        });

        return true;
    }, [dragState, previewScale, setConfig]);

    const onLabelDragUp = useCallback(() => {
        setDragState(null);
    }, []);

    return { onLabelMouseDown, onLabelDragMove, onLabelDragUp, isDraggingLabel: !!dragState };
};
