#!/bin/bash
# CORS Testing Script for Kennedy Chat Upload Endpoint
# Run this to validate CORS headers are working correctly

echo "=========================================="
echo "KENNEDY CHAT CORS VALIDATION TESTS"
echo "=========================================="
echo ""

API_BASE="https://ws.ldawg7624.com"
ORIGIN="https://ldawg7624.com"

echo "Test 1: OPTIONS Preflight to /upload"
echo "--------------------------------------"
curl -i -X OPTIONS "${API_BASE}/upload" \
  -H "Origin: ${ORIGIN}" \
  -H "Access-Control-Request-Method: POST" \
  -H "Access-Control-Request-Headers: Content-Type" \
  2>&1 | head -20

echo ""
echo ""
echo "Expected Headers:"
echo "  ✅ HTTP/1.1 204 No Content"
echo "  ✅ Access-Control-Allow-Origin: ${ORIGIN}"
echo "  ✅ Access-Control-Allow-Methods: GET, POST, OPTIONS"
echo "  ✅ Access-Control-Allow-Headers: Content-Type"
echo ""
read -p "Press Enter to continue to Test 2..."
echo ""

echo "Test 2: Create test image and upload"
echo "--------------------------------------"

# Create a 1x1 pixel PNG (95 bytes)
TEST_FILE="/tmp/test-kennedy-chat.png"
echo "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==" | base64 -d > "${TEST_FILE}"

echo "Created test image: ${TEST_FILE} ($(stat -f%z ${TEST_FILE} 2>/dev/null || stat -c%s ${TEST_FILE}) bytes)"
echo ""

echo "Uploading to ${API_BASE}/upload..."
UPLOAD_RESPONSE=$(curl -i -X POST "${API_BASE}/upload" \
  -H "Origin: ${ORIGIN}" \
  -F "file=@${TEST_FILE}" 2>&1)

echo "$UPLOAD_RESPONSE" | head -30

echo ""
echo ""
echo "Expected Response:"
echo "  ✅ HTTP/1.1 200 OK"
echo "  ✅ Access-Control-Allow-Origin: ${ORIGIN}"
echo "  ✅ Content-Type: application/json"
echo "  ✅ Body contains: {\"success\":true,\"ok\":true,\"url\":\"/uploads/...\"}"
echo ""

# Extract URL from response
UPLOAD_URL=$(echo "$UPLOAD_RESPONSE" | grep -o '"/uploads/[^"]*"' | head -1 | tr -d '"')

if [ -n "$UPLOAD_URL" ]; then
  read -p "Press Enter to continue to Test 3..."
  echo ""
  
  echo "Test 3: Fetch uploaded file"
  echo "--------------------------------------"
  echo "GET ${API_BASE}${UPLOAD_URL}"
  echo ""
  
  curl -i -X GET "${API_BASE}${UPLOAD_URL}" \
    -H "Origin: ${ORIGIN}" \
    2>&1 | head -20
  
  echo ""
  echo ""
  echo "Expected Response:"
  echo "  ✅ HTTP/1.1 200 OK"
  echo "  ✅ Access-Control-Allow-Origin: ${ORIGIN} (or *)"
  echo "  ✅ Content-Type: image/png"
  echo "  ✅ X-Content-Type-Options: nosniff"
else
  echo "⚠️  Could not extract upload URL from response"
  echo "   Upload may have failed - check server logs"
fi

echo ""
echo "=========================================="
echo "TESTS COMPLETE"
echo "=========================================="
echo ""
echo "If all tests show correct headers, CORS is fixed! ✅"
echo ""
echo "If you see errors:"
echo "  - Check server is running: pm2 status kennedy-chat"
echo "  - Check server logs: pm2 logs kennedy-chat"
echo "  - Verify Cloudflare tunnel is running"
echo "  - Try restarting server: pm2 restart kennedy-chat"
echo ""
