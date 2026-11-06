"use client";

import Link from "next/link";
import { useMemo } from "react";
import { useAccount } from "wagmi";
import AppShell from "@/components/AppShell";
import Onboarding from "@/components/Onboarding";
import { Empty, SkeletonRows, Stat, StatusPill } from "@/components/ui";
import { useProfile, ROLE_LABEL } from "@/lib/profile";
import { useCaseById } from "@/lib/usecases";
import { useVault } from "@/hooks/useVault";
import { money, shortAddress } from "@/lib/format";

export default function WorkspaceHome() {
  const { profile, hydrated } = useProfile();
  const { address } = useAccount();
  const { state, loading } = useVault();

  const isCompany = profile?.role === "company";
  // The situation chosen at setup drives the nouns: a retainer client sees
  // "milestone", a disclosure programme sees "disclosure payout". Bounties are
  // just one of the six, not the default vocabulary of the whole app.
  const uc = useCaseById(profile?.useCase);
  const noun = uc.nouns.deal;

  const mine = useMemo(() => {
    if (!address) return [];
    const me = address.toLowerCase();
    return state.deals.filter((d) =>
      (isCompany ? d.company : d.researcher).toLowerCase() === me,
    );
  }, [state.deals, address, isCompany]);

  const totals = useMemo(() => {
    const sum = (ids: number[]) =>
      mine.filter((d) => ids.includes(d.status)).reduce((a, d) => a + BigInt(d.amount), 0n);
    return { open: sum([1]), review: sum([2]), paid: sum([3, 4]) };
  }, [mine]);

  if (!hydrated) {
    return (
      <AppShell title="Overview">
        <SkeletonRows rows={4} />
      </AppShell>
    );
  }

  if (!profile) {
    return (
      <AppShell
        title="Welcome to ClearAudit"
        subtitle="Set up your workspace: what you settle decides the vocabulary, not who you are."
      >
        <Onboarding />
      </AppShell>
    );
  }

  const connected = Boolean(address);

  return (
    <AppShell
      title={`Hello, ${profile.name.split(" ")[0]}`}
      subtitle={
        isCompany
          ? `Settle ${uc.label.toLowerCase()}s: escrow the amount, release it when the evidence matches.`
          : `Your ${noun}s and payments, evidence-backed, with no invoices in between.`
      }
      actions={
        <Link href="/app/rewards" className="btn btn-primary">
          {isCompany ? `Fund a ${noun}` : `View ${noun}s`}
        </Link>
      }
    >
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Stat
          label={isCompany ? "In escrow" : "Ready to claim"}
          value={money(totals.open.toString(), state.token.decimals).replace(" USDC", "")}
          unit="USDC"
          hint={`${mine.filter((d) => d.status === 1).length} open ${noun}s`}
          accent
        />
        <Stat
          label={isCompany ? "Paid out" : "Paid to you"}
          value={money(totals.paid.toString(), state.token.decimals).replace(" USDC", "")}
          unit="USDC"
          hint={`${mine.filter((d) => d.status === 3 || d.status === 4).length} payments`}
        />
        <Stat
          label="In review"
          value={mine.filter((d) => d.status === 2).length}
          hint="Awaiting arbitration"
        />
        <Stat label="Workspace" value={ROLE_LABEL[profile.role]} hint={uc.label} />
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-[1.4fr_1fr]">
        <div className="card p-5">
          <h2 className="text-[14px] font-medium text-white">Getting started</h2>
          <p className="mt-1 text-[12.5px] text-zinc-500">
            Four steps from an empty workspace to a settled {noun}.
          </p>
          <ol className="mt-4 space-y-3">
            {[
              { done: true, title: "Create your workspace", body: "Done. Your profile is stored locally." },
              {
                done: connected,
                title: "Connect a wallet",
                body: connected ? shortAddress(address) : "Use the button in the sidebar.",
              },
              {
                done: mine.length > 0,
                title: isCompany ? `Fund your first ${noun}` : `Claim a ${noun}`,
                body: isCompany
                  ? `Name the ${uc.nouns.payee} and lock the amount in USDC.`
                  : `Open ${noun}s appear as soon as a ${uc.nouns.payer} funds one.`,
              },
              {
                done: mine.some((d) => d.status >= 3),
                title: isCompany ? "Anchor evidence, then release" : "Get paid in USDC",
                body: `The payout clears only when the anchor matches: ${uc.evidence.toLowerCase()}.`,
              },
            ].map((s, i) => (
              <li key={s.title} className="flex gap-3">
                <span
                  className={`mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full border text-[10px] ${
                    s.done
                      ? "border-emerald-400/30 bg-emerald-400/15 text-emerald-300"
                      : "border-white/12 bg-white/[0.03] text-zinc-500"
                  }`}
                >
                  {s.done ? "✓" : i + 1}
                </span>
                <span>
                  <span className={`block text-[13px] ${s.done ? "text-zinc-400" : "text-zinc-200"}`}>
                    {s.title}
                  </span>
                  <span className="block text-[11.5px] text-zinc-600">{s.body}</span>
                </span>
              </li>
            ))}
          </ol>
        </div>

        <div className="card flex flex-col p-5">
          <h2 className="text-[14px] font-medium text-white">
            {isCompany ? "How the gate decides" : "How you get paid"}
          </h2>
          <div className="mt-4 space-y-3 text-[12.5px] leading-relaxed text-zinc-400">
            <p>
              {isCompany
                ? `Funds sit in a public contract, not with us. The release is refused unless a live anchor matches the ${uc.nouns.payee}, the amount and this ${noun}.`
                : `You never sign a transaction to receive money. The ${uc.nouns.payer} releases it and it lands in your wallet.`}
            </p>
            <p>
              The evidence record is a hash with a 30-day expiry: verifiable while it matters, gone
              afterwards. For this situation that record is {uc.evidence.toLowerCase()}.
            </p>
          </div>
          <div className="mt-auto pt-5">
            <Link href="/app/payouts" className="btn btn-ghost w-full">
              View payments
            </Link>
          </div>
        </div>
      </div>

      <div className="mt-8">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-[13px] uppercase tracking-[0.1em] text-zinc-500">Recent activity</h2>
          <Link href="/app/payouts" className="text-[12px] text-zinc-500 hover:text-zinc-300">
            View all
          </Link>
        </div>

        {loading ? (
          <SkeletonRows rows={3} />
        ) : state.deals.length === 0 ? (
          <Empty
            title="Nothing here yet"
            body={
              isCompany
                ? `Your workspace is ready. Fund a ${noun} to see it here with live on-chain state.`
                : `No ${noun}s have been funded on this vault yet. When a ${uc.nouns.payer} posts one, it shows up here.`
            }
            action={
              <Link href="/app/rewards" className="btn btn-primary">
                {isCompany ? `Fund a ${noun}` : `Browse ${noun}s`}
              </Link>
            }
          />
        ) : (
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th className="capitalize">{noun}</th>
                  <th className="capitalize">{uc.nouns.payer}</th>
                  <th className="capitalize">{uc.nouns.payee}</th>
                  <th>Amount</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {state.deals.slice(0, 6).map((d) => (
                  <tr key={d.id}>
                    <td className="font-mono text-zinc-400">#{d.id}</td>
                    <td className="font-mono text-[12px] text-zinc-400">{shortAddress(d.company)}</td>
                    <td className="font-mono text-[12px] text-zinc-400">{shortAddress(d.researcher)}</td>
                    <td className="tabular-nums text-zinc-200">
                      {money(d.amount, state.token.decimals)}
                    </td>
                    <td>
                      <StatusPill status={d.status} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </AppShell>
  );
}
