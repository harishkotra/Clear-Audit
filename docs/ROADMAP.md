# ClearAudit — From Hackathon MVP to Fundable Company

> **Status (2026-11-07):** this is the plan, not the shipped state. What exists today is in
> [`README.md`](../README.md) and [`deployments.json`](../deployments.json): one vault on Arc
> Testnet with **0% fee** (no `feeBps` term in the deployed contract), the Arkiv payout gate, and the
> EF devnet artifact. The fee models below are V2 plans and are deliberately not claimed anywhere in
> the product UI.

> One sentence: **ClearAudit lets protocols escrow bug bounties in USDC and pay whitehats
> instantly, gaslessly, and without forcing researchers to KYC — while the confidential report
> self-destructs on a fixed schedule.**

---

## 1. Why this can be a company

**The pain is real and expensive.**
- Bug bounty payouts are a nine-figure annual market (Immunefi alone has paid out >$100M).
- Whitehats increasingly refuse to submit through platforms that require KYC, because a
  reported exploit is often also a legal admission in some jurisdictions.
- Protocols want escrow (proof the money exists) but do not want to run a payout desk, a
  dispute process, and a compliance program.
- Cross-border payouts are slow, expensive, and often routed through a KYC exchange — the
  exact friction that makes a critical report sit in a researcher's notes for a week.

**The wedge.**
- **Privacy-first:** the report body is never on-chain. Only a ciphertext hash is anchored, and
  the anchor expires. Whitehats can be pseudonymous.
- **Stablecoin-native settlement:** Arc makes USDC the gas token, so a payout is one asset, one
  balance, one confirmation — no ETH treasury, no volatile gas.
- **Gasless for the researcher:** the protocol (or the platform) sponsors settlement. A whitehat
  with zero gas can still get paid.
- **Escrow + arbitration:** protocols get credible commitment; researchers get a funded target.

**Why now.**
- Arc is building the stablecoin-native execution layer and needs real payment use cases.
- Account abstraction / frame transactions make "user signs, sponsor pays" practical.
- Arkiv-style expiring storage makes confidentiality enforceable rather than a promise.

**Who pays.**
1. Protocols with a security budget but no program (SaaS: program setup, triage, payouts).
2. Existing programs that want a private, no-KYC payout rail (per-payout fee).
3. Security firms / audit shops that want to run private contests for clients.

**Revenue model (pick one, then A/B test).**
- **Settlement fee:** 1.5–2.5% of each bounty, taken from the protocol's deposit (vs Immunefi's
  ~10%). Transparent, aligns with volume, trivial to implement (`feeBps`, `feeRecipient`).
- **SaaS:** $500–2,000/month per program for triage, templates, reporting, SSO.
- **Contest fee:** flat fee for a time-boxed private contest (highest margin, best for design
  partners).

**Moat (in order of durability).**
1. Compliance + privacy design that big platforms cannot copy without breaking their KYC model.
2. Researcher reputation and payout history (network effects on the supply side).
3. Arc-native distribution + a settlement rail that is cheaper than card/ACH/OTC.
4. Expiring evidence as a product primitive (audit + confidentiality in one).

---

## 2. What the product must be (not a two-screen demo)

### Roles
- **Protocol** — create a program, fund a bounty, approve a payout, dispute, see receipts.
- **Whitehat** — discover programs, submit a report, track severity/status, get paid, keep
  identity private.
- **Arbitrator** — a multisig/committee with a published policy and SLA, not a single EOA.

### Core flows
1. **Fund** — protocol deposits USDC into the vault (Arc native USDC, 18 dec). Receipt + on-chain
   event + program page.
2. **Anchor** — report ciphertext stored off-chain (IPFS/Arkiv); hash + severity + expiry anchored.
3. **Approve** — protocol signs an EIP-712 approval `(dealId, whitehat, amount, nonce, deadline)`.
4. **Settle** — whitehat (or a relayer) submits the approval; the sponsor pays gas; USDC lands in
   the whitehat's wallet. One transaction, one receipt.
5. **Dispute** — either party escalates; arbitrator resolves to one side; funds move once.
6. **Expire** — after the retention window the anchor is gone; the vault refuses to settle.

