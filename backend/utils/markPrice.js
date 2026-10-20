const CRYPTO_SYMBOLS = new Set(
  [
    "BTC/USDT", "ETH/USDT", "SOL/USDT", "BNB/USDT", "XRP/USDT", "ADA/USDT", "DOGE/USDT",
    "AVAX/USDT", "LINK/USDT", "POL/USDT", "DOT/USDT", "TRX/USDT", "SHIB/USDT",
    "LTC/USDT", "BCH/USDT", "UNI/USDT", "ATOM/USDT", "NEAR/USDT", "ICP/USDT", "APT/USDT",
    "FIL/USDT", "ARB/USDT", "OP/USDT", "INJ/USDT", "SUI/USDT", "SEI/USDT", "TIA/USDT",
    "RUNE/USDT", "AAVE/USDT", "SKY/USDT", "SNX/USDT", "CRV/USDT", "LDO/USDT", "GRT/USDT",
    "SAND/USDT", "MANA/USDT", "AXS/USDT", "GALA/USDT", "CHZ/USDT", "FLOW/USDT", "ALGO/USDT",
    "XLM/USDT", "VET/USDT", "HBAR/USDT", "A/USDT", "XTZ/USDT", "EGLD/USDT", "KAVA/USDT",
    "MINA/USDT", "ROSE/USDT", "IMX/USDT", "RENDER/USDT", "S/USDT", "KSM/USDT", "ZIL/USDT",
    "BAT/USDT", "ZRX/USDT", "COMP/USDT", "YFI/USDT", "SUSHI/USDT", "1INCH/USDT", "DYDX/USDT",
    "ENJ/USDT", "JASMY/USDT", "WLD/USDT", "ORDI/USDT", "BLUR/USDT", "PEPE/USDT",
    "FLOKI/USDT", "BONK/USDT", "WIF/USDT", "JUP/USDT", "PYTH/USDT", "JTO/USDT",
    "STRK/USDT", "DYM/USDT", "ALT/USDT", "MANTA/USDT", "ENS/USDT", "BAND/USDT",
    "KNC/USDT", "ANKR/USDT", "CELO/USDT",
    "IOTA/USDT", "NEO/USDT", "DASH/USDT", "XEC/USDT", "AR/USDT", "GMT/USDT",
    "APE/USDT", "MASK/USDT", "CFX/USDT", "STX/USDT", "QNT/USDT", "BTTC/USDT",
    "HOT/USDT", "RVN/USDT", "ZEC/USDT", "ETC/USDT", "DGB/USDT",
    "CAKE/USDT", "GMX/USDT", "WOO/USDT", "FET/USDT",
  ]
);

/** Any BASE/USDT pair, so a coin shown in the app is tradable even if it is not listed above. */
const CRYPTO_PAIR = /^[A-Z0-9]{1,20}\/USDT$/;

const METAL_SYMBOLS = new Set(["XAU/USD", "XAG/USD", "XPT/USD", "XPD/USD"]);
const STOCK_SYMBOLS = new Set(["AAPL", "TSLA", "NVDA"]);

const FOREX_SYMBOLS = new Set(
  [
    "USD/EUR", "USD/GBP", "USD/JPY", "USD/CHF", "USD/AUD", "USD/CAD", "USD/NZD",
    "USD/CNY", "USD/HKD", "USD/SGD", "USD/INR", "USD/PKR", "USD/TRY", "USD/ZAR",
    "USD/MXN", "USD/BRL", "USD/RUB", "USD/PLN", "USD/SEK", "USD/NOK", "USD/DKK",
    "USD/THB", "USD/IDR", "USD/MYR", "USD/KRW", "USD/AED", "USD/SAR", "USD/UZS",
  ]
);

const GOLD_SYMBOL = "XAU/USD";

/** @type {{ at: number, rates: Record<string, number> } | null} */
let forexCache = null;
const FOREX_CACHE_MS = 60_000;

/** @type {{ at: number, price: number } | null} */
let goldCache = null;
const GOLD_CACHE_MS = 10_000;

function plausibleGold(price) {
  return Number.isFinite(price) && price > 500 && price < 50000;
}

function isCryptoSymbol(symbol) {
  return typeof symbol === "string" && (CRYPTO_SYMBOLS.has(symbol) || CRYPTO_PAIR.test(symbol));
}

function toBinanceSymbol(symbol) {
  if (!isCryptoSymbol(symbol)) return null;
  return symbol.replace("/", "");
}

function isAllowedTradeSymbol(symbol) {
  return (
    isCryptoSymbol(symbol) ||
    FOREX_SYMBOLS.has(symbol) ||
    METAL_SYMBOLS.has(symbol) ||
    STOCK_SYMBOLS.has(symbol)
  );
}

function forexQuote(symbol) {
  if (!FOREX_SYMBOLS.has(symbol)) return null;
  return symbol.slice(4);
}

async function fetchGoldSpot() {
  if (goldCache && Date.now() - goldCache.at < GOLD_CACHE_MS) {
    return goldCache.price;
  }

  let spot = NaN;
  let paxg = NaN;
  try {
    const res = await fetch("https://api.gold-api.com/price/XAU");
    if (res.ok) {
      const data = await res.json();
      spot = Number(data.price);
    }
  } catch {
    // fall through to the PAXG market price
  }
  try {
    const res = await fetch("https://api.binance.com/api/v3/ticker/price?symbol=PAXGUSDT");
    if (res.ok) {
      const data = await res.json();
      paxg = parseFloat(data.price);
    }
  } catch {
    // fall through
  }

  const price = plausibleGold(spot) ? spot : paxg;
  if (!plausibleGold(price)) throw new Error("Gold quote unavailable");
  goldCache = { at: Date.now(), price };
  return price;
}

async function fetchForexUsdRates() {
  if (forexCache && Date.now() - forexCache.at < FOREX_CACHE_MS) {
    return forexCache.rates;
  }
  const res = await fetch("https://open.er-api.com/v6/latest/USD");
  if (!res.ok) throw new Error(`Forex HTTP ${res.status}`);
  const data = await res.json();
  if (data.result !== "success" || !data.rates) throw new Error("Forex payload invalid");
  forexCache = { at: Date.now(), rates: data.rates };
  return data.rates;
}

/**
 * Fetch live mark price from Binance (crypto), gold-api (XAU/USD), or open.er-api (USD forex).
 * Falls back to hint only if oracle fails.
 */
async function fetchMarkPrice(symbol, fallbackHint) {
  if (symbol === GOLD_SYMBOL) {
    try {
      return await fetchGoldSpot();
    } catch {
      // fall through to hint
    }
  }

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

  const quote = forexQuote(symbol);
  if (quote) {
    try {
      const rates = await fetchForexUsdRates();
      const price = Number(rates[quote]);
      if (Number.isFinite(price) && price > 0) return price;
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
  FOREX_SYMBOLS,
  GOLD_SYMBOL,
  toBinanceSymbol,
  isAllowedTradeSymbol,
  fetchMarkPrice,
};
