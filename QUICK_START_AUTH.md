# Quick Start: Authentication & Sidebar

## 🚀 Get Started in 3 Steps

### 1️⃣ Seed Test Accounts
```bash
cd /workspace/apps/private-api
npm run seed:users
```

**Expected Output:**
```
[SEED] Connecting to MongoDB...
[SEED] ✓ Connected to MongoDB
[SEED] ✓ Created user: luccapo@bmchsd.org (Ldawg, role: admin)
[SEED] ✓ Created user: Jusbarkan@bmchsd.org (GoonBoy, role: moderator)
[SEED] ✓ Created user: Ratuddin@bmchsd.org (RDAWG, role: moderator)
[SEED] ✓ Seeding complete!
```

### 2️⃣ Restart Private API (if running)
```bash
cd /workspace/apps/private-api
npm run pm2:restart
```

### 3️⃣ Test on Website
1. Visit: https://ldawg7624.com
2. Look for new **left sidebar** with "Chats"
3. Click **"Sign in"** button
4. Enter test credentials:
   - Email: `luccapo@bmchsd.org`
   - Password: `Password123`
5. Should see: **"Signed in as: Ldawg (admin)"**

---

## 🧪 Test Accounts

| Email | Username | Password | Role |
|-------|----------|----------|------|
| luccapo@bmchsd.org | Ldawg | Password123 | admin |
| Jusbarkan@bmchsd.org | GoonBoy | Password123 | moderator |
| Ratuddin@bmchsd.org | RDAWG | Password123 | moderator |

---

## ✅ What Works Now

- ✅ Left sidebar with "Global Chat"
- ✅ Sign-in modal with email/password
- ✅ Session persistence across page reloads
- ✅ JWT authentication via Private API
- ✅ User info display (username + role)
- ✅ Log out functionality
- ✅ Existing global chat unchanged

---

## 🚫 What's NOT Enabled Yet

- ❌ Sign-up flow (button disabled)
- ❌ Private chats / conversations
- ❌ Post-login pages/features
- ❌ Role-based UI elements

These are placeholders for future development.

---

## 🔧 Troubleshooting

### Can't sign in?
1. Make sure Private API is running: `cd /workspace/apps/private-api && npm run pm2:logs`
2. Check if seed script ran successfully
3. Verify MongoDB connection in Private API logs
4. Check browser console (F12) for errors

### "Session expired" on reload?
- Token expired (default: 7 days)
- Sign in again to get new token

### Modal won't close?
- Click outside the modal
- Press "Cancel" button
- Check browser console for JS errors

---

## 📁 Key Files

| File | Purpose |
|------|---------|
| `/apps/private-api/server.js` | Backend API with auth endpoints |
| `/apps/private-api/scripts/seed-users.js` | Creates test users |
| `/workspace/index.html` | Frontend with sidebar + auth UI |
| `/workspace/AUTH_IMPLEMENTATION.md` | Full technical documentation |

---

## 🔐 Security Architecture

```
Frontend (Browser)
    ↓ HTTPS (Cloudflare Tunnel)
Private API (api.simplechatroom.com)
    ↓ Mongoose
MongoDB (Database)
```

**Never direct frontend → MongoDB connection!**

---

## 📞 Support

- Full docs: See `/workspace/AUTH_IMPLEMENTATION.md`
- API endpoints: `GET https://api.simplechatroom.com/`
- Health check: `GET https://api.simplechatroom.com/health`

---

**Ready to go!** 🎉 Run the seed script and test the sign-in flow.
