# ClearAudit

**Evidence-gated settlement.** Money leaves escrow only when a live, publicly verifiable,
auto-expiring evidence record matches the terms - so a pseudonymous party can be paid without a
platform vouching for them. Bug bounties are the demo; the rail is the product
([`docs/POSITIONING.md`](docs/POSITIONING.md)).

One side locks a fixed amount in USDC. The other delivers an artefact that is anchored as a hash with
a 30-day expiry. The payout clears only if a live anchor matches the payee, the funder and the
amount, so the money moves in one transaction - no invoice, no KYC queue, no custody, no platform
deciding. Bug bounties are one of six situations we document; the rail is what the other five have in
common ([`docs/USE-CASES.md`](docs/USE-CASES.md), [`docs/POSITIONING.md`](docs/POSITIONING.md)).

ClearAudit can also act as the agent itself: the lister names the operator address as payee, the app
runs inference through an OpenAI-compatible endpoint (`AGENT_API_BASE_URL`, `AGENT_MODEL`,
`AGENT_API_KEY`, all server side), hashes the deliverable, anchors the hash, and the funder releases.
That is a service fee earned as a payee, not a protocol fee, because the vault has no fee switch and
the release path cannot be redirected. It works on the deployed vault today.

A lister can also leave the payee open so any agent claims the task instead of waiting for a human
to accept it and vanish. That path is live on the v2 vault: `createOpenTask`, `claimTask`, a
mandatory deadline and `refundExpired`. See [`docs/AGENT-DISPATCH.md`](docs/AGENT-DISPATCH.md).

Live on **Arc Testnet** (chain `5042002`), where USDC is the gas token. Built for ETHGlobal Mumbai with
all three core partners load-bearing rather than decorative: **Arc** (settlement + Arc Studio
deployment), **Arkiv** (expiring evidence anchors that gate every payout) and the **Ethereum
Foundation** Alternative Mempool (EIP-8141 sponsored settlement, proven end to end on devnet).

- Marketing site: `frontend/src/app/page.tsx` - mechanism first, then six situations, then what we
  refuse to claim
- App: `/app` → Overview · `/app/rewards` · `/app/payouts` · `/app/gasless` · `/app/settings`
- Public evidence (no wallet): `/evidence?dealId=0`

## Submitting for (ETHGlobal Mumbai)

| Partner | Track we are entering | Project page |
| --- | --- | --- |
| Arc | **Best Smart Contracts with Advanced Stablecoin Logic** (lead) and **Best DeFi / Onchain Finance App**, both built in Arc Studio | <https://studio.arc.io/app/3505cc60-6a37-442c-8b75-9a4d516007c1> |
| Arkiv | **New app whose data lives in Arkiv** | App id `3505cc60-6a37-442c-8b75-9a4d516007c1`; track notes in [`arkiv/`](arkiv/) |
| Ethereum Foundation | **Alt mempool for EIP-8141 frame transactions** (lead). **CROPS** is the backup if the booth asks for a public-mempool kill: `/evidence` plus the application gate. One EF prize only. | `/app/gasless`, `/evidence`, `docs/EIP8141.md` |

Every contract in this repository was written, tested and deployed inside the Arc Studio session
above; `npx arc-studio deployments --session clearaudit` lists the deployment. The Studio project URL
requires an Arc Studio login, which is why `deployments.json` and `npm run verify:chain` also prove
the same deployment from public RPC without it.

---

## The problem

Bug bounty platforms are the most trusted route for disclosing a vulnerability, and they still take
around 10% of the payout and require identity verification before a researcher sees a cent. Small
security teams can't justify that overhead, so they run informal disclosure over email and pay late.

ClearAudit is the escrow and the receipt. The payer keeps control of approval; the chain keeps
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

1. **Fund.** The payer names a payee and locks the amount in the vault, or opens the task to any
   agent with a deadline. The payee is fixed at funding (or claim) time, so the money cannot be
   redirected later.
2. **Report.** The researcher writes the finding in the browser. If they choose a passphrase, it is
   encrypted with AES-GCM locally; only a SHA-256 fingerprint and a severity are anchored, with a
   30-day expiry.
