# Pi Restart Commands

## Kill old server and start new one:

```bash
pkill -f "node server.js" || true
cd /workspace
node server.js
```

## Alternative (if you want to run in background with logs):

```bash
pkill -f "node server.js" || true
cd /workspace
nohup node server.js > /tmp/chat-server.log 2>&1 &
echo "Server started with PID: $!"
tail -f /tmp/chat-server.log
```

## To view logs if running in background:

```bash
tail -f /tmp/chat-server.log
```

## To stop background server:

```bash
pkill -f "node server.js"
```

## Quick Health Check:

```bash
curl http://localhost:8080/healthz
# Should return: {"ok":true}
```
