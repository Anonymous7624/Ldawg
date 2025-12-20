#!/usr/bin/env node

/**
 * Test file upload and persistence
 */

const WebSocket = require('ws');
const fs = require('fs');
const path = require('path');
const http = require('http');
const FormData = require('form-data');

const WS_URL = 'ws://localhost:8080';
const UPLOAD_URL = 'http://localhost:8080/upload';

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function uploadTestFile() {
  return new Promise((resolve, reject) => {
    // Create a test file
    const testFilePath = '/tmp/test-upload.txt';
    fs.writeFileSync(testFilePath, 'This is a test file for persistence testing');
    
    const form = new FormData();
    form.append('file', fs.createReadStream(testFilePath), {
      filename: 'test-upload.txt',
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
            console.log(`[UPLOAD] ✓ File uploaded: ${result.url}`);
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

async function sendFileMessage(uploadResult, token) {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(`${WS_URL}?token=${token}`);
    let gotAck = false;
    
    ws.on('open', () => {
      ws.on('message', (data) => {
        const msg = JSON.parse(data.toString());
        
        if (msg.type === 'welcome') {
          // Send a file message
          const msgId = Date.now().toString();
          ws.send(JSON.stringify({
            type: 'file',
            id: msgId,
            url: uploadResult.url,
            filename: uploadResult.filename,
            mime: uploadResult.mime,
            size: uploadResult.size,
            nickname: 'TestBot',
            timestamp: Date.now()
          }));
        } else if (msg.type === 'ack' && !gotAck) {
          gotAck = true;
          console.log(`[FILE] ✓ File message acknowledged`);
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

async function getHistoryWithFiles() {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(WS_URL);
    let receivedHistory = false;
    
    ws.on('open', () => {
      console.log('[FILE] Connected to server');
    });
    
    ws.on('message', (data) => {
      const msg = JSON.parse(data.toString());
      
      if (msg.type === 'history' && !receivedHistory) {
        receivedHistory = true;
        const fileMessages = msg.items.filter(m => m.type === 'file' || m.type === 'image' || m.type === 'audio');
        console.log(`[FILE] Received history: ${msg.items.length} total, ${fileMessages.length} file messages`);
        ws.close();
        resolve({ all: msg.items, files: fileMessages });
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

async function checkFileExists(url) {
  return new Promise((resolve) => {
    const localPath = url.replace('http://localhost:8080', '');
    const fullPath = path.join('/workspace', localPath);
    const exists = fs.existsSync(fullPath);
    console.log(`[FILE] Checking ${fullPath}: ${exists ? 'EXISTS' : 'NOT FOUND'}`);
    resolve(exists);
  });
}

async function runTest() {
  console.log('========================================');
  console.log('Testing File Upload Persistence');
  console.log('========================================\n');
  
  try {
    // Upload a file
    console.log('[FILE] Uploading test file...');
    const uploadResult = await uploadTestFile();
    await sleep(500);
    
    // Generate a token for this test
    const token = 'test-file-' + Date.now();
    
    // Send file message
    console.log('[FILE] Sending file message...');
    await sendFileMessage(uploadResult, token);
    await sleep(500);
    
    // Verify file is in history
    console.log('[FILE] Verifying file in history...');
    let { all, files } = await getHistoryWithFiles();
    
    if (files.length > 0) {
      console.log('[FILE] ✓ File message found in history');
      console.log(`[FILE] URL: ${files[files.length - 1].url}\n`);
      
      // Check if file exists on disk
      const exists = await checkFileExists(files[files.length - 1].url);
      if (exists) {
        console.log('[FILE] ✓ File exists on disk\n');
      } else {
        console.log('[FILE] ⚠️  Warning: File not found on disk\n');
      }
    } else {
      console.log('[FILE] ⚠️  Warning: No file messages in history\n');
    }
    
    console.log('========================================');
    console.log('[INFO] To test file persistence:');
    console.log('[INFO] 1. Note the file URL from above');
    console.log('[INFO] 2. Stop and restart the server');
    console.log('[INFO] 3. Connect with browser and verify file is accessible');
    console.log('========================================');
    
    process.exit(0);
  } catch (error) {
    console.error('[FILE] Error:', error.message);
    process.exit(1);
  }
}

runTest();
