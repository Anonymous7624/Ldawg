# Two-Layer Spam Control - Quick Reference

## 🎯 What Changed

**Before:** 4 messages per 1 second window  
**After:** 5 messages per 10 second window + 750ms cooldown between sends

## 📋 Configuration

```javascript
RATE_LIMIT_MESSAGES = 5      // Max messages in 10s window
RATE_LIMIT_WINDOW = 10000    // 10 second rolling window
RATE_LIMIT_COOLDOWN = 750    // 750ms minimum between sends
```

## 🛡️ Two Layers

### Layer 1: Cooldown (750ms)
- **Check:** Time since last send must be ≥ 750ms
- **Trigger:** Sending messages faster than 750ms apart
- **Action:** Strike + 15s ban (or escalated ban)

### Layer 2: Sliding Window (5 in 10s)
- **Check:** Max 5 messages in any rolling 10 second period
- **Trigger:** Attempting 6th message within 10 seconds
- **Action:** Strike + 15s ban (or escalated ban)

## ⚡ Enforcement Order

1. Check if already banned → reject
2. Check cooldown (750ms) → strike if violated
3. Check sliding window (5/10s) → strike if violated
4. Allow message through

## 📊 Escalation (Unchanged)

| Violation | Strikes | Stage | Ban Duration |
|-----------|---------|-------|--------------|
| 1st       | 1/3     | 0     | 15 seconds   |
| 2nd       | 2/3     | 0     | 15 seconds   |
| 3rd       | 0       | 1     | 60 seconds   |
| 4th       | 0       | 2     | 5 minutes    |
| 5th       | 0       | 3     | 10 minutes   |
| 6th+      | 0       | 4+    | 15, 20, ...  |

## 🧪 Testing

```bash
# Basic tests (fast)
node test-spam-control.js

# Full test suite including escalation (slow)
node test-spam-control.js --full
```

## 📝 Log Format

**Cooldown violation:**
```
[RATE-LIMIT-BAN] Violation: COOLDOWN | delta=432ms (min=750ms) | Strike 1/3 | Ban: 15s
```

**Window violation:**
```
[RATE-LIMIT-BAN] Violation: WINDOW | count=6/5 in 3245ms (max window=10000ms) | Strike 2/3 | Ban: 15s
```

**Escalation:**
```
[RATE-LIMIT-BAN] Violation: WINDOW | count=6/5 in 2134ms (max window=10000ms) | Strikes reached 3, escalating to stage 1 | Ban: 60s
```

## ✅ What's Rate Limited

- ✅ text messages
- ✅ image uploads
- ✅ audio messages
- ✅ video uploads
- ✅ file uploads

## ❌ What's NOT Rate Limited

- ❌ typing indicators
- ❌ presence/online status
- ❌ delete requests
- ❌ ping/ack
- ❌ history loading

## 🔧 Tuning

**If 750ms feels too strict:**
```javascript
const RATE_LIMIT_COOLDOWN = 500;  // Minimum: 500ms
```

**If spam still gets through:**
```javascript
const RATE_LIMIT_MESSAGES = 4;     // Stricter: 4/10s
const RATE_LIMIT_COOLDOWN = 1000;  // Stricter: 1s cooldown
```

**If users complain about false positives:**
```javascript
const RATE_LIMIT_MESSAGES = 6;    // More lenient: 6/10s
const RATE_LIMIT_COOLDOWN = 500;  // More lenient: 500ms
```

## 🎯 Acceptance Criteria (All ✓)

- ✅ 6 messages in 10s triggers strike every time
- ✅ 7+ or 20+ messages in 10s results in bans via escalation
- ✅ Messages spaced ~1s apart work fine
- ✅ Cooldown prevents sending faster than ~0.75s
- ✅ Backend only changes (no UI/DB/upload changes)
- ✅ Normal chatting not annoying

## 📂 Files Modified

- `server.js` - Added two-layer enforcement
- `test-spam-control.js` - NEW test suite
- `SPAM_CONTROL_IMPLEMENTATION.md` - Full documentation

## 🚀 Deployment

1. Stop server
2. Deploy updated `server.js`
3. Start server
4. Done! (backward compatible)

## 🐛 Troubleshooting

**Problem:** Can't send messages at all  
**Check:** Are you banned? Check console for ban duration

**Problem:** Getting banned unexpectedly  
**Check:** Reduce cooldown to 500ms or increase window to 6 messages

**Problem:** Spam still getting through  
**Check:** Verify logs show COOLDOWN/WINDOW violations when expected

## 💡 Key Design Decisions

1. **Cooldown checked first** - Catches rapid-fire spam immediately
2. **lastSendAt updated only on success** - Stricter enforcement
3. **True sliding window** - Not fixed buckets, more accurate
4. **Same escalation system** - Maintains existing behavior
5. **Detailed logging** - Shows which rule triggered and timing data
