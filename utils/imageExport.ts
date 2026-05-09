/*
 * -----------------------------------------------------------------------------
 * AI_READ_ONLY_FILE: DO NOT EDIT WITHOUT EXPRESS PERMISSION
 * This file contains the logic for high-DPI image export.
 * -----------------------------------------------------------------------------
 */

import { addDpiToPng } from './pngUtils';
import { getAutoCropBox } from './graphCropper';

/**
 * Helper to convert standard physical font sizes (pt) into SVG dimensionless user units.
 * 
 * @param pt The desired font size in points (e.g. 11 for standard 11pt font)
 * @param svgUnitsPerCm The number of SVG viewBox units that represent 1 cm in the graph. 
 *                      (e.g. if a graph represents 10cm using 1000 SVG units, this is 100).
 * @returns The size to use for fontSize properties in the layout engine and SVG text.
 */
export const ptToSvgUnits = (pt: number, svgUnitsPerCm: number = 37.8): number => {
    // 1 inch = 2.54 cm
    // 1 point = 1/72 inch = 2.54/72 cm = 0.0352777 cm
    // SVG units = cm * svgUnitsPerCm
    return pt * (2.54 / 72) * svgUnitsPerCm;
};

export const generateGraphImage = (
    svgId: string, 
    engineWidth: number, 
    engineHeight: number, 
    targetCmWidth: number,
    strictMode: boolean = false,
    cropPadding: number = 20,
    dpi: number = 300
): Promise<{blob: Blob, widthCm: number, heightCm: number} | null> => {
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
        const targetCmHeight = crop.height / crop.width * targetCmWidth;

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
                resolve({ blob: enrichedBlob, widthCm: targetCmWidth, heightCm: targetCmHeight });
            }, 'image/png');
        };
        
        img.src = url;
    });
};

export const copyImageToClipboard = async (blob: Blob, cmWidth: number, cmHeight: number) => {
    // Browsers often strip DPI metadata when creating a ClipboardItem for 'image/png'.
    // To ensure Microsoft Word and other rich text editors paste with the correct physical size,
    // we also provide a 'text/html' representation with embedded CSS dimensions.
    
    // CSS pixels are strictly 96 pixels per inch.
    const cssWidth = Math.round((cmWidth / 2.54) * 96);
    const cssHeight = Math.round((cmHeight / 2.54) * 96);

    const dataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(blob);
    });

    const htmlString = `<img src="${dataUrl}" width="${cssWidth}" height="${cssHeight}" style="width: ${cmWidth}cm; height: ${cmHeight}cm;" />`;
    const htmlBlob = new Blob([htmlString], { type: 'text/html' });

    const item = new ClipboardItem({
        'image/png': blob,
        'text/html': htmlBlob
    });
    
    await navigator.clipboard.write([item]);
};

export const downloadSVG = (svgId: string, filename: string = 'graph.svg', targetCmWidth?: number, targetCmHeight?: number) => {
    const svg = document.getElementById(svgId);
    if (!svg) return;

    const clone = svg.cloneNode(true) as SVGSVGElement;
    
    // Explicitly add physical dimensions if requested
    if (targetCmWidth) {
        clone.setAttribute('width', `${targetCmWidth}cm`);
    }
    if (targetCmHeight) {
        clone.setAttribute('height', `${targetCmHeight}cm`);
    }

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