import { useState, useCallback, useEffect, useRef } from 'react';

export interface HistoryConfig<T> {
    appId: string;
    version: number;
    currentState: T;
    onRestore: (state: T) => void;
    debounceMs?: number;
}

export function useHistory<T>(
    configOrAppId: HistoryConfig<T> | string,
    maybeCurrentState?: T,
    maybeOnRestore?: (state: T) => void
) {
    const isObj = typeof configOrAppId === 'object' && configOrAppId !== null;
    const appId = isObj ? configOrAppId.appId : configOrAppId;
    const version = isObj ? (configOrAppId.version ?? 1) : 1;
    const currentState = isObj ? configOrAppId.currentState : (maybeCurrentState as T);
    const onRestore = isObj ? configOrAppId.onRestore : (maybeOnRestore as (state: T) => void);
    const debounceMs = isObj ? (configOrAppId.debounceMs ?? 500) : 500;
    
    const stateRef = useRef(currentState);
    const initialSerialized = useRef<string>(JSON.stringify(currentState));
    const [history, setHistory] = useState<string[]>(() => [initialSerialized.current]);
    const [currentIndex, setCurrentIndex] = useState(0);
    const lastSavedState = useRef<string | null>(initialSerialized.current);
    const isRestoring = useRef(false);
    const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

    // Initial load from localStorage
    useEffect(() => {
        const saved = localStorage.getItem(`ais_state_${appId}`);
        if (saved) {
            try {
                const parsed = JSON.parse(saved);
                if (parsed && parsed.data !== undefined && (parsed.version === undefined || parsed.version === version)) {
                    const stateStr = JSON.stringify(parsed.data);
                    setHistory([stateStr]);
                    setCurrentIndex(0);
                    lastSavedState.current = stateStr;

                    isRestoring.current = true;
                    onRestore(parsed.data);
                    setTimeout(() => { isRestoring.current = false; }, 100);
                    return;
                }
            } catch (e) {
                console.error("Failed to load state", e);
            }
        }
        // If no valid saved state exists in localStorage, record initial state as index 0
        const initStr = JSON.stringify(stateRef.current);
        setHistory([initStr]);
        setCurrentIndex(0);
        lastSavedState.current = initStr;
    }, [appId, version]);

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
        try {
            localStorage.setItem(`ais_state_${appId}`, JSON.stringify({
                app: appId,
                version: version,
                data: JSON.parse(currentStateStr)
            }));
        } catch (e) {
            console.warn("Could not save state to localStorage", e);
        }
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
                activeHistory = activeHistory.slice(0, activeIndex + 1);
                activeHistory.push(currentStateStr);
                if (activeHistory.length > 50) {
                    activeHistory.shift();
                }
                activeIndex = activeHistory.length - 1;
                setHistory(activeHistory);
                setCurrentIndex(activeIndex);
                lastSavedState.current = currentStateStr;
                try {
                    localStorage.setItem(`ais_state_${appId}`, JSON.stringify({
                        app: appId,
                        version: version,
                        data: JSON.parse(currentStateStr)
                    }));
                } catch {}
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
            
            try {
                localStorage.setItem(`ais_state_${appId}`, JSON.stringify({
                    app: appId,
                    version: version,
                    data: stateToRestore
                }));
            } catch {}
            
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
            
            try {
                localStorage.setItem(`ais_state_${appId}`, JSON.stringify({
                    app: appId,
                    version: version,
                    data: stateToRestore
                }));
            } catch {}
            
            setTimeout(() => { isRestoring.current = false; }, 100);
        }
    }, [currentIndex, history, appId, version, onRestore]);

    // Global keyboard shortcuts (Ctrl+Z / Cmd+Z for Undo, Ctrl+Y / Cmd+Shift+Z for Redo)
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            const target = e.target as HTMLElement | null;
            if (target) {
                const tag = target.tagName;
                if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || target.isContentEditable) {
                    return;
                }
            }
            const isMod = e.ctrlKey || e.metaKey;
            if (!isMod) return;

            if (e.key.toLowerCase() === 'z' && !e.shiftKey) {
                e.preventDefault();
                undo();
            } else if ((e.key.toLowerCase() === 'z' && e.shiftKey) || (e.key.toLowerCase() === 'y' && !e.shiftKey)) {
                e.preventDefault();
                redo();
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [undo, redo]);

    const exportToFile = useCallback((filename?: string) => {
        forceSnapshot();
        const finalName = typeof filename === 'string' && filename ? filename : `${appId}_export.json`;
        
        const exportData = {
            app: appId,
            version: version,
            data: stateRef.current
        };
        const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: "application/json" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = finalName;
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
                if (!parsed || (parsed.app && parsed.app !== appId)) {
                    console.warn(`Invalid file: expected ${appId} export.`);
                    return;
                }
                const payload = parsed.data !== undefined ? parsed.data : parsed;
                isRestoring.current = true;
                if (debounceTimer.current) clearTimeout(debounceTimer.current);

                onRestore(payload);
                
                setTimeout(() => {
                    isRestoring.current = false;
                    forceSnapshot();
                }, 100);
            } catch (err) {
                console.error("Failed to parse import file.", err);
            }
        };
        reader.readAsText(file);
    }, [appId, onRestore, forceSnapshot]);

    const resetToDefaultSettings = useCallback(() => {
        try {
            localStorage.removeItem(`ais_state_${appId}`);
        } catch {}
        setTimeout(() => {
            forceSnapshot();
        }, 50);
    }, [appId, forceSnapshot]);

    const hasUnsavedChanges = lastSavedState.current !== null && JSON.stringify(currentState) !== lastSavedState.current;
    
    return {
        forceSnapshot,
        recordNow: forceSnapshot,
        undo,
        redo,
        canUndo: currentIndex > 0 || hasUnsavedChanges,
        canRedo: currentIndex < history.length - 1 && history.length > 0,
        exportToFile,
        importFromFile,
        exportState: () => exportToFile(),
        importState: importFromFile,
        resetToDefaultSettings
    };
}
