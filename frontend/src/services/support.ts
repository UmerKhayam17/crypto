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
  createdAt: number;
};

type SupportResponse<T> = { ok: boolean; msg?: string } & T;

function authHeaders() {
  const token = getAuthToken();
  const headers: Record<string, string> = {};
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

export async function apiListSupportThreads(): Promise<SupportResponse<{ threads: SupportThread[] }>> {
  const res = await fetch(`${API_URL}/api/support/threads`, { headers: authHeaders() });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError(data.msg || "Could not load support threads", res.status);
  return data as SupportResponse<{ threads: SupportThread[] }>;
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
}): Promise<
  SupportResponse<{ thread: SupportThread; message: SupportMessage }>
> {
  const res = await fetch(`${API_URL}/api/support/messages`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...authHeaders() },
    body: JSON.stringify(input),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError(data.msg || "Could not send message", res.status);
  return data as SupportResponse<{ thread: SupportThread; message: SupportMessage }>;
}

