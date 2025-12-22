# Quick Start Guide

This guide will help you get both services running quickly.

## Prerequisites

- Node.js 16+ installed
- MongoDB running (for private API only)
- PM2 installed globally: `npm install -g pm2`

## Option 1: Install All Dependencies at Once

```bash
# From repository root
npm run install:all
```

## Option 2: Install Per Service

### Pi Global Chat

```bash
cd apps/pi-global
npm install
```

### Private API

```bash
cd apps/private-api
npm install
```

## Configuration

### 1. Pi Global Chat

```bash
cd apps/pi-global
cp .env.example .env
```

Edit `.env` with your settings:
```env
WS_PORT=8080
UPLOAD_PORT=8082
DB_PATH=./chat.db
UPLOAD_DIR=./uploads
UPLOAD_BASE_URL=https://upload.ldawg7624.com
MAX_MESSAGES=600
```

### 2. Private API

```bash
cd apps/private-api
cp .env.example .env
```

Edit `.env` with your settings:
```env
PORT=3001
MONGO_URI=mongodb://appuser:password@127.0.0.1:27017/privatechat?authSource=privatechat
JWT_SECRET=$(openssl rand -hex 64)
JWT_EXPIRES_IN=7d
NODE_ENV=production
CORS_ORIGINS=https://ldawg7624.com,https://www.ldawg7624.com
```

**IMPORTANT:** Generate a secure JWT secret:
```bash
openssl rand -hex 64
```

## Running Locally

### Pi Global Chat

```bash
cd apps/pi-global

# Start WebSocket server
npm start

# In another terminal, start upload server
npm run start:upload

# Or start both at once
npm run start:all
```

Test:
```bash
curl http://localhost:8080/healthz
curl http://localhost:8082/healthz
```

### Private API

```bash
cd apps/private-api
npm start
```

Test:
```bash
# Health check
curl http://localhost:3001/health

# Signup
curl -X POST http://localhost:3001/auth/signup \
  -H "Content-Type: application/json" \
  -d '{"username":"testuser","password":"testpass123"}'
```

## Production Deployment

### Pi Global Chat (on Raspberry Pi)

```bash
cd apps/pi-global
npm run pm2:start
pm2 save
pm2 startup  # Follow instructions
```

### Private API (on Ubuntu Server)

```bash
cd apps/private-api
npm run pm2:start
pm2 save
pm2 startup  # Follow instructions
```

## PM2 Management

```bash
# View status
pm2 status

# View logs
pm2 logs

# Restart
pm2 restart all

# Stop
pm2 stop all

# Monitor
pm2 monit
```

## Testing

### Test Pi Global Chat

1. Open browser to `http://localhost:8080` (or your Pi's IP)
2. Send a message in the chat
3. Upload an image/file
4. Verify everything works

### Test Private API

```bash
# Signup
TOKEN=$(curl -s -X POST http://localhost:3001/auth/signup \
  -H "Content-Type: application/json" \
  -d '{"username":"test123","password":"pass123"}' | jq -r '.token')

echo "Token: $TOKEN"

# Get user info
curl http://localhost:3001/me \
  -H "Authorization: Bearer $TOKEN"
```

Expected output:
```json
{
  "user": {
    "id": "...",
    "username": "test123",
    "fakeNumber": "+15551234567",
    "createdAt": "2024-01-15T10:30:00.000Z"
  }
}
```

## Troubleshooting

### "Cannot find module"
Run `npm install` in the appropriate app directory.

### "MONGO_URI is required"
Make sure you've created `.env` file in `apps/private-api/` with valid MongoDB connection string.

### "Port already in use"
Change the port in `.env` file or stop the process using that port:
```bash
# Find process
lsof -i :8080
# Kill it
kill -9 <PID>
```

### "Permission denied" on uploads
Make sure the UPLOAD_DIR exists and is writable:
```bash
cd apps/pi-global
mkdir -p uploads
chmod 755 uploads
```

## Next Steps

1. ✅ Both services installed and running
2. 📝 Configure production `.env` files with real credentials
3. 🚀 Deploy to production servers (Pi and Ubuntu)
4. 🔒 Setup Cloudflare Tunnel or reverse proxy
5. 📊 Setup monitoring and backups
6. 🧪 Test from frontend applications

## Documentation

- **Main README:** `MONOREPO_README.md`
- **Pi Global Chat:** `apps/pi-global/README.md`
- **Private API:** `apps/private-api/README.md`

## Example curl Commands

### Pi Global Chat

```bash
# Health check
curl http://localhost:8080/healthz

# Upload a file
curl -X POST http://localhost:8082/upload \
  -F "file=@/path/to/image.jpg"
```

### Private API

```bash
# Health check
curl http://localhost:3001/health

# Signup
curl -X POST http://localhost:3001/auth/signup \
  -H "Content-Type: application/json" \
  -d '{"username":"john","password":"secure123"}'

# Login
curl -X POST http://localhost:3001/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"john","password":"secure123"}'

# Get current user (replace TOKEN)
curl http://localhost:3001/me \
  -H "Authorization: Bearer TOKEN"
```

## Support

For detailed documentation, see:
- Full documentation: `MONOREPO_README.md`
- Pi Global: `apps/pi-global/README.md`
- Private API: `apps/private-api/README.md`
