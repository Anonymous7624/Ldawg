# Manual Test Checklist

## Quick Test Guide for Chat App Enhancements

### 1. Hot Bar Default Collapsed State

**Test Steps:**
1. Open the chat app in a fresh browser tab (or clear sessionStorage)
2. Observe the formatting toolbar on page load
   - ✅ PASS: Toolbar should be **collapsed** (hidden) by default
   - ❌ FAIL: If toolbar is visible/expanded

3. Click the "Formatting" toggle button with down arrow (▼)
   - ✅ PASS: Toolbar expands and shows all formatting options
   - ✅ PASS: Arrow rotates to point up

4. Click the toggle button again
   - ✅ PASS: Toolbar collapses (hides)
   - ✅ PASS: Arrow rotates back down

**Session Persistence Test:**
5. Expand the toolbar
6. Refresh the page (F5)
   - ✅ PASS: Toolbar remains **expanded** after refresh
   
7. Open the same site in a new tab
   - ✅ PASS: Toolbar is still **expanded** in new tab (same session)

8. Close ALL browser tabs/windows for the site
9. Open the site again in a new window
   - ✅ PASS: Toolbar is **collapsed** again (new session)

---

### 2. Font Controls Simplified

**Test Steps:**
1. Expand the formatting toolbar
2. Verify the controls present:
   - ✅ PASS: Bold (B), Italic (I), Underline (U) buttons are present
   - ✅ PASS: "Style" dropdown is present
   - ✅ PASS: Font Size dropdown is **NOT** present (removed)

3. Select some text in the message input
4. Click Bold, then send a message
   - ✅ PASS: Message displays in **bold** in the chat

5. Type new text, select it, apply Italic, send
   - ✅ PASS: Message displays in *italic*

6. Type text, select it, choose "Monospace" from Style dropdown, send
   - ✅ PASS: Text appears in monospace font with gray background

7. Refresh the page and scroll to previous messages
   - ✅ PASS: All formatting (bold/italic/monospace) still displays correctly

**Caption Formatting Test:**
8. Attach an image file
9. Type a caption with formatting (bold/italic/monospace)
10. Send the image with caption
    - ✅ PASS: Caption formatting is preserved in the message

---

### 3. Emoji UX Upgrades

**Test Steps:**
1. Expand the formatting toolbar
2. Verify Quick Emojis are visible:
   - ✅ PASS: You see 5 emojis directly on toolbar: ❤️ 😂 😭 👍 🔥
   - ✅ PASS: Emojis are clickable (not inside a dropdown)

3. Click on the crying emoji (😭)
   - ✅ PASS: Emoji inserts at cursor position in message input
   - ✅ PASS: Does NOT replace existing text

4. Type "I'm sad" then click quick emoji 😭 in the middle of the text
   - ✅ PASS: Emoji inserts at cursor, does not overwrite

5. Click the "😊+" button (More Emojis)
   - ✅ PASS: Dropdown emoji picker appears

6. Verify crying face (😭) and wilted rose (🥀) are in the dropdown
   - ✅ PASS: Both emojis are present

7. Click an emoji from the dropdown
   - ✅ PASS: Emoji inserts and dropdown closes

8. Click outside the emoji dropdown
   - ✅ PASS: Dropdown closes

---

### 4. File Upload Security & Warnings

**4A. Dangerous File Blocking (Client-Side)**

**Test Steps:**
1. Try to upload a file with dangerous extension:
   - Test files: `.exe`, `.bat`, `.ps1`, `.sh`, `.apk`, `.jar`
   
2. Click "File" button and select a `.exe` file (or create a dummy file)
   - ✅ PASS: Error message appears: "File type not allowed for security reasons: .exe"
   - ✅ PASS: File is NOT attached
   - ✅ PASS: Chat does not crash

3. Repeat with other dangerous extensions (`.bat`, `.ps1`, `.jar`, etc.)
   - ✅ PASS: All blocked file types show friendly error

**4B. Dangerous File Blocking (Server-Side)**

**Test Steps:**
1. Use browser dev tools or curl to bypass client validation
   ```bash
   # Example: try to upload blocked file directly to server
   curl -F "file=@malicious.exe" https://upload.ldawg7624.com/upload
   ```
   
