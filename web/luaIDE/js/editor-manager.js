// ═══════════════════════════════════════════════════════════
// Lua IDE - Editor Manager
// Handles Monaco editor initialization and tab management
// ═══════════════════════════════════════════════════════════

import { storage } from './storage.js';
import {
    toggleSidePanel,
    toggleApiDocs,
    toggleConsole
} from './resize-manager.js';
import { LUA_STDLIB_AUTOCOMPLETE } from './lua-stdlib-autocomplete.js';
import { showConfirmation, showError } from './notification-manager.js';
import { getAutoSaveDelay, isAutoSaveEnabled } from './settings-manager.js';

// ═══════════════════════════════════════════════════════════
// EDITOR STATE
// ═══════════════════════════════════════════════════════════

const EditorState = {
    monacoEditor: null,           // Monaco editor instance
    openTabs: [],                 // Array of {projectId, fileId, file}
    activeTabIndex: -1,           // Currently active tab index
    editorModels: new Map(),      // Map of fileId -> Monaco model
    unsavedChanges: new Set(),    // Set of fileIds with unsaved changes
    autoSaveTimeout: null,
    isInitialized: false
};

// ═══════════════════════════════════════════════════════════
// MONACO EDITOR INITIALIZATION
// ═══════════════════════════════════════════════════════════

export async function initializeEditor() {
    console.log('Initializing Monaco Editor...');

    return new Promise((resolve, reject) => {
        // Configure Monaco loader
        require.config({
            paths: {
                'vs': 'https://cdn.jsdelivr.net/npm/monaco-editor@0.44.0/min/vs'
            }
        });

        // Load Monaco
        require(['vs/editor/editor.main'], function() {
            try {
                // Clear the editor container (remove placeholder)
                const editorContainer = document.getElementById('editor');
                editorContainer.innerHTML = '';

                // Create editor instance
                EditorState.monacoEditor = monaco.editor.create(editorContainer, {
                    value: '',
                    language: 'lua',
                    theme: 'vs-dark',
                    automaticLayout: true,
                    fontSize: 14,
                    minimap: { enabled: true },
                    lineNumbers: 'on',
                    roundedSelection: false,
                    scrollBeyondLastLine: false,
                    readOnly: false,
                    wordWrap: 'off',
                    tabSize: 4,
                    insertSpaces: true
                });

                // Listen for content changes
                EditorState.monacoEditor.onDidChangeModelContent(() => {
                    handleEditorChange();
                });

                EditorState.isInitialized = true;
                console.log('✓ Monaco Editor initialized');
                resolve();
            } catch (error) {
                console.error('Failed to initialize Monaco:', error);
                reject(error);
            }
        });
    });
}

// ═══════════════════════════════════════════════════════════
// TAB MANAGEMENT
// ═══════════════════════════════════════════════════════════

export function openFileInEditor(projectId, fileId) {
    const file = storage.projects.getFile(projectId, fileId);
    if (!file) {
        console.error('File not found:', fileId);
        return;
    }

    // Check if tab already open
    const existingTabIndex = EditorState.openTabs.findIndex(
        tab => tab.projectId === projectId && tab.fileId === fileId
    );

    if (existingTabIndex !== -1) {
        // Tab already open, just switch to it
        switchToTab(existingTabIndex);
        return;
    }

    // Add new tab
    EditorState.openTabs.push({
        projectId,
        fileId,
        file
    });

    // Switch to the new tab
    switchToTab(EditorState.openTabs.length - 1);

    // Update UI
    renderTabs();
}

