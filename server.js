const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const url = require('url');
const { initDb, saveMessage, getRecentMessages, deleteMessageById, pruneToLimit } = require('./db');

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

// Environment-driven configuration
const PORT = parseInt(process.env.WS_PORT || '8080', 10);
const UPLOAD_DIR = process.env.UPLOAD_DIR || path.join(__dirname, 'uploads');
const DB_PATH = process.env.DB_PATH || path.join(__dirname, 'chat.db');
const MAX_MESSAGES = parseInt(process.env.MAX_MESSAGES || '600', 10);
const MAX_UPLOAD_SIZE = 10 * 1024 * 1024; // 10MB
const RATE_LIMIT_MESSAGES = 4; // 4 messages per window
const RATE_LIMIT_WINDOW = 1000; // 1 second (rolling window)

// Helper to generate client IDs
function makeId() { 
  return crypto.randomBytes(4).toString('hex'); 
}

// Helper to generate UUIDs for tokens
function makeUUID() {
  return crypto.randomBytes(16).toString('hex');
}

// Log all HTTP requests
app.use((req, res, next) => {
  console.log(`[HTTP] ${req.method} ${req.url} - Origin: ${req.headers.origin || 'none'} - User-Agent: ${req.headers['user-agent']?.substring(0, 50) || 'none'}`);
  next();
});

// CORS middleware - allows GitHub Pages to access this API
app.use((req, res, next) => {
  const allowedOrigins = [
    'https://ldawg7624.com',
    'https://www.ldawg7624.com',
    'http://localhost:8080', // For local testing
    'http://127.0.0.1:8080'
  ];
  
  const origin = req.headers.origin;
  
  // Log all requests to /upload for debugging
  if (req.path === '/upload' || req.path.startsWith('/uploads/')) {
    console.log(`[CORS] ${req.method} ${req.path} - Origin: ${origin || 'none'}`);
  }
  
  if (origin && allowedOrigins.includes(origin)) {
    res.header('Access-Control-Allow-Origin', origin);
    res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Content-Type');
  } else if (!origin) {
    // No origin header (direct access) - allow it
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Content-Type');
  }
  
  if (req.method === 'OPTIONS') {
    console.log(`[CORS] OPTIONS preflight - Origin: ${origin || 'none'} - Status: 204`);
    return res.status(204).end();
  }
  next();
});

// In-memory state
const clients = new Map(); // ws -> { clientId, token, presenceOnline }
const clientState = new Map(); // token -> { strikes, stage, bannedUntil, msgTimes }

// Ensure uploads directory exists (for serving files)
if (!fs.existsSync(UPLOAD_DIR)) {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
  console.log(`[STARTUP] Created upload directory: ${UPLOAD_DIR}`);
}

// Serve static files
app.use(express.static(__dirname));

// Health check endpoint
app.get('/healthz', (req, res) => {
  res.json({ ok: true });
});

// Serve uploads with security headers
app.get('/uploads/:filename', (req, res) => {
  const filename = req.params.filename;
  const filePath = path.join(UPLOAD_DIR, filename);
  const origin = req.headers.origin || 'direct';

  console.log(`[UPLOADS] GET request for ${filename} from origin: ${origin}`);

  if (!fs.existsSync(filePath)) {
    console.log(`[UPLOADS] File not found: ${filename}`);
    return res.status(404).send('File not found');
  }

  const ext = path.extname(filename).toLowerCase();
  const imageExts = ['.jpg', '.jpeg', '.png', '.webp', '.gif'];
  const videoExts = ['.mp4', '.webm', '.ogg', '.mov'];
  const isImage = imageExts.includes(ext);
  const isVideo = videoExts.includes(ext);

  // Set security headers
  res.setHeader('X-Content-Type-Options', 'nosniff');
  
  // Don't force download for images and videos
  if (!isImage && !isVideo) {
    res.setHeader('Content-Disposition', 'attachment');
  }
  
  // Set proper MIME type for videos
  if (isVideo) {
    if (ext === '.webm') res.setHeader('Content-Type', 'video/webm');
    else if (ext === '.mp4') res.setHeader('Content-Type', 'video/mp4');
    else if (ext === '.ogg') res.setHeader('Content-Type', 'video/ogg');
    else if (ext === '.mov') res.setHeader('Content-Type', 'video/quicktime');
  }

  console.log(`[UPLOADS] Serving file: ${filename} (${isImage ? 'image' : isVideo ? 'video' : 'file'})`);
  res.sendFile(filePath);
});

