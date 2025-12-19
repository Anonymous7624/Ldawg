const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');

const app = express();
const PORT = 8082;
const MAX_UPLOAD_SIZE = 10 * 1024 * 1024; // 10MB

// Allowed origins
const ALLOWED_ORIGINS = [
  'https://ldawg7624.com',
  'https://www.ldawg7624.com',
  'http://localhost:8080',
  'http://127.0.0.1:8080'
];

// Ensure uploads directory exists
const UPLOADS_DIR = path.join(__dirname, 'uploads');
if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

// CORS middleware
app.use((req, res, next) => {
  const origin = req.headers.origin;
  
  if (origin && ALLOWED_ORIGINS.includes(origin)) {
    res.header('Access-Control-Allow-Origin', origin);
  } else {
    // Allow direct access (no origin header)
    res.header('Access-Control-Allow-Origin', '*');
  }
  
  res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type');
  
  if (req.method === 'OPTIONS') {
    console.log(`[CORS] OPTIONS preflight from ${origin || 'direct'}`);
    return res.status(204).end();
  }
  
  next();
});

// Multer storage configuration
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
    
    // Block dangerous file types
    if (['.js', '.html', '.svg', '.exe', '.sh'].includes(ext)) {
      return cb(new Error('File type not allowed'));
    }
    
    cb(null, true);
  }
});

// Health check
app.get('/', (req, res) => {
  res.json({ 
    service: 'Kennedy Chat Upload Service',
    status: 'ok',
    port: PORT
  });
});

app.get('/healthz', (req, res) => {
  res.json({ ok: true });
});

// Upload endpoint
app.post('/upload', (req, res) => {
  const origin = req.headers.origin || 'direct';
  console.log(`[UPLOAD] POST /upload from ${origin}`);
  
  upload.single('file')(req, res, (err) => {
    // Ensure CORS on error too
    if (origin && ALLOWED_ORIGINS.includes(origin)) {
      res.header('Access-Control-Allow-Origin', origin);
    }
    res.setHeader('Content-Type', 'application/json');
    
    if (err) {
      console.error('[UPLOAD] Error:', err.message);
      return res.status(400).json({ 
        success: false,
        ok: false,
        error: err.message 
      });
    }
    
    if (!req.file) {
      console.log('[UPLOAD] No file in request');
      return res.status(400).json({ 
        success: false,
        ok: false,
        error: 'No file uploaded' 
      });
    }
    
    try {
      const ext = path.extname(req.file.originalname).toLowerCase();
      const mime = req.file.mimetype.toLowerCase();
      const imageExts = ['.jpg', '.jpeg', '.png', '.webp', '.gif'];
      const isImage = imageExts.includes(ext) && mime.startsWith('image/');
      
      // Return URL that points to this upload service
      const uploadUrl = `https://upload.ldawg7624.com/uploads/${req.file.filename}`;
      
      console.log(`[UPLOAD] Success: ${req.file.originalname} (${req.file.size} bytes)`);
      console.log(`[UPLOAD] URL: ${uploadUrl}`);
      
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
      console.error('[UPLOAD] Handler error:', error);
      res.status(500).json({ 
        success: false,
        ok: false,
        error: error.message 
      });
    }
  });
});

// Serve uploaded files
app.use('/uploads', express.static(UPLOADS_DIR, {
  setHeaders: (res, filePath) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    
    const ext = path.extname(filePath).toLowerCase();
    const imageExts = ['.jpg', '.jpeg', '.png', '.webp', '.gif'];
    
    if (!imageExts.includes(ext)) {
      res.setHeader('Content-Disposition', 'attachment');
    }
  }
}));

// Cleanup old uploads (older than 1 hour)
setInterval(() => {
  const now = Date.now();
  const MAX_AGE = 60 * 60 * 1000; // 1 hour
  
  fs.readdir(UPLOADS_DIR, (err, files) => {
    if (err) return;
    
    files.forEach(file => {
      const filePath = path.join(UPLOADS_DIR, file);
      fs.stat(filePath, (err, stats) => {
        if (err) return;
        
        if (now - stats.mtimeMs > MAX_AGE) {
          fs.unlink(filePath, (err) => {
            if (!err) {
              console.log(`[CLEANUP] Removed old file: ${file}`);
            }
          });
        }
      });
    });
  });
}, 5 * 60 * 1000); // Run every 5 minutes

app.listen(PORT, () => {
  console.log('========================================');
  console.log('Kennedy Chat Upload Service');
  console.log('========================================');
  console.log(`Port: ${PORT}`);
  console.log(`Uploads dir: ${UPLOADS_DIR}`);
  console.log(`Max file size: ${MAX_UPLOAD_SIZE / 1024 / 1024}MB`);
  console.log('========================================');
});
