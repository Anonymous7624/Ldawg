# 🎯 FINAL DEPLOYMENT GUIDE

## ✅ MONOREPO RESTRUCTURE COMPLETE

Your repository has been successfully transformed into a monorepo with two independent backends.

---

## 📁 NEW STRUCTURE

```
/workspace/
├── apps/
│   ├── pi-global/              🍓 RASPBERRY PI - Global Chat
│   │   ├── server.js           # WebSocket server (port 8080)
│   │   ├── upload-server.js    # Upload server (port 8082) ⭐ STAYS ON PI
│   │   ├── db.js               # SQLite database
│   │   ├── index.html          # Frontend
│   │   ├── package.json        # Dependencies
│   │   ├── .env.example        # Config template
│   │   └── README.md           # Complete docs
│   │
│   └── private-api/            🖥️  UBUNTU SERVER - Private API
│       ├── server.js           # Express API (port 3001)
│       ├── package.json        # Dependencies
│       ├── .env.example        # Config template
│       └── README.md           # Complete docs
│
├── .gitignore                  # Updated (all .env ignored)
├── package.json                # Root helper scripts
├── MONOREPO_README.md          # Complete guide ⭐ START HERE
├── QUICK_START.md              # Quick reference
└── IMPLEMENTATION_SUMMARY.md   # What was done
```

---

## 🚀 DEPLOYMENT STEPS

### STEP 1: Pi Global Chat → Raspberry Pi

**SSH to your Pi:**
```bash
ssh pi@your-raspberry-pi
```

**Deploy:**
```bash
# Navigate to repo
cd /path/to/your/repo
git pull origin cursor/monorepo-restructure-and-private-api-7607

# Install dependencies
cd apps/pi-global
npm install

# Create environment config
cp .env.example .env
nano .env
```

**Edit `.env`:**
```env
WS_PORT=8080
UPLOAD_PORT=8082
DB_PATH=/home/pi/chat-data/chat.db
UPLOAD_DIR=/home/pi/chat-data/uploads
UPLOAD_BASE_URL=https://upload.ldawg7624.com
MAX_MESSAGES=600
```

**Create data directories:**
```bash
mkdir -p ~/chat-data/uploads
```

**Start with PM2:**
```bash
npm run pm2:start
pm2 save
pm2 startup  # Follow the command it outputs
```

**Verify:**
```bash
pm2 status
curl http://localhost:8080/healthz
curl http://localhost:8082/healthz
```

---

### STEP 2: Private API → Ubuntu Server

**SSH to your Ubuntu server:**
```bash
ssh user@your-ubuntu-server
```

**Verify MongoDB is running:**
```bash
docker ps | grep mongo
# If not running, start it:
# docker start mongodb
```

**Deploy:**
```bash
# Navigate to repo
cd /path/to/your/repo
git pull origin cursor/monorepo-restructure-and-private-api-7607

# Install dependencies
cd apps/private-api
npm install

# Create environment config
cp .env.example .env
nano .env
```

**Edit `.env` (IMPORTANT):**
```env
PORT=3001
MONGO_URI=mongodb://appuser:YOUR_REAL_PASSWORD@127.0.0.1:27017/privatechat?authSource=privatechat
JWT_SECRET=GENERATE_WITH_COMMAND_BELOW
JWT_EXPIRES_IN=7d
NODE_ENV=production
CORS_ORIGINS=https://ldawg7624.com,https://www.ldawg7624.com
```

**Generate JWT secret:**
```bash
openssl rand -hex 64
# Copy the output and paste into .env as JWT_SECRET
```

**Start with PM2:**
```bash
npm run pm2:start
pm2 save
pm2 startup  # Follow the command it outputs
```

**Verify:**
```bash
pm2 status
curl http://localhost:3001/health
```

---

## 🧪 TESTING

### Test Pi Global Chat

**Health checks:**
```bash
curl http://localhost:8080/healthz
curl http://localhost:8082/healthz
```

**WebSocket test:**
Open browser to `http://your-pi-ip:8080` or your Cloudflare URL.

### Test Private API

**Health check:**
```bash
curl http://localhost:3001/health
# Expected: {"ok":true}
```

**Signup:**
```bash
curl -X POST http://localhost:3001/auth/signup \
  -H "Content-Type: application/json" \
  -d '{"username":"testuser","password":"testpass123"}'
# Save the token from response
```

**Login:**
```bash
curl -X POST http://localhost:3001/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"testuser","password":"testpass123"}'
```

**Get user info:**
```bash
curl http://localhost:3001/me \
  -H "Authorization: Bearer YOUR_TOKEN_HERE"
# Expected: {"user":{"id":"...","username":"testuser","fakeNumber":"+15551234567","createdAt":"..."}}
```

---

## 📊 PM2 MANAGEMENT

### View Status
```bash
pm2 status
pm2 list
```

### View Logs
```bash
# All services
pm2 logs

# Specific service
pm2 logs global-chat
pm2 logs global-upload
pm2 logs private-api
```

### Restart Services
```bash
# Pi Global (on Raspberry Pi)
pm2 restart global-chat global-upload

# Private API (on Ubuntu server)
pm2 restart private-api
```

### Monitor
```bash
pm2 monit
```

---

## 🔒 SECURITY CHECKLIST

Before going live:

