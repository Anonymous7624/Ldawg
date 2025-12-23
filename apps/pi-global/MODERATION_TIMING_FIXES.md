# Moderation Feedback + Enforcement Timing Fixes

## Summary
Fixed critical timing bugs in the moderation system to provide immediate feedback and reliable enforcement.

## Problems Fixed

### 1. **Delayed Moderation Feedback** (5-second delay)
   - **Before**: When moderation blocked a send, users waited ~5 seconds for a generic "message may not have sent" error
   - **After**: Server sends immediate `moderation_notice` event within the same tick as processing

### 2. **Strike Messages Not Showing**
   - **Before**: Strike notifications were delayed or not displayed
   - **After**: Strike notices appear immediately as system messages in the chat

### 3. **Mute Not Actually Enforced**
   - **Before**: Server logged mute but didn't enforce it; users could keep sending
   - **After**: Server checks mute status at the very start of ALL message handlers (before rate limiting)

### 4. **Spam During Wait Window**
   - **Before**: Users could spam-send attempts during the delay window
   - **After**: Client-side send lock prevents sends for 500ms or until server response

## Server Changes (`apps/pi-global/server.js`)

### 1. Added `sendModerationNotice()` Function
```javascript
// Sends immediate moderation response to client
// Includes: strikes, mute status, remaining time, action type, found words
```

### 2. Mute Enforcement at Start of Handler
- Moved mute check to the **very start** of message processing
- Happens BEFORE rate limiting, BEFORE any other checks
- Applies to ALL message types: text, image, audio, video, file

### 3. Immediate Response for All Moderation Actions
- **`muted_attempt`**: User tried to send while muted
- **`blocked_name`**: Display name contains banned words
- **`blocked_message`**: Message blocked (if implemented)
- **`sanitized_message`**: Message was sanitized (banned words replaced)

### 4. Response Format
```json
{
  "type": "moderation_notice",
  "strikes": 3,
  "muted": true,
  "muteRemainingMs": 15000,
  "muteUntil": 1703350000000,
  "seconds": 15,
  "reason": "Message contains banned words",
  "action": "sanitized_message",
  "foundWords": ["badword1", "badword2"],
  "cookies": {
    "gc_strikes": 3,
    "gc_muteUntil": 1703350000000
  }
}
```

## Client Changes (`index.html`)

### 1. Added `addSystemMessage()` Function
- Displays moderation notices as system messages in the chat
- Styled with red border and warning background
- Visible immediately to the user

### 2. Added `handleModerationNotice()` Function
- Processes `moderation_notice` events from server
- Updates profanity state and cookies
- Displays appropriate system message and toast
- Disables UI if muted with countdown timer
- **Clears send lock immediately**

### 3. Send Lock Mechanism
```javascript
window.isSendLocked = false;  // Global send lock state
const SEND_LOCK_DURATION = 500;  // 500ms lock
```
- Locks on send attempt
- Auto-releases after 500ms OR on server ACK/notice
- Prevents rapid retry spam

### 4. Updated WebSocket Handler
- Added handler for `moderation_notice` event
- Added legacy support for `name_violation` (converts to moderation_notice format)
- ACK handler clears send lock immediately

### 5. Updated `sendMessage()` Function
- Checks send lock at the very start
- Sets lock before sending
- Auto-release timer as fallback

## User Experience Improvements

### Before
1. User sends banned word ➔ waits ➔ waits ➔ "message may not have sent"
2. User can spam attempts during wait
3. Mute is logged but not enforced
4. No visibility into strike count

### After
1. User sends banned word ➔ **immediate system message** "⚠️ Strike 3: Profanity filtered from your message - Muted for 15s"
2. Send button locked for 500ms after each attempt
3. Mute is **actually enforced** - all sends rejected at server
4. Real-time countdown of mute duration
5. Clear feedback for every moderation action

## Testing Scenarios

### Test 1: Send Message with Banned Word
1. Type a message with a banned word
2. Click send
3. **Expected**: 
   - Message appears instantly (but sanitized)
   - System message appears: "Strike X: Profanity filtered"
   - If muted: countdown timer shows, inputs disabled

### Test 2: Send While Muted
1. Get muted (3+ strikes)
2. Try to send another message
3. **Expected**:
   - Message is immediately rejected
   - System message: "You are currently muted - Xs remaining"
   - No 5-second delay

### Test 3: Banned Name
1. Change nickname to contain banned word
2. Send a message
3. **Expected**:
   - Message blocked immediately
   - System message: "Strike X: Name blocked"
   - Strike counter increments

### Test 4: Rapid Send Attempts
1. Try to click send multiple times rapidly
2. **Expected**:
   - Only first send goes through
   - Subsequent attempts blocked by send lock (500ms)
   - No spam to server

## Backward Compatibility

- Server still sends `profanity_strike` and `profanity_muted` for old clients
- New clients prioritize `moderation_notice` over legacy events
- Old clients continue to work (just with old behavior)

## Files Modified

1. `/workspace/apps/pi-global/server.js`
   - Added `sendModerationNotice()` helper
   - Moved mute check to start of handler
   - Send immediate notices for all moderation actions

2. `/workspace/index.html`
   - Added `addSystemMessage()` function
   - Added `handleModerationNotice()` function
   - Added send lock mechanism (500ms)
   - Updated WebSocket message handler
   - Updated `sendMessage()` function

## No Changes To

- Rate limiting logic
- Profanity filtering algorithm
- Strike/mute calculation
- Database operations
- Upload functionality
- Other chat features

## Notes

- All changes are minimal and focused on timing/feedback
- No new features added
- Chat and uploads continue to work normally
- Server is now authoritative for mute enforcement (as it should be)
