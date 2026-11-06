# ClearAudit

**Evidence-gated settlement.** Money leaves escrow only when a live, publicly verifiable,
auto-expiring evidence record matches the terms — so a pseudonymous party can be paid without a
platform vouching for them. Bug bounties are the demo; the rail is the product
([`docs/POSITIONING.md`](docs/POSITIONING.md)).

Companies fund a reward in USDC. A researcher submits a finding that never leaves their browser.
When the finding is accepted, the money is already on-chain and moves in one transaction — no
invoices, no KYC queue, no custody.

Live on **Arc Testnet** (chain `5042002`), where USDC is the gas token. Built for ETHGlobal Mumbai with
all three core partners load-bearing rather than decorative: **Arc** (settlement + Arc Studio
deployment), **Arkiv** (expiring evidence anchors that gate every payout) and the **Ethereum
Foundation** Alternative Mempool (EIP-8141 sponsored settlement, proven end to end on devnet).

- Marketing site: `frontend/src/app/page.tsx`
- App: `/app` → Overview · `/app/rewards` · `/app/payouts` · `/app/gasless` · `/app/settings`

## Submitting for (ETHGlobal Mumbai)

| Partner | Track we are entering | Project page |
| --- | --- | --- |
| Arc | **Best DeFi / Onchain Finance App Built End to End in Arc Studio** | <https://studio.arc.io/app/3505cc60-6a37-442c-8b75-9a4d516007c1> |
| Arkiv | **New app whose data lives in Arkiv** | App id `3505cc60-6a37-442c-8b75-9a4d516007c1`; track notes in [`arkiv/`](arkiv/) |
| Ethereum Foundation | **Alt mempool for EIP-8141 frame transactions** (one EF prize only) | `/app/gasless`, `docs/EIP8141.md` |

Every contract in this repository was written, tested and deployed inside the Arc Studio session
above; `npx arc-studio deployments --session clearaudit` lists the deployment. The Studio project URL
requires an Arc Studio login, which is why `deployments.json` and `npm run verify:chain` also prove
the same deployment from public RPC without it.

---

## The problem

Bug bounty platforms are the most trusted route for disclosing a vulnerability, and they still take
around 10% of the payout and require identity verification before a researcher sees a cent. Small
security teams can't justify that overhead, so they run informal disclosure over email and pay late.

ClearAudit is the escrow and the receipt. The company keeps control of approval; the chain keeps
control of the money.

## How it works

```
Company                    ClearAudit                     Researcher
   │                            │                              │
   ├─ fund reward (USDC) ──────►│  BountyVault locks funds     │
   │                            │◄──── finding fingerprint ─────┤ (hash only, 30-day TTL)
   ├─ approve & release ───────►│  one transfer, no double-pay │
   │                            │─────────────────────────────►│ paid in USDC
```

1. **Fund.** The company names a researcher wallet and locks the amount in the vault. The recipient
   is fixed at funding time, so the money can't be redirected later.
2. **Report.** The researcher writes the finding in the browser. If they choose a passphrase, it is
   encrypted with AES-GCM locally; only a SHA-256 fingerprint and a severity are anchored, with a
   30-day expiry.
3. **Release.** The company approves and one transaction pays the researcher.
4. **Dispute.** Either side can freeze a reward. An immutable arbitrator resolves it to exactly one
   party. There is no upgrade key and no admin withdrawal path.

## Deployed and verified

