# Exact Code Changes - Diff Summary

## server.js - 4 changes

### Change 1: Added Ping Handler (line ~352)
```diff
+     if (message.type === 'ping') {
+       // Handle ping - send ACK immediately for connection test
+       console.log(`[PING] Received ping from ${connectionId}, messageId=${msgId}`);
+       const ackPayload = {
+         type: 'ack',
+         messageId: msgId,
+         serverTime: new Date().toISOString(),
+         instanceId: SERVER_INSTANCE_ID
+       };
+       ws.send(JSON.stringify(ackPayload));
+       console.log(`[PING] Sent ACK for ping messageId=${msgId} to ${clientId}`);
+     } else if (message.type === 'text') {
-     if (message.type === 'text') {
```

### Change 2: Fixed Text Message ACK (line ~370)
```diff
       // Send ACK to sender immediately
       const ackPayload = {
         type: 'ack',
-        id: msgId,
-        timestamp: chatMessage.timestamp
+        messageId: msgId,
+        serverTime: new Date().toISOString(),
+        instanceId: SERVER_INSTANCE_ID
       };
       ws.send(JSON.stringify(ackPayload));
-      console.log(`[ACK] *** SERVER ${SERVER_INSTANCE_ID} *** Sent ACK for message id=${msgId}`);
+      console.log(`[ACK] *** SERVER ${SERVER_INSTANCE_ID} *** Sent ACK for messageId=${msgId} to ${clientId}`);
```

### Change 3: Fixed Image Message ACK (line ~397)
```diff
       // Send ACK to sender immediately
       const ackPayload = {
         type: 'ack',
-        id: msgId,
-        timestamp: chatMessage.timestamp
+        messageId: msgId,
+        serverTime: new Date().toISOString(),
+        instanceId: SERVER_INSTANCE_ID
       };
       ws.send(JSON.stringify(ackPayload));
-      console.log(`[ACK] *** SERVER ${SERVER_INSTANCE_ID} *** Sent ACK for image id=${msgId}`);
+      console.log(`[ACK] *** SERVER ${SERVER_INSTANCE_ID} *** Sent ACK for image messageId=${msgId} to ${clientId}`);
```

### Change 4: Fixed File Message ACK (line ~423)
```diff
       // Send ACK to sender immediately
       const ackPayload = {
         type: 'ack',
-        id: msgId,
-        timestamp: chatMessage.timestamp
+        messageId: msgId,
+        serverTime: new Date().toISOString(),
+        instanceId: SERVER_INSTANCE_ID
       };
       ws.send(JSON.stringify(ackPayload));
-      console.log(`[ACK] *** SERVER ${SERVER_INSTANCE_ID} *** Sent ACK for file id=${msgId}`);
+      console.log(`[ACK] *** SERVER ${SERVER_INSTANCE_ID} *** Sent ACK for file messageId=${msgId} to ${clientId}`);
```

### Change 5: Enhanced Message Logging (line ~333)
```diff
   ws.on('message', (data) => {
     try {
       const message = JSON.parse(data);
       const msgId = message.id || crypto.randomBytes(8).toString('hex');
-      console.log(`[MESSAGE] *** SERVER INSTANCE: ${SERVER_INSTANCE_ID} ***`);
-      console.log(`[MESSAGE] Received from ${connectionId}: type=${message.type}, id=${msgId}, size=${data.length} bytes`);
+      console.log(`[MESSAGE] ========================================`);
+      console.log(`[MESSAGE] *** SERVER INSTANCE: ${SERVER_INSTANCE_ID} ***`);
+      console.log(`[MESSAGE] Received from ${connectionId} (${clientId})`);
+      console.log(`[MESSAGE] Type: ${message.type}`);
+      console.log(`[MESSAGE] ID: ${msgId}`);
+      console.log(`[MESSAGE] Size: ${data.length} bytes`);
+      console.log(`[MESSAGE] Timestamp: ${new Date().toISOString()}`);
+      console.log(`[MESSAGE] ========================================`);
```

### Change 6: Enhanced Broadcast Logging (line ~243)
```diff
 function broadcast(message) {
   const data = JSON.stringify(message);
   let recipientCount = 0;
   
   wss.clients.forEach(client => {
     if (client.readyState === WebSocket.OPEN) {
       client.send(data);
       recipientCount++;
     }
   });
   
-  console.log(`[BROADCAST] Sent message type=${message.type} to ${recipientCount} clients`);
+  console.log(`[BROADCAST] Sent message type=${message.type}, id=${message.id} to ${recipientCount} clients`);
   return recipientCount;
 }
```

## index.html - 3 changes

### Change 1: Added Connection Self-Test (line ~678)
```diff
     ws.onopen = () => {
-      console.log('Connected to Kennedy Chat server');
+      console.log('========================================');
+      console.log('[CONNECT] ✓ WebSocket connection OPEN');
+      console.log('[CONNECT] URL:', WS_URL);
+      console.log('[CONNECT] Running connection self-test...');
+      console.log('========================================');
       clearTimeout(reconnectTimeout);
-      showStatus('Connected', 'success');
+      
+      // Send a ping to verify ACK path works
+      const pingId = generateUUID();
+      const pingMessage = {
+        type: 'ping',
+        id: pingId,
+        timestamp: Date.now()
+      };
+      
+      console.log('[SELF-TEST] Sending ping with messageId=' + pingId);
+      pendingMessages.set(pingId, { type: 'ping', testPing: true });
+      
+      // Set timeout for ping response
+      const pingTimeout = setTimeout(() => {
+        if (pendingMessages.has(pingId)) {
+          console.error('[SELF-TEST] ❌ FAILED - No ACK received for ping');
+          showStatus('Connected but ACK path not working', 'error');
+          pendingMessages.delete(pingId);
+        }
+      }, 3000);
+      
+      // Store timeout so we can clear it when ACK arrives
+      pendingMessages.get(pingId).timeout = pingTimeout;
+      
+      ws.send(JSON.stringify(pingMessage));
     };
```

