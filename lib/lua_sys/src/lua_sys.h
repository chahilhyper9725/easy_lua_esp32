/*
 * lua_sys - Main Arduino Library Header
 * Include this in your Arduino sketches
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

// Main initialization function
// Call this in your Arduino setup() before using Lua
void luaSys_init(lua_State *L);

// Cleanup function
// Call this before shutting down or resetting Lua
// Stops all timers and releases resources
void luaSys_cleanup(void);

// Embed sys.lua content as C string
extern const char luaSys_sys_lua[];

#endif // LUA_SYS_H
