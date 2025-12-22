const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const url = require('url');
const cookieParser = require('cookie-parser');
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

// Two-layer spam control configuration
const RATE_LIMIT_MESSAGES = 4; // Max messages in sliding window (5th triggers strike)
const RATE_LIMIT_WINDOW = 10000; // 10 seconds (rolling window)
const RATE_LIMIT_COOLDOWN = 650; // Minimum 650ms between sends (0.65s)

// Profanity filter configuration
const BANNED_WORDS_FILE = path.join(__dirname, 'banned-words.txt');
const bannedWords = new Set();
const MAX_MUTE_DURATION = 2 * 24 * 60 * 60 * 1000; // 2 days in milliseconds

// Helper to generate client IDs
function makeId() { 
  return crypto.randomBytes(4).toString('hex'); 
}

// Helper to generate UUIDs for tokens
function makeUUID() {
  return crypto.randomBytes(16).toString('hex');
}

// Load banned words from file
function loadBannedWords() {
  try {
    if (!fs.existsSync(BANNED_WORDS_FILE)) {
      console.log('[PROFANITY] No banned-words.txt found, filter disabled');
      return;
    }
    
    const content = fs.readFileSync(BANNED_WORDS_FILE, 'utf-8');
    const lines = content.split('\n');
    
    for (const line of lines) {
      const trimmed = line.trim();
      // Skip empty lines and comments
      if (trimmed && !trimmed.startsWith('#')) {
        bannedWords.add(trimmed.toLowerCase());
      }
    }
    
    console.log(`[PROFANITY] Loaded ${bannedWords.size} banned words from ${BANNED_WORDS_FILE}`);
  } catch (error) {
    console.error('[PROFANITY] Error loading banned words:', error.message);
  }
}

// Filter profanity from text - replaces banned words with dashes
function filterProfanity(text) {
  if (bannedWords.size === 0) return { filtered: text, found: [] };
  
  const foundWords = [];
  let filtered = text;
  
  // Create regex pattern that matches whole words with optional punctuation
  for (const word of bannedWords) {
    // Escape special regex characters in the word
    const escapedWord = word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    // Match word with optional punctuation before/after, case-insensitive
    const regex = new RegExp(`\\b${escapedWord}\\b`, 'gi');
    
    const matches = filtered.match(regex);
    if (matches) {
      foundWords.push(...matches);
      // Replace with dashes matching original length (preserve case)
      filtered = filtered.replace(regex, (match) => '-'.repeat(match.length));
    }
  }
  
  return { filtered, found: foundWords };
}

// Cookie parser middleware
app.use(cookieParser());

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
const clients = new Map(); // ws -> { clientId, token, presenceOnline, gcSid }
const clientState = new Map(); // token -> { strikes, stage, bannedUntil, msgTimes }
const profanityState = new Map(); // gcSid -> { strikes, muteUntil, lastMuteSeconds }

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
  // New ban schedule:
  // Strikes 1-3: 15 seconds each
  // Strike 4: 60 seconds (1 minute)
  // Strike 5: 300 seconds (5 minutes)
  // Strike 6+: doubles each time (10m, 20m, 40m, etc.)
  
  if (info.strikes === 4) {
    return 60 * 1000; // 1 minute
  } else if (info.strikes === 5) {
    return 300 * 1000; // 5 minutes
  } else if (info.strikes >= 6) {
    // Strike 6 = 10 minutes, then doubles each time
    const doublings = info.strikes - 6;
    return 10 * 60 * 1000 * Math.pow(2, doublings);
  } else {
    // Strikes 1-3: 15 seconds
    return 15 * 1000;
  }
}

function registerViolation(info, reason, details) {
  // Only WINDOW violations trigger strikes, not COOLDOWN
  // The cooldown should be enforced client-side primarily, and if it hits server,
  // we reject without issuing a strike
  
  if (reason === 'COOLDOWN') {
    // Cooldown violation: just reject, no strike
    console.log(`[RATE-LIMIT-COOLDOWN] Rejected: ${reason} | ${details} | No strike issued`);
    return;
  }
  
  // WINDOW violation: increment strikes and apply ban
  info.strikes += 1;
  const banDurationMs = violationBanMs(info);
  banFor(info, banDurationMs);
  
  console.log(`[RATE-LIMIT-BAN] Violation: ${reason} | ${details} | Strike ${info.strikes} | Ban: ${Math.ceil(banDurationMs / 1000)}s`);
}

