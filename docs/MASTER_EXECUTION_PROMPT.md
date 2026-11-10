# VMS-V0 — Master Execution Prompt

> Single source of truth for taking this repo from "secure consolidated foundation"
> to "public, marketable template". Combines competitive research (8 systems,
> 1,000+★ each), a ~100-item gap analysis, and go-live requirements.
> License: **CC BY-NC-SA 4.0** — all derivatives/embeds must keep the same license.

---

## ROLE & OBJECTIVE

You are an elite Lead Implementation AI and System Architect. Finalize the VMS
(Warehouse/Vehicle-parts inventory management) template repository: transform it from
a secure, consolidated foundation into a production-ready, highly marketable
template. End state: `gh repo edit esoken92/VMS-V0 --visibility public --template`
can run immediately with a world-class public presentation.

---

## 🛑 HARD CONSTRAINTS

- **Concurrency:** max 3 subagents at any time.
- **Write access:** ONLY this repository (`Documents/VMS-V0`). Read access to
  any repo/web source for research.
- **Production safety:** NEVER deploy to production, flip env keys live, or change
  repo visibility/template status — the owner flips those manually after review.
- **License:** CC BY-NC-SA 4.0. No copyleft-incompatible code copied from AGPL
  projects (Part-DB, Homebox, Snipe-IT, Carbon) — patterns only, never code.
- **Secrets:** never commit credentials. `seed.sql` seed passwords are intentional
  and documented — do not "fix" them, but never reuse them elsewhere.
- **Stack:** Next.js 16 App Router + TypeScript strict + Tailwind CSS 4 +
  Postgres/PGlite (Drizzle) + Auth.js v5 + handwritten service worker +
  Recharts 3 + Zod. (Upgraded from Next.js 14 + Supabase + next-pwa.)
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
- Migrations sequential 001–011; seed users/sample data moved to `supabase/seed.sql`.
- `.eslintrc.json` added; lint errors fixed; `npm run build` green env-free
  (placeholder Supabase fallback in `lib/supabase/client.ts`).
- Users page aligned to middleware gating; `manager` role option added.
- Repo verified secret-clean (tree + full history).

---

## PHASE 1 — BENCHMARKING & SYSTEM DESIGN (logic-chain walkthrough)

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
  This is a living artifact — write it for a smart non-engineer.
- **`docs/ARCHITECTURE.md`** — deeper: schema map, RLS model, RPC inventory,
  API/MCP surface, PDF pipeline.
- **Marketing mockups/screenshots** — produce screenshot-ready pages (see Phase 3
  landing page) AND capture real screenshots via Playwright once Phase 2 core
  screens exist: front page, dashboard, MCP setup/config, API docs, PDF report.
  Store under `docs/screenshots/` (git-ignored if large; README links them).

---

## PHASE 2 — CORE DEVELOPMENT

### 0. CLEAN-SLATE REBOOT (owner directive — supersedes all Supabase/Auth.js-conflicting items below)

- **Self-hosted first, local-only.** No Vercel, no Supabase Cloud — app
  must run on the dev's PC now, later on client PCs incl. old hardware.
- **New stack:** Postgres 16 (`docker-compose.yml`, single service) +
  Auth.js v5 credentials (argon2id) + Drizzle ORM + app-layer
  authorization (permission matrix primary; Postgres RLS optional
  defense-in-depth behind it — never the primary check).
- **Topology:** DB+app server on company server (target: entry-level
  ~i5/8GB or Xeon/16GB — NOT ultra-low-end). "Old infrastructure" =
  the CLIENT device (browser/PWA on old PCs, budget Android) → front-end
  render/perf budgets apply client-side, not to the DB.
- `supabase/migrations/*.sql` = canonical init SQL mounted into the
  container via `/docker-entrypoint-initdb.d`; drizzle-kit for future
  (additive) migrations.
- **Remove:** `@supabase/*` deps, `lib/supabase/*`, supabase-js call
  sites (~20 files), `@vercel/analytics`, `@vercel/speed-insights`.
- **Integrations = framework + docs only:** Resend, OpenAI-compatible,
  MCP, object storage, Typst — env-gated adapters + `docs/INTEGRATIONS.md`
  per-service wiring instructions for the end user. Unset env = feature
  disables gracefully, never crashes. Supabase Cloud remains a documented
  optional path for users who want hosted Postgres+auth.
- Items 106–111 below rewritten accordingly: Auth.js+Postgres replaces
  the `@supabase/ssr` migration; app-layer authz replaces RLS items;
  argon2 seed users; drizzle schema/types replace `generate-types`.

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

### 2i. Storerooms, environmental monitoring & hardened scanning

*Users can create storerooms of any type — cold room, dry store, IT closet,
frozen goods, secure cage, vehicle bay, hazmat cabinet — each fully
configurable. Rooms can connect to remote monitoring (sensors, building
automation) and scanning inputs are hardened against theft, cloning, replay,
and bypass.*

**Storeroom types & configuration:**

84. `storerooms` table — name, type, parent zone, capacity, access_level,
    feature_flags JSONB, sensor_bindings
85. Storeroom type presets: Cold Storage, Frozen, Dry Goods, IT/Computer,
    Vehicle Parts Bay, Secure/Cage, Hazmat, General — each seeds sane defaults
86. Per-room feature toggles — admin can enable/disable per room: climate
    monitoring, expiry enforcement, access control, photo-on-receipt,
    two-person rule, quarantine mode, pick restrictions
87. Per-room item-type allowlist — frozen room rejects non-cold-chain items
88. Per-room constraints — temp range, max capacity, allowed roles, badge/QR
    door access flag
89. Storeroom dashboard view — occupancy, climate status, alerts, contents
    tree per room
90. Room transfer workflow — move stock between rooms with chain-of-custody
    log entry

**Environmental monitoring (IoT-ready):**

91. `sensor_readings` table — room_id, metric (temp/humidity/door/vibration/
    power), value, unit, recorded_at, source, quality flag
92. Sensor ingestion API — authenticated POST endpoint for MQTT bridges,
    vendor webhooks, or edge agents; idempotent, rate-limited, schema-validated
93. Threshold rules engine — per-room min/max per metric; breach → alert event
94. Alert lifecycle — active / acknowledged / resolved, with escalation
    (unacked after N min → notify manager)
95. Climate timeline chart per room (Recharts) + excursion report (PDF via Typst)
96. Door-open events logged as stock-relevant audit entries
97. Sensor health monitoring — stale-reading detection (no data > X min → alert)
98. Sensor simulator — generates realistic temp/humidity/door
    data so the feature works without hardware
99. Vendor-agnostic connector docs — how to wire common sensors (ESP32/MQTT,
    off-the-shelf IoT gateways, building-management webhooks)

**Hardened barcode & RFID scanning:**

100. Dual input support — USB/Bluetooth HID scanners, camera (ZXing), AND
     RFID (UHF via WebUSB/WebSerial readers + NFC via Web NFC where available)
101. `scan_events` audit table — every scan logged: input_type, credential,
     timestamp, geo/room context, result, payload hash — feeds anomaly engine
102. Scan-token signing — labels carry HMAC-signed payloads; server verifies
     signature + expiry before accepting; cloned/forged labels rejected
103. Replay protection — nonce + timestamp window on scan tokens; duplicate
     scans within window flagged, not silently accepted
104. Scan anomaly detection — impossible-velocity (same tag scanned at two
     rooms < travel time), scan-without-presence, off-hours scanning,
     bulk-scan bursts → flagged for review, optional auto-lock
105. Tamper-evident labels — destructive vinyl stock noted in label profiles;
     scan records label integrity state where detectable
