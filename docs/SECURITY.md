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
  `DemoAdmin123!` demo accounts). These are intentional and not real
  credentials.
- Set real secrets only via environment variables in your deployment target.

## Dependency audit status

`npm audit` was run and all fixes that do not require a major-version upgrade
were applied. Remaining findings are listed below with the reason they are
accepted for this release.

### Pinned by the Next.js 14 framework line

The project intentionally stays on **Next.js 14.2.x** (the latest 14.x
release) with `eslint-config-next` at the matching version. These advisories
are only resolved in Next.js 15/16 (a breaking upgrade, out of scope):

| Package | Severity | Why it is accepted |
|---|---|---|
| `next` 14.2.35 | Critical (advisory union) | Already the newest 14.x. The residual advisories are largely configuration- or deployment-dependent (image-optimizer disk growth, request smuggling in rewrites, Server Action SSRF on custom servers, Windows-host RCE, i18n Pages-Router bypass, CSP-nonce XSS). This app sets `images.remotePatterns: []`, uses the App Router without i18n, and should be deployed on Linux/serverless — most vectors do not apply. Track the Next 15/16 upgrade separately. |
| `postcss` 8.4.31 (bundled inside `next`) | High | Version pinned by `next` itself; only fixable via a Next major upgrade. The issues require an attacker to supply crafted CSS/`sourceMappingURL` input — PostCSS here only processes authored project CSS at build time, not runtime user input. |
| `glob` 10.3.10 | High / Low | Version pinned by `@next/eslint-plugin-next` (must stay on 14.2.x to match `next`). The high-severity item is command injection through the `glob -c/--cmd` **CLI** flag; the plugin uses the library API only, and lint patterns are repo-controlled, so the CLI vector is unreachable. The remaining item is an `AbortSignal` cancellation bypass during traversal — dev-time linting only. |
| `minimatch` (nested under `@typescript-eslint/*` and `glob`) | Moderate | ReDoS-style DoS via crafted glob patterns. Fixed releases exist only in major versions outside the dependents' semver ranges; these are ESLint/lint-time dependencies processing repository-controlled patterns. Dev-only. |

### Dev-only build tooling (no fix published / no safe upgrade path)

| Package | Severity | Why it is accepted |
|---|---|---|
| `deepmerge` 4.3.1 | Moderate | Prototype-pollution in `mergeObject()`. **No patched release exists** (all versions `>=4.2.0` are affected). Reached only via `next-pwa` → `workbox-build` → `@rollup/plugin-node-resolve` — a devDependency that runs during `next build` to generate the service worker; it merges workbox's own build config, never attacker input. The suggested `npm audit fix --force` would *downgrade* `next-pwa` to 3.x and break the PWA build. |
| `esbuild` 0.18 (via `@esbuild-kit` loader under `drizzle-kit`) | Moderate | The advisory affects esbuild's **dev HTTP server** (cross-origin request exposure). `drizzle-kit` uses esbuild only through the transform API to load config files during `drizzle-kit generate` — the serve API is never started. Dev-only codegen tool; latest `drizzle-kit` still ships this loader. |

### Notes on resolved items

Applied in this pass (no breaking changes required):

- `next-auth` → `5.0.0-beta.32` (pulls `@auth/core` 0.41.3, fixing a critical
  email-normalizer homoglyph bypass, a `getToken()` uncaught-exception DoS,
  and OAuth cookie provider-binding issues).
- `drizzle-orm` → `^0.45.4` (fixes SQL identifier-escaping injection).
- `postcss` (top-level devDependency) → `^8.5.32`.
- `overrides.serialize-javascript` → `^7.1.4` (fixes an RCE/XSS pair inside
  `next-pwa`'s `rollup-plugin-terser` chain without touching `next-pwa`).
- `npm audit fix` batch: `brace-expansion`, `browserslist`,
  `baseline-browser-mapping`, `dompurify` (via `jspdf`), `fast-uri`,
  `js-yaml`, `nanoid`, `postcss-selector-parser`, `source-map-js`, and
  assorted `minimatch`/`brace-expansion` nested copies.

Re-run `npm audit` after any dependency change and keep this table current.
