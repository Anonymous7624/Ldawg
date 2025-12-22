# Profanity Filter Implementation Summary

## Overview
Added a strict profanity/slur filter to the global chat with server-side filtering, strike system, and escalating mutes.

## What Was Changed

### 1. New Files Created

- **`banned-words.txt`**: Contains the list of banned words (one per line)
  - Loads at server startup
  - Case-insensitive matching
  - Supports comments (lines starting with #)
  - Starter list included (can be expanded)

- **`PROFANITY_FILTER_TESTING.md`**: Comprehensive testing guide
  - 12 test scenarios covering all functionality
  - Edge cases and troubleshooting tips

### 2. Server Changes (`server.js`)

#### Dependencies
- Added `cookie-parser` for cookie handling

#### New Configuration
```javascript
const BANNED_WORDS_FILE = path.join(__dirname, 'banned-words.txt');
const bannedWords = new Set();
const MAX_MUTE_DURATION = 2 * 24 * 60 * 60 * 1000; // 2 days
```

#### New Functions
- `loadBannedWords()`: Loads banned words from file at startup
- `filterProfanity(text)`: Replaces banned words with dashes
- `parseCookies(cookieHeader)`: Parses cookies from WebSocket upgrade request
- `getProfanityState(gcSid)`: Gets or creates profanity state for user
- `isProfanityMuted(state)`: Checks if user is currently muted
- `calculateMuteDuration(strikes)`: Calculates mute duration based on strikes
- `applyProfanityStrike(state)`: Issues strike and applies mute if needed

#### Strike & Mute Rules Implemented
- Strikes 1-4: Warning only (no mute)
- Strike 5: 15 seconds mute
- Strikes 6-7: 15 seconds mute each
- Strike 8: 60 seconds (1 minute) mute
- Strike 9+: Doubles each time (120s, 240s, 480s, ...)
- Maximum mute duration: 2 days

#### User Identification
- Uses `gc_sid` cookie for anonymous user identification
- Server generates `gc_sid` if not present
- Persists in cookies (1 year expiry)
- Independent from `chat_token` (used for rate limiting)

#### Message Processing
- **Before broadcasting**, text messages are:
  1. Checked for active mute (reject if muted)
  2. Filtered for profanity (replace banned words with dashes)
  3. Strike issued if profanity found
  4. Filtered message saved to database
  5. Filtered message broadcast to all users

#### WebSocket Messages Added
- `profanity_strike`: Sent when strike is issued
  ```json
  {
    "type": "profanity_strike",
    "strikes": 5,
    "muted": true,
    "muteUntil": 1234567890,
    "seconds": 15,
    "foundWords": ["damn"],
    "message": "Strike 5: Muted for 15s"
  }
  ```

- `profanity_muted`: Sent when muted user tries to send message
  ```json
  {
    "type": "profanity_muted",
    "strikes": 5,
    "muteUntil": 1234567890,
    "seconds": 14,
    "message": "You are muted for 14s (Strike 5)"
  }
  ```

- `welcome`: Extended with profanity state
  ```json
  {
    "type": "welcome",
    "clientId": "...",
    "token": "...",
    "gcSid": "...",
    "profanityStrikes": 0,
    "profanityMuted": false
  }
  ```

### 3. Client Changes (`index.html`)

#### Cookie Management
- `gc_sid`: User ID cookie (set from server)
- `gc_strikes`: Persisted strike count
- `gc_muteUntil`: Persisted mute expiration timestamp

#### New Functions
- `getProfanityState()`: Loads strikes and mute state from cookies
- `setProfanityState(strikes, muteUntil)`: Saves state to cookies
- `isProfanityMuted()`: Checks if currently muted
- `handleProfanityStrike(data)`: Handles strike notification from server
- `handleProfanityMuted(data)`: Handles mute rejection from server
- `showProfanityMuteMessage(untilEpochMs, strikes)`: Shows mute countdown

#### UI Updates
- **Rules sidebar** updated with:
  - "No profanity, slurs, or hate speech."
  - "No impersonation."
  - "Violations result in strikes and timed mutes."

- **Send button** disabled while muted
- **Status bar** shows mute countdown with strike count
- **Toast notifications** for strikes and mutes

#### Send Message Flow
1. Check WebSocket connection
2. Check rate limit ban
3. **Check profanity mute (NEW)**
4. Check cooldown
5. Send message

### 4. Dependencies Updated (`package.json`)
```json
"cookie-parser": "^1.4.6"
```

## Key Features

### ✅ Server-Side Filtering (Mandatory)
- All filtering happens in `server.js` before broadcasting
- Banned words replaced with dashes (matching length)
- Case-insensitive matching
- Handles punctuation: `"damn!"` → `"----!"`

### ✅ Strikes & Mutes
- Strike issued per profanity message (not per word)
- Escalating mute durations as specified
- Server is source of truth (in-memory state)
- Cookies provide persistence across reloads

### ✅ Cookie-Based State
- Anonymous users identified by `gc_sid` cookie
- Strikes and mutes persist in cookies
- Server validates cookie values (prevents tampering)
- State synced between server and client

### ✅ Clean Messages Broadcast
- Filtered messages are saved and broadcast
- Original profanity never reaches database or other clients
- Users see sanitized version only

### ✅ Mute Enforcement
- Server rejects messages from muted users
- Client disables send button when muted
- Real-time countdown shows remaining mute time
- Strike count displayed in mute message

### ✅ External Banned Words File
- `banned-words.txt` loaded at server startup
- Easy to modify without code changes
- Supports comments for organization
- One term per line, case-insensitive

## What Was NOT Added

As per requirements:
- ❌ No login system
- ❌ No reporting features
- ❌ No admin tools/dashboard
- ❌ No database storage for strikes (in-memory only)
- ❌ No IP banning
- ❌ No account system

## File Structure

```
apps/pi-global/
├── server.js                          # ✏️ Modified (profanity filter logic)
├── package.json                       # ✏️ Modified (cookie-parser added)
├── banned-words.txt                   # ✨ New (banned words list)
├── PROFANITY_FILTER_TESTING.md       # ✨ New (test guide)
└── PROFANITY_FILTER_SUMMARY.md       # ✨ New (this file)

index.html                             # ✏️ Modified (client-side handling)
```

## Testing Quick Start

### Trigger a Strike
1. Open the chat
2. Type a message with a banned word (e.g., "damn", "hell", "crap", "stupid")
3. Click Send
4. See filtered message: "----" and strike notification

### Confirm 5-Strike Mute
1. Send 5 messages with profanity
2. On 5th message, you'll be muted for 15 seconds
3. Try sending another message - it will be blocked
4. Wait 15 seconds, mute expires automatically

### Confirm 8-Strike Mute
1. Continue sending profanity after first mute expires
2. At 8th strike, you'll be muted for 60 seconds (1 minute)
3. Verify countdown shows 1:00 and counts down

### Verify Persistence
1. Get some strikes (e.g., 3 strikes)
2. Refresh the page
3. Console shows: `[PROFANITY] Initial state: strikes=3`
4. Next profanity gives strike 4 (not strike 1)

## Console Logs for Debugging

**Server:**
```
[STARTUP] ✓ Loaded 4 banned words from banned-words.txt
[CONNECT] Client has gc_sid: abcd1234...
[PROFANITY] Found 1 banned term(s) in message from User: damn
[PROFANITY] Strike 5 issued, muted for 15s
[PROFANITY] Client xyz is muted (14s remaining, 5 strikes)
```

**Client:**
```
[GC_SID] Received gc_sid from server: abcd1234...
[PROFANITY] Initial state: strikes=3, muteUntil=0
[PROFANITY] Current state: strikes=5, muted=true
```

## Production Deployment

1. **Install dependencies:**
   ```bash
   cd apps/pi-global
   npm install
   ```

2. **Customize banned words:**
   - Edit `banned-words.txt`
   - Add real profanity, slurs, and offensive terms
   - One term per line, lowercase

3. **Restart server:**
   ```bash
   npm run pm2:restart
   # or
   npm start
   ```

4. **Verify:**
   - Check logs for: `[PROFANITY] Loaded X banned words`
   - Test in browser with sample words

## Security Considerations

- **Server validates all cookie values** (strikes clamped 0-1000)
- **Server is source of truth** for mute enforcement
- **Client cannot bypass mutes** (server rejects messages)
- **Cookie tampering doesn't help** (server validates on connect)
- **No sensitive data in cookies** (just strikes and timestamps)

## Maintenance

### Adding Banned Words
1. Edit `banned-words.txt`
2. Restart server (automatic reload not implemented)

### Clearing User Strikes
- Delete browser cookies: `gc_sid`, `gc_strikes`, `gc_muteUntil`
- Server state will reset on next connection with new `gc_sid`

### Monitoring
- Watch server logs for `[PROFANITY]` entries
- Track common violators by `gc_sid` in logs
- Consider adding analytics if needed

## Future Enhancements (Not Implemented)

If you want to expand this system:
- Database storage for strikes (cross-device persistence)
- Admin dashboard to view/manage strikes
- IP-based tracking (in addition to cookies)
- Regex patterns for l33t speak (e.g., "d4mn")
- Whitelist for false positives
- Appeal system for unfair mutes
- Permanent bans after X strikes

## Support

For questions or issues, refer to:
- `PROFANITY_FILTER_TESTING.md` for detailed test scenarios
- Server console logs for debugging
- Browser DevTools > Application > Cookies for state inspection
