"use client";

import Link from "next/link";
import { useMemo } from "react";
import { useAccount } from "wagmi";
import AppShell from "@/components/AppShell";
import Onboarding from "@/components/Onboarding";
import { Empty, SkeletonRows, Stat, StatusPill } from "@/components/ui";
import { useProfile, ROLE_LABEL } from "@/lib/profile";
import { useVault } from "@/hooks/useVault";
import { money, shortAddress } from "@/lib/format";

export default function WorkspaceHome() {
  const { profile, hydrated } = useProfile();
  const { address } = useAccount();
  const { state, loading } = useVault();

  const isCompany = profile?.role === "company";

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
        subtitle="Set up your workspace to start funding rewards or getting paid."
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
          ? "Fund rewards, review findings, and release payments in one place."
          : "Your rewards, findings and payments — all in one place."
      }
      actions={
        <Link href="/app/rewards" className="btn btn-primary">
          {isCompany ? "Fund a reward" : "Find rewards"}
        </Link>
      }
    >
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Stat
          label={isCompany ? "In escrow" : "Ready to claim"}
          value={money(totals.open.toString(), state.token.decimals).replace(" USDC", "")}
          unit="USDC"
          hint={`${mine.filter((d) => d.status === 1).length} open`}
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
        <Stat
          label="Workspace"
          value={ROLE_LABEL[profile.role]}
          hint={address ? shortAddress(address) : "Wallet not connected"}
        />
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-[1.4fr_1fr]">
        <div className="card p-5">
          <h2 className="text-[14px] font-medium text-white">Getting started</h2>
          <p className="mt-1 text-[12.5px] text-zinc-500">
            Four steps from an empty workspace to a paid researcher.
          </p>
          <ol className="mt-4 space-y-3">
            {[
              { done: true, title: "Create your workspace", body: "Done — your profile is stored locally." },
              {
                done: connected,
                title: "Connect a wallet",
                body: connected ? shortAddress(address) : "Use the button in the sidebar.",
              },
              {
                done: mine.length > 0,
                title: isCompany ? "Fund your first reward" : "Find a reward to work on",
                body: isCompany
                  ? "Name a researcher and lock the amount in USDC."
                  : "Live rewards appear as soon as a company funds them.",
              },
              {
                done: mine.some((d) => d.status >= 3),
                title: isCompany ? "Accept a finding and pay" : "Get paid in USDC",
                body: "One click releases the reward on-chain.",
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
            {isCompany ? "How payouts work" : "How you get paid"}
          </h2>
          <div className="mt-4 space-y-3 text-[12.5px] leading-relaxed text-zinc-400">
            <p>
              {isCompany
                ? "Funds sit in a public contract, not with us. You release a payment only when you accept a finding."
                : "You never sign a transaction to receive money. The company releases the reward and it lands in your wallet."}
            </p>
            <p>
              Every report is anchored with a hash and a 30-day expiry, so evidence is verifiable
              without being stored forever.
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
                ? "Your workspace is ready. Fund a reward to see it appear here with live on-chain state."
                : "No rewards have been funded on this vault yet. When a company posts one, it shows up here."
            }
            action={
              <Link href="/app/rewards" className="btn btn-primary">
                {isCompany ? "Fund a reward" : "Browse rewards"}
              </Link>
            }
          />
        ) : (
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Reward</th>
                  <th>Company</th>
                  <th>Researcher</th>
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
