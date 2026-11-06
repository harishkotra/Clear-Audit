import type { Role } from "./profile";

/**
 * What people actually settle with this rail.
 *
 * The live vault covers named payees, open claiming, contests with split
 * awards, deadlines, cancel and refund.
 *
 * This is the single source of truth for the landing page, onboarding and the
 * workspace copy - so the product cannot drift from the pitch in one place and
 * not the other.
 */

export type UseCaseId =
  | "recovery"
  | "disclosure"
  | "retainer"
  | "agent-work"
  | "contest"
  | "bug-bounty";

export type Fit = "today" | "later";

export type UseCase = {
  id: UseCaseId;
  label: string;
  /** Shown as the card headline. */
  title: string;
  /** One sentence a non-specialist understands. */
  promise: string;
  /** What the anchor actually commits to. */
  evidence: string;
  /** Why the expiry matters to this case, in particular. */
  expiry: string;
  fit: Fit;
  /** Contract gaps, stated where they are relevant. */
  needs?: string;
  /** Workspace nouns, so the app's labels match the situation. */
  nouns: { deal: string; payer: string; payee: string };
  amountHint: string;
  sides: Record<Role, { title: string; body: string }>;
};

export const USE_CASES: UseCase[] = [
  {
    id: "recovery",
    label: "Recovery settlement",
    title: "Returned funds, paid out under terms",
    promise:
      "A protocol negotiates the return of exploited funds, then pays a delivery bounty without either side revealing who the other is.",
    evidence: "Attestation that the funds reached the recovery address",
    expiry: "The negotiation window closes; the record of it stops existing",
    fit: "today",
    nouns: { deal: "settlement", payer: "protocol", payee: "returning party" },
    amountHint: "10% of the recovered amount, typically",
    sides: {
      company: { title: "I'm the protocol", body: "Escrow the bounty, release it when the funds land." },
      researcher: { title: "I hold the funds", body: "Name the address that gets paid on delivery." },
    },
  },
  {
    id: "disclosure",
    label: "Disclosure payout",
    title: "CVD and PSIRT payouts to unsigned identities",
    promise:
      "A national CERT, a vendor PSIRT or a coordinated disclosure programme pays a reporter it cannot KYC in the time available.",
    evidence: "Report fingerprint accepted into the disclosure record",
    expiry: "The legal retention window, mapped onto the anchor lifetime",
    fit: "today",
    nouns: { deal: "disclosure payout", payer: "programme", payee: "reporter" },
    amountHint: "Fixed, agreed before disclosure",
    sides: {
      company: { title: "I run the programme", body: "Fund before disclosure, release on acceptance." },
      researcher: { title: "I reported it", body: "Get paid to a wallet, no identity paperwork." },
    },
  },
  {
    id: "retainer",
    label: "Retainer milestones",
    title: "Research retainers that pay per deliverable",
    promise:
      "A security firm on retainer gets paid per milestone. One escrow per deliverable, released against the artefact's hash.",
    evidence: "Hash of the delivered artefact (report, patch review, threat model)",
    expiry: "The engagement's confidentiality window, not a permanent archive",
    fit: "today",
    nouns: { deal: "milestone", payer: "client", payee: "firm" },
    amountHint: "Per milestone",
    sides: {
      company: { title: "I'm the client", body: "One escrow per milestone, released on delivery." },
      researcher: { title: "I'm the firm", body: "No invoices, no net-30, no bank details." },
    },
  },
  {
    id: "agent-work",
    label: "Agent dispatch",
    title: "Tasks an agent claims, not a person who ghosts",
    promise:
      "A lister publishes work with a refund deadline. Any registered agent can claim it, deliver an artefact hash, and be paid. Nobody waits for a human to sign up and disappear.",
    evidence: "Artefact hash written by the agent, plus the agent's capability anchor",
    expiry: "The task record ends with the anchor instead of lingering forever",
    fit: "today",
    nouns: { deal: "task", payer: "lister", payee: "agent" },
    amountHint: "Per task",
    sides: {
      company: { title: "I list the work", body: "Fund it, set a deadline, let any capable agent claim it." },
      researcher: { title: "I run an agent", body: "Claim, deliver the artefact, get paid without invoicing." },
    },
  },
  {
    id: "contest",
    label: "Contest judgement",
    title: "Audit contests settled by a named judge",
    promise:
      "A contest's judge is the arbitrator: they resolve to one winner, and the submission hash is the evidence both sides can re-check.",
    evidence: "Winning submission fingerprint",
    expiry: "The NDA / embargo window ends with the anchor",
    fit: "today",
    nouns: { deal: "contest prize", payer: "sponsor", payee: "contestant" },
    amountHint: "Prize pool, per winner",
    sides: {
      company: { title: "I sponsor the contest", body: "Escrow the prize, judge resolves the winner." },
      researcher: { title: "I entered", body: "Your submission hash is the claim." },
    },
  },
  {
    id: "bug-bounty",
    label: "Bug bounty",
    title: "Bug bounty payouts",
    promise:
      "The familiar case: a fixed reward for an accepted vulnerability report. It works here, and it is the most crowded lane in the market.",
    evidence: "Finding fingerprint accepted by the programme",
    expiry: "The fixed bug stops being a permanent, indexed target",
    fit: "today",
    nouns: { deal: "reward", payer: "programme", payee: "researcher" },
    amountHint: "Per accepted finding",
    sides: {
      company: { title: "I run a programme", body: "Fund a reward, release on acceptance." },
      researcher: { title: "I find bugs", body: "Submit privately, get paid in USDC." },
    },
  },
];

export function useCaseById(id: UseCaseId | undefined): UseCase {
  return USE_CASES.find((u) => u.id === id) ?? USE_CASES[USE_CASES.length - 1];
}

export const FIT_LABEL: Record<Fit, string> = {
  today: "works with the deployed vault",
  later: "needs a contract change",
};
