/**
 * claim.ts — headless version of the EF alt-mempool settlement path.
 *
 * The in-app demo lives at /app/gasless and calls POST /api/claim. This script
 * is the same flow without a browser, useful for reproducing the sponsored
 * release from a terminal:
 *
 *   DEAL_ID=1 PROTOCOL_PRIVATE_KEY=0x... npx tsx scripts/claim.ts
 *
 * The transaction is an EIP-8141 frame transaction submitted straight to the
 * Alternative Mempool: VERIFY (sponsorship scope) → VERIFY/PAYMENT (sponsor)
 * → SENDER (vault release). No EntryPoint, no bundler deposit.
 *
 * NOTE: the Arkiv evidence guard is enforced by the app's /api/claim route.
 * This script is the transport-level reproduction and does not read Arkiv, so
 * only run it for a devnet deal whose evidence you have already anchored.
 */
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createPublicClient, defineChain, encodeFunctionData, http, type Address, type Hex } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { getProfile } from "@forshtat/hegota-support/profiles";
import * as txLib from "@forshtat/hegota-support/tx";
import { toWire } from "@forshtat/hegota-support/rpc";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const deployments = JSON.parse(readFileSync(resolve(root, "deployments.json"), "utf8"));
const devnet = deployments.chains.efAltMempool;

const ALT_MEMPOOL_RPC = process.env.ALT_MEMPOOL_RPC ?? devnet.rpc;
const READ_RPC = process.env.ALT_MEMPOOL_READ_RPC ?? devnet.readRpc;
const VAULT = devnet.contracts.BountyVault as Address;
const PAYMASTER = devnet.contracts.SponsorPaymaster as Address;

const pk = process.env.PROTOCOL_PRIVATE_KEY as Hex | undefined;
if (!pk || !/^0x[0-9a-fA-F]{64}$/.test(pk)) {
  console.error("PROTOCOL_PRIVATE_KEY is required (0x-prefixed, 32 bytes).");
  process.exit(1);
}
const dealId = BigInt(process.env.DEAL_ID ?? "0");

const chain = defineChain({
  id: 1337,
  name: "EF alt-mempool devnet",
  nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
  rpcUrls: { default: { http: [READ_RPC] } },
});
const client = createPublicClient({ chain, transport: http(READ_RPC) });
const account = privateKeyToAccount(pk);

const VAULT_ABI = [
  {
    name: "getDeal",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "id", type: "uint256" }],
    outputs: [
      { name: "protocol", type: "address" },
      { name: "whitehat", type: "address" },
      { name: "amount", type: "uint256" },
      { name: "status", type: "uint8" },
    ],
  },
  {
    name: "releaseBounty",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "dealId", type: "uint256" },
      { name: "fee", type: "uint256" },
      { name: "whitehat", type: "address" },
    ],
    outputs: [],
  },
] as const;

async function rpc(url: string, method: string, params: unknown[]) {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
  });
  const json = (await res.json()) as { error?: unknown; result?: unknown };
  if (json.error) throw new Error(JSON.stringify(json.error));
  return json.result;
}

async function main() {
  const [protocol, whitehat, , status] = (await client.readContract({
    address: VAULT,
    abi: VAULT_ABI,
    functionName: "getDeal",
    args: [dealId],
  })) as readonly [Address, Address, bigint, number];

  if (whitehat === "0x0000000000000000000000000000000000000000") throw new Error("Unknown deal.");
  if (status !== 1) throw new Error(`Deal #${dealId} is not open (status ${status}).`);
  if (protocol.toLowerCase() !== account.address.toLowerCase()) {
    throw new Error(`Signer ${account.address} is not the protocol for deal #${dealId} (${protocol}).`);
  }

  const profile = getProfile("ethrex-eip8141-tracer");
  const nonce = (await rpc(READ_RPC, "eth_getTransactionCount", [account.address, "latest"])) as Hex;

  const tx = txLib.newTx({
    chainId: 1337,
    sender: account.address,
    nonceSeq: BigInt(nonce),
    frames: [
      txLib.frame(profile, "VERIFY", { scope: "EXECUTION_AND_PAYMENT", target: null, execution: 30_000n }),
      txLib.frame(profile, "VERIFY", { scope: "PAYMENT", target: PAYMASTER, execution: 50_000n }),
      txLib.frame(profile, "SENDER", {
        scope: undefined,
        target: VAULT,
        execution: 500_000n,
        state: 1_000_000n,
        data: encodeFunctionData({
          abi: VAULT_ABI,
          functionName: "releaseBounty",
          args: [dealId, 0n, whitehat],
        }),
      }),
    ],
    signatures: [txLib.secp256k1Placeholder(profile, "0x")],
    fees: { maxFeePerGas: 2_000_000_000n },
  });

  const signed = await txLib.signTx(profile, tx, pk as Hex);
  const hash = (await rpc(ALT_MEMPOOL_RPC, "eth_sendFrameTransaction", [toWire(signed)])) as Hex;
  console.log(`submitted ${hash} (deal #${dealId})`);

  for (let i = 0; i < 180; i += 1) {
    const receipt = (await rpc(READ_RPC, "eth_getTransactionReceipt", [hash])) as
      | { status: string; frameReceipts?: { status?: string; gasUsed?: string }[] }
      | null;
    if (receipt) {
      console.log(`status ${receipt.status}`);
      receipt.frameReceipts?.forEach((f, idx) =>
        console.log(`  frame ${idx}: ${f.status ?? "?"} (gas ${f.gasUsed ?? "?"})`),
      );
      return;
    }
    await new Promise((r) => setTimeout(r, 1000));
  }
  throw new Error("Timed out waiting for a receipt.");
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
