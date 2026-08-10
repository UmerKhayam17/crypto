import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { SiteHeader } from "@/components/layout/site-header";
import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/ui/password-input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { useStore } from "@/context/store";
import { homePathForRole } from "@/lib/route-auth";
import { COUNTRIES } from "@/constants/countries";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

export const Route = createFileRoute("/register")({
  head: () => ({ meta: [
    { title: "Sign up — NovaTrade" },
    { name: "description", content: "Create your NovaTrade account to start trading. Complete KYC to deposit and trade." },
  ] }),
  component: RegisterPage,
});

function RegisterPage() {
  const { register, session, authReady } = useStore();
  const nav = useNavigate();
  const [fname, setF] = useState("");
  const [lname, setL] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [country, setCountry] = useState("");
  const [pw, setPw] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!authReady || !session) return;
    nav({ to: homePathForRole(session.role) });
  }, [authReady, session, nav]);

  const dialing = COUNTRIES.find((c) => c.code === country)?.dial ?? "";

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const r = await register({ fname, lname, email, phone: dialing ? `${dialing} ${phone}` : phone, country, password: pw });
      if (!r.ok) return toast.error(r.msg);
      toast.success("Account created — please complete KYC to start trading");
      nav({ to: "/kyc" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-background text-foreground pb-20 md:pb-0">
      <SiteHeader />
      <main className="mx-auto flex w-full max-w-lg flex-1 items-center px-4 py-12">
        <form onSubmit={submit} className="w-full rounded-2xl border border-border/60 bg-card/60 p-8" style={{ boxShadow: "var(--shadow-elegant)" }}>
          <h1 className="text-2xl font-bold">Create your account</h1>
          <p className="mt-1 text-sm text-muted-foreground">After signup you'll be asked to complete KYC verification.</p>
          <div className="mt-6 grid gap-4 sm:grid-cols-2">
            <div>
              <Label>First name</Label>
              <Input value={fname} onChange={(e) => setF(e.target.value)} placeholder="Jane" required />
            </div>
            <div>
              <Label>Last name</Label>
              <Input value={lname} onChange={(e) => setL(e.target.value)} placeholder="Trader" required />
            </div>
            <div className="sm:col-span-2">
              <Label>Email</Label>
              <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" required />
            </div>
            <div className="sm:col-span-2">
              <Label>Country</Label>
              <select
                value={country}
                onChange={(e) => setCountry(e.target.value)}
                required
                className="mt-1 flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              >
                <option value="">— Select country —</option>
                {COUNTRIES.map((c) => (
                  <option key={c.code} value={c.code}>{c.name} ({c.dial})</option>
                ))}
              </select>
            </div>
            <div className="sm:col-span-2">
              <Label>Phone number</Label>
              <div className="flex gap-2">
                <span className="inline-flex h-9 items-center rounded-md border border-input bg-muted/40 px-3 text-sm text-muted-foreground min-w-[60px] justify-center">
                  {dialing || "+—"}
                </span>
                <Input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="3001234567" required className="flex-1" />
              </div>
            </div>
            <div className="sm:col-span-2">
              <Label>Password</Label>
              <PasswordInput value={pw} onChange={(e) => setPw(e.target.value)} placeholder="At least 6 characters" required />
            </div>
            <Button type="submit" className="sm:col-span-2 w-full bg-primary text-primary-foreground hover:opacity-90" disabled={loading}>
              {loading ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Creating account…</> : "Create account"}
            </Button>
          </div>
          <p className="mt-4 text-center text-sm text-muted-foreground">
            Already have an account? <Link to="/login" className="text-primary hover:underline">Log in</Link>
          </p>
        </form>
      </main>
    </div>
  );
}
