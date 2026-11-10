# Pain-Points Audit — research-driven gap analysis

> **Scope:** `docs/MASTER_EXECUTION_PROMPT.md` §2j "Industry pain-point features"
> (items **126–152** cold-chain/expiry/compliance, items **153–164** inventory
> accuracy & receiving), §2l **anti-complaint principles 314–319**, and §2l
> **gap-closure features 320–340**. Fleet-parts/IT-asset items 165–183 are a
> separate 2j subsection and are out of scope for this pass.
>
> **Method:** every claim below was verified against the code, not the docs.
> Evidence cites `file:line`. Docs that overclaim are called out in
> §5 "Doc-vs-code drift".
>
> **Evidence base:** `docs/research/01-buyer-wants.md`,
> `02-customer-complaints.md`, `03-github-sweep-2.md`,
> `04-industry-verticals.md`.
>
> Audited: 2026 — repo state at HEAD `5c8751f` (IndexedDB offline queue).

## Scoreboard

| Section | Items | ✅ Implemented | 🚧 Partial | ❌ Missing |
|---|---|---|---|---|
| Cold-chain, expiry & compliance (126–152) | 27 | 2 | 5 | 20 |
| Inventory accuracy & receiving (153–164) | 12 | 0 | 1 | 11 |
| Anti-complaint principles (314–319) | 6 | 2 | 4 | 0 |
| Gap-closure features (320–340) | 21 | 3 | 5 | 13 |
| **Total** | **66** | **7** | **15** | **44** |

The honest summary: the *platform substrate* for these features is strong —
idempotent sensor ingest, a real alert-rule engine with dwell, an append-only
ledger with machine-checkable reconciliation, paired transfer legs, and
transactional kit assembly all exist and are correct. What does **not** exist
is almost everything the research says buyers *feel*: the lot/expiry data
model, the receiving workflow, count→ledger reconciliation, import, export,
and the custody/booking layer.

---

## 1. Cold-chain, expiry & compliance (items 126–152)

### What exists (verified)

- **Room model.** `storerooms` table with 13 types, `temp_min`/`temp_max`,
  `access_level`, `allowed_roles`, `item_allowlist`, `feature_toggles`,
  `quarantine` — `drizzle/0003_storerooms.sql:74-91`,
  `drizzle/storerooms-schema.ts:95-135`. Type presets with sane defaults
  (cold 2–8°C, frozen −25…−15°C, etc.) — `lib/storerooms/room-types.ts:168-312`.
- **Sensor ingest.** `POST /api/sensors/ingest` — Bearer `SENSOR_API_KEY`
  (constant-time compare) or session; Zod-validated batch ≤500; ±30-day
  timestamp bound — `app/api/sensors/ingest/route.ts:42-99`,
  `lib/storerooms/sensor-auth.ts:35-48`. Idempotent on
  `UNIQUE(room_id, device_id, metric, recorded_at)` + `ON CONFLICT DO NOTHING`
  — `lib/storerooms/ingest.ts:45-63`, `drizzle/0003_storerooms.sql:121-131`.
- **Alert rules.** Per-room per-metric `above`/`below` threshold + severity +
  `dwell_minutes` + `notify_roles` — `drizzle/0003_storerooms.sql:144-156`;
  CRUD via `upsertAlertRule`/`deleteAlertRule` —
  `lib/actions/sensors.ts:411-473`.
- **Sustained-breach dwell engine.** `isSustainedBreach` — a streak of
  breaching readings must span ≥ dwell before an alert opens —
  `lib/storerooms/alerts.ts:55-101`, evaluated in the ingest transaction at
  `lib/storerooms/alerts.ts:107-205`.
- **Alert lifecycle.** active → acknowledged → resolved with one-live-alert-
  per-rule enforced by partial unique index `uq_alerts_one_open_per_rule` —
  `drizzle/0003_storerooms.sql:196-198`; `acknowledgeAlert`/`resolveAlert`
  (manager+) — `lib/actions/sensors.ts:299-359`.
- **Monitoring dashboard.** Per-room cards (latest temp/humidity, staleness,
  temp status vs range, open alert count) + stale-sensor card + per-room
  `ClimateChart` — `app/dashboard/monitoring/page.tsx`,
  `lib/actions/sensors.ts:111-211`.
- **Simulator.** Realistic temp/humidity/door telemetry, `?excursion=1`
  forces a breach through the *same* ingest path — admin only —
  `lib/storerooms/simulator.ts`, `app/api/sensors/simulate/route.ts`.
