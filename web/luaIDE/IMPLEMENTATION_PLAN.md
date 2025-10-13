# Lua IDE - Implementation Plan

## ✅ Requirements Summary

### Core Features
- ✅ **Product System**: Multiple hardware configurations with unique APIs
- ✅ **Project System**: Multi-file projects with tab-based editor
- ✅ **File Management**: Create, rename, delete, multi-file support
- ✅ **Monaco Editor**: Professional code editor (VS Code engine)
- ✅ **Product-Aware Autocomplete**: JSON-based, switches with product
- ✅ **API Documentation**: Markdown/HTML, product-specific, searchable
- ✅ **BLE Communication**: event_msg.js protocol integration
- ✅ **Debug Console**: Real-time output, collapsible, color-coded
- ✅ **Import/Export**: Projects, products, full IDE backup
- ✅ **Offline-First**: 100% localStorage, no server needed
- ✅ **VS Code-Like UI**: Familiar, professional interface

---

## 🎨 VS Code-Inspired UI Layout

```
┌─────────────────────────────────────────────────────────────────────────┐
│  TOOLBAR (50px)                                                          │
│  🔷 Lua IDE  | [Product ▼] [Project ▼] [Connect] [▶] [⏹] [Settings]   │
└─────────────────────────────────────────────────────────────────────────┘
┌──────┬──────────────────────────────────────────────────┬──────────────┐
│      │                                                   │              │
│  🔘  │  TABS                                    [⚙️]    │   📖 API     │
│  📁  │  [main.lua ×] [utils.lua ×] [+]                 │              │
│  🔍  │  ──────────────────────────────────────────────  │   Searchable │
│  🐛  │                                                   │   Docs       │
│  🔧  │         MONACO EDITOR                            │              │
│ (20) │                                                   │   Product    │
│      │         Code editing area...                     │   specific   │
│  ─── │                                                   │              │
│  📂  │                                                   │   Collapsible│
│ PROJ │                                                   │   [◀ Hide]   │
│  ├─  │                                                   │              │
│  └─  │                                                   │              │
│      │                                                   │              │
│  🔷  │                                                   │              │
│ PROD │                                                   │              │
│  ├─  │                                                   │              │
│  └─  │                                                   │              │
│      │                                                   │              │
│ (250)│                (Auto-resize)                     │    (300px)   │
│      │                                                   │              │
├──────┴──────────────────────────────────────────────────┴──────────────┤
│  🐛 DEBUG CONSOLE                            [📋] [🗑️] [⚙️] [▼ Hide]   │
│  ──────────────────────────────────────────────────────────────────    │
│  [10:23:45] 🟢 Connected                                                │
│  [10:23:50] Hello from Lua!                                             │
│  (200px - Resizable, Collapsible)                                       │
└─────────────────────────────────────────────────────────────────────────┘
┌─────────────────────────────────────────────────────────────────────────┐
│  STATUS BAR (24px)                                                       │
│  🟢 Connected  |  Ln 10, Col 5  |  Lua  |  main.lua  |  UTF-8          │
└─────────────────────────────────────────────────────────────────────────┘
```

### Activity Bar (Left - 50px, VS Code style)

```
┌──────┐
│  🔘  │  ← Home/Welcome
│  📁  │  ← File Explorer (Projects)
│  🔍  │  ← Search (future)
│  🐛  │  ← Debug (show/hide console)
│  🔧  │  ← Extensions (future - products management)
│      │
│  ─── │  ← Separator
│      │
│  ⚙️  │  ← Settings
│  📦  │  ← Backup/Import
└──────┘
```

**Key Features:**
- Always visible (50px width)
- Icon-based navigation
- Highlights active section
- Tooltips on hover
- Extensible for future features

---

## 📂 Side Panel (Expandable, VS Code Style)

