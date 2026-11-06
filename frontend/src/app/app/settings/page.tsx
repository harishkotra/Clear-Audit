"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { usePrivy } from "@privy-io/react-auth";
import { useAccount } from "wagmi";
import AppShell from "@/components/AppShell";
import ConnectButton from "@/components/ConnectButton";
import { ExplorerLink, Notice } from "@/components/ui";
import { useProfile, ROLE_LABEL, type Role } from "@/lib/profile";
import { useVault } from "@/hooks/useVault";
import { shortAddress } from "@/lib/format";

export default function SettingsPage() {
  const { profile, hydrated, save } = useProfile();
  const { address, chainId } = useAccount();
  const { logout } = usePrivy();
  const { state } = useVault();

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<Role>("researcher");
  const [saved, setSaved] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!profile) return;
    setName(profile.name);
    setEmail(profile.email);
    setRole(profile.role);
  }, [profile]);

  function onSave(e: React.FormEvent) {
    e.preventDefault();
    if (!profile) return;
    save({ ...profile, name: name.trim() || profile.name, email: email.trim(), role });
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  }

  async function copy() {
    if (!address) return;
    await navigator.clipboard.writeText(address);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  if (!hydrated) {
    return <AppShell title="Settings"><div className="skeleton h-40 w-full" /></AppShell>;
  }

  if (!profile) {
    return (
      <AppShell title="Settings" subtitle="Create a workspace to manage your profile.">
        <Link href="/app" className="btn btn-primary">Create workspace</Link>
      </AppShell>
    );
  }

  return (
    <AppShell title="Settings" subtitle="Your workspace, wallet and network.">
      <div className="grid gap-4 lg:grid-cols-[1fr_340px]">
        <form onSubmit={onSave} className="card p-5">
          <h2 className="text-[14px] font-medium text-white">Profile</h2>
          <p className="mt-1 text-[12.5px] text-zinc-500">
            Stored in this browser only. Your wallet is the account.
          </p>

          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            <div>
              <label className="label" htmlFor="sname">Display name</label>
              <input id="sname" className="field" value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div>
              <label className="label" htmlFor="semail">Email for receipts</label>
              <input
                id="semail"
                className="field"
                type="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
          </div>

          <div className="mt-4">
            <span className="label">Workspace type</span>
            <div className="grid gap-2 sm:grid-cols-2">
              {(["researcher", "company"] as Role[]).map((r) => (
                <button
                  type="button"
                  key={r}
                  onClick={() => setRole(r)}
                  className={`rounded-lg border px-3 py-2.5 text-left text-[12.5px] transition ${
                    role === r
                      ? "border-brand-500/50 bg-brand-500/[0.07] text-white"
                      : "border-white/8 text-zinc-400 hover:border-white/20"
                  }`}
                >
                  <span className="block font-medium">{ROLE_LABEL[r]}</span>
                  <span className="block text-[11px] text-zinc-500">
                    {r === "company" ? "Fund rewards and release payments" : "Submit findings and get paid"}
                  </span>
                </button>
              ))}
            </div>
          </div>

          <div className="mt-5 flex items-center gap-3">
            <button className="btn btn-primary" type="submit">Save changes</button>
            {saved && <span className="text-[12px] text-emerald-300">Saved.</span>}
          </div>
        </form>

        <div className="space-y-4">
          <div className="card p-5">
            <h2 className="text-[14px] font-medium text-white">Wallet</h2>
            {address ? (
              <>
                <div className="mt-3 rounded-lg border border-white/8 bg-black/25 p-3">
                  <div className="font-mono text-[12px] break-all text-zinc-300">{address}</div>
                  <div className="mt-2 flex items-center gap-3">
                    <button onClick={copy} className="text-[11px] text-zinc-500 hover:text-zinc-300">
                      {copied ? "Copied" : "Copy address"}
                    </button>
                    <ExplorerLink path={`/address/${address}`}>Explorer ↗</ExplorerLink>
                  </div>
                </div>
                {chainId !== 5042002 && (
                  <div className="mt-3">
                    <Notice tone="error">Wrong network. Switch to Arc Testnet to transact.</Notice>
                  </div>
                )}
                <button onClick={() => logout()} className="btn btn-ghost mt-3 w-full">
                  Disconnect
                </button>
              </>
            ) : (
              <>
                <p className="mt-2 text-[12.5px] leading-relaxed text-zinc-500">
                  Connect the wallet you want to be paid at, or the one that funds rewards.
                </p>
                <div className="mt-3"><ConnectButton full /></div>
              </>
            )}
          </div>

          <div className="card p-5">
            <h2 className="text-[14px] font-medium text-white">Network</h2>
            <dl className="mt-3 space-y-2 text-[12px]">
              <div className="flex justify-between gap-3">
                <dt className="text-zinc-500">Chain</dt>
                <dd className="text-zinc-300">Arc Testnet · 5042002</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-zinc-500">Vault</dt>
                <dd><ExplorerLink path={`/address/${state.vault}`}>{shortAddress(state.vault)}</ExplorerLink></dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-zinc-500">Asset</dt>
                <dd className="text-zinc-300">{state.token.symbol}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-zinc-500">Gas</dt>
                <dd className="text-zinc-300">Paid in USDC</dd>
              </div>
            </dl>
          </div>

          <div className="card border-red-500/15 p-5">
            <h2 className="text-[14px] font-medium text-white">Workspace</h2>
            <p className="mt-1 text-[12px] leading-relaxed text-zinc-500">
              Signing out removes the local profile. On-chain rewards stay exactly where they are.
            </p>
            <button
              onClick={() => {
                localStorage.removeItem("clearaudit.profile.v1");
                window.location.href = "/";
              }}
              className="btn btn-ghost mt-3 w-full border-red-500/20 text-red-300 hover:bg-red-500/10"
            >
              Sign out of this workspace
            </button>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
