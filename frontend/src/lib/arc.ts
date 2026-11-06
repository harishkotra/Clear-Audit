import { createPublicClient, defineChain, http } from "viem";
import { BOUNTY_VAULT_V2_ABI, ERC20_ABI } from "@/lib/abi";
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
  payer: `0x${string}`;
  payee: `0x${string}`;
  amount: bigint;
  status: number;
  /** Unix seconds; 0 means the payer set no deadline (open tasks must set one). */
  deadline: number;
  /** Unix seconds when an agent claimed an open task; 0 when unclaimed or fixed-payee. */
  claimedAt: number;
  /** True when the deal was opened to any agent rather than naming one payee. */
  agentMode: boolean;
  assigned: boolean;
  criteriaHash: `0x${string}`;
  /** True when many addresses may enter and the arbitrator awards shares. */
  contestMode: boolean;
};

/** The chain is the only source of truth for who may be paid. */
export async function readDeal(id: bigint | string): Promise<Deal> {
  const [[payer, payee, amount, status], row] = await Promise.all([
    arcClient.readContract({
      address: VAULT_ADDRESS,
      abi: BOUNTY_VAULT_V2_ABI,
      functionName: "getDeal",
      args: [BigInt(id)],
    }) as Promise<readonly [`0x${string}`, `0x${string}`, bigint, number]>,
    arcClient.readContract({
      address: VAULT_ADDRESS,
      abi: BOUNTY_VAULT_V2_ABI,
      functionName: "deals",
      args: [BigInt(id)],
    }) as Promise<
      readonly [
        `0x${string}`,
        `0x${string}`,
        `0x${string}`,
        bigint,
        bigint,
        bigint,
        number,
        boolean,
        boolean,
        `0x${string}`,
        `0x${string}`,
        boolean,
      ]
    >,
  ]);

  return {
    id: String(id),
    payer,
    payee,
    amount,
    status,
    deadline: Number(row[4]),
    claimedAt: Number(row[5]),
    agentMode: row[7],
    assigned: row[8],
    criteriaHash: row[10],
    contestMode: Boolean(row[11]),
  };
}

export async function readVaultFeatures(): Promise<{
  evidenceGate: boolean;
  challengeWindow: number;
}> {
  try {
    const window = (await arcClient.readContract({
      address: VAULT_ADDRESS,
      abi: BOUNTY_VAULT_V2_ABI,
      functionName: "challengeWindow",
    })) as bigint;
    return { evidenceGate: true, challengeWindow: Number(window) };
  } catch {
    return { evidenceGate: false, challengeWindow: 0 };
  }
}

export async function readEvidence(id: bigint | string): Promise<{
  hash: `0x${string}`;
  expiresAt: number;
  challengeUntil: number;
} | null> {
  try {
    const [hash, expiresAt, until] = (await arcClient.readContract({
      address: VAULT_ADDRESS,
      abi: BOUNTY_VAULT_V2_ABI,
      functionName: "getEvidence",
      args: [BigInt(id)],
    })) as readonly [`0x${string}`, bigint, bigint];
    return { hash, expiresAt: Number(expiresAt), challengeUntil: Number(until) };
  } catch {
    return null;
  }
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
