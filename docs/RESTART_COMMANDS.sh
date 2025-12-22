#!/bin/bash
# WebSocket ACK Fix - Restart Commands
# Run these commands on your Raspberry Pi

echo "=========================================="
echo "WebSocket Server Restart Script"
echo "=========================================="
echo ""

# Step 1: Stop the old server
echo "Step 1: Stopping old server..."
if command -v pm2 &> /dev/null; then
    echo "  Using pm2..."
    pm2 stop kennedy-chat 2>/dev/null || pm2 stop server 2>/dev/null || echo "  No pm2 process found"
elif systemctl is-active --quiet kennedy-chat; then
    echo "  Using systemd..."
    sudo systemctl stop kennedy-chat
else
    echo "  Killing node process..."
    pkill -f "node server.js"
fi
sleep 2

# Step 2: Verify port is free
echo ""
echo "Step 2: Checking if port 8080 is free..."
if netstat -tlnp 2>/dev/null | grep -q ":8080 "; then
    echo "  WARNING: Port 8080 still in use!"
    echo "  Processes using port 8080:"
    sudo netstat -tlnp | grep ":8080 "
    echo "  Kill them manually with: sudo kill -9 <PID>"
    exit 1
else
    echo "  ✓ Port 8080 is free"
fi

# Step 3: Start the new server
echo ""
echo "Step 3: Starting new server..."
cd /workspace || { echo "Error: /workspace directory not found"; exit 1; }

if command -v pm2 &> /dev/null; then
    echo "  Starting with pm2..."
    pm2 start server.js --name kennedy-chat
    pm2 save
    echo ""
    echo "  Server started! View logs with: pm2 logs kennedy-chat"
elif systemctl list-unit-files | grep -q kennedy-chat.service; then
    echo "  Starting with systemd..."
    sudo systemctl start kennedy-chat
    echo ""
    echo "  Server started! View logs with: sudo journalctl -u kennedy-chat -f"
else
    echo "  Starting with nohup..."
    nohup node server.js > nohup.out 2>&1 &
    echo "  Server PID: $!"
    echo ""
    echo "  Server started! View logs with: tail -f nohup.out"
fi

sleep 3

# Step 4: Verify server is running
echo ""
echo "Step 4: Verifying server is running..."
if netstat -tlnp 2>/dev/null | grep -q ":8080 "; then
    echo "  ✓ Server is listening on port 8080"
    netstat -tlnp 2>/dev/null | grep ":8080 "
else
    echo "  ❌ ERROR: Server is NOT listening on port 8080"
    echo "  Check logs for errors"
    exit 1
fi

# Step 5: Check server instance ID from logs
echo ""
echo "Step 5: Getting server instance ID..."
sleep 2
if command -v pm2 &> /dev/null; then
    pm2 logs kennedy-chat --lines 20 --nostream | grep "Server Instance ID" | tail -1
elif systemctl is-active --quiet kennedy-chat; then
    sudo journalctl -u kennedy-chat -n 20 --no-pager | grep "Server Instance ID" | tail -1
else
    grep "Server Instance ID" nohup.out | tail -1
fi

# Step 6: Test WebSocket endpoint
echo ""
echo "Step 6: Testing WebSocket endpoint..."
HTTP_STATUS=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:8080/)
if [ "$HTTP_STATUS" = "426" ]; then
    echo "  ✓ WebSocket endpoint responding (426 Upgrade Required - expected)"
else
    echo "  ⚠ Unexpected status: $HTTP_STATUS (expected 426)"
fi

# Step 7: Check Cloudflare tunnel (optional)
echo ""
echo "Step 7: Checking Cloudflare tunnel (optional)..."
if systemctl is-active --quiet cloudflared; then
    echo "  ✓ Cloudflare tunnel is running"
    echo "  View logs with: sudo journalctl -u cloudflared -f"
else
    echo "  ⚠ Cloudflare tunnel not detected or not running"
    echo "  If you use Cloudflare tunnel, start it with:"
    echo "    sudo systemctl start cloudflared"
fi

echo ""
echo "=========================================="
echo "✓ Server restart complete!"
echo "=========================================="
echo ""
echo "Next steps:"
echo "1. Deploy frontend: git push origin main (wait 1-2 min for GitHub Pages)"
echo "2. Open browser: https://ldawg7624.com"
echo "3. Open console (F12) and look for:"
echo "   [SELF-TEST] ✓ Ping ACK received - connection verified!"
echo "4. Send a test message and verify 'Sent ✓' appears within 1 second"
echo ""
echo "View logs:"
if command -v pm2 &> /dev/null; then
    echo "  pm2 logs kennedy-chat --lines 50"
elif systemctl is-active --quiet kennedy-chat; then
    echo "  sudo journalctl -u kennedy-chat -f"
else
    echo "  tail -f nohup.out"
fi
echo ""