// Helper to extract filename from URL
function extractFilename(urlString) {
  if (!urlString) return null;
  try {
    const urlPath = urlString.split('?')[0]; // Remove query params
    return path.basename(urlPath);
  } catch {
    return null;
  }
}

// Broadcast message to all connected clients
function broadcast(message) {
  const data = JSON.stringify(message);
  let recipientCount = 0;
  
  wss.clients.forEach(client => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(data);
      recipientCount++;
    }
  });
  
  console.log(`[BROADCAST] Sent message type=${message.type}, id=${message.id} to ${recipientCount} clients`);
  return recipientCount;
}

// Broadcast online count
function broadcastOnlineCount() {
  let count = 0;
  for (const [, info] of clients) {
    if (info.presenceOnline) count++;
  }
  const payload = JSON.stringify({ type: 'online', count });
  for (const [ws] of clients) {
    if (ws.readyState === ws.OPEN) ws.send(payload);
  }
  console.log(`[ONLINE] Broadcasting count: ${count}`);
}

// Rate limiting with escalating bans
function now() { return Date.now(); }

function isBanned(info) {
  return now() < info.bannedUntil;
}

function banFor(info, ms) {
  info.bannedUntil = now() + ms;
}

function violationBanMs(info) {
  // stage meanings:
  // stage 0: pre-escalation (15s bans, strikes accumulate)
  // stage 1: did the 1-minute ban already
  // stage >=2: 5m, 10m, 15m, ... (increasing by 5m each violation)
  if (info.stage >= 2) {
    const minutes = 5 * (info.stage - 1); // stage2=5m, stage3=10m...
    return minutes * 60 * 1000;
  }
  if (info.stage === 1) return 5 * 60 * 1000; // next after 1-min is 5m
  return 15 * 1000;
}

function registerViolation(info, messageCount, windowMs) {
  // if we already hit stage>=1, escalate stage each violation
  if (info.stage >= 1) {
    info.stage += 1; // stage1->2 gives 5m, then grows
    const banDurationMs = violationBanMs(info);
    banFor(info, banDurationMs);
    console.log(`[RATE-LIMIT-BAN] Violation detected: ${messageCount} messages in ${windowMs}ms window | Stage: ${info.stage} | Ban duration: ${Math.ceil(banDurationMs / 1000)}s`);
    return;
  }

  // stage 0: strikes
  info.strikes += 1;
  if (info.strikes >= 3) {
    info.stage = 1;           // mark that we hit the 1-min level
    info.strikes = 0;         // reset strikes after escalation
    banFor(info, 60 * 1000);  // 1 minute
    console.log(`[RATE-LIMIT-BAN] Violation detected: ${messageCount} messages in ${windowMs}ms window | Strikes reached 3, escalating to stage 1 | Ban duration: 60s`);
  } else {
    banFor(info, 15 * 1000);
    console.log(`[RATE-LIMIT-BAN] Violation detected: ${messageCount} messages in ${windowMs}ms window | Strike ${info.strikes}/3 | Ban duration: 15s`);
  }
}

function checkRateLimit(state) {
  if (!state) return { allowed: false };

  if (isBanned(state)) {
    return {
      allowed: false,
      muted: true,
      seconds: Math.ceil((state.bannedUntil - now()) / 1000),
      strikes: state.strikes
    };
  }

  const windowMs = RATE_LIMIT_WINDOW;
  const limit = RATE_LIMIT_MESSAGES;

  // Keep timestamps inside last window
  state.msgTimes = state.msgTimes.filter(ts => now() - ts < windowMs);
  state.msgTimes.push(now());

  if (state.msgTimes.length > limit) {
    registerViolation(state, state.msgTimes.length, windowMs);
    return {
      allowed: false,
      muted: true,
      seconds: Math.ceil((state.bannedUntil - now()) / 1000),
      strikes: state.strikes
    };
  }

  return { allowed: true };
}

