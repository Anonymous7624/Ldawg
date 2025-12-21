#!/usr/bin/env node

/**
 * Comprehensive test for new rate limit changes:
 * 1. Cooldown: 0.65s per message (client + server)
 * 2. Rolling window: 4 messages per 10s (5th triggers strike)
 * 3. Strike schedule: 1-3=15s, 4=60s, 5=300s, 6+=doubles
 */

const WebSocket = require('ws');

const WS_URL = 'ws://localhost:8080';

function connect(token) {
  return new Promise((resolve, reject) => {
    const url = token ? `${WS_URL}?token=${token}` : WS_URL;
    const ws = new WebSocket(url);
    
    ws.on('open', () => {
      console.log('[TEST] Connected to server');
      resolve(ws);
    });
    
    ws.on('error', (err) => {
      reject(err);
    });
  });
}

function generateToken() {
  return 'test-token-' + Date.now() + '-' + Math.random().toString(36).substring(7);
}

async function testCooldownServerSide() {
  console.log('\n========================================');
  console.log('TEST 1: Server-side cooldown (safety net)');
  console.log('========================================');
  console.log('Sending 2 messages < 650ms apart');
  console.log('Expected: 1st accepted, 2nd rejected without strike\n');

  const token = generateToken();
  const ws = await connect(token);
  
  let ackCount = 0;
  let cooldownReceived = false;
  let bannedReceived = false;
  
  ws.on('message', (data) => {
    const msg = JSON.parse(data);
    
    if (msg.type === 'ack') {
      ackCount++;
      console.log(`[TEST] ✓ ACK received (#${ackCount})`);
    } else if (msg.type === 'cooldown') {
      cooldownReceived = true;
      console.log(`[TEST] ✓ Cooldown rejection received (no strike)`);
    } else if (msg.type === 'banned') {
      bannedReceived = true;
      console.log(`[TEST] ✗ BANNED received (unexpected!)`);
    }
  });

  // Wait for welcome/history
  await new Promise(resolve => setTimeout(resolve, 200));

  // Send 2 messages very quickly (< 650ms apart)
  ws.send(JSON.stringify({
    type: 'text',
    nickname: 'TestUser',
    text: 'Message 1',
    timestamp: Date.now(),
    messageId: `test-cooldown-1-${Date.now()}`
  }));
  console.log('[TEST] Sent message 1');

  // Wait only 100ms (less than 650ms cooldown)
  await new Promise(resolve => setTimeout(resolve, 100));

  ws.send(JSON.stringify({
    type: 'text',
    nickname: 'TestUser',
    text: 'Message 2',
    timestamp: Date.now(),
    messageId: `test-cooldown-2-${Date.now()}`
  }));
  console.log('[TEST] Sent message 2 (100ms after message 1)');

  // Wait for responses
  await new Promise(resolve => setTimeout(resolve, 500));

  console.log('\nResults:');
  console.log(`- ACKs received: ${ackCount}`);
  console.log(`- Cooldown rejections: ${cooldownReceived ? 1 : 0}`);
  console.log(`- Bans: ${bannedReceived ? 1 : 0}`);

  const passed = ackCount === 1 && !bannedReceived;
  console.log(passed ? '✓ TEST PASSED' : '✗ TEST FAILED');
  
  ws.close();
  return passed;
}

