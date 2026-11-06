import { encodeFunctionData, type Hex, type Address } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { getProfile } from "@forshtat/hegota-support/profiles";
import * as txLib from "@forshtat/hegota-support/tx";
import { toWire } from "@forshtat/hegota-support/rpc";

const ESCROW_ABI = [
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

const profile = getProfile("ethrex-eip8141-tracer");

async function rpc(url: string, method: string, params: any[]) {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
  });
  const j = await res.json();
  if (j.error) throw new Error(JSON.stringify(j.error));
  return j.result;
}

function frame(mode: "VERIFY" | "SENDER", scope: string | undefined, target: Address | null, execution: bigint, opts: { data?: Hex; state?: bigint } = {}) {
  return txLib.frame(profile, mode, { scope, target, execution, state: opts.state, data: opts.data });
}

export async function submitClaim(params: {
  dealId: bigint;
  protocolPrivateKey: Hex;
  protocolAddress: Address;
  whitehatAddress: Address;
  paymasterAddress: Address;
  escrowAddress: Address;
  readRpc: string;
  altMempoolRpc: string;
}): Promise<{ txHash: Hex; receipt: any }> {
  const account = privateKeyToAccount(params.protocolPrivateKey);

  const nonce = await rpc(params.readRpc, "eth_getTransactionCount", [params.protocolAddress, "latest"]);

  const releaseBountyCallData = encodeFunctionData({
    abi: ESCROW_ABI as any,
    functionName: "releaseBounty",
    args: [params.dealId, 0n, params.whitehatAddress],
  });

  const tx = txLib.newTx({
    chainId: 1337,
    sender: params.protocolAddress,
    nonceSeq: BigInt(nonce),
    frames: [
      frame("VERIFY", "EXECUTION_AND_PAYMENT", null, 30_000n),
      frame("VERIFY", "PAYMENT", params.paymasterAddress, 50_000n),
      frame("SENDER", undefined, params.escrowAddress, 500_000n, {
        data: releaseBountyCallData,
        state: 1_000_000n,
      }),
    ],
    signatures: [txLib.secp256k1Placeholder(profile, "0x")],
    fees: { maxFeePerGas: 2_000_000_000n },
  });

  const signed = await txLib.signTx(profile, tx, params.protocolPrivateKey);
  const submitted = await rpc(params.altMempoolRpc, "eth_sendFrameTransaction", [toWire(signed)]);

  let receipt: any = null;
  for (let i = 0; i < 120; i++) {
    receipt = await rpc(params.readRpc, "eth_getTransactionReceipt", [submitted]);
    if (receipt) break;
    await new Promise((r) => setTimeout(r, 1000));
  }
  if (!receipt) throw new Error("Timed out waiting for receipt");

  return { txHash: submitted as Hex, receipt };
}
