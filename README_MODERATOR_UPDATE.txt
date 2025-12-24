================================================================================
                    EMERGENCY MODERATOR UPDATE - READY
================================================================================

TASK: Update moderator email and password in MongoDB database

CHANGE DETAILS:
  Old Email: jusbarkan@bmchsd.org
  New Email: newmoderator@bmchsd.org
  New Password: Password/3285

================================================================================
                         HOW TO EXECUTE (FASTEST)
================================================================================

1. SSH into your production server where MongoDB is running

2. Run these commands:
   
   cd /workspace/apps/private-api
   npm run update:moderator

3. You should see:
   
   [UPDATE] ✓ User updated successfully!
   
4. Test login at your website with:
   - Email: newmoderator@bmchsd.org
   - Password: Password/3285

================================================================================
                         FILES CREATED FOR YOU
================================================================================

SCRIPTS:
  ✓ /workspace/apps/private-api/scripts/update-moderator.js
  ✓ /workspace/apps/private-api/scripts/generate-password-hash.js
  ✓ /workspace/apps/private-api/scripts/mongo-update-commands.txt

NPM COMMANDS ADDED:
  ✓ npm run update:moderator (main update script)
  ✓ npm run generate:hash (password hash generator)

DOCUMENTATION:
  ✓ /workspace/MODERATOR_UPDATE_SUMMARY.md (complete overview)
  ✓ /workspace/QUICK_MODERATOR_UPDATE.md (quick reference)
  ✓ /workspace/EMERGENCY_MODERATOR_UPDATE.md (detailed guide)

================================================================================
                         REQUIREMENTS
================================================================================

✓ MongoDB must be running
✓ File .env must exist in /workspace/apps/private-api/
✓ MONGO_URI must be configured in .env

Check .env:
  cat /workspace/apps/private-api/.env | grep MONGO_URI

If missing, create it:
  cd /workspace/apps/private-api
  cp .env.example .env
  nano .env  # Add your MONGO_URI

================================================================================
                         TROUBLESHOOTING
================================================================================

Problem: "MONGO_URI not found"
Solution: Create .env file with MongoDB connection string

Problem: "User not found"  
Solution: Check that user exists with: npm run seed:users

Problem: "Connection failed"
Solution: Verify MongoDB is running: sudo systemctl status mongod

For detailed troubleshooting, see:
  /workspace/EMERGENCY_MODERATOR_UPDATE.md

================================================================================
                         SECURITY REMINDER
================================================================================

⚠️  After completing the update, DELETE these files (contain password):
  - /workspace/MODERATOR_UPDATE_SUMMARY.md
  - /workspace/QUICK_MODERATOR_UPDATE.md
  - /workspace/EMERGENCY_MODERATOR_UPDATE.md
  - /workspace/README_MODERATOR_UPDATE.txt (this file)

⚠️  Advise the moderator to change password after first login

================================================================================
                         READY TO EXECUTE
================================================================================

Run on production server:
  cd /workspace/apps/private-api && npm run update:moderator

================================================================================
