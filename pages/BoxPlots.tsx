import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { BaseGraphEngine } from '../utils/graphBase';
import { STATISTICS_CONFIG } from '../config/graphDefaults';
import { BoxPlotDef, GraphConfig } from '../types';
import { Settings, List, Sliders, Palette, Plus, Trash2, Eye, EyeOff, Layers, Crosshair, Copy, ArrowUp, ArrowDown, RotateCcw } from 'lucide-react';
import * as math from 'mathjs';
import { CM_TO_PX } from '../constants';

import { GraphToolbar } from '../components/GraphToolbar';
import { GraphContextMenu, ContextMenuItem } from '../components/GraphContextMenu';
import { useGraphInteraction } from '../hooks/useGraphInteraction';
import { useDragSystem } from '../hooks/useDragSystem';
import { useHistory } from '../hooks/useHistory';
import { calculateAxisLabelDrag, calculateAxisResize } from '../utils/dragStrategies';

import { AppearanceSettings } from '../components/settings/AppearanceSettings';
import { RichInput } from '../components/ui/RichInput';

const INITIAL_BOXES: BoxPlotDef[] = [
  { id: '1', label: 'Sample H', min: 63, q1: 67, median: 71, q3: 75, max: 81, heightOffset: 2, boxHeight: 35, color: '#f8fafc', visible: true, labelPos: 'top' },
  { id: '2', label: 'Sample T', min: 68, q1: 74, median: 76.5, q3: 79, max: 83, heightOffset: 1, boxHeight: 35, color: '#f8fafc', visible: true, labelPos: 'top' }
];

const INITIAL_CONFIG: GraphConfig = {
  ...STATISTICS_CONFIG,
  xRange: [60, 84], 
  yRange: [0, 3],
  majorStep: [2, 1],
  subdivisions: [2, 1],
  showYAxis: false,
  showYNumbers: false,
  showYTicks: false,
  showHorizontalGrid: false,
  showMinorGrid: true,
  showBorder: true,
  axisLabels: ["life expectancy (years)", ""],
  fontSize: 11,
  verticalGridMode: 'upward',
  showWhiskerCaps: false,
  offsetXAxisLabelY: 0 
};

const INITIAL_WINDOW = {
  xMin: "60", xMax: "84", yMin: "0", yMax: "3",
  xStep: "2", yStep: "1", xSubdivisions: 2, ySubdivisions: 2
};

const getMedian = (arr: number[]): number => {
    const n = arr.length;
    if (n === 0) return 0;
    if (n % 2 === 1) return arr[(n - 1) / 2];
    return (arr[n / 2 - 1] + arr[n / 2]) / 2;
};

const calculateBoxPlotStats = (raw: string, showOutliers: boolean) => {
    const nums = raw.split(/[\s,]+/).map(s => parseFloat(s)).filter(n => isFinite(n));
    if (nums.length < 2) return null;
    
    const sorted = [...nums].sort((a, b) => a - b);
    const n = sorted.length;
    const median = getMedian(sorted);
    
    let lowerHalf: number[] = [];
    let upperHalf: number[] = [];

    if (n % 2 === 1) {
        const midIdx = (n - 1) / 2;
        lowerHalf = sorted.slice(0, midIdx);
        upperHalf = sorted.slice(midIdx + 1);
    } else {
        const midIdx = n / 2;
        lowerHalf = sorted.slice(0, midIdx);
        upperHalf = sorted.slice(midIdx);
    }

    const q1 = getMedian(lowerHalf);
    const q3 = getMedian(upperHalf);
    const iqr = q3 - q1;
    
    let min = sorted[0];
    let max = sorted[n - 1];
    let outliers: number[] = [];
    
    if (showOutliers) {
        const lowerBound = q1 - 1.5 * iqr;
        const upperBound = q3 + 1.5 * iqr;
        outliers = sorted.filter(x => x < lowerBound || x > upperBound);
        const nonOutliers = sorted.filter(x => x >= lowerBound && x <= upperBound);
        if (nonOutliers.length > 0) {
            min = nonOutliers[0];
            max = nonOutliers[nonOutliers.length - 1];
        } else {
            min = q1;
            max = q3;
        }
    }

    return { min, q1, median, q3, max, outliers };
};

interface ContextMenuState {
    x: number;
    y: number;
    mathX: number;
    mathY: number;
    targetType: 'boxplot' | 'boxplot-label' | 'axis' | 'axis-label' | 'grid' | 'canvas';
    targetId?: string;
}

