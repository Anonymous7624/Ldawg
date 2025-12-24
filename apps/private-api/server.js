const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const mongoose = require('mongoose');
const argon2 = require('argon2');
const jwt = require('jsonwebtoken');
require('dotenv').config();

const app = express();

// Trust proxy for Cloudflare
app.set('trust proxy', 1);

// Configuration
const PORT = parseInt(process.env.PORT || '3001', 10);
const MONGO_URI = process.env.MONGO_URI;
const JWT_SECRET = process.env.JWT_SECRET;
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '7d';

// Validate required environment variables
if (!MONGO_URI) {
  console.error('[STARTUP] ❌ FATAL: MONGO_URI environment variable is required');
  process.exit(1);
}

if (!JWT_SECRET) {
  console.error('[STARTUP] ❌ FATAL: JWT_SECRET environment variable is required');
  process.exit(1);
}

// Trust proxy for Cloudflare (required for rate limiting)
app.set('trust proxy', 1);

// Middleware
app.use(helmet()); // Security headers
app.use(express.json()); // Parse JSON bodies

// CORS configuration
const allowedOrigins = new Set([
  'https://simplechatroom.com',
  'https://www.simplechatroom.com',
  'https://ldawg7624.com',
  'https://www.ldawg7624.com'
]);

// Add any additional origins from environment variable
if (process.env.CORS_ORIGINS) {
  process.env.CORS_ORIGINS.split(',').forEach(origin => allowedOrigins.add(origin.trim()));
}

const corsOptions = {
  origin: (origin, callback) => {
    // Allow requests with no origin (mobile apps, Postman, etc.)
    if (!origin) return callback(null, true);
    
    if (allowedOrigins.has(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  methods: ['GET', 'POST', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true
};

app.use(cors(corsOptions));

// Handle preflight requests for all routes
app.options('*', cors(corsOptions));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per windowMs
  message: { error: 'Too many requests, please try again later.' }
});

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // Limit each IP to 10 auth requests per windowMs
  message: { error: 'Too many authentication attempts, please try again later.' }
});

app.use('/api/', limiter);
app.use('/auth/', authLimiter);

// MongoDB Connection
mongoose.connect(MONGO_URI, {
  serverSelectionTimeoutMS: 5000
})
  .then(async () => {
    console.log('[MONGODB] ✓ Connected to MongoDB');
    console.log('[MONGODB] Database:', mongoose.connection.name);
    
    // Ensure indexes exist (safe to call even if already exist)
    try {
      await Report.collection.createIndex({ createdAt: 1 }, { expireAfterSeconds: 1200 });
      console.log('[MONGODB] ✓ TTL index on reports.createdAt created/verified');
    } catch (err) {
      console.log('[MONGODB] TTL index already exists or error:', err.message);
    }
    
    try {
      await Report.collection.createIndex({ reportTimestamp: -1 });
      await Report.collection.createIndex({ reporterClientId: 1, reportedMessageId: 1 });
      console.log('[MONGODB] ✓ Report indexes created/verified');
    } catch (err) {
      console.log('[MONGODB] Report indexes already exist or error:', err.message);
    }
  })
  .catch(err => {
    console.error('[MONGODB] ❌ Connection error:', err.message);
    process.exit(1);
  });

