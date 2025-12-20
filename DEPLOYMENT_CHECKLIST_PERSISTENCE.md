# Deployment Checklist - Persistent Chat History

## Pre-Deployment

### 1. Verify Implementation
- [x] All tests passing (test-e2e.js: 100% success rate)
- [x] Database module created (`db.js`)
- [x] Server integration complete (`server.js`)
- [x] Dependencies installed (`better-sqlite3`)
- [x] Documentation complete

### 2. Review Changes
- [x] `server.js` - Database integration, async handlers
- [x] `db.js` - SQLite module with all required functions
- [x] `package.json` - Added better-sqlite3 dependency
- [x] `README.md` - Updated with persistence info
- [x] No client-side changes required

### 3. Backup Current State
```bash
# Backup current server.js (if needed)
cp server.js server.js.backup

# Note: No database to backup on first deployment
```

## Deployment Steps

### 1. Install Dependencies
```bash
cd /workspace
npm install
```

### 2. Verify Server Starts
```bash
node server.js
# Should see:
# [DB] Initializing database at: /workspace/chat.db
# [DB] Database initialized successfully
# Server listening on port 8080
```

### 3. Run Tests
```bash
# In another terminal
node test-e2e.js
# Should see: ✅ ALL TESTS PASSED - PRODUCTION READY
```

### 4. Test Persistence
```bash
# Send a test message (via browser or test script)
node test-persistence.js

# Stop server (Ctrl+C)

# Restart server
node server.js

# Verify message persists
node test-persistence.js
# Should show: "Found X test messages" where X > 0
```

### 5. Production Start
```bash
# Option 1: Direct
node server.js

# Option 2: With PM2 (recommended)
pm2 start server.js --name "kennedy-chat"
pm2 save

# Option 3: With systemd
# Create /etc/systemd/system/kennedy-chat.service
# systemctl enable kennedy-chat
# systemctl start kennedy-chat
```

## Post-Deployment Verification

### 1. Check Database Created
```bash
ls -lh chat.db
# Should exist and be ~16KB (empty database)
```

### 2. Check Server Logs
```bash
tail -f server.log
# Look for:
# [DB] Database initialized successfully
# [HISTORY] Sent X messages to [client] from DB
```

### 3. Test from Client
1. Open browser to chat URL
2. Send a message
3. Refresh page
4. Verify message is still there
5. Send a file
6. Refresh page
7. Verify file is still accessible

### 4. Test Delete Feature
1. Send a message
2. Delete it
3. Verify it disappears
4. Refresh page
5. Verify it stays deleted

### 5. Monitor Performance
```bash
# Watch database size
watch -n 5 'ls -lh chat.db'

# Watch file count
watch -n 5 'ls -1 uploads/ | wc -l'

# Watch message count
watch -n 5 'sqlite3 chat.db "SELECT COUNT(*) FROM messages;"'
```

## Rollback Plan (If Needed)

### If Issues Occur
```bash
# 1. Stop server
pm2 stop kennedy-chat  # or Ctrl+C

# 2. Restore backup (if made)
cp server.js.backup server.js

# 3. Remove database
rm chat.db

# 4. Restart server
pm2 restart kennedy-chat

# 5. Client will work normally (just no persistence)
```

## Monitoring

### Database Health
```bash
# Check message count
sqlite3 chat.db "SELECT COUNT(*) FROM messages;"

# Check database size
du -h chat.db

# Check for corruption
sqlite3 chat.db "PRAGMA integrity_check;"
```

### File System
```bash
# Check uploads directory
ls -lh uploads/
du -sh uploads/

# Check for orphaned files (shouldn't happen with smart cleanup)
# Files should match database entries
```

### Server Health
```bash
# Check process
ps aux | grep "node server.js"

# Check logs
tail -100 server.log | grep ERROR

# Check connections
netstat -an | grep :8080
```

## Expected Behavior

### Normal Operation
- Messages appear immediately
- ACK received within ~1-2ms
- History loads in <100ms
- Files upload/download normally
- Delete works instantly
- Online count updates correctly

### At 600 Message Cap
- Oldest message automatically pruned
- Files deleted if no longer referenced
- Client sees seamless operation
- No performance degradation

### After Restart
- All messages load from database
- Files remain accessible
- Clients reconnect automatically
- No data loss

## Maintenance

### Daily
- Monitor disk space: `df -h`
- Check logs for errors: `grep ERROR server.log`

### Weekly
- Review database size: `du -h chat.db`
- Check uploads directory: `du -sh uploads/`

### Monthly
- Backup database: `cp chat.db chat.db.$(date +%Y%m%d)`
- Clean old backups (keep last 3 months)

### As Needed
- Clear history: `rm chat.db` (backup first!)
- Optimize database: `sqlite3 chat.db "VACUUM;"`

## Success Criteria

- [x] Server starts without errors
- [x] Database file created
- [x] Messages persist across restarts
- [x] Files persist across restarts
- [x] 600 message cap enforced
- [x] Files cleaned up correctly
- [x] Delete feature works
- [x] ACK system works
- [x] Rate limiting works
- [x] Presence system works
- [x] All tests pass (100%)

## Support

### Documentation
- `IMPLEMENTATION_SUMMARY.md` - Overview
- `PERSISTENT_CHAT_IMPLEMENTATION.md` - Technical details
- `QUICK_START_PERSISTENCE.md` - Quick start guide

### Test Scripts
- `test-e2e.js` - Full validation
- `test-persistence.js` - Basic persistence
- `test-file-persistence.js` - File persistence
- `test-delete.js` - Delete functionality
- `test-pruning.js` - Message cap
- `test-file-cleanup.js` - File cleanup

### Database Queries
```bash
# List all messages
sqlite3 chat.db "SELECT * FROM messages ORDER BY timestamp DESC;"

# Count by type
sqlite3 chat.db "SELECT type, COUNT(*) FROM messages GROUP BY type;"

# Find files
sqlite3 chat.db "SELECT filename, storedFilename FROM messages WHERE type IN ('file','image','audio');"

# Delete old messages (if needed)
sqlite3 chat.db "DELETE FROM messages WHERE timestamp < strftime('%s', 'now', '-30 days');"
```

## Deployment Complete

Once all checks pass:
1. ✅ Server running
2. ✅ Database created
3. ✅ Tests passing
4. ✅ Persistence working
5. ✅ Files working
6. ✅ Client unchanged

**Status**: Ready for production use!
