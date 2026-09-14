const fs = require('fs');
let code = fs.readFileSync('pages/NetworkGrapher.tsx', 'utf8');

// 1. Remove old states
code = code.replace(/    const \[exportDpi, setExportDpi\] = useState\(300\);\n    const \[isCopied, setIsCopied\] = useState\(false\);\n    const \[previewScale, setPreviewScale\] = useState<number>\(1\);\n/, "");

// 2. Add useGraphInteraction call
const interactionCode = `    const {
        previewScale, setPreviewScale,
        exportDpi, setExportDpi,
        cropMode, setCropMode,
        selectionBox: cropSelectionBox, customViewBox, hasInitialCrop,
        containerRef,
        handleAutoCrop, handleResetView, handleZoomOutCanvas, handleExportPNG, handleExportSVG, handleCopy, isCopied,
        handleCropMouseDown, handleCropMouseMove, handleCropMouseUp
    } = useGraphInteraction('network-canvas-svg', canvasWidth, canvasHeight, canvasWidth / 37.7952755906, false, true, 20);
`;

const insertHookPoint = "    const svgRef = useRef<SVGSVGElement>(null);";
code = code.replace(insertHookPoint, interactionCode + "\n" + insertHookPoint);

// 3. Remove old export functions
const exportRegex = /    const handleExportPNG = async \(\) => \{[\s\S]*?\n    \};\n\n    const handleCopy = async \(\) => \{[\s\S]*?\n    \};\n\n    const handleExportSVG = \(\) => \{[\s\S]*?\n    \};\n/;
code = code.replace(exportRegex, "");

// 4. Update pointer down
const oldSvgDown = `    const handleSvgPointerDown = (e: ReactMouseEvent) => {
        forceSnapshot();
        const { x, y } = getMouseCoords(e);`;
const newSvgDown = `    const handleSvgPointerDown = (e: ReactMouseEvent) => {
        if (cropMode) {
            handleCropMouseDown(e);
            return;
        }
        forceSnapshot();
        const { x, y } = getMouseCoords(e);`;
code = code.replace(oldSvgDown, newSvgDown);

// 5. Update pointer move
const oldPointerMove = `    const handlePointerMove = (e: ReactMouseEvent | MouseEvent) => {
        const coords = getMouseCoords(e);`;
const newPointerMove = `    const handlePointerMove = (e: ReactMouseEvent | MouseEvent) => {
        if (handleCropMouseMove(e as any)) return;
        const coords = getMouseCoords(e);`;
code = code.replace(oldPointerMove, newPointerMove);

// 6. Update pointer up
const oldPointerUp = `    const handlePointerUp = () => {
        setDraggingNodes([]);`;
const newPointerUp = `    const handlePointerUp = () => {
        handleCropMouseUp();
        setDraggingNodes([]);`;
code = code.replace(oldPointerUp, newPointerUp);

// 7. Update GraphToolbar
const oldToolbar = /<GraphToolbar[\s\S]*?onClearAll=\{\(\) => \{\n\s*setNodes\(\[\]\);\n\s*setEdges\(\[\]\);\n\s*setCuts\(\[\]\);\n\s*\}\}\n\s*\/>/;
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

// 8. Update SVG markup
code = code.replace(
    /viewBox=\{\`0 0 \$\{canvasWidth\} \$\{canvasHeight\}\`\}/,
    "viewBox={customViewBox || `0 0 ${canvasWidth} ${canvasHeight}`}"
);

const svgEndStr = `                            </svg>`;
const newSvgEnd = `                            {/* Crop Overlay */}
                            {cropMode && cropSelectionBox && (
                                <rect 
                                    x={cropSelectionBox.x} y={cropSelectionBox.y} 
                                    width={cropSelectionBox.w} height={cropSelectionBox.h}
                                    fill="rgba(59, 130, 246, 0.2)"
                                    stroke="#2563eb"
                                    strokeWidth={2 / previewScale} 
                                    strokeDasharray={\`\${5/previewScale},\${5/previewScale}\`}
                                    pointerEvents="none"
                                />
                            )}
                            </svg>`;
code = code.replace(svgEndStr, newSvgEnd);

// Also attach containerRef
code = code.replace(
    `<div ref={canvasContainerRef} className="flex-1 relative bg-gray-200 overflow-auto p-8 flex">`,
    `<div ref={(node) => { canvasContainerRef.current = node; if (containerRef) containerRef.current = node; }} className="flex-1 relative bg-gray-200 overflow-auto p-8 flex">`
);

// We should also add cropMode, handleCropMouseMove, handleCropMouseUp to useEffect dependency array if needed.
// Wait, useGraphInteraction's hooks are stable if they use ref, but let's just make sure they don't cause infinite re-renders.
// The pointer events effect depends on a long list of dependencies. We can just add cropMode to it.
code = code.replace(
    /, cuts\]\);/,
    ", cuts, cropMode]);"
);

fs.writeFileSync('pages/NetworkGrapher.tsx', code);
console.log('Patched NetworkGrapher with crop mode!');
