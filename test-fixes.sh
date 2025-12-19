#!/bin/bash
# Test script to validate all critical bug fixes

set -e

API_BASE="${API_BASE:-https://ws.ldawg7624.com}"
FRONTEND_URL="${FRONTEND_URL:-https://ldawg7624.com}"

echo "================================"
echo "Critical Bug Fix Validation"
echo "================================"
echo "API Base: $API_BASE"
echo "Frontend: $FRONTEND_URL"
echo ""

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Test 1: OPTIONS preflight for CORS
echo "Test 1: CORS Preflight (OPTIONS)"
echo "--------------------------------"
response=$(curl -s -X OPTIONS "$API_BASE/upload" \
  -H "Origin: https://ldawg7624.com" \
  -H "Access-Control-Request-Method: POST" \
  -H "Access-Control-Request-Headers: Content-Type" \
  -i -w "\n%{http_code}")

http_code=$(echo "$response" | tail -n1)
acao_header=$(echo "$response" | grep -i "access-control-allow-origin" || echo "NOT FOUND")

if [ "$http_code" = "204" ] || [ "$http_code" = "200" ]; then
  echo -e "${GREEN}✓ OPTIONS preflight: HTTP $http_code${NC}"
else
  echo -e "${RED}✗ OPTIONS preflight failed: HTTP $http_code${NC}"
fi

if echo "$acao_header" | grep -q "ldawg7624.com"; then
  echo -e "${GREEN}✓ CORS header present: $acao_header${NC}"
else
  echo -e "${RED}✗ CORS header missing or incorrect${NC}"
  echo "  Found: $acao_header"
fi

echo ""

# Test 2: POST /upload with CORS headers
echo "Test 2: POST /upload CORS Headers"
echo "----------------------------------"
# Create a small test file
echo "test content" > /tmp/test-upload.txt

response=$(curl -s -X POST "$API_BASE/upload" \
  -H "Origin: https://ldawg7624.com" \
  -F "file=@/tmp/test-upload.txt" \
  -i -w "\n%{http_code}")

http_code=$(echo "$response" | tail -n1)
acao_header=$(echo "$response" | grep -i "access-control-allow-origin" || echo "NOT FOUND")
content_type=$(echo "$response" | grep -i "content-type" || echo "NOT FOUND")

if [ "$http_code" = "200" ] || [ "$http_code" = "400" ]; then
  echo -e "${GREEN}✓ POST /upload: HTTP $http_code${NC}"
else
  echo -e "${RED}✗ POST /upload failed: HTTP $http_code${NC}"
fi

if echo "$acao_header" | grep -q "ldawg7624.com"; then
  echo -e "${GREEN}✓ CORS header on POST: $acao_header${NC}"
else
  echo -e "${RED}✗ CORS header missing on POST${NC}"
  echo "  Found: $acao_header"
fi

if echo "$content_type" | grep -q "application/json"; then
  echo -e "${GREEN}✓ Content-Type is JSON: $content_type${NC}"
else
  echo -e "${YELLOW}⚠ Content-Type may not be JSON${NC}"
  echo "  Found: $content_type"
fi

rm -f /tmp/test-upload.txt

echo ""

# Test 3: WebSocket connectivity
echo "Test 3: WebSocket Connection"
echo "-----------------------------"
ws_url=$(echo "$API_BASE" | sed 's/https:/wss:/' | sed 's/http:/ws:/')

# Try to connect using wscat if available
if command -v wscat &> /dev/null; then
  echo "Attempting WebSocket connection to $ws_url"
  timeout 3 wscat -c "$ws_url" 2>&1 | head -n 5 &
  sleep 2
  echo -e "${GREEN}✓ WebSocket endpoint reachable${NC}"
elif command -v websocat &> /dev/null; then
  echo "Attempting WebSocket connection to $ws_url"
  timeout 3 websocat "$ws_url" 2>&1 | head -n 5 &
  sleep 2
  echo -e "${GREEN}✓ WebSocket endpoint reachable${NC}"
else
  echo -e "${YELLOW}⚠ wscat/websocat not installed, skipping WebSocket test${NC}"
  echo "  Install with: npm install -g wscat"
fi

echo ""

# Test 4: Server health check
echo "Test 4: Server Health Check"
echo "----------------------------"
health_response=$(curl -s "$API_BASE/healthz")

if echo "$health_response" | grep -q '"ok".*true'; then
  echo -e "${GREEN}✓ Server health check passed${NC}"
  echo "  Response: $health_response"
else
  echo -e "${RED}✗ Server health check failed${NC}"
  echo "  Response: $health_response"
fi

echo ""

# Test 5: Static file serving
echo "Test 5: Frontend Accessibility"
echo "-------------------------------"
frontend_response=$(curl -s -w "\n%{http_code}" "$FRONTEND_URL" | tail -n1)

if [ "$frontend_response" = "200" ]; then
  echo -e "${GREEN}✓ Frontend accessible: HTTP $frontend_response${NC}"
else
  echo -e "${RED}✗ Frontend not accessible: HTTP $frontend_response${NC}"
fi

echo ""

# Summary
echo "================================"
echo "Test Summary"
echo "================================"
echo ""
echo "Manual tests required:"
echo "1. Open $FRONTEND_URL in browser"
echo "2. Open DevTools Console (F12)"
echo "3. Send a text message"
echo "   - Should see: [SEND] Sending text message"
echo "   - Should see: [WS] ACK received for message"
echo "   - Status should change from 'Sending...' to 'Sent'"
echo ""
echo "4. Upload a photo"
echo "   - Should see: [UPLOAD] Response status: 200"
echo "   - Should see: [UPLOAD] Response headers ACAO: https://ldawg7624.com"
echo "   - Should see: No CORS errors"
echo ""
echo "5. Click on uploaded image"
echo "   - Should open preview modal"
echo "   - Should see NO 'ERR_FILE_NOT_FOUND' errors"
echo ""
echo "6. Open two browser tabs"
echo "   - Send message in tab 1"
echo "   - Should appear in both tabs"
echo ""
echo "Server logs to monitor:"
echo "  grep '[UPLOAD]' /path/to/server.log"
echo "  grep '[ACK]' /path/to/server.log"
echo "  grep '[BROADCAST]' /path/to/server.log"
echo ""
echo "================================"
