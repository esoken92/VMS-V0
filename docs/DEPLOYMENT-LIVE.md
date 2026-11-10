# DEPLOYMENT-LIVE.md — Hosted deployment guide

Step-by-step to take this repo from local-only to a hosted deployment on
**Vercel + Supabase (hosted Postgres only)**. Supabase is used purely as a
managed Postgres database — the app uses **Auth.js credentials** and its own
storage driver, not Supabase Auth/Storage/Realtime.

> **Status (provisioned by agent — see "Already done" below):** the Vercel
> project exists and env vars are staged. The Supabase project does **not**
> exist yet — the Supabase management MCP was unauthenticated, so Step 1–3 are
> manual. Nothing is deployed yet; the data-layer port is still in progress.

---

## Already done (by the provisioning agent)

| Item | Value |
|---|---|
| Vercel project | `vms-v0` (id `prj_l6FWklSBfv0sjo8nJjp4ceQCU6tC`) |
| Team | `kurt-jonathan-s-projects` (`team_eiHEZQZtAZMNdFlwTh2EtYar`) |
| Git link | `github.com/esoken92/VMS-V0`, production branch `main` |
| Expected domain | `https://vms-v0.vercel.app` (assigned on first deploy) |
| Deployments | **None** — link-only, per "do not deploy yet" |

Env vars already set on the Vercel project (target: `production` + `preview`):

| Key | Status |
|---|---|
| `AUTH_SECRET` | ✅ real value set (sensitive — not stored in this file) |
| `AUTH_URL` | ✅ `https://vms-v0.vercel.app` |
| `NEXT_PUBLIC_APP_URL` | ✅ `https://vms-v0.vercel.app` |
| `DATABASE_URL` | ⚠️ **placeholder** — replace with the real pooled URL in Step 4 |

### What remains (manual)

1. Create the Supabase project + run migrations + seed (Steps 1–3)
2. Paste the real `DATABASE_URL` into Vercel (Step 4)
3. Create seed logins so `profiles.password_hash` is populated (Step 5)
4. Disable Vercel Authentication if the app must be public (Step 6)
5. First deploy (Step 7)

---

## Step 1 — Create the Supabase project

The agent could not do this: the `supabase-mcp-server` MCP has no
`SUPABASE_ACCESS_TOKEN`, `supabase-remote` fails to load, and the connected
`supabase` MCP is bound to the **live TyreSync database** — do **not** point
this app there.

1. Go to https://supabase.com/dashboard → **New project**
2. Name: `vms-v0` · Plan: **Free** · Region: **`eu-west-1` (Ireland)** —
   closest available to South Africa
3. Save the generated **DB password** somewhere safe (needed for Step 4)

## Step 2 — Run the migrations

Dashboard → **SQL Editor** → New query. Paste and run each file from
`supabase/migrations/` **in order**:

```
000_bootstrap.sql
001_initial_schema.sql
002_audit_triggers.sql
003_system_settings.sql
004_impersonation_sessions.sql
005_user_management_functions.sql
006_add_manager_role.sql
007_rpc_functions.sql
008_storage_bucket.sql
009_user_alert_preferences.sql
010_app_layer_stock_math.sql
```

Notes on hosted-Supabase compatibility (no edits needed, but be aware):

- `000_bootstrap.sql` is written for plain Postgres and is **idempotent** on
  hosted Supabase: `CREATE SCHEMA/TABLE IF NOT EXISTS` and the role checks are
  no-ops where `auth`, `storage`, `authenticated`, `anon` already exist.
- It does `CREATE OR REPLACE FUNCTION auth.uid()` returning `NULL` — this
  overwrites the managed Supabase function. **Harmless on a dedicated project**
  (the app never uses Supabase Auth; it connects as `postgres`, which bypasses
  the RLS policies the later migrations create — they are inert
  defense-in-depth by design).
- Alternatively: run locally with `supabase link` + `supabase db push`, or
  `psql "$SESSION_POOLER_URL" -f supabase/migrations/XXX.sql` per file.

### Required extra DDL (not yet in the repo migrations)

