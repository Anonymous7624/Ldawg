# Kennedy Chat

Real-time chat application with WebSocket support, file uploads, camera integration, and persistent chat history.

## Architecture

- **Frontend**: Static HTML/CSS/JS hosted on GitHub Pages (ldawg7624.com)
- **Backend**: Node.js server on Raspberry Pi (port 8080)
- **WebSocket**: `wss://ws.ldawg7624.com` (via Cloudflare tunnel)
- **HTTP API**: `https://ws.ldawg7624.com` (via Cloudflare tunnel)
- **Database**: SQLite (`chat.db`) for persistent message history

## Features

### Persistent Chat History
- ✅ **Messages persist across server restarts** using SQLite database
- ✅ **600 message cap** - automatically prunes oldest messages when limit exceeded
- ✅ **Smart file cleanup** - uploaded files deleted only when message pruned and no other references exist
- ✅ **All message types supported**: text, images, audio, files
- ✅ **Zero client changes required** - same protocol as before

See [PERSISTENT_CHAT_IMPLEMENTATION.md](PERSISTENT_CHAT_IMPLEMENTATION.md) for technical details.

## Recent Bug Fixes (Production)

### Issue 1: Messages Not Sending ✓ FIXED
**Problem**: WebSocket was connecting to GitHub Pages instead of the backend server.

**Fix**: Changed WebSocket URL from `window.location.host` to hardcoded `wss://ws.ldawg7624.com`.

**Code Changes**:
- `index.html` line 574: Added `const WS_URL = 'wss://ws.ldawg7624.com'`
- Added connection status logging
- Added check for `readyState === OPEN` before sending messages

### Issue 2: File Upload Failing with HTML Response ✓ FIXED
**Problem**: Upload endpoint was using relative URL `/upload`, which hit GitHub Pages (returning HTML 404).

**Fix**: Changed to absolute URL `https://ws.ldawg7624.com/upload`.

**Code Changes**:
- `index.html` line 575: Added `const API_BASE = 'https://ws.ldawg7624.com'`
- All fetch calls now use `API_BASE + '/upload'`
- Added content-type validation before parsing JSON
- Added detailed error logging showing response status and content-type
- Added CORS headers to server to allow cross-origin requests

### Issue 3: App Naming ✓ FIXED
**Problem**: App was called "Global Chat Room" instead of "Kennedy Chat".

**Fix**: Renamed throughout codebase.

**Changes**:
- Page title: `<title>Kennedy Chat</title>`
- Header: `<h1>Kennedy Chat</h1>`
- package.json: `"name": "kennedy-chat"`
- Server startup message: "Kennedy Chat Server"

### Issue 4: Emoji Clutter ✓ FIXED
**Problem**: Too many emojis and decorative icons cluttering the UI.

**Fix**: Removed all emojis, replaced with clean text labels.

**Changes**:
- Header: Removed 🌍
- Dark mode toggle: Changed from "🌙 Dark Mode" / "☀️ Light Mode" to "Dark Mode" / "Light Mode"
- Camera button: Changed from "📷" to "Camera"
- File button: Changed from "📎" to "File"
- Send button: Changed from "Send Message" to "Send"
- Capture button: Changed from "📸 Capture" to "Capture"
- File display: Removed 📄 icon
- Mute message: Removed ⏸️ icon

### Issue 5: Insufficient Server Logging ✓ FIXED
**Problem**: Server had minimal logging, making debugging difficult.

**Fix**: Added comprehensive logging for all operations.

**New Logs**:
- `[CONNECT]` - Client connected with connection ID and total client count
- `[HISTORY]` - Chat history sent to new clients
- `[MESSAGE]` - Message received (type, length, content preview)
- `[BROADCAST]` - Message broadcast with recipient count
- `[UPLOAD]` - Upload request received and processed
- `[RATE-LIMIT]` - Rate limit violations
- `[DISCONNECT]` - Client disconnected with code and reason
- `[ERROR]` - WebSocket and processing errors

## Server Setup

### Prerequisites
```bash
cd /workspace
npm install
```

### Start Server
```bash
npm start
# Or:
node server.js
```

Server will listen on port 8080. You should see:
```
========================================
Kennedy Chat Server
========================================
Port: 8080
WebSocket: ws://localhost:8080
HTTP API: http://localhost:8080
Uploads dir: /workspace/uploads
========================================
```

