import {
  BOUNTY_VAULT_ABI,
  BOUNTY_VAULT_V2_ABI,
  ERC20_ABI,
  DEAL_STATUS,
  DEAL_STATUS_LABEL,
  DEAL_STATUS_V2,
  DEAL_STATUS_V2_LABEL,
} from "./abi";

// ─────────────────────────── Chains ────────────────────────────

/** Arc Testnet. USDC is the native gas token (18 decimals) and also the settlement asset. */
export const ARC_CHAIN_ID = 5042002;
/** EIP-8141 alt-mempool reference devnet. Used for the sponsorship prototype only. */
export const DEVNET_CHAIN_ID = 1337;

// ───────────────────────── Arc Testnet (product) ────────────────

/** Live vault: on-chain evidence gate, open tasks, contest awards, no fee. */
export const VAULT_ADDRESS = (process.env.NEXT_PUBLIC_VAULT_ADDRESS ??
  "0x9D500710df8036e4BdF38Bf9A6CA7364Cd4e26C1") as `0x${string}`;
/** v1 vault, kept only so the EF devnet prototype keeps its own wiring straight. */
export const VAULT_V1_ADDRESS = "0x283776AB6c2B139d6097285821AC5EdDe43e115e" as `0x${string}`;
/** v2 has no paymaster: with no fee to sponsor, there is nothing for one to do. */
export const PAYMASTER_ADDRESS =
  "0x0000000000000000000000000000000000000000" as `0x${string}`;
export const ARBITRATOR_ADDRESS = (process.env.NEXT_PUBLIC_ARBITRATOR_ADDRESS ??
  "0x65B555dDAd787B66F3F1E4Dd4Ff814D11B9A0ed2") as `0x${string}`;
export { DEAL_STATUS_V2, DEAL_STATUS_V2_LABEL };
export const USDC_ADDRESS = (process.env.NEXT_PUBLIC_USDC_ADDRESS ??
  "0x3600000000000000000000000000000000000000") as `0x${string}`;
export const ARC_RPC = process.env.NEXT_PUBLIC_ARC_RPC_URL ?? "https://rpc.testnet.arc.io";
export const ARC_EXPLORER = "https://explorer.testnet.arc.io";
/** The alt-mempool devnet explorer (frame pool explorer). Shows frame transactions. */
export const DEVNET_EXPLORER = "https://explorer.altmempool.wtf";

// ───────────────────── EF alt-mempool (prototype) ───────────────

export const ALT_MEMPOOL_RPC =
  process.env.NEXT_PUBLIC_ALT_MEMPOOL_RPC ?? "https://altmempool.forshtat.com/rpc";
export const ALT_MEMPOOL_READ_RPC =
  process.env.NEXT_PUBLIC_ALT_MEMPOOL_READ_RPC ?? "https://altmempool.forshtat.com";

export const DEVNET_VAULT_ADDRESS = (process.env.NEXT_PUBLIC_DEVNET_VAULT_ADDRESS ??
  "0x41CDbF113356EC57dDF893b15e8F3D4Fec6a9234") as `0x${string}`;
export const DEVNET_PAYMASTER_ADDRESS = (process.env.NEXT_PUBLIC_DEVNET_PAYMASTER_ADDRESS ??
  "0xC04F147b94D002dCe42953c145906D652999A9A4") as `0x${string}`;

// ─────────────── Backwards-compatible aliases (legacy) ──────────
// These names were used by the first two-screen prototype. They point at
// the Arc deployment so existing imports keep working while the UI moves
// to VAULT_ADDRESS.
export const ESCROW_ADDRESS = VAULT_ADDRESS;
export const READ_RPC = ARC_RPC;
export const ESCROW_ABI = BOUNTY_VAULT_ABI;

export { BOUNTY_VAULT_ABI, ERC20_ABI, DEAL_STATUS, DEAL_STATUS_LABEL };
