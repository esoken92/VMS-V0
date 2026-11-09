# VMS-Demo-V0 — Master Execution Prompt

> Single source of truth for taking this repo from "secure consolidated foundation"
> to "public, marketable template". Combines competitive research (8 systems,
> 1,000+★ each), a ~100-item gap analysis, and go-live requirements.
> License: **CC BY-NC-SA 4.0** — all derivatives/embeds must keep the same license.

---

## ROLE & OBJECTIVE

You are an elite Lead Implementation AI and System Architect. Finalize the VMS
(Warehouse/Vehicle-parts inventory management) demo repository: transform it from
a secure, consolidated foundation into a production-ready, highly marketable
template. End state: `gh repo edit esoken92/VMS-Demo-V0 --visibility public --template`
can run immediately with a world-class public presentation.

---

## 🛑 HARD CONSTRAINTS

- **Concurrency:** max 3 subagents at any time.
- **Write access:** ONLY this repository (`Documents/VMS-Demo-V0`). Read access to
  any repo/web source for research.
- **Production safety:** NEVER deploy to production, flip env keys live, or change
  repo visibility/template status — the owner flips those manually after review.
- **License:** CC BY-NC-SA 4.0. No copyleft-incompatible code copied from AGPL
  projects (Part-DB, Homebox, Snipe-IT, Carbon) — patterns only, never code.
- **Secrets:** never commit credentials. `seed.sql` demo passwords are intentional
  and documented — do not "fix" them, but never reuse them elsewhere.
- **Stack:** Next.js 14 App Router + TypeScript + Tailwind + Supabase
  (Auth/Postgres/RLS/Storage) + `next-pwa` + Recharts + Zod (installed, underused).
- **Definition of done per phase:** `npx tsc --noEmit`, `npx eslint . --max-warnings=0`,
  `npm run build` all green. CI green before any push. Verify `git remote -v` +
  `git fetch` before committing.

---

## ✅ FOUNDATION ALREADY COMPLETE (DO NOT REVERT)

- 4,145 dead files removed; root TS app is canonical (tyre-flow-demo* deleted).
- All `SECURITY DEFINER` RPCs hardened: role checks, `auth.uid()` actors,
  pinned `search_path`, `SECURITY INVOKER` read helpers.
- Middleware auth gating re-enabled (was pass-through); no hardcoded project refs.
- `profiles.id = auth.users.id` convention fixed in `seed.sql` + `create_user_with_profile`.
- Migrations sequential 001–011; demo users/sample data moved to `supabase/seed.sql`.
- `.eslintrc.json` added; lint errors fixed; `npm run build` green env-free
  (placeholder Supabase fallback in `lib/supabase/client.ts`).
- Users page aligned to middleware gating; `manager` role option added.
- Repo verified secret-clean (tree + full history).

---

## PHASE 1 — BENCHMARKING & SYSTEM DESIGN (logic-chain demo)

### 1a. Market research — DONE, use these findings

8 systems analyzed (1,000+★). **Universal patterns to match:**

1. Type→instance split (catalog `Product` vs physical `StockItem`)
2. Append-only movement ledger + fast balance projection (never UPDATE qty)
3. Hierarchical locations/categories (trees, not flat lists)
4. Document-typed transactions (receive/issue/transfer/adjust/count/scrap)
5. Thresholds as first-class flags driving alerts everywhere
6. Scan-first UX + printable QR/barcode labels (table stakes)
7. Custom fields without migrations (JSONB + field defs)
8. CSV import/export + template-driven PDF reports
9. Lifecycle timestamps (expiry, warranty, audit-due, expected-return)
10. Dashboard = stat cards + activity feed + alerts + click-through charts
11. REST API + scoped tokens; new wave adds **MCP servers** (Part-DB, Carbon ship one)

**Best-of per system (steal the pattern, never the code):**

