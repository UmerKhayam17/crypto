import { ApiError, getAuthToken } from "@/services/auth";
import { getApiUrl } from "@/lib/api-url";

export type SupportThread = {
  id: string;
  userId: string;
  status: "open" | "closed";
  createdAt?: number;
  updatedAt?: number;
  user?: { id: string; name?: string; email?: string };
  lastMessage?: SupportMessage;
};

export type SupportMessage = {
  id: string;
  threadId: string;
  senderId: string;
  senderRole: "user" | "staff" | "admin";
  content: string;
  image?: string;
  createdAt: number;
  editedAt?: number;
  deleted?: boolean;
};

type SupportResponse<T> = { ok: boolean; msg?: string } & T;

function authHeaders(json = false) {
  const token = getAuthToken();
  const headers: Record<string, string> = {};
  if (json) headers["Content-Type"] = "application/json";
  if (token) headers.Authorization = `Bearer ${token}`;
  return headers;
}

const API_URL = getApiUrl();

export async function apiListMySupportThreads(): Promise<SupportResponse<{ threads: SupportThread[] }>> {
  const res = await fetch(`${API_URL}/api/support/threads/mine`, { headers: authHeaders() });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError(data.msg || "Could not load support threads", res.status);
  return data as SupportResponse<{ threads: SupportThread[] }>;
}

export async function apiListSupportThreads(status?: "open" | "closed"): Promise<
  SupportResponse<{ threads: SupportThread[]; openCount?: number }>
> {
  const qs = status ? `?status=${encodeURIComponent(status)}` : "";
  const res = await fetch(`${API_URL}/api/support/threads${qs}`, { headers: authHeaders() });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError(data.msg || "Could not load support threads", res.status);
  return data as SupportResponse<{ threads: SupportThread[]; openCount?: number }>;
}

export async function apiListSupportThreadMessages(threadId: string): Promise<
  SupportResponse<{ thread: SupportThread; messages: SupportMessage[] }>
> {
  const res = await fetch(`${API_URL}/api/support/threads/${encodeURIComponent(threadId)}/messages`, {
    headers: authHeaders(),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError(data.msg || "Could not load support messages", res.status);
  return data as SupportResponse<{ thread: SupportThread; messages: SupportMessage[] }>;
}

export async function apiSendSupportMessage(input: {
  threadId?: string;
  content: string;
  image?: File | null;
}): Promise<SupportResponse<{ thread: SupportThread; message: SupportMessage }>> {
  const form = new FormData();
  form.append("content", input.content ?? "");
  if (input.threadId) form.append("threadId", input.threadId);
  if (input.image) form.append("image", input.image, input.image.name || "screenshot.jpg");

  const res = await fetch(`${API_URL}/api/support/messages`, {
    method: "POST",
    headers: authHeaders(false),
    body: form,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError(data.msg || "Could not send message", res.status);
  return data as SupportResponse<{ thread: SupportThread; message: SupportMessage }>;
}

export async function apiSetSupportThreadStatus(
  threadId: string,
  status: "open" | "closed"
): Promise<SupportResponse<{ thread: SupportThread }>> {
  const res = await fetch(`${API_URL}/api/support/threads/${encodeURIComponent(threadId)}/status`, {
    method: "PATCH",
    headers: authHeaders(true),
    body: JSON.stringify({ status }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError(data.msg || "Could not update ticket", res.status);
  return data as SupportResponse<{ thread: SupportThread }>;
}

export async function apiGetSupportUnread(): Promise<
  SupportResponse<{ count: number; preview?: SupportMessage; threadId?: string; at?: number }>
> {
  const res = await fetch(`${API_URL}/api/support/unread`, { headers: authHeaders() });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError(data.msg || "Could not load unread support", res.status);
  return data as SupportResponse<{ count: number; preview?: SupportMessage; threadId?: string; at?: number }>;
}

export async function apiMarkSupportThreadRead(threadId: string): Promise<SupportResponse<Record<string, never>>> {
  const res = await fetch(`${API_URL}/api/support/threads/${encodeURIComponent(threadId)}/read`, {
    method: "POST",
    headers: authHeaders(true),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError(data.msg || "Could not mark as read", res.status);
  return data as SupportResponse<Record<string, never>>;
}

export async function apiEditSupportMessage(
  messageId: string,
  content: string
): Promise<SupportResponse<{ thread: SupportThread; message: SupportMessage }>> {
  const res = await fetch(`${API_URL}/api/support/messages/${encodeURIComponent(messageId)}`, {
    method: "PATCH",
    headers: authHeaders(true),
    body: JSON.stringify({ content }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError(data.msg || "Could not edit message", res.status);
  return data as SupportResponse<{ thread: SupportThread; message: SupportMessage }>;
}

export async function apiDeleteSupportMessage(
  messageId: string
): Promise<SupportResponse<{ thread?: SupportThread; messageId?: string }>> {
  const res = await fetch(`${API_URL}/api/support/messages/${encodeURIComponent(messageId)}`, {
    method: "DELETE",
    headers: authHeaders(),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError(data.msg || "Could not delete message", res.status);
  return data as SupportResponse<{ thread?: SupportThread; messageId?: string }>;
}
