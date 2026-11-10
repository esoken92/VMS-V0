# Industry Packs & Guided Provisioning — Reference Matrix

How the setup wizard provisions this instance: **industries → capability
packs → feature flags → nav, fields, report packs and storeroom presets.**

Source of truth (this file mirrors it, nothing here is invented):

- `lib/features.ts` — industries, packs, flags, stock characteristics,
  policies, `deriveFeatures()`, `packsForInput()`, `deriveReportPacks()`.
- `lib/industry-presets.ts` — wizard preset templates and the
  pack → storeroom mapping (`storeroomPresetsFor`).
- `lib/actions/provisioning.ts` — preview (proposes) and apply (creates).
- Requirements trace to `docs/research/04-industry-verticals.md`
  (M-priority items only) and `docs/MASTER_EXECUTION_PROMPT.md`
  items 359–385.

---

## 1. The model

1. **Industries** (multi-select) map to **packs** via `INDUSTRY_PACKS`.
   Declaring the *temperature-sensitive* stock characteristic additionally
   activates the `cold_chain` pack (`packsForInput`).
2. **Packs + stock declarations + policies** derive the **feature flags**
   (`deriveFeatures`). Flags hide or reveal UI; data is never deleted.
3. **Flags** derive the **report pack catalog** (`deriveReportPacks`).
4. **Packs** propose **storerooms** (`storeroomPresetsFor`) — shown in the
   Review step and created on Apply, skipping same-named rooms.
5. An **unprovisioned** instance (wizard never run) has every flag ON —
   the template ships fully enabled.

## 2. Wizard preset templates (one-click answer-sets)

`PRESET_DEFINITIONS` in `lib/industry-presets.ts`. Selecting a preset on
step 0 prefills industries + stock declarations + policies; everything
stays editable. Storerooms follow from the derived packs.

| Preset | Industry | Stock declared | Policies |
|---|---|---|---|
| **General Inventory** | General / retail | consumables | FIFO · suggest · weighted average · no expiry policy |
| **Pharmacy** | Pharma & medical | perishable, temperature-sensitive, serialized, consumables | **FEFO · block** · weighted average · enforce FEFO + quarantine |
| **Tool Library** | Tools & equipment | serialized, tools loanable | FIFO · suggest · weighted average · none |
| **Fleet Parts** | Automotive & fleet | serialized, tools loanable, vehicle parts, consumables | FIFO · suggest · weighted average · **track expiry** |
| **Cold Storage** | Food & beverage | perishable, temperature-sensitive, consumables | **FEFO · warn** · weighted average · enforce FEFO + quarantine |
| **School** | Government & education | serialized, tools loanable, consumables | FIFO · suggest · weighted average · none |

Rationale notes:

- *Pharmacy* uses `block` enforcement — quarantine→release and serial
  verification are M-tier gates (§1.4–1.5), so off-policy picks must not
  slide through with a warning.
- *Cold Storage* uses `warn` — FEFO is enforced but an override path is
  required to exist (FEFO overrides must be auditable — research
  watch-outs).
