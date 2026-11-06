# Agent dispatch

A lister should not have to wait for a human to accept work and then disappear. The rail already
settles against a delivered artefact; what it lacks is a way to leave the payee unnamed at funding
time so *any* capable agent can take the task.

This document is the contract change, the invariants, and the migration. The deployed vault cannot do
it, so the app labels the feature `needs v2` instead of pretending.

## Why this is a real concern

- Supply is bursty. A payout board with three takers is a queue; a task that any agent can claim is
  throughput.
- Ghosting is unpriced today. A deadline plus a refund turns "nobody showed up" into a recoverable
  state instead of locked capital.
- Agents need no identity, no gas and no invoicing, which is the same shape the rail already pays in.

## Why the gate does not make agents safe

Arkiv proves a deliverable existed and matched the terms. It cannot prove the deliverable is good.
So an open task must carry an acceptance-criteria hash and a public claim before work starts, and the
funder still asserts acceptance. The gate removes "did they deliver something that matches", not "was
it worth paying for".

## Contract v2

`contracts/BountyVault.sol` becomes the following. It stays non-upgradeable and fee-free: a new
deployment, not a migration of the old one. The v1 address stays documented.

```solidity
enum Status { None, Open, Disputed, Released, ResolvedToPayee, ResolvedToPayer }

struct Deal {
    address payer;       // funds it, releases, can dispute
    address payee;       // 0 until claimed when agentMode
    address token;       // USDC on Arc
    uint128 amount;
    uint64  deadline;    // 0 = none, required when agentMode
    uint64  claimedAt;
    Status  status;
    bool    agentMode;   // payee was open at funding
    bool    assigned;    // payee set after funding
    address arbitrator;
    bytes32 criteriaHash; // acceptance criteria, optional
}
```

### Functions

| Function | Who | Rule |
| --- | --- | --- |
| `createBounty(address payee, uint128 amount, uint64 deadline, bytes32 criteriaHash)` | anyone | fixed payee, `payee != 0`, `payee != payer`, deadline optional |
| `createOpenTask(uint128 amount, uint64 deadline, bytes32 criteriaHash)` | anyone | `payee = 0`, `agentMode = true`, deadline required and in the future |
| `claimTask(uint256 id)` | any address | status Open, unclaimed, `block.timestamp <= deadline`; sets payee to caller, emits `TaskClaimed` |
| `assignPayee(uint256 id, address payee)` | payer | unclaimed, before deadline; escape hatch for a named agent |
| `release(uint256 id)` | payer | status Open, `payee != 0`, pays `amount` to `payee` |
| `dispute(uint256 id)` | payer or payee | status Open, moves to Disputed |
| `resolveDispute(uint256 id, bool toPayee)` | arbitrator | status Disputed, pays one side in full, no fee |
| `refundExpired(uint256 id)` | anyone | `deadline != 0`, `block.timestamp > deadline`, not Released/Resolved; pays payer |
| `cancel(uint256 id)` | payer | unclaimed, before deadline; pays payer |
| `nextDealId()`, `getDeal(uint256)`, `token()`, `arbitrator()`, `paymaster()` | anyone | unchanged views |

### Invariants to keep

1. One terminal transition per deal. No path from Released or Resolved to anything else.
2. `refundExpired` cannot fire after `release`, and `release` cannot fire after a refund, even in the
   same block.
3. `payee != payer`, `arbitrator != payer`, `arbitrator != payee` (`RoleConflict`).
4. Claim is first-come and single: a second `claimTask` reverts with `AlreadyClaimed`.
5. `release` pays the stored payee, so the funder cannot redirect escrow to a new address.
6. Token movement goes through a checked transfer; state changes before transfer.
7. Contract balance always covers the sum of non-terminal deals. No fee, no admin sweep.
8. Deadline is enforced in the contract, not in the UI.

### Events

`DealCreated(id, payer, payee, amount, deadline, agentMode)`, `TaskClaimed(id, agent)`,
`PayeeAssigned(id, payee)`, `Released(id, payee, amount)`, `Disputed(id, by)`,
`Resolved(id, toPayee)`, `Refunded(id, payer, amount)`, `Cancelled(id, payer, amount)`.

## Arc Studio prompt

Paste this into the existing ClearAudit project thread. It edits the sandbox and deploys; it does not
ask you for keys.

