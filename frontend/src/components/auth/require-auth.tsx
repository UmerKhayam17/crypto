import { useEffect, type ReactNode } from "react";
import { useNavigate } from "@tanstack/react-router";
import { Loader2 } from "lucide-react";
import { useStore, type Role } from "@/context/store";
import { homePathForRole } from "@/lib/route-auth";

type RequireAuthProps = {
  roles?: Role[];
  children: ReactNode;
};

export function RequireAuth({ roles, children }: RequireAuthProps) {
  const { session, authReady } = useStore();
  const navigate = useNavigate();

  useEffect(() => {
    if (!authReady) return;
    if (!session) {
      navigate({ to: "/login", replace: true });
      return;
    }
    if (roles && !roles.includes(session.role)) {
      navigate({ to: homePathForRole(session.role), replace: true });
    }
  }, [authReady, session, roles, navigate]);

  if (!authReady) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!session) return null;
  if (roles && !roles.includes(session.role)) return null;

  return <>{children}</>;
}
