// ═══════════════════════════════════════════════════════════
// EasyLuaESP32 - Lua Scripting Engine for ESP32
// Complete system with BLE, Event Messaging, and File Storage
// ═══════════════════════════════════════════════════════════

#ifndef EASY_LUA_ESP32_H
#define EASY_LUA_ESP32_H

#include <Arduino.h>

extern "C" {
#include "lua.h"
}

// ═══════════════════════════════════════════════════════════
// USER CALLBACK TYPES
// ═══════════════════════════════════════════════════════════

/**
 * Callback 1: Hardware initialization (called after core system init)
 * Use this to initialize your custom hardware (motors, sensors, LEDs, etc.)
 * Called ONCE at system startup
 */
typedef void (*HardwareInitCallback)(void);

/**
 * Callback 2: Lua module registration (called when Lua state is created/reset)
 * Use this to register your custom Lua functions and modules
 * System modules (arduino, eventmsg, storage) are registered automatically
 * Called EVERY TIME Lua state resets
 */
typedef void (*LuaRegisterCallback)(lua_State* L);

/**
 * Callback 3: Cleanup (called when Lua stops)
 * Use this to cleanup your hardware (turn off motors, LEDs, free resources)
 * Called when Lua execution STOPS
 */
typedef void (*StopCleanupCallback)(void);

// ═══════════════════════════════════════════════════════════
// MAIN API CLASS
// ═══════════════════════════════════════════════════════════

/**
 * EasyLuaESP32 - Main system class
 *
 * This class provides a unified interface to initialize and manage
 * the complete Lua scripting system including:
 * - Lua execution engine with RTOS task isolation
 * - BLE communication (Nordic UART Service)
 * - Event messaging protocol
 * - File storage (LittleFS)
 * - System modules (arduino, eventmsg, storage)
 */
class EasyLuaESP32 {
public:
    // ═══════════════════════════════════════════════════════════
    // INITIALIZATION
    // ═══════════════════════════════════════════════════════════

    /**
     * Initialize the complete EasyLuaESP32 system
     *
     * This function initializes all subsystems in the correct order:
     * 1. Serial communication (115200 baud)
     * 2. Lua engine with RTOS task
     * 3. BLE communication
     * 4. Event messaging system
     * 5. Storage system (LittleFS)
     * 6. User hardware (via hw_init callback)
     *
     * @param hw_init    Hardware initialization callback (required)
     * @param lua_reg    Lua module registration callback (required)
     * @param cleanup    Cleanup callback (required)
     *
     * Example usage:
     * @code
     * void my_hardware_init() { pinMode(LED_PIN, OUTPUT); }
     * void my_lua_register(lua_State* L) { lua_register(L, "myFunc", my_func); }
     * void my_cleanup() { digitalWrite(LED_PIN, LOW); }
     *
     * void setup() {
     *     EasyLuaESP32::begin(my_hardware_init, my_lua_register, my_cleanup);
     * }
     * @endcode
     */
    static void begin(
        HardwareInitCallback hw_init,
        LuaRegisterCallback lua_reg,
        StopCleanupCallback cleanup
    );

    // ═══════════════════════════════════════════════════════════
    // SYSTEM STATUS
    // ═══════════════════════════════════════════════════════════

    /**
     * Check if the system is initialized
     * @return true if init() has been called successfully
     */
    static bool isInitialized();

    /**
     * Get BLE connection status
     * @return true if a BLE client is connected
     */
    static bool isBLEConnected();

    /**
     * Check if Lua is currently executing
     * @return true if Lua code is running
     */
    static bool isLuaRunning();

    // ═══════════════════════════════════════════════════════════
    // LUA EXECUTION (Advanced - usually controlled via BLE events)
    // ═══════════════════════════════════════════════════════════

    /**
     * Execute Lua code directly (advanced users)
     * Normally code is sent via BLE, but this allows direct execution
     * @param code Lua code string to execute
     */
    static void executeLua(const char* code);

    /**
     * Stop currently running Lua code
     */
    static void stopLua();

    /**
     * Add code to buffer (for multi-chunk execution)
     * @param code Lua code chunk to append
     */
    static void addLuaCode(const char* code);

    /**
     * Clear the Lua code buffer
     */
    static void clearLuaCode();

    /**
     * Execute the accumulated code buffer
     */
    static void runLuaBuffer();

    // ═══════════════════════════════════════════════════════════
    // EVENT MESSAGING (Advanced)
    // ═══════════════════════════════════════════════════════════

    /**
     * Send a custom event via BLE
     * @param name Event name
     * @param data Event data (binary)
     * @param len  Data length
     */
    static void sendEvent(const char* name, const uint8_t* data, uint16_t len);

    /**
     * Send a custom event via BLE (string version)
     * @param name Event name
     * @param data Event data (string)
     */
    static void sendEvent(const char* name, const String& data);

    // ═══════════════════════════════════════════════════════════
    // SYSTEM INFO
    // ═══════════════════════════════════════════════════════════

    /**
     * Get library version string
     * @return Version string (e.g., "1.0.0")
     */
    static const char* getVersion();

    /**
     * Print system information to Serial
     * Includes: Free heap, BLE status, Lua status, etc.
     */
    static void printSystemInfo();

private:
    static bool initialized;
};

#endif // EASY_LUA_ESP32_H