// Get or create client state by token
function getClientState(token) {
  if (!clientState.has(token)) {
    clientState.set(token, {
      strikes: 0,
      stage: 0,
      bannedUntil: 0,
      msgTimes: []
    });
  }
  return clientState.get(token);
}

// Generate unique server instance ID
const SERVER_INSTANCE_ID = crypto.randomBytes(6).toString('hex');

// WebSocket connection handler
wss.on('connection', async (ws, req) => {
  const clientId = makeId();
  const connectionId = clientId;
  
  // Parse token from query string
  const queryParams = url.parse(req.url, true).query;
  let token = queryParams.token;
  
  // If no token provided, generate one
  if (!token) {
    token = makeUUID();
    console.log(`[CONNECT] No token provided, generated: ${token}`);
  } else {
    console.log(`[CONNECT] Client provided token: ${token}`);
  }
  
  console.log(`[CONNECT] *** SERVER INSTANCE: ${SERVER_INSTANCE_ID} ***`);
  console.log(`[CONNECT] Client connected: ${clientId} (token: ${token.substring(0, 8)}...)`);
  console.log(`[CONNECT] Total clients: ${wss.clients.size}`);

  // Initialize client info (connection-specific)
  clients.set(ws, {
    clientId,
    token,
    presenceOnline: true   // default true until told otherwise
  });

  // Get or create client state (persistent by token)
  const state = getClientState(token);

  // Send welcome with clientId and token
  ws.send(JSON.stringify({ 
    type: 'welcome', 
    clientId,
    token // Send token back so client can store it if needed
  }));

  // Send chat history from database
  try {
    const items = await getRecentMessages(MAX_MESSAGES);
    ws.send(JSON.stringify({
      type: 'history',
      items: items
    }));
    console.log(`[HISTORY] Sent ${items.length} messages to ${connectionId} from DB`);
  } catch (error) {
    console.error(`[HISTORY] Error loading history for ${connectionId}:`, error);
    // Send empty history on error
    ws.send(JSON.stringify({
      type: 'history',
      items: []
    }));
  }

  // Broadcast updated online count
  broadcastOnlineCount();

  ws.on('message', async (data) => {
    try {
      const message = JSON.parse(data);
      const info = clients.get(ws);
      if (!info) return;

      // Get persistent state by token
      const state = getClientState(info.token);

      // Backward compatible: accept both messageId and id
      const msgId = message.messageId || message.id || crypto.randomBytes(8).toString('hex');
      console.log(`[MESSAGE] ========================================`);
      console.log(`[MESSAGE] *** SERVER INSTANCE: ${SERVER_INSTANCE_ID} ***`);
      console.log(`[MESSAGE] Received from ${connectionId} (token: ${info.token.substring(0, 8)}...)`);
      console.log(`[MESSAGE] Type: ${message.type}`);
      console.log(`[MESSAGE] ID: ${msgId}`);
      console.log(`[MESSAGE] message.messageId: ${message.messageId}`);
      console.log(`[MESSAGE] message.id: ${message.id}`);
      console.log(`[MESSAGE] Size: ${data.length} bytes`);
      console.log(`[MESSAGE] Timestamp: ${new Date().toISOString()}`);
      console.log(`[MESSAGE] ========================================`);

      // Handle presence messages (don't rate limit these)
      if (message.type === "presence") {
        info.presenceOnline = !!message.online;
        broadcastOnlineCount();
        return;
      }

      // Handle typing indicator (don't rate limit)
      if (message.type === "typing") {
        // Broadcast to all other clients with senderId
        const typingMsg = {
          type: 'typing',
          senderId: info.clientId,
          nickname: message.nickname || 'Anonymous',
          isTyping: !!message.isTyping,
          ts: message.ts || Date.now()
        };
        
        // Send to all clients except sender
        wss.clients.forEach(client => {
          if (client !== ws && client.readyState === WebSocket.OPEN) {
            client.send(JSON.stringify(typingMsg));
          }
        });
        
        return;
      }

      // Ping -> ACK (so browser self-test passes, don't rate limit)
      if (message.type === "ping") {
        ws.send(JSON.stringify({
          type: "ack",
          id: msgId,
          messageId: msgId,
          serverTime: new Date().toISOString(),
          instanceId: SERVER_INSTANCE_ID
        }));
        return;
      }

      // Handle delete messages (don't rate limit)
      if (message.type === "delete") {
        console.log(`[DELETE] ========================================`);
        console.log(`[DELETE] Delete request received`);
        console.log(`[DELETE] From clientId: ${info.clientId}`);
        console.log(`[DELETE] Token: ${info.token.substring(0, 8)}...`);
        console.log(`[DELETE] Message ID to delete: ${message.id}`);
        
        const deleteId = typeof message.id === "string" ? message.id : null;
        if (!deleteId) {
          console.log(`[DELETE] ❌ Invalid delete ID (not a string)`);
          console.log(`[DELETE] ========================================`);
          return;
        }

        try {
          // Get messages from DB to check ownership
          const allMessages = await getRecentMessages(MAX_MESSAGES);
          const messageToDelete = allMessages.find(m => m.id === deleteId);
          
          if (!messageToDelete) {
            console.log(`[DELETE] ❌ Message not found in database`);
            console.log(`[DELETE] ========================================`);
            return;
          }

          console.log(`[DELETE] Found message in database`);
          console.log(`[DELETE] Message senderId: ${messageToDelete.senderId}`);
          console.log(`[DELETE] Requester clientId: ${info.clientId}`);
          console.log(`[DELETE] Ownership match: ${messageToDelete.senderId === info.clientId}`);

          // Only allow if sender matches
          if (messageToDelete.senderId !== info.clientId) {
            console.log(`[DELETE] ❌ Denied: ownership mismatch`);
            console.log(`[DELETE] ${info.clientId} tried to delete message from ${messageToDelete.senderId}`);
            console.log(`[DELETE] ========================================`);
            return;
          }

          // Delete from database (files are NOT deleted here per requirements)
          await deleteMessageById(deleteId);
          console.log(`[DELETE] ✓ Removed from database`);

          // Tell everyone to remove it
          const recipientCount = broadcast({ type: "delete", id: deleteId });
          console.log(`[DELETE] ✓ Broadcasted delete to ${recipientCount} clients`);
          console.log(`[DELETE] ✓ Message ${deleteId} successfully deleted by ${info.clientId}`);
          console.log(`[DELETE] ========================================`);
        } catch (dbError) {
          console.error(`[DELETE] ❌ Database error:`, dbError);
          console.log(`[DELETE] ========================================`);
        }
        
        return;
      }

      // Rate limit check for user messages (text, image, audio, video, file) - USE STATE BY TOKEN
      const sendTypes = new Set(["text", "image", "audio", "video", "file"]);
      if (sendTypes.has(message.type)) {
        if (isBanned(state)) {
          ws.send(JSON.stringify({ 
            type: 'banned', 
            until: state.bannedUntil,
            seconds: Math.ceil((state.bannedUntil - now()) / 1000),
            reason: 'rate'
          }));
          return;
        }

        const rateLimitResult = checkRateLimit(state);
        if (!rateLimitResult.allowed) {
          console.log(`[RATE-LIMIT] Client ${connectionId} (token ${info.token.substring(0, 8)}...) banned for ${rateLimitResult.seconds}s (strikes: ${rateLimitResult.strikes})`);
          ws.send(JSON.stringify({
            type: 'banned',
            until: state.bannedUntil,
            seconds: rateLimitResult.seconds,
            strikes: rateLimitResult.strikes,
            reason: 'rate'
          }));
          return;
        }
      }
      
      if (message.type === 'text') {
        // Validate input
        const nickname = (message.nickname || 'Anonymous').substring(0, 100);
        const text = (message.text || '').substring(0, 1000);
        const html = (message.html || '').substring(0, 5000); // Allow HTML but limit size

        if (!text.trim()) {
          console.log(`[MESSAGE] Ignored empty text from ${connectionId}`);
          return;
        }

        const chatMessage = {
          type: 'text',
          id: msgId,
          senderId: info.clientId,
          nickname,
          timestamp: message.timestamp || Date.now(),
          text,
          html: html || undefined // Include HTML if present
        };

        // Send ACK to sender immediately
        const ackPayload = {
          type: 'ack',
          id: msgId,
          messageId: msgId,
          serverTime: new Date().toISOString(),
          instanceId: SERVER_INSTANCE_ID
        };
        ws.send(JSON.stringify(ackPayload));
        console.log(`[ACK] *** SERVER ${SERVER_INSTANCE_ID} *** Sent ACK for id=${msgId} messageId=${msgId}`);

        // Save to database and prune
        try {
          await saveMessage(chatMessage);
          await pruneToLimit(MAX_MESSAGES);
        } catch (dbError) {
          console.error(`[DB] Error saving text message:`, dbError);
        }

        broadcast(chatMessage);
        console.log(`[MESSAGE] Text message from ${nickname}: "${text.substring(0, 50)}${text.length > 50 ? '...' : ''}"`);
      } else if (message.type === 'image') {
        const nickname = (message.nickname || 'Anonymous').substring(0, 100);

        const chatMessage = {
          type: 'image',
          id: msgId,
          senderId: info.clientId,
          nickname,
          timestamp: message.timestamp || Date.now(),
          url: message.url,
          filename: message.filename,
          mime: message.mime,
          size: message.size,
          caption: message.caption || ''
        };

        // Send ACK to sender immediately
        const ackPayload = {
          type: 'ack',
          id: msgId,
          messageId: msgId,
          serverTime: new Date().toISOString(),
          instanceId: SERVER_INSTANCE_ID
        };
        ws.send(JSON.stringify(ackPayload));
        console.log(`[ACK] *** SERVER ${SERVER_INSTANCE_ID} *** Sent ACK for image id=${msgId} messageId=${msgId}`);

        // Save to database and prune
        try {
          await saveMessage(chatMessage);
          await pruneToLimit(MAX_MESSAGES);
        } catch (dbError) {
          console.error(`[DB] Error saving image message:`, dbError);
        }

        broadcast(chatMessage);
        console.log(`[MESSAGE] Image from ${nickname}: ${message.filename} (${message.size} bytes)`);
      } else if (message.type === 'audio') {
        const nickname = (message.nickname || 'Anonymous').substring(0, 100);
        const caption = message.caption || '';

        const chatMessage = {
          type: 'audio',
          id: msgId,
          senderId: info.clientId,
          nickname,
          timestamp: message.timestamp || Date.now(),
          url: message.url,
          caption: caption
        };

        // Send ACK to sender immediately
        const ackPayload = {
          type: 'ack',
          id: msgId,
          messageId: msgId,
          serverTime: new Date().toISOString(),
          instanceId: SERVER_INSTANCE_ID
        };
        ws.send(JSON.stringify(ackPayload));
        console.log(`[ACK] *** SERVER ${SERVER_INSTANCE_ID} *** Sent ACK for audio id=${msgId} messageId=${msgId}`);

        // Save to database and prune
        try {
          await saveMessage(chatMessage);
          await pruneToLimit(MAX_MESSAGES);
        } catch (dbError) {
          console.error(`[DB] Error saving audio message:`, dbError);
        }

        broadcast(chatMessage);
        console.log(`[MESSAGE] Audio from ${nickname}: ${message.url} (caption: "${caption.substring(0, 50)}")`);
      } else if (message.type === 'video') {
        const nickname = (message.nickname || 'Anonymous').substring(0, 100);

        const chatMessage = {
          type: 'video',
          id: msgId,
          senderId: info.clientId,
          nickname,
          timestamp: message.timestamp || Date.now(),
          url: message.url,
          filename: message.filename,
          mime: message.mime,
          size: message.size,
          caption: message.caption || ''
        };

        // Send ACK to sender immediately
        const ackPayload = {
          type: 'ack',
          id: msgId,
          messageId: msgId,
          serverTime: new Date().toISOString(),
          instanceId: SERVER_INSTANCE_ID
        };
        ws.send(JSON.stringify(ackPayload));
        console.log(`[ACK] *** SERVER ${SERVER_INSTANCE_ID} *** Sent ACK for video id=${msgId} messageId=${msgId}`);

        // Save to database and prune
        try {
          await saveMessage(chatMessage);
          await pruneToLimit(MAX_MESSAGES);
        } catch (dbError) {
          console.error(`[DB] Error saving video message:`, dbError);
        }

        broadcast(chatMessage);
        console.log(`[MESSAGE] Video from ${nickname}: ${message.filename} (${message.size} bytes)`);
      } else if (message.type === 'file') {
        const nickname = (message.nickname || 'Anonymous').substring(0, 100);

        const chatMessage = {
          type: 'file',
          id: msgId,
          senderId: info.clientId,
          nickname,
          timestamp: message.timestamp || Date.now(),
          url: message.url,
          filename: message.filename,
          mime: message.mime,
          size: message.size
        };

        // Send ACK to sender immediately
        const ackPayload = {
          type: 'ack',
          id: msgId,
          messageId: msgId,
          serverTime: new Date().toISOString(),
          instanceId: SERVER_INSTANCE_ID
        };
        ws.send(JSON.stringify(ackPayload));
        console.log(`[ACK] *** SERVER ${SERVER_INSTANCE_ID} *** Sent ACK for file id=${msgId} messageId=${msgId}`);

        // Save to database and prune
        try {
          await saveMessage(chatMessage);
          await pruneToLimit(MAX_MESSAGES);
        } catch (dbError) {
          console.error(`[DB] Error saving file message:`, dbError);
        }

        broadcast(chatMessage);
        console.log(`[MESSAGE] File from ${nickname}: ${message.filename} (${message.size} bytes)`);
      }
    } catch (error) {
      console.error(`[ERROR] Processing message from ${connectionId}:`, error.message);
    }
  });

  ws.on('close', (code, reason) => {
    console.log(`[DISCONNECT] Client ${connectionId} disconnected: code=${code}, reason=${reason || 'none'}`);
    console.log(`[DISCONNECT] Remaining clients: ${wss.clients.size}`);
    clients.delete(ws);
    broadcastOnlineCount();
  });
  
  ws.on('error', (error) => {
    console.error(`[ERROR] WebSocket error for ${connectionId}:`, error.message);
  });
});

