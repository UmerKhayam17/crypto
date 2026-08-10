/** Recharge activity VIP tiers (cumulative approved deposits). */
const VIP_TIERS = [
  { level: 1, name: "VIP 1", required: 1000, reward: 200 },
  { level: 2, name: "VIP 2", required: 3000, reward: 500 },
  { level: 3, name: "VIP 3", required: 5000, reward: 1000 },
  { level: 4, name: "VIP 4", required: 10000, reward: 3000 },
  { level: 5, name: "VIP 5", required: 20000, reward: 5000 },
  { level: 6, name: "SVIP 6", required: 50000, reward: 10000 },
];

function getTier() {
  return VIP_TIERS.map((t) => ({ ...t }));
}

function getTierByLevel(level) {
  return VIP_TIERS.find((t) => t.level === Number(level)) || null;
}

module.exports = { VIP_TIERS, getTier, getTierByLevel };
