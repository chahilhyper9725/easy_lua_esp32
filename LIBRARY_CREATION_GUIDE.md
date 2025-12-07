# easy_lua_ble Library Creation Guide

## Overview

This guide explains how to convert the `easy_lua_esp32` monolithic project into a reusable PlatformIO/Arduino library.

---

## Step 1: Copy Source Files to Library

### Manual Copy Commands (Windows PowerShell)

Run these commands from the project root:

```powershell
# Navigate to project root
cd C:\Users\chahi\OneDrive\Documents\PlatformIO\Projects\easy_lua_esp32

# Copy core folder
xcopy /E /I /Y src\core lib\easy_lua_ble\src\core

# Copy lua_modules folder
xcopy /E /I /Y src\lua_modules lib\easy_lua_ble\src\lua_modules

# Copy system_init folder
xcopy /E /I /Y src\system_init lib\easy_lua_ble\src\system_init

# Copy lua library
xcopy /E /I /Y lib\lua lib\easy_lua_ble\lib\lua

# Copy lua_sys library
xcopy /E /I /Y lib\lua_sys lib\easy_lua_ble\lib\lua_sys
```

### Verify Copy

After copying, your library structure should look like:

```
lib/easy_lua_ble/
├── library.json                    ✅ Created
├── library.properties              ✅ Created
├── README.md                       ✅ Created
│
├── src/
│   ├── easy_lua_ble.h             ✅ Created (public API)
│   ├── easy_lua_ble.cpp           ✅ Created
│   │
│   ├── core/                       ⚠️ Needs manual copy
│   │   ├── comms/
│   │   ├── event_msg.*
│   │   ├── file_transfer.*
│   │   ├── lua_engine.*
│   │   └── utils/
│   │
│   ├── lua_modules/                ⚠️ Needs manual copy
│   │   ├── lua_arduino/
│   │   ├── lua_eventmsg/
│   │   └── lua_storage/
│   │
│   └── system_init/                ⚠️ Needs manual copy
│       ├── system_init.h
│       └── system_init.cpp
│
└── lib/
    ├── lua/                        ⚠️ Needs manual copy
    └── lua_sys/                    ⚠️ Needs manual copy
```

---

## Step 2: Update Project to Use Library

### Option A: Use new main_new.cpp

Replace `src/main.cpp` with `src/main_new.cpp`:

```powershell
# Backup old main
copy src\main.cpp src\main_old.cpp

# Use new main
copy src\main_new.cpp src\main.cpp
```

### Option B: Update existing main.cpp manually

Change the include:
```cpp
// Old:
#include "system_init/system_init.h"

// New:
#include <easy_lua_ble.h>
```

Change the init call:
```cpp
// Old:
system_init(my_hardware_init, my_lua_register, my_cleanup);

// New:
easy_lua_ble::init(my_hardware_init, my_lua_register, my_cleanup);
```

---

## Step 3: Clean Up Project Structure (Optional)

After the library is working, you can optionally remove the old `src/` folders:

```powershell
# Delete old folders (AFTER verifying library works!)
# rmdir /S /Q src\core
# rmdir /S /Q src\lua_modules
# rmdir /S /Q src\system_init
```

**Final structure:**
```
easy_lua_esp32/
├── lib/
│   └── easy_lua_ble/              # 📦 Complete library
│       ├── src/
│       │   ├── easy_lua_ble.h     # Public API
│       │   ├── core/
│       │   ├── lua_modules/
│       │   └── system_init/
│       └── lib/
│           ├── lua/
│           └── lua_sys/
│
├── src/
│   └── main.cpp                    # User application only!
│
└── platformio.ini
```

---

## Library Architecture

### Before (Monolithic):

```
User Code (main.cpp)
    ↓
Direct includes from src/
    ↓
src/core/, src/lua_modules/, src/system_init/
```

### After (Library):

```
User Code (main.cpp)
    ↓
#include <easy_lua_ble.h>  (Single public header)
    ↓
easy_lua_ble Class (Wrapper)
    ↓
Internal: system_init, core, lua_modules
```

---

## API Changes

### Old API (Direct system_init)

```cpp
#include "system_init/system_init.h"

void setup() {
    system_init(hw_init, lua_reg, cleanup);
}
```

### New API (Library)

```cpp
#include <easy_lua_ble.h>

void setup() {
    easy_lua_ble::init(hw_init, lua_reg, cleanup);
}
```

**Note:** For backward compatibility, `system_init()` macro still works:
```cpp
#define system_init(...) easy_lua_ble::init(__VA_ARGS__)
```

---

## Publishing the Library

### PlatformIO Registry