const BoxPlots: React.FC = () => {
  const [config, setConfig] = useState<GraphConfig>(INITIAL_CONFIG);
  const [boxPlots, setBoxPlots] = useState<BoxPlotDef[]>(INITIAL_BOXES);
  const [studentMode, setStudentMode] = useState(false);
  
  const [activeTab, setActiveTab] = useState<'data' | 'window' | 'style'>('data');
  const [dimCm, setDimCm] = useState({ width: 15, height: 10 });
  const [isFixedSize, setIsFixedSize] = useState(true);
  const [boxSpacingCm, setBoxSpacingCm] = useState(2);
  const [overrideGridTopY, setOverrideGridTopY] = useState<number | null>(null);
  const [windowSettings, setWindowSettings] = useState(INITIAL_WINDOW);

  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null);
  const [highlightedId, setHighlightedId] = useState<string | null>(null);

  const triggerHighlight = (id: string) => {
      setHighlightedId(id);
      setTimeout(() => setHighlightedId(null), 2200);
  };

  // --- History & Persistence ---
  const currentState = useMemo(() => ({
      config, boxPlots, studentMode, dimCm, isFixedSize, boxSpacingCm, overrideGridTopY, windowSettings
  }), [config, boxPlots, studentMode, dimCm, isFixedSize, boxSpacingCm, overrideGridTopY, windowSettings]);

  const restoreState = useCallback((state: any) => {
      if (!state) return;
      if (state.config) setConfig(state.config);
      if (state.boxPlots) setBoxPlots(state.boxPlots);
      if (state.studentMode !== undefined) setStudentMode(state.studentMode);
      if (state.dimCm) setDimCm(state.dimCm);
      if (state.isFixedSize !== undefined) setIsFixedSize(state.isFixedSize);
      if (state.boxSpacingCm !== undefined) setBoxSpacingCm(state.boxSpacingCm);
      if (state.overrideGridTopY !== undefined) setOverrideGridTopY(state.overrideGridTopY);
      if (state.windowSettings) setWindowSettings(state.windowSettings);
  }, []);

  const { undo, redo, canUndo, canRedo, exportState, importState, resetToDefaultSettings } = useHistory(
      'box-plots',
      currentState,
      restoreState
  );

  const handleResetDefaultSettings = useCallback(() => {
      setConfig(INITIAL_CONFIG);
      setBoxPlots(INITIAL_BOXES);
      setStudentMode(false);
      setDimCm({ width: 15, height: 10 });
      setIsFixedSize(true);
      setBoxSpacingCm(2);
      setOverrideGridTopY(null);
      setWindowSettings(INITIAL_WINDOW);
      resetToDefaultSettings();
  }, [resetToDefaultSettings]);

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

  const parseMath = (input: string | number): number => {
      try {
          const val = math.evaluate(String(input));
          return typeof val === 'number' && isFinite(val) ? val : 0;
      } catch { return 0; }
  };

  useEffect(() => {
    setConfig(prev => ({
        ...prev,
        layoutMode: isFixedSize ? 'fixed' : 'auto',
        targetWidth: Math.round(dimCm.width * CM_TO_PX),
        targetHeight: Math.round(dimCm.height * CM_TO_PX)
    }));
  }, [dimCm, isFixedSize]);

  useEffect(() => {
    const xMin = parseMath(windowSettings.xMin);
    const xMax = parseMath(windowSettings.xMax);
    let xStep = Math.abs(parseMath(windowSettings.xStep));
    if (xStep < 1e-9) xStep = 1;
    const xSub = Math.max(1, Math.round(Number(windowSettings.xSubdivisions) || 1));
    const ySub = Math.max(1, Math.round(Number(windowSettings.ySubdivisions) || 1));
    
    let targetYMax = 3;
    if (isFixedSize) {
        const targetHeight = Math.round(dimCm.height * CM_TO_PX);
        const gridH = Math.max(1, targetHeight - 40 - 40);
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
        basePixelSize: boxSpacingCm * CM_TO_PX
    }));
  }, [windowSettings, dimCm, isFixedSize, boxSpacingCm, gridTopY]);

  const engine = useMemo(() => new BaseGraphEngine({ ...config, showBorder: false, showVerticalGrid: false }), [config]);

  const {
      previewScale, setPreviewScale,
      exportDpi, setExportDpi,
      cropMode, setCropMode,
      selectionBox, customViewBox, hasInitialCrop,
      containerRef,
      handleAutoCrop, handleResetView, handleZoomOutCanvas, handleExportPNG, handleExportSVG, handleCopy, isCopied,
      handleCropMouseDown, handleCropMouseMove, handleCropMouseUp
  } = useGraphInteraction('graph-svg', engine.widthPixels, engine.heightPixels, dimCm.width, false, false, config.cropPadding);

  const { onMouseDown, onMouseMove, onMouseUp } = useDragSystem(previewScale);

  const handleBoxDragStart = (id: string, initialOffset: number, e: React.MouseEvent) => {
      e.stopPropagation();
      onMouseDown(e, { initialOffset }, (dx, dy, init) => {
          const mathYDelta = -(dy / engine.scaleY);
          setBoxPlots(prev => prev.map(b => {
              if (b.id !== id) return b;
              return { ...b, heightOffset: Math.round((init.initialOffset + mathYDelta) * 10) / 10 };
          }));
      });
  };

  const handleAxisLabelDragStart = (axis: 'x' | 'y', e: React.MouseEvent) => {
      const initialOffsets = {
          xx: config.offsetXAxisLabelX, xy: config.offsetXAxisLabelY,
          yx: config.offsetYAxisLabelX, yy: config.offsetYAxisLabelY
      };
      
      onMouseDown(e, initialOffsets, (dx, dy, init, ev) => {
          const updates = calculateAxisLabelDrag(config, dx, dy, axis, init, { alt: ev.altKey, ctrl: ev.ctrlKey || ev.metaKey });
          setConfig(prev => ({ ...prev, ...updates }));
      }, undefined, 'axis-label');
  };

  const handleArrowDragStart = (axis: 'x' | 'y', side: 'positive' | 'negative', e: React.MouseEvent) => {
      const initRange = { x: config.xRange, y: config.yRange };
      
      onMouseDown(e, initRange, (dx, dy, init, ev) => {
          if (axis === 'y') return;
          const updates = calculateAxisResize(axis, dx, dy, engine.scaleX, engine.scaleY, init, side, ev.shiftKey);
          if (Object.keys(updates).length > 0) {
              setWindowSettings(prev => ({ ...prev, ...updates }));
          }
      }, undefined, 'axis-resize');
  };

  const handleGlobalMouseMove = (e: React.MouseEvent) => {
      if (handleCropMouseMove(e)) return;
      onMouseMove(e);
  };

  const handleGlobalMouseUp = () => {
      handleCropMouseUp();
      onMouseUp();
  };

  const handleContextMenu = (e: React.MouseEvent<SVGSVGElement>) => {
      e.preventDefault();
      if (cropMode) return;

      const svg = document.getElementById('graph-svg') as SVGSVGElement | null;
      let mathX = 0;
      let mathY = 0;
      if (svg) {
          const rect = svg.getBoundingClientRect();
          const px = (e.clientX - rect.left) / previewScale;
          const py = (e.clientY - rect.top) / previewScale;
          const [mx, my] = engine.screenToMath(px, py);
          mathX = Math.round(mx * 10) / 10;
          mathY = Math.max(0.5, Math.round(my * 2) / 2);
      }

      let el = e.target as Element | null;
      while (el && el !== e.currentTarget) {
          const targetType = el.getAttribute('data-target-type') as ContextMenuState['targetType'] | null;
          const targetId = el.getAttribute('data-target-id') || undefined;
          if (targetType) {
              setContextMenu({
                  x: e.clientX,
                  y: e.clientY,
                  mathX,
                  mathY,
                  targetType,
                  targetId
              });
              return;
          }
          el = el.parentElement;
      }

      setContextMenu({
          x: e.clientX,
          y: e.clientY,
          mathX,
          mathY,
          targetType: 'canvas'
      });
  };

  const locateBoxPlotInSidebar = (id: string) => {
      setActiveTab('data');
      triggerHighlight(id);
      setTimeout(() => {
          const el = document.getElementById(`sidebar-boxplot-${id}`);
          if (el) {
              el.scrollIntoView({ behavior: 'smooth', block: 'center' });
              const input = el.querySelector('input');
              if (input) input.focus();
          }
      }, 60);
  };

  const renderBoxes = () => {
    if (studentMode) return [];
    const els: React.ReactNode[] = [];
        
    const { xStart, xEnd } = engine.getGridBoundaries();
    const vStart = engine.originY;
    const [_, vEndTop] = engine.mathToScreen(0, gridTopY);

    if (config.showBorder) {
        els.push(<rect key="custom-border" data-target-type="grid" data-target-id="border" x={xStart} y={vEndTop} width={xEnd - xStart} height={Math.max(0, vStart - vEndTop)} fill="none" stroke="black" strokeWidth={config.gridThicknessMajor} />);
    }

    const generateSteps = (min: number, max: number, step: number) => {
        const start = Math.ceil(min / step);
        const end = Math.floor(max / step);
        const res = [];
        for (let i = start; i <= end; i++) res.push(i * step);
        return res;
    };

    if (config.showVerticalGrid) {
        if (config.showMinorGrid) {
            const minorStep = config.majorStep[0] / config.subdivisions[0];
            generateSteps(config.xRange[0], config.xRange[1], minorStep).forEach(x => {
                const [px] = engine.mathToScreen(x, 0);
                els.push(<line key={`v-minor-${x}`} data-target-type="grid" data-target-id="grid-v-minor" x1={px} y1={vStart} x2={px} y2={vEndTop} stroke="black" strokeWidth={config.gridThicknessMinor} />);
            });
        }
        generateSteps(config.xRange[0], config.xRange[1], config.majorStep[0]).forEach(x => {
            const [px] = engine.mathToScreen(x, 0);
            els.push(<line key={`v-major-${x}`} data-target-type="grid" data-target-id="grid-v-major" x1={px} y1={vStart} x2={px} y2={vEndTop} stroke="black" strokeWidth={config.gridThicknessMajor} />);
        });
    }

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

    const stroke = 1.8;
    
    boxPlots.forEach(b => {
        if (!b.visible) return;
        
        const min = b.min;
        const q1 = b.q1;
        const median = b.median;
        const q3 = b.q3;
        const max = b.max;
        const outliers: number[] = b.outliers || [];

        const baselineY = engine.mathToScreen(0, b.heightOffset)[1];
        const [minX] = engine.mathToScreen(min, 0);
        const [q1X] = engine.mathToScreen(q1, 0);
        const [medX] = engine.mathToScreen(median, 0);
        const [q3X] = engine.mathToScreen(q3, 0);
        const [maxX] = engine.mathToScreen(max, 0);
        const boxHalfH = b.boxHeight / 2;

        const boxGroup: React.ReactNode[] = [];
        boxGroup.push(<line key={`${b.id}-w1`} x1={minX} y1={baselineY} x2={q1X} y2={baselineY} stroke="black" strokeWidth={stroke} />);
        boxGroup.push(<line key={`${b.id}-w2`} x1={q3X} y1={baselineY} x2={maxX} y2={baselineY} stroke="black" strokeWidth={stroke} />);
        
        if (config.showWhiskerCaps) {
            const capH = 10;
            boxGroup.push(<line key={`${b.id}-c1`} x1={minX} y1={baselineY - capH} x2={minX} y2={baselineY + capH} stroke="black" strokeWidth={stroke} />);
            boxGroup.push(<line key={`${b.id}-c2`} x1={maxX} y1={baselineY - capH} x2={maxX} y2={baselineY + capH} stroke="black" strokeWidth={stroke} />);
        }

        boxGroup.push(<rect key={`${b.id}-rect`} x={q1X} y={baselineY - boxHalfH} width={q3X - q1X} height={b.boxHeight} fill={b.color || "white"} stroke="black" strokeWidth={stroke} />);
        boxGroup.push(<line key={`${b.id}-med`} x1={medX} y1={baselineY - boxHalfH} x2={medX} y2={baselineY + boxHalfH} stroke="black" strokeWidth={stroke} />);

        if (b.showOutliers) {
            outliers.forEach((outlier, idx) => {
                const [outlierX] = engine.mathToScreen(outlier, 0);
                boxGroup.push(<circle key={`${b.id}-outlier-${idx}`} cx={outlierX} cy={baselineY} r={3} fill="none" stroke="black" strokeWidth={stroke} />);
            });
        }

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
                    key={`${b.id}-label`} 
                    data-target-type="boxplot-label"
                    data-target-id={b.id}
                    style={{ cursor: cropMode ? 'crosshair' : 'move' }}
                    onMouseDown={(e) => {
                        if (cropMode) return;
                        e.stopPropagation();
                        onMouseDown(e, { x: offset.x, y: offset.y }, (dx, dy, init) => {
                            updateBoxPlot(b.id, { labelOffset: { x: init.x + dx, y: init.y + dy } });
                        });
                    }}
                >
                    <rect x={lx - 60} y={ly - 20} width={120} height={30} fill="transparent" />
                    {engine.texEngine.renderToSVG(b.label, lx, ly, engine.cfg.fontSize, 'black', anchor as any, true, 'text')}
                </g>
            );
        }

        els.push(
            <g 
                key={b.id} 
                data-target-type="boxplot"
                data-target-id={b.id}
                style={{ cursor: cropMode ? 'crosshair' : 'ns-resize' }} 
                onMouseDown={(e) => { if (!cropMode) handleBoxDragStart(b.id, b.heightOffset, e); }}
            >
                <rect x={minX - 40} y={baselineY - Math.max(20, b.boxHeight)} width={(maxX - minX) + 80} height={Math.max(40, b.boxHeight * 2)} fill="transparent" />
                {boxGroup}
            </g>
        );
    });
    return els;
  };

  const addBoxPlot = (customYOffset?: number) => {
      const xMin = config.xRange[0];
      const xSpan = Math.max(4, config.xRange[1] - xMin);
      const min = Math.round((xMin + xSpan * 0.15) * 10) / 10;
      const q1 = Math.round((xMin + xSpan * 0.35) * 10) / 10;
      const med = Math.round((xMin + xSpan * 0.5) * 10) / 10;
      const q3 = Math.round((xMin + xSpan * 0.65) * 10) / 10;
      const max = Math.round((xMin + xSpan * 0.85) * 10) / 10;
      const newId = Date.now().toString();
      setBoxPlots([...boxPlots, {
          id: newId,
          label: `Sample ${boxPlots.length + 1}`,
          min, q1, median: med, q3, max,
          heightOffset: customYOffset ?? (boxPlots.length + 1),
          boxHeight: 35,
          color: '#f8fafc',
          visible: true,
          labelPos: 'top'
      }]);
      return newId;
  };

  const updateBoxPlot = (id: string, u: Partial<BoxPlotDef>) => {
      setBoxPlots(prev => prev.map(b => {
          if (b.id !== id) return b;
          const newB = { ...b, ...u };
          
          if ('rawData' in u || 'showOutliers' in u) {
              if (newB.rawData) {
                  const stats = calculateBoxPlotStats(newB.rawData, newB.showOutliers || false);
                  if (stats) {
                      newB.min = stats.min;
                      newB.q1 = stats.q1;
                      newB.median = stats.median;
                      newB.q3 = stats.q3;
                      newB.max = stats.max;
                      newB.outliers = stats.outliers;
                  }
              }
          }
          
          if ('min' in u || 'q1' in u || 'median' in u || 'q3' in u || 'max' in u) {
              newB.rawData = '';
              newB.outliers = [];
          }
          
          return newB;
      }));
  };

  const removeBoxPlot = (id: string) => setBoxPlots(prev => prev.filter(b => b.id !== id));

  const getContextMenuData = (): { header: string; items: ContextMenuItem[] } => {
      if (!contextMenu) return { header: '', items: [] };

      if ((contextMenu.targetType === 'boxplot' || contextMenu.targetType === 'boxplot-label') && contextMenu.targetId) {
          const bp = boxPlots.find(b => b.id === contextMenu.targetId);
          if (bp) {
              const items: ContextMenuItem[] = [
                  {
                      label: 'Locate in Sidebar',
                      icon: <Crosshair size={14} />,
                      accent: true,
                      onClick: () => locateBoxPlotInSidebar(bp.id)
                  },
                  {
                      label: `Label Position: ${bp.labelPos === 'top' ? 'Switch to Left' : bp.labelPos === 'left' ? 'Hide Label' : 'Show on Top'}`,
                      icon: <Layers size={14} />,
                      dividerBefore: true,
                      onClick: () => {
                          const nextPos = bp.labelPos === 'top' ? 'left' : bp.labelPos === 'left' ? 'none' : 'top';
                          updateBoxPlot(bp.id, { labelPos: nextPos });
                      }
                  },
                  {
                      label: 'Move Higher (+0.5)',
                      icon: <ArrowUp size={14} />,
                      onClick: () => updateBoxPlot(bp.id, { heightOffset: Math.round((bp.heightOffset + 0.5) * 10) / 10 })
                  },
                  {
                      label: 'Move Lower (-0.5)',
                      icon: <ArrowDown size={14} />,
                      onClick: () => updateBoxPlot(bp.id, { heightOffset: Math.max(0.5, Math.round((bp.heightOffset - 0.5) * 10) / 10) })
                  },
                  {
                      label: 'Duplicate Box Plot',
                      icon: <Copy size={14} />,
                      dividerBefore: true,
                      onClick: () => {
                          const newId = Date.now().toString();
                          setBoxPlots(prev => [...prev, { ...bp, id: newId, label: `${bp.label} (Copy)`, heightOffset: bp.heightOffset + 1 }]);
                          locateBoxPlotInSidebar(newId);
                      }
                  },
                  {
                      label: 'Hide Box Plot',
                      icon: <EyeOff size={14} />,
                      onClick: () => updateBoxPlot(bp.id, { visible: false })
                  },
                  {
                      label: 'Delete Box Plot',
                      icon: <Trash2 size={14} />,
                      danger: true,
                      onClick: () => removeBoxPlot(bp.id)
                  }
              ];

              if (bp.labelOffset && (bp.labelOffset.x !== 0 || bp.labelOffset.y !== 0)) {
                  items.splice(2, 0, {
                      label: 'Reset Label Offset',
                      icon: <RotateCcw size={14} />,
                      onClick: () => updateBoxPlot(bp.id, { labelOffset: { x: 0, y: 0 } })
                  });
              }

              return {
                  header: `${bp.label || 'Box Plot'} (${bp.min}, ${bp.q1}, ${bp.median}, ${bp.q3}, ${bp.max})`,
                  items
              };
          }
      }

      if (contextMenu.targetType === 'axis-label') {
          return {
              header: 'Axis Label',
              items: [
                  {
                      label: 'Edit Axis Label Text',
                      icon: <Palette size={14} />,
                      accent: true,
                      onClick: () => setActiveTab('style')
                  },
                  {
                      label: 'Reset Label Position',
                      icon: <RotateCcw size={14} />,
                      onClick: () => setConfig(prev => ({ ...prev, offsetXAxisLabelX: 0, offsetXAxisLabelY: 0 }))
                  }
              ]
          };
      }

      return {
          header: contextMenu.targetType === 'axis' ? 'X-Axis' : contextMenu.targetType === 'grid' ? 'Grid & Border' : `Canvas (x ≈ ${contextMenu.mathX})`,
          items: [
              {
                  label: 'Add Box Plot Here',
                  icon: <Plus size={14} />,
                  accent: true,
                  onClick: () => {
                      const newId = addBoxPlot(contextMenu.mathY);
                      locateBoxPlotInSidebar(newId);
                  }
              },
              {
                  label: config.showWhiskerCaps ? 'Hide Whisker Caps' : 'Show Whisker Caps',
                  icon: <Layers size={14} />,
                  dividerBefore: true,
                  onClick: () => setConfig(prev => ({ ...prev, showWhiskerCaps: !prev.showWhiskerCaps }))
              },
              {
                  label: studentMode ? 'Disable Student Mode' : 'Enable Student Mode (Worksheet)',
                  icon: studentMode ? <Eye size={14} /> : <EyeOff size={14} />,
                  onClick: () => setStudentMode(!studentMode)
              },
              {
                  label: 'Edit Window & Spacing Settings',
                  icon: <Sliders size={14} />,
                  dividerBefore: true,
                  onClick: () => setActiveTab('window')
              },
              {
                  label: 'Edit Style & Grid Settings',
                  icon: <Palette size={14} />,
                  onClick: () => setActiveTab('style')
              }
          ]
      };
  };

  const menuData = getContextMenuData();

  return (
    <div className="flex h-full flex-col bg-gray-50" onMouseMove={handleGlobalMouseMove} onMouseUp={handleGlobalMouseUp}>
      <header className="flex items-center justify-between px-6 py-3 bg-white border-b border-gray-200 shadow-sm z-10">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-orange-50 text-orange-600 rounded-lg"><Settings className="w-5 h-5" /></div>
          <h1 className="text-xl font-semibold text-gray-800">Box Plot Maker</h1>
        </div>
        <GraphToolbar 
            previewScale={previewScale} setPreviewScale={setPreviewScale}
            exportDpi={exportDpi} onDpiChange={setExportDpi}
            cropMode={cropMode} setCropMode={setCropMode}
            onResetView={handleResetView} onZoomOutCanvas={handleZoomOutCanvas} onAutoCrop={handleAutoCrop}
            onExportPNG={handleExportPNG} onCopy={handleCopy} isCopied={isCopied} onExportSVG={handleExportSVG}
            onUndo={undo} onRedo={redo} canUndo={canUndo} canRedo={canRedo}
            onExportState={exportState} onImportState={importState}
            onResetDefaultSettings={handleResetDefaultSettings}
        />
      </header>

      <div className="flex flex-1 overflow-hidden">
        <aside className="w-80 bg-white border-r border-gray-200 flex flex-col h-full z-20">
          <div className="flex border-b border-gray-200 bg-white">
            <button onClick={() => setActiveTab('data')} className={`flex-1 py-3 text-sm font-medium flex justify-center items-center gap-2 ${activeTab === 'data' ? 'text-orange-600 border-b-2 border-orange-600 bg-orange-50/50' : 'text-gray-500'}`}><List size={16} /> Data</button>
            <button onClick={() => setActiveTab('window')} className={`flex-1 py-3 text-sm font-medium flex justify-center items-center gap-2 ${activeTab === 'window' ? 'text-orange-600 border-b-2 border-orange-600 bg-orange-50/50' : 'text-gray-500'}`}><Sliders size={16} /> Window</button>
            <button onClick={() => setActiveTab('style')} className={`flex-1 py-3 text-sm font-medium flex justify-center items-center gap-2 ${activeTab === 'style' ? 'text-orange-600 border-b-2 border-orange-600 bg-orange-50/50' : 'text-gray-500'}`}><Palette size={16} /> Style</button>
          </div>

          <div className="flex-1 overflow-y-auto custom-scrollbar">
              {activeTab === 'data' && (
                  <div className="flex flex-col">
                      <div className="p-4 bg-gray-50 border-b border-gray-100 flex justify-between items-center">
                          <h2 className="text-xs font-bold text-gray-500 uppercase tracking-wider">Series</h2>
                          <button onClick={() => addBoxPlot()} className="p-1 hover:bg-gray-200 rounded text-orange-600"><Plus size={16} /></button>
                      </div>
                      <div className="p-2 space-y-2">
                          {boxPlots.map(b => (
                              <div
                                  key={b.id}
                                  id={`sidebar-boxplot-${b.id}`}
                                  className={`bg-white border rounded-md p-3 shadow-sm transition-all duration-300 ${
                                      highlightedId === b.id
                                          ? 'border-orange-500 ring-2 ring-orange-400 bg-orange-50/30'
                                          : 'border-gray-200 hover:border-orange-300'
                                  }`}
                              >
                                  <div className="flex items-center gap-3 mb-3">
                                      <RichInput 
                                        value={b.label} 
                                        onChange={(e) => updateBoxPlot(b.id, { label: e.target.value })} 
                                        className="flex-1 border border-gray-300 rounded px-2 py-1 text-sm font-bold" 
                                      />
                                      <button onClick={() => updateBoxPlot(b.id, { visible: !b.visible })} className="text-gray-400">{b.visible ? <Eye size={16} /> : <EyeOff size={16} />}</button>
                                      <button onClick={() => removeBoxPlot(b.id)} className="text-gray-400 hover:text-red-500"><Trash2 size={16} /></button>
                                  </div>
                                  
                                  <div className="flex border border-gray-200 rounded overflow-hidden mb-3">
                                      <button 
                                          onClick={() => updateBoxPlot(b.id, { useRawData: false })} 
                                          className={`flex-1 py-1 text-[10px] font-bold uppercase ${!b.useRawData ? 'bg-orange-100 text-orange-700' : 'bg-gray-50 text-gray-500 hover:bg-gray-100'}`}
                                      >
                                          5-Number
                                      </button>
                                      <button 
                                          onClick={() => updateBoxPlot(b.id, { useRawData: true })} 
                                          className={`flex-1 py-1 text-[10px] font-bold uppercase ${b.useRawData ? 'bg-orange-100 text-orange-700' : 'bg-gray-50 text-gray-500 hover:bg-gray-100'}`}
                                      >
                                          Raw Data
                                      </button>
                                  </div>

                                  {!b.useRawData ? (
                                      <div className="grid grid-cols-5 gap-1 mb-3">
                                          {['min', 'q1', 'median', 'q3', 'max'].map((key) => (
                                              <div key={key}>
                                                  <label className="block text-[8px] uppercase font-bold text-gray-400 mb-0.5">{key}</label>
                                                  <input type="number" step="0.1" value={b[key as keyof BoxPlotDef] as number} onChange={(e) => updateBoxPlot(b.id, { [key]: parseFloat(e.target.value) || 0 })} className="w-full border border-gray-300 rounded px-1 py-0.5 text-[10px]" />
                                              </div>
                                          ))}
                                      </div>
                                  ) : (
                                      <div className="mb-3 space-y-2">
                                          <textarea 
                                              value={b.rawData || ''} 
                                              onChange={(e) => updateBoxPlot(b.id, { rawData: e.target.value })} 
                                              placeholder="e.g. 1, 2, 3, 4, 5"
                                              className="w-full h-16 border border-gray-300 rounded p-1.5 text-xs font-mono resize-none"
                                          />
                                          <label className="flex items-center gap-2 text-xs text-gray-600 cursor-pointer">
                                              <input 
                                                  type="checkbox" 
                                                  checked={b.showOutliers || false} 
                                                  onChange={(e) => updateBoxPlot(b.id, { showOutliers: e.target.checked })} 
                                                  className="rounded text-orange-600 focus:ring-orange-500"
                                              />
                                              Show Outliers
                                          </label>
                                      </div>
                                  )}

                                  <div className="flex items-center justify-between gap-2">
                                      <div className="flex items-center gap-2">
                                          <input type="color" value={b.color} onChange={(e) => updateBoxPlot(b.id, { color: e.target.value })} className="w-8 h-8 p-0 border-0 rounded cursor-pointer" />
                                          <select value={b.labelPos} onChange={(e) => updateBoxPlot(b.id, { labelPos: e.target.value as any })} className="text-[10px] border rounded p-1">
                                              <option value="top">Top</option>
                                              <option value="left">Left</option>
                                              <option value="none">None</option>
                                          </select>
                                          {(b.labelOffset && (b.labelOffset.x !== 0 || b.labelOffset.y !== 0)) && (
                                              <button onClick={() => updateBoxPlot(b.id, { labelOffset: {x: 0, y: 0} })} className="text-[10px] text-orange-600 hover:bg-orange-50 px-1 rounded transition-colors" title="Reset Label Position">Reset Pos</button>
                                          )}
                                      </div>
                                      <div className="flex items-center gap-2">
                                          <Layers size={14} className="text-gray-400" title="Height Offset (Y-Pos)" />
                                          <input type="number" step="0.1" value={b.heightOffset} onChange={(e) => updateBoxPlot(b.id, { heightOffset: parseFloat(e.target.value) || 0 })} className="w-12 border rounded px-1 text-xs" title="Position (Y)" />
                                          <div className="w-px h-4 bg-gray-300 mx-1"></div>
                                          <span className="text-[10px] text-gray-500 font-bold" title="Box Thickness">↕</span>
                                          <input type="number" step="1" value={b.boxHeight} onChange={(e) => updateBoxPlot(b.id, { boxHeight: parseFloat(e.target.value) || 10 })} className="w-12 border rounded px-1 text-xs" title="Box Thickness (px)" />
                                      </div>
                                  </div>
                              </div>
                          ))}
                      </div>
                  </div>
              )}
              {activeTab === 'window' && (
                  <div className="flex flex-col">
                        <div className="border-b border-gray-200">
                            <div className="p-4 bg-gray-50 border-b border-gray-100 flex justify-between items-center">
                                <h2 className="text-xs font-bold text-gray-500 uppercase tracking-wider">Image Dimensions</h2>
                                <div className="flex items-center gap-1">
                                <button 
                                    onClick={() => setIsFixedSize(false)} 
                                    className={`px-2 py-1 text-xs rounded ${!isFixedSize ? 'bg-orange-100 text-orange-700 font-medium' : 'text-gray-500 hover:bg-gray-100'}`}
                                >
                                    Auto
                                </button>
                                <button 
                                    onClick={() => setIsFixedSize(true)} 
                                    className={`px-2 py-1 text-xs rounded ${isFixedSize ? 'bg-orange-100 text-orange-700 font-medium' : 'text-gray-500 hover:bg-gray-100'}`}
                                >
                                    Fixed (cm)
                                </button>
                                </div>
                            </div>
                            {isFixedSize ? (
                            <div className="p-4 grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs text-gray-500 mb-1">Width (cm)</label>
                                    <input 
                                        type="number" 
                                        value={dimCm.width} 
                                        onChange={(e) => setDimCm({...dimCm, width: parseFloat(e.target.value) || 0})}
                                        className="w-full border rounded px-2 py-1 text-sm text-gray-800" 
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs text-gray-500 mb-1">Height (cm)</label>
                                    <input 
                                        type="number" 
                                        value={dimCm.height} 
                                        onChange={(e) => setDimCm({...dimCm, height: parseFloat(e.target.value) || 0})}
                                        className="w-full border rounded px-2 py-1 text-sm text-gray-800" 
                                    />
                                </div>
                                <div className="col-span-2 text-xs text-gray-400 italic text-center">
                                    Output scales to 12cm @ 300DPI
                                </div>
                            </div>
                            ) : (
                                <div className="p-4 text-xs text-gray-400 text-center italic">
                                Size determined by zoom level & content.
                                </div>
                            )}
                        </div>
                        
                        <div className="border-b border-gray-200 pb-20">
                            <div className="p-4 bg-gray-50 border-b border-gray-100">
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
                            </div>
                            <div className="p-4 grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs text-gray-500 mb-1">X Min</label>
                                    <input type="text" value={windowSettings.xMin} onChange={(e) => setWindowSettings(p=>({...p,xMin:e.target.value}))} className="w-full border rounded px-2 py-1 text-sm text-gray-800" />
                                </div>
                                <div>
                                    <label className="block text-xs text-gray-500 mb-1">X Max</label>
                                    <input type="text" value={windowSettings.xMax} onChange={(e) => setWindowSettings(p=>({...p,xMax:e.target.value}))} className="w-full border rounded px-2 py-1 text-sm text-gray-800" />
                                </div>
                                <div>
                                    <label className="block text-xs text-gray-500 mb-1">X Step</label>
                                    <input type="text" value={windowSettings.xStep} onChange={(e) => setWindowSettings(p=>({...p,xStep:e.target.value}))} className="w-full border rounded px-2 py-1 text-sm text-gray-800" />
                                </div>
                                <div>
                                    <label className="block text-xs text-gray-500 mb-1">X Subdivs</label>
                                    <input type="number" min="1" value={windowSettings.xSubdivisions} onChange={(e) => setWindowSettings(p=>({...p,xSubdivisions:parseInt(e.target.value)}))} className="w-full border rounded px-2 py-1 text-sm text-gray-800" />
                                </div>
                            </div>
                        </div>
                  </div>
              )}
              {activeTab === 'style' && (
                  <div className="flex flex-col">
                      <AppearanceSettings config={config} setConfig={setConfig} togglePiX={()=>{}} togglePiY={()=>{}} />
                      <div className="p-4 border-t border-gray-200">
                          <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-4">Graph Options</h3>
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
                                  <span className="block text-xs text-gray-500 mt-0.5">Hide boxes to create a worksheet</span>
                              </div>
                          </label>
                      </div>
                  </div>
              )}
          </div>
        </aside>

        <main className="flex-1 bg-gray-100 overflow-hidden flex flex-col relative">
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
                  id="graph-svg" 
                  width={engine.widthPixels} 
                  height={engine.heightPixels} 
                  viewBox={customViewBox || `0 0 ${engine.widthPixels} ${engine.heightPixels}`} 
                  xmlns="http://www.w3.org/2000/svg" 
                  style={{ display: 'block' }}
                  onContextMenu={handleContextMenu}
              >
                <rect x="0" y="0" width={engine.widthPixels} height={engine.heightPixels} fill="white" />
                <g className="grid-layer">{engine.renderGrid()}</g>
                <g className="axis-labels-layer">
                    {engine.renderLabels(
                        (e) => handleAxisLabelDragStart('x', e),
                        (e) => handleAxisLabelDragStart('y', e)
                    )}
                </g>
                <g className="axis-layer">
                    {engine.renderAxes(
                        (axis, side, e) => handleArrowDragStart(axis, side, e)
                    )}
                </g>
                <g className="data-layer">{renderBoxes()}</g>

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
          <div className="absolute bottom-3 right-4 bg-white/90 backdrop-blur-sm border border-gray-200 rounded-lg px-2.5 py-1 text-[10px] text-gray-500 shadow-sm pointer-events-none">
              Right-click any box plot, label, or axis for quick actions
          </div>
          {contextMenu && (
              <GraphContextMenu
                  x={contextMenu.x}
                  y={contextMenu.y}
                  header={menuData.header}
                  items={menuData.items}
                  onClose={() => setContextMenu(null)}
              />
          )}
        </main>
      </div>
    </div>
  );
};

export default BoxPlots;