import { Link, useNavigate } from "react-router-dom";
import { useRef, useState } from "react";
import { toast } from "sonner";
import { ShieldCheck, Upload, CheckCircle2, XCircle, Clock, IdCard } from "lucide-react";
import { SiteHeader } from "@/components/layout/site-header";
import { SiteFooter } from "@/components/layout/site-footer";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { useStore } from "@/context/store";
import { fileToDataUrl } from "@/services/kyc";
import { RequireAuth } from "@/components/auth/require-auth";

export default function KycPage() {
  return (
    <RequireAuth roles={["user"]}>
      <KycContent />
    </RequireAuth>
  );
}

function KycContent() {
  const { user, submitKyc } = useStore();
  const nav = useNavigate();
  const [front, setFront] = useState("");
  const [back, setBack] = useState("");
  const [frontFile, setFrontFile] = useState<File | null>(null);
  const [backFile, setBackFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);

  if (!user) return null;

  const status = user.kyc.status;

  const onImage = async (which: "front" | "back", file: File | null) => {
    if (!file) return;
    try {
      const url = await fileToDataUrl(file);
      if (which === "front") {
        setFront(url);
        setFrontFile(file);
      } else {
        setBack(url);
        setBackFile(file);
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not load image");
    }
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    const r = await submitKyc(frontFile, backFile);
    setBusy(false);
    if (!r.ok) return toast.error(r.msg);
    toast.success(r.msg);
    nav("/profile");
  };

  return (
    <Shell>
      <div className="mx-auto max-w-3xl">
        <div className="flex items-center gap-3">
          <ShieldCheck className="h-7 w-7 text-primary" />
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Identity verification (KYC)</h1>
            <p className="text-sm text-muted-foreground">Required before you can deposit or trade.</p>
          </div>
        </div>

        <StatusBanner status={status} reason={user.kyc.reason} />

        {status === "approved" ? (
          <div className="mt-6 rounded-xl border border-border/60 bg-card/60 p-6">
            <p className="text-sm">You're verified. Ready to deposit and trade.</p>
            <div className="mt-4 flex gap-2">
              <Button asChild className="bg-primary text-primary-foreground"><Link to="/deposit">Deposit</Link></Button>
              <Button asChild variant="outline"><Link to="/trade">Trade</Link></Button>
            </div>
          </div>
        ) : status === "pending" ? (
          <div className="mt-6 rounded-xl border border-border/60 bg-card/60 p-6">
            <p className="text-sm">Your submission is being reviewed. You'll get access as soon as it's approved.</p>
          </div>
        ) : (
          <form onSubmit={submit} className="mt-6 grid gap-4 rounded-xl border border-border/60 bg-card/60 p-5 md:grid-cols-2">
            <ImageUploadCard label="CNIC — Front" dataUrl={front} onFile={(f) => onImage("front", f)} />
            <ImageUploadCard label="CNIC — Back" dataUrl={back} onFile={(f) => onImage("back", f)} />
            <div className="md:col-span-2">
              <Button type="submit" disabled={busy || !front || !back} className="w-full bg-primary text-primary-foreground">
                <Upload className="mr-2 h-4 w-4" />Submit for verification
              </Button>
              <p className="mt-2 text-[11px] text-muted-foreground">
                Upload clear front and back CNIC photos (JPG, PNG, or WebP · max 10 MB each). Images are compressed automatically.
              </p>
            </div>
          </form>
        )}
      </div>
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex flex-col bg-background text-foreground pb-20 md:pb-0">
      <SiteHeader />
      <main className="mx-auto w-full max-w-5xl flex-1 px-3 py-4 sm:px-6 sm:py-10">{children}</main>
      <SiteFooter />
    </div>
  );
}

function StatusBanner({ status, reason }: { status: "none" | "pending" | "approved" | "rejected"; reason?: string }) {
  if (status === "none") return null;
  const cfg = {
    pending: { Icon: Clock, cls: "bg-amber-500/15 text-amber-400 ring-amber-500/30", label: "Under review" },
    approved: { Icon: CheckCircle2, cls: "bg-emerald-500/15 text-emerald-400 ring-emerald-500/30", label: "Verified" },
    rejected: { Icon: XCircle, cls: "bg-destructive/15 text-destructive ring-destructive/30", label: "Rejected" },
  }[status];
  return (
    <div className={`mt-5 flex items-start gap-3 rounded-xl px-4 py-3 ring-1 ${cfg.cls}`}>
      <cfg.Icon className="h-5 w-5 mt-0.5" />
      <div className="text-sm">
        <div className="font-semibold">{cfg.label}</div>
        {reason && status === "rejected" && <div className="mt-0.5 text-xs">Reason: {reason}. Please resubmit below.</div>}
      </div>
    </div>
  );
}

function ImageUploadCard({ label, dataUrl, onFile }: { label: string; dataUrl: string; onFile: (f: File | null) => void }) {
  const ref = useRef<HTMLInputElement>(null);
  return (
    <div className="rounded-lg border border-dashed border-border bg-background/60 p-3">
      <Label className="text-xs flex items-center gap-1.5"><IdCard className="h-3.5 w-3.5 text-primary" />{label}</Label>
      <div
        onClick={() => ref.current?.click()}
        className="mt-2 grid h-40 cursor-pointer place-items-center overflow-hidden rounded-md border border-border bg-muted/30 hover:bg-muted/50"
      >
        {dataUrl ? (
          <img src={dataUrl} alt={label} className="h-full w-full object-cover" />
        ) : (
          <div className="text-center text-xs text-muted-foreground">
            <Upload className="mx-auto h-5 w-5" />
            <div className="mt-1">Click to upload</div>
            <div className="mt-0.5 text-[10px]">JPG, PNG, WebP · max 10 MB</div>
          </div>
        )}
      </div>
      <input ref={ref} type="file" accept="image/jpeg,image/png,image/webp,image/*" className="hidden" onChange={(e) => onFile(e.target.files?.[0] || null)} />
    </div>
  );
}
