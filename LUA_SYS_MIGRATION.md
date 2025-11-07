# lua_sys Migration Guide

## What Changed?

The `lua_sys` module has been **refactored** to properly separate hardware initialization from Lua registration, following the three-callback pattern.

---

## Old API (Deprecated)

```cpp
#include "lua_sys.h"

void my_lua_register(lua_State* L) {
    luaSys_init(L);  // ❌ Old combined function
}

void my_cleanup() {
    luaSys_cleanup();  // ❌ Old name
}
```

**Problems with old API:**
- ❌ `luaSys_init(L)` does BOTH hardware init and Lua registration
- ❌ Hardware initialized multiple times (on every Lua state reset)
- ❌ Inconsistent naming (`luaSys` vs `lua_sys`)

---

## New API (Recommended)

```cpp
#include "lua_sys.h"

// ═══════════════════════════════════════════════════════════
// HARDWARE INIT (called ONCE)
// ═══════════════════════════════════════════════════════════
void my_hardware_init() {
    lua_sys_init_hardware();  // ✅ Initialize FreeRTOS queue ONCE
    // ... your hardware ...
}

// ═══════════════════════════════════════════════════════════
// LUA REGISTRATION (called EVERY Lua state reset)
// ═══════════════════════════════════════════════════════════
void my_lua_register(lua_State* L) {
    lua_sys_register(L);  // ✅ Register Lua module
    // ... your Lua functions ...
}

// ═══════════════════════════════════════════════════════════
// CLEANUP (called when Lua STOPS)
// ═══════════════════════════════════════════════════════════
void my_cleanup() {
    lua_sys_cleanup();  // ✅ Stop all timers
    // ... your cleanup ...
}
```

**Benefits of new API:**
- ✅ Hardware initialized **once** (not on every Lua reset)
- ✅ Lua module registered **every time** state resets
- ✅ Consistent naming convention (`lua_sys_*`)
- ✅ Follows three-callback pattern

---

## What Each Function Does

### 1. `lua_sys_init_hardware()` (call ONCE in `my_hardware_init`)

**What it does:**
- Creates FreeRTOS message queue (256 slots)
- Initializes message bus for RTOS communication

**When to call:**
- In `my_hardware_init()` callback
- Called **ONCE** at system startup

**What happens:**
```c
// Creates FreeRTOS queue handle
xQueue = xQueueCreate(256, sizeof(rtos_msg_t));
```

---

### 2. `lua_sys_register(L)` (call EVERY Lua state reset in `my_lua_register`)

**What it does:**
- Registers `rtos` module with Lua state
- Exposes timer and message bus functions to Lua

**When to call:**
- In `my_lua_register(lua_State* L)` callback
- Called **EVERY TIME** Lua state is created or reset

**What it exposes to Lua:**
```lua
rtos.sleep(ms)                    -- Sleep for milliseconds
rtos.timer_start(id, period, cb)  -- Start timer
rtos.timer_stop(id)               -- Stop timer
-- ... more RTOS functions ...
```

---

### 3. `lua_sys_cleanup()` (call in `my_cleanup`)

**What it does:**
- Stops ALL active timers
- Prevents timers from firing after Lua stops

**When to call:**
- In `my_cleanup()` callback
- Called when Lua execution **STOPS**

**What happens:**
```c
// Stops all FreeRTOS timers created by lua_sys
luat_timer_stop_all();
```

---

## Complete Migration Example

### Before (Old API)

```cpp
#include <Arduino.h>
#include "system_init/system_init.h"
#include "lua_sys.h"

void my_hardware_init() {
    pinMode(LED_PIN, OUTPUT);
}

void my_lua_register(lua_State* L) {
    luaSys_init(L);  // ❌ Old API
    lua_register(L, "led_on", lua_led_on);
}

void my_cleanup() {
    luaSys_cleanup();  // ❌ Old API
    digitalWrite(LED_PIN, LOW);
}

void setup() {
    system_init(my_hardware_init, my_lua_register, my_cleanup);
}

void loop() {
    delay(1);
}
```

### After (New API)

```cpp
#include <Arduino.h>
#include "system_init/system_init.h"
#include "lua_sys.h"

void my_hardware_init() {
    // Initialize lua_sys hardware FIRST
    lua_sys_init_hardware();  // ✅ New API - called ONCE

    // Then initialize your hardware
    pinMode(LED_PIN, OUTPUT);
}

void my_lua_register(lua_State* L) {
    // Register lua_sys module with Lua
    lua_sys_register(L);  // ✅ New API - called EVERY Lua reset

    // Then register your Lua functions
    lua_register(L, "led_on", lua_led_on);
}

void my_cleanup() {
    // Cleanup lua_sys FIRST
    lua_sys_cleanup();  // ✅ New API

    // Then cleanup your hardware
    digitalWrite(LED_PIN, LOW);
}

void setup() {
    system_init(my_hardware_init, my_lua_register, my_cleanup);
}

void loop() {
    delay(1);
}
```

