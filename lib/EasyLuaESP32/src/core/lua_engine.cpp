#include "lua_engine.h"
#include "utils/debug.h"
#include <Arduino.h>
#include <cassert>
#include <esp_heap_caps.h>

// ═══════════════════════════════════════════════════════
// MEMORY CONFIGURATION
// ═══════════════════════════════════════════════════════

// Enable/disable PSRAM usage for Lua (set to false to use only SRAM)
#define LUA_USE_PSRAM true

// Static SRAM pool for Lua (64KB)
#define LUA_SRAM_POOL_SIZE (64 * 1024)
static uint8_t lua_sram_pool[LUA_SRAM_POOL_SIZE];
static size_t sram_pool_offset = 0;

// Memory allocation statistics
struct LuaMemStats
{
    size_t total_allocated;
    size_t sram_allocated;
    size_t psram_allocated;
    size_t peak_allocated;
    bool psram_available;
} lua_mem_stats = {0, 0, 0, 0, false};

// ═══════════════════════════════════════════════════════
// HYBRID MEMORY ALLOCATOR
// ═══════════════════════════════════════════════════════

static void *lua_hybrid_alloc(void *ud, void *ptr, size_t osize, size_t nsize)
{
    (void)ud;

    // Free operation
    if (nsize == 0)
    {
        if (ptr)
        {
            // Determine if pointer is in SRAM pool or heap
            uintptr_t ptr_addr = (uintptr_t)ptr;
            uintptr_t pool_start = (uintptr_t)lua_sram_pool;
            uintptr_t pool_end = pool_start + LUA_SRAM_POOL_SIZE;

            if (ptr_addr >= pool_start && ptr_addr < pool_end)
            {
                // SRAM pool allocation - can't free individual blocks
                // Memory will be reclaimed when pool resets
                lua_mem_stats.sram_allocated -= osize;
            }
            else
            {
                // Heap allocation (PSRAM or SRAM)
                free(ptr);
                lua_mem_stats.psram_allocated -= osize;
            }
            lua_mem_stats.total_allocated -= osize;
        }
        return NULL;
    }

    void *new_ptr = NULL;

    // Realloc operation
    if (ptr != NULL)
    {
        // Check if pointer is in SRAM pool
        uintptr_t ptr_addr = (uintptr_t)ptr;
        uintptr_t pool_start = (uintptr_t)lua_sram_pool;
        uintptr_t pool_end = pool_start + LUA_SRAM_POOL_SIZE;

        if (ptr_addr >= pool_start && ptr_addr < pool_end)
        {
            // Can't realloc SRAM pool memory - allocate new and copy
            new_ptr = lua_hybrid_alloc(ud, NULL, 0, nsize);
            if (new_ptr)
            {
                memcpy(new_ptr, ptr, osize < nsize ? osize : nsize);
                lua_mem_stats.sram_allocated -= osize;
            }
            return new_ptr;
        }
        else
        {
            // Heap realloc
            new_ptr = realloc(ptr, nsize);
            if (new_ptr)
            {
                lua_mem_stats.total_allocated = lua_mem_stats.total_allocated - osize + nsize;
                lua_mem_stats.psram_allocated = lua_mem_stats.psram_allocated - osize + nsize;
                if (lua_mem_stats.total_allocated > lua_mem_stats.peak_allocated)
                {
                    lua_mem_stats.peak_allocated = lua_mem_stats.total_allocated;
                }
            }
            return new_ptr;
        }
    }

    // New allocation
    // Strategy: Small hot allocations (<512 bytes) use SRAM pool
    //           Larger allocations use heap (PSRAM if enabled and available)
    if (nsize < 512 && LUA_USE_PSRAM)
    {
        // Try SRAM pool first
        if (sram_pool_offset + nsize <= LUA_SRAM_POOL_SIZE)
        {
            new_ptr = &lua_sram_pool[sram_pool_offset];
            sram_pool_offset += nsize;
            lua_mem_stats.sram_allocated += nsize;
            lua_mem_stats.total_allocated += nsize;
            if (lua_mem_stats.total_allocated > lua_mem_stats.peak_allocated)
            {
                lua_mem_stats.peak_allocated = lua_mem_stats.total_allocated;
            }
            return new_ptr;
        }
    }

    // Use heap (PSRAM if available, otherwise internal SRAM)
    if (LUA_USE_PSRAM && lua_mem_stats.psram_available)
    {
        new_ptr = heap_caps_malloc(nsize, MALLOC_CAP_SPIRAM);
    }

    // Fallback to internal SRAM if PSRAM disabled or allocation failed
    if (new_ptr == NULL)
    {
        new_ptr = malloc(nsize);
    }

    if (new_ptr)
    {
        lua_mem_stats.psram_allocated += nsize;
        lua_mem_stats.total_allocated += nsize;
        if (lua_mem_stats.total_allocated > lua_mem_stats.peak_allocated)
        {
            lua_mem_stats.peak_allocated = lua_mem_stats.total_allocated;
        }
    }

    return new_ptr;
}

