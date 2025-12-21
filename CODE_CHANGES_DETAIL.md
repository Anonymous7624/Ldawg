# Code Changes - Media Composer Unification

## Summary of Changes

This document provides a detailed breakdown of all code changes made to fix the 3 media composer UX bugs.

---

## 1. HTML Structure Changes (index.html)

### Removed: Separate Audio Draft UI (Line ~1243)
```html
<!-- BEFORE -->
<div id="audioDraft" class="audio-draft">
  <div class="audio-draft-header">Voice Message Draft</div>
  <audio id="audioDraftPlayer" controls></audio>
  <textarea id="audioCaptionInput" ...></textarea>
  <div class="audio-draft-controls">
    <button onclick="sendAudioDraft()">Send</button>
    <button onclick="discardAudioDraft()">Discard</button>
  </div>
</div>

<!-- AFTER -->
<!-- Removed entirely - now uses unified composer below -->
```

### Updated: Unified Media Composer (Lines 1258-1280)
```html
<!-- BEFORE -->
<div id="photoComposer" class="photo-composer">
  <div class="composer-header">
    <span>Photo Attached</span>
    <button onclick="removePhotoAttachment()">Remove</button>
  </div>
  <div class="composer-preview">
    <img id="previewImage" src="" alt="Preview">
    <div class="preview-details">
      <div id="previewFilename"></div>
      <div id="previewSize"></div>
    </div>
  </div>
</div>

<!-- AFTER -->
<div id="photoComposer" class="photo-composer">
  <div class="composer-header">
    <span id="mediaTypeLabel">Media Attached</span>  <!-- Dynamic label -->
    <button onclick="removePhotoAttachment()">Remove</button>
  </div>
  <div class="composer-preview">
    <!-- Image preview -->
    <img id="previewImage" src="" style="display: none;">
    
    <!-- Video preview (NEW) -->
    <video id="previewVideo" controls style="display: none; max-width: 200px;"></video>
    
    <!-- Audio preview (NEW) -->
    <audio id="previewAudio" controls style="display: none; width: 100%;"></audio>
    
    <div class="preview-details">
      <div id="previewFilename"></div>
      <div id="previewSize"></div>
    </div>
  </div>
</div>
```

---

## 2. JavaScript Changes (index.html)

### Updated: capturePhoto() - Show Preview Before Send (Lines 3620-3673)
```javascript
// BEFORE
function capturePhoto() {
  // ... canvas drawing code ...
  canvas.toBlob((blob) => {
    selectedFile = file;
    previewURL = URL.createObjectURL(file);
    
    previewImg.src = previewURL;
    previewFilename.textContent = file.name;
    previewSize.textContent = formatFileSize(file.size);
    
    composer.classList.add('active');
    closeCamera();
    document.getElementById('composer').focus();
  }, 'image/jpeg', 0.8);
}

// AFTER
function capturePhoto() {
  // ... canvas drawing code ...
  canvas.toBlob((blob) => {
    selectedFile = file;
    previewURL = URL.createObjectURL(file);
    
    // Get all preview elements
    const previewImg = document.getElementById('previewImage');
    const previewVideo = document.getElementById('previewVideo');
    const previewAudio = document.getElementById('previewAudio');
    const mediaTypeLabel = document.getElementById('mediaTypeLabel');
    
    // Hide other media types
    previewVideo.style.display = 'none';
    previewAudio.style.display = 'none';
    
    // Show image preview
    previewImg.style.display = 'block';
    previewImg.src = previewURL;
    previewFilename.textContent = file.name;
    previewSize.textContent = formatFileSize(file.size);
    mediaTypeLabel.textContent = 'Photo Attached';
    
    composer.classList.add('active');
    closeCamera();
    document.getElementById('composer').focus();
  }, 'image/jpeg', 0.8);
}
```

