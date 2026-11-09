# Research: Industry Vertical Requirements

*Sources: FDA/EMA/WHO/PIC-S guidance, eCFR, DDTC/DoD regs, vendor verticals.
M = must-have, S = should-have, N = nice-to-have.*

## 1. Pharma/Biotech (21 CFR Part 11, GDP, DSCSA, ALCOA+)

- Append-only time-stamped audit trail on every mutation — Part 11 §11.10(e), ALCOA+, WHO TRS 1033 "who/what/when/why". **M**
- Electronic signatures w/ non-repudiation — unique creds, meaning manifests, record-binding, re-auth on critical actions (release/disposal/adjustment). **M**
- Role-based access + authority checks (release vs dispense vs view). **M**
- Serial-level DSCSA tracing — GTIN/NDC+serial+lot+expiry; TI/TS capture at receive+ship; serial verify at dock. FD&C §582 live since Nov 2023. **M** (US distributors)
- Quarantine→release workflow — QC release gates pick/ship; disposition reasons required. **M**
- Lot/batch + retest/expiry + stability conditions per SKU (2–8°C/15–25°C/−20°C bands). **M**
- Temperature-zone mapping — per-location zones, logged min/max, excursion detection, quarantine-on-excursion. **M**
- Forward/backward recall trace by lot/serial. **M**
- CAPA/quality-event linkage — deviations on lots w/ investigation, root cause, disposition, effectiveness check; approved-supplier gating. **M/S**
- IQ/OQ/PQ validation artifacts for the software itself. **N** (process)

## 2. Healthcare/Clinical

- Loaner/consignment kit tracking — procedure-linked bookings, vendor windows, barcode set ID, return-due alerts, usage-not-billed capture (orphaned loaners ~$1B/yr industry pain). **M**
- Serial/UDI + lot on implants/devices — GUDID DI/PI fields. **M**
- Recall management — FDA recall data (openFDA) matched to owned stock → remediation WOs + effectiveness checks. **M**
- Preventive maintenance scheduling — calendar+runtime triggers, WO lifecycle, utilization reports. **M**
- Cold-chain vaccine storage — 2–8°C monitoring, excursion quarantine. **M**
- HIPAA-conscious — no PHI on asset records; kit↔procedure as opaque refs. **M**

## 3. Education/Schools

- Member-specific checkout rules — borrow limits, loan periods, renewal caps, grace days, fine accrual. **M**
- Fines → fee ledger w/ receipts, waivers, collection reports; lost/damaged write-offs at multipliers. **M**
- No-dues enforcement — block issues when fines outstanding. **S**
- Grant/funding-source tagging — E-Rate/ESSER/Title I/Perkins/bond; report by funding source+award year (GASB 34). **M**
- Warranty + refresh-cycle alerts; lifecycle states (active→surplus→disposed). **M**
- Lab/CTE inventory — classroom checkout w/ due dates; SDS/COA attachments. **S**
- Audit count mode — wall-to-wall counts w/o closing; condition states. **S**

## 4. Government/Defense

- Property book — unique ID+serial, acquisition cost, named custodian, location (BIA 23 IAM 9, NPS RM-44). **M**
- AA&E special handling — serial for weapons, lot/NIIN/DoDIC for ammo, threshold-triggered loss reporting, secure-storage flags. **M**
- Formal inventory verification — physical/electronic/statistical-sample counts w/ variance reconciliation. **M**
- Export-control fields — ECCN/USML/ITAR category, license-required flag, license#+expiry; gate issue/transfer on validity (ITAR 22 CFR 122–130, EAR 15 CFR 730–774). **M** (defense)
- Restricted-party screening hooks at transaction level (OFAC/EAR). **S**
- Chain-of-custody transfers — signer capture+timestamps; signature-verifiable exports. **M**
- Audit-ready reports — property book exports, valuation, custody history (FFPAR evidence). **M**
- Data residency/GovCloud for CUI/ITAR data. **N**

## 5. Construction/Trades

- Job/site allocation — expected qty pre-dispatch, actual consumption vs same job, variance visible during job not at closeout. **M**
- Checkout to crew/person/project w/ due date + return condition state. **M**
- Custody transfer trail — trucks, vans, sites, warehouse; "who has it now". **M**
- Location tree — warehouse→van/truck→site; van contents queryable mobile. **M**
- Field requests — crew submits transfer/repair request from mobile; offline scanning. **M**
- PM/maintenance on tools+plant (hours/calendar) + repair WO routing. **M/S**
- Rental/loaner return capture — out-on-rent, damage charges, condition photos. **S**

## 6. Manufacturing/MRO

