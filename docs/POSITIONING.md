# Positioning: what this is, and what it is not

Written after the pre-submission review that asked "isn't this just an Immunefi variant?". The
honest answer at the time was *yes, as pitched it was*. This document is the correction, and it is
deliberately narrower than a pitch deck.

## The primitive

Strip the bounty language and `BountyVault` is one thing:

> **A fixed amount, escrowed to one designated address, released on a third party's assertion, with a
> dispute fork to a neutral arbitrator - where the assertion is only accepted if a live, publicly
> queryable, auto-expiring evidence record matches the on-chain terms.**

Contract facts that define the shape (see `contracts/BountyVault.sol`):

- one payee, fixed at funding time, and it cannot be redirected (`WhitehatMismatch`);
- one amount, no partial releases, no milestones;
- **no deadline and no cancel**: an open bounty's funds move only via `releaseBounty`, or
  `disputeBounty` → `resolveDispute(false)` back to the funder;
- release requires the funder (or the paymaster branch), so the payee can never self-release;
- roles are constrained at creation (`RoleConflict`): funder ≠ payee ≠ arbitrator;
- no upgrade key, no admin withdrawal, no fee on the deployed deployment.

Everything else in the product - Arkiv anchors, the guard, the sponsored devnet path - exists to make
that one paragraph trustworthy to someone who does not trust the operator.

## What bounties are, in this framing

Bounties are the **demo**, not the market. They are the easiest instantiation to explain in 90
seconds and the only one whose evidence (a finding fingerprint) can be produced live on stage. They
are also the most crowded instantiation available, which is exactly why they should not be the pitch.

## Use cases, ranked by fit with the primitive

| # | Use case | Why it fits | What it would need |
| --- | --- | --- | --- |
| 1 | **Post-exploit recovery settlement** - funds are returned by an exploiter or a whitehat under negotiated terms | counterparty is pseudonymous, the window is hours not weeks, evidence is on-chain and public, and the negotiation state must not persist forever | **`deadline` + `cancelBounty`** - without a refund path a funder's capital is locked forever, which is fatal here |
| 2 | **Critical-infrastructure / CVD disclosure payouts** (PSIRT, national CERTs, VDPs) | the payee can never be KYC'd in the time available; a legal retention window maps exactly onto anchor expiry | works today, no contract change |
| 3 | **Pseudonymous work payouts** (annotation, research bounties, agent-to-agent task markets) | the payee holds no gas token and no identity; the Arkiv entity doubles as the task and the claim | `deadline` + partial release |
| 4 | **NDA audit-contest settlement** | evidence = submission fingerprint, expiry = the NDA window, arbitrator = the neutral judge | multi-claimant payout |
| 5 | **Parametric / attestation-gated claims** | "evidence exists, is current, and matches the claim" is literally the guard's predicate | amount tiers |
| 6 | **Bug bounties** | fits, works today, most crowded | - |

**Recommended beachhead: #1.** Protocols already negotiate with exploiters through DMs and multisigs
with no enforceable structure. An escrow that pays only against a matching, expiring evidence anchor,
funded and released by the protocol, and settled without the returning party needing a funded wallet,
is a product rather than a marketplace. It also uses all three partners without hand-waving.

## Differentiation, stated as a table

| | Immunefi / HackerOne | Cantina / Sherlock / Code4rena | On-chain escrow (Sablier, Gitcoin, Hats) | ClearAudit today |
| --- | --- | --- | --- | --- |
| Who holds the money | platform | platform | contract | contract |
| Who decides | platform triage | platform judges | funder asserts | funder asserts **+ a gate anyone can re-run** |
| Payee identity | KYC | KYC-ish | n/a | pseudonymous address |
| Evidence record | internal DB, permanent | internal DB, permanent | none | public, machine-queryable, **expires** |
| Payee needs gas | no (bank) | no (bank) | yes | no on the devnet artifact; on Arc the payee never transacts |
| Fee | ~10% | 10–20% | 0 | 0 on the deployed vault |

The parity column is honest: "escrow plus dispute" is not novel. The only line that is not parity is:

> the payout decision is a query anyone can re-run, against evidence that destroys itself on a
> schedule.

Privacy-by-expiry is the mechanism, not a policy. "No KYC" is a consequence of it, not the pitch.

## The one-paragraph version

> **ClearAudit is an evidence-gated settlement rail: money leaves escrow only when a live, publicly
> verifiable, auto-expiring evidence record matches the terms - so a pseudonymous party can be paid
> without a platform vouching for them.**

## What must not be claimed

Each of these was checked against the chain or the code, and each was wrong or unprovable at some
point in this build:

- **A platform fee.** The deployed vault takes 0%. The 3% in `docs/ROADMAP.md` is a V2 plan.
- **4337 paymaster sponsorship on Arc.** `USDCPaymaster` is deployed and wired, but no product flow
  routes a `UserOperation` through it. The company pays USDC gas directly; the researcher never
  transacts. Sponsorship exists only on the EF devnet artifact.
- **"Gasless for researchers" as a partner feature.** It is true, but it is true because the payee
  never sends a transaction, not because a paymaster paid for one.
- **The EF devnet as settlement.** It is a research artifact on chain 1337 against a reference vault.
  Arc is the product.
- **Dispute resolution as self-serve.** The arbitrator is the Arc Studio deploy wallet; its key is not
  in this repository.
- **Arkiv as decorative.** It is load-bearing: no live, chain-scoped, matching anchor means no payout
  (`/api/release-guard`, `/api/claim`).

## The honest gap between the pitch and the contract

If the beachhead is #1 or #3, the contract needs `deadline`, `cancelBounty` and partial release. That
is a V2, not a hackathon patch - and the current vault is deployed with no upgrade path, so it is a
fresh deploy. Saying that first is cheaper than having a judge find it.
