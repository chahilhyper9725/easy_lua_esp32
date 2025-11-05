#include "ble_comm.h"
#include "../utils/debug.h"
#include <BLEDevice.h>
#include <BLEServer.h>
#include <BLEUtils.h>
#include <BLE2902.h>

// ═══════════════════════════════════════════════════════
// NORDIC UART SERVICE (NUS) UUIDs
// ═══════════════════════════════════════════════════════

#define NUS_SERVICE_UUID "6E400001-B5A3-F393-E0A9-E50E24DCCA9E"  // NUS Service
#define NUS_RX_UUID      "6E400002-B5A3-F393-E0A9-E50E24DCCA9E"  // RX (Write from client)
#define NUS_TX_UUID      "6E400003-B5A3-F393-E0A9-E50E24DCCA9E"  // TX (Notify to client)

// Product UUID
#define PRODUCT_UUID     "AE06"  // Product identifier for advertisement

// BLE Configuration
#define BLE_MTU          517   // Requested MTU size
#define BLE_CHUNK_SIZE   480   // Chunk size for sending (safe payload size)

// ═══════════════════════════════════════════════════════
// INTERNAL STATE
// ═══════════════════════════════════════════════════════

static BLEServer* ble_server = nullptr;
static BLECharacteristic* tx_characteristic = nullptr;  // TX - Send to client (notify)
static BLECharacteristic* rx_characteristic = nullptr;  // RX - Receive from client (write)
static BleReceiveCallback receive_callback = nullptr;
static bool is_connected = false;

// ═══════════════════════════════════════════════════════
// BLE SERVER CALLBACKS
// ═══════════════════════════════════════════════════════

class ServerCallbacks : public BLEServerCallbacks {
    void onConnect(BLEServer* server) {
        is_connected = true;
        LOG_INFO("BLE", "Client connected");

        // Request larger MTU for better throughput
        server->updatePeerMTU(server->getConnId(), BLE_MTU);
        LOG_DEBUG("BLE", "Requested MTU: %d bytes", BLE_MTU);
    }

    void onDisconnect(BLEServer* server) {
        is_connected = false;
        LOG_INFO("BLE", "Client disconnected");

        // Restart advertising
        BLEDevice::startAdvertising();
        LOG_DEBUG("BLE", "Advertising restarted");
    }
};

// ═══════════════════════════════════════════════════════
// RX CHARACTERISTIC CALLBACKS (Receive from client)
// ═══════════════════════════════════════════════════════

class RxCallbacks : public BLECharacteristicCallbacks {
    void onWrite(BLECharacteristic* characteristic) {
        // Get received data from client
        uint8_t* value = characteristic->getData();
        uint16_t length = characteristic->getLength();

        if (length > 0) {
            LOG_TRACE("BLE_RX", "Received %d bytes", length);

            // Feed to callback (event_msg decoder)
            if (receive_callback != nullptr) {
                receive_callback((const uint8_t*)value, length);
            }
        }
    }
};

// ═══════════════════════════════════════════════════════
// PUBLIC API
// ═══════════════════════════════════════════════════════

void ble_comm_init(const char* device_name, BleReceiveCallback on_receive) {
    receive_callback = on_receive;

    LOG_INFO("BLE", "Initializing Nordic UART Service (NUS)...");

    // Initialize BLE
    BLEDevice::init(device_name);

    // Create BLE Server
    ble_server = BLEDevice::createServer();
    ble_server->setCallbacks(new ServerCallbacks());

    // Create NUS Service
    BLEService* nus_service = ble_server->createService(NUS_SERVICE_UUID);

    // Create TX Characteristic (Notify to client)
    tx_characteristic = nus_service->createCharacteristic(
        NUS_TX_UUID,
        BLECharacteristic::PROPERTY_NOTIFY
    );
    tx_characteristic->addDescriptor(new BLE2902());

    // Create RX Characteristic (Write from client)
    rx_characteristic = nus_service->createCharacteristic(
        NUS_RX_UUID,
        BLECharacteristic::PROPERTY_WRITE |
        BLECharacteristic::PROPERTY_WRITE_NR  // Write without response
    );
    rx_characteristic->setCallbacks(new RxCallbacks());

    // Start the service
    nus_service->start();

    // Configure advertising
    BLEAdvertising* advertising = BLEDevice::getAdvertising();
    advertising->addServiceUUID(NUS_SERVICE_UUID);
    advertising->addServiceUUID(PRODUCT_UUID);  // Add product UUID
    advertising->setScanResponse(true);
    advertising->setMinPreferred(0x06);  // iPhone compatibility
    advertising->setMinPreferred(0x12);

    // Start advertising
    BLEDevice::startAdvertising();

    LOG_INFO("BLE", "NUS Server started");
    LOG_DEBUG("BLE", "Device name: %s", device_name);
    LOG_DEBUG("BLE", "Service UUID: %s", NUS_SERVICE_UUID);
    LOG_DEBUG("BLE", "Product UUID: %s", PRODUCT_UUID);
    LOG_DEBUG("BLE", "RX UUID (Write): %s", NUS_RX_UUID);
    LOG_DEBUG("BLE", "TX UUID (Notify): %s", NUS_TX_UUID);
    LOG_INFO("BLE", "Waiting for client connection...");
}

void ble_comm_send(const uint8_t* data, uint16_t len) {
    if (!is_connected) {
        LOG_DEBUG("BLE_TX", "Not connected, cannot send");
        return;
    }

    if (tx_characteristic == nullptr) {
        return;
    }

    // Send data in chunks if larger than BLE_CHUNK_SIZE
    uint16_t offset = 0;
    uint16_t chunks = (len + BLE_CHUNK_SIZE - 1) / BLE_CHUNK_SIZE;

    LOG_TRACE("BLE_TX", "Sending %d bytes in %d chunk(s)", len, chunks);

    while (offset < len) {
        // Calculate chunk size
        uint16_t chunk_len = (len - offset) > BLE_CHUNK_SIZE ? BLE_CHUNK_SIZE : (len - offset);

        // Send chunk via TX characteristic (notify to client)
        tx_characteristic->setValue((uint8_t*)(data + offset), chunk_len);
        tx_characteristic->notify();

        LOG_TRACE("BLE_TX", "Sent chunk %d/%d (%d bytes)",
                  (offset / BLE_CHUNK_SIZE) + 1, chunks, chunk_len);

        offset += chunk_len;

        // Small delay between chunks to prevent buffer overflow
        if (offset < len) {
            delay(10);  // 10ms delay between chunks
        }
    }

    LOG_TRACE("BLE_TX", "Complete: %d bytes sent", len);
}

bool ble_comm_is_connected() {
    return is_connected;
}
