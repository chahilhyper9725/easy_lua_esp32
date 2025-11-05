# File Transfer System - Usage Guide

## Overview

The file transfer system provides a robust, event-based API for transferring files between the web IDE and ESP32 via BLE using the event_msg protocol.

## Filesystem Selection

By default, the system uses **LittleFS**. To switch to SPIFFS:

1. Open `src/modules/file_transfer.h`
2. Comment out `#define USE_LITTLEFS`
3. Uncomment `#define USE_SPIFFS`

```cpp
// #define USE_LITTLEFS
#define USE_SPIFFS
```

## Event Protocol

All events use the `event_msg` protocol with JSON payloads for commands and responses, and binary data for file content.

### File Operations

#### 1. Initialize Filesystem
Get filesystem information.

**Send:**
```javascript
event: "file_init"
data: {}  // empty
```

**Response:**
```javascript
event: "file_init_response"
data: {
  "status": "success",
  "filesystem": "LittleFS",  // or "SPIFFS"
  "total_bytes": 1048576,
  "used_bytes": 102400,
  "free_bytes": 946176
}
```

#### 2. Create/Open File
Create a new file for writing.

**Send:**
```javascript
event: "file_create"
data: {
  "filename": "/test.txt",
  "size": 1024,              // expected total size (optional)
  "buffer_size": 4096        // buffer size (optional, default: 4096)
}
```

**Response:**
```javascript
event: "file_create_response"
data: {
  "status": "success",
  "filename": "/test.txt",
  "buffer_size": 4096,
  "expected_size": 1024
}
```

#### 3. Append Data
Write binary data to the open file.

**Send:**
```javascript
event: "file_append"
data: [binary data bytes]
```

**Response (when buffer is full or manually flushed):**
```javascript
event: "file_append_ack"
data: {
  "status": "ack",
  "bytes": 4096,           // bytes written in this flush
  "crc": 0x12345678,       // CRC32 of this chunk
  "total": 8192,           // total bytes written so far
  "timestamp": 12345
}
```

#### 4. Flush Buffer
Manually flush the write buffer to disk.

**Send:**
```javascript
event: "file_flush"
data: {}
```

**Response:**
```javascript
event: "file_append_ack"  // same as append ack
data: {
  "status": "ack",
  "bytes": 512,
  "crc": 0xABCDEF01,
  "total": 8704,
  "timestamp": 12678
}
```

#### 5. Seek to Position
Change the file write/read position.

**Send:**
```javascript
event: "file_seek"
data: {
  "position": 512
}
```

**Response:**
```javascript
event: "file_seek_response"
data: {
  "status": "success",
  "position": 512
}
```

#### 6. Close File
Close the current file and get transfer statistics.

**Send:**
```javascript
event: "file_close"
data: {}
```

**Response:**
```javascript
event: "file_close_response"
data: {
  "status": "success",
  "filename": "/test.txt",
  "bytes_written": 1024,
  "expected_size": 1024,
  "size_difference": 0,
  "elapsed_ms": 1234,
  "flush_count": 3,
  "total_flush_ms": 45,
  "avg_flush_ms": 15.0,
  "speed_bps": 829.268,
  "speed_kbps": 0.81
}
```

#### 7. Read File
Read a file from the ESP32.

**Send:**
```javascript
event: "file_read"
data: {
  "filename": "/test.txt",
  "offset": 0,              // start position
  "size": 4096              // bytes to read (default: 4096)
}
```

**Response (metadata first):**
```javascript
event: "file_read_metadata"
data: {
  "status": "success",
  "bytes": 1024,
  "crc": 0x98765432,
  "offset": 0
}
```

**Response (binary data second):**
```javascript
event: "file_read_data"
data: [binary data bytes]
```

#### 8. Delete File
Delete a file from the filesystem.

**Send:**
```javascript
event: "file_delete"
data: {
  "filename": "/test.txt"
}
```

**Response:**
```javascript
event: "file_delete_response"
data: {
  "status": "success",
  "filename": "/test.txt"
}
```

#### 9. List Files
List files in a directory.

**Send:**
```javascript
event: "file_list"
data: {
  "path": "/"
}
```

**Response:**
```javascript
event: "file_list_response"
data: {
  "status": "success",
  "path": "/",
  "files": [
    {
      "name": "/test.txt",
      "size": 1024,
      "is_dir": false
    },
    {
      "name": "/data",
      "size": 0,
      "is_dir": true
    }
  ]
}
```

#### 10. Get Filesystem Info
Get filesystem status and active session info.

**Send:**
```javascript
event: "file_info"
data: {}
```

**Response:**
```javascript
event: "file_info_response"
data: {
  "status": "success",
  "filesystem": "LittleFS",
  "total_bytes": 1048576,
  "used_bytes": 102400,
  "free_bytes": 946176,
  "active_session": {      // only if file is open
    "filename": "/test.txt",
    "processed": 512,
    "buffered": 128,
    "total": 1024
  }
}
```

## Example: Upload File from Web IDE

```javascript
// 1. Create file
await sendEvent("file_create", {
  filename: "/myfile.lua",
  size: fileData.length,
  buffer_size: 8192
});

// 2. Send data in chunks
const CHUNK_SIZE = 4096;
for (let offset = 0; offset < fileData.length; offset += CHUNK_SIZE) {
  const chunk = fileData.slice(offset, offset + CHUNK_SIZE);
  await sendEvent("file_append", chunk);

  // Wait for ack every few chunks
  if ((offset / CHUNK_SIZE) % 4 === 0) {
    await sendEvent("file_flush", {});
    // Wait for file_append_ack event
  }
}

// 3. Close file
await sendEvent("file_close", {});
// Wait for file_close_response with statistics
```

## Features

- **Buffered Writing**: Automatic buffer management with configurable sizes (4KB - 32KB)
- **PSRAM Support**: Uses PSRAM for large buffers if available
- **CRC32 Validation**: Hardware-accelerated CRC for data integrity
- **Performance Tracking**: Detailed timing and speed statistics
- **Binary Safe**: Full support for binary file transfers
- **Path Sanitization**: Automatic path validation and cleanup

## Error Handling

All responses include a `"status"` field:
- `"success"`: Operation completed successfully
- `"ack"`: Data acknowledged (for file_append)
- `"error"`: Operation failed, check `"message"` field

Example error:
```json
{
  "status": "error",
  "message": "No file open"
}
```

## Notes

- File paths are automatically sanitized (prepends `/` if missing, removes `..`)
- Buffer automatically flushes when full
- Use `file_flush` for manual flushing and to get ACKs with CRC
- Close file to get detailed transfer statistics
- Maximum single read: 4096 bytes (use multiple reads for larger files)
