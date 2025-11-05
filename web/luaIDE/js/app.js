// ═══════════════════════════════════════════════════════════
// Lua IDE - Main Application Controller
// Initializes IDE and manages global state
// ═══════════════════════════════════════════════════════════

import { storage } from './storage.js';
import {
    initializeEditor,
    openFileInEditor,
    updateAutocomplete,
    setupKeyboardShortcuts,
    saveCurrentFile,
    saveAllFiles,
    closeAllTabs,
    EditorState
} from './editor-manager.js';
import {
    initializeResize,
    toggleSidePanel,
    toggleApiDocs,
    toggleConsole
} from './resize-manager.js';
import {
    initializeBLE,
    connectBLE,
    disconnectBLE,
    executeLuaCode,
    stopLuaExecution,
    isConnected,
    isExecuting,
    onConnectionChange,
    onLuaPrint,
    onLuaError,
    onLuaStop
} from './ble-handler.js';
import {
    initializeConsole,
    printToConsole,
    printError,
    printSuccess,
    printWarning,
    clearConsole,
    copyConsole,
    printToBLE,
    printBLEError,
    clearBLEOutput,
    shouldAutoClearBLE,
    switchConsoleTab
} from './console-manager.js';
import {
    importProject,
    importProduct,
    exportProject,
    exportProduct,
    createFullBackup,
    restoreFromBackup
} from './import-export.js';
import {
    initializeNotifications,
    showSuccess as notifySuccess,
    showError as notifyError,
    showWarning as notifyWarning,
    showInfo as notifyInfo,
    showConfirmation,
    showLoading,
    hideLoading
} from './notification-manager.js';
import {
    initializeSettingsModal,
    openSettingsModal,
    applySettings,
    getSettings
} from './settings-manager.js';
import {
    initializeContextMenu,
    showContextMenu
} from './context-menu.js';

// ═══════════════════════════════════════════════════════════
// GLOBAL APPLICATION STATE
// ═══════════════════════════════════════════════════════════

const AppState = {
    // Connection
    isConnected: false,
    bleDevice: null,

    // Current selections
    activeProductId: null,
    activeProjectId: null,
    activeFileId: null,

    // UI state
    sidebarCollapsed: false,
    apiDocsCollapsed: false,
    consoleCollapsed: false,

    // Editor state
    openTabs: [],  // Array of fileIds
    editorInstances: {},  // Map of fileId → editor instance
    unsavedChanges: {},  // Map of fileId → boolean

    // Settings
    settings: null
};

// ═══════════════════════════════════════════════════════════
// INITIALIZATION
// ═══════════════════════════════════════════════════════════

async function initializeIDE() {
    console.log('🚀 Initializing Lua IDE...');

    try {
        // Initialize database
        await storage.initDB();
        console.log('✓ Database initialized');

        // Load settings
        AppState.settings = await storage.settings.get();
        console.log('✓ Settings loaded');

        // Check if first run (no products exist)
        let existingProducts = await storage.products.getAll();
        const existingProjects = await storage.projects.getAll();

        // Clean up duplicates: Find all system products (by isSystem flag OR by name pattern)
        const systemProducts = existingProducts.filter(p =>
            p.isSystem || p.name.includes('ESP32 Basic') || p.name.includes('(System)')
        );

        if (systemProducts.length > 1) {
            console.log(`⚠️ Found ${systemProducts.length} system product entries - cleaning up duplicates...`);

            // Keep the first one with isSystem=true, or the first one if none have the flag
            const keepProduct = systemProducts.find(p => p.isSystem) || systemProducts[0];

            // Update it to have isSystem flag
            if (!keepProduct.isSystem) {
                await storage.products.update(keepProduct.id, {
                    isSystem: true,
                    name: 'ESP32 Basic (System)'
                });
            }

            // Delete all other duplicates
            for (const p of systemProducts) {
                if (p.id !== keepProduct.id) {
                    try {
                        // Check if projects depend on this duplicate
                        const dependentProjects = existingProjects.filter(proj => proj.productId === p.id);
                        if (dependentProjects.length > 0) {
                            // Reassign projects to the kept system product
                            for (const proj of dependentProjects) {
                                await storage.projects.update(proj.id, { productId: keepProduct.id });
                            }
                            console.log(`  ↪ Reassigned ${dependentProjects.length} projects from duplicate to kept system product`);
                        }

                        // Force delete the duplicate (temporarily remove isSystem flag)
                        await storage.products.update(p.id, { isSystem: false });
                        await storage.products.delete(p.id);
                        console.log(`  ✓ Removed duplicate: ${p.name}`);
                    } catch (err) {
                        console.error(`  ✗ Failed to remove duplicate ${p.id}:`, err);
                    }
                }
            }

            // Refresh products list after cleanup
            existingProducts = await storage.products.getAll();
            console.log(`✓ Cleanup complete - ${existingProducts.length} products remaining`);
        }

        // Ensure exactly one system product exists
        const systemProduct = existingProducts.find(p => p.isSystem);
        if (!systemProduct) {
            console.log('📦 System product not found - creating ESP32 Basic...');
            const esp32Product = await storage.products.create(DEFAULT_ESP32_PRODUCT);
            console.log('✓ ESP32 Basic (System) product created');

            // If no projects exist, create example project
            if (existingProjects.length === 0) {
                console.log('Creating example project...');
                const exampleProject = await storage.projects.create({
                    name: 'Blink Example',
                    productId: esp32Product.id,
                    files: [{
                        name: 'main.lua',
                        content: `-- LED Blink Example\n-- Blinks the built-in LED on pin 2\n\nlocal ledPin = 2\n\npinMode(ledPin, OUTPUT)\n\nfor i = 1, 10 do\n    print('Blink ' .. i)\n    digitalWrite(ledPin, HIGH)\n    delay(500)\n    digitalWrite(ledPin, LOW)\n    delay(500)\nend\n\nprint('Done!')\n`
                    }]
                });
                console.log('✓ Example project created');
            }
        } else {
            console.log(`✓ Found ${existingProducts.length} products and ${existingProjects.length} projects`);
        }

        // Restore last active selections
        await restoreLastActiveState();

        // Initialize UI
        initializeUI();

        console.log('✓ IDE initialization complete!');
    } catch (error) {
        console.error('❌ Failed to initialize IDE:', error);
        showError('Failed to initialize IDE: ' + error.message);
    }
}

