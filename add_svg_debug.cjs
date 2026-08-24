const fs = require('fs');
let code = fs.readFileSync('pages/NetworkGrapher.tsx', 'utf8');

const svgRegex = /(<\/svg>)/;

const debugJSX = `{debugEdgeLabels && edges.map(e => {
                                        if (!e.label) return null;
                                        const fn = nodes.find(n => n.id === e.from);
                                        const tn = nodes.find(n => n.id === e.to);
                                        if (!fn || !tn) return null;
                                        let midX = 0, midY = 0, dx = 0, dy = 0;
                                        if (e.isLoop) { midX = e.cp1 ? e.cp1.x : fn.x; midY = e.cp1 ? e.cp1.y : fn.y - 60; dx = 1; dy = 0; }
                                        else if (e.isCurve && e.cp1) { midX = 0.25 * fn.x + 0.5 * e.cp1.x + 0.25 * tn.x; midY = 0.25 * fn.y + 0.5 * e.cp1.y + 0.25 * tn.y; dx = tn.x - fn.x; dy = tn.y - fn.y; }
                                        else { midX = (fn.x + tn.x) / 2; midY = (fn.y + tn.y) / 2; dx = tn.x - fn.x; dy = tn.y - fn.y; }
                                        
                                        let len = Math.hypot(dx, dy) || 1;
                                        let tx = dx / len; let ty = dy / len;
                                        let nx = -ty; let ny = tx;
                                        
                                        let lx = midX + (e.labelOffset?.x || 0);
                                        let ly = midY + (e.labelOffset?.y || 0);
                                        
                                        let lw = Math.max(20, e.label.length * 8);
                                        let lh = 16;
                                        
                                        let px1 = midX - nx * 100;
                                        let py1 = midY - ny * 100;
                                        let px2 = midX + nx * 100;
                                        let py2 = midY + ny * 100;

                                        return (
                                            <g key={\`debug-\${e.id}\`} pointerEvents="none">
                                                <line x1={px1} y1={py1} x2={px2} y2={py2} stroke="red" strokeWidth="1" strokeDasharray="4 4" opacity={0.5} />
                                                <circle cx={lx} cy={ly} r="3" fill="blue" />
                                                <rect x={lx - lw/2} y={ly - lh/2} width={lw} height={lh} fill="none" stroke="blue" strokeWidth="1" strokeDasharray="2 2" opacity={0.5} />
                                            </g>
                                        );
                                    })}
                                    $1`;

code = code.replace(svgRegex, debugJSX);
fs.writeFileSync('pages/NetworkGrapher.tsx', code);
