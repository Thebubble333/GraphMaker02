const fs = require('fs');
let code = fs.readFileSync('pages/NetworkGrapher.tsx', 'utf8');

// 1. Remove old states
code = code.replace(/    const \[exportDpi, setExportDpi\] = useState\(300\);\s*const \[isCopied, setIsCopied\] = useState\(false\);\s*const \[previewScale, setPreviewScale\] = useState<number>\(1\);/, "");

// 2. Add useGraphInteraction
const insertionPoint = "const handleFitToScreen = () => {";
const hookCode = `
    const {
        previewScale, setPreviewScale,
        exportDpi, setExportDpi,
        cropMode, setCropMode,
        selectionBox: cropSelectionBox, customViewBox, hasInitialCrop,
        containerRef,
        handleAutoCrop, handleResetView, handleZoomOutCanvas, handleExportPNG, handleExportSVG, handleCopy, isCopied,
        handleCropMouseDown, handleCropMouseMove, handleCropMouseUp
    } = useGraphInteraction('network-canvas-svg', canvasWidth, canvasHeight, canvasWidth / 37.7952755906, false, true, 20); // skipInitialAutoFit=true for network

    // Override container ref to be the same if possible, or just use containerRef from hook
    // Actually the hook provides a containerRef, we'll assign it to the same div.
`;

code = code.replace(insertionPoint, hookCode + "\n    " + insertionPoint);

// 3. Remove old handleExportPNG, handleExportSVG, handleCopy
code = code.replace(/    const handleExportPNG = async \(\) => \{[\s\S]*?\};\n\n    const handleCopy = async \(\) => \{[\s\S]*?\};\n\n    const handleExportSVG = \(\) => \{[\s\S]*?\};\n/, "");

// 4. Update GraphToolbar usage
const oldToolbar = `<GraphToolbar 
                        previewScale={previewScale}
                        setPreviewScale={setPreviewScale}
                        onFitToScreen={handleFitToScreen}
                        onExportPNG={handleExportPNG}
                        onExportSVG={handleExportSVG}
                        onCopy={handleCopy}
                        isCopied={isCopied}
                        exportDpi={exportDpi}
                        onDpiChange={setExportDpi}
                        onUndo={undo}
                        onRedo={redo}
                        canUndo={canUndo}
                        canRedo={canRedo}
                        onExportData={() => exportToFile('network-grapher-project.json')}
                        onImportData={importFromFile}
                        onClearAll={() => {
                            setNodes([]);
                            setEdges([]);
                            setCuts([]);
                        }}
                    />`;
                    
const newToolbar = `<GraphToolbar 
                        previewScale={previewScale}
                        setPreviewScale={setPreviewScale}
                        cropMode={cropMode}
                        setCropMode={setCropMode}
                        onResetView={handleResetView}
                        onZoomOutCanvas={handleZoomOutCanvas}
                        onAutoCrop={handleAutoCrop}
                        onFitToScreen={handleFitToScreen}
                        onExportPNG={handleExportPNG}
                        onExportSVG={handleExportSVG}
                        onCopy={handleCopy}
                        isCopied={isCopied}
                        exportDpi={exportDpi}
                        onDpiChange={setExportDpi}
                        onUndo={undo}
                        onRedo={redo}
                        canUndo={canUndo}
                        canRedo={canRedo}
                        onExportData={() => exportToFile('network-grapher-project.json')}
                        onImportData={importFromFile}
                        onClearAll={() => {
                            setNodes([]);
                            setEdges([]);
                            setCuts([]);
                        }}
                    />`;

code = code.replace(oldToolbar, newToolbar);

// 5. Update SVG and container
// Add crop events to svg container and window.
// Wait, for NetworkGrapher, we have pointer events on SVG: onPointerDown={handleSvgPointerDown}.
// We should intercept handleSvgPointerDown for cropMode.
// Also we need to attach mousemove/up to the window for crop mode, which the hook handles for crop, but we need to call it.
