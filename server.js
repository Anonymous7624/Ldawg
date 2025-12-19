const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const url = require('url');

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

const PORT = 8080;
const MAX_MESSAGES = 100;
const MAX_UPLOAD_SIZE = 10 * 1024 * 1024; // 10MB
const RATE_LIMIT_MESSAGES = 2; // 2 messages per window
const RATE_LIMIT_WINDOW = 10000; // 10 seconds
const UPLOAD_CLEANUP_AGE = 60 * 60 * 1000; // 1 hour

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
const chatHistory = [];
const uploadFiles = new Map(); // Map of upload ID to {filename, timestamp, path}
const clients = new Map(); // ws -> { clientId, token, presenceOnline }
const clientState = new Map(); // token -> { strikes, stage, bannedUntil, msgTimes }

// Ensure uploads directory exists
const UPLOADS_DIR = path.join(__dirname, 'uploads');
if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

// Multer configuration
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, UPLOADS_DIR);
  },
  filename: (req, file, cb) => {
    const uniqueName = crypto.randomBytes(16).toString('hex') + path.extname(file.originalname);
    cb(null, uniqueName);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: MAX_UPLOAD_SIZE },
  fileFilter: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const mime = file.mimetype.toLowerCase();
    
    // Reject dangerous files
    if (['.js', '.html', '.svg'].includes(ext)) {
      return cb(new Error('File type not allowed'));
    }
    
    cb(null, true);
  }
});

// Serve static files
app.use(express.static(__dirname));

// Health check endpoint
app.get('/healthz', (req, res) => {
  res.json({ ok: true });
});

// Upload endpoint with comprehensive error handling
app.post('/upload', (req, res) => {
  const origin = req.headers.origin || 'direct';
  console.log(`[UPLOAD] *** SERVER INSTANCE: ${SERVER_INSTANCE_ID} ***`);
  console.log(`[UPLOAD] ${req.method} ${req.path} - Origin: ${origin} - Status: starting`);
  console.log(`[UPLOAD] Headers:`, JSON.stringify(req.headers, null, 2));
  
  // Use multer as middleware but handle its errors
  upload.single('file')(req, res, (err) => {
    // Ensure CORS headers are set even on error
    const allowedOrigins = [
      'https://ldawg7624.com',
      'https://www.ldawg7624.com',
      'http://localhost:8080',
      'http://127.0.0.1:8080'
    ];
    
    if (origin && allowedOrigins.includes(origin)) {
      res.header('Access-Control-Allow-Origin', origin);
      res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
      res.header('Access-Control-Allow-Headers', 'Content-Type');
    }
    
    res.setHeader('Content-Type', 'application/json');
    
    if (err) {
      console.error('[UPLOAD] Multer error:', err.message);
      console.log(`[UPLOAD] ${req.method} ${req.path} - Status: 400 (error)`);
      return res.status(400).json({ 
        success: false, 
        ok: false, 
        error: err.message || 'Upload failed' 
      });
    }
    
    try {
      if (!req.file) {
        console.log('[UPLOAD] Error: No file in request');
        console.log(`[UPLOAD] ${req.method} ${req.path} - Status: 400 (no file)`);
        return res.status(400).json({ 
          success: false, 
          ok: false, 
          error: 'No file uploaded' 
        });
      }

      const ext = path.extname(req.file.originalname).toLowerCase();
      const mime = req.file.mimetype.toLowerCase();
      const imageExts = ['.jpg', '.jpeg', '.png', '.webp', '.gif'];
      const isImage = imageExts.includes(ext) && mime.startsWith('image/');

      const uploadId = path.basename(req.file.filename, path.extname(req.file.filename));
      const uploadUrl = `/uploads/${req.file.filename}`;

      // Store upload metadata
      uploadFiles.set(uploadId, {
        filename: req.file.filename,
        timestamp: Date.now(),
        path: req.file.path
      });

      console.log(`[UPLOAD] Success: ${req.file.originalname} (${req.file.size} bytes, ${mime})`);
      console.log(`[UPLOAD] ${req.method} ${req.path} - Status: 200 (success)`);

      res.status(200).json({
        success: true,
        ok: true,
        url: uploadUrl,
        name: req.file.originalname,
        filename: req.file.originalname,
        mime: req.file.mimetype,
        size: req.file.size,
        isImage
      });
    } catch (error) {
      console.error('[UPLOAD] Handler error:', error.message);
      console.error('[UPLOAD] Stack:', error.stack);
      console.log(`[UPLOAD] ${req.method} ${req.path} - Status: 500 (exception)`);
      res.status(500).json({ 
        success: false, 
        ok: false, 
        error: error.message 
      });
    }
  });
});