- [ ] `.env` files are NOT committed to git (verified with `git status`)
- [ ] Strong JWT_SECRET generated (64+ character hex string)
- [ ] MongoDB password is secure and different from defaults
- [ ] MongoDB only accessible from localhost (127.0.0.1)
- [ ] Firewall configured on both servers
- [ ] PM2 configured to restart on crash
- [ ] PM2 configured to start on system boot
- [ ] CORS origins configured correctly in private API
- [ ] SSL/TLS enabled (via Cloudflare or reverse proxy)

---

## 📚 DOCUMENTATION

All documentation is in your repository:

1. **QUICK_START.md** - Fast setup guide
2. **MONOREPO_README.md** - Complete monorepo documentation
3. **apps/pi-global/README.md** - Pi Global Chat details
4. **apps/private-api/README.md** - Private API details
5. **IMPLEMENTATION_SUMMARY.md** - What was changed

---

## 🎯 WHAT WAS ACCOMPLISHED

### ✅ Pi Global Chat (Raspberry Pi)
- **Preserved all existing functionality** - No breaking changes
- **Upload server stays on Pi** - As required
- **File-based SQLite storage** - Continues to work as before
- **WebSocket + Upload servers** - Both running from pi-global
- **PM2 scripts added** - Easy deployment
- **Full documentation** - README + .env.example

### ✅ Private API (Ubuntu Server)
- **Authentication endpoints** - signup, login, /me
- **MongoDB integration** - Configurable via .env
- **Secure password hashing** - Using argon2
- **JWT tokens** - With configurable expiration
- **Rate limiting** - 10 auth requests per 15 min
- **Security headers** - Helmet.js
- **CORS configured** - For your domains
- **PM2 scripts added** - Easy deployment
- **Full documentation** - README + .env.example + example curl commands

### ✅ Monorepo Structure
- **Two independent backends** - Can be deployed separately
- **No shared dependencies** - Each app has its own node_modules
- **Proper gitignore** - .env files never committed
- **Environment templates** - .env.example for both apps
- **Helper scripts** - Root package.json for installing all
- **Comprehensive docs** - Multiple README files for different needs

---

## 🔄 UPDATING CODE

### Update Pi Global Chat
```bash
# On Raspberry Pi
cd /path/to/repo
git pull
cd apps/pi-global
npm install  # If package.json changed
pm2 restart global-chat global-upload
```

### Update Private API
```bash
# On Ubuntu server
cd /path/to/repo
git pull
cd apps/private-api
npm install  # If package.json changed
pm2 restart private-api
```

---

## ❓ TROUBLESHOOTING

### Pi Global Chat Issues

**WebSocket not connecting:**
- Check: `pm2 logs global-chat`
- Verify port 8080 is accessible
- Check Cloudflare Tunnel configuration

**Upload fails:**
- Check: `pm2 logs global-upload`
- Verify UPLOAD_DIR exists and is writable
- Check disk space: `df -h`

**Database errors:**
- Check DB_PATH is writable
- View logs: `pm2 logs global-chat`

### Private API Issues

**MongoDB connection fails:**
- Verify MongoDB is running: `docker ps | grep mongo`
- Check MONGO_URI in .env
- Test connection: `mongosh "mongodb://appuser:pass@127.0.0.1:27017/privatechat"`

**JWT errors:**
- Verify JWT_SECRET is set in .env
- Ensure JWT_SECRET is at least 32 characters
- Check token format (should be "Bearer TOKEN")

**CORS errors:**
- Verify CORS_ORIGINS in .env
- Check browser console for details

---

## 🎉 NEXT STEPS

1. ✅ **Monorepo restructure** - COMPLETE
2. 📝 **Configure .env files** - Required before deployment
3. 🚀 **Deploy to Pi** - Follow STEP 1 above
4. 🚀 **Deploy to Ubuntu** - Follow STEP 2 above
5. 🧪 **Test both services** - Use testing section above
6. 🔒 **Security review** - Complete security checklist
7. 📊 **Setup monitoring** - PM2 + uptime monitoring
8. 💾 **Setup backups** - For databases and uploads
9. 🎨 **Connect frontend** - Point your frontend to new APIs
10. 🚀 **Go live!** - You're ready for production

---

## 📞 QUICK REFERENCE

| Service | Port | Machine | Start Command |
|---------|------|---------|---------------|
| WebSocket | 8080 | Raspberry Pi | `npm run pm2:start` (in pi-global) |
| Upload | 8082 | Raspberry Pi | (included in above) |
| Private API | 3001 | Ubuntu Server | `npm run pm2:start` (in private-api) |
| MongoDB | 27017 | Ubuntu Server | `docker start mongodb` |

### Example curl Commands

**Pi Global:**
```bash
curl http://localhost:8080/healthz
```

**Private API:**
```bash
# Signup
curl -X POST http://localhost:3001/auth/signup \
  -H "Content-Type: application/json" \
  -d '{"username":"john","password":"secure123"}'

# Login  
curl -X POST http://localhost:3001/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"john","password":"secure123"}'

# Get user (use token from login)
curl http://localhost:3001/me \
  -H "Authorization: Bearer YOUR_TOKEN"
```

---

## ✨ SUMMARY

You now have a production-ready monorepo with:
- ✅ Global chat on Raspberry Pi (existing behavior preserved)
- ✅ Private API on Ubuntu server (new authentication system)
- ✅ Proper separation of concerns
- ✅ Independent deployment
- ✅ Comprehensive documentation
- ✅ PM2 process management
- ✅ Environment-based configuration
- ✅ Security best practices

**Everything is ready for deployment!** 🎉
