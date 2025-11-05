// ═══════════════════════════════════════════════════════════
// Lua IDE - BLE Handler
// Manages Web Bluetooth connection to ESP32
// ═══════════════════════════════════════════════════════════

import { encodeEvent, EventDecoder, toString } from './event_msg.js';

// ═══════════════════════════════════════════════════════════
// EVENT NAMES (must match ESP32 definitions)
// ═══════════════════════════════════════════════════════════

const EVENT_LUA_CODE_ADD = "lua_code_add";
const EVENT_LUA_CODE_CLEAR = "lua_code_clear";
const EVENT_LUA_CODE_RUN = "lua_code_run";
const EVENT_LUA_CODE_STOP = "lua_code_stop";
const EVENT_LUA_OUTPUT = "lua_code_output";
const EVENT_LUA_ERROR = "lua_error";
const EVENT_LUA_RESULT = "lua_result";

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
    // Handler for lua_code_output events (from Lua print() function)
    BLEState.decoder.on(EVENT_LUA_OUTPUT, (data) => {
        const message = toString(data);
        console.log('[LUA OUTPUT]', message);
        if (BLEState.onLuaPrint) {
            BLEState.onLuaPrint(message);
        }
    });

    // Handler for lua_error events
    BLEState.decoder.on(EVENT_LUA_ERROR, (data) => {
        const errorMsg = toString(data);
        console.error('[LUA ERROR]', errorMsg);
        if (BLEState.onLuaError) {
            BLEState.onLuaError(errorMsg);
        }
    });

    // Handler for lua_result events (execution complete)
    BLEState.decoder.on(EVENT_LUA_RESULT, (data) => {
        const result = toString(data);
        console.log('[LUA RESULT]', result);
        BLEState.isExecuting = false;
        if (BLEState.onLuaStop) {
            BLEState.onLuaStop(result);
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

/**
 * Helper function to send an event frame via BLE
 */
async function sendEventFrame(eventName, data = '') {
    const frame = encodeEvent(eventName, data);

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
}

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

        // Step 1: Clear buffer
        console.log('  1. Clearing buffer...');
        await sendEventFrame(EVENT_LUA_CODE_CLEAR);
        await new Promise(resolve => setTimeout(resolve, 10));

        // Step 2: Send code in chunks
        console.log('  2. Sending code chunks...');
        const CODE_CHUNK_SIZE = 512; // Size of Lua code chunks (not BLE chunks)

        for (let offset = 0; offset < code.length; offset += CODE_CHUNK_SIZE) {
            const codeChunk = code.substring(offset, offset + CODE_CHUNK_SIZE);
            await sendEventFrame(EVENT_LUA_CODE_ADD, codeChunk);
            await new Promise(resolve => setTimeout(resolve, 10));
            console.log(`     Sent chunk ${Math.floor(offset / CODE_CHUNK_SIZE) + 1} (${codeChunk.length} bytes)`);
        }

        // Step 3: Execute buffer
        console.log('  3. Executing buffer...');
        await sendEventFrame(EVENT_LUA_CODE_RUN);

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

        // Send lua_code_stop event (empty data)
        await sendEventFrame(EVENT_LUA_CODE_STOP);

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
