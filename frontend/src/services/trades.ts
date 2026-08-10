import { ApiError, getAuthToken } from "@/services/auth";
import type { BinaryTrade } from "@/context/store";

import { getApiUrl } from "@/lib/api-url";

type TradeResponse = {
  ok: boolean;
  msg?: string;
  trade?: BinaryTrade;
  trades?: BinaryTrade[];
  wallet?: { cashUSDT: number };
  userWallet?: { cashUSDT: number };
  userId?: string;
};

export async function apiCreateTrade(payload: {
  symbol: string;
  direction: "up" | "down";
  stake: number;
  durationSec: number;
  entryPrice: number;
}): Promise<TradeResponse> {
  const token = getAuthToken();
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(`${getApiUrl()}/api/trades`, {
    method: "POST",
    headers,
    body: JSON.stringify(payload),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError(data.msg || "Could not place trade", res.status);
  return data as TradeResponse;
}

export async function apiListMyTrades(): Promise<TradeResponse> {
  const token = getAuthToken();
  const headers: Record<string, string> = {};
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(`${getApiUrl()}/api/trades/mine`, { headers });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError(data.msg || "Could not load trades", res.status);
  return data as TradeResponse;
}

export async function apiListTrades(userId?: string): Promise<TradeResponse> {
  const token = getAuthToken();
  const headers: Record<string, string> = {};
  if (token) headers.Authorization = `Bearer ${token}`;

  const qs = userId ? `?userId=${encodeURIComponent(userId)}` : "";
  const res = await fetch(`${getApiUrl()}/api/trades${qs}`, { headers });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError(data.msg || "Could not load trades", res.status);
  return data as TradeResponse;
}

export async function apiPlanTrade(
  id: string,
  payload: { plannedOutcome: "profit" | "loss" | null; profitPercent?: number; lossPercent?: number }
): Promise<TradeResponse> {
  const token = getAuthToken();
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(`${getApiUrl()}/api/trades/${id}/plan`, {
    method: "PATCH",
    headers,
    body: JSON.stringify(payload),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError(data.msg || "Could not plan trade", res.status);
  return data as TradeResponse;
}

export async function apiCloseMyTrade(
  id: string,
  payload?: { closePrice?: number }
): Promise<TradeResponse> {
  const token = getAuthToken();
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(`${getApiUrl()}/api/trades/${id}/close`, {
    method: "PATCH",
    headers,
    body: JSON.stringify(payload ?? {}),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError(data.msg || "Could not close trade", res.status);
  return data as TradeResponse;
}

export async function apiSettleTrade(
  id: string,
  payload: { outcome: "profit" | "loss"; profitPercent?: number; lossPercent?: number }
): Promise<TradeResponse> {
  const token = getAuthToken();
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(`${getApiUrl()}/api/trades/${id}/settle`, {
    method: "PATCH",
    headers,
    body: JSON.stringify(payload),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError(data.msg || "Could not settle trade", res.status);
  return data as TradeResponse;
}

export async function apiDeleteTrade(id: string): Promise<TradeResponse> {
  const token = getAuthToken();
  const headers: Record<string, string> = {};
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(`${getApiUrl()}/api/trades/${id}`, { method: "DELETE", headers });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError(data.msg || "Could not delete trade", res.status);
  return data as TradeResponse;
}

export async function apiClearTrades(): Promise<TradeResponse> {
  const token = getAuthToken();
  const headers: Record<string, string> = {};
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(`${getApiUrl()}/api/trades`, { method: "DELETE", headers });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError(data.msg || "Could not clear trades", res.status);
  return data as TradeResponse;
}