1. Create GitHub repository
2. Tag a release: `git tag v1.0.0`
3. Submit to PlatformIO registry

### Arduino Library Manager

1. Add `library.properties` (already created)
2. Create GitHub repository
3. Tag a release
4. Submit to Arduino Library Manager

### Local Installation

Users can install by copying the `lib/easy_lua_ble` folder to:
- PlatformIO: Project's `lib/` folder
- Arduino: `~/Documents/Arduino/libraries/`

---

## Testing the Library

### Test 1: Compile Check

```bash
pio run
```

Should compile without errors (after copying files).

### Test 2: Functionality Check

Upload to ESP32 and verify:
- ✅ Serial output shows system initialization
- ✅ BLE advertises as "ESP32_Lua"
- ✅ Connect via BLE and send Lua code
- ✅ Lua executes correctly

### Test 3: Library API Check

```cpp
#include <easy_lua_ble.h>

void setup() {
    // Test API methods
    Serial.println(easy_lua_ble::getVersion());
    easy_lua_ble::printSystemInfo();
}
```

---

## Troubleshooting

### Error: "easy_lua_ble.h: No such file or directory"

**Solution:** The library files weren't copied. Run the xcopy commands above.

### Error: "undefined reference to `system_init`"

**Solution:** The `src/` folders weren't copied to the library. Copy `src/system_init/`, `src/core/`, `src/lua_modules/`.

### Error: "undefined reference to `lua_*`"

**Solution:** The `lib/lua/` folder wasn't copied. Copy `lib/lua/` to `lib/easy_lua_ble/lib/lua/`.

### Compilation errors in library files

**Solution:** Make sure ALL files were copied, including subdirectories and header files.

---

## Benefits of Library Approach

### For Users

1. ✅ **Simple API** - Single `#include <easy_lua_ble.h>`
2. ✅ **Clean project** - Only `main.cpp` in user's `src/`
3. ✅ **Version control** - Library versioning via semantic versioning
4. ✅ **Easy updates** - Update library, not entire codebase
5. ✅ **Reusable** - Use in multiple projects

### For Developers

1. ✅ **Encapsulation** - Internal implementation hidden
2. ✅ **Modularity** - Core system separate from user code
3. ✅ **Maintainability** - Changes in one place
4. ✅ **Testing** - Can test library independently
5. ✅ **Distribution** - Publish to package managers

---

## Comparison with LuaBLE_OS (Helios51)

### Similarities

Both provide:
- ✅ Lua execution engine
- ✅ BLE communication
- ✅ Event messaging
- ✅ Callback-based user extension

### Differences

| Feature | easy_lua_ble | LuaBLE_OS |
|---------|--------------|-----------|
| **API Style** | Function callbacks | Config struct + static methods |
| **Lua Runtime** | Basic Lua 5.4 | LuatOS (advanced) |
| **Initialization** | `init(hw, lua, cleanup)` | `begin(config)` + setters |
| **Addressing** | None | Device/group addressing |
| **Complexity** | Simple | Advanced (multi-source) |

### When to Use Each

**Use easy_lua_ble when:**
- Simple projects
- Learning Lua on ESP32
- Direct callback pattern preferred
- Basic event messaging sufficient

**Use LuaBLE_OS when:**
- Production robot/product
- Need multi-device addressing
- Advanced RTOS features required
- Config-based initialization preferred

---

## Next Steps

After library is working:

1. ✅ Test thoroughly with example projects
2. ✅ Write comprehensive examples
3. ✅ Add API documentation
4. ✅ Create GitHub repository
5. ✅ Publish to PlatformIO registry
6. ✅ Submit to Arduino Library Manager
7. ✅ Add CI/CD for automated testing

---

## File Checklist

Library files created:
- [x] `lib/easy_lua_ble/library.json`
- [x] `lib/easy_lua_ble/library.properties`
- [x] `lib/easy_lua_ble/README.md`
- [x] `lib/easy_lua_ble/src/easy_lua_ble.h`
- [x] `lib/easy_lua_ble/src/easy_lua_ble.cpp`

Files to copy manually:
- [ ] `src/core/` → `lib/easy_lua_ble/src/core/`
- [ ] `src/lua_modules/` → `lib/easy_lua_ble/src/lua_modules/`
- [ ] `src/system_init/` → `lib/easy_lua_ble/src/system_init/`
- [ ] `lib/lua/` → `lib/easy_lua_ble/lib/lua/`
- [ ] `lib/lua_sys/` → `lib/easy_lua_ble/lib/lua_sys/`

User files updated:
- [x] `src/main_new.cpp` (new library-based main)

---

**Last Updated:** 2025-01-07
**Library Version:** 1.0.0
