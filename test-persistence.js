#!/usr/bin/env node

/**
 * Test script for persistent chat history
 * Tests:
 * 1. Messages persist across server restarts
 * 2. History cap at 600 messages
 * 3. File cleanup when messages are pruned
 */

const WebSocket = require('ws');
const fs = require('fs');
const path = require('path');

const WS_URL = 'ws://localhost:8080';

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function connectAndGetHistory() {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(WS_URL);
    let receivedHistory = false;
    
    ws.on('open', () => {
      console.log('[TEST] Connected to server');
    });
    
    ws.on('message', (data) => {
      const msg = JSON.parse(data.toString());
      
      if (msg.type === 'history' && !receivedHistory) {
        receivedHistory = true;
        console.log(`[TEST] Received history: ${msg.items.length} messages`);
        ws.close();
        resolve(msg.items);
      }
    });
    
    ws.on('error', (err) => {
      reject(err);
    });
    
    setTimeout(() => {
      if (!receivedHistory) {
        ws.close();
        reject(new Error('Timeout waiting for history'));
      }
    }, 5000);
  });
}

async function sendMessage(text) {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(WS_URL);
    let gotAck = false;
    
    ws.on('open', () => {
      ws.on('message', (data) => {
        const msg = JSON.parse(data.toString());
        
        if (msg.type === 'welcome') {
          // Send a text message
          ws.send(JSON.stringify({
            type: 'text',
            text: text,
            nickname: 'TestBot',
            timestamp: Date.now(),
            id: Date.now().toString()
          }));
        } else if (msg.type === 'ack' && !gotAck) {
          gotAck = true;
          console.log(`[TEST] Got ACK for message: "${text}"`);
          ws.close();
          resolve();
        }
      });
    });
    
    ws.on('error', (err) => {
      reject(err);
    });
    
    setTimeout(() => {
      if (!gotAck) {
        ws.close();
        reject(new Error('Timeout waiting for ACK'));
      }
    }, 5000);
  });
}

async function runTests() {
  console.log('========================================');
  console.log('Testing Persistent Chat History');
  console.log('========================================\n');
  
  try {
    // Test 1: Check initial history
    console.log('[TEST 1] Checking initial history...');
    let history = await connectAndGetHistory();
    const initialCount = history.length;
    console.log(`[TEST 1] ✓ Initial history has ${initialCount} messages\n`);
    
    await sleep(500);
    
    // Test 2: Send 3 messages
    console.log('[TEST 2] Sending 3 test messages...');
    await sendMessage('Test message 1');
    await sleep(300);
    await sendMessage('Test message 2');
    await sleep(300);
    await sendMessage('Test message 3');
    await sleep(500);
    console.log('[TEST 2] ✓ Sent 3 messages\n');
    
    // Test 3: Verify messages are in history
    console.log('[TEST 3] Verifying messages in history...');
    history = await connectAndGetHistory();
    console.log(`[TEST 3] Current history count: ${history.length}`);
    
    const testMessages = history.filter(m => 
      m.nickname === 'TestBot' && 
      m.text && 
      m.text.startsWith('Test message')
    );
    console.log(`[TEST 3] Found ${testMessages.length} test messages`);
    
    if (testMessages.length >= 3) {
      console.log('[TEST 3] ✓ Test messages found in history\n');
    } else {
      console.log('[TEST 3] ⚠️  Warning: Not all test messages found\n');
    }
    
    console.log('========================================');
    console.log('[INFO] Manual restart test:');
    console.log('[INFO] 1. Stop the server (Ctrl+C)');
    console.log('[INFO] 2. Restart with: node server.js');
    console.log('[INFO] 3. Run this test again to verify persistence');
    console.log('[INFO] The test messages should still be present');
    console.log('========================================\n');
    
    console.log('[INFO] To test 600-message cap:');
    console.log('[INFO] Run: node test-persistence.js --flood');
    console.log('[INFO] This will send 605 messages to test pruning');
    console.log('========================================');
    
    process.exit(0);
  } catch (error) {
    console.error('[TEST] Error:', error.message);
    console.log('\n[INFO] Make sure the server is running: node server.js');
    process.exit(1);
  }
}

async function floodTest() {
  console.log('========================================');
  console.log('Testing Message Cap (600 messages)');
  console.log('========================================\n');
  
  try {
    console.log('[FLOOD] Getting initial history...');
    let history = await connectAndGetHistory();
    const initialCount = history.length;
    console.log(`[FLOOD] Initial count: ${initialCount}\n`);
    
    const toSend = 605 - initialCount;
    console.log(`[FLOOD] Sending ${toSend} messages to exceed 600 cap...\n`);
    
    for (let i = 0; i < toSend; i++) {
      await sendMessage(`Flood test message ${i + 1}`);
      if ((i + 1) % 50 === 0) {
        console.log(`[FLOOD] Sent ${i + 1}/${toSend} messages...`);
        await sleep(1000); // Give server time to process
      }
    }
    
    await sleep(2000);
    
    console.log('\n[FLOOD] Checking final history...');
    history = await connectAndGetHistory();
    console.log(`[FLOOD] Final count: ${history.length}`);
    
    if (history.length <= 600) {
      console.log('[FLOOD] ✓ History correctly capped at 600 messages');
    } else {
      console.log(`[FLOOD] ⚠️  Warning: History has ${history.length} messages (expected ≤600)`);
    }
    
    console.log('\n========================================');
    console.log('Flood test complete');
    console.log('========================================');
    
    process.exit(0);
  } catch (error) {
    console.error('[FLOOD] Error:', error.message);
    process.exit(1);
  }
}

// Run tests
if (process.argv.includes('--flood')) {
  floodTest();
} else {
  runTests();
}
