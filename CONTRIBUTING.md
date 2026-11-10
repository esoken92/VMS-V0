# Contributing

Issues and PRs welcome — this is a template, so the bar is "useful to
the next person who forks it".

## Dev setup

**Zero services (fastest):**

```bash
cp .env.example .env          # set AUTH_SECRET (openssl rand -base64 32)
npm install
npm run dev:standalone        # → http://localhost:3000
```

`dev:standalone` runs an embedded Postgres (PGlite) persisted at
`./.vms-data`, bootstraps the schema + demo data on first run, then
starts Next.js. Sign in with `demo.admin@vms-demo.com` /
`DemoAdmin123!`. Nothing else to install.

**Docker Postgres (full parity):**

```bash
docker compose up -d          # Postgres 16 — schema auto-initialises
cp .env.example .env          # set AUTH_SECRET + DATABASE_URL
npm install && npm run dev
```

With `DATABASE_URL` set the app always uses the real server; unset, it
falls back to the embedded store. Driver selection lives in
`lib/db/driver.ts`.

## Commands

| Command | What it does |
|---|---|
| `npm run type-check` | `tsc --noEmit` |
| `npm run lint` | `next lint` |
| `npm run build` | production build |
| `npm run db:bootstrap` | apply pending migrations + demo seed to the embedded store |
| `npm run db:seed` | load demo data (server Postgres path) |
| `npm run db:migrate` | apply migrations to a server Postgres |
| `npm run db:reset` | wipe + rebuild `.vms-data` (recovery for a corrupt store) |
| `npx tsx scripts/verify-ledger.ts` | read-only reconciliation: every product's stock must equal opening + Σ movements. Gates in CI |

## Architecture rules

These aren't preferences — the design depends on them:

- **Additive migrations only.** Never edit an applied file under
  `supabase/migrations/` or `drizzle/*.sql` — add a new one.
- **Quantities change through the ledger, never in place.** Every stock
  change is a new `stock_movements` row inside a transaction;
  corrections are entries, not edits. `verify-ledger` fails CI on drift.
- **Server-side authorization on every action.** Every server action and
  API route Zod-validates input, then checks the permission matrix
  before touching the DB. Client-side role checks are UX, never
  enforcement.
- **Zod at every boundary.** Untrusted input gets parsed before use;
  no `any` on new code.
- **`Result<T>` returns, never throws.** Server actions return
  `ok(data)` / `fail(message, code)` from `lib/result.ts` — the UI
  renders errors, it doesn't catch them.
- **No telemetry, ever.** Optional integrations disable gracefully when
  their env vars are unset — wire nothing by default.
- **One owner per `.vms-data`.** Never open a second raw `PGlite` on the
  same data dir — concurrent backends corrupt the WAL. The
  ownership-aware client in `lib/db/pglite-factory.ts` handles this;
  use it.

## PR checklist

- [ ] `npm run type-check`, `npm run lint`, `npm run build` pass
- [ ] Migrations additive; `npm run db:bootstrap` applies cleanly on a
      fresh store
- [ ] `npx tsx scripts/verify-ledger.ts` passes if you touched stock
      writes
- [ ] New actions: Zod input → permission check → `Result<T>`
- [ ] No secrets, no `.env`, no new dependencies you haven't justified
- [ ] AGPL projects (Part-DB, Snipe-IT, InvenTree): reference their
      *patterns* only — their code isn't license-compatible, never copy it

Bigger change? Open an issue first — a paragraph on the "why" saves a
rejected PR.
