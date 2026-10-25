import React from 'react';
import { 
  ZoomIn, ZoomOut, Check, Image, Copy, Crop, FileCode, Move, Maximize, Scan, Undo2, Redo2, Download, Upload 
, Trash2, RotateCcw , Expand } from "lucide-react";

interface GraphToolbarProps {
  previewScale?: number;
  setPreviewScale?: (s: number | ((prev: number) => number)) => void;
  cropMode?: boolean;
  setCropMode?: (val: boolean) => void;
  onResetView?: () => void;
  onZoomOutCanvas?: () => void;
  onAutoCrop?: () => void;
  onExportPNG: () => void;
  onExportSVG: () => void;
  onCopy?: () => void;
  isCopied?: boolean;
  onFitToScreen?: () => void; 
  showDebug?: boolean; 
  onToggleDebug?: () => void;
  exportDpi?: number; // New Prop
  onDpiChange?: (dpi: number) => void; // New Prop
  onUndo?: () => void;
  onRedo?: () => void;
  canUndo?: boolean;
  canRedo?: boolean;
  onExportData?: () => void;
  onImportData?: (file: File) => void;
  onExportState?: () => void;
  onImportState?: (file: File) => void;
  onClearAll?: () => void;
  onDefaultSettings?: () => void;
  onResetDefaultSettings?: () => void;
}

