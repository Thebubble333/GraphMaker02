import { useState, useEffect, useCallback } from 'react';
import {
    UISettings,
    UI_DEFAULTS,
    UI_SETTINGS_EVENT,
    getUISettings,
    saveUISettings,
    resetUISettings,
    applyUISettingsToDocument
} from '../constants';

export const useUISettings = () => {
    const [settings, setSettings] = useState<UISettings>(() => getUISettings());

    useEffect(() => {
        applyUISettingsToDocument(getUISettings());
        const handleUpdate = (e: Event) => {
            const custom = e as CustomEvent<UISettings>;
            setSettings(custom.detail || getUISettings());
        };
        window.addEventListener(UI_SETTINGS_EVENT, handleUpdate);
        return () => window.removeEventListener(UI_SETTINGS_EVENT, handleUpdate);
    }, []);

    const updateSetting = useCallback(<K extends keyof UISettings>(key: K, value: UISettings[K]) => {
        const next = saveUISettings({ [key]: value });
        setSettings(next);
    }, []);

    const updateSettings = useCallback((partial: Partial<UISettings>) => {
        const next = saveUISettings(partial);
        setSettings(next);
    }, []);

    const resetToDefaults = useCallback(() => {
        const next = resetUISettings();
        setSettings(next);
    }, []);

    return {
        settings,
        defaults: UI_DEFAULTS,
        updateSetting,
        updateSettings,
        resetToDefaults
    };
};
