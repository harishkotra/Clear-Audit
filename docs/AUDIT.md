# ClearClaim / ClearAudit — Senior Engineering Audit

> **Historical document.** This is the pre-build audit that produced the current scope (2026-11-05).
> Several findings below were fixed afterwards; addresses and file names may be stale. For the
> shipped state use [`README.md`](../README.md), [`deployments.json`](../deployments.json) and
> [`docs/DEPLOYMENT.md`](DEPLOYMENT.md). The "what shipped" section at the end is authoritative.

> **Snapshot notice.** This audit was written against the previous Arc deployment
> (`BountyVault 0xD99e…`, `MockUSDC 0x6402…`). The product has since been redeployed through
> Arc Studio against Arc's native USDC interface: `BountyVault 0x283776…`,
> `USDCPaymaster 0xEFFD38…`, deploy tx `0x201d71d9…`. See `deployments.json`. The findings below
> are kept unedited as a record of what was wrong and why it mattered.

**Date:** 2026-11-06
**Scope:** repo `ethmum-concept-1`, Arc Testnet deployment, EF EIP-8141 alt-mempool devnet, Arkiv Rabdi.
**Verdict:** The contract instincts are good. The submission is not yet a product. There are three
submission-blocking truth problems and one critical key leak. Everything else is fixable in 48h.

---

## 0. What is actually deployed (verified, not assumed)

| Thing | Address | On-chain reality |
|---|---|---|
| `BountyVault` (Arc Testnet 5042002) | `0xD99e9358d13fC13dD1420FCB1C46aB5f6614D10C` | `nextDealId() == 0`, `getDeal(0)` all zero, USDC balance `0` |
| `USDCPaymaster` (Arc) | `0x51d48E5d585d0586ac42fE98b3e17a4CB2B63Fc8` | `vault()`/`usdc()` point at the above. EntryPoint = canonical ERC-4337. **Never exercised by the working flow.** |
| "USDC" (Arc) | `0x64024FcE5D8fdbF7616bB7bB9E0aA58dE1640dBf` | `name() == "Mock USDC"`, 6 decimals. **Not Arc USDC.** |
| `BountyVault` (EF devnet 1337) | `0x8460274B30764c09799f275280CEbA1F1dC5B347` | `nextDealId() == 1`; deal #0 = `Released` (status 3) |
| Demo paymaster (EF devnet) | `0xA03613a311632EEc5a8bE80CeF034d456d4D6F02` | This is `SponsorPaymaster`: *"pays for anyone while it has ETH. Not for production."* |
| EF frame txs in README | `0xec8c…`, `0x3ada…`, `0x17c3…` | All three receipts exist on 1337. Good. |

**Consequence:** the root console shows "10.00 USDC TVL / Deal #0 / 59,638 gas / 9.88 USDC payout"
while the Arc vault is empty and deal #0 does not exist. A judge only has to open the explorer.

**Arc is not Ethereum.** On Arc, USDC is the **native gas token** and native USDC has **18
decimals** (the ERC-20 view uses 6). The repo configures `nativeCurrency: ETH` and escrows a 6-dec
`MockUSDC` ERC-20. That is a direct hit on the Arc bounty thesis ("stablecoin-native").

---

## P0 — submission blockers

### P0-1. Funded private keys are shipped to the browser (and one is hardcoded)

- `frontend/.env.local` defines `NEXT_PUBLIC_PROTOCOL_PRIVATE_KEY`, `NEXT_PUBLIC_WHITEHAT_PRIVATE_KEY`,
  `NEXT_PUBLIC_FREELANCER_PRIVATE_KEY`. **Every `NEXT_PUBLIC_*` variable is inlined into client JS.**
- `NEXT_PUBLIC_PROTOCOL_PRIVATE_KEY` → `0x5544596212F91984C986A919C8026DF0576816f9`, which holds
  `999,802,856,453,569,791,324,359` wei on the EF devnet.
