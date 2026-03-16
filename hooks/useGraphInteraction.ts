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

    // DPI State
    const [exportDpi, setExportDpi] = useState(300);

    // Crop State
    const [cropMode, setCropMode] = useState(false);
    const [selectionBox, setSelectionBox] = useState<{x: number, y: number, w: number, h: number} | null>(null);
    const [customViewBox, setCustomViewBox] = useState<string | null>(null);
    const [hasInitialCrop, setHasInitialCrop] = useState(false);
    const cropStartRef = useRef<{x: number, y: number} | null>(null);

    const performAutoFit = useCallback((w: number, h: number) => {
        if (!containerRef.current) return;
        const { clientWidth, clientHeight } = containerRef.current;
        const availW = Math.max(100, clientWidth - 80);
        const availH = Math.max(100, clientHeight - 80);
        const scaleX = availW / w;
        const scaleY = availH / h;
        const newScale = Math.min(scaleX, scaleY);
        setPreviewScale(Math.max(0.1, Math.min(5, newScale)));
    }, []);

    const handleAutoCrop = useCallback(() => {
        const box = getAutoCropBox(svgId, widthPixels, heightPixels, strictCrop, autoCropPadding);
        setCustomViewBox(`${box.x} ${box.y} ${box.width} ${box.height}`);
        setCropMode(false);
        setHasInitialCrop(true);
        performAutoFit(widthPixels, heightPixels);
    }, [svgId, widthPixels, heightPixels, strictCrop, performAutoFit, autoCropPadding]);

    const handleFitToScreen = useCallback(() => {
        performAutoFit(widthPixels, heightPixels);
    }, [widthPixels, heightPixels, performAutoFit]);

    useEffect(() => {
        if (skipInitialAutoFit) {
            setHasInitialCrop(true);
            return;
        }
        if (hasInitialCrop) return;

        let attempts = 0;
        const maxAttempts = 10;
        let lastBoxStr = "";
        let stabilityCount = 0;

        const interval = setInterval(() => {
            attempts++;
            const box = getAutoCropBox(svgId, widthPixels, heightPixels, strictCrop, autoCropPadding);
            const boxStr = `${box.x},${box.y},${box.width},${box.height}`;
            if (boxStr === lastBoxStr) {
                stabilityCount++;
            } else {
                stabilityCount = 0;
            }
            lastBoxStr = boxStr;
            if (stabilityCount >= 2 || attempts >= maxAttempts) {
                setCustomViewBox(`${box.x} ${box.y} ${box.width} ${box.height}`);
                setHasInitialCrop(true);
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
        const blob = await generateGraphImage(svgId, widthPixels, heightPixels, dimCmWidth, strictCrop, autoCropPadding, exportDpi);
        if (blob) {
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = 'graph.png';
            a.click();
            URL.revokeObjectURL(url);
        }
    }, [svgId, widthPixels, heightPixels, dimCmWidth, strictCrop, autoCropPadding, exportDpi]);

    const [isCopied, setIsCopied] = useState(false);

    const handleCopyClick = useCallback(async () => {
        try {
            const blob = await generateGraphImage(svgId, widthPixels, heightPixels, dimCmWidth, strictCrop, autoCropPadding, exportDpi);
            if (blob) {
                await navigator.clipboard.write([
                    new ClipboardItem({
                        [blob.type]: blob
                    })
                ]);
                setIsCopied(true);
                setTimeout(() => setIsCopied(false), 2000);
                return true;
            }
        } catch (err) {
            console.error('Failed to copy image: ', err);
        }
        return false;
    }, [svgId, widthPixels, heightPixels, dimCmWidth, strictCrop, autoCropPadding, exportDpi]);

    const handleExportSVG = useCallback(() => {
        downloadSVG(svgId, 'graph.svg');
    }, [svgId]);

    const handleCropMouseDown = (e: React.MouseEvent) => {
        if (!cropMode) return;
        const svg = document.getElementById(svgId);
        if (!svg) return;
        const rect = svg.getBoundingClientRect();
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
        return true;
    };

    const handleCropMouseUp = () => {
        if (cropMode && cropStartRef.current && selectionBox) {
            if (selectionBox.w > 10 && selectionBox.h > 10) {
               setCustomViewBox(`${selectionBox.x} ${selectionBox.y} ${selectionBox.w} ${selectionBox.h}`);
               setCropMode(false);
               performAutoFit(widthPixels, heightPixels);
            }
            setSelectionBox(null);
            cropStartRef.current = null;
        }
    };

    return {
        previewScale, setPreviewScale,
        exportDpi, setExportDpi,
        cropMode, setCropMode,
        selectionBox,
        customViewBox, setCustomViewBox,
        hasInitialCrop, setHasInitialCrop,
        containerRef,
        handleAutoCrop,
        handleResetView,
        handleFitToScreen,
        handleExportPNG,
        handleCopy: handleCopyClick,
        isCopied,
        handleExportSVG,
        handleCropMouseDown,
        handleCropMouseMove,
        handleCropMouseUp
    };
};