const fs = require('fs');
let code = fs.readFileSync('pages/BoxPlots.tsx', 'utf8');

// 1. Add states for boxSpacingCm and overrideGridTopY
code = code.replace(
    /const \[isFixedSize, setIsFixedSize\] = useState\(true\);/,
    `const [isFixedSize, setIsFixedSize] = useState(true);
  const [boxSpacingCm, setBoxSpacingCm] = useState(2);
  const [overrideGridTopY, setOverrideGridTopY] = useState<number | null>(null);

  const defaultGridTopY = useMemo(() => {
      let maxOffset = 0;
      let minOffset = Infinity;
      boxPlots.forEach(b => {
          if (b.heightOffset > maxOffset) maxOffset = b.heightOffset;
          if (b.heightOffset < minOffset) minOffset = b.heightOffset;
      });
      if (minOffset === Infinity) return 3;
      return maxOffset + minOffset;
  }, [boxPlots]);

  const gridTopY = overrideGridTopY !== null ? overrideGridTopY : defaultGridTopY;
`
);

// 2. Update useEffect for config
const oldUseEffectConfig = `  useEffect(() => {
    const xMin = parseMath(windowSettings.xMin);
    const xMax = parseMath(windowSettings.xMax);
    const yMax = parseMath(windowSettings.yMax);
    let xStep = Math.abs(parseMath(windowSettings.xStep));
    if (xStep < 1e-9) xStep = 1;
    const xSub = Math.max(1, Math.round(Number(windowSettings.xSubdivisions) || 1));
    const ySub = Math.max(1, Math.round(Number(windowSettings.ySubdivisions) || 1));
    
    setConfig(prev => ({ 
        ...prev, 
        xRange: [xMin, xMax], 
        yRange: [0, yMax], 
        majorStep: [xStep, 1], 
        subdivisions: [xSub, ySub]
    }));
  }, [windowSettings]);`;

const newUseEffectConfig = `  useEffect(() => {
    const xMin = parseMath(windowSettings.xMin);
    const xMax = parseMath(windowSettings.xMax);
    let xStep = Math.abs(parseMath(windowSettings.xStep));
    if (xStep < 1e-9) xStep = 1;
    const xSub = Math.max(1, Math.round(Number(windowSettings.xSubdivisions) || 1));
    const ySub = Math.max(1, Math.round(Number(windowSettings.ySubdivisions) || 1));
    
    let targetYMax = 3;
    if (isFixedSize) {
        const targetHeight = Math.round(dimCm.height * CM_TO_PX);
        const gridH = Math.max(1, targetHeight - 40 - 40); // Approx margins
        const desiredScaleY = boxSpacingCm * CM_TO_PX;
        targetYMax = gridH / desiredScaleY;
    } else {
        targetYMax = gridTopY + 0.5;
    }

    setConfig(prev => ({ 
        ...prev, 
        xRange: [xMin, xMax], 
        yRange: [0, targetYMax], 
        majorStep: [xStep, 1], 
        subdivisions: [xSub, ySub],
        showVerticalGrid: false,
        basePixelSize: boxSpacingCm * CM_TO_PX
    }));
  }, [windowSettings, dimCm, isFixedSize, boxSpacingCm, gridTopY]);`;

code = code.replace(oldUseEffectConfig, newUseEffectConfig);

// 3. Manual vertical grid lines inside renderBoxes
const renderBoxesRegex = /const els: React\.ReactNode\[\] = \[\];/;
const manualGridLogic = `const els: React.ReactNode[] = [];
        
        // Manual vertical grid
        const { xStart, xEnd, yStart, yEnd } = engine.getGridBoundaries();
        const vStart = engine.originY;
        const [_, vEndTop] = engine.mathToScreen(0, gridTopY);

        const generateSteps = (min: number, max: number, step: number) => {
            const start = Math.ceil(min / step);
            const end = Math.floor(max / step);
            const res = [];
            for (let i = start; i <= end; i++) res.push(i * step);
            return res;
        };

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

        // Grid Top Handle
        els.push(
            <g 
                key="grid-top-handle"
                className="cursor-ns-resize"
                onMouseDown={(e) => {
                    e.stopPropagation();
                    onMouseDown(e, gridTopY, (dx, dy, init) => {
                        const newY = init - dy / engine.scaleY;
                        setOverrideGridTopY(Math.max(0, newY));
                    });
                }}
            >
                <rect x={xStart} y={vEndTop - 8} width={xEnd - xStart} height={16} fill="transparent" />
                <line x1={xStart} y1={vEndTop} x2={xEnd} y2={vEndTop} stroke="#cbd5e1" strokeDasharray="4 4" strokeWidth={2} className="opacity-0 hover:opacity-100 transition-opacity" />
            </g>
        );
`;

