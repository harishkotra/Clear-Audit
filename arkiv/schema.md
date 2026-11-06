# Schema - ClearAudit on Arkiv

One schema, two entity kinds, everything scoped by chain.

**Network:** Rabdi testnet, chain id `7794095`
**Writer:** `0x65B555dDAd787B66F3F1E4Dd4Ff814D11B9A0ed2` (server-only key)
**SDK:** `@arkiv-network/sdk` 1.0.1

## `bounty_reports`

| Attribute | Type | Queried? | Meaning |
| --- | --- | --- | --- |
| `kind` | `str` | **yes** | `zero_day_report` - the discriminator every query starts with |
| `chainId` | `u64` | **yes** | `5042002` (Arc) or `1337` (EF devnet artifact). Both chains have a deal #0 |
| `dealId` | `u64` | **yes** | `BountyVault.nextDealId` counter - the join key to the chain |
| `protocolWallet` | `addr` | no | Company that funded the bounty (checked against `deal.company`) |
| `whitehatWallet` | `addr` | no | Recorded beneficiary (checked against `deal.researcher`) |
| `amount` | `u64` | no | Bounty amount in token base units (checked against `deal.amount`) |
| `encryptedPayloadHash` | `str` | no | `bytes32` hash of the encrypted report; the body is never on Arkiv |
| `severity` | `str` | no | `critical` \| `high` \| `medium` \| `low` |
| `expiresAt` | `u64` | **yes** | Unix seconds, mirrored from the entity TTL so a query can filter on it |
| `criteriaHash` | `str` | no | keccak of the acceptance-criteria text, or `0x00..00` when the deal has none. The release guard refuses if the deal's hash is set and this field does not match. |
| `ref` | `str` | **yes** | Public short code cut from the Arkiv entity key (`CA-XXXXXXXX-YYYY`). Written at create so `/evidence?ref=…` can resolve without knowing the vault counter. Legacy anchors without this field still resolve by matching `$key`. |

**Owner:** the writer wallet. No user signs an Arkiv transaction, so an entity cannot be edited by a
company or a researcher - only created by the protocol, and only once per deal while it is live
(a second anchor for the same deal with a different hash is refused with `409`).

**Expiration:** 30 days, set with `ExpirationTime.fromDays(30)`. It is not a cron job: Rabdi stops
serving the entity. `expiresAt` duplicates the TTL so the guard can filter on it without trusting
the clock of the reader.

**Payload:** none. Arkiv stores the anchor; the ciphertext lives with the protocol.

## The query we run

The payout guard's whole admission test, runnable as `npm run arkiv:anchors -- 5042002 0`:

```ts
const page = await client.query(
  [
    "kind = str('zero_day_report')",
    `chainId = u64(${chainId})`,
    `dealId = u64(${dealId})`,
  ].join(" AND "),
  {
    select: { $key: true, $expiresAt: true, dealId: true, whitehatWallet: true, amount: true, criteriaHash: true },
    limit: 100,
  },
);
```

Then, in the backend, three more checks that are cheaper as code than as a query:

```ts
if (!anchor) reject("No live Arkiv anchor");
if (Number(anchor.$expiresAt) <= now) reject("Anchor expired");
if (anchor.whitehatWallet !== deal.researcher) reject("Anchor does not name this researcher");
if (anchor.protocolWallet !== deal.company) reject("Anchor does not name this company");
if (BigInt(anchor.amount) !== deal.amount) reject("Anchor amount does not match the bounty");
if (deal.criteriaHash !== bytes32(0) && anchor.criteriaHash !== deal.criteriaHash)
  reject("Acceptance criteria do not match");
```

## Why `chainId` is an attribute and not a namespace

The EF track runs a second vault on chain `1337` with its own `dealId` counter starting at 0. Without
`chainId`, an anchor written for the devnet demo would satisfy the guard for Arc deal #0 - a
cross-network payout. Adding the attribute was a two-line change to the schema and one clause to the
query; it is the difference between "evidence exists" and "evidence exists *for this bounty*".
