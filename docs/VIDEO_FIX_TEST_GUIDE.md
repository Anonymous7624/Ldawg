# Desktop Video Recording Fix - Test Guide

## Quick Test (30 seconds)

### Test 1: Basic Video Recording
1. Open the chat app in Chrome/Edge on desktop
2. Click the media button (📎)
3. Select **Video**
4. Choose **1080p (10s)** or **720p (30s)**
5. **Expected**: Camera preview appears (NOT "No camera found" error)
6. Click **Start Recording**
7. Record for a few seconds
8. Click **Stop Recording**
9. **Expected**: Video appears in composer, can send it

### Test 2: Stream Reuse (Photo → Video)
1. Click media button → **Photo**
2. Camera opens successfully
3. Take a photo (or just close the modal)
4. Click media button → **Video** → Choose quality
5. **Expected**: Camera preview appears instantly
6. Check browser console for: `[VIDEO] Reusing existing camera stream from photo mode`

### Test 3: Audio Fallback
1. Block microphone permission in browser (but allow camera)
   - Chrome: Click 🔒 in address bar → Site settings → Microphone → Block
2. Click media button → **Video** → Choose quality
3. **Expected**: Video preview appears (video-only mode, no error)
4. Check console for: `[VIDEO] ✓ Success with video only (no audio)`

## Error Message Tests

### Test 4: Permission Denied
1. Block camera permission in browser
2. Try to record video
3. **Expected**: "Camera permission denied" (NOT "No camera found")

### Test 5: Camera Busy
1. Open camera in another app (Zoom, Teams, etc.)
2. Try to record video
3. **Expected**: "Camera is busy in another app" (NOT "No camera found")

### Test 6: No Camera (actual)
1. Disable/disconnect all cameras
2. Try to record video
3. **Expected**: NOW it should say "No camera found - please connect a camera"

## Console Log Verification

Open browser DevTools (F12) → Console tab

### Success Path Logs
```
[VIDEO] Starting video recording flow...
[VIDEO] Attempt A: getUserMedia({ video: true, audio: true })
[VIDEO] ✓ Success with video + audio
[VIDEO] Applying resolution constraints: {width: 1920, height: 1080}
[VIDEO] Applied constraints. Stream settings: {width: 1920, height: 1080, frameRate: 30, ...}
[VIDEO] Selected mimeType: video/webm;codecs=vp9,opus
```

### Stream Reuse Logs
```
[VIDEO] Starting video recording flow...
[VIDEO] Reusing existing camera stream from photo mode
[VIDEO] Applied resolution constraints. New settings: {width: 1920, height: 1080, ...}
```

### Audio Fallback Logs
```
[VIDEO] Attempt A: getUserMedia({ video: true, audio: true })
[VIDEO] Attempt A failed: NotAllowedError - Permission denied
[VIDEO] Full error object: DOMException {...}
[VIDEO] Attempt B: getUserMedia({ video: true, audio: false })
[VIDEO] ✓ Success with video only (no audio)
```

## Photo Mode Regression Test

### Test 7: Photo Still Works
1. Click media button → **Photo**
2. Camera opens
3. Take a photo
4. **Expected**: Works exactly as before, no changes

## Browser Compatibility

### Recommended Test Browsers (Desktop)
- ✅ Chrome/Edge (Windows/Mac/Linux) - Primary target
- ✅ Firefox (Windows/Mac/Linux)
- ⚠️ Safari (Mac) - May have limited codec support, should fallback gracefully

### Mobile (Should Not Change)
- iPhone Safari → Still uses native video picker
- Android Chrome → Should work with custom recorder

## Common Issues

### If video still doesn't work:
1. **Check browser console** for exact error messages
2. **Verify camera works** in other apps
3. **Check permissions**: Settings → Privacy → Camera
4. **Try different browser** (Chrome usually has best WebRTC support)
5. **Check codec support**: Open console and run:
   ```javascript
   ['video/webm;codecs=vp9,opus', 'video/webm;codecs=vp8,opus', 'video/webm']
     .map(m => `${m}: ${MediaRecorder.isTypeSupported(m)}`)
   ```

### If photo breaks:
1. Check if `openCamera()` function was accidentally modified
2. Look for `cameraStream` variable issues
3. Verify line 3562-3565 unchanged:
   ```javascript
   cameraStream = await navigator.mediaDevices.getUserMedia({ 
     video: { facingMode: 'user' },
     audio: false 
   });
   ```

## What Changed vs. What Didn't

### ✅ Changed (Video Recording Only)
- `startVideoRecording()` - Complete rewrite with stream reuse + fallbacks
- `beginVideoRecording()` - MediaRecorder mimeType selection improved

### ❌ NOT Changed (Should Work Exactly As Before)
- `openCamera()` - Photo mode entry point
- `capturePhoto()` - Photo capture logic
- `closeCamera()` - Cleanup (works for both photo/video)
- All upload/backend logic
- iOS/mobile behavior

## Pass Criteria

✅ **PASS** if:
- Desktop video recording works without false "No camera found" errors
- Stream reuse from photo mode works
- Audio issues don't block video recording
- Error messages are accurate and helpful
- Photo capture still works perfectly
- Console shows proper diagnostic logs

❌ **FAIL** if:
- Still shows "No camera found" when camera exists
- Photo capture is broken
- Backend/upload issues appear
- Mobile/iPhone behavior changed unexpectedly