---

## API Reference

### New API Functions

| Function | Called In | Called When | Purpose |
|----------|-----------|-------------|---------|
| `lua_sys_init_hardware()` | `my_hardware_init()` | **Once** at startup | Create FreeRTOS queue |
| `lua_sys_register(L)` | `my_lua_register()` | **Every** Lua reset | Register `rtos` module |
| `lua_sys_cleanup()` | `my_cleanup()` | Lua **stops** | Stop all timers |

### Deprecated API (Still Works)

| Old Function | New Equivalent | Note |
|--------------|----------------|------|
| `luaSys_init(L)` | `lua_sys_init_hardware()` + `lua_sys_register(L)` | Calls both (not recommended) |
| `luaSys_cleanup()` | `lua_sys_cleanup()` | Just renamed |

**Deprecation warnings:**
- Old API marked with `__attribute__((deprecated))`
- Compiler will show warnings when using old API
- Old API will be **removed** in future versions

---

## Backward Compatibility

The old API **still works** but is deprecated:

```cpp
void my_lua_register(lua_State* L) {
    luaSys_init(L);  // ⚠️ DEPRECATED but still works
    // This internally calls both:
    // - lua_sys_init_hardware() (safe, idempotent)
    // - lua_sys_register(L)
}

void my_cleanup() {
    luaSys_cleanup();  // ⚠️ DEPRECATED but still works
    // This internally calls:
    // - lua_sys_cleanup()
}
```

**Compiler warnings:**
```
warning: 'luaSys_init' is deprecated [-Wdeprecated-declarations]
warning: 'luaSys_cleanup' is deprecated [-Wdeprecated-declarations]
```

---

## FAQ

### Q: Why split into two functions?

**A:** Hardware should initialize **once**, but Lua registration happens **every time** the Lua state resets. Separating them prevents re-initializing the FreeRTOS queue on every Lua reset.

### Q: What happens if I forget `lua_sys_init_hardware()`?

**A:** `lua_sys_register()` will detect this and log an error:
```
ERROR: lua_sys_register: Hardware not initialized! Call lua_sys_init_hardware() first
```

### Q: Can I call `lua_sys_init_hardware()` multiple times?

**A:** Yes, it's **idempotent**. The second call will log:
```
INFO: lua_sys hardware already initialized, skipping
```

### Q: Do I need to change my Lua scripts?

**A:** No! Your Lua scripts continue to work without changes:
```lua
rtos.sleep(1000)  -- Still works
rtos.timer_start(1, 500, function() print("tick") end)
```

### Q: When will the old API be removed?

**A:** The old API will be removed in the next major version. You'll have deprecation warnings until then.

---

## Naming Convention Summary

All `lua_sys` functions now use consistent `lua_sys_*` naming:

| Component | Old Name | New Name |
|-----------|----------|----------|
| Init function | `luaSys_init()` | `lua_sys_init_hardware()` + `lua_sys_register()` |
| Cleanup function | `luaSys_cleanup()` | `lua_sys_cleanup()` |
| Header file | `lua_sys.h` | `lua_sys.h` (unchanged) |
| Source file | `lua_sys.cpp` | `lua_sys.cpp` (unchanged) |

**Rationale:** Consistent `lowercase_with_underscore` convention matches C naming style and makes the API more predictable.

---

## Migration Checklist

- [ ] Replace `luaSys_init(L)` with `lua_sys_init_hardware()` + `lua_sys_register(L)`
- [ ] Move `lua_sys_init_hardware()` to `my_hardware_init()` callback
- [ ] Keep `lua_sys_register(L)` in `my_lua_register()` callback
- [ ] Replace `luaSys_cleanup()` with `lua_sys_cleanup()`
- [ ] Test that timers work correctly
- [ ] Verify no deprecation warnings in build output

---

## Need Help?

If you encounter issues during migration, check:

1. **Build errors?** Include `lua_sys.h` in your main.cpp
2. **Timers not working?** Make sure you called `lua_sys_init_hardware()` in `my_hardware_init()`
3. **Deprecation warnings?** Switch to the new API functions
4. **Lua errors?** Check that `lua_sys_register(L)` is called in `my_lua_register()`

---

**Last Updated:** 2025-01-07
**Version:** 2.0.0 (New API)