- **Feature toggles gate behaviour**, not just UI: `threshold_alerts: false`
  skips rule evaluation — `lib/storerooms/alerts.ts:116-125`.

### Item-by-item

| # | Item | Verdict | Evidence / what's missing |
|---|---|---|---|
| 126 | Per-zone temp thresholds | 🚧 | Room-level rules exist (`alert_rules`, `storerooms.temp_min/max`). **Missing:** product-class ranges (no per-SKU temp profiles exist anywhere — see 133). |
| 127 | Sustained-breach excursion dwell | ✅ | `isSustainedBreach` — `lib/storerooms/alerts.ts:55-101`; `dwell_minutes` column — `drizzle/0003_storerooms.sql:149`. |
| 128 | Door-aware monitoring | 🚧 | `door` metric + `door_monitoring` toggle + simulator events (`lib/storerooms/room-types.ts:38`, `simulator.ts:127-130`). **Missing:** open-duration alerting, tolerance extension while door open, door events linked to stock audit entries. |
| 129 | Hard-limit immediate trip | 🚧 | Achievable in config — a second rule with `dwell_minutes: 0` + `severity: critical` alerts instantly (`lib/actions/sensors.ts:405-408`). **Missing:** first-class hard-limit concept distinct from soft threshold; nothing documents/tests the pattern. |
| 130 | Monitoring-gap alerts | 🚧 | `listStaleRooms(minutes)` — `lib/actions/sensors.ts:193-211`; stale card on monitoring page (`STALE_MINUTES = 30`, `app/dashboard/monitoring/page.tsx:37`). **Missing:** detection is dashboard-only — no `alerts` row/incident is raised when a sensor goes silent, so nothing notifies. |
| 131 | Excursion incident object | ❌ | `alerts` rows are the only incident object — no affected-SKU/lot linkage, no open→quarantined→investigated→released workflow, no PDF export. |
| 132 | Auto-quarantine on excursion | ❌ | `storerooms.quarantine` flag exists (`drizzle/0003_storerooms.sql:87`) but nothing sets it on excursion — and nothing reads it to block picks anyway (all issue paths ignore the flag). |
| 133 | Product stability profiles | ❌ | No per-SKU excursion magnitude/duration data — there is no per-product temperature model at all. |
| 134 | Per-zone climate dashboard | ✅ | `listRoomStatuses` per-room latest temp/humidity, staleness, open-alert count — `lib/actions/sensors.ts:111-190`; `ClimateChart` on `app/dashboard/rooms/[id]/page.tsx` + monitoring page. (Shows configured min/max, not computed mean/sparkline — close enough for ✅ with that caveat.) |
| 135 | Digital temp logs (PDF/CSV) | ❌ | Readings are queryable (`getRoomReadings`, `/api/sensors/readings`) but no per-zone/day log artifact or export exists. |
| 136 | Goods-in temp gate | ❌ | No receiving workflow exists at all — `receiving_documents`/`receiving_items` are dead schema (see §5). |
| 137 | Cleaning/sanitation scheduler | ❌ | No task/checklist tables or actions. |
| 138 | Pest/facility inspections | ❌ | Same — nothing. |
| 139 | Zone segregation enforcement | ❌ | `item_allowlist` is stored (`drizzle/0003_storerooms.sql:85`, editable via `updateRoomAccess` `lib/actions/storerooms.ts:448-486`) but **never read by any write path** — transfers/movements into a room ignore it entirely. |
| 140 | One-click audit pack | ❌ | No bundled monitoring+deviation+corrective-action export. |
| 141 | Lot/batch genealogy | ❌ | No lot/batch/expiry columns exist in the schema (verified: zero `expiry_date`/`batch`/`lot`/`serial_number` columns in `drizzle/schema.ts` + `drizzle/storerooms-schema.ts`). |
| 142 | Recall trace (bidirectional) | ❌ | Depends on 141. |
| 143 | Recall impact dashboard | ❌ | Depends on 141. |
| 144 | FEFO pick enforcement | ❌ | Declarative only — the setup wizard stores `expiry_policy: enforce_fefo*` / `picking_strategy: fefo` in `instance_config` (`lib/features.ts:106-120`, `lib/actions/provisioning.ts`), and an `fefo` feature flag is derived (`lib/features.ts:266-272`), but **no code path reads it** — there are no expiry dates to sort by and no pick path enforces anything. |
| 145 | Expiry required at receiving | ❌ | No expiry field, no receiving flow. |
| 146 | Expiry-risk dashboard | ❌ | No expiry data. |
| 147 | Returns quarantine | ❌ | A `returns` room *type* exists (`lib/storerooms/room-types.ts:292-299`) but there is no returns workflow that routes stock into it. |
| 148 | Door-open analytics | 🚧 | Door events are ingested and chartable like any metric. **Missing:** open count/duration aggregation by shift/door, excursion correlation. |
| 149 | Dock appointment scheduling | ❌ | Nothing. |
| 150 | Staging dwell timer | ❌ | Nothing — `staging` is a room type only. |
| 151 | Cold-chain handoff check | ❌ | Nothing. |
| 152 | Energy proxy report | ❌ | Nothing. |