// ═══════════════════════════════════════════════════════════
// DEFAULT DATA (Embedded to avoid CORS issues)
// ═══════════════════════════════════════════════════════════

const DEFAULT_ESP32_PRODUCT = {
    "name": "ESP32 Basic (System)",
    "description": "Standard ESP32 with Arduino-compatible API - System Provided",
    "isSystem": true,
    "autocomplete": [
        {"label": "pinMode", "kind": "Function", "insertText": "pinMode(${1:pin}, ${2:mode})", "documentation": "Configure pin mode (INPUT, OUTPUT, INPUT_PULLUP)", "detail": "pinMode(pin: number, mode: number)"},
        {"label": "digitalWrite", "kind": "Function", "insertText": "digitalWrite(${1:pin}, ${2:value})", "documentation": "Write digital value to pin (HIGH or LOW)", "detail": "digitalWrite(pin: number, value: number)"},
        {"label": "digitalRead", "kind": "Function", "insertText": "digitalRead(${1:pin})", "documentation": "Read digital value from pin (returns HIGH or LOW)", "detail": "digitalRead(pin: number): number"},
        {"label": "analogRead", "kind": "Function", "insertText": "analogRead(${1:pin})", "documentation": "Read analog value from pin (returns 0-4095 for ESP32)", "detail": "analogRead(pin: number): number"},
        {"label": "analogWrite", "kind": "Function", "insertText": "analogWrite(${1:pin}, ${2:value})", "documentation": "Write PWM value to pin (0-255)", "detail": "analogWrite(pin: number, value: number)"},
        {"label": "delay", "kind": "Function", "insertText": "delay(${1:ms})", "documentation": "Delay execution for specified milliseconds", "detail": "delay(ms: number)"},
        {"label": "millis", "kind": "Function", "insertText": "millis()", "documentation": "Get milliseconds since boot", "detail": "millis(): number"},
        {"label": "micros", "kind": "Function", "insertText": "micros()", "documentation": "Get microseconds since boot", "detail": "micros(): number"},
        {"label": "map", "kind": "Function", "insertText": "map(${1:value}, ${2:fromLow}, ${3:fromHigh}, ${4:toLow}, ${5:toHigh})", "documentation": "Map a value from one range to another", "detail": "map(value: number, fromLow: number, fromHigh: number, toLow: number, toHigh: number): number"},
        {"label": "constrain", "kind": "Function", "insertText": "constrain(${1:value}, ${2:min}, ${3:max})", "documentation": "Constrain value between min and max", "detail": "constrain(value: number, min: number, max: number): number"},
        {"label": "random", "kind": "Function", "insertText": "random(${1:max})", "documentation": "Generate random number between 0 and max-1", "detail": "random(max: number): number"},
        {"label": "print", "kind": "Function", "insertText": "print(${1:message})", "documentation": "Print message to console", "detail": "print(message: any)"},
        {"label": "OUTPUT", "kind": "Constant", "insertText": "OUTPUT", "documentation": "Pin mode constant for output mode"},
        {"label": "INPUT", "kind": "Constant", "insertText": "INPUT", "documentation": "Pin mode constant for input mode"},
        {"label": "INPUT_PULLUP", "kind": "Constant", "insertText": "INPUT_PULLUP", "documentation": "Pin mode constant for input with internal pullup resistor"},
        {"label": "HIGH", "kind": "Constant", "insertText": "HIGH", "documentation": "Digital HIGH value (1)"},
        {"label": "LOW", "kind": "Constant", "insertText": "LOW", "documentation": "Digital LOW value (0)"}
    ],
    "apiDocs": "# ESP32 Basic API\n\n## GPIO Functions\n\n**pinMode(pin, mode)** - Configure pin as INPUT, OUTPUT, or INPUT_PULLUP\n\n**digitalWrite(pin, value)** - Write HIGH or LOW to pin\n\n**digitalRead(pin)** - Read digital value from pin (returns HIGH or LOW)\n\n**analogRead(pin)** - Read analog value (0-4095)\n\n**analogWrite(pin, value)** - Write PWM value (0-255)\n\n## Time Functions\n\n**delay(ms)** - Delay execution in milliseconds\n\n**millis()** - Get milliseconds since boot\n\n**micros()** - Get microseconds since boot\n\n## Math Functions\n\n**map(value, fromLow, fromHigh, toLow, toHigh)** - Map value to range\n\n**constrain(value, min, max)** - Constrain value between bounds\n\n**random(max)** - Generate random number 0 to max-1\n\n## Console\n\n**print(message)** - Print to console\n\n## Constants\n\nOUTPUT, INPUT, INPUT_PULLUP, HIGH, LOW\n\n## Example\n\n```lua\npinMode(2, OUTPUT)\nfor i=1,10 do\n  digitalWrite(2, HIGH)\n  delay(500)\n  digitalWrite(2, LOW)\n  delay(500)\nend\n```"
};

