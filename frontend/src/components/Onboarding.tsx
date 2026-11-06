"use client";

import { useState } from "react";
import { useAccount } from "wagmi";
import { useProfile, type Role } from "@/lib/profile";
import { Notice } from "./ui";
import ConnectButton from "./ConnectButton";

const ROLES: { id: Role; title: string; body: string; points: string[] }[] = [
  {
    id: "company",
    title: "I run a security program",
    body: "Fund rewards in USDC. Pay researchers the moment a finding is accepted.",
    points: ["Unlimited programs", "Dispute protection", "No fee on the deployed vault"],
  },
  {
    id: "researcher",
    title: "I find vulnerabilities",
    body: "Discover rewards, submit findings privately, get paid without KYC.",
    points: ["No fees", "No gas token", "Reports stay encrypted"],
  },
];

export default function Onboarding() {
  const { save } = useProfile();
  const { isConnected } = useAccount();
  const [role, setRole] = useState<Role>("researcher");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (name.trim().length < 2) {
      setError("Tell us what to call you — at least 2 characters.");
      return;
    }
    setError(null);
    save({
      name: name.trim(),
      email: email.trim(),
      role,
      createdAt: new Date().toISOString(),
    });
  }

  return (
    <div className="mx-auto max-w-3xl">
      <div className="rise">
        <span className="chip">Step 1 of 2 · Create your workspace</span>
        <h2 className="mt-4 text-[26px] font-semibold tracking-[-0.03em] text-white">
          What brings you to ClearAudit?
        </h2>
        <p className="mt-2 text-[13.5px] text-zinc-500">
          This sets up your workspace. Your wallet is your account — there is no password to forget.
        </p>
      </div>

      <form onSubmit={submit} className="mt-7 space-y-6">
        <div className="grid gap-3 sm:grid-cols-2">
          {ROLES.map((r) => {
            const active = role === r.id;
            return (
              <button
                type="button"
                key={r.id}
                onClick={() => setRole(r.id)}
                aria-pressed={active}
                className={`card p-4 text-left transition ${
                  active ? "border-brand-500/50 bg-brand-500/[0.07]" : "hover:border-white/20"
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-[14.5px] font-medium text-white">{r.title}</span>
                  <span
                    className={`grid h-4.5 w-4.5 place-items-center rounded-full border text-[10px] ${
                      active ? "border-brand-400 bg-brand-500 text-white" : "border-white/20 text-transparent"
                    }`}
                  >
                    ✓
                  </span>
                </div>
                <p className="mt-1.5 text-[12.5px] leading-relaxed text-zinc-400">{r.body}</p>
                <ul className="mt-3 space-y-1">
                  {r.points.map((p) => (
                    <li key={p} className="text-[11.5px] text-zinc-500">
                      · {p}
                    </li>
                  ))}
                </ul>
              </button>
            );
          })}
        </div>

        <div className="card p-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="label" htmlFor="name">
                Display name
              </label>
              <input
                id="name"
                className="field"
                placeholder={role === "company" ? "Acme Security" : "alex.dev"}
                value={name}
                onChange={(e) => setName(e.target.value)}
                autoComplete="name"
              />
            </div>
            <div>
              <label className="label" htmlFor="email">
                Email <span className="text-zinc-600">(optional, for receipts)</span>
              </label>
              <input
                id="email"
                className="field"
                type="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="email"
              />
            </div>
          </div>

          <div className="mt-4 flex flex-col gap-3 border-t border-white/8 pt-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="text-[12px] text-zinc-500">
              {isConnected ? (
                <span className="text-emerald-300">Wallet connected · ready to create</span>
              ) : (
                "You can create the workspace first and connect a wallet when you pay or get paid."
              )}
            </div>
            <div className="flex items-center gap-2">
              {!isConnected && <ConnectButton />}
              <button type="submit" className="btn btn-primary">
                Create workspace
              </button>
            </div>
          </div>
        </div>

        {error && <Notice tone="error">{error}</Notice>}
      </form>
    </div>
  );
}
