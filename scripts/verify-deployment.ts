#!/usr/bin/env node
/**
 * verify-deployment.ts — independent read-only verification of the Arc
 * deployment. It does not trust deployments.json; it checks the chain.
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
const dep = JSON.parse(readFileSync(resolve(root, "deployments.json"), "utf8"));
const arcCfg = dep.chains.arcTestnet as {
  chainId: number;
  rpc: string;
  deploymentTx: `0x${string}`;
  contracts: Record<string, `0x${string}`>;
  roles: Record<string, `0x${string}`>;
};

const vaultAbi = JSON.parse(readFileSync(resolve(root, "abi/BountyVault.json"), "utf8")).abi;
const paymasterAbi = JSON.parse(readFileSync(resolve(root, "abi/USDCPaymaster.json"), "utf8")).abi;

const arc = defineChain({
  id: arcCfg.chainId,
  name: "Arc Testnet",
  nativeCurrency: { name: "USD Coin", symbol: "USDC", decimals: 18 },
  rpcUrls: { default: { http: [process.env.ARC_RPC_URL ?? arcCfg.rpc] } },
});

const client = createPublicClient({ chain: arc, transport: http() });

let failures = 0;
function check(label: string, ok: boolean, detail: string) {
  const mark = ok ? "PASS" : "FAIL";
  console.log(`${mark}  ${label}${detail ? ` — ${detail}` : ""}`);
  if (!ok) failures += 1;
}

async function call(address: `0x${string}`, abi: readonly unknown[], fn: string) {
  return client.readContract({ address, abi, functionName: fn } as never);
}

async function main() {
  const { ClearAuditDeployer, BountyVault, USDCPaymaster, USDC, EntryPoint } = arcCfg.contracts;

  const chainId = await client.getChainId();
  check("RPC chain id", chainId === arcCfg.chainId, `expected ${arcCfg.chainId}, got ${chainId}`);

  for (const [name, address] of Object.entries({ ClearAuditDeployer, BountyVault, USDCPaymaster })) {
    const code = await client.getCode({ address });
    check(`${name} has code`, Boolean(code && code !== "0x"), address);
  }

  const receipt = await client.getTransactionReceipt({ hash: arcCfg.deploymentTx }).catch(() => null);
  if (receipt) {
    check("deployment tx succeeded", receipt.status === "success", arcCfg.deploymentTx);
  } else {
    console.log(`SKIP  deployment tx receipt not served by this RPC — ${arcCfg.deploymentTx}`);
  }

  const token = (await call(BountyVault, vaultAbi, "token")) as `0x${string}`;
  check("vault.token == USDC", getAddress(token) === getAddress(USDC), token);

  const paymaster = (await call(BountyVault, vaultAbi, "paymaster")) as `0x${string}`;
  check("vault.paymaster == USDCPaymaster", getAddress(paymaster) === getAddress(USDCPaymaster), paymaster);

  const arbitrator = (await call(BountyVault, vaultAbi, "arbitrator")) as `0x${string}`;
  check("vault.arbitrator == configured role", getAddress(arbitrator) === getAddress(arcCfg.roles.arbitrator), arbitrator);

  const pmVault = (await call(USDCPaymaster, paymasterAbi, "vault")) as `0x${string}`;
  check("paymaster.vault == BountyVault", getAddress(pmVault) === getAddress(BountyVault), pmVault);

  const pmUsdc = (await call(USDCPaymaster, paymasterAbi, "usdc")) as `0x${string}`;
  check("paymaster.usdc == USDC", getAddress(pmUsdc) === getAddress(USDC), pmUsdc);

  const entryPoint = (await call(USDCPaymaster, paymasterAbi, "entryPoint")) as `0x${string}`;
  check("paymaster.entryPoint == EntryPoint", getAddress(entryPoint) === getAddress(EntryPoint), entryPoint);

  const owner = (await call(USDCPaymaster, paymasterAbi, "owner")) as `0x${string}`;
  check("paymaster.owner == ClearAuditDeployer", getAddress(owner) === getAddress(ClearAuditDeployer), owner);

  const nextDealId = (await call(BountyVault, vaultAbi, "nextDealId")) as bigint;
  check("vault.nextDealId() readable", typeof nextDealId === "bigint", `nextDealId = ${nextDealId}`);

  console.log(`\n${failures === 0 ? "Deployment verified." : `${failures} check(s) failed.`}`);
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
