// ═══════════════════════════════════════════════════════════
// System Initialization Implementation
// ═══════════════════════════════════════════════════════════

#include "system_init.h"
#include "core/lua_engine.h"
#include "core/event_msg.h"
#include "comms/ble_comm.h"
#include "utils/debug.h"
#include "modules/file_transfer.h"
#include "lua_sys.h"
// ═══════════════════════════════════════════════════════════
// MODULE DECLARATIONS
// ═══════════════════════════════════════════════════════════

// External module initialization
extern void arduino_module_init();
extern void arduino_module_register(lua_State *L);

// ═══════════════════════════════════════════════════════════
// LUA CALLBACKS
// ═══════════════════════════════════════════════════════════

static void onLuaError(const char *error_msg)
{
    LOG_ERROR("LUA", "Lua error: %s", error_msg);
    event_msg_send(EVENT_LUA_ERROR, (const uint8_t *)error_msg, strlen(error_msg));
}

static void onLuaStop()
{
    LOG_INFO("LUA", "Lua execution finished");

    // Cleanup lua_sys resources (stop all timers)
    luaSys_cleanup();

    // Send result event with success status
    const char *result = "Lua execution finished";

    event_msg_send(EVENT_LUA_RESULT, (const uint8_t *)result, strlen(result));
    result = "Lua execution stopped";
    event_msg_send(EVENT_LUA_CODE_STOP, (const uint8_t *)result, strlen(result));
}

// ═══════════════════════════════════════════════════════════
// EVENT HANDLERS
// ═══════════════════════════════════════════════════════════

// Simple ping handler
static void ping(const std::vector<uint8_t> &data)
{
    event_msg_send("pong", data.data(), data.size());
    LOG_DEBUG("EVENT", "Ping event received! with Data %d bytes", data.size());
}

// Handler for "test" event
static void onTestEvent(const std::vector<uint8_t> &data)
{
    LOG_DEBUG("EVENT", "Test event received! Data size: %d bytes", data.size());
}

// Handler for "lua_code_add" event - Append code to buffer
static void onLuaCodeAddEvent(const std::vector<uint8_t> &data)
{
    LOG_DEBUG("EVENT", "Lua code add event received (%d bytes)", data.size());

    // Convert data to string (Lua code chunk)
    String code = "";
    for (uint8_t byte : data)
    {
        code += (char)byte;
    }

    // Add to buffer
    lua_engine_add_code(code.c_str());
    event_msg_send(EVENT_LUA_RESULT, (const uint8_t *)"code added", strlen("code added"));
}

// Handler for "lua_code_clear" event - Clear code buffer
static void onLuaCodeClearEvent(const std::vector<uint8_t> &data)
{
    (void)data; // Unused
    LOG_DEBUG("EVENT", "Lua code clear event received");
    lua_engine_clear_code();
    event_msg_send(EVENT_LUA_RESULT, (const uint8_t *)"code cleared", strlen("code cleared"));
}

// Handler for "lua_code_run" event - Execute buffer
static void onLuaCodeRunEvent(const std::vector<uint8_t> &data)
{
    (void)data; // Unused
    LOG_DEBUG("EVENT", "Lua code run event received");
    event_msg_send(EVENT_LUA_RESULT, (const uint8_t *)"code execution starting", strlen("code execution starting"));

    lua_engine_run_buffer();
}

// Handler for "lua_code_stop" event - Stop execution
static void onLuaCodeStopEvent(const std::vector<uint8_t> &data)
{
    (void)data; // Unused
    LOG_DEBUG("EVENT", "Lua code stop event received");

    // Stop Lua execution
    lua_engine_stop();

    // Cleanup lua_sys resources (stop all timers)
    luaSys_cleanup();
}

// Wildcard handler for unhandled events
static void onUnhandledEvent(const String &name, const std::vector<uint8_t> &data)
{
    LOG_DEBUG("EVENT", "Unhandled event: '%s' (%d bytes)", name.c_str(), data.size());
}

// Called when event needs to be sent (sends via BLE)
static void onEventSend(const uint8_t *data, uint16_t len)
{
    // Send via BLE
    ble_comm_send(data, len);
}