// Default template for new custom products
const DEFAULT_PRODUCT_TEMPLATE = {
    "autocomplete": [
        {"label": "init", "kind": "Function", "insertText": "init()", "documentation": "Initialize the device", "detail": "init()"},
        {"label": "read", "kind": "Function", "insertText": "read(${1:address})", "documentation": "Read data from address", "detail": "read(address: number): number"},
        {"label": "write", "kind": "Function", "insertText": "write(${1:address}, ${2:value})", "documentation": "Write value to address", "detail": "write(address: number, value: number)"},
        {"label": "reset", "kind": "Function", "insertText": "reset()", "documentation": "Reset the device", "detail": "reset()"},
        {"label": "status", "kind": "Function", "insertText": "status()", "documentation": "Get device status", "detail": "status(): number"}
    ],
    "apiDocs": "# Custom Product API\n\n## Basic Functions\n\n**init()** - Initialize the device\n\n**read(address)** - Read data from address\n\n**write(address, value)** - Write value to address\n\n**reset()** - Reset the device\n\n**status()** - Get device status\n\n## Usage Example\n\n```lua\ninit()\nlocal value = read(0x10)\nprint('Value: ' .. value)\nwrite(0x10, 255)\nreset()\n```\n\n## Notes\n\nThis is a template. Export this product and edit the JSON to add your custom functions and documentation."
};

// ═══════════════════════════════════════════════════════════
// DEFAULT DATA CREATION
// ═══════════════════════════════════════════════════════════

async function createDefaultData() {
    try {
        console.log('Creating default ESP32 product...');
        const esp32Product = await storage.products.create(DEFAULT_ESP32_PRODUCT);
        console.log('✓ ESP32 Basic product created:', esp32Product.id);

        // Create example project
        console.log('Creating example project...');
        const exampleProject = await storage.projects.create({
            name: 'Blink Example',
            productId: esp32Product.id,
            files: [
                {
                    name: 'main.lua',
                    content: `-- LED Blink Example
-- Blinks the built-in LED on pin 2

local ledPin = 2

pinMode(ledPin, OUTPUT)

for i = 1, 10 do
    print('Blink ' .. i)
    digitalWrite(ledPin, HIGH)
    delay(500)
    digitalWrite(ledPin, LOW)
    delay(500)
end

print('Done!')
`
                }
            ]
        });
        console.log('✓ Example project created:', exampleProject.id);

        // Set as active
        AppState.activeProductId = esp32Product.id;
        AppState.activeProjectId = exampleProject.id;

        // Save to settings
        await storage.settings.update({
            lastActiveProductId: esp32Product.id,
            lastActiveProjectId: exampleProject.id
        });

    } catch (error) {
        console.error('Failed to create default data:', error);
        throw error;
    }
}

// ═══════════════════════════════════════════════════════════
// STATE RESTORATION
// ═══════════════════════════════════════════════════════════

async function restoreLastActiveState() {
    const settings = await storage.settings.get();

    // Restore active product
    if (settings.lastActiveProductId) {
        const product = await storage.products.getById(settings.lastActiveProductId);
        if (product) {
            AppState.activeProductId = settings.lastActiveProductId;
            console.log('✓ Restored active product:', product.name);
        }
    }

    // Restore active project
    if (settings.lastActiveProjectId) {
        const project = await storage.projects.getById(settings.lastActiveProjectId);
        if (project) {
            AppState.activeProjectId = settings.lastActiveProjectId;
            AppState.activeFileId = project.activeFileId;
            console.log('✓ Restored active project:', project.name);
        }
    }

    // If no active selections, use first available
    if (!AppState.activeProductId) {
        const products = await storage.products.getAll();
        if (products.length > 0) {
            AppState.activeProductId = products[0].id;
        }
    }

    if (!AppState.activeProjectId) {
        const projects = await storage.projects.getAll();
        if (projects.length > 0) {
            AppState.activeProjectId = projects[0].id;
            const project = await storage.projects.getById(projects[0].id);
            if (project) {
                AppState.activeFileId = project.activeFileId;
            }
        }
    }
}

// ═══════════════════════════════════════════════════════════
// UI INITIALIZATION
// ═══════════════════════════════════════════════════════════

