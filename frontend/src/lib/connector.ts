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

/**
 * Extensions do not all reject with an `Error`. MetaMask throws a plain object
 * for JSON-RPC failures, and `String(object)` is "[object Object]" — which is
 * exactly what the UI showed. Normalise here, once, so every caller gets a
 * message it can print.
 */
function toError(e: unknown): Error {
  if (e instanceof Error) return e;
  if (e && typeof e === "object") {
    const record = e as { message?: unknown; code?: unknown; data?: { message?: unknown } };
    const message =
      typeof record.message === "string"
        ? record.message
        : typeof record.data?.message === "string"
          ? record.data.message
          : null;
    if (message) {
      const err = new Error(message);
      if (record.code !== undefined) (err as Error & { code?: unknown }).code = record.code;
      return err;
    }
    try {
      return new Error(JSON.stringify(e));
    } catch {
      return new Error("The wallet returned an error that could not be read.");
    }
  }
  return new Error(String(e));
}

async function request<T>(method: string, params?: unknown): Promise<T> {
  const p = provider();
  if (!p) throw new Error("No browser wallet found. Install MetaMask, Rabby or OKX Wallet.");
  try {
    return (await p.request({ method, params } as never)) as T;
  } catch (e) {
    throw toError(e);
  }
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
