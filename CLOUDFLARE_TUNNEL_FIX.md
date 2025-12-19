# Cloudflare Tunnel Configuration Fix

## Problem Diagnosis

**Symptom:** Photo uploads fail with:
- Console Error: `POST https://ws.ldawg7624.com/upload net::ERR_FAILED 426 (Upgrade Required)`
- CORS error (secondary to 426)
- Text messages timeout waiting for ACK

**Root Cause:** The Cloudflare tunnel for `ws.ldawg7624.com` is configured to **ONLY** accept WebSocket upgrade requests and rejects normal HTTP POST requests with a 426 error.

**HTTP 426 Upgrade Required** means:
> The server refuses to process the request using HTTP and insists the client upgrade to WebSocket protocol first.

This is typically caused by:
1. A proxy/tunnel configured with WebSocket-only mode
2. Incorrect `noTLSVerify` or `httpHostHeader` settings in Cloudflare tunnel
3. Missing or incorrect ingress rules

## Solution: Fix Cloudflare Tunnel Configuration

### Option 1: Fix Existing Tunnel (RECOMMENDED)

Update your Cloudflare tunnel configuration to accept **both** WebSocket and HTTP traffic.

**Before (Broken - WebSocket only):**
```yaml
tunnel: <your-tunnel-id>
credentials-file: /path/to/credentials.json

ingress:
  - hostname: ws.ldawg7624.com
    service: ws://localhost:8080  # ❌ WRONG: ws:// forces WebSocket-only
  - service: http_status:404
```

**After (Fixed - Supports both HTTP and WebSocket):**
```yaml
tunnel: <your-tunnel-id>
credentials-file: /path/to/credentials.json

ingress:
  - hostname: ws.ldawg7624.com
    service: http://localhost:8080  # ✓ CORRECT: http:// supports both
    originRequest:
      noTLSVerify: false
  - service: http_status:404
```

**Key Changes:**
- Use `http://localhost:8080` NOT `ws://localhost:8080`
- The Express + WebSocket server handles protocol negotiation automatically
- WebSocket upgrades work fine over HTTP service configuration

### Option 2: Separate Tunnel for Uploads

If you must keep WebSocket-only for `ws.ldawg7624.com`, create a separate route for HTTP:

```yaml
tunnel: <your-tunnel-id>
credentials-file: /path/to/credentials.json

ingress:
  # WebSocket traffic
  - hostname: ws.ldawg7624.com
    service: ws://localhost:8080
  
  # HTTP traffic for uploads
  - hostname: api.ldawg7624.com
    service: http://localhost:8080
  
  - service: http_status:404
```

Then update `index.html`:
```javascript
const WS_URL = 'wss://ws.ldawg7624.com';
const UPLOAD_ENDPOINTS = [
  'https://api.ldawg7624.com',  // Primary: HTTP-enabled domain
  'https://ws.ldawg7624.com'    // Fallback: original
];
```

### Option 3: Use Cloudflare Dashboard

If using Cloudflare Zero Trust Dashboard:

1. Go to **Zero Trust** → **Networks** → **Tunnels**
2. Find your tunnel and click **Configure**
3. Under **Public Hostnames**, find `ws.ldawg7624.com`
4. Edit the hostname
5. Under **Service**, make sure:
   - Type: `HTTP` (NOT WebSocket)
   - URL: `localhost:8080`
6. **Save**

The tunnel will automatically handle WebSocket upgrade requests when clients send the appropriate headers.

## How to Test After Fix

### 1. Test Upload Endpoint Directly

```bash
# Should return JSON (not 426)
curl -X POST https://ws.ldawg7624.com/upload \
  -F "file=@test.jpg" \
  -H "Origin: https://ldawg7624.com" \
  -v
```

**Expected Output:**
```
< HTTP/1.1 200 OK
< Access-Control-Allow-Origin: https://ldawg7624.com
< Content-Type: application/json
...
{"success":true,"url":"/uploads/...","filename":"test.jpg",...}
```

**NOT:**
```
< HTTP/1.1 426 Upgrade Required
```

### 2. Test OPTIONS Preflight

```bash
curl -X OPTIONS https://ws.ldawg7624.com/upload \
  -H "Origin: https://ldawg7624.com" \
  -H "Access-Control-Request-Method: POST" \
  -v
```

**Expected Output:**
```
< HTTP/1.1 204 No Content
< Access-Control-Allow-Origin: https://ldawg7624.com
< Access-Control-Allow-Methods: GET, POST, OPTIONS
< Access-Control-Allow-Headers: Content-Type
```

### 3. Test WebSocket Still Works

```bash
# Install wscat if needed: npm install -g wscat
wscat -c wss://ws.ldawg7624.com
```

Should connect successfully and show:
```
Connected (press CTRL+C to quit)
```

### 4. Test in Browser

1. Open https://ldawg7624.com
2. Open DevTools Console (F12)
3. Try uploading a photo
4. Check console for:
   ```
   [UPLOAD] Response status: 200 OK
   ```
   NOT:
   ```
   [UPLOAD] Response status: 426 Upgrade Required
   ```

## Verifying Server Configuration

The Node.js server code is already configured correctly. Verify by checking:

```bash
# On Raspberry Pi where server runs
curl -X POST http://localhost:8080/upload \
  -F "file=@test.jpg" \
  -H "Origin: https://ldawg7624.com"
```

Should return 200 JSON. If this works but the public URL returns 426, it's definitely a tunnel issue.

## Alternative Quick Fix (If Can't Change Tunnel)

If you cannot modify the Cloudflare tunnel configuration, you can temporarily route uploads through the main domain:

**Update** `index.html` line ~649:
```javascript
const UPLOAD_ENDPOINTS = [
  'https://ldawg7624.com',           // Try main domain first
  'https://ws.ldawg7624.com'         // Fallback
];
```

**Add Cloudflare Worker** on `ldawg7624.com` to proxy uploads:
```javascript
// workers.ldawg7624.com/upload
export default {
  async fetch(request) {
    if (request.url.includes('/upload')) {
      // Forward to actual server
      const url = new URL(request.url);
      url.hostname = 'your-raspberry-pi-ip';
      url.port = '8080';
      return fetch(url, request);
    }
    return fetch(request);
  }
}
```

But this is a **workaround**. The proper fix is Option 1 above.

## Summary

**Problem:** Cloudflare tunnel configured with `ws://` service type
**Solution:** Change to `http://` service type (supports both HTTP and WebSocket)
**Verification:** `curl -X POST https://ws.ldawg7624.com/upload` returns 200, not 426

The Node.js server already handles both protocols correctly. This is purely a tunnel configuration issue.
