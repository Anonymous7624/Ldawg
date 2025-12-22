# Two-Layer Spam Control - README

## TL;DR

Spam control is now fixed with **two hard enforcement layers**:

1. **750ms cooldown** between messages
2. **5 messages max** per rolling 10-second window

Both violations trigger the existing strike/ban escalation system.

---

## Quick Start

### Test It
```bash
node test-spam-control.js
```

### Deploy It
```bash
# No special steps needed - just restart server
node server.js
```

### Configure It
Edit these lines in `server.js`:
```javascript
const RATE_LIMIT_MESSAGES = 5      // Max messages per 10s window
const RATE_LIMIT_WINDOW = 10000    // Window size (10 seconds)
const RATE_LIMIT_COOLDOWN = 750    // Minimum gap between sends (750ms)
```

---

## How It Works

```
Message attempt → Already banned? → Block
                ↓ No
                → Less than 750ms since last? → STRIKE + ban
                ↓ No
                → More than 5 in last 10s? → STRIKE + ban
                ↓ No
                → ALLOWED ✅
```

---

## What Gets Limited

✅ text, image, audio, video, file messages

❌ NOT limited: typing, presence, delete, ping, ack, history

---

## Escalation (Unchanged)

- Strike 1 → 15s ban
- Strike 2 → 15s ban
- Strike 3 → 60s ban + Stage 1
- Stage 2+ → 5min, 10min, 15min... (progressive)

---

## Documentation

- **SPAM_CONTROL_COMPLETE.md** - Start here (executive summary)
- **SPAM_CONTROL_QUICK_REF.md** - Quick reference card
- **SPAM_CONTROL_IMPLEMENTATION.md** - Full technical docs
- **SPAM_CONTROL_CODE_CHANGES.md** - Code diff
- **DEPLOYMENT_CHECKLIST_SPAM_CONTROL.md** - Deployment guide

---

## Testing

### Automated
```bash
node test-spam-control.js         # Quick tests
node test-spam-control.js --full  # Full suite
```

### Manual
1. Send messages 1s apart → Should work ✅
2. Click send rapidly → Should block ✅
3. Send 6 messages in 10s → Should block ✅

---

## Troubleshooting

**Too strict?** Reduce cooldown to 500ms  
**Too lenient?** Increase to 1000ms or reduce messages to 4

Check logs for:
```
[RATE-LIMIT-BAN] Violation: COOLDOWN | ...
[RATE-LIMIT-BAN] Violation: WINDOW | ...
```

---

## Files Changed

- `server.js` - Only file modified (~60 lines)
- No UI, DB, or config file changes
- 100% backward compatible

---

**Status:** ✅ Complete and ready for deployment

For more details, see **SPAM_CONTROL_COMPLETE.md**
