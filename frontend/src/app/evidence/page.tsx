import { Suspense } from "react";
import Link from "next/link";
import Brand from "@/components/Brand";
import { ARC_EXPLORER, VAULT_ADDRESS } from "@/lib/constants";
import { loadEvidence, type EvidenceVerdict } from "@/lib/evidence";
import { money, shortAddress, timeLeft } from "@/lib/format";
import { ZERO_ADDRESS } from "@/lib/proven";
import CopyButton from "./CopyButton";

const VERDICT_COPY: Record<EvidenceVerdict, { label: string; tone: string }> = {
  match: { label: "Match", tone: "text-[#8bd17c] border-[#8bd17c]/30 bg-[#8bd17c]/10" },
  mismatch: { label: "Mismatch", tone: "text-[#ff7a5c] border-[#ff7a5c]/30 bg-[#ff7a5c]/10" },
  missing: { label: "No anchor", tone: "text-[#ffb347] border-[#ffb347]/30 bg-[#ffb347]/10" },
  expired: { label: "Expired", tone: "text-[#ff7a5c] border-[#ff7a5c]/30 bg-[#ff7a5c]/10" },
  unreadable: { label: "Unreadable", tone: "text-[#ffb347] border-[#ffb347]/30 bg-[#ffb347]/10" },
  "no-payee": { label: "Unclaimed", tone: "text-[#a29c92] border-[var(--rule)] bg-white/[0.03]" },
  "not-open": { label: "Settled", tone: "text-[#a29c92] border-[var(--rule)] bg-white/[0.03]" },
};

function txUrl(hash: string) {
  return `${ARC_EXPLORER}/tx/${hash}`;
}

function shortHash(h?: string | null) {
  if (!h) return "—";
  if (h === `0x${"00".repeat(32)}`) return "none";
  return `${h.slice(0, 10)}…${h.slice(-6)}`;
}

function Row({ k, v, href }: { k: string; v: string; href?: string }) {
  return (
    <div className="flex items-baseline justify-between gap-4">
      <dt className="text-[#8d887f]">{k}</dt>
      <dd className="font-mono text-[#ece7dd]">
        {href ? (
          <a href={href} target="_blank" rel="noreferrer" className="hover:underline">
            {v} ↗
          </a>
        ) : (
          v
        )}
      </dd>
    </div>
  );
}

function EvidenceFallback() {
  return (
    <>
      <form className="mt-8 flex flex-wrap items-end gap-3" action="/evidence" method="get">
        <div>
          <label className="label" htmlFor="dealId">
            Deal id
          </label>
          <input
            id="dealId"
            name="dealId"
            className="field w-32 font-mono"
            defaultValue="0"
            inputMode="numeric"
          />
        </div>
        <button className="btn btn-primary h-10" type="submit">
          Check
        </button>
      </form>
      <p className="mt-6 text-[13px] text-[#8d887f]">Reading Arc and Arkiv…</p>
    </>
  );
}

