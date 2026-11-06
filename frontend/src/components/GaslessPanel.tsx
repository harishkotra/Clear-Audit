"use client";

import { useState } from "react";
import { Notice } from "@/components/ui";

type OpenDeal = { id: string; amount: string; whitehat: string };

const DEMO_HASH =
  "0x9f2f6b1c4f1b6f2b6c5d3e2a1b0c9d8e7f6a5b4c3d2e1f0a9b8c7d6e5f4a3b2c" as const;

/**
 * End-to-end demo of the EF path: anchor evidence on Arkiv (chain 1337 scope),
 * then pay through a sponsored frame transaction. Both calls are server-side;
 * the relayer key never reaches this component.
 */
export function GaslessPanel({ open }: { open: OpenDeal[] }) {
  const [dealId, setDealId] = useState(open[0]?.id ?? "");
  const [busy, setBusy] = useState<"anchor" | "claim" | null>(null);
  const [note, setNote] = useState<{ tone: "info" | "success" | "error"; text: string; href?: string } | null>(null);

  async function anchor() {
    setBusy("anchor");
    setNote(null);
    try {
      const res = await fetch("/api/reports", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chainId: 1337,
          dealId,
          encryptedPayloadHash: DEMO_HASH,
          severity: "high",
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Could not anchor evidence.");
      setNote({
        tone: "success",
        text: json.deduplicated
          ? `Anchor already exists for devnet deal #${dealId}.`
          : `Evidence anchored on Arkiv for 30 days (entity ${String(json.entityKey).slice(0, 14)}…).`,
      });
    } catch (e: unknown) {
      setNote({ tone: "error", text: e instanceof Error ? e.message : "Anchor failed." });
    } finally {
      setBusy(null);
    }
  }

  async function claim() {
    setBusy("claim");
    setNote(null);
    try {
      const res = await fetch("/api/claim", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dealId, expectedHash: DEMO_HASH }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Claim failed.");
      setNote({
        tone: "success",
        text: `Settled without the researcher holding gas. Frames: ${(json.frames ?? [])
          .map((f: { index: number; status?: string }) => `${f.index}:${f.status ?? "?"}`)
          .join(" · ")}`,
        href: json.txHash,
      });
    } catch (e: unknown) {
      setNote({ tone: "error", text: e instanceof Error ? e.message : "Claim failed." });
    } finally {
      setBusy(null);
    }
  }

  if (open.length === 0) {
    return (
      <Notice tone="info">
        No open bounty on the EF devnet right now, so the sponsored release has nothing to settle.
        The reference transactions above remain verifiable evidence of the flow.
      </Notice>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-end gap-3">
        <label className="min-w-[180px] flex-1">
          <span className="label">Open devnet bounty</span>
          <select className="field" value={dealId} onChange={(e) => setDealId(e.target.value)}>
            {open.map((d) => (
              <option key={d.id} value={d.id}>
                #{d.id} · {d.amount} mUSDC → {d.whitehat.slice(0, 10)}…
              </option>
            ))}
          </select>
        </label>
        <button className="btn btn-ghost h-10" onClick={anchor} disabled={busy !== null}>
          {busy === "anchor" ? "Anchoring…" : "1. Anchor evidence"}
        </button>
        <button className="btn btn-primary h-10" onClick={claim} disabled={busy !== null}>
          {busy === "claim" ? "Settling…" : "2. Release gaslessly"}
        </button>
      </div>

      {note && (
        <Notice tone={note.tone}>
          {note.text}{" "}
          {note.href && (
            <span className="font-mono text-[11px] text-zinc-400">tx {note.href.slice(0, 18)}…</span>
          )}
        </Notice>
      )}
      <p className="text-[11.5px] leading-relaxed text-zinc-600">
        The release is refused unless the Arkiv anchor exists, is unexpired, and names the same
        researcher and amount as the vault. That guard is the same policy the Arc payout path uses.
      </p>
    </div>
  );
}
