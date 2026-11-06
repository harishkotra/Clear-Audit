/**
 * Check the Arkiv writer wallet and access key before a demo.
 *
 *   npm run arkiv:whoami
 *   npm run arkiv:whoami -- 0x65B555dDAd787B66F3F1E4Dd4Ff814D11B9A0ed2   # assert which wallet this is
 *
 * Read-only. Prints: access key presence, the address derived from
 * ARKIV_PRIVATE_KEY, its tGLM balance on Rabdi, and whether an authenticated
 * query succeeds. Never prints the key itself.
 */
import { createPublicClient } from "@arkiv-network/sdk";
import type { PublicArkivClient } from "@arkiv-network/sdk";
import { rabdi } from "@arkiv-network/sdk/chains";
import { http } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import fs from "node:fs";

// Read frontend/.env.local without pulling in dotenv.
if (fs.existsSync(".env.local")) {
  for (const line of fs.readFileSync(".env.local", "utf8").split("\n")) {
    const i = line.indexOf("=");
    if (i < 1 || line.trim().startsWith("#")) continue;
    const k = line.slice(0, i).trim();
    if (!process.env[k]) process.env[k] = line.slice(i + 1).trim();
  }
}

const RABDI_RPC = "https://rpc.rabdi.db-chain.testnet.arkiv.network";
const expected = process.argv[2];

function mask(secret: string): string {
  if (secret.length <= 8) return "<too short>";
  return `${secret.slice(0, 4)}…${secret.slice(-4)} (${secret.length} chars)`;
}

async function balanceOf(address: string): Promise<bigint | null> {
  const res = await fetch(RABDI_RPC, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: 1,
      method: "eth_getBalance",
      params: [address, "latest"],
    }),
  });
  const json = (await res.json()) as { result?: string };
  return json.result ? BigInt(json.result) : null;
}

async function main() {
  let failed = false;

  const accessKey = process.env.ARKIV_ACCESS_KEY?.trim() ?? "";
  if (accessKey) {
    console.log(`access key        present  ${mask(accessKey)}`);
  } else {
    console.log("access key        MISSING  reads fall back to the rate-limited public endpoint");
    console.log("                           free key: https://hub.arkiv.network/access-keys");
    failed = true;
  }

  const pk = process.env.ARKIV_PRIVATE_KEY?.trim() ?? "";
  let address = "";
  if (!/^0x[0-9a-fA-F]{64}$/.test(pk)) {
    console.log("writer key        MISSING  set ARKIV_PRIVATE_KEY (0x + 64 hex) in frontend/.env.local");
    failed = true;
  } else {
    address = privateKeyToAccount(pk as `0x${string}`).address;
    console.log(`writer address    ${address}`);
    if (expected) {
      const ok = expected.toLowerCase() === address.toLowerCase();
      console.log(`expected address  ${expected}  ${ok ? "MATCH" : "MISMATCH"}`);
      if (!ok) failed = true;
    }
  }

  if (address) {
    let bal: bigint | null = null;
    try {
      bal = await balanceOf(address);
    } catch (e) {
      bal = null;
      console.log(`tGLM on Rabdi     UNREADABLE (${e instanceof Error ? e.message : e})`);
    }
    if (bal === null) {
      console.log(`tGLM on Rabdi     retry: curl -s -X POST ${RABDI_RPC} -H 'content-type: application/json' \\
  -d '{"jsonrpc":"2.0","id":1,"method":"eth_getBalance","params":["${address}","latest"]}'`);
      failed = true;
    } else {
      const short = `${(Number(bal) / 1e18).toFixed(4)} tGLM`;
      console.log(`tGLM on Rabdi     ${short}${bal === 0n ? "  UNFUNDED - https://hub.arkiv.network/faucet" : ""}`);
      if (bal === 0n) failed = true;
    }
  }

  // Prove the key actually authenticates by running the query the app runs.
  try {
    const client = createPublicClient({
      chain: rabdi({ accessKey }),
      transport: http(),
    }) as PublicArkivClient;
    const page = await client.query("kind = str('zero_day_report')", { limit: 100 });
    const now = Date.now() / 1000;
    const live = (page.entities ?? []).filter((e) => Number(e.$expiresAt) > now);
    console.log(`live anchors      ${live.length} (query ok, ${accessKey ? "authenticated" : "public"})`);
  } catch (e) {
    console.log(`live anchors      QUERY FAILED: ${e instanceof Error ? e.message : e}`);
    failed = true;
  }

  console.log(failed ? "\nNOT READY - fix the lines above." : "\nArkiv writer ready.");
  if (failed) process.exitCode = 1;
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
