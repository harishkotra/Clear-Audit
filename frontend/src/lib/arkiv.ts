import { createPublicClient, createWalletClient, ExpirationTime } from "@arkiv-network/sdk";
import type { PublicArkivClient, WalletArkivClient } from "@arkiv-network/sdk";
import { rabdi } from "@arkiv-network/sdk/chains";
import { defineSchema, str, addr, u64 } from "@arkiv-network/sdk/schema";
import { http } from "viem";
import { privateKeyToAccount } from "viem/accounts";

/**
 * Arkiv is the confidentiality layer: a zero-day report is anchored for 30 days
 * and then expires. The vault checks this anchor before paying out, so the
 * retention window is load-bearing rather than decorative.
 *
 * Server-only — the access key and signer never reach the browser.
 */
export const REPORT_RETENTION_DAYS = 30;

export const ReportSchema = defineSchema("bounty_reports", {
  // Only indexed columns can be filtered on (Arkiv matches nothing for an
  // unindexed comparison — it does not error). An earlier version of this
  // schema declared the columns without `.indexed()`, so every anchor was
  // unqueryable and the release guard refused every payout. Do not remove
  // these: the guard's `kind`/`chainId`/`dealId` clauses depend on them.
  kind: str().indexed(),
  /** Which chain the deal lives on. Arc (5042002) or the EF devnet (1337). */
  chainId: u64().indexed(),
  dealId: u64().indexed(),
  protocolWallet: addr().indexed(),
  whitehatWallet: addr().indexed(),
  amount: u64(),
  encryptedPayloadHash: str(),
  severity: str(),
  expiresAt: u64(),
});

export type ReportEntity = {
  $key: string;
  $expiresAt?: number | bigint;
  chainId?: number | bigint | { value: number | bigint };
  dealId?: number | bigint | { value: number | bigint };
  protocolWallet?: string | { value: string };
  whitehatWallet?: string | { value: string };
  amount?: number | bigint | { value: number | bigint };
  encryptedPayloadHash?: string | { value: string };
  severity?: string | { value: string };
  expiresAt?: number | bigint | { value: number | bigint };
};

/**
 * The `expiresAt` we write is unix seconds. The system `$expiresAt` is a BLOCK
 * NUMBER (Rabdi runs 2 s blocks: an anchor created at block 286 410 with 30
 * days of retention reports `$expiresAt = 1 582 410`). Comparing `$expiresAt`
 * to `Date.now()` is therefore always "expired". Read the attribute, and treat
 * a missing one as not-verifiable rather than as live.
 */
export function anchorExpirySeconds(entity: ReportEntity): number | null {
  const raw = unwrap(entity.expiresAt);
  if (raw === undefined || raw === null) return null;
  const seconds = Number(raw);
  return Number.isFinite(seconds) && seconds > 0 ? seconds : null;
}

export function unwrap<T>(value: T | { value: T } | undefined): T | undefined {
  if (value && typeof value === "object" && "value" in (value as object)) {
    return (value as { value: T }).value;
  }
  return value as T | undefined;
}

function accessKey(): string | undefined {
  const key = process.env.ARKIV_ACCESS_KEY?.trim();
  return key ? key : undefined;
}

const RABDI_RPC = "https://rpc.rabdi.db-chain.testnet.arkiv.network";

/**
 * The writer must hold a little tGLM on Rabdi or every createEntity fails with
 * "Execution error without revert data". Checking first turns that opaque
 * failure into an actionable message instead of a 500 during a demo.
 */
export async function arkivWriterStatus(): Promise<
  | { ok: true; address: string }
  | { ok: false; address: string; reason: string }
