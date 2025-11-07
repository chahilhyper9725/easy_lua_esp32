#include "lua_storage.h"
#include <string>
#include <vector>
#include <map>
#include <cstring>

#include "../../core/lua_engine.h"


// ==================== Static Variables (Instead of Class Members) ====================
static bool storage_initialized = false;
static Preferences storage_prefs;
static const char* storage_default_namespace = "lua_storage";
static String storage_current_namespace;
static String storage_temp_buffer; // For string returns

// ==================== Helper Functions ====================
static String compress_key(const String& key) {
    if (key.length() > 15) {
        return key.substring(0, 15);
    }
    return key;
}

// ==================== C++ Function Implementation ====================

bool storage_init_c(void) {
    if (storage_initialized) return true;

    // Use Arduino C++ features
    storage_prefs.begin(storage_current_namespace.c_str(), false);
    storage_initialized = true;

    LOG_INFO(STORAGE_TAG, "Storage initialized with namespace: %s", storage_current_namespace.c_str());
    return true;
}

void storage_stop_c(void) {
    if (!storage_initialized) return;
    
    storage_prefs.end();
    storage_temp_buffer = "";
    storage_initialized = false;

    LOG_INFO(STORAGE_TAG, "Storage stopped and cleaned up");
}

bool storage_set_int_c(const char* key, storage_int_t value) {
    if (!storage_initialized && !storage_init_c()) return false;
    if (!key || strlen(key) == 0) return false;
    
    String compressed_key = compress_key(String(key));
    bool result = storage_prefs.putLong64(compressed_key.c_str(), value) > 0;
    if (result) {
        LOG_DEBUG(STORAGE_TAG, "Set int: %s = %lld", key, value);
    }
    return result;
}

bool storage_set_number_c(const char* key, storage_number_t value) {
    if (!storage_initialized && !storage_init_c()) return false;
    if (!key || strlen(key) == 0) return false;
    
    String compressed_key = compress_key(String(key));
    bool result = storage_prefs.putDouble(compressed_key.c_str(), value) > 0;

    if (result) {
        LOG_DEBUG(STORAGE_TAG, "Set number: %s = %f", key, value);
    }
    return result;
}

bool storage_set_string_c(const char* key, const char* value) {
    if (!storage_initialized && !storage_init_c()) return false;
    if (!key || strlen(key) == 0) return false;
    if (!value) value = "";
    
    String compressed_key = compress_key(String(key));
    bool result = storage_prefs.putString(compressed_key.c_str(), String(value)) > 0;

    if (result) {
        LOG_DEBUG(STORAGE_TAG, "Set string: %s = %s", key, value);
    }
    return result;
}

bool storage_set_bool_c(const char* key, bool value) {
    if (!storage_initialized && !storage_init_c()) return false;
    if (!key || strlen(key) == 0) return false;
    
    String compressed_key = compress_key(String(key));
    bool result = storage_prefs.putBool(compressed_key.c_str(), value) > 0;

    if (result) {
        LOG_DEBUG(STORAGE_TAG, "Set bool: %s = %d", key, value);
    }
    return result;
}

bool storage_set_blob_c(const char* key, const void* data, size_t len) {
    if (!storage_initialized && !storage_init_c()) return false;
    if (!key || strlen(key) == 0 || !data || len == 0) return false;
    
    String compressed_key = compress_key(String(key));
    bool result = storage_prefs.putBytes(compressed_key.c_str(), data, len) > 0;
    
    if (result) {
        //LLOGI("Set blob: %s (%d bytes)", key, len);
    }
    return result;
}

storage_int_t storage_get_int_c(const char* key, storage_int_t defaultValue) {
    if (!storage_initialized && !storage_init_c()) return defaultValue;
    if (!key || strlen(key) == 0) return defaultValue;
    
    String compressed_key = compress_key(String(key));
    storage_int_t result = storage_prefs.getLong64(compressed_key.c_str(), defaultValue);
    
    return result;
}

storage_number_t storage_get_number_c(const char* key, storage_number_t defaultValue) {
    if (!storage_initialized && !storage_init_c()) return defaultValue;
    if (!key || strlen(key) == 0) return defaultValue;
    
    String compressed_key = compress_key(String(key));
    storage_number_t result = storage_prefs.getDouble(compressed_key.c_str(), defaultValue);
    
    return result;
}

