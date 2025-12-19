# Testing WebSocket ACK Backward Compatibility Fix

## Quick Start

### 1. Start the Server
```bash
cd /workspace
node server.js
```

Expected output:
```
========================================
Kennedy Chat Server
========================================
Server Instance ID: abc123def456
Started: 2025-12-19T...
Port: 8080
WebSocket: ws://localhost:8080
HTTP API: http://localhost:8080
========================================
```

### 2. Open the Application
- **Local**: Open `index.html` in your browser
- **Production**: Navigate to your deployed URL (e.g., https://ldawg7624.com)

### 3. Watch the Console

Open browser DevTools (F12) and look for:

#### ✅ Connection Self-Test (should appear immediately):
```
[CONNECT] ✓ WebSocket connection OPEN
[SELF-TEST] Sending ping with id=xxxx-xxxx messageId=xxxx-xxxx
[WS] RX RAW: {"type":"ack","id":"xxxx-xxxx","messageId":"xxxx-xxxx",...}
[WS] RX JSON: {type: 'ack', id: 'xxxx-xxxx', messageId: 'xxxx-xxxx', ...}
[WS] ✓✓✓ ACK RECEIVED ✓✓✓
[WS] ACK: xxxx-xxxx
[SELF-TEST] ✓ Ping ACK received - connection verified!
```

#### ❌ FAILURE Would Look Like:
```
[SELF-TEST] ❌ FAILED - No ACK received for ping
Connected but ACK path not working
```

### 4. Test Text Message

1. Type "Hello world" in the message box
2. Click Send
3. Look for immediate ACK:

```
[SEND] Sending message via WebSocket...
[SEND] Message ID: yyyy-yyyy
[WS] RX RAW: {"type":"ack","id":"yyyy-yyyy","messageId":"yyyy-yyyy",...}
[WS] ✓✓✓ ACK RECEIVED ✓✓✓
[WS] ACK: yyyy-yyyy
[WS] Message marked as SENT in UI
```

4. Message in UI should show "Sent ✓" status (briefly, ~2 seconds)
5. Message should NOT show "Failed to send (no ACK received)"

### 5. Test Image Upload

1. Click "File" button
2. Select an image (< 10MB)
3. Optionally add a caption
4. Click Send
5. Wait for upload to complete
6. Look for ACK:

```
[UPLOAD] Success: photo.jpg (12345 bytes, image/jpeg)
[SEND] Photo message sent via WebSocket, id=zzzz-zzzz
[WS] RX RAW: {"type":"ack","id":"zzzz-zzzz","messageId":"zzzz-zzzz",...}
[WS] ✓✓✓ ACK RECEIVED ✓✓✓
[WS] ACK: zzzz-zzzz
[WS] Message marked as SENT in UI
```

## Success Criteria

### ✅ PASS Conditions:
- [ ] Ping self-test shows "connection verified" on page load
- [ ] Text messages transition from "Sending..." to "Sent ✓" within 1 second
- [ ] Image messages receive ACK immediately after upload completes
- [ ] Console shows `[WS] ✓✓✓ ACK RECEIVED ✓✓✓` for every message sent
- [ ] NO "Failed to send (no ACK received)" errors
- [ ] NO "ACK TIMEOUT" messages in console
- [ ] Status banner shows "Connected ✓" (briefly after connection)

### ❌ FAIL Conditions:
- Console shows "No ACK received for ping"
- Messages stuck in "Sending..." state for > 5 seconds
- Console shows "ACK TIMEOUT" errors
- Console shows "Failed to send (no ACK received)"
- Red error border appears on messages
- Status banner shows "Connected but ACK path not working"

## Server-Side Verification

Look at server console for matching logs:

### For Ping:
```
[MESSAGE] Type: ping
[MESSAGE] ID: xxxx-xxxx
[MESSAGE] message.messageId: xxxx-xxxx
[MESSAGE] message.id: xxxx-xxxx
[PING] Received ping from ...
[PING] Sent ACK for ping id=xxxx-xxxx messageId=xxxx-xxxx
```

### For Text Message:
```
[MESSAGE] Type: text
[MESSAGE] ID: yyyy-yyyy
[MESSAGE] message.messageId: yyyy-yyyy
[MESSAGE] message.id: yyyy-yyyy
[ACK] *** SERVER abc123 *** Sent ACK for id=yyyy-yyyy messageId=yyyy-yyyy
[BROADCAST] Sent message type=text, id=yyyy-yyyy to 1 clients
```

### For Image Message:
```
[MESSAGE] Type: image
[MESSAGE] ID: zzzz-zzzz
[MESSAGE] message.messageId: zzzz-zzzz
[MESSAGE] message.id: zzzz-zzzz
[ACK] *** SERVER abc123 *** Sent ACK for image id=zzzz-zzzz messageId=zzzz-zzzz
[BROADCAST] Sent message type=image, id=zzzz-zzzz to 1 clients
```

## Troubleshooting

### Issue: No ping ACK received
**Check:**
- Is WebSocket connection actually open? (Should see `[CONNECT] ✓ WebSocket connection OPEN`)
- Is server running and accessible?
- Check server logs for incoming ping message
- Verify no firewall/proxy blocking WebSocket traffic

### Issue: Text messages timeout
**Check:**
- Browser console: Are messages being sent? (Look for `[SEND] Sending message via WebSocket...`)
- Server console: Are messages being received? (Look for `[MESSAGE] Type: text`)
- Server console: Are ACKs being sent? (Look for `[ACK] *** SERVER ... *** Sent ACK`)
- Browser console: Are ACKs being received? (Look for `[WS] RX RAW: {"type":"ack"...}`)
- Check network tab: Is WebSocket frame showing ACK being received?

### Issue: ACK received but not processed
**Check:**
- Browser console: Does ACK have both `id` and `messageId` fields?
- Browser console: Does the ACK ID match the sent message ID?
- Browser console: Is the message in the `pendingMessages` map?

## Advanced Debugging

### Enable Verbose Logging (already enabled)
All relevant logs are already in place:
- `[WS] RX RAW:` - Shows raw WebSocket frame data
- `[WS] RX JSON:` - Shows parsed JSON object
- `[WS] ACK:` - Shows extracted ACK ID
- `[SEND]` - Shows detailed send operation logs
- Server logs show instance ID for multi-server debugging

### Check Pending Messages Map
In browser console:
```javascript
// Should be empty most of the time (messages clear quickly)
pendingMessages
```

### Check WebSocket State
In browser console:
```javascript
ws.readyState
// Should be 1 (OPEN) when connected
```

### Manual Test Send
In browser console:
```javascript
const testId = generateUUID();
ws.send(JSON.stringify({
  type: 'text',
  id: testId,
  messageId: testId,
  nickname: 'Test',
  timestamp: Date.now(),
  text: 'Manual test'
}));
console.log('Sent test message with ID:', testId);
// Watch for ACK with this ID
```

## Expected Timing

- **Ping ACK**: < 100ms (typically 10-50ms on localhost)
- **Text ACK**: < 100ms (typically 10-50ms on localhost)
- **Image ACK**: Depends on upload speed + < 100ms for ACK after upload completes
- **Message Status Update**: Instant (< 50ms after ACK received)

Over network (e.g., production):
- **Ping ACK**: < 500ms
- **Text ACK**: < 500ms
- **Image Upload**: Depends on file size and connection speed (1-10 seconds typical)
- **Image ACK**: < 500ms after upload completes

## Production Testing

If testing on production (e.g., https://ldawg7624.com):

1. Ensure server is running and accessible via Cloudflare tunnel
2. WebSocket should connect to `wss://ws.ldawg7624.com`
3. Upload should go to `https://upload.ldawg7624.com/upload`
4. Same verification steps apply
5. Timing may be slower due to network latency, but ACKs should still arrive within 1 second

## Rollback Plan

If issues occur, the changes are minimal and reversible:
- Frontend: Revert `ws.onmessage` handler to use only `data.messageId`
- Frontend: Remove `messageId` field from outgoing messages (keep only `id`)
- Server: Revert message ID extraction to use only `message.id`
- Server: Remove `id` field from ACK payloads (keep only `messageId`)

However, the backward-compatible approach should handle both old and new versions gracefully.
