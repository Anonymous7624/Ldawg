# Admin & Moderation Fixes - Quick Reference

## What Was Fixed

### ✅ Issue 1: Rules Bar Role-Based Visibility
**Before:** Admin panel always visible, no rules shown  
**After:** 
- Guests & normal clients → See rules/benefits
- Admin & moderators → See admin panel

### ✅ Issue 2: Ban/Mute Targeting Wrong User
**Before:** Ban might target wrong user (using wrong ID)  
**After:**
- Uses stable cookie ID (`senderClientId`)
- Always targets correct user
- Prevents admin self-mute
- Server logs: `[ADMIN_MUTE] applied to clientId=...`

### ✅ Issue 3: Admin Delete Confirmation
**Before:** Confirmation dialog required  
**After:** One-click delete (instant removal)

### ✅ Issue 4: Admin Styles Not Syncing
**Before:** Styles only visible to admin, lost on reload  
**After:**
- Stored in database with message
- Visible to ALL users
- Persists after reload
- Server logs: `[ADMIN-STYLE] broadcast message styleKey=...`

---

## How to Test

### Test 1: Rules Bar Visibility
1. Open site (not logged in) → Should see "Chat Rules" and "Why Sign Up?"
2. Sign in as normal client → Should still see rules
3. Sign in as admin → Should see "Admin Panel" instead
4. Sign in as moderator → Should see "Admin Panel" instead

### Test 2: Ban Targeting
1. As admin, open 3-dot menu on any user's message
2. Click "Ban" → Select duration
3. Verify THAT user gets muted (not someone else)
4. Check server console for: `[ADMIN_MUTE] applied to clientId=...`
5. Muted user should see countdown banner
6. Reload page → mute still active

### Test 3: Delete
1. As admin, click 3-dot menu → "Delete"
2. Should delete immediately (no dialog)
3. Message removed from everyone's screen
4. Reload page → message stays deleted

### Test 4: Admin Styles
1. As admin, select "ADMIN" from sender mode dropdown
2. Send a message → Should appear gold & 1.5x size
3. Open in another browser (non-admin) → Should see same styling
4. Reload both → styling preserved
5. Check server console for: `[ADMIN-STYLE] broadcast message styleKey=...`

---

## Admin Sender Modes

| Mode | Display Name | Color | Size | Background |
|------|--------------|-------|------|------------|
| Ldawg | "Ldawg" | Gold | 1.0x | Normal |
| ADMIN | "ADMIN" | Gold | 1.5x | Gold tinted |
| SERVER | "SERVER" | Red | 1.5x | Red tinted |
| Other | Custom | Normal | 1.0x | Normal |

---

## Server Log Examples

### Successful Ban
```
[ADMIN_MUTE] applied to clientId=a1b2c3d4... until=2025-12-23T15:30:00.000Z by=ldawg
```

### Admin Style Message
```
[ADMIN-STYLE] Admin ldawg using style: displayName="ADMIN" color=gold scale=1.5
[ADMIN-STYLE] broadcast message id=abc123... styleKey=gold_1.5x displayName="ADMIN"
```

### Ban Attempt on Self (Prevented)
```
[ADMIN-BAN] ❌ Admin ldawg tried to mute themselves
```

---

## Database Schema Changes

### messages table - NEW columns
- `senderClientId` TEXT - Cookie-based stable ID for ban targeting
- `adminStyleMeta` TEXT - JSON string storing style metadata

Example `adminStyleMeta`:
```json
{
  "displayName": "ADMIN",
  "color": "gold",
  "scale": 1.5,
  "fontWeight": "bold"
}
```

---

## Security Notes

✅ **Non-admin cannot spoof styles** - Server strips `adminStyleMeta` from non-admin messages  
✅ **Admin cannot mute self** - Server checks and rejects  
✅ **Cookie-based IDs** - Can't evade ban by refreshing  
✅ **Server-side enforcement** - All checks happen on server  

---

## Rollback if Needed

```bash
# Rollback to previous commit
git log --oneline -5  # Find previous commit hash
git checkout <commit-hash> index.html apps/pi-global/server.js apps/pi-global/db.js
```

Database changes are additive (won't break old data).
