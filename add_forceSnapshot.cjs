const fs = require('fs');
let code = fs.readFileSync('pages/NetworkGrapher.tsx', 'utf8');

code = code.replace(/    const \{\s*undo,\s*redo,\s*canUndo,\s*canRedo,\s*exportToFile,\s*importFromFile\s*\} = useHistory\(\{/, 
`    const { 
        forceSnapshot,
        undo, 
        redo, 
        canUndo, 
        canRedo, 
        exportToFile, 
        importFromFile 
    } = useHistory({`);

fs.writeFileSync('pages/NetworkGrapher.tsx', code);
console.log('Added forceSnapshot extraction');
