import { Link } from "react-router-dom";
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import {
  Check, Crown, Gift, Lock, Wallet,
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
  const { user, syncMyWallet } = useStore();
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
  const hasClaimable = tiers.some((t) => t.status === "claimable" || t.claimable);
  const nextLevel = hasClaimable ? undefined : tiers.find((t) => t.status === "locked")?.level;
  const totalRewards = useMemo(
    () => tiers.reduce((s, t) => s + t.reward, 0),
    [tiers]
  );

  if (!user) return null;

  const accountLevel = getAccountLevelLabel(user.vipLevel);

  return (
    <div className="relative min-h-screen flex flex-col bg-background text-foreground pb-20 md:pb-0">
      <SiteHeader />

      <main className="mx-auto w-full max-w-3xl flex-1 px-3 py-6 sm:px-6 sm:py-10">
        <section className="overflow-hidden rounded-3xl border border-amber-700/15 bg-card shadow-[0_18px_40px_-28px_rgba(140,90,10,0.35)] dark:border-amber-400/20 dark:shadow-[0_20px_60px_-40px_rgba(245,197,66,0.4)]">
          <div className="relative p-5 sm:p-8">
            <div className="pointer-events-none absolute -right-10 -top-16 h-40 w-40 rounded-full bg-amber-400/25 blur-3xl dark:bg-amber-400/15" />
            <div className="relative flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0">
                <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-amber-800 dark:text-amber-200">VIP rewards</p>
                <h1 className="mt-2 text-3xl font-bold tracking-tight sm:text-4xl">Recharge activity</h1>
                <p className="mt-3 max-w-xl text-sm leading-relaxed text-muted-foreground">
                  Deposit the amount for a VIP level and claim a one-time bonus. A larger deposit claims that level and skips the smaller ones.
                </p>
                <Button
                  asChild
                  className="mt-5 h-11 rounded-xl bg-gradient-to-r from-amber-300 via-amber-400 to-yellow-500 px-5 font-bold text-amber-950 hover:opacity-95"
                >
                  <Link to="/deposit">
                    <Wallet className="mr-2 h-4 w-4" />
                    Deposit now
                  </Link>
                </Button>
              </div>

              <div className="flex shrink-0 items-center gap-4 self-start rounded-2xl border border-amber-700/15 bg-amber-500/10 px-4 py-3 dark:border-amber-400/25 dark:bg-amber-400/10 sm:self-center">
                <Coin3D size={64} spinSec={8} label={accountLevel === "Basic" ? "VIP" : String(user.vipLevel || "VIP")} large />
                <div>
                  <div className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Your level</div>
                  <div className="mt-0.5 flex items-center gap-1.5 text-lg font-bold text-amber-900 dark:text-amber-100">
                    <Crown className="h-4 w-4 text-amber-700 dark:text-amber-300" />
                    {accountLevel}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          <Step n="1" title="Deposit" body="Send the amount shown for one level." />
          <Step n="2" title="Claim" body="The bonus is added to your balance once." />
          <Step n="3" title="Move up" body="A bigger deposit skips levels you have not claimed." />
        </div>

        <div className="mt-8 flex items-end justify-between gap-3">
          <div>
            <h2 className="text-lg font-bold tracking-tight">Your rewards</h2>
            <p className="text-sm text-muted-foreground">
              Up to <span className="font-semibold text-amber-900 dark:text-amber-100">{money(totalRewards)}</span> in one-time bonuses
            </p>
          </div>
        </div>

        {loading ? (
          <div className="mt-4 space-y-3">
            {Array.from({ length: 4 }, (_, i) => (
              <div key={i} className="h-[92px] animate-pulse rounded-2xl border border-border/50 bg-card/70" />
            ))}
          </div>
        ) : (
          <div className="mt-4 space-y-3">
            {tiers.map((tier, i) => (
              <TierCard
                key={tier.level}
                tier={tier}
                isNext={tier.level === nextLevel}
                delayMs={40 + i * 45}
                claiming={claimingLevel === tier.level}
                onClaim={() => void handleClaim(tier.level)}
              />
            ))}
          </div>
        )}
      </main>
      <SiteFooter />
    </div>
  );
}

