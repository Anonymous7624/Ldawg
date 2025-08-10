"use strict";

/**
 * 3D Tank Game — Robust WebSocket Server
 * --------------------------------------
 * - Express serves the client files from the same directory.
 * - WebSocket server shares the same HTTP server (works with Cloudflare Tunnel).
 * - Deduplicates by player id (kicks old socket when same id reconnects).
 * - Validates and clamps incoming data to prevent crashes/spoofing.
 * - Heartbeat to clean up dead sockets (no ghost tanks).
 * - Simple token-bucket rate limiting for updates/chat/shoot.
 * - Echo-based latency: client sends {timestamp}, server replies with same value.
 */

const path = require("path");
const express = require("express");
const http = require("http");
const WebSocket = require("ws");

// -------------------- Config --------------------
const PORT = Number(process.env.PORT) || 8080;
const HOST = process.env.HOST || "0.0.0.0";
const PUBLIC_DIR = process.env.PUBLIC_DIR || __dirname;

// Max message size in bytes (protect against abuse)
const MAX_MSG_BYTES = 16 * 1024; // 16KB

// Map/world constraints (sanity bounds)
const POSITION_LIMIT = 10000; // absolute max |x|,|y|,|z| accepted

// Rate limits (token bucket) per socket
const LIMITS = {
  update: { refillPerSec: 30, capacity: 60 }, // movement updates
  chat:   { refillPerSec: 1.5, capacity: 3 }, // chat bursts
  shoot:  { refillPerSec: 3, capacity: 6 },   // fire rate bursts
  other:  { refillPerSec: 5, capacity: 10 },  // misc messages
};

// -------------------- HTTP + Static --------------------
const app = express();

// Lightweight health check
app.get("/healthz", (_req, res) => res.status(200).json({ ok: true }));

// Serve your game files (index.html, textures, etc.)
app.use(express.static(PUBLIC_DIR, {
  etag: true,
  lastModified: true,
  maxAge: "1h",
}));

const server = http.createServer(app);

// -------------------- WebSocket --------------------
const wss = new WebSocket.Server({
  server,
  // You can tighten this if needed:
  // verifyClient: (info, done) => { done(true); },
  maxPayload: MAX_MSG_BYTES,
});

// In-memory state
const players = new Map();   // id -> { nickname, color, position: {x,y,z} }
const socketsById = new Map(); // id -> ws

// -------------------- Utilities --------------------
function getIP(req) {
  const xf = req.headers["x-forwarded-for"];
  if (typeof xf === "string") return xf.split(",")[0].trim();
  return req.socket.remoteAddress || "unknown";
}

function safeNum(n) {
  return typeof n === "number" && isFinite(n) && Math.abs(n) <= POSITION_LIMIT;
}

function clampPos(p) {
  if (typeof p !== "object" || p === null) return null;
  const { x, y, z } = p;
  if (!safeNum(x) || !safeNum(y) || !safeNum(z)) return null;
  return { x, y, z };
}

function normalizeColor(c) {
  if (typeof c !== "string") return null;
  let s = c.trim();
  if (s[0] !== "#") s = "#" + s;
  if (!/^#[0-9a-fA-F]{6}$/.test(s)) return null;
  return s.toLowerCase();
}

function sanitizeText(s, max = 200) {
  if (typeof s !== "string") return "";
  const trimmed = s.replace(/[\u0000-\u001F\u007F]/g, "").trim();
  return trimmed.slice(0, max);
}

function nowSec() {
  return Date.now() / 1000;
}

function makeBucket({ refillPerSec, capacity }) {
  return { tokens: capacity, last: nowSec(), refillPerSec, capacity };
}

function takeToken(bucket) {
  const t = nowSec();
  const delta = t - bucket.last;
  bucket.tokens = Math.min(bucket.capacity, bucket.tokens + delta * bucket.refillPerSec);
  bucket.last = t;
  if (bucket.tokens >= 1) {
    bucket.tokens -= 1;
    return true;
  }
  return false;
}

function broadcast(obj, exceptId) {
  const msg = JSON.stringify(obj);
  wss.clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN && client.id !== exceptId) {
      client.send(msg);
    }
  });
}

