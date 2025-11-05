/**
 * EVENT MESSAGE PROTOCOL - JavaScript Implementation
 *
 * Binary-safe event messaging protocol with byte stuffing
 * Compatible with ESP32 event_msg.cpp implementation
 *
 * Frame Format:
 *   [SOH] [7-byte header] [STX] [Stuffed Event Name] [US] [Stuffed Event Data] [EOT]
 *
 * Header Format (7 bytes):
 *   senderId (1 byte)
 *   receiverId (1 byte)
 *   senderGroupId (1 byte)
 *   receiverGroupId (1 byte)
 *   flags (1 byte)
 *   messageId (2 bytes, big-endian MSB first)
 *
 * Control Characters:
 *   SOH  = 0x01 (Start of Header)
 *   STX  = 0x02 (Start of Text)
 *   US   = 0x1F (Unit Separator - between name and data)
 *   EOT  = 0x04 (End of Transmission)
 *   ESC  = 0x1B (Escape for byte stuffing)
 *
 * Byte Stuffing:
 *   If payload contains STX, US, EOT, or ESC:
 *     Send: [ESC][byte XOR 0x20]
 *   On receive:
 *     If ESC found: Next byte XOR 0x20
 */

// ═══════════════════════════════════════════════════════
// CONTROL CHARACTERS
// ═══════════════════════════════════════════════════════

const MSG_SOH = 0x01;      // Start of Header
const MSG_STX = 0x02;      // Start of Text
const MSG_US = 0x1F;       // Unit Separator
const MSG_EOT = 0x04;      // End of Transmission
const MSG_ESC = 0x1B;      // Escape
const MSG_ESC_XOR = 0x20;  // XOR mask for stuffing

// Header constants
const MSG_HEADER_SIZE = 7;

// Global message ID counter (auto-increments)
let nextMessageId = 0;

// ═══════════════════════════════════════════════════════
// ENCODER (with byte stuffing)
// ═══════════════════════════════════════════════════════

/**
 * Check if byte needs stuffing
 */
function needsStuffing(byte) {
    return (byte === MSG_STX || byte === MSG_US || byte === MSG_EOT || byte === MSG_ESC);
}

/**
 * Stuff a single byte into output array
 */
function stuffByte(byte, output) {
    if (needsStuffing(byte)) {
        output.push(MSG_ESC);
        output.push(byte ^ MSG_ESC_XOR);
    } else {
        output.push(byte);
    }
}

/**
 * Encode an event into a byte array
 * @param {string} name - Event name
 * @param {Uint8Array|Array|string} data - Event data (can be binary or string)
 * @returns {Uint8Array} - Encoded frame
 */
export function encodeEvent(name, data = null) {
    const output = [];

    // Frame start - SOH
    output.push(MSG_SOH);

    // 7-byte header (fixed values)
    output.push(1);  // senderId
    output.push(0);  // receiverId
    output.push(0);  // senderGroupId
    output.push(0);  // receiverGroupId
    output.push(0);  // flags

    // messageId (16-bit, big-endian MSB first)
    output.push((nextMessageId >> 8) & 0xFF);  // MSB
    output.push(nextMessageId & 0xFF);         // LSB

    // Increment message ID for next send
    nextMessageId = (nextMessageId + 1) & 0xFFFF;  // Wrap at 16-bit

    // Start of text
    output.push(MSG_STX);

    // Stuff event name (convert string to bytes)
    for (let i = 0; i < name.length; i++) {
        stuffByte(name.charCodeAt(i), output);
    }

    // Unit separator
    output.push(MSG_US);

    // Stuff event data
    if (data !== null) {
        // Handle different data types
        let dataBytes;
        if (typeof data === 'string') {
            // Convert string to UTF-8 bytes
            dataBytes = new TextEncoder().encode(data);
        } else if (data instanceof Uint8Array) {
            dataBytes = data;
        } else if (Array.isArray(data)) {
            dataBytes = new Uint8Array(data);
        } else {
            dataBytes = new Uint8Array(0);
        }

        for (let i = 0; i < dataBytes.length; i++) {
            stuffByte(dataBytes[i], output);
        }
    }

    // Frame end
    output.push(MSG_EOT);

    return new Uint8Array(output);
}

