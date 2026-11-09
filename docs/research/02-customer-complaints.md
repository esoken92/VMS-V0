# Research: Customer Complaints — Inventory/Warehouse/Asset Software

*Sources: G2, Capterra, Trustpilot, SoftwareAdvice, PissedConsumer, Ripoff
Report, financesonline, app-store reviews (Sortly, UpKeep, EZOffice, Cheqroom,
MaintainX, Quartzy), GitHub issues (Snipe-IT, Homebox), Frappe forum, QuickBooks
Community, Shopify Community, r/InventoryManagement, r/shopify, r/warehouse,
r/smallbusiness, HN; StockUnison 2,603-review sync-app study; mrrlens clustering.*

## Category A — Sync bugs silently corrupt data (#1 theme)

1. Channel sync disconnects while claiming "connected" — Cin7 Shopify, Zoho counts never sync
2. Sync wipes user-set values — Zoho overwrites safety stock; inFlow connector duplicates + injects tax lines
3. Sync errors invisible — inFlow↔Xero fails on 5.27-vs-5.26 penny mismatch silently; Fishbowl↔QB fails ~daily
4. Data loss events — 9% of 2,603 sync-app complaints; Sortly users lost ALL items after update
5. Blank/partial order import — Cin7 blank orders; Fishbowl migration ~10% products no cost
6. Kit/component stock doesn't cascade — Zoho adjustments don't reach components; Epicor shared warehouses overstate on-hand

## Category B — Counts don't match reality

7. Transfers stuck "in transit" — deducted at source, never confirmed at destination; invisible to allocation+replenishment
8. Cycle counts corrupt totals — phantom +10 adjustments when stock moves mid-count
9. Fulfilled orders unfixable — Fishbowl "very unforgiving"; Cin7 oversold "countless items"
10. Manual adjustments hide root cause — "system inventory gradually drifts away from physical reality"

## Category C — Accounting integration drift

11. Fishbowl↔QuickBooks never balances — costing-method/backdating/manual-edit mismatches; daily reconciliation ritual
12. Penny-level line mismatches kill sync silently — discount-per-line vs subtotal calc
13. Wrong financial data pushed — Cin7 wrong/duplicate/taxed-untaxed orders; inFlow→QBO phantom ~$300k adjustment

## Category D — Mobile app is the weak link (nearly universal)

14. Crashes/freeze mid-task — MaintainX kicked out constantly, half of number entries don't register; UpKeep freezes, "worse every update"
15. Data loss on rotation/backgrounding — UpKeep landscape rotation deletes entries; photos fail on poor signal
16. Desktop-first, mobile is a toy — Cheqroom, inFlow, Fishbowl, EZOffice all cited
17. Clunky field workflows — AssetTiger sluggish + re-login; UpKeep one-photo-at-a-time, dropdowns fail
18. Camera barcode scanning too slow/unreliable — lag on damaged labels, stops without wifi, doesn't sync → staff revert to manual

## Category E — No real offline mode

19. Cloud-only apps die in dead zones — EZOffice "does not work without cell signal"; freezers are WiFi dead zones; Sortly "offline" = full resync minutes
20. Offline scans create conflict debt — queued transactions fail on reconnect (blocked lot, deleted pick) → manual error-log reconciliation

## Category F — Reporting too rigid/useless

21. Reports can't answer basic questions — inFlow 2hrs to find 90-day non-sellers; Zoho needs paid Analytics (3hr sync)
22. Report customization hostage — Fishbowl iReports needs programming; custom reports $750+ each and BREAK on upgrades
23. No scheduled/automated exports — 40% want them (MaintainX); metrics graphs "don't align with data" → users export to Excel anyway
24. Format restrictions — PDF-only exports, no date-range picker, can't filter zero-stock; ERPNext tables painful
25. Can't report per order/quote — Fishbowl reports per item not per order

## Category G — Permissions can't express the org

26. Two-tier access is a killer — Katana Owner/User/Operator only; "wide open access including delete all"
27. No granular field/action permissions — Zoho couldn't enforce discount limits; AssetTiger roles too broad; Acumatica can't segregate invoice vs credit-memo creators
28. Workarounds via headcount limits — MaintainX limited users force workarounds

## Category H — Multi-location painful

29. No bin locations or crippled — Zoho "an inventory system with no bin locations sums it up"; Cin7 bin mgmt is paid add-on
30. Same item at multiple sites requires duplication — MaintainX; Epicor overstatement; Snipe-IT multi-company bugs
31. No "move all"/bulk transfer — EZOffice qty-per-item; Sortly move loses history → zero-qty ghost items
32. No transfer exceptions workflow — no partial receipt/damage/loss disposition; transfers jam or silently complete

## Category I — Import mangles data / migration trauma

33. CSV imports silently corrupt — Cin7 drops leading zeros → duplicate SKUs; dates misread; scientific-notation barcodes rejected; Shopify re-import deleted 1,500+ inventory values
34. Hidden required formats — NCH formulas dropped price/tax on 8,000 products; Cin7 needed paid consultant
35. Post-migration phantom balances — inFlow→QBO ~$300k phantom adjustment

## Category J — Onboarding takes weeks

36. Enterprise time-to-value — Fishbowl 6–8wk certification $2k–10k; Cin7 4–12wk + $800–1,200 fees; Finale $499/mo no self-serve trial
37. Menu/UI churn punishes memory — Odoo "still Google what functions are where" after 5 months
38. Fear of data loss stalls adoption — Katana users "afraid we'll lose data permanently… stopped inputting"

## Category K — UI cluttered/dated/overwhelming

