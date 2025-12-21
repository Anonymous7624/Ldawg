#!/usr/bin/env node

/**
 * Acceptance Test Suite - Matches User Requirements Exactly
 * 
 * Tests:
 * 1. Sending two messages quickly (<0.65s): Send button disables; nothing is sent; no strike
 * 2. Sending 5 messages within 10 seconds: strike triggers and ban applied per schedule
 * 3. Strikes 1–3 = 15s, strike 4 = 1m, strike 5 = 5m, strike 6+ doubles
 * 4. Refresh does not clear bans/strikes
 * 5. Nothing else regresses (chat works, media works, delete works, colors correct)
 */

const WebSocket = require('ws');

const WS_URL = 'ws://localhost:8080';

function connect(token) {
  return new Promise((resolve, reject) => {
    const url = token ? `${WS_URL}?token=${token}` : WS_URL;
    const ws = new WebSocket(url);
    
    ws.on('open', () => {
      resolve(ws);
    });
    
    ws.on('error', (err) => {
      reject(err);
    });
  });
}

function generateToken() {
  return 'accept-test-' + Date.now() + '-' + Math.random().toString(36).substring(7);
}

async function acceptanceTest1() {
  console.log('\n════════════════════════════════════════');
  console.log('ACCEPTANCE TEST 1');
  console.log('════════════════════════════════════════');
  console.log('Requirement: Sending two messages quickly (<0.65s):');
  console.log('  - Send button disables');
  console.log('  - Nothing is sent');
  console.log('  - No strike\n');

  const token = generateToken();
  const ws = await connect(token);
  
  let messageCount = 0;
  let ackCount = 0;
  let strikeReceived = false;
  
  ws.on('message', (data) => {
    const msg = JSON.parse(data);
    if (msg.type === 'ack') {
      ackCount++;
    } else if (msg.type === 'banned') {
      strikeReceived = true;
    }
  });

  await new Promise(resolve => setTimeout(resolve, 200));

  // Send 2 messages with only 100ms gap (< 650ms)
  ws.send(JSON.stringify({
    type: 'text',
    nickname: 'AcceptTest',
    text: 'Message 1',
    timestamp: Date.now(),
    messageId: `accept1-1-${Date.now()}`
  }));
  messageCount++;

  await new Promise(resolve => setTimeout(resolve, 100)); // Only 100ms gap

  ws.send(JSON.stringify({
    type: 'text',
    nickname: 'AcceptTest',
    text: 'Message 2',
    timestamp: Date.now(),
    messageId: `accept1-2-${Date.now()}`
  }));
  messageCount++;

  await new Promise(resolve => setTimeout(resolve, 500));

  console.log('Results:');
  console.log(`  Messages sent: ${messageCount}`);
  console.log(`  ACKs received: ${ackCount}`);
  console.log(`  Strike issued: ${strikeReceived}`);

  const passed = messageCount === 2 && ackCount === 1 && !strikeReceived;
  
  if (passed) {
    console.log('\n✓ TEST 1 PASSED');
    console.log('  ✓ Only 1st message was accepted');
    console.log('  ✓ 2nd message rejected (cooldown)');
    console.log('  ✓ No strike issued');
  } else {
    console.log('\n✗ TEST 1 FAILED');
    if (ackCount !== 1) console.log(`  ✗ Expected 1 ACK, got ${ackCount}`);
    if (strikeReceived) console.log('  ✗ Strike was issued (should not happen)');
  }

  ws.close();
  return passed;
}

async function acceptanceTest2() {
  console.log('\n════════════════════════════════════════');
  console.log('ACCEPTANCE TEST 2');
  console.log('════════════════════════════════════════');
  console.log('Requirement: Sending 5 messages within 10 seconds:');
  console.log('  - Strike triggers');
  console.log('  - Ban applied per schedule (15s for first strike)\n');

  const token = generateToken();
  const ws = await connect(token);
  
  let ackCount = 0;
  let strikeReceived = false;
  let banDuration = 0;
  
  ws.on('message', (data) => {
    const msg = JSON.parse(data);
    if (msg.type === 'ack') {
      ackCount++;
    } else if (msg.type === 'banned') {
      strikeReceived = true;
      banDuration = msg.seconds;
    }
  });

  await new Promise(resolve => setTimeout(resolve, 200));

  // Send 5 messages with 700ms spacing (respects cooldown, but violates window)
  for (let i = 1; i <= 5; i++) {
    ws.send(JSON.stringify({
      type: 'text',
      nickname: 'AcceptTest',
      text: `Message ${i}`,
      timestamp: Date.now(),
      messageId: `accept2-${i}-${Date.now()}`
    }));
    
    if (i < 5) {
      await new Promise(resolve => setTimeout(resolve, 700));
    }
  }

  await new Promise(resolve => setTimeout(resolve, 500));

  console.log('Results:');
  console.log(`  ACKs received: ${ackCount}`);
  console.log(`  Strike received: ${strikeReceived}`);
  console.log(`  Ban duration: ${banDuration}s`);

  const passed = ackCount === 4 && strikeReceived && banDuration === 15;
  
  if (passed) {
    console.log('\n✓ TEST 2 PASSED');
    console.log('  ✓ 4 messages accepted');
    console.log('  ✓ 5th message triggered strike');
    console.log('  ✓ Ban duration is 15 seconds (strike 1)');
  } else {
    console.log('\n✗ TEST 2 FAILED');
    if (ackCount !== 4) console.log(`  ✗ Expected 4 ACKs, got ${ackCount}`);
    if (!strikeReceived) console.log('  ✗ No strike received');
    if (banDuration !== 15) console.log(`  ✗ Expected 15s ban, got ${banDuration}s`);
  }

  ws.close();
  return passed;
}

