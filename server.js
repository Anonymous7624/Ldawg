"use strict";
/**
 * Tank Game Server (WS-only) — Option B
 * - Pure WebSocket game backend (no HTTP).
 * - Echoes ping->pong with same timestamp + player count (fixes "Disconnected").
 * - Uses client's id; broadcasts join/update/shoot/chat/kill/leave.
 * - Basic chat filtering hook + per-type rate limits.
 * - Kicks stale sockets (heartbeat).
 */

const WebSocket = require("ws");

const PORT = Number(process.env.PORT) || 8080;
const MAX_PAYLOAD = 16 * 1024;
const POSITION_LIMIT = 10000;

// Set a soft max; client UI treats 20 as 100%.
const MAX_PLAYERS_UI = 20;

// 👉 Add words you want filtered. (Leave empty if you’ll add later.)
const BAD_WORDS = [
  // "example1","example2"
];

// ---------------- State ----------------
const wss = new WebSocket.Server({ port: PORT, maxPayload: MAX_PAYLOAD });
const players = new Map();     // id -> { nickname, color, position:{x,y,z} }
const socketsById = new Map(); // id -> ws

// ---------------- Helpers ----------------
function safeNum(n) {
  return typeof n === "number" && isFinite(n) && Math.abs(n) <= POSITION_LIMIT;
}
function clampPos(p) {
  if (!p || typeof p !== "object") return null;
  const { x, y, z } = p;
  if (!safeNum(x) || !safeNum(y) || !safeNum(z)) return null;
  return { x, y, z };
}
function sanitizeText(s, max = 200) {
  if (typeof s !== "string") return "";
  return s.replace(/[\u0000-\u001F\u007F]/g, "").trim().slice(0, max);
}
function escapeRegex(s){ return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"); }
function filterMessage(s) {
  let out = sanitizeText(s, 200);
  for (const w of BAD_WORDS) {
    if (!w) continue;
    // simple word-boundary match; you can expand to leetspeak if you want
    const re = new RegExp(`\\b${escapeRegex(w)}\\b`, "gi");
    out = out.replace(re, (m) => {
      if (m.length <= 2) return "*".repeat(m.length);
      return m[0] + "*".repeat(m.length - 2) + m[m.length - 1];
    });
  }
  return out;
}
function broadcast(obj, exceptId) {
  const msg = JSON.stringify(obj);
  socketsById.forEach((ws, id) => {
    if (ws.readyState === WebSocket.OPEN && id !== exceptId) ws.send(msg);
  });
}
// Token-bucket rate limiter
function makeBucket(refillPerSec, capacity) {
  return { tokens: capacity, last: Date.now() / 1000, refillPerSec, capacity };
}
function takeToken(bucket) {
  const now = Date.now() / 1000;
  bucket.tokens = Math.min(bucket.capacity, bucket.tokens + (now - bucket.last) * bucket.refillPerSec);
  bucket.last = now;
  if (bucket.tokens >= 1) { bucket.tokens -= 1; return true; }
  return false;
}

// ---------------- Server ----------------
console.log(`🟢 WS server listening on ws://0.0.0.0:${PORT}`);

wss.on("connection", (ws) => {
  ws.isAlive = true;
  ws.on("pong", () => { ws.isAlive = true; });

  ws.rate = {
    update: makeBucket(30, 60), // ~30/s
    chat:   makeBucket(2, 4),   // ~2/s
    shoot:  makeBucket(3, 6),   // ~3/s
    other:  makeBucket(5, 10),
  };

  ws.on("message", (raw) => {
    if ((typeof raw === "string" && raw.length > MAX_PAYLOAD) ||
        (Buffer.isBuffer(raw) && raw.length > MAX_PAYLOAD)) return;

    let data;
    try { data = JSON.parse(raw.toString()); } catch { return; }
    const t = data?.type;
    if (typeof t !== "string") return;

    const bucket =
      t === "update" ? ws.rate.update :
      t === "chat"   ? ws.rate.chat   :
      t === "shoot"  ? ws.rate.shoot  :
                       ws.rate.other;

    if (!takeToken(bucket)) return;

    switch (t) {
      case "ping": {
        const ts = typeof data.timestamp === "number" ? data.timestamp : null;
        ws.send(JSON.stringify({ type: "pong", timestamp: ts, players: players.size }));
        break;
      }

      case "join": {
        const id = typeof data.id === "string" ? data.id.trim() : "";
        if (!id) return;
        const nickname = sanitizeText(data.nickname, 24);
        const color = (typeof data.color === "string" && /^#[0-9a-fA-F]{6}$/.test(data.color)) ? data.color.toLowerCase() : null;
        const position = clampPos(data.position);
        if (!nickname || !color || !position) return;

        // If same id already connected, kick the old one
        if (socketsById.has(id)) {
          try { socketsById.get(id).terminate(); } catch {}
          socketsById.delete(id);
        }
        ws.id = id;
        socketsById.set(id, ws);
        players.set(id, { nickname, color, position });

        // Send existing players to the newcomer
        players.forEach((p, pid) => {
          if (pid === id) return;
          ws.send(JSON.stringify({
            type: "join",
            id: pid,
            nickname: p.nickname,
            color: p.color,
            position: p.position,
          }));
        });

        // Announce this join to others
        broadcast({ type: "join", id, nickname, color, position }, id);

        // Welcome snapshot so UI can show player count immediately
        ws.send(JSON.stringify({ type: "welcome", players: players.size }));
        break;
      }

      case "update": {
        if (!ws.id || data.id !== ws.id) return;
        const pos = clampPos(data.position);
        const rot = typeof data.rotation === "number" && isFinite(data.rotation) ? data.rotation : null;
        if (!pos || rot === null) return;

        const p = players.get(ws.id);
        if (p) p.position = pos; // keep current for late joiners

        broadcast({ type: "update", id: ws.id, position: pos, rotation: rot }, ws.id);
        break;
      }

      case "shoot": {
        if (!ws.id || data.id !== ws.id) return;
        const pos = clampPos(data.position);
        const rot = typeof data.rotation === "number" && isFinite(data.rotation) ? data.rotation : null;
        const missileType = typeof data.missileType === "string" ? data.missileType : "bullet";
        if (!pos || rot === null) return;

        const nickname = players.get(ws.id)?.nickname || "Player";
        broadcast({ type: "shoot", id: ws.id, nickname, position: pos, rotation: rot, missileType }, ws.id);
        break;
      }

      case "chat": {
        if (!ws.id || data.id !== ws.id) return;
        const nickname = players.get(ws.id)?.nickname || "Player";
        const message = filterMessage(data.message || "");
        if (!message) return;

        const payload = { type: "chat", id: ws.id, nickname, message };
        // Send to everyone, including sender (so their global log updates)
        socketsById.forEach((sock) => {
          if (sock.readyState === WebSocket.OPEN) sock.send(JSON.stringify(payload));
        });
        break;
      }

      case "kill": {
        const killer = sanitizeText(data.killer, 24);
        const victim = sanitizeText(data.victim, 24);
        if (!killer || !victim) return;
        broadcast({ type: "kill", killer, victim }, null);
        break;
      }

      default:
        // ignore unknown
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

  ws.on("error", (err) => console.error("WS error:", err?.message || err));
});

// Heartbeat cleanup — removes dead sockets & notifies leave
const HEARTBEAT_MS = 30000;
const hb = setInterval(() => {
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
wss.on("close", () => clearInterval(hb));

console.log("✅ Ready for clients.");