function checkRateLimit(state) {
  if (!state) return { allowed: false };

  const currentTime = now();

  // Check if already banned
  if (isBanned(state)) {
    return {
      allowed: false,
      muted: true,
      seconds: Math.ceil((state.bannedUntil - currentTime) / 1000),
      strikes: state.strikes
    };
  }

  // LAYER 1: Cooldown check (minimum time between sends)
  // This is a safety net - client should enforce this primarily
  // If violated, reject WITHOUT issuing a strike
  if (state.lastSendAt) {
    const timeSinceLastSend = currentTime - state.lastSendAt;
    if (timeSinceLastSend < RATE_LIMIT_COOLDOWN) {
      console.log(`[RATE-LIMIT-COOLDOWN] Rejected: delta=${timeSinceLastSend}ms (min=${RATE_LIMIT_COOLDOWN}ms) | No strike issued`);
      return {
        allowed: false,
        cooldown: true, // Signal this is a cooldown rejection, not a ban
        remainingMs: RATE_LIMIT_COOLDOWN - timeSinceLastSend
      };
    }
  }

  // LAYER 2: Sliding window check (max messages in rolling window)
  const windowMs = RATE_LIMIT_WINDOW;
  const limit = RATE_LIMIT_MESSAGES;

  // Prune timestamps older than the window
  state.msgTimes = state.msgTimes.filter(ts => currentTime - ts < windowMs);
  
  // Check if adding this message would exceed the limit
  if (state.msgTimes.length >= limit) {
    // Calculate actual window span for logging
    const oldestTimestamp = Math.min(...state.msgTimes);
    const actualWindowMs = currentTime - oldestTimestamp;
    registerViolation(state, 'WINDOW', `count=${state.msgTimes.length + 1}/${limit} in ${actualWindowMs}ms (max window=${windowMs}ms)`);
    return {
      allowed: false,
      muted: true,
      seconds: Math.ceil((state.bannedUntil - currentTime) / 1000),
      strikes: state.strikes
    };
  }

  // Message is allowed - update state
  state.msgTimes.push(currentTime);
  state.lastSendAt = currentTime;

  return { allowed: true };
}

// Get or create client state by token
function getClientState(token) {
  if (!clientState.has(token)) {
    clientState.set(token, {
      strikes: 0,
      bannedUntil: 0,
      msgTimes: [],
      lastSendAt: 0 // Track last send time for cooldown
    });
  }
  return clientState.get(token);
}

// Get or create profanity state by gcSid
function getProfanityState(gcSid) {
  if (!profanityState.has(gcSid)) {
    profanityState.set(gcSid, {
      strikes: 0,
      muteUntil: 0,
      lastMuteSeconds: 0
    });
  }
  return profanityState.get(gcSid);
}

// Check if user is muted for profanity
function isProfanityMuted(state) {
  return now() < state.muteUntil;
}

// Calculate mute duration based on strikes
function calculateMuteDuration(strikes) {
  if (strikes < 5) {
    return 0; // No mute for less than 5 strikes
  } else if (strikes === 5) {
    return 15 * 1000; // 15 seconds
  } else if (strikes < 8) {
    return 15 * 1000; // 15 seconds for strikes 6-7
  } else if (strikes === 8) {
    return 60 * 1000; // 60 seconds (1 minute)
  } else {
    // After strike 8, double the previous mute duration
    const previousDuration = strikes === 9 ? 60 * 1000 : Math.pow(2, strikes - 9) * 60 * 1000;
    const newDuration = Math.min(previousDuration * 2, MAX_MUTE_DURATION);
    return newDuration;
  }
}

