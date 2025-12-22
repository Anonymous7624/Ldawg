# Rate Limiter Implementation - Quick Reference

## Overview
The server now enforces **4 messages per second per client** with immediate ban enforcement.

## Configuration
```javascript
RATE_LIMIT_MESSAGES = 4      // Max messages per window
RATE_LIMIT_WINDOW = 1000     // Window size in milliseconds (1 second)
```

## How It Works

### Rolling Window Algorithm
1. Server maintains array of message timestamps per client token
2. On each message, filter out timestamps older than 1 second
3. Add current timestamp to array
4. If array length > 4, trigger violation

### Rate Limited Message Types
- ✅ `text` - Chat messages
- ✅ `image` - Image uploads
- ✅ `audio` - Audio messages
- ✅ `file` - File attachments

### Exempt Message Types (No Rate Limit)
- ⚪ `presence` - Online/offline status
- ⚪ `typing` - Typing indicators
- ⚪ `ping` - Connection checks
- ⚪ `delete` - Delete requests
- ⚪ `ack` - Acknowledgments

## Ban Escalation Table

| Violation | Stage | Action | Ban Duration |
|-----------|-------|--------|--------------|
| 1st | 0 | Strike 1/3 | 15 seconds |
| 2nd | 0 | Strike 2/3 | 15 seconds |
| 3rd | 0 | Strike 3/3 → Stage 1 | 1 minute |
| 4th | 1 → 2 | Escalate | 5 minutes |
| 5th | 2 → 3 | Escalate | 10 minutes |
| 6th | 3 → 4 | Escalate | 15 minutes |
| 7th+ | +1 each | Escalate | +5 min each |

## Debug Log Format

When a ban is triggered, you'll see logs like:

```
[RATE-LIMIT-BAN] Violation detected: 5 messages in 1000ms window | Strike 1/3 | Ban duration: 15s
```

Or for escalated bans:

```
[RATE-LIMIT-BAN] Violation detected: 5 messages in 1000ms window | Stage: 2 | Ban duration: 300s
```

## Client Response

When rate limited, clients receive:

```json
{
  "type": "banned",
  "until": 1234567890000,
  "seconds": 15,
  "strikes": 1,
  "reason": "rate"
}
```

## Example Scenarios

### Scenario 1: Normal Usage
- User sends 3 messages in 1 second
- ✅ All accepted (within limit)

### Scenario 2: First Violation
- User sends 5 messages in 1 second
- ✅ First 4 accepted
- ❌ 5th message triggers ban
- 🔒 15-second ban applied
- Strike counter: 1/3

### Scenario 3: Repeated Violations
- User gets banned 3 times (strikes 1, 2, 3)
- On 3rd violation: Escalates to 1-minute ban
- On 4th violation: Escalates to 5-minute ban
- Continues escalating by 5 minutes per violation

### Scenario 4: Mixed Message Types
- User sends: ping, text, text, text, text, typing, text
- Rate limit applies to: 5 text messages
- ✅ First 4 text messages accepted
- ❌ 5th text message triggers ban
- ⚪ ping and typing bypass rate limit

## Testing Commands

### Start Server
```bash
node server.js
```

### Run Rate Limit Test
```bash
node test-rate-limit.js
```

### Manual Test with wscat
```bash
# Install wscat if needed
npm install -g wscat

# Connect
wscat -c ws://localhost:8080

# Send rapid messages (paste all at once)
{"type":"text","nickname":"Test","text":"1","messageId":"m1"}
{"type":"text","nickname":"Test","text":"2","messageId":"m2"}
{"type":"text","nickname":"Test","text":"3","messageId":"m3"}
{"type":"text","nickname":"Test","text":"4","messageId":"m4"}
{"type":"text","nickname":"Test","text":"5","messageId":"m5"}
```

Expected: 4 ACKs, 1 BANNED response

## Key Functions

### `checkRateLimit(state)`
- Filters old timestamps
- Adds new timestamp
- Returns violation status

### `registerViolation(info, messageCount, windowMs)`
- Manages strike counter
- Escalates ban stages
- Logs violation details

### `isBanned(info)`
- Checks if current time < bannedUntil
- Returns true if still banned

## Code Locations

| Feature | File | Lines |
|---------|------|-------|
| Configuration | server.js | 20-21 |
| Ban Logic | server.js | 183-204 |
| Rate Check | server.js | 206-234 |
| Message Handler | server.js | 430-455 |

## Notes

- Bans are tracked by **token**, not connection
- Reconnecting doesn't reset ban timer
- Multiple tabs with same token share rate limit
- Private browsing/new token = fresh rate limit state
