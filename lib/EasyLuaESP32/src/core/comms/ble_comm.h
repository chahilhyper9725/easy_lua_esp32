#pragma once

#include <Arduino.h>

// ═══════════════════════════════════════════════════════
// BLE COMMUNICATION
// ═══════════════════════════════════════════════════════
// Simple BLE server for event messaging
//
// Creates BLE server with one service and one characteristic
// - Write: Incoming data → feeds to event_msg decoder
// - Notify: Outgoing data ← sends encoded events
//
// ═══════════════════════════════════════════════════════

// Callback when BLE receives data
typedef void (*BleReceiveCallback)(const uint8_t* data, uint16_t len);

// Initialize BLE server
void ble_comm_init(const char* device_name, BleReceiveCallback on_receive);

// Send data via BLE (notify)
void ble_comm_send(const uint8_t* data, uint16_t len);

// Check if BLE client is connected
bool ble_comm_is_connected();
