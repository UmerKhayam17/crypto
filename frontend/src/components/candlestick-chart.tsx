import { useEffect, useMemo, useRef, useState } from "react";
import {
  fetchKlines,
  generateCandles,
  INTERVALS,
  intervalToMs,
  toBinanceSymbol,
  type Candle,
  type Interval,
} from "@/services/market-data";
import { formatPrice } from "@/services/market-data";
import { Slider } from "@/components/ui/slider";
import { useStore } from "@/context/store";

type Props = {
  symbol: string;
  height?: number;
};

type Range = { key: string; label: string; interval: Interval; limit: number };
const RANGES: Range[] = [
  { key: "1D", label: "1D", interval: "5m", limit: 288 },
  { key: "1W", label: "1W", interval: "1h", limit: 168 },
  { key: "1M", label: "1M", interval: "4h", limit: 180 },
  { key: "3M", label: "3M", interval: "1d", limit: 90 },
  { key: "1Y", label: "1Y", interval: "1d", limit: 365 },
];

const DEFAULT_LIMIT: Record<Interval, number> = {
  "1s": 180,
  "1m": 120,
  "5m": 120,
  "15m": 96,
  "1h": 96,
  "4h": 90,
  "1d": 120,
};

function sanitizeCandle(c: Candle): Candle {
  const o = Number(c.o);
  const c_ = Number(c.c);
  const h = Math.max(Number(c.h), o, c_);
  const l = Math.min(Number(c.l), o, c_);
  return {
    t: Number(c.t),
    o,
    h,
    l: l > 0 ? l : Math.min(o, c_),
    c: c_,
    v: Math.max(0, Number(c.v) || 0),
  };
}

function formatAxisTime(t: number, interval: Interval): string {
  const d = new Date(t);
  if (interval === "1d") {
    return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
  }
  if (interval === "4h" || interval === "1h") {
    return d.toLocaleString(undefined, { month: "short", day: "numeric", hour: "2-digit" });
  }
  if (interval === "1s") {
    return d.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit", second: "2-digit" });
  }
  return d.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
}

function formatRemain(ms: number): string {
  const s = Math.max(0, Math.ceil(ms / 1000));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
  return `${m}:${String(sec).padStart(2, "0")}`;
}

function lerp(a: number, b: number, t: number) {
  return a + (b - a) * t;
}

