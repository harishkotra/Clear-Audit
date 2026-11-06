import { createConfig } from "@privy-io/wagmi";
import { createConfig as createPlainConfig, http } from "wagmi";
import { defineChain } from "viem";

/**
 * Arc Testnet.
 *
 * Arc is a stablecoin-native chain: USDC is the gas token. Native USDC uses
 * 18 decimals; the ERC-20 interface view of the same asset uses 6. Do not
 * assume ETH here - the previous config labelled gas as "ETH", which broke
 * the entire "gasless in stablecoins" thesis in the UI and in wallet prompts.
 */
export const arcTestnet = defineChain({
  id: 5042002,
  name: "Arc Testnet",
  nativeCurrency: { name: "USD Coin", symbol: "USDC", decimals: 18 },
  rpcUrls: {
    default: { http: ["https://rpc.testnet.arc.io"] },
  },
  blockExplorers: {
    default: { name: "Arc Explorer", url: "https://explorer.testnet.arc.io" },
  },
  testnet: true,
});

/**
 * Privy owns the connectors. `createConfig` here comes from `@privy-io/wagmi`,
 * which injects a single connector backed by whichever wallet the user signed
 * in with - extension, mobile app, or Privy's own embedded wallet. There is
 * deliberately no `connectors` array: adding one would bypass Privy's session
 * and reintroduce the per-extension handshake we just removed.
 */
export const wagmiConfig = createConfig({
  chains: [arcTestnet],
  transports: {
    [arcTestnet.id]: http(),
  },
  ssr: true,
});

/**
 * Stand-in config used when no Privy app id is set.
 *
 * Pages call `useAccount()` to decide what to render before `AppShell` gets a
 * chance to show the "not configured" notice, and those hooks throw without a
 * provider. This config has no connectors, so nothing can be connected through
 * it - it only keeps the tree renderable while the env var is missing.
 */
export const readOnlyWagmiConfig = createPlainConfig({
  chains: [arcTestnet],
  transports: {
    [arcTestnet.id]: http(),
  },
  ssr: true,
});
