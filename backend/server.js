const http = require("http");
const express = require("express");
const path = require("path");
const dotenv = require("dotenv");
const cors = require("cors");
const morgan = require("morgan");
const connectDB = require("./config/db");
const seedAdmin = require("./config/seedAdmin");
const authRoutes = require("./routes/authRoutes");
const staffRoutes = require("./routes/staffRoutes");
const userRoutes = require("./routes/userRoutes");
const kycRoutes = require("./routes/kycRoutes");
const settingsRoutes = require("./routes/settingsRoutes");
const depositRoutes = require("./routes/depositRoutes");
const tradeRoutes = require("./routes/tradeRoutes");
const withdrawalRoutes = require("./routes/withdrawalRoutes");
const supportRoutes = require("./routes/supportRoutes");
const vipRoutes = require("./routes/vipRoutes");
const spotRoutes = require("./routes/spotRoutes");
const { serveMedia } = require("./controller/mediaController");
const { settleExpiredTrades } = require("./controller/tradeController");
const { init: initRealtime } = require("./ws/realtime");

dotenv.config();

const app = express();

function parseOrigins() {
  const raw = process.env.CLIENT_URL || "";
  const list = raw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  return list.length ? list : true;
}

const allowedOrigins = parseOrigins();

app.use(
  cors({
    origin(origin, cb) {
      if (!origin) return cb(null, true);
      if (allowedOrigins === true) return cb(null, true);
      if (allowedOrigins.includes(origin)) return cb(null, true);
      // Allow same-LAN private origins when CLIENT_URL includes a LAN host pattern
      try {
        const u = new URL(origin);
        const isPrivate =
          /^192\.168\./.test(u.hostname) ||
          /^10\./.test(u.hostname) ||
          /^172\.(1[6-9]|2\d|3[0-1])\./.test(u.hostname) ||
          u.hostname === "localhost" ||
          u.hostname === "127.0.0.1";
        if (isPrivate && process.env.ALLOW_LAN_CORS !== "false") {
          return cb(null, true);
        }
      } catch {
        // fall through
      }
      return cb(new Error(`CORS blocked for origin ${origin}`));
    },
    credentials: true,
  })
);
app.use(express.json({ limit: "10mb" }));
app.use(morgan("dev"));

app.get("/", (_req, res) => {
  res.json({ ok: true, msg: "Evios Trader API running" });
});

app.get("/api/health", (_req, res) => {
  res.json({ ok: true, status: "healthy" });
});

app.get("/api/media/:filename", serveMedia);

app.use("/api/auth", authRoutes);
app.use("/api/staff", staffRoutes);
app.use("/api/users", userRoutes);
app.use("/api/kyc", kycRoutes);
app.use("/api/settings", settingsRoutes);
app.use("/api/deposits", depositRoutes);
app.use("/api/trades", tradeRoutes);
app.use("/api/withdrawals", withdrawalRoutes);
app.use("/api/support", supportRoutes);
app.use("/api/vip", vipRoutes);
app.use("/api/spot", spotRoutes);

const PORT = process.env.PORT || 5000;
const HOST = process.env.HOST || "0.0.0.0";

async function start() {
  try {
    await connectDB();
    await seedAdmin();

    const server = http.createServer(app);
    initRealtime(server);

    server.listen(PORT, HOST, () => {
      console.log(`Server running on http://localhost:${PORT}`);
      if (HOST === "0.0.0.0") {
        const os = require("os");
        for (const ifaces of Object.values(os.networkInterfaces())) {
          for (const net of ifaces || []) {
            if (net.family === "IPv4" && !net.internal) {
              console.log(`  Network: http://${net.address}:${PORT}`);
            }
          }
        }
      }
      setInterval(() => {
        settleExpiredTrades().catch((err) => console.error("Trade settlement error:", err));
      }, 2000);
    });
  } catch (err) {
    console.error("Failed to start server:", err);
    process.exit(1);
  }
}

start();
