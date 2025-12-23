# Quick Deployment Guide - Admin Features

## Step-by-Step Deployment

### 1. Backup Current State ✅
```bash
# Backup database
cp apps/pi-global/chat.db apps/pi-global/chat.db.backup

# Backup uploads (optional)
tar -czf uploads-backup.tar.gz apps/pi-global/uploads/
```

### 2. Update Private API ✅
```bash
cd apps/private-api

# Stop current server
pm2 stop private-api

# Pull latest changes (if using git)
git pull origin main

# Install dependencies (if needed)
npm install

# Run seed script to create admin accounts
npm run seed:users

# Start server
pm2 start server.js --name private-api

# Check logs
pm2 logs private-api
```

Expected output from seed:
```
[SEED] ✓ Created user: luccapo@bmchsd.org (Ldawg, role: admin)
[SEED] ✓ Created user: Jusbarkan@bmchsd.org (GoonBoy, role: moderator)
[SEED] ✓ Created user: Ratuddin@bmchsd.org (RDAWG, role: moderator)
```

### 3. Update Pi Global Chat Server ✅
```bash
cd apps/pi-global

# Stop current servers
pm2 stop global-chat global-upload

# Pull latest changes (if using git)
git pull origin main

# Install dependencies (if needed)
npm install

# Note: node-fetch may be needed for Node < 18
# npm install node-fetch

# Start servers
pm2 start server.js --name global-chat
pm2 start upload-server.js --name global-upload

# Check logs
pm2 logs global-chat
```

Expected output:
```
[STATE] Loaded state from file: chatLocked=false, reports=0
[PROFANITY] Loaded 123 banned words from banned-words.txt
[STARTUP] ✓ Database ready with 456 messages in memory
```

### 4. Update Frontend ✅
```bash
# If using GitHub Pages, commit and push
git add index.html ADMIN_FEATURES_IMPLEMENTATION.md
git commit -m "Add admin features: panel, ban system, chat lock, reports, settings"
git push origin main

# GitHub Pages will auto-deploy
# Wait 1-2 minutes for deployment
```

### 5. Verify Deployment ✅

#### Test Private API
```bash
# Health check
curl https://api.simplechatroom.com/health

# Should return: {"ok":true}
```

#### Test Pi Server
```bash
# Health check
curl http://your-pi-ip:8080/healthz

# Should return: {"ok":true}
```

#### Test Frontend
1. Navigate to https://ldawg7624.com
2. Click "Sign in"
3. Enter credentials:
   - Email: `luccapo@bmchsd.org`
   - Password: `Password123`
4. Should see:
   - "Signed in as: Ldawg (admin)"
   - "Admin Panel" button visible
   - "Settings" button visible

### 6. Quick Feature Tests ✅

#### Test Admin Panel
```
1. Click "Admin Panel" button
2. Panel should slide in from right
3. See sections: Chat Controls, Message Display Mode, Reports
```

#### Test Sidebar Collapse
```
1. Click toggle button (top-right of sidebar)
2. Sidebar collapses to 60px
3. Click again to expand
```

#### Test Chat Lock
```
1. Open Admin Panel
2. Toggle "Lock Chat" switch ON
3. Open incognito window
4. Try to send message
5. Should see "Chat is locked" error
6. As admin, send message (should work)
7. Toggle lock OFF
8. Incognito window can send messages again
```

#### Test Delete Message
```
1. Send test message from incognito window
2. As admin, hover over message
3. Click "Delete" button in menu
4. Message disappears for everyone
```

#### Test Ban User
```
1. Send test message from incognito window
2. As admin, click "Ban" in message menu
3. Select "1 minute" duration
4. Incognito window cannot send messages
5. Shows "You have been banned by admin" message
6. Wait 1 minute, ban expires
```

#### Test Reports
```
1. As regular user, click "Report" on a message
2. Enter reason, submit
3. As admin, open Admin Panel
4. See report in "Reports" section
5. Click "Dismiss" to remove
```

#### Test Admin Message Modes
```
1. Open Admin Panel
2. Select "Admin" mode from dropdown
3. Send message
4. Message appears with GOLD text at 150% size, label "Admin"
5. Try other modes (SERVER, Custom)
```

#### Test Settings
```
1. Click "Settings" button
2. Change username to something new
3. Should see success message
4. Change password (enter current + new)
5. Should see success message
6. Log out and back in with new credentials
```

## Troubleshooting

