# Code Changes Summary - Quick Reference

## 1. Server: CORS-Safe Upload Endpoint

**File:** `server.js` (lines 102-150)

### Before:
```javascript
app.post('/upload', upload.single('file'), (req, res) => {
  // Multer errors could bypass CORS middleware
  if (!req.file) {
    return res.status(400).json({ error: 'No file' });
  }
  // ...
});
```

### After:
```javascript
app.post('/upload', (req, res) => {
  const origin = req.headers.origin || 'direct';
  console.log(`[UPLOAD] ${req.method} ${req.path} - Origin: ${origin}`);
  
  upload.single('file')(req, res, (err) => {
    // ALWAYS set CORS headers, even on errors
    const allowedOrigins = [
      'https://ldawg7624.com',
      'https://www.ldawg7624.com',
      'http://localhost:8080',
      'http://127.0.0.1:8080'
    ];
    
    if (origin && allowedOrigins.includes(origin)) {
      res.header('Access-Control-Allow-Origin', origin);
      res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
      res.header('Access-Control-Allow-Headers', 'Content-Type');
    }
    
    res.setHeader('Content-Type', 'application/json');
    
    if (err) {
      console.log(`[UPLOAD] ${req.method} ${req.path} - Status: 400 (error)`);
      return res.status(400).json({ 
        success: false, 
        ok: false, 
        error: err.message 
      });
    }
    
    // Rest of upload handler...
    console.log(`[UPLOAD] ${req.method} ${req.path} - Status: 200 (success)`);
    res.status(200).json({
      success: true,
      ok: true,
      url: uploadUrl,
      filename: req.file.originalname,
      mime: req.file.mimetype,
      size: req.file.size
    });
  });
});
```

**Key Points:**
- CORS headers set INSIDE the multer callback (after errors)
- Always returns JSON with `Content-Type: application/json`
- Comprehensive logging with status codes

---

## 2. Server: ACK Protocol Implementation

**File:** `server.js` (lines 286-362)

### Before:
```javascript
ws.on('message', (data) => {
  const message = JSON.parse(data);
  
  if (message.type === 'text') {
    const chatMessage = {
      type: 'text',
      id: crypto.randomBytes(8).toString('hex'), // Server generates new ID!
      nickname: message.nickname,
      timestamp: Date.now(),
      text: message.text
    };
    
    broadcast(chatMessage); // No ACK to sender
  }
});
```

### After:
```javascript
ws.on('message', (data) => {
  const message = JSON.parse(data);
  const msgId = message.id || crypto.randomBytes(8).toString('hex');
  console.log(`[MESSAGE] Received: type=${message.type}, id=${msgId}`);
  
  if (message.type === 'text') {
    const chatMessage = {
      type: 'text',
      id: msgId, // Use client's ID
      nickname: message.nickname,
      timestamp: message.timestamp || Date.now(),
      text: message.text
    };
    
    // Send ACK to sender FIRST
    ws.send(JSON.stringify({
      type: 'ack',
      id: msgId,
      timestamp: chatMessage.timestamp
    }));
    console.log(`[ACK] Sent ack for message id=${msgId}`);
    
    // Then broadcast to all
    addToHistory(chatMessage);
    broadcast(chatMessage);
  }
  
  // Same for 'image' and 'file' types
});
```

**Key Points:**
- Accept client-provided ID instead of generating new one
- Send explicit ACK back to sender
- ACK contains the same ID for matching
- Broadcast happens after ACK

---

## 3. Frontend: ACK Handling

**File:** `index.html` (lines 670-710)

### Before:
```javascript
ws.onmessage = (event) => {
  const data = JSON.parse(event.data);
  
  if (data.type === 'text') {
    // Try to match by nickname, timestamp (unreliable!)
    let found = false;
    for (const [id, pending] of pendingMessages.entries()) {
      if (pending.nickname === data.nickname && 
          Math.abs(pending.timestamp - data.timestamp) < 2000) {
        // Update element...
        found = true;
        break;
      }
    }
    if (!found) {
      addMessage(data);
    }
  }
};
```

