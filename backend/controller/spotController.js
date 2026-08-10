const SpotPosition = require("../model/SpotPosition");
const User = require("../model/User");
const Settings = require("../model/Settings");
const formatSpotPosition = require("../utils/formatSpotPosition");
const notify = require("../utils/realtimeNotify");

async function getSpotFeePercent() {
  const settings = await Settings.getSettings();
  const pct = Number(settings.spotFeePercent);
  return Number.isFinite(pct) && pct >= 0 ? pct : 0.1;
}

async function canAccessUser(actor, userId) {
  if (actor.role === "admin") return true;
  if (actor.role !== "staff") return false;
  const target = await User.findOne({ _id: userId, role: "user" });
  if (!target) return false;
  return String(target.assignedStaff) === String(actor._id);
}

function calcOpen(entryPrice, quantity, feePercent) {
  const notional = entryPrice * quantity;
  const entryFee = notional * (feePercent / 100);
  const cost = notional + entryFee;
  return { notional, entryFee, cost };
}

/** Long close: sold higher than buy → profit */
function calcCloseLong(entryPrice, exitPrice, quantity, entryFee, feePercent) {
  const exitNotional = exitPrice * quantity;
  const exitFee = exitNotional * (feePercent / 100);
  const sellProceeds = exitNotional - exitFee;
  const openCost = entryPrice * quantity + entryFee;
  const pnl = sellProceeds - openCost;
  const pnlPercent = entryPrice > 0 ? ((exitPrice - entryPrice) / entryPrice) * 100 : 0;
  const credit = sellProceeds;
  return { exitFee, proceeds: credit, pnl, pnlPercent };
}

/** Short close: bought back lower than sell → profit */
function calcCloseShort(entryPrice, exitPrice, quantity, entryFee, feePercent) {
  const exitNotional = exitPrice * quantity;
  const exitFee = exitNotional * (feePercent / 100);
  const pnl = (entryPrice - exitPrice) * quantity - entryFee - exitFee;
  const pnlPercent = entryPrice > 0 ? ((entryPrice - exitPrice) / entryPrice) * 100 : 0;
  const openCost = entryPrice * quantity + entryFee;
  const credit = openCost + pnl;
  return { exitFee, proceeds: credit, pnl, pnlPercent };
}

exports.openSpot = async (req, res) => {
  try {
    const user = req.user;
    if (user.role !== "user") {
      return res.status(403).json({ ok: false, msg: "Only platform users can trade spot" });
    }
    if (user.suspended) {
      return res.status(403).json({ ok: false, msg: "Your account is suspended" });
    }
    if (user.kyc?.status !== "approved") {
      return res.status(400).json({ ok: false, msg: "Complete KYC verification to start trading" });
    }

    const { symbol, quantity, entryPrice, side } = req.body;
    const qty = Number(quantity);
    const price = Number(entryPrice ?? req.body.buyPrice);
    const openSide = side === "sell" ? "sell" : "buy";

    if (!symbol || typeof symbol !== "string") {
      return res.status(400).json({ ok: false, msg: "Symbol is required" });
    }
    if (!Number.isFinite(qty) || qty <= 0) {
      return res.status(400).json({ ok: false, msg: "Enter a quantity greater than 0" });
    }
    if (!Number.isFinite(price) || price <= 0) {
      return res.status(400).json({ ok: false, msg: "Invalid entry price" });
    }

    const feePercent = await getSpotFeePercent();
    const { entryFee, cost } = calcOpen(price, qty, feePercent);

    user.wallet = user.wallet || { cashUSDT: 0 };
    if (cost > user.wallet.cashUSDT) {
      return res.status(400).json({
        ok: false,
        msg: `Insufficient balance (need $${cost.toFixed(2)}, have $${user.wallet.cashUSDT.toFixed(2)})`,
      });
    }

    user.wallet.cashUSDT -= cost;
    await user.save();

    const position = await SpotPosition.create({
      user: user._id,
      symbol,
      side: openSide,
      quantity: qty,
      entryPrice: price,
      entryFee,
      cost,
      openedAt: Date.now(),
      status: "open",
      ...(openSide === "buy"
        ? { buyPrice: price, buyFee: entryFee }
        : { sellPrice: price, sellFee: entryFee }),
    });

    const formatted = formatSpotPosition(position);
    notify.spotUpsert(formatted, {
      wallet: { cashUSDT: user.wallet.cashUSDT },
      userId: user._id.toString(),
    });

    const label = openSide === "buy" ? "Buy / Long" : "Sell / Short";
    return res.status(201).json({
      ok: true,
      msg: `${label} ${qty} ${symbol} @ $${price}`,
      position: formatted,
      wallet: { cashUSDT: user.wallet.cashUSDT },
      spotFeePercent: feePercent,
    });
  } catch (err) {
    console.error("Open spot error:", err);
    return res.status(500).json({ ok: false, msg: "Could not open spot position" });
  }
};

