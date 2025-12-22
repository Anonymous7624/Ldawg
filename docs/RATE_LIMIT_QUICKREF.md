# Rate Limit Quick Reference

## TL;DR - What Changed

**Cooldown:** 650ms between messages (no strikes)
**Rolling Window:** 4 messages per 10 seconds (5th = strike)
**Strike Schedule:** 15s, 15s, 15s, 60s, 300s, then doubles (10m, 20m, 40m...)

## Quick Test Commands

```bash
# Verify changes are in place
./verify-changes.sh

# Quick functionality test (30 sec)
node test-smoke.js

# Full rate limit test (5-10 min)
node test-new-rate-limits.js
```

## Strike Schedule

| Strike | Duration | Time |
|--------|----------|------|
| 1 | 15s | 15 seconds |
| 2 | 15s | 15 seconds |
| 3 | 15s | 15 seconds |
| 4 | 60s | 1 minute |
| 5 | 300s | 5 minutes |
| 6 | 600s | 10 minutes |
| 7 | 1200s | 20 minutes |
| 8 | 2400s | 40 minutes |
| 9+ | doubles | continues... |

## Key Behaviors

✓ **Cooldown violations:** Blocked silently, no strike
✓ **Window violations:** 5th message in 10s = strike + ban
✓ **Ban persistence:** Survives page refresh
✓ **All features work:** ACK, delete, colors, uploads, DB, etc.

## Files Changed

- `server.js` - Server-side logic
- `index.html` - Client-side logic + UI text

## Documentation

- `RATE_LIMIT_COMPLETE.md` - Full summary
- `RATE_LIMIT_IMPLEMENTATION.md` - Detailed implementation guide

## Status

✓ All changes complete and verified
✓ Ready for deployment
