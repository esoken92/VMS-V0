# VMS-Demo-V0 — Agent Notes (clean-slate reboot)

## Architecture decisions (decided, do not revert)

- **Self-hosted first. Local-only build.** No Vercel, no Supabase Cloud,
  no external services provisioned by us. App must run on the dev's PC and
  later on a client's PC — including old/constrained hardware.
- **Postgres + Auth.js** — Postgres 16 via `docker-compose.yml` (the only
  required service). Auth.js v5 credentials provider, argon2id hashing.
  No Supabase anywhere: remove `@supabase/*` deps, `lib/supabase/*`,
  middleware Supabase clients, supabase-js call sites.
- **Deployment topology:** the DB+app server runs on a company server —
  entry-level target is ~i5/8GB or Xeon/16GB, NOT a toaster. "Old PC"
  refers to the *client* device (browser/PWA) — that's a front-end
  performance constraint (low render budget, mobile parity), not a
  database constraint. Postgres can additionally carry RLS as
  defense-in-depth behind the app-layer permission matrix — optional
  hardening, never the primary check.
- **Drizzle ORM** — schema in `drizzle/schema.ts` generated from
  `supabase/migrations/*.sql` (kept as the canonical DB init via
  `/docker-entrypoint-initdb.d`). `drizzle-kit` for future migrations;
  additive only.
- **Application-layer authorization** — replaces RLS. Every server action
  / API route validates input (Zod) then checks the permission matrix
  (resource × action × scope) before touching the DB. Never client-side
  auth checks for enforcement.
- **Dual artifact stays** — web (Next.js+Postgres) now; Rust offline app
  (Tauri + Axum + SQLite) later, sharing the OpenAPI contract.
- **Telemetry: never.** No analytics/phone-home anywhere. Remove
  `@vercel/analytics` + `@vercel/speed-insights`.

## Integrations = framework + docs only

We BUILD the integration points (env-gated, adapter interfaces, routes)
but DO NOT provision services. Each integration gets a section in
`docs/INTEGRATIONS.md` telling the user (or their agent) exactly what to
sign up for and which env vars to set:

- Resend (email) — `RESEND_API_KEY`, `EMAIL_FROM`
- OpenAI-compatible (AI) — `OPENAI_API_KEY`, `OPENAI_BASE_URL`
- MCP endpoint — local by default, API-key optional hardening
- Object storage — local FS default (`./storage`), S3-compatible optional
- Typst PDF — in-process only, never Chromium/Playwright
- Sensors — authenticated ingestion endpoint; simulator built-in

Unset env → feature disables gracefully, UI shows "not configured".

## Commands

```bash
# Zero-install path (no Docker, no Postgres): embedded PGlite at ./.vms-data
npm run dev:standalone        # bootstraps .vms-data on first run, then next dev
npm run db:bootstrap          # apply pending migrations + refresh demo hashes
npm run db:reset              # wipe .vms-data + rebuild (recovery path)

# Postgres path (Docker or installed server — DATABASE_URL in .env)
docker compose up -d          # Postgres 16 (+ auto-applies migrations)
npm install                   # after supabase deps removed
npm run dev                   # app at localhost:3000
npm run type-check && npm run lint && npm run build
```

Driver selection lives in `lib/db/driver.ts`: `DATABASE_URL` set →
postgres.js pool; unset → embedded PGlite (`./.vms-data`, gitignored).
Both expose the same `db`/`sqlClient` surface from `@/lib/db`.

Embedded multi-process ownership (`lib/db/pglite-factory.ts`): exactly one
process owns `.vms-data` via an atomic `vms-owner.json` claim file and
serves it on a localhost socket (@electric-sql/pglite-socket); every other
context/process attaches over postgres.js. `next dev` runs several worker
processes, so NEVER open a second raw `new PGlite()` on the same data dir —
two concurrent postgres backends corrupt the WAL (observed: PANIC "could
not locate a valid checkpoint record" → `npm run db:reset` to recover).
For the same reason do not delete `.vms-data/postmaster.pid` while a dev
server might be running — its pid (-42) is fake and cannot be liveness-
checked; `vms-owner.json` is the real liveness signal.

## Definition of done

- type-check / lint / build green; no console errors in dev click-through
- `docs/PLAYTEST.md` updated after every manual pass
- Seed users log in; every existing page works end-to-end on the new
  stack before ANY new feature work
- Commits stay private; repo flips public ONLY on explicit owner
  instruction (see `docs/MASTER_EXECUTION_PROMPT.md` acceptance list)

## Hard rules

- Only write inside this repo. Read anything for research.
- Additive migrations only; never edit applied ones.
- Zod at every boundary; no `any` on new code.
- No secrets in repo; `.env` never committed.
- Keep service secrets server-side.
