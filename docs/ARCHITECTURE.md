# VMS Architecture

> The deeper technical companion to `docs/LOGIC_CHAIN.md` (which is the
> friendly version). Audience: engineers evaluating, deploying, or
> extending the template.

## Stack

| Layer | Choice | Notes |
|---|---|---|
| Framework | **Next.js 16** (App Router) | Server components by default; server actions + route handlers for mutations |
| UI | **React 19**, **TypeScript** (strict), **Tailwind CSS** | shadcn-style design tokens (`hsl(var(--token))`), class-based dark mode, lucide-react icons |
| Database | **Postgres 16** | `docker-compose.yml` ships a single `db` service; `supabase/migrations/*.sql` mounts into `/docker-entrypoint-initdb.d` as canonical init SQL |
| ORM / migrations | **Drizzle ORM** + drizzle-kit | Additive migrations only — never edit an applied migration |
| Auth | **Auth.js v5** | Credentials provider, **argon2id** password hashing; no hosted-IdP dependency |
| Validation | **Zod** | Every action/API boundary validates input |
| Offline / PWA | **handwritten `public/sw.js`** | Installable; static-asset caching only — offline write queue is roadmap work |
| Charts | **Recharts** | Dashboard stats, climate timelines, stock history |
| PDF reports | **Typst** (in-process compilation) | No Chromium/Gotenberg/Playwright in shipped code — templates in `lib/pdf/typst/` |
| Email / AI / storage / sensors | Env-gated adapters | Optional; unset env = graceful "not configured". See `docs/INTEGRATIONS.md` |

No telemetry, no analytics SDKs, nothing phones home.

## Directory map

```
├── app/
│   ├── page.tsx              # Landing page (marketing surface)
│   ├── layout.tsx            # Root layout — metadata + shared footer
│   ├── globals.css           # Tailwind + design tokens (light/dark vars)
│   ├── auth/                 # login, signup, forgot/reset password
│   ├── dashboard/            # Protected app — one route per feature area
│   │   ├── inventory/  stock-movements/  stock-takes/  tool-loans/
│   │   ├── transfers/          # Bin↔bin docs + kits (014: product_stock,
│   │   │                       #   IN-TRANSIT bin, paired ledger legs)
│   │   ├── bin-locations/  zone-map/  suppliers/  reports/
│   │   ├── users/  audit-log/  settings/  impersonate/  profile/
│   │   └── layout.tsx        # Shell: Sidebar + TopBar + impersonation banner
│   ├── scan/                 # Scan-first entry point (camera/wedge/RFID)
│   └── api/                  # REST surface (products, stock-movements,
│                             #   stock-takes, tool-loans, …, v1, mcp)
├── components/
│   ├── marketing/            # Landing only — nav, footer, feature grid,
│   │                         #   logic-chain SVG, comparison table,
│   │                         #   screenshot frames, ThemeScope
│   ├── dashboard/            # Sidebar, TopBar, UserMenu
│   ├── auth/                 # Form components
│   └── providers/            # AuthProvider (session/role/impersonation)
├── lib/
│   ├── db/                   # Driver select (Postgres vs embedded PGlite),
│   │                         #   socket ownership, request-context GUCs
│   ├── actions/              # Server actions — the write surface
│   ├── api/                  # REST v1 handlers, OpenAPI spec, MCP glue
│   ├── auth/                 # Roles, permission matrix, session helpers
│   ├── scan/  mcp/  storerooms/  pdf/  hooks/  utils/
│   ├── persona.ts            # ROUTE_ACCESS — the one persona gate map
│   ├── navigation-config.ts  # Role-scoped sidebar items
├── proxy.ts             # Edge gate: session + route rules
├── drizzle/                  # Drizzle schema + generated migrations
├── supabase/migrations/      # Canonical init SQL (001→00N, ordered)
├── supabase/seed.sql         # Seed users + sample dataset (public creds)
├── docs/                     # This file, LOGIC_CHAIN, INTEGRATIONS,
│                             #   PLAYTEST, research/
└── docker-compose.yml        # postgres:16-alpine, single service
```

## Data model overview

