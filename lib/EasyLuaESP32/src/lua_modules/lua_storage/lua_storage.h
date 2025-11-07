#ifndef STORAGE_H
#define STORAGE_H

#include <Arduino.h>
#include <Preferences.h>
#include <ArduinoJson.h>
#include <string>
#include <vector>
#include <map>
#include "../../core/utils/debug.h"
#include "../../core/lua_engine.h"


// Forward declaration for Lua
struct lua_State;

// Unified data types for cross-platform compatibility
typedef int64_t storage_int_t;   // Use 64-bit int for all integers
typedef double storage_number_t; // Use double for all floating point

// Define tag for logging
#define STORAGE_TAG "STORAGE"

// ==================== C++ Function Interface (No Classes) ====================

// Initialization and cleanup
bool storage_init_c(void);
void storage_stop_c(void);

// Data storage functions with automatic type detection
bool storage_set_int_c(const char* key, storage_int_t value);
bool storage_set_number_c(const char* key, storage_number_t value);
bool storage_set_string_c(const char* key, const char* value);
bool storage_set_bool_c(const char* key, bool value);
bool storage_set_blob_c(const char* key, const void* data, size_t len);

// Data retrieval functions with type casting
storage_int_t storage_get_int_c(const char* key, storage_int_t defaultValue);
storage_number_t storage_get_number_c(const char* key, storage_number_t defaultValue);
const char* storage_get_string_c(const char* key, const char* defaultValue);
bool storage_get_bool_c(const char* key, bool defaultValue);
size_t storage_get_blob_c(const char* key, void* buffer, size_t bufferSize);

// Utility functions
bool storage_remove_c(const char* key);
void storage_clear_c(void);

// Namespace management functions
bool storage_set_namespace_c(const char* namespace_name);
bool storage_reset_namespace_c(void);
const char* storage_get_namespace_c(void);

// Lua module registration function
int luaopen_storage(lua_State* L);

#endif // STORAGE_H