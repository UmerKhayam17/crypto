import { Link } from "react-router-dom";
import { useState, useMemo } from "react";
import { Search } from "lucide-react";
import { SiteHeader } from "@/components/layout/site-header";
import { SiteFooter } from "@/components/layout/site-footer";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useStore } from "@/context/store";
import { formatPrice, formatBig } from "@/services/market-data";

const TABS = ["all", "crypto", "metals", "forex", "stocks"] as const;

export default function MarketsPage() {
  const { assets } = useStore();
  const [q, setQ] = useState("");
  const [tab, setTab] = useState<(typeof TABS)[number]>("all");

  const filtered = useMemo(() => {
    return assets.filter((a) => {
      const matchTab = tab === "all" || a.category === tab;
      const matchQ = !q || a.symbol.toLowerCase().includes(q.toLowerCase()) || a.name.toLowerCase().includes(q.toLowerCase());
      return matchTab && matchQ;
    });
  }, [assets, q, tab]);

  return (
    <div className="min-h-screen flex flex-col bg-background text-foreground pb-20 md:pb-0">
      <SiteHeader />
      <main className="mx-auto w-full max-w-7xl flex-1 px-3 py-4 sm:px-6 sm:py-10 min-w-0">
        <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Markets</h1>
            <p className="text-sm text-muted-foreground">Live prices, updated every second.</p>
          </div>
          <div className="relative w-full md:w-80">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input placeholder="Search asset…" value={q} onChange={(e) => setQ(e.target.value)} className="pl-9" />
          </div>
        </div>

        <div className="mt-6 flex gap-2">
          {TABS.map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`rounded-full border px-4 py-1.5 text-sm capitalize transition-colors ${
                tab === t ? "border-primary bg-primary/15 text-primary" : "border-border text-muted-foreground hover:text-foreground"
              }`}
            >
              {t}
            </button>
          ))}
        </div>

        <div className="mt-6 overflow-hidden rounded-xl border border-border/60 bg-card/60">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/30 text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="px-4 py-3 text-left">Asset</th>
                  <th className="px-4 py-3 text-right">Price</th>
                  <th className="px-4 py-3 text-right">24h Change</th>
                  <th className="px-4 py-3 text-right hidden md:table-cell">24h Volume</th>
                  <th className="px-4 py-3 text-right hidden lg:table-cell">Market Cap</th>
                  <th className="px-4 py-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {filtered.map((a) => (
                  <tr key={a.symbol} className="transition-colors hover:bg-muted/20">
                    <td className="px-4 py-3">
                      <div className="font-medium">{a.symbol}</div>
                      <div className="text-xs text-muted-foreground">{a.name}</div>
                    </td>
                    <td className="px-4 py-3 text-right font-mono">${formatPrice(a.price)}</td>
                    <td className={`px-4 py-3 text-right font-medium ${a.change24h >= 0 ? "text-primary" : "text-destructive"}`}>
                      {a.change24h >= 0 ? "+" : ""}{a.change24h.toFixed(2)}%
                    </td>
                    <td className="px-4 py-3 text-right hidden md:table-cell text-muted-foreground">
                      {a.volume ? formatBig(a.volume) : "—"}
                    </td>
                    <td className="px-4 py-3 text-right hidden lg:table-cell text-muted-foreground">
                      {a.marketCap ? formatBig(a.marketCap) : "—"}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Button asChild size="sm" variant="outline">
                        <Link to={`/trade?symbol=${encodeURIComponent(a.symbol)}`}>Trade</Link>
                      </Button>
                    </td>
                  </tr>
                ))}
                {filtered.length === 0 && (
                  <tr><td colSpan={6} className="px-4 py-10 text-center text-muted-foreground">No results.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}