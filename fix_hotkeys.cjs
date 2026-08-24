const fs = require('fs');
let code = fs.readFileSync('pages/NetworkGrapher.tsx', 'utf8');

const regex = /    useEffect\(\(\) => \{\n        const handleKeyDown = \(e: KeyboardEvent\) => \{\n            if \(e\.key === 'Backspace' \|\| e\.key === 'Delete'\) \{\n                forceSnapshot\(\);\n                if \(document\.activeElement\?\.tagName === 'INPUT' \|\| document\.activeElement\?\.tagName === 'TEXTAREA' \|\| document\.activeElement\?\.tagName === 'SELECT'\) return;\n                \n                setEdges\(prev => prev\.filter\(edge => !selectedEdges\.includes\(edge\.id\) && !selectedNodes\.includes\(edge\.from\) && !selectedNodes\.includes\(edge\.to\)\)\);\n                setNodes\(prev => prev\.filter\(node => !selectedNodes\.includes\(node\.id\)\)\);\n                setCuts\(prev => prev\.filter\(cut => !selectedCuts\.includes\(cut\.id\)\)\);\n                setSelectedNodes\(\[\]\);\n                setSelectedEdges\(\[\]\);\n                setSelectedCuts\(\[\]\);\n            \}\n        \};\n        window\.addEventListener\('keydown', handleKeyDown\);\n        return \(\) => window\.removeEventListener\('keydown', handleKeyDown\);\n    \}, \[\w+, \w+\]\);/;

const replacement = `    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
            const cmdOrCtrl = isMac ? e.metaKey : e.ctrlKey;
            
            if (cmdOrCtrl && !e.shiftKey && e.key.toLowerCase() === 'z') {
                e.preventDefault();
                undo();
                return;
            } else if (cmdOrCtrl && (e.key.toLowerCase() === 'y' || (e.shiftKey && e.key.toLowerCase() === 'z'))) {
                e.preventDefault();
                redo();
                return;
            } else if (e.key === 'Backspace' || e.key === 'Delete') {
                if (document.activeElement?.tagName === 'INPUT' || document.activeElement?.tagName === 'TEXTAREA' || document.activeElement?.tagName === 'SELECT') return;
                
                forceSnapshot();
                setEdges(prev => prev.filter(edge => !selectedEdges.includes(edge.id) && !selectedNodes.includes(edge.from) && !selectedNodes.includes(edge.to)));
                setNodes(prev => prev.filter(node => !selectedNodes.includes(node.id)));
                setCuts(prev => prev.filter(cut => !selectedCuts.includes(cut.id)));
                setSelectedNodes([]);
                setSelectedEdges([]);
                setSelectedCuts([]);
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [selectedNodes, selectedEdges, selectedCuts, undo, redo, forceSnapshot]);`;

if (regex.test(code)) {
    code = code.replace(regex, replacement);
    fs.writeFileSync('pages/NetworkGrapher.tsx', code);
    console.log('Successfully applied hotkeys');
} else {
    console.log('Failed to find hotkey logic');
}
