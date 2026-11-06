import { keccak256, toBytes } from "viem";
import type { UseCaseId } from "./usecases";

/**
 * Live mentor workspace. Each row is a real deal we fund on Arc; the criteria
 * string is hashed on chain and is how the UI recognises the situation.
 * Nothing here is mocked: if the vault has no matching deal, the card stays empty.
 */
export type WorkspaceSeed = {
  useCase: UseCaseId;
  title: string;
  story: string;
  criteria: string;
  kind: "named" | "open" | "contest";
};

export const WORKSPACE: WorkspaceSeed[] = [
  {
    useCase: "recovery",
    title: "Post-exploit recovery",
    story: "Protocol escrows a delivery bounty against proof that stolen funds reached the recovery address.",
    criteria:
      "Attestation that recovered funds reached the designated recovery address 0xBEEF00000000000000000000000000000000BEEf",
    kind: "named",
  },
  {
    useCase: "disclosure",
    title: "CVD / PSIRT payout",
    story: "A programme pays a reporter it cannot KYC in time, against the accepted disclosure fingerprint.",
    criteria: "PSIRT accepted fingerprint for the coordinated disclosure filed against the production API",
    kind: "named",
  },
  {
    useCase: "retainer",
    title: "Retainer milestone",
    story: "One escrow per deliverable. The artefact hash is the acceptance test.",
    criteria: "SHA-256 of the Q4 threat-model artefact delivered under the 2026 retainer",
    kind: "named",
  },
  {
    useCase: "agent-work",
    title: "Agent dispatch",
    story: "Work left open so any capable agent can claim it before the deadline.",
    criteria: "Capability proof plus artefact hash for the labelled dispatch task",
    kind: "open",
  },
  {
    useCase: "contest",
    title: "Audit contest",
    story: "One prize pool, many entrants. The named judge awards shares in a single transaction.",
    criteria: "Judge-signed bundle of winning submission fingerprints for the NDA audit contest",
    kind: "contest",
  },
];

export function workspaceCriteriaHash(criteria: string): `0x${string}` {
  return keccak256(toBytes(criteria));
}
