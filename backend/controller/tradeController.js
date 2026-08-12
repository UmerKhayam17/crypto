const Trade = require("../model/Trade");
const User = require("../model/User");
const Settings = require("../model/Settings");
const formatTrade = require("../utils/formatTrade");
const { settleTradeDoc, settleTradeForced } = require("../utils/settleTrade");
const { fetchMarkPrice, isAllowedTradeSymbol } = require("../utils/markPrice");
const { debitWallet, creditWallet } = require("../utils/wallet");
const notify = require("../utils/realtimeNotify");
const { isValidDuration } = require("../utils/durationPayout");

let settling = false;

async function getGlobalPayoutPercent() {
  const settings = await Settings.getSettings();
  return settings.payoutPercent ?? 85;
}

async function canAccessUser(actor, userId) {
  if (actor.role === "admin") return true;
  if (actor.role !== "staff") return false;
  const target = await User.findOne({ _id: userId, role: "user" });
  if (!target) return false;
  return String(target.assignedStaff) === String(actor._id);
}

async function settleExpiredTrades() {
  if (settling) return;
  settling = true;
  try {
    const now = Date.now();
    const globalPayout = await getGlobalPayoutPercent();
    const expired = await Trade.find({ status: "active", expiresAt: { $lte: now } }).limit(50);
    for (const trade of expired) {
      try {
        const claimed = await Trade.findOneAndUpdate(
          { _id: trade._id, status: "active" },
          { $set: { status: "settling" } },
          { new: true }
        );
        if (!claimed) continue;

        const user = await User.findById(claimed.user);
        if (!user) {
          await Trade.findByIdAndUpdate(claimed._id, { status: "active" });
          continue;
        }

        const { payout, won, closePrice } = await settleTradeDoc(claimed, user, globalPayout);
        claimed.status = won ? "won" : "lost";
        claimed.closePrice = closePrice;
        await claimed.save();

        const updatedUser = await creditWallet(user._id, payout);
        const cash = updatedUser?.wallet?.cashUSDT ?? 0;
        const formatted = formatTrade(claimed, { staff: false });
        notify.tradeUpsert(formatted, {
          userWallet: { cashUSDT: cash },
          userId: user._id.toString(),
        });
      } catch (err) {
        console.error("Settle one trade error:", err);
        await Trade.findOneAndUpdate(
          { _id: trade._id, status: "settling" },
          { $set: { status: "active" } }
        ).catch(() => {});
      }
    }
  } finally {
    settling = false;
  }
}

exports.settleExpiredTrades = settleExpiredTrades;

exports.createTrade = async (req, res) => {
  try {
    const user = req.user;
    if (user.role !== "user") {
      return res.status(403).json({ ok: false, msg: "Only platform users can trade" });
    }
    if (user.suspended) {
      return res.status(403).json({ ok: false, msg: "Your account is suspended" });
    }
    if (user.kyc?.status !== "approved") {
      return res.status(400).json({ ok: false, msg: "Complete KYC verification to start trading" });
    }

    const { symbol, direction, stake, durationSec } = req.body;
    const stakeN = Number(stake);
    const dur = Number(durationSec);

    if (!symbol || !direction) {
      return res.status(400).json({ ok: false, msg: "Symbol and direction are required" });
    }
    if (!isAllowedTradeSymbol(symbol)) {
      return res.status(400).json({ ok: false, msg: "Unsupported market symbol" });
    }
    if (!["up", "down"].includes(direction)) {
      return res.status(400).json({ ok: false, msg: "Invalid direction" });
    }
    if (!Number.isFinite(stakeN) || stakeN <= 0) {
      return res.status(400).json({ ok: false, msg: "Enter a stake greater than 0" });
    }
    if (!isValidDuration(dur)) {
      return res.status(400).json({ ok: false, msg: "Invalid duration" });
    }

    let entry;
    try {
      entry = await fetchMarkPrice(symbol, req.body.entryPrice);
    } catch {
      return res.status(502).json({ ok: false, msg: "Could not fetch live market price" });
    }

    const debited = await debitWallet(user._id, stakeN);
    if (!debited) {
      return res.status(400).json({
        ok: false,
        msg: `Insufficient balance (have $${(user.wallet?.cashUSDT ?? 0).toFixed(2)})`,
      });
    }

    const now = Date.now();
    let trade;
    try {
      trade = await Trade.create({
        user: user._id,
        symbol,
        direction,
        stake: stakeN,
        durationSec: dur,
        entryPrice: entry,
        openedAt: now,
        expiresAt: now + dur * 1000,
        status: "active",
      });
    } catch (err) {
      await creditWallet(user._id, stakeN);
      throw err;
    }

    const formatted = formatTrade(trade, { staff: false });
    notify.tradeUpsert(formatted, {
      wallet: { cashUSDT: debited.wallet.cashUSDT },
      userId: user._id.toString(),
    });

    return res.status(201).json({
      ok: true,
      msg: `${direction.toUpperCase()} $${stakeN.toFixed(2)} on ${symbol} for ${dur}s`,
      trade: formatted,
      wallet: { cashUSDT: debited.wallet.cashUSDT },
    });
  } catch (err) {
    console.error("Create trade error:", err);
    return res.status(500).json({ ok: false, msg: "Could not place trade" });
  }
};

