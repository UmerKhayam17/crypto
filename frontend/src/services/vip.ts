import { ApiError, getAuthToken } from "@/services/auth";
import { getApiUrl } from "@/lib/api-url";

export type VipTierStatus = {
  level: number;
  name: string;
  /** Separate deposit amount required for this tier alone. */
  required: number;
  /** Same as required — deposit needed for this VIP step. */
  stepRequired: number;
  reward: number;
  status: "locked" | "claimable" | "claimed" | "pending_previous" | "skipped";
  claimed: boolean;
  claimable: boolean;
  unlocked: boolean;
  /** Lower tier skipped when a higher tier was claimed first. */
  skipped?: boolean;
  claimedAt?: number;
  progress: number;
  /** Deposits counted toward this VIP step. */
  progressAmount: number;
  remaining: number;
};

export type VipClaim = {
  id: string;
  userId: string;
  level: number;
  name: string;
  requiredRecharge: number;
  reward: number;
  totalRechargeAtClaim: number;
  claimedAt: number;
  userName?: string;
  userEmail?: string;
};

export type VipStatusResponse = {
  ok: boolean;
  msg?: string;
  totalRecharge: number;
  currentVipLevel: number;
  currentVipName: string | null;
  tiers: VipTierStatus[];
  claims: VipClaim[];
  wallet?: { cashUSDT: number };
  claim?: VipClaim;
};

function authHeaders(json = false): Record<string, string> {
  const token = getAuthToken();
  const headers: Record<string, string> = {};
  if (json) headers["Content-Type"] = "application/json";
  if (token) headers.Authorization = `Bearer ${token}`;
  return headers;
}

export async function apiGetMyVipStatus(): Promise<VipStatusResponse> {
  const res = await fetch(`${getApiUrl()}/api/vip/mine`, { headers: authHeaders() });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError(data.msg || "Could not load recharge activity", res.status);
  return data as VipStatusResponse;
}

export async function apiClaimVipReward(level: number): Promise<VipStatusResponse> {
  const res = await fetch(`${getApiUrl()}/api/vip/claim`, {
    method: "POST",
    headers: authHeaders(true),
    body: JSON.stringify({ level }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError(data.msg || "Could not claim reward", res.status);
  return data as VipStatusResponse;
}

export async function apiListVipClaims(): Promise<{ ok: boolean; claims: VipClaim[] }> {
  const res = await fetch(`${getApiUrl()}/api/vip/claims`, { headers: authHeaders() });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError(data.msg || "Could not load VIP claims", res.status);
  return data as { ok: boolean; claims: VipClaim[] };
}
