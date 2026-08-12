import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useEffect, useState, useTransition } from "react";
import { toast } from "sonner";
import {
  Shield, LogOut, LayoutDashboard, Users, ClipboardList, History, Wallet, Settings,
  CheckCircle2, XCircle, UserCog, Plus, Trash2, KeyRound, Pencil, TrendingUp, DollarSign,
  Activity, FileClock, Eye, Loader2, Clock, ShieldAlert, ShieldCheck, IdCard, ArrowUp, ArrowDown, Percent, ArrowDownToLine, Crown, MessageSquareText,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/ui/password-input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import {
  Sidebar, SidebarContent, SidebarFooter, SidebarGroup, SidebarGroupContent,
  SidebarGroupLabel, SidebarHeader, SidebarMenu, SidebarMenuButton, SidebarMenuItem,
  SidebarProvider, SidebarTrigger, SidebarInset,
} from "@/components/ui/sidebar";
import { useStore, type Deposit, type Withdrawal, type User, type ForceOutcome, type BinaryTrade, type Staff } from "@/context/store";
import { RequireAuth } from "@/components/auth/require-auth";
import { ThemeToggle } from "@/components/theme-toggle";
import { formatPrice } from "@/services/market-data";
import { AdminTable, type AdminColumn } from "@/components/admin-table";
import { COUNTRIES } from "@/constants/countries";
import { getApiUrl } from "@/lib/api-url";
import { mediaUrl } from "@/lib/media-url";
import { apiListVipClaims, type VipClaim } from "@/services/vip";
import { SupportInbox } from "@/components/support-inbox";
import { apiListSupportThreads } from "@/services/support";
import { TRADE_DURATIONS, profitPercentForDuration } from "@/constants/roles";
import { TradeResultViewDialog, TradeViewButton } from "@/components/trade-result-view";

function getImageUrl(imagePath: string | undefined): string {
  if (!imagePath) return "";
  let url = imagePath;
  if (!(imagePath.startsWith("data:") || imagePath.startsWith("http://") || imagePath.startsWith("https://"))) {
    url = `${getApiUrl()}${imagePath.startsWith("/") ? "" : "/"}${imagePath}`;
  }
  return mediaUrl(url);
}

const VALID_SECTIONS = ["overview", "users", "kyc", "trades", "deposits", "withdrawals", "vip", "support", "staff", "settings", "audit"] as const;
type Section = (typeof VALID_SECTIONS)[number];

export default function AdminPage() {
  return (
    <RequireAuth roles={["admin", "staff"]}>
      <AdminDashboard />
    </RequireAuth>
  );
}

function AdminDashboard() {
  const {
    isAdmin, staffMe,
    allUsers, managedUsers, managedTrades, managedDeposits, managedWithdrawals,
    allTrades, walletsByUser, assets, allDeposits, allWithdrawals, walletAddress, allStaff, payoutPercent, spotFeePercent,
    adminSuspendUser, adminAdjustBalance, adminSetBalance, adminDeleteUser, adminUpdateUser,
    adminSetForceOutcome, adminPlanTrade, adminForceCloseTrade, adminDeleteTrade, adminClearTrades,
    adminApproveKyc, adminRejectKyc,
    adminCreateStaff, adminUpdateStaff, adminDeleteStaff, loadStaff, loadUsers, adminAssignStaff,
    adminSetWalletAddress, adminSetPayoutPercent, adminSetSpotFeePercent, adminApproveDeposit, adminRejectDeposit,
    adminApproveWithdrawal, adminRejectWithdrawal,
    logout, auditLog, auditLogFor, adminClearAuditLog,
    supportUnread,
  } = useStore();
  const nav = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const rawSection = searchParams.get("section") ?? "overview";
  const section: Section = VALID_SECTIONS.includes(rawSection as Section)
    ? (rawSection as Section)
    : "overview";
  const [userStatus, setUserStatus] = useState<string>("all");
  const [tradeStatus, setTradeStatus] = useState<string>(() => {
    if (typeof window === "undefined") return "all";
    const v = window.localStorage.getItem("evios-trader.admin.tradeStatus");
    return v === "active" || v === "won" || v === "lost" || v === "all" ? v : "all";
  });
  const [depositStatus, setDepositStatus] = useState<string>("pending");
  const [withdrawalStatus, setWithdrawalStatus] = useState<string>("pending");
  const [tradeUserFilter, setTradeUserFilter] = useState<string>("all");
  const [walletDraft, setWalletDraft] = useState(walletAddress);
  const [payoutDraft, setPayoutDraft] = useState(String(payoutPercent));
  const [spotFeeDraft, setSpotFeeDraft] = useState(String(spotFeePercent));
  const emptyStaffForm = () => ({
    fname: "", lname: "", email: "", phone: "", password: "", confirmPassword: "",
  });
  const [addStaffOpen, setAddStaffOpen] = useState(false);
  const [staffForm, setStaffForm] = useState(emptyStaffForm());
  const [staffSubmitting, setStaffSubmitting] = useState(false);
  const [editStaff, setEditStaff] = useState<Staff | null>(null);
  const [editStaffForm, setEditStaffForm] = useState({
    fname: "", lname: "", email: "", phone: "", password: "", confirmPassword: "",
  });
  const [editStaffSubmitting, setEditStaffSubmitting] = useState(false);
  const [editUser, setEditUser] = useState<{ id: string; fname: string; lname: string; email: string; phone: string; country: string } | null>(null);
  const [rejectTarget, setRejectTarget] = useState<Deposit | null>(null);
  const [rejectWithdrawTarget, setRejectWithdrawTarget] = useState<Withdrawal | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [detailsTarget, setDetailsTarget] = useState<Deposit | null>(null);
  const [kycReject, setKycReject] = useState<User | null>(null);
  const [kycReason, setKycReason] = useState("");
  const [kycView, setKycView] = useState<User | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [vipClaims, setVipClaims] = useState<VipClaim[]>([]);
  const [vipLoading, setVipLoading] = useState(false);
  const [openSupportCount, setOpenSupportCount] = useState(0);
  const [viewTrade, setViewTrade] = useState<BinaryTrade | null>(null);
  const [, startTransition] = useTransition();

  // Persist trade filter across refreshes
  useEffect(() => {
    try { window.localStorage.setItem("evios-trader.admin.tradeStatus", tradeStatus); } catch {}
  }, [tradeStatus]);

  useEffect(() => { setWalletDraft(walletAddress); }, [walletAddress]);
  useEffect(() => { setPayoutDraft(String(payoutPercent)); }, [payoutPercent]);
  useEffect(() => { setSpotFeeDraft(String(spotFeePercent)); }, [spotFeePercent]);

  useEffect(() => {
    loadUsers();
  }, [loadUsers]);

  useEffect(() => {
    let cancelled = false;
    apiListSupportThreads()
      .then((res) => {
        if (cancelled) return;
        const count =
          typeof res.openCount === "number"
            ? res.openCount
            : (res.threads ?? []).filter((t) => t.status === "open").length;
        setOpenSupportCount(count);
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [section]);

  useEffect(() => {
    if (section !== "vip") return;
    let cancelled = false;
    setVipLoading(true);
    apiListVipClaims()
      .then((res) => {
        if (!cancelled) setVipClaims(res.claims ?? []);
      })
      .catch((e) => {
        if (!cancelled) toast.error(e instanceof Error ? e.message : "Could not load VIP claims");
      })
      .finally(() => {
        if (!cancelled) setVipLoading(false);
      });
    return () => { cancelled = true; };
  }, [section]);

  useEffect(() => {
    if (!isAdmin || (section !== "staff" && section !== "users")) return;
    loadStaff().then((r) => {
      if (!r.ok && r.msg) toast.error(r.msg);
    });
  }, [isAdmin, section, loadStaff]);

  // Re-render every second while viewing live trades so expired-but-unsettled
  // rows drop out of the "Active (Live)" view immediately.
  const [, forceTick] = useState(0);
  useEffect(() => {
    if (section !== "trades" || tradeStatus !== "active") return;
    const id = window.setInterval(() => forceTick((n) => n + 1), 1000);
    return () => window.clearInterval(id);
  }, [section, tradeStatus]);


  const runAction = (id: string, fn: () => void | Promise<void>, successMsg?: string) => {
    setBusyId(id);
    startTransition(async () => {
      try {
        await fn();
        if (successMsg) toast.success(successMsg);
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Action failed");
      } finally {
        setTimeout(() => setBusyId((cur) => (cur === id ? null : cur)), 200);
      }
    });
  };

  const sectionLabels: Record<Section, string> = {
    overview: "Overview", users: "Users", kyc: "KYC review", trades: "Trades",
    deposits: "Deposits", withdrawals: "Withdrawals", vip: "VIP rewards", support: "Support",
    staff: "Staff", settings: "Settings", audit: "Audit log",
  };

  const panelUsers = isAdmin ? allUsers : managedUsers;
  const panelTrades = isAdmin ? allTrades : managedTrades;
  const panelDeposits = isAdmin ? allDeposits : managedDeposits;
  const panelWithdrawals = isAdmin ? allWithdrawals : managedWithdrawals;

  const pendingDeposits = panelDeposits.filter((d) => d.status === "pending").length;
  const pendingWithdrawals = panelWithdrawals.filter((w) => w.status === "pending").length;
  const pendingKyc = panelUsers.filter((u) => u.kyc.status === "pending").length;
  const activeTrades = panelTrades.filter((t) => t.status === "active").length;
  const totalCash = panelUsers.reduce((s, u) => s + (walletsByUser[u.id]?.cashUSDT || 0), 0);

  const baseNav = [
    { key: "overview", label: "Overview", icon: LayoutDashboard },
    { key: "users", label: "Users", icon: Users, badge: panelUsers.length },
    { key: "kyc", label: "KYC review", icon: ShieldCheck, badge: pendingKyc },
    { key: "deposits", label: "Deposits", icon: Wallet, badge: pendingDeposits },
    { key: "withdrawals", label: "Withdrawals", icon: ArrowDownToLine, badge: pendingWithdrawals },
    { key: "support", label: "Support", icon: MessageSquareText, badge: Math.max(openSupportCount, supportUnread) },
    { key: "vip", label: "VIP rewards", icon: Crown },
    { key: "trades", label: "Trades", icon: Activity, badge: activeTrades },
  ] as const;
  const adminOnlyNav = [
    { key: "staff", label: "Staff", icon: UserCog, badge: allStaff.length },
    { key: "audit", label: "Audit log", icon: FileClock, badge: auditLog.length },
    { key: "settings", label: "Settings", icon: Settings },
  ] as const;
  const navItems = isAdmin ? [...baseNav, ...adminOnlyNav] : baseNav;
  const allowed = new Set<Section>(navItems.map((n) => n.key as Section));
  const active: Section = allowed.has(section) ? section : "overview";

  const setSection = (next: Section) => {
    setSearchParams({ section: next }, { replace: true });
  };

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full bg-background text-foreground">
        <Sidebar collapsible="icon" className="border-r border-border/60">
          <SidebarHeader className="border-b border-border/60">
            <div className="flex items-center gap-3 px-2 py-3">
              <div className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-gradient-to-br from-primary to-primary/40 shadow-[0_6px_20px_-6px_var(--color-primary)]">
                <Shield className="h-4 w-4 text-primary-foreground" />
              </div>
              <div className="min-w-0 group-data-[collapsible=icon]:hidden">
                <div className="truncate text-sm font-bold leading-tight">Evios Trader</div>
                <div className="truncate text-[10px] uppercase tracking-wider text-muted-foreground">Control Center</div>
              </div>
            </div>
          </SidebarHeader>
          <SidebarContent className="px-1">
            <SidebarGroup>
              <SidebarGroupLabel className="text-[10px] uppercase tracking-widest">Operations</SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>
                  {navItems.map((item) => {
                    const isActive = active === item.key;
                    return (
                      <SidebarMenuItem key={item.key}>
                        <SidebarMenuButton
                          isActive={isActive}
                          onClick={() => setSection(item.key as Section)}
                          tooltip={item.label}
                          className="group/btn rounded-lg transition-all data-[active=true]:bg-gradient-to-r data-[active=true]:from-primary/20 data-[active=true]:to-primary/5 data-[active=true]:text-primary data-[active=true]:shadow-[inset_2px_0_0_0_var(--color-primary)]"
                        >
                          <item.icon className={`h-4 w-4 ${isActive ? "text-primary" : "text-muted-foreground group-hover/btn:text-foreground"}`} />
                          <span>{item.label}</span>
                          {"badge" in item && item.badge != null && item.badge > 0 && (
                            <span className={`ml-auto rounded-full px-1.5 py-0.5 text-[10px] font-mono font-semibold group-data-[collapsible=icon]:hidden ${
                              isActive ? "bg-primary/20 text-primary" : "bg-muted/70 text-muted-foreground"
                            }`}>{item.badge}</span>
                          )}
                        </SidebarMenuButton>
                      </SidebarMenuItem>
                    );
                  })}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          </SidebarContent>
          <SidebarFooter className="border-t border-border/60">
            <div className="flex items-center gap-2 rounded-lg bg-muted/40 px-2 py-2 group-data-[collapsible=icon]:hidden">
              <div className={`grid h-8 w-8 shrink-0 place-items-center rounded-md text-xs font-bold ${isAdmin ? "bg-primary/20 text-primary" : "bg-accent/60 text-foreground"}`}>
                {isAdmin ? "A" : (staffMe?.name?.[0]?.toUpperCase() ?? "S")}
              </div>
              <div className="min-w-0 flex-1">
                <div className="truncate text-xs font-semibold">{isAdmin ? "Administrator" : staffMe?.name}</div>
                <div className="truncate text-[10px] uppercase tracking-wide text-muted-foreground">{isAdmin ? "Full access" : "Staff"}</div>
              </div>
            </div>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton asChild tooltip="View site"><Link to="/"><LayoutDashboard className="h-4 w-4" /><span>View site</span></Link></SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton onClick={() => { logout(); nav("/"); }} tooltip="Sign out" className="text-destructive hover:bg-destructive/10 hover:text-destructive">
                  <LogOut className="h-4 w-4" /><span>Sign out</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarFooter>
        </Sidebar>

        <SidebarInset className="flex-1 min-w-0">
          <header className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b border-border/60 bg-background/70 px-3 backdrop-blur-xl sm:px-6">
            <SidebarTrigger />
            <div className="h-5 w-px bg-border/60" />
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">{isAdmin ? "Admin" : "Staff"}</span>
              <span className="text-muted-foreground">/</span>
              <span className="font-semibold">{sectionLabels[active]}</span>
            </div>
            <div className="ml-auto flex items-center gap-2">
              <ThemeToggle />
              <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider ${isAdmin ? "bg-primary/15 text-primary ring-1 ring-primary/30" : "bg-accent/40 text-foreground ring-1 ring-border"}`}>
                <Shield className="h-3 w-3" />{isAdmin ? "ADMIN" : `STAFF · ${staffMe?.name ?? ""}`}
              </span>
            </div>
          </header>

          <main className="w-full px-3 py-6 sm:px-6">
            {active === "overview" && (
              <>
                <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">{isAdmin ? "Admin overview" : "Staff overview"}</h1>
                <p className="text-sm text-muted-foreground">Platform health at a glance.</p>
                <div className="mt-6 grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
                  <Stat label="Users" value={String(panelUsers.length)} icon={Users} tone="primary" />
                  <Stat label="Active trades" value={String(activeTrades)} icon={Activity} tone="amber" />
                  <Stat label="Pending KYC" value={String(pendingKyc)} icon={ShieldCheck} tone="violet" />
                  <Stat label="User cash" value={`$${totalCash.toFixed(2)}`} icon={DollarSign} tone="success" />
                </div>
                <div className="mt-6 grid gap-4 lg:grid-cols-2">
                  <QuickCard icon={Wallet} title="Deposit queue" value={pendingDeposits} sub="awaiting verification" onClick={() => setSection("deposits")} />
                  <QuickCard icon={ArrowDownToLine} title="Withdrawal queue" value={pendingWithdrawals} sub="awaiting payout" onClick={() => setSection("withdrawals")} />
                  <QuickCard icon={MessageSquareText} title="Support inbox" value={Math.max(openSupportCount, supportUnread)} sub={supportUnread > 0 ? "new messages" : "customers"} onClick={() => setSection("support")} />
                  <QuickCard icon={TrendingUp} title="Trades total" value={panelTrades.length} sub="placed all-time" onClick={() => setSection("trades")} />
                </div>
              </>
            )}

            {active === "users" && (() => {
              const rows = panelUsers.filter((u) =>
                userStatus === "all" ? true :
                userStatus === "suspended" ? u.suspended :
                userStatus === "kyc-pending" ? u.kyc.status === "pending" :
                userStatus === "kyc-approved" ? u.kyc.status === "approved" :
                !u.suspended);
              const cols: AdminColumn<User>[] = [
                { key: "name", header: "Name", cell: (u) => (
                  <div><div className="font-medium">{u.name}</div><div className="text-xs text-muted-foreground">{u.country} · {u.phone}</div></div>
                ) },
                { key: "email", header: "Email", cell: (u) => <span className="text-muted-foreground break-all">{u.email}</span> },
                ...(isAdmin ? [{
                  key: "staff",
                  header: "Assigned staff",
                  hideOnMobile: true,
                  cell: (u: User) => (
                    <select
                      value={u.assignedStaffId || ""}
                      onChange={async (e) => {
                        const staffId = e.target.value || null;
                        const r = await adminAssignStaff(u.id, staffId);
                        if (r.ok) toast.success(r.msg);
                        else toast.error(r.msg);
                      }}
                      className="h-7 max-w-[10rem] rounded border border-border bg-input px-1.5 text-xs"
                    >
                      <option value="">Unassigned</option>
                      {allStaff.map((s) => (
                        <option key={s.id} value={s.id}>{s.name}</option>
                      ))}
                    </select>
                  ),
                } satisfies AdminColumn<User>] : []),
                { key: "cash", header: "Cash", align: "right", cell: (u) => <span className="font-mono">${(walletsByUser[u.id]?.cashUSDT || 0).toFixed(2)}</span> },
                { key: "kyc", header: "KYC", hideOnMobile: true, cell: (u) => <KycPill status={u.kyc.status} /> },
                { key: "outcome", header: "Trade control", hideOnMobile: true, cell: (u) => (
                  <UserTradeControl
                    user={u}
                    defaultProfitPercent={payoutPercent}
                    onSave={async (mode, profitPct, lossPct) => {
                      const r = await adminSetForceOutcome(u.id, mode, {
                        profitPercent: profitPct,
                        lossPercent: lossPct,
                      });
                      if (!r.ok) toast.error(r.msg);
                      else toast.success(r.msg);
                    }}
                  />
                ) },
                { key: "status", header: "Status", cell: (u) => (
                  <span className={`rounded px-2 py-0.5 text-xs font-semibold ${u.suspended ? "bg-destructive/15 text-destructive" : "bg-primary/15 text-primary"}`}>{u.suspended ? "Suspended" : "Active"}</span>
                ) },
                { key: "actions", header: "Actions", align: "right", cell: (u) => (
                  <div className="flex flex-wrap justify-end gap-1">
                    {isAdmin && (
                      <Button size="sm" variant="outline" onClick={() => setEditUser({ id: u.id, fname: u.fname, lname: u.lname, email: u.email, phone: u.phone, country: u.country })}>
                        <Pencil className="mr-1 h-3 w-3" />Edit
                      </Button>
                    )}
                    <Button size="sm" variant="outline" onClick={async () => {
                      const cur = (walletsByUser[u.id]?.cashUSDT || 0).toFixed(2);
                      const v = prompt(`Set ${u.name}'s balance (USDT):`, cur);
                      if (v == null) return;
                      const n = parseFloat(v);
                      if (!Number.isFinite(n) || n < 0) return toast.error("Invalid amount");
                      const r = await adminSetBalance(u.id, n);
                      if (!r.ok) return toast.error(r.msg);
                      toast.success(`Balance set to $${n.toFixed(2)}`);
                    }}>Set balance</Button>
                    <Button size="sm" variant="outline" onClick={async () => {
                      const v = prompt("Adjust by (USDT):", "0");
                      if (v == null) return;
                      const n = parseFloat(v);
                      if (!Number.isFinite(n)) return toast.error("Invalid amount");
                      const r = await adminAdjustBalance(u.id, n);
                      if (!r.ok) return toast.error(r.msg);
                      toast.success(`Adjusted by ${n}`);
                    }}>Adjust</Button>
                    {isAdmin && (
                      <>
                        <Button size="sm" variant="outline" onClick={async () => {
                          const r = await adminSuspendUser(u.id, !u.suspended);
                          if (!r.ok) return toast.error(r.msg);
                          toast.success(u.suspended ? "Unsuspended" : "Suspended");
                        }}>
                          {u.suspended ? "Unsuspend" : "Suspend"}
                        </Button>
                        <Button size="sm" variant="ghost" className="text-destructive" onClick={async () => {
                          if (!confirm(`Delete ${u.name}?`)) return;
                          const r = await adminDeleteUser(u.id);
                          if (!r.ok) return toast.error(r.msg);
                          toast.success("User deleted");
                        }}>Delete</Button>
                      </>
                    )}
                  </div>
                ) },
              ];
              return (
                <AdminTable
                  title={isAdmin ? "Registered users" : "Your assigned users"}
                  rows={rows}
                  columns={cols}
                  rowKey={(u) => u.id}
                  searchPlaceholder="Search name, email, country…"
                  searchKeys={(u) => `${u.name} ${u.email} ${u.country} ${u.phone}`}
                  filters={[{ key: "status", label: "Status", value: userStatus, onChange: setUserStatus, options: [
                    { value: "all", label: "All" }, { value: "active", label: "Active" }, { value: "suspended", label: "Suspended" },
                    { value: "kyc-pending", label: "KYC pending" }, { value: "kyc-approved", label: "KYC approved" },
                  ] }]}
                  emptyLabel="No users match."
                />
              );
            })()}

            {active === "kyc" && (() => {
              const rows = panelUsers.filter((u) => u.kyc.status !== "none");
              return (
                <div>
                  <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">KYC review</h1>
                  <p className="text-sm text-muted-foreground">Approve or reject identity submissions.</p>
                  {rows.length === 0 ? (
                    <div className="mt-6 rounded-xl border border-border/60 bg-card/60 px-4 py-12 text-center text-sm text-muted-foreground">No KYC submissions yet.</div>
                  ) : (
                    <ul className="mt-6 grid gap-3 sm:grid-cols-2">
                      {rows.map((u) => (
                        <li key={u.id} className="rounded-xl border border-border/60 bg-card/60 p-4">
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <div className="font-semibold">{u.name}</div>
                              <div className="text-xs text-muted-foreground break-all">{u.email}</div>
                              <div className="text-xs text-muted-foreground">{u.phone} · {u.country}</div>
                            </div>
                            <KycPill status={u.kyc.status} />
                          </div>
                          <div className="mt-3 grid grid-cols-2 gap-2">
                            {(["cnicFront", "cnicBack"] as const).map((k) => {
                              const rawSrc = u.kyc[k];
                              const src = getImageUrl(rawSrc);
                              const label = k === "cnicFront" ? "Front" : "Back";
                              return (
                                <div key={k}>
                                  {src ? (
                                    <a href={src} target="_blank" rel="noreferrer">
                                      <img src={src} alt={k} className="h-20 w-full rounded border border-border object-cover" />
                                    </a>
                                  ) : <div className="h-20 rounded border border-dashed border-border" />}
                                  <div className="mt-1 text-[10px] uppercase tracking-wider text-muted-foreground text-center">{label}</div>
                                </div>
                              );
                            })}
                          </div>
                          {u.kyc.reason && <p className="mt-2 text-xs text-destructive">Reason: {u.kyc.reason}</p>}
                          <div className="mt-3 flex flex-wrap gap-2">
                            <Button size="sm" variant="outline" onClick={() => setKycView(u)}><Eye className="mr-1 h-3 w-3" />View</Button>
                            {u.kyc.status === "pending" && (
                              <>
                                <Button size="sm" className="bg-primary text-primary-foreground"
                                  disabled={busyId === `kyc-approve:${u.id}`}
                                  onClick={() => runAction(`kyc-approve:${u.id}`, () => adminApproveKyc(u.id), `KYC approved for ${u.name}`)}>
                                  {busyId === `kyc-approve:${u.id}` ? <Loader2 className="mr-1 h-3 w-3 animate-spin" /> : <CheckCircle2 className="mr-1 h-3 w-3" />}Approve
                                </Button>
                                <Button size="sm" variant="outline" className="text-destructive" onClick={() => { setKycReject(u); setKycReason(""); }}>
                                  <XCircle className="mr-1 h-3 w-3" />Reject
                                </Button>
                              </>
                            )}
                          </div>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              );
            })()}

            {active === "trades" && (() => {
              const nowMs = Date.now();
              const baseRows = tradeUserFilter === "all"
                ? panelTrades
                : panelTrades.filter((t) => t.userId === tradeUserFilter);
              const rows = baseRows.filter((t) =>
                tradeStatus === "all" ? true :
                tradeStatus === "active" ? (t.status === "active" && t.expiresAt > nowMs) :
                t.status === tradeStatus
              );
              const cols: AdminColumn<BinaryTrade>[] = [
                { key: "when", header: "Opened", cell: (t) => <span className="text-xs text-muted-foreground whitespace-nowrap">{new Date(t.openedAt).toLocaleString()}</span> },
                { key: "user", header: "User", cell: (t) => panelUsers.find((u) => u.id === t.userId)?.name || "—" },
                { key: "sym", header: "Symbol", cell: (t) => <span className="font-medium">{t.symbol}</span> },
                { key: "dir", header: "Dir.", cell: (t) => t.direction === "up"
                  ? <span className="inline-flex items-center gap-0.5 rounded bg-primary/15 px-1.5 py-0.5 text-xs font-semibold text-primary"><ArrowUp className="h-3 w-3" />UP</span>
                  : <span className="inline-flex items-center gap-0.5 rounded bg-destructive/15 px-1.5 py-0.5 text-xs font-semibold text-destructive"><ArrowDown className="h-3 w-3" />DOWN</span>
                },
                { key: "stake", header: "Stake", align: "right", cell: (t) => <span className="font-mono">${t.stake.toFixed(2)}</span> },
                { key: "dur", header: "Dur.", align: "right", hideOnMobile: true, cell: (t) => <span className="font-mono text-xs">{t.durationSec}s</span> },
                { key: "plan", header: "Planned", hideOnMobile: true, cell: (t) => (
                  t.plannedOutcome
                    ? <span className={`text-xs font-semibold ${t.plannedOutcome === "profit" ? "text-primary" : "text-destructive"}`}>{t.plannedOutcome.toUpperCase()}</span>
                    : <span className="text-xs text-muted-foreground">—</span>
                ) },
                { key: "pnl", header: "Result", align: "right", cell: (t) =>
                  t.status === "active" ? <span className="text-xs text-amber-400">ACTIVE</span> :
                  <span className={`font-mono ${(t.pnl ?? 0) >= 0 ? "text-primary" : "text-destructive"}`}>{(t.pnl ?? 0) >= 0 ? "+" : ""}${(t.pnl ?? 0).toFixed(2)}</span>
                },
                { key: "settled", header: "Settled", hideOnMobile: true, cell: (t) =>
                  t.resolvedAt
                    ? <span className="text-xs text-muted-foreground whitespace-nowrap">{new Date(t.resolvedAt).toLocaleString()}</span>
                    : <span className="text-xs text-muted-foreground">—</span>
                },
                { key: "source", header: "Source", hideOnMobile: true, cell: (t) =>
                  t.outcomeSource === "user-close"
                    ? <span className="text-xs text-amber-400">User closed</span>
                    : t.outcomeSource
                      ? <span className="text-xs text-muted-foreground">{t.outcomeSource}</span>
                      : <span className="text-xs text-muted-foreground">—</span>
                },
                { key: "view", header: "View", align: "right", cell: (t) =>
                  t.status === "active"
                    ? <span className="text-xs text-muted-foreground">—</span>
                    : <TradeViewButton onClick={() => setViewTrade(t)} />
                },
                { key: "act", header: "Profit / Loss", align: "right", cell: (t) => {
                  const tradeUser = panelUsers.find((u) => u.id === t.userId);
                  return (
                    <TradeProfitLossControl
                      trade={t}
                      defaultProfitPercent={
                        t.customProfitPercent ??
                        profitPercentForDuration(t.durationSec) ??
                        tradeUser?.profitPercent ??
                        payoutPercent
                      }
                      defaultLossPercent={t.customLossPercent ?? 100}
                      onPlan={(planned, profitPct, lossPct) =>
                        runAction(`plan:${t.id}`, () => adminPlanTrade(t.id, planned, profitPct, lossPct), "Trade outcome planned")
                      }
                      onSettle={(outcome, profitPct, lossPct) =>
                        runAction(
                          `settle:${t.id}:${outcome}`,
                          () => adminForceCloseTrade(t.id, outcome, profitPct, lossPct),
                          outcome === "profit" ? "Settled as profit" : "Settled as loss"
                        )
                      }
                      onDelete={() => {
                        if (confirm("Delete this record?")) {
                          runAction(`del:${t.id}`, () => adminDeleteTrade(t.id), "Deleted");
                        }
                      }}
                    />
                  );
                } },
              ];
              return (
                <div>
                  <div className="mb-4 flex flex-wrap items-center gap-3">
                    <Label className="text-xs text-muted-foreground">Filter by user</Label>
                    <select
                      value={tradeUserFilter}
                      onChange={(e) => setTradeUserFilter(e.target.value)}
                      className="h-8 min-w-[12rem] rounded border border-border bg-input px-2 text-sm"
                    >
                      <option value="all">All users</option>
                      {panelUsers.map((u) => (
                        <option key={u.id} value={u.id}>{u.name}</option>
                      ))}
                    </select>
                  </div>
                  {isAdmin && panelTrades.some((t) => t.status !== "active") && (
                    <div className="mb-3 flex items-center justify-end">
                      <Button size="sm" variant="outline" className="text-destructive" onClick={() => {
                        if (confirm("Clear all resolved trade history?")) {
                          runAction("clear-trades", () => adminClearTrades(), "History cleared");
                        }
                      }}><Trash2 className="mr-1 h-3 w-3" />Clear history</Button>
                    </div>
                  )}
                  <AdminTable
                    title="Trades & history"
                    rows={rows}
                    columns={cols}
                    rowKey={(t) => t.id}
                    searchPlaceholder="Search user or symbol…"
                    searchKeys={(t) => `${panelUsers.find((u) => u.id === t.userId)?.name || ""} ${t.symbol}`}
                    filters={[{ key: "status", label: "Status", value: tradeStatus, onChange: setTradeStatus, options: [
                      { value: "active", label: "● Active (Live)" }, { value: "won", label: "Won" }, { value: "lost", label: "Lost" }, { value: "all", label: "All" },
                    ] }]}
                    emptyLabel="No trades match."
                  />
                  {viewTrade && (() => {
                    const tu = panelUsers.find((u) => u.id === viewTrade.userId);
                    return (
                      <TradeResultViewDialog
                        trade={viewTrade}
                        open={!!viewTrade}
                        onOpenChange={(o) => { if (!o) setViewTrade(null); }}
                        userName={tu?.name || "Customer"}
                        userInitials={
                          tu
                            ? `${tu.fname?.[0] ?? ""}${tu.lname?.[0] ?? ""}`.toUpperCase() || "U"
                            : "U"
                        }
                      />
                    );
                  })()}
                </div>
              );
            })()}

            {active === "deposits" && (() => {
              const rows = panelDeposits.filter((d) => depositStatus === "all" ? true : d.status === depositStatus);
              const cols: AdminColumn<Deposit>[] = [
                { key: "when", header: "Submitted", cell: (d) => <span className="text-xs text-muted-foreground whitespace-nowrap">{new Date(d.createdAt).toLocaleString()}</span> },
                { key: "user", header: "User", cell: (d) => {
                  const u = panelUsers.find((x) => x.id === d.userId);
                  return <div><div className="font-medium">{u?.name || "—"}</div><div className="text-xs text-muted-foreground break-all">{u?.email}</div></div>;
                } },
                { key: "amount", header: "Amount", align: "right", cell: (d) => <span className="font-mono font-semibold">${d.amount.toFixed(2)}</span> },
                { key: "tx", header: "Tx hash", hideOnMobile: true, cell: (d) => <span className="font-mono text-xs text-muted-foreground break-all">{d.txHash || "—"}</span> },
                { key: "shot", header: "Proof", cell: (d) => (
                  <a href={getImageUrl(d.screenshot)} target="_blank" rel="noreferrer" className="inline-block">
                    <img src={getImageUrl(d.screenshot)} alt="Proof" className="h-12 w-12 rounded border border-border object-cover" />
                  </a>
                ) },
                { key: "status", header: "Status", cell: (d) => (
                  <span className={`rounded px-2 py-0.5 text-xs font-semibold ${d.status === "approved" ? "bg-primary/15 text-primary" : d.status === "rejected" ? "bg-destructive/15 text-destructive" : "bg-muted text-foreground"}`}>{d.status.toUpperCase()}</span>
                ) },
                { key: "act", header: "Actions", align: "right", cell: (d) => (
                  <div className="flex flex-wrap justify-end gap-1">
                    <Button size="sm" variant="ghost" onClick={() => setDetailsTarget(d)}><Eye className="mr-1 h-3 w-3" />Details</Button>
                    {d.status === "pending" && (
                      <>
                        <Button size="sm" className="bg-primary text-primary-foreground"
                          disabled={busyId === `approve:${d.id}`}
                          onClick={() => runAction(`approve:${d.id}`, () => adminApproveDeposit(d.id), `Approved $${d.amount.toFixed(2)}`)}>
                          {busyId === `approve:${d.id}` ? <Loader2 className="mr-1 h-3 w-3 animate-spin" /> : <CheckCircle2 className="mr-1 h-3 w-3" />}Approve
                        </Button>
                        <Button size="sm" variant="outline" className="text-destructive" onClick={() => { setRejectTarget(d); setRejectReason(""); }}>
                          <XCircle className="mr-1 h-3 w-3" />Reject
                        </Button>
                      </>
                    )}
                  </div>
                ) },
              ];
              return (
                <AdminTable
                  title="Deposit requests"
                  rows={rows}
                  columns={cols}
                  rowKey={(d) => d.id}
                  searchPlaceholder="Search user, email or tx hash…"
                  searchKeys={(d) => {
                    const u = panelUsers.find((x) => x.id === d.userId);
                    return `${u?.name || ""} ${u?.email || ""} ${d.txHash || ""}`;
                  }}
                  filters={[{ key: "status", label: "Status", value: depositStatus, onChange: setDepositStatus, options: [
                    { value: "all", label: "All" }, { value: "pending", label: "Pending" }, { value: "approved", label: "Approved" }, { value: "rejected", label: "Rejected" },
                  ] }]}
                  emptyLabel="No deposit requests."
                />
              );
            })()}

            {active === "withdrawals" && (() => {
              const rows = panelWithdrawals.filter((w) => withdrawalStatus === "all" ? true : w.status === withdrawalStatus);
              const cols: AdminColumn<Withdrawal>[] = [
                { key: "when", header: "Submitted", cell: (w) => <span className="text-xs text-muted-foreground whitespace-nowrap">{new Date(w.createdAt).toLocaleString()}</span> },
                { key: "user", header: "User", cell: (w) => {
                  const u = panelUsers.find((x) => x.id === w.userId);
                  return <div><div className="font-medium">{u?.name || "—"}</div><div className="text-xs text-muted-foreground break-all">{u?.email}</div></div>;
                } },
                { key: "amount", header: "Amount", align: "right", cell: (w) => <span className="font-mono font-semibold">${w.amount.toFixed(2)}</span> },
                { key: "method", header: "Method", cell: (w) => (
                  <span className="text-xs font-semibold uppercase">{w.method === "trc20" ? "TRC20" : "Bank"}</span>
                ) },
                { key: "dest", header: "Destination", hideOnMobile: true, cell: (w) => (
                  w.method === "trc20"
                    ? <span className="font-mono text-xs break-all">{w.trc20Address || "—"}</span>
                    : <div className="text-xs"><div className="font-medium">{w.bankName}</div><div className="font-mono text-muted-foreground">{w.accountNumber}</div>{w.accountName && <div className="text-muted-foreground">{w.accountName}</div>}</div>
                ) },
                { key: "status", header: "Status", cell: (w) => (
                  <span className={`rounded px-2 py-0.5 text-xs font-semibold ${w.status === "approved" ? "bg-primary/15 text-primary" : w.status === "rejected" ? "bg-destructive/15 text-destructive" : "bg-muted text-foreground"}`}>{w.status.toUpperCase()}</span>
                ) },
                { key: "act", header: "Actions", align: "right", cell: (w) => (
                  <div className="flex flex-wrap justify-end gap-1">
                    {w.status === "pending" && (
                      <>
                        <Button size="sm" className="bg-primary text-primary-foreground"
                          disabled={busyId === `wapprove:${w.id}`}
                          onClick={() => runAction(`wapprove:${w.id}`, () => adminApproveWithdrawal(w.id), `Approved $${w.amount.toFixed(2)} withdrawal`)}>
                          {busyId === `wapprove:${w.id}` ? <Loader2 className="mr-1 h-3 w-3 animate-spin" /> : <CheckCircle2 className="mr-1 h-3 w-3" />}Approve
                        </Button>
                        <Button size="sm" variant="outline" className="text-destructive" onClick={() => { setRejectWithdrawTarget(w); setRejectReason(""); }}>
                          <XCircle className="mr-1 h-3 w-3" />Reject
                        </Button>
                      </>
                    )}
                  </div>
                ) },
              ];
              return (
                <AdminTable
                  title="Withdrawal requests"
                  rows={rows}
                  columns={cols}
                  rowKey={(w) => w.id}
                  searchPlaceholder="Search user, email or destination…"
                  searchKeys={(w) => {
                    const u = panelUsers.find((x) => x.id === w.userId);
                    return `${u?.name || ""} ${u?.email || ""} ${w.trc20Address || ""} ${w.bankName || ""} ${w.accountNumber || ""}`;
                  }}
                  filters={[{ key: "status", label: "Status", value: withdrawalStatus, onChange: setWithdrawalStatus, options: [
                    { value: "all", label: "All" }, { value: "pending", label: "Pending" }, { value: "approved", label: "Approved" }, { value: "rejected", label: "Rejected" },
                  ] }]}
                  emptyLabel="No withdrawal requests."
                />
              );
            })()}

            {active === "support" && (
              <SupportInbox
                embedded
                onOpenCountChange={setOpenSupportCount}
              />
            )}

            {active === "vip" && (() => {
              const cols: AdminColumn<VipClaim>[] = [
                { key: "when", header: "Claimed", cell: (c) => <span className="text-xs text-muted-foreground whitespace-nowrap">{new Date(c.claimedAt).toLocaleString()}</span> },
                { key: "user", header: "User", cell: (c) => (
                  <div>
                    <div className="font-medium">{c.userName || "—"}</div>
                    <div className="text-xs text-muted-foreground break-all">{c.userEmail}</div>
                  </div>
                ) },
                { key: "vip", header: "VIP", cell: (c) => <span className="font-semibold text-amber-400">{c.name}</span> },
                { key: "req", header: "Required", align: "right", cell: (c) => <span className="font-mono">${c.requiredRecharge.toLocaleString()}</span> },
                { key: "reward", header: "Reward", align: "right", cell: (c) => <span className="font-mono text-primary">+${c.reward.toLocaleString()}</span> },
                { key: "at", header: "Recharge at claim", align: "right", hideOnMobile: true, cell: (c) => <span className="font-mono text-xs">${c.totalRechargeAtClaim.toFixed(2)}</span> },
              ];
              return (
                <div>
                  <p className="mb-4 text-sm text-muted-foreground">
                    One-time VIP recharge rewards claimed by users. Staff see only assigned users.
                  </p>
                  {vipLoading ? (
                    <div className="flex justify-center py-12 text-muted-foreground"><Loader2 className="h-6 w-6 animate-spin" /></div>
                  ) : (
                    <AdminTable
                      title="VIP reward claims"
                      rows={vipClaims}
                      columns={cols}
                      rowKey={(c) => c.id}
                      searchPlaceholder="Search user or VIP…"
                      searchKeys={(c) => `${c.userName || ""} ${c.userEmail || ""} ${c.name}`}
                      emptyLabel="No VIP rewards claimed yet."
                    />
                  )}
                </div>
              );
            })()}

            {active === "staff" && isAdmin && (
              <div>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Staff accounts</h1>
                    <p className="text-sm text-muted-foreground">Manage staff who can review users, KYC, deposits, withdrawals and trades.</p>
                  </div>
                  <Button
                    className="bg-primary text-primary-foreground"
                    onClick={() => {
                      setStaffForm(emptyStaffForm());
                      setAddStaffOpen(true);
                    }}
                  >
                    <Plus className="mr-1 h-4 w-4" />Add new staff
                  </Button>
                </div>

                <div className="mt-6 overflow-hidden rounded-xl border border-border/60 bg-card/60">
                  <div className="border-b border-border/60 px-4 py-3 text-sm font-semibold">Staff list ({allStaff.length})</div>
                  {allStaff.length === 0 ? (
                    <div className="px-4 py-16 text-center">
                      <UserCog className="mx-auto h-10 w-10 text-muted-foreground/50" />
                      <p className="mt-3 text-sm font-medium text-foreground">No staff yet</p>
                      <p className="mt-1 text-sm text-muted-foreground">Add your first staff member to help manage the platform.</p>
                      <Button
                        className="mt-4 bg-primary text-primary-foreground"
                        onClick={() => {
                          setStaffForm(emptyStaffForm());
                          setAddStaffOpen(true);
                        }}
                      >
                        <Plus className="mr-1 h-4 w-4" />Add new staff
                      </Button>
                    </div>
                  ) : (
                    <ul className="divide-y divide-border/60">
                      {allStaff.map((s) => (
                        <li key={s.id} className="flex flex-wrap items-center gap-3 px-4 py-3 text-sm hover:bg-muted/20">
                          <div className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary">
                            <UserCog className="h-4 w-4" />
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="font-medium">{s.name}</div>
                            <div className="text-xs text-muted-foreground">{s.email}</div>
                            <div className="text-xs text-muted-foreground">{s.phone} · Joined {new Date(s.createdAt).toLocaleDateString()}</div>
                          </div>
                          <div className="ml-auto flex flex-wrap gap-1">
                            <Button size="sm" variant="outline" onClick={() => {
                              setEditStaff(s);
                              setEditStaffForm({
                                fname: s.fname,
                                lname: s.lname,
                                email: s.email,
                                phone: s.phone,
                                password: "",
                                confirmPassword: "",
                              });
                            }}><Pencil className="mr-1 h-3 w-3" />Edit</Button>
                            <Button size="sm" variant="ghost" className="text-destructive" onClick={async () => {
                              if (!confirm(`Remove staff ${s.name}?`)) return;
                              const r = await adminDeleteStaff(s.id);
                              r.ok ? toast.success(r.msg) : toast.error(r.msg);
                            }}><Trash2 className="mr-1 h-3 w-3" />Remove</Button>
                          </div>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>

                <Dialog open={addStaffOpen} onOpenChange={(open) => {
                  setAddStaffOpen(open);
                  if (!open) setStaffForm(emptyStaffForm());
                }}>
                  <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                      <DialogTitle>Add new staff</DialogTitle>
                      <DialogDescription>Create a staff account with login access to the admin panel.</DialogDescription>
                    </DialogHeader>
                    <form
                      onSubmit={async (e) => {
                        e.preventDefault();
                        if (staffForm.password !== staffForm.confirmPassword) {
                          return toast.error("Passwords do not match");
                        }
                        setStaffSubmitting(true);
                        try {
                          const r = await adminCreateStaff({
                            fname: staffForm.fname,
                            lname: staffForm.lname,
                            email: staffForm.email,
                            phone: staffForm.phone,
                            password: staffForm.password,
                          });
                          if (!r.ok) return toast.error(r.msg);
                          toast.success(r.msg);
                          setAddStaffOpen(false);
                          setStaffForm(emptyStaffForm());
                        } finally {
                          setStaffSubmitting(false);
                        }
                      }}
                      className="grid gap-3"
                    >
                      <div className="grid gap-3 sm:grid-cols-2">
                        <div><Label>First name</Label><Input value={staffForm.fname} onChange={(e) => setStaffForm((s) => ({ ...s, fname: e.target.value }))} placeholder="Jane" required disabled={staffSubmitting} /></div>
                        <div><Label>Last name</Label><Input value={staffForm.lname} onChange={(e) => setStaffForm((s) => ({ ...s, lname: e.target.value }))} placeholder="Doe" required disabled={staffSubmitting} /></div>
                      </div>
                      <div><Label>Email</Label><Input type="email" value={staffForm.email} onChange={(e) => setStaffForm((s) => ({ ...s, email: e.target.value }))} placeholder="staff@example.com" required disabled={staffSubmitting} /></div>
                      <div><Label>Contact number</Label><Input type="tel" value={staffForm.phone} onChange={(e) => setStaffForm((s) => ({ ...s, phone: e.target.value }))} placeholder="+1 3001234567" required disabled={staffSubmitting} /></div>
                      <div><Label>Password</Label><PasswordInput value={staffForm.password} onChange={(e) => setStaffForm((s) => ({ ...s, password: e.target.value }))} placeholder="At least 6 characters" required disabled={staffSubmitting} /></div>
                      <div><Label>Confirm password</Label><PasswordInput value={staffForm.confirmPassword} onChange={(e) => setStaffForm((s) => ({ ...s, confirmPassword: e.target.value }))} placeholder="Repeat password" required disabled={staffSubmitting} /></div>
                      <DialogFooter>
                        <Button type="button" variant="outline" onClick={() => setAddStaffOpen(false)} disabled={staffSubmitting}>Cancel</Button>
                        <Button type="submit" className="bg-primary text-primary-foreground" disabled={staffSubmitting}>
                          {staffSubmitting ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Creating…</> : "Create staff"}
                        </Button>
                      </DialogFooter>
                    </form>
                  </DialogContent>
                </Dialog>

                <Dialog open={!!editStaff} onOpenChange={(open) => { if (!open) setEditStaff(null); }}>
                  <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                      <DialogTitle>Edit staff</DialogTitle>
                      <DialogDescription>Update staff details. Leave password blank to keep the current password.</DialogDescription>
                    </DialogHeader>
                    <form
                      onSubmit={async (e) => {
                        e.preventDefault();
                        if (!editStaff) return;
                        if (editStaffForm.password || editStaffForm.confirmPassword) {
                          if (editStaffForm.password !== editStaffForm.confirmPassword) {
                            return toast.error("Passwords do not match");
                          }
                        }
                        setEditStaffSubmitting(true);
                        try {
                          const r = await adminUpdateStaff(editStaff.id, {
                            fname: editStaffForm.fname,
                            lname: editStaffForm.lname,
                            email: editStaffForm.email,
                            phone: editStaffForm.phone,
                            ...(editStaffForm.password ? { password: editStaffForm.password } : {}),
                          });
                          if (!r.ok) return toast.error(r.msg);
                          toast.success(r.msg);
                          setEditStaff(null);
                        } finally {
                          setEditStaffSubmitting(false);
                        }
                      }}
                      className="grid gap-3"
                    >
                      <div className="grid gap-3 sm:grid-cols-2">
                        <div><Label>First name</Label><Input value={editStaffForm.fname} onChange={(e) => setEditStaffForm((f) => ({ ...f, fname: e.target.value }))} required disabled={editStaffSubmitting} /></div>
                        <div><Label>Last name</Label><Input value={editStaffForm.lname} onChange={(e) => setEditStaffForm((f) => ({ ...f, lname: e.target.value }))} required disabled={editStaffSubmitting} /></div>
                      </div>
                      <div><Label>Email</Label><Input type="email" value={editStaffForm.email} onChange={(e) => setEditStaffForm((f) => ({ ...f, email: e.target.value }))} required disabled={editStaffSubmitting} /></div>
                      <div><Label>Contact number</Label><Input type="tel" value={editStaffForm.phone} onChange={(e) => setEditStaffForm((f) => ({ ...f, phone: e.target.value }))} required disabled={editStaffSubmitting} /></div>
                      <div><Label>New password (optional)</Label><PasswordInput value={editStaffForm.password} onChange={(e) => setEditStaffForm((f) => ({ ...f, password: e.target.value }))} placeholder="Leave blank to keep current" disabled={editStaffSubmitting} /></div>
                      <div><Label>Confirm new password</Label><PasswordInput value={editStaffForm.confirmPassword} onChange={(e) => setEditStaffForm((f) => ({ ...f, confirmPassword: e.target.value }))} disabled={editStaffSubmitting} /></div>
                      <DialogFooter>
                        <Button type="button" variant="outline" onClick={() => setEditStaff(null)} disabled={editStaffSubmitting}>Cancel</Button>
                        <Button type="submit" className="bg-primary text-primary-foreground" disabled={editStaffSubmitting}>
                          {editStaffSubmitting ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Saving…</> : "Save changes"}
                        </Button>
                      </DialogFooter>
                    </form>
                  </DialogContent>
                </Dialog>
              </div>
            )}

            {active === "settings" && isAdmin && (
              <div className="max-w-2xl space-y-6">
                <div>
                  <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Settings</h1>
                  <p className="text-sm text-muted-foreground">Configure deposit wallet and trade payout.</p>
                </div>

                <div className="rounded-xl border border-border/60 bg-card/60 p-5">
                  <div className="flex items-center gap-2"><Wallet className="h-5 w-5 text-primary" /><h2 className="font-semibold">USDT deposit address (TRC20)</h2></div>
                  <p className="mt-1 text-xs text-muted-foreground">Users see this address on the Deposit page.</p>
                  <div className="mt-4 space-y-2">
                    <Label>Wallet address</Label>
                    <Input value={walletDraft} onChange={(e) => setWalletDraft(e.target.value)} placeholder="TXYZ…" className="font-mono" />
                  </div>
                  <div className="mt-4 flex gap-2">
                    <Button
                      onClick={() => runAction("save-wallet", async () => {
                        const r = await adminSetWalletAddress(walletDraft);
                        if (!r.ok) throw new Error(r.msg);
                      }, "Wallet address updated")}
                      className="bg-primary text-primary-foreground"
                    >
                      Save
                    </Button>
                    <Button variant="outline" onClick={() => setWalletDraft(walletAddress)}>Reset</Button>
                  </div>
                  {walletAddress && (
                    <div className="mt-4 rounded-md border border-border bg-background p-3">
                      <div className="text-xs text-muted-foreground">Currently active</div>
                      <div className="mt-1 break-all font-mono text-sm">{walletAddress}</div>
                    </div>
                  )}
                </div>

                <div className="rounded-xl border border-border/60 bg-card/60 p-5">
                  <div className="flex items-center gap-2"><Percent className="h-5 w-5 text-primary" /><h2 className="font-semibold">Trade payout (by duration)</h2></div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Winning profit % is fixed by trade duration. Losing trades always lose <span className="font-mono text-foreground">100%</span> of the stake.
                  </p>
                  <div className="mt-4 overflow-hidden rounded-lg border border-border/60">
                    <table className="w-full text-sm">
                      <thead className="bg-muted/40 text-xs uppercase text-muted-foreground">
                        <tr>
                          <th className="px-3 py-2 text-left">Duration</th>
                          <th className="px-3 py-2 text-right">Win profit</th>
                          <th className="px-3 py-2 text-right">Loss</th>
                        </tr>
                      </thead>
                      <tbody>
                        {TRADE_DURATIONS.map((d) => (
                          <tr key={d.sec} className="border-t border-border/60">
                            <td className="px-3 py-2 font-mono">{d.label} ({d.sec}s)</td>
                            <td className="px-3 py-2 text-right font-mono text-primary">+{d.profitPercent}%</td>
                            <td className="px-3 py-2 text-right font-mono text-destructive">−100%</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <p className="mt-3 text-[11px] text-muted-foreground">
                    Example: $100 on a 60s win returns $140 (+40%). A loss returns $0 (−$100).
                  </p>
                </div>

                <div className="rounded-xl border border-border/60 bg-card/60 p-5">
                  <div className="flex items-center gap-2"><Percent className="h-5 w-5 text-primary" /><h2 className="font-semibold">Spot trading fee</h2></div>
                  <p className="mt-1 text-xs text-muted-foreground">Fee % charged on buy and sell notional. Currently <span className="font-mono text-foreground">{spotFeePercent.toFixed(2)}%</span> each side.</p>
                  <div className="mt-4 flex items-end gap-3">
                    <div className="flex-1">
                      <Label>Spot fee %</Label>
                      <Input type="number" min="0" max="10" step="0.01" value={spotFeeDraft} onChange={(e) => setSpotFeeDraft(e.target.value)} />
                    </div>
                    <Button className="bg-primary text-primary-foreground" onClick={() => {
                      const n = parseFloat(spotFeeDraft);
                      if (!Number.isFinite(n) || n < 0 || n > 10) return toast.error("Enter 0–10");
                      runAction("save-spot-fee", async () => {
                        const r = await adminSetSpotFeePercent(n);
                        if (!r.ok) throw new Error(r.msg);
                      }, `Spot fee set to ${n.toFixed(2)}%`);
                    }}>Save</Button>
                  </div>
                </div>
              </div>
            )}

            {active === "audit" && isAdmin && (
              <div>
                <div className="flex items-end justify-between gap-4">
                  <div>
                    <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Audit log</h1>
                    <p className="text-sm text-muted-foreground">Every admin and staff action.</p>
                  </div>
                  {auditLog.length > 0 && (
                    <Button size="sm" variant="outline" className="text-destructive" onClick={() => {
                      if (confirm(`Clear all ${auditLog.length} entries?`)) { adminClearAuditLog(); toast.success("Audit log cleared"); }
                    }}><Trash2 className="mr-1 h-3 w-3" />Clear log</Button>
                  )}
                </div>
                <div className="mt-6 overflow-hidden rounded-xl border border-border/60 bg-card/60">
                  {auditLog.length === 0 ? (
                    <div className="px-4 py-12 text-center text-sm text-muted-foreground">
                      <FileClock className="mx-auto mb-2 h-6 w-6 opacity-40" />No audit entries yet.
                    </div>
                  ) : (
                    <ul className="divide-y divide-border/60">
                      {auditLog.map((e) => (
                        <li key={e.id} className="flex flex-wrap items-start gap-3 px-4 py-3 text-sm">
                          <div className={`mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-md text-[10px] font-bold ${e.actorRole === "admin" ? "bg-primary/15 text-primary" : "bg-accent/60 text-foreground"}`}>
                            {e.actorRole === "admin" ? <Shield className="h-3.5 w-3.5" /> : <UserCog className="h-3.5 w-3.5" />}
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="font-medium">{e.summary}</div>
                            <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-muted-foreground">
                              <span>{e.actor}</span><span>·</span><span className="font-mono">{e.action}</span><span>·</span><span>{new Date(e.at).toLocaleString()}</span>
                            </div>
                          </div>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>
            )}
          </main>
        </SidebarInset>
      </div>

      {/* Edit user dialog */}
      <Dialog open={!!editUser} onOpenChange={(o) => !o && setEditUser(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit user</DialogTitle>
            <DialogDescription>Update profile details. Email must be unique.</DialogDescription>
          </DialogHeader>
          {editUser && (
            <div className="grid gap-3 sm:grid-cols-2">
              <div><Label>First name</Label><Input value={editUser.fname} onChange={(e) => setEditUser({ ...editUser, fname: e.target.value })} /></div>
              <div><Label>Last name</Label><Input value={editUser.lname} onChange={(e) => setEditUser({ ...editUser, lname: e.target.value })} /></div>
              <div className="sm:col-span-2"><Label>Email</Label><Input type="email" value={editUser.email} onChange={(e) => setEditUser({ ...editUser, email: e.target.value })} /></div>
              <div><Label>Phone</Label><Input value={editUser.phone} onChange={(e) => setEditUser({ ...editUser, phone: e.target.value })} /></div>
              <div>
                <Label>Country</Label>
                <select value={editUser.country} onChange={(e) => setEditUser({ ...editUser, country: e.target.value })}
                  className="mt-1 flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm">
                  {COUNTRIES.map((c) => <option key={c.code} value={c.code}>{c.name}</option>)}
                </select>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditUser(null)}>Cancel</Button>
            <Button className="bg-primary text-primary-foreground" onClick={async () => {
              if (!editUser) return;
              const r = await adminUpdateUser(editUser.id, {
                fname: editUser.fname, lname: editUser.lname, email: editUser.email,
                phone: editUser.phone, country: editUser.country,
              });
              if (!r.ok) return toast.error(r.msg);
              toast.success(r.msg);
              setEditUser(null);
            }}>Save changes</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reject deposit dialog */}
      <Dialog open={!!rejectTarget} onOpenChange={(o) => { if (!o) { setRejectTarget(null); setRejectReason(""); } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><ShieldAlert className="h-5 w-5 text-destructive" />Reject deposit</DialogTitle>
            <DialogDescription>
              {rejectTarget && <>Rejecting <span className="font-semibold text-foreground">${rejectTarget.amount.toFixed(2)}</span> from{" "}
                <span className="font-semibold text-foreground">{panelUsers.find((u) => u.id === rejectTarget.userId)?.name || "—"}</span>.</>}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label>Reason</Label>
            <Textarea value={rejectReason} onChange={(e) => setRejectReason(e.target.value)} placeholder="e.g. Screenshot unreadable…" rows={3} maxLength={300} />
            <div className="text-right text-[10px] text-muted-foreground">{rejectReason.length}/300</div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setRejectTarget(null); setRejectReason(""); }}>Cancel</Button>
            <Button variant="destructive" disabled={busyId === `reject:${rejectTarget?.id}`} onClick={() => {
              if (!rejectTarget) return;
              const id = rejectTarget.id;
              const reason = rejectReason.trim() || undefined;
              runAction(`reject:${id}`, () => adminRejectDeposit(id, reason), "Deposit rejected");
              setRejectTarget(null); setRejectReason("");
            }}>
              {busyId === `reject:${rejectTarget?.id}` ? <Loader2 className="mr-1 h-3 w-3 animate-spin" /> : <XCircle className="mr-1 h-3 w-3" />}Confirm reject
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reject withdrawal dialog */}
      <Dialog open={!!rejectWithdrawTarget} onOpenChange={(o) => { if (!o) { setRejectWithdrawTarget(null); setRejectReason(""); } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><ShieldAlert className="h-5 w-5 text-destructive" />Reject withdrawal</DialogTitle>
            <DialogDescription>
              {rejectWithdrawTarget && <>Rejecting <span className="font-semibold text-foreground">${rejectWithdrawTarget.amount.toFixed(2)}</span> for{" "}
                <span className="font-semibold text-foreground">{panelUsers.find((u) => u.id === rejectWithdrawTarget.userId)?.name || "—"}</span>.</>}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label>Reason</Label>
            <Textarea value={rejectReason} onChange={(e) => setRejectReason(e.target.value)} placeholder="e.g. Invalid bank details…" rows={3} maxLength={300} />
            <div className="text-right text-[10px] text-muted-foreground">{rejectReason.length}/300</div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setRejectWithdrawTarget(null); setRejectReason(""); }}>Cancel</Button>
            <Button variant="destructive" disabled={busyId === `wreject:${rejectWithdrawTarget?.id}`} onClick={() => {
              if (!rejectWithdrawTarget) return;
              const id = rejectWithdrawTarget.id;
              const reason = rejectReason.trim() || undefined;
              runAction(`wreject:${id}`, () => adminRejectWithdrawal(id, reason), "Withdrawal rejected");
              setRejectWithdrawTarget(null); setRejectReason("");
            }}>
              {busyId === `wreject:${rejectWithdrawTarget?.id}` ? <Loader2 className="mr-1 h-3 w-3 animate-spin" /> : <XCircle className="mr-1 h-3 w-3" />}Confirm reject
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* KYC reject dialog */}
      <Dialog open={!!kycReject} onOpenChange={(o) => { if (!o) { setKycReject(null); setKycReason(""); } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><ShieldAlert className="h-5 w-5 text-destructive" />Reject KYC</DialogTitle>
            <DialogDescription>
              {kycReject && <>Rejecting verification for <span className="font-semibold text-foreground">{kycReject.name}</span>. They will be asked to resubmit.</>}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label>Reason (shown to user)</Label>
            <Textarea value={kycReason} onChange={(e) => setKycReason(e.target.value)} placeholder="e.g. CNIC back photo is blurry…" rows={3} maxLength={300} />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setKycReject(null); setKycReason(""); }}>Cancel</Button>
            <Button variant="destructive" disabled={!kycReason.trim()} onClick={async () => {
              if (!kycReject) return;
              await adminRejectKyc(kycReject.id, kycReason.trim());
              toast.success(`KYC rejected for ${kycReject.name}`);
              setKycReject(null); setKycReason("");
            }}><XCircle className="mr-1 h-3 w-3" />Confirm reject</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* KYC full view dialog */}
      <Dialog open={!!kycView} onOpenChange={(o) => !o && setKycView(null)}>
        <DialogContent className="max-w-3xl">
          <DialogHeader><DialogTitle className="flex items-center gap-2"><IdCard className="h-5 w-5 text-primary" />KYC submission</DialogTitle></DialogHeader>
          {kycView && (
            <div className="space-y-4">
              <div className="text-sm">
                <div className="font-semibold">{kycView.name}</div>
                <div className="text-xs text-muted-foreground">{kycView.email} · {kycView.phone} · {kycView.country}</div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                {(["cnicFront", "cnicBack"] as const).map((k) => {
                  const rawSrc = kycView.kyc[k];
                  const src = getImageUrl(rawSrc);
                  return (
                    <div key={k}>
                      {src && (
                        <a href={src} target="_blank" rel="noreferrer"><img src={src} alt={k} className="w-full rounded border border-border" /></a>
                      )}
                      <div className="mt-1 text-center text-xs text-muted-foreground">{k === "cnicFront" ? "CNIC front" : "CNIC back"}</div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
          <DialogFooter><Button variant="outline" onClick={() => setKycView(null)}>Close</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Deposit details */}
      <Dialog open={!!detailsTarget} onOpenChange={(o) => !o && setDetailsTarget(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader><DialogTitle>Deposit details</DialogTitle><DialogDescription>Full submission, status timeline, and audit trail.</DialogDescription></DialogHeader>
          {detailsTarget && (() => {
            const d = detailsTarget;
            const u = panelUsers.find((x) => x.id === d.userId);
            const entries = auditLogFor(d.id);
            const steps = [
              { key: "submitted", label: "Submitted", at: d.createdAt, done: true, tone: "primary" as const },
              { key: "reviewed", label: "Reviewed", at: d.processedAt, done: d.status !== "pending", tone: "amber" as const },
              { key: d.status, label: d.status === "rejected" ? "Rejected" : d.status === "approved" ? "Approved" : "Awaiting", at: d.processedAt, done: d.status !== "pending", tone: d.status === "rejected" ? "danger" as const : "success" as const },
            ];
            const toneClass = (t: string, done: boolean) =>
              !done ? "bg-muted text-muted-foreground ring-border" :
              t === "primary" ? "bg-primary/15 text-primary ring-primary/40" :
              t === "amber" ? "bg-amber-500/15 text-amber-400 ring-amber-500/40" :
              t === "success" ? "bg-emerald-500/15 text-emerald-400 ring-emerald-500/40" :
              "bg-destructive/15 text-destructive ring-destructive/40";
            return (
              <div className="grid gap-4 sm:grid-cols-[1fr_1.2fr]">
                <div className="space-y-3">
                  <a href={getImageUrl(d.screenshot)} target="_blank" rel="noreferrer" className="block overflow-hidden rounded-md border border-border">
                    <img src={getImageUrl(d.screenshot)} alt="Proof" className="h-48 w-full object-contain bg-muted/30" />
                  </a>
                  <dl className="space-y-1 text-xs">
                    <div className="flex justify-between gap-2"><dt className="text-muted-foreground">User</dt><dd className="font-medium text-right">{u?.name || "—"}</dd></div>
                    <div className="flex justify-between gap-2"><dt className="text-muted-foreground">Email</dt><dd className="break-all text-right">{u?.email || "—"}</dd></div>
                    <div className="flex justify-between gap-2"><dt className="text-muted-foreground">Amount</dt><dd className="font-mono font-semibold text-right">${d.amount.toFixed(2)}</dd></div>
                    <div className="flex justify-between gap-2"><dt className="text-muted-foreground">Tx hash</dt><dd className="font-mono text-right break-all">{d.txHash || "—"}</dd></div>
                    {d.rejectReason && <div className="flex justify-between gap-2"><dt className="text-muted-foreground">Reject reason</dt><dd className="text-right text-destructive">{d.rejectReason}</dd></div>}
                  </dl>
                </div>
                <div>
                  <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Status timeline</div>
                  <ol className="mt-3 space-y-3">
                    {steps.map((s, i) => (
                      <li key={s.key} className="flex gap-3">
                        <div className="flex flex-col items-center">
                          <div className={`grid h-7 w-7 place-items-center rounded-full ring-1 ${toneClass(s.tone, s.done)}`}>
                            {s.done ? <CheckCircle2 className="h-3.5 w-3.5" /> : <Clock className="h-3.5 w-3.5" />}
                          </div>
                          {i < steps.length - 1 && <div className="my-1 h-6 w-px bg-border" />}
                        </div>
                        <div className="pt-0.5">
                          <div className="text-sm font-medium">{s.label}</div>
                          <div className="text-[11px] text-muted-foreground">{s.at ? new Date(s.at).toLocaleString() : "—"}</div>
                        </div>
                      </li>
                    ))}
                  </ol>
                  <div className="mt-5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Audit trail</div>
                  {entries.length === 0 ? <p className="mt-2 text-xs text-muted-foreground">No audit entries.</p> : (
                    <ul className="mt-2 space-y-1.5">
                      {entries.map((e) => (
                        <li key={e.id} className="rounded-md border border-border/60 bg-background/60 px-2.5 py-1.5 text-xs">
                          <div className="font-medium">{e.summary}</div>
                          <div className="text-[10px] text-muted-foreground">{e.actor} · {new Date(e.at).toLocaleString()}</div>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>
            );
          })()}
          <DialogFooter><Button variant="outline" onClick={() => setDetailsTarget(null)}>Close</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </SidebarProvider>
  );
}

function UserTradeControl({
  user,
  defaultProfitPercent,
  onSave,
}: {
  user: User;
  defaultProfitPercent: number;
  onSave: (mode: ForceOutcome, profitPct: number | null, lossPct: number) => Promise<void>;
}) {
  const [mode, setMode] = useState<ForceOutcome>(user.forceOutcome);
  const [profitPct, setProfitPct] = useState(String(user.profitPercent ?? defaultProfitPercent));
  const [lossPct, setLossPct] = useState(String(user.lossPercent ?? 100));

  useEffect(() => { setMode(user.forceOutcome); }, [user.forceOutcome]);
  useEffect(() => { setProfitPct(String(user.profitPercent ?? defaultProfitPercent)); }, [user.profitPercent, defaultProfitPercent]);
  useEffect(() => { setLossPct(String(user.lossPercent ?? 100)); }, [user.lossPercent]);

  const save = () => {
    const p = profitPct.trim() === "" ? null : parseFloat(profitPct);
    const l = parseFloat(lossPct);
    if (p != null && (!Number.isFinite(p) || p < 0 || p > 500)) return toast.error("Profit % must be 0–500");
    if (!Number.isFinite(l) || l < 0 || l > 100) return toast.error("Loss % must be 0–100");
    void onSave(mode, p, l);
  };

  return (
    <div className="min-w-[11rem] space-y-2">
      <div className="flex flex-col gap-1.5 text-xs">
        {([
          ["random", "Random"],
          ["win", "Profit"],
          ["lose", "Loss"],
        ] as const).map(([value, label]) => (
          <label key={value} className="inline-flex items-center gap-2 cursor-pointer">
            <input
              type="radio"
              name={`trade-mode-${user.id}`}
              checked={mode === value}
              onChange={() => setMode(value)}
              className="accent-primary"
            />
            {label}
          </label>
        ))}
      </div>
      <div className="grid grid-cols-2 gap-1">
        <Input value={profitPct} onChange={(e) => setProfitPct(e.target.value)} placeholder="Profit %" className="h-7 text-xs" title="Profit %" />
        <Input value={lossPct} onChange={(e) => setLossPct(e.target.value)} placeholder="Loss %" className="h-7 text-xs" title="Loss %" />
      </div>
      <Button size="sm" variant="outline" className="h-7 w-full text-xs" onClick={save}>Save</Button>
    </div>
  );
}

function TradeProfitLossControl({
  trade,
  defaultProfitPercent,
  defaultLossPercent,
  onPlan,
  onSettle,
  onDelete,
}: {
  trade: BinaryTrade;
  defaultProfitPercent: number;
  defaultLossPercent: number;
  onPlan: (planned: "profit" | "loss" | null, profitPct?: number, lossPct?: number) => void;
  onSettle: (outcome: "profit" | "loss", profitPct?: number, lossPct?: number) => void;
  onDelete: () => void;
}) {
  const [planned, setPlanned] = useState<"profit" | "loss" | "none">(
    trade.plannedOutcome ?? "none"
  );
  const [profitPct, setProfitPct] = useState(String(defaultProfitPercent));
  const [lossPct, setLossPct] = useState(String(defaultLossPercent));

  useEffect(() => { setPlanned(trade.plannedOutcome ?? "none"); }, [trade.plannedOutcome]);
  useEffect(() => { setProfitPct(String(defaultProfitPercent)); }, [defaultProfitPercent]);
  useEffect(() => { setLossPct(String(defaultLossPercent)); }, [defaultLossPercent]);

  const readPercents = () => {
    const p = parseFloat(profitPct);
    const l = parseFloat(lossPct);
    if (!Number.isFinite(p) || p < 0 || p > 500) { toast.error("Profit % must be 0–500"); return null; }
    if (!Number.isFinite(l) || l < 0 || l > 100) { toast.error("Loss % must be 0–100"); return null; }
    return { p, l };
  };

  if (trade.status !== "active") {
    return (
      <Button size="sm" variant="ghost" className="text-destructive" onClick={onDelete}>
        <Trash2 className="h-3 w-3" />
      </Button>
    );
  }

  return (
    <div className="min-w-[14rem] space-y-2 text-left">
      <div className="flex flex-wrap gap-2 text-[11px]">
        {([
          ["none", "Auto"],
          ["profit", "Profit"],
          ["loss", "Loss"],
        ] as const).map(([value, label]) => (
          <label key={value} className="inline-flex items-center gap-1 cursor-pointer">
            <input
              type="radio"
              name={`trade-plan-${trade.id}`}
              checked={planned === value}
              onChange={() => setPlanned(value)}
              className="accent-primary"
            />
            {label}
          </label>
        ))}
      </div>
      <div className="grid grid-cols-2 gap-1">
        <Input value={profitPct} onChange={(e) => setProfitPct(e.target.value)} className="h-7 text-xs" placeholder="Profit %" />
        <Input value={lossPct} onChange={(e) => setLossPct(e.target.value)} className="h-7 text-xs" placeholder="Loss %" />
      </div>
      <div className="flex flex-wrap gap-1">
        <Button
          size="sm"
          variant="outline"
          className="h-7 text-xs"
          onClick={() => {
            const v = readPercents();
            if (!v) return;
            onPlan(planned === "none" ? null : planned, v.p, v.l);
          }}
        >
          Plan
        </Button>
        <Button
          size="sm"
          variant="outline"
          className="h-7 text-xs text-primary"
          onClick={() => {
            const v = readPercents();
            if (!v) return;
            onSettle("profit", v.p, v.l);
          }}
        >
          Profit
        </Button>
        <Button
          size="sm"
          variant="outline"
          className="h-7 text-xs text-destructive"
          onClick={() => {
            const v = readPercents();
            if (!v) return;
            onSettle("loss", v.p, v.l);
          }}
        >
          Loss
        </Button>
      </div>
    </div>
  );
}

function KycPill({ status }: { status: "none" | "pending" | "approved" | "rejected" }) {
  const cfg = {
    none: { cls: "bg-muted text-muted-foreground", label: "NONE" },
    pending: { cls: "bg-amber-500/15 text-amber-400", label: "PENDING" },
    approved: { cls: "bg-primary/15 text-primary", label: "APPROVED" },
    rejected: { cls: "bg-destructive/15 text-destructive", label: "REJECTED" },
  }[status];
  return <span className={`rounded px-2 py-0.5 text-xs font-semibold ${cfg.cls}`}>{cfg.label}</span>;
}

function QuickCard({ icon: Icon, title, value, sub, onClick }: { icon: React.ComponentType<{ className?: string }>; title: string; value: number; sub: string; onClick: () => void }) {
  return (
    <div className="rounded-xl border border-border/60 bg-gradient-to-br from-card/80 to-card/40 p-5">
      <div className="flex items-center gap-2 text-sm font-semibold"><Icon className="h-4 w-4 text-primary" />{title}</div>
      <div className="mt-3 flex items-baseline gap-2"><span className="font-mono text-3xl font-bold">{value}</span><span className="text-xs text-muted-foreground">{sub}</span></div>
      <Button size="sm" variant="outline" className="mt-4" onClick={onClick}>Open →</Button>
    </div>
  );
}

type StatTone = "primary" | "amber" | "violet" | "success";
function Stat({ label, value, icon: Icon, tone = "primary" }: { label: string; value: string; icon?: React.ComponentType<{ className?: string }>; tone?: StatTone }) {
  const tones: Record<StatTone, string> = {
    primary: "from-primary/20 to-primary/0 text-primary",
    amber: "from-amber-500/20 to-amber-500/0 text-amber-400",
    violet: "from-violet-500/20 to-violet-500/0 text-violet-400",
    success: "from-emerald-500/20 to-emerald-500/0 text-emerald-400",
  };
  return (
    <div className="group relative overflow-hidden rounded-xl border border-border/60 bg-card/60 p-5 transition-all hover:border-border hover:shadow-[0_8px_30px_-12px_var(--color-primary)]">
      <div className={`absolute inset-0 -z-0 bg-gradient-to-br ${tones[tone]} opacity-60`} />
      <div className="relative z-10 flex items-start justify-between gap-3">
        <div>
          <div className="text-xs uppercase tracking-wider text-muted-foreground">{label}</div>
          <div className="mt-2 text-2xl font-bold font-mono">{value}</div>
        </div>
        {Icon && <div className={`grid h-9 w-9 place-items-center rounded-lg bg-background/40 ring-1 ring-border/60 ${tones[tone].split(" ").pop()}`}><Icon className="h-4 w-4" /></div>}
      </div>
    </div>
  );
}
