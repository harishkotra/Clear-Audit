import Link from "next/link";
import Brand, { Mark } from "@/components/Brand";
import ConnectButton from "@/components/ConnectButton";
import { ArrowUpRight, BoltIcon, ClockIcon, LockIcon, ShieldIcon } from "@/components/icons";
import { USE_CASES, FIT_LABEL } from "@/lib/usecases";

const MECHANISM = [
  {
    step: "01",
    title: "The money is escrowed, not held",
    body: "One fixed amount, locked in a public contract to one named address. No custodian, no platform balance, no fee on the deployed vault.",
  },
  {
    step: "02",
    title: "The evidence is an expiring record",
    body: "Only a fingerprint is written to Arkiv, with a 30-day lifetime. Enough to prove a record existed and matched — nothing that survives to become a permanent liability.",
  },
  {
    step: "03",
    title: "The payout is a query, not a decision",
    body: "The gate refuses unless the anchor is live and matches the payee, the amount and this deal. Anyone can re-run that check; it is a few lines of code, not a triage team.",
  },
  {
    step: "04",
    title: "Disagreement has one exit",
    body: "Either side can freeze the escrow for review. A named arbitrator resolves it to exactly one party, and cannot be a party themselves.",
  },
];

const FAQ = [
  {
    q: "What exactly stops a payout?",
    a: "The release route calls a guard first. It refuses unless the deal is open, the named address is non-zero, and a live, unexpired Arkiv anchor exists whose payee, funder and amount all match the on-chain terms. Anchor missing, expired, unreadable or mismatched → the release button cannot even sign.",
  },
  {
    q: "Is this another bug bounty platform?",
    a: "Bounties are one of six situations we document, and the most crowded one. There is no marketplace, no triage team, no submission inbox, and no fee. What is sold here is the settlement rule: money leaves escrow only against a matching, expiring evidence record — which is what a disclosure payout, a retainer milestone, a machine-to-machine task or a recovery settlement all need.",
  },
  {
    q: "Who decides whether the work is good?",
    a: "The funder asserts it, as they do in every escrow. The difference is that the assertion is checkable: the evidence record is public while it lives, so a third party can confirm what was paid for and when the claim expires. Disputes go to a named arbitrator rather than a support queue.",
  },
  {
    q: "Why would evidence expire on purpose?",
    a: "A fixed vulnerability should not be a permanent, indexed target, and an unreturned negotiation should not be a permanent public record. Expiry is a property of the rail, not a retention policy someone has to honour.",
  },
  {
    q: "Does the payee need gas, or a bank account?",
    a: "No. The payee never sends a transaction — the funder releases. On Arc the funder pays gas in USDC, which is also the escrow token. On the EIP-8141 devnet artifact even that is paid by a relayer, as a research demonstration rather than a product feature.",
  },
  {
    q: "What does it cost?",
    a: "Zero on the deployed vault: the full amount reaches the payee and a dispute sends it to exactly one party. Nothing in this repository charges a fee. A fee is a V2 plan, not a switch that exists on-chain today.",
  },
];

const NOT = [
  "No marketplace, no listings, no leaderboard, no submission inbox.",
  "No custody: funds sit in a contract whose release path cannot be pointed elsewhere.",
  "No KYC vendor and no identity scoring — the payee is an address, the proof is the anchor.",
  "No platform judgement: the funder asserts, the gate checks, the arbitrator resolves disputes.",
];

const LIMITS = [
  {
    title: "0% fee, because there is no fee switch",
    body: "The deployed vault takes nothing. Pricing elsewhere in this repo is a plan, not revenue.",
  },
  {
    title: "No 4337 sponsorship on Arc",
    body: "USDCPaymaster is deployed and wired, but no product flow routes a UserOperation through it. Sponsorship exists only on the EF devnet research artifact.",
  },
  {
    title: "Arbitration is not self-serve",
    body: "The arbitrator is the deploy wallet; its key is not in this repository. A production deployment names its own.",
  },
  {
    title: "Recovery settlements need a refund path",
    body: "The vault has no deadline and no cancel. For an exploit negotiation that is fatal, so we mark it V2 instead of pretending.",
  },
];

