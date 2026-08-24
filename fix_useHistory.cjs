const fs = require('fs');
let code = fs.readFileSync('hooks/useHistory.ts', 'utf8');

const replacement = `    const undo = useCallback(() => {
        // If there are unsaved changes, snapshot them first before undoing
        const currentStateStr = JSON.stringify(stateRef.current);
        let activeIndex = currentIndex;
        let activeHistory = history;
        if (currentStateStr !== lastSavedState.current) {
            if (!isRestoring.current) {
                // Inline takeSnapshot logic to avoid stale closures
                activeHistory = activeHistory.slice(0, activeIndex + 1);
                activeHistory.push(currentStateStr);
                if (activeHistory.length > 50) {
                    activeHistory.shift();
                }
                activeIndex = activeHistory.length - 1;
                setHistory(activeHistory);
                setCurrentIndex(activeIndex);
                lastSavedState.current = currentStateStr;
                localStorage.setItem(\`ais_state_\${appId}\`, JSON.stringify({
                    app: appId,
                    version: version,
                    data: JSON.parse(currentStateStr)
                }));
            }
        }

        if (activeIndex > 0) {
            isRestoring.current = true;
            if (debounceTimer.current) clearTimeout(debounceTimer.current);
            
            const newIndex = activeIndex - 1;
            setCurrentIndex(newIndex);
            const stateToRestore = JSON.parse(activeHistory[newIndex]);
            lastSavedState.current = activeHistory[newIndex];
            onRestore(stateToRestore);
            
            localStorage.setItem(\`ais_state_\${appId}\`, JSON.stringify({
                app: appId,
                version: version,
                data: stateToRestore
            }));
            
            setTimeout(() => { isRestoring.current = false; }, 100);
        }
    }, [currentIndex, history, appId, version, onRestore]);`;

// Need to replace the `undo` block properly.
const regex = /    const undo = useCallback\(\(\) => \{[\s\S]*?\}, \[currentIndex, history, appId, version, onRestore\]\);/;
if (regex.test(code)) {
    code = code.replace(regex, replacement);
    
    // Also we need to make sure canUndo is true if there's an unsaved change.
    // We can just add a getter for canUndo in the return block, or export a state.
    // But since it's just a boolean, we can export it based on the current state!
    const returnRegex = /    return \{\s*forceSnapshot,\s*undo,\s*redo,\s*canUndo: currentIndex > 0,\s*canRedo: currentIndex < history\.length - 1 && history\.length > 0,\s*exportToFile,\s*importFromFile\s*\};/;
    const newReturn = `    const hasUnsavedChanges = JSON.stringify(currentState) !== lastSavedState.current;
    
    return {
        forceSnapshot,
        undo,
        redo,
        canUndo: currentIndex > 0 || hasUnsavedChanges,
        canRedo: currentIndex < history.length - 1 && history.length > 0,
        exportToFile,
        importFromFile
    };`;
    code = code.replace(returnRegex, newReturn);
    
    fs.writeFileSync('hooks/useHistory.ts', code);
    console.log('Fixed useHistory.ts');
} else {
    console.log('Could not find undo block in useHistory.ts');
}
