import { getAuthToken } from "@/services/auth";

import { getApiUrl } from "@/lib/api-url";

export type RealtimeMessage = {
  type: string;
  payload: Record<string, unknown>;
  at: number;
};

function buildWsUrl(): string {
  const base = getApiUrl().replace(/\/$/, "");
  const wsBase = base.replace(/^http/, "ws");
  const token = getAuthToken();
  return `${wsBase}/ws${token ? `?token=${encodeURIComponent(token)}` : ""}`;
}

/** Connect to platform WebSocket; reconnects with backoff. Returns cleanup. */
export function subscribeRealtime(onMessage: (msg: RealtimeMessage) => void): () => void {
  let ws: WebSocket | null = null;
  let retry = 0;
  let timer: ReturnType<typeof setTimeout> | null = null;
  let closed = false;

  const connect = () => {
    if (closed) return;
    try {
      ws = new WebSocket(buildWsUrl());
      ws.onopen = () => {
        retry = 0;
      };
      ws.onmessage = (ev) => {
        try {
          onMessage(JSON.parse(ev.data) as RealtimeMessage);
        } catch {
          // ignore malformed frames
        }
      };
      ws.onclose = () => {
        if (closed) return;
        retry += 1;
        timer = setTimeout(connect, Math.min(30000, 1000 * 2 ** retry));
      };
      ws.onerror = () => ws?.close();
    } catch {
      timer = setTimeout(connect, 5000);
    }
  };

  connect();

  return () => {
    closed = true;
    if (timer) clearTimeout(timer);
    ws?.close();
  };
}
