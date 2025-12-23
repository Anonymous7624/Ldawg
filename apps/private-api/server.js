const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const mongoose = require('mongoose');
const argon2 = require('argon2');
const jwt = require('jsonwebtoken');
require('dotenv').config();

const app = express();

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
  methods: ['GET', 'POST', 'OPTIONS'],
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
  .then(() => {
    console.log('[MONGODB] ✓ Connected to MongoDB');
    console.log('[MONGODB] Database:', mongoose.connection.name);
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
      me: 'GET /me'
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

    // Verify password with argon2
    const validPassword = await argon2.verify(user.passHash, password);
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

    // Validation
    if (!currentPassword || !newPassword) {
      return res.status(400).json({ error: 'Current password and new password are required' });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({ error: 'New password must be at least 6 characters' });
    }

    // Fetch user with passHash (since authenticateToken excludes it)
    const userWithHash = await User.findById(req.user._id);
    if (!userWithHash) {
      return res.status(401).json({ error: 'User not found' });
    }

    // Verify current password
    const validPassword = await argon2.verify(userWithHash.passHash, currentPassword);
    if (!validPassword) {
      return res.status(401).json({ error: 'Current password is incorrect' });
    }

    // Hash new password
    const hashedPassword = await argon2.hash(newPassword);
    userWithHash.passHash = hashedPassword;
    await userWithHash.save();

    console.log(`[ACCOUNT] Password changed for: ${req.user.email} (${req.user.username})`);

    res.json({
      ok: true,
      success: true,
      message: 'Password changed successfully'
    });
  } catch (error) {
    console.error('[ACCOUNT] Error changing password:', error);
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
  console.log('========================================');
});
