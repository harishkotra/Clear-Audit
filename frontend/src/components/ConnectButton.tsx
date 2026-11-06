"use client";

import { useState } from "react";
import { usePrivy } from "@privy-io/react-auth";
import { useAccount, useSwitchChain } from "wagmi";
import { ARC_CHAIN_ID } from "@/lib/constants";
import { shortAddress } from "@/lib/format";
import { PRIVY_ENABLED } from "@/lib/privy";

/**
 * One button, everywhere.
 *
 * Privy owns the login: it renders its own modal with every wallet the visitor
 * actually has (extension, mobile, or an embedded wallet created on sign-up),
 * and one session covers all of them. We therefore render *no* wallet picker of
 * our own — no connector list, no per-extension handshake, none of the
 * `-32603` / `[object Object]` failure modes that came with it.
 */

function describe(e: unknown): string {
  if (e instanceof Error) return e.message;
  if (e && typeof e === "object") {
    const record = e as { message?: unknown };
    if (typeof record.message === "string") return record.message;
  }
  return String(e);
}

function ConnectButtonInner({ full = false }: { full?: boolean }) {
  const { ready, authenticated, login, logout, user } = usePrivy();
  const { address, chainId } = useAccount();
  const { switchChainAsync, isPending: switching } = useSwitchChain();
  const [failure, setFailure] = useState<string | null>(null);

  const cls = full ? "btn btn-primary w-full" : "btn btn-primary";
  // Privy reports the authenticated account even before wagmi catches up, so
  // fall back to it rather than flashing "Connect wallet" on reload.
  const walletAddress =
    address ?? (user?.wallet?.address as `0x${string}` | undefined);

  if (walletAddress && chainId !== undefined && chainId !== ARC_CHAIN_ID) {
    return (
      <div className={full ? "w-full" : "flex flex-col items-end gap-1"}>
        <button
          className={cls}
          disabled={switching}
          onClick={async () => {
            setFailure(null);
            try {
              await switchChainAsync({ chainId: ARC_CHAIN_ID });
            } catch (e: unknown) {
              setFailure(describe(e).split("\n")[0].slice(0, 120));
            }
          }}
        >
          {switching ? "Switching…" : "Switch to Arc"}
        </button>
        {failure && (
          <span className={`${full ? "" : "text-right"} text-[10.5px] leading-snug text-red-400/90`}>
            {failure}
          </span>
        )}
      </div>
    );
  }

  if (authenticated && walletAddress) {
    return (
      <button
        onClick={() => {
          // Clears the Privy session too, so the embedded wallet is detached
          // rather than left active behind a disconnected-looking header.
          void logout();
        }}
        title={`${walletAddress} — click to sign out`}
        className={`${full ? "btn btn-ghost w-full" : "btn btn-ghost"} font-mono text-xs`}
      >
        {shortAddress(walletAddress)}
      </button>
    );
  }

  return (
    <div className={full ? "w-full" : "flex flex-col items-end gap-1"}>
      <button className={cls} onClick={() => login()} disabled={!ready}>
        {ready ? "Connect wallet" : "Loading…"}
      </button>
      {failure && (
        <span className={`${full ? "" : "text-right"} text-[10.5px] leading-snug text-red-400/90`}>
          {failure}
        </span>
      )}
    </div>
  );
}

export default function ConnectButton({ full = false }: { full?: boolean }) {
  if (!PRIVY_ENABLED) {
    return (
      <button className={full ? "btn btn-primary w-full" : "btn btn-primary"} disabled>
        Wallet not configured
      </button>
    );
  }
  return <ConnectButtonInner full={full} />;
}
