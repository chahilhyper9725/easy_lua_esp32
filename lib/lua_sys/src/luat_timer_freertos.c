/*
 * LuatOS Timer - FreeRTOS Implementation
 * Software timers that post messages to message bus
 */

#include "luat_timer.h"

#define LUAT_TIMER_MAX_COUNT 64

static luat_timer_t* timers[LUAT_TIMER_MAX_COUNT] = {0};

/**
 * Convert milliseconds to FreeRTOS ticks
 */
static inline TickType_t ms_to_ticks(size_t ms) {
    if (ms == 0)
        return 0;
    return pdMS_TO_TICKS(ms);
}

/**
 * Timer callback - runs in timer task context
 * Posts message to message bus for Lua handler
 */
static void luat_timer_callback(TimerHandle_t xTimer) {
    size_t timer_id = (size_t)pvTimerGetTimerID(xTimer);
    luat_timer_t *timer = luat_timer_get(timer_id);

    if (timer == NULL) {
        LLOGE("Timer callback: timer %d not found", timer_id);
        return;
    }

    // Prepare message to post
    rtos_msg_t msg = {
        .handler = timer->func,
        .ptr = timer,
        .arg1 = timer_id,
        .arg2 = 0
    };

    // Post to message bus
    int result = luat_msgbus_put(&msg, 0);
    if (result != 0) {
        LLOGE("Timer callback: failed to post message for timer %d", timer_id);
    }
}

/**
 * Find next available timer slot
 */
static int next_timer_slot(void) {
    for (size_t i = 0; i < LUAT_TIMER_MAX_COUNT; i++) {
        if (timers[i] == NULL) {
            return i;
        }
    }
    return -1;
}

/**
 * Start a timer
 * @param timer Timer configuration
 * @return 0 on success, negative on error
 */
int luat_timer_start(luat_timer_t* timer) {
    if (timer == NULL) {
        LLOGE("luat_timer_start: timer is NULL");
        return -1;
    }

    // Find available slot
    int slot = next_timer_slot();
    if (slot < 0) {
        LLOGE("luat_timer_start: too many timers (max %d)", LUAT_TIMER_MAX_COUNT);
        return -1;
    }

    // Create FreeRTOS timer
    // repeat: 0 = one-shot (pdFALSE), -1 or >0 = auto-reload (pdTRUE)
    UBaseType_t auto_reload = (timer->repeat == 0) ? pdFALSE : pdTRUE;

    TimerHandle_t os_timer = xTimerCreate(
        "luat_timer",                   // Timer name
        ms_to_ticks(timer->timeout),    // Period in ticks
        auto_reload,                    // Auto-reload flag
        (void*)(timer->id),             // Timer ID
        luat_timer_callback             // Callback function
    );

    if (os_timer == NULL) {
        LLOGE("luat_timer_start: xTimerCreate failed");
        return -1;
    }

    timer->os_timer = os_timer;
    timers[slot] = timer;

    // Start the timer
    BaseType_t result = xTimerStart(os_timer, pdMS_TO_TICKS(10));
    if (result != pdPASS) {
        LLOGE("luat_timer_start: xTimerStart failed");
        xTimerDelete(os_timer, pdMS_TO_TICKS(10));
        timers[slot] = NULL;
        timer->os_timer = NULL;
        return -1;
    }

    LLOGD("Timer %d started: timeout=%dms, repeat=%d", timer->id, timer->timeout, timer->repeat);
    return 0;
}

/**
 * Stop a timer
 * @param timer Timer to stop
 * @return 0 on success, 1 on error
 */
int luat_timer_stop(luat_timer_t* timer) {
    if (timer == NULL || timer->os_timer == NULL) {
        return 1;
    }

    // Remove from array
    for (size_t i = 0; i < LUAT_TIMER_MAX_COUNT; i++) {
        if (timers[i] == timer) {
            timers[i] = NULL;
            break;
        }
    }

    // Stop and delete FreeRTOS timer
    TimerHandle_t os_timer = (TimerHandle_t)timer->os_timer;
    xTimerStop(os_timer, pdMS_TO_TICKS(10));
    xTimerDelete(os_timer, pdMS_TO_TICKS(10));
    timer->os_timer = NULL;

    LLOGD("Timer %d stopped", timer->id);
    return 0;
}

/**
 * Get timer by ID
 * @param timer_id Timer ID to search for
 * @return Timer pointer or NULL if not found
 */
luat_timer_t* luat_timer_get(size_t timer_id) {
    for (size_t i = 0; i < LUAT_TIMER_MAX_COUNT; i++) {
        if (timers[i] && timers[i]->id == timer_id) {
            return timers[i];
        }
    }
    return NULL;
}

/**
 * Stop all active timers
 * Called during cleanup or system shutdown
 */
void luat_timer_stop_all(void) {
    LLOGI("Stopping all timers...");
    int stopped_count = 0;

    for (size_t i = 0; i < LUAT_TIMER_MAX_COUNT; i++) {
        if (timers[i] != NULL) {
            luat_timer_t* timer = timers[i];

            // Stop and delete FreeRTOS timer
            if (timer->os_timer != NULL) {
                TimerHandle_t os_timer = (TimerHandle_t)timer->os_timer;
                xTimerStop(os_timer, pdMS_TO_TICKS(100));
                xTimerDelete(os_timer, pdMS_TO_TICKS(100));
                timer->os_timer = NULL;
            }

            // Free timer memory
            luat_heap_free(timer);
            timers[i] = NULL;
            stopped_count++;
        }
    }

    LLOGI("Stopped %d timer(s)", stopped_count);
}

/**
 * Cleanup timer subsystem
 * Stops all timers and releases resources
 */
void luat_timer_cleanup(void) {
    luat_timer_stop_all();
    LLOGI("Timer subsystem cleaned up");
}
