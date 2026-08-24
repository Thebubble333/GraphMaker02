const fs = require('fs');
let code = fs.readFileSync('components/GraphToolbar.tsx', 'utf8');

code = code.replace(
    "ZoomIn, ZoomOut, Check, Image, Copy, Crop, FileCode, Move, Maximize, Scan",
    "ZoomIn, ZoomOut, Check, Image, Copy, Crop, FileCode, Move, Maximize, Scan, Undo2, Redo2, Download, Upload"
);

code = code.replace(
    "onDpiChange?: (dpi: number) => void; // New Prop\n}",
    "onDpiChange?: (dpi: number) => void; // New Prop\n  onUndo?: () => void;\n  onRedo?: () => void;\n  canUndo?: boolean;\n  canRedo?: boolean;\n  onExportData?: () => void;\n  onImportData?: (file: File) => void;\n}"
);

code = code.replace(
    "exportDpi = 300, onDpiChange\n}) => {",
    "exportDpi = 300, onDpiChange,\n  onUndo, onRedo, canUndo, canRedo,\n  onExportData, onImportData\n}) => {"
);

code = code.replace(
    '<div className="flex items-center gap-2">\n      {/* Zoom Controls */}',
    `<div className="flex items-center gap-2">
      {/* History and Data Controls */}
      {(onUndo || onRedo || onExportData || onImportData) && (
        <div className="flex items-center bg-gray-100 rounded-md p-1 mr-1 gap-1">
          {onUndo && (
            <button onClick={onUndo} disabled={!canUndo} className={\`p-1.5 rounded transition-all \${canUndo ? 'hover:bg-white text-gray-700 hover:shadow-sm' : 'text-gray-400 cursor-not-allowed'}\`} title="Undo">
              <Undo2 className="w-4 h-4" />
            </button>
          )}
          {onRedo && (
            <button onClick={onRedo} disabled={!canRedo} className={\`p-1.5 rounded transition-all \${canRedo ? 'hover:bg-white text-gray-700 hover:shadow-sm' : 'text-gray-400 cursor-not-allowed'}\`} title="Redo">
              <Redo2 className="w-4 h-4" />
            </button>
          )}
          {onExportData && (
            <button onClick={onExportData} className="p-1.5 hover:bg-white hover:shadow-sm rounded transition-all text-gray-700 ml-1" title="Save Project to File">
              <Download className="w-4 h-4" />
            </button>
          )}
          {onImportData && (
            <div className="relative">
              <input type="file" accept=".json" onChange={(e) => {
                if (e.target.files && e.target.files.length > 0) {
                  onImportData(e.target.files[0] as any);
                  e.target.value = '';
                }
              }} className="absolute inset-0 opacity-0 cursor-pointer w-full h-full" title="Load Project from File" />
              <button className="p-1.5 hover:bg-white hover:shadow-sm rounded transition-all text-gray-700" title="Load Project from File">
                <Upload className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>
      )}

      {/* Zoom Controls */}`
);

fs.writeFileSync('components/GraphToolbar.tsx', code);