// ═══════════════════════════════════════════════════════
// INTERNAL STATE
// ═══════════════════════════════════════════════════════

static lua_State *L = nullptr;

// RTOS Task Management
static TaskHandle_t lua_task_handle = NULL;
static SemaphoreHandle_t execute_semaphore = NULL;
static String code_to_execute = "";
static volatile bool is_running = false;
static volatile bool stop_requested = false;

// Code buffer for chunked code assembly
static String code_buffer = "";

// Callbacks
static StateResetCallback state_reset_callback = nullptr;
static ErrorCallback error_callback = nullptr;
static StopCallback stop_callback = nullptr;

// ═══════════════════════════════════════════════════════
// DEBUG HOOK (Watchdog prevention + interrupt handling)
// ═══════════════════════════════════════════════════════

static void debug_hook(lua_State *state, lua_Debug *dbg)
{
    (void)dbg;
    yield();

    if (stop_requested)
    {
         luaL_dostring(state, "dofile('stop.lua')");
        luaL_error(state, "Interrupted by user (Ctrl+C)");
    }
}

// ═══════════════════════════════════════════════════════
// INTERNAL HELPERS
// ═══════════════════════════════════════════════════════

// Create a new Lua state with custom allocator and standard libraries
static void create_lua_state()
{
    // Reset SRAM pool offset for fresh allocation
    sram_pool_offset = 0;

    // Reset allocation stats (keep PSRAM availability)
    bool psram_was_available = lua_mem_stats.psram_available;
    lua_mem_stats = {0, 0, 0, 0, psram_was_available};

    // Create fresh Lua state with custom allocator
    L = lua_newstate(lua_hybrid_alloc, NULL);
    assert(L != nullptr);

    // Set debug hook to prevent watchdog resets
    lua_sethook(L, debug_hook, LUA_MASKLINE, 10);

    // Load standard Lua libraries
    luaL_openlibs(L);
}

// Reset Lua state for clean, isolated execution
static void reset_lua_state()
{
    // Close existing state if any
    if (L != nullptr)
    {
        lua_close(L);
        L = nullptr;
    }

    // Create fresh Lua state
    create_lua_state();

    // Call user's state reset callback to register modules
    if (state_reset_callback != nullptr)
    {
        state_reset_callback(L);
    }
}

// ═══════════════════════════════════════════════════════
// RTOS TASK - Lua Execution
// ═══════════════════════════════════════════════════════

static void lua_task(void *parameter)
{
    (void)parameter;

    while (true)
    {
        // Wait for execute signal
        if (xSemaphoreTake(execute_semaphore, portMAX_DELAY) == pdTRUE)
        {
            is_running = true;
            stop_requested = false;

            // Execute code (modules already registered in reset_lua_state)
            int result = luaL_dostring(L, code_to_execute.c_str());

            if (result != LUA_OK)
            {
                const char *error = lua_tostring(L, -1);
                LOG_ERROR("LUA", "Execution error: %s", error);
                // Call error callback
                if (error_callback != nullptr)
                {
                    error_callback(error);
                }
                lua_pop(L, 1);
            }
            else
            {
                LOG_INFO("LUA", "Code executed successfully");
            }
            // luaL_dostring(L, "dofile('stop.lua')"); // execute stop script if exists

            // Reset Lua state for next execution (clean isolation)
            reset_lua_state();

            stop_requested = false;
            is_running = false;

            // Call stop callback when execution finishes
            if (stop_callback != nullptr)
            {
                stop_callback();
            }
        }
    }
}

// ═══════════════════════════════════════════════════════
// PUBLIC FUNCTIONS
// ═══════════════════════════════════════════════════════

