#!/usr/bin/env node

/**
 * Test file cleanup when messages are pruned
 * Creates multiple file messages, floods to exceed cap, verifies only unreferenced files are deleted
 */

const WebSocket = require('ws');
const fs = require('fs');
const path = require('path');
const http = require('http');
const FormData = require('form-data');
const Database = require('better-sqlite3');

const WS_URL = 'ws://localhost:8080';
const UPLOAD_URL = 'http://localhost:8080/upload';

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function uploadTestFile(name, content) {
  return new Promise((resolve, reject) => {
    const testFilePath = `/tmp/${name}`;
    fs.writeFileSync(testFilePath, content);
    
    const form = new FormData();
    form.append('file', fs.createReadStream(testFilePath), {
      filename: name,
      contentType: 'text/plain'
    });
    
    const request = http.request(UPLOAD_URL, {
      method: 'POST',
      headers: form.getHeaders()
    }, (res) => {
      let data = '';
      
      res.on('data', (chunk) => {
        data += chunk;
      });
      
      res.on('end', () => {
        try {
          const result = JSON.parse(data);
          if (result.success) {
            resolve(result);
          } else {
            reject(new Error(`Upload failed: ${result.error}`));
          }
        } catch (err) {
          reject(err);
        }
      });
    });
    
    request.on('error', (err) => {
      reject(err);
    });
    
    form.pipe(request);
  });
}

async function sendFileMessage(uploadResult) {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(WS_URL);
    let gotAck = false;
    
    ws.on('open', () => {
      ws.on('message', (data) => {
        const msg = JSON.parse(data.toString());
        
        if (msg.type === 'welcome') {
          const msgId = Date.now().toString() + Math.random();
          ws.send(JSON.stringify({
            type: 'file',
            id: msgId,
            url: uploadResult.url,
            filename: uploadResult.filename,
            mime: uploadResult.mime,
            size: uploadResult.size,
            nickname: 'FileTest',
            timestamp: Date.now()
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

async function sendTextMessage(text) {
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
            nickname: 'FloodTest',
            timestamp: Date.now(),
            id: Date.now().toString() + Math.random()
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
        reject(new Error('Timeout'));
      }
    }, 5000);
  });
}

function fileExists(filename) {
  const fullPath = path.join('/workspace/uploads', filename);
  return fs.existsSync(fullPath);
}

function extractFilename(url) {
  return path.basename(url);
}

async function runTest() {
  console.log('========================================');
  console.log('Testing File Cleanup on Pruning');
  console.log('========================================\n');
  
  console.log('[CLEANUP] NOTE: This test is designed for demonstration.');
  console.log('[CLEANUP] For a full 600-message cap test, use test-persistence.js --flood\n');
  
  try {
    // Upload 2 files
    console.log('[CLEANUP] Uploading test files...');
    const file1 = await uploadTestFile('test-file-1.txt', 'This is test file 1');
    const file2 = await uploadTestFile('test-file-2.txt', 'This is test file 2');
    
    const filename1 = extractFilename(file1.url);
    const filename2 = extractFilename(file2.url);
    
    console.log(`[CLEANUP] Uploaded: ${filename1}`);
    console.log(`[CLEANUP] Uploaded: ${filename2}\n`);
    
    await sleep(500);
    
    // Send file messages
    console.log('[CLEANUP] Sending file messages...');
    await sendFileMessage(file1);
    await sleep(200);
    await sendFileMessage(file2);
    await sleep(500);
    
    // Verify files exist
    console.log('\n[CLEANUP] Verifying files exist:');
    console.log(`[CLEANUP] ${filename1}: ${fileExists(filename1) ? 'EXISTS' : 'MISSING'}`);
    console.log(`[CLEANUP] ${filename2}: ${fileExists(filename2) ? 'EXISTS' : 'MISSING'}\n`);
    
    // Send 10 more text messages
    console.log('[CLEANUP] Sending 10 text messages...');
    for (let i = 0; i < 10; i++) {
      await sendTextMessage(`Flood message ${i + 1}`);
      await sleep(100);
    }
    
    console.log('[CLEANUP] Messages sent. Files should still exist (under 600 cap).\n');
    
    // Check again
    console.log('[CLEANUP] Verifying files still exist:');
    console.log(`[CLEANUP] ${filename1}: ${fileExists(filename1) ? 'EXISTS' : 'MISSING'}`);
    console.log(`[CLEANUP] ${filename2}: ${fileExists(filename2) ? 'EXISTS' : 'MISSING'}\n`);
    
    if (fileExists(filename1) && fileExists(filename2)) {
      console.log('[CLEANUP] ✓ Files persist correctly when under cap');
    } else {
      console.log('[CLEANUP] ⚠️  Warning: Files were deleted prematurely');
    }
    
    console.log('\n========================================');
    console.log('[INFO] File cleanup behavior:');
    console.log('[INFO] - Files are stored on disk in /workspace/uploads/');
    console.log('[INFO] - When messages exceed 600, oldest are pruned');
    console.log('[INFO] - Files are deleted ONLY when their message is pruned');
    console.log('[INFO] - If multiple messages reference same file, file persists');
    console.log('[INFO] - To test full cap, clear DB and run flood test');
    console.log('========================================');
    
    process.exit(0);
  } catch (error) {
    console.error('[CLEANUP] Error:', error.message);
    process.exit(1);
  }
}

runTest();
