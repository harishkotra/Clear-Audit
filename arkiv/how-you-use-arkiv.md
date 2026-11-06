# How we use Arkiv

ClearAudit is escrow for bug bounties: a company funds a reward, a researcher submits a finding, and
the vault pays the researcher — or a dispute freezes it. The finding itself must never be public
while unpatched, and the record must not outlive its usefulness. That makes the evidence layer the
hard part, not the escrow.

Arkiv holds exactly one thing per bounty: a fingerprint of the encrypted report, with an expiry.
Everything else stays off-chain.

## The flow, end to end

1. **Create.** The company creates a bounty on Arc (`BountyVault.createBounty`). Deal id, researcher,
   amount and company now live on-chain. Nothing is on Arkiv yet.
2. **Anchor.** The researcher's client posts the encrypted report to the protocol and calls
   `POST /api/reports`. The server writes one `bounty_reports` entity: `dealId`, `chainId`,
   `whitehatWallet`, `protocolWallet`, `amount`, `encryptedPayloadHash`, `severity`, `expiresAt`,
   with a 30-day TTL.

   ```ts
   await client.createEntity(ReportSchema, attrs, {
     expiration: ExpirationTime.fromDays(30),
   });
   ```

3. **Read.** `GET /api/reports?dealId=N&chainId=5042002` lists live anchors with a countdown in the
   UI. An expired anchor disappears from the list because Rabdi stops serving it, not because we
   filter it out in the browser.
4. **Gate.** Before the wallet is asked to sign `releaseBounty`, `useEscrow.releaseReward` calls
   `POST /api/release-guard`. The route re-reads the deal from Arc and re-reads the anchor from
   Arkiv, then requires:
   - the deal is `Open` with a non-zero researcher,
   - a live anchor exists for `(chainId, dealId)`,
   - the anchor is unexpired,
   - `anchor.whitehatWallet == deal.researcher`,
   - `anchor.protocolWallet == deal.company`,
   - `anchor.amount == deal.amount`.
5. **Settle.** Only then does the company sign. `POST /api/claim` enforces the same gate on the EF
   devnet path, so the sponsored release is not a way around the evidence requirement.

## What each Arkiv feature changes for a user

| Feature | What a user sees because of it |
| --- | --- |
| Attribute filtering (`kind`, `chainId`, `dealId`) | The rewards page shows the anchor for *this* bounty and *this* chain, with no wallet-list API in the middle |
| Entity expiration (30 days) | The countdown on the reward card, and a release button that switches to "Anchor required" when the evidence ages out |
| Owner wallet | A company cannot rewrite its own evidence, and a researcher cannot publish an anchor for a bounty it does not own; the writer is the protocol, and a second conflicting anchor is refused with `409` |
| Query on `expiresAt` | The guard can reject a stale anchor even if a stale reader cached it |
| Payload-free entities | The report body never appears in a public database, only its hash |

## What we deliberately keep off Arkiv

- **The report body.** Arkiv is public and queryable; the finding is encrypted and stored by the
  protocol. Only `encryptedPayloadHash` is anchored.
- **Money.** Escrow, the dispute state machine and the token live in `BountyVault` on Arc. Arkiv is
  not a ledger, and a payout is never decided by an off-chain write.
- **Payout receipts.** The chain already has them; duplicating them onto Arkiv would create a second
  source of truth with a 30-day hole in it.

## Where it is load-bearing

`POST /api/release-guard` and `POST /api/claim` both return `403`/`409` without a matching live
anchor. There is one override, `REQUIRE_ARKIV_ANCHOR=false`, which logs a warning on every use and
exists only for local development. In the shipped configuration the override is off, so an Arkiv
outage is a settlement outage — which is the point: without the anchor the vault has no way to tell a
real researcher from any address the company felt like paying.

## Verify it yourself

```bash
npm run arkiv:anchors                 # live anchors for Arc
npm run arkiv:anchors -- 1337         # live anchors for the EF devnet artifact
curl -s localhost:3000/api/reports | jq
curl -s -X POST localhost:3000/api/release-guard -H 'content-type: application/json' -d '{"dealId":0}'
```

The last call is the honest one: with no anchor (or with a deal that is not `Open`) it answers
`409`/`403` and names the reason.
