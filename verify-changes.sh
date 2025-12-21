#!/bin/bash

# Rate Limit Changes - Verification Checklist
# Run this script to verify all changes are in place

echo "========================================="
echo "Rate Limit Implementation Verification"
echo "========================================="
echo ""

# Check 1: Server-side cooldown value
echo "✓ Checking server cooldown setting..."
grep -q "RATE_LIMIT_COOLDOWN = 650" server.js && echo "  ✓ Cooldown is 650ms" || echo "  ✗ FAILED: Cooldown not 650ms"

# Check 2: Server-side rolling window
echo "✓ Checking rolling window limit..."
grep -q "RATE_LIMIT_MESSAGES = 4" server.js && echo "  ✓ Rolling window is 4 messages" || echo "  ✗ FAILED: Rolling window not 4"

# Check 3: Client-side cooldown
echo "✓ Checking client cooldown setting..."
grep -q "SEND_COOLDOWN_MS = 650" index.html && echo "  ✓ Client cooldown is 650ms" || echo "  ✗ FAILED: Client cooldown not 650ms"

# Check 4: Rules text
echo "✓ Checking UI rules text..."
grep -q "More than 4 messages per 10 seconds triggers a strike" index.html && echo "  ✓ Rules text updated" || echo "  ✗ FAILED: Rules text not updated"

# Check 5: Strike schedule implementation
echo "✓ Checking strike schedule..."
grep -q "if (info.strikes === 4)" server.js && echo "  ✓ Strike 4 = 60s" || echo "  ✗ FAILED: Strike 4 not implemented"
grep -q "if (info.strikes === 5)" server.js && echo "  ✓ Strike 5 = 300s" || echo "  ✗ FAILED: Strike 5 not implemented"
grep -q "if (info.strikes >= 6)" server.js && echo "  ✓ Strike 6+ doubles" || echo "  ✗ FAILED: Strike 6+ not implemented"

# Check 6: Cooldown doesn't trigger strikes
echo "✓ Checking cooldown violation handling..."
grep -q "if (reason === 'COOLDOWN')" server.js && echo "  ✓ Cooldown violations don't trigger strikes" || echo "  ✗ FAILED: Cooldown handling missing"

# Check 7: Client token declaration
echo "✓ Checking client token declaration..."
grep -q "let clientToken = getOrCreateToken" index.html && echo "  ✓ clientToken properly declared" || echo "  ✗ FAILED: clientToken not declared"

# Check 8: Syntax checks
echo "✓ Checking JavaScript syntax..."
node -c server.js 2>/dev/null && echo "  ✓ server.js syntax OK" || echo "  ✗ FAILED: server.js syntax error"

echo ""
echo "========================================="
echo "Verification Complete"
echo "========================================="
echo ""
echo "Next steps:"
echo "1. Start the server: node server.js"
echo "2. Run smoke test: node test-smoke.js"
echo "3. Run full test: node test-new-rate-limits.js"
echo ""
