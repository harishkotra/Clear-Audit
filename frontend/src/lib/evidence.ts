import { readDeal, readEvidence, readVaultFeatures } from "@/lib/arc";
import { anchorExpirySeconds, criteriaMatches, findReport, unwrap } from "@/lib/arkiv";
import { ARC_CHAIN_ID, ARC_EXPLORER, VAULT_ADDRESS } from "@/lib/constants";
import { PROVEN, ZERO_ADDRESS } from "@/lib/proven";

export type EvidenceVerdict =
  | "match"
  | "mismatch"
  | "missing"
  | "expired"
  | "unreadable"
  | "no-payee"
  | "not-open";

export type EvidencePayload = {
  chainId: number;
  vault: string;
  explorer: string;
  dealId: string;
  features: { evidenceGate: boolean; challengeWindow: number };
  deal: {
    id: string;
    payer: string;
    payee: string;
    amount: string;
    status: number;
    deadline: number;
    claimedAt: number;
    agentMode: boolean;
    assigned: boolean;
    criteriaHash: string;
  };
  evidence: { hash: `0x${string}`; expiresAt: number; challengeUntil: number } | null;
  arkiv: {
    key: string;
    protocolWallet: string | null;
    whitehatWallet: string | null;
    amount: string;
    encryptedPayloadHash: string | null;
    severity: string | null;
    criteriaHash: string | null;
    expiresAt: number | null;
  } | null;
  verdict: EvidenceVerdict;
  reasons: string[];
  query: string;
  proven: typeof PROVEN[number][];
};

export async function loadEvidence(raw: string): Promise<EvidencePayload> {
  if (!/^\d+$/.test(raw)) {
    throw new Error("dealId must be a non-negative integer");
  }

  const dealId = BigInt(raw);
  const [deal, features] = await Promise.all([readDeal(dealId), readVaultFeatures()]);
  const evidence = features.evidenceGate ? await readEvidence(dealId) : null;
  const report = await findReport(dealId, ARC_CHAIN_ID, {
    amount: deal.amount.toString(),
    payer: deal.payer,
    payee: deal.payee === ZERO_ADDRESS ? undefined : deal.payee,
  });

  const reasons: string[] = [];
  let verdict: EvidenceVerdict = "missing";

  if (deal.payee.toLowerCase() === ZERO_ADDRESS) {
    verdict = "no-payee";
    reasons.push("No payee is set. An open task must be claimed before evidence can match a beneficiary.");
  }

  if (!report) {
    if (verdict !== "no-payee") verdict = "missing";
    reasons.push("No live Arkiv anchor for this deal on chain 5042002.");
  } else {
    const expiry = anchorExpirySeconds(report);
    const now = Date.now() / 1000;
    const payee = String(unwrap(report.whitehatWallet) ?? "").toLowerCase();
    const payer = String(unwrap(report.protocolWallet) ?? "").toLowerCase();
    const amount = String(unwrap(report.amount) ?? "");

    if (expiry === null) {
      verdict = "unreadable";
      reasons.push("The Arkiv entity has no readable expiresAt attribute.");
    } else if (now > expiry) {
      verdict = "expired";
      reasons.push("The Arkiv anchor has expired.");
    } else {
      if (payee !== deal.payee.toLowerCase()) {
        reasons.push("Anchored payee does not match the on-chain beneficiary.");
      }
      if (payer !== deal.payer.toLowerCase()) {
        reasons.push("Anchored payer does not match the on-chain depositor.");
      }
      if (amount !== deal.amount.toString()) {
        reasons.push("Anchored amount does not match the escrowed amount.");
      }
      if (!criteriaMatches(deal.criteriaHash, unwrap(report.criteriaHash) as string | undefined)) {
        reasons.push("Anchored acceptance criteria do not match the on-chain hash.");
      }
      verdict = reasons.length ? "mismatch" : "match";
      if (verdict === "match") {
        reasons.push("Live Arkiv anchor matches payee, payer, amount and criteria.");
      }
    }
  }

  if (deal.status !== 1 && verdict === "match") {
    verdict = "not-open";
    reasons.push(`Deal status is ${deal.status}; the vault is no longer Open.`);
  }

  return {
    chainId: ARC_CHAIN_ID,
    vault: VAULT_ADDRESS,
    explorer: ARC_EXPLORER,
    dealId: String(dealId),
    features,
    deal: {
      id: deal.id,
      payer: deal.payer,
      payee: deal.payee,
      amount: deal.amount.toString(),
      status: deal.status,
      deadline: deal.deadline,
      claimedAt: deal.claimedAt,
      agentMode: deal.agentMode,
      assigned: deal.assigned,
      criteriaHash: deal.criteriaHash,
    },
    evidence,
    arkiv: report
      ? {
          key: report.$key,
          protocolWallet: unwrap(report.protocolWallet) ?? null,
          whitehatWallet: unwrap(report.whitehatWallet) ?? null,
          amount: String(unwrap(report.amount) ?? ""),
          encryptedPayloadHash: unwrap(report.encryptedPayloadHash) ?? null,
          severity: unwrap(report.severity) ?? null,
          criteriaHash: unwrap(report.criteriaHash) ?? null,
          expiresAt: anchorExpirySeconds(report),
        }
      : null,
    verdict,
    reasons,
    query: [
      "kind = str('zero_day_report')",
      `chainId = u64(${ARC_CHAIN_ID})`,
      `dealId = u64(${dealId.toString()})`,
    ].join(" AND "),
    proven: PROVEN.filter((p) => p.dealId === String(dealId)),
  };
}
