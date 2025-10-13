// ═══════════════════════════════════════════════════════════
// Lua IDE - Console Manager
// Handles debug console output and logging with tabs
// ═══════════════════════════════════════════════════════════

// ═══════════════════════════════════════════════════════════
// CONSOLE STATE
// ═══════════════════════════════════════════════════════════

const ConsoleState = {
    activeTab: 'debug',  // 'debug' or 'ble'
    autoClearBLE: true
};

// ═══════════════════════════════════════════════════════════
// TAB MANAGEMENT
// ═══════════════════════════════════════════════════════════

export function initializeConsole() {
    // Setup tab click handlers
    document.querySelectorAll('.console-tab').forEach(tab => {
        tab.addEventListener('click', () => {
            const tabName = tab.getAttribute('data-tab');
            switchConsoleTab(tabName);
        });
    });

    // Setup autoclear checkbox
    const autoClearCheckbox = document.getElementById('chk-autoclear-ble');
    if (autoClearCheckbox) {
        autoClearCheckbox.addEventListener('change', (e) => {
            ConsoleState.autoClearBLE = e.target.checked;
        });
    }

    console.log('✓ Console manager initialized');
}

export function switchConsoleTab(tabName) {
    ConsoleState.activeTab = tabName;

    // Update tab buttons
    document.querySelectorAll('.console-tab').forEach(tab => {
        if (tab.getAttribute('data-tab') === tabName) {
            tab.classList.add('active');
        } else {
            tab.classList.remove('active');
        }
    });

    // Update console outputs
    document.querySelectorAll('.console-output').forEach(output => {
        output.classList.remove('active');
    });

    const activeOutput = document.getElementById(`console-output-${tabName}`);
    if (activeOutput) {
        activeOutput.classList.add('active');
    }
}

// ═══════════════════════════════════════════════════════════
// CONSOLE OUTPUT - DEBUG TAB
// ═══════════════════════════════════════════════════════════

export function printToConsole(message, type = 'info') {
    printToTab('debug', message, type);
}

export function printError(message) {
    printToConsole(message, 'error');
}

export function printSuccess(message) {
    printToConsole(message, 'success');
}

export function printWarning(message) {
    printToConsole(message, 'warning');
}

// ═══════════════════════════════════════════════════════════
// CONSOLE OUTPUT - BLE TAB
// ═══════════════════════════════════════════════════════════

export function printToBLE(message, type = 'info') {
    printToTab('ble', message, type);
}

export function printBLEError(message) {
    printToTab('ble', message, 'error');
}

export function clearBLEOutput() {
    const consoleOutput = document.getElementById('console-output-ble');
    if (!consoleOutput) return;

    consoleOutput.innerHTML = '';
    const timestamp = new Date().toLocaleTimeString();
    consoleOutput.innerHTML = `
        <div class="console-line">
            <span class="console-timestamp">[${timestamp}]</span>
            <span class="console-message">BLE Output cleared</span>
        </div>
    `;
}

export function shouldAutoClearBLE() {
    return ConsoleState.autoClearBLE;
}

// ═══════════════════════════════════════════════════════════
// GENERIC TAB OUTPUT
// ═══════════════════════════════════════════════════════════

function printToTab(tabName, message, type = 'info') {
    const consoleOutput = document.getElementById(`console-output-${tabName}`);
    if (!consoleOutput) return;

    const timestamp = new Date().toLocaleTimeString();
    const line = document.createElement('div');
    line.className = `console-line ${type}`;

    line.innerHTML = `
        <span class="console-timestamp">[${timestamp}]</span>
        <span class="console-message">${escapeHtml(message)}</span>
    `;

    consoleOutput.appendChild(line);

    // Auto-scroll to bottom
    consoleOutput.scrollTop = consoleOutput.scrollHeight;

    // Limit console to last 500 lines
    while (consoleOutput.children.length > 500) {
        consoleOutput.removeChild(consoleOutput.firstChild);
    }
}

// ═══════════════════════════════════════════════════════════
// CLEAR AND COPY
// ═══════════════════════════════════════════════════════════

export function clearConsole() {
    const tabName = ConsoleState.activeTab;
    const consoleOutput = document.getElementById(`console-output-${tabName}`);
    if (!consoleOutput) return;

    consoleOutput.innerHTML = '';
    const timestamp = new Date().toLocaleTimeString();
    consoleOutput.innerHTML = `
        <div class="console-line">
            <span class="console-timestamp">[${timestamp}]</span>
            <span class="console-message">${tabName === 'debug' ? 'Debug console' : 'BLE output'} cleared</span>
        </div>
    `;
}

export function copyConsole() {
    const tabName = ConsoleState.activeTab;
    const consoleOutput = document.getElementById(`console-output-${tabName}`);
    if (!consoleOutput) return;

    const text = consoleOutput.innerText;
    navigator.clipboard.writeText(text).then(() => {
        printSuccess('Console content copied to clipboard');
    }).catch(err => {
        printError('Failed to copy console content: ' + err.message);
    });
}

// ═══════════════════════════════════════════════════════════
// UTILITY
// ═══════════════════════════════════════════════════════════

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}