### After:
```javascript
ws.onmessage = (event) => {
  const data = JSON.parse(event.data);
  console.log('[WS] Received message:', data.type, data.id ? `id=${data.id}` : '');
  
  if (data.type === 'ack') {
    // Handle ACK - mark as sent
    console.log('[WS] ACK received for message id=' + data.id);
    const msgElement = document.querySelector(`[data-msg-id="${data.id}"]`);
    if (msgElement) {
      msgElement.classList.remove('message-sending');
      const statusSpan = msgElement.querySelector('.message-status');
      if (statusSpan) {
        statusSpan.textContent = 'Sent';
        setTimeout(() => statusSpan.remove(), 1000);
      }
    }
    pendingMessages.delete(data.id);
  } else if (data.type === 'text' || data.type === 'image') {
    // Check if it's our own message (already displayed optimistically)
    if (pendingMessages.has(data.id)) {
      console.log('[WS] Our own message broadcast, already displayed');
      // Update image URL if needed
      if (data.type === 'image') {
        const msgElement = document.querySelector(`[data-msg-id="${data.id}"]`);
        const img = msgElement?.querySelector('.message-image');
        if (img && data.url) {
          img.src = data.url;
        }
      }
    } else {
      // Message from another client
      addMessage(data);
    }
  }
};
```

**Key Points:**
- Listen for `type: 'ack'` messages
- Match by ID (reliable!)
- Update status from "Sending..." to "Sent"
- Remove pending message after ACK received

---

## 4. Frontend: Send with ID and Timeout

**File:** `index.html` (lines 807-946)

### Before:
```javascript
async function sendMessage() {
  const text = messageInput.value.trim();
  const clientId = generateUUID();
  
  const messageData = {
    type: 'text',
    nickname,
    timestamp: Date.now(),
    text
  };
  
  // Add optimistically
  addMessage(messageData, true, clientId, 'sending');
  
  // Send without ID
  ws.send(JSON.stringify(messageData));
  
  // No timeout handling!
}
```

### After:
```javascript
async function sendMessage() {
  const text = messageInput.value.trim();
  const messageId = generateUUID();
  
  const messageData = {
    type: 'text',
    id: messageId, // Include ID
    nickname,
    timestamp: Date.now(),
    text
  };
  
  // Add optimistically with ID
  addMessage(messageData, true, messageId, 'sending');
  pendingMessages.set(messageId, messageData);
  
  // Set timeout for ACK
  setTimeout(() => {
    if (pendingMessages.has(messageId)) {
      console.log('[SEND] ACK timeout for message:', messageId);
      const msgElement = document.querySelector(`[data-msg-id="${messageId}"]`);
      if (msgElement) {
        msgElement.classList.remove('message-sending');
        msgElement.classList.add('message-error');
        const statusSpan = msgElement.querySelector('.message-status');
        if (statusSpan) {
          statusSpan.textContent = 'Failed to send (timeout)';
        }
      }
      pendingMessages.delete(messageId);
    }
  }, 5000);
  
  // Send with ID
  ws.send(JSON.stringify(messageData));
  console.log('[SEND] Text message sent via WebSocket, id=' + messageId);
}
```

**Key Points:**
- Generate UUID for message
- Include ID in message payload
- Store in pendingMessages Map by ID
- Set 5-second timeout to detect failures
- Add comprehensive logging

---

## 5. Frontend: Blob URL Fix

**File:** `index.html` (lines 746-805)

### Before:
```javascript
function addMessage(data) {
  // ...
  if (data.type === 'image') {
    content = `
      <img src="${data.url}" 
           class="message-image" 
           onclick="openImagePreview('${data.url}')"
           alt="Image">
    `;
  }
  // Problem: onclick uses data.url which could be blob:... URL
  // After upload completes, img.src updates but onclick doesn't!
}
```

### After:
```javascript
function addMessage(data, scroll = true, messageId = null, status = 'sent') {
  // ...
  if (data.type === 'image') {
    const imgId = 'img-' + (messageId || data.id || Math.random().toString(36).substr(2, 9));
    content = `
      <img id="${imgId}" 
           src="${data.url}" 
           class="message-image" 
           data-url="${data.url}"
           alt="Image">
    `;
  }
  
  messageDiv.innerHTML = `...${content}...`;
  messagesDiv.appendChild(messageDiv);
  
  // Add click handler AFTER element created
  if (data.type === 'image') {
    const imgElement = document.getElementById(imgId);
    if (imgElement) {
      imgElement.addEventListener('click', function() {
        // Use current src (updated to server URL after upload)
        openImagePreview(this.src);
      });
    }
  }
}
```

**Key Points:**
- Don't use inline `onclick` attribute
- Add event listener after element creation
- Reference `this.src` (current src) not `data.url` (original)
- After upload, code updates `img.src` to server URL
- Click handler automatically uses updated URL

---

## 6. Frontend: Upload with Logging

**File:** `index.html` (lines 853-903)

