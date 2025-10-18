// ═══════════════════════════════════════════════════════════
// System Initialization
// Contains all setup code for the ESP32 Lua system
// ═══════════════════════════════════════════════════════════

#ifndef SYSTEM_INIT_H
#define SYSTEM_INIT_H

#include <Arduino.h>

// ═══════════════════════════════════════════════════════════
// SYSTEM INITIALIZATION
// ═══════════════════════════════════════════════════════════

// Initialize all subsystems (call from setup())
void system_init();

// Individual initialization functions (can be called separately if needed)
void system_init_serial();
void system_init_lua();
void system_init_ble();
void system_init_events();

#endif // SYSTEM_INIT_H
