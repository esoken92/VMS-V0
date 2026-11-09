# VMS-Demo-V0 — Agent Notes (clean-slate reboot)

## Architecture decisions (decided, do not revert)

- **Self-hosted first. Local-only build.** No Vercel, no Supabase Cloud,
  no external services provisioned by us. App must run on the dev's PC and
  later on a client's PC — including old/constrained hardware.
- **Postgres + Auth.js** — Postgres 16 via `docker-compose.yml` (the only
  required service). Auth.js v5 credentials provider, argon2id hashing.
  No Supabase anywhere: remove `@supabase/*` deps, `lib/supabase/*`,
  middleware Supabase clients, supabase-js call sites.
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
docker compose up -d          # Postgres 16 (+ auto-applies migrations)
npm install                   # after supabase deps removed
npm run dev                   # app at localhost:3000
npm run type-check && npm run lint && npm run build
```

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
