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

function stripOklchInClone(doc: Document) {
  doc.querySelectorAll("style").forEach((el) => {
    if (el.textContent?.includes("oklch")) {
      el.textContent = el.textContent.replace(/oklch\((?:[^()]|\([^)]*\))*\)/gi, "#888888");
    }
  });
  doc.querySelectorAll("[style]").forEach((el) => {
    const style = el.getAttribute("style");
    if (style?.includes("oklch")) {
      el.setAttribute("style", style.replace(/oklch\((?:[^()]|\([^)]*\))*\)/gi, "#888888"));
    }
  });
}

/** Flatten clone styles so html2canvas doesn't break on blur/alpha/radius. */
function prepareCloneForCapture(doc: Document) {
  stripOklchInClone(doc);
  const card = doc.querySelector(".trade-share-card") as HTMLElement | null;
  if (!card) return;
  card.style.background = "#1a1610";
  card.style.color = "#fff7ed";
  card.style.overflow = "hidden";
  card.style.borderRadius = "20px";
  card.querySelectorAll("*").forEach((node) => {
    if (!(node instanceof HTMLElement)) return;
    node.style.backdropFilter = "none";
    node.style.webkitBackdropFilter = "none";
    node.style.maskImage = "none";
    node.style.webkitMaskImage = "none";
    node.style.filter = "none";
    // Solidify semi-transparent fills that cause checkerboard artifacts
    const bg = node.style.backgroundColor || "";
    if (bg.includes("rgba") || node.style.background.includes("rgba")) {
      // leave explicit solid backgrounds we set; skip complex gradients
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

  // Solid hex only — html2canvas-safe (no oklch / no translucent rgba boxes)
  const accent = positive ? "#34d399" : draw ? "#d6d3d1" : "#fb7185";
  const accentBg = positive ? "#1e3d34" : draw ? "#2a2622" : "#3f1d24";
  const chipBg = "#2a241c";
  const panelBg = "#241e18";

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
        label: "PNL · USDT",
      };
    }
    return {
      main: formatSignedMoney(pnl),
      sub: `${formatSignedPct(roi)} ROI`,
      label: "PNL · USDT",
    };
  }, [mode, pnl, roi]);

  const download = async () => {
    if (!cardRef.current) return;
    setDownloading(true);
    try {
      const html2canvas = (await import("html2canvas")).default;
      const node = cardRef.current;
      const canvas = await html2canvas(node, {
        backgroundColor: "#1a1610",
        scale: 2,
        useCORS: true,
        allowTaint: false,
        logging: false,
        scrollX: 0,
        scrollY: 0,
        x: 0,
        y: 0,
        width: node.offsetWidth,
        height: node.offsetHeight,
        windowWidth: node.offsetWidth,
        windowHeight: node.offsetHeight,
        foreignObjectRendering: false,
        onclone: (doc) => prepareCloneForCapture(doc),
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
          <div className="p-2.5 sm:p-5" style={{ background: "#f3ead8" }}>
            {/* Fixed export width avoids mobile crop / blur artifacts */}
            <div
              ref={cardRef}
              className="trade-share-card mx-auto overflow-hidden text-white"
              style={{
                width: 360,
                maxWidth: "100%",
                background: "#1a1610",
                color: "#fff7ed",
                borderRadius: 20,
                boxSizing: "border-box",
              }}
            >
              <div style={{ position: "relative", padding: "20px 18px 12px" }}>
                <div
                  style={{
                    display: "flex",
                    alignItems: "flex-start",
                    justifyContent: "space-between",
                    gap: 12,
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
                    <div
                      style={{
                        width: 40,
                        height: 40,
                        borderRadius: 999,
                        display: "grid",
                        placeItems: "center",
                        flexShrink: 0,
                        fontWeight: 800,
                        fontSize: 13,
                        color: "#1a1610",
                        background: "linear-gradient(135deg, #f0d060, #d4a84b)",
                      }}
                    >
                      {initials}
                    </div>
                    <div style={{ minWidth: 0 }}>
                      <div
                        style={{
                          fontSize: 14,
                          fontWeight: 700,
                          lineHeight: 1.35,
                          color: "#fff7ed",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                          maxWidth: 180,
                        }}
                      >
                        {userName || "Evios Trader"}
                      </div>
                      <div style={{ marginTop: 2, fontSize: 11, lineHeight: 1.3, color: "#c4b5a0" }}>
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
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 4,
                      flexShrink: 0,
                      borderRadius: 999,
                      padding: "6px 10px",
                      fontSize: 10,
                      fontWeight: 800,
                      letterSpacing: "0.06em",
                      textTransform: "uppercase",
                      background: accentBg,
                      color: accent,
                    }}
                  >
                    {won ? (
                      <CheckCircle2 style={{ width: 12, height: 12 }} />
                    ) : draw ? null : (
                      <XCircle style={{ width: 12, height: 12 }} />
                    )}
                    {won ? "Won" : draw ? "Draw" : "Lost"}
                  </div>
                </div>

                <div style={{ marginTop: 22 }}>
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 6,
                      fontSize: 10,
                      fontWeight: 700,
                      letterSpacing: "0.14em",
                      textTransform: "uppercase",
                      color: "#a8946a",
                    }}
                  >
                    <Sparkles style={{ width: 12, height: 12, color: "#e8c56a" }} />
                    Futures result
                  </div>
                  <div
                    style={{
                      marginTop: 8,
                      fontSize: 28,
                      fontWeight: 900,
                      lineHeight: 1.15,
                      letterSpacing: "-0.02em",
                      color: "#ffffff",
                      wordBreak: "break-word",
                    }}
                  >
                    {trade.symbol}
                  </div>
                  <div style={{ marginTop: 10, display: "flex", flexWrap: "wrap", gap: 6 }}>
                    <span
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: 4,
                        borderRadius: 8,
                        padding: "5px 8px",
                        fontSize: 11,
                        fontWeight: 800,
                        textTransform: "uppercase",
                        background: trade.direction === "up" ? "#1e3d34" : "#3f1d24",
                        color: trade.direction === "up" ? "#34d399" : "#fb7185",
                      }}
                    >
                      {trade.direction === "up" ? (
                        <ArrowUp style={{ width: 12, height: 12 }} />
                      ) : (
                        <ArrowDown style={{ width: 12, height: 12 }} />
                      )}
                      {trade.direction}
                    </span>
                    <span
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: 4,
                        borderRadius: 8,
                        padding: "5px 8px",
                        fontSize: 11,
                        fontWeight: 600,
                        background: chipBg,
                        color: "#d6c4a8",
                      }}
                    >
                      <Timer style={{ width: 12, height: 12 }} />
                      {trade.durationSec}s
                    </span>
                    <span
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        borderRadius: 8,
                        padding: "5px 8px",
                        fontSize: 11,
                        fontWeight: 600,
                        fontFamily: "ui-monospace, monospace",
                        background: chipBg,
                        color: "#d6c4a8",
                      }}
                    >
                      ${trade.stake.toFixed(2)}
                    </span>
                  </div>
                </div>

                <div style={{ marginTop: 24 }}>
                  <div
                    style={{
                      fontSize: 10,
                      fontWeight: 700,
                      letterSpacing: "0.14em",
                      textTransform: "uppercase",
                      color: "#a8946a",
                    }}
                  >
                    {headline.label}
                  </div>
                  <div
                    style={{
                      marginTop: 6,
                      fontSize: 40,
                      fontWeight: 900,
                      lineHeight: 1.1,
                      letterSpacing: "-0.03em",
                      color: accent,
                    }}
                  >
                    {headline.main}
                  </div>
                  {headline.sub && (
                    <div
                      style={{
                        marginTop: 10,
                        display: "inline-block",
                        borderRadius: 999,
                        padding: "6px 10px",
                        fontSize: 13,
                        fontWeight: 700,
                        fontFamily: "ui-monospace, monospace",
                        lineHeight: 1.2,
                        background: accentBg,
                        color: accent,
                      }}
                    >
                      {headline.sub}
                    </div>
                  )}
                </div>

                <div
                  style={{
                    marginTop: 22,
                    display: "grid",
                    gridTemplateColumns: "1fr 1fr",
                    gap: 10,
                  }}
                >
                  <div
                    style={{
                      borderRadius: 12,
                      padding: "12px 12px",
                      background: panelBg,
                    }}
                  >
                    <div
                      style={{
                        fontSize: 10,
                        fontWeight: 600,
                        letterSpacing: "0.08em",
                        textTransform: "uppercase",
                        color: "#a8946a",
                      }}
                    >
                      Entry
                    </div>
                    <div
                      style={{
                        marginTop: 6,
                        fontSize: 14,
                        fontWeight: 700,
                        fontFamily: "ui-monospace, monospace",
                        lineHeight: 1.3,
                        color: "#fff7ed",
                        wordBreak: "break-all",
                      }}
                    >
                      ${formatPrice(trade.entryPrice)}
                    </div>
                  </div>
                  <div
                    style={{
                      borderRadius: 12,
                      padding: "12px 12px",
                      background: panelBg,
                    }}
                  >
                    <div
                      style={{
                        fontSize: 10,
                        fontWeight: 600,
                        letterSpacing: "0.08em",
                        textTransform: "uppercase",
                        color: "#a8946a",
                      }}
                    >
                      Close
                    </div>
                    <div
                      style={{
                        marginTop: 6,
                        display: "flex",
                        flexWrap: "wrap",
                        alignItems: "center",
                        gap: 6,
                        fontSize: 14,
                        fontWeight: 700,
                        fontFamily: "ui-monospace, monospace",
                        lineHeight: 1.3,
                        color: "#fff7ed",
                      }}
                    >
                      <span style={{ wordBreak: "break-all" }}>
                        {trade.closePrice != null ? `$${formatPrice(trade.closePrice)}` : "—"}
                      </span>
                      {priceDelta != null && priceDelta !== 0 && (
                        <span
                          style={{
                            fontSize: 11,
                            fontWeight: 700,
                            color: priceDelta > 0 ? "#34d399" : "#fb7185",
                          }}
                        >
                          {priceDelta > 0 ? "▲" : "▼"}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              <div
                style={{
                  marginTop: 8,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: 10,
                  padding: "14px 18px 16px",
                  borderTop: "1px solid #3a3228",
                  background: "#15120e",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
                  <div
                    style={{
                      width: 36,
                      height: 36,
                      borderRadius: 10,
                      display: "grid",
                      placeItems: "center",
                      flexShrink: 0,
                      background: "linear-gradient(135deg, #f0d060, #d4a84b)",
                    }}
                  >
                    <TrendingUp style={{ width: 18, height: 18, color: "#1a1610" }} />
                  </div>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: 14, fontWeight: 900, lineHeight: 1.25, color: "#fff7ed" }}>
                      Evios<span style={{ color: "#f0d060" }}> Trader</span>
                    </div>
                    <div style={{ marginTop: 2, fontSize: 10, lineHeight: 1.3, color: "#a8946a" }}>
                      Trade smarter · Share proudly
                    </div>
                  </div>
                </div>
                <div
                  style={{
                    flexShrink: 0,
                    borderRadius: 8,
                    padding: "6px 8px",
                    fontSize: 10,
                    fontWeight: 700,
                    fontFamily: "ui-monospace, monospace",
                    letterSpacing: "0.06em",
                    background: "#2a241c",
                    color: "#e8c56a",
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
