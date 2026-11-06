import { createHash } from "node:crypto";
import { NextResponse } from "next/server";
import { agentConfig, runAgent } from "@/lib/operator";
import { readDeal } from "@/lib/arc";
import { createReport } from "@/lib/arkiv";
import { ARC_CHAIN_ID } from "@/lib/constants";
import { DEAL_STATUS } from "@/lib/abi";

/**
 * POST /api/agent/run
 *
 * Body: { dealId, task }
 *
 * The operator produces one deliverable, hashes it, and anchors the hash against
 * the deal. It does not release: the funder still has to approve, otherwise the
 * operator would be accepting its own work and the dispute fork would be
 * decorative.
 *
 * Refuses unless the on-chain deal names this operator as payee, so a client
 * cannot spend the model budget on an arbitrary address.
 */

const MIN_TASK = 40;
const MAX_TASK = 6000;
const RUN_WINDOW_MS = 60_000;

// One run per deal per minute. In-process only: this is a demo guard against a
// double click burning tokens, not a production quota system.
const lastRun = new Map<string, number>();

export async function POST(req: Request) {
  const cfg = agentConfig();
  if (!cfg.enabled) {
    return NextResponse.json({ error: "OPERATOR_UNAVAILABLE", reason: cfg.reason }, { status: 503 });
  }

  const body = (await req.json().catch(() => null)) as { dealId?: unknown; task?: unknown } | null;
  const dealId = String(body?.dealId ?? "");
  if (!/^\d+$/.test(dealId)) {
    return NextResponse.json({ error: "dealId must be a non-negative integer" }, { status: 400 });
  }

  const task = typeof body?.task === "string" ? body.task.trim() : "";
  if (task.length < MIN_TASK) {
    return NextResponse.json(
      { error: `Describe the task in at least ${MIN_TASK} characters so the deliverable is worth paying for.` },
      { status: 400 },
    );
  }
  if (task.length > MAX_TASK) {
    return NextResponse.json(
      { error: `Task text is over the ${MAX_TASK} character budget for one run.` },
      { status: 413 },
    );
  }

  const previous = lastRun.get(dealId);
  if (previous && Date.now() - previous < RUN_WINDOW_MS) {
    return NextResponse.json(
      { error: "One run per deal per minute. The previous deliverable is already anchored." },
      { status: 429 },
    );
  }

  let deal;
  try {
    deal = await readDeal(BigInt(dealId));
  } catch (e) {
    return NextResponse.json(
      { error: `Could not read the deal on Arc: ${e instanceof Error ? e.message : e}` },
      { status: 502 },
    );
  }

  if (deal.status !== DEAL_STATUS.Open) {
    return NextResponse.json({ error: `Deal #${dealId} is not open.` }, { status: 409 });
  }
  if (deal.payee.toLowerCase() !== cfg.operator?.toLowerCase()) {
    return NextResponse.json(
      {
        error: "OPERATOR_NOT_PAYEE",
        reason: `Deal #${dealId} pays ${deal.payee}, not the operator. Fund the task with ${cfg.operator} as the payee to use the operator agent.`,
      },
      { status: 403 },
    );
  }

  lastRun.set(dealId, Date.now());

  let run;
  try {
    run = await runAgent(task);
  } catch (e) {
    lastRun.delete(dealId);
    return NextResponse.json(
      { error: "AGENT_RUN_FAILED", reason: e instanceof Error ? e.message : String(e) },
      { status: 502 },
    );
  }

  if (run.content.startsWith("OUT OF SCOPE:")) {
    lastRun.delete(dealId);
    return NextResponse.json(
      { error: "OUT_OF_SCOPE", reason: run.content.replace(/^OUT OF SCOPE:\s*/i, "") },
      { status: 422 },
    );
  }

  const hash = createHash("sha256").update(run.content, "utf8").digest("hex");

  let anchor: { entityKey?: string; txHash?: string; expiresAt: bigint } | null = null;
  let anchorError: string | null = null;
  try {
    anchor = await createReport({
      chainId: ARC_CHAIN_ID,
      dealId: BigInt(dealId),
      protocolWallet: deal.payer,
      whitehatWallet: deal.payee,
      amount: deal.amount,
      encryptedPayloadHash: hash,
      severity: "operator",
    });
  } catch (e) {
    // The deliverable exists and is returned to the caller, but without an
    // anchor the gate will refuse the release. Say so instead of implying it
    // cleared.
    anchorError = e instanceof Error ? e.message : String(e);
  }

  return NextResponse.json({
    ok: anchor !== null,
    dealId,
    operator: cfg.operator,
    // The hash is what the gate compares, not the prose.
    hash,
    anchored: anchor !== null,
    anchorKey: anchor?.entityKey ?? null,
    anchorTx: anchor?.txHash ?? null,
    anchorExpiresAt: anchor ? Number(anchor.expiresAt) : null,
    anchorError,
    model: run.model,
    usage: run.usage,
    latencyMs: run.latencyMs,
    content: run.content,
  });
}
