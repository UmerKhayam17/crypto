const User = require("../model/User");
const formatUser = require("../utils/formatUser");
const notify = require("../utils/realtimeNotify");

exports.listUsers = async (req, res) => {
  try {
    const query = { role: "user" };
    if (req.user.role === "staff") {
      query.assignedStaff = req.user._id;
    }

    const users = await User.find(query)
      .populate("assignedStaff", "fname lname")
      .sort({ createdAt: -1 });

    return res.json({ ok: true, users: users.map(formatUser) });
  } catch (err) {
    console.error("List users error:", err);
    return res.status(500).json({ ok: false, msg: "Could not load users" });
  }
};

exports.assignStaff = async (req, res) => {
  try {
    const platformUser = await User.findOne({ _id: req.params.id, role: "user" });
    if (!platformUser) {
      return res.status(404).json({ ok: false, msg: "User not found" });
    }

    const { staffId } = req.body;

    if (staffId) {
      const staff = await User.findOne({ _id: staffId, role: "staff" });
      if (!staff) {
        return res.status(400).json({ ok: false, msg: "Invalid staff member" });
      }
      platformUser.assignedStaff = staff._id;
    } else {
      platformUser.assignedStaff = null;
    }

    await platformUser.save();
    await platformUser.populate("assignedStaff", "fname lname");

    const label = staffId ? formatUser(platformUser).assignedStaffName : "unassigned";

    const formatted = formatUser(platformUser);

    notify.userUpdated(formatted);
    notify.usersInvalidate();

    return res.json({
      ok: true,
      msg: staffId ? `User assigned to ${label}` : "Staff assignment removed",
      user: formatted,
    });
  } catch (err) {
    console.error("Assign staff error:", err);
    return res.status(500).json({ ok: false, msg: "Could not assign staff" });
  }
};

exports.updateTradeControl = async (req, res) => {
  try {
    const platformUser = await User.findOne({ _id: req.params.id, role: "user" });
    if (!platformUser) {
      return res.status(404).json({ ok: false, msg: "User not found" });
    }

    if (req.user.role === "staff" && String(platformUser.assignedStaff) !== String(req.user._id)) {
      return res.status(403).json({ ok: false, msg: "Not authorized for this user" });
    }

    const { forceOutcome, profitPercent, lossPercent } = req.body;

    if (forceOutcome !== undefined) {
      if (!["random", "win", "lose"].includes(forceOutcome)) {
        return res.status(400).json({ ok: false, msg: "Invalid trade mode" });
      }
      platformUser.forceOutcome = forceOutcome;
    }

    if (profitPercent !== undefined) {
      if (profitPercent === null || profitPercent === "") {
        platformUser.profitPercent = null;
      } else {
        const pct = Number(profitPercent);
        if (!Number.isFinite(pct) || pct < 0 || pct > 500) {
          return res.status(400).json({ ok: false, msg: "Profit % must be 0–500" });
        }
        platformUser.profitPercent = pct;
      }
    }

    if (lossPercent !== undefined) {
      const pct = Number(lossPercent);
      if (!Number.isFinite(pct) || pct < 0 || pct > 100) {
        return res.status(400).json({ ok: false, msg: "Loss % must be 0–100" });
      }
      platformUser.lossPercent = pct;
    }

    await platformUser.save();
    await platformUser.populate("assignedStaff", "fname lname");

    const formatted = formatUser(platformUser);
    notify.userUpdated(formatted);

    return res.json({
      ok: true,
      msg: "Trade control updated",
      user: formatted,
    });
  } catch (err) {
    console.error("Update trade control error:", err);
    return res.status(500).json({ ok: false, msg: "Could not update trade control" });
  }
};
