# Testing Role-Aware Presence & UI Improvements

## Quick Start

### 1. Start the Pi-Global Server
```bash
cd /workspace/apps/pi-global
node server.js
```

### 2. Open the Frontend
Open `/workspace/index.html` in a browser (or navigate to your deployed URL).

---

## Test Scenarios

### Scenario A: Sidebar Collapse
**Steps:**
1. Open the application
2. Click the collapse button (◀) in the top-right of the left sidebar
3. **Expected:** 
   - Sidebar shrinks to 60px width
   - All content (Chats, online sections, auth section) disappears
   - Only collapse button visible, centered
4. Click expand button (▶)
5. **Expected:** Sidebar expands back to normal with all content visible

**Pass Criteria:** No text overflow, no button smushing, clean collapse/expand

---

### Scenario B: Online Moderators Display
**Prerequisites:** Have a moderator account in Private API

**Steps:**
1. Open app in Browser A (not logged in)
2. **Expected:** No "Moderators Online" or "Admin Online" sections
3. Open app in Browser B
4. Sign in as moderator in Browser B
5. **Expected in Browser A:** 
   - "Moderators Online:" section appears in left sidebar
   - Shows moderator username with green dot
6. Sign out in Browser B
7. **Expected in Browser A:** "Moderators Online" section disappears

**Pass Criteria:** Sections appear/disappear dynamically based on role presence

---

### Scenario C: Admin Online Display
**Prerequisites:** Have an admin account in Private API

**Steps:**
1. Open app in Browser A (not logged in)
2. Open app in Browser B
3. Sign in as admin in Browser B
4. **Expected in Browser A:**
   - "Admin Online:" section appears in left sidebar
   - Shows admin username with green dot
5. Sign out in Browser B
6. **Expected in Browser A:** "Admin Online" section disappears

**Pass Criteria:** Admin presence updates in real-time across clients

---

### Scenario D: Admin Panel Always Visible
**Steps:**
1. Open the application (not logged in)
2. **Expected:** 
   - Right sidebar shows "Admin Panel" title
   - Shows "Admin controls require admin login"
   - Shows "Sign in" button
3. Click "Sign in" and log in as regular user (client role)
4. **Expected:** Same as step 2 (admin panel not accessible)
5. Log out and log in as admin
6. **Expected:**
   - Right sidebar still shows "Admin Panel" title
   - Shows all admin controls:
     - Chat Controls (Lock Chat toggle, Delete All button)
     - Message Display Mode dropdown
     - Reports section

**Pass Criteria:** Admin panel always visible, content changes based on role

---

### Scenario E: Role Updates on Login/Logout
**Prerequisites:** Have an admin account

**Steps:**
1. Open browser console (F12)
2. Open the application (not logged in)
3. Check WebSocket connection in Network tab
4. **Expected:** WebSocket URL has no `token` parameter (or empty)
5. In another browser tab, verify you appear as "Guest" in online users
6. Sign in as admin
7. **Expected:**
   - Console shows WebSocket reconnecting
   - New WebSocket URL includes `token=<jwt_token>` parameter
8. Check online users in another browser
9. **Expected:** You now appear under "Admin Online:"
10. Sign out
11. **Expected:**
    - WebSocket reconnects again
    - You're removed from "Admin Online" section

**Pass Criteria:** Role updates immediately without page refresh

---

### Scenario F: Multiple Roles Online Simultaneously
**Prerequisites:** Have 2+ accounts with different roles

**Steps:**
1. Open app in Browser A (not logged in)
2. Open app in Browser B, sign in as moderator
3. Open app in Browser C, sign in as admin
4. **Expected in Browser A:**
   - "Moderators Online:" section shows moderator username
   - "Admin Online:" section shows admin username
   - Both sections visible simultaneously
5. Sign out in Browser B
6. **Expected in Browser A:**
   - "Moderators Online:" section disappears
   - "Admin Online:" section still visible

**Pass Criteria:** Multiple role sections can coexist, update independently

---

### Scenario G: Admin Panel Functionality (No Regressions)
**Prerequisites:** Logged in as admin

