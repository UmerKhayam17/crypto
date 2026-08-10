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

export function CandlestickChart({ symbol, height = 360 }: Props) {
  const [interval, setInterval] = useState<Interval>("1m");
  const [limit, setLimit] = useState<number>(120);
  const [rangeKey, setRangeKey] = useState<string>("");
  const [candles, setCandles] = useState<Candle[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [hover, setHover] = useState<{ x: number; i: number } | null>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(800);

  // Pan: start index of the visible window. `null` = follow live (pinned to end).
  const [panStart, setPanStart] = useState<number | null>(null);

  // Track container width
  useEffect(() => {
    if (!wrapRef.current) return;
    const ro = new ResizeObserver((entries) => {
      for (const e of entries) setWidth(e.contentRect.width);
    });
    ro.observe(wrapRef.current);
    return () => ro.disconnect();
  }, []);

  // Reset pan to live edge when symbol / range changes
  useEffect(() => { setPanStart(null); }, [symbol, interval, limit]);

  // Load initial candles
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    const bs = toBinanceSymbol(symbol);
    if (bs) {
      fetchKlines(bs, interval, limit)
        .then((data) => {
          if (!cancelled) {
            setCandles(data);
            setLoading(false);
          }
        })
        .catch((e) => {
          if (!cancelled) {
            setError(e.message);
            setCandles(generateCandles(1, limit, intervalToMs(interval)));
            setLoading(false);
          }
        });
    } else {
      setCandles(generateCandles(100, limit, intervalToMs(interval), 0.008));
      setLoading(false);
    }
    return () => {
      cancelled = true;
    };
  }, [symbol, interval, limit]);

  // Live kline updates
  useEffect(() => {
    const bs = toBinanceSymbol(symbol);
    if (!bs) {
      const id = window.setInterval(() => {
        setCandles((prev) => {
          if (prev.length === 0) return prev;
          const last = prev[prev.length - 1];
          const drift = (Math.random() - 0.5) * last.c * 0.003;
          const c = Math.max(last.c + drift, 0.0001);
          const updated: Candle = {
            ...last,
            c: Number(c.toFixed(4)),
            h: Math.max(last.h, c),
            l: Math.min(last.l, c),
          };
          return [...prev.slice(0, -1), updated];
        });
      }, 2000);
      return () => window.clearInterval(id);
    }

    const url = `wss://stream.binance.com:9443/ws/${bs.toLowerCase()}@kline_${interval}`;
    let ws: WebSocket | null = null;
    let retry = 0;
    let retryTimer: ReturnType<typeof setTimeout> | null = null;

    const connect = () => {
      try {
        ws = new WebSocket(url);
        ws.onopen = () => { retry = 0; };
        ws.onmessage = (ev) => {
          try {
            const msg = JSON.parse(ev.data);
            const k = msg?.k;
            if (!k) return;
            const candle: Candle = {
              t: k.t,
              o: parseFloat(k.o),
              h: parseFloat(k.h),
              l: parseFloat(k.l),
              c: parseFloat(k.c),
              v: parseFloat(k.q),
            };
            setCandles((prev) => {
              if (prev.length === 0) return [candle];
              const last = prev[prev.length - 1];
              if (last.t === candle.t) return [...prev.slice(0, -1), candle];
              return [...prev.slice(-(Math.max(1, limit - 1))), candle];
            });
          } catch {}
        };
        ws.onclose = () => {
          retry++;
          retryTimer = setTimeout(connect, Math.min(30000, 1000 * 2 ** retry));
        };
        ws.onerror = () => ws?.close();
      } catch {
        retryTimer = setTimeout(connect, 5000);
      }
    };
    connect();
    return () => {
      if (retryTimer) clearTimeout(retryTimer);
      ws?.close();
    };
  }, [symbol, interval]);

  // Layout
  const PAD = { top: 10, right: 60, bottom: 28, left: 8 };
  const volH = Math.round(height * 0.22);
  const priceH = height - volH - PAD.top - PAD.bottom;

  const innerW = Math.max(0, width - PAD.left - PAD.right);

  // Decide how many candles fit comfortably in the viewport
  const MIN_SLOT = 6;
  const total = candles.length;
  const maxVisible = Math.max(10, Math.floor(innerW / MIN_SLOT));
  const visibleCount = Math.min(total, maxVisible) || 1;
  const maxStart = Math.max(0, total - visibleCount);
  const effectiveStart = panStart === null ? maxStart : Math.min(panStart, maxStart);
  const view = candles.slice(effectiveStart, effectiveStart + visibleCount);
  const n = view.length;

  const { minP, maxP, maxV } = useMemo(() => {
    if (view.length === 0) return { minP: 0, maxP: 1, maxV: 1 };
    let mn = Infinity, mx = -Infinity, mv = 0;
    for (const c of view) {
      if (c.l < mn) mn = c.l;
      if (c.h > mx) mx = c.h;
      if (c.v > mv) mv = c.v;
    }
    const pad = (mx - mn) * 0.05 || mx * 0.005;
    return { minP: mn - pad, maxP: mx + pad, maxV: mv || 1 };
  }, [view]);

  const slot = n > 0 ? innerW / n : 0;
  const candleW = Math.max(2, slot * 0.7);

  const yPrice = (p: number) => PAD.top + ((maxP - p) / (maxP - minP || 1)) * priceH;
  const yVol = (v: number) => PAD.top + priceH + 8 + (1 - v / maxV) * (volH - 8);

  const hovered = hover && view[hover.i] ? view[hover.i] : null;
  const isLive = panStart === null || panStart >= maxStart;

  return (
    <div ref={wrapRef} className="relative w-full">
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <div className="flex rounded-lg border border-border bg-muted/30 p-1">
          {INTERVALS.map((i) => (
            <button
              key={i}
              onClick={() => { setInterval(i); setLimit(120); setRangeKey(""); }}
              className={`rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
                interval === i && !rangeKey ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
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
              onClick={() => { setInterval(r.interval); setLimit(r.limit); setRangeKey(r.key); }}
              className={`rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
                rangeKey === r.key ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
              }`}
              title={`Last ${r.label}`}
            >
              {r.label}
            </button>
          ))}
        </div>
        {error && !loading && candles.length > 0 && (
          <span className="text-[11px] text-amber-400">Using simulated data</span>
        )}

        {hovered && (
          <div className="ml-auto flex flex-wrap gap-x-3 text-xs font-mono text-muted-foreground">
            <span>O <span className="text-foreground">{formatPrice(hovered.o)}</span></span>
            <span>H <span className="text-primary">{formatPrice(hovered.h)}</span></span>
            <span>L <span className="text-destructive">{formatPrice(hovered.l)}</span></span>
            <span>C <span className="text-foreground">{formatPrice(hovered.c)}</span></span>
          </div>
        )}
      </div>

      <div className="relative">
        <svg
          width={width}
          height={height}
          className="block w-full"
          onMouseMove={(e) => {
            const rect = (e.currentTarget as SVGSVGElement).getBoundingClientRect();
            const x = e.clientX - rect.left - PAD.left;
            const i = Math.floor(x / slot);
            if (i >= 0 && i < n) setHover({ x: PAD.left + i * slot + slot / 2, i });
          }}
          onMouseLeave={() => setHover(null)}
        >
          {Array.from({ length: 5 }).map((_, k) => {
            const p = minP + ((maxP - minP) * k) / 4;
            const y = yPrice(p);
            return (
              <g key={k}>
                <line x1={PAD.left} x2={PAD.left + innerW} y1={y} y2={y} stroke="oklch(0.30 0.045 258)" strokeDasharray="2 4" strokeWidth={1} />
                <text x={PAD.left + innerW + 6} y={y + 4} fontSize={10} fill="oklch(0.70 0.03 250)" fontFamily="ui-monospace, monospace">
                  {formatPrice(p)}
                </text>
              </g>
            );
          })}

          {view.map((c, i) => {
            const cx = PAD.left + i * slot + slot / 2;
            const up = c.c >= c.o;
            const color = up ? "oklch(0.72 0.17 158)" : "oklch(0.62 0.22 25)";
            const yO = yPrice(c.o);
            const yC = yPrice(c.c);
            const yH = yPrice(c.h);
            const yL = yPrice(c.l);
            const bodyTop = Math.min(yO, yC);
            const bodyH = Math.max(1, Math.abs(yC - yO));
            return (
              <g key={i}>
                <line x1={cx} x2={cx} y1={yH} y2={yL} stroke={color} strokeWidth={1} />
                <rect x={cx - candleW / 2} y={bodyTop} width={candleW} height={bodyH} fill={color} />
                <rect
                  x={cx - candleW / 2}
                  y={yVol(c.v)}
                  width={candleW}
                  height={Math.max(1, PAD.top + priceH + volH - yVol(c.v))}
                  fill={color}
                  opacity={0.45}
                />
              </g>
            );
          })}

          {hover && (
            <g pointerEvents="none">
              <line x1={hover.x} x2={hover.x} y1={PAD.top} y2={PAD.top + priceH + volH} stroke="oklch(0.70 0.03 250)" strokeDasharray="3 3" strokeWidth={1} />
            </g>
          )}

          <text x={PAD.left + 4} y={PAD.top + priceH + 18} fontSize={10} fill="oklch(0.70 0.03 250)">Volume</text>
        </svg>

        {/* Loading skeleton */}
        {loading && candles.length === 0 && (
          <div className="absolute inset-0 flex flex-col gap-2 p-2">
            <div className="flex-1 animate-pulse rounded-md bg-muted/40" />
            <div className="h-[20%] animate-pulse rounded-md bg-muted/30" />
          </div>
        )}

        {/* Error fallback — only when no data at all */}
        {error && !loading && candles.length === 0 && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 rounded-md bg-background/80 text-center">
            <div className="text-sm font-semibold text-destructive">Couldn't load market data</div>
            <div className="text-xs text-muted-foreground px-4 max-w-xs">{error}</div>
            <button
              type="button"
              onClick={() => { setLimit((l) => l); setRangeKey((r) => r); /* trigger refetch */ setError(null); setLoading(true); const bs = toBinanceSymbol(symbol); if (bs) fetchKlines(bs, interval, limit).then((d) => { setCandles(d); setLoading(false); }).catch((e) => { setError(e.message); setLoading(false); }); else { setCandles(generateCandles(100, limit, intervalToMs(interval), 0.008)); setLoading(false); } }}
              className="mt-1 rounded-md border border-border px-3 py-1 text-xs font-semibold hover:bg-muted/40"
            >
              Retry
            </button>
          </div>
        )}
      </div>


      {/* Pan slider — responsive: stacks on narrow screens */}
      {total > visibleCount && (
        <div className="mt-3 grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-2 sm:flex sm:items-center">
          <span className="order-1 text-[10px] font-mono uppercase tracking-wider text-muted-foreground truncate min-w-0">
            {effectiveStart + 1}–{effectiveStart + n} / {total}
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

    </div>
  );
}