| System | Steal |
|---|---|
| Part-DB 1.8k★ | MCP server w/ read/edit scopes; label profiles `[[PLACEHOLDER]]`; auto-create-on-scan; field-level event log |
| InvenTree 7.8k★ | Physical stock instances (serial/batch/expiry); allocation ≠ on-hand; PO/SO FSMs; template reports w/ live preview |
| Grocy 9.6k★ | Dated stock batches/FEFO; scan-mode fast paths; stock journal; product picker on unknown input |
| Homebox 7.8k★ | `import_ref` idempotent CSV upserts; entity templates; async export; maintenance tracking |
| OpenBoxes 0.9k★ | bin×product×lot×expiry key; pick/pack/ship FSM; Excel round-trip counts; location-scoped dashboards |
| Snipe-IT 15k★ | Polymorphic assigned_to; expected-return + audit cadence; semantic status buckets; signature-on-checkout |
| NetBox 21.7k★ | Object identity + feature mixins; custom fields; webhooks via event rules; Jinja export templates |
| ERPNext 41k★ | Immutable SLE ledger; Bin projection (actual/reserved/ordered/projected); valuation; doc chains; reorder automation |
| Carbon ~3.5k★ | MCP server; lot/serial genealogy; TS + Supabase-flavored Postgres — closest stack match |
| Spoolman 3k★ | Live telemetry decrementing stock; label designer |

### 1b. Deliverables

- **`docs/LOGIC_CHAIN.md`** — visible architecture + UX-flow document:
  request → middleware → Supabase RLS → SECURITY DEFINER RPC → movement ledger →
  UI update; plus the "one scan → one action" UX chain and the MCP query chain.
  This is a demo artifact — write it for a smart non-engineer.
- **`docs/ARCHITECTURE.md`** — deeper: schema map, RLS model, RPC inventory,
  API/MCP surface, PDF pipeline.
- **Marketing mockups/screenshots** — produce screenshot-ready pages (see Phase 3
  landing page) AND capture real screenshots via Playwright once Phase 2 core
  screens exist: front page, dashboard, MCP setup/config, API docs, PDF report.
  Store under `docs/screenshots/` (git-ignored if large; README links them).

---

## PHASE 2 — CORE DEVELOPMENT

### 2a. Technical debt (do FIRST — cheap, de-risks everything)

1. Migrate auth from deprecated `@supabase/auth-helpers-nextjs` → `@supabase/ssr`
   (middleware + server/client helpers + AuthProvider).
2. Run `npm run supabase:generate-types` against the real project (or a local
   `supabase start` stack) to replace hand-written `lib/supabase/types.ts`.
3. Wrap RLS `auth.uid()` calls as `(select auth.uid())` in a NEW migration —
   do NOT edit applied migrations (additive-only rule).
4. Add missing `stock_movements` read policy for `manager` role (new migration).
5. Audit all remaining `select('*')` in app code → explicit columns.

### 2b. Data model & stock engine

6. `stock_items` table — physical instances: product_id, bin_location_id, qty,
   serial_number, batch_code, expiry_date, status, unit_cost (Part→StockItem split)
7. Serial number tracking (per-unit for tools/tyres)
8. Batch/lot + expiry (fluids are perishable — first-class)
9. Allocation columns/view: on_hand / allocated / available / on_order
10. `stock_movements` becomes the ONLY write path — every qty mutation posts a
    ledger row (actor, reason_code, source_type, source_id, delta)
11. Per-product AND per-bin min/max/reorder thresholds
12. Semantic stock statuses: OK / Low / Reorder / Damaged / Expired /
    Quarantined / Hold-bin
13. Product photos + attachments via existing Supabase Storage bucket
14. `custom_fields` JSONB on products + field-definitions table
15. Supplier part numbers (MPN/SKU ↔ product mapping)
16. Multiple barcodes per product (`product_barcodes` alias table)
17. Nested category tree alongside `item_type` + free-form tags
18. Price history per supplier + weighted-average cost on receipt

### 2c. Warehouse workflows

19. Purchase orders: header + lines, partial receipts, backorders
20. Goods-receipt docs linked to POs (extend `receiving_documents`)
21. Stock transfer documents (bin→bin, zone→zone)
22. Issue slips / goods-issue docs w/ approver sign-off
23. Cycle counting: suggest by last-counted date + value-at-risk;
    CSV round-trip (download sheet → count → upload)
