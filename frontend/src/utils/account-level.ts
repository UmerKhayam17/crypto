export type AccountLevelOption = {
  level: number;
  label: string;
};

export const ACCOUNT_LEVEL_OPTIONS: AccountLevelOption[] = [
  { level: 0, label: "Basic" },
  { level: 1, label: "VIP 1" },
  { level: 2, label: "VIP 2" },
  { level: 3, label: "VIP 3" },
  { level: 4, label: "VIP 4" },
  { level: 5, label: "VIP 5" },
  { level: 6, label: "SVIP 6" },
];

export function getAccountLevelOptions(): AccountLevelOption[] {
  return ACCOUNT_LEVEL_OPTIONS.map((option) => ({ ...option }));
}

export function normalizeAccountLevel(value?: number | string | null): number {
  const parsed = Number(value ?? 0);
  if (!Number.isFinite(parsed)) return 0;
  const rounded = Math.trunc(parsed);
  if (rounded <= 0) return 0;
  const maxLevel = ACCOUNT_LEVEL_OPTIONS.at(-1)?.level ?? 0;
  return Math.min(maxLevel, rounded);
}

export function getAccountLevelLabel(level?: number | string | null): string {
  const normalized = normalizeAccountLevel(level);
  return getAccountLevelOptions().find((option) => option.level === normalized)?.label ?? "Basic";
}
