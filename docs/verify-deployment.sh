#!/bin/bash
# Kennedy Chat - Verification Commands
# Use this script to verify the deployment is working correctly

set -e

echo "========================================="
echo "Kennedy Chat - Deployment Verification"
echo "========================================="
echo ""

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Configuration
DATA_DIR="${DATA_DIR:-/home/ldawg7624/chat-data}"
DB_PATH="${DATA_DIR}/chat.db"
UPLOAD_DIR="${DATA_DIR}/uploads"
WS_PORT="${WS_PORT:-8080}"
UPLOAD_PORT="${UPLOAD_PORT:-8082}"

echo "Configuration:"
echo "  DATA_DIR: $DATA_DIR"
echo "  DB_PATH: $DB_PATH"
echo "  UPLOAD_DIR: $UPLOAD_DIR"
echo "  WS_PORT: $WS_PORT"
echo "  UPLOAD_PORT: $UPLOAD_PORT"
echo ""

# Test 1: Check directory structure
echo "Test 1: Checking directory structure..."
if [ -d "$DATA_DIR" ]; then
    echo -e "${GREEN}✓${NC} Data directory exists: $DATA_DIR"
else
    echo -e "${RED}✗${NC} Data directory missing: $DATA_DIR"
    exit 1
fi

if [ -d "$UPLOAD_DIR" ]; then
    echo -e "${GREEN}✓${NC} Upload directory exists: $UPLOAD_DIR"
else
    echo -e "${RED}✗${NC} Upload directory missing: $UPLOAD_DIR"
    exit 1
fi

# Test 2: Check database
echo ""
echo "Test 2: Checking database..."
if [ -f "$DB_PATH" ]; then
    echo -e "${GREEN}✓${NC} Database file exists: $DB_PATH"
    
    # Check database size
    DB_SIZE=$(du -h "$DB_PATH" | cut -f1)
    echo "  Database size: $DB_SIZE"
    
    # Check message count
    if command -v sqlite3 &> /dev/null; then
        MSG_COUNT=$(sqlite3 "$DB_PATH" "SELECT COUNT(*) FROM messages;" 2>/dev/null || echo "N/A")
        echo "  Message count: $MSG_COUNT"
    fi
else
    echo -e "${YELLOW}⚠${NC} Database file not yet created (will be created on first run)"
fi

# Test 3: Check upload directory
echo ""
echo "Test 3: Checking upload directory..."
FILE_COUNT=$(ls -1 "$UPLOAD_DIR" 2>/dev/null | wc -l)
UPLOAD_SIZE=$(du -sh "$UPLOAD_DIR" 2>/dev/null | cut -f1)
echo "  Files in upload directory: $FILE_COUNT"
echo "  Upload directory size: $UPLOAD_SIZE"

# Test 4: Check if processes are running
echo ""
echo "Test 4: Checking server processes..."

if command -v systemctl &> /dev/null; then
    # Check systemd services
    if systemctl is-active --quiet chat-ws; then
        echo -e "${GREEN}✓${NC} WebSocket server is running (systemd)"
    else
        echo -e "${YELLOW}⚠${NC} WebSocket server not running via systemd"
    fi
    
    if systemctl is-active --quiet chat-upload; then
        echo -e "${GREEN}✓${NC} Upload server is running (systemd)"
    else
        echo -e "${YELLOW}⚠${NC} Upload server not running via systemd"
    fi
else
    # Check processes directly
    if pgrep -f "node.*server.js" > /dev/null; then
        echo -e "${GREEN}✓${NC} WebSocket server process found"
    else
        echo -e "${RED}✗${NC} WebSocket server process not found"
    fi
    
    if pgrep -f "node.*upload-server.js" > /dev/null; then
        echo -e "${GREEN}✓${NC} Upload server process found"
    else
        echo -e "${RED}✗${NC} Upload server process not found"
    fi
fi

# Test 5: Check if ports are listening
echo ""
echo "Test 5: Checking network ports..."

if command -v netstat &> /dev/null; then
    if netstat -tlnp 2>/dev/null | grep -q ":$WS_PORT "; then
        echo -e "${GREEN}✓${NC} Port $WS_PORT is listening (WebSocket server)"
    else
        echo -e "${RED}✗${NC} Port $WS_PORT is not listening"
    fi
    
    if netstat -tlnp 2>/dev/null | grep -q ":$UPLOAD_PORT "; then
        echo -e "${GREEN}✓${NC} Port $UPLOAD_PORT is listening (Upload server)"
    else
        echo -e "${RED}✗${NC} Port $UPLOAD_PORT is not listening"
    fi
