# Failed Message Handling & Retry Feature - Implementation Summary

## Overview
This update significantly improves the UX and reliability of message sending by making failed messages obvious and allowing users to retry sending without retyping. All existing features (ACK flow, green/blue colors, delete, uploads, audio/video previews) remain intact.

## Key Changes

### 1. Configuration Constants Added
```javascript
const DEFAULT_ACK_TIMEOUT_MS = 10000; // 10 seconds (increased from 5s)
const RETRY_ACK_TIMEOUT_MS = 20000; // 20 seconds for retry attempts
let messageRetryData = new Map(); // messageId -> { payload, uploadedUrl, attempt, timeoutMs }
```

### 2. Visual Indicators

#### Failed Message Bubble (Red)
- **Background**: Red-tinted (`rgba(220, 53, 69, 0.2)`)
- **Border**: Left border changed to red (`#dc3545`)
- **Clear distinction** from green (own) and blue (others) messages
- Applied via `.message-failed` CSS class

#### Retry Button
- **Position**: Bottom-right of message bubble (under timestamp)
- **Visibility**: Hidden by default, appears on hover (desktop) or always visible (mobile)
- **Style**: Light red background with darker red border
- **Label**: "Retry"
- **Behavior**: Only appears on failed messages from the current user

### 3. Timeout Improvements

#### Text Messages
- **Previous**: 5 second timeout
- **Now**: 10 second timeout on first attempt
- **Retry**: 20 second timeout on retry attempts

#### File Uploads (Critical Fix)
- **Previous**: ACK timer started immediately (before upload completed)
- **Now**: ACK timer starts AFTER upload completes AND WebSocket message is sent
- **Impact**: Large files on slow connections no longer fail prematurely
- **Timeout**: 10 seconds after WS send (20 seconds on retry)

### 4. Retry Logic

#### Message Retry Flow
1. User clicks "Retry" button on failed message
2. Message reverts to "sending" state (bubble changes from red to normal)
3. System reuses the original payload (same message ID, same content)
4. For attachments: Reuses the already-uploaded URL (no re-upload)
5. WebSocket message sent with extended 20-second timeout
6. On success: Bubble turns green, retry button removed
7. On failure: Bubble turns red again, retry button reappears

#### Retry Data Storage
Each message stores:
- **payload**: Original message data (for exact re-send)
- **uploadedUrl**: For attachments, the already-uploaded file URL
- **attempt**: Retry attempt counter
- **timeoutMs**: Current timeout value (10s or 20s)

### 5. Late ACK Handling

If an ACK arrives after a message has already timed out and turned red:
1. Message automatically flips from red to green
2. Retry button removed
3. Delete button added (if own message)
4. Logs: `[ACK] ✓ Late ACK flipped message from failed to sent`

This ensures the UI always reflects the actual server state.

### 6. Implementation Functions

#### `markMessageAsFailed(messageId)`
- Removes 'sending' and 'error' classes
- Adds 'message-failed' class (red styling)
- Updates status text to "Failed to send"
- Adds retry button for own messages

#### `retryMessage(messageId)`
- Validates retry data exists
- Checks WebSocket connection
- Increments retry attempt counter
- Updates UI to "sending" state
- Reuses uploaded URL for attachments (no re-upload)
- Sends WebSocket message with 20-second timeout
- Handles success/failure appropriately

### 7. Updated Message Flow

#### Text Message
```
User types → sendMessage() → WS send → Start 10s timer → ACK or timeout
  ↓ timeout
Red bubble + Retry button → User clicks Retry → WS send → Start 20s timer → ACK or timeout
```

#### File Upload
```
User selects file → Upload to server → Upload completes → WS send → Start 10s timer → ACK or timeout
  ↓ timeout
Red bubble + Retry button → User clicks Retry → Reuse uploaded URL → WS send → Start 20s timer → ACK or timeout
```

## Validation Checklist

✅ **Normal text message** → Turns green on ACK
✅ **Simulated ACK loss** → Bubble turns red + Retry appears on hover
✅ **Click Retry** → Bubble returns to sending state, then green on ACK (with 20s timeout)
✅ **Large file upload on slow network** → No premature failure (ACK timer starts after upload)
✅ **Late ACK after fail** → Bubble flips from red to green automatically
✅ **Existing features preserved**: ACK flow, green/blue colors, delete, uploads, audio/video previews

## Browser Compatibility

- **Desktop**: Retry button appears on hover
- **Mobile/Touch**: Retry button always visible (opacity 0.8)
- **All message types**: Text, Image, Audio, Video, File attachments

## Backward Compatibility

All changes are additive and non-breaking:
- Existing messages display normally
- Server ACK protocol unchanged
- WebSocket message format unchanged
- Delete functionality preserved
- Color-coding system preserved (green=own, blue=others)

## Technical Details

### CSS Classes
- `.message-failed` - Red bubble styling
- `.retryBtn` - Retry button styling (hover-only on desktop)

### State Transitions
- `sending` → `sent` (green) - Normal success path
- `sending` → `failed` (red) - Timeout or error
- `failed` → `sending` - User clicks retry
- `failed` → `sent` (green) - Late ACK arrives

### Timeout Values
- First attempt: 10,000ms (10 seconds)
- Retry attempt: 20,000ms (20 seconds)
- Ping/self-test: 3,000ms (unchanged)

## Files Modified

- `index.html` - All client-side changes (CSS + JavaScript)
  - Added constants and retry metadata storage
  - Added failed message styling (CSS)
  - Added retry button styling (CSS)
  - Implemented `markMessageAsFailed()` function
  - Implemented `retryMessage()` function
  - Updated `sendMessage()` for proper timeout handling
  - Updated ACK handler for late arrival detection
  - Updated error handler to use failed state

## No Server Changes Required

The server (`server.js`) requires no changes. All improvements are client-side UX enhancements that work with the existing ACK protocol.