39. ERP complexity for SMB — Odoo "cluttered… overwhelms newcomers"; ERPNext dense tables; Snipe-IT lag; EZOffice "disorienting"; Finale dated
40. Good features buried — Sortly can't change UOM/variations after creation; Cheqroom can't delete items, due-date "always reset"; Homebox search too exacting

## Category L — Vendor lock-in / hostage data

41. Exit deliberately painful — Cheqroom 240% hike then "difficult process to obtain data… likely cannot export to Excel"; Katana locks lot/bin data post-trial, charges month to leave
42. Export paywalled/partial — missing relationships, gated to top plans, rate-limited APIs, 30-day deletion windows; Homebox lacked export entirely (blocked insurance claims)
43. Free-tier rug pulls — AssetTiger arbitrary new limits force data deletion; Sortly 93%/357% hikes

## Category M — Pricing surprises

44. Pricing metrics punish customer — Katana per-user→per-order-line→GMV; $10-item shop pays ~same as $50M company; batch tracking $199/mo add-on
45. Per-seat + per-order fees stack — Zoho per-user stopped adding helper; Cin7 per-user on $349+ base
46. Feature gating to enterprise — MaintainX reporting locked top-tier; Katana bin/lot = add-ons; Finale Barcode WMS extra; UpKeep "features could be toggled" wish
47. Report customization nickel-and-dimed — Fishbowl $750+/report; Odoo retroactively charges "free" first app

## Category N — Support slow/absent/outsourced

48. Callback-only or ticket-then-silence — Fishbowl 24–48h callbacks "SEVERAL never called back"; Cin7 "literally NO ONE EVER THERE" (1.2★); EZOffice template replies; Cheqroom "worthless"; Sortly/AssetTiger email-only
49. Pay-to-fix-your-own-bugs — ERPNext free tier no support, $40/mo for support, 7-day silence on THEIR bug; Snipe-IT free = zero support/security features
50. Support deprioritizes "unsexy" modules — MaintainX PO/inventory slower than work orders; Cin7↔3PL blame ping-pong "no accountability"

## Category O — Feature gaps (recurring specifics)

51. No lot/serial/expiry/batch in base — inFlow no lot codes; Katana batch paywalled; Zoho batch barcodes not scannable; Cin7 basic unintuitive
52. No kit/compound BOM cascade — Zoho components don't adjust; inFlow circular-ref block; Finale no sales/use records; Katana no transaction history to debug
53. Alerts missing/mistimed — MaintainX only notifies AFTER overdue; users beg for "due today"; alerts silently don't fire; UpKeep status lag hours
54. No approval/reservation/hold workflows — Cheqroom no request-and-approve; no damage/write-off/returns disposition; Fishbowl RMA clunky
55. Can't take physical counts with a scanner — Acumatica; Zoho lacks clean handheld count flow

## Category P — Open-source/self-hosted specific

56. Upgrades break production silently — Snipe-IT v8.1.3 killed emails/webhooks; DB migration failures → 500s; Grocy SQLite corruption across releases; ERPNext >70% customizations unstable on upgrade
57. Security footguns — Snipe-IT LDAP sync stores recoverable passwords IN DB and backups (HN assessment); self-hosted = you are the security team
58. Sparse docs + you-are-the-support — Snipe-IT 902 open issues, Discord only; Grocy/Homebox "doubt the dev skills"; no SLA
59. Self-hosting hidden labor — Grocy needs HTTPS reverse proxy just for phone scanning; "highest abandonment rate" = daily manual input discipline fails; Homebox ~10min/asset → burnout

## Category Q — The incumbent: spreadsheets & paper

60. Errors endemic — ~94% of audited spreadsheets contain errors; duplicates, typos, formula breaks, no audit trail
61. No single source of truth — "two people, two versions"; clipboard is the only copy; same units promised twice
62. No history, no alerts, no real-time — stale snapshot; nobody alerted at reorder; reorders run on memory
63. Shrinkage invisible on paper — "paper records what you write down… cannot record what it never sees"; shops "routinely shocked" by shrinkage once real records exist
64. Counts stop the operation — full physical counts only way to know stock; month-end "never quite reconciles"; owner's hours = hidden cost
65. Double entry across silos — same data typed into sheet+accounting+POS; ERPNext customer story: double-allocated lumber cost a customer

## WHAT WOULD WIN — top 10 anti-complaint features

1. **Offline-first mobile scanning w/ conflict-aware sync** — local capture, auto-replay, visible conflict resolution. Kills themes 18–20.
2. **Honest two-way accounting sync** — penny-tolerant matching, plain-language error queue, never silent. Kills 11–13.
3. **Real-time channel sync + oversell protection + non-sticky in-transit** — atomic reservation; transfer states can't orphan. Kills 1–2, 7–10.
4. **One-click full data export, forever** — self-serve CSV+API dump of everything incl. history, even post-cancellation. Most-cited lock-in grievance.
5. **True granular RBAC + approvals** — field/action perms, per-user priorities, approval chains, immutable audit. Kills 26–28.
6. **Fast, flexible reporting** — saved/custom reports, scheduled CSV email, sub-second at 100k+ rows, per-order AND per-item. Report SPEED > report existence.
7. **Lot/serial/expiry/batch + kit/BOM cascade in base** — no add-ons for table stakes.
8. **Predictable, boring pricing** — flat tiers, no order-line/GMV/user surprises, grandfathering, monthly cancel, export on exit.
9. **Sub-day onboarding + validated import** — self-serve signup, CSV importer previews+reports errors before committing.
10. **Mobile parity + human support that answers** — offline app, camera scanning tuned for damaged labels, reachable chat/phone support.

**Runners-up:** fuzzy instant search; proactive "due today" alerts; bulk "move all" + cycle counts that freeze snapshots; damage/return/write-off dispositions; request-and-approve booking flows.
