// ═══════════════════════════════════════════════════════════
// Lua IDE - Resize Manager
// Handles resizing of all panels with collapse/expand support
// ═══════════════════════════════════════════════════════════

import { storage } from './storage.js';

// ═══════════════════════════════════════════════════════════
// RESIZE STATE
// ═══════════════════════════════════════════════════════════

const ResizeState = {
    isResizing: false,
    currentHandle: null,
    startX: 0,
    startY: 0,
    startWidth: 0,
    startHeight: 0,

    // Stored sizes (for restore after collapse)
    sidePanelWidth: 250,
    apiDocsWidth: 300,
    consoleHeight: 200,

    // Minimum sizes
    minSidePanelWidth: 200,
    minApiDocsWidth: 250,
    minConsoleHeight: 100,

    // Maximum sizes
    maxSidePanelWidth: 500,
    maxApiDocsWidth: 600,
    maxConsoleHeight: 500
};

// ═══════════════════════════════════════════════════════════
// INITIALIZATION
// ═══════════════════════════════════════════════════════════

export function initializeResize() {
    console.log('Initializing resize manager...');

    // Load saved sizes from settings
    loadSavedSizes();

    // Apply loaded sizes
    applySizes();

    // Setup resize handles
    setupResizeHandles();

    console.log('✓ Resize manager initialized');
}

function loadSavedSizes() {
    const settings = storage.settings.get();

    if (settings.layoutSettings) {
        ResizeState.sidePanelWidth = settings.layoutSettings.sidebarWidth || 250;
        ResizeState.apiDocsWidth = settings.layoutSettings.apiDocsWidth || 300;
        ResizeState.consoleHeight = settings.layoutSettings.consoleHeight || 200;
    }
}

function applySizes() {
    const sidePanel = document.querySelector('.side-panel');
    const apiDocs = document.querySelector('.sidebar-right');
    const consolePanel = document.querySelector('.console-panel');

    if (sidePanel && !sidePanel.classList.contains('collapsed')) {
        sidePanel.style.width = ResizeState.sidePanelWidth + 'px';
    }

    if (apiDocs && !apiDocs.classList.contains('collapsed')) {
        apiDocs.style.width = ResizeState.apiDocsWidth + 'px';
    }

    if (consolePanel && !consolePanel.classList.contains('collapsed')) {
        consolePanel.style.height = ResizeState.consoleHeight + 'px';
    }
}

function saveSizes() {
    const settings = storage.settings.get();

    settings.layoutSettings = {
        sidebarWidth: ResizeState.sidePanelWidth,
        apiDocsWidth: ResizeState.apiDocsWidth,
        consoleHeight: ResizeState.consoleHeight
    };

    storage.settings.set(settings);
}

// ═══════════════════════════════════════════════════════════
// RESIZE HANDLE SETUP
// ═══════════════════════════════════════════════════════════

function setupResizeHandles() {
    // Side panel resize handle
    const sidePanelHandle = document.getElementById('resize-handle-side');
    if (sidePanelHandle) {
        sidePanelHandle.addEventListener('mousedown', (e) => startResize(e, 'side-panel'));
    }

    // API docs resize handle
    const apiDocsHandle = document.getElementById('resize-handle-api');
    if (apiDocsHandle) {
        apiDocsHandle.addEventListener('mousedown', (e) => startResize(e, 'api-docs'));
    }

    // Console resize handle
    const consoleHandle = document.getElementById('resize-handle-console');
    if (consoleHandle) {
        consoleHandle.addEventListener('mousedown', (e) => startResize(e, 'console'));
    }

    // Global mouse move and up
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', stopResize);
}

// ═══════════════════════════════════════════════════════════
// RESIZE LOGIC
// ═══════════════════════════════════════════════════════════

function startResize(e, handleType) {
    e.preventDefault();

    ResizeState.isResizing = true;
    ResizeState.currentHandle = handleType;
    ResizeState.startX = e.clientX;
    ResizeState.startY = e.clientY;

    if (handleType === 'side-panel') {
        const sidePanel = document.querySelector('.side-panel');
        ResizeState.startWidth = sidePanel.offsetWidth;
    } else if (handleType === 'api-docs') {
        const apiDocs = document.querySelector('.sidebar-right');
        ResizeState.startWidth = apiDocs.offsetWidth;
    } else if (handleType === 'console') {
        const consolePanel = document.querySelector('.console-panel');
        ResizeState.startHeight = consolePanel.offsetHeight;
    }

    // Add resizing class to body
    document.body.classList.add('resizing');
}

