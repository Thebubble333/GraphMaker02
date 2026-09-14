const fs = require('fs');
let code = fs.readFileSync('pages/BoxPlots.tsx', 'utf8');

code = code.replace(/handleAutoCrop, handleResetView, handleExportPNG,/, "handleAutoCrop, handleResetView, handleZoomOutCanvas, handleExportPNG,");
code = code.replace(/onResetView=\{handleResetView\} onAutoCrop=\{handleAutoCrop\}/, "onResetView={handleResetView} onZoomOutCanvas={handleZoomOutCanvas} onAutoCrop={handleAutoCrop}");

fs.writeFileSync('pages/BoxPlots.tsx', code);
console.log('Patched BoxPlots.tsx toolbar');
