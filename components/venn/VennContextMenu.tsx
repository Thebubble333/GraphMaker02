import React from 'react';
import {
  ExternalLink,
  PaintBucket,
  Square,
  Eye,
  EyeOff,
  Trash2,
  RotateCcw,
  Edit3,
  Maximize2
} from 'lucide-react';
import {
  VennState,
  VennRegionDef,
  VennSetDef,
  VennContextMenuState
} from '../../utils/vennLogic';

interface VennContextMenuProps {
  contextMenu: VennContextMenuState | null;
  state: VennState;
  getRegionMeta: (mask: number) => { notation: string; math: string; desc: string };
  navigateToGuiControl: (
    tab: 'data' | 'shading' | 'style',
    controlId: string,
    inputSelector?: string,
    forceDirectRegions?: boolean
  ) => void;
  forceSnapshot: () => void;
  updateRegion: (mask: number, updates: Partial<VennRegionDef>) => void;
  updateSet: (id: number, updates: Partial<VennSetDef>) => void;
  updateState: (updater: (prev: VennState) => VennState) => void;
  handleSelectNumSets: (n: 1 | 2 | 3) => void;
  handleFitShapesInsideBorder: () => void;
  onClose: () => void;
}

export const VennContextMenu: React.FC<VennContextMenuProps> = ({
  contextMenu,
  state,
  getRegionMeta,
  navigateToGuiControl,
  forceSnapshot,
  updateRegion,
  updateSet,
  updateState,
  handleSelectNumSets,
  handleFitShapesInsideBorder,
  onClose
}) => {
  if (!contextMenu) return null;

  return (
    <>
      <div
        className="fixed inset-0 z-40"
        onClick={onClose}
        onContextMenu={e => {
          e.preventDefault();
          onClose();
        }}
      />
      <div
        style={{ top: contextMenu.y, left: contextMenu.x }}
        className="fixed z-50 w-64 bg-white rounded-lg shadow-xl border border-gray-300 py-1.5 text-xs text-gray-800 select-none"
      >
        {/* REGION CONTEXT MENU */}
        {contextMenu.targetType === 'region' &&
          contextMenu.regionMask !== undefined &&
          (() => {
            const m = contextMenu.regionMask;
            const reg = state.regions[m];
            const meta = getRegionMeta(m);
            if (!reg) return null;
            return (
              <div>
                <div className="px-3 py-1.5 border-b border-gray-100 bg-gray-50 flex items-center justify-between">
                  <span className="font-serif font-bold text-sm text-gray-900">
                    Region {meta.notation}
                  </span>
                  <span className="text-[11px] text-gray-500">{meta.desc}</span>
                </div>
                <div className="p-1 space-y-0.5">
                  <button
                    onClick={() => navigateToGuiControl('data', `gui-region-${m}`, 'input', true)}
                    className="w-full px-2.5 py-1.5 text-left rounded hover:bg-gray-100 flex items-center gap-2 font-semibold text-gray-900"
                  >
                    <ExternalLink size={13} className="text-gray-600" />
                    Edit Value in Sidebar...
                  </button>
                  <button
                    onClick={() => {
                      forceSnapshot();
                      updateRegion(m, { shaded: !reg.shaded });
                      onClose();
                    }}
                    className="w-full px-2.5 py-1.5 text-left rounded hover:bg-gray-100 flex items-center gap-2"
                  >
                    <PaintBucket size={13} className="text-gray-600" />
                    {reg.shaded ? 'Unshade Region' : 'Shade Region'}
                  </button>
                  <button
                    onClick={() => {
                      forceSnapshot();
                      updateRegion(m, { isBlankBox: !reg.isBlankBox });
                      onClose();
                    }}
                    className="w-full px-2.5 py-1.5 text-left rounded hover:bg-gray-100 flex items-center gap-2"
                  >
                    <Square size={13} className="text-gray-600" />
                    {reg.isBlankBox ? 'Remove Blank Answer Box [ ]' : 'Show as Blank Answer Box [ ]'}
                  </button>
                  <button
                    onClick={() => {
                      forceSnapshot();
                      updateRegion(m, { hidden: !reg.hidden });
                      onClose();
                    }}
                    className="w-full px-2.5 py-1.5 text-left rounded hover:bg-gray-100 flex items-center gap-2"
                  >
                    {reg.hidden ? (
                      <>
                        <Eye size={13} className="text-gray-600" /> Show Region Value
                      </>
                    ) : (
                      <>
                        <EyeOff size={13} className="text-gray-600" /> Hide Region Value
                      </>
                    )}
                  </button>
                  {reg.value !== '' && (
                    <button
                      onClick={() => {
                        forceSnapshot();
                        updateRegion(m, { value: '' });
                        onClose();
                      }}
                      className="w-full px-2.5 py-1.5 text-left rounded hover:bg-red-50 text-red-600 flex items-center gap-2"
                    >
                      <Trash2 size={13} /> Clear / Delete Value
                    </button>
                  )}
                  {(reg.labelOffset.x !== 0 || reg.labelOffset.y !== 0) && (
                    <button
                      onClick={() => {
                        forceSnapshot();
                        updateRegion(m, { labelOffset: { x: 0, y: 0 } });
                        onClose();
                      }}
                      className="w-full px-2.5 py-1.5 text-left rounded hover:bg-gray-100 flex items-center gap-2 text-gray-600"
                    >
                      <RotateCcw size={13} /> Reset Label Position
                    </button>
                  )}
                </div>
              </div>
            );
          })()}

        {/* SET LABEL OR SET SHAPE CONTEXT MENU */}
        {(contextMenu.targetType === 'set-label' || contextMenu.targetType === 'set-shape') &&
          contextMenu.setId !== undefined &&
          (() => {
            const s = state.sets.find(item => item.id === contextMenu.setId);
            if (!s) return null;
            return (
              <div>
                <div className="px-3 py-1.5 border-b border-gray-100 bg-gray-50 flex items-center justify-between">
                  <span className="font-serif font-bold text-sm text-gray-900">
                    Set {s.label}
                  </span>
                  <span className="text-[11px] text-gray-500">
                    {state.shapeType === 'circle'
                      ? 'Circle'
                      : state.shapeType === 'ellipse'
                      ? 'Ellipse'
                      : 'Rectangle'}
                  </span>
                </div>
                <div className="p-1 space-y-0.5">
                  <button
                    onClick={() => navigateToGuiControl('data', `gui-set-label-${s.id}`, 'input')}
                    className="w-full px-2.5 py-1.5 text-left rounded hover:bg-gray-100 flex items-center gap-2 font-semibold text-gray-900"
                  >
                    <Edit3 size={13} className="text-gray-600" />
                    Rename Set &ldquo;{s.label}&rdquo; in Sidebar...
                  </button>
                  <button
                    onClick={() => navigateToGuiControl('style', `gui-set-geom-${s.id}`, 'input')}
                    className="w-full px-2.5 py-1.5 text-left rounded hover:bg-gray-100 flex items-center gap-2 font-semibold text-gray-900"
                  >
                    <ExternalLink size={13} className="text-gray-600" />
                    Edit Size &amp; Border Style in Sidebar...
                  </button>
                  {(s.labelOffset.x !== 0 || s.labelOffset.y !== 0) && (
                    <button
                      onClick={() => {
                        forceSnapshot();
                        updateSet(s.id, { labelOffset: { x: 0, y: 0 } });
                        onClose();
                      }}
                      className="w-full px-2.5 py-1.5 text-left rounded hover:bg-gray-100 flex items-center gap-2 text-gray-600"
                    >
                      <RotateCcw size={13} /> Reset Label Position
                    </button>
                  )}
                  {state.numSets > 1 && (
                    <button
                      onClick={() => {
                        const nextCount = (state.numSets - 1) as 1 | 2;
                        handleSelectNumSets(nextCount);
                        onClose();
                      }}
                      className="w-full px-2.5 py-1.5 text-left rounded hover:bg-red-50 text-red-600 flex items-center gap-2"
                    >
                      <Trash2 size={13} /> Reduce to {state.numSets - 1}{' '}
                      {state.numSets - 1 === 1 ? 'Set' : 'Sets'}
                    </button>
                  )}
                </div>
              </div>
            );
          })()}

        {/* DIAGRAM TITLE CONTEXT MENU */}
        {contextMenu.targetType === 'title' && (
          <div>
            <div className="px-3 py-1.5 border-b border-gray-100 bg-gray-50 flex items-center justify-between">
              <span className="font-bold text-gray-900">Diagram Title</span>
            </div>
            <div className="p-1 space-y-0.5">
              <button
                onClick={() => navigateToGuiControl('style', 'gui-chart-title', 'input')}
                className="w-full px-2.5 py-1.5 text-left rounded hover:bg-gray-100 flex items-center gap-2 font-semibold text-gray-900"
              >
                <ExternalLink size={13} className="text-gray-600" />
                Edit Title Text in Sidebar...
              </button>
              <button
                onClick={() => {
                  forceSnapshot();
                  updateState(prev => ({ ...prev, chartTitle: '' }));
                  onClose();
                }}
                className="w-full px-2.5 py-1.5 text-left rounded hover:bg-red-50 text-red-600 flex items-center gap-2"
              >
                <Trash2 size={13} /> Remove / Hide Title
              </button>
            </div>
          </div>
        )}

        {/* UNIVERSAL SET CORNER LABEL CONTEXT MENU */}
        {contextMenu.targetType === 'universal-label' && (
          <div>
            <div className="px-3 py-1.5 border-b border-gray-100 bg-gray-50 flex items-center justify-between">
              <span className="font-bold text-gray-900">
                Universal Set Label ({state.universalSymbol})
              </span>
            </div>
            <div className="p-1 space-y-0.5">
              <button
                onClick={() => navigateToGuiControl('style', 'gui-universal-label', 'select')}
                className="w-full px-2.5 py-1.5 text-left rounded hover:bg-gray-100 flex items-center gap-2 font-semibold text-gray-900"
              >
                <ExternalLink size={13} className="text-gray-600" />
                Edit Symbol &amp; Position in Sidebar...
              </button>
              <button
                onClick={() => {
                  forceSnapshot();
                  updateState(prev => ({ ...prev, universalLabelPos: 'none' }));
                  onClose();
                }}
                className="w-full px-2.5 py-1.5 text-left rounded hover:bg-red-50 text-red-600 flex items-center gap-2"
              >
                <Trash2 size={13} /> Hide Corner Label
              </button>
            </div>
          </div>
        )}

        {/* OUTER RECTANGLE BORDER CONTEXT MENU */}
        {contextMenu.targetType === 'border' && (
          <div>
            <div className="px-3 py-1.5 border-b border-gray-100 bg-gray-50 flex items-center justify-between">
              <span className="font-bold text-gray-900">Outer Rectangle Border</span>
              <span className="text-[11px] text-gray-500">
                {state.dimCm.width}×{state.dimCm.height} cm
              </span>
            </div>
            <div className="p-1 space-y-0.5">
              <button
                onClick={() => navigateToGuiControl('style', 'gui-border-dimensions', 'input')}
                className="w-full px-2.5 py-1.5 text-left rounded hover:bg-gray-100 flex items-center gap-2 font-semibold text-gray-900"
              >
                <ExternalLink size={13} className="text-gray-600" />
                Edit Border Size &amp; Title in Sidebar...
              </button>
              <button
                onClick={() => {
                  handleFitShapesInsideBorder();
                  onClose();
                }}
                className="w-full px-2.5 py-1.5 text-left rounded hover:bg-gray-100 flex items-center gap-2"
              >
                <Maximize2 size={13} className="text-gray-600" />
                Fit Shapes Inside Border
              </button>
              <button
                onClick={() => {
                  forceSnapshot();
                  updateState(prev => ({
                    ...prev,
                    showUniversalBox: !prev.showUniversalBox
                  }));
                  onClose();
                }}
                className="w-full px-2.5 py-1.5 text-left rounded hover:bg-gray-100 flex items-center gap-2"
              >
                {state.showUniversalBox ? (
                  <>
                    <EyeOff size={13} className="text-gray-600" /> Hide Outer Rectangle Border
                  </>
                ) : (
                  <>
                    <Eye size={13} className="text-gray-600" /> Show Outer Rectangle Border
                  </>
                )}
              </button>
            </div>
          </div>
        )}
      </div>
    </>
  );
};
