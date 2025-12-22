# Test Checklist - Chat App Updates

## 1. ✅ Rate Limiting & Ban Persistence
- [ ] Send 3 messages quickly (within 10 seconds)
- [ ] Verify you get banned after the 2nd message
- [ ] Check that status message shows "Temporarily blocked until HH:MM:SS"
- [ ] Verify send button and inputs are disabled while banned
- [ ] Refresh the page while banned
- [ ] Confirm ban persists (UI still shows countdown and disabled inputs)
- [ ] Wait for ban to expire and verify inputs re-enable automatically

## 2. ✅ Audio Message Draft Flow
- [ ] Click "Audio Message" button (no mic emoji, just text)
- [ ] Record for 5-10 seconds
- [ ] Click "Stop" button in recording indicator
- [ ] Verify audio draft appears with:
  - [ ] Playback controls (play the audio to confirm it works)
  - [ ] Caption input field
  - [ ] "Send" and "Discard" buttons
- [ ] Add an optional caption
- [ ] Click "Send" and verify:
  - [ ] Audio uploads successfully
  - [ ] Message appears in chat with caption
  - [ ] Shows "Voice message" label if no caption was added
- [ ] Try recording another audio, then click "Discard"
- [ ] Confirm draft is removed without sending

## 3. ✅ Text Messages (Existing Functionality)
- [ ] Send a regular text message
- [ ] Verify it appears with "Sending..." then "Sent ✓"
- [ ] Confirm ACK logic still works (check console logs)
- [ ] Delete your own message
- [ ] Verify it disappears

## 4. ✅ Image Messages (Existing Functionality)
- [ ] Upload an image with caption
- [ ] Verify preview appears before sending
- [ ] Send the image
- [ ] Confirm image uploads and appears in chat
- [ ] Click image to view fullscreen
- [ ] Try removing attachment before sending

## 5. ✅ Microphone Permission Detection
- [ ] In a fresh browser/incognito window, click "Audio Message"
- [ ] Deny microphone permission
- [ ] Verify error shows "Mic blocked - please enable in browser settings"
- [ ] Allow mic permission and try recording again
- [ ] If on a device without a mic, verify you get "Mic error (no device found)"

## 6. ✅ Message Retention
- [ ] Send 50+ messages (can be quick test messages)
- [ ] Verify older messages start to disappear after 100 messages
- [ ] Refresh page and confirm history shows last 100 messages

## 7. ✅ Favicon Check
- [ ] Look at browser tab
- [ ] Verify no emoji favicon is displayed (should be browser default or blank)

## 8. ✅ General Stability
- [ ] Dark mode toggle still works
- [ ] Online count updates correctly
- [ ] Multiple browser tabs work independently
- [ ] No console errors during normal operation
- [ ] Cloudflare tunnel endpoints remain unchanged (wss://ws.ldawg7624.com and https://upload.ldawg7624.com)

---

## Expected Server Console Output
When rate limit is hit, server should log:
```
[RATE-LIMIT] Client <id> banned for <seconds>s (strikes: <count>)
```

## Expected Client Console Output  
When banned, client should log:
```
[WS] Received message type: banned
```

---

## Quick Smoke Test (2 minutes)
1. Send a text message ✓
2. Upload an image ✓  
3. Record and send audio (with draft flow) ✓
4. Trigger rate limit (send 3 messages quickly) ✓
5. Refresh while banned and confirm ban persists ✓
