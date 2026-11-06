"use client";

import { useState } from "react";
import { useProfile, type Role } from "@/lib/profile";
import { USE_CASES, FIT_LABEL, type UseCaseId } from "@/lib/usecases";
import { Notice } from "./ui";

/**
 * Onboarding asks what the person is settling before it asks who they are.
 *
 * The old version offered "company" or "researcher", which quietly told every
 * visitor this is a bounty board. The situation comes first because that is the
 * actual product: a rail for a settlement between two parties who do not want to
 * hand each other their identity. Bounties are one card of six, and the card
 * says so.
 */
export default function Onboarding() {
  const { save } = useProfile();
  const [useCase, setUseCase] = useState<UseCaseId>("disclosure");
  const [role, setRole] = useState<Role>("company");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);

  const selected = USE_CASES.find((u) => u.id === useCase) ?? USE_CASES[0];
  const placeholder = role === "company" ? "Acme Security" : "alex.eth";

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (name.trim().length < 2) {
      setError("Tell us what to call you: at least 2 characters.");
      return;
    }
    setError(null);
    save({
      name: name.trim(),
      email: email.trim(),
      role,
      useCase,
      createdAt: new Date().toISOString(),
    });
  }

  return (
    <div className="mx-auto max-w-4xl">
      <div className="rise">
        <span className="chip">Set up your workspace</span>
        <h2 className="mt-4 text-[26px] font-semibold tracking-[-0.03em] text-white">
          What are you settling?
        </h2>
        <p className="mt-2 max-w-2xl text-[13.5px] leading-relaxed text-zinc-500">
          ClearAudit is one rail: escrowed funds that clear only against a live, expiring evidence
          record. Pick the situation closest to yours and the workspace will speak in its terms. You
          can change it any time in Settings.
        </p>
      </div>

      <form onSubmit={submit} className="mt-7 space-y-6">
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {USE_CASES.map((u) => {
            const active = useCase === u.id;
            return (
              <button
                type="button"
                key={u.id}
                onClick={() => setUseCase(u.id)}
                aria-pressed={active}
                className={`card p-4 text-left transition ${
                  active ? "border-brand-500/50 bg-brand-500/[0.07]" : "hover:border-white/20"
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <span className="text-[13.5px] font-medium leading-snug text-white">{u.title}</span>
                  <span
                    className={`mt-0.5 grid h-4.5 w-4.5 shrink-0 place-items-center rounded-full border text-[10px] ${
                      active ? "border-brand-400 bg-brand-500 text-white" : "border-white/20 text-transparent"
                    }`}
                  >
                    ✓
                  </span>
                </div>
                <p className="mt-2 text-[11.5px] leading-relaxed text-zinc-400">{u.promise}</p>
                <span
                  className={`mt-3 inline-block text-[10px] uppercase tracking-[0.08em] ${
                    u.fit === "today" ? "text-emerald-400/80" : "text-amber-400/80"
                  }`}
                >
                  {FIT_LABEL[u.fit]}
                </span>
              </button>
            );
          })}
        </div>

        <div className="card p-4">
          <span className="label">Which side are you on?</span>
          <div className="mt-1 grid gap-2 sm:grid-cols-2">
            {(["company", "researcher"] as Role[]).map((r) => (
              <button
                type="button"
                key={r}
                onClick={() => setRole(r)}
                aria-pressed={role === r}
                className={`rounded-lg border px-3.5 py-3 text-left transition ${
                  role === r
                    ? "border-brand-500/50 bg-brand-500/[0.07]"
                    : "border-white/8 hover:border-white/20"
                }`}
              >
                <span className="block text-[13px] font-medium text-white">{selected.sides[r].title}</span>
                <span className="mt-0.5 block text-[11.5px] leading-relaxed text-zinc-500">
                  {selected.sides[r].body}
                </span>
              </button>
            ))}
          </div>
          <p className="mt-3 text-[11.5px] leading-relaxed text-zinc-600">
            Sides are labels, not privileges: the{" "}
            <span className="text-zinc-400">{selected.nouns.payer}</span> funds and releases, the{" "}
            <span className="text-zinc-400">{selected.nouns.payee}</span> delivers and gets paid. One
            wallet can hold both roles across different {selected.nouns.deal}s.
          </p>
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
                placeholder={placeholder}
                value={name}
                onChange={(e) => setName(e.target.value)}
                autoComplete="name"
              />
            </div>
            <div>
              <label className="label" htmlFor="email">
                Email <span className="text-zinc-600">(optional, receipts only)</span>
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
              <span className="text-emerald-300">Wallet connected.</span> This profile is stored in
              this browser only. Your wallet is the account.
            </div>
            <button type="submit" className="btn btn-primary">
              Create workspace
            </button>
          </div>
        </div>

        {error && <Notice tone="error">{error}</Notice>}
      </form>
    </div>
  );
}
