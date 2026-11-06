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

  const connector = connectors[0];
  return (
    <div className={full ? "w-full" : "flex flex-col items-end gap-1"}>
      <button
        className={cls}
        onClick={() => connector && connect({ connector })}
        disabled={isPending || !connector}
      >
        {isPending ? "Connecting…" : "Connect wallet"}
      </button>
      {error && (
        <span className="mt-1 block max-w-[220px] text-[10px] leading-tight text-red-400">
          {error.message}
        </span>
      )}
    </div>
  );
}
