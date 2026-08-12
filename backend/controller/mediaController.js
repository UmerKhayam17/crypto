const path = require("path");
const fs = require("fs");
const jwt = require("jsonwebtoken");
const User = require("../model/User");
const Deposit = require("../model/Deposit");
const SupportMessage = require("../model/SupportMessage");
const SupportThread = require("../model/SupportThread");

const uploadDir = path.join(__dirname, "..", "uploads");

function filenameFromUrl(url) {
  if (!url || typeof url !== "string") return null;
  const parts = url.split(/\/(?:api\/media|uploads)\//);
  if (parts.length < 2) return null;
  return parts[1].split(/[?#]/)[0] || null;
}

async function canAccessSupportFile(user, filename) {
  if (!filename.startsWith("support-")) return false;

  const msg = await SupportMessage.findOne({
    image: { $regex: `${filename.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$` },
  }).select("thread senderId");
  if (!msg) return false;

  const thread = await SupportThread.findById(msg.thread).populate("user", "assignedStaff");
  if (!thread) return false;

  if (user.role === "admin") return true;

  const ownerId = thread.user?._id?.toString?.() || thread.user?.toString?.();
  if (user.role === "user") {
    return ownerId === user._id.toString();
  }

  if (user.role === "staff") {
    const assigned = thread.user?.assignedStaff?.toString?.() || null;
    return !!assigned && assigned === user._id.toString();
  }

  return false;
}

async function canAccessFile(user, filename) {
  if (!user || !filename) return false;
  if (user.role === "admin") return true;

  if (filename.startsWith("support-")) {
    return canAccessSupportFile(user, filename);
  }

  if (user.role === "staff") {
    const assigned = await User.find({ role: "user", assignedStaff: user._id }).select("kyc");
    for (const row of assigned) {
      const k = row.kyc || {};
      if ([k.cnicFront, k.cnicBack, k.face].some((url) => filenameFromUrl(url) === filename)) {
        return true;
      }
    }
    const deposits = await Deposit.find({
      user: { $in: assigned.map((row) => row._id) },
    }).select("screenshot");
    if (deposits.some((d) => filenameFromUrl(d.screenshot) === filename)) return true;
    return canAccessSupportFile(user, filename);
  }

  if (user.role === "user") {
    const k = user.kyc || {};
    if ([k.cnicFront, k.cnicBack, k.face].some((url) => filenameFromUrl(url) === filename)) {
      return true;
    }
    const deposits = await Deposit.find({ user: user._id }).select("screenshot");
    if (deposits.some((d) => filenameFromUrl(d.screenshot) === filename)) return true;
    return canAccessSupportFile(user, filename);
  }

  return false;
}

exports.serveMedia = async (req, res) => {
  try {
    const filename = path.basename(req.params.filename || "");
    if (!filename || filename.includes("..")) {
      return res.status(400).json({ ok: false, msg: "Invalid file" });
    }

    const header = req.headers.authorization;
    let token = header?.startsWith("Bearer ") ? header.split(" ")[1] : null;
    if (!token && req.query.token) token = String(req.query.token);

    if (!token) {
      return res.status(401).json({ ok: false, msg: "Authentication required" });
    }

    const secret = process.env.JWT_SECRET;
    if (!secret) return res.status(500).json({ ok: false, msg: "Server misconfiguration" });

    let decoded;
    try {
      decoded = jwt.verify(token, secret);
    } catch {
      return res.status(401).json({ ok: false, msg: "Invalid token" });
    }

    const user = await User.findById(decoded.id);
    if (!user || user.suspended) {
      return res.status(401).json({ ok: false, msg: "Not authorized" });
    }

    const allowed = await canAccessFile(user, filename);
    if (!allowed) {
      return res.status(403).json({ ok: false, msg: "Not authorized for this file" });
    }

    const filePath = path.join(uploadDir, filename);
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ ok: false, msg: "File not found" });
    }

    return res.sendFile(filePath);
  } catch (err) {
    console.error("Serve media error:", err);
    return res.status(500).json({ ok: false, msg: "Could not load file" });
  }
};
