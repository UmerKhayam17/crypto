import { getAuthToken, ApiError } from "@/services/auth";

import { getApiUrl } from "@/lib/api-url";

export type ApiStaff = {
  id: string;
  fname: string;
  lname: string;
  name: string;
  email: string;
  phone: string;
  role: "staff";
  createdAt: number;
};

export type StaffCreatePayload = {
  fname: string;
  lname: string;
  email: string;
  phone: string;
  password: string;
};

export type StaffUpdatePayload = {
  fname: string;
  lname: string;
  email: string;
  phone: string;
  password?: string;
};

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = getAuthToken();
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options.headers as Record<string, string>),
  };
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(`${getApiUrl()}${path}`, { ...options, headers });
  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    throw new ApiError(data.msg || "Request failed", res.status);
  }
  return data as T;
}

export async function apiListStaff(): Promise<{ ok: boolean; staff: ApiStaff[] }> {
  return request("/api/staff");
}

export async function apiCreateStaff(payload: StaffCreatePayload): Promise<{ ok: boolean; msg: string; staff: ApiStaff }> {
  return request("/api/staff", { method: "POST", body: JSON.stringify(payload) });
}

export async function apiUpdateStaff(id: string, payload: StaffUpdatePayload): Promise<{ ok: boolean; msg: string; staff: ApiStaff }> {
  return request(`/api/staff/${id}`, { method: "PATCH", body: JSON.stringify(payload) });
}

export async function apiDeleteStaff(id: string): Promise<{ ok: boolean; msg: string }> {
  return request(`/api/staff/${id}`, { method: "DELETE" });
}
