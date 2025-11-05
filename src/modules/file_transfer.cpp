#include "file_transfer.h"
#include "../core/event_msg.h"
#include "../utils/debug.h"
#include <rom/crc.h>

// ═══════════════════════════════════════════════════════
// GLOBAL STATE
// ═══════════════════════════════════════════════════════

static FileSession g_fileSession;

// ═══════════════════════════════════════════════════════
// CRC32 IMPLEMENTATION
// ═══════════════════════════════════════════════════════

CRC32::CRC32() : crc_value(0) {}

void CRC32::reset() {
    crc_value = 0;
}

void CRC32::update(const uint8_t *data, size_t length) {
    // Use ESP32 hardware CRC32
    crc_value = crc32_le(crc_value, data, length);
}

uint32_t CRC32::finalize() const {
    return crc_value;
}

// ═══════════════════════════════════════════════════════
// FILE SESSION IMPLEMENTATION
// ═══════════════════════════════════════════════════════

FileSession::FileSession()
    : isOpen(false), buffer(staticBuffer), usingDynamicBuffer(false),
      bufferPos(0), writtenSize(0), bufferSize(FileConfig::STATIC_BUFFER_SIZE),
      lastChunkCrc(0), totalFlushTime(0), flushCount(0), timingActive(false) {}

// ═══════════════════════════════════════════════════════
// UTILITIES
// ═══════════════════════════════════════════════════════

static String sanitizePath(const String &path) {
    String clean = path;
    clean.replace("..", "");
    if (!clean.startsWith("/")) {
        clean = "/" + clean;
    }
    return clean;
}

static bool allocateBuffer(size_t requestedSize) {
    // If requesting <= 4KB, use static buffer
    if (requestedSize <= FileConfig::STATIC_BUFFER_SIZE) {
        if (g_fileSession.usingDynamicBuffer && g_fileSession.buffer != g_fileSession.staticBuffer) {
            delete[] g_fileSession.buffer;
        }
        g_fileSession.buffer = g_fileSession.staticBuffer;
        g_fileSession.bufferSize = FileConfig::STATIC_BUFFER_SIZE;
        g_fileSession.usingDynamicBuffer = false;
        return true;
    }

    // Need dynamic allocation
    size_t allocSize = min(requestedSize, FileConfig::MAX_DYNAMIC_BUFFER);

    // Free existing dynamic buffer if any
    if (g_fileSession.usingDynamicBuffer && g_fileSession.buffer != g_fileSession.staticBuffer) {
        delete[] g_fileSession.buffer;
    }

    // Try PSRAM first if available
    if (ESP.getPsramSize() > 0 && ESP.getFreePsram() >= allocSize) {
        g_fileSession.buffer = (uint8_t *)ps_malloc(allocSize);
        if (g_fileSession.buffer) {
            LOG_DEBUG("FILE", "Allocated %u bytes in PSRAM", allocSize);
        }
    }

    // Fallback to heap
    if (!g_fileSession.buffer || g_fileSession.buffer == g_fileSession.staticBuffer) {
        g_fileSession.buffer = new uint8_t[allocSize];
        if (g_fileSession.buffer) {
            LOG_DEBUG("FILE", "Allocated %u bytes in heap", allocSize);
        }
    }

    if (g_fileSession.buffer && g_fileSession.buffer != g_fileSession.staticBuffer) {
        g_fileSession.bufferSize = allocSize;
        g_fileSession.usingDynamicBuffer = true;
        return true;
    }

    // Allocation failed, fallback to static
    LOG_DEBUG("FILE", "Dynamic allocation failed, using static buffer");
    g_fileSession.buffer = g_fileSession.staticBuffer;
    g_fileSession.bufferSize = FileConfig::STATIC_BUFFER_SIZE;
    g_fileSession.usingDynamicBuffer = false;
    return false;
}

static void freeBuffer() {
    if (g_fileSession.usingDynamicBuffer && g_fileSession.buffer != g_fileSession.staticBuffer) {
        delete[] g_fileSession.buffer;
        g_fileSession.buffer = g_fileSession.staticBuffer;
        g_fileSession.bufferSize = FileConfig::STATIC_BUFFER_SIZE;
        g_fileSession.usingDynamicBuffer = false;
    }
}