The model follows the universal pattern found across mature inventory
systems (see `docs/MASTER_EXECUTION_PROMPT.md` §1a): **types vs instances,
ledger vs balance, documents vs lines**.

| Table | Role |
|---|---|
| `profiles` | App user: role, name. `profiles.id = auth.users.id` convention |
| `products` | Catalog item (SKU, type `consumable/fluid/tool/tire`, stocking vs issuing unit) |
| `unit_conversions` | e.g. drum → litre, `DECIMAL(15,4)` precision |
| `suppliers` | Vendor records |
| `bin_locations` | Zone/bin model with weight capacity; feeds the zone map |
| `stock_movements` | **The ledger.** `inbound/outbound/adjustment/scrap/tool_checkout/receiving` — append-only |
| `receiving_documents` + `receiving_items` | Goods-receipt docs (header/lines) |
| `stock_takes` + `stock_take_items` | Blind counts (`open/completed`), variance posting |
| `tool_loans` | Custody chain: checkout, return, condition, due dates |
| `activity_logs` | Field-level audit: actor, action, before/after, impersonation context |
| `impersonation_sessions` | Super-admin "view as" — mandatory reason, time-boxed |
| `user_alert_preferences` | Per-user notification toggles |
| `system_settings` | Org-level config |

**Ledger rule:** on-hand quantity is a *projection* over
`stock_movements`, never a column you update. Corrections are new rows.

Planned/porting additions (see master prompt §2b–2i): `stock_items`
(physical instances: serial/batch/expiry), `storerooms` + type presets,
`sensor_readings`, `scan_events`, `permissions`/`role_permissions`,
`api_keys`, `product_barcodes`, `custom_fields` JSONB, purchase orders
and transfer/issue documents.

## Auth & authorization model

Three layers, defense in depth — see `docs/LOGIC_CHAIN.md` for the
narrative version:

1. **Proxy** (`proxy.ts`) — route-level gate: public routes,
   session redirect, first-pass role gating for admin areas.
2. **App-layer permission matrix** — `role × action × scope` evaluated
   server-side on every handler/action. The primary enforcement layer;
   client-side checks only shape UX.
3. **Postgres RLS** — optional defense-in-depth where enabled; never the
   only check (and absent entirely on hosts where it isn't configured).

Auth.js v5 credentials + argon2id. Sessions are JWT/DB-token based;
seed users come from `supabase/seed.sql` (documented public credentials —
seed/dev use only). Roles: `super_admin`, `admin`, `manager`,
`fleet_dispatch`, `staff`.

## Deployment topologies

**A. Local dev (target: <5 min)**

```
docker compose up -d        # Postgres 16, schema auto-init from
                            #   supabase/migrations via initdb.d
cp .env.example .env        # DATABASE_URL + AUTH_SECRET
npm install && npm run dev  # http://localhost:3000
```

**B. Self-hosted site server** (the design center)

- Entry-level server (~i5/8 GB) runs Postgres + the Next.js app
  (`npm run build && npm start`, or a Node process manager / container).
- Client devices — old PCs, budget Android — only need a browser; the
  PWA installs from it. Performance budgets apply client-side.
- Reverse proxy (Caddy/nginx) for TLS; LAN or tailnet only if you like —
  no cloud dependency exists anywhere in the stack.

**C. Hosted (Vercel + managed Postgres)**

- Deploy to Vercel; point `DATABASE_URL` at a hosted Postgres
  (Supabase, Neon, RDS — use the pooler URL on serverless).
- Auth stays Auth.js — Supabase Auth/Storage/Realtime are not used even
  when Supabase hosts the database. See `docs/INTEGRATIONS.md` §Supabase.

## Cross-cutting rules (contributors, read this)

- **Additive migrations only.** Never edit or delete an applied
  migration — new changes are new files.
- **The ledger is the only write path** for quantities.
- **Server-side authorization on every action.** Client role checks are
  UX hints, nothing more.
- **Zod at every boundary.**
- **Env-gated integrations degrade gracefully** — unset never crashes.
- **No external images/fonts/telemetry** in shipped code.
- `npm run type-check` + `npm run lint` must stay green.
