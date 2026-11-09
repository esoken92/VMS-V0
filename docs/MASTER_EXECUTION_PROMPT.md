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
98. Dry-run/demo sensor simulator — generates realistic temp/humidity/door
    data so the feature demos without hardware
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
    demo dataset manifest-owned, banner-marked, one-click verified removal,
    demo activity never fires alerts/webhooks
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
245. **Demo-mode reset button** — one click reseeds demo data (critical for
    live demos/screenshots; admin-only, confirm-gated).
246. `DEMO.md` presenter script — 5-minute flow: login → scan → stock take →
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

## PHASE 4 — DEPLOYMENT, ON-PREM & LOCAL DEMO

*The system is free and runs on the client's OWN internal/intranet
infrastructure — including old/broken kit. It must be solid, hardened,
role-based, and monitorable by the client company. Cloud (Vercel+Supabase)
remains one option; self-hosted is the differentiator.*

**Deployment architecture:**

255. **ADR: deployment options** — `docs/DEPLOYMENT.md` comparing:
    (a) Vercel + Supabase Cloud (managed, easiest),
    (b) Docker Compose self-host (Next standalone + self-hosted Supabase:
    Postgres, GoTrue auth, PostgREST, Storage — the official Supabase
    self-host path),
    (c) Desktop wrapper (Tauri/Electron shell auto-starting local server —
    "runs on the client's PC" feel),
    (d) Embedded-DB single-process path (evaluate `@electric-sql/pglite`
    WASM-Postgres or SQLite adapter — research before committing; Supabase
    auth/RLS coupling makes this the risky option, document honestly)
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
268. **First-boot wizard** — set admin password (force-change on demo
    creds), org name, timezone, currency, demo-data on/off
269. **Security hardening for LAN** — bind-address config, TLS via
    self-signed or LAN cert guide, forced credential change, rate limits,
    service-role never leaves server env
270. **Uninstall/clean-removal docs** — removes containers, volumes, data
    dir; no orphaned services
271. **Troubleshooting guide** — common old-infra issues: port conflicts,
    low RAM, Windows firewall, Docker Desktop licensing on old Windows,
    WSL2 requirements, proxy environments

**Local demo & rehearsal (BEFORE go-live):**

272. **Local demo kit** — `docker compose up` OR `npm run dev` reproduces
    the FULL demo incl. seed data; works offline; DEMO.md script runs
    end-to-end (login → scan → stock take → MCP query → PDF report)
273. **Old-hardware rehearsal** — actually run the complete demo on a
    constrained VM/old machine; record results; fix what breaks; this is
    a go-live gate, not optional
274. **Smoke-test suite** — `scripts/smoke.mjs` hits key routes + API +
    MCP tool calls + PDF render; run in CI and before every demo
275. **Demo data portability** — seed + demo-reset work identically in
    cloud and self-hosted modes; demo never requires internet

---

## PHASE 5 — MOBILE, PWA & CROSS-DEVICE

*The floor worker's primary device is a phone or tablet — often a budget
Android on a bad connection. Mobile web must be first-class, not an
afterthought; the PWA should feel like a native app without an app store.*

276. **Mobile-first responsive web** — every page usable one-handed on a
    360px screen; tables collapse to cards, filters become bottom sheets,
    forms stack; desktop gets the dense layout
277. **Installable PWA** — manifest + icons + splash screens +
    `display:standalone`; next-pwa already configured — finish it:
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

**Local playtest & UI sanity pass (manual, before every demo AND go-live):**

295. **Full click-through playtest** — run `npm run dev` locally and
    manually click EVERY route and flow as each demo role: landing →
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
    before demo + before public flip

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
  262–265, 269–276 (PDF, MCP, AI, webhooks, email, sensor simulator,
  monitoring console, demo kit)

Phase 2a (tech debt) runs FIRST solo — it touches files everyone else uses.
Phase 2i scan-security items (100–111) and 2k permission matrix (224–233)
land with 2b/2d schema work, not after — labels minted before hardening
ships are forgeable, and permissions must exist before features gate on them.

## ACCEPTANCE CRITERIA

- [ ] `npx tsc --noEmit` clean
- [ ] `npx eslint . --max-warnings=0` clean
- [ ] `npm run build` green env-free
- [ ] Every `app/api/**` route: auth + Zod + role check
- [ ] RLS: every table has policies; `manager` gap closed; `(select auth.uid())`
- [ ] MCP endpoint live w/ scoped keys; smoke-tested tools
- [ ] Typst PDF renders a real report w/o Chromium
- [ ] Landing page + dashboard screenshots captured
- [ ] Mobile web + PWA verified on real budget device (scan, stock take,
      receive, approve flows one-handed)
- [ ] Self-hosted path verified: `docker compose up` (or documented
      fallback) runs full demo offline on LAN
- [ ] Full local demo rehearsed end-to-end on constrained/old hardware —
      go-live gate
- [ ] Admin monitoring console working (health, users, sync, storage);
      NO telemetry/beacon of any kind — free open-use product, zero
      outbound phone-home
- [ ] No secrets; AGPL code never copied; license intact
- [ ] README accurate; demo creds documented as demo-only
- [ ] Owner flips repo public + template manually