// User Model
const userSchema = new mongoose.Schema({
  fullName: {
    type: String,
    required: true,
    trim: true
  },
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true,
    match: /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  },
  username: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    minlength: 3,
    maxlength: 30,
    match: /^[a-zA-Z0-9_]+$/
  },
  passHash: {
    type: String,
    required: true
  },
  role: {
    type: String,
    enum: ['admin', 'moderator', 'client'],
    default: 'client',
    required: true
  },
  referralCode: {
    type: String,
    default: null
  },
  fakeNumber: {
    type: String,
    required: true,
    unique: true
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

const User = mongoose.model('User', userSchema);

// Report Model
const reportSchema = new mongoose.Schema({
  reportedMessageId: {
    type: String,
    required: true,
    index: true
  },
  reportedSenderClientId: {
    type: String,
    required: true,
    index: true
  },
  reporterClientId: {
    type: String,
    required: true,
    index: true
  },
  messageText: {
    type: String,
    required: true
  },
  messageTimestamp: {
    type: Number,
    required: true
  },
  reportTimestamp: {
    type: Date,
    default: Date.now,
    index: true
  },
  createdAt: {
    type: Date,
    default: Date.now,
    index: true
  },
  room: {
    type: String,
    default: 'global'
  }
});

// TTL index to auto-delete reports after 20 minutes
reportSchema.index({ createdAt: 1 }, { expireAfterSeconds: 1200 });

const Report = mongoose.model('Report', reportSchema);

// Utility: Generate fake phone number
function generateFakeNumber() {
  const areaCode = Math.floor(Math.random() * 900) + 100;
  const prefix = Math.floor(Math.random() * 900) + 100;
  const suffix = Math.floor(Math.random() * 9000) + 1000;
  return `+1${areaCode}${prefix}${suffix}`;
}

// Utility: Generate JWT token
function generateToken(userId) {
  return jwt.sign({ userId }, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
}

// Middleware: Verify JWT token
async function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

  if (!token) {
    return res.status(401).json({ error: 'Access token required' });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    const user = await User.findById(decoded.userId).select('-passHash');
    
    if (!user) {
      return res.status(401).json({ error: 'User not found' });
    }
    
    req.user = user;
    next();
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ error: 'Token expired' });
    }
    return res.status(403).json({ error: 'Invalid token' });
  }
}

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ ok: true });
});

// Root endpoint
app.get('/', (req, res) => {
  res.json({
    service: 'Private API',
    version: '1.0.0',
    status: 'ok',
    endpoints: {
      health: 'GET /health',
      signup: 'POST /auth/signup',
      login: 'POST /auth/login',
      me: 'GET /me',
      reports: {
        create: 'POST /reports/create',
        list: 'GET /reports/list',
        delete: 'DELETE /reports/:id'
      }
    }
  });
});

