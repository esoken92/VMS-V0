# Research: GitHub Sweep — Missed Inventory/Fleet/Asset OSS (round 2)

*Repos verified ~Nov 2026. Already-covered systems excluded (Part-DB,
InvenTree, Grocy, Homebox, OpenBoxes, Snipe-IT, NetBox, ERPNext, Carbon,
Spoolman, WHMS/NexoPOS/triangle-pos, rackpad, etc.).*

## Notable repos found

| Repo | ★ | License | Standout features |
|---|---|---|---|
| traccar | 8.1k | Apache-2.0 | 200+ GPS protocols, geofences, driver-behavior scoring, device commands |
| dolibarr | 7.8k | GPL-3.0 | Depreciation tables, auto asset→GL posting, TCO rollup, warranty/contract expiry |
| glpi | 6.6k | GPL-3.0 | ITIL+CMDB fused, license audit, dynamic inventory agents, reservations |
| fleetbase | 4.5k | AGPL-3.0 | Modular OS: dispatch, driver app, Pallet WMS, Ledger invoicing, AI order creation |
| shelf.nu | ~3.0k | AGPL-ish | QR print+scan, bookings w/ double-booking prevention + calendar sync, custody, kits, GPS locations, calibration reminders |
| lubelog | 3.0k | MIT | Fuel→MPG trends, maintenance schedules, cost reports, PWA |
| ralph | 2.5k | Apache-2.0 | Asset lifecycle flows, DC floor viz, flow-state engine |
| veops/cmdb | 2.3k | AGPL-3.0 | Auto-discovery, IPAM+DCIM, model+relationship customization |
| ModernWMS | ~1.8k | Apache-2.0 | Commercial-WMS-derived: inbound/outbound/locations, QR, PDA workflows |
| tracktor | 1.0k | MIT | Garage mgmt: fuel trends, cert expiry (insurance/PUCC), service reminders, widget dashboards, feature toggles |
| iTop | 1.1k | AGPL-3.0 | Configurable CMDB, impact graph, SLA, data federation |
| Atlas CMMS | ~860 | AGPL-3.0 | WO+PM scheduling, downtime/reliability analytics, parts↔WO, RN app |
| KopSoftWMS | 897 | MIT | Typed inbound/outbound docs, .NET 9 |
| fleet-telemetry | 904 | — | Tesla telemetry → own backend |
| OVMS3 | 872 | custom | CAN-bus diagnostics, remote climate/charge, vitals monitoring |
| openwms | 760 | Apache-2.0 | Microservice WMS, Material Flow Control (PLC layer), ERP task orchestration |
| frePPLe | 770 | MIT-CE | Demand forecasting, finite-capacity scheduling |
| leihs | 246 | GPL-3.0 | Lending lifecycle: request→approve→loan→return + procurement |
| hmis | 238 | GPL-3.0 | Hospital stores: GRN, requisitions, disbursement |
| nasa/isle | 216 | custom | Lab checkout to LOCATIONS (not just people), asset↔asset, custom attrs |
| zetavg/Inventory | 322 | custom | True UHF-RFID (UART/BT), offline CouchDB sync, bulk tag scanning |
| circulate | 117 | custom | Tool-library OS: fines, holds+waitlists, renewals, appointments, kiosk |
| mywms | 131 | GPL | Industrial 24/7: pick-to-pack, packing dialogs, consignment, configurable storage |
| Inventoros | 21 | custom | Inter-warehouse transfers w/ transit, per-warehouse reorder, kitting/BOM, batch+serial, warehouse ACL |
| carcareco | 52 | AGPL-3.0 | Workshop mgmt: WO+parts+labor, vehicle history, invoices, multitenant |
| sentry-wms | ~38 | Apache-2.0 | Serpentine pick walks, pack-station verify, connector vault+circuit breaker, sync-health dashboard |
| fleetms | 33 | MIT | Fleet register, inspection form builder, licence/insurance renewals, TCO |
| RepairOS | 27 | MIT | Multi-tenant repair SaaS, 6-role RBAC, service catalogs, parts inv |
| ai_inventory | 17 | MIT | ERPNext AI forecasting, fast/slow/critical, auto-PO |
| supplyseer | 130 | AGPL-3.0 | Bayesian EOQ, neural demand, uncertainty quantification |

## Functionality gaps worth adding

- **Booking/reservation layer** — advance reservations, conflict prevention, checkout/return windows, calendar sync (shelf.nu, circulate)
- **Custody vs location split** — who-has-it AND where-it-lives as separate axes; checkout TO a location/room not just a person (isle, shelf.nu)
- **Lending lifecycle** — request→approve→loan→renew→return→fine, holds/waitlists (leihs, circulate)
- **Condition/photo evidence on checkout+return** — graded returns, photo capture, immutable scan history
- **Kits/bundles w/ component deduction** — kit checkout reduces components; BOM assembly
- **Work-order linkage** — issues tied to WOs; parts auto-decrement; labor+parts one doc
- **Maintenance/PM scheduling** — calendar+runtime/cycle triggers, inspection form builder, cert renewals
- **Depreciation & TCO** — SLN/DD schedules auto-posted, residual value, renewal planning (Dolibarr — unique in OSS)
- **Demand forecasting→auto-reorder** — EOQ + safety stock + reorder point from history; auto-PO; dead/overstock flags
- **Append-only stock ledger / perpetual inventory** — reconstruct stock at any timestamp
- **Wave/pick optimization** — serpentine multi-order paths, pack-station verify, cartonization
- **True UHF-RFID** — UART/BT reader pairing, bulk scanning, offline sync
- **Inter-warehouse transfers** — transit state, per-warehouse reorder/capacity, warehouse-scoped ACL
- **Certification gating** — must hold cert before booking/checkout (makerspaces)
- **LOTO/incident log** — lockout-tagout records, incident severity linked to assets
- **Vehicle telematics hook** — odometer/mileage-driven maintenance, GPS ingestion
- **Multi-currency + tax per region**

## Also-rans (low-star but idea-worthy)

qbit-wms (metadata task engine, immutable ledger, ASN/blind receive, wave pick, cartonization, RMA grading, 3PL billing); OptiWMS (worker PWA, ABC/FMS slotting); track-maintenance (Traccar companion, append-only parts ledger); glovebox (rental condition logger); autotraq (append-only parts ledger + fitment); Car_e-commerce (AI photo→part ID, fitment).

## Caveats

Shelf.nu license "AGPL + one exception" — review before copying. Auto-parts OSS is thin: best are workshop apps (carcareco, RepairOS), not pure parts-inventory.
