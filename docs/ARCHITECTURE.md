# Architecture

## Surfaces

```
Browser                         Next.js server                 Arc Testnet
  │                                   │                             │
  │  wagmi + viem (custom injected)   │                             │
  ├─ read state ─────────────────────►│ /api/state ─────────────────┤ BountyVault
  │                                   │                             │
  ├─ fund / release (user signs) ─────┼────────────────────────────►│
  │                                   │                             │
  ├─ report fingerprint ─────────────►│ /api/reports ──► Arkiv      │
  │   (hash only; body stays local)   │                             │
```

- **Reads** always go through `/api/state`, which reads the vault over RPC. The UI has no seeded
  values; an empty vault renders empty states.
- **Writes** are signed in the user's wallet. The server never signs on behalf of a user in the
  product flow.
- **Report anchoring** is server-side because the Arkiv writer key is a secret. The server verifies
  that the deal exists and is open before writing; it derives the company and researcher addresses
  from the chain rather than trusting the request body.

## Wallet integration

`src/lib/connector.ts` implements a minimal injected connector with `createConnector`. Browser
extensions expose `window.ethereum` through a `Proxy` whose event methods are non-configurable
properties, which breaks wagmi's built-in `injected()` connector during cleanup
(`'get' on proxy: property 'removeListener' is read-only…`). Our connector only uses
`eth_requestAccounts` / `eth_chainId` and never touches the provider's event emitter.
`multiInjectedProviderDiscovery` is disabled for the same reason.

## Data flow for a payout

1. `createBounty(researcher, amount)` - vault pulls USDC via `transferFrom`, emits `BountyCreated`.
2. `POST /api/reports` - validates the deal is `Open`, anchors
   `{chainId, dealId, hash, severity, researcher, company, amount}` in Arkiv with a 30-day expiry.
   A second anchor for a live deal with a different hash is refused with `409`.
3. `POST /api/release-guard` - the gate the UI calls before signing. It re-reads the deal from Arc
   and requires a live, unexpired Arkiv anchor whose researcher, company and amount match the chain.
   No anchor → `403`, nothing is signed.
4. `releaseBounty(dealId, 0, 0x0)` - protocol caller; the vault pays the recorded researcher, sets
   status to `Released`. There is no fee term in the deployed contract.
5. `/api/state` reflects the new status. Nothing is cached beyond a 20-second client poll.

The EF devnet path (`/api/claim`, `/app/gasless`) runs the same Arkiv gate against chain `1337` and
then submits an EIP-8141 frame transaction whose PAYMENT frame is sponsored. It is a research
artifact, not a bridge: no value or state moves between the devnet and Arc.

## Trust boundaries

| Boundary | Trusted for | Not trusted for |
| --- | --- | --- |
| Contract | Custody, status transitions, recipient | Report contents |
| Arkiv | Existence and timestamp of a fingerprint | Confidentiality of the report body |
| Server | Anchoring, rate limiting | Holding user funds or signing for users |
| Browser | Encryption, hashing | Anything persisted across devices |
