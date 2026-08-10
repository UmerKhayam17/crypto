const path = require("path");
const fs = require("fs");
const Deposit = require("../model/Deposit");
const User = require("../model/User");
const Settings = require("../model/Settings");
const formatDeposit = require("../utils/formatDeposit");
const notify = require("../utils/realtimeNotify");

const uploadDir = path.join(__dirname, "..", "uploads");
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

function fileUrl(req, filename) {
  return `${req.protocol}://${req.get("host")}/uploads/${filename}`;
}

exports.createDeposit = async (req, res) => {
  try {
    const user = req.user;
    if (user.role !== "user") {
      return res.status(403).json({ ok: false, msg: "Only platform users can deposit" });
    }
    if (user.kyc?.status !== "approved") {
      return res.status(400).json({ ok: false, msg: "Complete KYC verification to deposit" });
    }

    const settings = await Settings.getSettings();
    if (!settings.trc20WalletAddress) {
      return res.status(400).json({ ok: false, msg: "Deposits are temporarily unavailable. Please contact support." });
    }

    const amount = Number(req.body.amount);
    if (!Number.isFinite(amount) || amount <= 0) {
      return res.status(400).json({ ok: false, msg: "Enter an amount greater than 0" });
    }

    const screenshotFile = req.file;
    if (!screenshotFile) {
      return res.status(400).json({ ok: false, msg: "Please attach a payment screenshot" });
    }
    if (!screenshotFile.mimetype?.startsWith("image/")) {
      return res.status(400).json({ ok: false, msg: "Screenshot must be an image" });
    }

    const ext = path.extname(screenshotFile.originalname || "") || ".jpg";
    const filename = `deposit-${user._id}-${Date.now()}${ext}`;
    fs.writeFileSync(path.join(uploadDir, filename), screenshotFile.buffer);

    const deposit = await Deposit.create({
      user: user._id,
      amount,
      txHash: req.body.txHash?.trim() || "",
      screenshot: fileUrl(req, filename),
      note: req.body.note?.trim() || "",
      status: "pending",
    });

    const formatted = formatDeposit(deposit);
    notify.depositUpsert(formatted);

    return res.status(201).json({
      ok: true,
      msg: "Deposit submitted. Awaiting admin verification.",
      deposit: formatted,
    });
  } catch (err) {
    console.error("Create deposit error:", err);
    return res.status(500).json({ ok: false, msg: "Could not submit deposit" });
  }
};

exports.listMyDeposits = async (req, res) => {
  try {
    const deposits = await Deposit.find({ user: req.user._id }).sort({ createdAt: -1 });
    return res.json({ ok: true, deposits: deposits.map(formatDeposit) });
  } catch (err) {
    console.error("List my deposits error:", err);
    return res.status(500).json({ ok: false, msg: "Could not load deposits" });
  }
};

exports.listDeposits = async (req, res) => {
  try {
    let userIds = null;
    if (req.user.role === "staff") {
      const assigned = await User.find({ role: "user", assignedStaff: req.user._id }).select("_id");
      userIds = assigned.map((u) => u._id);
      if (userIds.length === 0) {
        return res.json({ ok: true, deposits: [] });
      }
    }

    const query = userIds ? { user: { $in: userIds } } : {};
    const deposits = await Deposit.find(query).populate("user", "fname lname email").sort({ createdAt: -1 });
    return res.json({ ok: true, deposits: deposits.map(formatDeposit) });
  } catch (err) {
    console.error("List deposits error:", err);
    return res.status(500).json({ ok: false, msg: "Could not load deposits" });
  }
};

exports.approveDeposit = async (req, res) => {
  try {
    const deposit = await Deposit.findById(req.params.id);
    if (!deposit) return res.status(404).json({ ok: false, msg: "Deposit not found" });
    if (deposit.status !== "pending") {
      return res.status(400).json({ ok: false, msg: "Deposit is not pending" });
    }

    if (req.user.role === "staff") {
      const owner = await User.findById(deposit.user);
      if (!owner || String(owner.assignedStaff) !== String(req.user._id)) {
        return res.status(403).json({ ok: false, msg: "Not authorized for this deposit" });
      }
    }

    const owner = await User.findById(deposit.user);
    if (!owner) return res.status(404).json({ ok: false, msg: "User not found" });

    owner.wallet = owner.wallet || { cashUSDT: 0 };
    owner.wallet.cashUSDT = (owner.wallet.cashUSDT || 0) + deposit.amount;
    await owner.save();

    deposit.status = "approved";
    deposit.processedAt = Date.now();
    deposit.processedBy = req.user.fname ? `${req.user.fname} ${req.user.lname}` : "Admin";
    await deposit.save();

    const formatted = formatDeposit(deposit);
    notify.depositUpsert(formatted, {
      userWallet: { cashUSDT: owner.wallet.cashUSDT },
      userId: owner._id.toString(),
    });

    return res.json({
      ok: true,
      msg: "Deposit approved",
      deposit: formatted,
      userWallet: { cashUSDT: owner.wallet.cashUSDT },
      userId: owner._id.toString(),
    });
  } catch (err) {
    console.error("Approve deposit error:", err);
    return res.status(500).json({ ok: false, msg: "Could not approve deposit" });
  }
};

exports.rejectDeposit = async (req, res) => {
  try {
    const deposit = await Deposit.findById(req.params.id);
    if (!deposit) return res.status(404).json({ ok: false, msg: "Deposit not found" });
    if (deposit.status !== "pending") {
      return res.status(400).json({ ok: false, msg: "Deposit is not pending" });
    }

    if (req.user.role === "staff") {
      const owner = await User.findById(deposit.user);
      if (!owner || String(owner.assignedStaff) !== String(req.user._id)) {
        return res.status(403).json({ ok: false, msg: "Not authorized for this deposit" });
      }
    }

    deposit.status = "rejected";
    deposit.rejectReason = req.body.reason?.trim() || "";
    deposit.processedAt = Date.now();
    deposit.processedBy = req.user.fname ? `${req.user.fname} ${req.user.lname}` : "Admin";
    await deposit.save();

    const formatted = formatDeposit(deposit);
    notify.depositUpsert(formatted);

    return res.json({ ok: true, msg: "Deposit rejected", deposit: formatted });
  } catch (err) {
    console.error("Reject deposit error:", err);
    return res.status(500).json({ ok: false, msg: "Could not reject deposit" });
  }
};

exports.cancelDeposit = async (req, res) => {
  try {
    const deposit = await Deposit.findOne({ _id: req.params.id, user: req.user._id });
    if (!deposit) return res.status(404).json({ ok: false, msg: "Deposit not found" });
    if (deposit.status !== "pending") {
      return res.status(400).json({ ok: false, msg: "Only pending deposits can be cancelled" });
    }

    const userId = deposit.user.toString();
    await deposit.deleteOne();
    notify.depositDeleted(req.params.id, userId);
    return res.json({ ok: true, msg: "Deposit cancelled" });
  } catch (err) {
    console.error("Cancel deposit error:", err);
    return res.status(500).json({ ok: false, msg: "Could not cancel deposit" });
  }
};
