"use strict";

const express = require("express");
const http = require("http");
const WebSocket = require("ws");
const path = require("path");
const crypto = require("crypto");

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ noServer: true, maxPayload: 16 * 1024, perMessageDeflate: false });
const PORT = Number(process.env.PORT) || 3000;
const HOST = "0.0.0.0";
const LANGUAGES = ["Tamil", "Malayalam", "Telugu", "Kannada", "Hindi", "English"];
const MAX_QUEUE_AGE_MS = 60_000;
const MAX_MESSAGES_PER_SECOND = 20;
const waiting = [];
const peers = new Map();

app.disable("x-powered-by");
app.use((_req, res, next) => {
  res.set({
    "X-Content-Type-Options": "nosniff",
    "Referrer-Policy": "no-referrer",
    "X-Frame-Options": "DENY",
    "Permissions-Policy": "camera=(self), microphone=(self), geolocation=()",
    "Cross-Origin-Opener-Policy": "same-origin",
    "Content-Security-Policy": "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; media-src 'self' blob:; connect-src 'self' ws: wss:; frame-ancestors 'none'; base-uri 'self'; form-action 'self'"
  });
  next();
});
app.use(express.static(path.join(__dirname, "public"), { etag: true, maxAge: "1h" }));
app.get("/health", (_req, res) => res.status(200).json({ ok: true, service: "minglely" }));
app.get("/ready", (_req, res) => res.status(200).json({ ok: true }));

function id() { return crypto.randomBytes(12).toString("hex"); }
function send(ws, type, data = {}) {
  if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify({ type, ...data }));
}
function removeFromQueue(user) {
  const i = waiting.indexOf(user);
  if (i !== -1) waiting.splice(i, 1);
}
function countryCompatible(a, b) {
  return a.country === "ANY" || b.country === "ANY" || a.country === b.country;
}
function baseCompatible(a, b) {
  return a !== b && a.mode === b.mode && countryCompatible(a, b) && a.room === null && b.room === null;
}
function findMatch(user) {
  const candidates = waiting.filter(other => baseCompatible(user, other));
  const sameLanguage = candidates.find(other => other.language === user.language);
  if (sameLanguage) return sameLanguage;
  const userCanExpand = Date.now() - user.queuedAt >= MAX_QUEUE_AGE_MS;
  const olderCandidate = candidates.find(other => Date.now() - other.queuedAt >= MAX_QUEUE_AGE_MS);
  return userCanExpand ? candidates[0] : olderCandidate || null;
}
function match(a, b) {
  removeFromQueue(a);
  removeFromQueue(b);
  const room = id();
  a.room = b.room = room;
  const common = a.interests.filter(x => b.interests.includes(x));
  const fallback = a.language !== b.language;
  send(a.ws, "matched", { room, initiator: true, language: b.language, fallback, common });
  send(b.ws, "matched", { room, initiator: false, language: a.language, fallback, common });
}
function partnerFor(user) {
  for (const other of peers.values()) if (other !== user && user.room && other.room === user.room) return other;
  return null;
}
function validOrigin(req) {
  const origin = req.headers.origin;
  if (!origin) return true;
  try {
    const parsed = new URL(origin);
    return parsed.host === req.headers.host && ["http:", "https:"].includes(parsed.protocol);
  } catch { return false; }
}

server.on("upgrade", (req, socket, head) => {
  let pathname;
  try { pathname = new URL(req.url, "http://localhost").pathname; } catch { socket.destroy(); return; }
  if ((pathname !== "/" && pathname !== "/ws") || !validOrigin(req)) {
    socket.write("HTTP/1.1 403 Forbidden\r\nConnection: close\r\n\r\n");
    socket.destroy();
    return;
  }
  wss.handleUpgrade(req, socket, head, ws => wss.emit("connection", ws, req));
});

wss.on("connection", ws => {
  const user = { ws, id: id(), mode: "text", language: "English", country: "ANY", interests: [], room: null, queuedAt: 0, messageTimes: [] };
  peers.set(ws, user);
  ws.isAlive = true;
  ws.on("pong", () => { ws.isAlive = true; });
  send(ws, "connected", { userId: user.id });

  ws.on("message", raw => {
    const now = Date.now();
    user.messageTimes = user.messageTimes.filter(time => now - time < 1000);
    if (user.messageTimes.length >= MAX_MESSAGES_PER_SECOND) {
      ws.close(1008, "Message rate exceeded");
      return;
    }
    user.messageTimes.push(now);
    let msg;
    try { msg = JSON.parse(raw.toString()); } catch { return; }
    if (!msg || typeof msg !== "object" || Array.isArray(msg) || typeof msg.type !== "string") return;

    if (msg.type === "queue") {
      removeFromQueue(user);
      if (user.room) {
        const partner = partnerFor(user);
        if (partner) { partner.room = null; send(partner.ws, "partner_left"); }
        user.room = null;
      }
      user.mode = msg.mode === "video" ? "video" : "text";
      user.language = LANGUAGES.includes(msg.language) ? msg.language : "English";
      user.country = typeof msg.country === "string" && msg.country.length <= 64 ? msg.country : "ANY";
      user.interests = Array.isArray(msg.interests) ? msg.interests.filter(x => typeof x === "string").slice(0, 5).map(x => x.slice(0, 40)) : [];
      user.queuedAt = Date.now();
      waiting.push(user);
      const other = findMatch(user);
      if (other) match(user, other);
      else send(ws, "searching", { language: user.language, fallbackIn: MAX_QUEUE_AGE_MS / 1000 });
      return;
    }

    if (msg.type === "leave") {
      removeFromQueue(user);
      const partner = partnerFor(user);
      user.room = null;
      if (partner) { partner.room = null; send(partner.ws, "partner_left"); }
      return;
    }

    const partner = partnerFor(user);
    if (!partner) return;
    if (msg.type === "chat") {
      if (typeof msg.text === "string") send(partner.ws, "chat", { text: msg.text.slice(0, 2000) });
    } else if (msg.type === "signal") {
      if (msg.data && typeof msg.data === "object" && !Array.isArray(msg.data)) send(partner.ws, "signal", { data: msg.data });
    } else if (msg.type === "typing") {
      send(partner.ws, "typing", { active: !!msg.active });
    } else if (msg.type === "report") {
      console.warn("REPORT", { from: user.id, reason: String(msg.reason || "unspecified").slice(0, 500) });
      send(ws, "reported");
    }
  });

  ws.on("close", () => {
    removeFromQueue(user);
    const partner = partnerFor(user);
    user.room = null;
    if (partner) { partner.room = null; send(partner.ws, "partner_left"); }
    peers.delete(ws);
  });
});

const heartbeat = setInterval(() => {
  for (const ws of wss.clients) {
    if (!ws.isAlive) { ws.terminate(); continue; }
    ws.isAlive = false;
    ws.ping();
  }
  const now = Date.now();
  for (const user of [...waiting]) {
    if (!peers.has(user.ws) || user.ws.readyState !== WebSocket.OPEN) { removeFromQueue(user); continue; }
    const other = findMatch(user);
    if (other) match(user, other);
    else if (now - user.queuedAt >= MAX_QUEUE_AGE_MS) send(user.ws, "searching", { language: user.language, fallbackIn: 0 });
  }
}, 15_000);

server.listen(PORT, HOST, () => console.log(`Minglely listening on ${HOST}:${PORT}`));
function shutdown() {
  clearInterval(heartbeat);
  for (const ws of wss.clients) ws.close(1001, "Server is restarting");
  server.close(() => process.exit(0));
  setTimeout(() => process.exit(1), 25_000).unref();
}
process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);
