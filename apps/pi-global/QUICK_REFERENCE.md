# Profanity Filter - Quick Reference

## Strike & Mute Schedule

| Strikes | Mute Duration | Notes |
|---------|---------------|-------|
| 1-4 | None | Warning only |
| 5 | 15 seconds | First mute |
| 6-7 | 15 seconds | Continues |
| 8 | 60 seconds (1 min) | Escalates |
| 9 | 120 seconds (2 min) | Doubles |
| 10 | 240 seconds (4 min) | Doubles |
| 11 | 480 seconds (8 min) | Doubles |
| 12 | 960 seconds (16 min) | Doubles |
| ... | ... | Continues doubling |
| Max | 2 days | Capped |

## Cookies Used

| Cookie | Purpose | Max Age | Example |
|--------|---------|---------|---------|
| `gc_sid` | User ID | 1 year | `a1b2c3d4e5f6...` |
| `gc_strikes` | Strike count | 1 year | `5` |
| `gc_muteUntil` | Mute expiry | Dynamic | `1703260800000` |

## WebSocket Messages

### Client → Server
- Standard text messages (filtered on server)

### Server → Client

**profanity_strike** - Strike issued
```json
{
  "type": "profanity_strike",
  "strikes": 5,
  "muted": true,
  "muteUntil": 1703260800000,
  "seconds": 15,
  "foundWords": ["damn"],
  "message": "Strike 5: Muted for 15s"
}
```

**profanity_muted** - Message rejected (muted)
```json
{
  "type": "profanity_muted",
  "strikes": 5,
  "muteUntil": 1703260800000,
  "seconds": 14,
  "message": "You are muted for 14s (Strike 5)"
}
```

**welcome** - Extended with profanity state
```json
{
  "type": "welcome",
  "gcSid": "a1b2c3d4...",
  "profanityStrikes": 3,
  "profanityMuted": false
}
```

## Key Server Functions

```javascript
loadBannedWords()              // Load at startup
filterProfanity(text)          // Returns { filtered, found }
getProfanityState(gcSid)       // Get user state
applyProfanityStrike(state)    // Issue strike + mute
isProfanityMuted(state)        // Check if muted
calculateMuteDuration(strikes) // Get mute duration
```

## Key Client Functions

```javascript
getProfanityState()                 // Load from cookies
setProfanityState(strikes, muteUntil) // Save to cookies
isProfanityMuted()                  // Check if muted
handleProfanityStrike(data)         // Handle strike message
handleProfanityMuted(data)          // Handle muted message
showProfanityMuteMessage(until, strikes) // Show UI countdown
```

## Server Logs to Watch

```
[PROFANITY] Loaded X banned words from banned-words.txt
[PROFANITY] Found N banned term(s) in message from User: word1, word2
[PROFANITY] Strike N issued (no mute yet)
[PROFANITY] Strike N issued, muted for Xs
[PROFANITY] Client xyz is muted (Xs remaining, N strikes)
```

## Client Console Logs

```
[GC_SID] Received gc_sid from server: abcd1234...
[PROFANITY] Initial state: strikes=N, muteUntil=timestamp
[PROFANITY] Current state: strikes=N, muted=true/false
```

## Testing Commands

```bash
# Start server
cd apps/pi-global
npm install
npm start

# Check syntax
node -c server.js

# View logs
tail -f ~/chat-data/logs/chat.log  # If using pm2 with logs

# PM2 commands
npm run pm2:start
npm run pm2:logs
npm run pm2:restart
```

## Quick Test

1. Open chat in browser
2. Send: `"This is damn annoying"` → Strike 1
3. Send 4 more profanity messages → Strike 5, muted 15s
4. Wait 15 seconds → Unmuted
5. Send 3 more profanity messages → Strikes 6, 7, 8, muted 60s

## Modifying Banned Words

```bash
# Edit the file
nano apps/pi-global/banned-words.txt

# Add words (one per line, lowercase)
badword1
badword2
offensive

# Comments start with #
# This is a comment

# Restart server to reload
npm run pm2:restart
```

## Troubleshooting

**Filter not working?**
- Check `[PROFANITY] Loaded X banned words` in server log
- Verify banned-words.txt exists and has content
- Restart server after editing banned-words.txt

**Strikes not persisting?**
- Check browser cookies: gc_sid, gc_strikes, gc_muteUntil
- Verify cookies are enabled
- Check cookie expiry dates

**Mute not enforced?**
- Check server rejects with `[PROFANITY] Client xyz is muted`
- Verify client receives profanity_muted message
- Check client send button is disabled

## File Locations

```
apps/pi-global/
├── server.js                    # Server logic
├── banned-words.txt             # Banned words list
├── package.json                 # Dependencies
├── PROFANITY_FILTER_SUMMARY.md  # Full documentation
├── PROFANITY_FILTER_TESTING.md  # Test guide
└── QUICK_REFERENCE.md           # This file

/workspace/
└── index.html                   # Client UI
```

## Production Checklist

- [ ] Install dependencies: `npm install`
- [ ] Edit `banned-words.txt` with real profanity/slurs
- [ ] Test with sample words
- [ ] Verify strikes persist across reloads
- [ ] Verify mutes work at 5 and 8 strikes
- [ ] Check server logs for profanity events
- [ ] Monitor for false positives
- [ ] Set up log aggregation (optional)
- [ ] Deploy and restart server

## Support

For detailed information:
- `PROFANITY_FILTER_SUMMARY.md` - Full implementation details
- `PROFANITY_FILTER_TESTING.md` - Comprehensive test guide
- Server console logs - Real-time debugging
- Browser DevTools - Client-side debugging
