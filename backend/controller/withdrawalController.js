const Withdrawal = require("../model/Withdrawal");
const User = require("../model/User");
const formatWithdrawal = require("../utils/formatWithdrawal");
const notify = require("../utils/realtimeNotify");

async function pendingWithdrawalTotal(userId) {
  const rows = await Withdrawal.find({ user: userId, status: "pending" });
  return rows.reduce((sum, w) => sum + w.amount, 0);
}

async function canAccessUser(actor, userId) {
  if (actor.role === "admin") return true;
  if (actor.role !== "staff") return false;
  const target = await User.findOne({ _id: userId, role: "user" });
  if (!target) return false;
  return String(target.assignedStaff) === String(actor._id);
}

exports.createWithdrawal = async (req, res) => {
  try {
    const user = req.user;
    if (user.role !== "user") {
      return res.status(403).json({ ok: false, msg: "Only platform users can withdraw" });
    }
    if (user.suspended) {
      return res.status(403).json({ ok: false, msg: "Your account is suspended" });
    }
    if (user.kyc?.status !== "approved") {
      return res.status(400).json({ ok: false, msg: "Complete KYC verification to withdraw" });
    }

    const amount = Number(req.body.amount);
    const method = req.body.method;
    if (!Number.isFinite(amount) || amount <= 0) {
      return res.status(400).json({ ok: false, msg: "Enter an amount greater than 0" });
    }
    if (!["trc20", "bank"].includes(method)) {
      return res.status(400).json({ ok: false, msg: "Choose TRC20 or bank transfer" });
    }

    const trc20Address = String(req.body.trc20Address || "").trim();
    const bankName = String(req.body.bankName || "").trim();
    const accountNumber = String(req.body.accountNumber || "").trim();
    const accountName = String(req.body.accountName || "").trim();

    if (method === "trc20") {
      if (!trc20Address || trc20Address.length < 10) {
        return res.status(400).json({ ok: false, msg: "Enter a valid TRC20 wallet address" });
      }
    } else {
      if (!bankName) return res.status(400).json({ ok: false, msg: "Bank name is required" });
      if (!accountNumber) return res.status(400).json({ ok: false, msg: "Account number is required" });
    }

    const balance = user.wallet?.cashUSDT ?? 0;
    const reserved = await pendingWithdrawalTotal(user._id);
    const available = balance - reserved;
    if (amount > available) {
      return res.status(400).json({
        ok: false,
        msg: reserved > 0
          ? `Insufficient available balance ($${available.toFixed(2)} after pending withdrawals)`
          : `Insufficient balance (have $${balance.toFixed(2)})`,
      });
    }

    const withdrawal = await Withdrawal.create({
      user: user._id,
      amount,
      method,
      trc20Address: method === "trc20" ? trc20Address : "",
      bankName: method === "bank" ? bankName : "",
      accountNumber: method === "bank" ? accountNumber : "",
      accountName: method === "bank" ? accountName : "",
      note: req.body.note?.trim() || "",
      status: "pending",
    });

    const formatted = formatWithdrawal(withdrawal);
    notify.withdrawalUpsert(formatted);

    return res.status(201).json({
      ok: true,
      msg: "Withdrawal request submitted. Awaiting admin verification.",
      withdrawal: formatted,
    });
  } catch (err) {
    console.error("Create withdrawal error:", err);
    return res.status(500).json({ ok: false, msg: "Could not submit withdrawal" });
  }
};

exports.listMyWithdrawals = async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    const withdrawals = await Withdrawal.find({ user: req.user._id }).sort({ createdAt: -1 });
    return res.json({
      ok: true,
      withdrawals: withdrawals.map(formatWithdrawal),
      wallet: { cashUSDT: user?.wallet?.cashUSDT ?? 0 },
    });
  } catch (err) {
    console.error("List my withdrawals error:", err);
    return res.status(500).json({ ok: false, msg: "Could not load withdrawals" });
  }
};

