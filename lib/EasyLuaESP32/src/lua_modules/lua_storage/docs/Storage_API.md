# Storage API Documentation

## Overview
The Storage module provides persistent key-value storage with automatic type conversion between Lua and C++. It supports integers, floating-point numbers, strings, booleans, and JSON-serialized tables with unified 64-bit integer and double-precision floating-point types for maximum compatibility.

## Quick Start
```lua
-- Store different data types
storage.set("count", 42)
storage.set("rate", 3.14)
storage.set("device_name", "sensor01")
storage.set("enabled", true)
storage.set("config", {threshold = 100, mode = "auto"})

-- Retrieve with type inference from default values
local count = storage.get("count", 0)           -- Returns int64
local rate = storage.get("rate", 0.0)           -- Returns double
local name = storage.get("device_name", "")     -- Returns string
local enabled = storage.get("enabled", false)   -- Returns bool
local config = storage.get("config", {})        -- Returns table
```

## Data Types & Automatic Conversion

The Storage system uses unified data types for cross-platform compatibility:

| Lua Type | Storage Type | C++ Type | Description |
|----------|--------------|----------|-------------|
| `number` (integer) | `int64` | `int64_t` | 64-bit signed integer |
| `number` (float) | `double` | `double` | Double-precision float |
| `string` | `string` | `String` | Text data |
| `boolean` | `bool` | `bool` | True/false values |
| `table` | `blob` | `JSON` | Lua tables serialized as JSON |

### Type Detection Rules
- **storage.set()**: Automatically detects type from the Lua value passed
- **storage.get()**: Infers desired return type from the default value type
- **Automatic Casting**: Numbers can be retrieved as int or double depending on default

```lua
-- Store as number
storage.set("value", 42.7)

-- Retrieve as different types
local as_int = storage.get("value", 0)      -- Returns 42 (truncated)
local as_float = storage.get("value", 0.0)  -- Returns 42.7 (preserved)
local as_string = storage.get("value", "")  -- Returns "42.7"
```

## Function Reference

### storage.set(key, value)
Store data with automatic type detection.

**Parameters:**
- `key` (string): Unique identifier for the data
- `value` (any): Data to store - int, number, string, bool, or table

**Returns:** `boolean` - true if successful, false otherwise

**Examples:**
```lua
storage.set("sensor_count", 4)
storage.set("calibration_factor", 1.234)  
storage.set("device_id", "ESP32-001")
storage.set("debug_mode", true)
storage.set("wifi_config", {ssid = "MyWiFi", channel = 6})
```

### storage.get(key, default_value)
Retrieve data with type inference from default value.

**Parameters:**
- `key` (string): Identifier of the data to retrieve
- `default_value` (any): Value returned if key doesn't exist, also determines return type

**Returns:** Stored value cast to the type of default_value, or default_value if key not found

**Examples:**
```lua
local count = storage.get("sensor_count", 0)        -- int64
local factor = storage.get("calibration_factor", 0.0)  -- double
local id = storage.get("device_id", "unknown")      -- string
local debug = storage.get("debug_mode", false)      -- bool
local config = storage.get("wifi_config", {})       -- table

-- Handle missing keys gracefully
local missing = storage.get("nonexistent", "default") -- Returns "default"
```

### storage.remove(key)
Delete a stored key-value pair.

**Parameters:**
- `key` (string): Identifier to remove

**Returns:** `boolean` - true if key was removed, false if key didn't exist

**Examples:**
```lua
storage.remove("old_setting")
if storage.remove("temp_data") then
    print("Temporary data cleared")
end
```

### storage.clear()
Remove all stored data from the storage namespace.

**Parameters:** None

**Returns:** Nothing

**Warning:** This operation is permanent and cannot be undone.

**Examples:**
```lua
storage.clear()  -- All data is now gone
```

### storage.export(keys_json)
Export specific keys to a JSON string for backup or transfer.

**Parameters:**
- `keys_json` (string): JSON array of key names to export

**Returns:** `string` - JSON object containing the exported key-value pairs

**Examples:**
```lua
-- Export specific settings
local backup = storage.export('["device_id", "wifi_config", "calibration_factor"]')
print("Backup:", backup)
-- Output: {"device_id":"ESP32-001","wifi_config":{"ssid":"MyWiFi"},"calibration_factor":1.234}

-- Export all important settings
local keys = '["sensor_count", "debug_mode", "device_id"]'  
local settings_backup = storage.export(keys)
```

### storage.import(json_string)
Import data from a JSON string, typically from a previous export.

**Parameters:**
- `json_string` (string): JSON object with key-value pairs to import

**Returns:** `boolean` - true if import successful, false if JSON parsing failed

