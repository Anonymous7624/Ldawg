# Quick Manual Test Checklist

## Test 1: Send Message → Delete Button Appears ✓
1. Open chat
2. Send a text message
3. **Expected:** Message appears GREEN with delete button
4. Click delete button
5. **Expected:** Message disappears from UI

**Pass criteria:**
- [ ] Message shows GREEN background
- [ ] Delete button visible
- [ ] Delete button works

---

## Test 2: Reload → My Messages Stay Green + Delete Button ✓
1. Send 2-3 messages (should be GREEN)
2. Refresh page (F5 or Ctrl+R)
3. **Expected:** Your messages still GREEN with delete buttons

**Pass criteria:**
- [ ] Messages stay GREEN after refresh
- [ ] Delete buttons still present
- [ ] Can still delete messages

---

## Test 3: Two Tabs → Messages from Tab A Are Green in Tab A, Blue in Tab B ✓
1. Open Tab A
2. Send message "Hello from A"
3. Open Tab B (same browser, new tab)
4. **Expected in Tab A:** "Hello from A" is GREEN
5. **Expected in Tab B:** "Hello from A" is BLUE
6. Send "Hello from B" in Tab B
7. **Expected in Tab B:** "Hello from B" is GREEN
8. **Expected in Tab A:** "Hello from B" is BLUE

**Pass criteria:**
- [ ] Tab A shows its own messages as GREEN
- [ ] Tab B shows Tab A's messages as BLUE
- [ ] Tab B shows its own messages as GREEN
- [ ] Tab A shows Tab B's messages as BLUE

---

## Test 4: Delete in Sender Tab → Message Disappears for Everyone ✓
1. In Tab A: Send message (GREEN in A, BLUE in B)
2. In Tab A: Click delete button
3. **Expected:** Message disappears in BOTH tabs

**Pass criteria:**
- [ ] Delete works in sender tab
- [ ] Message removed from other tab
- [ ] Message removed from history

---

## Test 5: Other User Cannot Delete My Messages ✓
1. In Tab A: Send message
2. In Tab B: Look at that message
3. **Expected:** No delete button visible in Tab B

**Pass criteria:**
- [ ] Delete button only in sender's tab
- [ ] Other users don't see delete button

---

## Test 6: Image Messages ✓
1. Upload an image
2. **Expected:** Image message shows GREEN with delete button
3. Refresh page
4. **Expected:** Still GREEN, delete still works

**Pass criteria:**
- [ ] Image message is GREEN
- [ ] Delete button appears
- [ ] Persists through refresh

---

## Test 7: Audio Messages ✓
1. Record an audio message
2. **Expected:** Audio message shows GREEN with delete button
3. Refresh page
4. **Expected:** Still GREEN, delete still works

**Pass criteria:**
- [ ] Audio message is GREEN
- [ ] Delete button appears
- [ ] Persists through refresh

---

## Console Checks

Open DevTools console and verify:

### Check 1: Client Identity Persisted
```javascript
sessionStorage.getItem('myClientId')
```
**Expected:** Returns a hex string like `"d4f7a2b3"`

### Check 2: Ownership Logs
Look for lines like:
```
[RENDER] 🔍 Ownership Check: {
  messageId: "...",
  senderId: "d4f7a2b3",
  myClientId: "d4f7a2b3",
  isOwnMessage: true,
  canDelete: true,
  colorClass: "GREEN"
}
```

### Check 3: Refresh Detection
After refresh, look for:
```
[STARTUP] Restored myClientId from session: d4f7a2b3
[WELCOME] Using existing myClientId from session: d4f7a2b3
[REFRESH] 🔄 Refreshing ownership UI with myClientId: d4f7a2b3
```

---

## Quick Visual Test

1. Send 3 messages
2. Open another tab
3. **Expected visual:**

**Tab A (sender):**
```
🟢 Your message 1 [Delete]
🟢 Your message 2 [Delete]
🟢 Your message 3 [Delete]
```

**Tab B (observer):**
```
🔵 Other's message 1
🔵 Other's message 2
🔵 Other's message 3
```

---

## Edge Cases

### Edge 1: History Messages
1. Load page with existing history
2. **Expected:** Messages show correct colors based on session identity
3. Your messages from THIS session should be GREEN

### Edge 2: Session Reset
1. Send messages
2. Close ALL browser windows
3. Open fresh window
4. **Expected:** Previous messages now BLUE (new session = new identity)

### Edge 3: Rapid Refresh
1. Send message
2. Immediately refresh (within 1 second)
3. **Expected:** Message still GREEN with delete button

---

## Troubleshooting

### Problem: Delete button not appearing
**Check:**
1. Console shows `myClientId: "..."`? (not `null`)
2. Console shows `isOwnMessage: true`?
3. Console shows `canDelete: true`?

**Fix:**
```javascript
// Clear session and reload
sessionStorage.removeItem('myClientId');
location.reload();
```

### Problem: All messages are BLUE
**Check:**
1. `sessionStorage.getItem('myClientId')` returns `null`?
2. Welcome message received? Look for `[WELCOME]` in console

**Fix:**
- Wait for connection to establish
- Check WebSocket is connected

### Problem: Colors don't persist after refresh
**Check:**
1. Session storage working? `sessionStorage.setItem('test', '1')`
2. Browser in private/incognito mode? (sessionStorage still works)

**Fix:**
- Check browser console for errors
- Verify no extensions blocking sessionStorage

---

## Success Criteria

All tests must pass:
- [x] Delete button appears on own messages
- [x] Colors work (green=own, blue=others)
- [x] Persists through refresh
- [x] Works across tabs
- [x] Delete broadcasts to everyone
- [x] Works for text, image, and audio messages
- [x] Server validates ownership before delete
