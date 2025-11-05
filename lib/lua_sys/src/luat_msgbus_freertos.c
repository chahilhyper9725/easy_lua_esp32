/*
 * LuatOS Message Bus - FreeRTOS Implementation
 * Provides message queue for async event delivery
 */

#include "luat_msgbus.h"

#define MSGBUS_QUEUE_SIZE 256

static QueueHandle_t xQueue = NULL;

/**
 * Initialize message bus (FreeRTOS queue)
 */
void luat_msgbus_init(void) {
    if (!xQueue) {
        xQueue = xQueueCreate(MSGBUS_QUEUE_SIZE, sizeof(rtos_msg_t));
        if (xQueue) {
            LLOGI("Message bus initialized with %d slots", MSGBUS_QUEUE_SIZE);
        } else {
            LLOGE("Failed to create message queue");
        }
    }
}

/**
 * Put message into queue
 * @param msg Message to send
 * @param timeout Timeout in ticks (0 = no wait, portMAX_DELAY = wait forever)
 * @return 0 on success, 1 on failure
 */
uint32_t luat_msgbus_put(rtos_msg_t* msg, size_t timeout) {
    if (xQueue == NULL) {
        LLOGE("Message bus not initialized");
        return 1;
    }

    // Check if we're in ISR context (ESP32 uses xPortInIsrContext)
    if (xPortInIsrContext()) {
        BaseType_t xHigherPriorityTaskWoken = pdFALSE;
        BaseType_t result = xQueueSendFromISR(xQueue, msg, &xHigherPriorityTaskWoken);
        portYIELD_FROM_ISR(xHigherPriorityTaskWoken);
        return (result == pdTRUE) ? 0 : 1;
    } else {
        BaseType_t result = xQueueSend(xQueue, msg, timeout);
        return (result == pdTRUE) ? 0 : 1;
    }
}

/**
 * Get message from queue (blocking)
 * @param msg Buffer to receive message
 * @param timeout Timeout in ticks (0 = no wait, portMAX_DELAY = wait forever)
 * @return 0 on success, 1 on timeout/failure
 */
uint32_t luat_msgbus_get(rtos_msg_t* msg, size_t timeout) {
    if (xQueue == NULL) {
        LLOGE("Message bus not initialized");
        return 1;
    }

    BaseType_t result = xQueueReceive(xQueue, msg, timeout);
    return (result == pdTRUE) ? 0 : 1;
}

/**
 * Check if message queue is empty
 * @return 1 if empty, 0 if has messages
 */
uint8_t luat_msgbus_is_empty(void) {
    if (xQueue == NULL) {
        return 1;
    }
    return (uxQueueMessagesWaiting(xQueue) == 0) ? 1 : 0;
}
