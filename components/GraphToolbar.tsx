import React from 'react';
import { 
  ZoomIn, ZoomOut, Check, Image, Copy, Crop, FileCode, Move, Maximize, Scan 
} from 'lucide-react';

interface GraphToolbarProps {
  previewScale: number;
  setPreviewScale: (s: number | ((prev: number) => number)) => void;
  cropMode: boolean;
  setCropMode: (val: boolean) => void;
  onResetView: () => void;
  onAutoCrop: () => void;
  onExportPNG: () => void;
  onExportSVG: () => void;
  onCopy?: () => void;
  isCopied?: boolean;
  onFitToScreen?: () => void; 
  showDebug?: boolean; 
  onToggleDebug?: () => void;
  exportDpi?: number; // New Prop
  onDpiChange?: (dpi: number) => void; // New Prop
}

export const GraphToolbar: React.FC<GraphToolbarProps> = ({
  previewScale, setPreviewScale,
  cropMode, setCropMode,
  onResetView, onAutoCrop,
  onExportPNG, onExportSVG,
  onCopy, isCopied,
  onFitToScreen,
  showDebug, onToggleDebug,
  exportDpi = 300, onDpiChange
}) => {
  return (
    <div className="flex items-center gap-2">
      {/* Zoom Controls */}
      <div className="flex items-center bg-gray-100 rounded-md p-1 mr-1">
        <button 
          onClick={() => setPreviewScale(s => Math.max(0.5, s - 0.25))} 
          className="p-1 hover:bg-white hover:shadow-sm rounded transition-all text-gray-600"
          title="Zoom Out"
        >
          <ZoomOut className="w-4 h-4" />
        </button>
        <span className="text-xs font-medium text-gray-500 w-12 text-center select-none">
          {Math.round(previewScale * 100)}%
        </span>
        <button 
          onClick={() => setPreviewScale(s => Math.min(5, s + 0.25))} 
          className="p-1 hover:bg-white hover:shadow-sm rounded transition-all text-gray-600"
          title="Zoom In"
        >
          <ZoomIn className="w-4 h-4" />
        </button>
        
        {onFitToScreen && (
            <>
                <div className="w-px h-4 bg-gray-300 mx-1"></div>
                <button 
                    onClick={onFitToScreen}
                    className="p-1 hover:bg-white hover:shadow-sm rounded transition-all text-gray-600"
                    title="Fit to Screen"
                >
                    <Maximize className="w-4 h-4" />
                </button>
            </>
        )}
      </div>

      {/* Crop Tools */}
      <div className="flex items-center gap-1 bg-gray-100 p-1 rounded-md mr-1">
        <button 
          onClick={onResetView}
          className="p-1.5 hover:bg-white hover:text-blue-600 rounded text-gray-500"
          title="Reset View"
        >
          <Move className="w-4 h-4" />
        </button>
        <button 
          onClick={() => setCropMode(!cropMode)}
          className={`p-1.5 rounded transition-colors ${cropMode ? 'bg-blue-600 text-white shadow-sm' : 'hover:bg-white hover:text-blue-600 text-gray-500'}`}
          title="Manual Crop Tool (Drag to crop)"
        >
          <Crop className="w-4 h-4" />
        </button>
        <button 
          onClick={onAutoCrop}
          className="p-1.5 hover:bg-white hover:text-blue-600 rounded text-gray-500"
          title="Auto Fit Content (Auto Crop + Auto Zoom)"
        >
          <span className="text-[10px] font-bold px-1">AUTO</span>
        </button>
      </div>

      {/* Debug Tool */}
      {onToggleDebug && (
          <div className="flex items-center gap-1 bg-gray-100 p-1 rounded-md mr-1">
              <button 
                  onClick={onToggleDebug}
                  className={`p-1.5 rounded transition-colors ${showDebug ? 'bg-red-50 text-red-600 shadow-sm border border-red-200' : 'hover:bg-white text-gray-500'}`}
                  title="Toggle Debug Bounding Boxes"
              >
                  <Scan className="w-4 h-4" />
              </button>
          </div>
      )}

      {/* Export Actions */}
      <div className="flex items-center gap-1">
          <button 
            onClick={onCopy} 
            className="flex items-center gap-2 px-3 py-2 bg-white border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50 transition-colors shadow-sm text-sm font-medium h-9"
          >
            {isCopied ? <Check className="w-4 h-4 text-green-600" /> : <Copy className="w-4 h-4" />} Copy
          </button>
          
          <button 
            onClick={onExportSVG} 
            className="flex items-center gap-2 px-3 py-2 bg-white border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50 transition-colors shadow-sm text-sm font-medium h-9"
          >
            <FileCode className="w-4 h-4" /> SVG
          </button>

          <div className="flex items-center gap-0">
              <select 
                value={exportDpi}
                onChange={(e) => onDpiChange?.(Number(e.target.value))}
                className="bg-white border border-r-0 border-gray-300 text-[10px] font-bold text-gray-600 h-9 px-1 rounded-l-md outline-none hover:bg-gray-50 transition-colors"
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
                className="flex items-center gap-2 px-3 py-2 bg-blue-600 text-white rounded-r-md hover:bg-blue-700 transition-colors shadow-sm text-sm font-medium h-9"
              >
                <Image className="w-4 h-4" /> PNG
              </button>
          </div>
      </div>
    </div>
  );
};