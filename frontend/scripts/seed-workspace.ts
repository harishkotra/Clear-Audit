/**
 * Fund the mentor workspace: five real Arc deals (recovery, disclosure,
 * retainer, agent dispatch, contest). No private keys are logged.
 *
 *   cd frontend && npx tsx scripts/seed-workspace.ts
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  createPublicClient,
  createWalletClient,
  decodeEventLog,
  defineChain,
  getAddress,
  http,
  keccak256,
  parseUnits,
  toBytes,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { createReport } from "../src/lib/arkiv";
import { WORKSPACE, workspaceCriteriaHash } from "../src/lib/workspace";

function loadEnv() {
  const text = readFileSync(resolve(process.cwd(), ".env.local"), "utf8");
  for (const line of text.split("\n")) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const i = t.indexOf("=");
    if (i < 1) continue;
    const k = t.slice(0, i);
    let v = t.slice(i + 1);
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
      v = v.slice(1, -1);
    }
    if (!process.env[k]) process.env[k] = v;
  }
}

loadEnv();

const VAULT = getAddress(process.env.NEXT_PUBLIC_VAULT_ADDRESS!);
const USDC = getAddress(process.env.NEXT_PUBLIC_USDC_ADDRESS ?? "0x3600000000000000000000000000000000000000");
const RPC = process.env.NEXT_PUBLIC_ARC_RPC_URL ?? "https://rpc.testnet.arc.io";
const BEEF = getAddress("0xBEEF00000000000000000000000000000000BEEf");
const CAFE = getAddress("0xcafe00000000000000000000000000000000cAFE");

const vaultAbi = JSON.parse(
  readFileSync(resolve(process.cwd(), "../abi/BountyVaultV2.json"), "utf8"),
).abi;

const erc20 = [
  {
    type: "function",
    name: "approve",
    stateMutability: "nonpayable",
    inputs: [
      { name: "s", type: "address" },
      { name: "a", type: "uint256" },
    ],
    outputs: [{ type: "bool" }],
  },
  {
    type: "function",
    name: "balanceOf",
    stateMutability: "view",
    inputs: [{ name: "a", type: "address" }],
    outputs: [{ type: "uint256" }],
  },
  {
    type: "function",
    name: "allowance",
    stateMutability: "view",
    inputs: [
      { name: "o", type: "address" },
      { name: "s", type: "address" },
    ],
    outputs: [{ type: "uint256" }],
  },
] as const;

const arc = defineChain({
  id: 5042002,
  name: "Arc Testnet",
  nativeCurrency: { name: "USD Coin", symbol: "USDC", decimals: 18 },
  rpcUrls: { default: { http: [RPC] } },
});

function pk(name: string) {
  const v = process.env[name] as `0x${string}` | undefined;
  if (!v || !/^0x[0-9a-fA-F]{64}$/.test(v)) throw new Error(`${name} missing`);
  return v;
}

function artefact(label: string) {
  return keccak256(toBytes(`clearaudit-workspace:${label}:2026-11-06`));
}

async function main() {
  const payer = privateKeyToAccount(pk("PROTOCOL_PRIVATE_KEY"));
  const publicClient = createPublicClient({ chain: arc, transport: http(RPC) });
  const wallet = createWalletClient({ account: payer, chain: arc, transport: http(RPC) });

  const amounts: Record<string, bigint> = {
    recovery: parseUnits("0.55", 6),
    disclosure: parseUnits("0.35", 6),
    retainer: parseUnits("0.50", 6),
    "agent-work": parseUnits("0.20", 6),
    contest: parseUnits("0.30", 6),
  };
  const needed = Object.values(amounts).reduce((a, b) => a + b, 0n);
  const bal = (await publicClient.readContract({
    address: USDC,
    abi: erc20,
    functionName: "balanceOf",
    args: [payer.address],
  })) as bigint;
  if (bal < needed) {
    throw new Error(`payer has ${bal} USDC-6, need ${needed}`);
  }

  const allowance = (await publicClient.readContract({
    address: USDC,
    abi: erc20,
    functionName: "allowance",
    args: [payer.address, VAULT],
  })) as bigint;
  if (allowance < needed) {
    const hash = await wallet.writeContract({
      address: USDC,
      abi: erc20,
      functionName: "approve",
      args: [VAULT, needed],
    });
    await publicClient.waitForTransactionReceipt({ hash });
    console.log("approved", hash);
  }

  const deadline = BigInt(Math.floor(Date.now() / 1000) + 7 * 86400);
  const seeded: { useCase: string; dealId: string; createTx: string; amount: string }[] = [];

  async function sendCreate(fn: string, args: readonly unknown[]) {
    const hash = await wallet.writeContract({
      address: VAULT,
      abi: vaultAbi,
      functionName: fn,
      args,
    } as never);
    const receipt = await publicClient.waitForTransactionReceipt({ hash });
    if (receipt.status !== "success") throw new Error(`${fn} reverted ${hash}`);
    let dealId: bigint | undefined;
    for (const log of receipt.logs) {
      try {
        const decoded = decodeEventLog({
          abi: vaultAbi,
          eventName: "BountyCreated",
          data: log.data,
          topics: log.topics,
        });
        dealId = (decoded.args as { id: bigint }).id;
        break;
      } catch {
        /* skip */
      }
    }
    if (dealId === undefined) throw new Error(`no BountyCreated in ${hash}`);
    return { hash, dealId };
  }

  for (const row of WORKSPACE) {
    const amount = amounts[row.useCase];
    const crit = workspaceCriteriaHash(row.criteria);
    const created =
      row.kind === "named"
        ? await sendCreate("createBounty", [BEEF, amount, deadline, crit])
        : row.kind === "open"
          ? await sendCreate("createOpenTask", [amount, deadline, crit])
          : await sendCreate("createContest", [amount, deadline, crit]);
    console.log(row.useCase, "deal", created.dealId.toString(), created.hash);
    seeded.push({
      useCase: row.useCase,
      dealId: created.dealId.toString(),
      createTx: created.hash,
      amount: amount.toString(),
    });

    if (row.kind === "contest") {
      for (const who of [BEEF, CAFE]) {
        const hash = await wallet.writeContract({
          address: VAULT,
          abi: vaultAbi,
          functionName: "registerEntrant",
          args: [created.dealId, who],
        } as never);
        await publicClient.waitForTransactionReceipt({ hash });
        console.log("  registered", who, hash);
      }
    }

    const hash = artefact(row.useCase);
    const expiresAt = BigInt(Math.floor(Date.now() / 1000) + 30 * 86400);

    if (row.kind === "named") {
      const report = await createReport({
        chainId: 5042002,
        dealId: created.dealId,
        protocolWallet: payer.address,
        whitehatWallet: BEEF,
        amount,
        encryptedPayloadHash: hash,
        severity: row.useCase === "recovery" ? "critical" : "high",
        criteriaHash: crit,
      });
      console.log("  arkiv", (report as { entityKey?: string }).entityKey ?? report, (report as { txHash?: string }).txHash);
    }

    if (row.kind !== "open") {
      const commit = await wallet.writeContract({
        address: VAULT,
        abi: vaultAbi,
        functionName: "commitEvidence",
        args: [created.dealId, hash, expiresAt],
      } as never);
      await publicClient.waitForTransactionReceipt({ hash: commit });
      console.log("  commit", commit);
    }
  }

  const contest = seeded.find((s) => s.useCase === "contest");
  if (contest) {
    const arb = privateKeyToAccount(pk("ARKIV_PRIVATE_KEY"));
    const arbWallet = createWalletClient({ account: arb, chain: arc, transport: http(RPC) });
    const winners = [BEEF, CAFE];
    const shares = [parseUnits("0.20", 6), parseUnits("0.10", 6)];
    const hash = await arbWallet.writeContract({
      address: VAULT,
      abi: vaultAbi,
      functionName: "award",
      args: [BigInt(contest.dealId), winners, shares],
    } as never);
    const receipt = await publicClient.waitForTransactionReceipt({ hash });
    if (receipt.status !== "success") throw new Error(`award reverted ${hash}`);
    console.log("contest awarded", hash);
  }

  console.log(JSON.stringify(seeded, null, 2));
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
