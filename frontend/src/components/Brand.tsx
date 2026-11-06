import Link from "next/link";

/**
 * Monogram, not a shield. A square with a serif letter reads like a masthead;
 * the gradient shield it replaced read like every other security SaaS mark.
 */
export function Mark({ size = 26 }: { size?: number }) {
  return (
    <span
      className="grid place-items-center border border-brand-500/60 text-brand-500"
      style={{ width: size, height: size, borderRadius: 2 }}
      aria-hidden
    >
      <span className="display" style={{ fontSize: size * 0.68, lineHeight: 1 }}>
        C
      </span>
    </span>
  );
}

export default function Brand({ href = "/", compact = false }: { href?: string; compact?: boolean }) {
  return (
    <Link href={href} className="inline-flex items-center gap-2.5">
      <Mark />
      {!compact && (
        <span className="text-[14px] font-medium tracking-[-0.005em] text-[#ece7dd]">
          ClearAudit
        </span>
      )}
    </Link>
  );
}
