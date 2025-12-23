# Testing Checklist: Auth & Sidebar Implementation

## Pre-Testing Setup

### Step 1: Seed Database
```bash
cd /workspace/apps/private-api
npm run seed:users
```

**Expected:**
```
[SEED] ✓ Created user: luccapo@bmchsd.org (Ldawg, role: admin)
[SEED] ✓ Created user: Jusbarkan@bmchsd.org (GoonBoy, role: moderator)
[SEED] ✓ Created user: Ratuddin@bmchsd.org (RDAWG, role: moderator)
```

### Step 2: Verify Private API is Running
```bash
curl https://api.simplechatroom.com/health
```

**Expected:**
```json
{"ok":true}
```

---

## Visual Testing

### ✅ 1. Left Sidebar Visible
- [ ] Left sidebar appears (280px wide)
- [ ] Shows "Chats" header at top
- [ ] Shows "Global Chat" item (active/highlighted)
- [ ] Shows bottom section with auth UI
- [ ] Dark mode: sidebar border is white/semi-transparent
- [ ] Light mode: sidebar border is black/semi-transparent

### ✅ 2. Auth Section (Logged Out)
- [ ] Shows text: "Sign up or log in to access more chats"
- [ ] "Sign up" button is visible but DISABLED (gray/unclickable)
- [ ] "Sign in" button is visible and ENABLED (blue, clickable)
- [ ] Buttons are side-by-side (flex layout)

### ✅ 3. Existing Layout Unchanged
- [ ] Main chat area still visible in center
- [ ] Right sidebar still shows "Rules" and "Features"
- [ ] Header still shows "Kennedy Chat" + dark mode toggle
- [ ] Chat input and composer still work
- [ ] No visual regressions in existing UI

---

## Functional Testing

### ✅ 4. Sign-in Modal Opens
**Action:** Click "Sign in" button

**Expected:**
- [ ] Modal appears with dark overlay
- [ ] Modal shows "Sign In" heading
- [ ] Email input field visible
- [ ] Password input field visible
- [ ] "Cancel" button visible
- [ ] "Sign In" submit button visible
- [ ] No error message shown initially

### ✅ 5. Sign-in Modal Closes
**Actions:**
1. Click "Cancel" → Modal closes
2. Click "Sign in" again, then click dark overlay → Modal closes
3. Click "Sign in" again, press ESC → (optional, not implemented)

### ✅ 6. Failed Login
**Action:** 
1. Click "Sign in"
2. Enter: `wrong@bmchsd.org` / `wrongpassword`
3. Click "Sign In"

**Expected:**
- [ ] Button shows "Signing in..." (loading state)
- [ ] Button becomes disabled temporarily
- [ ] Error message appears: "Invalid email or password" (or similar)
- [ ] Modal stays open
- [ ] Can try again

### ✅ 7. Successful Login - Admin
**Action:**
1. Click "Sign in"
2. Enter: `luccapo@bmchsd.org` / `Password123`
3. Click "Sign In"

**Expected:**
- [ ] Modal closes
- [ ] Left sidebar auth section disappears
- [ ] User info section appears
- [ ] Shows: "Signed in as: Ldawg (admin)"
- [ ] "Log out" button appears (red)
- [ ] Browser console: "Signed in successfully: Ldawg"
- [ ] localStorage has `private_token`
- [ ] localStorage has `private_user`

### ✅ 8. Successful Login - Moderator
**Repeat test with:**
- `Jusbarkan@bmchsd.org` / `Password123` → Shows "GoonBoy (moderator)"
- `Ratuddin@bmchsd.org` / `Password123` → Shows "RDAWG (moderator)"

### ✅ 9. Session Persistence
**Action:**
1. Log in successfully
2. Refresh page (F5 or Cmd+R)

**Expected:**
- [ ] Page reloads
- [ ] Still shows logged-in state
- [ ] Shows correct username and role
- [ ] "Log out" button still visible
- [ ] No sign-in button visible

### ✅ 10. Logout
**Action:**
1. While logged in, click "Log out"

**Expected:**
- [ ] User info section disappears
- [ ] Auth section reappears
- [ ] Shows "Sign up or log in..." text again
- [ ] "Sign in" button visible
- [ ] Browser console: "Logged out successfully"
- [ ] localStorage `private_token` cleared
- [ ] localStorage `private_user` cleared

### ✅ 11. Expired/Invalid Token
**Action:**
1. Log in successfully
2. Open DevTools (F12) → Application → Local Storage
3. Manually change `private_token` to `"invalid_token"`
4. Refresh page

**Expected:**
- [ ] Session check fails
- [ ] Shows logged-out state
- [ ] localStorage cleared
- [ ] Can sign in again

---

## Integration Testing

### ✅ 12. Global Chat Still Works
**While logged OUT:**
- [ ] Can send messages in global chat
- [ ] Can see other users' messages
- [ ] Can upload media (photos, videos, etc.)
- [ ] Can delete own messages
- [ ] Typing indicators work
- [ ] Online count updates

