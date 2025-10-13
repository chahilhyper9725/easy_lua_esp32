# Lua IDE Requirements & Architecture

## 🎯 Core Concepts

### 1. **Products**
A **Product** represents a specific hardware/device configuration with its own API.

**Properties:**
- Product ID (unique)
- Product Name (e.g., "ESP32 Basic", "M5Stack Core2", "Custom Board")
- Autocomplete Definitions (JSON)
- API Documentation (Markdown/HTML)
- Description
- Created/Modified timestamps

**Use Cases:**
- Switch between different ESP32 boards
- Each board has different available functions
- Import/export product configurations
- Share product definitions with team

### 2. **Projects**
A **Project** is a collection of Lua files for a specific application.

**Properties:**
- Project ID (unique)
- Project Name (e.g., "LED Controller", "Robot Arm", "Sensor Logger")
- Associated Product ID
- Files (array of file objects)
- Active File ID (currently open)
- Created/Modified timestamps

**File Object:**
- File ID (unique within project)
- File Name (e.g., "main.lua", "utils.lua", "config.lua")
- Content (Lua code)
- Created/Modified timestamps

**Use Cases:**
- Organize related code files
- Switch between projects quickly
- Export entire project for backup/sharing
- Import projects from others

### 3. **IDE Settings**
Global IDE configuration.

**Properties:**
- Theme (dark/light)
- Font size
- Editor preferences (minimap, line numbers, etc.)
- Last active project ID
- Last active product ID
- Console settings (timestamp, auto-clear)
- Layout preferences (panel sizes)

---

## 📦 Storage Architecture

### LocalStorage Structure

```javascript
// ═══════════════════════════════════════════════════════════
// STORAGE KEYS
// ═══════════════════════════════════════════════════════════

IDE_SETTINGS = {
    version: "1.0.0",
    theme: "dark",
    fontSize: 14,
    lastActiveProjectId: "uuid-123",
    lastActiveProductId: "uuid-456",
    consoleSettings: {
        timestamp: true,
        autoClear: false
    },
    editorSettings: {
        minimap: true,
        lineNumbers: true
    }
}

// ─────────────────────────────────────────────────────────────
// PRODUCTS
// ─────────────────────────────────────────────────────────────

PRODUCTS_INDEX = [
    "product-uuid-1",
    "product-uuid-2",
    "product-uuid-3"
]

PRODUCT_{uuid} = {
    id: "product-uuid-1",
    name: "ESP32 Basic",
    description: "Standard ESP32 with Arduino functions",
    createdAt: "2024-01-01T00:00:00Z",
    modifiedAt: "2024-01-01T00:00:00Z",
    autocomplete: [
        {
            label: "pinMode",
            kind: "Function",
            insertText: "pinMode(${1:pin}, ${2:mode})",
            documentation: "Sets pin mode"
        },
        // ... more autocomplete definitions
    ],
    apiDocs: `
# ESP32 Basic API

## GPIO Functions

### pinMode(pin, mode)
...
    `
}

// ─────────────────────────────────────────────────────────────
// PROJECTS
// ─────────────────────────────────────────────────────────────

PROJECTS_INDEX = [
    "project-uuid-1",
    "project-uuid-2",
    "project-uuid-3"
]

PROJECT_{uuid} = {
    id: "project-uuid-1",
    name: "LED Blink",
    productId: "product-uuid-1",
    activeFileId: "file-uuid-1",
    createdAt: "2024-01-01T00:00:00Z",
    modifiedAt: "2024-01-01T00:00:00Z",
    files: [
        {
            id: "file-uuid-1",
            name: "main.lua",
            content: "-- Blink LED\nprint('Hello')",
            createdAt: "2024-01-01T00:00:00Z",
            modifiedAt: "2024-01-01T00:00:00Z"
        },
        {
            id: "file-uuid-2",
            name: "utils.lua",
            content: "-- Utility functions",
            createdAt: "2024-01-01T00:00:00Z",
            modifiedAt: "2024-01-01T00:00:00Z"
        }
    ]
}
```

### Storage Manager API

