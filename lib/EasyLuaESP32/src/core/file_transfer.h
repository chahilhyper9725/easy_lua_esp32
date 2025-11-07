#pragma once

#include <Arduino.h>
#include <vector>
#include <FS.h>
#include <LittleFS.h>
#include <ArduinoJson.h>

// ═══════════════════════════════════════════════════════
// FILESYSTEM SELECTION - Change here to use SPIFFS
// ═══════════════════════════════════════════════════════

// Comment out LittleFS and uncomment SPIFFS to switch
#define USE_LITTLEFS
// #define USE_SPIFFS

#ifdef USE_SPIFFS
    #include <SPIFFS.h>
    #define FILESYSTEM SPIFFS
    #define FS_NAME "SPIFFS"
#else
    #define FILESYSTEM LittleFS
    #define FS_NAME "LittleFS"
#endif

// ═══════════════════════════════════════════════════════
// FILE TRANSFER CONFIGURATION
// ═══════════════════════════════════════════════════════

namespace FileConfig {
    const size_t STATIC_BUFFER_SIZE = 4096;      // 4KB static buffer
    const size_t MAX_DYNAMIC_BUFFER = 32768;     // 32KB max dynamic buffer
    const size_t MAX_CHUNK_SIZE = 4096;          // Max read chunk size
}

// ═══════════════════════════════════════════════════════
// CRC32 CALCULATOR
// ═══════════════════════════════════════════════════════

class CRC32 {
public:
    CRC32();
    void reset();
    void update(const uint8_t *data, size_t length);
    uint32_t finalize() const;

private:
    uint32_t crc_value;
};

// ═══════════════════════════════════════════════════════
// FILE SESSION
// ═══════════════════════════════════════════════════════

struct FileSession {
    // File state
    bool isOpen;
    File file;
    String filename;
    size_t totalSize;
    size_t writtenSize;

    // Buffer management
    uint8_t staticBuffer[FileConfig::STATIC_BUFFER_SIZE];
    uint8_t *buffer;
    bool usingDynamicBuffer;
    size_t bufferPos;
    size_t bufferSize;

    // CRC tracking
    CRC32 crc;
    uint32_t lastChunkCrc;

    // Performance tracking
    unsigned long startTime;
    unsigned long lastFlushTime;
    unsigned long totalFlushTime;
    uint32_t flushCount;
    bool timingActive;

    FileSession();
};

// ═══════════════════════════════════════════════════════
// PUBLIC API
// ═══════════════════════════════════════════════════════

// Initialize file transfer module (call from system_init)
void file_transfer_init();

// Register all file transfer event handlers
void file_transfer_register_handlers();

// Get current session status
void file_transfer_print_status();