const char* storage_get_string_c(const char* key, const char* defaultValue) {
    if (!storage_initialized && !storage_init_c()) {
        storage_temp_buffer = String(defaultValue ? defaultValue : "");
        return storage_temp_buffer.c_str();
    }
    if (!key || strlen(key) == 0) {
        storage_temp_buffer = String(defaultValue ? defaultValue : "");
        return storage_temp_buffer.c_str();
    }
    
    String compressed_key = compress_key(String(key));
    storage_temp_buffer = storage_prefs.getString(compressed_key.c_str(), 
                                                  String(defaultValue ? defaultValue : ""));
    
    return storage_temp_buffer.c_str();
}

bool storage_get_bool_c(const char* key, bool defaultValue) {
    if (!storage_initialized && !storage_init_c()) return defaultValue;
    if (!key || strlen(key) == 0) return defaultValue;
    
    String compressed_key = compress_key(String(key));
    bool result = storage_prefs.getBool(compressed_key.c_str(), defaultValue);
    
    return result;
}

size_t storage_get_blob_c(const char* key, void* buffer, size_t bufferSize) {
    if (!storage_initialized && !storage_init_c()) return 0;
    if (!key || strlen(key) == 0 || !buffer || bufferSize == 0) return 0;
    
    String compressed_key = compress_key(String(key));
    size_t result = storage_prefs.getBytes(compressed_key.c_str(), buffer, bufferSize);
    
    return result;
}

bool storage_remove_c(const char* key) {
    if (!storage_initialized && !storage_init_c()) return false;
    if (!key || strlen(key) == 0) return false;
    
    String compressed_key = compress_key(String(key));
    bool result = storage_prefs.remove(compressed_key.c_str());
    
    if (result) {
        //LLOGI("Removed key: %s", key);
    }
    return result;
}

void storage_clear_c(void) {
    if (!storage_initialized && !storage_init_c()) return;

    storage_prefs.clear();
    //LLOGI("Storage cleared");
}

bool storage_set_namespace_c(const char* namespace_name) {
    if (!namespace_name || strlen(namespace_name) == 0) return false;

    // If already initialized, need to stop and restart with new namespace
    if (storage_initialized) {
        storage_stop_c();
    }

    storage_current_namespace = String(namespace_name);

    // Initialize with new namespace
    return storage_init_c();
}

bool storage_reset_namespace_c(void) {
    // If already initialized, need to stop and restart with default namespace
    if (storage_initialized) {
        storage_stop_c();
    }

    storage_current_namespace = storage_default_namespace;

    // Initialize with default namespace
    return storage_init_c();
}

const char* storage_get_namespace_c(void) {
    storage_temp_buffer = storage_current_namespace;
    return storage_temp_buffer.c_str();
}


// ==================== Lua Interface Implementation ====================

static int l_storage_set(lua_State *L) {
    const char* key = luaL_checkstring(L, 1);
    
    bool result = false;
    
    if (lua_isinteger(L, 2)) {
        storage_int_t value = lua_tointeger(L, 2);
        result = storage_set_int_c(key, value);
    }
    else if (lua_isnumber(L, 2)) {
        storage_number_t value = lua_tonumber(L, 2);
        result = storage_set_number_c(key, value);
    }
    else if (lua_isstring(L, 2)) {
        const char* value = lua_tostring(L, 2);
        result = storage_set_string_c(key, value);
    }
    else if (lua_isboolean(L, 2)) {
        bool value = lua_toboolean(L, 2);
        result = storage_set_bool_c(key, value);
    }
    else if (lua_istable(L, 2)) {
        // Convert table to JSON and store as string
        lua_getglobal(L, "json");
        if (!lua_isnil(L, -1)) {
            lua_getfield(L, -1, "encode");
            if (lua_isfunction(L, -1)) {
                lua_pushvalue(L, 2); // Push the table
                if (lua_pcall(L, 1, 1, 0) == LUA_OK) {
                    if (lua_isstring(L, -1)) {
                        const char* json_str = lua_tostring(L, -1);
                        result = storage_set_string_c(key, json_str);
                    }
                    lua_pop(L, 1); // Pop result
                }
                else {
                    lua_pop(L, 1); // Pop error
                }
            }
            else {
                lua_pop(L, 1); // Pop encode function
            }
        }
        lua_pop(L, 1); // Pop json table
    }
    else {
        return luaL_error(L, "Unsupported data type for storage.set");
    }
    
    lua_pushboolean(L, result);
    return 1;
}

