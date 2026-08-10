import { ApiError, getAuthToken } from "@/services/auth";
import type { Deposit } from "@/context/store";

import { getApiUrl } from "@/lib/api-url";

type DepositResponse = {
  ok: boolean;
  msg?: string;
  deposit?: Deposit;
  deposits?: Deposit[];
  userWallet?: { cashUSDT: number };
  userId?: string;
};

export async function apiCreateDeposit(payload: {
  amount: number;
  screenshot: File;
  txHash?: string;
  note?: string;
}): Promise<DepositResponse> {
  const form = new FormData();
  form.append("amount", String(payload.amount));
  form.append("screenshot", payload.screenshot);
  if (payload.txHash) form.append("txHash", payload.txHash);
  if (payload.note) form.append("note", payload.note);

  const token = getAuthToken();
  const headers: Record<string, string> = {};
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(`${getApiUrl()}/api/deposits`, { method: "POST", headers, body: form });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new ApiError(data.msg || "Could not submit deposit", res.status);
  }
  return data as DepositResponse;
}

export async function apiListMyDeposits(): Promise<DepositResponse> {
  const token = getAuthToken();
  const headers: Record<string, string> = {};
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(`${getApiUrl()}/api/deposits/mine`, { headers });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new ApiError(data.msg || "Could not load deposits", res.status);
  }
  return data as DepositResponse;
}

export async function apiListDeposits(): Promise<DepositResponse> {
  const token = getAuthToken();
  const headers: Record<string, string> = {};
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(`${getApiUrl()}/api/deposits`, { headers });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new ApiError(data.msg || "Could not load deposits", res.status);
  }
  return data as DepositResponse;
}

export async function apiApproveDeposit(id: string): Promise<DepositResponse> {
  const token = getAuthToken();
  const headers: Record<string, string> = {};
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(`${getApiUrl()}/api/deposits/${id}/approve`, { method: "PATCH", headers });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new ApiError(data.msg || "Could not approve deposit", res.status);
  }
  return data as DepositResponse;
}

export async function apiRejectDeposit(id: string, reason?: string): Promise<DepositResponse> {
  const token = getAuthToken();
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(`${getApiUrl()}/api/deposits/${id}/reject`, {
    method: "PATCH",
    headers,
    body: JSON.stringify({ reason }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new ApiError(data.msg || "Could not reject deposit", res.status);
  }
  return data as DepositResponse;
}

export async function apiCancelDeposit(id: string): Promise<DepositResponse> {
  const token = getAuthToken();
  const headers: Record<string, string> = {};
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(`${getApiUrl()}/api/deposits/${id}`, { method: "DELETE", headers });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new ApiError(data.msg || "Could not cancel deposit", res.status);
  }
  return data as DepositResponse;
}
