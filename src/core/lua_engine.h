#pragma once

#include "lua.hpp"

// ═══════════════════════════════════════════════════════
// LUA ENGINE - Simple Function-based API
// ═══════════════════════════════════════════════════════

// Callback types
typedef void (*ModuleRegisterFunc)(lua_State* L);
typedef void (*ErrorCallback)(const char* error_msg);
typedef void (*StopCallback)();

// Initialize Lua engine (call once in setup)
void lua_engine_init();

// Execute Lua code string
// Modules will be registered automatically before execution
void lua_engine_execute(const char* code);

// Stop current Lua execution
void lua_engine_stop();

// Get Lua state for advanced use
lua_State* lua_engine_get_state();

// Register a module (modules call this to register their Lua functions)
// This is called automatically before each script execution
void lua_engine_add_module(ModuleRegisterFunc register_func);

// Request stop of running Lua code (called from serial interrupt)
void lua_engine_request_stop();

// Check if stop was requested
bool lua_engine_is_stop_requested();

// Check if Lua code is currently running
bool lua_engine_is_running();

// Set callback for when Lua execution has an error
void lua_engine_on_error(ErrorCallback callback);

// Set callback for when Lua execution stops (success or interrupt)
void lua_engine_on_stop(StopCallback callback);
