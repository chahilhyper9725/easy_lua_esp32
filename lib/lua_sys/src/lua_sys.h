/*
 * lua_sys - RTOS and Timer Module for Lua
 * Provides FreeRTOS integration and timer functionality
 */

#ifndef LUA_SYS_H
#define LUA_SYS_H

#include "luat_base.h"
#include "luat_msgbus.h"
#include "luat_timer.h"

#ifdef __cplusplus
extern "C" {
#endif

// Register the rtos module with Lua
int luaopen_rtos(lua_State *L);

#ifdef __cplusplus
}
#endif

// ═══════════════════════════════════════════════════════════
// HARDWARE INITIALIZATION (call once in hardware_init callback)
// ═══════════════════════════════════════════════════════════

// Initialize lua_sys hardware (FreeRTOS message queue)
// Call this ONCE in your hardware_init callback
// This creates the underlying FreeRTOS queue for message bus
void lua_sys_init_hardware(void);

// ═══════════════════════════════════════════════════════════
// LUA REGISTRATION (call in lua_register callback)
// ═══════════════════════════════════════════════════════════

// Register lua_sys module with Lua state
// Call this in your lua_register callback (called on every Lua state reset)
// This registers the "rtos" module with timer and message bus functions
void lua_sys_register(lua_State *L);

// ═══════════════════════════════════════════════════════════
// CLEANUP (call in cleanup callback)
// ═══════════════════════════════════════════════════════════

// Cleanup lua_sys resources
// Call this in your cleanup callback when Lua stops
// Stops all active timers
void lua_sys_cleanup(void);

// ═══════════════════════════════════════════════════════════
// DEPRECATED API (for backward compatibility)
// ═══════════════════════════════════════════════════════════

// Old API: Combined init (calls both init_hardware and register)
// DEPRECATED: Use lua_sys_init_hardware() and lua_sys_register() instead
void luaSys_init(lua_State *L) __attribute__((deprecated));

// Old API: Cleanup
// DEPRECATED: Use lua_sys_cleanup() instead
void luaSys_cleanup(void) __attribute__((deprecated));

#endif // LUA_SYS_H
