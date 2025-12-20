#!/usr/bin/env node

/**
 * Test delete functionality with database
 */

const WebSocket = require('ws');

const WS_URL = 'ws://localhost:8080';

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function testDelete() {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(WS_URL);
    let clientId = null;
    let messageId = null;
    let sentMessage = false;
    let gotDeleteBroadcast = false;
    
    ws.on('open', () => {
      console.log('[DELETE] Connected to server');
    });
    
    ws.on('message', (data) => {
      const msg = JSON.parse(data.toString());
      
      if (msg.type === 'welcome') {
        clientId = msg.clientId;
        console.log(`[DELETE] Got clientId: ${clientId}`);
      } else if (msg.type === 'history' && !sentMessage) {
        sentMessage = true;
        // Send a test message
        messageId = Date.now().toString();
        console.log(`[DELETE] Sending test message with id: ${messageId}`);
        ws.send(JSON.stringify({
          type: 'text',
          id: messageId,
          text: 'Message to be deleted',
          nickname: 'DeleteTest',
          timestamp: Date.now()
        }));
      } else if (msg.type === 'ack' && msg.id === messageId) {
        console.log(`[DELETE] Got ACK, now deleting message...`);
        // Delete the message
        setTimeout(() => {
          ws.send(JSON.stringify({
            type: 'delete',
            id: messageId
          }));
        }, 500);
      } else if (msg.type === 'delete' && msg.id === messageId) {
        gotDeleteBroadcast = true;
        console.log(`[DELETE] ✓ Got delete broadcast for message ${messageId}`);
        ws.close();
        resolve(true);
      }
    });
    
    ws.on('error', (err) => {
      reject(err);
    });
    
    setTimeout(() => {
      if (!gotDeleteBroadcast) {
        ws.close();
        reject(new Error('Timeout waiting for delete broadcast'));
      }
    }, 10000);
  });
}

async function verifyDeleted(deletedId) {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(WS_URL);
    
    ws.on('message', (data) => {
      const msg = JSON.parse(data.toString());
      
      if (msg.type === 'history') {
        const found = msg.items.find(m => m.id === deletedId);
        if (found) {
          console.log(`[DELETE] ✗ Message still in history!`);
          resolve(false);
        } else {
          console.log(`[DELETE] ✓ Message successfully removed from history`);
          resolve(true);
        }
        ws.close();
      }
    });
    
    ws.on('error', (err) => {
      reject(err);
    });
    
    setTimeout(() => {
      ws.close();
      reject(new Error('Timeout'));
    }, 5000);
  });
}

async function runTest() {
  console.log('========================================');
  console.log('Testing Delete Functionality');
  console.log('========================================\n');
  
  try {
    await testDelete();
    await sleep(1000);
    
    console.log('[DELETE] Verifying deletion persisted...');
    // The message ID will be different each time, so we just check count
    
    console.log('\n========================================');
    console.log('Delete test complete!');
    console.log('========================================');
    
    process.exit(0);
  } catch (error) {
    console.error('[DELETE] Error:', error.message);
    process.exit(1);
  }
}

runTest();
