"use client";

import { useState } from "react";
import { Notice } from "@/components/ui";
import { DEVNET_EXPLORER } from "@/lib/constants";

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
  const [note, setNote] = useState<{ tone: "info" | "success" | "error"; text: string } | null>(null);
  const [receipt, setReceipt] = useState<{
    txHash: string;
    status?: string;
    blockNumber: number | null;
    gasUsed: number | null;
    frames: { index: number; status?: string; gasUsed?: string }[];
  } | null>(null);

  async function anchor() {
    setBusy("anchor");
    setNote(null);
    setReceipt(null);
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
      setReceipt({
        txHash: json.txHash,
        status: json.status,
        blockNumber: json.blockNumber ?? null,
        gasUsed: json.gasUsed ?? null,
        frames: json.frames ?? [],
      });
      setNote({ tone: "success", text: "Settled without the researcher holding gas." });
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

      {note && <Notice tone={note.tone}>{note.text}</Notice>}

      {receipt && (
        <div className="rounded-xl border border-emerald-500/25 bg-emerald-500/[0.04] p-3.5">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <span className="text-[12px] font-medium text-emerald-300">
              Transaction {receipt.status === "0x1" ? "succeeded" : `status ${receipt.status ?? "?"}`}
            </span>
            <a
              href={`${DEVNET_EXPLORER}/tx/${receipt.txHash}`}
              target="_blank"
              rel="noreferrer"
              className="text-[11.5px] text-zinc-400 underline decoration-white/20 underline-offset-4 hover:text-white"
            >
              Open in the frame-pool explorer ↗
            </a>
          </div>
          <dl className="mt-2.5 space-y-1.5 text-[11px]">
            <div className="flex gap-2">
              <dt className="w-16 shrink-0 text-zinc-500">Hash</dt>
              <dd className="break-all font-mono text-zinc-300">{receipt.txHash}</dd>
            </div>
            <div className="flex gap-2">
              <dt className="w-16 shrink-0 text-zinc-500">Block</dt>
              <dd className="font-mono text-zinc-300">
                {receipt.blockNumber ?? "—"}
                {receipt.gasUsed !== null && (
                  <span className="text-zinc-500"> · {receipt.gasUsed.toLocaleString()} gas</span>
                )}
              </dd>
            </div>
            <div className="flex gap-2">
              <dt className="w-16 shrink-0 text-zinc-500">Frames</dt>
              <dd className="font-mono text-zinc-300">
                {receipt.frames.length
                  ? receipt.frames
                      .map(
                        (f) =>
                          `${f.index}:${f.status ?? "?"}${
                            f.gasUsed ? ` (${Number(BigInt(f.gasUsed)).toLocaleString()} gas)` : ""
                          }`,
                      )
                      .join(" · ")
                  : "—"}
              </dd>
            </div>
          </dl>
          <p className="mt-2 text-[10.5px] leading-relaxed text-zinc-600">
            The explorer is a convenience view over the same chain. The independent proof is{" "}
            <code className="text-zinc-400">eth_getTransactionReceipt</code> on{" "}
            <code className="text-zinc-400">https://altmempool.forshtat.com</code> for this hash.
          </p>
        </div>
      )}
      <p className="text-[11.5px] leading-relaxed text-zinc-600">
        The release is refused unless the Arkiv anchor exists, is unexpired, and names the same
        researcher and amount as the vault. That guard is the same policy the Arc payout path uses.
      </p>
    </div>
  );
}
