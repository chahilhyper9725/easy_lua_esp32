# User Callbacks Guide

## Overview

The `easy_lua_esp32` system now provides three user callbacks that allow you to extend the system with custom hardware and Lua functions:

1. **Hardware Init** - Initialize your custom hardware
2. **Lua Register** - Register your custom Lua functions
3. **Cleanup** - Cleanup hardware when Lua stops

## System Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    system_init()                             │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  STEP 1: Initialize Core System (Automatic)                 │
│  ├─ Serial (115200 baud)                                    │
│  ├─ Lua Engine                                              │
│  ├─ BLE Communication                                       │
│  ├─ Event System                                            │
│  └─ Storage (LittleFS)                                      │
│                                                              │
│  STEP 2: Register System Modules (Automatic)                │
│  ├─ arduino (GPIO, timers, etc.)                            │
│  ├─ eventmsg (event communication)                          │
│  ├─ storage (file system)                                   │
│  └─ lua_sys (RTOS, timers)                                  │
│                                                              │
│  STEP 3: USER HARDWARE INIT CALLBACK ← You customize here  │
│                                                              │
│  STEP 4: USER LUA REGISTER CALLBACK  ← You customize here  │
│          (called on every Lua state reset)                  │
│                                                              │
│  STEP 5: USER CLEANUP CALLBACK       ← You customize here  │
│          (called when Lua stops)                            │
└─────────────────────────────────────────────────────────────┘
```

## Callback 1: Hardware Initialization

**When:** Called **once** after core system initializes
**Purpose:** Initialize your custom hardware (motors, sensors, LEDs, buttons, etc.)

### Example 1: Basic LED

```cpp
#define LED_PIN 2

void my_hardware_init()
{
    pinMode(LED_PIN, OUTPUT);
    digitalWrite(LED_PIN, HIGH);
    Serial.println("[USER] LED initialized on pin 2");
}
```

### Example 2: Motor Controller

```cpp
#include <ESP32Servo.h>

Servo motor1;
Servo motor2;

void my_hardware_init()
{
    motor1.attach(18);
    motor2.attach(19);
    motor1.write(90);  // Center position
    motor2.write(90);
    Serial.println("[USER] Motors initialized");
}
```

### Example 3: I2C Sensor

```cpp
#include <Wire.h>
#include <Adafruit_BMP280.h>

Adafruit_BMP280 bmp;

void my_hardware_init()
{
    Wire.begin();
    if (bmp.begin(0x76)) {
        Serial.println("[USER] BMP280 sensor initialized");
    } else {
        Serial.println("[USER] BMP280 sensor failed!");
    }
}
```

## Callback 2: Lua Module Registration

**When:** Called **every time** Lua state is created or reset
**Purpose:** Register your custom Lua functions that can be called from Lua scripts

### Example 1: Simple LED Control

```cpp
// C function exposed to Lua
static int lua_led_on(lua_State* L)
{
    digitalWrite(LED_PIN, HIGH);
    Serial.println("[LUA] LED turned ON");
    return 0;  // No return values to Lua
}

static int lua_led_off(lua_State* L)
{
    digitalWrite(LED_PIN, LOW);
    Serial.println("[LUA] LED turned OFF");
    return 0;
}

void my_lua_register(lua_State* L)
{
    // Register functions with Lua
    lua_register(L, "led_on", lua_led_on);
    lua_register(L, "led_off", lua_led_off);

    Serial.println("[USER] LED Lua functions registered");
}
```

**Lua Usage:**
```lua
led_on()   -- Turn LED on
led_off()  -- Turn LED off
```

### Example 2: Motor Control with Parameters

```cpp
static int lua_motor_set(lua_State* L)
{
    // Get parameters from Lua
    int motor_id = lua_tointeger(L, 1);  // First parameter
    int speed = lua_tointeger(L, 2);     // Second parameter

    if (motor_id == 1) {
        motor1.write(speed);
    } else if (motor_id == 2) {
        motor2.write(speed);
    }

    return 0;
}

