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
const { settleExpiredTrades } = require("./controller/tradeController");
const { init: initRealtime } = require("./ws/realtime");

dotenv.config();

const app = express();

const allowedOrigins = (process.env.CLIENT_URL)
  .split(",")
  .map((o) => o.trim())
  .filter(Boolean);

app.use(
  cors({
    origin: allowedOrigins,
    credentials: true,
  })
);
app.use(express.json({ limit: "10mb" }));
app.use("/uploads", cors(), express.static(path.join(__dirname, "uploads")));
app.use(morgan("dev"));

app.get("/", (_req, res) => {
  res.json({ ok: true, msg: "Crypto Haven API running" });
});

app.get("/api/health", (_req, res) => {
  res.json({ ok: true, status: "healthy" });
});

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