**Subtotal: ✅ 2 (127, 134) · 🚧 5 (126, 128, 129, 130, 148) · ❌ 20**

The storey: monitoring *telemetry* is real and well-built; cold-chain
*compliance* (excursion→quarantine→disposition→evidence) is entirely absent,
as is the lot/expiry data model that half these items presuppose.

---

## 2. Inventory accuracy & receiving (items 153–164)

### What exists (verified)

- **Stock takes.** `stock_takes`/`stock_take_items` (product-level, unique
  per take+product) — `drizzle/schema.ts:320-351`. Start/save/complete via
  `lib/actions/stock-takes.ts`. `system_qty` is snapshotted from live
  `current_stock` at the moment counts save (`upsertCounts`,
  `stock-takes.ts:134-139`) — which incidentally avoids the "mid-count move
  corrupts the snapshot" complaint pattern, since expected qty is read at
  count-upload time, not take-open time.
- **Counting UI** does not render expected qty during entry ("blind" in
  display) — `app/dashboard/stock-takes/page.tsx:230-245`.

### What does NOT exist

- **Variance never posts.** `completeStockTake` records `variance` on each
  item row and returns `total_variance` — and stops. **No `adjustment`
  movement is ever written** (`lib/actions/stock-takes.ts:215-255` — verified,
  no `stockMovements` insert anywhere in the file). The physical count
  therefore cannot change `current_stock`; the only correction path is a
  manual adjustment via the movements page. This silently breaks the
  "count → reconcile" loop that every accuracy item in this block assumes.
- **No approval, no recount, no reason codes, no scheduling, no bin scope.**

### Item-by-item

| # | Item | Verdict | Evidence / what's missing |
|---|---|---|---|
| 153 | ABC-tiered cycle counts | ❌ | No ABC classification, no scheduled count generation; takes are ad-hoc `startStockTake` (`lib/actions/stock-takes.ts:90`). |
| 154 | Variance approval workflow | ❌ | Variance is recorded but there is no approval state or manager sign-off — and nothing to approve, since variance never posts (above). |
| 155 | Auto-recount by different counter | ❌ | Nothing. |
| 156 | Root-cause codes + IRA% analytics | ❌ | `stock_take_items` has no reason/root-cause column (`drizzle/schema.ts:331-351`); no accuracy analytics. |
| 157 | Location discipline | 🚧 | Per-bin stock is real (`product_stock` projection, `014_transfers_kits.sql:61-113`) and `listBinStock` serves the transfer UI (`lib/actions/transfers.ts:206`). **Missing:** `stock_take_items` has no bin column — counts are product-level only; no mis-slot detection/report. |
| 158 | Adjustment approval gates | ❌ | Any role passing `canCreateMovement(role,'adjustment')` posts directly (`lib/actions/stock-movements.ts:79-86`, `lib/auth/permissions.ts:169-174`). |
| 159 | Dock-to-stock timer | ❌ | `receiving_documents.expectedAt/receivedAt` columns exist but nothing writes them (dead schema — §5). |
| 160 | Receiving line checklist | ❌ | `receiving_items.damageReport`/`photoUrl`/`receivedQuantity` columns exist (`drizzle/schema.ts:254-274`) — no action, route, or page writes them. |
| 161 | ASN matching | ❌ | No ASN data or receiving flow. |
| 162 | Supplier scorecards | ❌ | `suppliers` is name/contact only (`drizzle/schema.ts:123-131`); no metrics. |
| 163 | Scan-to-bin putaway verify | ❌ | Scanning a bin resolves a `set_location` action (`lib/scan/engine.ts:374`) but there is no suggested-vs-actual putaway comparison and no mis-slot tracking. |
| 164 | Damage/shortage claims | ❌ | Photo upload exists (`/api/uploads`, `app/api/uploads/route.ts` — used for scrap images on the movements page); `receiving_items.damageReport`/`photoUrl` unused; no claim doc. |

