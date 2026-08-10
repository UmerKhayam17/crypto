const jwt = require("jsonwebtoken");
const User = require("../model/User");

const protect = async (req, res, next) => {
  try {
    const header = req.headers.authorization;
    if (!header?.startsWith("Bearer ")) {
      return res.status(401).json({ ok: false, msg: "Not authorized — no token" });
    }

    const token = header.split(" ")[1];
    const secret = process.env.JWT_SECRET;
    if (!secret) {
      return res.status(500).json({ ok: false, msg: "Server misconfiguration" });
    }

    const decoded = jwt.verify(token, secret);
    const user = await User.findById(decoded.id);

    if (!user) {
      return res.status(401).json({ ok: false, msg: "User no longer exists" });
    }
    if (user.suspended) {
      return res.status(403).json({ ok: false, msg: "Account suspended" });
    }

    req.user = user;
    next();
  } catch {
    return res.status(401).json({ ok: false, msg: "Not authorized — invalid token" });
  }
};

const adminOnly = (req, res, next) => {
  if (req.user?.role !== "admin") {
    return res.status(403).json({ ok: false, msg: "Admin access required" });
  }
  next();
};

const staffOrAdmin = (req, res, next) => {
  if (req.user?.role !== "admin" && req.user?.role !== "staff") {
    return res.status(403).json({ ok: false, msg: "Staff or admin access required" });
  }
  next();
};

module.exports = { protect, adminOnly, staffOrAdmin };
