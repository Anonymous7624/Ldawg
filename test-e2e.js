#!/usr/bin/env node

/**
 * Final end-to-end validation test
 * Tests all features in sequence to ensure nothing is broken
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

async function testPing() {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(WS_URL);
    let gotAck = false;
    
    ws.on('open', () => {
      ws.on('message', (data) => {
        const msg = JSON.parse(data.toString());
        
        if (msg.type === 'welcome') {
          ws.send(JSON.stringify({
            type: 'ping',
            id: 'test-ping'
          }));
        } else if (msg.type === 'ack' && msg.id === 'test-ping') {
          gotAck = true;
          ws.close();
          resolve(true);
        }
      });
    });
    
    ws.on('error', reject);
    setTimeout(() => gotAck ? resolve(true) : reject(new Error('Timeout')), 5000);
  });
}

async function testTextMessage() {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(WS_URL);
    let gotAck = false;
    
    ws.on('open', () => {
      ws.on('message', (data) => {
        const msg = JSON.parse(data.toString());
        
        if (msg.type === 'welcome') {
          ws.send(JSON.stringify({
            type: 'text',
            text: 'E2E Test Message',
            nickname: 'E2ETest',
            id: Date.now().toString()
          }));
        } else if (msg.type === 'ack') {
          gotAck = true;
          ws.close();
          resolve(true);
        }
      });
    });
    
    ws.on('error', reject);
    setTimeout(() => gotAck ? resolve(true) : reject(new Error('Timeout')), 5000);
  });
}

async function testPresence() {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(WS_URL);
    let gotOnline = false;
    
    ws.on('open', () => {
      ws.on('message', (data) => {
        const msg = JSON.parse(data.toString());
        
        if (msg.type === 'online') {
          gotOnline = true;
          ws.close();
          resolve(true);
        } else if (msg.type === 'welcome') {
          ws.send(JSON.stringify({
            type: 'presence',
            online: false
          }));
        }
      });
    });
    
    ws.on('error', reject);
    setTimeout(() => gotOnline ? resolve(true) : reject(new Error('Timeout')), 5000);
  });
}

async function testFileUpload() {
  return new Promise((resolve, reject) => {
    const testFilePath = '/tmp/e2e-test.txt';
    fs.writeFileSync(testFilePath, 'E2E test file');
    
    const form = new FormData();
    form.append('file', fs.createReadStream(testFilePath), {
      filename: 'e2e-test.txt',
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
          resolve(result.success === true);
        } catch (err) {
          reject(err);
        }
      });
    });
    
    request.on('error', reject);
    form.pipe(request);
  });
}

async function testHistoryLoad() {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(WS_URL);
    
    ws.on('message', (data) => {
      const msg = JSON.parse(data.toString());
      
      if (msg.type === 'history') {
        ws.close();
        resolve(Array.isArray(msg.items));
      }
    });
    
    ws.on('error', reject);
    setTimeout(() => reject(new Error('Timeout')), 5000);
  });
}

async function runValidation() {
  console.log('========================================');
  console.log('END-TO-END VALIDATION TEST');
  console.log('========================================\n');
  
  const tests = [
    { name: 'Ping/ACK', fn: testPing },
    { name: 'Text Message', fn: testTextMessage },
    { name: 'Presence System', fn: testPresence },
    { name: 'File Upload', fn: testFileUpload },
    { name: 'History Load', fn: testHistoryLoad }
  ];
  
  let passed = 0;
  let failed = 0;
  
  for (const test of tests) {
    try {
      process.stdout.write(`[TEST] ${test.name}... `);
      const result = await test.fn();
      if (result) {
        console.log('✅ PASS');
        passed++;
      } else {
        console.log('❌ FAIL');
        failed++;
      }
      await sleep(500);
    } catch (error) {
      console.log(`❌ FAIL (${error.message})`);
      failed++;
    }
  }
  
  console.log('\n========================================');
  console.log('VALIDATION RESULTS');
  console.log('========================================');
  console.log(`Total Tests: ${tests.length}`);
  console.log(`Passed: ${passed}`);
  console.log(`Failed: ${failed}`);
  console.log(`Success Rate: ${Math.round(passed / tests.length * 100)}%`);
  console.log('========================================\n');
  
  if (failed === 0) {
    console.log('✅ ALL TESTS PASSED - PRODUCTION READY\n');
    process.exit(0);
  } else {
    console.log('❌ SOME TESTS FAILED - REVIEW REQUIRED\n');
    process.exit(1);
  }
}

// Check if server is running
http.get('http://localhost:8080/healthz', (res) => {
  if (res.statusCode === 200) {
    runValidation();
  } else {
    console.error('Server is not responding correctly');
    process.exit(1);
  }
}).on('error', () => {
  console.error('ERROR: Server is not running on localhost:8080');
  console.error('Please start the server first: node server.js');
  process.exit(1);
});
