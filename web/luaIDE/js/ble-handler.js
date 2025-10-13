// ═══════════════════════════════════════════════════════════
// Lua IDE - BLE Handler
// Manages Web Bluetooth connection to ESP32
// ═══════════════════════════════════════════════════════════

import { encodeEvent, EventDecoder, toString } from './event_msg.js';

// ═══════════════════════════════════════════════════════════
// NORDIC UART SERVICE (NUS) UUIDs
// ═══════════════════════════════════════════════════════════

const NUS_SERVICE_UUID = '6e400001-b5a3-f393-e0a9-e50e24dcca9e';
const NUS_RX_CHAR_UUID = '6e400002-b5a3-f393-e0a9-e50e24dcca9e';  // Write to ESP32
const NUS_TX_CHAR_UUID = '6e400003-b5a3-f393-e0a9-e50e24dcca9e';  // Notifications from ESP32

// ═══════════════════════════════════════════════════════════
// BLE STATE
// ═══════════════════════════════════════════════════════════

const BLEState = {
    device: null,
    server: null,
    rxCharacteristic: null,  // For writing to ESP32
    txCharacteristic: null,  // For receiving from ESP32
    decoder: new EventDecoder(),
    isConnected: false,
    isExecuting: false,

    // Callbacks
    onConnectionChange: null,
    onLuaPrint: null,
    onLuaError: null,
    onLuaStop: null
};

// ═══════════════════════════════════════════════════════════
// INITIALIZATION
// ═══════════════════════════════════════════════════════════

export function initializeBLE() {
    console.log('Initializing BLE handler...');

    // Setup event handlers
    setupEventHandlers();

    // Check Web Bluetooth support
    if (!navigator.bluetooth) {
        console.error('Web Bluetooth API not supported. Use Chrome/Edge.');
        return false;
    }

    console.log('✓ BLE handler initialized');
    return true;
}

function setupEventHandlers() {
    // Handler for lua_print events (from Lua print() function)
    BLEState.decoder.on('lua_print', (data) => {
        const message = toString(data);
        console.log('[LUA PRINT]', message);
        if (BLEState.onLuaPrint) {
            BLEState.onLuaPrint(message);
        }
    });

    // Handler for lua_error events
    BLEState.decoder.on('lua_error', (data) => {
        const errorMsg = toString(data);
        console.error('[LUA ERROR]', errorMsg);
        if (BLEState.onLuaError) {
            BLEState.onLuaError(errorMsg);
        }
    });

    // Handler for lua_stop events
    BLEState.decoder.on('lua_stop', (data) => {
        const stopMsg = toString(data);
        console.log('[LUA STOP]', stopMsg);
        BLEState.isExecuting = false;
        if (BLEState.onLuaStop) {
            BLEState.onLuaStop(stopMsg);
        }
    });

    // Wildcard handler for unhandled events
    BLEState.decoder.onUnhandled((name, data) => {
        const message = toString(data);
        console.log(`[EVENT] ${name}:`, message);
    });
}

// ═══════════════════════════════════════════════════════════
// CONNECTION MANAGEMENT
// ═══════════════════════════════════════════════════════════

export async function connectBLE() {
    try {
        console.log('🔌 Requesting BLE device...');

        // Request device with NUS filter
        BLEState.device = await navigator.bluetooth.requestDevice({
            filters: [{ services: [NUS_SERVICE_UUID] }],
            optionalServices: [NUS_SERVICE_UUID]
        });

        console.log(`Connecting to ${BLEState.device.name}...`);

        // Connect to GATT server
        BLEState.server = await BLEState.device.gatt.connect();
        console.log('✓ Connected to GATT server');

        // Get Nordic UART Service
        const service = await BLEState.server.getPrimaryService(NUS_SERVICE_UUID);

        // Get RX characteristic (write to ESP32)
        BLEState.rxCharacteristic = await service.getCharacteristic(NUS_RX_CHAR_UUID);

        // Get TX characteristic (receive from ESP32)
        BLEState.txCharacteristic = await service.getCharacteristic(NUS_TX_CHAR_UUID);

        // Start notifications
        await BLEState.txCharacteristic.startNotifications();
        BLEState.txCharacteristic.addEventListener('characteristicvaluechanged', handleNotification);

        // Listen for disconnect
        BLEState.device.addEventListener('gattserverdisconnected', handleDisconnect);

        // Update state
        BLEState.isConnected = true;
        console.log('✓ BLE connection established');

        // Notify UI
        if (BLEState.onConnectionChange) {
            BLEState.onConnectionChange(true, BLEState.device.name);
        }

        return true;

    } catch (error) {
        console.error('❌ BLE connection failed:', error);
        BLEState.isConnected = false;

        // Notify UI
        if (BLEState.onConnectionChange) {
            BLEState.onConnectionChange(false, null);
        }

        throw error;
    }
}

