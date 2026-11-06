/**
 * List live Arkiv anchors for ClearAudit.
 *
 *   npm run arkiv:anchors                  # every live anchor on Arc
 *   npm run arkiv:anchors -- 1337          # every live anchor on the EF devnet artifact
 *   npm run arkiv:anchors -- 5042002 0     # one deal, one chain
 *
 * Read-only: needs ARKIV_ACCESS_KEY (optional) and no private key.
 */
import { createPublicClient } from "@arkiv-network/sdk";
import type { PublicArkivClient } from "@arkiv-network/sdk";
import { rabdi } from "@arkiv-network/sdk/chains";
import { http } from "viem";
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

const [chainArg, dealArg] = process.argv.slice(2);
const chainId = chainArg ? BigInt(chainArg) : 5042002n;
const dealId = dealArg !== undefined ? BigInt(dealArg) : undefined;

const client = createPublicClient({
  chain: rabdi({ accessKey: process.env.ARKIV_ACCESS_KEY ?? "" }),
  transport: http(),
}) as PublicArkivClient;

async function main() {
  const clauses = ["kind = str('zero_day_report')", `chainId = u64(${chainId})`];
  if (dealId !== undefined) clauses.push(`dealId = u64(${dealId})`);

  const page = await client.query(clauses.join(" AND "), {
    select: {
      $key: true,
      $expiresAt: true,
      dealId: true,
      whitehatWallet: true,
      protocolWallet: true,
      amount: true,
      encryptedPayloadHash: true,
    },
    limit: 100,
  });

  const now = Date.now() / 1000;
  const live = (page.entities ?? []).filter((e) => Number(e.$expiresAt) > now);

  console.log(
    `chain ${chainId}${dealId !== undefined ? `, deal ${dealId}` : ""}: ${live.length} live anchor(s)`,
  );
  for (const e of live) {
    const exp = new Date(Number(e.$expiresAt) * 1000).toISOString();
    console.log(
      `  deal ${e.dealId}  whitehat ${e.whitehatWallet}  amount ${e.amount}  ` +
        `hash ${String(e.encryptedPayloadHash).slice(0, 12)}…  expires ${exp}`,
    );
  }
  if (live.length === 0) {
    console.log("  (no live anchors — the payout guard refuses every settlement)");
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
