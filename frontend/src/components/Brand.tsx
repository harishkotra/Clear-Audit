import Link from "next/link";

export function Mark({ size = 28 }: { size?: number }) {
  return (
    <span
      className="grid place-items-center rounded-[9px] border border-white/15 bg-gradient-to-br from-[#7c6bff] to-[#4a3bd0] text-white shadow-[0_6px_20px_-8px_rgba(109,94,248,0.9)]"
      style={{ width: size, height: size }}
      aria-hidden
    >
      <svg width={size * 0.58} height={size * 0.58} viewBox="0 0 24 24" fill="none">
        <path
          d="M12 2.8 4.8 5.9v6.2c0 4.4 3 8 7.2 9.2 4.2-1.2 7.2-4.8 7.2-9.2V5.9L12 2.8Z"
          stroke="white"
          strokeWidth="1.8"
          strokeLinejoin="round"
        />
        <path d="m8.9 12 2.2 2.2 4-4.2" stroke="white" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </span>
  );
}

export default function Brand({ href = "/", compact = false }: { href?: string; compact?: boolean }) {
  return (
    <Link href={href} className="group inline-flex items-center gap-2.5">
      <Mark />
      {!compact && (
        <span className="text-[15px] font-semibold tracking-[-0.02em] text-white">
          ClearAudit
        </span>
      )}
    </Link>
  );
}
