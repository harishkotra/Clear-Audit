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

| Contract | Address |
| --- | --- |
| `ClearAuditDeployer` | `0x8fcC1436147BF48eCF57C0B4609B5380E7b5756a` |
| `BountyVault` | `0x283776AB6c2B139d6097285821AC5EdDe43e115e` |
| `USDCPaymaster` | `0xEFFD38f3768c3A77E14424a8033c4CE3F91Fba2B` |
| USDC (ERC-20 view) | `0x3600000000000000000000000000000000000000` |
| ERC-4337 EntryPoint v0.7 | `0x0000000071727De22E5E9d8BAf0edAc6f37da032` |

Deployment transaction:
`0x201d71d90b110fb3d321f3b86591ab07096b646986632bf044082e1cca12b145`

The vault and the paymaster are created **inside the deployer constructor**, so the two immutables
(`vault.paymaster`, `paymaster.vault`) are wired before either address is usable. The deployer then
asserts the wiring and reverts on mismatch - a partial deployment cannot survive.

## Verify (read-only, no keys)

```bash
npm install
npm run verify:chain
```

`scripts/verify-deployment.ts` does not trust `deployments.json`: it re-reads chain id, code
presence, the deployment receipt, `vault.token`, `vault.paymaster`, `vault.arbitrator`,
`paymaster.vault`, `paymaster.usdc`, `paymaster.entryPoint`, `paymaster.owner` and
`vault.nextDealId`. It exits non-zero on any mismatch, so it can gate CI or a submission.

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
