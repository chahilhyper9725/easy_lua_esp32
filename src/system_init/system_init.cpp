// ═══════════════════════════════════════════════════════════
// System Initialization Implementation
// ═══════════════════════════════════════════════════════════

#include "system_init.h"
#include "core/lua_engine.h"
#include "core/event_msg.h"
#include "comms/ble_comm.h"
#include "utils/debug.h"

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
    event_msg_send("lua_error", (const uint8_t *)error_msg, strlen(error_msg));
}

static void onLuaStop()
{
    LOG_INFO("LUA", "Lua execution finished");
    event_msg_send("lua_stop", nullptr, 0);
}

// ═══════════════════════════════════════════════════════════
// EVENT HANDLERS
// ═══════════════════════════════════════════════════════════

// Handler for "test" event
static void onTestEvent(const std::vector<uint8_t> &data)
{
    LOG_DEBUG("EVENT", "Test event received! Data size: %d bytes", data.size());
}

// Handler for "lua_stop" event
static void onLuaStopEvent(const std::vector<uint8_t> &data)
{
    LOG_DEBUG("EVENT", "Lua stop event received");
    lua_engine_stop();
}

// Handler for "lua_execute" event
static void onLuaExecuteEvent(const std::vector<uint8_t> &data)
{
    LOG_DEBUG("EVENT", "Lua execute event received");

    // Convert data to string (Lua code)
    String code = "";
    for (uint8_t byte : data)
    {
        code += (char)byte;
    }

    LOG_DEBUG("EVENT", "Executing Lua code (%d bytes)", code.length());

    // Execute Lua code
    lua_engine_execute(code.c_str());
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

    // Initialize Lua engine (creates RTOS task internally)
    lua_engine_init();

    // Initialize Arduino module
    arduino_module_init();

    // Register Arduino module with Lua
    lua_engine_add_module(arduino_module_register);

    // Register Lua callbacks
    lua_engine_on_error(onLuaError);
    lua_engine_on_stop(onLuaStop);

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

    // Register event handlers
    event_msg_on("test", onTestEvent);
    event_msg_on("lua_execute", onLuaExecuteEvent);
    event_msg_on("lua_stop", onLuaStopEvent);
    event_msg_on_unhandled(onUnhandledEvent);

    LOG_INFO("SYSTEM", "✓ Event system ready");
    LOG_INFO("SYSTEM", "  Registered events:");
    LOG_INFO("SYSTEM", "    - test");
    LOG_INFO("SYSTEM", "    - lua_execute");
    LOG_INFO("SYSTEM", "    - lua_stop");
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
