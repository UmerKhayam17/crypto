import { Link } from "react-router-dom";
import { ArrowRight, ShieldCheck, Zap, Globe2, TrendingUp, BarChart3, Wallet, Gift, Crown } from "lucide-react";
import { SiteHeader } from "@/components/layout/site-header";
import { SiteFooter } from "@/components/layout/site-footer";
import { PriceTicker } from "@/components/price-ticker";
import { Button } from "@/components/ui/button";
import { useStore } from "@/context/store";
import { formatPrice } from "@/services/market-data";

const PROMO_REWARDS = [
  { level: "VIP 1", deposit: "$1,000", reward: "$200" },
  { level: "VIP 2", deposit: "$3,000", reward: "$500" },
  { level: "VIP 3", deposit: "$5,000", reward: "$1,000" },
  { level: "VIP 4", deposit: "$10,000", reward: "$3,000" },
  { level: "VIP 5", deposit: "$20,000", reward: "$5,000" },
  { level: "SVIP 6", deposit: "$50,000", reward: "$10,000" },
];

export default function IndexPage() {
  const { assets } = useStore();
  const top = assets.slice(0, 6);
  return (
    <div className="min-h-screen flex flex-col bg-background text-foreground pb-20 md:pb-0">
      <SiteHeader />
      <PriceTicker />

      {/* HERO */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 -z-10" style={{ background: "var(--gradient-hero)" }} />
        <div className="absolute inset-0 -z-10 opacity-30" style={{
          backgroundImage: "radial-gradient(circle at 20% 30%, oklch(0.72 0.17 158 / 0.25), transparent 40%), radial-gradient(circle at 80% 60%, oklch(0.50 0.18 240 / 0.3), transparent 50%)"
        }} />
        <div className="mx-auto grid max-w-7xl gap-12 px-4 py-20 sm:px-6 lg:grid-cols-2 lg:py-28">
          <div className="flex flex-col justify-center">
            <div className="inline-flex w-fit items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
              <span className="h-2 w-2 rounded-full bg-primary animate-pulse" />
              Markets are live · 2.4M traders worldwide
            </div>
            <h1 className="mt-6 text-4xl font-bold tracking-tight sm:text-6xl">
              Trade smarter on a <span className="bg-clip-text text-transparent" style={{ backgroundImage: "var(--gradient-emerald)" }}>premium</span> platform.
            </h1>
            <p className="mt-6 max-w-xl text-lg text-muted-foreground">
              Buy and sell 500+ crypto pairs, major forex and global stocks with institutional-grade execution. Designed for serious traders.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Button asChild size="lg" className="bg-primary text-primary-foreground hover:opacity-90" style={{ boxShadow: "var(--shadow-glow)" }}>
                <Link to="/register">Start trading <ArrowRight className="ml-1 h-4 w-4" /></Link>
              </Button>
              <Button asChild size="lg" variant="outline">
                <Link to="/markets">View markets</Link>
              </Button>
            </div>
            <div className="mt-10 grid grid-cols-3 gap-6 max-w-md">
              <Stat label="24h volume" value="$28.4B" />
              <Stat label="Assets" value="500+" />
              <Stat label="Uptime" value="99.99%" />
            </div>
          </div>

          {/* Hero card */}
          <div className="relative">
            <div className="rounded-2xl border border-border/60 bg-card/80 p-6 backdrop-blur-xl" style={{ boxShadow: "var(--shadow-elegant)" }}>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-muted-foreground">Top movers</p>
                  <h3 className="text-lg font-semibold">Live market preview</h3>
                </div>
                <BarChart3 className="h-5 w-5 text-primary" />
              </div>
              <div className="mt-4 divide-y divide-border/60">
                {top.map((a) => (
                  <div key={a.symbol} className="flex items-center justify-between py-3">
                    <div>
                      <div className="text-sm font-medium">{a.symbol}</div>
                      <div className="text-xs text-muted-foreground">{a.name}</div>
                    </div>
                    <div className="text-right">
                      <div className="text-sm font-mono">${formatPrice(a.price)}</div>
                      <div className={`text-xs ${a.change24h >= 0 ? "text-primary" : "text-destructive"}`}>
                        {a.change24h >= 0 ? "▲" : "▼"} {Math.abs(a.change24h).toFixed(2)}%
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              <Button asChild className="mt-4 w-full bg-primary text-primary-foreground hover:opacity-90">
                <Link to="/trade">Open trading desk</Link>
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* FEATURES */}
      <section className="mx-auto max-w-7xl px-4 py-20 sm:px-6">
        <div className="text-center">
          <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">Why traders choose Evios Trader</h2>
          <p className="mt-3 text-muted-foreground">Everything you need to trade with confidence.</p>
        </div>
        <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {[
            { icon: Zap, title: "Lightning execution", desc: "Sub-50ms matching engine handles 1.4M orders per second." },
            { icon: ShieldCheck, title: "Bank-grade security", desc: "Cold storage, 2FA, withdrawal whitelists and proof-of-reserves." },
            { icon: Globe2, title: "Global markets", desc: "Crypto, forex and stocks across 80+ countries, 24/7." },
            { icon: TrendingUp, title: "Advanced charting", desc: "Pro indicators, drawing tools and customizable workspaces." },
            { icon: Wallet, title: "Earn on idle assets", desc: "Stake or lend supported assets and earn up to 12% APY." },
            { icon: BarChart3, title: "Deep liquidity", desc: "Aggregated order books from top-tier liquidity providers." },
          ].map((f) => (
            <div key={f.title} className="rounded-xl border border-border/60 bg-card/60 p-6 transition-all hover:border-primary/50 hover:shadow-lg">
              <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-primary/15 text-primary">
                <f.icon className="h-5 w-5" />
              </div>
              <h3 className="mt-4 font-semibold">{f.title}</h3>
              <p className="mt-2 text-sm text-muted-foreground">{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Rewards promo */}
      <section className="mx-auto max-w-7xl px-4 pb-20 sm:px-6">
        <div
          className="overflow-hidden rounded-3xl border border-primary/30 p-6 sm:p-10"
          style={{ background: "var(--gradient-emerald)" }}
        >
          <div className="text-center">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-background/20 text-primary-foreground">
              <Gift className="h-6 w-6" />
            </div>
            <h2 className="mt-4 text-3xl font-bold text-primary-foreground sm:text-4xl">
              Earn rewards as you grow
            </h2>
            <p className="mx-auto mt-3 max-w-xl text-primary-foreground/85">
              Unlock VIP tiers with deposits and claim cash rewards — up to $10,000 on SVIP 6.
            </p>
          </div>

          <div className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {PROMO_REWARDS.map((tier) => (
              <div
                key={tier.level}
                className="rounded-2xl border border-primary-foreground/20 bg-background/15 px-4 py-4 text-primary-foreground backdrop-blur-sm"
              >
                <div className="flex items-center gap-2 text-sm font-semibold">
                  <Crown className="h-4 w-4 opacity-90" />
                  {tier.level}
                </div>
                <p className="mt-2 text-xs text-primary-foreground/75">Deposit {tier.deposit}</p>
                <p className="mt-1 text-2xl font-bold tracking-tight">{tier.reward}</p>
                <p className="text-xs text-primary-foreground/70">reward</p>
              </div>
            ))}
          </div>

          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <Button asChild size="lg" className="bg-background text-foreground hover:bg-background/90">
              <Link to="/recharge-activity">
                View rewards <ArrowRight className="ml-1 h-4 w-4" />
              </Link>
            </Button>
            <Button
              asChild
              size="lg"
              variant="outline"
              className="border-primary-foreground/40 bg-transparent text-primary-foreground hover:bg-primary-foreground/10 hover:text-primary-foreground"
            >
              <Link to="/register">Create free account</Link>
            </Button>
          </div>
        </div>
      </section>

      <SiteFooter />
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-2xl font-bold">{value}</div>
      <div className="text-xs text-muted-foreground">{label}</div>
    </div>
  );
}
