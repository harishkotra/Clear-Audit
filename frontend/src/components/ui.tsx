import type { ReactNode } from "react";
import { STATUS_COPY } from "@/lib/format";
import { ARC_EXPLORER } from "@/lib/constants";

export function Stat({
  label,
  value,
  unit,
  hint,
  accent = false,
}: {
  label: string;
  value: ReactNode;
  unit?: string;
  hint?: ReactNode;
  accent?: boolean;
}) {
  return (
    <div className={`card p-4 ${accent ? "border-brand-500/30 bg-brand-500/[0.05]" : ""}`}>
      <div className="text-[11px] uppercase tracking-[0.1em] text-zinc-500">{label}</div>
      <div className="mt-2 flex items-end gap-1.5">
        <span className="text-[26px] font-semibold leading-none tracking-[-0.03em] text-white">
          {value}
        </span>
        {unit && <span className="pb-0.5 text-[12px] text-zinc-500">{unit}</span>}
      </div>
      {hint && <div className="mt-1.5 text-[11.5px] text-zinc-500">{hint}</div>}
    </div>
  );
}

export function StatusPill({ status }: { status: number }) {
  const s = STATUS_COPY[status] ?? { label: "Unknown", tone: "closed" as const };
  const tones: Record<string, string> = {
    open: "border-sky-400/25 bg-sky-400/10 text-sky-300",
    review: "border-amber-400/25 bg-amber-400/10 text-amber-300",
    paid: "border-emerald-400/25 bg-emerald-400/10 text-emerald-300",
    closed: "border-white/10 bg-white/5 text-zinc-400",
  };
  return (
    <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] ${tones[s.tone]}`}>
      {s.label}
    </span>
  );
}

export function Empty({
  title,
  body,
  action,
}: {
  title: string;
  body: string;
  action?: ReactNode;
}) {
  return (
    <div className="card flex flex-col items-center justify-center px-6 py-12 text-center">
      <div className="grid h-11 w-11 place-items-center rounded-xl border border-white/10 bg-white/[0.03] text-zinc-500">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
          <path d="M4 7h16M4 12h10M4 17h7" strokeLinecap="round" />
        </svg>
      </div>
      <h3 className="mt-4 text-[14.5px] font-medium text-white">{title}</h3>
      <p className="mt-1.5 max-w-sm text-[13px] leading-relaxed text-zinc-500">{body}</p>
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

export function SkeletonRows({ rows = 3 }: { rows?: number }) {
  return (
    <div className="space-y-2">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="skeleton h-12 w-full" />
      ))}
    </div>
  );
}

export function Notice({ tone, children }: { tone: "error" | "success" | "info"; children: ReactNode }) {
  const tones = {
    error: "border-red-500/25 bg-red-500/[0.06] text-red-300",
    success: "border-emerald-500/25 bg-emerald-500/[0.06] text-emerald-300",
    info: "border-white/10 bg-white/[0.03] text-zinc-300",
  };
  return (
    <div className={`rounded-xl border px-3.5 py-2.5 text-[12.5px] leading-relaxed ${tones[tone]}`}>
      {children}
    </div>
  );
}

export function ExplorerLink({
  path,
  children,
  base = ARC_EXPLORER,
}: {
  path: string;
  children: ReactNode;
  base?: string;
}) {
  return (
    <a
      href={`${base}${path}`}
      target="_blank"
      rel="noreferrer"
      className="font-mono text-[11.5px] text-zinc-500 underline decoration-white/20 underline-offset-4 transition hover:text-zinc-300"
    >
      {children}
    </a>
  );
}