exports.listMyTrades = async (req, res) => {
  try {
    await settleExpiredTrades();
    const user = await User.findById(req.user._id);
    const trades = await Trade.find({ user: req.user._id }).sort({ createdAt: -1 });
    return res.json({
      ok: true,
      trades: trades.map((t) => formatTrade(t, { staff: false })),
      wallet: { cashUSDT: user?.wallet?.cashUSDT ?? 0 },
    });
  } catch (err) {
    console.error("List my trades error:", err);
    return res.status(500).json({ ok: false, msg: "Could not load trades" });
  }
};

exports.listTrades = async (req, res) => {
  try {
    await settleExpiredTrades();
    let query = {};
    if (req.user.role === "staff") {
      const assigned = await User.find({ role: "user", assignedStaff: req.user._id }).select("_id");
      const ids = assigned.map((u) => u._id);
      if (ids.length === 0) return res.json({ ok: true, trades: [] });
      query = { user: { $in: ids } };
    }

    const userId = req.query.userId;
    if (userId) {
      const allowed = await canAccessUser(req.user, userId);
      if (!allowed) return res.status(403).json({ ok: false, msg: "Not authorized for this user" });
      query.user = userId;
    }

    const trades = await Trade.find(query).populate("user", "fname lname email").sort({ createdAt: -1 });
    return res.json({ ok: true, trades: trades.map((t) => formatTrade(t, { staff: true })) });
  } catch (err) {
    console.error("List trades error:", err);
    return res.status(500).json({ ok: false, msg: "Could not load trades" });
  }
};

exports.planTrade = async (req, res) => {
  try {
    const trade = await Trade.findById(req.params.id);
    if (!trade) return res.status(404).json({ ok: false, msg: "Trade not found" });
    if (trade.status !== "active") {
      return res.status(400).json({ ok: false, msg: "Trade is not active" });
    }

    const allowed = await canAccessUser(req.user, trade.user);
    if (!allowed) return res.status(403).json({ ok: false, msg: "Not authorized for this trade" });

    const { plannedOutcome, profitPercent, lossPercent } = req.body;
    if (!["profit", "loss", null, ""].includes(plannedOutcome)) {
      return res.status(400).json({ ok: false, msg: "Invalid planned outcome" });
    }

    trade.plannedOutcome = plannedOutcome || null;
    if (profitPercent != null) {
      const pct = Number(profitPercent);
      if (!Number.isFinite(pct) || pct < 0 || pct > 500) {
        return res.status(400).json({ ok: false, msg: "Profit % must be 0–500" });
      }
      trade.customProfitPercent = pct;
    }
    if (lossPercent != null) {
      const pct = Number(lossPercent);
      if (!Number.isFinite(pct) || pct < 0 || pct > 100) {
        return res.status(400).json({ ok: false, msg: "Loss % must be 0–100" });
      }
      trade.customLossPercent = pct;
    }

    await trade.save();
    const formatted = formatTrade(trade, { staff: true });
    notify.tradeUpsert(formatted);
    return res.json({ ok: true, msg: "Trade outcome planned", trade: formatted });
  } catch (err) {
    console.error("Plan trade error:", err);
    return res.status(500).json({ ok: false, msg: "Could not plan trade" });
  }
};

