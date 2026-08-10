import { getAuthToken } from "@/services/auth";

/** Attach JWT for authenticated media URLs (img/video cannot send Authorization headers). */
export function mediaUrl(src?: string | null): string {
  if (!src) return "";
  try {
    const token = getAuthToken();
    if (!token) return src;
    if (!/\/api\/media\//.test(src) && !/\/uploads\//.test(src)) return src;
    const u = new URL(src, typeof window !== "undefined" ? window.location.origin : "http://localhost");
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