// POST /auth/signup - Create new user
// Future requirements: fullName, @bmchsd.org email, username check, password confirmation, optional referral code
app.post('/auth/signup', async (req, res) => {
  try {
    const { fullName, email, username, password, referralCode } = req.body;

    // Validation
    if (!fullName || !email || !username || !password) {
      return res.status(400).json({ error: 'Full name, email, username, and password are required' });
    }

    // Email must end with @bmchsd.org
    if (!email.toLowerCase().endsWith('@bmchsd.org')) {
      return res.status(400).json({ error: 'Email must be a @bmchsd.org address' });
    }

    if (username.length < 3 || username.length > 30) {
      return res.status(400).json({ error: 'Username must be between 3 and 30 characters' });
    }

    if (!/^[a-zA-Z0-9_]+$/.test(username)) {
      return res.status(400).json({ error: 'Username can only contain letters, numbers, and underscores' });
    }

    if (password.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters' });
    }

    // Check if email or username already exists
    const existingEmail = await User.findOne({ email: email.toLowerCase() });
    if (existingEmail) {
      return res.status(409).json({ error: 'Email already registered' });
    }

    const existingUsername = await User.findOne({ username });
    if (existingUsername) {
      return res.status(409).json({ error: 'Username already taken' });
    }

    // Hash password with argon2
    const hashedPassword = await argon2.hash(password);

    // Generate unique fake number
    let fakeNumber;
    let attempts = 0;
    do {
      fakeNumber = generateFakeNumber();
      const existing = await User.findOne({ fakeNumber });
      if (!existing) break;
      attempts++;
    } while (attempts < 10);

    if (attempts >= 10) {
      return res.status(500).json({ error: 'Failed to generate unique fake number' });
    }

    // Create user (default role: client)
    const user = new User({
      fullName,
      email: email.toLowerCase(),
      username,
      passHash: hashedPassword,
      role: 'client',
      referralCode: referralCode || null,
      fakeNumber
    });

    await user.save();

    // Generate JWT token
    const token = generateToken(user._id);

    console.log(`[SIGNUP] New user created: ${email} (${username}, ${fakeNumber})`);

    res.status(201).json({
      token,
      user: {
        id: user._id,
        username: user.username,
        email: user.email,
        fullName: user.fullName,
        role: user.role,
        fakeNumber: user.fakeNumber
      }
    });
  } catch (error) {
    console.error('[SIGNUP] Error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /auth/login - Authenticate user (email-based)
app.post('/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    // Validation
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    // Find user by email
    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    // Get stored hash with backward-compatible fallback
    const storedHash = user.passHash || user.passwordHash || user.password_hash || user.hash;
    
    // Validate hash exists and is a non-empty string
    if (!storedHash || typeof storedHash !== 'string' || storedHash.trim() === '') {
      console.error(`[LOGIN] Invalid password hash for user: ${user.email}`);
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    // Verify password with argon2
    const validPassword = await argon2.verify(storedHash, password);
    if (!validPassword) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    // Generate JWT token
    const token = generateToken(user._id);

    console.log(`[LOGIN] User logged in: ${user.email} (${user.username})`);

    res.json({
      token,
      user: {
        id: user._id,
        username: user.username,
        email: user.email,
        fullName: user.fullName,
        role: user.role,
        fakeNumber: user.fakeNumber
      }
    });
  } catch (error) {
    console.error('[LOGIN] Error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /me - Get current user info (requires authentication)
app.get('/me', authenticateToken, async (req, res) => {
  try {
    res.json({
      user: {
        id: req.user._id,
        username: req.user.username,
        email: req.user.email,
        fullName: req.user.fullName,
        role: req.user.role,
        fakeNumber: req.user.fakeNumber,
        createdAt: req.user.createdAt
      }
    });
  } catch (error) {
    console.error('[ME] Error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /verify-token - Verify JWT token and return user info (for Pi server)
app.post('/verify-token', async (req, res) => {
  try {
    const { token } = req.body;

    if (!token) {
      return res.status(400).json({ error: 'Token required' });
    }

    const decoded = jwt.verify(token, JWT_SECRET);
    const user = await User.findById(decoded.userId).select('-passHash');
    
    if (!user) {
      return res.status(401).json({ error: 'User not found' });
    }

    res.json({
      valid: true,
      user: {
        id: user._id,
        username: user.username,
        email: user.email,
        fullName: user.fullName,
        role: user.role
      }
    });
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ valid: false, error: 'Token expired' });
    }
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({ valid: false, error: 'Invalid token' });
    }
    console.error('[VERIFY-TOKEN] Error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /account/change-username - Change username (requires authentication)
app.post('/account/change-username', authenticateToken, async (req, res) => {
  try {
    const { newUsername } = req.body;

    // Validation
    if (!newUsername) {
      return res.status(400).json({ error: 'New username is required' });
    }

    if (newUsername.length < 3 || newUsername.length > 30) {
      return res.status(400).json({ error: 'Username must be between 3 and 30 characters' });
    }

    if (!/^[a-zA-Z0-9_]+$/.test(newUsername)) {
      return res.status(400).json({ error: 'Username can only contain letters, numbers, and underscores' });
    }

    // Check if username is already taken
    const existingUsername = await User.findOne({ username: newUsername });
    if (existingUsername && existingUsername._id.toString() !== req.user._id.toString()) {
      return res.status(409).json({ error: 'Username already taken' });
    }

    // Update username
    const oldUsername = req.user.username;
    req.user.username = newUsername;
    await req.user.save();

    console.log(`[ACCOUNT] Username changed: ${oldUsername} -> ${newUsername} (${req.user.email})`);

    res.json({
      success: true,
      user: {
        id: req.user._id,
        username: req.user.username,
        email: req.user.email,
        fullName: req.user.fullName,
        role: req.user.role,
        fakeNumber: req.user.fakeNumber
      }
    });
  } catch (error) {
    console.error('[ACCOUNT] Error changing username:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /account/change-password - Change password (requires authentication)
app.post('/account/change-password', authenticateToken, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;

    // Strict validation: require currentPassword and newPassword as non-empty strings
    if (!currentPassword || typeof currentPassword !== 'string' || currentPassword.trim() === '') {
      return res.status(400).json({ error: 'Current password is required and must be a non-empty string' });
    }

    if (!newPassword || typeof newPassword !== 'string' || newPassword.trim() === '') {
      return res.status(400).json({ error: 'New password is required and must be a non-empty string' });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({ error: 'New password must be at least 6 characters' });
    }

    // Fetch user with passHash (since authenticateToken excludes it)
    const userWithHash = await User.findById(req.user._id);
    if (!userWithHash) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Get stored hash with backward-compatible fallback
    const storedHash = userWithHash.passHash || userWithHash.passwordHash || userWithHash.password_hash || userWithHash.hash;
    
    // Validate hash exists and is a non-empty string before calling argon2.verify()
    if (!storedHash || typeof storedHash !== 'string' || storedHash.trim() === '') {
      console.error(`[ACCOUNT] Password hash not set for user: ${req.user.email} (${req.user.username})`);
      return res.status(400).json({ error: 'ACCOUNT_PASSWORD_NOT_SET' });
    }

    // Verify current password
    const validPassword = await argon2.verify(storedHash, currentPassword);
    if (!validPassword) {
      return res.status(401).json({ error: 'Current password is incorrect' });
    }

    // Hash new password with argon2
    const hashedPassword = await argon2.hash(newPassword);
    
    // Always write to the canonical field (passHash)
    userWithHash.passHash = hashedPassword;
    await userWithHash.save();

    console.log(`[ACCOUNT] Password changed for: ${req.user.email} (${req.user.username})`);

    res.json({ ok: true });
  } catch (error) {
    console.error('[ACCOUNT] Error changing password:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /reports/create - Create a message report
app.post('/reports/create', async (req, res) => {
  try {
    const { reportedMessageId, reportedSenderClientId, reporterClientId, messageText, messageTimestamp } = req.body;

    // Validation
    if (!reportedMessageId || !reportedSenderClientId || !reporterClientId || !messageText || !messageTimestamp) {
      return res.status(400).json({ error: 'All fields are required: reportedMessageId, reportedSenderClientId, reporterClientId, messageText, messageTimestamp' });
    }

    const now = Date.now();

    // Rate limiting: 1 report per 60 seconds per reporterClientId (DB-based)
    const lastReport = await Report.findOne({ 
      reporterClientId: reporterClientId 
    }).sort({ reportTimestamp: -1 }).limit(1);

    if (lastReport) {
      const timeSinceLastReport = now - lastReport.reportTimestamp.getTime();
      if (timeSinceLastReport < 60000) {
        const retryAfterSec = Math.ceil((60000 - timeSinceLastReport) / 1000);
        console.log(`[REPORTS] Rate limit hit for ${reporterClientId}, retry in ${retryAfterSec}s`);
        return res.status(429).json({ 
          error: 'RATE_LIMIT', 
          retryAfterSec: retryAfterSec 
        });
      }
    }

    // Deduplication: check if same reporter reported same message in last 20 minutes
    const existingReport = await Report.findOne({
      reporterClientId: reporterClientId,
      reportedMessageId: reportedMessageId,
      createdAt: { $gte: new Date(now - 20 * 60 * 1000) }
    });

    if (existingReport) {
      console.log(`[REPORTS] Duplicate report rejected for message ${reportedMessageId} by ${reporterClientId}`);
      return res.status(409).json({ error: 'DUPLICATE_REPORT' });
    }

    // Convert messageTimestamp to Date if needed
    const msgTimestamp = typeof messageTimestamp === 'number' ? messageTimestamp : new Date(messageTimestamp).getTime();

    // Create report
    const report = new Report({
      reportedMessageId,
      reportedSenderClientId,
      reporterClientId,
      messageText: messageText.substring(0, 1000),
      messageTimestamp: msgTimestamp,
      reportTimestamp: new Date(),
      createdAt: new Date(),
      room: 'global'
    });

    await report.save();

    console.log(`[REPORTS] Report created: ${report._id} for message ${reportedMessageId}`);

    res.status(201).json({ 
      ok: true,
      reportId: report._id 
    });
  } catch (error) {
    console.error('[REPORTS] Error creating report:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /reports/list - Get recent reports (admin-only)
app.get('/reports/list', authenticateToken, async (req, res) => {
  try {
    // Verify admin role
    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Admin access required' });
    }

    // Get the 10 most recent reports that haven't expired
    const reports = await Report.find()
      .sort({ reportTimestamp: -1 })
      .limit(10)
      .lean();

    console.log(`[REPORTS] Admin ${req.user.username} fetched ${reports.length} reports`);

    res.json({ 
      reports: reports.map(r => ({
        id: r._id,
        reportedMessageId: r.reportedMessageId,
        reportedSenderClientId: r.reportedSenderClientId,
        reporterClientId: r.reporterClientId,
        messageText: r.messageText,
        messageTimestamp: r.messageTimestamp,
        reportTimestamp: r.reportTimestamp,
        room: r.room
      }))
    });
  } catch (error) {
    console.error('[REPORTS] Error listing reports:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// DELETE /reports/:id - Delete a report (admin-only)
app.delete('/reports/:id', authenticateToken, async (req, res) => {
  try {
    // Verify admin role
    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Admin access required' });
    }

    const reportId = req.params.id;

    const result = await Report.deleteOne({ _id: reportId });

    if (result.deletedCount === 0) {
      console.log(`[REPORTS] Report ${reportId} not found`);
      return res.status(404).json({ error: 'Report not found' });
    }

    console.log(`[REPORTS] Admin ${req.user.username} deleted report ${reportId}`);

    res.json({ ok: true });
  } catch (error) {
    console.error('[REPORTS] Error deleting report:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /admin/emergency-user-action - Emergency user deletion/update (admin-only)
app.post('/admin/emergency-user-action', authenticateToken, async (req, res) => {
  try {
    // Verify admin role
    if (req.user.role !== 'admin' && req.user.role !== 'moderator') {
      return res.status(403).json({ error: 'Admin or moderator access required' });
    }

    const { action, email, newEmail, newPassword } = req.body;

    if (!action || !email) {
      return res.status(400).json({ error: 'Action and email are required' });
    }

    // Find the user
    const user = await User.findOne({ email: email.toLowerCase() });
    
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    let result = {};

    switch (action) {
      case 'delete':
        // Delete the user
        await User.deleteOne({ _id: user._id });
        console.log(`[ADMIN-EMERGENCY] User deleted: ${email} by ${req.user.username}`);
        result = { ok: true, action: 'deleted', email: email };
        break;

      case 'update':
        // Update email and/or password
        if (newEmail) {
          // Check if new email already exists
          const existingEmail = await User.findOne({ email: newEmail.toLowerCase() });
          if (existingEmail && existingEmail._id.toString() !== user._id.toString()) {
            return res.status(409).json({ error: 'New email already in use' });
          }
          user.email = newEmail.toLowerCase();
        }
        
        if (newPassword) {
          const hashedPassword = await argon2.hash(newPassword);
          user.passHash = hashedPassword;
        }
        
        await user.save();
        console.log(`[ADMIN-EMERGENCY] User updated: ${email} -> ${user.email} by ${req.user.username}`);
        result = { 
          ok: true, 
          action: 'updated', 
          oldEmail: email,
          newEmail: user.email,
          passwordChanged: !!newPassword
        };
        break;

      case 'disable':
        // Change password to random unguessable string to effectively disable login
        const randomPassword = require('crypto').randomBytes(32).toString('hex');
        const hashedRandom = await argon2.hash(randomPassword);
        user.passHash = hashedRandom;
        await user.save();
        console.log(`[ADMIN-EMERGENCY] User login disabled: ${email} by ${req.user.username}`);
        result = { ok: true, action: 'disabled', email: email };
        break;

      default:
        return res.status(400).json({ error: 'Invalid action. Use: delete, update, or disable' });
    }

    res.json(result);
  } catch (error) {
    console.error('[ADMIN-EMERGENCY] Error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Endpoint not found' });
});

// Error handler
app.use((err, req, res, next) => {
  console.error('[ERROR]', err);
  res.status(500).json({ error: 'Internal server error' });
});

// Start server
app.listen(PORT, () => {
  console.log('========================================');
  console.log('Private API Server');
  console.log('========================================');
  console.log(`Port: ${PORT}`);
  console.log(`MongoDB: ${MONGO_URI.replace(/:[^:]*@/, ':***@')}`);
  console.log(`JWT Expiration: ${JWT_EXPIRES_IN}`);
  console.log(`CORS Origins: ${Array.from(allowedOrigins).join(', ')}`);
  console.log('========================================');
  console.log('Available endpoints:');
  console.log('  GET  /health');
  console.log('  POST /auth/signup');
  console.log('  POST /auth/login');
  console.log('  GET  /me');
  console.log('  POST /verify-token');
  console.log('  POST /account/change-username');
  console.log('  POST /account/change-password');
  console.log('  POST /reports/create');
  console.log('  GET  /reports/list');
  console.log('  DELETE /reports/:id');
  console.log('  POST /admin/emergency-user-action');
  console.log('========================================');
});
