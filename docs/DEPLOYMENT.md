# Deployment

ClearAudit deploys **only** through Arc Studio. There is no direct `forge broadcast` step in the
submission flow: the sandbox is the build and deploy environment, and the repository keeps a copy of
the sources so the deployment is reviewable.

```
Arc Studio workspace ──deploy──► Arc Testnet
        │
        └──pull──► contracts/ (this repo)  ──gen-abi──► frontend/src/lib/abi.ts
```

## What is deployed

### v2, the live settlement target

| Contract | Address |
| --- | --- |
| `BountyVault` v2 | `0xf6aD45A5cC8cbC9A33bd792A07625ecE1C9Ca593` |
| USDC (ERC-20 view) | `0x3600000000000000000000000000000000000000` |
| Arbitrator | `0x65B555dDAd787B66F3F1E4Dd4Ff814D11B9A0ed2` |
| Paymaster | `0x0000000000000000000000000000000000000000` |

Deployment transaction:
`0x167899b66fbdaf259770a12e18d6f525c6ec1a01c109c8d1c9de38b03a263e5d` (block 71028686,
1410742 gas).

A zero paymaster is intentional. v2 has no fee term: `release` moves the whole escrow to the payee,
so there is nothing for a paymaster to sponsor and nothing for the vault to skim. The constructor
accepts zero for exactly this reason.

### v1, superseded but still on chain

| Contract | Address |
| --- | --- |
| `ClearAuditDeployer` | `0x8fcC1436147BF48eCF57C0B4609B5380E7b5756a` |
| `BountyVault` v1 | `0x283776AB6c2B139d6097285821AC5EdDe43e115e` |
| `USDCPaymaster` | `0xEFFD38f3768c3A77E14424a8033c4CE3F91Fba2B` |
| USDC (ERC-20 view) | `0x3600000000000000000000000000000000000000` |
| ERC-4337 EntryPoint v0.7 | `0x0000000071727De22E5E9d8BAf0edAc6f37da032` |

Deployment transaction:
`0x201d71d90b110fb3d321f3b86591ab07096b646986632bf044082e1cca12b145`

The vault and the paymaster are created **inside the deployer constructor**, so the two immutables
(`vault.paymaster`, `paymaster.vault`) are wired before either address is usable. The deployer then
asserts the wiring and reverts on mismatch - a partial deployment cannot survive.

Both generations are kept: v1 explains where the paymaster came from, v2 is where money moves. The
source of v1 is `contracts/legacy/BountyVaultV1.sol`, and the v2 source is `contracts/BountyVault.sol`.

## Proven end to end on Arc

| Step | Evidence |
| --- | --- |
| Fund deal #0, 5 USDC to a named payee | tx `0xa5a6b0d2c8b2470bdc5870d2e1b6c361bd1360fe5b80ae90e7613459dc28daf6` |
| Anchor the artefact in Arkiv | entity `0x6035259ae5b5d71415498a5d4f1b76f3e2391145e67a300a7d3cda53087f57ef`, tx `0x6137b6c0324ec574bb5a44075d86aa35b837c1738e23b83bf7950467bd5cce57` |
| Gate accepts it | `POST /api/release-guard` returned `ok: true` with that key |
| Pay | tx `0x397119504acd60270c4c2f5e53bd2053864316ed46cf98efbc6071942c4c1347`, block 71029339, 93123 gas, status `Released`, payee 0 to 5 USDC |
| Gate refuses without an anchor | deal #1 is funded and unanchored; `/api/release-guard` returned 403 and no transaction was sent |

## Verify (read-only, no keys)

```bash
npm install
npm run verify:chain
```

`scripts/verify-deployment.ts` does not trust `deployments.arc.json`: it re-reads chain id, code
presence, the deployment receipt and its block, `token()`, `arbitrator()`, `paymaster() == 0`, the
argument count of `release` in the ABI, the absence of `releaseBounty`, the presence of
`createOpenTask`/`claimTask`/`refundExpired`/`cancel`/`assignPayee`, `nextDealId()`, and the state of
deal #0. It exits non-zero on any mismatch, so it can gate CI or a submission. 18 checks pass today.

## Deploy a fresh instance

The existing deployment predates this repository; it is **not** required to redeploy for the demo.
If you do need a new instance:

1. Open the Arc Studio session:

   ```bash
   npx arc-studio sessions --session clearaudit
   npx arc-studio ls contracts --session clearaudit
   ```

2. Ask Arc Studio to run the deployment script with explicit roles. `ARBITRATOR` and `ADMIN` default
   to the broadcaster, which on Arc Studio is the shared deploy wallet. **Set `ARBITRATOR` to a
   project-controlled address** if you want disputes to be resolvable without Arc Studio:

   ```bash
   npx arc-studio run \
     "Deploy with contracts/script/DeployArc.s.sol, ARBITRATOR=<your-arbitrator>, ADMIN=<your-admin>" \
     --session clearaudit
   ```

   The broadcaster must hold Arc USDC; the script reverts with `NoUsdcForGas` otherwise.

3. Pull the new addresses and sources back:

   ```bash
   npx arc-studio deployments --session clearaudit
   npx arc-studio pull --session clearaudit --paths contracts --out .
   ```

4. Update `deployments.json`, `frontend/.env.example`, the `.env.local` fallbacks in
   `frontend/src/lib/constants.ts`, and regenerate the ABI:

   ```bash
   npx arc-studio cat contracts/out/BountyVault.sol/BountyVault.json --session clearaudit \
     | node -e "let s='';process.stdin.on('data',d=>s+=d).on('end',()=>{const a=JSON.parse(s).abi;require('fs').writeFileSync('abi/BountyVault.json',JSON.stringify({contract:'BountyVault',abi:a},null,2))})"
   npm run abi
   npm run verify:chain
   ```

## Known deployment caveat: the arbitrator

`BountyVault.arbitrator` is immutable and set at deploy time. The current deployment uses the Arc
Studio deploy wallet (`0x5B12Ce46C7194aD57d143bC22847224047b1Ef42`), which is shared by every Arc
Studio project and whose key is not available to this repository.

Consequences, stated plainly:

- A researcher can always `disputeBounty` (freeze the funds).
- `resolveDispute` can only be called by that wallet, so a frozen bounty needs Arc Studio to act.
- Nothing else - not the company, not the researcher, not an admin - can move a disputed bounty.

The contracts are correct; this is a deployment-configuration choice. A production deployment sets
`ARBITRATOR` to a dedicated address (multisig or arbitration service) that the project controls.

## Foundry tests

```bash
forge install foundry-rs/forge-std   # lib/ is intentionally not vendored
forge test --root .
```

`foundry.toml` pins `solc 0.8.28`, `evm_version = "cancun"` and reads `contracts/`. The suite covers
the state machine, authorization, CEI ordering, fuzz and invariant properties for both the vault and
the paymaster.
