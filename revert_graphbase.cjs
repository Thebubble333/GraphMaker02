const fs = require('fs');
let code = fs.readFileSync('utils/graphBase.ts', 'utf8');

const newGridLines = `    const { xStart, xEnd, yStart, yEnd } = this.getGridBoundaries();
    
    // Expand grid lines infinitely so they do not get clipped when users zoom out or crop
    const gridHStart = -5000;
    const gridHEnd = 5000;
    const gridVStart = c.verticalGridMode === 'upward' ? this.originY : -5000;
    const gridVEnd = c.verticalGridMode === 'upward' ? -5000 : 5000;
    
    const vStart = gridVStart;
    const vEnd = gridVEnd;`;

const oldGridLines = `    const { xStart, xEnd, yStart, yEnd } = this.getGridBoundaries();
    const vStart = c.verticalGridMode === 'upward' ? this.originY : yStart;
    const vEnd = c.verticalGridMode === 'upward' ? yStart : yEnd;`;

code = code.replace(newGridLines, oldGridLines);

code = code.replace(
    /els\.push\(React\.createElement\('line', \{ key: \`h-minor-\$\{y\}\`, x1: gridHStart, y1: py, x2: gridHEnd, y2: py, stroke: "black", strokeWidth: c\.gridThicknessMinor \}\)\);/g,
    'els.push(React.createElement(\'line\', { key: `h-minor-${y}`, x1: xStart, y1: py, x2: xEnd, y2: py, stroke: "black", strokeWidth: c.gridThicknessMinor }));'
);
code = code.replace(
    /els\.push\(React\.createElement\('line', \{ key: \`h-major-\$\{y\}\`, x1: gridHStart, y1: py, x2: gridHEnd, y2: py, stroke: "black", strokeWidth: c\.gridThicknessMajor \}\)\);/g,
    'els.push(React.createElement(\'line\', { key: `h-major-${y}`, x1: xStart, y1: py, x2: xEnd, y2: py, stroke: "black", strokeWidth: c.gridThicknessMajor }));'
);

fs.writeFileSync('utils/graphBase.ts', code);
console.log('Reverted graphBase.ts');
