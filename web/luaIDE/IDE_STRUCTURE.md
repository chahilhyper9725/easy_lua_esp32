# Lua IDE - Complete Structure & Workflow

## 📁 Directory Structure

```
web/luaIDE/
│
├── index.html                      # Main IDE interface
├── styles.css                      # Complete IDE styling
│
├── js/
│   ├── app.js                      # Main application controller & initialization
│   ├── storage.js                  # LocalStorage API implementation
│   ├── editor-manager.js           # Monaco editor setup & tab management
│   ├── ble-handler.js              # BLE communication + event_msg.js integration
│   ├── ui-manager.js               # UI state, panels, modals
│   ├── product-manager.js          # Product CRUD & switching
│   ├── project-manager.js          # Project & file CRUD
│   └── import-export.js            # Import/export utilities
│
├── lib/
│   └── event_msg.js                # Event messaging protocol (copied from eventstudio)
│
├── default-data/
│   ├── esp32-basic.json            # Default ESP32 product definition
│   ├── m5stack-core2.json          # M5Stack Core2 product
│   └── example-project.json        # Example project with multiple files
│
└── assets/
    └── icons/                      # UI icons if needed
```

---

## 🎨 UI Components Breakdown

### 1. Toolbar (Top Bar)
```html
┌─────────────────────────────────────────────────────────────────────────┐
│ 🔷 Lua IDE                                                               │
│                                                                          │
│ [Product: ESP32 Basic ▼] [Project: LED Blink ▼]                        │
│                                                                          │
│ [🔌 Connect] [▶ Execute] [⏹ Stop]  [⚙ Settings] [💾 Backup]           │
└─────────────────────────────────────────────────────────────────────────┘
```

**Features:**
- Product dropdown (switch between hardware configs)
- Project dropdown (quick project switching)
- BLE connection controls
- Execute/stop buttons
- Settings modal trigger
- Backup/restore trigger

---

### 2. Left Sidebar (File Explorer)
```html
┌──────────────────────────┐
│  FILE EXPLORER           │
│  ─────────────────────── │
│                          │
│  📁 PROJECTS             │
│    ├─ 📂 LED Blink      │
│    │   ├─ 📄 main.lua   │ ← Active
│    │   └─ 📄 utils.lua  │
│    ├─ 📂 Robot Arm      │
│    │   ├─ 📄 main.lua   │
│    │   ├─ 📄 motors.lua │
│    │   └─ 📄 sensors.lua│
│    └─ 📂 Sensor Logger  │
│        └─ 📄 main.lua   │
│                          │
│  [➕ New Project]        │
│  [📥 Import]             │
│  [📤 Export]             │
│                          │
│  ──────────────────────  │
│                          │
│  🔷 PRODUCTS             │
│    ├─ ESP32 Basic       │ ← Active
│    ├─ M5Stack Core2     │
│    └─ Custom Board      │
│                          │
│  [➕ New Product]        │
│  [📥 Import]             │
│  [📤 Export]             │
│                          │
│  [⚙️] Explorer Settings │
└──────────────────────────┘
```

**Features:**
- Collapsible project tree
- Right-click context menus
- Drag-and-drop file ordering (future)
- Visual indicators (active file, unsaved changes)
- Quick actions buttons

**Context Menu Actions:**
- **Project**: Rename, Export, Delete, New File
- **File**: Rename, Delete, Duplicate

---

### 3. Center Panel (Editor Area)
```html
┌──────────────────────────────────────────────────────────┐
│  TABS                                       [⚙️ Editor]  │
│  ────────────────────────────────────────────────────    │
│  [main.lua ×] [utils.lua ×] [+]                          │
│  ──────────────────────────────────────────────────────  │
│                                                           │
│  Monaco Editor Area                                      │
│                                                           │
│  1  -- LED Blink Example                                 │
│  2  local pin = 2                                        │
│  3                                                        │
│  4  function setup()                                     │
│  5      pinMode(pin, OUTPUT)   ← Autocomplete shown     │
│  6  end                                                   │
│  7                                                        │
│  8  function loop()                                      │
│  9      digitalWrite(pin, HIGH)                          │
│ 10      delay(1000)                                      │
│ 11      digitalWrite(pin, LOW)                           │
│ 12      delay(1000)                                      │
│ 13  end                                                   │
│                                                           │
│                                                           │
│                                                           │
└──────────────────────────────────────────────────────────┘
```

