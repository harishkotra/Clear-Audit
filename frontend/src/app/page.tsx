import Link from "next/link";
import Brand, { Mark } from "@/components/Brand";
import ConnectButton from "@/components/ConnectButton";
import { ArrowUpRight } from "@/components/icons";
import { USE_CASES } from "@/lib/usecases";

const RULE = [
  {
    n: "01",
    title: "Escrow, not custody",
    body: "One fixed amount, locked in a public contract to one named address. No platform balance, no fee switch, no admin withdrawal key.",
  },
  {
    n: "02",
    title: "Evidence that expires",
    body: "Only a fingerprint reaches Arkiv, with a 30 day lifetime. Enough to prove a record existed and matched, nothing left to become a permanent liability.",
  },
  {
    n: "03",
    title: "A gate you can re-run",
    body: "The release is refused unless the anchor is live and matches this payee, this amount, this deal. It is a query, not a committee.",
  },
  {
    n: "04",
    title: "One exit for disagreement",
    body: "Either side can freeze the escrow for review. A named arbitrator resolves it to exactly one party and cannot be a party themselves.",
  },
];

const DISPATCH = [
  ["01", "List", "The lister funds the task and sets a deadline. Nothing is claimed yet, and the money is already locked."],
  ["02", "Claim", "Any agent with a matching capability anchor claims it. First valid claim wins; the claim is public."],
  ["03", "Deliver", "The agent writes the artefact hash to Arkiv. No file, no invoice, no identity handover."],
  ["04", "Settle", "The gate checks the anchor against the terms and releases. If the deadline passes unclaimed or undelivered, the lister refunds."],
];

const NOT = [
  "No marketplace, no listings feed, no submission inbox, no leaderboard.",
  "No custody: the release path cannot be aimed at a different address.",
  "No KYC vendor and no identity scoring. The payee is an address, the proof is the anchor.",
  "No platform judgement. The funder asserts, the gate checks, the arbitrator resolves.",
];

const LIMITS = [
  {
    title: "0% fee, because there is no fee switch",
    body: "The deployed vault takes nothing. Any pricing in this repository is a plan, not revenue.",
  },
  {
    title: "No 4337 sponsorship on Arc",
    body: "The live v2 vault sets paymaster to zero: there is no fee to sponsor. v1's USDCPaymaster is still on chain and unused. Sponsorship exists on the EF devnet artifact only.",
  },
  {
    title: "On-chain evidence, plus a public re-run",
    body: "v3 release() reverts without a live committed fingerprint. /api/release-guard and /evidence re-check the matching Arkiv anchor. A direct call with no commitEvidence fails on chain.",
  },
  {
    title: "One payee per escrow",
    body: "Open claiming, deadlines, cancel and refund are live. Multi-claimant contests are not: one deal still pays exactly one address.",
  },
];

const FAQ = [
  {
    q: "What stops a payout?",
    a: "The release route calls a guard first. It refuses unless the deal is open, the named address is non zero, and a live, unexpired Arkiv anchor exists whose payee, funder and amount all match the on-chain terms. Missing, expired, unreadable or mismatched anchor means the release button cannot sign at all.",
  },
  {
    q: "Is this another bug bounty platform?",
    a: "Bounties are one of six situations here and the most crowded. There is no marketplace, no triage queue and no fee. The thing being sold is the settlement rule, which is what disclosure payouts, retainer milestones, agent dispatches and recovery settlements all need.",
  },
  {
    q: "Who decides whether the work is good?",
    a: "The funder asserts it, as in any escrow. What changes is that the assertion is checkable: the anchor is public while it lives, so anyone can confirm what was paid for and when the claim expires. Disputes go to a named arbitrator, not a support queue.",
  },
  {
    q: "If an agent does the work, who is accountable?",
    a: "The agent's wallet, exactly like a human wallet. An agent is not a trust shortcut: the gate proves a deliverable existed and matched, not that it is good. That is why a task should carry an acceptance-criteria hash, and why the claim is public before the work starts.",
  },
  {
    q: "Why would evidence expire on purpose?",
    a: "A fixed vulnerability should not be a permanent indexed target, and a negotiation that went nowhere should not be a permanent public record. Expiry is a property of the rail, not a retention policy somebody has to honour.",
  },
  {
    q: "Does the payee need gas or a bank account?",
    a: "No. The payee never sends a transaction, the funder releases. On Arc the funder pays gas in USDC, the same token as the escrow. On the EIP-8141 devnet artifact a relayer pays even that, as a research demonstration rather than a product feature.",
  },
  {
    q: "What does it cost?",
    a: "Nothing on the deployed vault. The full amount reaches the payee, and a dispute sends it to exactly one party. There is no fee switch.",
  },
];