### Cloudflare Tunnel Configuration

Ensure your Cloudflare tunnel is configured to route:
- `ws.ldawg7624.com` → `http://localhost:8080`

The tunnel must support:
- WebSocket upgrades (for chat)
- Regular HTTP (for uploads and static files)

Example `cloudflared` config:
```yaml
tunnel: <your-tunnel-id>
credentials-file: /path/to/credentials.json

ingress:
  - hostname: ws.ldawg7624.com
    service: http://localhost:8080
  - service: http_status:404
```

## Testing Instructions

### Test 1: Two Clients Can Chat (Both Directions)

1. **Open Client A**:
   - Open https://ldawg7624.com in browser
   - Open DevTools Console (F12)
   - Enter nickname: "Alice"
   - Type message: "Hello from Alice"
   - Click "Send"

2. **Open Client B** (different browser or incognito):
   - Open https://ldawg7624.com
   - Open DevTools Console
   - Enter nickname: "Bob"
   - Type message: "Hello from Bob"
   - Click "Send"

3. **Verify**:
   - Alice should see both messages
   - Bob should see both messages
   - Check console logs for:
     ```
     Connecting to WebSocket: wss://ws.ldawg7624.com
     Connected to Kennedy Chat server
     Sending message: { type: 'text', nickname: ... }
     ```

4. **Server Logs** (on Raspberry Pi):
   ```
   [CONNECT] Client connected: <ip>:<port> (id: abc123)
   [CONNECT] Total clients: 1
   [HISTORY] Sent 0 messages to abc123
   [MESSAGE] Received from abc123: type=text, length=XX bytes
   [MESSAGE] Text message from Alice: "Hello from Alice"
   [BROADCAST] Sent message type=text to 1 clients
   ```

### Test 2: File Upload Works (Returns JSON, Not HTML)

1. **Prepare Test File**:
   - Create a small test image (< 1 MB)

2. **Upload**:
   - Open https://ldawg7624.com
   - Open DevTools Network tab
   - Enter nickname: "Tester"
   - Click "File" button
   - Select test image
   - Wait for upload

3. **Verify in Network Tab**:
   - Find request to `https://ws.ldawg7624.com/upload`
   - Status: `200 OK`
   - Content-Type: `application/json`
   - Response body:
     ```json
     {
       "success": true,
       "url": "/uploads/abc123.jpg",
       "filename": "test.jpg",
       "mime": "image/jpeg",
       "size": 12345,
       "isImage": true
     }
     ```

4. **Verify in Chat**:
   - Image should appear in chat with preview
   - Other clients should see the image
   - Click image to open full size

5. **Console Logs**:
   ```
   Uploading file to: https://ws.ldawg7624.com/upload
   Upload response status: 200
   Upload response content-type: application/json
   Upload result: { success: true, ... }
   Upload successful
   ```

6. **Server Logs**:
   ```
   [UPLOAD] Received upload request
   [UPLOAD] Success: test.jpg (12345 bytes, image/jpeg)
   [MESSAGE] Received from abc123: type=image, length=XX bytes
   [MESSAGE] Image from Tester: test.jpg (12345 bytes)
   [BROADCAST] Sent message type=image to 2 clients
   ```

### Test 3: Camera Capture Works

1. **Open Camera**:
   - Click "Camera" button
   - Grant camera permissions
   - See camera preview

2. **Capture Photo**:
   - Click "Capture" button
   - Wait for upload

3. **Verify**:
   - Camera modal closes
   - Photo appears in chat
   - Other clients see the photo
   - Check console for same upload logs as Test 2

### Test 4: Error Handling for Wrong Endpoint

This simulates the previous bug to confirm it's fixed.

1. **Open DevTools Console**
2. **Manually trigger a bad upload**:
   ```javascript
   // This should fail gracefully now
   fetch('/upload', {
     method: 'POST',
     body: new FormData()
   }).then(r => r.json()).catch(e => console.error('Expected error:', e))
   ```

3. **Expected Result**:
   - If you're on GitHub Pages, this will get an HTML 404
   - But the actual app uses `https://ws.ldawg7624.com/upload`, which works

## Configuration

### Frontend Configuration (index.html)

