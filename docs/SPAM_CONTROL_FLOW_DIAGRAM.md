# Two-Layer Spam Control Flow Diagram

## Message Flow Through Rate Limiter

```
┌─────────────────────────────────────────────────────────────────────┐
│                    USER SENDS MESSAGE                                │
│                   (text/image/audio/video/file)                      │
└─────────────────────────────┬───────────────────────────────────────┘
                              │
                              ▼
                    ┌─────────────────────┐
                    │  Get Client State   │
                    │    (by token)       │
                    └──────────┬──────────┘
                              │
                              ▼
              ┌───────────────────────────────┐
              │   Already Banned?             │
              │   (bannedUntil > now())       │
              └───────┬───────────────┬───────┘
                      │               │
                   YES│               │NO
                      │               │
                      ▼               ▼
              ┌──────────────┐  ┌────────────────────────────┐
              │ Send 'banned'│  │   LAYER 1: COOLDOWN       │
              │   message    │  │ Time since lastSendAt?     │
              │   REJECT ❌  │  └──────┬──────────────┬──────┘
              └──────────────┘         │              │
                                       │              │
                              < 750ms  │              │ >= 750ms
                                       │              │
                                       ▼              ▼
                          ┌────────────────────┐  ┌──────────────────────────┐
                          │ registerViolation  │  │   LAYER 2: WINDOW        │
                          │  ('COOLDOWN',...)  │  │ Messages in last 10s?    │
                          └────────┬───────────┘  └──────┬────────────┬──────┘
                                   │                     │            │
                                   ▼                     │            │
                          ┌────────────────┐         >= 5│            │< 5
                          │  Add Strike    │             │            │
                          │  Ban 15s/1m/5m │             ▼            ▼
                          └────────┬───────┘   ┌──────────────┐  ┌─────────────┐
                                   │           │ register     │  │  ALLOW      │
                                   │           │ Violation    │  │  MESSAGE ✅ │
                                   │           │('WINDOW',..) │  └──────┬──────┘
                                   │           └──────┬───────┘         │
                                   │                  │                 │
                                   ▼                  ▼                 ▼
                          ┌────────────────┐  ┌──────────────┐  ┌─────────────┐
                          │ Send 'banned'  │  │ Add Strike   │  │ Push to     │
                          │  message to    │  │ Ban 15s/etc  │  │ msgTimes[]  │
                          │   client       │  └──────┬───────┘  │ Update      │
                          │   REJECT ❌    │         │          │ lastSendAt  │
                          └────────────────┘         ▼          └──────┬──────┘
                                                ┌──────────────┐        │
                                                │ Send 'banned'│        │
                                                │  message     │        │
                                                │  REJECT ❌   │        │
                                                └──────────────┘        │
                                                                        ▼
                                                              ┌──────────────────┐
                                                              │  Save to DB      │
                                                              │  Broadcast to    │
                                                              │  all clients     │
                                                              │  Send ACK        │
                                                              └──────────────────┘
```

---

## Strike/Ban Escalation System

```
┌──────────────────────────────────────────────────────────────────────┐
│                        VIOLATION OCCURS                               │
│                   (COOLDOWN or WINDOW exceeded)                       │
└────────────────────────────────┬─────────────────────────────────────┘
                                 │
                                 ▼
                   ┌─────────────────────────┐
                   │  Current Stage?         │
                   └─────┬─────────────┬─────┘
                         │             │
                   Stage 0│             │Stage 1+
                         │             │
                         ▼             ▼
          ┌──────────────────────┐  ┌──────────────────────┐
          │  Increment Strikes   │  │  Increment Stage     │
          │  strikes++           │  │  stage++             │
          └──────────┬───────────┘  └──────────┬───────────┘
                     │                         │
                     ▼                         ▼
          ┌──────────────────────┐  ┌──────────────────────┐
          │  strikes >= 3?       │  │  Calculate Ban Time  │
          └──────┬──────────┬────┘  │  stage2: 5 min       │
                 │          │       │  stage3: 10 min      │
             YES │          │ NO    │  stage4: 15 min      │
                 │          │       │  stage5: 20 min      │
                 ▼          ▼       │  ...                 │
    ┌────────────────┐  ┌─────────┐└──────────┬───────────┘
    │ Escalate to    │  │ Ban 15s │           │
    │ Stage 1        │  │         │           ▼
    │ Reset strikes  │  └────┬────┘  ┌──────────────────┐
    │ Ban 60s        │       │       │ Ban for Duration │
    └────────┬───────┘       │       │ bannedUntil =    │
             │               │       │ now() + duration │
             ▼               ▼       └────────┬─────────┘
        ┌────────────────────────┐           │
        │  Log Violation         │◄──────────┘
        │  [RATE-LIMIT-BAN]      │
        │  Show: reason, details,│
        │  strikes/stage, ban    │
        └────────┬───────────────┘
                 │
                 ▼
        ┌─────────────────────┐
        │  Return Banned      │
        │  {muted: true,      │
        │   seconds: X}       │
        └─────────────────────┘
```