elif command -v ss &> /dev/null; then
    if ss -tlnp 2>/dev/null | grep -q ":$WS_PORT "; then
        echo -e "${GREEN}✓${NC} Port $WS_PORT is listening (WebSocket server)"
    else
        echo -e "${RED}✗${NC} Port $WS_PORT is not listening"
    fi
    
    if ss -tlnp 2>/dev/null | grep -q ":$UPLOAD_PORT "; then
        echo -e "${GREEN}✓${NC} Port $UPLOAD_PORT is listening (Upload server)"
    else
        echo -e "${RED}✗${NC} Port $UPLOAD_PORT is not listening"
    fi
else
    echo -e "${YELLOW}⚠${NC} Neither netstat nor ss available, cannot check ports"
fi

# Test 6: Check local HTTP endpoints
echo ""
echo "Test 6: Testing local HTTP endpoints..."

if command -v curl &> /dev/null; then
    # Test WS server health
    if curl -s -o /dev/null -w "%{http_code}" "http://localhost:$WS_PORT/healthz" | grep -q "200"; then
        echo -e "${GREEN}✓${NC} WebSocket server health check: OK"
    else
        echo -e "${RED}✗${NC} WebSocket server health check: FAILED"
    fi
    
    # Test upload server health
    if curl -s -o /dev/null -w "%{http_code}" "http://localhost:$UPLOAD_PORT/healthz" | grep -q "200"; then
        echo -e "${GREEN}✓${NC} Upload server health check: OK"
    else
        echo -e "${RED}✗${NC} Upload server health check: FAILED"
    fi
else
    echo -e "${YELLOW}⚠${NC} curl not available, skipping HTTP tests"
fi

# Test 7: Check logs for errors
echo ""
echo "Test 7: Checking recent logs for errors..."

if command -v journalctl &> /dev/null; then
    WS_ERRORS=$(journalctl -u chat-ws -n 100 --since "5 minutes ago" 2>/dev/null | grep -i "error" | wc -l)
    UPLOAD_ERRORS=$(journalctl -u chat-upload -n 100 --since "5 minutes ago" 2>/dev/null | grep -i "error" | wc -l)
    
    if [ "$WS_ERRORS" -eq 0 ]; then
        echo -e "${GREEN}✓${NC} No errors in WebSocket server logs (last 5 minutes)"
    else
        echo -e "${YELLOW}⚠${NC} Found $WS_ERRORS error(s) in WebSocket server logs"
    fi
    
    if [ "$UPLOAD_ERRORS" -eq 0 ]; then
        echo -e "${GREEN}✓${NC} No errors in Upload server logs (last 5 minutes)"
    else
        echo -e "${YELLOW}⚠${NC} Found $UPLOAD_ERRORS error(s) in Upload server logs"
    fi
else
    echo -e "${YELLOW}⚠${NC} journalctl not available, cannot check logs"
fi

# Test 8: Verify environment variables are set
echo ""
echo "Test 8: Verifying environment variables in running services..."

if command -v systemctl &> /dev/null && systemctl is-active --quiet chat-ws; then
    echo "WebSocket Server Environment:"
    systemctl show chat-ws --property=Environment 2>/dev/null | sed 's/Environment=/  /'
    
    echo ""
    echo "Upload Server Environment:"
    systemctl show chat-upload --property=Environment 2>/dev/null | sed 's/Environment=/  /'
else
    echo -e "${YELLOW}⚠${NC} Cannot check environment (services not running via systemd)"
fi

# Summary
echo ""
echo "========================================="
echo "Verification Summary"
echo "========================================="
echo ""
echo "Next steps:"
echo "1. Check server logs:"
echo "   sudo journalctl -u chat-ws -f"
echo "   sudo journalctl -u chat-upload -f"
echo ""
echo "2. Test in browser:"
echo "   Open: https://ldawg7624.com"
echo "   - Send a text message"
echo "   - Upload a file"
echo "   - Verify persistence (restart and reload)"
echo ""
echo "3. Monitor database:"
echo "   sqlite3 $DB_PATH 'SELECT COUNT(*) FROM messages;'"
echo ""
echo "4. Monitor uploads:"
echo "   ls -lh $UPLOAD_DIR"
echo ""