> {
  const pk = process.env.ARKIV_PRIVATE_KEY as `0x${string}` | undefined;
  if (!pk || !/^0x[0-9a-fA-F]{64}$/.test(pk)) {
    return { ok: false, address: "", reason: "ARKIV_PRIVATE_KEY is missing or malformed." };
  }
  const address = privateKeyToAccount(pk).address;

  try {
    const res = await fetch(RABDI_RPC, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "eth_getBalance",
        params: [address, "latest"],
      }),
      cache: "no-store",
    });
    const json = (await res.json()) as { result?: string; error?: unknown };
    if (!json.result) {
      return { ok: false, address, reason: "Could not read the Rabdi balance for the writer." };
    }
    if (BigInt(json.result) === 0n) {
      return {
        ok: false,
        address,
        reason: `The Arkiv writer ${address} has no tGLM on Rabdi. Fund it at https://hub.arkiv.network/faucet`,
      };
    }
    return { ok: true, address };
  } catch (e) {
    return {
      ok: false,
      address,
      reason: `Rabdi is unreachable: ${e instanceof Error ? e.message : e}`,
    };
  }
}

export function getArkivReader(): PublicArkivClient {
  return createPublicClient({
    chain: rabdi({ accessKey: accessKey() ?? "" }),
    transport: http(),
  }) as PublicArkivClient;
}

export function getArkivWriter(): WalletArkivClient {
  const pk = process.env.ARKIV_PRIVATE_KEY as `0x${string}` | undefined;
  if (!pk || !/^0x[0-9a-fA-F]{64}$/.test(pk)) {
    throw new Error("ARKIV_PRIVATE_KEY is missing or malformed.");
  }
  return createWalletClient({
    account: privateKeyToAccount(pk),
    chain: rabdi({ accessKey: accessKey() ?? "" }),
    transport: http(),
  }) as WalletArkivClient;
}

/**
 * Query live reports, newest first.
 *
 * Anchors are scoped by chain as well as by deal id: the EF devnet also has a
 * deal #0, and treating the two as the same bounty is exactly the kind of
 * cross-network confusion a fail-closed guard must not have.
 */
export async function listReports(
  dealId?: bigint,
  chainId?: number,
): Promise<ReportEntity[]> {
  const client = getArkivReader();
  const clauses = ["kind = str('zero_day_report')"];
  if (chainId !== undefined) clauses.push(`chainId = u64(${chainId})`);
  if (dealId !== undefined) clauses.push(`dealId = u64(${dealId.toString()})`);
  const query = clauses.join(" AND ");

  const page = await client.query(query, {
    select: {
      $key: true,
      $expiresAt: true,
      chainId: true,
      dealId: true,
      protocolWallet: true,
      whitehatWallet: true,
      amount: true,
      encryptedPayloadHash: true,
      severity: true,
      expiresAt: true,
    },
    limit: 100,
  });

  return (page.entities ?? []) as unknown as ReportEntity[];
}

/** Returns the live Arkiv anchor for a deal, or null. Never throws. */
export async function findReport(
  dealId: bigint,
  chainId?: number,
): Promise<ReportEntity | null> {
  try {
    const entities = await listReports(dealId, chainId);
    return entities[0] ?? null;
  } catch {
    return null;
  }
}

export async function createReport(input: {
  chainId: number;
  dealId: bigint;
  protocolWallet: `0x${string}`;
  whitehatWallet: `0x${string}`;
  amount: bigint;
  encryptedPayloadHash: string;
  severity: string;
}) {
  const client = getArkivWriter();
  const expiresAt = BigInt(Math.floor(Date.now() / 1000) + REPORT_RETENTION_DAYS * 86_400);

  const result = await client.createEntity(
    ReportSchema,
    {
      kind: str("zero_day_report"),
      chainId: u64(BigInt(input.chainId)),
      dealId: u64(input.dealId),
      protocolWallet: addr(input.protocolWallet),
      whitehatWallet: addr(input.whitehatWallet),
      amount: u64(input.amount),
      encryptedPayloadHash: str(input.encryptedPayloadHash),
      severity: str(input.severity),
      expiresAt: u64(expiresAt),
    },
    { expiration: ExpirationTime.fromDays(REPORT_RETENTION_DAYS) },
  );

  return { ...result, expiresAt };
}
