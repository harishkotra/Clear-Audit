import { Suspense } from "react";
import Link from "next/link";
import AppShell from "@/components/AppShell";
import { GaslessPanel } from "@/components/GaslessPanel";
import { SkeletonRows, Stat } from "@/components/ui";
import { readDevnetState } from "@/lib/devnet";
import { DEVNET_CHAIN_ID, DEVNET_EXPLORER } from "@/lib/constants";

const REFERENCES = [
  ["0x9d69aae87b60cf040d81cdb9e5f826ebd50185679259f08f16c22fb861986556", "release paid by the protocol relayer, researcher received 1 000 mUSDC"],
  ["0x3374f12ebbcc9f88ff8e1ce36ca48a0e9671f4089769b02971b8a01c8b37787a", "deal #2 opened, 250 mUSDC, still open"],
  ["0xddb34fe4677e40f1973a8bc76680b490630455a4377f2f5979803660da6c6431", "BountyVault deployed on the devnet"],
] as const;

function usdc6(v: bigint) {
  return (Number(v) / 1e6).toLocaleString(undefined, { maximumFractionDigits: 2 });
}

function openTotal(state: Awaited<ReturnType<typeof readDevnetState>> | null) {
  if (!state) return "—";
  return usdc6(state.openDeals.reduce((sum, d) => sum + d.amount, 0n));
}

async function DevnetSection() {
  let state: Awaited<ReturnType<typeof readDevnetState>> | null = null;
  let failure: string | null = null;
  try {
    state = await readDevnetState();
  } catch (e) {
    failure = e instanceof Error ? e.message : "The EF devnet is unreachable.";
  }

  return (
    <>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Stat
          label="Devnet chain"
          value={DEVNET_CHAIN_ID}
          hint="Separate from Arc — a research artifact, not a bridge"
        />
        <Stat
          label="Open bounties"
          value={state ? state.openDeals.length : "—"}
          hint={state ? `of ${state.deals.length} total on devnet` : "devnet unreachable"}
          accent
        />
        <Stat
          label="Escrowed"
          value={openTotal(state)}
          unit="mUSDC"
          hint="Devnet mock USDC, valueless"
        />
        <Stat label="Researcher gas" value="0" unit="ETH" hint="Paid by the protocol relayer" />
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-[1fr_320px]">
        <div className="card p-5">
          <h2 className="text-[14px] font-medium text-white">Run the flow</h2>
          <p className="mt-1 mb-4 text-[12.5px] leading-relaxed text-zinc-500">
            Anchor a demo finding on Arkiv, then release the devnet bounty. The relayer signs the
            frame transaction; the researcher&apos;s wallet is only the beneficiary.
          </p>
          {failure ? (
            <div className="rounded-xl border border-amber-400/25 bg-amber-400/[0.06] px-3.5 py-2.5 text-[12.5px] leading-relaxed text-amber-300">
              The EF devnet is not answering right now ({failure}). The reference transactions below
              were mined on this chain and remain the evidence for the flow.
            </div>
          ) : state && state.head && state.head.ageSeconds > 600 ? (
            <div className="rounded-xl border border-amber-400/25 bg-amber-400/[0.06] px-3.5 py-2.5 text-[12.5px] leading-relaxed text-amber-300">
              The EF devnet has not produced a block since{" "}
              {new Date(Date.now() - state.head.ageSeconds * 1000).toISOString().slice(0, 16).replace("T", " ")}{" "}
              UTC (head #{state.head.number.toString()}), so a release would hang. The anchor and guard
              still run — the settlement step answers 503 and submits nothing.
            </div>
          ) : state ? (
            <GaslessPanel
              open={state.openDeals.map((d) => ({
                id: d.id,
                amount: usdc6(d.amount),
                whitehat: d.whitehat,
              }))}
            />
          ) : null}
        </div>

        <aside className="space-y-4">
          <div className="card p-4">
            <h2 className="text-[13px] font-medium text-white">Wiring</h2>
            <dl className="mt-3 space-y-2.5 text-[12px]">
              <div className="flex items-center justify-between gap-3">
                <dt className="text-zinc-500">Vault</dt>
                <dd className="font-mono text-zinc-300">
                  {state?.vault.slice(0, 10) ?? "0x41CDbF11"}…
                </dd>
              </div>
              <div className="flex items-center justify-between gap-3">
                <dt className="text-zinc-500">Paymaster</dt>
                <dd className="font-mono text-zinc-300" title="Deployed and funded, but this devnet revision accepts only one VERIFY frame, so no frame routes payment through it">
                  {state?.paymaster.slice(0, 10) ?? "0xC04F147b"}… <span className="text-zinc-600">unused</span>
                </dd>
              </div>
              <div className="flex items-center justify-between gap-3">
                <dt className="text-zinc-500">Asset</dt>
                <dd className="text-zinc-300">mUSDC (6d)</dd>
              </div>
              <div className="flex items-center justify-between gap-3">
                <dt className="text-zinc-500">Frames</dt>
                <dd className="text-zinc-300">VERIFY · SENDER</dd>
              </div>
            </dl>
          </div>

          <div className="card p-4">
            <h2 className="text-[13px] font-medium text-white">Reference transactions</h2>
            <ul className="mt-3 space-y-2.5">
              {REFERENCES.map(([hash, label]) => (
                <li key={hash} className="text-[11.5px] leading-relaxed">
                  <span className="block text-zinc-400">{label}</span>
                  <a
                    href={`${DEVNET_EXPLORER}/tx/${hash}`}
                    target="_blank"
                    rel="noreferrer"
                    title="Open in the frame-pool explorer"
                    className="block break-all font-mono text-[10.5px] text-zinc-600 underline decoration-white/15 underline-offset-4 transition hover:text-zinc-300"
                  >
                    {hash}
                  </a>
                </li>
              ))}
            </ul>
            <p className="mt-3 text-[11px] leading-relaxed text-zinc-600">
              Verify any of them with{" "}
              <code className="text-zinc-400">eth_getTransactionReceipt</code> on the alt-mempool RPC.
            </p>
          </div>
        </aside>
      </div>
    </>
  );
}

export default function GaslessPage() {
  return (
    <AppShell
      title="Gasless settlement"
      subtitle="The EF Alternative Mempool path: an EIP-8141 frame transaction whose payment frame is sponsored, so the researcher never needs a gas token."
      actions={<Link href="/app/rewards" className="btn btn-ghost">Back to rewards</Link>}
    >
      <Suspense fallback={<SkeletonRows rows={4} />}>
        <DevnetSection />
      </Suspense>

      <div className="mt-4 card p-5">
        <h2 className="text-[14px] font-medium text-white">Why this matters for the product</h2>
        <div className="mt-3 grid gap-4 text-[12.5px] leading-relaxed text-zinc-400 sm:grid-cols-3">
          <p>
            <span className="block text-[12px] font-medium text-zinc-200">Sponsorship without an EntryPoint</span>
            The payment frame authorises the fee, so settlement does not depend on a bundler holding a
            deposit for this vault.
          </p>
          <p>
            <span className="block text-[12px] font-medium text-zinc-200">Evidence still gates the payout</span>
            The same Arkiv policy runs here: no live anchor, no settlement. The guard is exercised by
            the demo button, not just documented.
          </p>
          <p>
            <span className="block text-[12px] font-medium text-zinc-200">Arc remains the product</span>
            Bounties, custody and the arbitrator live on Arc. This page is the research artifact we
            submitted for the EF track, and it says so in the UI.
          </p>
        </div>
      </div>
    </AppShell>
  );
}
