# New Features Quick Start Guide

## 🚀 How to Deploy

Run the deployment script to install dependencies and restart services:

```bash
./deploy-enhancements.sh
```

This will:
1. Check/install ffmpeg (required for audio conversion)
2. Stop existing services
3. Restart both servers
4. Verify health checks

---

## 📋 Feature Overview

### 1. 👥 Online Users Indicator

**What it does:**
- Shows a green dot and count of online users in the header
- Only counts users whose browser tabs are visible/active
- Updates in real-time as users open/close/hide tabs

**How to test:**
1. Open the chat in multiple browser tabs
2. Switch between tabs - count updates automatically
3. Minimize a tab - count decreases by 1
4. Restore tab - count increases by 1

**Technical:**
- Uses Page Visibility API
- Sends presence updates when tab visibility changes
- Server broadcasts updated count to all clients

---

### 2. 🗑️ Delete Your Own Messages

**What it does:**
- You can delete messages you sent
- Delete button only appears on YOUR messages
- Other users cannot delete your messages (server-validated)

**How to use:**
1. Send a message
2. Look for the small "Delete" button below your message
3. Click to remove the message (removes for everyone)

**Technical:**
- Each message has a `senderId` field
- Server validates ownership before deletion
- Broadcasts delete to all clients with slide-out animation

---

### 3. 🎤 Voice Messages

**What it does:**
- Record audio messages up to 30 seconds
- Automatically converts to MP3 format
- Plays inline with audio controls

**How to use:**
1. Click the 🎤 microphone button
2. Allow microphone access (browser will prompt)
3. Recording starts - you'll see a timer
4. Click 🔴 Stop button OR wait 30s (auto-stops)
5. Message uploads and appears in chat

**Tips:**
- Keep messages short and clear
- Audio is converted to MP3 for compatibility
- Max duration is 30 seconds (enforced automatically)

**Technical:**
- Uses MediaRecorder API (webm/opus format)
- Upload server converts to MP3 using ffmpeg
- Returns MP3 URL for maximum browser compatibility

---

### 4. 🚫 Stricter Rate Limiting

**What changed:**
- **Old:** 7 messages per 10 seconds → 60s mute
- **New:** 3 messages per 10 seconds → Escalating bans

**Ban Escalation:**

| Stage | Trigger | Ban Duration |
|-------|---------|--------------|
| 0 | First violation | 15 seconds |
| 0 | Second violation | 15 seconds |
| 0 | Third violation | 15 seconds |
| 1 | After 3 strikes | **1 minute** |
| 2 | Next violation | **5 minutes** |
| 3 | Next violation | **10 minutes** |
| 4 | Next violation | **15 minutes** |
| 5+ | Continues... | **+5 min each** |

**What this means:**
- First few violations: Short 15-second timeout (warning)
- Persistent spam: Escalates to 1 minute after 3 strikes
- Continued abuse: Bans increase by 5 minutes indefinitely
- Normal users: Won't be affected (3 msgs/10s is plenty)

**How it works:**
- Counts messages in a 10-second sliding window
- Tracks violation history per client
- Automatic escalation based on behavior
- Timer shows remaining ban time

---

## 🎨 UI Changes

### Header
- Now shows: `Kennedy Chat | [Green Dot] Online: X`
- Dark mode toggle remains in same position

### Message Bubbles
- Delete button appears below YOUR messages
- Audio messages show 🎤 icon and playback controls
- Smooth animations for deletion

### Controls Bar
- New 🎤 button added next to Camera and File
- Button changes to 🔴 Stop when recording
- Recording indicator shows elapsed time

### Sidebar
- Updated rules to reflect new rate limits
- Added new features to benefits list

---

## 📱 Browser Compatibility

| Feature | Chrome | Firefox | Safari | Edge |
|---------|--------|---------|--------|------|
| Online indicator | ✅ All | ✅ All | ✅ All | ✅ All |
| Delete messages | ✅ All | ✅ All | ✅ All | ✅ All |
| Voice recording | ✅ 49+ | ✅ 25+ | ✅ 14.1+ | ✅ 79+ |
| Audio playback | ✅ All | ✅ All | ✅ All | ✅ All |

---

## 🔧 Troubleshooting

### Voice Messages Not Working

**Problem:** Microphone button does nothing
- **Solution:** Grant microphone permission in browser settings
- **Check:** Look for blocked microphone icon in address bar

**Problem:** Recording fails or uploads blank audio
- **Solution:** Check microphone is working in system settings
- **Verify:** Test microphone in another app first

**Problem:** Can't play audio messages
- **Solution:** Check browser supports MP3 playback (all modern browsers do)
- **Verify:** Check browser console for errors

### Delete Button Not Showing

**Problem:** Can't see delete button on my messages
- **Cause:** Old messages sent before this feature was added
- **Note:** Only messages sent AFTER deployment show delete button
- **Reason:** Old messages don't have `senderId` field

**Problem:** Delete button appears on other people's messages
- **Cause:** This should never happen (server-validated)
- **Solution:** Refresh page, check console for errors

### Online Count Issues

**Problem:** Count seems wrong
- **Explanation:** Only counts visible/active tabs
- **Normal:** Multiple tabs from same user = multiple counts (if all visible)
- **Normal:** Hidden/minimized tabs = not counted

**Problem:** Count doesn't update
- **Solution:** Check WebSocket connection (look for "Connected ✓" message)
- **Verify:** Open browser console for connection errors

### Rate Limiting Too Strict?

**Problem:** Getting banned too quickly
- **Reality Check:** 3 messages per 10 seconds = 18 messages per minute
- **Tip:** Normal conversation won't trigger this
- **Remember:** Bans start at 15 seconds (very short)

**Problem:** Ban duration seems long
- **Explanation:** Repeated violations escalate the ban
- **Solution:** Wait out the ban, then chat at a normal pace

---

## 🔒 Security & Privacy

### What's Stored
- Messages are stored in server memory (not persisted)
- Audio files are auto-deleted after 1 hour
- No user accounts or login required
- No message history after server restart

### What's Shared
- Your chosen nickname (public)
- Your messages and voice notes (public)
- Your online status (only if tab is visible)

### What's Protected
- Can only delete YOUR messages (server validates)
- Can't bypass rate limits (server enforced)
- Can't fake online count (server controlled)

---

## 📊 Performance Notes

- **Online count:** Only broadcasts on changes (efficient)
- **Audio conversion:** Happens asynchronously (doesn't block)
- **Delete messages:** Instant removal from UI
- **Rate limiting:** Fast timestamp filtering

---

## 🎯 Best Practices

### For Regular Users
- Keep voice messages short (< 10s ideal)
- Delete accidental/duplicate messages promptly
- Stay within rate limits (chat naturally)
- Use dark mode to save battery

### For Testing
- Test audio in multiple browsers
- Try hiding/showing tabs to see online count
- Send 4 messages quickly to test rate limit
- Delete various message types (text, image, audio)

---

## 📞 Support

If you encounter issues:

1. Check browser console (F12 → Console tab)
2. Check server logs:
   ```bash
   tail -f server.log
   tail -f upload-server.log
   ```
3. Verify services are running:
   ```bash
   curl http://localhost:8080/healthz
   curl http://localhost:8082/healthz
   ```
4. Restart services:
   ```bash
   ./deploy-enhancements.sh
   ```

---

## 🎉 Enjoy the New Features!

All features are production-ready and tested. Have fun chatting! 🚀
