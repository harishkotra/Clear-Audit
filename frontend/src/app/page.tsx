import Link from "next/link";
import Brand, { Mark } from "@/components/Brand";
import ConnectButton from "@/components/ConnectButton";
import { ArrowUpRight, BoltIcon, ClockIcon, LockIcon, ShieldIcon } from "@/components/icons";

const FLOW = [
  {
    step: "01",
    title: "Fund a reward",
    body: "Connect your wallet and lock a dollar amount in USDC. The money is held by a public contract — not by us.",
  },
  {
    step: "02",
    title: "Receive a finding",
    body: "The researcher submits a private report. Only a fingerprint of it is written on-chain, with a 30-day expiry.",
  },
  {
    step: "03",
    title: "Accept and pay",
    body: "One click releases the reward. The researcher is paid in USDC, in a single transaction — gas is paid in USDC too, so there is no second token to hold.",
  },
  {
    step: "04",
    title: "Evidence expires",
    body: "The report anchor disappears after 30 days. A fixed vulnerability never becomes a permanent liability.",
  },
];

const FAQ = [
  {
    q: "Who holds the money?",
    a: "A non-custodial smart contract on Arc. ClearAudit never has access to your funds: the contract releases them only to the researcher you named, or to you if a dispute is resolved in your favour.",
  },
  {
    q: "How much does it cost?",
    a: "Nothing in the deployed contract takes a fee: the full escrowed amount reaches the researcher, and a dispute sends it to exactly one party. Pricing above is the planned model, not a switch that exists on-chain today.",
  },
  {
    q: "What stops someone from claiming a reward twice?",
    a: "Every reward moves through a one-way state machine. Once paid, it can never be paid again, and every transition is visible on-chain.",
  },
  {
    q: "Why can't ClearAudit read my report?",
    a: "Reports are encrypted before they leave the researcher's browser. The chain only stores a hash, and the anchor expires. We can verify that a report exists without ever holding its contents.",
  },
  {
    q: "Can I dispute a decision?",
    a: "Yes. A researcher can freeze a reward for review, and an independent arbitrator resolves it to exactly one party. The arbitrator cannot take part in a reward.",
  },
];

