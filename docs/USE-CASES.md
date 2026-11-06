# Use cases: what this rail is for

The product is the settlement rule, not a marketplace. `BountyVault` escrows one fixed amount to one
fixed address, released by the funder's assertion, with a dispute fork to a named arbitrator — and
refuses the release unless a live, chain-scoped, matching Arkiv anchor exists.

That rule fits six situations. The app asks which one you are in at onboarding and renames its own
vocabulary around it (`frontend/src/lib/usecases.ts` is the single source of truth for the landing
page, onboarding and the workspace copy).

| # | Situation | Evidence anchor | Why expiry matters | Fit today |
| --- | --- | --- | --- | --- |
| 1 | **Post-exploit recovery settlement** — funds return against a negotiated delivery bounty | attestation that funds reached the recovery address | the negotiation window closes; the record stops existing | **needs V2** |
| 2 | **CVD / PSIRT disclosure payouts** — a programme pays a reporter it cannot KYC in time | accepted report fingerprint | the legal retention window, mapped onto the anchor | works |
| 3 | **Retainer milestones** — a security firm paid per deliverable | artefact hash (report, patch review, threat model) | the engagement's confidentiality window | works |
| 4 | **Machine-to-machine tasks** — an agent or producer paid for an artefact | artefact hash written by the producer | task records stop existing after retention | works |
| 5 | **Contest judgement** — a named judge resolves a prize | winning submission fingerprint | the NDA / embargo window | **needs V2** |
| 6 | **Bug bounty payout** — the familiar case, and the most crowded lane | accepted finding fingerprint | a fixed bug stops being a permanent indexed target | works |

## What "needs V2" means, concretely

The deployed vault has **no `deadline`, no `cancelBounty`, no partial release, one fixed payee**.

- Recovery settlement (#1) is the strongest commercial fit and the one that cannot ship on today's
  contract: if the funds never arrive, the protocol's capital is locked forever. It is marked, not
  sold.
- Contests (#5) need multi-claimant payouts. Today one escrow pays exactly one address.

Both are a fresh deploy, not an upgrade — the vault has no proxy.

## Why bounties are not the headline

Bounties are the easiest situation to demo in ninety seconds and the only one whose evidence can be
produced live on stage. They are also the most crowded framing in the market, which makes them a bad
way to introduce a rail whose interesting property is the *gate*, not the listing. They appear as one
card of six, last, and labelled as crowded.

## Where the app exposes this

- `/` — six situations, with the contract gap on the two that have one.
- `/app` onboarding — pick a situation, then a side; the profile stores it in `localStorage`.
- `/app`, `/app/rewards`, `/app/settings` — nouns and guidance follow the selected situation
  ("milestone", "disclosure payout", "task"), while the contract and the gate stay identical.

Changing the situation changes wording only. It does not change which contract is called or what the
gate checks — that is deliberate, so the vocabulary can never imply a capability the vault lacks.
