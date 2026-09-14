const fs = require('fs');
let code = fs.readFileSync('components/GraphToolbar.tsx', 'utf8');

// Add to imports if necessary
code = code.replace(/import \{([^}]+)\} from "lucide-react";/, (match, group1) => {
    if (!group1.includes('Expand')) {
        return `import {${group1}, Expand } from "lucide-react";`;
    }
    return match;
});

// Add to Props
const propsRegex = /onResetView\?: \(\) => void;\n  onAutoCrop\?: \(\) => void;/;
code = code.replace(propsRegex, "onResetView?: () => void;\n  onZoomOutCanvas?: () => void;\n  onAutoCrop?: () => void;");

// Add to destructuring
const destructureRegex = /onResetView, onAutoCrop,/;
code = code.replace(destructureRegex, "onResetView, onZoomOutCanvas, onAutoCrop,");

// Add to render
const cropToolsRender = `{showCropControls && (
        <div className="flex items-center gap-1 bg-gray-100 p-1 rounded-md mr-1">
          {onZoomOutCanvas && (
              <button 
                onClick={onZoomOutCanvas}
                className="p-1.5 hover:bg-white hover:text-blue-600 rounded text-gray-500"
                title="Expand Canvas Area (Zoom Out ViewBox)"
              >
                <Expand className="w-4 h-4" />
              </button>
          )}
          <button 
            onClick={onResetView}`;
            
code = code.replace(/\{showCropControls && \(\n        <div className="flex items-center gap-1 bg-gray-100 p-1 rounded-md mr-1">\n          <button \n            onClick=\{onResetView\}/, cropToolsRender);

fs.writeFileSync('components/GraphToolbar.tsx', code);
console.log('Patched GraphToolbar.tsx');
