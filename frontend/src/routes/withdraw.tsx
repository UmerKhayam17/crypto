import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { ArrowDownToLine, Building2, CheckCircle2, Clock, Wallet, XCircle } from "lucide-react";
import { SiteHeader } from "@/components/layout/site-header";
import { SiteFooter } from "@/components/layout/site-footer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useStore } from "@/context/store";
import { RequireAuth } from "@/components/auth/require-auth";

export const Route = createFileRoute("/withdraw")({
  head: () => ({
    meta: [
      { title: "Withdraw USDT — NovaTrade" },
      { name: "description", content: "Request a withdrawal to your TRC20 wallet or bank account." },
    ],
  }),
  component: WithdrawPage,
});

function WithdrawPage() {
  return (
    <RequireAuth roles={["user"]}>
      <WithdrawContent />
    </RequireAuth>
  );
}

function WithdrawContent() {
  const { user, wallet, myWithdrawals, createWithdrawal, cancelMyWithdrawal } = useStore();
  const [method, setMethod] = useState<"trc20" | "bank">("trc20");
  const [amount, setAmount] = useState("");
  const [trc20Address, setTrc20Address] = useState("");
  const [bankName, setBankName] = useState("");
  const [accountNumber, setAccountNumber] = useState("");
  const [accountName, setAccountName] = useState("");
  const [note, setNote] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const pendingTotal = useMemo(
    () => myWithdrawals.filter((w) => w.status === "pending").reduce((s, w) => s + w.amount, 0),
    [myWithdrawals]
  );
  const available = wallet.cashUSDT - pendingTotal;

  if (!user) return null;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    const n = parseFloat(amount);
    const r = await createWithdrawal({
      amount: n,
      method,
      trc20Address: method === "trc20" ? trc20Address : undefined,
      bankName: method === "bank" ? bankName : undefined,
      accountNumber: method === "bank" ? accountNumber : undefined,
      accountName: method === "bank" ? accountName : undefined,
      note,
    });
    setSubmitting(false);
    if (!r.ok) return toast.error(r.msg);
    toast.success(r.msg);
    setAmount("");
    setTrc20Address("");
    setBankName("");
    setAccountNumber("");
    setAccountName("");
    setNote("");
  };

  return (
    <div className="min-h-screen flex flex-col bg-background text-foreground pb-20 md:pb-0">
      <SiteHeader />
      <main className="mx-auto w-full max-w-3xl flex-1 px-3 py-4 sm:px-6 sm:py-10">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Withdraw funds</h1>
            <p className="text-sm text-muted-foreground">Request a payout to your TRC20 wallet or bank account.</p>
          </div>
          <div className="rounded-xl border border-border/60 bg-card/60 px-4 py-3">
            <div className="text-xs text-muted-foreground">Available balance</div>
            <div className="font-mono text-2xl font-bold">${available.toFixed(2)}</div>
            {pendingTotal > 0 && (
              <div className="text-[11px] text-muted-foreground">${pendingTotal.toFixed(2)} pending withdrawal</div>
            )}
          </div>
        </div>

        {user.kyc.status !== "approved" && (
          <div className="mt-4 flex items-start gap-2 rounded-md border border-amber-500/40 bg-amber-500/10 p-3 text-sm text-amber-400">
            <Clock className="h-4 w-4 mt-0.5" />
            <div>
              KYC verification is required before you can withdraw.{" "}
              <Link to="/kyc" className="font-semibold underline">Complete KYC</Link>
            </div>
          </div>
        )}

        <section className="mt-6 rounded-xl border border-border/60 bg-card/60 p-5">
          <h2 className="font-semibold">Withdrawal request</h2>
          <form onSubmit={submit} className="mt-4 space-y-4">
            <div>
              <Label className="text-xs">Payout method</Label>
              <div className="mt-2 flex flex-wrap gap-4 text-sm">
                <label className="inline-flex items-center gap-2 cursor-pointer">
                  <input type="radio" name="method" checked={method === "trc20"} onChange={() => setMethod("trc20")} className="accent-primary" />
                  <Wallet className="h-4 w-4 text-primary" />USDT (TRC20)
                </label>
                <label className="inline-flex items-center gap-2 cursor-pointer">
                  <input type="radio" name="method" checked={method === "bank"} onChange={() => setMethod("bank")} className="accent-primary" />
                  <Building2 className="h-4 w-4 text-primary" />Bank transfer
                </label>
              </div>
            </div>

            <div>
              <Label>Amount (USDT)</Label>
              <Input type="number" min="0" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="100" required />
            </div>

            {method === "trc20" ? (
              <div>
                <Label>Your TRC20 wallet address</Label>
                <Input value={trc20Address} onChange={(e) => setTrc20Address(e.target.value)} placeholder="TXYZ…" className="font-mono" required />
              </div>
            ) : (
              <>
                <div>
                  <Label>Bank name</Label>
                  <Input value={bankName} onChange={(e) => setBankName(e.target.value)} placeholder="e.g. Chase Bank" required />
                </div>
                <div>
                  <Label>Account number</Label>
                  <Input value={accountNumber} onChange={(e) => setAccountNumber(e.target.value)} placeholder="Account number" required />
                </div>
                <div>
                  <Label>Account holder name (optional)</Label>
                  <Input value={accountName} onChange={(e) => setAccountName(e.target.value)} placeholder="Name on account" />
                </div>
              </>
            )}

            <div>
              <Label>Note (optional)</Label>
              <Textarea rows={2} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Anything you want admin to know" />
            </div>

            <Button
              type="submit"
              disabled={submitting || user.kyc.status !== "approved" || available <= 0}
              className="w-full bg-primary text-primary-foreground"
            >
              <ArrowDownToLine className="mr-2 h-4 w-4" />Submit withdrawal request
            </Button>
          </form>
        </section>

        <section className="mt-8 rounded-xl border border-border/60 bg-card/60">
          <div className="border-b border-border/60 px-4 py-3 text-sm font-semibold">Your withdrawal requests</div>
          {myWithdrawals.length === 0 ? (
            <div className="px-4 py-10 text-center text-sm text-muted-foreground">No withdrawals yet.</div>
          ) : (
            <ul className="divide-y divide-border/60">
              {myWithdrawals.map((w) => (
                <li key={w.id} className="flex flex-wrap items-center gap-4 px-4 py-3 text-sm">
                  <StatusBadge status={w.status} />
                  <div className="font-mono font-semibold">${w.amount.toFixed(2)}</div>
                  <div className="text-xs text-muted-foreground">{new Date(w.createdAt).toLocaleString()}</div>
                  <div className="text-xs text-muted-foreground">
                    {w.method === "trc20" ? `TRC20 · ${w.trc20Address?.slice(0, 12)}…` : `Bank · ${w.bankName}`}
                  </div>
                  {w.status === "rejected" && w.rejectReason && (
                    <div className="text-xs text-destructive">Reason: {w.rejectReason}</div>
                  )}
                  {w.status === "pending" && (
                    <Button
                      size="sm"
                      variant="ghost"
                      className="ml-auto text-destructive"
                      onClick={async () => {
                        const r = await cancelMyWithdrawal(w.id);
                        if (!r.ok) return toast.error(r.msg);
                        toast.success(r.msg);
                      }}
                    >
                      Cancel
                    </Button>
                  )}
                </li>
              ))}
            </ul>
          )}
        </section>
      </main>
      <SiteFooter />
    </div>
  );
}

function StatusBadge({ status }: { status: "pending" | "approved" | "rejected" }) {
  if (status === "approved") {
    return (
      <span className="inline-flex items-center gap-1 rounded bg-primary/15 px-2 py-0.5 text-xs font-semibold text-primary">
        <CheckCircle2 className="h-3 w-3" />Approved
      </span>
    );
  }
  if (status === "rejected") {
    return (
      <span className="inline-flex items-center gap-1 rounded bg-destructive/15 px-2 py-0.5 text-xs font-semibold text-destructive">
        <XCircle className="h-3 w-3" />Rejected
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 rounded bg-muted px-2 py-0.5 text-xs font-semibold">
      <Clock className="h-3 w-3" />Pending
    </span>
  );
}
