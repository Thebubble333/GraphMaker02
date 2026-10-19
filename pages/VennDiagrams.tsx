import React, { useState, useMemo, useCallback } from 'react';
import {
  CircleDot,
  Square,
  MousePointer,
  PaintBucket,
  MoveHorizontal,
  MoveVertical,
  Plus,
  Minus
} from 'lucide-react';
import { CM_TO_PX } from '../constants';
import { GraphToolbar } from '../components/GraphToolbar';
import { useGraphInteraction } from '../hooks/useGraphInteraction';
import { useDragSystem } from '../hooks/useDragSystem';
import { useHistory } from '../hooks/useHistory';
import {
  VennShapeType,
  VennTopologyPreset,
  InputMethod,
  VennSetDef,
  VennRegionDef,
  ValueDisplayMode,
  VennSizePreset,
  VennState,
  VennContextMenuState,
  VENN_SIZE_PRESETS,
  DEFAULT_STATE,
  getBoxGeometryForCm,
  generatePresetSets,
  formatAsSimplifiedFraction,
  signedDistToSet,
  evaluateSetExpression,
  getRegionMetaForSets,
  computeRegionCenters,
  computeSetLabelAnchors,
  computeVennTotals,
  getShadingPresets
} from '../utils/vennLogic';
import { VennSidebar } from '../components/venn/VennSidebar';
import { VennCanvas } from '../components/venn/VennCanvas';
import { VennContextMenu } from '../components/venn/VennContextMenu';

export type {
  VennShapeType,
  VennTopologyPreset,
  InputMethod,
  VennSetDef,
  VennRegionDef,
  ValueDisplayMode,
  VennSizePreset
};
export { VENN_SIZE_PRESETS, getBoxGeometryForCm };

