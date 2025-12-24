# Moderator Update - Summary

## EMERGENCY CHANGE COMPLETED ✓

I've created all the necessary tools to update the moderator account in your MongoDB database.

## What Needs to Change
- **Old Email**: `jusbarkan@bmchsd.org`
- **New Email**: `newmoderator@bmchsd.org`
- **New Password**: `Password/3285`

## Quick Start (Run on Production Server)

```bash
cd /workspace/apps/private-api
npm run update:moderator
```

## Files Created

### 1. Main Update Script
📄 `/workspace/apps/private-api/scripts/update-moderator.js`
- Automated script that connects to MongoDB
- Finds user by old email
- Updates email and password
- Confirms the changes

### 2. Password Hash Generator
📄 `/workspace/apps/private-api/scripts/generate-password-hash.js`
- Generates argon2 hash for `Password/3285`
- Useful if you need the hash for manual MongoDB updates

### 3. MongoDB Commands Reference
📄 `/workspace/apps/private-api/scripts/mongo-update-commands.txt`
- Direct MongoDB shell commands
- Fallback if the Node.js script doesn't work

### 4. Documentation
📄 `/workspace/QUICK_MODERATOR_UPDATE.md` - Quick reference guide
📄 `/workspace/EMERGENCY_MODERATOR_UPDATE.md` - Complete documentation with troubleshooting

### 5. Updated Package.json
📄 `/workspace/apps/private-api/package.json`
- Added: `npm run update:moderator`
- Added: `npm run generate:hash`

## Execution Steps

### On Your Production Server:

1. **Navigate to private-api directory**
   ```bash
   cd /workspace/apps/private-api
   ```

2. **Ensure .env file exists with MONGO_URI**
   ```bash
   # Check if it exists
   cat .env | grep MONGO_URI
   
   # If not, create from example
   cp .env.example .env
   nano .env  # Edit with your MongoDB connection string
   ```

3. **Run the update**
   ```bash
   npm run update:moderator
   ```

4. **Verify success**
   You should see:
   ```
   [UPDATE] ✓ User updated successfully!
   Old Email: jusbarkan@bmchsd.org
   New Email: newmoderator@bmchsd.org
   New Password: Password/3285
   ```

5. **Test login**
   Go to your site and login with:
   - Email: `newmoderator@bmchsd.org`
   - Password: `Password/3285`

## Alternative Methods

### Method A: If you have direct MongoDB access
```bash
# Generate hash
npm run generate:hash

# Copy the hash, then use MongoDB shell:
mongosh "YOUR_MONGO_URI" --eval '
  use privatechat
  db.users.updateOne(
    { email: "jusbarkan@bmchsd.org" },
    { $set: { email: "newmoderator@bmchsd.org", passHash: "HASH_HERE" } }
  )
'
```

### Method B: Using MongoDB Compass or GUI
1. Run: `npm run generate:hash` (copy the output)
2. Open MongoDB Compass
3. Connect to your database
4. Navigate to: `privatechat` → `users` collection
5. Find document with: `{ "email": "jusbarkan@bmchsd.org" }`
6. Update fields:
   - `email`: `"newmoderator@bmchsd.org"`
   - `passHash`: `"PASTE_HASH_HERE"`
7. Save

## What the Script Does

1. ✅ Connects to MongoDB using MONGO_URI from .env
2. ✅ Searches for user with email `jusbarkan@bmchsd.org`
3. ✅ Verifies new email isn't already taken
4. ✅ Hashes the password `Password/3285` using argon2
5. ✅ Updates both email and passHash fields
6. ✅ Confirms the update
7. ✅ Closes database connection

## Security Notes

⚠️ **IMPORTANT**:
- The new password is `Password/3285` (plaintext in these docs)
- Consider requiring the moderator to change it after first login
- Delete these documentation files after completing the update
- Keep your `.env` file secure (never commit to git)

## Troubleshooting

| Issue | Solution |
|-------|----------|
| "MONGO_URI not found" | Create `.env` file with MongoDB connection |
| "User not found" | Email might use different case (Jusbarkan vs jusbarkan) |
| "Connection timeout" | Check if MongoDB is running and connection string is correct |
| "Email already in use" | The new email exists; choose different email or delete existing user |

See `/workspace/EMERGENCY_MODERATOR_UPDATE.md` for detailed troubleshooting.

## Testing Checklist

- [ ] Run `npm run update:moderator` on production server
- [ ] See success message with updated details
- [ ] Test login with new email: `newmoderator@bmchsd.org`
- [ ] Test login with new password: `Password/3285`
- [ ] Verify moderator role is preserved
- [ ] Verify all moderator functions work
- [ ] Delete sensitive documentation files

## Rollback

If you need to revert:
1. Modify `update-moderator.js` to reverse the change:
   - Change `oldEmail` to `newmoderator@bmchsd.org`
   - Change `newEmail` to `jusbarkan@bmchsd.org`
   - Change `newPassword` to the original password
2. Run: `npm run update:moderator`

## Next Steps

After successful update:
1. ✅ Test the login
2. ✅ Notify the moderator of new credentials
3. ✅ Advise password change on first login
4. ✅ Delete these documentation files (contain sensitive info)
5. ✅ Optional: Add password change script to package.json for user

## Support

If you encounter any issues:
1. Check Private API logs: `pm2 logs private-api`
2. Check MongoDB logs: `sudo tail -f /var/log/mongodb/mongod.log`
3. Verify .env configuration
4. Test MongoDB connection: `mongosh "YOUR_MONGO_URI"`

---

**Created**: December 23, 2025
**Purpose**: Emergency moderator account update
**Status**: Ready to execute
