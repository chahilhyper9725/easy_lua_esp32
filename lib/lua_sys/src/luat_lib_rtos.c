/*
 * LuatOS RTOS Library - Lua Bindings
 * Provides rtos.* functions to Lua
 */

#include "luat_base.h"
#include "luat_msgbus.h"
#include "luat_timer.h"
#include "lua.hpp"

#define LUAT_LOG_TAG "rtos"

// Auto garbage collection settings
static uint32_t autogc_high_water = 90;
static uint32_t autogc_mid_water = 80;
static uint16_t autogc_config = 100;
static uint16_t autogc_counter = 0;

/**
 * Timer message handler
 * Called when a timer expires - returns timer info to Lua
 */
static int l_timer_handler(lua_State *L, void* ptr) {
    rtos_msg_t* msg = (rtos_msg_t*)lua_topointer(L, -1);
    luat_timer_t *timer = (luat_timer_t *)ptr;
    int timer_id = msg->arg1;

    if (timer_id > 0) {
        timer = luat_timer_get(timer_id);
    }

    if (timer == NULL) {
        return 0;
    }

    LLOGD("Timer handler: id=%d, repeat=%d", timer->id, timer->repeat);

    // Push timer message to Lua
    lua_pushinteger(L, MSG_TIMER);      // Message type
    lua_pushinteger(L, timer->id);      // Timer ID
    lua_pushinteger(L, timer->repeat);  // Repeat count

    // Handle one-shot timers
    if (timer->repeat == 0) {
        luat_timer_stop(timer);
        luat_heap_free(timer);
    } else if (timer->repeat > 0) {
        timer->repeat--;
    }

    return 3; // Return 3 values to Lua
}

/**
 * rtos.receive(timeout)
 * Receive and process message from message bus
 * @param timeout Timeout in milliseconds (-1 = infinite)
 * @return Message type, param1, param2 or -1 on timeout
 */
static int l_rtos_receive(lua_State *L) {
    rtos_msg_t msg = {0};
    int re = 0;
    size_t total = 0;
    size_t used = 0;
    size_t max_used = 0;

    // Auto garbage collection when system is idle
    if (luat_msgbus_is_empty() && autogc_config) {
        // Get Lua memory info
        total = lua_gc(L, LUA_GCCOUNT, 0) * 1024 + lua_gc(L, LUA_GCCOUNTB, 0);
        used = total; // Simplified - in real impl, track used memory

        // Force GC if memory usage is high
        if ((used * 100) >= (total * autogc_high_water)) {
            LLOGD("Auto GC: High water mark reached");
            lua_gc(L, LUA_GCCOLLECT, 0);
            lua_gc(L, LUA_GCCOLLECT, 0); // Run twice for userdata
        } else {
            if (autogc_counter >= autogc_config) {
                autogc_counter = 0;
                if ((used * 100) >= (total * autogc_mid_water)) {
                    LLOGD("Auto GC: Mid water mark reached");
                    lua_gc(L, LUA_GCCOLLECT, 0);
                    lua_gc(L, LUA_GCCOLLECT, 0);
                }
            } else {
                autogc_counter++;
            }
        }
    } else {
        autogc_counter = 0;
    }

    // Get timeout parameter (default -1 = infinite)
    int timeout_ms = luaL_optinteger(L, 1, -1);
    TickType_t timeout_ticks = (timeout_ms < 0) ? portMAX_DELAY : pdMS_TO_TICKS(timeout_ms);

    // Block waiting for message
    re = luat_msgbus_get(&msg, timeout_ticks);

    if (re == 0) {
        // Got a message - call its handler
        lua_pushlightuserdata(L, (void*)(&msg));
        return msg.handler(L, msg.ptr);
    } else {
        // Timeout - no message
        lua_pushinteger(L, -1);
        return 1;
    }
}

/**
 * rtos.timer_start(id, timeout, repeat)
 * Start a timer
 * @param id Timer ID
 * @param timeout Timeout in milliseconds
 * @param repeat Repeat count (0=once, -1=infinite, >0=count)
 * @return 1 on success, 0 on failure
 */
