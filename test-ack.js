const WebSocket = require('ws');

console.log('Testing WebSocket ACK functionality...\n');

const ws = new WebSocket('ws://127.0.0.1:8080');

ws.on('open', () => {
  console.log('✓ Connected to WebSocket server');
  
  // Test 1: Ping with both id and messageId
  console.log('\n[TEST 1] Sending ping with id="t1" and messageId="t1"');
  ws.send(JSON.stringify({
    type: 'ping',
    id: 't1',
    messageId: 't1'
  }));
  
  // Test 2: Text message after 2 seconds
  setTimeout(() => {
    console.log('\n[TEST 2] Sending text message with id="t2" and messageId="t2"');
    ws.send(JSON.stringify({
      type: 'text',
      id: 't2',
      messageId: 't2',
      nickname: 'DAN',
      timestamp: Date.now(),
      text: 'hello'
    }));
    
    // Close after 1 more second
    setTimeout(() => {
      console.log('\n✓ Tests complete, closing connection...');
      ws.close();
    }, 1000);
  }, 2000);
});

ws.on('message', (data) => {
  const msg = JSON.parse(data.toString());
  console.log(`\n← Received: type=${msg.type}`);
  
  if (msg.type === 'history') {
    console.log(`  History items: ${msg.items.length}`);
  } else if (msg.type === 'ack') {
    console.log(`  ✓ ACK received!`);
    console.log(`    id: ${msg.id}`);
    console.log(`    messageId: ${msg.messageId}`);
    console.log(`    serverTime: ${msg.serverTime}`);
    console.log(`    instanceId: ${msg.instanceId}`);
  } else if (msg.type === 'pong') {
    console.log(`  Legacy pong received (id: ${msg.id})`);
  } else if (msg.type === 'text') {
    console.log(`  Broadcast text: "${msg.text}" from ${msg.nickname}`);
  } else {
    console.log(`  Full message:`, JSON.stringify(msg, null, 2));
  }
});

ws.on('close', () => {
  console.log('\n✓ Connection closed');
  process.exit(0);
});

ws.on('error', (error) => {
  console.error('✗ WebSocket error:', error.message);
  process.exit(1);
});