---

## State Tracking Structure

```
┌─────────────────────────────────────────────────────────────┐
│                    clientState Map                           │
│                   (indexed by token)                         │
└──────────────────────────┬──────────────────────────────────┘
                           │
                           ▼
               ┌───────────────────────┐
               │  token: "abc123..."   │
               └───────────┬───────────┘
                           │
                           ▼
        ┌──────────────────────────────────────────┐
        │  Client State Object:                    │
        ├──────────────────────────────────────────┤
        │  strikes: 0-2        (Stage 0 counter)   │
        │  stage: 0-N          (Escalation level)  │
        │  bannedUntil: 0      (Timestamp)         │
        │  msgTimes: []        (Last 5 timestamps) │
        │  lastSendAt: 0       (Last send time)    │
        └──────────────────────────────────────────┘

Example State Progression:

1. New User
   {strikes:0, stage:0, bannedUntil:0, msgTimes:[], lastSendAt:0}

2. After 1st violation (COOLDOWN)
   {strikes:1, stage:0, bannedUntil:1734800015000, msgTimes:[...], lastSendAt:1734800000000}
   ↓ (15s ban)

3. After 2nd violation (WINDOW)
   {strikes:2, stage:0, bannedUntil:1734800030000, msgTimes:[...], lastSendAt:1734800015000}
   ↓ (15s ban)

4. After 3rd violation → ESCALATE
   {strikes:0, stage:1, bannedUntil:1734800090000, msgTimes:[...], lastSendAt:1734800030000}
   ↓ (60s ban)

5. After 4th violation → ESCALATE
   {strikes:0, stage:2, bannedUntil:1734800390000, msgTimes:[...], lastSendAt:1734800090000}
   ↓ (5 min ban)

6. After 5th violation → ESCALATE
   {strikes:0, stage:3, bannedUntil:1734800990000, msgTimes:[...], lastSendAt:1734800390000}
   ↓ (10 min ban)

... continues growing by 5 min increments ...
```

---

## Message Type Routing

```
                    ┌─────────────────────┐
                    │  Message Received   │
                    └──────────┬──────────┘
                               │
                               ▼
                    ┌──────────────────────┐
                    │  Check message.type  │
                    └──────────┬───────────┘
                               │
           ┌───────────────────┼───────────────────┐
           │                   │                   │
           ▼                   ▼                   ▼
    ┌────────────┐    ┌──────────────┐    ┌─────────────┐
    │  BYPASS    │    │ RATE LIMITED │    │  BYPASS     │
    │  TYPES     │    │    TYPES     │    │  TYPES      │
    └────┬───────┘    └──────┬───────┘    └─────┬───────┘
         │                   │                   │
         ▼                   ▼                   ▼
    - typing           - text              - delete
    - presence         - image             - ping/ack
    - online           - audio             - history
                       - video
                       - file
         │                   │                   │
         ▼                   ▼                   ▼
    ┌────────────┐    ┌──────────────┐    ┌─────────────┐
    │  Process   │    │ checkRateLimit│   │  Process    │
    │  Directly  │    │ (2 layers)    │   │  Directly   │
    └────────────┘    └──────┬────────┘   └─────────────┘
                             │
                 ┌───────────┼──────────┐
                 │                      │
              BLOCKED                ALLOWED
                 │                      │
                 ▼                      ▼
         ┌──────────────┐      ┌──────────────┐
         │ Send 'banned'│      │  Process &   │
         │   message    │      │  Broadcast   │
         └──────────────┘      └──────────────┘
```