// Note: File cleanup is handled by db.js pruneToLimit() which deletes
// files that are no longer referenced by any message in the database.

// Start server - wrapped in async main()
async function main() {
  try {
    console.log(`========================================`);
    console.log(`Kennedy Chat Server - Initializing`);
    console.log(`========================================`);
    
    // Initialize database
    await initDb();
    console.log(`[STARTUP] Database initialized successfully`);
    
    const SERVER_START_TIME = new Date().toISOString();
    server.listen(PORT, () => {
      console.log(`========================================`);
      console.log(`Kennedy Chat WebSocket Server`);
      console.log(`========================================`);
      console.log(`Server Instance ID: ${SERVER_INSTANCE_ID}`);
      console.log(`Started: ${SERVER_START_TIME}`);
      console.log(`Port: ${PORT}`);
      console.log(`WebSocket: ws://localhost:${PORT}`);
      console.log(`HTTP API: http://localhost:${PORT}`);
      console.log(`Database: ${DB_PATH}`);
      console.log(`Upload dir: ${UPLOAD_DIR}`);
      console.log(`History limit: ${MAX_MESSAGES} messages`);
      console.log(`========================================`);
      console.log(`[CONFIG] Environment variables:`);
      console.log(`  DB_PATH=${process.env.DB_PATH || '(default)'}`);
      console.log(`  UPLOAD_DIR=${process.env.UPLOAD_DIR || '(default)'}`);
      console.log(`  MAX_MESSAGES=${process.env.MAX_MESSAGES || '(default)'}`);
      console.log(`========================================`);
    });
  } catch (error) {
    console.error(`[STARTUP] Fatal error:`, error);
    process.exit(1);
  }
}

// Start the server
main();
