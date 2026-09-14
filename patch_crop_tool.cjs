const fs = require('fs');
let code = fs.readFileSync('hooks/useGraphInteraction.ts', 'utf8');

const cropDownRegex = /const handleCropMouseDown = \(e: React\.MouseEvent\) => \{\s*if \(\!cropMode\) return;\s*const svg = document\.getElementById\(svgId\);\s*if \(\!svg\) return;\s*const rect = svg\.getBoundingClientRect\(\);\s*const x = \(e\.clientX - rect\.left\) \/ previewScale;\s*const y = \(e\.clientY - rect\.top\) \/ previewScale;\s*cropStartRef\.current = \{ x, y \};\s*setSelectionBox\(\{ x, y, w: 0, h: 0 \}\);\s*\};/;

const newCropDown = `const getSvgPoint = (e: React.MouseEvent, svg: SVGSVGElement) => {
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
    };`;

code = code.replace(cropDownRegex, newCropDown);

const cropMoveRegex = /const handleCropMouseMove = \(e: React\.MouseEvent\) => \{\s*if \(\!cropMode \|\| \!cropStartRef\.current\) return false;\s*const svg = document\.getElementById\(svgId\);\s*if \(\!svg\) return false;\s*const rect = svg\.getBoundingClientRect\(\);\s*const relX = \(e\.clientX - rect\.left\) \/ previewScale;\s*const relY = \(e\.clientY - rect\.top\) \/ previewScale;\s*const x = Math\.min\(relX, cropStartRef\.current\.x\);\s*const y = Math\.min\(relY, cropStartRef\.current\.y\);\s*const w = Math\.abs\(relX - cropStartRef\.current\.x\);\s*const h = Math\.abs\(relY - cropStartRef\.current\.y\);\s*setSelectionBox\(\{ x, y, w, h \}\);\s*return true;\s*\};/;

const newCropMove = `const handleCropMouseMove = (e: React.MouseEvent) => {
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
    };`;

code = code.replace(cropMoveRegex, newCropMove);

fs.writeFileSync('hooks/useGraphInteraction.ts', code);
console.log('Patched useGraphInteraction.ts for correct SVG coordinates');
