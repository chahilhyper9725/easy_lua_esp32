#include <Arduino.h>
#include "../core/lua_engine.h"
#include "../core/event_msg.h"
#include "../utils/debug.h"

// ═══════════════════════════════════════════════════════
// ARDUINO MODULE - Arduino-specific functions for Lua
// ═══════════════════════════════════════════════════════

// ───────────────────────────────────────────────────────
// INIT (Called once at startup)
// ───────────────────────────────────────────────────────
void arduino_module_init() {
    // Nothing to initialize for Arduino functions
    LOG_DEBUG("MODULE", "Arduino module initialized");
}

// ───────────────────────────────────────────────────────
// LUA FUNCTIONS - Time
// ───────────────────────────────────────────────────────

// Returns milliseconds since startup
static int lua_millis(lua_State* L) {
    lua_pushinteger(L, millis());
    return 1;
}

// Returns microseconds since startup
static int lua_micros(lua_State* L) {
    lua_pushinteger(L, micros());
    return 1;
}

// Delays for specified milliseconds
static int lua_delay(lua_State* L) {
    int ms = lua_tointeger(L, 1);
    delay(ms);
    return 0;
}

// Delays for specified microseconds
static int lua_delayMicroseconds(lua_State* L) {
    int us = lua_tointeger(L, 1);
    delayMicroseconds(us);
    return 0;
}

// ───────────────────────────────────────────────────────
// LUA FUNCTIONS - Digital I/O
// ───────────────────────────────────────────────────────

// pinMode(pin, mode)
static int lua_pinMode(lua_State* L) {
    int pin = lua_tointeger(L, 1);
    int mode = lua_tointeger(L, 2);
    pinMode(pin, mode);
    return 0;
}

// digitalWrite(pin, value)
static int lua_digitalWrite(lua_State* L) {
    int pin = lua_tointeger(L, 1);
    int value = lua_tointeger(L, 2);
    digitalWrite(pin, value);
    return 0;
}

// value = digitalRead(pin)
static int lua_digitalRead(lua_State* L) {
    int pin = lua_tointeger(L, 1);
    lua_pushinteger(L, digitalRead(pin));
    return 1;
}

// ───────────────────────────────────────────────────────
// LUA FUNCTIONS - Analog I/O
// ───────────────────────────────────────────────────────

// value = analogRead(pin)
static int lua_analogRead(lua_State* L) {
    int pin = lua_tointeger(L, 1);
    lua_pushinteger(L, analogRead(pin));
    return 1;
}

// analogWrite(pin, value)  -- PWM
static int lua_analogWrite(lua_State* L) {
    int pin = lua_tointeger(L, 1);
    int value = lua_tointeger(L, 2);
    analogWrite(pin, value);
    return 0;
}

// ───────────────────────────────────────────────────────
// LUA FUNCTIONS - Serial/Debug
// ───────────────────────────────────────────────────────

// Prints message - sends as BLE event "lua_code_output"
static int lua_print(lua_State* L) {
    const char* msg = lua_tostring(L, 1);
    if (msg) {
        // Also log to Serial for local debugging
        LOG_DEBUG("LUA_PRINT", "%s", msg);

        // Send as BLE event
        event_msg_send(EVENT_LUA_OUTPUT, (const uint8_t*)msg, strlen(msg));
    }
    return 0;
}

// ───────────────────────────────────────────────────────
// LUA FUNCTIONS - Math/Utilities
// ───────────────────────────────────────────────────────

// result = map(value, fromLow, fromHigh, toLow, toHigh)
static int lua_map(lua_State* L) {
    long value = lua_tointeger(L, 1);
    long fromLow = lua_tointeger(L, 2);
    long fromHigh = lua_tointeger(L, 3);
    long toLow = lua_tointeger(L, 4);
    long toHigh = lua_tointeger(L, 5);
    lua_pushinteger(L, map(value, fromLow, fromHigh, toLow, toHigh));
    return 1;
}

// result = constrain(value, min, max)
static int lua_constrain(lua_State* L) {
    long value = lua_tointeger(L, 1);
    long min = lua_tointeger(L, 2);
    long max = lua_tointeger(L, 3);
    lua_pushinteger(L, constrain(value, min, max));
    return 1;
}

// result = random(min, max) or random(max)
static int lua_random(lua_State* L) {
    int n = lua_gettop(L);  // Number of arguments
    if (n == 1) {
        long max = lua_tointeger(L, 1);
        lua_pushinteger(L, random(max));
    } else {
        long min = lua_tointeger(L, 1);
        long max = lua_tointeger(L, 2);
        lua_pushinteger(L, random(min, max));
    }
    return 1;
}

// randomSeed(seed)
static int lua_randomSeed(lua_State* L) {
    unsigned long seed = lua_tointeger(L, 1);
    randomSeed(seed);
    return 0;
}

// ───────────────────────────────────────────────────────
// REGISTER (Called before each Lua script execution)
// ───────────────────────────────────────────────────────
void arduino_module_register(lua_State* L) {
    // Time functions
    lua_register(L, "millis", lua_millis);
    lua_register(L, "micros", lua_micros);
    lua_register(L, "delay", lua_delay);
    lua_register(L, "delayMicroseconds", lua_delayMicroseconds);

    // Digital I/O
    lua_register(L, "pinMode", lua_pinMode);
    lua_register(L, "digitalWrite", lua_digitalWrite);
    lua_register(L, "digitalRead", lua_digitalRead);

    // Analog I/O
    lua_register(L, "analogRead", lua_analogRead);
    lua_register(L, "analogWrite", lua_analogWrite);

    // Serial/Debug
    lua_register(L, "print", lua_print);

    // Math/Utilities
    lua_register(L, "map", lua_map);
    lua_register(L, "constrain", lua_constrain);
    lua_register(L, "random", lua_random);
    lua_register(L, "randomSeed", lua_randomSeed);

    // Constants
    lua_pushinteger(L, OUTPUT);
    lua_setglobal(L, "OUTPUT");
    lua_pushinteger(L, INPUT);
    lua_setglobal(L, "INPUT");
    lua_pushinteger(L, INPUT_PULLUP);
    lua_setglobal(L, "INPUT_PULLUP");
    lua_pushinteger(L, HIGH);
    lua_setglobal(L, "HIGH");
    lua_pushinteger(L, LOW);
    lua_setglobal(L, "LOW");
}