async function testRollingWindow() {
  console.log('\n========================================');
  console.log('TEST 2: Rolling window (4 per 10s)');
  console.log('========================================');
  console.log('Sending 5 messages within 10 seconds');
  console.log('Expected: 4 accepted, 5th triggers strike & 15s ban\n');

  const token = generateToken();
  const ws = await connect(token);
  
  let ackCount = 0;
  let bannedReceived = false;
  let banDuration = 0;
  let strikes = 0;
  
  ws.on('message', (data) => {
    const msg = JSON.parse(data);
    
    if (msg.type === 'ack') {
      ackCount++;
      console.log(`[TEST] ✓ ACK received (#${ackCount})`);
    } else if (msg.type === 'banned') {
      bannedReceived = true;
      banDuration = msg.seconds;
      strikes = msg.strikes;
      console.log(`[TEST] ⚠️  BANNED after ${ackCount} messages`);
      console.log(`[TEST] Ban duration: ${msg.seconds}s`);
      console.log(`[TEST] Strikes: ${msg.strikes}`);
    }
  });

  // Wait for welcome/history
  await new Promise(resolve => setTimeout(resolve, 200));

  // Send 5 messages with proper cooldown spacing (700ms apart)
  for (let i = 1; i <= 5; i++) {
    ws.send(JSON.stringify({
      type: 'text',
      nickname: 'TestUser',
      text: `Message ${i}`,
      timestamp: Date.now(),
      messageId: `test-window-${i}-${Date.now()}`
    }));
    console.log(`[TEST] Sent message ${i}`);
    
    if (i < 5) {
      // Wait 700ms between messages (respects cooldown)
      await new Promise(resolve => setTimeout(resolve, 700));
    }
  }

  // Wait for final responses
  await new Promise(resolve => setTimeout(resolve, 500));

  console.log('\nResults:');
  console.log(`- ACKs received: ${ackCount}`);
  console.log(`- Ban triggered: ${bannedReceived ? 'YES' : 'NO'}`);
  console.log(`- Ban duration: ${banDuration}s`);
  console.log(`- Strikes: ${strikes}`);

  const passed = ackCount === 4 && bannedReceived && banDuration === 15 && strikes === 1;
  console.log(passed ? '✓ TEST PASSED' : '✗ TEST FAILED');
  
  ws.close();
  return passed;
}

async function testStrikeEscalation() {
  console.log('\n========================================');
  console.log('TEST 3: Strike escalation schedule');
  console.log('========================================');
  console.log('Testing ban durations for strikes 1-5');
  console.log('Expected: 15s, 15s, 15s, 60s, 300s\n');

  const token = generateToken();
  const expectedBans = [15, 15, 15, 60, 300];
  const actualBans = [];
  let allPassed = true;

  for (let strikeNum = 1; strikeNum <= 5; strikeNum++) {
    console.log(`\n--- Testing Strike ${strikeNum} ---`);
    
    const ws = await connect(token);
    
    let banDuration = 0;
    let bannedReceived = false;
    
    ws.on('message', (data) => {
      const msg = JSON.parse(data);
      
      if (msg.type === 'banned') {
        bannedReceived = true;
        banDuration = msg.seconds;
      }
    });

    // Wait for welcome/history
    await new Promise(resolve => setTimeout(resolve, 200));

    // Trigger a strike by sending 5 messages quickly (with cooldown spacing)
    for (let i = 1; i <= 5; i++) {
      ws.send(JSON.stringify({
        type: 'text',
        nickname: 'TestUser',
        text: `Strike ${strikeNum} - Message ${i}`,
        timestamp: Date.now(),
        messageId: `test-strike-${strikeNum}-${i}-${Date.now()}`
      }));
      
      if (i < 5) {
        await new Promise(resolve => setTimeout(resolve, 700));
      }
    }

    // Wait for ban response
    await new Promise(resolve => setTimeout(resolve, 500));

    actualBans.push(banDuration);
    const expected = expectedBans[strikeNum - 1];
    const passed = banDuration === expected;
    
    console.log(`Expected ban: ${expected}s`);
    console.log(`Actual ban: ${banDuration}s`);
    console.log(passed ? '✓ Strike test passed' : '✗ Strike test failed');
    
    if (!passed) allPassed = false;
    
    ws.close();

    // Wait for ban to expire plus buffer before next strike test
    const waitTime = banDuration * 1000 + 1000;
    console.log(`Waiting ${(waitTime / 1000).toFixed(1)}s for ban to expire...`);
    await new Promise(resolve => setTimeout(resolve, waitTime));
  }

  console.log('\n--- Escalation Summary ---');
  console.log('Expected:', expectedBans.join('s, ') + 's');
  console.log('Actual:', actualBans.join('s, ') + 's');
  console.log(allPassed ? '✓ ALL STRIKES PASSED' : '✗ SOME STRIKES FAILED');

  return allPassed;
}