**While logged IN:**
- [ ] All above features still work
- [ ] No difference in global chat functionality
- [ ] No errors in browser console

### ✅ 13. Dark Mode
**Action:** Toggle dark mode

**Expected:**
- [ ] Left sidebar background adapts
- [ ] Left sidebar border color changes
- [ ] Auth buttons adjust colors
- [ ] Modal background adapts
- [ ] Modal input fields adapt
- [ ] User info text remains readable

### ✅ 14. Responsive Design (Optional)
**Action:** Resize browser window

**Expected:**
- [ ] Sidebar scales reasonably
- [ ] Modal stays centered
- [ ] No layout breaks
- [ ] Buttons remain clickable

---

## Browser Console Checks

### ✅ 15. No JavaScript Errors
**Action:** Open DevTools → Console

**Expected:**
- [ ] No errors on page load
- [ ] No errors when opening modal
- [ ] No errors when logging in
- [ ] No errors when logging out
- [ ] No errors in global chat functionality

### ✅ 16. Network Requests
**Action:** Open DevTools → Network tab

**On page load (logged in):**
- [ ] GET request to `https://api.simplechatroom.com/me`
- [ ] Returns 200 OK with user data

**On login:**
- [ ] POST request to `https://api.simplechatroom.com/auth/login`
- [ ] Request body: `{"email":"...","password":"..."}`
- [ ] Returns 200 OK with token and user object

**On failed login:**
- [ ] POST request returns 401 Unauthorized
- [ ] Response has error message

---

## Edge Cases

### ✅ 17. Double-click "Sign in"
- [ ] Modal doesn't open twice
- [ ] No duplicate overlays

### ✅ 18. Submit Empty Form
- [ ] HTML5 validation prevents submission
- [ ] Shows "Please fill out this field"

### ✅ 19. Invalid Email Format
**Action:** Enter `notanemail` in email field

**Expected:**
- [ ] HTML5 validation catches it
- [ ] Shows "Please enter a valid email"

### ✅ 20. Global Chat Item Click
**Action:** Click "Global Chat" in left sidebar

**Expected:**
- [ ] Console logs: "Global Chat selected (already active)"
- [ ] No errors
- [ ] Chat view doesn't change (already showing global)

---

## Security Checks

### ✅ 21. Token Storage
**Action:** Check localStorage after login

**Expected:**
- [ ] `private_token` is a JWT (three dot-separated parts)
- [ ] `private_user` is valid JSON with user data
- [ ] No password stored in localStorage

### ✅ 22. API Base URL
**Action:** Check source code

**Expected:**
- [ ] Uses `https://api.simplechatroom.com` (not http://)
- [ ] No hardcoded passwords
- [ ] No direct MongoDB connection strings

### ✅ 23. Password Field
**Action:** Inspect password input

**Expected:**
- [ ] Type is `password` (bullets/dots shown)
- [ ] Autocomplete attribute set
- [ ] Not visible in DevTools value

---

## Accessibility (Optional)

### ✅ 24. Keyboard Navigation
- [ ] Can Tab through form fields
- [ ] Can Tab to buttons
- [ ] Enter submits form
- [ ] Escape closes modal (optional)

### ✅ 25. Screen Reader (Optional)
- [ ] Labels associated with inputs
- [ ] Buttons have descriptive text
- [ ] Error messages are announced

---

## Summary

**Total Checks:** 25 sections with ~100+ individual items

**Pass Criteria:**
- All visual elements appear correctly
- Sign-in flow works with test accounts
- Session persists across reloads
- Logout clears session
- Global chat unchanged
- No console errors

**Known Limitations (OK):**
- Sign-up button is disabled (intentional)
- No private chats yet (intentional)
- Only one conversation (Global Chat) shown (intentional)

---

## Quick Test Script

For rapid testing, try this sequence:

1. ✅ Load page → See left sidebar
2. ✅ Click "Sign in" → Modal opens
3. ✅ Enter admin credentials → Login successful
4. ✅ See "Ldawg (admin)" → User info shown
5. ✅ Refresh page → Still logged in
6. ✅ Click "Log out" → Back to logged-out state
7. ✅ Send a chat message → Global chat still works

**If all 7 steps pass:** Core functionality is working! ✨

---

## Troubleshooting

### Problem: "Sign in" button doesn't open modal
- Check browser console for JS errors
- Verify modal HTML exists in page
- Check if `onclick="openSignInModal()"` is on button

### Problem: Login fails with network error
- Verify Private API is running
- Check CORS settings in Private API
- Test API directly: `curl https://api.simplechatroom.com/health`

### Problem: Session doesn't persist
- Check if localStorage is enabled in browser
- Verify token is stored after login
- Check if `/me` endpoint returns 200 OK

### Problem: Left sidebar not visible
- Check CSS for `.left-sidebar` class
- Verify HTML structure has left sidebar div
- Check browser zoom level

---

**Ready to test!** 🚀

Run through each section and check off items as you verify them.
