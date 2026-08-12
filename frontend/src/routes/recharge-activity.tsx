import { Link } from "react-router-dom";
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import {
  Crown, Gift, CheckCircle2, Lock, Wallet, Sparkles, Trophy, ArrowRight,
} from "lucide-react";
import { SiteHeader } from "@/components/layout/site-header";
import { SiteFooter } from "@/components/layout/site-footer";
import { RequireAuth } from "@/components/auth/require-auth";
import { Button } from "@/components/ui/button";
import { useStore } from "@/context/store";
import {
  apiGetMyVipStatus,
  type VipStatusResponse,
  type VipTierStatus,
} from "@/services/vip";

export default function RechargeActivityPage() {
  return (
    <RequireAuth roles={["user"]}>
      <RechargeActivityContent />
    </RequireAuth>
  );
}

function RechargeActivityContent() {
  const { user, wallet } = useStore();
  const [data, setData] = useState<VipStatusResponse | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiGetMyVipStatus();
      setData(res);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not load recharge activity");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const tiers = data?.tiers ?? [];
  const total = data?.totalRecharge ?? 0;
  const reachedCount = tiers.filter((t) => t.status === "claimed" || t.status === "claimable").length;
  const totalRewards = useMemo(
    () => tiers.reduce((s, t) => s + t.reward, 0),
    [tiers]
  );
  const unlockedRewards = useMemo(
    () => tiers.filter((t) => t.status === "claimed" || t.status === "claimable" || t.claimed).reduce((s, t) => s + t.reward, 0),
    [tiers]
  );
  const nextTier = tiers.find(
    (t) => t.status === "claimable" || t.status === "locked" || t.status === "pending_previous"
  );

  if (!user) return null;

  return (
    <div className="relative min-h-screen flex flex-col overflow-hidden bg-background text-foreground pb-20 md:pb-0">
      {/* Stage backdrop */}
      <div
        className="pointer-events-none absolute inset-0 -z-10"
        style={{
          background: `
            radial-gradient(ellipse 90% 55% at 50% -5%, oklch(0.88 0.14 85 / 0.22), transparent 55%),
            radial-gradient(ellipse 50% 40% at 0% 40%, oklch(0.72 0.17 158 / 0.14), transparent 50%),
            radial-gradient(ellipse 45% 35% at 100% 60%, oklch(0.75 0.12 70 / 0.1), transparent 45%),
            var(--gradient-hero)
          `,
        }}
      />
      <div
        className="pointer-events-none absolute inset-0 -z-10 opacity-[0.07]"
        style={{
          backgroundImage:
            "radial-gradient(circle at 1px 1px, oklch(0.9 0.05 85) 1px, transparent 0)",
          backgroundSize: "28px 28px",
        }}
      />
      <GoldParticles />

      <SiteHeader />

      <main className="mx-auto w-full max-w-4xl flex-1 px-3 py-4 sm:px-6 sm:py-8">
        {/* Hero vault */}
        <section
          className="relative overflow-hidden rounded-[1.75rem] border border-amber-400/30 p-5 sm:p-8"
          style={{
            background:
              "linear-gradient(145deg, oklch(0.22 0.05 258 / 0.92) 0%, oklch(0.18 0.04 260 / 0.85) 50%, oklch(0.24 0.06 160 / 0.35) 100%)",
            boxShadow: "var(--shadow-elegant), 0 0 80px -30px rgba(245,197,66,0.35)",
          }}
        >
          <div className="vip-glow-breathe pointer-events-none absolute -right-16 -top-16 h-64 w-64 rounded-full bg-amber-400/20 blur-3xl" />
          <div className="vip-glow-breathe pointer-events-none absolute -bottom-20 -left-10 h-56 w-56 rounded-full bg-primary/20 blur-3xl" style={{ animationDelay: "-1.5s" }} />
          <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-amber-300/50 to-transparent" />

          <div className="relative grid gap-8 lg:grid-cols-[1.15fr_0.85fr] lg:items-center">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full border border-amber-400/35 bg-amber-400/10 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.14em] text-amber-200">
                <Sparkles className="vip-sparkle h-3.5 w-3.5 text-amber-300" />
                Exclusive VIP vault
              </div>

              <h1 className="mt-4 text-4xl font-extrabold tracking-tight sm:text-5xl">
                <span className="bg-gradient-to-br from-amber-100 via-amber-300 to-amber-500 bg-clip-text text-transparent">
                  Recharge
                </span>{" "}
                <span className="text-foreground">Activity</span>
              </h1>

              <p className="mt-3 max-w-lg text-sm leading-relaxed text-muted-foreground sm:text-[15px]">
                Climb the VIP ladder, unlock one-time bonuses, and watch golden rewards spin into your wallet.
                Each level can be claimed once — keep recharging to open the next.
              </p>

              <div className="mt-6 flex flex-wrap items-center gap-3">
                <Button
                  asChild
                  size="lg"
                  className="h-11 rounded-xl bg-gradient-to-r from-amber-300 via-amber-400 to-yellow-500 font-bold text-amber-950 shadow-[0_8px_30px_-8px_rgba(245,197,66,0.65)] hover:opacity-95"
                >
                  <Link to="/deposit">
                    <Wallet className="mr-2 h-4 w-4" />
                    Deposit & unlock
                  </Link>
                </Button>
                {nextTier && (
                  <div className="flex items-center gap-2 rounded-xl border border-border/50 bg-background/40 px-3 py-2 backdrop-blur-sm">
                    <Trophy className="h-4 w-4 text-amber-300" />
                    <div className="text-xs">
                      <div className="text-muted-foreground">Up next</div>
                      <div className="font-semibold text-amber-200">
                        {nextTier.name}{" "}
                        <span className="font-mono text-primary">+${nextTier.reward.toLocaleString()}</span>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>

            <CoinShowcase currentVip={data?.currentVipName ?? undefined} />
          </div>
        </section>

        {/* Stats strip */}
        <div className="mt-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
          <Stat icon={<Wallet className="h-4 w-4 text-primary" />} label="Total recharge" value={`$${total.toFixed(2)}`} />
          <Stat icon={<Crown className="h-4 w-4 text-amber-300" />} label="Current VIP" value={data?.currentVipName || "—"} accent="text-amber-300" />
          <Stat icon={<Gift className="h-4 w-4 text-primary" />} label="VIP rewards" value={`$${unlockedRewards.toLocaleString()}`} />
          <Stat icon={<Trophy className="h-4 w-4 text-amber-300" />} label="Vault balance" value={`$${wallet.cashUSDT.toFixed(2)}`} className="col-span-2 lg:col-span-1" />
        </div>

        {/* VIP journey rail */}
        {!loading && tiers.length > 0 && (
          <section className="vip-tier-enter mt-6 overflow-hidden rounded-2xl border border-amber-400/20 bg-card/40 p-4 sm:p-5">
            <div className="mb-4 flex items-center justify-between gap-2">
              <h2 className="flex items-center gap-2 text-sm font-bold">
                <Crown className="h-4 w-4 text-amber-300" />
                VIP path
              </h2>
              <span className="text-[11px] text-muted-foreground">
                {reachedCount}/{tiers.length} reached
              </span>
            </div>
            <div className="relative">
              <div className="relative flex justify-between gap-1 overflow-x-auto pb-1">
                {tiers.map((t) => {
                  const done = t.status === "claimed" || t.status === "claimable";
                  return (
                    <div key={t.level} className="flex min-w-[52px] flex-col items-center gap-1.5">
                      <div
                        className={`relative z-[1] flex h-9 w-9 items-center justify-center rounded-full border-2 text-xs font-bold transition-all ${
                          done
                            ? "border-amber-400/70 bg-amber-400/15 text-amber-200"
                            : "border-border bg-muted/60 text-muted-foreground"
                        }`}
                      >
                        {done ? <CheckCircle2 className="h-4 w-4" /> : t.level}
                      </div>
                      <span className={`text-[9px] font-semibold uppercase tracking-wide ${done ? "text-amber-200" : "text-muted-foreground"}`}>
                        {t.name.replace("VIP", "V").replace("SVIP", "S")}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          </section>
        )}

        {/* Tier cards */}
        <div className="mt-6 flex items-end justify-between gap-2">
          <div>
            <h2 className="text-lg font-bold tracking-tight">Reward tiers</h2>
            <p className="text-xs text-muted-foreground">
              Up to <span className="font-mono text-primary">${totalRewards.toLocaleString()}</span> in one-time bonuses
            </p>
          </div>
        </div>

        {loading ? (
          <div className="mt-12 flex flex-col items-center gap-4 text-muted-foreground">
            <div className="vip-coin-tilt relative h-16 w-16">
              <Coin3D size={64} spinSec={1.1} label="$" />
            </div>
            <span className="text-sm">Opening the VIP vault…</span>
          </div>
        ) : (
          <div className="mt-4 space-y-3.5">
            {tiers.map((tier, i) => (
              <TierCard
                key={tier.level}
                tier={tier}
                delayMs={80 + i * 80}
              />
            ))}
          </div>
        )}

        <p className="mt-10 text-center text-xs text-muted-foreground">
          Recharge totals are based on approved deposits only.
        </p>
      </main>
      <SiteFooter />
    </div>
  );
}

function GoldParticles() {
  const particles = useMemo(
    () =>
      Array.from({ length: 14 }, (_, i) => ({
        id: i,
        left: `${6 + ((i * 7) % 88)}%`,
        delay: `${(i * 0.55) % 7}s`,
        duration: `${7 + (i % 5)}s`,
        size: 3 + (i % 4),
      })),
    []
  );
  return (
    <div className="pointer-events-none absolute inset-0 -z-10 overflow-hidden" aria-hidden>
      {particles.map((p) => (
        <span
          key={p.id}
          className="vip-particle"
          style={{
            left: p.left,
            top: "-5%",
            width: p.size,
            height: p.size,
            animationDelay: p.delay,
            animationDuration: p.duration,
          }}
        />
      ))}
    </div>
  );
}

function CoinShowcase({ currentVip }: { currentVip?: string }) {
  return (
    <div className="vip-coin-scene relative mx-auto h-52 w-52 sm:h-60 sm:w-60">
      {/* Floor glow */}
      <div className="vip-glow-breathe absolute bottom-2 left-1/2 h-8 w-36 -translate-x-1/2 rounded-[100%] bg-amber-400/30 blur-xl" />

      <div className="vip-coin-orbit absolute left-1/2 top-1/2 h-11 w-11 -translate-x-1/2 -translate-y-1/2" style={{ animationDuration: "13s" }}>
        <div className="absolute left-1/2 top-0 -translate-x-1/2">
          <Coin3D size={40} spinSec={2.8} label="₮" />
        </div>
      </div>
      <div
        className="vip-coin-orbit absolute left-1/2 top-1/2 h-9 w-9 -translate-x-1/2 -translate-y-1/2"
        style={{ animationDuration: "8.5s", animationDirection: "reverse", animationDelay: "-2.5s" }}
      >
        <div className="absolute left-1/2 top-0 -translate-x-1/2">
          <Coin3D size={32} spinSec={2.4} label="$" variant="emerald" />
        </div>
      </div>
      <div
        className="vip-coin-orbit absolute left-1/2 top-1/2 h-8 w-8 -translate-x-1/2 -translate-y-1/2"
        style={{ animationDuration: "16s", animationDelay: "-5s" }}
      >
        <div className="absolute left-1/2 top-0 -translate-x-1/2">
          <Coin3D size={26} spinSec={3.5} label="V" />
        </div>
      </div>

      <div className="vip-coin-tilt absolute inset-0 m-auto h-32 w-32 sm:h-36 sm:w-36">
        <div className="vip-coin-float h-full w-full" style={{ animationDelay: "0.15s" }}>
          <div className="relative h-full w-full">
            <span className="vip-pulse-ring" style={{ inset: "-14px" }} />
            <Coin3D size="100%" spinSec={4.8} label="VIP" large />
          </div>
        </div>
      </div>

      <div className="vip-coin-float absolute left-0 top-8 h-12 w-12" style={{ animationDelay: "-1.1s", animationDuration: "4s" }}>
        <Coin3D size={48} spinSec={3.2} label="$" />
      </div>
      <div className="vip-coin-float absolute bottom-6 right-1 h-14 w-14" style={{ animationDelay: "-2.1s", animationDuration: "3.6s" }}>
        <Coin3D size={56} spinSec={3.8} label="₮" variant="emerald" />
      </div>
      <div className="vip-coin-float absolute right-2 top-4 h-9 w-9" style={{ animationDelay: "-0.6s", animationDuration: "4.4s" }}>
        <Coin3D size={36} spinSec={2.6} label="★" />
      </div>

      <Sparkles className="vip-sparkle absolute left-8 top-2 h-4 w-4 text-amber-300" style={{ animationDelay: "0.4s" }} />
      <Sparkles className="vip-sparkle absolute bottom-14 right-10 h-3.5 w-3.5 text-primary" style={{ animationDelay: "1.2s" }} />

      {currentVip ? (
        <div className="absolute -bottom-1 left-1/2 z-10 -translate-x-1/2 whitespace-nowrap rounded-full border border-amber-400/50 bg-background/85 px-3.5 py-1 text-[11px] font-bold uppercase tracking-[0.12em] text-amber-200 shadow-lg backdrop-blur">
          <Crown className="mr-1 inline h-3 w-3 text-amber-300" />
          {currentVip}
        </div>
      ) : (
        <div className="absolute -bottom-1 left-1/2 z-10 -translate-x-1/2 whitespace-nowrap rounded-full border border-border/60 bg-background/80 px-3 py-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground backdrop-blur">
          Start your climb
        </div>
      )}
    </div>
  );
}

function Coin3D({
  size,
  spinSec = 4.5,
  label = "$",
  variant = "gold",
  large = false,
}: {
  size: number | string;
  spinSec?: number;
  label?: string;
  variant?: "gold" | "emerald";
  large?: boolean;
}) {
  const dim = typeof size === "number" ? `${size}px` : size;
  const textSize = large ? "text-2xl sm:text-3xl" : "text-sm";
  return (
    <div className="relative" style={{ width: dim, height: dim, perspective: "700px" }}>
      <div className="vip-coin-spin" style={{ animationDuration: `${spinSec}s` }}>
        <div
          className={`vip-coin-face ${variant === "emerald" ? "vip-coin-face--back" : ""}`}
          style={{ transform: "rotateY(0deg)" }}
        >
          <span
            className={`font-extrabold tracking-tight drop-shadow-sm ${textSize} ${
              variant === "emerald" ? "text-[#063d24]" : "text-[#5c3a08]"
            }`}
          >
            {label}
          </span>
        </div>
        <div
          className={`vip-coin-face ${variant === "gold" ? "vip-coin-face--back" : ""}`}
          style={
            variant === "gold"
              ? undefined
              : {
                  transform: "rotateY(180deg)",
                  background:
                    "radial-gradient(circle at 28% 22%, #fff3c4 0%, #ffe08a 18%, #f5c542 42%, #d4921a 72%, #8a5a0a 100%)",
                  borderColor: "rgba(255, 230, 160, 0.85)",
                }
          }
        >
          <span
            className={`font-extrabold ${textSize} ${
              variant === "gold" ? "text-[#063d24]" : "text-[#5c3a08]"
            }`}
          >
            {variant === "gold" ? "₮" : "$"}
          </span>
        </div>
      </div>
    </div>
  );
}

function TierCard({
  tier,
  delayMs,
}: {
  tier: VipTierStatus;
  delayMs: number;
}) {
  const stepNeed = tier.stepRequired ?? tier.required;
  const progressAmount = tier.progressAmount ?? 0;
  const remaining = tier.remaining ?? Math.max(0, stepNeed - progressAmount);
  const isReached = tier.status === "claimable" || tier.status === "claimed" || tier.unlocked;
  const isLocked = !isReached;
  const waitingPrevious = tier.status === "pending_previous";

  return (
    <div
      className={`vip-tier-enter group relative overflow-hidden rounded-2xl border p-4 transition-all sm:p-5 ${
        isReached
          ? "border-amber-400/40 bg-gradient-to-br from-amber-400/10 via-card/50 to-transparent"
          : "border-border/50 bg-card/45 hover:border-border"
      }`}
      style={{ animationDelay: `${delayMs}ms` }}
    >
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/15 to-transparent" />

      <div className="relative flex gap-3.5 sm:gap-5">
        <div className={`relative shrink-0 ${isLocked ? "opacity-40 grayscale" : ""}`}>
          <div className={isReached ? "vip-coin-float" : ""} style={{ animationDuration: "4.5s" }}>
            <Coin3D
              size={64}
              spinSec={isReached ? 5.5 : 9}
              label={String(tier.level)}
              variant="gold"
              large
            />
          </div>
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <span
                  className={`text-lg font-extrabold tracking-tight sm:text-xl ${
                    isReached ? "text-amber-200" : "text-foreground"
                  }`}
                >
                  {tier.name}
                </span>
                <StatusBadge status={isReached ? "claimed" : waitingPrevious ? "pending_previous" : "locked"} />
              </div>

              <div className="mt-2 flex flex-wrap items-center gap-2 text-xs sm:text-sm">
                <span className="rounded-lg border border-border/50 bg-background/40 px-2.5 py-1 font-mono text-muted-foreground">
                  Need <span className="font-semibold text-foreground">${stepNeed.toLocaleString()}</span>
                </span>
                <ArrowRight className="h-3.5 w-3.5 text-muted-foreground/50" />
                <span className="rounded-lg border border-amber-400/30 bg-amber-400/10 px-2.5 py-1 font-mono font-bold text-amber-200">
                  +${tier.reward.toLocaleString()}
                </span>
              </div>
            </div>

            <div className="flex items-center gap-2 self-center">
              {isReached && (
                <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-400/30 bg-amber-400/10 px-3 py-1.5 text-xs font-bold text-amber-200">
                  <CheckCircle2 className="h-3.5 w-3.5" /> Reached
                </span>
              )}
              {isLocked && (
                <span className="inline-flex max-w-[11rem] items-center gap-1.5 rounded-full border border-border/50 bg-muted/40 px-3 py-1.5 text-[11px] text-muted-foreground">
                  <Lock className="h-3.5 w-3.5 shrink-0" />
                  {waitingPrevious
                    ? "Reach previous VIP first"
                    : `Need $${remaining.toFixed(0)} more`}
                </span>
              )}
            </div>
          </div>

          <div className="mt-3 text-[10px] text-muted-foreground sm:text-[11px]">
            <span className="font-mono">
              ${progressAmount.toFixed(2)} / ${stepNeed.toLocaleString()} recharged
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: VipTierStatus["status"] }) {
  const map = {
    claimed: "bg-amber-400/15 text-amber-200 border-amber-400/25",
    claimable: "bg-amber-400/15 text-amber-200 border-amber-400/25",
    locked: "bg-muted/60 text-muted-foreground border-border/50",
    pending_previous: "bg-muted/60 text-muted-foreground border-border/50",
  };
  const label = {
    claimed: "Reached",
    claimable: "Reached",
    locked: "Locked",
    pending_previous: "Locked",
  };
  return (
    <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${map[status]}`}>
      {label[status]}
    </span>
  );
}

function Stat({
  label,
  value,
  accent,
  className = "",
  icon,
}: {
  label: string;
  value: string;
  accent?: string;
  className?: string;
  icon?: React.ReactNode;
}) {
  return (
    <div
      className={`group relative overflow-hidden rounded-2xl border border-border/40 bg-card/50 p-4 backdrop-blur-sm transition-colors hover:border-amber-400/25 ${className}`}
      style={{ boxShadow: "var(--shadow-elegant)" }}
    >
      <div className="pointer-events-none absolute -right-4 -top-4 h-16 w-16 rounded-full bg-amber-400/5 blur-xl transition-opacity group-hover:opacity-100" />
      <div className="flex items-center gap-1.5 text-[11px] uppercase tracking-wide text-muted-foreground">
        {icon}
        {label}
      </div>
      <div className={`mt-2 text-xl font-extrabold font-mono tracking-tight sm:text-2xl ${accent || ""}`}>
        {value}
      </div>
    </div>
  );
}
