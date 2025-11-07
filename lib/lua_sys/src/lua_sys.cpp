/*
 * lua_sys - Arduino Library Implementation
 * RTOS and Timer Module for Lua
 */

#include "lua_sys.h"

// Track if hardware is initialized (prevent double-init)
static bool hardware_initialized = false;

// ═══════════════════════════════════════════════════════════
// HARDWARE INITIALIZATION
// ═══════════════════════════════════════════════════════════

/**
 * Initialize lua_sys hardware (FreeRTOS message queue)
 * Call this ONCE in your hardware_init callback
 */
void lua_sys_init_hardware(void) {
    if (hardware_initialized) {
        LLOGI("lua_sys hardware already initialized, skipping");
        return;
    }

    // Initialize FreeRTOS message bus (creates queue)
    luat_msgbus_init();

    hardware_initialized = true;
    LLOGI("lua_sys hardware initialized (message bus created)");
}

// ═══════════════════════════════════════════════════════════
// LUA REGISTRATION
// ═══════════════════════════════════════════════════════════

/**
 * Register lua_sys module with Lua state
 * Call this in your lua_register callback (on every Lua state reset)
 */
void lua_sys_register(lua_State *L) {
    if (L == NULL) {
        LLOGE("lua_sys_register: Lua state is NULL");
        return;
    }

    if (!hardware_initialized) {
        LLOGE("lua_sys_register: Hardware not initialized! Call lua_sys_init_hardware() first");
        return;
    }

    // Register rtos module with Lua
    luaopen_rtos(L);
    lua_setglobal(L, "rtos");

    LLOGI("lua_sys registered with Lua state");
}

// ═══════════════════════════════════════════════════════════
// CLEANUP
// ═══════════════════════════════════════════════════════════

/**
 * Cleanup lua_sys resources
 * Call this in your cleanup callback when Lua stops
 */
void lua_sys_cleanup(void) {
    LLOGI("lua_sys cleanup starting...");

    // Stop all active timers
    luat_timer_cleanup();

    // Message bus doesn't need cleanup (queue remains for next execution)

    LLOGI("lua_sys cleanup complete");
}

// ═══════════════════════════════════════════════════════════
// DEPRECATED API (backward compatibility)
// ═══════════════════════════════════════════════════════════

/**
 * DEPRECATED: Old combined init function
 * Use lua_sys_init_hardware() and lua_sys_register() instead
 */
void luaSys_init(lua_State *L) {
    // For backward compatibility, call both
    lua_sys_init_hardware();
    lua_sys_register(L);
}

/**
 * DEPRECATED: Old cleanup function
 * Use lua_sys_cleanup() instead
 */
void luaSys_cleanup(void) {
    lua_sys_cleanup();
}