static bool flushBuffer(bool sendAck) {
    if (g_fileSession.bufferPos == 0) {
        return true; // Nothing to flush
    }

    unsigned long flushStart = millis();

    // Calculate CRC for this chunk
    g_fileSession.crc.update(g_fileSession.buffer, g_fileSession.bufferPos);
    uint32_t chunkCrc = g_fileSession.crc.finalize();

    // Write to file
    size_t written = g_fileSession.file.write(g_fileSession.buffer, g_fileSession.bufferPos);

    unsigned long flushEnd = millis();
    unsigned long flushDuration = flushEnd - flushStart;

    if (written != g_fileSession.bufferPos) {
        LOG_ERROR("FILE", "Buffer flush failed: %u/%u bytes", written, g_fileSession.bufferPos);

        if (sendAck) {
            DynamicJsonDocument response(256);
            response["status"] = "error";
            response["message"] = "Flush failed";
            String responseStr;
            serializeJson(response, responseStr);
            event_msg_send("file_append_ack", (const uint8_t*)responseStr.c_str(), responseStr.length());
        }
        return false;
    }

    g_fileSession.writtenSize += written;
    g_fileSession.lastChunkCrc = chunkCrc;
    g_fileSession.totalFlushTime += flushDuration;
    g_fileSession.flushCount++;
    g_fileSession.lastFlushTime = flushEnd;

    // Send ACK with CRC
    if (sendAck) {
        DynamicJsonDocument ack(256);
        ack["status"] = "ack";
        ack["bytes"] = written;
        ack["crc"] = chunkCrc;
        ack["total"] = g_fileSession.writtenSize;
        ack["timestamp"] = millis();

        String ackStr;
        serializeJson(ack, ackStr);
        event_msg_send("file_append_ack", (const uint8_t*)ackStr.c_str(), ackStr.length());
    }

    // Reset buffer
    g_fileSession.bufferPos = 0;
    g_fileSession.crc.reset();

    // Log performance
    if (flushDuration > 0) {
        LOG_DEBUG("FILE", "Flush: %u bytes in %lu ms (%u bytes/ms), CRC: 0x%08X",
                  written, flushDuration, written / flushDuration, chunkCrc);
    }

    return true;
}

// ═══════════════════════════════════════════════════════
// EVENT HANDLERS
// ═══════════════════════════════════════════════════════

static void handleFileInit(const std::vector<uint8_t> &data) {
    DynamicJsonDocument response(512);
    response["status"] = "success";
    response["filesystem"] = FS_NAME;
    response["total_bytes"] = FILESYSTEM.totalBytes();
    response["used_bytes"] = FILESYSTEM.usedBytes();
    response["free_bytes"] = FILESYSTEM.totalBytes() - FILESYSTEM.usedBytes();

    String responseStr;
    serializeJson(response, responseStr);
    event_msg_send("file_init_response", (const uint8_t*)responseStr.c_str(), responseStr.length());
}

static void handleFileCreate(const std::vector<uint8_t> &data) {
    DynamicJsonDocument doc(512);
    DeserializationError error = deserializeJson(doc, (const char*)data.data(), data.size());

    DynamicJsonDocument response(512);

    if (error) {
        response["status"] = "error";
        response["message"] = "Invalid JSON";
        String responseStr;
        serializeJson(response, responseStr);
        event_msg_send("file_create_response", (const uint8_t*)responseStr.c_str(), responseStr.length());
        return;
    }

    // Close existing session if any
    if (g_fileSession.isOpen && g_fileSession.file) {
        flushBuffer(false);
        g_fileSession.file.close();
        freeBuffer();
    }

    String filename = doc["filename"].as<String>();
    size_t expectedSize = doc["size"] | 0;
    size_t bufferSize = doc["buffer_size"] | FileConfig::STATIC_BUFFER_SIZE;

    if (filename.isEmpty()) {
        response["status"] = "error";
        response["message"] = "No filename";
    } else {
        g_fileSession.filename = sanitizePath(filename);
        g_fileSession.totalSize = expectedSize;
        g_fileSession.writtenSize = 0;
        g_fileSession.bufferPos = 0;
        g_fileSession.crc.reset();

        // Allocate buffer
        allocateBuffer(bufferSize);

        // Open file
        g_fileSession.file = FILESYSTEM.open(g_fileSession.filename, FILE_WRITE);

        if (g_fileSession.file) {
            g_fileSession.isOpen = true;
            g_fileSession.startTime = millis();
            g_fileSession.timingActive = true;
            g_fileSession.totalFlushTime = 0;
            g_fileSession.flushCount = 0;

            response["status"] = "success";
            response["filename"] = g_fileSession.filename;
            response["buffer_size"] = g_fileSession.bufferSize;
            response["expected_size"] = g_fileSession.totalSize;

            LOG_INFO("FILE", "Created file: %s (%u bytes expected)",
                     g_fileSession.filename.c_str(), g_fileSession.totalSize);
        } else {
            response["status"] = "error";
            response["message"] = "Failed to create file";
            freeBuffer();
            g_fileSession.isOpen = false;
            LOG_ERROR("FILE", "Failed to create file: %s", g_fileSession.filename.c_str());
        }
    }

    String responseStr;
    serializeJson(response, responseStr);
    event_msg_send("file_create_response", (const uint8_t*)responseStr.c_str(), responseStr.length());
}

