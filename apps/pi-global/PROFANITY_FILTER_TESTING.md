# Profanity Filter Testing Guide

## Overview
This document provides test steps to verify the profanity filter, strike system, and mute functionality in the global chat.

## Setup

1. **Install Dependencies**
   ```bash
   cd apps/pi-global
   npm install
   ```
   This will install the new `cookie-parser` dependency.

2. **Start the Server**
   ```bash
   npm start
   ```

3. **Open the Client**
   Open the global chat in your browser (either locally or via GitHub Pages).

## Test Scenarios

### Test 1: Basic Profanity Filtering

**Goal:** Verify that banned words are replaced with dashes.

**Steps:**
1. Open the chat in your browser
2. Enter a nickname (e.g., "Tester")
3. Type a message containing a banned word: `"This is damn annoying"`
4. Click Send

**Expected Results:**
- Message appears as: `"This is ---- annoying"`
- You receive a strike notification (toast): `"Strike 1: Warning issued"`
- The sanitized message is broadcast to all users
- Console shows: `[PROFANITY] Found 1 banned term(s) in message`

### Test 2: Punctuation Handling

**Goal:** Verify that banned words with punctuation are filtered correctly.

**Steps:**
1. Send: `"What the hell!"`
2. Send: `"Damn, this is bad"`

**Expected Results:**
- First message shows: `"What the ----!"`
- Second message shows: `"----, this is bad"`
- Each message gives you a strike (now at strikes 2 and 3)

### Test 3: Case Insensitivity

**Goal:** Verify that filtering works regardless of case.

**Steps:**
1. Send: `"HELL yeah"`
2. Send: `"HeLl no"`

**Expected Results:**
- Both messages are filtered: `"---- yeah"` and `"---- no"`
- You receive strikes 4 and 5
- At strike 5, you should get a **15-second mute**

### Test 4: First Mute at 5 Strikes

**Goal:** Verify that reaching 5 strikes triggers a 15-second mute.

**Expected Results:**
- After your 5th profanity strike, you see:
  - Toast notification: `"Strike 5: Muted for 15s"`
  - Status bar shows: `"Muted for profanity (Strike 5) - XXs remaining"`
  - Send button is disabled
  - Countdown timer updates every second
- Try to send a message during mute:
  - Message is blocked
  - Error shown: `"You are muted for Xs (Strike 5)"`
- After 15 seconds:
  - Status bar disappears
  - Send button re-enables
  - You can send messages again

### Test 5: Second Mute at 8 Strikes

**Goal:** Verify that reaching 8 strikes triggers a 60-second mute.

**Steps:**
1. Wait for first mute to expire (15s)
2. Send 3 more messages with profanity to reach strikes 6, 7, and 8
3. At strike 8, verify the mute duration

**Expected Results:**
- Strikes 6 and 7: 15-second mutes each
- Strike 8: **60-second (1 minute) mute**
- Status shows: `"Muted for profanity (Strike 8) - 1:00 remaining"`

### Test 6: Escalating Mutes After Strike 8

**Goal:** Verify that mutes double after strike 8.

**Steps:**
1. Continue sending profanity messages after each mute expires
2. Track mute durations

**Expected Results:**
- Strike 9: 120 seconds (2 minutes)
- Strike 10: 240 seconds (4 minutes)
- Strike 11: 480 seconds (8 minutes)
- Strike 12: 960 seconds (16 minutes)
- And so on, up to max of 2 days

### Test 7: Cookie Persistence

**Goal:** Verify that strikes and mutes persist across page reloads.

**Steps:**
1. Accumulate several strikes (e.g., 3 strikes)
2. Refresh the page
3. Check browser console for profanity state
4. Send another profanity message

**Expected Results:**
- Console shows: `[PROFANITY] Initial state: strikes=3, muteUntil=0`
- Next profanity message gives strike 4 (not strike 1)
- Strikes are persisted in `gc_strikes` cookie

### Test 8: Mute Persistence During Mute

**Goal:** Verify that active mutes persist across reloads.

**Steps:**
1. Get muted (5+ strikes)
2. While muted, refresh the page
3. Check if you're still muted

**Expected Results:**
- After reload, you're still muted
- Status bar shows remaining mute time
- Send button is disabled
- Console shows: `[PROFANITY] Initial state: strikes=X, muteUntil=[timestamp]`