**Steps:**
1. In Admin Panel, toggle "Lock Chat"
2. Open another browser (not logged in)
3. Try to send a message
4. **Expected:** Message blocked, "Chat is currently locked by admin" shown
5. Toggle lock off
6. **Expected:** Messages can be sent again
7. Test other admin features:
   - Delete message (click message actions → delete)
   - Ban user (click message actions → ban)
   - Change message display mode
   - View/dismiss reports

**Pass Criteria:** All admin features work as before (no regressions)

---

### Scenario H: No Breaking Changes to Core Features
**Steps:**
1. Send text messages → **Expected:** Work normally
2. Upload image → **Expected:** Preview shows, sends successfully
3. Send message with profanity → **Expected:** Filtered/blocked as before
4. Send 5 messages rapidly → **Expected:** Rate limit strike applied
5. Use rich text formatting → **Expected:** Bold, italic, colors work
6. Toggle dark mode → **Expected:** UI switches to dark theme
7. Delete your own message → **Expected:** Message disappears
8. Show typing indicator → **Expected:** "... is typing" appears

**Pass Criteria:** All existing features work without issues

---

## Common Issues & Solutions

### Issue: "Moderators Online" not showing
**Solution:** Ensure the moderator is actually signed in with a valid JWT token. Check browser console for token verification errors.

### Issue: Admin panel shows "require admin login" even when logged in as admin
**Solution:** 
1. Check if `currentAdminUser` is set correctly in console: `console.log(currentAdminUser)`
2. Verify JWT token is valid: Check localStorage for `private_token`
3. Try logging out and back in

### Issue: Sidebar collapse doesn't hide content
**Solution:** Hard refresh (Ctrl+Shift+R) to clear CSS cache

### Issue: WebSocket doesn't reconnect on login
**Solution:** Check browser console for errors. Ensure Private API is accessible.

---

## Debug Commands

### Check Current User State
```javascript
// In browser console
console.log('Current Admin User:', currentAdminUser);
console.log('Private Token:', localStorage.getItem('private_token'));
console.log('WebSocket State:', ws ? ws.readyState : 'not connected');
```

### Check Online Users Payload
```javascript
// In browser console, intercept next online message
const oldOnMessage = ws.onmessage;
ws.onmessage = (event) => {
  const data = JSON.parse(event.data);
  if (data.type === 'online') {
    console.log('Online payload:', data);
  }
  oldOnMessage(event);
};
```

### Manually Trigger Role Update
```javascript
// In browser console
ws.close();
setTimeout(() => connect(), 500);
```

---

## Expected Console Output

### On Connection (Guest)
```
[CONNECT] Attempting WebSocket connection
[CONNECT] URL: ws://localhost:8080?clientId=abc123
[CONNECT] myClientId: abc123
[CONNECT] ✓ WebSocket connection OPEN
```

### On Connection (Admin)
```
[CONNECT] Attempting WebSocket connection
[CONNECT] Including auth token for role verification
[CONNECT] URL: ws://localhost:8080?clientId=abc123&token=***
[CONNECT] myClientId: abc123
[CONNECT] ✓ WebSocket connection OPEN
```

### On Receiving Online Count
```
[WS] Received: {"type":"online","count":3,"users":[{"name":"Ldawg","role":"admin"},{"name":"Guest","role":"guest"}]}
```

---

## Performance Benchmarks

### Expected Performance
- WebSocket connection time: < 100ms
- Role update on login: < 1s (including reconnect)
- Online count broadcast: < 50ms
- Message send/receive: No change from baseline

### Load Testing
To test with multiple users:
1. Open 10+ browser tabs
2. Sign in half as guests, half with auth
3. Monitor memory usage and network latency
4. **Expected:** No significant performance degradation

---

## Rollback Plan

If critical issues are found:

1. **Revert Backend:**
```bash
cd /workspace/apps/pi-global
git checkout HEAD~1 server.js
node server.js
```

2. **Revert Frontend:**
```bash
cd /workspace
git checkout HEAD~1 index.html
```

3. **Or apply hotfix:**
- Comment out role display sections in index.html (lines 1919-1931)
- Backend will still work, just won't show roles in UI
