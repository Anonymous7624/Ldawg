#!/usr/bin/env node

/**
 * Test Video Message Handling Fix
 * 
 * This script tests that video files are correctly identified and handled
 * as video (not audio) by the upload server.
 */

const fs = require('fs');
const path = require('path');
const FormData = require('form-data');
const http = require('http');
const https = require('https');

const UPLOAD_URL = process.env.UPLOAD_URL || 'http://localhost:8082/upload';
const TEST_DIR = path.join(__dirname, 'test-uploads');

// Ensure test directory exists
if (!fs.existsSync(TEST_DIR)) {
  fs.mkdirSync(TEST_DIR, { recursive: true });
}

console.log('========================================');
console.log('Video Message Handling Test');
console.log('========================================');
console.log('Upload URL:', UPLOAD_URL);
console.log('Test directory:', TEST_DIR);
console.log('');

/**
 * Create a fake video file for testing
 */
function createFakeVideoFile() {
  const videoPath = path.join(TEST_DIR, 'test-video.webm');
  
  // Create a minimal WebM video file (just a header, not playable but valid format)
  // This is the minimal WebM file signature
  const webmHeader = Buffer.from([
    0x1a, 0x45, 0xdf, 0xa3, 0x01, 0x00, 0x00, 0x00,
    0x00, 0x00, 0x00, 0x1f, 0x42, 0x86, 0x81, 0x01,
    0x42, 0xf7, 0x81, 0x01, 0x42, 0xf2, 0x81, 0x04,
    0x42, 0xf3, 0x81, 0x08, 0x42, 0x82, 0x88, 0x77,
    0x65, 0x62, 0x6d, 0x42, 0x87, 0x81, 0x02, 0x42,
    0x85, 0x81, 0x02
  ]);
  
  fs.writeFileSync(videoPath, webmHeader);
  console.log('✓ Created test video file:', videoPath);
  return videoPath;
}

/**
 * Create a fake audio file for testing
 */
function createFakeAudioFile() {
  const audioPath = path.join(TEST_DIR, 'test-audio.webm');
  
  // Create a minimal WebM audio file
  const webmAudioHeader = Buffer.from([
    0x1a, 0x45, 0xdf, 0xa3, 0x01, 0x00, 0x00, 0x00,
    0x00, 0x00, 0x00, 0x1f, 0x42, 0x86, 0x81, 0x01,
    0x42, 0xf7, 0x81, 0x01
  ]);
  
  fs.writeFileSync(audioPath, webmAudioHeader);
  console.log('✓ Created test audio file:', audioPath);
  return audioPath;
}

/**
 * Upload a file and return the response
 */
async function uploadFile(filePath, mimeType) {
  return new Promise((resolve, reject) => {
    const form = new FormData();
    const fileStream = fs.createReadStream(filePath);
    
    // Set the MIME type explicitly to simulate browser behavior
    form.append('file', fileStream, {
      filename: path.basename(filePath),
      contentType: mimeType
    });
    
    const url = new URL(UPLOAD_URL);
    const isHttps = url.protocol === 'https:';
    const client = isHttps ? https : http;
    
    const options = {
      hostname: url.hostname,
      port: url.port || (isHttps ? 443 : 80),
      path: url.pathname,
      method: 'POST',
      headers: form.getHeaders()
    };
    
    const req = client.request(options, (res) => {
      let data = '';
      
      res.on('data', (chunk) => {
        data += chunk;
      });
      
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          resolve({ statusCode: res.statusCode, body: json });
        } catch (err) {
          reject(new Error('Failed to parse response: ' + data));
        }
      });
    });
    
    req.on('error', (err) => {
      reject(err);
    });
    
    form.pipe(req);
  });
}

/**
 * Run tests
 */
async function runTests() {
  let passed = 0;
  let failed = 0;
  
  try {
    // Test 1: Upload video file with video MIME type
    console.log('\n[TEST 1] Upload .webm file with video/webm MIME type');
    const videoPath = createFakeVideoFile();
    const videoResult = await uploadFile(videoPath, 'video/webm');
    
    console.log('Response:', JSON.stringify(videoResult.body, null, 2));
    
    if (videoResult.statusCode === 200 && videoResult.body.success) {
      if (videoResult.body.isVideo === true) {
        console.log('✓ PASS: isVideo flag is true');
        passed++;
      } else {
        console.log('✗ FAIL: isVideo flag is', videoResult.body.isVideo, '(expected true)');
        failed++;
      }
      
      if (videoResult.body.isAudio === false) {
        console.log('✓ PASS: isAudio flag is false');
        passed++;
      } else {
        console.log('✗ FAIL: isAudio flag is', videoResult.body.isAudio, '(expected false)');
        failed++;
      }
      
      if (videoResult.body.mime && videoResult.body.mime.startsWith('video/')) {
        console.log('✓ PASS: MIME type is video/*:', videoResult.body.mime);
        passed++;
      } else {
        console.log('✗ FAIL: MIME type is', videoResult.body.mime, '(expected video/*)');
        failed++;
      }
    } else {
      console.log('✗ FAIL: Upload failed:', videoResult.body);
      failed += 3;
    }
    
    // Test 2: Upload audio file with audio MIME type
    console.log('\n[TEST 2] Upload .webm file with audio/webm MIME type');
    const audioPath = createFakeAudioFile();
    const audioResult = await uploadFile(audioPath, 'audio/webm');
    
    console.log('Response:', JSON.stringify(audioResult.body, null, 2));
    
    if (audioResult.statusCode === 200 && (audioResult.body.success || audioResult.body.ok)) {
      if (audioResult.body.isAudio === true) {
        console.log('✓ PASS: isAudio flag is true');
        passed++;
      } else {
        console.log('✗ FAIL: isAudio flag is', audioResult.body.isAudio, '(expected true)');
        failed++;
      }
      
      if (audioResult.body.isVideo === false) {
        console.log('✓ PASS: isVideo flag is false');
        passed++;
      } else {
        console.log('✗ FAIL: isVideo flag is', audioResult.body.isVideo, '(expected false)');
        failed++;
      }
    } else {
      console.log('✗ FAIL: Upload failed:', audioResult.body);
      failed += 2;
    }
    
  } catch (error) {
    console.error('\n✗ TEST ERROR:', error.message);
    console.error('Make sure the upload server is running on', UPLOAD_URL);
    failed++;
  }
  
  // Summary
  console.log('\n========================================');
  console.log('Test Results');
  console.log('========================================');
  console.log('Passed:', passed);
  console.log('Failed:', failed);
  console.log('Total:', passed + failed);
  console.log('========================================');
  
  if (failed === 0) {
    console.log('\n✓ ALL TESTS PASSED');
    process.exit(0);
  } else {
    console.log('\n✗ SOME TESTS FAILED');
    process.exit(1);
  }
}

// Run the tests
runTests().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