async function testBanPersistence() {
  console.log('\n========================================');
  console.log('TEST 4: Ban persistence across reconnect');
  console.log('========================================');
  console.log('Triggering ban, then reconnecting with same token\n');

  const token = generateToken();
  
  // First connection: trigger a ban
  console.log('--- First connection ---');
  let ws = await connect(token);
  
  let banDuration = 0;
  let bannedReceived = false;
  
  ws.on('message', (data) => {
    const msg = JSON.parse(data);
    if (msg.type === 'banned') {
      bannedReceived = true;
      banDuration = msg.seconds;
      console.log(`[TEST] Ban triggered: ${banDuration}s`);
    }
  });

  await new Promise(resolve => setTimeout(resolve, 200));

  // Trigger ban with 5 messages
  for (let i = 1; i <= 5; i++) {
    ws.send(JSON.stringify({
      type: 'text',
      nickname: 'TestUser',
      text: `Persistence test ${i}`,
      timestamp: Date.now(),
      messageId: `test-persist-${i}-${Date.now()}`
    }));
    if (i < 5) await new Promise(resolve => setTimeout(resolve, 700));
  }

  await new Promise(resolve => setTimeout(resolve, 500));
  ws.close();

  if (!bannedReceived) {
    console.log('✗ TEST FAILED: No ban triggered');
    return false;
  }

  // Second connection: try to send immediately (should still be banned)
  console.log('\n--- Second connection (same token) ---');
  ws = await connect(token);
  
  let stillBanned = false;
  
  ws.on('message', (data) => {
    const msg = JSON.parse(data);
    if (msg.type === 'banned') {
      stillBanned = true;
      console.log(`[TEST] ✓ Still banned: ${msg.seconds}s remaining`);
    }
  });

  await new Promise(resolve => setTimeout(resolve, 200));

  // Try to send a message
  ws.send(JSON.stringify({
    type: 'text',
    nickname: 'TestUser',
    text: 'Should be rejected',
    timestamp: Date.now(),
    messageId: `test-persist-check-${Date.now()}`
  }));
  console.log('[TEST] Attempted to send while banned');

  await new Promise(resolve => setTimeout(resolve, 500));

  console.log('\nResults:');
  console.log(`- Initial ban: ${bannedReceived ? 'YES' : 'NO'}`);
  console.log(`- Still banned after reconnect: ${stillBanned ? 'YES' : 'NO'}`);
  console.log(stillBanned ? '✓ TEST PASSED' : '✗ TEST FAILED');

  ws.close();
  return stillBanned;
}

async function runAllTests() {
  console.log('\n========================================');
  console.log('RATE LIMIT TEST SUITE');
  console.log('========================================');
  console.log('Testing new rate limit implementation:');
  console.log('- Cooldown: 0.65s (650ms)');
  console.log('- Rolling window: 4 messages per 10s');
  console.log('- Strikes: 1-3=15s, 4=60s, 5=300s, 6+=doubles');
  console.log('========================================');

  try {
    const results = [];
    
    // Test 1: Cooldown
    results.push(await testCooldownServerSide());
    
    // Test 2: Rolling window
    results.push(await testRollingWindow());
    
    // Test 3: Strike escalation (this will take a while)
    console.log('\n⚠️  Note: Strike escalation test will take several minutes...');
    results.push(await testStrikeEscalation());
    
    // Test 4: Ban persistence
    results.push(await testBanPersistence());

    // Summary
    console.log('\n========================================');
    console.log('FINAL RESULTS');
    console.log('========================================');
    console.log(`Test 1 (Cooldown): ${results[0] ? '✓ PASSED' : '✗ FAILED'}`);
    console.log(`Test 2 (Rolling Window): ${results[1] ? '✓ PASSED' : '✗ FAILED'}`);
    console.log(`Test 3 (Strike Escalation): ${results[2] ? '✓ PASSED' : '✗ FAILED'}`);
    console.log(`Test 4 (Ban Persistence): ${results[3] ? '✓ PASSED' : '✗ FAILED'}`);
    console.log('========================================');
    
    const allPassed = results.every(r => r);
    console.log(allPassed ? '\n✓ ALL TESTS PASSED' : '\n✗ SOME TESTS FAILED');
    console.log('========================================\n');

    process.exit(allPassed ? 0 : 1);

  } catch (error) {
    console.error('[TEST] Error:', error.message);
    console.error('[TEST] Make sure the server is running on port 8080');
    process.exit(1);
  }
}

// Run tests
runAllTests();