function handleMouseMove(e) {
    if (!ResizeState.isResizing) return;

    if (ResizeState.currentHandle === 'side-panel') {
        const deltaX = e.clientX - ResizeState.startX;
        let newWidth = ResizeState.startWidth + deltaX;

        // Constrain to min/max
        newWidth = Math.max(ResizeState.minSidePanelWidth, Math.min(newWidth, ResizeState.maxSidePanelWidth));

        const sidePanel = document.querySelector('.side-panel');
        if (sidePanel && !sidePanel.classList.contains('collapsed')) {
            sidePanel.style.width = newWidth + 'px';
            ResizeState.sidePanelWidth = newWidth;
        }
    } else if (ResizeState.currentHandle === 'api-docs') {
        const deltaX = ResizeState.startX - e.clientX; // Reverse direction
        let newWidth = ResizeState.startWidth + deltaX;

        // Constrain to min/max
        newWidth = Math.max(ResizeState.minApiDocsWidth, Math.min(newWidth, ResizeState.maxApiDocsWidth));

        const apiDocs = document.querySelector('.sidebar-right');
        if (apiDocs && !apiDocs.classList.contains('collapsed')) {
            apiDocs.style.width = newWidth + 'px';
            ResizeState.apiDocsWidth = newWidth;
        }
    } else if (ResizeState.currentHandle === 'console') {
        const deltaY = ResizeState.startY - e.clientY; // Reverse direction
        let newHeight = ResizeState.startHeight + deltaY;

        // Constrain to min/max
        newHeight = Math.max(ResizeState.minConsoleHeight, Math.min(newHeight, ResizeState.maxConsoleHeight));

        const consolePanel = document.querySelector('.console-panel');
        if (consolePanel && !consolePanel.classList.contains('collapsed')) {
            consolePanel.style.height = newHeight + 'px';
            ResizeState.consoleHeight = newHeight;
        }
    }
}

function stopResize() {
    if (!ResizeState.isResizing) return;

    ResizeState.isResizing = false;
    ResizeState.currentHandle = null;

    // Remove resizing class
    document.body.classList.remove('resizing');

    // Save sizes
    saveSizes();
}

// ═══════════════════════════════════════════════════════════
// COLLAPSE/EXPAND INTEGRATION
// ═══════════════════════════════════════════════════════════

export function toggleSidePanel() {
    const sidePanel = document.querySelector('.side-panel');
    if (!sidePanel) return;

    const isCollapsed = sidePanel.classList.contains('collapsed');

    if (isCollapsed) {
        // Expand: restore saved width
        sidePanel.classList.remove('collapsed');
        sidePanel.style.width = ResizeState.sidePanelWidth + 'px';
    } else {
        // Collapse: remember current width
        ResizeState.sidePanelWidth = sidePanel.offsetWidth;
        sidePanel.classList.add('collapsed');
        sidePanel.style.width = '0';
    }

    // Update button
    const collapseBtn = document.getElementById('btn-collapse-sidebar');
    if (collapseBtn) {
        collapseBtn.textContent = isCollapsed ? '◀' : '▶';
    }

    saveSizes();
}

export function toggleApiDocs() {
    const apiDocs = document.querySelector('.sidebar-right');
    if (!apiDocs) return;

    const isCollapsed = apiDocs.classList.contains('collapsed');

    if (isCollapsed) {
        // Expand: restore saved width
        apiDocs.classList.remove('collapsed');
        apiDocs.style.width = ResizeState.apiDocsWidth + 'px';
    } else {
        // Collapse: remember current width
        ResizeState.apiDocsWidth = apiDocs.offsetWidth;
        apiDocs.classList.add('collapsed');
        apiDocs.style.width = '0';
    }

    // Update buttons
    const collapseBtn = document.getElementById('btn-collapse-apidocs');
    if (collapseBtn) {
        collapseBtn.textContent = isCollapsed ? '▶' : '◀';
    }

    const toolbarBtn = document.getElementById('btn-toggle-api-docs');
    if (toolbarBtn) {
        toolbarBtn.textContent = isCollapsed ? '📖 API' : '📖 Hide API';
    }

    saveSizes();
}

export function toggleConsole() {
    const consolePanel = document.querySelector('.console-panel');
    if (!consolePanel) return;

    const isCollapsed = consolePanel.classList.contains('collapsed');

    if (isCollapsed) {
        // Expand: restore saved height
        consolePanel.classList.remove('collapsed');
        consolePanel.style.height = ResizeState.consoleHeight + 'px';
    } else {
        // Collapse: remember current height
        ResizeState.consoleHeight = consolePanel.offsetHeight;
        consolePanel.classList.add('collapsed');
        consolePanel.style.height = '35px';
    }

    // Update button
    const collapseBtn = document.getElementById('btn-collapse-console');
    if (collapseBtn) {
        collapseBtn.textContent = isCollapsed ? '▼' : '▲';
    }

    saveSizes();
}

// ═══════════════════════════════════════════════════════════
// EXPORT PUBLIC API
// ═══════════════════════════════════════════════════════════

export {
    ResizeState
};