106. RFID-specific: tag TID vs EPC distinction, kill-password support notes,
     anti-clone detection (same EPC on two TIDs = clone alert)
107. Scan authorization matrix — which roles may scan which actions in which
     rooms (staff can count, only managers can adjust/write-off)
108. Signed scan receipts — every mutation via scan produces a verifiable
     receipt record (who/what/when/where/before-after qty) shown in audit log
109. Rate limiting + CAPTCHA-equivalent friction on manual entry fallback
     (manual entry is the bypass vector — throttle + require reason)
110. Input fuzzing hardening — all scan payloads Zod-validated, length-capped,
     control-char stripped, treated as untrusted
111. Scanner pairing flow — admin pairs specific hardware IDs to roles/rooms;
     unpaired devices get read-only or rejected

### 2j. Industry pain-point features (white-paper/research driven)

*Evidence base: WHO/IQvia cold-chain review, FDA FSMA 204 pilots, WERC DC
metrics, NRF shrink data, APQC, Kardex/Blue Star surveys, NIST SP 800-98,
RFIDSec taxonomy, Snipe-IT/ServiceNow ITAM studies, fleet-parts literature.
Every item below maps to a documented, quantified industry problem.*

**Cold-chain, expiry & compliance:**

126. Per-zone temp threshold rules — min/max per room, product-class ranges
    (2–8°C pharma, −18°C frozen, ambient), severity per rule
127. Sustained-breach excursion engine — alert only after configured dwell
    (e.g. 15 min); kills door-open nuisance alarms
128. Door-aware monitoring mode — extend tolerance while door open, alert on
    open-duration > limit, log every door event
129. Hard-limit immediate trip — extreme breach alerts instantly, bypasses dwell
130. Monitoring-gap alerts — no reading within N× interval or sensor offline
    raises incident (silent sensor = excursion risk)
131. Excursion incident object — auto-created w/ temp timeline, door events,
    affected SKUs/lots, workflow (open→quarantined→investigated→released),
    Typst PDF export for claims/audits
132. Auto-quarantine on excursion — zone stock blocked from pick/sale until
    disposition recorded
133. Product stability profiles — per-SKU acceptable excursion magnitude/
    duration; auto-classify excursion as acceptable/review/reject
134. Per-zone climate dashboard — live min/max/mean, sparkline, staleness
    indicator per room
135. Auto-generated digital temp logs — per zone per day, PDF/CSV export
    (HACCP evidence; inspectors want live data not paper archives)
136. Goods-in temp gate — receiving requires product temp + packaging
    condition before stock posts; blocks putaway until captured
137. Cleaning/sanitation scheduler — checklist tasks, due dates, photo
    evidence, completion timestamps
138. Pest/facility inspection checklists — recurring, sign-off required
139. Zone segregation enforcement — allergen-free/quarantine/controlled-
    ambient tags block incompatible co-location
140. One-click audit pack — monitoring logs + deviations + corrective actions
    + task completions for an inspector-defined window
141. Lot/batch genealogy — every unit carries lot + supplier + received/
    expiry dates; every movement in append-only log (extends items 8/26)
142. Bidirectional recall trace — input lot → forward (all locations reached)
    + backward (supplier, co-located batches); sortable CSV inside 24h window
143. Recall impact dashboard — affected units by customer/location/value +
    generated quarantine + notification lists
144. FEFO pick enforcement — earliest-expiry first; warn/block later-expiry
    picks while earlier-expiry stock remains (configurable per class)
145. Expiry required at receiving for perishable SKUs
146. Expiry-risk dashboard — stock expiring 7/30/90d by value + location;
    disposition workflow (markdown/transfer/donate/disposal) w/ value-at-risk
147. Returns quarantine — customer returns can't re-enter sellable stock
    without override + reason code
148. Door-open analytics — open count/duration by shift per door; correlates
    excursions + energy
149. Dock appointment scheduling — stagger arrivals, minimize simultaneous
    door-open + staging dwell
150. Staging dwell timer — arrival→dock→putaway-complete; flag >X min
151. Cold-chain handoff check — record trailer/reefer temp at arrival; warn/
    block unloading into warm trailer
152. Energy proxy report — door-open minutes + zone runtime vs kWh where
    meter data exists

**Inventory accuracy & receiving:**

153. ABC-tiered cycle count schedules — A monthly / B quarterly / C annually,
    auto-generated count tasks, optional blind mode
154. Variance approval workflow — counter records, manager approves before
    ledger updates; repeated-variance SKUs auto-flagged for recount
155. Auto-recount — variance beyond class tolerance triggers recount by a
    DIFFERENT counter before adjustment posts
156. Variance root-cause codes — receiving error / mis-slot / damage /
    theft / count error; Inventory Record Accuracy % analytics by
    location/counter/month
157. Location discipline — bin required at putaway; mis-slot reports when
    stock found outside assigned location
158. Adjustment approval gates — count adjustments above threshold need
    manager sign-off
159. Dock-to-stock timer — receipt→putaway→system-entry per shipment;
    benchmark vs WERC 3.5h best-in-class
160. Receiving line-level checklist — qty/condition/lot/expiry/temp per PO
    line; discrepancies logged per line not per order
161. ASN matching — supplier ASN vs physical receipt; mismatches flagged
    before putaway
162. Supplier scorecards — damage-free %, receipt-line accuracy per vendor
    (targets WERC "correct documents" metric)
163. Scan-to-bin putaway verification — actual vs suggested location
    recorded; mis-slots tracked
164. Damage/shortage claims — photo + reason at receiving → auto-generated
    supplier claim doc

**Fleet-parts & IT-asset specifics:**

165. Mandatory work-order/job reference on every issue — kills cost-
    attribution loss, enables per-vehicle cost-per-mile
166. Core charge ledger — expected return-by + charge amount per core-
    bearing part; unreturned cores auto-escalate to visible cost
167. Warranty/expected-life flag on issue — auto-detect replacement within
    warranty window → claim-ready record
168. Obsolescence review report — zero-movement 12–24mo parts flagged for
    write-off/supplier-return/buy-back
169. Job staging vs available stock — picked-for-job parts sit in staging
    qty, not sellable stock; prevents double-issue
170. Backorder + promised-date per PO line — work orders show part-risk
    before job starts
171. Cross-location "who has it" search — check other bins/depots/loaners
    before ordering (avoids duplicate purchase)
172. Pre-close invoice match — work-order close compares installed vs
    billed parts/cores/freight; flags unbilled installs
173. Fitment validation on issue — warn/block part↔vehicle spec mismatch
    (tyre size/load/speed rating); wrong-part is #1 shop error class
174. Intermittent-demand flags — days-since-last-sale + demand history per
    slow SKU → reorder-vs-retire calls (85% of auto SKUs sell ≤10×/yr)
175. Serialized asset identity — unique serial/barcode per unit for
    high-value SKUs; qty-level tracking insufficient for theft-prone stock
176. Offboarding return queue — removing client/employee auto-generates
    expected-returns list; overdue escalates ("offboarding black hole")
177. Swap-out reconciliation — repair/warranty exchanges as linked pairs
    (out-for-repair ⇄ replacement-in), auto-prompted to close both legs
178. Loaner board with aging — devices on loan >N days flagged
179. Warranty/service contract fields on asset — vendor, contract ref,
    expiry; repair routing auto-fills vendor contact
180. Lifecycle status machine — in-service→repair→warranty-return→EOL→
    refresh-queue; proactive refresh planning
181. Ghost-asset sweep — scheduled audit mode: scan shelf, diff expected
    vs found; missing → exception list
