# Web Applications

This directory contains web applications for interacting with the ESP32 Lua environment.

## Structure

```
web/
├── index.html              # Main landing page with app links
├── eventstudio/           # Event Studio application
│   ├── index.html         # Event Studio UI
│   └── event_msg.js       # Event messaging protocol library
└── [your-app]/            # Add your custom apps here
```

## Applications

### 📡 Event Studio

**Location**: `eventstudio/index.html`

A full-featured web application for sending and receiving events over Web Bluetooth.

**Features**:
- Web Bluetooth Nordic UART Service (NUS) integration
- Binary-safe event messaging with byte stuffing
- Quick preset buttons for frequently used events
- Real-time event log with string and hex display
- Execute Lua code remotely
- Local storage for presets

**Usage**:
1. Open `eventstudio/index.html` in Chrome/Edge (Web Bluetooth supported browsers)
2. Click "Connect to ESP32"
3. Send events, execute Lua code, or use presets

## Adding New Applications

To add a new web application:

1. **Create a folder** in `web/` directory:
   ```
   web/your-app-name/
   ```

2. **Add your files**:
   ```
   web/your-app-name/
   ├── index.html
   ├── app.js
   └── styles.css
   ```

3. **Reuse shared libraries** (optional):
   - You can copy `event_msg.js` for event messaging
   - Or create your own protocol handler

4. **Update main index.html**:
   - Add a card in `web/index.html` linking to your app

## Event Messaging Protocol

The `event_msg.js` library provides:
- Binary-safe encoding/decoding
- Byte stuffing for control characters
- Event handler registration
- Compatible with ESP32 C++ implementation

**Example Usage**:
```javascript
import { encodeEvent, EventDecoder } from './event_msg.js';

// Create decoder
const decoder = new EventDecoder();

// Register event handler
decoder.on('my_event', (data) => {
    console.log('Received:', data);
});

// Encode and send event
const frame = encodeEvent('test', 'Hello ESP32!');
// Send frame via Web Bluetooth...
```

## Development

- **No build process required** - Pure HTML/CSS/JavaScript
- **Browser requirements**: Chrome/Edge with Web Bluetooth support
- **Testing**: Open files directly in browser or use a local server

## Tips

- Keep each app self-contained in its own folder
- Share common utilities (like `event_msg.js`) by copying or symlinking
- Use relative paths for imports within an app
- Test on both desktop and mobile browsers
