const { fetchMarkPrice } = require("./markPrice");
const {
  profitPercentForDuration,
  FULL_LOSS_PERCENT,
} = require("./durationPayout");

function pickPercents(trade, user, globalPayoutPercent) {
  const durationProfit = profitPercentForDuration(trade?.durationSec);
  let profitPercent =
    trade.customProfitPercent ??
    durationProfit ??
    user?.profitPercent ??
    globalPayoutPercent ??
    40;

  // Loss is always the full stake unless an admin sets a custom loss on this trade
  let lossPercent =
    trade.customLossPercent != null ? trade.customLossPercent : FULL_LOSS_PERCENT;

  profitPercent = Number(profitPercent);
  lossPercent = Number(lossPercent);
  if (!Number.isFinite(profitPercent)) profitPercent = durationProfit ?? 40;
  if (!Number.isFinite(lossPercent)) lossPercent = FULL_LOSS_PERCENT;
  profitPercent = Math.min(500, Math.max(0, profitPercent));
  lossPercent = Math.min(100, Math.max(0, lossPercent));
  return { profitPercent, lossPercent };
}

function computeResult({ won, draw, stake, profitPercent, lossPercent }) {
  if (draw) {
    return { payout: stake, pnl: 0 };
  }
  if (won) {
    const payout = stake * (1 + profitPercent / 100);
    return { payout, pnl: payout - stake };
  }
  const lostAmount = stake * (Math.min(100, Math.max(0, lossPercent)) / 100);
  const payout = Math.max(0, stake - lostAmount);
  return { payout, pnl: payout - stake };
}

function isFlatMove(entryPrice, closePrice) {
  const entry = Number(entryPrice);
  const close = Number(closePrice);
  if (!Number.isFinite(entry) || !Number.isFinite(close) || entry <= 0) return false;
  const moved = Math.abs(close - entry);
  // Treat as stable if unchanged within a tiny relative band (avoids float noise)
  return moved <= Math.max(1e-8, entry * 1e-8);
}

/** One "point" size by price magnitude so a nudge is visible on trade history. */
function pointSize(price) {
  const p = Number(price);
  if (!Number.isFinite(p) || p <= 0) return 1e-8;
  if (p >= 1000) return 0.01; // BTC: 10 points = $0.10
  if (p >= 1) return 0.0001; // SOL / LINK etc: 10 points = 0.001
  if (p >= 0.01) return 0.000001;
  return 1e-8;
}

function displayOffset(entry, close) {
  const entryN = Number(entry);
  const closeN = Number(close);
  const min = 10 * pointSize(entryN);
  if (!Number.isFinite(closeN)) return min;
  const delta = Math.abs(closeN - entryN);
  return Math.max(min, delta || 0);
}

/**
 * Make close price visually match the result:
 * - UP loss  → close below entry
 * - DOWN loss → close above entry
 * - UP win   → close above entry
 * - DOWN win → close below entry
 * Used when admin forces outcome, or when real mark contradicts the settled result.
 */
function alignClosePriceToOutcome(trade, closePrice, { won, draw }) {
  if (draw) return closePrice;
  const entry = Number(trade.entryPrice);
  if (!Number.isFinite(entry) || entry <= 0) return closePrice;

  const close = Number(closePrice);
  const closeSafe = Number.isFinite(close) ? close : entry;
  const movedUp = closeSafe > entry && !isFlatMove(entry, closeSafe);
  const movedDown = closeSafe < entry && !isFlatMove(entry, closeSafe);

  const looksCorrect = won
    ? trade.direction === "up"
      ? movedUp
      : movedDown
    : trade.direction === "up"
      ? movedDown
      : movedUp;

  if (looksCorrect) return closeSafe;

  const offset = displayOffset(entry, closeSafe);
  if (won) {
    // Winning side of the bet
    if (trade.direction === "up") return entry + offset;
    return Math.max(entry - offset, entry * 1e-12);
  }
  // Losing side of the bet
  if (trade.direction === "up") return Math.max(entry - offset, entry * 1e-12);
  return entry + offset;
}

function decideWin(trade, user, closePrice) {
  if (user.forceOutcome === "win") {
    return { won: true, draw: false, source: "forced-win" };
  }
  if (user.forceOutcome === "lose") {
    return { won: false, draw: false, source: "forced-loss" };
  }

  // Once market moved against the trade mid-duration, final status is always lost
  if (trade.lossLocked) {
    return { won: false, draw: false, source: "market" };
  }

  if (trade.plannedOutcome === "profit") {
    return { won: true, draw: false, source: "planned" };
  }
  if (trade.plannedOutcome === "loss") {
    return { won: false, draw: false, source: "planned" };
  }

  // Stable market (entry ≈ close): refund stake — not a loss
  if (isFlatMove(trade.entryPrice, closePrice)) {
    return { won: false, draw: true, source: "market" };
  }

  const moved = closePrice - trade.entryPrice;
  const won = trade.direction === "up" ? moved > 0 : moved < 0;
  return { won, draw: false, source: "market" };
}

/** Always resolves close via server mark price (client override ignored). */
async function settleTradeDoc(trade, user, globalPayoutPercent) {
  let closePrice = await fetchMarkPrice(trade.symbol, trade.entryPrice);
  const { won, draw, source } = decideWin(trade, user, closePrice);
  const { profitPercent, lossPercent } = pickPercents(trade, user, globalPayoutPercent);
  const { payout, pnl } = computeResult({
    won,
    draw,
    stake: trade.stake,
    profitPercent,
    lossPercent,
  });

  // Forced / planned outcomes (and any loss) must show close on the correct side of entry
  const shouldAlign =
    !draw &&
    (source === "forced-win" ||
      source === "forced-loss" ||
      source === "planned" ||
      !won);

  if (shouldAlign) {
    closePrice = alignClosePriceToOutcome(trade, closePrice, { won, draw });
  }

  trade.status = draw ? "draw" : won ? "won" : "lost";
  trade.closePrice = closePrice;
  trade.payout = payout;
  trade.pnl = pnl;
  trade.resolvedAt = Date.now();
  trade.outcomeSource = source;
  trade.lossLocked = false;

  return { payout, pnl, won, draw, closePrice };
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
    draw: false,
    stake: trade.stake,
    profitPercent: pct.profitPercent,
    lossPercent: pct.lossPercent,
  });

  let closePrice = alignClosePriceToOutcome(trade, trade.entryPrice, {
    won,
    draw: false,
  });

  trade.status = won ? "won" : "lost";
  trade.closePrice = closePrice;
  trade.payout = payout;
  trade.pnl = pnl;
  trade.resolvedAt = Date.now();
  trade.outcomeSource = "admin";
  trade.plannedOutcome = null;
  trade.lossLocked = false;

  return { payout, pnl, won };
}

module.exports = {
  settleTradeDoc,
  settleTradeForced,
  fetchClosePrice: fetchMarkPrice,
  pickPercents,
  computeResult,
  isFlatMove,
  alignClosePriceToOutcome,
};