### Before:
```javascript
const response = await fetch(API_BASE + '/upload', {
  method: 'POST',
  body: formData
});

const result = await response.json();
if (result.success) {
  // ...
}
```

### After:
```javascript
const response = await fetch(API_BASE + '/upload', {
  method: 'POST',
  body: formData
});

// Log response details
console.log('[UPLOAD] Response status:', response.status);
console.log('[UPLOAD] Response headers ACAO:', response.headers.get('access-control-allow-origin'));
console.log('[UPLOAD] Response content-type:', response.headers.get('content-type'));

// Validate response is JSON
const contentType = response.headers.get('content-type');
if (!contentType || !contentType.includes('application/json')) {
  const text = await response.text();
  console.error('[UPLOAD] Error - expected JSON but got:', text.substring(0, 200));
  throw new Error('Server returned non-JSON response. Upload endpoint may not be accessible.');
}

const result = await response.json();
console.log('[UPLOAD] Result:', result);

if (result.success || result.ok) {
  // Send via WebSocket with same ID
  ws.send(JSON.stringify({
    type: 'image',
    id: messageId, // Same ID as optimistic message
    url: absoluteUrl,
    // ...
  }));
}
```

**Key Points:**
- Log status, CORS headers, content-type
- Validate response is JSON before parsing
- Detect Cloudflare/proxy error pages
- Use same message ID for upload and WebSocket send
- Clear error messages for debugging

---

## 7. CSS: Image Size Reduction

**File:** `index.html` (lines 182-188)

### Before:
```css
.message-image {
  margin-top: 10px;
  max-width: 300px;
  cursor: pointer;
  border-radius: 8px;
  transition: transform 0.2s ease;
}
```

### After:
```css
.message-image {
  margin-top: 10px;
  max-width: 240px;     /* 20% reduction */
  max-height: 320px;    /* Prevent tall images */
  cursor: pointer;
  border-radius: 8px;
  object-fit: cover;    /* Preserve aspect ratio */
  transition: transform 0.2s ease;
}
```

**Key Points:**
- Reduced from 300px to 240px (20% smaller)
- Added max-height for tall images
- Added object-fit for aspect ratio preservation
- Maintains hover effects

---

## Quick Test Commands

### Test 1: Check CORS headers (server logs)
```bash
# Watch server logs while uploading
grep "\[UPLOAD\]" server.log
# Should show: Status: 200 (success)
```

### Test 2: Check ACK protocol (browser console)
```javascript
// In browser console while sending message:
// Should see:
[SEND] Text message sent via WebSocket, id=abc123
[WS] Received message: ack id=abc123
```

### Test 3: Test upload endpoint directly
```bash
curl -X OPTIONS https://ws.ldawg7624.com/upload \
  -H "Origin: https://ldawg7624.com" \
  -H "Access-Control-Request-Method: POST" \
  -v

# Should return:
# HTTP/1.1 204 No Content
# Access-Control-Allow-Origin: https://ldawg7624.com
```

---

## Deployment Checklist

- [ ] Deploy server.js to production server
- [ ] Restart Node.js process
- [ ] Deploy index.html to GitHub Pages
- [ ] Clear browser cache
- [ ] Test text message send → should show "Sending..." then "Sent"
- [ ] Test photo upload → should succeed without CORS errors
- [ ] Test clicking image → should open preview without blob URL error
- [ ] Test with two browser tabs → messages appear in both
- [ ] Check server logs for `[UPLOAD]` and `[ACK]` entries
- [ ] Monitor browser console for any errors

---

## Common Issues and Solutions

### Issue: Still seeing CORS errors
**Solution:** Check that:
1. Server has restarted with new code
2. Origin is in allowedOrigins array
3. Server logs show `[UPLOAD]` with correct origin
4. Not hitting a different server/proxy

### Issue: Messages still stuck on "Sending..."
**Solution:** Check that:
1. Browser console shows `[WS] Received message: ack id=...`
2. Server logs show `[ACK] Sent ack for message id=...`
3. WebSocket connection is open (check connection status)
4. Message ID matches between send and ACK

### Issue: Images still showing blob URL error
**Solution:** Check that:
1. Upload succeeds first (no CORS error)
2. Server returns URL in response
3. Image src updates to server URL
4. Click handler uses `this.src` not hardcoded URL
5. Browser console shows image loaded successfully

### Issue: Can't see logs
**Solution:** 
1. Open browser DevTools (F12)
2. Go to Console tab
3. Filter by: `[WS]`, `[SEND]`, or `[UPLOAD]`
4. Server logs: `tail -f /path/to/server.log` or check PM2/systemd logs
