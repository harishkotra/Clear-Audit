"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { usePrivy } from "@privy-io/react-auth";
import { useEffect, useState, type ReactNode } from "react";
import Brand from "./Brand";
import ConnectButton from "./ConnectButton";
import { BoltIcon, GiftIcon, HomeIcon, PayoutIcon, SettingsIcon, ArrowUpRight } from "./icons";
import { useProfile, ROLE_LABEL } from "@/lib/profile";
import { PRIVY_ENABLED } from "@/lib/privy";

const NAV = [
  { href: "/app", label: "Overview", icon: HomeIcon },
  { href: "/app/rewards", label: "Rewards", icon: GiftIcon },
  { href: "/app/payouts", label: "Payments", icon: PayoutIcon },
  { href: "/app/gasless", label: "Gasless", icon: BoltIcon },
  { href: "/app/settings", label: "Settings", icon: SettingsIcon },
];

function AppShellInner({
  children,
  title,
  subtitle,
  actions,
}: {
  children: ReactNode;
  title: string;
  subtitle?: string;
  actions?: ReactNode;
}) {
  const pathname = usePathname();
  const { profile, clear } = useProfile();
  const { ready, authenticated, login } = usePrivy();
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  // Wallets refuse to inject into, or answer requests from, a plain-HTTP origin
  // that is not localhost. A LAN address such as http://192.168.1.5:3000 looks
  // like it should work and then fails inside the wallet with "-32603".
  const insecureOrigin =
    typeof window !== "undefined" &&
    window.location.protocol === "http:" &&
    !["localhost", "127.0.0.1", "[::1]"].includes(window.location.hostname);

  useEffect(() => setOpen(false), [pathname]);
  useEffect(() => setMounted(true), []);

  // Render nothing until the wallet state is known, so neither the gate nor the
  // page flashes for a returning user whose connector is still reconnecting.
  if (!mounted || !ready) {
    return <div className="min-h-screen bg-[#08090d]" />;
  }

  // The wallet is the identity of this app: without one there is nothing to
  // read (no payouts, no rewards, no devnet settlement) and nothing to sign.
  // Rendering the gate instead of the page is the whole rule — no per-page
  // guards to forget, and the page's own markup is never sent to a browser
  // that has no wallet connected.
  if (!authenticated) {
    return (
      <div className="min-h-screen bg-[#08090d]">
        <div className="mx-auto flex min-h-screen w-full max-w-[520px] flex-col justify-center px-6 py-16">
          <Brand />
          <h1 className="mt-10 text-[26px] font-semibold tracking-[-0.02em] text-white">
            Connect a wallet to continue
          </h1>
          <p className="mt-2 text-[13.5px] leading-relaxed text-zinc-500">
            Every screen behind this point is a wallet view: the payouts you can
            settle, the rewards you can release, and the devnet settlement you can
            trigger. Signing in creates a Privy session — no email is required, and
            nothing about your deals is stored on our side.
          </p>
          {insecureOrigin && (
            <div className="mt-5 rounded-xl border border-amber-400/25 bg-amber-400/[0.06] px-3.5 py-2.5 text-[11.5px] leading-relaxed text-amber-300">
              This page is served over plain HTTP from{" "}
              <span className="font-mono">{typeof window !== "undefined" ? window.location.host : ""}</span>
              . Wallets reject requests from non-secure origins, which surfaces as{" "}
              <span className="font-mono">-32603 An internal error has occurred</span>. Open{" "}
              <span className="font-mono">http://localhost:3000</span> instead.
            </div>
          )}
          <div className="mt-6">
            <button className="btn btn-primary w-full" onClick={() => login()} disabled={!ready}>
              {ready ? "Connect wallet" : "Loading…"}
            </button>
          </div>
          <div className="mt-6 rounded-xl border border-white/8 bg-white/[0.03] p-3.5 text-[11.5px] leading-relaxed text-zinc-500">
            <span className="font-medium text-zinc-300">Which network?</span> The app runs on{" "}
            <span className="text-zinc-300">Arc Testnet</span> (chain 5042002) for real settlement, and
            reads a separate <span className="text-zinc-300">EIP-8141 devnet</span> (chain 1337) for the
            research artifact on the gasless page. Connecting switches nothing until you ask it to.
          </div>
          <div className="mt-8 flex items-center gap-4 text-[12px]">
            <Link href="/" className="text-zinc-600 hover:text-zinc-400">
              ← Back to the site
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const nav = (
    <nav className="flex flex-col gap-1">
      {NAV.map(({ href, label, icon: Icon }) => (
        <Link
          key={href}
          href={href}
          className="nav-link"
          data-active={href === "/app" ? pathname === href : pathname.startsWith(href)}
        >
          <Icon className="opacity-80" />
          {label}
        </Link>
      ))}
    </nav>
  );

  return (
    <div className="min-h-screen bg-[#08090d]">
      {/* Mobile bar */}
      <div className="sticky top-0 z-30 flex items-center justify-between border-b border-white/8 bg-[#08090d]/90 px-4 py-3 backdrop-blur lg:hidden">
        <Brand href="/app" />
        <button className="btn btn-ghost h-9 px-3" onClick={() => setOpen(!open)} aria-expanded={open}>
          {open ? "Close" : "Menu"}
        </button>
      </div>

      <div className="mx-auto flex w-full max-w-[1320px]">
        <aside
          className={`${
            open ? "block" : "hidden"
          } fixed inset-x-0 top-[57px] z-20 border-b border-white/8 bg-[#0b0d13] p-4 lg:sticky lg:top-0 lg:block lg:h-screen lg:w-[248px] lg:shrink-0 lg:border-b-0 lg:border-r lg:bg-transparent lg:p-5`}
        >
          <div className="hidden lg:block">
            <Brand />
          </div>

          <div className="mt-0 lg:mt-7">
            <Link
              href="/app/settings"
              className="flex items-center gap-2.5 rounded-xl border border-white/8 bg-white/[0.03] p-2.5 transition hover:bg-white/[0.05]"
            >
              <span className="grid h-8 w-8 place-items-center rounded-lg bg-white/8 text-xs font-semibold text-white">
                {(profile?.name ?? "W").slice(0, 1).toUpperCase()}
              </span>
              <span className="min-w-0">
                <span className="block truncate text-[13px] font-medium text-white">
                  {profile?.name ?? "Your workspace"}
                </span>
                <span className="block text-[11px] text-zinc-500">
                  {profile ? ROLE_LABEL[profile.role] : "Set up profile"}
                </span>
              </span>
            </Link>
          </div>

          <div className="mt-5">{nav}</div>

          <div className="mt-6 border-t border-white/8 pt-4">
            <a
              href="https://explorer.testnet.arc.io"
              target="_blank"
              rel="noreferrer"
              className="nav-link text-[13px]"
            >
              Arc explorer
              <ArrowUpRight className="ml-auto h-3.5 w-3.5 opacity-60" />
            </a>
            <div className="mt-2 flex items-center gap-2 px-2.5 py-1.5 text-[11px] text-zinc-600">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400/80" />
              Arc Testnet
            </div>
          </div>

          <div className="mt-4 flex flex-col gap-2">
            <ConnectButton full />
            {profile && (
              <button
                onClick={() => {
                  clear();
                  window.location.href = "/";
                }}
                className="text-left text-[11px] text-zinc-600 hover:text-zinc-400"
              >
                Sign out
              </button>
            )}
          </div>
        </aside>

        <main className="min-w-0 flex-1 px-4 pb-16 pt-6 sm:px-6 lg:px-10 lg:pt-9">
          <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h1 className="text-[22px] font-semibold tracking-[-0.02em] text-white">{title}</h1>
              {subtitle && <p className="mt-1 max-w-2xl text-sm text-zinc-500">{subtitle}</p>}
            </div>
            {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
          </header>
          <div className="mt-7">{children}</div>
        </main>
      </div>
    </div>
  );
}

/**
 * Privy mounts the wallet layer, so without an app id there is no `usePrivy`
 * to call. Branch on the flag rather than mounting a half-initialised provider:
 * `/app` says what is missing and the rest of the site keeps working.
 */
export default function AppShell(props: {
  children: ReactNode;
  title: string;
  subtitle?: string;
  actions?: ReactNode;
}) {
  if (!PRIVY_ENABLED) {
    return (
      <div className="min-h-screen bg-[#08090d]">
        <div className="mx-auto flex min-h-screen w-full max-w-[520px] flex-col justify-center px-6 py-16">
          <Brand />
          <h1 className="mt-10 text-[24px] font-semibold tracking-[-0.02em] text-white">
            Wallet layer not configured
          </h1>
          <p className="mt-2 text-[13.5px] leading-relaxed text-zinc-500">
            Set <span className="font-mono text-zinc-300">NEXT_PUBLIC_PRIVY_APP_ID</span> in{" "}
            <span className="font-mono text-zinc-300">frontend/.env.local</span> and rebuild. The id is
            public — it is the app id from the Privy dashboard, not the app secret.
          </p>
        </div>
      </div>
    );
  }
  return <AppShellInner {...props} />;
}