### Updated: handleVideoRecordingComplete() - Show Video Preview (Lines 3326-3377)
```javascript
// BEFORE
function handleVideoRecordingComplete() {
  const blob = new Blob(videoChunks, { type: 'video/webm' });
  const file = new File([blob], `video-${Date.now()}.webm`, { type: 'video/webm' });
  selectedFile = file;
  previewURL = URL.createObjectURL(file);
  
  // Show in composer
  previewImg.style.display = 'none'; // Don't show video thumbnail
  previewFilename.textContent = file.name;
  previewSize.textContent = formatFileSize(file.size);
  
  composer.classList.add('active');
  closeCamera();
}

// AFTER
async function handleVideoRecordingComplete() {
  const blob = new Blob(videoChunks, { type: 'video/webm' });
  const file = new File([blob], `video-${Date.now()}.webm`, { type: 'video/webm' });
  selectedFile = file;
  previewURL = URL.createObjectURL(file);
  
  // Get all preview elements
  const previewImg = document.getElementById('previewImage');
  const previewVideo = document.getElementById('previewVideo');
  const previewAudio = document.getElementById('previewAudio');
  const mediaTypeLabel = document.getElementById('mediaTypeLabel');
  
  // Hide other media types
  previewImg.style.display = 'none';
  previewAudio.style.display = 'none';
  
  // Show video preview
  previewVideo.style.display = 'block';
  previewVideo.src = previewURL;
  previewFilename.textContent = file.name;
  previewSize.textContent = formatFileSize(file.size);
  mediaTypeLabel.textContent = 'Video Attached';
  
  // Add click handler for full preview
  previewVideo.onclick = () => openVideoPreview(previewURL);
  
  composer.classList.add('active');
  closeCamera();
}
```

### Updated: handleVideoSelect() - Show Video Preview for Uploads (Lines 3378-3429)
```javascript
// BEFORE
function handleVideoSelect() {
  const file = videoInput.files[0];
  if (!file) return;
  
  selectedFile = file;
  previewURL = URL.createObjectURL(file);
  
  previewImg.style.display = 'none';
  previewFilename.textContent = file.name;
  previewSize.textContent = formatFileSize(file.size);
  
  composer.classList.add('active');
}

// AFTER
async function handleVideoSelect() {
  const file = videoInput.files[0];
  if (!file) return;
  
  selectedFile = file;
  previewURL = URL.createObjectURL(file);
  
  // Get all preview elements
  const previewImg = document.getElementById('previewImage');
  const previewVideo = document.getElementById('previewVideo');
  const previewAudio = document.getElementById('previewAudio');
  const mediaTypeLabel = document.getElementById('mediaTypeLabel');
  
  // Hide other media types
  previewImg.style.display = 'none';
  previewAudio.style.display = 'none';
  
  // Show video preview
  previewVideo.style.display = 'block';
  previewVideo.src = previewURL;
  previewFilename.textContent = file.name;
  previewSize.textContent = formatFileSize(file.size);
  mediaTypeLabel.textContent = 'Video Attached';
  
  // Add click handler for full preview
  previewVideo.onclick = () => openVideoPreview(previewURL);
  
  composer.classList.add('active');
}
```

