const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const url = require('url');
const cookieParser = require('cookie-parser');
const { initDb, saveMessage, getRecentMessages, deleteMessageById, pruneToLimit, wipeAllMessages, getDatabaseInfo } = require('./db');

// Admin authentication
const PRIVATE_API_URL = process.env.PRIVATE_API_URL || 'https://api.simplechatroom.com';

// Check if fetch is available (Node 18+), otherwise require node-fetch
const fetch = globalThis.fetch || require('node-fetch');

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

// Environment-driven configuration with PRODUCTION DEFAULTS
const PORT = parseInt(process.env.WS_PORT || '8080', 10);
const UPLOAD_DIR = process.env.UPLOAD_DIR || '/home/ldawg7624/chat-data/uploads';
const DB_PATH = process.env.DB_PATH || '/home/ldawg7624/chat-data/chat.db';
const MAX_MESSAGES = parseInt(process.env.MAX_MESSAGES || '600', 10);
const MAX_UPLOAD_SIZE = 10 * 1024 * 1024; // 10MB

// SAFETY CHECK: Refuse to start if using forbidden in-repo DB path
if (DB_PATH.includes('/apps/pi-global/chat.db')) {
  console.error('========================================');
  console.error('[FATAL] FORBIDDEN DATABASE PATH DETECTED!');
  console.error(`[FATAL] DB_PATH: ${DB_PATH}`);
  console.error('[FATAL] This path will cause data loss on git pulls.');
  console.error('[FATAL] Set DB_PATH environment variable to: /home/ldawg7624/chat-data/chat.db');
  console.error('========================================');
  process.exit(1);
}

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