24. Putaway suggestion on receipt (zone rules)
25. Pick lists: multi-line ticket, FEFO-sorted, printable, sort-by-bin variant
26. Stock request workflow: requestor → approver → issue
27. Returns: to-supplier + customer-return flows w/ reason codes
28. Scrap/write-off doc w/ mandatory reason + photo evidence
29. Lot quarantine/recall: freeze batch, trace destinations (genealogy-lite)
30. Bulk CSV import wizard: auto column-match, field mapping,
    `import_ref` idempotent upserts (Homebox pattern)

### 2d. Frontend & UX

31. Dashboard indicator framework — widget picker, click-through-to-report
32. Stat cards: SKUs, units on hand, low-stock, open loans, pending takes,
    expiring stock
33. Recent-activity feed + alerts panel
34. Per-product stock history chart (time series from ledger)
35. Stock aging report (expiry buckets 30/60/90d)
36. Row-click preview drawer (quick-look w/o navigation)
37. Mobile-first scan views (camera ZXing + keyboard-wedge scanner)
38. Dark mode
39. Keyboard shortcuts for power users
40. In-app notification center (low stock, overdue loans, expiring batches,
    take variances)
41. Per-user notification preferences (email toggles)
42. Printable views: bin labels, pick tickets, stock-take sheets,
    cycle-count sheets (print CSS)
43. Saved table filters/views per user
44. Port dashboard strides from tyresync-parity: `feature-gate.tsx` pattern,
    `[slug]` dynamic report pages, typed event stream → activity feed,
    location-context dashboard ("current bin/zone" scoping), expanded Recharts
    (area + stacked charts), shared design tokens/component primitives

### 2e. Labels, scanning, hardware

45. Label profile system — saved templates: size, symbology
    (QR/Code128/DataMatrix), body template w/ `[[PRODUCT_NAME]]` placeholders
46. QR/barcode generation per product, bin, stock-take session
47. Camera barcode/QR scanning → product lookup (wire the deleted hook properly)
48. Scan modes: receive / issue / count / loan-checkout — one scan = one action
49. "Info mode": scan → product card overlay, no navigation
50. Avery/thermal label presets
51. Auto-create-product-on-unknown-barcode flow
52. Offline scan queue → sync on reconnect (restore minimal Dexie version)

### 2f. Documents, reports & PDFs

53. **PDF pipeline — Typst, in-process (PRIMARY).** Port
    `tyresync-parity/src/lib/pdf-typst/` (~1,400 lines: compiler, doc builder,
    templates, asset fetch w/ magic-byte sniffing, fonts). In-process = no
    Chromium, lightweight Vercel functions, proven in production. HARD RULE:
    Typst ONLY — never Gotenberg (it is headless Chromium), never playwright/
    chromium in shipped routes.
54. Typst report templates + live preview against real data
55. Built-in PDFs: stock-take variance, movement ledger, tool-loan register,
    valuation report, label sheets, pick tickets
56. CSV + XLSX export respecting active filters, everywhere
57. CSV import wizard (auto column-match + mapping + defaults/overrides)
58. Stock valuation report (moving-average; FIFO as stretch)
59. Dead-stock / slow-mover report
60. Supplier spend + price-variance report
61. Audit-log export → PDF/CSV
62. Daily low-stock + expiry digest email (cron + Resend or SMTP)

### 2g. API, MCP & AI (the differentiator)

63. **REST API v1** — real routes: `/api/v1/products`, `/stock`, `/movements`,
    `/loans`, `/takes` w/ consistent schema, Zod-validated bodies
64. API keys table + management UI (create/revoke, **read-only vs edit scopes**)
65. OpenAPI spec + `/docs` page (Scalar or Swagger UI)
66. Rate limiting on API routes
67. **MCP server endpoint** — tools: `search_products`, `get_stock_level`,
    `post_stock_movement`, `list_low_stock`, `checkout_tool`, `checkin_tool`,
    `start_stock_take`, `get_product_by_barcode`, `run_report`.
    MCP auth via scoped API keys (read-only token → read-only tools).
    Reference impls: Part-DB, Carbon. This is the headline feature.
