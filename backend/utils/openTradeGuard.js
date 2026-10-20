const Trade = require("../model/Trade");
const SpotPosition = require("../model/SpotPosition");

const OPEN_TRADE_MSG = "Need to close or complete the first trade";

async function hasOpenTrade(userId) {
  const [trade, spot] = await Promise.all([
    Trade.exists({ user: userId, status: { $in: ["active", "settling"] } }),
    SpotPosition.exists({ user: userId, status: { $in: ["open", "closing"] } }),
  ]);
  return Boolean(trade || spot);
}

module.exports = { OPEN_TRADE_MSG, hasOpenTrade };
