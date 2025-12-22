# Kennedy Chat - Deployment & Test Checklist
## Production Bug Fixes - December 19, 2025

---

## CRITICAL: Deployment Steps (Do in Order)

### Step 1: Update Server on Raspberry Pi ✓
```bash
# SSH into your Raspberry Pi
ssh pi@<your-raspberry-pi>

# Navigate to project directory
cd /path/to/kennedy-chat

# Pull latest changes
git pull origin cursor/chat-app-bug-fixes-18fb

# Restart the server
pm2 restart kennedy-chat
# OR if not using PM2:
pkill -f "node server.js"
npm start
```

**Expected Output:**
```
========================================
Kennedy Chat Server
========================================
Port: 8080
WebSocket: ws://localhost:8080
HTTP API: http://localhost:8080
Uploads dir: /workspace/uploads
========================================
```

### Step 2: Verify Cloudflare Tunnel is Running
```bash
# Check if cloudflared is running
ps aux | grep cloudflared

# Should see something like:
# cloudflared tunnel run <tunnel-name>

# If not running, start it:
cloudflared tunnel run <tunnel-name>
```

### Step 3: Deploy Frontend to GitHub Pages
```bash
# From your local machine
git push origin cursor/chat-app-bug-fixes-18fb

# GitHub Pages will automatically deploy index.html to:
# https://ldawg7624.com
```

Wait 1-2 minutes for GitHub Pages to rebuild.

### Step 4: Clear Browser Cache
```
1. Open browser DevTools (F12)
2. Right-click the refresh button
3. Select "Empty Cache and Hard Reload"
```

---

## MANDATORY TESTS (Do NOT Skip)

### ✓ TEST 1: WebSocket Connection (2 minutes)

**Open**: https://ldawg7624.com

**Actions:**
1. Open DevTools Console (F12)
2. Look for log messages

**Expected Console Logs:**
```
Connecting to WebSocket: wss://ws.ldawg7624.com
Connected to Kennedy Chat server
```

**Expected Server Logs (on Raspberry Pi):**
```
[CONNECT] Client connected: <ip>:<port> (id: abc123)
[CONNECT] Total clients: 1
[HISTORY] Sent X messages to abc123
```

**If Failed:**
- Check if server is running: `ps aux | grep node`
- Check if tunnel is running: `ps aux | grep cloudflared`
- Check server logs for errors

---

### ✓ TEST 2: Two Clients Can Chat (3 minutes)

**Client A (Browser 1):**
1. Open https://ldawg7624.com
2. Enter nickname: "Alice"
3. Type message: "Test from Alice"
4. Click "Send"
5. Should see message appear

**Client B (Incognito/Different Browser):**
1. Open https://ldawg7624.com
2. Enter nickname: "Bob"
3. Type message: "Test from Bob"
4. Click "Send"
5. Should see BOTH messages (Alice's and Bob's)

**Go Back to Client A:**
- Should see Bob's message too

**Expected Server Logs:**
```
[CONNECT] Client connected: <ip1>:<port1> (id: abc123)
[CONNECT] Total clients: 1
[CONNECT] Client connected: <ip2>:<port2> (id: def456)
[CONNECT] Total clients: 2
[MESSAGE] Received from abc123: type=text, length=XX bytes
[MESSAGE] Text message from Alice: "Test from Alice"
[BROADCAST] Sent message type=text to 2 clients
[MESSAGE] Received from def456: type=text, length=XX bytes
[MESSAGE] Text message from Bob: "Test from Bob"
[BROADCAST] Sent message type=text to 2 clients
```

**If Failed:**
- Messages don't appear: Check server broadcast logs
- Only one client sees messages: Check both clients are connected to same server
- No messages send: Check WebSocket readyState in console

---

### ✓ TEST 3: File Upload Returns JSON (NOT HTML) (3 minutes)

**Setup:**
- Create a small test image (< 1 MB)
- Name it `test-upload.jpg`

**Actions:**
1. Open https://ldawg7624.com
2. Open DevTools Network tab
3. Enter nickname: "Tester"
4. Click "File" button
5. Select test-upload.jpg
6. Wait for upload

**Check Network Tab:**
1. Find request to `https://ws.ldawg7624.com/upload`
2. Click on it
3. Check "Headers" tab:
   - **Status**: Must be `200 OK` (NOT 404, 403, 426)
   - **Content-Type**: Must be `application/json` (NOT text/html)
