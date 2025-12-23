const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const { execFile } = require('child_process');

const app = express();

// Environment-driven configuration with PRODUCTION DEFAULTS
const PORT = parseInt(process.env.UPLOAD_PORT || '8082', 10);
const UPLOAD_DIR = process.env.UPLOAD_DIR || '/home/ldawg7624/chat-data/uploads';
const UPLOAD_BASE_URL = process.env.UPLOAD_BASE_URL || 'https://upload.ldawg7624.com';
const MAX_UPLOAD_SIZE = 10 * 1024 * 1024; // 10MB

// Allowed origins
const ALLOWED_ORIGINS = [
  'https://ldawg7624.com',
  'https://www.ldawg7624.com',
  'http://localhost:8080',
  'http://127.0.0.1:8080'
];

// Ensure uploads directory exists
if (!fs.existsSync(UPLOAD_DIR)) {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
  console.log(`[STARTUP] Created upload directory: ${UPLOAD_DIR}`);
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
    cb(null, UPLOAD_DIR);
  },
  filename: (req, file, cb) => {
    const uniqueName = crypto.randomBytes(16).toString('hex') + path.extname(file.originalname);
    cb(null, uniqueName);
  }
});

// Blocked file extensions for security
const BLOCKED_EXTENSIONS = [
  '.exe', '.msi', '.bat', '.cmd', '.com', '.scr', '.ps1', 
  '.vbs', '.js', '.jar', '.app', '.dmg', '.sh', '.deb', 
  '.rpm', '.apk', '.ipa', '.html', '.svg'
];

const upload = multer({
  storage,
  limits: { fileSize: MAX_UPLOAD_SIZE },
  fileFilter: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    
    // Block dangerous file types
    if (BLOCKED_EXTENSIONS.includes(ext)) {
      return cb(new Error(`File type not allowed for security reasons: ${ext}`));
    }
    
    cb(null, true);
  }
});

// Convert audio to MP3 using ffmpeg
function toMp3(inputPath, outPath) {
  return new Promise((resolve, reject) => {
    execFile('ffmpeg', [
      '-y',                    // Overwrite output
      '-i', inputPath,         // Input file
      '-vn',                   // No video
      '-acodec', 'libmp3lame', // MP3 codec
      '-b:a', '128k',          // Bitrate
      outPath
    ], (err, stdout, stderr) => {
      if (err) {
        console.error('[FFMPEG] Error:', err.message);
        console.error('[FFMPEG] stderr:', stderr);
        return reject(err);
      }
      console.log('[FFMPEG] Converted to MP3:', outPath);
      resolve();
    });
  });
}

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
  
  upload.single('file')(req, res, async (err) => {
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
      
      // Check if it's video FIRST (before audio check, since .webm can be both)
      const videoExts = ['.mp4', '.webm', '.ogg', '.mov', '.avi', '.mkv'];
      const isVideo = videoExts.includes(ext) && mime.startsWith('video/');
      
      // Check if it's audio that needs conversion (exclude videos)
      const audioExts = ['.webm', '.ogg', '.wav', '.mp3', '.m4a', '.aac'];
      const isAudio = !isVideo && (audioExts.includes(ext) || mime.startsWith('audio/'));
      
      let finalFilename = req.file.filename;
      let finalPath = req.file.path;
      let finalMime = req.file.mimetype;
      
      // Convert audio to MP3 if needed
      if (isAudio && !ext.endsWith('.mp3')) {
        const mp3Filename = path.basename(req.file.filename, ext) + '.mp3';
        const mp3Path = path.join(UPLOAD_DIR, mp3Filename);
        
        console.log(`[UPLOAD] Converting audio to MP3: ${req.file.filename} -> ${mp3Filename}`);
        
        try {
          await toMp3(req.file.path, mp3Path);
          
          // Delete original file after successful conversion
          fs.unlinkSync(req.file.path);
          
          finalFilename = mp3Filename;
          finalPath = mp3Path;
          finalMime = 'audio/mpeg';
          
          console.log(`[UPLOAD] Audio conversion successful: ${mp3Filename}`);
        } catch (conversionError) {
          console.error('[UPLOAD] Audio conversion failed:', conversionError.message);
          // If conversion fails, keep the original file
          console.log('[UPLOAD] Keeping original audio file');
        }
      }
      
      // Return URL that points to this upload service
      const uploadUrl = `${UPLOAD_BASE_URL}/uploads/${finalFilename}`;
      
      console.log(`[UPLOAD] Success: ${req.file.originalname} (${req.file.size} bytes)`);
      console.log(`[UPLOAD] URL: ${uploadUrl}`);
      
      res.status(200).json({
        success: true,
        ok: true,
        url: uploadUrl,
        name: req.file.originalname,
        filename: req.file.originalname,
        mime: finalMime,
        size: fs.statSync(finalPath).size,
        isImage,
        isVideo,
        isAudio
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
app.use('/uploads', express.static(UPLOAD_DIR, {
  setHeaders: (res, filePath) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    
    const ext = path.extname(filePath).toLowerCase();
    const imageExts = ['.jpg', '.jpeg', '.png', '.webp', '.gif'];
    const videoExts = ['.mp4', '.webm', '.ogg', '.mov'];
    
    // Don't force download for images and videos (allow inline viewing)
    if (!imageExts.includes(ext) && !videoExts.includes(ext)) {
      res.setHeader('Content-Disposition', 'attachment');
    }
    
    // Set proper MIME type for videos
    if (videoExts.includes(ext)) {
      if (ext === '.webm') res.setHeader('Content-Type', 'video/webm');
      else if (ext === '.mp4') res.setHeader('Content-Type', 'video/mp4');
      else if (ext === '.ogg') res.setHeader('Content-Type', 'video/ogg');
      else if (ext === '.mov') res.setHeader('Content-Type', 'video/quicktime');
    }
  }
}));

// Cleanup old uploads (older than 7 days) - files managed by messages in DB
// This is a safety cleanup for orphaned files
setInterval(() => {
  const now = Date.now();
  const MAX_AGE = 7 * 24 * 60 * 60 * 1000; // 7 days
  
  fs.readdir(UPLOAD_DIR, (err, files) => {
    if (err) return;
    
    files.forEach(file => {
      const filePath = path.join(UPLOAD_DIR, file);
      fs.stat(filePath, (err, stats) => {
        if (err) return;
        
        if (now - stats.mtimeMs > MAX_AGE) {
          fs.unlink(filePath, (err) => {
            if (!err) {
              console.log(`[CLEANUP] Removed old orphaned file: ${file}`);
            }
          });
        }
      });
    });
  });
}, 24 * 60 * 60 * 1000); // Run once per day

app.listen(PORT, () => {
  console.log('========================================');
  console.log('Kennedy Chat Upload Service');
  console.log('========================================');
  console.log(`Port: ${PORT}`);
  console.log(`Upload dir: ${UPLOAD_DIR}`);
  console.log(`Base URL: ${UPLOAD_BASE_URL}`);
  console.log(`Max file size: ${MAX_UPLOAD_SIZE / 1024 / 1024}MB`);
  console.log('========================================');
  console.log('[CONFIG] Environment variables:');
  console.log(`  UPLOAD_DIR=${process.env.UPLOAD_DIR || '(default)'}`);
  console.log(`  UPLOAD_BASE_URL=${process.env.UPLOAD_BASE_URL || '(default)'}`);
  console.log(`  UPLOAD_PORT=${process.env.UPLOAD_PORT || '(default)'}`);
  console.log('========================================');
});