exports.closeMyTrade = async (req, res) => {
  try {
    const actor = req.user;
    if (actor.role !== "user") {
      return res.status(403).json({ ok: false, msg: "Only users can close their own trades" });
    }
    if (actor.suspended) {
      return res.status(403).json({ ok: false, msg: "Your account is suspended" });
    }

    const claimed = await Trade.findOneAndUpdate(
      { _id: req.params.id, user: actor._id, status: "active" },
      { $set: { status: "settling" } },
      { new: true }
    );
    if (!claimed) {
      const existing = await Trade.findOne({ _id: req.params.id, user: actor._id });
      if (!existing) return res.status(404).json({ ok: false, msg: "Trade not found" });
      return res.status(400).json({ ok: false, msg: "Trade is already settled" });
    }

    const user = await User.findById(actor._id);
    if (!user) {
      await Trade.findByIdAndUpdate(claimed._id, { status: "active" });
      return res.status(404).json({ ok: false, msg: "User not found" });
    }

    const globalPayout = await getGlobalPayoutPercent();
    const { payout, won, closePrice } = await settleTradeDoc(claimed, user, globalPayout);
    claimed.status = won ? "won" : "lost";
    claimed.closePrice = closePrice;
    claimed.outcomeSource = "user-close";
    await claimed.save();

    const updatedUser = await creditWallet(user._id, payout);
    const cash = updatedUser?.wallet?.cashUSDT ?? 0;

    const formatted = formatTrade(claimed, { staff: false });
    notify.tradeUpsert(formatted, {
      wallet: { cashUSDT: cash },
      userWallet: { cashUSDT: cash },
      userId: user._id.toString(),
    });

    const pnl = claimed.pnl ?? 0;
    return res.json({
      ok: true,
      msg: won
        ? `Trade closed — won +$${pnl.toFixed(2)}`
        : `Trade closed — lost $${Math.abs(pnl).toFixed(2)}`,
      trade: formatted,
      wallet: { cashUSDT: cash },
    });
  } catch (err) {
    console.error("Close trade error:", err);
    return res.status(500).json({ ok: false, msg: "Could not close trade" });
  }
};

exports.settleTrade = async (req, res) => {
  try {
    const trade = await Trade.findById(req.params.id);
    if (!trade) return res.status(404).json({ ok: false, msg: "Trade not found" });
    if (trade.status !== "active") {
      return res.status(400).json({ ok: false, msg: "Trade is not active" });
    }

    const allowed = await canAccessUser(req.user, trade.user);
    if (!allowed) return res.status(403).json({ ok: false, msg: "Not authorized for this trade" });

    const { outcome, profitPercent, lossPercent } = req.body;
    if (!["profit", "loss"].includes(outcome)) {
      return res.status(400).json({ ok: false, msg: "Outcome must be profit or loss" });
    }

    const claimed = await Trade.findOneAndUpdate(
      { _id: trade._id, status: "active" },
      { $set: { status: "settling" } },
      { new: true }
    );
    if (!claimed) return res.status(400).json({ ok: false, msg: "Trade is not active" });

    const user = await User.findById(claimed.user);
    if (!user) {
      await Trade.findByIdAndUpdate(claimed._id, { status: "active" });
      return res.status(404).json({ ok: false, msg: "User not found" });
    }

    const globalPayout = await getGlobalPayoutPercent();
    const { payout } = settleTradeForced(
      claimed,
      user,
      globalPayout,
      outcome,
      profitPercent,
      lossPercent
    );
    await claimed.save();

    const updatedUser = await creditWallet(user._id, payout);
    const cash = updatedUser?.wallet?.cashUSDT ?? 0;

    const formatted = formatTrade(claimed, { staff: true });
    notify.tradeUpsert(formatted, {
      userWallet: { cashUSDT: cash },
      userId: user._id.toString(),
    });

    return res.json({
      ok: true,
      msg: outcome === "profit" ? "Trade settled as profit" : "Trade settled as loss",
      trade: formatted,
      userWallet: { cashUSDT: cash },
      userId: user._id.toString(),
    });
  } catch (err) {
    console.error("Settle trade error:", err);
    return res.status(500).json({ ok: false, msg: err.message || "Could not settle trade" });
  }
};

exports.deleteTrade = async (req, res) => {
  try {
    const trade = await Trade.findById(req.params.id);
    if (!trade) return res.status(404).json({ ok: false, msg: "Trade not found" });
    if (trade.status === "active" || trade.status === "settling") {
      return res.status(400).json({ ok: false, msg: "Cannot delete an active trade" });
    }

    const allowed = await canAccessUser(req.user, trade.user);
    if (!allowed) return res.status(403).json({ ok: false, msg: "Not authorized for this trade" });

    const userId = trade.user.toString();
    await trade.deleteOne();
    notify.tradeDeleted(req.params.id, userId);
    return res.json({ ok: true, msg: "Trade deleted" });
  } catch (err) {
    console.error("Delete trade error:", err);
    return res.status(500).json({ ok: false, msg: "Could not delete trade" });
  }
};

exports.clearResolvedTrades = async (req, res) => {
  try {
    if (req.user.role !== "admin") {
      return res.status(403).json({ ok: false, msg: "Admin access required" });
    }
    const result = await Trade.deleteMany({ status: { $in: ["won", "lost"] } });
    notify.tradesCleared();
    return res.json({ ok: true, msg: `Cleared ${result.deletedCount} trade records` });
  } catch (err) {
    console.error("Clear trades error:", err);
    return res.status(500).json({ ok: false, msg: "Could not clear trades" });
  }
};
