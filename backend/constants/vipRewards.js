/** Recharge activity VIP tiers.
 * `required` = cumulative approved deposits to unlock this level.
 * Progress for each level is counted only in the segment after the previous level.
 * e.g. VIP1 0→1000, VIP2 1000→3000 (starts at $0 after VIP1), VIP3 3000→5000, …
 */
const VIP_TIERS = [
  { level: 1, name: "VIP 1", required: 1000, reward: 200 },
  { level: 2, name: "VIP 2", required: 3000, reward: 500 },
  { level: 3, name: "VIP 3", required: 5000, reward: 1000 },
  { level: 4, name: "VIP 4", required: 10000, reward: 3000 },
  { level: 5, name: "VIP 5", required: 20000, reward: 5000 },
  { level: 6, name: "SVIP 6", required: 50000, reward: 10000 },
];

function getTiers() {
  return VIP_TIERS.map((t) => ({ ...t }));
}

function getTierByLevel(level) {
  return VIP_TIERS.find((t) => t.level === Number(level)) || null;
}

/** Incremental deposit amount needed for this level after the previous one. */
function getStepRequired(level) {
  const tiers = VIP_TIERS;
  const idx = tiers.findIndex((t) => t.level === Number(level));
  if (idx < 0) return null;
  const prev = idx === 0 ? 0 : tiers[idx - 1].required;
  return Math.max(0, tiers[idx].required - prev);
}

module.exports = { VIP_TIERS, getTiers, getTierByLevel, getStepRequired };
