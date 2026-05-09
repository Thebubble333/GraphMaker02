import React, { useState, useRef, useMemo } from 'react';
import { Settings, Download, Copy, Plus, Trash2, List, Grid } from 'lucide-react';
import { TexEngine } from '../utils/textRenderer';
import { GraphToolbar } from '../components/GraphToolbar';
import { generateGraphImage, downloadSVG, copyImageToClipboard, ptToSvgUnits } from '../utils/imageExport';

type Mode = 'bag' | 'custom';

interface BagItem {
  id: string;
  label: string;
  count: number;
}

interface CustomOutcome {
  id: string;
  label: string;
  num: number;
  den: number;
}

interface CustomStep {
  id: string;
  name: string;
  outcomes: CustomOutcome[];
}

interface TreeNode {
  label: string;
  probNum: number;
  probDen: number;
  children: TreeNode[];
  pathLabels: string[];
  pathProbs: { num: number, den: number }[];
}

export default function TreeDiagrams() {
  const [mode, setMode] = useState<Mode>('custom');
  
  // Bag Mode State
  const [bagItems, setBagItems] = useState<BagItem[]>([
    { id: '1', label: 'Red', count: 5 },
    { id: '2', label: 'Blue', count: 3 }
  ]);
  const [numDraws, setNumDraws] = useState<number>(2);
  const [withReplacement, setWithReplacement] = useState<boolean>(false);
  const [bagStepNames, setBagStepNames] = useState<string[]>(['First draw', 'Second draw', 'Third draw']);

  // Custom Mode State
  const [customSteps, setCustomSteps] = useState<CustomStep[]>([
    {
      id: 's1', name: 'Coin 1',
      outcomes: [
        { id: 'o1', label: 'H', num: 1, den: 2 },
        { id: 'o2', label: 'T', num: 1, den: 2 }
      ]
    },
    {
      id: 's2', name: 'Coin 2',
      outcomes: [
        { id: 'o3', label: 'H', num: 1, den: 2 },
        { id: 'o4', label: 'T', num: 1, den: 2 }
      ]
    }
  ]);

  // View Settings
  const [showProbabilities, setShowProbabilities] = useState(true);
  const [showOutcomes, setShowOutcomes] = useState(true);
  const [showCalculations, setShowCalculations] = useState(true);
  const [studentMode, setStudentMode] = useState(false);
  const [fontSize, setFontSize] = useState(11);
  const [activeTab, setActiveTab] = useState<'data' | 'settings'>('data');
  const [exportDpi, setExportDpi] = useState(300);
  const [isCopied, setIsCopied] = useState(false);

  // --- Tree Generation ---
  const tree = useMemo(() => {
    if (mode === 'bag') {
      const buildBagTree = (depth: number, currentPath: string[], currentProbs: {num: number, den: number}[], currentCounts: Record<string, number>): TreeNode[] => {
        if (depth >= numDraws) return [];
        
        const total = Object.values(currentCounts).reduce((a, b) => a + b, 0);
        if (total === 0) return [];

        return bagItems.map(item => {
          const count = currentCounts[item.id] || 0;
          const probNum = count;
          const probDen = total;
          
          const nextCounts = { ...currentCounts };
          if (!withReplacement && nextCounts[item.id] > 0) {
            nextCounts[item.id] -= 1;
          }

          const newPath = [...currentPath, item.label];
          const newProbs = [...currentProbs, { num: probNum, den: probDen }];

          return {
            label: item.label,
            probNum,
            probDen,
            pathLabels: newPath,
            pathProbs: newProbs,
            children: buildBagTree(depth + 1, newPath, newProbs, nextCounts)
          };
        }).filter(node => node.probNum > 0); // Hide branches with 0 probability
      };

      const initialCounts = bagItems.reduce((acc, item) => ({ ...acc, [item.id]: item.count }), {} as Record<string, number>);
      return buildBagTree(0, [], [], initialCounts);
    } else {
      const buildCustomTree = (stepIndex: number, currentPath: string[], currentProbs: {num: number, den: number}[]): TreeNode[] => {
        if (stepIndex >= customSteps.length) return [];
        
        const step = customSteps[stepIndex];
        return step.outcomes.map(outcome => {
          const newPath = [...currentPath, outcome.label];
          const newProbs = [...currentProbs, { num: outcome.num, den: outcome.den }];
          
          return {
            label: outcome.label,
            probNum: outcome.num,
            probDen: outcome.den,
            pathLabels: newPath,
            pathProbs: newProbs,
            children: buildCustomTree(stepIndex + 1, newPath, newProbs)
          };
        });
      };

      return buildCustomTree(0, [], []);
    }
  }, [mode, bagItems, numDraws, withReplacement, customSteps]);

  // --- SVG Rendering ---
  const svgRef = useRef<SVGSVGElement>(null);
  const texEngine = useMemo(() => new TexEngine(), []);
  
  const numSteps = mode === 'bag' ? numDraws : customSteps.length;

  // Calculate dynamic column widths
  const columnWidths = useMemo(() => {
    const widths: number[] = [];
    
    // Calculate width for each step
    for (let i = 0; i < numSteps; i++) {
      let maxLabelWidth = 0;
      
      const measureNodes = (nodes: TreeNode[], currentDepth: number) => {
        if (currentDepth === i) {
          nodes.forEach(n => {
            const w = texEngine.measure(n.label, 16).width;
            if (w > maxLabelWidth) maxLabelWidth = w;
          });
        } else if (currentDepth < i) {
          nodes.forEach(n => measureNodes(n.children, currentDepth + 1));
        }
      };
      
      measureNodes(tree, 0);
      
      // Minimum width for a step to fit the line and probability
      // Line needs some length, say 100px. Label needs maxLabelWidth + 20px padding.
      let headerText = '';
      if (mode === 'custom' && customSteps[i]) headerText = customSteps[i].name;
      else if (mode === 'bag' && bagStepNames[i]) headerText = bagStepNames[i];
      else headerText = `Draw ${i + 1}`;
      
      const headerWidth = texEngine.measure(headerText, 18).width + 40;
      const stepW = Math.max(120 + maxLabelWidth, headerWidth);
      widths.push(stepW);
    }
    
    // Calculate outcomes width
    let maxOutcomeWidth = 0;
    const measureOutcomes = (nodes: TreeNode[]) => {
      nodes.forEach(n => {
        if (n.children.length === 0) {
          const outcomeText = n.pathLabels.join(' and ');
          const w = texEngine.measure(outcomeText, 16).width;
          if (w > maxOutcomeWidth) maxOutcomeWidth = w;
        } else {
          measureOutcomes(n.children);
        }
      });
    };
    if (showOutcomes) {
      measureOutcomes(tree);
      const headerWidth = texEngine.measure('Outcomes:', 18).width + 40;
      widths.push(Math.max(maxOutcomeWidth + 40, headerWidth));
    } else {
      widths.push(0);
    }
    
    // Calculate calculations width
    let maxCalcWidth = 0;
    const measureCalculations = (nodes: TreeNode[]) => {
      nodes.forEach(n => {
        if (n.children.length === 0) {
          let calcW = 0;
          n.pathProbs.forEach((p, i) => {
            calcW += texEngine.measure(`\\frac{${p.num}}{${p.den}}`, 16).width;
            if (i < n.pathProbs.length - 1) {
              calcW += texEngine.measure('\\times', 16).width + 10; // 10px padding
            }
          });
          calcW += texEngine.measure('=', 16).width + 20; // 20px padding
          
          const finalNum = n.pathProbs.reduce((acc, p) => acc * p.num, 1);
          const finalDen = n.pathProbs.reduce((acc, p) => acc * p.den, 1);
          calcW += texEngine.measure(`\\frac{${finalNum}}{${finalDen}}`, 16).width;
          
          if (calcW > maxCalcWidth) maxCalcWidth = calcW;
        } else {
          measureCalculations(n.children);
        }
      });
    };
    if (showCalculations) {
      measureCalculations(tree);
      const headerWidth = texEngine.measure('Probabilities:', 18).width + 40;
      widths.push(Math.max(maxCalcWidth + 40, headerWidth));
    } else {
      widths.push(0);
    }
    
    return widths;
  }, [tree, numSteps, mode, customSteps, bagStepNames, showOutcomes, showCalculations, texEngine]);

  const columnXs = useMemo(() => {
    const xs = [50];
    let currentX = 50;
    columnWidths.forEach(w => {
      currentX += w;
      xs.push(currentX);
    });
    return xs;
  }, [columnWidths]);

  const width = columnXs[columnXs.length - 1] + 50;
  
  // Count leaves to determine height
  const getLeavesCount = (nodes: TreeNode[]): number => {
    if (nodes.length === 0) return 1;
    return nodes.reduce((sum, node) => sum + (node.children.length > 0 ? getLeavesCount(node.children) : 1), 0);
  };
  const totalLeaves = getLeavesCount(tree);
  const rowHeight = 80;
  const height = Math.max(400, totalLeaves * rowHeight + 100);

  const renderFraction = (num: number, den: number, x: number, y: number) => {
    return texEngine.renderToSVG(`\\frac{${num}}{${den}}`, x, y, ptToSvgUnits(fontSize), '#000000', 'middle', true, 'math');
  };

  const renderTreeNodes = (nodes: TreeNode[], depth: number, startY: number, endY: number, parentX: number, parentY: number) => {
    const elements: React.ReactNode[] = [];
    let currentY = startY;
    
    const stepX = columnXs[depth + 1] - texEngine.measure(nodes[0]?.label || '', 16).width - 20;

    nodes.forEach((node, idx) => {
      const nodeLeaves = node.children.length > 0 ? getLeavesCount(node.children) : 1;
      const nodeHeight = nodeLeaves * rowHeight;
      const nodeCenterY = currentY + nodeHeight / 2;
      
      const nodeLabelWidth = texEngine.measure(node.label, 16).width;
      const actualStepX = columnXs[depth + 1] - nodeLabelWidth - 20;

      // Draw line from parent to this node
      if (depth > 0) {
        elements.push(
          <line 
            key={`line-${depth}-${idx}-${currentY}`}
            x1={parentX} y1={parentY} 
            x2={actualStepX} y2={nodeCenterY} 
            stroke="#000000" strokeWidth="1.5" 
          />
        );
        
        // Draw probability on the line
        if (showProbabilities && !studentMode) {
          const midX = (parentX + actualStepX) / 2;
          const midY = (parentY + nodeCenterY) / 2;
          elements.push(
            <g key={`prob-${depth}-${idx}-${currentY}`}>
              {renderFraction(node.probNum, node.probDen, midX, midY)}
            </g>
          );
        }
      } else {
        // Root node lines start from a common point
        const rootX = 50;
        const rootY = parentY;
        elements.push(
          <line 
            key={`line-root-${idx}`}
            x1={rootX} y1={rootY} 
            x2={actualStepX} y2={nodeCenterY} 
            stroke="#000000" strokeWidth="1.5" 
          />
        );
        
        if (showProbabilities && !studentMode) {
          const midX = (rootX + actualStepX) / 2;
          const midY = (rootY + nodeCenterY) / 2;
          elements.push(
            <g key={`prob-root-${idx}`}>
              {renderFraction(node.probNum, node.probDen, midX, midY)}
            </g>
          );
        }
      }

      // Draw node label
      elements.push(
        <g key={`label-${depth}-${idx}-${currentY}`}>
          {texEngine.renderToSVG(node.label, actualStepX + 10, nodeCenterY + 5, ptToSvgUnits(fontSize), '#000000', 'start', true, 'text')}
        </g>
      );

      // Recursively draw children
      if (node.children.length > 0) {
        elements.push(...renderTreeNodes(node.children, depth + 1, currentY, currentY + nodeHeight, actualStepX + nodeLabelWidth + 20, nodeCenterY));
      } else {
        // Draw outcomes and calculations at the leaf
        const outX = columnXs[numSteps] + 20;
        
        if (showOutcomes && !studentMode) {
          const outcomeText = node.pathLabels.join(' and ');
          elements.push(
            <g key={`out-${currentY}`}>
              {texEngine.renderToSVG(outcomeText, outX, nodeCenterY + 5, ptToSvgUnits(fontSize), '#000000', 'start', true, 'text')}
            </g>
          );
        }

        if (showCalculations && !studentMode) {
          const calcX = columnXs[numSteps + (showOutcomes ? 1 : 0)] + 20;
          let currentCalcX = calcX;
          
          let finalNum = 1;
          let finalDen = 1;

          node.pathProbs.forEach((p, i) => {
            const fracW = texEngine.measure(`\\frac{${p.num}}{${p.den}}`, 16).width;
            elements.push(
              <g key={`calc-frac-${currentY}-${i}`}>
                {renderFraction(p.num, p.den, currentCalcX + fracW / 2, nodeCenterY)}
              </g>
            );
            currentCalcX += fracW;
            
            if (i < node.pathProbs.length - 1) {
              const timesW = texEngine.measure('\\times', 16).width;
              elements.push(
                <g key={`calc-mul-${currentY}-${i}`}>
                  {texEngine.renderToSVG('\\times', currentCalcX + 2 + timesW / 2, nodeCenterY + 5, ptToSvgUnits(fontSize), '#000000', 'middle', true, 'math')}
                </g>
              );
              currentCalcX += timesW + 4;
            }
            
            finalNum *= p.num;
            finalDen *= p.den;
          });

          const eqW = texEngine.measure('=', 16).width;
          elements.push(
            <g key={`calc-eq-${currentY}`}>
              {texEngine.renderToSVG('=', currentCalcX + 4 + eqW / 2, nodeCenterY + 5, ptToSvgUnits(fontSize), '#000000', 'middle', true, 'math')}
            </g>
          );
          currentCalcX += eqW + 8;

          const finalFracW = texEngine.measure(`\\frac{${finalNum}}{${finalDen}}`, 16).width;
          elements.push(
            <g key={`calc-final-${currentY}`}>
              {renderFraction(finalNum, finalDen, currentCalcX + finalFracW / 2, nodeCenterY)}
            </g>
          );
        }
      }

      currentY += nodeHeight;
    });

    return elements;
  };

  // --- Handlers ---
  const handleAddBagItem = () => {
    setBagItems([...bagItems, { id: Date.now().toString(), label: `Item ${bagItems.length + 1}`, count: 1 }]);
  };

  const handleUpdateBagItem = (id: string, updates: Partial<BagItem>) => {
    setBagItems(bagItems.map(item => item.id === id ? { ...item, ...updates } : item));
  };

  const handleRemoveBagItem = (id: string) => {
    setBagItems(bagItems.filter(item => item.id !== id));
  };

  const handleAddCustomStep = () => {
    setCustomSteps([...customSteps, {
      id: Date.now().toString(),
      name: `Event ${customSteps.length + 1}`,
      outcomes: [
        { id: Date.now().toString() + '1', label: 'Outcome A', num: 1, den: 2 },
        { id: Date.now().toString() + '2', label: 'Outcome B', num: 1, den: 2 }
      ]
    }]);
  };

  const handleUpdateCustomStep = (id: string, name: string) => {
    setCustomSteps(customSteps.map(step => step.id === id ? { ...step, name } : step));
  };

  const handleRemoveCustomStep = (id: string) => {
    setCustomSteps(customSteps.filter(step => step.id !== id));
  };

  const handleAddCustomOutcome = (stepId: string) => {
    setCustomSteps(customSteps.map(step => {
      if (step.id === stepId) {
        return {
          ...step,
          outcomes: [...step.outcomes, { id: Date.now().toString(), label: 'New', num: 1, den: 2 }]
        };
      }
      return step;
    }));
  };

  const handleUpdateCustomOutcome = (stepId: string, outcomeId: string, updates: Partial<CustomOutcome>) => {
    setCustomSteps(customSteps.map(step => {
      if (step.id === stepId) {
        return {
          ...step,
          outcomes: step.outcomes.map(o => o.id === outcomeId ? { ...o, ...updates } : o)
        };
      }
      return step;
    }));
  };

  const handleRemoveCustomOutcome = (stepId: string, outcomeId: string) => {
    setCustomSteps(customSteps.map(step => {
      if (step.id === stepId) {
        return {
          ...step,
          outcomes: step.outcomes.filter(o => o.id !== outcomeId)
        };
      }
      return step;
    }));
  };

  const handleExportSVG = () => {
    downloadSVG('tree-diagram-svg', 'tree-diagram.svg');
  };

  const handleExportPNG = async () => {
    const result = await generateGraphImage('tree-diagram-svg', width, height, width / 37.8, true, 0, exportDpi);
    if (result && result.blob) {
      const url = URL.createObjectURL(result.blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = 'tree-diagram.png';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    }
  };

  const handleCopy = async () => {
    const result = await generateGraphImage('tree-diagram-svg', width, height, width / 37.8, true, 0, exportDpi);
    if (result && result.blob) {
      try {
        await copyImageToClipboard(result.blob, result.widthCm, result.heightCm);
        setIsCopied(true);
        setTimeout(() => setIsCopied(false), 2000);
      } catch (err) {
        console.error("Failed to copy", err);
      }
    }
  };

  return (
    <div className="flex h-full flex-col bg-gray-50">
      <header className="flex items-center justify-between px-6 py-3 bg-white border-b border-gray-200 shadow-sm z-10">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-indigo-50 text-indigo-600 rounded-lg"><Grid className="w-5 h-5" /></div>
          <h1 className="text-xl font-semibold text-gray-800">Tree Diagrams</h1>
        </div>
        
        <div className="flex items-center gap-2">
          <GraphToolbar 
            onExportPNG={handleExportPNG} 
            onCopy={handleCopy} 
            isCopied={isCopied} 
            onExportSVG={handleExportSVG}
            exportDpi={exportDpi}
            onDpiChange={setExportDpi}
          />
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        <aside className="w-80 bg-white border-r border-gray-200 flex flex-col h-full z-20">
          <div className="flex border-b border-gray-200 bg-white">
            <button onClick={() => setActiveTab('data')} className={`flex-1 py-3 text-sm font-medium flex justify-center items-center gap-2 transition-colors ${activeTab === 'data' ? 'text-indigo-600 border-b-2 border-indigo-600 bg-indigo-50/50' : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'}`}><List size={16} /> Data</button>
            <button onClick={() => setActiveTab('settings')} className={`flex-1 py-3 text-sm font-medium flex justify-center items-center gap-2 transition-colors ${activeTab === 'settings' ? 'text-indigo-600 border-b-2 border-indigo-600 bg-indigo-50/50' : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'}`}><Settings size={16} /> Settings</button>
          </div>

          <div className="flex-1 overflow-y-auto p-4 space-y-6">
            {activeTab === 'data' && (
              <>
                <div className="space-y-2">
                  <label className="block text-sm font-medium text-gray-700">Mode</label>
                  <select 
                    value={mode} 
                    onChange={(e) => setMode(e.target.value as Mode)}
                    className="w-full border border-gray-300 rounded-md p-2 text-sm focus:ring-indigo-500 focus:border-indigo-500"
                  >
                    <option value="custom">Custom Events (Independent)</option>
                    <option value="bag">Draw from Bag (Frequencies)</option>
                  </select>
                </div>

                {mode === 'bag' ? (
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <div className="flex justify-between items-center">
                        <label className="block text-sm font-medium text-gray-700">Items in Bag</label>
                        <button onClick={handleAddBagItem} className="text-indigo-600 hover:text-indigo-800 p-1"><Plus size={16} /></button>
                      </div>
                      {bagItems.map(item => (
                        <div key={item.id} className="flex items-center gap-2 bg-gray-50 p-2 rounded border border-gray-200">
                          <input 
                            type="text" value={item.label} 
                            onChange={e => handleUpdateBagItem(item.id, { label: e.target.value })}
                            className="flex-1 border border-gray-300 rounded px-2 py-1 text-sm" placeholder="Label"
                          />
                          <input 
                            type="number" value={item.count} min="0"
                            onChange={e => handleUpdateBagItem(item.id, { count: parseInt(e.target.value) || 0 })}
                            className="w-16 border border-gray-300 rounded px-2 py-1 text-sm" placeholder="Count"
                          />
                          <button onClick={() => handleRemoveBagItem(item.id)} className="text-gray-400 hover:text-red-500"><Trash2 size={16} /></button>
                        </div>
                      ))}
                    </div>

                    <div className="space-y-2">
                      <label className="block text-sm font-medium text-gray-700">Number of Draws</label>
                      <select 
                        value={numDraws} 
                        onChange={(e) => setNumDraws(parseInt(e.target.value))}
                        className="w-full border border-gray-300 rounded-md p-2 text-sm"
                      >
                        <option value={1}>1</option>
                        <option value={2}>2</option>
                        <option value={3}>3</option>
                      </select>
                    </div>

                    <div className="flex items-center gap-2">
                      <input 
                        type="checkbox" id="withReplacement"
                        checked={withReplacement}
                        onChange={(e) => setWithReplacement(e.target.checked)}
                        className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                      />
                      <label htmlFor="withReplacement" className="text-sm text-gray-700">With Replacement</label>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-6">
                    <div className="flex justify-between items-center">
                      <label className="block text-sm font-medium text-gray-700">Events</label>
                      <button onClick={handleAddCustomStep} className="text-indigo-600 hover:text-indigo-800 p-1 flex items-center gap-1 text-xs font-medium"><Plus size={14} /> Add Event</button>
                    </div>
                    
                    {customSteps.map((step, stepIdx) => (
                      <div key={step.id} className="bg-gray-50 p-3 rounded-lg border border-gray-200 space-y-3">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold text-gray-400 uppercase">Step {stepIdx + 1}</span>
                          <input 
                            type="text" value={step.name} 
                            onChange={e => handleUpdateCustomStep(step.id, e.target.value)}
                            className="flex-1 border border-gray-300 rounded px-2 py-1 text-sm font-medium" placeholder="Event Name"
                          />
                          <button onClick={() => handleRemoveCustomStep(step.id)} className="text-gray-400 hover:text-red-500"><Trash2 size={16} /></button>
                        </div>
                        
                        <div className="space-y-2 pl-2 border-l-2 border-indigo-100">
                          {step.outcomes.map(outcome => (
                            <div key={outcome.id} className="flex items-center gap-2">
                              <input 
                                type="text" value={outcome.label} 
                                onChange={e => handleUpdateCustomOutcome(step.id, outcome.id, { label: e.target.value })}
                                className="flex-1 border border-gray-300 rounded px-2 py-1 text-sm" placeholder="Outcome"
                              />
                              <div className="flex items-center gap-1">
                                <input 
                                  type="number" value={outcome.num} min="0"
                                  onChange={e => handleUpdateCustomOutcome(step.id, outcome.id, { num: parseInt(e.target.value) || 0 })}
                                  className="w-12 border border-gray-300 rounded px-1 py-1 text-sm text-center"
                                />
                                <span className="text-gray-400">/</span>
                                <input 
                                  type="number" value={outcome.den} min="1"
                                  onChange={e => handleUpdateCustomOutcome(step.id, outcome.id, { den: parseInt(e.target.value) || 1 })}
                                  className="w-12 border border-gray-300 rounded px-1 py-1 text-sm text-center"
                                />
                              </div>
                              <button onClick={() => handleRemoveCustomOutcome(step.id, outcome.id)} className="text-gray-400 hover:text-red-500"><Trash2 size={14} /></button>
                            </div>
                          ))}
                          <button onClick={() => handleAddCustomOutcome(step.id)} className="text-xs text-indigo-600 hover:text-indigo-800 flex items-center gap-1 mt-1">
                            <Plus size={12} /> Add Outcome
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}

            {activeTab === 'settings' && (
              <div className="space-y-4">
                <label className={`flex items-center gap-3 p-3 rounded border cursor-pointer transition-colors ${studentMode ? 'bg-indigo-50 border-indigo-300' : 'bg-white border-gray-200'}`}>
                  <div className={`w-5 h-5 rounded border flex items-center justify-center ${studentMode ? 'bg-indigo-600 border-indigo-600 text-white' : 'bg-white border-gray-300'}`}>
                    {studentMode && <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>}
                  </div>
                  <input 
                    type="checkbox" 
                    checked={studentMode} 
                    onChange={(e) => setStudentMode(e.target.checked)} 
                    className="hidden"
                  />
                  <div className="flex-1">
                    <span className="block text-xs font-bold text-gray-700 uppercase">Student Mode</span>
                    <span className="block text-xs text-gray-500 mt-0.5">Hide probabilities and outcomes</span>
                  </div>
                </label>

                <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
                  <input 
                    type="checkbox" 
                    checked={showProbabilities}
                    onChange={(e) => setShowProbabilities(e.target.checked)}
                    className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                  />
                  Show Probabilities on Branches
                </label>
                <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
                  <input 
                    type="checkbox" 
                    checked={showOutcomes}
                    onChange={(e) => setShowOutcomes(e.target.checked)}
                    className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                  />
                  Show Outcomes Column
                </label>
                <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
                  <input 
                    type="checkbox" 
                    checked={showCalculations}
                    onChange={(e) => setShowCalculations(e.target.checked)}
                    className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                  />
                  Show Calculations Column
                </label>

                <div className="space-y-2 mt-4 border-t pt-4 border-gray-100">
                  <label className="block text-sm font-medium text-gray-700">Font Size (pt)</label>
                  <input
                    type="number"
                    value={fontSize}
                    onChange={(e) => setFontSize(parseFloat(e.target.value) || 11)}
                    className="w-full border border-gray-300 rounded-md p-2 text-sm"
                  />
                </div>
              </div>
            )}
          </div>
        </aside>

        <main className="flex-1 bg-gray-100 overflow-auto flex items-center justify-center p-8">
          <div className="bg-white shadow-xl rounded-lg overflow-hidden border border-gray-200">
            <svg 
              id="tree-diagram-svg"
              ref={svgRef}
              width={width} 
              height={height} 
              viewBox={`0 0 ${width} ${height}`} 
              xmlns="http://www.w3.org/2000/svg"
              style={{ background: '#ffffff' }}
            >
              {/* Header Background */}
              <rect x="0" y="0" width={width} height="50" fill="#ffffff" />
              
              {/* Vertical Dividers */}
              {Array.from({ length: numSteps }).map((_, i) => (
                <line 
                  key={`div-${i}`}
                  x1={columnXs[i + 1]} y1="0" 
                  x2={columnXs[i + 1]} y2={height} 
                  stroke="#000000" strokeWidth="1" strokeDasharray="4,4" 
                />
              ))}
              {showOutcomes && (
                <line 
                  x1={columnXs[numSteps + 1]} y1="0" 
                  x2={columnXs[numSteps + 1]} y2={height} 
                  stroke="#000000" strokeWidth="1" strokeDasharray="4,4" 
                />
              )}
              {showCalculations && (
                <line 
                  x1={columnXs[numSteps + (showOutcomes ? 2 : 1)]} y1="0" 
                  x2={columnXs[numSteps + (showOutcomes ? 2 : 1)]} y2={height} 
                  stroke="#000000" strokeWidth="1" strokeDasharray="4,4" 
                />
              )}

              {/* Headers */}
              {mode === 'custom' ? (
                customSteps.map((step, i) => (
                  <text key={`head-${i}`} x={columnXs[i] + columnWidths[i]/2} y="30" textAnchor="middle" fontSize={ptToSvgUnits(fontSize)} fontWeight="bold" fill="#000000">
                    {step.name}
                  </text>
                ))
              ) : (
                Array.from({ length: numDraws }).map((_, i) => (
                  <text key={`head-${i}`} x={columnXs[i] + columnWidths[i]/2} y="30" textAnchor="middle" fontSize={ptToSvgUnits(fontSize)} fontWeight="bold" fill="#000000">
                    {bagStepNames[i] || `Draw ${i + 1}`}
                  </text>
                ))
              )}
              
              {showOutcomes && (
                <text x={columnXs[numSteps] + columnWidths[numSteps]/2} y="30" textAnchor="middle" fontSize={ptToSvgUnits(fontSize)} fontWeight="bold" fill="#000000">
                  Outcomes:
                </text>
              )}
              {showCalculations && (
                <text x={columnXs[numSteps + (showOutcomes ? 1 : 0)] + columnWidths[numSteps + (showOutcomes ? 1 : 0)]/2} y="30" textAnchor="middle" fontSize={ptToSvgUnits(fontSize)} fontWeight="bold" fill="#000000">
                  Probabilities:
                </text>
              )}

              {/* Tree Content */}
              <g transform="translate(0, 50)">
                {renderTreeNodes(tree, 0, 0, height - 50, 50, (height - 50) / 2)}
              </g>
            </svg>
          </div>
        </main>
      </div>
    </div>
  );
}