**Examples:**
```lua
-- Restore from backup
local backup_data = '{"device_id":"ESP32-002","sensor_count":8}'
if storage.import(backup_data) then
    print("Settings restored successfully")
else
    print("Failed to restore settings")
end

-- Bulk configuration
local config_json = [[{
    "device_name": "Weather Station",
    "sample_rate": 60,
    "enable_logging": true,
    "thresholds": {"temp": 25.0, "humidity": 80}
}]]
storage.import(config_json)
```

### storage.stop()
Stop any pending storage operations and perform cleanup.

**Parameters:** None

**Returns:** Nothing

**Purpose:** Graceful shutdown function. Call before system restart or shutdown to ensure all data is properly saved.

**Examples:**
```lua
-- Before system restart
storage.stop()
sys.restart("User requested")
```

## Usage Patterns

### Settings Management
```lua
-- Centralized settings with defaults
local function get_settings()
    return {
        volume = storage.get("volume", 50),
        speed = storage.get("motor_speed", 1000),
        wifi_ssid = storage.get("wifi_ssid", ""),
        debug_enabled = storage.get("debug", false),
        sensor_config = storage.get("sensor_config", {
            interval = 5000,
            threshold = 100
        })
    }
end

local function save_settings(settings)
    storage.set("volume", settings.volume)
    storage.set("motor_speed", settings.speed)  
    storage.set("wifi_ssid", settings.wifi_ssid)
    storage.set("debug", settings.debug_enabled)
    storage.set("sensor_config", settings.sensor_config)
end

-- Usage
local settings = get_settings()
settings.volume = 75
save_settings(settings)
```

### Persistent Counters
```lua
local function increment_boot_count()
    local count = storage.get("boot_count", 0)
    count = count + 1
    storage.set("boot_count", count)
    print("System has booted", count, "times")
    return count
end

local function log_error_count()
    local errors = storage.get("error_count", 0)
    storage.set("error_count", errors + 1)
end
```

### Configuration Backup/Restore
```lua
local function backup_system_config()
    local config_keys = '[
        "device_name", "network_config", "sensor_settings", 
        "motor_calibration", "user_preferences"
    ]'
    local backup = storage.export(config_keys)
    
    -- Save to file or send over network
    io.writeFile("/backup.json", backup)
    return backup
end

local function restore_system_config(backup_json)
    if storage.import(backup_json) then
        print("Configuration restored successfully")
        -- Optionally restart system to apply changes
        sys.restart("Configuration restored")
    else
        print("Failed to restore configuration")
    end
end
```

### Data Logging
```lua
local function log_sensor_reading(sensor_id, value, timestamp)
    -- Store latest reading
    storage.set("sensor_" .. sensor_id .. "_latest", {
        value = value,
        timestamp = timestamp
    })
    
    -- Update reading count
    local count_key = "sensor_" .. sensor_id .. "_count"
    local count = storage.get(count_key, 0)
    storage.set(count_key, count + 1)
end

local function get_sensor_summary(sensor_id)
    local latest = storage.get("sensor_" .. sensor_id .. "_latest", {})
    local count = storage.get("sensor_" .. sensor_id .. "_count", 0)
    
    return {
        last_value = latest.value or 0,
        last_reading = latest.timestamp or 0,
        total_readings = count
    }
end
```

## C++ Integration

The Storage module provides C interface functions for use in C++ code:

```cpp
#include "Storage/storage.h"

// Initialize storage system
storage_init_c();

// Store values from C++
storage_set_int_c("cpp_counter", 42);
storage_set_number_c("cpp_ratio", 3.14159);
storage_set_string_c("cpp_name", "C++ Component");
storage_set_bool_c("cpp_enabled", true);

// Retrieve values in C++
int64_t counter = storage_get_int_c("cpp_counter", 0);
double ratio = storage_get_number_c("cpp_ratio", 1.0);
const char* name = storage_get_string_c("cpp_name", "Unknown");
bool enabled = storage_get_bool_c("cpp_enabled", false);

// Cleanup
storage_stop_c();
```

## Testing Code

Copy and paste this test suite to validate Storage functionality:

