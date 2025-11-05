# LuaSys - Lua Event Loop System for ESP32

A lightweight Lua-based event loop and coroutine scheduler for ESP32 platforms, inspired by [LuatOS](https://github.com/openLuat/LuatOS). Provides cooperative multitasking, timers, and message passing on top of FreeRTOS.

## Features

- **Event Loop**: Main event loop (`sys.run()`) built on FreeRTOS queues
- **Coroutine Tasks**: Lightweight cooperative multitasking with `sys.taskInit()`
- **Timers**: One-shot and repeating timers with callbacks
- **Message Bus**: Publish/subscribe pattern for inter-task communication
- **Low Overhead**: Minimal memory footprint, suitable for embedded systems
- **ESP32 Family Support**: ESP32, ESP32-S2, ESP32-S3, ESP32-C3

## Architecture

```
┌─────────────────────────────────────────┐
│ Lua Layer (sys.lua)                     │
│  - sys.run() event loop                 │
│  - sys.taskInit() coroutine management  │
│  - sys.wait() task delays                │
│  - sys.publish/subscribe messaging      │
└─────────────┬───────────────────────────┘
              │
┌─────────────┴───────────────────────────┐
│ C Binding Layer (luat_lib_rtos.c)       │
│  - rtos.receive() message receiver      │
│  - rtos.timer_start/stop()              │
└─────────────┬───────────────────────────┘
              │
┌─────────────┴───────────────────────────┐
│ Message Bus (luat_msgbus_freertos.c)    │
│  - FreeRTOS xQueue (256 messages)       │
└─────────────┬───────────────────────────┘
              │
┌─────────────┴───────────────────────────┐
│ Timer System (luat_timer_freertos.c)    │
│  - FreeRTOS Software Timers (64 max)    │
│  - Timer ISR → Message Bus              │
└─────────────────────────────────────────┘
```

## Directory Structure

```
lua_sys/
├── include/
│   ├── luat_base.h      # Base definitions
│   ├── luat_msgbus.h    # Message bus API
│   └── luat_timer.h     # Timer API
├── src/
│   ├── luat_msgbus_freertos.c   # Message bus implementation
│   ├── luat_timer_freertos.c    # Timer implementation
│   └── luat_lib_rtos.c           # Lua bindings (rtos module)
├── lua/
│   └── sys.lua          # High-level Lua API
├── examples/
│   ├── example_basic.lua       # Basic usage examples
│   └── example_advanced.lua    # Advanced patterns
├── CMakeLists.txt       # ESP-IDF build configuration
└── README.md
```

## Installation

### ESP-IDF Component

1. Copy `lua_sys` folder to your ESP-IDF project's `components/` directory:
   ```bash
   cp -r lua_sys /path/to/your/project/components/
   ```

2. Ensure you have Lua integrated in your ESP-IDF project

3. Build your project:
   ```bash
   idf.py build
   ```

### Lua Integration

Make sure `sys.lua` is accessible to your Lua runtime:

```c
// In your C code, after initializing Lua:
luaL_dofile(L, "/spiffs/sys.lua");  // If using SPIFFS
// or embed sys.lua directly into firmware
```

## Usage

### Basic Example

```lua
local sys = require("sys")

-- Task 1: Blink LED
sys.taskInit(function()
    while true do
        print("LED ON")
        sys.wait(1000)  -- Wait 1 second
        print("LED OFF")
        sys.wait(1000)
    end
end)

-- Task 2: Counter
sys.taskInit(function()
    for i = 1, 10 do
        print("Count: " .. i)
        sys.wait(500)
    end
end)

-- Start event loop (blocks forever)
sys.run()
```

## API Reference

### Core Functions

#### `sys.run()`
Starts the main event loop. Call this as the last line of your main script.
```lua
sys.run()  -- Blocks forever, processes messages and timers
```

#### `sys.taskInit(func, ...)`
Creates and starts a new task (coroutine).
```lua
sys.taskInit(function(name, count)
    for i = 1, count do
        print(name .. ": " .. i)
        sys.wait(1000)
    end
end, "MyTask", 5)
```

#### `sys.wait(ms)`
Suspend current task for specified milliseconds. Only works inside tasks created with `sys.taskInit()`.
```lua
sys.wait(1000)  -- Wait 1 second
```

### Timer Functions

#### `sys.timerStart(callback, ms, ...)`
Start a one-shot timer.
```lua
sys.timerStart(function(msg)
    print("Timer fired: " .. msg)
end, 3000, "Hello")
```

#### `sys.timerLoopStart(callback, ms, ...)`
Start a repeating timer.
```lua
sys.timerLoopStart(function()
    print("Tick!")
end, 1000)  -- Every second
```

#### `sys.timerStop(id_or_callback, ...)`
Stop a timer by ID or callback function.
```lua
local timer_id = sys.timerStart(callback, 1000)
sys.timerStop(timer_id)

-- Or stop by callback:
sys.timerStop(callback)
```

#### `sys.timerIsActive(id_or_callback, ...)`
Check if a timer is active.
```lua
if sys.timerIsActive(timer_id) then
    print("Timer is running")
end
```

### Message Functions

#### `sys.publish(id, ...)`
Publish a message to all subscribers.
```lua
sys.publish("BUTTON_PRESSED", button_num, timestamp)
```

#### `sys.subscribe(id, callback)`
Subscribe to a message.
```lua
sys.subscribe("BUTTON_PRESSED", function(btn, time)
    print("Button " .. btn .. " pressed at " .. time)
end)
```

#### `sys.unsubscribe(id, callback)`
Unsubscribe from a message.
```lua
sys.unsubscribe("BUTTON_PRESSED", callback)
```

#### `sys.waitUntil(id, timeout_ms)`
Wait for a specific message (only in tasks).
```lua
local success, data = sys.waitUntil("DATA_READY", 5000)
if success then
    print("Got data: " .. data)
else
    print("Timeout")
end
```

### RTOS Functions (Low-Level)

These are typically not called directly by users, but available:

#### `rtos.receive(timeout)`
Block waiting for RTOS message. Used internally by `sys.run()`.

#### `rtos.timer_start(id, timeout_ms, repeat_count)`
Start a low-level timer. Returns 1 on success.

#### `rtos.timer_stop(id)`
Stop a low-level timer.

#### `rtos.meminfo()`
Get memory information.
```lua
local total, used, max_used = rtos.meminfo()
print(string.format("Memory: %d/%d (max: %d)", used, total, max_used))
```

#### `rtos.version()`
Get library version.
```lua
print(rtos.version())  -- "LuaSys-1.0.0"
```

#### `rtos.reboot()`
Reboot the ESP32.
```lua
rtos.reboot()
```

## Examples

See the `examples/` directory for complete examples:

- **example_basic.lua**: Simple tasks, timers, and messaging
- **example_advanced.lua**: Producer/consumer, state machines, watchdog patterns

Run examples:
```lua
dofile("example_basic.lua")
```

## Platform Support

| Platform | Status | Notes |
|----------|--------|-------|
| ESP32    | ✅ Tested | Full support |
| ESP32-S2 | ✅ Tested | Full support |
| ESP32-S3 | ✅ Tested | Full support |
| ESP32-C3 | ✅ Tested | Full support |

## Performance

- **Message Queue**: 256 message slots (configurable)
- **Max Timers**: 64 concurrent timers (configurable)
- **Memory**: ~2KB per task (Lua coroutine overhead)
- **Latency**: <1ms message delivery
- **FreeRTOS Integration**: Zero-copy message passing

## How It Works

### Event Loop Flow

1. **sys.run()** enters infinite loop
2. Calls **sys.safeRun()**:
   - Dispatches internal Lua messages (publish/subscribe)
   - Calls **rtos.receive()** which blocks on FreeRTOS queue
3. When timer fires:
   - Timer ISR posts message to queue
   - **rtos.receive()** returns with timer message
   - Appropriate coroutine is resumed or callback is invoked
4. Repeat

### Task Lifecycle

```lua
sys.taskInit(function()
    -- Task starts here
    print("Starting")

    sys.wait(1000)      -- Yields coroutine, starts timer
    -- ... coroutine suspended ...
    -- Timer fires, posts message, rtos.receive() returns
    -- Coroutine resumed here

    print("After wait")
end)
```

### Message Passing

Internal messages (Lua-to-Lua):
- Stored in Lua table (`messageQueue`)
- Dispatched before blocking on `rtos.receive()`
- Zero-copy, synchronous delivery

RTOS messages (C-to-Lua):
- Posted to FreeRTOS queue
- Retrieved by `rtos.receive()` (blocking)
- Used for timers, interrupts, hardware events

## Debugging

Enable debug logging in your ESP-IDF project:
```
idf.py menuconfig
→ Component config → Log output → Default log verbosity → Debug
```

Or in code:
```c
esp_log_level_set("luat", ESP_LOG_DEBUG);
```

## Integration with Existing Code

LuaSys tasks run in the same FreeRTOS task that calls `sys.run()`. To integrate with other FreeRTOS tasks:

```c
// Create Lua task
void lua_task(void *pvParameters) {
    lua_State *L = luaL_newstate();
    luaL_openlibs(L);

    // Load rtos module
    luaopen_rtos(L);
    lua_setglobal(L, "rtos");

    // Load and run sys.lua and your script
    luaL_dofile(L, "/spiffs/sys.lua");
    luaL_dofile(L, "/spiffs/main.lua");  // Contains sys.run()

    // Never reaches here (sys.run() blocks forever)
}

void app_main() {
    // Create Lua task with sufficient stack
    xTaskCreate(lua_task, "lua_task", 8192, NULL, 5, NULL);
}
```

## Limitations

- Tasks are cooperative (not preemptive within Lua)
- Max 64 concurrent timers (configurable in source)
- Message queue limited to 256 entries
- Timer resolution: 1ms (FreeRTOS tick rate dependent)

## Credits

Inspired by [LuatOS](https://github.com/openLuat/LuatOS) by OpenLuat.

## License

MIT License - see LICENSE file

## Contributing

Contributions welcome! Please test on actual ESP32 hardware before submitting PRs.

## Support

- Report issues on GitHub
- For ESP-IDF help: https://docs.espressif.com/
- For Lua help: https://www.lua.org/manual/5.3/
