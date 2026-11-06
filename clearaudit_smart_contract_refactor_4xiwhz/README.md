# ClearAudit

Zero-trust bug bounty vault. A protocol deposits USDC for a named whitehat, approves the payout when a report is valid, and an arbitrator settles disputes. An optional paymaster sponsors gas for the protocol's payout.

Built with [Arc Studio](https://studio.arc.io)

## Tech stack

Solidity 0.8.28, Foundry, Vite, React, TypeScript.

## Contracts

- `contracts/BountyVault.sol`: holds the bounty USDC and enforces who can release, dispute and resolve.
- `contracts/USDCPaymaster.sol`: sponsors gas for the protocol's own payout transaction.
- `contracts/mocks/MockUSDC.sol`: test token.

## Development

Prerequisites: bun, Foundry.

```
bun install
forge build --skip SponsorPaymaster.sol
forge test --skip SponsorPaymaster.sol
bun run dev
```

## Environment variables

None.

## Known limits

- Gas sponsorship is free and limited to protocols the paymaster owner has approved, only for their own open bounty (3 attempts per bounty, per-operation gas cap). There is no aggregate budget across approved protocols, and a production paymaster should also require a sponsor signature.
- If the USDC issuer blocklists the whitehat or protocol address, a payout to it reverts and those funds stay locked.
- The arbitrator is fixed at deployment and is the one trusted party for disputes.

## Deploying
`forge script contracts/script/DeployArc.s.sol:DeployArc --rpc-url https://rpc.testnet.arc.io --broadcast --private-key $PRIVATE_KEY` (optional `ARBITRATOR` and `ADMIN` env vars; both default to the broadcaster). Current testnet addresses are in `deployments.json`.
