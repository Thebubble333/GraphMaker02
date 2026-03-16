/*
 * -----------------------------------------------------------------------------
 * AI_READ_ONLY_FILE: DO NOT EDIT WITHOUT EXPRESS PERMISSION
 * This file contains the logic for high-DPI image export.
 * -----------------------------------------------------------------------------
 */

import { addDpiToPng } from './pngUtils';
import { getAutoCropBox } from './graphCropper';

export const generateGraphImage = (
    svgId: string, 
    engineWidth: number, 
    engineHeight: number, 
    targetCmWidth: number,
    strictMode: boolean = false,
    cropPadding: number = 20,
    dpi: number = 300
): Promise<Blob | null> => {
    return new Promise((resolve) => {
        const svgElement = document.getElementById(svgId) as unknown as SVGSVGElement;
        if (!svgElement) {
            resolve(null);
            return;
        }

        // 1. Calculate Auto-Crop area or use current viewBox
        const currentViewBox = svgElement.getAttribute('viewBox');
        let crop = { x: 0, y: 0, width: engineWidth, height: engineHeight };
        
        if (currentViewBox) {
            const parts = currentViewBox.split(' ').map(Number);
            if (parts.length === 4) {
                crop = { x: parts[0], y: parts[1], width: parts[2], height: parts[3] };
            }
        } else {
            crop = getAutoCropBox(svgId, engineWidth, engineHeight, strictMode, cropPadding);
        }

        // 2. Clone the node to modify attributes for serialization
        const clone = svgElement.cloneNode(true) as SVGSVGElement;
        clone.setAttribute('viewBox', `${crop.x} ${crop.y} ${crop.width} ${crop.height}`);
        clone.setAttribute('width', `${crop.width}`);
        clone.setAttribute('height', `${crop.height}`);
        clone.style.overflow = 'visible';

        // Clean up zero-length paths that might render as stray dots in some viewers (like MS Word)
        const paths = clone.querySelectorAll('path');
        paths.forEach(p => {
            const d = p.getAttribute('d');
            if (!d || d.trim() === '') {
                p.remove();
                return;
            }
            // Catch "M x y", "M x y Z", "M x y L x y", "M x y L x y Z"
            const isZeroLength = /^[Mm]\s*([\d.-]+)[,\s]+([\d.-]+)\s*(?:[Ll]\s*\1[,\s]+\2\s*)?[Zz]?\s*$/.test(d.trim());
            if (isZeroLength) {
                p.remove();
            }
        });

        // Remove hit areas (elements with transparent fill or stroke) which render as black in MS Word
        const allElements = clone.querySelectorAll('*');
        allElements.forEach(el => {
            const fill = el.getAttribute('fill') || (el as HTMLElement).style?.fill;
            const stroke = el.getAttribute('stroke') || (el as HTMLElement).style?.stroke;
            if (fill === 'transparent' || stroke === 'transparent') {
                el.remove();
            }
        });

        // 3. Setup Canvas for High DPI Export
        const TARGET_DPI = dpi;
        const requiredWidthPx = (targetCmWidth / 2.54) * TARGET_DPI;
        const scale = requiredWidthPx / crop.width;
        const requiredHeightPx = crop.height * scale;

        const canvas = document.createElement('canvas');
        canvas.width = requiredWidthPx;
        canvas.height = requiredHeightPx;
        
        const ctx = canvas.getContext('2d');
        if (!ctx) {
            resolve(null);
            return;
        }
        
        ctx.fillStyle = 'white';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        
        const serializer = new XMLSerializer();
        const source = serializer.serializeToString(clone);
        
        const img = new Image();
        const svgBlob = new Blob([source], {type: 'image/svg+xml;charset=utf-8'});
        const url = URL.createObjectURL(svgBlob);
        
        img.onload = async () => {
            ctx.drawImage(img, 0, 0, requiredWidthPx, requiredHeightPx);
            URL.revokeObjectURL(url);
            
            canvas.toBlob(async (blob) => {
                if (!blob) {
                    resolve(null);
                    return;
                }
                const enrichedBlob = await addDpiToPng(blob, TARGET_DPI);
                resolve(enrichedBlob);
            }, 'image/png');
        };
        
        img.src = url;
    });
};

export const downloadSVG = (svgId: string, filename: string = 'graph.svg') => {
    const svg = document.getElementById(svgId);
    if (!svg) return;

    const clone = svg.cloneNode(true) as SVGSVGElement;

    // Clean up zero-length paths that might render as stray dots in some viewers (like MS Word)
    const paths = clone.querySelectorAll('path');
    paths.forEach(p => {
        const d = p.getAttribute('d');
        if (!d || d.trim() === '') {
            p.remove();
            return;
        }
        // Catch "M x y", "M x y Z", "M x y L x y", "M x y L x y Z"
        const isZeroLength = /^[Mm]\s*([\d.-]+)[,\s]+([\d.-]+)\s*(?:[Ll]\s*\1[,\s]+\2\s*)?[Zz]?\s*$/.test(d.trim());
        if (isZeroLength) {
            p.remove();
        }
    });

    // Remove hit areas (elements with transparent fill or stroke) which render as black in MS Word
    const allElements = clone.querySelectorAll('*');
    allElements.forEach(el => {
        const fill = el.getAttribute('fill') || (el as HTMLElement).style?.fill;
        const stroke = el.getAttribute('stroke') || (el as HTMLElement).style?.stroke;
        if (fill === 'transparent' || stroke === 'transparent') {
            el.remove();
        }
    });

    const serializer = new XMLSerializer();
    let source = serializer.serializeToString(clone);

    if (!source.match(/^<svg[^>]+xmlns="http\:\/\/www\.w3\.org\/2000\/svg"/)) {
        source = source.replace(/^<svg/, '<svg xmlns="http://www.w3.org/2000/svg"');
    }
    if (!source.match(/^<svg[^>]+xmlns:xlink/)) {
        source = source.replace(/^<svg/, '<svg xmlns:xlink="http://www.w3.org/1999/xlink"');
    }

    const blob = new Blob([source], { type: "image/svg+xml;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
};