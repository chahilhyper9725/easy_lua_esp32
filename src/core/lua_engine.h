#pragma once

#include "lua.hpp"

// ═══════════════════════════════════════════════════════
// LUA ENGINE - Simple Function-based API
// ═══════════════════════════════════════════════════════

// Event names for Lua execution
#define EVENT_LUA_CODE_ADD "lua_code_add"
#define EVENT_LUA_CODE_CLEAR "lua_code_clear"
#define EVENT_LUA_CODE_RUN "lua_code_run"
#define EVENT_LUA_CODE_STOP "lua_code_stop"
#define EVENT_LUA_OUTPUT "lua_code_output"
#define EVENT_LUA_ERROR "lua_error"
#define EVENT_LUA_RESULT "lua_result"
#define EVENT_LUA_RESULT "lua_result"


// Callback types
typedef void (*StateResetCallback)(lua_State* L);  // Called when Lua state is reset (register your modules here)
typedef void (*ErrorCallback)(const char* error_msg);
typedef void (*StopCallback)();

// Initialize Lua engine (call once in setup)
void lua_engine_init();

// Execute Lua code string (legacy - still supported)
// Modules will be registered automatically before execution
void lua_engine_execute(const char* code);

// Code buffer management (new API)
void lua_engine_add_code(const char* code);    // Append code to buffer (raw append)
void lua_engine_clear_code();                   // Clear the code buffer
void lua_engine_run_buffer();                   // Execute accumulated buffer
const char* lua_engine_get_buffer();            // Get current buffer (for debugging)

// Stop current Lua execution
void lua_engine_stop();

// Get Lua state for advanced use
lua_State* lua_engine_get_state();

// Set callback for when Lua state is reset (register your modules here)
// This callback is called every time a fresh Lua state is created
void lua_engine_on_state_reset(StateResetCallback callback);

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

// Print memory allocation statistics
void lua_engine_print_mem_stats();
