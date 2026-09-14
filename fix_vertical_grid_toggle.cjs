const fs = require('fs');
let code = fs.readFileSync('pages/BoxPlots.tsx', 'utf8');

// Remove showVerticalGrid: false from the setConfig call in useEffect
code = code.replace(
    /        subdivisions: \[xSub, ySub\],\n        showVerticalGrid: false,\n        basePixelSize: boxSpacingCm \* CM_TO_PX/,
    "        subdivisions: [xSub, ySub],\n        basePixelSize: boxSpacingCm * CM_TO_PX"
);

// Pass showVerticalGrid: false to engine
code = code.replace(
    /const engine = useMemo\(\(\) => new BaseGraphEngine\(\{ \.\.\.config, showBorder: false \}\), \[config\]\);/,
    "const engine = useMemo(() => new BaseGraphEngine({ ...config, showBorder: false, showVerticalGrid: false }), [config]);"
);

// Add condition for vertical grid lines in renderBoxes
const oldManualGrid = `        if (config.showMinorGrid) {
            const minorStep = config.majorStep[0] / config.subdivisions[0];
            generateSteps(config.xRange[0], config.xRange[1], minorStep).forEach(x => {
                const [px] = engine.mathToScreen(x, 0);
                els.push(<line key={\`v-minor-\$\{x\}\`} x1={px} y1={vStart} x2={px} y2={vEndTop} stroke="black" strokeWidth={config.gridThicknessMinor} />);
            });
        }
        generateSteps(config.xRange[0], config.xRange[1], config.majorStep[0]).forEach(x => {
            const [px] = engine.mathToScreen(x, 0);
            els.push(<line key={\`v-major-\$\{x\}\`} x1={px} y1={vStart} x2={px} y2={vEndTop} stroke="black" strokeWidth={config.gridThicknessMajor} />);
        });`;

const newManualGrid = `        if (config.showVerticalGrid) {
            if (config.showMinorGrid) {
                const minorStep = config.majorStep[0] / config.subdivisions[0];
                generateSteps(config.xRange[0], config.xRange[1], minorStep).forEach(x => {
                    const [px] = engine.mathToScreen(x, 0);
                    els.push(<line key={\`v-minor-\$\{x\}\`} x1={px} y1={vStart} x2={px} y2={vEndTop} stroke="black" strokeWidth={config.gridThicknessMinor} />);
                });
            }
            generateSteps(config.xRange[0], config.xRange[1], config.majorStep[0]).forEach(x => {
                const [px] = engine.mathToScreen(x, 0);
                els.push(<line key={\`v-major-\$\{x\}\`} x1={px} y1={vStart} x2={px} y2={vEndTop} stroke="black" strokeWidth={config.gridThicknessMajor} />);
            });
        }`;
        
code = code.replace(oldManualGrid, newManualGrid);

fs.writeFileSync('pages/BoxPlots.tsx', code);
console.log('Fixed vertical grid toggle logic.');
