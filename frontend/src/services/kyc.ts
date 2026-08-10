import { ApiError, getAuthToken } from "@/services/auth";
import { getApiUrl } from "@/lib/api-url";

const MAX_IMAGE_BYTES = 10 * 1024 * 1024; // 10 MB
const MAX_VIDEO_BYTES = 12_000_000; // ~12 MB

export async function fileToDataUrl(file: File): Promise<string> {
  if (!file.type.startsWith("image/")) throw new Error("Only image files are allowed");
  if (file.size > MAX_IMAGE_BYTES) throw new Error("Image too large (max 10 MB)");
  return readAsDataUrl(file);
}

export async function videoBlobToDataUrl(blob: Blob): Promise<string> {
  if (blob.size <= 0) throw new Error("Recording is empty — try again");
  if (!blob.type.startsWith("video/") && blob.type !== "application/octet-stream") {
    throw new Error("Recording is not a video");
  }
  if (blob.size > MAX_VIDEO_BYTES) throw new Error("Video too large (max 12 MB) — try a shorter clip");
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

/** Convert a data URL into a real binary File for multipart upload. */
export function dataUrlToFile(dataUrl: string, filename: string): File {
  if (!dataUrl) throw new Error("Missing file data");
  const comma = dataUrl.indexOf(",");
  if (comma < 0) throw new Error("Invalid video data");
  const header = dataUrl.slice(0, comma);
  const data = dataUrl.slice(comma + 1);
  const isBase64 = /;base64/i.test(header);
  const mimeMatch = header.match(/data:([^;]+)/i);
  const mime = mimeMatch?.[1] || "video/webm";

  let bytes: Uint8Array;
  if (isBase64) {
    const binary = atob(data);
    bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  } else {
    const decoded = decodeURIComponent(data);
    bytes = new Uint8Array(decoded.length);
    for (let i = 0; i < decoded.length; i++) bytes[i] = decoded.charCodeAt(i);
  }

  const ext =
    mime.includes("mp4") ? "mp4" :
    mime.includes("quicktime") ? "mov" :
    "webm";
  const safeName = `${filename.replace(/\.[^.]+$/, "")}.${ext}`;
  return new File([bytes], safeName, { type: mime });
}

export function blobToFaceFile(blob: Blob, filename = "face"): File {
  const mime = blob.type || "video/webm";
  const ext = mime.includes("mp4") ? "mp4" : "webm";
  return new File([blob], `${filename}.${ext}`, { type: mime });
}

/** Pick the best supported MIME for MediaRecorder. */
export function pickVideoMime(): string {
  if (typeof MediaRecorder === "undefined") return "";
  const candidates = [
    "video/webm;codecs=vp8,opus",
    "video/webm;codecs=vp9,opus",
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
  if (payload.face && payload.face.size > 0) {
    form.append("face", payload.face, payload.face.name || "face.webm");
  }

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
