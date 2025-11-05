/*
 * LuatOS Message Bus - FreeRTOS Queue Implementation
 * Core event delivery system for sys.run()
 */

#ifndef LUAT_MSGBUS_H
#define LUAT_MSGBUS_H

#include "luat_base.h"

#ifdef __cplusplus
extern "C" {
#endif

// Message types
#define MSG_TIMER   1

// Message handler function pointer
typedef int (*luat_msg_handler)(lua_State *L, void* ptr);

// Message structure
typedef struct rtos_msg {
    luat_msg_handler handler;   // Handler function to call
    void* ptr;                  // Pointer to data
    int arg1;                   // Argument 1
    int arg2;                   // Argument 2
} rtos_msg_t;

// Message bus API
void luat_msgbus_init(void);
uint32_t luat_msgbus_put(rtos_msg_t* msg, size_t timeout);
uint32_t luat_msgbus_get(rtos_msg_t* msg, size_t timeout);
uint8_t luat_msgbus_is_empty(void);

#ifdef __cplusplus
}
#endif

#endif // LUAT_MSGBUS_H
