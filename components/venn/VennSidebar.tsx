import React from 'react';
import {
  Square,
  List,
  Sliders,
  Palette,
  PaintBucket,
  Calculator,
  Grid,
  Check,
  AlertCircle,
  RotateCcw,
  Eye,
  EyeOff,
  HelpCircle,
  Sparkles,
  Layers,
  Maximize2,
  Minimize2
} from 'lucide-react';
import { PatternType } from '../../types';
import {
  VennState,
  VennSetDef,
  VennRegionDef,
  VennShapeType,
  VennTopologyPreset,
  VennSizePreset,
  InputMethod,
  VENN_SIZE_PRESETS,
  GREYSCALE_SWATCHES,
  PATTERN_OPTIONS
} from '../../utils/vennLogic';

interface VennSidebarProps {
  state: VennState;
  activeTab: 'data' | 'shading' | 'style';
  setActiveTab: (tab: 'data' | 'shading' | 'style') => void;
  inputMethod: InputMethod;
  setInputMethod: (m: InputMethod) => void;
  activeSets: VennSetDef[];
  totalRegions: number;
  computedTotals: { setSums: (number | null)[]; grandTotal: number | null };
  regionCenters: Record<number, { x: number; y: number; exists: boolean }>;
  highlightedControlId: string | null;
  setExpressionInput: string;
  setSetExpressionInput: React.Dispatch<React.SetStateAction<string>>;
  expressionError: string | null;
  solverMessage: { type: 'ok' | 'warn'; text: string } | null;
  shadingPresets: { label: string; expr: string }[];
  getRegionMeta: (mask: number) => { notation: string; math: string; desc: string };
  formatDisplayValue: (rawVal: string | number | null) => string;
  forceSnapshot: () => void;
  updateState: (updater: (prev: VennState) => VennState) => void;
  updateSet: (id: number, updates: Partial<VennSetDef>) => void;
  updateRegion: (mask: number, updates: Partial<VennRegionDef>) => void;
  handleSelectNumSets: (n: 1 | 2 | 3) => void;
  handleSelectShapeType: (shapeType: VennShapeType) => void;
  handleSelectTopology: (topology: VennTopologyPreset) => void;
  handleNormalizeRegionsToProbabilities: () => void;
  handleSolveTotals: () => void;
  applyElementLists: (listsOverride?: VennState['elementLists']) => void;
  handleApplySetExpression: (exprOverride?: string) => void;
  handleApplySizePreset: (presetKey: VennSizePreset) => void;
  handleResizeBoxCm: (dWidthCm: number, dHeightCm: number) => void;
  handleFitShapesInsideBorder: () => void;
  handleFitBorderToShapes: () => void;
}

