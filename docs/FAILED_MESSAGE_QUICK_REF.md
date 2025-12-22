# Failed Message Handling - Quick Reference

## What Changed

### Visual
- ❌ **Failed messages now have RED bubbles** (was unclear before)
- 🔄 **Retry button appears on hover** (bottom-right of failed messages)
- ⏱️ **Longer timeouts** = fewer false failures on slow connections

### Timeouts
| Before | After | Change |
|--------|-------|--------|
| 5s text | 10s text | +5s (100% increase) |
| 5s upload | 10s after upload | Starts after upload |
| N/A | 20s retry | New retry timeout |

### Behavior
1. **Normal send** → 10s timeout → ACK → Green bubble ✅
2. **Timeout** → Red bubble + Retry button 🔴
3. **Click Retry** → Re-send same message → 20s timeout → ACK → Green bubble ✅
4. **Late ACK** → Automatically flip red → green 🔴→✅

## Key Functions

### `markMessageAsFailed(messageId)`
Makes bubble red and adds retry button

### `retryMessage(messageId)`
Resends message with 20s timeout, reuses uploaded files

## File Uploads
**Critical fix:** ACK timer now starts AFTER upload completes
- Before: Timer started immediately → large files often failed
- After: Timer starts after upload → large files work reliably

## Retry Logic
- ✅ Reuses same message ID (no duplicates)
- ✅ Reuses uploaded file URL (no re-upload)
- ✅ Extends timeout to 20s
- ✅ Can retry multiple times
- ✅ Works for text, images, audio, video, files

## Backward Compatibility
✅ All existing features preserved:
- ACK protocol
- Green/blue message colors
- Delete functionality
- Upload system
- Audio/video previews
- Dark mode
- Typing indicators

## Browser Support
- **Desktop:** Retry button on hover
- **Mobile:** Retry button always visible
- **All major browsers** (Chrome, Firefox, Safari, Edge)

## Configuration
```javascript
const DEFAULT_ACK_TIMEOUT_MS = 10000; // 10 seconds
const RETRY_ACK_TIMEOUT_MS = 20000;   // 20 seconds for retry
```

## CSS Classes
- `.message-failed` - Red bubble styling
- `.retryBtn` - Retry button styling

## Logs to Watch
```
[FAIL] Marking message as failed: <id>
[RETRY] Attempting to retry message: <id>
[RETRY] Retry attempt #1
[ACK] ✓ Late ACK flipped message from failed to sent: <id>
```

## Quick Test
1. Send message
2. Disconnect internet quickly
3. Wait 10+ seconds
4. **See:** Red bubble + Retry button
5. Reconnect internet
6. Click Retry
7. **See:** Green bubble

## Success Indicators
✅ Red bubbles appear on timeout
✅ Retry button visible on hover
✅ Retry works (message turns green)
✅ Large uploads don't fail prematurely
✅ Late ACKs flip red → green
✅ Existing features all work

## Files Modified
- `index.html` (client-side only)

## Server Changes
- **None required** (works with existing server)
