export type Asset = {
  symbol: string;
  name: string;
  price: number;
  change24h: number; // percent
  volume: number;
  marketCap: number;
  category: "crypto" | "forex" | "stocks" | "metals";
};

export const SEED_ASSETS: Asset[] = [
  { symbol: "BTC/USDT", name: "Bitcoin", price: 67432.18, change24h: 2.34, volume: 1121155831, marketCap: 35219047888, category: "crypto" },
  { symbol: "ETH/USDT", name: "Ethereum", price: 3521.42, change24h: 1.18, volume: 2220245047, marketCap: 77312659399, category: "crypto" },
  { symbol: "SOL/USDT", name: "Solana", price: 178.65, change24h: 5.42, volume: 1804386321, marketCap: 93960588100, category: "crypto" },
  { symbol: "BNB/USDT", name: "BNB", price: 612.34, change24h: -0.85, volume: 2189832844, marketCap: 91430061059, category: "crypto" },
  { symbol: "XRP/USDT", name: "XRP", price: 0.5823, change24h: 3.12, volume: 1463098416, marketCap: 47442076801, category: "crypto" },
  { symbol: "ADA/USDT", name: "Cardano", price: 0.4521, change24h: -1.42, volume: 2467273654, marketCap: 54877442650, category: "crypto" },
  { symbol: "DOGE/USDT", name: "Dogecoin", price: 0.1623, change24h: 4.21, volume: 1797547745, marketCap: 18273222385, category: "crypto" },
  { symbol: "AVAX/USDT", name: "Avalanche", price: 38.42, change24h: 2.85, volume: 2833249503, marketCap: 62622810881, category: "crypto" },
  { symbol: "LINK/USDT", name: "Chainlink", price: 14.82, change24h: -0.65, volume: 1387541569, marketCap: 7149528949, category: "crypto" },
  { symbol: "MATIC/USDT", name: "Polygon", price: 0.7124, change24h: 1.92, volume: 91411662, marketCap: 51557774335, category: "crypto" },
  { symbol: "DOT/USDT", name: "Polkadot", price: 6.82, change24h: 0.42, volume: 4828591608, marketCap: 96021801283, category: "crypto" },
  { symbol: "TRX/USDT", name: "TRON", price: 0.1284, change24h: 1.04, volume: 2918033356, marketCap: 26142920663, category: "crypto" },
  { symbol: "TON/USDT", name: "Toncoin", price: 6.94, change24h: -0.83, volume: 4418199783, marketCap: 1938708321, category: "crypto" },
  { symbol: "SHIB/USDT", name: "Shiba Inu", price: 0.0000182, change24h: 2.11, volume: 3420299463, marketCap: 6344875499, category: "crypto" },
  { symbol: "LTC/USDT", name: "Litecoin", price: 84.32, change24h: -0.42, volume: 2759043691, marketCap: 35875591946, category: "crypto" },
  { symbol: "BCH/USDT", name: "Bitcoin Cash", price: 442.18, change24h: 1.32, volume: 4814710691, marketCap: 13115364908, category: "crypto" },
  { symbol: "UNI/USDT", name: "Uniswap", price: 10.41, change24h: 0.84, volume: 1519317391, marketCap: 177889139, category: "crypto" },
  { symbol: "ATOM/USDT", name: "Cosmos", price: 8.42, change24h: -1.12, volume: 1876066433, marketCap: 70742676657, category: "crypto" },
  { symbol: "NEAR/USDT", name: "NEAR Protocol", price: 6.21, change24h: 3.42, volume: 881181340, marketCap: 5789608826, category: "crypto" },
  { symbol: "ICP/USDT", name: "Internet Computer", price: 12.83, change24h: -2.18, volume: 479992170, marketCap: 12512674475, category: "crypto" },
  { symbol: "APT/USDT", name: "Aptos", price: 9.42, change24h: 1.62, volume: 3340974793, marketCap: 24390372143, category: "crypto" },
  { symbol: "FIL/USDT", name: "Filecoin", price: 5.62, change24h: -0.42, volume: 3128159766, marketCap: 16403743235, category: "crypto" },
  { symbol: "ARB/USDT", name: "Arbitrum", price: 1.12, change24h: 2.42, volume: 3587077405, marketCap: 90701216012, category: "crypto" },
  { symbol: "OP/USDT", name: "Optimism", price: 2.41, change24h: 1.84, volume: 3130122422, marketCap: 51932582841, category: "crypto" },
  { symbol: "INJ/USDT", name: "Injective", price: 27.82, change24h: 4.12, volume: 1738674337, marketCap: 70011358652, category: "crypto" },
  { symbol: "SUI/USDT", name: "Sui", price: 1.62, change24h: 3.84, volume: 1541146423, marketCap: 76840689470, category: "crypto" },
  { symbol: "SEI/USDT", name: "Sei", price: 0.524, change24h: 2.42, volume: 2931897109, marketCap: 48872699575, category: "crypto" },
  { symbol: "TIA/USDT", name: "Celestia", price: 8.92, change24h: -1.42, volume: 3754876356, marketCap: 13360519663, category: "crypto" },
  { symbol: "RUNE/USDT", name: "Thorchain", price: 5.21, change24h: 2.18, volume: 673017949, marketCap: 79055998201, category: "crypto" },
  { symbol: "AAVE/USDT", name: "Aave", price: 112.42, change24h: -0.42, volume: 63362669, marketCap: 28874081406, category: "crypto" },
  { symbol: "MKR/USDT", name: "Maker", price: 2842.12, change24h: 1.42, volume: 3947764339, marketCap: 6573826964, category: "crypto" },
  { symbol: "SNX/USDT", name: "Synthetix", price: 2.84, change24h: 0.62, volume: 4705103137, marketCap: 98252559998, category: "crypto" },
  { symbol: "CRV/USDT", name: "Curve DAO", price: 0.412, change24h: -1.18, volume: 1348777404, marketCap: 24099269818, category: "crypto" },
  { symbol: "LDO/USDT", name: "Lido DAO", price: 2.18, change24h: 3.42, volume: 2970111297, marketCap: 51767052763, category: "crypto" },
  { symbol: "GRT/USDT", name: "The Graph", price: 0.284, change24h: 1.84, volume: 3618525652, marketCap: 47939828386, category: "crypto" },
  { symbol: "SAND/USDT", name: "Sandbox", price: 0.412, change24h: -2.42, volume: 60151072, marketCap: 37306489337, category: "crypto" },
  { symbol: "MANA/USDT", name: "Decentraland", price: 0.482, change24h: 1.12, volume: 2250110617, marketCap: 92834016730, category: "crypto" },
  { symbol: "AXS/USDT", name: "Axie Infinity", price: 6.82, change24h: -0.84, volume: 183059330, marketCap: 51337711865, category: "crypto" },
  { symbol: "GALA/USDT", name: "Gala", price: 0.0382, change24h: 2.42, volume: 4722278406, marketCap: 43324257259, category: "crypto" },
  { symbol: "CHZ/USDT", name: "Chiliz", price: 0.0942, change24h: 1.12, volume: 995407509, marketCap: 30197060914, category: "crypto" },
  { symbol: "FLOW/USDT", name: "Flow", price: 0.842, change24h: -1.84, volume: 1547685974, marketCap: 20693960345, category: "crypto" },
  { symbol: "ALGO/USDT", name: "Algorand", price: 0.182, change24h: 0.62, volume: 4377885227, marketCap: 21245406695, category: "crypto" },
  { symbol: "XLM/USDT", name: "Stellar", price: 0.112, change24h: 1.42, volume: 2572947344, marketCap: 67829002089, category: "crypto" },
  { symbol: "VET/USDT", name: "VeChain", price: 0.0382, change24h: -0.42, volume: 3298203662, marketCap: 48714703033, category: "crypto" },
  { symbol: "HBAR/USDT", name: "Hedera", price: 0.082, change24h: 2.18, volume: 4953454234, marketCap: 17339082681, category: "crypto" },
  { symbol: "EOS/USDT", name: "EOS", price: 0.812, change24h: -1.12, volume: 2823622975, marketCap: 37829325913, category: "crypto" },
  { symbol: "XTZ/USDT", name: "Tezos", price: 1.04, change24h: 0.42, volume: 4227281902, marketCap: 80871039244, category: "crypto" },
  { symbol: "EGLD/USDT", name: "MultiversX", price: 42.18, change24h: 1.62, volume: 3781932496, marketCap: 35413352588, category: "crypto" },
  { symbol: "KAVA/USDT", name: "Kava", price: 0.642, change24h: -0.84, volume: 4906021580, marketCap: 60190775783, category: "crypto" },
  { symbol: "MINA/USDT", name: "Mina", price: 0.842, change24h: 2.42, volume: 2132551102, marketCap: 6913730, category: "crypto" },
  { symbol: "ROSE/USDT", name: "Oasis", price: 0.0942, change24h: -1.12, volume: 4185106594, marketCap: 96256650991, category: "crypto" },
  { symbol: "IMX/USDT", name: "Immutable", price: 1.82, change24h: 3.42, volume: 4244009240, marketCap: 5482949370, category: "crypto" },
  { symbol: "RNDR/USDT", name: "Render", price: 7.82, change24h: 2.84, volume: 751425589, marketCap: 36824625274, category: "crypto" },
  { symbol: "FTM/USDT", name: "Fantom", price: 0.482, change24h: 1.62, volume: 2010948729, marketCap: 81805812281, category: "crypto" },
  { symbol: "KSM/USDT", name: "Kusama", price: 24.82, change24h: -0.42, volume: 1489166011, marketCap: 93394594745, category: "crypto" },
  { symbol: "ZIL/USDT", name: "Zilliqa", price: 0.0224, change24h: 1.12, volume: 4492200178, marketCap: 44195156926, category: "crypto" },
  { symbol: "BAT/USDT", name: "Basic Attention", price: 0.224, change24h: -1.42, volume: 1825958961, marketCap: 39144900832, category: "crypto" },
  { symbol: "ZRX/USDT", name: "0x", price: 0.412, change24h: 0.42, volume: 723948544, marketCap: 20688277008, category: "crypto" },
  { symbol: "COMP/USDT", name: "Compound", price: 52.12, change24h: 2.18, volume: 1475940557, marketCap: 30768599437, category: "crypto" },
  { symbol: "YFI/USDT", name: "yearn.finance", price: 6824.12, change24h: -1.84, volume: 1454752867, marketCap: 12833227421, category: "crypto" },
  { symbol: "SUSHI/USDT", name: "SushiSwap", price: 1.12, change24h: 1.42, volume: 1398836479, marketCap: 27395762568, category: "crypto" },
  { symbol: "1INCH/USDT", name: "1inch", price: 0.412, change24h: -0.62, volume: 4971950648, marketCap: 90664140166, category: "crypto" },
  { symbol: "DYDX/USDT", name: "dYdX", price: 1.62, change24h: 3.42, volume: 2404148237, marketCap: 74588217492, category: "crypto" },
  { symbol: "ENJ/USDT", name: "Enjin", price: 0.182, change24h: 0.84, volume: 4350227181, marketCap: 73900090036, category: "crypto" },
  { symbol: "JASMY/USDT", name: "JasmyCoin", price: 0.0224, change24h: 2.12, volume: 1188171964, marketCap: 63581516695, category: "crypto" },
  { symbol: "WLD/USDT", name: "Worldcoin", price: 2.84, change24h: 1.62, volume: 4522466942, marketCap: 85399623207, category: "crypto" },
  { symbol: "ORDI/USDT", name: "Ordinals", price: 42.12, change24h: 4.42, volume: 2745474394, marketCap: 86571223082, category: "crypto" },
  { symbol: "BLUR/USDT", name: "Blur", price: 0.282, change24h: -1.12, volume: 2925862532, marketCap: 9756986082, category: "crypto" },
  { symbol: "PEPE/USDT", name: "Pepe", price: 0.00000824, change24h: 5.82, volume: 692027617, marketCap: 9322585737, category: "crypto" },
  { symbol: "FLOKI/USDT", name: "Floki", price: 0.000182, change24h: 3.42, volume: 3510109500, marketCap: 62973022710, category: "crypto" },
  { symbol: "BONK/USDT", name: "Bonk", price: 0.0000242, change24h: 4.12, volume: 813666719, marketCap: 27682755061, category: "crypto" },
  { symbol: "WIF/USDT", name: "dogwifhat", price: 2.42, change24h: 6.84, volume: 823039573, marketCap: 79991157363, category: "crypto" },
  { symbol: "JUP/USDT", name: "Jupiter", price: 1.04, change24h: 2.42, volume: 3485463458, marketCap: 10221688663, category: "crypto" },
  { symbol: "PYTH/USDT", name: "Pyth Network", price: 0.482, change24h: 1.84, volume: 3303032520, marketCap: 42567823818, category: "crypto" },
  { symbol: "JTO/USDT", name: "Jito", price: 2.84, change24h: -0.42, volume: 1759277954, marketCap: 73529261855, category: "crypto" },
  { symbol: "STRK/USDT", name: "Starknet", price: 0.642, change24h: 1.42, volume: 1547240412, marketCap: 64769021736, category: "crypto" },
  { symbol: "DYM/USDT", name: "Dymension", price: 2.42, change24h: -1.62, volume: 519427620, marketCap: 729045203, category: "crypto" },
  { symbol: "ALT/USDT", name: "AltLayer", price: 0.282, change24h: 2.42, volume: 2876210529, marketCap: 3824181637, category: "crypto" },
  { symbol: "MANTA/USDT", name: "Manta", price: 1.42, change24h: 0.84, volume: 1759947390, marketCap: 9593192272, category: "crypto" },
  { symbol: "ENS/USDT", name: "ENS", price: 24.12, change24h: 1.62, volume: 2426406887, marketCap: 43657613334, category: "crypto" },
  { symbol: "BAND/USDT", name: "Band", price: 1.62, change24h: -0.42, volume: 1609328541, marketCap: 14311994287, category: "crypto" },
  { symbol: "KNC/USDT", name: "Kyber", price: 0.682, change24h: 2.18, volume: 2106515832, marketCap: 94503495031, category: "crypto" },
  { symbol: "LRC/USDT", name: "Loopring", price: 0.224, change24h: 1.42, volume: 4249056735, marketCap: 55423231679, category: "crypto" },
  { symbol: "OCEAN/USDT", name: "Ocean", price: 0.682, change24h: -0.84, volume: 1055887570, marketCap: 42318997892, category: "crypto" },
  { symbol: "ANKR/USDT", name: "Ankr", price: 0.0382, change24h: 1.62, volume: 1301025805, marketCap: 2878965883, category: "crypto" },
  { symbol: "CELO/USDT", name: "Celo", price: 0.682, change24h: -1.42, volume: 145365155, marketCap: 48789602368, category: "crypto" },
  { symbol: "WAVES/USDT", name: "Waves", price: 1.84, change24h: 2.12, volume: 3676946032, marketCap: 35355491663, category: "crypto" },
  { symbol: "IOTA/USDT", name: "IOTA", price: 0.182, change24h: -0.62, volume: 3102010768, marketCap: 7003817974, category: "crypto" },
  { symbol: "NEO/USDT", name: "NEO", price: 12.42, change24h: 1.42, volume: 966109480, marketCap: 66495281953, category: "crypto" },
  { symbol: "DASH/USDT", name: "Dash", price: 28.42, change24h: -1.12, volume: 1294801740, marketCap: 20461951013, category: "crypto" },
  { symbol: "XEC/USDT", name: "eCash", price: 0.0000412, change24h: 1.62, volume: 573081028, marketCap: 23689461759, category: "crypto" },
  { symbol: "AR/USDT", name: "Arweave", price: 24.82, change24h: 3.42, volume: 1609314949, marketCap: 98769373544, category: "crypto" },
  { symbol: "GMT/USDT", name: "STEPN", price: 0.182, change24h: -2.42, volume: 2417209049, marketCap: 58180430, category: "crypto" },
  { symbol: "APE/USDT", name: "ApeCoin", price: 1.12, change24h: 1.84, volume: 2822757911, marketCap: 12523349406, category: "crypto" },
  { symbol: "MASK/USDT", name: "Mask Network", price: 2.84, change24h: -0.62, volume: 4230222348, marketCap: 48966557055, category: "crypto" },
  { symbol: "CFX/USDT", name: "Conflux", price: 0.182, change24h: 2.42, volume: 2639333091, marketCap: 24262210931, category: "crypto" },
  { symbol: "STX/USDT", name: "Stacks", price: 1.82, change24h: 1.62, volume: 2833825052, marketCap: 50543622855, category: "crypto" },
  { symbol: "QNT/USDT", name: "Quant", price: 112.42, change24h: -0.84, volume: 3335288005, marketCap: 26418023184, category: "crypto" },
  { symbol: "BTT/USDT", name: "BitTorrent", price: 8e-7, change24h: 1.42, volume: 2972700859, marketCap: 74474470559, category: "crypto" },
  { symbol: "HOT/USDT", name: "Holo", price: 0.00224, change24h: 2.12, volume: 1183617771, marketCap: 15643306551, category: "crypto" },
  { symbol: "RVN/USDT", name: "Ravencoin", price: 0.0224, change24h: -1.42, volume: 4968742679, marketCap: 96822179932, category: "crypto" },
  { symbol: "ZEC/USDT", name: "Zcash", price: 24.12, change24h: 0.62, volume: 4162574924, marketCap: 5353917901, category: "crypto" },
  { symbol: "XMR/USDT", name: "Monero", price: 162.42, change24h: 1.12, volume: 4167364868, marketCap: 8649847600, category: "crypto" },
  { symbol: "ETC/USDT", name: "Ethereum Classic", price: 26.82, change24h: -0.42, volume: 917280273, marketCap: 4969372805, category: "crypto" },
  { symbol: "DGB/USDT", name: "DigiByte", price: 0.00824, change24h: 1.62, volume: 4431122393, marketCap: 84101155082, category: "crypto" },
  { symbol: "BAL/USDT", name: "Balancer", price: 2.42, change24h: -1.12, volume: 361083838, marketCap: 60115890057, category: "crypto" },
  { symbol: "CAKE/USDT", name: "PancakeSwap", price: 2.18, change24h: 1.42, volume: 4756764453, marketCap: 70934663711, category: "crypto" },
  { symbol: "GMX/USDT", name: "GMX", price: 24.82, change24h: 2.42, volume: 3465781191, marketCap: 73969194000, category: "crypto" },
  { symbol: "WOO/USDT", name: "WOO Network", price: 0.282, change24h: -0.62, volume: 3205162082, marketCap: 7462275510, category: "crypto" },
  { symbol: "AGIX/USDT", name: "SingularityNET", price: 0.682, change24h: 3.42, volume: 4251953025, marketCap: 2378413674, category: "crypto" },
  { symbol: "FET/USDT", name: "Fetch.ai", price: 1.42, change24h: 2.84, volume: 452052225, marketCap: 46561901550, category: "crypto" },

  { symbol: "EUR/USD", name: "Euro / Dollar", price: 1.0842, change24h: 0.14, volume: 0, marketCap: 0, category: "forex" },
  { symbol: "GBP/USD", name: "Pound / Dollar", price: 1.2715, change24h: -0.22, volume: 0, marketCap: 0, category: "forex" },
  { symbol: "USD/JPY", name: "Dollar / Yen", price: 156.84, change24h: 0.42, volume: 0, marketCap: 0, category: "forex" },
  { symbol: "AAPL", name: "Apple Inc.", price: 218.42, change24h: 1.05, volume: 52_000_000, marketCap: 3_320_000_000_000, category: "stocks" },
  { symbol: "TSLA", name: "Tesla", price: 242.18, change24h: -2.14, volume: 98_000_000, marketCap: 770_000_000_000, category: "stocks" },
  { symbol: "NVDA", name: "NVIDIA", price: 1184.32, change24h: 3.62, volume: 42_000_000, marketCap: 2_910_000_000_000, category: "stocks" },
  { symbol: "XAU/USD", name: "Gold", price: 2342.18, change24h: 0.62, volume: 0, marketCap: 0, category: "metals" },
  { symbol: "XAG/USD", name: "Silver", price: 29.84, change24h: 1.12, volume: 0, marketCap: 0, category: "metals" },
  { symbol: "XPT/USD", name: "Platinum", price: 1018.50, change24h: -0.34, volume: 0, marketCap: 0, category: "metals" },
  { symbol: "XPD/USD", name: "Palladium", price: 942.30, change24h: -1.08, volume: 0, marketCap: 0, category: "metals" },
];