182. License/seat register per machine — software titles, seats, renewal
    dates; export shaped for vendor-audit response
183. Immutable move ledger extended to assets/loans — append-only events,
    corrections are new events never edits

**UX & productivity:**

184. ⌘K command palette — grouped ranked results, scoped prefixes (p:/s:/l:),
    recent-first, two-key nav chords
185. Scan-first one-loop flows — app says what's next (receive→putaway→
    pick→count queue), search is deliberate fallback
186. Scan location BEFORE items when counting — prevents "correctly counting
    the wrong place"; shows expected SKU + last-known qty
187. Multi-scan AR checkmark counting — camera counts tens of items w/
    overlay confirmation + progress bar (Scandit MatrixScan pattern)
188. Gamification — XP/streaks/badges/leaderboards, kiosk PIN terminals for
    workers w/o email, optional TV wall displays
189. Voice stocktake entry — "item 4412, eighteen units, rack B3" → row
190. Voice-directed picking — finite vocabulary (<100 prompts), grouped
    location digits, repeat-back confirm, barcode safety net at pick face
191. Industrial mobile baseline — 48–56px targets, high contrast, one-hand
    thumb zones, glove-friendly, audio+haptic scan feedback, sub-100ms scan
192. Offline-first honest sync — local commit first, "Offline · cached HH:MM"
    banner + unsynced count always visible, mutations fail loudly never
    silently queue
193. Undo-last-scan + line reversal — reverse last action pre-sync, [-]/[+]
    tri-control on completed lines
194. Dashboards where every number deep-links to the screen where you act;
    "Needs attention" exception list above metrics
195. Guided wizards for irreversible flows — progressive disclosure +
    confirmation before destructive actions
196. Two-path first screen — "Set up" vs "Explore with sample data";
    seed dataset manifest-owned, banner-marked, one-click verified removal,
    simulated activity never fires alerts/webhooks
197. Server-side setup checklist — only real actions tick it (create site →
    location → item → print label → invite teammate)
198. Location labels as onboarding step — print+mount QR labels during
    setup; a scan answers "what AND where" on day one
199. Unlock-gated import wizard — steps unlock sequentially; inline grid
    edit; downloadable sample-format file; duplicate-SKU flagging
200. Receiving flow ends in label creation — scan supplier# → qty → location
    → print permanent QR identity; edits never invalidate the code
201. Onboard by doing a real task — guided first receive/pick, not slides

**Alerting that doesn't fatigue:**

202. 3-tier severity — P0 (phone+SMS, 15min SLA) / P1 (chat DM, 1hr) /
    P2 (digest); rule: "if nobody responds in 15min, what happens?"
203. Auto-escalation + disposition-required ack — unacked P1 → P0; ack
    requires "on site / handed off / false alarm" not plain ack
204. Threshold-with-duration + cooldown + zone-counting + stale-sensor
    rules — "above 8°C for 15min" not "above 8°C"; one alert per zone
    problem; no-reopen window kills flapping
205. Alert once per threshold crossing — no "4,3,2,1" countdown noise
206. Channel by urgency + role defaults + quiet hours — SMS/voice P0,
    push task-exceptions, email KPIs; night-shift digests
207. Four alert types w/ daily budget — FYI(digest)/Watch(prepare)/
    Escalate(decide now, target 0–3/owner/day)/Automate; majority land
    FYI/Watch
208. Digest modes + per-item snooze — daily/weekly standing lists of
    everything below threshold vs instant crossings; 7/30-day snooze
209. Notification center "Needs action" tab — Unread/Needs action/All w/
    live counts; read≠resolved; toasts for now, inbox for later;
    every alert deep-links to the triggering record

**AI/automation innovations:**

210. In-app conversational AI copilot — plain-English Q&A w/ follow-ups +
    direct action links (extends item 68)
211. AI anomaly detection on transaction logs — pick-without-putaway,
    impossible scan rates, unusual adjustments, system-vs-physical drift →
    prioritized recount tasks
212. Phone-camera CV shelf counting — wave phone across shelf, on-device
    count (future; data model must anticipate)
213. Robot/drone counting API hooks — REST endpoints for external counting
    systems (Verity/Corvus pattern)
214. Warehouse digital-twin data model — locations table + status colors +
    event log so a visual twin can be layered later
215. Shelf-intelligence layer — on-shelf availability %, prioritized
    restock alerts
216. Explainable reorder recommendations — "why this number" dialog shows
    the math; guardrails for MOQ/lead-time/budget; one-click draft POs
    grouped by supplier
217. Continuous audit / inventory-health monitoring — exception-only
    human review
218. Telemetry retention tiers — raw readings hot ~90d → hourly rollups
    long-term (controls Supabase cost)

**Extra scan-security (complements items 100–111):**

219. Tamper-evident void-on-peel labels — physically compromised labels
    visibly fail (EAS "active until deactivated" model)
220. Issue-complete label deactivation — label marked "spent" on checkout;
    returned-but-shouldn't-exist label at door raises alarm
221. RFID Gen2 hardening notes — access/kill passwords, reserved bank
    locking; 32-bit APwd brute-forceable → rely on backend anomaly
    detection too
222. Badge-pairing session governance — shared-device QR/NFC badge or
    per-user PIN unlock, short-TTL sessions, forced re-auth on lock,
    attempt limiting (SecureNode/Credenti pattern)
223. Velocity caps per user/room — scans/min limits; bulk-scan spikes →
    auto-hold for manager approval

### 2k. RBAC & access control (deep)

*Foundation has 5 fixed roles + RLS + RPC checks. Serious systems go deeper:
InvenTree ruleset×CRUD matrix, OpenBoxes per-location perms + financial
blurring, NetBox object permissions, Part-DB allow/forbid/inherit tri-state,
Grocy ~28 granular permissions, Snipe-IT permission groups.*

224. **Permission matrix model** — `permissions` table: resource × action
    (view/create/edit/delete/approve/export) × scope (global/room/location/
    own-records); `role_permissions` join; evaluated server-side in RPCs
    and API routes, never trusted from client
225. **Custom roles** — clone-from-existing role editor; system roles
    (super_admin etc.) locked, custom roles fully editable
226. **Per-room/per-location scoping** — grant "manager of Cold Room A"
    without global manager rights (OpenBoxes per-location pattern);
    `user_room_grants` table + RLS helpers
227. **Field-level permissions / financial blurring** — hide cost prices,
    supplier spend, valuation from staff/fleet_dispatch roles; column-level
    masking in queries + UI (OpenBoxes financial-user flag)
228. **Permission groups/teams** — group users, assign perms to group,
    user inherits union; department-shaped (receiving team, night shift)
229. **Temporary elevated access** — time-boxed role grants with auto-expiry
    + reason required; "cover for annual leave" pattern; all grants logged
230. **Approval chains by role** — stock adjustments, write-offs, PO
    approvals, variance sign-offs route to role-holders, not named users
231. **API key scopes ↔ permissions** — keys carry permission subsets;
    read-only key can't hit mutation endpoints even if role allows
232. **MCP tool permissions** — MCP tools check caller's effective
    permissions; read-only token → read tools only; per-tool scope map
233. **"Effective permissions" inspector** — admin/debug page answering
    "why can/can't user X do Y here?" — shows which grant/policy decided
    (Part-DB/NetBox explainability pattern)
234. **Permission-change audit** — every role/permission/grant change
    writes to activity_logs w/ before/after diff; permission edits require
    admin+ and are themselves audited
