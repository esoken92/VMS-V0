**What & why**
<!-- What does this change, and what does it fix or enable? Link the issue if there is one. -->

**How tested**
<!-- What you ran, what you clicked through. "type-check + lint + build pass" is fine for small changes. -->

Checklist — the short version of [CONTRIBUTING.md](../CONTRIBUTING.md):

- [ ] `npm run type-check`, `npm run lint`, `npm run build` pass
- [ ] Migrations are additive only — no edits to applied files
- [ ] Stock quantities change through `stock_movements`, never in place
- [ ] New actions: Zod-validated input, server-side permission check, `Result<T>` return
- [ ] No secrets, no `.env`, no telemetry
