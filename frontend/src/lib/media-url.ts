import { getAuthToken } from "@/services/auth";
import { getApiUrl } from "@/lib/api-url";

/** Attach JWT for authenticated media URLs (img/video cannot send Authorization headers). */
export function mediaUrl(src?: string | null): string {
  if (!src) return "";

  try {
    const raw = String(src).trim();
    if (!raw || raw.startsWith("data:")) return raw;

    const absolute = /^https?:\/\//i.test(raw)
      ? raw
      : new URL(raw, getApiUrl()).toString();

    const normalized = absolute.replace(/\/uploads\/([^?#]+)/i, "/api/media/$1");
    const token = getAuthToken();
    if (!token) return normalized;

    const allowed = /\/api\/media\//.test(normalized) || /\/uploads\//.test(normalized);
    if (!allowed) return normalized;

    const u = new URL(normalized, getApiUrl());
    if (!u.searchParams.has("token")) u.searchParams.set("token", token);
    return u.toString();
  } catch {
    return src;
  }
}

export function isMediaVideo(src?: string | null): boolean {
  if (!src) return false;
  if (src.startsWith("data:video")) return true;
  return /\.(mp4|webm|mov)(\?|$)/i.test(src) || /kyc-face-/i.test(src);
}