235. **Break-glass emergency access** — super_admin-only elevated mode,
    requires stated reason, auto-expires, loud audit entry + optional
    notify-other-admins
236. **Service accounts for integrations** — non-human actors (sensor
    gateways, ERP sync, CI) get scoped machine identities, clearly
    labelled in audit log vs human users
237. **Kiosk/PIN mode** — shared floor device: user enters PIN per
    transaction, session binds to that user for attribution; auto-lock
    on idle (pairs with item 188 gamification/kiosk terminals)
238. **Read-only auditor role option** — external accountant/auditor gets
    view+export across stock/ledger/audit-log, zero mutation
239. **Deny-overrides-allow evaluation** — explicit deny beats inherited
    allow (Part-DB tri-state); documented eval order: deny → allow →
    inherit → default-deny
240. **RLS policy generator** — migration helper that emits standard
    policy blocks per table from the permission matrix, so new tables
    don't ship unprotected

---

## PHASE 3 — BRANDING & GO-LIVE PREP

241. **Public landing page** (`app/page.tsx` rewrite): hero, screenshot tour,
    feature grid, "how it works" logic-chain diagram, comparison table vs
    spreadsheets/paper, footer.
242. Footer footnotes: "Part of the ESO Industries ecosystem" →
    https://esoind.co.za + https://tyresync.co.za links;
    `mailto:esoken92@gmail.com` as primary contact/support.
243. MCP setup page — copy-paste config snippet
    (`claude_desktop_config` / Cursor `mcpServers` entry) so visitors connect live.
244. API playground page — try-it UI against REST API.
245. **Seed-data reset button** — one click reseeds seed data (critical for
    live walkthroughs/screenshots; admin-only, confirm-gated).
246. `PRESENTER.md` presenter script — 5-minute flow: login → scan → stock take →
    MCP query → PDF report.
247. Typst-generated architecture/system PDF (same pipeline) for "how it's built".
248. Realistic seed story: tyre-shop inventory (tyres by size, fluids, tools,
    consumables, vehicles-as-assets) so screenshots look alive.
249. Roadmap page — public, signals active project.
250. README final pass: screenshots embedded, badges, quickstart <5min,
    MCP/API highlights front-and-center, license block.
251. `SETUP_DATABASE.md` + `.env.example` final consistency check.
252. Final security re-review: secrets scan, RLS coverage, API auth on every
    route, Zod at every boundary, service-role server-only.
253. Final verification: `npm ci` clean, tsc/lint/build green, `npm run dev`
    smoke test of every route.
254. Produce go-live checklist + hand back to owner for the visibility flip.

---

## PHASE 4 — DEPLOYMENT, ON-PREM & LOCAL REHEARSAL

*The system is free and runs on the client's OWN internal/intranet
infrastructure — including old/broken kit. It must be solid, hardened,
role-based, and monitorable by the client company. Cloud (Vercel+Supabase)
remains one option; self-hosted is the differentiator.*

**Deployment architecture:**

255. ~~ADR: deployment options~~ **DECIDED — dual artifacts:**
    (a) **Web version** — proven stack: Next.js + Supabase, deploys to
    Vercel+Supabase Cloud OR self-hosted Docker Compose (item 256). Full
    feature set.
    (b) **Offline version — Rust.** Tauri v2 shell (Rust core) bundling
    the SAME Next.js frontend + a Rust backend (Axum + SQLx + SQLite)
    implementing the core API surface. Single `.exe`/`.dmg`, zero
    install, works with NO network. See Phase 6.
256. **Docker Compose bundle** — `deploy/` dir: Next.js `output:'standalone'`
    build + supabase services + Caddy (auto-TLS) or nginx; `docker compose
    up` = whole system running; `.env` template with generated secrets
257. **Windows-first install** — `install.ps1` + `install.bat` alongside
    compose file; detect Docker/Podman/WSL2, offer guided paths; works on
    machines where "Docker isn't a thing" via documented fallbacks
258. **Minimum hardware spec** — target: old office PC (4GB RAM, x64,
    Win10+); MEASURE actual footprint and only claim "runs on a 2015
    laptop" if verified on real/constrained hardware
259. **LAN/intranet mode** — zero internet required: self-host fonts
    (next/font/google downloads at build — vendor Inter locally), no
    external CDN calls, no telemetry by default; full audit for outbound
    requests
260. **Offline-first data** — PWA + Dexie queue (scaffold exists) so floor
    devices keep working through server restarts/network blips; honest
    sync-state UI (item 192)
261. **Multi-PC LAN access** — one server PC hosts; staff connect via
    browser; hostname/mDNS discovery doc + Windows firewall rules guide

**Monitoring & oversight ("company can monitor it"):**

262. **Admin monitoring console** — deployment health page: DB status,
    disk usage, version, last backup, connected users, failed syncs,
    API/MCP call stats, sensor staleness — the client's oversight view
263. **License/seat visibility** — admin sees user count, role
    distribution, storage usage vs plan (supports the free/internal-use
    license story)
264. **Audit-log completeness for oversight** — every admin action,
    permission change, config change, backup, and update already lands in
    activity_logs; oversight page surfaces it filtered

**Operations:**

265. **Backup & restore** — one-click DB dump + storage archive +
    scheduled backups; restore wizard; backup files stay on-prem
266. **Update mechanism** — `update` command: pull new image → run
    pending migrations (additive-only) → health-check → swap; version
    endpoint for support
267. **Air-gapped mode** — verified full-offline incl. no license check,
    no telemetry, no external fonts/CDN; documented as supported config
268. **First-boot wizard** — set admin password (force-change on seed
    creds), org name, timezone, currency, seed-data on/off
269. **Security hardening for LAN** — bind-address config, TLS via
    self-signed or LAN cert guide, forced credential change, rate limits,
    service-role never leaves server env
270. **Uninstall/clean-removal docs** — removes containers, volumes, data
    dir; no orphaned services
271. **Troubleshooting guide** — common old-infra issues: port conflicts,
    low RAM, Windows firewall, Docker Desktop licensing on old Windows,
    WSL2 requirements, proxy environments

**Local rehearsal (BEFORE go-live):**

272. **Local sample kit** — `docker compose up` OR `npm run dev` reproduces
    the FULL app incl. seed data; works offline; PRESENTER.md script runs
    end-to-end (login → scan → stock take → MCP query → PDF report)
273. **Old-hardware rehearsal** — actually run the complete walkthrough on a
    constrained VM/old machine; record results; fix what breaks; this is
    a go-live gate, not optional
274. **Smoke-test suite** — `scripts/smoke.mjs` hits key routes + API +
    MCP tool calls + PDF render; run in CI and before every release
275. **Seed data portability** — seed + reset work identically in
    cloud and self-hosted modes; seeded data never requires internet

---

## PHASE 5 — MOBILE, PWA & CROSS-DEVICE

*The floor worker's primary device is a phone or tablet — often a budget
Android on a bad connection. Mobile web must be first-class, not an
afterthought; the PWA should feel like a native app without an app store.*

276. **Mobile-first responsive web** — every page usable one-handed on a
    360px screen; tables collapse to cards, filters become bottom sheets,
    forms stack; desktop gets the dense layout
277. **Installable PWA** — manifest + icons + splash screens +
    `display:standalone`; handwritten sw.js registered — finish it:
    offline shell, install prompt, update-available toast
278. **Mobile app shell** — bottom tab nav (Home/Scan/Stock/Tasks/More),
    thumb-zone primary actions, collapsible header; desktop keeps sidebar
279. **Camera-first mobile scanning** — ZXing scan view is THE mobile
    home action; torch toggle, continuous-scan mode, haptic+audio
    confirm; works front/rear camera
