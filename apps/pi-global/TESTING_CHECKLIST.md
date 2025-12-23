# Moderation Timing Fixes - Testing Checklist

## Prerequisites
1. Ensure `banned-words.txt` contains test words (e.g., "test", "badword")
2. Start the server: `npm start` or `node server.js`
3. Open the chat in a browser

## Test 1: Immediate Feedback for Profanity in Message ✓

**Steps:**
1. Type a message containing a banned word
2. Click Send

**Expected Result:**
- Message appears immediately (with banned word replaced by dashes)
- System message appears instantly: "⚠️ Strike X: Profanity filtered from your message"
- Toast notification shows at top
- NO 5-second delay
- NO "message may not have sent" error

**Pass Criteria:**
- [ ] Response is immediate (< 100ms)
- [ ] Strike counter increments
- [ ] System message visible in chat
- [ ] Original message is sanitized

---

## Test 2: Immediate Feedback for Banned Display Name ✓

**Steps:**
1. Change nickname to contain a banned word (e.g., "testuser")
2. Try to send any message

**Expected Result:**
- Message is immediately blocked (does NOT appear in chat)
- System message: "⚠️ Strike X: Name blocked (contains banned words)"
- Toast notification appears
- Strike counter increments

**Pass Criteria:**
- [ ] Response is immediate
- [ ] Message does NOT get sent
- [ ] Strike counter increments
- [ ] Clear error message shown

---

## Test 3: Mute Enforcement (Server-Side Authority) ✓

**Steps:**
1. Get 3+ strikes to trigger a mute
2. While muted, try to send a message
3. Also try uploading a file/image

**Expected Result:**
- Server immediately rejects the send
- System message: "🚫 You are currently muted (Strike X) - Xs remaining"
- Input and send button are disabled
- Countdown timer shows remaining mute time
- BOTH text messages AND uploads are blocked

**Pass Criteria:**
- [ ] Mute is enforced server-side
- [ ] No messages get through while muted
- [ ] Countdown timer is accurate
- [ ] UI is disabled during mute
- [ ] All message types are blocked (text, image, video, audio, file)

---

## Test 4: Send Lock Prevents Spam ✓

**Steps:**
1. Click the Send button rapidly 5+ times in a row
2. Observe console logs

**Expected Result:**
- Only first click goes through
- Subsequent clicks are blocked for 500ms
- Console shows: "[SEND-LOCK] Send blocked - waiting for previous response"
- No flood of messages to server

**Pass Criteria:**
- [ ] Only one send per 500ms window
- [ ] Console shows send lock messages
- [ ] Server doesn't receive spam

---

## Test 5: Send Lock Release on ACK ✓

**Steps:**
1. Send a normal message
2. Wait for server ACK
3. Immediately try to send another message

**Expected Result:**
- First message sends successfully
- ACK arrives (console: "[WS] ✓ ACK RECEIVED")
- Console shows: "[SEND-LOCK] Lock released on ACK"
- Second message can be sent immediately after ACK

**Pass Criteria:**
- [ ] Lock is released on ACK receipt
- [ ] Can send again immediately after ACK
- [ ] No artificial delays

---

## Test 6: Send Lock Auto-Release (Fallback) ✓

**Steps:**
1. Simulate slow server by debugging or network throttling
2. Send a message
3. Wait 500ms (but less than ACK timeout)

**Expected Result:**
- Send lock is automatically released after 500ms
- Console shows: "[SEND-LOCK] Lock auto-released"
- User can attempt another send

**Pass Criteria:**
- [ ] Lock auto-releases after 500ms
- [ ] User isn't stuck unable to send
- [ ] Fallback mechanism works

---

## Test 7: Mute Countdown and Re-Enable ✓

**Steps:**
1. Get muted (3+ strikes)
2. Wait for the mute to expire

**Expected Result:**
- Status bar shows countdown: "Muted for profanity (Strike X) - XXs remaining"
- Countdown updates every second
- When mute expires:
  - System message: "✓ Mute expired - you can chat again"
  - Input and send button re-enabled
  - Status bar disappears

**Pass Criteria:**
- [ ] Countdown is accurate
- [ ] UI re-enables automatically
- [ ] Success message shown

---

## Test 8: Multiple Strikes Escalation ✓

**Steps:**
1. Send messages with profanity to accumulate strikes
2. Observe mute duration increases

**Expected Result:**
- Strikes 1-2: Warning only (no mute)
- Strike 3: 15 second mute
- Strikes 4-5: 15 second mute
- Strike 6: 60 second mute
- Strike 7+: Doubling mute duration

**Pass Criteria:**
- [ ] Strike counter increments correctly
- [ ] Mute durations follow the schedule
- [ ] System messages show correct strike number

---

## Test 9: Backward Compatibility ✓

**Steps:**
1. Check browser console for any errors
2. Verify old event handlers still exist

**Expected Result:**
- `profanity_strike` handler still exists (for old clients)
- `profanity_muted` handler still exists (for old clients)
- No console errors about missing handlers

**Pass Criteria:**
- [ ] No JavaScript errors
- [ ] Legacy handlers present
- [ ] New handlers take priority

---

## Test 10: Cross-Session Persistence ✓

**Steps:**
1. Get strikes and/or get muted
2. Refresh the page
3. Check strike counter and mute status

**Expected Result:**
- Strike count persists (via cookies)
- Mute status persists (via cookies)
- If still muted, UI remains disabled
- Countdown resumes from correct time

**Pass Criteria:**
- [ ] Strikes persist across refresh
- [ ] Mute persists across refresh
- [ ] Countdown continues accurately

---

## Performance Checks

### Response Time
- [ ] Moderation response: < 50ms
- [ ] System message appears: < 100ms
- [ ] No artificial delays or timeouts

### Server Logs
Check server console for:
- [ ] `[MUTE-ENFORCED]` messages when mute is working
- [ ] `[PROFANITY]` messages when profanity detected
- [ ] `[NAME-VIOLATION]` messages when name blocked
- [ ] `[MODERATION]` messages for immediate notices

### Client Logs
Check browser console for:
- [ ] `[SEND-LOCK]` messages for lock engage/release
- [ ] `[MODERATION]` messages for notice handling
- [ ] No errors or warnings

---

## Edge Cases

### Edge Case 1: Rapid Strike Accumulation
- [ ] User can't bypass mute by rapid sending
- [ ] Send lock prevents strike farming

### Edge Case 2: Server Disconnect During Mute
- [ ] Mute persists through reconnection
- [ ] Strike count preserved

### Edge Case 3: Profanity in Caption
- [ ] Upload captions are NOT checked (per current behavior)
- [ ] Only nickname is checked for uploads

---

## Final Verification

- [ ] No new bugs introduced
- [ ] Chat functionality unaffected
- [ ] Upload functionality unaffected
- [ ] Rate limiting still works
- [ ] Delete functionality still works
- [ ] Online counter still works
- [ ] Typing indicator still works

---

## Success Criteria Summary

✅ **Immediate Feedback**: All moderation actions respond within 100ms  
✅ **Strike Visibility**: Strike messages appear as system messages in chat  
✅ **Mute Enforcement**: Server actually blocks sends when muted  
✅ **No Spam**: Send lock prevents rapid retry attempts  
✅ **No Delays**: No artificial 5-second waits or generic errors  
✅ **Backward Compatible**: Old clients still work  
✅ **No Side Effects**: Chat and uploads continue to work normally  

---

## Quick Test Command

```bash
# Start the server
cd /workspace/apps/pi-global
npm start

# In another terminal, test syntax
node -c server.js
```

Open in browser: `http://localhost:8080` (or your configured port)
