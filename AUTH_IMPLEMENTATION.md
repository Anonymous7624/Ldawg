# Authentication & Sidebar Implementation

## Overview
This implementation adds a left sidebar with conversation list and a working sign-in flow using the Private API over HTTPS (Cloudflare Tunnel).

## What's Implemented

### 1. Backend (Private API)
**Location:** `/apps/private-api/`

#### Updated User Schema
- `fullName`: User's full name
- `email`: Email address (unique, must end with @bmchsd.org for signup)
- `username`: Display name
- `passHash`: Argon2 hashed password
- `role`: "admin", "moderator", or "client" (default)
- `referralCode`: Optional referral code
- `fakeNumber`: Generated fake phone number

#### API Endpoints
- `POST /auth/login` - Email-based login (accepts `{ email, password }`)
- `POST /auth/signup` - Email-based signup (disabled in UI, but ready)
- `GET /me` - Get current user info (requires Bearer token)

### 2. Frontend (index.html)

#### Left Sidebar
- **Conversations List**: Shows "Global Chat" (active by default)
- **Auth Section** (logged out):
  - Text: "Sign up or log in to access more chats"
  - "Sign up" button (disabled/gray)
  - "Sign in" button (opens modal)
- **User Info Section** (logged in):
  - Displays: "Signed in as: {username} ({role})"
  - "Log out" button

#### Sign-in Modal
- Email input (validated)
- Password input
- Submit button with loading state
- Error message display
- Cancel button
- Click outside to close

#### Authentication Flow
1. **On page load**: Checks for existing token
   - Calls `GET /me` with Bearer token
   - If valid: Shows logged-in state
   - If invalid: Clears localStorage, shows logged-out state

2. **On sign in**:
   - POSTs to `/auth/login` with email + password
   - Stores `private_token` and `private_user` in localStorage
   - Updates sidebar to show user info
   - Closes modal

3. **On log out**:
   - Clears localStorage
   - Returns to logged-out state

### 3. Seed Script
**Location:** `/apps/private-api/scripts/seed-users.js`

Creates/updates 3 test users with argon2 hashed passwords.

## Setup Instructions

### Step 1: Seed Test Users
```bash
cd /workspace/apps/private-api
npm run seed:users
```

This creates/updates these accounts:
- **Admin**: luccapo@bmchsd.org / Password123 (username: Ldawg)
- **Moderator**: Jusbarkan@bmchsd.org / Password123 (username: GoonBoy)
- **Moderator**: Ratuddin@bmchsd.org / Password123 (username: RDAWG)

### Step 2: Restart Private API
```bash
cd /workspace/apps/private-api
npm run pm2:restart
# Or for development:
npm run dev
```

### Step 3: Test Sign-in
1. Open https://ldawg7624.com (or your site)
2. Click "Sign in" in the left sidebar
3. Enter one of the test accounts:
   - Email: `luccapo@bmchsd.org`
   - Password: `Password123`
4. Should see: "Signed in as: Ldawg (admin)"

## Configuration

### Frontend API Base URL
Located in `index.html` at the bottom:
```javascript
const PRIVATE_API_BASE = 'https://api.simplechatroom.com';
```

### LocalStorage Keys
- `private_token`: JWT token from /auth/login
- `private_user`: User object JSON string

## What's NOT Implemented Yet (Per Requirements)

### Sign-up Flow (Disabled)
The signup button is disabled in the UI. When enabled later, it should:
- Require full name
- Require @bmchsd.org email (validated in DB)
- Check username availability
- Require password + confirm password
- Accept optional referral code
- Create user with default role: "client"

### Private Chats
- No private chat UI yet
- Left sidebar only shows "Global Chat" for now
- Future: Will show conversation list after login

### Post-login Pages
- No additional pages/views after login
- Global chat continues to work exactly as before
- User info shown in sidebar only

## Security Notes

✅ **Correct**: Frontend → Private API (HTTPS) → MongoDB
❌ **Never**: Frontend → MongoDB directly

All sensitive operations go through the Private API which:
- Uses Argon2 for password hashing
- Issues JWT tokens with configurable expiry
- Enforces rate limiting
- Validates all inputs
- Uses CORS protection

## Files Modified/Created

### Modified
- `/apps/private-api/server.js` - Updated schema, email-based auth
- `/apps/private-api/package.json` - Added `seed:users` script
- `/workspace/index.html` - Added sidebar, modal, auth logic

### Created
- `/apps/private-api/scripts/seed-users.js` - User seeding script
- `/workspace/AUTH_IMPLEMENTATION.md` - This documentation

## Testing Checklist

- [ ] Can see left sidebar with "Global Chat"
- [ ] "Sign up" button is disabled (gray)
- [ ] "Sign in" button opens modal
- [ ] Can sign in with test accounts
- [ ] After sign in, see "Signed in as: {username} ({role})"
- [ ] "Log out" button clears session
- [ ] Page reload preserves session (if token valid)
- [ ] Page reload shows logged-out state (if no token)
- [ ] Global chat still works exactly as before
- [ ] Invalid login shows error message
- [ ] Can close modal with Cancel or clicking outside

## Future Enhancements

When ready to enable signup and private chats:

1. **Enable Signup**:
   - Remove `disabled` attribute from signup button
   - Create signup modal (similar to sign-in)
   - Implement @bmchsd.org email validation
   - Add username availability check
   - Add password confirmation field

2. **Add Private Chats**:
   - Create private conversation API endpoints
   - Update sidebar to show conversation list
   - Add "New Chat" button
   - Implement chat switching logic
   - Store current conversation context

3. **Role-based Features**:
   - Admin dashboard
   - Moderator tools
   - User management
   - Role-specific UI elements