280. **Scan-anything flows on mobile** — product, bin, room, PO, loan,
    stock-take all resolve from one scanner; context decides the action
281. **Mobile stock take** — guided count mode: scan bin → scan items →
    enter qty → next; progress ring; blind mode hides expected qty;
    works fully offline, syncs on reconnect
282. **Mobile receiving/issue** — quick receive (scan PO → scan item →
    qty → done) and quick issue; photo capture for damage/condition
283. **Mobile tool loans** — checkout/checkin in ≤3 taps: scan tool →
    scan person/badge → confirm; overdue badges on home
284. **Mobile dashboard cards** — stat cards + alert list + quick actions;
    charts get mobile-optimized tooltips/legends; every number deep-links
285. **Mobile auth** — passkeys/WebAuthn + biometric unlock where
    available; PIN fallback for shared floor devices (pairs w/ item 237);
    session persistence tuned for shift workers
286. **Web Push notifications** — low-stock, overdue loans, excursion
    alerts, task assignments → phone even when PWA closed (VAPID keys,
    per-user subscription prefs)
287. **Offline-first mobile** — Dexie queue for all mutations; sync
    banner shows pending count; conflict resolution UI for the rare
    collision; works in basement stockrooms with zero signal
288. **Capacitor wrapper (optional)** — same codebase wrapped as real
    iOS/Android apps for clients who want store-distributed or
    kiosk-locked installs; no rewrite, shares all logic
289. **Deep links** — scan URLs, notification taps, shared product links
    open the right screen; universal-link config for the wrapper
290. **Low-end device performance** — budget-Android budget: lazy-load
    charts, virtualized lists, image compression, <3s interactive on
    3GB-RAM devices; tested on real cheap hardware not just emulation
291. **Data-saver mode** — toggle reduces images/charts/payloads for
    metered connections; respects `Save-Data` header
292. **Mobile printing** — print labels via Bluetooth/ESC-POS thermal
    printers or OS print dialog; pick-ticket PDF shares to any printer
    app; QR label preview before print
293. **Mobile admin-lite** — managers approve variances, acknowledge
    alerts, review exceptions from phone; destructive actions still
    desktop-gated where sensible
294. **Cross-device test matrix** — Playwright mobile emulation + real-
    device checklist (iPhone SE, budget Samsung, tablet); smoke tests
    cover mobile flows; documented in TESTING.md

**Local playtest & UI sanity pass (manual, before every release AND go-live):**

295. **Full click-through playtest** — run `npm run dev` locally and
    manually click EVERY route and flow as each persona role: landing →
    signup/login/reset → dashboard → inventory CRUD → stock movement →
    stock take → tool loans → suppliers → bin locations → zone map →
    reports → audit log → users → settings → profile → scan → MCP/API
    docs. Log every dead end, console error, broken state
296. **Toggle/switch styling audit** — every toggle/switch/checkbox must
    render as a proper control (pill switch or square checkbox) at ALL
    breakpoints and themes — specifically check for the "weird oval"
    bug (unconstrained aspect-ratio/width stretching the control into an
    ellipse). Audit: settings toggles, notification prefs, feature flags,
    dark-mode switch, any shadcn/Radix switch. Fix via explicit
    `h-* w-*` + `rounded-full` constraints, never rely on parent flex
297. **Form & dialog behavior pass** — every dialog opens/closes,
    validates, submits, shows error+success states; no double-submit;
    Escape/backdrop dismiss works; focus trap sane
298. **Empty/loading/error states** — every list page renders correctly
    with zero rows, slow load (skeleton), and query failure (error +
    retry) — no white screens or infinite spinners
299. **Playtest sign-off checklist** — `docs/PLAYTEST.md` records date,
    routes covered, bugs found/fixed, console-error count; required
    before release + before public flip

---

## PHASE 6 — RUST OFFLINE VERSION (dual artifact)

*Decision (item 255): TWO artifacts from one codebase —
(a) Web: Next.js + Supabase (cloud or self-hosted Docker), full features.
(b) Offline: Rust desktop app for clients with NO usable server/network —
factory floors, remote sites, broken infrastructure. The offline app must
run the core floor workflows standalone on a single PC.*

**Architecture:**

300. **Tauri v2 shell** — Rust core wraps the SAME Next.js frontend
    (served from bundled assets or localhost sidecar); Rust backend =
    Axum + SQLx + SQLite (`rusqlite` acceptable for simpler queries).
    One codebase, two shells — UI never forks
301. **Shared API contract** — the OpenAPI spec (item 65) is the
    contract BOTH backends implement: web = Supabase RPC/PostgREST,
    offline = Rust handlers → SQLite. Same routes, same Zod-equivalent
    validation (serde + validator crate), same response shapes — this is
    what makes dual-backend feasible without a rewrite
302. **SQLite schema** — mirror core tables: profiles, products,
    stock_items, stock_movements, tool_loans, stock_takes(+items),
    suppliers, bin_locations, storerooms, activity_logs; same column
    names where possible; migration runner on startup
303. **Offline auth** — local user table, argon2id password hashing,
    same 5-role model + permission checks enforced in Rust query layer
    (no RLS in SQLite — authorization lives in the handler layer, tested)
304. **First-boot offline wizard** — create admin, org name, import or
    seed seed data; everything local, zero network calls

**Offline feature tiers:**

305. **Tier-1 (must work fully offline):** login/roles, dashboard,
    product/inventory browse+search, scan receive/issue/adjust, stock
    takes (blind count), tool loans check-out/in, bin/storeroom views,
    activity log, reports (basic), label/QR generation+print, CSV
    import/export, settings
306. **Tier-2 (offline-capable, sync later):** multi-user on one PC
    (single-writer SQLite WAL), backup/restore to file, update via
    installer
307. **Excluded offline (documented):** Supabase Auth/MFA cloud flows,
    MCP-over-network (MCP can run LOCAL in the Rust app later — Phase 2
    item), AI features needing API keys, web push, cloud sync.
    README states parity matrix honestly
308. **Optional sync engine (Phase-2 of offline)** — when the site gets
    network: sync SQLite ↔ Supabase via the REST API; conflict policy =
    last-write-wins per row + append-only ledger merges cleanly
    (movements are events, not updates — they sync without conflicts);
    sync status UI shows pending/failed

**Distribution & quality:**

