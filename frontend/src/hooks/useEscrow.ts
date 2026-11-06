"use client";

import { useCallback, useState } from "react";
import { useAccount, usePublicClient, useWalletClient } from "wagmi";
import { decodeEventLog, isAddress, parseUnits } from "viem";
import { BOUNTY_VAULT_V2_ABI } from "@/lib/abi";
import { ARC_CHAIN_ID, ERC20_ABI, USDC_ADDRESS, VAULT_ADDRESS } from "@/lib/constants";

type Tx = `0x${string}`;

function humanError(e: unknown) {
  return (
    (e as { shortMessage?: string })?.shortMessage ??
    (e as Error)?.message ??
    "Something went wrong. Try again."
  );
}

/** Zero hash means "no acceptance criteria recorded". The gate reads it as unset. */
export const NO_CRITERIA = `0x${"00".repeat(32)}` as `0x${string}`;

export type FundOptions = {
  /** Unix seconds. 0 is allowed for a deal with a named payee. */
  deadline?: number;
  /** keccak256 of the acceptance criteria text, or zero for none. */
  criteriaHash?: `0x${string}`;
};

/**
 * Write paths against the v2 vault. The chain is the source of truth: decimals
 * come from the token, allowances are reused, and the new id is read from the
 * BountyCreated event rather than assumed.
 *
 * release() takes no recipient argument, so nothing in this file can redirect
 * escrow: the payee is fixed on chain at funding time.
 */
