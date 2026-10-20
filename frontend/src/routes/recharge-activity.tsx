import { Link } from "react-router-dom";
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import {
  Check, Crown, Gift, Wallet,
} from "lucide-react";
import { SiteHeader } from "@/components/layout/site-header";
import { SiteFooter } from "@/components/layout/site-footer";
import { RequireAuth } from "@/components/auth/require-auth";
import { Button } from "@/components/ui/button";
import { useStore } from "@/context/store";
import {
  apiGetMyVipStatus,
  apiClaimVipReward,
  type VipStatusResponse,
  type VipTierStatus,
} from "@/services/vip";
import { getAccountLevelLabel } from "@/utils/account-level";

export default function RechargeActivityPage() {
  return (
    <RequireAuth roles={["user"]}>
      <RechargeActivityContent />
    </RequireAuth>
  );
}

function RechargeActivityContent() {
  const { user, wallet, syncMyWallet } = useStore();
  const [data, setData] = useState<VipStatusResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [claimingLevel, setClaimingLevel] = useState<number | null>(null);

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

  const handleClaim = useCallback(
    async (level: number) => {
      setClaimingLevel(level);
      try {
        const res = await apiClaimVipReward(level);
        setData(res);
        if (res.wallet) syncMyWallet(res.wallet.cashUSDT);
        toast.success(res.msg || "VIP reward claimed");
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Could not claim reward");
      } finally {
        setClaimingLevel(null);
      }
    },
    [syncMyWallet]
  );

  const tiers = data?.tiers ?? [];
  const total = data?.totalRecharge ?? 0;
  const totalRewards = useMemo(
    () => tiers.reduce((s, t) => s + t.reward, 0),
    [tiers]
  );
  const unlockedRewards = useMemo(
    () => tiers.filter((t) => t.status === "claimed" || t.claimed).reduce((s, t) => s + t.reward, 0),
    [tiers]
  );

  if (!user) return null;

  const accountLevel = getAccountLevelLabel(user.vipLevel);

  return (
    <div className="relative min-h-screen flex flex-col bg-background text-foreground pb-20 md:pb-0">
      <SiteHeader />

      <main className="mx-auto w-full max-w-3xl flex-1 px-3 py-6 sm:px-6 sm:py-10">
        <section className="overflow-hidden rounded-3xl border border-amber-400/25 bg-card/70 shadow-[0_20px_60px_-40px_rgba(245,197,66,0.45)]">
          <div className="relative p-5 sm:p-8">
            <div className="pointer-events-none absolute -right-16 -top-20 h-48 w-48 rounded-full bg-amber-400/15 blur-3xl" />
            <div className="relative flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0">
                <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-amber-300">VIP rewards</p>
                <h1 className="mt-2 text-3xl font-bold tracking-tight sm:text-4xl">Recharge activity</h1>
                <p className="mt-3 max-w-xl text-sm leading-relaxed text-muted-foreground">
                  Each tier uses its own deposit. A larger deposit claims that tier and skips the ones below it.
                </p>
                <Button
                  asChild
                  className="mt-5 h-11 rounded-xl bg-gradient-to-r from-amber-300 via-amber-400 to-yellow-500 px-5 font-bold text-amber-950 hover:opacity-95"
                >
                  <Link to="/deposit">
                    <Wallet className="mr-2 h-4 w-4" />
                    Deposit
                  </Link>
                </Button>
              </div>

              <div className="flex shrink-0 items-center gap-4 self-start rounded-2xl border border-amber-400/25 bg-amber-400/8 px-4 py-3 sm:self-center">
                <Coin3D size={64} spinSec={8} label={accountLevel === "Basic" ? "VIP" : String(user.vipLevel || "VIP")} large />
                <div>
                  <div className="text-[11px] uppercase tracking-wide text-muted-foreground">Current level</div>
                  <div className="mt-0.5 flex items-center gap-1.5 text-lg font-bold text-amber-200">
                    <Crown className="h-4 w-4 text-amber-300" />
                    {accountLevel}
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 divide-y divide-border/60 border-t border-border/60 sm:grid-cols-3 sm:divide-x sm:divide-y-0">
            <Stat label="Total recharge" value={`$${total.toFixed(2)}`} />
            <Stat label="Rewards claimed" value={`$${unlockedRewards.toLocaleString()}`} />
            <Stat label="Balance" value={`$${wallet.cashUSDT.toFixed(2)}`} />
          </div>
        </section>

        <div className="mt-8 flex items-end justify-between gap-3">
          <div>
            <h2 className="text-lg font-bold tracking-tight">Reward ladder</h2>
            <p className="text-xs text-muted-foreground">
              Up to <span className="font-mono text-amber-200">${totalRewards.toLocaleString()}</span> in one-time bonuses
            </p>
          </div>
        </div>

        {loading ? (
          <div className="mt-4 space-y-3">
            {Array.from({ length: 4 }, (_, i) => (
              <div key={i} className="h-[88px] animate-pulse rounded-2xl border border-border/50 bg-card/40" />
            ))}
          </div>
        ) : (
          <div className="mt-4 space-y-3">
            {tiers.map((tier, i) => (
              <TierCard
                key={tier.level}
                tier={tier}
                delayMs={40 + i * 45}
                claiming={claimingLevel === tier.level}
                onClaim={() => void handleClaim(tier.level)}
              />
            ))}
          </div>
        )}

        <p className="mt-8 text-center text-xs text-muted-foreground">
          Totals include approved deposits only.
        </p>
      </main>
      <SiteFooter />
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
  claiming,
  onClaim,
}: {
  tier: VipTierStatus;
  delayMs: number;
  claiming: boolean;
  onClaim: () => void;
}) {
  const stepNeed = tier.stepRequired ?? tier.required;
  const isClaimed = tier.status === "claimed" || tier.claimed;
  const isClaimable = tier.status === "claimable" || tier.claimable;
  const isSkipped = tier.status === "skipped" || tier.skipped;
  const progress = Math.max(0, Math.min(100, Number(tier.progress) || 0));
  const showProgress = !isClaimed && !isSkipped && progress > 0 && progress < 100;
  const topTier = tier.level >= 6;

  return (
    <article
      className={`vip-tier-enter rounded-2xl border p-4 sm:p-5 ${
        isClaimable
          ? "border-amber-400/50 bg-gradient-to-r from-amber-400/12 via-card/80 to-card/60 vip-claimable-card"
          : isClaimed
            ? "border-primary/30 bg-primary/5"
            : isSkipped
              ? "border-border/40 bg-card/30 opacity-70"
              : topTier
                ? "border-amber-400/20 bg-card/60"
                : "border-border/60 bg-card/50"
      }`}
      style={{ animationDelay: `${delayMs}ms` }}
    >
      <div className="flex items-center gap-3 sm:gap-4">
        <div
          className={`grid h-11 w-11 shrink-0 place-items-center rounded-xl border text-sm font-bold ${
            isClaimed
              ? "border-primary/40 bg-primary/15 text-primary"
              : isClaimable || topTier
                ? "border-amber-400/40 bg-amber-400/15 text-amber-200"
                : "border-border/70 bg-background/40 text-muted-foreground"
          }`}
        >
          {isClaimed ? <Check className="h-4 w-4" /> : tier.level}
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className={`text-base font-bold tracking-tight sm:text-lg ${isClaimable || isClaimed ? "text-foreground" : "text-foreground/90"}`}>
              {tier.name}
            </h3>
            {isClaimable && <StatusBadge status="claimable" />}
            {isClaimed && <StatusBadge status="claimed" />}
            {isSkipped && <StatusBadge status="skipped" />}
          </div>
          <p className="mt-0.5 text-xs text-muted-foreground sm:text-sm">
            Deposit <span className="font-mono text-foreground">${stepNeed.toLocaleString()}</span>
          </p>
          {showProgress && (
            <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted">
              <div className="vip-shimmer-bar h-full rounded-full" style={{ width: `${progress}%` }} />
            </div>
          )}
        </div>

        <div className="shrink-0 text-right">
          <div className={`font-mono text-lg font-bold sm:text-xl ${isSkipped ? "text-muted-foreground" : "text-amber-200"}`}>
            +${tier.reward.toLocaleString()}
          </div>
          <div className="text-[11px] text-muted-foreground">reward</div>
        </div>
      </div>

      {isClaimable && (
        <Button
          disabled={claiming}
          onClick={onClaim}
          className="mt-4 h-10 w-full rounded-xl bg-gradient-to-r from-amber-300 via-amber-400 to-yellow-500 font-bold text-amber-950 hover:opacity-95 sm:ml-14 sm:w-auto"
        >
          <Gift className="mr-1.5 h-4 w-4" />
          {claiming ? "Claiming…" : "Claim reward"}
        </Button>
      )}
    </article>
  );
}

function StatusBadge({ status }: { status: "claimable" | "claimed" | "skipped" }) {
  const map = {
    claimable: "bg-amber-400/15 text-amber-200 border-amber-400/30",
    claimed: "bg-primary/15 text-primary border-primary/30",
    skipped: "bg-muted/60 text-muted-foreground border-border/50",
  };
  const label = {
    claimable: "Ready",
    claimed: "Claimed",
    skipped: "Skipped",
  };
  return (
    <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${map[status]}`}>
      {label[status]}
    </span>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="px-5 py-4">
      <div className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="mt-1 font-mono text-xl font-bold tracking-tight sm:text-2xl">{value}</div>
    </div>
  );
}
