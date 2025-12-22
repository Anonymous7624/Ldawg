# Quick Test Checklist - Media Menu & Video Capture Fixes

## Fix A: Media Menu (No Emojis) ✓

**How to verify:**
1. Open the app
2. Look at the message input area
3. Click the "Media" button
4. **Expected:** Menu shows:
   - Photo
   - Video  
   - File
5. **Verify:** NO emojis (📷 🎥 📁) in the text

---

## Fix B: PC Video Capture ✓

**How to verify:**
1. Open the app on a **desktop PC** with webcam
2. Click "Media" → "Video"
3. Select a quality (1080p or 720p)
4. **Expected:** Camera preview appears (no "Requested device not found" error)
5. Click "Start Recording"
6. Record for 3-5 seconds
7. Click "Stop Recording"
8. **Expected:** Video uploads successfully and appears in chat

**Check browser console (F12) for:**
- `[VIDEO] Enumerated devices:` (shows camera detection)
- `[VIDEO] Desktop detected` (confirms desktop mode)
- `[VIDEO] ✓ Success with ideal constraints` (or fallback attempts)
- NO errors about "NotFoundError" or "Requested device not found"

---

## Existing Features (Should Still Work) ✓

Quick smoke test:

- [ ] Send a text message (colors should work - your messages green, others blue)
- [ ] Upload a photo (Media → Photo)
- [ ] Record audio (Audio Message button)
- [ ] Delete your own message (trash icon on your messages)
- [ ] Reload page (history should load)
- [ ] Send 5 messages quickly (rate limit should trigger)

---

## What Changed

**index.html only** - 2 targeted changes:
1. Removed emojis from 3 menu items (lines 1358-1360)
2. Replaced video capture function with robust version (lines 3118-3247)

**server.js unchanged**

---

## If Video Capture Fails

Check console for fallback attempts:
- Attempt 1: Ideal quality (1080p/720p)
- Attempt 2: Simplified constraints
- Attempt 3: Generic video: true

If all 3 fail, you'll see a clear error message explaining why.
