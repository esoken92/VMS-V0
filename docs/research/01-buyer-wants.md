# Research: What Companies Want from Inventory/Warehouse/Asset Software

*Source: G2, Capterra, Software Advice, Trustpilot, PissedConsumer, Shopify/Xero
app stores, Reddit, RFP guides; inFlow "State of Inventory Management 2026"
(n=400) + TechnBrains 75-record coding across 11 warehouse products.
Products covered: Zoho Inventory, inFlow, Fishbowl, Cin7, Sortly, AssetTiger,
UpKeep, MaintainX, EZOfficeInventory, Asset Panda, Cheqroom, Finale, Katana,
Odoo, ERPNext, Snipe-IT, ShipHero, Wasp.*

**Key stats:** 85% of operators still run primarily on spreadsheets; 44.8–49.5%
cite inventory *accuracy* as #1 problem; 50.1% of 1–2★ reviews cite support;
37.1% of negative reviews are commercial complaints; 84% of buyers ask about
reporting vs only 55% of users calling tracking "critical" (buy-vs-use gap).

## A. Purchase criteria

1. Ease of use / minimal training — single most-cited want [ALL]
2. Fast, cheap implementation — "same-day setup" sells; Odoo/ERPNext/EZO lose on complexity [SMB]
3. Pricing transparency & predictability — no "contact sales" opacity [SMB/MID]
4. Real-time accuracy, not batch sync — buyers test by disconnecting integrations [MID]
5. Mobile app at web parity — feature-subset apps complained about constantly [ALL]
6. Barcode/QR scanning out of the box — table stakes, 81% already use it [ALL]
7. Working offline mode — dead zones, freezers, docks [SMB/MID]
8. Deep, customizable reporting — #1 product complaint when shallow [ALL]
9. Responsive human support — 50% of negative reviews [ALL]
10. Free tier or real trial — decisive for SMBs [SMB]
11. Audit trail / who-did-what — baseline accountability [MID/ENT]
12. RBAC that actually restricts — discount limits, SKU-creation gates [MID/ENT]
13. API access included, not an add-on — gated APIs are deal-breakers [MID]
14. Data ownership & easy export — incl. history [MID/ENT]
15. No vendor lock-in / punitive exit — auto-renewal traps documented [ALL]

## B. Requested features ("I wish it had…")

16. Lot/batch + serial + expiry + FEFO — missing in inFlow, Sortly, Zoho [SMB/MID]
17. Kits/BOM deducting components correctly — Zoho composite items don't decrement (documented corruption); inFlow blocks circular refs; multi-level missing [SMB/MID]
18. Case/pack-level scanning — "scan a case, update individual quantities" [SMB]
19. Request-and-approve workflows for checkout/POs [SMB/MID]
20. Calendar view + booking windows — holiday rules, reservation length limits, per-slot booking (Cheqroom) [SMB/MID]
21. Easy move/transfer between locations — #1 multi-site pain [SMB/MID]
22. Search by SKU/item across everything — Cin7 lacks it; barcode-add duplicates (Sortly) [SMB/MID]
23. Low-stock alerts at folder/item/location granularity [SMB/MID]
24. On-order vs on-hand visibility + demand forecasting [SMB/MID]
25. Workflow checklists & guided multi-step tasks [SMB/MID]
26. Custom fields + custom statuses + custom reports — universal ask [ALL]
27. Photo attachment to every record/transaction [SMB]
28. Bulk operations & import/export done well — slow uploads, dup-prone imports complained [ALL]
29. Notification configurability — conditional by group/status/location [SMB/MID]
30. Work-order → parts/inventory linkage — cost association, usage deduction [MID]
31. Asset lifecycle: depreciation, warranty expiry, downtime logging [SMB/MID]
32. Custody chain & check-out history — due-back dates, condition photos both ends [SMB/MID]
33. Cycle counting / physical audit workflows — blind counts, found/missing/moved [SMB/MID]
34. Kardex / stock-movement ledger report — "opening + movements = closing" [MID]
35. Invoice/document generation inside the app [SMB]
36. Dead-stock / aging / turnover reports — Fishbowl aging called flawed [SMB/MID]
37. Multi-UOM + unit conversion — decimals for length-measured [SMB/MID]
38. Sub-location/bin survives zero quantity — inFlow deletes at qty=0 [SMB/MID]
39. Offline-first scanning with conflict resolution [MID]
40. QR/barcode label generation & printing — reprint w/o deleting barcode; ZPL/CPCL [SMB]
41. Barcode symbology breadth + hardware flexibility — UPC/EAN/Code128/DataMatrix/PDF417, camera+HID+BLE+Zebra/Honeywell+RFID [ALL]
42. Drop-ship / backorder / partial fulfillment — must not corrupt counts [SMB/MID]
43. Component-level consumption reporting — Zoho needs paid Analytics [SMB/MID]
44. Duplicate detection & data validation at entry [ALL]
45. EDI + retailer compliance (GS1/SSCC) — enterprise ask [ENT]

## C. Deal-breakers / rejection reasons

