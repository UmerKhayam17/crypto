import { ApiError, getAuthToken } from "@/services/auth";
import type { Withdrawal } from "@/context/store";

import { getApiUrl } from "@/lib/api-url";

type WithdrawalResponse = {
  ok: boolean;
  msg?: string;
  withdrawal?: Withdrawal;
  withdrawals?: Withdrawal[];
  wallet?: { cashUSDT: number };
  userWallet?: { cashUSDT: number };
  userId?: string;
};

export async function apiCreateWithdrawal(payload: {
  amount: number;
  method: "trc20" | "bank";
  trc20Address?: string;
  bankName?: string;
  accountNumber?: string;
  accountName?: string;
  note?: string;
}): Promise<WithdrawalResponse> {
  const token = getAuthToken();
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(`${getApiUrl()}/api/withdrawals`, {
    method: "POST",
    headers,
    body: JSON.stringify(payload),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError(data.msg || "Could not submit withdrawal", res.status);
  return data as WithdrawalResponse;
}

export async function apiListMyWithdrawals(): Promise<WithdrawalResponse> {
  const token = getAuthToken();
  const headers: Record<string, string> = {};
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(`${getApiUrl()}/api/withdrawals/mine`, { headers });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError(data.msg || "Could not load withdrawals", res.status);
  return data as WithdrawalResponse;
}

export async function apiListWithdrawals(): Promise<WithdrawalResponse> {
  const token = getAuthToken();
  const headers: Record<string, string> = {};
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(`${getApiUrl()}/api/withdrawals`, { headers });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError(data.msg || "Could not load withdrawals", res.status);
  return data as WithdrawalResponse;
}

export async function apiApproveWithdrawal(id: string): Promise<WithdrawalResponse> {
  const token = getAuthToken();
  const headers: Record<string, string> = {};
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(`${getApiUrl()}/api/withdrawals/${id}/approve`, { method: "PATCH", headers });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError(data.msg || "Could not approve withdrawal", res.status);
  return data as WithdrawalResponse;
}

export async function apiRejectWithdrawal(id: string, reason?: string): Promise<WithdrawalResponse> {
  const token = getAuthToken();
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(`${getApiUrl()}/api/withdrawals/${id}/reject`, {
    method: "PATCH",
    headers,
    body: JSON.stringify({ reason }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError(data.msg || "Could not reject withdrawal", res.status);
  return data as WithdrawalResponse;
}

export async function apiCancelWithdrawal(id: string): Promise<WithdrawalResponse> {
  const token = getAuthToken();
  const headers: Record<string, string> = {};
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(`${getApiUrl()}/api/withdrawals/${id}`, { method: "DELETE", headers });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError(data.msg || "Could not cancel withdrawal", res.status);
  return data as WithdrawalResponse;
}
