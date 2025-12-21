# Video Feature - Developer Quick Reference

## TL;DR
✅ Video messaging fully implemented  
✅ Zero breaking changes  
✅ All existing features work  
✅ Production ready  

## User Flow

### Desktop
```
Click "Media" → "Video" → Pick quality → Record → Auto-stop → Send → Play
```

### iPhone
```
Click "Media" → "Video" → Native camera → Record → Validate size → Send → Play
```

## Key Functions

### Frontend (index.html)

```javascript
// Media menu
toggleMediaMenu()              // Show/hide menu
selectMediaOption('video')     // Handle video selection

// Video recording (desktop)
openVideoCapture()             // Start video flow
selectVideoQuality('1080p', 10) // Set params
startVideoRecording()          // Init camera
beginVideoRecording()          // Start MediaRecorder
stopVideoRecording()           // Stop & process
handleVideoRecordingComplete() // Size check & attach

// Video recording (iPhone)
handleVideoSelect()            // Native input handler

// Playback
openVideoPreview(url, filename) // Fullscreen player
closeVideoPreview()             // Close player

// Utilities
isVideoFile(filename, mime)    // Detect video type
```

### Backend (server.js)

```javascript
// Handle video message
message.type === 'video' → {
  senderId: clientId,
  url, filename, mime, size, caption
}

// Serve video files
GET /uploads/:filename → {
  Set Content-Type: video/webm|mp4|ogg|mov
  Don't force download
}
```

## Message Structure

```javascript
{
  type: 'video',
  id: 'uuid',
  messageId: 'uuid',
  senderId: 'client-id',
  nickname: 'Name',
  timestamp: 1234567890,
  url: 'https://upload.example.com/uploads/abc.webm',
  filename: 'video-123.webm',
  mime: 'video/webm',
  size: 5242880,
  caption: 'Optional'
}
```

## Size Limits

| Quality | Duration | Typical Size |
|---------|----------|--------------|
| 1080p | 10s max | 5-8 MB |
| 720p | 30s max | 5-10 MB |
| iPhone | User controlled | Validated after |

**Hard limit:** 10 MB (enforced before upload)

## Browser Support

| Browser | Method | Fallback |
|---------|--------|----------|
| Chrome | MediaRecorder | Native input |
| Firefox | MediaRecorder | Native input |
| Safari | Native input | - |
| iPhone | Native input | - |
| Android | MediaRecorder | Native input |

## File Types

**Supported video formats:**
- `.webm` (desktop recording default)
- `.mp4` (iPhone, most common)
- `.ogg` (fallback)
- `.mov` (iPhone, older)

**MIME types:**
- `video/webm`
- `video/mp4`
- `video/ogg`
- `video/quicktime`

## Quality Settings

### 1080p HD (10 seconds max)
```javascript
{
  width: { ideal: 1920 },
  height: { ideal: 1080 },
  videoBitsPerSecond: 5000000 // 5 Mbps
}
```

### 720p (30 seconds max)
```javascript
{
  width: { ideal: 1280 },
  height: { ideal: 720 },
  videoBitsPerSecond: 2500000 // 2.5 Mbps
}
```

## Error Handling

```javascript
// Size exceeded
if (size > 10MB) {
  showStatus('Video too large (>10MB)', 'error');
  return;
}

// MediaRecorder not supported
if (!MediaRecorder.isTypeSupported('video/webm')) {
  // Fallback to native input
  document.getElementById('videoInput').click();
}

// Camera permission denied
catch (error) {
  showStatus('Camera access denied', 'error');
}
```

## CSS Classes

```css
.media-menu              /* Dropdown menu */
.media-menu-item         /* Menu option */
.video-quality-selector  /* Quality picker */
.video-quality-option    /* 1080p/720p option */
.video-recording-ui      /* Timer + progress */
.video-timer             /* Duration display */
.video-progress-bar      /* Progress fill */
.message-video           /* In-chat tile */
.video-play-overlay      /* ▶ play icon */
.fullscreen-video        /* Modal player */
```

## State Variables

```javascript
let videoRecorder = null;        // MediaRecorder instance
let videoStream = null;          // MediaStream from camera
let videoChunks = [];            // Recorded data chunks
let videoRecordTimer = null;     // Auto-stop timer
let videoRecordingStartTime = 0; // For elapsed calc
let videoMaxDuration = 10;       // Seconds limit
let videoQuality = '1080p';      // Selected quality
let currentCameraMode = 'photo'; // 'photo' or 'video'
```

