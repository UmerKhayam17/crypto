const CRYPTO_SYMBOLS = new Set(
  [
    "BTC/USDT", "ETH/USDT", "SOL/USDT", "BNB/USDT", "XRP/USDT", "ADA/USDT", "DOGE/USDT",
    "AVAX/USDT", "LINK/USDT", "MATIC/USDT", "DOT/USDT", "TRX/USDT", "TON/USDT", "SHIB/USDT",
    "LTC/USDT", "BCH/USDT", "UNI/USDT", "ATOM/USDT", "NEAR/USDT", "ICP/USDT", "APT/USDT",
    "FIL/USDT", "ARB/USDT", "OP/USDT", "INJ/USDT", "SUI/USDT", "SEI/USDT", "TIA/USDT",
    "RUNE/USDT", "AAVE/USDT", "MKR/USDT", "SNX/USDT", "CRV/USDT", "LDO/USDT", "GRT/USDT",
    "SAND/USDT", "MANA/USDT", "AXS/USDT", "GALA/USDT", "CHZ/USDT", "FLOW/USDT", "ALGO/USDT",
    "XLM/USDT", "VET/USDT", "HBAR/USDT", "EOS/USDT", "XTZ/USDT", "EGLD/USDT", "KAVA/USDT",
    "MINA/USDT", "ROSE/USDT", "IMX/USDT", "RNDR/USDT", "FTM/USDT", "KSM/USDT", "ZIL/USDT",
    "BAT/USDT", "ZRX/USDT", "COMP/USDT", "YFI/USDT", "SUSHI/USDT", "1INCH/USDT", "DYDX/USDT",
    "ENJ/USDT", "JASMY/USDT", "WLD/USDT", "ORDI/USDT", "BLUR/USDT", "PEPE/USDT",
  ]
);

function toBinanceSymbol(symbol) {
  if (!CRYPTO_SYMBOLS.has(symbol)) return null;
  return symbol.replace("/", "");
}

async function fetchClosePrice(symbol, entryPrice) {
  const binance = toBinanceSymbol(symbol);
  if (binance) {
    try {
      const res = await fetch(`https://api.binance.com/api/v3/ticker/price?symbol=${binance}`);
      if (res.ok) {
        const data = await res.json();
        const price = parseFloat(data.price);
        if (Number.isFinite(price)) return price;
      }
    } catch {
      // fall through
    }
  }
  const drift = (Math.random() - 0.5) * 0.002;
  return Number((entryPrice * (1 + drift)).toFixed(8));
}

function pickPercents(trade, user, globalPayoutPercent) {
  const profitPercent =
    trade.customProfitPercent ??
    user.profitPercent ??
    globalPayoutPercent ??
    85;
  const lossPercent = trade.customLossPercent ?? user.lossPercent ?? 100;
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
  return { won, source: "random" };
}

async function settleTradeDoc(trade, user, globalPayoutPercent, closePriceOverride) {
  const closePrice =
    closePriceOverride != null
      ? closePriceOverride
      : await fetchClosePrice(trade.symbol, trade.entryPrice);
  const { won, source } = decideWin(trade, user, closePrice);
  const { profitPercent, lossPercent } = pickPercents(trade, user, globalPayoutPercent);
  const { payout, pnl } = computeResult({ won, stake: trade.stake, profitPercent, lossPercent });

  trade.status = won ? "won" : "lost";
  trade.closePrice = closePrice;
  trade.payout = payout;
  trade.pnl = pnl;
  trade.resolvedAt = Date.now();
  trade.outcomeSource = source;

  return { payout, pnl, won };
}

function settleTradeForced(trade, user, globalPayoutPercent, outcome, profitPercent, lossPercent) {
  const won = outcome === "profit";
  const pct = pickPercents(
    {
      customProfitPercent: profitPercent ?? trade.customProfitPercent,
      customLossPercent: lossPercent ?? trade.customLossPercent,
    },
    user,
    globalPayoutPercent
  );
  if (profitPercent != null) trade.customProfitPercent = profitPercent;
  if (lossPercent != null) trade.customLossPercent = lossPercent;

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
  fetchClosePrice,
  pickPercents,
  computeResult,
};
