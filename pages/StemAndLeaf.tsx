
import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { GraphToolbar } from '../components/GraphToolbar';
import { useGraphInteraction } from '../hooks/useGraphInteraction';
import { useDragSystem } from '../hooks/useDragSystem';
import { Settings, List, Palette, GitMerge, Move, LayoutTemplate, Scan, Maximize, ArrowDownAZ, Sigma, CircleDot } from 'lucide-react';
import { RichInput } from '../components/ui/RichInput';
import { CM_TO_PX } from '../constants';
import { TexEngine } from '../utils/textRenderer';
import { generateGraphImage } from '../utils/imageExport';

// --- Types & Constants ---

interface StemRow {
  stemLabel: string;
  stemValue: number;
  leavesLeft: number[];  // Original numbers
  leavesRight: number[]; // Original numbers
}

interface QuartileInfo {
    value: number;
    index: number; 
    type: 'exact' | 'split';
}

interface DatasetStats {
    median: QuartileInfo;
    q1: QuartileInfo;
    q3: QuartileInfo;
}

// --- Logic Helpers ---

const parseData = (raw: string): number[] => {
  return raw.split(/[\s,]+/)
    .map(s => parseFloat(s))
    .filter(n => isFinite(n));
};

const getLeafUnit = (nums: number[]): number => {
    let minPower = 0;
    for (const n of nums) {
        if (Math.abs(n) < 1e-9) continue;
        const s = n.toString();
        if (s.includes('.')) {
            const decimals = s.split('.')[1].length;
            minPower = Math.min(minPower, -decimals);
        }
    }
    return Math.pow(10, minPower);
};

const getMedian = (arr: number[], offset: number): QuartileInfo => {
    const n = arr.length;
    if (n === 0) return { value: 0, index: 0, type: 'exact' };
    
    if (n % 2 === 1) {
        const idx = (n - 1) / 2;
        return { value: arr[idx], index: offset + idx, type: 'exact' };
    } else {
        const idx1 = n / 2 - 1;
        const idx2 = n / 2;
        const val = (arr[idx1] + arr[idx2]) / 2;
        return { value: val, index: offset + idx1 + 0.5, type: 'split' };
    }
};

const calculateQuartiles = (sorted: number[]): DatasetStats | null => {
    const n = sorted.length;
    if (n < 2) return null;
    
    const median = getMedian(sorted, 0);
    
    let lowerHalf: number[] = [];
    let upperHalf: number[] = [];
    let upperOffset = 0;

    if (n % 2 === 1) {
        const midIdx = (n - 1) / 2;
        lowerHalf = sorted.slice(0, midIdx);
        upperHalf = sorted.slice(midIdx + 1);
        upperOffset = midIdx + 1;
    } else {
        const midIdx = n / 2;
        lowerHalf = sorted.slice(0, midIdx);
        upperHalf = sorted.slice(midIdx);
        upperOffset = midIdx;
    }

    const q1 = getMedian(lowerHalf, 0);
    const q3 = getMedian(upperHalf, upperOffset);

    return { median, q1, q3 };
};

const processStemData = (
    dataLeft: number[], 
    dataRight: number[], 
    splitFactor: number, // 1, 2, or 5
    autoSort: boolean
): { rows: StemRow[], leafUnit: number } => {
    const all = [...dataLeft, ...dataRight];
    if (all.length === 0) return { rows: [], leafUnit: 1 };

    const leafUnit = getLeafUnit(all);
    const stemUnit = leafUnit * 10;

    // Helper to get stem index
    const getStemIndex = (val: number) => {
        // Javascript float issues require rounding
        const rawStem = Math.floor((val + 1e-9) / stemUnit);
        const leafDigit = Math.floor((val / leafUnit) + 1e-9) % 10;
        
        if (splitFactor === 1) return rawStem;
        
        if (splitFactor === 2) {
            return (rawStem * 2) + (leafDigit < 5 ? 0 : 1);
        }
        
        if (splitFactor === 5) {
            return (rawStem * 5) + Math.floor(leafDigit / 2);
        }
        
        return rawStem;
    };

    const minVal = Math.min(...all);
    const maxVal = Math.max(...all);
    
    const startStemIdx = getStemIndex(minVal);
    const endStemIdx = getStemIndex(maxVal);

    const rows: StemRow[] = [];

    for (let i = startStemIdx; i <= endStemIdx; i++) {
        let label = "";
        
        if (splitFactor === 1) {
            label = i.toString();
        } else {
            const baseStem = Math.floor(i / splitFactor);
            label = baseStem.toString();
        }

        rows.push({
            stemLabel: label,
            stemValue: i, 
            leavesLeft: [],
            leavesRight: []
        });
    }

    const addToRow = (val: number, isLeft: boolean) => {
        const idx = getStemIndex(val);
        const row = rows.find(r => r.stemValue === idx);
        if (row) {
            if (isLeft) row.leavesLeft.push(val);
            else row.leavesRight.push(val);
        }
    };

    dataLeft.forEach(v => addToRow(v, true));
    dataRight.forEach(v => addToRow(v, false));

    if (autoSort) {
        rows.forEach(r => {
            r.leavesRight.sort((a, b) => a - b);
            // Left: visually ascending away from stem means indices 0,1,2.. are smallest to largest values?
            // Standard: 12, 15 -> Stem 1 | 2 5.
            // On Left: 5 2 | 1. 2 is closest to stem. 5 is furthest.
            // So index 0 (closest) should be smallest value (12).
            // Index 1 (furthest) should be largest value (15).
            r.leavesLeft.sort((a, b) => a - b); 
        });
    }

    return { rows, leafUnit };
};

