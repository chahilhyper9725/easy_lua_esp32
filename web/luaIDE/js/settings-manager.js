// ═══════════════════════════════════════════════════════════
// Lua IDE - Settings Manager
// Handles IDE settings and preferences
// ═══════════════════════════════════════════════════════════

import { storage } from './storage.js';
import { showSuccess, showInfo } from './notification-manager.js';

// ═══════════════════════════════════════════════════════════
// DEFAULT SETTINGS
// ═══════════════════════════════════════════════════════════

export const DEFAULT_SETTINGS = {
    // Editor settings
    editor: {
        fontSize: 14,
        tabSize: 4,
        wordWrap: 'off',
        minimap: true,
        lineNumbers: true,
        theme: 'vs-dark'
    },

    // Auto-save settings
    autoSave: {
        enabled: true,
        delay: 500
    },

    // Console settings
    console: {
        showTimestamps: true,
        bleAutoClear: true
    },

    // UI preferences
    ui: {
        theme: 'dark'
    }
};

// ═══════════════════════════════════════════════════════════
// SETTINGS MANAGEMENT
// ═══════════════════════════════════════════════════════════

let settingsModal = null;
let editorInstance = null;

export function initializeSettingsModal(editor) {
    editorInstance = editor;
    settingsModal = document.getElementById('modal-settings');

    // Load current settings into both modal and sidebar
    loadSettingsIntoForm();

    // Attach event listeners for both modal and sidebar
    attachSettingsEventListeners();
    attachSidebarSettingsListeners();

    console.log('✓ Settings initialized (modal + sidebar)');
}

export function openSettingsModal() {
    if (!settingsModal) return;

    // Refresh form with current settings
    loadSettingsIntoForm();

    // Open modal
    settingsModal.showModal();
}

export function closeSettingsModal() {
    if (!settingsModal) return;
    settingsModal.close();
}

// ═══════════════════════════════════════════════════════════
// LOAD SETTINGS INTO FORM
// ═══════════════════════════════════════════════════════════

function loadSettingsIntoForm() {
    const settings = storage.settings.get();

    // Load into MODAL
    const modalFontSize = document.getElementById('setting-font-size');
    if (modalFontSize) modalFontSize.value = settings.editor?.fontSize || DEFAULT_SETTINGS.editor.fontSize;

    const modalTabSize = document.getElementById('setting-tab-size');
    if (modalTabSize) modalTabSize.value = settings.editor?.tabSize || DEFAULT_SETTINGS.editor.tabSize;

    const modalWordWrap = document.getElementById('setting-word-wrap');
    if (modalWordWrap) modalWordWrap.checked = (settings.editor?.wordWrap === 'on');

    const modalMinimap = document.getElementById('setting-minimap');
    if (modalMinimap) modalMinimap.checked = settings.editor?.minimap ?? DEFAULT_SETTINGS.editor.minimap;

    const modalLineNumbers = document.getElementById('setting-line-numbers');
    if (modalLineNumbers) modalLineNumbers.checked = settings.editor?.lineNumbers ?? DEFAULT_SETTINGS.editor.lineNumbers;

    const modalTheme = document.getElementById('setting-theme');
    if (modalTheme) modalTheme.value = settings.editor?.theme || DEFAULT_SETTINGS.editor.theme;

    const modalAutoSave = document.getElementById('setting-auto-save');
    if (modalAutoSave) modalAutoSave.checked = settings.autoSave?.enabled ?? DEFAULT_SETTINGS.autoSave.enabled;

    const modalAutoSaveDelay = document.getElementById('setting-auto-save-delay');
    if (modalAutoSaveDelay) modalAutoSaveDelay.value = settings.autoSave?.delay || DEFAULT_SETTINGS.autoSave.delay;

    const modalTimestamps = document.getElementById('setting-console-timestamps');
    if (modalTimestamps) modalTimestamps.checked = settings.console?.showTimestamps ?? DEFAULT_SETTINGS.console.showTimestamps;

    const modalBleAutoclear = document.getElementById('setting-ble-autoclear');
    if (modalBleAutoclear) modalBleAutoclear.checked = settings.console?.bleAutoClear ?? DEFAULT_SETTINGS.console.bleAutoClear;

    // Load into SIDEBAR
    const sidebarFontSize = document.getElementById('sidebar-setting-font-size');
    if (sidebarFontSize) sidebarFontSize.value = settings.editor?.fontSize || DEFAULT_SETTINGS.editor.fontSize;

    const sidebarTabSize = document.getElementById('sidebar-setting-tab-size');
    if (sidebarTabSize) sidebarTabSize.value = settings.editor?.tabSize || DEFAULT_SETTINGS.editor.tabSize;

    const sidebarWordWrap = document.getElementById('sidebar-setting-word-wrap');
    if (sidebarWordWrap) sidebarWordWrap.checked = (settings.editor?.wordWrap === 'on');

    const sidebarMinimap = document.getElementById('sidebar-setting-minimap');
    if (sidebarMinimap) sidebarMinimap.checked = settings.editor?.minimap ?? DEFAULT_SETTINGS.editor.minimap;

    const sidebarLineNumbers = document.getElementById('sidebar-setting-line-numbers');
    if (sidebarLineNumbers) sidebarLineNumbers.checked = settings.editor?.lineNumbers ?? DEFAULT_SETTINGS.editor.lineNumbers;

    const sidebarTheme = document.getElementById('sidebar-setting-theme');
    if (sidebarTheme) sidebarTheme.value = settings.editor?.theme || DEFAULT_SETTINGS.editor.theme;

    const sidebarAutoSave = document.getElementById('sidebar-setting-auto-save');
    if (sidebarAutoSave) sidebarAutoSave.checked = settings.autoSave?.enabled ?? DEFAULT_SETTINGS.autoSave.enabled;

    const sidebarAutoSaveDelay = document.getElementById('sidebar-setting-auto-save-delay');
    if (sidebarAutoSaveDelay) sidebarAutoSaveDelay.value = settings.autoSave?.delay || DEFAULT_SETTINGS.autoSave.delay;

    const sidebarTimestamps = document.getElementById('sidebar-setting-console-timestamps');
    if (sidebarTimestamps) sidebarTimestamps.checked = settings.console?.showTimestamps ?? DEFAULT_SETTINGS.console.showTimestamps;

    const sidebarBleAutoclear = document.getElementById('sidebar-setting-ble-autoclear');
    if (sidebarBleAutoclear) sidebarBleAutoclear.checked = settings.console?.bleAutoClear ?? DEFAULT_SETTINGS.console.bleAutoClear;
}

