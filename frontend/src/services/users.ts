import { getAuthToken, ApiError, type ApiUser } from "@/services/auth";

import { getApiUrl } from "@/lib/api-url";

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

export async function apiListUsers(): Promise<{ ok: boolean; users: ApiUser[] }> {
  return request("/api/users");
}

export async function apiAssignStaff(
  userId: string,
  staffId: string | null
): Promise<{ ok: boolean; msg: string; user: ApiUser }> {
  return request(`/api/users/${userId}/assign`, {
    method: "PATCH",
    body: JSON.stringify({ staffId }),
  });
}

export async function apiUpdateTradeControl(
  userId: string,
  payload: {
    forceOutcome?: "random" | "win" | "lose";
    profitPercent?: number | null;
    lossPercent?: number;
  }
): Promise<{ ok: boolean; msg: string; user: ApiUser }> {
  return request(`/api/users/${userId}/trade-control`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
}

export async function apiSuspendUser(
  userId: string,
  suspended: boolean
): Promise<{ ok: boolean; msg: string; user: ApiUser }> {
  return request(`/api/users/${userId}/suspend`, {
    method: "PATCH",
    body: JSON.stringify({ suspended }),
  });
}

export async function apiAdjustBalance(
  userId: string,
  delta: number
): Promise<{ ok: boolean; msg: string; user: ApiUser; wallet: { cashUSDT: number } }> {
  return request(`/api/users/${userId}/balance/adjust`, {
    method: "PATCH",
    body: JSON.stringify({ delta }),
  });
}

export async function apiSetBalance(
  userId: string,
  balance: number
): Promise<{ ok: boolean; msg: string; user: ApiUser; wallet: { cashUSDT: number } }> {
  return request(`/api/users/${userId}/balance`, {
    method: "PATCH",
    body: JSON.stringify({ balance }),
  });
}

export async function apiUpdateUserProfile(
  userId: string,
  patch: { fname?: string; lname?: string; email?: string; phone?: string; country?: string }
): Promise<{ ok: boolean; msg: string; user: ApiUser }> {
  return request(`/api/users/${userId}/profile`, {
    method: "PATCH",
    body: JSON.stringify(patch),
  });
}

export async function apiDeleteUser(userId: string): Promise<{ ok: boolean; msg: string }> {
  return request(`/api/users/${userId}`, { method: "DELETE" });
}