- `frontend/src/app/api/claim/route.ts:11` contains the same key **as a source-code fallback literal**.
- `NEXT_PUBLIC_WHITEHAT_PRIVATE_KEY` → `0x330AAD…F88C`, the "anonymous 0 ETH" whitehat. The demo's
  anonymity is theatre: the key is in the bundle.

**Fix:** rotate all four keys now; delete the literals; remove `.env.local` from any shared artifact;
move signing server-side only; add `gitleaks` to CI; add a build-time check that `NEXT_PUBLIC_` vars
never match `PRIVATE_KEY|SECRET|MNEMONIC`.

### P0-2. The "gasless whitehat claim" is actually the protocol signing

`submitClaim()` always uses `protocolPrivateKey` / `protocolAddress`. `releaseBounty` accepts only
`deal.protocol` or `paymaster` as `msg.sender`, so **the whitehat has no claim path at all**. The
whitehat never signs, never proves key ownership, and the UI button is a server-side protocol
transaction. This inverts the pitch and is the first thing an AA judge will test.

Also: EF devnet deal #0 is already `Released`, so the button now reverts. There is no seed/reset
flow.

**Fix (choose one, document it):**
- A. Whitehat gasless claim: protocol signs an EIP-712 approval `(dealId, whitehat, nonce, deadline)`;
  the whitehat submits a frame tx (`VERIFY` payment sponsor + `SENDER` vault); vault gains
  `claimWithApproval(dealId, sig)`. This is the honest "whitehat signs, sponsor pays gas" story.
- B. Keep protocol-initiated release but stop calling it a whitehat claim. Rename the UI and video
  language to "protocol approves and sponsors payout; whitehat receives without gas". Then show the
  whitehat's 0-gas wallet only as recipient. Weaker, but honest.

Recommendation: **A** for the EF track, B as the Arc production path until A ships.

### P0-3. There is no cross-chain settlement — the demo is two disconnected escrows

Escrow money is on Arc (5042002). The gasless claim executes on the EF devnet (1337) against a
*different* vault, a *different* deal and a *different* token. There is no bridge, message,
signature relay or shared state. "Client locks USDC on Arc → freelancer claims via EF alt mempool"
cannot happen.

