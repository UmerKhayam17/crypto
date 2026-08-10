import { useEffect, useMemo, useRef, useState } from "react";
import { toBinanceSymbol, formatPrice } from "@/services/market-data";

type Level = { price: number; qty: number };
type Depth = { bids: Level[]; asks: Level[] };

const ROWS = 12;

function parseLevels(raw: string[][] | undefined, side: "bid" | "ask"): Level[] {
  const list = (raw || [])
    .slice(0, ROWS)
    .map((x) => ({ price: parseFloat(x[0]), qty: parseFloat(x[1]) }))
    .filter((x) => Number.isFinite(x.price) && Number.isFinite(x.qty) && x.qty > 0);

  if (side === "bid") list.sort((a, b) => b.price - a.price);
  else list.sort((a, b) => a.price - b.price);
  return list.slice(0, ROWS);
}

/** Keep row slots stable by index so React doesn't remount every tick. */
function stabilize(prev: Depth | null, next: Depth): Depth {
  if (!prev) return next;

  const mergeSide = (oldRows: Level[], newRows: Level[]): Level[] => {
    const rows: Level[] = [];
    for (let i = 0; i < ROWS; i++) {
      const n = newRows[i];
      const o = oldRows[i];
      if (n) {
        // Same-ish price level → keep identity feel; qty will CSS-transition
        rows.push({
          price: n.price,
          qty: n.qty,
        });
      } else if (o) {
        rows.push({ price: o.price, qty: Math.max(0, o.qty * 0.7) });
      }
    }
    return rows.filter((r) => r.qty > 1e-8);
  };

  return {
    bids: mergeSide(prev.bids, next.bids),
    asks: mergeSide(prev.asks, next.asks),
  };
}

function syntheticBook(mark: number, seed = 1): Depth {
  const bids: Level[] = [];
  const asks: Level[] = [];
  for (let i = 1; i <= ROWS; i++) {
    const wobble = 0.9 + ((Math.sin(seed * 0.7 + i) + 1) / 2) * 0.25;
    bids.push({
      price: Number((mark * (1 - i * 0.00025)).toPrecision(8)),
      qty: (ROWS + 1 - i) * 0.4 * wobble,
    });
    asks.push({
      price: Number((mark * (1 + i * 0.00025)).toPrecision(8)),
      qty: (ROWS + 1 - i) * 0.4 * wobble,
    });
  }
  return { bids, asks };
}

