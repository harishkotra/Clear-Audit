# ClearAudit frontend

Next.js 16 app for ClearAudit: marketing site, wallet workspace (`/app`), public evidence (`/evidence`), and the EF gasless demo (`/app/gasless`).

Product context, architecture, deployments, and how the project was built live in the [repository README](../README.md).

## Run

From the repo root (preferred):

```bash
npm --prefix frontend install
npm --prefix frontend run dev
```

Or from this directory:

```bash
npm install
npm run dev
```

Copy `.env.example` to `.env.local` and fill server-only keys (`ARKIV_*`, `PROTOCOL_PRIVATE_KEY`). Never prefix secrets with `NEXT_PUBLIC_`.

## Scripts

| Command | What it does |
| --- | --- |
| `npm run dev` | Dev server (Turbopack) |
| `npm run build` | Production build |
| `npm run start` | Serve the production build |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run lint` | ESLint |

Chain verification (`npm run verify:chain`) and ABI generation run from the **repo root**, not here.
