const fs = require('fs');
let code = fs.readFileSync('pages/NetworkGrapher.tsx', 'utf8');

// 1. Remove canvasContainerRef
code = code.replace(
    /    const canvasContainerRef = useRef<HTMLDivElement>\(null\);\n    \/\/ Bind the hook's containerRef to our same element. We'll attach containerRef to the div.\n/,
    ""
);

// 2. Remove local handleFitToScreen
code = code.replace(
    /    const handleFitToScreen = \(\) => \{[\s\S]*?\n    \};\n/,
    ""
);

// 3. Extract handleFitToScreen from useGraphInteraction
code = code.replace(
    /handleAutoCrop, handleResetView, handleZoomOutCanvas,/,
    "handleAutoCrop, handleResetView, handleZoomOutCanvas, handleFitToScreen,"
);

// 4. Update the ref on the div
code = code.replace(
    /<div ref=\{\(node\) => \{ canvasContainerRef\.current = node; if \(containerRef\) containerRef\.current = node; \}\} className="flex-1 relative bg-gray-200 overflow-auto p-8 flex">/,
    `<div ref={containerRef} className="flex-1 relative bg-gray-200 overflow-auto p-8 flex">`
);

fs.writeFileSync('pages/NetworkGrapher.tsx', code);
console.log('Fixed refs and handleFitToScreen');