async function initializeUI() {
    console.log('Initializing UI...');

    // Apply theme
    applyTheme(AppState.settings.theme);

    // Initialize notification system
    initializeNotifications();

    // Initialize context menu
    initializeContextMenu();

    // Initialize resize manager
    initializeResize();

    // Initialize console manager
    initializeConsole();

    // Initialize BLE handler
    const bleSupported = initializeBLE();
    if (!bleSupported) {
        printError('Web Bluetooth is not supported. Please use Chrome or Edge browser.');
    } else {
        // Register BLE event callbacks
        setupBLECallbacks();
        printToConsole('Lua IDE ready. Connect to ESP32 to begin.');
    }

    // Initialize Monaco Editor
    try {
        await initializeEditor();
        console.log('✓ Editor ready');

        // Initialize settings modal and apply settings
        initializeSettingsModal(EditorState.monacoEditor);
        const currentSettings = getSettings();
        applySettings(currentSettings);
        console.log('✓ Settings applied');

        // Setup keyboard shortcuts
        setupKeyboardShortcuts();

        // Update autocomplete for active product
        if (AppState.activeProductId) {
            updateAutocomplete(AppState.activeProductId);
        }

        // Open active file if exists
        if (AppState.activeProjectId && AppState.activeFileId) {
            openFileInEditor(AppState.activeProjectId, AppState.activeFileId);
        }
    } catch (error) {
        console.error('Failed to initialize editor:', error);
        showError('Failed to initialize editor: ' + error.message);
    }

    updateUI();

    // Show welcome screen for first-time users
    showWelcomeIfFirstTime();
}

function applyTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
}

// ═══════════════════════════════════════════════════════════
// WELCOME SCREEN
// ═══════════════════════════════════════════════════════════

function showWelcomeIfFirstTime() {
    const hasSeenWelcome = localStorage.getItem('hasSeenWelcome');

    if (!hasSeenWelcome) {
        const welcomeScreen = document.getElementById('welcome-screen');
        if (welcomeScreen) {
            welcomeScreen.style.display = 'flex';

            // Close button
            document.getElementById('btn-welcome-close')?.addEventListener('click', () => {
                const dontShowAgain = document.getElementById('welcome-dont-show')?.checked;
                if (dontShowAgain) {
                    localStorage.setItem('hasSeenWelcome', 'true');
                }
                welcomeScreen.style.display = 'none';
            });
        }
    }
}

async function updateUI() {
    // Update toolbar dropdowns
    await updateProductDropdown();
    await updateProjectDropdown();

    // Update file explorer
    await updateFileExplorer();
    await updateProductsList();

    // Update API docs
    await updateApiDocs();

    // Update product export button state
    await updateProductExportButton();

    // Update editor (if initialized)
    // Will be implemented in Phase 2
}

// ═══════════════════════════════════════════════════════════
// UI UPDATE FUNCTIONS (Placeholders for Phase 2)
// ═══════════════════════════════════════════════════════════

async function updateProductDropdown() {
    const dropdown = document.getElementById('product-dropdown');
    if (!dropdown) return;

    const products = await storage.products.getAll();
    dropdown.innerHTML = '';

    products.forEach(product => {
        const option = document.createElement('option');
        option.value = product.id;
        option.textContent = product.name;
        option.selected = product.id === AppState.activeProductId;
        dropdown.appendChild(option);
    });
}

async function updateProjectDropdown() {
    const dropdown = document.getElementById('project-dropdown');
    if (!dropdown) return;

    const projects = await storage.projects.getAll();
    dropdown.innerHTML = '';

    projects.forEach(project => {
        const option = document.createElement('option');
        option.value = project.id;
        option.textContent = project.name;
        option.selected = project.id === AppState.activeProjectId;
        dropdown.appendChild(option);
    });
}

async function updateFileExplorer() {
    const explorer = document.getElementById('file-explorer');
    if (!explorer) return;

    // Only show active project
    if (!AppState.activeProjectId) {
        explorer.innerHTML = '<div class="explorer-placeholder">No active project. Create or select a project.</div>';
        return;
    }

    const project = await storage.projects.getById(AppState.activeProjectId);
    if (!project) {
        explorer.innerHTML = '<div class="explorer-placeholder">Project not found.</div>';
        return;
    }

    // Get files for this project
    const files = await storage.files.getByProjectId(AppState.activeProjectId);

    // Build file tree HTML for active project only
    let html = '<div class="explorer-content">';

    html += `
        <div class="project-item active" data-project-id="${project.id}">
            <div class="project-header">
                <span class="icon">📂</span>
                <span class="name">${escapeHtml(project.name)}</span>
            </div>
            <div class="project-files">
    `;

    files.forEach(file => {
        const isActiveFile = file.id === AppState.activeFileId;
        html += `
            <div class="file-item ${isActiveFile ? 'active' : ''}" data-file-id="${file.id}">
                <span class="icon">📄</span>
                <span class="name">${escapeHtml(file.name)}</span>
            </div>
        `;
    });

    html += `
            </div>
        </div>
    `;

    html += '</div>';
    explorer.innerHTML = html;

    // Attach event listeners
    attachFileExplorerEvents();
}

