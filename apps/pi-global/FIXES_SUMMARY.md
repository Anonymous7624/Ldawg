# Global Chat Fixes Summary

## Date: 2025-12-22

This document summarizes the fixes applied to the pi-global chat application to address two critical issues.

---

## ISSUE 1: Immediate Censoring for Sender

### Problem
When a user sent a message containing profanity, they would see the **uncensored version** immediately in their UI (optimistic echo), while other users saw the censored version. The sender would only see the censored version after reloading the page.

### Root Cause
The client was using optimistic UI rendering - immediately displaying the message locally before the server confirmed receipt. Since profanity filtering happens server-side, the local optimistic message was uncensored.

### Solution Implemented
**Removed optimistic echo for text messages** (Option A from requirements)

**File Modified:** `/workspace/index.html`
- **Location:** `sendMessage()` function, lines ~3241
- **Change:** Removed the `addMessage(messageData, true, messageId, 'sending')` call for text messages
- **Behavior:** Text messages are now ONLY displayed after the server broadcasts them back (already censored)

**Benefits:**
- Sender sees censored version immediately (same as everyone else)
- No uncensored flash
- Server remains the authoritative sanitizer
- Simpler implementation (no need to duplicate banned-words list to client)

**Note:** File uploads still use optimistic UI during upload, which is appropriate since they need visual feedback during the upload process.

---

## ISSUE 2: Strikes Persist Across Reloads (Cookie Persistence)

### Problem
Profanity strikes and mute timers would reset whenever a user refreshed the page, allowing users to bypass moderation by simply reloading.

### Root Cause
While the code had cookie infrastructure (`gc_sid`, `gc_strikes`, `gc_muteUntil`), the cookies were only **read** on page load but never **updated** when strikes changed. The profanity state existed only in server memory during runtime.

### Solution Implemented
**Added cookie updates when profanity state changes**

#### Server-Side Changes

**File Modified:** `/workspace/apps/pi-global/server.js`

1. **profanity_strike notification** (lines ~698-719)
   - Added `cookies` field to the message sent to client
   - Contains: `gc_strikes` and `gc_muteUntil` values
   
2. **profanity_muted notification** (lines ~671-686)
   - Added `cookies` field to the message sent to client
   - Contains: `gc_strikes` and `gc_muteUntil` values

**Server already had:**
- Cookie reading on WebSocket connect (lines 450-463)
- Cookie validation (strikes: 0-1000, muteUntil must be future timestamp)
- In-memory profanity state keyed by `gc_sid`

#### Client-Side Changes

**File:** `/workspace/index.html`

**No changes needed!** The client already had full cookie persistence implemented:
- `setProfanityState()` function (lines ~1645-1658) sets both cookies
- `handleProfanityStrike()` (lines ~1763-1790) calls `setProfanityState()`
- `handleProfanityMuted()` (lines ~1792-1807) calls `setProfanityState()`
- `getProfanityState()` function (lines ~1627-1634) reads cookies on page load

The cookies are now updated properly because the server sends the values in the notification messages.

---

## Cookie Security Notes

### Validation Applied
Per requirements, cookie values are validated on server load:
- `gc_strikes`: Must be integer between 0 and 1000
- `gc_muteUntil`: Must be valid timestamp in the future (past timestamps ignored)

### Cookie Tampering Prevention
- While cookies can be modified by users, the server applies validation on load
- Strikes cannot be set to negative values or unreasonably high values (>1000)
- Mute expiry times in the past are ignored (mute is lifted)
- If a user tampers with cookies to reduce strikes, they still start fresh from that lower value (acceptable tradeoff for simplicity)
- The server's in-memory state is authoritative during a connection
- Profanity filtering still happens server-side, so users cannot bypass detection

---

## Testing Checklist

### Issue 1 Testing
- [ ] Send a message with profanity (e.g., "damn")
- [ ] Verify sender sees censored version immediately (e.g., "----")
- [ ] Verify no uncensored flash occurs
- [ ] Verify other users also see censored version

### Issue 2 Testing
- [ ] Send message with profanity to receive a strike
- [ ] Verify strike counter increases
- [ ] Refresh the page
- [ ] Verify strike counter persists after reload
- [ ] Accumulate 5 strikes to trigger a mute
- [ ] Verify mute timer persists across reload
- [ ] Wait for mute to expire and verify can send messages again

### Cookie Inspection (Developer Tools)
```
Application → Cookies → Check for:
- gc_sid (UUID, 1 year expiry)
- gc_strikes (integer, 1 year expiry)
- gc_muteUntil (timestamp, expires when mute ends)
```

---

## Files Modified

1. `/workspace/index.html`
   - Removed optimistic echo for text messages in `sendMessage()` function

2. `/workspace/apps/pi-global/server.js`
   - Added cookie values to `profanity_strike` message
   - Added cookie values to `profanity_muted` message

---

## Deployment Notes

- No database changes required
- No new dependencies added
- No breaking changes to WebSocket message protocol (added optional fields only)
- Existing clients will continue to work (cookies field is optional)
- No Cloudflare tunnel changes included (as requested)

---

## Technical Details

### Message Flow for Profanity Strike

1. User sends message with banned word
2. Server detects profanity via `filterProfanity()`
3. Server applies strike via `applyProfanityStrike()`
4. Server sends `profanity_strike` message to sender with cookie values
5. Client receives message and calls `handleProfanityStrike()`
6. Client calls `setProfanityState()` which updates cookies
7. Server broadcasts censored message to all clients
8. Sender sees censored message (no optimistic echo)

### Message Flow for Page Reload

1. User refreshes page
2. Browser sends cookies with WebSocket upgrade request
3. Server parses cookies via `parseCookies()`
4. Server loads profanity state from cookies
5. Server validates cookie values (bounds checking)
6. Server sends `welcome` message with current profanity state
7. Client receives profanity state and updates UI accordingly
8. If muted, input is disabled with countdown timer

---

## Future Enhancements (Not Implemented)

These were considered but not implemented per the "simplest safe approach" requirement:

- Client-side pre-sanitization (would require duplicating banned-words list to client)
- Database persistence for profanity state (cookie-based solution is sufficient)
- User accounts/authentication (keeping it anonymous as designed)
- Strike decay over time (not requested)
- Admin panel for managing strikes (not requested)