4. Check "Response" tab:
   ```json
   {
     "success": true,
     "url": "/uploads/abc123.jpg",
     "filename": "test-upload.jpg",
     "mime": "image/jpeg",
     "size": 12345,
     "isImage": true
   }
   ```

**Check Console:**
```
Uploading file to: https://ws.ldawg7624.com/upload
Upload response status: 200
Upload response content-type: application/json
Upload result: { success: true, ... }
Upload successful
```

**Check Chat:**
- Image should appear in the chat
- Click image to view full size
- Other clients should see the image

**Expected Server Logs:**
```
[UPLOAD] Received upload request
[UPLOAD] Success: test-upload.jpg (12345 bytes, image/jpeg)
[MESSAGE] Received from abc123: type=image, length=XX bytes
[MESSAGE] Image from Tester: test-upload.jpg (12345 bytes)
[BROADCAST] Sent message type=image to 2 clients
```

**If Failed (Getting HTML Response):**

**Symptom A: Status 404**
```
Response: <!DOCTYPE html><html>...404 Not Found...
```
- Problem: Server not running or tunnel misconfigured
- Fix: Restart server and tunnel

**Symptom B: Status 426 "Upgrade Required"**
```
Response: Upgrade to WebSocket required
```
- Problem: Server only handles WebSocket, not HTTP
- Fix: Check server.js has Express routes (it does now)

**Symptom C: CORS Error**
```
Console: Access to fetch at 'https://ws.ldawg7624.com/upload' from origin 
'https://ldawg7624.com' has been blocked by CORS policy
```
- Problem: CORS headers not set
- Fix: Restart server (headers are now in code)

**Debug Command:**
```bash
# Test upload directly from command line
curl -X POST https://ws.ldawg7624.com/upload \
  -F "file=@test-upload.jpg" \
  -H "Origin: https://ldawg7624.com" \
  -v

# Expected response:
# HTTP/1.1 200 OK
# Content-Type: application/json
# Access-Control-Allow-Origin: *
# {"success":true,"url":"/uploads/...","filename":"test-upload.jpg",...}
```

---

### ✓ TEST 4: Camera Capture (2 minutes)

**Actions:**
1. Open https://ldawg7624.com on device with camera
2. Click "Camera" button
3. Grant camera permission
4. See camera preview
5. Click "Capture" button

**Expected:**
- Camera modal closes
- Image appears in chat
- Console shows same upload logs as TEST 3
- Other clients see the photo

**If Failed:**
- Camera doesn't open: Check HTTPS (GitHub Pages provides this)
- Permission denied: User must grant permission
- Upload fails: See TEST 3 troubleshooting

---

## Quick Verification Commands

### On Raspberry Pi (Server)
```bash
# Check server is running
ps aux | grep "node server.js"

# Check port 8080 is listening
netstat -an | grep 8080

# Check Cloudflare tunnel
ps aux | grep cloudflared

# View live server logs
tail -f /path/to/server/logs/output.log
# OR if using PM2:
pm2 logs kennedy-chat

# Test health endpoint
curl http://localhost:8080/healthz
# Should return: {"ok":true}

# Test upload endpoint with CORS
curl -X POST http://localhost:8080/upload \
  -F "file=@test.jpg" \
  -H "Origin: https://ldawg7624.com" \
  -i | head -20
# Should show:
# HTTP/1.1 200 OK
# Access-Control-Allow-Origin: *
# Content-Type: application/json
```

### From Your Machine (Client)
```bash
# Test WebSocket connection
npm install -g wscat
wscat -c wss://ws.ldawg7624.com
# Should connect successfully
# Type: {"type":"text","nickname":"test","text":"hello"}
# Should see message echoed back

# Test upload endpoint
curl -X POST https://ws.ldawg7624.com/upload \
  -F "file=@test.jpg" \
  -H "Origin: https://ldawg7624.com" \
  -v
# Should return JSON with success:true

# Test CORS headers
curl -I https://ws.ldawg7624.com/healthz \
  -H "Origin: https://ldawg7624.com"
# Should include:
# Access-Control-Allow-Origin: *
```

---

## Server Log Examples (What Success Looks Like)

