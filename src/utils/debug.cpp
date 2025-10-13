#include "debug.h"

// ═══════════════════════════════════════════════════════
// INTERNAL STATE
// ═══════════════════════════════════════════════════════

static uint8_t current_log_level = DEBUG_LOG_LEVEL;

// ═══════════════════════════════════════════════════════
// PUBLIC API
// ═══════════════════════════════════════════════════════

void debug_set_level(uint8_t level) {
    if (level <= LOG_LEVEL_TRACE) {
        current_log_level = level;
        Serial.printf("[DEBUG] Log level set to: %d\n", level);
    }
}

uint8_t debug_get_level() {
    return current_log_level;
}
