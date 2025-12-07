// ═══════════════════════════════════════════════════════════
// Easy Lua BLE - Library Example
// Demonstrates using easy_lua_ble as a library
// ═══════════════════════════════════════════════════════════

#include <Arduino.h>
#include <easy_lua_ble.h>  // Single library header
// #include "lua_sys.h"         // User module: RTOS, timers, etc.

// ═══════════════════════════════════════════════════════════
// USER CALLBACK IMPLEMENTATIONS
// ═══════════════════════════════════════════════════════════

// Callback 1: Hardware initialization
// Called ONCE after core system initializes
void my_hardware_init()
{
    // Initialize lua_sys hardware (FreeRTOS message queue)
    // lua_sys_init_hardware();

    // Initialize your custom hardware
    // pinMode(LED_PIN, OUTPUT);

    Serial.println("[USER] Hardware initialized");
}

// Callback 2: Lua module registration
// Called EVERY TIME Lua state is created or reset
void my_lua_register(lua_State* L)
{
    // Register lua_sys module (RTOS, timers)
    // lua_sys_register(L);

    // Register your custom Lua functions
    // lua_register(L, "myFunc", my_func);

    Serial.println("[USER] Lua modules registered");
}

// Callback 3: Cleanup
// Called when Lua execution STOPS
void my_cleanup()
{
    // Cleanup lua_sys resources
    // lua_sys_cleanup();

    // Cleanup your hardware
    // digitalWrite(LED_PIN, LOW);

    Serial.println("[USER] Cleanup completed");
}

// ═══════════════════════════════════════════════════════════
// SETUP
// ═══════════════════════════════════════════════════════════

void setup()
{
    // Initialize using library API
    easy_lua_ble::begin(
        my_hardware_init,
        my_lua_register,
        my_cleanup
    );

    // Print system info
    easy_lua_ble::printSystemInfo();
}

// ═══════════════════════════════════════════════════════════
// LOOP
// ═══════════════════════════════════════════════════════════

void loop()
{
    delay(1);
}
