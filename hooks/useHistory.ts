import { useState, useCallback, useEffect, useRef } from 'react';

export interface HistoryConfig<T> {
    appId: string;
    version: number;
    currentState: T;
    onRestore: (state: T) => void;
    debounceMs?: number;
}

export function useHistory<T>(config: HistoryConfig<T>) {
    const { appId, version, currentState, onRestore, debounceMs = 500 } = config;
    
    const [history, setHistory] = useState<string[]>([]);
    const [currentIndex, setCurrentIndex] = useState(-1);
    
    const stateRef = useRef(currentState);
    const lastSavedState = useRef<string | null>(null);
    const isRestoring = useRef(false);
    const debounceTimer = useRef<NodeJS.Timeout | null>(null);

    // Initial load from localStorage
    useEffect(() => {
        const saved = localStorage.getItem(`ais_state_${appId}`);
        if (saved) {
            try {
                const parsed = JSON.parse(saved);
                
                // Initialize history with this state first
                const stateStr = JSON.stringify(parsed.data);
                setHistory([stateStr]);
                setCurrentIndex(0);
                lastSavedState.current = stateStr;

                // Then restore it
                isRestoring.current = true;
                onRestore(parsed.data);
                setTimeout(() => { isRestoring.current = false; }, 100);
            } catch (e) {
                console.error("Failed to load state", e);
            }
        }
    }, [appId]);

    const takeSnapshot = useCallback(() => {
        if (isRestoring.current) return;
        
        const currentStateStr = JSON.stringify(stateRef.current);
        
        if (currentStateStr === lastSavedState.current) {
            return; // No change
        }

        setHistory(prev => {
            const newHistory = prev.slice(0, currentIndex + 1);
            newHistory.push(currentStateStr);
            if (newHistory.length > 50) {
                newHistory.shift();
                return newHistory;
            }
            return newHistory;
        });
        
        setCurrentIndex(prev => {
            const newLength = prev + 1;
            return newLength >= 50 ? 49 : newLength;
        });
        
        lastSavedState.current = currentStateStr;
        
        // Auto-save to localStorage
        localStorage.setItem(`ais_state_${appId}`, JSON.stringify({
            app: appId,
            version: version,
            data: JSON.parse(currentStateStr)
        }));
    }, [currentIndex, appId, version]);

    // Automatically detect changes and debounce a snapshot
    useEffect(() => {
        stateRef.current = currentState;
        
        if (isRestoring.current) return;

        if (debounceTimer.current) {
            clearTimeout(debounceTimer.current);
        }

        debounceTimer.current = setTimeout(() => {
            takeSnapshot();
        }, debounceMs);

        return () => {
            if (debounceTimer.current) {
                clearTimeout(debounceTimer.current);
            }
        };
    }, [currentState, takeSnapshot, debounceMs]);

    // Force snapshot for immediate actions
    const forceSnapshot = useCallback(() => {
        if (debounceTimer.current) {
            clearTimeout(debounceTimer.current);
        }
        takeSnapshot();
    }, [takeSnapshot]);

    const undo = useCallback(() => {
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
                localStorage.setItem(`ais_state_${appId}`, JSON.stringify({
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
            
            localStorage.setItem(`ais_state_${appId}`, JSON.stringify({
                app: appId,
                version: version,
                data: stateToRestore
            }));
            
            setTimeout(() => { isRestoring.current = false; }, 100);
        }
    }, [currentIndex, history, appId, version, onRestore]);

    const redo = useCallback(() => {
        if (currentIndex < history.length - 1) {
            isRestoring.current = true;
            if (debounceTimer.current) clearTimeout(debounceTimer.current);

            const newIndex = currentIndex + 1;
            setCurrentIndex(newIndex);
            const stateToRestore = JSON.parse(history[newIndex]);
            lastSavedState.current = history[newIndex];
            onRestore(stateToRestore);
            
            // Sync to local storage
            localStorage.setItem(`ais_state_${appId}`, JSON.stringify({
                app: appId,
                version: version,
                data: stateToRestore
            }));
            
            setTimeout(() => { isRestoring.current = false; }, 100);
        }
    }, [currentIndex, history, appId, version, onRestore]);

    const exportToFile = useCallback((filename: string = `${appId}_export.json`) => {
        // flush any pending
        forceSnapshot();
        
        const exportData = {
            app: appId,
            version: version,
            data: stateRef.current
        };
        const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: "application/json" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }, [appId, version, forceSnapshot]);

    const importFromFile = useCallback((file: File) => {
        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const parsed = JSON.parse(e.target?.result as string);
                if (parsed.app !== appId) {
                    alert(`Invalid file: expected ${appId} export.`);
                    return;
                }
                isRestoring.current = true;
                if (debounceTimer.current) clearTimeout(debounceTimer.current);

                onRestore(parsed.data);
                
                setTimeout(() => {
                    isRestoring.current = false;
                    forceSnapshot();
                }, 100);
            } catch (err) {
                console.error(err);
                alert("Failed to parse import file.");
            }
        };
        reader.readAsText(file);
    }, [appId, onRestore, forceSnapshot]);

    const hasUnsavedChanges = JSON.stringify(currentState) !== lastSavedState.current;
    
    return {
        forceSnapshot,
        undo,
        redo,
        canUndo: currentIndex > 0 || hasUnsavedChanges,
        canRedo: currentIndex < history.length - 1 && history.length > 0,
        exportToFile,
        importFromFile
    };
}
