# Use cases: what this rail is for

The product is the settlement rule, not a marketplace. `BountyVault` escrows one fixed amount to one
fixed address, released by the funder's assertion, with a dispute fork to a named arbitrator - and
refuses the release unless a live, chain-scoped, matching Arkiv anchor exists.

That rule fits six situations. The app asks which one you are in at onboarding and renames its own
vocabulary around it (`frontend/src/lib/usecases.ts` is the single source of truth for the landing
page, onboarding and the workspace copy).

| # | Situation | Evidence anchor | Why expiry matters | Fit today |
| --- | --- | --- | --- | --- |
| 1 | **Post-exploit recovery settlement** - funds return against a negotiated delivery bounty | attestation that funds reached the recovery address | the negotiation window closes; the record stops existing | works (deadline + refund) |
| 2 | **CVD / PSIRT disclosure payouts** - a programme pays a reporter it cannot KYC in time | accepted report fingerprint | the legal retention window, mapped onto the anchor | works |
| 3 | **Retainer milestones** - a security firm paid per deliverable | artefact hash (report, patch review, threat model) | the engagement's confidentiality window | works |
| 4 | **Agent dispatch** - a lister leaves the payee open so any agent can claim the task | artefact hash written by the claiming agent | the task record ends with the anchor | works (`createOpenTask` / `claimTask`) |
| 5 | **Contest judgement** - a named judge resolves a prize | winning submission fingerprint | the NDA / embargo window | works (`createContest` / `award`) |
| 6 | **Bug bounty payout** - the familiar case, and the most crowded lane | accepted finding fingerprint | a fixed bug stops being a permanent indexed target | works |

## What the live vault covers

Deadlines, `cancel`, `refundExpired`, open claiming, one-argument `release`, `commitEvidence`,
and contests: `createContest`, `enterContest` / `registerEntrant`, and `award` which splits the
escrow across registered entrants in one transaction.

## Why bounties are not the headline

Bounties are the easiest situation to demo in ninety seconds and the only one whose evidence can be
produced live on stage. They are also the most crowded framing in the market, which makes them a bad
way to introduce a rail whose interesting property is the *gate*, not the listing. They appear as one
card of six, last, and labelled as crowded.

## Where the app exposes this

- `/` - six situations, all live on the deployed vault.
- `/evidence` - public re-run of the Arkiv gate for any deal id. No wallet.
- `/app` onboarding - pick a situation, then a side; the profile stores it in `localStorage`.
- `/app`, `/app/rewards`, `/app/settings` - nouns and guidance follow the selected situation
  ("milestone", "disclosure payout", "task"), while the contract and the gate stay identical.

Changing the situation changes wording only. It does not change which contract is called or what the
gate checks - that is deliberate, so the vocabulary can never imply a capability the vault lacks.
