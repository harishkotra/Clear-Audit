"use client";

import { useEffect, useState } from "react";

type Status = {
  enabled: boolean;
  model: string | null;
  host: string;
  operator: `0x${string}` | null;
  reason: string | null;
  limits: { maxTokens: number };
};

type Deal = { id: string; payee: string; amount: string; status: number };

type Result = {
  ok: boolean;
  hash: string;
  anchored: boolean;
  anchorKey: string | null;
  anchorError: string | null;
  model: string;
  usage: { promptTokens: number; completionTokens: number; totalTokens: number } | null;
  latencyMs: number;
  content: string;
};

/**
 * ClearAudit as a paid agent, not a fee on the escrow.
 *
 * Visible only when the deal names the operator address as payee and the server
 * has AGENT_* configured. The operator produces the deliverable and anchors its
 * hash; the funder still presses release, so the operator cannot accept its own
 * work.
 */
export default function AgentDispatch({ deals }: { deals: Deal[] }) {
  const [status, setStatus] = useState<Status | null>(null);
  const [open, setOpen] = useState<string | null>(null);
  const [task, setTask] = useState("");
  const [running, setRunning] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<Result | null>(null);

  useEffect(() => {
    let alive = true;
    fetch("/api/agent/status", { cache: "no-store" })
      .then((r) => r.json())
      .then((s: Status) => alive && setStatus(s))
      .catch(() => alive && setStatus(null));
    return () => {
      alive = false;
    };
  }, []);

  if (!status?.enabled || !status.operator) return null;

  const mine = deals.filter(
    (d) => d.status === 1 && d.payee.toLowerCase() === status.operator?.toLowerCase(),
  );
  if (mine.length === 0) return null;

  async function run(id: string) {
    setRunning(id);
    setError(null);
    setResult(null);
    try {
      const res = await fetch("/api/agent/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dealId: id, task }),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json.reason ?? json.error ?? "The operator could not produce a deliverable.");
        return;
      }
      setResult(json as Result);
      setOpen(null);
      setTask("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "The operator request failed.");
    } finally {
      setRunning(null);
    }
  }

  return (
    <div className="mt-4 card p-5">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-[14px] font-medium text-white">Operator agent</h2>
        <span className="micro">
          {status.model} · {status.host}
        </span>
      </div>
      <p className="mt-1 max-w-[70ch] text-[12.5px] leading-relaxed text-zinc-500">
        ClearAudit is a payee here, not a fee on the escrow. It writes one deliverable, hashes it and
        anchors the hash to the deal. You still press release, so it cannot accept its own work.
        Revenue is the margin on the funded amount, and it never touches the contract.
      </p>

      <div className="mt-4 space-y-2">
        {mine.map((d) => (
          <div key={d.id} className="border-t border-[var(--rule)] pt-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-baseline gap-3">
                <span className="font-mono text-[12px] text-zinc-400">#{d.id}</span>
                <span className="tabular-nums text-[13px] text-zinc-200">{d.amount}</span>
                <span className="micro">pays the operator</span>
              </div>
              <button
                className="btn btn-ghost h-8 px-3 text-[12px]"
                onClick={() => {
                  setOpen(open === d.id ? null : d.id);
                  setError(null);
                  setResult(null);
                }}
                disabled={running !== null}
              >
                {open === d.id ? "Cancel" : "Run the agent"}
              </button>
            </div>

            {open === d.id && (
              <div className="mt-3">
                <label className="label" htmlFor={`task-${d.id}`}>
                  Task for this {`deal #${d.id}`}
                </label>
                <textarea
                  id={`task-${d.id}`}
                  className="field h-28 resize-y py-2 text-[12.5px]"
                  placeholder="Scope, the code or design under review, and what the deliverable must cover. No secrets: this text goes to the model provider."
                  value={task}
                  onChange={(e) => setTask(e.target.value)}
                  maxLength={6000}
                />
                <div className="mt-2 flex items-center justify-between gap-3">
                  <span className="text-[11px] text-zinc-600">
                    {task.length}/6000 · sent to {status.host}
                  </span>
                  <button
                    className="btn btn-primary h-8 px-3 text-[12px]"
                    onClick={() => run(d.id)}
                    disabled={running !== null || task.trim().length < 40}
                  >
                    {running === d.id ? "Working…" : "Produce and anchor"}
                  </button>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      {error && (
        <div className="mt-3 border border-amber-400/25 bg-amber-400/[0.06] px-3 py-2 text-[12px] leading-relaxed text-amber-300">
          {error}
        </div>
      )}

      {result && (
        <div className="mt-4 border-t border-[var(--rule)] pt-3">
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
            <span className={result.anchored ? "chip text-[#8bd17c]" : "chip text-[#c9a06a]"}>
              {result.anchored ? "anchor live" : "anchor failed"}
            </span>
            <span className="font-mono text-[10.5px] text-zinc-500">
              sha256 {result.hash.slice(0, 16)}…
            </span>
            {result.usage && (
              <span className="font-mono text-[10.5px] text-zinc-500">
                {result.usage.totalTokens} tokens · {Math.round(result.latencyMs / 100) / 10}s
              </span>
            )}
            <span className="font-mono text-[10.5px] text-zinc-500">{result.model}</span>
          </div>

          {result.anchorError && (
            <p className="mt-2 text-[11.5px] leading-relaxed text-amber-300">
              The deliverable exists but the anchor failed, so the gate will refuse the release:{" "}
              {result.anchorError}
            </p>
          )}
          {result.anchored && (
            <p className="mt-2 text-[11.5px] leading-relaxed text-zinc-500">
              Anchor is live, so the release button is now allowed for this deal. Read the deliverable
              before you pay for it.
            </p>
          )}

          <pre className="mt-3 max-h-64 overflow-auto border border-[var(--rule)] bg-[#0a0a0b] p-3 font-mono text-[11px] leading-[1.7] whitespace-pre-wrap text-[#c9c3b8]">
            {result.content}
          </pre>
        </div>
      )}
    </div>
  );
}
