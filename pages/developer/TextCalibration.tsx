import React, { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import { TexEngine, DEFAULT_TEXT_METRICS, TextLayoutMetrics } from '../../utils/textRenderer';
import { useDragSystem } from '../../hooks/useDragSystem';
import { useGraphInteraction } from '../../hooks/useGraphInteraction';
import { GraphToolbar } from '../../components/GraphToolbar';
import {
    Type,
    RotateCcw,
    RefreshCw,
    Upload,
    Trash2,
    Copy,
    Move,
    Maximize,
    Scan,
    LayoutGrid,
    Focus,
    Plus,
    Sun,
    Moon,
    Sliders,
    FlaskConical,
    AlignCenterHorizontal,
    PanelLeftClose,
    PanelLeftOpen
} from 'lucide-react';

export interface BenchmarkFormula {
    id: string;
    title: string;
    category: 'Fractions & Surds' | 'Powers & Scripts' | 'Brackets & Delimiters' | 'Mixed & Matrices';
    latex: string;
    mode: 'math' | 'text';
    notes: string;
}

const DEFAULT_BENCHMARKS: BenchmarkFormula[] = [
    {
        id: 'quadratic',
        title: 'Quadratic Formula',
        category: 'Fractions & Surds',
        latex: '$x = \\frac{-b \\pm \\sqrt{b^2 - 4ac}}{2a}$',
        mode: 'text',
        notes: 'Unary minus (-b), binary ±, radical over b² - 4ac, and fraction bar on math axis'
    },
    {
        id: 'nested-surd-frac',
        title: 'Bracketed Radical Fraction',
        category: 'Brackets & Delimiters',
        latex: '$y = \\left(\\sqrt{\\frac{x^2 + 1}{2x}}\\right)$',
        mode: 'text',
        notes: 'Smooth Bezier parentheses symmetric on math axis wrapping a tall surd & fraction'
    },
    {
        id: 'tall-delim-powers',
        title: 'Exponents on Tall Brackets',
        category: 'Powers & Scripts',
        latex: '$f(x) = \\left(\\frac{x^2 - 1}{x + 1}\\right)^2 + \\left[\\frac{a + b}{c - d}\\right]^3$',
        mode: 'text',
        notes: 'TeX Rule 18a sup_drop anchors exponents at top-right shoulder of tall ( ) and [ ]'
    },
    {
        id: 'curly-and-sub-sup',
        title: 'Curly Braces & Simultaneous Scripts',
        category: 'Brackets & Delimiters',
        latex: '$S_n = \\left\\{\\frac{a_1(1 - r^n)}{1 - r}\\right\\}, \\quad C_n^k = \\frac{x_i^{2k + 1}}{y_j^{n - 1}}$',
        mode: 'text',
        notes: 'Extensible curly braces \\{ \\}, simultaneous sub/superscripts C_n^k, and compound exponents'
    },
    {
        id: 'distance-nested-surd',
        title: 'Distance Formula & Nested Surds',
        category: 'Fractions & Surds',
        latex: '$d = \\sqrt{(x_2 - x_1)^2 + (y_2 - y_1)^2}, \\quad y = \\sqrt{1 + \\sqrt{x^2 + 1}}$',
        mode: 'text',
        notes: 'Subscripts and squared binomials inside a surd, plus nested square roots'
    },
    {
        id: 'compound-fractions',
        title: 'Difference Quotient & Continued Fraction',
        category: 'Fractions & Surds',
        latex: '$\\frac{\\Delta y}{\\Delta x} = \\frac{f(x + h) - f(x)}{h}, \\quad z = \\frac{1}{1 + \\frac{1}{x^2 + 1}}$',
        mode: 'text',
        notes: 'Balanced numerator/denominator clearances and nested fraction scaling'
    },
    {
        id: 'gaussian-tower',
        title: 'Normal Density & Fractional Exponent',
        category: 'Powers & Scripts',
        latex: '$f(x) = \\frac{1}{\\sigma\\sqrt{2\\pi}} e^{-\\frac{1}{2}\\left(\\frac{x - \\mu}{\\sigma}\\right)^2}$',
        mode: 'text',
        notes: 'Greek letters (σ, μ, π) and bracketed fraction raised to a power inside an exponent'
    },
    {
        id: 'matrix-and-boxes',
        title: 'Matrices & Exam Fill-in Boxes',
        category: 'Mixed & Matrices',
        latex: '$A = \\pmatrix{a_{11} & a_{12} \\\\ a_{21} & a_{22}}, \\quad \\frac{\\box}{\\widebox} = \\sqrt{\\gap}$',
        mode: 'text',
        notes: '2x2 matrix with square brackets and interactive exam fill-in boxes/gaps'
    },
    {
        id: 'mixed-inline',
        title: 'Mixed Prose & Inline Math',
        category: 'Mixed & Matrices',
        latex: 'If $a \\neq 0$, roots of $ax^2 + bx + c = 0$ satisfy $x_1 + x_2 = -\\frac{b}{a}$ and $x_1 x_2 = \\frac{c}{a}$.',
        mode: 'text',
        notes: 'Inline math alignment with surrounding Times New Roman prose baseline'
    }
];

interface MetricControlProps {
    label: string;
    field: keyof TextLayoutMetrics;
    value: number;
    onChange: (field: keyof TextLayoutMetrics, val: number) => void;
    onReset: (field: keyof TextLayoutMetrics) => void;
    min: number;
    max: number;
    step?: number;
}

const MetricControl: React.FC<MetricControlProps> = React.memo(({ label, field, value, onChange, onReset, min, max, step = 0.005 }) => {
    const isDefault = value === DEFAULT_TEXT_METRICS[field];
    return (
        <div className="mb-3">
            <div className="flex justify-between items-center mb-1">
                <label className={`text-[10px] font-mono uppercase ${!isDefault ? 'text-blue-400 font-bold' : 'text-gray-400'}`}>
                    {label}
                </label>
                <div className="flex items-center gap-1">
                    <input 
                        type="number" step={step}
                        value={value}
                        onChange={(e) => onChange(field, parseFloat(e.target.value))}
                        className={`w-16 border rounded px-1 text-[10px] text-right focus:outline-none ${!isDefault ? 'bg-blue-900/30 border-blue-500 text-blue-200' : 'bg-gray-800 border-gray-700 text-white'}`}
                    />
                    <button 
                        onClick={() => onReset(field)} 
                        title="Reset"
                        className="text-gray-600 hover:text-white"
                    >
                        <RefreshCw size={8} />
                    </button>
                </div>
            </div>
            <input 
                type="range" min={min} max={max} step={step}
                value={value}
                onChange={(e) => onChange(field, parseFloat(e.target.value))}
                className="w-full h-1 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-green-500"
            />
        </div>
    );
});

interface BgImage {
    url: string;
    x: number;
    y: number;
    width: number;
    height: number;
    opacity: number;
    originalWidth: number;
    originalHeight: number;
}

const TextCalibration: React.FC = () => {
    // Canvas Constants
    const widthPixels = 1150;
    const heightPixels = 1350;

    // View & Theme State
    const [viewMode, setViewMode] = useState<'suite' | 'focus'>('suite');
    const [sidebarMode, setSidebarMode] = useState<'examples' | 'tuning'>('examples');
    const [sidebarCollapsed, setSidebarCollapsed] = useState<boolean>(false);
    const [lightPaper, setLightPaper] = useState<boolean>(true);
    const [showBoundingBoxes, setShowBoundingBoxes] = useState<boolean>(false);
    const [showAxisGuides, setShowAxisGuides] = useState<boolean>(true);
    const [fontSize, setFontSize] = useState<number>(32);

    // Benchmark Formulas State
    const [benchmarks, setBenchmarks] = useState<BenchmarkFormula[]>(DEFAULT_BENCHMARKS);
    const [selectedId, setSelectedId] = useState<string>('quadratic');
    const [customInput, setCustomInput] = useState<string>('$x = \\frac{-b \\pm \\sqrt{b^2 - 4ac}}{2a}$');
    const [newTitle, setNewTitle] = useState<string>('');

    // Configuration State
    const [metrics, setMetrics] = useState<TextLayoutMetrics>(DEFAULT_TEXT_METRICS);
    const [activeTuneTab, setActiveTuneTab] = useState<'global' | 'spacing' | 'frac' | 'surd' | 'script' | 'delim' | 'ref'>('frac');

    // Reference Image State (for Focus Mode)
    const [bgImage, setBgImage] = useState<BgImage | null>(null);
    const [textPos, setTextPos] = useState({ x: 180, y: 420 });

    // Engine
    const tex = useMemo(() => new TexEngine(metrics), [metrics]);

    // Sync selected benchmark with customInput when selection changes
    const selectedBenchmark = useMemo(
        () => benchmarks.find(b => b.id === selectedId) || benchmarks[0],
        [benchmarks, selectedId]
    );

    const handleSelectBenchmark = (item: BenchmarkFormula) => {
        setSelectedId(item.id);
        setCustomInput(item.latex);
    };

    const handleUpdateSelectedLatex = (val: string) => {
        setCustomInput(val);
        setBenchmarks(prev =>
            prev.map(b => (b.id === selectedId ? { ...b, latex: val } : b))
        );
    };

    const handleAddCustomBenchmark = () => {
        const trimmed = customInput.trim();
        if (!trimmed) return;
        const id = `custom-${Date.now()}`;
        const created: BenchmarkFormula = {
            id,
            title: newTitle.trim() || `Custom Formula #${benchmarks.length + 1}`,
            category: 'Mixed & Matrices',
            latex: trimmed,
            mode: trimmed.includes('$') ? 'text' : 'math',
            notes: 'Custom user test expression'
        };
        setBenchmarks(prev => [created, ...prev]);
        setSelectedId(id);
        setNewTitle('');
    };

    const handleResetSuite = () => {
        setBenchmarks(DEFAULT_BENCHMARKS);
        setSelectedId(DEFAULT_BENCHMARKS[0].id);
        setCustomInput(DEFAULT_BENCHMARKS[0].latex);
    };

    // Interaction Hooks
    const {
        previewScale, setPreviewScale,
        cropMode, setCropMode,
        containerRef,
        handleResetView, handleAutoCrop, handleExportPNG, handleExportSVG,
        handleCropMouseDown, handleCropMouseMove, handleCropMouseUp
    } = useGraphInteraction('text-calib-svg', widthPixels, heightPixels, 30, false, true);

    // Center scroll on mount
    useEffect(() => {
        if (containerRef.current) {
            containerRef.current.scrollLeft = 0;
            containerRef.current.scrollTop = 0;
        }
    }, []);

    // Drag Logic (Focus Mode)
    const { onMouseDown, onMouseMove, onMouseUp } = useDragSystem(previewScale);
    const [isPanning, setIsPanning] = useState(false);
    const panStartRef = useRef<{ x: number, y: number, scrollX: number, scrollY: number } | null>(null);

    const updateBgImage = (updates: Partial<BgImage>) => {
        setBgImage(prev => prev ? { ...prev, ...updates } : null);
    };

    const handleTextDrag = (e: React.MouseEvent) => {
        if (e.shiftKey || e.button === 1) return;
        onMouseDown(e, { ...textPos }, (dx, dy, init) => {
            setTextPos({ x: init.x + dx, y: init.y + dy });
        }, undefined, 'text');
    };

    const handleImageDrag = (e: React.MouseEvent) => {
        if (!bgImage || e.shiftKey || e.button === 1) return;
        onMouseDown(e, { x: bgImage.x, y: bgImage.y }, (dx, dy, init) => {
            updateBgImage({ x: init.x + dx, y: init.y + dy });
        }, undefined, 'image');
    };

    const handleCanvasMouseDown = (e: React.MouseEvent) => {
        if (e.shiftKey || e.button === 1) {
            e.preventDefault();
            if (containerRef.current) {
                setIsPanning(true);
                panStartRef.current = {
                    x: e.clientX,
                    y: e.clientY,
                    scrollX: containerRef.current.scrollLeft,
                    scrollY: containerRef.current.scrollTop
                };
            }
        } else {
            handleCropMouseDown(e);
        }
    };

    const handleCanvasMouseMove = (e: React.MouseEvent) => {
        if (isPanning && panStartRef.current && containerRef.current) {
            e.preventDefault();
            const dx = e.clientX - panStartRef.current.x;
            const dy = e.clientY - panStartRef.current.y;
            containerRef.current.scrollLeft = panStartRef.current.scrollX - dx;
            containerRef.current.scrollTop = panStartRef.current.scrollY - dy;
        } else {
            onMouseMove(e);
            handleCropMouseMove(e);
        }
    };

    const handleCanvasMouseUp = () => {
        setIsPanning(false);
        panStartRef.current = null;
        onMouseUp();
        handleCropMouseUp();
    };

    const handleResetMetrics = () => {
        setMetrics(DEFAULT_TEXT_METRICS);
    };

    const handleMetricChange = useCallback((field: keyof TextLayoutMetrics, val: number | boolean) => {
        setMetrics(prev => ({ ...prev, [field]: val }));
    }, []);

    const handleMetricReset = useCallback((field: keyof TextLayoutMetrics) => {
        setMetrics(prev => ({ ...prev, [field]: DEFAULT_TEXT_METRICS[field] }));
    }, []);

    const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (ev) => {
            if (ev.target?.result) {
                const img = new Image();
                img.onload = () => {
                    setBgImage({
                        url: ev.target!.result as string,
                        x: 120, y: 200,
                        width: img.width, 
                        height: img.height,
                        opacity: 0.45,
                        originalWidth: img.width,
                        originalHeight: img.height
                    });
                    setViewMode('focus');
                };
                img.src = ev.target!.result as string;
            }
        };
        reader.readAsDataURL(file);
    };

    const handleScaleChange = (scale: number) => {
        if (!bgImage) return;
        updateBgImage({
            width: bgImage.originalWidth * scale,
            height: bgImage.originalHeight * scale
        });
    };

    const handleExportDiff = () => {
        const diff: Partial<TextLayoutMetrics> = {};
        let hasChanges = false;
        (Object.keys(metrics) as Array<keyof TextLayoutMetrics>).forEach(key => {
            if (metrics[key] !== DEFAULT_TEXT_METRICS[key]) {
                // @ts-ignore
                diff[key] = metrics[key];
                hasChanges = true;
            }
        });
        const json = JSON.stringify(hasChanges ? diff : metrics, null, 2);
        navigator.clipboard.writeText(json);
    };

    const currentImageScale = bgImage ? bgImage.width / bgImage.originalWidth : 1;
    const inkColor = lightPaper ? '#0f172a' : '#f8fafc';
    const cardBg = lightPaper ? '#ffffff' : '#111827';
    const cardBorder = lightPaper ? '#e2e8f0' : '#1f2937';
    const subTextColor = lightPaper ? '#64748b' : '#94a3b8';

    // Calculate dynamic vertical positions for the Benchmark Suite on the SVG canvas
    const suiteLayout = useMemo(() => {
        let currentY = 85;
        return benchmarks.map((item, idx) => {
            const measured = tex.measure(item.latex, fontSize);
            const ascent = Math.max(fontSize * 0.9, measured.box.ascent);
            const descent = Math.max(fontSize * 0.45, measured.box.descent);
            const topPad = 44;
            const botPad = 26;
            const cardHeight = Math.max(115, topPad + ascent + descent + botPad);
            const baselineY = currentY + topPad + ascent;
            const mathAxisY = baselineY - fontSize * metrics.axisHeight;
            const cardY = currentY;
            currentY += cardHeight + 18;

            return {
                item,
                index: idx + 1,
                cardY,
                cardHeight,
                baselineY,
                mathAxisY,
                measuredWidth: measured.width,
                ascent: measured.box.ascent,
                descent: measured.box.descent
            };
        });
    }, [benchmarks, tex, fontSize, metrics.axisHeight]);

    const dynamicCanvasHeight = Math.max(
        heightPixels,
        viewMode === 'suite' && suiteLayout.length > 0
            ? suiteLayout[suiteLayout.length - 1].cardY + suiteLayout[suiteLayout.length - 1].cardHeight + 80
            : heightPixels
    );

    const TuneTabButton = ({ id, label }: { id: typeof activeTuneTab, label: string }) => (
        <button 
            onClick={() => setActiveTuneTab(id)} 
            className={`flex-1 py-1.5 text-[10px] uppercase font-bold border-b-2 transition-colors ${activeTuneTab === id ? 'border-emerald-500 text-emerald-400 bg-emerald-500/10' : 'border-transparent text-gray-500 hover:text-gray-300'}`}
        >
            {label}
        </button>
    );

    return (
        <div 
            className="flex h-full bg-gray-900 text-white overflow-hidden" 
            onMouseMove={handleCanvasMouseMove} 
            onMouseUp={handleCanvasMouseUp}
        >
            {/* Left Sidebar */}
            {!sidebarCollapsed && (
            <aside className="w-88 border-r border-gray-800 flex flex-col h-full bg-gray-950 z-20 shrink-0">
                {/* Header */}
                <div className="p-3.5 border-b border-gray-800 flex justify-between items-center bg-gray-900/60">
                    <h1 className="text-sm font-bold flex items-center gap-2 text-white">
                        <FlaskConical size={16} className="text-emerald-400" />
                        Math &amp; Text Testing Ground
                    </h1>
                    <button
                        onClick={() => {
                            handleResetSuite();
                            handleResetMetrics();
                        }}
                        title="Reset Suite & Metrics to Defaults"
                        className="text-gray-400 hover:text-white flex items-center gap-1 text-[11px] px-2 py-1 rounded bg-gray-800 hover:bg-gray-700"
                    >
                        <RotateCcw size={12} /> Reset
                    </button>
                </div>

                {/* Primary Sidebar Mode Switcher */}
                <div className="grid grid-cols-2 p-2 gap-1.5 bg-gray-900 border-b border-gray-800">
                    <button
                        onClick={() => setSidebarMode('examples')}
                        className={`flex items-center justify-center gap-1.5 py-1.5 rounded text-xs font-semibold transition-colors ${
                            sidebarMode === 'examples'
                                ? 'bg-emerald-600 text-white shadow'
                                : 'bg-gray-800 text-gray-400 hover:text-gray-200'
                        }`}
                    >
                        <Type size={13} /> Test Suite &amp; Editor
                    </button>
                    <button
                        onClick={() => setSidebarMode('tuning')}
                        className={`flex items-center justify-center gap-1.5 py-1.5 rounded text-xs font-semibold transition-colors ${
                            sidebarMode === 'tuning'
                                ? 'bg-blue-600 text-white shadow'
                                : 'bg-gray-800 text-gray-400 hover:text-gray-200'
                        }`}
                    >
                        <Sliders size={13} /> Live Metric Sliders
                    </button>
                </div>

                {/* Live Expression Editor (Always visible at top of sidebar) */}
                <div className="p-3.5 border-b border-gray-800 bg-gray-900/40 space-y-2.5">
                    <div className="flex items-center justify-between">
                        <label className="text-[11px] font-bold text-emerald-400 uppercase tracking-wider">
                            Active Expression ({selectedBenchmark.title})
                        </label>
                        <span className="text-[10px] text-gray-500 font-mono">
                            {customInput.includes('$') ? 'Mixed $...$' : 'Math Mode'}
                        </span>
                    </div>
                    <textarea
                        value={customInput}
                        onChange={(e) => handleUpdateSelectedLatex(e.target.value)}
                        placeholder="Enter LaTeX e.g. $x = \frac{-b \pm \sqrt{b^2 - 4ac}}{2a}$"
                        className="w-full h-16 bg-gray-900 border border-gray-700 focus:border-emerald-500 rounded-md p-2 text-xs text-white font-mono focus:outline-none resize-none"
                    />
                    <div className="flex items-center gap-2">
                        <input
                            type="text"
                            value={newTitle}
                            onChange={(e) => setNewTitle(e.target.value)}
                            placeholder="New test case title (optional)..."
                            className="flex-1 bg-gray-900 border border-gray-800 rounded px-2 py-1 text-xs text-gray-200 focus:outline-none focus:border-gray-600"
                        />
                        <button
                            onClick={handleAddCustomBenchmark}
                            className="px-2.5 py-1 bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 border border-emerald-500/40 rounded text-xs font-semibold flex items-center gap-1 shrink-0"
                        >
                            <Plus size={12} /> Add to Suite
                        </button>
                    </div>

                    {/* Font Size Quick Bar */}
                    <div className="pt-1">
                        <div className="flex justify-between items-center text-[11px] text-gray-400 mb-1">
                            <span>Render Font Size</span>
                            <div className="flex items-center gap-1">
                                {[20, 28, 32, 40, 52].map(sz => (
                                    <button
                                        key={sz}
                                        onClick={() => setFontSize(sz)}
                                        className={`px-1.5 py-0.5 rounded text-[10px] font-mono ${
                                            fontSize === sz
                                                ? 'bg-emerald-600 text-white font-bold'
                                                : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
                                        }`}
                                    >
                                        {sz}px
                                    </button>
                                ))}
                            </div>
                        </div>
                        <input
                            type="range"
                            min="14"
                            max="72"
                            step="1"
                            value={fontSize}
                            onChange={(e) => setFontSize(parseFloat(e.target.value))}
                            className="w-full h-1 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-emerald-500"
                        />
                    </div>
                </div>

                {/* Sidebar Body */}
                {sidebarMode === 'examples' ? (
                    <div className="flex-1 overflow-y-auto custom-scrollbar p-3 space-y-2">
                        <div className="flex items-center justify-between px-1 mb-1">
                            <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400">
                                Benchmark Formulas ({benchmarks.length})
                            </span>
                            <span className="text-[10px] text-gray-500">
                                Click to edit or inspect
                            </span>
                        </div>
                        {benchmarks.map((item, idx) => {
                            const isSelected = item.id === selectedId;
                            return (
                                <div
                                    key={item.id}
                                    onClick={() => handleSelectBenchmark(item)}
                                    className={`p-2.5 rounded-lg border transition-all cursor-pointer ${
                                        isSelected
                                            ? 'bg-emerald-950/40 border-emerald-500/70 shadow-sm'
                                            : 'bg-gray-900/70 border-gray-800 hover:border-gray-700 hover:bg-gray-900'
                                    }`}
                                >
                                    <div className="flex items-center justify-between mb-1">
                                        <div className="flex items-center gap-2">
                                            <span className={`w-5 h-5 rounded-full text-[10px] font-bold flex items-center justify-center ${
                                                isSelected ? 'bg-emerald-500 text-gray-950' : 'bg-gray-800 text-gray-400'
                                            }`}>
                                                {idx + 1}
                                            </span>
                                            <span className="text-xs font-semibold text-gray-100">
                                                {item.title}
                                            </span>
                                        </div>
                                        <span className="text-[9px] px-1.5 py-0.5 rounded bg-gray-800 text-gray-400 border border-gray-700">
                                            {item.category}
                                        </span>
                                    </div>
                                    <div className="text-[11px] font-mono text-emerald-300/90 bg-gray-950/80 px-2 py-1 rounded border border-gray-800/80 truncate mb-1">
                                        {item.latex}
                                    </div>
                                    <div className="flex items-center justify-between text-[10px] text-gray-400">
                                        <span className="truncate pr-2">{item.notes}</span>
                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                handleSelectBenchmark(item);
                                                setViewMode('focus');
                                            }}
                                            className="text-emerald-400 hover:text-emerald-300 font-semibold shrink-0 underline"
                                        >
                                            Focus
                                        </button>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                ) : (
                    <>
                        <div className="flex flex-wrap border-b border-gray-800 bg-gray-900/50">
                            <TuneTabButton id="frac" label="Frac" />
                            <TuneTabButton id="script" label="Power" />
                            <TuneTabButton id="surd" label="Surd" />
                            <TuneTabButton id="delim" label="Bracket" />
                            <TuneTabButton id="spacing" label="Space" />
                            <TuneTabButton id="global" label="Global" />
                            <TuneTabButton id="ref" label="Overlay" />
                        </div>

                        <div className="flex-1 overflow-y-auto custom-scrollbar p-4 space-y-4">
                            {activeTuneTab === 'frac' && (
                                <>
                                    <h4 className="text-[10px] font-bold text-emerald-400 uppercase mb-2">Fractions (TeX Rule 15)</h4>
                                    <MetricControl label="Axis Height (Bar Center)" field="axisHeight" value={metrics.axisHeight} onChange={handleMetricChange} onReset={handleMetricReset} min={0} max={0.6} />
                                    <MetricControl label="Numerator Min Shift Up" field="fracNumShift" value={metrics.fracNumShift} onChange={handleMetricChange} onReset={handleMetricReset} min={0.1} max={0.9} />
                                    <MetricControl label="Denominator Min Shift Down" field="fracDenShift" value={metrics.fracDenShift} onChange={handleMetricChange} onReset={handleMetricReset} min={0.1} max={0.9} />
                                    <MetricControl label="Min Bar Clearance Gap" field="fracGap" value={metrics.fracGap} onChange={handleMetricChange} onReset={handleMetricReset} min={0.02} max={0.35} />
                                    <MetricControl label="Bar Thickness" field="fracRuleThickness" value={metrics.fracRuleThickness} onChange={handleMetricChange} onReset={handleMetricReset} min={0.02} max={0.12} />
                                    <MetricControl label="Horizontal Overhang Padding" field="fracPadding" value={metrics.fracPadding} onChange={handleMetricChange} onReset={handleMetricReset} min={0} max={0.3} />
                                </>
                            )}

                            {activeTuneTab === 'script' && (
                                <>
                                    <h4 className="text-[10px] font-bold text-emerald-400 uppercase mb-2">Powers &amp; Subscripts (TeX Rule 18)</h4>
                                    <MetricControl label="Script Size Scale" field="scriptScale" value={metrics.scriptScale} onChange={handleMetricChange} onReset={handleMetricReset} min={0.4} max={0.9} />
                                    <MetricControl label="Script-of-Script Scale" field="scriptScriptScale" value={metrics.scriptScriptScale} onChange={handleMetricChange} onReset={handleMetricReset} min={0.3} max={0.8} />
                                    <MetricControl label="Superscript Shift Up" field="supShift" value={metrics.supShift} onChange={handleMetricChange} onReset={handleMetricReset} min={0.15} max={0.75} />
                                    <MetricControl label="Superscript Min Bottom" field="supMinHeight" value={metrics.supMinHeight} onChange={handleMetricChange} onReset={handleMetricReset} min={0.05} max={0.6} />
                                    <MetricControl label="Subscript Shift Down" field="subShift" value={metrics.subShift} onChange={handleMetricChange} onReset={handleMetricReset} min={0.05} max={0.6} />
                                    <MetricControl label="Subscript Drop" field="subDrop" value={metrics.subDrop} onChange={handleMetricChange} onReset={handleMetricReset} min={0} max={0.4} />
                                    <MetricControl label="Sup-Sub Min Vertical Gap" field="supSubGapMin" value={metrics.supSubGapMin} onChange={handleMetricChange} onReset={handleMetricReset} min={0.05} max={0.4} />
                                    <MetricControl label="Horizontal Gap Before Script" field="scriptHorizontalGap" value={metrics.scriptHorizontalGap} onChange={handleMetricChange} onReset={handleMetricReset} min={-0.05} max={0.15} />
                                </>
                            )}

                            {activeTuneTab === 'surd' && (
                                <>
                                    <h4 className="text-[10px] font-bold text-emerald-400 uppercase mb-2">Radicals / Surds (TeX Rule 11)</h4>
                                    <MetricControl label="Vinculum Inner Gap" field="sqrtGap" value={metrics.sqrtGap} onChange={handleMetricChange} onReset={handleMetricReset} min={0.02} max={0.35} />
                                    <MetricControl label="Rule Thickness" field="sqrtRuleThickness" value={metrics.sqrtRuleThickness} onChange={handleMetricChange} onReset={handleMetricReset} min={0.02} max={0.12} />
                                    <MetricControl label="Valley Cushion Extra" field="sqrtExtraHeight" value={metrics.sqrtExtraHeight} onChange={handleMetricChange} onReset={handleMetricReset} min={0} max={0.3} />
                                    <MetricControl label="Vinculum Vertical Shift" field="sqrtVerticalShift" value={metrics.sqrtVerticalShift} onChange={handleMetricChange} onReset={handleMetricReset} min={-0.25} max={0.25} />
                                </>
                            )}

                            {activeTuneTab === 'delim' && (
                                <>
                                    <h4 className="text-[10px] font-bold text-emerald-400 uppercase mb-2">Brackets (TeX Rule 19)</h4>
                                    <MetricControl label="Coverage Factor" field="delimFactor" value={metrics.delimFactor} onChange={handleMetricChange} onReset={handleMetricReset} min={0.7} max={1.1} />
                                    <MetricControl label="Max Shortfall" field="delimMaxShortfall" value={metrics.delimMaxShortfall} onChange={handleMetricChange} onReset={handleMetricReset} min={0} max={0.35} />
                                </>
                            )}

                            {activeTuneTab === 'spacing' && (
                                <>
                                    <h4 className="text-[10px] font-bold text-emerald-400 uppercase mb-2">Horizontal Inter-Atom Glue</h4>
                                    <MetricControl label="Ord - Bin (a +)" field="glueOrdBin" value={metrics.glueOrdBin} onChange={handleMetricChange} onReset={handleMetricReset} min={0} max={0.5} />
                                    <MetricControl label="Bin - Ord (+ b)" field="glueBinOrd" value={metrics.glueBinOrd} onChange={handleMetricChange} onReset={handleMetricReset} min={0} max={0.5} />
                                    <MetricControl label="Ord - Rel (x =)" field="glueOrdRel" value={metrics.glueOrdRel} onChange={handleMetricChange} onReset={handleMetricReset} min={0} max={0.5} />
                                    <MetricControl label="Rel - Ord (= y)" field="glueRelOrd" value={metrics.glueRelOrd} onChange={handleMetricChange} onReset={handleMetricReset} min={0} max={0.5} />
                                    <MetricControl label="After Punctuation (x, y)" field="glueOrdPunct" value={metrics.glueOrdPunct} onChange={handleMetricChange} onReset={handleMetricReset} min={0} max={0.5} />
                                </>
                            )}

                            {activeTuneTab === 'global' && (
                                <>
                                    <h4 className="text-[10px] font-bold text-emerald-400 uppercase mb-2">Global &amp; Operator Alignment</h4>
                                    <MetricControl label="Math Axis Height" field="axisHeight" value={metrics.axisHeight} onChange={handleMetricChange} onReset={handleMetricReset} min={0.1} max={0.45} />
                                    <MetricControl label="Operator Vertical Shift (+ - =)" field="operatorShift" value={metrics.operatorShift} onChange={handleMetricChange} onReset={handleMetricReset} min={-0.25} max={0.15} />
                                    <MetricControl label="Default Italic Correction" field="italicCorrectionDefault" value={metrics.italicCorrectionDefault} onChange={handleMetricChange} onReset={handleMetricReset} min={0} max={0.15} />
                                    <label className="flex items-center gap-2 text-xs text-gray-300 cursor-pointer pt-2">
                                        <input 
                                            type="checkbox" 
                                            checked={metrics.autoCenterOperators} 
                                            onChange={(e) => handleMetricChange('autoCenterOperators', e.target.checked)}
                                            className="rounded border-gray-600 bg-gray-800 text-emerald-500"
                                        />
                                        Symmetric Operator Glue
                                    </label>
                                </>
                            )}

                            {activeTuneTab === 'ref' && (
                                <div className="space-y-4">
                                    <label className="block text-xs font-bold text-gray-400 uppercase">Reference Image (Focus Mode)</label>
                                    {!bgImage ? (
                                        <label className="flex flex-col items-center justify-center p-6 border-2 border-dashed border-gray-700 rounded-lg cursor-pointer hover:bg-gray-800 transition-colors">
                                            <Upload size={24} className="text-gray-500 mb-2" />
                                            <span className="text-xs text-gray-400">Upload Reference Screenshot</span>
                                            <input type="file" accept="image/*" className="hidden" onChange={handleImageUpload} />
                                        </label>
                                    ) : (
                                        <div className="bg-gray-900 border border-gray-800 rounded p-3 space-y-3">
                                            <div className="flex justify-between items-center">
                                                <span className="text-[10px] text-emerald-400 font-bold uppercase">Image Active</span>
                                                <button onClick={() => setBgImage(null)} className="text-red-500 hover:text-red-400"><Trash2 size={14}/></button>
                                            </div>
                                            <div>
                                                <label className="block text-[10px] text-gray-500 mb-1">Opacity: {Math.round(bgImage.opacity * 100)}%</label>
                                                <input 
                                                    type="range" min="0" max="1" step="0.05"
                                                    value={bgImage.opacity}
                                                    onChange={(e) => updateBgImage({ opacity: parseFloat(e.target.value) })}
                                                    className="w-full h-1 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-emerald-500"
                                                />
                                            </div>
                                            <div>
                                                <label className="flex justify-between text-[10px] text-gray-500 mb-1">
                                                    <span>Scale</span>
                                                    <span className="text-blue-400">{currentImageScale.toFixed(2)}x</span>
                                                </label>
                                                <div className="flex items-center gap-2">
                                                    <Move size={12} className="text-gray-500"/>
                                                    <input 
                                                        type="range" min="0.1" max="3" step="0.01"
                                                        value={currentImageScale}
                                                        onChange={(e) => handleScaleChange(parseFloat(e.target.value))}
                                                        className="w-full h-1 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-blue-500"
                                                    />
                                                    <Maximize size={12} className="text-gray-500"/>
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>

                        <div className="p-3 border-t border-gray-800 bg-gray-900">
                            <button 
                                onClick={handleExportDiff}
                                className="w-full py-2 bg-blue-600 hover:bg-blue-500 text-white rounded text-xs font-bold flex items-center justify-center gap-2"
                            >
                                <Copy size={14} /> Copy Metrics JSON
                            </button>
                        </div>
                    </>
                )}
            </aside>
            )}

            {/* Main Testing Ground Canvas */}
            <main className="flex-1 min-w-0 flex flex-col relative bg-gray-900 overflow-hidden">
                {/* Top Diagnostic Bar */}
                <header className="w-full z-10 px-4 py-2.5 bg-gray-950 border-b border-gray-800 flex flex-wrap items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                        {/* Sidebar Collapse Toggle */}
                        <button
                            onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
                            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-gray-800 bg-gray-900 text-gray-300 hover:bg-gray-800 text-xs font-medium"
                            title={sidebarCollapsed ? 'Show Sidebar' : 'Hide Sidebar'}
                        >
                            {sidebarCollapsed ? <PanelLeftOpen size={14} className="text-emerald-400" /> : <PanelLeftClose size={14} className="text-gray-400" />}
                            {sidebarCollapsed ? 'Show Controls' : 'Hide Controls'}
                        </button>

                        {/* View Mode Switcher */}
                        <div className="flex bg-gray-900 p-0.5 rounded-lg border border-gray-800">
                            <button
                                onClick={() => setViewMode('suite')}
                                className={`flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-semibold transition-colors ${
                                    viewMode === 'suite'
                                        ? 'bg-emerald-600 text-white'
                                        : 'text-gray-400 hover:text-gray-200'
                                }`}
                            >
                                <LayoutGrid size={13} /> Benchmark Suite ({benchmarks.length})
                            </button>
                            <button
                                onClick={() => setViewMode('focus')}
                                className={`flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-semibold transition-colors ${
                                    viewMode === 'focus'
                                        ? 'bg-emerald-600 text-white'
                                        : 'text-gray-400 hover:text-gray-200'
                                }`}
                            >
                                <Focus size={13} /> Single Formula Inspector
                            </button>
                        </div>

                        {/* Diagnostic Toggles */}
                        <button 
                            onClick={() => setShowAxisGuides(!showAxisGuides)}
                            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-xs font-medium transition-colors ${
                                showAxisGuides
                                    ? 'bg-cyan-950/60 border-cyan-500/60 text-cyan-200'
                                    : 'bg-gray-900 border-gray-800 text-gray-400 hover:bg-gray-800'
                            }`}
                            title="Show Main Baseline (Green) & Math Axis (Cyan)"
                        >
                            <AlignCenterHorizontal size={13} /> Axis &amp; Baseline Guides
                        </button>

                        <button 
                            onClick={() => setShowBoundingBoxes(!showBoundingBoxes)}
                            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-xs font-medium transition-colors ${
                                showBoundingBoxes
                                    ? 'bg-red-950/60 border-red-500/60 text-red-200'
                                    : 'bg-gray-900 border-gray-800 text-gray-400 hover:bg-gray-800'
                            }`}
                        >
                            <Scan size={13} /> Bounding Boxes
                        </button>

                        <button
                            onClick={() => setLightPaper(!lightPaper)}
                            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-gray-800 bg-gray-900 text-gray-300 hover:bg-gray-800 text-xs font-medium"
                        >
                            {lightPaper ? <Sun size={13} className="text-amber-400" /> : <Moon size={13} className="text-blue-400" />}
                            {lightPaper ? 'Light Paper' : 'Dark Canvas'}
                        </button>
                    </div>

                    <div className="bg-gray-900 border border-gray-800 rounded-lg p-0.5">
                        <GraphToolbar 
                            previewScale={previewScale} setPreviewScale={setPreviewScale}
                            cropMode={cropMode} setCropMode={setCropMode}
                            onResetView={handleResetView} onAutoCrop={handleAutoCrop}
                            onExportPNG={handleExportPNG} onExportSVG={handleExportSVG}
                            onCopy={() => {}}
                        />
                    </div>
                </header>

                {/* Scrollable SVG Viewport */}
                <div ref={containerRef} className="flex-1 overflow-auto p-6 bg-gray-800/90">
                    <div
                        className="mx-auto"
                        style={{
                            width: widthPixels * previewScale,
                            height: dynamicCanvasHeight * previewScale
                        }}
                    >
                        <div 
                            className={`shadow-2xl transition-all duration-150 relative ${cropMode ? 'cursor-crosshair' : 'cursor-default'}`}
                            style={{ 
                                transform: `scale(${previewScale})`, 
                                transformOrigin: 'top left',
                                width: widthPixels,
                                height: dynamicCanvasHeight
                            }}
                            onMouseDown={handleCanvasMouseDown}
                        >
                        <svg 
                            id="text-calib-svg"
                            width={widthPixels} 
                            height={dynamicCanvasHeight} 
                            viewBox={`0 0 ${widthPixels} ${dynamicCanvasHeight}`}
                            xmlns="http://www.w3.org/2000/svg"
                            style={{ display: 'block', backgroundColor: lightPaper ? '#f8fafc' : '#090d16' }}
                        >
                            {/* Subtle Grid Pattern */}
                            <defs>
                                <pattern id="calib-grid" width="40" height="40" patternUnits="userSpaceOnUse">
                                    <path
                                        d="M 40 0 L 0 0 0 40"
                                        fill="none"
                                        stroke={lightPaper ? 'rgba(15,23,42,0.04)' : 'rgba(255,255,255,0.04)'}
                                        strokeWidth="1"
                                    />
                                </pattern>
                            </defs>
                            <rect width="100%" height="100%" fill="url(#calib-grid)" />

                            {viewMode === 'suite' ? (
                                <g>
                                    {/* Sheet Header */}
                                    <text
                                        x={48}
                                        y={42}
                                        fontSize={18}
                                        fontFamily="sans-serif"
                                        fontWeight="bold"
                                        fill={inkColor}
                                    >
                                        Math &amp; LaTeX Rendering Benchmark Suite (Font Size: {fontSize}px)
                                    </text>
                                    {showAxisGuides && (
                                        <g transform="translate(620, 28)">
                                            <line x1={0} y1={8} x2={28} y2={8} stroke="#10b981" strokeWidth={1.5} strokeDasharray="5,3" />
                                            <text x={34} y={12} fontSize={12} fontFamily="sans-serif" fill={subTextColor}>
                                                Main Baseline (y = 0)
                                            </text>
                                            <line x1={185} y1={8} x2={213} y2={8} stroke="#06b6d4" strokeWidth={1.5} strokeDasharray="2,3" />
                                            <text x={219} y={12} fontSize={12} fontFamily="sans-serif" fill={subTextColor}>
                                                Math Axis (y - {metrics.axisHeight}em: fraction bars, =, +, brackets)
                                            </text>
                                        </g>
                                    )}

                                    {/* Benchmark Cards */}
                                    {suiteLayout.map(({ item, index, cardY, cardHeight, baselineY, mathAxisY }) => {
                                        const isSelected = item.id === selectedId;
                                        const renderX = 76;
                                        return (
                                            <g
                                                key={item.id}
                                                onClick={() => handleSelectBenchmark(item)}
                                                style={{ cursor: 'pointer' }}
                                            >
                                                {/* Card Container */}
                                                <rect
                                                    x={40}
                                                    y={cardY}
                                                    width={widthPixels - 80}
                                                    height={cardHeight}
                                                    rx={10}
                                                    fill={cardBg}
                                                    stroke={isSelected ? '#10b981' : cardBorder}
                                                    strokeWidth={isSelected ? 2 : 1}
                                                />

                                                {/* Card Header Metadata */}
                                                <text
                                                    x={60}
                                                    y={cardY + 24}
                                                    fontSize={13}
                                                    fontFamily="sans-serif"
                                                    fontWeight="bold"
                                                    fill={isSelected ? '#10b981' : subTextColor}
                                                >
                                                    #{index}  {item.title}  —  {item.notes}
                                                </text>

                                                <text
                                                    x={widthPixels - 60}
                                                    y={cardY + 24}
                                                    fontSize={11}
                                                    fontFamily="monospace"
                                                    textAnchor="end"
                                                    fill={subTextColor}
                                                >
                                                    {item.latex}
                                                </text>

                                                {/* Baseline & Math Axis Reference Guides */}
                                                {showAxisGuides && (
                                                    <g>
                                                        {/* Main Baseline (y = 0) */}
                                                        <line
                                                            x1={56}
                                                            y1={baselineY}
                                                            x2={widthPixels - 56}
                                                            y2={baselineY}
                                                            stroke="rgba(16, 185, 129, 0.35)"
                                                            strokeWidth={1}
                                                            strokeDasharray="6,4"
                                                        />
                                                        {/* Math Axis (y - axisHeight * fontSize) */}
                                                        <line
                                                            x1={56}
                                                            y1={mathAxisY}
                                                            x2={widthPixels - 56}
                                                            y2={mathAxisY}
                                                            stroke="rgba(6, 182, 212, 0.40)"
                                                            strokeWidth={1}
                                                            strokeDasharray="2,3"
                                                        />
                                                        <circle cx={renderX} cy={baselineY} r={3} fill="#10b981" opacity={0.7} />
                                                    </g>
                                                )}

                                                {/* Rendered Formula */}
                                                {tex.renderToSVG(
                                                    item.latex,
                                                    renderX,
                                                    baselineY,
                                                    fontSize,
                                                    inkColor,
                                                    'start',
                                                    false,
                                                    item.mode,
                                                    showBoundingBoxes
                                                )}
                                            </g>
                                        );
                                    })}
                                </g>
                            ) : (
                                <g>
                                    {/* Focus Mode: Optional Reference Image */}
                                    {bgImage && (
                                        <image 
                                            href={bgImage.url} 
                                            x={bgImage.x} y={bgImage.y} 
                                            width={bgImage.width} height={bgImage.height} 
                                            opacity={bgImage.opacity}
                                            style={{ cursor: 'move' }}
                                            onMouseDown={handleImageDrag}
                                        />
                                    )}

                                    {/* Focus Mode Axis Guides */}
                                    {showAxisGuides && (
                                        <g>
                                            <line
                                                x1={0}
                                                y1={textPos.y}
                                                x2={widthPixels}
                                                y2={textPos.y}
                                                stroke="rgba(16, 185, 129, 0.45)"
                                                strokeWidth="1.2"
                                                strokeDasharray="6,4"
                                            />
                                            <line
                                                x1={0}
                                                y1={textPos.y - fontSize * 1.4 * metrics.axisHeight}
                                                x2={widthPixels}
                                                y2={textPos.y - fontSize * 1.4 * metrics.axisHeight}
                                                stroke="rgba(6, 182, 212, 0.45)"
                                                strokeWidth="1.2"
                                                strokeDasharray="2,3"
                                            />
                                            <line
                                                x1={textPos.x}
                                                y1={0}
                                                x2={textPos.x}
                                                y2={dynamicCanvasHeight}
                                                stroke="rgba(16, 185, 129, 0.25)"
                                                strokeWidth="1"
                                            />
                                        </g>
                                    )}

                                    {/* Focused Formula Group */}
                                    <g 
                                        transform={`translate(${textPos.x}, ${textPos.y})`}
                                        style={{ cursor: 'move' }}
                                        onMouseDown={handleTextDrag}
                                    >
                                        <circle cx="0" cy="0" r="4" fill="#10b981" opacity="0.75" />
                                        {tex.renderToSVG(
                                            customInput,
                                            0,
                                            0,
                                            fontSize * 1.4,
                                            inkColor,
                                            'start',
                                            false,
                                            customInput.includes('$') ? 'text' : 'math',
                                            showBoundingBoxes
                                        )}
                                    </g>
                                </g>
                            )}
                        </svg>
                        </div>
                    </div>
                </div>
            </main>
        </div>
    );
};

export default TextCalibration;
