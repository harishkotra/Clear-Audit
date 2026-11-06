import { NextResponse } from "next/server";
import { DEAL_STATUS } from "@/lib/abi";
import { readDeal } from "@/lib/arc";
import { findReport, unwrap } from "@/lib/arkiv";
import { ARC_CHAIN_ID } from "@/lib/constants";

/**
 * POST /api/release-guard — the Anchor is load-bearing.
 *
 * The UI calls this before asking the wallet to sign `releaseBounty`. A payout
 * is only allowed when a live, unexpired Arkiv anchor exists for this Arc deal
 * and the anchor's recorded protocol / researcher / amount match the chain.
 *
 * This is an application-level gate, deliberately: BountyVault ships first and
 * must stay immutable, so the evidence policy lives in the settlement client
 * and is enforced again by the same check in the EF path (`/api/claim`).
 * Nothing here can move funds; it can only refuse to help move them.
 */
export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => null);
    const raw = body?.dealId;
    if (!/^\d+$/.test(String(raw ?? ""))) {
      return NextResponse.json({ error: "dealId must be a non-negative integer" }, { status: 400 });
    }

    const dealId = BigInt(raw);
    const deal = await readDeal(dealId);
    if (deal.status !== DEAL_STATUS.Open || deal.researcher === "0x0000000000000000000000000000000000000000") {
      return NextResponse.json(
        { ok: false, reason: `This reward is not open (status ${deal.status}).` },
        { status: 409 },
      );
    }

    if (process.env.REQUIRE_ARKIV_ANCHOR === "false") {
      console.warn("[release-guard] REQUIRE_ARKIV_ANCHOR=false — anchor gate disabled (demo only)");
      return NextResponse.json({ ok: true, anchor: null, gate: "disabled" });
    }

    const report = await findReport(dealId, ARC_CHAIN_ID);
    if (!report) {
      return NextResponse.json(
        {
          ok: false,
          reason:
            "No live Arkiv anchor for this reward. The researcher must anchor the finding before payment can be released.",
        },
        { status: 403 },
      );
    }

    const expiry = Number(unwrap(report.expiresAt) ?? report.$expiresAt ?? 0);
    if (Number.isFinite(expiry) && expiry > 0 && Date.now() / 1000 > expiry) {
      return NextResponse.json(
        { ok: false, reason: "The Arkiv anchor has expired; the evidence is no longer verifiable." },
        { status: 403 },
      );
    }

    const anchoredWhitehat = String(unwrap(report.whitehatWallet) ?? "").toLowerCase();
    const anchoredProtocol = String(unwrap(report.protocolWallet) ?? "").toLowerCase();
    const anchoredAmount = String(unwrap(report.amount) ?? "");

    if (anchoredWhitehat !== deal.researcher.toLowerCase()) {
      return NextResponse.json(
        { ok: false, reason: "The anchored researcher does not match the on-chain beneficiary." },
        { status: 403 },
      );
    }
    if (anchoredProtocol !== deal.company.toLowerCase()) {
      return NextResponse.json(
        { ok: false, reason: "The anchored company does not match the on-chain depositor." },
        { status: 403 },
      );
    }
    if (anchoredAmount !== deal.amount.toString()) {
      return NextResponse.json(
        { ok: false, reason: "The anchored amount does not match the escrowed amount." },
        { status: 403 },
      );
    }

    return NextResponse.json({
      ok: true,
      gate: "arkiv",
      anchor: {
        key: report.$key,
        severity: unwrap(report.severity) ?? null,
        expiresAt: String(expiry || unwrap(report.expiresAt) || ""),
        encryptedPayloadHash: unwrap(report.encryptedPayloadHash) ?? null,
      },
    });
  } catch (e: unknown) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : "Release guard failed" },
      { status: 500 },
    );
  }
}
