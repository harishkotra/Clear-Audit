"use client";

import { createConnector } from "wagmi";
import type { CreateConnectorFn } from "wagmi";
import type { EIP1193Provider } from "viem";

type InjectedProvider = EIP1193Provider & {
  on?: (event: string, handler: (...args: unknown[]) => void) => void;
  removeListener?: (event: string, handler: (...args: unknown[]) => void) => void;
};

declare global {
  interface Window {
    ethereum?: InjectedProvider;
  }
}

function provider(): InjectedProvider | undefined {
  return typeof window !== "undefined" ? window.ethereum : undefined;
}

async function request<T>(method: string, params?: unknown): Promise<T> {
  const p = provider();
  if (!p) throw new Error("No browser wallet found. Install MetaMask, Rabby or OKX Wallet.");
  return (await p.request({ method, params } as never)) as T;
}

/**
 * A deliberately tiny injected connector.
 *
 * wagmi's built-in `injected()` connector subscribes to provider events and
 * cleans up with `provider.removeListener`. Several wallet extensions expose
 * `window.ethereum` through a Proxy with non-configurable event methods, and
 * that cleanup throws a V8 proxy-invariant error ("'get' on proxy: property
 * 'removeListener'…") before a connection can be established.
 *
 * We only need `eth_requestAccounts` / `eth_chainId` / `eth_accounts`, so this
 * connector never touches the event emitter. Accounts and chain are re-read on
 * focus and after every write instead of being pushed.
 */
export function browserWallet(): CreateConnectorFn {
  const make = () => ({
    id: "browser-wallet",
    name: "Browser wallet",
    type: "injected" as const,

    async connect() {
      const accounts = await request<readonly `0x${string}`[]>("eth_requestAccounts");
      const chainId = Number(await request<string>("eth_chainId"));
      return { accounts, chainId };
    },

    async disconnect() {
      // Injected wallets do not support programmatic disconnect; dropping the
      // local session is the correct behaviour and the extension keeps its own.
    },

    async getAccounts() {
      return request<readonly `0x${string}`[]>("eth_accounts");
    },

    async getChainId() {
      return Number(await request<string>("eth_chainId"));
    },

    async getProvider() {
      return provider();
    },

    async isAuthorized() {
      try {
        const accounts = await request<readonly `0x${string}`[]>("eth_accounts");
        return accounts.length > 0;
      } catch {
        return false;
      }
    },

    // Inert by design: we never subscribe to the provider's emitter. These
    // exist only to satisfy the connector contract.
    onAccountsChanged() {},
    onChainChanged() {},
    onDisconnect() {},
  });

  return createConnector(make as never) as CreateConnectorFn;
}
