# Delete Message Feature - Test Checklist

## 6-Step Test Plan

### Test 1: Basic Delete - Own Message
**Steps:**
1. Open browser tab A
2. Send a text message from tab A
3. Verify delete button appears on that message in tab A
4. Click delete button
5. Verify message disappears from tab A

**Expected Result:** ✓ Delete button visible only on own messages, deletion works

---

### Test 2: Delete Propagates to All Clients
**Steps:**
1. Open browser tab A and tab B
2. Send a text message from tab A
3. Verify message appears in both tabs
4. Click delete button in tab A
5. Verify message disappears from BOTH tab A and tab B

**Expected Result:** ✓ Deletion is broadcast to all clients

---

### Test 3: Cannot Delete Other User's Messages
**Steps:**
1. Open browser tab A and tab B
2. Send a text message from tab A
3. Check tab B - the message should appear but WITHOUT a delete button
4. Verify tab B cannot delete tab A's message

**Expected Result:** ✓ No delete button appears on other users' messages

---

### Test 4: Delete Works for Images
**Steps:**
1. Open browser tab A
2. Upload an image with caption from tab A
3. Verify delete button appears on the image message
4. Click delete button
5. Verify image message disappears

**Expected Result:** ✓ Delete works for image messages

---

### Test 5: Delete Works for Audio
**Steps:**
1. Open browser tab A
2. Record and send an audio message from tab A
3. Verify delete button appears on the audio message
4. Click delete button
5. Verify audio message disappears

**Expected Result:** ✓ Delete works for audio messages

---

### Test 6: History Messages Show Delete Button After Welcome
**Steps:**
1. Send several messages from tab A
2. Close tab A
3. Open a NEW tab A (should receive history)
4. Verify delete buttons appear on YOUR old messages from history
5. Verify you can delete your old messages

**Expected Result:** ✓ Delete buttons appear on history messages you sent (after welcome arrives)

---

## Visual Verification

### What to Look For in Console Logs:

1. **On connection:**
   ```
   [WELCOME] myClientId= <some-id>
   [REFRESH] Refreshing delete buttons with myClientId: <some-id>
   ```

2. **When rendering messages:**
   ```
   [RENDER] msg.id <id> senderId <sender> myClientId <mine> canDelete true/false
   ```

3. **When deleting:**
   ```
   [DELETE] Requested deletion of message: <id>
   [DELETE] Removed message from UI: <id>
   ```

4. **Server logs:**
   ```
   [DELETE] Message <id> deleted by <clientId>
   ```

---

## Known Issues to Verify Fixed

- ✓ Delete button was not showing at all → **FIXED**: Added senderId to optimistic messages
- ✓ History messages didn't show delete button → **FIXED**: refreshDeleteButtons() after welcome
- ✓ Server-authoritative delete → **VERIFIED**: Server checks senderId matches before deleting
- ✓ Backward compatible with existing ACK flow → **VERIFIED**: No changes to ACK logic

---

## What NOT to Break (Regression Tests)

- [ ] Text messages still send and display correctly
- [ ] Image uploads still work with captions
- [ ] Audio recordings still work with captions
- [ ] ACK flow still shows "Sending..." then "Sent ✓"
- [ ] History loads correctly on page refresh
- [ ] Online count updates correctly
- [ ] Rate limiting still works (max 2 messages per 10s)
- [ ] Dark mode toggle still works

---

## Browser Compatibility Test

Test in multiple browsers:
- [ ] Chrome/Chromium
- [ ] Firefox
- [ ] Safari (if available)
- [ ] Mobile Safari (if available)
- [ ] Mobile Chrome (if available)
