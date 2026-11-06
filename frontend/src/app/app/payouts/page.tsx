"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useAccount } from "wagmi";
import AppShell from "@/components/AppShell";
import { Empty, ExplorerLink, SkeletonRows, Stat, StatusPill } from "@/components/ui";
import { useNow, useVault } from "@/hooks/useVault";
import { useProfile } from "@/lib/profile";
import { money, shortAddress, timeLeft } from "@/lib/format";

const FILTERS = [
  { id: "all", label: "All" },
  { id: "open", label: "Pending" },
  { id: "review", label: "In review" },
  { id: "paid", label: "Paid" },
] as const;

type Filter = (typeof FILTERS)[number]["id"];

export default function PaymentsPage() {
  const { profile, hydrated } = useProfile();
  const { address } = useAccount();
  const { state, reports, loading } = useVault();
  const now = useNow();
  const [filter, setFilter] = useState<Filter>("all");

  const deals = useMemo(() => {
    const all = state.deals;
    if (filter === "open") return all.filter((d) => d.status === 1);
    if (filter === "review") return all.filter((d) => d.status === 2);
    if (filter === "paid") return all.filter((d) => d.status === 3 || d.status === 4);
    return all;
  }, [state.deals, filter]);

  const reportFor = (id: string) => reports.find((r) => r.dealId === id);

  if (!hydrated) {
    return <AppShell title="Payments"><SkeletonRows rows={4} /></AppShell>;
  }

  if (!profile) {
    return (
      <AppShell title="Payments" subtitle="Create a workspace to see payment activity.">
        <Empty
          title="No workspace yet"
          body="Payments are tied to a wallet. Create your workspace first."
          action={<Link href="/app" className="btn btn-primary">Create workspace</Link>}
        />
      </AppShell>
    );
  }

  const isCompany = profile.role === "company";

  return (
    <AppShell
      title="Payments"
      subtitle="Every reward, its current state, and the evidence attached to it."
      actions={
        <Link href="/app/rewards" className="btn btn-primary">
          {isCompany ? "Fund a reward" : "View rewards"}
        </Link>
      }
    >
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Stat
          label="Paid out"
          value={money(state.totals.paid, state.token.decimals).replace(" USDC", "")}
          unit="USDC"
          hint={`${state.counts.paid} completed`}
          accent
        />
        <Stat
          label="Pending"
          value={money(state.totals.open, state.token.decimals).replace(" USDC", "")}
          unit="USDC"
          hint={`${state.counts.open} awaiting review`}
        />
        <Stat
          label="In escrow"
          value={money(state.escrowed, state.token.decimals).replace(" USDC", "")}
          unit="USDC"
          hint="Held by the vault"
        />
        <Stat label="In review" value={state.counts.review} hint="Arbitration in progress" />
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-[1fr_290px]">
        <div>
          <div className="mb-3 flex items-center justify-between gap-3">
            <div className="flex flex-wrap gap-1.5">
              {FILTERS.map((f) => (
                <button
                  key={f.id}
                  onClick={() => setFilter(f.id)}
                  className={`rounded-lg border px-2.5 py-1 text-[12px] transition ${
                    filter === f.id
                      ? "border-white/20 bg-white/10 text-white"
                      : "border-transparent text-zinc-500 hover:text-zinc-300"
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>
            <span className="text-[12px] text-zinc-600">{deals.length} shown</span>
          </div>

          {loading ? (
            <SkeletonRows rows={5} />
          ) : deals.length === 0 ? (
            <Empty
              title={filter === "all" ? "No payments yet" : "Nothing in this filter"}
              body={
                filter === "all"
                  ? "When a reward is funded it appears here. Every state change is on-chain."
                  : "Try another filter - there is no data hiding behind it."
              }
              action={<Link href="/app/rewards" className="btn btn-ghost">Go to rewards</Link>}
            />
          ) : (
            <div className="table-wrap">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Reward</th>
                    <th>From</th>
                    <th>To</th>
                    <th>Amount</th>
                    <th>Evidence</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {deals.map((d) => {
                    const r = reportFor(d.id);
                    const mineRow =
                      address &&
                      (d.payer.toLowerCase() === address.toLowerCase() ||
                        d.payee.toLowerCase() === address.toLowerCase());
                    return (
                      <tr key={d.id} className={mineRow ? "bg-white/[0.015]" : ""}>
                        <td className="font-mono text-zinc-400">
                          <Link href={`/evidence?dealId=${d.id}`} className="hover:text-zinc-200">
                            #{d.id}
                          </Link>
                        </td>
                        <td className="font-mono text-[12px] text-zinc-400">{shortAddress(d.payer)}</td>
                        <td className="font-mono text-[12px] text-zinc-400">{shortAddress(d.payee)}</td>
                        <td className="tabular-nums text-zinc-200">{money(d.amount, state.token.decimals)}</td>
                        <td className="text-[12px] text-zinc-400">
                          {r ? (
                            <>
                              <span className="uppercase text-zinc-300">{r.severity}</span>
                              <span className="block text-[11px] text-zinc-600">
                                {now ? timeLeft(r.expiresAt, now) : "anchored"}
                              </span>
                            </>
                          ) : (
                            <span className="text-zinc-600">No anchor</span>
                          )}
                        </td>
                        <td><StatusPill status={d.status} /></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <aside className="space-y-4">
          <div className="card p-4">
            <h2 className="text-[13px] font-medium text-white">Where the money lives</h2>
            <dl className="mt-3 space-y-2.5 text-[12px]">
              <div className="flex items-center justify-between gap-3">
                <dt className="text-zinc-500">Vault</dt>
                <dd><ExplorerLink path={`/address/${state.vault}`}>{shortAddress(state.vault)}</ExplorerLink></dd>
              </div>
              <div className="flex items-center justify-between gap-3">
                <dt className="text-zinc-500">Asset</dt>
                <dd className="font-mono text-zinc-300">{state.token.symbol}</dd>
              </div>
              <div className="flex items-center justify-between gap-3">
                <dt className="text-zinc-500">Network</dt>
                <dd className="text-zinc-300">Arc Testnet</dd>
              </div>
            </dl>
          </div>

          <div className="card p-4">
            <h2 className="text-[13px] font-medium text-white">Settlement, step by step</h2>
            <ol className="mt-3 space-y-3">
              {[
                ["Funded", "The company locks the reward. The researcher is fixed at this point."],
                ["Finding anchored", "A hash is written with a 30-day expiry. Contents stay private."],
                ["Accepted", "One transaction pays the researcher. The reward cannot be paid twice."],
              ].map(([t, b], i) => (
                <li key={t} className="flex gap-2.5">
                  <span className="mt-0.5 grid h-4 w-4 shrink-0 place-items-center rounded-full bg-white/8 text-[9px] text-zinc-400">
                    {i + 1}
                  </span>
                  <span>
                    <span className="block text-[12px] text-zinc-300">{t}</span>
                    <span className="block text-[11px] leading-relaxed text-zinc-600">{b}</span>
                  </span>
                </li>
              ))}
            </ol>
          </div>
        </aside>
      </div>
    </AppShell>
  );
}