Located near line 574:
```javascript
const WS_URL = 'wss://ws.ldawg7624.com';
const API_BASE = 'https://ws.ldawg7624.com';
```

**Change these if you:**
- Use a different domain
- Run on different infrastructure
- Test locally (use `ws://localhost:8080` for local testing)

### Server Configuration (server.js)

Key constants:
```javascript
const PORT = 8080;                          // Server port
const MAX_MESSAGES = 50;                     // Chat history size
const MAX_UPLOAD_SIZE = 10 * 1024 * 1024;   // 10MB upload limit
const RATE_LIMIT_MESSAGES = 7;              // Messages per window
const RATE_LIMIT_WINDOW = 10000;            // 10 seconds
const MUTE_DURATION_FIRST = 15000;          // 15 seconds
const MUTE_DURATION_STRIKES = 120000;       // 2 minutes
```

## Troubleshooting

### Messages Not Sending

**Check**:
1. Browser console: Should see "Connected to Kennedy Chat server"
2. If disconnected, check server is running
3. Verify Cloudflare tunnel is active
4. Verify WebSocket URL is `wss://ws.ldawg7624.com`

**Server Side**:
```bash
# Check if server is running
ps aux | grep node

# Check if port 8080 is listening
netstat -an | grep 8080

# Restart server
npm start
```

### Uploads Returning HTML Instead of JSON

**Symptoms**:
- Error message: "unexpected token '<'"
- Console shows HTML response starting with "<!DOCTYPE html>"

**Causes**:
1. Server not running
2. Cloudflare tunnel not configured for HTTP
3. Wrong API_BASE URL
4. CORS blocking the request

**Check**:
1. Test upload endpoint directly:
   ```bash
   curl -X POST https://ws.ldawg7624.com/upload \
     -F "file=@test.jpg" \
     -H "Origin: https://ldawg7624.com"
   ```
   Should return JSON, not HTML.

2. Check server logs for `[UPLOAD]` entries

3. Verify CORS headers are set:
   ```bash
   curl -I https://ws.ldawg7624.com/healthz \
     -H "Origin: https://ldawg7624.com"
   ```
   Should include:
   ```
   Access-Control-Allow-Origin: *
   ```

### WebSocket Connects but Messages Don't Appear

**Check**:
1. Server logs: Should see `[MESSAGE]` and `[BROADCAST]` entries
2. Client console: Should see "Sending message: ..."
3. Verify message format is correct (type, nickname, text fields)
4. Check if rate limited (should see warning in UI)

### Camera Not Working

**Common Issues**:
1. HTTPS required for camera access (GitHub Pages provides this)
2. Camera permissions denied
3. No camera available on device

**Check**:
- Browser should prompt for camera permission
- Page must be served over HTTPS
- Test on device with camera

## Security Features

1. **Rate Limiting**: 7 messages per 10 seconds, automatic muting
2. **File Type Filtering**: Blocks .js, .html, .svg files
3. **File Size Limit**: 10MB maximum
4. **XSS Prevention**: All user content is HTML-escaped
5. **CORS Configured**: Allows cross-origin requests from frontend
6. **Secure Headers**: X-Content-Type-Options on file downloads

## File Cleanup

- Uploads older than 1 hour are automatically deleted
- Messages beyond 50 are removed from history (and their files deleted)
- Cleanup runs every 5 minutes

## Message Protocol

### Client → Server (Text Message)
```json
{
  "type": "text",
  "nickname": "Alice",
  "text": "Hello world"
}
```

### Client → Server (Image/File Message)
```json
{
  "type": "image",
  "nickname": "Alice",
  "url": "https://ws.ldawg7624.com/uploads/abc123.jpg",
  "filename": "photo.jpg",
  "mime": "image/jpeg",
  "size": 12345
}
```

### Server → Client (History)
```json
{
  "type": "history",
  "items": [
    {
      "type": "text",
      "id": "abc123",
      "nickname": "Alice",
      "timestamp": 1234567890000,
      "text": "Hello"
    }
  ]
}
```

### Server → Client (Broadcast Message)
```json
{
  "type": "text",
  "id": "abc123",
  "nickname": "Alice",
  "timestamp": 1234567890000,
  "text": "Hello"
}
```

### Server → Client (Rate Limited)
```json
{
  "type": "muted",
  "seconds": 15,
  "strikes": 1
}
```

## License

MIT