void my_lua_register(lua_State* L)
{
    lua_register(L, "motor_set", lua_motor_set);
    Serial.println("[USER] Motor Lua functions registered");
}
```

**Lua Usage:**
```lua
motor_set(1, 90)   -- Motor 1 to 90 degrees
motor_set(2, 180)  -- Motor 2 to 180 degrees
```

### Example 3: Sensor Reading with Return Values

```cpp
static int lua_read_temp(lua_State* L)
{
    float temperature = bmp.readTemperature();

    // Push return value to Lua
    lua_pushnumber(L, temperature);

    return 1;  // One return value
}

static int lua_read_pressure(lua_State* L)
{
    float pressure = bmp.readPressure() / 100.0F;  // hPa
    lua_pushnumber(L, pressure);
    return 1;
}

void my_lua_register(lua_State* L)
{
    lua_register(L, "read_temp", lua_read_temp);
    lua_register(L, "read_pressure", lua_read_pressure);
    Serial.println("[USER] Sensor Lua functions registered");
}
```

**Lua Usage:**
```lua
local temp = read_temp()
local press = read_pressure()
print("Temperature: " .. temp .. "°C")
print("Pressure: " .. press .. " hPa")
```

### Example 4: Creating a Lua Table/Module

```cpp
void my_lua_register(lua_State* L)
{
    // Create a table to hold sensor functions
    lua_newtable(L);

    // Add functions to the table
    lua_pushcfunction(L, lua_read_temp);
    lua_setfield(L, -2, "temperature");

    lua_pushcfunction(L, lua_read_pressure);
    lua_setfield(L, -2, "pressure");

    // Set the table as global "sensor"
    lua_setglobal(L, "sensor");

    Serial.println("[USER] Sensor module registered");
}
```

**Lua Usage:**
```lua
local temp = sensor.temperature()
local press = sensor.pressure()
```

## Callback 3: Cleanup

**When:** Called when Lua execution **stops** (not when system shuts down)
**Purpose:** Safely cleanup your hardware (turn off motors, LEDs, etc.)

### Example 1: LED Cleanup

```cpp
void my_cleanup()
{
    digitalWrite(LED_PIN, LOW);
    Serial.println("[USER] LED turned off (cleanup)");
}
```

### Example 2: Motor Cleanup

```cpp
void my_cleanup()
{
    motor1.write(90);  // Return to center
    motor2.write(90);
    Serial.println("[USER] Motors returned to safe position");
}
```

### Example 3: Stop Timers

```cpp
TimerHandle_t myTimer = nullptr;

void my_cleanup()
{
    if (myTimer != nullptr) {
        xTimerStop(myTimer, 0);
        Serial.println("[USER] Timer stopped");
    }
}
```

## Complete Example: Robot with Sensors

```cpp
#include <Arduino.h>
#include <ESP32Servo.h>
#include <Wire.h>
#include <Adafruit_BMP280.h>
#include "system_init/system_init.h"

// Hardware objects
Servo motor1, motor2;
Adafruit_BMP280 bmp;
#define LED_PIN 2

// ═══════════════════════════════════════════════════════════
// HARDWARE INIT
// ═══════════════════════════════════════════════════════════

void my_hardware_init()
{
    // LED
    pinMode(LED_PIN, OUTPUT);
    digitalWrite(LED_PIN, LOW);

    // Motors
    motor1.attach(18);
    motor2.attach(19);
    motor1.write(90);
    motor2.write(90);

    // Sensor
    Wire.begin();
    bmp.begin(0x76);

    Serial.println("[USER] Robot hardware initialized");
}

// ═══════════════════════════════════════════════════════════
// LUA FUNCTIONS
// ═══════════════════════════════════════════════════════════

static int lua_motor(lua_State* L)
{
    int id = lua_tointeger(L, 1);
    int speed = lua_tointeger(L, 2);

    if (id == 1) motor1.write(speed);
    else if (id == 2) motor2.write(speed);

    return 0;
}

static int lua_led(lua_State* L)
{
    int state = lua_tointeger(L, 1);
    digitalWrite(LED_PIN, state);
    return 0;
}

static int lua_temp(lua_State* L)
{
    float temp = bmp.readTemperature();
    lua_pushnumber(L, temp);
    return 1;
}