function money(n: number) {
  return `$${Number(n || 0).toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
}

function Step({ n, title, body }: { n: string; title: string; body: string }) {
  return (
    <div className="rounded-2xl border border-border/70 bg-card px-4 py-3">
      <div className="flex items-center gap-2">
        <span className="grid h-6 w-6 place-items-center rounded-full bg-amber-500/15 text-[11px] font-bold text-amber-900 dark:text-amber-100">
          {n}
        </span>
        <div className="text-sm font-semibold">{title}</div>
      </div>
      <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">{body}</p>
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
  isNext,
  delayMs,
  claiming,
  onClaim,
}: {
  tier: VipTierStatus;
  isNext: boolean;
  delayMs: number;
  claiming: boolean;
  onClaim: () => void;
}) {
  const stepNeed = tier.stepRequired ?? tier.required;
  const isClaimed = tier.status === "claimed" || tier.claimed;
  const isClaimable = tier.status === "claimable" || tier.claimable;
  const isSkipped = tier.status === "skipped" || tier.skipped;
  const badge = isClaimable
    ? "claimable"
    : isClaimed
      ? "claimed"
      : isSkipped
        ? "skipped"
        : isNext
          ? "next"
          : null;

  return (
    <article
      className={`vip-tier-enter rounded-2xl border p-4 sm:p-5 ${
        isClaimable
          ? "border-amber-600/35 bg-gradient-to-r from-amber-400/20 via-card to-card vip-claimable-card dark:border-amber-400/45 dark:from-amber-400/15"
          : isClaimed
            ? "border-emerald-700/20 bg-emerald-500/[0.06] dark:border-emerald-400/25"
            : isSkipped
              ? "border-border/50 bg-card/50 opacity-70"
              : isNext
                ? "border-amber-700/20 bg-card dark:border-amber-400/20"
                : "border-border/70 bg-card/80"
      }`}
      style={{ animationDelay: `${delayMs}ms` }}
    >
      <div className="flex items-center gap-3 sm:gap-4">
        <div
          className={`grid h-12 w-12 shrink-0 place-items-center rounded-2xl border text-sm font-bold ${
            isClaimed
              ? "border-emerald-700/25 bg-emerald-500/10 text-emerald-800 dark:text-emerald-200"
              : isClaimable || isNext
                ? "border-amber-700/25 bg-amber-500/15 text-amber-950 dark:border-amber-400/35 dark:text-amber-100"
                : "border-border bg-muted/50 text-muted-foreground"
          }`}
        >
          {isClaimed ? <Check className="h-4 w-4" /> : isSkipped ? <Lock className="h-4 w-4" /> : tier.level}
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-base font-bold tracking-tight sm:text-lg">{tier.name}</h3>
            {badge && <StatusBadge status={badge} />}
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            Deposit <span className="font-semibold text-foreground">{money(stepNeed)}</span>
          </p>
        </div>

        <div className={`shrink-0 rounded-xl px-3 py-2 text-right ${isSkipped ? "bg-muted/60" : "bg-amber-500/12 dark:bg-amber-400/10"}`}>
          <div className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Bonus</div>
          <div className={`font-mono text-lg font-bold sm:text-xl ${isSkipped ? "text-muted-foreground" : "text-amber-950 dark:text-amber-100"}`}>
            +{money(tier.reward)}
          </div>
        </div>
      </div>

      {isClaimable && (
        <Button
          disabled={claiming}
          onClick={onClaim}
          className="mt-4 h-11 w-full rounded-xl bg-gradient-to-r from-amber-300 via-amber-400 to-yellow-500 font-bold text-amber-950 hover:opacity-95"
        >
          <Gift className="mr-1.5 h-4 w-4" />
          {claiming ? "Claiming…" : `Claim ${money(tier.reward)}`}
        </Button>
      )}
    </article>
  );
}

function StatusBadge({ status }: { status: "claimable" | "claimed" | "skipped" | "next" }) {
  const map = {
    claimable: "bg-amber-500/20 text-amber-950 border-amber-700/25 dark:text-amber-100 dark:border-amber-400/30",
    claimed: "bg-emerald-500/12 text-emerald-800 border-emerald-700/20 dark:text-emerald-200 dark:border-emerald-400/25",
    skipped: "bg-muted text-muted-foreground border-border",
    next: "bg-background text-amber-900 border-amber-700/25 dark:text-amber-100 dark:border-amber-400/30",
  };
  const label = {
    claimable: "Ready to claim",
    claimed: "Claimed",
    skipped: "Skipped",
    next: "Next",
  };
  return (
    <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${map[status]}`}>
      {label[status]}
    </span>
  );
}