### Non-negotiables for "premium"
- Real chain data everywhere. No hardcoded TVL, no fake deal ids, no mock receipts.
- Transaction state machine: idle → simulating → signing → pending → confirmed/failed, with
  explorer links and decoded errors.
- Empty, loading, and error states designed, not defaulted.
- Works on mobile; wallet connect via Privy (extension, mobile app, or embedded wallet).
- Accessible (keyboard, contrast, focus), fast (server components where possible).
- A landing page that explains the product in 10 seconds and shows a live program.

---

## 3. Architecture (target)

```
Protocol wallet ──► BountyVault (Arc)  ◄── Arbitrator multisig
                        ▲   │
        EIP-712 approval│   │ USDC payout
                        │   ▼
Whitehat wallet ──► Settlement relayer / paymaster (Arc, USDC gas)
                        │
                        ├── Arkiv: encrypted report anchor (30d TTL)
                        └── Indexer: deals, events, receipts, notifications
```

- **Arc is the settlement chain.** One chain, one asset, one source of truth.
- **EF EIP-8141 alt-mempool is a research artifact**, not a bridge. It proves the sponsorship
  mechanism (stateful validation, user-signed intent, sponsor pays). Publish the frame tx and a
  short write-up; do not pretend it settles Arc funds.
- **Arkiv is a hard dependency**, not decoration: no live anchor → no settlement.
- **Indexer** (Ponder/Envio or a simple event worker) for lists, history, and notifications.
  Never query the chain per row in the browser.

---

## 4. Two-week plan (post-hackathon)

**Week 1 — correctness and trust**
- `BountyVaultV2`: native USDC (`msg.value`), `feeBps` + `feeRecipient`, pull-payment fallback,
  pausable emergency exit, EIP-712 whitehat claim, `Ownable2Step`/multisig ownership.
- Full Foundry suite: unit + fuzz + invariant + fork tests against Arc. Target >90% branch
  coverage; Slither + Aderyn clean; one external review.
- Deploy via Arc Studio, verify source, publish `deployments.json` with real addresses.
- Replace mock USDC with Arc native USDC everywhere; delete the 6-decimal assumptions.
- Real `/api/state`, indexer, and a seeded demo environment.

**Week 2 — product and pitch**
- Three role-based apps (protocol / whitehat / arbitrator), design system, mobile.
- Embedded wallet onboarding (Circle Wallets is the natural fit on Arc) + email magic link.
- Report upload (encrypted to protocol pubkey), severity rubric, duplicate detection v0.
- Program pages, public bounty board, receipts (PDF), email/webhook notifications.
- 2–3 design-partner LOIs; a pricing page; a metrics dashboard (TVL, payouts, time-to-pay).
- Demo video (90s), architecture diagram, threat model, security policy, terms/privacy.

---

## 5. Grant / fundraise narrative

**Ask:** $150k–$250k pre-seed (or an Arc/Circle ecosystem grant of $50k–$100k) for 6 months,
2 engineers + 1 designer, to ship the private beta and 10 paying programs.

**Use of funds:** 55% engineering, 15% security review, 15% design/product, 10% legal/compliance,
5% infra.

**Milestones**
1. Month 1: V2 vault + native USDC + external review + 3 design partners live.
2. Month 2: embedded wallets, report upload, public board, 100 whitehats onboarded.
3. Month 3: $1M in bounties escrowed, first $50k paid out, 2 paying programs.
4. Month 6: $10M escrowed, 10 programs, break-even on settlement fees.

**Metrics investors will ask for:** escrowed value, payout volume, time-to-pay, dispute rate,
whitehat retention, program retention, take rate, CAC per program.

**Risks to name before they do**
- Regulatory: privacy vs AML. Mitigate with a documented policy, sanctions screening on
  settlement, and jurisdiction-specific limits.
- Smart contract risk: external review + conservative caps + pause + insurance.
- Cold start: design partners first, then open the board.
- Platform competition: win on privacy + speed + stablecoin rails, not on features.

---

## 6. What I would not do

- Do not ship a second chain in the critical path just to win a second bounty. Coherence beats
  checkbox coverage.
- Do not call a protocol-signed release a "whitehat claim". Judges and users both notice.
- Do not claim "zero-trust" while a single EOA is the arbitrator.
- Do not put a private key behind `NEXT_PUBLIC_`.
- Do not show numbers that the chain does not support.
