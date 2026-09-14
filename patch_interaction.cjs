const fs = require('fs');
let code = fs.readFileSync('hooks/useGraphInteraction.ts', 'utf8');

const hookBody = `
    const handleFitToScreen = useCallback(() => {
        performAutoFit(widthPixels, heightPixels);
    }, [widthPixels, heightPixels, performAutoFit]);

    const handleZoomOutCanvas = useCallback(() => {
        if (!customViewBox) {
            const w = widthPixels * 1.5;
            const h = heightPixels * 1.5;
            const dx = (widthPixels - w) / 2;
            const dy = (heightPixels - h) / 2;
            setCustomViewBox(\`\${dx} \${dy} \${w} \${h}\`);
        } else {
            const [x, y, w, h] = customViewBox.split(' ').map(Number);
            const nw = w * 1.5;
            const nh = h * 1.5;
            const nx = x - (nw - w) / 2;
            const ny = y - (nh - h) / 2;
            setCustomViewBox(\`\${nx} \${ny} \${nw} \${nh}\`);
        }
        setTimeout(() => performAutoFit(widthPixels, heightPixels), 50);
    }, [customViewBox, widthPixels, heightPixels, performAutoFit]);

    useEffect(() => {
`;

code = code.replace(/    const handleFitToScreen = useCallback\(\(\) => \{\n        performAutoFit\(widthPixels, heightPixels\);\n    \}, \[widthPixels, heightPixels, performAutoFit\]\);\n\n    useEffect\(\(\) => \{/, hookBody);

const exportList = `
        handleAutoCrop,
        handleResetView,
        handleFitToScreen,
        handleZoomOutCanvas,
        handleExportPNG,
`;

code = code.replace(/        handleAutoCrop,\n        handleResetView,\n        handleFitToScreen,\n        handleExportPNG,/, exportList);

fs.writeFileSync('hooks/useGraphInteraction.ts', code);
console.log('Patched useGraphInteraction.ts');
