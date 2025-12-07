// ═══════════════════════════════════════════════════════════
// System Initialization
// Contains all setup code for the ESP32 Lua system
// ═══════════════════════════════════════════════════════════

#ifndef SYSTEM_INIT_H
#define SYSTEM_INIT_H

#include <Arduino.h>

#include "lua.hpp"
// ═══════════════════════════════════════════════════════════
// USER CALLBACK TYPES
// ═══════════════════════════════════════════════════════════

// Callback 1: Hardware initialization (called after core system init)
// Use this to initialize your custom hardware (motors, sensors, LEDs, etc.)
typedef void (*HardwareInitCallback)(void);

// Callback 2: Lua module registration (called when Lua state is created/reset)
// Use this to register your custom Lua functions and modules
// System modules (arduino, eventmsg, storage) are registered automatically
// User modules (lua_sys, custom modules) should be registered here
typedef void (*LuaRegisterCallback)(lua_State* L);

// Callback 3: Cleanup (called when Lua stops or system shuts down)
// Use this to cleanup your hardware (turn off motors, LEDs, free resources)
typedef void (*StopCleanupCallback)(void);

// ═══════════════════════════════════════════════════════════
// SYSTEM INITIALIZATION
// ═══════════════════════════════════════════════════════════

// Main initialization function with user callbacks
// All three callbacks are REQUIRED (can be empty functions but must be provided)
//
// Parameters:
//   hw_init    - Called once after core system initializes (setup hardware here)
//   lua_reg    - Called every time Lua state resets (register Lua functions here)
//   cleanup    - Called when Lua stops (cleanup hardware here)
//
// Example usage in main.cpp:
//   void my_hardware_init() { pinMode(LED_PIN, OUTPUT); }
//   void my_lua_register(lua_State* L) { lua_register(L, "myFunc", my_func); }
//   void my_cleanup() { digitalWrite(LED_PIN, LOW); }
//
//   void setup() {
//     system_init(my_hardware_init, my_lua_register, my_cleanup);
//   }
//
void system_init(
    HardwareInitCallback hw_init,
    LuaRegisterCallback lua_reg,
    StopCleanupCallback cleanup
);

#endif // SYSTEM_INIT_H
