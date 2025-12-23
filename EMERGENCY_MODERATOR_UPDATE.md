# Emergency Moderator Email and Password Update

## Summary
This document provides instructions for updating the moderator account:
- **Old Email**: `jusbarkan@bmchsd.org`
- **New Email**: `newmoderator@bmchsd.org`
- **New Password**: `Password/3285`

## Method 1: Run Update Script (RECOMMENDED)

This is the easiest and safest method.

### Step 1: Navigate to Private API Directory
```bash
cd /workspace/apps/private-api
```

### Step 2: Ensure .env File Exists
Make sure you have a `.env` file with the MongoDB connection string:
```bash
cat .env
```

You should see a line like:
```
MONGO_URI=mongodb://appuser:PASSWORD@127.0.0.1:27017/privatechat?authSource=privatechat
```

If the `.env` file doesn't exist, create it using `.env.example` as a template.

### Step 3: Run the Update Script
```bash
npm run update:moderator
```

### Expected Output
```
[UPDATE] Connecting to MongoDB...
[UPDATE] ✓ Connected to MongoDB
[UPDATE] Database: privatechat
[UPDATE] Searching for user with email: jusbarkan@bmchsd.org
[UPDATE] ✓ Found user: jusbarkan@bmchsd.org (GoonBoy, moderator)
[UPDATE] Hashing new password...
[UPDATE] Updating user...
[UPDATE] ✓ User updated successfully!

============================================================
MODERATOR UPDATED:
============================================================
Old Email: jusbarkan@bmchsd.org
New Email: newmoderator@bmchsd.org
Username: GoonBoy
Role: moderator
New Password: Password/3285
============================================================

[UPDATE] Database connection closed
```

### Step 4: Verify the Update
Try logging in with the new credentials:
- Email: `newmoderator@bmchsd.org`
- Password: `Password/3285`

## Method 2: Direct MongoDB Commands

If you prefer to update directly via MongoDB shell:

### Step 1: Connect to MongoDB
```bash
mongo mongodb://appuser:PASSWORD@127.0.0.1:27017/privatechat?authSource=privatechat
```

Or if using mongosh:
```bash
mongosh "mongodb://appuser:PASSWORD@127.0.0.1:27017/privatechat?authSource=privatechat"
```

### Step 2: Find the User
```javascript
// Switch to the database
use privatechat

// Find the user by old email
db.users.findOne({ email: "jusbarkan@bmchsd.org" })
```

### Step 3: Generate Password Hash
You'll need to use Node.js to generate the argon2 hash:

```bash
# Create a temporary hash generator script
cd /workspace/apps/private-api/scripts
cat > generate-hash.js << 'EOF'
const argon2 = require('argon2');

async function generateHash() {
  const password = 'Password/3285';
  const hash = await argon2.hash(password);
  console.log('Hash for Password/3285:');
  console.log(hash);
}

generateHash();
EOF

# Run it
node generate-hash.js
```

Copy the generated hash, then update the user in MongoDB:

```javascript
// In MongoDB shell
db.users.updateOne(
  { email: "jusbarkan@bmchsd.org" },
  {
    $set: {
      email: "newmoderator@bmchsd.org",
      passHash: "PASTE_GENERATED_HASH_HERE"
    }
  }
)
```

### Step 4: Verify
```javascript
// Verify the update
db.users.findOne({ email: "newmoderator@bmchsd.org" })
```

## Method 3: Quick One-Liner with Script

If you're on the production server with the MongoDB connection:

```bash
cd /workspace/apps/private-api && npm run update:moderator
```

## Troubleshooting

### Error: "MONGO_URI environment variable is required"
**Solution**: Create or update the `.env` file:
```bash
cd /workspace/apps/private-api
cp .env.example .env
nano .env
```

Update the `MONGO_URI` line with your actual MongoDB connection details.

### Error: "User not found with email: jusbarkan@bmchsd.org"
**Solution**: The email might be stored differently. Run this to list all users:
```bash
cd /workspace/apps/private-api
node -e "
const mongoose = require('mongoose');
require('dotenv').config();
mongoose.connect(process.env.MONGO_URI).then(async () => {
  const User = mongoose.model('User', new mongoose.Schema({
    email: String,
    username: String,
    role: String
  }));
  const users = await User.find({}).select('email username role');
  console.log('All users in database:');
  users.forEach(u => console.log(\`  - \${u.email} (\${u.username}, \${u.role})\`));
  process.exit(0);
});
"
```

### Error: "Email newmoderator@bmchsd.org is already in use"
**Solution**: The new email already exists. You may need to delete that user first, or choose a different email.

### MongoDB Connection Timeout
**Solution**: 
1. Check if MongoDB is running: `sudo systemctl status mongod`
2. Verify connection string in `.env`
3. Check firewall rules if MongoDB is on a different server

## Post-Update Steps

1. **Test Login**: Try logging in with the new credentials at your frontend
2. **Notify User**: Inform the moderator of their new email and password
3. **Security**: Advise them to change their password after first login
4. **Backup**: Consider backing up the MongoDB database after this change

## Rollback Instructions

If you need to revert this change:

1. Update the email and password back to original values
2. Modify the update script to use:
   - Old Email: `newmoderator@bmchsd.org`
   - New Email: `jusbarkan@bmchsd.org`
   - New Password: `Password123` (or whatever it was originally)
3. Run: `npm run update:moderator`

## Security Notes

⚠️ **IMPORTANT**: 
- Store this document securely - it contains sensitive credentials
- Delete or secure this file after the update is complete
- Consider requiring the user to change their password on first login
- The password `Password/3285` is in plaintext here for emergency purposes only

## Files Modified

- `/workspace/apps/private-api/scripts/update-moderator.js` (new file)
- `/workspace/apps/private-api/package.json` (added update:moderator script)
- This documentation file

## Contact

If you encounter issues, check:
1. Private API logs: `pm2 logs private-api`
2. MongoDB logs: `sudo tail -f /var/log/mongodb/mongod.log`
3. Network connectivity to MongoDB server