export function formatPrice(p: number): string {
  if (p >= 1000) return p.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  if (p >= 1) return p.toFixed(2);
  return p.toFixed(4);
}

export function formatBig(n: number): string {
  if (n >= 1e12) return `$${(n / 1e12).toFixed(2)}T`;
  if (n >= 1e9) return `$${(n / 1e9).toFixed(2)}B`;
  if (n >= 1e6) return `$${(n / 1e6).toFixed(2)}M`;
  if (n >= 1e3) return `$${(n / 1e3).toFixed(2)}K`;
  return `$${n.toFixed(2)}`;
}

// Generate a synthetic OHLC-ish series for charts
export function generateSeries(base: number, points = 60, volatility = 0.02): { t: number; price: number }[] {
  const out: { t: number; price: number }[] = [];
  let p = base * (1 - volatility * 2);
  const now = Date.now();
  for (let i = points - 1; i >= 0; i--) {
    p += (Math.random() - 0.48) * base * volatility;
    p = Math.max(p, base * 0.7);
    out.push({ t: now - i * 60_000, price: Number(p.toFixed(4)) });
  }
  // Anchor last point near base
  out[out.length - 1].price = base;
  return out;
}

// Map an internal symbol like "BTC/USDT" to Binance pair "BTCUSDT".
// Returns null for non-crypto assets.
export function toBinanceSymbol(symbol: string): string | null {
  const a = SEED_ASSETS.find((x) => x.symbol === symbol);
  if (!a || a.category !== "crypto") return null;
  return symbol.replace("/", "").toUpperCase();
}

