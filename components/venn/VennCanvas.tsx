import React, { useMemo } from 'react';
import {
  VennState,
  VennSetDef,
  VennContextMenuState
} from '../../utils/vennLogic';
import { TexEngine } from '../../utils/textRenderer';
import { ptToSvgUnits } from '../../utils/imageExport';

interface VennCanvasProps {
  state: VennState;
  activeSets: VennSetDef[];
  totalRegions: number;
  widthPixels: number;
  heightPixels: number;
  baseWidthPx: number;
  boxGeometry: {
    x: number;
    y: number;
    w: number;
    h: number;
    cx: number;
    cy: number;
  };
  regionCenters: Record<number, { x: number; y: number; exists: boolean }>;
  setLabelAnchors: { x: number; y: number }[];
  computedTotals: { setSums: (number | null)[]; grandTotal: number | null };
  previewScale: number;
  cropMode: boolean;
  selectionBox: { x: number; y: number; w: number; h: number } | null;
  customViewBox: string | null;
  canvasTool: 'manipulate' | 'shade';
  selectedSetId: number | 'all';
  setSelectedSetId: (id: number | 'all') => void;
  getRegionMeta: (mask: number) => { notation: string; math: string; desc: string };
  formatDisplayValue: (rawVal: string | number | null) => string;
  handleSvgMouseDown: (e: React.MouseEvent) => void;
  handleSvgContextMenu: (e: React.MouseEvent) => void;
  openElementContextMenu: (
    e: React.MouseEvent,
    targetType: VennContextMenuState['targetType'],
    opts?: { setId?: number; regionMask?: number }
  ) => void;
  navigateToGuiControl: (
    tab: 'data' | 'shading' | 'style',
    controlId: string,
    inputSelector?: string,
    forceDirectRegions?: boolean
  ) => void;
  handleSetDragStart: (setId: number, e: React.MouseEvent) => void;
  handleSetResizeStart: (
    setId: number,
    handleType: 'e' | 'w' | 's' | 'n' | 'se' | 'sw' | 'ne' | 'nw',
    e: React.MouseEvent
  ) => void;
  handleBoxResizeStart: (
    handleType: 'e' | 'w' | 's' | 'n' | 'se',
    e: React.MouseEvent
  ) => void;
  handleRegionLabelDragStart: (mask: number, e: React.MouseEvent) => void;
  handleSetLabelDragStart: (setId: number, e: React.MouseEvent) => void;
  handleUniversalLabelDragStart: (e: React.MouseEvent) => void;
}