// ═══════════════════════════════════════════════════════
// DECODER (with state machine)
// ═══════════════════════════════════════════════════════

const DecoderState = {
    IDLE: 0,          // Waiting for SOH
    SKIP_HEADER: 1,   // Skipping 7-byte header
    WAIT_STX: 2,      // Waiting for STX after header
    READ_NAME: 3,     // Reading event name
    READ_DATA: 4,     // Reading event data
    ESCAPE: 5         // Next byte is escaped
};

export class EventDecoder {
    constructor() {
        this.state = DecoderState.IDLE;
        this.eventName = '';
        this.eventData = [];
        this.inNameSection = true;
        this.headerBytesRead = 0;
        this.eventHandlers = new Map();
        this.unhandledHandler = null;
    }

    /**
     * Register handler for specific event name
     * @param {string} eventName - Name of the event
     * @param {Function} handler - Callback function(data)
     */
    on(eventName, handler) {
        this.eventHandlers.set(eventName, handler);
        console.log(`[EVENT] Registered handler for '${eventName}'`);
    }

    /**
     * Set wildcard handler for unhandled events
     * @param {Function} handler - Callback function(name, data)
     */
    onUnhandled(handler) {
        this.unhandledHandler = handler;
        console.log('[EVENT] Registered unhandled event handler');
    }

    /**
     * Reset decoder state
     */
    reset() {
        this.state = DecoderState.IDLE;
        this.eventName = '';
        this.eventData = [];
        this.inNameSection = true;
        this.headerBytesRead = 0;
    }

    /**
     * Feed a single byte to the decoder
     * @param {number} byte - Byte to process
     */
    feedByte(byte) {
        switch (this.state) {

            // ─────────────────────────────────────────────────
            // IDLE: Waiting for frame start (SOH)
            // ─────────────────────────────────────────────────
            case DecoderState.IDLE:
                if (byte === MSG_SOH) {
                    // Frame started - prepare to skip header
                    this.headerBytesRead = 0;
                    this.state = DecoderState.SKIP_HEADER;
                }
                break;

            // ─────────────────────────────────────────────────
            // SKIP_HEADER: Skip 7-byte header
            // ─────────────────────────────────────────────────
            case DecoderState.SKIP_HEADER:
                this.headerBytesRead++;
                if (this.headerBytesRead >= MSG_HEADER_SIZE) {
                    // All 7 header bytes skipped, now wait for STX
                    this.state = DecoderState.WAIT_STX;
                }
                break;

            // ─────────────────────────────────────────────────
            // WAIT_STX: Waiting for STX after header
            // ─────────────────────────────────────────────────
            case DecoderState.WAIT_STX:
                if (byte === MSG_STX) {
                    // STX found - reset state and start reading name
                    this.eventName = '';
                    this.eventData = [];
                    this.inNameSection = true;
                    this.state = DecoderState.READ_NAME;
                } else if (byte === MSG_SOH) {
                    // New frame started - restart
                    this.headerBytesRead = 0;
                    this.state = DecoderState.SKIP_HEADER;
                } else {
                    // Unexpected byte - reset to idle
                    this.reset();
                }
                break;

            // ─────────────────────────────────────────────────
            // READ_NAME: Reading event name until US
            // ─────────────────────────────────────────────────
            case DecoderState.READ_NAME:
                if (byte === MSG_ESC) {
                    // Next byte is escaped
                    this.state = DecoderState.ESCAPE;
                } else if (byte === MSG_US) {
                    // Name complete, start reading data
                    this.inNameSection = false;
                    this.state = DecoderState.READ_DATA;
                } else if (byte === MSG_SOH) {
                    // New frame started - restart from beginning
                    this.headerBytesRead = 0;
                    this.state = DecoderState.SKIP_HEADER;
                } else if (byte === MSG_STX) {
                    // Unexpected STX - restart frame parsing (already past header)
                    this.eventName = '';
                    this.eventData = [];
                    this.inNameSection = true;
                    this.state = DecoderState.READ_NAME;
                } else {
                    // Normal character - add to name
                    this.eventName += String.fromCharCode(byte);
                }
                break;

            // ─────────────────────────────────────────────────
            // READ_DATA: Reading event data until EOT
            // ─────────────────────────────────────────────────
            case DecoderState.READ_DATA:
                if (byte === MSG_ESC) {
                    // Next byte is escaped
                    this.state = DecoderState.ESCAPE;
                } else if (byte === MSG_EOT) {
                    // Frame complete - dispatch to registered handler
                    this._dispatchEvent();
                    this.reset();
                } else if (byte === MSG_SOH) {
                    // New frame started - restart from beginning
                    this.headerBytesRead = 0;
                    this.state = DecoderState.SKIP_HEADER;
                } else if (byte === MSG_STX) {
                    // Unexpected STX - restart frame parsing (already past header)
                    this.eventName = '';
                    this.eventData = [];
                    this.inNameSection = true;
                    this.state = DecoderState.READ_NAME;
                } else {
                    // Normal data byte - add to data
                    this.eventData.push(byte);
                }
                break;

            // ─────────────────────────────────────────────────
            // ESCAPE: Unstuff next byte
            // ─────────────────────────────────────────────────
            case DecoderState.ESCAPE:
                {
                    const unstuffed = byte ^ MSG_ESC_XOR;

                    if (this.inNameSection) {
                        // Add unstuffed byte to name
                        this.eventName += String.fromCharCode(unstuffed);
                        this.state = DecoderState.READ_NAME;
                    } else {
                        // Add unstuffed byte to data
                        this.eventData.push(unstuffed);
                        this.state = DecoderState.READ_DATA;
                    }
                }
                break;
        }
    }

