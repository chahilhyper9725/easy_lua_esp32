#include "event_msg.h"
#include "../utils/debug.h"
#include <map>

// ═══════════════════════════════════════════════════════
// INTERNAL STATE
// ═══════════════════════════════════════════════════════

// Decoder state machine states
enum DecoderState {
    STATE_IDLE,        // Waiting for STX
    STATE_READ_NAME,   // Reading event name
    STATE_READ_DATA,   // Reading event data
    STATE_ESCAPE       // Next byte is escaped
};

// Decoder state
static DecoderState decoder_state = STATE_IDLE;
static String event_name = "";
static std::vector<uint8_t> event_data;  // Dynamic - no size limit
static bool in_name_section = true;

// Event handler registry
static std::map<String, EventHandler> event_handlers;
static UnhandledEventHandler unhandled_handler = nullptr;

// Send callback
static EventSendCallback send_callback = nullptr;

// ═══════════════════════════════════════════════════════
// ENCODER (with byte stuffing)
// ═══════════════════════════════════════════════════════

// Helper: Check if byte needs stuffing
static bool needs_stuffing(uint8_t byte) {
    return (byte == MSG_STX || byte == MSG_US || byte == MSG_EOT || byte == MSG_ESC);
}

// Helper: Stuff a single byte into buffer
static uint16_t stuff_byte(uint8_t byte, uint8_t* buffer, uint16_t index) {
    if (needs_stuffing(byte)) {
        buffer[index++] = MSG_ESC;
        buffer[index++] = byte ^ MSG_ESC_XOR;
    } else {
        buffer[index++] = byte;
    }
    return index;
}

uint16_t event_msg_encode(const char* name, const uint8_t* data, uint16_t data_len, uint8_t* out_buffer) {
    uint16_t idx = 0;

    // Frame start
    out_buffer[idx++] = MSG_STX;

    // Stuff event name
    for (uint16_t i = 0; name[i] != '\0'; i++) {
        idx = stuff_byte(name[i], out_buffer, idx);
    }

    // Unit separator
    out_buffer[idx++] = MSG_US;

    // Stuff event data
    for (uint16_t i = 0; i < data_len; i++) {
        idx = stuff_byte(data[i], out_buffer, idx);
    }

    // Frame end
    out_buffer[idx++] = MSG_EOT;

    return idx;  // Return total encoded length
}

// ═══════════════════════════════════════════════════════
// PUBLIC API
// ═══════════════════════════════════════════════════════

void event_msg_init(EventSendCallback on_send) {
    send_callback = on_send;
    decoder_state = STATE_IDLE;
    event_name = "";
    event_data.clear();
    in_name_section = true;
    event_handlers.clear();
    unhandled_handler = nullptr;
}

void event_msg_on(const char* event_name, EventHandler handler) {
    if (handler != nullptr) {
        event_handlers[String(event_name)] = handler;
        LOG_DEBUG("EVENT", "Registered handler for '%s'", event_name);
    }
}

void event_msg_on_unhandled(UnhandledEventHandler handler) {
    unhandled_handler = handler;
    LOG_DEBUG("EVENT", "Registered unhandled event handler");
}

void event_msg_send(const char* name, const uint8_t* data, uint16_t len) {
    if (send_callback == nullptr) {
        return;  // No send callback registered
    }

    // Encode event into temporary buffer
    uint8_t buffer[1024];  // Reasonable max frame size
    uint16_t encoded_len = event_msg_encode(name, data, len, buffer);

    // Send via callback
    send_callback(buffer, encoded_len);
}

void event_msg_feed_bytes(const uint8_t* data, uint16_t len) {
    for (uint16_t i = 0; i < len; i++) {
        event_msg_feed_byte(data[i]);
    }
}

void event_msg_reset() {
    decoder_state = STATE_IDLE;
    event_name = "";
    event_data.clear();
    in_name_section = true;
}

void event_msg_feed_byte(uint8_t byte) {
    switch (decoder_state) {

        // ─────────────────────────────────────────────────
        // IDLE: Waiting for frame start
        // ─────────────────────────────────────────────────
        case STATE_IDLE:
            if (byte == MSG_STX) {
                // Frame started - reset state
                event_name = "";
                event_data.clear();
                in_name_section = true;
                decoder_state = STATE_READ_NAME;
            }
            break;

        // ─────────────────────────────────────────────────
        // READ_NAME: Reading event name until US
        // ─────────────────────────────────────────────────
        case STATE_READ_NAME:
            if (byte == MSG_ESC) {
                // Next byte is escaped
                decoder_state = STATE_ESCAPE;
            } else if (byte == MSG_US) {
                // Name complete, start reading data
                in_name_section = false;
                decoder_state = STATE_READ_DATA;
            } else if (byte == MSG_STX) {
                // Unexpected STX - restart frame
                event_msg_reset();
                decoder_state = STATE_READ_NAME;
            } else {
                // Normal character - add to name
                event_name += (char)byte;
            }
            break;

        // ─────────────────────────────────────────────────
        // READ_DATA: Reading event data until EOT
        // ─────────────────────────────────────────────────
        case STATE_READ_DATA:
            if (byte == MSG_ESC) {
                // Next byte is escaped
                decoder_state = STATE_ESCAPE;
            } else if (byte == MSG_EOT) {
                // Frame complete - dispatch to registered handler
                auto it = event_handlers.find(event_name);
                if (it != event_handlers.end()) {
                    // Handler found - call it
                    LOG_TRACE("EVENT", "Dispatching '%s' (%d bytes)",
                              event_name.c_str(), event_data.size());
                    it->second(event_data);
                } else if (unhandled_handler != nullptr) {
                    // No specific handler, call unhandled handler with event name
                    LOG_DEBUG("EVENT", "Unhandled event '%s', calling wildcard handler",
                              event_name.c_str());
                    unhandled_handler(event_name, event_data);
                } else {
                    // No handler registered
                    LOG_DEBUG("EVENT", "Warning: No handler for '%s'", event_name.c_str());
                }
                // Reset for next frame
                event_msg_reset();
            } else if (byte == MSG_STX) {
                // Unexpected STX - restart frame
                event_msg_reset();
                decoder_state = STATE_READ_NAME;
            } else {
                // Normal data byte - add to vector (no size limit)
                event_data.push_back(byte);
            }
            break;

        // ─────────────────────────────────────────────────
        // ESCAPE: Unstuff next byte
        // ─────────────────────────────────────────────────
        case STATE_ESCAPE:
            {
                uint8_t unstuffed = byte ^ MSG_ESC_XOR;

                if (in_name_section) {
                    // Add unstuffed byte to name
                    event_name += (char)unstuffed;
                    decoder_state = STATE_READ_NAME;
                } else {
                    // Add unstuffed byte to data (no size limit)
                    event_data.push_back(unstuffed);
                    decoder_state = STATE_READ_DATA;
                }
            }
            break;
    }
}
