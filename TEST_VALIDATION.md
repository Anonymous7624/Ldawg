# PRODUCTION BUG FIXES - VALIDATION GUIDE

## Changes Summary

### TASK A: CORS Fix (server.js)
**Changes Made:**
1. Replaced wildcard `*` CORS with explicit origin whitelist
2. Added support for:
   - https://ldawg7624.com
   - https://www.ldawg7624.com
   - localhost (for testing)
3. Proper OPTIONS preflight handling with 204 status
4. Added detailed logging for all /upload and /uploads requests
5. Explicit `Content-Type: application/json` headers on all upload responses

**Code Location:** Lines 22-48 in server.js

### TASK B: Local Echo for Text Messages (index.html)
**Changes Made:**
1. Added UUID generation for client-side message IDs
2. Implemented optimistic UI updates - messages appear instantly
3. Added `pendingMessages` Map to track unconfirmed messages
4. Messages show "Sending..." status until server confirms
5. Matching logic to remove "sending" status when server broadcasts back
6. Clear input immediately after clicking Send (no delay)
7. Auto-scroll to bottom after adding message

**Code Location:** Lines 530-650 in index.html

### TASK C: ChatGPT-Style Photo Composer (index.html)
**Changes Made:**
1. Added photo composer UI with:
   - Preview thumbnail (max 150x150px)
   - Filename and file size display
   - Remove button to clear attachment
   - Caption field (reuses message input)
2. **NO IMMEDIATE UPLOAD** - file selection only shows preview
3. Upload happens ONLY when user clicks Send button
4. Supports both camera capture and file selection
5. Preview uses `URL.createObjectURL()` for instant display
6. Proper cleanup with `URL.revokeObjectURL()`
7. Image messages can include optional caption

**Code Location:** 
- CSS: Lines 222-288 in index.html
- HTML: Lines 469-484 in index.html  
- JavaScript: Lines 532-545, 707-776 in index.html

### TASK D: Server Upload Validation (server.js)
**Changes Made:**
1. Enhanced logging in /upload endpoint
2. Added `ok: true` field for compatibility
3. Added `name` field alongside `filename`
4. Explicit JSON content-type on all responses
5. Detailed error logging with stack traces
6. Added logging to /uploads route for debugging CORS on static files

**Code Location:** Lines 80-148 in server.js

---

## CORS Validation Commands

### Test 1: OPTIONS Preflight for /upload
```bash
curl -i -X OPTIONS https://ws.ldawg7624.com/upload \
  -H "Origin: https://ldawg7624.com" \
  -H "Access-Control-Request-Method: POST" \
  -H "Access-Control-Request-Headers: Content-Type"
```

**Expected Response:**
- Status: `204 No Content`
- Headers MUST include:
  - `Access-Control-Allow-Origin: https://ldawg7624.com`
  - `Access-Control-Allow-Methods: GET, POST, OPTIONS`
  - `Access-Control-Allow-Headers: Content-Type`

### Test 2: POST to /upload with small file
```bash
# Create a test image
echo "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==" | base64 -d > /tmp/test.png

# Upload it
curl -i -X POST https://ws.ldawg7624.com/upload \
  -H "Origin: https://ldawg7624.com" \
  -F "file=@/tmp/test.png"
```

**Expected Response:**
- Status: `200 OK`
- Headers MUST include:
  - `Access-Control-Allow-Origin: https://ldawg7624.com`
  - `Content-Type: application/json`
- Body (JSON):
```json
{
  "success": true,
  "ok": true,
  "url": "/uploads/[filename].png",
  "name": "test.png",
  "filename": "test.png",
  "mime": "image/png",
  "size": 95,
  "isImage": true
}
```

### Test 3: GET uploaded file
```bash
curl -i -X GET https://ws.ldawg7624.com/uploads/[filename].png \
  -H "Origin: https://ldawg7624.com"
```

**Expected Response:**
- Status: `200 OK`
- Headers MUST include:
  - `Access-Control-Allow-Origin: https://ldawg7624.com` (or `*`)
  - `X-Content-Type-Options: nosniff`
  - `Content-Type: image/png`

---

## Frontend Testing Steps

### Test 1: Text Message Local Echo
**Steps:**
1. Open https://ldawg7624.com in browser
2. Open DevTools Console (F12)
3. Type a message in the text box
4. Click Send

**Expected Results:**
✅ Message appears in chat IMMEDIATELY (< 100ms)
✅ Message shows "Sending..." status initially
✅ Input box clears IMMEDIATELY
✅ After ~200-500ms, "Sending..." status disappears (server confirmed)
✅ Chat scrolls to bottom automatically
✅ Console shows: `Sending text message: [text]`

