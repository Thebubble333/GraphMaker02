
import React, { useState, useMemo, useEffect } from 'react';
import { GraphToolbar } from '../components/GraphToolbar';
import { useGraphInteraction } from '../hooks/useGraphInteraction';
import { TexEngine } from '../utils/textRenderer';
import { Trash2, Plus, GripVertical, Square, Table as TableIcon, LayoutGrid, Type, Maximize, Palette, MousePointer2, RotateCcw, ArrowLeftRight, Move, RefreshCw } from 'lucide-react';
import { generateGraphImage } from '../utils/imageExport';
import { CM_TO_PX } from '../constants';
import { BOX_DEFAULTS } from '../config/boxDefaults';
import { BoxStyleOptions } from '../utils/mathLayout';
import { getAutoCropBox } from '../utils/graphCropper';

// --- TYPES ---

type BlockType = 'equation'; // Unified type for simplicity, though we keep interface names for clarity

interface BoxSettings extends BoxStyleOptions {
    // Extends BoxStyleOptions: widthScale, heightScale, thickness, paddingLeft, paddingRight, shiftX, shiftY
}

interface BaseBlock {
    id: string;
    type: BlockType;
    boxSettings?: BoxSettings; // Block-level settings
}

interface EquationBlock extends BaseBlock {
    type: 'equation';
    latex: string;
    // Map internal box index (0, 1, 2...) to specific settings
    boxOverrides?: Record<number, BoxSettings>; 
}

type Block = EquationBlock;

interface SelectionState {
    blockId: string | null;
    cellIds: string[]; // For Equation box indices (as strings)
}

// State for a detected Matrix/Table within an equation
interface DetectedMatrix {
    index: number; // The occurrence index (0 for 1st matrix, 1 for 2nd...)
    type: 'matrix' | 'table';
    rows: number;
    cols: number;
    data: string[]; // Flat array of cell contents
    startIndex: number; // Position in string (for highlighting/verification)
    fullMatch: string; // The complete string to replace
}

const INITIAL_BLOCKS: Block[] = [
    {
        id: '1',
        type: 'equation',
        latex: '$y = \\box + \\box x$'
    },
    {
        id: '2',
        type: 'equation',
        latex: '$\\mat$'
    }
];

// Initialize with EMPTY settings to allow fallbacks to config/boxDefaults.ts
const DEFAULT_BOX_SETTINGS: BoxSettings = {
    widthScale: undefined,
    heightScale: undefined,
    thickness: undefined,
    paddingLeft: undefined,
    paddingRight: undefined,
    shiftX: undefined,
    shiftY: undefined
};

// --- RENDERERS ---

const tex = new TexEngine();

const RenderEquation = ({ block, y, fontSize, selection, onBoxClick, debug }: { 
    block: EquationBlock, 
    y: number, 
    fontSize: number, 
    selection: SelectionState,
    onBoxClick: (blockId: string, boxIndex: number) => void,
    debug: boolean
}) => {
    
    const boxInteraction = {
        onBoxClick: (index: number, e: any) => onBoxClick(block.id, index),
        isBoxSelected: (index: number) => selection.blockId === block.id && selection.cellIds.includes(index.toString()),
        getBoxSettings: (index: number) => block.boxOverrides ? block.boxOverrides[index] : undefined
    };

    const blockSettings = { ...DEFAULT_BOX_SETTINGS, ...block.boxSettings };
    
    // Pass debug flag (arg 9)
    const nodes = tex.renderToSVG(
        block.latex, 0, 0, fontSize, 'black', 'middle', false, 'text', debug, 
        blockSettings, 
        boxInteraction
    );
    
    return (
        <g transform={`translate(0, ${y})`}>
            {nodes}
        </g>
    );
};

// Helper: Construct Matrix Latex
const constructMatrixLatex = (rows: number, cols: number, data: string[], type: 'matrix'|'table') => {
    const cmd = type === 'table' ? '\\table' : '\\bmatrix';
    let latex = `${cmd}{ `;
    for(let r=0; r<rows; r++) {
        const rowItems = [];
        for(let c=0; c<cols; c++) {
            const val = data[r*cols + c];
            if (val === '') {
                // If empty, use \gap for matrix (underline) or ~ (space) for table
                if (type === 'table') rowItems.push('~'); 
                else rowItems.push('\\gap');
            }
            else if (val === ' ') rowItems.push('~'); 
            else rowItems.push(val);
        }
        latex += rowItems.join(' & ');
        if (r < rows - 1) latex += ' \\\\ ';
    }
    latex += ` }`;
    return latex;
};

