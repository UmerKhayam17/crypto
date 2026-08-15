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

async function applyAuth(ws, token) {
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
  send(ws, "connected", { role: meta.role, userId: meta.userId });
  return meta;
}

function init(httpServer) {
  const wss = new WebSocketServer({ server: httpServer, path: "/ws" });

  wss.on("connection", async (ws, req) => {
    // Prefer post-connect auth message so JWT is not left in proxy/access logs via query string.
    // Query token still accepted for older clients.
    const url = new URL(req.url || "/ws", "http://localhost");
    const queryToken = url.searchParams.get("token");

    ws.meta = { role: "guest", userId: null };
    clients.add(ws);

    if (queryToken) {
      await applyAuth(ws, queryToken);
    } else {
      send(ws, "connected", { role: "guest", userId: null, awaitAuth: true });
    }

    ws.on("message", async (raw) => {
      try {
        const msg = JSON.parse(String(raw));
        if (msg?.type === "auth" && typeof msg.token === "string") {
          await applyAuth(ws, msg.token);
        }
      } catch {
        // ignore malformed
      }
    });

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

      if (deliver) {
        let out = payload;
        if (type === "user:updated" && meta.role === "user" && payload?.user) {
          const { forceOutcome, profitPercent, lossPercent, ...safeUser } = payload.user;
          out = { ...payload, user: safeUser };
        }
        if (type === "trade:upsert" && meta.role === "user" && payload?.trade) {
          const {
            outcomeSource,
            plannedOutcome,
            customProfitPercent,
            customLossPercent,
            ...safeTrade
          } = payload.trade;
          // Keep lossLocked so the user can see an adverse market lock before expiry
          out = { ...payload, trade: safeTrade };
        }
        send(ws, type, out);
      }
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
