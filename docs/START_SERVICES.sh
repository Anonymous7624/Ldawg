#!/bin/bash
# Start Kennedy Chat services

echo "Starting Kennedy Chat services..."

# Start upload server
echo "Starting upload server on port 8082..."
node /workspace/upload-server.js > /tmp/upload-server.log 2>&1 &
UPLOAD_PID=$!
echo "Upload server PID: $UPLOAD_PID"

# Wait a moment
sleep 2

# Test upload server
echo "Testing upload server..."
if curl -s http://localhost:8082/healthz | grep -q "ok"; then
  echo "✓ Upload server running on port 8082"
else
  echo "✗ Upload server failed to start"
  exit 1
fi

echo ""
echo "Services started successfully!"
echo "Upload server: http://localhost:8082"
echo "Upload logs: /tmp/upload-server.log"
echo ""
echo "IMPORTANT: Make sure the tank/chat server is running on port 8080"
echo "IMPORTANT: Configure cloudflared tunnel (see CLOUDFLARE_TUNNEL_CONFIG.txt)"