```text
Update the ClearAudit BountyVault in this project to v2 and deploy it to Arc Testnet (5042002).

Goal: a funder can either name a payee at funding time, or leave the payee open so any address can
claim the task, with a deadline and a refund path. Keep the contract non-upgradeable, keep the fee at
zero, and keep the existing arbitrator, USDC and paymaster wiring.

Changes to BountyVault.sol:
- Deal struct: payer, payee, token, uint128 amount, uint64 deadline, uint64 claimedAt, Status status,
  bool agentMode, bool assigned, address arbitrator, bytes32 criteriaHash.
- Status: None, Open, Disputed, Released, ResolvedToPayee, ResolvedToPayer.
- createBounty(address payee, uint128 amount, uint64 deadline, bytes32 criteriaHash): payee must be
  non-zero and must not equal the payer. deadline may be 0.
- createOpenTask(uint128 amount, uint64 deadline, bytes32 criteriaHash): payee starts as 0,
  agentMode true, deadline must be in the future.
- claimTask(uint256 id): only while Open, unclaimed and block.timestamp <= deadline; set payee to
  msg.sender and emit TaskClaimed. Revert AlreadyClaimed on a second claim.
- assignPayee(uint256 id, address payee): payer only, unclaimed, before deadline.
- release(uint256 id): payer only, status Open, payee must be non-zero, pays amount to the stored
  payee. Do not accept payee or amount as arguments.
- dispute(uint256 id): payer or payee only, Open to Disputed.
- resolveDispute(uint256 id, bool toPayee): arbitrator only, Disputed to ResolvedToPayee or
  ResolvedToPayer, pays the full amount, no fee.
- refundExpired(uint256 id): anyone, only if deadline != 0 and block.timestamp > deadline, and the
  deal is not Released or Resolved. Pays the payer.
- cancel(uint256 id): payer only, unclaimed and before deadline. Pays the payer.
- Keep nextDealId, getDeal, token, arbitrator, paymaster and USDCPaymaster wiring as they are.
- Follow checks-effects-interactions and use a checked token transfer helper.
- Add the events listed in docs/AGENT-DISPATCH.md and the custom errors only for new cases
  (AlreadyClaimed, DeadlinePassed, DeadlineRequired, NotClaimable, NotYetExpired).

Add Foundry tests in the sandbox for:
- claim then release pays the claimer exactly once
- second claim reverts
- release after refund reverts and refund after release reverts
- refundExpired before the deadline reverts, after it pays the payer
- cancel after claim reverts
- arbitrator must not equal payer or payee at creation
- contract balance covers all non-terminal deals after a mixed sequence

Deploy in this order on Arc Testnet: MockUSDC if the existing one is not usable, BountyVault with the
existing USDC, arbitrator and EntryPoint, then wire paymaster.vault(). Report every deployed address
and transaction hash, and confirm nextDealId() == 0 in the sandbox output.
```

## App changes once v2 is deployed

1. Fund form: a mode switch, "Name the payee" or "Open to agents", with a deadline field when open.
2. Deal row: unclaimed tasks show a countdown and a `Claim` button; claimed tasks show the agent.
3. Release path: unchanged guard, plus the deadline check so the UI cannot offer a release the
   contract would refuse.
4. Refund path: visible after the deadline, permissionless.
5. Acceptance criteria: optional text, hashed client side into `criteriaHash`.
6. Anchors: an agent's deliverable anchor carries the same `chainId`, `dealId`, `protocolWallet` (the
   payer) and `whitehatWallet` (the claimer), so the existing gate works without a new query shape.

Until that deploy lands, the app shows the feature with a `needs v2` badge and the fund form stays on
fixed payees.

## Operator model: ClearAudit runs the agent

The rail has no fee switch, and adding one would contradict the property that makes it credible
(the release path cannot redirect money). So ClearAudit should not take a cut of the escrow. It
should be a **payee like any other agent**.

That means:

- The lister funds a task naming the operator address as payee. This works on the deployed vault
  today, with no contract change.
- The lister or the operator triggers `POST /api/agent/run`, which calls an OpenAI-compatible
  endpoint configured by `AGENT_API_BASE_URL`, `AGENT_MODEL` and `AGENT_API_KEY` (server only), and
  receives a deliverable.
- The deliverable is hashed, the hash is anchored to Arkiv against the deal, and the gate then
  allows the release. The funder still has to approve: no self-acceptance path.
- Revenue is the margin between the amount the lister funded and the inference cost, collected by
  the operator address. It is a service fee, not a protocol fee, and it appears nowhere in the
  contract.

Why this is a real business, not a garnish:

1. It removes the ghosting problem from the demand side. A lister can pay for an outcome in one
   session instead of waiting for supply.
2. It is the only way to demonstrate agent-claimed work before the v2 vault exists, so it doubles as
   the live demo.
3. Margin is thin but honest and verifiable: the price is on chain, the cost is inference, and
   anyone can see the artefact hash that was paid for.

What it must not become:

- No auto-release. If the operator could approve its own work, the dispute fork and the funder's
  assertion mean nothing.
- No silent custody. The operator is an address, not a balance inside ClearAudit.
- No confidentiality overclaim. A task sent to a hosted model leaves the browser, so any page
  describing the operator must say so. The human flow (finding stays local, only a hash is
  anchored) is unchanged.
- No unbounded spend. Per-task token and time budget, and the operator refuses tasks over it.

Environment for the operator, all server side:

```text
AGENT_API_BASE_URL=https://api.openai.com/v1
AGENT_MODEL=
AGENT_API_KEY=
AGENT_MAX_TOKENS=4000
OPERATOR_ADDRESS=
```

`AGENT_*` and `OPERATOR_ADDRESS` never carry `NEXT_PUBLIC_`. A clone without them shows the operator
as unavailable, which is the correct fail-closed default.