3. **Release.** The payer approves and one transaction pays the payee. `release(id)` names no
   recipient, so there is nothing to get wrong at payout time.
4. **Dispute.** Either side can freeze a reward. An immutable arbitrator resolves it to exactly one
   party. There is no upgrade key and no admin withdrawal path.

## Deployed and verified

| Contract | Address |
| --- | --- |
| `BountyVault` v3 (live) | [`0x2334493e0EeD42b0E45fF8E64862dBDA50A41772`](https://explorer.testnet.arc.io/address/0x2334493e0EeD42b0E45fF8E64862dBDA50A41772) |
| USDC (ERC-20 view) | `0x3600000000000000000000000000000000000000` |
| Arbitrator | `0x65B555dDAd787B66F3F1E4Dd4Ff814D11B9A0ed2` |
| Challenge window | 300 seconds |

v3 deployment transaction:
[`0x31a80755a47ccdeb1fd8a29337e8f14a08ea913c78989f7b6030ee4800723f7c`](https://explorer.testnet.arc.io/tx/0x31a80755a47ccdeb1fd8a29337e8f14a08ea913c78989f7b6030ee4800723f7c)
(block 71035461, 1776686 gas). `release(id)` now requires `commitEvidence`. Anyone may `settleAfterChallenge` after 5 minutes.

v2 (`0xf6aD45A5…Ca593`) and v1 (`0x2837…115e` + `USDCPaymaster`) remain on chain and readable. Sources: `contracts/legacy/BountyVaultV2.sol`, `contracts/legacy/BountyVaultV1.sol`.

## Proven on chain, not asserted

| Step | Evidence |
| --- | --- |
| Deploy v3 vault | tx `0x31a80755…3f7c`, block 71035461, `challengeWindow = 300` |
| Fund v3 #0 (5 USDC, named, criteria) | tx `0x2bacbe4d…45c8`, status Open |
| Fund v3 #1 (1 USDC, no anchor) | tx `0xbdb88842…478b` — guard 403 |
| Fund v3 #2 (open task, 2 USDC, 2h) | tx `0xb80b8f09…8a19`, payee unset |
| Fund v3 #3 (3.5 USDC) + Arkiv + commitEvidence | create `0x54db3731…bbb2`, commit `0x5dfbd6b5…f7a6`, `canSettle(3)=true` |
| Direct `release(1)` with no evidence | reverts `EvidenceMissing` |
| v2 historical payout | vault `0xf6aD45A5…`, deal #0 Released in `0x39711950…1347` |

`npm run verify:chain` re-reads all of this from the chain and exits non-zero on any mismatch (18
checks). Full record in [`deployments.arc.json`](deployments.arc.json).

The checks are read-only and need no keys: chain id, code presence, the deployment receipt and its
block, `token()`, `arbitrator()`, `paymaster() == 0`, the shape of `release` in the ABI, the presence
of `createOpenTask`/`claimTask`/`refundExpired`/`cancel`/`assignPayee`, and the state of deal #0.

> **What the paymaster actually does, stated plainly:** the v1 `USDCPaymaster` is deployed, wired and
> verified on Arc, but **no product flow routes a `UserOperation` through it**, and v2 has no fee path
> for one to sponsor: `release` moved the whole amount to the payee, so the vault takes nothing and
> needs no paymaster at all (`paymaster() == 0`). The payer signs `release` directly and pays the USDC
> gas itself, and the payee never transacts, so a payee needs no gas token without any sponsorship. The sponsored-settlement path
> is the EF devnet artifact (`/app/gasless`), where a frame transaction pays the fee from the protocol
> relayer's account. That devnet's current revision accepts only one `VERIFY` frame and will not let a
> contract paymaster be the payer, so the deployed `SponsorPaymaster` is unused there too - see
> [`docs/EIP8141.md`](docs/EIP8141.md). We are not claiming 4337 sponsorship on Arc.

> **Arbitrator custody, stated plainly:** the immutable arbitrator in the live v2 vault is the
> project wallet `0x65B5…0ed2`, which this repository can operate through `.env.local`. The first
> deployment used the shared Arc Studio wallet (`0x5B12…Ef42`), whose key is not in this repo, which
> is why the second deployment moved the role to a wallet we control. A disputed deal therefore needs
> that key to resolve; nothing else can.

## Known limitations

The ones a reviewer will find, stated first:

- **A claimed task cannot be cancelled by the payer.** Once a payee claims an open task, the payer's
  only routes are `dispute` -> arbitrator, or waiting for the deadline and calling `refundExpired`.
  That is the price of not letting the payer yank work out from under an agent mid-delivery, and it
  is worth stating before the vault holds real money - see [`docs/POSITIONING.md`](docs/POSITIONING.md).
- **Arbitration needs the arbitrator key** (paragraph above): a disputed deal waits for that wallet.
- **No upgrade path and no admin withdrawal**: deliberate, but it means a bug is not patchable in
  place.
- **Discovery is out of band.** A task exists on chain and is readable by any agent, but nothing
  tells an agent to look. Discovery is the open problem, not a solved one.
- **One payee per task.** No partial releases, no milestone tranches, no multi-claimant contests on
  the same escrow.
- **`release(id)` requires committed evidence on v3.** A payer who skips `commitEvidence` reverts
  on chain. `/api/release-guard` and `/evidence` still re-check the Arkiv anchor. See
  [`docs/DEMO.md`](docs/DEMO.md).

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
NEXT_PUBLIC_VAULT_ADDRESS=0x2334493e0EeD42b0E45fF8E64862dBDA50A41772
NEXT_PUBLIC_PAYMASTER_ADDRESS=0x0000000000000000000000000000000000000000
NEXT_PUBLIC_ARBITRATOR_ADDRESS=0x65B555dDAd787B66F3F1E4Dd4Ff814D11B9A0ed2
NEXT_PUBLIC_USDC_ADDRESS=0x3600000000000000000000000000000000000000

# server only - never prefix these with NEXT_PUBLIC_
ARKIV_PRIVATE_KEY=
ARKIV_ACCESS_KEY=
REQUIRE_ARKIV_ANCHOR=true

# operator agent (optional, see docs/AGENT-DISPATCH.md)
AGENT_API_BASE_URL=https://api.particle.ai/v1
AGENT_MODEL=deepseek-v41-flash-1017
AGENT_API_KEY=
AGENT_MAX_TOKENS=1600
OPERATOR_ADDRESS=
```

`ARKIV_ACCESS_KEY` is free at <https://hub.arkiv.network/access-keys>. Without it the SDK still
works but falls back to the public endpoint, which is heavily rate limited.

## Security model

- **Secrets stay server-side.** No private key is reachable from the browser bundle; the app never
  signs for a user.
- **The chain is the source of truth.** Every balance, status and recipient in the UI is read from
  `BountyVault` through `/api/state`. There is no seeded or demo data in the app.
- **Recipient is immutable per reward.** `createBounty` records the payee, and `createOpenTask`
  records whoever calls `claimTask` first. `release(id)` takes no recipient at all, so no caller can
  pay anyone else.
- **No double payment.** Status transitions are enforced on-chain; a released reward cannot be
  released or disputed again.
- **Fail-closed anchoring on the payout path.** `POST /api/release-guard` is called before the
  wallet is asked to sign `release`, and the UI disables the button when no live anchor exists. The
  guard re-reads the deal from Arc and requires the anchor's payee, payer and amount to match the
  chain. The same policy gates `/api/claim` on the EF devnet.
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

## Using the app

Every screen under `/app` is a wallet view, so the app asks for a wallet first and shows nothing
until one is signed in. Sign-in goes through **Privy**: one **Connect wallet** button opens Privy's
modal, which offers whichever wallets the visitor actually has (browser extension, mobile app, or an
embedded wallet Privy creates for email sign-ups) and keeps a single session across all of them. We
render no wallet picker of our own, so there is no per-extension handshake to debug. Nothing about a
deal is stored on a server - the signed-in address is the identity, and the optional display profile
lives in `localStorage`.

Configure it with `NEXT_PUBLIC_PRIVY_APP_ID` in `frontend/.env.local` (the app id from the Privy
dashboard - a public identifier, not the app secret). It is inlined at build time, so rebuild after
changing it. Without it the site still renders and `/app` says the wallet layer is unconfigured.

## Research artifacts

- **EIP-8141 alt-mempool sponsorship** - the EF track artifact. A reference vault on devnet (`1337`)
  proves a release can be paid without the researcher holding gas, using an EIP-8141 frame transaction
  whose fee is paid by the protocol relayer. It is reproducible three ways: the `/app/gasless` page (call the live
  route), `POST /api/claim`, and `npx tsx scripts/claim.ts`. Reference transaction hashes are listed
  in `deployments.json` and on the page. Design and trade-offs: [`docs/EIP8141.md`](docs/EIP8141.md).
- **Arkiv** - anchors report fingerprints with a 30-day lifetime and is a hard dependency of payout:
  see `arkiv/` for the schema, the rationale and the friction log.

## Partner tracks

| Partner | What it does in ClearAudit |
| --- | --- |
| Arc | USDC-native vault, conditional escrow, dispute state machine, deployed end to end in Arc Studio (the wired `USDCPaymaster` is not in the product path - see above) |
| Arkiv | Expiring report anchors; every release is refused without a live anchor that matches the chain |
| Ethereum Foundation | EIP-8141 frame transaction on the Alternative Mempool: settlement with no EntryPoint, no bundler, and no researcher gas |

## Arkiv

Arkiv is not a log. `POST /api/release-guard` and `POST /api/claim` both refuse to settle unless a
live, chain-scoped Arkiv entity matches the on-chain deal's payee, payer and amount. Delete
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
| EF track | Frame-transaction builder, alt-mempool devnet deployment, unfunded-researcher release, reproducible claim script |
| Frontend | Marketing site, payer/payee flows, open-agent claiming, gasless demo page, honest pricing |

### How we used AI

AI assistance (Claude, via a coding agent) was used to draft Solidity and TypeScript, to write
tests, and to review our own security assumptions. Every deployment step went through Arc Studio,
and every address in `deployments.json` is independently re-verified against the chain by
`npm run verify:chain`, so nothing in the submission rests on an AI claim that was not executed.
The audit that drove the work - including the findings we dismissed - is in [`docs/AUDIT.md`](docs/AUDIT.md).

## CROPS

- **C - censorship resistance.** What a user depends on us for: the frontend is a static build that
  can be served anywhere, and product reads go to Arc over public RPC with no database of ours in the
  path. The parts that are ours and can refuse service: the Next.js API routes (`/api/reports`,
  `/api/release-guard`, `/api/claim`), the Arkiv writer key, and the devnet relayer key. If they go away, existing rewards can still be read and
  released from any wallet by calling `BountyVault` directly - but the Arkiv-gated guard is ours, so
  a customer would have to run their own copy (the schema and query are in `arkiv/schema.md`).
- **O - open source.** MIT (`LICENSE`), and the repo builds from itself: `npm install && npm run
  build`. Contracts are the sources we deployed, and `npm run verify:chain` re-derives the wiring
  from public RPC, so a fork can check the binary rather than trust us.
- **P - privacy.** What each third party learns: the **RPC provider** sees every address the app
  reads and which vault is being queried; **Arc** sees the bounty, the researcher address and the
  amount, by construction; **Arkiv (Rabdi)** sees the report fingerprint, the two wallets and the
  amount, and keeps it 30 days; our **server** sees the report ciphertext only if the researcher
  chooses server-side encryption, and never sees the passphrase. No analytics, no trackers, no
  third-party scripts in the client (fonts are self-hosted from the build by `next/font`). The report
  body never leaves the browser unless the researcher exports it.
- **S - security.** The Arkiv writer key and the devnet relayer key are server-only, never
  `NEXT_PUBLIC_`, and the browser is never asked to sign for someone else. Report bodies are
  AES-GCM encrypted with a passphrase the server never sees; only a SHA-256 fingerprint is anchored.
  The vault has no admin withdrawal, no upgrade key and no fee; the recipient is fixed at funding
  time. The threat model and the pre-build audit are in `docs/ARCHITECTURE.md` and `docs/AUDIT.md`.

## License

MIT.
