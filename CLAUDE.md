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
