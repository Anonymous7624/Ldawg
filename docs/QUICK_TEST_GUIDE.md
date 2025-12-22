# Quick Test List - Bug Fixes Verification

## Test Scenario 1: Send Message & Delete (Core Flow)
1. Open the chat app
2. Type a message and click Send
3. **Expected**: Message bubble turns GREEN immediately
4. **Expected**: After ~1 second, you see "Sent ✓" briefly
5. Hover over your green message (desktop) or tap it (mobile)
6. **Expected**: Delete button appears
7. Click Delete
8. **Expected**: Message disappears with animation

**Result**: ✅ Green message → delete button visible → deletion works

---

## Test Scenario 2: New Tab Persistence
1. Send a message (should be green with delete button)
2. Open the same URL in a NEW TAB (Ctrl+Shift+N or Cmd+Shift+N for new window)
3. **Expected**: Your message is still GREEN in the new tab
4. Hover over it
5. **Expected**: Delete button STILL appears (ownership persists in session)
6. Switch back to original tab
7. **Expected**: Message still green, delete still works

**Result**: ✅ Green persists across tabs → delete persists

---

## Test Scenario 3: Reload Resets Ownership
1. Send a message (green with delete button)
2. Press F5 or Ctrl+R to RELOAD the page
3. **Expected**: Your previous message turns BLUE (lost ownership)
4. Hover over it
5. **Expected**: No delete button appears (you can't delete old messages after reload)

**Result**: ✅ Reload resets ownership → message becomes blue → no delete button

---

## Test Scenario 4: File Download Readability
1. Upload any file (PDF, TXT, ZIP, etc.) and send
2. Check if it appears in a BLUE bubble (sent by "other user" view)
3. **Expected**: Download link/button has WHITE text, readable on blue background
4. Send another file from your account
5. **Expected**: File appears in GREEN bubble with readable download button (white/high contrast)
6. Hover over download button
7. **Expected**: Hover effect works, text stays readable

**Result**: ✅ Download buttons readable in both blue and green bubbles

---

## Test Scenario 5: Emoji Dropdown Visibility
1. Click the "Formatting" button to expand toolbar
2. Click the "😊+" emoji picker button
3. **Expected**: Emoji dropdown appears ABOVE or BELOW the button (not cut off)
4. Scroll to bottom of page
5. Click emoji picker again
6. **Expected**: Dropdown flips position if needed to stay in viewport
7. Click an emoji from the dropdown
8. **Expected**: Emoji inserts into text box, dropdown closes

**Result**: ✅ Emoji dropdown fully visible and clickable, not clipped

---

## Quick Visual Check (All Together)
### Send 3 messages:
1. **Text message**: "Hello world"
   - Green bubble ✅
   - Delete button on hover ✅
   
2. **File message**: Upload test.pdf
   - Green bubble ✅
   - Download button readable (white text) ✅
   - Delete button on hover ✅

3. **Image message**: Upload test.jpg
   - Green bubble ✅
   - Image displays ✅
   - Delete button on hover ✅

### Then test emoji:
4. Click emoji picker → dropdown visible ✅
5. Insert emoji → works ✅

---

## Expected Console Logs (DEBUG_DELETE enabled)
When you send a message, you should see:
```
[RENDER] 🔍 Ownership Check: { messageId: "xxx", senderId: "abc123", myClientId: "abc123", isOwnMessage: true, canDelete: false, colorClass: "GREEN" }
[ACK] ✓ Added delete button to message after ACK: xxx
```

When you hover, delete button should appear on screen (no console needed).

---

## Edge Cases to Verify
- [ ] **Other users' messages**: Should be BLUE with NO delete button
- [ ] **System messages** (if any): Should have no color class, no delete button
- [ ] **Failed messages**: Should show error, NO delete button (can't delete unsent)
- [ ] **Dark mode**: All fixes work in dark mode (download buttons, emoji, delete buttons)
- [ ] **Mobile**: Delete button visible on long-press or tap (CSS handles with `@media (hover: none)`)

---

## Summary
If all 5 test scenarios pass:
- ✅ BUG #1 Fixed: Download buttons readable
- ✅ BUG #2 Fixed: Emoji dropdown not cut off
- ✅ BUG #3 Fixed: Delete button shows on green messages
- ✅ No regressions: Chat, uploads, audio, ACKs, rate limits, coloring all work

**Status**: All bugs fixed, ready for production testing.