// Helper: Parse balanced braces to extract table content correctly
// Returns a list of matrices found in the latex string
const findMatricesInLatex = (latex: string): DetectedMatrix[] => {
    const results: DetectedMatrix[] = [];
    const regex = /\\(p|b)?matrix|\\table|\\mat/g;
    let match;

    while ((match = regex.exec(latex)) !== null) {
        const startIdx = match.index;
        const cmd = match[0];
        
        let contentStart = startIdx + cmd.length;
        // Skip whitespace after command
        while (contentStart < latex.length && /\s/.test(latex[contentStart])) contentStart++;

        // Case 1: Shorthands \mat or \table without braces (if that's a valid shortcut usage)
        // But our shortcuts are usually expanded or just placeholders.
        // If next char is NOT '{', handle as empty/shortcut
        if (latex[contentStart] !== '{') {
            if (cmd === '\\mat') {
                results.push({
                    index: results.length,
                    type: 'matrix',
                    rows: 2, cols: 2,
                    data: ['', '', '', ''],
                    startIndex: startIdx,
                    fullMatch: cmd // Just the command
                });
            } else if (cmd === '\\table') {
                // \table shortcut (default 3x3)
                results.push({
                    index: results.length,
                    type: 'table',
                    rows: 3, cols: 3,
                    data: ['A', 'B', 'C', '1', '2', '3', '4', '5', '6'],
                    startIndex: startIdx,
                    fullMatch: cmd
                });
            }
            continue;
        }

        // Case 2: Standard \table{...} or \matrix{...}
        // Find matching closing brace
        let balance = 1;
        let endIdx = contentStart + 1;
        while (endIdx < latex.length && balance > 0) {
            if (latex[endIdx] === '{') balance++;
            else if (latex[endIdx] === '}') balance--;
            endIdx++;
        }

        if (balance === 0) {
            // Found complete group
            const fullMatch = latex.substring(startIdx, endIdx);
            const content = latex.substring(contentStart + 1, endIdx - 1); // strip outer braces
            
            // Parse Rows/Cols
            // Important: We must split by \\ and & BUT ignore those inside nested braces!
            // Simple split won't work for nested tables.
            
            // Row Splitter
            const rowStrings: string[] = [];
            let rowBuffer = "";
            let b = 0;
            for(let i=0; i<content.length; i++) {
                const char = content[i];
                if (char === '{') b++;
                if (char === '}') b--;
                
                // Check for \\ (double backslash) at top level
                if (b === 0 && char === '\\' && content[i+1] === '\\') {
                    rowStrings.push(rowBuffer);
                    rowBuffer = "";
                    i++; // skip second backslash
                } else {
                    rowBuffer += char;
                }
            }
            rowStrings.push(rowBuffer); // Push last row

            const rows = rowStrings.length;
            let cols = 0;
            const data: string[] = [];

            rowStrings.forEach(rStr => {
                // Col Splitter
                const colStrings: string[] = [];
                let colBuffer = "";
                let cb = 0;
                for(let i=0; i<rStr.length; i++) {
                    const char = rStr[i];
                    if (char === '{') cb++;
                    if (char === '}') cb--;
                    
                    if (cb === 0 && char === '&') {
                        colStrings.push(colBuffer.trim());
                        colBuffer = "";
                    } else {
                        colBuffer += char;
                    }
                }
                colStrings.push(colBuffer.trim());
                
                cols = Math.max(cols, colStrings.length);
                data.push(...colStrings.map(c => {
                    if (c === '\\gap') return '';
                    if (c === '~') return '';
                    return c;
                }));
            });

            // Normalize data length
            if (data.length < rows * cols) {
                const normalized: string[] = [];
                let ptr = 0;
                // Re-iterate to pad correctly per row
                // (Previous mapping flattened it, so we lost row structure boundaries if ragged)
                // Let's redo the push with padding
                const tempRows: string[][] = [];
                rowStrings.forEach(rStr => {
                    const colStrings: string[] = [];
                    let colBuffer = "";
                    let cb = 0;
                    for(let i=0; i<rStr.length; i++) {
                        const char = rStr[i];
                        if (char === '{') cb++;
                        if (char === '}') cb--;
                        if (cb === 0 && char === '&') {
                            colStrings.push(colBuffer.trim()); colBuffer = "";
                        } else {
                            colBuffer += char;
                        }
                    }
                    colStrings.push(colBuffer.trim());
                    tempRows.push(colStrings);
                });

                tempRows.forEach(r => {
                    for(let c=0; c<cols; c++) {
                        let val = r[c] || '';
                        if (val === '\\gap') val = '';
                        if (val === '~') val = '';
                        normalized.push(val);
                    }
                });
                // Replace data
                data.length = 0;
                data.push(...normalized);
            }

            results.push({
                index: results.length,
                type: cmd.includes('table') ? 'table' : 'matrix',
                rows,
                cols,
                data,
                startIndex: startIdx,
                fullMatch
            });
        }
    }
    return results;
};

