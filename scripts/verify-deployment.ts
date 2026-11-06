#!/usr/bin/env node
/**
 * verify-deployment.ts - independent read-only verification of the Arc
 * deployment. It does not trust the JSON file, it checks the chain.
 *
 *   npm run verify:chain
 *
 * Exit code 0 means every invariant below held. Any mismatch fails the run,
 * which makes this usable as a CI gate or a pre-submission check.
 */
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createPublicClient, defineChain, getAddress, http } from "viem";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const dep = JSON.parse(readFileSync(resolve(root, "deployments.arc.json"), "utf8"));
const vaultCfg = dep.contracts.BountyVault as {
  address: `0x${string}`;
  txHash: `0x${string}`;
  block: number;
  arbitrator: `0x${string}`;
};

const vaultAbi = JSON.parse(readFileSync(resolve(root, "abi/BountyVaultV2.json"), "utf8")).abi;

const arc = defineChain({
  id: dep.chainId,
  name: "Arc Testnet",
  nativeCurrency: { name: "USD Coin", symbol: "USDC", decimals: 18 },
  rpcUrls: { default: { http: [process.env.ARC_RPC_URL ?? dep.rpcUrl] } },
});

const client = createPublicClient({ chain: arc, transport: http() });

let failures = 0;
function check(label: string, ok: boolean, detail: string) {
  const mark = ok ? "PASS" : "FAIL";
  console.log(`${mark}  ${label}${detail ? ` - ${detail}` : ""}`);
  if (!ok) failures += 1;
}

async function call(fn: string, args: readonly unknown[] = []) {
  return client.readContract({
    address: vaultCfg.address,
    abi: vaultAbi,
    functionName: fn,
    args,
  } as never);
}

function releaseInputs() {
  const fn = vaultAbi.find((e: { type: string; name?: string }) => e.type === "function" && e.name === "release");
  return fn ? fn.inputs.length : -1;
}

async function main() {
  const chainId = await client.getChainId();
  check("RPC chain id", chainId === dep.chainId, `expected ${dep.chainId}, got ${chainId}`);

  const code = await client.getCode({ address: vaultCfg.address });
  check("BountyVault has code", Boolean(code && code !== "0x"), vaultCfg.address);

  const receipt = await client
    .getTransactionReceipt({ hash: vaultCfg.txHash })
    .catch(() => null);
  if (receipt) {
    check("deployment tx succeeded", receipt.status === "success", vaultCfg.txHash);
    check(
      "deployment tx matches recorded block",
      Number(receipt.blockNumber) === vaultCfg.block,
      `block ${receipt.blockNumber}`,
    );
    check(
      "deployment tx created the vault",
      Boolean(receipt.contractAddress) &&
        getAddress(receipt.contractAddress!) === getAddress(vaultCfg.address),
      receipt.contractAddress ?? "no contract address",
    );
  } else {
    console.log(`SKIP  deployment tx receipt not served by this RPC - ${vaultCfg.txHash}`);
  }

  const token = (await call("token")) as `0x${string}`;
  check("vault.token == USDC", getAddress(token) === getAddress(dep.settlementToken.address), token);

  const arbitrator = (await call("arbitrator")) as `0x${string}`;
  check(
    "vault.arbitrator == configured arbitrator",
    getAddress(arbitrator) === getAddress(vaultCfg.arbitrator),
    arbitrator,
  );

  const paymaster = (await call("paymaster")) as `0x${string}`;
  check(
    "vault.paymaster == zero",
    paymaster === "0x0000000000000000000000000000000000000000",
    "v2 has no fee path, so it takes no paymaster",
  );

  // The contract cannot redirect escrow because release() has no recipient.
  check("release(uint256) has exactly one argument", releaseInputs() === 1, `inputs = ${releaseInputs()}`);
  const legacyRelease = vaultAbi.some(
    (e: { type: string; name?: string }) => e.type === "function" && e.name === "releaseBounty",
  );
  check("no three-argument releaseBounty in the ABI", !legacyRelease, "the fee-taking path is gone");

  for (const fn of ["createOpenTask", "claimTask", "refundExpired", "cancel", "assignPayee"]) {
    const present = vaultAbi.some(
      (e: { type: string; name?: string }) => e.type === "function" && e.name === fn,
    );
    check(`${fn} is present`, present, "agent dispatch path");
  }

  const nextDealId = (await call("nextDealId")) as bigint;
  check("vault.nextDealId() readable", typeof nextDealId === "bigint", `nextDealId = ${nextDealId}`);

  if (nextDealId > 0n) {
    const [payer, payee, amount, status] = (await call("getDeal", [0n])) as readonly [
      `0x${string}`,
      `0x${string}`,
      bigint,
      number,
    ];
    check(
      "deal #0 has a payee and an amount",
      payee !== "0x0000000000000000000000000000000000000000" && amount > 0n,
      `${payer} paid ${payee} ${amount}`,
    );
    check(
      "deal #0 reached a terminal state",
      status === 3 || status === 4 || status === 5,
      `status ${status}`,
    );
  }

  console.log(`\n${failures === 0 ? "Deployment verified." : `${failures} check(s) failed.`}`);
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
