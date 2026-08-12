import { Link } from "react-router-dom";
import { useState } from "react";
import { toast } from "sonner";
import { ArrowDown, ArrowUp, CheckCircle2, XCircle } from "lucide-react";
import { SiteHeader } from "@/components/layout/site-header";
import { SiteFooter } from "@/components/layout/site-footer";
import { Button } from "@/components/ui/button";
import { useStore, type BinaryTrade } from "@/context/store";
import { CountdownChip } from "@/components/binary-ticket";
import { TradeResultViewDialog, TradeViewButton } from "@/components/trade-result-view";
import { formatPrice } from "@/services/market-data";

import { RequireAuth } from "@/components/auth/require-auth";

export default function PortfolioPage() {
  return (
    <RequireAuth roles={["user"]}>
      <PortfolioContent />
    </RequireAuth>
  );
}

function PortfolioContent() {
  const {
    user, wallet, myTrades, mySpotPositions, assets,
    closeMyTrade, closeSpotPosition,
  } = useStore();
  const [closingId, setClosingId] = useState<string | null>(null);
  const [viewTrade, setViewTrade] = useState<BinaryTrade | null>(null);
  if (!user) return null;

  const active = myTrades.filter((t) => t.status === "active");
  const history = myTrades.filter((t) => t.status !== "active");
  const openSpot = mySpotPositions.filter((p) => p.status === "open");
  const closedSpot = mySpotPositions.filter((p) => p.status === "closed");
  const activeStakes = active.reduce((s, t) => s + t.stake, 0) + openSpot.reduce((s, p) => s + p.cost, 0);
  const totalPnl =
    history.reduce((s, t) => s + (t.pnl ?? 0), 0) +
    closedSpot.reduce((s, p) => s + (p.pnl ?? 0), 0);

  const handleClose = async (tradeId: string, mark: number) => {
    setClosingId(tradeId);
    const r = await closeMyTrade(tradeId, mark);
    setClosingId(null);
    if (!r.ok) toast.error(r.msg);
    else toast.success(r.msg);
  };

  const handleSellSpot = async (id: string) => {
    setClosingId(id);
    const r = await closeSpotPosition(id);
    setClosingId(null);
    if (!r.ok) toast.error(r.msg);
    else toast.success(r.msg);
  };

  return (
    <Shell>
      <main className="mx-auto w-full max-w-7xl flex-1 px-3 py-4 sm:px-6 sm:py-10">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Portfolio</h1>
            <p className="text-sm text-muted-foreground">Welcome back, {user.name}.</p>
          </div>
          <div className="text-right text-xs text-muted-foreground">
            <div>Win payout</div>
            <div className="text-foreground font-mono font-semibold">By duration</div>
            <div className="text-[10px]">Loss always −100%</div>
          </div>
        </div>

        <div className="mt-6 grid grid-cols-2 gap-3 sm:gap-4 sm:grid-cols-4">
          <Stat label="Cash" value={`$${wallet.cashUSDT.toFixed(2)}`} />
          <Stat label="In active trades" value={`$${activeStakes.toFixed(2)}`} />
          <Stat label="Trades placed" value={String(myTrades.length)} />
          <Stat label="Lifetime P&L" value={`${totalPnl >= 0 ? "+" : ""}$${totalPnl.toFixed(2)}`} color={totalPnl >= 0 ? "text-primary" : "text-destructive"} />
        </div>

        <section className="mt-8 overflow-hidden rounded-xl border border-border/60 bg-card/60">
          <div className="border-b border-border/60 px-4 py-3 text-sm font-semibold">Active futures trades</div>
          {active.length === 0 ? (
            <div className="px-4 py-10 text-center text-sm text-muted-foreground">
              No active trades. <Link to="/trade" className="text-primary underline">Start trading</Link>.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/30 text-xs uppercase text-muted-foreground">
                  <tr>
                    <th className="px-3 py-3 text-left">Symbol</th>
                    <th className="px-3 py-3 text-left">Dir.</th>
                    <th className="px-3 py-3 text-right">Stake</th>
                    <th className="px-3 py-3 text-right">Entry</th>
                    <th className="px-3 py-3 text-right">Mark</th>
                    <th className="px-3 py-3 text-right">Settles in</th>
                    <th className="px-3 py-3 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/60">
                  {active.map((t) => {
                    const mark = assets.find((a) => a.symbol === t.symbol)?.price ?? t.entryPrice;
                    return (
                      <tr key={t.id}>
                        <td className="px-3 py-3 font-medium">{t.symbol}</td>
                        <td className="px-3 py-3"><DirPill dir={t.direction} /></td>
                        <td className="px-3 py-3 text-right font-mono">${t.stake.toFixed(2)}</td>
                        <td className="px-3 py-3 text-right font-mono">${formatPrice(t.entryPrice)}</td>
                        <td className="px-3 py-3 text-right font-mono">${formatPrice(mark)}</td>
                        <td className="px-3 py-3 text-right"><CountdownChip until={t.expiresAt} /></td>
                        <td className="px-3 py-3 text-right">
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-7 border-destructive/40 text-destructive hover:bg-destructive/10"
                            disabled={closingId === t.id}
                            onClick={() => handleClose(t.id, mark)}
                          >
                            {closingId === t.id ? "Closing…" : "Close"}
                          </Button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <section className="mt-8 overflow-hidden rounded-xl border border-border/60 bg-card/60">
          <div className="border-b border-border/60 px-4 py-3 text-sm font-semibold">Open spot positions</div>
          {openSpot.length === 0 ? (
            <div className="px-4 py-8 text-center text-sm text-muted-foreground">
              No open spot positions. <Link to="/trade" className="text-primary underline">Trade spot</Link>.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/30 text-xs uppercase text-muted-foreground">
                  <tr>
                    <th className="px-3 py-3 text-left">Symbol</th>
                    <th className="px-3 py-3 text-left">Side</th>
                    <th className="px-3 py-3 text-right">Qty</th>
                    <th className="px-3 py-3 text-right">Entry</th>
                    <th className="px-3 py-3 text-right">Mark</th>
                    <th className="px-3 py-3 text-right">Unrealized</th>
                    <th className="px-3 py-3 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/60">
                  {openSpot.map((p) => {
                    const isLong = p.side !== "sell";
                    const entry = p.entryPrice ?? p.buyPrice ?? 0;
                    const mark = assets.find((a) => a.symbol === p.symbol)?.price ?? entry;
                    const uPnl = isLong ? (mark - entry) * p.quantity : (entry - mark) * p.quantity;
                    const uPct = entry > 0
                      ? (isLong ? (mark - entry) / entry : (entry - mark) / entry) * 100
                      : 0;
                    return (
                      <tr key={p.id}>
                        <td className="px-3 py-3 font-medium">{p.symbol}</td>
                        <td className="px-3 py-3">
                          <span className={`rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase ${
                            isLong ? "bg-primary/15 text-primary" : "bg-destructive/15 text-destructive"
                          }`}>
                            {isLong ? "Long" : "Short"}
                          </span>
                        </td>
                        <td className="px-3 py-3 text-right font-mono">{p.quantity.toFixed(6)}</td>
                        <td className="px-3 py-3 text-right font-mono">${formatPrice(entry)}</td>
                        <td className="px-3 py-3 text-right font-mono">${formatPrice(mark)}</td>
                        <td className={`px-3 py-3 text-right font-mono ${uPnl >= 0 ? "text-primary" : "text-destructive"}`}>
                          {uPnl >= 0 ? "+" : ""}${uPnl.toFixed(2)} ({uPct >= 0 ? "+" : ""}{uPct.toFixed(2)}%)
                        </td>
                        <td className="px-3 py-3 text-right">
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-7 border-destructive/40 text-destructive"
                            disabled={closingId === p.id}
                            onClick={() => void handleSellSpot(p.id)}
                          >
                            {closingId === p.id ? "Closing…" : "Close position"}
                          </Button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <section className="mt-8 overflow-hidden rounded-xl border border-border/60 bg-card/60">
          <div className="border-b border-border/60 px-4 py-3 text-sm font-semibold">Futures trade history</div>
          {history.length === 0 ? (
            <div className="px-4 py-8 text-center text-sm text-muted-foreground">No resolved trades yet.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/30 text-xs uppercase text-muted-foreground">
                  <tr>
                    <th className="px-3 py-3 text-left">Settled</th>
                    <th className="px-3 py-3 text-left">Symbol</th>
                    <th className="px-3 py-3 text-left">Dir.</th>
                    <th className="px-3 py-3 text-right">Stake</th>
                    <th className="px-3 py-3 text-right">Entry</th>
                    <th className="px-3 py-3 text-right">Close</th>
                    <th className="px-3 py-3 text-left">Result</th>
                    <th className="px-3 py-3 text-right">P&L</th>
                    <th className="px-3 py-3 text-right">View</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/60">
                  {history.slice(0, 100).map((t) => (
                    <tr key={t.id}>
                      <td className="px-3 py-3 text-xs text-muted-foreground">{t.resolvedAt ? new Date(t.resolvedAt).toLocaleString() : "—"}</td>
                      <td className="px-3 py-3 font-medium">{t.symbol}</td>
                      <td className="px-3 py-3"><DirPill dir={t.direction} /></td>
                      <td className="px-3 py-3 text-right font-mono">${t.stake.toFixed(2)}</td>
                      <td className="px-3 py-3 text-right font-mono">${formatPrice(t.entryPrice)}</td>
                      <td className="px-3 py-3 text-right font-mono">{t.closePrice != null ? `$${formatPrice(t.closePrice)}` : "—"}</td>
                      <td className="px-3 py-3">
                        {t.status === "won"
                          ? <span className="inline-flex items-center gap-1 rounded bg-primary/15 px-2 py-0.5 text-xs font-semibold text-primary"><CheckCircle2 className="h-3 w-3" />WON</span>
                          : <span className="inline-flex items-center gap-1 rounded bg-destructive/15 px-2 py-0.5 text-xs font-semibold text-destructive"><XCircle className="h-3 w-3" />LOST</span>}
                      </td>
                      <td className={`px-3 py-3 text-right font-mono ${(t.pnl ?? 0) >= 0 ? "text-primary" : "text-destructive"}`}>
                        {(t.pnl ?? 0) >= 0 ? "+" : ""}${(t.pnl ?? 0).toFixed(2)}
                      </td>
                      <td className="px-3 py-3 text-right">
                        <TradeViewButton onClick={() => setViewTrade(t)} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        {viewTrade && (
          <TradeResultViewDialog
            trade={viewTrade}
            open={!!viewTrade}
            onOpenChange={(o) => { if (!o) setViewTrade(null); }}
            userName={user.name}
            userInitials={`${user.fname?.[0] ?? ""}${user.lname?.[0] ?? ""}`.toUpperCase() || "U"}
          />
        )}

        <section className="mt-8 overflow-hidden rounded-xl border border-border/60 bg-card/60">
          <div className="border-b border-border/60 px-4 py-3 text-sm font-semibold">Spot trade history</div>
          {closedSpot.length === 0 ? (
            <div className="px-4 py-8 text-center text-sm text-muted-foreground">No closed spot trades yet.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/30 text-xs uppercase text-muted-foreground">
                  <tr>
                    <th className="px-3 py-3 text-left">Closed</th>
                    <th className="px-3 py-3 text-left">Symbol</th>
                    <th className="px-3 py-3 text-left">Side</th>
                    <th className="px-3 py-3 text-right">Qty</th>
                    <th className="px-3 py-3 text-right">Entry</th>
                    <th className="px-3 py-3 text-right">Exit</th>
                    <th className="px-3 py-3 text-right">P&L</th>
                    <th className="px-3 py-3 text-right">P&L %</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/60">
                  {closedSpot.slice(0, 100).map((p) => {
                    const isLong = p.side !== "sell";
                    const entry = p.entryPrice ?? p.buyPrice ?? 0;
                    const exit = p.exitPrice ?? (isLong ? p.sellPrice : p.buyPrice);
                    return (
                      <tr key={p.id}>
                        <td className="px-3 py-3 text-xs text-muted-foreground">{p.closedAt ? new Date(p.closedAt).toLocaleString() : "—"}</td>
                        <td className="px-3 py-3 font-medium">{p.symbol}</td>
                        <td className="px-3 py-3">
                          <span className={`rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase ${
                            isLong ? "bg-primary/15 text-primary" : "bg-destructive/15 text-destructive"
                          }`}>
                            {isLong ? "Long" : "Short"}
                          </span>
                        </td>
                        <td className="px-3 py-3 text-right font-mono">{p.quantity.toFixed(6)}</td>
                        <td className="px-3 py-3 text-right font-mono">${formatPrice(entry)}</td>
                        <td className="px-3 py-3 text-right font-mono">{exit != null ? `$${formatPrice(exit)}` : "—"}</td>
                        <td className={`px-3 py-3 text-right font-mono ${(p.pnl ?? 0) >= 0 ? "text-primary" : "text-destructive"}`}>
                          {(p.pnl ?? 0) >= 0 ? "+" : ""}${(p.pnl ?? 0).toFixed(2)}
                        </td>
                        <td className={`px-3 py-3 text-right font-mono ${(p.pnlPercent ?? 0) >= 0 ? "text-primary" : "text-destructive"}`}>
                          {(p.pnlPercent ?? 0) >= 0 ? "+" : ""}{(p.pnlPercent ?? 0).toFixed(2)}%
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </main>
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex flex-col bg-background text-foreground pb-20 md:pb-0">
      <SiteHeader />
      {children}
      <SiteFooter />
    </div>
  );
}

function DirPill({ dir }: { dir: "up" | "down" }) {
  return dir === "up"
    ? <span className="inline-flex items-center gap-1 rounded bg-primary/15 px-2 py-0.5 text-xs font-semibold text-primary"><ArrowUp className="h-3 w-3" />UP</span>
    : <span className="inline-flex items-center gap-1 rounded bg-destructive/15 px-2 py-0.5 text-xs font-semibold text-destructive"><ArrowDown className="h-3 w-3" />DOWN</span>;
}

function Stat({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div className="rounded-xl border border-border/60 bg-card/60 p-5">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className={`mt-1 text-2xl font-bold font-mono ${color || ""}`}>{value}</div>
    </div>
  );
}
