"use client";

import { useAccount, useConnect, useDisconnect, useSwitchChain } from "wagmi";
import { ARC_CHAIN_ID } from "@/lib/constants";
import { shortAddress } from "@/lib/format";

/**
 * One button, everywhere. No "injected or WalletConnect" choice in the UI: the
 * connector is picked from what the browser actually has. An injected wallet is
 * the fastest path; a phone browser without one falls back to WalletConnect, and
 * WalletConnect is only configured when a project id exists (see lib/wagmi.ts).
 */
function pickConnector(connectors: ReturnType<typeof useConnect>["connectors"]) {
  const injected = connectors.filter((c) => c.id !== "walletConnect");
  const hasInjectedProvider = typeof window !== "undefined" && Boolean((window as { ethereum?: unknown }).ethereum);
  if (hasInjectedProvider && injected.length > 0) {
    return injected.find((c) => c.id === "injected") ?? injected[0];
  }
  return connectors.find((c) => c.id === "walletConnect") ?? injected[0] ?? connectors[0];
}

export default function ConnectButton({ full = false }: { full?: boolean }) {
  const { address, isConnected, chainId } = useAccount();
  const { connect, connectors, isPending, error } = useConnect();
  const { disconnect } = useDisconnect();
  const { switchChain, isPending: switching } = useSwitchChain();

  const cls = full ? "btn btn-primary w-full" : "btn btn-primary";

  if (isConnected && chainId !== ARC_CHAIN_ID) {
    return (
      <button
        className={cls}
        onClick={() => switchChain({ chainId: ARC_CHAIN_ID })}
        disabled={switching}
      >
        {switching ? "Switching…" : "Switch to Arc"}
      </button>
    );
  }

  if (isConnected) {
    return (
      <button
        onClick={() => disconnect()}
        title={`${address} — click to disconnect`}
        className={`${full ? "btn btn-ghost w-full" : "btn btn-ghost"} font-mono text-xs`}
      >
        {shortAddress(address)}
      </button>
    );
  }

  return (
    <div className={full ? "w-full" : "flex flex-col items-end gap-1"}>
      <button
        className={cls}
        onClick={() => {
          const connector = pickConnector(connectors);
          if (connector) connect({ connector });
        }}
        disabled={isPending || connectors.length === 0}
      >
        {isPending ? "Connecting…" : "Connect wallet"}
      </button>
      {error && (
        <span className={`${full ? "" : "text-right"} text-[10.5px] leading-snug text-red-400/90`}>
          {error.message.split("\n")[0].slice(0, 110)}
        </span>
      )}
    </div>
  );
}
