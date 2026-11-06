import { NextResponse } from "next/server";
import {
  anchorExpirySeconds,
  arkivWriterStatus,
  createReport,
  findReport,
  listReports,
  unwrap,
} from "@/lib/arkiv";
import { formatDealRef, tryFormatDealRef } from "@/lib/dealRef";
import { readDeal } from "@/lib/arc";
import { readDevnetDeal } from "@/lib/devnet";
import { ARC_CHAIN_ID, DEVNET_CHAIN_ID } from "@/lib/constants";

const SEVERITIES = new Set(["critical", "high", "medium", "low"]);
const SUPPORTED_CHAINS = new Set([ARC_CHAIN_ID, DEVNET_CHAIN_ID]);

/** GET /api/reports?dealId=0&chainId=5042002 - list live report anchors. */
export async function GET(req: Request) {
  try {
    const params = new URL(req.url).searchParams;
    const raw = params.get("dealId");
    const rawChain = params.get("chainId");

    let dealId: bigint | undefined;
    if (raw !== null) {
      if (!/^\d+$/.test(raw)) {
        return NextResponse.json({ error: "dealId must be a non-negative integer" }, { status: 400 });
      }
      dealId = BigInt(raw);
    }

    let chainId = ARC_CHAIN_ID;
    if (rawChain !== null) {
      if (!/^\d+$/.test(rawChain) || !SUPPORTED_CHAINS.has(Number(rawChain))) {
        return NextResponse.json({ error: "Unsupported chainId" }, { status: 400 });
      }
      chainId = Number(rawChain);
    }

    const entities = await listReports(dealId, chainId);
    const reports = entities.map((e) => {
      const key = e.$key;
      const stored = unwrap(e.ref) as string | undefined;
      const ref = stored ?? tryFormatDealRef(key);
      return {
        key,
        ref,
        chainId: Number(unwrap(e.chainId) ?? chainId),
        dealId: String(unwrap(e.dealId) ?? ""),
        protocolWallet: unwrap(e.protocolWallet) ?? null,
        whitehatWallet: unwrap(e.whitehatWallet) ?? null,
        amount: String(unwrap(e.amount) ?? ""),
        encryptedPayloadHash: unwrap(e.encryptedPayloadHash) ?? null,
        severity: unwrap(e.severity) ?? null,
        criteriaHash: unwrap(e.criteriaHash) ?? null,
        expiresAt: anchorExpirySeconds(e) !== null ? String(anchorExpirySeconds(e)) : null,
      };
    });

    return NextResponse.json({ reports });
  } catch (e: unknown) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Arkiv query failed" },
      { status: 502 },
    );
  }
}

/**
 * POST /api/reports - anchor a finding for a reward.
 *
 * Only the deal id, chain id, hash and severity come from the client. The
 * company, the researcher and the amount are read from the corresponding
 * chain, so an anchor can never describe a different beneficiary than the one
 * the vault will pay.
 */
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { dealId, encryptedPayloadHash, severity } = body ?? {};

    if (dealId === undefined || !encryptedPayloadHash || !severity) {
      return NextResponse.json({ error: "Missing fields" }, { status: 400 });
    }
    if (!/^\d+$/.test(String(dealId))) {
      return NextResponse.json({ error: "dealId must be a non-negative integer" }, { status: 400 });
    }
    if (!/^0x[0-9a-fA-F]{64}$/.test(encryptedPayloadHash)) {
      return NextResponse.json({ error: "encryptedPayloadHash must be bytes32" }, { status: 400 });
    }
    if (!SEVERITIES.has(severity)) {
      return NextResponse.json({ error: "Invalid severity" }, { status: 400 });
    }

    const chainId = body?.chainId === undefined ? ARC_CHAIN_ID : Number(body.chainId);
    if (!SUPPORTED_CHAINS.has(chainId)) {
      return NextResponse.json({ error: "Unsupported chainId" }, { status: 400 });
    }

    const deal = chainId === DEVNET_CHAIN_ID
      ? await readDevnetDeal(BigInt(dealId)).then((d) => ({
          payer: d.protocol,
          payee: d.whitehat,
          amount: d.amount,
          status: d.status,
        }))
      : await readDeal(BigInt(dealId));

    if (deal.status !== 1) {
      return NextResponse.json(
        { error: `This reward is not open (status ${deal.status}).` },
        { status: 409 },
      );
    }

    // Re-anchoring an open deal is an overwrite in practice (readers take the
    // newest entity). Refuse it instead of silently replacing evidence.
    const existing = await findReport(BigInt(dealId), chainId);
    if (existing) {
      const sameHash =
        String(unwrap(existing.encryptedPayloadHash) ?? "").toLowerCase() ===
        encryptedPayloadHash.toLowerCase();
      if (!sameHash) {
        return NextResponse.json(
          { error: "This reward already has a live anchor. Evidence cannot be replaced in place." },
          { status: 409 },
        );
      }
      return NextResponse.json({
        entityKey: existing.$key,
        expiresAt: anchorExpirySeconds(existing) !== null ? String(anchorExpirySeconds(existing)) : null,
        deduplicated: true,
      });
    }

    // Fail fast with an actionable message when the writer cannot pay Rabdi fees.
    const writer = await arkivWriterStatus();
    if (!writer.ok) {
      return NextResponse.json(
        { error: `Arkiv writer is not ready. ${writer.reason}`, code: "ARKIV_WRITER_NOT_READY" },
        { status: 503 },
      );
    }

    const result = await createReport({
      chainId,
      dealId: BigInt(dealId),
      protocolWallet: deal.payer,
      whitehatWallet: deal.payee,
      amount: deal.amount,
      encryptedPayloadHash,
      severity,
      criteriaHash: "criteriaHash" in deal ? (deal as { criteriaHash?: `0x${string}` }).criteriaHash : undefined,
    });

    return NextResponse.json({
      entityKey: result.entityKey,
      ref: result.ref ?? (result.entityKey ? formatDealRef(result.entityKey) : null),
      txHash: result.txHash,
      expiresAt: result.expiresAt.toString(),
    });
  } catch (e: unknown) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Arkiv write failed" },
      { status: 500 },
    );
  }
}
