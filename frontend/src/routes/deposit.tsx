import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, useRef } from "react";
import { toast } from "sonner";
import { Copy, Wallet, Upload, CheckCircle2, XCircle, Clock } from "lucide-react";
import { SiteHeader } from "@/components/layout/site-header";
import { SiteFooter } from "@/components/layout/site-footer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useStore } from "@/context/store";

import { RequireAuth } from "@/components/auth/require-auth";

export const Route = createFileRoute("/deposit")({
  head: () => ({
    meta: [
      { title: "Deposit USDT — NovaTrade" },
      { name: "description", content: "Top up your NovaTrade balance with USDT (TRC20). Upload a payment screenshot for verification." },
    ],
  }),
  component: DepositPage,
});

function DepositPage() {
  return (
    <RequireAuth roles={["user"]}>
      <DepositContent />
    </RequireAuth>
  );
}

function DepositContent() {
  const { user, wallet, walletAddress, myDeposits, createDeposit, cancelMyDeposit } = useStore();
  const [amount, setAmount] = useState("");
  const [tx, setTx] = useState("");
  const [note, setNote] = useState("");
  const [screenshot, setScreenshot] = useState<File | null>(null);
  const [preview, setPreview] = useState<string>("");
  const fileRef = useRef<HTMLInputElement>(null);
  const [submitting, setSubmitting] = useState(false);

  if (!user) return null;

  const onFile = (f: File | null) => {
    if (!f) return;
    if (!f.type.startsWith("image/")) return toast.error("Please choose an image file");
    if (f.size > 1_500_000) return toast.error("Image too large (max 1.5 MB)");
    setScreenshot(f);
    const r = new FileReader();
    r.onload = () => setPreview(String(r.result || ""));
    r.readAsDataURL(f);
  };

  const copyAddr = async () => {
    if (!walletAddress) return;
    try { await navigator.clipboard.writeText(walletAddress); toast.success("Address copied"); }
    catch { toast.error("Copy failed"); }
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!screenshot) return toast.error("Please attach a payment screenshot");
    setSubmitting(true);
    const n = parseFloat(amount);
    const r = await createDeposit(n, screenshot, tx, note);
    setSubmitting(false);
    if (!r.ok) return toast.error(r.msg);
    toast.success(r.msg);
    setAmount(""); setTx(""); setNote(""); setScreenshot(null); setPreview("");
    if (fileRef.current) fileRef.current.value = "";
  };

  return (
    <div className="min-h-screen flex flex-col bg-background text-foreground pb-20 md:pb-0">
      <SiteHeader />
      <main className="mx-auto w-full max-w-5xl flex-1 px-3 py-4 sm:px-6 sm:py-10">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Deposit USDT</h1>
            <p className="text-sm text-muted-foreground">Send USDT (TRC20) and upload your payment screenshot for verification.</p>
          </div>
          <div className="rounded-xl border border-border/60 bg-card/60 px-4 py-3">
            <div className="text-xs text-muted-foreground">Current balance</div>
            <div className="font-mono text-2xl font-bold">${wallet.cashUSDT.toFixed(2)}</div>
          </div>
        </div>

        <div className="mt-4 rounded-xl border border-amber-500/30 bg-amber-500/5 px-4 py-3 text-sm">
          <span className="font-semibold text-amber-400">VIP recharge rewards:</span>{" "}
          <span className="text-muted-foreground">Unlock one-time bonuses as you recharge. </span>
          <Link to="/recharge-activity" className="font-semibold text-primary underline">View activity</Link>
        </div>

        {user.kyc.status !== "approved" && (
          <div className="mt-4 flex items-start gap-2 rounded-md border border-amber-500/40 bg-amber-500/10 p-3 text-sm text-amber-400">
            <Clock className="h-4 w-4 mt-0.5" />
            <div>
              {user.kyc.status === "rejected"
                ? <>Your KYC was rejected{user.kyc.reason ? <>: <span className="font-semibold">{user.kyc.reason}</span></> : ""}. </>
                : user.kyc.status === "pending"
                  ? "Your KYC is under review. "
                  : "KYC verification is required before you can deposit. "}
              <Link to="/kyc" className="font-semibold underline">{user.kyc.status === "rejected" ? "Resubmit" : "Complete KYC"}</Link>
            </div>
          </div>
        )}


        <div className="mt-6 grid gap-6 lg:grid-cols-2">
          {/* Wallet address */}
          <section className="rounded-xl border border-border/60 bg-card/60 p-5">
            <div className="flex items-center gap-2">
              <Wallet className="h-5 w-5 text-primary" />
              <h2 className="font-semibold">Send USDT (TRC20) to</h2>
            </div>
            {walletAddress ? (
              <>
                <div className="mt-3 flex items-stretch gap-2">
                  <code className="flex-1 truncate rounded-md border border-border bg-background px-3 py-2 font-mono text-sm">{walletAddress}</code>
                  <Button type="button" variant="outline" onClick={copyAddr}><Copy className="mr-1 h-4 w-4" />Copy</Button>
                </div>
                <ul className="mt-4 list-disc space-y-1 pl-5 text-xs text-muted-foreground">
                  <li>Network: <span className="font-semibold text-foreground">TRON (TRC20)</span> only. Other networks will be lost.</li>
                  <li>After sending, fill the form on the right with the amount and a screenshot.</li>
                  <li>Your balance updates after admin verification (usually within a few hours).</li>
                </ul>
              </>
            ) : (
              <p className="mt-4 rounded-md border border-dashed border-border bg-muted/30 p-4 text-sm text-muted-foreground">
                Deposits are not configured yet. Please check back later or contact support.
              </p>
            )}
          </section>

          {/* Submit deposit */}
          <section className="rounded-xl border border-border/60 bg-card/60 p-5">
            <h2 className="font-semibold">Submit a deposit request</h2>
            <form onSubmit={submit} className="mt-4 space-y-4">
              <div>
                <Label>Amount (USDT)</Label>
                <Input type="number" min="0" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="100" required />
              </div>
              <div>
                <Label>Transaction hash (optional)</Label>
                <Input value={tx} onChange={(e) => setTx(e.target.value)} placeholder="TRC20 TxID" />
              </div>
              <div>
                <Label>Payment screenshot</Label>
                <input ref={fileRef} type="file" accept="image/*" onChange={(e) => onFile(e.target.files?.[0] || null)} className="mt-1 block w-full text-sm file:mr-3 file:rounded-md file:border file:border-border file:bg-muted file:px-3 file:py-1.5 file:text-sm file:font-medium hover:file:bg-muted/70" />
                {preview && (
                  <img src={preview} alt="Payment screenshot preview" className="mt-3 max-h-48 rounded-md border border-border object-contain" />
                )}
              </div>
              <div>
                <Label>Note (optional)</Label>
                <Textarea rows={2} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Anything you want admin to know" />
              </div>
              <Button type="submit" disabled={submitting || !walletAddress || !screenshot || user.kyc.status !== "approved"} className="w-full bg-primary text-primary-foreground">
                <Upload className="mr-2 h-4 w-4" />Submit for verification
              </Button>

            </form>
          </section>
        </div>

        {/* History */}
        <section className="mt-8 rounded-xl border border-border/60 bg-card/60">
          <div className="border-b border-border/60 px-4 py-3 text-sm font-semibold">Your deposit requests</div>
          {myDeposits.length === 0 ? (
            <div className="px-4 py-10 text-center text-sm text-muted-foreground">No deposits yet.</div>
          ) : (
            <ul className="divide-y divide-border/60">
              {myDeposits.map((d) => (
                <li key={d.id} className="flex flex-wrap items-center gap-4 px-4 py-3 text-sm">
                  <StatusBadge status={d.status} />
                  <div className="font-mono">${d.amount.toFixed(2)}</div>
                  <div className="text-xs text-muted-foreground">{new Date(d.createdAt).toLocaleString()}</div>
                  {d.txHash && <div className="font-mono text-xs text-muted-foreground truncate max-w-[200px]">{d.txHash}</div>}
                  <a href={d.screenshot} target="_blank" rel="noreferrer" className="text-xs text-primary underline">View screenshot</a>
                  {d.status === "rejected" && d.rejectReason && (
                    <div className="text-xs text-destructive">Reason: {d.rejectReason}</div>
                  )}
                  {d.status === "pending" && (
                    <Button size="sm" variant="ghost" className="ml-auto text-destructive" onClick={async () => {
                      const r = await cancelMyDeposit(d.id);
                      if (!r.ok) return toast.error(r.msg);
                      toast.success(r.msg);
                    }}>Cancel</Button>
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
  if (status === "approved") return <span className="inline-flex items-center gap-1 rounded bg-primary/15 px-2 py-0.5 text-xs font-semibold text-primary"><CheckCircle2 className="h-3 w-3" />Approved</span>;
  if (status === "rejected") return <span className="inline-flex items-center gap-1 rounded bg-destructive/15 px-2 py-0.5 text-xs font-semibold text-destructive"><XCircle className="h-3 w-3" />Rejected</span>;
  return <span className="inline-flex items-center gap-1 rounded bg-muted px-2 py-0.5 text-xs font-semibold"><Clock className="h-3 w-3" />Pending</span>;
}
