# Pi Global Chat Server

This is the global chat backend that runs on the Raspberry Pi. It includes:
- WebSocket server for real-time messaging
- File upload server for images, videos, and files
- SQLite database for message persistence
- Rate limiting and spam control

## Features

- **No login required** - Global chat open to everyone
- **File uploads** - Images, videos, audio, and files up to 10MB
- **Persistent storage** - File-based SQLite database
- **Rate limiting** - Two-layer spam control
- **WebSocket** - Real-time bidirectional communication

## Setup

### 1. Install Dependencies

```bash
npm install
```

### 2. Configure Environment

Copy `.env.example` to `.env` and configure:

```bash
cp .env.example .env
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

### 3. Create Data Directories

```bash
mkdir -p ~/chat-data/uploads
```

## Running Locally

### Start WebSocket Server

```bash
npm start
```

### Start Upload Server

```bash
npm run start:upload
```

### Start Both Servers

```bash
npm run start:all
```

## Production Deployment with PM2

### Start Both Services

```bash
npm run pm2:start
```

Or manually:
```bash
pm2 start server.js --name global-chat
pm2 start upload-server.js --name global-upload
pm2 save
```

### Stop Services

```bash
npm run pm2:stop
```

### Restart Services

```bash
npm run pm2:restart
```

### View Logs

```bash
npm run pm2:logs
# Or: pm2 logs
```

### Monitor

```bash
pm2 monit
```

## API Endpoints

### WebSocket (server.js)

- `ws://localhost:8080` - WebSocket connection
- `GET /healthz` - Health check
- `GET /uploads/:filename` - Serve uploaded files
- Static files served from root (index.html)

### Upload Server (upload-server.js)

- `POST /upload` - Upload files (multipart/form-data)
- `GET /uploads/:filename` - Serve uploaded files
- `GET /healthz` - Health check

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `WS_PORT` | WebSocket server port | 8080 |
| `UPLOAD_PORT` | Upload server port | 8082 |
| `DB_PATH` | SQLite database file path | ./chat.db |
| `UPLOAD_DIR` | Upload directory path | ./uploads |
| `UPLOAD_BASE_URL` | Public URL for uploads | https://upload.ldawg7624.com |
| `MAX_MESSAGES` | Max messages to keep | 600 |

## File Structure

```
pi-global/
├── server.js           # WebSocket server
├── upload-server.js    # File upload server
├── db.js              # SQLite database operations
├── index.html         # Frontend (if serving)
├── package.json       # Dependencies and scripts
├── .env              # Environment config (not committed)
└── .env.example      # Example environment config
```

## Notes

- The upload server must run alongside the WebSocket server
- Files are automatically pruned when message limit is exceeded
- CORS is configured for ldawg7624.com domains
- Maximum upload size: 10MB
- Audio files are automatically converted to MP3 (requires ffmpeg)
