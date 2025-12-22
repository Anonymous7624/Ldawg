# Private API Backend

This is the private API backend that runs on the 8GB Ubuntu server. It provides authentication and will later support private messaging.

## Features

- **User Authentication** - Signup and login with JWT tokens
- **Secure Password Hashing** - Using argon2
- **MongoDB Storage** - User data stored in MongoDB
- **Rate Limiting** - Protection against brute force attacks
- **Security Headers** - Helmet.js for HTTP security
- **CORS Support** - Configured for your domains

## Prerequisites

### MongoDB Setup

MongoDB should already be running on your Ubuntu server via Docker:

```bash
# Verify MongoDB is running
docker ps | grep mongo

# MongoDB should be bound to 127.0.0.1:27017
# Create database and user (if not already done)
```

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

Edit `.env` with your actual values:

```env
PORT=3001
MONGO_URI=mongodb://appuser:YOUR_PASSWORD@127.0.0.1:27017/privatechat?authSource=privatechat
JWT_SECRET=$(openssl rand -hex 64)
JWT_EXPIRES_IN=7d
NODE_ENV=production
CORS_ORIGINS=https://ldawg7624.com,https://www.ldawg7624.com
```

**IMPORTANT:** Replace `YOUR_PASSWORD` with your actual MongoDB password and generate a secure JWT secret.

### 3. Generate JWT Secret

```bash
openssl rand -hex 64
```

Copy the output to your `.env` file as `JWT_SECRET`.

## Running Locally

### Development Mode (with auto-reload)

```bash
npm run dev
```

### Production Mode

```bash
npm start
```

## Production Deployment with PM2

### Start Service

```bash
npm run pm2:start
```

Or manually:

```bash
pm2 start server.js --name private-api
pm2 save
```

### Stop Service

```bash
npm run pm2:stop
```

### Restart Service

```bash
npm run pm2:restart
```

### View Logs

```bash
npm run pm2:logs
# Or: pm2 logs private-api
```

### Monitor

```bash
pm2 monit
```

## API Endpoints

### Health Check

```bash
GET /health
```

Response:
```json
{
  "ok": true
}
```

### User Signup

```bash
POST /auth/signup
Content-Type: application/json

{
  "username": "johndoe",
  "password": "securepassword123"
}
```

Response (201 Created):
```json
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": "65abc123def456789",
    "username": "johndoe",
    "fakeNumber": "+15551234567"
  }
}
```

### User Login

```bash
POST /auth/login
Content-Type: application/json

{
  "username": "johndoe",
  "password": "securepassword123"
}
```

Response (200 OK):
```json
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": "65abc123def456789",
    "username": "johndoe",
    "fakeNumber": "+15551234567"
  }
}
```

### Get Current User

```bash
GET /me
Authorization: Bearer <token>
```

Response (200 OK):
```json
{
  "user": {
    "id": "65abc123def456789",
    "username": "johndoe",
    "fakeNumber": "+15551234567",
    "createdAt": "2024-01-15T10:30:00.000Z"
  }
}
```

## Testing with curl

### Signup

```bash
curl -X POST http://localhost:3001/auth/signup \
  -H "Content-Type: application/json" \
  -d '{"username":"testuser","password":"testpass123"}'
```

### Login

```bash
curl -X POST http://localhost:3001/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"testuser","password":"testpass123"}'
```

Save the token from the response, then:

### Get Current User

```bash
curl http://localhost:3001/me \
  -H "Authorization: Bearer YOUR_TOKEN_HERE"
```

## Environment Variables

| Variable | Description | Required | Default |
|----------|-------------|----------|---------|
| `PORT` | Server port | No | 3001 |
| `MONGO_URI` | MongoDB connection string | Yes | - |
| `JWT_SECRET` | Secret key for JWT signing | Yes | - |
| `JWT_EXPIRES_IN` | JWT token expiration | No | 7d |
| `NODE_ENV` | Node environment | No | production |
| `CORS_ORIGINS` | Allowed CORS origins (comma-separated) | No | https://ldawg7624.com,https://www.ldawg7624.com |

## Security Notes

- ✅ Passwords are hashed with argon2 (industry standard)
- ✅ JWT tokens are signed and verified
- ✅ Rate limiting on authentication endpoints (10 requests per 15 minutes)
- ✅ Rate limiting on API endpoints (100 requests per 15 minutes)
- ✅ Helmet.js for security headers
- ✅ CORS configured for specific origins
- ✅ MongoDB credentials not exposed in logs

## File Structure

```
private-api/
├── server.js         # Main Express server with auth logic
├── package.json      # Dependencies and scripts
├── .env             # Environment config (not committed)
└── .env.example     # Example environment config
```

## MongoDB Schema

### User Collection

```javascript
{
  username: String,      // Unique, 3-30 chars, alphanumeric + underscore
  password: String,      // Argon2 hashed
  fakeNumber: String,    // Unique fake phone number (+1XXXXXXXXXX)
  createdAt: Date        // Account creation timestamp
}
```

## Future Features

- Private messaging between authenticated users
- User profiles and settings
- Message encryption
- Read receipts
- Typing indicators
- File attachments in private chats
