import { createPublicClient, defineChain, http } from "viem";
import { BOUNTY_VAULT_ABI, ERC20_ABI } from "@/lib/abi";
import { ARC_RPC, USDC_ADDRESS, VAULT_ADDRESS } from "@/lib/constants";

export const arc = defineChain({
  id: 5042002,
  name: "Arc Testnet",
  nativeCurrency: { name: "USD Coin", symbol: "USDC", decimals: 18 },
  rpcUrls: { default: { http: [ARC_RPC] } },
  blockExplorers: { default: { name: "Arc Explorer", url: "https://explorer.testnet.arc.io" } },
  testnet: true,
});

export const arcClient = createPublicClient({ chain: arc, transport: http(ARC_RPC) });

export type Deal = {
  id: string;
  company: `0x${string}`;
  researcher: `0x${string}`;
  amount: bigint;
  status: number;
};

/** The chain is the only source of truth for who may be paid. */
export async function readDeal(id: bigint | string): Promise<Deal> {
  const [company, researcher, amount, status] = (await arcClient.readContract({
    address: VAULT_ADDRESS,
    abi: BOUNTY_VAULT_ABI,
    functionName: "getDeal",
    args: [BigInt(id)],
  })) as readonly [`0x${string}`, `0x${string}`, bigint, number];

  return { id: String(id), company, researcher, amount, status };
}

export async function readToken() {
  const [decimals, symbol] = await Promise.all([
    arcClient
      .readContract({ address: USDC_ADDRESS, abi: ERC20_ABI, functionName: "decimals" })
      .catch(() => 6) as Promise<number>,
    arcClient
      .readContract({ address: USDC_ADDRESS, abi: ERC20_ABI, functionName: "symbol" })
      .catch(() => "USDC") as Promise<string>,
  ]);
  return { decimals, symbol };
}