### Test 9: Multiple Banned Words in One Message

**Goal:** Verify that multiple profanity terms are all filtered.

**Steps:**
1. Send: `"This damn hell is stupid"`

**Expected Results:**
- Message shows: `"This ---- ---- is ------"`
- Only 1 strike is issued (per message, not per word)
- Console logs all found words

### Test 10: Clean Messages (No False Positives)

**Goal:** Verify that clean messages are not filtered.

**Steps:**
1. Send: `"Hello everyone, how are you?"`
2. Send: `"This is a normal message"`

**Expected Results:**
- Messages appear unchanged
- No strikes issued
- No filtering occurs

### Test 11: User Identification with gc_sid

**Goal:** Verify that different users have separate strike counters.

**Steps:**
1. Open chat in Browser 1, send profanity messages, accumulate strikes
2. Open chat in Browser 2 (or incognito mode)
3. Send profanity in Browser 2

**Expected Results:**
- Browser 1 and Browser 2 have different `gc_sid` cookies
- Browser 2 starts at strike 1 (independent counter)
- Each browser/user has their own strike/mute state

### Test 12: Server Rejection While Muted

**Goal:** Verify that server rejects messages while user is muted.

**Steps:**
1. Get muted (5+ strikes)
2. Try to send a clean message (no profanity) while muted

**Expected Results:**
- Server rejects the message
- Server sends back `profanity_muted` message
- Client shows error: `"You are muted for Xs (Strike Y)"`

## Inspecting Server Logs

When testing, watch the server console for these log messages:

```
[STARTUP] ✓ Loaded X banned words from banned-words.txt
[CONNECT] Client has gc_sid: abcd1234...
[CONNECT] Profanity state: strikes=0, muted=false
[PROFANITY] Found 1 banned term(s) in message from Tester: damn
[PROFANITY] Strike 1 issued (no mute yet)
[PROFANITY] Strike 5 issued, muted for 15s
[PROFANITY] Client xyz is muted (14s remaining, 5 strikes)
```

## Inspecting Browser Cookies

Use browser DevTools (Application/Storage > Cookies) to inspect:

- `gc_sid`: User ID (UUID, persists 1 year)
- `gc_strikes`: Number of strikes (integer)
- `gc_muteUntil`: Timestamp when mute expires (epoch ms)

## Modifying Banned Words List

To add or remove banned words:

1. Edit `apps/pi-global/banned-words.txt`
2. Add one word per line
3. Lines starting with `#` are comments
4. Restart the server to reload the list

Example:
```
# Custom banned words
badword1
badword2
offensive_term
```

## Edge Cases to Test

1. **Empty message**: No strike if message only contains whitespace
2. **Very long mutes**: Verify max mute duration is capped at 2 days
3. **Cookie tampering**: Server validates cookie values (clamped 0-1000 strikes)
4. **WebSocket reconnection**: Strikes persist across reconnections
5. **Concurrent tabs**: Same user in multiple tabs shares same gc_sid and strikes

## Troubleshooting

**Problem:** Banned words aren't being filtered
- Check that `banned-words.txt` exists in `apps/pi-global/`
- Check server logs for: `[PROFANITY] Loaded X banned words`
- Verify words are lowercase and one per line

**Problem:** Strikes don't persist across reloads
- Check that cookies are enabled in browser
- Check that `gc_sid`, `gc_strikes`, and `gc_muteUntil` cookies are set
- Verify cookies have proper `SameSite` and `Secure` attributes

**Problem:** Mute doesn't work
- Check server logs for mute messages
- Verify client receives `profanity_strike` or `profanity_muted` WebSocket messages
- Check that client disables send button when `isProfanityMuted()` returns true

## Success Criteria

✅ Banned words are replaced with dashes (matching length)
✅ Case-insensitive filtering works
✅ Punctuation is preserved
✅ Strike counter increments per profanity message
✅ 5 strikes = 15-second mute
✅ 8 strikes = 60-second mute
✅ Strikes after 8 double the mute duration
✅ Max mute duration is 2 days
✅ Strikes and mutes persist across page reloads
✅ Clean messages are not filtered
✅ Server rejects messages while muted
✅ Client UI disables send button while muted
✅ Multiple users have independent strike counters
✅ Rules text updated to mention profanity policy
