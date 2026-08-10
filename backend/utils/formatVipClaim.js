const normalizeId = require("./normalizeId");

function formatVipClaim(doc) {
  const json = doc?.toJSON ? doc.toJSON() : doc;
  return {
    id: json.id || json._id?.toString(),
    userId: normalizeId(json.userId) || normalizeId(json.user?._id) || normalizeId(json.user),
    level: json.level,
    name: json.name,
    requiredRecharge: json.requiredRecharge,
    reward: json.reward,
    totalRechargeAtClaim: json.totalRechargeAtClaim,
    claimedAt: json.claimedAt,
  };
}

module.exports = formatVipClaim;