```javascript
// ═══════════════════════════════════════════════════════════
// SETTINGS
// ═══════════════════════════════════════════════════════════
storage.settings.get()
storage.settings.set(settings)

// ═══════════════════════════════════════════════════════════
// PRODUCTS
// ═══════════════════════════════════════════════════════════
storage.products.getAll()              // Returns array of products
storage.products.getById(id)           // Returns single product
storage.products.create(product)       // Creates new product
storage.products.update(id, product)   // Updates product
storage.products.delete(id)            // Deletes product
storage.products.export(id)            // Returns JSON string
storage.products.import(jsonString)    // Imports product

// ═══════════════════════════════════════════════════════════
// PROJECTS
// ═══════════════════════════════════════════════════════════
storage.projects.getAll()              // Returns array of projects
storage.projects.getById(id)           // Returns single project
storage.projects.create(project)       // Creates new project
storage.projects.update(id, project)   // Updates project
storage.projects.delete(id)            // Deletes project
storage.projects.export(id)            // Returns JSON string
storage.projects.import(jsonString)    // Imports project

// ─────────────────────────────────────────────────────────────
// FILE OPERATIONS WITHIN PROJECT
// ─────────────────────────────────────────────────────────────
storage.projects.addFile(projectId, file)
storage.projects.updateFile(projectId, fileId, content)
storage.projects.deleteFile(projectId, fileId)
storage.projects.renameFile(projectId, fileId, newName)
storage.projects.getFile(projectId, fileId)

// ═══════════════════════════════════════════════════════════
// FULL BACKUP
// ═══════════════════════════════════════════════════════════
storage.backup.export()                // Exports everything as JSON
storage.backup.import(jsonString)      // Imports full backup
storage.backup.clear()                 // Clears all IDE data
```

---

## 🎨 UI Layout

```
┌─────────────────────────────────────────────────────────────────┐
│ TOOLBAR                                                          │
│ [Product: ESP32 ▼] [Project: LED Blink ▼] [🔌 Connect] [▶ Run] │
└─────────────────────────────────────────────────────────────────┘
┌──────────┬────────────────────────────────────┬─────────────────┐
│          │ TABS                               │                 │
│ FILE     │ [main.lua] [utils.lua] [+]        │   API DOCS      │
│ EXPLORER │────────────────────────────────────│                 │
│          │                                    │   Searchable    │
│ Projects │        MONACO EDITOR               │   Context-aware │
│  ├─ LED  │                                    │                 │
│  │  main │        Code here...                │   Based on      │
│  │  utils│                                    │   selected      │
│  ├─ Robot│                                    │   product       │
│          │                                    │                 │
│ Products │                                    │                 │
│  ├─ ESP32│                                    │                 │
│  ├─ M5St │                                    │                 │
│          │                                    │                 │
│ [+] New  │                                    │                 │
│ [↑] Imp  │                                    │                 │
│ [↓] Exp  │                                    │                 │
└──────────┴────────────────────────────────────┴─────────────────┘
┌─────────────────────────────────────────────────────────────────┐
│ DEBUG CONSOLE                                  [📋] [🗑️] [⚙️]   │
│ [10:23:45] Connected to ESP32                                   │
│ [10:23:50] > Executing main.lua...                              │
│ [10:23:51] Hello from Lua!                                      │
└─────────────────────────────────────────────────────────────────┘
┌─────────────────────────────────────────────────────────────────┐
│ STATUS BAR                                                       │
│ 🟢 Connected | Line 10, Col 5 | Lua | main.lua                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## 📂 File Structure

```
web/luaIDE/
├── index.html                  # Main IDE UI
├── styles.css                  # Styling
│
├── js/
│   ├── app.js                  # Main application controller
│   ├── storage.js              # LocalStorage manager
│   ├── editor.js               # Monaco editor setup
│   ├── ble-handler.js          # BLE + event_msg integration
│   ├── ui-manager.js           # UI state and interactions
│   ├── product-manager.js      # Product operations
│   ├── project-manager.js      # Project & file operations
│   └── import-export.js        # Import/export utilities
│
├── lib/
│   └── event_msg.js            # Event messaging protocol (copy from eventstudio)
│
└── default-data/
    ├── esp32-basic.json        # Default ESP32 product
    └── example-project.json    # Example project