// ═══════════════════════════════════════════════════════════
// SAVE SETTINGS FROM FORM
// ═══════════════════════════════════════════════════════════

function saveSettingsFromForm() {
    const newSettings = {
        editor: {
            fontSize: parseInt(document.getElementById('setting-font-size').value),
            tabSize: parseInt(document.getElementById('setting-tab-size').value),
            wordWrap: document.getElementById('setting-word-wrap').checked ? 'on' : 'off',
            minimap: document.getElementById('setting-minimap').checked,
            lineNumbers: document.getElementById('setting-line-numbers').checked,
            theme: document.getElementById('setting-theme').value
        },
        autoSave: {
            enabled: document.getElementById('setting-auto-save').checked,
            delay: parseInt(document.getElementById('setting-auto-save-delay').value)
        },
        console: {
            showTimestamps: document.getElementById('setting-console-timestamps').checked,
            bleAutoClear: document.getElementById('setting-ble-autoclear').checked
        },
        ui: {
            theme: 'dark'
        }
    };

    // Save to storage
    storage.settings.update(newSettings);

    // Apply settings immediately
    applySettings(newSettings);

    showSuccess('Settings saved successfully!');
    console.log('✓ Settings saved:', newSettings);
}

// ═══════════════════════════════════════════════════════════
// APPLY SETTINGS TO EDITOR
// ═══════════════════════════════════════════════════════════

export function applySettings(settings) {
    if (!editorInstance) {
        console.warn('Editor instance not set, cannot apply settings');
        return;
    }

    // Apply editor settings
    editorInstance.updateOptions({
        fontSize: settings.editor.fontSize,
        tabSize: settings.editor.tabSize,
        wordWrap: settings.editor.wordWrap,
        minimap: { enabled: settings.editor.minimap },
        lineNumbers: settings.editor.lineNumbers ? 'on' : 'off'
    });

    // Apply theme
    monaco.editor.setTheme(settings.editor.theme);

    // Sync BLE auto-clear checkbox
    const bleAutoClearCheckbox = document.getElementById('chk-autoclear-ble');
    if (bleAutoClearCheckbox) {
        bleAutoClearCheckbox.checked = settings.console.bleAutoClear;
    }

    console.log('✓ Settings applied to editor');
}

// ═══════════════════════════════════════════════════════════
// RESET TO DEFAULTS
// ═══════════════════════════════════════════════════════════

function resetToDefaults() {
    // Save defaults
    storage.settings.update(DEFAULT_SETTINGS);

    // Reload form
    loadSettingsIntoForm();

    // Apply immediately
    applySettings(DEFAULT_SETTINGS);

    showInfo('Settings reset to defaults');
    console.log('✓ Settings reset to defaults');
}

// ═══════════════════════════════════════════════════════════
// EVENT LISTENERS
// ═══════════════════════════════════════════════════════════