export const VennSidebar: React.FC<VennSidebarProps> = ({
  state,
  activeTab,
  setActiveTab,
  inputMethod,
  setInputMethod,
  activeSets,
  totalRegions,
  computedTotals,
  regionCenters,
  highlightedControlId,
  setExpressionInput,
  setSetExpressionInput,
  expressionError,
  solverMessage,
  shadingPresets,
  getRegionMeta,
  formatDisplayValue,
  forceSnapshot,
  updateState,
  updateSet,
  updateRegion,
  handleSelectNumSets,
  handleSelectShapeType,
  handleSelectTopology,
  handleNormalizeRegionsToProbabilities,
  handleSolveTotals,
  applyElementLists,
  handleApplySetExpression,
  handleApplySizePreset,
  handleResizeBoxCm,
  handleFitShapesInsideBorder,
  handleFitBorderToShapes
}) => {
  return (
    <aside className="w-80 bg-white border-r border-gray-200 flex flex-col h-full z-20 shadow-sm tool-sidebar">
      {/* Top Structure Bar (Number of Sets & Shape Type) */}
      <div className="p-2.5 bg-gray-50 border-b border-gray-200 space-y-2.5">
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="block text-[11px] font-bold text-gray-500 uppercase tracking-wider mb-1">
              Number of Sets
            </label>
            <div className="grid grid-cols-3 bg-white rounded-md border border-gray-300 p-0.5">
              {([1, 2, 3] as const).map(n => (
                <button
                  key={n}
                  onClick={() => handleSelectNumSets(n)}
                  className={`py-1 text-xs font-semibold rounded transition-colors ${
                    state.numSets === n
                      ? 'bg-gray-800 text-white'
                      : 'text-gray-600 hover:bg-gray-100'
                  }`}
                >
                  {n} {n === 1 ? 'Set' : 'Sets'}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-[11px] font-bold text-gray-500 uppercase tracking-wider mb-1">
              Set Shape Style
            </label>
            <div className="grid grid-cols-3 bg-white rounded-md border border-gray-300 p-0.5">
              <button
                onClick={() => handleSelectShapeType('circle')}
                className={`py-1 text-xs font-semibold rounded flex items-center justify-center gap-1 transition-colors ${
                  state.shapeType === 'circle'
                    ? 'bg-gray-800 text-white'
                    : 'text-gray-600 hover:bg-gray-100'
                }`}
              >
                Circles
              </button>
              <button
                onClick={() => handleSelectShapeType('ellipse')}
                className={`py-1 text-xs font-semibold rounded flex items-center justify-center gap-1 transition-colors ${
                  state.shapeType === 'ellipse'
                    ? 'bg-gray-800 text-white'
                    : 'text-gray-600 hover:bg-gray-100'
                }`}
              >
                Ellipses
              </button>
              <button
                onClick={() => handleSelectShapeType('rectangle')}
                className={`py-1 text-xs font-semibold rounded flex items-center justify-center gap-1 transition-colors ${
                  state.shapeType === 'rectangle'
                    ? 'bg-gray-800 text-white'
                    : 'text-gray-600 hover:bg-gray-100'
                }`}
              >
                Rects
              </button>
            </div>
          </div>
        </div>

        {/* Topology / Relationship Presets */}
        {state.numSets >= 2 && (
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-[11px] font-bold text-gray-500 uppercase tracking-wider">
                Set Relationship / Layout Preset
              </label>
              <button
                onClick={() => handleSelectTopology(state.topology)}
                className="text-[11px] text-gray-600 hover:text-black flex items-center gap-1"
                title="Reset positions to preset"
              >
                <RotateCcw size={11} /> Reset Positions
              </button>
            </div>
            {state.numSets === 2 ? (
              <div className="grid grid-cols-2 gap-1.5">
                {[
                  { id: 'standard', label: 'Overlapping (A ∩ B)' },
                  { id: 'disjoint', label: 'Disjoint (A ∩ B = ∅)' },
                  { id: 'subset-b-in-a', label: 'Subset (B ⊂ A)' },
                  { id: 'subset-a-in-b', label: 'Subset (A ⊂ B)' }
                ].map(p => (
                  <button
                    key={p.id}
                    onClick={() => handleSelectTopology(p.id as VennTopologyPreset)}
                    className={`px-2 py-1.5 text-xs font-medium rounded border text-left transition-colors ${
                      state.topology === p.id
                        ? 'bg-gray-800 text-white border-gray-800'
                        : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-100'
                    }`}
                  >
                    {p.label}
                  </button>
                ))}
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-1.5">
                {[
                  { id: 'standard', label: 'Standard 3-Way' },
                  { id: 'disjoint', label: 'All Disjoint' },
                  { id: 'chain', label: 'Chain (A–B–C)' },
                  { id: 'nested-all', label: 'Nested (C ⊂ B ⊂ A)' },
                  { id: 'subsets-in-a', label: 'Subsets (B, C ⊂ A)' },
                  { id: 'ab-overlap-c-disjoint', label: 'A ∩ B, C Separate' }
                ].map(p => (
                  <button
                    key={p.id}
                    onClick={() => handleSelectTopology(p.id as VennTopologyPreset)}
                    className={`px-2 py-1.5 text-xs font-medium rounded border text-left transition-colors ${
                      state.topology === p.id
                        ? 'bg-gray-800 text-white border-gray-800'
                        : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-100'
                    }`}
                  >
                    {p.label}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Main Sidebar Navigation Tabs */}
      <div className="flex border-b border-gray-200 bg-white">
        <button
          onClick={() => setActiveTab('data')}
          className={`flex-1 py-2.5 text-xs font-semibold uppercase tracking-wider flex justify-center items-center gap-1.5 transition-colors ${
            activeTab === 'data'
              ? 'text-gray-900 border-b-2 border-gray-900 bg-gray-50'
              : 'text-gray-500 hover:text-gray-800'
          }`}
        >
          <List size={14} /> Data &amp; Input
        </button>
        <button
          onClick={() => setActiveTab('shading')}
          className={`flex-1 py-2.5 text-xs font-semibold uppercase tracking-wider flex justify-center items-center gap-1.5 transition-colors ${
            activeTab === 'shading'
              ? 'text-gray-900 border-b-2 border-gray-900 bg-gray-50'
              : 'text-gray-500 hover:text-gray-800'
          }`}
        >
          <Palette size={14} /> Shading
        </button>
        <button
          onClick={() => setActiveTab('style')}
          className={`flex-1 py-2.5 text-xs font-semibold uppercase tracking-wider flex justify-center items-center gap-1.5 transition-colors ${
            activeTab === 'style'
              ? 'text-gray-900 border-b-2 border-gray-900 bg-gray-50'
              : 'text-gray-500 hover:text-gray-800'
          }`}
        >
          <Sliders size={14} /> Appearance
        </button>
      </div>

      {/* Tab Content Area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-5 select-text">
        {/* ==================== TAB 1: DATA & INPUT ==================== */}
        {activeTab === 'data' && (
          <>
            {/* Set Names Row */}
            <div className="space-y-2">
              <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider">
                Set Labels
              </label>
              <div className="grid grid-cols-3 gap-2">
                {activeSets.map((set, idx) => (
                  <div
                    key={set.id}
                    id={`gui-set-label-${set.id}`}
                    className={`flex items-center gap-1.5 p-1 rounded transition-all ${
                      highlightedControlId === `gui-set-label-${set.id}`
                        ? 'ring-2 ring-gray-900 bg-amber-50'
                        : ''
                    }`}
                  >
                    <span className="text-xs font-semibold text-gray-400">S{idx + 1}:</span>
                    <input
                      type="text"
                      value={set.label}
                      onChange={e => updateSet(set.id, { label: e.target.value })}
                      className="w-full border border-gray-300 rounded px-2 py-1 text-sm font-serif font-semibold text-gray-800 bg-white"
                      placeholder={`Set ${idx + 1}`}
                    />
                  </div>
                ))}
              </div>
            </div>

            {/* Values vs Probabilities Mode Selector */}
            <div className="p-2.5 bg-gray-50 rounded-lg border border-gray-200 space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-gray-700 uppercase tracking-wider">
                  Region Value Format
                </label>
                {state.valueDisplayMode !== 'counts' &&
                  computedTotals.grandTotal !== null &&
                  Math.abs(computedTotals.grandTotal - 1) > 1e-4 && (
                    <button
                      onClick={handleNormalizeRegionsToProbabilities}
                      className="text-[11px] text-gray-700 hover:text-black underline font-medium"
                      title="Convert the raw input numbers directly into decimal probabilities summing to 1"
                    >
                      Convert Inputs to Sum = 1
                    </button>
                  )}
              </div>
              <div className="grid grid-cols-3 gap-1 bg-white p-0.5 rounded-md border border-gray-300">
                <button
                  onClick={() => {
                    forceSnapshot();
                    updateState(prev => ({ ...prev, valueDisplayMode: 'counts' }));
                  }}
                  className={`py-1 px-1.5 text-xs font-semibold rounded transition-colors ${
                    state.valueDisplayMode === 'counts'
                      ? 'bg-gray-800 text-white'
                      : 'text-gray-600 hover:bg-gray-100'
                  }`}
                >
                  Values n(A)
                </button>
                <button
                  onClick={() => {
                    forceSnapshot();
                    updateState(prev => ({
                      ...prev,
                      valueDisplayMode: 'probabilities-decimal'
                    }));
                  }}
                  className={`py-1 px-1.5 text-xs font-semibold rounded transition-colors ${
                    state.valueDisplayMode === 'probabilities-decimal'
                      ? 'bg-gray-800 text-white'
                      : 'text-gray-600 hover:bg-gray-100'
                  }`}
                  title="Display probabilities as decimals P(A) = 0.25"
                >
                  Prob. (0.25)
                </button>
                <button
                  onClick={() => {
                    forceSnapshot();
                    updateState(prev => ({
                      ...prev,
                      valueDisplayMode: 'probabilities-fraction'
                    }));
                  }}
                  className={`py-1 px-1.5 text-xs font-semibold rounded transition-colors ${
                    state.valueDisplayMode === 'probabilities-fraction'
                      ? 'bg-gray-800 text-white'
                      : 'text-gray-600 hover:bg-gray-100'
                  }`}
                  title="Display probabilities as simplified fractions P(A) = 1/4"
                >
                  Prob. (a/b)
                </button>
              </div>
              {state.valueDisplayMode !== 'counts' && (
                <p className="text-[11px] text-gray-500 leading-snug">
                  {computedTotals.grandTotal !== null &&
                  Math.abs(computedTotals.grandTotal - 1) < 1e-4
                    ? 'Inputs already sum to 1 (probabilities).'
                    : `Automatically dividing each region by total (${computedTotals.grandTotal ?? '—'}) to show probabilities on the diagram.`}
                </p>
              )}
            </div>

            {/* Input Method Selector */}
            <div className="space-y-2">
              <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider">
                Data Input Method
              </label>
              <div className="grid grid-cols-2 gap-1.5 bg-gray-100 p-1 rounded-lg border border-gray-200">
                <button
                  onClick={() => setInputMethod('regions')}
                  className={`py-1.5 px-2 text-xs font-medium rounded flex items-center justify-center gap-1.5 transition-colors ${
                    inputMethod === 'regions'
                      ? 'bg-white text-gray-900 shadow-sm'
                      : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  <Layers size={13} /> Direct Regions
                </button>
                <button
                  onClick={() => setInputMethod('totals')}
                  className={`py-1.5 px-2 text-xs font-medium rounded flex items-center justify-center gap-1.5 transition-colors ${
                    inputMethod === 'totals'
                      ? 'bg-white text-gray-900 shadow-sm'
                      : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  <Calculator size={13} /> Set Totals Solver
                </button>
                <button
                  onClick={() => setInputMethod('elements')}
                  className={`py-1.5 px-2 text-xs font-medium rounded flex items-center justify-center gap-1.5 transition-colors ${
                    inputMethod === 'elements'
                      ? 'bg-white text-gray-900 shadow-sm'
                      : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  <Sparkles size={13} /> Element Lists
                </button>
                {state.numSets === 2 && (
                  <button
                    onClick={() => setInputMethod('twoway')}
                    className={`py-1.5 px-2 text-xs font-medium rounded flex items-center justify-center gap-1.5 transition-colors ${
                      inputMethod === 'twoway'
                        ? 'bg-white text-gray-900 shadow-sm'
                        : 'text-gray-600 hover:text-gray-900'
                    }`}
                  >
                    <Grid size={13} /> 2-Way Table
                  </button>
                )}
              </div>
            </div>

            {/* METHOD 1: DIRECT EXCLUSIVE REGIONS */}
            {inputMethod === 'regions' && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">
                    Exclusive Regions
                  </span>
                  <span className="text-[11px] text-gray-400">
                    Supports numbers, $2x+1$, or $\frac{'{1}{4}'}$
                  </span>
                </div>

                <div className="space-y-2">
                  {Array.from({ length: totalRegions }).map((_, i) => {
                    const order2 = [1, 3, 2, 0];
                    const order3 = [1, 2, 4, 3, 5, 6, 7, 0];
                    const mask =
                      state.numSets === 2
                        ? order2[i]
                        : state.numSets === 3
                        ? order3[i]
                        : i === 0
                        ? 1
                        : 0;
                    const reg = state.regions[mask];
                    const meta = getRegionMeta(mask);
                    const centerInfo = regionCenters[mask];

                    return (
                      <div
                        key={mask}
                        id={`gui-region-${mask}`}
                        className={`p-2.5 rounded-lg border transition-all ${
                          highlightedControlId === `gui-region-${mask}`
                            ? 'ring-2 ring-gray-900 bg-amber-50 border-gray-900 shadow-sm'
                            : reg.shaded
                            ? 'bg-gray-100 border-gray-400'
                            : 'bg-white border-gray-200'
                        }`}
                      >
                        <div className="flex items-center justify-between mb-1.5">
                          <div className="flex items-center gap-2">
                            <span className="font-serif font-bold text-sm text-gray-900 bg-gray-100 px-1.5 py-0.5 rounded border border-gray-300">
                              {meta.notation}
                            </span>
                            <span className="text-xs text-gray-500">{meta.desc}</span>
                          </div>
                          {!centerInfo?.exists && mask !== 0 && (
                            <span
                              className="text-[10px] bg-amber-50 text-amber-700 px-1.5 py-0.5 rounded border border-amber-200"
                              title="This intersection does not visually exist in the current set layout"
                            >
                              Empty in layout
                            </span>
                          )}
                        </div>

                        <div className="flex items-center gap-1.5">
                          <input
                            type="text"
                            value={reg.value}
                            onChange={e => updateRegion(mask, { value: e.target.value })}
                            placeholder="Value or expression..."
                            className="flex-1 border border-gray-300 rounded px-2.5 py-1 text-sm font-serif bg-white"
                          />
                          <button
                            onClick={() => {
                              forceSnapshot();
                              updateRegion(mask, { shaded: !reg.shaded });
                            }}
                            className={`p-1.5 rounded border text-xs transition-colors ${
                              reg.shaded
                                ? 'bg-gray-800 text-white border-gray-800'
                                : 'bg-white text-gray-500 border-gray-300 hover:bg-gray-100'
                            }`}
                            title="Toggle region shading"
                          >
                            <PaintBucket size={14} />
                          </button>
                          <button
                            onClick={() => {
                              forceSnapshot();
                              updateRegion(mask, { isBlankBox: !reg.isBlankBox });
                            }}
                            className={`p-1.5 rounded border text-xs transition-colors ${
                              reg.isBlankBox
                                ? 'bg-gray-800 text-white border-gray-800'
                                : 'bg-white text-gray-500 border-gray-300 hover:bg-gray-100'
                            }`}
                            title="Render as blank answer box [ ] for worksheets"
                          >
                            <Square size={14} />
                          </button>
                          <button
                            onClick={() => {
                              forceSnapshot();
                              updateRegion(mask, { hidden: !reg.hidden });
                            }}
                            className={`p-1.5 rounded border text-xs transition-colors ${
                              reg.hidden
                                ? 'bg-gray-800 text-white border-gray-800'
                                : 'bg-white text-gray-500 border-gray-300 hover:bg-gray-100'
                            }`}
                            title={reg.hidden ? 'Show region value' : 'Hide region value'}
                          >
                            {reg.hidden ? <EyeOff size={14} /> : <Eye size={14} />}
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Live Calculated Summary Card */}
                {computedTotals.grandTotal !== null && (
                  <div className="p-3 bg-gray-50 rounded-lg border border-gray-200 text-xs space-y-1">
                    <div className="font-bold text-gray-700 uppercase tracking-wider mb-1">
                      {state.valueDisplayMode === 'counts'
                        ? 'Calculated Set Totals'
                        : 'Calculated Set Probabilities'}
                    </div>
                    <div className="flex flex-wrap gap-x-4 gap-y-1 font-serif text-sm text-gray-800">
                      {activeSets.map((s, idx) => (
                        <span key={s.id}>
                          <i>{state.valueDisplayMode === 'counts' ? 'n' : 'P'}</i>({s.label}) ={' '}
                          <b>
                            {computedTotals.setSums[idx] !== null
                              ? formatDisplayValue(computedTotals.setSums[idx])
                              : '—'}
                          </b>
                        </span>
                      ))}
                      <span>
                        <i>{state.valueDisplayMode === 'counts' ? 'n' : 'P'}</i>(
                        {state.universalSymbol}) ={' '}
                        <b>{formatDisplayValue(computedTotals.grandTotal)}</b>
                      </span>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* METHOD 2: SET TOTALS SOLVER (INCLUSION-EXCLUSION) */}
            {inputMethod === 'totals' && (
              <div className="space-y-3 bg-gray-50 p-3 rounded-lg border border-gray-200">
                <div className="text-xs text-gray-600 leading-relaxed">
                  Enter total set cardinalities or probabilities below. The Inclusion-Exclusion solver will automatically compute each exclusive region.
                </div>

                <div className="grid grid-cols-2 gap-2.5">
                  <div>
                    <label className="block text-xs font-serif font-bold text-gray-700 mb-1">
                      n({state.sets[0]?.label || 'A'}) Total
                    </label>
                    <input
                      type="number"
                      step="any"
                      value={state.totalsInput.nA}
                      onChange={e =>
                        updateState(prev => ({
                          ...prev,
                          totalsInput: { ...prev.totalsInput, nA: e.target.value }
                        }))
                      }
                      className="w-full border border-gray-300 rounded px-2.5 py-1.5 text-sm bg-white"
                    />
                  </div>

                  {state.numSets >= 2 && (
                    <div>
                      <label className="block text-xs font-serif font-bold text-gray-700 mb-1">
                        n({state.sets[1]?.label || 'B'}) Total
                      </label>
                      <input
                        type="number"
                        step="any"
                        value={state.totalsInput.nB}
                        onChange={e =>
                          updateState(prev => ({
                            ...prev,
                            totalsInput: { ...prev.totalsInput, nB: e.target.value }
                          }))
                        }
                        className="w-full border border-gray-300 rounded px-2.5 py-1.5 text-sm bg-white"
                      />
                    </div>
                  )}

                  {state.numSets >= 3 && (
                    <div>
                      <label className="block text-xs font-serif font-bold text-gray-700 mb-1">
                        n({state.sets[2]?.label || 'C'}) Total
                      </label>
                      <input
                        type="number"
                        step="any"
                        value={state.totalsInput.nC}
                        onChange={e =>
                          updateState(prev => ({
                            ...prev,
                            totalsInput: { ...prev.totalsInput, nC: e.target.value }
                          }))
                        }
                        className="w-full border border-gray-300 rounded px-2.5 py-1.5 text-sm bg-white"
                      />
                    </div>
                  )}

                  {state.numSets >= 2 && (
                    <div>
                      <label className="block text-xs font-serif font-bold text-gray-700 mb-1">
                        n({state.sets[0]?.label || 'A'} ∩ {state.sets[1]?.label || 'B'})
                      </label>
                      <input
                        type="number"
                        step="any"
                        value={state.totalsInput.nAB}
                        onChange={e =>
                          updateState(prev => ({
                            ...prev,
                            totalsInput: { ...prev.totalsInput, nAB: e.target.value }
                          }))
                        }
                        className="w-full border border-gray-300 rounded px-2.5 py-1.5 text-sm bg-white"
                      />
                    </div>
                  )}

                  {state.numSets >= 3 && (
                    <>
                      <div>
                        <label className="block text-xs font-serif font-bold text-gray-700 mb-1">
                          n({state.sets[0]?.label || 'A'} ∩ {state.sets[2]?.label || 'C'})
                        </label>
                        <input
                          type="number"
                          step="any"
                          value={state.totalsInput.nAC}
                          onChange={e =>
                            updateState(prev => ({
                              ...prev,
                              totalsInput: { ...prev.totalsInput, nAC: e.target.value }
                            }))
                          }
                          className="w-full border border-gray-300 rounded px-2.5 py-1.5 text-sm bg-white"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-serif font-bold text-gray-700 mb-1">
                          n({state.sets[1]?.label || 'B'} ∩ {state.sets[2]?.label || 'C'})
                        </label>
                        <input
                          type="number"
                          step="any"
                          value={state.totalsInput.nBC}
                          onChange={e =>
                            updateState(prev => ({
                              ...prev,
                              totalsInput: { ...prev.totalsInput, nBC: e.target.value }
                            }))
                          }
                          className="w-full border border-gray-300 rounded px-2.5 py-1.5 text-sm bg-white"
                        />
                      </div>
                      <div className="col-span-2">
                        <label className="block text-xs font-serif font-bold text-gray-700 mb-1">
                          n({state.sets[0]?.label || 'A'} ∩ {state.sets[1]?.label || 'B'} ∩{' '}
                          {state.sets[2]?.label || 'C'}) (Center All 3)
                        </label>
                        <input
                          type="number"
                          step="any"
                          value={state.totalsInput.nABC}
                          onChange={e =>
                            updateState(prev => ({
                              ...prev,
                              totalsInput: { ...prev.totalsInput, nABC: e.target.value }
                            }))
                          }
                          className="w-full border border-gray-300 rounded px-2.5 py-1.5 text-sm bg-white"
                        />
                      </div>
                    </>
                  )}
                </div>

                <div className="pt-2 border-t border-gray-200 space-y-2">
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      id="useOutsideToggle"
                      checked={state.totalsInput.useOutsideInsteadOfU}
                      onChange={e =>
                        updateState(prev => ({
                          ...prev,
                          totalsInput: {
                            ...prev.totalsInput,
                            useOutsideInsteadOfU: e.target.checked
                          }
                        }))
                      }
                      className="rounded border-gray-300 text-gray-900"
                    />
                    <label htmlFor="useOutsideToggle" className="text-xs text-gray-700">
                      Specify Outside region directly instead of Universal Total n(&xi;)
                    </label>
                  </div>

                  {state.totalsInput.useOutsideInsteadOfU ? (
                    <div>
                      <label className="block text-xs font-serif font-bold text-gray-700 mb-1">
                        n(Outside / Neither)
                      </label>
                      <input
                        type="number"
                        step="any"
                        value={state.totalsInput.nOutside}
                        onChange={e =>
                          updateState(prev => ({
                            ...prev,
                            totalsInput: { ...prev.totalsInput, nOutside: e.target.value }
                          }))
                        }
                        className="w-full border border-gray-300 rounded px-2.5 py-1.5 text-sm bg-white"
                      />
                    </div>
                  ) : (
                    <div>
                      <label className="block text-xs font-serif font-bold text-gray-700 mb-1">
                        n(&xi;) Universal Set Total
                      </label>
                      <input
                        type="number"
                        step="any"
                        value={state.totalsInput.totalU}
                        onChange={e =>
                          updateState(prev => ({
                            ...prev,
                            totalsInput: { ...prev.totalsInput, totalU: e.target.value }
                          }))
                        }
                        className="w-full border border-gray-300 rounded px-2.5 py-1.5 text-sm bg-white"
                      />
                    </div>
                  )}
                </div>

                <button
                  onClick={handleSolveTotals}
                  className="w-full py-2 bg-gray-900 hover:bg-black text-white text-xs font-semibold rounded-md shadow-sm flex items-center justify-center gap-1.5 transition-colors"
                >
                  <Calculator size={14} /> Solve &amp; Populate Regions
                </button>

                {solverMessage && (
                  <div
                    className={`p-2.5 rounded border text-xs flex items-start gap-2 ${
                      solverMessage.type === 'warn'
                        ? 'bg-amber-50 border-amber-300 text-amber-800'
                        : 'bg-white border-gray-300 text-gray-800'
                    }`}
                  >
                    {solverMessage.type === 'warn' ? (
                      <AlertCircle size={14} className="shrink-0 mt-0.5 text-amber-600" />
                    ) : (
                      <Check size={14} className="shrink-0 mt-0.5 text-gray-700" />
                    )}
                    <span>{solverMessage.text}</span>
                  </div>
                )}
              </div>
            )}

            {/* METHOD 3: ELEMENT / MEMBERSHIP LISTS */}
            {inputMethod === 'elements' && (
              <div className="space-y-3 bg-gray-50 p-3 rounded-lg border border-gray-200">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-gray-700 uppercase">
                    Set Elements (Comma-Separated)
                  </span>
                  <button
                    onClick={() => {
                      const nums = Array.from({ length: 12 }, (_, i) => i + 1).join(', ');
                      const next = { ...state.elementLists, universal: nums };
                      applyElementLists(next);
                    }}
                    className="text-[11px] text-gray-600 underline hover:text-black"
                  >
                    Fill ξ = 1..12
                  </button>
                </div>

                <div>
                  <label className="block text-xs font-serif font-semibold text-gray-700 mb-1">
                    Universal Set &xi;
                  </label>
                  <textarea
                    rows={2}
                    value={state.elementLists.universal}
                    onChange={e =>
                      updateState(prev => ({
                        ...prev,
                        elementLists: { ...prev.elementLists, universal: e.target.value }
                      }))
                    }
                    className="w-full border border-gray-300 rounded px-2 py-1 text-xs font-serif bg-white"
                    placeholder="e.g. 1, 2, 3, 4, 5, 6, 7, 8, 9, 10"
                  />
                </div>

                <div>
                  <label className="block text-xs font-serif font-semibold text-gray-700 mb-1">
                    Set {state.sets[0]?.label || 'A'} Elements
                  </label>
                  <input
                    type="text"
                    value={state.elementLists.setA}
                    onChange={e =>
                      updateState(prev => ({
                        ...prev,
                        elementLists: { ...prev.elementLists, setA: e.target.value }
                      }))
                    }
                    className="w-full border border-gray-300 rounded px-2 py-1.5 text-xs font-serif bg-white"
                    placeholder="e.g. 2, 4, 6, 8, 10"
                  />
                </div>

                {state.numSets >= 2 && (
                  <div>
                    <label className="block text-xs font-serif font-semibold text-gray-700 mb-1">
                      Set {state.sets[1]?.label || 'B'} Elements
                    </label>
                    <input
                      type="text"
                      value={state.elementLists.setB}
                      onChange={e =>
                        updateState(prev => ({
                          ...prev,
                          elementLists: { ...prev.elementLists, setB: e.target.value }
                        }))
                      }
                      className="w-full border border-gray-300 rounded px-2 py-1.5 text-xs font-serif bg-white"
                      placeholder="e.g. 3, 6, 9, 12"
                    />
                  </div>
                )}

                {state.numSets >= 3 && (
                  <div>
                    <label className="block text-xs font-serif font-semibold text-gray-700 mb-1">
                      Set {state.sets[2]?.label || 'C'} Elements
                    </label>
                    <input
                      type="text"
                      value={state.elementLists.setC}
                      onChange={e =>
                        updateState(prev => ({
                          ...prev,
                          elementLists: { ...prev.elementLists, setC: e.target.value }
                        }))
                      }
                      className="w-full border border-gray-300 rounded px-2 py-1.5 text-xs font-serif bg-white"
                      placeholder="e.g. 1, 2, 3, 4"
                    />
                  </div>
                )}

                <div className="flex items-center justify-between pt-1">
                  <span className="text-xs font-medium text-gray-700">Display in Regions:</span>
                  <div className="flex bg-white rounded border border-gray-300 p-0.5">
                    <button
                      onClick={() => {
                        const next = {
                          ...state.elementLists,
                          displayMode: 'elements' as const
                        };
                        applyElementLists(next);
                      }}
                      className={`px-2 py-1 text-xs rounded ${
                        state.elementLists.displayMode === 'elements'
                          ? 'bg-gray-800 text-white'
                          : 'text-gray-600'
                      }`}
                    >
                      Elements
                    </button>
                    <button
                      onClick={() => {
                        const next = {
                          ...state.elementLists,
                          displayMode: 'counts' as const
                        };
                        applyElementLists(next);
                      }}
                      className={`px-2 py-1 text-xs rounded ${
                        state.elementLists.displayMode === 'counts'
                          ? 'bg-gray-800 text-white'
                          : 'text-gray-600'
                      }`}
                    >
                      Counts n(...)
                    </button>
                  </div>
                </div>

                <button
                  onClick={() => applyElementLists()}
                  className="w-full py-2 bg-gray-900 hover:bg-black text-white text-xs font-semibold rounded-md shadow-sm flex items-center justify-center gap-1.5 transition-colors"
                >
                  <Sparkles size={14} /> Sort Elements into Venn Regions
                </button>
              </div>
            )}

            {/* METHOD 4: TWO-WAY TABLE / KARNAUGH MAP (2 SETS) */}
            {inputMethod === 'twoway' && state.numSets === 2 && (
              <div className="space-y-3 bg-gray-50 p-3 rounded-lg border border-gray-200">
                <div className="text-xs text-gray-600">
                  Edit the 4 interior cells of the Two-Way Table to directly update the Venn diagram regions:
                </div>

                {(() => {
                  const lA = state.sets[0]?.label || 'A';
                  const lB = state.sets[1]?.label || 'B';
                  const vAB = state.regions[3]?.value || '';
                  const vAOnly = state.regions[1]?.value || '';
                  const vBOnly = state.regions[2]?.value || '';
                  const vOut = state.regions[0]?.value || '';

                  const nAB = parseFloat(vAB) || 0;
                  const nAOnly = parseFloat(vAOnly) || 0;
                  const nBOnly = parseFloat(vBOnly) || 0;
                  const nOut = parseFloat(vOut) || 0;

                  return (
                    <div className="overflow-x-auto">
                      <table className="w-full border-collapse bg-white text-center font-serif text-sm border border-gray-300">
                        <thead>
                          <tr className="bg-gray-100">
                            <th className="border border-gray-300 p-1.5"></th>
                            <th className="border border-gray-300 p-1.5 font-bold italic">{lB}</th>
                            <th className="border border-gray-300 p-1.5 font-bold italic">
                              {lB}&apos;
                            </th>
                            <th className="border border-gray-300 p-1.5 font-sans text-xs font-bold text-gray-600">
                              Total
                            </th>
                          </tr>
                        </thead>
                        <tbody>
                          <tr>
                            <td className="border border-gray-300 p-1.5 bg-gray-100 font-bold italic">
                              {lA}
                            </td>
                            <td className="border border-gray-300 p-1">
                              <input
                                type="text"
                                value={vAB}
                                onChange={e => updateRegion(3, { value: e.target.value })}
                                className="w-16 text-center border border-gray-200 rounded py-1 text-sm"
                              />
                            </td>
                            <td className="border border-gray-300 p-1">
                              <input
                                type="text"
                                value={vAOnly}
                                onChange={e => updateRegion(1, { value: e.target.value })}
                                className="w-16 text-center border border-gray-200 rounded py-1 text-sm"
                              />
                            </td>
                            <td className="border border-gray-300 p-1.5 bg-gray-50 font-bold text-gray-700">
                              {Number((nAB + nAOnly).toFixed(4))}
                            </td>
                          </tr>
                          <tr>
                            <td className="border border-gray-300 p-1.5 bg-gray-100 font-bold italic">
                              {lA}&apos;
                            </td>
                            <td className="border border-gray-300 p-1">
                              <input
                                type="text"
                                value={vBOnly}
                                onChange={e => updateRegion(2, { value: e.target.value })}
                                className="w-16 text-center border border-gray-200 rounded py-1 text-sm"
                              />
                            </td>
                            <td className="border border-gray-300 p-1">
                              <input
                                type="text"
                                value={vOut}
                                onChange={e => updateRegion(0, { value: e.target.value })}
                                className="w-16 text-center border border-gray-200 rounded py-1 text-sm"
                              />
                            </td>
                            <td className="border border-gray-300 p-1.5 bg-gray-50 font-bold text-gray-700">
                              {Number((nBOnly + nOut).toFixed(4))}
                            </td>
                          </tr>
                          <tr className="bg-gray-50 font-bold text-gray-700">
                            <td className="border border-gray-300 p-1.5 font-sans text-xs">
                              Total
                            </td>
                            <td className="border border-gray-300 p-1.5">
                              {Number((nAB + nBOnly).toFixed(4))}
                            </td>
                            <td className="border border-gray-300 p-1.5">
                              {Number((nAOnly + nOut).toFixed(4))}
                            </td>
                            <td className="border border-gray-300 p-1.5 bg-gray-200 text-gray-900">
                              {Number((nAB + nAOnly + nBOnly + nOut).toFixed(4))}
                            </td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  );
                })()}

                <label className="flex items-center gap-2 pt-1 text-xs text-gray-700 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={state.showCompanionTable}
                    onChange={e =>
                      updateState(prev => ({
                        ...prev,
                        showCompanionTable: e.target.checked
                      }))
                    }
                    className="rounded border-gray-300 text-gray-900"
                  />
                  Render Two-Way Table alongside Venn Diagram on Canvas
                </label>
              </div>
            )}
          </>
        )}

        {/* ==================== TAB 2: SHADING & SET NOTATION ==================== */}
        {activeTab === 'shading' && (
          <div className="space-y-5">
            {/* Set Notation Expression Shader */}
            <div className="space-y-2.5 bg-gray-50 p-3 rounded-lg border border-gray-200">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-gray-700 uppercase tracking-wider">
                  Shade by Set Notation
                </label>
                <button
                  onClick={() => {
                    forceSnapshot();
                    updateState(prev => ({
                      ...prev,
                      regions: Object.fromEntries(
                        Object.entries(prev.regions).map(([k, v]) => [k, { ...v, shaded: false }])
                      )
                    }));
                  }}
                  className="text-[11px] text-gray-500 hover:text-black underline"
                >
                  Clear All Shading
                </button>
              </div>

              <div className="flex gap-1.5">
                <input
                  type="text"
                  value={setExpressionInput}
                  onChange={e => setSetExpressionInput(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === 'Enter') handleApplySetExpression();
                  }}
                  placeholder="e.g. (A ∪ B)' or A ∩ B'"
                  className="flex-1 border border-gray-300 rounded px-2.5 py-1.5 text-sm font-serif bg-white"
                />
                <button
                  onClick={() => handleApplySetExpression()}
                  className="px-3 py-1.5 bg-gray-900 text-white text-xs font-semibold rounded hover:bg-black transition-colors"
                >
                  Shade
                </button>
              </div>

              {/* Quick Operator Insert Bar */}
              <div className="flex flex-wrap gap-1">
                {[
                  { sym: '∪', title: 'Union' },
                  { sym: '∩', title: 'Intersection' },
                  { sym: "'", title: 'Complement' },
                  { sym: '\\', title: 'Set Difference' },
                  { sym: 'Δ', title: 'Symmetric Difference' },
                  { sym: '(', title: 'Left Parenthesis' },
                  { sym: ')', title: 'Right Parenthesis' }
                ].map(op => (
                  <button
                    key={op.sym}
                    onClick={() => setSetExpressionInput(prev => prev + op.sym)}
                    className="px-2 py-1 bg-white border border-gray-300 rounded text-xs font-serif font-bold hover:bg-gray-100"
                    title={op.title}
                  >
                    {op.sym}
                  </button>
                ))}
              </div>

              {expressionError && (
                <div className="text-xs text-red-600 bg-red-50 p-2 rounded border border-red-200">
                  {expressionError}
                </div>
              )}

              {/* Preset Set Notation Chips */}
              <div className="pt-1">
                <span className="block text-[11px] font-semibold text-gray-400 uppercase mb-1.5">
                  One-Click Presets
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {shadingPresets.map(p => (
                    <button
                      key={p.expr}
                      onClick={() => handleApplySetExpression(p.expr)}
                      className="px-2 py-1 text-xs font-serif bg-white border border-gray-300 rounded hover:bg-gray-800 hover:text-white hover:border-gray-800 transition-colors"
                    >
                      {p.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Greyscale Fill & Hatching Pattern Style */}
            <div className="space-y-3">
              <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider">
                Shaded Region Fill Tone (Greyscale)
              </label>
              <div className="grid grid-cols-7 gap-1.5">
                {GREYSCALE_SWATCHES.map(sw => (
                  <button
                    key={sw.value}
                    onClick={() => {
                      forceSnapshot();
                      updateState(prev => ({ ...prev, globalShadeColor: sw.value }));
                    }}
                    className={`h-8 rounded border flex items-center justify-center transition-all ${
                      state.globalShadeColor === sw.value
                        ? 'ring-2 ring-gray-900 border-gray-900 scale-105'
                        : 'border-gray-300'
                    }`}
                    style={{ backgroundColor: sw.value }}
                    title={sw.label}
                  >
                    {state.globalShadeColor === sw.value && (
                      <Check
                        size={14}
                        className={
                          sw.value === '#374151' || sw.value === '#6b7280'
                            ? 'text-white'
                            : 'text-gray-900'
                        }
                      />
                    )}
                  </button>
                ))}
              </div>

              <div className="pt-2">
                <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5">
                  Hatching / Pattern Overlay
                </label>
                <select
                  value={state.globalShadePattern}
                  onChange={e => {
                    forceSnapshot();
                    updateState(prev => ({
                      ...prev,
                      globalShadePattern: e.target.value as PatternType
                    }));
                  }}
                  className="w-full border border-gray-300 rounded-md p-2 text-sm bg-white"
                >
                  {PATTERN_OPTIONS.map(opt => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>

              {state.globalShadePattern !== 'none' && (
                <div className="grid grid-cols-2 gap-3 pt-1">
                  <div>
                    <label className="block text-xs text-gray-600 mb-1">
                      Pattern Spacing ({state.patternSpacing}px)
                    </label>
                    <input
                      type="range"
                      min={5}
                      max={18}
                      step={1}
                      value={state.patternSpacing}
                      onChange={e =>
                        updateState(prev => ({
                          ...prev,
                          patternSpacing: Number(e.target.value)
                        }))
                      }
                      className="w-full accent-gray-800"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-600 mb-1">
                      Line Weight ({state.patternStrokeWidth}px)
                    </label>
                    <input
                      type="range"
                      min={0.6}
                      max={3}
                      step={0.2}
                      value={state.patternStrokeWidth}
                      onChange={e =>
                        updateState(prev => ({
                          ...prev,
                          patternStrokeWidth: Number(e.target.value)
                        }))
                      }
                      className="w-full accent-gray-800"
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Whole-Set Hatching (for visual overlap demonstrations) */}
            <div className="space-y-2.5 pt-3 border-t border-gray-200">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">
                  Whole-Set Hatching (Overlap Demo)
                </label>
              </div>
              <p className="text-[11px] text-gray-500">
                Optionally assign a pattern to an entire set (e.g. Set A = /// and Set B = \\\) so their intersection naturally crosshatches.
              </p>
              <div className="space-y-2">
                {activeSets.map(set => (
                  <div
                    key={set.id}
                    className="flex items-center justify-between gap-2 bg-gray-50 p-2 rounded border border-gray-200"
                  >
                    <span className="font-serif font-bold text-sm text-gray-800 w-12">
                      Set {set.label}
                    </span>
                    <select
                      value={set.setFillPattern}
                      onChange={e =>
                        updateSet(set.id, { setFillPattern: e.target.value as PatternType })
                      }
                      className="flex-1 border border-gray-300 rounded px-2 py-1 text-xs bg-white"
                    >
                      {PATTERN_OPTIONS.map(opt => (
                        <option key={opt.value} value={opt.value}>
                          {opt.label}
                        </option>
                      ))}
                    </select>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ==================== TAB 3: APPEARANCE & LAYOUT ==================== */}
        {activeTab === 'style' && (
          <div className="space-y-5">
            {/* Student / Exam Worksheet Mode */}
            <div className="p-3 rounded-lg border border-gray-200 bg-gray-50 space-y-2.5">
              <label className="flex items-center justify-between cursor-pointer">
                <div>
                  <span className="block text-xs font-bold text-gray-800 uppercase">
                    Student / Exam Mode
                  </span>
                  <span className="block text-[11px] text-gray-500">
                    Hide all region values for blank student worksheets
                  </span>
                </div>
                <input
                  type="checkbox"
                  checked={state.studentMode}
                  onChange={e =>
                    updateState(prev => ({ ...prev, studentMode: e.target.checked }))
                  }
                  className="w-4 h-4 rounded border-gray-300 text-gray-900"
                />
              </label>

              {state.studentMode && (
                <label className="flex items-center gap-2 text-xs text-gray-700 pt-1 border-t border-gray-200 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={state.studentModeAsBoxes}
                    onChange={e =>
                      updateState(prev => ({
                        ...prev,
                        studentModeAsBoxes: e.target.checked
                      }))
                    }
                    className="rounded border-gray-300 text-gray-900"
                  />
                  Show empty answer boxes [ ] in each region
                </label>
              )}

              <div className="grid grid-cols-2 gap-2 pt-1">
                <div>
                  <label className="block text-[11px] text-gray-500 mb-0.5">
                    Answer Box Width (px)
                  </label>
                  <input
                    type="number"
                    value={state.blankBoxWidth}
                    onChange={e =>
                      updateState(prev => ({
                        ...prev,
                        blankBoxWidth: Math.max(16, Number(e.target.value) || 34)
                      }))
                    }
                    className="w-full border border-gray-300 rounded px-2 py-1 text-xs bg-white"
                  />
                </div>
                <div>
                  <label className="block text-[11px] text-gray-500 mb-0.5">
                    Answer Box Height (px)
                  </label>
                  <input
                    type="number"
                    value={state.blankBoxHeight}
                    onChange={e =>
                      updateState(prev => ({
                        ...prev,
                        blankBoxHeight: Math.max(14, Number(e.target.value) || 24)
                      }))
                    }
                    className="w-full border border-gray-300 rounded px-2 py-1 text-xs bg-white"
                  />
                </div>
              </div>
            </div>

            {/* Canvas Dimensions (cm) & Title */}
            <div
              id="gui-border-dimensions"
              className={`space-y-3 p-1.5 -m-1.5 rounded-lg transition-all ${
                highlightedControlId === 'gui-border-dimensions'
                  ? 'ring-2 ring-gray-900 bg-amber-50'
                  : ''
              }`}
            >
              <div className="flex items-center justify-between">
                <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider">
                  Diagram Size Presets &amp; Border
                </label>
                <div className="flex items-center gap-2">
                  <button
                    onClick={handleFitShapesInsideBorder}
                    className="text-[11px] text-gray-700 hover:text-black font-medium underline"
                    title="Scale circles/shapes so they fit neatly inside the current border"
                  >
                    Fit Shapes Inside
                  </button>
                  <button
                    onClick={handleFitBorderToShapes}
                    className="text-[11px] text-gray-700 hover:text-black font-medium underline"
                    title="Wrap outer border around current shapes"
                  >
                    Fit Border
                  </button>
                </div>
              </div>

              {/* Small (MCQ) / Medium (8x6cm) / Large Size Preset Buttons */}
              <div className="grid grid-cols-3 gap-1.5 bg-gray-100 p-1 rounded-lg border border-gray-200">
                {(['small', 'medium', 'large'] as const).map(pKey => {
                  const preset = VENN_SIZE_PRESETS[pKey];
                  const isCurrent =
                    Math.abs(state.dimCm.width - preset.widthCm) < 0.15 &&
                    Math.abs(state.dimCm.height - preset.heightCm) < 0.15;
                  return (
                    <button
                      key={pKey}
                      onClick={() => handleApplySizePreset(pKey)}
                      className={`py-1.5 px-1.5 rounded text-xs font-semibold transition-colors flex flex-col items-center ${
                        isCurrent
                          ? 'bg-gray-800 text-white shadow-xs'
                          : 'bg-white text-gray-700 hover:bg-gray-50 border border-gray-200'
                      }`}
                      title={preset.desc}
                    >
                      <span>
                        {pKey === 'small' ? 'Small (MCQ)' : pKey === 'medium' ? 'Medium' : 'Large'}
                      </span>
                      <span
                        className={`text-[10px] font-normal ${
                          isCurrent ? 'text-gray-300' : 'text-gray-400'
                        }`}
                      >
                        {preset.widthCm}×{preset.heightCm} cm
                      </span>
                    </button>
                  );
                })}
              </div>

              {/* Quick Narrower / Wider & Shorter / Taller Buttons */}
              <div className="grid grid-cols-2 gap-2">
                <div className="bg-gray-50 p-2 rounded border border-gray-200 space-y-1.5">
                  <div className="flex items-center justify-between text-xs text-gray-600">
                    <span className="font-medium">Width</span>
                    <span className="font-mono font-semibold text-gray-800">
                      {state.dimCm.width} cm
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-1">
                    <button
                      onClick={() => handleResizeBoxCm(-0.5, 0)}
                      className="px-2 py-1 bg-white hover:bg-gray-100 border border-gray-300 rounded text-[11px] font-medium text-gray-700 flex items-center justify-center gap-1"
                    >
                      <Minimize2 size={11} /> Narrower
                    </button>
                    <button
                      onClick={() => handleResizeBoxCm(0.5, 0)}
                      className="px-2 py-1 bg-white hover:bg-gray-100 border border-gray-300 rounded text-[11px] font-medium text-gray-700 flex items-center justify-center gap-1"
                    >
                      <Maximize2 size={11} /> Wider
                    </button>
                  </div>
                </div>

                <div className="bg-gray-50 p-2 rounded border border-gray-200 space-y-1.5">
                  <div className="flex items-center justify-between text-xs text-gray-600">
                    <span className="font-medium">Height</span>
                    <span className="font-mono font-semibold text-gray-800">
                      {state.dimCm.height} cm
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-1">
                    <button
                      onClick={() => handleResizeBoxCm(0, -0.5)}
                      className="px-2 py-1 bg-white hover:bg-gray-100 border border-gray-300 rounded text-[11px] font-medium text-gray-700 flex items-center justify-center gap-1"
                    >
                      <Minimize2 size={11} /> Shorter
                    </button>
                    <button
                      onClick={() => handleResizeBoxCm(0, 0.5)}
                      className="px-2 py-1 bg-white hover:bg-gray-100 border border-gray-300 rounded text-[11px] font-medium text-gray-700 flex items-center justify-center gap-1"
                    >
                      <Maximize2 size={11} /> Taller
                    </button>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="block text-xs text-gray-600 mb-1">Exact Width (cm)</label>
                  <input
                    type="number"
                    step="0.5"
                    min="4"
                    max="32"
                    value={state.dimCm.width}
                    onChange={e =>
                      updateState(prev => ({
                        ...prev,
                        dimCm: {
                          ...prev.dimCm,
                          width: Math.max(4, parseFloat(e.target.value) || 8)
                        }
                      }))
                    }
                    className="w-full border border-gray-300 rounded px-2.5 py-1.5 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-600 mb-1">Exact Height (cm)</label>
                  <input
                    type="number"
                    step="0.5"
                    min="3"
                    max="26"
                    value={state.dimCm.height}
                    onChange={e =>
                      updateState(prev => ({
                        ...prev,
                        dimCm: {
                          ...prev.dimCm,
                          height: Math.max(3, parseFloat(e.target.value) || 6)
                        }
                      }))
                    }
                    className="w-full border border-gray-300 rounded px-2.5 py-1.5 text-sm"
                  />
                </div>
              </div>

              <div
                id="gui-chart-title"
                className={`p-1.5 -m-1.5 rounded-lg transition-all ${
                  highlightedControlId === 'gui-chart-title'
                    ? 'ring-2 ring-gray-900 bg-amber-50'
                    : ''
                }`}
              >
                <label className="block text-xs text-gray-600 mb-1">
                  Diagram Title (Optional)
                </label>
                <input
                  type="text"
                  value={state.chartTitle}
                  onChange={e => updateState(prev => ({ ...prev, chartTitle: e.target.value }))}
                  placeholder="e.g. Year 10 Subject Selection"
                  className="w-full border border-gray-300 rounded px-2.5 py-1.5 text-sm font-serif bg-white"
                />
              </div>
            </div>

            {/* Universal Set Configuration */}
            <div
              id="gui-universal-label"
              className={`space-y-3 pt-3 border-t border-gray-200 p-1.5 -m-1.5 rounded-lg transition-all ${
                highlightedControlId === 'gui-universal-label'
                  ? 'ring-2 ring-gray-900 bg-amber-50'
                  : ''
              }`}
            >
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">
                  Universal Set Corner Label
                </label>
                <label className="flex items-center gap-1.5 text-xs text-gray-700 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={state.showUniversalBox}
                    onChange={e =>
                      updateState(prev => ({
                        ...prev,
                        showUniversalBox: e.target.checked
                      }))
                    }
                    className="rounded border-gray-300 text-gray-900"
                  />
                  Show Outer Box
                </label>
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="block text-xs text-gray-600 mb-1">Corner Label Position</label>
                  <select
                    value={state.universalLabelPos}
                    onChange={e =>
                      updateState(prev => ({
                        ...prev,
                        universalLabelPos: e.target.value as VennState['universalLabelPos']
                      }))
                    }
                    className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm bg-white"
                  >
                    <option value="none">None (Hidden)</option>
                    <option value="outside-top-left">Outside Top-Left</option>
                    <option value="inside-top-left">Inside Top-Left</option>
                    <option value="outside-top-right">Outside Top-Right</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs text-gray-600 mb-1">Symbol</label>
                  <select
                    value={state.universalSymbol}
                    onChange={e =>
                      updateState(prev => ({ ...prev, universalSymbol: e.target.value }))
                    }
                    disabled={state.universalLabelPos === 'none'}
                    className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm font-serif bg-white disabled:opacity-50"
                  >
                    <option value="U">U (Universal)</option>
                    <option value="ξ">ξ (Xi)</option>
                    <option value="ℰ">ℰ (Curly E)</option>
                    <option value="S">S (Sample Space)</option>
                    <option value="Ω">Ω (Omega)</option>
                  </select>
                </div>
              </div>

              {state.universalLabelPos !== 'none' && (
                <div className="flex items-center justify-between gap-2">
                  <label className="flex items-center gap-2 text-xs text-gray-700 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={state.showUniversalTotal}
                      onChange={e =>
                        updateState(prev => ({
                          ...prev,
                          showUniversalTotal: e.target.checked
                        }))
                      }
                      className="rounded border-gray-300 text-gray-900"
                    />
                    Show Total next to Symbol
                  </label>
                  {state.showUniversalTotal && (
                    <input
                      type="text"
                      value={state.universalTotal}
                      onChange={e =>
                        updateState(prev => ({ ...prev, universalTotal: e.target.value }))
                      }
                      placeholder={
                        computedTotals.grandTotal !== null
                          ? `Auto (${computedTotals.grandTotal})`
                          : 'Total...'
                      }
                      className="w-28 border border-gray-300 rounded px-2 py-1 text-xs font-serif"
                    />
                  )}
                </div>
              )}
            </div>

            {/* Typography & Labels */}
            <div className="space-y-3 pt-3 border-t border-gray-200">
              <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider">
                Typography (Times New Roman)
              </label>
              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="block text-xs text-gray-600 mb-1">Region Font Size (pt)</label>
                  <input
                    type="number"
                    min={8}
                    max={28}
                    value={state.fontSize}
                    onChange={e =>
                      updateState(prev => ({
                        ...prev,
                        fontSize: Math.max(8, Number(e.target.value) || 12)
                      }))
                    }
                    className="w-full border border-gray-300 rounded px-2.5 py-1.5 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-600 mb-1">Set Label Size (pt)</label>
                  <input
                    type="number"
                    min={8}
                    max={32}
                    value={state.setLabelFontSize}
                    onChange={e =>
                      updateState(prev => ({
                        ...prev,
                        setLabelFontSize: Math.max(8, Number(e.target.value) || 13)
                      }))
                    }
                    className="w-full border border-gray-300 rounded px-2.5 py-1.5 text-sm"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="block text-xs text-gray-600 mb-1">Set Label Placement</label>
                  <select
                    value={state.setLabelPosition}
                    onChange={e =>
                      updateState(prev => ({
                        ...prev,
                        setLabelPosition: e.target.value as 'inside' | 'outside'
                      }))
                    }
                    className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm bg-white"
                  >
                    <option value="inside">Inside Set Perimeter</option>
                    <option value="outside">Outside Set Perimeter</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-gray-600 mb-1">Outside Region Corner</label>
                  <select
                    value={state.outsideValueCorner}
                    onChange={e =>
                      updateState(prev => ({
                        ...prev,
                        outsideValueCorner: e.target.value as VennState['outsideValueCorner']
                      }))
                    }
                    className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm bg-white"
                  >
                    <option value="bottom-right">Bottom-Right</option>
                    <option value="bottom-left">Bottom-Left</option>
                    <option value="top-right">Top-Right</option>
                  </select>
                </div>
              </div>

              <label className="flex items-center gap-2 text-xs text-gray-700 cursor-pointer">
                <input
                  type="checkbox"
                  checked={state.showSetTotalsInLabels}
                  onChange={e =>
                    updateState(prev => ({
                      ...prev,
                      showSetTotalsInLabels: e.target.checked
                    }))
                  }
                  className="rounded border-gray-300 text-gray-900"
                />
                Show Set Total in Set Label (e.g. A (17))
              </label>

              <label className="flex items-center gap-2 text-xs text-gray-700 cursor-pointer">
                <input
                  type="checkbox"
                  checked={state.showRegionNotationOnCanvas}
                  onChange={e =>
                    updateState(prev => ({
                      ...prev,
                      showRegionNotationOnCanvas: e.target.checked
                    }))
                  }
                  className="rounded border-gray-300 text-gray-900"
                />
                Display Set Notation in Regions (e.g. A &cap; B)
              </label>
            </div>

            {/* Outlines & Individual Set Geometry */}
            <div className="space-y-3 pt-3 border-t border-gray-200">
              <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider">
                Set Borders &amp; Geometry
              </label>

              {state.shapeType === 'rectangle' && (
                <div>
                  <label className="block text-xs text-gray-600 mb-1">
                    Rectangle Corner Radius ({state.rectCornerRadius}px)
                  </label>
                  <input
                    type="range"
                    min={0}
                    max={24}
                    step={1}
                    value={state.rectCornerRadius}
                    onChange={e =>
                      updateState(prev => ({
                        ...prev,
                        rectCornerRadius: Number(e.target.value)
                      }))
                    }
                    className="w-full accent-gray-800"
                  />
                </div>
              )}

              {activeSets.map(set => (
                <div
                  key={set.id}
                  id={`gui-set-geom-${set.id}`}
                  className={`p-2.5 rounded-lg border space-y-2 transition-all ${
                    highlightedControlId === `gui-set-geom-${set.id}`
                      ? 'ring-2 ring-gray-900 bg-amber-50 border-gray-900 shadow-sm'
                      : 'bg-gray-50 border-gray-200'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-serif font-bold text-xs text-gray-800">
                      Set {set.label}
                    </span>
                    <div className="flex items-center gap-1.5">
                      <select
                        value={set.strokeStyle}
                        onChange={e =>
                          updateSet(set.id, {
                            strokeStyle: e.target.value as VennSetDef['strokeStyle']
                          })
                        }
                        className="border border-gray-300 rounded px-1.5 py-0.5 text-xs bg-white"
                      >
                        <option value="solid">Solid</option>
                        <option value="dashed">Dashed</option>
                        <option value="dotted">Dotted</option>
                      </select>
                    </div>
                  </div>
                  <div className="grid grid-cols-4 gap-1.5 text-[11px]">
                    <div>
                      <span className="text-gray-400 block">X</span>
                      <input
                        type="number"
                        value={set.cx}
                        onChange={e => updateSet(set.id, { cx: Number(e.target.value) || 0 })}
                        className="w-full border border-gray-300 rounded px-1.5 py-0.5 bg-white"
                      />
                    </div>
                    <div>
                      <span className="text-gray-400 block">Y</span>
                      <input
                        type="number"
                        value={set.cy}
                        onChange={e => updateSet(set.id, { cy: Number(e.target.value) || 0 })}
                        className="w-full border border-gray-300 rounded px-1.5 py-0.5 bg-white"
                      />
                    </div>
                    <div>
                      <span className="text-gray-400 block">
                        {state.shapeType === 'rectangle' ? 'W/2' : 'Rx'}
                      </span>
                      <input
                        type="number"
                        min={15}
                        value={set.rx}
                        onChange={e => {
                          const val = Math.max(15, Number(e.target.value) || 50);
                          updateSet(
                            set.id,
                            state.shapeType === 'circle' ? { rx: val, ry: val } : { rx: val }
                          );
                        }}
                        className="w-full border border-gray-300 rounded px-1.5 py-0.5 bg-white"
                      />
                    </div>
                    {state.shapeType !== 'circle' && (
                      <div>
                        <span className="text-gray-400 block">
                          {state.shapeType === 'rectangle' ? 'H/2' : 'Ry'}
                        </span>
                        <input
                          type="number"
                          min={15}
                          value={set.ry}
                          onChange={e =>
                            updateSet(set.id, {
                              ry: Math.max(15, Number(e.target.value) || 50)
                            })
                          }
                          className="w-full border border-gray-300 rounded px-1.5 py-0.5 bg-white"
                        />
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Interactive Tips Footer */}
      <div className="p-3 bg-gray-50 border-t border-gray-200 text-[11px] text-gray-500 flex items-start gap-2">
        <HelpCircle size={14} className="shrink-0 mt-0.5 text-gray-400" />
        <span>
          <b>Tip:</b> <b>Right-click</b> (or double-click) any title, label, region, or shape on the diagram to edit, hide/delete, or jump directly to its sidebar control.
        </span>
      </div>
    </aside>
  );
};
