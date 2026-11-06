import { NextResponse } from "next/server";
import { loadEvidence } from "@/lib/evidence";

/** GET /api/evidence?dealId=0 — public, no wallet. */
export async function GET(req: Request) {
  try {
    const raw = new URL(req.url).searchParams.get("dealId") ?? "0";
    const payload = await loadEvidence(raw);
    return NextResponse.json(payload);
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Evidence read failed";
    const status = message.includes("dealId") ? 400 : 502;
    return NextResponse.json({ error: message }, { status });
  }
}
