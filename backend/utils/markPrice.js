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
  if (!symbol || typeof symbol !== "string") return null;
  if (!CRYPTO_SYMBOLS.has(symbol)) return null;
  return symbol.replace("/", "");
}

function isAllowedTradeSymbol(symbol) {
  return CRYPTO_SYMBOLS.has(symbol);
}

/**
 * Fetch live mark price from Binance. Falls back to hint only if oracle fails.
 * Never trusts client as primary source.
 */
async function fetchMarkPrice(symbol, fallbackHint) {
  const binance = toBinanceSymbol(symbol);
  if (binance) {
    try {
      const res = await fetch(`https://api.binance.com/api/v3/ticker/price?symbol=${binance}`);
      if (res.ok) {
        const data = await res.json();
        const price = parseFloat(data.price);
        if (Number.isFinite(price) && price > 0) return price;
      }
    } catch {
      // fall through
    }
  }
  const hint = Number(fallbackHint);
  if (Number.isFinite(hint) && hint > 0) {
    const drift = (Math.random() - 0.5) * 0.0005;
    return Number((hint * (1 + drift)).toFixed(8));
  }
  throw new Error(`Could not resolve mark price for ${symbol}`);
}

module.exports = {
  CRYPTO_SYMBOLS,
  toBinanceSymbol,
  isAllowedTradeSymbol,
  fetchMarkPrice,
};