### File Explorer View (📁)
```
┌─────────────────────────────┐
│  EXPLORER                   │
│  ────────────────────────── │
│                             │
│  📂 OPEN EDITORS            │
│    ├─ main.lua (•)          │ ← Unsaved indicator
│    └─ utils.lua             │
│                             │
│  📂 LED BLINK              │ ← Active Project (bold)
│    ├─ 📄 main.lua          │ ← Active file (highlighted)
│    └─ 📄 utils.lua         │
│                             │
│  📂 ROBOT ARM               │
│    ├─ 📄 main.lua          │
│    ├─ 📄 motors.lua        │
│    └─ 📄 sensors.lua       │
│                             │
│  [➕ New Project]           │
│  [📥 Import Project]        │
│  [📤 Export Active]         │
│                             │
│  (250px - Resizable)        │
└─────────────────────────────┘
```

### Extensions/Products View (🔧)
```
┌─────────────────────────────┐
│  PRODUCTS                   │
│  ────────────────────────── │
│                             │
│  🟢 ESP32 Basic            │ ← Active (green dot)
│  │  Standard Arduino API    │
│  │  [✓ Loaded]              │
│  │                          │
│  ⚪ M5Stack Core2           │
│  │  Display + IMU + More    │
│  │  [Load]                  │
│  │                          │
│  ⚪ Custom Board            │
│     User-defined API        │
│     [Load]                  │
│                             │
│  [➕ New Product]           │
│  [📥 Import Product]        │
│  [📤 Export Active]         │
│                             │
└─────────────────────────────┘
```

### Debug View (🐛)
```
┌─────────────────────────────┐
│  DEBUG                      │
│  ────────────────────────── │
│                             │
│  🔌 CONNECTION              │
│    Status: Connected        │
│    Device: ESP32_Lua        │
│                             │
│  [🔌 Connect]               │
│  [⛔ Disconnect]            │
│                             │
│  ────────────────────────── │
│                             │
│  ▶️ EXECUTION                │
│    Active: main.lua         │
│    Status: Running          │
│                             │
│  [▶ Execute File]           │
│  [▶▶ Execute All]           │
│  [⏹ Stop]                   │
│                             │
│  ────────────────────────── │
│                             │
│  📊 STATISTICS              │
│    Execution time: 1.2s     │
│    Console lines: 45        │
│                             │
└─────────────────────────────┘
```

---

## 🎯 Implementation Phases

### Phase 1: Core Foundation ✅ COMPLETED
**Files:** `storage.js`, `app.js`

- [x] Implement complete storage API
- [x] Create default ESP32 product
- [x] Initialize IDE state management
- [x] Basic HTML structure
- [x] Basic CSS styling

**Deliverable:** Storage system working, can create/read products & projects

---

### Phase 2: Editor & UI ✅ COMPLETED
**Files:** `editor-manager.js`, `resize-manager.js`, `styles.css`

- [x] Integrate Monaco editor
- [x] Multi-tab system
- [x] Activity bar (left icons)
- [x] File explorer panel
- [x] Products panel
- [x] Resizable panels (all 3 panels with drag handles)
- [x] Collapsible sections
- [x] Auto-save functionality
- [x] Keyboard shortcuts

**Deliverable:** Full UI layout working, can edit files in tabs

**Notes:**
- Implemented comprehensive resize system with localStorage persistence
- Added VS Code-style activity bar with modular panels
- Monaco editor integration with Lua syntax highlighting

---

### Phase 3: Product System ✅ COMPLETED
**Files:** `product-manager.js` (integrated in `app.js`)

- [x] Product CRUD operations
- [x] Product switching
- [x] Autocomplete integration (Monaco)
- [x] API docs panel with search
- [x] Import/export products

**Deliverable:** Can switch products, autocomplete updates

**Notes:**
- Product system fully integrated with editor-manager
- Autocomplete dynamically updates when switching products
- API documentation with markdown rendering

---

### Phase 4: Project System ✅ COMPLETED
**Files:** `project-manager.js` (integrated in `app.js`)

- [x] Project CRUD operations
- [x] File CRUD operations
- [x] Project switching (with save all & close all tabs)
- [x] File tree navigation
- [x] Import/export projects
- [x] Show only active project in sidebar
- [x] Context menus (basic via buttons)

