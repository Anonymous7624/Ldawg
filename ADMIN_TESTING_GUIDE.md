# Admin Features Testing Guide

## Quick Test Steps

### 1. DELETE ALL CHATS AND UPLOADS ✅
```
1. Log in as admin
2. Admin Panel → "Delete All Chats & Uploads"
3. Confirm (2x)
✓ All messages gone
✓ All uploads deleted
✓ Success toast appears
```

### 2. STOP ALL MESSAGES ✅
```
1. Admin Panel → Toggle "Lock Chat" ON
2. Open incognito window (non-admin)
3. Try to send message
✓ Blocked with "Chat is paused by admin"
4. As admin, send message
✓ Admin can still send
5. Toggle OFF
✓ Non-admin can send again
```

### 3. BAN/MUTE USER ✅
```
1. Right-click any message → "Ban User"
2. Select duration (e.g., 30s)
✓ Message deleted
✓ User sees "Muted by admin for 30 seconds"
3. Muted user tries to send
✓ Blocked with remaining time
4. Muted user refreshes page
✓ Still muted (persists)
5. Wait for expiration
✓ "Mute expired" toast appears
```

### 4. CHANGE PASSWORD ✅
```
1. Settings (gear icon) → "Change Password"
2. Enter current + new password
✓ Success message (no 500 error)
3. Try wrong current password
✓ Error: "Current password is incorrect"
4. Try password < 6 chars
✓ Error: "New password must be at least 6 characters"
```

---

## Expected Server Events

### Wipe Data
```json
// Success
{
  "type": "admin_wipe_success",
  "ok": true,
  "messagesDeleted": 123,
  "filesDeleted": 45
}

// Error
{
  "type": "admin_wipe_error",
  "ok": false,
  "error": "Unauthorized: Admin access required"
}
```

### Chat Lock
```json
// Blocked attempt
{
  "type": "send_blocked",
  "reason": "CHAT_LOCKED",
  "message": "Chat is paused by admin"
}

// State change
{
  "type": "chat_lock_changed",
  "locked": true,
  "lockedBy": "admin_username"
}
```

### Ban/Mute
```json
// Mute notification
{
  "type": "admin_mute",
  "until": 1735000000000,
  "seconds": 30,
  "remainingMs": 30000,
  "reason": "Muted by admin for 30 seconds"
}

// Ban success
{
  "type": "admin_ban_success",
  "ok": true,
  "gcSid": "abc12345",
  "duration": 30
}
```

### Password Change
```json
// Success
{
  "ok": true,
  "success": true,
  "message": "Password changed successfully"
}

// Error
{
  "error": "Current password is incorrect"
}
```

---

## Console Logs to Check

### Wipe Data
```
[ADMIN-WIPE] Admin username is wiping all chat data
[DB] Wiped all messages: 123 messages deleted
[ADMIN-WIPE] ✓ Deleted 45 uploaded files
[ADMIN-WIPE] ✓ Wiped all chat data: 123 messages, 45 files
```

### Chat Lock
```
[CHAT-LOCKED] Message blocked: chat is locked by admin
[CHAT-LOCKED] Admin username sending message (chat is locked for others)
```

### Ban/Mute
```
[ADMIN-BAN] Admin username banned gcSid abc12345... for 30s
[ADMIN-BAN] ✓ Deleted message msg_id_123
[ADMIN-BAN] ✓ Sent mute notification to user
[ADMIN-BAN] Message blocked: user is admin-muted for 25s more
[ADMIN-BAN] Ban expired for gcSid abc12345...
```

### Password Change
```
[ACCOUNT] Password changed for: user@example.com (username)
```

---

## Files Modified

### Backend
- `apps/pi-global/server.js` - Admin handlers, chat lock, ban system
- `apps/pi-global/db.js` - Added wipeAllMessages() function
- `apps/private-api/server.js` - Fixed change password endpoint

### Frontend
- `index.html` - Event handlers for admin features

### State Persistence
- `apps/pi-global/state.json` - Stores chatLocked, adminBans, reports

---

## Troubleshooting

### Delete All doesn't work
- Check admin role in browser console
- Check server logs for `[ADMIN-WIPE]` entries
- Verify UPLOAD_DIR path in server config

### Stop All doesn't block users
- Check `state.json` has `"chatLocked": true`
- Verify non-admin users don't have admin role
- Check for `[CHAT-LOCKED]` in server logs

### Ban doesn't persist
- Check `state.json` has `adminBans` object
- Verify gcSid cookie is set in browser
- Check ban hasn't expired (timestamp > now)

### Password returns 500
- Check MongoDB connection
- Verify user exists in database
- Check server logs for error details

---

## Security Notes

All features require admin role:
- Server checks: `info.adminUser && info.adminUser.role === 'admin'`
- Unauthorized attempts logged and rejected
- Error messages returned without exposing system details

Ban persistence:
- Stored in state.json on server
- Cookie-based client identification (gcSid)
- Survives server restarts and page reloads
- Expired bans auto-removed on save

Password security:
- Argon2 hashing (no plaintext storage)
- Current password required for change
- Minimum 6 character requirement
- 401/400 errors for invalid input (not 500)
