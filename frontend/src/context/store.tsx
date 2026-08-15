import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { SEED_ASSETS, toBinanceSymbol, fetchUsdForexRates, type Asset } from "@/services/market-data";
import { DEFAULT_PAYOUT_PERCENT, VALID_TRADE_DURATIONS } from "@/constants/roles";
import {
  apiLogin,
  apiLogout,
  apiMe,
  apiRegister,
  getAuthToken,
  ApiError,
  type ApiUser,
  type RegisterPayload,
} from "@/services/auth";
import {
  apiCreateStaff,
  apiDeleteStaff,
  apiListStaff,
  apiUpdateStaff,
  type ApiStaff,
} from "@/services/staff";
import {
  apiAssignStaff,
  apiListUsers,
  apiUpdateTradeControl,
  apiSuspendUser,
  apiAdjustBalance,
  apiSetBalance,
  apiUpdateUserProfile,
  apiDeleteUser,
} from "@/services/users";
import { apiApproveKyc, apiRejectKyc, apiSubmitKyc } from "@/services/kyc";
import { apiGetPublicSettings, apiUpdateSettings } from "@/services/settings";
import {
  apiApproveDeposit,
  apiCancelDeposit,
  apiCreateDeposit,
  apiListDeposits,
  apiListMyDeposits,
  apiRejectDeposit,
} from "@/services/deposits";
import {
  apiApproveWithdrawal,
  apiCancelWithdrawal,
  apiCreateWithdrawal,
  apiListWithdrawals,
  apiListMyWithdrawals,
  apiRejectWithdrawal,
} from "@/services/withdrawals";
import {
  apiClearTrades,
  apiCloseMyTrade,
  apiCreateTrade,
  apiDeleteTrade,
  apiListMyTrades,
  apiListTrades,
  apiPlanTrade,
  apiSettleTrade,
} from "@/services/trades";
import { apiCloseSpot, apiListMySpot, apiListSpot, apiOpenSpot } from "@/services/spot";
import { subscribeRealtime } from "@/services/realtime";
import { toast } from "sonner";
import {
  apiGetSupportUnread,
  type SupportMessage,
  type SupportThread,
} from "@/services/support";

/* ---------------- Types ---------------- */
export type Role = "user" | "admin" | "staff";
export type ForceOutcome = "random" | "win" | "lose";

export type KycStatus = "none" | "pending" | "approved" | "rejected";
export type Kyc = {
  status: KycStatus;
  cnicFront?: string;   // data URL
  cnicBack?: string;
  face?: string;
  submittedAt?: number;
  reviewedAt?: number;
  reviewedBy?: string;
  reason?: string;      // rejection reason
};

export type User = {
  id: string;
  email: string;
  fname: string;
  lname: string;
  name: string;          // derived `${fname} ${lname}`
  phone: string;
  country: string;       // ISO code
  pwHash: string;
  role?: Role;
  assignedStaffId?: string | null;
  assignedStaffName?: string | null;
  createdAt: number;
  suspended?: boolean;
  kyc: Kyc;
  forceOutcome: ForceOutcome;
  profitPercent?: number | null;
  lossPercent?: number;
};

export type RegisterInput = {
  fname: string;
  lname: string;
  email: string;
  phone: string;
  country: string;
  password: string;
};

export type Staff = {
  id: string;
  fname: string;
  lname: string;
  name: string;
  email: string;
  phone: string;
  createdAt: number;
};

export type StaffCreateInput = {
  fname: string;
  lname: string;
  email: string;
  phone: string;
  password: string;
};

export type StaffUpdateInput = {
  fname: string;
  lname: string;
  email: string;
  phone: string;
  password?: string;
};

/** Binary-option trade (timed, UP/DOWN, admin-controlled payout). */
export type BinaryTrade = {
  id: string;
  userId: string;
  symbol: string;
  direction: "up" | "down";
  stake: number;
  durationSec: number;
  entryPrice: number;
  openedAt: number;
  expiresAt: number;
  status: "active" | "won" | "lost" | "draw";
  closePrice?: number;
  payout?: number;       // amount credited back to wallet (stake+profit on win; 0 on loss)
  pnl?: number;          // payout - stake (profit/loss)
  resolvedAt?: number;
  outcomeSource?: "random" | "market" | "forced-win" | "forced-loss" | "admin" | "planned" | "user-close";
  plannedOutcome?: "profit" | "loss";
  /** Market moved against this trade; final status still settles at expiresAt */
  lossLocked?: boolean;
  customProfitPercent?: number;
  customLossPercent?: number;
};

export type Deposit = {
  id: string;
  userId: string;
  amount: number;
  txHash?: string;
  screenshot: string;
  note?: string;
  status: "pending" | "approved" | "rejected";
  rejectReason?: string;
  processedBy?: string;
  createdAt: number;
  processedAt?: number;
};

export type Withdrawal = {
  id: string;
  userId: string;
  amount: number;
  method: "trc20" | "bank";
  trc20Address?: string;
  bankName?: string;
  accountNumber?: string;
  accountName?: string;
  note?: string;
  status: "pending" | "approved" | "rejected";
  rejectReason?: string;
  processedBy?: string;
  createdAt: number;
  processedAt?: number;
};

/** Spot position — buy/long or sell/short; user closes manually. */
export type SpotPosition = {
  id: string;
  userId: string;
  symbol: string;
  side: "buy" | "sell";
  quantity: number;
  entryPrice: number;
  entryFee: number;
  cost: number;
  openedAt: number;
  status: "open" | "closed";
  exitPrice?: number;
  exitFee?: number;
  proceeds?: number;
  pnl?: number;
  pnlPercent?: number;
  closedAt?: number;
  buyPrice?: number;
  buyFee?: number;
  sellPrice?: number;
  sellFee?: number;
};

export type AuditEntry = {
  id: string;
  at: number;
  actor: string;
  actorRole: "admin" | "staff";
  action: string;
  target?: string;
  summary: string;
};

export type Wallet = { cashUSDT: number };
type Session = { userId: string; role: Role } | null;

export type PlaceBinaryInput = {
  symbol: string;
  direction: "up" | "down";
  stake: number;
  durationSec: number;
};

