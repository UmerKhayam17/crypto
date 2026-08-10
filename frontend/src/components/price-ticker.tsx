import { useStore } from "@/context/store";
import { formatPrice } from "@/services/market-data";

export function PriceTicker() {
  const { assets } = useStore();
  const loop = [...assets, ...assets];
  return (
    <div className="overflow-hidden border-y border-border/60 bg-card/60 py-2">
      <div className="flex animate-[ticker_60s_linear_infinite] gap-8 whitespace-nowrap">
        {loop.map((a, i) => (
          <div key={i} className="flex items-center gap-2 text-sm">
            <span className="font-medium">{a.symbol}</span>
            <span className="text-muted-foreground">{formatPrice(a.price)}</span>
            <span className={a.change24h >= 0 ? "text-primary" : "text-destructive"}>
              {a.change24h >= 0 ? "+" : ""}{a.change24h.toFixed(2)}%
            </span>
          </div>
        ))}
      </div>
      <style>{`@keyframes ticker { from { transform: translateX(0); } to { transform: translateX(-50%); } }`}</style>
    </div>
  );
}