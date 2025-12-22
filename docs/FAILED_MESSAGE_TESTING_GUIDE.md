# Failed Message Handling - Testing Guide

## Quick Test Scenarios

### Test 1: Normal Message Flow (Baseline)
**Steps:**
1. Open the chat application
2. Type a message and send
3. **Expected**: Message bubble should turn green within 10 seconds

**Status**: ✅ Should pass (existing functionality)

---

### Test 2: Failed Message with Retry (Text)
**Steps:**
1. Send a text message
2. Quickly disconnect your internet (or use browser dev tools to block WebSocket)
3. Wait 10+ seconds
4. **Expected**: 
   - Message bubble turns RED
   - Status shows "Failed to send"
5. Hover over the failed message
6. **Expected**: "Retry" button appears at bottom-right
7. Reconnect internet
8. Click "Retry" button
9. **Expected**: 
   - Bubble reverts to "sending" state
   - After ACK arrives, bubble turns GREEN
   - Retry button disappears

---

### Test 3: Large File Upload (Critical)
**Steps:**
1. Select a large file (3-5 MB image or video)
2. Add a caption if desired
3. Click Send
4. **Expected**:
   - Upload progress completes first
   - THEN 10-second ACK timer starts
   - Message should NOT fail during upload
   - Message turns green after ACK received

**Note**: This tests the fix where ACK timer now starts AFTER upload completes

---

### Test 4: Late ACK Arrival
**Setup:** You'll need to simulate this by temporarily blocking the ACK response

**Steps:**
1. Send a message
2. Use browser dev tools to block the ACK response
3. Wait 10+ seconds for timeout
4. **Expected**: Message turns RED with Retry button
5. Unblock the ACK response (or wait for it to arrive late)
6. **Expected**: 
   - Message automatically flips from RED to GREEN
   - Retry button disappears
   - Delete button appears (if it's your message)

---

### Test 5: Retry with File Upload
**Steps:**
1. Upload a file (image/audio/video)
2. While sending, disconnect internet or block WebSocket
3. Wait for timeout (message turns RED)
4. **Expected**: Retry button appears
5. Reconnect internet
6. Click Retry
7. **Expected**:
   - File is NOT re-uploaded (reuses existing URL)
   - Only WebSocket message is re-sent
   - Message turns green on ACK
   - 20-second timeout used for retry

---

### Test 6: Multiple Failed Messages
**Steps:**
1. Disconnect internet
2. Send 3-4 messages quickly
3. Wait 10+ seconds
4. **Expected**: All messages turn RED with individual Retry buttons
5. Reconnect internet
6. Click Retry on any message
7. **Expected**: That specific message retries (others stay failed)
8. Click Retry on remaining messages
9. **Expected**: All turn green as ACKs arrive

---

### Test 7: Visual Styling Verification
**Check:**
- ✅ Failed messages have RED background/border (clearly distinct from green/blue)
- ✅ Retry button appears ONLY on hover (desktop) or always (mobile)
- ✅ Retry button positioned at bottom-right of bubble
- ✅ Retry button has light red fill + darker red outline
- ✅ Own messages stay GREEN, others stay BLUE (colors preserved)
- ✅ Delete button still appears on own messages (when sent successfully)

---

### Test 8: Existing Features (Regression Testing)
**Verify these still work:**
- ✅ Send text messages → turn green
- ✅ Send images → preview displays, turn green
- ✅ Send audio → playback works, turn green
- ✅ Send video → preview/playback works, turn green
- ✅ Delete own messages (green messages only)
- ✅ Cannot delete others' messages (blue messages)
- ✅ Online count updates
- ✅ Message history loads on connect
- ✅ Dark mode toggle works
- ✅ Typing indicators work

---

## Browser-Specific Tests

### Desktop (Chrome/Firefox/Safari)
- Retry button appears ONLY on hover
- Cursor changes to pointer on hover

### Mobile (iOS Safari, Android Chrome)
- Retry button always visible (no hover state)
- Touch interaction works smoothly

---

## Developer Console Checks

Look for these log messages:

### On ACK Timeout:
```
[SEND] ACK timeout for message: <messageId>
[FAIL] Marking message as failed: <messageId>
[FAIL] Added retry button to message: <messageId>
```

### On Retry Click:
```
[RETRY] Attempting to retry message: <messageId>
[RETRY] Retry attempt #1
[RETRY] Reusing uploaded URL: <url> (for files)
[RETRY] WS message sent, waiting for ACK with timeout: 20000ms
```

### On Late ACK:
```
[ACK] ✓ Late ACK flipped message from failed to sent: <messageId>
```

### On File Upload:
```
[SEND] Starting file upload...
[SEND] Upload complete, now sending WS message...
```

---

## Expected Timeout Values

| Scenario | Timeout | Notes |
|----------|---------|-------|
| Text message (first attempt) | 10 seconds | Increased from 5s |
| Text message (retry) | 20 seconds | Extra 10s for retry |
| File upload (after upload complete) | 10 seconds | Starts AFTER upload |
| File upload retry | 20 seconds | Does NOT re-upload |
| Self-test ping | 3 seconds | Unchanged |

---

## Common Issues to Check

❌ **Retry button doesn't appear**
- Check: Is it your own message? (Only own messages get retry button)
- Check: Hover over the message (desktop only shows on hover)
- Check console for errors

❌ **Message fails during upload**
- This should NOT happen anymore
- Check: Timer should start AFTER upload completes
- Look for: `[SEND] Upload complete, now sending WS message...`

❌ **Retry uploads file again**
- This should NOT happen
- Check: Should see `[RETRY] Reusing uploaded URL: <url>`

❌ **Late ACK doesn't flip message to green**
- Check: ACK handler should detect failed state
- Look for: `[ACK] ✓ Late ACK flipped message from failed to sent`

---

## Quick Manual Test Script

```javascript
// In browser console:

// 1. Test timeout constants
console.log('DEFAULT_ACK_TIMEOUT_MS:', DEFAULT_ACK_TIMEOUT_MS); // Should be 10000
console.log('RETRY_ACK_TIMEOUT_MS:', RETRY_ACK_TIMEOUT_MS); // Should be 20000

// 2. Check retry data structure
console.log('messageRetryData:', messageRetryData); // Should be a Map

// 3. Force mark a message as failed (replace MESSAGE_ID with actual ID)
// markMessageAsFailed('MESSAGE_ID');
```

---

## Success Criteria

All tests pass if:
1. ✅ Normal messages turn green within 10 seconds
2. ✅ Failed messages turn RED and show Retry button
3. ✅ Retry successfully resends and message turns green
4. ✅ Large file uploads don't fail prematurely
5. ✅ Late ACKs flip failed messages to green automatically
6. ✅ File retry doesn't re-upload, only re-sends WS message
7. ✅ All existing features (delete, colors, previews) still work
