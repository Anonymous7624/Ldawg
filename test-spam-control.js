#!/usr/bin/env node

/**
 * Test script for two-layer spam control
 * 
 * Tests:
 * 1. Sliding window: 6 messages in 10s should trigger strike
 * 2. Cooldown: Messages sent < 750ms apart should trigger strike
 * 3. Normal usage: Messages spaced ~1s apart should work fine
 * 4. Escalation: Multiple violations should lead to bans
 */

const WebSocket = require('ws');

const WS_URL = process.env.WS_URL || 'ws://localhost:8080';
const COOLDOWN_MS = 750;
const WINDOW_MESSAGES = 5;
const WINDOW_MS = 10000;

// Utility to sleep
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// Color output
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[36m'
};

function log(color, ...args) {
  console.log(color, ...args, colors.reset);
}

function makeId() {
  return Math.random().toString(36).substring(2, 15);
}

// Connect and return promise that resolves with ws and token
function connect() {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(WS_URL);
    let token = null;
    
    ws.on('open', () => {
      log(colors.blue, '✓ Connected to server');
    });
    
    ws.on('message', (data) => {
      try {
        const msg = JSON.parse(data);
        if (msg.type === 'welcome') {
          token = msg.token;
          resolve({ ws, token });
        }
      } catch (e) {
        // Ignore parse errors
      }
    });
    
    ws.on('error', reject);
  });
}

// Send a text message
function sendText(ws, text) {
  const msg = {
    type: 'text',
    id: makeId(),
    nickname: 'TestBot',
    text: text,
    timestamp: Date.now()
  };
  ws.send(JSON.stringify(msg));
  return msg.id;
}

// Wait for specific message type
function waitForMessage(ws, type, timeoutMs = 5000) {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      reject(new Error(`Timeout waiting for ${type}`));
    }, timeoutMs);
    
    const handler = (data) => {
      try {
        const msg = JSON.parse(data);
        if (msg.type === type) {
          clearTimeout(timeout);
          ws.removeListener('message', handler);
          resolve(msg);
        }
      } catch (e) {
        // Ignore parse errors
      }
    };
    
    ws.on('message', handler);
  });
}

// Test 1: Normal usage (1s spacing)
async function testNormalUsage() {
  log(colors.yellow, '\n=== TEST 1: Normal Usage (1s spacing) ===');
  
  const { ws } = await connect();
  
  try {
    for (let i = 1; i <= 3; i++) {
      sendText(ws, `Normal message ${i}`);
      log(colors.blue, `Sent message ${i}`);
      
      const ack = await waitForMessage(ws, 'ack', 2000);
      log(colors.green, `✓ Message ${i} accepted`);
      
      if (i < 3) await sleep(1000);
    }
    
    log(colors.green, '✓ TEST 1 PASSED: Normal usage works fine');
    ws.close();
    return true;
  } catch (error) {
    log(colors.red, '✗ TEST 1 FAILED:', error.message);
    ws.close();
    return false;
  }
}

// Test 2: Cooldown violation (rapid fire)
async function testCooldownViolation() {
  log(colors.yellow, '\n=== TEST 2: Cooldown Violation (<750ms spacing) ===');
  
  const { ws } = await connect();
  
  try {
    // Send first message
    sendText(ws, 'Message 1');
    await waitForMessage(ws, 'ack', 2000);
    log(colors.green, '✓ Message 1 accepted');
    
    // Wait just under cooldown period
    await sleep(500);
    
    // Try to send second message too quickly
    sendText(ws, 'Message 2 (too fast)');
    log(colors.blue, 'Sent message 2 at 500ms (expecting ban)');
    
    // Should receive banned message
    const banned = await waitForMessage(ws, 'banned', 3000);
    log(colors.green, `✓ Correctly banned for ${banned.seconds}s`);
    
    log(colors.green, '✓ TEST 2 PASSED: Cooldown enforcement works');
    ws.close();
    return true;
  } catch (error) {
    log(colors.red, '✗ TEST 2 FAILED:', error.message);
    ws.close();
    return false;
  }
}

