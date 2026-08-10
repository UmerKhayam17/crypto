import { ApiError, getAuthToken } from "@/services/auth";

/** KYC helpers — file → data URL, validation, and short selfie video recording. */
import { getApiUrl } from "@/lib/api-url";
const MAX_IMAGE_BYTES = 1_500_000; // ~1.5 MB
const MAX_VIDEO_BYTES = 3_000_000; // ~3 MB

export async function fileToDataUrl(file: File): Promise<string> {
  if (!file.type.startsWith("image/")) throw new Error("Only image files are allowed");
  if (file.size > MAX_IMAGE_BYTES) throw new Error("Image too large (max 1.5 MB)");
  return readAsDataUrl(file);
}

export async function videoBlobToDataUrl(blob: Blob): Promise<string> {
  if (!blob.type.startsWith("video/")) throw new Error("Recording is not a video");
  if (blob.size > MAX_VIDEO_BYTES) throw new Error("Video too large (max 3 MB) — try a shorter clip");
  return readAsDataUrl(blob);
}

function readAsDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result || ""));
    r.onerror = () => reject(new Error("Could not read file"));
    r.readAsDataURL(blob);
  });
}

/** Pick the best supported MIME for MediaRecorder. */
export function pickVideoMime(): string {
  if (typeof MediaRecorder === "undefined") return "";
  const candidates = [
    "video/webm;codecs=vp9,opus",
    "video/webm;codecs=vp8,opus",
    "video/webm",
    "video/mp4",
  ];
  for (const c of candidates) {
    if (MediaRecorder.isTypeSupported(c)) return c;
  }
  return "";
}

export async function apiSubmitKyc(payload: { cnicFront: File; cnicBack: File; face?: File | null }) {
  const form = new FormData();
  form.append("cnicFront", payload.cnicFront);
  form.append("cnicBack", payload.cnicBack);
  if (payload.face) form.append("face", payload.face);

  const token = getAuthToken();
  const headers: Record<string, string> = {};
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(`${getApiUrl()}/api/kyc/submit`, { method: "POST", headers, body: form });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new ApiError(data.msg || "Could not submit KYC", res.status);
  }
  return data as { ok: boolean; msg: string; user?: { kyc?: Record<string, unknown> } };
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