exports.listWithdrawals = async (req, res) => {
  try {
    let query = {};
    if (req.user.role === "staff") {
      const assigned = await User.find({ role: "user", assignedStaff: req.user._id }).select("_id");
      const ids = assigned.map((u) => u._id);
      if (ids.length === 0) return res.json({ ok: true, withdrawals: [] });
      query = { user: { $in: ids } };
    }

    const withdrawals = await Withdrawal.find(query)
      .populate("user", "fname lname email")
      .sort({ createdAt: -1 });
    return res.json({ ok: true, withdrawals: withdrawals.map(formatWithdrawal) });
  } catch (err) {
    console.error("List withdrawals error:", err);
    return res.status(500).json({ ok: false, msg: "Could not load withdrawals" });
  }
};

exports.approveWithdrawal = async (req, res) => {
  try {
    const withdrawal = await Withdrawal.findById(req.params.id);
    if (!withdrawal) return res.status(404).json({ ok: false, msg: "Withdrawal not found" });
    if (withdrawal.status !== "pending") {
      return res.status(400).json({ ok: false, msg: "Withdrawal is not pending" });
    }

    const allowed = await canAccessUser(req.user, withdrawal.user);
    if (!allowed) return res.status(403).json({ ok: false, msg: "Not authorized for this withdrawal" });

    const owner = await User.findById(withdrawal.user);
    if (!owner) return res.status(404).json({ ok: false, msg: "User not found" });

    const balance = owner.wallet?.cashUSDT ?? 0;
    if (withdrawal.amount > balance) {
      return res.status(400).json({ ok: false, msg: "User no longer has sufficient balance" });
    }

    owner.wallet = owner.wallet || { cashUSDT: 0 };
    owner.wallet.cashUSDT = balance - withdrawal.amount;
    await owner.save();

    withdrawal.status = "approved";
    withdrawal.processedAt = Date.now();
    withdrawal.processedBy = req.user.fname ? `${req.user.fname} ${req.user.lname}` : "Admin";
    await withdrawal.save();

    const formatted = formatWithdrawal(withdrawal);
    notify.withdrawalUpsert(formatted, {
      userWallet: { cashUSDT: owner.wallet.cashUSDT },
      userId: owner._id.toString(),
    });

    return res.json({
      ok: true,
      msg: "Withdrawal approved",
      withdrawal: formatted,
      userWallet: { cashUSDT: owner.wallet.cashUSDT },
      userId: owner._id.toString(),
    });
  } catch (err) {
    console.error("Approve withdrawal error:", err);
    return res.status(500).json({ ok: false, msg: "Could not approve withdrawal" });
  }
};

exports.rejectWithdrawal = async (req, res) => {
  try {
    const withdrawal = await Withdrawal.findById(req.params.id);
    if (!withdrawal) return res.status(404).json({ ok: false, msg: "Withdrawal not found" });
    if (withdrawal.status !== "pending") {
      return res.status(400).json({ ok: false, msg: "Withdrawal is not pending" });
    }

    const allowed = await canAccessUser(req.user, withdrawal.user);
    if (!allowed) return res.status(403).json({ ok: false, msg: "Not authorized for this withdrawal" });

    withdrawal.status = "rejected";
    withdrawal.rejectReason = req.body.reason?.trim() || "";
    withdrawal.processedAt = Date.now();
    withdrawal.processedBy = req.user.fname ? `${req.user.fname} ${req.user.lname}` : "Admin";
    await withdrawal.save();

    const formatted = formatWithdrawal(withdrawal);
    notify.withdrawalUpsert(formatted);

    return res.json({ ok: true, msg: "Withdrawal rejected", withdrawal: formatted });
  } catch (err) {
    console.error("Reject withdrawal error:", err);
    return res.status(500).json({ ok: false, msg: "Could not reject withdrawal" });
  }
};

exports.cancelWithdrawal = async (req, res) => {
  try {
    const withdrawal = await Withdrawal.findOne({ _id: req.params.id, user: req.user._id });
    if (!withdrawal) return res.status(404).json({ ok: false, msg: "Withdrawal not found" });
    if (withdrawal.status !== "pending") {
      return res.status(400).json({ ok: false, msg: "Only pending withdrawals can be cancelled" });
    }

    const userId = req.user._id.toString();
    await withdrawal.deleteOne();
    notify.withdrawalDeleted(req.params.id, userId);
    return res.json({ ok: true, msg: "Withdrawal cancelled" });
  } catch (err) {
    console.error("Cancel withdrawal error:", err);
    return res.status(500).json({ ok: false, msg: "Could not cancel withdrawal" });
  }
};
