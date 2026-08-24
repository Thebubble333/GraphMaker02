const fs = require('fs');
let code = fs.readFileSync('pages/NetworkGrapher.tsx', 'utf8');

code = code.replace(
    "onDpiChange={setExportDpi}\n                    />",
    "onDpiChange={setExportDpi}\n                        onUndo={undo}\n                        onRedo={redo}\n                        canUndo={canUndo}\n                        canRedo={canRedo}\n                        onExportData={() => exportToFile('network-grapher-project.json')}\n                        onImportData={importFromFile}\n                    />"
);

fs.writeFileSync('pages/NetworkGrapher.tsx', code);
