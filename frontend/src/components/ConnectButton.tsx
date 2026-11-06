"use client";

import { useState } from "react";
import { useAccount, useConnect, useDisconnect, useSwitchChain } from "wagmi";
import { ARC_CHAIN_ID } from "@/lib/constants";
import { shortAddress } from "@/lib/format";

/**
 * One button, everywhere. The connector is chosen from what the browser has: an
 * extension if it injected `window.ethereum`, WalletConnect otherwise.
 *
 * Deliberately *not* a chain of fallbacks: retrying an extension's refusal over
 * WalletConnect opens a QR modal the user did not ask for, and on desktop that
 * looks like the button did nothing. One attempt, then a readable error.
 */
function pick(connectors: ReturnType<typeof useConnect>["connectors"]) {
  const injected = connectors.filter((c) => c.id !== "walletConnect");
  const walletConnectConnector = connectors.find((c) => c.id === "walletConnect");
  const hasInjectedProvider =
    typeof window !== "undefined" && Boolean((window as { ethereum?: unknown }).ethereum);
  if (hasInjectedProvider && injected.length > 0) return injected[0];
  return walletConnectConnector ?? injected[0] ?? connectors[0];
}

/**
 * Wallet error strings are terse and often untrue to the user's situation.
 * "-32603: An internal error has occurred" is a locked extension, a second
 * extension shadowing `window.ethereum`, or an origin the wallet refuses.
 */
function describe(e: unknown): string {
  if (e instanceof Error) {
    const rich = e as Error & { shortMessage?: string; details?: string; code?: unknown };
    return rich.shortMessage ?? rich.message ?? rich.details ?? "The wallet returned an empty error.";
  }
  if (e && typeof e === "object") {
    const record = e as { message?: unknown; code?: unknown };
    if (typeof record.message === "string") return record.message;
    try {
      return JSON.stringify(e);
    } catch {
      return "The wallet returned an unreadable error.";
    }
  }
  return String(e);
}

function explain(raw: string) {
  if (/internal error|-32603/i.test(raw)) {
    return "The wallet refused the request (internal error). Unlock it, close other wallet extensions, and retry — wallets only allow connections over https or localhost.";
  }
  if (/user rejected|denied|cancel/i.test(raw)) return "Connection cancelled in the wallet.";
  return raw;
}

export default function ConnectButton({ full = false }: { full?: boolean }) {
  const { address, isConnected, chainId } = useAccount();
  const { connectAsync, connectors, isPending } = useConnect();
  const { disconnect } = useDisconnect();
  const { switchChainAsync, isPending: switching } = useSwitchChain();
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);

  async function connectAny() {
    const connector = pick(connectors);
    if (!connector) {
      setFailure("No wallet is available in this browser. Install one, or set a WalletConnect project id.");
      return;
    }
    setBusy(true);
    setFailure(null);
    try {
      await connectAsync({ connector });
    } catch (e: unknown) {
      setFailure(`${connector.name}: ${explain(describe(e))}`);
    } finally {
      setBusy(false);
    }
  }

  const cls = full ? "btn btn-primary w-full" : "btn btn-primary";

  if (isConnected && chainId !== ARC_CHAIN_ID) {
    return (
      <div className={full ? "w-full" : "flex flex-col items-end gap-1"}>
        <button
          className={cls}
          onClick={async () => {
            const hexChainId = `0x${ARC_CHAIN_ID.toString(16)}`;
            try {
              await switchChainAsync({ chainId: ARC_CHAIN_ID });
            } catch {
              // 4902 / unrecognised chain: the wallet does not know Arc yet.
              try {
                await (window as { ethereum?: { request: (a: unknown) => Promise<unknown> } }).ethereum?.request({
                  method: "wallet_addEthereumChain",
                  params: [
                    {
                      chainId: hexChainId,
                      chainName: "Arc Testnet",
                      nativeCurrency: { name: "USD Coin", symbol: "USDC", decimals: 18 },
                      rpcUrls: ["https://rpc.testnet.arc.io"],
                      blockExplorerUrls: ["https://explorer.testnet.arc.io"],
                    },
                  ],
                });
                await switchChainAsync({ chainId: ARC_CHAIN_ID });
              } catch (e: unknown) {
                setFailure(explain(describe(e)));
              }
            }
          }}
          disabled={switching}
        >
          {switching ? "Switching…" : "Switch to Arc"}
        </button>
        {failure && (
          <span className={`${full ? "" : "text-right"} text-[10.5px] leading-snug text-red-400/90`}>
            {failure.split("\n")[0].slice(0, 120)}
          </span>
        )}
      </div>
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
        onClick={connectAny}
        disabled={busy || isPending || connectors.length === 0}
      >
        {busy || isPending ? "Connecting…" : "Connect wallet"}
      </button>
      {failure && (
        <span className={`${full ? "" : "text-right"} text-[10.5px] leading-snug text-red-400/90`}>
          {failure.split("\n")[0].slice(0, 120)}
        </span>
      )}
    </div>
  );
}