exports.closeSpot = async (req, res) => {
  try {
    const actor = req.user;
    if (actor.role !== "user") {
      return res.status(403).json({ ok: false, msg: "Only users can close their spot positions" });
    }

    const position = await SpotPosition.findOne({ _id: req.params.id, user: actor._id });
    if (!position) return res.status(404).json({ ok: false, msg: "Position not found" });
    if (position.status !== "open") {
      return res.status(400).json({ ok: false, msg: "Position is already closed" });
    }

    const exitPrice = Number(req.body.exitPrice ?? req.body.sellPrice ?? req.body.buyPrice);
    if (!Number.isFinite(exitPrice) || exitPrice <= 0) {
      return res.status(400).json({ ok: false, msg: "Invalid exit price" });
    }

    const side = position.side === "sell" ? "sell" : "buy";
    const entryPrice =
      position.entryPrice ?? (side === "buy" ? position.buyPrice : position.sellPrice);
    const entryFee =
      position.entryFee ?? (side === "buy" ? position.buyFee : position.sellFee) ?? 0;

    const feePercent = await getSpotFeePercent();
    const settled =
      side === "buy"
        ? calcCloseLong(entryPrice, exitPrice, position.quantity, entryFee, feePercent)
        : calcCloseShort(entryPrice, exitPrice, position.quantity, entryFee, feePercent);

    const user = await User.findById(actor._id);
    if (!user) return res.status(404).json({ ok: false, msg: "User not found" });

    user.wallet = user.wallet || { cashUSDT: 0 };
    user.wallet.cashUSDT = (user.wallet.cashUSDT || 0) + settled.proceeds;
    await user.save();

    position.status = "closed";
    position.entryPrice = entryPrice;
    position.entryFee = entryFee;
    position.exitPrice = exitPrice;
    position.exitFee = settled.exitFee;
    position.proceeds = settled.proceeds;
    position.pnl = settled.pnl;
    position.pnlPercent = settled.pnlPercent;
    position.closedAt = Date.now();
    if (side === "buy") {
      position.sellPrice = exitPrice;
      position.sellFee = settled.exitFee;
    } else {
      position.buyPrice = exitPrice;
      position.buyFee = settled.exitFee;
    }
    await position.save();

    const formatted = formatSpotPosition(position);
    notify.spotUpsert(formatted, {
      wallet: { cashUSDT: user.wallet.cashUSDT },
      userId: user._id.toString(),
    });

    const action = side === "buy" ? "Sold" : "Bought back";
    return res.json({
      ok: true,
      msg:
        settled.pnl >= 0
          ? `${action} — profit +$${settled.pnl.toFixed(2)} (${settled.pnlPercent.toFixed(2)}%)`
          : `${action} — loss $${Math.abs(settled.pnl).toFixed(2)} (${settled.pnlPercent.toFixed(2)}%)`,
      position: formatted,
      wallet: { cashUSDT: user.wallet.cashUSDT },
    });
  } catch (err) {
    console.error("Close spot error:", err);
    return res.status(500).json({ ok: false, msg: "Could not close spot position" });
  }
};

exports.listMySpot = async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    const positions = await SpotPosition.find({ user: req.user._id }).sort({ createdAt: -1 });
    const feePercent = await getSpotFeePercent();
    return res.json({
      ok: true,
      positions: positions.map(formatSpotPosition),
      wallet: { cashUSDT: user?.wallet?.cashUSDT ?? 0 },
      spotFeePercent: feePercent,
    });
  } catch (err) {
    console.error("List my spot error:", err);
    return res.status(500).json({ ok: false, msg: "Could not load spot positions" });
  }
};

exports.listSpot = async (req, res) => {
  try {
    let query = {};
    if (req.user.role === "staff") {
      const assigned = await User.find({ role: "user", assignedStaff: req.user._id }).select("_id");
      const ids = assigned.map((u) => u._id);
      if (ids.length === 0) return res.json({ ok: true, positions: [] });
      query = { user: { $in: ids } };
    }

    const userId = req.query.userId;
    if (userId) {
      const allowed = await canAccessUser(req.user, userId);
      if (!allowed) return res.status(403).json({ ok: false, msg: "Not authorized for this user" });
      query.user = userId;
    }

    const positions = await SpotPosition.find(query)
      .populate("user", "fname lname email")
      .sort({ createdAt: -1 })
      .limit(300);

    return res.json({ ok: true, positions: positions.map(formatSpotPosition) });
  } catch (err) {
    console.error("List spot error:", err);
    return res.status(500).json({ ok: false, msg: "Could not load spot positions" });
  }
};

exports.getSpotFee = async (_req, res) => {
  try {
    const spotFeePercent = await getSpotFeePercent();
    return res.json({ ok: true, spotFeePercent });
  } catch (err) {
    return res.status(500).json({ ok: false, msg: "Could not load spot fee" });
  }
};
