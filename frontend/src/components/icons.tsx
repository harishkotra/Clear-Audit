import type { SVGProps } from "react";

type P = SVGProps<SVGSVGElement>;

const base = {
  width: 18,
  height: 18,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.7,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
};

export const HomeIcon = (p: P) => (
  <svg {...base} {...p}>
    <path d="M3 10.5 12 3l9 7.5" />
    <path d="M5 9.5V21h14V9.5" />
  </svg>
);

export const GiftIcon = (p: P) => (
  <svg {...base} {...p}>
    <rect x="3" y="8" width="18" height="4" rx="1" />
    <path d="M5 12v9h14v-9M12 8v13" />
    <path d="M12 8S10.5 3 8 3a2.5 2.5 0 0 0 0 5M12 8s1.5-5 4-5a2.5 2.5 0 0 1 0 5" />
  </svg>
);

export const PayoutIcon = (p: P) => (
  <svg {...base} {...p}>
    <circle cx="12" cy="12" r="9" />
    <path d="M12 7v10M9.5 9.5h4a1.8 1.8 0 0 1 0 3.6h-4M9.5 13.1h4.5" />
  </svg>
);

export const SettingsIcon = (p: P) => (
  <svg {...base} {...p}>
    <path d="M4 7h10M18 7h2M4 17h4M12 17h8" />
    <circle cx="16" cy="7" r="2" />
    <circle cx="10" cy="17" r="2" />
  </svg>
);

export const ShieldIcon = (p: P) => (
  <svg {...base} {...p}>
    <path d="M12 3 5 6v6c0 4.2 2.9 7.6 7 9 4.1-1.4 7-4.8 7-9V6l-7-3Z" />
    <path d="m9 12 2 2 4-4" />
  </svg>
);

export const ArrowUpRight = (p: P) => (
  <svg {...base} {...p}>
    <path d="M7 17 17 7M9 7h8v8" />
  </svg>
);

export const LockIcon = (p: P) => (
  <svg {...base} {...p}>
    <rect x="4.5" y="10" width="15" height="10" rx="2" />
    <path d="M8 10V7a4 4 0 0 1 8 0v3" />
  </svg>
);

export const ClockIcon = (p: P) => (
  <svg {...base} {...p}>
    <circle cx="12" cy="12" r="9" />
    <path d="M12 7v5l3 2" />
  </svg>
);

export const BoltIcon = (p: P) => (
  <svg {...base} {...p}>
    <path d="M13 2 4 14h7l-1 8 9-12h-7l1-8Z" />
  </svg>
);

/** Empty deals / payments — escrow bracket with a lock hairline. */
export const VaultMark = (p: P) => (
  <svg {...base} width={22} height={22} {...p}>
    <path d="M7 5H5v14h2" />
    <path d="M17 5h2v14h-2" />
    <rect x="9" y="10" width="6" height="5" rx="1" />
    <path d="M10.5 10V8.5a1.5 1.5 0 0 1 3 0V10" />
  </svg>
);

/** Empty / missing evidence — concentric arcs as a fingerprint. */
export const FingerprintMark = (p: P) => (
  <svg {...base} width={22} height={22} {...p}>
    <path d="M12 4.5a5.5 5.5 0 0 1 5.5 5.5v2" />
    <path d="M12 4.5A5.5 5.5 0 0 0 6.5 10v4.5" />
    <path d="M12 7.5a2.5 2.5 0 0 1 2.5 2.5v5" />
    <path d="M12 7.5A2.5 2.5 0 0 0 9.5 10v3" />
    <path d="M12 14v3.5" />
    <path d="M8 16.5c.8 1.4 2.2 2.2 4 2.2s3.2-.8 4-2.2" />
  </svg>
);

/** Success notice — check across a settlement rule. */
export const SettleMark = (p: P) => (
  <svg {...base} width={18} height={18} {...p}>
    <path d="M4 12h16" />
    <path d="m8.5 12 2.2 2.2L15.5 9" />
  </svg>
);
