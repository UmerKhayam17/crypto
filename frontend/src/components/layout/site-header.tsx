import { Link, useRouterState, useNavigate } from "@tanstack/react-router";
import {
  TrendingUp,
  User as UserIcon,
  ShieldCheck,
  Wallet,
  BarChart3,
  LogOut,
  CheckCircle2,
  Clock,
  XCircle,
  AlertCircle,
  Shield,
  ArrowDownToLine,
  House,
  ChartCandlestick,
  BadgeDollarSign,
  CircleUserRound,
  MessageSquareText,
  Crown,
} from "lucide-react";
import { useStore } from "@/context/store";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/theme-toggle";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const NAV = [
  { to: "/", label: "Home" },
  { to: "/markets", label: "Markets" },
  { to: "/trade", label: "Trade" },
];

function KycPill({ status }: { status: "none" | "pending" | "approved" | "rejected" }) {
  const cfg = {
    none: { Icon: AlertCircle, text: "KYC required", cls: "text-amber-400" },
    pending: { Icon: Clock, text: "KYC pending", cls: "text-amber-400" },
    approved: { Icon: CheckCircle2, text: "Verified", cls: "text-primary" },
    rejected: { Icon: XCircle, text: "KYC rejected", cls: "text-destructive" },
  }[status];
  return (
    <span className={`inline-flex items-center gap-1 text-[11px] ${cfg.cls}`}>
      <cfg.Icon className="h-3 w-3" />{cfg.text}
    </span>
  );
}

export function SiteHeader() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const { user, isStaffOrAdmin, isAdmin, staffMe, logout } = useStore();
  const navigate = useNavigate();

  const initials = user
    ? `${user.fname?.[0] ?? ""}${user.lname?.[0] ?? ""}`.toUpperCase() || "U"
    : isStaffOrAdmin
      ? (isAdmin ? "A" : staffMe?.name?.[0]?.toUpperCase() ?? "S")
      : "";
  const profilePath = user ? "/profile" : isStaffOrAdmin ? "/admin" : "/login";
  const mobileTabs = [
    { to: "/", label: "Home", Icon: House, active: pathname === "/" },
    { to: "/markets", label: "Market", Icon: ChartCandlestick, active: pathname === "/markets" },
    { to: "/trade", label: "Trades", Icon: BadgeDollarSign, active: pathname === "/trade" || pathname === "/portfolio" },
    { to: profilePath, label: "Profile", Icon: CircleUserRound, active: pathname === profilePath || pathname === "/recharge-activity" || pathname === "/deposit" || pathname === "/withdraw" || pathname === "/kyc" || (profilePath === "/admin" && pathname.startsWith("/admin")) },
    { to: "/support", label: "Support", Icon: MessageSquareText, active: pathname === "/support" },
  ];

  return (
    <>
      <header className="sticky top-0 z-40 border-b border-border/60 bg-background/80 backdrop-blur-xl">
        <div className="mx-auto flex h-14 max-w-7xl items-center justify-between px-3 sm:h-16 sm:px-6">
        <Link to="/" className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg sm:h-9 sm:w-9" style={{ background: "var(--gradient-emerald)" }}>
            <TrendingUp className="h-4 w-4 text-primary-foreground sm:h-5 sm:w-5" />
          </div>
          <span className="text-base font-bold tracking-tight sm:text-lg">
            Nova<span className="text-primary">Trade</span>
          </span>
        </Link>

        <nav className="hidden items-center gap-1 md:flex">
          {NAV.map((n) => (
            <Link
              key={n.to}
              to={n.to}
              className={`rounded-md px-3 py-2 text-sm font-medium transition-colors hover:text-foreground ${
                pathname === n.to ? "text-foreground" : "text-muted-foreground"
              }`}
            >
              {n.label}
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-2">
          <ThemeToggle />
          {user ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="group flex items-center gap-2 rounded-full border border-border/60 bg-card/60 py-1 pl-1 pr-1 sm:pr-3 hover:bg-card transition-colors">
                  <span className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/15 text-xs font-bold text-primary">
                    {initials}
                  </span>
                  <span className="hidden text-left md:block lg:block">
                    <span className="block text-xs font-semibold leading-tight">{user.fname}</span>
                    <KycPill status={user.kyc.status} />
                  </span>
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-60">
                <DropdownMenuLabel className="flex flex-col">
                  <span className="text-sm font-semibold">{user.name}</span>
                  <span className="truncate text-xs font-normal text-muted-foreground">{user.email}</span>
                  <span className="mt-1"><KycPill status={user.kyc.status} /></span>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild>
                  <Link to="/profile" className="flex items-center gap-2"><UserIcon className="h-4 w-4" />My profile</Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link to="/kyc" className="flex items-center gap-2"><ShieldCheck className="h-4 w-4" />KYC verification</Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link to="/deposit" className="flex items-center gap-2"><Wallet className="h-4 w-4" />Deposit funds</Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link to="/recharge-activity" className="flex items-center gap-2"><Crown className="h-4 w-4" />Recharge activity</Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link to="/withdraw" className="flex items-center gap-2"><ArrowDownToLine className="h-4 w-4" />Withdraw funds</Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link to="/portfolio" className="flex items-center gap-2"><BarChart3 className="h-4 w-4" />Trade history</Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link to="/support" className="flex items-center gap-2"><MessageSquareText className="h-4 w-4" />Customer support</Link>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => { logout(); navigate({ to: "/" }); }} className="text-destructive focus:text-destructive">
                  <LogOut className="mr-2 h-4 w-4" />Sign out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : isStaffOrAdmin ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="group flex items-center gap-2 rounded-full border border-border/60 bg-card/60 py-1 pl-1 pr-1 sm:pr-3 hover:bg-card transition-colors">
                  <span className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/15 text-xs font-bold text-primary">
                    {initials}
                  </span>
                  <span className="hidden text-left md:block">
                    <span className="block text-xs font-semibold leading-tight">{isAdmin ? "Administrator" : staffMe?.name ?? "Staff"}</span>
                    <span className="text-[11px] text-primary">{isAdmin ? "Admin" : "Staff"}</span>
                  </span>
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel>{isAdmin ? "Administrator" : staffMe?.name ?? "Staff"}</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild>
                  <Link to="/admin" className="flex items-center gap-2"><Shield className="h-4 w-4" />Admin panel</Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link to="/support" className="flex items-center gap-2"><MessageSquareText className="h-4 w-4" />Customer support</Link>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => { logout(); navigate({ to: "/" }); }} className="text-destructive focus:text-destructive">
                  <LogOut className="mr-2 h-4 w-4" />Sign out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            <>
              <Button variant="ghost" size="sm" asChild>
                <Link to="/login">Log in</Link>
              </Button>
              <Button size="sm" asChild className="bg-primary text-primary-foreground hover:opacity-90">
                <Link to="/register">Get started</Link>
              </Button>
            </>
          )}
        </div>
      </div>
      </header>

      <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-border/60 bg-background/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-xl md:hidden">
        <div className="grid grid-cols-5 px-1 py-1.5">
          {mobileTabs.map(({ to, label, Icon, active }) => (
            <Link
              key={`${to}-${label}`}
              to={to}
              className={`flex flex-col items-center gap-0.5 rounded-lg px-1 py-1.5 text-[10px] font-medium transition-colors ${
                active ? "text-primary" : "text-muted-foreground"
              }`}
            >
              <Icon className={`h-5 w-5 ${active ? "text-primary" : "text-muted-foreground"}`} />
              <span>{label}</span>
            </Link>
          ))}
        </div>
      </nav>
    </>
  );
}