function attachFileExplorerEvents() {
    // File click and context menu handlers
    document.querySelectorAll('.file-item').forEach(item => {
        const fileId = item.getAttribute('data-file-id');

        // Left click to open
        item.addEventListener('click', () => {
            openFile(AppState.activeProjectId, fileId);
        });

        // Right click for context menu
        item.addEventListener('contextmenu', (e) => {
            showContextMenu(e, 'file', item, {
                projectId: AppState.activeProjectId,
                fileId: fileId
            });
        });
    });

    // Project header click and context menu handlers
    document.querySelectorAll('.project-header').forEach(async (header) => {
        const projectItem = header.closest('.project-item');
        const projectId = projectItem.getAttribute('data-project-id');
        const project = await storage.projects.getById(projectId);

        // Left click to switch
        header.addEventListener('click', () => {
            switchProject(projectId);
        });

        // Right click for context menu
        header.addEventListener('contextmenu', (e) => {
            showContextMenu(e, 'project', header, project);
        });
    });
}

async function updateProductsList() {
    const productsList = document.getElementById('products-list');
    if (!productsList) return;

    const products = await storage.products.getAll();

    let html = '<div class="products-content">';

    products.forEach(product => {
        const isActive = product.id === AppState.activeProductId;
        const isSystem = product.isSystem || false;
        const systemBadge = isSystem ? ' 🔒' : '';
        html += `
            <div class="product-item ${isActive ? 'active' : ''}" data-product-id="${product.id}">
                <span class="icon">${isActive ? '🟢' : '⚪'}</span>
                <span class="name">${escapeHtml(product.name)}${systemBadge}</span>
            </div>
        `;
    });

    html += '</div>';
    productsList.innerHTML = html;

    // Attach click and context menu handlers
    document.querySelectorAll('.product-item').forEach(async (item) => {
        const productId = item.getAttribute('data-product-id');
        const product = await storage.products.getById(productId);

        // Left click to switch
        item.addEventListener('click', () => {
            switchProduct(productId);
        });

        // Right click for context menu
        item.addEventListener('contextmenu', (e) => {
            showContextMenu(e, 'product', item, product);
        });
    });

    // Update export button state based on active product
    updateProductExportButton();
}

