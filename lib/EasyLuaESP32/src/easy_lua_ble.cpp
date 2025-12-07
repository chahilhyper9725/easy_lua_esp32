// ═══════════════════════════════════════════════════════════
// easy_lua_ble - Implementation
// Wraps the system_init functionality with a class-based API
// ═══════════════════════════════════════════════════════════

#include "easy_lua_ble.h"

// Include internal headers
#include "system_init/system_init.h"
#include "core/comms/ble_comm.h"
#include "core/lua_engine.h"
#include "core/event_msg.h"

// ═══════════════════════════════════════════════════════════
// STATIC MEMBER INITIALIZATION
// ═══════════════════════════════════════════════════════════

bool easy_lua_ble::initialized = false;

// ═══════════════════════════════════════════════════════════
// VERSION INFO
// ═══════════════════════════════════════════════════════════

#define EASY_LUA_BLE_VERSION "1.0.0"

// ═══════════════════════════════════════════════════════════
// INITIALIZATION
// ═══════════════════════════════════════════════════════════

void easy_lua_ble::begin(
    HardwareInitCallback hw_init,
    LuaRegisterCallback lua_reg,
    StopCleanupCallback cleanup
)
{
    if (initialized) {
        Serial.println("easy_lua_ble: Already initialized");
        return;
    }

    // Call the system_init function from system_init.cpp
    system_init(hw_init, lua_reg, cleanup);

    initialized = true;
}

// ═══════════════════════════════════════════════════════════
// SYSTEM STATUS
// ═══════════════════════════════════════════════════════════

bool easy_lua_ble::isInitialized()
{
    return initialized;
}

bool easy_lua_ble::isBLEConnected()
{
    return ble_comm_is_connected();
}

bool easy_lua_ble::isLuaRunning()
{
    return lua_engine_is_running();
}

// ═══════════════════════════════════════════════════════════
// LUA EXECUTION
// ═══════════════════════════════════════════════════════════

void easy_lua_ble::executeLua(const char* code)
{
    if (!initialized) {
        Serial.println("easy_lua_ble: Not initialized. Call init() first.");
        return;
    }
    lua_engine_execute(code);
}

void easy_lua_ble::stopLua()
{
    if (!initialized) {
        return;
    }
    lua_engine_stop();
}

void easy_lua_ble::addLuaCode(const char* code)
{
    if (!initialized) {
        Serial.println("easy_lua_ble: Not initialized. Call init() first.");
        return;
    }
    lua_engine_add_code(code);
}

void easy_lua_ble::clearLuaCode()
{
    if (!initialized) {
        return;
    }
    lua_engine_clear_code();
}

void easy_lua_ble::runLuaBuffer()
{
    if (!initialized) {
        Serial.println("easy_lua_ble: Not initialized. Call init() first.");
        return;
    }
    lua_engine_run_buffer();
}

// ═══════════════════════════════════════════════════════════
// EVENT MESSAGING
// ═══════════════════════════════════════════════════════════

void easy_lua_ble::sendEvent(const char* name, const uint8_t* data, uint16_t len)
{
    if (!initialized) {
        Serial.println("easy_lua_ble: Not initialized. Call init() first.");
        return;
    }
    event_msg_send(name, data, len);
}

void easy_lua_ble::sendEvent(const char* name, const String& data)
{
    if (!initialized) {
        Serial.println("easy_lua_ble: Not initialized. Call init() first.");
        return;
    }
    event_msg_send(name, (const uint8_t*)data.c_str(), data.length());
}

// ═══════════════════════════════════════════════════════════
// SYSTEM INFO
// ═══════════════════════════════════════════════════════════

const char* easy_lua_ble::getVersion()
{
    return EASY_LUA_BLE_VERSION;
}

void easy_lua_ble::printSystemInfo()
{
    Serial.println("═══════════════════════════════════════");
    Serial.println("  easy_lua_ble System Information");
    Serial.println("═══════════════════════════════════════");
    Serial.printf("  Version: %s\n", EASY_LUA_BLE_VERSION);
    Serial.printf("  Initialized: %s\n", initialized ? "Yes" : "No");
    Serial.printf("  Free Heap: %d bytes\n", ESP.getFreeHeap());
    Serial.printf("  BLE Connected: %s\n", isBLEConnected() ? "Yes" : "No");
    Serial.printf("  Lua Running: %s\n", isLuaRunning() ? "Yes" : "No");
    Serial.println("═══════════════════════════════════════");
}
