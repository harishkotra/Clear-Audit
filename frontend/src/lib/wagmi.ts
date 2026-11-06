import { createConfig, http } from "wagmi";
import { walletConnect } from "wagmi/connectors";
import { browserWallet } from "./connector";
import { defineChain } from "viem";

/**
 * Arc Testnet.
 *
 * Arc is a stablecoin-native chain: USDC is the gas token. Native USDC uses
 * 18 decimals; the ERC-20 interface view of the same asset uses 6. Do not
 * assume ETH here — the previous config labelled gas as "ETH", which broke
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

const projectId = process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID;

/**
 * Reown's WalletConnect connector fetches its remote project configuration the
 * moment it is constructed. Next evaluates this module during prerendering,
 * where that fetch is rejected and the SDK prints "[Reown Config] Failed to
 * fetch remote project configuration" on every build. Build the connector only
 * in the browser: nothing on the server can use it anyway.
 */
const canWalletConnect = Boolean(projectId) && typeof window !== "undefined";

export const wagmiConfig = createConfig({
  chains: [arcTestnet],
  connectors: [
    browserWallet(),
    // WalletConnect is optional: without a project id the connector throws
    // during init, which is worse than not offering it.
    ...(canWalletConnect ? [walletConnect({ projectId: projectId as string })] : []),
  ],
  transports: {
    [arcTestnet.id]: http(),
  },
  // mipd discovers every installed extension and proxies provider objects,
  // which is the other half of the proxy-invariant crash on connect.
  multiInjectedProviderDiscovery: false,
  ssr: true,
});
