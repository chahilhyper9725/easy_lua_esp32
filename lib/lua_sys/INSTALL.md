# LuaSys Installation Guide

## For Arduino IDE

### 1. Install Prerequisites

#### Install ESP32 Board Support
1. Open Arduino IDE
2. Go to **File > Preferences**
3. Add to **Additional Board Manager URLs**:
   ```
   https://raw.githubusercontent.com/espressif/arduino-esp32/gh-pages/package_esp32_index.json
   ```
4. Go to **Tools > Board > Boards Manager**
5. Search for "esp32" and install **esp32 by Espressif Systems**

#### Install Lua Library
You need a Lua 5.3+ library for ESP32. Options:

**Option A: Using satoren/lua-arduino** (recommended)
1. Download from: https://github.com/satoren/lua-arduino
2. Extract to Arduino `libraries/` folder
3. Rename folder to `Lua`

**Option B: Manual Lua integration**
- Build Lua 5.3 or 5.4 for ESP32
- Add to your project's include path

### 2. Install LuaSys Library

**Option A: Manual Installation**
1. Download this repository
2. Copy the `lua_sys` folder to Arduino `libraries/` folder
3. Rename to `LuaSys` (optional)

**Option B: Arduino Library Manager** (if published)
1. Go to **Sketch > Include Library > Manage Libraries**
2. Search for "LuaSys"
3. Click Install

### 3. Upload sys.lua to ESP32 Filesystem

#### Using Arduino ESP32 Filesystem Uploader

1. Install the uploader plugin:
   - Download from: https://github.com/me-no-dev/arduino-esp32fs-plugin
   - Extract to `Arduino/tools/` folder

2. Create `data/` folder in your sketch directory

3. Copy `lua/sys.lua` to `data/` folder:
   ```
   YourSketch/
   ├── YourSketch.ino
   └── data/
       └── sys.lua
   ```

4. In Arduino IDE:
   - Go to **Tools > ESP32 Sketch Data Upload**
   - Wait for upload to complete

### 4. Run Example

1. Open **File > Examples > LuaSys > BasicExample**
2. Select your board: **Tools > Board > ESP32 Dev Module** (or your specific board)
3. Select port: **Tools > Port > COMx / /dev/ttyUSBx**
4. Click Upload
5. Open Serial Monitor (**Tools > Serial Monitor**, 115200 baud)

---

## For PlatformIO

### 1. Create New Project

```bash
pio project init --board esp32dev
```

### 2. Add LuaSys as Library

Edit `platformio.ini`:

```ini
[env:esp32dev]
platform = espressif32
board = esp32dev
framework = arduino
monitor_speed = 115200

lib_deps =
    https://github.com/satoren/lua-arduino.git
    https://github.com/yourusername/lua_sys.git  ; Replace with actual repo
```

Or place `lua_sys` folder in your project's `lib/` directory.

### 3. Setup Filesystem

1. Create `data/` folder in project root

2. Copy `sys.lua`:
   ```bash
   cp lua_sys/lua/sys.lua data/sys.lua
   ```

3. Upload filesystem:
   ```bash
   pio run -t uploadfs
   ```

### 4. Create main.cpp

```cpp
#include <Arduino.h>
extern "C" {
    #include "lua.h"
    #include "lualib.h"
    #include "lauxlib.h"
}
#include <LuaSys.h>
#include <SPIFFS.h>

lua_State *L;

const char *script = R"(
sys = require("sys")
sys.taskInit(function()
    while true do
        print("Hello from Lua!")
        sys.wait(1000)
    end
end)
sys.run()
)";

void setup() {
    Serial.begin(115200);
    SPIFFS.begin(true);

    L = luaL_newstate();
    luaL_openlibs(L);
    luaSys_init(L);

    luaL_dofile(L, "/spiffs/sys.lua");
    luaL_dostring(L, script);
}

void loop() {
    vTaskDelay(portMAX_DELAY);
}
```

### 5. Build and Upload

```bash
pio run -t upload && pio device monitor
```

---

## For ESP-IDF (CMake)

### 1. Setup ESP-IDF

Follow official guide: https://docs.espressif.com/projects/esp-idf/en/latest/esp32/get-started/

### 2. Add as Component

Copy `lua_sys` to your project's `components/` directory:

```
your_project/
├── main/
│   └── main.c
├── components/
│   ├── lua/          # Lua interpreter component
│   └── lua_sys/      # This library
└── CMakeLists.txt
```

### 3. Update CMakeLists.txt

Project `CMakeLists.txt`:
```cmake
cmake_minimum_required(VERSION 3.5)
include($ENV{IDF_PATH}/tools/cmake/project.cmake)
project(your_project)
```

`main/CMakeLists.txt`:
```cmake
idf_component_register(
    SRCS "main.c"
    INCLUDE_DIRS "."
    REQUIRES lua lua_sys
)
```

### 4. Write main.c

```c
#include <stdio.h>
#include "freertos/FreeRTOS.h"
#include "freertos/task.h"
#include "lua.h"
#include "lualib.h"
#include "lauxlib.h"
#include "LuaSys.h"

void app_main(void) {
    lua_State *L = luaL_newstate();
    luaL_openlibs(L);
    luaSys_init(L);

    // Load sys.lua from filesystem or embed it
    luaL_dostring(L, "sys = require('sys')");

    // Run your Lua script
    luaL_dostring(L, "sys.taskInit(function() "
                     "  while true do "
                     "    print('Hello!') "
                     "    sys.wait(1000) "
                     "  end "
                     "end) "
                     "sys.run()");
}
```

### 5. Build and Flash

```bash
idf.py build
idf.py flash monitor
```

---

## Verification

After installation, you should see output like:

```
=== LuaSys Module Loading ===
=== LuaSys Arduino Example ===

[Task1] Starting blink counter
[Task2] Temperature monitor starting
[Task3] Waiting for DATA_READY message...
[Task4] Will send DATA_READY in 3 seconds...

=== Starting event loop ===

[Task1] Blink 1 - LED ON
[Timer] Tick #1
[Task2] Temperature: 23°C
...
```

## Troubleshooting

### sys.lua not found
- Ensure sys.lua is uploaded to SPIFFS/LittleFS
- Check file path: should be `/spiffs/sys.lua` or `/littlefs/sys.lua`
- Verify filesystem is mounted before loading

### Lua library not found
- Install lua-arduino library
- Check library is in Arduino `libraries/` or PlatformIO `lib_deps`

### Build errors about FreeRTOS
- Ensure you're targeting ESP32 platform
- Check board selection in Arduino IDE or platformio.ini

### Stack overflow
- Increase Lua task stack size in Arduino:
  ```cpp
  xTaskCreate(lua_task, "lua", 16384, NULL, 5, NULL);  // 16KB stack
  ```

## Next Steps

- Read [README.md](README.md) for API documentation
- Check [examples/](examples/) for more complex usage
- Integrate with your existing code

## Support

- GitHub Issues: [Report a problem]
- Documentation: [README.md](README.md)
- Examples: [examples/](examples/)