**Deliverable:** Can manage multiple projects with files

**Notes:**
- Implemented project-scoped file display (only shows active project)
- Auto-save all files when switching projects
- Close all tabs on project switch

---

### Phase 5: BLE Integration ✅ COMPLETED
**Files:** `ble-handler.js`, `console-manager.js`, `event_msg.js`

- [x] BLE connection via Nordic UART
- [x] event_msg.js integration
- [x] Send lua_execute events
- [x] Receive lua_print events
- [x] Receive lua_error events
- [x] Receive lua_stop events
- [x] Debug console output with color coding
- [x] Connection status in status bar
- [x] Connect/Disconnect button (dynamic text)
- [x] Execute button (sends current file)
- [x] Stop button
- [x] Ctrl+Enter keyboard shortcut for execution

**Deliverable:** Can execute code on ESP32, see output

**Notes:**
- Complete Web Bluetooth integration using Nordic UART Service (NUS)
- Event-based architecture with EventDecoder for incoming events
- Chunked sending for large Lua scripts (480 bytes per chunk)
- Real-time console output with timestamps
- Proper error handling and user feedback
- Button states update based on connection/execution status

---

### Phase 6: Import/Export & Backup (Week 4)
**Files:** `import-export.js`

- [ ] Project export (JSON)
- [ ] Project import (JSON)
- [ ] Product export (JSON)
- [ ] Product import (JSON)
- [ ] Full IDE backup
- [ ] Full IDE restore
- [ ] Validation & error handling

**Deliverable:** Complete import/export system

---

### Phase 7: Polish & Testing (Week 5)
**All files**

- [ ] Keyboard shortcuts
- [ ] Settings modal
- [ ] Theme refinement
- [ ] Icons & visual polish
- [ ] Error messages
- [ ] Loading states
- [ ] Welcome screen
- [ ] Help documentation
- [ ] Testing all features

**Deliverable:** Production-ready IDE

---

## 📦 Default Data

### ESP32 Basic Product (default-data/esp32-basic.json)
```json
{
    "name": "ESP32 Basic",
    "description": "Standard ESP32 with Arduino-compatible API",
    "autocomplete": [
        // GPIO
        {"label": "pinMode", "kind": "Function", "insertText": "pinMode(${1:pin}, ${2:mode})", "documentation": "Configure pin mode"},
        {"label": "digitalWrite", "kind": "Function", "insertText": "digitalWrite(${1:pin}, ${2:value})", "documentation": "Write digital value"},
        {"label": "digitalRead", "kind": "Function", "insertText": "digitalRead(${1:pin})", "documentation": "Read digital value"},
        {"label": "analogRead", "kind": "Function", "insertText": "analogRead(${1:pin})", "documentation": "Read analog value (0-4095)"},
        {"label": "analogWrite", "kind": "Function", "insertText": "analogWrite(${1:pin}, ${2:value})", "documentation": "PWM output (0-255)"},

        // Time
        {"label": "delay", "kind": "Function", "insertText": "delay(${1:ms})", "documentation": "Delay in milliseconds"},
        {"label": "millis", "kind": "Function", "insertText": "millis()", "documentation": "Get milliseconds since boot"},
        {"label": "micros", "kind": "Function", "insertText": "micros()", "documentation": "Get microseconds since boot"},

        // Math
        {"label": "map", "kind": "Function", "insertText": "map(${1:value}, ${2:fromLow}, ${3:fromHigh}, ${4:toLow}, ${5:toHigh})", "documentation": "Map value to range"},
        {"label": "constrain", "kind": "Function", "insertText": "constrain(${1:value}, ${2:min}, ${3:max})", "documentation": "Constrain value"},
        {"label": "random", "kind": "Function", "insertText": "random(${1:max})", "documentation": "Random number"},

        // Print
        {"label": "print", "kind": "Function", "insertText": "print(${1:message})", "documentation": "Print to console"},

        // Constants
        {"label": "OUTPUT", "kind": "Constant", "insertText": "OUTPUT", "documentation": "Pin mode: OUTPUT"},
        {"label": "INPUT", "kind": "Constant", "insertText": "INPUT", "documentation": "Pin mode: INPUT"},
        {"label": "INPUT_PULLUP", "kind": "Constant", "insertText": "INPUT_PULLUP", "documentation": "Pin mode: INPUT with pullup"},
        {"label": "HIGH", "kind": "Constant", "insertText": "HIGH", "documentation": "Digital HIGH (1)"},
        {"label": "LOW", "kind": "Constant", "insertText": "LOW", "documentation": "Digital LOW (0)"}
    ],
    "apiDocs": "# ESP32 Basic API\n\n## GPIO Functions\n\n### pinMode(pin, mode)\nConfigure pin mode...\n\n(Full markdown documentation)"
}
```

