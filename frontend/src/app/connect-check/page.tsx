"use client";

import { useState } from "react";
import Link from "next/link";

type Probe = { label: string; ok: boolean; detail: string };

/**
 * A wallet-connection check that does not depend on our own stack.
 *
 * It talks EIP-1193 directly, in the same order our connector does, and prints
 * the raw reply or the raw error for each step. If a wallet refuses us, this is
 * where the refusal is legible instead of turning into a one-line message.
 */
export default function ConnectCheck() {
  const [probes, setProbes] = useState<Probe[] | null>(null);
  const [running, setRunning] = useState(false);

  async function run() {
    setRunning(true);
    const out: Probe[] = [];
    const eth = (window as unknown as { ethereum?: { request: (a: unknown) => Promise<unknown>; isTrust?: boolean; isMetaMask?: boolean; isTrustWallet?: boolean; isRabby?: boolean; isOkxWallet?: boolean; providers?: unknown[] } }).ethereum;

    out.push({
      label: "window.ethereum",
      ok: Boolean(eth),
      detail: eth
        ? JSON.stringify({
            isTrust: eth.isTrust ?? null,
            isTrustWallet: eth.isTrustWallet ?? null,
            isMetaMask: eth.isMetaMask ?? null,
            isRabby: eth.isRabby ?? null,
            isOkxWallet: eth.isOkxWallet ?? null,
            competingProviders: Array.isArray(eth.providers) ? eth.providers.length : 0,
          })
        : "missing — no injected wallet on this origin",
    });
    out.push({ label: "origin", ok: true, detail: `${location.protocol}//${location.host}` });
    out.push({ label: "user agent", ok: true, detail: navigator.userAgent.slice(0, 160) });
    if (!eth) {
      setProbes(out);
      setRunning(false);
      return;
    }

    async function probe(label: string, method: string, params?: unknown, expectAccounts = false) {
      try {
        const result = await eth!.request(params === undefined ? { method } : { method, params });
        const accounts = Array.isArray(result) && result.length > 0 && typeof result[0] === "string";
        out.push({
          label,
          ok: expectAccounts ? accounts : true,
          detail: JSON.stringify(result).slice(0, 220),
        });
      } catch (e) {
        const record = (e ?? {}) as { code?: unknown; message?: unknown; data?: { message?: unknown } };
        out.push({
          label,
          ok: false,
          detail: `code ${String(record.code ?? "?")} · ${
            typeof record.message === "string"
              ? record.message
              : typeof record.data?.message === "string"
                ? record.data.message
                : JSON.stringify(e)
          }`.slice(0, 240),
        });
      }
    }

    await probe("eth_chainId", "eth_chainId");
    await probe("eth_accounts", "eth_accounts");
    await probe("eth_requestAccounts", "eth_requestAccounts", undefined, true);
    await probe("eth_requestAccounts([])", "eth_requestAccounts", [], true);
    await probe("wallet_getPermissions", "wallet_getPermissions");
    await probe("wallet_requestPermissions", "wallet_requestPermissions", [{ eth_accounts: {} }]);
    await probe("wallet_switchEthereumChain(Arc)", "wallet_switchEthereumChain", [
      { chainId: "0x4cef52" },
    ]);
    await probe("eth_requestAccounts (after switch)", "eth_requestAccounts", undefined, true);
    await probe("eth_accounts (after permission)", "eth_accounts", undefined, true);

    setProbes(out);
    setRunning(false);
  }

  return (
    <div className="mx-auto w-full max-w-[720px] px-6 py-14">
      <h1 className="text-[24px] font-semibold tracking-[-0.02em] text-white">Wallet connection check</h1>
      <p className="mt-2 text-[13.5px] leading-relaxed text-zinc-500">
        Runs the same EIP-1193 calls our connect button runs, in the same order, and prints each raw
        reply. Nothing is stored and nothing is signed.
      </p>

      <button className="btn btn-primary mt-6" onClick={run} disabled={running}>
        {running ? "Checking…" : "Run check"}
      </button>

      {probes && (
        <div className="mt-6 overflow-hidden rounded-xl border border-white/8">
          {probes.map((p) => (
            <div key={p.label} className="border-b border-white/8 p-3 last:border-b-0">
              <div className="flex items-center justify-between gap-3">
                <span className="font-mono text-[11.5px] text-zinc-300">{p.label}</span>
                <span className={`text-[10.5px] ${p.ok ? "text-emerald-400" : "text-red-400"}`}>
                  {p.ok ? "ok" : "failed"}
                </span>
              </div>
              <div className="mt-1 break-all font-mono text-[10.5px] leading-relaxed text-zinc-500">
                {p.detail}
              </div>
            </div>
          ))}
        </div>
      )}

      {probes && (
        <p className="mt-4 text-[11.5px] leading-relaxed text-zinc-600">
          Copy this output if you are reporting a failure — the codes are what identify the wallet
          build. Then{" "}
          <Link href="/app" className="underline decoration-white/20 underline-offset-4 hover:text-zinc-300">
            go back to the app
          </Link>
          .
        </p>
      )}
    </div>
  );
}
