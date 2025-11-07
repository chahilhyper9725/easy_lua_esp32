# EasyLuaESP32 Library

A complete Lua scripting engine for ESP32 with BLE communication, event messaging, and file storage.

## Installation (Manual Setup Required)

### Step 1: Copy Source Files

The library structure is created, but you need to **manually copy** the following folders from `src/` to `lib/EasyLuaESP32/src/`:

```
📁 src/                          →  📁 lib/EasyLuaESP32/src/
├── 📁 core/                     →  ├── 📁 core/
│   ├── 📁 comms/               →  │   ├── 📁 comms/
│   ├── event_msg.cpp/h         →  │   ├── event_msg.cpp/h
│   ├── file_transfer.cpp/h     →  │   ├── file_transfer.cpp/h
│   ├── lua_engine.cpp/h        →  │   ├── lua_engine.cpp/h
│   └── 📁 utils/               →  │   └── 📁 utils/
│
├── 📁 lua_modules/             →  ├── 📁 lua_modules/
│   ├── 📁 lua_arduino/         →  │   ├── 📁 lua_arduino/
│   ├── 📁 lua_eventmsg/        →  │   ├── 📁 lua_eventmsg/
│   └── 📁 lua_storage/         →  │   └── 📁 lua_storage/
│
└── 📁 system_init/             →  └── 📁 system_init/
    ├── system_init.cpp         →      ├── system_init.cpp
    └── system_init.h           →      └── system_init.h
```

### Step 2: Copy Lua Library

Also copy the `lib/lua/` folder:

```
📁 lib/lua/  →  📁 lib/EasyLuaESP32/lib/lua/
```

### Step 3: Copy lua_sys Library

And copy the `lib/lua_sys/` folder:

```
📁 lib/lua_sys/  →  📁 lib/EasyLuaESP32/lib/lua_sys/
```

### Commands to Copy (Windows PowerShell)

```powershell
# Navigate to project root
cd C:\Users\chahi\OneDrive\Documents\PlatformIO\Projects\easy_lua_esp32

# Copy core
xcopy /E /I /Y src\core lib\EasyLuaESP32\src\core

# Copy lua_modules
xcopy /E /I /Y src\lua_modules lib\EasyLuaESP32\src\lua_modules

# Copy system_init
xcopy /E /I /Y src\system_init lib\EasyLuaESP32\src\system_init

# Copy lua library
xcopy /E /I /Y lib\lua lib\EasyLuaESP32\lib\lua

# Copy lua_sys library
xcopy /E /I /Y lib\lua_sys lib\EasyLuaESP32\lib\lua_sys
```

## Library Structure

```
lib/EasyLuaESP32/
├── library.json                    # PlatformIO metadata
├── library.properties              # Arduino IDE metadata
├── README.md                       # This file
│
├── src/
│   ├── EasyLuaESP32.h             # 🌟 PUBLIC API (unified header)
│   ├── EasyLuaESP32.cpp           # Implementation wrapper
│   │
│   ├── core/                       # Core system (internal)
│   │   ├── comms/ble_comm.*
│   │   ├── event_msg.*
│   │   ├── file_transfer.*
│   │   ├── lua_engine.*
│   │   └── utils/debug.*
│   │
│   ├── lua_modules/                # Lua bindings (internal)
│   │   ├── lua_arduino/
│   │   ├── lua_eventmsg/
│   │   └── lua_storage/
│   │
│   └── system_init/                # System initialization (internal)
│       ├── system_init.h
│       └── system_init.cpp
│
└── lib/                            # Bundled libraries
    ├── lua/                        # Lua 5.4 interpreter
    └── lua_sys/                    # RTOS/Timer module
```

## Usage

### Basic Example

```cpp
#include <Arduino.h>
#include <EasyLuaESP32.h>
#include "lua_sys.h"

// Hardware initialization callback
void my_hardware_init() {
    // Initialize lua_sys hardware (message queue)
    lua_sys_init_hardware();

    // Initialize your custom hardware
    pinMode(LED_BUILTIN, OUTPUT);
}

// Lua module registration callback
void my_lua_register(lua_State* L) {
    // Register lua_sys module (timers, RTOS)
    lua_sys_register(L);

    // Register your custom Lua functions
    // lua_register(L, "myFunction", my_function);
}

// Cleanup callback
void my_cleanup() {
    // Cleanup lua_sys
    lua_sys_cleanup();

    // Cleanup your hardware
    digitalWrite(LED_BUILTIN, LOW);
}

void setup() {
    // Initialize the complete system
    EasyLuaESP32::init(
        my_hardware_init,
        my_lua_register,
        my_cleanup
    );
}

void loop() {
    delay(1);
}
```

### Using the Library

Once installed, you only need:

1. **Include the header:**
   ```cpp
   #include <EasyLuaESP32.h>
   ```

2. **Provide three callbacks:**
   - `my_hardware_init()` - Initialize hardware once
   - `my_lua_register(lua_State* L)` - Register Lua modules (on every Lua reset)
   - `my_cleanup()` - Cleanup when Lua stops

3. **Call init:**
   ```cpp
   EasyLuaESP32::init(my_hardware_init, my_lua_register, my_cleanup);
   ```

## API Reference

### Initialization

```cpp
static void EasyLuaESP32::init(
    HardwareInitCallback hw_init,
    LuaRegisterCallback lua_reg,
    StopCleanupCallback cleanup
);
```

### System Status

```cpp
static bool isInitialized();       // Check if system is ready
static bool isBLEConnected();      // Check BLE connection
static bool isLuaRunning();        // Check if Lua is executing
```

### Lua Execution (Advanced)

```cpp
static void executeLua(const char* code);  // Execute Lua code
static void stopLua();                     // Stop execution
static void addLuaCode(const char* code);  // Add to buffer
static void clearLuaCode();                // Clear buffer
static void runLuaBuffer();                // Execute buffer
```

### Event Messaging (Advanced)

```cpp
static void sendEvent(const char* name, const uint8_t* data, uint16_t len);
static void sendEvent(const char* name, const String& data);
```

### System Info

```cpp
static const char* getVersion();    // Get library version
static void printSystemInfo();      // Print system status
```

## System Modules (Automatically Available in Lua)

### arduino module
```lua
pinMode(pin, mode)
digitalWrite(pin, value)
digitalRead(pin)
analogRead(pin)
delay(ms)
millis()
```

### eventmsg module
```lua
eventmsg.send(name, data)
eventmsg.on(name, callback)
```

### storage module
```lua
storage.write(filename, data)
storage.read(filename)
storage.delete(filename)
storage.list()
```

## User Modules (Register in your callback)

### lua_sys module (RTOS/Timers)

In `my_hardware_init()`:
```cpp
lua_sys_init_hardware();
```

In `my_lua_register()`:
```cpp
lua_sys_register(L);
```

In `my_cleanup()`:
```cpp
lua_sys_cleanup();
```

Then in Lua:
```lua
rtos.sleep(1000)
rtos.timer_start(1, 500, function() print("tick") end)
```

## Dependencies

- **ArduinoJson** ^7.4.2
- **NimBLE-Arduino** ^1.4.0

## Features

- ✅ Lua 5.4 scripting engine
- ✅ BLE communication (Nordic UART Service)
- ✅ Event messaging protocol
- ✅ File storage (LittleFS)
- ✅ RTOS task isolation
- ✅ Arduino API bindings
- ✅ Timer support
- ✅ Message bus
- ✅ Modular architecture

## License

MIT

## Version

1.0.0