68. AI natural-language query: "how many brake pads left?" → grounded answer
    (Vercel AI SDK or direct provider; env-keyed, graceful when unset)
69. Upload datasheet/manual PDF → auto-create product draft (Part-DB pattern)
70. AI-assisted CSV column mapping during import
71. Demand forecast lite: moving-average usage → reorder suggestions on dashboard
72. Anomaly flags: negative stock, movement spikes, take variances > threshold
73. Webhooks on domain events: `stock.movement.created`, `stock.low`,
    `loan.overdue`, `take.completed` — outbound POST w/ HMAC signature
74. API versioning + changelog page
75. `/api/llms.txt` + `llms.txt` — let agents discover API/MCP surface

### 2h. Auth, security & platform

76. TOTP 2FA for admin/manager roles (Supabase MFA)
77. Active-sessions page — view/revoke own sessions
78. Audit log: field-level diff display + export
79. Impersonation: visible banner + auto-expiry polish
80. Full-dataset export (JSON/ZIP backup)
81. Org settings: company name, logo, currency, timezone
82. Data-retention + audit-log archiving settings
83. SSO/OIDC documented as roadmap (hook points only, don't build)

---

## PHASE 3 — BRANDING & GO-LIVE PREP

84. **Public landing page** (`app/page.tsx` rewrite): hero, screenshot tour,
    feature grid, "how it works" logic-chain diagram, comparison table vs
    spreadsheets/paper, footer.
85. Footer footnotes: "Part of the ESO Industries ecosystem" →
    https://esoind.co.za + https://tyresync.co.za links;
    `mailto:esoken92@gmail.com` as primary contact/support.
86. MCP setup page — copy-paste config snippet
    (`claude_desktop_config` / Cursor `mcpServers` entry) so visitors connect live.
87. API playground page — try-it UI against REST API.
88. **Demo-mode reset button** — one click reseeds demo data (critical for
    live demos/screenshots; admin-only, confirm-gated).
89. `DEMO.md` presenter script — 5-minute flow: login → scan → stock take →
    MCP query → PDF report.
90. Typst-generated architecture/system PDF (same pipeline) for "how it's built".
91. Realistic seed story: tyre-shop inventory (tyres by size, fluids, tools,
    consumables, vehicles-as-assets) so screenshots look alive.
92. Roadmap page — public, signals active project.
93. README final pass: screenshots embedded, badges, quickstart <5min,
    MCP/API highlights front-and-center, license block.
94. `SETUP_DATABASE.md` + `.env.example` final consistency check.
95. Final security re-review: secrets scan, RLS coverage, API auth on every
    route, Zod at every boundary, service-role server-only.
96. Final verification: `npm ci` clean, tsc/lint/build green, `npm run dev`
    smoke test of every route.
97. Produce go-live checklist + hand back to owner for the visibility flip.

---

## SUBAGENT ALLOCATION PLAN

Research agents are DONE (reports merged above). Suggested build-time split
(max 3 concurrent, disjoint write scopes):

- **Agent A — Data/API layer:** items 6–30, 63–66, 73 (migrations + API routes)
- **Agent B — UI/UX:** items 31–44, 45–52, 84–87 (pages, components, landing)
- **Agent C — Integrations/reports:** items 53–62, 67–72, 75, 90 (PDF, MCP,
  AI, webhooks, email)

Phase 2a (tech debt) runs FIRST solo — it touches files everyone else uses.

## ACCEPTANCE CRITERIA

- [ ] `npx tsc --noEmit` clean
- [ ] `npx eslint . --max-warnings=0` clean
- [ ] `npm run build` green env-free
- [ ] Every `app/api/**` route: auth + Zod + role check
- [ ] RLS: every table has policies; `manager` gap closed; `(select auth.uid())`
- [ ] MCP endpoint live w/ scoped keys; smoke-tested tools
- [ ] Typst PDF renders a real report w/o Chromium
- [ ] Landing page + dashboard screenshots captured
- [ ] No secrets; AGPL code never copied; license intact
- [ ] README accurate; demo creds documented as demo-only
- [ ] Owner flips repo public + template manually
