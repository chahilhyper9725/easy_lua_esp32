#include "event_msg.h"
#include "../utils/debug.h"
#include <map>

// ═══════════════════════════════════════════════════════
// INTERNAL STATE
// ═══════════════════════════════════════════════════════

// Decoder state machine states
enum DecoderState {
    STATE_IDLE,          // Waiting for SOH
    STATE_WAIT_STX,      // Waiting for STX after header (skips header bytes)
    STATE_READ_NAME,     // Reading event name
    STATE_READ_DATA,     // Reading event data
    STATE_ESCAPE         // Next byte is escaped
};

// Decoder state
static DecoderState decoder_state = STATE_IDLE;
static String event_name = "";
static std::vector<uint8_t> event_data;  // Dynamic - no size limit
static bool in_name_section = true;

// Encoder state (for auto-incrementing message ID)
static uint16_t next_message_id = 0;

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
    return (byte == MSG_SOH ||byte == MSG_STX || byte == MSG_US || byte == MSG_EOT || byte == MSG_ESC );
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

// Helper: Create and byte-stuff header
// Returns number of bytes written
static uint16_t create_header(uint8_t* buffer, uint16_t index,
                               uint8_t sender_id, uint8_t receiver_id,
                               uint8_t sender_group_id, uint8_t receiver_group_id,
                               uint8_t flags, uint16_t message_id) {
    uint16_t start_idx = index;
    uint16_t stuffed_count = 0;

    LOG_TRACE("ENCODE", "Creating header: sender=%d, receiver=%d, groups=%d/%d, flags=0x%02X, msgID=%d",
              sender_id, receiver_id, sender_group_id, receiver_group_id, flags, message_id);

    // Stuff senderId
    uint16_t old_idx = index;
    index = stuff_byte(sender_id, buffer, index);
    if (index - old_idx > 1) stuffed_count++;

    // Stuff receiverId
    old_idx = index;
    index = stuff_byte(receiver_id, buffer, index);
    if (index - old_idx > 1) stuffed_count++;

    // Stuff senderGroupId
    old_idx = index;
    index = stuff_byte(sender_group_id, buffer, index);
    if (index - old_idx > 1) stuffed_count++;

    // Stuff receiverGroupId
    old_idx = index;
    index = stuff_byte(receiver_group_id, buffer, index);
    if (index - old_idx > 1) stuffed_count++;

    // Stuff flags
    old_idx = index;
    index = stuff_byte(flags, buffer, index);
    if (index - old_idx > 1) stuffed_count++;

    // Stuff messageId (16-bit, big-endian MSB first)
    uint8_t msg_id_msb = (message_id >> 8) & 0xFF;
    uint8_t msg_id_lsb = message_id & 0xFF;

    old_idx = index;
    index = stuff_byte(msg_id_msb, buffer, index);
    if (index - old_idx > 1) stuffed_count++;

    old_idx = index;
    index = stuff_byte(msg_id_lsb, buffer, index);
    if (index - old_idx > 1) stuffed_count++;

    LOG_TRACE("ENCODE", "  Header created: %d bytes (7 logical, %d stuffed)",
              index - start_idx, stuffed_count);

    return index;
}

