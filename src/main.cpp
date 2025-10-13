#include <Arduino.h>
#include "core/lua_engine.h"
#include "core/event_msg.h"
#include "comms/ble_comm.h"

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
    // Error already printed by lua_engine, just add spacing
    Serial.println("[ERROR] Lua error: " + String(error_msg));
    event_msg_send("lua_error", (const uint8_t *)error_msg, strlen(error_msg));
    // Serial.println();
}

void onLuaStop()
{
    // Called when Lua execution finishes (success or interrupt)
    Serial.println("[STOP] Lua execution finished");
    event_msg_send("lua_stop", nullptr, 0);
}

// ═══════════════════════════════════════════════════════
// EVENT HANDLERS
// ═══════════════════════════════════════════════════════

// Handler for "test" event
void onTestEvent(const std::vector<uint8_t> &data)
{
    Serial.println("\n[HANDLER] Test event received!");
    Serial.printf("  Data size: %d bytes\n", data.size());
    Serial.print("  Data: ");
    for (uint8_t byte : data)
    {
        Serial.printf("%02X ", byte);
    }
    Serial.println("\n");
}


void onLuaStopEvent(const std::vector<uint8_t> &data)
{
    Serial.println("\n[HANDLER] Lua stop event received");
    lua_engine_stop();

}


// Handler for "lua_execute" event
void onLuaExecuteEvent(const std::vector<uint8_t> &data)
{
    Serial.println("\n[HANDLER] Lua execute event received");

    // Convert data to string (Lua code)
    String code = "";
    for (uint8_t byte : data)
    {
        code += (char)byte;
    }

    Serial.println("  Code: " + code);

    // Execute Lua code
    lua_engine_execute(code.c_str());
}

// Wildcard handler for unhandled events
void onUnhandledEvent(const String &name, const std::vector<uint8_t> &data)
{
    Serial.print("\n[HANDLER] Unhandled event received: '");
    Serial.print(name);
    Serial.println("'");
    Serial.printf("  Data size: %d bytes\n", data.size());
}

// Called when event needs to be sent (sends via BLE)
void onEventSend(const uint8_t *data, uint16_t len)
{
    // Send via BLE
    ble_comm_send(data, len);
}

void test_event_messaging()
{
    Serial.println("\n╔════════════════════════════════════════════╗");
    Serial.println("║       Event Messaging Loopback Test       ║");
    Serial.println("╚════════════════════════════════════════════╝\n");

    // Test data with control characters (tests byte stuffing)
    uint8_t test_data[] = {
        0x00, 0x01, MSG_STX, 0x03, MSG_US, 0x05,
        MSG_ESC, 0x07, 0x08, MSG_EOT, 0xFF};

    Serial.println("[TEST] Sending event 'sensor_data' with binary data:");
    Serial.print("  Original: ");
    for (uint8_t b : test_data)
    {
        Serial.printf("%02X ", b);
    }
    Serial.println("\n");

    // Send event (will encode, send via callback, and loopback to decoder)
    event_msg_send("sensor_data", test_data, sizeof(test_data));

    Serial.println("[TEST] Loopback test complete!\n");
}

// ═══════════════════════════════════════════════════════
// SERIAL HANDLING
// ═══════════════════════════════════════════════════════

String codeBuffer = "";

void processSerial()
{
    while (Serial.available() > 0)
    {
        char c = Serial.read();

        // Ctrl+D (0x04) - Execute code
        if (c == 0x04)
        {
            Serial.println("\n[EXEC] Running code...\n");

            if (codeBuffer.length() > 0)
            {
                lua_engine_execute(codeBuffer.c_str());
                codeBuffer = "";
            }
            else
            {
                Serial.println("[EXEC] No code to execute");
                Serial.println("\n>>> ");
            }
        }
        // Ctrl+C (0x03) - Stop or clear buffer
        else if (c == 0x03)
        {
            if (lua_engine_is_running())
            {
                Serial.println("\n[STOP] Interrupting Lua...");
                lua_engine_stop();
            }
            else
            {
                Serial.println("\n[STOP] Cleared buffer");
                codeBuffer = "";
                Serial.println(">>> ");
            }
        }
        // Backspace (0x08 or 0x7F)
        else if (c == 0x08 || c == 0x7F)
        {
            if (codeBuffer.length() > 0)
            {
                codeBuffer.remove(codeBuffer.length() - 1);
                Serial.print("\b \b");
            }
        }
        // Regular characters
        else
        {
            codeBuffer += c;
            Serial.print(c);
        }
    }
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

    Serial.println("\n[SYSTEM] System ready!");

    // Initialize BLE communication
    ble_comm_init("ESP32_Lua", event_msg_feed_bytes);

    // Initialize event message system
    event_msg_init(onEventSend);

    // Register event handlers
    event_msg_on("test", onTestEvent);
    event_msg_on("lua_execute", onLuaExecuteEvent);
    
    event_msg_on("lua_stop", onLuaStopEvent);
    event_msg_on_unhandled(onUnhandledEvent);

    Serial.println("\n[SYSTEM] BLE and Event messaging ready!");
    Serial.println("[INFO] Connect via BLE to send/receive events");
    Serial.println("[INFO] Registered events: test, lua_execute");
    Serial.println("[INFO] Or use Serial to control Lua directly\n");

    Serial.println(">>> ");
}

// ═══════════════════════════════════════════════════════
// LOOP
// ═══════════════════════════════════════════════════════

void loop()
{
    processSerial();
    delay(1);
}
