<div align="center">

# VMS — Inventory Management, Open Source

**Inventory management that respects the people doing the work.**

A free, open-source, self-hosted inventory template for teams still
running stock on spreadsheets and paper: typed storerooms, scan-first
workflows, an append-only ledger, tool custody, sensor monitoring, and
an audit trail that never forgets.

[![License: CC BY-NC-SA 4.0](https://img.shields.io/badge/License-CC%20BY--NC--SA%204.0-lightgrey.svg)](https://creativecommons.org/licenses/by-nc-sa/4.0/)
[![Next.js 14](https://img.shields.io/badge/Next.js-14-black?logo=next.js)](https://nextjs.org/)
[![Postgres 16](https://img.shields.io/badge/Postgres-16-336791?logo=postgresql&logoColor=white)](https://www.postgresql.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-strict-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![PWA](https://img.shields.io/badge/PWA-offline--capable-5A0FC8)](https://web.dev/progressive-web-apps/)

[Live demo](#demo-credentials) ·
[Documentation](docs/ARCHITECTURE.md) ·
[Integrations](docs/INTEGRATIONS.md) ·
[Report an issue](https://github.com/esoken92/VMS-Demo-V0/issues)

</div>

---

## Why this exists

~94% of audited spreadsheets contain errors. Paper records what you write
down — never what it doesn't see. Most small operations don't choose
between inventory systems; they choose between a system and a
spreadsheet, and the spreadsheet wins on price and familiarity while
losing on everything else: no audit trail, no alerts, invisible
shrinkage, month-ends that never reconcile.

VMS is the "actually do it properly" template — the same stock engine the
big systems use (append-only ledger, role-based permissions, scan-first
UX), packaged so a single `docker compose up` gets you a working system.
See the reasoning in [docs/LOGIC_CHAIN.md](docs/LOGIC_CHAIN.md) and the
research behind it in [docs/research/](docs/research/).

## ⚡ Quickstart — under 5 minutes

**Prerequisites:** Node.js 18+ and Docker.

```bash
docker compose up -d        # Postgres 16 — schema auto-initialises
cp .env.example .env        # set AUTH_SECRET (openssl rand -base64 32)
npm install && npm run dev  # → http://localhost:3000
```

`docker-compose.yml` mounts `supabase/migrations/` into the Postgres
container, so the schema builds itself on first boot. Load the demo
dataset (`supabase/seed.sql`) to sign in with the accounts below — it
seeds users, bin locations, suppliers, products, movements, tool loans,
and stock takes.

> ⚠️ The seed creates **well-known public credentials**. Demos and local
> development only — never on data you care about.

## Demo credentials

| Role            | Email                        | Password          |
|-----------------|------------------------------|-------------------|
| Super Admin     | `demo.admin@vms-demo.com`    | `DemoAdmin123!`   |
| Manager         | `demo.manager@vms-demo.com`  | `DemoManager123!` |
| Fleet Dispatch  | `demo.fleet@vms-demo.com`    | `DemoFleet123!`   |
| Warehouse Staff | `demo.worker@vms-demo.com`   | `DemoWorker123!`  |

New sign-ups get the `staff` role; promote accounts from the Users page
as a super admin.

## 📸 Screenshots

> Real captures land in `docs/screenshots/` as the template ships —
> the landing page already shows the frames these will fill.

| Dashboard | Scan-first | Stock take |
|---|---|---|
| *screenshot coming soon* | *screenshot coming soon* | *screenshot coming soon* |
| Stat cards, alerts, activity feed — every number deep-links to where you act | Camera / wedge / RFID — one scan is one action | Blind counts, variance review, cycle counts |

## ✨ Features

- **Storerooms by type** — cold room, dry store, secure cage, vehicle bay,
  hazmat; per-room rules, item allowlists, and access levels
- **Scan-first workflows** — barcode, QR, and RFID via camera,
  USB/Bluetooth wedge, or RFID reader; one scan = one action
- **Append-only ledger** — every quantity change is a new row with actor,
  reason, before/after. Corrections are entries, never edits
- **RBAC personas** — `super_admin`, `admin`, `manager`, `fleet_dispatch`,
  `staff`; permission checks run server-side, always
- **Stock takes** — blind counts, variance review before posting, cycle
  counting
- **Tool loans** — check-out/check-in with condition logging and overdue
  tracking
- **Sensor monitoring** — temp/humidity/door telemetry per room,
  threshold rules, excursion alerts, built-in demo simulator
- **REST API + MCP server** — scoped API keys; agents and assistants can
  query stock through MCP tools with the same permission checks
- **Offline-capable PWA** — installable; scans queue locally and sync
  honestly when the network returns
- **Self-hosted** — Postgres + one Next.js app. No telemetry, no per-seat
  fees, your data stays yours

## 🏗 Architecture

Every request walks one chain — nothing reaches the database without
passing every gate:

```
request → middleware → auth gate → permission check
        → Postgres transaction → append-only audit log → UI
```

Stack: **Next.js 14** (App Router) · **React 18** · **TypeScript strict** ·
**Tailwind** · **Postgres 16** · **Drizzle ORM** · **Auth.js v5**
(credentials, argon2id) · **next-pwa** + Dexie offline queue ·
**Recharts** · **Typst** PDF reports (in-process — no Chromium).

Deep dive: [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) ·
Narrative walkthrough: [docs/LOGIC_CHAIN.md](docs/LOGIC_CHAIN.md)

## 🚀 Deployment paths

| Path | What you do | Best for |
|---|---|---|
| **Local Docker** | `docker compose up -d` + `npm run dev` | Demos, evaluation, development |
| **Self-hosted server** | Postgres + `npm run build && npm start` on an entry-level box (~i5/8 GB); reverse proxy for TLS | Real deployments — site servers, LAN, air-gapped |
| **Vercel + hosted Postgres** | Deploy to Vercel, point `DATABASE_URL` at Supabase/Neon/RDS (pooler URL) | Hosted demos, teams that want managed infra |

All three run the same code — there is no cloud-only feature to unlock.
Details per topology in [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md#deployment-topologies).

## 🔌 Integrations

Every integration point ships built — adapters, routes, env hooks — but
nothing is provisioned. Unset env vars disable the feature gracefully;
the app runs fully without them.

| Service | Powers | Required? |
|---|---|---|
| Postgres (`DATABASE_URL`) | Everything | ✅ |
| Auth.js (`AUTH_SECRET`) | Sessions | ✅ |
| Resend | Password resets, alert digests | Optional |
| OpenAI-compatible API | NL inventory queries, datasheet → product | Optional |
| S3-compatible storage | Photos, attachments (local FS default) | Optional |
| MQTT/webhook sensors | Room telemetry (`POST /api/sensors/ingest`) | Optional — simulator included |
| MCP | Agent/tool access | Built-in, no service needed |

Wiring instructions for each: **[docs/INTEGRATIONS.md](docs/INTEGRATIONS.md)**.

## 🤝 Contributing

Issues and PRs welcome — this is a template, so the bar is "useful to the
next person who forks it".

- `npm run type-check` and `npm run lint` must pass
- **Additive migrations only** — never edit an applied migration file
- Quantities change through the ledger, never in place
- Server-side authorization on every action; Zod-validate at boundaries
- Reference AGPL project *patterns* (Part-DB, Snipe-IT, InvenTree) —
  never copy their code, it isn't license-compatible
- Evaluating the app as a user? Follow [docs/PLAYTEST.md](docs/PLAYTEST.md)

## 📄 License

[CC BY-NC-SA 4.0](LICENSE) — free to use, modify, and share for
**non-commercial** purposes, with attribution, under the same license.
Commercial use requires separate permission — reach out below.

## Contact

Part of the **[ESO Industries](https://esoind.co.za)** ecosystem —
see also [TyreSync](https://tyresync.co.za).

**Kurt Jonathan** — [esoken92@gmail.com](mailto:esoken92@gmail.com)

© 2026 ESO Industries. Licensed under CC BY-NC-SA 4.0.
