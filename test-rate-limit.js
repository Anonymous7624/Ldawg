#!/usr/bin/env node

/**
 * Test script to verify rate limiting behavior
 * Tests that 4 messages per second is allowed, but 5th triggers a ban
 */

const WebSocket = require('ws');

const WS_URL = 'ws://localhost:8080';
let messagesSent = 0;
let ackCount = 0;
let bannedReceived = false;

function connect() {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(WS_URL);
    
    ws.on('open', () => {
      console.log('[TEST] Connected to server');
      resolve(ws);
    });
    
    ws.on('error', (err) => {
      reject(err);
    });
  });
}

async function runTest() {
  console.log('========================================');
  console.log('Rate Limit Test');
  console.log('========================================');
  console.log('Connecting to:', WS_URL);
  console.log('Expected behavior:');
  console.log('- First 4 messages: Should be accepted (ACK received)');
  console.log('- 5th message: Should trigger rate limit ban');
  console.log('========================================\n');

  try {
    const ws = await connect();
    
    ws.on('message', (data) => {
      const msg = JSON.parse(data);
      
      if (msg.type === 'welcome') {
        console.log(`[TEST] Received welcome, clientId: ${msg.clientId}`);
      } else if (msg.type === 'history') {
        console.log(`[TEST] Received history (${msg.items.length} messages)`);
      } else if (msg.type === 'ack') {
        ackCount++;
        console.log(`[TEST] ✓ ACK received for message #${ackCount}`);
      } else if (msg.type === 'banned') {
        bannedReceived = true;
        console.log(`[TEST] ⚠️  BANNED received after ${messagesSent} messages`);
        console.log(`[TEST] Ban duration: ${msg.seconds}s`);
        console.log(`[TEST] Strikes: ${msg.strikes}`);
        console.log(`[TEST] Reason: ${msg.reason}`);
      }
    });

    // Wait for welcome and history
    await new Promise(resolve => setTimeout(resolve, 100));

    console.log('[TEST] Sending 5 messages rapidly (should trigger ban on 5th)...\n');

    // Send 5 messages as fast as possible
    for (let i = 1; i <= 5; i++) {
      const msg = {
        type: 'text',
        nickname: 'TestUser',
        text: `Test message ${i}`,
        timestamp: Date.now(),
        messageId: `test-${i}-${Date.now()}`
      };
      
      ws.send(JSON.stringify(msg));
      messagesSent++;
      console.log(`[TEST] Sent message #${i}`);
      
      // Small delay to ensure messages are sent
      await new Promise(resolve => setTimeout(resolve, 10));
    }

    // Wait for responses
    await new Promise(resolve => setTimeout(resolve, 500));

    console.log('\n========================================');
    console.log('Test Results');
    console.log('========================================');
    console.log(`Messages sent: ${messagesSent}`);
    console.log(`ACKs received: ${ackCount}`);
    console.log(`Ban triggered: ${bannedReceived ? 'YES ✓' : 'NO ✗'}`);
    console.log('========================================');

    if (ackCount === 4 && bannedReceived) {
      console.log('✓ TEST PASSED: Rate limiter working as expected');
      console.log('  - 4 messages accepted');
      console.log('  - 5th message triggered ban');
    } else {
      console.log('✗ TEST FAILED: Unexpected behavior');
      console.log(`  - Expected 4 ACKs, got ${ackCount}`);
      console.log(`  - Expected ban on 5th message: ${bannedReceived}`);
    }
    console.log('========================================\n');

    ws.close();
    process.exit(bannedReceived && ackCount === 4 ? 0 : 1);

  } catch (error) {
    console.error('[TEST] Error:', error.message);
    console.error('[TEST] Make sure the server is running on port 8080');
    process.exit(1);
  }
}

runTest();
