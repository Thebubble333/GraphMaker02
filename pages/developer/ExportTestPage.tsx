import React, { useState } from 'react';
import { generateGraphImage, downloadSVG, copyImageToClipboard } from '../../utils/imageExport';

const ExportTestPage: React.FC = () => {
    const [cmWidth, setCmWidth] = useState(10);
    const [dpi, setDpi] = useState(300);
    const [fontSize, setFontSize] = useState(16);
    const [isCopied, setIsCopied] = useState(false);
    
    // Scale: 100 SVG units = 1 cm
    const svgWidth = cmWidth * 100;
    const svgHeight = cmWidth * 100;

    const handleDownloadPng = async () => {
        const result = await generateGraphImage('export-test-svg', svgWidth, svgHeight, cmWidth, true, 0, dpi);
        if (result && result.blob) {
            const url = URL.createObjectURL(result.blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `export-test-${cmWidth}cm-${dpi}dpi.png`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        }
    };

    const handleCopy = async () => {
        const result = await generateGraphImage('export-test-svg', svgWidth, svgHeight, cmWidth, true, 0, dpi);
        if (result && result.blob) {
            try {
                await copyImageToClipboard(result.blob, result.widthCm, result.heightCm); // using actual calculated dim
                setIsCopied(true);
                setTimeout(() => setIsCopied(false), 2000);
            } catch (err) {
                console.error("Failed to copy", err);
            }
        }
    };

    const handleDownloadSvg = () => {
        downloadSVG('export-test-svg', `export-test-${cmWidth}cm.svg`, cmWidth, cmWidth);
    };

    // Prepare some text and math for rendering
    // A minimal text rendering strategy using the engine's text components
    const renderMathText = (math: string, size: number, x: number, y: number) => {
        return (
            <text x={x} y={y} fontSize={size} fontFamily="Times New Roman" fill="black">
                {math} ({size}px)
            </text>
        );
    };

    return (
        <div className="flex h-full bg-white">
            <div className="w-80 border-r border-gray-200 p-6 flex flex-col gap-6 overflow-y-auto">
                <div>
                    <h2 className="text-xl font-bold text-gray-800 mb-2">Export Image Tester</h2>
                    <p className="text-sm text-gray-600 mb-4">
                        Diagnose PNG and SVG export sizes and fonts. 
                    </p>
                    <div className="text-xs text-slate-500 bg-slate-50 p-3 rounded border border-slate-200">
                        <p className="font-semibold mb-1">Unit Scaling</p>
                        <p>1 inch = 2.54 cm</p>
                        <p>1 pt = 1/72 inch</p>
                        <p>1 cm = 100 SVG Units (in this scaling logic)</p>
                        <p>1 pt = ~3.5278 SVG Units</p>
                    </div>
                </div>

                <div className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Target CM Width</label>
                        <input
                            type="number"
                            value={cmWidth}
                            onChange={e => setCmWidth(Number(e.target.value))}
                            className="w-full px-3 py-2 border rounded"
                            min={1}
                            max={50}
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">DPI</label>
                        <input
                            type="number"
                            value={dpi}
                            onChange={e => setDpi(Number(e.target.value))}
                            className="w-full px-3 py-2 border rounded"
                            step={72}
                            min={72}
                            max={1200}
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Test Font Size</label>
                        <input
                            type="number"
                            value={fontSize}
                            onChange={e => setFontSize(Number(e.target.value))}
                            className="w-full px-3 py-2 border rounded"
                        />
                    </div>
                </div>

                <div className="space-y-3 mt-6">
                    <button
                        onClick={handleCopy}
                        className="w-full px-4 py-2 bg-indigo-600 text-white rounded hover:bg-indigo-700 transition flex items-center justify-center gap-2"
                    >
                        {isCopied ? "Copied!" : "Copy to Clipboard"}
                    </button>
                    <button
                        onClick={handleDownloadPng}
                        className="w-full px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition"
                    >
                        Download PNG
                    </button>
                    <button
                        onClick={handleDownloadSvg}
                        className="w-full px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 transition"
                    >
                        Download SVG
                    </button>
                </div>
            </div>

            <div className="flex-1 overflow-auto bg-gray-100 p-8 flex items-center justify-center">
                <div className="bg-white shadow-lg overflow-hidden border border-gray-200">
                    <svg
                        id="export-test-svg"
                        width={svgWidth}
                        height={svgWidth}
                        viewBox={`0 0 ${svgWidth} ${svgHeight}`}
                        className="bg-white block"
                    >
                        {/* Outer Border */}
                        <rect x={0} y={0} width={svgWidth} height={svgHeight} fill="none" stroke="red" strokeWidth={2} />
                        
                        {/* Title */}
                        <text x={20} y={40} fontSize={24} fontFamily="sans-serif" fontWeight="bold">
                            Export Size Reference
                        </text>

                        {/* Test Square 1 (5cm) */}
                        <rect x={20} y={80} width={500} height={500} fill="#f0f9ff" stroke="#0ea5e9" strokeWidth={2} />
                        <text x={270} y={320} fontSize={20} fontFamily="sans-serif" fill="#0ea5e9" textAnchor="middle">
                            5cm x 5cm Square
                        </text>
                        <text x={270} y={350} fontSize={16} fontFamily="sans-serif" fill="#0ea5e9" textAnchor="middle">
                            (500 SVG Units)
                        </text>

                        {/* Test Box inside 5cm square indicating physical properties */}
                        <rect x={120} y={180} width={300} height={100} fill="white" stroke="#64748b" strokeDasharray="4 4" />
                        <text x={270} y={215} fontSize={14} fontFamily="sans-serif" fill="#334155" textAnchor="middle">
                            Target width: {cmWidth} cm
                        </text>
                        <text x={270} y={235} fontSize={14} fontFamily="sans-serif" fill="#334155" textAnchor="middle">
                            Pixels: {Math.round((cmWidth / 2.54) * dpi)} px (at {dpi} DPI)
                        </text>
                        <text x={270} y={255} fontSize={14} fontFamily="sans-serif" fill="#334155" textAnchor="middle">
                            Aspect Ratio: 1:1
                        </text>

                        {/* Font size tests */}
                        <g transform={`translate(550, 80)`}>
                            <text x={0} y={0} fontSize={20} fontFamily="sans-serif" fontWeight="bold">Font Size Tests (pt vs px)</text>
                            
                            <text x={0} y={40} fontSize={10 * 3.5278} fontFamily="Times New Roman">Times New Roman 10pt</text>
                            <text x={0} y={85} fontSize={11 * 3.5278} fontFamily="Times New Roman">Times New Roman 11pt</text>
                            <text x={0} y={135} fontSize={12 * 3.5278} fontFamily="Times New Roman">Times New Roman 12pt</text>
                            <text x={0} y={195} fontSize={14 * 3.5278} fontFamily="Times New Roman">Times New Roman 14pt</text>
                            
                            <line x1={0} y1={215} x2={350} y2={215} stroke="#ccc" strokeWidth={1} strokeDasharray="4 4"/>
                            
                            <text x={0} y={245} fontSize={12} fontFamily="Times New Roman">Raw 12px (Not pt)</text>
                            <text x={0} y={270} fontSize={24} fontFamily="Times New Roman">Raw 24px (Not pt)</text>
                            <text x={0} y={305} fontSize={32} fontFamily="Times New Roman">Raw 32px (Not pt)</text>
                            
                            {renderMathText(`Dynamic Render Text`, fontSize * 3.5278, 0, 360)}
                            <text x={0} y={380} fontSize={14} fill="gray">Rendered at {fontSize}pt ({Math.round(fontSize * 3.5278)}px SVG units)</text>
                        </g>

                        {/* Rulers */}
                        {/* Top ruler */}
                        <g transform={`translate({20}, {600})`}>
                            <line x1={20} y1={600} x2={520} y2={600} stroke="#333" strokeWidth={1} />
                            {[0,1,2,3,4,5].map(cm => (
                                <g key={`ruler-top-${cm}`}>
                                    <line x1={20 + cm * 100} y1={590} x2={20 + cm * 100} y2={610} stroke="#333" strokeWidth={1} />
                                    <text x={20 + cm * 100} y={625} fontSize={12} textAnchor="middle">{cm}cm</text>
                                </g>
                            ))}
                        </g>

                        {/* Custom symbols/formulas text baseline tests */}
                        <g transform="translate(550, 450)">
                            <text x={0} y={0} fontSize={20} fontFamily="sans-serif" fontWeight="bold">Baseline & Symbol Test</text>
                            
                            <line x1={0} y1={40} x2={300} y2={40} stroke="#ff9999" strokeWidth={1} />
                            <text x={0} y={40} fontSize={16} fontFamily="Times New Roman">Baseline Text 16px</text>

                            <line x1={0} y1={80} x2={300} y2={80} stroke="#ff9999" strokeWidth={1} />
                            <text x={0} y={80} fontSize={24} fontFamily="Times New Roman">Baseline αβγδε 24px</text>

                            <line x1={0} y1={130} x2={300} y2={130} stroke="#ff9999" strokeWidth={1} />
                            <text x={0} y={130} fontSize={32} fontFamily="Times New Roman">∫ √ µ ∇ ∑ 32px</text>
                        </g>
                    </svg>
                </div>
            </div>
        </div>
    );
};

export default ExportTestPage;
