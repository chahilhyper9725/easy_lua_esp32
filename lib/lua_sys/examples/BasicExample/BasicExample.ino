/*
 * LuaSys Basic Example for Arduino/ESP32
 *
 * This example demonstrates:
 * - Initializing Lua with LuaSys
 * - Loading sys.lua from SPIFFS/LittleFS
 * - Creating tasks with sys.taskInit()
 * - Using timers
 * - Running the event loop
 *
 * Hardware: ESP32, ESP32-S2, ESP32-S3, or ESP32-C3
 *
 * Setup:
 * 1. Install Lua library for ESP32 (e.g., https://github.com/satoren/lua-arduino)
 * 2. Upload sys.lua to SPIFFS/LittleFS (data/ folder)
 * 3. Upload this sketch
 */

#include <Arduino.h>
#include <FS.h>
#include <SPIFFS.h>  // or LittleFS.h

// Lua includes
extern "C" {
    #include "lua.h"
    #include "lualib.h"
    #include "lauxlib.h"
}

// LuaSys includes
#include "LuaSys.h"

lua_State *L = NULL;

// Lua script to run (alternatively, load from file)
const char *lua_script = R"LUA_SCRIPT(
-- Load sys module
sys = require("sys")

print("\n=== LuaSys Arduino Example ===\n")

-- Task 1: Blink counter
sys.taskInit(function()
    print("[Task1] Starting blink counter")
    for i = 1, 20 do
        print("[Task1] Blink " .. i .. " - LED ON")
        sys.wait(500)
        print("[Task1] Blink " .. i .. " - LED OFF")
        sys.wait(500)
    end
    print("[Task1] Blink counter finished")
end)

-- Task 2: Temperature sensor simulation
sys.taskInit(function()
    print("[Task2] Temperature monitor starting")
    while true do
        local temp = 20 + math.random(-5, 5)
        print("[Task2] Temperature: " .. temp .. "°C")
        sys.wait(2000)
    end
end)

-- Task 3: Message passing demo
sys.taskInit(function()
    print("[Task3] Waiting for DATA_READY message...")
    local success, value = sys.waitUntil("DATA_READY", 10000)
    if success then
        print("[Task3] Received data: " .. value)
    else
        print("[Task3] Timeout waiting for data")
    end
end)

-- Task 4: Send message after delay
sys.taskInit(function()
    sys.wait(3000)
    print("[Task4] Sending DATA_READY message")
    sys.publish("DATA_READY", "Hello from ESP32!")
end)

-- Periodic timer
local timer_count = 0
sys.timerLoopStart(function()
    timer_count = timer_count + 1
    print("[Timer] Tick #" .. timer_count)
end, 5000)

-- Memory monitor
sys.timerLoopStart(function()
    local total, used, max_used = rtos.meminfo()
    print(string.format("[MemInfo] Heap - Total: %d, Used: %d, Max: %d bytes",
                        total, used, max_used))
end, 10000)

print("\n=== Starting event loop ===\n")

-- Start event loop (blocks forever)
sys.run()
)LUA_SCRIPT";

void setup() {
    Serial.begin(115200);
    delay(1000);

    Serial.println("\n\n=================================");
    Serial.println("LuaSys Arduino Example");
    Serial.println("=================================\n");

    // Initialize SPIFFS (or LittleFS)
    if (!SPIFFS.begin(true)) {
        Serial.println("ERROR: Failed to mount SPIFFS");
        return;
    }
    Serial.println("SPIFFS mounted successfully");

    // Create Lua state
    L = luaL_newstate();
    if (L == NULL) {
        Serial.println("ERROR: Failed to create Lua state");
        return;
    }
    Serial.println("Lua state created");

    // Load Lua standard libraries
    luaL_openlibs(L);
    Serial.println("Lua standard libraries loaded");

    // Initialize LuaSys
    if (luaSys_init(L) != 0) {
        Serial.println("ERROR: Failed to initialize LuaSys");
        return;
    }
    Serial.println("LuaSys initialized");

    // Load sys.lua from SPIFFS
    Serial.println("Loading sys.lua from SPIFFS...");
    if (luaL_dofile(L, "/spiffs/sys.lua") != LUA_OK) {
        Serial.printf("ERROR loading sys.lua: %s\n", lua_tostring(L, -1));
        lua_pop(L, 1);
        Serial.println("NOTE: Make sure sys.lua is uploaded to SPIFFS data/ folder");
        return;
    }
    Serial.println("sys.lua loaded successfully");

    // Run the Lua script
    Serial.println("Executing Lua script...\n");
    if (luaL_dostring(L, lua_script) != LUA_OK) {
        Serial.printf("ERROR: %s\n", lua_tostring(L, -1));
        lua_pop(L, 1);
        return;
    }

    // sys.run() blocks forever, so we never reach here
    Serial.println("ERROR: sys.run() returned unexpectedly");
}

void loop() {
    // The event loop is handled by sys.run() in Lua
    // This Arduino loop() will never be called
    vTaskDelay(portMAX_DELAY);
}
