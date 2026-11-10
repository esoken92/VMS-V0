# Security

## Reporting

If you find a security issue in this project, please open a private GitHub
security advisory rather than a public issue.

## Secrets hygiene

- No credentials are committed to the repository. `.env` files (all `.env*`
  variants except the `.env.example` template) and the embedded-database
  directory `.vms-data/` are git-ignored.
- `.env.example`, `docker-compose.yml`, seeds, and docs contain only
  placeholders or explicit local-development defaults (e.g. `vms_local_dev`,
  `VmsAdmin123!` seed accounts). These are intentional and not real
  credentials.
- Set real secrets only via environment variables in your deployment target.

## Dependency audit status

`npm audit` reports **11 moderate / 0 high / 0 critical** findings on the
current stack (Next.js 16.4.3, React 19, Tailwind CSS 4). The Next.js 14
critical advisory union is resolved by the 16.x upgrade. Remaining items are
listed with the reason they are accepted for this release.

### Dev-only tooling (moderate; no non-breaking fix published)

| Package | Severity | Why it is accepted |
|---|---|---|
| `esbuild` 0.18 (via `@esbuild-kit` ESM loader under `drizzle-kit`) | Moderate | The advisory affects esbuild's **dev HTTP server** (cross-origin request exposure). `drizzle-kit` uses esbuild only through the transform API to load config files during `drizzle-kit generate` — the serve API is never started. Dev-only codegen tool; no in-range fix exists. |
| `minimatch` (nested under `typescript-eslint` / `@typescript-eslint/*`) | Moderate | ReDoS-style DoS via crafted glob patterns. ESLint processes repo-controlled patterns at lint time only — dev tooling, never runtime input. Fix requires a `typescript-eslint` major outside eslint-config-next 16.4.3's tested range. |

### Removed by the upgrade pass

- `next` 14.2.35 → **16.4.3** — clears the critical advisory union plus the
  bundled `postcss`/`glob`/`minimatch` pins that only had fixes in 15/16.
- `next-pwa` → removed entirely (unmaintained since 2022, incompatible with
  Next 15+). The service worker is now a handwritten `public/sw.js`, so the
  whole `workbox-build`/`deepmerge`/`serialize-javascript` chain is gone.
- `jspdf`, `react-dropzone` → removed (declared but never imported).
- `postgres` stays on `^3.4.9`: postgres.js 4.x changed named prepared
  statements in a way `@electric-sql/pglite-socket` can't serve (Postgres
  error 26000 on every bind). Revisit when pglite-socket supports it.

### Earlier resolved items

- `next-auth` `5.0.0-beta.32` (pulls `@auth/core` 0.41.3, fixing a critical
  email-normalizer homoglyph bypass, a `getToken()` uncaught-exception DoS,
  and OAuth cookie provider-binding issues).
- `drizzle-orm` `^0.45.4` (fixes SQL identifier-escaping injection).

Re-run `npm audit` after any dependency change and keep this table current.
