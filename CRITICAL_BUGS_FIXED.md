# Critical Bugs Fixed - Summary

## Overview
Fixed 4 critical bugs in the admin features without touching any other functionality (chat core, uploads, profanity, strikes, coloring, UI layout).

---

## Bug #1: DELETE ALL CHATS AND UPLOADS ✅

### What Was Fixed:
- **Added `wipeAllMessages()` function** in `apps/pi-global/db.js` to efficiently delete all messages from SQLite database
- **Updated admin_wipe_data handler** in `apps/pi-global/server.js` to:
  - Properly wipe ALL messages from database
  - Delete ALL uploaded files from the uploads directory
  - Return success JSON: `{type: 'admin_wipe_success', ok: true, messagesDeleted: N, filesDeleted: M}`
  - Return error JSON with clear message if unauthorized or error occurs
  - Broadcast `chat_wiped` event to all clients

### Testing:
1. Log in as admin
2. Open admin panel
3. Click "Delete All Chats & Uploads"
4. Confirm twice
5. **Expected Result**: All messages disappear from chat, all upload files deleted, success toast shown

### Files Changed:
- `apps/pi-global/db.js` - Added `wipeAllMessages()` function
- `apps/pi-global/server.js` - Updated admin_wipe_data handler

---

## Bug #2: STOP ALL MESSAGES Toggle ✅

### What Was Fixed:
- **Updated chat lock enforcement** in `apps/pi-global/server.js`:
  - Server-side validation blocks ALL non-admin users when chat is locked
  - Admin users can still send messages when chat is locked
  - Sends proper error event: `{type: 'send_blocked', reason: 'CHAT_LOCKED', message: 'Chat is paused by admin'}`
  - State persists in `state.json` (already implemented, now verified)

- **Updated client handler** in `index.html`:
  - Handles `send_blocked` event with reason `CHAT_LOCKED`
  - Shows clear message: "Chat is paused by admin"

### Testing:
1. Log in as admin
2. Open admin panel
3. Toggle "Lock Chat (admins only)" ON
4. **Expected (as admin)**: You can still send messages
5. Open chat in another browser (non-admin)
6. Try to send a message
7. **Expected (as non-admin)**: Message blocked, error shown "Chat is paused by admin"
8. Toggle lock OFF as admin
9. **Expected**: Non-admin can now send messages

### Files Changed:
- `apps/pi-global/server.js` - Updated chat lock check to send `send_blocked` event
- `index.html` - Added handler for `send_blocked` event

---

## Bug #3: BAN/MUTE Feature ✅

### What Was Fixed:
- **Persistent ban storage** in `apps/pi-global/server.js`:
  - Admin bans now saved to `state.json` and persist across server restarts
  - Uses `gcSid` (cookie-based stable identifier) for tracking bans
  - Bans loaded from state file on server startup
  - Expired bans automatically removed

- **Proper mute notifications**:
  - Changed event name from `admin_banned` to `admin_mute`
  - Sends: `{type: 'admin_mute', until: timestamp, seconds: N, reason: 'Muted by admin for N seconds'}`
  - Shows remaining mute time when user tries to send while muted
  - Server-side enforcement blocks all sending attempts

- **Client-side handling** in `index.html`:
  - Handles `admin_mute` event properly
  - Shows clear message: "Muted by admin for N seconds"
  - Disables inputs during mute period
  - Re-enables after mute expires with success toast
  - Persists across page reloads (via cookie and server state)

### Testing:
1. Log in as admin
2. Right-click any message in chat
3. Click "Ban User" 
4. Select ban duration (e.g., "30 seconds")
5. **Expected**: 
   - Message deleted
   - Target user instantly sees "Muted by admin for 30 seconds"
   - Target user's input disabled
6. As muted user, try to send a message
7. **Expected**: Blocked with remaining time shown
8. Refresh page as muted user
9. **Expected**: Still muted (persists via cookie + server state)
10. Wait for mute to expire
11. **Expected**: Toast shown "Mute expired - you can chat again"

