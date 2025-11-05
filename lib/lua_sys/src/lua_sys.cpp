/*
 * lua_sys - Arduino Library Implementation
 * Main entry point for Arduino sketches
 */

#include "lua_sys.h"

// Embedded sys.lua as C string (generated from lua/sys.lua)
// In production, use a build script to convert sys.lua to this array
// For now, this is a placeholder - user should load sys.lua from SPIFFS/LittleFS
const char luaSys_sys_lua[] = R"LUA_SCRIPT(
-- Placeholder: Load actual sys.lua from filesystem
-- or embed it here using xxd or similar tool
print("ERROR: sys.lua not embedded. Load from filesystem instead.")
return {}
)LUA_SCRIPT";

/**
 * Initialize LuaSys subsystems
 * Call this after creating Lua state, before running scripts
 *
 * @param L Lua state
 */
void luaSys_init(lua_State *L) {
    if (L == NULL) {
        LLOGE("luaSys_init: Lua state is NULL");
        return;
    }

    // Initialize message bus
    luat_msgbus_init();

    // Register rtos module
    luaopen_rtos(L);
    lua_setglobal(L, "rtos");

    LLOGI("LuaSys initialized");
}

/**
 * Cleanup LuaSys subsystems
 * Call this before shutting down or resetting Lua
 * Stops all timers and releases resources
 */
void luaSys_cleanup(void) {
    LLOGI("LuaSys cleanup starting...");

    // Stop all active timers
    luat_timer_cleanup();

    // Message bus doesn't need cleanup (stateless queue)

    LLOGI("LuaSys cleanup complete");
}
