/*
 * LuatOS Timer - FreeRTOS Software Timer Implementation
 * Provides timer support for sys.wait() and sys.timerStart()
 */

#ifndef LUAT_TIMER_H
#define LUAT_TIMER_H

#include "luat_base.h"
#include "luat_msgbus.h"

#ifdef __cplusplus
extern "C" {
#endif

// Timer structure
typedef struct luat_timer {
    size_t id;                  // Timer ID
    size_t timeout;             // Timeout in milliseconds
    int repeat;                 // Repeat count (-1=infinite, 0=once, >0=count)
    luat_msg_handler func;      // Handler function
    void* os_timer;             // OS-specific timer handle (TimerHandle_t)
} luat_timer_t;

// Timer API
int luat_timer_start(luat_timer_t* timer);
int luat_timer_stop(luat_timer_t* timer);
luat_timer_t* luat_timer_get(size_t timer_id);

// Cleanup API
void luat_timer_stop_all(void);
void luat_timer_cleanup(void);

#ifdef __cplusplus
}
#endif

#endif // LUAT_TIMER_H
