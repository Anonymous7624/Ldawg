# Admin User Guide - Kennedy Chat

## Getting Started

### Sign In
1. Go to https://ldawg7624.com
2. Click **Sign in** button in left sidebar
3. Enter credentials:
   - **Email**: luccapo@bmchsd.org
   - **Password**: Password123
4. You'll see "Signed in as: Ldawg (admin)"

### Admin Interface
After signing in, you'll see:
- **Admin Panel** button (in sidebar)
- **Settings** button (in sidebar)
- **Log out** button (in sidebar)
- Collapse button (top-right of sidebar)

## Admin Panel Features

Click **Admin Panel** to open the control panel from the right side.

### 1. Chat Controls

#### Lock Chat
Toggle switch to lock/unlock chat:
- **ON** (Green): Only you can send messages
  - All other users (including moderators) are blocked
  - They see "Chat is locked by admin" message
  - Use for announcements or emergency situations
- **OFF** (Gray): Normal chat operation

#### Delete All Chats & Uploads
Red button that wipes everything:
- **CAUTION**: This action cannot be undone!
- Deletes all messages from database
- Deletes all uploaded files (images, videos, audio, files)
- Does NOT delete user accounts
- Use for: starting fresh, removing all content
- Requires double confirmation

### 2. Message Display Modes

Dropdown menu to change how YOUR messages appear:

#### Normal Mode (Default)
- Regular appearance
- Your nickname shows normally
- Standard text size and color

#### Admin Mode
- Label shows: **Admin** (instead of your nickname)
- Text: **GOLD color**
- Size: **150% larger**
- Use for: official announcements, moderation actions

#### SERVER Mode
- Label shows: **SERVER**
- Text: **RED color**
- Size: **150% larger**
- Use for: system announcements, important alerts

#### Custom Mode
- Enter any display name you want
- Text: **GOLD color**
- Size: Normal
- Example: Type "Ldawg" to show that name with gold text
- Use for: personalized messaging while maintaining authority

**Note**: Your messages are NOT filtered for profanity in any mode.

### 3. Reports

Shows live list of user-submitted reports:

Each report displays:
- Reporter's nickname
- Time of report
- Reported message content
- Sender's nickname
- Reason for report

**Actions per report**:
- **Dismiss**: Remove from list, no action taken
- **Delete Msg**: Delete the reported message for everyone
- **Ban User**: Opens ban duration menu (see below)

Counter badge shows number of active reports.

## Message Actions

### Admin Menu on Every Message

Hover over any message to see action menu (top-right):
- **Delete**: Remove message for everyone (instant)
- **Ban**: Ban the message sender

### Delete Any Message
1. Hover over message
2. Click **Delete** in menu
3. Message removed immediately for all users
4. No confirmation required (be careful!)

### Ban Users

1. Click **Ban** in message menu (or from a report)
2. Select ban duration:
   - **30 seconds**: Quick timeout
   - **1 minute**: Minor violation
   - **10 minutes**: Moderate violation
   - **1 hour**: Serious violation
   - **1 day**: Maximum ban (24 hours)
3. User is immediately blocked from sending messages
4. When banning from message menu, the message is automatically deleted
5. User sees "You have been banned by admin for X seconds"
6. Ban expires automatically after duration

**Note**: Bans are cookie-based (anonymous users). They persist across page reloads.

## Settings

Click **Settings** button in sidebar.

### Change Username
1. Enter new username in first field
2. Click **Update Username**
3. Requirements:
   - 3-30 characters
   - Letters, numbers, and underscores only
   - Must be unique (not taken by another user)
4. Success message appears
5. Your display name updates immediately

### Change Password
1. Enter current password
2. Enter new password (minimum 6 characters)
3. Click **Update Password**
4. Success message appears
5. You stay logged in
6. Use new password for next login

**Note**: You can change username and password unlimited times.

## Sidebar

### Collapse/Expand
Click the toggle button (◀/▶) in top-right of sidebar:
- **Collapsed**: Sidebar shrinks to 60px (icon-only width)
- **Expanded**: Full sidebar with text and buttons

Useful for:
- More screen space for chat
- Cleaner interface when not actively managing

## Best Practices

### When to Lock Chat
- Making important announcements
- Handling serious moderation issues
- Preventing spam during incidents
- Temporarily stopping conversation for cleanup

### When to Delete Messages
- Spam or repeated violations
- Harmful/dangerous content
- Severe profanity or harassment
- Illegal content
- Personal information (doxxing)

### Ban Duration Guidelines
- **30s-1min**: First-time minor violations, testing boundaries
- **10min**: Repeated violations, moderate harassment
- **1 hour**: Serious violations, multiple warnings ignored
- **1 day**: Severe violations, threats, extreme behavior

### Using Display Modes
- **Admin mode**: Official rules, policy announcements
- **SERVER mode**: System-level announcements, critical alerts
- **Custom mode**: Personal leadership messages with authority
- **Normal mode**: Casual conversation while monitoring

### Handling Reports
1. Read the report and context
2. Review the reported message
3. Decide action:
   - False report → Dismiss
   - Minor issue → Delete message only
   - Moderate issue → Delete + short ban
   - Serious issue → Delete + long ban

## Common Scenarios

### Spam Attack
1. Lock chat immediately (toggle in Admin Panel)
2. Delete spam messages (click Delete on each)
3. Ban spammer (1 hour or 1 day)
4. Unlock chat when clear

### Inappropriate Content
1. Delete the message immediately
2. Ban user (duration based on severity)
3. If multiple users involved, handle each separately
4. Consider announcement about behavior expectations

### Making Announcement
1. Optional: Lock chat to prevent interruptions
2. Select **SERVER** or **Admin** mode
3. Send your announcement
4. Unlock chat (if locked)

### Starting Fresh
1. Consider backing up if needed (ask developer)
2. Click **Delete All Chats & Uploads**
3. Confirm twice (THIS CANNOT BE UNDONE)
4. All messages and files deleted
5. Chat continues from clean slate

### Handling False Reports
1. Review the reported message
2. Verify it doesn't violate rules
3. Click **Dismiss** to remove report
4. No action taken against reported user

## Tips & Tricks

### Quick Actions
- **Hover** over messages to see admin menu
- **Right-click** on ban button for different user actions
- **Toggle sidebar** for more chat space

### Efficiency
- Handle reports in batches when online
- Use short bans first, escalate if needed
- Delete first, then ban if necessary
- Lock chat for cleanup, then unlock

### Communication
- Use **SERVER** mode for important announcements
- Use **Admin** mode for moderation actions
- Use **Custom** mode for approachable leadership
- Use **Normal** mode for community participation

### Monitor Without Interference
- Stay in Normal mode while observing
- Switch to admin modes only when taking action
- Collapse sidebar to focus on chat content
- Use reports to catch issues you missed

## What You CAN'T Do

- Unban users (bans expire automatically)
- Edit messages (only delete)
- See user IP addresses or personal info
- Delete other admin/moderator messages (same powers)
- Recover deleted messages (permanent deletion)
- Restore wiped chat history (permanent wipe)

## Support

If you encounter issues:
1. Try logging out and back in
2. Clear browser cache (Ctrl+Shift+Delete)
3. Try a different browser
4. Check if servers are running (ask developer)
5. Report any bugs or unexpected behavior

## Log Out

Click **Log out** button in sidebar:
- Clears your session
- Returns to guest view
- Removes admin interface
- Sign in again to resume admin access

---

**Remember**: With great power comes great responsibility. Use admin features fairly and consistently. Your actions affect the entire community.
