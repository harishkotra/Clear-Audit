"use client";

import { useState } from "react";
import { useProfile, type Role } from "@/lib/profile";
import { USE_CASES, FIT_LABEL, type UseCaseId } from "@/lib/usecases";
import { ActionButton, Notice } from "./ui";

const STEPS = ["Situation", "Side", "Profile"] as const;

/**
 * Onboarding asks what the person is settling before it asks who they are.
 * Three short steps with panel swaps so advancing feels like progress, not a
 * long form dump.
 */
export default function Onboarding() {
  const { save } = useProfile();
  const [step, setStep] = useState(0);
  const [useCase, setUseCase] = useState<UseCaseId>("disclosure");
  const [role, setRole] = useState<Role>("company");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const selected = USE_CASES.find((u) => u.id === useCase) ?? USE_CASES[0];
  const placeholder = role === "company" ? "Acme Security" : "alex.eth";

  function goNext() {
    setError(null);
    setStep((s) => Math.min(s + 1, STEPS.length - 1));
  }

  function goBack() {
    setError(null);
    setStep((s) => Math.max(s - 1, 0));
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (name.trim().length < 2) {
      setError("Tell us what to call you: at least 2 characters.");
      return;
    }
    setError(null);
    setSaving(true);
    // Tiny beat so the busy state is readable before the workspace mounts.
    window.setTimeout(() => {
      save({
        name: name.trim(),
        email: email.trim(),
        role,
        useCase,
        createdAt: new Date().toISOString(),
      });
    }, 280);
  }

  return (
    <div className="mx-auto max-w-4xl">
      <div className="rise">
        <span className="chip">Set up your workspace</span>
        <h2 className="mt-4 text-[26px] font-semibold tracking-[-0.03em] text-white">
          {step === 0 && "What are you settling?"}
          {step === 1 && "Which side are you on?"}
          {step === 2 && "What should we call you?"}
        </h2>
        <p className="mt-2 max-w-2xl text-[13.5px] leading-relaxed text-zinc-500">
          {step === 0 &&
            "ClearAudit is one rail: escrowed funds that clear only against a live, expiring evidence record. Pick the situation closest to yours."}
          {step === 1 &&
            "Sides are labels, not privileges. The vocabulary follows the situation you just chose."}
          {step === 2 &&
            "Your profile stays in this browser. The wallet is the account; you can change the situation any time in Settings."}
        </p>

        <div className="mt-5 flex items-center gap-2" aria-label={`Step ${step + 1} of ${STEPS.length}`}>
          {STEPS.map((label, i) => (
            <div key={label} className="flex items-center gap-2">
              <span
                className="step-dot"
                data-active={i === step}
                data-done={i < step}
                title={label}
              />
              <span className={`text-[11px] ${i === step ? "text-zinc-300" : "text-zinc-600"}`}>
                {label}
              </span>
            </div>
          ))}
        </div>
      </div>

      <form onSubmit={submit} className="mt-7 space-y-5">
        {step === 0 && (
          <div key="step-0" className="panel-swap grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {USE_CASES.map((u) => {
              const active = useCase === u.id;
              return (
                <button
                  type="button"
                  key={u.id}
                  onClick={() => setUseCase(u.id)}
                  aria-pressed={active}
                  className={`card p-4 text-left transition-[border-color,background] duration-[160ms] ease ${
                    active ? "border-brand-500/50 bg-brand-500/[0.07]" : "hover:border-white/20"
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <span className="text-[13.5px] font-medium leading-snug text-white">{u.title}</span>
                    <span
                      className={`mt-0.5 grid h-4.5 w-4.5 shrink-0 place-items-center rounded-full border text-[10px] transition-[background,border-color,color] duration-[160ms] ${
                        active
                          ? "border-brand-400 bg-brand-500 text-white"
                          : "border-white/20 text-transparent"
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
        )}

        {step === 1 && (
          <div key="step-1" className="panel-swap card p-4">
            <div className="grid gap-2 sm:grid-cols-2">
              {(["company", "researcher"] as Role[]).map((r) => (
                <button
                  type="button"
                  key={r}
                  onClick={() => setRole(r)}
                  aria-pressed={role === r}
                  className={`rounded-lg border px-3.5 py-3 text-left transition-[border-color,background] duration-[160ms] ease ${
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
              The <span className="text-zinc-400">{selected.nouns.payer}</span> funds and releases, the{" "}
              <span className="text-zinc-400">{selected.nouns.payee}</span> delivers and gets paid. One
              wallet can hold both roles across different {selected.nouns.deal}s.
            </p>
          </div>
        )}

        {step === 2 && (
          <div key="step-2" className="panel-swap card p-4">
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
                  autoFocus
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
            <p className="mt-3 text-[12px] text-zinc-500">
              <span className="text-emerald-300">Wallet connected.</span> Settling as{" "}
              <span className="text-zinc-300">{selected.label}</span> ·{" "}
              <span className="text-zinc-300">{selected.sides[role].title}</span>.
            </p>
          </div>
        )}

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="text-[12px] text-zinc-600">
            Step {step + 1} of {STEPS.length}
          </div>
          <div className="flex flex-wrap gap-2">
            {step > 0 && (
              <button type="button" className="btn btn-ghost" onClick={goBack} disabled={saving}>
                Back
              </button>
            )}
            {step < STEPS.length - 1 ? (
              <button type="button" className="btn btn-primary" onClick={goNext}>
                Continue
              </button>
            ) : (
              <ActionButton type="submit" busy={saving} busyLabel="Creating workspace…">
                Create workspace
              </ActionButton>
            )}
          </div>
        </div>

        {error && <Notice tone="error">{error}</Notice>}
      </form>
    </div>
  );
}
