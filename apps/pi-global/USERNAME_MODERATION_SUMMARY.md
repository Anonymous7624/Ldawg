# Username/Display-Name Moderation Implementation

## Summary
Added username/display-name moderation using the SAME banned-words list already used for message filtering. Users with prohibited names cannot participate and receive strikes.

## Changes Made

### 1. New Function: `checkDisplayName(name)`
**Location:** `server.js` (after `filterProfanity` function)

**Purpose:** Checks if a display name contains any banned words

**Returns:**
```javascript
{
  allowed: boolean,  // true if name is clean, false if contains banned words
  found: string[]    // array of banned words found in the name
}
```

**Logic:**
- Uses the same banned-words list (`bannedWords` Set)
- Case-insensitive matching with word boundaries
- Same regex logic as `filterProfanity()` for consistency

### 2. Name Validation in Message Handler
**Location:** `server.js` (in WebSocket message handler, after rate limiting)

**Enforcement Points:**
- Validates nickname on ALL message types: `text`, `image`, `audio`, `video`, `file`
- Runs BEFORE message processing (after rate limiting, before message-specific handling)

**Behavior When Name Violates:**
1. **Blocks the name** - Message is NOT processed or broadcast
2. **Issues a strike** - Uses `applyProfanityStrike(profState)` 
3. **Sends error message** - Type: `name_violation` with:
   - Error message: "Name not allowed. No profanity/slurs/hate. You received a strike. Choose a different name."
   - Strike count
   - Mute status and duration (if muted)
   - List of banned words found
   - Cookie values for persistence (`gc_strikes`, `gc_muteUntil`)
4. **Returns early** - User's message is completely blocked

## Strike System Integration

### Same Strike System as Messages
- Uses the **profanity state** system (`getProfanityState(gcSid)`)
- Strikes persist across reloads via `gc_sid` cookie
- Same escalating mute durations:
  - Strikes 1-2: Warning only
  - Strike 3: 15 seconds mute
  - Strikes 4-5: 15 seconds mute
  - Strike 6: 60 seconds mute
  - Strike 7+: Doubles each time (2min, 4min, 8min, etc.)

### Persistence
- Strikes stored in `profanityState` Map (keyed by `gcSid`)
- Cookie values sent to client for persistence across reloads
- Server uses MAXIMUM of cookie value and in-memory value (prevents resets)

## User Experience

### When User Tries a Prohibited Name:
1. User sends a message with nickname containing banned word(s)
2. Server detects violation immediately
3. User receives `name_violation` message
4. User's message is NOT broadcast to others
5. User must change their name to participate
6. If muted due to strikes, they cannot send messages until unmuted

### Client-Side Handling (Expected)
The client should:
1. Listen for `name_violation` message type
2. Display error to user: "Name not allowed. No profanity/slurs/hate. You received a strike. Choose a different name."
3. Show strike count and mute duration (if applicable)
4. Prompt user to choose a different name
5. Store cookie values (`gc_strikes`, `gc_muteUntil`) for persistence

## Testing

### Manual Testing Steps:
1. Set nickname to contain a banned word (e.g., "TestDamn123")
2. Try to send a message
3. Verify:
   - Message is NOT broadcast
   - `name_violation` message received
   - Strike count incremented
   - Console logs show `[NAME-VIOLATION]` entries
4. Change nickname to clean name (e.g., "TestUser123")
5. Send message - should work normally

### Test Cases:
- ✅ Name with explicit banned word: "BadWordUser" → BLOCKED
- ✅ Name with banned word variation: "D@mnUser" → May pass (depends on word boundaries)
- ✅ Clean name: "GoodUser123" → ALLOWED
- ✅ Multiple violations: Strike count increases each time
- ✅ Persistence: Strikes persist across page reload
- ✅ Muting: After 3 strikes, user is muted

## Logging

New log prefix: `[NAME-VIOLATION]`

Example logs:
```
[NAME-VIOLATION] Blocked name "BadUser" from abc123 (gcSid: 12345678...)
[NAME-VIOLATION] Found banned terms: bad, word
[NAME-VIOLATION] Strike 3 issued
[PROFANITY] Strike 3 issued, muted for 15s
```

## No Other Changes
- Message filtering still works the same
- Rate limiting unchanged
- Upload system unchanged
- All other functionality preserved

## Files Modified
- `apps/pi-global/server.js` - Added `checkDisplayName()` function and validation logic

## Client-Side Integration Needed
The client-side code should handle the new `name_violation` message type:
```javascript
if (message.type === 'name_violation') {
  // Display error to user
  alert(message.message); // or use a better UI notification
  
  // Store cookies for persistence
  if (message.cookies) {
    setCookie('gc_strikes', message.cookies.gc_strikes);
    setCookie('gc_muteUntil', message.cookies.gc_muteUntil);
  }
  
  // Prompt for new name
  promptForNewNickname();
}
```
