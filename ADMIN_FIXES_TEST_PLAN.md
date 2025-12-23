# Admin & Moderation Fixes - Testing Plan

## Pre-Test Setup

1. **Environment:** Staging or local development
2. **Browser:** Chrome/Firefox (test in both)
3. **Accounts needed:**
   - Admin account (for admin testing)
   - Moderator account (for mod testing)
   - Regular client account (for client testing)
   - Guest session (not logged in)

---

## Test Suite 1: Rules Bar Visibility (Issue 1)

### Test 1.1: Guest User (Not Logged In)
**Steps:**
1. Open site without logging in
2. Look at right sidebar

**Expected:**
- ✅ See "Chat Rules" section with 5 rules
- ✅ See "Why Sign Up?" section with 4 benefits
- ✅ See "Sign in to unlock" button
- ❌ Should NOT see "Admin Panel"

**Actual:** _________________

---

### Test 1.2: Normal Client (Logged In)
**Steps:**
1. Sign in as regular client
2. Look at right sidebar

**Expected:**
- ✅ See "Chat Rules" section
- ✅ See "Why Sign Up?" section
- ❌ Should NOT see "Admin Panel"

**Actual:** _________________

---

### Test 1.3: Admin User
**Steps:**
1. Sign in as admin
2. Look at right sidebar

**Expected:**
- ✅ See "Admin Panel" section
- ✅ See "Chat Controls", "Message Display Mode", "Reports"
- ❌ Should NOT see "Chat Rules" or "Why Sign Up?"

**Actual:** _________________

---

### Test 1.4: Moderator User
**Steps:**
1. Sign in as moderator
2. Look at right sidebar

**Expected:**
- ✅ See "Admin Panel" section
- ❌ Should NOT see "Chat Rules" or "Why Sign Up?"

**Actual:** _________________

---

### Test 1.5: Sidebar Collapse Behavior
**Steps:**
1. Test as guest → Collapse left sidebar
2. Test as admin → Collapse left sidebar

**Expected:**
- ✅ No layout issues (no smushing)
- ✅ Content remains readable
- ✅ Toggle button works correctly

**Actual:** _________________

---

## Test Suite 2: Ban/Mute Targeting (Issue 2)

### Test 2.1: Basic Ban Functionality
**Setup:** Have User A send a message

**Steps:**
1. As admin, click 3-dot menu on User A's message
2. Click "Ban"
3. Select "30 seconds"
4. Click "Ban User"

**Expected:**
- ✅ User A immediately sees mute banner with countdown
- ✅ User A cannot send messages (server blocks)
- ✅ Server console shows: `[ADMIN_MUTE] applied to clientId=<UserA_gcSid>... until=<timestamp> by=<admin>`
- ❌ User B (different user) is NOT muted
- ❌ Admin is NOT muted

**Actual:** _________________

**Server Log:** _________________

---

### Test 2.2: Mute Persistence Across Reload
**Setup:** User A is muted (from Test 2.1)

**Steps:**
1. User A refreshes page (F5)
2. Try to send message

**Expected:**
- ✅ Mute still active (banner shows remaining time)
- ✅ Server still blocks send attempts
- ✅ Timer continues counting down

**Actual:** _________________

---

### Test 2.3: Ban from Report
**Setup:** User A sends message, User B reports it

**Steps:**
1. As admin, view report in admin panel
2. Click "Ban User" on the report

**Expected:**
- ✅ Ban modal opens with User A's ID
- ✅ Banning applies to User A (not User B)
- ✅ Server log shows correct clientId

**Actual:** _________________

---

### Test 2.4: Admin Cannot Ban Self
**Steps:**
1. As admin, send a message
2. Click 3-dot menu on your own message
3. Click "Ban"
4. Select duration and confirm

**Expected:**
- ✅ Server rejects with error
- ✅ Console shows: `[ADMIN-BAN] ❌ Admin <name> tried to mute themselves`
- ✅ Admin is NOT muted

**Actual:** _________________

**Server Log:** _________________

---

### Test 2.5: Mute Notification
**Setup:** User A is online

**Steps:**
1. As admin, ban User A
2. Watch User A's screen

**Expected:**
- ✅ User A immediately sees mute banner
- ✅ Banner shows: "Muted by admin for X seconds"
- ✅ Countdown updates every second
- ✅ Send button disabled

**Actual:** _________________

---

## Test Suite 3: Admin Delete (Issue 3)

### Test 3.1: One-Click Delete
**Setup:** User A sends a message

**Steps:**
1. As admin, click 3-dot menu on message
2. Click "Delete"

**Expected:**
- ❌ NO confirmation dialog appears
- ✅ Message removed immediately
- ✅ Message removed from ALL clients' screens
- ✅ Server broadcasts delete event

**Actual:** _________________

**Time to delete:** _______ ms (should be instant)

---

### Test 3.2: Delete Persistence
**Setup:** Message was deleted in Test 3.1

**Steps:**
1. Refresh page (F5)
2. Check if deleted message appears

**Expected:**
- ❌ Message does NOT reappear
- ✅ Message is gone from database
- ✅ History doesn't include it

**Actual:** _________________

---

### Test 3.3: Non-Admin Cannot Delete
**Steps:**
1. As regular client, try to open 3-dot menu on another user's message

**Expected:**
- ❌ No delete button visible
- ❌ No 3-dot menu (only for own messages)

