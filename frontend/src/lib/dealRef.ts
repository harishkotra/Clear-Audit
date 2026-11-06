/**
 * Public deal reference derived from an Arkiv entity key.
 *
 * On-chain deals stay as uint counters (cheap, unambiguous for the vault).
 * Once an Arkiv fingerprint exists, we surface a short code cut from that
 * entity key so the public identity is the evidence itself, not a spreadsheet row.
 *
 * Format: CA-{first 8 hex}-{last 4 hex} of the 32-byte key, uppercase.
 * Example: 0xcb3c7a10…e12bef52 → CA-CB3C7A10-EF52
 */

const REF_RE = /^CA-[0-9A-F]{8}-[0-9A-F]{4}$/;
const KEY_RE = /^0x[0-9a-fA-F]{64}$/;

export function normalizeEntityKey(key: string): `0x${string}` | null {
  const k = key.trim();
  if (!KEY_RE.test(k)) return null;
  return k.toLowerCase() as `0x${string}`;
}

/** Build the public ref from a full Arkiv entity key. */
export function formatDealRef(entityKey: string): string {
  const key = normalizeEntityKey(entityKey);
  if (!key) throw new Error("entity key must be 32-byte hex");
  const hex = key.slice(2).toUpperCase();
  return `CA-${hex.slice(0, 8)}-${hex.slice(-4)}`;
}

/** Safe variant for UI when the key may be missing. */
export function tryFormatDealRef(entityKey?: string | null): string | null {
  if (!entityKey) return null;
  try {
    return formatDealRef(entityKey);
  } catch {
    return null;
  }
}

export function isDealRef(raw: string): boolean {
  return REF_RE.test(raw.trim().toUpperCase());
}

export function normalizeDealRef(raw: string): string | null {
  const up = raw.trim().toUpperCase();
  return REF_RE.test(up) ? up : null;
}

/** True when a shortened ref could have come from this full key. */
export function refMatchesKey(ref: string, entityKey: string): boolean {
  const normalized = normalizeDealRef(ref);
  if (!normalized) return false;
  try {
    return formatDealRef(entityKey) === normalized;
  } catch {
    return false;
  }
}
