# Kennedy Chat Monorepo

This repository contains two separate backend services:

1. **Pi Global Chat** (`/apps/pi-global/`) - Runs on Raspberry Pi
2. **Private API** (`/apps/private-api/`) - Runs on 8GB Ubuntu server

## Repository Structure

```
/
├── apps/
│   ├── pi-global/          # Global chat backend (Raspberry Pi)
│   │   ├── server.js       # WebSocket server
│   │   ├── upload-server.js # File upload server
│   │   ├── db.js           # SQLite database
│   │   ├── package.json    # Dependencies
│   │   ├── .env.example    # Environment template
│   │   └── README.md       # Pi Global documentation
│   │
│   └── private-api/        # Private API backend (Ubuntu server)
│       ├── server.js       # Express API with auth
│       ├── package.json    # Dependencies
│       ├── .env.example    # Environment template
│       └── README.md       # Private API documentation
│
├── index.html              # Frontend (at repository root)
├── .gitignore              # Git ignore rules
└── MONOREPO_README.md      # This file
```

## Quick Start

### Pi Global Chat (Raspberry Pi)

```bash
# Navigate to pi-global
cd apps/pi-global

# Install dependencies
npm install

# Configure environment
cp .env.example .env
# Edit .env with your settings

# Run locally
npm start                  # WebSocket server only
npm run start:upload       # Upload server only
npm run start:all          # Both servers

# Production with PM2
npm run pm2:start          # Start both services
pm2 save                   # Save PM2 config
pm2 startup                # Setup auto-start
```

### Private API (Ubuntu Server)

```bash
# Navigate to private-api
cd apps/private-api

# Install dependencies
npm install

# Configure environment
cp .env.example .env
# IMPORTANT: Edit .env with MongoDB credentials and JWT secret

# Run locally
npm start                  # Production mode
npm run dev                # Development mode (auto-reload)

# Production with PM2
npm run pm2:start          # Start service
pm2 save                   # Save PM2 config
pm2 startup                # Setup auto-start
```

## Deployment Guide

### 1. Pi Global Chat on Raspberry Pi

**Prerequisites:**
- Raspberry Pi with Node.js installed
- Cloudflare Tunnel configured (optional, for public access)
- Sufficient disk space for uploads and database

**Deployment Steps:**

```bash
# SSH to Raspberry Pi
ssh pi@your-pi-address

# Clone repository
git clone <your-repo-url>
cd <repo-name>/apps/pi-global

# Install dependencies
npm install

# Create data directories
mkdir -p ~/chat-data/uploads

# Configure environment
cp .env.example .env
nano .env
```

Edit `.env`:
```env
WS_PORT=8080
UPLOAD_PORT=8082
DB_PATH=/home/pi/chat-data/chat.db
UPLOAD_DIR=/home/pi/chat-data/uploads
UPLOAD_BASE_URL=https://upload.ldawg7624.com
MAX_MESSAGES=600
```

```bash
# Start with PM2
npm run pm2:start

# Save PM2 configuration
pm2 save

# Setup PM2 to start on boot
pm2 startup
# Follow the command it outputs

# Check status
pm2 status
pm2 logs
```

**Cloudflare Tunnel Setup:**

If using Cloudflare Tunnel for public access:
```bash
# Configure tunnel for WebSocket (port 8080)
# Configure tunnel for Upload (port 8082)
```

### 2. Private API on Ubuntu Server

**Prerequisites:**
- Ubuntu server with Node.js installed
- MongoDB running in Docker (bound to 127.0.0.1:27017)
- MongoDB database and user created

**MongoDB Setup (if not done):**

```bash
# Start MongoDB container
docker run -d \
  --name mongodb \
  -p 127.0.0.1:27017:27017 \
  -e MONGO_INITDB_ROOT_USERNAME=admin \
  -e MONGO_INITDB_ROOT_PASSWORD=your_admin_password \
  -v mongodb_data:/data/db \
  mongo:latest

# Create database and user
docker exec -it mongodb mongosh

use admin
db.auth('admin', 'your_admin_password')

use privatechat
db.createUser({
  user: 'appuser',
  pwd: 'your_app_password',
  roles: [{ role: 'readWrite', db: 'privatechat' }]
})
exit
```

**Deployment Steps:**

```bash
# SSH to Ubuntu server
ssh user@your-server

# Clone repository
git clone <your-repo-url>
cd <repo-name>/apps/private-api

# Install dependencies
npm install

# Configure environment
cp .env.example .env
nano .env
```

Edit `.env`:
```env
PORT=3001
MONGO_URI=mongodb://appuser:your_app_password@127.0.0.1:27017/privatechat?authSource=privatechat
JWT_SECRET=$(openssl rand -hex 64)
JWT_EXPIRES_IN=7d
NODE_ENV=production
CORS_ORIGINS=https://ldawg7624.com,https://www.ldawg7624.com
```

```bash
# Generate JWT secret
openssl rand -hex 64
# Copy output to JWT_SECRET in .env

# Start with PM2
npm run pm2:start

# Save PM2 configuration
pm2 save

# Setup PM2 to start on boot
pm2 startup
# Follow the command it outputs

# Check status
pm2 status
pm2 logs private-api
```

## Testing

### Test Pi Global Chat

```bash
# Check WebSocket server
curl http://localhost:8080/healthz

# Check upload server
curl http://localhost:8082/healthz

# Connect frontend
# Open browser to http://your-pi-ip:8080 (or Cloudflare URL)
```

### Test Private API

