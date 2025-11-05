# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Easy_Lua is a PlatformIO-based embedded project that integrates Lua scripting into an M5Stack Core2 device (ESP32-based). The system enables dynamic Lua script execution via BLE, using an event-driven architecture with RTOS task management.

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

### System Architecture

The project uses a modular, layered architecture:

#### Core Systems (src/core/)
1. **lua_engine.cpp/h**: Manages Lua VM lifecycle with RTOS task isolation
   - Runs Lua execution on dedicated RTOS task (Core 1, 8KB stack)
   - Fresh Lua state created for each execution (complete isolation between scripts)
   - Debug hook calls `yield()` every 10 lines to prevent watchdog resets
   - Module registration system for extending Lua API
   - Callbacks for error/stop events
   - Key functions: `lua_engine_init()`, `lua_engine_execute()`, `lua_engine_stop()`

2. **event_msg.cpp/h**: Binary-safe message framing protocol
   - Frame format: `[SOH][7-byte header][STX][event_name][US][event_data][EOT]` with byte stuffing
   - Control chars: SOH(0x01), STX(0x02), US(0x1F), EOT(0x04), ESC(0x1B)
   - 7-byte header structure (sent only, ignored on receive):
     * senderId (1 byte) = 1
     * receiverId (1 byte) = 0
     * senderGroupId (1 byte) = 0
     * receiverGroupId (1 byte) = 0
     * flags (1 byte) = 0
     * messageId (2 bytes, big-endian MSB first) - auto-increments per send
   - Event routing via registered handlers
   - Used for BLE communication between ESP32 and web IDE
   - Key functions: `event_msg_init()`, `event_msg_on()`, `event_msg_send()`, `event_msg_feed_bytes()`

#### Communication Layer (src/comms/)
- **ble_comm.cpp/h**: BLE UART service wrapper
  - Nordic UART Service (NUS) implementation
  - Device name: "ESP32_Lua"
  - Integrates with event_msg protocol
  - Key functions: `ble_comm_init()`, `ble_comm_send()`, `ble_comm_is_connected()`

#### Modules (src/modules/)
- **arduino_module.cpp/h**: Exposes Arduino API to Lua
  - Time: `millis()`, `micros()`, `delay()`, `delayMicroseconds()`
  - Digital I/O: `pinMode()`, `digitalWrite()`, `digitalRead()`
  - Analog I/O: `analogRead()`, `analogWrite()`
  - Math: `map()`, `constrain()`, `random()`, `randomSeed()`
  - Debug: `print()` (sends to BLE via event_msg)
  - Constants: `OUTPUT`, `INPUT`, `INPUT_PULLUP`, `HIGH`, `LOW`
  - Modules self-register via `lua_engine_add_module(arduino_module_register)`

#### System Initialization (src/system_init/)
- **system_init.cpp/h**: Orchestrates startup sequence
  - Serial (115200 baud) → Lua engine → BLE → Event system
  - Registers event handlers: `lua_execute`, `lua_stop`, `test`
  - Connects event_msg output to BLE transmission
  - Connects Lua callbacks (error/stop) to event_msg events

#### Utilities (src/utils/)
- **debug.cpp/h**: Logging macros (`LOG_INFO`, `LOG_DEBUG`, `LOG_ERROR`)

#### Main Entry (src/)
- **main.cpp**: Minimal Arduino entry point
  - Calls `system_init()` in `setup()`
  - Empty `loop()` (system runs on RTOS tasks)

### Communication Flow

```
Web IDE (BLE) → event_msg protocol → Event handlers → lua_engine_execute()
                                                     ↓
                                              Lua RTOS Task (Core 1)
                                                     ↓
                                          Arduino module functions
                                                     ↓
                                                print() calls
                                                     ↓
                                          event_msg_send("lua_print")
                                                     ↓
                                              BLE → Web IDE
```

### Event Protocol

**Incoming Events (BLE → ESP32):**
- `lua_execute`: Contains Lua code to execute (event_msg frame with code as payload)
- `lua_stop`: Request to stop current execution
- `test`: Debug/test event

**Outgoing Events (ESP32 → BLE):**
- `lua_print`: Output from Lua `print()` statements
- `lua_error`: Lua execution errors
- `lua_stop`: Execution completed or interrupted

### Adding Custom Lua Functions

To extend the Lua API:

1. **Create a module file** in `src/modules/` (e.g., `my_module.cpp`)
2. **Implement Lua C functions** with signature `int func(lua_State* L)`
3. **Create registration function**:
```cpp
void my_module_register(lua_State* L) {
    lua_register(L, "myFunction", lua_myFunction);
}
```
4. **Add module to system_init.cpp**:
```cpp
extern void my_module_register(lua_State* L);
// In system_init_lua():
lua_engine_add_module(my_module_register);
```

Modules are re-registered automatically before each script execution (Lua state is reset after every run).

### Important Constraints

- **RTOS task isolation**: Lua runs on Core 1 with 8KB stack; adjust stack size in `lua_engine.cpp:123` if needed
- **Watchdog timer**: Debug hook yields every 10 lines; avoid blocking operations in C++ code
- **Memory**: ESP32 has ~520KB RAM; large scripts may cause OOM crashes
- **Execution isolation**: Each script execution gets a fresh Lua state (no persistence between runs)
- **BLE MTU**: Event messages chunked to fit BLE packet size (typically 480 bytes)

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
