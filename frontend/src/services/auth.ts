import { getApiUrl } from "@/lib/api-url";

const TOKEN_KEY = "crypto_haven_token";

export function getAuthToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(TOKEN_KEY);
}

export function setAuthToken(token: string | null) {
  if (typeof window === "undefined") return;
  if (token) localStorage.setItem(TOKEN_KEY, token);
  else localStorage.removeItem(TOKEN_KEY);
}

export type ApiUser = {
  id: string;
  email: string;
  fname: string;
  lname: string;
  name: string;
  phone: string;
  country: string;
  role: "user" | "admin" | "staff";
  suspended?: boolean;
  forceOutcome: "random" | "win" | "lose";
  profitPercent?: number | null;
  lossPercent?: number;
  kyc: {
    status: "none" | "pending" | "approved" | "rejected";
    cnicFront?: string;
    cnicBack?: string;
    face?: string;
    submittedAt?: number;
    reviewedAt?: number;
    reviewedBy?: string;
    reason?: string;
  };
  createdAt: number;
  wallet?: { cashUSDT: number };
  assignedStaffId?: string | null;
  assignedStaffName?: string | null;
};

type AuthResponse = {
  ok: boolean;
  msg: string;
  token?: string;
  user?: ApiUser;
};

type MeResponse = {
  ok: boolean;
  user: ApiUser;
};

class ApiError extends Error {
  constructor(
    message: string,
    public status: number
  ) {
    super(message);
    this.name = "ApiError";
  }
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = getAuthToken();
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options.headers as Record<string, string>),
  };
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(`${getApiUrl()}${path}`, { ...options, headers });
  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    throw new ApiError(data.msg || "Request failed", res.status);
  }
  return data as T;
}

export type RegisterPayload = {
  fname: string;
  lname: string;
  email: string;
  phone: string;
  country: string;
  password: string;
};

export async function apiRegister(payload: RegisterPayload): Promise<AuthResponse> {
  const data = await request<AuthResponse>("/api/auth/register", {
    method: "POST",
    body: JSON.stringify(payload),
  });
  if (data.token) setAuthToken(data.token);
  return data;
}

export async function apiLogin(email: string, password: string): Promise<AuthResponse> {
  const data = await request<AuthResponse>("/api/auth/login", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });
  if (data.token) setAuthToken(data.token);
  return data;
}

export async function apiMe(): Promise<MeResponse> {
  return request<MeResponse>("/api/auth/me");
}

export function apiLogout() {
  setAuthToken(null);
}

export { ApiError };
