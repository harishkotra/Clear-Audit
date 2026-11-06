"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { isAddress, keccak256, parseUnits, toBytes } from "viem";
import { useAccount } from "wagmi";
import AppShell from "@/components/AppShell";
import { ActionButton, Empty, ExplorerLink, Notice, SkeletonRows, StatusPill } from "@/components/ui";
import { useEscrow } from "@/hooks/useEscrow";
import { useNow, useVault } from "@/hooks/useVault";
import { useProfile } from "@/lib/profile";
import { useCaseById } from "@/lib/usecases";
import AgentDispatch from "@/components/AgentDispatch";
import { fingerprintReport, downloadBlob } from "@/lib/report";
import { ARBITRATOR_ADDRESS } from "@/lib/constants";
import { money, shortAddress, timeLeft } from "@/lib/format";
import { ZERO_ADDRESS } from "@/lib/proven";

const SEVERITIES = ["critical", "high", "medium", "low"] as const;

export default function RewardsPage() {
  const { profile, hydrated } = useProfile();
  const { address } = useAccount();
  const { state, reports, loading, refresh } = useVault();
  const {
    fundReward,
    openTask,
    openContest,
    releaseReward,
    claimTask,
    enterContest,
    registerEntrant,
    awardContest,
    refundTask,
    cancelTask,
    disputeReward,
    resolveDispute,
    commitEvidence,
    settleAfterChallenge,
    isPending,
  } = useEscrow();
  const now = useNow();
  const uc = useCaseById(profile?.useCase);
  const noun = uc.nouns.deal;

  const [researcher, setResearcher] = useState("");
  const [amount, setAmount] = useState("");
  const [mode, setMode] = useState<"named" | "open" | "contest">("named");
  const [entrant, setEntrant] = useState("");
  const [awardA, setAwardA] = useState("");
  const [awardB, setAwardB] = useState("");
  const [awardAmtA, setAwardAmtA] = useState("");
  const [awardAmtB, setAwardAmtB] = useState("");
  const [deadlineDays, setDeadlineDays] = useState("");
  const [criteria, setCriteria] = useState("");
  const [funding, setFunding] = useState(false);
  const [notice, setNotice] = useState<{ tone: "success" | "error" | "info"; text: string; href?: string } | null>(null);
  const [flashId, setFlashId] = useState<string | null>(null);

  const [openDeal, setOpenDeal] = useState<string | null>(null);
  const [reportText, setReportText] = useState("");
  const [passphrase, setPassphrase] = useState("");
  const [severity, setSeverity] = useState<(typeof SEVERITIES)[number]>("high");
  const [submitting, setSubmitting] = useState(false);
  const [releasing, setReleasing] = useState<string | null>(null);

  function flashDeal(id: string) {
    setFlashId(id);
    window.setTimeout(() => {
      setFlashId((cur) => (cur === id ? null : cur));
    }, 1100);
  }

  const isCompany = profile?.role === "company";
  const decimals = state.token.decimals;

  const mine = useMemo(() => {
    if (!address) return [];
    const me = address.toLowerCase();
    return state.deals.filter((d) =>
      isCompany ? d.payer.toLowerCase() === me : d.payee.toLowerCase() === me,
    );
  }, [state.deals, address, isCompany]);

  /** Unclaimed open tasks are invisible in `mine` because payee is still 0x0. */
  const openBoard = useMemo(
    () =>
      state.deals.filter(
        (d) => d.agentMode && d.status === 1 && d.claimedAt === 0 && d.payee.toLowerCase() === ZERO_ADDRESS,
      ),
    [state.deals],
  );

  const contestBoard = useMemo(
    () => state.deals.filter((d) => d.contestMode && d.status === 1),
    [state.deals],
  );

  const isArbitrator = Boolean(address && address.toLowerCase() === ARBITRATOR_ADDRESS.toLowerCase());
  const evidenceGate = Boolean(state.features?.evidenceGate);

  function hasPayee(payee: string) {
    return payee.toLowerCase() !== ZERO_ADDRESS;
  }

  const reportFor = (dealId: string) => reports.find((r) => r.dealId === dealId);

  async function onFund(e: React.FormEvent) {
    e.preventDefault();
    setNotice(null);
    const criteriaHash = criteria.trim() ? keccak256(toBytes(criteria.trim())) : undefined;

    if (mode === "named" && !isAddress(researcher)) {
      setNotice({ tone: "error", text: "Enter a valid payee wallet address." });
      return;
    }
    if ((mode === "open" || mode === "contest") && !(Number(deadlineDays) > 0)) {
      setNotice({ tone: "error", text: "This kind of deal needs a deadline so the money can come back." });
      return;
    }

    setFunding(true);
    try {
      const deadline =
        Number(deadlineDays) > 0
          ? Math.floor(Date.now() / 1000) + Math.round(Number(deadlineDays) * 86400)
          : 0;
      const { hash, dealId } =
        mode === "named"
          ? await fundReward(researcher as `0x${string}`, amount, { criteriaHash, deadline })
          : mode === "contest"
            ? await openContest(amount, deadline, criteriaHash)
            : await openTask(amount, deadline, criteriaHash);

      setNotice({
        tone: "success",
        text:
          mode === "named"
            ? `Reward #${dealId} funded. The named payee is the only wallet this vault can pay.`
            : mode === "contest"
              ? `Contest #${dealId} is open. Register entrants, then the judge awards shares.`
              : `Task #${dealId} is open. Any agent can claim it, and whoever claims is the only wallet it can pay.`,
        href: hash,
      });
      flashDeal(String(dealId));
      setResearcher("");
      setAmount("");
      setCriteria("");
      await refresh();
    } catch (e: unknown) {
      setNotice({ tone: "error", text: e instanceof Error ? e.message : "Funding failed." });
    } finally {
      setFunding(false);
    }
  }

  async function onClaim(dealId: string) {
    setNotice(null);
    setReleasing(dealId);
    try {
      const { hash } = await claimTask(dealId);
      setNotice({
        tone: "success",
        text: `You claimed task #${dealId}. Deliver the work, anchor the hash, and the payer can release.`,
        href: hash,
      });
      flashDeal(dealId);
      await refresh();
    } catch (e: unknown) {
      setNotice({ tone: "error", text: e instanceof Error ? e.message : "Claim failed." });
    } finally {
      setReleasing(null);
    }
  }

  async function onRefund(dealId: string) {
    setNotice(null);
    setReleasing(dealId);
    try {
      const { hash } = await refundTask(dealId);
      setNotice({ tone: "success", text: `Task #${dealId} expired and the escrow went back to the payer.`, href: hash });
      flashDeal(dealId);
      await refresh();
    } catch (e: unknown) {
      setNotice({ tone: "error", text: e instanceof Error ? e.message : "Refund failed." });
    } finally {
      setReleasing(null);
    }
  }

  async function onRelease(dealId: string) {
    setNotice(null);
    setReleasing(dealId);
    try {
      const { hash } = await releaseReward(dealId);
      setNotice({ tone: "success", text: `Payment sent for reward #${dealId}.`, href: hash });
      flashDeal(dealId);
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
      flashDeal(dealId);
      await refresh();
    } catch (e: unknown) {
      setNotice({ tone: "error", text: e instanceof Error ? e.message : "Dispute failed." });
    } finally {
      setReleasing(null);
    }
  }

  async function onCancel(dealId: string) {
    setNotice(null);
    setReleasing(dealId);
    try {
      const { hash } = await cancelTask(dealId);
      setNotice({ tone: "success", text: `Task #${dealId} cancelled. Escrow returned to the payer.`, href: hash });
      flashDeal(dealId);
      await refresh();
    } catch (e: unknown) {
      setNotice({ tone: "error", text: e instanceof Error ? e.message : "Cancel failed." });
    } finally {
      setReleasing(null);
    }
  }

  async function onResolve(dealId: string, toPayee: boolean) {
    setNotice(null);
    setReleasing(dealId);
    try {
      const { hash } = await resolveDispute(dealId, toPayee);
      setNotice({
        tone: "success",
        text: `Dispute on #${dealId} resolved ${toPayee ? "to the payee" : "to the payer"}.`,
        href: hash,
      });
      flashDeal(dealId);
      await refresh();
    } catch (e: unknown) {
      setNotice({ tone: "error", text: e instanceof Error ? e.message : "Resolve failed." });
    } finally {
      setReleasing(null);
    }
  }

  async function onCommit(dealId: string) {
    const r = reportFor(dealId);
    if (!r?.encryptedPayloadHash || !r.expiresAt) {
      setNotice({ tone: "error", text: "Anchor a finding before committing it on chain." });
      return;
    }
    setNotice(null);
    setReleasing(dealId);
    try {
      const { hash } = await commitEvidence(
        dealId,
        r.encryptedPayloadHash as `0x${string}`,
        Number(r.expiresAt),
      );
      setNotice({
        tone: "success",
        text: `Evidence committed on chain for #${dealId}. Release now requires this fingerprint.`,
        href: hash,
      });
      flashDeal(dealId);
      await refresh();
    } catch (e: unknown) {
      setNotice({ tone: "error", text: e instanceof Error ? e.message : "Commit failed." });
    } finally {
      setReleasing(null);
    }
  }

  async function onEnter(dealId: string) {
    setNotice(null);
    setReleasing(dealId);
    try {
      const { hash } = await enterContest(dealId);
      setNotice({ tone: "success", text: `Entered contest #${dealId}. The judge can now award you a share.`, href: hash });
      flashDeal(dealId);
      await refresh();
    } catch (e: unknown) {
      setNotice({ tone: "error", text: e instanceof Error ? e.message : "Entry failed." });
    } finally {
      setReleasing(null);
    }
  }

  async function onRegister(dealId: string) {
    if (!isAddress(entrant)) {
      setNotice({ tone: "error", text: "Enter a valid entrant address." });
      return;
    }
    setNotice(null);
    setReleasing(dealId);
    try {
      const { hash } = await registerEntrant(dealId, entrant as `0x${string}`);
      setNotice({ tone: "success", text: `Registered ${shortAddress(entrant)} on contest #${dealId}.`, href: hash });
      flashDeal(dealId);
      setEntrant("");
      await refresh();
    } catch (e: unknown) {
      setNotice({ tone: "error", text: e instanceof Error ? e.message : "Registration failed." });
    } finally {
      setReleasing(null);
    }
  }

  async function onAward(dealId: string, pool: string) {
    const winners: `0x${string}`[] = [];
    const amounts: bigint[] = [];
    if (isAddress(awardA) && Number(awardAmtA) > 0) {
      winners.push(awardA as `0x${string}`);
      amounts.push(parseUnits(awardAmtA, decimals));
    }
    if (isAddress(awardB) && Number(awardAmtB) > 0) {
      winners.push(awardB as `0x${string}`);
      amounts.push(parseUnits(awardAmtB, decimals));
    }
    if (winners.length === 0) {
      setNotice({ tone: "error", text: "Name at least one winner and amount." });
      return;
    }
    const sum = amounts.reduce((a, b) => a + b, 0n);
    if (sum !== BigInt(pool)) {
      setNotice({ tone: "error", text: "Winner amounts must add up to the prize exactly." });
      return;
    }
    setNotice(null);
    setReleasing(dealId);
    try {
      const { hash } = await awardContest(dealId, winners, amounts);
      setNotice({ tone: "success", text: `Contest #${dealId} awarded.`, href: hash });
      flashDeal(dealId);
      await refresh();
    } catch (e: unknown) {
      setNotice({ tone: "error", text: e instanceof Error ? e.message : "Award failed." });
    } finally {
      setReleasing(null);
    }
  }

  async function onSettle(dealId: string) {
    setNotice(null);
    setReleasing(dealId);
    try {
      const { hash } = await settleAfterChallenge(dealId);
      setNotice({ tone: "success", text: `Settled #${dealId} after the challenge window.`, href: hash });
      flashDeal(dealId);
      await refresh();
    } catch (e: unknown) {
      setNotice({ tone: "error", text: e instanceof Error ? e.message : "Settle failed." });
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
      flashDeal(dealId);
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

      {contestBoard.length > 0 && (
        <div className="mb-6 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-[13px] uppercase tracking-[0.1em] text-zinc-500">Open contests</h2>
            <span className="text-[12px] text-zinc-600">{contestBoard.length} live</span>
          </div>
          {contestBoard.map((d) => (
            <div key={d.id} className={`card space-y-3 p-4 ${flashId === d.id ? "row-flash" : ""}`}>
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <div className="text-[15px] font-medium text-white">{money(d.amount, decimals)} prize</div>
                  <div className="text-[11.5px] text-zinc-500">
                    #{d.id} · {shortAddress(d.payer)}
                    {d.deadline > 0 && now ? ` · ${timeLeft(String(d.deadline), now)}` : ""}
                    {d.evidence?.hash ? " · evidence committed" : " · waiting for evidence"}
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  {!isCompany && (
                    <ActionButton
                      variant="mint"
                      className="h-8 px-3 text-[12px]"
                      busy={releasing === d.id}
                      busyLabel="Entering…"
                      disabled={isPending}
                      onClick={() => onEnter(d.id)}
                    >
                      Enter
                    </ActionButton>
                  )}
                  {isCompany && d.payer.toLowerCase() === address?.toLowerCase() && (
                    <ActionButton
                      variant="ghost"
                      className="h-8 px-3 text-[12px]"
                      busy={releasing === d.id}
                      busyLabel="Registering…"
                      disabled={isPending || !isAddress(entrant)}
                      onClick={() => onRegister(d.id)}
                    >
                      Register entrant
                    </ActionButton>
                  )}
                  {isArbitrator && (
                    <ActionButton
                      variant="primary"
                      className="h-8 px-3 text-[12px]"
                      busy={releasing === d.id}
                      busyLabel="Awarding…"
                      disabled={isPending}
                      onClick={() => onAward(d.id, d.amount)}
                    >
                      Award
                    </ActionButton>
                  )}
                </div>
              </div>
              {isCompany && d.payer.toLowerCase() === address?.toLowerCase() && (
                <input
                  className="field font-mono text-[12px]"
                  placeholder="Entrant 0x…"
                  value={entrant}
                  onChange={(e) => setEntrant(e.target.value.trim())}
                  spellCheck={false}
                />
              )}
              {isArbitrator && (
                <div className="grid gap-2 sm:grid-cols-2">
                  <input className="field font-mono text-[12px]" placeholder="Winner A 0x…" value={awardA} onChange={(e) => setAwardA(e.target.value.trim())} spellCheck={false} />
                  <input className="field tabular-nums text-[12px]" placeholder="Amount A" value={awardAmtA} onChange={(e) => setAwardAmtA(e.target.value.replace(/[^0-9.]/g, ""))} />
                  <input className="field font-mono text-[12px]" placeholder="Winner B 0x… (optional)" value={awardB} onChange={(e) => setAwardB(e.target.value.trim())} spellCheck={false} />
                  <input className="field tabular-nums text-[12px]" placeholder="Amount B" value={awardAmtB} onChange={(e) => setAwardAmtB(e.target.value.replace(/[^0-9.]/g, ""))} />
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {isCompany && (
        <div className="grid gap-4 lg:grid-cols-[380px_1fr]">
          <form id="fund" onSubmit={onFund} className="card h-fit p-5">
            <h2 className="text-[14px] font-medium capitalize text-white">Fund a {noun}</h2>
            <p className="mt-1 text-[12.5px] leading-relaxed text-zinc-500">
              The amount is locked in the vault. You stay in control of when it is released.
            </p>

            <div className="mt-4 flex gap-1 rounded-[2px] border border-[var(--rule)] p-1">
              {(["named", "open", "contest"] as const).map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => {
                    setMode(m);
                    if ((m === "open" || m === "contest") && !deadlineDays) setDeadlineDays("7");
                  }}
                  className={`flex-1 rounded-[2px] px-2 py-1.5 text-[11.5px] transition-[background,color] duration-[160ms] ease ${
                    mode === m
                      ? "bg-[#ece7dd] text-[#0b0b0c]"
                      : "text-zinc-400 hover:text-zinc-200"
                  }`}
                >
                  {m === "named" ? "Name the payee" : m === "open" ? "Open to any agent" : "Contest"}
                </button>
              ))}
            </div>

            <div key={mode} className="panel-swap mt-3 space-y-3">
              {mode === "named" && (
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
              )}
              <div>
                <label className="label" htmlFor="deadline">
                  {mode === "named" ? "Deadline (days, optional)" : "Deadline (days)"}
                </label>
                <input
                  id="deadline"
                  className="field tabular-nums"
                  inputMode="numeric"
                  placeholder={mode === "named" ? "0" : "7"}
                  value={deadlineDays}
                  onChange={(e) => setDeadlineDays(e.target.value.replace(/[^0-9]/g, ""))}
                />
                <p className="mt-1.5 text-[11px] leading-relaxed text-zinc-600">
                  {mode === "named"
                    ? "If set, anyone can refund the escrow after this window. Leave 0 for no expiry."
                    : "After this, anyone can refund the escrow to the payer. The vault refuses a contest or open task with no deadline."}
                </p>
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
              <div>
                <label className="label" htmlFor="criteria">Acceptance criteria (optional)</label>
                <input
                  id="criteria"
                  className="field"
                  placeholder="What the delivered artefact must show"
                  value={criteria}
                  onChange={(e) => setCriteria(e.target.value)}
                />
                <p className="mt-1.5 text-[11px] leading-relaxed text-zinc-600">
                  Stored as a hash on chain. It settles what was asked without putting the brief in
                  the clear.
                </p>
              </div>
            </div>

            <ActionButton
              type="submit"
              className="mt-4 w-full"
              busy={funding || isPending}
              busyLabel="Confirm in your wallet…"
            >
              {mode === "named"
                ? `Fund ${noun}`
                : mode === "contest"
                  ? `Escrow the prize`
                  : `Open ${noun} to agents`}
            </ActionButton>
            <p className="mt-3 text-[11px] leading-relaxed text-zinc-600">
              Requires an approval and one deposit transaction. The vault holds the funds, not
              ClearAudit.
            </p>

            <div className="mt-4 border-t border-[var(--rule)] pt-3">
              <div className="flex items-center justify-between">
                <span className="micro">Open claiming</span>
                <span className="chip text-[#8bd17c]">live on v2</span>
              </div>
              <p className="mt-2 text-[11.5px] leading-relaxed text-zinc-500">
                Name one payee, leave it open for any agent, or run a contest. A contest lets the
                judge split the prize across registered entrants in one transaction.
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
                mark="vault"
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
                      const busy = releasing === d.id;
                      const evidenceHref = r?.ref
                        ? `/evidence?ref=${encodeURIComponent(r.ref)}`
                        : `/evidence?dealId=${d.id}`;
                      return (
                        <tr key={d.id} className={flashId === d.id ? "row-flash" : undefined}>
                          <td className="font-mono text-zinc-400">
                            <Link href={evidenceHref} className="hover:text-zinc-200">
                              {r?.ref ? (
                                <span className="block">
                                  <span className="text-zinc-200">{r.ref}</span>
                                  <span className="mt-0.5 block text-[10px] text-zinc-600">#{d.id}</span>
                                </span>
                              ) : (
                                `#${d.id}`
                              )}
                            </Link>
                          </td>
                          <td className="font-mono text-[12px] text-zinc-400">
                            {hasPayee(d.payee) ? shortAddress(d.payee) : "unclaimed"}
                          </td>
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
                            <div className="flex flex-wrap justify-end gap-1.5">
                            {d.status === 1 && d.claimedAt === 0 && (
                              <ActionButton
                                variant="plain"
                                onClick={() => onCancel(d.id)}
                                busy={busy}
                                busyLabel="Cancelling…"
                                disabled={isPending}
                                className="h-8 px-3 text-[12px] text-zinc-300"
                              >
                                Cancel
                              </ActionButton>
                            )}
                            {d.status === 1 && d.deadline > 0 && now > 0 && d.deadline * 1000 < now && (
                              <ActionButton
                                variant="plain"
                                onClick={() => onRefund(d.id)}
                                busy={busy}
                                busyLabel="Refunding…"
                                disabled={isPending}
                                className="h-8 px-3 text-[12px] text-zinc-300"
                              >
                                Refund expired
                              </ActionButton>
                            )}
                            {d.status === 1 && hasPayee(d.payee) && evidenceGate && r && !(d.evidence?.hash && d.evidence.hash !== `0x${"00".repeat(32)}`) && (
                              <ActionButton
                                variant="plain"
                                onClick={() => onCommit(d.id)}
                                busy={busy}
                                busyLabel="Committing…"
                                disabled={isPending}
                                className="h-8 px-3 text-[12px] text-zinc-200"
                              >
                                Commit evidence
                              </ActionButton>
                            )}
                            {d.status === 1 && hasPayee(d.payee) && (
                              <ActionButton
                                variant="mint"
                                onClick={() => onRelease(d.id)}
                                busy={busy}
                                busyLabel="Paying…"
                                disabled={!r || isPending}
                                title={
                                  r
                                    ? "Release the escrowed reward to the stored payee"
                                    : "The payee must anchor a finding before payment can be released"
                                }
                                className="h-8 px-3 text-[12px] disabled:cursor-not-allowed"
                              >
                                {r ? "Release payment" : "Anchor required"}
                              </ActionButton>
                            )}
                            {d.status === 1 && hasPayee(d.payee) && (
                              <ActionButton
                                variant="ghost"
                                onClick={() => onDispute(d.id)}
                                busy={busy}
                                busyLabel="Freezing…"
                                disabled={isPending}
                                className="h-8 px-3 text-[12px]"
                              >
                                Dispute
                              </ActionButton>
                            )}
                            {evidenceGate &&
                              d.status === 1 &&
                              d.evidence &&
                              d.evidence.challengeUntil > 0 &&
                              now > 0 &&
                              now / 1000 >= d.evidence.challengeUntil && (
                                <ActionButton
                                  variant="mint"
                                  onClick={() => onSettle(d.id)}
                                  busy={busy}
                                  busyLabel="Settling…"
                                  disabled={isPending}
                                  className="h-8 px-3 text-[12px]"
                                >
                                  Settle after challenge
                                </ActionButton>
                              )}
                            {d.status === 2 && isArbitrator && (
                              <>
                                <ActionButton
                                  variant="mint"
                                  onClick={() => onResolve(d.id, true)}
                                  busy={busy}
                                  busyLabel="Resolving…"
                                  disabled={isPending}
                                  className="h-8 px-3 text-[12px]"
                                >
                                  Pay payee
                                </ActionButton>
                                <ActionButton
                                  variant="plain"
                                  onClick={() => onResolve(d.id, false)}
                                  busy={busy}
                                  busyLabel="Resolving…"
                                  disabled={isPending}
                                  className="h-8 px-3 text-[12px] text-zinc-300"
                                >
                                  Refund payer
                                </ActionButton>
                              </>
                            )}
                            </div>
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
                payee: d.payee,
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
              Named rewards reserved for this wallet show below. Open tasks anyone can claim are on
              the board above them.
            </p>
            <div className="flex gap-2">
              <Link href="/evidence" className="btn btn-ghost h-8 shrink-0 text-[12px]">
                Public evidence
              </Link>
              <Link href="/app/payouts" className="btn btn-ghost h-8 shrink-0 text-[12px]">
                How payouts work
              </Link>
            </div>
          </div>

          <div className="mb-6">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-[13px] uppercase tracking-[0.1em] text-zinc-500">Open tasks</h2>
              <span className="text-[12px] text-zinc-600">{openBoard.length} unclaimed</span>
            </div>
            {loading ? (
              <SkeletonRows rows={2} />
            ) : openBoard.length === 0 ? (
              <Empty
                mark="fingerprint"
                title="No open tasks"
                body="When a payer opens work to any agent, it appears here until someone claims it."
              />
            ) : (
              <div className="space-y-2">
                {openBoard.map((d) => (
                  <div
                    key={d.id}
                    className={`card flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between ${
                      flashId === d.id ? "row-flash" : ""
                    }`}
                  >
                    <div>
                      <div className="text-[15px] font-medium text-white">{money(d.amount, decimals)}</div>
                      <div className="text-[11.5px] text-zinc-500">
                        #{d.id} from {shortAddress(d.payer)}
                        {d.deadline > 0 && now
                          ? ` · ${timeLeft(String(d.deadline), now)}`
                          : ""}
                      </div>
                    </div>
                    <ActionButton
                      variant="mint"
                      onClick={() => onClaim(d.id)}
                      busy={releasing === d.id}
                      busyLabel="Claiming…"
                      disabled={isPending}
                      className="h-8 px-3 text-[12px]"
                    >
                      Claim
                    </ActionButton>
                  </div>
                ))}
              </div>
            )}
          </div>

          {loading ? (
            <SkeletonRows rows={4} />
          ) : mine.length === 0 ? (
            <Empty
              title="No rewards assigned to you"
              body={
                address
                  ? "Claim an open task above, or ask a payer to name this wallet."
                  : "Connect the wallet a company will pay, and your rewards appear here."
              }
              action={<Link href="/app/settings" className="btn btn-ghost">Wallet settings</Link>}
            />
          ) : (
            <div className="space-y-3">
              {mine.map((d) => {
                const r = reportFor(d.id);
                const expanded = openDeal === d.id;
                const busy = releasing === d.id;
                return (
                  <div
                    key={d.id}
                    className={`card overflow-hidden ${flashId === d.id ? "row-flash" : ""}`}
                  >
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
                            from {shortAddress(d.payer)}
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
                          <ActionButton
                            variant="ghost"
                            className="h-8 px-3 text-[12px]"
                            onClick={() => onDispute(d.id)}
                            busy={busy}
                            busyLabel="Freezing…"
                            disabled={isPending}
                            title="Freeze this reward for neutral arbitration"
                          >
                            Dispute
                          </ActionButton>
                        )}
                        {d.status === 2 && isArbitrator && (
                          <>
                            <ActionButton
                              variant="mint"
                              className="h-8 px-3 text-[12px]"
                              onClick={() => onResolve(d.id, true)}
                              busy={busy}
                              busyLabel="Resolving…"
                              disabled={isPending}
                            >
                              Pay payee
                            </ActionButton>
                            <ActionButton
                              variant="plain"
                              className="h-8 px-3 text-[12px] text-zinc-300"
                              onClick={() => onResolve(d.id, false)}
                              busy={busy}
                              busyLabel="Resolving…"
                              disabled={isPending}
                            >
                              Refund payer
                            </ActionButton>
                          </>
                        )}
                      </div>
                    </div>

                    {expanded && (
                      <div key={`expand-${d.id}`} className="panel-swap border-t border-white/8 bg-black/20 p-4">
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
                          <ActionButton
                            className="h-9 shrink-0"
                            busy={submitting}
                            busyLabel="Anchoring…"
                            onClick={() => onSubmitReport(d.id)}
                          >
                            Anchor finding
                          </ActionButton>
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