```

---

## 🔄 Import/Export Formats

### Product Export Format
```json
{
    "type": "LuaIDE_Product",
    "version": "1.0.0",
    "data": {
        "id": "product-uuid-1",
        "name": "ESP32 Basic",
        "description": "...",
        "autocomplete": [...],
        "apiDocs": "..."
    }
}
```

### Project Export Format
```json
{
    "type": "LuaIDE_Project",
    "version": "1.0.0",
    "data": {
        "id": "project-uuid-1",
        "name": "LED Blink",
        "productId": "product-uuid-1",
        "files": [...]
    }
}
```

### Full Backup Format
```json
{
    "type": "LuaIDE_Backup",
    "version": "1.0.0",
    "exportedAt": "2024-01-01T00:00:00Z",
    "data": {
        "settings": {...},
        "products": [...],
        "projects": [...]
    }
}
```

---

## 🎯 Key Features

### Product Management
- ✅ Create/Edit/Delete products
- ✅ Switch between products (dropdown)
- ✅ Product-specific autocomplete
- ✅ Product-specific API docs
- ✅ Import/export individual products
- ✅ Default products included

### Project Management
- ✅ Create/Edit/Delete projects
- ✅ Multi-file support
- ✅ File tree in sidebar
- ✅ Quick project switching (dropdown)
- ✅ Import/export individual projects
- ✅ Link project to product

### Editor Features
- ✅ Monaco editor
- ✅ Multi-tab interface
- ✅ Lua syntax highlighting
- ✅ Smart autocomplete (product-aware)
- ✅ Keyboard shortcuts
- ✅ Auto-save

### BLE Communication
- ✅ event_msg.js protocol
- ✅ Send: lua_execute event
- ✅ Receive: lua_print, lua_error, lua_stop events
- ✅ Execute current file
- ✅ Execute all project files
- ✅ Stop execution

### Import/Export
- ✅ Export/import products (JSON)
- ✅ Export/import projects (JSON)
- ✅ Full IDE backup (all data)
- ✅ Restore from backup

### Offline First
- ✅ All data in localStorage
- ✅ No server required
- ✅ Works offline
- ✅ Portable (can move between browsers)

---

## 📝 User Workflows

### Creating a New Project
1. Click "New Project" button
2. Enter project name
3. Select product (ESP32, M5Stack, etc.)
4. IDE creates project with main.lua
5. Start coding

### Adding Files to Project
1. Right-click project in sidebar
2. Click "New File"
3. Enter filename (auto-append .lua)
4. File appears in tabs

### Switching Products
1. Select product from dropdown
2. Autocomplete updates
3. API docs update
4. Continue coding with new API

### Sharing a Project
1. Right-click project
2. Click "Export Project"
3. Downloads .json file
4. Share file with others
5. Others: Import → Select file

### Full Backup
1. Settings → Backup
2. Click "Export Full Backup"
3. Downloads complete IDE state
4. Import on another computer/browser

---

## 🔐 Data Validation

All imports must validate:
- File format (type field)
- Version compatibility
- Required fields present
- No ID conflicts (generate new UUIDs if needed)

---

## 🎨 Theme & Styling

- Dark theme by default (like VS Code)
- Consistent with Event Studio aesthetic
- Responsive panels (resizable)
- Collapsible sidebar sections
- Modern, clean interface

---

## 🚀 Implementation Priority

### Phase 1: Core Structure
1. Storage API
2. Product management
3. Project management
4. Basic editor

### Phase 2: UI
1. File explorer
2. Multi-tab editor
3. API docs panel
4. Debug console

### Phase 3: BLE
1. Event integration
2. Execute/stop
3. Console output

### Phase 4: Import/Export
1. Product import/export
2. Project import/export
3. Full backup

---

## 📊 Storage Limits

LocalStorage typically has 5-10MB limit per domain.

**Estimated Usage:**
- Settings: ~2KB
- Product (with autocomplete + docs): ~50KB each
- Project (10 files, avg 2KB/file): ~20KB
- Total for 10 products + 20 projects: ~900KB

✅ Well within limits for typical usage.