// Apply profanity strike and mute
function applyProfanityStrike(state) {
  state.strikes += 1;
  const muteDurationMs = calculateMuteDuration(state.strikes);
  
  if (muteDurationMs > 0) {
    state.muteUntil = now() + muteDurationMs;
    state.lastMuteSeconds = Math.ceil(muteDurationMs / 1000);
    console.log(`[PROFANITY] Strike ${state.strikes} issued, muted for ${state.lastMuteSeconds}s`);
  } else {
    console.log(`[PROFANITY] Strike ${state.strikes} issued (no mute yet)`);
  }
}

// Generate unique server instance ID
const SERVER_INSTANCE_ID = crypto.randomBytes(6).toString('hex');

// Helper to parse cookies from WebSocket request
function parseCookies(cookieHeader) {
  const cookies = {};
  if (cookieHeader) {
    cookieHeader.split(';').forEach(cookie => {
      const parts = cookie.split('=');
      const name = parts[0].trim();
      const value = parts.slice(1).join('=').trim();
      cookies[name] = value;
    });
  }
  return cookies;
}

// WebSocket connection handler
wss.on('connection', async (ws, req) => {
  const clientId = makeId();
  const connectionId = clientId;
  
  // Parse cookies from WebSocket upgrade request
  const cookies = parseCookies(req.headers.cookie);
  let gcSid = cookies.gc_sid;
  
  // If no gc_sid cookie, generate one
  if (!gcSid) {
    gcSid = makeUUID();
    console.log(`[CONNECT] No gc_sid cookie, generated: ${gcSid.substring(0, 8)}...`);
  } else {
    console.log(`[CONNECT] Client has gc_sid: ${gcSid.substring(0, 8)}...`);
  }
  
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
  
  // Load profanity state from cookies if present
  let profState = getProfanityState(gcSid);
  if (cookies.gc_strikes) {
    const strikes = parseInt(cookies.gc_strikes, 10);
    if (!isNaN(strikes) && strikes >= 0 && strikes <= 1000) {
      profState.strikes = strikes;
    }
  }
  if (cookies.gc_muteUntil) {
    const muteUntil = parseInt(cookies.gc_muteUntil, 10);
    if (!isNaN(muteUntil) && muteUntil > now()) {
      profState.muteUntil = muteUntil;
    }
  }
  
  console.log(`[CONNECT] *** SERVER INSTANCE: ${SERVER_INSTANCE_ID} ***`);
  console.log(`[CONNECT] Client connected: ${clientId} (token: ${token.substring(0, 8)}..., gcSid: ${gcSid.substring(0, 8)}...)`);
  console.log(`[CONNECT] Profanity state: strikes=${profState.strikes}, muted=${isProfanityMuted(profState)}`);
  console.log(`[CONNECT] Total clients: ${wss.clients.size}`);

  // Initialize client info (connection-specific)
  clients.set(ws, {
    clientId,
    token,
    gcSid,
    presenceOnline: true   // default true until told otherwise
  });

  // Get or create client state (persistent by token)
  const state = getClientState(token);

  // Send welcome with clientId, token, and gc_sid (for cookie setting)
  ws.send(JSON.stringify({ 
    type: 'welcome', 
    clientId,
    token, // Send token back so client can store it if needed
    gcSid, // Send gc_sid so client can set cookie
    profanityStrikes: profState.strikes,
    profanityMuted: isProfanityMuted(profState),
    muteUntil: profState.muteUntil > now() ? profState.muteUntil : undefined
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
          if (rateLimitResult.cooldown) {
            // Cooldown violation - just reject silently or with a lightweight message
            console.log(`[RATE-LIMIT] Client ${connectionId} (token ${info.token.substring(0, 8)}...) cooldown rejection (no strike)`);
            ws.send(JSON.stringify({
              type: 'cooldown',
              remainingMs: rateLimitResult.remainingMs
            }));
          } else {
            // Ban from window violation
            console.log(`[RATE-LIMIT] Client ${connectionId} (token ${info.token.substring(0, 8)}...) banned for ${rateLimitResult.seconds}s (strikes: ${rateLimitResult.strikes})`);
            ws.send(JSON.stringify({
              type: 'banned',
              until: state.bannedUntil,
              seconds: rateLimitResult.seconds,
              strikes: rateLimitResult.strikes,
              reason: 'rate'
            }));
          }
          return;
        }
      }
      
      if (message.type === 'text') {
        // Get profanity state for this user
        const profState = getProfanityState(info.gcSid);
        
        // Check if user is muted for profanity
        if (isProfanityMuted(profState)) {
          const secondsRemaining = Math.ceil((profState.muteUntil - now()) / 1000);
          console.log(`[PROFANITY] Client ${connectionId} is muted (${secondsRemaining}s remaining, ${profState.strikes} strikes)`);
          ws.send(JSON.stringify({
            type: 'profanity_muted',
            strikes: profState.strikes,
            muteUntil: profState.muteUntil,
            seconds: secondsRemaining,
            message: `You are muted for ${secondsRemaining}s (Strike ${profState.strikes})`,
            // Cookie values for client-side persistence
            cookies: {
              gc_strikes: profState.strikes,
              gc_muteUntil: profState.muteUntil
            }
          }));
          return;
        }
        
        // Validate input
        const nickname = (message.nickname || 'Anonymous').substring(0, 100);
        const originalText = (message.text || '').substring(0, 1000);
        const originalHtml = (message.html || '').substring(0, 5000);

        if (!originalText.trim()) {
          console.log(`[MESSAGE] Ignored empty text from ${connectionId}`);
          return;
        }

        // Filter profanity from text
        const { filtered: filteredText, found: foundProfanity } = filterProfanity(originalText);
        
        // If profanity was found, apply strike
        if (foundProfanity.length > 0) {
          applyProfanityStrike(profState);
          console.log(`[PROFANITY] Found ${foundProfanity.length} banned term(s) in message from ${nickname}: ${foundProfanity.join(', ')}`);
          
          // Send profanity strike notification to sender with cookie values for persistence
          const muteSeconds = isProfanityMuted(profState) ? Math.ceil((profState.muteUntil - now()) / 1000) : 0;
          ws.send(JSON.stringify({
            type: 'profanity_strike',
            strikes: profState.strikes,
            muted: isProfanityMuted(profState),
            muteUntil: profState.muteUntil > now() ? profState.muteUntil : undefined,
            seconds: muteSeconds,
            foundWords: foundProfanity,
            message: muteSeconds > 0 
              ? `Strike ${profState.strikes}: Muted for ${muteSeconds}s`
              : `Strike ${profState.strikes}: Warning issued`,
            // Cookie values for client-side persistence
            cookies: {
              gc_strikes: profState.strikes,
              gc_muteUntil: profState.muteUntil
            }
          }));
        }
        
        // Filter HTML if present (basic approach: filter text in HTML)
        let filteredHtml = originalHtml;
        if (originalHtml && foundProfanity.length > 0) {
          // Simple approach: replace profanity in HTML as well
          for (const word of foundProfanity) {
            const escapedWord = word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            const regex = new RegExp(escapedWord, 'gi');
            filteredHtml = filteredHtml.replace(regex, (match) => '-'.repeat(match.length));
          }
        }

        const chatMessage = {
          type: 'text',
          id: msgId,
          senderId: info.clientId,
          nickname,
          timestamp: message.timestamp || Date.now(),
          text: filteredText, // Use filtered text
          html: filteredHtml || undefined // Use filtered HTML if present
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
        console.log(`[MESSAGE] Text message from ${nickname}: "${filteredText.substring(0, 50)}${filteredText.length > 50 ? '...' : ''}"`);
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
    
    // Load banned words for profanity filter
    loadBannedWords();
    
    // Initialize database - this will log DB path and count
    await initDb();
    
    // Log message count after DB init
    const messageCount = await getRecentMessages(MAX_MESSAGES);
    console.log(`[STARTUP] ✓ Database ready with ${messageCount.length} messages in memory`);
    console.log(`========================================`);
    
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
    console.error(`[STARTUP] ❌ FATAL ERROR:`, error);
    console.error(`[STARTUP] Server cannot start without database!`);
    process.exit(1);
  }
}

// Start the server
main();
