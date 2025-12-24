# EMERGENCY: Quick Moderator Update Guide

## What Needs to Be Done
- Change moderator email from `jusbarkan@bmchsd.org` to `newmoderator@bmchsd.org`
- Change password to `Password/3285`

## Fastest Method (2 Steps)

### Step 1: SSH into your production server
```bash
ssh your-server
```

### Step 2: Run the update script
```bash
cd /workspace/apps/private-api
npm run update:moderator
```

That's it! The script will:
- Connect to MongoDB
- Find the user with email `jusbarkan@bmchsd.org`
- Update the email to `newmoderator@bmchsd.org`
- Hash and update the password to `Password/3285`
- Display confirmation

## Test the Change

Try logging in at your frontend with:
- **Email**: `newmoderator@bmchsd.org`
- **Password**: `Password/3285`

## Alternative: If Script Fails

If the update script doesn't work (e.g., .env not configured):

### Quick Manual Update:
```bash
# 1. Generate password hash
cd /workspace/apps/private-api
npm run generate:hash

# 2. Copy the hash output, then run:
mongosh "YOUR_MONGO_URI_HERE" --eval '
use privatechat
db.users.updateOne(
  { email: "jusbarkan@bmchsd.org" },
  { $set: { email: "newmoderator@bmchsd.org", passHash: "PASTE_HASH_HERE" } }
)
'
```

## Files Created

1. **Update Script**: `/workspace/apps/private-api/scripts/update-moderator.js`
   - Automated script to update email and password

2. **Hash Generator**: `/workspace/apps/private-api/scripts/generate-password-hash.js`
   - Generates argon2 hash for the new password

3. **MongoDB Commands**: `/workspace/apps/private-api/scripts/mongo-update-commands.txt`
   - Manual MongoDB commands if needed

4. **Full Documentation**: `/workspace/EMERGENCY_MODERATOR_UPDATE.md`
   - Complete guide with troubleshooting

## NPM Scripts Added

- `npm run update:moderator` - Run the automated update
- `npm run generate:hash` - Generate password hash only

## Troubleshooting

**"MONGO_URI not found"**
- Create `.env` file: `cp .env.example .env`
- Edit with your MongoDB connection: `nano .env`

**"User not found"**
- Check email case sensitivity
- List all users to verify: See full documentation

**"Connection timeout"**
- Verify MongoDB is running: `sudo systemctl status mongod`
- Check connection string in `.env`

## Security Warning

⚠️ Delete or secure these files after update:
- `/workspace/EMERGENCY_MODERATOR_UPDATE.md`
- `/workspace/QUICK_MODERATOR_UPDATE.md`

They contain sensitive credentials!

## Need Help?

See `/workspace/EMERGENCY_MODERATOR_UPDATE.md` for detailed troubleshooting.