const formatLeaf = (val: number, leafUnit: number): string => {
    const digit = Math.floor((val / leafUnit) + 1e-9) % 10;
    return digit.toString();
};

const StemAndLeaf: React.FC = () => {
  // --- State ---
  const [data1, setData1] = useState("33, 33, 33, 33, 39, 42, 40, 40, 40, 40, 48, 53, 53, 53, 51, 51, 51, 51, 59, 59, 68, 64");
  const [data2, setData2] = useState("15, 17, 19, 19, 20, 20, 22, 22, 24, 24, 24, 26, 28, 28, 28, 28, 30, 30, 30, 31, 33, 35, 35, 39, 43, 46, 48, 54, 59, 70");
  
  const [config, setConfig] = useState({
      title: "wind speed (km/h)", // Updated to plain text
      labelLeft: "April 2021",
      labelRight: "November 2021",
      colorLeft: "black",
      colorRight: "black",
      stemColor: "black",
      lineColor: "black",
      showKey: true,
      showCounts: true,
      showQuartiles: false, 
      quartileColorExact: '#FF0000', // Pure Red
      quartileColorSplit: '#0000FF', // Pure Blue
      quartileOffsetX: 0,
      quartileOffsetY: 0,
      splitFactor: 1, 
      autoSort: true, 
      highlightMedian: false, 
      fontSize: 11,
      columnWidth: 15,
      stemWidth: 25,
      rowHeight: 18,
      horizontalPadding: 40
  });

  const [activeTab, setActiveTab] = useState<'data' | 'style'>('data');
  const [dimCm, setDimCm] = useState({ width: 16, height: 7 }); 
  const [isCopied, setIsCopied] = useState(false);
  const [showDebug, setShowDebug] = useState(false);

  // --- Graph Engine Mockup ---
  const widthPixels = Math.round(dimCm.width * CM_TO_PX);
  const heightPixels = Math.round(dimCm.height * CM_TO_PX);
  const centerX = widthPixels / 2;
  const [keyPos, setKeyPos] = useState({ x: 40, y: 20 });

  const {
      previewScale, setPreviewScale,
      cropMode, setCropMode,
      selectionBox, customViewBox, hasInitialCrop,
      containerRef,
      handleAutoCrop, handleResetView, handleExportPNG, handleExportSVG,
      handleCropMouseDown, handleCropMouseMove, handleCropMouseUp
  } = useGraphInteraction('stem-svg', widthPixels, heightPixels, dimCm.width, true);

  const { onMouseDown, onMouseMove, onMouseUp } = useDragSystem(previewScale);

  const handleKeyDragStart = (e: React.MouseEvent) => {
      if (cropMode) return;
      onMouseDown(e, { ...keyPos }, (dx, dy, init) => {
          setKeyPos({ x: init.x + dx, y: init.y + dy });
      });
  };

  const handleQuartileDragStart = (e: React.MouseEvent) => {
      if (cropMode) return;
      onMouseDown(e, { x: config.quartileOffsetX, y: config.quartileOffsetY }, (dx, dy, init) => {
          setConfig(prev => ({
              ...prev,
              quartileOffsetX: init.x + dx,
              quartileOffsetY: init.y + dy
          }));
      }, undefined, 'quartile-drag');
  };

  const handleGlobalMouseMove = (e: React.MouseEvent) => {
      if (handleCropMouseMove(e)) return;
      onMouseMove(e);
  };

  const handleGlobalMouseUp = () => {
      handleCropMouseUp();
      onMouseUp();
  };

  const handleCopy = async () => {
      const blob = await generateGraphImage('stem-svg', widthPixels, heightPixels, dimCm.width, true);
      if (blob) {
          try {
              const item = new ClipboardItem({ [blob.type]: blob });
              await navigator.clipboard.write([item]);
              setIsCopied(true);
              setTimeout(() => setIsCopied(false), 2000);
          } catch (e) {
              alert("Copy failed.");
          }
      }
  };

  // --- Process Data ---
  const leftNums = useMemo(() => parseData(data1), [data1]);
  const rightNums = useMemo(() => parseData(data2), [data2]);
  
  const { rows, leafUnit } = useMemo(() => 
      processStemData(leftNums, rightNums, config.splitFactor, config.autoSort), 
  [leftNums, rightNums, config.splitFactor, config.autoSort]);

  // Calculate Stats
  const leftStats = useMemo(() => calculateQuartiles([...leftNums].sort((a, b) => a - b)), [leftNums]);
  const rightStats = useMemo(() => calculateQuartiles([...rightNums].sort((a, b) => a - b)), [rightNums]);

  const maxLeftLeaves = Math.max(0, ...rows.map(r => r.leavesLeft.length));
  const maxRightLeaves = Math.max(0, ...rows.map(r => r.leavesRight.length));
  
  // --- Render Helpers ---
  const tex = useMemo(() => new TexEngine(), []);
  
  const titleY = 20;
  const labelY = 45;
  const centerY = 70;

  const generateKeyText = () => {
      const exampleRow = rows.find(r => r.leavesRight.length > 0 || r.leavesLeft.length > 0) || rows[0];
      if (!exampleRow) return "";
      
      const stem = exampleRow.stemLabel;
      let leaf = "0";
      let val = 0;

      if (exampleRow.leavesRight.length > 0) {
          val = exampleRow.leavesRight[0];
          leaf = formatLeaf(val, leafUnit);
      } else if (exampleRow.leavesLeft.length > 0) {
          val = exampleRow.leavesLeft[0];
          leaf = formatLeaf(val, leafUnit);
      } else {
          val = parseFloat(stem) * (leafUnit * 10);
      }
      
      let displayVal = val.toString();
      if (leafUnit < 1 && leafUnit > 0.001) {
          displayVal = parseFloat(val.toFixed(3)).toString();
      }

      return `Key: ${stem} | ${leaf} = ${displayVal}`;
  };

  const contentBounds = useMemo(() => {
      const titleMetric = tex.measure(config.title, config.fontSize);
      let leftText = config.labelLeft;
      if (config.showCounts) leftText += `   n = ${leftNums.length}`;
      const leftMetric = tex.measure(leftText, config.fontSize);
      let rightText = config.labelRight;
      if (config.showCounts) rightText += `   n = ${rightNums.length}`;
      const rightMetric = tex.measure(rightText, config.fontSize);

      const stemHalf = config.stemWidth / 2;
      const leftLeavesW = maxLeftLeaves * config.columnWidth;
      const rightLeavesW = maxRightLeaves * config.columnWidth;

      const leftCenterOffset = stemHalf + (leftLeavesW / 2) + 20;
      const leftLabelPosOffset = Math.max(80, leftCenterOffset);
      const leftLabelExtent = leftLabelPosOffset + (leftMetric.width / 2);
      const leftLeavesExtent = stemHalf + 10 + leftLeavesW;
      const maxLeftExtent = Math.max(leftLabelExtent, leftLeavesExtent, titleMetric.width/2) + 40;

      const rightCenterOffset = stemHalf + (rightLeavesW / 2) + 20;
      const rightLabelPosOffset = Math.max(80, rightCenterOffset);
      const rightLabelExtent = rightLabelPosOffset + (rightMetric.width / 2);
      const rightLeavesExtent = stemHalf + 10 + rightLeavesW;
      const maxRightExtent = Math.max(rightLabelExtent, rightLeavesExtent, titleMetric.width/2) + 40;

      const totalW = maxLeftExtent + maxRightExtent;
      const maxY = 70 + (rows.length * config.rowHeight) + 30;

      return { x: centerX - maxLeftExtent, y: 0, w: totalW, h: maxY };
  }, [centerX, rows.length, maxLeftLeaves, maxRightLeaves, config, leftNums.length, rightNums.length, tex]);

  const handleFitCanvas = useCallback(() => {
      const newW = contentBounds.w / CM_TO_PX;
      const newH = contentBounds.h / CM_TO_PX;
      setDimCm({ width: parseFloat(newW.toFixed(1)), height: parseFloat(newH.toFixed(1)) });
  }, [contentBounds]);

  useEffect(() => {
      const timer = setTimeout(() => { if (rows.length > 0) handleFitCanvas(); }, 50);
      return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
      const timer = setTimeout(() => { if (rows.length > 0) handleFitCanvas(); }, 500);
      return () => clearTimeout(timer);
  }, [data1, data2, config.splitFactor, config.columnWidth, config.fontSize, config.stemWidth, config.showCounts, config.labelLeft, config.labelRight, config.title, rows.length]);

  const renderPlotContent = () => {
    const els: React.ReactNode[] = [];
    const fs = config.fontSize;
    const monoWidth = config.columnWidth; 
    
    // 1. Titles
    if (config.title) els.push(...tex.renderToSVG(config.title, centerX, titleY, fs, 'black', 'middle', false, 'text'));
    
    if (config.labelLeft || config.showCounts) {
        let txt = config.labelLeft;
        if (config.showCounts) txt += `   n = ${leftNums.length}`;
        const leftCenter = centerX - (config.stemWidth/2) - (maxLeftLeaves * monoWidth) / 2 - 20;
        els.push(...tex.renderToSVG(txt, Math.min(centerX - 80, leftCenter), labelY, fs, config.colorLeft, 'middle', false, 'text'));
    }

    if (config.labelRight || config.showCounts) {
        let txt = config.labelRight;
        if (config.showCounts) txt += `   n = ${rightNums.length}`;
        const rightCenter = centerX + (config.stemWidth/2) + (maxRightLeaves * monoWidth) / 2 + 20;
        els.push(...tex.renderToSVG(txt, Math.max(centerX + 80, rightCenter), labelY, fs, config.colorRight, 'middle', false, 'text'));
    }

    // 2. Vertical Lines
    const stemLeftX = centerX - config.stemWidth / 2;
    const stemRightX = centerX + config.stemWidth / 2;
    const gridTop = centerY - 12;
    const lastRowY = centerY + (rows.length - 1) * config.rowHeight;
    const gridBottom = lastRowY + (config.fontSize * 0.6); 

    els.push(<line key="vl1" x1={stemLeftX} y1={gridTop} x2={stemLeftX} y2={gridBottom} stroke={config.lineColor} strokeWidth={1.5} />);
    els.push(<line key="vl2" x1={stemRightX} y1={gridTop} x2={stemRightX} y2={gridBottom} stroke={config.lineColor} strokeWidth={1.5} />);

    // Map global indices to coordinates for Quartile Rendering
    // Store: index -> { x, y, rowIdx }
    const leftMap: { x: number, y: number, r: number }[] = [];
    const rightMap: { x: number, y: number, r: number }[] = [];

    // 3. Rows
    rows.forEach((row, rIdx) => {
        const y = centerY + rIdx * config.rowHeight;
        els.push(...tex.renderToSVG(row.stemLabel, centerX, y, fs, config.stemColor, 'middle', false, 'text'));

        // Left Leaves (Sorted Ascending, but drawn Right to Left)
        // Global Array is sorted 12, 15.
        // Row leavesLeft: [12, 15].
        // Draw: 12 is at index 0 (closest to stem). 15 is index 1 (further).
        row.leavesLeft.forEach((val, i) => {
            const txt = formatLeaf(val, leafUnit);
            const x = stemLeftX - 10 - (i * monoWidth);
            leftMap.push({ x, y, r: rIdx });
            els.push(
                <text key={`l-${rIdx}-${i}`} x={x} y={y} fontSize={fs} fill={config.colorLeft} fontFamily="Times New Roman" textAnchor="middle">{txt}</text>
            );
        });

        // Right Leaves (Sorted Ascending, drawn Left to Right)
        row.leavesRight.forEach((val, i) => {
            const txt = formatLeaf(val, leafUnit);
            const x = stemRightX + 10 + (i * monoWidth);
            rightMap.push({ x, y, r: rIdx });
            els.push(
                <text key={`r-${rIdx}-${i}`} x={x} y={y} fontSize={fs} fill={config.colorRight} fontFamily="Times New Roman" textAnchor="middle">{txt}</text>
            );
        });
    });

    // 4. Quartiles Overlay
    if (config.showQuartiles) {
        const drawQuartile = (q: QuartileInfo, map: {x:number,y:number,r:number}[], side: 'left' | 'right') => {
            // Apply Manual Offsets
            const offX = config.quartileOffsetX;
            const offY = config.quartileOffsetY;

            if (q.type === 'exact') {
                const pt = map[q.index];
                if (pt) {
                    els.push(
                        <circle key={`q-${side}-${q.index}`} cx={pt.x + offX} cy={pt.y - fs*0.25 + offY} r={fs*0.7} fill="none" stroke={config.quartileColorExact} strokeWidth={2} />
                    );
                }
            } else {
                // Split
                const idx1 = Math.floor(q.index);
                const idx2 = Math.ceil(q.index);
                const p1 = map[idx1];
                const p2 = map[idx2];
                if (p1 && p2) {
                    if (p1.r === p2.r) {
                        // Same Row: Vertical Line
                        const mx = (p1.x + p2.x) / 2 + offX;
                        const baseY = p1.y + offY;
                        els.push(
                            <line key={`q-${side}-split`} x1={mx} y1={baseY - fs} x2={mx} y2={baseY + fs*0.2} stroke={config.quartileColorSplit} strokeWidth={2} />
                        );
                    } else {
                        // Different Row: Underline both
                        const w = fs * 0.6;
                        // For different rows, apply offset to both
                        els.push(<line key={`q-${side}-s1`} x1={p1.x-w + offX} y1={p1.y+2 + offY} x2={p1.x+w + offX} y2={p1.y+2 + offY} stroke={config.quartileColorSplit} strokeWidth={2} />);
                        els.push(<line key={`q-${side}-s2`} x1={p2.x-w + offX} y1={p2.y+2 + offY} x2={p2.x+w + offX} y2={p2.y+2 + offY} stroke={config.quartileColorSplit} strokeWidth={2} />);
                    }
                }
            }
        };

        // Wrap in draggable group
        // Add a transparent rect to cover the potential area for easier grabbing if needed, 
        // but here we rely on hitting the lines/circles themselves for drag if pointer-events work,
        // OR we just assume dragging anywhere on this layer works if we wrap it?
        // Actually, to make "All Linked" drag work easily, we might want a handle or just allow dragging any visible quartile element.
        
        els.push(
            <g key="quartiles-layer" onMouseDown={handleQuartileDragStart} style={{ cursor: cropMode ? 'crosshair' : 'move' }}>
               {leftStats && (
                   <>
                       {drawQuartile(leftStats.q1, leftMap, 'left')}
                       {drawQuartile(leftStats.median, leftMap, 'left')}
                       {drawQuartile(leftStats.q3, leftMap, 'left')}
                   </>
               )}
               {rightStats && (
                   <>
                       {drawQuartile(rightStats.q1, rightMap, 'right')}
                       {drawQuartile(rightStats.median, rightMap, 'right')}
                       {drawQuartile(rightStats.q3, rightMap, 'right')}
                   </>
               )}
               {/* Invisible Hit Rect for easier dragging of the "layer" area if sparsely populated? 
                   Optional, but might clutter interaction. Let's rely on hitting the colored elements. 
                   To make it easier, we add a transparent stroke to elements?
               */}
            </g>
        );
    }

    return els;
  };

  return (
    <div className="flex h-full flex-col bg-gray-50" onMouseMove={handleGlobalMouseMove} onMouseUp={handleGlobalMouseUp}>
      <header className="flex items-center justify-between px-6 py-3 bg-white border-b border-gray-200 shadow-sm z-10">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-indigo-50 text-indigo-600 rounded-lg"><GitMerge className="w-5 h-5 rotate-90" /></div>
          <h1 className="text-xl font-semibold text-gray-800">Stem & Leaf Plotter</h1>
        </div>
        <GraphToolbar 
            previewScale={previewScale} setPreviewScale={setPreviewScale}
            cropMode={cropMode} setCropMode={setCropMode}
            onResetView={handleResetView} onAutoCrop={handleAutoCrop}
            onExportPNG={handleExportPNG} onExportSVG={handleExportSVG}
            onCopy={handleCopy} isCopied={isCopied}
        />
      </header>

      <div className="flex flex-1 overflow-hidden">
        <aside className="w-80 bg-white border-r border-gray-200 flex flex-col h-full z-20">
            <div className="flex border-b border-gray-200 bg-white">
                <button onClick={() => setActiveTab('data')} className={`flex-1 py-3 text-sm font-medium flex justify-center items-center gap-2 ${activeTab === 'data' ? 'text-indigo-600 border-b-2 border-indigo-600 bg-indigo-50/50' : 'text-gray-500'}`}><List size={16} /> Data</button>
                <button onClick={() => setActiveTab('style')} className={`flex-1 py-3 text-sm font-medium flex justify-center items-center gap-2 ${activeTab === 'style' ? 'text-indigo-600 border-b-2 border-indigo-600 bg-indigo-50/50' : 'text-gray-500'}`}><Palette size={16} /> Style</button>
            </div>

            <div className="flex-1 overflow-y-auto custom-scrollbar p-4 space-y-6">
                {activeTab === 'data' && (
                    <>
                        <div className="space-y-3">
                            <div>
                                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Left Dataset</label>
                                <textarea 
                                    value={data1}
                                    onChange={(e) => setData1(e.target.value)}
                                    className="w-full h-24 border border-gray-300 rounded p-2 text-xs font-mono"
                                    placeholder="e.g. 12, 15, 22..."
                                />
                                <div className="mt-1 flex gap-2">
                                    <input 
                                        type="text" placeholder="Label" value={config.labelLeft}
                                        onChange={(e) => setConfig({...config, labelLeft: e.target.value})}
                                        className="flex-1 border rounded px-2 py-1 text-xs"
                                    />
                                    <input type="color" value={config.colorLeft} onChange={(e) => setConfig({...config, colorLeft: e.target.value})} className="w-6 h-6 border rounded cursor-pointer" />
                                </div>
                            </div>
                            
                            <div>
                                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Right Dataset</label>
                                <textarea 
                                    value={data2}
                                    onChange={(e) => setData2(e.target.value)}
                                    className="w-full h-24 border border-gray-300 rounded p-2 text-xs font-mono"
                                    placeholder="e.g. 12, 15, 22..."
                                />
                                <div className="mt-1 flex gap-2">
                                    <input 
                                        type="text" placeholder="Label" value={config.labelRight}
                                        onChange={(e) => setConfig({...config, labelRight: e.target.value})}
                                        className="flex-1 border rounded px-2 py-1 text-xs"
                                    />
                                    <input type="color" value={config.colorRight} onChange={(e) => setConfig({...config, colorRight: e.target.value})} className="w-6 h-6 border rounded cursor-pointer" />
                                </div>
                            </div>
                        </div>

                        <div className="pt-4 border-t border-gray-100 space-y-3">
                            <h3 className="text-xs font-bold text-gray-500 uppercase">Configuration</h3>
                            
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs text-gray-500 mb-1">Split Stems</label>
                                    <select 
                                        value={config.splitFactor}
                                        onChange={(e) => setConfig({...config, splitFactor: parseInt(e.target.value)})}
                                        className="w-full border border-gray-300 rounded p-1 text-xs"
                                    >
                                        <option value={1}>None (0-9)</option>
                                        <option value={2}>Halves (0-4, 5-9)</option>
                                        <option value={5}>Fifths (0-1, 2-3...)</option>
                                    </select>
                                </div>
                            </div>

                            <div className="flex flex-col gap-2 pt-2">
                                <label className="flex items-center gap-2 text-xs text-gray-600 cursor-pointer">
                                    <input type="checkbox" checked={config.autoSort} onChange={(e) => setConfig({...config, autoSort: e.target.checked})} className="rounded text-indigo-600"/>
                                    <ArrowDownAZ size={14} className="text-gray-400"/> Auto-Sort Leaves
                                </label>
                                <label className="flex items-center gap-2 text-xs text-gray-600 cursor-pointer">
                                    <input type="checkbox" checked={config.showQuartiles} onChange={(e) => setConfig({...config, showQuartiles: e.target.checked})} className="rounded text-indigo-600"/>
                                    <CircleDot size={14} className="text-gray-400"/> Show Visual Quartiles
                                </label>
                                <div className="flex gap-4 mt-2">
                                    <label className="flex items-center gap-2 text-xs text-gray-600 cursor-pointer">
                                        <input type="checkbox" checked={config.showKey} onChange={(e) => setConfig({...config, showKey: e.target.checked})} className="rounded text-indigo-600"/>
                                        Show Key
                                    </label>
                                    <label className="flex items-center gap-2 text-xs text-gray-600 cursor-pointer">
                                        <input type="checkbox" checked={config.showCounts} onChange={(e) => setConfig({...config, showCounts: e.target.checked})} className="rounded text-indigo-600"/>
                                        Show Counts
                                    </label>
                                </div>
                            </div>
                        </div>
                    </>
                )}

                {activeTab === 'style' && (
                    <div className="space-y-4">
                        <div>
                            <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Main Title</label>
                            <RichInput 
                                value={config.title}
                                onChange={(e) => setConfig({...config, title: e.target.value})}
                                className="w-full border rounded px-2 py-1 text-sm"
                            />
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                            <div>
                                <label className="block text-xs text-gray-500 mb-1">Font Size</label>
                                <input type="number" value={config.fontSize} onChange={(e) => setConfig({...config, fontSize: parseFloat(e.target.value)})} className="w-full border rounded p-1 text-xs" />
                            </div>
                            <div>
                                <label className="block text-xs text-gray-500 mb-1">Row Height</label>
                                <input type="number" value={config.rowHeight} onChange={(e) => setConfig({...config, rowHeight: parseFloat(e.target.value)})} className="w-full border rounded p-1 text-xs" />
                            </div>
                            <div>
                                <label className="block text-xs text-gray-500 mb-1">Stem Col Width</label>
                                <input type="number" value={config.stemWidth} onChange={(e) => setConfig({...config, stemWidth: parseFloat(e.target.value)})} className="w-full border rounded p-1 text-xs" />
                            </div>
                            <div>
                                <label className="block text-xs text-gray-500 mb-1">Leaf Spacing</label>
                                <input type="number" value={config.columnWidth} onChange={(e) => setConfig({...config, columnWidth: parseFloat(e.target.value)})} className="w-full border rounded p-1 text-xs" />
                            </div>
                        </div>

                        {config.showQuartiles && (
                            <div className="pt-4 border-t border-gray-100 space-y-3">
                                <h3 className="text-xs font-bold text-gray-500 uppercase flex items-center gap-2">
                                    <CircleDot size={12}/> Quartile Styling
                                </h3>
                                <div className="grid grid-cols-2 gap-3">
                                    <div>
                                        <label className="block text-xs text-gray-500 mb-1">Exact Color</label>
                                        <input type="color" value={config.quartileColorExact} onChange={(e) => setConfig({...config, quartileColorExact: e.target.value})} className="w-full h-6 border rounded cursor-pointer" />
                                    </div>
                                    <div>
                                        <label className="block text-xs text-gray-500 mb-1">Split Color</label>
                                        <input type="color" value={config.quartileColorSplit} onChange={(e) => setConfig({...config, quartileColorSplit: e.target.value})} className="w-full h-6 border rounded cursor-pointer" />
                                    </div>
                                </div>
                                <div className="grid grid-cols-2 gap-3">
                                    <div>
                                        <label className="block text-xs text-gray-500 mb-1">Offset X</label>
                                        <input type="number" value={config.quartileOffsetX} onChange={(e) => setConfig({...config, quartileOffsetX: parseFloat(e.target.value) || 0})} className="w-full border rounded p-1 text-xs" />
                                    </div>
                                    <div>
                                        <label className="block text-xs text-gray-500 mb-1">Offset Y</label>
                                        <input type="number" value={config.quartileOffsetY} onChange={(e) => setConfig({...config, quartileOffsetY: parseFloat(e.target.value) || 0})} className="w-full border rounded p-1 text-xs" />
                                    </div>
                                </div>
                                <p className="text-[10px] text-gray-400 italic">Drag quartiles on graph to move all</p>
                            </div>
                        )}

                        <div className="pt-4 border-t border-gray-100 space-y-3">
                            <label className="block text-xs font-bold text-gray-500 uppercase flex items-center gap-2">
                                <LayoutTemplate size={12}/> Key Position Preset
                            </label>
                            <div className="grid grid-cols-2 gap-2">
                                <button onClick={() => setKeyPos({x: 40, y: 20})} className="px-2 py-1 text-xs border rounded hover:bg-gray-50 text-gray-600">Top Left</button>
                                <button onClick={() => setKeyPos({x: widthPixels - 200, y: 20})} className="px-2 py-1 text-xs border rounded hover:bg-gray-50 text-gray-600">Top Right</button>
                                <button onClick={() => setKeyPos({x: 40, y: heightPixels - 20})} className="px-2 py-1 text-xs border rounded hover:bg-gray-50 text-gray-600">Bottom Left</button>
                                <button onClick={() => setKeyPos({x: widthPixels - 200, y: heightPixels - 20})} className="px-2 py-1 text-xs border rounded hover:bg-gray-50 text-gray-600">Bottom Right</button>
                            </div>
                        </div>

                         <div className="pt-4 border-t border-gray-100">
                            <label className="block text-xs font-bold text-gray-500 uppercase mb-2">Image Dimensions (cm)</label>
                            <div className="grid grid-cols-2 gap-3 mb-3">
                                <input type="number" value={dimCm.width} onChange={(e) => setDimCm({...dimCm, width: parseFloat(e.target.value)})} className="border rounded p-1 text-xs" placeholder="W" />
                                <input type="number" value={dimCm.height} onChange={(e) => setDimCm({...dimCm, height: parseFloat(e.target.value)})} className="border rounded p-1 text-xs" placeholder="H" />
                            </div>
                            
                            <div className="space-y-2">
                                <button 
                                    onClick={handleFitCanvas}
                                    className="w-full py-1.5 flex items-center justify-center gap-2 bg-indigo-50 text-indigo-700 border border-indigo-100 rounded text-xs font-medium hover:bg-indigo-100 transition-colors"
                                >
                                    <Maximize size={12} /> Fit Canvas to Content
                                </button>
                                
                                <label className="flex items-center gap-2 text-xs text-gray-500 cursor-pointer">
                                    <input 
                                        type="checkbox" 
                                        checked={showDebug} 
                                        onChange={(e) => setShowDebug(e.target.checked)} 
                                        className="rounded border-gray-300"
                                    />
                                    <Scan size={12} /> Show Debug Bounds
                                </label>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </aside>

        <main className="flex-1 bg-gray-100 overflow-hidden flex flex-col">
          <div ref={containerRef} className="flex-1 overflow-auto flex items-center justify-center p-8 bg-neutral-100 cursor-crosshair">
            <div 
                className={`bg-white shadow-2xl transition-all duration-200 ease-in-out relative ${cropMode ? 'cursor-crosshair' : 'cursor-default'}`}
                style={{ 
                   transform: `scale(${previewScale})`, 
                   transformOrigin: 'top center',
                   opacity: hasInitialCrop ? 1 : 0
                }}
                onMouseDown={handleCropMouseDown}
            >
              <svg 
                  id="stem-svg" 
                  width={widthPixels} 
                  height={heightPixels} 
                  viewBox={customViewBox || `0 0 ${widthPixels} ${heightPixels}`} 
                  xmlns="http://www.w3.org/2000/svg" 
                  style={{ display: 'block', fontFamily: 'Times New Roman' }}
              >
                <rect x="0" y="0" width={widthPixels} height={heightPixels} fill="white" />
                
                {/* Wrap main content in data-layer class for Autocrop detection */}
                <g className="data-layer">
                    {renderPlotContent()}
                </g>

                {/* Key (Draggable) */}
                {config.showKey && (
                    <g 
                        onMouseDown={handleKeyDragStart}
                        style={{ cursor: cropMode ? 'crosshair' : 'move' }}
                    >
                        {/* Invisible hit box for easier dragging - NOT measured by auto-crop */}
                        <rect x={keyPos.x - 5} y={keyPos.y - 20} width={200} height={30} fill="transparent" />
                        
                        {/* Visible Content - Measured by auto-crop */}
                        <g className="features-layer">
                            {tex.renderToSVG(generateKeyText(), keyPos.x, keyPos.y, config.fontSize, 'black', 'start', false, 'text')}
                        </g>
                    </g>
                )}

                {/* Debug Bounds */}
                {showDebug && (
                    <rect 
                        x={contentBounds.x} y={contentBounds.y} 
                        width={contentBounds.w} height={contentBounds.h} 
                        fill="none" stroke="red" strokeWidth="1" strokeDasharray="4,4"
                        pointerEvents="none"
                    />
                )}

                {/* Crop Overlay */}
                {cropMode && selectionBox && (
                    <rect 
                        x={selectionBox.x} y={selectionBox.y} 
                        width={selectionBox.w} height={selectionBox.h}
                        fill="rgba(59, 130, 246, 0.2)"
                        stroke="#2563eb"
                        strokeWidth={2 / previewScale} 
                        strokeDasharray={`${5/previewScale},${5/previewScale}`}
                        pointerEvents="none"
                    />
                )}
              </svg>
            </div>
          </div>
           {cropMode && (
              <div className="absolute top-4 left-1/2 -translate-x-1/2 bg-blue-600 text-white px-4 py-2 rounded-full shadow-lg text-sm font-bold animate-pulse pointer-events-none">
                  Drag to Crop Graph
              </div>
          )}
        </main>
      </div>
    </div>
  );
};

export default StemAndLeaf;