async function EvidenceBody({
  searchParams,
}: {
  searchParams: Promise<{ dealId?: string }>;
}) {
  const sp = await searchParams;
  const dealId = /^\d+$/.test(sp.dealId ?? "") ? (sp.dealId as string) : "0";
  let data: Awaited<ReturnType<typeof loadEvidence>> | null = null;
  let error: string | null = null;
  try {
    data = await loadEvidence(dealId);
  } catch (e: unknown) {
    error = e instanceof Error ? e.message : "Could not read evidence.";
  }

  const now = Date.now();
  const copy = data ? VERDICT_COPY[data.verdict] : null;

  return (
    <>
        <form className="mt-8 flex flex-wrap items-end gap-3" action="/evidence" method="get">
          <div>
            <label className="label" htmlFor="dealId">
              Deal id
            </label>
            <input
              id="dealId"
              name="dealId"
              className="field w-32 font-mono"
              defaultValue={dealId}
              inputMode="numeric"
            />
          </div>
          <button className="btn btn-primary h-10" type="submit">
            Check
          </button>
        </form>

        {error && (
          <p className="mt-6 border border-[#ff7a5c]/30 bg-[#ff7a5c]/10 px-3.5 py-2.5 text-[13px] text-[#ff7a5c]">
            {error}
          </p>
        )}

        {data && copy && (
          <div className="mt-8 space-y-6">
            <div className={`inline-flex items-center gap-2 border px-3 py-1.5 text-[12px] ${copy.tone}`}>
              <span className="font-mono uppercase tracking-[0.12em]">{copy.label}</span>
              <span className="text-[#8d887f]">deal #{data.dealId}</span>
            </div>
            <ul className="space-y-1 text-[13.5px] leading-relaxed text-[#c9c3b8]">
              {data.reasons.map((r) => (
                <li key={r}>— {r}</li>
              ))}
            </ul>

            <div className="grid gap-4 sm:grid-cols-2">
              <section className="border border-[var(--rule)] p-4">
                <div className="micro">On chain · Arc {data.chainId}</div>
                <dl className="mt-3 space-y-2 text-[12.5px]">
                  <Row k="Vault" v={shortAddress(data.vault)} href={`${ARC_EXPLORER}/address/${VAULT_ADDRESS}`} />
                  <Row k="Payer" v={shortAddress(data.deal.payer)} />
                  <Row k="Payee" v={data.deal.payee === ZERO_ADDRESS ? "unclaimed" : shortAddress(data.deal.payee)} />
                  <Row k="Amount" v={money(data.deal.amount, 6)} />
                  <Row k="Status" v={String(data.deal.status)} />
                  <Row
                    k="Deadline"
                    v={data.deal.deadline ? timeLeft(String(data.deal.deadline), now) : "none"}
                  />
                  <Row k="Mode" v={data.deal.agentMode ? "open task" : "named payee"} />
                  <Row k="Criteria" v={shortHash(data.deal.criteriaHash)} />
                </dl>
                {!data.features.evidenceGate && (
                  <p className="mt-3 text-[11.5px] leading-relaxed text-[#8d887f]">
                    Live vault is v2. Release still pays without on-chain evidence; this page and
                    /api/release-guard are the application gate.
                  </p>
                )}
              </section>

              <section className="border border-[var(--rule)] p-4">
                <div className="micro">Arkiv · Rabdi 7794095</div>
                {data.arkiv ? (
                  <dl className="mt-3 space-y-2 text-[12.5px]">
                    <Row k="Entity" v={shortAddress(data.arkiv.key)} />
                    <Row k="Severity" v={data.arkiv.severity ?? "—"} />
                    <Row
                      k="Expires"
                      v={
                        data.arkiv.expiresAt
                          ? timeLeft(String(data.arkiv.expiresAt), now)
                          : "unreadable"
                      }
                    />
                    <Row k="Fingerprint" v={shortHash(data.arkiv.encryptedPayloadHash)} />
                    <Row k="Criteria" v={shortHash(data.arkiv.criteriaHash)} />
                    <Row k="Payee" v={shortAddress(data.arkiv.whitehatWallet)} />
                    <Row k="Payer" v={shortAddress(data.arkiv.protocolWallet)} />
                  </dl>
                ) : (
                  <p className="mt-3 text-[13px] leading-relaxed text-[#8d887f]">
                    No live entity. The researcher must anchor a fingerprint before the gate will
                    help pay.
                  </p>
                )}
              </section>
            </div>

            {data.evidence && data.evidence.hash !== `0x${"00".repeat(32)}` && (
              <section className="border border-[var(--rule)] p-4">
                <div className="micro">On-chain evidence (v3)</div>
                <dl className="mt-3 space-y-2 text-[12.5px]">
                  <Row k="Hash" v={shortHash(data.evidence.hash)} />
                  <Row k="Expires" v={timeLeft(String(data.evidence.expiresAt), now)} />
                  <Row k="Challenge until" v={timeLeft(String(data.evidence.challengeUntil), now)} />
                </dl>
              </section>
            )}

            <section className="border border-[var(--rule)]">
              <div className="flex items-center justify-between border-b border-[var(--rule)] px-3.5 py-2">
                <span className="micro">Arkiv query</span>
                <CopyButton text={data.query} />
              </div>
              <pre className="overflow-x-auto px-3.5 py-3 font-mono text-[11px] leading-[1.75] text-[#c9c3b8]">
                {data.query}
              </pre>
            </section>

            {data.proven.length > 0 && (
              <section className="border border-[var(--rule)] p-4">
                <div className="micro">Proven for this deal</div>
                <ul className="mt-3 space-y-3 text-[12.5px] leading-relaxed text-[#c9c3b8]">
                  {data.proven.map((p) => (
                    <li key={p.what}>
                      <div className="text-[#ece7dd]">{p.what}</div>
                      {"createTx" in p && p.createTx && (
                        <a className="mt-1 block text-[#8bd17c] hover:underline" href={txUrl(p.createTx)} target="_blank" rel="noreferrer">
                          create {shortAddress(p.createTx)} ↗
                        </a>
                      )}
                      {"anchorTx" in p && p.anchorTx && (
                        <a className="block text-[#8bd17c] hover:underline" href={txUrl(p.anchorTx)} target="_blank" rel="noreferrer">
                          anchor {shortAddress(p.anchorTx)} ↗
                        </a>
                      )}
                      {"releaseTx" in p && p.releaseTx && (
                        <a className="block text-[#8bd17c] hover:underline" href={txUrl(p.releaseTx)} target="_blank" rel="noreferrer">
                          release {shortAddress(p.releaseTx)} ↗
                        </a>
                      )}
                      {"guard" in p && p.guard && <div className="mt-1 text-[#8d887f]">{p.guard}</div>}
                      {"result" in p && p.result && <div className="text-[#8d887f]">{p.result}</div>}
                    </li>
                  ))}
                </ul>
              </section>
            )}
          </div>
        )}
    </>
  );
}

export default function EvidencePage({
  searchParams,
}: {
  searchParams: Promise<{ dealId?: string }>;
}) {
  return (
    <div className="min-h-screen bg-[#0b0b0c]">
      <header className="border-b border-[var(--rule)]">
        <div className="mx-auto flex h-14 w-full max-w-[900px] items-center justify-between px-5">
          <Brand />
          <nav className="flex items-center gap-5">
            <Link
              href="/"
              className="font-mono text-[10.5px] uppercase tracking-[0.13em] text-[#7d786f] hover:text-[#ece7dd]"
            >
              Home
            </Link>
            <Link href="/app" className="btn btn-primary h-8 px-3 text-[12px]">
              Open the rail
            </Link>
          </nav>
        </div>
      </header>

      <main className="mx-auto w-full max-w-[900px] px-5 py-12">
        <div className="micro">Public evidence</div>
        <h1 className="display mt-3 text-[36px] text-[#f3efe6] sm:text-[44px]">
          Re-run the gate.
        </h1>
        <p className="mt-4 max-w-[62ch] text-[14.5px] leading-[1.7] text-[#a29c92]">
          No wallet. One deal id. The vault row on Arc, the Arkiv entity on Rabdi, and whether they
          match. Anyone can copy the query and run it themselves.
        </p>

        <Suspense fallback={<EvidenceFallback />}>
          <EvidenceBody searchParams={searchParams} />
        </Suspense>
      </main>
    </div>
  );
}
