const { WebSocketServer } = require("ws");
const jwt = require("jsonwebtoken");
const User = require("../model/User");
const normalizeId = require("../utils/normalizeId");

/** @type {Set<import('ws').WebSocket & { meta?: ClientMeta }>} */
const clients = new Set();

/**
 * @typedef {{ role: 'guest' | 'user' | 'staff' | 'admin'; userId: string | null }} ClientMeta
 */

function parseToken(token) {
  if (!token) return null;
  try {
    const secret = process.env.JWT_SECRET;
    if (!secret) return null;
    return jwt.verify(token, secret);
  } catch {
    return null;
  }
}

function send(ws, type, payload) {
  if (ws.readyState === 1) {
    ws.send(JSON.stringify({ type, payload, at: Date.now() }));
  }
}

function init(httpServer) {
  const wss = new WebSocketServer({ server: httpServer, path: "/ws" });

  wss.on("connection", async (ws, req) => {
    const url = new URL(req.url || "/ws", "http://localhost");
    const token = url.searchParams.get("token");
    const decoded = parseToken(token);

    /** @type {ClientMeta} */
    const meta = { role: "guest", userId: null };

    if (decoded?.id) {
      try {
        const user = await User.findById(decoded.id);
        if (user && !user.suspended) {
          meta.role = user.role;
          meta.userId = user._id.toString();
        }
      } catch {
        // stay guest
      }
    }

    ws.meta = meta;
    clients.add(ws);

    send(ws, "connected", { role: meta.role, userId: meta.userId });

    ws.on("close", () => clients.delete(ws));
    ws.on("error", () => clients.delete(ws));
  });

  console.log("WebSocket server ready at /ws");
  return wss;
}

async function getAssignedStaffId(userId) {
  const id = normalizeId(userId);
  if (!id) return null;
  const user = await User.findById(id).select("assignedStaff");
  return user?.assignedStaff?.toString() || null;
}

/**
 * @param {'public' | 'user' | 'staff-admin' | 'admin'} scope
 */
async function emit(type, payload, { userId = null, scope = "user" } = {}) {
  try {
    const normalizedUserId = normalizeId(userId);
    let assignedStaffId = null;
    if (normalizedUserId && (scope === "user" || scope === "staff-admin")) {
      assignedStaffId = await getAssignedStaffId(normalizedUserId);
    }

    for (const ws of clients) {
      const meta = ws.meta || { role: "guest", userId: null };
      let deliver = false;

      if (scope === "public") {
        deliver = true;
      } else if (meta.role === "admin") {
        deliver = true;
      } else if (scope === "admin") {
        deliver = meta.role === "admin";
      } else if (scope === "staff-admin") {
        deliver = meta.role === "admin" || meta.role === "staff";
      } else if (
        meta.role === "staff" &&
        normalizedUserId &&
        assignedStaffId &&
        meta.userId === assignedStaffId
      ) {
        deliver = true;
      } else if (meta.role === "user" && normalizedUserId && meta.userId === normalizedUserId) {
        deliver = true;
      }

      if (deliver) send(ws, type, payload);
    }
  } catch (err) {
    console.error("Realtime emit error:", err);
  }
}

module.exports = {
  init,
  emit,
  emitPublic: (type, payload) => emit(type, payload, { scope: "public" }),
  emitUserScoped: (type, payload, userId) => emit(type, payload, { userId, scope: "user" }),
  emitStaffAdmin: (type, payload) => emit(type, payload, { scope: "staff-admin" }),
  emitAdmin: (type, payload) => emit(type, payload, { scope: "admin" }),
};
