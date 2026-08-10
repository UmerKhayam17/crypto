import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { SiteHeader } from "@/components/layout/site-header";
import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/ui/password-input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { useStore } from "@/context/store";
import { homePathForRole } from "@/lib/route-auth";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

export const Route = createFileRoute("/login")({
  head: () => ({ meta: [{ title: "Log in — NovaTrade" }, { name: "description", content: "Log in to your NovaTrade account." }] }),
  component: LoginPage,
});

function LoginPage() {
  const { login, session, authReady } = useStore();
  const nav = useNavigate();
  const [email, setEmail] = useState("");
  const [pw, setPw] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!authReady || !session) return;
    nav({ to: homePathForRole(session.role) });
  }, [authReady, session, nav]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const r = await login(email, pw);
      if (!r.ok) return toast.error(r.msg);
      toast.success(r.msg);
      nav({ to: r.role ? homePathForRole(r.role) : "/portfolio" });
    } finally {
      setLoading(false);
    }
  };

  if (!authReady) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-background text-foreground pb-20 md:pb-0">
      <SiteHeader />
      <main className="mx-auto flex w-full max-w-md flex-1 items-center px-4 py-12">
        <form onSubmit={submit} className="w-full rounded-2xl border border-border/60 bg-card/60 p-8" style={{ boxShadow: "var(--shadow-elegant)" }}>
          <h1 className="text-2xl font-bold">Welcome back</h1>
          <p className="mt-1 text-sm text-muted-foreground">Log in with your email and password.</p>
          <div className="mt-6 space-y-4">
            <div>
              <Label>Email</Label>
              <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" required disabled={loading} />
            </div>
            <div>
              <Label>Password</Label>
              <PasswordInput value={pw} onChange={(e) => setPw(e.target.value)} placeholder="••••••••" required disabled={loading} />
            </div>
            <Button type="submit" className="w-full bg-primary text-primary-foreground hover:opacity-90" disabled={loading}>
              {loading ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Logging in…</> : "Log in"}
            </Button>
          </div>
          <p className="mt-4 text-center text-sm text-muted-foreground">
            No account? <Link to="/register" className="text-primary hover:underline">Sign up</Link>
          </p>
        </form>
      </main>
    </div>
  );
}