- Where-used/BOM linkage — part→consuming assets; kit explosion. **M**
- Min/max + safety-stock reorder at WO close (not batch) — parts-waiting = #1 downtime cause. **M**
- WO lifecycle — request→approve→dispatch→labor/parts issue→close; downtime capture → MTBF/MTTR. **M**
- PM by calendar, runtime hours, cycles, meter readings. **M**
- Serial+lot on critical spares; condition codes (serviceable/unserviceable). **M**
- MRP-lite — net demand from open WOs/PMs → suggested PO/PR; expedite flags. **S**
- Multi-location — storeroom, satellite crib, tech-truck stock w/ transfers. **M**
- Criticality classification → reorder priority + emergency WO fast-path. **S**

## 7. Retail/E-Commerce

- Absolute available-qty pushed to channels (not deltas) — prevents double-count on retry; one stock number across Shopify/Amazon/eBay/Walmart/POS. **M**
- Variant/SKU model — size/color/material attrs, per-variant price+qty, per-channel overrides. **M**
- Returns/RMA — return→approve→reverse logistics→inspect→restock-or-quarantine→refund; restock rules per reason. **M**
- Perishable FEFO — lot+expiry at receipt, picker directed earliest-expiry, FEFO-override audit, expired auto-hold. **M** (food)
- Kits/bundles component explosion; VMI/pay-on-scan for supplier-owned stock. **S**
- Multi-warehouse+bins, pick lists walking order, cycle counts w/ variance approval. **M**
- Channel-native identifiers — internal SKU→each channel's code format. **M**
- B2B tiers, subscriptions, per-channel price floors. **N**

## 8. Labs/Research

- Lot lifecycle — receipt w/ COA+QC results, storage, usage history, disposal w/ witness sign-off. **M**
- Sample chain-of-custody — every event logged; freezer→box→rack positions w/ visual map; aliquot parent-child lineage; freeze/thaw counter. **M**
- Storage-condition enforcement — −80/−20/RT/LN2 classes; blocked wrong-zone transfer; capacity per freezer. **M**
- Expiry+retest w/ staged alerts (30/7/1-day); auto-block expired from runs. **M**
- Hazard/SDS attachment, waste/disposal reporting. **S**
- Audit-trail export (dynamic file) for GLP/GMP; LIMS API/CSV interchange. **M**

## 9. Hospitality/Food Service

- FIFO/FEFO rotation w/ use-by at receipt; repack date labels; expired auto-flag pre-service. **M**
- Receiving verification — delivery temp vs spec (chilled ≤4°C, frozen −18°C), spec-sheet match, damaged/leaker reject, quarantine path. **M**
- Approved-supplier records — spec sheets, health certs, batch reports, COA docs, retention for tracing. **M**
- HACCP CCP monitoring — temp logs per unit, excursion→corrective-action record (who/cause/disposition), verification. **M**
- Shift-level par stock; low-stock before service; waste/spoilage w/ reason codes. **S**
- Allergen/dietary spec flags for menu-allergen reporting. **S**

## 10. Other verticals

**Cannabis (seed-to-sale)** — state-mandated:
- Real-time state system integration (Metrc/BioTrack) — serialized tags, adjustments, waste. **M** where legal
- Transfer manifests — license #s, item UIDs, qty, vehicle, driver signature; receiver accept/reject per UID. **M**
- Plant counts + harvest/wet-weight same-day; purchase-limit checks. **M**

**Wine/Alcohol (TTB)**:
- Vessel inventory — tank/barrel fill %, rack/top-up/bottling WOs, aging progress. **M**
- Bulk→case-goods conversion — bottling deducts bulk+components, creates finished SKUs, per-unit cost through blends. **M**
- Bonded vs tax-paid locations w/ depletion reason codes; TTB 5120.17 reports. **M**
- Case-goods multi-channel depletion + DTC allocation caps. **S**

**Aviation MRO**:
- Serialized rotable — TSO/airworthiness, hours/cycles since overhaul, LLP limits, release certs (8130-3/EASA 1). **M**
- Core exchange/return obligations — owed-to-vendor tracking, return-due, penalty avoidance. **M**
- Overhaul WOs — approved-station routing, cost-vs-core decisions, warranty vault. **S**
- State-machine enforcement — unserviceable serial cannot be picked. **M**

**Scrap/Recycling**:
- Weighbridge integration — gross/tare/net, reweigh variance, moisture/contamination deductions, photo+ID. **M**
- Material-grade classification (ISRI codes), weighted-average costing incl. processing/shrinkage. **M**
- Supplier compliance records (ID, banned-party), 1099/statement reporting. **S**

**Blood bank**:
- Unit-level traceability (ISBT-128) — ABO/Rh+component per unit; donor↔patient both directions. **M**
- Quarantine→release gating — held until TTI screening cleared w/ dual-person verify; reactive→discard+donor flag+lookback. **M**
- FEFO within matched group; temp excursion→auto-quarantine pending supervisor. **M**

## Watch-outs

- Audit immutability + "no user can deactivate" explicitly required (EMA clinical guidance)
- Excursion workflows need DISPOSITION capture (product fate), not just alerts
- FEFO needs override auditing (different lot scanned = recorded exception)