type Store = {
  // session / auth
  session: Session;
  user: User | null;
  staffMe: Staff | null;
  isAdmin: boolean;
  isStaff: boolean;
  isStaffOrAdmin: boolean;
  login: (email: string, password: string) => Promise<{ ok: boolean; msg: string; role?: Role }>;
  register: (input: RegisterInput) => Promise<{ ok: boolean; msg: string }>;
  logout: () => void;
  authReady: boolean;
  supportUnread: number;
  clearSupportUnread: () => void;
  setSupportInboxFocused: (focused: boolean) => void;
  refreshSupportUnread: () => Promise<void>;

  // data (current user view)
  wallet: Wallet;
  myTrades: BinaryTrade[];          // active + resolved (for me)
  assets: Asset[];

  // settings
  payoutPercent: number;            // admin-set, default 85

  // KYC
  submitKyc: (cnicFront: File | null, cnicBack: File | null) => Promise<{ ok: boolean; msg: string }>;

  // user actions
  placeBinaryTrade: (t: PlaceBinaryInput) => Promise<{ ok: boolean; msg: string }>;
  closeMyTrade: (id: string, closePrice?: number) => Promise<{ ok: boolean; msg: string }>;
  syncMyWallet: (cashUSDT: number) => void;
  spotFeePercent: number;
  mySpotPositions: SpotPosition[];
  allSpotPositions: SpotPosition[];
  openSpotPosition: (input: { symbol: string; quantity: number; side: "buy" | "sell" }) => Promise<{ ok: boolean; msg: string }>;
  closeSpotPosition: (id: string) => Promise<{ ok: boolean; msg: string }>;
  loadSpotPositions: () => Promise<void>;

  // admin / staff shared
  allUsers: User[];
  managedUsers: User[];
  managedTrades: BinaryTrade[];
  managedDeposits: Deposit[];
  managedWithdrawals: Withdrawal[];
  allTrades: BinaryTrade[];
  walletsByUser: Record<string, Wallet>;
  adminSuspendUser: (userId: string, suspended: boolean) => Promise<{ ok: boolean; msg: string }>;
  adminAdjustBalance: (userId: string, delta: number) => Promise<{ ok: boolean; msg: string }>;
  adminSetBalance: (userId: string, balance: number) => Promise<{ ok: boolean; msg: string }>;
  adminDeleteUser: (userId: string) => Promise<{ ok: boolean; msg: string }>;
  adminUpdateUser: (userId: string, patch: { fname?: string; lname?: string; email?: string; phone?: string; country?: string }) => Promise<{ ok: boolean; msg: string }>;
  adminSetForceOutcome: (
    userId: string,
    outcome: ForceOutcome,
    opts?: { profitPercent?: number | null; lossPercent?: number }
  ) => Promise<{ ok: boolean; msg: string }>;
  adminPlanTrade: (
    tradeId: string,
    plannedOutcome: "profit" | "loss" | null,
    profitPercent?: number,
    lossPercent?: number
  ) => Promise<void>;
  adminForceCloseTrade: (
    id: string,
    outcome: "profit" | "loss",
    profitPercent?: number,
    lossPercent?: number
  ) => Promise<void>;
  adminDeleteTrade: (id: string) => Promise<void>;
  adminClearTrades: () => Promise<void>;
  loadTrades: () => Promise<void>;

  // KYC moderation
  adminApproveKyc: (userId: string) => Promise<void>;
  adminRejectKyc: (userId: string, reason: string) => Promise<void>;

  loadUsers: () => Promise<{ ok: boolean; msg?: string; silent?: boolean }>;
  adminAssignStaff: (userId: string, staffId: string | null) => Promise<{ ok: boolean; msg: string }>;

  // staff management (admin only)
  allStaff: Staff[];
  loadStaff: () => Promise<{ ok: boolean; msg?: string }>;
  adminCreateStaff: (input: StaffCreateInput) => Promise<{ ok: boolean; msg: string }>;
  adminUpdateStaff: (id: string, input: StaffUpdateInput) => Promise<{ ok: boolean; msg: string }>;
  adminDeleteStaff: (id: string) => Promise<{ ok: boolean; msg: string }>;

  // deposits / wallet address
  walletAddress: string;
  myDeposits: Deposit[];
  allDeposits: Deposit[];
  createDeposit: (amount: number, screenshot: File, txHash?: string, note?: string) => Promise<{ ok: boolean; msg: string }>;
  cancelMyDeposit: (id: string) => Promise<{ ok: boolean; msg: string }>;
  adminSetWalletAddress: (addr: string) => Promise<{ ok: boolean; msg: string }>;
  adminSetPayoutPercent: (pct: number) => Promise<{ ok: boolean; msg: string }>;
  adminSetSpotFeePercent: (pct: number) => Promise<{ ok: boolean; msg: string }>;
  adminApproveDeposit: (id: string) => Promise<void>;
  adminRejectDeposit: (id: string, reason?: string) => Promise<void>;
  loadSettings: () => Promise<void>;
  loadDeposits: () => Promise<void>;

  myWithdrawals: Withdrawal[];
  allWithdrawals: Withdrawal[];
  createWithdrawal: (input: {
    amount: number;
    method: "trc20" | "bank";
    trc20Address?: string;
    bankName?: string;
    accountNumber?: string;
    accountName?: string;
    note?: string;
  }) => Promise<{ ok: boolean; msg: string }>;
  cancelMyWithdrawal: (id: string) => Promise<{ ok: boolean; msg: string }>;
  adminApproveWithdrawal: (id: string) => Promise<void>;
  adminRejectWithdrawal: (id: string, reason?: string) => Promise<void>;
  loadWithdrawals: () => Promise<void>;

  // audit
  auditLog: AuditEntry[];
  auditLogFor: (target: string) => AuditEntry[];
  adminClearAuditLog: () => void;
};

const Ctx = createContext<Store | null>(null);
const KEY = "evios_trader_v4";

const STARTING_CASH = 0;

function apiStaffToStore(s: ApiStaff): Staff {
  return {
    id: s.id,
    fname: s.fname,
    lname: s.lname,
    name: s.name,
    email: s.email,
    phone: s.phone,
    createdAt: s.createdAt,
  };
}

function isPlatformUser(u: Pick<User, "role">): boolean {
  return (u.role ?? "user") === "user";
}

function apiUserToStoreUser(u: ApiUser): User {
  return {
    id: u.id,
    email: u.email,
    fname: u.fname,
    lname: u.lname,
    name: u.name,
    phone: u.phone,
    country: u.country,
    pwHash: "",
    role: u.role,
    assignedStaffId: u.assignedStaffId ?? null,
    assignedStaffName: u.assignedStaffName ?? null,
    createdAt: u.createdAt,
    suspended: u.suspended,
    kyc: u.kyc,
    forceOutcome: u.forceOutcome ?? "random",
    profitPercent: u.profitPercent ?? null,
    lossPercent: u.lossPercent ?? 100,
  };
}

function mergeUsersFromApi(setUsers: React.Dispatch<React.SetStateAction<User[]>>, apiUsers: ApiUser[]) {
  setUsers((xs) => {
    const map = new Map(xs.map((u) => [u.id, u]));
    for (const api of apiUsers) {
      if (!isPlatformUser(api)) continue;
      const mapped = apiUserToStoreUser(api);
      const existing = map.get(mapped.id);
      if (existing) {
        map.set(mapped.id, {
          ...existing,
          ...mapped,
          kyc: mapped.kyc,
        });
      } else {
        map.set(mapped.id, mapped);
      }
    }
    return Array.from(map.values()).filter(isPlatformUser);
  });
}

function syncUserFromApi(setUsers: React.Dispatch<React.SetStateAction<User[]>>, setWallets: React.Dispatch<React.SetStateAction<Record<string, Wallet>>>, apiUser: ApiUser) {
  if (!isPlatformUser(apiUser)) return;
  const mapped = apiUserToStoreUser(apiUser);
  setUsers((xs) => {
    const i = xs.findIndex((x) => x.id === mapped.id);
    if (i >= 0) {
      const next = [...xs];
      next[i] = { ...next[i], ...mapped };
      return next;
    }
    return [...xs, mapped];
  });
  if (apiUser.wallet) {
    setWallets((w) => ({ ...w, [apiUser.id]: { cashUSDT: apiUser.wallet!.cashUSDT } }));
  }
}

type Persist = {
  session: Session;
  users: User[];
  staff: Staff[];
  wallets: Record<string, Wallet>;
  trades: BinaryTrade[];
  deposits: Deposit[];
  walletAddress: string;
  payoutPercent: number;
  auditLog: AuditEntry[];
};

function defaultPersist(): Persist {
  return {
    session: null, users: [], staff: [], wallets: {}, trades: [], deposits: [],
    walletAddress: "", payoutPercent: DEFAULT_PAYOUT_PERCENT, auditLog: [],
  };
}

function loadPersist(): Persist {
  if (typeof window === "undefined") return defaultPersist();
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return { ...defaultPersist(), ...JSON.parse(raw) };
  } catch {}
  return defaultPersist();
}

