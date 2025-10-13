#include "lua_engine.h"
#include "../utils/debug.h"
#include <Arduino.h>
#include <cassert>

// ═══════════════════════════════════════════════════════
// INTERNAL STATE
// ═══════════════════════════════════════════════════════

static lua_State* L = nullptr;
static ModuleRegisterFunc registered_modules[16];
static int module_count = 0;

// RTOS Task Management
static TaskHandle_t lua_task_handle = NULL;
static SemaphoreHandle_t execute_semaphore = NULL;
static String code_to_execute = "";
static volatile bool is_running = false;
static volatile bool stop_requested = false;

// Callbacks
static ErrorCallback error_callback = nullptr;
static StopCallback stop_callback = nullptr;

// ═══════════════════════════════════════════════════════
// DEBUG HOOK (Watchdog prevention + interrupt handling)
// ═══════════════════════════════════════════════════════

static void debug_hook(lua_State* state, lua_Debug* dbg) {
    (void)dbg;
    yield();

    if (stop_requested) {
        luaL_error(state, "Interrupted by user (Ctrl+C)");
    }
}

// ═══════════════════════════════════════════════════════
// INTERNAL HELPERS
// ═══════════════════════════════════════════════════════

// Reset Lua state for clean, isolated execution
static void reset_lua_state() {
    // Close existing state if any
    if (L != nullptr) {
        lua_close(L);
        L = nullptr;
    }

    // Create fresh Lua state
    L = luaL_newstate();
    assert(L != nullptr);

    // Set debug hook
    lua_sethook(L, debug_hook, LUA_MASKLINE, 10);

    // Load standard libraries
    luaL_openlibs(L);

    // Register all modules
    for (int i = 0; i < module_count; i++) {
        registered_modules[i](L);
    }
}

// ═══════════════════════════════════════════════════════
// RTOS TASK - Lua Execution
// ═══════════════════════════════════════════════════════

static void lua_task(void* parameter) {
    (void)parameter;

    while (true) {
        // Wait for execute signal
        if (xSemaphoreTake(execute_semaphore, portMAX_DELAY) == pdTRUE) {
            is_running = true;
            stop_requested = false;

            // Execute code (modules already registered in reset_lua_state)
            int result = luaL_dostring(L, code_to_execute.c_str());

            if (result != LUA_OK) {
                const char* error = lua_tostring(L, -1);
                LOG_ERROR("LUA", "Execution error: %s", error);
                // Call error callback
                if (error_callback != nullptr) {
                    error_callback(error);
                }

                lua_pop(L, 1);
            } else {
                LOG_INFO("LUA", "Code executed successfully");
            }

            // Reset Lua state for next execution (clean isolation)
            reset_lua_state();

            stop_requested = false;
            is_running = false;

            // Call stop callback when execution finishes
            if (stop_callback != nullptr) {
                stop_callback();
            }
        }
    }
}

// ═══════════════════════════════════════════════════════
// PUBLIC FUNCTIONS
// ═══════════════════════════════════════════════════════

void lua_engine_init() {
    LOG_INFO("LUA", "Initializing Lua engine...");

    // Create initial Lua state
    reset_lua_state();

    // Create RTOS synchronization (only once)
    execute_semaphore = xSemaphoreCreateBinary();

    // Create Lua execution task on Core 1 (only once)
    xTaskCreatePinnedToCore(
        lua_task,
        "LuaTask",
        8192,
        NULL,
        1,
        &lua_task_handle,
        1
    );

    LOG_INFO("LUA", "Engine initialized (RTOS task on Core 1)");
}

void lua_engine_execute(const char* code) {
    if (L == nullptr) {
        LOG_ERROR("LUA", "Engine not initialized!");
        return;
    }

    // If already running, stop and wait
    if (is_running) {
        LOG_DEBUG("LUA", "Stopping current execution...");
        stop_requested = true;

        // Wait for current execution to finish (max 5 seconds)
        int timeout = 5000;
        while (is_running && timeout > 0) {
            delay(10);
            timeout -= 10;
        }

        if (is_running) {
            LOG_ERROR("LUA", "Timeout waiting for stop!");
        }
    }

    // Queue new code for execution
    LOG_DEBUG("LUA", "Executing code...");
    code_to_execute = code;
    xSemaphoreGive(execute_semaphore);
}

void lua_engine_stop() {
    stop_requested = true;
}

lua_State* lua_engine_get_state() {
    return L;
}

void lua_engine_add_module(ModuleRegisterFunc register_func) {
    if (module_count < 16) {
        registered_modules[module_count++] = register_func;
        LOG_DEBUG("LUA", "Module registered (total: %d)", module_count);
    } else {
        LOG_ERROR("LUA", "Max modules reached!");
    }
}

void lua_engine_request_stop() {
    stop_requested = true;
}

bool lua_engine_is_stop_requested() {
    return stop_requested;
}

bool lua_engine_is_running() {
    return is_running;
}

void lua_engine_on_error(ErrorCallback callback) {
    error_callback = callback;
}

void lua_engine_on_stop(StopCallback callback) {
    stop_callback = callback;
}