export function disconnectBLE() {
    if (BLEState.device && BLEState.device.gatt.connected) {
        BLEState.device.gatt.disconnect();
        console.log('🔌 Disconnected from BLE device');
    }

    BLEState.isConnected = false;

    // Notify UI
    if (BLEState.onConnectionChange) {
        BLEState.onConnectionChange(false, null);
    }
}

function handleDisconnect() {
    console.log('⚠️ BLE device disconnected');
    BLEState.isConnected = false;
    BLEState.isExecuting = false;

    // Notify UI
    if (BLEState.onConnectionChange) {
        BLEState.onConnectionChange(false, null);
    }
}

function handleNotification(event) {
    const value = event.target.value;
    const bytes = new Uint8Array(value.buffer);

    // Feed bytes to decoder (will trigger registered event handlers)
    BLEState.decoder.feedBytes(bytes);
}

// ═══════════════════════════════════════════════════════════
// LUA CODE EXECUTION
// ═══════════════════════════════════════════════════════════

export async function executeLuaCode(code) {
    if (!BLEState.isConnected || !BLEState.rxCharacteristic) {
        throw new Error('Not connected to ESP32');
    }

    if (BLEState.isExecuting) {
        throw new Error('Code is already executing. Stop it first.');
    }

    try {
        console.log('▶ Executing Lua code...');
        BLEState.isExecuting = true;

        // Encode lua_execute event
        const frame = encodeEvent('lua_execute', code);

        // Send in chunks (480 bytes max, matching ESP32 buffer)
        const CHUNK_SIZE = 480;
        for (let offset = 0; offset < frame.length; offset += CHUNK_SIZE) {
            const chunk = frame.slice(offset, offset + CHUNK_SIZE);
            await BLEState.rxCharacteristic.writeValue(chunk);

            // Small delay between chunks for reliability
            if (offset + CHUNK_SIZE < frame.length) {
                await new Promise(resolve => setTimeout(resolve, 10));
            }
        }

        console.log('✓ Lua code sent to ESP32');
        return true;

    } catch (error) {
        console.error('❌ Failed to execute Lua code:', error);
        BLEState.isExecuting = false;
        throw error;
    }
}

export async function stopLuaExecution() {
    if (!BLEState.isConnected || !BLEState.rxCharacteristic) {
        throw new Error('Not connected to ESP32');
    }

    try {
        console.log('⏹ Stopping Lua execution...');

        // Send lua_stop event (empty data)
        const frame = encodeEvent('lua_stop', '');
        await BLEState.rxCharacteristic.writeValue(frame);

        BLEState.isExecuting = false;
        console.log('✓ Stop signal sent');
        return true;

    } catch (error) {
        console.error('❌ Failed to stop execution:', error);
        throw error;
    }
}

// ═══════════════════════════════════════════════════════════
// CALLBACK REGISTRATION
// ═══════════════════════════════════════════════════════════

export function onConnectionChange(callback) {
    BLEState.onConnectionChange = callback;
}

export function onLuaPrint(callback) {
    BLEState.onLuaPrint = callback;
}

export function onLuaError(callback) {
    BLEState.onLuaError = callback;
}

export function onLuaStop(callback) {
    BLEState.onLuaStop = callback;
}

// ═══════════════════════════════════════════════════════════
// GETTERS
// ═══════════════════════════════════════════════════════════

export function isConnected() {
    return BLEState.isConnected;
}

export function isExecuting() {
    return BLEState.isExecuting;
}

export function getDeviceName() {
    return BLEState.device ? BLEState.device.name : null;
}

// ═══════════════════════════════════════════════════════════
// EXPORT STATE (for debugging)
// ═══════════════════════════════════════════════════════════

export { BLEState };
