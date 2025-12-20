#!/bin/bash
# Quick start script for local testing with environment variables

echo "========================================="
echo "Kennedy Chat - Local Test Environment"
echo "========================================="
echo ""

# Set up test environment
export DB_PATH="./test-data/chat.db"
export UPLOAD_DIR="./test-data/uploads"
export UPLOAD_BASE_URL="http://localhost:8082"
export MAX_MESSAGES="50"
export WS_PORT="8080"
export UPLOAD_PORT="8082"

# Create test directories
mkdir -p ./test-data/uploads

echo "Environment configured:"
echo "  DB_PATH=$DB_PATH"
echo "  UPLOAD_DIR=$UPLOAD_DIR"
echo "  UPLOAD_BASE_URL=$UPLOAD_BASE_URL"
echo "  MAX_MESSAGES=$MAX_MESSAGES"
echo ""

echo "Starting servers..."
echo ""

# Start servers in background
echo "Starting WebSocket server on port $WS_PORT..."
node server.js > ws-server.log 2>&1 &
WS_PID=$!
echo "  PID: $WS_PID"

sleep 2

echo "Starting Upload server on port $UPLOAD_PORT..."
node upload-server.js > upload-server.log 2>&1 &
UPLOAD_PID=$!
echo "  PID: $UPLOAD_PID"

sleep 2

echo ""
echo "========================================="
echo "Servers started!"
echo "========================================="
echo ""
echo "WebSocket server: ws://localhost:$WS_PORT (PID: $WS_PID)"
echo "Upload server: http://localhost:$UPLOAD_PORT (PID: $UPLOAD_PID)"
echo ""
echo "Logs:"
echo "  tail -f ws-server.log"
echo "  tail -f upload-server.log"
echo ""
echo "Test URLs:"
echo "  WS Health: http://localhost:$WS_PORT/healthz"
echo "  Upload Health: http://localhost:$UPLOAD_PORT/healthz"
echo ""
echo "To stop servers:"
echo "  kill $WS_PID $UPLOAD_PID"
echo "  or: pkill -f 'node.*server.js'"
echo ""
echo "Open frontend:"
echo "  1. Update index.html WS_URL and UPLOAD_URL to localhost"
echo "  2. Open index.html in browser"
echo "  or: python3 -m http.server 8000"
echo ""

# Save PIDs to file for easy cleanup
echo $WS_PID > .ws-pid
echo $UPLOAD_PID > .upload-pid

echo "PIDs saved to .ws-pid and .upload-pid"
echo ""
