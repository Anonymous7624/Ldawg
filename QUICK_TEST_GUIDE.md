# Quick Test Guide - 3 New Features

## Setup
1. Start the server: `node server.js`
2. Open 3-4 browser tabs to `http://localhost:8080` (or your deployed URL)
3. Give each tab a different nickname (e.g., "Alice", "Bob", "Charlie", "Diana")

---

## Test 1: Rich Text + Emoji Picker

### Basic Formatting
1. In Tab 1 (Alice):
   - Type "Hello World"
   - Select "Hello" and click **B** (bold)
   - Select "World" and click **I** (italic)
   - Click Send
2. In Tabs 2-4:
   - ✅ Verify "**Hello** *World*" displays with formatting

### Font Changes
1. In Tab 2 (Bob):
   - Type "Testing fonts"
   - Select all text
   - Change font dropdown to "Georgia"
   - Click Send
2. In other tabs:
   - ✅ Verify text displays in Georgia font

### Font Size
1. In Tab 3 (Charlie):
   - Type "BIG TEXT"
   - Select all
   - Change size dropdown to "22"
   - Click Send
2. In other tabs:
   - ✅ Verify text displays larger

### Emoji Picker
1. In any tab:
   - Click the 😊 emoji button
   - ✅ Verify emoji panel opens with ~30 emojis
   - Click 🔥 emoji
   - ✅ Verify it inserts into composer
   - Click Send
2. In other tabs:
   - ✅ Verify emoji displays correctly

### Security Test (CRITICAL)
1. In Tab 1:
   - Open browser DevTools Console
   - Type: `document.getElementById('composer').innerHTML = '<script>alert("XSS")</script>Test'`
   - Click Send
2. In other tabs:
   - ✅ Verify NO alert appears (script was sanitized)
   - ✅ Verify only "Test" text displays

---

## Test 2: Persistent Ban (Most Important)

### Initial Ban
1. In Tab 1 (Alice):
   - Send 3 messages rapidly (within 10 seconds)
   - ✅ Should see "Temporarily blocked" message with countdown

### Refresh Test (THE KEY TEST)
2. **Do NOT close Tab 1** - just click browser refresh (F5 or Cmd+R)
3. After page reloads:
   - ✅ Ban message should IMMEDIATELY appear
   - ✅ Timer should continue from where it was (not reset to full time)
   - ✅ Try to send message → should be blocked
   - ✅ Inputs should be disabled

### Cross-Tab Test
4. Open a NEW tab in the SAME browser
5. Go to chat app
   - ✅ Should ALSO show ban message
   - ✅ Same token = same ban

### Different Browser Test
6. Open chat in a DIFFERENT browser (or incognito)
   - ✅ Should NOT be banned (different token)
   - ✅ Can send messages normally

### Wait for Expiry
7. Wait for ban timer to reach 0:00
   - ✅ Ban message disappears
   - ✅ Inputs re-enabled
   - ✅ Can send messages again

---

## Test 3: Typing Indicators