2. Check server response:
   - ✅ PASS: Server returns JSON error with `success: false`
   - ✅ PASS: Error message includes file extension
   - ✅ PASS: Server does NOT save the file

**4C. Non-Image/Audio File Downloads**

**Test Steps:**
1. Upload a PDF file (or any non-image/audio file like `.txt`, `.zip`, `.docx`)
2. Send the file as a message
3. Observe the message bubble:
   - ✅ PASS: File name is displayed
   - ✅ PASS: File size and type (MIME) are shown
   - ✅ PASS: **"Download File"** button is present and clickable
   - ✅ PASS: Warning text appears below: "⚠️ This site does not scan files for malicious content. Only download files you trust."

4. Click the "Download File" button
   - ✅ PASS: Browser prompts to download the file
   - ✅ PASS: Downloaded file is intact and usable

5. Send a message with a PDF and a text caption
   - ✅ PASS: Caption appears above the file
   - ✅ PASS: Download button and warning are still present

**4D. Image Files (Verify No Regression)**

**Test Steps:**
1. Upload an image file (`.jpg`, `.png`, `.gif`)
2. Send the image
   - ✅ PASS: Image displays as thumbnail (NOT as download link)
   - ✅ PASS: No "Download File" button appears
   - ✅ PASS: No warning message appears
   - ✅ PASS: Clicking image opens full-size preview

**4E. Audio Files (Verify No Regression)**

**Test Steps:**
1. Record an audio message OR upload an audio file
2. Send the audio
   - ✅ PASS: Audio player appears with controls
   - ✅ PASS: No "Download File" button appears
   - ✅ PASS: No warning message appears
   - ✅ PASS: Audio plays correctly

---

### 5. Integration Tests (Verify Nothing Broke)

**Test Steps:**
1. Send a plain text message
   - ✅ PASS: Message sends and displays correctly

2. Send a text message with bold + emoji
   - ✅ PASS: Formatting works, emoji displays

3. Take a photo with camera button
   - ✅ PASS: Camera opens, capture works, photo sends

4. Upload an image with caption
   - ✅ PASS: Image displays, caption appears

5. Record a 5-second audio message
   - ✅ PASS: Recording works, audio sends and plays

6. Delete your own message
   - ✅ PASS: Delete button appears, message is removed

7. Try to send 3 messages rapidly (within 10 seconds)
   - ✅ PASS: Rate limiting works (3rd message blocked)

8. Switch to dark mode
   - ✅ PASS: All new elements (toolbar, warnings, buttons) have proper dark mode styling

9. Test on mobile/tablet (if possible)
   - ✅ PASS: Toolbar toggle and quick emojis are touch-friendly
   - ✅ PASS: File warnings are readable on small screens

---

## Expected Results Summary

✅ **All PASS**: Implementation is complete and working correctly  
⚠️ **Some FAIL**: Review failed tests and fix issues  
❌ **Many FAIL**: Significant issues, needs debugging

---

## Quick Smoke Test (2 minutes)

If you only have 2 minutes, test these critical items:

1. ✅ Toolbar is collapsed on fresh page load
2. ✅ Toolbar toggle button works and persists during session
3. ✅ Quick emojis (5 visible) work without opening dropdown
4. ✅ Trying to upload `.exe` file shows error (client-side block)
5. ✅ Uploading a PDF shows download button + warning
6. ✅ Images and audio still work normally (no regression)
7. ✅ Bold/italic formatting works in messages

---

## Notes for Testers

- **Browser Cache**: If changes don't appear, hard refresh with `Ctrl+Shift+R` (or `Cmd+Shift+R` on Mac)
- **Session vs Local Storage**: Session storage persists across refreshes but clears when all tabs close
- **File Types to Test**: Create dummy files if needed:
  - Linux/Mac: `touch test.exe test.pdf test.txt`
  - Windows: `echo test > test.exe` in PowerShell
- **Server Logs**: Check server console for blocked file attempts and errors

---

## Bug Reporting Template

If you find a bug, report it with:

```
**Issue**: [Brief description]
**Steps to Reproduce**:
1. [Step 1]
2. [Step 2]
**Expected**: [What should happen]
**Actual**: [What actually happened]
**Browser**: [Chrome/Firefox/Safari + version]
**Screenshot**: [If applicable]
```
