import { NextResponse } from "next/server";
import { BOUNTY_VAULT_ABI, ERC20_ABI } from "@/lib/abi";
import { ARC_CHAIN_ID, USDC_ADDRESS, VAULT_ADDRESS } from "@/lib/constants";
import { arcClient, readToken } from "@/lib/arc";
import { arkivWriterStatus } from "@/lib/arkiv";
import { STATUS_COPY } from "@/lib/format";

/**
 * Live Arc state for the workspace. Nothing here is seeded or hardcoded:
 * an empty vault returns empty arrays and zero totals.
 */
const MAX_DEALS = 30;

export async function GET() {
  try {
    const [nextDealId, balance, token] = await Promise.all([
      arcClient.readContract({
        address: VAULT_ADDRESS,
        abi: BOUNTY_VAULT_ABI,
        functionName: "nextDealId",
      }) as Promise<bigint>,
      arcClient.readContract({
        address: USDC_ADDRESS,
        abi: ERC20_ABI,
        functionName: "balanceOf",
        args: [VAULT_ADDRESS],
      }).catch(() => 0n) as Promise<bigint>,
      readToken(),
    ]);

    const count = Number(nextDealId);
    const ids = Array.from({ length: Math.min(count, MAX_DEALS) }, (_, i) =>
      BigInt(count - 1 - i),
    );

    const deals = await Promise.all(
      ids.map(async (id) => {
        const [company, researcher, amount, status] = (await arcClient.readContract({
          address: VAULT_ADDRESS,
          abi: BOUNTY_VAULT_ABI,
          functionName: "getDeal",
          args: [id],
        })) as readonly [`0x${string}`, `0x${string}`, bigint, number];

        return {
          id: String(id),
          company,
          researcher,
          amount: amount.toString(),
          status,
          statusLabel: STATUS_COPY[status]?.label ?? "Unknown",
        };
      }),
    );

    const totals = deals.reduce(
      (acc, d) => {
        const amount = BigInt(d.amount);
        if (d.status === 1) {
          acc.open += 1;
          acc.openAmount += amount;
        }
        if (d.status === 2) acc.review += 1;
        if (d.status === 3 || d.status === 4) {
          acc.paid += 1;
          acc.paidAmount += amount;
        }
        return acc;
      },
      { open: 0, review: 0, paid: 0, openAmount: 0n, paidAmount: 0n },
    );

    const writer = await arkivWriterStatus();

    return NextResponse.json({
      chainId: ARC_CHAIN_ID,
      vault: VAULT_ADDRESS,
      token: { address: USDC_ADDRESS, symbol: token.symbol, decimals: token.decimals },
      escrowed: balance.toString(),
      totalRewards: count,
      counts: { open: totals.open, review: totals.review, paid: totals.paid },
      totals: { open: totals.openAmount.toString(), paid: totals.paidAmount.toString() },
      deals,
      arkiv: {
        gate: process.env.REQUIRE_ARKIV_ANCHOR !== "false",
        writer: writer.ok ? "ready" : "not-ready",
        writerAddress: writer.address,
        reason: writer.ok ? null : writer.reason,
      },
    });
  } catch (e: unknown) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Arc read failed" },
      { status: 502 },
    );
  }
}
