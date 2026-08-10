const User = require("../model/User");
const Trade = require("../model/Trade");
const Deposit = require("../model/Deposit");
const Withdrawal = require("../model/Withdrawal");
const SpotPosition = require("../model/SpotPosition");
const formatUser = require("../utils/formatUser");
const { creditWallet } = require("../utils/wallet");
const notify = require("../utils/realtimeNotify");

async function canAccessUser(actor, userId) {
  if (actor.role === "admin") return true;
  if (actor.role !== "staff") return false;
  const target = await User.findOne({ _id: userId, role: "user" });
  if (!target) return false;
  return String(target.assignedStaff) === String(actor._id);
}

exports.listUsers = async (req, res) => {
  try {
    const query = { role: "user" };
    if (req.user.role === "staff") {
      query.assignedStaff = req.user._id;
    }

    const users = await User.find(query)
      .populate("assignedStaff", "fname lname")
      .sort({ createdAt: -1 });

    return res.json({ ok: true, users: users.map((u) => formatUser(u, { staff: true })) });
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

    const label = staffId ? formatUser(platformUser, { staff: true }).assignedStaffName : "unassigned";

    const formatted = formatUser(platformUser, { staff: true });

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

    const formatted = formatUser(platformUser, { staff: true });
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

exports.suspendUser = async (req, res) => {
  try {
    const platformUser = await User.findOne({ _id: req.params.id, role: "user" });
    if (!platformUser) {
      return res.status(404).json({ ok: false, msg: "User not found" });
    }

    const allowed = await canAccessUser(req.user, platformUser._id);
    if (!allowed) return res.status(403).json({ ok: false, msg: "Not authorized for this user" });

    const suspended = !!req.body.suspended;
    platformUser.suspended = suspended;
    await platformUser.save();
    await platformUser.populate("assignedStaff", "fname lname");

    const formatted = formatUser(platformUser, { staff: true });
    notify.userUpdated(formatted);

    return res.json({
      ok: true,
      msg: suspended ? "User suspended" : "User unsuspended",
      user: formatted,
    });
  } catch (err) {
    console.error("Suspend user error:", err);
    return res.status(500).json({ ok: false, msg: "Could not update suspension" });
  }
};

exports.adjustBalance = async (req, res) => {
  try {
    if (req.user.role !== "admin") {
      return res.status(403).json({ ok: false, msg: "Admin access required" });
    }

    const platformUser = await User.findOne({ _id: req.params.id, role: "user" });
    if (!platformUser) {
      return res.status(404).json({ ok: false, msg: "User not found" });
    }

    const delta = Number(req.body.delta);
    if (!Number.isFinite(delta) || delta === 0) {
      return res.status(400).json({ ok: false, msg: "Enter a non-zero adjustment amount" });
    }

    let updated;
    if (delta > 0) {
      updated = await creditWallet(platformUser._id, delta);
    } else {
      const { debitWallet } = require("../utils/wallet");
      updated = await debitWallet(platformUser._id, Math.abs(delta));
      if (!updated) {
        return res.status(400).json({ ok: false, msg: "Insufficient balance for debit" });
      }
    }

    await updated.populate("assignedStaff", "fname lname");
    const formatted = formatUser(updated, { staff: true });
    notify.userUpdated(formatted);

    return res.json({
      ok: true,
      msg: `Balance adjusted by ${delta >= 0 ? "+" : ""}${delta.toFixed(2)}`,
      user: formatted,
      wallet: { cashUSDT: updated.wallet?.cashUSDT ?? 0 },
    });
  } catch (err) {
    console.error("Adjust balance error:", err);
    return res.status(500).json({ ok: false, msg: "Could not adjust balance" });
  }
};

exports.setBalance = async (req, res) => {
  try {
    if (req.user.role !== "admin") {
      return res.status(403).json({ ok: false, msg: "Admin access required" });
    }

    const platformUser = await User.findOne({ _id: req.params.id, role: "user" });
    if (!platformUser) {
      return res.status(404).json({ ok: false, msg: "User not found" });
    }

    const balance = Number(req.body.balance);
    if (!Number.isFinite(balance) || balance < 0) {
      return res.status(400).json({ ok: false, msg: "Balance must be a non-negative number" });
    }

    platformUser.wallet = platformUser.wallet || { cashUSDT: 0 };
    platformUser.wallet.cashUSDT = balance;
    await platformUser.save();
    await platformUser.populate("assignedStaff", "fname lname");

    const formatted = formatUser(platformUser, { staff: true });
    notify.userUpdated(formatted);

    return res.json({
      ok: true,
      msg: `Balance set to $${balance.toFixed(2)}`,
      user: formatted,
      wallet: { cashUSDT: balance },
    });
  } catch (err) {
    console.error("Set balance error:", err);
    return res.status(500).json({ ok: false, msg: "Could not set balance" });
  }
};

exports.updateProfile = async (req, res) => {
  try {
    const platformUser = await User.findOne({ _id: req.params.id, role: "user" });
    if (!platformUser) {
      return res.status(404).json({ ok: false, msg: "User not found" });
    }

    const allowed = await canAccessUser(req.user, platformUser._id);
    if (!allowed) return res.status(403).json({ ok: false, msg: "Not authorized for this user" });

    const { fname, lname, email, phone, country } = req.body;
    if (fname != null) {
      const v = String(fname).trim();
      if (!v) return res.status(400).json({ ok: false, msg: "First name is required" });
      platformUser.fname = v;
    }
    if (lname != null) {
      const v = String(lname).trim();
      if (!v) return res.status(400).json({ ok: false, msg: "Last name is required" });
      platformUser.lname = v;
    }
    if (email != null) {
      const v = String(email).trim().toLowerCase();
      if (!v.includes("@")) return res.status(400).json({ ok: false, msg: "Invalid email" });
      const clash = await User.findOne({ email: v, _id: { $ne: platformUser._id } });
      if (clash) return res.status(400).json({ ok: false, msg: "Email already in use" });
      platformUser.email = v;
    }
    if (phone != null) platformUser.phone = String(phone).trim();
    if (country != null) platformUser.country = String(country).trim();

    await platformUser.save();
    await platformUser.populate("assignedStaff", "fname lname");

    const formatted = formatUser(platformUser, { staff: true });
    notify.userUpdated(formatted);

    return res.json({ ok: true, msg: "User updated", user: formatted });
  } catch (err) {
    console.error("Update profile error:", err);
    return res.status(500).json({ ok: false, msg: "Could not update user" });
  }
};

exports.deleteUser = async (req, res) => {
  try {
    if (req.user.role !== "admin") {
      return res.status(403).json({ ok: false, msg: "Admin access required" });
    }

    const platformUser = await User.findOne({ _id: req.params.id, role: "user" });
    if (!platformUser) {
      return res.status(404).json({ ok: false, msg: "User not found" });
    }

    const userId = platformUser._id;
    await Promise.all([
      Trade.deleteMany({ user: userId }),
      Deposit.deleteMany({ user: userId }),
      Withdrawal.deleteMany({ user: userId }),
      SpotPosition.deleteMany({ user: userId }),
    ]);
    await platformUser.deleteOne();

    notify.usersInvalidate();
    return res.json({ ok: true, msg: "User deleted" });
  } catch (err) {
    console.error("Delete user error:", err);
    return res.status(500).json({ ok: false, msg: "Could not delete user" });
  }
};