**Subtotal: ✅ 0 · 🚧 1 (157) · ❌ 11**

The storey: this whole block is the weakest in the audit. The ledger and
count mechanics exist, but the *accuracy loop* (count → variance → approve →
post → root-cause) and the *receiving* surface (docs, checklist, ASN,
dock-to-stock, claims) are missing — including the variance-posting step the
count flow visibly promises.

---

## 3. Anti-complaint principles (items 314–319)

These are commitments, not features — judged on whether the codebase *keeps*
the promise today.

| # | Principle | Verdict | Evidence |
|---|---|---|---|
| 314 | No per-seat/per-order/per-asset pricing | ✅ | Structural — free, self-hosted, CC BY-NC-SA; zero billing/metering code (`docs/INTEGRATIONS.md:67` "no payments/billing — there is nothing to meter"). Unlimited users; no seat concept in `profiles`. |
| 315 | No feature paywalls | ✅ | Everything ships in base; the provisioning wizard *hides* features (`lib/features.ts` flags gate UI visibility) but nothing is license-gated or tiered. |
| 316 | Full data portability, forever | 🚧 | **Has:** client-side CSV export on reports (`app/dashboard/reports/page.tsx:85-90`), audit log (`app/dashboard/audit-log/page.tsx:44-49`), every report-builder dataset (`app/dashboard/reports/builder/page.tsx:72-79`); full REST read surface — products, stock, movements, loans, takes, low-stock, audit, reconciliation (`app/api/v1/*`, `lib/api/openapi.ts:211-430`); MCP `run_report` tool (`lib/mcp/tools.ts:285`). **Missing:** no one-click full-dataset export (JSON/ZIP), no export covering transfers/kits/storerooms/sensors/settings — v1 API doesn't expose those tables at all. |
| 317 | No silent failures | 🚧 | **Mostly holds:** every action returns a typed `Result<T>` (`lib/result.ts`); ingest rejects bad payloads 400; scan failures land in `scan_events` with `flag_reason` (`lib/scan/engine.ts:446-457`); offline queue failures surface a visible chip ("N could not sync — check permissions", `app/dashboard/scan/page.tsx:358-361`). **Gap:** a permanently-failed queued movement is *deleted* from the IDB queue (`lib/offline/queue.ts:96-99,109-112`) — the user sees a counter, but the failed row's payload is gone with no error queue to retry/fix it. No sync-error queue exists (item 338). |
| 318 | Mobile at parity | 🚧 | Scan page is mobile-first and offline-aware (`app/dashboard/scan/page.tsx`, 811 lines); dedicated `/scan` entry (`app/scan/page.tsx`); PWA installable (`public/sw.js`). **Missing:** no mobile task shell/bottom-nav; admin surfaces are desktop-dense tables; no evidence of a mobile-parity audit for forms like transfers/kit building. |
| 319 | Sub-day onboarding | 🚧 | `npm run dev:standalone` = zero-install embedded PGlite + auto-seed (`scripts/dev-standalone.ts`, README quickstart); provisioning wizard with industry packs + server-computed preview (`app/dashboard/setup/page.tsx`, `lib/actions/provisioning.ts:163-248`). **Missing:** no CSV import to bring real data (nothing to validate), no guided first-task flow; "signup → first real scan" path is undocumented. |

**Subtotal: ✅ 2 (314, 315) · 🚧 4 · ❌ 0**

The storey: pricing/honesty principles hold structurally. The two
*operational* promises — "your data is yours" and "no silent failures" —
are partially kept: export covers ~half the data model, and the offline
queue drops un-replayable rows instead of parking them in an error queue.

---

## 4. Gap-closure features (items 320–340)

