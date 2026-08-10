/** Lightweight formatters used across the app. */
export const formatUSD = (n: number) =>
  `$${(Number.isFinite(n) ? n : 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export const formatDateTime = (ts: number) => new Date(ts).toLocaleString();

export const secondsLeft = (until: number) => Math.max(0, Math.ceil((until - Date.now()) / 1000));
