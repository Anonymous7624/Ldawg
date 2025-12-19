# Global Chat Room

A lightweight, real-time chat application designed for Raspberry Pi behind Cloudflare Tunnel. Features WebSocket communication, file sharing, image uploads, camera capture, and rate limiting.

## Features

- 🌍 **Real-time messaging** via WebSocket
- 📸 **Camera capture** on desktop (getUserMedia)
- 📎 **File uploads** (images and documents, max 10MB)
- 🎨 **Dark mode** with beautiful gradients
- ⚡ **Rate limiting** to prevent spam
- 💾 **In-memory storage** (last 50 messages)
- 🔒 **Secure file handling** with automatic cleanup
- 🚫 **No authentication** or database required

## Requirements

- Node.js 14+ (recommended Node.js 18+)
- npm or yarn

## Installation

```bash
# Install dependencies
npm install
```

## Running the Server

### Development Mode

```bash
# Start the server
npm start
```

The server will run on `http://localhost:8080`

### Production Mode with PM2

```bash
# Install PM2 globally (if not already installed)
npm install -g pm2

# Start the application with PM2
pm2 start server.js --name global-chat

# Save PM2 process list
pm2 save

# Setup PM2 to start on system boot
pm2 startup
```

#### PM2 Useful Commands

```bash
# View logs
pm2 logs global-chat

# Monitor application
pm2 monit

# Restart application
pm2 restart global-chat

# Stop application
pm2 stop global-chat

# Delete from PM2
pm2 delete global-chat
```

## Cloudflare Tunnel Setup

1. Install cloudflared on your Raspberry Pi:
```bash
wget https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-arm64
sudo mv cloudflared-linux-arm64 /usr/local/bin/cloudflared
sudo chmod +x /usr/local/bin/cloudflared
```

2. Authenticate cloudflared:
```bash
cloudflared tunnel login
```

3. Create a tunnel:
```bash
cloudflared tunnel create global-chat
```

4. Configure the tunnel (create `~/.cloudflared/config.yml`):
```yaml
tunnel: <your-tunnel-id>
credentials-file: /home/pi/.cloudflared/<your-tunnel-id>.json

ingress:
  - hostname: your-domain.com
    service: http://localhost:8080
  - service: http_status:404
```

5. Route DNS:
```bash
cloudflared tunnel route dns global-chat your-domain.com
```

6. Run the tunnel:
```bash
cloudflared tunnel run global-chat
```

7. Or run with PM2:
```bash
pm2 start cloudflared -- tunnel run global-chat
pm2 save
```

## API Endpoints

- `GET /` - Serve frontend
- `GET /healthz` - Health check endpoint
- `POST /upload` - File upload (multipart/form-data)
- `GET /uploads/:filename` - Serve uploaded files
- WebSocket connection on same port for real-time chat

## Security Features

- File type validation (blocks .js, .html, .svg)
- File size limit (10MB max)
- Rate limiting (7 messages per 10 seconds)
- Strike system (3 strikes = 120s mute)
- Automatic file cleanup (1 hour or when dropped from buffer)
- Security headers on file downloads
- No permanent logging of messages

## Browser Requirements

- Modern browser with WebSocket support
- Camera API support (for photo capture feature)
- JavaScript enabled

## Architecture

- **Backend**: Node.js + Express + ws
- **Frontend**: Vanilla JavaScript (no framework)
- **Storage**: In-memory (last 50 messages only)
- **File Storage**: Local filesystem with automatic cleanup
- **Real-time**: WebSocket for bi-directional communication

## Customization

Edit these constants in `server.js` to customize behavior:

```javascript
const MAX_MESSAGES = 50;              // Message history size
const MAX_UPLOAD_SIZE = 10 * 1024 * 1024;  // 10MB
const RATE_LIMIT_MESSAGES = 7;        // Messages per window
const RATE_LIMIT_WINDOW = 10000;      // 10 seconds
const MUTE_DURATION_FIRST = 15000;    // 15 seconds
const MUTE_DURATION_STRIKES = 120000; // 120 seconds
const UPLOAD_CLEANUP_AGE = 60 * 60 * 1000; // 1 hour
```

## Port Configuration

The server runs on port 8080 by default. To change:

```javascript
const PORT = 8080; // Change to desired port in server.js
```

## License

MIT

## Notes

- This application is designed for **casual, unmoderated chat**
- No authentication or user management
- No persistent storage (messages lost on restart)
- Files are automatically cleaned up after 1 hour
- Designed to run efficiently on Raspberry Pi hardware