async function updateApiDocs() {
    const apiDocsContent = document.getElementById('api-docs-content');
    if (!apiDocsContent) return;

    if (!AppState.activeProductId) {
        apiDocsContent.innerHTML = '<p class="docs-placeholder">Select a product to view API documentation.</p>';
        return;
    }

    const product = await storage.products.getById(AppState.activeProductId);
    if (!product) {
        apiDocsContent.innerHTML = '<p class="docs-placeholder">Product not found.</p>';
        return;
    }

    // Convert markdown-style formatting to basic HTML
    let html = product.apiDocs;

    // Headers
    html = html.replace(/^# (.*$)/gim, '<h1>$1</h1>');
    html = html.replace(/^## (.*$)/gim, '<h2>$1</h2>');
    html = html.replace(/^### (.*$)/gim, '<h3>$1</h3>');

    // Bold
    html = html.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');

    // Code blocks
    html = html.replace(/```lua\n([\s\S]*?)```/g, '<pre><code class="lua">$1</code></pre>');
    html = html.replace(/```([\s\S]*?)```/g, '<pre><code>$1</code></pre>');

    // Inline code
    html = html.replace(/`([^`]+)`/g, '<code>$1</code>');

    // Line breaks
    html = html.replace(/\n\n/g, '</p><p>');
    html = '<p>' + html + '</p>';

    apiDocsContent.innerHTML = html;
}

// ═══════════════════════════════════════════════════════════
// ACTION HANDLERS
// ═══════════════════════════════════════════════════════════

async function switchProduct(productId) {
    const product = await storage.products.getById(productId);
    if (!product) {
        showError('Product not found');
        return;
    }

    AppState.activeProductId = productId;

    // Save to settings
    await storage.settings.update({ lastActiveProductId: productId });

    // Update autocomplete
    updateAutocomplete(productId);

    // Update UI
    updateProductDropdown();
    updateProductsList();
    updateApiDocs();

    // Update export button state
    updateProductExportButton();

    // Emit product:changed event for other modules to listen
    document.dispatchEvent(new CustomEvent('product:changed', {
        detail: { productId }
    }));

    console.log('✓ Switched to product:', product.name);
}

async function updateProductExportButton() {
    const exportButton = document.getElementById('btn-export-product');
    if (!exportButton || !AppState.activeProductId) return;

    const product = await storage.products.getById(AppState.activeProductId);
    if (product && product.isSystem) {
        exportButton.disabled = true;
        exportButton.title = 'Cannot export system products';
    } else {
        exportButton.disabled = false;
        exportButton.title = 'Export Product';
    }
}

async function switchProject(projectId) {
    const project = await storage.projects.getById(projectId);
    if (!project) {
        showError('Project not found');
        return;
    }

    // Save all open files before switching
    saveAllFiles();

    // Close all tabs
    closeAllTabs();

    AppState.activeProjectId = projectId;
    AppState.activeFileId = project.activeFileId;

    // Save to settings
    await storage.settings.update({ lastActiveProjectId: projectId });

    // Update UI
    updateProjectDropdown();
    updateFileExplorer();

    // Open the active file in the new project
    if (project.activeFileId) {
        openFileInEditor(projectId, project.activeFileId);
    }

    // Emit project:changed event
    document.dispatchEvent(new CustomEvent('project:changed', {
        detail: { projectId }
    }));

    console.log('✓ Switched to project:', project.name);
}

async function openFile(projectId, fileId) {
    const file = await storage.projects.getFile(projectId, fileId);
    if (!file) {
        showError('File not found');
        return;
    }

    AppState.activeFileId = fileId;
    await storage.projects.setActiveFile(projectId, fileId);

    // Open in editor
    openFileInEditor(projectId, fileId);

    // Update UI
    updateFileExplorer();

    // Emit file:changed event
    document.dispatchEvent(new CustomEvent('file:changed', {
        detail: { projectId, fileId }
    }));

    console.log('✓ Opened file:', file.name);
}

// ═══════════════════════════════════════════════════════════
// UTILITY FUNCTIONS
// ═══════════════════════════════════════════════════════════

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function showError(message) {
    console.error('Error:', message);
    printError(message);
    notifyError(message);
}

function showSuccess(message) {
    console.log('Success:', message);
    printSuccess(message);
    notifySuccess(message);
}

// ═══════════════════════════════════════════════════════════
// BLE CALLBACKS
// ═══════════════════════════════════════════════════════════

function setupBLECallbacks() {
    // Connection status change
    onConnectionChange((connected, deviceName) => {
        AppState.isConnected = connected;
        updateConnectionStatusBar(connected, deviceName);

        if (connected) {
            printSuccess(`Connected to ${deviceName}`);
            printToBLE(`Connected to ${deviceName}`);
        } else {
            printWarning('Disconnected from ESP32');
            printBLEError('Disconnected from ESP32');
        }
    });

    // Lua print output (goes to BLE Output tab only)
    onLuaPrint((message) => {
        printToBLE(message);
    });

    // Lua error output (goes to both tabs, red in BLE Output)
    onLuaError((errorMsg) => {
        printError(errorMsg);
        printBLEError(errorMsg);
    });

    // Lua execution stopped (goes to BLE Output tab in red)
    onLuaStop((stopMsg) => {
        printToConsole('Lua execution stopped');
        printBLEError('Lua execution stopped');
        updateExecutionButtons(false);
    });
}

function updateConnectionStatusBar(connected, deviceName) {
    const statusElement = document.getElementById('connection-status');
    if (!statusElement) return;

    if (connected) {
        statusElement.innerHTML = `🟢 Connected: ${deviceName}`;
    } else {
        statusElement.innerHTML = '🔴 Disconnected';
    }

    // Update Connect button text
    const btnConnect = document.getElementById('btn-connect');
    if (btnConnect) {
        if (connected) {
            btnConnect.textContent = '⛔ Disconnect';
            btnConnect.title = 'Disconnect from ESP32';
        } else {
            btnConnect.textContent = '🔌 Connect';
            btnConnect.title = 'Connect to ESP32';
        }
    }

    // Update execution buttons
    updateExecutionButtons(isExecuting());
}

function updateExecutionButtons(executing) {
    const btnExecute = document.getElementById('btn-execute');
    const btnStop = document.getElementById('btn-stop');

    if (btnExecute) {
        btnExecute.disabled = executing || !isConnected();
    }

    if (btnStop) {
        btnStop.disabled = !executing;
    }
}

// ═══════════════════════════════════════════════════════════
// EXPORT PUBLIC API
// ═══════════════════════════════════════════════════════════

export {
    AppState,
    switchProduct,
    switchProject,
    openFile,
    updateUI,
    showError,
    showSuccess,
    saveCurrentFile,
    saveAllFiles
};

// ═══════════════════════════════════════════════════════════
// ACTIVITY BAR PANEL SWITCHING
// ═══════════════════════════════════════════════════════════

function attachActivityBarListeners() {
    document.querySelectorAll('.activity-item').forEach(item => {
        item.addEventListener('click', () => {
            const panelName = item.getAttribute('data-panel');
            switchPanel(panelName);
        });
    });
}

function switchPanel(panelName) {
    const sidePanel = document.querySelector('.side-panel');
    const clickedItem = document.querySelector(`.activity-item[data-panel="${panelName}"]`);
    const wasAlreadyActive = clickedItem && clickedItem.classList.contains('active');

    // If clicking the already active panel, toggle collapse using resize-manager
    if (wasAlreadyActive && sidePanel) {
        toggleSidePanel();
        return;
    }

    // Expand side panel if it was collapsed using resize-manager
    if (sidePanel && sidePanel.classList.contains('collapsed')) {
        toggleSidePanel();
    }

    // Remove active class from all activity items
    document.querySelectorAll('.activity-item').forEach(item => {
        item.classList.remove('active');
    });

    // Add active class to clicked item
    if (clickedItem) {
        clickedItem.classList.add('active');
    }

    // Hide all panels
    document.querySelectorAll('.panel-content').forEach(panel => {
        panel.classList.remove('active');
    });

    // Show selected panel
    const panel = document.getElementById(`panel-${panelName}`);
    if (panel) {
        panel.classList.add('active');
    }

    console.log('✓ Switched to panel:', panelName);
}

// ═══════════════════════════════════════════════════════════
// COLLAPSE FUNCTIONALITY
// ═══════════════════════════════════════════════════════════

function attachCollapseHandlers() {
    // Side panel (projects/products) collapse
    const btnCollapseSidebar = document.getElementById('btn-collapse-sidebar');
    if (btnCollapseSidebar) {
        btnCollapseSidebar.addEventListener('click', () => {
            toggleSidePanel();
        });
    }

    // API docs collapse
    const btnCollapseApiDocs = document.getElementById('btn-collapse-apidocs');
    if (btnCollapseApiDocs) {
        btnCollapseApiDocs.addEventListener('click', () => {
            toggleApiDocs();
        });
    }

    // Console collapse
    const btnCollapseConsole = document.getElementById('btn-collapse-console');
    if (btnCollapseConsole) {
        btnCollapseConsole.addEventListener('click', () => {
            toggleConsole();
        });
    }

    console.log('✓ Collapse handlers attached');
}

// ═══════════════════════════════════════════════════════════
// EVENT LISTENERS
// ═══════════════════════════════════════════════════════════

function attachEventListeners() {
    // Activity bar panel switching
    attachActivityBarListeners();

    // Collapse button handlers
    attachCollapseHandlers();

    // Dropdown change handlers
    const productDropdown = document.getElementById('product-dropdown');
    if (productDropdown) {
        productDropdown.addEventListener('change', (e) => {
            switchProduct(e.target.value);
        });
    }

    const projectDropdown = document.getElementById('project-dropdown');
    if (projectDropdown) {
        projectDropdown.addEventListener('change', (e) => {
            switchProject(e.target.value);
        });
    }

    // Toolbar button handlers
    document.getElementById('btn-toggle-api-docs')?.addEventListener('click', () => {
        toggleApiDocs();
    });

    document.getElementById('btn-connect')?.addEventListener('click', async () => {
        try {
            if (isConnected()) {
                disconnectBLE();
            } else {
                printToConsole('Requesting BLE device...');
                await connectBLE();
            }
        } catch (error) {
            showError('Connection failed: ' + error.message);
        }
    });

    document.getElementById('btn-execute')?.addEventListener('click', async () => {
        if (!isConnected()) {
            showError('Not connected to ESP32. Click Connect first.');
            return;
        }

        if (EditorState.activeTabIndex === -1) {
            showError('No file is open. Open a file first.');
            return;
        }

        const tab = EditorState.openTabs[EditorState.activeTabIndex];
        if (!tab) {
            showError('No active file.');
            return;
        }

        const model = EditorState.editorModels.get(tab.fileId);
        if (!model) {
            showError('Could not get file content.');
            return;
        }

        const code = model.getValue();
        if (!code || code.trim().length === 0) {
            showError('File is empty. Write some Lua code first.');
            return;
        }

        try {
            // Auto-clear BLE Output if checkbox is enabled
            if (shouldAutoClearBLE()) {
                clearBLEOutput();
            }

            // Switch to BLE Output tab to show results
            switchConsoleTab('ble');

            updateExecutionButtons(true);
            printToConsole(`▶ Executing ${tab.file.name}...`);
            printToBLE(`▶ Executing ${tab.file.name}...`);
            await executeLuaCode(code);
        } catch (error) {
            showError('Execution failed: ' + error.message);
            printBLEError('Execution failed: ' + error.message);
            updateExecutionButtons(false);
        }
    });

    document.getElementById('btn-stop')?.addEventListener('click', async () => {
        try {
            await stopLuaExecution();
            updateExecutionButtons(false);
        } catch (error) {
            showError('Stop failed: ' + error.message);
        }
    });

    document.getElementById('btn-backup')?.addEventListener('click', async () => {
        try {
            const result = await createFullBackup();
            showSuccess(result.message);
            printToConsole(`✓ Backup created: ${result.stats.productCount} products, ${result.stats.projectCount} projects`);
        } catch (error) {
            showError('Failed to create backup: ' + error.message);
        }
    });

    document.getElementById('btn-restore')?.addEventListener('click', () => {
        // Trigger hidden file input for backup file
        document.getElementById('file-input-restore-backup')?.click();
    });

    // File explorer buttons
    document.getElementById('btn-new-project')?.addEventListener('click', async () => {
        const name = prompt('Enter project name:');
        if (name) {
            try {
                const project = await storage.projects.create({
                    name: name,
                    productId: AppState.activeProductId
                });
                await switchProject(project.id);
                showSuccess('Project created: ' + name);
            } catch (error) {
                showError('Failed to create project: ' + error.message);
            }
        }
    });

    document.getElementById('btn-import-project')?.addEventListener('click', () => {
        // Trigger hidden file input for project import
        document.getElementById('file-input-import-project')?.click();
    });

    document.getElementById('btn-export-project')?.addEventListener('click', async () => {
        if (!AppState.activeProjectId) {
            showError('No active project to export');
            return;
        }
        try {
            const result = await exportProject(AppState.activeProjectId);
            showSuccess(result.message);
        } catch (error) {
            showError('Failed to export project: ' + error.message);
        }
    });

    document.getElementById('btn-new-product')?.addEventListener('click', async () => {
        const name = prompt('Enter product name:');
        if (name) {
            try {
                // Create product with default template (has example functions)
                const product = await storage.products.create({
                    name: name,
                    description: 'Custom product',
                    isSystem: false,
                    autocomplete: DEFAULT_PRODUCT_TEMPLATE.autocomplete,
                    apiDocs: DEFAULT_PRODUCT_TEMPLATE.apiDocs.replace('Custom Product', name)
                });

                // Switch to the new product
                await switchProduct(product.id);
                updateUI();

                showSuccess(`Product "${name}" created with default template! Export and edit the JSON to customize.`);
            } catch (error) {
                showError('Failed to create product: ' + error.message);
            }
        }
    });

    document.getElementById('btn-import-product')?.addEventListener('click', () => {
        // Trigger hidden file input for product import
        document.getElementById('file-input-import-product')?.click();
    });

    document.getElementById('btn-export-product')?.addEventListener('click', async () => {
        if (!AppState.activeProductId) {
            showError('No active product to export');
            return;
        }
        try {
            const result = await exportProduct(AppState.activeProductId);
            showSuccess(result.message);
        } catch (error) {
            showError('Failed to export product: ' + error.message);
        }
    });

    // Console buttons
    document.getElementById('btn-clear-console')?.addEventListener('click', () => {
        clearConsole();
    });

    document.getElementById('btn-copy-console')?.addEventListener('click', () => {
        copyConsole();
    });

    // New file button (in projects panel)
    document.getElementById('btn-new-file')?.addEventListener('click', async () => {
        if (!AppState.activeProjectId) {
            showError('No active project. Create a project first.');
            return;
        }

        const fileName = prompt('Enter file name (without .lua):');
        if (fileName) {
            try {
                const file = await storage.projects.addFile(AppState.activeProjectId, {
                    name: fileName
                });
                await updateFileExplorer();
                await openFile(AppState.activeProjectId, file.id);
                showSuccess('File created: ' + file.name);
            } catch (error) {
                showError('Failed to create file: ' + error.message);
            }
        }
    });

    // Hidden file input handlers for import/restore
    document.getElementById('file-input-import-project')?.addEventListener('change', async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        try {
            const result = await importProject(file);
            showSuccess(result.message);

            // Refresh UI to show imported project
            await updateUI();

            // Switch to imported project
            await switchProject(result.project.id);
        } catch (error) {
            showError('Import failed: ' + error.message);
        }

        // Clear the input so the same file can be imported again
        e.target.value = '';
    });

    document.getElementById('file-input-import-product')?.addEventListener('change', async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        try {
            const result = await importProduct(file);
            showSuccess(result.message);

            // Refresh UI to show imported product
            await updateUI();

            // Switch to imported product
            await switchProduct(result.product.id);
        } catch (error) {
            showError('Import failed: ' + error.message);
        }

        // Clear the input
        e.target.value = '';
    });

    document.getElementById('file-input-restore-backup')?.addEventListener('change', async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        try {
            // Default to merge mode (can add UI option later for replace mode)
            const result = await restoreFromBackup(file, 'merge');

            // Show success message and prompt reload
            alert(result.message);

            // Reload the page to refresh all data
            window.location.reload();
        } catch (error) {
            showError('Restore failed: ' + error.message);
        }

        // Clear the input
        e.target.value = '';
    });

    // Context menu event handlers
    document.addEventListener('product:renamed', async (e) => {
        await updateUI();
    });

    document.addEventListener('product:deleted', async (e) => {
        const { productId } = e.detail;

        // If deleted product was active, switch to first available
        if (AppState.activeProductId === productId) {
            const products = await storage.products.getAll();
            if (products.length > 0) {
                await switchProduct(products[0].id);
            } else {
                AppState.activeProductId = null;
            }
        }

        await updateUI();
    });

    document.addEventListener('project:renamed', async (e) => {
        await updateUI();
    });

    document.addEventListener('project:deleted', async (e) => {
        const { projectId } = e.detail;

        // If deleted project was active, switch to first available
        if (AppState.activeProjectId === projectId) {
            const projects = await storage.projects.getAll();
            if (projects.length > 0) {
                await switchProject(projects[0].id);
            } else {
                AppState.activeProjectId = null;
                AppState.activeFileId = null;
                closeAllTabs();
            }
        }

        await updateUI();
    });

    document.addEventListener('file:renamed', async (e) => {
        await updateUI();
        // Reload editor to update tab name
        if (AppState.activeProjectId && AppState.activeFileId) {
            openFileInEditor(AppState.activeProjectId, AppState.activeFileId);
        }
    });

    document.addEventListener('file:deleted', async (e) => {
        const { projectId, fileId } = e.detail;

        // If deleted file was active, open the first file in project
        if (AppState.activeFileId === fileId) {
            const files = await storage.files.getByProjectId(projectId);
            if (files.length > 0) {
                await openFile(projectId, files[0].id);
            } else {
                AppState.activeFileId = null;
            }
        }

        await updateUI();
    });

    document.addEventListener('file:created', async (e) => {
        const { projectId, fileId } = e.detail;
        await updateUI();
        // Open the newly created file
        await openFile(projectId, fileId);
    });

    console.log('✓ Event listeners attached');
}

function downloadFile(content, filename, mimeType) {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

// ═══════════════════════════════════════════════════════════
// AUTO-INITIALIZE ON DOM READY
// ═══════════════════════════════════════════════════════════

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        initializeIDE().then(() => {
            attachEventListeners();
        });
    });
} else {
    initializeIDE().then(() => {
        attachEventListeners();
    });
}