/* ---------------- Provider ---------------- */
export function StoreProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session>(null);
  const [users, setUsers] = useState<User[]>([]);
  const [staff, setStaff] = useState<Staff[]>([]);
  const [wallets, setWallets] = useState<Record<string, Wallet>>({});
  const [trades, setTrades] = useState<BinaryTrade[]>([]);
  const [deposits, setDeposits] = useState<Deposit[]>([]);
  const [withdrawals, setWithdrawals] = useState<Withdrawal[]>([]);
  const [spotPositions, setSpotPositions] = useState<SpotPosition[]>([]);
  const [walletAddress, setWalletAddress] = useState<string>("");
  const [payoutPercent, setPayoutPercent] = useState<number>(DEFAULT_PAYOUT_PERCENT);
  const [spotFeePercent, setSpotFeePercent] = useState<number>(0.1);
  const [auditLog, setAuditLog] = useState<AuditEntry[]>([]);
  const [assets, setAssets] = useState<Asset[]>(SEED_ASSETS);
  const [hydrated, setHydrated] = useState(false);
  const [authReady, setAuthReady] = useState(false);
  const [supportUnread, setSupportUnread] = useState(0);
  const supportInboxFocusRef = useRef(0);
  const supportLoginNotifyRef = useRef<string | null>(null);

  const assetsRef = useRef<Asset[]>(assets);
  useEffect(() => { assetsRef.current = assets; }, [assets]);
  const usersRef = useRef<User[]>(users);
  useEffect(() => { usersRef.current = users; }, [users]);
  const payoutRef = useRef<number>(payoutPercent);
  useEffect(() => { payoutRef.current = payoutPercent; }, [payoutPercent]);

  /* Hydrate */
  useEffect(() => {
    const p = loadPersist();
    setSession(p.session);
    setUsers((p.users || []).filter(isPlatformUser));
    setStaff(p.staff);
    setWallets(p.wallets);
    setTrades(p.trades);
    setDeposits(p.deposits);
    setPayoutPercent(p.payoutPercent ?? DEFAULT_PAYOUT_PERCENT);
    setAuditLog(p.auditLog || []);
    setHydrated(true);
  }, []);

  /* Load platform settings from API */
  const loadSettings: Store["loadSettings"] = useCallback(async () => {
    try {
      const data = await apiGetPublicSettings();
      setWalletAddress(data.walletAddress || "");
      if (Number.isFinite(data.payoutPercent)) {
        setPayoutPercent(data.payoutPercent);
      }
      if (Number.isFinite((data as { spotFeePercent?: number }).spotFeePercent)) {
        setSpotFeePercent((data as { spotFeePercent: number }).spotFeePercent);
      }
    } catch {
      // keep cached/local value on failure
    }
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    void loadSettings();
  }, [hydrated, loadSettings]);

  /* Restore session from API token */
  useEffect(() => {
    if (!hydrated) return;
    const token = getAuthToken();
    if (!token) {
      setSession(null);
      setAuthReady(true);
      return;
    }
    apiMe()
      .then(({ user }) => {
        if (user.role === "user") {
          syncUserFromApi(setUsers, setWallets, user);
        } else {
          setUsers((xs) => xs.filter((u) => isPlatformUser(u) && u.id !== user.id));
        }
        if (user.role === "staff") {
          setStaff((xs) => {
            const mapped = apiStaffToStore({ ...user, role: "staff" });
            if (xs.some((s) => s.id === mapped.id)) {
              return xs.map((s) => (s.id === mapped.id ? mapped : s));
            }
            return [...xs, mapped];
          });
        }
        setSession({ userId: user.id, role: user.role });
      })
      .catch(() => {
        apiLogout();
        setSession(null);
      })
      .finally(() => setAuthReady(true));
  }, [hydrated]);

  /* Persist */
  useEffect(() => {
    if (!hydrated) return;
    const data: Persist = { session, users, staff, wallets, trades, deposits, walletAddress, payoutPercent, auditLog };
    try { localStorage.setItem(KEY, JSON.stringify(data)); } catch {}
  }, [session, users, staff, wallets, trades, deposits, walletAddress, payoutPercent, auditLog, hydrated]);

  /* ---------- Live prices (Binance ws for crypto + sim for others) ---------- */
  useEffect(() => {
    if (typeof window === "undefined") return;
    const cryptoSymbols = SEED_ASSETS
      .filter((a) => a.category === "crypto")
      .map((a) => toBinanceSymbol(a.symbol)!)
      .filter(Boolean);
    const streams = cryptoSymbols.map((s) => `${s.toLowerCase()}@ticker`).join("/");
    const url = `wss://stream.binance.com:9443/stream?streams=${streams}`;

    let ws: WebSocket | null = null;
    let retry = 0;
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
    let buf: Record<string, { price: number; change24h: number; volume: number }> = {};
    const connect = () => {
      try {
        ws = new WebSocket(url);
        ws.onopen = () => { retry = 0; };
        ws.onmessage = (ev) => {
          try {
            const m = JSON.parse(ev.data);
            const d = m?.data;
            if (!d?.s) return;
            buf[d.s] = { price: parseFloat(d.c), change24h: parseFloat(d.P), volume: parseFloat(d.q) };
          } catch {}
        };
        ws.onclose = () => {
          retry++;
          reconnectTimer = setTimeout(connect, Math.min(30000, 1000 * 2 ** retry));
        };
        ws.onerror = () => ws?.close();
      } catch {
        reconnectTimer = setTimeout(connect, 5000);
      }
    };
    connect();

    const flush = setInterval(() => {
      if (Object.keys(buf).length === 0) return;
      const b = buf; buf = {};
      setAssets((prev) => prev.map((a) => {
        const k = toBinanceSymbol(a.symbol);
        if (!k || !b[k]) return a;
        return { ...a, price: b[k].price, change24h: b[k].change24h, volume: b[k].volume };
      }));
    }, 800);

    const sim = setInterval(() => {
      setAssets((prev) => prev.map((a) => {
        if (a.category === "crypto" || a.category === "forex") return a;
        const drift = (Math.random() - 0.5) * 0.002;
        return { ...a, price: Number((a.price * (1 + drift)).toFixed(4)), change24h: Number((a.change24h + drift * 5).toFixed(2)) };
      }));
    }, 3000);

    const refreshForex = async () => {
      try {
        const rates = await fetchUsdForexRates();
        if (!Object.keys(rates).length) return;
        setAssets((prev) =>
          prev.map((a) => {
            if (a.category !== "forex") return a;
            const next = rates[a.symbol];
            if (!(next > 0)) return a;
            return {
              ...a,
              price: next,
            };
          })
        );
      } catch {
        // keep last known forex prices
      }
    };
    void refreshForex();
    const forexPoll = setInterval(() => { void refreshForex(); }, 60_000);

    return () => {
      if (reconnectTimer) clearTimeout(reconnectTimer);
      clearInterval(flush);
      clearInterval(sim);
      clearInterval(forexPoll);
      ws?.close();
    };
  }, []);

  /* ---------- Derived ---------- */
  const user = session && session.role === "user" ? users.find((u) => u.id === session.userId) ?? null : null;
  const staffMe = session && session.role === "staff" ? staff.find((s) => s.id === session.userId) ?? null : null;
  const isAdmin = session?.role === "admin";
  const isStaff = session?.role === "staff" && !!staffMe;
  const isStaffOrAdmin = !!(isAdmin || isStaff);
  const wallet: Wallet = user ? wallets[user.id] || { cashUSDT: 0 } : { cashUSDT: 0 };
  const myTrades = user ? trades.filter((t) => t.userId === user.id) : [];
  const mySpotPositions = user ? spotPositions.filter((p) => p.userId === user.id) : [];
  const myDeposits = user ? deposits.filter((d) => d.userId === user.id) : [];
  const myWithdrawals = user ? withdrawals.filter((w) => w.userId === user.id) : [];
  const platformUsers = users.filter(isPlatformUser);
  const staffUserId = staffMe?.id ?? (session?.role === "staff" ? session.userId : null);
  const managedUsers =
    isStaff && staffUserId
      ? platformUsers.filter((u) => u.assignedStaffId === staffUserId)
      : platformUsers;
  const managedUserIds = new Set(managedUsers.map((u) => u.id));
  const managedTrades = isStaff ? trades.filter((t) => managedUserIds.has(t.userId)) : trades;
  const managedDeposits = isStaff ? deposits.filter((d) => managedUserIds.has(d.userId)) : deposits;
  const managedWithdrawals = isStaff ? withdrawals.filter((w) => managedUserIds.has(w.userId)) : withdrawals;

  /* ---------- Auth ---------- */
  const register: Store["register"] = async (input) => {
    try {
      const payload: RegisterPayload = {
        fname: input.fname.trim(),
        lname: input.lname.trim(),
        email: input.email.trim().toLowerCase(),
        phone: input.phone.trim(),
        country: input.country.trim(),
        password: input.password,
      };
      const data = await apiRegister(payload);
      if (!data.user) return { ok: false, msg: data.msg || "Registration failed" };
      syncUserFromApi(setUsers, setWallets, data.user);
      setWallets((w) => ({ ...w, [data.user!.id]: { cashUSDT: data.user!.wallet?.cashUSDT ?? STARTING_CASH } }));
      setSession({ userId: data.user.id, role: data.user.role });
      return { ok: true, msg: data.msg };
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Registration failed";
      return { ok: false, msg };
    }
  };

  const login: Store["login"] = async (email, password) => {
    try {
      const data = await apiLogin(email.trim().toLowerCase(), password);
      if (!data.user) return { ok: false, msg: data.msg || "Login failed" };

      if (data.user.role === "user") {
        syncUserFromApi(setUsers, setWallets, data.user);
      } else {
        setUsers((xs) => xs.filter((u) => isPlatformUser(u) && u.id !== data.user!.id));
      }

      if (data.user.role === "staff") {
        const mapped = apiStaffToStore({ ...data.user, role: "staff" });
        setStaff((xs) => {
          if (xs.some((s) => s.id === mapped.id)) {
            return xs.map((s) => (s.id === mapped.id ? mapped : s));
          }
          return [...xs, mapped];
        });
      }

      setSession({ userId: data.user.id, role: data.user.role });
      return { ok: true, msg: data.msg, role: data.user.role };
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Login failed";
      return { ok: false, msg };
    }
  };

  const logout = () => {
    apiLogout();
    setSession(null);
    setSupportUnread(0);
    supportLoginNotifyRef.current = null;
    supportInboxFocusRef.current = 0;
  };

  /* ---------- KYC ---------- */
  const submitKyc: Store["submitKyc"] = async (cnicFront, cnicBack) => {
    if (!user) return { ok: false, msg: "Please sign in first" };
    if (!cnicFront || !cnicBack) return { ok: false, msg: "Front and back CNIC photos are required" };

    try {
      const data = await apiSubmitKyc({ cnicFront, cnicBack });
      if (!data.ok) return { ok: false, msg: data.msg || "Could not submit KYC" };

      if (data.user) {
        syncUserFromApi(setUsers, setWallets, data.user);
      } else if (session?.role === "admin" || session?.role === "staff") {
        await loadUsers();
      }
      return { ok: true, msg: data.msg || "KYC submitted — awaiting review" };
    } catch (err) {
      return { ok: false, msg: err instanceof Error ? err.message : "Could not submit KYC" };
    }
  };

  /* ---------- Binary trading ---------- */
  const loadTrades: Store["loadTrades"] = useCallback(async () => {
    const token = getAuthToken();
    if (!token || !session) return;
    try {
      if (session.role === "user") {
        const data = await apiListMyTrades();
        setTrades(data.trades ?? []);
        if (data.wallet) {
          setWallets((w) => ({ ...w, [session.userId]: { cashUSDT: data.wallet!.cashUSDT } }));
        }
      } else if (session.role === "admin" || session.role === "staff") {
        const data = await apiListTrades();
        setTrades(data.trades ?? []);
      }
    } catch {
      // ignore polling errors
    }
  }, [session]);

  useEffect(() => {
    if (!hydrated || !authReady || !session) return;
    void loadTrades();
  }, [hydrated, authReady, session, loadTrades]);

  const loadSpotPositions: Store["loadSpotPositions"] = useCallback(async () => {
    const token = getAuthToken();
    if (!token || !session) return;
    try {
      if (session.role === "user") {
        const data = await apiListMySpot();
        setSpotPositions(data.positions ?? []);
        if (data.wallet) {
          setWallets((w) => ({ ...w, [session.userId]: { cashUSDT: data.wallet!.cashUSDT } }));
        }
        if (Number.isFinite(data.spotFeePercent)) setSpotFeePercent(data.spotFeePercent!);
      } else if (session.role === "admin" || session.role === "staff") {
        const data = await apiListSpot();
        setSpotPositions(data.positions ?? []);
      }
    } catch {
      // ignore
    }
  }, [session]);

  useEffect(() => {
    if (!hydrated || !authReady || !session) return;
    void loadSpotPositions();
  }, [hydrated, authReady, session, loadSpotPositions]);

  const placeBinaryTrade: Store["placeBinaryTrade"] = async ({ symbol, direction, stake, durationSec }) => {
    if (!user) return { ok: false, msg: "Please sign in first" };
    if (user.suspended) return { ok: false, msg: "Your account is suspended" };
    if (user.kyc.status !== "approved") return { ok: false, msg: "Complete KYC verification to start trading" };
    if (wallet.cashUSDT <= 0) return { ok: false, msg: "Add funds to your wallet before placing trades" };
    const a = assets.find((x) => x.symbol === symbol);
    if (!a) return { ok: false, msg: "Unknown market" };
    if (!(stake > 0)) return { ok: false, msg: "Enter a stake greater than 0" };
    if (stake > wallet.cashUSDT) return { ok: false, msg: `Insufficient balance (have $${wallet.cashUSDT.toFixed(2)})` };
    if (!VALID_TRADE_DURATIONS.includes(durationSec as typeof VALID_TRADE_DURATIONS[number])) {
      return { ok: false, msg: "Invalid duration" };
    }
    try {
      const data = await apiCreateTrade({
        symbol,
        direction,
        stake,
        durationSec,
        entryPrice: a.price,
      });
      if (data.trade) {
        setTrades((xs) => [data.trade!, ...xs.filter((t) => t.id !== data.trade!.id)]);
      } else {
        await loadTrades();
      }
      if (data.wallet) {
        setWallets((w) => ({ ...w, [user.id]: { cashUSDT: data.wallet!.cashUSDT } }));
      }
      return { ok: true, msg: data.msg || `${direction.toUpperCase()} trade placed` };
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Could not place trade";
      return { ok: false, msg };
    }
  };

  const closeMyTrade: Store["closeMyTrade"] = async (id, closePrice) => {
    if (!user) return { ok: false, msg: "Please sign in first" };
    if (user.suspended) return { ok: false, msg: "Your account is suspended" };
    try {
      const data = await apiCloseMyTrade(id, closePrice != null ? { closePrice } : undefined);
      if (data.trade) {
        setTrades((xs) => xs.map((t) => (t.id === id ? data.trade! : t)));
      } else {
        await loadTrades();
      }
      if (data.wallet) {
        setWallets((w) => ({ ...w, [user.id]: { cashUSDT: data.wallet!.cashUSDT } }));
      }
      return { ok: true, msg: data.msg || "Trade closed" };
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Could not close trade";
      return { ok: false, msg };
    }
  };

  const syncMyWallet: Store["syncMyWallet"] = (cashUSDT) => {
    if (!session?.userId || !Number.isFinite(cashUSDT) || cashUSDT < 0) return;
    setWallets((w) => ({ ...w, [session.userId]: { cashUSDT } }));
  };

  const openSpotPosition: Store["openSpotPosition"] = async ({ symbol, quantity, side }) => {
    if (!user) return { ok: false, msg: "Please sign in first" };
    if (user.suspended) return { ok: false, msg: "Your account is suspended" };
    if (user.kyc.status !== "approved") return { ok: false, msg: "Complete KYC verification to start trading" };
    const a = assets.find((x) => x.symbol === symbol);
    if (!a) return { ok: false, msg: "Unknown market" };
    if (!(quantity > 0)) return { ok: false, msg: "Enter a quantity greater than 0" };
    if (side !== "buy" && side !== "sell") return { ok: false, msg: "Invalid side" };
    try {
      const data = await apiOpenSpot({ symbol, quantity, entryPrice: a.price, side });
      if (data.position) {
        setSpotPositions((xs) => [data.position!, ...xs.filter((p) => p.id !== data.position!.id)]);
      } else {
        await loadSpotPositions();
      }
      if (data.wallet) {
        setWallets((w) => ({ ...w, [user.id]: { cashUSDT: data.wallet!.cashUSDT } }));
      }
      if (Number.isFinite(data.spotFeePercent)) setSpotFeePercent(data.spotFeePercent!);
      return { ok: true, msg: data.msg || "Spot position opened" };
    } catch (err) {
      return { ok: false, msg: err instanceof Error ? err.message : "Could not open spot position" };
    }
  };

  const closeSpotPosition: Store["closeSpotPosition"] = async (id) => {
    if (!user) return { ok: false, msg: "Please sign in first" };
    const pos = spotPositions.find((p) => p.id === id);
    if (!pos) return { ok: false, msg: "Position not found" };
    const a = assets.find((x) => x.symbol === pos.symbol);
    const exitPrice = a?.price ?? pos.entryPrice;
    try {
      const data = await apiCloseSpot(id, exitPrice);
      if (data.position) {
        setSpotPositions((xs) => xs.map((p) => (p.id === id ? data.position! : p)));
      } else {
        await loadSpotPositions();
      }
      if (data.wallet) {
        setWallets((w) => ({ ...w, [user.id]: { cashUSDT: data.wallet!.cashUSDT } }));
      }
      return { ok: true, msg: data.msg || "Position closed" };
    } catch (err) {
      return { ok: false, msg: err instanceof Error ? err.message : "Could not close position" };
    }
  };

  /* ---------- Audit helper ---------- */
  const actorName = isAdmin ? "Administrator" : staffMe?.name || "Staff";
  const actorRole: "admin" | "staff" = isAdmin ? "admin" : "staff";
  const userNameOf = (uid: string) => users.find((u) => u.id === uid)?.name || "—";
  const audit = (action: string, summary: string, target?: string) => {
    if (!isStaffOrAdmin) return;
    const entry: AuditEntry = {
      id: crypto.randomUUID(), at: Date.now(), actor: actorName, actorRole, action, target, summary,
    };
    setAuditLog((xs) => [entry, ...xs].slice(0, 500));
  };

  /* ---------- Admin user mgmt ---------- */
  const adminSuspendUser: Store["adminSuspendUser"] = async (userId, suspended) => {
    try {
      const data = await apiSuspendUser(userId, suspended);
      const mapped = apiUserToStoreUser(data.user);
      setUsers((xs) => xs.map((u) => (u.id === userId ? { ...u, ...mapped } : u)));
      audit(suspended ? "user.suspend" : "user.unsuspend", `${suspended ? "Suspended" : "Reactivated"} ${userNameOf(userId)}`, userId);
      return { ok: true, msg: data.msg };
    } catch (err) {
      return { ok: false, msg: err instanceof Error ? err.message : "Could not update suspension" };
    }
  };
  const adminAdjustBalance: Store["adminAdjustBalance"] = async (userId, delta) => {
    try {
      const data = await apiAdjustBalance(userId, delta);
      if (data.wallet) setWallets((w) => ({ ...w, [userId]: { cashUSDT: data.wallet.cashUSDT } }));
      if (data.user) {
        const mapped = apiUserToStoreUser(data.user);
        setUsers((xs) => xs.map((u) => (u.id === userId ? { ...u, ...mapped } : u)));
      }
      audit("wallet.adjust", `Adjusted ${userNameOf(userId)}'s balance by ${delta >= 0 ? "+" : ""}$${delta.toFixed(2)}`, userId);
      return { ok: true, msg: data.msg };
    } catch (err) {
      return { ok: false, msg: err instanceof Error ? err.message : "Could not adjust balance" };
    }
  };
  const adminSetBalance: Store["adminSetBalance"] = async (userId, balance) => {
    if (!Number.isFinite(balance) || balance < 0) return { ok: false, msg: "Invalid balance" };
    try {
      const data = await apiSetBalance(userId, balance);
      if (data.wallet) setWallets((w) => ({ ...w, [userId]: { cashUSDT: data.wallet.cashUSDT } }));
      if (data.user) {
        const mapped = apiUserToStoreUser(data.user);
        setUsers((xs) => xs.map((u) => (u.id === userId ? { ...u, ...mapped } : u)));
      }
      audit("wallet.set", `Set ${userNameOf(userId)}'s balance to $${balance.toFixed(2)}`, userId);
      return { ok: true, msg: data.msg };
    } catch (err) {
      return { ok: false, msg: err instanceof Error ? err.message : "Could not set balance" };
    }
  };
  const adminDeleteUser: Store["adminDeleteUser"] = async (userId) => {
    const name = userNameOf(userId);
    try {
      await apiDeleteUser(userId);
      setUsers((xs) => xs.filter((u) => u.id !== userId));
      setTrades((xs) => xs.filter((t) => t.userId !== userId));
      setDeposits((xs) => xs.filter((d) => d.userId !== userId));
      setWallets((w) => { const n = { ...w }; delete n[userId]; return n; });
      audit("user.delete", `Deleted user ${name}`, userId);
      return { ok: true, msg: "User deleted" };
    } catch (err) {
      return { ok: false, msg: err instanceof Error ? err.message : "Could not delete user" };
    }
  };
  const adminUpdateUser: Store["adminUpdateUser"] = async (userId, patch) => {
    try {
      const data = await apiUpdateUserProfile(userId, patch);
      const mapped = apiUserToStoreUser(data.user);
      setUsers((xs) => xs.map((u) => (u.id === userId ? { ...u, ...mapped } : u)));
      audit("user.update", `Updated profile for ${userNameOf(userId)}`, userId);
      return { ok: true, msg: data.msg || "User updated" };
    } catch (err) {
      return { ok: false, msg: err instanceof Error ? err.message : "Could not update user" };
    }
  };
  const adminSetForceOutcome: Store["adminSetForceOutcome"] = async (userId, outcome, opts) => {
    try {
      const data = await apiUpdateTradeControl(userId, {
        forceOutcome: outcome,
        profitPercent: opts?.profitPercent,
        lossPercent: opts?.lossPercent,
      });
      const mapped = apiUserToStoreUser(data.user);
      setUsers((xs) => xs.map((u) => (u.id === userId ? { ...u, ...mapped } : u)));
      audit("user.outcome", `Set trade mode for ${userNameOf(userId)} → ${outcome.toUpperCase()}`, userId);
      return { ok: true, msg: data.msg };
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Could not update trade control";
      return { ok: false, msg };
    }
  };
  const adminPlanTrade: Store["adminPlanTrade"] = async (tradeId, plannedOutcome, profitPercent, lossPercent) => {
    const data = await apiPlanTrade(tradeId, { plannedOutcome, profitPercent, lossPercent });
    if (data.trade) {
      setTrades((xs) => xs.map((t) => (t.id === tradeId ? data.trade! : t)));
    } else {
      await loadTrades();
    }
  };
  const adminForceCloseTrade: Store["adminForceCloseTrade"] = async (id, outcome, profitPercent, lossPercent) => {
    const data = await apiSettleTrade(id, { outcome, profitPercent, lossPercent });
    if (data.trade) {
      setTrades((xs) => xs.map((t) => (t.id === id ? data.trade! : t)));
      audit(
        "trade.force",
        `Settled ${userNameOf(data.trade.userId)}'s ${data.trade.symbol} as ${outcome.toUpperCase()}`,
        id
      );
      if (data.userId && data.userWallet) {
        setWallets((w) => ({ ...w, [data.userId!]: { cashUSDT: data.userWallet!.cashUSDT } }));
      }
    } else {
      await loadTrades();
    }
  };
  const adminDeleteTrade: Store["adminDeleteTrade"] = async (id) => {
    await apiDeleteTrade(id);
    setTrades((xs) => xs.filter((t) => t.id !== id));
    audit("trade.delete", "Deleted trade record", id);
  };
  const adminClearTrades: Store["adminClearTrades"] = async () => {
    const data = await apiClearTrades();
    setTrades((xs) => xs.filter((t) => t.status === "active"));
    audit("trade.clear", data.msg || "Cleared resolved trade records");
  };

  /* ---------- KYC moderation ---------- */
  const adminApproveKyc: Store["adminApproveKyc"] = async (userId) => {
    try {
      const data = await apiApproveKyc(userId);
      if (!data.ok) return;
      await loadUsers();
      audit("kyc.approve", `Approved KYC for ${userNameOf(userId)}`, userId);
    } catch {
      // ignore UI error; caller already shows toast in admin page
    }
  };
  const adminRejectKyc: Store["adminRejectKyc"] = async (userId, reason) => {
    try {
      const data = await apiRejectKyc(userId, reason);
      if (!data.ok) return;
      await loadUsers();
      audit("kyc.reject", `Rejected KYC for ${userNameOf(userId)} — ${reason}`, userId);
    } catch {
      // ignore UI error; caller already shows toast in admin page
    }
  };

  /* ---------- Deposits ---------- */
  const loadDeposits: Store["loadDeposits"] = useCallback(async () => {
    const token = getAuthToken();
    if (!token) return;
    try {
      if (session?.role === "user") {
        const data = await apiListMyDeposits();
        setDeposits(data.deposits ?? []);
      } else if (session?.role === "admin" || session?.role === "staff") {
        const data = await apiListDeposits();
        setDeposits(data.deposits ?? []);
      }
    } catch {
      // ignore polling errors
    }
  }, [session?.role]);

  useEffect(() => {
    if (!hydrated || !authReady || !session) return;
    void loadDeposits();
  }, [hydrated, authReady, session, loadDeposits]);

  const createDeposit: Store["createDeposit"] = async (amount, screenshot, txHash, note) => {
    if (!user) return { ok: false, msg: "Please sign in first" };
    if (user.suspended) return { ok: false, msg: "Your account is suspended" };
    if (user.kyc.status !== "approved") return { ok: false, msg: "Complete KYC verification to deposit" };
    if (!walletAddress) return { ok: false, msg: "Deposits are temporarily unavailable. Please contact support." };
    if (!(amount > 0)) return { ok: false, msg: "Enter an amount greater than 0" };
    if (!screenshot || !screenshot.type.startsWith("image/")) return { ok: false, msg: "Please attach a payment screenshot" };
    if (screenshot.size > 1_500_000) return { ok: false, msg: "Screenshot too large (max ~1.5 MB)" };
    try {
      const data = await apiCreateDeposit({ amount, screenshot, txHash, note });
      if (data.deposit) {
        setDeposits((xs) => [data.deposit!, ...xs.filter((d) => d.id !== data.deposit!.id)]);
      } else {
        await loadDeposits();
      }
      return { ok: true, msg: data.msg || "Deposit submitted. Awaiting admin verification." };
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Could not submit deposit";
      return { ok: false, msg };
    }
  };

  const cancelMyDeposit: Store["cancelMyDeposit"] = async (id) => {
    try {
      await apiCancelDeposit(id);
      setDeposits((xs) => xs.filter((d) => !(d.id === id && d.userId === user?.id && d.status === "pending")));
      return { ok: true, msg: "Request cancelled" };
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Could not cancel deposit";
      return { ok: false, msg };
    }
  };

  const adminSetWalletAddress: Store["adminSetWalletAddress"] = async (addr) => {
    const trimmed = addr.trim();
    try {
      const data = await apiUpdateSettings({ trc20WalletAddress: trimmed });
      setWalletAddress(data.walletAddress || trimmed);
      if (Number.isFinite(data.payoutPercent)) setPayoutPercent(data.payoutPercent);
      audit("settings.wallet", `Updated TRC20 deposit address to ${trimmed.slice(0, 8)}…`);
      return { ok: true, msg: data.msg || "Wallet address updated" };
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Could not update wallet address";
      return { ok: false, msg };
    }
  };
  const adminSetPayoutPercent: Store["adminSetPayoutPercent"] = async (pct) => {
    if (!Number.isFinite(pct) || pct < 0 || pct > 500) return { ok: false, msg: "Payout must be between 0 and 500" };
    try {
      const data = await apiUpdateSettings({ payoutPercent: pct });
      setPayoutPercent(data.payoutPercent ?? pct);
      if (Number.isFinite(data.spotFeePercent)) setSpotFeePercent(data.spotFeePercent!);
      audit("settings.payout", `Set payout to ${pct.toFixed(1)}%`);
      return { ok: true, msg: data.msg || "Payout updated" };
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Could not update payout";
      return { ok: false, msg };
    }
  };

  const adminSetSpotFeePercent: Store["adminSetSpotFeePercent"] = async (pct) => {
    if (!Number.isFinite(pct) || pct < 0 || pct > 10) return { ok: false, msg: "Spot fee must be between 0 and 10%" };
    try {
      const data = await apiUpdateSettings({ spotFeePercent: pct });
      setSpotFeePercent(data.spotFeePercent ?? pct);
      audit("settings.spotFee", `Set spot fee to ${pct.toFixed(2)}%`);
      return { ok: true, msg: data.msg || "Spot fee updated" };
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Could not update spot fee";
      return { ok: false, msg };
    }
  };

  const adminApproveDeposit: Store["adminApproveDeposit"] = async (id) => {
    const data = await apiApproveDeposit(id);
    if (data.deposit) {
      setDeposits((xs) => xs.map((x) => (x.id === id ? data.deposit! : x)));
      const d = data.deposit;
      audit("deposit.approve", `Approved $${d.amount.toFixed(2)} deposit from ${userNameOf(d.userId)}`, id);
      if (data.userId && data.userWallet) {
        setWallets((w) => ({ ...w, [data.userId!]: { cashUSDT: data.userWallet!.cashUSDT } }));
      }
    } else {
      await loadDeposits();
    }
  };
  const adminRejectDeposit: Store["adminRejectDeposit"] = async (id, reason) => {
    const data = await apiRejectDeposit(id, reason);
    if (data.deposit) {
      const d = data.deposit;
      audit("deposit.reject", `Rejected $${d.amount.toFixed(2)} deposit from ${userNameOf(d.userId)}${reason ? ` — ${reason}` : ""}`, id);
      setDeposits((xs) => xs.map((x) => (x.id === id ? data.deposit! : x)));
    } else {
      await loadDeposits();
    }
  };

  /* ---------- Withdrawals ---------- */
  const loadWithdrawals: Store["loadWithdrawals"] = useCallback(async () => {
    const token = getAuthToken();
    if (!token || !session) return;
    try {
      if (session.role === "user") {
        const data = await apiListMyWithdrawals();
        setWithdrawals(data.withdrawals ?? []);
        if (data.wallet) {
          setWallets((w) => ({ ...w, [session.userId]: { cashUSDT: data.wallet!.cashUSDT } }));
        }
      } else if (session.role === "admin" || session.role === "staff") {
        const data = await apiListWithdrawals();
        setWithdrawals(data.withdrawals ?? []);
      }
    } catch {
      // ignore polling errors
    }
  }, [session]);

  useEffect(() => {
    if (!hydrated || !authReady || !session) return;
    void loadWithdrawals();
  }, [hydrated, authReady, session, loadWithdrawals]);

  const createWithdrawal: Store["createWithdrawal"] = async (input) => {
    if (!user) return { ok: false, msg: "Please sign in first" };
    if (user.suspended) return { ok: false, msg: "Your account is suspended" };
    if (user.kyc.status !== "approved") return { ok: false, msg: "Complete KYC verification to withdraw" };
    if (!(input.amount > 0)) return { ok: false, msg: "Enter an amount greater than 0" };
    try {
      const data = await apiCreateWithdrawal(input);
      if (data.withdrawal) {
        setWithdrawals((xs) => [data.withdrawal!, ...xs.filter((w) => w.id !== data.withdrawal!.id)]);
      } else {
        await loadWithdrawals();
      }
      if (data.wallet && user) {
        setWallets((w) => ({ ...w, [user.id]: { cashUSDT: data.wallet!.cashUSDT } }));
      }
      return { ok: true, msg: data.msg || "Withdrawal submitted. Awaiting admin verification." };
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Could not submit withdrawal";
      return { ok: false, msg };
    }
  };

  const cancelMyWithdrawal: Store["cancelMyWithdrawal"] = async (id) => {
    try {
      const data = await apiCancelWithdrawal(id);
      setWithdrawals((xs) => xs.filter((w) => !(w.id === id && w.userId === user?.id && w.status === "pending")));
      if (data.wallet && user) {
        setWallets((w) => ({ ...w, [user.id]: { cashUSDT: data.wallet!.cashUSDT } }));
      }
      return { ok: true, msg: "Request cancelled" };
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Could not cancel withdrawal";
      return { ok: false, msg };
    }
  };

  const adminApproveWithdrawal: Store["adminApproveWithdrawal"] = async (id) => {
    const data = await apiApproveWithdrawal(id);
    if (data.withdrawal) {
      setWithdrawals((xs) => xs.map((x) => (x.id === id ? data.withdrawal! : x)));
      const w = data.withdrawal;
      audit("withdraw.approve", `Approved $${w.amount.toFixed(2)} withdrawal for ${userNameOf(w.userId)}`, id);
      if (data.userId && data.userWallet) {
        setWallets((w) => ({ ...w, [data.userId!]: { cashUSDT: data.userWallet!.cashUSDT } }));
      }
    } else {
      await loadWithdrawals();
    }
  };

  const adminRejectWithdrawal: Store["adminRejectWithdrawal"] = async (id, reason) => {
    const data = await apiRejectWithdrawal(id, reason);
    if (data.withdrawal) {
      const w = data.withdrawal;
      audit("withdraw.reject", `Rejected $${w.amount.toFixed(2)} withdrawal for ${userNameOf(w.userId)}${reason ? ` — ${reason}` : ""}`, id);
      setWithdrawals((xs) => xs.map((x) => (x.id === id ? data.withdrawal! : x)));
    } else {
      await loadWithdrawals();
    }
  };

  const auditLogFor: Store["auditLogFor"] = (target) => auditLog.filter((e) => e.target === target);
  const adminClearAuditLog: Store["adminClearAuditLog"] = () => setAuditLog([]);

  /* ---------- Staff management ---------- */
  const loadStaff: Store["loadStaff"] = useCallback(async () => {
    try {
      const data = await apiListStaff();
      setStaff(data.staff.map(apiStaffToStore));
      return { ok: true };
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Could not load staff";
      return { ok: false, msg };
    }
  }, []);

  const adminCreateStaff: Store["adminCreateStaff"] = async (input) => {
    try {
      const data = await apiCreateStaff(input);
      setStaff((xs) => [apiStaffToStore(data.staff), ...xs]);
      return { ok: true, msg: data.msg };
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Could not create staff";
      return { ok: false, msg };
    }
  };

  const adminUpdateStaff: Store["adminUpdateStaff"] = async (id, input) => {
    try {
      const data = await apiUpdateStaff(id, input);
      const mapped = apiStaffToStore(data.staff);
      setStaff((xs) => xs.map((s) => (s.id === id ? mapped : s)));
      return { ok: true, msg: data.msg };
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Could not update staff";
      return { ok: false, msg };
    }
  };

  const adminDeleteStaff: Store["adminDeleteStaff"] = async (id) => {
    try {
      const data = await apiDeleteStaff(id);
      setStaff((xs) => xs.filter((s) => s.id !== id));
      setUsers((xs) =>
        xs.map((u) => (u.assignedStaffId === id ? { ...u, assignedStaffId: null, assignedStaffName: null } : u))
      );
      return { ok: true, msg: data.msg };
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Could not delete staff";
      return { ok: false, msg };
    }
  };

  const loadUsers: Store["loadUsers"] = useCallback(async () => {
    try {
      const data = await apiListUsers();
      mergeUsersFromApi(setUsers, data.users ?? []);
      setWallets((w) => {
        const next = { ...w };
        for (const api of data.users ?? []) {
          if (api.wallet) next[api.id] = { cashUSDT: api.wallet.cashUSDT };
        }
        return next;
      });
      return { ok: true };
    } catch (err) {
      if (err instanceof ApiError && (err.status === 404 || err.status === 403)) {
        return { ok: true };
      }
      return { ok: false, msg: err instanceof Error ? err.message : "Could not load users", silent: true };
    }
  }, []);

  const adminAssignStaff: Store["adminAssignStaff"] = async (userId, staffId) => {
    try {
      const data = await apiAssignStaff(userId, staffId);
      const mapped = apiUserToStoreUser(data.user);
      setUsers((xs) => xs.map((u) => (u.id === userId ? { ...u, ...mapped } : u)));
      await loadUsers();
      return { ok: true, msg: data.msg };
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Could not assign staff";
      return { ok: false, msg };
    }
  };

  /* ---------- Real-time sync (WebSocket) ---------- */
  useEffect(() => {
    if (!hydrated) return;

    const applyWallet = (payload: Record<string, unknown>) => {
      const userId = payload.userId as string | undefined;
      const wallet = (payload.userWallet || payload.wallet) as { cashUSDT: number } | undefined;
      if (userId && wallet) {
        setWallets((w) => ({ ...w, [userId]: { cashUSDT: wallet.cashUSDT } }));
      }
    };

    return subscribeRealtime((msg) => {
      const { type, payload } = msg;

      switch (type) {
        case "settings:updated": {
          const walletAddress = payload.walletAddress as string | undefined;
          const payoutPercent = payload.payoutPercent as number | undefined;
          const fee = payload.spotFeePercent as number | undefined;
          if (walletAddress !== undefined) setWalletAddress(walletAddress);
          if (Number.isFinite(payoutPercent)) setPayoutPercent(payoutPercent as number);
          if (Number.isFinite(fee)) setSpotFeePercent(fee as number);
          break;
        }
        case "user:updated": {
          const apiUser = payload.user as ApiUser | undefined;
          if (!apiUser) break;
          mergeUsersFromApi(setUsers, [apiUser]);
          if (apiUser.wallet) {
            setWallets((w) => ({ ...w, [apiUser.id]: { cashUSDT: apiUser.wallet!.cashUSDT } }));
          }
          break;
        }
        case "users:invalidate":
          void loadUsers();
          break;
        case "deposit:upsert": {
          const deposit = payload.deposit as Deposit | undefined;
          if (!deposit) break;
          setDeposits((xs) => {
            const i = xs.findIndex((d) => d.id === deposit.id);
            if (i >= 0) {
              const next = [...xs];
              next[i] = deposit;
              return next;
            }
            return [deposit, ...xs];
          });
          applyWallet(payload);
          break;
        }
        case "deposit:deleted":
          setDeposits((xs) => xs.filter((d) => d.id !== payload.id));
          break;
        case "withdrawal:upsert": {
          const withdrawal = payload.withdrawal as Withdrawal | undefined;
          if (!withdrawal) break;
          setWithdrawals((xs) => {
            const i = xs.findIndex((w) => w.id === withdrawal.id);
            if (i >= 0) {
              const next = [...xs];
              next[i] = withdrawal;
              return next;
            }
            return [withdrawal, ...xs];
          });
          applyWallet(payload);
          break;
        }
        case "withdrawal:deleted":
          setWithdrawals((xs) => xs.filter((w) => w.id !== payload.id));
          break;
        case "trade:upsert": {
          const trade = payload.trade as BinaryTrade | undefined;
          if (!trade) break;
          setTrades((xs) => {
            const i = xs.findIndex((t) => t.id === trade.id);
            if (i >= 0) {
              const next = [...xs];
              next[i] = trade;
              return next;
            }
            return [trade, ...xs];
          });
          applyWallet(payload);
          break;
        }
        case "trade:deleted":
          setTrades((xs) => xs.filter((t) => t.id !== payload.id));
          break;
        case "trades:cleared":
          setTrades((xs) => xs.filter((t) => t.status === "active"));
          break;
        case "staff:upsert": {
          const staffMember = payload.staff as ApiStaff | undefined;
          if (!staffMember) break;
          const mapped = apiStaffToStore(staffMember);
          setStaff((xs) => {
            if (xs.some((s) => s.id === mapped.id)) {
              return xs.map((s) => (s.id === mapped.id ? mapped : s));
            }
            return [mapped, ...xs];
          });
          break;
        }
        case "staff:deleted":
          setStaff((xs) => xs.filter((s) => s.id !== payload.id));
          void loadUsers();
          break;
        case "spot:upsert": {
          const position = payload.position as SpotPosition | undefined;
          if (!position) break;
          setSpotPositions((xs) => {
            const i = xs.findIndex((p) => p.id === position.id);
            if (i >= 0) {
              const next = [...xs];
              next[i] = position;
              return next;
            }
            return [position, ...xs];
          });
          applyWallet(payload);
          break;
        }
        case "support:message": {
          const message = payload.message as SupportMessage | undefined;
          const thread = payload.thread as SupportThread | undefined;
          if (!message || !session?.userId) break;
          // Ignore deletes / edits for unread toast (inbox sync handles them)
          if (payload.deleted || message.deleted || payload.edited) break;
          // Ignore echo of our own outbound messages
          if (message.senderId === session.userId) break;

          // Inbox open: live UI handles it — skip badge/toast noise
          if (supportInboxFocusRef.current > 0) break;

          setSupportUnread((n) => n + 1);
          const preview = message.image && (!message.content || message.content === "Screenshot attached")
            ? "Screenshot attached"
            : (message.content || "New message").slice(0, 100);

          if (session.role === "user") {
            toast.message("New support reply", {
              description: preview,
              duration: 6000,
            });
          } else {
            const who = thread?.user?.name || thread?.user?.email || "Customer";
            toast.message(`Support message · ${who}`, {
              description: preview,
              duration: 6000,
            });
          }
          break;
        }
        case "support:thread": {
          // status changes — no toast spam
          break;
        }
        default:
          break;
      }
    });
  }, [hydrated, session?.userId, session?.role, authReady, loadUsers]);

  /* Restore unread support badge + toast on login / session restore (desktop & mobile) */
  useEffect(() => {
    if (!hydrated || !authReady || !session?.userId) {
      setSupportUnread(0);
      return;
    }

    let cancelled = false;
    const userId = session.userId;
    const role = session.role;

    apiGetSupportUnread()
      .then((res) => {
        if (cancelled) return;
        const count = Math.max(0, Number(res.count) || 0);
        setSupportUnread(count);

        // Notify once per login session until messages are read
        if (
          count > 0 &&
          supportInboxFocusRef.current <= 0 &&
          supportLoginNotifyRef.current !== userId
        ) {
          supportLoginNotifyRef.current = userId;
          const previewRaw = res.preview;
          const preview =
            previewRaw?.image && (!previewRaw.content || previewRaw.content === "Screenshot attached")
              ? "Screenshot attached"
              : (previewRaw?.content || "You have unread support messages").slice(0, 100);

          if (role === "user") {
            toast.message(
              count === 1 ? "Unread support reply" : `${count} unread support messages`,
              { description: preview, duration: 8000 }
            );
          } else {
            toast.message(
              count === 1 ? "Unread customer message" : `${count} unread support messages`,
              { description: preview, duration: 8000 }
            );
          }
        }

        if (count === 0) {
          supportLoginNotifyRef.current = userId;
        }
      })
      .catch(() => {
        /* keep local badge */
      });

    return () => {
      cancelled = true;
    };
  }, [hydrated, authReady, session?.userId, session?.role]);

  const clearSupportUnread = useCallback(() => setSupportUnread(0), []);
  const refreshSupportUnread = useCallback(async () => {
    if (!session?.userId) {
      setSupportUnread(0);
      return;
    }
    try {
      const res = await apiGetSupportUnread();
      setSupportUnread(Math.max(0, Number(res.count) || 0));
    } catch {
      /* keep current */
    }
  }, [session?.userId]);
  const setSupportInboxFocused = useCallback((focused: boolean) => {
    supportInboxFocusRef.current = Math.max(0, supportInboxFocusRef.current + (focused ? 1 : -1));
    if (focused) {
      void refreshSupportUnread();
    }
  }, [refreshSupportUnread]);

  const value: Store = {
    session, user, staffMe, isAdmin: !!isAdmin, isStaff, isStaffOrAdmin,
    login, register, logout, authReady,
    supportUnread, clearSupportUnread, setSupportInboxFocused, refreshSupportUnread,
    wallet, myTrades, assets, payoutPercent, spotFeePercent,
    submitKyc, placeBinaryTrade, closeMyTrade, syncMyWallet,
    mySpotPositions, allSpotPositions: spotPositions,
    openSpotPosition, closeSpotPosition, loadSpotPositions,
    allUsers: platformUsers,
    managedUsers,
    managedTrades,
    managedDeposits,
    managedWithdrawals,
    allTrades: trades,
    walletsByUser: wallets,
    loadUsers,
    adminAssignStaff,
    adminSuspendUser, adminAdjustBalance, adminSetBalance, adminDeleteUser, adminUpdateUser,
    adminSetForceOutcome, adminPlanTrade, adminForceCloseTrade, adminDeleteTrade, adminClearTrades,
    adminApproveKyc, adminRejectKyc,
    allStaff: staff, loadStaff, adminCreateStaff, adminUpdateStaff, adminDeleteStaff,
    walletAddress, myDeposits, allDeposits: deposits,
    createDeposit, cancelMyDeposit, adminSetWalletAddress, adminSetPayoutPercent, adminSetSpotFeePercent,
    adminApproveDeposit, adminRejectDeposit, loadSettings, loadDeposits, loadTrades,
    myWithdrawals, allWithdrawals: withdrawals,
    createWithdrawal, cancelMyWithdrawal, adminApproveWithdrawal, adminRejectWithdrawal, loadWithdrawals,
    auditLog, auditLogFor, adminClearAuditLog,
  };

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useStore() {
  const v = useContext(Ctx);
  if (!v) throw new Error("useStore outside provider");
  return v;
}
