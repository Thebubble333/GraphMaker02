const fs = require('fs');
let code = fs.readFileSync('hooks/useGraphInteraction.ts', 'utf8');

const oldDown = `    const handleCropMouseDown = (e: React.MouseEvent) => {
        if (!cropMode) return;
        const svg = document.getElementById(svgId) as unknown as SVGSVGElement;
        if (!svg) return;
        const pt = getSvgPoint(e, svg);
        cropStartRef.current = { x: pt.x, y: pt.y };
        setSelectionBox({ x: pt.x, y: pt.y, w: 0, h: 0 });
    };`;

const newDown = `    const handleCropMouseDown = (e: React.MouseEvent) => {
        if (!cropMode) return;
        const svg = document.getElementById(svgId) as unknown as SVGSVGElement;
        if (!svg) return;
        const pt = getSvgPoint(e, svg);
        cropStartRef.current = { x: pt.x, y: pt.y };
        setSelectionBox({ x: pt.x, y: pt.y, w: 0, h: 0 });
        
        // Prevent text selection while cropping
        document.body.style.userSelect = 'none';
    };`;

code = code.replace(oldDown, newDown);

const oldUp = `    const handleCropMouseUp = () => {
        if (cropMode && cropStartRef.current && selectionBox) {
            if (selectionBox.w > 10 && selectionBox.h > 10) {
               setCustomViewBox(\`\${selectionBox.x} \${selectionBox.y} \${selectionBox.w} \${selectionBox.h}\`);
               setCropMode(false);
               performAutoFit(widthPixels, heightPixels);
            }
            setSelectionBox(null);
            cropStartRef.current = null;
        }
    };`;

const newUp = `    const handleCropMouseUp = () => {
        // Always reset user select just in case
        document.body.style.userSelect = '';
        
        if (cropMode && cropStartRef.current && selectionBox) {
            if (selectionBox.w > 10 && selectionBox.h > 10) {
               setCustomViewBox(\`\${selectionBox.x} \${selectionBox.y} \${selectionBox.w} \${selectionBox.h}\`);
               setCropMode(false);
               performAutoFit(widthPixels, heightPixels);
            }
            setSelectionBox(null);
            cropStartRef.current = null;
        }
    };`;
    
code = code.replace(oldUp, newUp);
fs.writeFileSync('hooks/useGraphInteraction.ts', code);
console.log('Patched text selection during crop');
