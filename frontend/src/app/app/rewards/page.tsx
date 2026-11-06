"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { isAddress } from "viem";
import { useAccount } from "wagmi";
import AppShell from "@/components/AppShell";
import { Empty, ExplorerLink, Notice, SkeletonRows, StatusPill } from "@/components/ui";
import { useEscrow } from "@/hooks/useEscrow";
import { useNow, useVault } from "@/hooks/useVault";
import { useProfile } from "@/lib/profile";
import { useCaseById } from "@/lib/usecases";
import AgentDispatch from "@/components/AgentDispatch";
import { fingerprintReport, downloadBlob } from "@/lib/report";
import { money, shortAddress, timeLeft } from "@/lib/format";

const SEVERITIES = ["critical", "high", "medium", "low"] as const;

export default function RewardsPage() {
  const { profile, hydrated } = useProfile();
  const { address } = useAccount();
  const { state, reports, loading, refresh } = useVault();
  const { fundReward, releaseReward, disputeReward, isPending } = useEscrow();
  const now = useNow();
  const uc = useCaseById(profile?.useCase);
  const noun = uc.nouns.deal;

  const [researcher, setResearcher] = useState("");
  const [amount, setAmount] = useState("");
  const [funding, setFunding] = useState(false);
  const [notice, setNotice] = useState<{ tone: "success" | "error" | "info"; text: string; href?: string } | null>(null);

  const [openDeal, setOpenDeal] = useState<string | null>(null);
  const [reportText, setReportText] = useState("");
  const [passphrase, setPassphrase] = useState("");
  const [severity, setSeverity] = useState<(typeof SEVERITIES)[number]>("high");
  const [submitting, setSubmitting] = useState(false);
  const [releasing, setReleasing] = useState<string | null>(null);

  const isCompany = profile?.role === "company";
  const decimals = state.token.decimals;

  const mine = useMemo(() => {
    if (!address) return [];
    const me = address.toLowerCase();
    return state.deals.filter((d) =>
      (isCompany ? d.company : d.researcher).toLowerCase() === me,
    );
  }, [state.deals, address, isCompany]);

  const reportFor = (dealId: string) => reports.find((r) => r.dealId === dealId);

  async function onFund(e: React.FormEvent) {
    e.preventDefault();
    setNotice(null);
    if (!isAddress(researcher)) {
      setNotice({ tone: "error", text: "Enter a valid researcher wallet address." });
      return;
    }
    setFunding(true);
    try {
      const { hash, dealId } = await fundReward(researcher, amount);
      setNotice({
        tone: "success",
        text: `Reward #${dealId} funded. The researcher can now submit a finding.`,
        href: hash,
      });
      setResearcher("");
      setAmount("");
      await refresh();
    } catch (e: unknown) {
      setNotice({ tone: "error", text: e instanceof Error ? e.message : "Funding failed." });
    } finally {
      setFunding(false);
    }
  }

  async function onRelease(dealId: string) {
    setNotice(null);
    setReleasing(dealId);
    try {
      const { hash } = await releaseReward(dealId);
      setNotice({ tone: "success", text: `Payment sent for reward #${dealId}.`, href: hash });
      await refresh();
    } catch (e: unknown) {
      setNotice({ tone: "error", text: e instanceof Error ? e.message : "Payment failed." });
    } finally {
      setReleasing(null);
    }
  }

  async function onDispute(dealId: string) {
    setNotice(null);
    setReleasing(dealId);
    try {
      const { hash } = await disputeReward(dealId);
      setNotice({
        tone: "info",
        text: `Reward #${dealId} is frozen for arbitration. The arbitrator can send it to exactly one party.`,
        href: hash,
      });
      await refresh();
    } catch (e: unknown) {
      setNotice({ tone: "error", text: e instanceof Error ? e.message : "Dispute failed." });
    } finally {
      setReleasing(null);
    }
  }

  async function onSubmitReport(dealId: string) {
    setNotice(null);
    if (reportText.trim().length < 20) {
      setNotice({ tone: "error", text: "Paste at least a short summary of the finding." });
      return;
    }
    setSubmitting(true);
    try {
      const fp = await fingerprintReport(reportText, passphrase || undefined);
      const res = await fetch("/api/reports", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          dealId,
          encryptedPayloadHash: fp.hash,
          severity,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Could not anchor the finding.");

      if (fp.blob) downloadBlob(fp.blob, `clearaudit-report-${dealId}.bin`);
      setNotice({
        tone: "success",
        text: fp.encrypted
          ? "Finding anchored. The encrypted file was downloaded - send it to the company out-of-band."
          : "Finding anchored. Only the fingerprint left your browser.",
      });
      setOpenDeal(null);
      setReportText("");
      setPassphrase("");
      await refresh();
    } catch (e: unknown) {
      setNotice({ tone: "error", text: e instanceof Error ? e.message : "Submission failed." });
    } finally {
      setSubmitting(false);
    }
  }

  if (!hydrated) {
    return <AppShell title="Rewards"><SkeletonRows rows={4} /></AppShell>;
  }

  if (!profile) {
    return (
      <AppShell title="Rewards" subtitle="Create a workspace to fund or find rewards.">
        <Empty
          title="No workspace yet"
          body="Set up your profile to start using rewards."
          action={<Link href="/app" className="btn btn-primary">Create workspace</Link>}
        />
      </AppShell>
    );
  }

  return (
    <AppShell
      title={uc.label}
      subtitle={
        isCompany
          ? `Lock the amount in USDC. Release it when ${uc.evidence.toLowerCase()} matches.`
          : `${uc.label}s are reserved for a wallet. Deliver, and the ${uc.nouns.payer} releases.`
      }
      actions={
        isCompany ? (
          <a href="#fund" className="btn btn-primary">Fund a {noun}</a>
        ) : (
          <Link href="/app/payouts" className="btn btn-ghost">Payment history</Link>
        )
      }
    >
      {notice && (
        <div className="mb-4">
          <Notice tone={notice.tone}>
            {notice.text}{" "}
            {notice.href && <ExplorerLink path={`/tx/${notice.href}`}>view transaction ↗</ExplorerLink>}
          </Notice>
        </div>
      )}

      {state.arkiv && state.arkiv.writer !== "ready" && (
        <div className="mb-4">
          <Notice tone="info">
            <strong className="text-zinc-200">Evidence anchoring is paused.</strong>{" "}
            {state.arkiv.reason ?? "The Arkiv writer is not ready."}{" "}
            {state.arkiv.gate
              ? "Payouts stay blocked until it is funded - the anchor gate fails closed."
              : "REQUIRE_ARKIV_ANCHOR=false is set, so this demo can settle without an anchor."}
          </Notice>
        </div>
      )}

      {isCompany && (
        <div className="grid gap-4 lg:grid-cols-[380px_1fr]">
          <form id="fund" onSubmit={onFund} className="card h-fit p-5">
            <h2 className="text-[14px] font-medium capitalize text-white">Fund a {noun}</h2>
            <p className="mt-1 text-[12.5px] leading-relaxed text-zinc-500">
              The amount is locked in the vault. You stay in control of when it is released.
            </p>

            <div className="mt-4 space-y-3">
              <div>
                <label className="label capitalize" htmlFor="researcher">{uc.nouns.payee} wallet</label>
                <input
                  id="researcher"
                  className="field font-mono text-[12.5px]"
                  placeholder="0x…"
                  value={researcher}
                  onChange={(e) => setResearcher(e.target.value.trim())}
                  spellCheck={false}
                />
              </div>
              <div>
                <label className="label capitalize" htmlFor="amount">{noun} amount</label>
                <div className="relative">
                  <input
                    id="amount"
                    className="field pr-14 tabular-nums"
                    inputMode="decimal"
                    placeholder="12500.00"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value.replace(/[^0-9.]/g, ""))}
                  />
                  <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[12px] text-zinc-500">
                    USDC
                  </span>
                </div>
              </div>
            </div>

            <button className="btn btn-primary mt-4 w-full" disabled={funding || isPending}>
              {funding ? "Confirm in your wallet…" : `Fund ${noun}`}
            </button>
            <p className="mt-3 text-[11px] leading-relaxed text-zinc-600">
              Requires an approval and one deposit transaction. The vault holds the funds, not
              ClearAudit.
            </p>

            <div className="mt-4 border-t border-[var(--rule)] pt-3">
              <div className="flex items-center justify-between">
                <span className="micro">Open to agents</span>
                <span className="chip text-[#c9a06a]">needs v2</span>
              </div>
              <p className="mt-2 text-[11.5px] leading-relaxed text-zinc-500">
                Let any agent claim this {noun} instead of naming one {uc.nouns.payee}. The gate
                already checks the delivered artefact, but open claiming needs a deadline, a refund
                path and claimTask, none of which the deployed vault has.
              </p>
            </div>
          </form>

          <div>
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-[13px] uppercase tracking-[0.1em] text-zinc-500">Your {noun}s</h2>
              <span className="text-[12px] text-zinc-600">{mine.length} total</span>
            </div>
            {loading ? (
              <SkeletonRows rows={4} />
            ) : mine.length === 0 ? (
              <Empty
                title={`No ${noun}s yet`}
                body={`Fund your first ${noun}. The ${uc.nouns.payee} you name is the only wallet the vault can pay.`}
              />
            ) : (
              <div className="table-wrap">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th className="capitalize">{noun}</th>
                      <th>Researcher</th>
                      <th>Amount</th>
                      <th>Finding</th>
                      <th>Status</th>
                      <th />
                    </tr>
                  </thead>
                  <tbody>
                    {mine.map((d) => {
                      const r = reportFor(d.id);
                      return (
                        <tr key={d.id}>
                          <td className="font-mono text-zinc-400">#{d.id}</td>
                          <td className="font-mono text-[12px] text-zinc-400">{shortAddress(d.researcher)}</td>
                          <td className="tabular-nums text-zinc-200">{money(d.amount, decimals)}</td>
                          <td className="text-[12px] text-zinc-400">
                            {r ? (
                              <span>
                                <span className="uppercase text-zinc-300">{r.severity}</span>
                                <span className="block text-[11px] text-zinc-600">
                                  {now ? timeLeft(r.expiresAt, now) : "-"}
                                </span>
                              </span>
                            ) : (
                              <span className="text-zinc-600">-</span>
                            )}
                          </td>
                          <td><StatusPill status={d.status} /></td>
                          <td className="text-right">
                            {d.status === 1 && (
                              <button
                                onClick={() => onRelease(d.id)}
                                disabled={!r || releasing === d.id || isPending}
                                title={
                                  r
                                    ? "Release the escrowed reward to the researcher"
                                    : "The researcher must anchor a finding before payment can be released"
                                }
                                className="btn btn-mint h-8 px-3 text-[12px] disabled:cursor-not-allowed"
                              >
                                {releasing === d.id ? "Paying…" : r ? "Release payment" : "Anchor required"}
                              </button>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}

            <AgentDispatch
              deals={mine.map((d) => ({
                id: d.id,
                researcher: d.researcher,
                amount: money(d.amount, decimals),
                status: d.status,
              }))}
            />
          </div>
        </div>
      )}

      {!isCompany && (
        <div>
          <div className="card mb-4 flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-[12.5px] leading-relaxed text-zinc-400">
              Rewards are reserved for a specific wallet. If a company named your address, it shows
              up below.
            </p>
            <Link href="/app/payouts" className="btn btn-ghost h-8 shrink-0 text-[12px]">
              How payouts work
            </Link>
          </div>

          {loading ? (
            <SkeletonRows rows={4} />
          ) : mine.length === 0 ? (
            <Empty
              title="No rewards assigned to you"
              body={
                address
                  ? "Ask the company to use this wallet address when they fund a reward. You can copy it from Settings."
                  : "Connect the wallet a company will pay, and your rewards appear here."
              }
              action={<Link href="/app/settings" className="btn btn-ghost">Wallet settings</Link>}
            />
          ) : (
            <div className="space-y-3">
              {mine.map((d) => {
                const r = reportFor(d.id);
                const expanded = openDeal === d.id;
                return (
                  <div key={d.id} className="card overflow-hidden">
                    <div className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
                      <div className="flex items-center gap-4">
                        <div className="grid h-10 w-10 place-items-center rounded-lg border border-white/10 bg-white/[0.03] font-mono text-[11px] text-zinc-500">
                          #{d.id}
                        </div>
                        <div>
                          <div className="text-[15px] font-medium text-white">
                            {money(d.amount, decimals)}
                          </div>
                          <div className="text-[11.5px] text-zinc-500">
                            from {shortAddress(d.company)}
                            {r && ` · ${r.severity} finding anchored`}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <StatusPill status={d.status} />
                        {d.status === 1 && !r && (
                          <button
                            className="btn btn-primary h-8 px-3 text-[12px]"
                            onClick={() => setOpenDeal(expanded ? null : d.id)}
                          >
                            {expanded ? "Cancel" : "Submit finding"}
                          </button>
                        )}
                        {d.status === 1 && r && (
                          <span className="chip border-emerald-400/25 text-emerald-300">
                            {now ? timeLeft(r.expiresAt, now) : "anchored"}
                          </span>
                        )}
                        {d.status === 1 && (
                          <button
                            className="btn btn-ghost h-8 px-3 text-[12px]"
                            onClick={() => onDispute(d.id)}
                            disabled={releasing === d.id || isPending}
                            title="Freeze this reward for neutral arbitration"
                          >
                            {releasing === d.id ? "Freezing…" : "Dispute"}
                          </button>
                        )}
                      </div>
                    </div>

                    {expanded && (
                      <div className="border-t border-white/8 bg-black/20 p-4">
                        <div className="grid gap-3 lg:grid-cols-[1fr_260px]">
                          <div>
                            <label className="label" htmlFor={`report-${d.id}`}>
                              The finding
                            </label>
                            <textarea
                              id={`report-${d.id}`}
                              className="field h-32 resize-none py-2 leading-relaxed"
                              placeholder="Where is the bug, how is it reached, and what is the impact?"
                              value={reportText}
                              onChange={(e) => setReportText(e.target.value)}
                            />
                          </div>
                          <div className="space-y-3">
                            <div>
                              <label className="label" htmlFor={`sev-${d.id}`}>Severity</label>
                              <select
                                id={`sev-${d.id}`}
                                className="field"
                                value={severity}
                                onChange={(e) => setSeverity(e.target.value as typeof severity)}
                              >
                                {SEVERITIES.map((s) => (
                                  <option key={s} value={s}>{s}</option>
                                ))}
                              </select>
                            </div>
                            <div>
                              <label className="label" htmlFor={`pass-${d.id}`}>
                                Passphrase <span className="text-zinc-600">(optional)</span>
                              </label>
                              <input
                                id={`pass-${d.id}`}
                                className="field"
                                type="password"
                                placeholder="Encrypt the file"
                                value={passphrase}
                                onChange={(e) => setPassphrase(e.target.value)}
                              />
                            </div>
                          </div>
                        </div>
                        <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                          <p className="text-[11px] leading-relaxed text-zinc-600">
                            The report never leaves your browser.{" "}
                            {passphrase
                              ? "It is encrypted locally and you download the file to share."
                              : "Only a SHA-256 fingerprint is anchored."}
                          </p>
                          <button
                            className="btn btn-primary h-9 shrink-0"
                            disabled={submitting}
                            onClick={() => onSubmitReport(d.id)}
                          >
                            {submitting ? "Anchoring…" : "Anchor finding"}
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </AppShell>
  );
}