uint16_t event_msg_encode(const char* name, const uint8_t* data, uint16_t data_len, uint8_t* out_buffer) {
    uint16_t idx = 0;

    LOG_TRACE("ENCODE", "Encoding event '%s' with %d bytes of data", name, data_len);

    // Frame start - SOH
    out_buffer[idx++] = MSG_SOH;
    LOG_TRACE("ENCODE", "  [%d] SOH (0x%02X)", idx-1, MSG_SOH);

    // Create and byte-stuff header
    uint16_t header_start = idx;
    idx = create_header(out_buffer, idx,
                        1,              // senderId
                        0,              // receiverId
                        0,              // senderGroupId
                        0,              // receiverGroupId
                        0,              // flags
                        next_message_id // messageId
    );
    LOG_TRACE("ENCODE", "  [%d-%d] Header stuffed (%d bytes, msgID=%d)",
              header_start, idx-1, idx - header_start, next_message_id);

    // Increment message ID for next send
    next_message_id++;

    // Start of text
    out_buffer[idx++] = MSG_STX;
    LOG_TRACE("ENCODE", "  [%d] STX (0x%02X)", idx-1, MSG_STX);

    // Stuff event name
    uint16_t name_start = idx;
    uint16_t name_len = 0;
    uint16_t name_stuffed = 0;
    for (uint16_t i = 0; name[i] != '\0'; i++) {
        name_len++;
        uint16_t old_idx = idx;
        idx = stuff_byte(name[i], out_buffer, idx);
        if (idx - old_idx > 1) {
            name_stuffed++;
            LOG_TRACE("ENCODE", "    Name byte stuffed: 0x%02X -> ESC+0x%02X", name[i], name[i] ^ MSG_ESC_XOR);
        }
    }
    LOG_TRACE("ENCODE", "  [%d-%d] Event name '%s' (%d chars, %d stuffed)",
              name_start, idx-1, name, name_len, name_stuffed);

    // Unit separator
    out_buffer[idx++] = MSG_US;
    LOG_TRACE("ENCODE", "  [%d] US (0x%02X)", idx-1, MSG_US);

    // Stuff event data
    uint16_t data_start = idx;
    uint16_t data_stuffed = 0;
    for (uint16_t i = 0; i < data_len; i++) {
        uint16_t old_idx = idx;
        idx = stuff_byte(data[i], out_buffer, idx);
        if (idx - old_idx > 1) {
            data_stuffed++;
        }
    }
    LOG_TRACE("ENCODE", "  [%d-%d] Event data (%d bytes, %d stuffed)",
              data_start, idx-1, data_len, data_stuffed);

    // Frame end
    out_buffer[idx++] = MSG_EOT;
    LOG_TRACE("ENCODE", "  [%d] EOT (0x%02X)", idx-1, MSG_EOT);

    LOG_DEBUG("ENCODE", "Encoded '%s': %d bytes total (name=%d, data=%d, stuffed=%d)",
              name, idx, name_len, data_len, name_stuffed + data_stuffed);

    return idx;  // Return total encoded length
}

// ═══════════════════════════════════════════════════════
// PUBLIC API
// ═══════════════════════════════════════════════════════

void event_msg_init(EventSendCallback on_send) {
    LOG_INFO("EVENT", "Initializing event message system");
    send_callback = on_send;
    decoder_state = STATE_IDLE;
    event_name = "";
    event_data.clear();
    in_name_section = true;
    next_message_id = 0;
    event_handlers.clear();
    unhandled_handler = nullptr;
    LOG_DEBUG("EVENT", "Event system initialized - decoder ready");
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
        LOG_ERROR("EVENT", "Cannot send '%s' - no send callback registered", name);
        return;  // No send callback registered
    }

    LOG_DEBUG("EVENT", "Sending event '%s' with %d bytes", name, len);

    // Use static buffer to avoid stack overflow (ESP32 has limited stack)
    static uint8_t buffer[4*1024];  // Static allocation - not on stack
    uint16_t encoded_len = event_msg_encode(name, data, len, buffer);

    LOG_DEBUG("EVENT", "Calling send callback with %d encoded bytes", encoded_len);

    // Send via callback
    send_callback(buffer, encoded_len);

    LOG_TRACE("EVENT", "Event '%s' sent successfully", name);
}

void event_msg_feed_bytes(const uint8_t* data, uint16_t len) {
    LOG_DEBUG("DECODE", "Feeding %d bytes to decoder", len);
    for (uint16_t i = 0; i < len; i++) {
        event_msg_feed_byte(data[i]);
    }
}

void event_msg_reset() {
    LOG_DEBUG("DECODE", "Decoder reset - returning to IDLE state");
    decoder_state = STATE_IDLE;
    event_name = "";
    event_data.clear();
    in_name_section = true;
}