const VennDiagrams: React.FC = () => {
  const [state, setState] = useState<VennState>(DEFAULT_STATE);
  const [activeTab, setActiveTab] = useState<'data' | 'shading' | 'style'>('data');
  const [inputMethod, setInputMethod] = useState<InputMethod>('regions');
  const [canvasTool, setCanvasTool] = useState<'manipulate' | 'shade'>('manipulate');
  const [setExpressionInput, setSetExpressionInput] = useState<string>('A ∩ B');
  const [expressionError, setExpressionError] = useState<string | null>(null);
  const [solverMessage, setSolverMessage] = useState<{ type: 'ok' | 'warn'; text: string } | null>(null);
  const [selectedSetId, setSelectedSetId] = useState<number | 'all'>('all');
  const [highlightedControlId, setHighlightedControlId] = useState<string | null>(null);
  const [contextMenu, setContextMenu] = useState<VennContextMenuState | null>(null);

  // History & Persistence
  const {
    forceSnapshot,
    undo,
    redo,
    canUndo,
    canRedo,
    exportToFile,
    importFromFile
  } = useHistory<VennState>({
    appId: 'VennDiagrams',
    version: 4,
    currentState: state,
    onRestore: restored => {
      const normalizedSym =
        restored.universalSymbol === '\\xi'
          ? 'ξ'
          : restored.universalSymbol === '\\mathcal{E}'
          ? 'ℰ'
          : restored.universalSymbol === '\\Omega'
          ? 'Ω'
          : restored.universalSymbol || 'U';
      setState({
        ...DEFAULT_STATE,
        ...restored,
        universalSymbol: normalizedSym,
        valueDisplayMode: restored.valueDisplayMode || 'counts'
      });
    }
  });

  const updateState = useCallback((updater: (prev: VennState) => VennState) => {
    setState(prev => updater(prev));
  }, []);

  // Canvas dimensions in pixels
  const companionTableWidth = state.numSets === 2 && state.showCompanionTable ? 210 : 0;
  const baseWidthPx = Math.round(state.dimCm.width * CM_TO_PX);
  const widthPixels = baseWidthPx + companionTableWidth;
  const heightPixels = Math.round(state.dimCm.height * CM_TO_PX);

  // Universal box bounds in SVG coordinates
  const boxGeometry = useMemo(() => {
    return getBoxGeometryForCm(state.dimCm.width, state.dimCm.height, Boolean(state.chartTitle));
  }, [state.dimCm.width, state.dimCm.height, state.chartTitle]);

  // Unified Zoom / Crop / Export Hook
  const {
    previewScale,
    setPreviewScale,
    exportDpi,
    setExportDpi,
    cropMode,
    setCropMode,
    selectionBox,
    customViewBox,
    containerRef,
    handleAutoCrop,
    handleResetView,
    handleZoomOutCanvas,
    handleFitToScreen,
    handleExportPNG,
    handleExportSVG,
    handleCopy,
    isCopied,
    handleCropMouseDown,
    handleCropMouseMove,
    handleCropMouseUp
  } = useGraphInteraction(
    'venn-svg',
    widthPixels,
    heightPixels,
    state.dimCm.width + companionTableWidth / CM_TO_PX,
    false,
    false,
    18
  );

  const { onMouseDown, onMouseMove, onMouseUp } = useDragSystem(previewScale);

  const handleGlobalMouseMove = (e: React.MouseEvent) => {
    if (handleCropMouseMove(e)) return;
    onMouseMove(e);
  };

  const handleGlobalMouseUp = () => {
    handleCropMouseUp();
    onMouseUp();
  };

  const activeSets = useMemo(() => state.sets.slice(0, state.numSets), [state.sets, state.numSets]);
  const totalRegions = 1 << state.numSets;

  const getRegionMeta = useCallback(
    (mask: number) => getRegionMetaForSets(state.numSets, state.sets, mask),
    [state.numSets, state.sets]
  );

  const regionCenters = useMemo(
    () =>
      computeRegionCenters(
        boxGeometry,
        activeSets,
        state.numSets,
        state.shapeType,
        state.outsideValueCorner,
        totalRegions
      ),
    [boxGeometry, activeSets, state.numSets, state.shapeType, state.outsideValueCorner, totalRegions]
  );

  const setLabelAnchors = useMemo(
    () =>
      computeSetLabelAnchors(
        activeSets,
        boxGeometry.cx,
        boxGeometry.cy,
        state.numSets,
        state.setLabelPosition,
        state.shapeType
      ),
    [activeSets, boxGeometry.cx, boxGeometry.cy, state.numSets, state.setLabelPosition, state.shapeType]
  );

  const computedTotals = useMemo(
    () => computeVennTotals(state.regions, state.numSets, totalRegions),
    [state.regions, state.numSets, totalRegions]
  );

  const formatDisplayValue = useCallback(
    (rawVal: string | number | null): string => {
      if (rawVal === null || rawVal === undefined) return '';
      const str = String(rawVal).trim();
      if (!str) return '';
      if (state.valueDisplayMode === 'counts') return str;

      const num = Number(str);
      if (isNaN(num) || !isFinite(num)) return str;

      const grand = computedTotals.grandTotal;
      if (grand === null || grand <= 0) return str;

      if (state.valueDisplayMode === 'probabilities-fraction') {
        if (Math.abs(grand - 1) < 1e-6) {
          const scaledN = Math.round(num * 1000);
          return formatAsSimplifiedFraction(scaledN, 1000);
        }
        return formatAsSimplifiedFraction(num, grand);
      }

      const prob = Math.abs(grand - 1) < 1e-6 ? num : num / grand;
      return String(Number(prob.toFixed(3)));
    },
    [state.valueDisplayMode, computedTotals.grandTotal]
  );

  const handleNormalizeRegionsToProbabilities = () => {
    const grand = computedTotals.grandTotal;
    if (grand === null || grand <= 0) return;
    forceSnapshot();
    updateState(prev => {
      const nextRegions = { ...prev.regions };
      for (let m = 0; m < totalRegions; m++) {
        const raw = nextRegions[m]?.value?.trim() || '0';
        const num = Number(raw);
        if (!isNaN(num) && isFinite(num)) {
          nextRegions[m] = {
            ...nextRegions[m],
            value: String(Number((num / grand).toFixed(3)))
          };
        }
      }
      return {
        ...prev,
        valueDisplayMode: 'probabilities-decimal',
        totalsInput: {
          ...prev.totalsInput,
          totalU: '1'
        },
        regions: nextRegions
      };
    });
  };

  const handleSelectNumSets = (n: 1 | 2 | 3) => {
    forceSnapshot();
    updateState(prev => {
      const validTopology =
        n === 1
          ? 'standard'
          : n === 2
          ? ['standard', 'disjoint', 'subset-b-in-a', 'subset-a-in-b'].includes(prev.topology)
            ? prev.topology
            : 'standard'
          : ['standard', 'disjoint', 'chain', 'nested-all', 'subsets-in-a', 'ab-overlap-c-disjoint'].includes(
              prev.topology
            )
          ? prev.topology
          : 'standard';

      return {
        ...prev,
        numSets: n,
        topology: validTopology as VennTopologyPreset,
        sets: generatePresetSets(
          n,
          prev.shapeType,
          validTopology as VennTopologyPreset,
          prev.sets,
          prev.dimCm,
          Boolean(prev.chartTitle)
        ),
        regions: Object.fromEntries(
          Object.entries(prev.regions).map(([k, v]) => [k, { ...v, labelOffset: { x: 0, y: 0 } }])
        )
      };
    });
    if (n !== 2 && inputMethod === 'twoway') {
      setInputMethod('regions');
    }
  };

  const handleSelectShapeType = (shapeType: VennShapeType) => {
    forceSnapshot();
    updateState(prev => ({
      ...prev,
      shapeType,
      sets: generatePresetSets(
        prev.numSets,
        shapeType,
        prev.topology,
        prev.sets,
        prev.dimCm,
        Boolean(prev.chartTitle)
      ),
      regions: Object.fromEntries(
        Object.entries(prev.regions).map(([k, v]) => [k, { ...v, labelOffset: { x: 0, y: 0 } }])
      )
    }));
  };

  const handleSelectTopology = (topology: VennTopologyPreset) => {
    forceSnapshot();
    updateState(prev => ({
      ...prev,
      topology,
      sets: generatePresetSets(
        prev.numSets,
        prev.shapeType,
        topology,
        prev.sets,
        prev.dimCm,
        Boolean(prev.chartTitle)
      ),
      regions: Object.fromEntries(
        Object.entries(prev.regions).map(([k, v]) => [k, { ...v, labelOffset: { x: 0, y: 0 } }])
      )
    }));
  };

  const handleApplySizePreset = (presetKey: VennSizePreset) => {
    forceSnapshot();
    const p = VENN_SIZE_PRESETS[presetKey];
    updateState(prev => {
      const oldBox = getBoxGeometryForCm(
        prev.dimCm.width,
        prev.dimCm.height,
        Boolean(prev.chartTitle)
      );
      const newBox = getBoxGeometryForCm(p.widthCm, p.heightCm, Boolean(prev.chartTitle));
      const ratio = Math.min(newBox.w / Math.max(1, oldBox.w), newBox.h / Math.max(1, oldBox.h));

      const scaledSets = prev.sets.map(s => {
        const nextRx = Math.max(14, Math.round(s.rx * ratio));
        const nextRy =
          prev.shapeType === 'circle'
            ? nextRx
            : Math.max(14, Math.round(s.ry * ratio));
        return {
          ...s,
          cx: Math.round(s.cx * ratio),
          cy: Math.round(s.cy * ratio),
          rx: nextRx,
          ry: nextRy,
          labelOffset: {
            x: Math.round(s.labelOffset.x * ratio),
            y: Math.round(s.labelOffset.y * ratio)
          }
        };
      });

      return {
        ...prev,
        dimCm: { width: p.widthCm, height: p.heightCm },
        fontSize: p.fontSize,
        setLabelFontSize: p.setLabelFontSize,
        blankBoxWidth: p.blankBoxWidth,
        blankBoxHeight: p.blankBoxHeight,
        sets: scaledSets,
        regions: Object.fromEntries(
          Object.entries(prev.regions).map(([k, v]) => [
            k,
            {
              ...v,
              labelOffset: {
                x: Math.round(v.labelOffset.x * ratio),
                y: Math.round(v.labelOffset.y * ratio)
              }
            }
          ])
        )
      };
    });
  };

  const updateRegion = (mask: number, updates: Partial<VennRegionDef>) => {
    updateState(prev => ({
      ...prev,
      regions: {
        ...prev.regions,
        [mask]: { ...prev.regions[mask], ...updates }
      }
    }));
  };

  const updateSet = (id: number, updates: Partial<VennSetDef>) => {
    updateState(prev => ({
      ...prev,
      sets: prev.sets.map(s => (s.id === id ? { ...s, ...updates } : s))
    }));
  };

  const handleSolveTotals = () => {
    forceSnapshot();
    const t = state.totalsInput;
    const parseVal = (s: string) => {
      const n = parseFloat(s);
      return isNaN(n) ? 0 : n;
    };

    const fmt = (n: number) => String(Number(n.toFixed(4)));

    if (state.numSets === 1) {
      const nA = parseVal(t.nA);
      const out = t.useOutsideInsteadOfU ? parseVal(t.nOutside) : parseVal(t.totalU) - nA;
      const hasNeg = nA < 0 || out < 0;
      updateState(prev => ({
        ...prev,
        regions: {
          ...prev.regions,
          1: { ...prev.regions[1], value: fmt(nA) },
          0: { ...prev.regions[0], value: fmt(out) }
        }
      }));
      setSolverMessage(
        hasNeg
          ? { type: 'warn', text: 'Warning: One or more regions evaluated to a negative value.' }
          : { type: 'ok', text: 'Regions updated from Set Totals.' }
      );
      return;
    }

    if (state.numSets === 2) {
      const nA = parseVal(t.nA);
      const nB = parseVal(t.nB);
      const nAB = parseVal(t.nAB);
      const onlyA = nA - nAB;
      const onlyB = nB - nAB;
      const unionAB = onlyA + onlyB + nAB;
      const out = t.useOutsideInsteadOfU ? parseVal(t.nOutside) : parseVal(t.totalU) - unionAB;
      const hasNeg = onlyA < 0 || onlyB < 0 || nAB < 0 || out < 0;

      updateState(prev => ({
        ...prev,
        regions: {
          ...prev.regions,
          1: { ...prev.regions[1], value: fmt(onlyA) },
          2: { ...prev.regions[2], value: fmt(onlyB) },
          3: { ...prev.regions[3], value: fmt(nAB) },
          0: { ...prev.regions[0], value: fmt(out) }
        }
      }));
      setSolverMessage(
        hasNeg
          ? {
              type: 'warn',
              text: 'Inconsistent totals: one or more exclusive regions are negative.'
            }
          : {
              type: 'ok',
              text: `Solved: n(A only)=${fmt(onlyA)}, n(A∩B)=${fmt(nAB)}, n(B only)=${fmt(onlyB)}, Outside=${fmt(out)}.`
            }
      );
      return;
    }

    const nA = parseVal(t.nA);
    const nB = parseVal(t.nB);
    const nC = parseVal(t.nC);
    const nAB = parseVal(t.nAB);
    const nAC = parseVal(t.nAC);
    const nBC = parseVal(t.nBC);
    const nABC = parseVal(t.nABC);

    const onlyAB = nAB - nABC;
    const onlyAC = nAC - nABC;
    const onlyBC = nBC - nABC;
    const onlyA = nA - onlyAB - onlyAC - nABC;
    const onlyB = nB - onlyAB - onlyBC - nABC;
    const onlyC = nC - onlyAC - onlyBC - nABC;
    const unionABC = onlyA + onlyB + onlyC + onlyAB + onlyAC + onlyBC + nABC;
    const out = t.useOutsideInsteadOfU ? parseVal(t.nOutside) : parseVal(t.totalU) - unionABC;

    const vals = [out, onlyA, onlyB, onlyAB, onlyC, onlyAC, onlyBC, nABC];
    const hasNeg = vals.some(v => v < 0);

    updateState(prev => ({
      ...prev,
      regions: {
        0: { ...prev.regions[0], value: fmt(out) },
        1: { ...prev.regions[1], value: fmt(onlyA) },
        2: { ...prev.regions[2], value: fmt(onlyB) },
        3: { ...prev.regions[3], value: fmt(onlyAB) },
        4: { ...prev.regions[4], value: fmt(onlyC) },
        5: { ...prev.regions[5], value: fmt(onlyAC) },
        6: { ...prev.regions[6], value: fmt(onlyBC) },
        7: { ...prev.regions[7], value: fmt(nABC) }
      }
    }));

    setSolverMessage(
      hasNeg
        ? {
            type: 'warn',
            text: 'Inconsistent totals: one or more exclusive regions are negative.'
          }
        : {
            type: 'ok',
            text: `Solved all 8 regions! n(A∪B∪C) = ${fmt(unionABC)}, Outside = ${fmt(out)}.`
          }
    );
  };

  const applyElementLists = useCallback(
    (listsOverride?: VennState['elementLists']) => {
      forceSnapshot();
      const elConfig = listsOverride || state.elementLists;
      const parseItems = (raw: string): string[] =>
        Array.from(
          new Set(
            raw
              .split(/[,;\n\t]+/)
              .map(s => s.trim())
              .filter(Boolean)
          )
        );

      const listU = parseItems(elConfig.universal);
      const listA = parseItems(elConfig.setA);
      const listB = state.numSets >= 2 ? parseItems(elConfig.setB) : [];
      const listC = state.numSets >= 3 ? parseItems(elConfig.setC) : [];

      const setASet = new Set(listA);
      const setBSet = new Set(listB);
      const setCSet = new Set(listC);

      const allElements = Array.from(new Set([...listU, ...listA, ...listB, ...listC]));

      const buckets: Record<number, string[]> = {
        0: [],
        1: [],
        2: [],
        3: [],
        4: [],
        5: [],
        6: [],
        7: []
      };

      allElements.forEach(item => {
        const m =
          (setASet.has(item) ? 1 : 0) |
          (setBSet.has(item) ? 2 : 0) |
          (setCSet.has(item) ? 4 : 0);
        buckets[m].push(item);
      });

      updateState(prev => {
        const nextRegions = { ...prev.regions };
        for (let m = 0; m < 8; m++) {
          const items = buckets[m] || [];
          let val = '';
          if (elConfig.displayMode === 'counts') {
            val = String(items.length);
          } else {
            val = elConfig.bulletPoints
              ? items.map(x => `• ${x}`).join(', ')
              : items.join(', ');
          }
          nextRegions[m] = {
            ...nextRegions[m],
            value: val
          };
        }
        return {
          ...prev,
          elementLists: elConfig,
          regions: nextRegions
        };
      });
    },
    [forceSnapshot, state.elementLists, state.numSets, updateState]
  );

  const handleApplySetExpression = (exprOverride?: string) => {
    const expr = exprOverride !== undefined ? exprOverride : setExpressionInput;
    if (exprOverride !== undefined) setSetExpressionInput(exprOverride);

    const customLabels = state.sets.map(s => s.label);
    const nextShaded: Record<number, boolean> = {};
    for (let m = 0; m < totalRegions; m++) {
      const res = evaluateSetExpression(expr, m, state.numSets, customLabels);
      if (res === null) {
        setExpressionError(
          `Could not parse "${expr}". Use sets A, B, C and operators ∪ (or |), ∩ (or &), ' (complement), \\ (difference).`
        );
        return;
      }
      nextShaded[m] = res;
    }

    setExpressionError(null);
    forceSnapshot();
    updateState(prev => {
      const updated = { ...prev.regions };
      for (let m = 0; m < totalRegions; m++) {
        updated[m] = { ...updated[m], shaded: !!nextShaded[m] };
      }
      return { ...prev, regions: updated };
    });
  };

  const getSvgCoords = (e: React.MouseEvent): { x: number; y: number } | null => {
    const svg = document.getElementById('venn-svg') as unknown as SVGSVGElement;
    if (!svg) return null;
    const ctm = svg.getScreenCTM();
    if (!ctm) return null;
    return {
      x: (e.clientX - ctm.e) / ctm.a,
      y: (e.clientY - ctm.f) / ctm.d
    };
  };

  const handleResizeBoxCm = (dWidthCm: number, dHeightCm: number) => {
    forceSnapshot();
    updateState(prev => ({
      ...prev,
      dimCm: {
        width: Math.max(4, Math.min(32, Number((prev.dimCm.width + dWidthCm).toFixed(2)))),
        height: Math.max(3, Math.min(26, Number((prev.dimCm.height + dHeightCm).toFixed(2))))
      }
    }));
  };

  const handleFitBorderToShapes = () => {
    forceSnapshot();
    let maxExtentX = 45;
    let maxExtentY = 35;
    activeSets.forEach(s => {
      const rx = s.rx;
      const ry = state.shapeType === 'circle' ? s.rx : s.ry;
      maxExtentX = Math.max(maxExtentX, Math.abs(s.cx) + rx);
      maxExtentY = Math.max(maxExtentY, Math.abs(s.cy) + ry);
    });
    const desiredBoxW = maxExtentX * 2 + 44;
    const desiredBoxH = maxExtentY * 2 + 38;
    const topPad = state.chartTitle ? 32 : 14;
    const totalW = desiredBoxW + 18 + 18;
    const totalH = desiredBoxH + topPad + 14;
    updateState(prev => ({
      ...prev,
      dimCm: {
        width: Math.max(4, Math.min(30, Number((totalW / CM_TO_PX).toFixed(1)))),
        height: Math.max(3, Math.min(25, Number((totalH / CM_TO_PX).toFixed(1))))
      }
    }));
  };

  const handleFitShapesInsideBorder = () => {
    forceSnapshot();
    updateState(prev => ({
      ...prev,
      sets: generatePresetSets(
        prev.numSets,
        prev.shapeType,
        prev.topology,
        prev.sets,
        prev.dimCm,
        Boolean(prev.chartTitle)
      ),
      regions: Object.fromEntries(
        Object.entries(prev.regions).map(([k, v]) => [k, { ...v, labelOffset: { x: 0, y: 0 } }])
      )
    }));
  };

  const handleResizeShapes = (dRx: number, dRy: number, target: number | 'all' = selectedSetId) => {
    forceSnapshot();
    updateState(prev => ({
      ...prev,
      sets: prev.sets.map((s, idx) => {
        if (idx >= prev.numSets) return s;
        if (target !== 'all' && s.id !== target) return s;
        const nextRx = Math.max(14, Math.min(260, Math.round(s.rx + dRx)));
        const nextRy =
          prev.shapeType === 'circle'
            ? nextRx
            : Math.max(14, Math.min(220, Math.round(s.ry + dRy)));
        return { ...s, rx: nextRx, ry: nextRy };
      })
    }));
  };

  const handleAdjustSetSpacing = (delta: number) => {
    if (state.numSets < 2) return;
    forceSnapshot();
    updateState(prev => ({
      ...prev,
      sets: prev.sets.map((s, idx) => {
        if (idx >= prev.numSets) return s;
        const dist = Math.hypot(s.cx, s.cy);
        if (dist < 2) {
          if (prev.numSets === 2) {
            return { ...s, cx: idx === 0 ? -delta : delta };
          }
          const angle = idx === 0 ? -Math.PI * 0.75 : idx === 1 ? -Math.PI * 0.25 : Math.PI * 0.5;
          return {
            ...s,
            cx: Math.round(Math.cos(angle) * delta),
            cy: Math.round(Math.sin(angle) * delta)
          };
        }
        const scale = Math.max(0.15, (dist + delta) / dist);
        return {
          ...s,
          cx: Math.round(s.cx * scale),
          cy: Math.round(s.cy * scale)
        };
      })
    }));
  };

  const navigateToGuiControl = useCallback(
    (
      tab: 'data' | 'shading' | 'style',
      controlId: string,
      inputSelector?: string,
      forceDirectRegions?: boolean
    ) => {
      setContextMenu(null);
      setActiveTab(tab);
      if (forceDirectRegions) {
        setInputMethod('regions');
      }
      setHighlightedControlId(controlId);

      setTimeout(() => {
        const el = document.getElementById(controlId);
        if (el) {
          el.scrollIntoView({ behavior: 'smooth', block: 'center' });
          const inp = (
            inputSelector ? el.querySelector(inputSelector) : el.querySelector('input, select, textarea')
          ) as HTMLElement | null;
          if (inp && typeof inp.focus === 'function') {
            inp.focus();
            if ('select' in inp && typeof (inp as HTMLInputElement).select === 'function') {
              (inp as HTMLInputElement).select();
            }
          }
        }
      }, 60);

      setTimeout(() => {
        setHighlightedControlId(prev => (prev === controlId ? null : prev));
      }, 2400);
    },
    []
  );

  const openElementContextMenu = (
    e: React.MouseEvent,
    targetType: VennContextMenuState['targetType'],
    opts?: { setId?: number; regionMask?: number }
  ) => {
    e.preventDefault();
    e.stopPropagation();
    const menuWidth = 260;
    const menuHeight = 250;
    const x = Math.min(e.clientX, window.innerWidth - menuWidth - 12);
    const y = Math.min(e.clientY, window.innerHeight - menuHeight - 12);
    setContextMenu({
      x: Math.max(8, x),
      y: Math.max(8, y),
      targetType,
      setId: opts?.setId,
      regionMask: opts?.regionMask
    });
  };

  const handleSvgContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    const pt = getSvgCoords(e);
    if (!pt) return;

    const relX = pt.x - boxGeometry.cx;
    const relY = pt.y - boxGeometry.cy;
    const distLeft = Math.abs(pt.x - boxGeometry.x);
    const distRight = Math.abs(pt.x - (boxGeometry.x + boxGeometry.w));
    const distTop = Math.abs(pt.y - boxGeometry.y);
    const distBottom = Math.abs(pt.y - (boxGeometry.y + boxGeometry.h));
    const nearOuterBorder =
      Math.min(distLeft, distRight, distTop, distBottom) <= 8 &&
      pt.x >= boxGeometry.x - 8 &&
      pt.x <= boxGeometry.x + boxGeometry.w + 8 &&
      pt.y >= boxGeometry.y - 8 &&
      pt.y <= boxGeometry.y + boxGeometry.h + 8;

    if (nearOuterBorder) {
      openElementContextMenu(e, 'border');
      return;
    }

    for (let sIdx = 0; sIdx < state.numSets; sIdx++) {
      const d = signedDistToSet(relX, relY, activeSets[sIdx], state.shapeType);
      if (Math.abs(d) <= 7) {
        setSelectedSetId(activeSets[sIdx].id);
        openElementContextMenu(e, 'set-shape', { setId: activeSets[sIdx].id });
        return;
      }
    }

    const insideU =
      Math.abs(relX) <= boxGeometry.w / 2 && Math.abs(relY) <= boxGeometry.h / 2;
    if (insideU) {
      let mask = 0;
      for (let sIdx = 0; sIdx < state.numSets; sIdx++) {
        const d = signedDistToSet(relX, relY, activeSets[sIdx], state.shapeType);
        if (d >= 0) {
          mask |= 1 << sIdx;
        }
      }
      openElementContextMenu(e, 'region', { regionMask: mask });
      return;
    }

    openElementContextMenu(e, 'border');
  };

  const handleSvgMouseDown = (e: React.MouseEvent) => {
    if (e.button === 2) return;
    if (contextMenu) setContextMenu(null);
    if (cropMode) {
      handleCropMouseDown(e);
      return;
    }

    const pt = getSvgCoords(e);
    if (!pt) return;

    const relX = pt.x - boxGeometry.cx;
    const relY = pt.y - boxGeometry.cy;
    const insideU =
      Math.abs(relX) <= boxGeometry.w / 2 && Math.abs(relY) <= boxGeometry.h / 2;

    if (canvasTool === 'shade' && insideU) {
      let mask = 0;
      for (let sIdx = 0; sIdx < state.numSets; sIdx++) {
        const d = signedDistToSet(relX, relY, activeSets[sIdx], state.shapeType);
        if (d >= 0) {
          mask |= 1 << sIdx;
        }
      }
      forceSnapshot();
      updateRegion(mask, { shaded: !state.regions[mask]?.shaded });
      return;
    }

    if (canvasTool === 'manipulate') {
      const hitSets = activeSets
        .map(s => ({
          set: s,
          d: signedDistToSet(relX, relY, s, state.shapeType),
          area: s.rx * (state.shapeType === 'circle' ? s.rx : s.ry)
        }))
        .filter(item => item.d >= -5);

      if (hitSets.length > 0) {
        const borderHit = hitSets.find(item => Math.abs(item.d) <= 7);
        const chosen = borderHit || hitSets.sort((a, b) => a.area - b.area)[0];
        handleSetDragStart(chosen.set.id, e);
        return;
      }
    }

    setSelectedSetId('all');
  };

  const handleSetDragStart = (setId: number, e: React.MouseEvent) => {
    if (e.button === 2) return;
    if (cropMode) return;
    if (canvasTool === 'shade') return;
    e.stopPropagation();
    setSelectedSetId(setId);
    forceSnapshot();

    const target = state.sets.find(s => s.id === setId);
    if (!target) return;

    onMouseDown(
      e,
      { cx: target.cx, cy: target.cy },
      (dx, dy, init) => {
        updateSet(setId, {
          cx: Math.round(init.cx + dx),
          cy: Math.round(init.cy + dy)
        });
      },
      undefined,
      'move-set'
    );
  };

  const handleSetResizeStart = (
    setId: number,
    handleType: 'e' | 'w' | 's' | 'n' | 'se' | 'sw' | 'ne' | 'nw',
    e: React.MouseEvent
  ) => {
    if (cropMode) return;
    e.stopPropagation();
    setSelectedSetId(setId);
    forceSnapshot();

    const target = state.sets.find(s => s.id === setId);
    if (!target) return;

    const signX = handleType.includes('e') ? 1 : handleType.includes('w') ? -1 : 0;
    const signY = handleType.includes('s') ? 1 : handleType.includes('n') ? -1 : 0;

    onMouseDown(
      e,
      { rx: target.rx, ry: target.ry },
      (dx, dy, init, ev) => {
        if (state.shapeType === 'circle' || ev.shiftKey) {
          const delta =
            signX !== 0 && signY !== 0
              ? (dx * signX + dy * signY) / 2
              : signX !== 0
              ? dx * signX
              : dy * signY;
          const nextR = Math.max(20, Math.min(260, Math.round(init.rx + delta)));
          updateSet(setId, { rx: nextR, ry: nextR });
        } else {
          const nextRx =
            signX !== 0
              ? Math.max(20, Math.min(260, Math.round(init.rx + dx * signX)))
              : init.rx;
          const nextRy =
            signY !== 0
              ? Math.max(20, Math.min(220, Math.round(init.ry + dy * signY)))
              : init.ry;
          updateSet(setId, { rx: nextRx, ry: nextRy });
        }
      },
      undefined,
      'resize-set'
    );
  };

  const handleBoxResizeStart = (
    handleType: 'e' | 'w' | 's' | 'n' | 'se',
    e: React.MouseEvent
  ) => {
    if (cropMode) return;
    e.stopPropagation();
    forceSnapshot();

    const signX = handleType.includes('e') ? 1 : handleType.includes('w') ? -1 : 0;
    const signY = handleType.includes('s') ? 1 : handleType.includes('n') ? -1 : 0;

    onMouseDown(
      e,
      { widthCm: state.dimCm.width, heightCm: state.dimCm.height },
      (dx, dy, init) => {
        const dW = signX !== 0 ? (dx * signX * 2) / CM_TO_PX : 0;
        const dH = signY !== 0 ? (dy * signY * 2) / CM_TO_PX : 0;
        updateState(prev => ({
          ...prev,
          dimCm: {
            width: Math.max(4, Math.min(32, Number((init.widthCm + dW).toFixed(2)))),
            height: Math.max(3, Math.min(26, Number((init.heightCm + dH).toFixed(2))))
          }
        }));
      },
      undefined,
      'resize-box'
    );
  };

  const handleRegionLabelDragStart = (mask: number, e: React.MouseEvent) => {
    if (e.button === 2) return;
    if (cropMode || canvasTool === 'shade') return;
    e.stopPropagation();
    forceSnapshot();

    if (e.shiftKey) {
      updateRegion(mask, { labelOffset: { x: 0, y: 0 } });
      return;
    }

    const currentOffset = state.regions[mask]?.labelOffset || { x: 0, y: 0 };
    onMouseDown(
      e,
      { ...currentOffset },
      (dx, dy, init) => {
        updateRegion(mask, {
          labelOffset: {
            x: Math.round(init.x + dx),
            y: Math.round(init.y + dy)
          }
        });
      },
      undefined,
      'drag-region-label'
    );
  };

  const handleSetLabelDragStart = (setId: number, e: React.MouseEvent) => {
    if (e.button === 2) return;
    if (cropMode || canvasTool === 'shade') return;
    e.stopPropagation();
    forceSnapshot();

    if (e.shiftKey) {
      updateSet(setId, { labelOffset: { x: 0, y: 0 } });
      return;
    }

    const target = state.sets.find(s => s.id === setId);
    if (!target) return;

    onMouseDown(
      e,
      { ...target.labelOffset },
      (dx, dy, init) => {
        updateSet(setId, {
          labelOffset: {
            x: Math.round(init.x + dx),
            y: Math.round(init.y + dy)
          }
        });
      },
      undefined,
      'drag-set-label'
    );
  };

  const handleUniversalLabelDragStart = (e: React.MouseEvent) => {
    if (cropMode || canvasTool === 'shade') return;
    e.stopPropagation();
    forceSnapshot();

    if (e.shiftKey) {
      updateState(prev => ({ ...prev, universalLabelOffset: { x: 0, y: 0 } }));
      return;
    }

    const initOffset = state.universalLabelOffset;
    onMouseDown(
      e,
      { ...initOffset },
      (dx, dy, init) => {
        updateState(prev => ({
          ...prev,
          universalLabelOffset: {
            x: Math.round(init.x + dx),
            y: Math.round(init.y + dy)
          }
        }));
      },
      undefined,
      'drag-u-label'
    );
  };

  const shadingPresets = useMemo(() => getShadingPresets(state.numSets), [state.numSets]);

  return (
    <div
      className="flex h-full flex-col bg-gray-50 select-none"
      onMouseMove={handleGlobalMouseMove}
      onMouseUp={handleGlobalMouseUp}
    >
      {/* Top Header & Unified GraphToolbar */}
      <header className="flex items-center justify-between px-6 py-3 bg-white border-b border-gray-200 shadow-sm z-10">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-gray-100 text-gray-800 rounded-lg border border-gray-200">
            <CircleDot className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-xl font-semibold text-gray-800 leading-tight">
              Venn Diagram Creator
            </h1>
            <p className="text-xs text-gray-500">
              Circular &amp; rectangular Venn diagrams with set solver and notation shading
            </p>
          </div>
        </div>

        {/* Quick Mode Bar + Standard GraphToolbar */}
        <div className="flex items-center gap-3">
          <div className="flex items-center bg-gray-100 p-1 rounded-lg border border-gray-200">
            <button
              onClick={() => setCanvasTool('manipulate')}
              className={`px-2.5 py-1 text-xs font-medium rounded-md flex items-center gap-1.5 transition-colors ${
                canvasTool === 'manipulate'
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
              title="Move & resize sets or drag labels on canvas"
            >
              <MousePointer size={13} /> Move / Resize
            </button>
            <button
              onClick={() => setCanvasTool('shade')}
              className={`px-2.5 py-1 text-xs font-medium rounded-md flex items-center gap-1.5 transition-colors ${
                canvasTool === 'shade'
                  ? 'bg-gray-800 text-white shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
              title="Click any region inside the Venn diagram to toggle shading"
            >
              <PaintBucket size={13} /> Click to Shade
            </button>
          </div>

          <GraphToolbar
            previewScale={previewScale}
            setPreviewScale={setPreviewScale}
            cropMode={cropMode}
            setCropMode={setCropMode}
            onResetView={handleResetView}
            onZoomOutCanvas={handleZoomOutCanvas}
            onAutoCrop={handleAutoCrop}
            onFitToScreen={handleFitToScreen}
            onExportPNG={handleExportPNG}
            onExportSVG={handleExportSVG}
            onCopy={handleCopy}
            isCopied={isCopied}
            exportDpi={exportDpi}
            onDpiChange={setExportDpi}
            onUndo={undo}
            onRedo={redo}
            canUndo={canUndo}
            canRedo={canRedo}
            onExportData={() => exportToFile('venn-diagram-project.json')}
            onImportData={importFromFile}
            onDefaultSettings={() => {
              forceSnapshot();
              setState(DEFAULT_STATE);
            }}
            onClearAll={() => {
              forceSnapshot();
              updateState(prev => ({
                ...prev,
                regions: Object.fromEntries(
                  Object.entries(prev.regions).map(([k, v]) => [
                    k,
                    { ...v, value: '', shaded: false, isBlankBox: false }
                  ])
                )
              }));
            }}
          />
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        {/* Left Configuration Sidebar */}
        <VennSidebar
          state={state}
          activeTab={activeTab}
          setActiveTab={setActiveTab}
          inputMethod={inputMethod}
          setInputMethod={setInputMethod}
          activeSets={activeSets}
          totalRegions={totalRegions}
          computedTotals={computedTotals}
          regionCenters={regionCenters}
          highlightedControlId={highlightedControlId}
          setExpressionInput={setExpressionInput}
          setSetExpressionInput={setSetExpressionInput}
          expressionError={expressionError}
          solverMessage={solverMessage}
          shadingPresets={shadingPresets}
          getRegionMeta={getRegionMeta}
          formatDisplayValue={formatDisplayValue}
          forceSnapshot={forceSnapshot}
          updateState={updateState}
          updateSet={updateSet}
          updateRegion={updateRegion}
          handleSelectNumSets={handleSelectNumSets}
          handleSelectShapeType={handleSelectShapeType}
          handleSelectTopology={handleSelectTopology}
          handleNormalizeRegionsToProbabilities={handleNormalizeRegionsToProbabilities}
          handleSolveTotals={handleSolveTotals}
          applyElementLists={applyElementLists}
          handleApplySetExpression={handleApplySetExpression}
          handleApplySizePreset={handleApplySizePreset}
          handleResizeBoxCm={handleResizeBoxCm}
          handleFitShapesInsideBorder={handleFitShapesInsideBorder}
          handleFitBorderToShapes={handleFitBorderToShapes}
        />

        {/* Main SVG Canvas Area + Top Quick Resize Toolbar */}
        <div className="flex-1 flex flex-col overflow-hidden bg-gray-200">
          {/* Quick Resize & Manipulation Bar */}
          <div className="bg-white border-b border-gray-200 px-4 py-2 flex flex-wrap items-center justify-between gap-3 text-xs shadow-xs z-10">
            {/* Rectangle Border Quick Resize Buttons & Size Presets */}
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="font-bold text-gray-600 uppercase tracking-wider text-[11px] mr-0.5 flex items-center gap-1">
                <Square size={12} className="text-gray-500" /> Size Preset:
              </span>

              <div className="inline-flex rounded-md border border-gray-300 bg-gray-100 p-0.5">
                {(['small', 'medium', 'large'] as const).map(pKey => {
                  const preset = VENN_SIZE_PRESETS[pKey];
                  const isCurrent =
                    Math.abs(state.dimCm.width - preset.widthCm) < 0.15 &&
                    Math.abs(state.dimCm.height - preset.heightCm) < 0.15;
                  return (
                    <button
                      key={pKey}
                      onClick={() => handleApplySizePreset(pKey)}
                      className={`px-2 py-0.5 rounded text-[11px] font-semibold transition-colors ${
                        isCurrent
                          ? 'bg-gray-800 text-white'
                          : 'text-gray-600 hover:text-gray-900'
                      }`}
                      title={`${preset.label} — ${preset.desc}`}
                    >
                      {preset.shortLabel}
                    </button>
                  );
                })}
              </div>

              <span className="font-bold text-gray-600 uppercase tracking-wider text-[11px] ml-1 mr-0.5">
                Border:
              </span>
              <div className="inline-flex rounded-md border border-gray-300 bg-gray-50 p-0.5 gap-0.5">
                <button
                  onClick={() => handleResizeBoxCm(-0.5, 0)}
                  className="px-2 py-1 rounded bg-white hover:bg-gray-100 text-gray-700 font-medium flex items-center gap-1 border border-gray-200 transition-colors"
                  title="Make outer rectangle border narrower"
                >
                  <MoveHorizontal size={12} /> Narrower
                </button>
                <button
                  onClick={() => handleResizeBoxCm(0.5, 0)}
                  className="px-2 py-1 rounded bg-white hover:bg-gray-100 text-gray-700 font-medium flex items-center gap-1 border border-gray-200 transition-colors"
                  title="Make outer rectangle border wider"
                >
                  <MoveHorizontal size={12} /> Wider
                </button>
              </div>

              <div className="inline-flex rounded-md border border-gray-300 bg-gray-50 p-0.5 gap-0.5">
                <button
                  onClick={() => handleResizeBoxCm(0, -0.5)}
                  className="px-2 py-1 rounded bg-white hover:bg-gray-100 text-gray-700 font-medium flex items-center gap-1 border border-gray-200 transition-colors"
                  title="Make outer rectangle border shorter"
                >
                  <MoveVertical size={12} /> Shorter
                </button>
                <button
                  onClick={() => handleResizeBoxCm(0, 0.5)}
                  className="px-2 py-1 rounded bg-white hover:bg-gray-100 text-gray-700 font-medium flex items-center gap-1 border border-gray-200 transition-colors"
                  title="Make outer rectangle border taller"
                >
                  <MoveVertical size={12} /> Taller
                </button>
              </div>

              <button
                onClick={handleFitShapesInsideBorder}
                className="px-2 py-1 rounded border border-gray-300 bg-white hover:bg-gray-100 text-gray-700 font-medium transition-colors"
                title="Automatically fit the Venn shapes neatly inside the current rectangle border"
              >
                Fit Shapes
              </button>
            </div>

            {/* Circles / Shapes Quick Resize Buttons */}
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="font-bold text-gray-600 uppercase tracking-wider text-[11px] mr-0.5 flex items-center gap-1">
                <CircleDot size={12} className="text-gray-500" /> Resize Shapes:
              </span>

              <div className="inline-flex rounded-md border border-gray-300 bg-gray-100 p-0.5">
                <button
                  onClick={() => setSelectedSetId('all')}
                  className={`px-2 py-0.5 rounded text-[11px] font-semibold transition-colors ${
                    selectedSetId === 'all'
                      ? 'bg-gray-800 text-white'
                      : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  All
                </button>
                {activeSets.map(s => (
                  <button
                    key={s.id}
                    onClick={() => setSelectedSetId(s.id)}
                    className={`px-2 py-0.5 rounded text-[11px] font-serif font-bold transition-colors ${
                      selectedSetId === s.id
                        ? 'bg-gray-800 text-white'
                        : 'text-gray-700 hover:text-gray-900'
                    }`}
                  >
                    Set {s.label}
                  </button>
                ))}
              </div>

              <div className="inline-flex rounded-md border border-gray-300 bg-gray-50 p-0.5 gap-0.5">
                <button
                  onClick={() => handleResizeShapes(-8, -8)}
                  className="px-2 py-1 rounded bg-white hover:bg-gray-100 text-gray-700 font-medium flex items-center gap-1 border border-gray-200 transition-colors"
                  title="Make selected circle(s)/shape(s) smaller"
                >
                  <Minus size={12} /> Smaller
                </button>
                <button
                  onClick={() => handleResizeShapes(8, 8)}
                  className="px-2 py-1 rounded bg-white hover:bg-gray-100 text-gray-700 font-medium flex items-center gap-1 border border-gray-200 transition-colors"
                  title="Make selected circle(s)/shape(s) larger"
                >
                  <Plus size={12} /> Larger
                </button>
              </div>

              {state.shapeType !== 'circle' && (
                <div className="inline-flex rounded-md border border-gray-300 bg-gray-50 p-0.5 gap-0.5">
                  <button
                    onClick={() => handleResizeShapes(-8, 0)}
                    className="px-1.5 py-1 rounded bg-white hover:bg-gray-100 text-gray-700 font-medium border border-gray-200"
                    title="Make shape(s) narrower"
                  >
                    Narrower
                  </button>
                  <button
                    onClick={() => handleResizeShapes(8, 0)}
                    className="px-1.5 py-1 rounded bg-white hover:bg-gray-100 text-gray-700 font-medium border border-gray-200"
                    title="Make shape(s) wider"
                  >
                    Wider
                  </button>
                  <button
                    onClick={() => handleResizeShapes(0, -8)}
                    className="px-1.5 py-1 rounded bg-white hover:bg-gray-100 text-gray-700 font-medium border border-gray-200"
                    title="Make shape(s) shorter"
                  >
                    Shorter
                  </button>
                  <button
                    onClick={() => handleResizeShapes(0, 8)}
                    className="px-1.5 py-1 rounded bg-white hover:bg-gray-100 text-gray-700 font-medium border border-gray-200"
                    title="Make shape(s) taller"
                  >
                    Taller
                  </button>
                </div>
              )}

              {state.numSets >= 2 && (
                <div className="inline-flex rounded-md border border-gray-300 bg-gray-50 p-0.5 gap-0.5">
                  <button
                    onClick={() => handleAdjustSetSpacing(-8)}
                    className="px-2 py-1 rounded bg-white hover:bg-gray-100 text-gray-700 font-medium border border-gray-200 transition-colors"
                    title="Move sets closer together (increase overlap)"
                  >
                    Closer
                  </button>
                  <button
                    onClick={() => handleAdjustSetSpacing(8)}
                    className="px-2 py-1 rounded bg-white hover:bg-gray-100 text-gray-700 font-medium border border-gray-200 transition-colors"
                    title="Move sets further apart (decrease overlap)"
                  >
                    Apart
                  </button>
                </div>
              )}
            </div>
          </div>

          <main
            ref={containerRef}
            className="flex-1 bg-gray-200 overflow-auto p-8 flex items-center justify-center relative"
          >
            <VennCanvas
              state={state}
              activeSets={activeSets}
              totalRegions={totalRegions}
              widthPixels={widthPixels}
              heightPixels={heightPixels}
              baseWidthPx={baseWidthPx}
              boxGeometry={boxGeometry}
              regionCenters={regionCenters}
              setLabelAnchors={setLabelAnchors}
              computedTotals={computedTotals}
              previewScale={previewScale}
              cropMode={cropMode}
              selectionBox={selectionBox}
              customViewBox={customViewBox}
              canvasTool={canvasTool}
              selectedSetId={selectedSetId}
              setSelectedSetId={setSelectedSetId}
              getRegionMeta={getRegionMeta}
              formatDisplayValue={formatDisplayValue}
              handleSvgMouseDown={handleSvgMouseDown}
              handleSvgContextMenu={handleSvgContextMenu}
              openElementContextMenu={openElementContextMenu}
              navigateToGuiControl={navigateToGuiControl}
              handleSetDragStart={handleSetDragStart}
              handleSetResizeStart={handleSetResizeStart}
              handleBoxResizeStart={handleBoxResizeStart}
              handleRegionLabelDragStart={handleRegionLabelDragStart}
              handleSetLabelDragStart={handleSetLabelDragStart}
              handleUniversalLabelDragStart={handleUniversalLabelDragStart}
            />
          </main>
        </div>
      </div>

      {/* Right-Click Context Menu Popover */}
      <VennContextMenu
        contextMenu={contextMenu}
        state={state}
        getRegionMeta={getRegionMeta}
        navigateToGuiControl={navigateToGuiControl}
        forceSnapshot={forceSnapshot}
        updateRegion={updateRegion}
        updateSet={updateSet}
        updateState={updateState}
        handleSelectNumSets={handleSelectNumSets}
        handleFitShapesInsideBorder={handleFitShapesInsideBorder}
        onClose={() => setContextMenu(null)}
      />
    </div>
  );
};

export default VennDiagrams;
