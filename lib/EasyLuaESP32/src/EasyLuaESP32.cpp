// ═══════════════════════════════════════════════════════════
// EasyLuaESP32 - Implementation
// Wraps the system_init functionality with a class-based API
// ═══════════════════════════════════════════════════════════

#include "EasyLuaESP32.h"

// Include internal headers
#include "system_init/system_init.h"
#include "core/comms/ble_comm.h"
#include "core/lua_engine.h"
#include "core/event_msg.h"

// ═══════════════════════════════════════════════════════════
// STATIC MEMBER INITIALIZATION
// ═══════════════════════════════════════════════════════════

bool EasyLuaESP32::initialized = false;

// ═══════════════════════════════════════════════════════════
// VERSION INFO
// ═══════════════════════════════════════════════════════════

#define EASY_LUA_ESP32_VERSION "1.0.0"

// ═══════════════════════════════════════════════════════════
// INITIALIZATION
// ═══════════════════════════════════════════════════════════

void EasyLuaESP32::begin(
    HardwareInitCallback hw_init,
    LuaRegisterCallback lua_reg,
    StopCleanupCallback cleanup
)
{
    if (initialized) {
        Serial.println("EasyLuaESP32: Already initialized");
        return;
    }

    // Call the system_init function from system_init.cpp
    system_init(hw_init, lua_reg, cleanup);

    initialized = true;
}

// ═══════════════════════════════════════════════════════════
// SYSTEM STATUS
// ═══════════════════════════════════════════════════════════

bool EasyLuaESP32::isInitialized()
{
    return initialized;
}

bool EasyLuaESP32::isBLEConnected()
{
    return ble_comm_is_connected();
}

bool EasyLuaESP32::isLuaRunning()
{
    return lua_engine_is_running();
}

// ═══════════════════════════════════════════════════════════
// LUA EXECUTION
// ═══════════════════════════════════════════════════════════

void EasyLuaESP32::executeLua(const char* code)
{
    if (!initialized) {
        Serial.println("EasyLuaESP32: Not initialized. Call init() first.");
        return;
    }
    lua_engine_execute(code);
}

void EasyLuaESP32::stopLua()
{
    if (!initialized) {
        return;
    }
    lua_engine_stop();
}

void EasyLuaESP32::addLuaCode(const char* code)
{
    if (!initialized) {
        Serial.println("EasyLuaESP32: Not initialized. Call init() first.");
        return;
    }
    lua_engine_add_code(code);
}

void EasyLuaESP32::clearLuaCode()
{
    if (!initialized) {
        return;
    }
    lua_engine_clear_code();
}

void EasyLuaESP32::runLuaBuffer()
{
    if (!initialized) {
        Serial.println("EasyLuaESP32: Not initialized. Call init() first.");
        return;
    }
    lua_engine_run_buffer();
}

// ═══════════════════════════════════════════════════════════
// EVENT MESSAGING
// ═══════════════════════════════════════════════════════════

void EasyLuaESP32::sendEvent(const char* name, const uint8_t* data, uint16_t len)
{
    if (!initialized) {
        Serial.println("EasyLuaESP32: Not initialized. Call init() first.");
        return;
    }
    event_msg_send(name, data, len);
}

void EasyLuaESP32::sendEvent(const char* name, const String& data)
{
    if (!initialized) {
        Serial.println("EasyLuaESP32: Not initialized. Call init() first.");
        return;
    }
    event_msg_send(name, (const uint8_t*)data.c_str(), data.length());
}

// ═══════════════════════════════════════════════════════════
// SYSTEM INFO
// ═══════════════════════════════════════════════════════════

const char* EasyLuaESP32::getVersion()
{
    return EASY_LUA_ESP32_VERSION;
}

void EasyLuaESP32::printSystemInfo()
{
    Serial.println("═══════════════════════════════════════");
    Serial.println("  EasyLuaESP32 System Information");
    Serial.println("═══════════════════════════════════════");
    Serial.printf("  Version: %s\n", EASY_LUA_ESP32_VERSION);
    Serial.printf("  Initialized: %s\n", initialized ? "Yes" : "No");
    Serial.printf("  Free Heap: %d bytes\n", ESP.getFreeHeap());
    Serial.printf("  BLE Connected: %s\n", isBLEConnected() ? "Yes" : "No");
    Serial.printf("  Lua Running: %s\n", isLuaRunning() ? "Yes" : "No");
    Serial.println("═══════════════════════════════════════");
}