export type Candle = {
  t: number; // open time (ms)
  o: number;
  h: number;
  l: number;
  c: number;
  v: number;
};

export type Interval = "1m" | "5m" | "15m" | "1h" | "4h" | "1d";

export const INTERVALS: Interval[] = ["1m", "5m", "15m", "1h", "4h", "1d"];

export async function fetchKlines(binanceSymbol: string, interval: Interval, limit = 120): Promise<Candle[]> {
  const url = `https://api.binance.com/api/v3/klines?symbol=${binanceSymbol}&interval=${interval}&limit=${limit}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Klines failed: ${res.status}`);
  const raw: unknown[][] = await res.json();
  return raw.map((k) => ({
    t: k[0] as number,
    o: parseFloat(k[1] as string),
    h: parseFloat(k[2] as string),
    l: parseFloat(k[3] as string),
    c: parseFloat(k[4] as string),
    v: parseFloat(k[5] as string),
  }));
}

/** Generate synthetic candles for non-crypto assets. */
export function generateCandles(base: number, count = 120, intervalMs = 60_000, volatility = 0.005): Candle[] {
  const out: Candle[] = [];
  let p = base;
  const now = Date.now();
  for (let i = count - 1; i >= 0; i--) {
    const o = p;
    const drift = (Math.random() - 0.5) * base * volatility * 2;
    const c = Math.max(o + drift, base * 0.5);
    const h = Math.max(o, c) + Math.random() * base * volatility;
    const l = Math.min(o, c) - Math.random() * base * volatility;
    out.push({
      t: now - i * intervalMs,
      o: Number(o.toFixed(4)),
      h: Number(h.toFixed(4)),
      l: Number(Math.max(l, 0.0001).toFixed(4)),
      c: Number(c.toFixed(4)),
      v: Math.random() * 1000,
    });
    p = c;
  }
  return out;
}

export function intervalToMs(i: Interval): number {
  return { "1m": 60_000, "5m": 300_000, "15m": 900_000, "1h": 3_600_000, "4h": 14_400_000, "1d": 86_400_000 }[i];
}