export async function closeTab(tabIndex) {
    if (tabIndex < 0 || tabIndex >= EditorState.openTabs.length) {
        return;
    }

    const tab = EditorState.openTabs[tabIndex];

    // Check for unsaved changes
    if (EditorState.unsavedChanges.has(tab.fileId)) {
        const confirmed = await showConfirmation({
            title: 'Unsaved Changes',
            message: `File "${tab.file.name}" has unsaved changes. Close anyway?`,
            confirmText: 'Close',
            cancelText: 'Cancel',
            type: 'warning'
        });
        if (!confirmed) {
            return;
        }
    }

    // Dispose model if exists
    if (EditorState.editorModels.has(tab.fileId)) {
        EditorState.editorModels.get(tab.fileId).dispose();
        EditorState.editorModels.delete(tab.fileId);
    }

    // Remove from unsaved changes
    EditorState.unsavedChanges.delete(tab.fileId);

    // Remove tab
    EditorState.openTabs.splice(tabIndex, 1);

    // Adjust active tab index
    if (EditorState.openTabs.length === 0) {
        // No tabs left
        EditorState.activeTabIndex = -1;
        if (EditorState.monacoEditor) {
            EditorState.monacoEditor.setValue('');
        }
    } else if (tabIndex <= EditorState.activeTabIndex) {
        // Closed tab was before or at active tab
        if (EditorState.activeTabIndex >= EditorState.openTabs.length) {
            EditorState.activeTabIndex = EditorState.openTabs.length - 1;
        }
        switchToTab(EditorState.activeTabIndex);
    }

    // Update UI
    renderTabs();
}

export function switchToTab(tabIndex) {
    if (tabIndex < 0 || tabIndex >= EditorState.openTabs.length) {
        return;
    }

    EditorState.activeTabIndex = tabIndex;
    const tab = EditorState.openTabs[tabIndex];

    // Get or create model for this file
    let model = EditorState.editorModels.get(tab.fileId);

    if (!model) {
        // Create new model
        const uri = monaco.Uri.file(`/${tab.projectId}/${tab.file.name}`);
        model = monaco.editor.createModel(tab.file.content, 'lua', uri);
        EditorState.editorModels.set(tab.fileId, model);
    }

    // Set model in editor
    if (EditorState.monacoEditor) {
        EditorState.monacoEditor.setModel(model);
        EditorState.monacoEditor.focus();
    }

    // Update status bar
    updateStatusBar(tab.file.name);

    // Update tabs UI
    renderTabs();
}

// ═══════════════════════════════════════════════════════════
// CONTENT MANAGEMENT
// ═══════════════════════════════════════════════════════════

function handleEditorChange() {
    if (EditorState.activeTabIndex === -1) return;

    const tab = EditorState.openTabs[EditorState.activeTabIndex];
    if (!tab) return;

    // Mark as unsaved
    EditorState.unsavedChanges.add(tab.fileId);

    // Update tab UI to show unsaved indicator
    renderTabs();

    // Schedule auto-save
    scheduleAutoSave();
}

function scheduleAutoSave() {
    // Check if auto-save is enabled
    if (!isAutoSaveEnabled()) {
        return;
    }

    // Clear existing timeout
    if (EditorState.autoSaveTimeout) {
        clearTimeout(EditorState.autoSaveTimeout);
    }

    // Get delay from settings
    const delay = getAutoSaveDelay();

    // Schedule new save with configured delay
    EditorState.autoSaveTimeout = setTimeout(() => {
        saveCurrentFile();
    }, delay);
}

export function saveCurrentFile() {
    if (EditorState.activeTabIndex === -1) return;

    const tab = EditorState.openTabs[EditorState.activeTabIndex];
    if (!tab) return;

    const model = EditorState.editorModels.get(tab.fileId);
    if (!model) return;

    const content = model.getValue();

    try {
        // Save to storage
        storage.projects.updateFile(tab.projectId, tab.fileId, content);

        // Update tab reference
        tab.file.content = content;

        // Clear unsaved flag
        EditorState.unsavedChanges.delete(tab.fileId);

        // Update UI
        renderTabs();

        console.log('✓ File saved:', tab.file.name);
    } catch (error) {
        console.error('Failed to save file:', error);
        showError('Failed to save file: ' + error.message);
    }
}