static void handleFileAppend(const std::vector<uint8_t> &data) {
    if (!g_fileSession.isOpen || !g_fileSession.file) {
        DynamicJsonDocument response(256);
        response["status"] = "error";
        response["message"] = "No file open";
        String responseStr;
        serializeJson(response, responseStr);
        event_msg_send("file_append_ack", (const uint8_t*)responseStr.c_str(), responseStr.length());
        return;
    }

    size_t remaining = data.size();
    const uint8_t *dataPtr = data.data();

    while (remaining > 0) {
        size_t spaceInBuffer = g_fileSession.bufferSize - g_fileSession.bufferPos;
        size_t toWrite = min(remaining, spaceInBuffer);

        // Copy to buffer
        memcpy(g_fileSession.buffer + g_fileSession.bufferPos, dataPtr, toWrite);
        g_fileSession.bufferPos += toWrite;
        dataPtr += toWrite;
        remaining -= toWrite;

        // Auto-flush if buffer is full
        if (g_fileSession.bufferPos >= g_fileSession.bufferSize) {
            if (!flushBuffer(true)) {
                return; // Flush failed
            }
        }
    }
}

static void handleFileFlush(const std::vector<uint8_t> &data) {
    if (!g_fileSession.isOpen) {
        DynamicJsonDocument response(256);
        response["status"] = "error";
        response["message"] = "No file open";
        String responseStr;
        serializeJson(response, responseStr);
        event_msg_send("file_flush_response", (const uint8_t*)responseStr.c_str(), responseStr.length());
        return;
    }

    flushBuffer(true);
}

static void handleFileSeek(const std::vector<uint8_t> &data) {
    DynamicJsonDocument doc(256);
    DeserializationError error = deserializeJson(doc, (const char*)data.data(), data.size());

    DynamicJsonDocument response(256);

    if (!g_fileSession.isOpen) {
        response["status"] = "error";
        response["message"] = "No file open";
    } else if (error) {
        response["status"] = "error";
        response["message"] = "Invalid JSON";
    } else {
        size_t position = doc["position"] | 0;

        // Flush buffer before seeking
        flushBuffer(false);

        if (g_fileSession.file.seek(position)) {
            response["status"] = "success";
            response["position"] = position;
        } else {
            response["status"] = "error";
            response["message"] = "Seek failed";
        }
    }

    String responseStr;
    serializeJson(response, responseStr);
    event_msg_send("file_seek_response", (const uint8_t*)responseStr.c_str(), responseStr.length());
}

static void handleFileClose(const std::vector<uint8_t> &data) {
    DynamicJsonDocument response(512);

    if (!g_fileSession.isOpen) {
        response["status"] = "error";
        response["message"] = "No file open";
    } else {
        // Final flush
        flushBuffer(false);

        // Calculate statistics
        unsigned long totalTime = millis() - g_fileSession.startTime;
        float avgFlushTime = g_fileSession.flushCount > 0 ?
                            (float)g_fileSession.totalFlushTime / g_fileSession.flushCount : 0;
        float writeSpeed = totalTime > 0 ?
                          (float)g_fileSession.writtenSize / totalTime * 1000 : 0;

        g_fileSession.file.close();

        response["status"] = "success";
        response["filename"] = g_fileSession.filename;
        response["bytes_written"] = g_fileSession.writtenSize;
        response["expected_size"] = g_fileSession.totalSize;

        int sizeDiff = (int)g_fileSession.writtenSize - (int)g_fileSession.totalSize;
        response["size_difference"] = sizeDiff;

        response["elapsed_ms"] = totalTime;
        response["flush_count"] = g_fileSession.flushCount;
        response["total_flush_ms"] = g_fileSession.totalFlushTime;
        response["avg_flush_ms"] = avgFlushTime;
        response["speed_bps"] = writeSpeed;
        response["speed_kbps"] = writeSpeed / 1024.0;

        LOG_INFO("FILE", "=== FILE TRANSFER COMPLETE ===");
        LOG_INFO("FILE", "  File: %s", g_fileSession.filename.c_str());
        LOG_INFO("FILE", "  Expected: %u bytes", g_fileSession.totalSize);
        LOG_INFO("FILE", "  Written: %u bytes", g_fileSession.writtenSize);
        LOG_INFO("FILE", "  Difference: %d bytes", sizeDiff);
        LOG_INFO("FILE", "  Total Time: %lu ms (%.2f sec)", totalTime, totalTime / 1000.0);
        LOG_INFO("FILE", "  Flushes: %u times", g_fileSession.flushCount);
        LOG_INFO("FILE", "  Speed: %.2f KB/s", writeSpeed / 1024.0);

        // Cleanup
        freeBuffer();
        g_fileSession.isOpen = false;
        g_fileSession.timingActive = false;
    }

    String responseStr;
    serializeJson(response, responseStr);
    event_msg_send("file_close_response", (const uint8_t*)responseStr.c_str(), responseStr.length());
}