309. **Single-binary distribution** — Tauri bundler → `vms-setup.exe`
    (Windows first — the client's actual fleet), `.dmg`/`.AppImage`
    later; NSIS/Inno installer with desktop shortcut + uninstaller
310. **Footprint budget** — installer <80MB, idle RAM <300MB, cold start
    <3s on a 2015-era i5/4GB — measured, documented; SQLite file is the
    only state (backup = copy one file)
311. **Rust quality gates** — `cargo clippy -- -D warnings`,
    `cargo test`, `cargo audit`/`cargo deny` in CI; same smoke suite
    (item 274) extended to hit the offline binary's localhost API
312. **Offline parity** — the 5-minute PRESENTER.md flow runs IDENTICALLY
    on the .exe with network cable pulled; verified in the old-hardware
    rehearsal (item 273 covers both artifacts)
313. **License & repo layout** — `offline/` cargo workspace inside this
    repo (or sibling `vms-offline` repo — decide in ADR addendum);
    same CC BY-NC-SA license; shared types generated from the OpenAPI
    spec where practical

---

## PHASE 2l — MARKET FIT: complaints, buyer wants & gap closure

*Evidence: 2,603-review sync-app study, inFlow State of Inventory 2026
(n=400), TechnBrains 75-record coding, G2/Capterra/Trustpilot/Reddit/
app-store mining across Zoho, inFlow, Fishbowl, Cin7, Sortly, AssetTiger,
UpKeep, MaintainX, EZOffice, Cheqroom, Finale, Katana, Odoo, ERPNext,
Snipe-IT. Top complaint themes: silent sync corruption, counts≠reality,
accounting drift, mobile-is-a-toy, no real offline, rigid reports,
two-tier permissions, painful multi-location, mangled imports, weeks-
long onboarding, lock-in/hostage data, pricing surprises, absent
support.*

**Anti-complaint product principles (commitments, not features):**

314. **No per-seat/per-order/per-asset pricing ever** — free product;
    unlimited users is a feature (AssetTiger/Wasp buyers literally cite
    this). Scanner-only floor workers never count as seats
315. **No feature paywalls** — lot/serial/expiry, bin locations, labels,
    API, MCP, reports: ALL in base. Katana's "$199/mo for batch
    tracking" is the canonical resentment — never do it
316. **Full data portability, forever** — one-click export of EVERYTHING
    incl. history (CSV + JSON + API dump); works offline; no
    deletion windows; "your data is yours" stated in README
317. **No silent failures** — every sync/import/report error lands in a
    plain-language error queue with resolution steps; "it said
    connected but wasn't" is banned behavior
318. **Mobile at parity** — anything doable on web is doable on mobile
    (inFlow/Cheqroom "mobile is a subset" is a top complaint)
319. **Sub-day onboarding** — signup → first real scan in <30 min;
    import wizard validates BEFORE commit (item 199 strengthened)

**Gap-closure features:**

320. **Kardex / stock-ledger report** — opening + movements = closing,
    per product/location/period; the report Odoo users say is missing;
    procurement's #1 reconciliation artifact
321. **BOM/kit cascade** — assemblies deduct components correctly,
    multi-level BOMs, circular-reference rejection, build/disassembly;
    Zoho's "components don't decrement" is documented inventory
    corruption — ours must be correct by construction (transactional)
322. **Case/pack-level scanning** — scan a case → expand to unit
    quantities; pack-size conversions on scan
323. **Transfer lifecycle hardening** — in-transit state visible to
    BOTH sides; partial receipt; damage/loss disposition per line;
    transfers can't silently orphan stock (Cin7/Epicor "stuck in
    transit" is a top complaint)
324. **Sub-location survives zero qty** — bin rows persist at qty=0
    (inFlow deletes them → re-entry hell); history stays attached
325. **Reservation/booking calendar** — asset/equipment reservations
    with date windows, holiday/closed-day rules, per-slot limits,
    calendar + list views (Cheqroom gap)
326. **Request-and-approve checkout** — users request gear/items,
    approver grants with due date + condition photos both ends
    (extends item 26 to asset custody)
327. **Bulk "move all" transfers** — relocate entire bins/locations/
    categories in one op; preserves history (Sortly's "move loses
    history" complaint)
328. **Scheduled report exports** — saved reports → CSV/PDF emailed on
    schedule (daily/weekly/monthly); custom date ranges; zero-stock
    filter toggle (MaintainX "40% want automated reporting")
329. **Report performance budget** — saved/custom reports load
    sub-second at 100k+ movement rows; indexed queries; pagination +
    server-side aggregation; report SPEED is the complaint, not report
    existence
330. **Fuzzy instant search** — typo-tolerant, prefix, SKU/barcode/
    name/location all in one box; Homebox's "capital letter = zero
    results" failure mode banned
331. **"Due today" proactive alerts** — notify BEFORE overdue (MaintainX
    users beg for this); lead-time alerts per category
332. **Multi-UOM decimals** — case/each/pound/meter conversions;
    fractional quantities for length-measured stock
333. **Project/job costing dimension** — optional project_code on
    movements/issues → per-project parts cost rollup (construction/
    trades ask; extends item 165)
334. **Grant/funding codes** — optional funding source on receipts/
    issues for nonprofit/education/gov (AssetTiger "unlimited users +
    grants" pattern)
335. **QuickBooks/Xero connector (CSV-first)** — two-way-ish via
    scheduled CSV export/import initially; journal-entry-shaped
    exports; documented mapping; API connector later. Accounting sync
    is the #1 integration ask and Fishbowl/QB drift is legendary —
    ours must reconcile to the cent or explain why not
336. **E-commerce stock feeds** — Shopify/Amazon/WooCommerce CSV/API
    stock-level feeds (read-only push first); oversell protection via
    atomic reservation (item 9 allocation model); channel-map table
337. **Shipping/carrier basics** — shipment records w/ carrier, tracking
    #, cost; carrier-rate lookup later; packing-list PDF via Typst
338. **Sync error queue** — failed channel/accounting syncs surface as
    actionable items (retry / skip / fix-mapping), never silent;
    visible in notification center
339. **Import pre-commit validation report** — dry-run mode shows
    EVERY row error (leading zeros dropped, date misreads, dupes,
    bad enums) before anything writes; fix-in-place then commit
340. **POS/marketplace connector hooks** — Square/TikTok/niche
    marketplaces via the same feed mechanism as 336; native > middleware

---

## PHASE 2m — OSS sweep round 2 + industry packs

Evidence base lives in `docs/research/`: `01-buyer-wants.md`,
`02-customer-complaints.md`, `03-github-sweep-2.md`, `04-industry-verticals.md`.

*Evidence: docs/research/03-github-sweep-2.md (34 repos: traccar, dolibarr,
glpi, fleetbase, shelf.nu, lubelog, ModernWMS, tracktor, iTop, Atlas CMMS,
openwms, frePPLe, leihs, hmis, isle, circulate, Inventoros, carcareco,
sentry-wms, fleetms, RepairOS, supplyseer…) and
docs/research/04-industry-verticals.md (pharma/healthcare/education/gov/
construction/mfg/retail/labs/hospitality/cannabis/wine/MRO/scrap/blood-bank
requirements, M/S/N priority-tagged).*

**Round-2 OSS gaps:**

341. **Booking/reservation layer** — advance reservations w/ conflict
    prevention, checkout/return windows, calendar sync (shelf.nu/
    circulate pattern; extends item 325)
342. **Custody vs location as separate axes** — who-has-it AND
    where-it-lives independently; checkout TO a room/location/vehicle,
    not just a person (isle pattern)
343. **Lending lifecycle** — request→approve→loan→renew→return→fine,
    holds/waitlists (leihs/circulate)
344. **Condition-graded returns** — OK/Damaged grading + photo evidence
    at checkout AND return; immutable scan history (SpaceWorks/circulate)
345. **Kits/bundles** — kit checkout deducts components via BOM explosion
    (pairs w/ item 321)
346. **Work-order linkage** — issues tied to WOs; labor+parts on one
    doc; WO close auto-posts consumption (Atlas CMMS/carcareco)
347. **Preventive maintenance scheduling** — calendar + runtime-hours +
    cycle/meter triggers; inspection form builder; cert renewals
    (insurance/fitness/registration expiry tracking)
348. **Depreciation & TCO** — straight-line/degressive schedules
    auto-posted to ledger, residual value, renewal planning (Dolibarr —
    unique in OSS)
349. **Demand forecasting → auto-reorder** — EOQ + safety stock +
    reorder point from history; auto-PO draft; confidence scoring
    (frePPLe/supplyseer/ai_inventory)
350. **Perpetual-inventory time travel** — reconstruct stock at ANY
    timestamp from the append-only ledger (qbit-wms/autotraq pattern)
351. **Pick-path optimization** — serpentine multi-order pick walks,
    pack-station scan verification, cartonization (sentry-wms)
352. **True UHF-RFID** — UART/BT reader pairing, bulk tag scanning,
    offline-first sync (zetavg pattern; extends item 100)
353. **Inter-warehouse transfers** — transit state visible both sides,
    per-warehouse reorder points/capacity, warehouse-scoped user ACL
    (Inventoros)
354. **Certification gating** — must hold asset certification before
    booking/checkout (makerspace/SpaceWorks pattern)
355. **LOTO/incident log** — lockout-tagout records + incident severity
    linked to assets
356. **Vehicle telematics hook** — odometer/mileage-driven maintenance
    triggers, optional GPS device ingestion (traccar companion)
357. **Multi-currency + tax per region** — cross-border stock valuation
358. **Connector health dashboard** — sync-health per integration:
    last-success, failure count, circuit-breaker state (sentry-wms
    pattern; pairs w/ item 338)

**Industry packs (vertical modules on shared core):**

359. **Pack framework** — `industry_packs` table + per-pack feature
    flags + per-pack schema additions via additive migrations; a pack
    enables/disables UI sections, fields, workflows, and reports. Core
    platform stays universal (audit, e-sig, roles, lot/serial, quarantine,
    scanning, locations, checkout lifecycle lift all boats)
360. **Pharma pack** — e-signatures w/ non-repudiation (re-auth on
    release/disposal/adjust), DSCSA serial+TI/TS capture, quarantine→
    release gating, stability-condition storage bands, CAPA linkage,
    approved-supplier gating, recall trace (docs/research/04 §1)
361. **Healthcare pack** — loaner/consignment kits w/ procedure links,
    UDI/GUDID fields, FDA recall ingestion (openFDA API), PM scheduling,
    vaccine cold-chain, HIPAA-conscious (no PHI on assets)
362. **Education pack** — member borrow rules (limits/periods/grace),
    fines→fee ledger, no-dues enforcement, grant/funding tagging,
    condition states, audit count mode
363. **Government/defense pack** — property book (custodian+location),
    AA&E handling flags, statistical-sample counts, ITAR/EAR export-
    control fields gating issue/transfer, chain-of-custody signer
    capture, OFAC screening hooks
364. **Construction pack** — job/site allocation w/ live variance,
    van/truck as location nodes, field requests from mobile, tool
    custody w/ condition photos, rental returns
365. **Manufacturing/MRO pack** — where-used BOM, WO lifecycle
    (request→approve→dispatch→issue→close), PM by hours/cycles,
    criticality classes, MRP-lite suggested POs, multi-crib stock
366. **Retail pack** — absolute-qty channel push (no deltas), variant
    model, RMA workflow, channel-native identifiers, per-channel price
    floors
367. **Labs pack** — lot lifecycle w/ COA/QC, sample chain-of-custody
    w/ visual freezer map, storage-class enforcement, freeze/thaw
    counter, SDS/hazard docs, GLP audit export
368. **Hospitality/food pack** — receiving temp verification, approved-
    supplier records, HACCP CCP logs w/ corrective actions, par-stock
    per shift, allergen flags
369. **Cannabis pack** — Metrc/BioTrack connector framework, transfer
    manifests, same-day counts (where legal — jurisdiction-gated)
370. **Aviation MRO pack** — serialized rotable (TSO/hours-since-
    overhaul/LLP limits), core-exchange obligations, release certs,
    unserviceable-state enforcement
371. **Extensibility hooks for remaining verticals** — scrap/weighbridge,
    wine vessel/bonded depletion, blood-bank ISBT-128: designed-for via
    pack framework, built only on demand

---

## PHASE 2n — GUIDED PROVISIONING (setup wizard)

*The killer UX: all functionality ships in the box, but the user never
sees what they don't need. First-run wizard asks what kind of operation
this is and provisions menus, fields, workflows, and policies
accordingly. This is how Odoo/ERPNext ask "company type" — done properly
it makes a 340-item system feel like a 40-item one.*

372. **Setup wizard (first-run, re-runnable)** — step flow: org basics →
    industry/vertical select → product types handled → stock policies →
    locations/storerooms → users/roles → review+provision. Skippable to
    seeded mode; re-runnable from settings (answers editable later)
373. **Industry/vertical selector** — pick from the 12 packs (360–371)
    + "general inventory" default; multi-select allowed (e.g. pharmacy
    that also does equipment loans); drives which packs activate
374. **Product-type declaration** — user checks what they stock:
    perishable/expiry goods, serialized items, chemicals/hazmat,
    regulated (pharma/medical), tools/equipment, vehicles/parts,
    consumables — each toggles relevant fields+workflows
375. **Picking/issue strategy select** — FIFO / LIFO / FEFO / specific-
    gravity-none; per-instance default + per-category override; drives
    pick suggestions AND enforcement level (suggest/warn/block)
376. **Valuation method select** — weighted average (default), FIFO
    layers, LIFO, standard cost; per-instance + per-category override;
    drives cost fields, reports, ledger valuation columns
377. **Expiry policy select** — none / track-only / enforce-FEFO /
    enforce+quarantine; feeds item 145–147 + cold-chain pack
378. **Dynamic menu provisioning** — nav built from enabled packs +
    config answers: a food distributor never sees "tool loans", a tool
    library never sees "expiry dashboards"; menus regenerate on config
    change; deep links to disabled features show "not enabled for your
    setup" not 404
379. **Field-level provisioning** — pack/product-type answers add or
    hide columns/fields/forms (e.g. serial# field appears only if
    serialized items declared; temp fields only if cold-chain pack on)
380. **Workflow provisioning** — approval chains, quarantine gates,
    receiving checklists activate per answers; a "simple" setup gets
    receive→stock→issue with zero ceremony
381. **Report provisioning** — report catalog filtered to enabled
    features; industry packs add their compliance reports automatically
382. **Config change management** — wizard answers stored as versioned
    `instance_config`; changes apply additively (new fields/workflows
    appear, disabled features hide data NOT delete it); change log +
    "what changed" summary
383. **Preset templates** — named presets beyond wizard: "Pharmacy",
    "Tool Library", "Fleet Parts", "Cold Storage", "School", "General"
    — one-click full provisioning incl. sample starter data shape
384. **Setup completeness score** — checklist widget: % of recommended
    config done (locations mapped? thresholds set? labels printed?
    users invited?) — gamifies onboarding (extends item 197)
385. **Provisioning preview** — before applying, show exactly what will
    change: "This enables: expiry tracking, FEFO picking, 3 new menus,
    2 reports. This hides: tool-loan screens." — no surprises

---

## PHASE 2o — PERSONA MODES, AUDIT & REPORTING DEPTH

*Two experience layers over one system: the BUILDER (admin) configures
the warehouse and oversees everything technical+operational; the OPERATOR
(worker) sees only the post-wizard warehouse — items, tasks, scanning —
and does the actual warehousing. RBAC (2k) governs WHAT they can do;
personas govern WHAT they see.*

386. **Persona/experience modes** — "Builder" vs "Operator" UX layers
    over the same app; mode derived from role + per-session "view as"
    toggle for admins
387. **Admin console surface** — builder sees EVERYTHING: setup wizard
    re-run, pack manager, instance_config, storerooms+sensors, users/
    roles/permission matrix, API keys, MCP config, integrations,
    audit log, report builder, system health, backups
388. **Worker surface** — operator sees ONLY the provisioned warehouse:
    task dashboard, inventory browse/search, scan actions, stock takes,
    tool loans, receive/issue, my loans, notifications. NO settings,
    users, config, API keys, packs, audit-log admin, report builder —
    enforced in nav + middleware + RLS, not just hidden CSS
389. **Role→persona mapping** — super_admin/admin = builder; manager =
    builder-lite (approvals, variance sign-off, counts oversight — no
    full config); staff/fleet_dispatch = operator by default
390. **"View as worker" toggle** — admin previews exact operator UX for
    support/training (extends impersonation; read-only where possible)
391. **First-login routing** — operator lands on task dashboard, never
    sees wizard/settings; builder lands on admin console + setup
    completeness checklist
392. **Task-centric worker dashboard** — "what needs doing NOW": pending
    receives, counts due, loans overdue, picks queued, alerts needing
    ack — the operator's entire world on one screen
393. **Audit log depth** — every mutation logged w/ actor, before/after
    diff, room/location context; filterable by user/role/room/action/
    date/entity; append-only enforced at DB level (no UPDATE/DELETE
    grants); optional sensitive-view logging flag
394. **Audit oversight views** — "who did what where when" timeline,
    per-user activity report, per-room activity, variance→actor
    traceability, export for auditors
395. **Report builder** — pick entity + fields + filters + grouping +
    date range → save/share/export (CSV + Typst PDF); per-pack template
    library; scheduled delivery subscriptions (extends 328)
396. **Report test suite** — golden-master tests: seed known fixture →
    assert reconciliation (kardex opening+movements=closing, valuation
    sums to ledger, variance math exact); CI-gated; a wrong report is a
    release blocker
397. **Report catalog verification** — every provisioned report renders
    correctly against seed data for its pack; broken/empty-report
    detection in CI
398. **Report performance budget** — extends 329: 100k+ movement rows,
    server-side aggregation, saved-report caching, sub-second common
    queries
399. **Report-level permissions** — field/report access follows 227
    financial blurring: staff can't pull cost/valuation/supplier-spend
    reports; per-report role matrix in permission model (224)

---

## SUBAGENT ALLOCATION PLAN

Research agents are DONE (reports merged above). Suggested build-time split
(max 3 concurrent, disjoint write scopes):

- **Agent A — Data/API layer:** items 6–30, 63–66, 73, 84–99, 224–233,
  255–261, 266–268 (migrations, storerooms, sensors, permission matrix,
  API routes, deploy/DB plumbing)
- **Agent B — UI/UX + mobile:** items 31–44, 100–111 scan UX, 234–240
  RBAC admin UI, 241–250, 276–299 (pages, components, landing, mobile/PWA,
  toggle audit, playtest pass)
- **Agent C — Integrations/reports:** items 53–62, 67–72, 75, 90, 92,
  262–265, 269–276, 314–319, 328–330, 335–340 (PDF, MCP, AI, webhooks,
  email, sensor simulator, monitoring console, sample kit, principles,
  scheduled reports, connectors)
- **Agent D (Phase 6, later wave) — Rust offline:** items 300–313
  (Tauri shell, Axum+SQLite backend, shared API contract, offline tiers,
  sync engine, installer, quality gates)
- **Agent E (Phase 2l/2m data layer) — market-fit + packs schema:**
  items 320–327, 331–334, 341–358, 359–371 (Kardex, BOM cascade,
  case-scan, transfer lifecycle, sub-location persistence, booking
  calendar, custody axes, lending lifecycle, kits, WO linkage, PM,
  depreciation, forecasting, pick paths, RFID, inter-warehouse, cert
  gating, LOTO, telematics, connector health, pack framework,
  provisioning wizard items 372–385, persona/audit/reporting items
  386–399)

Phase 2a (tech debt) runs FIRST solo — it touches files everyone else uses.
Phase 2i scan-security items (100–111) and 2k permission matrix (224–233)
land with 2b/2d schema work, not after — labels minted before hardening
ships are forgeable, and permissions must exist before features gate on them.

## ACCEPTANCE CRITERIA

Status legend: ✅ verified live · ⏳ owner/hardware-gated · 🚧 roadmap ·
➖ superseded by the clean-slate reboot.

- [x] `npx tsc --noEmit` clean ✅
- [x] `npx eslint . --max-warnings=0` clean ✅
- [x] `npm run build` green env-free ✅ (dummy `DATABASE_URL`; PGlite
      standalone also verified)
- [x] Every `app/api/**` route: auth + Zod + role check ✅ (401/403
      exercised in the click audit — 44 flows)
- ➖ RLS policies per table — superseded: vanilla Postgres + app-layer
      permission matrix is the primary check (Phase 0 reboot); RLS remains
      documented optional defense-in-depth
- [x] MCP endpoint live w/ scoped keys; smoke-tested tools ✅ (13 tools,
      `initialize` + `tools/list` verified)
- [x] Typst PDF renders a real report w/o Chromium ✅
      (`/api/reports/inventory-valuation`, real seeded data, 2 pages)
- [x] Landing page + dashboard screenshots captured ✅ (real authenticated
      captures in `public/screenshots/`, refreshed after the theme pass)
- [ ] Mobile web + PWA verified on real budget device ⏳ needs owner's
      physical device
- [x] Self-hosted path verified ✅ via the documented fallback — Docker was
      unavailable locally; the PGlite embedded path (`npm run
      dev:standalone`, zero services) is verified and documented
- [ ] Rust offline artifact 🚧 Phase 6 roadmap — not started
- [ ] Full local walkthrough rehearsed on constrained/old hardware — BOTH
      artifacts ⏳ needs hardware + the Rust artifact
- [x] Admin monitoring console working; NO telemetry/beacon ✅ (monitoring,
      users, audit log all live; zero outbound phone-home code exists)
- [x] No secrets; AGPL code never copied; license intact ✅ (scan clean;
      CC BY-NC-SA 4.0)
- [x] README accurate; seed creds documented as seed-only ✅
- [ ] Owner flips repo public + template manually ⏳ owner action

### Build status by phase (audited)

| Phase | Status |
|---|---|
| 1a–1b research | ✅ done (docs/research + logic-chain) |
| 2a tech debt | ✅ done — as Phase 0 reboot: Postgres+Drizzle+Auth.js |
| 2b stock engine | ✅ ledger + Kardex + reconciliation (41/41 in click audit) |
| 2c workflows | 🚧 partial — core receive/issue/count/loan; transfers/kits pending |
| 2d UX | 🚧 partial — responsive, provisioning banner, re-themed |
| 2e labels/scan | ✅ scan engine + HMAC labels + scan UX |
| 2f docs/PDF | ✅ Typst valuation report; more report types pending |
| 2g API/MCP | ✅ REST v1 + scoped keys + MCP + OpenAPI/llms.txt |
| 2h auth/security | ✅ Auth.js + argon2id + append-only audit (DB-enforced) |
| 2i storerooms | ✅ rooms, zones, sensors, thresholds, simulator |
| 2j industry pain-points | 🚧 roadmap |
| 2k RBAC | ✅ permission matrix + personas + forbidden gate |
| 2l/2m market fit + packs | 🚧 framework seeded via wizard; packs pending |
| 2n provisioning | ✅ 4-step wizard + feature flags + preview |
| 2o personas/audit/reports | ✅ personas + append-only audit + verify-ledger; report builder pending |
| 3 branding/go-live | ✅ README, screenshots, LICENSE, CI, templates |
| 4 deployment | ✅ docker-compose + PGlite + Vercel/Supabase runbook (hosted copy needs owner's Supabase project) |
| 5 mobile/PWA | 🚧 installable shell; offline write-queue + device test pending |
| 6 Rust offline | 🚧 roadmap |
