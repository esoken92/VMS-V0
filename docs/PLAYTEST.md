# Playtest Script — VMS Demo

> A guided script for putting the demo in front of a real person and
> watching what breaks. Run it before demoing to a stakeholder, after any
> data-layer change, and whenever a flow "should obviously work".

## Before you start

- [ ] `docker compose up -d` — Postgres healthy (`docker compose ps`)
- [ ] `.env` configured (see `.env.example`; `DATABASE_URL` + `AUTH_SECRET` minimum)
- [ ] Schema + seed applied (demo users exist — see README credentials table)
- [ ] `npm run type-check` and `npm run lint` green
- [ ] A phone available for mobile/PWA checks (or DevTools device mode)

## Roles to cycle

| Persona | Account | Lens |
|---|---|---|
| Super admin | `demo.admin@vms-demo.com` | Can do everything; watch for privilege that should feel loud |
| Manager | `demo.manager@vms-demo.com` | Approvals, reports, variance sign-off |
| Fleet dispatch | `demo.fleet@vms-demo.com` | Inbound/outbound only; should *not* see admin surfaces |
| Staff | `demo.worker@vms-demo.com` | Count, scan, request — least privilege |

## Script

### 1. First impressions (5 min)

- [ ] Landing page loads `< 2 s`, readable on mobile
- [ ] "View demo" leads somewhere sensible; demo creds easy to find
- [ ] Login works first try for each persona
- [ ] Wrong password fails with a clear, non-specific error

### 2. The money loop — receive → move → count (15 min)

- [ ] Receive stock against a product (inbound movement)
- [ ] Confirm quantity changed *and* a ledger row exists for it
- [ ] Move/issue stock out — balance reflects the projection
- [ ] Run a blind stock take — does it avoid revealing system qty?
- [ ] Variance surfaces for review before posting

### 3. Tool custody (5 min)

- [ ] Check a tool out to a user — due date recorded
- [ ] Check it back in — condition logged
- [ ] Overdue loans are visibly flagged somewhere

### 4. Authorization probes (10 min)

- [ ] As `staff`, try an admin URL directly (`/dashboard/users`) — denied how?
- [ ] As `fleet_dispatch`, attempt a write outside scope — 4xx, not silent failure
- [ ] Confirm denied attempts appear in the audit log
- [ ] As `super_admin`, impersonate a user — reason required? banner visible? exit clean?

### 5. Scanning & mobile (10 min)

- [ ] Camera scan on a printed QR/barcode resolves the right product
- [ ] Keyboard-wedge scanner works without touching the screen
- [ ] Unknown barcode offers create-product rather than dead-ending
- [ ] Tap targets usable with gloves (≈48px+), high contrast in daylight

### 6. Offline behavior (5 min)

- [ ] Kill network (DevTools offline) — honest "offline" state, not a spinner
- [ ] Queue a scan/mutation offline; reconnect; confirm it syncs *once*
- [ ] Conflicts surface for resolution — never silently overwritten

### 7. Break-it pass (10 min)

- [ ] Huge quantity values, negatives, zero — validated how?
- [ ] Paste garbage into a scan field — rejected loudly
- [ ] Double-submit a form — idempotent? duplicate ledger rows?
- [ ] Refresh mid-stock-take — state survives?
- [ ] Back-button out of a mutation — no half-state visible

## Capture feedback

| # | Where were you? | What did you try? | What did you expect? | What happened? | Severity |
|---|---|---|---|---|---|
| 1 | | | | | |

## Notes for the facilitator

- Don't explain the UI beforehand — note where the tester hesitates.
- "I expected it to work like X" is data, not a support request.
- Severity guide: **P0** data loss/corruption · **P1** wrong result or
  blocked flow · **P2** confusion/friction · **P3** polish.