static void handleFileRead(const std::vector<uint8_t> &data) {
    DynamicJsonDocument doc(512);
    DeserializationError error = deserializeJson(doc, (const char*)data.data(), data.size());

    if (error) {
        DynamicJsonDocument response(256);
        response["status"] = "error";
        response["message"] = "Invalid JSON";
        String responseStr;
        serializeJson(response, responseStr);
        event_msg_send("file_read_response", (const uint8_t*)responseStr.c_str(), responseStr.length());
        return;
    }

    String filename = sanitizePath(doc["filename"].as<String>());
    size_t offset = doc["offset"] | 0;
    size_t size = doc["size"] | FileConfig::MAX_CHUNK_SIZE;

    File file = FILESYSTEM.open(filename, FILE_READ);
    if (!file) {
        DynamicJsonDocument response(256);
        response["status"] = "error";
        response["message"] = "File not found";
        String responseStr;
        serializeJson(response, responseStr);
        event_msg_send("file_read_response", (const uint8_t*)responseStr.c_str(), responseStr.length());
        return;
    }

    file.seek(offset);
    size_t toRead = min(size, (size_t)(file.size() - offset));

    uint8_t *readBuffer = new uint8_t[toRead];
    size_t bytesRead = file.read(readBuffer, toRead);
    file.close();

    // Calculate CRC
    CRC32 crc;
    crc.update(readBuffer, bytesRead);
    uint32_t dataCrc = crc.finalize();

    // Send metadata first
    DynamicJsonDocument metadata(256);
    metadata["status"] = "success";
    metadata["bytes"] = bytesRead;
    metadata["crc"] = dataCrc;
    metadata["offset"] = offset;

    String metadataStr;
    serializeJson(metadata, metadataStr);
    event_msg_send("file_read_metadata", (const uint8_t*)metadataStr.c_str(), metadataStr.length());

    // Send binary data
    event_msg_send("file_read_data", readBuffer, bytesRead);

    delete[] readBuffer;
}

static void handleFileDelete(const std::vector<uint8_t> &data) {
    DynamicJsonDocument doc(256);
    DeserializationError error = deserializeJson(doc, (const char*)data.data(), data.size());

    DynamicJsonDocument response(256);

    if (error) {
        response["status"] = "error";
        response["message"] = "Invalid JSON";
    } else {
        String filename = sanitizePath(doc["filename"].as<String>());

        if (g_fileSession.isOpen && g_fileSession.filename == filename) {
            response["status"] = "error";
            response["message"] = "File is open";
        } else if (FILESYSTEM.remove(filename)) {
            response["status"] = "success";
            response["filename"] = filename;
            LOG_INFO("FILE", "Deleted file: %s", filename.c_str());
        } else {
            response["status"] = "error";
            response["message"] = "Delete failed";
        }
    }

    String responseStr;
    serializeJson(response, responseStr);
    event_msg_send("file_delete_response", (const uint8_t*)responseStr.c_str(), responseStr.length());
}

static void handleFileList(const std::vector<uint8_t> &data) {
    DynamicJsonDocument doc(256);
    deserializeJson(doc, (const char*)data.data(), data.size());

    String path = sanitizePath(doc["path"] | "/");

    DynamicJsonDocument response(1024);
    response["status"] = "success";
    response["path"] = path;

    JsonArray files = response.createNestedArray("files");

    File root = FILESYSTEM.open(path);
    if (root) {
        File file = root.openNextFile();
        while (file) {
            JsonObject obj = files.createNestedObject();
            obj["name"] = String(file.path());
            obj["size"] = file.size();
            obj["is_dir"] = file.isDirectory();
            file = root.openNextFile();
        }
    }

    String responseStr;
    serializeJson(response, responseStr);
    event_msg_send("file_list_response", (const uint8_t*)responseStr.c_str(), responseStr.length());
}