function Nav() {
  return (
    <header className="sticky top-0 z-40 border-b border-white/8 bg-[#08090d]/80 backdrop-blur-xl">
      <div className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between px-5">
        <div className="flex items-center gap-9">
          <Brand />
          <nav className="hidden items-center gap-7 text-sm text-zinc-400 md:flex">
            <a href="#mechanism" className="transition hover:text-white">How it works</a>
            <a href="#uses" className="transition hover:text-white">Use cases</a>
            <a href="#different" className="transition hover:text-white">Why not a platform</a>
            <a href="#limits" className="transition hover:text-white">Limits</a>
            <a href="#faq" className="transition hover:text-white">FAQ</a>
          </nav>
        </div>
        <div className="flex items-center gap-2">
          <Link href="/app" className="hidden text-sm text-zinc-400 transition hover:text-white sm:block">
            Sign in
          </Link>
          <Link href="/app" className="btn btn-primary h-9">
            Open the rail
          </Link>
        </div>
      </div>
    </header>
  );
}

function Preview() {
  return (
    <div className="relative">
      <div className="pointer-events-none absolute -inset-8 rounded-[32px] bg-[radial-gradient(60%_60%_at_50%_20%,rgba(109,94,248,0.28),transparent_70%)] blur-2xl" />
      <div className="relative card overflow-hidden p-0 shadow-2xl">
        <div className="flex items-center justify-between border-b border-white/8 px-4 py-3">
          <div className="flex items-center gap-2 text-xs text-zinc-400">
            <span className="h-2 w-2 rounded-full bg-emerald-400" />
            Settlement #14
          </div>
          <span className="chip">Testnet preview</span>
        </div>
        <div className="space-y-5 p-5">
          <div>
            <div className="text-[11px] uppercase tracking-[0.12em] text-zinc-500">Escrowed</div>
            <div className="mt-1 flex items-end gap-2">
              <span className="text-4xl font-semibold tracking-[-0.03em] text-white">12,500</span>
              <span className="pb-1 text-sm text-zinc-400">USDC</span>
            </div>
          </div>

          <div className="space-y-2.5">
            {[
              ["Evidence anchored", "0x8f…42 · expires in 30d", true],
              ["Gate re-checked by anyone", "payee · amount · live anchor", true],
              ["Released", "USDC · 1 tx · 0% fee", true],
            ].map(([label, meta, done]) => (
              <div key={String(label)} className="flex items-center gap-3 rounded-lg border border-white/6 bg-white/[0.02] px-3 py-2.5">
                <span
                  className={`grid h-5 w-5 shrink-0 place-items-center rounded-full text-[10px] ${
                    done ? "bg-emerald-400/15 text-emerald-300" : "bg-white/8 text-zinc-500"
                  }`}
                >
                  ✓
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-[13px] text-zinc-200">{label}</span>
                  <span className="block truncate font-mono text-[10px] text-zinc-500">{meta}</span>
                </span>
              </div>
            ))}
          </div>

          <div className="flex items-center justify-between rounded-lg border border-emerald-400/20 bg-emerald-400/[0.06] px-3 py-2.5">
            <span className="text-[12px] text-emerald-200/90">Paid to the named address</span>
            <span className="font-mono text-[13px] text-emerald-300">+12,500.00 USDC</span>
          </div>

          <p className="text-[10.5px] leading-relaxed text-zinc-600">
            The gate refuses this release if the anchor expires, disappears, or stops matching the
            payee and amount — including after the fact, if the escrow is replayed.
          </p>
        </div>
      </div>
    </div>
  );
}