### Successful Connection and Message
```
[CONNECT] Client connected: 192.168.1.100:54321 (id: a1b2c3d4)
[CONNECT] Total clients: 1
[HISTORY] Sent 5 messages to a1b2c3d4
[MESSAGE] Received from a1b2c3d4: type=text, length=67 bytes
[MESSAGE] Text message from Alice: "Hello everyone!"
[BROADCAST] Sent message type=text to 1 clients
```

### Successful Upload
```
[UPLOAD] Received upload request
[UPLOAD] Success: photo.jpg (45678 bytes, image/jpeg)
[MESSAGE] Received from a1b2c3d4: type=image, length=189 bytes
[MESSAGE] Image from Alice: photo.jpg (45678 bytes)
[BROADCAST] Sent message type=image to 1 clients
```

### Successful Disconnect
```
[DISCONNECT] Client a1b2c3d4 disconnected: code=1000, reason=none
[DISCONNECT] Remaining clients: 0
```

---

## Configuration Summary

### Frontend (index.html - Line 543-544)
```javascript
const WS_URL = 'wss://ws.ldawg7624.com';      // WebSocket endpoint
const API_BASE = 'https://ws.ldawg7624.com';  // HTTP API endpoint
```

### Backend (server.js - Line 13)
```javascript
const PORT = 8080;  // Server listens on this port
```

### Cloudflare Tunnel
- Maps `ws.ldawg7624.com` → `http://localhost:8080` on Raspberry Pi
- Must support both WebSocket upgrades AND regular HTTP

### GitHub Pages
- Serves static files from repository
- Custom domain: `ldawg7624.com`
- Files: `index.html`, `CNAME`

---

## Rollback Plan (If Everything Breaks)

### Emergency Rollback
```bash
# On Raspberry Pi
cd /path/to/kennedy-chat
git checkout main  # Or previous working branch
npm start

# Redeploy old frontend
git push origin main --force
```

### Contact Info for Production Issues
- Server logs location: `/path/to/server/logs/` or `pm2 logs`
- Cloudflare tunnel config: Usually in `~/.cloudflared/config.yml`
- GitHub Pages settings: Repository → Settings → Pages

---

## Success Criteria ✓

All tests pass if:
- [x] Console shows "Connected to Kennedy Chat server"
- [x] Two clients can send messages to each other
- [x] File upload returns JSON (NOT HTML)
- [x] Images appear in chat
- [x] Server logs show [CONNECT], [MESSAGE], [BROADCAST], [UPLOAD]
- [x] No console errors
- [x] No "unexpected token '<'" errors
- [x] App title shows "Kennedy Chat" (not "Global Chat Room")
- [x] No emojis visible in UI

---

## Files Changed

| File | Status | Purpose |
|------|--------|---------|
| `server.js` | ✓ Modified | CORS, logging, error handling |
| `index.html` | ✓ Modified | WebSocket URL, upload URL, rename, remove emojis |
| `package.json` | ✓ Modified | Rename app |
| `README.md` | ✓ Created | Documentation |
| `BUGFIX_SUMMARY.md` | ✓ Created | Detailed fix explanation |
| `DEPLOYMENT_CHECKLIST.md` | ✓ Created | This file |

---

## Deployment Complete When:

1. ✓ Server restarted on Raspberry Pi
2. ✓ Cloudflare tunnel confirmed running
3. ✓ Frontend deployed to GitHub Pages
4. ✓ Browser cache cleared
5. ✓ TEST 1 passed (WebSocket connects)
6. ✓ TEST 2 passed (Two clients chat)
7. ✓ TEST 3 passed (Upload returns JSON)
8. ✓ TEST 4 passed (Camera works)
9. ✓ Server logs show all expected messages
10. ✓ No console errors

---

**AFTER ALL TESTS PASS: PRODUCTION IS LIVE ✓**

---

## Support Contact

If issues persist after following this checklist:

1. Capture screenshots of:
   - Browser console errors
   - Network tab for failed requests
   - Server logs from Raspberry Pi

2. Check:
   - Server uptime: `uptime`
   - Server disk space: `df -h`
   - Server memory: `free -m`
   - Recent server logs: `tail -100 /var/log/syslog`

3. Document:
   - What test failed
   - Error messages
   - When it started happening
   - What changed recently

---

**IMPORTANT**: Do not consider deployment complete until ALL tests pass!
