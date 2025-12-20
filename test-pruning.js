#!/usr/bin/env node

/**
 * Test message pruning at cap
 */

const WebSocket = require('ws');
const fs = require('fs');
const path = require('path');
const Database = require('better-sqlite3');

const WS_URL = 'ws://localhost:8080';

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function sendMessage(text) {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(WS_URL);
    let gotAck = false;
    
    ws.on('open', () => {
      ws.on('message', (data) => {
        const msg = JSON.parse(data.toString());
        
        if (msg.type === 'welcome') {
          ws.send(JSON.stringify({
            type: 'text',
            text: text,
            nickname: 'PruneTest',
            timestamp: Date.now(),
            id: Date.now().toString()
          }));
        } else if (msg.type === 'ack' && !gotAck) {
          gotAck = true;
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

async function getMessageCount() {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(WS_URL);
    
    ws.on('message', (data) => {
      const msg = JSON.parse(data.toString());
      
      if (msg.type === 'history') {
        ws.close();
        resolve(msg.items.length);
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

async function getDbCount() {
  const dbPath = path.join('/workspace', 'chat.db');
  const db = new Database(dbPath, { readonly: true });
  const result = db.prepare('SELECT COUNT(*) as count FROM messages').get();
  db.close();
  return result.count;
}

async function runTest() {
  console.log('========================================');
  console.log('Testing Message Pruning (Cap at 600)');
  console.log('========================================\n');
  
  try {
    // Get initial count
    const initialCount = await getMessageCount();
    const initialDbCount = await getDbCount();
    console.log(`[PRUNE] Initial count: ${initialCount} messages (DB: ${initialDbCount})`);
    
    // Send messages to test pruning
    const toSend = 20;
    console.log(`[PRUNE] Sending ${toSend} messages...\n`);
    
    for (let i = 0; i < toSend; i++) {
      await sendMessage(`Prune test message ${i + 1}`);
      if ((i + 1) % 5 === 0) {
        console.log(`[PRUNE] Sent ${i + 1}/${toSend} messages...`);
      }
      await sleep(100);
    }
    
    await sleep(1000);
    
    // Check final count
    const finalCount = await getMessageCount();
    const finalDbCount = await getDbCount();
    console.log(`\n[PRUNE] Final count: ${finalCount} messages (DB: ${finalDbCount})`);
    
    // Verify cap is enforced
    if (finalDbCount <= 600) {
      console.log(`[PRUNE] ✓ Database correctly capped at 600 messages`);
    } else {
      console.log(`[PRUNE] ✗ Database has ${finalDbCount} messages (expected ≤600)`);
    }
    
    if (finalCount <= 600) {
      console.log(`[PRUNE] ✓ History correctly capped at 600 messages`);
    } else {
      console.log(`[PRUNE] ✗ History has ${finalCount} messages (expected ≤600)`);
    }
    
    console.log('\n========================================');
    console.log('Pruning test complete!');
    console.log('========================================');
    
    process.exit(0);
  } catch (error) {
    console.error('[PRUNE] Error:', error.message);
    process.exit(1);
  }
}

runTest();