// Test 3: Sliding window violation (6 messages in 10s)
async function testWindowViolation() {
  log(colors.yellow, '\n=== TEST 3: Sliding Window Violation (6 msgs in 10s) ===');
  
  const { ws } = await connect();
  
  try {
    // Send 5 messages (at limit) with proper spacing
    for (let i = 1; i <= 5; i++) {
      sendText(ws, `Window test message ${i}`);
      await waitForMessage(ws, 'ack', 2000);
      log(colors.green, `✓ Message ${i}/5 accepted`);
      await sleep(800); // Space them out to avoid cooldown
    }
    
    // Try to send 6th message (should trigger window violation)
    sendText(ws, 'Window test message 6 (should be blocked)');
    log(colors.blue, 'Sent 6th message (expecting ban)');
    
    // Should receive banned message
    const banned = await waitForMessage(ws, 'banned', 3000);
    log(colors.green, `✓ Correctly banned for ${banned.seconds}s (strikes: ${banned.strikes})`);
    
    log(colors.green, '✓ TEST 3 PASSED: Sliding window enforcement works');
    ws.close();
    return true;
  } catch (error) {
    log(colors.red, '✗ TEST 3 FAILED:', error.message);
    ws.close();
    return false;
  }
}

// Test 4: Escalation (multiple violations)
async function testEscalation() {
  log(colors.yellow, '\n=== TEST 4: Escalation (multiple violations -> bans) ===');
  
  const { ws, token } = await connect();
  
  try {
    // Trigger 3 strikes quickly
    for (let strike = 1; strike <= 3; strike++) {
      // Send a message
      sendText(ws, `Strike ${strike} - msg 1`);
      await waitForMessage(ws, 'ack', 2000);
      await sleep(800);
      
      // Trigger violation with rapid fire
      for (let i = 0; i < 10; i++) {
        sendText(ws, `Rapid fire ${i}`);
        await sleep(100); // Way too fast
      }
      
      // Should get banned
      const banned = await waitForMessage(ws, 'banned', 3000);
      log(colors.green, `✓ Strike ${strike}: Banned for ${banned.seconds}s`);
      
      // Wait for ban to expire
      await sleep(banned.seconds * 1000 + 500);
    }
    
    log(colors.green, '✓ TEST 4 PASSED: Escalation system works');
    ws.close();
    return true;
  } catch (error) {
    log(colors.red, '✗ TEST 4 FAILED:', error.message);
    ws.close();
    return false;
  }
}

// Test 5: Edge case - exactly at cooldown boundary
async function testCooldownBoundary() {
  log(colors.yellow, '\n=== TEST 5: Cooldown Boundary (750ms spacing) ===');
  
  const { ws } = await connect();
  
  try {
    // Send first message
    sendText(ws, 'Boundary test 1');
    await waitForMessage(ws, 'ack', 2000);
    log(colors.green, '✓ Message 1 accepted');
    
    // Wait exactly the cooldown period
    await sleep(COOLDOWN_MS + 10); // Add 10ms buffer for timing
    
    // Send second message (should be accepted)
    sendText(ws, 'Boundary test 2');
    const ack = await waitForMessage(ws, 'ack', 2000);
    log(colors.green, '✓ Message 2 accepted (at boundary)');
    
    log(colors.green, '✓ TEST 5 PASSED: Boundary case works correctly');
    ws.close();
    return true;
  } catch (error) {
    log(colors.red, '✗ TEST 5 FAILED:', error.message);
    ws.close();
    return false;
  }
}

// Run all tests
async function runAllTests() {
  console.log('\n');
  log(colors.blue, '╔════════════════════════════════════════════╗');
  log(colors.blue, '║  Two-Layer Spam Control Test Suite        ║');
  log(colors.blue, '╚════════════════════════════════════════════╝');
  
  const results = [];
  
  results.push(await testNormalUsage());
  await sleep(2000); // Cooldown between tests
  
  results.push(await testCooldownViolation());
  await sleep(2000);
  
  results.push(await testWindowViolation());
  await sleep(2000);
  
  results.push(await testCooldownBoundary());
  await sleep(2000);
  
  // Skip escalation test by default (takes a long time)
  if (process.argv.includes('--full')) {
    results.push(await testEscalation());
  }
  
  // Summary
  console.log('\n');
  log(colors.blue, '╔════════════════════════════════════════════╗');
  log(colors.blue, '║  Test Results Summary                      ║');
  log(colors.blue, '╚════════════════════════════════════════════╝');
  
  const passed = results.filter(r => r).length;
  const total = results.length;
  
  if (passed === total) {
    log(colors.green, `\n✓ All ${total} tests passed!`);
  } else {
    log(colors.red, `\n✗ ${passed}/${total} tests passed`);
  }
  
  console.log('\n');
  process.exit(passed === total ? 0 : 1);
}

// Run tests
runAllTests().catch(error => {
  log(colors.red, '\n✗ Fatal error:', error.message);
  process.exit(1);
});
