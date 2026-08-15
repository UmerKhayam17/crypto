import { useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import {
  ArrowDown,
  ArrowUp,
  CheckCircle2,
  Download,
  Eye,
  Loader2,
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

const SHARE_FONT = "Arial, Helvetica, sans-serif";
const SHARE_MONO = "Consolas, 'Courier New', monospace";

type ShareMode = "pnl" | "roi" | "both";

type TradeResultViewProps = {
  trade: BinaryTrade;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userName?: string;
  userInitials?: string;
};

/** Strip oklch() so html2canvas never parses theme colors. */
function replaceOklch(css: string, fallback = "#888888"): string {
  let out = css;
  let guard = 0;
  while (/oklch\(/i.test(out) && guard++ < 200) {
    out = out.replace(/oklch\((?:[^()]|\([^()]*\))*\)/gi, fallback);
  }
  return out;
}

/** Prepare cloned card: no theme CSS, no transforms, crisp system fonts. */
function prepareCloneForCapture(doc: Document, card: HTMLElement) {
  doc.querySelectorAll('style, link[rel="stylesheet"]').forEach((el) => el.remove());

  let el: HTMLElement | null = card;
  while (el) {
    el.style.transform = "none";
    el.style.translate = "none";
    el.style.scale = "none";
    el.style.rotate = "none";
    el.style.filter = "none";
    el.style.backdropFilter = "none";
    el.style.setProperty("-webkit-backdrop-filter", "none");
    el.style.boxShadow = "none";
    el.style.opacity = "1";
    el = el.parentElement;
  }

  card.style.fontFamily = SHARE_FONT;
  card.style.setProperty("-webkit-font-smoothing", "antialiased");
  card.style.setProperty("-moz-osx-font-smoothing", "grayscale");
  card.style.setProperty("text-rendering", "geometricPrecision");
  card.style.letterSpacing = "normal";
  card.style.boxShadow = "none";
  card.style.filter = "none";
  card.style.transform = "none";

  card.querySelectorAll("*").forEach((node) => {
    if (node instanceof HTMLElement) {
      const isMono = (node.getAttribute("style") || "").includes("Consolas");
      node.style.fontFamily = isMono ? SHARE_MONO : SHARE_FONT;
      node.style.setProperty("-webkit-font-smoothing", "antialiased");
      node.style.transform = "none";
      node.style.filter = "none";
      node.style.boxShadow = "none";
      node.style.backdropFilter = "none";
      node.style.setProperty("-webkit-backdrop-filter", "none");
      node.style.textShadow = "none";
      const inline = node.getAttribute("style");
      if (inline && /oklch\(/i.test(inline)) {
        node.setAttribute("style", replaceOklch(inline));
      }
    }
    if (node instanceof SVGElement) {
      const svgStyle = node.getAttribute("style");
      if (svgStyle && /oklch\(/i.test(svgStyle)) {
        node.setAttribute("style", replaceOklch(svgStyle, "currentColor"));
      }
    }
  });
}

function roiPercent(trade: BinaryTrade) {
  if (!(trade.stake > 0)) return 0;
  return ((trade.pnl ?? 0) / trade.stake) * 100;
}

function formatSignedMoney(n: number) {
  const abs = Math.abs(n).toFixed(2);
  if (n > 0) return `+$${abs}`;
  if (n < 0) return `-$${abs}`;
  return `$${abs}`;
}

function formatSignedPct(n: number) {
  const abs = Math.abs(n).toFixed(2);
  if (n > 0) return `+${abs}%`;
  if (n < 0) return `-${abs}%`;
  return `${abs}%`;
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
  const draw = trade.status === "draw";
  const pnl = trade.pnl ?? 0;
  const roi = roiPercent(trade);
  const positive = pnl > 0 || (pnl === 0 && won);
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

  // Solid hex only — html2canvas-safe
  const accent = positive ? "#22c55e" : draw ? "#a8a29e" : "#ef4444";
  const accentSoft = positive ? "#14532d" : draw ? "#292524" : "#7f1d1d";
  const statusFg = "#ffffff";
  const statusBg = positive ? "#16a34a" : draw ? "#57534e" : "#dc2626";

  const headline = useMemo(() => {
    if (mode === "roi") {
      return {
        main: formatSignedPct(roi),
        sub: null as string | null,
        label: "ROI",
      };
    }
    if (mode === "pnl") {
      return {
        main: formatSignedMoney(pnl),
        sub: null as string | null,
        label: "PNL (USDT)",
      };
    }
    return {
      main: formatSignedMoney(pnl),
      sub: `${formatSignedPct(roi)} ROI`,
      label: "PNL (USDT)",
    };
  }, [mode, pnl, roi]);

  const download = async () => {
    if (!cardRef.current) return;
    setDownloading(true);
    const host = document.createElement("div");
    try {
      const html2canvas = (await import("html2canvas")).default;
      const source = cardRef.current;

      // Capture off-dialog so modal transforms don't ghost the PNG
      host.setAttribute(
        "style",
        "position:fixed;left:0;top:0;z-index:-1;opacity:0;pointer-events:none;"
      );
      const clone = source.cloneNode(true) as HTMLElement;
      clone.style.width = "360px";
      clone.style.maxWidth = "360px";
      clone.style.transform = "none";
      clone.style.margin = "0";
      host.appendChild(clone);
      document.body.appendChild(host);

      // Allow layout before capture
      await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));

      const canvas = await html2canvas(clone, {
        backgroundColor: "#111827",
        scale: 2,
        useCORS: true,
        allowTaint: false,
        logging: false,
        scrollX: 0,
        scrollY: 0,
        width: 360,
        height: clone.offsetHeight,
        windowWidth: 360,
        windowHeight: clone.offsetHeight,
        foreignObjectRendering: false,
        onclone: (doc, el) => prepareCloneForCapture(doc, el as HTMLElement),
      });

      const link = document.createElement("a");
      link.download = `evios-trade-${trade.symbol.replace("/", "")}-${trade.id.slice(-6)}.png`;
      link.href = canvas.toDataURL("image/png");
      link.click();
      toast.success("Trade card downloaded");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not download image");
    } finally {
      host.remove();
      setDownloading(false);
    }
  };

  const dateStr = new Date(when).toLocaleString([], {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className={cn(
          "flex w-[min(100vw-1rem,420px)] max-w-[420px] flex-col gap-0 overflow-hidden border-border/50 bg-background p-0",
          "max-h-[min(90dvh,920px)]",
          "left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2",
          "rounded-xl sm:rounded-2xl",
          "pb-[max(0.25rem,env(safe-area-inset-bottom))]"
        )}
      >
        <DialogHeader className="shrink-0 border-b border-border/50 px-3 py-2.5 sm:px-4 sm:py-3.5">
          <DialogTitle className="flex items-center gap-2 pr-8 text-sm font-bold tracking-tight sm:text-base">
            <span className="grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-primary/15 text-primary">
              <Eye className="h-3.5 w-3.5" />
            </span>
            Trade result card
          </DialogTitle>
        </DialogHeader>

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain [-webkit-overflow-scrolling:touch]">
          <div className="p-3 sm:p-5" style={{ background: "#e7e5e4" }}>
            <div
              ref={cardRef}
              className="trade-share-card mx-auto overflow-hidden"
              style={{
                width: 360,
                maxWidth: "100%",
                boxSizing: "border-box",
                background: "#111827",
                color: "#f9fafb",
                borderRadius: 16,
                fontFamily: SHARE_FONT,
                WebkitFontSmoothing: "antialiased",
                lineHeight: 1.35,
              }}
            >
              {/* Header */}
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: 12,
                  padding: "18px 18px 14px",
                  borderBottom: "1px solid #1f2937",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
                  <div
                    style={{
                      width: 42,
                      height: 42,
                      borderRadius: 10,
                      display: "grid",
                      placeItems: "center",
                      flexShrink: 0,
                      fontWeight: 800,
                      fontSize: 14,
                      fontFamily: SHARE_FONT,
                      color: "#111827",
                      background: "#fbbf24",
                    }}
                  >
                    {initials}
                  </div>
                  <div style={{ minWidth: 0 }}>
                    <div
                      style={{
                        fontSize: 15,
                        fontWeight: 700,
                        fontFamily: SHARE_FONT,
                        color: "#f9fafb",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                        maxWidth: 170,
                      }}
                    >
                      {userName || "Evios Trader"}
                    </div>
                    <div
                      style={{
                        marginTop: 3,
                        fontSize: 12,
                        fontFamily: SHARE_FONT,
                        color: "#9ca3af",
                      }}
                    >
                      {dateStr}
                    </div>
                  </div>
                </div>
                <div
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 5,
                    flexShrink: 0,
                    borderRadius: 8,
                    padding: "7px 11px",
                    fontSize: 12,
                    fontWeight: 800,
                    fontFamily: SHARE_FONT,
                    textTransform: "uppercase",
                    background: statusBg,
                    color: statusFg,
                  }}
                >
                  {won ? (
                    <CheckCircle2 style={{ width: 14, height: 14, color: statusFg }} />
                  ) : draw ? null : (
                    <XCircle style={{ width: 14, height: 14, color: statusFg }} />
                  )}
                  {won ? "Won" : draw ? "Draw" : "Lost"}
                </div>
              </div>

              {/* Body */}
              <div style={{ padding: "16px 18px 8px" }}>
                <div
                  style={{
                    fontSize: 11,
                    fontWeight: 700,
                    fontFamily: SHARE_FONT,
                    textTransform: "uppercase",
                    color: "#fbbf24",
                  }}
                >
                  Futures result
                </div>
                <div
                  style={{
                    marginTop: 6,
                    fontSize: 26,
                    fontWeight: 800,
                    fontFamily: SHARE_FONT,
                    color: "#ffffff",
                  }}
                >
                  {trade.symbol}
                </div>

                {/* Meta chips */}
                <div style={{ marginTop: 12, display: "flex", flexWrap: "wrap", gap: 8 }}>
                  <span
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 4,
                      borderRadius: 8,
                      padding: "6px 10px",
                      fontSize: 12,
                      fontWeight: 800,
                      fontFamily: SHARE_FONT,
                      textTransform: "uppercase",
                      background: trade.direction === "up" ? "#14532d" : "#7f1d1d",
                      color: trade.direction === "up" ? "#4ade80" : "#f87171",
                    }}
                  >
                    {trade.direction === "up" ? (
                      <ArrowUp style={{ width: 13, height: 13 }} />
                    ) : (
                      <ArrowDown style={{ width: 13, height: 13 }} />
                    )}
                    {trade.direction}
                  </span>
                  <span
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 5,
                      borderRadius: 8,
                      padding: "6px 10px",
                      fontSize: 12,
                      fontWeight: 700,
                      fontFamily: SHARE_FONT,
                      background: "#1f2937",
                      color: "#e5e7eb",
                    }}
                  >
                    <Timer style={{ width: 13, height: 13 }} />
                    {trade.durationSec}s
                  </span>
                  <span
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      borderRadius: 8,
                      padding: "6px 10px",
                      fontSize: 12,
                      fontWeight: 700,
                      fontFamily: SHARE_MONO,
                      background: "#1f2937",
                      color: "#e5e7eb",
                    }}
                  >
                    Stake ${trade.stake.toFixed(2)}
                  </span>
                </div>

                {/* PNL block */}
                <div
                  style={{
                    marginTop: 18,
                    borderRadius: 12,
                    padding: "14px 14px",
                    background: "#0b1220",
                    border: `1px solid ${accentSoft}`,
                  }}
                >
                  <div
                    style={{
                      fontSize: 11,
                      fontWeight: 700,
                      fontFamily: SHARE_FONT,
                      textTransform: "uppercase",
                      color: "#9ca3af",
                    }}
                  >
                    {headline.label}
                  </div>
                  <div
                    style={{
                      marginTop: 6,
                      fontSize: 36,
                      fontWeight: 800,
                      fontFamily: SHARE_FONT,
                      lineHeight: 1.15,
                      color: accent,
                    }}
                  >
                    {headline.main}
                  </div>
                  {headline.sub && (
                    <div
                      style={{
                        marginTop: 8,
                        fontSize: 14,
                        fontWeight: 700,
                        fontFamily: SHARE_MONO,
                        color: accent,
                      }}
                    >
                      {headline.sub}
                    </div>
                  )}
                </div>

                {/* Entry / Close */}
                <div
                  style={{
                    marginTop: 14,
                    display: "grid",
                    gridTemplateColumns: "1fr 1fr",
                    gap: 10,
                  }}
                >
                  <div
                    style={{
                      borderRadius: 12,
                      padding: "12px",
                      background: "#1f2937",
                    }}
                  >
                    <div
                      style={{
                        fontSize: 11,
                        fontWeight: 700,
                        fontFamily: SHARE_FONT,
                        textTransform: "uppercase",
                        color: "#9ca3af",
                      }}
                    >
                      Entry
                    </div>
                    <div
                      style={{
                        marginTop: 6,
                        fontSize: 15,
                        fontWeight: 700,
                        fontFamily: SHARE_MONO,
                        color: "#f9fafb",
                        wordBreak: "break-all",
                      }}
                    >
                      ${formatPrice(trade.entryPrice)}
                    </div>
                  </div>
                  <div
                    style={{
                      borderRadius: 12,
                      padding: "12px",
                      background: "#1f2937",
                    }}
                  >
                    <div
                      style={{
                        fontSize: 11,
                        fontWeight: 700,
                        fontFamily: SHARE_FONT,
                        textTransform: "uppercase",
                        color: "#9ca3af",
                      }}
                    >
                      Close
                    </div>
                    <div
                      style={{
                        marginTop: 6,
                        fontSize: 15,
                        fontWeight: 700,
                        fontFamily: SHARE_MONO,
                        color: "#f9fafb",
                        wordBreak: "break-all",
                      }}
                    >
                      {trade.closePrice != null ? `$${formatPrice(trade.closePrice)}` : "—"}
                      {priceDelta != null && priceDelta !== 0 ? (
                        <span
                          style={{
                            marginLeft: 6,
                            fontSize: 12,
                            fontFamily: SHARE_FONT,
                            color: priceDelta > 0 ? "#22c55e" : "#ef4444",
                          }}
                        >
                          {priceDelta > 0 ? "▲" : "▼"}
                        </span>
                      ) : null}
                    </div>
                  </div>
                </div>
              </div>

              {/* Footer */}
              <div
                style={{
                  marginTop: 12,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: 10,
                  padding: "14px 18px",
                  borderTop: "1px solid #1f2937",
                  background: "#0b1220",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
                  <div
                    style={{
                      width: 34,
                      height: 34,
                      borderRadius: 8,
                      display: "grid",
                      placeItems: "center",
                      flexShrink: 0,
                      background: "#fbbf24",
                    }}
                  >
                    <TrendingUp style={{ width: 18, height: 18, color: "#111827" }} />
                  </div>
                  <div style={{ minWidth: 0 }}>
                    <div
                      style={{
                        fontSize: 14,
                        fontWeight: 800,
                        fontFamily: SHARE_FONT,
                        color: "#f9fafb",
                      }}
                    >
                      Evios <span style={{ color: "#fbbf24" }}>Trader</span>
                    </div>
                    <div
                      style={{
                        marginTop: 2,
                        fontSize: 11,
                        fontFamily: SHARE_FONT,
                        color: "#9ca3af",
                      }}
                    >
                      Trade smarter
                    </div>
                  </div>
                </div>
                <div
                  style={{
                    flexShrink: 0,
                    borderRadius: 8,
                    padding: "6px 9px",
                    fontSize: 11,
                    fontWeight: 700,
                    fontFamily: SHARE_MONO,
                    background: "#1f2937",
                    color: "#fbbf24",
                  }}
                >
                  #{trade.id.slice(-6).toUpperCase()}
                </div>
              </div>
            </div>
          </div>

          <div className="space-y-2 border-t border-border/50 px-3 py-3 sm:space-y-3 sm:px-4 sm:py-4">
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
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-border/70 bg-card text-muted-foreground hover:border-primary/40 hover:text-foreground"
                  )}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        <DialogFooter className="shrink-0 gap-2 border-t border-border/50 bg-muted/20 px-3 py-2.5 sm:flex-row sm:justify-between sm:space-x-0 sm:px-4 sm:py-3.5">
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
            className="h-10 w-full rounded-xl bg-primary text-primary-foreground hover:opacity-95 sm:h-9 sm:w-auto"
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