// -------------------- Connection Handling --------------------
wss.on("connection", (ws, req) => {
  ws.ip = getIP(req);
  ws.isAlive = true;

  // Per-socket rate limit buckets
  ws.buckets = {
    update: makeBucket(LIMITS.update),
    chat:   makeBucket(LIMITS.chat),
    shoot:  makeBucket(LIMITS.shoot),
    other:  makeBucket(LIMITS.other),
  };

  ws.on("pong", () => { ws.isAlive = true; });

  ws.on("message", (raw) => {
    // Basic size guard (ws maxPayload also protects)
    if (typeof raw === "string" && raw.length > MAX_MSG_BYTES) return;
    if (Buffer.isBuffer(raw) && raw.length > MAX_MSG_BYTES) return;

    let data;
    try {
      data = JSON.parse(raw.toString());
    } catch {
      return; // ignore bad JSON
    }

    const t = data?.type;
    if (typeof t !== "string") return;

    // Gate by type for rate limits
    const bucket =
      t === "update" ? ws.buckets.update :
      t === "chat"   ? ws.buckets.chat   :
      t === "shoot"  ? ws.buckets.shoot  :
                       ws.buckets.other;

    if (!takeToken(bucket)) {
      // Too fast; silently drop to keep gameplay smooth
      return;
    }

    switch (t) {
      case "join": {
        // Validate id/nickname/color/position
        const id = typeof data.id === "string" ? data.id.trim() : "";
        if (id.length < 3 || id.length > 40) return;

        const nickname = sanitizeText(data.nickname, 24);
        const color = normalizeColor(data.color);
        const position = clampPos(data.position);
        if (!nickname || !color || !position) return;

        // Kick any existing socket with same id
        if (socketsById.has(id)) {
          try { socketsById.get(id).terminate(); } catch {}
          socketsById.delete(id);
        }

        ws.id = id;
        socketsById.set(id, ws);
        players.set(id, { nickname, color, position });

        // Send all existing players to the newcomer
        for (const [pid, p] of players.entries()) {
          if (pid === id) continue;
          ws.send(JSON.stringify({
            type: "join",
            id: pid,
            nickname: p.nickname,
            color: p.color,
            position: p.position,
          }));
        }

        // Announce this join to everyone else
        broadcast({
          type: "join",
          id,
          nickname,
          color,
          position,
        }, id);

        // Welcome snapshot (no timestamp/id)
        ws.send(JSON.stringify({
          type: "welcome",
          players: players.size,
        }));

        break;
      }

      case "ping": {
        // Echo back the client-provided timestamp so client can compute RTT
        // (Do not require id here; keep lightweight)
        const ts = typeof data.timestamp === "number" ? data.timestamp : null;
        ws.send(JSON.stringify({
          type: "pong",
          timestamp: ts,
          players: players.size,
        }));
        break;
      }

      case "update": {
        // Only accept updates from authenticated sockets, and only for themselves
        if (!ws.id || data.id !== ws.id) return;

        const pos = clampPos(data.position);
        const rot = typeof data.rotation === "number" && isFinite(data.rotation) ? data.rotation : null;
        if (!pos || rot === null) return;

        // Update server-side state (minimal snapshot)
        const p = players.get(ws.id);
        if (p) p.position = pos;

        // Relay to everyone else
        broadcast({
          type: "update",
          id: ws.id,
          position: pos,
          rotation: rot,
        }, ws.id);
        break;
      }

      case "shoot": {
        if (!ws.id || data.id !== ws.id) return;

        const pos = clampPos(data.position);
        const rot = typeof data.rotation === "number" && isFinite(data.rotation) ? data.rotation : null;
        const missileType = typeof data.missileType === "string" ? data.missileType : "bullet";
        if (!pos || rot === null) return;

        broadcast({
          type: "shoot",
          id: ws.id,
          nickname: players.get(ws.id)?.nickname || "Player",
          position: pos,
          rotation: rot,
          missileType,
        }, ws.id);
        break;
      }

      case "chat": {
        if (!ws.id || data.id !== ws.id) return;

        const nickname = players.get(ws.id)?.nickname || "Player";
        const message = sanitizeText(data.message, 200);
        if (!message) return;

        broadcast({
          type: "chat",
          id: ws.id,
          nickname,
          message,
        }, null); // send to everyone including sender (so they see it in global log)
        break;
      }

      case "kill": {
        // kill announcements do not need id; validate strings to avoid junk
        const killer = sanitizeText(data.killer, 24);
        const victim = sanitizeText(data.victim, 24);
        if (!killer || !victim) return;

        broadcast({
          type: "kill",
          killer,
          victim,
        }, null);
        break;
      }

      default:
        // Ignore unknown types
        break;
    }
  });

  ws.on("close", () => {
    if (ws.id) {
      socketsById.delete(ws.id);
      if (players.has(ws.id)) {
        players.delete(ws.id);
        broadcast({ type: "leave", id: ws.id }, ws.id);
      }
    }
  });

  ws.on("error", (err) => {
    // Keep logs minimal on Pi
    console.error("[ws error]", err?.message || err);
  });
});

// Heartbeat: clean up dead sockets every 30s
const HEARTBEAT_MS = 30000;
const heartbeat = setInterval(() => {
  wss.clients.forEach((ws) => {
    if (ws.isAlive === false) {
      if (ws.id) {
        socketsById.delete(ws.id);
        if (players.has(ws.id)) {
          players.delete(ws.id);
          broadcast({ type: "leave", id: ws.id }, ws.id);
        }
      }
      try { ws.terminate(); } catch {}
      return;
    }
    ws.isAlive = false;
    try { ws.ping(); } catch {}
  });
}, HEARTBEAT_MS);

wss.on("close", () => clearInterval(heartbeat));

// -------------------- Start Server --------------------
server.listen(PORT, HOST, () => {
  console.log(`🚀 Server listening on http://${HOST}:${PORT}`);
  console.log(`📦 Serving static files from: ${PUBLIC_DIR}`);
});
