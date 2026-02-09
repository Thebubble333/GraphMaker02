
import React, { useState, useCallback } from 'react';

type DragHandler = (dx: number, dy: number, initialData: any, e: MouseEvent) => void;

interface DragState {
    type: string;
    startX: number;
    startY: number;
    initialData: any;
    onDrag: DragHandler;
    onEnd?: () => void;
}

export const useDragSystem = (previewScale: number) => {
    const [dragState, setDragState] = useState<DragState | null>(null);

    const onMouseDown = useCallback((
        e: React.MouseEvent, 
        initialData: any, 
        onDrag: DragHandler,
        onEnd?: () => void,
        type: string = 'generic'
    ) => {
        // Only left click triggers drag
        if (e.button !== 0) return;
        
        e.preventDefault();
        e.stopPropagation();
        
        setDragState({
            type,
            startX: e.clientX,
            startY: e.clientY,
            initialData,
            onDrag,
            onEnd
        });
    }, []);

    const onMouseMove = useCallback((e: React.MouseEvent) => {
        // If we are handling a crop, we delegate to the component's internal crop handler
        // But if we are in a system drag, we handle it here.
        if (!dragState) return false;

        const dx = (e.clientX - dragState.startX) / previewScale;
        const dy = (e.clientY - dragState.startY) / previewScale;
        
        dragState.onDrag(dx, dy, dragState.initialData, e.nativeEvent);
        return true; // Handled
    }, [dragState, previewScale]);

    const onMouseUp = useCallback(() => {
        if (dragState?.onEnd) dragState.onEnd();
        setDragState(null);
    }, [dragState]);

    return { 
        onMouseDown, 
        onMouseMove, 
        onMouseUp, 
        isDragging: !!dragState,
        dragType: dragState?.type
    };
};