const BoxBuilder: React.FC = () => {
    const [blocks, setBlocks] = useState<Block[]>(INITIAL_BLOCKS);
    const [fontSize, setFontSize] = useState(11); 
    const [dimCm, setDimCm] = useState({ width: 16, height: 20 });
    const [blockGap, setBlockGap] = useState(40); 
    const [selection, setSelection] = useState<SelectionState>({ blockId: null, cellIds: [] });
    const [activeTab, setActiveTab] = useState<'content' | 'style'>('content');
    const [showDebug, setShowDebug] = useState(false); 
    
    // Engine Props
    const widthPixels = Math.round(dimCm.width * CM_TO_PX);
    const heightPixels = Math.round(dimCm.height * CM_TO_PX);
    const centerX = widthPixels / 2;

    const {
        previewScale, setPreviewScale,
        cropMode, setCropMode,
        selectionBox, customViewBox, hasInitialCrop,
        containerRef,
        handleAutoCrop, handleResetView, handleExportPNG, handleExportSVG, handleFitToScreen, 
        handleCropMouseDown, handleCropMouseMove, handleCropMouseUp
    } = useGraphInteraction('box-svg', widthPixels, heightPixels, dimCm.width, false, true, 0); 

    // --- SELECTION HANDLERS ---
    
    const handleBlockClick = (id: string, switchTab: boolean = true) => {
        setSelection({ blockId: id, cellIds: [] });
        if (switchTab) setActiveTab('style');
    };

    const handleBoxClick = (blockId: string, boxIndex: number, multi: boolean) => {
        const indexStr = boxIndex.toString();
        setSelection(prev => {
            if (prev.blockId !== blockId) return { blockId, cellIds: [indexStr] };
            if (multi) {
                const newIds = prev.cellIds.includes(indexStr) 
                    ? prev.cellIds.filter(i => i !== indexStr)
                    : [...prev.cellIds, indexStr];
                return { blockId, cellIds: newIds };
            }
            return { blockId, cellIds: [indexStr] };
        });
        setActiveTab('style');
    };

    // --- DATA UPDATES ---

    const addBlock = (variant: 'text' | 'matrix' | 'table') => {
        const id = Date.now().toString();
        const base: BaseBlock = { id, type: 'equation', boxSettings: { ...DEFAULT_BOX_SETTINGS } };
        
        let latex = '';
        if (variant === 'text') latex = '$y = \\box$';
        else if (variant === 'matrix') latex = '$\\mat$';
        else if (variant === 'table') latex = '$\\table$';

        setBlocks([...blocks, { ...base, type: 'equation', latex }]);
    };

    const removeBlock = (id: string) => {
        setBlocks(blocks.filter(b => b.id !== id));
        if (selection.blockId === id) {
            setSelection({ blockId: null, cellIds: [] });
        }
    };

    const updateBlock = (id: string, updates: Partial<Block>) => {
        setBlocks(blocks.map(b => (b.id === id ? { ...b, ...updates } as Block : b)));
    };

    // --- EQUATION MATRIX HELPER ---
    
    // Parse ALL matrices in the current block using robust parser
    const derivedMatrices = useMemo<DetectedMatrix[]>(() => {
        const block = blocks.find(b => b.id === selection.blockId);
        if (!block || block.type !== 'equation') return [];
        return findMatricesInLatex(block.latex);
    }, [blocks, selection.blockId]);

    const updateMatrixContent = (matrixIndex: number, newLatexChunk: string) => {
        const block = blocks.find(b => b.id === selection.blockId) as EquationBlock;
        if (!block) return;

        // Re-find matches on the CURRENT string to ensure we have correct indices/matches
        const currentMatrices = findMatricesInLatex(block.latex);
        const targetMatch = currentMatrices[matrixIndex];
        
        if (!targetMatch) return;

        // Use exact substring replacement
        const start = targetMatch.startIndex;
        const end = start + targetMatch.fullMatch.length;
        
        const newLatex = block.latex.slice(0, start) + newLatexChunk + block.latex.slice(end);
        updateBlock(block.id, { latex: newLatex });
    };

    const handleMatrixDataChange = (matrixIdx: number, cellIdx: number, val: string) => {
        const mat = derivedMatrices[matrixIdx];
        if(!mat) return;
        const newData = [...mat.data];
        newData[cellIdx] = val;
        
        const newChunk = constructMatrixLatex(mat.rows, mat.cols, newData, mat.type);
        updateMatrixContent(matrixIdx, newChunk);
    };

    const handleMatrixDimsChange = (matrixIdx: number, newRows: number, newCols: number) => {
        const mat = derivedMatrices[matrixIdx];
        if(!mat) return;
        
        const newData: string[] = [];
        const defaultVal = ''; 
        
        for(let i=0; i<newRows; i++) {
            for(let j=0; j<newCols; j++) {
                if(i < mat.rows && j < mat.cols) {
                    newData.push(mat.data[i*mat.cols + j] || defaultVal);
                } else {
                    newData.push(defaultVal); 
                }
            }
        }
        
        const newChunk = constructMatrixLatex(newRows, newCols, newData, mat.type);
        updateMatrixContent(matrixIdx, newChunk);
    };

    // --- STYLE UPDATES ---

    const getSelectedSettings = (): BoxSettings => {
        if (!selection.blockId) return DEFAULT_BOX_SETTINGS;
        const block = blocks.find(b => b.id === selection.blockId);
        if (!block) return DEFAULT_BOX_SETTINGS;

        if (selection.cellIds.length > 0) {
            const eqBlock = block as EquationBlock;
            const idx = parseInt(selection.cellIds[0]);
            const override = eqBlock.boxOverrides?.[idx];
            return { ...DEFAULT_BOX_SETTINGS, ...block.boxSettings, ...override };
        }
        return { ...DEFAULT_BOX_SETTINGS, ...block.boxSettings };
    };

    const updateSelectedStyle = (updates: Partial<BoxSettings>) => {
        if (!selection.blockId) return;
        const block = blocks.find(b => b.id === selection.blockId);
        if (!block) return;

        if (selection.cellIds.length > 0) {
            const eqBlock = block as EquationBlock;
            const newOverrides = { ...(eqBlock.boxOverrides || {}) };
            selection.cellIds.forEach(idStr => {
                const idx = parseInt(idStr);
                newOverrides[idx] = { ...(newOverrides[idx] || {}), ...updates };
            });
            updateBlock(block.id, { boxOverrides: newOverrides });
        } else {
            updateBlock(block.id, { boxSettings: { ...block.boxSettings, ...updates } });
        }
    };

    const handleFitCanvas = () => {
        const box = getAutoCropBox('box-svg', widthPixels, heightPixels, true, 0); 
        const padding = 0; 
        const wPx = box.width + padding * 2;
        const hPx = box.height + padding * 2;
        
        setDimCm({
            width: parseFloat((wPx / CM_TO_PX).toFixed(1)),
            height: parseFloat((hPx / CM_TO_PX).toFixed(1))
        });
    };

    // --- LAYOUT ---
    const layout = useMemo(() => {
        let currentTop = 50;
        return blocks.map(b => {
            // Measure to get precise height (handling large tables)
            const metrics = tex.measure(b.latex, fontSize);
            const contentHeight = metrics.box.height; // ascent + descent
            
            // Align baseline: The group is translated to 'y'. 
            // Text is drawn at (0,0) relative to group (baseline).
            // So y must be (Top + Ascent).
            const baselineY = currentTop + metrics.box.ascent;
            
            // Prepare next position
            currentTop += contentHeight + blockGap;
            
            return { block: b, y: baselineY };
        });
    }, [blocks, fontSize, blockGap]);

    const currentStyle = getSelectedSettings();

    // Calculate Actual Pixels
    const xHeight = fontSize * BOX_DEFAULTS.xHeightRatio;
    
    // Fallbacks
    const activeBlock = blocks.find(b => b.id === selection.blockId);
    let defaultThickness = 1.0;
    let baseWidthRatio = 1.0;
    let baseHeightRatio = 1.0;

    if (activeBlock) {
        defaultThickness = BOX_DEFAULTS.equationBox.strokeWidth;
        baseWidthRatio = BOX_DEFAULTS.equationBox.widthRatio;
        baseHeightRatio = BOX_DEFAULTS.equationBox.heightRatio;
    }

    const currentScaleW = currentStyle.widthScale ?? 1.0;
    const currentScaleH = currentStyle.heightScale ?? 1.0;
    
    // Pixel calculation approximations
    const calcWidthPx = xHeight * baseWidthRatio * currentScaleW;
    const calcHeightPx = xHeight * baseHeightRatio * currentScaleH;

    return (
        <div className="flex h-full flex-col bg-gray-50" onMouseMove={(e) => handleCropMouseMove(e)} onMouseUp={handleCropMouseUp}>
            <header className="flex items-center justify-between px-6 py-3 bg-white border-b border-gray-200 shadow-sm z-10">
                <div className="flex items-center gap-3">
                    <div className="p-2 bg-slate-100 text-slate-700 rounded-lg"><Square className="w-5 h-5" /></div>
                    <h1 className="text-xl font-semibold text-gray-800">Box Builder</h1>
                </div>
                <GraphToolbar 
                    previewScale={previewScale} setPreviewScale={setPreviewScale}
                    cropMode={cropMode} setCropMode={setCropMode}
                    onResetView={handleResetView} onAutoCrop={handleAutoCrop}
                    onExportPNG={handleExportPNG} onExportSVG={handleExportSVG}
                    onCopy={() => {}} 
                    onFitToScreen={handleFitToScreen}
                    showDebug={showDebug} onToggleDebug={() => setShowDebug(!showDebug)}
                />
            </header>

            <div className="flex flex-1 overflow-hidden">
                <aside className="w-96 bg-white border-r border-gray-200 flex flex-col h-full z-20">
                    <div className="flex border-b border-gray-200 bg-white">
                        <button onClick={() => setActiveTab('content')} className={`flex-1 py-3 text-sm font-medium flex justify-center items-center gap-2 ${activeTab === 'content' ? 'text-slate-600 border-b-2 border-slate-600 bg-slate-50/50' : 'text-gray-500'}`}><LayoutGrid size={16} /> Content</button>
                        <button onClick={() => setActiveTab('style')} className={`flex-1 py-3 text-sm font-medium flex justify-center items-center gap-2 ${activeTab === 'style' ? 'text-slate-600 border-b-2 border-slate-600 bg-slate-50/50' : 'text-gray-500'}`}><Palette size={16} /> Style</button>
                    </div>

                    <div className="flex-1 overflow-y-auto custom-scrollbar p-4 space-y-4">
                        {activeTab === 'content' && (
                            <>
                                <div className="grid grid-cols-3 gap-2">
                                    <button onClick={() => addBlock('text')} className="py-2 bg-white border rounded text-xs font-medium hover:bg-slate-50 flex flex-col items-center gap-1">
                                        <Type size={16}/> Text/Eq
                                    </button>
                                    <button onClick={() => addBlock('matrix')} className="py-2 bg-white border rounded text-xs font-medium hover:bg-slate-50 flex flex-col items-center gap-1">
                                        <LayoutGrid size={16}/> Matrix
                                    </button>
                                    <button onClick={() => addBlock('table')} className="py-2 bg-white border rounded text-xs font-medium hover:bg-slate-50 flex flex-col items-center gap-1">
                                        <TableIcon size={16}/> Table
                                    </button>
                                </div>

                                {blocks.map((b, i) => (
                                    <div 
                                        key={b.id} 
                                        onClick={() => handleBlockClick(b.id, false)}
                                        className={`bg-white border rounded-lg p-3 shadow-sm relative group cursor-pointer transition-colors ${selection.blockId === b.id ? 'border-blue-400 ring-1 ring-blue-100' : 'border-gray-200 hover:border-blue-300'}`}
                                    >
                                        <div className="absolute right-2 top-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                            <button onClick={(e) => { e.stopPropagation(); removeBlock(b.id); }} className="text-gray-400 hover:text-red-500"><Trash2 size={14}/></button>
                                        </div>
                                        <div className="mb-2 flex items-center gap-2">
                                            <GripVertical size={14} className="text-gray-300"/>
                                            <span className="text-[10px] font-bold text-gray-400 uppercase">Item {i+1}</span>
                                        </div>

                                        <div>
                                            <textarea 
                                                value={b.latex}
                                                onChange={(e) => updateBlock(b.id, { latex: e.target.value })}
                                                className="w-full h-16 border border-gray-300 rounded p-2 text-sm font-mono focus:ring-blue-500 focus:border-blue-500"
                                                placeholder="y = \box + 2x"
                                            />
                                            <div className="text-[10px] text-gray-400 mt-1">
                                                Shortcuts: <code>\mat</code>, <code>\table</code>, <code>\box</code>, <code>\gap</code>
                                            </div>

                                            {/* DETECTED MATRIX/TABLE EDITORS */}
                                            {selection.blockId === b.id && derivedMatrices.length > 0 && (
                                                <div className="mt-3 space-y-3" onClick={(e) => e.stopPropagation()}>
                                                    {derivedMatrices.map((mat) => (
                                                        <div key={mat.index} className="bg-blue-50 border border-blue-200 rounded p-2 space-y-2">
                                                            <div className="flex justify-between items-center mb-1">
                                                                <span className="text-[10px] font-bold text-blue-700 uppercase">
                                                                    {mat.type} {derivedMatrices.length > 1 ? mat.index + 1 : ''} Editor
                                                                </span>
                                                                <div className="flex gap-1">
                                                                    <input 
                                                                        type="number" min="1" max="6"
                                                                        value={mat.rows}
                                                                        onChange={(e) => handleMatrixDimsChange(mat.index, parseInt(e.target.value), mat.cols)}
                                                                        className="w-8 text-[10px] p-0.5 border rounded text-center"
                                                                        title="Rows"
                                                                    />
                                                                    <span className="text-blue-400">×</span>
                                                                    <input 
                                                                        type="number" min="1" max="6"
                                                                        value={mat.cols}
                                                                        onChange={(e) => handleMatrixDimsChange(mat.index, mat.rows, parseInt(e.target.value))}
                                                                        className="w-8 text-[10px] p-0.5 border rounded text-center"
                                                                        title="Cols"
                                                                    />
                                                                </div>
                                                            </div>
                                                            
                                                            <div className="grid gap-1" style={{ gridTemplateColumns: `repeat(${mat.cols}, 1fr)` }}>
                                                                {mat.data.map((val, idx) => (
                                                                    <input 
                                                                        key={idx}
                                                                        value={val}
                                                                        onChange={(e) => handleMatrixDataChange(mat.index, idx, e.target.value)}
                                                                        className="w-full border border-blue-200 rounded px-1 py-0.5 text-xs text-center"
                                                                        placeholder={mat.type === 'table' ? '' : '\\gap'}
                                                                    />
                                                                ))}
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </>
                        )}

                        {activeTab === 'style' && (
                            <div className="space-y-6">
                                <div>
                                    <h3 className="text-xs font-bold text-gray-500 uppercase mb-3">Global Layout</h3>
                                    <div className="grid grid-cols-2 gap-3 mb-3">
                                        <div>
                                            <label className="block text-xs text-gray-500 mb-1">Font Size</label>
                                            <input type="number" value={fontSize} onChange={(e) => setFontSize(parseFloat(e.target.value))} className="w-full border rounded p-1 text-xs" />
                                        </div>
                                        <div>
                                            <label className="block text-xs text-gray-500 mb-1">Vertical Gap</label>
                                            <input type="number" value={blockGap} onChange={(e) => setBlockGap(parseFloat(e.target.value))} className="w-full border rounded p-1 text-xs" />
                                        </div>
                                    </div>
                                    <div className="grid grid-cols-2 gap-3 mb-3">
                                        <input type="number" value={dimCm.width} onChange={(e) => setDimCm({...dimCm, width: parseFloat(e.target.value)})} className="border rounded p-1 text-xs" placeholder="W" />
                                        <input type="number" value={dimCm.height} onChange={(e) => setDimCm({...dimCm, height: parseFloat(e.target.value)})} className="border rounded p-1 text-xs" placeholder="H" />
                                    </div>
                                    <button 
                                        onClick={handleFitCanvas}
                                        className="w-full py-1.5 flex items-center justify-center gap-2 bg-slate-50 text-slate-700 border border-slate-200 rounded text-xs font-medium hover:bg-slate-100 transition-colors"
                                    >
                                        <Maximize size={12} /> Fit Canvas to Content
                                    </button>
                                </div>

                                <div className="border-t border-gray-200 pt-4">
                                    <div className="flex justify-between items-center mb-3">
                                        <h3 className="text-xs font-bold text-gray-500 uppercase flex items-center gap-2">
                                            <MousePointer2 size={12} /> Selected Box Style
                                        </h3>
                                        <div className="flex gap-2 items-center">
                                            <button 
                                                onClick={() => updateSelectedStyle({ widthScale: undefined, heightScale: undefined, thickness: undefined, paddingLeft: undefined, paddingRight: undefined, shiftX: undefined, shiftY: undefined })} 
                                                title="Revert to Defaults" 
                                                className="text-gray-400 hover:text-red-500"
                                            >
                                                <RotateCcw size={12} />
                                            </button>
                                            <span className="text-[10px] text-blue-600 font-medium">
                                                {selection.blockId ? (selection.cellIds.length > 0 ? `${selection.cellIds.length} Boxes` : 'Entire Block') : 'None'}
                                            </span>
                                        </div>
                                    </div>
                                    
                                    <div className={`space-y-4 ${!selection.blockId ? 'opacity-50 pointer-events-none' : ''}`}>
                                        
                                        {/* Dimensions */}
                                        <div className="space-y-3 p-3 bg-slate-50 border border-slate-100 rounded">
                                            <span className="text-[10px] font-bold text-slate-400 uppercase">Dimensions</span>
                                            
                                            <div>
                                                <div className="flex justify-between text-xs text-gray-600 mb-1">
                                                    <span>Width</span>
                                                    <span className="font-mono text-[10px] font-bold text-blue-600">
                                                        {activeBlock?.type === 'equation' ? calcWidthPx.toFixed(1) + 'px' : '-'}
                                                        <span className="text-gray-400 font-normal ml-1">({(currentStyle.widthScale ?? 1.0).toFixed(1)}x)</span>
                                                    </span>
                                                </div>
                                                <input 
                                                    type="range" min="0.5" max="3" step="0.1"
                                                    value={currentStyle.widthScale ?? 1.0}
                                                    onChange={(e) => updateSelectedStyle({ widthScale: parseFloat(e.target.value) })}
                                                    className="w-full h-1 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-slate-600"
                                                />
                                            </div>
                                            <div>
                                                <div className="flex justify-between text-xs text-gray-600 mb-1">
                                                    <span>Height</span>
                                                    <span className="font-mono text-[10px] font-bold text-blue-600">
                                                        {activeBlock?.type === 'equation' ? calcHeightPx.toFixed(1) + 'px' : '-'}
                                                        <span className="text-gray-400 font-normal ml-1">({(currentStyle.heightScale ?? 1.0).toFixed(1)}x)</span>
                                                    </span>
                                                </div>
                                                <input 
                                                    type="range" min="0.5" max="3" step="0.1"
                                                    value={currentStyle.heightScale ?? 1.0}
                                                    onChange={(e) => updateSelectedStyle({ heightScale: parseFloat(e.target.value) })}
                                                    className="w-full h-1 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-slate-600"
                                                />
                                            </div>
                                            <div>
                                                <div className="flex justify-between text-xs text-gray-600 mb-1">
                                                    <span>Thickness</span>
                                                    <span>{currentStyle.thickness ?? defaultThickness}px</span>
                                                </div>
                                                <input 
                                                    type="range" min="0.5" max="5" step="0.5"
                                                    value={currentStyle.thickness ?? defaultThickness}
                                                    onChange={(e) => updateSelectedStyle({ thickness: parseFloat(e.target.value) })}
                                                    className="w-full h-1 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-slate-600"
                                                />
                                            </div>
                                        </div>

                                        {/* Positioning */}
                                        <div className="space-y-3 p-3 bg-slate-50 border border-slate-100 rounded">
                                            <span className="text-[10px] font-bold text-slate-400 uppercase">Positioning (Px)</span>
                                            
                                            <div className="grid grid-cols-2 gap-2">
                                                <div>
                                                    <div className="flex items-center gap-1 text-[10px] text-gray-500 mb-1"><ArrowLeftRight size={10}/> Padding L</div>
                                                    <input 
                                                        type="number" min="0" step="1"
                                                        value={currentStyle.paddingLeft ?? 0}
                                                        onChange={(e) => updateSelectedStyle({ paddingLeft: parseFloat(e.target.value) })}
                                                        className="w-full border rounded px-1 text-xs"
                                                    />
                                                </div>
                                                <div>
                                                    <div className="flex items-center gap-1 text-[10px] text-gray-500 mb-1"><ArrowLeftRight size={10}/> Padding R</div>
                                                    <input 
                                                        type="number" min="0" step="1"
                                                        value={currentStyle.paddingRight ?? 0}
                                                        onChange={(e) => updateSelectedStyle({ paddingRight: parseFloat(e.target.value) })}
                                                        className="w-full border rounded px-1 text-xs"
                                                    />
                                                </div>
                                            </div>

                                            <div>
                                                <div className="flex justify-between text-xs text-gray-600 mb-1">
                                                    <span className="flex items-center gap-1"><Move size={10}/> Shift X</span>
                                                    <span className="text-[10px] font-mono">{currentStyle.shiftX ?? 0}px</span>
                                                </div>
                                                <input 
                                                    type="range" min="-20" max="20" step="1"
                                                    value={currentStyle.shiftX ?? 0}
                                                    onChange={(e) => updateSelectedStyle({ shiftX: parseFloat(e.target.value) })}
                                                    className="w-full h-1 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
                                                />
                                            </div>
                                            <div>
                                                <div className="flex justify-between text-xs text-gray-600 mb-1">
                                                    <span className="flex items-center gap-1"><Move size={10} className="rotate-90"/> Shift Y</span>
                                                    <span className="text-[10px] font-mono">{currentStyle.shiftY ?? 0}px</span>
                                                </div>
                                                <input 
                                                    type="range" min="-20" max="20" step="1"
                                                    value={currentStyle.shiftY ?? 0}
                                                    onChange={(e) => updateSelectedStyle({ shiftY: parseFloat(e.target.value) })}
                                                    className="w-full h-1 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
                                                />
                                            </div>
                                        </div>

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
                                id="box-svg" 
                                width={widthPixels} 
                                height={heightPixels} 
                                viewBox={customViewBox || `0 0 ${widthPixels} ${heightPixels}`} 
                                xmlns="http://www.w3.org/2000/svg" 
                                style={{ display: 'block' }}
                            >
                                <rect x="0" y="0" width={widthPixels} height={heightPixels} fill="white" />
                                
                                {/* 
                                    Update class to "box-content-layer" to match the specialized auto-crop rule.
                                    This container holds the actual content that should be cropped.
                                */}
                                <g transform={`translate(${centerX}, 0)`} className="box-content-layer">
                                    {layout.map((l) => (
                                        <g 
                                            key={l.block.id} 
                                            onClick={(e) => { e.stopPropagation(); handleBlockClick(l.block.id, true); }}
                                            className="cursor-pointer"
                                        >
                                            <RenderEquation 
                                                block={l.block} 
                                                y={l.y} 
                                                fontSize={fontSize} 
                                                selection={selection}
                                                onBoxClick={(bid, bidx) => handleBoxClick(bid, bidx, false)} // No multi-select for now
                                                debug={showDebug}
                                            />
                                        </g>
                                    ))}
                                </g>

                                <g className="ui-layer" style={{ display: cropMode ? 'none' : 'block' }}>
                                    {layout.map((l) => {
                                        const isBlockSelected = selection.blockId === l.block.id && selection.cellIds.length === 0;
                                        if (isBlockSelected) {
                                            return (
                                                <rect 
                                                    key={`highlight-${l.block.id}`}
                                                    x={0} 
                                                    y={l.y - 30} 
                                                    width={widthPixels} 
                                                    height={60} 
                                                    fill="blue" 
                                                    opacity="0.05" 
                                                    pointerEvents="none"
                                                />
                                            );
                                        }
                                        return null;
                                    })}
                                </g>

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

export default BoxBuilder;
