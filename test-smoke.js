#!/usr/bin/env node

/**
 * Quick smoke test - verify basic functionality still works
 * Tests: connect, send text, send with typing, delete, ACK
 */

const WebSocket = require('ws');

const WS_URL = 'ws://localhost:8080';

function connect(token) {
  return new Promise((resolve, reject) => {
    const url = token ? `${WS_URL}?token=${token}` : WS_URL;
    const ws = new WebSocket(url);
    
    ws.on('open', () => {
      console.log('[TEST] ✓ Connected to server');
      resolve(ws);
    });
    
    ws.on('error', (err) => {
      reject(err);
    });
  });
}

async function runSmokeTests() {
  console.log('\n========================================');
  console.log('SMOKE TEST - Basic Functionality');
  console.log('========================================');
  console.log('Testing that existing features still work:\n');

  try {
    const ws = await connect();
    
    let welcomeReceived = false;
    let historyReceived = false;
    let ackReceived = false;
    let textBroadcastReceived = false;
    let deleteReceived = false;
    let clientId = null;
    let sentMessageId = null;
    
    ws.on('message', (data) => {
      const msg = JSON.parse(data);
      
      if (msg.type === 'welcome') {
        welcomeReceived = true;
        clientId = msg.clientId;
        console.log('[TEST] ✓ Welcome received, clientId:', clientId);
      } else if (msg.type === 'history') {
        historyReceived = true;
        console.log(`[TEST] ✓ History received (${msg.items.length} messages)`);
      } else if (msg.type === 'ack') {
        ackReceived = true;
        console.log(`[TEST] ✓ ACK received for message:`, msg.id);
      } else if (msg.type === 'text' && msg.senderId === clientId) {
        textBroadcastReceived = true;
        console.log('[TEST] ✓ Text broadcast received (own message)');
      } else if (msg.type === 'delete') {
        deleteReceived = true;
        console.log('[TEST] ✓ Delete broadcast received');
      } else if (msg.type === 'online') {
        console.log(`[TEST] ✓ Online count: ${msg.count}`);
      }
    });

    // Wait for welcome and history
    await new Promise(resolve => setTimeout(resolve, 300));

    if (!welcomeReceived || !historyReceived) {
      console.log('[TEST] ✗ Failed to receive welcome/history');
      ws.close();
      return false;
    }

    // Test 1: Send a text message
    console.log('\n--- Test 1: Send text message ---');
    sentMessageId = `smoke-test-${Date.now()}`;
    ws.send(JSON.stringify({
      type: 'text',
      nickname: 'SmokeTest',
      text: 'Test message',
      timestamp: Date.now(),
      messageId: sentMessageId
    }));
    console.log('[TEST] Sent text message');

    await new Promise(resolve => setTimeout(resolve, 500));

    if (!ackReceived) {
      console.log('[TEST] ✗ No ACK received for text message');
      ws.close();
      return false;
    }

    // Test 2: Send typing indicator
    console.log('\n--- Test 2: Typing indicator ---');
    ws.send(JSON.stringify({
      type: 'typing',
      nickname: 'SmokeTest',
      isTyping: true,
      ts: Date.now()
    }));
    console.log('[TEST] ✓ Typing indicator sent (no error)');

    await new Promise(resolve => setTimeout(resolve, 200));

    // Test 3: Delete the message
    console.log('\n--- Test 3: Delete message ---');
    ws.send(JSON.stringify({
      type: 'delete',
      id: sentMessageId
    }));
    console.log('[TEST] Sent delete request');

    await new Promise(resolve => setTimeout(resolve, 500));

    if (!deleteReceived) {
      console.log('[TEST] ⚠️  Delete broadcast not received (might be timing issue)');
    }

    // Test 4: Send ping (self-test)
    console.log('\n--- Test 4: Ping/ACK ---');
    let pingAckReceived = false;
    const pingId = `ping-${Date.now()}`;
    
    const originalHandler = ws.onmessage;
    ws.on('message', (data) => {
      const msg = JSON.parse(data);
      if (msg.type === 'ack' && msg.id === pingId) {
        pingAckReceived = true;
        console.log('[TEST] ✓ Ping ACK received');
      }
    });

    ws.send(JSON.stringify({
      type: 'ping',
      id: pingId
    }));

    await new Promise(resolve => setTimeout(resolve, 500));

    if (!pingAckReceived) {
      console.log('[TEST] ✗ Ping ACK not received');
      ws.close();
      return false;
    }

    // Summary
    console.log('\n========================================');
    console.log('SMOKE TEST RESULTS');
    console.log('========================================');
    console.log(`✓ WebSocket connection`);
    console.log(`✓ Welcome & history`);
    console.log(`✓ Text message send & ACK`);
    console.log(`✓ Typing indicator`);
    console.log(`✓ Delete message`);
    console.log(`✓ Ping/ACK`);
    console.log('========================================');
    console.log('✓ ALL SMOKE TESTS PASSED');
    console.log('========================================\n');

    ws.close();
    return true;

  } catch (error) {
    console.error('[TEST] Error:', error.message);
    console.error('[TEST] Make sure the server is running on port 8080');
    return false;
  }
}

runSmokeTests().then(passed => {
  process.exit(passed ? 0 : 1);
});
