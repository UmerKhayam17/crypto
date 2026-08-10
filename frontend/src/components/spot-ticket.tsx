import { useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { toast } from "sonner";
import { ShieldAlert, ArrowUp, ArrowDown } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { useStore } from "@/context/store";
import { formatPrice, type Asset } from "@/services/market-data";

export function SpotTicket({ asset }: { asset: Asset }) {
  const {
    user,
    wallet,
    spotFeePercent,
    mySpotPositions,
    openSpotPosition,
    closeSpotPosition,
  } = useStore();

  const [qtyMode, setQtyMode] = useState<"qty" | "usdt">("usdt");
  const [amount, setAmount] = useState("100");
  const [busySide, setBusySide] = useState<"buy" | "sell" | null>(null);
  const [closingId, setClosingId] = useState<string | null>(null);

  const amountN = parseFloat(amount) || 0;
  const feePct = spotFeePercent / 100;

  const quantity = useMemo(() => {
    if (qtyMode === "qty") return amountN;
    if (asset.price <= 0) return 0;
    return amountN / (asset.price * (1 + feePct));
  }, [amountN, qtyMode, asset.price, feePct]);

  const entryFee = asset.price * quantity * feePct;
  const cost = asset.price * quantity + entryFee;
  const insufficient = cost > wallet.cashUSDT + 1e-8;
  const kycBlocked = !!user && user.kyc.status !== "approved";
  const canOpen = !kycBlocked && !insufficient && quantity > 0 && !busySide;

  const openPositions = mySpotPositions.filter(
    (p) => p.status === "open" && p.symbol === asset.symbol
  );
  const allOpen = mySpotPositions.filter((p) => p.status === "open");
  const history = mySpotPositions.filter((p) => p.status === "closed").slice(0, 5);

  const open = async (side: "buy" | "sell") => {
    setBusySide(side);
    const r = await openSpotPosition({ symbol: asset.symbol, quantity, side });
    setBusySide(null);
    if (!r.ok) toast.error(r.msg);
    else toast.success(r.msg);
  };

  const close = async (id: string) => {
    setClosingId(id);
    const r = await closeSpotPosition(id);
    setClosingId(null);
    if (!r.ok) toast.error(r.msg);
    else toast.success(r.msg);
  };

  if (!user) {
    return (
      <div className="space-y-3">
        <p className="text-sm text-muted-foreground">Log in to trade spot.</p>
        <Button asChild className="w-full bg-primary text-primary-foreground">
          <Link to="/login">Log in</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-3 sm:space-y-4">
      <div className="rounded-lg border border-border/60 bg-background/60 p-3">
        <div className="flex items-center justify-between text-xs">
          <span className="text-muted-foreground">Mark price</span>
          <span className="font-mono text-base font-semibold">${formatPrice(asset.price)}</span>
        </div>
        <div className="mt-1 flex items-center justify-between text-xs">
          <span className="text-muted-foreground">Spot fee (each side)</span>
          <span className="font-mono font-semibold">{spotFeePercent.toFixed(2)}%</span>
        </div>
      </div>

      <div>
        <div className="flex items-center justify-between">
          <Label className="text-xs">Order size</Label>
          <div className="flex gap-1">
            {(["usdt", "qty"] as const).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => setQtyMode(m)}
                className={`rounded px-2 py-0.5 text-[10px] font-semibold uppercase ${
                  qtyMode === m ? "bg-primary/15 text-primary" : "text-muted-foreground"
                }`}
              >
                {m === "usdt" ? "USDT" : "Qty"}
              </button>
            ))}
          </div>
        </div>
        <Input
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          type="number"
          min="0"
          step="any"
          placeholder={qtyMode === "usdt" ? "100" : "0.01"}
          className="mt-1"
        />
        <div className="mt-2 grid grid-cols-4 gap-1.5">
          {[10, 25, 50, 100].map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => {
                if (qtyMode === "usdt") {
                  setAmount(String(Math.min(wallet.cashUSDT, wallet.cashUSDT * (p / 100)).toFixed(2)));
                } else {
                  const maxQty = wallet.cashUSDT / (asset.price * (1 + feePct) || 1);
                  setAmount(String((maxQty * (p / 100)).toFixed(8)));
                }
              }}
              className="rounded-md border border-border py-1 text-[11px] hover:bg-muted/40"
            >
              {p}%
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-1 rounded-md bg-muted/30 p-3 text-xs">
        <Row label="Quantity" value={quantity > 0 ? quantity.toFixed(8) : "—"} />
        <Row label="Entry price" value={`$${formatPrice(asset.price)}`} />
        <Row label="Entry fee" value={`$${entryFee.toFixed(4)}`} />
        <Row label="Margin / cost" value={`$${cost.toFixed(2)}`} accent="text-foreground font-semibold" />
      </div>

      {kycBlocked && (
        <div className="flex items-start gap-2 rounded-md border border-amber-500/40 bg-amber-500/10 p-2 text-[11px] text-amber-400">
          <ShieldAlert className="mt-0.5 h-3.5 w-3.5" />
          <div>
            Complete <Link to="/kyc" className="underline font-semibold">KYC verification</Link> to trade.
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 gap-2">
        <Button
          onClick={() => void open("buy")}
          disabled={!canOpen}
          className="bg-primary text-primary-foreground hover:opacity-90"
        >
          <ArrowUp className="mr-1 h-4 w-4" />
          {busySide === "buy" ? "Opening…" : "Buy / Long"}
        </Button>
        <Button
          onClick={() => void open("sell")}
          disabled={!canOpen}
          className="bg-destructive text-destructive-foreground hover:opacity-90"
        >
          <ArrowDown className="mr-1 h-4 w-4" />
          {busySide === "sell" ? "Opening…" : "Sell / Short"}
        </Button>
      </div>
      {insufficient && quantity > 0 && (
        <p className="text-[11px] text-destructive">Insufficient balance (need ${cost.toFixed(2)}).</p>
      )}
      <p className="text-[10px] text-muted-foreground">
        Long: profit when price rises. Short: profit when price falls. Close anytime.
      </p>

      {(openPositions.length > 0 || allOpen.length > 0) && (
        <div className="space-y-2 rounded-lg border border-primary/30 bg-primary/5 p-3">
          <div className="text-xs font-semibold text-primary">
            Open positions {openPositions.length ? `(${asset.symbol})` : ""}
          </div>
          <div className="space-y-2">
            {(openPositions.length ? openPositions : allOpen).map((p) => {
              const entry = p.entryPrice ?? p.buyPrice ?? 0;
              const mark = p.symbol === asset.symbol ? asset.price : entry;
              const isLong = p.side !== "sell";
              const uPnl = isLong
                ? (mark - entry) * p.quantity
                : (entry - mark) * p.quantity;
              const uPct = entry > 0
                ? (isLong ? (mark - entry) / entry : (entry - mark) / entry) * 100
                : 0;
              return (
                <div
                  key={p.id}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-border/60 bg-background/40 p-2 text-[11px]"
                >
                  <div>
                    <div className="flex items-center gap-1.5 font-medium">
                      {p.symbol}
                      <span className={`rounded px-1 py-0.5 text-[9px] font-semibold uppercase ${
                        isLong ? "bg-primary/15 text-primary" : "bg-destructive/15 text-destructive"
                      }`}>
                        {isLong ? "Long" : "Short"}
                      </span>
                    </div>
                    <div className="mt-0.5 text-muted-foreground">
                      Qty {p.quantity.toFixed(6)} · Entry ${formatPrice(entry)}
                    </div>
                    <div className={`font-mono ${uPnl >= 0 ? "text-primary" : "text-destructive"}`}>
                      {uPnl >= 0 ? "+" : ""}${uPnl.toFixed(2)} ({uPct >= 0 ? "+" : ""}{uPct.toFixed(2)}%)
                    </div>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-7 border-destructive/40 text-destructive"
                    disabled={closingId === p.id}
                    onClick={() => void close(p.id)}
                  >
                    {closingId === p.id ? "Closing…" : "Close position"}
                  </Button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {history.length > 0 && (
        <div className="space-y-1.5 rounded-lg border border-border/60 bg-muted/20 p-3">
          <div className="text-xs font-semibold">Recent spot closes</div>
          {history.map((p) => (
            <div key={p.id} className="flex justify-between text-[11px]">
              <span className="text-muted-foreground">
                {p.symbol} {p.side === "sell" ? "Short" : "Long"}
              </span>
              <span className={`font-mono ${(p.pnl ?? 0) >= 0 ? "text-primary" : "text-destructive"}`}>
                {(p.pnl ?? 0) >= 0 ? "+" : ""}${(p.pnl ?? 0).toFixed(2)}
                {p.pnlPercent != null ? ` (${p.pnlPercent >= 0 ? "+" : ""}${p.pnlPercent.toFixed(2)}%)` : ""}
              </span>
            </div>
          ))}
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