### Example Project (default-data/example-project.json)
```json
{
    "name": "Blink Example",
    "productId": "esp32-basic",
    "files": [
        {
            "name": "main.lua",
            "content": "-- LED Blink Example\nlocal pin = 2\n\npinMode(pin, OUTPUT)\n\nfor i=1,10 do\n  print('Blink ' .. i)\n  digitalWrite(pin, HIGH)\n  delay(500)\n  digitalWrite(pin, LOW)\n  delay(500)\nend\n\nprint('Done!')"
        }
    ]
}
```

---

## 🎨 Color Scheme (VS Code Dark Theme)

```css
:root {
    /* Backgrounds */
    --vscode-bg-dark: #1e1e1e;           /* Editor background */
    --vscode-bg-sidebar: #252526;         /* Sidebar background */
    --vscode-bg-lighter: #2d2d30;         /* Panel headers */
    --vscode-bg-input: #3c3c3c;           /* Input fields */
    --vscode-bg-hover: #2a2d2e;           /* Hover states */

    /* Text */
    --vscode-text-primary: #cccccc;       /* Main text */
    --vscode-text-secondary: #969696;     /* Secondary text */
    --vscode-text-disabled: #656565;      /* Disabled text */

    /* Accents */
    --vscode-accent: #007acc;             /* Primary accent (blue) */
    --vscode-accent-hover: #005a9e;       /* Hover state */
    --vscode-success: #89d185;            /* Success (green) */
    --vscode-error: #f48771;              /* Error (red) */
    --vscode-warning: #dcdcaa;            /* Warning (yellow) */

    /* Borders */
    --vscode-border: #3e3e42;             /* Panel borders */
    --vscode-border-light: #454545;       /* Lighter borders */

    /* Activity Bar */
    --vscode-activitybar-bg: #333333;
    --vscode-activitybar-active: #007acc;
}
```

---

## ⌨️ Keyboard Shortcuts

### Global
- `Ctrl+S`: Save current file
- `Ctrl+Shift+S`: Save all files
- `Ctrl+N`: New file in active project
- `Ctrl+Shift+N`: New project
- `Ctrl+W`: Close active tab
- `Ctrl+Shift+W`: Close all tabs
- `Ctrl+Tab`: Next tab
- `Ctrl+Shift+Tab`: Previous tab

### Editor
- `Ctrl+F`: Find
- `Ctrl+H`: Replace
- `Ctrl+/`: Toggle comment
- `Ctrl+Space`: Trigger autocomplete
- `Tab`: Indent
- `Shift+Tab`: Outdent

### Execution
- `Ctrl+Enter`: Execute active file
- `Ctrl+Shift+Enter`: Execute all project files
- `Ctrl+Shift+S`: Stop execution

### Panels
- `Ctrl+B`: Toggle sidebar
- `Ctrl+J`: Toggle console
- `Ctrl+\`: Toggle API docs
- `` Ctrl+` ``: Focus console

---

## ✅ Ready to Implement!

All requirements documented. Ready to start Phase 1: Core Foundation.

**Next Steps:**
1. Create `storage.js` with complete API
2. Create `app.js` with initialization
3. Build HTML structure
4. Basic CSS styling
5. Test storage operations

Do you want me to start implementing Phase 1?