**Fix:** commit to one of:
1. **Arc is the settlement chain.** EF-8141 becomes an explicit *research prototype* of the
   sponsorship mechanism ("we validated stateful sponsor validation on the alt mempool; the same
   policy runs on Arc"). Both bounties stay load-bearing; nothing is faked.
2. **EF devnet is the product.** Drop Arc from the critical path (loses the Arc prize).
3. **Real intent relay.** Whitehat signs an intent; a relayer submits on Arc; EF-8141 is used to
   prototype the intent/sponsor envelope off-chain. Honest and ambitious, but too much for 48h.

Recommendation: **1**, with 3 as the grant roadmap. Rewrite the dossier and video script around it.

### P0-4. Arkiv is decorative and fails open

- `verifyArkivLiveness()` returns `true` on any exception (`// fail-open for demo`).
- The root page calls it with `expectedHash: "0x000…"`, so the guard can never block.
- `/api/reports` accepts `dealId` from the client but **never stores it**; the schema has no
  `dealId`. `freelancer/page.tsx` then computes `BigInt(undefined ?? 0)` → deal 0.
- Right now there are **0** `zero_day_report` entities on Rabdi.
- `frontend/src/app/freelancer/page.tsx` throws `TypeError: client.query is not a function` at
  runtime (captured in `.next/dev/logs/next-development.log`), and builds a hand-rolled chain
  object instead of `rabdi()`.
- No Arkiv access key → public endpoint, heavily rate-limited (warning appears on every load).
- Two schemas coexist: `escrow_job` (`/api/jobs`) and `zero_day_report` (`/api/reports`).

**Fix:** one schema (`bounty_report`), persist `dealId` + `payloadHash` + `expiresAt`, query
server-side via `rabdi({ accessKey })`, make the guard fail **closed**, add a seed script and an
expiry test. A guard that can't fail is not a bounty.

### P0-5. Three incompatible product stories

| Surface | Story |
|---|---|
| `submission-dossier.md` | ClearClaim — freelancer milestone escrow, client/freelancer |
| `contracts/` | ClearAudit — bug bounty, protocol/whitehat/arbitrator |
| `README.md` | ClearClaim — gasless B2B escrow |
| `arkiv/schema.md` | `escrow_job` |
| `/` | ClearAudit console |
| `/client` | "Protocol Portal" |
| `/freelancer` | "Whitehat Terminal" |

A judge cannot tell what you built. **Pick one and delete the rest.** Recommendation below.

### P0-6. No tests, no CI, no repo

- Zero Solidity tests. `lib/` and `forge-std` are absent. `forge build` only works via
  `~/.foundry/bin/forge` (Herd's `forge` on PATH is a broken PHP phar).
- No deploy script, no address book, no block explorer verification.
- The root is **not a git repo**; `frontend/` is a separate repo with one "Initial commit".
  ETHGlobal requires a public repo. `out/` and stale `Escrow.sol` artifacts are committed.
- No lint/format/Slither/Aderyn/coverage.

---

## P1 — security & correctness (fix before any real money)

1. **`BountyVault` has no whitehat claim path** (see P0-2). It also forces the protocol to know the
   whitehat address at creation — incompatible with anonymous bug bounties. A bounty should be
   claimable by whoever proves a report commitment.
2. **Single-EOA trust.** `arbitrator` and `owner` are single EOAs. No multisig, timelock or pause.
   "Zero-trust" in the comments is inaccurate.
3. **No emergency path.** If USDC issuer-blocklists a recipient, funds are permanently stuck
   (documented, not solved). Production needs pull payments + recovery address.
4. **Paymaster is not the one being demoed.** `USDCPaymaster` validates an ERC-4337 `execute()`
   shape; the working flow is an EIP-8141 frame tx using `SponsorPaymaster` (permissionless). The
   judged artifact is the demo paymaster.
5. **`sponsoredAttempts` writes storage during validation.** Verify against the real EntryPoint's
   staking/storage-access rules; `MAX_SPONSORED_ATTEMPTS_PER_BOUNTY` is never reset, so a bounty
   becomes unsponsorable after 3 attempts.
6. **`maxSponsoredCost` is denominated in native wei.** On Arc native USDC is 18-dec USDC; on the
   devnet it is ETH. The constant `5e16` means 0.05 USDC or 0.05 ETH depending on chain. Make the
   unit explicit per chain.
7. **`/api/claim` is an unauthenticated gas faucet.** Anyone can ask it to sign arbitrary deal IDs
   with the relayer key. Add auth, idempotency keys, per-IP/per-wallet rate limits, and a deal
   allowlist. Same for `/api/reports` (anyone can write Arkiv entities on your key and burn quota).
8. **No input validation.** `useEscrow` does not checksum addresses, does not read `decimals()`,
   hardcodes 6, skips an `allowance` check, and parses `getDeal` as `(address,address,uint256,bool)`
   while the contract returns `(address,address,uint256,uint8)`. The ABI in `constants.ts` is stale
   (`releaseBounty(dealId,fee,freelancer)` vs `…,whitehat`, missing `disputeBounty`/`resolveDispute`).
9. **No wallet coverage.** `wagmi` uses `injected()` only; RainbowKit is installed but unused; no
   WalletConnect despite the env var. Mobile onboarding fails.
10. **Next.js 16 experimental flags** (`cacheComponents`, `partialPrefetching`) + Tailwind through
    turbopack rules are fragile. No security headers/CSP, no `output` config, no error boundary.
11. **`next build` parity** is unverified. Dev works; production build may not. Add CI.
12. **Secret in `frontend/.env.local` is 644** and includes devnet keys; rotate and use a secret
    manager / 1Password for anything beyond the hackathon.

---

## P2 — product & startup gaps

- **No revenue model.** Sponsorship is explicitly free and nobody pays for settlement. Needed:
  basis-point settlement fee (e.g. 1.5–2.5% vs Immunefi's ~10%), or protocol SaaS subscription,
  plus a treasury address and a fee switch. Put `feeBps`/`feeRecipient` in the vault V2.
- **No demand-side product.** No bounty board, no templates, no severity rubric, no duplicate
  detection, no researcher reputation, no notifications, no receipts/PDFs.
- **No onboarding.** "Connect wallet" is still a wall for Web2 security researchers. Add embedded
  wallets (Circle Wallets is the natural fit for an Arc project) and email/social login.
- **No confidentiality story that survives inspection.** Arkiv expiry is good, but the payload hash
  is public and the report body is never actually stored/encrypted. Implement encrypt →
  store ciphertext (Arkiv/IPFS) → hash on-chain, with a reveal/decrypt flow.
- **No trust surface.** No solvency proof, no reserve attestation, no dispute SLA, no incident
  policy, no terms/privacy. For a payments startup this is table stakes.
- **Brand/UX.** Dark console is a good start but it is a mock. Needs a design system (tokens,
  typography, components), role-based navigation, empty/loading/error states, mobile, a11y, and
  obviously a landing page that explains the product in 10 seconds.

---

## What actually wins the three bounties

**EF alt mempool** — must show an admitted frame tx where the *user* (whitehat) signs and a
stateful paymaster sponsors based on real deal state. That is a genuinely interesting use of "more
flexible state access in validation." Today the demo uses `SponsorPaymaster` (pays for anyone) and
the protocol signs. Fix the signer and the paymaster, and the EF story becomes strong.

**Arc** — must use Arc as the settlement layer with **native USDC** (18 dec, gas token), contracts
built/deployed via Arc Studio, and a flow that needs stable value. Mock USDC + ETH gas labels
undermine the exact thesis Arc is judging.

**Arkiv** — must have live entities, a fail-closed query that changes on-chain behavior, a visible
countdown, and the `schema.md`/`why-arkiv.md`/`friction.md`/`reach.md` set. Today: 0 entities,
fail-open, schema mismatch. This is the cheapest bounty to actually win.

---

## Recommended product decision

**Ship ClearAudit: "Confidential, gasless bug-bounty payouts."** Why:
- The contracts already model a defensible primitive (escrow + dispute arbitration).
- Bug-bounty payout is a real, monetizable pain: Immunefi takes ~10%, requires KYC, and whitehats
  often refuse to identify. A privacy-first, stablecoin-native, instant payout rail is a credible
  wedge for grants and a seed round.
- Arc's native USDC is the right asset; Arkiv's expiry is the right confidentiality primitive; the
  EF alt mempool is the right R&D artifact for intent-based gasless settlement.
- Freelancer milestone escrow is commoditized (Request Finance, Bitwage, Upwork) and the current
  two-party approval flow has no differentiator.

If you keep ClearClaim instead, that's defensible too — but then the entire contract surface
(`BountyVault`, whitehat/arbitrator, `zero_day_report`) must be rewritten, which is not a 48h move.

---

## 48-hour execution plan

**Day 1 (today)**
1. Rotate keys; remove all `NEXT_PUBLIC_*PRIVATE_KEY` and literals; secret-scan CI. (1h)
2. Pick the story; delete the losing surface; rewrite README + dossier + Arkiv docs. (2h)
3. Regenerate ABIs from artifacts into one `abi.ts`; fix `getDeal`/`releaseBounty`; fix Arc chain
   config (native USDC, 18 dec, explorer). (2h)
4. Arkiv: one schema, server-side client with access key, store `dealId`/hash/expiry, fail-closed
   guard, seed script. (3h)
5. Foundry: add `forge-std`, 20+ tests (state machine, auth, CEI, fee bounds, fuzz invariant
   `balance == Σ open+disputed`), deploy script, `addresses.json`. (4h)
6. Make the UI read real chain state; delete hardcoded TVL/frames; honest empty states. (4h)

**Day 2**
7. Whitehat-signed gasless claim (EF-8141) **or** rename to protocol-sponsored payout (decide). (4h)
8. Premium pass: 3 role views, real tx states, mobile, landing page. (5h)
9. Arc native-USDC V2 vault (`payable` escrow) + redeploy via Arc Studio + verify. (4h)
10. Demo video script, runbook, architecture diagram, threat model, SECURITY.md. (3h)
11. Record, submit, publish repo, tag release. (2h)

**Post-hackathon (2 weeks → grant-ready)**
- Embedded wallet onboarding, bounty board + templates, researcher reputation, notifications.
- Fee switch + treasury multisig + pull-payment recovery + pause.
- Independent review (Spearbit/Code4rena light) or at minimum Slither + Aderyn + Echidna.
- Design partner LOIs (2–3 protocols), pricing page, metrics dashboard, grant application
  (Arc/Circle, Ethereum Foundation, Arkiv ecosystem).

---

## Immediate wins (this repo)

- One public monorepo, `LICENSE`, `SECURITY.md`, `CONTRIBUTING.md`, `docs/ARCHITECTURE.md`.
- `npm run verify` = typecheck + lint + forge test + secret scan.
- A real `/api/state` that reads `nextDealId`, `getDeal`, token balances, and Arkiv expiry.
- A demo "reset" script that seeds a fresh deal so the claim never hits a `Released` deal.
- Put the real EF frame tx hash, Arc explorer links, and Arkiv entity keys in the README — generated
  from a script, not typed by hand.

---

## Status after the first remediation pass (this commit)

Done:

- Removed all `NEXT_PUBLIC_*PRIVATE_KEY` variables and the hardcoded key literal in
  `/api/claim`. Signing is server-only; secrets have been renamed and the env file is `0600`.
  Verified: the relayer key does **not** appear in `.next/static`.
- `/api/claim` now reads the recipient and status from the chain, rejects non-open deals, and
  fails **closed** on a missing/expired/mismatched Arkiv anchor.
- `/api/reports` has a real `GET`, persists `dealId`/`amount`, validates inputs, and runs
  server-side with an optional access key.
- One Arkiv schema (`bounty_reports`); `escrow_job` and `/api/jobs` are gone.
- ABIs are generated from Foundry artifacts (`scripts/gen-abi.mjs`); the stale hand-written
  `releaseBounty(…,freelancer)` / `getDeal(…,bool)` signatures are gone.
- Arc chain config now declares USDC as the native gas token (18 decimals) and links the
  explorer; WalletConnect is only enabled when a project id exists.
- `useEscrow` reads `decimals()`/`allowance()`/`balanceOf()`, validates addresses, and parses the
  `BountyCreated` event instead of guessing the id.
- The dashboard reads live Arc state (`/api/state`) and Arkiv anchors; the hardcoded
  TVL/deal/gas/9.88-USDC mock is gone.
- 27 Foundry tests added: unit, fuzz, and a full-collateralisation invariant. Deploy script added.
- README + dossier + Arkiv docs now describe one product and separate the Arc product from the
  EF-8141 research prototype.

Still open (deliberately, needs a product decision / funding):

- Whitehat-signed claim (EIP-712 approval) vs. protocol-sponsored release.
- Native-USDC V2 vault on Arc, `feeBps`, multisig arbitrator/owner, pull-payment recovery.
- Indexer, embedded wallets, report upload/encryption, bounty board, notifications.
- Root git repo + CI + secret scanning + Slither/Aderyn + external review.