### Single User Typing
1. In Tab 1 (Alice):
   - Start typing in the composer (don't send)
2. In Tab 2 (Bob):
   - ✅ Should see "Alice is typing..." appear (below messages, above composer)
3. In Tab 1:
   - Stop typing (don't clear text)
   - Wait 12 seconds
4. In Tab 2:
   - ✅ "Alice is typing..." should disappear after ~12s

### Multiple Users (2-3)
1. In Tabs 1, 2, 3:
   - All start typing at same time
2. In Tab 4 (observer):
   - ✅ Should see "Alice is typing... • Bob is typing... • Charlie is typing..."
   - ✅ Should see all 3 names

### Multiple Users (4+) - THE AGGREGATE TEST
1. Open 4 or more tabs with different nicknames
2. In Tabs 1, 2, 3, 4:
   - All start typing at same time
3. In Tab 5 (observer):
   - ✅ Should see **"Several people are typing..."** (NOT 4 individual names)
   - ✅ Should see ONLY ONE line

### Stop Typing on Send
1. In Tab 1 (Alice):
   - Start typing
2. In Tab 2:
   - ✅ See "Alice is typing..."
3. In Tab 1:
   - Click Send button
4. In Tab 2:
   - ✅ "Alice is typing..." should disappear IMMEDIATELY when message sends

### Throttling Test
1. In Tab 1:
   - Open DevTools Network tab
   - Type continuously for 5 seconds
2. Check network:
   - ✅ Should see typing events sent ~every 800ms (not every keystroke)

---

## Regression Tests (Ensure Nothing Broke)

### Text Messages
- ✅ Can send plain text messages
- ✅ Messages appear on all clients
- ✅ ACK shows "Sent ✓"

### Image Upload
- ✅ Click File button
- ✅ Select an image
- ✅ Add caption
- ✅ Click Send
- ✅ Image displays on all clients with caption

### Audio Messages
- ✅ Click "Audio Message"
- ✅ Allow microphone
- ✅ Record for a few seconds
- ✅ Click Stop
- ✅ Preview plays correctly
- ✅ Click Send
- ✅ Audio message appears on all clients

### Delete Messages
- ✅ Send a message
- ✅ "Delete" button appears on YOUR messages
- ✅ Click Delete
- ✅ Message removes from all clients

### Online Count
- ✅ Open multiple tabs
- ✅ "Online: X" count increases
- ✅ Close a tab
- ✅ Count decreases

### Dark Mode
- ✅ Click "Dark Mode" button
- ✅ Theme changes to dark
- ✅ Refresh page → theme persists

---

## Expected Console Output

### Client Console (DevTools)
```
[TOKEN] Using client token: abc123...
[CONNECT] Attempting WebSocket connection
[CONNECT] ✓ WebSocket connection OPEN
[SELF-TEST] Sending ping...
[SELF-TEST] ✓ Ping ACK received
[SEND] Sending text message with formatting
[WS] ✓ ACK RECEIVED for id=...
```

### Server Console
```
[CONNECT] Client connected: a1b2 (token: abc123...)
[MESSAGE] Type: text
[MESSAGE] ID: abc123
[ACK] Sent ACK for id=abc123
[BROADCAST] Sent message type=text to 3 clients
[MESSAGE] Type: typing
[RATE-LIMIT] Client a1b2 banned for 60s
```

---

## Troubleshooting

### Rich text not working?
- Check browser console for sanitization errors
- Verify `composer` is contenteditable div (not textarea)

### Ban not persisting after refresh?
- Check browser console for token
- Verify cookies are enabled
- Check `localStorage.getItem('chat_token')`

### Typing indicator not showing?
- Check server logs for "Type: typing" messages
- Verify WebSocket is connected
- Check if typing container exists in DOM

### "Connected but ACK path not working"?
- Server may be wrong instance
- Check server console for ACK logs
- Verify WebSocket URL is correct

---

## Success Indicators

When all tests pass, you should see:

✅ **Rich text** displays correctly across all clients  
✅ **No XSS** possible (scripts blocked)  
✅ **Bans persist** through page refresh  
✅ **Typing shows** for 1-3 users individually  
✅ **Typing aggregates** to "Several people..." for 4+  
✅ **All old features** still work perfectly

---

## Quick Verification Script

Run in browser console on any client:

```javascript
// Check token exists
console.log('Token:', localStorage.getItem('chat_token'));

// Check ban state
console.log('Ban until:', localStorage.getItem('chatBanUntil'));

// Check WebSocket
console.log('WebSocket:', ws ? 'Connected' : 'Not connected');

// Check clientId
console.log('My Client ID:', myClientId);

// Test sanitizer
console.log('Sanitizer test:', sanitizeHTML('<script>alert("bad")</script><b>Good</b>'));
// Should output: <b>Good</b>
```

Expected output:
```
Token: abc123-def456-...
Ban until: null
WebSocket: Connected
My Client ID: a1b2c3d4
Sanitizer test: <b>Good</b>
```

---

**End of Test Guide**

All features ready for production! 🚀