export function CandlestickChart({ symbol, height = 360 }: Props) {
  const { assets } = useStore();
  const assetPrice = assets.find((a) => a.symbol === symbol)?.price ?? 100;
  const assetPriceRef = useRef(assetPrice);
  assetPriceRef.current = assetPrice;

  const [interval, setIntervalState] = useState<Interval>("15m");
  const [limit, setLimit] = useState<number>(DEFAULT_LIMIT["15m"]);
  const [rangeKey, setRangeKey] = useState<string>("");
  const [candles, setCandles] = useState<Candle[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [hover, setHover] = useState<{ x: number; i: number } | null>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);
  const [panStart, setPanStart] = useState<number | null>(null);
  const [nowTick, setNowTick] = useState(() => Date.now());

  // Smooth display state (animated)
  const [smoothPrice, setSmoothPrice] = useState(assetPrice);
  const [smoothMin, setSmoothMin] = useState(0);
  const [smoothMax, setSmoothMax] = useState(1);
  const [pulse, setPulse] = useState(0);

  const readyRef = useRef(false);
  const loadGenRef = useRef(0);
  const targetPriceRef = useRef(assetPrice);
  const displayPriceRef = useRef(assetPrice);
  const targetMinRef = useRef(0);
  const targetMaxRef = useRef(1);
  const displayMinRef = useRef(0);
  const displayMaxRef = useRef(1);
  const animRafRef = useRef<number | null>(null);
  const candleRafRef = useRef<number | null>(null);
  const pendingKlineRef = useRef<Candle | null>(null);

  useEffect(() => {
    if (!wrapRef.current) return;
    const ro = new ResizeObserver((entries) => {
      for (const e of entries) {
        const w = Math.floor(e.contentRect.width);
        if (w > 0) setWidth(w);
      }
    });
    ro.observe(wrapRef.current);
    setWidth(Math.floor(wrapRef.current.clientWidth) || 0);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    setPanStart(null);
  }, [symbol, interval, limit]);

  // Clock for candle progress / countdown
  useEffect(() => {
    const id = window.setInterval(() => setNowTick(Date.now()), 250);
    return () => window.clearInterval(id);
  }, []);

  // Smooth animation loop — lerps price & y-scale
  useEffect(() => {
    let alive = true;
    const tick = () => {
      if (!alive) return;
      const ease = 0.14;
      displayPriceRef.current = lerp(displayPriceRef.current, targetPriceRef.current, ease);
      displayMinRef.current = lerp(displayMinRef.current, targetMinRef.current, 0.1);
      displayMaxRef.current = lerp(displayMaxRef.current, targetMaxRef.current, 0.1);
      setSmoothPrice(displayPriceRef.current);
      setSmoothMin(displayMinRef.current);
      setSmoothMax(displayMaxRef.current);
      animRafRef.current = requestAnimationFrame(tick);
    };
    animRafRef.current = requestAnimationFrame(tick);
    return () => {
      alive = false;
      if (animRafRef.current != null) cancelAnimationFrame(animRafRef.current);
    };
  }, []);

  // Load candles
  useEffect(() => {
    const gen = ++loadGenRef.current;
    readyRef.current = false;
    let cancelled = false;

    setLoading(true);
    setError(null);
    setCandles([]);
    setHover(null);

    const bs = toBinanceSymbol(symbol);
    const apply = (data: Candle[]) => {
      if (cancelled || gen !== loadGenRef.current) return;
      const cleaned = data.map(sanitizeCandle).filter((c) => Number.isFinite(c.o) && c.h >= c.l);
      cleaned.sort((a, b) => a.t - b.t);
      setCandles(cleaned);
      setLoading(false);
      readyRef.current = true;
      if (cleaned.length) {
        const last = cleaned[cleaned.length - 1].c;
        targetPriceRef.current = last;
        displayPriceRef.current = last;
        setSmoothPrice(last);
      }
    };

    if (bs) {
      fetchKlines(bs, interval, limit)
        .then(apply)
        .catch((e: Error) => {
          if (cancelled || gen !== loadGenRef.current) return;
          setError(e.message || "Could not load chart");
          apply(generateCandles(assetPriceRef.current, limit, intervalToMs(interval), 0.004));
        });
    } else {
      apply(generateCandles(assetPriceRef.current, limit, intervalToMs(interval), 0.008));
    }

    return () => {
      cancelled = true;
      readyRef.current = false;
    };
  }, [symbol, interval, limit]);

  // Live kline + trade ticks for smooth movement
  useEffect(() => {
    const bs = toBinanceSymbol(symbol);
    const step = intervalToMs(interval);

    const flushKline = () => {
      candleRafRef.current = null;
      const candle = pendingKlineRef.current;
      pendingKlineRef.current = null;
      if (!candle || !readyRef.current) return;
      setCandles((prev) => {
        if (prev.length === 0) return [candle];
        const last = prev[prev.length - 1];
        if (candle.t < last.t) return prev;
        if (last.t === candle.t) return [...prev.slice(0, -1), candle];
        const next = [...prev, candle];
        return next.length > limit ? next.slice(next.length - limit) : next;
      });
      targetPriceRef.current = candle.c;
      setPulse((p) => p + 1);
    };

    const queueKline = (raw: Candle) => {
      if (!readyRef.current) return;
      pendingKlineRef.current = sanitizeCandle(raw);
      if (candleRafRef.current == null) {
        candleRafRef.current = requestAnimationFrame(flushKline);
      }
    };

    const applyTick = (price: number, ts = Date.now()) => {
      if (!readyRef.current || !(price > 0)) return;
      targetPriceRef.current = price;
      setPulse((p) => p + 1);

      const bucket = Math.floor(ts / step) * step;
      setCandles((prev) => {
        if (prev.length === 0) {
          return [sanitizeCandle({ t: bucket, o: price, h: price, l: price, c: price, v: 0 })];
        }
        const last = prev[prev.length - 1];
        if (bucket < last.t) return prev;
        if (bucket === last.t) {
          return [
            ...prev.slice(0, -1),
            sanitizeCandle({
              ...last,
              c: price,
              h: Math.max(last.h, price),
              l: Math.min(last.l, price),
            }),
          ];
        }
        // New candle for this timeframe bucket
        const opened = sanitizeCandle({
          t: bucket,
          o: last.c,
          h: Math.max(last.c, price),
          l: Math.min(last.c, price),
          c: price,
          v: 0,
        });
        const next = [...prev, opened];
        return next.length > limit ? next.slice(next.length - limit) : next;
      });
    };

    if (!bs) {
      const id = window.setInterval(() => {
        if (!readyRef.current) return;
        const last = targetPriceRef.current || assetPriceRef.current;
        const drift = (Math.random() - 0.48) * last * 0.0012;
        applyTick(Math.max(last + drift, assetPriceRef.current * 0.5));
      }, 400);
      return () => window.clearInterval(id);
    }

    // Combined stream: candle updates + raw trades for smooth motion
    const streams = `${bs.toLowerCase()}@kline_${interval}/${bs.toLowerCase()}@trade`;
    const url = `wss://stream.binance.com:9443/stream?streams=${streams}`;
    let ws: WebSocket | null = null;
    let retry = 0;
    let retryTimer: ReturnType<typeof setTimeout> | null = null;
    let closed = false;

    const connect = () => {
      if (closed) return;
      try {
        ws = new WebSocket(url);
        ws.onopen = () => {
          retry = 0;
        };
        ws.onmessage = (ev) => {
          try {
            const envelope = JSON.parse(ev.data);
            const msg = envelope?.data ?? envelope;
            const stream: string = envelope?.stream || "";

            if (stream.includes("@kline_") || msg?.k) {
              const k = msg?.k;
              if (!k) return;
              queueKline({
                t: k.t,
                o: parseFloat(k.o),
                h: parseFloat(k.h),
                l: parseFloat(k.l),
                c: parseFloat(k.c),
                v: parseFloat(k.v),
              });
              return;
            }

            if (stream.includes("@trade") || msg?.e === "trade") {
              const price = parseFloat(msg.p);
              const ts = Number(msg.T || msg.E || Date.now());
              applyTick(price, ts);
            }
          } catch {
            /* ignore */
          }
        };
        ws.onclose = () => {
          if (closed) return;
          retry++;
          retryTimer = setTimeout(connect, Math.min(30_000, 1000 * 2 ** retry));
        };
        ws.onerror = () => ws?.close();
      } catch {
        retryTimer = setTimeout(connect, 5000);
      }
    };
    connect();

    return () => {
      closed = true;
      if (retryTimer) clearTimeout(retryTimer);
      if (candleRafRef.current != null) cancelAnimationFrame(candleRafRef.current);
      pendingKlineRef.current = null;
      ws?.close();
    };
  }, [symbol, interval, limit]);

  const PAD = { top: 14, right: 68, bottom: 28, left: 10 };
  const volH = Math.round(height * 0.2);
  const priceH = height - volH - PAD.top - PAD.bottom;
  const innerW = Math.max(0, width - PAD.left - PAD.right);

  const MIN_SLOT = 8;
  const total = candles.length;
  const maxVisible = Math.max(20, Math.floor(innerW / MIN_SLOT));
  const visibleCount = Math.min(total, maxVisible) || 1;
  const maxStart = Math.max(0, total - visibleCount);
  const effectiveStart = panStart === null ? maxStart : Math.min(Math.max(0, panStart), maxStart);
  const view = candles.slice(effectiveStart, effectiveStart + visibleCount);
  const n = view.length;
  const isLive = panStart === null || panStart >= maxStart;

  // Target y-range from visible candles + live price
  useEffect(() => {
    if (view.length === 0) return;
    let mn = Infinity;
    let mx = -Infinity;
    for (const c of view) {
      if (c.l < mn) mn = c.l;
      if (c.h > mx) mx = c.h;
    }
    const live = targetPriceRef.current;
    if (Number.isFinite(live)) {
      mn = Math.min(mn, live);
      mx = Math.max(mx, live);
    }
    if (!Number.isFinite(mn) || !Number.isFinite(mx) || mx <= mn) {
      const mid = view[view.length - 1]?.c ?? 1;
      mn = mid * 0.995;
      mx = mid * 1.005;
    }
    const pad = Math.max((mx - mn) * 0.1, mx * 0.0008);
    targetMinRef.current = mn - pad;
    targetMaxRef.current = mx + pad;
    if (displayMinRef.current === 0 && displayMaxRef.current === 1) {
      displayMinRef.current = mn - pad;
      displayMaxRef.current = mx + pad;
      setSmoothMin(mn - pad);
      setSmoothMax(mx + pad);
    }
  }, [view, pulse]);

  const maxV = useMemo(() => {
    let mv = 0;
    for (const c of view) if (c.v > mv) mv = c.v;
    return mv || 1;
  }, [view]);

  const slot = n > 0 ? innerW / n : 0;
  const candleW = Math.max(3, Math.min(14, slot * 0.62));
  const minP = smoothMin;
  const maxP = smoothMax;
  const yPrice = (p: number) => PAD.top + ((maxP - p) / (maxP - minP || 1)) * priceH;
  const yVol = (v: number) => PAD.top + priceH + 6 + (1 - v / maxV) * (volH - 6);

  const hovered = hover && view[hover.i] ? view[hover.i] : null;
  const lastCandle = candles.length ? candles[candles.length - 1] : null;
  const lastClose = lastCandle?.c ?? smoothPrice;
  const upLive = smoothPrice >= (lastCandle?.o ?? smoothPrice);

  const candleProgress = useMemo(() => {
    const step = intervalToMs(interval);
    const bucket = Math.floor(nowTick / step) * step;
    const elapsed = nowTick - bucket;
    return {
      pct: Math.min(100, (elapsed / step) * 100),
      remain: step - elapsed,
      bucket,
    };
  }, [nowTick, interval]);

  const timeTicks = useMemo(() => {
    if (n < 2) return [] as { i: number; label: string }[];
    const count = Math.min(5, n);
    const out: { i: number; label: string }[] = [];
    for (let t = 0; t < count; t++) {
      const i = Math.round((t * (n - 1)) / Math.max(1, count - 1));
      out.push({ i, label: formatAxisTime(view[i].t, interval) });
    }
    return out;
  }, [n, view, interval]);

  // Close-price polyline for smooth visual flow
  const closePath = useMemo(() => {
    if (n < 2) return "";
    return view
      .map((c, i) => {
        const x = PAD.left + i * slot + slot / 2;
        const y = yPrice(i === n - 1 && isLive ? smoothPrice : c.c);
        return `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`;
      })
      .join(" ");
  }, [view, n, slot, smoothPrice, minP, maxP, isLive, priceH]);

  const selectInterval = (i: Interval) => {
    setIntervalState(i);
    setLimit(DEFAULT_LIMIT[i]);
    setRangeKey("");
  };

  const selectRange = (r: Range) => {
    setIntervalState(r.interval);
    setLimit(r.limit);
    setRangeKey(r.key);
  };

  const retryLoad = () => {
    loadGenRef.current++;
    readyRef.current = false;
    setError(null);
    setLoading(true);
    setCandles([]);
    const bs = toBinanceSymbol(symbol);
    const gen = loadGenRef.current;
    if (bs) {
      fetchKlines(bs, interval, limit)
        .then((data) => {
          if (gen !== loadGenRef.current) return;
          const cleaned = data.map(sanitizeCandle);
          setCandles(cleaned);
          setLoading(false);
          readyRef.current = true;
        })
        .catch((e: Error) => {
          if (gen !== loadGenRef.current) return;
          setError(e.message);
          setCandles(generateCandles(assetPriceRef.current, limit, intervalToMs(interval), 0.004).map(sanitizeCandle));
          setLoading(false);
          readyRef.current = true;
        });
    } else {
      setCandles(generateCandles(assetPriceRef.current, limit, intervalToMs(interval), 0.008).map(sanitizeCandle));
      setLoading(false);
      readyRef.current = true;
    }
  };

  const svgW = Math.max(width, 1);
  const liveY = yPrice(smoothPrice);
  const liveColor = upLive ? "var(--success, #16a34a)" : "var(--destructive, #dc2626)";

  return (
    <div ref={wrapRef} className="relative w-full">
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <div className="flex rounded-lg border border-border bg-muted/30 p-1">
          {INTERVALS.map((i) => (
            <button
              key={i}
              type="button"
              onClick={() => selectInterval(i)}
              className={`rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
                interval === i && !rangeKey
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {i}
            </button>
          ))}
        </div>
        <div className="flex rounded-lg border border-border bg-muted/30 p-1">
          {RANGES.map((r) => (
            <button
              key={r.key}
              type="button"
              onClick={() => selectRange(r)}
              className={`rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
                rangeKey === r.key
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground"
              }`}
              title={`Last ${r.label}`}
            >
              {r.label}
            </button>
          ))}
        </div>

        {!loading && lastCandle && (
          <div className="flex items-center gap-2 rounded-lg border border-border/60 bg-card/60 px-2.5 py-1 text-[11px]">
            <span className={`font-mono font-bold ${upLive ? "text-emerald-600 dark:text-primary" : "text-destructive"}`}>
              ${formatPrice(smoothPrice)}
            </span>
            <span className="text-muted-foreground">·</span>
            <span className="text-muted-foreground">{interval} candle</span>
            <span className="font-mono text-foreground">{formatRemain(candleProgress.remain)}</span>
            <span className="relative h-1.5 w-16 overflow-hidden rounded-full bg-muted">
              <span
                className="absolute inset-y-0 left-0 rounded-full bg-primary transition-[width] duration-200 ease-linear"
                style={{ width: `${candleProgress.pct}%` }}
              />
            </span>
          </div>
        )}

        {error && !loading && candles.length > 0 && (
          <span className="text-[11px] text-amber-600 dark:text-amber-400">Using simulated data</span>
        )}

        {hovered && (
          <div className="ml-auto flex flex-wrap gap-x-3 text-xs font-mono text-muted-foreground">
            <span>O <span className="text-foreground">{formatPrice(hovered.o)}</span></span>
            <span>H <span className="text-emerald-600 dark:text-primary">{formatPrice(hovered.h)}</span></span>
            <span>L <span className="text-destructive">{formatPrice(hovered.l)}</span></span>
            <span>C <span className="text-foreground">{formatPrice(hovered.c)}</span></span>
          </div>
        )}
      </div>

      <div className="relative overflow-hidden rounded-lg border border-border/50 bg-card/30">
        {width > 0 && (
          <svg
            viewBox={`0 0 ${svgW} ${height}`}
            width="100%"
            height={height}
            preserveAspectRatio="xMidYMid meet"
            className="block touch-pan-y"
            onMouseMove={(e) => {
              if (n === 0 || slot <= 0) return;
              const rect = (e.currentTarget as SVGSVGElement).getBoundingClientRect();
              const scaleX = svgW / rect.width;
              const x = (e.clientX - rect.left) * scaleX - PAD.left;
              const i = Math.floor(x / slot);
              if (i >= 0 && i < n) setHover({ x: PAD.left + i * slot + slot / 2, i });
            }}
            onMouseLeave={() => setHover(null)}
          >
            {Array.from({ length: 5 }).map((_, k) => {
              const p = minP + ((maxP - minP) * k) / 4;
              const y = yPrice(p);
              return (
                <g key={`g-${k}`}>
                  <line
                    x1={PAD.left}
                    x2={PAD.left + innerW}
                    y1={y}
                    y2={y}
                    stroke="currentColor"
                    className="text-border"
                    strokeDasharray="3 5"
                    strokeWidth={1}
                    opacity={0.7}
                  />
                  <text
                    x={PAD.left + innerW + 6}
                    y={y + 3.5}
                    fontSize={10}
                    fill="currentColor"
                    className="text-muted-foreground"
                    fontFamily="ui-monospace, monospace"
                  >
                    {formatPrice(p)}
                  </text>
                </g>
              );
            })}

            <line
              x1={PAD.left}
              x2={PAD.left + innerW}
              y1={PAD.top + priceH + 2}
              y2={PAD.top + priceH + 2}
              stroke="currentColor"
              className="text-border"
              strokeWidth={1}
              opacity={0.5}
            />

            {/* Smooth close path */}
            {closePath && (
              <path
                d={closePath}
                fill="none"
                stroke={liveColor}
                strokeWidth={1.25}
                strokeOpacity={0.35}
                strokeLinejoin="round"
                strokeLinecap="round"
              />
            )}

            {view.map((c, i) => {
              const cx = PAD.left + i * slot + slot / 2;
              const isLast = i === n - 1 && isLive;
              const close = isLast ? smoothPrice : c.c;
              const high = isLast ? Math.max(c.h, smoothPrice) : c.h;
              const low = isLast ? Math.min(c.l, smoothPrice) : c.l;
              const up = close >= c.o;
              const color = up ? "var(--success, #16a34a)" : "var(--destructive, #dc2626)";
              const yO = yPrice(c.o);
              const yC = yPrice(close);
              const yH = yPrice(high);
              const yL = yPrice(low);
              const bodyTop = Math.min(yO, yC);
              const bodyH = Math.max(1.5, Math.abs(yC - yO));
              const volTop = yVol(c.v);
              const volBottom = PAD.top + priceH + volH;
              return (
                <g key={c.t}>
                  <line x1={cx} x2={cx} y1={yH} y2={yL} stroke={color} strokeWidth={1.25} />
                  <rect
                    x={cx - candleW / 2}
                    y={bodyTop}
                    width={candleW}
                    height={bodyH}
                    fill={color}
                    stroke={color}
                    strokeWidth={1}
                    rx={0.5}
                    opacity={isLast ? 0.95 : 1}
                  />
                  <rect
                    x={cx - candleW / 2}
                    y={volTop}
                    width={candleW}
                    height={Math.max(1, volBottom - volTop)}
                    fill={color}
                    opacity={0.35}
                  />
                </g>
              );
            })}

            {/* Live price line + badge */}
            {n > 0 && Number.isFinite(liveY) && (
              <g pointerEvents="none">
                <line
                  x1={PAD.left}
                  x2={PAD.left + innerW}
                  y1={liveY}
                  y2={liveY}
                  stroke={liveColor}
                  strokeWidth={1.25}
                  strokeDasharray="5 4"
                  opacity={0.9}
                />
                <circle
                  cx={PAD.left + (n - 1) * slot + slot / 2}
                  cy={liveY}
                  r={3.5}
                  fill={liveColor}
                  className="chart-live-dot"
                />
                <rect
                  x={PAD.left + innerW + 2}
                  y={liveY - 8}
                  width={58}
                  height={16}
                  rx={3}
                  fill={liveColor}
                />
                <text
                  x={PAD.left + innerW + 31}
                  y={liveY + 3.5}
                  fontSize={9}
                  fill="#fff"
                  textAnchor="middle"
                  fontFamily="ui-monospace, monospace"
                  fontWeight={700}
                >
                  {formatPrice(smoothPrice)}
                </text>
              </g>
            )}

            {timeTicks.map((tick) => (
              <text
                key={`t-${tick.i}`}
                x={PAD.left + tick.i * slot + slot / 2}
                y={height - 6}
                fontSize={9}
                fill="currentColor"
                className="text-muted-foreground"
                textAnchor="middle"
                fontFamily="ui-monospace, monospace"
              >
                {tick.label}
              </text>
            ))}

            {hover && (
              <g pointerEvents="none">
                <line
                  x1={hover.x}
                  x2={hover.x}
                  y1={PAD.top}
                  y2={PAD.top + priceH + volH}
                  stroke="currentColor"
                  className="text-muted-foreground"
                  strokeDasharray="3 3"
                  strokeWidth={1}
                  opacity={0.7}
                />
              </g>
            )}

            <text
              x={PAD.left + 4}
              y={PAD.top + priceH + 16}
              fontSize={10}
              fill="currentColor"
              className="text-muted-foreground"
            >
              Volume
            </text>
          </svg>
        )}

        {loading && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-background/60 backdrop-blur-[1px]">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
            <span className="text-xs text-muted-foreground">Loading {interval} chart…</span>
          </div>
        )}

        {error && !loading && candles.length === 0 && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-background/80 text-center">
            <div className="text-sm font-semibold text-destructive">Couldn't load market data</div>
            <div className="max-w-xs px-4 text-xs text-muted-foreground">{error}</div>
            <button
              type="button"
              onClick={retryLoad}
              className="mt-1 rounded-md border border-border px-3 py-1 text-xs font-semibold hover:bg-muted/40"
            >
              Retry
            </button>
          </div>
        )}
      </div>

      {total > visibleCount && (
        <div className="mt-3 grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-2 sm:flex sm:items-center">
          <span className="order-1 min-w-0 truncate text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
            {effectiveStart + 1}–{effectiveStart + n} / {total} · {interval}
          </span>
          <button
            type="button"
            onClick={() => setPanStart(null)}
            disabled={isLive}
            className={`order-2 shrink-0 rounded-md border px-2 py-1 text-[10px] font-semibold uppercase tracking-wider transition-colors sm:order-3 ${
              isLive
                ? "border-primary/40 bg-primary/15 text-primary"
                : "border-border text-muted-foreground hover:text-foreground"
            }`}
          >
            {isLive ? "● Live" : "Go live"}
          </button>
          <Slider
            value={[Math.round(effectiveStart)]}
            min={0}
            max={maxStart}
            step={1}
            onValueChange={(v) => setPanStart(Math.round(v[0]))}
            className="order-3 col-span-2 min-w-0 sm:order-2 sm:flex-1"
            aria-label="Scroll through chart history"
          />
        </div>
      )}

      <style>{`
        @keyframes chart-dot-pulse {
          0%, 100% { r: 3.5; opacity: 1; }
          50% { r: 5.5; opacity: 0.7; }
        }
        .chart-live-dot {
          animation: chart-dot-pulse 1.2s ease-in-out infinite;
        }
        @media (prefers-reduced-motion: reduce) {
          .chart-live-dot { animation: none; }
        }
      `}</style>
    </div>
  );
}
