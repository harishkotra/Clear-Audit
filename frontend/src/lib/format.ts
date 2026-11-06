export function usd(raw: string | bigint | null | undefined, decimals: number, max = 2) {
  if (raw === null || raw === undefined || raw === "") return "—";
  const n = Number(raw) / 10 ** decimals;
  if (!Number.isFinite(n)) return "—";
  return n.toLocaleString("en-US", {
    minimumFractionDigits: n === 0 ? 0 : 2,
    maximumFractionDigits: max,
  });
}

export function money(raw: string | bigint | null | undefined, decimals: number) {
  return `${usd(raw, decimals)} USDC`;
}

export function shortAddress(addr?: string | null) {
  if (!addr) return "—";
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

export function timeLeft(expiresAt: string | null | undefined, now: number) {
  if (!expiresAt) return "—";
  const ms = Number(expiresAt) * 1000 - now;
  if (!Number.isFinite(ms)) return "—";
  if (ms <= 0) return "expired";
  const s = Math.floor(ms / 1000);
  const d = Math.floor(s / 86400);
  const h = Math.floor((s % 86400) / 3600);
  if (d > 0) return `${d}d ${h}h left`;
  const m = Math.floor((s % 3600) / 60);
  return `${h}h ${m}m left`;
}

/** Product language for the vault state machine. */
export const STATUS_COPY: Record<number, { label: string; tone: "open" | "review" | "paid" | "closed" }> = {
  0: { label: "Not found", tone: "closed" },
  1: { label: "Awaiting review", tone: "open" },
  2: { label: "In review", tone: "review" },
  3: { label: "Paid", tone: "paid" },
  4: { label: "Paid", tone: "paid" },
  5: { label: "Returned", tone: "closed" },
};

export const SEVERITY_COPY: Record<string, string> = {
  critical: "Critical",
  high: "High",
  medium: "Medium",
  low: "Low",
};
