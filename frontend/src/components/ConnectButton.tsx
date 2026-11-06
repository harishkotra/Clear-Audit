"use client";

import { useAccount, useConnect, useDisconnect, useSwitchChain } from "wagmi";
import { ARC_CHAIN_ID } from "@/lib/constants";
import { shortAddress } from "@/lib/format";

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

  // The injected connector is the primary path (one click, in-page).
  // WalletConnect is the mobile path: it exists only when a project id is set,
  // and only in the browser (see lib/wagmi.ts).
  const injected = connectors.find((c) => c.id !== "walletConnect") ?? connectors[0];
  const walletConnectConnector = connectors.find((c) => c.id === "walletConnect");

  return (
    <div className={full ? "w-full" : "flex flex-col items-end gap-1"}>
      <button
        className={cls}
        onClick={() => injected && connect({ connector: injected })}
        disabled={isPending || !injected}
      >
        {isPending ? "Connecting…" : "Connect wallet"}
      </button>
      {walletConnectConnector && (
        <button
          className={`${full ? "btn btn-ghost w-full mt-1.5" : "btn btn-ghost text-[11px]"} py-1`}
          onClick={() => connect({ connector: walletConnectConnector })}
          disabled={isPending}
          title="Scan with a mobile wallet"
        >
          WalletConnect
        </button>
      )}
      {error && (
        <span className="mt-1 block max-w-[220px] text-[10px] leading-tight text-red-400">
          {error.message}
        </span>
      )}
    </div>
  );
}
