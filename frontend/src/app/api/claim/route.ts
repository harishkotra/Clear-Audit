import { NextResponse } from "next/server";
import { privateKeyToAccount } from "viem/accounts";
import { submitClaim } from "@/utils/altMempool";
import { anchorExpirySeconds, findReport, unwrap } from "@/lib/arkiv";
import { DEAL_STATUS } from "@/lib/abi";
import { readDevnetDeal, readDevnetHead } from "@/lib/devnet";
import {
  ALT_MEMPOOL_READ_RPC,
  ALT_MEMPOOL_RPC,
  DEVNET_CHAIN_ID,
  DEVNET_VAULT_ADDRESS,
} from "@/lib/constants";

/**
 * EF alt-mempool reference path (chain 1337).
 *
 * The gasless settlement prototype: the vault release is wrapped in an
 * EIP-8141 frame transaction whose PAYMENT frame is sponsored. It is NOT a
 * bridge to Arc - the Arc deployment is the product, this is the research
 * artifact. Never present it as cross-chain settlement.
 *
 * The Arkiv guard is the same policy as the Arc release path: a live anchor,
 * scoped to this chain and this deal, whose beneficiary and amount match the
 * chain must exist before the relayer spends gas.
 */

/** Crude per-IP throttle: this route spends a funded relayer key. */
const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX = 5;
const hits = new Map<string, number[]>();

function rateLimited(ip: string): boolean {
  const now = Date.now();
  const recent = (hits.get(ip) ?? []).filter((t) => now - t < RATE_LIMIT_WINDOW_MS);
  recent.push(now);
  hits.set(ip, recent);
  if (hits.size > 10_000) hits.clear(); // bounded memory
  return recent.length > RATE_LIMIT_MAX;
}

function relayer() {
  const pk = process.env.PROTOCOL_PRIVATE_KEY as `0x${string}` | undefined;
  if (!pk || !/^0x[0-9a-fA-F]{64}$/.test(pk)) {
    throw new Error("PROTOCOL_PRIVATE_KEY is not configured (server-only).");
  }
  return { pk, address: privateKeyToAccount(pk).address };
}

type Gate = { ok: true } | { ok: false; reason: string };

/** Fail-closed Arkiv check. A guard that cannot fail is not a guard. */
async function verifyAnchor(input: {
  dealId: bigint;
  whitehat: `0x${string}`;
  amount: bigint;
  expectedHash?: string;
  simulateExpired?: boolean;
}): Promise<Gate> {
  if (input.simulateExpired) {
    return { ok: false, reason: "Arkiv anchor is expired (simulated). The bounty cannot settle." };
  }
  if (process.env.REQUIRE_ARKIV_ANCHOR === "false") {
    console.warn("[claim] REQUIRE_ARKIV_ANCHOR=false - accepting an unanchored claim (demo only)");
    return { ok: true };
  }

  let report;
  try {
    report = await findReport(input.dealId, DEVNET_CHAIN_ID);
  } catch (e) {
    return { ok: false, reason: `Arkiv unreachable: ${e instanceof Error ? e.message : e}` };
  }
  if (!report) return { ok: false, reason: "No live Arkiv anchor for this devnet bounty." };

  const expiry = anchorExpirySeconds(report);
  if (expiry === null) {
    return { ok: false, reason: "Arkiv anchor has no readable expiry; it cannot be verified as live." };
  }
  if (Date.now() / 1000 > expiry) {
    return { ok: false, reason: "Arkiv anchor expired; evidence is no longer verifiable." };
  }

  const anchoredWhitehat = String(unwrap(report.whitehatWallet) ?? "").toLowerCase();
  if (anchoredWhitehat !== input.whitehat.toLowerCase()) {
    return { ok: false, reason: "Anchored researcher does not match the on-chain beneficiary." };
  }

  const anchoredAmount = String(unwrap(report.amount) ?? "");
  if (anchoredAmount !== input.amount.toString()) {
    return { ok: false, reason: "Anchored amount does not match the escrowed amount." };
  }

  const anchoredHash = unwrap(report.encryptedPayloadHash);
  if (input.expectedHash && anchoredHash && anchoredHash.toLowerCase() !== input.expectedHash.toLowerCase()) {
    return { ok: false, reason: "Arkiv payload hash does not match the claim." };
  }

  return { ok: true };
}

export async function POST(req: Request) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "local";
  if (rateLimited(ip)) {
    return NextResponse.json({ error: "Too many claim attempts. Try again shortly." }, { status: 429 });
  }

  try {
    const body = await req.json().catch(() => null);
    const rawDealId = body?.dealId;
    const expectedHash = typeof body?.expectedHash === "string" ? body.expectedHash : undefined;
    const simulateExpired = body?.simulateExpired === true;

    if (!/^\d+$/.test(String(rawDealId ?? ""))) {
      return NextResponse.json({ error: "dealId must be a non-negative integer" }, { status: 400 });
    }
    if (expectedHash && !/^0x[0-9a-fA-F]{64}$/.test(expectedHash)) {
      return NextResponse.json({ error: "expectedHash must be bytes32" }, { status: 400 });
    }

    const dealId = BigInt(rawDealId);
    const deal = await readDevnetDeal(dealId);

    if (deal.whitehat === "0x0000000000000000000000000000000000000000") {
      return NextResponse.json({ error: "Unknown deal on the EF devnet." }, { status: 404 });
    }
    if (deal.status !== DEAL_STATUS.Open) {
      return NextResponse.json({ error: `Deal is not open (status ${deal.status}).` }, { status: 409 });
    }

    const gate = await verifyAnchor({
      dealId,
      whitehat: deal.whitehat,
      amount: deal.amount,
      expectedHash,
      simulateExpired,
    });
    if (!gate.ok) {
      return NextResponse.json({ error: `CLAIM BLOCKED: ${gate.reason}` }, { status: 403 });
    }

    const { pk, address } = relayer();

    // Refuse to spend relayer gas on a chain that is not producing blocks.
    const head = await readDevnetHead().catch(() => null);
    if (head && head.ageSeconds > 600) {
      return NextResponse.json(
        {
          error: `The EF devnet is not producing blocks right now (head ${head.number}, last block ${Math.round(head.ageSeconds / 60)} min ago). Nothing was submitted.`,
          code: "DEVNET_STALLED",
        },
        { status: 503 },
      );
    }

    const { txHash, receipt } = await submitClaim({
      dealId,
      protocolPrivateKey: pk,
      protocolAddress: address,
      whitehatAddress: deal.whitehat,
      escrowAddress: DEVNET_VAULT_ADDRESS,
      readRpc: ALT_MEMPOOL_READ_RPC,
      altMempoolRpc: ALT_MEMPOOL_RPC,
    });

    return NextResponse.json({
      txHash,
      status: receipt.status,
      blockNumber: receipt.blockNumber ? Number(BigInt(receipt.blockNumber)) : null,
      gasUsed: receipt.gasUsed ? Number(BigInt(receipt.gasUsed)) : null,
      chainId: DEVNET_CHAIN_ID,
      whitehat: deal.whitehat,
      frames: receipt.frameReceipts?.map((f: { status?: string; gasUsed?: string }, i: number) => ({
        index: i,
        status: f.status,
        gasUsed: f.gasUsed,
      })),
    });
  } catch (e: unknown) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Unknown error" },
      { status: 500 },
    );
  }
}