static void handleFileInfo(const std::vector<uint8_t> &data) {
    DynamicJsonDocument response(512);
    response["status"] = "success";
    response["filesystem"] = FS_NAME;
    response["total_bytes"] = FILESYSTEM.totalBytes();
    response["used_bytes"] = FILESYSTEM.usedBytes();
    response["free_bytes"] = FILESYSTEM.totalBytes() - FILESYSTEM.usedBytes();

    if (g_fileSession.isOpen) {
        JsonObject session = response.createNestedObject("active_session");
        session["filename"] = g_fileSession.filename;
        session["processed"] = g_fileSession.writtenSize;
        session["buffered"] = g_fileSession.bufferPos;
        session["total"] = g_fileSession.totalSize;
    }

    String responseStr;
    serializeJson(response, responseStr);
    event_msg_send("file_info_response", (const uint8_t*)responseStr.c_str(), responseStr.length());
}

// ═══════════════════════════════════════════════════════
// PUBLIC API IMPLEMENTATION
// ═══════════════════════════════════════════════════════

void file_transfer_init() {
    LOG_INFO("FILE", "Initializing %s file system...", FS_NAME);

    if (!FILESYSTEM.begin(true)) {
        LOG_ERROR("FILE", "%s initialization failed", FS_NAME);
        return;
    }

    // Initialize session
    g_fileSession.isOpen = false;
    g_fileSession.buffer = g_fileSession.staticBuffer;
    g_fileSession.usingDynamicBuffer = false;
    g_fileSession.bufferPos = 0;
    g_fileSession.writtenSize = 0;
    g_fileSession.bufferSize = FileConfig::STATIC_BUFFER_SIZE;

    LOG_INFO("FILE", "%s ready - %u / %u bytes used", FS_NAME,
             FILESYSTEM.usedBytes(), FILESYSTEM.totalBytes());
}

void file_transfer_register_handlers() {
    LOG_INFO("FILE", "Registering file transfer event handlers...");

    event_msg_on("file_init", handleFileInit);
    event_msg_on("file_create", handleFileCreate);
    event_msg_on("file_append", handleFileAppend);
    event_msg_on("file_flush", handleFileFlush);
    event_msg_on("file_seek", handleFileSeek);
    event_msg_on("file_close", handleFileClose);
    event_msg_on("file_read", handleFileRead);
    event_msg_on("file_delete", handleFileDelete);
    event_msg_on("file_list", handleFileList);
    event_msg_on("file_info", handleFileInfo);

    LOG_INFO("FILE", "Registered 10 file transfer event handlers");
}

void file_transfer_print_status() {
    LOG_INFO("FILE", "=== %s Status ===", FS_NAME);
    LOG_INFO("FILE", "Storage: %u / %u bytes (%.1f%% free)",
             FILESYSTEM.usedBytes(), FILESYSTEM.totalBytes(),
             (float)(FILESYSTEM.totalBytes() - FILESYSTEM.usedBytes()) / FILESYSTEM.totalBytes() * 100);

    if (g_fileSession.isOpen) {
        LOG_INFO("FILE", "Open file: %s", g_fileSession.filename.c_str());
        LOG_INFO("FILE", "Progress: %u / %u bytes", g_fileSession.writtenSize, g_fileSession.totalSize);
        LOG_INFO("FILE", "Buffer: %u / %u bytes (%s)",
                 g_fileSession.bufferPos, g_fileSession.bufferSize,
                 g_fileSession.usingDynamicBuffer ? "Dynamic" : "Static");

        if (g_fileSession.timingActive && g_fileSession.startTime > 0) {
            unsigned long elapsed = millis() - g_fileSession.startTime;
            LOG_INFO("FILE", "Time elapsed: %lu ms (%.2f seconds)", elapsed, elapsed / 1000.0);
            if (elapsed > 0 && g_fileSession.writtenSize > 0) {
                float currentSpeed = (float)g_fileSession.writtenSize / elapsed * 1000;
                LOG_INFO("FILE", "Current speed: %.2f KB/sec", currentSpeed / 1024.0);
            }
        }
    } else {
        LOG_INFO("FILE", "No file open");
    }
}
