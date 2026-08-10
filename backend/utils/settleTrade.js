const { fetchMarkPrice } = require("./markPrice");

function pickPercents(trade, user, globalPayoutPercent) {
  let profitPercent =
    trade.customProfitPercent ??
    user.profitPercent ??
    globalPayoutPercent ??
    85;
  let lossPercent = trade.customLossPercent ?? user.lossPercent ?? 100;

  profitPercent = Number(profitPercent);
  lossPercent = Number(lossPercent);
  if (!Number.isFinite(profitPercent)) profitPercent = 85;
  if (!Number.isFinite(lossPercent)) lossPercent = 100;
  profitPercent = Math.min(500, Math.max(0, profitPercent));
  lossPercent = Math.min(100, Math.max(0, lossPercent));
  return { profitPercent, lossPercent };
}

function computeResult({ won, stake, profitPercent, lossPercent }) {
  if (won) {
    const payout = stake * (1 + profitPercent / 100);
    return { payout, pnl: payout - stake };
  }
  const lostAmount = stake * (Math.min(100, Math.max(0, lossPercent)) / 100);
  const payout = Math.max(0, stake - lostAmount);
  return { payout, pnl: payout - stake };
}

function decideWin(trade, user, closePrice) {
  if (trade.plannedOutcome === "profit") {
    return { won: true, source: "planned" };
  }
  if (trade.plannedOutcome === "loss") {
    return { won: false, source: "planned" };
  }
  if (user.forceOutcome === "win") {
    return { won: true, source: "forced-win" };
  }
  if (user.forceOutcome === "lose") {
    return { won: false, source: "forced-loss" };
  }
  const moved = closePrice - trade.entryPrice;
  const won = trade.direction === "up" ? moved > 0 : moved < 0;
  return { won, source: "market" };
}

/** Always resolves close via server mark price (client override ignored). */
async function settleTradeDoc(trade, user, globalPayoutPercent) {
  const closePrice = await fetchMarkPrice(trade.symbol, trade.entryPrice);
  const { won, source } = decideWin(trade, user, closePrice);
  const { profitPercent, lossPercent } = pickPercents(trade, user, globalPayoutPercent);
  const { payout, pnl } = computeResult({ won, stake: trade.stake, profitPercent, lossPercent });

  trade.status = won ? "won" : "lost";
  trade.closePrice = closePrice;
  trade.payout = payout;
  trade.pnl = pnl;
  trade.resolvedAt = Date.now();
  trade.outcomeSource = source;

  return { payout, pnl, won, closePrice };
}

function settleTradeForced(trade, user, globalPayoutPercent, outcome, profitPercent, lossPercent) {
  const won = outcome === "profit";
  const clampedProfit =
    profitPercent != null ? Math.min(500, Math.max(0, Number(profitPercent))) : undefined;
  const clampedLoss =
    lossPercent != null ? Math.min(100, Math.max(0, Number(lossPercent))) : undefined;

  if (clampedProfit != null && !Number.isFinite(clampedProfit)) {
    throw new Error("Invalid profit percent");
  }
  if (clampedLoss != null && !Number.isFinite(clampedLoss)) {
    throw new Error("Invalid loss percent");
  }

  const pct = pickPercents(
    {
      customProfitPercent: clampedProfit ?? trade.customProfitPercent,
      customLossPercent: clampedLoss ?? trade.customLossPercent,
    },
    user,
    globalPayoutPercent
  );
  if (clampedProfit != null) trade.customProfitPercent = clampedProfit;
  if (clampedLoss != null) trade.customLossPercent = clampedLoss;

  const { payout, pnl } = computeResult({
    won,
    stake: trade.stake,
    profitPercent: pct.profitPercent,
    lossPercent: pct.lossPercent,
  });

  trade.status = won ? "won" : "lost";
  trade.closePrice = trade.entryPrice;
  trade.payout = payout;
  trade.pnl = pnl;
  trade.resolvedAt = Date.now();
  trade.outcomeSource = "admin";
  trade.plannedOutcome = null;

  return { payout, pnl, won };
}

module.exports = {
  settleTradeDoc,
  settleTradeForced,
  fetchClosePrice: fetchMarkPrice,
  pickPercents,
  computeResult,
};
