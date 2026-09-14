const fs = require('fs');

const pagesDir = 'pages/';
const files = fs.readdirSync(pagesDir).filter(f => f.endsWith('.tsx'));

for (const file of files) {
    const filePath = pagesDir + file;
    let code = fs.readFileSync(filePath, 'utf8');
    
    if (code.includes('handleResetView') && !code.includes('handleZoomOutCanvas')) {
        // Try replacing the specific destructurings we know of
        code = code.replace(/handleResetView,\s*handleExportPNG/g, "handleResetView, handleZoomOutCanvas, handleExportPNG");
        code = code.replace(/handleResetView,\s*handleAutoCrop/g, "handleResetView, handleZoomOutCanvas, handleAutoCrop");
        code = code.replace(/handleResetView,\s*handleFitToScreen/g, "handleResetView, handleZoomOutCanvas, handleFitToScreen");
        
        // Sometimes it's handleAutoCrop, handleResetView
        code = code.replace(/handleAutoCrop,\s*handleResetView,\s*handleExportPNG/g, "handleAutoCrop, handleResetView, handleZoomOutCanvas, handleExportPNG");

        // Add to GraphToolbar props
        code = code.replace(/onResetView=\{handleResetView\}\s*onAutoCrop=\{handleAutoCrop\}/g, "onResetView={handleResetView} onZoomOutCanvas={handleZoomOutCanvas} onAutoCrop={handleAutoCrop}");
        code = code.replace(/onResetView=\{handleResetView\}\s*\/>/g, "onResetView={handleResetView} onZoomOutCanvas={handleZoomOutCanvas} />");
        code = code.replace(/onResetView=\{handleResetView\}\s*onExportPNG/g, "onResetView={handleResetView} onZoomOutCanvas={handleZoomOutCanvas} onExportPNG");
        
        fs.writeFileSync(filePath, code);
    }
}
console.log('Patched all pages.');
