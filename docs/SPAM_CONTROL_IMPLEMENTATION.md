# Two-Layer Spam Control Implementation

## Overview

This document describes the implementation of a two-layer spam control system with hard enforcement while maintaining the existing strike/ban escalation system.

## Implementation Details

### Layer 1: Sliding Window (Primary Limiter)

**Configuration:**
- Maximum: 5 messages in any rolling 10-second window
- Type: True sliding window (not fixed buckets)
- Applies to: All user-generated message types (text, image, audio, video, file)
- Does NOT apply to: Server-only types (history, ack, online, presence, typing, delete, ping)

**How it works:**
1. On each message attempt, prune timestamps older than 10,000ms from the tracking array
2. Check if current count would exceed 5 messages
3. If exceeded → trigger `registerViolation()` with reason 'WINDOW'
4. If allowed → add current timestamp to array and process message

### Layer 2: Cooldown (Secondary Limiter)

**Configuration:**
- Minimum time gap: 750ms between sends
- Enforcement: Checked BEFORE sliding window check
- Applies to: Same message types as Layer 1

**How it works:**
1. Check if `lastSendAt` exists and time since last send < 750ms
2. If violated → trigger `registerViolation()` with reason 'COOLDOWN'
3. If allowed → proceed to sliding window check
4. Only update `lastSendAt` when message is allowed through (stricter option)

### Strike/Ban Escalation System (Unchanged)

The existing escalation system remains exactly as-is:

**Stage 0 (Pre-escalation):**
- Each violation = 1 strike
- Ban duration: 15 seconds per strike
- After 3 strikes → escalate to Stage 1

**Stage 1:**
- Ban duration: 60 seconds (1 minute)
- Next violation → escalate to Stage 2

**Stage 2+:**
- Ban duration increases by 5 minutes per stage
  - Stage 2: 5 minutes
  - Stage 3: 10 minutes
  - Stage 4: 15 minutes
  - etc.

### Code Changes Summary

**File: `server.js`**

1. **Configuration (lines 18-23):**
   ```javascript
   const RATE_LIMIT_MESSAGES = 5; // Max messages in sliding window
   const RATE_LIMIT_WINDOW = 10000; // 10 seconds (rolling window)
   const RATE_LIMIT_COOLDOWN = 750; // Minimum 750ms between sends
   ```

2. **Updated `registerViolation()` function:**
   - Now accepts `reason` ('WINDOW' or 'COOLDOWN') and `details` string
   - Logs which rule triggered the violation with timing details
   - Maintains same escalation logic

3. **Enhanced `checkRateLimit()` function:**
   - Added cooldown check (Layer 2) before window check
   - Improved sliding window logic with proper timestamp pruning
   - Only updates state when message is allowed
   - Returns detailed violation information

4. **Updated `getClientState()` function:**
   - Added `lastSendAt: 0` to track last send time for cooldown

### Debug Logging

When a violation occurs, a single debug log line is emitted:

**Window violation example:**
```
[RATE-LIMIT-BAN] Violation: WINDOW | count=6/5 in 3245ms (max window=10000ms) | Strike 1/3 | Ban: 15s
```

**Cooldown violation example:**
```
[RATE-LIMIT-BAN] Violation: COOLDOWN | delta=432ms (min=750ms) | Strike 2/3 | Ban: 15s
```

**Escalation example:**
```
[RATE-LIMIT-BAN] Violation: WINDOW | count=6/5 in 2134ms (max window=10000ms) | Strikes reached 3, escalating to stage 1 | Ban: 60s
```

## Testing

### Acceptance Tests

Run the test suite:
```bash
node test-spam-control.js
```

Run full test suite (includes long-running escalation test):
```bash
node test-spam-control.js --full
```

**Test Coverage:**
1. ✓ Normal usage: Messages spaced ~1s apart work fine
2. ✓ Cooldown violation: Messages < 750ms apart trigger strikes
3. ✓ Window violation: 6 messages in 10s triggers strike
4. ✓ Boundary test: Messages at exactly 750ms spacing work
5. ✓ Escalation: Multiple violations lead to progressive bans

### Manual Testing

**Test 1: Normal chatting**
```
Send messages every 1-2 seconds → Should work fine
Expected: All messages accepted
```

**Test 2: Rapid clicking**
```
Click send button rapidly (5+ times in < 1 second)
Expected: First message accepted, subsequent blocked with ban
```

**Test 3: Spam burst**
```
Send 6 messages within 10 seconds (spaced ~1s apart to avoid cooldown)
Expected: First 5 accepted, 6th triggers strike and ban
```

**Test 4: Progressive bans**
```
Trigger 3 violations quickly
Expected:
- 1st violation: 15s ban (strike 1/3)
- 2nd violation: 15s ban (strike 2/3)
- 3rd violation: 60s ban (escalated to stage 1)
- 4th violation: 5min ban (stage 2)
```

## Configuration Options

The spam control can be tuned by modifying these constants in `server.js`:

```javascript
const RATE_LIMIT_MESSAGES = 5;    // Max messages per window
const RATE_LIMIT_WINDOW = 10000;  // Window size in ms
const RATE_LIMIT_COOLDOWN = 750;  // Cooldown in ms (can be 500-750)
```

**Recommendations:**
- Keep `RATE_LIMIT_MESSAGES` at 5 for good balance
- Keep `RATE_LIMIT_WINDOW` at 10000ms (10 seconds)
- `RATE_LIMIT_COOLDOWN` can be reduced to 500ms if 750ms feels too strict
- Do not set cooldown below 500ms (too disruptive for normal users)

## What Was NOT Changed

The implementation explicitly avoids touching:
- Message schemas
- UI/frontend code
- Database operations
- Upload handling
- ACK mechanism
- Delete functionality
- Ownership/color system
- Typing indicators
- Presence/online status
- WebSocket connection handling
- History loading

## Technical Notes

1. **Monotonic timestamps:** Uses `Date.now()` which is suitable for this use case
2. **Per-connection tracking:** State is maintained per user token (persists across reconnections)
3. **Memory efficient:** Old timestamps are pruned, array stays small (max 5 items)
4. **Thread-safe:** JavaScript is single-threaded, no race conditions
5. **Stateless messages:** Server-only message types bypass rate limiting entirely

## Deployment

No special deployment steps required. The changes are backward compatible:
1. Stop the server
2. Deploy updated `server.js`
3. Start the server
4. Existing clients will automatically use new rate limits

## Troubleshooting

**Issue: Users getting banned too easily**
- Reduce `RATE_LIMIT_COOLDOWN` to 500-600ms
- Consider increasing `RATE_LIMIT_MESSAGES` to 6-7

**Issue: Spam still getting through**
- Ensure both layers are active (check logs for WINDOW/COOLDOWN violations)
- Verify timestamps are being properly tracked
- Check if spam uses server-only message types (shouldn't be possible from client)

**Issue: Debug logs too verbose**
- Logs only appear during violations (one line per violation)
- Can be filtered with `grep RATE-LIMIT-BAN`

## Security Considerations

1. **Per-token enforcement:** Rate limits follow the user token, preventing reconnection bypass
2. **Dual layer protection:** Even if one layer fails, the other catches spam
3. **Progressive punishment:** Escalation discourages persistent spammers
4. **No client trust:** All enforcement happens server-side
5. **Type checking:** Only user-generated types are rate-limited

## Performance Impact

- **CPU:** Minimal (array filtering and timestamp comparison)
- **Memory:** ~40 bytes per active user (5 timestamps + metadata)
- **Network:** No change (same message flow)
- **Latency:** < 1ms additional processing per message
