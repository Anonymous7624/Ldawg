# EMERGENCY REMOTE FIX - Moderator Account

## 🚨 IMMEDIATE ACTION NEEDED

You can fix this remotely! I've added an emergency admin API endpoint.

## Quick Fix Options

### Option 1: Update Email & Password (RECOMMENDED)
```bash
curl -X POST https://api.simplechatroom.com/admin/emergency-user-action \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN" \
  -d '{
    "action": "update",
    "email": "jusbarkan@bmchsd.org",
    "newEmail": "newmoderator@bmchsd.org",
    "newPassword": "Password/3285"
  }'
```

### Option 2: Disable Login Immediately
```bash
curl -X POST https://api.simplechatroom.com/admin/emergency-user-action \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN" \
  -d '{
    "action": "disable",
    "email": "jusbarkan@bmchsd.org"
  }'
```

### Option 3: Delete Account Completely
```bash
curl -X POST https://api.simplechatroom.com/admin/emergency-user-action \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN" \
  -d '{
    "action": "delete",
    "email": "jusbarkan@bmchsd.org"
  }'
```

## How to Get Your Admin Token

### Method A: If you have access to your browser
1. Go to https://ldawg7624.com or your site
2. Open Developer Tools (F12)
3. Go to Console tab
4. Type: `localStorage.getItem('private_token')`
5. Copy the token (without quotes)
6. Use it in the curl command above

### Method B: Login via API to get token
```bash
curl -X POST https://api.simplechatroom.com/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "luccapo@bmchsd.org",
    "password": "YOUR_ADMIN_PASSWORD"
  }'
```

This will return:
```json
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {...}
}
```

Copy the token value and use it in the emergency action command.

## Complete Example

```bash
# Step 1: Login as admin
TOKEN=$(curl -s -X POST https://api.simplechatroom.com/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"luccapo@bmchsd.org","password":"YOUR_PASSWORD"}' \
  | grep -o '"token":"[^"]*"' | cut -d'"' -f4)

# Step 2: Update the moderator account
curl -X POST https://api.simplechatroom.com/admin/emergency-user-action \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "action": "update",
    "email": "jusbarkan@bmchsd.org",
    "newEmail": "newmoderator@bmchsd.org",
    "newPassword": "Password/3285"
  }'
```

## What Each Action Does

### UPDATE
- Changes the email address
- Changes the password
- User can login with new credentials immediately
- **Use this if you want to give new credentials**

### DISABLE
- Changes password to random unguessable string
- User cannot login anymore
- Account still exists in database
- **Use this to block access immediately**

### DELETE
- Completely removes user from database
- User cannot login
- Cannot be undone (need to recreate account)
- **Use this as last resort**

## API Details

**Endpoint**: `POST /admin/emergency-user-action`

**Authentication**: Requires admin or moderator JWT token

**Request Body**:
```json
{
  "action": "update|disable|delete",
  "email": "email@bmchsd.org",
  "newEmail": "newemail@bmchsd.org",  // optional, for update action
  "newPassword": "newpassword"         // optional, for update action
}
```

**Response**:
```json
{
  "ok": true,
  "action": "updated",
  "oldEmail": "jusbarkan@bmchsd.org",
  "newEmail": "newmoderator@bmchsd.org",
  "passwordChanged": true
}
```

## Deployment

To deploy this emergency endpoint to your production server:

```bash
# Push the changes to git
git add apps/private-api/server.js
git commit -m "Add emergency user action endpoint"
git push origin main

# On production server (or via deployment script)
cd /workspace/apps/private-api
git pull origin main
pm2 restart private-api
```

Or if you have PM2 setup:
```bash
pm2 restart private-api
```

## Testing

After deployment, test the endpoint:
```bash
# Check health
curl https://api.simplechatroom.com/health

# If endpoint is available, health should return {"ok":true}
```

## Browser Console Method (Easiest!)

If you can access your website:

1. Go to https://ldawg7624.com
2. Sign in as admin (luccapo@bmchsd.org)
3. Open Console (F12)
4. Paste this:

```javascript
// Get your token
const token = localStorage.getItem('private_token');

// OPTION 1: Update email and password
fetch('https://api.simplechatroom.com/admin/emergency-user-action', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': 'Bearer ' + token
  },
  body: JSON.stringify({
    action: 'update',
    email: 'jusbarkan@bmchsd.org',
    newEmail: 'newmoderator@bmchsd.org',
    newPassword: 'Password/3285'
  })
}).then(r => r.json()).then(console.log);

// OPTION 2: Disable login (run this instead if you just want to block)
fetch('https://api.simplechatroom.com/admin/emergency-user-action', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': 'Bearer ' + token
  },
  body: JSON.stringify({
    action: 'disable',
    email: 'jusbarkan@bmchsd.org'
  })
}).then(r => r.json()).then(console.log);

// OPTION 3: Delete account (run this to completely remove)
fetch('https://api.simplechatroom.com/admin/emergency-user-action', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': 'Bearer ' + token
  },
  body: JSON.stringify({
    action: 'delete',
    email: 'jusbarkan@bmchsd.org'
  })
}).then(r => r.json()).then(console.log);
```

5. Check the console output - should see `{ok: true, ...}`

## CRITICAL: Deploy First!

⚠️ **IMPORTANT**: The emergency endpoint won't work until you deploy the updated server.js to production!

**Fastest deployment**:
1. Commit the changes to git
2. SSH into production OR use your deployment system
3. Pull latest code
4. Restart the private-api service

**OR if this workspace IS your production environment**:
```bash
cd /workspace/apps/private-api
pm2 restart private-api
# Then run the curl command or browser console method above
```

## Need Help?

If you still can't access it:
1. Can you access your website? Use browser console method (easiest!)
2. Can you access your server via another device or friend's computer?
3. Can you use a mobile SSH app?
4. Do you have a deployment pipeline (GitHub Actions, etc.)?

Let me know what access you DO have and I'll help you fix this remotely!
