/*
 * LuatOS Base Definitions - Minimal Core
 * Compatible with ESP32 (all variants: ESP32, ESP32-S2, ESP32-S3, ESP32-C3)
 */

#ifndef LUAT_BASE_H
#define LUAT_BASE_H

#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <stdint.h>

// Lua includes (use lua.hpp from C++, individual headers from C)
#ifdef __cplusplus
    #include "lua.hpp"
#else
    #include "lua.h"
    #include "lualib.h"
    #include "lauxlib.h"
#endif

// FreeRTOS includes
#include "freertos/FreeRTOS.h"
#include "freertos/task.h"
#include "freertos/queue.h"
#include "freertos/timers.h"

// ESP-IDF includes
#include "esp_log.h"
#include "esp_system.h"

// Platform detection
#if defined(CONFIG_IDF_TARGET_ESP32)
    #define LUAT_PLATFORM_ESP32
#elif defined(CONFIG_IDF_TARGET_ESP32S2)
    #define LUAT_PLATFORM_ESP32S2
#elif defined(CONFIG_IDF_TARGET_ESP32S3)
    #define LUAT_PLATFORM_ESP32S3
#elif defined(CONFIG_IDF_TARGET_ESP32C3)
    #define LUAT_PLATFORM_ESP32C3
#else
    #define LUAT_PLATFORM_ESP32
#endif

// Memory allocation macros
#define luat_heap_malloc(size)      malloc(size)
#define luat_heap_free(ptr)         free(ptr)

// Logging macros
#define LUAT_LOG_TAG "luat"
#define LLOGD(fmt, ...) ESP_LOGD(LUAT_LOG_TAG, fmt, ##__VA_ARGS__)
#define LLOGI(fmt, ...) ESP_LOGI(LUAT_LOG_TAG, fmt, ##__VA_ARGS__)
#define LLOGW(fmt, ...) ESP_LOGW(LUAT_LOG_TAG, fmt, ##__VA_ARGS__)
#define LLOGE(fmt, ...) ESP_LOGE(LUAT_LOG_TAG, fmt, ##__VA_ARGS__)

// Module registration
#define LUAMOD_API extern

#endif // LUAT_BASE_H
