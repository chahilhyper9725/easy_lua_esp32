#include <Arduino.h>
#include "lua_arduino.h"
#include "../../core/lua_engine.h"
#include "../../core/event_msg.h"
#include "../../core/utils/debug.h"

// ═══════════════════════════════════════════════════════
// ARDUINO MODULE - Arduino-specific functions for Lua
// ═══════════════════════════════════════════════════════

// ───────────────────────────────────────────────────────
// INIT (Called once at startup)
// ───────────────────────────────────────────────────────
void arduino_module_init()
{
    // Nothing to initialize for Arduino functions
    LOG_DEBUG("MODULE", "Arduino module initialized");
}

// ───────────────────────────────────────────────────────
// LUA FUNCTIONS - Time
// ───────────────────────────────────────────────────────

// Returns milliseconds since startup
static int lua_millis(lua_State *L)
{
    lua_pushinteger(L, millis());
    return 1;
}

// Returns microseconds since startup
static int lua_micros(lua_State *L)
{
    lua_pushinteger(L, micros());
    return 1;
}

// Delays for specified milliseconds (accepts int or float)
static int lua_delay(lua_State *L)
{
    int ms = (int)lua_tonumber(L, 1);
    delay(ms);
    return 0;
}

// Delays for specified microseconds (accepts int or float)
static int lua_delayMicroseconds(lua_State *L)
{
    int us = (int)lua_tonumber(L, 1);
    delayMicroseconds(us);
    return 0;
}

// ───────────────────────────────────────────────────────
// LUA FUNCTIONS - Digital I/O
// ───────────────────────────────────────────────────────

// pinMode(pin, mode) - accepts int or float
static int lua_pinMode(lua_State *L)
{
    int pin = (int)lua_tonumber(L, 1);
    int mode = (int)lua_tonumber(L, 2);
    pinMode(pin, mode);
    return 0;
}

// digitalWrite(pin, value) - accepts int or float
static int lua_digitalWrite(lua_State *L)
{
    int pin = (int)lua_tonumber(L, 1);
    int value = (int)lua_tonumber(L, 2);
    digitalWrite(pin, value);
    return 0;
}

// value = digitalRead(pin) - accepts int or float
static int lua_digitalRead(lua_State *L)
{
    int pin = (int)lua_tonumber(L, 1);
    lua_pushinteger(L, digitalRead(pin));
    return 1;
}

// ───────────────────────────────────────────────────────
// LUA FUNCTIONS - Analog I/O
// ───────────────────────────────────────────────────────

// value = analogRead(pin) - accepts int or float
static int lua_analogRead(lua_State *L)
{
    int pin = (int)lua_tonumber(L, 1);
    lua_pushinteger(L, analogRead(pin));
    return 1;
}

// analogWrite(pin, value) -- PWM - accepts int or float
static int lua_analogWrite(lua_State *L)
{
    int pin = (int)lua_tonumber(L, 1);
    int value = (int)lua_tonumber(L, 2);
    analogWrite(pin, value);
    return 0;
}

// ───────────────────────────────────────────────────────
// LUA FUNCTIONS - Serial/Debug
// ───────────────────────────────────────────────────────

// Helper function to convert any Lua value to string representation
static String lua_value_to_string(lua_State *L, int index) {
    int type = lua_type(L, index);
    char buffer[64];

    switch (type) {
        case LUA_TNIL:
            return String("nil");

        case LUA_TBOOLEAN:
            if (lua_toboolean(L, index)) {
                return String("true");
            } else {
                return String("false");
            }

        case LUA_TNUMBER:
            if (lua_isinteger(L, index)) {
                // Integer
                lua_Integer val = lua_tointeger(L, index);
                snprintf(buffer, sizeof(buffer), "%lld", (long long)val);
                return String(buffer);
            } else {
                // Float/Double
                lua_Number val = lua_tonumber(L, index);
                // Remove trailing zeros for cleaner output
                snprintf(buffer, sizeof(buffer), "%.10g", val);
                return String(buffer);
            }

        case LUA_TSTRING: {
            size_t len;
            const char* str = lua_tolstring(L, index, &len);
            return String(str);
        }

        case LUA_TTABLE:
            snprintf(buffer, sizeof(buffer), "table: %p", lua_topointer(L, index));
            return String(buffer);

        case LUA_TFUNCTION:
            snprintf(buffer, sizeof(buffer), "function: %p", lua_topointer(L, index));
            return String(buffer);

        case LUA_TUSERDATA:
            snprintf(buffer, sizeof(buffer), "userdata: %p", lua_touserdata(L, index));
            return String(buffer);

        case LUA_TTHREAD:
            snprintf(buffer, sizeof(buffer), "thread: %p", lua_topointer(L, index));
            return String(buffer);

        case LUA_TLIGHTUSERDATA:
            snprintf(buffer, sizeof(buffer), "lightuserdata: %p", lua_touserdata(L, index));
            return String(buffer);

        default:
            return String("unknown");
    }
}