```lua
-- Comprehensive Storage Test Suite
local function test_storage_complete()
    print("=== Storage Module Test Suite ===")
    local tests_passed = 0
    local tests_total = 0
    
    local function test(name, condition, ...)
        tests_total = tests_total + 1
        if condition then
            tests_passed = tests_passed + 1
            print("✓", name)
        else
            print("✗", name, ...)
        end
    end
    
    -- Test 1: Integer storage and retrieval
    storage.set("test_int", 42)
    test("Integer storage", storage.get("test_int", 0) == 42)
    
    -- Test 2: Float storage and retrieval  
    storage.set("test_float", 3.14159)
    local retrieved_float = storage.get("test_float", 0.0)
    test("Float storage", math.abs(retrieved_float - 3.14159) < 0.00001)
    
    -- Test 3: String storage and retrieval
    storage.set("test_string", "Hello World")
    test("String storage", storage.get("test_string", "") == "Hello World")
    
    -- Test 4: Boolean storage and retrieval
    storage.set("test_bool_true", true)
    storage.set("test_bool_false", false)
    test("Boolean true storage", storage.get("test_bool_true", false) == true)
    test("Boolean false storage", storage.get("test_bool_false", true) == false)
    
    -- Test 5: Table storage and retrieval
    local test_table = {
        name = "test",
        count = 123,
        enabled = true,
        nested = {a = 1, b = 2}
    }
    storage.set("test_table", test_table)
    local retrieved_table = storage.get("test_table", {})
    test("Table storage - name", retrieved_table.name == "test")
    test("Table storage - count", retrieved_table.count == 123)
    test("Table storage - nested", retrieved_table.nested.a == 1)
    
    -- Test 6: Default values for missing keys
    test("Default int", storage.get("missing_int", 99) == 99)
    test("Default string", storage.get("missing_string", "default") == "default")
    test("Default bool", storage.get("missing_bool", true) == true)
    
    -- Test 7: Type conversion
    storage.set("number_value", 42.7)
    test("Type conversion to int", storage.get("number_value", 0) == 42)
    test("Type conversion to float", math.abs(storage.get("number_value", 0.0) - 42.7) < 0.1)
    
    -- Test 8: Key removal
    storage.set("temp_key", "temporary")
    test("Key exists before removal", storage.get("temp_key", "missing") == "temporary")
    storage.remove("temp_key")
    test("Key removed", storage.get("temp_key", "missing") == "missing")
    
    -- Test 9: Export/Import
    storage.set("export_test1", 100)
    storage.set("export_test2", "exported")
    local exported = storage.export('["export_test1", "export_test2"]')
    test("Export returns string", type(exported) == "string" and #exported > 10)
    
    storage.remove("export_test1")
    storage.remove("export_test2") 
    test("Import success", storage.import(exported) == true)
    test("Import restored data", storage.get("export_test1", 0) == 100)
    test("Import restored string", storage.get("export_test2", "") == "exported")
    
    -- Test 10: Large data handling
    local large_table = {}
    for i = 1, 50 do
        large_table["key" .. i] = "value" .. i
    end
    storage.set("large_data", large_table)
    local retrieved_large = storage.get("large_data", {})
    test("Large table storage", retrieved_large.key25 == "value25")
    
    -- Cleanup test data
    local test_keys = {
        "test_int", "test_float", "test_string", "test_bool_true", 
        "test_bool_false", "test_table", "number_value", "export_test1", 
        "export_test2", "large_data"
    }
    for _, key in ipairs(test_keys) do
        storage.remove(key)
    end
    
    -- Results
    print(string.format("=== Test Results: %d/%d passed ===", tests_passed, tests_total))
    if tests_passed == tests_total then
        print("🎉 All tests passed! Storage module is working correctly.")
    else
        print("⚠️  Some tests failed. Check implementation.")
    end
    
    return tests_passed == tests_total
end

-- Run the test suite
test_storage_complete()
```

## Performance Considerations

- **Key Length**: Keys are automatically compressed to 15 characters for ESP32 Preferences compatibility
- **Data Size**: Tables are JSON-serialized, so complex nested structures may use significant storage
- **Write Endurance**: Flash storage has limited write cycles; avoid frequent updates to the same keys
- **Atomic Operations**: Individual set/get operations are atomic, but multiple operations are not transactional

## Error Handling

The Storage module handles errors gracefully:
- Invalid keys return false/default values rather than crashing
- JSON parsing errors in import() return false
- Storage failures are logged but don't halt execution
- Type conversion is automatic and safe (e.g., 42.7 → 42 when retrieved as int)

## Integration with Other Modules

```lua
-- Example: Settings that affect other modules
local function apply_system_settings()
    local volume = storage.get("system_volume", 50)
    local motor_speed = storage.get("motor_speed", 1000)
    local debug_mode = storage.get("debug_enabled", false)
    
    buzzer.set_volume(volume)
    xm.set_default_speed(motor_speed)  -- Hypothetical function
    
    if debug_mode then
        print("Debug mode enabled")
    end
end

-- Call during system initialization
apply_system_settings()
```

This Storage API provides a robust, easy-to-use persistent storage solution that seamlessly integrates with your Lua-based embedded system while maintaining full compatibility with C++ components.