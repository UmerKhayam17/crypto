/** Application roles. Mirrors the union in `@/context/store`. */
export const ROLES = ["user", "admin", "staff"] as const;
export type AppRole = (typeof ROLES)[number];

/** Duration → win profit %. Loss is always 100% of stake. */
export const TRADE_DURATIONS = [
  { sec: 30, label: "30s", profitPercent: 30 },
  { sec: 60, label: "1m", profitPercent: 40 },
  { sec: 120, label: "2m", profitPercent: 50 },
  { sec: 180, label: "3m", profitPercent: 60 },
  { sec: 240, label: "4m", profitPercent: 80 },
] as const;

export const VALID_TRADE_DURATIONS = TRADE_DURATIONS.map((d) => d.sec);

export function profitPercentForDuration(durationSec: number): number {
  const row = TRADE_DURATIONS.find((d) => d.sec === durationSec);
  return row?.profitPercent ?? 40;
}

/** @deprecated Flat payout fallback — binary profit is duration-based */
export const DEFAULT_PAYOUT_PERCENT = 40;
