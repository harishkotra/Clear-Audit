"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { PrivyProvider } from "@privy-io/react-auth";
import { WagmiProvider } from "@privy-io/wagmi";
import { WagmiProvider as PlainWagmiProvider } from "wagmi";
import { wagmiConfig, readOnlyWagmiConfig, arcTestnet } from "@/lib/wagmi";
import { PRIVY_APP_ID, PRIVY_ENABLED } from "@/lib/privy";
import { useState } from "react";

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(() => new QueryClient());

  // No app id configured: render the app without any wallet layer. The landing
  // page still works; /app says what is missing instead of crashing.
  if (!PRIVY_ENABLED) {
    return (
      <PlainWagmiProvider config={readOnlyWagmiConfig}>
        <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
      </PlainWagmiProvider>
    );
  }

  return (
    <PrivyProvider
      appId={PRIVY_APP_ID}
      config={{
        // Appearance
        appearance: {
          theme: "dark",
          accentColor: "#e4e4e7",
          showWalletLoginFirst: true,
        },
        // Sign in with a wallet first; email is the fallback for someone who
        // has no wallet at all and gets a Privy embedded one.
        loginMethods: ["wallet", "email"],
        embeddedWallets: {
          ethereum: { createOnLogin: "users-without-wallets" },
        },
        // Arc only: the vault, the paymaster and the explorer all live here.
        defaultChain: arcTestnet,
        supportedChains: [arcTestnet],
      }}
    >
      <QueryClientProvider client={queryClient}>
        <WagmiProvider config={wagmiConfig}>{children}</WagmiProvider>
      </QueryClientProvider>
    </PrivyProvider>
  );
}
