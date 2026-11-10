# Playtest Script — VMS V0

> A guided script for putting the app in front of a real person and
> watching what breaks. Run it before shipping to a stakeholder, after any
> data-layer change, and whenever a flow "should obviously work".

## Before you start

- [ ] `docker compose up -d` — Postgres healthy (`docker compose ps`)
- [ ] `.env` configured (see `.env.example`; `DATABASE_URL` + `AUTH_SECRET` minimum)
- [ ] Schema + seed applied (seed users exist — see README credentials table)
- [ ] `npm run type-check` and `npm run lint` green
- [ ] A phone available for mobile/PWA checks (or DevTools device mode)

## Roles to cycle

| Persona | Account | Lens |
|---|---|---|
| Super admin | `admin@vms-v0.local` | Can do everything; watch for privilege that should feel loud |
| Manager | `manager@vms-v0.local` | Approvals, reports, variance sign-off |
| Fleet dispatch | `fleet@vms-v0.local` | Inbound/outbound only; should *not* see admin surfaces |
| Staff | `worker@vms-v0.local` | Count, scan, request — least privilege |

## Script

### 1. First impressions (5 min)

- [ ] Landing page loads `< 2 s`, readable on mobile
- [ ] "Open the app" leads somewhere sensible; seed creds easy to find
- [ ] Login works first try for each persona
- [ ] Wrong password fails with a clear, non-specific error

### 2. The money loop — receive → move → count (15 min)

- [ ] Receive stock against a product (inbound movement)
- [ ] Confirm quantity changed *and* a ledger row exists for it
- [ ] Move/issue stock out — balance reflects the projection
- [ ] Run a blind stock take — does it avoid revealing system qty?
- [ ] Variance surfaces for review before posting

### 3. Tool custody (5 min)

- [ ] Check a tool out to a user — due date recorded
- [ ] Check it back in — condition logged
- [ ] Overdue loans are visibly flagged somewhere

### 4. Authorization probes (10 min)

- [ ] As `staff`, try an admin URL directly (`/dashboard/users`) — denied how?
- [ ] As `fleet_dispatch`, attempt a write outside scope — 4xx, not silent failure
- [ ] Confirm denied attempts appear in the audit log
- [ ] As `super_admin`, impersonate a user — reason required? banner visible? exit clean?

### 5. Scanning & mobile (10 min)

- [ ] Camera scan on a printed QR/barcode resolves the right product
- [ ] Keyboard-wedge scanner works without touching the screen
- [ ] Unknown barcode offers create-product rather than dead-ending
- [ ] Tap targets usable with gloves (≈48px+), high contrast in daylight

### 6. Offline behavior (5 min)

- [ ] Kill network (DevTools offline) — honest "offline" state, not a spinner
- [ ] Queue a scan/mutation offline; reconnect; confirm it syncs *once*
- [ ] Conflicts surface for resolution — never silently overwritten

### 7. Break-it pass (10 min)

- [ ] Huge quantity values, negatives, zero — validated how?
- [ ] Paste garbage into a scan field — rejected loudly
- [ ] Double-submit a form — idempotent? duplicate ledger rows?
- [ ] Refresh mid-stock-take — state survives?
- [ ] Back-button out of a mutation — no half-state visible

## Capture feedback

| # | Where were you? | What did you try? | What did you expect? | What happened? | Severity |
|---|---|---|---|---|---|
| 1 | | | | | |

## Automated playtest log

| Date | Scope | Findings | Fixes | Result |
|---|---|---|---|---|
| 2025-11-10 | Full click-driven write-flow audit (`scripts/clicktest.mjs`, headless Edge, real DB writes): 34/34 admin + 10/10 worker flows | **Found+fixed:** `upsertProduct` wrote `current_stock` directly with no movement row (ledger bypass — all ClickTest products drifted); ToggleSwitch thumb 16px vs the 20px spec (track was right, thumb undersized); favicon 404; missing double-submit guards on product/movement/stock-take/loan forms (double-click made duplicate rows) | Fixed in-file; clean reseed → 41/41 products reconcile; worker denials verified (403 on outbound API, valuation PDF, builder routes); validation errors inline, no 500s; console errors 0 | 22 flow screenshots in `public/screenshots/flow-*.png` |
| 2025-11-10 | Persona verification — `worker` (staff) screenshot sweep + `manager`/admin route probes | Worker nav shows exactly 7 operator surfaces (dashboard, inventory, stock-movements, stock-takes, tool-loans, zone-map, scan); direct URL hits on rooms/monitoring/reports/integrations → `307 /dashboard/forbidden` with clean 403 page naming the denied path; manager = builder-lite (denied on integrations/users/settings only); "View as worker" preview cookie honored for admin/super_admin only — forged cookie on manager session ignored. Gap found + fixed: `/dashboard/ledger` was nav-hidden but not route-gated — added to `ROUTE_ACCESS` | See `lib/persona.ts` ROUTE_ACCESS; `public/screenshots/worker-*.png` | Console errors 0; all denials redirect, none silent |
| 2025-11-10 | Headless-Edge screenshot sweep of 12 routes as `admin` on embedded PGlite | (1) `/dashboard/monitoring` crashed with `latest is not iterable` — `db.execute` returns `{rows}` on the PGlite socket path vs array on postgres.js; (2) same shape bug crashed `/dashboard/rooms` (`latestTemps.map`); (3) `POST /api/sensors/simulate` 500'd — `set_config('request.headers.x-client-ip')` uses a hyphen, rejected by Postgres GUC name rules ("two or more simple identifiers"); same invalid name read by `002_audit_triggers.sql`; (4) login page seed-creds box showed stale `admin@vms.local` accounts that don't exist in the seed; (5) Reports page shipped a literal "Chart placeholder" div; (6) headless typing raced React hydration — controlled inputs wiped on hydrate, submit never enabled | rows-normalized `db.execute` results in `lib/actions/sensors.ts` + `lib/actions/storerooms.ts`; renamed GUCs to `x_client_ip`/`x_user_agent` in `lib/db/context.ts` + audit migration; updated `LoginForm` creds to seeded accounts; real Recharts stacked-area trend chart on Reports; retry-loop in `scripts/screenshot.mjs` | 12/12 routes captured with real data; monitoring shows live temps + 24h chart; console error count 0 after fixes |

