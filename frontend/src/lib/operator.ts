/**
 * Operator agent: ClearAudit acting as a paid agent, not as a fee on the escrow.
 *
 * The vault has no fee switch, so the only honest way for this project to earn
 * from agent work is to be one of the agents: the lister funds a task naming the
 * operator address, the operator produces the deliverable, anchors its hash, and
 * the funder releases the full amount. Revenue is the margin between the funded
 * amount and the inference cost, and it is invisible to the contract.
 *
 * Everything here is server-only. The model key must never be prefixed with
 * NEXT_PUBLIC_.
 */

const AGENT_MAX_TOKENS_DEFAULT = 1600;

export type AgentConfig = {
  enabled: boolean;
  baseUrl: string;
  model: string;
  maxTokens: number;
  operator: `0x${string}` | null;
  reason?: string;
};

function normalizeBase(raw: string): string {
  return raw.replace(/\/+$/, "");
}

export function agentConfig(): AgentConfig {
  const baseUrl = normalizeBase(process.env.AGENT_API_BASE_URL?.trim() || "https://api.particle.ai/v1");
  const model = process.env.AGENT_MODEL?.trim() || "";
  const key = process.env.AGENT_API_KEY?.trim();
  const rawOperator = process.env.OPERATOR_ADDRESS?.trim() ?? "";
  const operator = /^0x[0-9a-fA-F]{40}$/.test(rawOperator) ? (rawOperator as `0x${string}`) : null;
  const maxTokens = Number(process.env.AGENT_MAX_TOKENS ?? AGENT_MAX_TOKENS_DEFAULT);

  if (!key) {
    return { enabled: false, baseUrl, model, maxTokens, operator, reason: "AGENT_API_KEY is not set." };
  }
  if (!model) {
    return { enabled: false, baseUrl, model, maxTokens, operator, reason: "AGENT_MODEL is not set." };
  }
  if (!operator) {
    return {
      enabled: false,
      baseUrl,
      model,
      maxTokens,
      operator,
      reason: "OPERATOR_ADDRESS is not set, so there is no address the vault can pay.",
    };
  }
  return { enabled: true, baseUrl, model, maxTokens, operator };
}

const SYSTEM = `You are the ClearAudit operator agent. You are paid a fixed escrow amount for one deliverable, released only when the funder accepts it.

Write a security finding as a plain report with these headings, nothing before them:
SCOPE, SUMMARY, SEVERITY, IMPACT, REPRODUCTION, REMEDIATION, CONFIDENCE.

Rules:
- SEVERITY is exactly one of: critical, high, medium, low, informational.
- Under 700 words. No preamble, no closing pleasantries, no markdown code fences.
- Say only what can be justified from the task text. Mark uncertainty explicitly instead of inventing details such as contract addresses, line numbers or transaction hashes.
- If the task is not a security review or a technical deliverable, reply with a single line starting "OUT OF SCOPE:" and the reason. Do not pad it.`;

export type AgentRun = {
  content: string;
  model: string;
  usage: { promptTokens: number; completionTokens: number; totalTokens: number } | null;
  latencyMs: number;
};

/** Calls an OpenAI-compatible chat completions endpoint. Never logs the key. */
export async function runAgent(task: string, opts?: { maxTokens?: number }): Promise<AgentRun> {
  const cfg = agentConfig();
  if (!cfg.enabled) throw new Error(cfg.reason ?? "The operator agent is not configured.");
  const key = process.env.AGENT_API_KEY?.trim();
  if (!key) throw new Error("AGENT_API_KEY is not set.");

  const started = Date.now();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 90_000);

  try {
    const res = await fetch(`${cfg.baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: cfg.model,
        messages: [
          { role: "system", content: SYSTEM },
          { role: "user", content: task },
        ],
        max_tokens: opts?.maxTokens ?? cfg.maxTokens,
        temperature: 0.2,
      }),
      signal: controller.signal,
      cache: "no-store",
    });

    if (!res.ok) {
      const detail = await res.text().catch(() => "");
      throw new Error(`The model endpoint returned ${res.status}. ${detail.slice(0, 180)}`.trim());
    }

    const json = (await res.json()) as {
      model?: string;
      choices?: { message?: { content?: string } }[];
      usage?: { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number };
    };

    const content = json.choices?.[0]?.message?.content?.trim() ?? "";
    if (!content) throw new Error("The model returned an empty deliverable.");

    return {
      content,
      model: json.model ?? cfg.model,
      usage: json.usage
        ? {
            promptTokens: json.usage.prompt_tokens ?? 0,
            completionTokens: json.usage.completion_tokens ?? 0,
            totalTokens: json.usage.total_tokens ?? 0,
          }
        : null,
      latencyMs: Date.now() - started,
    };
  } finally {
    clearTimeout(timer);
  }
}
