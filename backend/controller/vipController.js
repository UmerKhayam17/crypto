const Deposit = require("../model/Deposit");
const VipClaim = require("../model/VipClaim");
const User = require("../model/User");
const { getTiers, getTierByLevel, getStepRequired } = require("../constants/vipRewards");
const formatVipClaim = require("../utils/formatVipClaim");
const notify = require("../utils/realtimeNotify");

async function getTotalRecharge(userId) {
  const rows = await Deposit.aggregate([
    { $match: { user: userId, status: "approved" } },
    { $group: { _id: null, total: { $sum: "$amount" } } },
  ]);
  return rows[0]?.total || 0;
}

function buildStatus(totalRecharge, claims) {
  const claimedLevels = new Set(claims.map((c) => c.level));
  const nextLevel = claims.length === 0 ? 1 : Math.max(...claims.map((c) => c.level)) + 1;
  const tiers = getTiers();

  return tiers.map((tier, index) => {
    const prevRequired = index === 0 ? 0 : tiers[index - 1].required;
    const stepRequired = getStepRequired(tier.level) ?? Math.max(0, tier.required - prevRequired);

    // Progress for this VIP only starts after the previous VIP threshold is reached
    const previousReached = totalRecharge >= prevRequired;
    const rawInStep = previousReached ? Math.max(0, totalRecharge - prevRequired) : 0;
    const progressAmount = Math.min(stepRequired, rawInStep);
    const progress =
      stepRequired > 0 ? Math.min(100, (progressAmount / stepRequired) * 100) : 0;
    const remaining = Math.max(0, stepRequired - progressAmount);

    const claimed = claimedLevels.has(tier.level);
    const claimRecord = claims.find((c) => c.level === tier.level);
    const unlocked = totalRecharge >= tier.required;
    const isNext = tier.level === nextLevel;
    const claimable = !claimed && unlocked && isNext;

    let status = "locked";
    if (claimed || unlocked) {
      // Reached by recharge (claim UI removed) — treat as reached
      status = claimed ? "claimed" : "claimable";
    } else if (!previousReached) {
      status = "pending_previous";
    } else {
      status = "locked";
    }

    return {
      ...tier,
      stepRequired,
      progressAmount,
      remaining,
      status,
      claimed: claimed || unlocked,
      claimable,
      unlocked,
      claimedAt: claimRecord?.claimedAt,
      progress,
    };
  });
}

function currentVipFromRecharge(totalRecharge) {
  const tiers = getTiers();
  let current = null;
  for (const tier of tiers) {
    if (totalRecharge >= tier.required) current = tier;
    else break;
  }
  return current;
}

exports.getMyVipStatus = async (req, res) => {
  try {
    if (req.user.role !== "user") {
      return res.status(403).json({ ok: false, msg: "Only users can view recharge activity" });
    }

    const totalRecharge = await getTotalRecharge(req.user._id);
    const claims = await VipClaim.find({ user: req.user._id }).sort({ level: 1 });
    const tiers = buildStatus(totalRecharge, claims);
    const currentVip = currentVipFromRecharge(totalRecharge);

    return res.json({
      ok: true,
      totalRecharge,
      currentVipLevel: currentVip?.level || 0,
      currentVipName: currentVip?.name || null,
      tiers,
      claims: claims.map(formatVipClaim),
    });
  } catch (err) {
    console.error("getMyVipStatus error:", err);
    return res.status(500).json({ ok: false, msg: "Could not load recharge activity" });
  }
};

exports.claimVipReward = async (req, res) => {
  try {
    if (req.user.role !== "user") {
      return res.status(403).json({ ok: false, msg: "Only users can claim VIP rewards" });
    }
    if (req.user.suspended) {
      return res.status(403).json({ ok: false, msg: "Your account is suspended" });
    }

    const level = Number(req.body?.level);
    const tier = getTierByLevel(level);
    if (!tier) {
      return res.status(400).json({ ok: false, msg: "Invalid VIP level" });
    }

    const existing = await VipClaim.findOne({ user: req.user._id, level: tier.level });
    if (existing) {
      return res.status(400).json({ ok: false, msg: "This VIP reward has already been claimed" });
    }

    const claims = await VipClaim.find({ user: req.user._id }).sort({ level: 1 });
    const nextLevel = claims.length === 0 ? 1 : Math.max(...claims.map((c) => c.level)) + 1;
    if (tier.level !== nextLevel) {
      return res.status(400).json({
        ok: false,
        msg:
          tier.level < nextLevel
            ? "This VIP reward has already been claimed"
            : `Claim rewards in order. Next available: level ${nextLevel}`,
      });
    }

    const totalRecharge = await getTotalRecharge(req.user._id);
    if (totalRecharge < tier.required) {
      return res.status(400).json({
        ok: false,
        msg: `Need $${tier.required.toFixed(0)} total recharge (you have $${totalRecharge.toFixed(2)})`,
      });
    }

    const user = await User.findById(req.user._id);
    if (!user) return res.status(404).json({ ok: false, msg: "User not found" });

    const claim = await VipClaim.create({
      user: user._id,
      level: tier.level,
      name: tier.name,
      requiredRecharge: tier.required,
      reward: tier.reward,
      totalRechargeAtClaim: totalRecharge,
      claimedAt: Date.now(),
    });

    const { creditWallet } = require("../utils/wallet");
    const updated = await creditWallet(user._id, tier.reward);
    if (!updated) {
      await VipClaim.deleteOne({ _id: claim._id });
      return res.status(404).json({ ok: false, msg: "User not found" });
    }
    const cash = updated.wallet?.cashUSDT ?? 0;

    const allClaims = await VipClaim.find({ user: user._id }).sort({ level: 1 });
    const tiers = buildStatus(totalRecharge, allClaims);

    notify.userUpdated(require("../utils/formatUser")(updated));

    return res.json({
      ok: true,
      msg: `${tier.name} reward claimed — +$${tier.reward.toFixed(2)} USDT`,
      claim: formatVipClaim(claim),
      wallet: { cashUSDT: cash },
      totalRecharge,
      currentVipLevel: tier.level,
      currentVipName: tier.name,
      tiers,
    });
  } catch (err) {
    if (err?.code === 11000) {
      return res.status(400).json({ ok: false, msg: "This VIP reward has already been claimed" });
    }
    console.error("claimVipReward error:", err);
    return res.status(500).json({ ok: false, msg: "Could not claim VIP reward" });
  }
};

exports.listVipClaims = async (req, res) => {
  try {
    if (req.user.role !== "admin" && req.user.role !== "staff") {
      return res.status(403).json({ ok: false, msg: "Admin/staff access required" });
    }

    let query = {};
    if (req.user.role === "staff") {
      const assigned = await User.find({ role: "user", assignedStaff: req.user._id }).select("_id");
      const ids = assigned.map((u) => u._id);
      if (ids.length === 0) return res.json({ ok: true, claims: [] });
      query = { user: { $in: ids } };
    }

    const claims = await VipClaim.find(query)
      .populate("user", "fname lname email")
      .sort({ claimedAt: -1 })
      .limit(200);

    return res.json({
      ok: true,
      claims: claims.map((c) => {
        const formatted = formatVipClaim(c);
        return {
          ...formatted,
          userName: c.user?.name || `${c.user?.fname || ""} ${c.user?.lname || ""}`.trim(),
          userEmail: c.user?.email,
        };
      }),
    });
  } catch (err) {
    console.error("listVipClaims error:", err);
    return res.status(500).json({ ok: false, msg: "Could not load VIP claims" });
  }
};
