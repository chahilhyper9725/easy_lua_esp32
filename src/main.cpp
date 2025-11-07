// ═══════════════════════════════════════════════════════════
// Easy Lua ESP32 - Main Entry Point
// ═══════════════════════════════════════════════════════════

#include <Arduino.h>
#include "system_init/system_init.h"
#include "lua_sys.h"  // User module: RTOS, timers, etc.

// ═══════════════════════════════════════════════════════════
// USER CALLBACK IMPLEMENTATIONS
// ═══════════════════════════════════════════════════════════

// Callback 1: Hardware initialization
// Called ONCE after core system initializes
// Initialize your custom hardware here (motors, sensors, LEDs, etc.)
void my_hardware_init()
{
    // ─────────────────────────────────────────────────────────
    // Initialize lua_sys hardware (FreeRTOS message queue)
    // ─────────────────────────────────────────────────────────
    lua_sys_init_hardware();

    // ─────────────────────────────────────────────────────────
    // Initialize your custom hardware below
    // ─────────────────────────────────────────────────────────

    // Example: Initialize custom hardware
    // pinMode(LED_PIN, OUTPUT);
    // digitalWrite(LED_PIN, HIGH);

    Serial.println("[USER] Custom hardware initialized");
}

// Callback 2: Lua module registration
// Called EVERY TIME Lua state is created or reset
// Register your custom Lua functions here
// System modules (arduino, eventmsg, storage) are already registered
void my_lua_register(lua_State* L)
{
    // ─────────────────────────────────────────────────────────
    // Register lua_sys module (RTOS, timers, message bus)
    // ─────────────────────────────────────────────────────────
    lua_sys_register(L);

    // ─────────────────────────────────────────────────────────
    // Register your custom Lua functions below
    // ─────────────────────────────────────────────────────────

    // Example: Register custom Lua function
    // lua_register(L, "myCustomFunction", my_custom_function);

    Serial.println("[USER] Custom Lua modules registered");
}

// Callback 3: Cleanup
// Called when Lua execution STOPS
// Cleanup your hardware here (turn off motors, LEDs, free resources)
void my_cleanup()
{
    // ─────────────────────────────────────────────────────────
    // Cleanup lua_sys resources (stop all timers)
    // ─────────────────────────────────────────────────────────
    lua_sys_cleanup();

    // ─────────────────────────────────────────────────────────
    // Cleanup your custom hardware below
    // ─────────────────────────────────────────────────────────

    // Example: Cleanup custom hardware
    // digitalWrite(LED_PIN, LOW);
    // stopAllMotors();

    Serial.println("[USER] Custom cleanup completed");
}

// ═══════════════════════════════════════════════════════════
// SETUP
// ═══════════════════════════════════════════════════════════

void setup()
{
    // Initialize system with user callbacks
    // All three callbacks are required (can be empty but must be provided)
    system_init(
        my_hardware_init,   // Hardware init callback
        my_lua_register,    // Lua registration callback
        my_cleanup          // Cleanup callback
    );
}

// ═══════════════════════════════════════════════════════════
// LOOP
// ═══════════════════════════════════════════════════════════

void loop()
{
    // System runs on RTOS tasks, so loop can be minimal
    delay(1);
}