export function saveAllFiles() {
    const previousActiveTab = EditorState.activeTabIndex;

    EditorState.openTabs.forEach((tab, index) => {
        if (EditorState.unsavedChanges.has(tab.fileId)) {
            EditorState.activeTabIndex = index;
            saveCurrentFile();
        }
    });

    EditorState.activeTabIndex = previousActiveTab;
}

export function closeAllTabs() {
    // Dispose all models
    EditorState.editorModels.forEach(model => {
        model.dispose();
    });

    // Clear all state
    EditorState.editorModels.clear();
    EditorState.unsavedChanges.clear();
    EditorState.openTabs = [];
    EditorState.activeTabIndex = -1;

    // Clear editor content
    if (EditorState.monacoEditor) {
        EditorState.monacoEditor.setValue('');
    }

    // Update UI
    renderTabs();

    console.log('✓ All tabs closed');
}

// ═══════════════════════════════════════════════════════════
// UI RENDERING
// ═══════════════════════════════════════════════════════════

function renderTabs() {
    const tabsList = document.getElementById('tabs-list');
    if (!tabsList) return;

    if (EditorState.openTabs.length === 0) {
        tabsList.innerHTML = '<div class="no-tabs">No files open</div>';
        return;
    }

    let html = '';

    EditorState.openTabs.forEach((tab, index) => {
        const isActive = index === EditorState.activeTabIndex;
        const hasUnsaved = EditorState.unsavedChanges.has(tab.fileId);

        html += `
            <div class="tab ${isActive ? 'active' : ''}" data-tab-index="${index}">
                <span class="tab-name">${escapeHtml(tab.file.name)}${hasUnsaved ? ' •' : ''}</span>
                <button class="tab-close" data-tab-index="${index}">×</button>
            </div>
        `;
    });

    tabsList.innerHTML = html;

    // Attach event listeners
    attachTabEventListeners();
}

function attachTabEventListeners() {
    // Tab click handlers
    document.querySelectorAll('.tab').forEach(tabElement => {
        const tabName = tabElement.querySelector('.tab-name');
        if (tabName) {
            tabName.addEventListener('click', (e) => {
                const index = parseInt(tabElement.getAttribute('data-tab-index'));
                switchToTab(index);
            });
        }
    });

    // Tab close button handlers
    document.querySelectorAll('.tab-close').forEach(button => {
        button.addEventListener('click', (e) => {
            e.stopPropagation();
            const index = parseInt(button.getAttribute('data-tab-index'));
            closeTab(index);
        });
    });
}