---

## Timestamp Pruning (Sliding Window)

```
Time: ───────────────────────────────────────────────►

Window:          |←──── 10 seconds ────→|
                                        NOW

msgTimes:   [t1]  [t2]  [t3]     [t4]  [t5]  [t6?]
            ─────────────────────────────────────
Status:      OLD   OLD   KEEP    KEEP  KEEP  NEW

Pruning:
1. Calculate: now() - ts < 10000ms
2. Keep only: t3, t4, t5
3. Check: count(t3,t4,t5) + 1 > 5?
4. If NO: Add t6, allow message
5. If YES: Violation, ban user


Example with actual times:

now() = 1734800100000 (100s)

msgTimes = [
  1734800085000,  // 15s ago - PRUNED
  1734800088000,  // 12s ago - PRUNED
  1734800091000,  //  9s ago - KEEP
  1734800094000,  //  6s ago - KEEP
  1734800097000,  //  3s ago - KEEP
]

After prune: [1734800091000, 1734800094000, 1734800097000]
Count: 3 < 5 ✅ OK, can add 4th message

After add: [1734800091000, 1734800094000, 1734800097000, 1734800100000]
Count: 4 < 5 ✅ Still OK
```

---

## Cooldown Check (Time Delta)

```
Timeline:
─────────────────────────────────────────────────►
         lastSendAt                   now()
              │                          │
              │◄────── timeDelta ───────→│
              │                          │
         t=1000ms                    t=1650ms

timeDelta = now() - lastSendAt
         = 1650 - 1000
         = 650ms

Check: 650ms < 750ms? YES → VIOLATION ❌


Example: ALLOWED
lastSendAt = 1734800100000
now()      = 1734800100800  (800ms later)
delta      = 800ms
Check: 800 < 750? NO → ALLOWED ✅


Example: BLOCKED
lastSendAt = 1734800100000
now()      = 1734800100500  (500ms later)
delta      = 500ms
Check: 500 < 750? YES → VIOLATION ❌
```

---

## Performance Characteristics

```
┌─────────────────────────────────────────────────────┐
│  Operation              │ Time      │ Space         │
├─────────────────────────┼───────────┼───────────────┤
│  Check if banned        │ O(1)      │ O(1)         │
│  Cooldown check         │ O(1)      │ O(1)         │
│  Prune msgTimes         │ O(n)      │ O(1)         │
│  Window check           │ O(1)      │ O(1)         │
│  Register violation     │ O(1)      │ O(1)         │
├─────────────────────────┼───────────┼───────────────┤
│  Total per message      │ O(n)      │ O(1)         │
│  where n ≤ 5 (constant) │ ≈ O(1)    │              │
└─────────────────────────┴───────────┴───────────────┘

Memory per user:
- strikes: 4 bytes (int)
- stage: 4 bytes (int)
- bannedUntil: 8 bytes (timestamp)
- lastSendAt: 8 bytes (timestamp)
- msgTimes: 5 × 8 = 40 bytes (5 timestamps)
───────────────────────────
Total: ~64 bytes per user

For 1000 concurrent users: 64KB
For 10000 users: 640KB
Negligible memory footprint ✅
```

---

## Legend

```
✅ = Allowed / Success
❌ = Blocked / Failure
─► = Flow direction
│  = Process continues
▼  = Next step
◄─ = Time/data flow
```

---

## Quick Reference

| Component | Value | Purpose |
|-----------|-------|---------|
| RATE_LIMIT_COOLDOWN | 750ms | Min time between sends |
| RATE_LIMIT_WINDOW | 10000ms | Sliding window duration |
| RATE_LIMIT_MESSAGES | 5 | Max messages per window |
| Strike ban | 15s | Stage 0 ban duration |
| Stage 1 ban | 60s | After 3 strikes |
| Stage 2+ ban | 5min+ | Escalating by 5min |

---

This visual guide complements the technical documentation and provides
a clear understanding of how messages flow through the two-layer spam
control system.