```bash
# Health check
curl http://localhost:3001/health

# Signup
curl -X POST http://localhost:3001/auth/signup \
  -H "Content-Type: application/json" \
  -d '{"username":"testuser","password":"testpass123"}'

# Login (save the token from signup/login response)
curl -X POST http://localhost:3001/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"testuser","password":"testpass123"}'

# Get user info (replace TOKEN with actual token)
curl http://localhost:3001/me \
  -H "Authorization: Bearer TOKEN"
```

## PM2 Commands Reference

### View All Services

```bash
pm2 list
pm2 status
```

### View Logs

```bash
pm2 logs                    # All logs
pm2 logs global-chat        # Pi global chat logs
pm2 logs global-upload      # Pi upload server logs
pm2 logs private-api        # Private API logs
```

### Restart Services

```bash
# Pi Global (on Raspberry Pi)
pm2 restart global-chat
pm2 restart global-upload
# Or both: pm2 restart all

# Private API (on Ubuntu server)
pm2 restart private-api
```

### Stop Services

```bash
# Pi Global
pm2 stop global-chat global-upload

# Private API
pm2 stop private-api
```

### Monitor

```bash
pm2 monit
```

### Save Configuration

```bash
pm2 save
```

## Environment Variables Summary

### Pi Global Chat

| Variable | Description | Example |
|----------|-------------|---------|
| `WS_PORT` | WebSocket server port | 8080 |
| `UPLOAD_PORT` | Upload server port | 8082 |
| `DB_PATH` | SQLite database path | /home/pi/chat-data/chat.db |
| `UPLOAD_DIR` | Upload directory | /home/pi/chat-data/uploads |
| `UPLOAD_BASE_URL` | Public URL for uploads | https://upload.ldawg7624.com |
| `MAX_MESSAGES` | Max messages to keep | 600 |

### Private API

| Variable | Description | Example |
|----------|-------------|---------|
| `PORT` | API server port | 3001 |
| `MONGO_URI` | MongoDB connection string | mongodb://appuser:pass@127.0.0.1:27017/privatechat |
| `JWT_SECRET` | JWT signing secret | (64-char hex string) |
| `JWT_EXPIRES_IN` | Token expiration | 7d |
| `NODE_ENV` | Environment | production |
| `CORS_ORIGINS` | Allowed origins | https://ldawg7624.com,... |

## Development Workflow

### Working on Pi Global Chat

```bash
cd apps/pi-global

# Make changes to code
# Test locally
npm start

# Commit changes
git add .
git commit -m "feat: your changes"
git push

# Deploy to Pi
ssh pi@your-pi-address
cd /path/to/repo
git pull
cd apps/pi-global
npm install  # if package.json changed
pm2 restart global-chat global-upload
```

### Working on Private API

```bash
cd apps/private-api

# Make changes to code
# Test locally (with local MongoDB or test DB)
npm run dev

# Commit changes
git add .
git commit -m "feat: your changes"
git push

# Deploy to Ubuntu server
ssh user@your-server
cd /path/to/repo
git pull
cd apps/private-api
npm install  # if package.json changed
pm2 restart private-api
```

## Troubleshooting

### Pi Global Chat Issues

**WebSocket connection fails:**
- Check if server is running: `pm2 status`
- Check logs: `pm2 logs global-chat`
- Verify port is open: `netstat -tuln | grep 8080`
- Check Cloudflare Tunnel if using

**Upload fails:**
- Check upload server: `pm2 logs global-upload`
- Verify UPLOAD_DIR exists and is writable
- Check disk space: `df -h`

**Database errors:**
- Verify DB_PATH is writable
- Check database file permissions
- View logs: `pm2 logs global-chat`

### Private API Issues

**MongoDB connection fails:**
- Check MongoDB is running: `docker ps | grep mongo`
- Verify MONGO_URI in .env
- Test connection: `mongosh "mongodb://appuser:pass@127.0.0.1:27017/privatechat"`
- Check logs: `pm2 logs private-api`

**JWT token errors:**
- Verify JWT_SECRET is set in .env
- Check token expiration (JWT_EXPIRES_IN)
- Ensure frontend sends correct Bearer token

**CORS errors:**
- Verify CORS_ORIGINS in .env includes your domain
- Check browser console for details

## Security Checklist

- [ ] `.env` files are NOT committed to git
- [ ] Strong JWT_SECRET generated (64+ char random hex)
- [ ] MongoDB credentials are secure
- [ ] MongoDB only bound to 127.0.0.1 (not public)
- [ ] Cloudflare Tunnel configured for Pi (if public access needed)
- [ ] PM2 configured to restart on crash
- [ ] PM2 configured to start on system boot
- [ ] Regular backups of Pi database and uploads
- [ ] Regular backups of MongoDB database
- [ ] Firewall configured on both servers
- [ ] SSL/TLS configured (via Cloudflare or reverse proxy)

## Port Reference

| Service | Port | Protocol | Location |
|---------|------|----------|----------|
| Pi WebSocket | 8080 | WebSocket/HTTP | Raspberry Pi |
| Pi Upload | 8082 | HTTP | Raspberry Pi |
| Private API | 3001 | HTTP | Ubuntu Server |
| MongoDB | 27017 | TCP | Ubuntu Server (localhost only) |

## Next Steps

1. **Test both services** locally before deploying
2. **Configure firewall rules** on both servers
3. **Setup monitoring** (PM2, uptime monitoring, etc.)
4. **Configure backups** for databases and uploads
5. **Setup Cloudflare Tunnel** for Pi (if public access needed)
6. **Add frontend** to connect to private API (future)
7. **Implement private messaging** in private API (future)

## Support

For detailed documentation on each service, see:
- Pi Global Chat: `/apps/pi-global/README.md`
- Private API: `/apps/private-api/README.md`
