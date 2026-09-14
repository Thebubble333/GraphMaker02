const fs = require('fs');
let code = fs.readFileSync('pages/BoxPlots.tsx', 'utf8');

// 1. Disable showBorder in BaseGraphEngine
code = code.replace(
    /const engine = useMemo\(\(\) => new BaseGraphEngine\(config\), \[config\]\);/,
    "const engine = useMemo(() => new BaseGraphEngine({ ...config, showBorder: false }), [config]);"
);

// 2. Add manual border drawing in renderBoxes
const renderBoxesGridTop = `        const { xStart, xEnd, yStart, yEnd } = engine.getGridBoundaries();
        const vStart = engine.originY;
        const [_, vEndTop] = engine.mathToScreen(0, gridTopY);`;

const newRenderBoxesGridTop = `        const { xStart, xEnd, yStart, yEnd } = engine.getGridBoundaries();
        const vStart = engine.originY;
        const [_, vEndTop] = engine.mathToScreen(0, gridTopY);

        if (config.showBorder) {
            els.push(<rect key="custom-border" x={xStart} y={vEndTop} width={xEnd - xStart} height={Math.max(0, vStart - vEndTop)} fill="none" stroke="black" strokeWidth={config.gridThicknessMajor} />);
        }`;

code = code.replace(renderBoxesGridTop, newRenderBoxesGridTop);

fs.writeFileSync('pages/BoxPlots.tsx', code);
console.log('Patched BoxPlots.tsx to use custom border');