// Serve uploads with security headers
app.get('/uploads/:filename', (req, res) => {
  const filename = req.params.filename;
  const filePath = path.join(UPLOADS_DIR, filename);
  const origin = req.headers.origin || 'direct';

  console.log(`[UPLOADS] GET request for ${filename} from origin: ${origin}`);

  if (!fs.existsSync(filePath)) {
    console.log(`[UPLOADS] File not found: ${filename}`);
    return res.status(404).send('File not found');
  }

  const ext = path.extname(filename).toLowerCase();
  const imageExts = ['.jpg', '.jpeg', '.png', '.webp', '.gif'];
  const isImage = imageExts.includes(ext);

  // Set security headers
  res.setHeader('X-Content-Type-Options', 'nosniff');
  
  if (!isImage) {
    res.setHeader('Content-Disposition', 'attachment');
  }

  console.log(`[UPLOADS] Serving file: ${filename} (${isImage ? 'image' : 'file'})`);
  res.sendFile(filePath);
});

// Add message to history (ring buffer)
function addToHistory(message) {
  chatHistory.push(message);
  if (chatHistory.length > MAX_MESSAGES) {
    const removed = chatHistory.shift();
    
    // Cleanup file if it's an image or file message
    if ((removed.type === 'image' || removed.type === 'file') && removed.url) {
      const filename = path.basename(removed.url);
      const filePath = path.join(UPLOADS_DIR, filename);
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
        const uploadId = path.basename(filename, path.extname(filename));
        uploadFiles.delete(uploadId);
      }
    }
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

function registerViolation(info) {
  // if we already hit stage>=1, escalate stage each violation
  if (info.stage >= 1) {
    info.stage += 1; // stage1->2 gives 5m, then grows
    banFor(info, violationBanMs(info));
    return;
  }

  // stage 0: strikes
  info.strikes += 1;
  if (info.strikes >= 3) {
    info.stage = 1;           // mark that we hit the 1-min level
    info.strikes = 0;         // reset strikes after escalation
    banFor(info, 60 * 1000);  // 1 minute
  } else {
    banFor(info, 15 * 1000);
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
    registerViolation(state);
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
wss.on('connection', (ws, req) => {
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

  // Send chat history
  ws.send(JSON.stringify({
    type: 'history',
    items: chatHistory
  }));
  
  console.log(`[HISTORY] Sent ${chatHistory.length} messages to ${connectionId}`);

  // Broadcast updated online count
  broadcastOnlineCount();

  ws.on('message', (data) => {
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
        const deleteId = typeof message.id === "string" ? message.id : null;
        if (!deleteId) return;

        // Find message in history
        const idx = chatHistory.findIndex(m => m.id === deleteId);
        if (idx === -1) return;

        // Only allow if sender matches
        if (chatHistory[idx].senderId !== info.clientId) {
          console.log(`[DELETE] Denied: ${info.clientId} tried to delete message from ${chatHistory[idx].senderId}`);
          return;
        }

        // Remove from history
        chatHistory.splice(idx, 1);

        // Tell everyone to remove it
        broadcast({ type: "delete", id: deleteId });
        console.log(`[DELETE] Message ${deleteId} deleted by ${info.clientId}`);
        return;
      }

      // Rate limit check for user messages (text, image, audio) - USE STATE BY TOKEN
      const sendTypes = new Set(["text", "image", "audio", "file"]);
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

        addToHistory(chatMessage);
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

        addToHistory(chatMessage);
        broadcast(chatMessage);
        console.log(`[MESSAGE] Image from ${nickname}: ${message.filename} (${message.size} bytes)`);
      } else if (message.type === 'audio') {
        const nickname = (message.nickname || 'Anonymous').substring(0, 100);

        const chatMessage = {
          type: 'audio',
          id: msgId,
          senderId: info.clientId,
          nickname,
          timestamp: message.timestamp || Date.now(),
          url: message.url
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

        addToHistory(chatMessage);
        broadcast(chatMessage);
        console.log(`[MESSAGE] Audio from ${nickname}: ${message.url}`);
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

        addToHistory(chatMessage);
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

// Cleanup old uploads every 5 minutes
setInterval(() => {
  const now = Date.now();
  
  uploadFiles.forEach((metadata, uploadId) => {
    if (now - metadata.timestamp > UPLOAD_CLEANUP_AGE) {
      if (fs.existsSync(metadata.path)) {
        fs.unlinkSync(metadata.path);
      }
      uploadFiles.delete(uploadId);
      console.log(`Cleaned up old upload: ${metadata.filename}`);
    }
  });
}, 5 * 60 * 1000);

// Start server
const SERVER_START_TIME = new Date().toISOString();
server.listen(PORT, () => {
  console.log(`========================================`);
  console.log(`Kennedy Chat Server`);
  console.log(`========================================`);
  console.log(`Server Instance ID: ${SERVER_INSTANCE_ID}`);
  console.log(`Started: ${SERVER_START_TIME}`);
  console.log(`Port: ${PORT}`);
  console.log(`WebSocket: ws://localhost:${PORT}`);
  console.log(`HTTP API: http://localhost:${PORT}`);
  console.log(`Uploads dir: ${UPLOADS_DIR}`);
  console.log(`========================================`);
});