static int l_storage_get(lua_State *L) {
    const char* key = luaL_checkstring(L, 1);
    
    // Try to determine type from default value if provided
    if (lua_gettop(L) >= 2) {
        if (lua_isinteger(L, 2)) {
            storage_int_t defaultVal = lua_tointeger(L, 2);
            storage_int_t result = storage_get_int_c(key, defaultVal);
            lua_pushinteger(L, result);
            return 1;
        }
        else if (lua_isnumber(L, 2)) {
            storage_number_t defaultVal = lua_tonumber(L, 2);
            storage_number_t result = storage_get_number_c(key, defaultVal);
            lua_pushnumber(L, result);
            return 1;
        }
        else if (lua_isstring(L, 2)) {
            const char* defaultVal = lua_tostring(L, 2);
            const char* result = storage_get_string_c(key, defaultVal);
            lua_pushstring(L, result);
            return 1;
        }
        else if (lua_isboolean(L, 2)) {
            bool defaultVal = lua_toboolean(L, 2);
            bool result = storage_get_bool_c(key, defaultVal);
            lua_pushboolean(L, result);
            return 1;
        }
        else if (lua_istable(L, 2)) {
            // Try to get string and decode as JSON
            const char* json_str = storage_get_string_c(key, nullptr);
            if (json_str && strlen(json_str) > 0) {
                lua_getglobal(L, "json");
                if (!lua_isnil(L, -1)) {
                    lua_getfield(L, -1, "decode");
                    if (lua_isfunction(L, -1)) {
                        lua_pushstring(L, json_str);
                        if (lua_pcall(L, 1, 1, 0) == LUA_OK) {
                            lua_remove(L, -2); // Remove json table
                            return 1;
                        }
                        lua_pop(L, 1); // Pop error
                    }
                    else {
                        lua_pop(L, 1); // Pop decode function
                    }
                }
                lua_pop(L, 1); // Pop json table
            }

            // Return default table if string decode failed
            lua_pushvalue(L, 2);
            return 1;
        }
    }
    
    // No default provided, try string first
    const char* result = storage_get_string_c(key, nullptr);
    if (result && strlen(result) > 0) {
        lua_pushstring(L, result);
    }
    else {
        lua_pushnil(L);
    }
    return 1;
}

static int l_storage_remove(lua_State *L) {
    const char* key = luaL_checkstring(L, 1);
    bool result = storage_remove_c(key);
    lua_pushboolean(L, result);
    return 1;
}

static int l_storage_clear(lua_State *L) {
    storage_clear_c();
    return 0;
}



static int l_storage_stop(lua_State *L) {
    storage_stop_c();
    return 0;
}

static int l_storage_set_namespace(lua_State *L) {
    const char* namespace_name = luaL_checkstring(L, 1);
    bool result = storage_set_namespace_c(namespace_name);
    lua_pushboolean(L, result);
    return 1;
}

static int l_storage_reset_namespace(lua_State *L) {
    bool result = storage_reset_namespace_c();
    lua_pushboolean(L, result);
    return 1;
}

static int l_storage_get_namespace(lua_State *L) {
    const char* namespace_name = storage_get_namespace_c();
    lua_pushstring(L, namespace_name);
    return 1;
}

static int l_storage_init(lua_State *L) {
    // Reset to default namespace on every Lua init
    storage_current_namespace = storage_default_namespace;

    // Stop storage if already initialized to reset to default namespace
    if (storage_initialized) {
        storage_stop_c();
    }

    // Initialize storage with default namespace "helios"
    if (!storage_init_c()) {
        return luaL_error(L, "Failed to initialize storage system");
    }

    // Create storage table
    lua_newtable(L);

    // Register functions
    lua_pushcfunction(L, l_storage_set);
    lua_setfield(L, -2, "set");

    lua_pushcfunction(L, l_storage_get);
    lua_setfield(L, -2, "get");

    lua_pushcfunction(L, l_storage_remove);
    lua_setfield(L, -2, "remove");

    lua_pushcfunction(L, l_storage_clear);
    lua_setfield(L, -2, "clear");

    lua_pushcfunction(L, l_storage_stop);
    lua_setfield(L, -2, "stop");

    lua_pushcfunction(L, l_storage_set_namespace);
    lua_setfield(L, -2, "set_namespace");

    lua_pushcfunction(L, l_storage_reset_namespace);
    lua_setfield(L, -2, "reset_namespace");

    lua_pushcfunction(L, l_storage_get_namespace);
    lua_setfield(L, -2, "get_namespace");

    return 1;
}

// Module registration function
int luaopen_storage(lua_State *L) {
    // Create storage table directly in the global environment
    l_storage_init(L);

    // Set the returned table in the global environment as "storage"
    lua_setglobal(L, "storage");

    // Return nothing (we've already set it as a global)
    return 0;
}