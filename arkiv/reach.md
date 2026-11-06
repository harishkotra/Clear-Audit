# Reach

ClearAudit is built at ETHGlobal Mumbai and this is what adoption looks like after the event.

## Who it is for, and why they would use it

**Security teams at small protocols.** They have a security budget and no bounty program, because
running one means a payout desk, a KYC process, an arbitrator and a spreadsheet. ClearAudit gives
them escrow plus a neutral dispute path in one contract; the vault on Arc is already deployed and
verified, so onboarding is "fund a bounty", not "integrate a protocol".

**Independent researchers and whitehats.** They get paid in USDC with no KYC to receive it and no
need to hold a gas token to accept payment. For researchers in regions where exchanging crypto is
the hard part, removing the gas-token step is the difference between accepting a payout and sitting
on an unpaid bounty.

**Audit firms running private contests.** A contest under NDA is the same shape: money escrowed
before work starts, evidence confidential, payout conditional. The 30-day anchor expiry is a feature
here, not a compromise - a fixed finding should not stay indexed forever.

## Can they try it today

Yes, on testnet, with no setup beyond a wallet:

- The app runs against the live Arc deployment (`0x2837…115e`); every number in the UI is read from
  the chain through `/api/state`, so a visitor can create a bounty and see it appear.
- `npm run verify:chain` re-verifies the deployment from RPC in about five seconds, so a sceptical
  reader does not have to trust the README.
- The public repository contains the Solidity, the Foundry tests, the Arkiv schema and a read-only
  query script (`npm run arkiv:anchors`).

## Will it ship after Mumbai

The pieces that are testnet-bound are the settlement asset and the networks. The mould is:

- One `BountyVault` per chain, USDC, 0% on the deployed vault (see the pricing page: no fee is
  claimed that the contract does not take).
- Anchors written by the protocol and queried by the guard, chain-scoped so the same code can run on
  several networks without cross-network confusion.

The two things that must change before a mainnet launch, stated plainly: the arbitrator is currently
the Arc Studio deploy wallet, so a production deployment sets `ARBITRATOR` to a project-controlled
address (see `docs/DEPLOYMENT.md`); and the Arkiv retention window is a product decision that we
expose as a constant, not a fixed number we would defend forever.

## Numbers we can defend today

| Claim | Where it comes from |
| --- | --- |
| Deployment matches the source | `npm run verify:chain` - 13 checks, all read from RPC |
| No fee on the deployed vault | `frontend/src/app/page.tsx` pricing tier and `BountyVault.releaseBounty` (no fee term exists in the contract) |
| Arkiv gates payouts | `POST /api/release-guard` refuses with `403`/`409`, and the release button is disabled without an anchor |
| Sponsored settlement works | three mined alt-mempool transactions listed in `deployments.json`, plus `npm run claim` |

We are not going to quote user numbers: the product launched at this event, and inventing adoption
figures would be the first thing a judge checks.
