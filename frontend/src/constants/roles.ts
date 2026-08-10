/** Application roles. Mirrors the union in `@/context/store`. */
export const ROLES = ["user", "admin", "staff"] as const;
export type AppRole = (typeof ROLES)[number];

export const TRADE_DURATIONS = [
  { sec: 15, label: "15s" },
  { sec: 30, label: "30s" },
  { sec: 60, label: "1m" },
  { sec: 120, label: "2m" },
  { sec: 300, label: "5m" },
] as const;

export const DEFAULT_PAYOUT_PERCENT = 85;