export function OrderBook({ symbol, mark }: { symbol: string; mark: number }) {
  const [depth, setDepth] = useState<Depth | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [midTone, setMidTone] = useState<"up" | "down" | null>(null);

  const depthRef = useRef<Depth | null>(null);
  const lastMidRef = useRef(mark);
  const pendingRef = useRef<Depth | null>(null);
  const flushTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const bs = toBinanceSymbol(symbol);

  const publish = (next: Depth) => {
    pendingRef.current = next;
    // Throttle DOM updates (~12fps) so book eases instead of blinking
    if (flushTimerRef.current) return;
    flushTimerRef.current = setTimeout(() => {
      flushTimerRef.current = null;
      const incoming = pendingRef.current;
      if (!incoming) return;
      const merged = stabilize(depthRef.current, incoming);
      depthRef.current = merged;
      setDepth(merged);

      if (merged.bids[0] && merged.asks[0]) {
        const mid = (merged.bids[0].price + merged.asks[0].price) / 2;
        if (mid > lastMidRef.current) setMidTone("up");
        else if (mid < lastMidRef.current) setMidTone("down");
        lastMidRef.current = mid;
      }
    }, 80);
  };

  useEffect(() => {
    setError(null);
    depthRef.current = null;
    pendingRef.current = null;
    setDepth(null);
    lastMidRef.current = mark;

    if (!bs) {
      let seed = 0;
      const first = syntheticBook(mark, seed);
      depthRef.current = first;
      setDepth(first);
      const id = window.setInterval(() => {
        seed += 1;
        publish(syntheticBook(mark, seed));
      }, 900);
      return () => {
        window.clearInterval(id);
        if (flushTimerRef.current) clearTimeout(flushTimerRef.current);
      };
    }

    const url = `wss://stream.binance.com:9443/ws/${bs.toLowerCase()}@depth20@100ms`;
    let ws: WebSocket | null = null;
    let retry = 0;
    let retryTimer: ReturnType<typeof setTimeout> | null = null;
    let closed = false;
    let toneTimer: ReturnType<typeof setTimeout> | null = null;

    const connect = () => {
      if (closed) return;
      try {
        ws = new WebSocket(url);
        ws.onopen = () => {
          retry = 0;
        };
        ws.onmessage = (ev) => {
          try {
            const m = JSON.parse(ev.data);
            const bids = parseLevels(m.bids, "bid");
            const asks = parseLevels(m.asks, "ask");
            if (!bids.length || !asks.length) return;
            publish({ bids, asks });
            if (toneTimer) clearTimeout(toneTimer);
            toneTimer = setTimeout(() => setMidTone(null), 400);
          } catch {
            /* ignore */
          }
        };
        ws.onclose = () => {
          if (closed) return;
          retry++;
          retryTimer = setTimeout(connect, Math.min(30_000, 1000 * 2 ** retry));
        };
        ws.onerror = () => {
          setError("stream error");
          ws?.close();
        };
      } catch (e) {
        setError((e as Error).message);
        retryTimer = setTimeout(connect, 5000);
      }
    };
    connect();

    return () => {
      closed = true;
      if (retryTimer) clearTimeout(retryTimer);
      if (toneTimer) clearTimeout(toneTimer);
      if (flushTimerRef.current) clearTimeout(flushTimerRef.current);
      ws?.close();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [symbol, bs]);

  useEffect(() => {
    if (bs) return;
    if (!(mark > 0)) return;
    publish(syntheticBook(mark, Date.now() / 1000));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mark, bs]);

  const { spread, spreadPct, bestBid, bestAsk, maxQty } = useMemo(() => {
    if (!depth || depth.bids.length === 0 || depth.asks.length === 0) {
      return { spread: 0, spreadPct: 0, bestBid: 0, bestAsk: 0, maxQty: 1 };
    }
    const bb = depth.bids[0].price;
    const ba = depth.asks[0].price;
    const s = Math.max(0, ba - bb);
    const sp = ba > 0 ? (s / ba) * 100 : 0;
    const mq = Math.max(...depth.bids.map((b) => b.qty), ...depth.asks.map((a) => a.qty), 0.0001);
    return { spread: s, spreadPct: sp, bestBid: bb, bestAsk: ba, maxQty: mq };
  }, [depth]);

  const asksView = useMemo(() => (depth ? [...depth.asks].reverse() : []), [depth]);

  return (
    <div className="text-xs">
      <div className="mb-2 flex items-center justify-between gap-2">
        <h3 className="text-sm font-semibold">Order Book</h3>
        {depth && (
          <div className="flex items-center gap-3 font-mono text-[11px] text-muted-foreground">
            <span>
              Spread <span className="text-foreground">{formatPrice(spread)}</span>
            </span>
            <span className="text-foreground">{spreadPct.toFixed(3)}%</span>
          </div>
        )}
      </div>
      {error && <p className="mb-2 text-[11px] text-destructive">{error}</p>}
      {!depth ? (
        <div className="py-6 text-center text-muted-foreground">Loading depth…</div>
      ) : (
        <div className="space-y-2">
          <div className="grid grid-cols-3 pb-1 text-[10px] uppercase text-muted-foreground">
            <span>Price (USDT)</span>
            <span className="text-right">Size</span>
            <span className="text-right">Total</span>
          </div>

          <div>
            {asksView.map((a, i) => (
              <Row
                key={`ask-${i}`}
                price={a.price}
                qty={a.qty}
                total={a.price * a.qty}
                max={maxQty}
                side="ask"
              />
            ))}
          </div>

          <div
            className={`flex items-center justify-between rounded-md border px-2 py-1.5 font-mono transition-colors duration-500 ${
              midTone === "up"
                ? "border-primary/35 bg-primary/10"
                : midTone === "down"
                  ? "border-destructive/35 bg-destructive/10"
                  : "border-border/50 bg-muted/30"
            }`}
          >
            <span className="text-primary tabular-nums">${formatPrice(bestBid)}</span>
            <span className="text-[10px] text-muted-foreground tabular-nums">
              mark ${formatPrice(mark)}
            </span>
            <span className="text-destructive tabular-nums">${formatPrice(bestAsk)}</span>
          </div>

          <div>
            {depth.bids.map((b, i) => (
              <Row
                key={`bid-${i}`}
                price={b.price}
                qty={b.qty}
                total={b.price * b.qty}
                max={maxQty}
                side="bid"
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function Row({
  price,
  qty,
  total,
  max,
  side,
}: {
  price: number;
  qty: number;
  total: number;
  max: number;
  side: "bid" | "ask";
}) {
  const w = Math.min(100, Math.max(3, (qty / max) * 100));
  const bar = side === "bid" ? "bg-primary/20" : "bg-destructive/20";
  const text = side === "bid" ? "text-primary" : "text-destructive";

  return (
    <div className="relative grid grid-cols-3 items-center overflow-hidden py-[3px] font-mono leading-none">
      <div
        className={`absolute inset-y-[1px] right-0 rounded-sm ${bar}`}
        style={{
          width: `${w}%`,
          transition: "width 320ms ease-out",
        }}
      />
      <span className={`relative truncate tabular-nums ${text}`}>{formatPrice(price)}</span>
      <span className="relative truncate text-right tabular-nums text-muted-foreground">{qty.toFixed(4)}</span>
      <span className="relative truncate text-right tabular-nums text-muted-foreground">{total.toFixed(2)}</span>
    </div>
  );
}
