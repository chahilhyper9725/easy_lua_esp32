# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Easy_Lua is a PlatformIO-based embedded project that integrates Lua scripting into an M5Stack Core2 device (ESP32-based). The project embeds a Lua interpreter allowing dynamic script execution on the microcontroller.

## Build and Development Commands

This is a PlatformIO project. Key commands:

- **Build**: `pio run` or `platformio run`
- **Upload to device**: `pio run --target upload`
- **Clean build**: `pio run --target clean`
- **Monitor serial output**: `pio device monitor` or `pio run --target monitor`
- **Build and upload**: `pio run --target upload --target monitor`

## Architecture

### Hardware Target
- **Board**: M5Stack Core2 (ESP32-based)
- **Framework**: Arduino
- **Platform**: Espressif32

### Lua Integration
The project uses the arduino-lua library (https://github.com/mischief/arduino-lua.git) to embed a Lua 5.x interpreter.

**Key implementation details**:
- Global Lua state (`L`) is initialized in `setup()` and persists throughout runtime
- Lua VM includes a debug hook (`debug_hook`) that calls `yield()` every 50,000 instructions to prevent ESP32 watchdog timer resets during long-running Lua scripts
- Custom Lua functions are registered as globals (e.g., `millis()` exposes Arduino's `millis()` to Lua)
- Standard Lua libraries are loaded via `luaL_openlibs()`

### Code Structure
- **src/main.cpp**: Main application entry point with Arduino setup()/loop() and Lua VM initialization
- **include/**: Project header files (currently empty but intended for custom headers)
- **lib/**: Custom libraries for the project
- **test/**: Test files

### Adding Custom Lua Functions
To expose Arduino/ESP32 functions to Lua:
1. Create a static C function with signature `int function_name(lua_State *L)`
2. Use Lua C API to get arguments from stack and push return values
3. Register in `setup()` using `lua_register(L, "lua_name", c_function_name)`

Example from main.cpp:
```cpp
static int lua_millis(lua_State *L) {
    lua_pushinteger(L, millis());
    return 1;
}
// In setup():
lua_register(L, "millis", lua_millis);
```

## Important Constraints

- **Watchdog timer**: The ESP32 watchdog will reset the device if code blocks for too long. The Lua debug hook mitigates this for Lua code, but C++ code must call `yield()` or `delay()` periodically in tight loops
- **Memory**: ESP32 has limited RAM (~520KB total, less available). Large Lua scripts or memory allocations may cause crashes
- **Serial communication**: Runs at 115200 baud (configured in setup())

## Web-Based Lua IDE

The project includes a browser-based IDE for writing, managing, and executing Lua scripts on the ESP32 via Bluetooth Low Energy (BLE).

### Overview

The IDE is located in `web/luaIDE/` and provides:
- **VS Code-like interface** with Monaco editor (same engine as VS Code)
- **Multi-file project management** with tab-based editing
- **Product system** for different hardware configurations (ESP32, M5Stack Core2, custom boards)
- **Web Bluetooth integration** for wireless code execution
- **Offline-first design** using browser localStorage (no server required)
- **Import/export** for projects, products, and full IDE backups

### Architecture

#### Core Concepts

1. **Products**: Hardware configurations with specific APIs
   - Each product has unique autocomplete definitions
   - Product-specific API documentation
   - Examples: "ESP32 Basic", "M5Stack Core2"
   - Stored in localStorage with JSON-based autocomplete definitions

2. **Projects**: Collections of Lua files for specific applications
   - Linked to a specific product
   - Multi-file support with tab-based editor
   - Examples: "LED Blink", "Robot Controller"
   - Each project can have multiple .lua files

3. **Files**: Individual Lua scripts within a project
   - All files must have .lua extension
   - Content auto-saved to localStorage
   - Supports create, rename, delete operations

#### File Structure

```
web/luaIDE/
├── index.html                      # Main IDE interface
├── styles.css                      # VS Code-inspired styling
│
├── js/
│   ├── app.js                      # Main application controller
│   ├── storage.js                  # LocalStorage API (products/projects/settings)
│   ├── editor-manager.js           # Monaco editor & tab management
│   ├── ble-handler.js              # Web Bluetooth + event_msg protocol
│   ├── console-manager.js          # Debug console output
│   ├── resize-manager.js           # Resizable panels
│   ├── event_msg.js                # Event messaging protocol
│   ├── notification-manager.js     # User notifications
│   ├── import-export.js            # Import/export utilities
│   ├── settings-manager.js         # IDE settings
│   └── context-menu.js             # Context menu system
│
├── default-data/
│   └── esp32-basic.json            # Default ESP32 product definition
│
└── REQUIREMENTS.md                 # Detailed requirements
    STORAGE_ARCHITECTURE.md         # Storage system documentation
    IDE_STRUCTURE.md                # UI structure & workflows
    IMPLEMENTATION_PLAN.md          # Implementation phases & status
```

### BLE Communication Protocol

The IDE communicates with the ESP32 using the `event_msg.js` protocol over Nordic UART Service (NUS):

**Sent Events (IDE → ESP32):**
- `lua_execute`: Send Lua code to execute
  - Payload: `{ code: "lua script content" }`
  - Large scripts are chunked (480 bytes per chunk)

- `lua_stop`: Request to stop execution

**Received Events (ESP32 → IDE):**
- `lua_print`: Standard output from Lua `print()` statements
  - Displayed in debug console with timestamps

- `lua_error`: Lua runtime errors
  - Displayed in console with red color coding

- `lua_stop`: Execution completed or stopped
  - Updates execution status

**BLE Connection:**
- Uses Web Bluetooth API (Chrome/Edge only)
- Nordic UART Service UUIDs:
  - Service: `6E400001-B5A3-F393-E0A9-E50E24DCCA9E`
  - RX Characteristic: `6E400002-B5A3-F393-E0A9-E50E24DCCA9E`
  - TX Characteristic: `6E400003-B5A3-F393-E0A9-E50E24DCCA9E`

### Storage Architecture

All data stored in browser localStorage:

```javascript
IDE_SETTINGS              // Global IDE settings (theme, font size, etc.)
PRODUCTS_INDEX            // Array of product IDs
PRODUCT_{uuid}            // Individual product data
PROJECTS_INDEX            // Array of project IDs
PROJECT_{uuid}            // Individual project data with files
```

**Key APIs:**
- `storage.products.create/getAll/getById/update/delete`
- `storage.projects.create/getAll/getById/update/delete`
- `storage.projects.addFile/updateFile/deleteFile/renameFile`
- `storage.settings.get/set/update`
- `storage.backup.export/import/clear`

### Development Workflow

**Typical user workflow:**
1. Open IDE in browser (web/luaIDE/index.html)
2. Create or select a project
3. Write Lua code in Monaco editor
4. Click "Connect" to establish BLE connection
5. Click "Execute" (or Ctrl+Enter) to run code on ESP32
6. View output in debug console
7. Export project for backup/sharing

**Working with the IDE:**
- The IDE is a static web application (no build step required)
- Simply open `index.html` in Chrome or Edge
- All changes auto-save to localStorage
- Use import/export for backups

### Implementation Status

**Completed (Phase 1-5):**
- ✅ Complete storage system with localStorage
- ✅ Monaco editor integration with Lua syntax highlighting
- ✅ Multi-tab file editing
- ✅ Product/Project/File management (CRUD operations)
- ✅ VS Code-style UI with resizable panels
- ✅ BLE communication via Web Bluetooth
- ✅ Debug console with color-coded output
- ✅ Product-aware autocomplete
- ✅ API documentation panel
- ✅ Keyboard shortcuts (Ctrl+Enter to execute, etc.)

**In Progress (Phase 6-7):**
- 🔄 Import/Export system for projects and products
- 🔄 Settings modal
- 🔄 Enhanced UI polish and error handling

### Adding New Product Definitions

To add a new hardware product:

1. Create a JSON file in `web/luaIDE/default-data/`
2. Define autocomplete items and API documentation:
```json
{
    "name": "Custom Board",
    "description": "My custom ESP32 board",
    "autocomplete": [
        {
            "label": "customFunction",
            "kind": "Function",
            "insertText": "customFunction(${1:param})",
            "documentation": "Description of function"
        }
    ],
    "apiDocs": "# Custom Board API\n\n## Functions\n..."
}
```
3. Import via IDE or load programmatically in `app.js`

### Testing the IDE

**Requirements:**
- Chrome or Edge browser (for Web Bluetooth support)
- ESP32 running with BLE enabled
- Nordic UART Service (NUS) implemented on ESP32

**Quick test:**
1. Open `web/luaIDE/index.html` in Chrome
2. Click "Connect" and select your ESP32 device
3. Type `print("Hello from Lua!")` in the editor
4. Press Ctrl+Enter or click "Execute"
5. See output in debug console
