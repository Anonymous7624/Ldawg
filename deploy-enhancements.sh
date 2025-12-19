#!/bin/bash

echo "=========================================="
echo "Kennedy Chat - Feature Enhancements Deploy"
echo "=========================================="
echo ""

# Check if ffmpeg is installed
echo "Checking for ffmpeg..."
if ! command -v ffmpeg &> /dev/null; then
    echo "❌ ffmpeg not found. Installing..."
    sudo apt update
    sudo apt install -y ffmpeg
    echo "✅ ffmpeg installed"
else
    echo "✅ ffmpeg is already installed"
    ffmpeg -version | head -n 1
fi

echo ""
echo "Stopping existing services..."

# Stop existing processes
pkill -f "node.*upload-server.js" && echo "✅ Stopped upload server" || echo "ℹ️  Upload server was not running"
pkill -f "node.*server.js" && echo "✅ Stopped main server" || echo "ℹ️  Main server was not running"

# Wait a moment for processes to stop
sleep 2

echo ""
echo "Starting services..."

# Start upload server first
nohup node upload-server.js > upload-server.log 2>&1 &
UPLOAD_PID=$!
echo "✅ Upload server started (PID: $UPLOAD_PID)"

# Wait a moment before starting main server
sleep 1

# Start main server
nohup node server.js > server.log 2>&1 &
MAIN_PID=$!
echo "✅ Main server started (PID: $MAIN_PID)"

# Wait for servers to initialize
sleep 2

echo ""
echo "Verifying services..."

# Test upload server
if curl -s http://localhost:8082/healthz | grep -q '"ok":true'; then
    echo "✅ Upload server is healthy (port 8082)"
else
    echo "❌ Upload server health check failed"
fi

# Test main server
if curl -s http://localhost:8080/healthz | grep -q '"ok":true'; then
    echo "✅ Main server is healthy (port 8080)"
else
    echo "❌ Main server health check failed"
fi

echo ""
echo "=========================================="
echo "Deployment complete!"
echo "=========================================="
echo ""
echo "New features enabled:"
echo "  • Online users indicator (counts only visible tabs)"
echo "  • Delete own messages"
echo "  • Audio recording (up to 30s)"
echo "  • Stricter rate limiting (3 msgs/10s, escalating bans)"
echo ""
echo "Logs:"
echo "  Main server:   tail -f server.log"
echo "  Upload server: tail -f upload-server.log"
echo ""
echo "Processes:"
echo "  Main server PID:   $MAIN_PID"
echo "  Upload server PID: $UPLOAD_PID"
echo ""
