const fs = require('fs');
let code = fs.readFileSync('pages/BoxPlots.tsx', 'utf8');

const oldLabelCode = `        // Label
        if (b.label && b.labelPos !== 'none') {
            if (b.labelPos === 'top') {
                boxGroup.push(...engine.texEngine.renderToSVG(b.label, medX, baselineY - boxHalfH - 15, engine.cfg.fontSize, 'black', 'middle', true, 'text'));
            } else if (b.labelPos === 'left') {
                let leftmostX = minX;
                if (b.showOutliers && outliers.length > 0) {
                    const minOutlierX = Math.min(...outliers.map(o => engine.mathToScreen(o, 0)[0]));
                    leftmostX = Math.min(minX, minOutlierX);
                }
                boxGroup.push(...engine.texEngine.renderToSVG(b.label, leftmostX - 15, baselineY + 4, engine.cfg.fontSize, 'black', 'end', true, 'text'));
            }
        }`;

const newLabelCode = `        // Label
        if (b.label && b.labelPos !== 'none') {
            const offset = b.labelOffset || { x: 0, y: 0 };
            let lx = medX;
            let ly = baselineY - boxHalfH - 15;
            let anchor = 'middle';
            
            if (b.labelPos === 'left') {
                let leftmostX = minX;
                if (b.showOutliers && outliers.length > 0) {
                    const minOutlierX = Math.min(...outliers.map(o => engine.mathToScreen(o, 0)[0]));
                    leftmostX = Math.min(minX, minOutlierX);
                }
                lx = leftmostX - 15;
                ly = baselineY + 4;
                anchor = 'end';
            }
            
            lx += offset.x;
            ly += offset.y;
            
            boxGroup.push(
                <g 
                    key={\`\${b.id}-label\`} 
                    style={{ cursor: cropMode ? 'crosshair' : 'move' }}
                    onMouseDown={(e) => {
                        if (cropMode) return;
                        e.stopPropagation();
                        onMouseDown(e, { x: offset.x, y: offset.y }, (dx, dy, init) => {
                            updateBoxPlot(b.id, { labelOffset: { x: init.x + dx, y: init.y + dy } });
                        });
                    }}
                >
                    {/* Add a transparent hit box for easier dragging */}
                    <rect x={lx - 60} y={ly - 20} width={120} height={30} fill="transparent" />
                    {engine.texEngine.renderToSVG(b.label, lx, ly, engine.cfg.fontSize, 'black', anchor as any, true, 'text')}
                </g>
            );
        }`;

code = code.replace(oldLabelCode, newLabelCode);

// Add a Reset Offset button in the sidebar next to the labelPos select
const oldSelectLabelPos = `<select value={b.labelPos} onChange={(e) => updateBoxPlot(b.id, { labelPos: e.target.value as any })} className="text-[10px] border rounded p-1">
                                              <option value="top">Top</option>
                                              <option value="left">Left</option>
                                              <option value="none">None</option>
                                          </select>`;

const newSelectLabelPos = `<select value={b.labelPos} onChange={(e) => updateBoxPlot(b.id, { labelPos: e.target.value as any })} className="text-[10px] border rounded p-1">
                                              <option value="top">Top</option>
                                              <option value="left">Left</option>
                                              <option value="none">None</option>
                                          </select>
                                          {(b.labelOffset && (b.labelOffset.x !== 0 || b.labelOffset.y !== 0)) && (
                                              <button onClick={() => updateBoxPlot(b.id, { labelOffset: {x: 0, y: 0} })} className="text-[10px] text-orange-600 hover:bg-orange-50 px-1 rounded transition-colors" title="Reset Label Position">Reset Pos</button>
                                          )}`;

code = code.replace(oldSelectLabelPos, newSelectLabelPos);

fs.writeFileSync('pages/BoxPlots.tsx', code);
console.log('Patched BoxPlots.tsx for label dragging');