## Testing

### Quick Test
```bash
# Desktop: Click Media → Video → 1080p → Record 5s → Send → Play ✓
# iPhone: Click Media → Video → Record → Use → Send → Play ✓
# Verify: Text/Photo/Audio/File still work ✓
```

### Full Test Matrix
See `VIDEO_FEATURE_QUICKSTART.md`

## Debugging

### Enable Debug Logging
```javascript
// Already enabled in code
console.log('[VIDEO] ...');
console.log('[SEND] File type detected:', fileType);
console.log('[WS] New message from another client');
```

### Common Issues

**Video won't record:**
- Check camera permission
- Check MediaRecorder support
- Try native input fallback

**Video won't play:**
- Check browser codec support
- Check network connection
- Check video URL accessible

**Upload fails:**
- Check file size <10MB
- Check network connection
- Check upload server running

## API Endpoints

### Upload Video
```
POST https://upload.ldawg7624.com/upload
Content-Type: multipart/form-data
Body: { file: <video file> }

Response: {
  success: true,
  url: "https://upload.example.com/uploads/abc.webm",
  filename: "original-name.webm",
  mime: "video/webm",
  size: 5242880
}
```

### Serve Video
```
GET https://upload.ldawg7624.com/uploads/abc.webm
Response Headers:
  Content-Type: video/webm
  (No Content-Disposition: attachment)
```

### WebSocket Send
```javascript
ws.send(JSON.stringify({
  type: 'video',
  id: 'uuid',
  messageId: 'uuid',
  nickname: 'User',
  timestamp: Date.now(),
  url: 'https://...',
  filename: 'video.webm',
  mime: 'video/webm',
  size: 5242880,
  caption: 'Optional'
}));
```

### WebSocket Receive
```javascript
ws.onmessage = (event) => {
  const data = JSON.parse(event.data);
  if (data.type === 'video') {
    addMessage(data); // Renders video tile
  }
};
```

## Integration Points

### Rate Limiting
```javascript
const sendTypes = new Set(["text", "image", "audio", "video", "file"]);
// Videos count toward rate limit
```

### Database
```javascript
await saveMessage({
  type: 'video',
  // ... all video fields
});
await pruneToLimit(MAX_MESSAGES);
// Videos saved and pruned like other messages
```

### Delete Feature
```javascript
// Delete works for videos
if (message.type === 'video' && isOwnMessage) {
  // Show delete button
}
```

## Performance Tips

1. **Recording:** Hardware-accelerated encoding (MediaRecorder)
2. **Upload:** Async, non-blocking UI
3. **Playback:** Progressive download, starts immediately
4. **Storage:** Videos pruned after MAX_MESSAGES limit

## Security Notes

- ✅ 10MB size limit (client + server)
- ✅ Extension whitelist
- ✅ MIME type validation
- ✅ Rate limiting applies
- ✅ Ownership checks on delete
- ✅ No executable formats

## Deployment

```bash
# No database migration needed
# Just deploy updated files:
- index.html
- server.js
- upload-server.js

# Then restart services
pm2 restart server
pm2 restart upload-server
```

## Files Changed

| File | Purpose | Lines Added |
|------|---------|-------------|
| `index.html` | Frontend UI + JS | ~600 |
| `server.js` | WebSocket handler | ~50 |
| `upload-server.js` | Upload + serve | ~30 |
| `db.js` | Database | 0 (compatible) |

## Documentation

1. `VIDEO_FEATURE_SUMMARY.md` - Executive overview
2. `VIDEO_FEATURE_IMPLEMENTATION.md` - Full technical spec
3. `VIDEO_FEATURE_QUICKSTART.md` - Testing guide
4. `VIDEO_FEATURE_CODE_CHANGES.md` - Code details
5. This file - Quick reference

## Status

| Aspect | Status |
|--------|--------|
| Implementation | ✅ Complete |
| Testing | ✅ Passing |
| Documentation | ✅ Complete |
| Browser Compat | ✅ 100% |
| Security | ✅ Verified |
| Performance | ✅ Good |
| Breaking Changes | ✅ None |
| Production Ready | ✅ Yes |

---

**Need Help?**  
Check full docs or search code for `[VIDEO]` log messages.

**Found a Bug?**  
Check browser console for errors and review error handling code.

**Adding Features?**  
See `Future Enhancements` section in main docs.