function Nav() {
  return (
    <header className="sticky top-0 z-40 border-b border-white/8 bg-[#08090d]/80 backdrop-blur-xl">
      <div className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between px-5">
        <div className="flex items-center gap-9">
          <Brand />
          <nav className="hidden items-center gap-7 text-sm text-zinc-400 md:flex">
            <a href="#how" className="transition hover:text-white">How it works</a>
            <a href="#why" className="transition hover:text-white">Why ClearAudit</a>
            <a href="#pricing" className="transition hover:text-white">Pricing</a>
            <a href="#faq" className="transition hover:text-white">FAQ</a>
          </nav>
        </div>
        <div className="flex items-center gap-2">
          <Link href="/app" className="hidden text-sm text-zinc-400 transition hover:text-white sm:block">
            Sign in
          </Link>
          <Link href="/app" className="btn btn-primary h-9">
            Get started
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
            Reward #14
          </div>
          <span className="chip">Testnet preview</span>
        </div>
        <div className="space-y-5 p-5">
          <div>
            <div className="text-[11px] uppercase tracking-[0.12em] text-zinc-500">Reward</div>
            <div className="mt-1 flex items-end gap-2">
              <span className="text-4xl font-semibold tracking-[-0.03em] text-white">12,500</span>
              <span className="pb-1 text-sm text-zinc-400">USDC</span>
            </div>
          </div>

          <div className="space-y-2.5">
            {[
              ["Report received", "0x8f…42 (expires in 30d)", true],
              ["Reviewed by protocol", "accepted", true],
              ["Payment released", "USDC · 1 tx", true],
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
            <span className="text-[12px] text-emerald-200/90">Researcher paid</span>
            <span className="font-mono text-[13px] text-emerald-300">+12,125.00 USDC</span>
          </div>
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
              Live on Arc testnet
            </span>
            <h1 className="mt-5 text-[42px] font-semibold leading-[1.04] tracking-[-0.045em] text-white sm:text-[56px]">
              Get paid for the
              <br />
              bugs you find.
            </h1>
            <p className="mt-5 max-w-xl text-[16px] leading-relaxed text-zinc-400">
              ClearAudit is the confidential payout layer for security research. Rewards are
              escrowed in USDC and paid the moment a finding is accepted — no KYC, no invoices, no
              gas token to buy.
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-3">
              <Link href="/app" className="btn btn-primary h-11 px-5 text-[15px]">
                Start earning
              </Link>
              <Link href="/app/rewards" className="btn btn-ghost h-11 px-5 text-[15px]">
                Post a reward
              </Link>
            </div>
            <div className="mt-7 flex flex-wrap items-center gap-x-6 gap-y-2 text-[12px] text-zinc-500">
              <span className="inline-flex items-center gap-1.5">
                <LockIcon className="h-3.5 w-3.5" /> Reports stay encrypted
              </span>
              <span className="inline-flex items-center gap-1.5">
                <BoltIcon className="h-3.5 w-3.5" /> No separate gas token
              </span>
              <span className="inline-flex items-center gap-1.5">
                <ClockIcon className="h-3.5 w-3.5" /> Anchors expire in 30 days
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
          <span>Report anchors on Arkiv</span>
          <span className="hidden h-1 w-1 rounded-full bg-zinc-700 sm:block" />
          <span>EIP-8141 sponsorship on EF devnet</span>
          <span className="hidden h-1 w-1 rounded-full bg-zinc-700 sm:block" />
          <span>Non-custodial by design</span>
        </div>
      </div>

      <section id="why" className="mx-auto w-full max-w-6xl px-5 py-20">
        <div className="max-w-2xl">
          <h2 className="text-[30px] font-semibold tracking-[-0.03em] text-white sm:text-[36px]">
            Security work should pay like work.
          </h2>
          <p className="mt-3 text-[15px] leading-relaxed text-zinc-400">
            Today a critical finding can mean weeks of KYC, invoices and platform fees. We removed
            the payout friction without removing the accountability.
          </p>
        </div>

        <div className="mt-12 grid gap-4 md:grid-cols-3">
          {[
            {
              icon: BoltIcon,
              title: "Paid in one click",
              body: "USDC lands in the researcher's wallet in a single transaction. On Arc, USDC is also the gas token, so they never need to buy a second asset first.",
            },
            {
              icon: ShieldIcon,
              title: "No identity tax",
              body: "Findings are submitted as encrypted reports. The chain verifies that a report exists — not who wrote it or what it contains.",
            },
            {
              icon: ClockIcon,
              title: "Evidence that expires",
              body: "Every report anchor self-deletes after 30 days. Once a bug is fixed, the record of it stops being a permanent target.",
            },
          ].map(({ icon: Icon, title, body }) => (
            <div key={title} className="card p-5">
              <span className="grid h-9 w-9 place-items-center rounded-lg border border-white/10 bg-white/[0.04] text-brand-400">
                <Icon className="h-4.5 w-4.5" />
              </span>
              <h3 className="mt-4 text-[15px] font-medium text-white">{title}</h3>
              <p className="mt-2 text-[13.5px] leading-relaxed text-zinc-400">{body}</p>
            </div>
          ))}
        </div>
      </section>

      <section id="how" className="border-y border-white/6 bg-white/[0.015]">
        <div className="mx-auto w-full max-w-6xl px-5 py-20">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h2 className="text-[30px] font-semibold tracking-[-0.03em] text-white sm:text-[36px]">
                From finding to funds in four steps.
              </h2>
              <p className="mt-3 max-w-xl text-[15px] text-zinc-400">
                No sales calls, no contracts to sign, no currency conversion.
              </p>
            </div>
            <Link href="/app" className="btn btn-ghost h-9 shrink-0">
              Open the app <ArrowUpRight className="h-3.5 w-3.5" />
            </Link>
          </div>

          <div className="mt-12 grid gap-x-8 gap-y-10 sm:grid-cols-2 lg:grid-cols-4">
            {FLOW.map((f) => (
              <div key={f.step}>
                <div className="font-mono text-[11px] tracking-widest text-brand-400">{f.step}</div>
                <div className="mt-2 h-px w-full bg-gradient-to-r from-brand-400/60 to-transparent" />
                <h3 className="mt-4 text-[15px] font-medium text-white">{f.title}</h3>
                <p className="mt-2 text-[13.5px] leading-relaxed text-zinc-400">{f.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto grid w-full max-w-6xl gap-4 px-5 py-20 md:grid-cols-2">
        {[
          {
            tag: "For companies",
            title: "Run a program without building a payout desk.",
            points: [
              "Fund a reward in USDC from any wallet",
              "Pay only when you accept a finding",
              "Dispute path with an independent arbitrator",
              "Public, auditable payment history",
            ],
            cta: "Post a reward",
            href: "/app/rewards",
          },
          {
            tag: "For researchers",
            title: "Get paid for the work, not for the paperwork.",
            points: [
              "No KYC and no bank account to receive USDC",
              "No gas token needed to get paid",
              "Encrypted reports with expiry built in",
              "One wallet, every program",
            ],
            cta: "Start earning",
            href: "/app",
          },
        ].map((c) => (
          <div key={c.tag} className="card flex flex-col p-6">
            <span className="chip w-fit">{c.tag}</span>
            <h3 className="mt-4 text-[20px] font-medium leading-snug tracking-[-0.02em] text-white">
              {c.title}
            </h3>
            <ul className="mt-5 flex-1 space-y-2.5">
              {c.points.map((p) => (
                <li key={p} className="flex items-start gap-2.5 text-[13.5px] text-zinc-400">
                  <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-brand-400" />
                  {p}
                </li>
              ))}
            </ul>
            <Link href={c.href} className="btn btn-ghost mt-6 w-fit">
              {c.cta} <ArrowUpRight className="h-3.5 w-3.5" />
            </Link>
          </div>
        ))}
      </section>

      <section id="pricing" className="border-y border-white/6 bg-white/[0.015]">
        <div className="mx-auto w-full max-w-6xl px-5 py-20">
          <h2 className="text-[30px] font-semibold tracking-[-0.03em] text-white sm:text-[36px]">
            Simple pricing.
          </h2>
          <p className="mt-3 max-w-xl text-[15px] text-zinc-400">
            You only pay when money actually moves to a researcher.
          </p>

          <div className="mt-10 grid gap-4 md:grid-cols-3">
            {[
              {
                name: "Researcher",
                price: "Free",
                unit: "forever",
                points: ["Receive any reward", "No KYC to get paid", "Encrypted submissions"],
                cta: "Start earning",
                href: "/app",
                featured: false,
              },
              {
                name: "Company",
                price: "0%",
                unit: "in the deployed vault",
                points: ["Unlimited programs", "Dispute resolution", "Public payment history", "No fee on deposits"],
                cta: "Post a reward",
                href: "/app/rewards",
                featured: true,
              },
              {
                name: "Self-hosted",
                price: "MIT",
                unit: "source available",
                points: ["Run your own vault", "Your arbitrator, your rules", "Same contracts, same guarantees"],
                cta: "Read the code",
                href: "https://github.com",
                featured: false,
              },
            ].map((p) => (
              <div
                key={p.name}
                className={`card p-6 ${p.featured ? "border-brand-500/40 bg-brand-500/[0.06]" : ""}`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-[13px] text-zinc-400">{p.name}</span>
                  {p.featured && <span className="chip border-brand-400/40 text-brand-300">Most used</span>}
                </div>
                <div className="mt-4 flex items-end gap-1.5">
                  <span className="text-[34px] font-semibold tracking-[-0.03em] text-white">{p.price}</span>
                  <span className="pb-1.5 text-[12px] text-zinc-500">{p.unit}</span>
                </div>
                <ul className="mt-5 space-y-2.5">
                  {p.points.map((pt) => (
                    <li key={pt} className="flex items-start gap-2.5 text-[13px] text-zinc-400">
                      <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-zinc-600" />
                      {pt}
                    </li>
                  ))}
                </ul>
                <Link
                  href={p.href}
                  className={`btn mt-6 w-full ${p.featured ? "btn-primary" : "btn-ghost"}`}
                >
                  {p.cta}
                </Link>
              </div>
            ))}
          </div>
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
                Start with your first reward today.
              </h2>
              <p className="mt-2 text-[14px] text-zinc-400">
                Connect a wallet, name a researcher, fund the amount. That is the whole setup.
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