function attachSettingsEventListeners() {
    // Close button
    const closeButtons = settingsModal.querySelectorAll('.modal-close, #btn-settings-close');
    closeButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            saveSettingsFromForm();
            closeSettingsModal();
        });
    });

    // Reset button
    const resetButton = document.getElementById('btn-settings-reset');
    if (resetButton) {
        resetButton.addEventListener('click', (e) => {
            e.preventDefault();
            resetToDefaults();
        });
    }

    // Close on ESC key
    settingsModal.addEventListener('cancel', (e) => {
        // Save settings even when closing with ESC
        saveSettingsFromForm();
    });

    // Real-time preview for some settings
    document.getElementById('setting-font-size')?.addEventListener('change', () => {
        const fontSize = parseInt(document.getElementById('setting-font-size').value);
        if (editorInstance) {
            editorInstance.updateOptions({ fontSize });
        }
    });

    document.getElementById('setting-theme')?.addEventListener('change', () => {
        const theme = document.getElementById('setting-theme').value;
        monaco.editor.setTheme(theme);
    });

    console.log('✓ Settings event listeners attached');
}

// ═══════════════════════════════════════════════════════════
// GET CURRENT SETTINGS
// ═══════════════════════════════════════════════════════════

export function getSettings() {
    const settings = storage.settings.get();

    // Merge with defaults to ensure all properties exist
    return {
        editor: { ...DEFAULT_SETTINGS.editor, ...settings.editor },
        autoSave: { ...DEFAULT_SETTINGS.autoSave, ...settings.autoSave },
        console: { ...DEFAULT_SETTINGS.console, ...settings.console },
        ui: { ...DEFAULT_SETTINGS.ui, ...settings.ui }
    };
}

// ═══════════════════════════════════════════════════════════
// AUTO-SAVE DELAY
// ═══════════════════════════════════════════════════════════

export function getAutoSaveDelay() {
    const settings = getSettings();
    return settings.autoSave.enabled ? settings.autoSave.delay : 0;
}

export function isAutoSaveEnabled() {
    const settings = getSettings();
    return settings.autoSave.enabled;
}

// ═══════════════════════════════════════════════════════════
// SIDEBAR SETTINGS EVENT LISTENERS
// ═══════════════════════════════════════════════════════════

function attachSidebarSettingsListeners() {
    // Auto-save function for sidebar
    function autoSaveSidebarSettings() {
        const newSettings = {
            editor: {
                fontSize: parseInt(document.getElementById('sidebar-setting-font-size')?.value || DEFAULT_SETTINGS.editor.fontSize),
                tabSize: parseInt(document.getElementById('sidebar-setting-tab-size')?.value || DEFAULT_SETTINGS.editor.tabSize),
                wordWrap: document.getElementById('sidebar-setting-word-wrap')?.checked ? 'on' : 'off',
                minimap: document.getElementById('sidebar-setting-minimap')?.checked ?? DEFAULT_SETTINGS.editor.minimap,
                lineNumbers: document.getElementById('sidebar-setting-line-numbers')?.checked ?? DEFAULT_SETTINGS.editor.lineNumbers,
                theme: document.getElementById('sidebar-setting-theme')?.value || DEFAULT_SETTINGS.editor.theme
            },
            autoSave: {
                enabled: document.getElementById('sidebar-setting-auto-save')?.checked ?? DEFAULT_SETTINGS.autoSave.enabled,
                delay: parseInt(document.getElementById('sidebar-setting-auto-save-delay')?.value || DEFAULT_SETTINGS.autoSave.delay)
            },
            console: {
                showTimestamps: document.getElementById('sidebar-setting-console-timestamps')?.checked ?? DEFAULT_SETTINGS.console.showTimestamps,
                bleAutoClear: document.getElementById('sidebar-setting-ble-autoclear')?.checked ?? DEFAULT_SETTINGS.console.bleAutoClear
            },
            ui: {
                theme: 'dark'
            }
        };

        // Save to storage
        storage.settings.update(newSettings);

        // Apply settings immediately
        applySettings(newSettings);

        console.log('✓ Sidebar settings auto-saved');
    }

    // Attach change listeners to all sidebar settings
    document.getElementById('sidebar-setting-font-size')?.addEventListener('change', autoSaveSidebarSettings);
    document.getElementById('sidebar-setting-tab-size')?.addEventListener('change', autoSaveSidebarSettings);
    document.getElementById('sidebar-setting-word-wrap')?.addEventListener('change', autoSaveSidebarSettings);
    document.getElementById('sidebar-setting-minimap')?.addEventListener('change', autoSaveSidebarSettings);
    document.getElementById('sidebar-setting-line-numbers')?.addEventListener('change', autoSaveSidebarSettings);
    document.getElementById('sidebar-setting-theme')?.addEventListener('change', autoSaveSidebarSettings);
    document.getElementById('sidebar-setting-auto-save')?.addEventListener('change', autoSaveSidebarSettings);
    document.getElementById('sidebar-setting-auto-save-delay')?.addEventListener('change', autoSaveSidebarSettings);
    document.getElementById('sidebar-setting-console-timestamps')?.addEventListener('change', autoSaveSidebarSettings);
    document.getElementById('sidebar-setting-ble-autoclear')?.addEventListener('change', autoSaveSidebarSettings);

    // Reset button for sidebar
    document.getElementById('btn-settings-sidebar-reset')?.addEventListener('click', () => {
        resetToDefaults();
    });

    console.log('✓ Sidebar settings listeners attached');
}