// Lua print() function - handles multiple arguments of any type
// Sends output over BLE via event_msg as "lua_code_output"
static int lua_print(lua_State *L)
{
    int nargs = lua_gettop(L);  // Get number of arguments

    if (nargs == 0) {
        // print() with no arguments just prints newline
        LOG_INFO("LUA_PRINT", "");
        event_msg_send(EVENT_LUA_OUTPUT, (const uint8_t*)"", 0);
        return 0;
    }

    String output = "";

    // Convert all arguments to string and concatenate with tabs
    for (int i = 1; i <= nargs; i++) {
        if (i > 1) {
            output += "\t";  // Lua standard: separate args with tabs
        }
        output += lua_value_to_string(L, i);
    }

    // Log to Serial for debugging
    LOG_INFO("LUA_PRINT", "%s", output.c_str());

    // Send over BLE via event_msg
    event_msg_send(EVENT_LUA_OUTPUT, (const uint8_t*)output.c_str(), output.length());

    return 0;  // print() returns no values
}

// ───────────────────────────────────────────────────────
// LUA FUNCTIONS - Math/Utilities
// ───────────────────────────────────────────────────────

// result = map(value, fromLow, fromHigh, toLow, toHigh) - accepts int or float
static int lua_map(lua_State *L)
{
    long value = (long)lua_tonumber(L, 1);
    long fromLow = (long)lua_tonumber(L, 2);
    long fromHigh = (long)lua_tonumber(L, 3);
    long toLow = (long)lua_tonumber(L, 4);
    long toHigh = (long)lua_tonumber(L, 5);
    lua_pushinteger(L, map(value, fromLow, fromHigh, toLow, toHigh));
    return 1;
}

// result = constrain(value, min, max) - accepts int or float
static int lua_constrain(lua_State *L)
{
    long value = (long)lua_tonumber(L, 1);
    long min = (long)lua_tonumber(L, 2);
    long max = (long)lua_tonumber(L, 3);
    lua_pushinteger(L, constrain(value, min, max));
    return 1;
}

// result = random(min, max) or random(max) - accepts int or float
static int lua_random(lua_State *L)
{
    int n = lua_gettop(L); // Number of arguments
    if (n == 1)
    {
        long max = (long)lua_tonumber(L, 1);
        lua_pushinteger(L, random(max));
    }
    else
    {
        long min = (long)lua_tonumber(L, 1);
        long max = (long)lua_tonumber(L, 2);
        lua_pushinteger(L, random(min, max));
    }
    return 1;
}

// randomSeed(seed) - accepts int or float
static int lua_randomSeed(lua_State *L)
{
    unsigned long seed = (unsigned long)lua_tonumber(L, 1);
    randomSeed(seed);
    return 0;
}

static int lua_dofile(lua_State *L)
{
    const char *filename = luaL_checkstring(L, 1);
    
    // Build full path in a local buffer
    char path[256];
    snprintf(path, sizeof(path), "/littlefs/%s", filename);
    
    return luaL_dofile(L, path);
}

// ───────────────────────────────────────────────────────
// REGISTER (Called before each Lua script execution)
// ───────────────────────────────────────────────────────
void arduino_module_register(lua_State *L)
{
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

    lua_register(L, "dofile", lua_dofile);

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

