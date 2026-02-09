
import React, { useState, useRef, useEffect, useCallback } from 'react';
import { getAutoCropBox } from '../utils/graphCropper';
import { generateGraphImage, downloadSVG } from '../utils/imageExport';

export const useGraphInteraction = (
    svgId: string,
    widthPixels: number,
    heightPixels: number,
    dimCmWidth: number,
    strictCrop: boolean = false,
    skipInitialAutoFit: boolean = false,
    autoCropPadding: number = 20
) => {
    // Zoom State
    const [previewScale, setPreviewScale] = useState(1.0);
    const containerRef = useRef<HTMLDivElement>(null);

    // Crop State
    const [cropMode, setCropMode] = useState(false);
    const [selectionBox, setSelectionBox] = useState<{x: number, y: number, w: number, h: number} | null>(null);
    const [customViewBox, setCustomViewBox] = useState<string | null>(null);
    const [hasInitialCrop, setHasInitialCrop] = useState(false);
    const cropStartRef = useRef<{x: number, y: number} | null>(null);

    const performAutoFit = useCallback((w: number, h: number) => {
        if (!containerRef.current) return;
        const { clientWidth, clientHeight } = containerRef.current;
        
        // Leave some padding (e.g. 40px on each side)
        const availW = Math.max(100, clientWidth - 80);
        const availH = Math.max(100, clientHeight - 80);

        const scaleX = availW / w;
        const scaleY = availH / h;

        // Fit entirely visible
        const newScale = Math.min(scaleX, scaleY);
        // Clamp to reasonable limits to prevent micro-graphs or infinite zoom
        setPreviewScale(Math.max(0.1, Math.min(5, newScale)));
    }, []);

    // Actions
    const handleAutoCrop = useCallback(() => {
        const box = getAutoCropBox(svgId, widthPixels, heightPixels, strictCrop, autoCropPadding);
        setCustomViewBox(`${box.x} ${box.y} ${box.width} ${box.height}`);
        setCropMode(false);
        setHasInitialCrop(true);
        // FIT FIX: Always fit the full container dimensions (widthPixels/heightPixels) to the screen.
        // Even if we are cropped, the SVG element size is fixed at widthPixels x heightPixels.
        performAutoFit(widthPixels, heightPixels);
    }, [svgId, widthPixels, heightPixels, strictCrop, performAutoFit, autoCropPadding]);

    // Handle Fit To Screen
    const handleFitToScreen = useCallback(() => {
        // FIT FIX: Ignore customViewBox dimensions for scaling calculations.
        // We always want the SVG container (widthPixels x heightPixels) to fit in the view.
        performAutoFit(widthPixels, heightPixels);
    }, [widthPixels, heightPixels, performAutoFit]);

    // Initial Auto-Fit Logic
    useEffect(() => {
        // Only run auto-detection if we don't have an initial crop yet.
        if (skipInitialAutoFit) {
            setHasInitialCrop(true);
            return;
        }

        if (hasInitialCrop) return;

        let attempts = 0;
        const maxAttempts = 10; // Try for up to 1 second
        let lastBoxStr = "";
        let stabilityCount = 0;

        const interval = setInterval(() => {
            attempts++;
            const box = getAutoCropBox(svgId, widthPixels, heightPixels, strictCrop, autoCropPadding);
            const boxStr = `${box.x},${box.y},${box.width},${box.height}`;

            // Check if content is detected (box is smaller than full canvas)
            // Or if in strict mode, if we found something finite
            
            // Check for stability (result hasn't changed between ticks)
            if (boxStr === lastBoxStr) {
                stabilityCount++;
            } else {
                stabilityCount = 0;
            }
            
            lastBoxStr = boxStr;

            // Apply crop if:
            // 1. We have found stable content (stable for 2 ticks)
            // 2. OR we ran out of attempts (fallback to whatever we have)
            if (stabilityCount >= 2 || attempts >= maxAttempts) {
                setCustomViewBox(`${box.x} ${box.y} ${box.width} ${box.height}`);
                setHasInitialCrop(true);
                // FIT FIX: Always fit full container
                performAutoFit(widthPixels, heightPixels);
                clearInterval(interval);
            }
        }, 100);

        return () => clearInterval(interval);
    }, [svgId, widthPixels, heightPixels, hasInitialCrop, strictCrop, performAutoFit, skipInitialAutoFit, autoCropPadding]);

    const handleResetView = useCallback(() => {
        setCustomViewBox(null);
        setCropMode(false);
        setSelectionBox(null);
        setHasInitialCrop(false); 
        performAutoFit(widthPixels, heightPixels);
    }, [widthPixels, heightPixels, performAutoFit]);

    const handleExportPNG = useCallback(async () => {
        const blob = await generateGraphImage(svgId, widthPixels, heightPixels, dimCmWidth, strictCrop, autoCropPadding);
        if (blob) {
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = 'graph.png';
            a.click();
            URL.revokeObjectURL(url);
        }
    }, [svgId, widthPixels, heightPixels, dimCmWidth, strictCrop, autoCropPadding]);

    const handleExportSVG = useCallback(() => {
        downloadSVG(svgId, 'graph.svg');
    }, [svgId]);

    // Mouse Handlers for Cropping
    const handleCropMouseDown = (e: React.MouseEvent) => {
        if (!cropMode) return;
        const svg = document.getElementById(svgId);
        if (!svg) return;
        const rect = svg.getBoundingClientRect();
        // Calculate relative to the scaled preview
        const x = (e.clientX - rect.left) / previewScale;
        const y = (e.clientY - rect.top) / previewScale;
        cropStartRef.current = { x, y };
        setSelectionBox({ x, y, w: 0, h: 0 });
    };

    const handleCropMouseMove = (e: React.MouseEvent) => {
        if (!cropMode || !cropStartRef.current) return false;
        
        const svg = document.getElementById(svgId);
        if (!svg) return false;
        const rect = svg.getBoundingClientRect();
        
        const relX = (e.clientX - rect.left) / previewScale;
        const relY = (e.clientY - rect.top) / previewScale;
        
        const x = Math.min(relX, cropStartRef.current.x);
        const y = Math.min(relY, cropStartRef.current.y);
        const w = Math.abs(relX - cropStartRef.current.x);
        const h = Math.abs(relY - cropStartRef.current.y);
        
        setSelectionBox({ x, y, w, h });
        return true; // Handled
    };

    const handleCropMouseUp = () => {
        if (cropMode && cropStartRef.current && selectionBox) {
            if (selectionBox.w > 10 && selectionBox.h > 10) {
               setCustomViewBox(`${selectionBox.x} ${selectionBox.y} ${selectionBox.w} ${selectionBox.h}`);
               setCropMode(false);
               // FIT FIX: Always fit full container
               performAutoFit(widthPixels, heightPixels);
            }
            setSelectionBox(null);
            cropStartRef.current = null;
        }
    };

    return {
        previewScale, setPreviewScale,
        cropMode, setCropMode,
        selectionBox,
        customViewBox, setCustomViewBox,
        hasInitialCrop, setHasInitialCrop,
        containerRef,
        handleAutoCrop,
        handleResetView,
        handleFitToScreen,
        handleExportPNG,
        handleExportSVG,
        handleCropMouseDown,
        handleCropMouseMove,
        handleCropMouseUp
    };
};