The app verifies logins against `profiles.password_hash` (argon2id —
`auth.ts`, `lib/actions/auth.ts`), but **no migration creates that column**
(it was supposed to come from a drizzle delta that doesn't exist yet). Run:

```sql
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS password_hash TEXT;
```

Without this, every login fails and `signupUser` errors on insert.

## Step 3 — Seed seed data (optional, recommended for evaluation)

Paste `supabase/seed.sql` into the SQL Editor (or
`psql "$SESSION_POOLER_URL" -f supabase/seed.sql`).

It creates bin locations, suppliers, ~35 products, stock movements, tool
loans, stock takes, and the four seed `auth.users`/`profiles` rows.

⚠️ The seed sets `auth.users.encrypted_password` (bcrypt) which the app
**ignores** — it verifies `profiles.password_hash` (argon2id). So seeded users
cannot log in until Step 5 gives them hashes.

## Step 4 — Put the real DATABASE_URL in Vercel

Dashboard → Supabase project → **Connect** → copy the **Transaction pooler**
string (port `6543`), then add the query params the app's postgres.js driver
needs (`sslmode=require` and `prepare=false` — PgBouncer transaction mode has
no prepared-statement support; both are parsed from the URL by postgres.js
v3.4.9, no code change required):

```
postgresql://postgres.YOUR_REF:YOUR_DB_PASSWORD@aws-0-eu-west-1.pooler.supabase.com:6543/postgres?sslmode=require&prepare=false
```

Update it at Vercel → project `vms-v0` → **Settings → Environment
Variables** → `DATABASE_URL` (a placeholder with this exact shape is already
there — just replace the ref/password/region tokens).

For local psql/admin access use the **Session pooler** (`…pooler.supabase.com:5432`,
IPv4-friendly, supports prepared statements); the direct host
`db.YOUR_REF.supabase.co` is IPv6-only on the free tier.

## Step 5 — Create working seed logins

`seed.sql` does not populate `profiles.password_hash`. Easiest path — after
the first deploy is live:

1. Sign up each seed account through the app at
   `https://vms-v0.vercel.app/auth/signup` using the emails/passwords
   below (sign-up assigns role `staff` and writes a proper argon2id hash).
2. Promote roles in the Supabase SQL Editor:

```sql
UPDATE profiles SET role = 'super_admin'
  WHERE user_id IN (SELECT id FROM auth.users WHERE email = 'admin@vms-v0.local');
UPDATE profiles SET role = 'manager'
  WHERE user_id IN (SELECT id FROM auth.users WHERE email = 'manager@vms-v0.local');
UPDATE profiles SET role = 'fleet_dispatch'
  WHERE user_id IN (SELECT id FROM auth.users WHERE email = 'fleet@vms-v0.local');
-- worker@vms-v0.local stays 'staff'
```

Alternative: generate argon2id hashes locally
(`node -e "require('argon2').hash('VmsAdmin123!',{type:2}).then(console.log)"`)
and `UPDATE profiles SET password_hash = '…' WHERE …`.

### Seed credentials (from README / seed.sql)

| Role | Email | Password |
|---|---|---|
| Super Admin | `admin@vms-v0.local` | `VmsAdmin123!` |
| Manager | `manager@vms-v0.local` | `VmsManager123!` |
| Fleet Dispatch | `fleet@vms-v0.local` | `VmsFleet123!` |
| Warehouse Staff | `worker@vms-v0.local` | `VmsWorker123!` |

Only seed these into environments you don't mind being public.

## Step 6 — Deployment protection (public deployment)

The team default has **Vercel Authentication (SSO protection)** enabled for
`all_except_custom_domains` — visitors will hit a Vercel login wall. For a
public deployment: Vercel → project → **Settings → Deployment Protection** → set
Vercel Authentication to **Off** (or keep it on if the deployment should stay
private).

## Step 7 — First deploy

- Push to `main` (auto-deploys), **or** Vercel dashboard → project →
  **Deployments → Deploy**.
- First successful build assigns `https://vms-v0.vercel.app`.
- Watch the build: `npm run build` must pass — the data-layer port is still in
  progress, so expect possible failures unrelated to infra (e.g. missing
  `scripts/migrate.ts`/`scripts/seed.ts` referenced by `npm run db:*` scripts —
  use the SQL files instead).

## Verify

```sql
SELECT table_name FROM information_schema.tables
WHERE table_schema = 'public' ORDER BY table_name;
-- expect: activity_logs, bin_locations, impersonation_sessions, products,
-- profiles, receiving_documents, receiving_items, stock_movements,
-- stock_take_items, stock_takes, suppliers, system_settings, tool_loans,
-- unit_conversions
```

Then sign in at `https://vms-v0.vercel.app` with a seed account.

---

## Appendix — MCP failures encountered (for fixing later)

| Server | Symptom | Fix needed |
|---|---|---|
| `supabase-mcp-server` | `Unauthorized. Please provide a valid access token … --access-token flag or SUPABASE_ACCESS_TOKEN` on `list_organizations`/`list_projects` | Set a Supabase personal access token in the server env |
| `supabase-remote` | `Failed to list tools` (server doesn't load) | Check server config/URL |
| `supabase` | Works, but bound to project `bflflqsqhcrnhqsyoapt` = **live TyreSync DB** (`tss.*` schema, production data) | Intentionally unused — never mix this app into that project |
| `github-mcp-server` | `Failed to connect` on one call | Repo verified via `git ls-remote` instead |
| `vercel`, `devin/vercel` | `vercel` works (used for everything above); `devin/vercel` fails to list tools | — |
