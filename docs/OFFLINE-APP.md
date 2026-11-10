# OFFLINE-APP.md — VMS offline artifact (Rust)

The second artifact from one codebase (spec items 255b, 300–313): a
single-PC, **air-gapped** build for factory floors and remote sites with no
usable server or network. Same Next.js frontend in a Tauri v2 shell, same
`/api/v1` REST contract served by a Rust backend over SQLite.

> **Status: SCAFFOLD — foundation, not parity.** The workspace compiles,
> `cargo check` / `cargo test` / `cargo clippy -- -D warnings` are clean, the
> Tier-1 core routes below work end-to-end against the real contract shapes,
> and the Tauri crate type-checks with a placeholder `frontendDist`. The
> parity matrix below is honest about what is stubbed.

---

## Workspace layout (`offline/`)

```
offline/
  Cargo.toml                        workspace (default-members: server only)
  Cargo.lock                        committed — this is an app, not a library
  .gitignore                        target/, *.db runtime state
  crates/
    vms-offline-server/             Axum + SQLite backend (lib + thin bin)
      src/
        main.rs                     CLI: --db --bind --seed --verify-ledger
        lib.rs                      build_router + module exports
        routes.rs                   Router assembly + 501 catch-all
        handlers.rs                 extractors + per-route handlers
        auth.rs                     5 roles, permission + movement matrices,
                                    argon2id, bearer sessions
        ops.rs                      data ops — the lib/api/data.ts port
        db.rs                       Mutex<Connection>, spawn_blocking, migrator
        dto.rs                      wire shapes mirroring lib/types.ts
        validate.rs                 Zod-equivalent input validation
        error.rs                    {error:{code,message}} envelope
        seed.rs                     demo dataset (supabase/seed.sql port)
        migrations/0001_initial.sql SQLite mirror of core tables
      tests/api.rs                  HTTP-level contract tests (tower oneshot)
      tests/ledger.rs               ledger invariant + role-matrix tests
    crates/vms-offline-tauri/       Tauri v2 shell (minimal src-tauri layout)
      src/main.rs                   spawns the API in-process on 127.0.0.1:3300
      tauri.conf.json               devUrl→localhost:3000, frontendDist→./dist
      dist/index.html               PLACEHOLDER (real bundle is future work)
      icons/icon.ico                scaffold placeholder (tauri-winres test icon)
```

`default-members = ["crates/vms-offline-server"]` keeps `cargo check` /
`cargo test` fast — the Tauri crate pulls wry/tao/WebView2 (~450 crates) and
is checked explicitly with `cargo check -p vms-offline-tauri`.

## Crate choices

| Crate | Version | Why |
|---|---|---|
| axum | 0.8 | HTTP layer — the spec's stated pick; matches the contract framing |
| tokio | 1 | runtime (`full` on server, `rt-multi-thread`+`net` in the shell) |
| serde / serde_json | 1 | contract types; serde replaces Zod at the boundary |
| serde_urlencoded | 0.7 | typed query params with envelope-preserving errors |
| **rusqlite** | 0.41 (`bundled`) | **chosen over sqlx** — see below |
| argon2 | 0.6 | argon2id PHC verify — same format as the web's `argon2` npm pkg |
| uuid | =1.28.0 | id generation (pinned: 1.29.2 was < 7 days old at scaffold time) |
| chrono | 0.4 | ISO-8601 timestamps matching `Date::toISOString()` shape |
| tower-http | 0.7 (`cors`) | webview→loopback CORS (permissive; tighten on fixed origin) |
| tauri / tauri-build | 2 | desktop shell (spec item 300) |