// Format duration in milliseconds to readable label
function formatDurationLabel(durationMs) {
  const seconds = Math.floor(durationMs / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);
  
  if (days >= 1) {
    return days === 1 ? '1 day' : `${days} days`;
  } else if (hours >= 1) {
    return hours === 1 ? '1 hour' : `${hours} hours`;
  } else if (minutes >= 1) {
    return minutes === 1 ? '1 minute' : `${minutes} minutes`;
  } else {
    return seconds === 1 ? '1 second' : `${seconds} seconds`;
  }
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

// Check if display name contains banned words - used for username validation
function checkDisplayName(name) {
  if (bannedWords.size === 0) return { allowed: true, found: [] };
  if (!name || !name.trim()) return { allowed: true, found: [] };
  
  const foundWords = [];
  
  // Check against all banned words using same logic as filterProfanity
  for (const word of bannedWords) {
    // Escape special regex characters in the word
    const escapedWord = word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    // Match word with optional punctuation before/after, case-insensitive
    const regex = new RegExp(`\\b${escapedWord}\\b`, 'gi');
    
    const matches = name.match(regex);
    if (matches) {
      foundWords.push(...matches);
    }
  }
  
  return {
    allowed: foundWords.length === 0,
    found: foundWords
  };
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
const clients = new Map(); // ws -> { clientId, token, presenceOnline, gcSid, adminUser }
const clientState = new Map(); // token -> { strikes, stage, bannedUntil, msgTimes }
const profanityState = new Map(); // gcSid -> { strikes, muteUntil, lastMuteSeconds }
const adminBans = new Map(); // gcSid -> { bannedUntil, bannedBy }
const adminSessions = new Map(); // token -> { username, role, email }

// Admin state file
const STATE_FILE = path.join(__dirname, 'state.json');
let serverState = {
  chatLocked: false,
  adminBans: {} // { gcSid: { bannedUntil, bannedBy, reason } }
};

// Load server state from file
function loadServerState() {
  try {
    if (fs.existsSync(STATE_FILE)) {
      const data = fs.readFileSync(STATE_FILE, 'utf-8');
      const loadedState = JSON.parse(data);
      
      // Merge with defaults
      serverState = {
        chatLocked: loadedState.chatLocked || false,
        adminBans: loadedState.adminBans || {}
      };
      
      // Load admin bans into memory Map
      adminBans.clear();
      for (const [gcSid, banInfo] of Object.entries(serverState.adminBans)) {
        // Only load bans that haven't expired
        if (banInfo.bannedUntil > Date.now()) {
          adminBans.set(gcSid, banInfo);
        }
      }
      
      console.log(`[STATE] Loaded state from file: chatLocked=${serverState.chatLocked}, activeBans=${adminBans.size}`);
    }
  } catch (error) {
    console.error('[STATE] Error loading state:', error.message);
  }
}

// Save server state to file
function saveServerState() {
  try {
    // Convert adminBans Map to object for storage
    const adminBansObj = {};
    for (const [gcSid, banInfo] of adminBans.entries()) {
      // Only save bans that haven't expired
      if (banInfo.bannedUntil > Date.now()) {
        adminBansObj[gcSid] = banInfo;
      }
    }
    serverState.adminBans = adminBansObj;
    
    fs.writeFileSync(STATE_FILE, JSON.stringify(serverState, null, 2), 'utf-8');
    console.log(`[STATE] Saved state to file: chatLocked=${serverState.chatLocked}, bans=${Object.keys(adminBansObj).length}`);
  } catch (error) {
    console.error('[STATE] Error saving state:', error.message);
  }
}

// Verify admin token with Private API
async function verifyAdminToken(token) {
  try {
    const response = await fetch(`${PRIVATE_API_URL}/verify-token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ token })
    });

    if (!response.ok) {
      return null;
    }

    const data = await response.json();
    if (data.valid && data.user) {
      return data.user;
    }
    return null;
  } catch (error) {
    console.error('[ADMIN] Error verifying token:', error.message);
    return null;
  }
}

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

// Debug endpoint to check database state
app.get('/debug/dbcount', async (req, res) => {
  try {
    const info = await getDatabaseInfo();
    console.log('[DEBUG] Database info request:', JSON.stringify(info, null, 2));
    res.json({
      ok: true,
      ...info
    });
  } catch (error) {
    console.error('[DEBUG] Error getting database info:', error);
    res.status(500).json({
      ok: false,
      error: error.message
    });
  }
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

// Send moderation notice to a specific client
function sendModerationNotice(ws, profState, action, reason, foundWords = []) {
  const muteRemainingMs = isProfanityMuted(profState) ? profState.muteUntil - now() : 0;
  const notice = {
    type: 'moderation_notice',
    strikes: profState.strikes,
    muted: isProfanityMuted(profState),
    muteRemainingMs: muteRemainingMs > 0 ? muteRemainingMs : undefined,
    muteUntil: profState.muteUntil > now() ? profState.muteUntil : undefined,
    seconds: muteRemainingMs > 0 ? Math.ceil(muteRemainingMs / 1000) : 0,
    reason: reason,
    action: action, // 'sanitized_message', 'blocked_message', 'blocked_name', 'muted_attempt'
    foundWords: foundWords.length > 0 ? foundWords : undefined,
    cookies: {
      gc_strikes: profState.strikes,
      gc_muteUntil: profState.muteUntil
    }
  };
  
  ws.send(JSON.stringify(notice));
  console.log(`[MODERATION] Sent immediate notice to client: action=${action}, strikes=${profState.strikes}, muted=${notice.muted}`);
}

// Send message to specific client by ID
function sendToClientId(targetClientId, payloadObj) {
  for (const [ws, info] of clients) {
    if (info.gcSid === targetClientId && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(payloadObj));
      return true;
    }
  }
  return false;
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

// Broadcast online count with role information
function broadcastOnlineCount() {
  let count = 0;
  const onlineUsers = [];
  
  for (const [, info] of clients) {
    if (info.presenceOnline) {
      count++;
      // Include role and username in online users list
      onlineUsers.push({
        name: info.username || 'Guest',
        role: info.role || 'guest'
      });
    }
  }
  
  const payload = JSON.stringify({ 
    type: 'online', 
    count: count,
    users: onlineUsers // Add users array with role information
  });
  
  for (const [ws] of clients) {
    if (ws.readyState === ws.OPEN) ws.send(payload);
  }
  console.log(`[ONLINE] Broadcasting count: ${count}, users with roles: ${onlineUsers.length}`);
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
  if (strikes < 3) {
    return 0; // No mute for less than 3 strikes
  } else if (strikes === 3) {
    return 15 * 1000; // 15 seconds (first mute)
  } else if (strikes < 6) {
    return 15 * 1000; // 15 seconds for strikes 4-5
  } else if (strikes === 6) {
    return 60 * 1000; // 60 seconds (1 minute)
  } else {
    // After strike 6, double the previous mute duration
    const previousDuration = strikes === 7 ? 60 * 1000 : Math.pow(2, strikes - 7) * 60 * 1000;
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
  // Parse query parameters first
  const queryParams = url.parse(req.url, true).query;
  
  // Use provided clientId if available (for ownership continuity across reloads)
  // Otherwise generate a new one
  let clientId = queryParams.clientId;
  if (!clientId) {
    clientId = makeId();
    console.log(`[CONNECT] No clientId provided, generated: ${clientId}`);
  } else {
    console.log(`[CONNECT] Client provided clientId: ${clientId} (preserving identity)`);
  }
  const connectionId = clientId;
  
  // Parse cookies from WebSocket upgrade request
  const cookies = parseCookies(req.headers.cookie);
  let gcSid = cookies.gc_sid;
  
  // CRITICAL: Try query param if cookie not present (for cross-origin/subdomain WS connections)
  if (!gcSid && queryParams.gcSid) {
    gcSid = queryParams.gcSid;
    console.log(`[CONNECT] Using gc_sid from query param: ${gcSid.substring(0, 8)}...`);
  }
  
  // If no gc_sid from cookie or query param, generate one
  if (!gcSid) {
    gcSid = makeUUID();
    console.log(`[CONNECT] No gc_sid cookie or query param, generated: ${gcSid.substring(0, 8)}...`);
  } else if (cookies.gc_sid) {
    console.log(`[CONNECT] Client has gc_sid: ${gcSid.substring(0, 8)}...`);
  }
  
  // Parse token from query string (auth token for role verification)
  let authToken = queryParams.token;
  let authenticatedUser = null;
  let userRole = 'guest';
  let username = null;
  
  // Verify auth token if provided
  if (authToken) {
    console.log(`[AUTH] Verifying auth token: ${authToken.substring(0, 8)}...`);
    authenticatedUser = await verifyAdminToken(authToken);
    if (authenticatedUser) {
      userRole = authenticatedUser.role || 'client';
      username = authenticatedUser.username;
      console.log(`[AUTH] User authenticated: ${username} (${userRole})`);
      adminSessions.set(authToken, authenticatedUser);
    } else {
      console.log(`[AUTH] Failed to verify auth token, treating as guest`);
    }
  }
  
  // Check for admin token (backward compatibility for adminToken param)
  const adminToken = queryParams.adminToken;
  let adminUser = null;
  
  if (adminToken && !authenticatedUser) {
    console.log(`[ADMIN] Verifying admin token: ${adminToken.substring(0, 8)}...`);
    adminUser = await verifyAdminToken(adminToken);
    if (adminUser) {
      console.log(`[ADMIN] Admin authenticated: ${adminUser.username} (${adminUser.role})`);
      adminSessions.set(adminToken, adminUser);
      authenticatedUser = adminUser;
      userRole = adminUser.role || 'admin';
      username = adminUser.username;
    } else {
      console.log(`[ADMIN] Failed to verify admin token`);
    }
  }
  
  // Generate session token for rate limiting (separate from auth token)
  let token = makeUUID();
  console.log(`[CONNECT] Generated session token: ${token.substring(0, 8)}...`);
  
  // Ensure adminUser is set if we have an authenticated admin/moderator
  if (authenticatedUser && (userRole === 'admin' || userRole === 'moderator')) {
    adminUser = authenticatedUser;
  }
  
  // Load profanity state from cookies if present
  let profState = getProfanityState(gcSid);
  
  // BUG FIX #1: Use MAXIMUM of cookie value and in-memory value to prevent resets
  // This ensures strike count never decreases across reloads
  if (cookies.gc_strikes) {
    const cookieStrikes = parseInt(cookies.gc_strikes, 10);
    if (!isNaN(cookieStrikes) && cookieStrikes >= 0 && cookieStrikes <= 10000) {
      profState.strikes = Math.max(profState.strikes, cookieStrikes);
      console.log(`[CONNECT] Loaded strikes from cookie: ${cookieStrikes}, using: ${profState.strikes}`);
    }
  }
  if (cookies.gc_muteUntil) {
    const muteUntil = parseInt(cookies.gc_muteUntil, 10);
    if (!isNaN(muteUntil) && muteUntil > now()) {
      profState.muteUntil = Math.max(profState.muteUntil, muteUntil);
      console.log(`[CONNECT] Loaded muteUntil from cookie: ${muteUntil}, using: ${profState.muteUntil}`);
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
    presenceOnline: true,   // default true until told otherwise
    adminUser: adminUser,   // admin user info if authenticated
    adminToken: adminToken,  // admin token for subsequent requests
    role: userRole,         // user role (admin/moderator/client/guest)
    username: username      // authenticated username or null for guests
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
    muteUntil: profState.muteUntil > now() ? profState.muteUntil : undefined,
    adminUser: adminUser, // Send admin user info if authenticated
    chatLocked: serverState.chatLocked // Send chat lock status
  }));

  // CRITICAL FIX: Check if user is admin-muted on connection and send mute event
  // This ensures mutes persist across reloads
  const adminBan = adminBans.get(gcSid);
  if (adminBan && now() < adminBan.bannedUntil) {
    const remainingMs = adminBan.bannedUntil - now();
    const remainingSeconds = Math.ceil(remainingMs / 1000);
    console.log(`[ADMIN-MUTE-PERSIST] ✓ User persistentKey=${gcSid.substring(0, 6)}... IS MUTED (${remainingSeconds}s remaining)`);
    
    // Send admin_mute event to lock UI immediately
    ws.send(JSON.stringify({
      type: 'admin_mute',
      until: adminBan.bannedUntil,
      seconds: remainingSeconds,
      remainingMs: remainingMs,
      reason: adminBan.reason || `Muted by admin (${remainingSeconds}s remaining)`
    }));
    
    // Also send system message for visibility
    ws.send(JSON.stringify({
      type: 'system',
      text: `You are muted for ${formatDurationLabel(remainingMs)}`,
      timestamp: Date.now()
    }));
  } else if (adminBan) {
    // Ban expired, remove it
    adminBans.delete(gcSid);
    saveServerState();
    console.log(`[ADMIN-MUTE-PERSIST] Ban expired for persistentKey=${gcSid.substring(0, 6)}... on reconnect`);
  } else {
    console.log(`[ADMIN-MUTE-PERSIST] User persistentKey=${gcSid.substring(0, 6)}... NOT MUTED`);
  }

  // Send chat history from database
  try {
    const items = await getRecentMessages(MAX_MESSAGES);
    ws.send(JSON.stringify({
      type: 'history',
      items: items,
      success: true
    }));
    console.log(`[HISTORY] Sent ${items.length} messages to ${connectionId} from DB`);
  } catch (error) {
    console.error(`[HISTORY] ❌ Error loading history for ${connectionId}:`, error);
    console.error(`[HISTORY] Stack:`, error.stack);
    // Send error indicator so frontend can show appropriate message
    ws.send(JSON.stringify({
      type: 'history',
      items: [],
      success: false,
      error: 'Failed to load message history'
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

      // Handle admin delete message (delete any message)
      if (message.type === "admin_delete") {
        if (!info.adminUser || info.adminUser.role !== 'admin') {
          console.log(`[ADMIN-DELETE] ❌ Unauthorized: not admin`);
          return;
        }

        const deleteId = message.messageId;
        if (!deleteId) {
          console.log(`[ADMIN-DELETE] ❌ No messageId provided`);
          return;
        }

        try {
          await deleteMessageById(deleteId);
          console.log(`[ADMIN-DELETE] ✓ Admin ${info.adminUser.username} deleted message ${deleteId}`);
          
          // Broadcast delete to all clients
          broadcast({ type: "delete", id: deleteId });
          
          // Send confirmation to admin
          ws.send(JSON.stringify({ type: 'admin_delete_success', messageId: deleteId }));
        } catch (error) {
          console.error(`[ADMIN-DELETE] Error:`, error);
          ws.send(JSON.stringify({ type: 'admin_delete_error', messageId: deleteId, error: error.message }));
        }
        
        return;
      }

      // Handle moderator delete message (delete only client messages)
      if (message.type === "moderator_delete") {
        if (!info.adminUser || info.adminUser.role !== 'moderator') {
          console.log(`[MOD-DELETE] ❌ Unauthorized: not moderator`);
          return;
        }

        const deleteId = message.messageId;
        if (!deleteId) {
          console.log(`[MOD-DELETE] ❌ No messageId provided`);
          return;
        }

        try {
          // Get message from DB to check permissions
          const allMessages = await getRecentMessages(MAX_MESSAGES);
          const messageToDelete = allMessages.find(m => m.id === deleteId);
          
          if (!messageToDelete) {
            console.log(`[MOD-DELETE] ❌ Message not found`);
            ws.send(JSON.stringify({ type: 'system', text: 'Message not found' }));
            return;
          }

          // Check if message is from admin or moderator
          const messageRole = (messageToDelete.adminStyleMeta && messageToDelete.adminStyleMeta.role) || (messageToDelete.isAdmin ? 'admin' : 'client');
          if (messageRole === 'admin' || messageRole === 'moderator') {
            console.log(`[MOD-DELETE] ❌ Moderator ${info.adminUser.username} tried to delete staff message`);
            ws.send(JSON.stringify({ type: 'system', text: 'Not allowed to moderate staff messages' }));
            return;
          }

          await deleteMessageById(deleteId);
          console.log(`[MOD-DELETE] ✓ Moderator ${info.adminUser.username} deleted message ${deleteId}`);
          
          // Broadcast delete to all clients
          broadcast({ type: "delete", id: deleteId });
          
          // Send confirmation to moderator
          ws.send(JSON.stringify({ type: 'admin_delete_success', messageId: deleteId }));
        } catch (error) {
          console.error(`[MOD-DELETE] Error:`, error);
          ws.send(JSON.stringify({ type: 'admin_delete_error', messageId: deleteId, error: error.message }));
        }
        
        return;
      }

      // Handle admin ban user
      if (message.type === "admin_ban") {
        if (!info.adminUser || info.adminUser.role !== 'admin') {
          console.log(`[ADMIN-BAN] ❌ Unauthorized: not admin`);
          ws.send(JSON.stringify({ 
            type: 'admin_ban_error', 
            error: 'Unauthorized: Admin access required' 
          }));
          return;
        }

        const { gcSid, duration, deleteMessage } = message;
        if (!gcSid || !duration) {
          console.log(`[ADMIN-BAN] ❌ Missing gcSid or duration`);
          ws.send(JSON.stringify({ 
            type: 'admin_ban_error', 
            error: 'Missing required parameters' 
          }));
          return;
        }

        // Prevent admin from muting themselves
        if (info.gcSid === gcSid) {
          console.log(`[ADMIN-BAN] ❌ Admin ${info.adminUser.username} tried to mute themselves`);
          ws.send(JSON.stringify({ 
            type: 'admin_ban_error', 
            error: 'Cannot mute yourself' 
          }));
          return;
        }

        // Apply ban
        const banUntil = now() + duration;
        const banReason = `Muted by admin for ${Math.ceil(duration / 1000)} seconds`;
        adminBans.set(gcSid, { 
          bannedUntil: banUntil, 
          bannedBy: info.adminUser.username,
          reason: banReason,
          duration: duration
        });
        
        // Save state to persist bans
        saveServerState();
        
        // ADMIN_MUTE applied log with persistent key
        const durationSec = Math.ceil(duration / 1000);
        console.log(`[ADMIN-MUTE-APPLY] ✓ Admin ${info.adminUser.username} muted persistentKey=${gcSid.substring(0, 6)}... for ${durationSec}s`);

        // Delete message if requested
        if (deleteMessage && message.messageId) {
          try {
            await deleteMessageById(message.messageId);
            broadcast({ type: "delete", id: message.messageId });
            console.log(`[ADMIN-BAN] ✓ Deleted message ${message.messageId}`);
          } catch (error) {
            console.error(`[ADMIN-BAN] Error deleting message:`, error);
          }
        }

        // Notify the banned user with admin_mute event and system message
        const durationLabel = formatDurationLabel(duration);
        
        // Send admin_mute event (for status bar and input disabling)
        const muteEventSent = sendToClientId(gcSid, {
          type: 'admin_mute',
          until: banUntil,
          seconds: Math.ceil(duration / 1000),
          reason: banReason
        });
        
        // Send system message (for chat feed) - must arrive even if user is muted
        const systemMsgSent = sendToClientId(gcSid, {
          type: 'system',
          text: `Admin muted you for ${durationLabel}`,
          timestamp: Date.now()
        });
        
        console.log(`[ADMIN-BAN] Notification delivery: target=${gcSid.substring(0, 8)}... muteEvent=${muteEventSent} systemMsg=${systemMsgSent}`);

        // Send confirmation to admin
        ws.send(JSON.stringify({ 
          type: 'admin_ban_success',
          ok: true,
          gcSid: gcSid.substring(0, 8),
          duration: Math.ceil(duration / 1000)
        }));
        
        return;
      }

      // Handle moderator ban user (ban only client users)
      if (message.type === "moderator_ban") {
        if (!info.adminUser || info.adminUser.role !== 'moderator') {
          console.log(`[MOD-BAN] ❌ Unauthorized: not moderator`);
          ws.send(JSON.stringify({ 
            type: 'admin_ban_error', 
            error: 'Unauthorized: Moderator access required' 
          }));
          return;
        }

        const { gcSid, duration, deleteMessage } = message;
        if (!gcSid || !duration) {
          console.log(`[MOD-BAN] ❌ Missing gcSid or duration`);
          ws.send(JSON.stringify({ 
            type: 'admin_ban_error', 
            error: 'Missing required parameters' 
          }));
          return;
        }

        // Prevent moderator from muting themselves
        if (info.gcSid === gcSid) {
          console.log(`[MOD-BAN] ❌ Moderator ${info.adminUser.username} tried to mute themselves`);
          ws.send(JSON.stringify({ 
            type: 'admin_ban_error', 
            error: 'Cannot mute yourself' 
          }));
          return;
        }

        // Check if target is a staff member (admin or moderator)
        // We need to check all connected clients to see if the target gcSid belongs to a staff member
        let isTargetStaff = false;
        for (const [, clientInfo] of clients) {
          if (clientInfo.gcSid === gcSid && clientInfo.adminUser && (clientInfo.adminUser.role === 'admin' || clientInfo.adminUser.role === 'moderator')) {
            isTargetStaff = true;
            break;
          }
        }

        if (isTargetStaff) {
          console.log(`[MOD-BAN] ❌ Moderator ${info.adminUser.username} tried to ban staff member`);
          ws.send(JSON.stringify({ type: 'system', text: 'Not allowed to moderate staff members' }));
          return;
        }

        // Apply ban
        const banUntil = now() + duration;
        const banReason = `Muted by moderator for ${Math.ceil(duration / 1000)} seconds`;
        adminBans.set(gcSid, { 
          bannedUntil: banUntil, 
          bannedBy: info.adminUser.username,
          reason: banReason,
          duration: duration,
          isModerator: true
        });
        
        // Save state to persist bans
        saveServerState();
        
        // MOD_MUTE applied log with persistent key
        const durationSec = Math.ceil(duration / 1000);
        console.log(`[MOD-MUTE-APPLY] ✓ Moderator ${info.adminUser.username} muted persistentKey=${gcSid.substring(0, 6)}... for ${durationSec}s`);

        // Delete message if requested
        if (deleteMessage && message.messageId) {
          try {
            // Check message permissions before deleting
            const allMessages = await getRecentMessages(MAX_MESSAGES);
            const messageToDelete = allMessages.find(m => m.id === message.messageId);
            
            if (messageToDelete) {
              const messageRole = (messageToDelete.adminStyleMeta && messageToDelete.adminStyleMeta.role) || (messageToDelete.isAdmin ? 'admin' : 'client');
              if (messageRole === 'admin' || messageRole === 'moderator') {
                console.log(`[MOD-BAN] ❌ Cannot delete staff message`);
              } else {
                await deleteMessageById(message.messageId);
                broadcast({ type: "delete", id: message.messageId });
                console.log(`[MOD-BAN] ✓ Deleted message ${message.messageId}`);
              }
            }
          } catch (error) {
            console.error(`[MOD-BAN] Error deleting message:`, error);
          }
        }

        // Notify the banned user with admin_mute event and system message
        const durationLabel = formatDurationLabel(duration);
        
        // Send admin_mute event (for status bar and input disabling)
        const muteEventSent = sendToClientId(gcSid, {
          type: 'admin_mute',
          until: banUntil,
          seconds: Math.ceil(duration / 1000),
          reason: banReason
        });
        
        // Send system message (for chat feed) - must arrive even if user is muted
        const systemMsgSent = sendToClientId(gcSid, {
          type: 'system',
          text: `Moderator muted you for ${durationLabel}`,
          timestamp: Date.now()
        });
        
        console.log(`[MOD-BAN] Notification delivery: target=${gcSid.substring(0, 8)}... muteEvent=${muteEventSent} systemMsg=${systemMsgSent}`);

        // Send confirmation to moderator
        ws.send(JSON.stringify({ 
          type: 'admin_ban_success',
          ok: true,
          gcSid: gcSid.substring(0, 8),
          duration: Math.ceil(duration / 1000)
        }));
        
        return;
      }

      // Handle admin lock chat
      if (message.type === "admin_lock_chat") {
        if (!info.adminUser || info.adminUser.role !== 'admin') {
          console.log(`[ADMIN-LOCK] ❌ Unauthorized: not admin`);
          return;
        }

        serverState.chatLocked = message.locked;
        saveServerState();
        console.log(`[ADMIN-LOCK] Admin ${info.adminUser.username} ${serverState.chatLocked ? 'locked' : 'unlocked'} chat`);

        // Broadcast lock state to all clients
        broadcast({
          type: 'chat_lock_changed',
          locked: serverState.chatLocked,
          lockedBy: info.adminUser.username
        });

        return;
      }

      // Handle admin wipe data
      if (message.type === "admin_wipe_data") {
        if (!info.adminUser || info.adminUser.role !== 'admin') {
          console.log(`[ADMIN-WIPE] ❌ Unauthorized: not admin`);
          ws.send(JSON.stringify({ 
            type: 'admin_wipe_error', 
            error: 'Unauthorized: Admin access required' 
          }));
          return;
        }

        console.log(`[ADMIN-WIPE] Admin ${info.adminUser.username} is wiping all chat data`);

        try {
          // Delete all messages from database efficiently
          const messageCount = await wipeAllMessages();
          console.log(`[ADMIN-WIPE] ✓ Deleted ${messageCount} messages from database`);

          // Delete all uploaded files
          let fileCount = 0;
          if (fs.existsSync(UPLOAD_DIR)) {
            const files = fs.readdirSync(UPLOAD_DIR);
            fileCount = files.length;
            for (const file of files) {
              try {
                fs.unlinkSync(path.join(UPLOAD_DIR, file));
              } catch (err) {
                console.error(`[ADMIN-WIPE] Error deleting file ${file}:`, err.message);
              }
            }
            console.log(`[ADMIN-WIPE] ✓ Deleted ${fileCount} uploaded files`);
          }

          console.log(`[ADMIN-WIPE] ✓ Wiped all chat data: ${messageCount} messages, ${fileCount} files`);

          // Broadcast wipe event to all clients
          broadcast({
            type: 'chat_wiped',
            wipedBy: info.adminUser.username
          });

          // Send confirmation to admin with success details
          ws.send(JSON.stringify({ 
            type: 'admin_wipe_success',
            ok: true,
            messagesDeleted: messageCount,
            filesDeleted: fileCount
          }));
        } catch (error) {
          console.error(`[ADMIN-WIPE] Error:`, error);
          ws.send(JSON.stringify({ 
            type: 'admin_wipe_error', 
            ok: false,
            error: error.message 
          }));
        }

        return;
      }

      // Rate limit check for user messages (text, image, audio, video, file) - USE STATE BY TOKEN
      const sendTypes = new Set(["text", "image", "audio", "video", "file"]);
      if (sendTypes.has(message.type)) {
        // Check if chat is locked (only admin can send, moderators are blocked)
        if (serverState.chatLocked) {
          if (!info.adminUser || info.adminUser.role !== 'admin') {
            console.log(`[CHAT-LOCKED] Message blocked: chat is locked by admin`);
            ws.send(JSON.stringify({ 
              type: 'send_blocked',
              reason: 'CHAT_LOCKED',
              message: 'Chat is paused by admin'
            }));
            return;
          } else {
            console.log(`[CHAT-LOCKED] Admin ${info.adminUser.username} sending message (chat is locked for others)`);
          }
        }

        // Check admin ban/mute
        const adminBan = adminBans.get(info.gcSid);
        if (adminBan && now() < adminBan.bannedUntil) {
          const remainingMs = adminBan.bannedUntil - now();
          const remainingSeconds = Math.ceil(remainingMs / 1000);
          console.log(`[ADMIN-MUTE-BLOCK] ✗ Message BLOCKED for persistentKey=${info.gcSid.substring(0, 6)}... (${remainingMs}ms remaining)`);
          ws.send(JSON.stringify({ 
            type: 'admin_mute',
            until: adminBan.bannedUntil,
            seconds: remainingSeconds,
            remainingMs: remainingMs,
            reason: adminBan.reason || `Muted by admin (${remainingSeconds}s remaining)`
          }));
          return;
        } else if (adminBan) {
          // Ban expired, remove it
          adminBans.delete(info.gcSid);
          saveServerState();
          console.log(`[ADMIN-MUTE-BLOCK] Ban expired for persistentKey=${info.gcSid.substring(0, 6)}...`);
        }

        // CRITICAL: Check mute status FIRST before any other processing
        const profState = getProfanityState(info.gcSid);
        if (isProfanityMuted(profState)) {
          const muteRemainingMs = profState.muteUntil - now();
          console.log(`[MUTE-ENFORCED] Client ${connectionId} is muted (${Math.ceil(muteRemainingMs / 1000)}s remaining, ${profState.strikes} strikes)`);
          sendModerationNotice(ws, profState, 'muted_attempt', 'You are currently muted');
          return;
        }

        // Check if rate-limited (banned)
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

        // Check display name (nickname) for banned words
        const nickname = (message.nickname || 'Anonymous').substring(0, 100);
        const nameCheck = checkDisplayName(nickname);
        
        if (!nameCheck.allowed) {
          // Apply profanity strike for name violation
          applyProfanityStrike(profState);
          console.log(`[NAME-VIOLATION] Blocked name "${nickname}" from ${connectionId} (gcSid: ${info.gcSid.substring(0, 8)}...)`);
          console.log(`[NAME-VIOLATION] Found banned terms: ${nameCheck.found.join(', ')}`);
          console.log(`[NAME-VIOLATION] Strike ${profState.strikes} issued`);
          
          // Send immediate moderation notice
          sendModerationNotice(ws, profState, 'blocked_name', 'Name contains banned words', nameCheck.found);
          
          return; // Block the message from being sent
        }
      }
      
      if (message.type === 'text') {
        // Get profanity state for this user (already fetched above, but get again for clarity)
        const profState = getProfanityState(info.gcSid);
        
        // Validate input
        const nickname = (message.nickname || 'Anonymous').substring(0, 100);
        const originalText = (message.text || '').substring(0, 1000);
        const originalHtml = (message.html || '').substring(0, 5000);

        if (!originalText.trim()) {
          console.log(`[MESSAGE] Ignored empty text from ${connectionId}`);
          return;
        }

        // Admin/Moderator special styling support - validate and sanitize
        const isAdmin = info.adminUser && info.adminUser.role === 'admin';
        const isModerator = info.adminUser && info.adminUser.role === 'moderator';
        const isStaff = isAdmin || isModerator;
        let adminStyleMeta = null;
        
        // SECURITY: Only allow admin style metadata from actual admin/moderator users
        if (message.adminStyleMeta) {
          if (isStaff) {
            // Admin/Moderator can send style metadata
            adminStyleMeta = {
              displayName: (message.adminStyleMeta.displayName || nickname).substring(0, 100),
              color: message.adminStyleMeta.color || 'inherit',
              scale: parseFloat(message.adminStyleMeta.scale) || 1.0,
              fontWeight: message.adminStyleMeta.fontWeight || 'normal',
              role: message.adminStyleMeta.role || (isAdmin ? 'admin' : 'moderator')
            };
            console.log(`[STAFF-STYLE] ${isAdmin ? 'Admin' : 'Moderator'} ${info.adminUser.username} using style: displayName="${adminStyleMeta.displayName}", color=${adminStyleMeta.color}, scale=${adminStyleMeta.scale}`);
          } else {
            // Non-staff tried to send style metadata - strip it
            console.log(`[SECURITY] Non-staff user tried to send admin style metadata - stripped`);
          }
        }

        // Filter profanity from text (skip for admins and moderators)
        let filteredText = originalText;
        let filteredHtml = originalHtml;
        let foundProfanity = [];

        if (!isStaff) {
          const profanityCheck = filterProfanity(originalText);
          filteredText = profanityCheck.filtered;
          foundProfanity = profanityCheck.found;
          
          // If profanity was found, apply strike and send immediate notice
          if (foundProfanity.length > 0) {
            applyProfanityStrike(profState);
            console.log(`[PROFANITY] Found ${foundProfanity.length} banned term(s) in message from ${nickname}: ${foundProfanity.join(', ')}`);
            
            // Send immediate moderation notice
            sendModerationNotice(ws, profState, 'sanitized_message', 'Message contains banned words', foundProfanity);
          }
          
          // Filter HTML if present (basic approach: filter text in HTML)
          if (originalHtml && foundProfanity.length > 0) {
            // Simple approach: replace profanity in HTML as well
            for (const word of foundProfanity) {
              const escapedWord = word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
              const regex = new RegExp(escapedWord, 'gi');
              filteredHtml = filteredHtml.replace(regex, (match) => '-'.repeat(match.length));
            }
          }
        } else {
          console.log(`[STAFF-MESSAGE] ${isAdmin ? 'Admin' : 'Moderator'} ${info.adminUser.username} sending message (profanity filter bypassed)`);
        }

        const chatMessage = {
          type: 'text',
          id: msgId,
          senderId: info.clientId,
          senderClientId: info.gcSid, // Cookie-based stable ID for ban targeting
          nickname,
          timestamp: message.timestamp || Date.now(),
          text: filteredText, // Use filtered text
          html: filteredHtml || undefined, // Use filtered HTML if present
          isAdmin: isAdmin, // Flag to identify admin messages
          // Include admin style metadata if present (validated above)
          ...(adminStyleMeta ? { adminStyleMeta } : {})
        };

        // CRITICAL: Save to database FIRST - DO NOT broadcast if this fails!
        try {
          await saveMessage(chatMessage);
          await pruneToLimit(MAX_MESSAGES);
          console.log(`[MESSAGE] ✓ Text message saved to database successfully`);
        } catch (dbError) {
          console.error(`[MESSAGE] ❌ CRITICAL: Failed to save text message to database!`);
          console.error(`[MESSAGE] ❌ Error:`, dbError);
          console.error(`[MESSAGE] ❌ Message will NOT be broadcast (preventing data loss)`);
          
          // Send error to sender
          ws.send(JSON.stringify({
            type: 'send_error',
            id: msgId,
            error: 'Failed to save message to database',
            details: dbError.message
          }));
          
          // DO NOT BROADCAST - return early
          return;
        }

        // Send ACK to sender after successful save
        const ackPayload = {
          type: 'ack',
          id: msgId,
          messageId: msgId,
          serverTime: new Date().toISOString(),
          instanceId: SERVER_INSTANCE_ID
        };
        ws.send(JSON.stringify(ackPayload));
        console.log(`[ACK] *** SERVER ${SERVER_INSTANCE_ID} *** Sent ACK for id=${msgId} messageId=${msgId}`);

        // Broadcast after successful save
        broadcast(chatMessage);
        
        // Debug log for admin styled messages
        if (adminStyleMeta) {
          console.log(`[ADMIN-STYLE] broadcast message id=${msgId} styleKey=${adminStyleMeta.color}_${adminStyleMeta.scale}x displayName="${adminStyleMeta.displayName}"`);
        }
        
        console.log(`[MESSAGE] Text message from ${nickname}: "${filteredText.substring(0, 50)}${filteredText.length > 50 ? '...' : ''}"`);
      } else if (message.type === 'image') {
        const nickname = (message.nickname || 'Anonymous').substring(0, 100);
        const isAdmin = info.adminUser && info.adminUser.role === 'admin';
        const isModerator = info.adminUser && info.adminUser.role === 'moderator';
        const isStaff = isAdmin || isModerator;
        
        // Validate admin style metadata
        let adminStyleMeta = null;
        if (message.adminStyleMeta && isStaff) {
          adminStyleMeta = {
            displayName: (message.adminStyleMeta.displayName || nickname).substring(0, 100),
            color: message.adminStyleMeta.color || 'inherit',
            scale: parseFloat(message.adminStyleMeta.scale) || 1.0,
            fontWeight: message.adminStyleMeta.fontWeight || 'normal',
            role: message.adminStyleMeta.role || (isAdmin ? 'admin' : 'moderator')
          };
        }

        const chatMessage = {
          type: 'image',
          id: msgId,
          senderId: info.clientId,
          senderClientId: info.gcSid, // Cookie-based stable ID for ban targeting
          nickname,
          timestamp: message.timestamp || Date.now(),
          url: message.url,
          filename: message.filename,
          mime: message.mime,
          size: message.size,
          caption: message.caption || '',
          isAdmin: isAdmin,
          ...(adminStyleMeta ? { adminStyleMeta } : {})
        };

        // CRITICAL: Save to database FIRST - DO NOT broadcast if this fails!
        try {
          await saveMessage(chatMessage);
          await pruneToLimit(MAX_MESSAGES);
          console.log(`[MESSAGE] ✓ Image message saved to database successfully`);
        } catch (dbError) {
          console.error(`[MESSAGE] ❌ CRITICAL: Failed to save image message to database!`);
          console.error(`[MESSAGE] ❌ Error:`, dbError);
          console.error(`[MESSAGE] ❌ Message will NOT be broadcast (preventing data loss)`);
          
          // Send error to sender
          ws.send(JSON.stringify({
            type: 'send_error',
            id: msgId,
            error: 'Failed to save message to database',
            details: dbError.message
          }));
          
          // DO NOT BROADCAST - return early
          return;
        }

        // Send ACK to sender after successful save
        const ackPayload = {
          type: 'ack',
          id: msgId,
          messageId: msgId,
          serverTime: new Date().toISOString(),
          instanceId: SERVER_INSTANCE_ID
        };
        ws.send(JSON.stringify(ackPayload));
        console.log(`[ACK] *** SERVER ${SERVER_INSTANCE_ID} *** Sent ACK for image id=${msgId} messageId=${msgId}`);

        // Broadcast after successful save
        broadcast(chatMessage);
        
        // Debug log for admin styled messages
        if (adminStyleMeta) {
          console.log(`[ADMIN-STYLE] broadcast message id=${msgId} styleKey=${adminStyleMeta.color}_${adminStyleMeta.scale}x displayName="${adminStyleMeta.displayName}"`);
        }
        
        console.log(`[MESSAGE] Image from ${nickname}: ${message.filename} (${message.size} bytes)`);
      } else if (message.type === 'audio') {
        const nickname = (message.nickname || 'Anonymous').substring(0, 100);
        const caption = message.caption || '';
        const isAdmin = info.adminUser && info.adminUser.role === 'admin';
        const isModerator = info.adminUser && info.adminUser.role === 'moderator';
        const isStaff = isAdmin || isModerator;
        
        // Validate admin style metadata
        let adminStyleMeta = null;
        if (message.adminStyleMeta && isStaff) {
          adminStyleMeta = {
            displayName: (message.adminStyleMeta.displayName || nickname).substring(0, 100),
            color: message.adminStyleMeta.color || 'inherit',
            scale: parseFloat(message.adminStyleMeta.scale) || 1.0,
            fontWeight: message.adminStyleMeta.fontWeight || 'normal',
            role: message.adminStyleMeta.role || (isAdmin ? 'admin' : 'moderator')
          };
        }

        const chatMessage = {
          type: 'audio',
          id: msgId,
          senderId: info.clientId,
          senderClientId: info.gcSid, // Cookie-based stable ID for ban targeting
          nickname,
          timestamp: message.timestamp || Date.now(),
          url: message.url,
          caption: caption,
          isAdmin: isAdmin,
          ...(adminStyleMeta ? { adminStyleMeta } : {})
        };

        // CRITICAL: Save to database FIRST - DO NOT broadcast if this fails!
        try {
          await saveMessage(chatMessage);
          await pruneToLimit(MAX_MESSAGES);
          console.log(`[MESSAGE] ✓ Audio message saved to database successfully`);
        } catch (dbError) {
          console.error(`[MESSAGE] ❌ CRITICAL: Failed to save audio message to database!`);
          console.error(`[MESSAGE] ❌ Error:`, dbError);
          console.error(`[MESSAGE] ❌ Message will NOT be broadcast (preventing data loss)`);
          
          // Send error to sender
          ws.send(JSON.stringify({
            type: 'send_error',
            id: msgId,
            error: 'Failed to save message to database',
            details: dbError.message
          }));
          
          // DO NOT BROADCAST - return early
          return;
        }

        // Send ACK to sender after successful save
        const ackPayload = {
          type: 'ack',
          id: msgId,
          messageId: msgId,
          serverTime: new Date().toISOString(),
          instanceId: SERVER_INSTANCE_ID
        };
        ws.send(JSON.stringify(ackPayload));
        console.log(`[ACK] *** SERVER ${SERVER_INSTANCE_ID} *** Sent ACK for audio id=${msgId} messageId=${msgId}`);

        // Broadcast after successful save
        broadcast(chatMessage);
        
        // Debug log for admin styled messages
        if (adminStyleMeta) {
          console.log(`[ADMIN-STYLE] broadcast message id=${msgId} styleKey=${adminStyleMeta.color}_${adminStyleMeta.scale}x displayName="${adminStyleMeta.displayName}"`);
        }
        
        console.log(`[MESSAGE] Audio from ${nickname}: ${message.url} (caption: "${caption.substring(0, 50)}")`);
      } else if (message.type === 'video') {
        const nickname = (message.nickname || 'Anonymous').substring(0, 100);
        const isAdmin = info.adminUser && info.adminUser.role === 'admin';
        const isModerator = info.adminUser && info.adminUser.role === 'moderator';
        const isStaff = isAdmin || isModerator;
        
        // Validate admin style metadata
        let adminStyleMeta = null;
        if (message.adminStyleMeta && isStaff) {
          adminStyleMeta = {
            displayName: (message.adminStyleMeta.displayName || nickname).substring(0, 100),
            color: message.adminStyleMeta.color || 'inherit',
            scale: parseFloat(message.adminStyleMeta.scale) || 1.0,
            fontWeight: message.adminStyleMeta.fontWeight || 'normal',
            role: message.adminStyleMeta.role || (isAdmin ? 'admin' : 'moderator')
          };
        }

        const chatMessage = {
          type: 'video',
          id: msgId,
          senderId: info.clientId,
          senderClientId: info.gcSid, // Cookie-based stable ID for ban targeting
          nickname,
          timestamp: message.timestamp || Date.now(),
          url: message.url,
          filename: message.filename,
          mime: message.mime,
          size: message.size,
          caption: message.caption || '',
          isAdmin: isAdmin,
          ...(adminStyleMeta ? { adminStyleMeta } : {})
        };

        // CRITICAL: Save to database FIRST - DO NOT broadcast if this fails!
        try {
          await saveMessage(chatMessage);
          await pruneToLimit(MAX_MESSAGES);
          console.log(`[MESSAGE] ✓ Video message saved to database successfully`);
        } catch (dbError) {
          console.error(`[MESSAGE] ❌ CRITICAL: Failed to save video message to database!`);
          console.error(`[MESSAGE] ❌ Error:`, dbError);
          console.error(`[MESSAGE] ❌ Message will NOT be broadcast (preventing data loss)`);
          
          // Send error to sender
          ws.send(JSON.stringify({
            type: 'send_error',
            id: msgId,
            error: 'Failed to save message to database',
            details: dbError.message
          }));
          
          // DO NOT BROADCAST - return early
          return;
        }

        // Send ACK to sender after successful save
        const ackPayload = {
          type: 'ack',
          id: msgId,
          messageId: msgId,
          serverTime: new Date().toISOString(),
          instanceId: SERVER_INSTANCE_ID
        };
        ws.send(JSON.stringify(ackPayload));
        console.log(`[ACK] *** SERVER ${SERVER_INSTANCE_ID} *** Sent ACK for video id=${msgId} messageId=${msgId}`);

        // Broadcast after successful save
        broadcast(chatMessage);
        
        // Debug log for admin styled messages
        if (adminStyleMeta) {
          console.log(`[ADMIN-STYLE] broadcast message id=${msgId} styleKey=${adminStyleMeta.color}_${adminStyleMeta.scale}x displayName="${adminStyleMeta.displayName}"`);
        }
        
        console.log(`[MESSAGE] Video from ${nickname}: ${message.filename} (${message.size} bytes)`);
      } else if (message.type === 'file') {
        const nickname = (message.nickname || 'Anonymous').substring(0, 100);
        const isAdmin = info.adminUser && info.adminUser.role === 'admin';
        const isModerator = info.adminUser && info.adminUser.role === 'moderator';
        const isStaff = isAdmin || isModerator;
        
        // Validate admin style metadata
        let adminStyleMeta = null;
        if (message.adminStyleMeta && isStaff) {
          adminStyleMeta = {
            displayName: (message.adminStyleMeta.displayName || nickname).substring(0, 100),
            color: message.adminStyleMeta.color || 'inherit',
            scale: parseFloat(message.adminStyleMeta.scale) || 1.0,
            fontWeight: message.adminStyleMeta.fontWeight || 'normal',
            role: message.adminStyleMeta.role || (isAdmin ? 'admin' : 'moderator')
          };
        }

        const chatMessage = {
          type: 'file',
          id: msgId,
          senderId: info.clientId,
          senderClientId: info.gcSid, // Cookie-based stable ID for ban targeting
          nickname,
          timestamp: message.timestamp || Date.now(),
          url: message.url,
          filename: message.filename,
          mime: message.mime,
          size: message.size,
          isAdmin: isAdmin,
          ...(adminStyleMeta ? { adminStyleMeta } : {})
        };

        // CRITICAL: Save to database FIRST - DO NOT broadcast if this fails!
        try {
          await saveMessage(chatMessage);
          await pruneToLimit(MAX_MESSAGES);
          console.log(`[MESSAGE] ✓ File message saved to database successfully`);
        } catch (dbError) {
          console.error(`[MESSAGE] ❌ CRITICAL: Failed to save file message to database!`);
          console.error(`[MESSAGE] ❌ Error:`, dbError);
          console.error(`[MESSAGE] ❌ Message will NOT be broadcast (preventing data loss)`);
          
          // Send error to sender
          ws.send(JSON.stringify({
            type: 'send_error',
            id: msgId,
            error: 'Failed to save message to database',
            details: dbError.message
          }));
          
          // DO NOT BROADCAST - return early
          return;
        }

        // Send ACK to sender after successful save
        const ackPayload = {
          type: 'ack',
          id: msgId,
          messageId: msgId,
          serverTime: new Date().toISOString(),
          instanceId: SERVER_INSTANCE_ID
        };
        ws.send(JSON.stringify(ackPayload));
        console.log(`[ACK] *** SERVER ${SERVER_INSTANCE_ID} *** Sent ACK for file id=${msgId} messageId=${msgId}`);

        // Broadcast after successful save
        broadcast(chatMessage);
        
        // Debug log for admin styled messages
        if (adminStyleMeta) {
          console.log(`[ADMIN-STYLE] broadcast message id=${msgId} styleKey=${adminStyleMeta.color}_${adminStyleMeta.scale}x displayName="${adminStyleMeta.displayName}"`);
        }
        
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
    
    // Load server state
    loadServerState();
    
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
      console.log(`========================================`);
      console.log(`[PERSISTENCE] *** PRODUCTION PATHS ***`);
      console.log(`[PERSISTENCE] Database: ${DB_PATH}`);
      console.log(`[PERSISTENCE] Uploads:  ${UPLOAD_DIR}`);
      console.log(`[PERSISTENCE] DB exists: ${fs.existsSync(DB_PATH) ? 'YES' : 'NO (will be created)'}`);
      console.log(`[PERSISTENCE] Upload dir exists: ${fs.existsSync(UPLOAD_DIR) ? 'YES' : 'NO (created)'}`);
      console.log(`========================================`);
      console.log(`[CONFIG] Environment variables:`);
      console.log(`  DB_PATH=${process.env.DB_PATH || '(using production default)'}`);
      console.log(`  UPLOAD_DIR=${process.env.UPLOAD_DIR || '(using production default)'}`);
      console.log(`  MAX_MESSAGES=${process.env.MAX_MESSAGES || '(default)'}`);
      console.log(`[CONFIG] History limit: ${MAX_MESSAGES} messages`);
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
