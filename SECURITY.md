# Security

## Reporting a vulnerability

Email `security@clearaudit.xyz` with a description, impact and reproduction steps. Do not open a
public issue. We acknowledge within 72 hours and will pay a reward through ClearAudit itself.

## Threat model

| Asset | Threat | Mitigation |
| --- | --- | --- |
| Escrowed USDC | Redirected payout | The payee is fixed in `createBounty` or `claimTask`; `release(id)` pays only the recorded address |
| Escrowed USDC | Double payment | Status transitions are enforced on-chain; released deals cannot be released or disputed again |
| Escrowed USDC | Admin drain | No owner, no upgrade path, no `withdraw`. Only the protocol (refund) or the arbitrator (resolve) can move funds |
| Dispute funds | Arbitrator collusion | The arbitrator is immutable and set at deploy time. It can only resolve to one of the two parties named in the deal |
| Report content | Leak after fix | Report bodies never leave the browser. Only a hash is anchored, with a 30-day expiry |
| Report integrity | Anchor substitution | The anchored hash is compared with the submitted hash; anchoring is fail-closed |
| Server key | Compromise | Server-only env vars, never `NEXT_PUBLIC_`, never in the client bundle. The claim endpoint is per-IP rate limited |
| Replay | Repeat claim | The claim path re-reads deal status from the chain on every request |

## Out of scope (testnet)

- Arc Testnet and the EF alt-mempool devnet are unaudited test networks.
- The demo sponsor paymaster on devnet sponsors any caller while funded. It is not used in the
  product path.
- Report encryption is local (AES-GCM + PBKDF2, 210k iterations). Key exchange between researcher
  and company is out of band and manual today; see `docs/ROADMAP.md`.
