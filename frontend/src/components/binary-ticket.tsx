import { useEffect, useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { toast } from "sonner";
import { ArrowUp, ArrowDown, Timer, ShieldAlert, XCircle, CheckCircle2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { useStore } from "@/context/store";
import { TRADE_DURATIONS } from "@/constants/roles";
import { formatPrice, type Asset } from "@/services/market-data";

export function BinaryTicket({ asset }: { asset: Asset }) {
  const { user, wallet, myTrades, placeBinaryTrade, closeMyTrade, payoutPercent } = useStore();
  const [stake, setStake] = useState("10");
  const [durationSec, setDurationSec] = useState<number>(60);
  const [closingId, setClosingId] = useState<string | null>(null);

  const stakeN = parseFloat(stake) || 0;
  const profit = useMemo(() => stakeN * (payoutPercent / 100), [stakeN, payoutPercent]);
  const insufficient = stakeN > wallet.cashUSDT;
  const kycBlocked = !!user && user.kyc.status !== "approved";

  const activeTrades = myTrades.filter((t) => t.status === "active");
  const symbolHistory = myTrades
    .filter((t) => t.status !== "active" && t.symbol === asset.symbol)
    .slice(0, 5);

  const place = async (direction: "up" | "down") => {
    const r = await placeBinaryTrade({ symbol: asset.symbol, direction, stake: stakeN, durationSec });
    if (!r.ok) toast.error(r.msg);
    else toast.success(r.msg);
  };

  const closeTrade = async (tradeId: string, mark: number) => {
    setClosingId(tradeId);
    const r = await closeMyTrade(tradeId, mark);
    setClosingId(null);
    if (!r.ok) toast.error(r.msg);
    else toast.success(r.msg);
  };

  if (!user) {
    return (
      <div className="space-y-3">
        <p className="text-sm text-muted-foreground">Log in to place trades.</p>
        <Button asChild className="w-full bg-primary text-primary-foreground"><Link to="/login">Log in</Link></Button>
      </div>
    );
  }

  return (
    <div className="space-y-3 sm:space-y-4">
      <div className="rounded-lg border border-border/60 bg-background/60 p-3">
        <div className="flex items-center justify-between text-xs">
          <span className="text-muted-foreground">Current price</span>
          <span className="font-mono text-base font-semibold">${formatPrice(asset.price)}</span>
        </div>
        <div className="mt-1 flex items-center justify-between text-xs">
          <span className="text-muted-foreground">Payout if you win</span>
          <span className="font-mono font-semibold text-primary">+{payoutPercent.toFixed(0)}%</span>
        </div>
      </div>

      <div>
        <Label className="text-xs flex items-center gap-1"><Timer className="h-3 w-3" />Duration</Label>
        <div className="mt-2 grid grid-cols-5 gap-1.5">
          {TRADE_DURATIONS.map((d) => (
            <button
              key={d.sec}
              type="button"
              onClick={() => setDurationSec(d.sec)}
              className={`rounded-md border py-1.5 text-xs font-semibold transition-colors ${
                durationSec === d.sec ? "border-primary bg-primary/15 text-primary" : "border-border text-muted-foreground hover:text-foreground"
              }`}
            >
              {d.label}
            </button>
          ))}
        </div>
      </div>

      <div>
        <div className="flex items-center justify-between">
          <Label className="text-xs">Stake (USDT)</Label>
          <span className="text-[10px] text-muted-foreground">Balance ${wallet.cashUSDT.toFixed(2)}</span>
        </div>
        <Input value={stake} onChange={(e) => setStake(e.target.value)} type="number" min="0" placeholder="10" />
        <div className="mt-2 grid grid-cols-4 gap-1.5">
          {[10, 25, 50, 100].map((p) => (
            <button key={p} type="button" onClick={() => setStake(String(Math.min(wallet.cashUSDT, wallet.cashUSDT * (p / 100)).toFixed(2)))}
              className="rounded-md border border-border py-1 text-[11px] hover:bg-muted/40">{p}%</button>
          ))}
        </div>
      </div>

      <div className="space-y-1 rounded-md bg-muted/30 p-3 text-xs">
        <Row label="Stake" value={`$${stakeN.toFixed(2)}`} />
        <Row label="Potential profit" value={`+$${profit.toFixed(2)}`} accent="text-primary" />
        <Row label="Total return (win)" value={`$${(stakeN + profit).toFixed(2)}`} />
        <Row label="Loss (if wrong)" value={`-$${stakeN.toFixed(2)}`} accent="text-destructive" />
      </div>

      {kycBlocked && (
        <div className="flex items-start gap-2 rounded-md border border-amber-500/40 bg-amber-500/10 p-2 text-[11px] text-amber-400">
          <ShieldAlert className="h-3.5 w-3.5 mt-0.5" />
          <div>Complete <Link to="/kyc" className="underline font-semibold">KYC verification</Link> to start trading.</div>
        </div>
      )}

      <div className="grid grid-cols-2 gap-2">
        <Button onClick={() => place("up")} disabled={kycBlocked || insufficient || stakeN <= 0}
          className="bg-primary text-primary-foreground hover:opacity-90">
          <ArrowUp className="mr-1 h-4 w-4" />UP
        </Button>
        <Button onClick={() => place("down")} disabled={kycBlocked || insufficient || stakeN <= 0}
          className="bg-destructive text-destructive-foreground hover:opacity-90">
          <ArrowDown className="mr-1 h-4 w-4" />DOWN
        </Button>
      </div>
      {insufficient && <p className="text-[11px] text-destructive">Insufficient balance.</p>}

      {activeTrades.length > 0 && (
        <div className="space-y-2 rounded-lg border border-amber-500/30 bg-amber-500/5 p-3">
          <div className="flex items-center justify-between text-xs font-semibold">
            <span className="text-amber-400">Active trades</span>
            <Link to="/portfolio" className="text-[10px] text-muted-foreground underline hover:text-foreground">View all</Link>
          </div>
          <div className="space-y-2">
            {activeTrades.map((t) => {
              const mark = t.symbol === asset.symbol ? asset.price : t.entryPrice;
              const isCurrent = t.symbol === asset.symbol;
              return (
                <div
                  key={t.id}
                  className={`flex flex-wrap items-center justify-between gap-2 rounded-md border p-2 text-[11px] ${
                    isCurrent ? "border-primary/40 bg-primary/5" : "border-border/60 bg-background/40"
                  }`}
                >
                  <div className="min-w-0">
                    <div className="font-medium">{t.symbol}</div>
                    <div className="mt-0.5 flex items-center gap-2 text-muted-foreground">
                      <span className={t.direction === "up" ? "text-primary" : "text-destructive"}>
                        {t.direction.toUpperCase()}
                      </span>
                      <span className="font-mono">${t.stake.toFixed(2)}</span>
                      <CountdownChip until={t.expiresAt} />
                    </div>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-7 shrink-0 border-destructive/40 text-destructive hover:bg-destructive/10"
                    disabled={closingId === t.id}
                    onClick={() => closeTrade(t.id, mark)}
                  >
                    {closingId === t.id ? "Closing…" : "Close trade"}
                  </Button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {symbolHistory.length > 0 && (
        <div className="space-y-2 rounded-lg border border-border/60 bg-muted/20 p-3">
          <div className="flex items-center justify-between text-xs font-semibold">
            <span>Recent history — {asset.symbol}</span>
            <Link to="/portfolio" className="text-[10px] text-muted-foreground underline hover:text-foreground">Full history</Link>
          </div>
          <div className="space-y-1.5">
            {symbolHistory.map((t) => (
              <div key={t.id} className="flex items-center justify-between text-[11px]">
                <span className="text-muted-foreground">
                  {t.resolvedAt ? new Date(t.resolvedAt).toLocaleString() : "—"}
                </span>
                <span className="flex items-center gap-2">
                  {t.status === "won"
                    ? <span className="inline-flex items-center gap-0.5 text-primary"><CheckCircle2 className="h-3 w-3" />WON</span>
                    : <span className="inline-flex items-center gap-0.5 text-destructive"><XCircle className="h-3 w-3" />LOST</span>}
                  <span className={`font-mono ${(t.pnl ?? 0) >= 0 ? "text-primary" : "text-destructive"}`}>
                    {(t.pnl ?? 0) >= 0 ? "+" : ""}${(t.pnl ?? 0).toFixed(2)}
                  </span>
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function Row({ label, value, accent }: { label: string; value: string; accent?: string }) {
  return (
    <div className="flex justify-between">
      <span className="text-muted-foreground">{label}</span>
      <span className={`font-mono ${accent || ""}`}>{value}</span>
    </div>
  );
}

// active-countdown helper component (used by Portfolio)
export function CountdownChip({ until }: { until: number }) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(id);
  }, []);
  const left = Math.max(0, Math.ceil((until - now) / 1000));
  return <span className="inline-flex items-center gap-1 rounded bg-primary/15 px-2 py-0.5 font-mono text-xs text-primary">
    <Timer className="h-3 w-3" />{left}s
  </span>;
}
