import { NextResponse } from "next/server";
import { agentConfig } from "@/lib/operator";

/**
 * GET /api/agent/status
 *
 * The UI needs to know whether an operator is available before it offers to run
 * one. A clone without AGENT_* variables therefore shows the feature as
 * unavailable instead of failing at the click, and the model key never appears
 * in the response.
 */
export async function GET() {
  const cfg = agentConfig();
  let host = "";
  try {
    host = new URL(cfg.baseUrl).host;
  } catch {
    host = cfg.baseUrl;
  }
  return NextResponse.json({
    enabled: cfg.enabled,
    model: cfg.model || null,
    host,
    operator: cfg.operator,
    reason: cfg.enabled ? null : cfg.reason ?? "The operator agent is not configured.",
    limits: { maxTokens: cfg.maxTokens },
  });
}
