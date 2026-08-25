const fs = require('fs');
let code = fs.readFileSync('components/GraphToolbar.tsx', 'utf8');

// Add imports
code = code.replace(/\{ ZoomIn, ZoomOut, Crop, Check, Image, Copy, Crop as CropIcon, FileCode, Move, Maximize, Scan, Undo2, Redo2, Download, Upload \}/, '{ ZoomIn, ZoomOut, Crop, Check, Image, Copy, Crop as CropIcon, FileCode, Move, Maximize, Scan, Undo2, Redo2, Download, Upload, Trash2, RotateCcw }');

// Add props to interface
const propsRegex = /onImportData\?: \(file: File\) => void;\n\}/;
code = code.replace(propsRegex, `onImportData?: (file: File) => void;\n  onClearAll?: () => void;\n  onDefaultSettings?: () => void;\n}`);

// Add to destructuring
const destructureRegex = /onExportData, onImportData\n\}\) => \{/;
code = code.replace(destructureRegex, `onExportData, onImportData, onClearAll, onDefaultSettings\n}) => {`);

// Add to render
const renderRegex = /\{\(onUndo \|\| onRedo \|\| onExportData \|\| onImportData\) && \(\n\s*<div className="flex items-center bg-gray-100 rounded-md p-1 mr-1 gap-1">/;
code = code.replace(renderRegex, `{(onUndo || onRedo || onExportData || onImportData || onClearAll || onDefaultSettings) && (
        <div className="flex items-center bg-gray-100 rounded-md p-1 mr-1 gap-1">
          {onClearAll && (
            <button onClick={onClearAll} className="p-1.5 rounded transition-all hover:bg-red-50 hover:text-red-600 text-gray-700 hover:shadow-sm" title="Clear All Canvas Objects">
              <Trash2 className="w-4 h-4" />
            </button>
          )}
          {onDefaultSettings && (
            <button onClick={onDefaultSettings} className="p-1.5 rounded transition-all hover:bg-white text-gray-700 hover:shadow-sm" title="Restore Default Settings">
              <RotateCcw className="w-4 h-4" />
            </button>
          )}
          {(onClearAll || onDefaultSettings) && <div className="w-px h-4 bg-gray-300 mx-1"></div>}`);

fs.writeFileSync('components/GraphToolbar.tsx', code);
console.log('Toolbar updated');