**rusqlite over sqlx.** SQLite is single-writer (WAL helps readers, not
writers) so a `Mutex<Connection>` is the honest concurrency model; sqlx's
async pool buys nothing but compile weight. `bundled` compiles SQLite from
source — zero system dependencies, key for air-gapped installs. And
`Connection::transaction()` makes the ledger invariant ("movement INSERT +
stock UPDATE in ONE tx") trivially expressible and testable. All calls are
marshalled through `tokio::task::spawn_blocking` (`Db::run`) so the executor
is never blocked.

## How to run

```bash
cd offline

# First run — creates ./vms-offline.db, applies migrations, seeds demo data
cargo run -p vms-offline-server -- --seed

# Subsequent runs (migrations are versioned + idempotent)
cargo run -p vms-offline-server
#   → listening on http://127.0.0.1:3300

# Options: --db PATH (or $VMS_DB_PATH), --bind ADDR (or $VMS_BIND),
#          --verify-ledger  (check stock = Σ movements, exit non-zero on drift)

# Quality gates
cargo check            # default member (server)
cargo check -p vms-offline-tauri   # the shell — verified clean
cargo test             # 16 tests: envelope, auth, signing, ledger, 501s
cargo clippy --all-targets -- -D warnings
```

Demo credentials (same as `scripts/seed.ts`, same security caveat —
local/demo only):

| Email | Password | Role |
|---|---|---|
| admin@vms-v0.local | VmsAdmin123! | super_admin |
| manager@vms-v0.local | VmsManager123! | manager |
| fleet@vms-v0.local | VmsFleet123! | fleet_dispatch |
| worker@vms-v0.local | VmsWorker123! | staff |

```bash
curl http://127.0.0.1:3300/api/v1/health
TOKEN=$(curl -s -X POST http://127.0.0.1:3300/api/v1/auth/login \
  -H 'content-type: application/json' \
  -d '{"email":"admin@vms-v0.local","password":"VmsAdmin123!"}' \
  | python -c 'import json,sys;print(json.load(sys.stdin)["data"]["token"])')
curl -H "Authorization: Bearer $TOKEN" http://127.0.0.1:3300/api/v1/products
```

## Route-parity matrix

Legend: ✅ implemented · 🚧 explicit 501 stub (envelope `not_implemented`,
deliberately NOT a 404) · ❌ excluded offline (item 307) · ➕ offline
extension (not a web REST route — documented divergence)

| Route | Web surface | Offline status |
|---|---|---|
| GET /api/v1/health | ✅ route.ts | ✅ identical `{status,service,version,db,time}` |
| POST /api/v1/auth/login | n/a (Auth.js form flow) | ➕ argon2id verify → `{data:{token,profile}}` |
| GET /api/v1/products | ✅ | ✅ `q`, `item_type`, `limit`, `offset`; bin join for zone/bin_location |
| POST /api/v1/products | ✅ | ✅ `products:write` gate; duplicate SKU → 409; opening `current_stock` recorded as a `receiving` movement (see divergence note) |
| GET /api/v1/products/{id} | ✅ | ✅ id-or-sku resolution, same as apiGetProduct |
| PATCH /api/v1/products/{id} | ✅ | 🚧 falls through to 501 (Tier-1 CRUD pass) |
| GET /api/v1/movements | ✅ | ✅ `product_id`,`days`,`limit`; own-rows scoping for non-`read:all` roles |
| POST /api/v1/movements | ✅ | ✅ signing rules + role matrix + one-tx ledger write + 409 insufficient |
| GET /api/v1/bin-locations | MCP tool only | ➕ REST extension for Tier-1 bin views |
| GET /api/v1/storerooms | MCP tool only | ➕ REST extension; always `implemented:true` (table shipped) |
| GET /api/v1/stock | ✅ | 🚧 stub — trivial join-free read, next pass |
| GET /api/v1/low-stock | ✅ | 🚧 stub — same data op family as /stock |
| GET/POST /api/v1/loans | ✅ | 🚧 stub — tool custody, Tier-1 target |
| GET/POST /api/v1/takes | ✅ | 🚧 stub — blind counts, Tier-1 target |
| GET /api/v1/audit | ✅ | 🚧 stub — activity_logs table already mirrored |
| GET /api/v1/reconciliation | ✅ | 🚧 stub — `ops::verify_ledger` already exists, needs the route |
| GET /api/v1/openapi.json | ✅ | 🚧 stub — spec doc can be embedded verbatim later |
| MCP endpoint | /api/mcp | ❌ MCP-over-network excluded (item 307); local MCP is a Phase-2 item |
| Supabase Auth / MFA / web push / AI / cloud sync | various | ❌ excluded offline (item 307) |
| Web API keys (`vms_…`) | lib/api/keys.ts | ❌ offline uses session tokens only (`vms_off_…`) |

The 501 catch-all (`{*rest}` under `/api/v1`) returns
`{error:{code:"not_implemented",message:…}}` with HTTP 501 — `not_implemented`
is an **offline-only extra code** beyond the web enum, chosen so "not yet
ported" never looks like "doesn't exist".

## Contract semantics ported

- **Envelope** — `{data: …}` success, `{error:{code,message}}` failure, same
  code→status map as `lib/api/http.ts` (401/403/400/404/409/429/500).
- **Movement signing** (`apiCreateMovement`): `inbound`/`receiving`/
  `adjustment` → `+|q|`; `outbound`/`scrap`/`tool_checkout` → `−|q|`;
  absolute value applied so even negative input can't flip the sign.
- **Role matrix** — `MOVEMENT_TYPE_MATRIX`: super_admin/admin/manager all
  six; fleet_dispatch `outbound`+`tool_checkout`; staff
  `inbound`+`adjustment`+`receiving`. `PERMISSION_MATRIX` ported in full
  (all 39 permissions) so later routes just call `principal.require(...)`.
- **Read scoping** — roles without `stock_movements:read:all` see only
  `stock_movements.user_id = self` (staff/fleet verified in tests).
- **Ledger invariant** — `products.current_stock` is written ONLY inside
  transaction scopes that also write a `stock_movements` row
  (`create_movement`, and `create_product`'s opening-balance row).
  Negative stock → `conflict` (409). `ops::verify_ledger` mirrors
  `scripts/verify-ledger.ts`; `--verify-ledger` runs it standalone and the
  binary runs it on every startup (hard-fails on drift — the invariant is
  load-bearing). Proven by `tests/ledger.rs` +
  `seeded_demo_db_reconciles`.
  - **Deliberate divergence from the web artifact:** web's
    `apiUpsertProduct` writes an opening `current_stock` as a bare column
    value (which can drift the ledger); here a non-zero opening is an
    'receiving' movement in the same tx — the AGENTS.md "opening position
    is a backdated receiving row" convention — so the offline ledger
    always reconciles. Response shape is unchanged.
- **Validation** — Zod rules re-expressed in `validate.rs`: same length
  caps, enums, `Provide product_id or sku` refine, `Quantity must be
  positive`; messages keep the `Invalid request body: field: problem`
  shape; non-JSON bodies get the web's exact "Request body is not valid
  JSON".

## Auth model (spec item 303)

- `profiles` mirror + `email` + `password_hash` (argon2id PHC — hashes from
  `scripts/seed.ts` verify identically; the Rust `argon2` and npm `argon2`
  packages share the `$argon2id$v=19$` PHC format).
- `sessions` table: opaque `vms_off_<uuid>` bearer token → profile.
  Deliberately simple: no expiry/rotation/rate-limit yet — documented gap.
- Every authenticated handler resolves a `Principal` via the bearer token,
  then data ops re-check `can()`/`can_create_movement()` — authorization in
  the handler layer, exactly like the web (there is no RLS to fall back on).

## SQLite schema deltas vs Postgres (migration 0001)

Mirrored: profiles, sessions*, suppliers, storerooms, bin_locations
(+room_id), unit_conversions, products, tool_loans, stock_movements,
stock_takes, stock_take_items, activity_logs. Column names are identical
where the table is ported.

* `sessions` is offline-only (token store).

Honest deltas:

- UUID/timestamptz/jsonb/numeric → TEXT/TEXT/TEXT/REAL. Numeric columns are
  `REAL` (f64) — DECIMAL(15,4) precision is NOT preserved at extremes; fine
  for inventory quantities, revisit for currency-heavy flows.
- `profiles.email` added (web keeps email on `auth.users`, a Supabase-Auth
  table that cannot exist offline). `user_id` kept for shape parity.
- `stock_movements.receiving_item_id` / `.transfer_item_id` kept as columns
  WITHOUT FK clauses — `receiving_items`/`transfer_items` aren't in the
  Tier-1 mirror. Same for `product_stock`/`product_components`/`transfers` —
  the tables exist on the web but aren't mirrored yet.
- `storerooms.allowed_roles`/`item_allowlist`/`feature_toggles` are JSON
  text (PG `TEXT[]`/`JSONB`).
- Audit triggers → the `activity_logs` table exists but nothing writes to it
  yet (no DB-level audit until a later migration; handler-layer logging is
  the planned path).
- No `auth.users` stub — profiles carry identity end-to-end offline.

## Frontend bundling paths (spec item 300 — decision pending)

The UI is never forked. Two viable prod paths:

1. **Static export** — Next.js `output: 'export'` into `frontendDist`.
   Requires the dashboard to run fully client-side against `/api/v1` (server
   actions → REST). Largest refactor, smallest runtime footprint.
2. **Next standalone sidecar** — Tauri sidecar runs `node server.js`
   (output:'standalone'), webview points at it. Zero UI refactor; bundles a
   Node runtime (~40MB budget pressure, item 310).

For this scaffold: `devUrl` = `http://localhost:3000` (dev path works
today), `frontendDist` = a placeholder page so the crate compiles.

## Tier status

- **Tier-1 (item 305):** login/roles ✅ (REST-level); product browse/search
  ✅; product create ✅; scan receive/issue/adjust ✅ as movements;
  bin/storeroom views ✅. Still stubbed inside Tier-1: stock takes, tool
  loans, activity log, dashboard aggregates, low-stock, reports, labels,
  CSV, settings.
- **Tier-2 (item 306):** multi-user sessions exist (token per login) but
  single-writer SQLite is the honest ceiling; backup = copy `vms-offline.db`
  (WAL: copy via `.backup` or stop-then-copy); installer updates pending
  bundler work.
- **Sync engine (item 308):** not started — the append-only movement ledger
  is designed to merge cleanly when it lands.

## Distribution & quality (items 309–313 — future)

- `vms-setup.exe` via Tauri NSIS bundler — not attempted yet; `cargo tauri`
  CLI invocation is the next step once the frontend bundling path is chosen.
- Footprint budget (<80MB installer, <300MB RAM, <3s cold start): unmeasured
  — release profile already has lto/strip/codegen-units=1.
- Rust quality gates: `cargo clippy -- -D warnings` clean today; `cargo
  audit`/`cargo deny` + smoke-suite extension pending CI wiring.
- License: same CC BY-NC-SA as the repo; workspace lives at `offline/` per
  item 313 (ADR addendum still owed).

## Air-gap property

The artifact makes **zero outbound network calls at runtime**: no telemetry
crates, no update check, no cloud SDKs. The only socket is the loopback
listener (default `127.0.0.1:3300`) serving the shell/dev UI. Build-time
fetches (crates.io, Tauri's WebView2 bootstrapper at *bundle* time) are not
runtime behavior.