46. No API or gated API — inFlow (none), Sortly (beta), EZO (weak) lose buyers [MID]
47. Pricing cliffs & surprise hikes — Cin7 $249→$669, Cheqroom +240%, Sortly ~93%, Katana GMV pricing; #1 churn driver [ALL]
48. Feature-gating at premium tiers — MaintainX/UpKeep/Katana gate basics [SMB/MID]
49. Accounting sync that corrupts or silently drifts — Fishbowl↔QB daily failures, phantom $300k adjustment (inFlow) [SMB/MID]
50. Multi-location as "tags" not entities — inFlow struggles, Wasp caps at 1 [MID]
51. No offline / mobile weaker than web — Asset Panda, Sortly, EZO [SMB/MID]
52. Missing lot/serial/expiry — disqualifying for food/pharma/regulated [MID/ENT]
53. Can't export own data / hostage terms — NetSuite deletes on termination, Infor 35 days [MID/ENT]
54. Setup requires consultant/developer — Odoo, ERPNext, EZO [SMB]
55. Weak or paid-only support — Fishbowl support costs extra; Cin7 post-acquisition collapse [ALL]
56. Hidden costs: onboarding fees, per-user fees, API add-ons — inFlow $499+$29/user+$49 API [SMB/MID]
57. Vendor abandonment/acquisition risk — DEAR→Cin7, Stocky shutdown [ALL]
58. Poor audit trail / no approval gates / over-broad permissions — Fishbowl "VERY limited", Zoho discount loopholes [MID/ENT]
59. Reporting too shallow to trust — no custom views, no date-stamped valuation, no cross-location rollups [ALL]
60. Barcode hardware lock-in — HID wedge, BLE, rugged Android expected [SMB/MID]
61. Not fit-for-purpose — asset trackers can't do stock, ERPs can't do checkout [ALL]
62. Notification/reporting lag — UpKeep hours-late statuses, Cin7 misses transfers [MID]

## D. Segment priorities

63. [SMB] spreadsheet killer, phone-camera scanning, QB/Xero sync, flat/free, no IT, PO basics, low-stock alerts; order/SKU caps = #1 upgrade pain
64. [SMB] buy triggers: stockouts costing margin, 2+ editors, multi-channel overselling, supplier PO requirements, month-end pain
65. [MID] real-time multi-channel sync, multi-warehouse+transfers, BOM/kitting, forecasting, API+Zapier, roles, deeper reporting, carrier integration; trigger: 3+ channels or >1 location
66. [MID] predictable flat pricing; resents mid-subscription changes
67. [ENT] SSO/AD, granular RBAC, immutable audit (21 CFR Part 11), EDI, multi-site rollup, full-export rate limits, SLAs, sandbox, data-residency, on-prem/VPC
68. [ENT] deal-breakers: no SSO, no e-signatures, editable audit logs, no bulk export, unclear data ownership, unproven security
69. [ALL] nonprofits/education: free/cheap, unlimited users, grant allocation, due-date checkout, audit reconciliation, MDM sync
70. [ALL] construction/trades: offline mobile scanning, job-site locations, tool custody w/ condition photos, per-project costing, cheap Android + ring scanners

## E. Integration expectations

71. Accounting #1 — QuickBooks Online/Desktop first, Xero second; two-way product+inventory+COGS, not one-way push; Fishbowl↔QB failures legendary [SMB/MID]
72. E-commerce channel sync — Shopify, Amazon (FBA+FBM+settlements), Woo, Etsy, eBay, Walmart, Faire; real-time decrement; variant mapping that survives API changes [SMB/MID]
73. Shipping/fulfillment — ShipStation/Shippo/EasyPost or carrier rates, tracking import, label printing, 3PL sync [SMB/MID]
74. Barcode hardware neutrality — HID wedge, BLE, camera, Zebra TC2x/TC7x, Honeywell Android, RFID; ZPL label printing [ALL]
75. Middleware tolerance low — native > Zapier > custom API; missing Shopee/Lazada/TikTok sank Zoho for SEA sellers [SMB/MID]
76. POS/marketplace expansion — Square, TikTok Shop, regional marketplaces [SMB/MID]

## F. Pricing model preferences

77. Flat-rate > per-user — scanner-only workers shouldn't be paid seats (MaintainX free requester accounts praised)
78. Beware volume caps — order quotas, SKU caps, location caps, per-asset pricing = cliff-edge bills; buyers model 3-yr cost at 2× headcount
79. Hidden-cost checklist — onboarding fees, per-user fees, API add-ons, premium support, sandbox, overage; "published price is the floor"
80. Free tier expectations — genuinely usable free plan wins SMBs; self-host OK if setup isn't a nightmare
81. Predictable renewals — auto-renewal traps, unannounced hikes, mid-subscription changes = top contract complaints (37% of negatives)
82. AI interest ≠ willingness to pay — 81% want AI, 62% worry about cost; AI must be free/cheap to be valued

## Top-12 gap implications (frequency × severity)

1. Honest predictable pricing — flat/self-hosted, no cliffs, full export, no lock-in
2. Correctness primitives — event ledger, kardex, audit trail, no silent drift; "opening + movements = closing"
3. Lot/serial/expiry + FEFO + case-level scanning — most-requested missing cluster
4. Real multi-location model — first-class entities, transfers, per-location reorder (not tags)
5. BOM/kitting that decrements — multi-level + circular-ref safe
6. Offline-first mobile scanning — camera + HID + BLE + Zebra/Honeywell + labels, dead-zone safe
7. Deep-but-simple reporting — custom, aging/turnover/dead-stock/on-order-vs-on-hand, date-stamped valuation
8. Accounting + channel connectors — two-way QB/Xero w/ COGS; Shopify/Amazon/Woo sync; carrier rates
9. Check-out/custody workflows — request→approve→checkout→return, due dates, condition photos
10. RBAC + approval gates — field/action permissions, immutable logs
11. Setup without consultant — sample data, validated import wizard, sensible defaults
12. Notification engine — configurable, conditional, covers transfers/low-stock/overdue/expiry
