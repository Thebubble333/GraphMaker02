import React, { useState, useRef, useEffect, useCallback } from 'react';
import { getAutoCropBox } from '../utils/graphCropper';
import { generateGraphImage, downloadSVG, copyImageToClipboard } from '../utils/imageExport';
import { getUISettings, UI_SETTINGS_EVENT } from '../constants';

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
        const deduction = getUISettings().AUTO_FIT_DEDUCTION;
        const availW = Math.max(100, clientWidth - deduction);
        const availH = Math.max(100, clientHeight - deduction);
        const scaleX = availW / w;
        const scaleY = availH / h;
        const newScale = Math.min(scaleX, scaleY);
        setPreviewScale(Math.max(0.1, Math.min(5, newScale)));
    }, []);

    useEffect(() => {
        const onUiChange = () => performAutoFit(widthPixels, heightPixels);
        window.addEventListener(UI_SETTINGS_EVENT, onUiChange);
        return () => window.removeEventListener(UI_SETTINGS_EVENT, onUiChange);
    }, [widthPixels, heightPixels, performAutoFit]);

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

    const handleZoomOutCanvas = useCallback(() => {
        if (!customViewBox) {
            const w = widthPixels * 1.5;
            const h = heightPixels * 1.5;
            const dx = (widthPixels - w) / 2;
            const dy = (heightPixels - h) / 2;
            setCustomViewBox(`${dx} ${dy} ${w} ${h}`);
        } else {
            const [x, y, w, h] = customViewBox.split(' ').map(Number);
            const nw = w * 1.5;
            const nh = h * 1.5;
            const nx = x - (nw - w) / 2;
            const ny = y - (nh - h) / 2;
            setCustomViewBox(`${nx} ${ny} ${nw} ${nh}`);
        }
        setTimeout(() => performAutoFit(widthPixels, heightPixels), 50);
    }, [customViewBox, widthPixels, heightPixels, performAutoFit]);

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
        const result = await generateGraphImage(svgId, widthPixels, heightPixels, dimCmWidth, strictCrop, autoCropPadding, exportDpi);
        if (result && result.blob) {
            const url = URL.createObjectURL(result.blob);
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
            const result = await generateGraphImage(svgId, widthPixels, heightPixels, dimCmWidth, strictCrop, autoCropPadding, exportDpi);
            if (result && result.blob) {
                // Ensure clipboard copy has proper dimensions using copyImageToClipboard
                await copyImageToClipboard(result.blob, result.widthCm, result.heightCm);
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

    const getSvgPoint = (e: React.MouseEvent, svg: SVGSVGElement) => {
        const pt = svg.createSVGPoint();
        pt.x = e.clientX;
        pt.y = e.clientY;
        const ctm = svg.getScreenCTM();
        if (!ctm) return { x: 0, y: 0 };
        return pt.matrixTransform(ctm.inverse());
    };

    const handleCropMouseDown = (e: React.MouseEvent) => {
        if (!cropMode) return;
        const svg = document.getElementById(svgId) as unknown as SVGSVGElement;
        if (!svg) return;
        const pt = getSvgPoint(e, svg);
        cropStartRef.current = { x: pt.x, y: pt.y };
        setSelectionBox({ x: pt.x, y: pt.y, w: 0, h: 0 });
        
        // Prevent text selection while cropping
        document.body.style.userSelect = 'none';
    };

    const handleCropMouseMove = (e: React.MouseEvent) => {
        if (!cropMode || !cropStartRef.current) return false;
        const svg = document.getElementById(svgId) as unknown as SVGSVGElement;
        if (!svg) return false;
        const pt = getSvgPoint(e, svg);
        const relX = pt.x;
        const relY = pt.y;
        const x = Math.min(relX, cropStartRef.current.x);
        const y = Math.min(relY, cropStartRef.current.y);
        const w = Math.abs(relX - cropStartRef.current.x);
        const h = Math.abs(relY - cropStartRef.current.y);
        setSelectionBox({ x, y, w, h });
        return true;
    };

    const handleCropMouseUp = () => {
        // Always reset user select just in case
        document.body.style.userSelect = '';
        
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
        handleZoomOutCanvas,
        handleExportPNG,

        handleCopy: handleCopyClick,
        isCopied,
        handleExportSVG,
        handleCropMouseDown,
        handleCropMouseMove,
        handleCropMouseUp
    };
};