static int l_rtos_timer_start(lua_State *L) {
    size_t id = (size_t)luaL_checkinteger(L, 1);
    size_t timeout = (size_t)luaL_checkinteger(L, 2);
    int repeat = (int)luaL_optinteger(L, 3, 0);

    if (timeout < 1) {
        LLOGE("Invalid timeout: %d", timeout);
        lua_pushinteger(L, 0);
        return 1;
    }

    // Allocate timer structure
    luat_timer_t *timer = (luat_timer_t*)luat_heap_malloc(sizeof(luat_timer_t));
    if (timer == NULL) {
        LLOGE("Timer malloc failed");
        lua_pushinteger(L, 0);
        return 1;
    }

    timer->id = id;
    timer->timeout = timeout;
    timer->repeat = repeat;
    timer->func = &l_timer_handler;
    timer->os_timer = NULL;

    // Start the timer
    int re = luat_timer_start(timer);
    if (re == 0) {
        lua_pushinteger(L, 1); // Success
    } else {
        LLOGE("Timer start failed");
        luat_heap_free(timer);
        lua_pushinteger(L, 0); // Failure
    }

    return 1;
}

/**
 * rtos.timer_stop(id)
 * Stop a timer
 * @param id Timer ID
 * @return nil
 */
static int l_rtos_timer_stop(lua_State *L) {
    if (!lua_isinteger(L, 1)) {
        return 0;
    }

    int timer_id = lua_tointeger(L, 1);
    luat_timer_t *timer = luat_timer_get(timer_id);

    if (timer != NULL) {
        luat_timer_stop(timer);
        luat_heap_free(timer);
    }

    return 0;
}

/**
 * rtos.reboot()
 * Reboot the system
 */
static int l_rtos_reboot(lua_State *L) {
    LLOGI("System rebooting...");
    vTaskDelay(pdMS_TO_TICKS(100)); // Small delay for log output
    esp_restart();
    return 0;
}

/**
 * rtos.meminfo()
 * Get memory information
 * @return total, used, max_used (in bytes)
 */
static int l_rtos_meminfo(lua_State *L) {
    // Lua VM memory
    size_t total = lua_gc(L, LUA_GCCOUNT, 0) * 1024 + lua_gc(L, LUA_GCCOUNTB, 0);

    // System heap memory
    size_t free_heap = esp_get_free_heap_size();
    size_t min_free = esp_get_minimum_free_heap_size();
    size_t total_heap = free_heap + (256 * 1024); // Approximation

    lua_pushinteger(L, total_heap);
    lua_pushinteger(L, total_heap - free_heap);
    lua_pushinteger(L, total_heap - min_free);
    return 3;
}

/**
 * rtos.version()
 * Get firmware version
 * @return version string
 */
static int l_rtos_version(lua_State *L) {
    lua_pushstring(L, "LuaSys-1.0.0");
    return 1;
}

// Module function table
static const luaL_Reg rtos_funcs[] = {
    {"receive",      l_rtos_receive},
    {"timer_start",  l_rtos_timer_start},
    {"timer_stop",   l_rtos_timer_stop},
    {"reboot",       l_rtos_reboot},
    {"meminfo",      l_rtos_meminfo},
    {"version",      l_rtos_version},
    {NULL, NULL}
};

/**
 * Open rtos module
 * Called when Lua does: require("rtos")
 */
LUAMOD_API int luaopen_rtos(lua_State *L) {
    // Initialize subsystems
    luat_msgbus_init();

    // Create module table
    luaL_newlib(L, rtos_funcs);

    // Add constants
    lua_pushinteger(L, -1);
    lua_setfield(L, -2, "INF_TIMEOUT");

    lua_pushinteger(L, MSG_TIMER);
    lua_setfield(L, -2, "MSG_TIMER");

    LLOGI("RTOS module loaded");
    return 1;
}