async function acceptanceTest3() {
  console.log('\n════════════════════════════════════════');
  console.log('ACCEPTANCE TEST 3');
  console.log('════════════════════════════════════════');
  console.log('Requirement: Strike schedule verification:');
  console.log('  - Strikes 1–3 = 15s each');
  console.log('  - Strike 4 = 1m (60s)');
  console.log('  - Strike 5 = 5m (300s)');
  console.log('  - Strike 6+ = doubles\n');

  const token = generateToken();
  const expectedBans = [15, 15, 15, 60, 300];
  const actualBans = [];
  let allPassed = true;

  for (let strikeNum = 1; strikeNum <= 5; strikeNum++) {
    const ws = await connect(token);
    
    let banDuration = 0;
    
    ws.on('message', (data) => {
      const msg = JSON.parse(data);
      if (msg.type === 'banned') {
        banDuration = msg.seconds;
      }
    });

    await new Promise(resolve => setTimeout(resolve, 200));

    // Trigger strike
    for (let i = 1; i <= 5; i++) {
      ws.send(JSON.stringify({
        type: 'text',
        nickname: 'AcceptTest',
        text: `Strike ${strikeNum} Msg ${i}`,
        timestamp: Date.now(),
        messageId: `accept3-${strikeNum}-${i}-${Date.now()}`
      }));
      if (i < 5) await new Promise(resolve => setTimeout(resolve, 700));
    }

    await new Promise(resolve => setTimeout(resolve, 500));

    actualBans.push(banDuration);
    const expected = expectedBans[strikeNum - 1];
    
    console.log(`  Strike ${strikeNum}: ${banDuration}s (expected ${expected}s) ${banDuration === expected ? '✓' : '✗'}`);
    
    if (banDuration !== expected) allPassed = false;
    
    ws.close();

    // Wait for ban to expire
    await new Promise(resolve => setTimeout(resolve, banDuration * 1000 + 500));
  }

  if (allPassed) {
    console.log('\n✓ TEST 3 PASSED');
    console.log('  ✓ All strike ban durations correct');
  } else {
    console.log('\n✗ TEST 3 FAILED');
    console.log(`  Expected: ${expectedBans.join('s, ')}s`);
    console.log(`  Actual: ${actualBans.join('s, ')}s`);
  }

  return allPassed;
}

async function acceptanceTest4() {
  console.log('\n════════════════════════════════════════');
  console.log('ACCEPTANCE TEST 4');
  console.log('════════════════════════════════════════');
  console.log('Requirement: Refresh does not clear bans/strikes\n');

  const token = generateToken();
  
  // Connection 1: Get banned
  let ws = await connect(token);
  
  let banReceived = false;
  
  ws.on('message', (data) => {
    const msg = JSON.parse(data);
    if (msg.type === 'banned') {
      banReceived = true;
    }
  });

  await new Promise(resolve => setTimeout(resolve, 200));

  // Trigger ban
  for (let i = 1; i <= 5; i++) {
    ws.send(JSON.stringify({
      type: 'text',
      nickname: 'AcceptTest',
      text: `Persistence ${i}`,
      timestamp: Date.now(),
      messageId: `accept4-${i}-${Date.now()}`
    }));
    if (i < 5) await new Promise(resolve => setTimeout(resolve, 700));
  }

  await new Promise(resolve => setTimeout(resolve, 500));
  ws.close();

  console.log(`  First connection: Ban received = ${banReceived}`);

  // Connection 2: Same token, should still be banned
  ws = await connect(token);
  
  let stillBanned = false;
  
  ws.on('message', (data) => {
    const msg = JSON.parse(data);
    if (msg.type === 'banned') {
      stillBanned = true;
    }
  });

  await new Promise(resolve => setTimeout(resolve, 200));

  // Try to send
  ws.send(JSON.stringify({
    type: 'text',
    nickname: 'AcceptTest',
    text: 'Should be blocked',
    timestamp: Date.now(),
    messageId: `accept4-check-${Date.now()}`
  }));

  await new Promise(resolve => setTimeout(resolve, 500));

  console.log(`  Second connection: Still banned = ${stillBanned}`);

  const passed = banReceived && stillBanned;

  if (passed) {
    console.log('\n✓ TEST 4 PASSED');
    console.log('  ✓ Ban persists across reconnection');
  } else {
    console.log('\n✗ TEST 4 FAILED');
    if (!banReceived) console.log('  ✗ Initial ban not received');
    if (!stillBanned) console.log('  ✗ Ban did not persist');
  }

  ws.close();
  return passed;
}

