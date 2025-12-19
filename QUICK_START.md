# Quick Start - Deploy the Fix

## What Was Changed

### server.js (3 changes)
1. **ACK Schema Fix** (lines ~370, ~397, ~423) - Changed ACK response from `{type:"ack", id:...}` to `{type:"ack", messageId:..., serverTime:..., instanceId:...}`
2. **Ping Handler** (line ~352) - Added ping message type support for connection self-test
3. **Enhanced Logging** - Added detailed logs for all message flows with instance ID and client IP

### index.html (3 changes)
1. **ACK Handler Fix** (line ~695) - Changed to read `data.messageId` instead of `data.id`
2. **Connection Self-Test** (line ~678) - Added ping on connect to verify ACK path works before showing "Connected ✓"
3. **Enhanced Logging** - Added detailed WebSocket connection, close, and error logs

## Deploy Now

### On Raspberry Pi:

```bash
# 1. Navigate to your project directory
cd /workspace  # (or wherever your server.js is)

# 2. Stop the old server
pkill -f "node server.js"
# OR if using pm2:
pm2 stop kennedy-chat
# OR if using systemd:
sudo systemctl stop kennedy-chat

# 3. Start the new server
node server.js
# OR with pm2:
pm2 start server.js --name kennedy-chat
pm2 save
# OR with systemd:
sudo systemctl start kennedy-chat

# 4. Verify it's running
netstat -tlnp | grep 8080
# Should show: tcp ... 0.0.0.0:8080 ... LISTEN ...

# 5. Watch logs (optional)
tail -f nohup.out
# OR with pm2:
pm2 logs kennedy-chat --lines 50
# OR with systemd:
sudo journalctl -u kennedy-chat -f
```

### Deploy Frontend (GitHub Pages):

```bash
# From /workspace directory
git add index.html
git commit -m "Fix WebSocket ACK protocol: use messageId, serverTime, instanceId"
git push origin main

# Wait 1-2 minutes for GitHub Pages to rebuild
```

## Verify It Works

### 1. Open Browser Console (F12)
Navigate to: https://ldawg7624.com (or your GitHub Pages URL)

**Look for these logs:**
```
[CONNECT] ✓ WebSocket connection OPEN
[SELF-TEST] Sending ping with messageId=...
[WS] ✓✓✓ ACK RECEIVED ✓✓✓
[SELF-TEST] ✓ Ping ACK received - connection verified!
```

### 2. Send a Test Message
Type a message and click Send.

**Should see in console:**
```
[SEND] ✓ Message sent via WebSocket, id=...
[WS] ✓✓✓ ACK RECEIVED ✓✓✓
[WS] ACK messageId=...
[WS] ACK serverTime=...
[WS] ACK instanceId=...
[WS] Message marked as SENT in UI
```

**Should see in UI:**
- Message appears immediately with "Sending..."
- Within 1 second changes to "Sent ✓"
- Status disappears after 2 seconds

### 3. Test Multi-Tab
- Open 2 browser tabs
- Send message from tab 1
- Message should appear in BOTH tabs

### 4. Check Server Logs

**Should see:**
```
[MESSAGE] ========================================
[MESSAGE] *** SERVER INSTANCE: abc123 ***
[MESSAGE] Type: text
[MESSAGE] ID: 12345678-...
[ACK] *** SERVER abc123 *** Sent ACK for messageId=12345678-... to ...
[BROADCAST] Sent message type=text, id=12345678-... to 2 clients
```

## Success = All These Pass ✓

- [ ] No "ACK TIMEOUT" errors in browser console
- [ ] Messages show "Sent ✓" within 1 second
- [ ] Opening 2 tabs shows messages in both tabs
- [ ] Server logs show ACK sent for each message
- [ ] Page load shows "Connected ✓" after ping test
- [ ] No WebSocket connection errors

## If Something Goes Wrong

### "No ACK received" error:
```bash
# Check server is running
ps aux | grep "node server.js"
netstat -tlnp | grep 8080

# Check server logs for errors
pm2 logs kennedy-chat --err

# Restart server
pm2 restart kennedy-chat
```

### WebSocket won't connect:
```bash
# Check Cloudflare tunnel
sudo systemctl status cloudflared
sudo journalctl -u cloudflared -n 50

# Restart tunnel if needed
sudo systemctl restart cloudflared
```

### Messages not broadcasting to other tabs:
- This means ACK works but broadcast doesn't
- Check server logs for: `[BROADCAST] Sent message type=text, id=... to N clients`
- N should be > 1 if multiple tabs open

## Rollback (if needed)

```bash
git log --oneline  # Find the commit hash before your changes
git revert <commit-hash>
git push origin main
```

On server:
```bash
git pull
pm2 restart kennedy-chat
```

---

**For full details, see WEBSOCKET_ACK_FIX.md**