export function useEscrow() {
  const { address } = useAccount();
  const publicClient = usePublicClient();
  const { data: walletClient } = useWalletClient();
  const [isPending, setIsPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const ready = Boolean(address && publicClient && walletClient);

  const requireWallet = useCallback(
    (action: string) => {
      if (!ready || !address || !publicClient || !walletClient) {
        throw new Error("Connect your wallet first.");
      }
      if (walletClient.chain?.id !== ARC_CHAIN_ID) {
        throw new Error(`Switch your wallet to Arc Testnet to ${action}.`);
      }
      return { address, publicClient, walletClient };
    },
    [address, publicClient, ready, walletClient],
  );

  const run = useCallback(
    async (label: string, send: () => Promise<Tx>) => {
      setIsPending(true);
      setError(null);
      try {
        const hash = await send();
        const client = publicClient;
        if (!client) throw new Error("Connect your wallet first.");
        const receipt = await client.waitForTransactionReceipt({ hash });
        if (receipt.status !== "success") throw new Error(`The ${label} was reverted.`);
        return { hash, receipt };
      } catch (e: unknown) {
        setError(humanError(e));
        throw e;
      } finally {
        setIsPending(false);
      }
    },
    [publicClient],
  );

  /** Approve the vault for the exact amount, then run the funding call. */
  const approveAndFund = useCallback(
    async (label: string, amountUsdc: string, fund: (amount: bigint) => Promise<Tx>) => {
      const w = requireWallet(label);
      setIsPending(true);
      setError(null);
      try {
        const decimals = (await w.publicClient.readContract({
          address: USDC_ADDRESS,
          abi: ERC20_ABI,
          functionName: "decimals",
        })) as number;

        const amount = parseUnits(amountUsdc, decimals);
        if (amount <= 0n) throw new Error("Amount must be greater than zero.");

        const balance = (await w.publicClient.readContract({
          address: USDC_ADDRESS,
          abi: ERC20_ABI,
          functionName: "balanceOf",
          args: [w.address],
        })) as bigint;
        if (balance < amount) {
          throw new Error(
            `Not enough USDC. You have ${(Number(balance) / 10 ** decimals).toFixed(2)}.`,
          );
        }

        const allowance = (await w.publicClient.readContract({
          address: USDC_ADDRESS,
          abi: ERC20_ABI,
          functionName: "allowance",
          args: [w.address, VAULT_ADDRESS],
        })) as bigint;

        let approveHash: Tx | undefined;
        if (allowance < amount) {
          approveHash = await w.walletClient.writeContract({
            address: USDC_ADDRESS,
            abi: ERC20_ABI,
            functionName: "approve",
            args: [VAULT_ADDRESS, amount],
            account: w.address,
            chain: w.walletClient.chain,
          });
          const approval = await w.publicClient.waitForTransactionReceipt({ hash: approveHash });
          if (approval.status !== "success") throw new Error("Approval was reverted.");
        }

        const hash = await fund(amount);
        const receipt = await w.publicClient.waitForTransactionReceipt({ hash });
        if (receipt.status !== "success") throw new Error("Funding was reverted.");

        let dealId: bigint | undefined;
        for (const log of receipt.logs) {
          try {
            const decoded = decodeEventLog({
              abi: BOUNTY_VAULT_V2_ABI,
              eventName: "BountyCreated",
              data: log.data,
              topics: log.topics,
            });
            dealId = decoded.args.id as bigint;
            break;
          } catch {
            /* not the event we want */
          }
        }
        if (dealId === undefined) throw new Error("The deal was created but the event was missing.");

        return { approveHash, hash, dealId };
      } catch (e: unknown) {
        setError(humanError(e));
        throw e;
      } finally {
        setIsPending(false);
      }
    },
    [requireWallet],
  );

  /** Fund one named payee. No one else can ever be paid. */
  const fundReward = useCallback(
    async (payee: `0x${string}`, amountUsdc: string, opts: FundOptions = {}) => {
      if (!isAddress(payee)) throw new Error("Enter a valid payee wallet address.");
      if (address && payee.toLowerCase() === address.toLowerCase()) {
        throw new Error("You cannot name your own wallet as the payee.");
      }
      const w = requireWallet("fund a deal");
      return approveAndFund("fund a deal", amountUsdc, (amount) =>
        w.walletClient.writeContract({
          address: VAULT_ADDRESS,
          abi: BOUNTY_VAULT_V2_ABI,
          functionName: "createBounty",
          args: [payee, amount, BigInt(opts.deadline ?? 0), opts.criteriaHash ?? NO_CRITERIA],
          account: w.address,
          chain: w.walletClient.chain,
        }),
      );
    },
    [address, approveAndFund, requireWallet],
  );

  /** Escrow a contest prize. The arbitrator later awards shares to registered entrants. */
  const openContest = useCallback(
    async (amountUsdc: string, deadline: number, criteriaHash: `0x${string}` = NO_CRITERIA) => {
      if (!deadline || deadline <= Math.floor(Date.now() / 1000)) {
        throw new Error("A contest needs a deadline in the future.");
      }
      const w = requireWallet("open a contest");
      return approveAndFund("open a contest", amountUsdc, (amount) =>
        w.walletClient.writeContract({
          address: VAULT_ADDRESS,
          abi: BOUNTY_VAULT_V2_ABI,
          functionName: "createContest",
          args: [amount, BigInt(deadline), criteriaHash],
          account: w.address,
          chain: w.walletClient.chain,
        }),
      );
    },
    [approveAndFund, requireWallet],
  );

  /** Open work to any agent. A deadline is mandatory: it is the refund path. */
  const openTask = useCallback(
    async (amountUsdc: string, deadline: number, criteriaHash: `0x${string}` = NO_CRITERIA) => {
      if (!deadline || deadline <= Math.floor(Date.now() / 1000)) {
        throw new Error("An open task needs a deadline in the future.");
      }
      const w = requireWallet("open a task");
      return approveAndFund("open a task", amountUsdc, (amount) =>
        w.walletClient.writeContract({
          address: VAULT_ADDRESS,
          abi: BOUNTY_VAULT_V2_ABI,
          functionName: "createOpenTask",
          args: [amount, BigInt(deadline), criteriaHash],
          account: w.address,
          chain: w.walletClient.chain,
        }),
      );
    },
    [approveAndFund, requireWallet],
  );

  const releaseReward = useCallback(
    async (dealId: string) => {
      const w = requireWallet("release a payment");
      setIsPending(true);
      setError(null);
      try {
        // Arkiv is load-bearing: the server refuses to help settle a deal whose
        // evidence is missing, expired, or describes another beneficiary.
        const guardRes = await fetch("/api/release-guard", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ dealId }),
        });
        const guard = await guardRes.json().catch(() => ({}));
        if (!guardRes.ok || guard.ok !== true) {
          throw new Error(
            `Release blocked: ${guard.reason ?? guard.error ?? "the evidence anchor is not valid."}`,
          );
        }

        const hash = await w.walletClient.writeContract({
          address: VAULT_ADDRESS,
          abi: BOUNTY_VAULT_V2_ABI,
          functionName: "release",
          args: [BigInt(dealId)],
          account: w.address,
          chain: w.walletClient.chain,
        });
        const receipt = await w.publicClient.waitForTransactionReceipt({ hash });
        if (receipt.status !== "success") throw new Error("The payment was reverted.");
        return { hash };
      } catch (e: unknown) {
        setError(humanError(e));
        throw e;
      } finally {
        setIsPending(false);
      }
    },
    [requireWallet],
  );

  const claimTask = useCallback(
    async (dealId: string) => {
      const w = requireWallet("claim this task");
      return run("claim", () =>
        w.walletClient.writeContract({
          address: VAULT_ADDRESS,
          abi: BOUNTY_VAULT_V2_ABI,
          functionName: "claimTask",
          args: [BigInt(dealId)],
          account: w.address,
          chain: w.walletClient.chain,
        }),
      );
    },
    [requireWallet, run],
  );

  const disputeReward = useCallback(
    async (dealId: string) => {
      const w = requireWallet("open a dispute");
      return run("dispute", () =>
        w.walletClient.writeContract({
          address: VAULT_ADDRESS,
          abi: BOUNTY_VAULT_V2_ABI,
          functionName: "dispute",
          args: [BigInt(dealId)],
          account: w.address,
          chain: w.walletClient.chain,
        }),
      );
    },
    [requireWallet, run],
  );

  /** Past the deadline, an unclaimed or unaccepted task can be refunded by anyone. */
  const refundTask = useCallback(
    async (dealId: string) => {
      const w = requireWallet("refund this task");
      return run("refund", () =>
        w.walletClient.writeContract({
          address: VAULT_ADDRESS,
          abi: BOUNTY_VAULT_V2_ABI,
          functionName: "refundExpired",
          args: [BigInt(dealId)],
          account: w.address,
          chain: w.walletClient.chain,
        }),
      );
    },
    [requireWallet, run],
  );

  const cancelTask = useCallback(
    async (dealId: string) => {
      const w = requireWallet("cancel this task");
      return run("cancellation", () =>
        w.walletClient.writeContract({
          address: VAULT_ADDRESS,
          abi: BOUNTY_VAULT_V2_ABI,
          functionName: "cancel",
          args: [BigInt(dealId)],
          account: w.address,
          chain: w.walletClient.chain,
        }),
      );
    },
    [requireWallet, run],
  );

  /** Arbitrator only. Sends the full escrow to the payee or back to the payer. */
  const resolveDispute = useCallback(
    async (dealId: string, toPayee: boolean) => {
      const w = requireWallet("resolve this dispute");
      return run("resolution", () =>
        w.walletClient.writeContract({
          address: VAULT_ADDRESS,
          abi: BOUNTY_VAULT_V2_ABI,
          functionName: "resolveDispute",
          args: [BigInt(dealId), toPayee],
          account: w.address,
          chain: w.walletClient.chain,
        }),
      );
    },
    [requireWallet, run],
  );

  /**
   * v3 only. Live v2 has no commitEvidence selector; the wallet reverts and we
   * surface that as "this vault does not gate release on chain yet."
   */
  const commitEvidence = useCallback(
    async (dealId: string, hash: `0x${string}`, expiresAt: number) => {
      if (!hash || hash === NO_CRITERIA) throw new Error("Evidence hash is missing.");
      if (expiresAt <= Math.floor(Date.now() / 1000)) {
        throw new Error("The evidence expiry is already in the past.");
      }
      const w = requireWallet("commit evidence");
      return run("evidence commit", () =>
        w.walletClient.writeContract({
          address: VAULT_ADDRESS,
          abi: BOUNTY_VAULT_V2_ABI,
          functionName: "commitEvidence",
          args: [BigInt(dealId), hash, BigInt(expiresAt)],
          account: w.address,
          chain: w.walletClient.chain,
        }),
      );
    },
    [requireWallet, run],
  );

  /** v3 only. Anyone may pay the stored payee after the challenge window. */
  const settleAfterChallenge = useCallback(
    async (dealId: string) => {
      const w = requireWallet("settle after the challenge window");
      return run("settlement", () =>
        w.walletClient.writeContract({
          address: VAULT_ADDRESS,
          abi: BOUNTY_VAULT_V2_ABI,
          functionName: "settleAfterChallenge",
          args: [BigInt(dealId)],
          account: w.address,
          chain: w.walletClient.chain,
        }),
      );
    },
    [requireWallet, run],
  );

  const enterContest = useCallback(
    async (dealId: string) => {
      const w = requireWallet("enter this contest");
      return run("contest entry", () =>
        w.walletClient.writeContract({
          address: VAULT_ADDRESS,
          abi: BOUNTY_VAULT_V2_ABI,
          functionName: "enterContest",
          args: [BigInt(dealId)],
          account: w.address,
          chain: w.walletClient.chain,
        }),
      );
    },
    [requireWallet, run],
  );

  const registerEntrant = useCallback(
    async (dealId: string, entrant: `0x${string}`) => {
      if (!isAddress(entrant)) throw new Error("Enter a valid entrant address.");
      const w = requireWallet("register an entrant");
      return run("entrant registration", () =>
        w.walletClient.writeContract({
          address: VAULT_ADDRESS,
          abi: BOUNTY_VAULT_V2_ABI,
          functionName: "registerEntrant",
          args: [BigInt(dealId), entrant],
          account: w.address,
          chain: w.walletClient.chain,
        }),
      );
    },
    [requireWallet, run],
  );

  /** Arbitrator only. Pays registered entrants; amounts must sum to the escrow. */
  const awardContest = useCallback(
    async (dealId: string, winners: `0x${string}`[], amounts: bigint[]) => {
      if (winners.length === 0 || winners.length !== amounts.length) {
        throw new Error("Each winner needs an amount, and they must sum to the prize.");
      }
      const w = requireWallet("award this contest");
      return run("contest award", () =>
        w.walletClient.writeContract({
          address: VAULT_ADDRESS,
          abi: BOUNTY_VAULT_V2_ABI,
          functionName: "award",
          args: [BigInt(dealId), winners, amounts],
          account: w.address,
          chain: w.walletClient.chain,
        }),
      );
    },
    [requireWallet, run],
  );

  return {
    fundReward,
    openTask,
    openContest,
    releaseReward,
    claimTask,
    enterContest,
    registerEntrant,
    awardContest,
    refundTask,
    cancelTask,
    disputeReward,
    resolveDispute,
    commitEvidence,
    settleAfterChallenge,
    isPending,
    error,
    address,
    ready,
  };
}