void event_msg_feed_byte(uint8_t byte) {
    LOG_TRACE("DECODE", "RX byte: 0x%02X (state=%d)", byte, decoder_state);

    switch (decoder_state) {

        // ─────────────────────────────────────────────────
        // IDLE: Waiting for frame start (SOH)
        // ─────────────────────────────────────────────────
        case STATE_IDLE:
            if (byte == MSG_SOH) {
                // Frame started - now wait for STX (skip variable-length header)
                LOG_DEBUG("DECODE", "Frame start (SOH) - waiting for STX");
                decoder_state = STATE_WAIT_STX;
            } else {
                LOG_TRACE("DECODE", "Ignoring byte 0x%02X (waiting for SOH)", byte);
            }
            break;

        // ─────────────────────────────────────────────────
        // WAIT_STX: Waiting for STX after header (header may be byte-stuffed)
        // ─────────────────────────────────────────────────
        case STATE_WAIT_STX:
            if (byte == MSG_STX) {
                // STX found - reset state and start reading name
                LOG_DEBUG("DECODE", "STX found - reading event name");
                event_name = "";
                event_data.clear();
                in_name_section = true;
                decoder_state = STATE_READ_NAME;
            } else if (byte == MSG_SOH) {
                // New frame started - restart
                LOG_DEBUG("DECODE", "New SOH while waiting for STX - restarting");
                decoder_state = STATE_WAIT_STX;
            } else {
                LOG_TRACE("DECODE", "Skipping header byte: 0x%02X", byte);
            }
            // Otherwise, keep waiting for STX (skip all header bytes)
            break;

        // ─────────────────────────────────────────────────
        // READ_NAME: Reading event name until US
        // ─────────────────────────────────────────────────
        case STATE_READ_NAME:
            if (byte == MSG_ESC) {
                // Next byte is escaped
                LOG_TRACE("DECODE", "ESC in name - next byte will be unstuffed");
                decoder_state = STATE_ESCAPE;
            } else if (byte == MSG_US) {
                // Name complete, start reading data
                LOG_DEBUG("DECODE", "Event name complete: '%s' - reading data", event_name.c_str());
                in_name_section = false;
                decoder_state = STATE_READ_DATA;
            } else if (byte == MSG_SOH) {
                // New frame started - restart from beginning
                LOG_DEBUG("DECODE", "SOH during name read - frame aborted, restarting");
                decoder_state = STATE_WAIT_STX;
            } else if (byte == MSG_STX) {
                // Unexpected STX - restart frame parsing (already past header)
                LOG_DEBUG("DECODE", "Unexpected STX during name read - restarting frame");
                event_name = "";
                event_data.clear();
                in_name_section = true;
                decoder_state = STATE_READ_NAME;
            } else {
                // Normal character - add to name
                event_name += (char)byte;
                LOG_TRACE("DECODE", "Name char: '%c' (0x%02X) - name so far: '%s'",
                          (char)byte, byte, event_name.c_str());
            }
            break;

        // ─────────────────────────────────────────────────
        // READ_DATA: Reading event data until EOT
        // ─────────────────────────────────────────────────
        case STATE_READ_DATA:
            if (byte == MSG_ESC) {
                // Next byte is escaped
                LOG_TRACE("DECODE", "ESC in data - next byte will be unstuffed");
                decoder_state = STATE_ESCAPE;
            } else if (byte == MSG_EOT) {
                // Frame complete - dispatch to registered handler
                LOG_DEBUG("DECODE", "Frame complete: '%s' with %d bytes of data",
                          event_name.c_str(), event_data.size());

                auto it = event_handlers.find(event_name);
                if (it != event_handlers.end()) {
                    // Handler found - call it
                    LOG_DEBUG("EVENT", "Dispatching '%s' to handler (%d bytes)",
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
            } else if (byte == MSG_SOH) {
                // New frame started - restart from beginning
                LOG_DEBUG("DECODE", "SOH during data read - frame aborted, restarting");
                decoder_state = STATE_WAIT_STX;
            } else if (byte == MSG_STX) {
                // Unexpected STX - restart frame parsing (already past header)
                LOG_DEBUG("DECODE", "Unexpected STX during data read - restarting frame");
                event_name = "";
                event_data.clear();
                in_name_section = true;
                decoder_state = STATE_READ_NAME;
            } else {
                // Normal data byte - add to vector (no size limit)
                event_data.push_back(byte);
                LOG_TRACE("DECODE", "Data byte: 0x%02X (%d bytes total)", byte, event_data.size());
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
                    LOG_TRACE("DECODE", "Unstuffed name byte: 0x%02X -> '%c' (0x%02X)",
                              byte, (char)unstuffed, unstuffed);
                    decoder_state = STATE_READ_NAME;
                } else {
                    // Add unstuffed byte to data (no size limit)
                    event_data.push_back(unstuffed);
                    LOG_TRACE("DECODE", "Unstuffed data byte: 0x%02X -> 0x%02X",
                              byte, unstuffed);
                    decoder_state = STATE_READ_DATA;
                }
            }
            break;
    }
}