**Features:**
- Multi-tab interface (like browser tabs)
- Tab close buttons (×)
- New file button (+)
- Monaco editor with full features:
  - Syntax highlighting
  - Line numbers
  - Minimap
  - Find/replace
  - Multi-cursor
  - Auto-indent
- Product-aware autocomplete
- Unsaved indicator (dot on tab)

**Keyboard Shortcuts:**
- `Ctrl+S`: Save current file
- `Ctrl+Enter`: Execute current file
- `Ctrl+Shift+Enter`: Execute all project files
- `Ctrl+Shift+S`: Stop execution
- `Ctrl+W`: Close tab
- `Ctrl+Tab`: Switch tabs

---

### 4. Right Sidebar (API Documentation)
```html
┌───────────────────────────────┐
│  API DOCUMENTATION            │
│  ──────────────────────────── │
│                               │
│  [🔍 Search API...]           │
│                               │
│  ───────────────────────────  │
│                               │
│  # GPIO Functions             │
│                               │
│  ## pinMode(pin, mode)        │
│  Configure pin as input or    │
│  output.                      │
│                               │
│  **Parameters:**              │
│  - pin: Pin number (0-39)     │
│  - mode: INPUT, OUTPUT,       │
│           INPUT_PULLUP        │
│                               │
│  **Example:**                 │
│  ```lua                       │
│  pinMode(2, OUTPUT)           │
│  ```                          │
│                               │
│  ───────────────────────────  │
│                               │
│  ## digitalWrite(pin, value)  │
│  Set pin HIGH or LOW.         │
│  ...                          │
│                               │
│  [Collapse Panel ◀]           │
└───────────────────────────────┘
```

**Features:**
- Product-specific documentation
- Markdown rendering
- Search functionality
- Syntax-highlighted code examples
- Collapsible sections
- Resizable width
- Can hide/show panel

---

### 5. Bottom Panel (Debug Console)
```html
┌──────────────────────────────────────────────────────────────────────┐
│  DEBUG CONSOLE                   [📋 Copy] [🗑️ Clear] [⚙️ Settings] │
│  ─────────────────────────────────────────────────────────────────── │
│                                                                       │
│  [10:23:45] 🟢 Connected to ESP32                                    │
│  [10:23:50] 📤 Executing: main.lua                                   │
│  [10:23:51] 📥 Hello from Lua!                                       │
│  [10:23:52] 📥 Pin 2 initialized                                     │
│  [10:23:53] 📥 Starting blink loop...                                │
│  [10:24:01] ⚠️  Execution stopped by user                            │
│                                                                       │
│  [Collapse Console ▼]                                                │
└──────────────────────────────────────────────────────────────────────┘
```

**Features:**
- Color-coded messages:
  - 🟢 Connection status
  - 📤 Sent events
  - 📥 Received messages (lua_print)
  - ❌ Errors (lua_error)
  - ⚠️ Warnings
- Timestamps (toggleable)
- Auto-scroll to bottom
- Copy all content
- Clear button
- Auto-clear on execute (toggleable)
- Resizable height
- Collapsible panel

---

### 6. Status Bar (Bottom)
```html
┌────────────────────────────────────────────────────────────────────────┐
│ 🟢 ESP32 Connected  |  Line 10, Col 5  |  Lua  |  main.lua  |  UTF-8  │
└────────────────────────────────────────────────────────────────────────┘
```

**Features:**
- Connection status indicator
- Cursor position
- Current file name
- Language mode
- File encoding

---

## 🔄 User Workflows

### Workflow 1: Creating New Project from Scratch

```mermaid
User opens IDE
    ↓
Clicks [New Project]
    ↓
Modal appears: Enter project name
    ↓
User enters "My Robot"
    ↓
Modal: Select product → "ESP32 Basic"
    ↓
Project created with main.lua
    ↓
Editor opens main.lua
    ↓
User starts coding
```

### Workflow 2: Adding Files to Project

```mermaid
Right-click project in sidebar
    ↓
Select "New File"
    ↓
Modal: Enter filename
    ↓
User enters "motors" (auto-appends .lua)
    ↓
New tab opens: motors.lua
    ↓
User writes code
    ↓
Auto-saved to localStorage
```

### Workflow 3: Switching Products

```mermaid
User has ESP32 Basic project
    ↓
Needs M5Stack functions
    ↓
Clicks product dropdown
    ↓
Selects "M5Stack Core2"
    ↓
Autocomplete updates with M5Stack API
    ↓
API docs update with M5Stack docs
    ↓
User continues coding with new API
```

### Workflow 4: Executing Code