code = code.replace(renderBoxesRegex, manualGridLogic);

// 4. Update the settings UI
const settingsUIRegex = /<div className="p-4 bg-gray-50 border-b border-gray-100">\s*<h2 className="text-xs font-bold text-gray-500 uppercase tracking-wider">X-Axis Settings<\/h2>\s*<\/div>/;

const newSettingsUI = `<div className="p-4 bg-gray-50 border-b border-gray-100">
                                <h2 className="text-xs font-bold text-gray-500 uppercase tracking-wider">Vertical Spacing & Grid</h2>
                            </div>
                            <div className="p-4 grid grid-cols-2 gap-4 border-b border-gray-200">
                                <div>
                                    <label className="block text-xs text-gray-500 mb-1" title="Physical distance between each unit on the Y-axis">Box Spacing (cm)</label>
                                    <input type="number" step="0.5" min="0.5" value={boxSpacingCm} onChange={(e) => setBoxSpacingCm(parseFloat(e.target.value) || 2)} className="w-full border rounded px-2 py-1 text-sm text-gray-800" />
                                </div>
                                <div>
                                    <label className="block text-xs text-gray-500 mb-1" title="How high the vertical grid lines extend">Grid Height (units)</label>
                                    <div className="flex gap-2">
                                        <input type="number" step="0.5" min="0" value={gridTopY.toFixed(2)} onChange={(e) => setOverrideGridTopY(parseFloat(e.target.value) || 0)} className="flex-1 border rounded px-2 py-1 text-sm text-gray-800" />
                                        {overrideGridTopY !== null && (
                                            <button onClick={() => setOverrideGridTopY(null)} className="px-2 bg-gray-100 hover:bg-gray-200 rounded text-xs text-gray-600 transition-colors" title="Reset to auto-height">Auto</button>
                                        )}
                                    </div>
                                </div>
                            </div>
                            <div className="p-4 bg-gray-50 border-b border-gray-100">
                                <h2 className="text-xs font-bold text-gray-500 uppercase tracking-wider">X-Axis Settings</h2>
                            </div>`;

code = code.replace(settingsUIRegex, newSettingsUI);

// 5. Remove yMax from axis-resize handler because we handle Y scale differently now
const axisResizeRegex = /onMouseDown\(e, initRange, \(dx, dy, init, ev\) => \{\s*const updates = calculateAxisResize\(axis, dx, dy, engine\.scaleX, engine\.scaleY, init, side, ev\.shiftKey\);\s*if \(Object\.keys\(updates\)\.length > 0\) \{\s*setWindowSettings\(prev => \(\{ \.\.\.prev, \.\.\.updates \}\)\);\s*\}\s*\}, undefined, 'axis-resize'\);/;
const newAxisResize = `onMouseDown(e, initRange, (dx, dy, init, ev) => {
          if (axis === 'y') return; // Disable dragging Y-axis to resize yMax, since we use Fixed Box Spacing
          const updates = calculateAxisResize(axis, dx, dy, engine.scaleX, engine.scaleY, init, side, ev.shiftKey);
          if (Object.keys(updates).length > 0) {
              setWindowSettings(prev => ({ ...prev, ...updates }));
          }
      }, undefined, 'axis-resize');`;

code = code.replace(axisResizeRegex, newAxisResize);

fs.writeFileSync('pages/BoxPlots.tsx', code);
console.log('Patched BoxPlots.tsx to use custom vertical grid and scaling.');