export const GraphToolbar: React.FC<GraphToolbarProps> = ({
  previewScale, setPreviewScale,
  cropMode, setCropMode,
  onResetView, onZoomOutCanvas, onAutoCrop,
  onExportPNG, onExportSVG,
  onCopy, isCopied,
  onFitToScreen,
  showDebug, onToggleDebug,
  exportDpi = 300, onDpiChange,
  onUndo, onRedo, canUndo, canRedo,
  onExportData, onImportData, onExportState, onImportState,
  onClearAll, onDefaultSettings, onResetDefaultSettings
}) => {
  const effectiveExportData = onExportData || onExportState;
  const effectiveImportData = onImportData || onImportState;
  const effectiveDefaultSettings = onDefaultSettings || onResetDefaultSettings;
  const showZoomControls = previewScale !== undefined && setPreviewScale !== undefined;
  const showCropControls = cropMode !== undefined && setCropMode !== undefined && onResetView !== undefined && onAutoCrop !== undefined;

  return (
    <div className="flex items-center flex-wrap gap-1.5">
      {/* History and Data Controls */}
      {(onUndo || onRedo || effectiveExportData || effectiveImportData || onClearAll || effectiveDefaultSettings) && (
        <div className="flex items-center bg-gray-100 rounded-md p-0.5 gap-0.5">
          {onClearAll && (
            <button onClick={onClearAll} className="p-1 rounded transition-all hover:bg-red-50 hover:text-red-600 text-gray-700 hover:shadow-xs" title="Clear All Canvas Objects">
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          )}
          {effectiveDefaultSettings && (
            <button onClick={effectiveDefaultSettings} className="p-1 rounded transition-all hover:bg-white text-gray-700 hover:shadow-xs" title="Restore Default Settings">
              <RotateCcw className="w-3.5 h-3.5" />
            </button>
          )}
          {(onClearAll || effectiveDefaultSettings) && <div className="w-px h-3.5 bg-gray-300 mx-0.5"></div>}
          {onUndo && (
            <button onClick={onUndo} disabled={!canUndo} className={`p-1 rounded transition-all ${canUndo ? 'hover:bg-white text-gray-700 hover:shadow-xs' : 'text-gray-400 cursor-not-allowed'}`} title="Undo">
              <Undo2 className="w-3.5 h-3.5" />
            </button>
          )}
          {onRedo && (
            <button onClick={onRedo} disabled={!canRedo} className={`p-1 rounded transition-all ${canRedo ? 'hover:bg-white text-gray-700 hover:shadow-xs' : 'text-gray-400 cursor-not-allowed'}`} title="Redo">
              <Redo2 className="w-3.5 h-3.5" />
            </button>
          )}
          {effectiveExportData && (
            <button onClick={effectiveExportData} className="p-1 hover:bg-white hover:shadow-xs rounded transition-all text-gray-700" title="Save Project to File">
              <Download className="w-3.5 h-3.5" />
            </button>
          )}
          {effectiveImportData && (
            <div className="relative">
              <input type="file" accept=".json" onChange={(e) => {
                if (e.target.files && e.target.files.length > 0) {
                  effectiveImportData(e.target.files[0] as any);
                  e.target.value = '';
                }
              }} className="absolute inset-0 opacity-0 cursor-pointer w-full h-full" title="Load Project from File" />
              <button className="p-1 hover:bg-white hover:shadow-xs rounded transition-all text-gray-700" title="Load Project from File">
                <Upload className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
        </div>
      )}

      {/* Zoom Controls */}
      {showZoomControls && (
        <div className="flex items-center bg-gray-100 rounded-md p-0.5">
          <button 
            onClick={() => setPreviewScale(s => Math.max(0.1, (s as number) - 0.25))} 
            className="p-1 hover:bg-white hover:shadow-xs rounded transition-all text-gray-600"
            title="Zoom Out"
          >
            <ZoomOut className="w-3.5 h-3.5" />
          </button>
          <button 
            onClick={() => setPreviewScale(1)}
            className="text-[11px] font-medium text-gray-600 w-10 text-center select-none hover:text-blue-600 hover:bg-white rounded py-0.5 transition-colors cursor-pointer"
            title="Reset to 100% (True Size)"
          >
            {Math.round(previewScale * 100)}%
          </button>
          <button 
            onClick={() => setPreviewScale(s => Math.min(5, (s as number) + 0.25))} 
            className="p-1 hover:bg-white hover:shadow-xs rounded transition-all text-gray-600"
            title="Zoom In"
          >
            <ZoomIn className="w-3.5 h-3.5" />
          </button>
          
          {onFitToScreen && (
              <>
                  <div className="w-px h-3.5 bg-gray-300 mx-0.5"></div>
                  <button 
                      onClick={onFitToScreen}
                      className="p-1 hover:bg-white hover:shadow-xs rounded transition-all text-gray-600"
                      title="Fit to Screen"
                  >
                      <Maximize className="w-3.5 h-3.5" />
                  </button>
              </>
          )}
        </div>
      )}

      {/* Crop Tools */}
      {showCropControls && (
        <div className="flex items-center gap-0.5 bg-gray-100 p-0.5 rounded-md">
          {onZoomOutCanvas && (
              <button 
                onClick={onZoomOutCanvas}
                className="p-1 hover:bg-white hover:text-blue-600 rounded text-gray-500"
                title="Expand Canvas Area (Zoom Out ViewBox)"
              >
                <Expand className="w-3.5 h-3.5" />
              </button>
          )}
          <button 
            onClick={onResetView}
            className="p-1 hover:bg-white hover:text-blue-600 rounded text-gray-500"
            title="Reset View"
          >
            <Move className="w-3.5 h-3.5" />
          </button>
          <button 
            onClick={() => setCropMode(!cropMode)}
            className={`p-1 rounded transition-colors ${cropMode ? 'bg-blue-600 text-white shadow-xs' : 'hover:bg-white hover:text-blue-600 text-gray-500'}`}
            title="Manual Crop Tool (Drag to crop)"
          >
            <Crop className="w-3.5 h-3.5" />
          </button>
          <button 
            onClick={onAutoCrop}
            className="p-1 hover:bg-white hover:text-blue-600 rounded text-gray-500"
            title="Auto Fit Content (Auto Crop + Auto Zoom)"
          >
            <span className="text-[10px] font-bold px-0.5">AUTO</span>
          </button>
        </div>
      )}

      {/* Debug Tool */}
      {onToggleDebug && (
          <div className="flex items-center gap-0.5 bg-gray-100 p-0.5 rounded-md">
              <button 
                  onClick={onToggleDebug}
                  className={`p-1 rounded transition-colors ${showDebug ? 'bg-red-50 text-red-600 shadow-xs border border-red-200' : 'hover:bg-white text-gray-500'}`}
                  title="Toggle Debug Bounding Boxes"
              >
                  <Scan className="w-3.5 h-3.5" />
              </button>
          </div>
      )}

      {/* Export Actions */}
      <div className="flex items-center gap-1">
          <button 
            onClick={onCopy} 
            style={{ height: 'var(--ui-toolbar-height, 30px)' }}
            className="flex items-center gap-1.5 px-2.5 bg-white border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50 transition-colors shadow-xs text-xs font-medium"
            title="Copy PNG to Clipboard"
          >
            {isCopied ? <Check className="w-3.5 h-3.5 text-green-600" /> : <Copy className="w-3.5 h-3.5" />} Copy
          </button>
          
          <button 
            onClick={onExportSVG} 
            style={{ height: 'var(--ui-toolbar-height, 30px)' }}
            className="flex items-center gap-1.5 px-2.5 bg-white border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50 transition-colors shadow-xs text-xs font-medium"
            title="Download SVG"
          >
            <FileCode className="w-3.5 h-3.5" /> SVG
          </button>

          <div className="flex items-center gap-0">
              <select 
                value={exportDpi}
                onChange={(e) => onDpiChange?.(Number(e.target.value))}
                style={{ height: 'var(--ui-toolbar-height, 30px)' }}
                className="bg-white border border-r-0 border-gray-300 text-[10px] font-bold text-gray-600 px-1 rounded-l-md outline-none hover:bg-gray-50 transition-colors"
                title="Select Export DPI"
              >
                <option value="72">72</option>
                <option value="96">96</option>
                <option value="150">150</option>
                <option value="300">300</option>
                <option value="600">600</option>
                <option value="1200">1200</option>
              </select>
              <button 
                onClick={onExportPNG} 
                style={{ height: 'var(--ui-toolbar-height, 30px)' }}
                className="flex items-center gap-1.5 px-2.5 bg-blue-600 text-white rounded-r-md hover:bg-blue-700 transition-colors shadow-xs text-xs font-medium"
                title="Download PNG"
              >
                <Image className="w-3.5 h-3.5" /> PNG
              </button>
          </div>
      </div>
    </div>
  );
};