```mermaid
User writes Lua code
    ↓
Clicks [Connect] → Connects to ESP32
    ↓
Clicks [Execute] (or Ctrl+Enter)
    ↓
Active file content sent via lua_execute event
    ↓
Console shows: "Executing: main.lua"
    ↓
ESP32 executes code
    ↓
print() statements appear in console (lua_print events)
    ↓
If error: Red error message shown (lua_error event)
    ↓
When done: "Execution finished" (lua_stop event)
```

### Workflow 5: Exporting & Sharing Project

```mermaid
User completes project
    ↓
Right-clicks project in sidebar
    ↓
Clicks "Export Project"
    ↓
JSON file downloads: "My Robot.json"
    ↓
User shares file with classmate
    ↓
Classmate opens IDE → [Import]
    ↓
Selects "My Robot.json"
    ↓
Project imported with all files
    ↓
Classmate can now run the project
```

---

## 🎯 Feature Priority Matrix

### Must Have (Phase 1)
- ✅ Monaco editor integration
- ✅ LocalStorage API (complete implementation)
- ✅ Product management (CRUD)
- ✅ Project management (CRUD)
- ✅ File management (multi-file, tabs)
- ✅ Basic UI layout (3-panel)
- ✅ BLE connection
- ✅ Execute/stop code
- ✅ Console output

### Should Have (Phase 2)
- ✅ Product-aware autocomplete
- ✅ API documentation panel
- ✅ Import/export (projects & products)
- ✅ Full backup/restore
- ✅ Keyboard shortcuts
- ✅ Settings modal
- ✅ Context menus
- ✅ File tree with icons

### Nice to Have (Phase 3)
- Syntax error checking
- Code snippets library
- Themes (light/dark toggle)
- Font size adjustment
- Layout presets
- Recent files list
- Search across all files
- Git-like diff viewer

---

## 📊 State Management

### Global State Object

```javascript
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
    settings: storage.settings.get()
};
```

### State Updates Trigger

```javascript
// When state changes:
updateState({
    activeFileId: 'new-file-id'
});

// → Triggers:
// - Update active tab UI
// - Switch editor content
// - Update status bar
// - Save to localStorage
```

---

## 🔌 Event System

### Custom Events

```javascript
// App emits custom events for loose coupling

document.dispatchEvent(new CustomEvent('product:changed', {
    detail: { productId }
}));

document.dispatchEvent(new CustomEvent('project:changed', {
    detail: { projectId }
}));

document.dispatchEvent(new CustomEvent('file:changed', {
    detail: { projectId, fileId }
}));

// Components listen and react
document.addEventListener('product:changed', (e) => {
    updateAutocomplete(e.detail.productId);
    updateApiDocs(e.detail.productId);
});
```

---

## 🎨 Theming

### CSS Variables

```css
:root {
    /* Colors */
    --bg-primary: #1e1e1e;
    --bg-secondary: #252526;
    --bg-tertiary: #2d2d2d;
    --text-primary: #d4d4d4;
    --text-secondary: #888;
    --accent: #007acc;
    --success: #4CAF50;
    --error: #F44336;
    --warning: #FFA500;

    /* Layout */
    --toolbar-height: 50px;
    --statusbar-height: 24px;
    --sidebar-width: 250px;
    --apidocs-width: 300px;
    --console-height: 200px;

    /* Typography */
    --font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
    --font-mono: 'Consolas', 'Monaco', monospace;
    --font-size: 14px;
}
```

---

## 📈 Performance Optimization

### Lazy Loading
- Load project files on-demand
- Initialize Monaco editor only when needed
- Load API docs when panel opened

### Debouncing
- Auto-save: 500ms debounce
- Search: 300ms debounce
- Resize panels: 100ms throttle

### Memory Management
- Dispose unused Monaco editor instances
- Clear BLE buffers after processing
- Limit console history (last 1000 lines)

---

## ✅ Testing Strategy

### Manual Testing Checklist
- [ ] Create product
- [ ] Create project
- [ ] Add multiple files
- [ ] Switch between files (tabs)
- [ ] Execute code via BLE
- [ ] Receive console output
- [ ] Handle errors
- [ ] Export/import project
- [ ] Export/import product
- [ ] Full backup/restore
- [ ] Switch products (autocomplete updates)
- [ ] Search API docs
- [ ] Resize panels
- [ ] Collapse/expand panels
- [ ] Keyboard shortcuts work
- [ ] Unsaved changes indicator
- [ ] localStorage persistence

---

This structure provides a solid, scalable foundation for a professional Lua IDE!
