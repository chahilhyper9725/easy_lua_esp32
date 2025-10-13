#pragma once

#include <Arduino.h>
#include <vector>

// ═══════════════════════════════════════════════════════
// EVENT MESSAGE PROTOCOL
// ═══════════════════════════════════════════════════════
// Simple framing protocol for binary-safe event messaging
//
// Frame Format:
//   [STX] [Stuffed Event Name] [US] [Stuffed Event Data] [EOT]
//
// Control Characters:
//   STX  = 0x02 (Start of Text)
//   US   = 0x1F (Unit Separator - between name and data)
//   EOT  = 0x04 (End of Transmission)
//   ESC  = 0x1B (Escape for byte stuffing)
//
// Byte Stuffing:
//   If payload contains STX, US, EOT, or ESC:
//     Send: [ESC][byte XOR 0x20]
//   On receive:
//     If ESC found: Next byte XOR 0x20
//
// ═══════════════════════════════════════════════════════

// Control characters
#define MSG_STX      0x02  // Start of Text
#define MSG_US       0x1F  // Unit Separator
#define MSG_EOT      0x04  // End of Transmission
#define MSG_ESC      0x1B  // Escape
#define MSG_ESC_XOR  0x20  // XOR mask for stuffing

// Callback for handling specific events
typedef void (*EventHandler)(const std::vector<uint8_t>& data);

// Callback for handling unhandled events (includes event name)
typedef void (*UnhandledEventHandler)(const String& name, const std::vector<uint8_t>& data);

// Callback for sending raw bytes (user provides Serial.write, BLE send, etc.)
typedef void (*EventSendCallback)(const uint8_t* data, uint16_t len);

// Initialize event message system
void event_msg_init(EventSendCallback on_send);

// Register handler for specific event name
void event_msg_on(const char* event_name, EventHandler handler);

// Set wildcard handler for unhandled events (optional)
void event_msg_on_unhandled(UnhandledEventHandler handler);

// Send an event (encodes and sends via callback)
void event_msg_send(const char* name, const uint8_t* data, uint16_t len);

// Process incoming bytes (feed one byte at a time)
void event_msg_feed_byte(uint8_t byte);

// Process incoming bytes (feed multiple bytes at once)
void event_msg_feed_bytes(const uint8_t* data, uint16_t len);

// Reset decoder state (useful after errors)
void event_msg_reset();