export default function Landing() {
  return (
    <div className="min-h-screen bg-[#08090d]">
      <Nav />

      <section className="relative overflow-hidden">
        <div className="pointer-events-none absolute inset-0 grid-bg" />
        <div className="relative mx-auto grid w-full max-w-6xl items-center gap-14 px-5 pb-16 pt-16 lg:grid-cols-[1.05fr_0.95fr] lg:pb-24 lg:pt-24">
          <div className="rise">
            <span className="chip">
              <span className="h-1.5 w-1.5 rounded-full bg-brand-400" />
              Live on Arc testnet · evidence-gated settlement
            </span>
            <h1 className="mt-5 text-[40px] font-semibold leading-[1.05] tracking-[-0.045em] text-white sm:text-[54px]">
              Money moves only
              <br />
              when the evidence
              <br />
              checks out.
            </h1>
            <p className="mt-5 max-w-xl text-[16px] leading-relaxed text-zinc-400">
              ClearAudit is a settlement rail for two parties who do not want to hand each other their
              identity. Funds sit in a public contract. A payout clears only against a live,
              publicly re-checkable evidence record — one that expires on a schedule. No marketplace,
              no custodian, no triage team in the middle.
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-3">
              <Link href="/app" className="btn btn-primary h-11 px-5 text-[15px]">
                Open the rail
              </Link>
              <a href="#mechanism" className="btn btn-ghost h-11 px-5 text-[15px]">
                See the gate
              </a>
            </div>
            <div className="mt-7 flex flex-wrap items-center gap-x-6 gap-y-2 text-[12px] text-zinc-500">
              <span className="inline-flex items-center gap-1.5">
                <LockIcon className="h-3.5 w-3.5" /> Evidence is a hash, not a file
              </span>
              <span className="inline-flex items-center gap-1.5">
                <ClockIcon className="h-3.5 w-3.5" /> Anchors expire in 30 days
              </span>
              <span className="inline-flex items-center gap-1.5">
                <BoltIcon className="h-3.5 w-3.5" /> Payee never needs gas
              </span>
            </div>
          </div>

          <div className="rise" style={{ animationDelay: "120ms" }}>
            <Preview />
          </div>
        </div>
      </section>

      <div className="border-y border-white/6 bg-white/[0.015]">
        <div className="mx-auto flex w-full max-w-6xl flex-wrap items-center justify-between gap-4 px-5 py-4 text-[11px] uppercase tracking-[0.14em] text-zinc-600">
          <span>Settles on Arc</span>
          <span className="hidden h-1 w-1 rounded-full bg-zinc-700 sm:block" />
          <span>Expiring anchors on Arkiv</span>
          <span className="hidden h-1 w-1 rounded-full bg-zinc-700 sm:block" />
          <span>EIP-8141 relayer demo on EF devnet</span>
          <span className="hidden h-1 w-1 rounded-full bg-zinc-700 sm:block" />
          <span>0% fee on the deployed vault</span>
        </div>
      </div>

      <section id="mechanism" className="mx-auto w-full max-w-6xl px-5 py-20">
        <div className="max-w-2xl">
          <h2 className="text-[30px] font-semibold tracking-[-0.03em] text-white sm:text-[36px]">
            The whole product is one rule.
          </h2>
          <p className="mt-3 text-[15px] leading-relaxed text-zinc-400">
            Every existing payout product asks you to trust a company&apos;s decision. This one makes
            the decision a query you can re-run. Four moving parts, no platform in the path.
          </p>
        </div>

        <div className="mt-10 grid gap-x-8 gap-y-10 sm:grid-cols-2 lg:grid-cols-4">
          {MECHANISM.map((f) => (
            <div key={f.step}>
              <div className="font-mono text-[11px] tracking-widest text-brand-400">{f.step}</div>
              <div className="mt-2 h-px w-full bg-gradient-to-r from-brand-400/60 to-transparent" />
              <h3 className="mt-4 text-[15px] font-medium text-white">{f.title}</h3>
              <p className="mt-2 text-[13.5px] leading-relaxed text-zinc-400">{f.body}</p>
            </div>
          ))}
        </div>

        <div className="mt-12 grid gap-4 lg:grid-cols-[1.15fr_0.85fr]">
          <div className="card overflow-hidden p-0">
            <div className="flex items-center justify-between border-b border-white/8 px-4 py-2.5">
              <span className="text-[11.5px] text-zinc-400">
                The gate, condensed — <span className="font-mono">frontend/src/app/api/release-guard/route.ts</span>
              </span>
              <span className="chip">runs before any signature</span>
            </div>
            <pre className="overflow-x-auto p-4 text-[11.5px] leading-relaxed text-zinc-300">
{`deal.status      === Open            // escrow is live
deal.researcher  !== 0x0             // someone is named
anchor.whitehat  === deal.researcher // payee matches
anchor.protocol  === deal.company    // funder matches
anchor.amount    === deal.amount     // amount matches
anchor.chainId   === 5042002         // right chain, not a lookalike
expiry            > now              // the record is still alive`}
            </pre>
            <div className="border-t border-white/8 px-4 py-3 text-[11.5px] leading-relaxed text-zinc-500">
              A missing, expired or unreadable anchor is a refusal, not a fallback. That is why the
              evidence layer is load-bearing rather than decorative.
            </div>
          </div>

          <div className="card p-5">
            <span className="grid h-9 w-9 place-items-center rounded-lg border border-white/10 bg-white/[0.04] text-brand-400">
              <ShieldIcon className="h-4.5 w-4.5" />
            </span>
            <h3 className="mt-4 text-[15px] font-medium text-white">The evidence destroys itself</h3>
            <p className="mt-2 text-[13.5px] leading-relaxed text-zinc-400">
              Privacy here is a mechanism, not a promise about a database. The anchor commits to a
              hash and a deadline; when the deadline passes, the proof is gone and the money has
              already moved. Nobody has to be trusted to delete anything.
            </p>
            <div className="mt-4 flex flex-wrap gap-2 text-[11px]">
              <span className="chip">hash only</span>
              <span className="chip">30-day expiry</span>
              <span className="chip">chain-scoped</span>
              <span className="chip">publicly queryable</span>
            </div>
          </div>
        </div>
      </section>

      <section id="uses" className="border-y border-white/6 bg-white/[0.015]">
        <div className="mx-auto w-full max-w-6xl px-5 py-20">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div className="max-w-2xl">
              <h2 className="text-[30px] font-semibold tracking-[-0.03em] text-white sm:text-[36px]">
                Six situations, one rail.
              </h2>
              <p className="mt-3 text-[15px] leading-relaxed text-zinc-400">
                Anywhere money is owed against a deliverable, and neither side wants the other to
                learn who they are. Bounties are card six — the familiar one, and the crowded one.
              </p>
            </div>
            <Link href="/app" className="btn btn-ghost h-9 shrink-0">
              Pick yours <ArrowUpRight className="h-3.5 w-3.5" />
            </Link>
          </div>

          <div className="mt-10 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {USE_CASES.map((u) => (
              <div key={u.id} className="card flex flex-col p-5">
                <div className="flex items-start justify-between gap-3">
                  <span className="chip w-fit">{u.label}</span>
                  <span
                    className={`text-[10px] uppercase tracking-[0.08em] ${
                      u.fit === "today" ? "text-emerald-400/80" : "text-amber-400/80"
                    }`}
                  >
                    {FIT_LABEL[u.fit]}
                  </span>
                </div>
                <h3 className="mt-3 text-[15.5px] font-medium leading-snug text-white">{u.title}</h3>
                <p className="mt-2 text-[13px] leading-relaxed text-zinc-400">{u.promise}</p>
                <dl className="mt-4 space-y-2 border-t border-white/8 pt-3 text-[11.5px]">
                  <div>
                    <dt className="text-zinc-600">Evidence anchor</dt>
                    <dd className="text-zinc-400">{u.evidence}</dd>
                  </div>
                  <div>
                    <dt className="text-zinc-600">Why it expires</dt>
                    <dd className="text-zinc-400">{u.expiry}</dd>
                  </div>
                  {u.needs && (
                    <div>
                      <dt className="text-amber-400/70">What it still needs</dt>
                      <dd className="text-amber-300/80">{u.needs}</dd>
                    </div>
                  )}
                </dl>
              </div>
            ))}
          </div>

          <p className="mt-6 max-w-3xl text-[12.5px] leading-relaxed text-zinc-600">
            &ldquo;Needs a contract change&rdquo; is a real gap, not a roadmap promise: the deployed
            vault has one fixed amount, one payee, no deadline and no cancel. We mark those cases
            instead of selling them.
          </p>
        </div>
      </section>

      <section id="different" className="mx-auto w-full max-w-6xl px-5 py-20">
        <div className="grid gap-10 lg:grid-cols-[0.95fr_1.05fr] lg:items-start">
          <div>
            <h2 className="text-[30px] font-semibold tracking-[-0.03em] text-white sm:text-[36px]">
              Not a platform. A rule you can verify.
            </h2>
            <p className="mt-3 text-[15px] leading-relaxed text-zinc-400">
              A platform asks you to trust its triage, its database and its payout calendar. This
              replaces all three with things you can check yourself, on-chain and in the open.
            </p>
            <ul className="mt-6 space-y-3">
              {NOT.map((n) => (
                <li key={n} className="flex items-start gap-2.5 text-[13.5px] leading-relaxed text-zinc-300">
                  <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-brand-400" />
                  {n}
                </li>
              ))}
            </ul>
          </div>

          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th></th>
                  <th>Payout platforms</th>
                  <th>ClearAudit</th>
                </tr>
              </thead>
              <tbody>
                {[
                  ["Holds the money", "the platform", "a public contract"],
                  ["Who decides", "triage / judges", "the funder + a gate"],
                  ["Evidence lives", "internal DB, forever", "public anchor, 30 days"],
                  ["Payee identity", "KYC", "an address"],
                  ["Payee needs gas", "no (bank)", "no (never transacts)"],
                  ["Fee", "~10–20%", "0% (none on-chain)"],
                  ["Can you audit a decision", "no", "re-run the query"],
                ].map(([k, a, b]) => (
                  <tr key={k}>
                    <td className="text-zinc-400">{k}</td>
                    <td className="text-zinc-500">{a}</td>
                    <td className="text-white">{b}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      <section id="limits" className="border-y border-white/6 bg-white/[0.015]">
        <div className="mx-auto w-full max-w-6xl px-5 py-20">
          <div className="max-w-2xl">
            <h2 className="text-[30px] font-semibold tracking-[-0.03em] text-white sm:text-[36px]">
              What we will not claim.
            </h2>
            <p className="mt-3 text-[15px] leading-relaxed text-zinc-400">
              Each of these was checked against the chain or the code. Saying them first is cheaper
              than having someone find them later.
            </p>
          </div>
          <div className="mt-10 grid gap-4 sm:grid-cols-2">
            {LIMITS.map((l) => (
              <div key={l.title} className="card p-5">
                <h3 className="text-[14.5px] font-medium text-white">{l.title}</h3>
                <p className="mt-2 text-[13px] leading-relaxed text-zinc-400">{l.body}</p>
              </div>
            ))}
          </div>
          <p className="mt-6 text-[12.5px] text-zinc-600">
            The EIP-8141 devnet is a research artifact on chain 1337, not a bridge and not Arc
            settlement. Arc is the product; the devnet shows a payee being paid while holding nothing.
          </p>
        </div>
      </section>

      <section id="faq" className="mx-auto w-full max-w-4xl px-5 py-20">
        <h2 className="text-[30px] font-semibold tracking-[-0.03em] text-white sm:text-[36px]">
          Questions, answered.
        </h2>
        <div className="mt-8 divide-y divide-white/8 border-y border-white/8">
          {FAQ.map((f) => (
            <details key={f.q} className="group py-4">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-[14.5px] text-zinc-200">
                {f.q}
                <span className="text-zinc-600 transition group-open:rotate-45">+</span>
              </summary>
              <p className="mt-3 max-w-3xl text-[13.5px] leading-relaxed text-zinc-400">{f.a}</p>
            </details>
          ))}
        </div>
      </section>

      <section className="mx-auto w-full max-w-6xl px-5 pb-20">
        <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-br from-brand-500/20 via-[#12141d] to-[#0b0d13] p-8 sm:p-12">
          <div className="pointer-events-none absolute -right-20 -top-24 h-64 w-64 rounded-full bg-brand-500/30 blur-3xl" />
          <div className="relative flex flex-col items-start gap-6 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <Mark size={34} />
              <h2 className="mt-4 max-w-xl text-[26px] font-semibold leading-tight tracking-[-0.03em] text-white sm:text-[30px]">
                Run the gate yourself.
              </h2>
              <p className="mt-2 max-w-lg text-[14px] text-zinc-400">
                Connect a wallet, pick the situation you settle, and watch a release get refused
                before the evidence exists — then allowed once it does.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <ConnectButton />
              <Link href="/app" className="btn btn-ghost">
                Open app
              </Link>
            </div>
          </div>
        </div>
      </section>

      <footer className="border-t border-white/8">
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-5 py-10 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <Brand />
            <span className="text-[12px] text-zinc-600">© ClearAudit</span>
          </div>
          <div className="flex flex-wrap items-center gap-6 text-[12.5px] text-zinc-500">
            <Link href="/app" className="hover:text-zinc-300">App</Link>
            <a href="https://explorer.testnet.arc.io" target="_blank" rel="noreferrer" className="hover:text-zinc-300">
              Explorer
            </a>
            <a href="/docs" className="hover:text-zinc-300">Docs</a>
            <span className="text-zinc-700">Arc Testnet · chain 5042002</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