### Change 2: Fixed ACK Handler to Use messageId (line ~695)
```diff
       } else if (data.type === 'ack') {
         // Handle ACK from server - mark message as sent
         console.log('[WS] ✓✓✓ ACK RECEIVED ✓✓✓');
-        console.log('[WS] ACK for message id=' + data.id);
-        console.log('[WS] Looking for element with data-msg-id=' + data.id);
+        console.log('[WS] ACK messageId=' + data.messageId);
+        console.log('[WS] ACK serverTime=' + data.serverTime);
+        console.log('[WS] ACK instanceId=' + data.instanceId);
         
-        const msgElement = document.querySelector(`[data-msg-id="${data.id}"]`);
+        // Check if this is a ping ACK (self-test)
+        const pendingMsg = pendingMessages.get(data.messageId);
+        if (pendingMsg && pendingMsg.testPing) {
+          console.log('[SELF-TEST] ✓ Ping ACK received - connection verified!');
+          console.log('[SELF-TEST] Server instance:', data.instanceId);
+          console.log('[SELF-TEST] Server time:', data.serverTime);
+          if (pendingMsg.timeout) {
+            clearTimeout(pendingMsg.timeout);
+          }
+          pendingMessages.delete(data.messageId);
+          showStatus('Connected ✓', 'success');
+          return;
+        }
+        
+        console.log('[WS] Looking for element with data-msg-id=' + data.messageId);
+        
+        const msgElement = document.querySelector(`[data-msg-id="${data.messageId}"]`);
         console.log('[WS] Found element:', msgElement ? 'YES' : 'NO');
         
         if (msgElement) {
           msgElement.classList.remove('message-sending');
           msgElement.classList.add('message-sent');
           const statusSpan = msgElement.querySelector('.message-status');
           if (statusSpan) {
             statusSpan.textContent = 'Sent ✓';
             setTimeout(() => statusSpan.remove(), 2000);
           }
           console.log('[WS] Message marked as SENT in UI');
         } else {
           console.warn('[WS] Could not find message element in DOM');
         }
         
         // Remove from pending
         console.log('[WS] Pending messages before removal:', Array.from(pendingMessages.keys()));
-        if (pendingMessages.has(data.id)) {
-          pendingMessages.delete(data.id);
-          console.log('[WS] ✓ Removed from pending:', data.id);
+        if (pendingMessages.has(data.messageId)) {
+          pendingMessages.delete(data.messageId);
+          console.log('[WS] ✓ Removed from pending:', data.messageId);
         } else {
-          console.warn('[WS] Message not in pending map:', data.id);
+          console.warn('[WS] Message not in pending map:', data.messageId);
         }
         console.log('[WS] Pending messages after removal:', Array.from(pendingMessages.keys()));
```

### Change 3: Enhanced Connection Logging (line ~674)
```diff
     function connect() {
-      console.log('Connecting to WebSocket:', WS_URL);
+      console.log('========================================');
+      console.log('[CONNECT] Attempting WebSocket connection');
+      console.log('[CONNECT] URL:', WS_URL);
+      console.log('[CONNECT] Protocol:', WS_URL.startsWith('wss://') ? 'Secure WebSocket (WSS)' : 'WebSocket (WS)');
+      console.log('========================================');
       ws = new WebSocket(WS_URL);
```

```diff
-      ws.onclose = () => {
-        console.log('Disconnected from chat server');
+      ws.onclose = (event) => {
+        console.log('========================================');
+        console.log('[CLOSE] WebSocket connection closed');
+        console.log('[CLOSE] Code:', event.code);
+        console.log('[CLOSE] Reason:', event.reason || 'none');
+        console.log('[CLOSE] Was clean:', event.wasClean);
+        console.log('========================================');
         showStatus('Disconnected. Reconnecting...', 'error');
         reconnectTimeout = setTimeout(connect, 3000);
       };

       ws.onerror = (error) => {
-        console.error('WebSocket error:', error);
+        console.error('========================================');
+        console.error('[ERROR] WebSocket error occurred');
+        console.error('[ERROR] URL was:', WS_URL);
+        console.error('[ERROR] Error object:', error);
+        console.error('========================================');
         showStatus('Connection error', 'error');
       };
```

## Summary

**Total lines changed:**
- server.js: ~40 lines (4 ACK payloads + ping handler + logging)
- index.html: ~60 lines (ACK handler + self-test + logging)

**Key schema change:**
```diff
- {type:"ack", id:"...", timestamp:123}
+ {type:"ack", messageId:"...", serverTime:"2025-12-19T...", instanceId:"abc123"}
```

**Files NOT touched:**
- upload-server.js (uploads working, not touched)
- package.json
- Cloudflare tunnel config (already correct)
