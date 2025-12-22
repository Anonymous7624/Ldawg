#!/bin/bash
# Start all Kennedy Chat servers

echo "=========================================="
echo "Starting Kennedy Chat Servers"
echo "=========================================="

# Kill any existing processes
pkill -f "node server.js" 2>/dev/null
pkill -f "node upload-server.js" 2>/dev/null

# Wait for ports to be released
sleep 1

# Start upload server (port 8082)
echo "Starting upload server on port 8082..."
cd /workspace/apps/pi-global
nohup node upload-server.js > /tmp/upload-server.log 2>&1 &
UPLOAD_PID=$!
echo "Upload server started (PID: $UPLOAD_PID)"

# Give it a moment to start
sleep 2

# Start main chat server (port 8080)
echo "Starting main chat server on port 8080..."
nohup node server.js > /tmp/server.log 2>&1 &
CHAT_PID=$!
echo "Chat server started (PID: $CHAT_PID)"

# Wait a moment for servers to initialize
sleep 2

echo "=========================================="
echo "Server Status:"
echo "=========================================="

# Check if processes are running
if ps -p $UPLOAD_PID > /dev/null; then
    echo "✓ Upload server running (PID: $UPLOAD_PID)"
else
    echo "✗ Upload server failed to start"
fi

if ps -p $CHAT_PID > /dev/null; then
    echo "✓ Chat server running (PID: $CHAT_PID)"
else
    echo "✗ Chat server failed to start"
fi

echo ""
echo "Listening ports:"
netstat -tuln | grep -E '8080|8082' || echo "No ports listening!"

echo ""
echo "=========================================="
echo "Testing endpoints..."
echo "=========================================="

# Test upload server
echo ""
echo "Upload server (port 8082):"
curl -s http://localhost:8082/ | jq '.' || echo "Failed to connect"

echo ""
echo "Main server (port 8080):"
curl -s http://localhost:8080/healthz | jq '.' || echo "Failed to connect"

echo ""
echo "=========================================="
echo "Servers are ready!"
echo "=========================================="
echo ""
echo "View logs:"
echo "  tail -f /tmp/upload-server.log"
echo "  tail -f /tmp/server.log"
echo ""
echo "Stop servers:"
echo "  pkill -f 'node server.js'"
echo "  pkill -f 'node upload-server.js'"
echo "=========================================="
