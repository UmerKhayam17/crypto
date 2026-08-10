const normalizeId = require("./normalizeId");

function formatTrade(doc, opts = {}) {
  const staff = !!opts.staff;
  const json = doc.toJSON ? doc.toJSON() : doc;
  const userId = normalizeId(json.user) || normalizeId(json.userId) || "";

  const base = {
    id: json.id || json._id?.toString(),
    userId,
    symbol: json.symbol,
    direction: json.direction,
    stake: json.stake,
    durationSec: json.durationSec,
    entryPrice: json.entryPrice,
    openedAt: json.openedAt,
    expiresAt: json.expiresAt,
    status: json.status === "settling" ? "active" : json.status,
    closePrice: json.closePrice,
    payout: json.payout,
    pnl: json.pnl,
    resolvedAt: json.resolvedAt,
  };

  if (!staff) return base;

  return {
    ...base,
    outcomeSource: json.outcomeSource,
    plannedOutcome: json.plannedOutcome || undefined,
    customProfitPercent: json.customProfitPercent,
    customLossPercent: json.customLossPercent,
  };
}

module.exports = formatTrade;
