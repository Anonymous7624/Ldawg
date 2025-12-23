# Admin Mute Persistence Fix

## Problem
Muted users could reload the page and bypass their mute, allowing them to send messages again.

## Root Cause
Admin mutes were stored persistently by `gcSid` (cookie-based identity) on the server, but when a muted user reconnected, the server only checked the mute status on message send - not on connection. This meant the UI wasn't locked until they tried to send a message.

## Solution
Added a check on WebSocket connection (after sending welcome message) that:
1. Checks if the user's `gcSid` is in the `adminBans` map
2. If they are currently muted (bannedUntil > now()), sends:
   - `admin_mute` event to lock the UI immediately
   - `system` message to inform the user how long they're muted for
3. If the ban has expired, removes it from the map

## Changes Made
- **File**: `apps/pi-global/server.js`
- **Location**: Lines 761-789 (after welcome message is sent)
- **Type**: Server-side enforcement

## Testing

### Acceptance Test 1: Mute persists across reload
1. Admin mutes a normal user for 30 seconds
2. User sees mute message and input is disabled
3. User reloads the page
4. **Expected**: User is STILL muted, input is disabled, mute timer shows remaining time
5. Wait for timer to expire
6. **Expected**: User can send messages again

### Acceptance Test 2: Server blocks muted user's messages
1. Admin mutes a user for 30 seconds
2. User reloads the page
3. User tries to send a message via WebSocket (e.g., using DevTools console)
4. **Expected**: Server blocks the message and sends another mute event

### Acceptance Test 3: Non-muted users unaffected
1. Admin mutes User A
2. User B (not muted) reloads their page
3. **Expected**: User B can still send messages normally

### Acceptance Test 4: Expired mutes are cleaned up
1. Admin mutes a user for 5 seconds
2. Wait 6 seconds (until mute expires)
3. User reloads the page
4. **Expected**: User is NOT muted, input is enabled
5. **Expected**: Server logs show ban was cleaned up on reconnect

## Technical Details

### Identity System
- **gcSid**: Cookie-based stable identity (31536000s = 1 year expiration)
- **clientId**: Session-based identity (for message ownership across page refreshes)
- **token**: Session token (for rate limiting)

### Mute Storage
- **adminBans Map**: In-memory Map keyed by `gcSid`
- **Persistence**: Saved to `state.json` file, reloaded on server restart
- **Expiration**: Checked on both connection and message send

### Enforcement Points
1. **On connection** (NEW): Send mute event if user is currently muted
2. **On message send** (EXISTING): Block message and send mute event if user is currently muted

## No Changes to UI
The fix is entirely server-side. The frontend already handles `admin_mute` events correctly:
- Disables input
- Shows status message
- Sets timer to re-enable input when mute expires