| # | Item | Verdict | Evidence / what's missing |
|---|---|---|---|
| 320 | Kardex / stock-ledger report | ✅ | `getKardex` — running-balance ledger + `opening + Σ movements = closing` reconciliation summaries — `lib/actions/kardex.ts:55-113,125-231`; UI at `app/dashboard/ledger/page.tsx`; same math on `GET /api/v1/reconciliation` (`app/api/v1/reconciliation/route.ts`) and `scripts/verify-ledger.ts:38-128`. |
| 321 | BOM/kit cascade | 🚧 | `product_components` BOM (`drizzle/014_transfers_kits.sql:205-216`, `drizzle/schema.ts:502-519`); `assembleKit`/`disassembleKit` post `kit_consume`/`kit_produce` legs in ONE transaction with row locks + insufficient-stock throw — `lib/actions/kits.ts:30-68,226-321`. Self-reference rejected (`kits.ts:167-168` + DB `CHECK`). **Missing:** multi-level BOMs — explicitly rejected (`kits.ts:175-176,196-198` "nested kits are not supported"). Correct-by-construction ✓ but single-level only. |
| 322 | Case/pack-level scanning | ❌ | No pack-size/UOM conversion on scan — `scanQuickReceive`/`scanQuickIssue` take a flat `quantity` (`lib/actions/scan.ts:127-194`). `unit_conversions` table exists but nothing reads it (dead schema). |
| 323 | Transfer lifecycle hardening | 🚧 | Real doc lifecycle `draft→dispatched→received|cancelled` with paired ±legs through an `IN-TRANSIT` system bin — visible to both sides, cancel returns stock (`lib/actions/transfers.ts:40-96,318-560`; `drizzle/014_transfers_kits.sql:117-160`). **Missing:** partial receipt — `receiveTransfer` books the full `dispatched_quantity` (`transfers.ts:437-459`); no per-line damage/loss disposition; no in-transit aging view. Orphan-prevention ✓ (paired legs in one tx). |
| 324 | Sub-location survives zero qty | ✅ | `product_stock` rows are only ever `quantity += delta` by trigger — never deleted at 0 (`drizzle/014_transfers_kits.sql:81-113`); `CHECK (quantity >= 0)` guards, no delete path. Bins outlive zero stock. |
| 325 | Reservation/booking calendar | ❌ | No reservations/booking/slot tables or actions anywhere (verified: zero hits for reservation/booking in `lib/`, `app/`, `drizzle/`). |
| 326 | Request-and-approve checkout | ❌ | `checkOutTools` writes the loan immediately (`lib/actions/tool-loans.ts:96-153`) — no request→approve→issue flow. |
| 327 | Bulk "move all" transfers | ✅ | `moveAllBinContents` — relocates a whole bin as one completed transfer posting full paired legs, history preserved (`lib/actions/transfers.ts:562-657`). |
| 328 | Scheduled report exports | ❌ | No scheduler/cron; reports are on-demand only (`lib/actions/custom-reports.ts`, `lib/reports/datasets.ts`). |
| 329 | Report performance budget | 🚧 | Bounded queries (`ROW_CAP = 2000`, `lib/reports/datasets.ts:25`), indexed movement/audit columns (`drizzle/schema.ts:310-317,373-377`), server-side aggregates. **Unverified:** no evidence of 100k-row benchmarking; `buildSummaries` scans full movement history per call (`lib/actions/kardex.ts:70-84`). |
| 330 | Fuzzy instant search | 🚧 | Case-insensitive substring on SKU+name via `ilike %q%` — kills the "capital letter = zero results" failure mode (`lib/api/data.ts:144-147`; scan lookup is lower-cased, `lib/scan/engine.ts:202`). **Missing:** not typo-tolerant (no pg_trgm/fuzzy), no cross-entity one-box search. |
| 331 | "Due today" proactive alerts | ❌ | Dashboard surfaces overdue loans *after* the fact (`getDashboardStats` 7-day cutoff, `lib/actions/dashboard.ts:31,44-50`); alert preferences exist (`profiles.alert_low_stock/alert_overdue_tools`) but nothing sends anything — no notification engine. |
| 332 | Multi-UOM decimals | 🚧 | All quantities `DECIMAL(15,4)` (`drizzle/schema.ts:171,291,…`), fractional entry in forms (`step="0.01"`), `unit_of_measure`+`issuing_unit` per product, `unit_conversions` table present. **Missing:** the conversion table is dead — no code reads it; no case→each conversion math. |
| 333 | Project/job costing dimension | ❌ | No `project_code`/job field on movements or issues. |
| 334 | Grant/funding codes | ❌ | Nothing. |
| 335 | QuickBooks/Xero connector | ❌ | Nothing — not even CSV export shaped for journals (generic CSV exists). |
| 336 | E-commerce stock feeds | ❌ | `GET /api/v1/stock` is a generic pull endpoint — no push feed, channel map, or reservation model. |
| 337 | Shipping/carrier basics | ❌ | Nothing. |
| 338 | Sync error queue | ❌ | No error-queue entity; the only "sync" is the offline IDB queue which *drops* permanent failures (`lib/offline/queue.ts:96-112`) — see §3/317. |
| 339 | Import pre-commit validation | ❌ | **There is no CSV import at all** — verified: no import route/action/wizard; the `Upload` icon on the movements page is scrap-image upload (`app/dashboard/stock-movements/page.tsx:82,316`). |
| 340 | POS/marketplace hooks | ❌ | Nothing. |

