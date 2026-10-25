
export const LAYOUT_DEFAULTS = {
    MARGIN_TOP: 35.0,
    MARGIN_BOTTOM: 35.0,
    MARGIN_LEFT: 35.0,
    MARGIN_RIGHT: 35.0,
    TICK_SIZE: 7,
    LABEL_PADDING: 5, // Reduced from 15 to 5 to bring text closer
    AXIS_ARROW_SIZE: 4,
    BASE_FONT_SIZE: 11, // Updated to 11 to match GLOBAL_CONFIG
};

export const COLOR_DEFAULTS = {
    PRIMARY: '#2563eb', // blue-600
    GRID: 'black',
    AXIS: 'black',
};

export const CM_TO_PX = 37.79527559;

export interface UISettings {
    /** Padding (px) around the graph canvas inside the grey viewport container */
    VIEWPORT_MARGIN: number;
    /** Total margin deduction (px) subtracted from viewport dimensions when auto-fitting canvas */
    AUTO_FIT_DEDUCTION: number;
    /** Width (px) of the main left navigation sidebar when expanded */
    NAV_SIDEBAR_WIDTH: number;
    /** Width (px) of the tool control sidebar on each grapher page */
    TOOL_SIDEBAR_WIDTH: number;
    /** Vertical padding (px) inside the top page header bar */
    HEADER_PADDING_Y: number;
    /** Font size (px) of the page header title */
    HEADER_TITLE_SIZE: number;
    /** Base font size (px) for sidebar menu labels and controls */
    MENU_FONT_SIZE: number;
    /** Font size (px) for uppercase section headers in sidebars */
    SECTION_HEADER_FONT_SIZE: number;
    /** Font size (px) for inputs, selects, and buttons in sidebars */
    INPUT_FONT_SIZE: number;
    /** Height (px) of action buttons in the top GraphToolbar */
    TOOLBAR_HEIGHT: number;
    /** Whether to show 'Right-click any ... for quick actions' hints */
    SHOW_RIGHT_CLICK_HINTS: boolean;
}

export const UI_DEFAULTS: UISettings = {
    VIEWPORT_MARGIN: 16,
    AUTO_FIT_DEDUCTION: 36,
    NAV_SIDEBAR_WIDTH: 208,
    TOOL_SIDEBAR_WIDTH: 310,
    HEADER_PADDING_Y: 8,
    HEADER_TITLE_SIZE: 16,
    MENU_FONT_SIZE: 12,
    SECTION_HEADER_FONT_SIZE: 11,
    INPUT_FONT_SIZE: 12,
    TOOLBAR_HEIGHT: 30,
    SHOW_RIGHT_CLICK_HINTS: false,
};

const UI_SETTINGS_STORAGE_KEY = 'graphmaker_ui_settings_v1';
export const UI_SETTINGS_EVENT = 'graphmaker-ui-settings-change';

export const getUISettings = (): UISettings => {
    if (typeof window === 'undefined') return { ...UI_DEFAULTS };
    try {
        const raw = window.localStorage.getItem(UI_SETTINGS_STORAGE_KEY);
        if (!raw) return { ...UI_DEFAULTS };
        const parsed = JSON.parse(raw);
        return { ...UI_DEFAULTS, ...parsed };
    } catch {
        return { ...UI_DEFAULTS };
    }
};

export const applyUISettingsToDocument = (settings: UISettings = getUISettings()) => {
    if (typeof document === 'undefined') return;
    const root = document.documentElement;
    root.style.setProperty('--ui-viewport-margin', `${settings.VIEWPORT_MARGIN}px`);
    root.style.setProperty('--ui-auto-fit-deduction', `${settings.AUTO_FIT_DEDUCTION}px`);
    root.style.setProperty('--ui-nav-sidebar-width', `${settings.NAV_SIDEBAR_WIDTH}px`);
    root.style.setProperty('--ui-tool-sidebar-width', `${settings.TOOL_SIDEBAR_WIDTH}px`);
    root.style.setProperty('--ui-header-py', `${settings.HEADER_PADDING_Y}px`);
    root.style.setProperty('--ui-header-title-size', `${settings.HEADER_TITLE_SIZE}px`);
    root.style.setProperty('--ui-menu-font-size', `${settings.MENU_FONT_SIZE}px`);
    root.style.setProperty('--ui-section-font-size', `${settings.SECTION_HEADER_FONT_SIZE}px`);
    root.style.setProperty('--ui-input-font-size', `${settings.INPUT_FONT_SIZE}px`);
    root.style.setProperty('--ui-toolbar-height', `${settings.TOOLBAR_HEIGHT}px`);
    root.style.setProperty('--ui-right-click-display', settings.SHOW_RIGHT_CLICK_HINTS ? 'block' : 'none');
};

export const saveUISettings = (partial: Partial<UISettings>): UISettings => {
    const next = { ...getUISettings(), ...partial };
    if (typeof window !== 'undefined') {
        try {
            window.localStorage.setItem(UI_SETTINGS_STORAGE_KEY, JSON.stringify(next));
        } catch {
            // ignore storage errors
        }
        applyUISettingsToDocument(next);
        window.dispatchEvent(new CustomEvent(UI_SETTINGS_EVENT, { detail: next }));
    }
    return next;
};

export const resetUISettings = (): UISettings => {
    const next = { ...UI_DEFAULTS };
    if (typeof window !== 'undefined') {
        try {
            window.localStorage.removeItem(UI_SETTINGS_STORAGE_KEY);
        } catch {
            // ignore storage errors
        }
        applyUISettingsToDocument(next);
        window.dispatchEvent(new CustomEvent(UI_SETTINGS_EVENT, { detail: next }));
    }
    return next;
};