| Contract | Address |
| --- | --- |
| `BountyVault` | [`0x283776AB6c2B139d6097285821AC5EdDe43e115e`](https://explorer.testnet.arc.io/address/0x283776AB6c2B139d6097285821AC5EdDe43e115e) |
| `USDCPaymaster` | [`0xEFFD38f3768c3A77E14424a8033c4CE3F91Fba2B`](https://explorer.testnet.arc.io/address/0xEFFD38f3768c3A77E14424a8033c4CE3F91Fba2B) |
| `ClearAuditDeployer` | [`0x8fcC1436147BF48eCF57C0B4609B5380E7b5756a`](https://explorer.testnet.arc.io/address/0x8fcC1436147BF48eCF57C0B4609B5380E7b5756a) |
| USDC (ERC-20 view) | `0x3600000000000000000000000000000000000000` |
| ERC-4337 EntryPoint v0.7 | `0x0000000071727De22E5E9d8BAf0edAc6f37da032` |

Deployment transaction:
[`0x201d71d90b110fb3d321f3b86591ab07096b646986632bf044082e1cca12b145`](https://explorer.testnet.arc.io/tx/0x201d71d90b110fb3d321f3b86591ab07096b646986632bf044082e1cca12b145)

Wiring is re-read over public RPC by `npm run verify:chain` — the vault's token is the native USDC
ERC-20 interface, the paymaster points at the vault and uses EntryPoint **v0.7**
(`PackedUserOperation`), and the paymaster owner is the deployer contract. Full record in
[`deployments.json`](deployments.json).

> **What the paymaster actually does, stated plainly:** `USDCPaymaster` is deployed, wired and
> verified on Arc, but **no product flow routes a `UserOperation` through it**. The company signs
> `releaseBounty` directly (it pays the USDC gas itself), and the researcher never transacts at all,
> so a researcher needs no gas token without any sponsorship involved. The sponsored-settlement path
> is the EF devnet artifact (`/app/gasless`), where an EIP-8141 PAYMENT frame pays the fee. We are not
> claiming 4337 sponsorship on Arc.

> **Arbitrator custody, stated plainly:** the immutable arbitrator is the Arc Studio deploy wallet
> (`0x5B12…Ef42`), shared by every Arc Studio project. Its key is not held by this repository. A
> disputed bounty therefore needs that wallet to act; nothing else can resolve it. This is a
> property of the current deployment, and [`docs/DEPLOYMENT.md`](docs/DEPLOYMENT.md) explains how a
> fresh deploy can set a project-held arbitrator.

## Known limitations

The ones a reviewer will find, stated first:

- **An open bounty cannot be cancelled.** `BountyVault` has no `cancelBounty`: funds leave an open
  bounty only through `releaseBounty`, or through `disputeBounty` → `resolveDispute(false)`. That is
  acceptable for a demo where the company controls approval, and it is the first thing to fix before
  the vault holds real money — see [`docs/POSITIONING.md`](docs/POSITIONING.md).
- **The arbitrator is the Arc Studio deploy wallet** (paragraph above): a dispute needs that wallet.
- **No upgrade path and no admin withdrawal**: deliberate, but it means a bug is not patchable in
  place.
- **The mailbox is read-only.** A researcher learns that a bounty exists by being told; there is no
  open-application flow.
- **Single-payee bounties only.** No partial releases, no milestone tranches, no multi-claimant
  contests.

## Run it

```bash
npm install
npm --prefix frontend install
npm run build       # regenerates the ABI from abi/ and builds the app
npm run verify:chain # independent read-only checks against Arc
npm start           # http://localhost:3000
```

Create `frontend/.env.local`:

```ini
# public
NEXT_PUBLIC_ARC_RPC_URL=https://rpc.testnet.arc.io
NEXT_PUBLIC_VAULT_ADDRESS=0x283776AB6c2B139d6097285821AC5EdDe43e115e
NEXT_PUBLIC_PAYMASTER_ADDRESS=0xEFFD38f3768c3A77E14424a8033c4CE3F91Fba2B
NEXT_PUBLIC_USDC_ADDRESS=0x3600000000000000000000000000000000000000

# server only — never prefix these with NEXT_PUBLIC_
ARKIV_PRIVATE_KEY=
ARKIV_ACCESS_KEY=
PROTOCOL_PRIVATE_KEY=
REQUIRE_ARKIV_ANCHOR=true
```

`ARKIV_ACCESS_KEY` is free at <https://hub.arkiv.network/access-keys>. Without it the SDK still
works but falls back to the public endpoint, which is heavily rate limited.

## Security model

- **Secrets stay server-side.** No private key is reachable from the browser bundle; the app never
  signs for a user.
- **The chain is the source of truth.** Every balance, status and recipient in the UI is read from
  `BountyVault` through `/api/state`. There is no seeded or demo data in the app.
- **Recipient is immutable per reward.** `createBounty` records the researcher. `releaseBounty`
  cannot pay anyone else.
- **No double payment.** Status transitions are enforced on-chain; a released reward cannot be
  released or disputed again.
- **Fail-closed anchoring on the payout path.** `POST /api/release-guard` is called before the
  wallet is asked to sign `releaseBounty`, and the UI disables the button when no live anchor
  exists. The guard re-reads the deal from Arc and requires the anchor's researcher, company and
  amount to match the chain. The same policy gates `/api/claim` on the EF devnet.
- **Rate-limited.** `/api/claim` is throttled to 5 requests/minute per IP, and `/api/reports`
  refuses to replace an existing live anchor in place.

## Repository layout

```
abi/                 committed contract ABIs (source of truth for the app)
arkiv/               Arkiv track notes: schema, usage, rationale, reach, friction
contracts/           Solidity sources + Foundry tests (pulled from the Arc Studio workspace)
docs/                architecture, deployment, audit, roadmap, positioning, EIP-8141 notes
frontend/            Next.js 16 app (marketing site + product)
scripts/gen-abi.mjs  regenerates frontend/src/lib/abi.ts
scripts/verify-deployment.ts  independent on-chain verification (npm run verify:chain)
deployments.json     every deployed address, with the verification record
```

Deployment is done **only** through Arc Studio (`npx arc-studio run … --session clearaudit`). The
contracts are copied back into `contracts/` so the repository is self-contained and judge-reviewable;
see [`docs/DEPLOYMENT.md`](docs/DEPLOYMENT.md). Foundry tests need `forge install foundry-rs/forge-std`
(the `lib/` directory is intentionally not vendored).

## Research artifacts

- **EIP-8141 alt-mempool sponsorship** — the EF track artifact. A reference vault on devnet (`1337`)
  proves a release can be paid without the researcher holding gas, using a frame transaction with a
  sponsored PAYMENT frame. It is reproducible three ways: the `/app/gasless` page (call the live
  route), `POST /api/claim`, and `npx tsx scripts/claim.ts`. Reference transaction hashes are listed
  in `deployments.json` and on the page. Design and trade-offs: [`docs/EIP8141.md`](docs/EIP8141.md).
- **Arkiv** — anchors report fingerprints with a 30-day lifetime and is a hard dependency of payout:
  see `arkiv/` for the schema, the rationale and the friction log.

## Partner tracks

| Partner | What it does in ClearAudit |
| --- | --- |
| Arc | USDC-native vault, conditional escrow, dispute state machine, deployed end to end in Arc Studio (the wired `USDCPaymaster` is not in the product path — see above) |
| Arkiv | Expiring report anchors; every release is refused without a live anchor that matches the chain |
| Ethereum Foundation | EIP-8141 frame transaction on the Alternative Mempool: sponsored settlement with no EntryPoint and no researcher gas |

## Arkiv

Arkiv is not a log. `POST /api/release-guard` and `POST /api/claim` both refuse to settle unless a
live, chain-scoped Arkiv entity matches the on-chain deal's researcher, company and amount. Delete
Arkiv and the vault becomes a pay-anyone faucet, which is why the guard is fail-closed rather than
defensive-in-depth.

- **Entity writer:** `0x65B555dDAd787B66F3F1E4Dd4Ff814D11B9A0ed2` (Rabdi testnet, chain `7794095`).
  This key is server-only; it never reaches the browser bundle.
- **Schema:** `bounty_reports`, one entity kind `zero_day_report`, 30-day expiration.
- **Query you can run:**

  ```bash
  npm run arkiv:anchors                 # live anchors scoped to Arc (5042002)
  npm run arkiv:anchors -- 1337         # live anchors on the EF devnet artifact
  npm run arkiv:anchors -- 5042002 0    # one deal
  ```

  It is the same filter the payout guard uses:
  `kind = str('zero_day_report') AND chainId = u64(5042002) AND expiresAt > u64(now)`, plus
  `dealId = u64(N)` for a single bounty.
- **Submission notes for the track:** [`arkiv/schema.md`](arkiv/schema.md),
  [`arkiv/how-you-use-arkiv.md`](arkiv/how-you-use-arkiv.md),
  [`arkiv/why-arkiv.md`](arkiv/why-arkiv.md), [`arkiv/reach.md`](arkiv/reach.md),
  [`arkiv/friction.md`](arkiv/friction.md).
- **Prerequisite:** the writer needs a little tGLM on Rabdi (<https://hub.arkiv.network/faucet>).
  With a zero balance, `POST /api/reports` answers `503` with the funding link instead of failing
  obscurely, and settlements stay blocked.

### What existed before Mumbai, and what we added

Everything in this repository was written at ETHGlobal Mumbai. There is no pre-existing ClearClaim
codebase in the submission: the previous working name was dropped, the contracts were rewritten
around a two-party escrow with a dispute state machine, and the frontend, the Arkiv layer and the
EIP-8141 artifact were built during the event. What we added at the event, specifically:

| Area | Work done at Mumbai |
| --- | --- |
| Contracts | `ClearAuditDeployer`, `BountyVault`, `USDCPaymaster`, Foundry test suite, Arc Studio deployment and `npm run verify:chain` |
| Arkiv | Schema design, writer path, chain-scoped anchors, fail-closed release guard, read-only query script |
| EF track | Frame-transaction builder, sponsored PAYMENT frame, alt-mempool devnet deployment, reproducible claim script |
| Frontend | Marketing site, company/researcher flows, gasless demo page, honest 0%-fee pricing |

### How we used AI

AI assistance (Claude, via a coding agent) was used to draft Solidity and TypeScript, to write
tests, and to review our own security assumptions. Every deployment step went through Arc Studio,
and every address in `deployments.json` is independently re-verified against the chain by
`npm run verify:chain`, so nothing in the submission rests on an AI claim that was not executed.
The audit that drove the work — including the findings we dismissed — is in [`docs/AUDIT.md`](docs/AUDIT.md).

## CROPS

- **C — censorship resistance.** What a user depends on us for: the frontend is a static build that
  can be served anywhere, and product reads go to Arc over public RPC with no database of ours in the
  path. The parts that are ours and can refuse service: the Next.js API routes (`/api/reports`,
  `/api/release-guard`, `/api/claim`), the Arkiv writer key, and the devnet relayer key. If they go away, existing rewards can still be read and
  released from any wallet by calling `BountyVault` directly — but the Arkiv-gated guard is ours, so
  a customer would have to run their own copy (the schema and query are in `arkiv/schema.md`).
- **O — open source.** MIT (`LICENSE`), and the repo builds from itself: `npm install && npm run
  build`. Contracts are the sources we deployed, and `npm run verify:chain` re-derives the wiring
  from public RPC, so a fork can check the binary rather than trust us.
- **P — privacy.** What each third party learns: the **RPC provider** sees every address the app
  reads and which vault is being queried; **Arc** sees the bounty, the researcher address and the
  amount, by construction; **Arkiv (Rabdi)** sees the report fingerprint, the two wallets and the
  amount, and keeps it 30 days; our **server** sees the report ciphertext only if the researcher
  chooses server-side encryption, and never sees the passphrase. No analytics, no trackers, no
  third-party scripts in the client (fonts are self-hosted from the build by `next/font`). The report
  body never leaves the browser unless the researcher exports it.
- **S — security.** The Arkiv writer key and the devnet relayer key are server-only, never
  `NEXT_PUBLIC_`, and the browser is never asked to sign for someone else. Report bodies are
  AES-GCM encrypted with a passphrase the server never sees; only a SHA-256 fingerprint is anchored.
  The vault has no admin withdrawal, no upgrade key and no fee; the recipient is fixed at funding
  time. The threat model and the pre-build audit are in `docs/ARCHITECTURE.md` and `docs/AUDIT.md`.

## License

MIT.