### Updated: handleFileSelect() - Detect All Media Types (Lines 3430-3528)
```javascript
// BEFORE
function handleFileSelect() {
  const file = fileInput.files[0];
  // ... validation ...
  
  selectedFile = file;
  previewURL = URL.createObjectURL(file);
  
  if (isImageFile(file.name, file.type)) {
    previewImg.src = previewURL;
    previewImg.style.display = 'block';
  } else {
    previewImg.style.display = 'none';
  }
  
  previewFilename.textContent = file.name;
  previewSize.textContent = formatFileSize(file.size);
  composer.classList.add('active');
}

// AFTER
async function handleFileSelect() {
  const file = fileInput.files[0];
  // ... validation ...
  
  selectedFile = file;
  previewURL = URL.createObjectURL(file);
  
  // Get all preview elements
  const previewImg = document.getElementById('previewImage');
  const previewVideo = document.getElementById('previewVideo');
  const previewAudio = document.getElementById('previewAudio');
  const mediaTypeLabel = document.getElementById('mediaTypeLabel');
  
  // Determine file type
  const isImage = isImageFile(file.name, file.type);
  const isVideo = isVideoFile(file.name, file.type);
  const isAudio = isAudioFile(file.name, file.type);
  
  // Hide all preview types first
  previewImg.style.display = 'none';
  previewVideo.style.display = 'none';
  previewAudio.style.display = 'none';
  
  if (isImage) {
    previewImg.style.display = 'block';
    previewImg.src = previewURL;
    previewImg.onclick = () => openImagePreview(previewURL);
    mediaTypeLabel.textContent = 'Photo Attached';
  } else if (isVideo) {
    previewVideo.style.display = 'block';
    previewVideo.src = previewURL;
    previewVideo.onclick = () => openVideoPreview(previewURL);
    mediaTypeLabel.textContent = 'Video Attached';
  } else if (isAudio) {
    previewAudio.style.display = 'block';
    previewAudio.src = previewURL;
    mediaTypeLabel.textContent = 'Audio Attached';
  } else {
    mediaTypeLabel.textContent = 'File Attached';
  }
  
  previewFilename.textContent = file.name;
  previewSize.textContent = formatFileSize(file.size);
  composer.classList.add('active');
}
```

### Updated: createAudioDraft() - Use Unified Composer (Lines 2911-2957)
```javascript
// BEFORE
function createAudioDraft(blob) {
  audioDraftBlob = blob;
  audioDraftURL = URL.createObjectURL(blob);
  
  const draftDiv = document.getElementById('audioDraft');
  const player = document.getElementById('audioDraftPlayer');
  const captionInput = document.getElementById('audioCaptionInput');
  
  player.src = audioDraftURL;
  captionInput.value = '';
  
  draftDiv.classList.add('active');
  resetAudioButton();
}

// AFTER
function createAudioDraft(blob) {
  audioDraftBlob = blob;
  audioDraftURL = URL.createObjectURL(blob);
  
  // Create file attachment
  const ext = blob.type.includes('ogg') ? 'ogg' : 'webm';
  const file = new File([blob], `audio-${Date.now()}.${ext}`, { type: blob.type });
  selectedFile = file;
  
  if (previewURL) {
    URL.revokeObjectURL(previewURL);
  }
  previewURL = audioDraftURL;
  
  // Show in unified media composer
  const composer = document.getElementById('photoComposer');
  const previewImg = document.getElementById('previewImage');
  const previewVideo = document.getElementById('previewVideo');
  const previewAudio = document.getElementById('previewAudio');
  const previewFilename = document.getElementById('previewFilename');
  const previewSize = document.getElementById('previewSize');
  const mediaTypeLabel = document.getElementById('mediaTypeLabel');
  
  // Hide other media types
  previewImg.style.display = 'none';
  previewVideo.style.display = 'none';
  
  // Show audio preview
  previewAudio.style.display = 'block';
  previewAudio.src = audioDraftURL;
  previewFilename.textContent = file.name;
  previewSize.textContent = formatFileSize(blob.size);
  mediaTypeLabel.textContent = 'Voice Message';
  
  composer.classList.add('active');
  document.getElementById('composer').focus();
  
  resetAudioButton();
}
```

### Removed: sendAudioDraft() - Now Uses Unified sendMessage() (Lines 2970+)
```javascript
// BEFORE
async function sendAudioDraft() {
  // ... separate upload logic ...
  // ... separate message sending ...
}

// AFTER
// REMOVED: sendAudioDraft() - Audio now uses unified sendMessage() flow
// Audio attachments are created in createAudioDraft() and sent via the main sendMessage() function
```

