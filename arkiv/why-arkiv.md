# Why Arkiv

If the anchors sat in Postgres, three things would break - and all three are things a user notices.

## 1. The retention window would be a promise, not a property

A zero-day report is dangerous while unpatched and embarrassing forever after. Our rule is that the
evidence fingerprint lives 30 days and then does not exist.

In Postgres that is `DELETE FROM reports WHERE created_at < now() - interval '30 days'` in a cron
job: one failed deploy, one paused worker, one restored backup, and the window silently becomes
"forever". On Arkiv it is `ExpirationTime.fromDays(30)` enforced by the storage layer - the entity
stops being served whether or not our code runs. We do not have to be trusted to delete it.

The user-visible consequence: the countdown on the reward card and the "Anchor required" release
button are backed by the same clock that deletes the data. They cannot disagree.

## 2. The join key would be ours alone

`dealId` ties evidence to an on-chain bounty. If the mapping lived in our database, then "does this
bounty have evidence?" would be answered by our server, and a company could be paid out on our word.
On Arkiv the anchor is written by a wallet, is publicly queryable by `(chainId, dealId)`, and is
readable by anyone who wants to check whether we paid a bounty with or without evidence. The chain
says who gets paid; Arkiv says what evidence justified it; neither is our private table.

## 3. There would be no independent third copy

A judge, an auditor or a competing protocol can run the query in `arkiv/schema.md` against Rabdi and
see the anchors for themselves. With Postgres the same claim is "trust our API". Given that
ClearAudit's whole pitch is that a researcher gets paid without trusting the company, having the
evidence layer be *our* database would undercut the product.

## What we kept off Arkiv, and why

- The report body: Arkiv is public. Only a hash goes on it.
- Escrow and disputes: those need atomicity and a token, so they live in `BountyVault` on Arc.
- Payout receipts: the chain has them already; a second copy with a 30-day expiry would be a worse
  record than the one we already have.

## The test we applied

Remove Arkiv and ask what the product does. Answer: `POST /api/release-guard` has nothing to check,
so the company can release a bounty to any address, and the researcher's protection becomes
"trust the company". That is the exact failure ClearAudit exists to remove, which is why the guard is
fail-closed and the override is a logged, off-by-default development flag.