function updateStatusBar(fileName) {
    const activeFileElement = document.getElementById('active-file');
    if (activeFileElement) {
        activeFileElement.textContent = fileName || '';
    }

    // Update cursor position
    if (EditorState.monacoEditor) {
        const position = EditorState.monacoEditor.getPosition();
        const cursorElement = document.getElementById('cursor-position');
        if (cursorElement && position) {
            cursorElement.textContent = `Ln ${position.lineNumber}, Col ${position.column}`;
        }

        // Listen for position changes
        EditorState.monacoEditor.onDidChangeCursorPosition((e) => {
            const cursorElement = document.getElementById('cursor-position');
            if (cursorElement) {
                cursorElement.textContent = `Ln ${e.position.lineNumber}, Col ${e.position.column}`;
            }
        });
    }
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// ═══════════════════════════════════════════════════════════
// KEYBOARD SHORTCUTS
// ═══════════════════════════════════════════════════════════

export function setupKeyboardShortcuts() {
    document.addEventListener('keydown', (e) => {
        // Ctrl+S: Save current file
        if (e.ctrlKey && e.key === 's') {
            e.preventDefault();
            saveCurrentFile();
        }

        // Ctrl+Shift+S: Save all files
        if (e.ctrlKey && e.shiftKey && e.key === 'S') {
            e.preventDefault();
            saveAllFiles();
        }

        // Ctrl+W: Close current tab
        if (e.ctrlKey && e.key === 'w') {
            e.preventDefault();
            if (EditorState.activeTabIndex !== -1) {
                closeTab(EditorState.activeTabIndex);
            }
        }

        // Ctrl+Tab: Next tab
        if (e.ctrlKey && e.key === 'Tab' && !e.shiftKey) {
            e.preventDefault();
            if (EditorState.openTabs.length > 0) {
                const nextIndex = (EditorState.activeTabIndex + 1) % EditorState.openTabs.length;
                switchToTab(nextIndex);
            }
        }

        // Ctrl+Shift+Tab: Previous tab
        if (e.ctrlKey && e.shiftKey && e.key === 'Tab') {
            e.preventDefault();
            if (EditorState.openTabs.length > 0) {
                const prevIndex = EditorState.activeTabIndex === 0
                    ? EditorState.openTabs.length - 1
                    : EditorState.activeTabIndex - 1;
                switchToTab(prevIndex);
            }
        }

        // Ctrl+Enter: Execute current file
        if (e.ctrlKey && e.key === 'Enter') {
            e.preventDefault();
            const btnExecute = document.getElementById('btn-execute');
            if (btnExecute && !btnExecute.disabled) {
                btnExecute.click();
            }
        }

        // Ctrl+B: Toggle sidebar
        if (e.ctrlKey && e.key === 'b') {
            e.preventDefault();
            toggleSidePanel();
        }

        // Ctrl+\: Toggle API docs
        if (e.ctrlKey && e.key === '\\') {
            e.preventDefault();
            toggleApiDocs();
        }

        // Ctrl+J: Toggle console
        if (e.ctrlKey && e.key === 'j') {
            e.preventDefault();
            toggleConsole();
        }
    });

    console.log('✓ Keyboard shortcuts enabled');
}

// ═══════════════════════════════════════════════════════════
// AUTOCOMPLETE INTEGRATION
// ═══════════════════════════════════════════════════════════

export function updateAutocomplete(productId) {
    // Always include Lua standard library autocomplete
    const stdlibSuggestions = LUA_STDLIB_AUTOCOMPLETE.map(item => ({
        label: item.label,
        kind: getMonacoKind(item.kind),
        insertText: item.insertText,
        insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
        documentation: item.documentation,
        detail: item.detail
    }));

    // Add product-specific autocomplete if product is selected
    let productSuggestions = [];
    if (productId) {
        const product = storage.products.getById(productId);
        if (product && product.autocomplete) {
            productSuggestions = product.autocomplete.map(item => ({
                label: item.label,
                kind: getMonacoKind(item.kind),
                insertText: item.insertText,
                insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
                documentation: item.documentation,
                detail: item.detail
            }));
            console.log(`✓ Autocomplete updated: ${stdlibSuggestions.length} stdlib + ${productSuggestions.length} product (${product.name})`);
        }
    } else {
        console.log(`✓ Autocomplete updated: ${stdlibSuggestions.length} stdlib functions`);
    }

    // Combine stdlib (always) + product-specific (if any)
    const allSuggestions = [...stdlibSuggestions, ...productSuggestions];

    // Register Lua completion provider with combined autocomplete
    monaco.languages.registerCompletionItemProvider('lua', {
        provideCompletionItems: (model, position) => {
            return { suggestions: allSuggestions };
        }
    });
}

function getMonacoKind(kind) {
    const kinds = {
        'Function': monaco.languages.CompletionItemKind.Function,
        'Constant': monaco.languages.CompletionItemKind.Constant,
        'Variable': monaco.languages.CompletionItemKind.Variable,
        'Keyword': monaco.languages.CompletionItemKind.Keyword,
        'Snippet': monaco.languages.CompletionItemKind.Snippet
    };
    return kinds[kind] || monaco.languages.CompletionItemKind.Text;
}

// ═══════════════════════════════════════════════════════════
// PUBLIC API
// ═══════════════════════════════════════════════════════════

export {
    EditorState,
    renderTabs
};