void my_lua_register(lua_State* L)
{
    // Create "robot" module
    lua_newtable(L);

    lua_pushcfunction(L, lua_motor);
    lua_setfield(L, -2, "motor");

    lua_pushcfunction(L, lua_led);
    lua_setfield(L, -2, "led");

    lua_pushcfunction(L, lua_temp);
    lua_setfield(L, -2, "temp");

    lua_setglobal(L, "robot");

    Serial.println("[USER] Robot Lua module registered");
}

// ═══════════════════════════════════════════════════════════
// CLEANUP
// ═══════════════════════════════════════════════════════════

void my_cleanup()
{
    motor1.write(90);
    motor2.write(90);
    digitalWrite(LED_PIN, LOW);
    Serial.println("[USER] Robot hardware cleaned up");
}

// ═══════════════════════════════════════════════════════════
// MAIN
// ═══════════════════════════════════════════════════════════

void setup()
{
    system_init(my_hardware_init, my_lua_register, my_cleanup);
}

void loop()
{
    delay(1);
}
```

**Lua Usage:**
```lua
-- Control robot from Lua
robot.led(1)           -- Turn on LED
robot.motor(1, 180)    -- Move motor 1
robot.motor(2, 0)      -- Move motor 2

local temp = robot.temp()
print("Temperature: " .. temp)

robot.led(0)           -- Turn off LED
```

## System Modules (Automatically Available)

The following modules are **automatically registered** and available in Lua:

### 1. arduino module
```lua
pinMode(pin, mode)
digitalWrite(pin, value)
digitalRead(pin)
analogRead(pin)
analogWrite(pin, value)
delay(ms)
millis()
micros()
```

### 2. eventmsg module
```lua
eventmsg.send(name, data)
eventmsg.on(name, callback)
```

### 3. storage module
```lua
storage.write(filename, data)
storage.read(filename)
storage.delete(filename)
storage.list()
```

### 4. lua_sys module (RTOS)
```lua
rtos.sleep(ms)
rtos.timer_start(id, period, callback)
rtos.timer_stop(id)
```

## Execution Flow

```
┌──────────────────────────────────────────┐
│  1. User connects via BLE                │
│  2. Send "lua_code_add" event with code  │
│  3. Send "lua_code_run" event            │
└────────────────┬─────────────────────────┘
                 │
                 ▼
┌──────────────────────────────────────────┐
│  Lua State Created/Reset                 │
│  ├─ System modules registered            │
│  └─ my_lua_register() called ←───────────┼─ Your functions available
└────────────────┬─────────────────────────┘
                 │
                 ▼
┌──────────────────────────────────────────┐
│  Lua Script Executes                     │
│  (Uses system + user functions)          │
└────────────────┬─────────────────────────┘
                 │
                 ▼
┌──────────────────────────────────────────┐
│  Lua Stops (finished or interrupted)     │
│  ├─ System cleanup (timers, etc.)        │
│  └─ my_cleanup() called ←────────────────┼─ Your hardware cleaned up
└──────────────────────────────────────────┘
```

## Best Practices

1. **Hardware Init**
   - Initialize pins and peripherals
   - Set safe default states
   - Don't block for too long (system is initializing)

2. **Lua Register**
   - Keep functions simple and fast
   - Validate parameters from Lua
   - Return meaningful values
   - Use tables/modules for organization

3. **Cleanup**
   - Turn off motors/LEDs
   - Stop timers
   - Return hardware to safe state
   - Don't allocate memory here

4. **Error Handling**
   - Check Lua parameter types
   - Validate hardware responses
   - Use Serial for debugging

## Migration from Old API

**Old API (before):**
```cpp
void setup() {
    system_init();  // No parameters
}
```

**New API (now):**
```cpp
void my_hardware_init() { /* your code */ }
void my_lua_register(lua_State* L) { /* your code */ }
void my_cleanup() { /* your code */ }

void setup() {
    system_init(my_hardware_init, my_lua_register, my_cleanup);
}
```

All three callbacks are **required** (can be empty functions but must be provided).
