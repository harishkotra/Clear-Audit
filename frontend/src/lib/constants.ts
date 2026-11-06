import { BOUNTY_VAULT_ABI, ERC20_ABI, DEAL_STATUS, DEAL_STATUS_LABEL } from "./abi";

// ─────────────────────────── Chains ────────────────────────────

/** Arc Testnet. USDC is the native gas token (18 decimals) and also the settlement asset. */
export const ARC_CHAIN_ID = 5042002;
/** EIP-8141 alt-mempool reference devnet. Used for the sponsorship prototype only. */
export const DEVNET_CHAIN_ID = 1337;

// ───────────────────────── Arc Testnet (product) ────────────────

export const VAULT_ADDRESS = (process.env.NEXT_PUBLIC_VAULT_ADDRESS ??
  "0x283776AB6c2B139d6097285821AC5EdDe43e115e") as `0x${string}`;
export const PAYMASTER_ADDRESS = (process.env.NEXT_PUBLIC_PAYMASTER_ADDRESS ??
  "0xEFFD38f3768c3A77E14424a8033c4CE3F91Fba2B") as `0x${string}`;
export const USDC_ADDRESS = (process.env.NEXT_PUBLIC_USDC_ADDRESS ??
  "0x3600000000000000000000000000000000000000") as `0x${string}`;
export const ARC_RPC = process.env.NEXT_PUBLIC_ARC_RPC_URL ?? "https://rpc.testnet.arc.io";
export const ARC_EXPLORER = "https://explorer.testnet.arc.io";

// ───────────────────── EF alt-mempool (prototype) ───────────────

export const ALT_MEMPOOL_RPC =
  process.env.NEXT_PUBLIC_ALT_MEMPOOL_RPC ?? "https://altmempool.forshtat.com/rpc";
export const ALT_MEMPOOL_READ_RPC =
  process.env.NEXT_PUBLIC_ALT_MEMPOOL_READ_RPC ?? "https://altmempool.forshtat.com";

export const DEVNET_VAULT_ADDRESS = (process.env.NEXT_PUBLIC_DEVNET_VAULT_ADDRESS ??
  "0x8460274B30764c09799f275280CEbA1F1dC5B347") as `0x${string}`;
export const DEVNET_PAYMASTER_ADDRESS = (process.env.NEXT_PUBLIC_DEVNET_PAYMASTER_ADDRESS ??
  "0xA03613a311632EEc5a8bE80CeF034d456d4D6F02") as `0x${string}`;

// ─────────────── Backwards-compatible aliases (legacy) ──────────
// These names were used by the first two-screen prototype. They point at
// the Arc deployment so existing imports keep working while the UI moves
// to VAULT_ADDRESS.
export const ESCROW_ADDRESS = VAULT_ADDRESS;
export const READ_RPC = ARC_RPC;
export const ESCROW_ABI = BOUNTY_VAULT_ABI;

export { BOUNTY_VAULT_ABI, ERC20_ABI, DEAL_STATUS, DEAL_STATUS_LABEL };
