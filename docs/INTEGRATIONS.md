# Integrations — Wire Your Own Services

VMS ships with every integration *point* built — adapters, routes, and env
hooks — but no external services provisioned. Everything below is optional;
if the env vars are unset, the feature disables gracefully and the UI shows
"not configured" rather than crashing. Wire what you need, ignore the rest.

## Required (the app won't boot without these)

| Var | What | How to get it |
|---|---|---|
| `DATABASE_URL` | Postgres connection string | Local: `docker compose up -d` → `postgresql://vms:vms_local_dev@localhost:5432/vms`. Hosted: your Supabase/Neon/RDS project's connection string (use the **pooler** URL on serverless) |
| `AUTH_SECRET` | Auth.js session secret | `openssl rand -base64 32` |
| `AUTH_URL` / `NEXT_PUBLIC_APP_URL` | App base URL | `http://localhost:3000` locally; your domain on deploys |

## Email — Resend (optional)

**Used for:** password resets, alert digests, scheduled report delivery.

1. Sign up at [resend.com](https://resend.com), verify a sending domain.
2. Set `RESEND_API_KEY` and `EMAIL_FROM="Your Name <noreply@yourdomain.com>"`.
3. Without it: password resets show "contact your administrator"; alerts stay in-app only.

## AI features — OpenAI-compatible (optional)

**Used for:** natural-language inventory queries, datasheet→product drafts, CSV column-mapping suggestions.

1. Set `OPENAI_API_KEY` (and `OPENAI_BASE_URL` if using a proxy/Ollama/compatible endpoint).
2. Without it: AI surfaces hide their entry points; all CRUD/manual flows unaffected.
3. **Cost note:** features are designed for cheap models — you bring the key, you control spend.

## MCP server (built-in, always on)

**Used for:** Claude Desktop / Cursor / agent integrations reading inventory data.

- Local: `http://localhost:3000/api/mcp` — works out of the box.
- Remote exposure: set `MCP_API_KEY_SALT` and issue scoped keys (see `app/api/mcp` docs).
- Config snippets for Claude Desktop and Cursor are in the README's MCP section.

## Object storage (optional)

**Used for:** product photos, attachments, damage evidence.

- Default: local filesystem at `./storage` (set `STORAGE_LOCAL_DIR`).
- S3-compatible: set `S3_ENDPOINT`, `S3_BUCKET`, `S3_ACCESS_KEY`, `S3_SECRET_KEY` — works with MinIO for fully self-hosted setups.

## Supabase Cloud (optional hosted-Postgres path)

The app is plain Postgres — Supabase is just one way to host it:

1. Create a project at [supabase.com](https://supabase.com).
2. Run `supabase/migrations/*.sql` in order via the SQL editor.
3. Point `DATABASE_URL` at the pooler connection string. Auth stays Auth.js — Supabase Auth/Storage/Realtime are **not** used.

## Sensor ingestion (framework ready, no service needed)

- Endpoint: `POST /api/sensors/ingest` (authenticated, idempotent on device+metric+timestamp).
- Bridge any MQTT/webhook source; a built-in simulator generates simulated readings without hardware.
- ESP32 examples + MQTT broker notes are planned as `docs/SENSORS.md` — not written yet; the ingest endpoint and simulator are the integration surface today.

## Typst PDF reports (built-in, no service needed)

In-process Typst compilation — no Gotenberg, no Chromium, no Playwright.
Templates live in `lib/pdf/templates/`; add a `.typ` template + a route and you have a report.

## What we deliberately don't wire

- **No telemetry/analytics** — nothing phones home, ever.
- **No cloud auth** — Auth.js credentials only; OAuth providers can be added in `auth.config.ts` if you want them.
- **No payments/billing** — it's free and self-hosted; there is nothing to meter.
