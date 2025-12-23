const mongoose = require('mongoose');
const argon2 = require('argon2');
require('dotenv').config();

// Configuration
const MONGO_URI = process.env.MONGO_URI;

if (!MONGO_URI) {
  console.error('[UPDATE] ❌ FATAL: MONGO_URI environment variable is required');
  console.error('[UPDATE] Please set MONGO_URI in your .env file or environment');
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

async function updateModerator() {
  try {
    // Connect to MongoDB
    console.log('[UPDATE] Connecting to MongoDB...');
    await mongoose.connect(MONGO_URI, {
      serverSelectionTimeoutMS: 5000
    });
    console.log('[UPDATE] ✓ Connected to MongoDB');
    console.log('[UPDATE] Database:', mongoose.connection.name);

    // OLD EMAIL AND NEW EMAIL
    const oldEmail = 'jusbarkan@bmchsd.org';
    const newEmail = 'newmoderator@bmchsd.org';
    const newPassword = 'Password/3285';

    // Find user by old email (case-insensitive)
    console.log(`[UPDATE] Searching for user with email: ${oldEmail}`);
    const user = await User.findOne({ email: oldEmail.toLowerCase() });

    if (!user) {
      console.error(`[UPDATE] ❌ User not found with email: ${oldEmail}`);
      console.log('[UPDATE] Listing all users in database:');
      const allUsers = await User.find({}).select('email username role');
      allUsers.forEach(u => {
        console.log(`  - ${u.email} (${u.username}, ${u.role})`);
      });
      await mongoose.connection.close();
      process.exit(1);
    }

    console.log(`[UPDATE] ✓ Found user: ${user.email} (${user.username}, ${user.role})`);

    // Check if new email already exists
    const existingNewEmail = await User.findOne({ email: newEmail.toLowerCase() });
    if (existingNewEmail && existingNewEmail._id.toString() !== user._id.toString()) {
      console.error(`[UPDATE] ❌ Error: Email ${newEmail} is already in use by another user`);
      await mongoose.connection.close();
      process.exit(1);
    }

    // Hash the new password
    console.log(`[UPDATE] Hashing new password...`);
    const hashedPassword = await argon2.hash(newPassword);

    // Update user
    console.log(`[UPDATE] Updating user...`);
    user.email = newEmail.toLowerCase();
    user.passHash = hashedPassword;
    await user.save();

    console.log('[UPDATE] ✓ User updated successfully!');
    console.log('');
    console.log('='.repeat(60));
    console.log('MODERATOR UPDATED:');
    console.log('='.repeat(60));
    console.log(`Old Email: ${oldEmail}`);
    console.log(`New Email: ${newEmail}`);
    console.log(`Username: ${user.username}`);
    console.log(`Role: ${user.role}`);
    console.log(`New Password: ${newPassword}`);
    console.log('='.repeat(60));

    // Close connection
    await mongoose.connection.close();
    console.log('[UPDATE] Database connection closed');
    process.exit(0);
  } catch (error) {
    console.error('[UPDATE] ❌ Fatal error:', error);
    await mongoose.connection.close();
    process.exit(1);
  }
}

// Run update
updateModerator();
