import { ApiError, getAuthToken } from "@/services/auth";
import { getApiUrl } from "@/lib/api-url";

const MAX_IMAGE_BYTES = 10 * 1024 * 1024; // 10 MB

export async function fileToDataUrl(file: File): Promise<string> {
  if (!file.type.startsWith("image/")) throw new Error("Only image files are allowed");
  if (file.size > MAX_IMAGE_BYTES) throw new Error("Image too large (max 10 MB)");
  return readAsDataUrl(file);
}

function readAsDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result || ""));
    r.onerror = () => reject(new Error("Could not read file"));
    r.readAsDataURL(blob);
  });
}

export async function apiSubmitKyc(payload: { cnicFront: File; cnicBack: File }) {
  const form = new FormData();
  form.append("cnicFront", payload.cnicFront);
  form.append("cnicBack", payload.cnicBack);

  const token = getAuthToken();
  const headers: Record<string, string> = {};
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(`${getApiUrl()}/api/kyc/submit`, { method: "POST", headers, body: form });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new ApiError(data.msg || "Could not submit KYC", res.status);
  }
  return data as { ok: boolean; msg: string; user?: import("@/services/auth").ApiUser };
}

export async function apiApproveKyc(userId: string) {
  const token = getAuthToken();
  const headers: Record<string, string> = {};
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(`${getApiUrl()}/api/kyc/${userId}/approve`, { method: "PATCH", headers });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new ApiError(data.msg || "Could not approve KYC", res.status);
  }
  return data as { ok: boolean; msg: string; user?: { kyc?: Record<string, unknown> } };
}

export async function apiRejectKyc(userId: string, reason: string) {
  const token = getAuthToken();
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(`${getApiUrl()}/api/kyc/${userId}/reject`, {
    method: "PATCH",
    headers,
    body: JSON.stringify({ reason }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new ApiError(data.msg || "Could not reject KYC", res.status);
  }
  return data as { ok: boolean; msg: string; user?: { kyc?: Record<string, unknown> } };
}
