import { ApiError, getAuthToken } from "@/services/auth";
import { getApiUrl } from "@/lib/api-url";
import type { SpotPosition } from "@/context/store";

type SpotResponse = {
  ok: boolean;
  msg?: string;
  position?: SpotPosition;
  positions?: SpotPosition[];
  wallet?: { cashUSDT: number };
  spotFeePercent?: number;
};

function authHeaders(json = false): Record<string, string> {
  const token = getAuthToken();
  const headers: Record<string, string> = {};
  if (json) headers["Content-Type"] = "application/json";
  if (token) headers.Authorization = `Bearer ${token}`;
  return headers;
}

export async function apiOpenSpot(payload: {
  symbol: string;
  quantity: number;
  entryPrice: number;
  side: "buy" | "sell";
}): Promise<SpotResponse> {
  const res = await fetch(`${getApiUrl()}/api/spot`, {
    method: "POST",
    headers: authHeaders(true),
    body: JSON.stringify(payload),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError(data.msg || "Could not open spot position", res.status);
  return data as SpotResponse;
}

export async function apiCloseSpot(id: string, exitPrice: number): Promise<SpotResponse> {
  const res = await fetch(`${getApiUrl()}/api/spot/${id}/close`, {
    method: "PATCH",
    headers: authHeaders(true),
    body: JSON.stringify({ exitPrice }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError(data.msg || "Could not close spot position", res.status);
  return data as SpotResponse;
}

export async function apiListMySpot(): Promise<SpotResponse> {
  const res = await fetch(`${getApiUrl()}/api/spot/mine`, { headers: authHeaders() });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError(data.msg || "Could not load spot positions", res.status);
  return data as SpotResponse;
}

export async function apiListSpot(userId?: string): Promise<SpotResponse> {
  const qs = userId ? `?userId=${encodeURIComponent(userId)}` : "";
  const res = await fetch(`${getApiUrl()}/api/spot${qs}`, { headers: authHeaders() });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError(data.msg || "Could not load spot positions", res.status);
  return data as SpotResponse;
}
