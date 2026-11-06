import { createPublicClient, defineChain, http } from "viem";
import { BOUNTY_VAULT_ABI, DEAL_STATUS, DEAL_STATUS_LABEL } from "@/lib/abi";
import {
  ALT_MEMPOOL_READ_RPC,
  ARC_CHAIN_ID,
  DEVNET_CHAIN_ID,
  DEVNET_PAYMASTER_ADDRESS,
  DEVNET_VAULT_ADDRESS,
} from "@/lib/constants";

/**
 * EF alt-mempool reference devnet (chain 1337).
 *
 * This is the EIP-8141 research path used for the sponsored-settlement demo.
 * It is a separate chain from Arc and must never be presented as Arc state.
 */
export const devnet = defineChain({
  id: DEVNET_CHAIN_ID,
  name: "EF alt-mempool devnet",
  nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
  rpcUrls: { default: { http: [ALT_MEMPOOL_READ_RPC] } },
  testnet: true,
});

export const devnetClient = createPublicClient({
  chain: devnet,
  transport: http(ALT_MEMPOOL_READ_RPC, { timeout: 20_000 }),
});

export type DevnetDeal = {
  id: string;
  protocol: `0x${string}`;
  whitehat: `0x${string}`;
  amount: bigint;
  status: number;
};

export async function readDevnetDeal(id: bigint | string): Promise<DevnetDeal> {
  const [protocol, whitehat, amount, status] = (await devnetClient.readContract({
    address: DEVNET_VAULT_ADDRESS,
    abi: BOUNTY_VAULT_ABI,
    functionName: "getDeal",
    args: [BigInt(id)],
  })) as readonly [`0x${string}`, `0x${string}`, bigint, number];

  return { id: String(id), protocol, whitehat, amount, status };
}

/** Devnet vault snapshot for the gasless demo page. Chain 1337 only. */
export async function readDevnetState() {
  const [nextDealId, chainId] = await Promise.all([
    readNextDealIdGuarded(),
    devnetClient.getChainId(),
  ]);

  const count = Number(nextDealId);
  const ids = Array.from({ length: Math.min(count, 10) }, (_, i) => BigInt(count - 1 - i));
  const deals = await Promise.all(
    ids.map(async (id) => {
      const d = await readDevnetDeal(id);
      return { ...d, statusLabel: DEAL_STATUS_LABEL[d.status] ?? "Unknown" };
    }),
  );

  const head = await readDevnetHead().catch(() => null);

  return {
    chainId,
    vault: DEVNET_VAULT_ADDRESS,
    paymaster: DEVNET_PAYMASTER_ADDRESS,
    arcChainId: ARC_CHAIN_ID,
    deals,
    openDeals: deals.filter((d) => d.status === DEAL_STATUS.Open),
    head,
  };
}


/**
 * The alt-mempool devnet is shared infrastructure and has been reset during the
 * hackathon. A reset leaves the reference vault's address empty, and viem then
 * reports a bare `returned no data ("0x")` that reads like our bug. Say what
 * actually happened instead.
 */
async function readNextDealIdGuarded(): Promise<bigint> {
  const code = await devnetClient.getCode({ address: DEVNET_VAULT_ADDRESS });
  if (!code || code === "0x") {
    throw new Error(
      `The devnet was reset: no contract at the reference vault ${DEVNET_VAULT_ADDRESS}. ` +
        "Redeploy the devnet vault and paymaster, then set " +
        "NEXT_PUBLIC_DEVNET_VAULT_ADDRESS / NEXT_PUBLIC_DEVNET_PAYMASTER_ADDRESS to the new addresses.",
    );
  }
  return devnetClient.readContract({
    address: DEVNET_VAULT_ADDRESS,
    abi: BOUNTY_VAULT_ABI,
    functionName: "nextDealId",
  }) as Promise<bigint>;
}

/**
 * The alt-mempool chain has stalled for hours at a time during the hackathon.
 * A submit against a frozen chain hangs until the receipt timeout, which looks
 * like a bug in our code. Report the chain's health instead.
 */
export async function readDevnetHead(): Promise<{ number: bigint; ageSeconds: number }> {
  const res = await fetch(ALT_MEMPOOL_READ_RPC, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: 1,
      method: "eth_getBlockByNumber",
      params: ["latest", false],
    }),
    cache: "no-store",
  });
  const json = (await res.json()) as {
    result?: { number?: string; timestamp?: string };
    error?: unknown;
  };
  if (!json.result?.number || !json.result.timestamp) {
    throw new Error("Could not read the devnet head block.");
  }
  const timestamp = Number(BigInt(json.result.timestamp));
  return {
    number: BigInt(json.result.number),
    ageSeconds: Math.max(0, Math.floor(Date.now() / 1000) - timestamp),
  };
}