- *Fleet Parts* tracks expiry without enforcing (fluids/tyres age, but an
  oil change shouldn't hard-block on a date).

## 3. Industry → packs → flags → reports → storerooms

Baseline flags assume **default policies** (FIFO / suggest / weighted
average / expiry none) and **no stock characteristics declared** — wizard
answers add more on top (see §5).

| Industry | Packs | Feature flags | Report packs | Storerooms proposed |
|---|---|---|---|---|
| General / retail | stock_control | consumables, stock_takes | inventory_valuation, stock_variance | Main Store · Staging Area · Returns Holding |
| Food & beverage | stock_control, perishables, **cold_chain** | expiry, consumables, stock_takes, cold_chain | + expiry_register, temp_excursion | above + Ambient Store · Expiry Hold · Cold Store 2–8 °C · Freezer −18 °C · Receiving Dock |
| Pharma & medical | stock_control, perishables, regulated_items, **cold_chain** | expiry, serialization, hazmat, consumables, stock_takes, cold_chain, quarantine | + expiry_register, serial_register, hazmat_register, temp_excursion, quarantine_register | above + Quarantine Room · Secure Store |
| Automotive & fleet | **stock_control**, fleet_parts, tool_crib | serialization, tool_loans, vehicle_parts, consumables, stock_takes, **work_order_ref, asset_lifecycle** | + serial_register, tool_custody, fleet_usage, job_costing, asset_register | Main Store · Staging Area · Returns Holding · Parts Store · Vehicle Bay · Tool Crib |
| Tools & equipment | tool_crib | tool_loans | inventory_valuation, tool_custody | Tool Crib |
| Agriculture | stock_control, perishables | expiry, consumables, stock_takes | + expiry_register | Main Store · Staging Area · Returns Holding · Ambient Store · Expiry Hold |
| Manufacturing | stock_control, industrial_stock | serialization, hazmat, consumables, stock_takes, **work_order_ref** | + serial_register, hazmat_register, job_costing | Main Store · Staging Area · Returns Holding · Bulk Store · Hazmat Store |
| Government & education | stock_control, asset_issue | tool_loans, consumables, stock_takes, **asset_lifecycle, funding_codes** | + tool_custody, asset_register, funding_report | Main Store · Staging Area · Returns Holding · Asset Issue Room |

*Report-pack column:* every provisioned deployment gets
`inventory_valuation`, and `stock_variance` wherever `stock_takes` is on;
"+ …" lists the additional report families.

Changes vs the original mapping (additive only — nothing removed):

- `food_beverage`, `pharma_medical` gain the **cold_chain** pack —
  temperature-zone mapping is M-tier for both (§1.7, §9.3–4).
- `automotive_fleet` gains **stock_control** — a fleet parts room runs
  bins, counts and consumables, not just custody.
- `asset_issue` now implies the **tool_loans** flag — member/departmental
  issue is the same checkout–return machinery (§3.1, §4.1).
- `industrial_stock` implies **serialization** — critical spares are
  serial+lot tracked (§6.5).

## 4. Feature flags — derivation reference

| Flag | Enabled when… | Requirement basis |
|---|---|---|
| `expiry` | perishable stock, temperature-sensitive stock, `perishables`/`regulated_items`/`cold_chain` pack, or expiry policy ≠ none | §1.6, §9.1 |
| `fefo` | expiry policy = enforce FEFO(+quarantine) or picking strategy = FEFO | §7.4, §9.1 |
| `serialization` | serialized stock or `regulated_items`/`fleet_parts`/`industrial_stock` pack | §1.4 (DSCSA), §6.5 |
| `hazmat` | hazmat stock or `regulated_items`/`industrial_stock` pack | §8.7-adjacent, §4.2 |
| `tool_loans` | loanable tools or `tool_crib`/`asset_issue` pack | §3.1, §4.1, §5.2 |
| `vehicle_parts` | vehicle-parts stock or `fleet_parts` pack | fleet-parts items |
| `consumables` | consumables stock or `stock_control`/`perishables`/`industrial_stock` pack | baseline |
| `stock_takes` | any qty-bearing characteristic or any non-tool-crib pack | §4.3 counts |
| `cold_chain` | `cold_chain` pack or temperature-sensitive stock | §1.7, §2.5, §8.3, §9.3–4 |
| `quarantine` | `regulated_items` pack, hazmat stock, or enforce-FEFO+quarantine policy | §1.5, §9.3, item 132 |
| `work_order_ref` | `fleet_parts`/`industrial_stock` pack or vehicle-parts stock | item 165, §5.1–2, §6.3, item 333 |
| `asset_lifecycle` | `asset_issue` or `fleet_parts` pack | §3.5, §4.1, items 179–181 |
| `funding_codes` | `asset_issue` pack | §3.4 (GASB 34), §4.6 |

Flags gate live UI where consumers exist today — nav (`tool_loans`,
`stock_takes`), product-form tracking fields (`expiry`, `serialization`),
the provisioning preview itself, report-pack and storeroom provisioning.
The newer vertical flags (`cold_chain`, `quarantine`, `work_order_ref`,
`asset_lifecycle`, `funding_codes`) currently record the capability
intent in `instance_config` and drive the review diff + storeroom seeding;
their flag-gated fields land with the corresponding roadmap items
(e.g. WO-reference on issues, funding-code fields on movements).

## 5. Wizard inputs that add depth

| Input | Effect |
|---|---|
| `temperature_sensitive` stock characteristic | activates `cold_chain` pack even with no cold-chain industry (e.g. a retailer stocking chilled goods) → cold_chain flag + cold/frozen/dock rooms + excursion report |
| `picking_strategy = fefo` or `expiry_policy = enforce_fefo*` | turns on `fefo` |
| `expiry_policy = enforce_fefo_quarantine` | turns on `quarantine` + `fefo` |
| any `*_stock` characteristic | turns on the matching flag directly |

## 6. Storeroom presets per pack

`storeroomPresetsFor(packs)` resolves these through the room-type defaults
(`getRoomTypeDefaults` — temp bands, feature toggles, quarantine flag).
Proposed rooms are **created on Apply** inside the provisioning
transaction and skipped when a same-named room exists (case-insensitive)
— re-running the wizard is idempotent and never overwrites user rooms.
`allowed_roles` follows the seed convention: open → all roles,
restricted → super_admin/admin/manager, secure/locked → super_admin/admin.

| Pack | Rooms proposed (type, temp band, access) |
|---|---|
| stock_control | Main Store (general, —, open) · Staging Area (staging, —, open) · Returns Holding (returns, —, restricted) |
| perishables | Ambient Store (dry, 15–25 °C, open) · Expiry Hold (quarantine, —, restricted) |
| regulated_items | Quarantine Room (quarantine, —, restricted) · Secure Store (secure, —, secure) |
| cold_chain | Cold Store 2–8 °C (cold, 2–8 °C, restricted) · Freezer −18 °C (frozen, −25…−15 °C, restricted) · Receiving Dock (dock, —, open) |
| fleet_parts | Parts Store (general, —, open) · Vehicle Bay (vehicle, —, restricted) |
| tool_crib | Tool Crib (secure, —, restricted) |
| industrial_stock | Bulk Store (general, —, open) · Hazmat Store (hazmat, 15–25 °C, restricted) |
| asset_issue | Asset Issue Room (it, 18–27 °C, secure) |

Deduping is by name in canonical `PACKS` order — e.g. pharma sees
Returns Holding once even though several packs could argue for it.

## 7. Deliberately excluded (extensibility, not gaps)

- **Export-control fields** (ITAR/EAR, §4.4) — defense-specific; the
  combined Government & education pack would noise-flag it for schools.
  Designed-for via the pack framework, built on demand (item 371).
- **Cannabis seed-to-sale** (§10) — jurisdiction-gated state integration;
  roadmap item 369 hooks only.
- **Wine/spirits, aviation MRO, blood bank, scrap** — vessel/rotable/
  ISBT-128/weighbridge semantics don't fit the shared flag vocabulary;
  item 371 designs-for without building.
- **E-signature / Part 11, CAPA, openFDA recall ingestion, fines ledger**
  — M-tier but real feature builds (items 360–362), not flag-level
  toggles. `regulated_items`, `asset_lifecycle` and `funding_codes`
  record the provisioning intent so these light up when shipped.
- **S/N-tier items** — per the verticals doc, only M-priority
  requirements drive flags/packs.