**Subtotal: ✅ 3 (320, 324, 327) · 🚧 5 (321, 323, 329, 330, 332) · ❌ 13**

---

## 5. Top 10 gaps by research weight

Ranked by cross-referencing `02-customer-complaints.md` (theme frequency),
`01-buyer-wants.md` (deal-breakers), and `04-industry-verticals.md`
(M-priority requirements) — not gut feel.

| # | Gap (roadmap items) | Why it's top-weighted |
|---|---|---|
| 1 | **Lot/serial/expiry data model absent** (blocks 133, 141–146, 144, 8/16) | Biggest compound gap. Complaints O#51 "no lot/serial/expiry in base"; top-10 anti-complaint #7; buyer #16 (most-requested cluster) + #52 deal-breaker. M-priority in **five** verticals (pharma §1, healthcare §2, food §9, labs §8, cannabis). The provisioning wizard *sells* FEFO/expiry flags that no data can honour — currently a false-advertising risk, not just a gap. |
| 2 | **Count→ledger reconciliation missing** (154–158) | Counts record variance but never post it (§2). Complaints B#7–10 "counts don't match reality", Q#64 "counts stop the operation"; top-10 #5 approval gates; M in gov §4 (formal verification) + edu §3 (audit counts). The single most-damaging *silent* gap: a user finishes a count and stock doesn't change. |
| 3 | **No receiving workflow** (136, 145, 159–164) | `receiving_documents`/`receiving_items` are dead schema. Blocks the whole goods-in story — temp gate, line checklists, ASN, dock-to-stock, claims. M in hospitality §9 (receiving verification incl. temp), gov §4 (receipt into property book), pharma §1. |
| 4 | **No CSV import — let alone validated import** (339; undermines 319) | Complaints I#33–35 (mangled imports, migration trauma) is a whole category; top-10 #9 "sub-day onboarding + validated import"; buyer #28. You cannot onboard from a spreadsheet — the #1 incumbent the product exists to replace. |
| 5 | **No full-dataset export** (316) | Complaints L#41–43 hostage-data lock-in; top-10 #4 "one-click full export, forever"; buyer #14/#53 deal-breaker. Current CSV/API covers ~half the model (no transfers/kits/rooms/sensors/settings export). |
| 6 | **No sync/error queue; offline queue drops failed rows** (338, 317) | Complaint A#1–3 is the **#1 theme overall** ("sync corrupts silently") + E#20 offline conflict debt. Our IDB queue surfaces a chip but deletes the failed payload (`lib/offline/queue.ts:109-112`) — better than silent, short of the actionable retry/fix-mapping queue the research demands. |
| 7 | **No reservation / request-and-approve custody layer** (325, 326) | Buyer B#19–20 (booking windows, approve workflows); complaint O#54; top-10 custody workflows; M in edu §3 (checkout rules), healthcare §2 (loaner kits), construction §5 (crew checkout). Tool loans exist but are instant-write, no request step. |
| 8 | **No proactive/delivered alerts — engine has no output channel** (331, plus alert escalation) | Alert rules open DB rows only; nothing *notifies*. Complaints O#53 "users beg for due-today"; buyer #29; top-10 #12 notification engine. `notify_roles` is stored on rules and `alert_*` prefs on profiles — both unread. |
| 9 | **Multi-level BOM unsupported** (321) | Buyer #17 (multi-level + correct decrementing); complaint A#6 kit/component non-cascade; M in mfg §6 (where-used/BOM). Single-level assembly is correct-by-construction — the foundation is right, the depth is not. |
| 10 | **No accounting/connector surface** (335, 336, 340) | Accounting is the #1 integration ask (buyer E#71); complaints C#11–13 (QB drift, silent penny mismatches) is a whole category. Even the CSV-first version the item describes doesn't exist. |