### Updated: discardAudioDraft() - Use Unified Removal (Lines 2959-2968)
```javascript
// BEFORE
function discardAudioDraft() {
  if (audioDraftURL) {
    URL.revokeObjectURL(audioDraftURL);
    audioDraftURL = null;
  }
  audioDraftBlob = null;
  
  const draftDiv = document.getElementById('audioDraft');
  draftDiv.classList.remove('active');
  document.getElementById('audioCaptionInput').value = '';
}

// AFTER
function discardAudioDraft() {
  // Just use the unified removal function
  removePhotoAttachment();
  
  if (audioDraftURL) {
    URL.revokeObjectURL(audioDraftURL);
    audioDraftURL = null;
  }
  audioDraftBlob = null;
}
```

### Updated: removePhotoAttachment() - Clear All Media Types (Lines 3530-3554)
```javascript
// BEFORE
function removePhotoAttachment() {
  if (previewURL) {
    URL.revokeObjectURL(previewURL);
    previewURL = null;
  }
  selectedFile = null;
  document.getElementById('fileInput').value = '';
  
  const composer = document.getElementById('photoComposer');
  composer.classList.remove('active');
}

// AFTER
function removePhotoAttachment() {
  if (previewURL) {
    URL.revokeObjectURL(previewURL);
    previewURL = null;
  }
  
  selectedFile = null;
  document.getElementById('fileInput').value = '';
  document.getElementById('videoInput').value = '';
  
  // Clear all preview elements
  const previewImg = document.getElementById('previewImage');
  const previewVideo = document.getElementById('previewVideo');
  const previewAudio = document.getElementById('previewAudio');
  
  previewImg.src = '';
  previewImg.style.display = 'none';
  previewVideo.src = '';
  previewVideo.style.display = 'none';
  previewAudio.src = '';
  previewAudio.style.display = 'none';
  
  const composer = document.getElementById('photoComposer');
  composer.classList.remove('active');
}
```

---

## 3. Server Changes (server.js)

### Updated: Audio Message Handler - Add Caption Support (Lines 547-580)
```javascript
// BEFORE
} else if (message.type === 'audio') {
  const nickname = (message.nickname || 'Anonymous').substring(0, 100);

  const chatMessage = {
    type: 'audio',
    id: msgId,
    senderId: info.clientId,
    nickname,
    timestamp: message.timestamp || Date.now(),
    url: message.url
  };

  // ... ACK and save logic ...
  
  broadcast(chatMessage);
  console.log(`[MESSAGE] Audio from ${nickname}: ${message.url}`);
}

// AFTER
} else if (message.type === 'audio') {
  const nickname = (message.nickname || 'Anonymous').substring(0, 100);
  const caption = message.caption || '';  // NEW: Extract caption

  const chatMessage = {
    type: 'audio',
    id: msgId,
    senderId: info.clientId,
    nickname,
    timestamp: message.timestamp || Date.now(),
    url: message.url,
    caption: caption  // NEW: Include caption in message
  };

  // ... ACK and save logic ...
  
  broadcast(chatMessage);
  console.log(`[MESSAGE] Audio from ${nickname}: ${message.url} (caption: "${caption.substring(0, 50)}")`);
}
```

---

## Key Points

1. **Unified Composer**: All media types now use the same preview card with dynamic content
2. **Single Send Flow**: All media types go through `sendMessage()` via `selectedFile`
3. **Caption Support**: Audio captions are extracted from the normal message box, stored server-side, and broadcast to all users
4. **Preview Elements**: Photo, video, and audio each have their own preview element, hidden/shown as needed
5. **Backward Compatibility**: All existing features (chat, ACKs, uploads, playback, delete, etc.) remain intact

---

## Testing

Run automated tests:
```bash
node test-media-composer.js
```

All 31 tests should pass, validating:
- Unified composer structure
- Photo capture preview
- Video preview (upload + capture)
- Audio unified flow
- Caption persistence
- Single send button
- Cleanup functions
- File type detection
