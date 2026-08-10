import { SiteHeader } from "@/components/layout/site-header";
import { SiteFooter } from "@/components/layout/site-footer";
import { RequireAuth } from "@/components/auth/require-auth";
import { SupportInbox } from "@/components/support-inbox";

export default function SupportPage() {
  return (
    <RequireAuth roles={["user", "admin", "staff"]}>
      <div className="min-h-screen flex flex-col bg-background text-foreground pb-20 md:pb-0">
        <SiteHeader />
        <main className="mx-auto w-full max-w-7xl flex-1 px-3 py-4 sm:px-6 sm:py-6">
          <SupportInbox />
        </main>
        <SiteFooter />
      </div>
    </RequireAuth>
  );
}
