#include <Arduino.h>
#include "core/lua_engine.h"
#include "core/event_msg.h"
#include "comms/ble_comm.h"
#include "utils/debug.h"

// ═══════════════════════════════════════════════════════
// MODULE DECLARATIONS
// ═══════════════════════════════════════════════════════

void arduino_module_init();
void arduino_module_register(lua_State *L);

// ═══════════════════════════════════════════════════════
// LUA CALLBACKS
// ═══════════════════════════════════════════════════════

void onLuaError(const char *error_msg)
{
    LOG_ERROR("MAIN", "Lua error: %s", error_msg);
    event_msg_send("lua_error", (const uint8_t *)error_msg, strlen(error_msg));
}

void onLuaStop()
{
    // Called when Lua execution finishes (success or interrupt)
    LOG_INFO("MAIN", "Lua execution finished");
    event_msg_send("lua_stop", nullptr, 0);
}

// ═══════════════════════════════════════════════════════
// EVENT HANDLERS
// ═══════════════════════════════════════════════════════

// Handler for "test" event
void onTestEvent(const std::vector<uint8_t> &data)
{
    LOG_DEBUG("HANDLER", "Test event received! Data size: %d bytes", data.size());
}


void onLuaStopEvent(const std::vector<uint8_t> &data)
{
    LOG_DEBUG("HANDLER", "Lua stop event received");
    lua_engine_stop();
}


// Handler for "lua_execute" event
void onLuaExecuteEvent(const std::vector<uint8_t> &data)
{
    LOG_DEBUG("HANDLER", "Lua execute event received");

    // Convert data to string (Lua code)
    String code = "";
    for (uint8_t byte : data)
    {
        code += (char)byte;
    }

    LOG_DEBUG("HANDLER", "Code: %s", code.c_str());

    // Execute Lua code
    lua_engine_execute(code.c_str());
}

// Wildcard handler for unhandled events
void onUnhandledEvent(const String &name, const std::vector<uint8_t> &data)
{
    LOG_DEBUG("HANDLER", "Unhandled event received: '%s' (%d bytes)", name.c_str(), data.size());
}

// Called when event needs to be sent (sends via BLE)
void onEventSend(const uint8_t *data, uint16_t len)
{
    // Send via BLE
    ble_comm_send(data, len);
}


// ═══════════════════════════════════════════════════════
// SETUP
// ═══════════════════════════════════════════════════════

void setup()
{
    Serial.begin(115200);
    delay(1000);

    // Initialize Lua engine (creates RTOS task internally)
    lua_engine_init();

    // Initialize modules
    arduino_module_init();

    // Register modules
    lua_engine_add_module(arduino_module_register);

    // Register callbacks
    lua_engine_on_error(onLuaError);
    lua_engine_on_stop(onLuaStop);

    LOG_INFO("SYSTEM", "System ready!");

    // Initialize BLE communication
    ble_comm_init("ESP32_Lua", event_msg_feed_bytes);

    // Initialize event message system
    event_msg_init(onEventSend);

    // Register event handlers
    event_msg_on("test", onTestEvent);
    event_msg_on("lua_execute", onLuaExecuteEvent);

    event_msg_on("lua_stop", onLuaStopEvent);
    event_msg_on_unhandled(onUnhandledEvent);

    LOG_INFO("SYSTEM", "BLE and Event messaging ready!");
    LOG_INFO("SYSTEM", "Connect via BLE to send/receive events");
    LOG_INFO("SYSTEM", "Registered events: test, lua_execute");
    LOG_INFO("SYSTEM", "Or use Serial to control Lua directly");
}

// ═══════════════════════════════════════════════════════
// LOOP
// ═══════════════════════════════════════════════════════

void loop()
{

    delay(1);
}