export const VennCanvas: React.FC<VennCanvasProps> = ({
  state,
  activeSets,
  totalRegions,
  widthPixels,
  heightPixels,
  baseWidthPx,
  boxGeometry,
  regionCenters,
  setLabelAnchors,
  computedTotals,
  previewScale,
  cropMode,
  selectionBox,
  customViewBox,
  canvasTool,
  selectedSetId,
  setSelectedSetId,
  getRegionMeta,
  formatDisplayValue,
  handleSvgMouseDown,
  handleSvgContextMenu,
  openElementContextMenu,
  navigateToGuiControl,
  handleSetDragStart,
  handleSetResizeStart,
  handleBoxResizeStart,
  handleRegionLabelDragStart,
  handleSetLabelDragStart,
  handleUniversalLabelDragStart
}) => {
  const texEngine = useMemo(() => new TexEngine(), []);

  const renderSetShapeElement = (
    set: VennSetDef,
    key: string,
    extraProps: React.SVGProps<SVGGElement & SVGCircleElement & SVGEllipseElement & SVGRectElement> = {}
  ) => {
    const cx = boxGeometry.cx + set.cx;
    const cy = boxGeometry.cy + set.cy;
    if (state.shapeType === 'rectangle') {
      return (
        <rect
          key={key}
          x={cx - set.rx}
          y={cy - set.ry}
          width={set.rx * 2}
          height={set.ry * 2}
          rx={state.rectCornerRadius}
          ry={state.rectCornerRadius}
          {...extraProps}
        />
      );
    }
    const rx = set.rx;
    const ry = state.shapeType === 'circle' ? set.rx : set.ry;
    return <ellipse key={key} cx={cx} cy={cy} rx={rx} ry={ry} {...extraProps} />;
  };

  const renderPatternDefs = () => {
    const sp = Math.max(4, state.patternSpacing);
    const sw = Math.max(0.5, state.patternStrokeWidth);
    return (
      <>
        <pattern
          id="venn-pat-stripes-right"
          width={sp}
          height={sp}
          patternUnits="userSpaceOnUse"
          patternTransform="rotate(45)"
        >
          <line x1={0} y1={0} x2={0} y2={sp} stroke="#000000" strokeWidth={sw} />
        </pattern>
        <pattern
          id="venn-pat-stripes-left"
          width={sp}
          height={sp}
          patternUnits="userSpaceOnUse"
          patternTransform="rotate(-45)"
        >
          <line x1={0} y1={0} x2={0} y2={sp} stroke="#000000" strokeWidth={sw} />
        </pattern>
        <pattern
          id="venn-pat-vertical"
          width={sp}
          height={sp}
          patternUnits="userSpaceOnUse"
        >
          <line x1={sp / 2} y1={0} x2={sp / 2} y2={sp} stroke="#000000" strokeWidth={sw} />
        </pattern>
        <pattern
          id="venn-pat-horizontal"
          width={sp}
          height={sp}
          patternUnits="userSpaceOnUse"
        >
          <line x1={0} y1={sp / 2} x2={sp} y2={sp / 2} stroke="#000000" strokeWidth={sw} />
        </pattern>
        <pattern id="venn-pat-grid" width={sp} height={sp} patternUnits="userSpaceOnUse">
          <line x1={0} y1={sp / 2} x2={sp} y2={sp / 2} stroke="#000000" strokeWidth={sw * 0.85} />
          <line x1={sp / 2} y1={0} x2={sp / 2} y2={sp} stroke="#000000" strokeWidth={sw * 0.85} />
        </pattern>
        <pattern
          id="venn-pat-crosshatch"
          width={sp}
          height={sp}
          patternUnits="userSpaceOnUse"
          patternTransform="rotate(45)"
        >
          <line x1={0} y1={0} x2={0} y2={sp} stroke="#000000" strokeWidth={sw * 0.85} />
          <line x1={0} y1={sp / 2} x2={sp} y2={sp / 2} stroke="#000000" strokeWidth={sw * 0.85} />
        </pattern>
        <pattern id="venn-pat-dots" width={sp} height={sp} patternUnits="userSpaceOnUse">
          <circle cx={sp * 0.25} cy={sp * 0.25} r={Math.max(1, sw * 0.8)} fill="#000000" />
          <circle cx={sp * 0.75} cy={sp * 0.75} r={Math.max(1, sw * 0.8)} fill="#000000" />
        </pattern>
      </>
    );
  };

  const renderShadedRegions = () => {
    const els: React.ReactNode[] = [];

    for (let m = 0; m < totalRegions; m++) {
      const reg = state.regions[m];
      if (!reg || !reg.shaded) continue;

      const shadeColor = reg.customShadeColor || state.globalShadeColor;
      const pattern = reg.customPattern || state.globalShadePattern;

      const includedSets: number[] = [];
      for (let sIdx = 0; sIdx < state.numSets; sIdx++) {
        if ((m & (1 << sIdx)) !== 0) {
          includedSets.push(sIdx);
        }
      }

      let content: React.ReactNode = (
        <g mask={`url(#venn-exclude-mask-${m})`}>
          {shadeColor !== 'none' && (
            <rect
              x={boxGeometry.x}
              y={boxGeometry.y}
              width={boxGeometry.w}
              height={boxGeometry.h}
              fill={shadeColor}
            />
          )}
          {pattern !== 'none' && (
            <rect
              x={boxGeometry.x}
              y={boxGeometry.y}
              width={boxGeometry.w}
              height={boxGeometry.h}
              fill={`url(#venn-pat-${pattern})`}
            />
          )}
        </g>
      );

      includedSets.forEach(sIdx => {
        content = <g clipPath={`url(#venn-clip-set-${sIdx})`}>{content}</g>;
      });

      els.push(
        <g key={`shaded-region-${m}`} clipPath="url(#venn-clip-universal)">
          {content}
        </g>
      );
    }

    activeSets.forEach(set => {
      if (set.setFillShade !== 'none' || set.setFillPattern !== 'none') {
        els.push(
          <g key={`set-overlay-${set.id}`} clipPath="url(#venn-clip-universal)">
            {set.setFillShade !== 'none' &&
              renderSetShapeElement(set, `set-fill-${set.id}`, {
                fill: set.setFillShade,
                fillOpacity: set.setFillOpacity,
                stroke: 'none'
              })}
            {set.setFillPattern !== 'none' &&
              renderSetShapeElement(set, `set-pat-${set.id}`, {
                fill: `url(#venn-pat-${set.setFillPattern})`,
                fillOpacity: 0.85,
                stroke: 'none'
              })}
          </g>
        );
      }
    });

    return els;
  };

  const renderMathOrText = (
    text: string,
    x: number,
    y: number,
    ptSize: number,
    hasBg: boolean = false,
    forceMath: boolean = false
  ) => {
    const svgFontSize = ptToSvgUnits(ptSize);
    const trimmed = text.trim();
    if (!trimmed) return null;

    const isPureMath =
      forceMath ||
      trimmed.startsWith('\\') ||
      trimmed.includes('\\frac') ||
      trimmed.includes('\\cap') ||
      trimmed.includes('\\cup') ||
      trimmed.includes('\\xi') ||
      trimmed.includes('\\mathcal');

    if (isPureMath && !trimmed.includes('$')) {
      return texEngine.renderToSVG(
        trimmed,
        x,
        y,
        svgFontSize,
        '#000000',
        'middle',
        hasBg,
        'math'
      );
    }

    if (!trimmed.includes('$') && !trimmed.includes('\\') && trimmed.length > 14 && trimmed.includes(',')) {
      const parts = trimmed.split(',').map(s => s.trim());
      const lines: string[] = [];
      let currentLine = '';
      parts.forEach(part => {
        const candidate = currentLine ? `${currentLine}, ${part}` : part;
        if (candidate.length > 14 && currentLine) {
          lines.push(currentLine);
          currentLine = part;
        } else {
          currentLine = candidate;
        }
      });
      if (currentLine) lines.push(currentLine);

      const lineHeight = svgFontSize * 1.22;
      const startY = y - ((lines.length - 1) * lineHeight) / 2;

      return lines.map((line, idx) => (
        <text
          key={`line-${idx}`}
          x={x}
          y={startY + idx * lineHeight}
          textAnchor="middle"
          dominantBaseline="central"
          fontFamily="'Times New Roman', Times, serif"
          fontSize={svgFontSize}
          fill="#000000"
        >
          {line}
        </text>
      ));
    }

    return texEngine.renderToSVG(
      trimmed,
      x,
      y + svgFontSize * 0.3,
      svgFontSize,
      '#000000',
      'middle',
      hasBg,
      'text'
    );
  };

  const renderCompanionTwoWayTable = () => {
    if (state.numSets !== 2 || !state.showCompanionTable) return null;

    const lA = state.sets[0]?.label || 'A';
    const lB = state.sets[1]?.label || 'B';
    const vAB = state.regions[3]?.value || '0';
    const vAOnly = state.regions[1]?.value || '0';
    const vBOnly = state.regions[2]?.value || '0';
    const vOut = state.regions[0]?.value || '0';

    const nAB = parseFloat(vAB);
    const nAOnly = parseFloat(vAOnly);
    const nBOnly = parseFloat(vBOnly);
    const nOut = parseFloat(vOut);

    const rowA = !isNaN(nAB) && !isNaN(nAOnly) ? String(Number((nAB + nAOnly).toFixed(4))) : '';
    const rowNotA = !isNaN(nBOnly) && !isNaN(nOut) ? String(Number((nBOnly + nOut).toFixed(4))) : '';
    const colB = !isNaN(nAB) && !isNaN(nBOnly) ? String(Number((nAB + nBOnly).toFixed(4))) : '';
    const colNotB = !isNaN(nAOnly) && !isNaN(nOut) ? String(Number((nAOnly + nOut).toFixed(4))) : '';
    const grand =
      !isNaN(nAB) && !isNaN(nAOnly) && !isNaN(nBOnly) && !isNaN(nOut)
        ? String(Number((nAB + nAOnly + nBOnly + nOut).toFixed(4)))
        : '';

    const tableX = baseWidthPx + 10;
    const cellW = 50;
    const cellH = 34;
    const tableW = cellW * 4;
    const tableH = cellH * 4;
    const tableY = boxGeometry.cy - tableH / 2;
    const svgFs = ptToSvgUnits(state.fontSize);

    const dAB = formatDisplayValue(vAB);
    const dAOnly = formatDisplayValue(vAOnly);
    const dBOnly = formatDisplayValue(vBOnly);
    const dOut = formatDisplayValue(vOut);
    const dRowA = rowA ? formatDisplayValue(rowA) : '';
    const dRowNotA = rowNotA ? formatDisplayValue(rowNotA) : '';
    const dColB = colB ? formatDisplayValue(colB) : '';
    const dColNotB = colNotB ? formatDisplayValue(colNotB) : '';
    const dGrand = grand ? formatDisplayValue(grand) : '';

    const cells = [
      ['', lB, `${lB}'`, 'Total'],
      [lA, state.studentMode ? '' : dAB, state.studentMode ? '' : dAOnly, state.studentMode ? '' : dRowA],
      [`${lA}'`, state.studentMode ? '' : dBOnly, state.studentMode ? '' : dOut, state.studentMode ? '' : dRowNotA],
      ['Total', state.studentMode ? '' : dColB, state.studentMode ? '' : dColNotB, state.studentMode ? '' : dGrand]
    ];

    return (
      <g className="companion-table-layer">
        <rect
          x={tableX}
          y={tableY}
          width={tableW}
          height={tableH}
          fill="#ffffff"
          stroke="#000000"
          strokeWidth={1.5}
        />
        <rect x={tableX} y={tableY} width={tableW} height={cellH} fill="#f3f4f6" />
        <rect x={tableX} y={tableY} width={cellW} height={tableH} fill="#f3f4f6" />
        {[1, 2, 3].map(i => (
          <React.Fragment key={`tgrid-${i}`}>
            <line
              x1={tableX + i * cellW}
              y1={tableY}
              x2={tableX + i * cellW}
              y2={tableY + tableH}
              stroke="#000000"
              strokeWidth={i === 1 || i === 3 ? 1.5 : 1}
            />
            <line
              x1={tableX}
              y1={tableY + i * cellH}
              x2={tableX + tableW}
              y2={tableY + i * cellH}
              stroke="#000000"
              strokeWidth={i === 1 || i === 3 ? 1.5 : 1}
            />
          </React.Fragment>
        ))}
        {cells.map((row, rIdx) =>
          row.map((val, cIdx) => {
            if (!val) return null;
            const cx = tableX + cIdx * cellW + cellW / 2;
            const cy = tableY + rIdx * cellH + cellH / 2;
            const isHeader = rIdx === 0 || cIdx === 0;
            return (
              <text
                key={`tcell-${rIdx}-${cIdx}`}
                x={cx}
                y={cy}
                textAnchor="middle"
                dominantBaseline="central"
                fontFamily="'Times New Roman', Times, serif"
                fontSize={svgFs * 0.92}
                fontWeight={isHeader ? 'bold' : 'normal'}
                fontStyle={isHeader && val.length <= 2 ? 'italic' : 'normal'}
                fill="#000000"
              >
                {val}
              </text>
            );
          })
        )}
      </g>
    );
  };

  return (
    <div
      style={{
        width: widthPixels * previewScale,
        height: heightPixels * previewScale,
        margin: 'auto'
      }}
      className="relative shrink-0 shadow-lg bg-white border border-gray-300"
    >
      <div
        style={{
          width: widthPixels,
          height: heightPixels,
          transform: `scale(${previewScale})`,
          transformOrigin: 'top left'
        }}
        className="relative"
      >
        <svg
          id="venn-svg"
          width={widthPixels}
          height={heightPixels}
          viewBox={customViewBox || `0 0 ${widthPixels} ${heightPixels}`}
          xmlns="http://www.w3.org/2000/svg"
          className="w-full h-full block"
          style={{
            background: '#ffffff',
            cursor: cropMode
              ? 'crosshair'
              : canvasTool === 'shade'
              ? 'pointer'
              : 'default'
          }}
          onMouseDown={handleSvgMouseDown}
          onContextMenu={handleSvgContextMenu}
        >
          {/* Definitions: Patterns, ClipPaths, Exclusion Masks */}
          <defs>
            {renderPatternDefs()}

            {/* Universal Box ClipPath */}
            <clipPath id="venn-clip-universal">
              <rect
                x={boxGeometry.x}
                y={boxGeometry.y}
                width={boxGeometry.w}
                height={boxGeometry.h}
              />
            </clipPath>

            {/* Individual Set ClipPaths */}
            {activeSets.map(set => (
              <clipPath key={`clip-${set.id}`} id={`venn-clip-set-${set.id}`}>
                {renderSetShapeElement(set, `clip-shape-${set.id}`)}
              </clipPath>
            ))}

            {/* Exclusion Masks for each exclusive region m */}
            {Array.from({ length: totalRegions }).map((_, m) => (
              <mask key={`mask-${m}`} id={`venn-exclude-mask-${m}`}>
                <rect
                  x={0}
                  y={0}
                  width={widthPixels}
                  height={heightPixels}
                  fill="#ffffff"
                />
                {activeSets.map((set, sIdx) => {
                  const isIncluded = (m & (1 << sIdx)) !== 0;
                  if (isIncluded) return null;
                  return renderSetShapeElement(set, `mask-ex-${m}-${sIdx}`, {
                    fill: '#000000',
                    stroke: 'none'
                  });
                })}
              </mask>
            ))}
          </defs>

          {/* White Background */}
          <rect x={0} y={0} width={widthPixels} height={heightPixels} fill="#ffffff" />

          {/* Optional Chart Title */}
          {state.chartTitle && (
            <g
              className="title-layer"
              onContextMenu={e => openElementContextMenu(e, 'title')}
              onDoubleClick={() => navigateToGuiControl('style', 'gui-chart-title')}
              style={{ cursor: 'pointer' }}
            >
              <title>Right-click or double-click to edit or remove diagram title</title>
              <text
                x={boxGeometry.cx + state.titleOffset.x}
                y={18 + state.titleOffset.y}
                textAnchor="middle"
                dominantBaseline="central"
                fontFamily="'Times New Roman', Times, serif"
                fontSize={ptToSvgUnits(state.setLabelFontSize + 1)}
                fontWeight="bold"
                fill="#000000"
              >
                {state.chartTitle}
              </text>
            </g>
          )}

          {/* Main Data Layer (measured by AutoCrop) */}
          <g className="data-layer">
            {/* Universal Box Background */}
            {state.showUniversalBox && (
              <rect
                x={boxGeometry.x}
                y={boxGeometry.y}
                width={boxGeometry.w}
                height={boxGeometry.h}
                fill="#ffffff"
                stroke="none"
              />
            )}

            {/* Shaded Regions & Whole-Set Patterns */}
            {renderShadedRegions()}

            {/* Set Outlines */}
            {activeSets.map(set => {
              const dashArray =
                set.strokeStyle === 'dashed'
                  ? '7,5'
                  : set.strokeStyle === 'dotted'
                  ? '2.5,3.5'
                  : undefined;

              return renderSetShapeElement(set, `outline-${set.id}`, {
                fill: 'none',
                stroke: '#000000',
                strokeWidth: set.strokeWidth,
                strokeDasharray: dashArray,
                onMouseDown: e => handleSetDragStart(set.id, e),
                onContextMenu: e => {
                  setSelectedSetId(set.id);
                  openElementContextMenu(e, 'set-shape', { setId: set.id });
                },
                onDoubleClick: e => {
                  e.stopPropagation();
                  setSelectedSetId(set.id);
                  navigateToGuiControl('style', `gui-set-geom-${set.id}`);
                },
                style: {
                  cursor:
                    cropMode
                      ? 'crosshair'
                      : canvasTool === 'shade'
                      ? 'pointer'
                      : 'move'
                }
              });
            })}

            {/* Universal Set Border Outline (drawn on top of shaded regions) */}
            {state.showUniversalBox && (
              <rect
                x={boxGeometry.x}
                y={boxGeometry.y}
                width={boxGeometry.w}
                height={boxGeometry.h}
                fill="none"
                stroke="#000000"
                strokeWidth={state.universalBoxStrokeWidth}
                pointerEvents="none"
              />
            )}

            {/* Universal Set Symbol Label (U / ξ / ℰ / S / Ω) */}
            {state.universalLabelPos !== 'none' && (
              <g
                onMouseDown={handleUniversalLabelDragStart}
                onContextMenu={e => openElementContextMenu(e, 'universal-label')}
                onDoubleClick={e => {
                  e.stopPropagation();
                  navigateToGuiControl('style', 'gui-universal-label');
                }}
                style={{ cursor: canvasTool === 'manipulate' ? 'move' : 'pointer' }}
              >
                <title>Right-click or double-click to edit or hide universal set label</title>
                {(() => {
                  let ux = boxGeometry.x - 16;
                  let uy = boxGeometry.y + 8;
                  if (state.universalLabelPos === 'inside-top-left') {
                    ux = boxGeometry.x + 20;
                    uy = boxGeometry.y + 18;
                  } else if (state.universalLabelPos === 'outside-top-right') {
                    ux = boxGeometry.x + boxGeometry.w + 18;
                    uy = boxGeometry.y + 8;
                  }
                  ux += state.universalLabelOffset.x;
                  uy += state.universalLabelOffset.y;

                  const cleanSym =
                    state.universalSymbol === '\\xi'
                      ? 'ξ'
                      : state.universalSymbol === '\\mathcal{E}'
                      ? 'ℰ'
                      : state.universalSymbol === '\\Omega'
                      ? 'Ω'
                      : state.universalSymbol;

                  const totalVal =
                    state.universalTotal.trim() !== ''
                      ? state.universalTotal.trim()
                      : computedTotals.grandTotal !== null
                      ? String(computedTotals.grandTotal)
                      : '';

                  const uText =
                    state.showUniversalTotal && totalVal
                      ? `${cleanSym} = ${totalVal}`
                      : cleanSym;

                  const svgFs = ptToSvgUnits(state.setLabelFontSize);

                  return (
                    <>
                      {state.universalLabelPos === 'inside-top-left' && (
                        <rect
                          x={ux - (uText.length * svgFs * 0.35 + 4)}
                          y={uy - svgFs * 0.65}
                          width={uText.length * svgFs * 0.7 + 8}
                          height={svgFs * 1.3}
                          fill="#ffffff"
                          opacity={0.85}
                        />
                      )}
                      <text
                        x={ux}
                        y={uy}
                        textAnchor="middle"
                        dominantBaseline="central"
                        fontFamily="'Times New Roman', Times, serif"
                        fontSize={svgFs}
                        fontStyle="italic"
                        fontWeight="bold"
                        fill="#000000"
                      >
                        {uText}
                      </text>
                    </>
                  );
                })()}
              </g>
            )}

            {/* Set Labels (A, B, C) */}
            {activeSets.map((set, idx) => {
              const anchor = setLabelAnchors[idx];
              if (!anchor) return null;
              const lx = anchor.x + set.labelOffset.x;
              const ly = anchor.y + set.labelOffset.y;

              const setSum = computedTotals.setSums[idx];
              const formattedSum = setSum !== null ? formatDisplayValue(setSum) : null;
              const displayLabel =
                state.showSetTotalsInLabels && formattedSum !== null
                  ? `${set.label} (${formattedSum})`
                  : set.label;

              return (
                <g
                  key={`set-label-${set.id}`}
                  onMouseDown={e => handleSetLabelDragStart(set.id, e)}
                  onContextMenu={e => openElementContextMenu(e, 'set-label', { setId: set.id })}
                  onDoubleClick={e => {
                    e.stopPropagation();
                    navigateToGuiControl('data', `gui-set-label-${set.id}`);
                  }}
                  style={{ cursor: canvasTool === 'manipulate' ? 'move' : 'pointer' }}
                >
                  <title>{`Right-click or double-click to edit Set ${set.label}`}</title>
                  <text
                    x={lx}
                    y={ly}
                    textAnchor="middle"
                    dominantBaseline="central"
                    fontFamily="'Times New Roman', Times, serif"
                    fontSize={ptToSvgUnits(state.setLabelFontSize)}
                    fontWeight="bold"
                    fontStyle={displayLabel.length <= 2 ? 'italic' : 'normal'}
                    fill="#000000"
                  >
                    {displayLabel}
                  </text>
                </g>
              );
            })}

            {/* Exclusive Region Values / Blank Answer Boxes / Set Notation */}
            {Array.from({ length: totalRegions }).map((_, m) => {
              const reg = state.regions[m];
              if (!reg || reg.hidden) return null;
              const center = regionCenters[m];
              if (!center || !center.exists) return null;

              const rx = center.x + reg.labelOffset.x;
              const ry = center.y + reg.labelOffset.y;

              const showBox =
                reg.isBlankBox || (state.studentMode && state.studentModeAsBoxes);

              if (showBox) {
                const bw = state.blankBoxWidth;
                const bh = state.blankBoxHeight;
                return (
                  <g
                    key={`reg-box-${m}`}
                    onMouseDown={e => handleRegionLabelDragStart(m, e)}
                    onContextMenu={e => openElementContextMenu(e, 'region', { regionMask: m })}
                    onDoubleClick={e => {
                      e.stopPropagation();
                      navigateToGuiControl('data', `gui-region-${m}`, 'input', true);
                    }}
                    style={{ cursor: canvasTool === 'manipulate' ? 'move' : 'pointer' }}
                  >
                    <title>Right-click or double-click to edit this region</title>
                    <rect
                      x={rx - bw / 2}
                      y={ry - bh / 2}
                      width={bw}
                      height={bh}
                      rx={2}
                      ry={2}
                      fill="#ffffff"
                      stroke="#000000"
                      strokeWidth={1.3}
                    />
                  </g>
                );
              }

              if (state.studentMode && !state.showRegionNotationOnCanvas) {
                return null;
              }

              const meta = getRegionMeta(m);
              const svgFs = ptToSvgUnits(state.fontSize);

              if (state.showRegionNotationOnCanvas) {
                return (
                  <g
                    key={`reg-val-${m}`}
                    onMouseDown={e => handleRegionLabelDragStart(m, e)}
                    onContextMenu={e => openElementContextMenu(e, 'region', { regionMask: m })}
                    onDoubleClick={e => {
                      e.stopPropagation();
                      navigateToGuiControl('data', `gui-region-${m}`, 'input', true);
                    }}
                    style={{ cursor: canvasTool === 'manipulate' ? 'move' : 'pointer' }}
                  >
                    <title>{`Region ${meta.notation} — Right-click or double-click to edit`}</title>
                    <text
                      x={rx}
                      y={ry}
                      textAnchor="middle"
                      dominantBaseline="central"
                      fontFamily="'Times New Roman', Times, serif"
                      fontSize={svgFs}
                      fontStyle="italic"
                      fill="#000000"
                    >
                      {meta.notation}
                    </text>
                  </g>
                );
              }

              const textToRender = formatDisplayValue(reg.value);
              if (!textToRender || textToRender.trim() === '') return null;

              return (
                <g
                  key={`reg-val-${m}`}
                  onMouseDown={e => handleRegionLabelDragStart(m, e)}
                  onContextMenu={e => openElementContextMenu(e, 'region', { regionMask: m })}
                  onDoubleClick={e => {
                    e.stopPropagation();
                    navigateToGuiControl('data', `gui-region-${m}`, 'input', true);
                  }}
                  style={{ cursor: canvasTool === 'manipulate' ? 'move' : 'pointer' }}
                >
                  <title>{`Region ${meta.notation} (${meta.desc}) — Right-click or double-click to edit`}</title>
                  {renderMathOrText(textToRender, rx, ry, state.fontSize, false, false)}
                </g>
              );
            })}

            {/* Optional Companion Two-Way Table */}
            {renderCompanionTwoWayTable()}
          </g>

          {/* Crop Overlay inside SVG */}
          {cropMode && selectionBox && (
            <rect
              x={selectionBox.x}
              y={selectionBox.y}
              width={selectionBox.w}
              height={selectionBox.h}
              fill="rgba(59, 130, 246, 0.2)"
              stroke="#2563eb"
              strokeWidth={2 / previewScale}
              strokeDasharray={`${5 / previewScale},${5 / previewScale}`}
              pointerEvents="none"
            />
          )}
        </svg>

        {/* Interactive Resize Handles Overlay SVG (Screen-only, never exported to PNG/SVG) */}
        {!cropMode && canvasTool === 'manipulate' && (
          <svg
            width={widthPixels}
            height={heightPixels}
            viewBox={customViewBox || `0 0 ${widthPixels} ${heightPixels}`}
            className="absolute inset-0 w-full h-full pointer-events-none overflow-visible"
          >
            {/* 1. Outer Rectangle Border (Universal Box) Resize Grips */}
            {state.showUniversalBox && (
              <g className="box-resize-handles">
                <g
                  onMouseDown={e => handleBoxResizeStart('e', e)}
                  style={{ cursor: 'ew-resize', pointerEvents: 'all' }}
                >
                  <title>Drag left/right to make rectangle border narrower or wider</title>
                  <rect
                    x={boxGeometry.x + boxGeometry.w - 4}
                    y={boxGeometry.cy - 16}
                    width={8}
                    height={32}
                    rx={3}
                    fill="#ffffff"
                    stroke="#374151"
                    strokeWidth={1.25}
                  />
                  <line
                    x1={boxGeometry.x + boxGeometry.w}
                    y1={boxGeometry.cy - 8}
                    x2={boxGeometry.x + boxGeometry.w}
                    y2={boxGeometry.cy + 8}
                    stroke="#6b7280"
                    strokeWidth={1.2}
                  />
                </g>

                <g
                  onMouseDown={e => handleBoxResizeStart('w', e)}
                  style={{ cursor: 'ew-resize', pointerEvents: 'all' }}
                >
                  <title>Drag left/right to make rectangle border narrower or wider</title>
                  <rect
                    x={boxGeometry.x - 4}
                    y={boxGeometry.cy - 16}
                    width={8}
                    height={32}
                    rx={3}
                    fill="#ffffff"
                    stroke="#374151"
                    strokeWidth={1.25}
                  />
                  <line
                    x1={boxGeometry.x}
                    y1={boxGeometry.cy - 8}
                    x2={boxGeometry.x}
                    y2={boxGeometry.cy + 8}
                    stroke="#6b7280"
                    strokeWidth={1.2}
                  />
                </g>

                <g
                  onMouseDown={e => handleBoxResizeStart('s', e)}
                  style={{ cursor: 'ns-resize', pointerEvents: 'all' }}
                >
                  <title>Drag up/down to make rectangle border shorter or taller</title>
                  <rect
                    x={boxGeometry.cx - 16}
                    y={boxGeometry.y + boxGeometry.h - 4}
                    width={32}
                    height={8}
                    rx={3}
                    fill="#ffffff"
                    stroke="#374151"
                    strokeWidth={1.25}
                  />
                  <line
                    x1={boxGeometry.cx - 8}
                    y1={boxGeometry.y + boxGeometry.h}
                    x2={boxGeometry.cx + 8}
                    y2={boxGeometry.y + boxGeometry.h}
                    stroke="#6b7280"
                    strokeWidth={1.2}
                  />
                </g>

                <rect
                  x={boxGeometry.x + boxGeometry.w - 5}
                  y={boxGeometry.y + boxGeometry.h - 5}
                  width={10}
                  height={10}
                  rx={2}
                  fill="#374151"
                  stroke="#ffffff"
                  strokeWidth={1.2}
                  onMouseDown={e => handleBoxResizeStart('se', e)}
                  style={{ cursor: 'nwse-resize', pointerEvents: 'all' }}
                >
                  <title>Drag corner to resize rectangle border</title>
                </rect>
              </g>
            )}

            {/* 2. Set Shape Resize Handles (Circles / Ellipses / Rectangles) */}
            {activeSets.map((set, idx) => {
              const scx = boxGeometry.cx + set.cx;
              const scy = boxGeometry.cy + set.cy;
              const srx = set.rx;
              const sry = state.shapeType === 'circle' ? set.rx : set.ry;
              const isIndividuallySelected = selectedSetId === set.id;

              const quickHandleSide: 'w' | 'e' | 's' =
                state.numSets === 1
                  ? 'e'
                  : idx === 0
                  ? 'w'
                  : idx === 1
                  ? 'e'
                  : 's';
              const qx =
                quickHandleSide === 'w'
                  ? scx - srx
                  : quickHandleSide === 'e'
                  ? scx + srx
                  : scx;
              const qy = quickHandleSide === 's' ? scy + sry : scy;

              if (!isIndividuallySelected) {
                return (
                  <g key={`quick-handle-${set.id}`}>
                    <rect
                      x={qx - 4.5}
                      y={qy - 4.5}
                      width={9}
                      height={9}
                      rx={2}
                      fill="#ffffff"
                      stroke="#1f2937"
                      strokeWidth={1.5}
                      onMouseDown={e => handleSetResizeStart(set.id, quickHandleSide, e)}
                      style={{
                        cursor: quickHandleSide === 's' ? 'ns-resize' : 'ew-resize',
                        pointerEvents: 'all'
                      }}
                    >
                      <title>{`Drag to resize Set ${set.label} (or click Set ${set.label} for full handles)`}</title>
                    </rect>
                  </g>
                );
              }

              const handles: {
                id: 'e' | 'w' | 's' | 'n' | 'se' | 'sw' | 'ne' | 'nw';
                x: number;
                y: number;
                cursor: string;
              }[] = [
                { id: 'e', x: scx + srx, y: scy, cursor: 'ew-resize' },
                { id: 'w', x: scx - srx, y: scy, cursor: 'ew-resize' },
                { id: 's', x: scx, y: scy + sry, cursor: 'ns-resize' },
                { id: 'n', x: scx, y: scy - sry, cursor: 'ns-resize' },
                { id: 'se', x: scx + srx, y: scy + sry, cursor: 'nwse-resize' },
                { id: 'nw', x: scx - srx, y: scy - sry, cursor: 'nwse-resize' },
                { id: 'ne', x: scx + srx, y: scy - sry, cursor: 'nesw-resize' },
                { id: 'sw', x: scx - srx, y: scy + sry, cursor: 'nesw-resize' }
              ];

              return (
                <g key={`selected-handles-${set.id}`}>
                  <rect
                    x={scx - srx}
                    y={scy - sry}
                    width={srx * 2}
                    height={sry * 2}
                    fill="none"
                    stroke="#374151"
                    strokeWidth={1.2}
                    strokeDasharray="4,4"
                  />
                  {handles.map(h => (
                    <rect
                      key={h.id}
                      x={h.x - 4.5}
                      y={h.y - 4.5}
                      width={9}
                      height={9}
                      rx={1.5}
                      fill="#ffffff"
                      stroke="#111827"
                      strokeWidth={1.6}
                      onMouseDown={e => handleSetResizeStart(set.id, h.id, e)}
                      style={{ cursor: h.cursor, pointerEvents: 'all' }}
                    >
                      <title>{`Drag to resize Set ${set.label}`}</title>
                    </rect>
                  ))}
                </g>
              );
            })}
          </svg>
        )}
      </div>
    </div>
  );
};
