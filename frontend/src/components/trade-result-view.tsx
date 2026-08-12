import { useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import {
  ArrowDown,
  ArrowUp,
  CheckCircle2,
  Download,
  Eye,
  Loader2,
  Sparkles,
  Timer,
  TrendingUp,
  XCircle,
} from "lucide-react";
import type { BinaryTrade } from "@/context/store";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { formatPrice } from "@/services/market-data";
import { cn } from "@/lib/utils";

type ShareMode = "pnl" | "roi" | "both";

type TradeResultViewProps = {
  trade: BinaryTrade;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userName?: string;
  userInitials?: string;
};

function roiPercent(trade: BinaryTrade) {
  if (!(trade.stake > 0)) return 0;
  return ((trade.pnl ?? 0) / trade.stake) * 100;
}

export function TradeResultViewDialog({
  trade,
  open,
  onOpenChange,
  userName,
  userInitials,
}: TradeResultViewProps) {
  const cardRef = useRef<HTMLDivElement | null>(null);
  const [mode, setMode] = useState<ShareMode>("both");
  const [downloading, setDownloading] = useState(false);

  const won = trade.status === "won";
  const pnl = trade.pnl ?? 0;
  const roi = roiPercent(trade);
  const positive = pnl >= 0;
  const when = trade.resolvedAt || trade.openedAt;
  const priceDelta =
    trade.closePrice != null ? trade.closePrice - trade.entryPrice : null;
  const initials =
    userInitials ||
    (userName
      ? userName
          .split(/\s+/)
          .map((p) => p[0])
          .join("")
          .slice(0, 2)
          .toUpperCase()
      : "ET");

  const headline = useMemo(() => {
    if (mode === "roi") {
      return {
        main: `${roi >= 0 ? "+" : ""}${roi.toFixed(2)}%`,
        sub: null as string | null,
        label: "ROI",
      };
    }
    if (mode === "pnl") {
      return {
        main: `${pnl >= 0 ? "+" : ""}$${Math.abs(pnl).toFixed(2)}`,
        sub: null as string | null,
        label: "PNL · USDT",
      };
    }
    return {
      main: `${pnl >= 0 ? "+" : ""}$${Math.abs(pnl).toFixed(2)}`,
      sub: `${roi >= 0 ? "+" : ""}${roi.toFixed(2)}% ROI`,
      label: "PNL · USDT",
    };
  }, [mode, pnl, roi]);

  const download = async () => {
    if (!cardRef.current) return;
    setDownloading(true);
    try {
      const html2canvas = (await import("html2canvas")).default;
      const canvas = await html2canvas(cardRef.current, {
        backgroundColor: "#1a1610",
        scale: Math.min(2.5, Math.max(2, window.devicePixelRatio || 2)),
        useCORS: true,
        width: cardRef.current.offsetWidth,
        windowWidth: Math.max(cardRef.current.offsetWidth, 360),
      });
      const link = document.createElement("a");
      link.download = `evios-trade-${trade.symbol.replace("/", "")}-${trade.id.slice(-6)}.png`;
      link.href = canvas.toDataURL("image/png");
      link.click();
      toast.success("Trade card downloaded");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not download image");
    } finally {
      setDownloading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className={cn(
          "flex max-h-[min(94dvh,920px)] w-[min(100vw-0.75rem,420px)] max-w-[420px] flex-col gap-0 overflow-hidden border-border/50 bg-background p-0",
          "left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2",
          "rounded-xl sm:rounded-2xl",
          "pb-[env(safe-area-inset-bottom)]"
        )}
      >
        <DialogHeader className="shrink-0 border-b border-border/50 px-3 py-3 sm:px-4 sm:py-3.5">
          <DialogTitle className="flex items-center gap-2 pr-8 text-sm font-bold tracking-tight sm:text-base">
            <span className="grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-primary/15 text-primary">
              <Eye className="h-3.5 w-3.5" />
            </span>
            Trade result card
          </DialogTitle>
        </DialogHeader>

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
          <div
            className="p-3 sm:p-5"
            style={{
              background:
                "radial-gradient(ellipse 80% 60% at 50% 0%, oklch(0.88 0.1 85 / 0.18), transparent 60%), oklch(0.94 0.03 95)",
            }}
          >
            <div
              ref={cardRef}
              className="trade-share-card relative mx-auto w-full max-w-[380px] overflow-hidden rounded-[1.1rem] text-white shadow-[0_24px_60px_-28px_rgba(40,28,10,0.65)] sm:rounded-[1.35rem]"
              style={{ background: "#1a1610" }}
            >
              {/* Atmosphere */}
              <div
                className="pointer-events-none absolute inset-0"
                style={{
                  background: positive
                    ? "radial-gradient(ellipse 90% 70% at 15% -10%, oklch(0.78 0.16 85 / 0.35), transparent 55%), radial-gradient(ellipse 70% 50% at 100% 100%, oklch(0.62 0.14 155 / 0.18), transparent 50%)"
                    : "radial-gradient(ellipse 90% 70% at 15% -10%, oklch(0.58 0.18 25 / 0.28), transparent 55%), radial-gradient(ellipse 70% 50% at 100% 100%, oklch(0.45 0.08 40 / 0.2), transparent 50%)",
                }}
              />
              <div
                className="pointer-events-none absolute inset-0 opacity-[0.09]"
                style={{
                  backgroundImage:
                    "linear-gradient(rgba(255,220,140,0.35) 1px, transparent 1px), linear-gradient(90deg, rgba(255,220,140,0.35) 1px, transparent 1px)",
                  backgroundSize: "28px 28px",
                  maskImage: "radial-gradient(ellipse at center, black 20%, transparent 75%)",
                }}
              />
              <div className="pointer-events-none absolute -right-6 top-12 opacity-[0.08] sm:-right-8 sm:top-16">
                <TrendingUp className="h-32 w-32 text-amber-200 sm:h-44 sm:w-44" strokeWidth={1} />
              </div>

              <div className="relative px-3.5 pb-1.5 pt-4 sm:px-5 sm:pb-2 sm:pt-5">
                {/* Top bar */}
                <div className="flex items-start justify-between gap-2 sm:gap-3">
                  <div className="flex min-w-0 items-center gap-2.5 sm:gap-3">
                    <div
                      className="grid h-9 w-9 shrink-0 place-items-center rounded-full text-xs font-extrabold text-[#1a1610] shadow-[0_0_24px_-4px_rgba(245,197,66,0.55)] sm:h-11 sm:w-11 sm:text-sm"
                      style={{ background: "var(--gradient-emerald)" }}
                    >
                      {initials}
                    </div>
                    <div className="min-w-0">
                      <div className="truncate text-[13px] font-bold tracking-tight text-amber-50 sm:text-[15px]">
                        {userName || "Evios Trader"}
                      </div>
                      <div className="mt-0.5 text-[10px] text-amber-100/55 sm:text-[11px]">
                        {new Date(when).toLocaleString([], {
                          year: "numeric",
                          month: "short",
                          day: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </div>
                    </div>
                  </div>
                  <div
                    className={cn(
                      "inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-1 text-[9px] font-extrabold uppercase tracking-wider sm:gap-1.5 sm:px-2.5 sm:text-[10px]",
                      won
                        ? "bg-emerald-400/15 text-emerald-300 ring-1 ring-emerald-400/35"
                        : "bg-rose-400/15 text-rose-300 ring-1 ring-rose-400/35"
                    )}
                  >
                    {won ? <CheckCircle2 className="h-3 w-3 sm:h-3.5 sm:w-3.5" /> : <XCircle className="h-3 w-3 sm:h-3.5 sm:w-3.5" />}
                    {won ? "Won" : "Lost"}
                  </div>
                </div>

                {/* Symbol block */}
                <div className="mt-5 sm:mt-7">
                  <div className="flex items-center gap-1.5 text-[9px] font-bold uppercase tracking-[0.16em] text-amber-200/50 sm:gap-2 sm:text-[10px] sm:tracking-[0.18em]">
                    <Sparkles className="h-3 w-3 text-amber-300/70" />
                    Futures result
                  </div>
                  <div className="mt-1.5 break-all text-[clamp(1.35rem,5.5vw,1.75rem)] font-black leading-none tracking-tight text-white">
                    {trade.symbol}
                  </div>
                  <div className="mt-2.5 flex flex-wrap items-center gap-1.5 sm:mt-3 sm:gap-2">
                    <span
                      className={cn(
                        "inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[10px] font-extrabold uppercase tracking-wide sm:px-2 sm:py-1 sm:text-[11px]",
                        trade.direction === "up"
                          ? "bg-emerald-400/15 text-emerald-300"
                          : "bg-rose-400/15 text-rose-300"
                      )}
                    >
                      {trade.direction === "up" ? (
                        <ArrowUp className="h-3 w-3 sm:h-3.5 sm:w-3.5" />
                      ) : (
                        <ArrowDown className="h-3 w-3 sm:h-3.5 sm:w-3.5" />
                      )}
                      {trade.direction}
                    </span>
                    <span className="inline-flex items-center gap-1 rounded-md bg-white/5 px-1.5 py-0.5 text-[10px] font-semibold text-amber-100/70 ring-1 ring-white/10 sm:px-2 sm:py-1 sm:text-[11px]">
                      <Timer className="h-3 w-3" />
                      {trade.durationSec}s
                    </span>
                    <span className="inline-flex items-center rounded-md bg-white/5 px-1.5 py-0.5 font-mono text-[10px] font-semibold text-amber-100/70 ring-1 ring-white/10 sm:px-2 sm:py-1 sm:text-[11px]">
                      ${trade.stake.toFixed(2)}
                    </span>
                  </div>
                </div>

                {/* Big PNL */}
                <div className="mt-5 sm:mt-8">
                  <div className="text-[9px] font-bold uppercase tracking-[0.14em] text-amber-200/45 sm:text-[10px] sm:tracking-[0.16em]">
                    {headline.label}
                  </div>
                  <div
                    className={cn(
                      "mt-1 font-black leading-[1.05] tracking-tight",
                      "text-[clamp(1.85rem,9vw,2.85rem)]",
                      positive ? "text-emerald-300" : "text-rose-300"
                    )}
                    style={
                      positive
                        ? { textShadow: "0 0 40px rgba(52, 211, 153, 0.35)" }
                        : { textShadow: "0 0 40px rgba(251, 113, 133, 0.3)" }
                    }
                  >
                    {headline.main}
                  </div>
                  {headline.sub && (
                    <div
                      className={cn(
                        "mt-2 inline-flex max-w-full items-center truncate rounded-full px-2 py-0.5 text-xs font-bold font-mono sm:px-2.5 sm:py-1 sm:text-sm",
                        positive
                          ? "bg-emerald-400/10 text-emerald-300"
                          : "bg-rose-400/10 text-rose-300"
                      )}
                    >
                      {headline.sub}
                    </div>
                  )}
                </div>

                {/* Prices */}
                <div className="mt-5 grid grid-cols-2 gap-2 sm:mt-8 sm:gap-2.5">
                  <div className="min-w-0 rounded-xl bg-white/[0.04] px-2.5 py-2.5 ring-1 ring-white/10 backdrop-blur-sm sm:px-3.5 sm:py-3">
                    <div className="text-[9px] font-semibold uppercase tracking-wider text-amber-100/45 sm:text-[10px]">
                      Entry
                    </div>
                    <div className="mt-1 break-all font-mono text-[12px] font-bold text-amber-50 sm:text-[15px]">
                      ${formatPrice(trade.entryPrice)}
                    </div>
                  </div>
                  <div className="min-w-0 rounded-xl bg-white/[0.04] px-2.5 py-2.5 ring-1 ring-white/10 backdrop-blur-sm sm:px-3.5 sm:py-3">
                    <div className="text-[9px] font-semibold uppercase tracking-wider text-amber-100/45 sm:text-[10px]">
                      Close
                    </div>
                    <div className="mt-1 flex flex-wrap items-center gap-1 font-mono text-[12px] font-bold text-amber-50 sm:gap-1.5 sm:text-[15px]">
                      <span className="break-all">
                        {trade.closePrice != null ? `$${formatPrice(trade.closePrice)}` : "—"}
                      </span>
                      {priceDelta != null && priceDelta !== 0 && (
                        <span
                          className={cn(
                            "text-[10px] font-bold",
                            priceDelta > 0 ? "text-emerald-300" : "text-rose-300"
                          )}
                        >
                          {priceDelta > 0 ? "▲" : "▼"}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Brand footer */}
              <div
                className="relative mt-4 flex items-center justify-between gap-2 border-t border-amber-200/10 px-3.5 py-3 sm:mt-6 sm:gap-3 sm:px-5 sm:py-4"
                style={{
                  background:
                    "linear-gradient(90deg, oklch(0.28 0.05 75 / 0.55), oklch(0.2 0.03 70 / 0.2))",
                }}
              >
                <div className="flex min-w-0 items-center gap-2 sm:gap-2.5">
                  <div
                    className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg shadow-[0_8px_20px_-8px_rgba(245,197,66,0.7)] sm:h-10 sm:w-10 sm:rounded-xl"
                    style={{ background: "var(--gradient-emerald)" }}
                  >
                    <TrendingUp className="h-4 w-4 text-[#1a1610] sm:h-5 sm:w-5" />
                  </div>
                  <div className="min-w-0">
                    <div className="truncate text-[13px] font-black tracking-tight text-amber-50 sm:text-[15px]">
                      Evios<span className="text-amber-300"> Trader</span>
                    </div>
                    <div className="truncate text-[10px] font-medium text-amber-100/45 sm:block">
                      Trade smarter · Share proudly
                    </div>
                  </div>
                </div>
                <div className="shrink-0 text-right">
                  <div className="rounded-lg bg-amber-300/10 px-1.5 py-1 font-mono text-[9px] font-bold tracking-wider text-amber-200/80 ring-1 ring-amber-300/20 sm:px-2 sm:text-[10px]">
                    #{trade.id.slice(-6).toUpperCase()}
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="space-y-2.5 border-t border-border/50 px-3 py-3.5 sm:space-y-3 sm:px-4 sm:py-4">
            <div className="text-xs font-semibold text-muted-foreground">Select information</div>
            <div className="grid grid-cols-3 gap-1.5 sm:gap-2">
              {(
                [
                  { key: "pnl", label: "PNL" },
                  { key: "roi", label: "ROI" },
                  { key: "both", label: "PNL & ROI" },
                ] as const
              ).map((opt) => (
                <button
                  key={opt.key}
                  type="button"
                  onClick={() => setMode(opt.key)}
                  className={cn(
                    "rounded-xl border px-1.5 py-2 text-[11px] font-bold transition-all sm:px-2 sm:py-2.5 sm:text-xs",
                    mode === opt.key
                      ? "border-primary bg-primary text-primary-foreground shadow-[0_8px_20px_-10px_oklch(0.78_0.155_85/0.8)]"
                      : "border-border/70 bg-card text-muted-foreground hover:border-primary/40 hover:text-foreground"
                  )}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        <DialogFooter className="shrink-0 gap-2 border-t border-border/50 bg-muted/20 px-3 py-3 sm:flex-row sm:justify-between sm:space-x-0 sm:px-4 sm:py-3.5">
          <Button
            type="button"
            variant="outline"
            className="h-10 w-full rounded-xl sm:h-9 sm:w-auto"
            onClick={() => onOpenChange(false)}
          >
            Close
          </Button>
          <Button
            type="button"
            className="h-10 w-full rounded-xl bg-primary text-primary-foreground shadow-[0_10px_28px_-12px_oklch(0.78_0.155_85/0.85)] hover:opacity-95 sm:h-9 sm:w-auto"
            disabled={downloading}
            onClick={() => void download()}
          >
            {downloading ? (
              <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
            ) : (
              <Download className="mr-1.5 h-4 w-4" />
            )}
            Download PNG
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** Compact View button for tables */
export function TradeViewButton({
  onClick,
  className,
}: {
  onClick: () => void;
  className?: string;
}) {
  return (
    <Button
      type="button"
      size="sm"
      variant="outline"
      className={cn(
        "h-7 gap-1 rounded-lg border-primary/30 px-2.5 text-xs font-semibold text-primary hover:bg-primary/10 hover:text-primary",
        className
      )}
      onClick={onClick}
    >
      <Eye className="h-3.5 w-3.5" />
      View
    </Button>
  );
}