// ═══════════════════════════════════════════════════════════
// INITIALIZATION FUNCTIONS
// ═══════════════════════════════════════════════════════════

void system_init_serial()
{
    Serial.begin(115200);
    delay(1000); // Wait for serial to stabilize

    LOG_INFO("SYSTEM", "═══════════════════════════════════════");
    LOG_INFO("SYSTEM", "  ESP32 Lua System Starting...");
    LOG_INFO("SYSTEM", "═══════════════════════════════════════");
}

void system_init_lua()
{
    LOG_INFO("SYSTEM", "Initializing Lua engine...");

    // flow --> Arduino module and Other modules --> lua callbacks -->Lua engine init

    // Initialize Arduino module
    arduino_module_init();

    // Register Arduino module with Lua
    lua_engine_add_module(arduino_module_register);
    lua_engine_add_module(luaSys_init); // Register LuaSys module

    // Register Lua callbacks
    lua_engine_on_error(onLuaError);
    lua_engine_on_stop(onLuaStop);

    // Initialize Lua engine (creates RTOS task internally)
    lua_engine_init();
    

    LOG_INFO("SYSTEM", "✓ Lua engine ready");
}

void system_init_ble()
{
    LOG_INFO("SYSTEM", "Initializing BLE communication...");

    // Initialize BLE with device name and data callback
    ble_comm_init("ESP32_Lua", event_msg_feed_bytes);

    LOG_INFO("SYSTEM", "✓ BLE ready (Device: ESP32_Lua)");
}

void system_init_events()
{
    LOG_INFO("SYSTEM", "Initializing event system...");

    // Initialize event message system
    event_msg_init(onEventSend);

    // Register Lua execution event handlers
    event_msg_on("test", onTestEvent);
    event_msg_on(EVENT_LUA_CODE_ADD, onLuaCodeAddEvent);
    event_msg_on(EVENT_LUA_CODE_CLEAR, onLuaCodeClearEvent);
    event_msg_on(EVENT_LUA_CODE_RUN, onLuaCodeRunEvent);
    event_msg_on(EVENT_LUA_CODE_STOP, onLuaCodeStopEvent);
    event_msg_on("ping", ping);
    event_msg_on_unhandled(onUnhandledEvent);

    // Initialize and register file transfer module
    file_transfer_init();
    file_transfer_register_handlers();

    LOG_INFO("SYSTEM", "✓ Event system ready");
    LOG_INFO("SYSTEM", "  Registered Lua events:");
    LOG_INFO("SYSTEM", "    - test");
    LOG_INFO("SYSTEM", "    - ping / pong");
    LOG_INFO("SYSTEM", "    - %s (add code chunk)", EVENT_LUA_CODE_ADD);
    LOG_INFO("SYSTEM", "    - %s (clear buffer)", EVENT_LUA_CODE_CLEAR);
    LOG_INFO("SYSTEM", "    - %s (run buffer)", EVENT_LUA_CODE_RUN);
    LOG_INFO("SYSTEM", "    - %s (stop execution)", EVENT_LUA_CODE_STOP);
    LOG_INFO("SYSTEM", "  Registered File events:");
    LOG_INFO("SYSTEM", "    - file_init, file_create, file_append, file_flush");
    LOG_INFO("SYSTEM", "    - file_seek, file_close, file_read, file_delete");
    LOG_INFO("SYSTEM", "    - file_list, file_info");
}

// ═══════════════════════════════════════════════════════════
// MAIN INITIALIZATION
// ═══════════════════════════════════════════════════════════

void system_init()
{
    // 1. Initialize serial communication
    system_init_serial();

    // 2. Initialize Lua engine and modules
    system_init_lua();

    // 3. Initialize BLE communication
    system_init_ble();

    // 4. Initialize event system
    system_init_events();

    LOG_INFO("SYSTEM", "═══════════════════════════════════════");
    LOG_INFO("SYSTEM", "  ✓ System Ready!");
    LOG_INFO("SYSTEM", "═══════════════════════════════════════");
    LOG_INFO("SYSTEM", "Connect via BLE to send/receive events");
}
