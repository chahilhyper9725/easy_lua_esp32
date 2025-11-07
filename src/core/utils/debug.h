#ifndef DEBUG_H
#define DEBUG_H

#include <Arduino.h>

// ═══════════════════════════════════════════════════════
// DEBUG LOG LEVELS
// ═══════════════════════════════════════════════════════

#define LOG_LEVEL_NONE  0   // No logging
#define LOG_LEVEL_ERROR 1   // Only errors
#define LOG_LEVEL_INFO  2   // Info + errors
#define LOG_LEVEL_DEBUG 3   // Debug + info + errors
#define LOG_LEVEL_TRACE 4   // Trace + debug + info + errors (verbose)

// ═══════════════════════════════════════════════════════
// GLOBAL LOG LEVEL SETTING
// ═══════════════════════════════════════════════════════

// Set this to control which messages are printed
// Default: LOG_LEVEL_INFO (shows INFO, ERROR)
#ifndef DEBUG_LOG_LEVEL
#define DEBUG_LOG_LEVEL LOG_LEVEL_INFO
#endif

// ═══════════════════════════════════════════════════════
// PUBLIC API
// ═══════════════════════════════════════════════════════

/**
 * Set the global log level at runtime
 * @param level - One of LOG_LEVEL_* constants
 */
void debug_set_level(uint8_t level);

/**
 * Get the current log level
 * @return Current log level
 */
uint8_t debug_get_level();

// ═══════════════════════════════════════════════════════
// LOG MACROS
// ═══════════════════════════════════════════════════════

// ERROR - Critical errors only
#if DEBUG_LOG_LEVEL >= LOG_LEVEL_ERROR
    #define LOG_ERROR(tag, fmt, ...) \
        Serial.printf("[ERROR][%s] " fmt "\n", tag, ##__VA_ARGS__)
#else
    #define LOG_ERROR(tag, fmt, ...)
#endif

// INFO - General information messages
#if DEBUG_LOG_LEVEL >= LOG_LEVEL_INFO
    #define LOG_INFO(tag, fmt, ...) \
        Serial.printf("[INFO][%s] " fmt "\n", tag, ##__VA_ARGS__)
#else
    #define LOG_INFO(tag, fmt, ...)
#endif

// DEBUG - Detailed debugging information
#if DEBUG_LOG_LEVEL >= LOG_LEVEL_DEBUG
    #define LOG_DEBUG(tag, fmt, ...) \
        Serial.printf("[DEBUG][%s] " fmt "\n", tag, ##__VA_ARGS__)
#else
    #define LOG_DEBUG(tag, fmt, ...)
#endif

// TRACE - Very verbose trace information
#if DEBUG_LOG_LEVEL >= LOG_LEVEL_TRACE
    #define LOG_TRACE(tag, fmt, ...) \
        Serial.printf("[TRACE][%s] " fmt "\n", tag, ##__VA_ARGS__)
#else
    #define LOG_TRACE(tag, fmt, ...)
#endif

// ═══════════════════════════════════════════════════════
// RUNTIME LOG MACROS (check level at runtime)
// ═══════════════════════════════════════════════════════

// These macros check the runtime log level (can be changed on the fly)
#define LOG_ERROR_RT(tag, fmt, ...) \
    do { if (debug_get_level() >= LOG_LEVEL_ERROR) \
        Serial.printf("[ERROR][%s] " fmt "\n", tag, ##__VA_ARGS__); } while(0)

#define LOG_INFO_RT(tag, fmt, ...) \
    do { if (debug_get_level() >= LOG_LEVEL_INFO) \
        Serial.printf("[INFO][%s] " fmt "\n", tag, ##__VA_ARGS__); } while(0)

#define LOG_DEBUG_RT(tag, fmt, ...) \
    do { if (debug_get_level() >= LOG_LEVEL_DEBUG) \
        Serial.printf("[DEBUG][%s] " fmt "\n", tag, ##__VA_ARGS__); } while(0)

#define LOG_TRACE_RT(tag, fmt, ...) \
    do { if (debug_get_level() >= LOG_LEVEL_TRACE) \
        Serial.printf("[TRACE][%s] " fmt "\n", tag, ##__VA_ARGS__); } while(0)

#endif // DEBUG_H
