# Friction

Everything below happened while building ClearAudit at ETHGlobal Mumbai against Rabdi
(`@arkiv-network/sdk` 1.0.1, chain `7794095`). Each entry says what we expected, what happened, and
how to reproduce it — the entries are ordered by how much they cost us.

## 1. An unfunded writer fails with no diagnosable error

**Expected:** a clear "insufficient balance for gas" error, or a preflight check.
**Happened:**

```
Transaction failed: Execution error without revert data
```

The writer `0xf694…8e40` had `0x0` tGLM. `createEntity` threw the message above, and nothing in it
mentions balance, gas, or the account. We spent time chasing schema errors and query syntax before
checking `eth_getBalance`.

**Repro:** point `ARKIV_PRIVATE_KEY` at an address with zero tGLM on Rabdi and call `createEntity`.

**What would have fixed it:** a preflight `eth_getBalance` inside the SDK, or mapping an
execution-error receipt whose sender balance is zero to `InsufficientFundsForGas`. We now check the
balance ourselves before writing (`arkivWriterStatus()` in `frontend/src/lib/arkiv.ts`) and return a
`503` with the faucet link, but every builder will hit this once.

## 2. The public endpoint's rate limit is invisible until something breaks

**Expected:** if a request is throttled, an error that says so.
**Happened:** the SDK prints one line at client construction —

> Rabdi: no access key, so requests go to the public endpoint, which is heavily rate limited.

— and then behaves normally, until queries start failing or timing out under load. There is no
retry-after, no `429` surfaced to the caller, and no way to tell "no anchors" from "we were
throttled", which is the worst possible ambiguity for a fail-closed guard: both look like "no
evidence" and both block payouts.

**Repro:** run `npm run arkiv:anchors` in a loop from an IP without an access key.

**What would have fixed it:** a distinguishable throttling error (`{ code: "RATE_LIMITED",
retryAfter }`) so an app can retry instead of concluding "the evidence does not exist".

## 3. Entities are create-only, so "one anchor per deal" is a race

**Expected:** a unique constraint, or a conditional create (`create if no live entity matches`).
**Happened:** to keep one anchor per bounty we read first, then write. Two concurrent `POST
/api/reports` calls can both pass the read and both create an entity; the guard then picks
`entities[0]` and the other anchor is silently ignored. We added a `409` when a live anchor with a
different hash already exists, which narrows the window but does not close it — it is still
read-then-write.

**Repro:** fire two `POST /api/reports` requests for the same `dealId` with different hashes in the
same second.

**What would have fixed it:** conditional create, or a uniqueness rule on a chosen attribute set. For
a bounty product this is the single most valuable missing primitive: "there is exactly one live
anchor for this key" is a storage-layer property, and doing it in application code means it is not
actually true.

## 4. Nothing scopes entities to a network

ClearAudit runs on two chains that both start their `dealId` counter at 0. Our first schema used
`dealId` alone, so a devnet anchor satisfied the Arc guard for a different bounty — a cross-network
payout, found in review rather than by a test. We added a `chainId` attribute and a query clause.

That works, but it means every app that spans networks has to invent the same attribute and remember
it in every query, including the ones written later by someone else.

**Repro:** write an entity with `dealId = u64(0)` and no `chainId`, then query for Arc deal 0.

**What would have fixed it:** a first-class namespace (or `chainId` on the entity envelope) that the
query engine applies automatically.

## 5. The schema is client-side only, so agreement is by convention

`defineSchema(...)` is a typed builder in our code. The indexer stores what it is given. That means
the app, the query script and any third-party reader each carry their own copy of the shape, and a
mismatch is discovered at read time — an attribute that is `u64` in one place and `str` in another
just returns no results.

We now define the schema once (`frontend/src/lib/arkiv.ts`) and the read script repeats it
(`frontend/scripts/arkiv-anchors.ts`); a published schema per entity kind that clients could fetch
would have removed the duplication.

## 6. Queries are strings, so they fail at runtime

In 1.0.1 the ergonomic path is a string query —

```ts
client.query("kind = str('zero_day_report') AND chainId = u64(5042002)")
```

— and there is no local validation. A missing quote or the wrong `u64`/`str` cast is a runtime error
against a remote service. Ours did, twice, and the error is a remote one. A typed builder (the same
one `defineSchema` already knows about) would turn those into compile errors.

## 7. Getting set up needs a browser

The faucet and the access key are both web flows (<https://hub.arkiv.network/faucet>,
<https://hub.arkiv.network/access-keys>) — neither has a CLI or an API, and neither can be scripted in
CI. For a hackathon that is fine; for a reproducible test environment it is a manual step in the
middle of an otherwise scripted setup. `docs/DEPLOYMENT.md` and the README both have to tell the
reader "go click this link" before the app works.

## What was *not* friction

Worth saying, because it is why we kept Arkiv:

- Expiration is real. Setting `ExpirationTime.fromDays(30)` and watching the entity disappear from
  queries without deleting anything is the feature we built the product around.
- Attribute filters on `addr` and `u64` behave exactly as documented, including inequality
  (`expiresAt > u64(now)`), so the guard is a single query plus three comparisons.
- Reads are fast enough to sit in front of a wallet signature without a spinner that feels broken.