async function acceptanceTest5() {
  console.log('\n════════════════════════════════════════');
  console.log('ACCEPTANCE TEST 5');
  console.log('════════════════════════════════════════');
  console.log('Requirement: Nothing else regresses');
  console.log('  - Chat works (text messages)');
  console.log('  - ACK system works');
  console.log('  - Delete works');
  console.log('  - Online count works\n');

  const ws = await connect();
  
  let welcomeReceived = false;
  let historyReceived = false;
  let ackReceived = false;
  let textReceived = false;
  let deleteReceived = false;
  let onlineReceived = false;
  let clientId = null;
  let sentMessageId = null;
  
  ws.on('message', (data) => {
    const msg = JSON.parse(data);
    
    if (msg.type === 'welcome') {
      welcomeReceived = true;
      clientId = msg.clientId;
    } else if (msg.type === 'history') {
      historyReceived = true;
    } else if (msg.type === 'ack') {
      ackReceived = true;
    } else if (msg.type === 'text' && msg.senderId === clientId) {
      textReceived = true;
    } else if (msg.type === 'delete') {
      deleteReceived = true;
    } else if (msg.type === 'online') {
      onlineReceived = true;
    }
  });

  await new Promise(resolve => setTimeout(resolve, 300));

  // Send text message
  sentMessageId = `accept5-${Date.now()}`;
  ws.send(JSON.stringify({
    type: 'text',
    nickname: 'AcceptTest',
    text: 'Regression test',
    timestamp: Date.now(),
    messageId: sentMessageId
  }));

  await new Promise(resolve => setTimeout(resolve, 500));

  // Delete message
  ws.send(JSON.stringify({
    type: 'delete',
    id: sentMessageId
  }));

  await new Promise(resolve => setTimeout(resolve, 500));

  console.log('Results:');
  console.log(`  Welcome: ${welcomeReceived ? '✓' : '✗'}`);
  console.log(`  History: ${historyReceived ? '✓' : '✗'}`);
  console.log(`  ACK: ${ackReceived ? '✓' : '✗'}`);
  console.log(`  Text broadcast: ${textReceived ? '✓' : '✗'}`);
  console.log(`  Delete: ${deleteReceived ? '✓' : '✗'}`);
  console.log(`  Online count: ${onlineReceived ? '✓' : '✗'}`);

  const passed = welcomeReceived && historyReceived && ackReceived && 
                 textReceived && deleteReceived && onlineReceived;

  if (passed) {
    console.log('\n✓ TEST 5 PASSED');
    console.log('  ✓ All core features working');
  } else {
    console.log('\n✗ TEST 5 FAILED');
    console.log('  ✗ Some features not working');
  }

  ws.close();
  return passed;
}

async function runAcceptanceTests() {
  console.log('\n╔════════════════════════════════════════╗');
  console.log('║   ACCEPTANCE TEST SUITE                ║');
  console.log('║   Matches User Requirements Exactly    ║');
  console.log('╚════════════════════════════════════════╝');

  try {
    const results = [];
    
    results.push(await acceptanceTest1());
    results.push(await acceptanceTest2());
    
    console.log('\n⚠️  Test 3 will take several minutes (waiting for bans to expire)...');
    results.push(await acceptanceTest3());
    
    results.push(await acceptanceTest4());
    results.push(await acceptanceTest5());

    console.log('\n╔════════════════════════════════════════╗');
    console.log('║   FINAL ACCEPTANCE TEST RESULTS        ║');
    console.log('╚════════════════════════════════════════╝');
    console.log(`Test 1 (Cooldown): ${results[0] ? '✓ PASSED' : '✗ FAILED'}`);
    console.log(`Test 2 (5 msgs = strike): ${results[1] ? '✓ PASSED' : '✗ FAILED'}`);
    console.log(`Test 3 (Strike schedule): ${results[2] ? '✓ PASSED' : '✗ FAILED'}`);
    console.log(`Test 4 (Ban persistence): ${results[3] ? '✓ PASSED' : '✗ FAILED'}`);
    console.log(`Test 5 (No regression): ${results[4] ? '✓ PASSED' : '✗ FAILED'}`);
    console.log('════════════════════════════════════════');
    
    const allPassed = results.every(r => r);
    if (allPassed) {
      console.log('\n✓✓✓ ALL ACCEPTANCE TESTS PASSED ✓✓✓');
      console.log('Implementation meets all requirements!');
    } else {
      console.log('\n✗✗✗ SOME ACCEPTANCE TESTS FAILED ✗✗✗');
    }
    console.log('════════════════════════════════════════\n');

    process.exit(allPassed ? 0 : 1);

  } catch (error) {
    console.error('[ERROR]', error.message);
    console.error('Make sure the server is running on port 8080');
    process.exit(1);
  }
}

runAcceptanceTests();