    /**
     * Feed multiple bytes to the decoder
     * @param {Uint8Array|Array} bytes - Bytes to process
     */
    feedBytes(bytes) {
        for (let i = 0; i < bytes.length; i++) {
            this.feedByte(bytes[i]);
        }
    }

    /**
     * Dispatch event to registered handler (internal)
     */
    _dispatchEvent() {
        const dataArray = new Uint8Array(this.eventData);

        if (this.eventHandlers.has(this.eventName)) {
            // Handler found - call it
            console.log(`[EVENT] Dispatching '${this.eventName}' (${dataArray.length} bytes)`);
            const handler = this.eventHandlers.get(this.eventName);
            handler(dataArray);
        } else if (this.unhandledHandler !== null) {
            // No specific handler, call unhandled handler with event name
            console.log(`[EVENT] Unhandled event '${this.eventName}', calling wildcard handler`);
            this.unhandledHandler(this.eventName, dataArray);
        } else {
            // No handler registered
            console.log(`[EVENT] Warning: No handler for '${this.eventName}'`);
        }
    }
}

// ═══════════════════════════════════════════════════════
// HELPER UTILITIES
// ═══════════════════════════════════════════════════════

/**
 * Convert Uint8Array to hex string for debugging
 * @param {Uint8Array} data - Data to convert
 * @returns {string} - Hex string
 */
export function toHexString(data) {
    return Array.from(data)
        .map(b => b.toString(16).padStart(2, '0').toUpperCase())
        .join(' ');
}

/**
 * Convert Uint8Array to UTF-8 string
 * @param {Uint8Array} data - Data to convert
 * @returns {string} - UTF-8 string
 */
export function toString(data) {
    return new TextDecoder().decode(data);
}

/**
 * Convert hex string to Uint8Array
 * @param {string} hexString - Hex string (e.g., "01 02 03" or "010203")
 * @returns {Uint8Array} - Byte array
 */
export function fromHexString(hexString) {
    const hex = hexString.replace(/\s+/g, '');
    const bytes = [];
    for (let i = 0; i < hex.length; i += 2) {
        bytes.push(parseInt(hex.substr(i, 2), 16));
    }
    return new Uint8Array(bytes);
}
