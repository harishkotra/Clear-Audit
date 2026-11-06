"use client";

import { useCallback, useState } from "react";
import { useAccount, usePublicClient, useWalletClient } from "wagmi";
import { decodeEventLog, isAddress, parseUnits, zeroAddress } from "viem";
import {
  ARC_CHAIN_ID,
  BOUNTY_VAULT_ABI,
  ERC20_ABI,
  USDC_ADDRESS,
  VAULT_ADDRESS,
} from "@/lib/constants";

type Tx = `0x${string}`;

function humanError(e: unknown) {
  return (
    (e as { shortMessage?: string })?.shortMessage ??
    (e as Error)?.message ??
    "Something went wrong. Try again."
  );
}

/**
 * Write paths against the vault. The chain is the source of truth: decimals
 * come from the token, allowances are reused, and the new id is read from the
 * BountyCreated event rather than assumed.
 */
export function useEscrow() {
  const { address } = useAccount();
  const publicClient = usePublicClient();
  const { data: walletClient } = useWalletClient();
  const [isPending, setIsPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const ready = Boolean(address && publicClient && walletClient);

  const fundReward = useCallback(
    async (researcher: `0x${string}`, amountUsdc: string) => {
      if (!ready || !address || !publicClient || !walletClient) {
        throw new Error("Connect your wallet first.");
      }
      if (walletClient.chain?.id !== ARC_CHAIN_ID) {
        throw new Error("Switch your wallet to Arc Testnet to fund a reward.");
      }
      if (!isAddress(researcher)) throw new Error("Enter a valid researcher wallet address.");
      if (researcher.toLowerCase() === address.toLowerCase()) {
        throw new Error("You cannot name your own wallet as the researcher.");
      }

      setIsPending(true);
      setError(null);
      try {
        const decimals = (await publicClient.readContract({
          address: USDC_ADDRESS,
          abi: ERC20_ABI,
          functionName: "decimals",
        })) as number;

        const amount = parseUnits(amountUsdc, decimals);
        if (amount <= 0n) throw new Error("Amount must be greater than zero.");

        const balance = (await publicClient.readContract({
          address: USDC_ADDRESS,
          abi: ERC20_ABI,
          functionName: "balanceOf",
          args: [address],
        })) as bigint;
        if (balance < amount) {
          throw new Error(
            `Not enough USDC. You have ${(Number(balance) / 10 ** decimals).toFixed(2)}.`,
          );
        }

        const allowance = (await publicClient.readContract({
          address: USDC_ADDRESS,
          abi: ERC20_ABI,
          functionName: "allowance",
          args: [address, VAULT_ADDRESS],
        })) as bigint;

        let approveHash: Tx | undefined;
        if (allowance < amount) {
          approveHash = await walletClient.writeContract({
            address: USDC_ADDRESS,
            abi: ERC20_ABI,
            functionName: "approve",
            args: [VAULT_ADDRESS, amount],
            account: address,
            chain: walletClient.chain,
          });
          const approval = await publicClient.waitForTransactionReceipt({ hash: approveHash });
          if (approval.status !== "success") throw new Error("Approval was reverted.");
        }

        const hash = await walletClient.writeContract({
          address: VAULT_ADDRESS,
          abi: BOUNTY_VAULT_ABI,
          functionName: "createBounty",
          args: [researcher, amount],
          account: address,
          chain: walletClient.chain,
        });
        const receipt = await publicClient.waitForTransactionReceipt({ hash });
        if (receipt.status !== "success") throw new Error("Funding was reverted.");

        let dealId: bigint | undefined;
        for (const log of receipt.logs) {
          try {
            const decoded = decodeEventLog({
              abi: BOUNTY_VAULT_ABI,
              eventName: "BountyCreated",
              data: log.data,
              topics: log.topics,
            });
            dealId = decoded.args.dealId as bigint;
            break;
          } catch {
            /* not the event we want */
          }
        }
        if (dealId === undefined) throw new Error("Reward was created but the event was missing.");

        return { approveHash, hash, dealId };
      } catch (e: unknown) {
        setError(humanError(e));
        throw e;
      } finally {
        setIsPending(false);
      }
    },
    [address, publicClient, ready, walletClient],
  );

  const releaseReward = useCallback(
    async (dealId: string) => {
      if (!ready || !address || !publicClient || !walletClient) {
        throw new Error("Connect your wallet first.");
      }
      if (walletClient.chain?.id !== ARC_CHAIN_ID) {
        throw new Error("Switch your wallet to Arc Testnet to release a payment.");
      }
      setIsPending(true);
      setError(null);
      try {
        // Arkiv is load-bearing: the server refuses to help settle a bounty
        // whose evidence is missing, expired, or describes another beneficiary.
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

        const hash = await walletClient.writeContract({
          address: VAULT_ADDRESS,
          abi: BOUNTY_VAULT_ABI,
          functionName: "releaseBounty",
          args: [BigInt(dealId), 0n, zeroAddress],
          account: address,
          chain: walletClient.chain,
        });
        const receipt = await publicClient.waitForTransactionReceipt({ hash });
        if (receipt.status !== "success") throw new Error("The payment was reverted.");
        return { hash };
      } catch (e: unknown) {
        setError(humanError(e));
        throw e;
      } finally {
        setIsPending(false);
      }
    },
    [address, publicClient, ready, walletClient],
  );

  const disputeReward = useCallback(
    async (dealId: string) => {
      if (!ready || !address || !publicClient || !walletClient) {
        throw new Error("Connect your wallet first.");
      }
      if (walletClient.chain?.id !== ARC_CHAIN_ID) {
        throw new Error("Switch your wallet to Arc Testnet first.");
      }
      setIsPending(true);
      setError(null);
      try {
        const hash = await walletClient.writeContract({
          address: VAULT_ADDRESS,
          abi: BOUNTY_VAULT_ABI,
          functionName: "disputeBounty",
          args: [BigInt(dealId)],
          account: address,
          chain: walletClient.chain,
        });
        const receipt = await publicClient.waitForTransactionReceipt({ hash });
        if (receipt.status !== "success") throw new Error("The dispute was reverted.");
        return { hash };
      } catch (e: unknown) {
        setError(humanError(e));
        throw e;
      } finally {
        setIsPending(false);
      }
    },
    [address, publicClient, ready, walletClient],
  );

  return { fundReward, releaseReward, disputeReward, isPending, error, address, ready };
}