**Actual:** _________________

---

## Test Suite 4: Admin Styles Persistence (Issue 4)

### Test 4.1: ADMIN Style Mode
**Steps:**
1. As admin, select "ADMIN (150% GOLD)" from sender mode
2. Send message: "Testing ADMIN style"
3. Open site in another browser (not logged in)

**Expected:**
- ✅ Message displays with:
  - Display name: "ADMIN"
  - Gold color text
  - 1.5x larger font size
  - Gold background tint
- ✅ Style visible on admin's screen
- ✅ Style visible on guest's screen (same styling)
- ✅ Server console shows:
  ```
  [ADMIN-STYLE] Admin <name> using style: displayName="ADMIN" color=gold scale=1.5
  [ADMIN-STYLE] broadcast message id=<msgId> styleKey=gold_1.5x displayName="ADMIN"
  ```

**Actual (Admin screen):** _________________

**Actual (Guest screen):** _________________

**Server Log:** _________________

---

### Test 4.2: SERVER/Announcement Style Mode
**Steps:**
1. As admin, select "SERVER (150% RED)"
2. Send message: "Server announcement"

**Expected:**
- ✅ Display name: "SERVER"
- ✅ Red color text
- ✅ 1.5x larger font size
- ✅ Red background tint
- ✅ Visible to all users

**Actual:** _________________

---

### Test 4.3: Ldawg Style Mode
**Steps:**
1. As admin, select "Ldawg (gold, normal size)"
2. Send message: "Hey everyone"

**Expected:**
- ✅ Display name: "Ldawg"
- ✅ Gold color text
- ✅ Normal size (1.0x)
- ✅ Bold font weight
- ✅ Normal background (no tint)

**Actual:** _________________

---

### Test 4.4: Custom Style Mode
**Steps:**
1. As admin, select "Other (type custom name)"
2. Type "Moderator" in custom name field
3. Send message

**Expected:**
- ✅ Display name: "Moderator"
- ✅ Normal styling
- ✅ Visible to all users

**Actual:** _________________

---

### Test 4.5: Style Persistence After Reload
**Setup:** Send messages in all 4 modes (ADMIN, SERVER, Ldawg, Custom)

**Steps:**
1. Refresh page (F5)
2. Check message history

**Expected:**
- ✅ All styles preserved correctly
- ✅ ADMIN messages still gold & 1.5x
- ✅ SERVER messages still red & 1.5x
- ✅ Ldawg messages still gold & 1.0x
- ✅ Custom messages show custom name

**Actual:** _________________

---

### Test 4.6: Non-Admin Cannot Spoof Styles
**Steps:**
1. As regular client, open browser console
2. Try to send message with fake adminStyleMeta:
   ```javascript
   ws.send(JSON.stringify({
     type: 'text',
     text: 'Fake admin message',
     adminStyleMeta: { displayName: 'ADMIN', color: 'gold', scale: 1.5 }
   }))
   ```

**Expected:**
- ✅ Message sent normally
- ❌ Style metadata STRIPPED by server
- ✅ Message displays as normal client message (no styling)
- ✅ Server console shows: `[SECURITY] Non-admin user tried to send admin style metadata - stripped`

**Actual:** _________________

**Server Log:** _________________

---

### Test 4.7: Image/Audio/Video Styling
**Steps:**
1. As admin, select "ADMIN" mode
2. Send an image with caption "Admin image"

**Expected:**
- ✅ Sender name shows as "ADMIN" (gold, 1.5x)
- ✅ Styling applied to message container
- ✅ Visible to all users
- ✅ Style persists after reload

**Actual:** _________________

---

## Integration Tests

### Integration Test 1: Full Admin Workflow
**Steps:**
1. Log in as admin
2. Verify admin panel visible (not rules)
3. Select "ADMIN" sender mode
4. Send styled message
5. User B sends spam message
6. Delete User B's message (no confirm)
7. Ban User B for 60 seconds
8. Verify User B is muted
9. Reload page → verify all states persist

**Expected:**
- ✅ All features work together
- ✅ No JavaScript errors
- ✅ Server logs show all actions

**Actual:** _________________

---

### Integration Test 2: Guest to Client to Admin Transition
**Steps:**
1. Start as guest → verify rules visible
2. Sign in as client → verify rules still visible
3. Log out → verify rules still visible
4. Sign in as admin → verify rules hidden, admin panel shown

**Expected:**
- ✅ Smooth transitions
- ✅ No layout glitches
- ✅ Correct UI for each state

**Actual:** _________________

---

## Performance Tests

### Performance Test 1: Message History Load with Styles
**Setup:** Database has 500+ messages with various admin styles

**Steps:**
1. Reload page
2. Measure load time

**Expected:**
- ✅ History loads in < 2 seconds
- ✅ All styles render correctly
- ✅ No visible lag

**Actual Load Time:** _______ ms

---

## Browser Compatibility

Test in:
- [ ] Chrome (latest)
- [ ] Firefox (latest)
- [ ] Safari (latest)
- [ ] Mobile Chrome
- [ ] Mobile Safari

---

## Sign-Off

**Tester:** _________________
**Date:** _________________
**Environment:** _________________

**Overall Result:**
- [ ] All tests passed
- [ ] Minor issues (document below)
- [ ] Major issues (document below)

**Issues Found:**
_________________
_________________
_________________

**Recommendations:**
_________________
_________________
_________________
