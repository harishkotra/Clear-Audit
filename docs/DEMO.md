# Demo script (4 minutes)

The live v3 vault has named payees, open tasks, deadlines, cancel, refund, dispute, and
`commitEvidence`. Seeded on `0x2334493e…1772`:

- Deal #0 — named 5 USDC. Same terms as the old v2 deal #0, so the historical Arkiv entity still matches. Prefer #3 for a clean v3 loop.
- Deal #1 — named 1 USDC, no Arkiv anchor. Guard 403. Direct `release(1)` reverts `EvidenceMissing`.
- Deal #2 — open task, 2 USDC, ~2h deadline, unclaimed.
- Deal #3 — named 3.5 USDC. Arkiv anchored, `commitEvidence` mined, `canSettle(3) == true`, left Open so the booth can press Release.

## Seed before the booth (needs the payer key + USDC)

1. Fund one **open** unclaimed task with a near deadline (hours, not days) so Claim and
   `refundExpired` are visible.
2. Fund one **named** Open deal and have the payee anchor a finding. Leave it Open so Release
   is a live button, not a history row.
3. Optionally fund a deal whose deadline is already in the past for the refund beat.

Do this from `/app/rewards` as the company profile. Do not reuse deal #0.

## Spoken path

1. **Open task (90 s).** Fund “open to any agent” with a deadline → switch to the agent wallet →
   claim from the Open tasks board → paste a finding → Anchor.
2. **Evidence (45 s).** Open `/evidence?dealId=N` on a second screen. Match. Copy the Arkiv query.
   Then show deal #1: missing anchor.
3. **Release (30 s).** Back on Rewards, Release payment. Explorer: `release(id)`, full amount to
   the stored payee, 0% fee.
4. **Refund (20 s).** On the expired deal, Refund expired. Escrow returns to the payer.
5. **8141 (30 s).** `/app/gasless`. One frame tx on chain 1337. Relayer is `tx.sender`. If the
   booth asks “what if I call the contract?”, answer: v3 `release` reverts without
   `commitEvidence`. `/evidence` is the public re-run.

Q&A (3 min): arbitrator is the project wallet; no 4337 on Arc; contests are later; Arkiv TTL is
30 days on purpose.

## Submission tracks

- Arc: **Best Smart Contracts with Advanced Stablecoin Logic** (lead), DeFi app secondary.
- Arkiv: from-scratch app whose data lives in Arkiv. `/evidence` is the booth page.
- EF: alt mempool (proven). CROPS backup = this page plus the 403 on deal #1.
