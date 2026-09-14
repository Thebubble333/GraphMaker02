const fs = require('fs');
let code = fs.readFileSync('pages/NetworkGrapher.tsx', 'utf8');

// 1. Intercept in handleSvgPointerDown
const oldPointerDown = `    const handleSvgPointerDown = (e: ReactMouseEvent) => {
        forceSnapshot();
        const { x, y } = getMouseCoords(e);`;

const newPointerDown = `    const handleSvgPointerDown = (e: ReactMouseEvent) => {
        if (cropMode) {
            handleCropMouseDown(e);
            return;
        }
        forceSnapshot();
        const { x, y } = getMouseCoords(e);`;

code = code.replace(oldPointerDown, newPointerDown);

// 2. Add mouse move/up listeners to window for crop mode.
// Let's check how dragging is implemented.
const dragEffectRegex = /useEffect\(\(\) => \{[\s\S]*?const handleGlobalMouseMove = \(e: MouseEvent\) => \{[\s\S]*?const handleGlobalMouseUp = \(\) => \{[\s\S]*?window\.addEventListener\('mousemove', handleGlobalMouseMove\);[\s\S]*?window\.addEventListener\('mouseup', handleGlobalMouseUp\);[\s\S]*?\}\s*\}, \[.*?\]\);/;

let match = code.match(dragEffectRegex);
if (match) {
    let effectBody = match[0];
    
    // Replace inside effect body
    effectBody = effectBody.replace(
        "const handleGlobalMouseMove = (e: MouseEvent) => {",
        "const handleGlobalMouseMove = (e: MouseEvent) => {\n            if (handleCropMouseMove(e as any)) return;"
    );
    
    effectBody = effectBody.replace(
        "const handleGlobalMouseUp = () => {",
        "const handleGlobalMouseUp = () => {\n            handleCropMouseUp();"
    );
    
    // Update dependencies
    effectBody = effectBody.replace(/\]\);$/, ", handleCropMouseMove, handleCropMouseUp]);");
    
    code = code.replace(match[0], effectBody);
} else {
    console.log("Could not find global mouse event effect.");
}

// 3. Add crop selection box rendering
const svgEndRegex = /<\/svg>/;
const cropRect = `
                            {/* Crop Overlay inside SVG */}
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
code = code.replace(svgEndRegex, cropRect);

// 4. Update container ref for useGraphInteraction
code = code.replace(
    `const canvasContainerRef = useRef<HTMLDivElement>(null);`,
    `const canvasContainerRef = useRef<HTMLDivElement>(null);
    // Bind the hook's containerRef to our same element. We'll attach containerRef to the div.`
);
code = code.replace(
    `<div ref={canvasContainerRef} className="flex-1 relative bg-gray-200 overflow-auto p-8 flex">`,
    `<div ref={(node) => { canvasContainerRef.current = node; if (containerRef) containerRef.current = node; }} className="flex-1 relative bg-gray-200 overflow-auto p-8 flex">`
);

// 5. Inject customViewBox into SVG
code = code.replace(
    /viewBox=\{\`0 0 \$\{canvasWidth\} \$\{canvasHeight\}\`\}/,
    "viewBox={customViewBox || `0 0 ${canvasWidth} ${canvasHeight}`}"
);


fs.writeFileSync('pages/NetworkGrapher.tsx', code);
console.log('Patched NetworkGrapher.tsx with crop events');