## Notes for the facilitator

- Don't explain the UI beforehand — note where the tester hesitates.
- "I expected it to work like X" is data, not a support request.
- Severity guide: **P0** data loss/corruption · **P1** wrong result or
  blocked flow · **P2** confusion/friction · **P3** polish.

## Pass: slop audit + re-theme (self-audit vs 20 published AI-slop tells)

Fixed this pass:

- **Claims made true.** "Blind counts" now actually blind (system qty removed
  from the counting row); "append-only audit log" now DB-enforced
  (migration 013 — triggers block UPDATE/DELETE/TRUNCATE on activity_logs,
  verified live); offline-queue claims de-scoped to honest roadmap
  (unused `dexie` deps + empty `lib/offline/` removed).
- **Theme.** Default shadcn blue → safety-orange primary + warm neutrals;
  Inter → IBM Plex Sans/Mono; all hardcoded `blue-*` UI chrome moved to the
  `primary` token; decorative purples removed; emoji-as-icons replaced with
  Lucide; README emoji headers stripped; "Welcome back" greeting replaced
  with a functional header; "Finish setup" banner aligned to palette.
- **Bugs.** Stock-takes table overflowed the viewport (full UUID in a
  column) — IDs truncated to 8 chars + `overflow-x-auto`.
- Deduped the `executeRows` normalizer into `lib/db/rows.ts`.

Re-verified: tsc clean · eslint 0 warnings · build green · ledger 35/35 ·
UPDATE/DELETE on activity_logs both raise · all screenshots re-captured.
| 2026-11-10 | Rebrand pass: "VMS V0" product name, all `demo.*@vms-demo.com` → `*@vms-v0.local`, `Demo*123!` → `Vms*123!`, "Demo Credentials" → "Seed accounts" (emoji dropped), package `vms-inventory` → `vms-v0`, manifest/layout/sidebar titles; GitHub repo renamed `VMS-Demo-V0` → `VMS-V0`; Vercel project `vms-demo-v0` → `vms-v0` | Found+fixed: dev server was pointing at `DATABASE_URL` for a non-running Docker postgres → every authorize query ECONNREFUSED'd behind Auth.js `CallbackRouteError` (login page showed nothing); commented `DATABASE_URL` in `.env` → embedded PGlite path healthy | Reseeded (`db:reset`), tsc/eslint/build green, 13/13 screenshots recaptured authenticated as `admin@vms-v0.local` | `public/screenshots/*.png` reflect VMS V0 branding |
| 2026-11-10 | Repo tidy + data-access batching audit (for the Rust/Axum port) | SETUP_DATABASE.md → docs/; tsbuildinfo gitignored. N+1 → batch: checkOutTools/returnTools (3N→3, 2N→2 stmts) + apiCheckout/apiCheckin same; stock-take counts loop → single multi-row upsert (excluded.*); waterfalls → Promise.all in dashboard (4), rooms (6), sensors (4), kardex (3), reports (2), valuation (2); listUsers no longer pulls every password_hash; alert ack/resolve re-select by id instead of 500-row list. clicktest dup-SKU check: invalid `.bg-destructive/10` selector killed waitForFunction → fixed + text fallback | tsc/lint/build green; clicktest 34/34 admin + 10/10 worker; verify-ledger 42/42 | Zero console errors; batching rule added to AGENTS.md |
| 2026-11-10 | 2c transfers+kits vertical slice (migration 014) | product_stock projection trigger; IN-TRANSIT system bin; transfer docs draft→dispatch→receive/cancel with paired signed legs (Σ=0, transit queryable); kits/BOM atomic consume+produce; bulk move-all; home-bin pointer follows stock on receive; ledger/route badges + kardex/ReconciliationDTO kit column | tsc/eslint/build green; verify-ledger 42/42 + 35 located products 0 drift; verify-transfers.ts: dispatch/receive/kit legs all project correctly | Caught+fixed: speculative-insert CHECK gotcha in ON CONFLICT upsert (UPDATE-first instead); audit_trigger_func needs NEW.id → surrogate PK on product_components; recordStockMovement now stamps home bin |
