# Video Message Handling - Manual Test Checklist

## Prerequisites
- Upload server running on port 8082 (or configured URL)
- Chat server running on port 8080 (or configured URL)  
- Two browser windows/devices for testing sender and receiver

## Test 1: Desktop Video Recording
**Goal:** Verify desktop video capture is sent as video, not audio

1. [ ] Open chat in Browser 1
2. [ ] Click the media menu button (camera/mic icon)
3. [ ] Select "Record Desktop Video"
4. [ ] Allow screen sharing permission
5. [ ] Record 2-3 seconds of desktop activity
6. [ ] Stop recording
7. [ ] Video should appear in composer with filename and size
8. [ ] Add optional caption (e.g., "Desktop test")
9. [ ] Click Send
10. [ ] **Expected in Browser 1:**
    - Message shows with video thumbnail
    - Has play button overlay
    - Clicking opens fullscreen player with controls
    - Timeline scrubber is visible
    - NOT an audio player
11. [ ] Open chat in Browser 2
12. [ ] **Expected in Browser 2:**
    - Same video message appears
    - Renders as video (not audio)
    - Clicking opens fullscreen player
    - Can play, pause, seek, adjust volume

**Pass criteria:** Video is rendered with `<video>` element and fullscreen player, NOT as `<audio>` element

---

## Test 2: Upload .webm Video File
**Goal:** Verify uploaded .webm videos are not misidentified as audio

1. [ ] Create/download a small .webm video file (< 10MB)
2. [ ] In Browser 1, click "Attach Photo/File"
3. [ ] Select the .webm video file
4. [ ] File should appear in composer showing size
5. [ ] Click Send
6. [ ] **Expected:** Renders as video with player (not audio)
7. [ ] In Browser 2, verify message appears as video
8. [ ] Click to open fullscreen player
9. [ ] Verify video plays correctly with controls

**Pass criteria:** .webm video file is sent and rendered as video type

---

## Test 3: Upload .mp4 Video File
**Goal:** Verify .mp4 videos work correctly

1. [ ] Create/download a small .mp4 video file (< 10MB)
2. [ ] In Browser 1, click "Attach Photo/File"
3. [ ] Select the .mp4 video file
4. [ ] Click Send
5. [ ] **Expected:** Renders as video player
6. [ ] In Browser 2, verify video appears correctly
7. [ ] Click to play video in fullscreen

**Pass criteria:** .mp4 video is sent and rendered as video

---

## Test 4: Audio Recording Still Works
**Goal:** Verify audio messages are NOT broken by the fix

1. [ ] In Browser 1, click "Record Audio" button (microphone)
2. [ ] Allow microphone permission
3. [ ] Record 2-3 seconds of audio
4. [ ] Stop recording
5. [ ] Add optional caption
6. [ ] Click Send
7. [ ] **Expected in Browser 1:**
    - Message shows as "Voice message"
    - Has audio player with play button
    - NOT a video player
8. [ ] In Browser 2, verify audio message appears
9. [ ] Click play on audio player
10. [ ] Audio should play correctly

**Pass criteria:** Audio messages still render with `<audio>` element and play correctly

---

## Test 5: Upload Audio File
**Goal:** Verify uploaded audio files are still handled as audio

1. [ ] Create/download a small .mp3 audio file (< 10MB)
2. [ ] In Browser 1, click "Attach Photo/File"
3. [ ] Select the .mp3 file
4. [ ] Click Send
5. [ ] **Expected:** Renders as audio player (not video)
6. [ ] In Browser 2, verify audio player appears
7. [ ] Click play and verify audio works

**Pass criteria:** Audio files render as audio, not video

---

## Test 6: Video Size Limit (10MB)
**Goal:** Verify videos > 10MB are blocked

1. [ ] Create or find a video file > 10MB in size
2. [ ] Try to upload via "Attach Photo/File"
3. [ ] **Expected:** Error message appears:
    - "File size must be less than 10MB"
4. [ ] File should NOT be uploaded
5. [ ] No message sent

**Pass criteria:** Large videos are blocked with clear error

---

## Test 7: Video from History
**Goal:** Verify videos in chat history render correctly

1. [ ] Send a video message (from Test 1 or 2)
2. [ ] Close Browser 1 completely
3. [ ] Reopen Browser 1 and load chat
4. [ ] **Expected:** Video message loads from history
5. [ ] Should render as video (not audio)
6. [ ] Should be clickable to open fullscreen

**Pass criteria:** Videos persist and render correctly after reload

---

## Test 8: Network Response Inspection
**Goal:** Verify server returns correct metadata

1. [ ] Open Browser DevTools → Network tab
2. [ ] Upload a video file
3. [ ] Find the POST request to `/upload`
4. [ ] Check response JSON
5. [ ] **Expected response fields:**
    ```json
    {
      "success": true,
      "ok": true,
      "url": "https://...",
      "mime": "video/webm" (or video/mp4, etc.),
      "isVideo": true,
      "isAudio": false,
      "isImage": false,
      "size": 12345,
      "filename": "video-123.webm"
    }
    ```
6. [ ] Find the WebSocket message sent after upload
7. [ ] **Expected WS message:**
    ```json
    {
      "type": "video",
      "url": "https://...",
      "mime": "video/webm",
      "filename": "video-123.webm",
      "size": 12345,
      "id": "...",
      "nickname": "...",
      "timestamp": 123456789
    }
    ```

**Pass criteria:** Server response has `isVideo: true`, WS message has `type: "video"`

---

## Test 9: Mixed Messages
**Goal:** Verify all message types coexist correctly

1. [ ] Send text message
2. [ ] Send image
3. [ ] Send audio recording
4. [ ] Send video file
5. [ ] Send another text message
6. [ ] **Expected in Browser 2:**
    - All messages appear in correct order
    - Text = text content
    - Image = clickable image
    - Audio = audio player
    - Video = video player (NOT audio)
7. [ ] Click each media type to verify correct behavior

**Pass criteria:** All message types render correctly side-by-side

---

## Test 10: Existing Features Not Broken
**Goal:** Verify no regression in other features

- [ ] Text formatting (bold, italic, code) still works
- [ ] Image upload and preview still works
- [ ] Photo camera capture still works
- [ ] Delete message button appears on own messages
- [ ] Delete message removes message for all users
- [ ] Nickname colors work correctly
- [ ] Typing indicators work
- [ ] Online count updates
- [ ] Rate limiting still active

**Pass criteria:** No existing features are broken

---

## Automated Test

Run the automated test script:

```bash
# Make sure upload server is running first
node test-video-fix.js
```

**Expected output:**
```
[TEST 1] Upload .webm file with video/webm MIME type
✓ PASS: isVideo flag is true
✓ PASS: isAudio flag is false
✓ PASS: MIME type is video/*

[TEST 2] Upload .webm file with audio/webm MIME type
✓ PASS: isAudio flag is true
✓ PASS: isVideo flag is false

✓ ALL TESTS PASSED
```

---

## Summary

After completing all tests, verify:

✅ Videos are sent as `type: "video"` (not `"audio"`)  
✅ Videos render with `<video>` element and timeline controls  
✅ Clicking videos opens fullscreen player  
✅ Audio messages still work correctly as audio  
✅ Server returns `isVideo: true` for videos  
✅ Server returns `isAudio: true` for audio  
✅ Size limits enforced (10MB)  
✅ No regression in existing features  

**If all tests pass, the video bug is FIXED! 🎉**
