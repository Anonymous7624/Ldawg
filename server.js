const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

const PORT = 8080;
const MAX_MESSAGES = 50;
const MAX_UPLOAD_SIZE = 10 * 1024 * 1024; // 10MB
const RATE_LIMIT_MESSAGES = 7;
const RATE_LIMIT_WINDOW = 10000; // 10 seconds
const MUTE_DURATION_FIRST = 15000; // 15 seconds
const MUTE_DURATION_STRIKES = 120000; // 120 seconds
const UPLOAD_CLEANUP_AGE = 60 * 60 * 1000; // 1 hour

// In-memory state
const chatHistory = [];
const uploadFiles = new Map(); // Map of upload ID to {filename, timestamp, path}
const clientRateLimits = new Map(); // Map of client IP to rate limit state

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
app.use(express.static(path.join(__dirname, 'public')));

// Health check endpoint
app.get('/healthz', (req, res) => {
  res.json({ ok: true });
});

// Upload endpoint
app.post('/upload', upload.single('file'), (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
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

    res.json({
      success: true,
      url: uploadUrl,
      filename: req.file.originalname,
      mime: req.file.mimetype,
      size: req.file.size,
      isImage
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Serve uploads with security headers
app.get('/uploads/:filename', (req, res) => {
  const filename = req.params.filename;
  const filePath = path.join(UPLOADS_DIR, filename);

  if (!fs.existsSync(filePath)) {
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
  wss.clients.forEach(client => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(data);
    }
  });
}

// Rate limiting
function checkRateLimit(clientId) {
  const now = Date.now();
  
  if (!clientRateLimits.has(clientId)) {
    clientRateLimits.set(clientId, {
      messages: [],
      strikes: 0,
      mutedUntil: 0
    });
  }

  const limitState = clientRateLimits.get(clientId);

  // Check if currently muted
  if (limitState.mutedUntil > now) {
    return {
      allowed: false,
      muted: true,
      seconds: Math.ceil((limitState.mutedUntil - now) / 1000),
      strikes: limitState.strikes
    };
  }

  // Clean old messages outside the window
  limitState.messages = limitState.messages.filter(t => now - t < RATE_LIMIT_WINDOW);

  // Check if over limit
  if (limitState.messages.length >= RATE_LIMIT_MESSAGES) {
    limitState.strikes++;
    
    if (limitState.strikes >= 3) {
      limitState.mutedUntil = now + MUTE_DURATION_STRIKES;
      return {
        allowed: false,
        muted: true,
        seconds: Math.ceil(MUTE_DURATION_STRIKES / 1000),
        strikes: limitState.strikes
      };
    } else {
      limitState.mutedUntil = now + MUTE_DURATION_FIRST;
      return {
        allowed: false,
        muted: true,
        seconds: Math.ceil(MUTE_DURATION_FIRST / 1000),
        strikes: limitState.strikes
      };
    }
  }

  // Add current message timestamp
  limitState.messages.push(now);
  return { allowed: true };
}

// WebSocket connection handler
wss.on('connection', (ws, req) => {
  const clientId = req.socket.remoteAddress;
  console.log(`Client connected: ${clientId}`);

  // Send chat history
  ws.send(JSON.stringify({
    type: 'history',
    items: chatHistory
  }));

  ws.on('message', (data) => {
    try {
      const message = JSON.parse(data);

      // Rate limit check
      const rateLimitResult = checkRateLimit(clientId);
      if (!rateLimitResult.allowed) {
        ws.send(JSON.stringify({
          type: 'muted',
          seconds: rateLimitResult.seconds,
          strikes: rateLimitResult.strikes
        }));
        return;
      }

      if (message.type === 'text') {
        // Validate input
        const nickname = (message.nickname || 'Anonymous').substring(0, 100);
        const text = (message.text || '').substring(0, 1000);

        if (!text.trim()) {
          return;
        }

        const chatMessage = {
          type: 'text',
          id: crypto.randomBytes(8).toString('hex'),
          nickname,
          timestamp: Date.now(),
          text
        };

        addToHistory(chatMessage);
        broadcast(chatMessage);
      } else if (message.type === 'image') {
        const nickname = (message.nickname || 'Anonymous').substring(0, 100);

        const chatMessage = {
          type: 'image',
          id: crypto.randomBytes(8).toString('hex'),
          nickname,
          timestamp: Date.now(),
          url: message.url,
          filename: message.filename,
          mime: message.mime,
          size: message.size
        };

        addToHistory(chatMessage);
        broadcast(chatMessage);
      } else if (message.type === 'file') {
        const nickname = (message.nickname || 'Anonymous').substring(0, 100);

        const chatMessage = {
          type: 'file',
          id: crypto.randomBytes(8).toString('hex'),
          nickname,
          timestamp: Date.now(),
          url: message.url,
          filename: message.filename,
          mime: message.mime,
          size: message.size
        };

        addToHistory(chatMessage);
        broadcast(chatMessage);
      }
    } catch (error) {
      console.error('Error processing message:', error);
    }
  });

  ws.on('close', () => {
    console.log(`Client disconnected: ${clientId}`);
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
server.listen(PORT, () => {
  console.log(`Global Chat Room server running on port ${PORT}`);
  console.log(`Access at http://localhost:${PORT}`);
});