**FAILURE INDICATORS:**
❌ Delay before message appears
❌ Input doesn't clear immediately
❌ No "Sending..." status
❌ Message appears twice

### Test 2: Photo Upload CORS
**Steps:**
1. Open https://ldawg7624.com
2. Open DevTools Console + Network tab
3. Click "File" button
4. Select a photo (< 10MB)
5. Observe that preview appears but NO network request yet
6. Type a caption (optional)
7. Click Send
8. Watch Network tab

**Expected Results:**
✅ Preview appears immediately after file selection
✅ No upload until Send is clicked
✅ Network shows OPTIONS request with 204 response
✅ Network shows POST to /upload with 200 response
✅ POST response has `Content-Type: application/json`
✅ No CORS errors in console
✅ Image appears in chat with caption
✅ Console shows: `Photo selected: [filename] [size]`
✅ Console shows: `Upload result: {success: true, ...}`

**FAILURE INDICATORS:**
❌ CORS error: `Access to fetch... has been blocked by CORS policy`
❌ Upload happens immediately on file select
❌ No preview shown
❌ Console error: `expected JSON but got: ...`

### Test 3: Photo Composer UX
**Steps:**
1. Click "File" or "Camera" button
2. Select/capture a photo
3. Observe preview UI
4. Type a caption
5. Click "Remove" button

**Expected Results:**
✅ Preview box appears above input
✅ Shows thumbnail image
✅ Shows filename and size
✅ Input placeholder changes to "Type your message or caption"
✅ Remove button clears preview and does NOT upload
✅ Can still send text messages without photo

**Test 3b: Send with photo**
1. Select photo again
2. Type caption
3. Click Send

**Expected Results:**
✅ Upload happens now (network request)
✅ Message appears with image + caption
✅ Preview box disappears
✅ Input clears
✅ Can select another photo for next message

---

## Server Logs to Check

When testing, SSH into the Pi and run:
```bash
# Watch logs in real-time
pm2 logs kennedy-chat --lines 50

# Or if running directly:
tail -f /path/to/server.log
```

**Expected Log Entries:**

### On OPTIONS /upload:
```
[CORS] OPTIONS /upload - Origin: https://ldawg7624.com
[CORS] OPTIONS preflight - Origin: https://ldawg7624.com - Status: 204
```

### On POST /upload:
```
[CORS] POST /upload - Origin: https://ldawg7624.com
[UPLOAD] Received upload request from origin: https://ldawg7624.com
[UPLOAD] Success: camera-1234567890.jpg (152340 bytes, image/jpeg)
[UPLOAD] Returning URL: /uploads/abc123def456.jpg
```

### On GET /uploads/[file]:
```
[CORS] GET /uploads/abc123def456.jpg - Origin: https://ldawg7624.com
[UPLOADS] GET request for abc123def456.jpg from origin: https://ldawg7624.com
[UPLOADS] Serving file: abc123def456.jpg (image)
```

---

## Common Issues & Fixes

### Issue: CORS error persists
**Causes:**
1. Cloudflare tunnel might cache responses
2. Browser cached the failed preflight

**Fixes:**
1. Restart the Node server: `pm2 restart kennedy-chat`
2. Clear browser cache (Ctrl+Shift+Delete)
3. Hard refresh (Ctrl+F5)
4. Check Cloudflare tunnel config doesn't strip headers

### Issue: Message doesn't appear locally
**Causes:**
1. WebSocket not connected
2. JavaScript error in sendMessage()

**Fixes:**
1. Check console for errors
2. Verify `ws.readyState === WebSocket.OPEN`
3. Check server logs for connection

### Issue: Upload returns HTML instead of JSON
**Causes:**
1. Cloudflare tunnel error page
2. Server crashed/not running
3. Wrong endpoint URL

**Fixes:**
1. Verify server is running: `pm2 status`
2. Test directly: `curl http://localhost:8080/upload`
3. Check Cloudflare tunnel status

---

## Verification Checklist

Before marking as COMPLETE, verify ALL of these:

- [ ] Text message appears instantly when Send is clicked
- [ ] Text input clears immediately
- [ ] Console shows NO CORS errors
- [ ] Network tab shows OPTIONS 204 → POST 200 for uploads
- [ ] Photo preview appears before upload
- [ ] Can type caption with photo attached
- [ ] Remove button works without uploading
- [ ] Upload only happens when Send is clicked
- [ ] Image appears in chat with caption
- [ ] Server logs show correct CORS headers
- [ ] No "expected JSON but got" errors
- [ ] Multiple messages work correctly
- [ ] Works on both desktop and mobile browsers

---

## Files Changed

1. **server.js** - Lines 22-48, 80-148
2. **index.html** - Lines 222-288 (CSS), 469-484 (HTML), 530-776 (JavaScript)

Total changes: ~300 lines modified/added
