import { Link } from "react-router-dom";
import { useMemo, useState } from "react";
import {
  User as UserIcon, Mail, Phone, Globe, ShieldCheck, Wallet,
  ArrowUp, ArrowDown, CheckCircle2, XCircle, Clock, AlertCircle, Crown,
} from "lucide-react";
import { SiteHeader } from "@/components/layout/site-header";
import { SiteFooter } from "@/components/layout/site-footer";
import { Button } from "@/components/ui/button";
import { useStore, type BinaryTrade } from "@/context/store";
import { CountdownChip } from "@/components/binary-ticket";
import { TradeResultViewDialog, TradeViewButton } from "@/components/trade-result-view";
import { formatPrice } from "@/services/market-data";
import { COUNTRIES } from "@/constants/countries";

import { RequireAuth } from "@/components/auth/require-auth";

export default function ProfilePage() {
  return (
    <RequireAuth roles={["user"]}>
      <ProfileContent />
    </RequireAuth>
  );
}

function ProfileContent() {
  const { user, wallet, myTrades, myDeposits, assets } = useStore();
  const [viewTrade, setViewTrade] = useState<BinaryTrade | null>(null);

  const countryName = useMemo(
    () => COUNTRIES.find((c) => c.code === user?.country)?.name ?? user?.country ?? "—",
    [user?.country],
  );

  if (!user) return null;

  const active = myTrades.filter((t) => t.status === "active");
  const history = myTrades.filter((t) => t.status !== "active");
  const totalPnl = history.reduce((s, t) => s + (t.pnl ?? 0), 0);
  const wins = history.filter((t) => t.status === "won").length;
  const winRate = history.length ? (wins / history.length) * 100 : 0;
  const initials = `${user.fname?.[0] ?? ""}${user.lname?.[0] ?? ""}`.toUpperCase() || "U";

  return (
    <Shell>
      <main className="mx-auto w-full max-w-6xl flex-1 px-3 py-4 sm:px-6 sm:py-10">
        {/* Header card */}
        <section className="overflow-hidden rounded-2xl border border-border/60 bg-card/60" style={{ boxShadow: "var(--shadow-elegant)" }}>
          <div className="flex flex-col gap-4 p-6 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-4">
              <span className="flex h-16 w-16 items-center justify-center rounded-full bg-primary/15 text-xl font-bold text-primary">
                {initials}
              </span>
              <div>
                <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">{user.name}</h1>
                <p className="text-sm text-muted-foreground">{user.email}</p>
                <KycBanner status={user.kyc.status} reason={user.kyc.reason} />
              </div>
            </div>
            <div className="grid grid-cols-3 gap-3 text-right">
              <MiniStat label="Balance" value={`$${wallet.cashUSDT.toFixed(2)}`} />
              <MiniStat label="P&L" value={`${totalPnl >= 0 ? "+" : ""}$${totalPnl.toFixed(2)}`} accent={totalPnl >= 0 ? "text-primary" : "text-destructive"} />
              <MiniStat label="Win rate" value={`${winRate.toFixed(0)}%`} />
            </div>
          </div>
        </section>

        <div className="mt-6 grid gap-6 lg:grid-cols-3">
          {/* Account info */}
          <section className="rounded-xl border border-border/60 bg-card/60 p-5 lg:col-span-1">
            <h2 className="flex items-center gap-2 text-sm font-semibold"><UserIcon className="h-4 w-4 text-primary" />Account</h2>
            <dl className="mt-4 space-y-3 text-sm">
              <Row icon={Mail} label="Email" value={user.email} />
              <Row icon={Phone} label="Phone" value={user.phone || "—"} />
              <Row icon={Globe} label="Country" value={countryName} />
              <Row icon={Wallet} label="Win payout" value="By duration" accent="text-primary" />
              <Row icon={Wallet} label="Loss on lose" value="−100% stake" accent="text-destructive" />
            </dl>
            <div className="mt-5 flex flex-wrap gap-2">
              <Button asChild size="sm" variant="outline"><Link to="/kyc"><ShieldCheck className="mr-1 h-3.5 w-3.5" />KYC</Link></Button>
              <Button asChild size="sm" variant="outline"><Link to="/deposit"><Wallet className="mr-1 h-3.5 w-3.5" />Deposit</Link></Button>
              <Button asChild size="sm" variant="outline"><Link to="/recharge-activity"><Crown className="mr-1 h-3.5 w-3.5" />Recharge activity</Link></Button>
            </div>
          </section>

          {/* KYC status detail */}
          <section className="rounded-xl border border-border/60 bg-card/60 p-5 lg:col-span-2">
            <h2 className="flex items-center gap-2 text-sm font-semibold"><ShieldCheck className="h-4 w-4 text-primary" />Identity verification</h2>
            <KycPanel status={user.kyc.status} reason={user.kyc.reason} submittedAt={user.kyc.submittedAt} reviewedAt={user.kyc.reviewedAt} />
          </section>
        </div>

        {/* Active trades */}
        <section className="mt-6 overflow-hidden rounded-xl border border-border/60 bg-card/60">
          <div className="border-b border-border/60 px-4 py-3 text-sm font-semibold">Active trades ({active.length})</div>
          {active.length === 0 ? (
            <div className="px-4 py-8 text-center text-sm text-muted-foreground">
              No active trades. <Link to="/trade" className="text-primary underline">Start trading</Link>.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/30 text-xs uppercase text-muted-foreground">
                  <tr>
                    <th className="px-3 py-3 text-left">Symbol</th>
                    <th className="px-3 py-3 text-left">Dir</th>
                    <th className="px-3 py-3 text-right">Stake</th>
                    <th className="px-3 py-3 text-right">Entry</th>
                    <th className="px-3 py-3 text-right">Mark</th>
                    <th className="px-3 py-3 text-right">Settles in</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/60">
                  {active.map((t) => {
                    const mark = assets.find((a) => a.symbol === t.symbol)?.price ?? t.entryPrice;
                    return (
                      <tr key={t.id}>
                        <td className="px-3 py-3 font-medium">{t.symbol}</td>
                        <td className="px-3 py-3"><DirPill dir={t.direction} /></td>
                        <td className="px-3 py-3 text-right font-mono">${t.stake.toFixed(2)}</td>
                        <td className="px-3 py-3 text-right font-mono">${formatPrice(t.entryPrice)}</td>
                        <td className="px-3 py-3 text-right font-mono">${formatPrice(mark)}</td>
                        <td className="px-3 py-3 text-right"><CountdownChip until={t.expiresAt} /></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>

        {/* Trade history */}
        <section className="mt-6 overflow-hidden rounded-xl border border-border/60 bg-card/60">
          <div className="border-b border-border/60 px-4 py-3 text-sm font-semibold">Trade history ({history.length})</div>
          {history.length === 0 ? (
            <div className="px-4 py-8 text-center text-sm text-muted-foreground">No resolved trades yet.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/30 text-xs uppercase text-muted-foreground">
                  <tr>
                    <th className="px-3 py-3 text-left">Settled</th>
                    <th className="px-3 py-3 text-left">Symbol</th>
                    <th className="px-3 py-3 text-left">Dir</th>
                    <th className="px-3 py-3 text-right">Stake</th>
                    <th className="px-3 py-3 text-right">Entry</th>
                    <th className="px-3 py-3 text-right">Close</th>
                    <th className="px-3 py-3 text-left">Result</th>
                    <th className="px-3 py-3 text-right">P&L</th>
                    <th className="px-3 py-3 text-right">View</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/60">
                  {history.slice(0, 100).map((t) => (
                    <tr key={t.id}>
                      <td className="px-3 py-3 text-xs text-muted-foreground">{t.resolvedAt ? new Date(t.resolvedAt).toLocaleString() : "—"}</td>
                      <td className="px-3 py-3 font-medium">{t.symbol}</td>
                      <td className="px-3 py-3"><DirPill dir={t.direction} /></td>
                      <td className="px-3 py-3 text-right font-mono">${t.stake.toFixed(2)}</td>
                      <td className="px-3 py-3 text-right font-mono">${formatPrice(t.entryPrice)}</td>
                      <td className="px-3 py-3 text-right font-mono">{t.closePrice != null ? `$${formatPrice(t.closePrice)}` : "—"}</td>
                      <td className="px-3 py-3">
                        {t.status === "won"
                          ? <span className="inline-flex items-center gap-1 rounded bg-primary/15 px-2 py-0.5 text-xs font-semibold text-primary"><CheckCircle2 className="h-3 w-3" />WON</span>
                          : <span className="inline-flex items-center gap-1 rounded bg-destructive/15 px-2 py-0.5 text-xs font-semibold text-destructive"><XCircle className="h-3 w-3" />LOST</span>}
                      </td>
                      <td className={`px-3 py-3 text-right font-mono ${(t.pnl ?? 0) >= 0 ? "text-primary" : "text-destructive"}`}>
                        {(t.pnl ?? 0) >= 0 ? "+" : ""}${(t.pnl ?? 0).toFixed(2)}
                      </td>
                      <td className="px-3 py-3 text-right">
                        <TradeViewButton onClick={() => setViewTrade(t)} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        {/* Deposit history */}
        <section className="mt-6 overflow-hidden rounded-xl border border-border/60 bg-card/60">
          <div className="flex items-center justify-between border-b border-border/60 px-4 py-3">
            <div className="text-sm font-semibold">Deposit history ({myDeposits.length})</div>
            <Button size="sm" asChild variant="outline"><Link to="/deposit">New deposit</Link></Button>
          </div>
          {myDeposits.length === 0 ? (
            <div className="px-4 py-8 text-center text-sm text-muted-foreground">No deposits yet.</div>
          ) : (
            <ul className="divide-y divide-border/60">
              {myDeposits.map((d) => (
                <li key={d.id} className="flex flex-wrap items-center gap-3 px-4 py-3 text-sm">
                  <DepositBadge status={d.status} />
                  <span className="font-mono">${d.amount.toFixed(2)}</span>
                  <span className="text-xs text-muted-foreground">{new Date(d.createdAt).toLocaleString()}</span>
                  {d.status === "rejected" && d.rejectReason && (
                    <span className="text-xs text-destructive">Reason: {d.rejectReason}</span>
                  )}
                </li>
              ))}
            </ul>
          )}
        </section>
      </main>
      {viewTrade && (
        <TradeResultViewDialog
          trade={viewTrade}
          open={!!viewTrade}
          onOpenChange={(o) => { if (!o) setViewTrade(null); }}
          userName={user.name}
          userInitials={`${user.fname?.[0] ?? ""}${user.lname?.[0] ?? ""}`.toUpperCase() || "U"}
        />
      )}
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex flex-col bg-background text-foreground pb-20 md:pb-0">
      <SiteHeader />
      {children}
      <SiteFooter />
    </div>
  );
}

function MiniStat({ label, value, accent }: { label: string; value: string; accent?: string }) {
  return (
    <div className="rounded-lg border border-border/60 bg-background/60 px-3 py-2 text-right">
      <div className="text-[10px] uppercase text-muted-foreground">{label}</div>
      <div className={`font-mono text-sm font-bold ${accent || ""}`}>{value}</div>
    </div>
  );
}

function Row({ icon: Icon, label, value, accent }: { icon: React.ComponentType<{ className?: string }>; label: string; value: string; accent?: string }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="flex items-center gap-2 text-muted-foreground"><Icon className="h-3.5 w-3.5" />{label}</span>
      <span className={`font-medium truncate ${accent || ""}`}>{value}</span>
    </div>
  );
}

function DirPill({ dir }: { dir: "up" | "down" }) {
  return dir === "up"
    ? <span className="inline-flex items-center gap-1 rounded bg-primary/15 px-2 py-0.5 text-xs font-semibold text-primary"><ArrowUp className="h-3 w-3" />UP</span>
    : <span className="inline-flex items-center gap-1 rounded bg-destructive/15 px-2 py-0.5 text-xs font-semibold text-destructive"><ArrowDown className="h-3 w-3" />DOWN</span>;
}

function DepositBadge({ status }: { status: "pending" | "approved" | "rejected" }) {
  if (status === "approved") return <span className="inline-flex items-center gap-1 rounded bg-primary/15 px-2 py-0.5 text-xs font-semibold text-primary"><CheckCircle2 className="h-3 w-3" />Approved</span>;
  if (status === "rejected") return <span className="inline-flex items-center gap-1 rounded bg-destructive/15 px-2 py-0.5 text-xs font-semibold text-destructive"><XCircle className="h-3 w-3" />Rejected</span>;
  return <span className="inline-flex items-center gap-1 rounded bg-muted px-2 py-0.5 text-xs font-semibold"><Clock className="h-3 w-3" />Pending</span>;
}

function KycBanner({ status, reason }: { status: "none" | "pending" | "approved" | "rejected"; reason?: string }) {
  const map = {
    none: { Icon: AlertCircle, label: "KYC required to deposit or trade", cls: "text-amber-400" },
    pending: { Icon: Clock, label: "KYC under review", cls: "text-amber-400" },
    approved: { Icon: CheckCircle2, label: "Verified", cls: "text-primary" },
    rejected: { Icon: XCircle, label: reason ? `KYC rejected — ${reason}` : "KYC rejected", cls: "text-destructive" },
  }[status];
  return (
    <span className={`mt-1 inline-flex items-center gap-1 text-xs ${map.cls}`}>
      <map.Icon className="h-3.5 w-3.5" />{map.label}
    </span>
  );
}

function KycPanel({ status, reason, submittedAt, reviewedAt }:
  { status: "none" | "pending" | "approved" | "rejected"; reason?: string; submittedAt?: number; reviewedAt?: number }) {
  const Steps = (
    <ol className="mt-4 grid gap-2 sm:grid-cols-3">
      <Step active label="Submit" desc="Upload CNIC front & back" done={status !== "none"} />
      <Step active={status === "pending" || status === "approved" || status === "rejected"} label="Review" desc="Admin checks documents" done={status === "approved" || status === "rejected"} />
      <Step active={status === "approved"} label="Approved" desc="Trade & deposit unlocked" done={status === "approved"} failed={status === "rejected"} />
    </ol>
  );
  if (status === "none") return (
    <div className="mt-4 space-y-3">
      <p className="text-sm text-muted-foreground">You haven't submitted your identity documents yet. KYC is required before depositing or trading.</p>
      {Steps}
      <Button asChild className="mt-2 bg-primary text-primary-foreground"><Link to="/kyc"><ShieldCheck className="mr-1 h-4 w-4" />Start verification</Link></Button>
    </div>
  );
  if (status === "pending") return (
    <div className="mt-4 space-y-3">
      <div className="rounded-md border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-amber-400">
        Submitted {submittedAt ? new Date(submittedAt).toLocaleString() : ""}. We'll notify you once it's reviewed.
      </div>
      {Steps}
    </div>
  );
  if (status === "rejected") return (
    <div className="mt-4 space-y-3">
      <div className="rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
        <div className="font-semibold">Rejected{reviewedAt ? ` on ${new Date(reviewedAt).toLocaleString()}` : ""}</div>
        {reason && <div className="mt-1 text-xs">Reason: {reason}</div>}
      </div>
      {Steps}
      <Button asChild className="mt-2 bg-primary text-primary-foreground"><Link to="/kyc">Resubmit documents</Link></Button>
    </div>
  );
  return (
    <div className="mt-4 space-y-3">
      <div className="rounded-md border border-primary/30 bg-primary/10 p-3 text-sm text-primary">
        Verified{reviewedAt ? ` on ${new Date(reviewedAt).toLocaleString()}` : ""}. You can deposit and trade.
      </div>
      {Steps}
    </div>
  );
}

function Step({ label, desc, active, done, failed }: { label: string; desc: string; active?: boolean; done?: boolean; failed?: boolean }) {
  const cls = failed ? "border-destructive/40 text-destructive"
    : done ? "border-primary/40 text-primary"
    : active ? "border-amber-500/40 text-amber-400"
    : "border-border/60 text-muted-foreground";
  return (
    <li className={`rounded-md border bg-background/60 px-3 py-2 ${cls}`}>
      <div className="text-xs font-semibold uppercase">{label}</div>
      <div className="text-[11px] text-muted-foreground">{desc}</div>
    </li>
  );
}
