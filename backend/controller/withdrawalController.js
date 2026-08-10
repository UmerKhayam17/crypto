const Withdrawal = require("../model/Withdrawal");
const User = require("../model/User");
const formatWithdrawal = require("../utils/formatWithdrawal");
const { debitWallet, creditWallet } = require("../utils/wallet");
const notify = require("../utils/realtimeNotify");

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

    const debited = await debitWallet(user._id, amount);
    if (!debited) {
      return res.status(400).json({
        ok: false,
        msg: `Insufficient balance (have $${(user.wallet?.cashUSDT ?? 0).toFixed(2)})`,
      });
    }

    let withdrawal;
    try {
      withdrawal = await Withdrawal.create({
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
    } catch (err) {
      await creditWallet(user._id, amount);
      throw err;
    }

    const cash = debited.wallet?.cashUSDT ?? 0;
    const formatted = formatWithdrawal(withdrawal);
    notify.withdrawalUpsert(formatted, {
      userWallet: { cashUSDT: cash },
      userId: user._id.toString(),
    });

    return res.status(201).json({
      ok: true,
      msg: "Withdrawal request submitted. Awaiting admin verification.",
      withdrawal: formatted,
      wallet: { cashUSDT: cash },
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

    const processedBy = req.user.fname ? `${req.user.fname} ${req.user.lname}` : "Admin";
    const claimed = await Withdrawal.findOneAndUpdate(
      { _id: withdrawal._id, status: "pending" },
      {
        $set: {
          status: "approved",
          processedAt: Date.now(),
          processedBy,
        },
      },
      { new: true }
    );
    if (!claimed) {
      return res.status(400).json({ ok: false, msg: "Withdrawal is not pending" });
    }

    // Funds were already reserved (debited) on create
    const owner = await User.findById(claimed.user);
    const cash = owner?.wallet?.cashUSDT ?? 0;
    const formatted = formatWithdrawal(claimed);
    notify.withdrawalUpsert(formatted, {
      userWallet: { cashUSDT: cash },
      userId: claimed.user.toString(),
    });

    return res.json({
      ok: true,
      msg: "Withdrawal approved",
      withdrawal: formatted,
      userWallet: { cashUSDT: cash },
      userId: claimed.user.toString(),
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

    const processedBy = req.user.fname ? `${req.user.fname} ${req.user.lname}` : "Admin";
    const claimed = await Withdrawal.findOneAndUpdate(
      { _id: withdrawal._id, status: "pending" },
      {
        $set: {
          status: "rejected",
          rejectReason: req.body.reason?.trim() || "",
          processedAt: Date.now(),
          processedBy,
        },
      },
      { new: true }
    );
    if (!claimed) {
      return res.status(400).json({ ok: false, msg: "Withdrawal is not pending" });
    }

    const owner = await creditWallet(claimed.user, claimed.amount);
    const cash = owner?.wallet?.cashUSDT ?? 0;
    const formatted = formatWithdrawal(claimed);
    notify.withdrawalUpsert(formatted, {
      userWallet: { cashUSDT: cash },
      userId: claimed.user.toString(),
    });

    return res.json({
      ok: true,
      msg: "Withdrawal rejected",
      withdrawal: formatted,
      userWallet: { cashUSDT: cash },
      userId: claimed.user.toString(),
    });
  } catch (err) {
    console.error("Reject withdrawal error:", err);
    return res.status(500).json({ ok: false, msg: "Could not reject withdrawal" });
  }
};

exports.cancelWithdrawal = async (req, res) => {
  try {
    const claimed = await Withdrawal.findOneAndDelete({
      _id: req.params.id,
      user: req.user._id,
      status: "pending",
    });
    if (!claimed) {
      const existing = await Withdrawal.findOne({ _id: req.params.id, user: req.user._id });
      if (!existing) return res.status(404).json({ ok: false, msg: "Withdrawal not found" });
      return res.status(400).json({ ok: false, msg: "Only pending withdrawals can be cancelled" });
    }

    const owner = await creditWallet(req.user._id, claimed.amount);
    const cash = owner?.wallet?.cashUSDT ?? 0;
    const userId = req.user._id.toString();
    notify.withdrawalDeleted(req.params.id, userId);
    return res.json({
      ok: true,
      msg: "Withdrawal cancelled",
      wallet: { cashUSDT: cash },
    });
  } catch (err) {
    console.error("Cancel withdrawal error:", err);
    return res.status(500).json({ ok: false, msg: "Could not cancel withdrawal" });
  }
};
