const Deposit = require("../model/Deposit");
const VipClaim = require("../model/VipClaim");
const User = require("../model/User");
const { getTiers, getTierByLevel, getStepRequired } = require("../constants/vipRewards");
const formatVipClaim = require("../utils/formatVipClaim");

async function getTotalRecharge(userId) {
  const rows = await Deposit.aggregate([
    { $match: { user: userId, status: "approved" } },
    { $group: { _id: null, total: { $sum: "$amount" } } },
  ]);
  return rows[0]?.total || 0;
}

/** Sum of step amounts already spent on claimed tiers. */
function getSpentRecharge(claims) {
  const tiers = getTiers();
  let spent = 0;
  for (const c of claims) {
    const tier = tiers.find((t) => t.level === c.level);
    if (tier) spent += tier.required;
  }
  return spent;
}

/**
 * Highest unclaimed tier whose step fits in remaining recharge.
 * Lower tiers stay skipped (no reward) when a higher one is claimed.
 */
function getHighestClaimableLevel(available, maxClaimed) {
  const tiers = getTiers();
  let highest = null;
  for (const tier of tiers) {
    if (tier.level <= maxClaimed) continue;
    if (tier.required <= available) highest = tier.level;
  }
  return highest;
}

function buildStatus(totalRecharge, claims) {
  const claimedLevels = new Set(claims.map((c) => c.level));
  const maxClaimed =
    claims.length === 0 ? 0 : Math.max(...claims.map((c) => c.level));
  const spent = getSpentRecharge(claims);
  const available = Math.max(0, totalRecharge - spent);
  const highestClaimable = getHighestClaimableLevel(available, maxClaimed);
  const tiers = getTiers();

  // Next step being filled: first level after maxClaimed (progress target)
  const nextLevel = maxClaimed + 1;

  return tiers.map((tier) => {
    const stepRequired = getStepRequired(tier.level) ?? tier.required;
    const claimed = claimedLevels.has(tier.level);
    const claimRecord = claims.find((c) => c.level === tier.level);
    const skipped = !claimed && tier.level < maxClaimed;
    const claimable = !claimed && !skipped && tier.level === highestClaimable;

    let progressAmount = 0;
    let remaining = stepRequired;
    let progress = 0;

    if (claimed || skipped) {
      progressAmount = stepRequired;
      remaining = 0;
      progress = 100;
    } else if (tier.level === nextLevel || tier.level === highestClaimable) {
      // Progress counts toward the next open step (or the highest claimable jump)
      progressAmount = Math.min(stepRequired, available);
      remaining = Math.max(0, stepRequired - progressAmount);
      progress = stepRequired > 0 ? Math.min(100, (progressAmount / stepRequired) * 100) : 0;
    } else if (tier.level < (highestClaimable || nextLevel)) {
      // Would be skipped if user claims the higher tier
      progressAmount = 0;
      remaining = stepRequired;
      progress = 0;
    } else {
      progressAmount = 0;
      remaining = stepRequired;
      progress = 0;
    }

    const unlocked = claimable || claimed;
    let status = "locked";
    if (claimed) status = "claimed";
    else if (skipped) status = "skipped";
    else if (claimable) status = "claimable";
    else if (tier.level > nextLevel && !highestClaimable) status = "pending_previous";
    else if (tier.level > (highestClaimable || nextLevel)) status = "pending_previous";
    else status = "locked";

    return {
      ...tier,
      stepRequired,
      progressAmount,
      remaining,
      status,
      claimed,
      claimable,
      unlocked,
      skipped,
      claimedAt: claimRecord?.claimedAt,
      progress,
    };
  });
}

function currentVipFromClaims(claims) {
  if (!claims.length) return null;
  const maxLevel = Math.max(...claims.map((c) => c.level));
  return getTierByLevel(maxLevel);
}

exports.getMyVipStatus = async (req, res) => {
  try {
    if (req.user.role !== "user") {
      return res.status(403).json({ ok: false, msg: "Only users can view recharge activity" });
    }

    const totalRecharge = await getTotalRecharge(req.user._id);
    const claims = await VipClaim.find({ user: req.user._id }).sort({ level: 1 });
    const tiers = buildStatus(totalRecharge, claims);
    const currentVip = currentVipFromClaims(claims);

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

exports.claimVipReward = async (_req, res) => {
  return res.status(403).json({ ok: false, msg: "VIP rewards cannot be claimed from your account" });
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
