const mongoose = require('mongoose');
const argon2 = require('argon2');
require('dotenv').config();

// Configuration
const MONGO_URI = process.env.MONGO_URI;

if (!MONGO_URI) {
  console.error('[SEED] ❌ FATAL: MONGO_URI environment variable is required');
  process.exit(1);
}

// User Model (same as in server.js)
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

// Seed users data
const seedUsers = [
  {
    email: 'luccapo@bmchsd.org',
    username: 'Ldawg',
    password: 'Password123',
    fullName: 'Lucas',
    role: 'admin',
    referralCode: null
  },
  {
    email: 'Jusbarkan@bmchsd.org',
    username: 'GoonBoy',
    password: 'Password123',
    fullName: 'Justin',
    role: 'moderator',
    referralCode: null
  },
  {
    email: 'Ratuddin@bmchsd.org',
    username: 'RDAWG',
    password: 'Password123',
    fullName: 'Rateeb',
    role: 'moderator',
    referralCode: null
  }
];

async function seedDatabase() {
  try {
    // Connect to MongoDB
    console.log('[SEED] Connecting to MongoDB...');
    await mongoose.connect(MONGO_URI, {
      serverSelectionTimeoutMS: 5000
    });
    console.log('[SEED] ✓ Connected to MongoDB');
    console.log('[SEED] Database:', mongoose.connection.name);

    // Seed each user
    for (const userData of seedUsers) {
      try {
        // Check if user already exists
        const existingUser = await User.findOne({ email: userData.email.toLowerCase() });
        
        if (existingUser) {
          console.log(`[SEED] ⚠️  User already exists: ${userData.email} (${userData.username})`);
          
          // Update password in case it changed
          const hashedPassword = await argon2.hash(userData.password);
          existingUser.passHash = hashedPassword;
          existingUser.fullName = userData.fullName;
          existingUser.role = userData.role;
          existingUser.referralCode = userData.referralCode;
          await existingUser.save();
          console.log(`[SEED] ✓ Updated user: ${userData.email}`);
          continue;
        }

        // Hash password
        const hashedPassword = await argon2.hash(userData.password);

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
          console.error(`[SEED] ❌ Failed to generate unique fake number for ${userData.email}`);
          continue;
        }

        // Create user
        const user = new User({
          fullName: userData.fullName,
          email: userData.email.toLowerCase(),
          username: userData.username,
          passHash: hashedPassword,
          role: userData.role,
          referralCode: userData.referralCode,
          fakeNumber
        });

        await user.save();
        console.log(`[SEED] ✓ Created user: ${userData.email} (${userData.username}, role: ${userData.role})`);
      } catch (error) {
        console.error(`[SEED] ❌ Error seeding user ${userData.email}:`, error.message);
      }
    }

    console.log('[SEED] ✓ Seeding complete!');
    console.log('');
    console.log('='.repeat(60));
    console.log('Test Accounts Created/Updated:');
    console.log('='.repeat(60));
    for (const user of seedUsers) {
      console.log(`Email: ${user.email}`);
      console.log(`Username: ${user.username}`);
      console.log(`Password: ${user.password}`);
      console.log(`Role: ${user.role}`);
      console.log('-'.repeat(60));
    }

    // Close connection
    await mongoose.connection.close();
    console.log('[SEED] Database connection closed');
    process.exit(0);
  } catch (error) {
    console.error('[SEED] ❌ Fatal error:', error);
    process.exit(1);
  }
}

// Run seeding
seedDatabase();