void lua_engine_init()
{
    LOG_INFO("LUA", "Initializing Lua engine...");

// Check PSRAM availability
#if LUA_USE_PSRAM
    size_t psram_size = heap_caps_get_total_size(MALLOC_CAP_SPIRAM);
    lua_mem_stats.psram_available = (psram_size > 0);

    if (lua_mem_stats.psram_available)
    {
        LOG_INFO("LUA", "PSRAM detected: %d KB available", psram_size / 1024);
        LOG_INFO("LUA", "Memory strategy: SRAM pool (64KB) + PSRAM heap");
    }
    else
    {
        LOG_INFO("LUA", "No PSRAM detected, using internal SRAM only");
        LOG_INFO("LUA", "Memory strategy: SRAM pool (64KB) + internal heap");
    }
#else
    lua_mem_stats.psram_available = false;
    LOG_INFO("LUA", "PSRAM disabled in configuration");
    LOG_INFO("LUA", "Memory strategy: SRAM pool (64KB) + internal heap");
#endif

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
        1);

    // lua_engine_execute("dofile('/littlefs/main.lua')"); // Warm up the task

    LOG_INFO("LUA", "Engine initialized (RTOS task on Core 1)");
}

void lua_engine_execute(const char *code)
{
    if (L == nullptr)
    {
        LOG_ERROR("LUA", "Engine not initialized!");
        return;
    }

    // If already running, stop and wait
    if (is_running)
    {
        LOG_DEBUG("LUA", "Stopping current execution...");
        stop_requested = true;

        // Wait for current execution to finish (max 5 seconds)
        int timeout = 5000;
        while (is_running && timeout > 0)
        {
            delay(10);
            timeout -= 10;
        }

        if (is_running)
        {
            LOG_ERROR("LUA", "Timeout waiting for stop!");
        }
    }

    // Queue new code for execution
    LOG_DEBUG("LUA", "Executing code...");
    code_to_execute = code;
    xSemaphoreGive(execute_semaphore);
}

void lua_engine_stop()
{
    stop_requested = true;
}

// ═══════════════════════════════════════════════════════
// CODE BUFFER MANAGEMENT
// ═══════════════════════════════════════════════════════

void lua_engine_add_code(const char *code)
{
    if (code != nullptr)
    {
        code_buffer += code; // Raw append
        LOG_DEBUG("LUA", "Code added to buffer (%d bytes total)", code_buffer.length());
    }
}

void lua_engine_clear_code()
{
    code_buffer = "";
    LOG_DEBUG("LUA", "Code buffer cleared");
}

void lua_engine_run_buffer()
{
    LOG_DEBUG("LUA", "Running code buffer (%d bytes)", code_buffer.length());
    lua_engine_execute(code_buffer.c_str());
}

const char *lua_engine_get_buffer()
{
    return code_buffer.c_str();
}

lua_State *lua_engine_get_state()
{
    return L;
}

void lua_engine_on_state_reset(StateResetCallback callback)
{
    state_reset_callback = callback;
    LOG_DEBUG("LUA", "State reset callback registered");
}

void lua_engine_request_stop()
{
    stop_requested = true;
}

bool lua_engine_is_stop_requested()
{
    return stop_requested;
}

bool lua_engine_is_running()
{
    return is_running;
}

void lua_engine_on_error(ErrorCallback callback)
{
    error_callback = callback;
}

void lua_engine_on_stop(StopCallback callback)
{
    stop_callback = callback;
}

void lua_engine_print_mem_stats()
{
    LOG_INFO("LUA_MEM", "═══════════════════════════════════");
    LOG_INFO("LUA_MEM", "Lua Memory Statistics:");
    LOG_INFO("LUA_MEM", "  PSRAM available: %s", lua_mem_stats.psram_available ? "Yes" : "No");
    LOG_INFO("LUA_MEM", "  Total allocated: %d KB", lua_mem_stats.total_allocated / 1024);
    LOG_INFO("LUA_MEM", "  SRAM allocated: %d KB", lua_mem_stats.sram_allocated / 1024);
    LOG_INFO("LUA_MEM", "  PSRAM allocated: %d KB", lua_mem_stats.psram_allocated / 1024);
    LOG_INFO("LUA_MEM", "  Peak allocated: %d KB", lua_mem_stats.peak_allocated / 1024);
    LOG_INFO("LUA_MEM", "  SRAM pool used: %d / %d KB", sram_pool_offset / 1024, LUA_SRAM_POOL_SIZE / 1024);
    LOG_INFO("LUA_MEM", "═══════════════════════════════════");
}
