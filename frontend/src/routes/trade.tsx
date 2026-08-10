import { useSearchParams } from "react-router-dom";
import { useEffect, useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { SiteHeader } from "@/components/layout/site-header";
import { CandlestickChart } from "@/components/candlestick-chart";
import { OrderBook } from "@/components/order-book";
import { BinaryTicket } from "@/components/binary-ticket";
import { SpotTicket } from "@/components/spot-ticket";
import { useStore } from "@/context/store";
import { formatPrice } from "@/services/market-data";

type TradeMode = "futures" | "spot";

function TradeTicket({ asset, mode }: { asset: ReturnType<typeof useStore>["assets"][0]; mode: TradeMode }) {
  return mode === "spot" ? <SpotTicket asset={asset} key={`spot-${asset.symbol}`} /> : <BinaryTicket asset={asset} key={`fut-${asset.symbol}`} />;
}

function ModeToggle({ mode, onChange }: { mode: TradeMode; onChange: (m: TradeMode) => void }) {
  return (
    <div className="mb-2 grid grid-cols-2 gap-1 rounded-lg border border-border/60 bg-muted/30 p-0.5">
      <button
        type="button"
        onClick={() => onChange("futures")}
        className={`rounded-md py-1.5 text-xs font-semibold transition-colors ${
          mode === "futures" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
        }`}
      >
        Futures
      </button>
      <button
        type="button"
        onClick={() => onChange("spot")}
        className={`rounded-md py-1.5 text-xs font-semibold transition-colors ${
          mode === "spot" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
        }`}
      >
        Spot
      </button>
    </div>
  );
}

export default function TradePage() {
  const { assets, wallet, user } = useStore();
  const [searchParams] = useSearchParams();
  const [symbol, setSymbol] = useState(searchParams.get("symbol") || "BTC/USDT");
  const asset = assets.find((a) => a.symbol === symbol) || assets[0];
  const [mode, setMode] = useState<TradeMode>(() => {
    if (typeof window === "undefined") return "futures";
    const v = window.localStorage.getItem("novatrade.trade.mode");
    return v === "spot" || v === "futures" ? v : "futures";
  });
  const [mobileTab, setMobileTab] = useState<string>(() => {
    if (typeof window === "undefined") return "chart";
    const v = window.localStorage.getItem("novatrade.trade.mobileTab");
    return v === "chart" || v === "book" || v === "ticket" ? v : "chart";
  });
  useEffect(() => {
    try { window.localStorage.setItem("novatrade.trade.mobileTab", mobileTab); } catch {}
  }, [mobileTab]);
  useEffect(() => {
    try { window.localStorage.setItem("novatrade.trade.mode", mode); } catch {}
  }, [mode]);

  return (
    <div className="min-h-screen flex flex-col bg-background text-foreground pb-20 md:pb-0">
      <SiteHeader />
      <main className="mx-auto w-full max-w-7xl flex-1 px-2 py-2 sm:px-6 sm:py-6 min-w-0">
        <div className="flex flex-wrap items-center gap-2 rounded-xl border border-border/60 bg-card/60 p-2.5 sm:gap-4 sm:p-4 min-w-0">
          <select
            value={symbol}
            onChange={(e) => setSymbol(e.target.value)}
            className="rounded-md border border-border bg-input px-2 py-1.5 text-xs sm:px-3 sm:py-2 sm:text-sm min-w-[120px] max-w-[160px] sm:max-w-[200px] truncate shrink-0"
          >
            {assets.map((a) => (
              <option key={a.symbol} value={a.symbol}>{a.symbol} — {a.name}</option>
            ))}
          </select>
          <div className="min-w-0 flex-1">
            <div className="text-lg sm:text-2xl font-bold font-mono truncate">${formatPrice(asset.price)}</div>
            <div className={`text-[11px] sm:text-xs ${asset.change24h >= 0 ? "text-primary" : "text-destructive"}`}>
              {asset.change24h >= 0 ? "+" : ""}{asset.change24h.toFixed(2)}% (24h)
            </div>
          </div>
          <div className="text-right text-[10px] sm:text-xs text-muted-foreground min-w-0 ml-auto">
            <div className="truncate max-w-[9rem] sm:max-w-none">{user ? `Balance — ${user.name}` : "Balance"}</div>
            <div className="text-foreground font-mono text-xs sm:text-sm">${wallet.cashUSDT.toFixed(2)} USDT</div>
          </div>
        </div>

        {/* Tablet layout (md → lg) */}
        <div className="mt-3 hidden gap-3 md:grid md:grid-cols-2 lg:hidden">
          <div className="col-span-2 rounded-xl border border-border/60 bg-card/60 p-3 min-w-0 overflow-hidden">
            <CandlestickChart symbol={symbol} height={360} />
          </div>
          <div className="rounded-xl border border-border/60 bg-card/60 p-3 min-w-0 overflow-hidden">
            <OrderBook symbol={symbol} mark={asset.price} />
          </div>
          <div className="rounded-xl border border-border/60 bg-card/60 p-3 min-w-0 overflow-hidden">
            <ModeToggle mode={mode} onChange={setMode} />
            <TradeTicket asset={asset} mode={mode} />
          </div>
        </div>

        {/* Desktop layout (lg+) */}
        <div className="mt-4 hidden gap-3 lg:grid lg:grid-cols-[minmax(0,1fr)_260px_300px] xl:gap-4 xl:grid-cols-[minmax(0,1fr)_280px_320px]">
          <div className="rounded-xl border border-border/60 bg-card/60 p-3 xl:p-4 min-w-0 overflow-hidden">
            <CandlestickChart symbol={symbol} height={480} />
          </div>
          <div className="rounded-xl border border-border/60 bg-card/60 p-3 xl:p-4 min-w-0 overflow-hidden">
            <OrderBook symbol={symbol} mark={asset.price} />
          </div>
          <div className="rounded-xl border border-border/60 bg-card/60 p-3 xl:p-4 min-w-0 overflow-hidden">
            <ModeToggle mode={mode} onChange={setMode} />
            <TradeTicket asset={asset} mode={mode} />
          </div>
        </div>

        {/* Mobile layout (<md): tabbed */}
        <div className="mt-2 md:hidden">
          <Tabs value={mobileTab} onValueChange={setMobileTab} className="w-full">
            <TabsList className="grid h-9 w-full grid-cols-3">
              <TabsTrigger value="chart" className="text-xs">Chart</TabsTrigger>
              <TabsTrigger value="book" className="text-xs">Order Book</TabsTrigger>
              <TabsTrigger value="ticket" className="text-xs">Trade</TabsTrigger>
            </TabsList>
            <TabsContent value="chart" className="mt-2">
              <div className="rounded-xl border border-border/60 bg-card/60 p-2 overflow-hidden">
                <CandlestickChart symbol={symbol} height={280} />
              </div>
            </TabsContent>
            <TabsContent value="book" className="mt-2">
              <div className="rounded-xl border border-border/60 bg-card/60 p-2">
                <OrderBook symbol={symbol} mark={asset.price} />
              </div>
            </TabsContent>
            <TabsContent value="ticket" className="mt-2">
              <div className="rounded-xl border border-border/60 bg-card/60 p-2.5">
                <ModeToggle mode={mode} onChange={setMode} />
                <TradeTicket asset={asset} mode={mode} />
              </div>
            </TabsContent>
          </Tabs>
        </div>
      </main>
    </div>
  );
}