function Gate() {
  return (
    <div className="border border-[var(--rule)] bg-[#0a0a0b]">
      <div className="flex items-center justify-between border-b border-[var(--rule)] px-3.5 py-2">
        <span className="micro">release-guard.ts</span>
        <span className="micro text-brand-500">runs before signing</span>
      </div>
      <pre className="overflow-x-auto px-3.5 py-3 font-mono text-[11px] leading-[1.75] text-[#c9c3b8]">
{`status        Open
payee         != 0x0
anchor.payee  == deal.payee
anchor.funder == deal.funder
anchor.amount == deal.amount
anchor.chain  == 5042002
expiry        >  now
criteria      matches when set`}
      </pre>
      <div className="border-t border-[var(--rule)] px-3.5 py-2.5 text-[11.5px] leading-relaxed text-[#8d887f]">
        Any failed line is a refusal. No anchor, no payout: the evidence layer is load
        bearing, not decorative.
      </div>
    </div>
  );
}

export default function Landing() {
  return (
    <div className="min-h-screen bg-[#0b0b0c]">
      <header className="border-b border-[var(--rule)]">
        <div className="mx-auto flex h-14 w-full max-w-[1180px] items-center justify-between px-5">
          <div className="flex items-center gap-8">
            <Brand />
            <nav className="hidden items-center gap-6 md:flex">
              {[
                ["#rule", "The rule"],
                ["#situations", "Situations"],
                ["#dispatch", "Agents"],
                ["/evidence", "Evidence"],
                ["#limits", "Limits"],
                ["#faq", "Questions"],
              ].map(([href, label]) => (
                <a
                  key={href}
                  href={href}
                  className="font-mono text-[10.5px] uppercase tracking-[0.13em] text-[#7d786f] transition hover:text-[#ece7dd]"
                >
                  {label}
                </a>
              ))}
            </nav>
          </div>
          <Link href="/app" className="btn btn-primary h-8 px-3 text-[12px]">
            Open the rail
          </Link>
        </div>
      </header>

      <section className="mx-auto w-full max-w-[1180px] px-5 pb-16 pt-14 sm:pt-20">
        <div className="grid gap-12 lg:grid-cols-[1.15fr_0.85fr] lg:items-end">
          <div className="rise">
            <div className="micro flex items-center gap-3">
              <span className="h-1 w-1 rounded-full bg-brand-500" />
              <span>Settlement rail</span>
              <span className="text-[#3d3a35]">/</span>
              <span>Arc testnet 5042002</span>
            </div>
            <h1 className="display mt-6 text-[46px] text-[#f3efe6] sm:text-[68px]">
              Money moves only
              <br />
              when the <em className="text-brand-500">evidence</em>
              <br />
              checks out.
            </h1>
            <p className="mt-6 max-w-[46ch] text-[15.5px] leading-[1.7] text-[#a29c92]">
              A rail for two parties who will not hand each other their identity. The amount sits in
              a public contract. It leaves only against a live, publicly re-checkable record that
              expires on a schedule. No custodian, no marketplace, no triage team in between.
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-3">
              <Link href="/app" className="btn btn-primary h-10 px-4">
                Open the rail
              </Link>
              <a href="#rule" className="btn btn-ghost h-10 px-4">
                Read the gate
              </a>
              <Link href="/evidence" className="btn btn-ghost h-10 px-4">
                Re-run evidence
              </Link>
            </div>
            <dl className="mt-10 grid max-w-md grid-cols-3 gap-4 border-t border-[var(--rule)] pt-4">
              {[
                ["Fee", "0%"],
                ["Anchor life", "30 days"],
                ["Payee gas", "none"],
              ].map(([k, v]) => (
                <div key={k}>
                  <dt className="micro">{k}</dt>
                  <dd className="mt-1 font-mono text-[13px] text-[#ece7dd]">{v}</dd>
                </div>
              ))}
            </dl>
          </div>
          <div className="rise" style={{ animationDelay: "90ms" }}>
            <Gate />
          </div>
        </div>
      </section>

      <div className="border-y border-[var(--rule)]">
        <div className="mx-auto flex w-full max-w-[1180px] flex-wrap items-center gap-x-8 gap-y-2 px-5 py-3 font-mono text-[10px] uppercase tracking-[0.14em] text-[#5f5b55]">
          <span>Settles on Arc</span>
          <span>Anchors on Arkiv</span>
          <span>EIP 8141 relayer demo on EF devnet</span>
          <span className="ml-auto">Built for ETHGlobal Mumbai</span>
        </div>
      </div>

      <section id="rule" className="mx-auto w-full max-w-[1180px] px-5 py-20">
        <div className="grid gap-10 lg:grid-cols-[0.55fr_1.45fr]">
          <div>
            <div className="micro">01 / The rule</div>
            <h2 className="display mt-4 text-[34px] text-[#f3efe6] sm:text-[40px]">
              One rule,
              <br />
              four moving parts.
            </h2>
            <p className="mt-4 max-w-[38ch] text-[14px] leading-[1.7] text-[#8d887f]">
              Every payout product asks you to trust a company decision. This one turns that decision
              into a query, so a stranger can check it without asking us.
            </p>
          </div>
          <div className="grid gap-x-10 gap-y-8 sm:grid-cols-2">
            {RULE.map((r) => (
              <div key={r.n} className="border-t border-[var(--rule)] pt-4">
                <div className="flex items-baseline gap-3">
                  <span className="font-mono text-[10.5px] text-brand-500">{r.n}</span>
                  <h3 className="text-[15px] font-medium text-[#ece7dd]">{r.title}</h3>
                </div>
                <p className="mt-2 text-[13.5px] leading-[1.7] text-[#8d887f]">{r.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="situations" className="border-y border-[var(--rule)] bg-[#0e0e10]">
        <div className="mx-auto w-full max-w-[1180px] px-5 py-20">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <div className="micro">02 / Situations</div>
              <h2 className="display mt-4 text-[34px] text-[#f3efe6] sm:text-[40px]">
                Six situations, one rail.
              </h2>
            </div>
            <p className="max-w-[44ch] text-[13.5px] leading-[1.7] text-[#8d887f]">
              Anywhere money is owed against a deliverable and neither side wants to be identified.
              Two of them need a contract change, and they say so.
            </p>
          </div>

          <div className="mt-10 overflow-x-auto">
            <table className="w-full min-w-[820px] border-collapse text-left">
              <thead>
                <tr className="border-y border-[var(--rule)]">
                  {["", "Situation", "Evidence anchor", "Fit"].map((h) => (
                    <th key={h} className="micro py-2.5 pr-6 font-normal">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {USE_CASES.map((u, i) => (
                  <tr key={u.id} className="border-b border-[var(--rule)] align-top">
                    <td className="py-4 pr-6 font-mono text-[10.5px] text-[#4d4943]">
                      {String(i + 1).padStart(2, "0")}
                    </td>
                    <td className="py-4 pr-8">
                      <div className="text-[14px] text-[#ece7dd]">{u.title}</div>
                      <div className="mt-1 max-w-[52ch] text-[12.5px] leading-[1.6] text-[#8d887f]">
                        {u.promise}
                      </div>
                      {u.needs && (
                        <div className="mt-1.5 max-w-[52ch] text-[11.5px] leading-[1.6] text-[#c9a06a]">
                          {u.needs}
                        </div>
                      )}
                    </td>
                    <td className="py-4 pr-8 text-[12.5px] leading-[1.6] text-[#a29c92]">
                      {u.evidence}
                    </td>
                    <td className="whitespace-nowrap py-4 font-mono text-[10px] uppercase tracking-[0.1em]">
                      <span className={u.fit === "today" ? "text-[#8bd17c]" : "text-[#c9a06a]"}>
                        {u.fit === "today" ? "live" : "later"}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-4 font-mono text-[10px] uppercase tracking-[0.1em] text-[#4d4943]">
            live = works with the deployed vault &nbsp;·&nbsp; later = needs a contract change
          </p>
        </div>
      </section>

      <section id="dispatch" className="mx-auto w-full max-w-[1180px] px-5 py-20">
        <div className="grid gap-12 lg:grid-cols-[0.8fr_1.2fr]">
          <div>
            <div className="micro">03 / Agents</div>
            <h2 className="display mt-4 text-[34px] text-[#f3efe6] sm:text-[40px]">
              When nobody
              <br />
              shows up.
            </h2>
            <p className="mt-4 max-w-[40ch] text-[14px] leading-[1.7] text-[#8d887f]">
              Waiting for a human to accept work, then ghost it, is a scheduling problem the gate
              cannot fix. So a lister can open a task to agents instead of naming one person: any
              agent with a matching capability claim can take it, and the payout still clears only
              against a delivered artefact hash.
            </p>
            <p className="mt-4 max-w-[40ch] text-[13px] leading-[1.7] text-[#c9a06a]">
              An agent is not a trust shortcut. The gate proves a deliverable existed and matched the
              terms, not that it is good, so tasks carry an acceptance-criteria hash and the claim is
              public before any work starts.
            </p>
          </div>
          <div>
            <ol className="grid gap-px bg-[var(--rule)] sm:grid-cols-2">
              {DISPATCH.map(([n, title, body]) => (
                <li key={n} className="bg-[#0b0b0c] p-5">
                  <div className="flex items-baseline gap-3">
                    <span className="font-mono text-[10.5px] text-brand-500">{n}</span>
                    <h3 className="text-[14.5px] font-medium text-[#ece7dd]">{title}</h3>
                  </div>
                  <p className="mt-2 text-[12.5px] leading-[1.7] text-[#8d887f]">{body}</p>
                </li>
              ))}
            </ol>
            <div className="mt-4 flex items-center gap-3 border border-[var(--rule)] px-4 py-3">
              <span className="chip text-[#8bd17c]">live on v2</span>
              <span className="text-[12px] leading-[1.6] text-[#8d887f]">
                Open claiming, deadlines, cancel and refund are on the live vault. Claim from Rewards.
              </span>
            </div>
          </div>
        </div>
      </section>

      <section className="border-y border-[var(--rule)] bg-[#0e0e10]">
        <div className="mx-auto grid w-full max-w-[1180px] gap-12 px-5 py-20 lg:grid-cols-[0.9fr_1.1fr]">
          <div>
            <div className="micro">04 / Position</div>
            <h2 className="display mt-4 text-[34px] text-[#f3efe6] sm:text-[40px]">
              Not a platform.
              <br />
              A rule you verify.
            </h2>
            <ul className="mt-6 space-y-3">
              {NOT.map((n) => (
                <li
                  key={n}
                  className="flex items-start gap-3 border-t border-[var(--rule)] pt-3 text-[13px] leading-[1.7] text-[#a29c92]"
                >
                  <span className="mt-2 h-1 w-1 shrink-0 rounded-full bg-brand-500" />
                  {n}
                </li>
              ))}
            </ul>
          </div>
          <div>
            <table className="w-full border-collapse text-left text-[12.5px]">
              <thead>
                <tr className="border-b border-[var(--rule)]">
                  <th className="micro py-2 font-normal" />
                  <th className="micro py-2 font-normal">Payout platforms</th>
                  <th className="micro py-2 font-normal text-[#ece7dd]">ClearAudit</th>
                </tr>
              </thead>
              <tbody>
                {[
                  ["Holds the money", "the platform", "a public contract"],
                  ["Who decides", "triage, judges", "the funder, plus a gate"],
                  ["Evidence lives", "internal DB, forever", "public anchor, 30 days"],
                  ["Payee identity", "KYC", "an address"],
                  ["Payee needs gas", "no bank transfer", "never transacts"],
                  ["Take rate", "roughly 10 to 20%", "0%"],
                  ["Can you audit a decision", "no", "re-run the query"],
                ].map(([k, a, b]) => (
                  <tr key={k} className="border-b border-[var(--rule)]">
                    <td className="py-2.5 pr-4 text-[#6f6a62]">{k}</td>
                    <td className="py-2.5 pr-4 text-[#8d887f]">{a}</td>
                    <td className="py-2.5 text-[#ece7dd]">{b}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      <section id="limits" className="mx-auto w-full max-w-[1180px] px-5 py-20">
        <div className="micro">05 / Limits</div>
        <h2 className="display mt-4 max-w-[24ch] text-[34px] text-[#f3efe6] sm:text-[40px]">
          What we will not claim.
        </h2>
        <div className="mt-10 grid gap-x-10 gap-y-6 sm:grid-cols-2">
          {LIMITS.map((l) => (
            <div key={l.title} className="border-t border-[var(--rule)] pt-4">
              <h3 className="text-[14px] font-medium text-[#ece7dd]">{l.title}</h3>
              <p className="mt-2 text-[13px] leading-[1.7] text-[#8d887f]">{l.body}</p>
            </div>
          ))}
        </div>
        <p className="mt-8 max-w-[70ch] border-l border-brand-500/50 pl-4 text-[12.5px] leading-[1.7] text-[#6f6a62]">
          The EIP 8141 devnet is a research artifact on chain 1337. It is not a bridge and not Arc
          settlement. Arc is the product; the devnet shows a payee being paid while holding nothing.
        </p>
      </section>

      <section id="faq" className="border-y border-[var(--rule)] bg-[#0e0e10]">
        <div className="mx-auto w-full max-w-[1180px] px-5 py-20">
          <div className="grid gap-10 lg:grid-cols-[0.5fr_1.5fr]">
            <div>
              <div className="micro">06 / Questions</div>
              <h2 className="display mt-4 text-[34px] text-[#f3efe6]">Asked directly.</h2>
            </div>
            <div className="divide-y divide-[var(--rule)] border-t border-[var(--rule)]">
              {FAQ.map((f) => (
                <details key={f.q} className="group py-4">
                  <summary className="flex cursor-pointer list-none items-baseline justify-between gap-4 text-[14px] text-[#e4dfd5]">
                    {f.q}
                    <span className="font-mono text-[13px] text-[#4d4943] transition group-open:rotate-45">
                      +
                    </span>
                  </summary>
                  <p className="mt-2.5 max-w-[70ch] text-[13px] leading-[1.75] text-[#8d887f]">{f.a}</p>
                </details>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto w-full max-w-[1180px] px-5 py-16">
        <div className="flex flex-col items-start justify-between gap-6 border border-[var(--rule)] p-7 sm:flex-row sm:items-center">
          <div>
            <Mark size={30} />
            <h2 className="display mt-4 text-[26px] text-[#f3efe6] sm:text-[30px]">
              Run the gate yourself.
            </h2>
            <p className="mt-2 max-w-[52ch] text-[13.5px] leading-[1.7] text-[#8d887f]">
              Connect a wallet, pick the situation you settle, and watch a release get refused before
              the evidence exists, then allowed once it does.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <ConnectButton />
            <Link href="/app" className="btn btn-ghost">
              Open app <ArrowUpRight className="h-3.5 w-3.5" />
            </Link>
          </div>
        </div>
      </section>

      <footer className="border-t border-[var(--rule)]">
        <div className="mx-auto flex w-full max-w-[1180px] flex-col gap-4 px-5 py-8 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <Brand />
            <span className="font-mono text-[10.5px] text-[#4d4943]">MIT, self-hostable</span>
          </div>
          <div className="flex flex-wrap items-center gap-6 font-mono text-[10.5px] uppercase tracking-[0.12em] text-[#7d786f]">
            <Link href="/app" className="hover:text-[#ece7dd]">App</Link>
            <a
              href="https://explorer.testnet.arc.io"
              target="_blank"
              rel="noreferrer"
              className="hover:text-[#ece7dd]"
            >
              Explorer
            </a>
            <a
              href="https://github.com/harishkotra/Clear-Audit/tree/main/docs"
              target="_blank"
              rel="noreferrer"
              className="hover:text-[#ece7dd]"
            >
              Docs
            </a>
            <span className="text-[#3d3a35]">chain 5042002</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