### Login Still Fails
```bash
# Check Private API logs
pm2 logs private-api

# Verify MongoDB connection
# Check MONGO_URI in .env

# Re-run seed script
cd apps/private-api
npm run seed:users
```

### Admin Panel Not Appearing
```bash
# Check browser console (F12)
# Look for errors

# Verify token in localStorage:
# Open console and run:
localStorage.getItem('private_token')
localStorage.getItem('private_user')

# If null, sign in again
```

### Chat Lock Not Working
```bash
# Check Pi server logs
pm2 logs global-chat

# Verify state file exists
ls apps/pi-global/state.json

# Check state file content
cat apps/pi-global/state.json

# Should see: {"chatLocked":false,"reports":[]}
```

### WebSocket Connection Fails
```bash
# Check if Pi server is running
pm2 status

# Check Pi server logs
pm2 logs global-chat

# Verify port is open
netstat -tulpn | grep 8080

# Check firewall
sudo ufw status
```

### File Upload Fails
```bash
# Check upload server is running
pm2 status | grep upload

# Check upload server logs
pm2 logs global-upload

# Verify upload directory exists and is writable
ls -la apps/pi-global/uploads
chmod 755 apps/pi-global/uploads
```

### State Not Persisting
```bash
# Check state file permissions
ls -la apps/pi-global/state.json
chmod 644 apps/pi-global/state.json

# Check for write errors in logs
pm2 logs global-chat | grep STATE
```

## Rollback Instructions

If something goes wrong, rollback:

```bash
# 1. Stop all servers
pm2 stop all

# 2. Restore database backup
cd apps/pi-global
cp chat.db.backup chat.db

# 3. Revert code changes
git reset --hard HEAD~1

# 4. Restart servers
cd apps/private-api
pm2 start server.js --name private-api

cd ../pi-global
pm2 start server.js --name global-chat
pm2 start upload-server.js --name global-upload

# 5. Check status
pm2 status
pm2 logs
```

## Monitoring

### Check Server Health
```bash
# PM2 status
pm2 status

# Detailed monitoring
pm2 monit

# View logs
pm2 logs

# View specific server logs
pm2 logs private-api
pm2 logs global-chat
pm2 logs global-upload
```

### Check Resource Usage
```bash
# CPU and memory
top -p $(pgrep -f "node.*server.js" | tr '\n' ',' | sed 's/,$//')

# Disk space
df -h

# Upload directory size
du -sh apps/pi-global/uploads
```

### Check Database Size
```bash
# SQLite database
ls -lh apps/pi-global/chat.db

# MongoDB (on Ubuntu server)
mongo --eval "db.stats()"
```

## Maintenance

### Clean Old Uploads (Optional)
```bash
# Delete files older than 30 days
find apps/pi-global/uploads -type f -mtime +30 -delete

# Or delete unreferenced files
# This is handled automatically by pruneToLimit() in db.js
```

### Clear Reports (Manual)
```bash
# Edit state file
nano apps/pi-global/state.json

# Set reports to empty array
{"chatLocked":false,"reports":[]}

# Restart server
pm2 restart global-chat
```

### Reset Chat Lock (Manual)
```bash
# Edit state file
nano apps/pi-global/state.json

# Set chatLocked to false
{"chatLocked":false,"reports":[]}

# Restart server
pm2 restart global-chat
```

## Security Notes

1. **JWT Secret**: Keep `JWT_SECRET` in `.env` secure
2. **MongoDB**: Ensure MongoDB auth is enabled in production
3. **CORS**: Verify `CORS_ORIGINS` only includes your domain
4. **Firewall**: Only expose necessary ports
5. **HTTPS**: Always use HTTPS for Private API
6. **Rate Limiting**: Already configured in Private API

## Support

If you encounter issues:
1. Check logs: `pm2 logs`
2. Verify environment variables: `cat apps/private-api/.env`
3. Test endpoints manually with curl
4. Check browser console for frontend errors (F12)
5. Verify WebSocket connection in Network tab

## Success Indicators

✅ All servers running: `pm2 status` shows all online
✅ Health checks pass: `/health` and `/healthz` return OK
✅ Admin can log in and see Admin Panel button
✅ Sidebar collapses/expands smoothly
✅ Admin can delete messages, ban users, lock chat
✅ Reports system works
✅ Settings allow username/password changes
✅ State persists across server restarts

Deployment complete! 🎉
