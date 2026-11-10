# The VMS Logic Chain — one path from click to record

> Written for a smart non-engineer. If you can follow a parcel through a
> depot, you can follow a request through VMS.

Every action in VMS — a page load, a barcode scan, a button click, an API
call, an MCP tool invocation — travels **exactly one path** before it is
allowed to change anything:

```
┌───────────┐   ┌────────────┐   ┌───────────┐   ┌────────────────┐
│  Request  │──▶│ Middleware │──▶│ Auth gate │──▶│ Permission     │
│ (browser, │   │ (edge)     │   │ (Auth.js) │   │ check          │
│  scanner, │   │            │   │           │   │ (role×action×  │
│  API)     │   │            │   │           │   │  scope)        │
└───────────┘   └────────────┘   └───────────┘   └────────────────┘
                      │                │                │
                      ▼                ▼                ▼
                 ┌─────────────────────────────────────────┐
                 │  Denied requests are logged too (4xx)    │
                 └─────────────────────────────────────────┘
                                       │ allowed
                                       ▼
┌───────────┐   ┌────────────┐   ┌────────────────┐
│    UI     │◀─│ Audit log  │◀─│ Transaction    │
│ (fresh    │   │ (append-   │   │ (Postgres TX — │
│  render)  │   │  only)     │   │  all or nothing│
└───────────┘   └────────────┘   └────────────────┘
```

The same diagram ships on the landing page as an inline SVG
(`components/marketing/logic-chain-diagram.tsx`).

## Hop by hop

### 1. Request

Everything starts as an HTTP request. A manager opening the dashboard, a
floor worker scanning a QR label with a phone camera, an integration
calling `POST /api/v1/stock-movements`, an AI assistant calling an MCP
tool — same door, same rules.

### 2. Middleware

Next.js middleware is the front desk. It runs at the edge before any page
or handler executes and answers one question: *is this route public?*

- Public routes (`/`, `/auth/*`, marketing/docs assets) pass through.
- Protected routes without a session redirect to `/auth/login`, carrying
  the intended destination so the user lands back where they were going.
- Role-gated routes (admin areas) get a first-pass check here — but
  middleware is a *convenience* filter, never the enforcement layer.

### 3. Auth gate — who are you?

Auth.js v5 verifies the session token. VMS uses **credentials auth with
argon2id hashing** — no dependency on a hosted identity provider, so the
whole thing works on an air-gapped site server. Without a valid session,
nothing past this point runs.

### 4. Permission check — are you allowed?

This is the real gate, and it lives **in the application layer**: a
permission matrix of `role × action × scope` evaluated server-side on
every mutation and sensitive read.

- `staff` counts; completing a stock take (and writing its variance to
  the record) needs `stock_takes:write` — a manager-or-above permission;
  `super_admin` can impersonate (with a mandatory reason, itself
  audited). A separate variance-approval step is roadmap work, not
  implemented.
- Scopes today are row-level (e.g. staff see only their own movements);
  per-room role scoping fields exist on `storerooms` but write paths do
  not enforce them yet — also roadmap work.
- Client-side role checks only hide buttons. The server re-checks every
  time — a hidden button is UX, a server check is security.

### 5. Transaction — do the work, all or nothing

Approved mutations run inside a Postgres transaction. Input is validated
(Zod at the action boundary), the write completes fully or not at all —
a half-received pallet cannot exist in VMS.

### 6. Audit log — the memory that can't be edited

Every committed change appends a row to the ledger: **who, what, when,
where, and the before/after values**. The table is append-only —
application code cannot `UPDATE` or `DELETE` history. Corrections are new
entries that reference the original, so the story is always complete.

### 7. UI — what you see is what is recorded

The interface re-renders from real state. There is no shadow quantity
held in the browser that might disagree with the database — the ledger
is the source of truth, and the UI is a view over it.

---

## The companion chains

### One scan → one action

Scanning is the primary input, not an add-on. The UX chain mirrors the
request chain:

```
scan → identify (what?) → context (where? which mode?) → action → confirm
```

Receiving, issuing, counting, and tool checkout each run in a dedicated
scan mode, so a scan always means exactly one thing — the app says what
is next; searching is the fallback, not the workflow.

### MCP / API query chain

External agents take the same gates:

```
MCP tool call → API-key auth (scoped) → permission check →
bounded read/write → audit entry → structured response
```

A read-only key can only reach read tools; a key cannot exceed the
permissions of the account that issued it.

---

## Why it is built this way — design decisions

| Decision | What it means | Why |
|---|---|---|
| **Append-only ledger** | Quantity is never updated in place; every change is a new row | A current balance can always be recomputed and defended. Spreadsheets can't tell you who changed cell B42 — the ledger always can. |
| **App-layer authorization** | Permission matrix evaluated in server code; Postgres RLS is optional defense-in-depth, never the primary check | Rules are testable TypeScript, versioned with the app, and portable to any Postgres host. |
| **Additive migrations only** | Schema changes add; they never edit or delete applied migrations | A deployed database can always roll forward. No "which version of migration 003 did you run?" archaeology. |
| **Env-gated integrations** | Resend, OpenAI-compatible AI, S3 storage, sensors — adapters wired but disabled until env vars are set | `npm install && npm run dev` works with zero accounts. Unset keys degrade gracefully ("not configured"), never crash. See `docs/INTEGRATIONS.md`. |
| **Dual artifact: web app + offline PWA** | One Next.js codebase serves the installable PWA; scans queue locally and sync honestly | Warehouses have dead zones. "Offline" is a banner and a queue — visible, never silent. |
| **No telemetry** | Nothing phones home | Self-hosted means self-hosted. Your stock levels are your business. |

## Where to look in the code

| Hop | Location |
|---|---|
| Proxy | `proxy.ts` (Next.js 16 renamed middleware) |
| Auth config | `auth.config.ts` / `lib/auth*` (Auth.js v5) |
| Permission matrix | `lib/permissions*` (server-side checks on every action) |
| Transactions | `lib/db*` / route handlers and server actions |
| Audit ledger | `activity_logs` / `stock_movements` tables (see `supabase/migrations/`) |
| UI | `app/` routes + `components/` |

> **Note:** the data layer is being ported from Supabase helpers to
> Drizzle ORM + Auth.js v5. File paths above marked `*` settle as the
> port lands; the chain itself does not change.
