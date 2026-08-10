import { useEffect, useMemo, useState } from "react";
import { toBinanceSymbol, formatPrice } from "@/services/market-data";

type Level = [number, number]; // [price, qty]
type Depth = { bids: Level[]; asks: Level[] };

export function OrderBook({ symbol, mark }: { symbol: string; mark: number }) {
  const [depth, setDepth] = useState<Depth | null>(null);
  const [error, setError] = useState<string | null>(null);
  const bs = toBinanceSymbol(symbol);

  useEffect(() => {
    setDepth(null);
    setError(null);
    if (!bs) {
      // Synthetic book for non-crypto
      const make = (): Depth => {
        const bids: Level[] = []; const asks: Level[] = [];
        for (let i = 1; i <= 12; i++) {
          bids.push([mark * (1 - i * 0.0008), Math.random() * 3 + 0.1]);
          asks.push([mark * (1 + i * 0.0008), Math.random() * 3 + 0.1]);
        }
        return { bids, asks };
      };
      setDepth(make());
      const id = window.setInterval(() => setDepth(make()), 1500);
      return () => window.clearInterval(id);
    }

    const url = `wss://stream.binance.com:9443/ws/${bs.toLowerCase()}@depth20@100ms`;
    let ws: WebSocket | null = null;
    let retry = 0;
    let retryTimer: ReturnType<typeof setTimeout> | null = null;
    const connect = () => {
      try {
        ws = new WebSocket(url);
        ws.onopen = () => { retry = 0; };
        ws.onmessage = (ev) => {
          try {
            const m = JSON.parse(ev.data);
            const bids: Level[] = (m.bids || []).slice(0, 12).map((b: string[]) => [parseFloat(b[0]), parseFloat(b[1])]);
            const asks: Level[] = (m.asks || []).slice(0, 12).map((a: string[]) => [parseFloat(a[0]), parseFloat(a[1])]);
            setDepth({ bids, asks });
          } catch {}
        };
        ws.onclose = () => {
          retry++;
          retryTimer = setTimeout(connect, Math.min(30000, 1000 * 2 ** retry));
        };
        ws.onerror = () => { setError("stream error"); ws?.close(); };
      } catch (e) {
        setError((e as Error).message);
        retryTimer = setTimeout(connect, 5000);
      }
    };
    connect();
    return () => {
      if (retryTimer) clearTimeout(retryTimer);
      ws?.close();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [symbol]);

  const { spread, spreadPct, bestBid, bestAsk, maxQty } = useMemo(() => {
    if (!depth || depth.bids.length === 0 || depth.asks.length === 0) {
      return { spread: 0, spreadPct: 0, bestBid: 0, bestAsk: 0, maxQty: 1 };
    }
    const bb = depth.bids[0][0];
    const ba = depth.asks[0][0];
    const s = ba - bb;
    const sp = (s / ba) * 100;
    const mq = Math.max(...depth.bids.map((b) => b[1]), ...depth.asks.map((a) => a[1])) || 1;
    return { spread: s, spreadPct: sp, bestBid: bb, bestAsk: ba, maxQty: mq };
  }, [depth]);

  return (
    <div className="text-xs">
      <div className="mb-2 flex items-center justify-between">
        <h3 className="text-sm font-semibold">Order Book</h3>
        {depth && (
          <div className="flex items-center gap-3 font-mono text-[11px] text-muted-foreground">
            <span>Spread <span className="text-foreground">{formatPrice(spread)}</span></span>
            <span className="text-foreground">{spreadPct.toFixed(3)}%</span>
          </div>
        )}
      </div>
      {error && <p className="mb-2 text-[11px] text-destructive">{error}</p>}
      {!depth ? (
        <div className="py-6 text-center text-muted-foreground">Loading depth…</div>
      ) : (
        <div className="space-y-3">
          {/* Asks (reversed so best ask is closest to mid) */}
          <div>
            <div className="grid grid-cols-3 pb-1 text-[10px] uppercase text-muted-foreground">
              <span>Price (USDT)</span><span className="text-right">Size</span><span className="text-right">Total</span>
            </div>
            <div>
              {depth.asks.slice().reverse().map((a, i) => (
                <Row key={`a${i}`} price={a[0]} qty={a[1]} total={a[0] * a[1]} max={maxQty} side="ask" />
              ))}
            </div>
          </div>
          <div className="flex items-center justify-between rounded-md border border-border/50 bg-muted/30 px-2 py-1.5 font-mono">
            <span className="text-primary">${formatPrice(bestBid)}</span>
            <span className="text-[10px] text-muted-foreground">mark ${formatPrice(mark)}</span>
            <span className="text-destructive">${formatPrice(bestAsk)}</span>
          </div>
          <div>
            {depth.bids.map((b, i) => (
              <Row key={`b${i}`} price={b[0]} qty={b[1]} total={b[0] * b[1]} max={maxQty} side="bid" />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function Row({ price, qty, total, max, side }: { price: number; qty: number; total: number; max: number; side: "bid" | "ask" }) {
  const w = Math.min(100, (qty / max) * 100);
  const color = side === "bid" ? "bg-primary/15" : "bg-destructive/15";
  const text = side === "bid" ? "text-primary" : "text-destructive";
  return (
    <div className="relative grid grid-cols-3 py-0.5 font-mono overflow-hidden">
      <div className={`absolute inset-y-0 right-0 ${color}`} style={{ width: `${w}%` }} />
      <span className={`relative ${text} truncate`}>{formatPrice(price)}</span>
      <span className="relative text-right text-muted-foreground truncate">{qty.toFixed(4)}</span>
      <span className="relative text-right text-muted-foreground truncate">{total.toFixed(2)}</span>
    </div>
  );
}