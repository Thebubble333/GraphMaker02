
/*
 * -----------------------------------------------------------------------------
 * AI_READ_ONLY_FILE: DO NOT EDIT WITHOUT EXPRESS PERMISSION
 * This file contains logic to measure the actual visual extent of the graph.
 * -----------------------------------------------------------------------------
 */

export interface CropBox {
    x: number;
    y: number;
    width: number;
    height: number;
}

export const getAutoCropBox = (svgId: string, engineWidth: number, engineHeight: number, strictMode: boolean = false, padding: number = 20): CropBox => {
    const svg = document.getElementById(svgId) as unknown as SVGSVGElement;
    if (!svg) return { x: 0, y: 0, width: engineWidth, height: engineHeight };

    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    let found = false;

    // Layers to measure. Note: UI layers or selection highlights should be excluded by not listing them here.
    const layersToMeasure = [
        '.axis-labels-layer',
        '.features-layer',
        '.points-layer',
        '.data-layer', // General purpose layer (FunctionGrapher, etc)
        '.box-content-layer .graph-content', // Specific for BoxBuilder to exclude hit rects
        '.custom-x-axis-layer',
        '.inequality-fill-layer',
        '.inequality-stroke-layer',
        '.vertices-layer'
    ];

    // Get the global SVG matrix to map screen coordinates back to SVG user units
    const svgMatrix = svg.getScreenCTM();
    if (!svgMatrix) return { x: 0, y: 0, width: engineWidth, height: engineHeight };
    const inverseMatrix = svgMatrix.inverse();

    // Helper point for matrix transformations
    const pt = svg.createSVGPoint();

    layersToMeasure.forEach(selector => {
        const elements = svg.querySelectorAll(selector);
        elements.forEach(el => {
            const g = el as SVGGraphicsElement;
            // use getBoundingClientRect to capture visual bounds after all transforms
            const rect = g.getBoundingClientRect();
            
            if (rect.width === 0 || rect.height === 0) return;

            // Map the 4 corners of the client rect back to SVG space
            const corners = [
                { x: rect.left, y: rect.top },
                { x: rect.right, y: rect.top },
                { x: rect.right, y: rect.bottom },
                { x: rect.left, y: rect.bottom }
            ];

            corners.forEach(c => {
                pt.x = c.x;
                pt.y = c.y;
                const svgPt = pt.matrixTransform(inverseMatrix);
                
                if (svgPt.x < minX) minX = svgPt.x;
                if (svgPt.x > maxX) maxX = svgPt.x;
                if (svgPt.y < minY) minY = svgPt.y;
                if (svgPt.y > maxY) maxY = svgPt.y;
            });
            
            found = true;
        });
    });

    if (strictMode && !found) {
        return { x: 0, y: 0, width: engineWidth, height: engineHeight };
    }
    
    if (!found) {
         // Fallback to full size if nothing detected in non-strict mode
         minX = 0; minY = 0; maxX = engineWidth; maxY = engineHeight;
    }

    return {
        x: Number((minX - padding).toFixed(2)),
        y: Number((minY - padding).toFixed(2)),
        width: Number(((maxX - minX) + padding * 2).toFixed(2)),
        height: Number(((maxY - minY) + padding * 2).toFixed(2))
    };
};
