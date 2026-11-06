"use client";

import { useCallback, useEffect, useState } from "react";

export type VaultDeal = {
  id: string;
  payer: `0x${string}`;
  payee: `0x${string}`;
  amount: string;
  status: number;
  statusLabel: string;
  /** Unix seconds; 0 means no deadline was set. */
  deadline: number;
  /** Unix seconds when an agent claimed an open task; 0 otherwise. */
  claimedAt: number;
  agentMode: boolean;
  assigned?: boolean;
  criteriaHash?: `0x${string}`;
  contestMode?: boolean;
  evidence?: { hash: `0x${string}`; expiresAt: number; challengeUntil: number } | null;
};

export type VaultState = {
  chainId: number;
  vault: string;
  token: { address: string; symbol: string; decimals: number };
  escrowed: string;
  totalRewards: number;
  counts: { open: number; review: number; paid: number };
  totals: { open: string; paid: string };
  deals: VaultDeal[];
  features?: { evidenceGate: boolean; challengeWindow: number };
  arkiv?: {
    gate: boolean;
    writer: "ready" | "not-ready";
    writerAddress: string;
    reason: string | null;
  };
};

export type Report = {
  key: string;
  dealId: string;
  protocolWallet: string | null;
  whitehatWallet: string | null;
  amount: string | null;
  encryptedPayloadHash: string | null;
  severity: string | null;
  criteriaHash?: string | null;
  expiresAt: string;
};

const EMPTY: VaultState = {
  chainId: 5042002,
  vault: "",
  token: { address: "", symbol: "USDC", decimals: 6 },
  escrowed: "0",
  totalRewards: 0,
  counts: { open: 0, review: 0, paid: 0 },
  totals: { open: "0", paid: "0" },
  deals: [],
};

export function useVault() {
  const [state, setState] = useState<VaultState>(EMPTY);
  const [reports, setReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      const [s, r] = await Promise.all([
        fetch("/api/state", { cache: "no-store" }),
        fetch("/api/reports", { cache: "no-store" }),
      ]);
      const sj = await s.json();
      if (!s.ok) throw new Error(sj.error ?? "Could not reach Arc.");
      setState(sj as VaultState);
      setError(null);

      if (r.ok) {
        const rj = await r.json();
        setReports((rj.reports ?? []) as Report[]);
      }
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Could not reach Arc.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
    const t = setInterval(() => void refresh(), 20_000);
    return () => clearInterval(t);
  }, [refresh]);

  return { state, reports, loading, error, refresh };
}

/** Ticking clock for expiry countdowns; avoids Date.now() during render. */
export function useNow(intervalMs = 30_000) {
  const [now, setNow] = useState(0);
  useEffect(() => {
    setNow(Date.now());
    const t = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(t);
  }, [intervalMs]);
  return now;
}