**Honourable mentions:** transfer partial-receipt + damage disposition
(323 — complaint H#31–32); typo-tolerant search (330 — Homebox complaint);
per-room access/allowlist enforcement (139 — flags stored but ignored,
LOGIC_CHAIN overclaims).

---

## 6. Integrity check — do the invariants hold in code?

| Claim | Verdict | Evidence |
|---|---|---|
| `opening + Σ movements = current_stock` enforced | ✅ — with one caveat | `scripts/verify-ledger.ts:38-128` checks per-product AND per-bin (`product_stock`) drift + negative bins; same math in `lib/actions/kardex.ts:88-113` and `/api/v1/reconciliation`. Every stock write path posts a movement in the same tx: `recordStockMovement` (`stock-movements.ts:88-133`), `scanQuickReceive/Issue` (`scan.ts:138-264`), `upsertProduct` posts `receiving`/`adjustment` legs for deltas (`products.ts:163-196`), seed convention matches (`supabase/seed.sql:156-170`). **Caveat below.** |
| ⚠️ `tool_checkout` legs break the invariant while a scan-loan is open | 🚧 real wrinkle | `scanToolToggle` inserts a `tool_checkout` movement of −1/+1 but *deliberately* doesn't touch `current_stock` (`lib/actions/scan.ts:279-291,376-384`). `verify-ledger` sums **all** movements → an open scan-checkout shows drift −1 until returned. Worse, three paths disagree: page `checkOutTools` writes **no** movement (`tool-loans.ts:136-146`), scan writes a movement **without** a stock update, and `recordStockMovement(type:'tool_checkout')` writes a movement **and** updates stock (`stock-movements.ts:83-86`). Pick one semantics — today the invariant holds only because seeded loans write no legs. |
| Paired transfer legs can't orphan stock | ✅ | `postTransferLegs` writes −source/+transit and −transit/+dest pairs inside one transaction (`lib/actions/transfers.ts:69-96`); `IN-TRANSIT` system bin (`014_transfers_kits.sql:121-126`); availability re-validated under `FOR UPDATE` (`transfers.ts:349-364`); cancel returns dispatched qty to source (`transfers.ts:519-543`); smoke-tested by `scripts/verify-transfers.ts`. |
| Kit consume/produce is atomic | ✅ | `postKitLeg` locks the product row, throws on negative, posts leg + updates stock in-tx (`lib/actions/kits.ts:30-68`); whole assembly in one `db.transaction` (`kits.ts:236-268`). |
| `product_stock` is trigger-only, non-negative | ✅ | `product_stock_projection()` trigger is the only writer (`014_transfers_kits.sql:81-114`); `CHECK (quantity >= 0)` + raise on drawing from an empty bin (`014…:64,96-100`); bin-level drift covered by `verify-ledger.ts:81-128`. |
| `current_stock` "never written directly" | 🚧 nuance | `products.current_stock` **is** a cached counter updated by app code — but always inside the same transaction as its ledger row, so Σ stays equal. `ARCHITECTURE.md:89-90` ("never a column you update") is aspirational phrasing; the *effective* invariant (ledger explains the counter) is real and machine-checked. |
| `activity_logs` append-only | ✅ | DB-level triggers raise on UPDATE/DELETE/TRUNCATE — `013_audit_append_only.sql:7-26` (REVOKE insufficient as owner bypasses grants — handled correctly). Field-level before/after via `audit_trigger_func` on audited tables. |
| Scan integrity (hardened input) | ✅ | `scan_events` row on **every** attempt incl. failures (`lib/scan/engine.ts:414-457`); raw payload never stored — sha256 only (`lib/scan/codes.ts:34-36`); HMAC-signed label tokens verified sig+expiry+nonce (`lib/scan/tokens.ts`, `engine.ts:499-538`); label reprint rotates/consumes prior token (`app/api/labels/[type]/[id]/route.ts` header comment); manual entry capped 30/min (`lib/scan/rate-limit.ts:13-14`); impossible-velocity flag within 60s (`engine.ts:50,424-443`); input normalized/capped/control-stripped (`codes.ts:23-31`). |
| Idempotent ingest | ✅ | `UNIQUE(room_id,device_id,metric,recorded_at)` + `ON CONFLICT DO NOTHING` (`lib/storerooms/ingest.ts:45-63`); replays are no-ops, only fresh rows feed alerts. |
| "No silent failures" | 🚧 | Mostly holds — typed `Result` everywhere, flagged scan anomalies, visible offline chip. **But** two real holes: (a) permanently-failed queued movements are deleted with no record (`lib/offline/queue.ts:96-112`); (b) `POST /api/v1/movements` has **no idempotency key** — a replayed offline write after a lost response double-posts stock (`lib/api/data.ts:386-427`). |
| Data portability | 🚧 | CSV export on 3 surfaces + full REST read API + MCP `run_report`; **no** full-dataset export; v1 omits transfers/kits/storerooms/sensors (`app/api/v1/` route list, `lib/api/openapi.ts:211-430`). |
| Sensor→alert path honest | ✅ | Simulator feeds the real ingest path, not a stub (`app/api/sensors/simulate/route.ts`, `lib/storerooms/simulator.ts:1-18`); alert evaluation is gated by the room's own `threshold_alerts` toggle (`lib/storerooms/alerts.ts:116-125`). |

---

## 7. Doc-vs-code drift found during the audit

Claims in docs that the code does not back (or is stale):

1. **`docs/ARCHITECTURE.md:82`** — "`stock_takes`… blind counts, *variance
   posting*": variance is computed and stored but **never posted** to the
   ledger (§2). And "blind" is only display-deep — the page fetches the full
   product list including `current_stock` client-side
   (`app/dashboard/stock-takes/page.tsx:20,47-53`).
2. **`docs/ARCHITECTURE.md:77,81`** — `unit_conversions` and
   `receiving_documents`/`receiving_items` are listed in the live data-model
   table; both are **dead schema** — zero writers/readers outside
   `drizzle/schema.ts` and type defs.
3. **`docs/INTEGRATIONS.md:59`** — references `docs/SENSORS.md` for ESP32/MQTT
   examples: **that file does not exist**.
4. **`docs/ARCHITECTURE.md:19`** — "templates in `lib/pdf/typst/`": actual
   path is `lib/pdf/` (`compiler.ts`, `label.ts`, `templates/`). Also line
   17's "offline write queue is roadmap work" is **stale** — the IDB queue
   shipped (`lib/offline/queue.ts`, commit `5c8751f`), and `README.md`'s
   "offline write-path is roadmap work" line is stale for the same reason.
5. **`docs/LOGIC_CHAIN.md:67-70`** — "manager can approve variances" and
   "manager of the cold room is not manager of everything": **neither exists**.
   No variance approval; `storerooms.allowed_roles`/`access_level` are stored
   and editable but never evaluated in any action or route.
6. **`docs/PLAYTEST.md`** — "Variance surfaces for review *before posting*":
   there is no posting step (variance is a stored scalar only).
7. **`supabase/seed.sql:219`** — seeded `feature_toggles` use unknown keys
   (`scan_required`, `photo_on_entry`, `sensor_monitoring`, `door_sensor`,
   `capacity_alerts`…) that don't exist in the closed `ROOM_FEATURES`
   catalog (`lib/storerooms/room-types.ts:88-134`); `sanitizeToggles`
   (`lib/actions/storerooms.ts:81-89`) silently strips them on first save —
   seeded rooms display capabilities the catalog never defined.
8. **Provisioning flags vs reality** — the wizard can produce
   `fefo`/`expiry`/`serialization` feature flags and
   `expiry_register`/`serial_register` report packs
   (`lib/features.ts:266-272,351-364`), but no expiry/serial data exists.
   Flags hide UI; they cannot create the columns.
9. **`lib/actions/sensors.ts` rule `notify_roles`** and
   **`profiles.alert_low_stock`/`alert_overdue_tools`** — stored and
   editable (`app/dashboard/profile/page.tsx`) but no delivery mechanism
   reads either. Configuration surface without an engine behind it.

---

## 8. What to build first (audit-derived, not a plan)

The evidence converges on sequencing, not breadth:

1. **Post variance on stock-take completion** (movement `adjustment` legs +
   optional approval gate) — smallest change that fixes the most damaging
   silent gap (#2 above), ~one action file.
2. **Receiving doc writer** — wake up `receiving_documents`/`receiving_items`
   (schema already exists) so goods-in items 136/159–164 have a home (#3).
3. **Lot/expiry columns + FEFO sort** — the data-model unlock for the largest
   complaint cluster (#1); everything else in the cold-chain block depends on it.
4. **Full-dataset export + import-with-dry-run** — the portability/onboarding
   pair (#4, #5) that the top-10 anti-complaints both name.
5. **Error queue for failed writes** — persist `flushMovements` permanent
   failures as actionable rows instead of deleting them (#6, #317/#338).

*Generated as a read-only audit. No code was modified.*