### Files Changed:
- `apps/pi-global/server.js` - Updated ban system with persistence, proper events, and enforcement
- `index.html` - Updated client to handle `admin_mute` event properly

---

## Bug #4: CHANGE PASSWORD Returns 500 ✅

### What Was Fixed:
- **Fixed password hash access** in `apps/private-api/server.js`:
  - The `authenticateToken` middleware excludes `passHash` from `req.user`
  - Changed password endpoint now fetches user WITH `passHash` separately
  - Properly verifies current password with argon2
  - Hashes new password with argon2
  - Returns: `{ok: true, success: true, message: 'Password changed successfully'}`
  - Returns proper error messages (400/401) instead of 500

- **Fixed console log error**:
  - Changed `corsOrigins` to `Array.from(allowedOrigins)` in startup log

### Testing:
1. Log in as admin user
2. Click settings icon (gear) in left sidebar
3. Fill in:
   - Current password: (your current password)
   - New password: (minimum 6 characters)
4. Click "Update Password"
5. **Expected**: Success message shown, no 500 error
6. Try with wrong current password
7. **Expected**: Error message "Current password is incorrect" (401)
8. Try with new password < 6 chars
9. **Expected**: Error message "New password must be at least 6 characters" (400)

### Files Changed:
- `apps/private-api/server.js` - Fixed password change endpoint and console log

---

## Admin Self-Test Checklist

Run through these tests to verify all fixes work:

### 1. DELETE ALL CHATS AND UPLOADS
- [ ] Button visible in admin panel
- [ ] Confirmation dialogs appear (2x)
- [ ] All messages deleted from database
- [ ] All files deleted from uploads directory
- [ ] Success toast appears
- [ ] Non-admin users cannot trigger this

### 2. STOP ALL MESSAGES
- [ ] Toggle switch in admin panel
- [ ] When ON: non-admin users blocked from sending
- [ ] When ON: admin users CAN still send
- [ ] Error message clear: "Chat is paused by admin"
- [ ] Toggle state persists across refreshes
- [ ] When OFF: everyone can send again

### 3. BAN/MUTE
- [ ] Right-click menu shows "Ban User" for admins
- [ ] Ban duration modal appears
- [ ] Message deleted when user banned
- [ ] Target user receives instant notification
- [ ] Target user cannot send while muted
- [ ] Remaining time shown when blocked
- [ ] Mute persists across page reloads
- [ ] Mute expires automatically
- [ ] Success toast when unmuted

### 4. CHANGE PASSWORD
- [ ] Settings modal opens from sidebar
- [ ] Current password validated
- [ ] New password validated (min 6 chars)
- [ ] Success message on valid change
- [ ] No 500 errors
- [ ] Proper error messages for invalid input

---

## Technical Notes

### Server-Side Validation
All 4 features enforce validation server-side:
- Admin role check: `if (!info.adminUser || info.adminUser.role !== 'admin')`
- Proper error responses returned

### Persistence
- Admin bans: Stored in `state.json` with expiration timestamps
- Chat lock: Stored in `state.json`
- Reports: Already persisted in `state.json`

### Event Names
- Wipe: `admin_wipe_success` / `admin_wipe_error`
- Lock: `send_blocked` (reason: CHAT_LOCKED) / `chat_lock_changed`
- Ban: `admin_mute` / `admin_ban_success` / `admin_ban_error`
- Password: Returns JSON with `ok` and `success` fields

### Cookie-Based Bans
Uses `gcSid` cookie (already implemented) as stable client identifier:
- Set on first connection
- Persists across sessions
- Used for both profanity strikes and admin bans

---

## No Regression Guarantee

These fixes ONLY touched:
- Admin panel backend handlers
- Admin panel frontend handlers
- Database wipe function
- Password change endpoint

Did NOT touch:
- Chat core functionality
- Upload system (except wipe function)
- Profanity filter
- Strike system
- Message coloring
- UI layout (except admin panel event handling)
