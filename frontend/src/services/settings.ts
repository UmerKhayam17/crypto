import { ApiError, getAuthToken } from "@/services/auth";

import { getApiUrl } from "@/lib/api-url";

export type PublicSettings = {
  ok: boolean;
  walletAddress: string;
  payoutPercent: number;
  spotFeePercent?: number;
};

export async function apiGetPublicSettings(): Promise<PublicSettings> {
  const res = await fetch(`${getApiUrl()}/api/settings/public`);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new ApiError(data.msg || "Could not load settings", res.status);
  }
  return data as PublicSettings;
}

export async function apiUpdateSettings(payload: {
  trc20WalletAddress?: string;
  payoutPercent?: number;
  spotFeePercent?: number;
}): Promise<PublicSettings & { msg: string }> {
  const token = getAuthToken();
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(`${getApiUrl()}/api/settings`, {
    method: "PATCH",
    headers,
    body: JSON.stringify(payload),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new ApiError(data.msg || "Could not update settings", res.status);
  }
  return data as PublicSettings & { msg: string };
}
